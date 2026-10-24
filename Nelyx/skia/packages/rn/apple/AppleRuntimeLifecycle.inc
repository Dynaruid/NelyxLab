// SPDX-License-Identifier: BSD-3-Clause
+ (BOOL)acceptsNativeViewForManager:(std::shared_ptr<RNSkia::RNSkManager>)manager {
  NSCAssert([NSThread isMainThread],@"Apple view admission requires main owner");
  RNSkiaModule *module;{std::lock_guard lock(publishedManagerMutex);module=publishedModule;}
  return module && !module->_nativeViewAdmissionClosed && module.skManager==manager &&
      module->_runtimeBinding && module->_runtimeBinding->stage()=="active" && module->_platformContext->gpuPrepared();
}
+ (BOOL)enqueueViewRegistry:(std::function<void()>)operation ready:(std::function<void()>)ready manager:(std::shared_ptr<RNSkia::RNSkManager>)manager {
  NSCAssert([NSThread isMainThread],@"Apple registry enqueue requires main owner");
  RNSkiaModule *module;{std::lock_guard lock(publishedManagerMutex);module=publishedModule;}
  if(!module || ![self acceptsNativeViewForManager:manager] || !module->_viewTasks)return NO;
  auto binding=module->_runtimeBinding;auto tasks=module->_viewTasks;auto host=module->_hostHook;
  try{tasks->attach([binding,host,operation=std::move(operation)](){binding->requireOwner();if(binding->stage()!="active" || host->teardownRequested())return;operation();},std::move(ready));}
  catch(const std::exception &error){binding->fail(error.what());[module retainFailedShutdown];return NO;}
  return YES;
}
+ (BOOL)retireNativeView:(std::shared_ptr<RNSkia::RNSkView>)view nativeId:(size_t)nativeId manager:(std::shared_ptr<RNSkia::RNSkManager>)manager release:(std::function<void()>)release {
  NSCAssert([NSThread isMainThread],@"Apple view retirement enqueue requires main owner");
  RNSkiaModule *module;{std::lock_guard lock(publishedManagerMutex);module=publishedModule;}
  if(!module || module.skManager!=manager || !module->_viewTasks || !view || !nativeId)return NO;
  auto binding=module->_runtimeBinding;auto context=module->_platformContext;auto tasks=module->_viewTasks;
  try{tasks->close([binding,manager,view,nativeId](){binding->requireOwner();view->stopContent();manager->unregisterSkiaView(nativeId);},[context](){return context->retireGpuWork();},std::move(release));}
  catch(const std::exception &error){binding->fail(error.what());[module retainFailedShutdown];return NO;}
  return YES;
}
+ (BOOL)registerNativeView:(SkiaView *)view manager:(std::shared_ptr<RNSkia::RNSkManager>)manager {
  NSCAssert([NSThread isMainThread],@"Apple view registry requires main owner");
  RNSkiaModule *module;{std::lock_guard lock(publishedManagerMutex);module=publishedModule;}
  if(!module || ![self acceptsNativeViewForManager:manager] || (module->_nativeViews.count>=64 && ![module->_nativeViews containsObject:view]))return NO;
  [module->_nativeViews addObject:view];return YES;
}
+ (void)unregisterNativeView:(SkiaView *)view manager:(std::shared_ptr<RNSkia::RNSkManager>)manager {
  NSCAssert([NSThread isMainThread],@"Apple view registry removal requires main owner");
  RNSkiaModule *module;{std::lock_guard lock(publishedManagerMutex);module=publishedModule;}
  if(module && module.skManager==manager)[module->_nativeViews removeObject:view];
}
+ (void)failNativeViewForManager:(std::shared_ptr<RNSkia::RNSkManager>)manager {
  RNSkiaModule *module;{std::lock_guard lock(publishedManagerMutex);module=publishedModule;}
  if(module && module.skManager==manager){module->_runtimeBinding->fail("Apple native view failure; dependencies retained");[module retainFailedShutdown];}
}
+ (void)prepareRuntime:(void *)runtime completion:(void (^)(NSString *))completion {
  auto &candidate=*static_cast<facebook::jsi::Runtime *>(runtime);
  RNSkiaModule *module;bool failed;uint64_t closedGeneration=0;std::shared_ptr<RNSkia::AppleRuntimeBinding> closed;
  {std::lock_guard lock(publishedManagerMutex);module=publishedModule;failed=failedAppleRuntimeOwners.contains(runtime);
    for(auto entry=closedAppleRuntimeOwners.begin();entry!=closedAppleRuntimeOwners.end();)if(entry->second.second.expired())entry=closedAppleRuntimeOwners.erase(entry);else ++entry;
    const auto entry=closedAppleRuntimeOwners.find(runtime);if(entry!=closedAppleRuntimeOwners.end()){closedGeneration=entry->second.first;closed=entry->second.second.lock();}
  }
  if(failed){completion(@"Apple runtime installation or retirement is unconfirmed");return;}
  if(module){
    bool matches;{std::lock_guard lock(module->_managerMutex);matches=module->_runtime==runtime;}
    if(matches){[module beginShutdown:completion];return;}
  }
  try{
  if(closed && closed->stage()=="closed" && closed->ownerReleased() && NelyxVerifyAppleRuntimeTeardownGuard && NelyxVerifyAppleRuntimeTeardownGuard(runtime,closedGeneration)){
    completion(nil);return;
  }
  const bool empty=candidate.global().getProperty(candidate,"NelyxAppleHost").isUndefined() && candidate.global().getProperty(candidate,"SkiaApi").isUndefined() && candidate.global().getProperty(candidate,"SkiaViewApi").isUndefined();
  completion(empty?nil:@"Apple runtime has native globals without a checked native completion proof");
  }catch(const std::exception& error){completion([NSString stringWithUTF8String:error.what()]);}
}
+ (void)sealNativeAdmissionForRuntime:(void *)runtime generation:(uint64_t)generation {
  NSCAssert([NSThread isMainThread],@"Apple host admission seal requires main owner");
  RNSkiaModule *module;{std::lock_guard lock(publishedManagerMutex);module=publishedModule;}
  if(!module)return;
  std::lock_guard lock(module->_managerMutex);
  if(module->_runtime==runtime && module->_hostHook && module->_hostHook->identity().generation==generation)module->_nativeViewAdmissionClosed=YES;
}
+ (void)prepareLatestRuntimeWithCompletion:(void (^)(NSString *))completion {
  RNSkiaModule *module;bool blocked;{std::lock_guard lock(publishedManagerMutex);module=publishedModule;blocked=appleRuntimeAdmission.blocked();}
  if(!module && blocked){completion(@"Apple runtime installation or shutdown is unconfirmed");return;}
  if(!module){completion(nil);return;}
  std::shared_ptr<facebook::react::CallInvoker> invoker;{std::lock_guard lock(module->_managerMutex);invoker=module->_jsInvoker;}
  if(!invoker){completion(@"Apple runtime scheduler unavailable");return;}
  __weak RNSkiaModule *weakModule=module;
  invoker->invokeAsync([weakModule,completion](){RNSkiaModule *owner=weakModule;if(owner)[owner beginShutdown:completion];else completion(@"Apple runtime owner disappeared");});
}
- (void)beginShutdown:(void (^)(NSString *))completion {
  std::shared_ptr<RNSkia::AppleRuntimeBinding> binding;{std::lock_guard lock(_managerMutex);binding=_runtimeBinding;}
  if(!binding){completion(@"Apple runtime binding unavailable");return;}
  if(!_shutdownDeadline){
    _shutdownDeadline=dispatch_source_create(DISPATCH_SOURCE_TYPE_TIMER,0,0,dispatch_get_main_queue());
    dispatch_source_set_timer(_shutdownDeadline,dispatch_time(DISPATCH_TIME_NOW,100*NSEC_PER_MSEC),100*NSEC_PER_MSEC,10*NSEC_PER_MSEC);
    __weak RNSkiaModule *weakSelf=self;std::weak_ptr<RNSkia::AppleRuntimeBinding> weakBinding=binding;
    dispatch_source_set_event_handler(_shutdownDeadline,^{if(auto state=weakBinding.lock()){state->checkDeadline();if(state->stage()=="failed")[weakSelf retainFailedShutdown];}});
    dispatch_resume(_shutdownDeadline);
  }
  __weak RNSkiaModule *weakSelf=self;
  try{binding->begin([weakSelf,completion](std::string error){if(!error.empty())[weakSelf retainFailedShutdown];completion(error.empty()?nil:[NSString stringWithUTF8String:error.c_str()]);});}
  catch(const std::exception& error){completion([NSString stringWithUTF8String:error.what()]);}
}
- (void)prepareUiShutdown {
  NSCAssert([NSThread isMainThread],@"Apple shutdown UI preparation requires main owner");
  std::shared_ptr<RNSkia::AppleRuntimeBinding> binding;std::shared_ptr<facebook::react::CallInvoker> invoker;
  {std::lock_guard lock(_managerMutex);binding=_runtimeBinding;invoker=_jsInvoker;_nativeViewAdmissionClosed=YES;_shutdownViews=_nativeViews.allObjects;}
  if(!binding || binding->stage()!="ui")return;
  if(_viewTasks)_viewTasks->seal();
  std::vector<std::function<void()>> producers;
  for(SkiaView *view in _shutdownViews){
    if(![view prepareAppleRuntimeShutdown]){binding->fail("Apple producer/UI preparation failed");[self retainFailedShutdown];return;}
    producers.push_back([view appleRuntimeProducerStop]);
  }
  {std::lock_guard lock(_managerMutex);_shutdownProducers=std::move(producers);}
  __weak RNSkiaModule *weakSelf=self;
  invoker->invokeAsync([weakSelf,binding](){if(binding->advance("ui","native",5))[weakSelf finishNativeShutdown];});
}
- (void)finishNativeShutdown {
  auto binding=_runtimeBinding;if(!binding || binding->stage()!="native")return;
  try{
    binding->requireOwner();
    std::vector<std::function<void()>> producers;
    {std::lock_guard lock(_managerMutex);producers.swap(_shutdownProducers);}
    for(auto &stop:producers)stop();
    _skManager->unregisterAllSkiaViews();
    _platformContext->closeAsyncOperations();
  }catch(const std::exception& error){binding->fail(error.what());[self retainFailedShutdown];return;}
  __weak RNSkiaModule *weakSelf=self;auto context=_platformContext;
  // Dawn serializes its context access. Wait outside both JS and the UI owner;
  // deadline failure retains this context even if native work never returns.
  dispatch_async(dispatch_get_global_queue(QOS_CLASS_USER_INITIATED,0),^{
  try{if(!context->retireGpuWork())throw std::runtime_error("Apple GPU retirement unconfirmed");}
  catch(const std::exception& error){binding->fail(error.what());[weakSelf retainFailedShutdown];return;}
  if(binding->stage()!="native")return;
  dispatch_async(dispatch_get_main_queue(),^{
    RNSkiaModule *owner=weakSelf;if(!owner || binding->stage()!="native")return;
    for(SkiaView *view in owner->_shutdownViews)if(![view releaseAppleRuntimeSurface]){binding->fail("Apple surface release failed");[owner retainFailedShutdown];return;}
    {std::lock_guard lock(owner->_managerMutex);owner->_shutdownViews=nil;}
    owner->_jsInvoker->invokeAsync([weakSelf,binding](){if(binding->stage()=="native")[weakSelf pollNativeShutdown];});
  });
  });
}
- (void)pollNativeShutdown {
  auto binding=_runtimeBinding;if(!binding || binding->stage()!="native")return;
  binding->requireOwner();binding->checkDeadline();if(binding->stage()!="native")return;
  if(_viewTasks)_viewTasks->checkDeadline();
  if(_viewTasks && _viewTasks->snapshot().failed){binding->fail("Apple native view owner failed");[self retainFailedShutdown];return;}
  if(_platformContext->mainJobFailed()){binding->fail("Apple native main job failed");[self retainFailedShutdown];return;}
  if((_viewTasks && !_viewTasks->drained()) || !_platformContext->mainJobsDrained() || !_platformContext->streamStatus().drained()){
    __weak RNSkiaModule *weakSelf=self;auto invoker=_jsInvoker;
    dispatch_after(dispatch_time(DISPATCH_TIME_NOW,10*NSEC_PER_MSEC),dispatch_get_main_queue(),^{invoker->invokeAsync([weakSelf,binding](){if(binding->stage()=="native")[weakSelf pollNativeShutdown];});});return;
  }
  try {
    auto &runtime=binding->runtime();
    runtime.global().setProperty(runtime,"SkiaViewApi",facebook::jsi::Value::undefined());
    runtime.global().setProperty(runtime,"SkiaApi",facebook::jsi::Value::undefined());
    if(!runtime.global().getProperty(runtime,"SkiaViewApi").isUndefined() ||
       !runtime.global().getProperty(runtime,"SkiaApi").isUndefined())throw std::runtime_error("Apple globals retirement unconfirmed");
    binding->finish([self](){
      std::lock_guard lock(publishedManagerMutex);
      if(publishedModule!=self || !_hostHook || !appleRuntimeAdmission.releaseChecked(_installOwner))return false;
      closedAppleRuntimeOwners[_runtime]={_hostHook->identity().generation,_runtimeBinding};
      if(_hostHook)_hostHook->releaseOwner();
      publishedManager.reset();publishedModule=nil;return true;
    });
  }catch(const std::exception& error){binding->fail(error.what());[self retainFailedShutdown];}
}
- (void)retainFailedShutdown {
  struct Retained {std::shared_ptr<RNSkia::RNSkManager> manager;std::shared_ptr<RNSkia::RNSkApplePlatformContext> context;std::shared_ptr<RNSkia::AppleRuntimeBinding> binding;std::shared_ptr<RNSkia::AppleRuntimeHost> hostHook;std::shared_ptr<RNSkia::AppleViewTaskOwner> tasks;std::vector<std::function<void()>> producers;NSArray<SkiaView *> *__strong views;};
  static auto *retained=new std::vector<Retained>();
  std::lock_guard lock(_managerMutex);if(_retainedFailure)return;_retainedFailure=true;
  if(_viewDeadline){dispatch_source_cancel(_viewDeadline);_viewDeadline=nil;}
  if(_platformContext)_platformContext->sealForShutdown();
  std::lock_guard publishedLock(publishedManagerMutex);if(appleRuntimeAdmission.poison(_installOwner) && _runtime)failedAppleRuntimeOwners.insert(_runtime);
  if(publishedModule==self){publishedManager.reset();publishedModule=nil;}
  retained->push_back({_skManager,_platformContext,_runtimeBinding,_hostHook,_viewTasks,_shutdownProducers,_shutdownViews});
  NSLog(@"[RNSkiaModule] Shutdown unconfirmed; runtime dependencies retained and replacement denied.");
}
