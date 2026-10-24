// SPDX-License-Identifier: BSD-3-Clause
// Methods of the real Fabric SkiaView. UIKit/AppKit, layer and Dawn surface
// operations stay on the main owner; emitted payloads contain metadata only.
- (BOOL)nativeVisibility {
  if(self.window==nil || appIsBackgrounded())return NO;
#if TARGET_OS_OSX
  return self.window.isVisible && !self.window.isMiniaturized &&
    (self.window.occlusionState & NSWindowOcclusionStateVisible)!=0 && !self.isHiddenOrHasHiddenAncestor;
#else
  if(self.window.hidden || self.window.windowScene.activationState!=UISceneActivationStateForegroundActive)return NO;
  for(UIView *ancestor=self;ancestor!=nil;ancestor=ancestor.superview)if(ancestor.hidden || ancestor.alpha<=0.0)return NO;
  return YES;
#endif
}

- (BOOL)canPresentNativeView {
  if(![NSThread isMainThread] || !_registryReady || _viewLifetime.closing() || _viewLifetime.failed() || _appleState.isClosed() || !_surface || !_surface->isAttached())return NO;
  auto manager=_manager.lock();
  return manager && manager==[RNSkiaModule latestActiveSkManager] && [RNSkiaModule acceptsNativeViewForManager:manager] && [self nativeVisibility];
}

- (BOOL)matchesViewGeneration:(uint64_t)generation {
  return !_viewLifetime.failed() && !_appleState.isClosed() && _appleState.snapshot().viewGeneration==generation;
}
- (void)scheduleFrameForGeneration:(uint64_t)generation {
  if([self matchesViewGeneration:generation])[self scheduleFrame];
}

- (void)observeNativeLifecycle {
  if(_lifecycleObservers!=nil)return;
  _lifecycleObservers=[NSMutableArray new];
#if TARGET_OS_OSX
  NSArray<NSString *> *names=@[NSWindowDidChangeOcclusionStateNotification,NSWindowDidMiniaturizeNotification,NSWindowDidDeminiaturizeNotification,NSApplicationDidHideNotification,NSApplicationDidUnhideNotification];
#else
  NSArray<NSString *> *names=@[UIApplicationDidEnterBackgroundNotification,UIApplicationWillEnterForegroundNotification,UIApplicationDidBecomeActiveNotification,UIApplicationWillResignActiveNotification];
#endif
  __weak SkiaView *weakSelf=self;
  const auto generation=_appleState.snapshot().viewGeneration;
  for(NSString *name in names){
    id observer=[[NSNotificationCenter defaultCenter] addObserverForName:name object:nil queue:[NSOperationQueue mainQueue] usingBlock:^(__unused NSNotification *notification){if([weakSelf matchesViewGeneration:generation])[weakSelf updateNativeSurface];}];
    [_lifecycleObservers addObject:observer];
  }
}

- (void)stopObservingNativeLifecycle {
  for(id observer in _lifecycleObservers)[[NSNotificationCenter defaultCenter] removeObserver:observer];
  _lifecycleObservers=nil;
}

- (void)startNativeView {
  NSCAssert([NSThread isMainThread],@"Apple Fabric surface requires main owner");
  if(_viewLifetime.failed()){[self emitAppleStatus:"failed" reason:"Previous Apple surface drain is unconfirmed; runtime restart required"];return;}
  if(_viewLifetime.closing() || _view || !_nativeId || self.superview==nil)return;
  auto manager=_manager.lock();
  auto published=[RNSkiaModule latestActiveSkManager];
  if(_appleState.isClosed() && manager!=published){_manager=published;manager=std::move(published);}
  if(!manager || manager!=[RNSkiaModule latestActiveSkManager]){[self failNativeView:"Apple native runtime owner is unavailable"];return;}
  if(![RNSkiaModule acceptsNativeViewForManager:manager]){[self failNativeView:"Apple native runtime view admission is closed"];return;}
  try{
    if(![RNSkiaModule registerNativeView:self manager:manager])throw std::runtime_error("Apple native view admission budget exceeded");
    _appleState.begin(_nativeId);
    _registryReady=false;
    _layer=[CAMetalLayer layer];
    _surface=std::make_shared<RNSkia::RNDawnWindowSurface>();
    __weak SkiaView *weakSelf=self;
    const auto generation=_appleState.snapshot().viewGeneration;
    _surface->setCanPresent([weakSelf,generation](){return [weakSelf matchesViewGeneration:generation] && [weakSelf canPresentNativeView];});
    _view=std::make_shared<RNSkia::RNSkView>(manager->getPlatformContext(),_surface);
#if TARGET_OS_OSX
    self.wantsLayer=YES;
#endif
    [self.layer addSublayer:_layer];
    _view->setFrameScheduler([weakSelf,generation](){[weakSelf scheduleFrameForGeneration:generation];});
    _surfaceFormatDirty=true;
    [self observeNativeLifecycle];
    const auto nativeId=_nativeId;auto view=_view;
    if(![RNSkiaModule enqueueViewRegistry:[manager,view,nativeId](){manager->registerSkiaView(nativeId,view);}
        ready:[weakSelf,view,generation,manager](){
          SkiaView *owner=weakSelf;
          if(!owner || owner->_view!=view || ![owner matchesViewGeneration:generation] || owner->_viewLifetime.closing() || ![RNSkiaModule acceptsNativeViewForManager:manager])return;
          owner->_registryReady=true;[owner updateNativeSurface];
        } manager:manager])throw std::runtime_error("Apple JS registry admission unavailable");
  }catch(const std::exception& error){[self failNativeView:error.what()];}
}

