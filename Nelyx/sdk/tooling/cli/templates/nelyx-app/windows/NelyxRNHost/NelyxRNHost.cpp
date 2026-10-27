// SPDX-License-Identifier: BSD-3-Clause
#include "pch.h"
#include "NelyxRNHost.h"
#include "AutolinkedNativeModules.g.h"
#include "NativeModules.h"
#include "NelyxAppConfig.h"
#include <DevelopmentSource.h>
#include <native/windows/RNSkiaModule.h>
#include <native/windows/SkiaView.h>
#include <WindowsAppHost.h>
#include <PlatformServices.h>
#include <TextInputModule.h>
#include <SemanticsComponent.h>

static void Log(std::string const& message){OutputDebugStringA((message+"\n").c_str());}
struct ErrorReporter:winrt::implements<ErrorReporter,winrt::Microsoft::ReactNative::IRedBoxHandler>{
  bool IsDevSupportEnabled()const noexcept{return true;}
  void ShowNewError(winrt::Microsoft::ReactNative::IRedBoxErrorInfo const& info,winrt::Microsoft::ReactNative::RedBoxErrorType)noexcept{
    Log("REACT_ERROR "+winrt::to_string(info.Message()));
    for(auto const& frame:info.Callstack())Log("REACT_STACK "+winrt::to_string(frame.Method())+" "+winrt::to_string(frame.File())+":"+std::to_string(frame.Line())+":"+std::to_string(frame.Column()));
  }
  void UpdateError(winrt::Microsoft::ReactNative::IRedBoxErrorInfo const& info)noexcept{ShowNewError(info,winrt::Microsoft::ReactNative::RedBoxErrorType::Native);}
  void DismissRedBox()noexcept{}
};
struct PackageProvider:winrt::implements<PackageProvider,winrt::Microsoft::ReactNative::IReactPackageProvider>{
  void CreatePackage(winrt::Microsoft::ReactNative::IReactPackageBuilder const& builder)noexcept{
    AddAttributedModules(builder,true);RNSkia::RegisterWindowsSkiaView(builder);Nelyx::WindowsSemantics::RegisterSemanticsComponent(builder);
  }
};
_Use_decl_annotations_ int CALLBACK WinMain(HINSTANCE,HINSTANCE,PSTR,int showCommand){
  std::optional<NelyxDevelopment::Source> development;
  try{development=NelyxDevelopment::read(NELYX_WINDOWS_DEVELOPMENT==1);}catch(std::exception const& error){Log(std::string("DEVELOPMENT_SOURCE_REJECTED ")+error.what());return 2;}
  winrt::init_apartment(winrt::apartment_type::single_threaded);SetProcessDpiAwarenessContext(DPI_AWARENESS_CONTEXT_PER_MONITOR_AWARE_V2);
  wchar_t directory[MAX_PATH]{};GetModuleFileNameW(nullptr,directory,MAX_PATH);PathCchRemoveFileSpec(directory,MAX_PATH);
  RNSkia::WindowsReactApp app;auto settings=app.ReactNativeHost().InstanceSettings();
  // RNW's public enum has only Hermes/V8. The verified JSC supplier owns the
  // default slot and publishes its independent JSC VM identity to the SDK.
  settings.JSIEngineOverride(NELYX_WINDOWS_V8?winrt::Microsoft::ReactNative::JSIEngine::V8:winrt::Microsoft::ReactNative::JSIEngine::Hermes);
  settings.NativeLogger([](auto level,auto const& message){Log("NATIVE_LOG "+std::to_string(static_cast<int>(level))+" "+winrt::to_string(message));});
  settings.RedBoxHandler(winrt::make<ErrorReporter>());
  settings.InstanceDestroyed([](auto const&,auto const&){Log("INSTANCE_DESTROYED");});
  RegisterAutolinkedNativeModulePackages(settings.PackageProviders());settings.PackageProviders().Append(winrt::make<PackageProvider>());
  settings.BundleRootPath(std::wstring(L"file://").append(directory).append(L"\\Bundle\\").c_str());settings.JavaScriptBundleFile(L"index.windows");
  settings.UseFastRefresh(false);settings.UseDirectDebugger(false);settings.UseDeveloperSupport(false);
  if(development){settings.SourceBundleHost(development->host);settings.SourceBundlePort(development->port);settings.JavaScriptBundleFile(L"main");settings.UseDeveloperSupport(true);settings.UseFastRefresh(true);settings.RequestInlineSourceMap(false);Log("DEVELOPMENT_SOURCE loopback port="+std::to_string(development->port));}
  auto window=app.AppWindow();window.Title(NELYX_APP_NAME);window.Resize({1000,1000});
  wchar_t vendor[32]{};GetEnvironmentVariableW(L"NELYX_WINDOWS_GPU_VENDOR",vendor,32);
  auto native=RNSkia::WindowsAppHost::install(settings,window,app.ReactNativeWindow(),Log,vendor[0]?wcstoul(vendor,nullptr,0):0,showCommand);
  app.ReactViewOptions().ComponentName(NELYX_APP_NAME);Log("APP_START");app.Start();Log("APP_STOP");return 0;
}
