#import "SkiaView.h"
#import "MouseCursor.h"

#import <QuartzCore/CADisplayLink.h>
#import <QuartzCore/CATransaction.h>

#import <React/RCTConversions.h>
#import <React/RCTConvert.h>
#import <React/RCTFabricComponentsPlugins.h>

#import <react/renderer/components/rnskia/ComponentDescriptors.h>
#import <react/renderer/components/rnskia/EventEmitters.h>
#import <react/renderer/components/rnskia/Props.h>
#import <react/renderer/components/rnskia/RCTComponentViewHelpers.h>

#import <QuartzCore/CAMetalLayer.h>

#include <cmath>
#include <charconv>
#include <memory>
#include <vector>

#import "RNSkManager.h"
#import "RNSkView.h"
#import "RNDawnWindowSurface.h"
#import "RNSkiaModule.h"
#include "AppleSurfaceState.h"
#include "AppleViewLifetime.h"

using namespace facebook::react;

// Unconfirmed native work keeps its dependencies through process exit. Never
// detach/recycle a layer after a producer or retirement failure.
struct RetainedAppleSurface {
  std::shared_ptr<RNSkia::RNSkView> view;
  std::shared_ptr<RNSkia::RNDawnWindowSurface> surface;
  CAMetalLayer *__strong layer;
};
static void retainFailedAppleSurface(std::shared_ptr<RNSkia::RNSkView> view,
    std::shared_ptr<RNSkia::RNDawnWindowSurface> surface,CAMetalLayer *layer) {
  static auto *retained=new std::vector<RetainedAppleSurface>();
  retained->push_back({std::move(view),std::move(surface),layer});
}

// Whether rendering must be skipped: drawing while the app is in the
// background can clear the CAMetalLayer, leaving the canvas empty when the app
// comes back (https://github.com/Shopify/react-native-skia/issues/1257). The
// application state is main-thread only, so this is answered there only.
static bool appIsBackgrounded() {
#if !TARGET_OS_OSX
  auto state = UIApplication.sharedApplication.applicationState;
  return state == UIApplicationStateBackground;
#else
  return NSApplication.sharedApplication.isHidden;
#endif // !TARGET_OS_OSX
}

@interface SkiaView ()
- (void)startNativeView;
- (void)closeNativeView:(BOOL)recycle;
- (void)finishClosedNativeView;
- (void)updateNativeSurface;
- (void)refreshNativeVisibility;
- (void)emitAppleStatus:(const char *)phase reason:(const char *)reason;
- (void)failNativeView:(const char *)reason;
- (BOOL)canPresentNativeView;
- (BOOL)matchesViewGeneration:(uint64_t)generation;
- (void)scheduleFrameForGeneration:(uint64_t)generation;
- (BOOL)nativeVisibility;
- (void)observeNativeLifecycle;
- (void)stopObservingNativeLifecycle;
- (void)stopDisplayLink;
- (void)scheduleFrame;
@end

@implementation SkiaView {
  // The native view, the window surface and the layer it presents into. All
  // three exist while the view is in the hierarchy (see willMoveToSuperview:).
  std::shared_ptr<RNSkia::RNSkView> _view;
  std::shared_ptr<RNSkia::RNDawnWindowSurface> _surface;
#pragma clang diagnostic push
#pragma clang diagnostic ignored "-Wunguarded-availability-new"
  CAMetalLayer *_layer;
#pragma clang diagnostic pop
  // Owned by the module, which outlives its views (see finalizeUpdates:).
  std::weak_ptr<RNSkia::RNSkManager> _manager;
  RNSkia::AppleSurfaceState _appleState;
  NSMutableArray<id> *_lifecycleObservers;
  RNSkia::AppleViewLifetime _viewLifetime;
  bool _registryReady;
  bool _viewClosePending;
  bool _runtimeShutdown;
  bool _surfaceFormatDirty;
  bool _useP3ColorSpace;
  size_t _nativeId;
  bool _highBitDepth;
  NSString *_mouseCursorKind;
#if !TARGET_OS_OSX
  UIPointerInteraction *_mouseCursorInteraction;
  UIHoverGestureRecognizer *_mouseHover;
#else
  NSTrackingArea *_mouseTrackingArea;
#endif
#if !TARGET_OS_OSX
  CADisplayLink *_displayLink;
#endif
}