- (void)emitAppleStatus:(const char *)phase reason:(const char *)reason {
  if(!_eventEmitter)return;
  const auto value=_appleState.snapshot();
  if(!value.nativeId || value.nativeId!=_nativeId)return; // Recycled props must not receive the old owner's events.
  SkiaViewEventEmitter::OnAppleSurfaceStatus event;
  event.phase=phase;event.reason=reason;event.nativeId=static_cast<double>(value.nativeId);
  event.viewGeneration=static_cast<double>(value.viewGeneration);event.surfaceGeneration=static_cast<double>(value.surfaceGeneration);
  event.logicalWidth=value.logicalWidth;event.logicalHeight=value.logicalHeight;event.width=value.width;event.height=value.height;event.scale=value.scale;event.bound=value.bound;event.visible=value.visible;
  std::static_pointer_cast<const SkiaViewEventEmitter>(_eventEmitter)->onAppleSurfaceStatus(event);
}

- (void)failNativeView:(const char *)reason {
  [self stopDisplayLink];[self stopObservingNativeLifecycle];
  if(_view)_view->setFrameScheduler(nullptr);
  if(_surface)_surface->setCanPresent([](){return false;});
  _viewLifetime.fail();_appleState.close();
  [self emitAppleStatus:"failed" reason:reason];
  if(auto manager=_manager.lock())[RNSkiaModule failNativeViewForManager:manager];
}

- (void)closeNativeView:(BOOL)recycle {
  NSCAssert([NSThread isMainThread],@"Apple native view close requires main owner");
  auto manager=_manager.lock();const auto nativeId=_nativeId;
  if(recycle){_viewLifetime.requestRecycle();_nativeId=0;_manager.reset();_highBitDepth=false;_surfaceFormatDirty=true;}
  [self stopDisplayLink];[self stopObservingNativeLifecycle];
  if(_viewLifetime.failed()){
    if(_view || _surface || _layer)retainFailedAppleSurface(_view,_surface,_layer);
    _view.reset();_surface.reset();_layer=nil;return;
  }
  if(_viewClosePending || (_viewLifetime.closing() && !_viewLifetime.drainConfirmed()))return;
  if(_viewLifetime.drainConfirmed() || !_view){[self finishClosedNativeView];return;}
  if(!manager || manager!=[RNSkiaModule latestActiveSkManager]){
    [self failNativeView:"Apple runtime invalidated before surface retirement"];[self closeNativeView:recycle];return;
  }
  _viewLifetime.beginShutdown();_viewClosePending=true;_registryReady=false;
  _view->setFrameScheduler(nullptr);if(_surface)_surface->setCanPresent([](){return false;});
  // Fabric removal can destroy this ObjC view before the JS/GPU acknowledgement.
  // The task keeps native dependencies; its UI callback never needs a live self.
  auto held=std::make_shared<RetainedAppleSurface>(RetainedAppleSurface{_view,_surface,_layer});
  const auto generation=_appleState.snapshot().viewGeneration;__weak SkiaView *weakSelf=self;
  if(![RNSkiaModule retireNativeView:_view nativeId:nativeId manager:manager release:[held,weakSelf,generation,manager](){
    NSCAssert([NSThread isMainThread],@"Apple retired layer release requires main owner");
    SkiaView *owner=weakSelf;
    if(!owner || owner->_view!=held->view || ![owner matchesViewGeneration:generation]){
      if(held->surface)held->surface->detach();[held->layer removeFromSuperlayer];return;
    }
    owner->_viewClosePending=false;owner->_viewLifetime.confirmDrain();
    [RNSkiaModule unregisterNativeView:owner manager:manager];[owner finishClosedNativeView];
    if(!owner->_runtimeShutdown && owner->_nativeId && owner.superview && [RNSkiaModule acceptsNativeViewForManager:manager]){[owner startNativeView];[owner updateNativeSurface];}
  }]){
    _viewClosePending=false;[self failNativeView:"Apple view retirement owner unavailable"];[self closeNativeView:recycle];
  }
}

- (void)finishClosedNativeView {
  // Only called without native work or after the actual retirement ACK.
  if(_surface)_surface->detach();[_layer removeFromSuperlayer];
  if(_appleState.close() && !_viewLifetime.recycleRequested())[self emitAppleStatus:"closed" reason:""];
  if(auto manager=_manager.lock())[RNSkiaModule unregisterNativeView:self manager:manager];
  _view.reset();_surface.reset();_layer=nil;_registryReady=false;
  if(!_runtimeShutdown || _viewLifetime.recycleRequested()){
    _viewLifetime.resetAfterRecycle();_runtimeShutdown=false;
  }
}

