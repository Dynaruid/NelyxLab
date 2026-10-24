#pragma once
#import <TargetConditionals.h>

#import <CoreFoundation/CoreFoundation.h>
#if !TARGET_OS_OSX
#import <UIKit/UIKit.h>
#else
#import <AppKit/AppKit.h>
#endif // !TARGET_OS_OSX

#import <React/RCTBridgeModule.h>

#pragma clang diagnostic push
#pragma clang diagnostic ignored "-Wdocumentation"

#include "include/core/SkImage.h"

#pragma clang diagnostic pop

@interface ViewScreenshotService : NSObject {
}

- (instancetype)initWithViewRegistry:(RCTViewRegistry *)viewRegistry;
- (sk_sp<SkImage>)screenshotOfViewWithTag:(NSNumber *)viewTag;

@end
