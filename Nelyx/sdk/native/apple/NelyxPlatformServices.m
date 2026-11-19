// SPDX-License-Identifier: BSD-3-Clause
#import <Foundation/Foundation.h>
#import <React/RCTBridgeModule.h>
#import <TargetConditionals.h>
#if TARGET_OS_OSX
#import <AppKit/AppKit.h>
#else
#import <UIKit/UIKit.h>
#import <React/RCTUtils.h>
#import <React/RCTView.h>
#import <React/RCTViewManager.h>
#import <React/UIView+React.h>
#endif

/** NSLocale provides the current ordered user preference list on iOS/macOS.
 * No UIKit/AppKit object is accessed by this synchronous JS-thread query. */
@interface NelyxPlatformServices : NSObject <RCTBridgeModule>
@end

#if !TARGET_OS_OSX
// The RN text field still owns focus, selection and text events. Apply the
// UIKit traits at the contained editor when either Fabric props or its child
// change, including replacement of the backing view when multiline changes.
@interface NelyxTextInputTraitsView : RCTView <UIScribbleInteractionDelegate>
@property(nonatomic, copy) NSDictionary *editorOptions;
@end

@implementation NelyxTextInputTraitsView {
  __weak UIView<UITextInputTraits> *_input;
  UITextSmartDashesType _defaultDashes;
  UITextSmartQuotesType _defaultQuotes;
  UIScribbleInteraction *_scribbleSuppression;
}
@synthesize editorOptions = _editorOptions;

- (void)setEditorOptions:(NSDictionary *)editorOptions
{
  _editorOptions = [editorOptions copy];
  [self applyEditorOptions];
  [self setNeedsLayout];
}

- (void)didUpdateReactSubviews
{
  [super didUpdateReactSubviews];
  [self applyEditorOptions];
}

- (void)layoutSubviews
{
  [super layoutSubviews];
  [self applyEditorOptions];
}

- (void)willMoveToSuperview:(UIView *)newSuperview
{
  if (!newSuperview) [self clearTextInput];
  [super willMoveToSuperview:newSuperview];
}

- (void)clearTextInput
{
  if (_scribbleSuppression) [_input removeInteraction:_scribbleSuppression];
  _scribbleSuppression = nil;
  _input.smartDashesType = _defaultDashes;
  _input.smartQuotesType = _defaultQuotes;
  _input = nil;
}

- (void)applyEditorOptions
{
  UIView<UITextInputTraits> *input = nil;
  UIView *child = self.reactSubviews.firstObject;
  if ([child isKindOfClass:[UITextField class]] || [child isKindOfClass:[UITextView class]]) {
    input = (UIView<UITextInputTraits> *)child;
  } else {
    for (UIView *view in child.subviews) {
      if ([view isKindOfClass:[UITextField class]] || [view isKindOfClass:[UITextView class]]) {
        input = (UIView<UITextInputTraits> *)view;
        break;
      }
    }
  }
  if (input != _input) {
    [self clearTextInput];
    _input = input;
    _defaultDashes = input.smartDashesType;
    _defaultQuotes = input.smartQuotesType;
  }
  if (!input) return;

  NSString *dashes = _editorOptions[@"smartDashesType"];
  NSString *quotes = _editorOptions[@"smartQuotesType"];
  const UITextSmartDashesType dashStyle = [dashes isEqual:@"enabled"] ? UITextSmartDashesTypeYes
      : [dashes isEqual:@"disabled"] ? UITextSmartDashesTypeNo : _defaultDashes;
  const UITextSmartQuotesType quoteStyle = [quotes isEqual:@"enabled"] ? UITextSmartQuotesTypeYes
      : [quotes isEqual:@"disabled"] ? UITextSmartQuotesTypeNo : _defaultQuotes;
  if (input.smartDashesType != dashStyle) input.smartDashesType = dashStyle;
  if (input.smartQuotesType != quoteStyle) input.smartQuotesType = quoteStyle;

  NSNumber *handwriting = _editorOptions[@"stylusHandwritingEnabled"];
  if (handwriting && !handwriting.boolValue && !_scribbleSuppression) {
    _scribbleSuppression = [[UIScribbleInteraction alloc] initWithDelegate:self];
    [input addInteraction:_scribbleSuppression];
  } else if ((!handwriting || handwriting.boolValue) && _scribbleSuppression) {
    [input removeInteraction:_scribbleSuppression];
    _scribbleSuppression = nil;
  }
}

- (BOOL)scribbleInteraction:(UIScribbleInteraction *)interaction shouldBeginAtLocation:(CGPoint)location
{
  return NO;
}
@end

@interface NelyxTextInputTraitsManager : RCTViewManager
@end
@implementation NelyxTextInputTraitsManager
RCT_EXPORT_MODULE(NelyxTextInputTraits)
RCT_EXPORT_VIEW_PROPERTY(editorOptions, NSDictionary)
- (UIView *)view
{
  return [NelyxTextInputTraitsView new];
}
@end
#endif
@implementation NelyxPlatformServices
RCT_EXPORT_MODULE(NelyxPlatformServices)
+ (BOOL)requiresMainQueueSetup { return NO; }
RCT_EXPORT_BLOCKING_SYNCHRONOUS_METHOD(getExecutableName)
{
  return NSBundle.mainBundle.executablePath.stringByResolvingSymlinksInPath.lastPathComponent;
}
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