- (void)refreshNativeVisibility {
  if(!_registryReady || !_view || _viewLifetime.failed() || _appleState.isClosed())return;
  const auto previous=_appleState.snapshot();
  if(_appleState.update(previous.logicalWidth,previous.logicalHeight,previous.scale,_surface->isAttached() && self.window!=nil,[self nativeVisibility]))
    [self emitAppleStatus:previous.bound?"layout":"detached" reason:""];
}

- (BOOL)prepareAppleRuntimeShutdown {
  NSCAssert([NSThread isMainThread],@"Apple runtime UI preparation requires main owner");
  _runtimeShutdown=true;
  _viewLifetime.beginShutdown();[self stopDisplayLink];[self stopObservingNativeLifecycle];
  if(_surface)_surface->setCanPresent([](){return false;});
  if(_view)_view->setFrameScheduler(nullptr);
  return !_viewLifetime.failed();
}
- (std::function<void()>)appleRuntimeProducerStop {
  NSCAssert([NSThread isMainThread],@"Apple producer snapshot requires main owner");
  auto view=_view;return [view](){if(view)view->stopContent();};
}
- (BOOL)releaseAppleRuntimeSurface {
  NSCAssert([NSThread isMainThread],@"Apple runtime surface release requires main owner");
  if(_viewClosePending)return !_viewLifetime.failed(); // Separate task owns its GPU/UI ACK.
  if(!_viewLifetime.confirmDrain())return NO;
  [self closeNativeView:_viewLifetime.recycleRequested()];return !_viewLifetime.failed();
}

- (void)updateNativeSurface {
  NSCAssert([NSThread isMainThread],@"Apple backing state requires main owner");
  if(!_registryReady || _viewLifetime.closing() || !_view || !_surface || _viewLifetime.failed() || _appleState.isClosed())return;
  auto manager=_manager.lock();
  if(!manager || manager!=[RNSkiaModule latestActiveSkManager]){[self failNativeView:"Apple native runtime owner changed"];return;}
  try{
    const auto previous=_appleState.snapshot();
    double scale=previous.scale;
    bool wideColor=false;
#if TARGET_OS_OSX
    if(self.window){scale=self.window.backingScaleFactor;NSColorSpace *color=self.window.screen.colorSpace;wideColor=color && CGColorSpaceIsWideGamutRGB(color.CGColorSpace);}
#else
    if(self.window){scale=self.window.screen.scale;wideColor=self.window.screen.traitCollection.displayGamut==UIDisplayGamutP3;}
#endif
    const bool changed=_appleState.update(self.bounds.size.width,self.bounds.size.height,scale,self.window!=nil,[self nativeVisibility]);
    if(wideColor!=_useP3ColorSpace){_useP3ColorSpace=wideColor;_surfaceFormatDirty=true;}
    if(_surfaceFormatDirty)_appleState.invalidateBacking();
    const auto value=_appleState.snapshot();
    [CATransaction begin];[CATransaction setDisableActions:YES];
    _layer.contentsScale=value.scale;_layer.frame=CGRectMake(0,0,value.logicalWidth,value.logicalHeight);
    [CATransaction commit];
    _surface->setLayoutSize(value.width,value.height);
    if(!value.bound){[self stopDisplayLink];_surface->detach();}
    else {
      if(!_surface->isAttached() || _surfaceFormatDirty)_surface->attach((__bridge void *)_layer,value.width,value.height,_highBitDepth,_useP3ColorSpace,nullptr);
      else if(_surface->getWidth()!=value.width || _surface->getHeight()!=value.height)_surface->resize(value.width,value.height);
      if(!_surface->isAttached())throw std::runtime_error("Apple Dawn surface attachment failed");
    }
    const bool dirty=_surfaceFormatDirty;_surfaceFormatDirty=false;
    if(changed || dirty)[self emitAppleStatus:value.bound?"bound":"detached" reason:""];
    if(value.visible)[self scheduleFrame];else [self stopDisplayLink];
  }catch(const std::exception& error){[self failNativeView:error.what()];}
}

#if TARGET_OS_OSX
- (void)viewDidMoveToWindow {[super viewDidMoveToWindow];[self startNativeView];[self updateNativeSurface];}
- (void)viewDidHide {[super viewDidHide];[self updateNativeSurface];}
- (void)viewDidUnhide {[super viewDidUnhide];[self updateNativeSurface];}
#else
- (void)didMoveToWindow {[super didMoveToWindow];[self startNativeView];[self updateNativeSurface];}
- (void)traitCollectionDidChange:(UITraitCollection *)previous {[super traitCollectionDidChange:previous];[self updateNativeSurface];}
#endif
- (void)setHidden:(BOOL)hidden {[super setHidden:hidden];[self updateNativeSurface];}