- (instancetype)initWithFrame:(CGRect)frame {
  if (self = [super initWithFrame:frame]) {
    _manager = [RNSkiaModule latestActiveSkManager];
    _nativeId = 0;
    _highBitDepth = false;
    _mouseCursorKind = @"basic";
#if !TARGET_OS_OSX
    if(@available(iOS 13.4,*)){_mouseCursorInteraction=[[UIPointerInteraction alloc] initWithDelegate:self];[self addInteraction:_mouseCursorInteraction];}
    if(@available(iOS 13.4,*)){_mouseHover=[[UIHoverGestureRecognizer alloc] initWithTarget:self action:@selector(observeMouseHover:)];_mouseHover.allowedTouchTypes=@[@(UITouchTypeIndirectPointer)];[self addGestureRecognizer:_mouseHover];}
#endif
    _surfaceFormatDirty = true;
    static const auto defaultProps = std::make_shared<const SkiaViewProps>();
    _props = defaultProps;
  }
  return self;
}

#pragma mark - Lifecycle

// The native view lives while the view is in the hierarchy: it is created
// when the view gets a superview and torn down when it leaves it, so that a
// view kept around by a transition does not keep a surface.
#if !TARGET_OS_OSX
- (void)willMoveToSuperview:(UIView *)newSuperView {
  [super willMoveToSuperview:newSuperView];
#else
- (void)viewWillMoveToSuperview:(NSView *)newSuperView {
  [super viewWillMoveToSuperview:newSuperView];
#endif // !TARGET_OS_OSX
  if(newSuperView!=nil)[self startNativeView];
}

- (void)removeFromSuperview {
  [self closeNativeView:NO];
  [super removeFromSuperview];
}

- (void)dealloc {
  [self closeNativeView:YES];
}

- (void)prepareForRecycle {
#if TARGET_OS_OSX
  if(_mouseTrackingArea){[self removeTrackingArea:_mouseTrackingArea];_mouseTrackingArea=nil;}
#endif
  [self setSystemMouseCursor:@"basic"];
  [self closeNativeView:YES];
  [super prepareForRecycle];
}

- (void)finalizeUpdates:(RNComponentViewUpdateMask)updateMask {
  [super finalizeUpdates:updateMask];
  if (updateMask == RNComponentViewUpdateMaskAll) {
    // this flag is only set when the view is inserted and we want to set the
    // manager here since the view could be recycled or the app could be
    // refreshed and we would have a stale manager then
    if(_view==nullptr)_manager = [RNSkiaModule latestActiveSkManager];
    [self startNativeView];
    [self updateNativeSurface];
    if(_registryReady && !_appleState.isClosed() && !_viewLifetime.failed())[self emitAppleStatus:_appleState.snapshot().bound?"bound":"detached" reason:""];
  }
}

#include "AppleSurfaceLifecycle.inc"

#pragma mark - Frames

// Presents on the display link: armed when a recording is submitted, paused
// again once the queue is empty. macOS has no CADisplayLink on the minimum
// deployment target, so frames are presented as soon as the main thread gets
// to them there.
- (void)scheduleFrame {
  [self refreshNativeVisibility];
  if(![self canPresentNativeView]){[self stopDisplayLink];return;}
#if !TARGET_OS_OSX
  if (_displayLink == nil) {
    _displayLink = [CADisplayLink displayLinkWithTarget:self
                                               selector:@selector(onFrame:)];
    [_displayLink addToRunLoop:[NSRunLoop mainRunLoop]
                       forMode:NSRunLoopCommonModes];
  }
  _displayLink.paused = NO;
#else
  if (_view != nullptr) {
    try{_view->presentFrame();}catch(const std::exception& error){[self failNativeView:error.what()];}
  }
#endif
}

#if !TARGET_OS_OSX
- (void)onFrame:(CADisplayLink *)link {
  if(link!=_displayLink)return;
  [self refreshNativeVisibility];
  if (_view == nullptr || ![self canPresentNativeView]) {
    link.paused = YES;
    return;
  }
  try{if(!_view->presentFrame())link.paused=YES;}
  catch(const std::exception& error){link.paused=YES;[self failNativeView:error.what()];}
}
#endif

- (void)stopDisplayLink {
#if !TARGET_OS_OSX
  [_displayLink invalidate];
  _displayLink = nil;
#endif
}

#pragma mark - Render

- (void)drawRect:(CGRect)rect {
  // The OS asked for a draw: present what the view holds right away.
  if (_view != nullptr && [self canPresentNativeView])try{_view->redraw();}catch(const std::exception& error){[self failNativeView:error.what()];}
}

#pragma mark - Layout

- (void)layoutSubviews {
  [super layoutSubviews];
  [self startNativeView];
  [self updateNativeSurface];
}

#if TARGET_OS_OSX
- (void)viewDidChangeBackingProperties {
  [super viewDidChangeBackingProperties];
  // A move between displays need not change logical bounds.
  [self layoutSubviews];
}
#endif

#pragma mark - Props

+ (ComponentDescriptorProvider)componentDescriptorProvider {
  return concreteComponentDescriptorProvider<SkiaViewComponentDescriptor>();
}

- (void)updateProps:(const Props::Shared &)props
           oldProps:(const Props::Shared &)oldProps {
  const auto &newProps = *std::static_pointer_cast<const SkiaViewProps>(props);
  [super updateProps:props oldProps:oldProps];
  size_t nativeId=0;const auto& text=newProps.nativeId;
  auto result=std::from_chars(text.data(),text.data()+text.size(),nativeId);
  if(result.ec!=std::errc{} || result.ptr!=text.data()+text.size() || nativeId==0 || nativeId>9007199254740991ULL){[self failNativeView:"Invalid Apple native view ID"];return;}
  [self bindNativeId:nativeId];
  [self setHighBitDepth:newProps.highBitDepth];
  [self setSystemMouseCursor:[NSString stringWithUTF8String:newProps.mouseCursor.c_str()]];
  // opaque, androidSurfaceType and androidZOrderOnTop select the backing view
  // on Android; a CAMetalLayer composites like any other layer.
}

// Not setNativeId:, which is the setter of RCTViewComponentView's nativeId
// (the string Fabric assigns from the nativeID prop).
- (void)bindNativeId:(size_t)nativeId {
  if(_viewLifetime.failed())return;
  if(_viewClosePending){_nativeId=nativeId;return;} // Fresh props wait for the old native owner ACK.
  if(_viewLifetime.closing() && !_viewLifetime.drainConfirmed()){[self failNativeView:"Apple native ID rebinding before confirmed runtime drain"];return;}
  if(_nativeId && _nativeId!=nativeId && _view!=nullptr){[self closeNativeView:NO];}
  if(_viewLifetime.failed())return;
  _nativeId = nativeId;
  if(self.superview!=nil)[self startNativeView];
}

// Hover observation carries this actual native View identity; it is not a
// fabricated binary PointerData stream or native mouse-button producer.
- (void)emitNativeMouse:(const char*)kind x:(double)x y:(double)y time:(double)time {
  if(!_eventEmitter||!_nativeId||_runtimeShutdown||_viewLifetime.closing()||_viewLifetime.failed())return;
  SkiaViewEventEmitter::OnNativeMouseEvent event;event.protocol=1;event.nativeId=_nativeId;event.kind=kind;event.device="mouse";event.pointer=1;event.buttons=0;event.x=x;event.y=y;event.timestamp=time;
  std::static_pointer_cast<const SkiaViewEventEmitter>(_eventEmitter)->onNativeMouseEvent(event);
}
#if TARGET_OS_OSX
- (void)updateTrackingAreas {
  [super updateTrackingAreas];if(_mouseTrackingArea){[self removeTrackingArea:_mouseTrackingArea];_mouseTrackingArea=nil;}
  if(!_runtimeShutdown&&!_viewLifetime.closing()){
    _mouseTrackingArea=[[NSTrackingArea alloc] initWithRect:self.bounds options:NSTrackingMouseMoved|NSTrackingMouseEnteredAndExited|NSTrackingActiveInKeyWindow|NSTrackingInVisibleRect|NSTrackingEnabledDuringMouseDrag owner:self userInfo:nil];[self addTrackingArea:_mouseTrackingArea];
  }
}
- (void)mouseMoved:(NSEvent*)event {NSPoint point=[self convertPoint:event.locationInWindow fromView:nil];[self emitNativeMouse:"hover" x:point.x y:point.y time:event.timestamp*1000];[super mouseMoved:event];}
- (void)mouseEntered:(NSEvent*)event {NSPoint point=[self convertPoint:event.locationInWindow fromView:nil];[self emitNativeMouse:"hover" x:point.x y:point.y time:event.timestamp*1000];[super mouseEntered:event];}
- (void)mouseExited:(NSEvent*)event {NSPoint point=[self convertPoint:event.locationInWindow fromView:nil];[self emitNativeMouse:"leave" x:point.x y:point.y time:event.timestamp*1000];[super mouseExited:event];}
#else
- (void)observeMouseHover:(UIHoverGestureRecognizer*)recognizer API_AVAILABLE(ios(13.4)) {
  const bool inside=recognizer.state==UIGestureRecognizerStateBegan||recognizer.state==UIGestureRecognizerStateChanged;
  if(!inside&&recognizer.state!=UIGestureRecognizerStateEnded&&recognizer.state!=UIGestureRecognizerStateCancelled)return;
  CGPoint point=[recognizer locationInView:self];[self emitNativeMouse:inside?"hover":"leave" x:point.x y:point.y time:CACurrentMediaTime()*1000];
}
#endif

// Native cursor state belongs to this Fabric view and is reset on recycle.
- (void)setSystemMouseCursor:(NSString*)kind {
  NSString *next=kind.length?kind:@"basic";if([_mouseCursorKind isEqualToString:next])return;_mouseCursorKind=[next copy];
#if TARGET_OS_OSX
  [self.window invalidateCursorRectsForView:self];
#else
  if(@available(iOS 13.4,*))[_mouseCursorInteraction invalidate];
#endif
}
#if TARGET_OS_OSX
- (void)resetCursorRects {
  [super resetCursorRects];
  if(!_runtimeShutdown&&!_viewLifetime.closing())[self addCursorRect:self.bounds cursor:NelyxSystemMouseCursor(_mouseCursorKind)];
}
#else
- (UIPointerRegion*)pointerInteraction:(UIPointerInteraction*)interaction regionForRequest:(UIPointerRegionRequest*)request defaultRegion:(UIPointerRegion*)defaultRegion API_AVAILABLE(ios(13.4)) {
  return !_runtimeShutdown&&!_viewLifetime.closing()&&CGRectContainsPoint(self.bounds,request.location)?defaultRegion:nil;
}
- (UIPointerStyle*)pointerInteraction:(UIPointerInteraction*)interaction styleForRegion:(UIPointerRegion*)region API_AVAILABLE(ios(13.4)) {
  if(_runtimeShutdown||_viewLifetime.closing())return nil;
  if([_mouseCursorKind isEqualToString:@"none"]){if(@available(iOS 14.0,*))return [UIPointerStyle hiddenPointerStyle];return nil;}
  UIPointerShape *shape=nil;
  if([_mouseCursorKind isEqualToString:@"text"]||[_mouseCursorKind isEqualToString:@"verticalText"])shape=[UIPointerShape beamWithPreferredLength:24 axis:[_mouseCursorKind isEqualToString:@"text"]?UIAxisVertical:UIAxisHorizontal];
  else if([_mouseCursorKind isEqualToString:@"precise"])shape=[UIPointerShape shapeWithRoundedRect:CGRectMake(-2,-2,4,4) cornerRadius:0];
  // UIKit supplies its system pointer for the other desktop cursor kinds.
  return shape?[UIPointerStyle styleWithShape:shape constrainedAxes:UIAxisNeither]:nil;
}
#endif

- (void)setHighBitDepth:(bool)highBitDepth {
  if (_highBitDepth == highBitDepth) {
    return;
  }
  _highBitDepth = highBitDepth;
  _surfaceFormatDirty = true;
  if (_surface != nullptr && _surface->isAttached()) {
    [self updateNativeSurface];
  }
}

@end

Class<RCTComponentViewProtocol> SkiaViewCls(void) { return SkiaView.class; }
