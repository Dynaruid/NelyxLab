#pragma once

#import <ReactCommon/RCTTurboModuleWithJSIBindings.h>
#import <rnskia/rnskia.h>

#include <memory>
#include <functional>

#include "RNSkManager.h"
@class SkiaView;

@interface RNSkiaModule
    : NSObject <NativeSkiaModuleSpec, RCTTurboModuleWithJSIBindings>

- (std::shared_ptr<RNSkia::RNSkManager>)skManager;

// Fabric components do not have a better way to interact with TurboModules.
// Workaround to get the SkManager instance from singleton.
+ (std::shared_ptr<RNSkia::RNSkManager>)latestActiveSkManager;
+ (BOOL)registerNativeView:(SkiaView *)view manager:(std::shared_ptr<RNSkia::RNSkManager>)manager;
+ (void)unregisterNativeView:(SkiaView *)view manager:(std::shared_ptr<RNSkia::RNSkManager>)manager;
+ (void)failNativeViewForManager:(std::shared_ptr<RNSkia::RNSkManager>)manager;
+ (BOOL)acceptsNativeViewForManager:(std::shared_ptr<RNSkia::RNSkManager>)manager;
+ (BOOL)enqueueViewRegistry:(std::function<void()>)operation ready:(std::function<void()>)ready manager:(std::shared_ptr<RNSkia::RNSkManager>)manager;
+ (BOOL)retireNativeView:(std::shared_ptr<RNSkia::RNSkView>)view nativeId:(size_t)nativeId manager:(std::shared_ptr<RNSkia::RNSkManager>)manager release:(std::function<void()>)release;
+ (void)prepareRuntime:(void *)runtime completion:(void (^)(NSString *_Nullable error))completion;
+ (void)prepareLatestRuntimeWithCompletion:(void (^)(NSString *_Nullable error))completion;
+ (void)sealNativeAdmissionForRuntime:(void *)runtime generation:(uint64_t)generation;

@end
