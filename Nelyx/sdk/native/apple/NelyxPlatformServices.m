// SPDX-License-Identifier: BSD-3-Clause
#import <Foundation/Foundation.h>
#import <React/RCTBridgeModule.h>
#import <TargetConditionals.h>
#if TARGET_OS_OSX
#import <AppKit/AppKit.h>
#else
#import <UIKit/UIKit.h>
#import <QuartzCore/CADisplayLink.h>
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
// The RN text field stays UIKit's input owner. The containing view observes
// its full UITextInput value, including the marked range omitted by RN events.
@interface NelyxTextInputTraitsView : RCTView <UIScribbleInteractionDelegate>
@property(nonatomic, copy) NSDictionary *editorOptions;
@property(nonatomic, copy) NSDictionary *editingCommand;
@property(nonatomic, copy) RCTDirectEventBlock onNelyxEditing;
@end

@implementation NelyxTextInputTraitsView {
  __weak UIView<UITextInput, UITextInputTraits> *_input;
  UITextSmartDashesType _defaultDashes;
  UITextSmartQuotesType _defaultQuotes;
  UIScribbleInteraction *_scribbleSuppression;
  CADisplayLink *_editingClock;
  NSDictionary *_lastEditingValue;
  NSDictionary *_deferredCommand;
  uint64_t _revision;
  BOOL _observationQueued;
  BOOL _applyingCommand;
  BOOL _reverseSelection;
  NSRange _orderedSelection;
}
@synthesize editorOptions = _editorOptions;
@synthesize onNelyxEditing = _onNelyxEditing;

- (void)setEditorOptions:(NSDictionary *)editorOptions
{
  _editorOptions = [editorOptions copy];
  [self applyEditorOptions];
  [self setNeedsLayout];
}

