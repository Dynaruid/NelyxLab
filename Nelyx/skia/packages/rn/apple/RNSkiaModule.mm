#import "RNSkiaModule.h"

#import <ReactCommon/RCTTurboModule.h>
#import <React/RCTJSThread.h>

#import "RNSkApplePlatformContext.h"
#import "SkiaView.h"
#import "NelyxRuntimeShutdown.h"
#include "AppleRuntimeBinding.h"
#include "AppleRuntimeAdmission.h"
#include "AppleRuntimeInstall.h"
#include "AppleViewTaskOwner.h"
#include "AppleRuntimeHost.h"
#include "RNSkView.h"
#include <mutex>
#include <vector>
#include <unordered_set>
#include <unordered_map>

extern "C" bool NelyxVerifyAppleRuntimeTeardownGuard(void *runtime,uint64_t generation) __attribute__((weak_import));

static std::mutex publishedManagerMutex;
static std::weak_ptr<RNSkia::RNSkManager> publishedManager;
static __weak RNSkiaModule *publishedModule;
static RNSkia::AppleRuntimeAdmission appleRuntimeAdmission;
static std::unordered_set<void*> failedAppleRuntimeOwners;
static std::unordered_map<void*,std::pair<uint64_t,std::weak_ptr<RNSkia::AppleRuntimeBinding>>> closedAppleRuntimeOwners;

@interface RNSkiaModule ()
- (void)beginShutdown:(void (^)(NSString *))completion;
- (void)prepareUiShutdown;
- (void)finishNativeShutdown;
- (void)pollNativeShutdown;
- (void)retainFailedShutdown;
@end

@implementation RNSkiaModule {
  // Handed to us by React Native when JS first requires the module (see
  // installJSIBindingsWithRuntime:callInvoker:), which always happens before
  // JS calls install(). Valid until invalidate.
  facebook::jsi::Runtime *_runtime;
  std::shared_ptr<facebook::react::CallInvoker> _jsInvoker;
  std::shared_ptr<RNSkia::RNSkManager> _skManager;
  std::shared_ptr<RNSkia::RNSkApplePlatformContext> _platformContext;
  std::mutex _managerMutex;
  bool _invalidated;
  bool _retainedFailure;
  RNSkia::AppleRuntimeAdmission::Owner _installOwner;
  BOOL _nativeViewAdmissionClosed;
  std::shared_ptr<RNSkia::AppleRuntimeBinding> _runtimeBinding;
  std::shared_ptr<RNSkia::AppleViewTaskOwner> _viewTasks;
  std::shared_ptr<RNSkia::AppleRuntimeHost> _hostHook;
  std::vector<std::function<void()>> _shutdownProducers;
  NSHashTable<SkiaView *> *_nativeViews;
  NSArray<SkiaView *> *_shutdownViews;
  dispatch_source_t _shutdownDeadline;
  dispatch_source_t _viewDeadline;
}

RCT_EXPORT_MODULE()
// Injected by React Native (bridgeless included). It is how a module looks up
// a native view by react tag without touching RCTBridge or RCTUIManager.
@synthesize viewRegistry_DEPRECATED = _viewRegistry_DEPRECATED;

#pragma mark Accessors

- (std::shared_ptr<RNSkia::RNSkManager>)skManager {
  std::lock_guard lock(_managerMutex);
  return _skManager;
}

+ (std::shared_ptr<RNSkia::RNSkManager>)latestActiveSkManager {
  std::lock_guard lock(publishedManagerMutex);
  return publishedManager.lock();
}

#pragma mark Setup and invalidation

// RN 0.83 RCTInstance invalidates TurboModules on the live JS thread before
// destroying ReactInstance. RCTJSThread also dispatches correctly in bridge mode.
- (dispatch_queue_t)methodQueue { return RCTJSThread; }

+ (BOOL)requiresMainQueueSetup {
  return YES;
}

- (instancetype)init {
  if (self = [super init]) {
    _nativeViews=[NSHashTable weakObjectsHashTable];
    // Created on the main queue (see requiresMainQueueSetup): the screen is
    // asked for its color gamut here, where UIKit may be used. The platform
    // context is created on the JS thread and only reads the answer.
    RNSkia::RNSkApplePlatformContext::mainScreenSupportsP3();
    RNSkia::RNSkApplePlatformContext::mainScreenPixelDensity();
  }
  return self;
}

- (void)
    installJSIBindingsWithRuntime:(facebook::jsi::Runtime &)runtime
                      callInvoker:
                          (const std::shared_ptr<facebook::react::CallInvoker>
                               &)callInvoker {
  std::lock_guard lock(_managerMutex);
  if (_invalidated) return;
  if(_runtime && _runtime!=&runtime){NSLog(@"[RNSkiaModule] Runtime rebinding requires a new module owner.");return;}
  _runtime = &runtime;
  _jsInvoker = callInvoker;
}

