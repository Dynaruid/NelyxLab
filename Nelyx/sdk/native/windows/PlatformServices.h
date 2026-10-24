// SPDX-License-Identifier: BSD-3-Clause
#pragma once
#include <NativeModules.h>
#include "RestorationStore.h"
#include "LaunchUri.h"
#include <Windows.h>
#include <string>
#include <vector>
#include <functional>
#include <ReactPropertyBag.h>
#include <winrt/Windows.ApplicationModel.DataTransfer.h>
#include <winrt/Microsoft.ReactNative.Composition.h>
#include <uiautomationcore.h>
#include <uiautomationcoreapi.h>
#include <cmath>
#pragma comment(lib,"uiautomationcore.lib")
#pragma comment(lib,"oleaut32.lib")

namespace Nelyx {
inline auto PlatformCloseRequestProperty(){using namespace winrt::Microsoft::ReactNative;return ReactPropertyId<ReactNonAbiValue<std::function<void()>>>{L"Nelyx.SDK",L"CloseRootWindow.v1"};}
/** A synchronous OS snapshot, observed by the app-owned SDK locale watcher. */
REACT_MODULE(NelyxPlatformServices)
struct NelyxPlatformServices {
  REACT_INIT(initialize)
  void initialize(winrt::Microsoft::ReactNative::ReactContext const& value) noexcept {context=value;}
  REACT_SYNC_METHOD(getAccessibilityProtocol)
  int32_t getAccessibilityProtocol() noexcept {return 1;}
  REACT_SYNC_METHOD(getAccessibilityFeatures)
  winrt::Microsoft::ReactNative::JSValueObject getAccessibilityFeatures() noexcept {
    using namespace winrt::Microsoft::ReactNative;
    BOOL animations=TRUE;HIGHCONTRASTW contrast{};contrast.cbSize=sizeof(contrast);
    if(!SystemParametersInfoW(SPI_GETCLIENTAREAANIMATION,0,&animations,0)||
       !SystemParametersInfoW(SPI_GETHIGHCONTRAST,sizeof(contrast),&contrast,0))
      return JSValueObject{{"error","Windows accessibility query failed: "+std::to_string(GetLastError())}};
    // SPI_GETSCREENREADER does not detect Narrator. Keep reader demand unknown;
    // the View-owned framework tree remains available to UIA independently.
    return JSValueObject{{"protocol",1},{"features",(animations?0:4|16)|((contrast.dwFlags&HCF_HIGHCONTRASTON)?32:0)},
      {"supportedFeatures",4|16|32},{"semanticsEnabled",nullptr}};
  }
  REACT_METHOD(dispatchAccessibilityEvent)
  void dispatchAccessibilityEvent(double rootTag,double,std::string type,std::string message,winrt::Microsoft::ReactNative::ReactPromise<bool> promise) noexcept {
    if(type!="announce"){promise.Resolve(false);return;}
    if(!std::isfinite(rootTag)||rootTag<=0||rootTag>INT32_MAX||rootTag!=std::floor(rootTag)){promise.Reject("Invalid accessibility React View tag");return;}
    try{auto owner=context;owner.UIDispatcher().Post([owner,tag=static_cast<int64_t>(rootTag),message=std::move(message),promise]() noexcept {
      try{using namespace winrt::Microsoft::ReactNative::Composition;
        auto component=CompositionUIService::ComponentFromReactTag(owner.Handle(),tag).try_as<ComponentView>();
        if(!component){promise.Resolve(false);return;}auto root=component.Root();
        if(!root||(!component.Parent()&&component.Tag()!=root.Tag())){promise.Resolve(false);return;}
        auto island=root.ReactNativeIsland();if(!island){promise.Resolve(false);return;}
        auto provider=island.GetUiaProvider().try_as<IRawElementProviderSimple>();if(!provider){promise.Resolve(false);return;}
        auto text=winrt::to_hstring(message);auto bstr=SysAllocStringLen(text.c_str(),static_cast<UINT>(text.size()));if(!bstr){promise.Reject("Accessibility message allocation failed");return;}
        auto result=UiaRaiseNotificationEvent(provider.get(),NotificationKind_Other,NotificationProcessing_ImportantMostRecent,bstr,bstr);SysFreeString(bstr);winrt::check_hresult(result);promise.Resolve(true);
      }catch(winrt::hresult_error const& error){promise.Reject(error.message().c_str());}
      catch(std::exception const& error){promise.Reject(error.what());}
      catch(...){promise.Reject("Windows accessibility notification failed");}
    });}catch(winrt::hresult_error const& error){promise.Reject(error.message().c_str());}
    catch(std::exception const& error){promise.Reject(error.what());}
    catch(...){promise.Reject("Windows accessibility dispatcher unavailable");}
  }
  // RNW's legacy Clipboard module lets WinRT exceptions escape its UI callback.
  // Keep OS contention/reentrancy errors inside this acknowledged SDK request.
  REACT_METHOD(setClipboardText)
  void setClipboardText(std::string text,winrt::Microsoft::ReactNative::ReactPromise<void> promise) noexcept {
    try{context.UIDispatcher().Post([text=std::move(text),promise]() noexcept {
      try{using namespace winrt::Windows::ApplicationModel::DataTransfer;DataPackage data;data.SetText(winrt::to_hstring(text));Clipboard::SetContent(data);promise.Resolve();}
      catch(winrt::hresult_error const& error){promise.Reject(error.message().c_str());}
      catch(std::exception const& error){promise.Reject(error.what());}
      catch(...){promise.Reject("Windows clipboard write failed");}
    });}catch(winrt::hresult_error const& error){promise.Reject(error.message().c_str());}
    catch(std::exception const& error){promise.Reject(error.what());}
    catch(...){promise.Reject("Windows clipboard dispatcher unavailable");}
  }
  REACT_METHOD(getClipboardText)
  void getClipboardText(winrt::Microsoft::ReactNative::ReactPromise<std::string> promise) noexcept {
    try{context.UIDispatcher().Post([promise]() noexcept {
      try{using namespace winrt::Windows::ApplicationModel::DataTransfer;auto data=Clipboard::GetContent();if(!data.Contains(StandardDataFormats::Text())){promise.Resolve("");return;}
        auto operation=data.GetTextAsync();operation.Completed([promise](auto const& result,auto status) noexcept {
          try{if(status==winrt::Windows::Foundation::AsyncStatus::Completed)promise.Resolve(winrt::to_string(result.GetResults()));else promise.Reject("Windows clipboard read canceled or failed");}
          catch(winrt::hresult_error const& error){promise.Reject(error.message().c_str());}
          catch(std::exception const& error){promise.Reject(error.what());}
          catch(...){promise.Reject("Windows clipboard result failed");}
        });
      }catch(winrt::hresult_error const& error){promise.Reject(error.message().c_str());}
      catch(std::exception const& error){promise.Reject(error.what());}
      catch(...){promise.Reject("Windows clipboard read failed");}
    });}catch(winrt::hresult_error const& error){promise.Reject(error.message().c_str());}
    catch(std::exception const& error){promise.Reject(error.what());}
    catch(...){promise.Reject("Windows clipboard dispatcher unavailable");}
  }
  REACT_SYNC_METHOD(getRestorationProtocol)
  int32_t getRestorationProtocol() noexcept {return 1;}
  REACT_METHOD(readRestoration)
  void readRestoration(std::string key,winrt::Microsoft::ReactNative::ReactPromise<winrt::Microsoft::ReactNative::JSValue> promise) noexcept {
    try{auto value=RestorationStore().read(key);if(value)promise.Resolve(winrt::Microsoft::ReactNative::JSValue{*value});else promise.Resolve(winrt::Microsoft::ReactNative::JSValue{});}
    catch(std::exception const& error){promise.Reject(error.what());}
    catch(...){promise.Reject("Windows restoration read failed");}
  }
  REACT_METHOD(writeRestoration)
  void writeRestoration(std::string key,std::string value,winrt::Microsoft::ReactNative::ReactPromise<bool> promise) noexcept {
    try{RestorationStore().write(key,value);promise.Resolve(true);}
    catch(std::exception const& error){promise.Reject(error.what());}
    catch(...){promise.Reject("Windows restoration write failed");}
  }
  REACT_SYNC_METHOD(getNavigationProtocol)
  int getNavigationProtocol() noexcept {return 1;}
  REACT_METHOD(getInitialRouteInformation)
  void getInitialRouteInformation(winrt::Microsoft::ReactNative::ReactPromise<winrt::Microsoft::ReactNative::JSValue> promise) noexcept {
    try{auto uri=ReadLaunchUri();if(uri)promise.Resolve(winrt::Microsoft::ReactNative::JSValue{winrt::to_string(*uri)});else promise.Resolve(winrt::Microsoft::ReactNative::JSValue{});}
    catch(std::exception const& error){promise.Reject(error.what());}
    catch(...){promise.Reject("Windows launch URI unavailable");}
  }
  REACT_SYNC_METHOD(getPreferredLocales)
  winrt::Microsoft::ReactNative::JSValueObject getPreferredLocales() noexcept {
    using namespace winrt::Microsoft::ReactNative;
    try {
      ULONG count=0,length=0;
      if(!GetUserPreferredUILanguages(MUI_LANGUAGE_NAME,&count,nullptr,&length))
        return JSValueObject{{"error","GetUserPreferredUILanguages failed: "+std::to_string(GetLastError())}};
      if(count>256||length>256*129)return JSValueObject{{"error","Preferred-language snapshot exceeds its budget"}};
      if(!count||!length)return JSValueObject{{"locales",JSValueArray{}},{"format","bcp47"}};
      std::vector<wchar_t> buffer(length);
      if(!GetUserPreferredUILanguages(MUI_LANGUAGE_NAME,&count,buffer.data(),&length))
        return JSValueObject{{"error","GetUserPreferredUILanguages failed: "+std::to_string(GetLastError())}};
      JSValueArray locales;
      for(const wchar_t* current=buffer.data();*current;current+=wcslen(current)+1)
        locales.emplace_back(winrt::to_string(winrt::hstring(current)));
      return JSValueObject{{"locales",std::move(locales)},{"format","bcp47"}};
    }catch(const std::exception& error){return JSValueObject{{"error",std::string(error.what())}};}
    catch(...){return JSValueObject{{"error","Windows preferred-language query failed"}};}
  }
  REACT_METHOD(popSystemNavigator)
  void popSystemNavigator(bool,winrt::Microsoft::ReactNative::ReactPromise<void> promise) noexcept {
    try{auto owner=context;owner.UIDispatcher().Post([owner,promise]() noexcept {
      bool acknowledged=false;
      try{auto value=owner.Properties().Get(PlatformCloseRequestProperty());if(!value){promise.Reject("Owned root window close port is unavailable");return;}std::function<void()> close=*value;if(!close){promise.Reject("Root window close port is empty");return;}
        // Queue the JS acknowledgement before the cooperative native shutdown
        // callback, whose drain includes this admitted OS request.
        promise.Resolve();acknowledged=true;close();
      }catch(const std::exception& error){if(!acknowledged)promise.Reject(error.what());else OutputDebugStringA(error.what());}
    });}catch(const std::exception& error){promise.Reject(error.what());}
    catch(...){promise.Reject("Windows root close request failed");}
  }
private:
  winrt::Microsoft::ReactNative::ReactContext context;
};
}
