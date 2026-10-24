// SPDX-License-Identifier: BSD-3-Clause
#import <Foundation/Foundation.h>
#import <React/RCTBridgeModule.h>
#import <TargetConditionals.h>
#if TARGET_OS_OSX
#import <AppKit/AppKit.h>
#else
#import <UIKit/UIKit.h>
#import <React/RCTUtils.h>
#endif

/** NSLocale provides the current ordered user preference list on iOS/macOS.
 * No UIKit/AppKit object is accessed by this synchronous JS-thread query. */
@interface NelyxPlatformServices : NSObject <RCTBridgeModule>
@end
@implementation NelyxPlatformServices
RCT_EXPORT_MODULE(NelyxPlatformServices)
+ (BOOL)requiresMainQueueSetup { return NO; }
RCT_EXPORT_BLOCKING_SYNCHRONOUS_METHOD(getPreferredLocales)
{
  NSArray<NSString *> *languages=[NSLocale preferredLanguages];
  if(languages.count>256)return @{ @"error": @"Preferred-language snapshot exceeds its budget" };
  for(NSString *language in languages)if(language.length==0||language.length>128)return @{ @"error": @"Invalid preferred-language tag length" };
  return @{ @"locales": languages, @"format": @"bcp47" };
}
RCT_EXPORT_METHOD(popSystemNavigator:(BOOL)animated resolve:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject)
{
  dispatch_async(dispatch_get_main_queue(), ^{
#if TARGET_OS_OSX
    NSWindow *window=[NSApp keyWindow] ?: [NSApp mainWindow];
    if(!window){reject(@"unavailable",@"No application window is available",nil);return;}
    resolve(nil);[window performClose:nil];
#else
    UIViewController *root=RCTKeyWindow().rootViewController;
    if(!root){reject(@"unavailable",@"No application view controller is available",nil);return;}
    // The JS acknowledgement precedes removal of the native view and its
    // ordinary React surface teardown. Animated is an iOS-only source option.
    resolve(nil);
    if([root isKindOfClass:[UINavigationController class]])[(UINavigationController *)root popViewControllerAnimated:animated];
    else [root dismissViewControllerAnimated:animated completion:nil];
#endif
  });
}
@end
