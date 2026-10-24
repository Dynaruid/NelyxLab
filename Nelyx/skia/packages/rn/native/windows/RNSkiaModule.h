// SPDX-License-Identifier: BSD-3-Clause
#pragma once
#include <NativeModules.h>
#include "RNSkWindowsHost.h"
#include "WindowsKeyboardState.h"
#include <atomic>

namespace RNSkia {
REACT_MODULE(RNSkiaWindowsModule,L"RNSkiaModule")
struct RNSkiaWindowsModule {
  REACT_INIT(initialize)
  void initialize(winrt::Microsoft::ReactNative::ReactContext const &value,facebook::jsi::Runtime &runtime) noexcept {
    context=value;jsRuntime=&runtime;owner=std::this_thread::get_id();
  }
  REACT_SYNC_METHOD(install)
  bool install() noexcept {
    try {
      if(!jsRuntime || owner!=std::this_thread::get_id())throw std::runtime_error("RNW JSI initializer/JS owner unavailable");
      if(host)return host->isActive();
      wchar_t executable[32768];const auto size=GetModuleFileNameW(nullptr,executable,32768);
      if(!size || size>=32768)throw std::runtime_error("Windows app location unavailable");
      const auto assets=std::filesystem::path(executable).parent_path()/L"Assets";
      WindowsSkiaHostOptions options;options.assetRoots={assets.wstring()};options.icuUri=winrt::to_string((assets/L"icudtl.dat").wstring());
      auto composition=context.Properties().Get(WindowsCompositionSessionProperty());
      if(composition){options.composition=*composition;options.createDevice=[session=options.composition](){return session->createDevice();};}
      else options.createDevice=[](){return std::make_shared<nelyx::vulkan::Device>();};
      // Fabric presentation/screenshot registry is a separate required port.
      if(options.composition)options.screenshot=[session=options.composition](size_t tag){return session->screenshot(tag);};
      else options.screenshot=[](size_t)->sk_sp<SkImage>{throw std::runtime_error("Windows Fabric screenshot registry is not attached");};
      options.reportError=[](const std::exception &error){OutputDebugStringA(error.what());};
      host=RNSkWindowsHost::install(*jsRuntime,context,std::move(options));return true;
    }catch(const std::exception &error){OutputDebugStringA(error.what());return false;}
  }
  REACT_METHOD(getKeyboardState)
  void getKeyboardState(winrt::Microsoft::ReactNative::ReactPromise<winrt::Microsoft::ReactNative::JSValueObject> promise) noexcept {
    try{context.UIDispatcher().Post([context=context,promise,live=live]() noexcept {
      try{using namespace winrt::Microsoft::ReactNative;if(!live->load())throw std::runtime_error("Native keyboard module retired");
        const auto state=WindowsKeyboardState(context)->snapshot();JSValueArray keys;
        for(const auto& key:state)keys.push_back(JSValueObject{{"keyCode",double(key.keyCode)},{"scanCode",double(key.scanCode)}});
        promise.Resolve(JSValueObject{{"protocol",1},{"target","windows"},{"keys",std::move(keys)}});
      }catch(std::exception const& error){promise.Reject(error.what());}catch(...){promise.Reject("Windows observed keyboard snapshot failed");}
    });}catch(std::exception const& error){promise.Reject(error.what());}catch(...){promise.Reject("Windows keyboard dispatcher unavailable");}
  }
  ~RNSkiaWindowsModule(){live->store(false);RNSkWindowsHost::retainUnconfirmed(host);}
private:
  winrt::Microsoft::ReactNative::ReactContext context;
  facebook::jsi::Runtime *jsRuntime=nullptr;
  std::thread::id owner;
  std::shared_ptr<RNSkWindowsHost> host;
  std::shared_ptr<std::atomic<bool>> live=std::make_shared<std::atomic<bool>>(true);
};
} // namespace RNSkia
