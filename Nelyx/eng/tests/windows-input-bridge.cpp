// SPDX-License-Identifier: BSD-3-Clause
#include <TextInputModule.h>
#include <TextInputSkiaSurface.h>
#include <winrt/Microsoft.ReactNative.Composition.h>
#include <winrt/Microsoft.UI.Windowing.h>
#include <winrt/Microsoft.UI.Input.h>
#include <iostream>

namespace {
namespace RN=winrt::Microsoft::ReactNative;
using namespace Nelyx::WindowsInput;
bool finished=false,passed=false;winrt::Microsoft::UI::Windowing::AppWindow fixtureWindow{nullptr};std::shared_ptr<TextInputRoot> inputRoot;
REACT_MODULE(NelyxInputFixture)
struct NelyxInputFixture {
  RN::ReactContext context;
  REACT_INIT(initialize)
  void initialize(RN::ReactContext const& value)noexcept{context=value;}
  REACT_METHOD(complete)
  void complete(bool ok,std::string message)noexcept{context.UIDispatcher().Post([ok,message=std::move(message)]{
    if(finished)return;finished=true;passed=ok;try{if(inputRoot)inputRoot->close();}catch(std::exception const& error){passed=false;std::cerr<<"Bridge input retirement failed: "<<error.what()<<std::endl;}
    if(passed)std::cout<<"PASS-input-bridge: "<<message<<std::endl;else std::cerr<<"FAIL-input-bridge: "<<message<<std::endl;if(fixtureWindow)fixtureWindow.Destroy();
  });}
};
struct Provider:winrt::implements<Provider,RN::IReactPackageProvider>{void CreatePackage(RN::IReactPackageBuilder const& builder)noexcept{AddAttributedModules(builder,true);}};
}
int runWindowsInputBridge(winrt::hstring const& bundleRoot){
  using namespace Nelyx::WindowsInput;winrt::init_apartment(winrt::apartment_type::single_threaded);SetProcessDpiAwarenessContext(DPI_AWARENESS_CONTEXT_PER_MONITOR_AWARE_V2);const auto foreground=GetForegroundWindow();
  auto app=RN::ReactNativeAppBuilder().Build();auto settings=app.ReactNativeHost().InstanceSettings();settings.PackageProviders().Append(winrt::make<Provider>());
  settings.BundleRootPath(L"file://"+bundleRoot+L"/");settings.JavaScriptBundleFile(L"input");settings.UseDeveloperSupport(false);settings.UseFastRefresh(false);settings.UseDirectDebugger(false);
  settings.NativeLogger([](auto level,auto const& message){std::cerr<<"RNW "<<static_cast<int>(level)<<" "<<winrt::to_string(message)<<std::endl;});app.ReactViewOptions().ComponentName(L"NelyxInputFixture");fixtureWindow=app.AppWindow();fixtureWindow.Title(L"Nelyx nonvisual input module regression");fixtureWindow.Resize({500,260});
  inputRoot=installTextInputRoot(settings,app.ReactNativeWindow(),[](std::string const& reason){std::cerr<<"Native input root failed: "<<reason<<std::endl;});const auto weakRoot=std::weak_ptr<TextInputRoot>(inputRoot);
  RN::ReactPropertyBag(settings.Properties()).Set(TextInputSurfaceResolverProperty(),TextInputSurfaceResolver{[weakRoot](RN::IReactContext const& context,uint64_t tag,Owner const& owner){
    auto root=weakRoot.lock();auto component=RN::Composition::CompositionUIService::ComponentFromReactTag(context,static_cast<int64_t>(tag)).try_as<RN::Composition::ComponentView>();
    if(!root||!component||!component.Root()||component.Root().ReactNativeIsland().Island()!=root->island()||owner.id!="module-input"||owner.generation!=1)throw std::invalid_argument("Fixture requires its real RNW full-root View/tag");
    const auto payload=component.UserData();component.UserData(winrt::box_value(int32_t{7}));bool rejected=false;try{TextInputSkiaSurface::resolve(root,context,tag,owner);}catch(std::invalid_argument const&){rejected=true;}component.UserData(payload);if(!rejected)throw std::runtime_error("The production producer admitted foreign RN View UserData as a Skia backing");
    const auto weakView=winrt::make_weak(component.as<RN::ComponentView>());TextInputProtocolCallbacks mapping;mapping.active=[weakView]{return bool(weakView.get());};
    // This fixture's RN View fills the root without offset/transform. This is
    // controlled mapping evidence, not the production Skia surface producer.
    mapping.screenRect=[weakRoot,weakView](Rect const& rect,CoreGeometry const&)->std::optional<ScreenRect>{auto current=weakRoot.lock();if(!current||!weakView.get())return std::nullopt;const auto mapped=current->island().CoordinateConverter().ConvertLocalToScreen(winrt::Windows::Foundation::Rect{float(rect.x),float(rect.y),float(rect.width),float(rect.height)});return RECT{mapped.X,mapped.Y,mapped.X+mapped.Width,mapped.Y+mapped.Height};};
    mapping.viewPoint=[weakRoot,weakView](POINT point,DWORD,CoreGeometry const&)->std::optional<ViewPoint>{auto current=weakRoot.lock();if(!current||!weakView.get())return std::nullopt;const auto mapped=current->island().CoordinateConverter().ConvertScreenToLocal(winrt::Windows::Graphics::PointInt32{point.x,point.y});return ViewPoint{mapped.X,mapped.Y};};
    mapping.focusSurface=[weakRoot,weakView]{auto current=weakRoot.lock();auto view=weakView.get();if(!current||!view)return false;const auto top=GetAncestor(current->window(),GA_ROOT);ShowWindow(top,SW_SHOW);SetForegroundWindow(top);return view.TryFocus(RN::FocusState::Programmatic)&&winrt::Microsoft::UI::Input::InputFocusController::GetForIsland(current->island()).TrySetFocus();};return mapping;
  }});
  auto timer=winrt::Microsoft::UI::Dispatching::DispatcherQueue::GetForCurrentThread().CreateTimer();timer.Interval(std::chrono::seconds(30));timer.IsRepeating(false);const auto token=timer.Tick([](auto const&,auto const&){if(!finished){finished=true;std::cerr<<"Native input bridge watchdog expired"<<std::endl;if(inputRoot)inputRoot->close();fixtureWindow.Destroy();}});timer.Start();
  app.Start();timer.Stop();timer.Tick(token);fixtureWindow=nullptr;inputRoot.reset();if(foreground&&IsWindow(foreground))SetForegroundWindow(foreground);return finished&&passed?0:1;
}