- (void)invalidate {
  {std::lock_guard lock(_managerMutex);if(_invalidated)return;_invalidated=true;
    if(_viewDeadline){dispatch_source_cancel(_viewDeadline);_viewDeadline=nil;}}
  if(_shutdownDeadline){dispatch_source_cancel(_shutdownDeadline);_shutdownDeadline=nil;}
  const bool closed=(!_installOwner && !_skManager && !_platformContext) ||
      (_runtimeBinding && _runtimeBinding->stage()=="closed" && _runtimeBinding->ownerReleased());
  if(!closed){if(_runtimeBinding)_runtimeBinding->fail("Apple invalidation bypassed checked shutdown");[self retainFailedShutdown];}
  try{if(_platformContext)_platformContext->closeAsyncOperations();if(_runtimeBinding)_runtimeBinding->invalidate();if(_hostHook)_hostHook->releaseOwner();}
  catch(const std::exception& error){NSLog(@"[RNSkiaModule] %s",error.what());[self retainFailedShutdown];return;}
  if(!closed)return; // Keep stable fields for already queued native callbacks.
  {std::lock_guard publishedLock(publishedManagerMutex);if(publishedModule==self){publishedManager.reset();publishedModule=nil;}}
  std::lock_guard lock(_managerMutex);
  _skManager = nullptr;
  _platformContext = nullptr;
  _runtimeBinding = nullptr;
  _viewTasks = nullptr;
  _hostHook = nullptr;
  _runtime = nullptr;
  _jsInvoker = nullptr;
}

- (void)dealloc { [self invalidate]; }

