#pragma once
#import <TargetConditionals.h>

#if !TARGET_OS_OSX
#import <UIKit/UIKit.h>
#else
#import <AppKit/AppKit.h>
#endif

#if !TARGET_OS_OSX
typedef UIView RNSkPlatformView;
#else
typedef NSView RNSkPlatformView;
#endif
