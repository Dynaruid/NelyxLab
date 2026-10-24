#pragma once
#import <TargetConditionals.h>

#import <CoreFoundation/CoreFoundation.h>
#if !TARGET_OS_OSX
#import <UIKit/UIKit.h>
#else
#import <React/RCTUIKit.h>
#endif // !TARGET_OS_OSX

#import <React/RCTViewComponentView.h>
#include <functional>

/**
 * The Fabric component behind <Canvas>, <SkiaPictureView> and
 * <SkiaGraphiteView>: a CAMetalLayer presenting Graphite recordings on the
 * display link. The frames are recorded by the native render thread pool
 * (declarative content) or by JS (SkiaViewApi.makeGraphiteContext).
 */
#if TARGET_OS_OSX
@interface SkiaView : RCTViewComponentView
#else
@interface SkiaView : RCTViewComponentView <UIPointerInteractionDelegate>
#endif
- (BOOL)prepareAppleRuntimeShutdown;
- (std::function<void()>)appleRuntimeProducerStop;
- (BOOL)releaseAppleRuntimeSurface;
@end
