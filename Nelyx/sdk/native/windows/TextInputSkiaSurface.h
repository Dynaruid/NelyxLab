// SPDX-License-Identifier: BSD-3-Clause
#pragma once
#include "TextInputModule.h"
#include <SkiaView.h>
#include <array>
#include <winrt/Microsoft.UI.Input.h>

namespace Nelyx::WindowsInput {
// A valid surface mapping in ContentIsland logical coordinates. Keeping this
// projection independent of the owner admission makes native clipping and OS
// rounding use the same path for screen bounds and screen-point hits.
struct TextInputSurfaceProjection {
  double x=0,y=0;Rect clip;bool visible=false,hidden=false;
  static Rect intersect(Rect a,Rect b){const auto x=std::max(a.x,b.x),y=std::max(a.y,b.y);return {x,y,std::max(0.,std::min(a.x+a.width,b.x+b.width)-x),std::max(0.,std::min(a.y+a.height,b.y+b.height)-y)};}
  ScreenRect screenRect(winrt::Microsoft::UI::Content::ContentCoordinateConverter const& converter,Rect const& rect,CoreGeometry const& frame)const{
    if(!visible)return {RECT{},true};
    const Rect translated{rect.x+x,rect.y+y,rect.width,rect.height},coreClip{frame.clip.x+x,frame.clip.y+y,frame.clip.width,frame.clip.height};const auto visibleClip=intersect(coreClip,clip),clipped=intersect(translated,visibleClip);
    const bool caret=rect.width==0&&translated.x>=visibleClip.x&&translated.x<visibleClip.x+visibleClip.width;
    if(clipped.height<=0||(clipped.width<=0&&!caret))return {RECT{},true};
    const auto left=float(clipped.x),top=float(clipped.y),right=float(clipped.x+clipped.width),bottom=float(clipped.y+clipped.height);
    const std::array<winrt::Windows::Foundation::Point,4> corners{{{left,top},{right,top},{left,bottom},{right,bottom}}};
    using Mode=winrt::Microsoft::UI::Content::ContentCoordinateRoundingMode;
    const auto lower=converter.ConvertLocalToScreen(corners,Mode::Floor),upper=converter.ConvertLocalToScreen(corners,Mode::Ceiling);
    auto x=lower[0].X,y=lower[0].Y,r=upper[0].X,b=upper[0].Y;for(size_t i=1;i<corners.size();++i){x=std::min(x,lower[i].X);y=std::min(y,lower[i].Y);r=std::max(r,upper[i].X);b=std::max(b,upper[i].Y);}
    const bool cut=translated.x<visibleClip.x||translated.y<visibleClip.y||translated.x+translated.width>visibleClip.x+visibleClip.width||translated.y+translated.height>visibleClip.y+visibleClip.height;
    return {RECT{x,y,r,b},cut};
  }
  ViewPoint viewPoint(winrt::Microsoft::UI::Content::ContentCoordinateConverter const& converter,POINT point,DWORD flags,CoreGeometry const& frame)const{
    const auto local=converter.ConvertScreenToLocal(winrt::Windows::Graphics::PointInt32{point.x,point.y});
    const auto visibleClip=intersect(clip,{frame.clip.x+x,frame.clip.y+y,frame.clip.width,frame.clip.height});
    const bool outside=!visible||visibleClip.width<=0||visibleClip.height<=0||(!(flags&GXFPF_NEAREST)&&(local.X<visibleClip.x||local.Y<visibleClip.y||local.X>=visibleClip.x+visibleClip.width||local.Y>=visibleClip.y+visibleClip.height));
    return {local.X-x,local.Y-y,outside};
  }
};
/** Maps a real Skia backing through SDK-owned static RNW containers. Those
 * containers expose no animated ref or transform props. An unmarked external
 * native parent is unsupported; visual getters cannot prove that an expression
 * animation is absent. Core's own paragraph transforms are already in its boxes. */
class TextInputSkiaSurface final : public std::enable_shared_from_this<TextInputSkiaSurface> {
  using Component=RN::ComponentView;
  using View=RN::Composition::ViewComponentView;
  using Projection=TextInputSurfaceProjection;
  struct Watch {
    Component::LayoutMetricsChanged_revoker layout;
    Component::Mounted_revoker mounted;
    Component::Unmounted_revoker unmounted;
  };
public:
  ~TextInputSkiaSurface(){if(unobserve_)unobserve_();}
  static TextInputProtocolCallbacks resolve(std::shared_ptr<TextInputRoot> const& root,RN::IReactContext const& context,uint64_t tag,Owner const& owner){
    if(!root||tag>static_cast<uint64_t>(INT32_MAX)||!tag)throw std::invalid_argument("A real Windows Skia surface tag is required");
    auto view=RN::Composition::CompositionUIService::ComponentFromReactTag(context,static_cast<int64_t>(tag));
    const auto native=identify(view);auto shell=native.get();
    const auto identity=winrt::to_hstring("nelyx:input-skia:v1:"+std::to_string(owner.generation)+":"+owner.id);
    if(!shell||!shell->state||view.ReactContext()!=context||!view.try_as<View>()||view.as<View>().ViewProps().TestId()!=identity)throw std::invalid_argument("Input requires its SDK-owned Skia component and Core owner");
    const auto status=shell->state->inputSurface();if(!status||!status->bound||!status->nativeId||!status->viewGeneration)throw std::invalid_argument("Input requires a bound native Skia view");
    auto self=std::shared_ptr<TextInputSkiaSurface>(new TextInputSkiaSurface(root,view,shell->state,*status,identity));
    // Validate the static envelope independently of a transient resize epoch.
    // Coordinate queries remain strict until actual and admitted layouts agree.
    if(!self->projection(nullptr,false))throw std::invalid_argument("Unsupported Windows input envelope: use static SDK NativeLayer containers; native transforms, ScrollView and custom clips require a dedicated screen mapper");
    // Many semantics peers resolve this same surface. The canvas owns one
    // input viewport; coordinate-reader leases must never register competitors.
    if(!shell->state->precisionTrackpad())try{
      auto precision=RNSkia::WindowsPrecisionTrackpad::create(root->window(),[current=self](POINT point)->std::optional<RNSkia::WindowsPrecisionPoint>{
        const auto projection=current->projection(nullptr);const auto root=current->root_.lock();const auto state=current->state_.lock();
        if(!projection||!projection->visible||!root||!state)return std::nullopt;
        const auto local=root->island().CoordinateConverter().ConvertScreenToLocal(winrt::Windows::Graphics::PointInt32{point.x,point.y});
        const auto& clip=projection->clip;if(local.X<clip.x||local.Y<clip.y||local.X>=clip.x+clip.width||local.Y>=clip.y+clip.height)return std::nullopt;
        const auto status=state->inputSurface();if(!status)return std::nullopt;
        return RNSkia::WindowsPrecisionPoint{local.X-projection->x,local.Y-projection->y,status->scale,status->surfaceGeneration};
      },[weak=std::weak_ptr<RNSkia::WindowsSkiaViewState>(shell->state)](auto const& event){if(auto state=weak.lock())state->precision(event);});
      // The viewport retains its mapper; the mapper refers weakly to the canvas.
      // Releasing the first semantics/service lease cannot strand its mapping.
      shell->state->setPrecisionTrackpad(precision);
    }catch(...){shell->state->setPrecisionTrackpad({});} // Explicit capability fallback; native wheel remains active.
    TextInputProtocolCallbacks result;
    result.active=[self]{return self->live();};
    result.visible=[self]{const auto map=self->projection(nullptr,false);return map&&map->visible;};
    result.screenRect=[self](Rect const& rect,CoreGeometry const& frame)->std::optional<ScreenRect>{return self->screenRect(rect,frame);};
    result.viewPoint=[self](POINT point,DWORD flags,CoreGeometry const& frame)->std::optional<ViewPoint>{return self->viewPoint(point,flags,frame);};
    result.focusSurface=[self]{return self->focusSurface(false);};
    result.focusCanvas=[self]{return self->focusSurface(true);};
    result.registerFocusProxy=[self](int64_t tag){const auto state=self->state_.lock();if(!self->live()||!state)throw std::runtime_error("Core focus proxy surface retired");return state->registerKeyboardProxy(tag);};
    result.watchRetirement=[self](std::function<void(std::string const&)> retired){return self->watch(std::move(retired));};return result;
  }
private:
  bool focusSurface(bool canvas){
    const auto view=view_.get();const auto root=root_.lock();const auto map=projection(nullptr,false);if(!root||!view||!map||!map->visible)return false;
    const auto parent=view.Parent();const auto nativeRoot=inputComponentRoot(view);if(!parent||!nativeRoot)return false;
    auto focused=nativeRoot.GetFocusedComponent();const auto state=state_.lock();bool owned=false;
    if(focused&&(focused==parent||(state&&state->ownsKeyboardProxy(focused.Tag()))))for(unsigned depth=0;focused&&depth<256;++depth,focused=focused.Parent())if(focused==parent){owned=true;break;}
    if((canvas||!owned)&&!parent.TryFocus(RN::FocusState::Programmatic))return false;
    return winrt::Microsoft::UI::Input::InputFocusController::GetForIsland(root->island()).TrySetFocus();
  }
  TextInputSkiaSurface(std::shared_ptr<TextInputRoot> const& root,Component const& view,std::shared_ptr<RNSkia::WindowsSkiaViewState> const& state,RNSkia::WindowsSurfaceStatus const& status,winrt::hstring identity):root_(root),view_(winrt::make_weak(view)),state_(state),nativeId_(status.nativeId),generation_(status.viewGeneration),identity_(std::move(identity)){}
  static Rect intersect(Rect a,Rect b){return Projection::intersect(a,b);}
  static winrt::com_ptr<RNSkia::WindowsSkiaComponent> identify(Component const& view){return RNSkia::WindowsSkiaComponent::findInputComponent(view);}
  bool live()const{const auto state=state_.lock();const auto status=state?state->inputSurface():std::nullopt;const auto native=identify(view_.get());return !retired_&&native&&native->state==state&&status&&status->nativeId==nativeId_&&status->viewGeneration==generation_;}
  std::optional<Projection> projection(CoreGeometry const* frame,bool geometry=true)const{
    if(!live())return std::nullopt;const auto root=root_.lock();auto view=view_.get();const auto state=state_.lock();const auto status=state->inputSurface();
    const auto nativeRoot=inputComponentRoot(view);
    if(!root||!nativeRoot||!nativeRoot.ReactNativeIsland()||nativeRoot.ReactNativeIsland().Island()!=root->island()||view.as<View>().ViewProps().TestId()!=identity_)return std::nullopt;
    if(geometry&&status->layoutRevision!=status->surfaceGeneration)return std::nullopt;
    if(frame&&(!status->bound||!frame->surface||frame->surface!=status->surfaceGeneration))return std::nullopt;
    const auto leaf=view.LayoutMetrics(),top=nativeRoot.LayoutMetrics();if(geometry&&(root->island().RasterizationScale()!=status->scale||leaf.PointScaleFactor!=status->scale||top.PointScaleFactor!=status->scale||leaf.Frame.Width!=status->logicalWidth||leaf.Frame.Height!=status->logicalHeight))return std::nullopt;
    std::vector<Component> chain;auto parent=view.Parent();
    while(parent&&parent!=nativeRoot){if(chain.size()>=32||!parent.try_as<View>())return std::nullopt;const auto marker=parent.as<View>().ViewProps().TestId();if(marker!=L"nelyx:input-envelope:v1:clip"&&marker!=L"nelyx:input-envelope:v1:visible"&&marker!=L"nelyx:input-envelope:v1:hidden")return std::nullopt;chain.push_back(parent);parent=parent.Parent();}
    if(!parent)return std::nullopt;
    Projection result;result.clip={0,0,top.Frame.Width,top.Frame.Height};
    for(auto current=chain.rbegin();current!=chain.rend();++current){const auto metrics=current->LayoutMetrics();if(geometry&&metrics.PointScaleFactor!=status->scale)return std::nullopt;result.x+=metrics.Frame.X;result.y+=metrics.Frame.Y;const auto marker=current->as<View>().ViewProps().TestId();if(marker==L"nelyx:input-envelope:v1:clip")result.clip=intersect(result.clip,{result.x,result.y,metrics.Frame.Width,metrics.Frame.Height});else if(marker==L"nelyx:input-envelope:v1:hidden")result.hidden=true;}
    result.x+=leaf.Frame.X;result.y+=leaf.Frame.Y;result.clip=intersect(result.clip,{result.x,result.y,status->logicalWidth,status->logicalHeight});
    const auto native=identify(view);const auto shell=native.get();const auto window=GetAncestor(root->window(),GA_ROOT);
    if(!shell)return std::nullopt;result.hidden=result.hidden||!status->visible||!shell->isMounted||!IsWindowVisible(window)||IsIconic(window);result.visible=status->bound&&!result.hidden;
    if(!std::isfinite(result.x)||!std::isfinite(result.y)||!std::isfinite(result.clip.width)||!std::isfinite(result.clip.height))return std::nullopt;return result;
  }
  std::optional<ScreenRect> screenRect(Rect const& rect,CoreGeometry const& frame)const{
    const auto map=projection(&frame);if(!map){const auto unavailable=projection(nullptr,false);if(unavailable&&unavailable->hidden)return ScreenRect{RECT{},true};return std::nullopt;}return map->screenRect(root_.lock()->island().CoordinateConverter(),rect,frame);
  }
  std::optional<ViewPoint> viewPoint(POINT point,DWORD flags,CoreGeometry const& frame)const{
    const auto map=projection(&frame);if(!map){const auto unavailable=projection(nullptr,false);if(unavailable&&unavailable->hidden)return ViewPoint{0,0,true};return std::nullopt;}return map->viewPoint(root_.lock()->island().CoordinateConverter(),point,flags,frame);
  }
  void changed(){
    if(retired_)return;if(!live()){retired_=true;auto notify=retirement_;if(notify)notify("Windows Skia input surface retired or changed native owner");return;}
    if(auto root=root_.lock())root->screenCoordinatesChanged();if(queued_)return;auto view=view_.get();if(!view)return;queued_=true;
    // Fabric temporarily unparents surviving views within a mount transaction.
    // Coordinates are unavailable during it; retire only an unsupported final
    // parent chain, after the UI transaction has returned.
    view.ReactContext().UIDispatcher().Post([weak=weak_from_this()]{if(auto current=weak.lock()){
      current->queued_=false;if(current->retired_)return;auto view=current->view_.get();const auto native=identify(view);const auto shell=native.get();
      if(shell&&!shell->isMounted)return;
      if(!current->projection(nullptr,false)){current->retired_=true;auto notify=current->retirement_;if(notify)notify("Windows Skia input surface entered an unsupported native envelope");return;}current->refreshWatches();
    }});
  }
  void refreshWatches(){
    std::vector<Watch> next;for(auto view=view_.get();view;view=view.Parent()){
      Watch watch;const auto weak=weak_from_this();
      watch.layout=view.LayoutMetricsChanged(winrt::auto_revoke,[weak](auto const&,auto const&){if(auto current=weak.lock())current->changed();});
      watch.mounted=view.Mounted(winrt::auto_revoke,[weak](auto const&,auto const&){if(auto current=weak.lock())current->changed();});
      watch.unmounted=view.Unmounted(winrt::auto_revoke,[weak](auto const&,auto const&){if(auto current=weak.lock())if(auto root=current->root_.lock())root->screenCoordinatesChanged();});next.push_back(std::move(watch));
    }watches_=std::move(next);
  }
  std::function<void()> watch(std::function<void(std::string const&)> retired){
    if(retirement_||!retired)throw std::logic_error("Input surface already has its native service lease");retirement_=std::move(retired);const auto weak=weak_from_this();
    auto view=view_.get();destroying_=view.Destroying(winrt::auto_revoke,[weak](auto const&,auto const&){if(auto current=weak.lock()){current->retired_=true;auto notify=current->retirement_;if(notify)notify("Windows Skia input component destroyed");}});
    unobserve_=state_.lock()->observeInputSurface([weak]{if(auto current=weak.lock())current->changed();});refreshWatches();
    return [self=shared_from_this()]{self->watches_.clear();self->destroying_.revoke();if(self->unobserve_){self->unobserve_();self->unobserve_={};}self->retirement_={};};
  }
  std::weak_ptr<TextInputRoot> root_;winrt::weak_ref<Component> view_;std::weak_ptr<RNSkia::WindowsSkiaViewState> state_;uint64_t const nativeId_,generation_;winrt::hstring const identity_;
  bool retired_=false,queued_=false;std::function<void(std::string const&)> retirement_;std::function<void()> unobserve_;Component::Destroying_revoker destroying_;std::vector<Watch> watches_;
};
inline void installSkiaTextInputSurfaces(RN::ReactInstanceSettings const& settings,std::shared_ptr<TextInputRoot> const& root){
  RN::ReactPropertyBag(settings.Properties()).Set(TextInputSurfaceResolverProperty(),TextInputSurfaceResolver{[weak=std::weak_ptr<TextInputRoot>(root)](RN::IReactContext const& context,uint64_t tag,Owner const& owner){return TextInputSkiaSurface::resolve(weak.lock(),context,tag,owner);}});
}
}