RCT_EXPORT_BLOCKING_SYNCHRONOUS_METHOD(install) {
  std::unique_lock lock(_managerMutex);
  if (_invalidated) return @false;
  if (_skManager != nullptr) {
    return @(_runtimeBinding && _runtimeBinding->stage()=="active" && !_retainedFailure);
  }
  if (_runtime == nullptr || _jsInvoker == nullptr) {
    NSLog(@"[RNSkiaModule] Failed to install: the JS runtime has not been "
          @"provided to the module yet.");
    return @false;
  }
  _installOwner=appleRuntimeAdmission.reserve();
  if(!_installOwner){NSLog(@"Apple runtime replacement requires confirmed drain or process restart");return @false;}
  std::optional<RNSkia::AppleRuntimeInstall> installation;
  try {
  installation.emplace(*_runtime);
  _hostHook=std::make_shared<RNSkia::AppleRuntimeHost>(*_runtime,
#if TARGET_OS_OSX
      "macos","0.83.0",
#else
      "ios","0.83.10",
#endif
      [runtime=_runtime](uint64_t generation){return NelyxVerifyAppleRuntimeTeardownGuard && NelyxVerifyAppleRuntimeTeardownGuard(runtime,generation);}
  );
  _platformContext = std::make_shared<RNSkia::RNSkApplePlatformContext>(
      self.viewRegistry_DEPRECATED, _jsInvoker);
  installation->beginMutation();
  _skManager = std::make_shared<RNSkia::RNSkManager>(
      _runtime, _jsInvoker, _platformContext);
  __weak RNSkiaModule *weakSelf=self;
  auto invoker=_jsInvoker;
  _runtimeBinding=std::make_shared<RNSkia::AppleRuntimeBinding>(*_runtime,
#if TARGET_OS_OSX
      "macos",
#else
      "ios",
#endif
      [weakSelf](){dispatch_async(dispatch_get_main_queue(),^{[weakSelf prepareUiShutdown];});},
      [invoker](std::function<void()> job){invoker->invokeAsync(std::move(job));},
      [weakSelf](facebook::jsi::Runtime &rt,facebook::jsi::Object &status){
        RNSkiaModule *owner=weakSelf;if(!owner || !owner->_hostHook || !owner->_viewTasks)throw std::runtime_error("Apple native host admission owner unavailable");
        const auto stage=owner->_runtimeBinding->stage();if(stage!="closed" && stage!="failed")owner->_hostHook->verify(false);
        const auto &hook=owner->_hostHook->identity();const auto views=owner->_viewTasks->snapshot();
        status.setProperty(rt,"hostHookGeneration",static_cast<double>(hook.generation));
        status.setProperty(rt,"shutdownProtocol",3);status.setProperty(rt,"hostTeardownRequested",owner->_hostHook->teardownRequested());status.setProperty(rt,"nativeReactNativeVersion",facebook::jsi::String::createFromUtf8(rt,hook.nativeReactNativeVersion));
        status.setProperty(rt,"pendingViewTasks",static_cast<double>(views.pending));status.setProperty(rt,"sealedViewTasks",views.sealed);status.setProperty(rt,"failedViewTasks",views.failed);
        status.setProperty(rt,"gpuPrepared",owner->_platformContext->gpuPrepared());status.setProperty(rt,"gpuCreatedOnJs",owner->_platformContext->gpuPrepared());status.setProperty(rt,"gpuDrained",owner->_platformContext->gpuDrained());
        status.setProperty(rt,"gpuBackend",facebook::jsi::String::createFromAscii(rt,"metal"));status.setProperty(rt,"gpuImplementation",facebook::jsi::String::createFromAscii(rt,"dawn"));status.setProperty(rt,"softwareAllowed",false);
      },
      [weakSelf](){RNSkiaModule *owner=weakSelf;if(!owner || !owner->_hostHook)throw std::runtime_error("Apple native GPU owner unavailable");owner->_hostHook->verify();
        try{owner->_platformContext->prepareCompositionGpu();}catch(...){[owner retainFailedShutdown];throw;}});
  _runtimeBinding->install();
  _viewTasks=std::make_shared<RNSkia::AppleViewTaskOwner>(
      [invoker](std::function<void()> job){invoker->invokeAsync(std::move(job));},
      [](std::function<void()> job){dispatch_async(dispatch_get_global_queue(QOS_CLASS_USER_INITIATED,0),^{job();});},
      [](std::function<void()> job){dispatch_async(dispatch_get_main_queue(),^{job();});},
      [weakSelf](std::string error){RNSkiaModule *owner=weakSelf;if(!owner)return;if(owner->_runtimeBinding)owner->_runtimeBinding->fail(std::move(error));[owner retainFailedShutdown];});
  _viewDeadline=dispatch_source_create(DISPATCH_SOURCE_TYPE_TIMER,0,0,dispatch_get_main_queue());
  dispatch_source_set_timer(_viewDeadline,dispatch_time(DISPATCH_TIME_NOW,100*NSEC_PER_MSEC),100*NSEC_PER_MSEC,10*NSEC_PER_MSEC);
  std::weak_ptr<RNSkia::AppleViewTaskOwner> weakTasks=_viewTasks;
  dispatch_source_set_event_handler(_viewDeadline,^{if(auto tasks=weakTasks.lock())tasks->checkDeadline();});
  dispatch_resume(_viewDeadline);
  {std::lock_guard publishedLock(publishedManagerMutex);
    if(!appleRuntimeAdmission.publish(_installOwner))throw std::runtime_error("Apple runtime installation reservation lost");
    publishedManager=_skManager;publishedModule=self;}
  return @true;
  }catch(const std::exception& error){NSLog(@"[RNSkiaModule] Installation failed: %s",error.what());}
  catch(...){NSLog(@"[RNSkiaModule] Installation failed with an unknown exception.");}
  bool rolledBack=false;
  try {
    // An absent transaction means preflight rejected foreign globals before
    // native construction. Never clear those globals.
    rolledBack=!installation || installation->rollback();
    if(_runtimeBinding)_runtimeBinding->invalidate();
    if(_skManager)_skManager->unregisterAllSkiaViews();
    if(_platformContext){_platformContext->closeAsyncOperations();rolledBack=_platformContext->installationRollbackReady() && rolledBack;}
  }catch(...){rolledBack=false;}
  if(rolledBack && appleRuntimeAdmission.releaseChecked(_installOwner)) {
    if(_viewDeadline){dispatch_source_cancel(_viewDeadline);_viewDeadline=nil;}
    if(_hostHook)_hostHook->releaseOwner();
    _hostHook.reset();_viewTasks.reset();_runtimeBinding.reset();_skManager.reset();_platformContext.reset();_installOwner=0;
  }else {
    lock.unlock();[self retainFailedShutdown];
  }
  return @false;
}

#include "AppleRuntimeLifecycle.inc"

- (std::shared_ptr<facebook::react::TurboModule>)getTurboModule:
    (const facebook::react::ObjCTurboModule::InitParams &)params {
  return std::make_shared<facebook::react::NativeSkiaModuleSpecJSI>(params);
}

@end

void NelyxRequestAppleRuntimeShutdown(void (^completion)(NSError *)) {
  dispatch_async(dispatch_get_main_queue(),^{
    __block BOOL finished=NO;
    dispatch_after(dispatch_time(DISPATCH_TIME_NOW,25*NSEC_PER_SEC),dispatch_get_main_queue(),^{
      if(finished)return;finished=YES;
      completion([NSError errorWithDomain:@"org.nelyx.runtime" code:2 userInfo:@{NSLocalizedDescriptionKey:@"Apple shutdown scheduler/deadline unconfirmed; runtime retained"}]);
    });
    [RNSkiaModule prepareLatestRuntimeWithCompletion:^(NSString *error){
      dispatch_async(dispatch_get_main_queue(),^{if(finished)return;finished=YES;completion(error?[NSError errorWithDomain:@"org.nelyx.runtime" code:1 userInfo:@{NSLocalizedDescriptionKey:error}]:nil);});
    }];
  });
}