- (void)setOnNelyxEditing:(RCTDirectEventBlock)event
{
  _onNelyxEditing = [event copy];
  [self queueEditingObservation];
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

- (void)didMoveToWindow
{
  [super didMoveToWindow];
  if (self.window) [self applyEditorOptions];
  else [self clearTextInput];
}

- (void)clearTextInput
{
  if ([_input isKindOfClass:[UITextField class]])
    [(UITextField *)_input removeTarget:self action:@selector(queueEditingObservation)
        forControlEvents:UIControlEventEditingChanged | UIControlEventEditingDidBegin | UIControlEventEditingDidEnd];
  if (_input) [[NSNotificationCenter defaultCenter] removeObserver:self name:nil object:_input];
  [_editingClock invalidate];
  _editingClock = nil;
  _lastEditingValue = nil;
  _reverseSelection = NO;
  if (_scribbleSuppression) [_input removeInteraction:_scribbleSuppression];
  _scribbleSuppression = nil;
  _input.smartDashesType = _defaultDashes;
  _input.smartQuotesType = _defaultQuotes;
  _input = nil;
}

- (void)applyEditorOptions
{
  UIView<UITextInput, UITextInputTraits> *input = nil;
  UIView *child = self.reactSubviews.firstObject;
  if ([child isKindOfClass:[UITextField class]] || [child isKindOfClass:[UITextView class]]) {
    input = (UIView<UITextInput, UITextInputTraits> *)child;
  } else {
    for (UIView *view in child.subviews) {
      if ([view isKindOfClass:[UITextField class]] || [view isKindOfClass:[UITextView class]]) {
        input = (UIView<UITextInput, UITextInputTraits> *)view;
        break;
      }
    }
  }
  if (input != _input) {
    [self clearTextInput];
    _input = input;
    _defaultDashes = input.smartDashesType;
    _defaultQuotes = input.smartQuotesType;
    if ([input isKindOfClass:[UITextField class]])
      [(UITextField *)input addTarget:self action:@selector(queueEditingObservation)
          forControlEvents:UIControlEventEditingChanged | UIControlEventEditingDidBegin | UIControlEventEditingDidEnd];
    else if (input)
      for (NSString *notification in @[UITextViewTextDidBeginEditingNotification,
                                     UITextViewTextDidChangeNotification, UITextViewTextDidEndEditingNotification])
        [[NSNotificationCenter defaultCenter] addObserver:self selector:@selector(editingNotification:)
            name:notification object:input];
    NSDictionary *selection = _editorOptions[@"initialSelection"];
    if (input && selection)
      [self writeSelectionWithAnchor:[selection[@"anchor"] integerValue]
                               focus:[selection[@"focus"] integerValue]];
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
  if (_deferredCommand && self.window) {
    NSDictionary *command = _deferredCommand;
    _deferredCommand = nil;
    [self setEditingCommand:command];
  }
  [self queueEditingObservation];
}

- (void)editingNotification:(NSNotification *)notification
{
  [self queueEditingObservation];
}

- (void)queueEditingObservation
{
  if (_observationQueued || !_onNelyxEditing || !self.window) return;
  _observationQueued = YES;
  __weak NelyxTextInputTraitsView *weakSelf = self;
  dispatch_async(dispatch_get_main_queue(), ^{
    NelyxTextInputTraitsView *view = weakSelf;
    if (!view) return;
    view->_observationQueued = NO;
    [view observeEditing];
  });
}

- (NSDictionary *)editingValue
{
  UIView<UITextInput, UITextInputTraits> *input = _input;
  if (!input) return nil;
  UITextPosition *begin = input.beginningOfDocument;
  UITextRange *document = [input textRangeFromPosition:begin toPosition:input.endOfDocument];
  NSString *text = document ? [input textInRange:document] ?: @"" : @"";
  UITextRange *selection = input.selectedTextRange;
  NSInteger anchor = selection ? [input offsetFromPosition:begin toPosition:selection.start] :
    [_lastEditingValue[@"anchor"] integerValue];
  NSInteger focus = selection ? [input offsetFromPosition:begin toPosition:selection.end] :
    [_lastEditingValue[@"focus"] integerValue];
  anchor = MAX(0, MIN(anchor, (NSInteger)text.length));
  focus = MAX(0, MIN(focus, (NSInteger)text.length));
  if (selection && _reverseSelection) {
    NSRange ordered = NSMakeRange(anchor, focus - anchor);
    if (NSEqualRanges(_orderedSelection, ordered)) {
      NSInteger previous = anchor;
      anchor = focus;
      focus = previous;
    } else _reverseSelection = NO;
  }
  UITextRange *marked = input.markedTextRange;
  NSInteger start = marked ? [input offsetFromPosition:begin toPosition:marked.start] : -1;
  NSInteger end = marked ? [input offsetFromPosition:begin toPosition:marked.end] : -1;
  if (start < 0 || end < start || end > (NSInteger)text.length) start = end = -1;
  return @{ @"text": text, @"anchor": @(anchor), @"focus": @(focus),
            @"composingStart": @(start), @"composingEnd": @(end), @"focused": @(input.isFirstResponder) };
}

- (void)publishEditing:(NSString *)source request:(NSNumber *)request
             rejection:(NSString *)rejection action:(NSString *)action forced:(BOOL)forced
{
  if (!_onNelyxEditing || !self.window) return;
  NSDictionary *value = [self editingValue];
  if (!value) return;
  BOOL changed = ![value isEqualToDictionary:_lastEditingValue];
  if (!changed && !forced && !action && !rejection) return;
  _lastEditingValue = value;
  if (changed || !rejection) _revision++;
  NSMutableDictionary *event = [value mutableCopy];
  event[@"source"] = source;
  event[@"revision"] = @(_revision);
  if (request) event[@"request"] = request;
  if (rejection) event[@"rejection"] = rejection;
  if (action) event[@"action"] = action;
  _onNelyxEditing(event);
}

- (void)observeEditing
{
  if (_applyingCommand) return;
  BOOL focused = _onNelyxEditing && self.window && _input.isFirstResponder;
  if (focused && !_editingClock) {
    // A composition can be unmarked without changing either visible text or
    // selection. Read the UIKit range while this editor owns the keyboard.
    _editingClock = [CADisplayLink displayLinkWithTarget:self selector:@selector(editingTick:)];
    [_editingClock addToRunLoop:NSRunLoop.mainRunLoop forMode:NSRunLoopCommonModes];
  } else if (!focused && _editingClock) {
    [_editingClock invalidate];
    _editingClock = nil;
  }
  [self publishEditing:@"native" request:nil rejection:nil action:nil forced:NO];
}

- (void)editingTick:(CADisplayLink *)clock
{
  if (!_input.isFirstResponder || _input.markedTextRange ||
      [_lastEditingValue[@"composingStart"] integerValue] >= 0)
    [self observeEditing];
}

- (UITextRange *)rangeFrom:(NSInteger)start to:(NSInteger)end
{
  UITextPosition *beginning = _input.beginningOfDocument;
  UITextPosition *first = [_input positionFromPosition:beginning offset:start];
  UITextPosition *last = [_input positionFromPosition:beginning offset:end];
  return first && last ? [_input textRangeFromPosition:first toPosition:last] : nil;
}

- (void)writeSelectionWithAnchor:(NSInteger)anchor focus:(NSInteger)focus
{
  NSInteger start = MIN(anchor, focus), end = MAX(anchor, focus);
  UITextRange *range = [self rangeFrom:start to:end];
  if (!range) return;
  _reverseSelection = anchor > focus;
  _orderedSelection = NSMakeRange(start, end - start);
  UITextRange *current = _input.selectedTextRange;
  if (!current || [_input comparePosition:current.start toPosition:range.start] != NSOrderedSame ||
      [_input comparePosition:current.end toPosition:range.end] != NSOrderedSame)
    _input.selectedTextRange = range;
}

- (void)setEditingCommand:(NSDictionary *)command
{
  if (!command || !_onNelyxEditing) return;
  if (!_input || !self.window) {
    _deferredCommand = [command copy];
    return;
  }
  [self observeEditing];
  NSString *kind = command[@"kind"];
  if ([kind isEqualToString:@"observe"]) return;
  NSDictionary *old = _lastEditingValue;
  NSInteger oldStart = [old[@"composingStart"] integerValue];
  if ([kind isEqualToString:@"submit"]) {
    if (oldStart < 0 && _input.isFirstResponder)
      [self publishEditing:@"native" request:nil rejection:nil action:command[@"action"] forced:YES];
    return;
  }
  NSNumber *request = [command[@"request"] isKindOfClass:[NSNumber class]] ? command[@"request"] : nil;
  BOOL limit = [kind isEqualToString:@"limit"];
  if ([command[@"revision"] unsignedLongLongValue] != _revision) {
    if (!limit) [self publishEditing:@"programmatic" request:request rejection:@"stale" action:nil forced:YES];
    return;
  }
  NSString *before = old[@"text"], *text = command[@"text"];
  NSInteger anchor = [command[@"anchor"] integerValue], focus = [command[@"focus"] integerValue];
  NSInteger start = [command[@"composingStart"] integerValue], end = [command[@"composingEnd"] integerValue];
  if (![text isKindOfClass:[NSString class]] || MIN(anchor, focus) < 0 ||
      MAX(anchor, focus) > (NSInteger)text.length || (limit &&
      !((start == -1 && end == -1) || (start >= 0 && end >= start && end <= (NSInteger)text.length)))) return;
  BOOL changing = ![text isEqualToString:before];
  BOOL cancel = [kind isEqualToString:@"cancel"];
  if ((!limit && !cancel && oldStart >= 0 && changing) ||
      (limit && oldStart < 0)) {
    if (!limit) [self publishEditing:@"programmatic" request:request rejection:@"composing" action:nil forced:YES];
    return;
  }
  _applyingCommand = YES;
  @try {
    if (cancel || (limit && start < 0)) [_input unmarkText];
    if (changing && limit && start >= 0 &&
        start == oldStart && end == (NSInteger)text.length &&
        [old[@"composingEnd"] integerValue] == (NSInteger)before.length &&
        [[before substringToIndex:oldStart] isEqualToString:[text substringToIndex:start]]) {
      [self setMarkedDocumentText:text start:start end:end anchor:anchor focus:focus];
    } else if (changing) {
      NSUInteger prefix = 0;
      while (prefix < MIN(before.length, text.length) &&
             [before characterAtIndex:prefix] == [text characterAtIndex:prefix]) prefix++;
      if (prefix > 0 && prefix < text.length &&
          CFStringIsSurrogateLowCharacter([text characterAtIndex:prefix])) prefix--;
      UITextRange *replacement = [self rangeFrom:prefix to:before.length];
      if (replacement) [_input replaceRange:replacement withText:[text substringFromIndex:prefix]];
      if (limit && start >= 0) {
        NSDictionary *value = [self editingValue];
        if ([value[@"composingStart"] integerValue] != start || [value[@"composingEnd"] integerValue] != end) {
          [_input unmarkText];
          _input.selectedTextRange = [self rangeFrom:start to:end];
          [self setMarkedDocumentText:text start:start end:end anchor:anchor focus:focus];
        }
      }
    }
    [self writeSelectionWithAnchor:anchor focus:focus];
  } @finally {
    _applyingCommand = NO;
  }
  [self publishEditing:limit ? @"native" : @"programmatic" request:request
              rejection:nil action:nil forced:YES];
}

- (void)setMarkedDocumentText:(NSString *)text start:(NSInteger)start end:(NSInteger)end
                       anchor:(NSInteger)anchor focus:(NSInteger)focus
{
  NSInteger a = MAX(0, MIN(anchor - start, end - start));
  NSInteger b = MAX(0, MIN(focus - start, end - start));
  [_input setMarkedText:[text substringWithRange:NSMakeRange(start, end - start)]
          selectedRange:NSMakeRange(MIN(a, b), MAX(a, b) - MIN(a, b))];
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
RCT_EXPORT_VIEW_PROPERTY(editingCommand, NSDictionary)
RCT_EXPORT_VIEW_PROPERTY(onNelyxEditing, RCTDirectEventBlock)
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
