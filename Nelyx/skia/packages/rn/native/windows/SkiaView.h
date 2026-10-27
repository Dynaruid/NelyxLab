// SPDX-License-Identifier: BSD-3-Clause
#pragma once
#include "RNSkWindowsWindowSurface.h"
#include "windows/WindowsKeyboardInput.h"
#include "WindowsKeyboardState.h"
#include "MouseCursor.h"
#include "windows/WindowsPrecisionTrackpad.h"
#include <NativeModules.h>
#include <JSValueComposition.h>
#include <winrt/Microsoft.ReactNative.Composition.Experimental.h>
#include <winrt/Microsoft.ReactNative.Composition.Input.h>
#include <winrt/Microsoft.UI.Input.h>
#include <charconv>
#include <cmath>
#include <map>
#include <optional>
#include <tuple>

namespace RNSkia {
inline auto WindowsCompositionDeviceProperty() {
  using namespace winrt::Microsoft::ReactNative;
  return ReactPropertyId<ReactNonAbiValue<std::shared_ptr<WindowsCompositionDevice>>>{L"Nelyx.Skia.Windows",L"CompositionDevice.v1"};
}
struct WindowsSurfaceStatus {
  std::string phase,reason;uint64_t nativeId=0,viewGeneration=0,surfaceGeneration=0,frames=0,reactTag=0,layoutRevision=0;
  double logicalWidth=0,logicalHeight=0,width=0,height=0,scale=1,presentedWidth=0,presentedHeight=0;
  uint64_t presentedSurfaceGeneration=0;
  bool bound=false,visible=false,precisionAvailable=false;
};
struct WindowsSkiaViewOptions {
  WindowsCompositionSurface::CopyObserver observeCopy;
  std::function<void(const WindowsSurfaceStatus&)> observeStatus;
};
struct WindowsSkiaProps : winrt::implements<WindowsSkiaProps,winrt::Microsoft::ReactNative::IComponentProps> {
  WindowsSkiaProps(winrt::Microsoft::ReactNative::ViewProps const&,winrt::Microsoft::ReactNative::IComponentProps const& previous) {
    if(previous){auto old=previous.as<WindowsSkiaProps>();nativeId=old->nativeId;opaque=old->opaque;highBitDepth=old->highBitDepth;mouseCursor=old->mouseCursor;windowViewport=old->windowViewport;}
  }
  void SetProp(uint32_t,winrt::hstring const& name,winrt::Microsoft::ReactNative::IJSValueReader const& value) noexcept {
    using winrt::Microsoft::ReactNative::ReadValue;
    if(name==L"nativeID")ReadValue(value,nativeId);
    else if(name==L"opaque")ReadValue(value,opaque);
    else if(name==L"highBitDepth")ReadValue(value,highBitDepth);
    else if(name==L"mouseCursor")ReadValue(value,mouseCursor);
    else if(name==L"windowViewport")ReadValue(value,windowViewport);
  }
  std::string nativeId;
  std::string mouseCursor="basic";
  bool opaque=false,highBitDepth=false,windowViewport=false;
};
class WindowsSkiaViewState final : public std::enable_shared_from_this<WindowsSkiaViewState> {
  struct PointerSample {std::string device;double x,y;uint64_t generation;};
  struct Payload {
    winrt::Microsoft::UI::Composition::SpriteVisual visual{nullptr};
    winrt::Microsoft::ReactNative::EventEmitter emitter{nullptr};
    std::shared_ptr<RNSkWindowsWindowSurface> surface;
    std::shared_ptr<RNSkView> view;
    std::shared_ptr<WindowsCompositionSession::ViewTicket> ticket;
    WindowsSurfaceStatus status;
    std::map<uint32_t,PointerSample> pressedPointers;
    std::map<uint32_t,PointerSample> hoverPointers;
    std::unique_ptr<WindowsKeyboardInput> keyboard;
    std::shared_ptr<ObservedKeyboardState> observedKeyboard;
    ObservedKeyboardState::Owner keyboardOwner=0;
    uint64_t keySequence=0,keyGeneration=0;
    uint64_t inputSequence=0,pendingLayoutRevision=0,presentedGeneration=0;
    std::optional<winrt::Microsoft::ReactNative::LayoutMetrics> desiredLayout,pendingLayout;
    bool resizeAwaiting=false;
    std::shared_ptr<WindowsPrecisionTrackpad> precision;
    uint64_t nextKeyboardProxy=0;
    std::map<int64_t,std::pair<uint64_t,uint64_t>> keyboardProxies;
    bool keyboardFocused=false;
    std::function<void()> unwatchVisibility,unwatchViewport;
    bool windowViewport=false;
    bool failed=false,inputRetiring=false,closing=false;
  };
public:
  WindowsSkiaViewState(winrt::Microsoft::ReactNative::ComponentView const& view,WindowsSkiaViewOptions options)
    :owner(std::this_thread::get_id()),options(std::move(options)),data(std::make_unique<Payload>()) {
    data->visual=view.as<winrt::Microsoft::ReactNative::Composition::ComponentView>().Compositor().CreateSpriteVisual();
    data->status.reactTag=static_cast<uint64_t>(view.Tag());
    data->keyboard=std::make_unique<WindowsKeyboardInput>([this](const WindowsKeyPacket& packet){emitKeyboard(packet);},[this](uint32_t point,WindowsCharacterObservation const& observation){emitText(point,observation);});
    try{winrt::Microsoft::ReactNative::ReactContext context(view.ReactContext());
    data->observedKeyboard=WindowsKeyboardState(context);data->keyboardOwner=data->observedKeyboard->newOwner();
    auto nativeSession=context.Properties().Get(WindowsCompositionSessionProperty());auto nativeDevice=context.Properties().Get(WindowsCompositionDeviceProperty());
    if(!nativeSession||!nativeDevice)throw std::runtime_error("Actual Windows module/session/UI device properties are required");
    session=*nativeSession;device=*nativeDevice;session->uiPlatform();
    }catch(const std::exception& error){data->failed=true;data->status.reason=error.what();}
    catch(...){data->failed=true;data->status.reason="Windows SkiaView native initialization failed";}
  }
  ~WindowsSkiaViewState(){if(data){if(session)session->fail();data.release();}}
  winrt::Microsoft::UI::Composition::Visual visual() const {requireUi();return data?data->visual:nullptr;}
  // Input adapters may read this UI-owned lifetime/backing snapshot. They do
  // not acquire GPU resources or infer paragraph geometry from the visual.
  std::optional<WindowsSurfaceStatus> inputSurface() const {requireUi();return data&&!data->failed&&!data->inputRetiring&&data->status.phase!="closed"?std::optional<WindowsSurfaceStatus>(data->status):std::nullopt;}
  std::function<void()> registerKeyboardProxy(int64_t tag){
    requireUi();if(!inputSurface()||!data->status.bound||tag<=0||data->keyboardProxies.contains(tag)||data->keyboardProxies.size()>=4096||data->nextKeyboardProxy==UINT64_MAX)throw std::invalid_argument("Core keyboard proxy requires a unique live surface tag within admission");
    const auto token=++data->nextKeyboardProxy;data->keyboardProxies.emplace(tag,std::make_pair(data->status.viewGeneration,token));
    return [weak=weak_from_this(),tag,token]{if(auto current=weak.lock()){current->requireUi();if(!current->data)return;auto& proxies=current->data->keyboardProxies;const auto found=proxies.find(tag);if(found!=proxies.end()&&found->second.second==token)proxies.erase(found);}};
  }
  bool ownsKeyboardProxy(int64_t tag)const{requireUi();if(!inputSurface())return false;const auto found=data->keyboardProxies.find(tag);return found!=data->keyboardProxies.end()&&found->second.first==data->status.viewGeneration;}
  std::function<void()> observeInputSurface(std::function<void()> changed){
    requireUi();if(!changed||!data)throw std::invalid_argument("Input surface observer requires a live UI view");const auto id=++nextInputObserver;inputObservers.emplace(id,std::move(changed));
    return [weak=weak_from_this(),id]{if(auto current=weak.lock()){current->requireUi();current->inputObservers.erase(id);}};
  }
  bool hasCursorHover()const{requireUi();return data&&!data->failed&&data->status.bound&&data->status.visible&&!data->hoverPointers.empty();}
  std::shared_ptr<WindowsPrecisionTrackpad> precisionTrackpad()const{requireUi();return data?data->precision:nullptr;}
  void setPrecisionTrackpad(std::shared_ptr<WindowsPrecisionTrackpad> const& value){requireUi();if(data){if(data->precision&&data->precision!=value)throw std::logic_error("A live Skia surface already owns its precision input");data->precision=value;data->status.precisionAvailable=bool(value);emit("input-ready",value?"":"DirectManipulation unavailable; native wheel fallback");}}
  void precision(WindowsPrecisionEvent const& event){
    requireUi();if(!data||data->failed||!data->status.bound||!data->emitter||(!pointerGeometryReady()&&event.kind!="panZoomEnd"&&event.kind!="inertiaCancel")){if(windowsPrecisionDiagnosticsEnabled())windowsPrecisionDiagnostic("surface-rejected kind="+event.kind);return;}
    using namespace winrt::Microsoft::ReactNative;
    auto payload=std::make_shared<JSValueObject>(JSValueObject{{"protocol",1},{"kind",event.kind},{"device","trackpad"},
      {"pointer",double(event.pointer)},{"buttons",0},{"x",event.origin.x},{"y",event.origin.y},{"panX",event.panX},{"panY",event.panY},
      {"deltaX",event.deltaX},{"deltaY",event.deltaY},{"scale",event.scale},{"rotation",0},{"timestamp",event.timestamp},{"sequence",double(++data->inputSequence)},
      {"surfaceGeneration",double(event.origin.generation)}});
    data->emitter.DispatchEvent(L"windowsPointer",[payload,kind=event.kind,sequence=data->inputSequence](IJSValueWriter const& writer) noexcept {if(windowsPrecisionDiagnosticsEnabled()&&(kind!="panZoomUpdate"||sequence%32==0))windowsPrecisionDiagnostic("js-delivered kind="+kind+" sequence="+std::to_string(sequence));WriteValue(writer,*payload);});
  }
  void props(WindowsSkiaProps const& props) {
    requireUi();if(!data||data->failed||data->closing)return;if(props.highBitDepth)throw std::runtime_error("Windows SkiaView supports BGRA8/sRGB only");
    if(props.nativeId.empty()){data->inputRetiring=true;notifyInputSurface();closeBinding();if(data->status.nativeId){data->status.nativeId=0;++data->status.viewGeneration;}data->inputRetiring=false;emit("unbound","");return;}
    uint64_t id{};auto parsed=std::from_chars(props.nativeId.data(),props.nativeId.data()+props.nativeId.size(),id);
    if(parsed.ec!=std::errc{}||parsed.ptr!=props.nativeId.data()+props.nativeId.size()||!id||id>9007199254740991ULL)
      throw std::runtime_error("Windows SkiaView nativeID must be a positive safe integer");
    if(data->status.nativeId!=id){data->inputRetiring=true;notifyInputSurface();closeBinding();data->status.nativeId=id;++data->status.viewGeneration;data->inputRetiring=false;}
    configureWindowViewport(props.windowViewport);bindIfReady();notifyInputSurface();
  }
  void configureWindowViewport(bool enabled){
    if(enabled==bool(data->unwatchViewport))return;
    if(data->view)throw std::runtime_error("Window viewport ownership requires a remount when changed");
    if(data->unwatchViewport){data->unwatchViewport();data->unwatchViewport={};}data->windowViewport=enabled;
    if(enabled)data->unwatchViewport=session->observeWindowViewport([weak=weak_from_this()](WindowsCompositionSession::WindowViewport viewport){if(auto self=weak.lock();self&&self->data&&!self->data->closing)self->layoutWindowViewport(viewport);});
  }
  void layoutWindowViewport(WindowsCompositionSession::WindowViewport viewport){
    auto metrics=data->desiredLayout.value_or(winrt::Microsoft::ReactNative::LayoutMetrics{});
    metrics.Frame={0,0,float(viewport.width)/viewport.scale,float(viewport.height)/viewport.scale};metrics.PointScaleFactor=viewport.scale;
    layoutContent(metrics);
  }
  void layout(winrt::Microsoft::ReactNative::LayoutMetrics const& metrics) {
    requireUi();if(!data||data->failed||data->closing)return;
    if(data->windowViewport){if(const auto viewport=session->getWindowViewport())layoutWindowViewport(*viewport);return;}
    layoutContent(metrics);
  }
  void layoutContent(winrt::Microsoft::ReactNative::LayoutMetrics const& metrics) {
    requireUi();if(!data||data->failed||data->closing)return;
    const double scale=metrics.PointScaleFactor,w=std::round(double(metrics.Frame.Width)*scale),h=std::round(double(metrics.Frame.Height)*scale);
    if(!std::isfinite(scale)||scale<=0||scale>8||!std::isfinite(w)||!std::isfinite(h)||w<0||h<0||w>4096||h>4096)
      throw std::runtime_error("Windows SkiaView backing dimensions exceed admission");
    data->visual.Size({static_cast<float>(w),static_cast<float>(h)});
    if(data->desiredLayout){const auto& old=*data->desiredLayout;if(old.PointScaleFactor==metrics.PointScaleFactor&&old.Frame.Width==metrics.Frame.Width&&old.Frame.Height==metrics.Frame.Height)return;}
    data->desiredLayout=metrics;const auto revision=++data->status.layoutRevision;
    if(data->status.bound&&data->status.visible&&w>0&&h>0)session->resize->requested(data->status.nativeId,revision);
    session->frameTrace.add({},data->status.nativeId,revision,6,static_cast<uint32_t>(w),static_cast<uint32_t>(h));
    cancelPointers();if(data->precision)data->precision->cancel();
    // Keep one admitted immutable epoch active through its surface commit. Replacing
    // its backing on every WM_SIZE would reject all CPU frames under fast drag.
    if(data->resizeAwaiting&&data->status.visible&&data->view&&w>0&&h>0){
      data->pendingLayout=metrics;data->pendingLayoutRevision=revision;emit("resize-pending","");return;
    }
    data->pendingLayout.reset();applyLayout(metrics,revision);
  }
  void applyLayout(winrt::Microsoft::ReactNative::LayoutMetrics const& metrics,uint64_t revision){
    const double scale=metrics.PointScaleFactor,w=std::round(double(metrics.Frame.Width)*scale),h=std::round(double(metrics.Frame.Height)*scale);
    auto& status=data->status;
    status.logicalWidth=metrics.Frame.Width;status.logicalHeight=metrics.Frame.Height;status.width=w;status.height=h;status.scale=scale;status.visible=w>0&&h>0&&session->windowVisible();status.surfaceGeneration=revision;
    session->frameTrace.add({},status.nativeId,revision,7,static_cast<uint32_t>(w),static_cast<uint32_t>(h));
    data->resizeAwaiting=data->view&&status.frames>0&&status.visible;
    for(auto& [id,sample]:data->hoverPointers)sample.generation=status.surfaceGeneration;
    if(data->surface){data->surface->setSurfaceGeneration(status.surfaceGeneration);data->surface->setLayoutSize(static_cast<int>(w),static_cast<int>(h));data->surface->resize(static_cast<int>(w),static_cast<int>(h));}
    bindIfReady();emit("layout","");
  }
  void finishResize(){
    data->resizeAwaiting=false;
    if(data->pendingLayout){const auto metrics=*data->pendingLayout;const auto revision=data->pendingLayoutRevision;data->pendingLayout.reset();applyLayout(metrics,revision);}
  }
  bool pointerGeometryReady()const{return data&&data->status.surfaceGeneration==data->status.layoutRevision&&data->presentedGeneration==data->status.surfaceGeneration;}
  void emitter(winrt::Microsoft::ReactNative::EventEmitter value) {requireUi();if(!data)return;data->emitter=std::move(value);if(data->failed)emit("failed",data->status.reason);else if(data->status.bound)emit("bound","");}
  bool ownsWindowViewport()const{return data&&data->windowViewport;}
  auto windowPointer()const{return session->windowPointer;}
  void wheel(winrt::Microsoft::ReactNative::Composition::Input::PointerRoutedEventArgs const& args) {
    if(!data||ownsWindowViewport())return;
    if(wheelPoint(args.GetCurrentPoint(static_cast<int64_t>(data->status.reactTag))))args.Handled(true);
  }
  template<class Point> bool wheelPoint(Point const& point) {
    requireUi();if(!data||data->failed||!data->status.bound||!data->status.visible||!data->emitter||!pointerGeometryReady())return false;
    auto properties=point.Properties();auto position=point.Position();
    INPUT_MESSAGE_SOURCE source{};const bool trackpad=GetCurrentInputMessageSource(&source)&&source.deviceType==IMDT_TOUCHPAD;
    if(trackpad&&data->precision&&data->precision->ownsWheel())return true;
    UINT units=3;SystemParametersInfoW(properties.IsHorizontalMouseWheel()?SPI_GETWHEELSCROLLCHARS:SPI_GETWHEELSCROLLLINES,0,&units,0);
    const auto extent=units==WHEEL_PAGESCROLL?(properties.IsHorizontalMouseWheel()?data->status.logicalWidth:data->status.logicalHeight):double(units)*16.0;
    const auto delta=-double(properties.MouseWheelDelta())/120.0*extent;
    using namespace winrt::Microsoft::ReactNative;
    auto payload=std::make_shared<JSValueObject>(JSValueObject{{"x",double(position.X)},{"y",double(position.Y)},
      {"deltaX",properties.IsHorizontalMouseWheel()?delta:0.0},{"deltaY",properties.IsHorizontalMouseWheel()?0.0:delta},
      {"surfaceGeneration",double(data->status.surfaceGeneration)},{"timestamp",windowsMonotonicMilliseconds()},{"sourceTimestamp",double(point.Timestamp())},
      {"sequence",double(++data->inputSequence)},{"pointer",double(point.PointerId())},{"device",trackpad?"trackpad":"mouse"}});
    data->emitter.DispatchEvent(L"windowsWheel",[payload](IJSValueWriter const& writer) noexcept {WriteValue(writer,*payload);});return true;
  }
  void pointer(std::string kind,winrt::Microsoft::ReactNative::Composition::Input::PointerRoutedEventArgs const& args) {
    if(data&&!ownsWindowViewport())pointerPoint(std::move(kind),args.GetCurrentPoint(static_cast<int32_t>(data->status.reactTag)));
  }
  template<class Point> void pointerPoint(std::string kind,Point const& point) {
    requireUi();if(!data||data->failed||!data->status.bound||!data->status.visible||!data->emitter||!pointerGeometryReady())return;
    const auto properties=point.Properties();const auto position=point.Position();
    const auto type=point.PointerDeviceType();
    using PointerDeviceType=decltype(type);
    const std::string pointerDevice=type==PointerDeviceType::Mouse?"mouse":type==PointerDeviceType::Pen?"pen":type==PointerDeviceType::Touch?"touch":"unknown";
    const auto update=properties.PointerUpdateKind();
    using PointerUpdateKind=decltype(update);
    const bool released=update==PointerUpdateKind::LeftButtonReleased||update==PointerUpdateKind::RightButtonReleased||
      update==PointerUpdateKind::MiddleButtonReleased||update==PointerUpdateKind::XButton1Released||update==PointerUpdateKind::XButton2Released;
    const bool inside=position.X>=0&&position.Y>=0&&position.X<data->status.logicalWidth&&position.Y<data->status.logicalHeight;
    if(properties.IsCanceled())kind="cancel";
    // RNW can synthesize a leave after releasing an active mouse touch. The
    // actual mouse remains over this view; real movement/exit still uses the
    // native component callbacks, including exits into an occluding sibling.
    else if(kind=="leave"&&pointerDevice=="mouse"&&released&&inside)return;
    uint32_t buttons=(properties.IsLeftButtonPressed()?1u:0u)|((properties.IsRightButtonPressed()||properties.IsBarrelButtonPressed())?2u:0u)|
      (properties.IsMiddleButtonPressed()?4u:0u)|(properties.IsXButton1Pressed()?8u:0u)|(properties.IsXButton2Pressed()?16u:0u);
    if((pointerDevice=="touch"||pointerDevice=="pen")&&point.IsInContact())buttons|=1u;
    if(kind=="move"&&!buttons&&(pointerDevice=="mouse"||pointerDevice=="pen"))kind="hover";
    if(!std::isfinite(position.X)||!std::isfinite(position.Y))throw std::runtime_error("Invalid Windows native pointer coordinates");
    const auto id=point.PointerId();const PointerSample sample{pointerDevice,double(position.X),double(position.Y),data->status.surfaceGeneration};
    if(kind=="down"||(data->pressedPointers.count(id)&&kind=="move"))data->pressedPointers.insert_or_assign(id,sample);
    else if(kind=="up"||kind=="cancel")data->pressedPointers.erase(id);
    if(kind=="leave")data->hoverPointers.erase(id);
    else if(pointerDevice=="mouse"||pointerDevice=="pen")data->hoverPointers.insert_or_assign(id,sample);
    emitPointer(kind,id,buttons,sample);
  }
  void cancelPointers() {
    requireUi();if(!data)return;auto pointers=std::move(data->pressedPointers);data->pressedPointers.clear();
    for(const auto& [id,sample]:pointers)emitPointer("cancel",id,0,sample);
  }
  void leavePointer(uint32_t id) {
    requireUi();if(!data)return;
    // Exit updates hover only. WinUI can exit during focus transfer before
    // delivering the same press's up; do not cancel that active gesture.
    // Own capture loss, layout and retirement cancel presses separately.
    if(auto hovered=data->hoverPointers.find(id);hovered!=data->hoverPointers.end()){
      const auto sample=hovered->second;data->hoverPointers.erase(hovered);emitPointer("leave",id,0,sample);
    }
  }
  void leaveHoverPointers() {
    requireUi();if(!data)return;auto pointers=std::move(data->hoverPointers);data->hoverPointers.clear();
    for(const auto& [id,sample]:pointers)emitPointer("leave",id,0,sample);
  }
  void leavePointers() {cancelPointers();leaveHoverPointers();}
  void keyboardFocus(bool focused){
    requireUi();if(!data)return;
    if(data->observedKeyboard){if(focused&&data->status.bound)data->observedKeyboard->focus(data->keyboardOwner,[weak=weak_from_this()](ObservedKeyboardState::FocusStamp const& stamp,uint32_t key,uint32_t scan,uint32_t repeat){if(auto self=weak.lock())self->consumedKeyUp(stamp,key,scan,repeat);});else data->observedKeyboard->blur(data->keyboardOwner);}
    if(!focused){data->keyboard->reset();++data->keyGeneration;}
    if(data->keyboardFocused==focused)return;data->keyboardFocused=focused;
    if(!data->status.bound||!data->emitter)return;
    using namespace winrt::Microsoft::ReactNative;
    auto payload=std::make_shared<JSValueObject>(JSValueObject{{"protocol",1},{"sequence",double(nextKeySequence())},{"focused",focused},{"viewGeneration",double(data->status.viewGeneration)}});
    data->emitter.DispatchEvent(L"windowsKeyboardFocus",[payload](IJSValueWriter const& writer) noexcept {WriteValue(writer,*payload);});
  }
  void key(bool up,winrt::Microsoft::ReactNative::Composition::Input::KeyRoutedEventArgs const& args,winrt::Microsoft::ReactNative::IReactDispatcher const& dispatcher){
    requireUi();if(!data||data->failed||!data->status.bound||!data->status.visible||!data->emitter)return;
    const auto status=args.KeyStatus();const auto original=static_cast<uint32_t>(args.OriginalKey());if(original==VK_PACKET){data->keyboard->flush();return;}
    const auto scan=(status.ScanCode&0xff)|(status.IsExtendedKey?0xe000:0),key=keyIdentity(original,scan);
    WindowsKeyPacket packet;packet.keyCode=key;packet.scanCode=scan;packet.up=up;packet.repeat=!up&&status.WasKeyDown;packet.repeatCount=status.RepeatCount;
    const auto source=args.KeyboardSource();keyState(packet,[&](int vk){return static_cast<uint32_t>(source.GetKeyState(static_cast<winrt::Windows::System::VirtualKey>(vk)));});
    MSG next{};const bool queued=!up&&::PeekMessageW(&next,nullptr,WM_KEYFIRST,WM_KEYLAST,PM_NOREMOVE);
    const auto mapped=!up?::MapVirtualKeyW(original,MAPVK_VK_TO_CHAR):0;
    packet.dead=queued&&(next.message==WM_DEADCHAR||next.message==WM_SYSDEADCHAR)&&mapped!=0;
    if(packet.dead)packet.characterCodePoint=mapped&0x7fffffff;
    const bool expected=queued&&mapped!=0&&(next.message==WM_CHAR||next.message==WM_SYSCHAR);
    keyboardFocus(true);data->keyboard->key(packet,expected);const auto generation=++data->keyGeneration;
    if(data->keyboard->pending())dispatcher.Post([weak=weak_from_this(),generation]{if(auto self=weak.lock();self&&self->data&&self->data->keyGeneration==generation)self->data->keyboard->flush();});
  }
  void character(winrt::Microsoft::ReactNative::Composition::Input::CharacterReceivedRoutedEventArgs const& args){
    requireUi();if(!data||data->failed||!data->keyboardFocused)return;
    const auto status=args.KeyStatus();const auto point=static_cast<uint32_t>(args.KeyCode()),scan=(status.ScanCode&0xff)|(status.IsExtendedKey?0xe000:0);
    const auto observation=data->observedKeyboard->takeCharacter(data->keyboardOwner,point,scan);data->keyboard->character(point,scan,observation);
    if(!data->keyboard->pending())++data->keyGeneration;
  }
private:
  static uint32_t keyIdentity(uint32_t original,uint32_t scan){
    if(original==VK_SHIFT||original==VK_LSHIFT){const auto side=::MapVirtualKeyW(scan&0xff,MAPVK_VSC_TO_VK_EX);if(side)return side;}
    else if(original==VK_CONTROL||original==VK_LCONTROL)return scan&0xe000?VK_RCONTROL:VK_LCONTROL;
    else if(original==VK_MENU||original==VK_LMENU)return scan&0xe000?VK_RMENU:VK_LMENU;
    return original;
  }
  template<class ReadState>static void keyState(WindowsKeyPacket& packet,ReadState const& read){
    const int keys[]={VK_SHIFT,VK_LSHIFT,VK_RSHIFT,VK_CONTROL,VK_LCONTROL,VK_RCONTROL,VK_MENU,VK_LMENU,VK_RMENU,VK_LWIN,VK_RWIN,VK_CAPITAL,VK_NUMLOCK,VK_SCROLL};
    for(uint32_t i=0;i<14;i++)if(read(keys[i])&1)packet.modifiers|=1u<<i;
    packet.capsLock=(read(VK_CAPITAL)&2)!=0;packet.numLock=(read(VK_NUMLOCK)&2)!=0;packet.scrollLock=(read(VK_SCROLL)&2)!=0;
  }
  void consumedKeyUp(ObservedKeyboardState::FocusStamp const& stamp,uint32_t original,uint32_t scan,uint32_t repeat){
    requireUi();if(!data||data->failed||!data->status.bound||!data->status.visible||!data->keyboardFocused||!data->emitter||original==VK_PACKET||data->keyboardOwner!=stamp.owner||!data->observedKeyboard->focused(stamp))return;
    // An older down may still be waiting for WM_CHAR. Publish it first, then
    // release only the physical key actually observed by this canvas owner.
    data->keyboard->flush();if(!data||data->failed||!data->observedKeyboard->focused(stamp))return;++data->keyGeneration;
    const auto observed=data->observedKeyboard->pressed(stamp.owner,keyIdentity(original,scan),scan);if(!observed)return;
    WindowsKeyPacket packet;packet.keyCode=observed->keyCode;packet.scanCode=observed->scanCode;packet.up=true;packet.repeatCount=repeat;
    keyState(packet,[](int vk){return static_cast<uint32_t>(winrt::Microsoft::UI::Input::InputKeyboardSource::GetKeyStateForCurrentThread(static_cast<winrt::Windows::System::VirtualKey>(vk)));});
    data->keyboard->key(packet,false);
  }
  void notifyInputSurface(){
    const auto value=inputSurface();std::optional<std::tuple<uint64_t,uint64_t,uint64_t,uint64_t,bool,bool>> key;
    if(value)key={{value->nativeId,value->viewGeneration,value->surfaceGeneration,value->layoutRevision,value->bound,value->visible}};
    if(key==inputSnapshot)return;inputSnapshot=key;const auto observers=inputObservers;
    for(auto const& [id,callback]:observers)if(inputObservers.contains(id))callback();
  }
  uint64_t nextKeySequence(){const auto value=++data->keySequence;if(value>9007199254740991ULL)throw std::runtime_error("Windows keyboard sequence exhausted");return value;}
  void emitKeyboard(const WindowsKeyPacket& packet){
    if(!data||data->failed||!data->keyboardFocused||!data->status.bound||!data->emitter)return;
    data->observedKeyboard->observe(data->keyboardOwner,packet.keyCode,packet.scanCode,packet.up);
    using namespace winrt::Microsoft::ReactNative;
    auto payload=std::make_shared<JSValueObject>(JSValueObject{{"protocol",1},{"sequence",double(nextKeySequence())},{"viewGeneration",double(data->status.viewGeneration)},
      {"kind",packet.up?"up":"down"},{"keyCode",double(packet.keyCode)},{"scanCode",double(packet.scanCode)},{"characterCodePoint",double(packet.characterCodePoint)},{"modifiers",double(packet.modifiers)},
      {"repeat",packet.repeat},{"repeatCount",double(packet.repeatCount)},{"dead",packet.dead},{"capsLock",packet.capsLock},{"numLock",packet.numLock},{"scrollLock",packet.scrollLock}});
    payload->emplace("focusEpoch",double(packet.focusEpoch));
    data->emitter.DispatchEvent(L"windowsKey",[payload](IJSValueWriter const& writer) noexcept {WriteValue(writer,*payload);});
  }
  void emitText(uint32_t point,WindowsCharacterObservation const& observation){
    if(!data||data->failed||!data->keyboardFocused||!data->status.bound||!data->emitter)return;
    using namespace winrt::Microsoft::ReactNative;
    auto payload=std::make_shared<JSValueObject>(JSValueObject{{"protocol",1},{"sequence",double(nextKeySequence())},{"viewGeneration",double(data->status.viewGeneration)},{"characterCodePoint",double(point)},{"repeatCount",double(observation.repeatCount)},{"focusEpoch",double(observation.focusEpoch)}});
    data->emitter.DispatchEvent(L"windowsText",[payload](IJSValueWriter const& writer) noexcept {WriteValue(writer,*payload);});
  }
  void emitPointer(std::string const& kind,uint32_t id,uint32_t buttons,PointerSample const& sample) {
    if(!data||!data->emitter)return;
    using namespace winrt::Microsoft::ReactNative;
    auto payload=std::make_shared<JSValueObject>(JSValueObject{{"protocol",1},{"kind",kind},{"device",sample.device},
      {"pointer",double(id)},{"buttons",double(buttons)},{"x",sample.x},{"y",sample.y},
      {"surfaceGeneration",double(sample.generation)},{"timestamp",windowsMonotonicMilliseconds()},{"sequence",double(++data->inputSequence)}});
    data->emitter.DispatchEvent(L"windowsPointer",[payload](IJSValueWriter const& writer) noexcept {WriteValue(writer,*payload);});
  }
public:
  void fail(std::string reason) noexcept {
    if(!data||data->failed)return;data->failed=true;data->status.bound=false;
    try{emit("failed",reason);}catch(...){}
    try{closeBinding();}catch(...){if(session)session->fail();}
  }
  void closeUi() {
    requireUi();if(!data||data->closing)return;data->closing=true;
    if(data->unwatchVisibility){data->unwatchVisibility();data->unwatchVisibility={};}data->inputRetiring=true;notifyInputSurface();data->emitter=nullptr;
    if(data->view)data->view->setFrameScheduler({});
    if(data->surface){auto surface=data->surface;auto self=shared_from_this();surface->whenIdle([self]{self->finishCloseUi();});return;}
    finishCloseUi();
  }
private:
  void finishCloseUi(){
    requireUi();if(!data)return;
    try{closeBinding();data->status.visible=false;emit("closed","");data->emitter=nullptr;data->visual=nullptr;data.reset();}
    catch(std::exception const& error){session->fail(error.what());throw;}
    catch(winrt::hresult_error const& error){session->fail("Windows native view retirement HRESULT="+std::to_string(error.code().value)+" "+winrt::to_string(error.message()));throw;}
    catch(...){session->fail("Windows native view retirement HRESULT failure");throw;}
  }
  void requireUi() const {if(std::this_thread::get_id()!=owner)throw std::runtime_error("Windows SkiaView requires its UI owner");}
  void closeBinding() {
    if(!data)return;auto precision=std::move(data->precision);data->status.precisionAvailable=false;if(precision)precision->cancel();precision.reset();
    if(data->unwatchViewport){data->unwatchViewport();data->unwatchViewport={};}data->windowViewport=false;data->resizeAwaiting=false;data->presentedGeneration=0;keyboardFocus(false);leavePointers();if(!data->view)return;data->status.bound=false;
    data->view->setFrameScheduler({});data->view->stopContent();
    data->surface->setPresented({});data->surface->setResizeCancelled({});data->surface->setRequestRedraw({});data->surface->setCanPresent({});
    session->retireScreenshot(data->status.reactTag,data->view);session->retireView(data->ticket);
    data->surface->detach();data->ticket.reset();data->view.reset();data->surface.reset();if(data->pendingLayout){const auto latest=*data->pendingLayout;data->status.logicalWidth=latest.Frame.Width;data->status.logicalHeight=latest.Frame.Height;data->status.scale=latest.PointScaleFactor;data->status.width=std::round(double(latest.Frame.Width)*latest.PointScaleFactor);data->status.height=std::round(double(latest.Frame.Height)*latest.PointScaleFactor);data->status.surfaceGeneration=data->pendingLayoutRevision;data->pendingLayout.reset();}
  }
  void bindIfReady() {
    if(data&&!data->failed&&!data->closing&&!data->unwatchVisibility)data->unwatchVisibility=session->observeWindowVisibility([weak=weak_from_this()](bool shown){if(auto self=weak.lock())try{self->windowVisibility(shown);}catch(std::exception const& error){self->fail(error.what());}catch(...){self->fail("Windows surface visibility failed");}});
    if(!data||data->failed||data->closing||data->view||!data->status.nativeId||!data->status.width||!data->status.height)return;
    auto& status=data->status;auto platform=session->uiPlatform();
    data->surface=std::make_shared<RNSkWindowsWindowSurface>(session,device,options.observeCopy,data->windowViewport);
    data->surface->setSurfaceGeneration(status.surfaceGeneration);
    data->surface->setViewIdentity(status.nativeId);
    data->view=std::make_shared<RNSkView>(platform,data->surface);
    const auto generation=status.viewGeneration;auto weak=weak_from_this();
    data->surface->setCanPresent([weak,generation]{auto self=weak.lock();return self&&self->data&&!self->data->failed&&self->data->status.viewGeneration==generation&&(self->data->status.visible||self->session->preparingWindow());});
    data->surface->setPresented([weak,generation](uint64_t frames){if(auto self=weak.lock();self&&self->data&&self->data->status.viewGeneration==generation){auto& status=self->data->status;status.frames=frames;status.presentedSurfaceGeneration=status.surfaceGeneration;status.presentedWidth=status.width;status.presentedHeight=status.height;self->data->presentedGeneration=status.surfaceGeneration;self->emit("frame","");if(self->session->preparingWindow()){self->session->firstContentReady();self->emit("visibility","");}self->finishResize();}});
    data->surface->setResizeCancelled([weak,generation]{if(auto self=weak.lock();self&&self->data&&self->data->status.viewGeneration==generation)self->finishResize();});
    data->surface->setLayoutSize(static_cast<int>(status.width),static_cast<int>(status.height));
    data->surface->attach(winrt::get_abi(data->visual),static_cast<int>(status.width),static_cast<int>(status.height),false,false,{});
    session->registerScreenshot(status.reactTag,data->view);
    data->ticket=session->registerView(status.nativeId,data->view,[weak,generation](std::string failure){if(auto self=weak.lock();self&&self->data&&self->data->status.viewGeneration==generation){
      if(!failure.empty()){self->fail(std::move(failure));return;}self->data->status.bound=true;self->emit("bound","");}});
  }
  void windowVisibility(bool shown){
    requireUi();if(!data||data->failed)return;const bool visible=shown&&data->status.width>0&&data->status.height>0;if(data->status.visible==visible)return;
    data->status.visible=visible;if(!visible){cancelPointers();keyboardFocus(false);finishResize();}else{bindIfReady();if(data->view)data->view->requestRedraw();}emit("visibility","");
  }
  void emit(std::string phase,std::string reason) {
    if(!data)return;auto& status=data->status;status.phase=std::move(phase);status.reason=std::move(reason);
    using namespace winrt::Microsoft::ReactNative;
    if(data->emitter){auto payload=std::make_shared<JSValueObject>(JSValueObject{
      {"phase",status.phase},{"reason",status.reason},{"nativeId",double(status.nativeId)},{"reactTag",double(status.reactTag)},
      {"viewGeneration",double(status.viewGeneration)},{"surfaceGeneration",double(status.surfaceGeneration)},{"frames",double(status.frames)},
      {"logicalWidth",status.logicalWidth},{"logicalHeight",status.logicalHeight},{"width",status.width},{"height",status.height},{"scale",status.scale},
      {"layoutRevision",double(status.layoutRevision)},{"resizePending",status.layoutRevision!=status.surfaceGeneration||data->resizeAwaiting},{"pointerGeometryReady",pointerGeometryReady()},{"bound",status.bound},{"visible",status.visible},{"preparing",session&&session->preparingWindow()},{"precisionAvailable",status.precisionAvailable},{"framePipelineVersion",2},{"pointerVersion",1},{"keyboardVersion",2},{"visibilityVersion",1},{"windowViewport",data->windowViewport}});
      // Fabric expects one object, not CallJSFunction's argument array. Own
      // its bytes until the emitter evaluates the writer on the JS owner.
      data->emitter.DispatchEvent(L"windowsSurfaceStatus",[payload](IJSValueWriter const& writer) noexcept {WriteValue(writer,*payload);});}
    const auto snapshot=status;notifyInputSurface();if(options.observeStatus)options.observeStatus(snapshot);
  }
  const std::thread::id owner;
  WindowsSkiaViewOptions options;
  std::shared_ptr<WindowsCompositionSession> session;
  std::shared_ptr<WindowsCompositionDevice> device;
  std::unique_ptr<Payload> data;
  uint64_t nextInputObserver=0;
  std::map<uint64_t,std::function<void()>> inputObservers;
  std::optional<std::tuple<uint64_t,uint64_t,uint64_t,uint64_t,bool,bool>> inputSnapshot;
};
struct WindowsSkiaComponent : winrt::implements<WindowsSkiaComponent,winrt::IInspectable> {
private:
  struct InputIdentity {winrt::weak_ref<winrt::Microsoft::ReactNative::ComponentView> view;winrt::weak_ref<WindowsSkiaComponent> component;};
  static auto& inputIdentities(){static thread_local std::map<void*,InputIdentity> values;return values;}
  void* inputIdentity=nullptr;
public:
  // Only the native factory can publish this typed weak identity. Interpreting
  // arbitrary IInspectable UserData as our implementation is not a type check.
  static winrt::com_ptr<WindowsSkiaComponent> findInputComponent(winrt::Microsoft::ReactNative::ComponentView const& view){
    if(!view)return nullptr;auto& identities=inputIdentities();const auto found=identities.find(winrt::get_abi(view));if(found==identities.end()||found->second.view.get()!=view)return nullptr;
    auto component=found->second.component.get();if(!component||view.UserData()!=component.as<winrt::IInspectable>())return nullptr;return component;
  }
  void registerInputIdentity(winrt::Microsoft::ReactNative::ComponentView const& view){
    if(inputIdentity)throw std::logic_error("Skia input identity already registered");const auto identity=winrt::get_abi(view);auto& identities=inputIdentities();if(identities.contains(identity))throw std::logic_error("Native Skia input component identity reused before retirement");identities.emplace(identity,InputIdentity{winrt::make_weak(view),get_weak()});inputIdentity=identity;
  }
  void unregisterInputIdentity(){if(inputIdentity){inputIdentities().erase(inputIdentity);inputIdentity=nullptr;}}
  WindowsMouseCursor cursor;
  winrt::weak_ref<winrt::Microsoft::ReactNative::ComponentView> cursorView;
  bool cursorQueued=false;
  void queueCursor(){if(cursorQueued)return;auto view=cursorView.get();if(!view)return;cursorQueued=true;const auto generation=mountGeneration;view.ReactContext().UIDispatcher().Post([weak=get_weak(),generation]{if(auto current=weak.get()){current->cursorQueued=false;if(current->mountGeneration!=generation){if(current->isMounted)current->queueCursor();return;}current->boundary([&]{if(current->isMounted&&current->state->hasCursorHover())current->cursor.apply();else current->cursor.release();});}});}
  std::shared_ptr<WindowsSkiaViewState> state;
  std::unique_ptr<std::shared_ptr<WindowsSkiaViewState>> retention;
  winrt::Microsoft::ReactNative::ComponentView::Destroying_revoker destroying;
  winrt::Microsoft::ReactNative::ComponentView::PointerWheelChanged_revoker wheel;
  winrt::Microsoft::ReactNative::ComponentView::PointerPressed_revoker pressed;
  winrt::Microsoft::ReactNative::ComponentView::PointerMoved_revoker moved;
  winrt::Microsoft::ReactNative::ComponentView::PointerReleased_revoker released;
  winrt::Microsoft::ReactNative::ComponentView::PointerExited_revoker exited;
  winrt::Microsoft::ReactNative::ComponentView::PointerCaptureLost_revoker captureLost;
  winrt::Microsoft::ReactNative::ComponentView::Mounted_revoker mounted;
  winrt::Microsoft::ReactNative::ComponentView::Unmounted_revoker unmounted;
  winrt::Microsoft::UI::Input::InputPointerSource islandSource{nullptr};
  winrt::Microsoft::UI::Input::InputPointerSource pointerOwnerSource{nullptr};
  winrt::event_token islandExited{};
  bool hasIslandExited=false;
  std::function<void()> unwatchWindowPointer;
  uint64_t mountGeneration=0;
  bool isMounted=false;
  winrt::Microsoft::ReactNative::ComponentView keyboardParent{nullptr};
  winrt::Microsoft::ReactNative::Composition::RootComponentView keyboardRoot{nullptr};
  winrt::Microsoft::ReactNative::ComponentView::KeyDown_revoker keyDown;
  winrt::Microsoft::ReactNative::ComponentView::KeyUp_revoker keyUp;
  winrt::Microsoft::ReactNative::ComponentView::CharacterReceived_revoker keyCharacter;
  winrt::Microsoft::ReactNative::ComponentView::GotFocus_revoker keyFocusGot;
  winrt::Microsoft::ReactNative::ComponentView::LostFocus_revoker keyFocusLost;
  winrt::Microsoft::UI::Input::InputFocusController focusController{nullptr};
  winrt::event_token controllerGot{},controllerLost{};
  bool hasControllerGot=false,hasControllerLost=false;
  void retireKeyboardParent(){
    if(focusController&&hasControllerGot)focusController.GotFocus(controllerGot);
    if(focusController&&hasControllerLost)focusController.LostFocus(controllerLost);
    hasControllerGot=false;hasControllerLost=false;focusController=nullptr;
    keyDown.revoke();keyUp.revoke();keyCharacter.revoke();keyFocusGot.revoke();keyFocusLost.revoke();
    keyboardParent=nullptr;keyboardRoot=nullptr;state->keyboardFocus(false);
  }
  bool ownsKeyboard() const{
    if(!keyboardParent||!keyboardRoot||!focusController||!focusController.HasFocus())return false;
    auto focused=keyboardRoot.GetFocusedComponent();if(!focused||(focused!=keyboardParent&&!state->ownsKeyboardProxy(focused.Tag())))return false;
    for(unsigned depth=0;focused&&depth<256;++depth,focused=focused.Parent())if(focused==keyboardParent)return true;return false;
  }
  bool ownsKeyboardSource(int64_t source) const{return ownsKeyboard()&&keyboardRoot.GetFocusedComponent().Tag()==source;}
  void refreshKeyboardFocus(){if(state)state->keyboardFocus(ownsKeyboard());}
  void refreshKeyboardFocusAfterTransfer(){if(!keyboardParent)return;keyboardParent.ReactContext().UIDispatcher().Post([weak=get_weak()]{if(auto current=weak.get())current->boundary([&]{current->refreshKeyboardFocus();});});}
  void attachKeyboardParent(winrt::Microsoft::ReactNative::ComponentView const& view,winrt::Microsoft::UI::Content::ContentIsland const& content){
    const auto parent=view.Parent();const auto root=view.as<winrt::Microsoft::ReactNative::Composition::ComponentView>().Root();
    if(!parent||!root)throw std::runtime_error("Windows keyboard port requires its canvas parent");
    const auto controller=winrt::Microsoft::UI::Input::InputFocusController::GetForIsland(content);
    if(parent!=keyboardParent||controller!=focusController){
      retireKeyboardParent();keyboardParent=parent;keyboardRoot=root;focusController=controller;
      keyDown=parent.KeyDown(winrt::auto_revoke,[weak=get_weak()](auto const&,auto const& args){if(auto current=weak.get())current->boundary([&]{if(current->ownsKeyboardSource(args.OriginalSource()))current->state->key(false,args,current->keyboardParent.ReactContext().UIDispatcher());});});
      keyUp=parent.KeyUp(winrt::auto_revoke,[weak=get_weak()](auto const&,auto const& args){if(auto current=weak.get())current->boundary([&]{if(current->ownsKeyboardSource(args.OriginalSource()))current->state->key(true,args,current->keyboardParent.ReactContext().UIDispatcher());});});
      keyCharacter=parent.CharacterReceived(winrt::auto_revoke,[weak=get_weak()](auto const&,auto const& args){if(auto current=weak.get())current->boundary([&]{if(current->ownsKeyboardSource(args.OriginalSource()))current->state->character(args);});});
      keyFocusGot=parent.GotFocus(winrt::auto_revoke,[weak=get_weak()](auto const&,auto const& args){if(auto current=weak.get())current->boundary([&]{current->refreshKeyboardFocus();});});
      keyFocusLost=parent.LostFocus(winrt::auto_revoke,[weak=get_weak()](auto const&,auto const& args){if(auto current=weak.get())current->boundary([&]{current->refreshKeyboardFocusAfterTransfer();});});
      // InputFocusController lifetime is explicit, just like the island pointer
      // source; do not assume a native input source supports weak revokers.
      controllerGot=focusController.GotFocus([weak=get_weak()](auto const&,auto const&){if(auto current=weak.get())current->boundary([&]{current->state->keyboardFocus(current->ownsKeyboard());});});hasControllerGot=true;
      controllerLost=focusController.LostFocus([weak=get_weak()](auto const&,auto const&){if(auto current=weak.get())current->boundary([&]{current->state->keyboardFocus(false);});});hasControllerLost=true;
    }
    state->keyboardFocus(ownsKeyboard());
  }
  void detachInputSource(bool preserveWindowPointer=false){
    cursor.detach();
    // InputPointerSource does not implement IWeakReferenceSource. Its
    // auto_revoke overload crashes while constructing the weak revoker.
    // Own the source until explicit token removal on the same UI owner.
    if(islandSource&&hasIslandExited)islandSource.PointerExited(islandExited);
    if(unwatchWindowPointer&&!preserveWindowPointer){auto stop=std::move(unwatchWindowPointer);unwatchWindowPointer={};stop();}
    hasIslandExited=false;islandSource=nullptr;
  }
  void mountInputSource(winrt::Microsoft::ReactNative::ComponentView const& view){
    isMounted=true;const auto generation=++mountGeneration;
    auto dispatcher=view.ReactContext().UIDispatcher();
    if(!dispatcher||!dispatcher.HasThreadAccess())throw std::runtime_error("Windows pointer port requires its UI dispatcher");
    // RNW RootComponentView::start raises Mounted from AddRenderedVisual,
    // then assigns ReactNativeIsland. Defer until that UI operation returns.
    dispatcher.Post([weak=get_weak(),weakView=winrt::make_weak(view),generation]{if(auto current=weak.get();current&&current->isMounted&&current->mountGeneration==generation){
      if(auto mountedView=weakView.get())current->boundary([&]{current->attachInputSource(mountedView);});
    }});
  }
  void retireInputSource(){isMounted=false;++mountGeneration;detachInputSource();retireKeyboardParent();state->leavePointers();pointerOwnerSource=nullptr;}
  void unmountInputSource(winrt::Microsoft::ReactNative::ComponentView const& view){
    isMounted=false;const auto generation=++mountGeneration;detachInputSource(true);
    auto dispatcher=view.ReactContext().UIDispatcher();
    if(!dispatcher||!dispatcher.HasThreadAccess())throw std::runtime_error("Windows pointer retirement requires its UI dispatcher");
    // Fabric removes and reinserts surviving ComponentViews within one mount
    // transaction. Unmounted is therefore not a final lifetime boundary.
    // Detach the island listener immediately, but cancel the press only when
    // this same view remains unmounted after the transaction has returned.
    dispatcher.Post([weak=get_weak(),generation]{if(auto current=weak.get();current&&!current->isMounted&&current->mountGeneration==generation){
      current->boundary([&]{current->detachInputSource();current->retireKeyboardParent();current->state->leavePointers();current->pointerOwnerSource=nullptr;});
    }});
  }
  void attachInputSource(winrt::Microsoft::ReactNative::ComponentView const& view){
    detachInputSource(true);const auto root=view.as<winrt::Microsoft::ReactNative::Composition::ComponentView>().Root();
    const auto island=root?root.ReactNativeIsland():nullptr;const auto content=island?island.Island():nullptr;
    if(!content)throw std::runtime_error("Windows pointer port requires its mounted ContentIsland");
    attachKeyboardParent(view,content);
    auto source=winrt::Microsoft::UI::Input::InputPointerSource::GetForIsland(content);
    if(!source)throw std::runtime_error("Windows owning island has no pointer source");
    // A surviving view may retain a press only on its original input owner.
    // Surface/layout replacement also cancels in WindowsSkiaViewState.
    if(pointerOwnerSource&&pointerOwnerSource!=source){detachInputSource();state->leavePointers();}
    pointerOwnerSource=source;islandSource=source;
    cursor.bind(source);queueCursor();
    // ComponentView.Exited follows RNW's JS hover path. A custom event emitter
    // can leave that path empty, so observe the owning island's real boundary.
    try{
      // Native root composition receives HWND input outside the island's
      // visual input tree. Its host owns the same untransformed viewport.
      if(state->ownsWindowViewport()){
        const auto input=state->windowPointer();if(!input)throw std::runtime_error("Window viewport requires its native pointer owner");
        cursor.bind(input->window());
        if(!unwatchWindowPointer)unwatchWindowPointer=input->listen([weak=get_weak()](std::string const& kind,WindowsWindowPointer::Point const& point){if(auto current=weak.get())current->boundary([&]{if(kind=="wheel")current->state->wheelPoint(point);else current->state->pointerPoint(kind,point);current->queueCursor();});});
      }else{
        islandExited=islandSource.PointerExited([weak=get_weak()](auto const&,auto const& args){if(auto current=weak.get())current->boundary([&]{if(auto point=args.CurrentPoint())current->state->leavePointer(point.PointerId());else current->state->leaveHoverPointers();current->queueCursor();});});hasIslandExited=true;
      }
      // Capture loss belongs to the capturing ComponentView. The island's
      // global event can describe a sibling editor losing capture while a new
      // canvas press is being admitted; it must not cancel this view's press.
    }catch(...){detachInputSource();throw;}
  }
  ~WindowsSkiaComponent(){unregisterInputIdentity();detachInputSource();mounted.revoke();unmounted.revoke();pressed.revoke();moved.revoke();released.revoke();exited.revoke();captureLost.revoke();wheel.revoke();destroying.revoke();if(state)try{state->closeUi();retention.reset();}catch(...){retention.release();}}
  template<class F> void boundary(F&& operation) noexcept {try{operation();}catch(const std::exception& error){if(state)state->fail(error.what());}catch(...){if(state)state->fail("Native Windows component HRESULT failure");}}
};
inline void RegisterWindowsSkiaView(winrt::Microsoft::ReactNative::IReactPackageBuilder const& package,WindowsSkiaViewOptions options={}) {
  using namespace winrt::Microsoft::ReactNative;
  package.as<IReactPackageBuilderFabric>().AddViewComponent(L"SkiaView",[options](IReactViewComponentBuilder const& builder){
    auto composition=builder.as<Composition::IReactCompositionViewComponentBuilder>();
    builder.SetCreateProps([](ViewProps const& props,IComponentProps const& previous){return winrt::make<WindowsSkiaProps>(props,previous);});
    composition.SetViewComponentViewInitializer([options](ComponentView const& view){
      auto shell=winrt::make_self<WindowsSkiaComponent>();shell->cursorView=winrt::make_weak(view);
      shell->state=std::make_shared<WindowsSkiaViewState>(view,options);shell->retention=std::make_unique<std::shared_ptr<WindowsSkiaViewState>>(shell->state);
      shell->destroying=view.Destroying(winrt::auto_revoke,[weak=shell->get_weak()](auto const&,auto const&){if(auto current=weak.get())current->boundary([&]{current->unregisterInputIdentity();current->retireInputSource();current->state->closeUi();current->retention.reset();});});
      shell->mounted=view.Mounted(winrt::auto_revoke,[weak=shell->get_weak()](auto const&,auto const& currentView){if(auto current=weak.get())current->boundary([&]{current->mountInputSource(currentView);});});
      shell->unmounted=view.Unmounted(winrt::auto_revoke,[weak=shell->get_weak()](auto const&,auto const& currentView){if(auto current=weak.get())current->boundary([&]{current->unmountInputSource(currentView);});});
      shell->wheel=view.PointerWheelChanged(winrt::auto_revoke,[weak=shell->get_weak()](auto const&,auto const& args){if(auto current=weak.get())current->boundary([&]{current->state->wheel(args);});});
      shell->pressed=view.PointerPressed(winrt::auto_revoke,[weak=shell->get_weak()](auto const&,auto const& args){if(auto current=weak.get())current->boundary([&]{current->state->pointer("down",args);current->queueCursor();});});
      shell->moved=view.PointerMoved(winrt::auto_revoke,[weak=shell->get_weak()](auto const&,auto const& args){if(auto current=weak.get())current->boundary([&]{current->state->pointer("move",args);current->queueCursor();});});
      shell->released=view.PointerReleased(winrt::auto_revoke,[weak=shell->get_weak()](auto const&,auto const& args){if(auto current=weak.get())current->boundary([&]{current->state->pointer("up",args);current->queueCursor();});});
      shell->exited=view.PointerExited(winrt::auto_revoke,[weak=shell->get_weak()](auto const&,auto const& args){if(auto current=weak.get())current->boundary([&]{current->state->pointer("leave",args);current->queueCursor();});});
      shell->captureLost=view.PointerCaptureLost(winrt::auto_revoke,[weak=shell->get_weak()](auto const&,auto const&){if(auto current=weak.get())current->boundary([&]{current->state->cancelPointers();});});
      view.UserData(*shell);
      shell->registerInputIdentity(view);
    });
    composition.SetCreateVisualHandler([](ComponentView const& view){return view.UserData().as<WindowsSkiaComponent>()->state->visual();});
    builder.SetUpdatePropsHandler([](ComponentView const& view,IComponentProps const& props,IComponentProps const&){auto shell=view.UserData().as<WindowsSkiaComponent>();shell->boundary([&]{auto value=props.as<WindowsSkiaProps>();shell->cursor.kind(value->mouseCursor);shell->state->props(*value);shell->queueCursor();});});
    builder.SetUpdateEventEmitterHandler([](ComponentView const& view,EventEmitter const& emitter){auto shell=view.UserData().as<WindowsSkiaComponent>();shell->boundary([&]{shell->state->emitter(emitter);});});
    composition.SetUpdateLayoutMetricsHandler([](ComponentView const& view,LayoutMetrics const& metrics,LayoutMetrics const&){auto shell=view.UserData().as<WindowsSkiaComponent>();shell->boundary([&]{shell->state->layout(metrics);});});
    composition.SetViewFeatures(Composition::ComponentViewFeatures::Default&~Composition::ComponentViewFeatures::Background);
  });
}
} // namespace RNSkia
