// SPDX-License-Identifier: BSD-3-Clause
use std::{
    cell::Cell,
    ptr::{self, NonNull},
    rc::Rc,
};

use block2::RcBlock;
use objc2::{
    define_class, msg_send,
    rc::{Retained, Weak},
    runtime::{AnyClass, ProtocolObject},
    sel, ClassType, DefinedClass, MainThreadMarker, MainThreadOnly,
};
use objc2_core_foundation::{CGPoint, CGRect};
use objc2_foundation::{
    NSArray, NSNotification, NSNotificationCenter, NSObjectProtocol, NSOperationQueue, NSSet,
    NSString, NSValue,
};
use objc2_quartz_core::CAMetalLayer;
use objc2_ui_kit::{
    NSObjectUIAccessibility, NSValueUIGeometryExtensions, UIColor, UIEdgeInsets, UIEvent, UIFont,
    UIKeyCommand, UIKeyModifierFlags, UIKeyboardFrameEndUserInfoKey,
    UIKeyboardWillChangeFrameNotification, UIScreen, UIScrollViewDelegate, UITextInput, UITextView,
    UITextViewDelegate, UITouch, UITouchType, UIView,
};

use super::{clamp_selection, ControlEvent, EditEvents, Event, PointerInput};

pub(super) type View = UIView;

define_class!(
    #[unsafe(super(UIView))]
    #[thread_kind = MainThreadOnly]
    struct NelyxPlatformViewContainer;

    impl NelyxPlatformViewContainer {
        #[unsafe(method_id(hitTest:withEvent:))]
        fn hit_test(&self, point: CGPoint, event: Option<&UIEvent>) -> Option<Retained<UIView>> {
            let own: &UIView = self;
            let hit: Option<Retained<UIView>> =
                unsafe { msg_send![super(self), hitTest: point, withEvent: event] };
            hit.filter(|view| !ptr::eq(&**view, own))
        }
    }
);

pub(super) fn container(main_thread: MainThreadMarker) -> Retained<View> {
    let view: Retained<NelyxPlatformViewContainer> = unsafe {
        msg_send![NelyxPlatformViewContainer::alloc(main_thread), initWithFrame: CGRect::ZERO]
    };
    view.setClipsToBounds(true);
    view.into_super()
}

pub(super) fn scale(webview: &View) -> Result<f64, String> {
    webview
        .window()
        .map(|window| window.screen().scale())
        .filter(|scale| scale.is_finite() && *scale > 0.0)
        .ok_or_else(|| "WKWebView backing scale is unavailable".into())
}

pub(super) fn attach(root: &View, webview: &View) -> Result<CGRect, String> {
    let parent = webview.superview().ok_or("WKWebView has no UIKit parent")?;
    if !root
        .superview()
        .is_some_and(|current| ptr::eq(&*current, &*parent))
    {
        root.removeFromSuperview();
        parent.insertSubview_aboveSubview(root, webview);
    }
    let bounds = webview.convertRect_toView(webview.bounds(), Some(&parent));
    if root.frame() != bounds {
        root.setFrame(bounds);
    }
    Ok(bounds)
}

define_class!(
    #[unsafe(super(UIView))]
    #[thread_kind = MainThreadOnly]
    struct NelyxPlatformMetalView;

    impl NelyxPlatformMetalView {
        #[unsafe(method(layerClass))]
        fn layer_class() -> &'static AnyClass {
            CAMetalLayer::class()
        }
    }
);

pub(super) fn foreground(
    main_thread: MainThreadMarker,
) -> Result<(Retained<View>, Retained<CAMetalLayer>), String> {
    let view: Retained<NelyxPlatformMetalView> = unsafe {
        msg_send![NelyxPlatformMetalView::alloc(main_thread), initWithFrame: CGRect::ZERO]
    };
    view.setOpaque(false);
    view.setUserInteractionEnabled(false);
    let layer = view
        .layer()
        .downcast::<CAMetalLayer>()
        .map_err(|_| "UIKit could not create its Metal layer")?;
    Ok((view.into_super(), layer))
}

define_class!(
    #[unsafe(super(UITextView))]
    #[thread_kind = MainThreadOnly]
    #[ivars = EditEvents]
    struct NelyxPlatformTextView;

    unsafe impl NSObjectProtocol for NelyxPlatformTextView {}

    unsafe impl UIScrollViewDelegate for NelyxPlatformTextView {}

    unsafe impl UITextViewDelegate for NelyxPlatformTextView {
        #[unsafe(method(textViewDidChange:))]
        fn text_view_did_change(&self, text: &UITextView) {
            self.ivars().input(&text.text());
        }
    }

    impl NelyxPlatformTextView {
        #[unsafe(method_id(keyCommands))]
        fn key_commands(&self) -> Option<Retained<NSArray<UIKeyCommand>>> {
            let original: Option<Retained<NSArray<UIKeyCommand>>> =
                unsafe { msg_send![super(self), keyCommands] };
            if self.markedTextRange().is_some() {
                original
            } else {
                let mut commands = original.map_or_else(Vec::new, |list| list.to_vec());
                let tab = NSString::from_str("\t");
                let action = sel!(nelyxMoveFocus:);
                for flags in [UIKeyModifierFlags::empty(), UIKeyModifierFlags::Shift] {
                    // The action below accepts a UIKeyCommand.
                    commands.insert(0, unsafe {
                        UIKeyCommand::keyCommandWithInput_modifierFlags_action(&tab, flags, action, self.mtm())
                    });
                }
                Some(NSArray::from_retained_slice(&commands))
            }
        }

        #[unsafe(method(nelyxMoveFocus:))]
        fn move_focus(&self, command: &UIKeyCommand) {
            self.ivars().tab(command.modifierFlags().contains(UIKeyModifierFlags::Shift));
        }
    }
);

struct KeyboardState {
    zoom: Cell<f64>,
    points: Cell<f64>,
    sent: Cell<f64>,
    channel: tauri::ipc::Channel<Event>,
    instance: u64,
}

impl KeyboardState {
    fn update(&self, points: f64) {
        self.points.set(points);
        let bottom = points / self.zoom.get();
        if self.sent.replace(bottom) != bottom {
            let _ = self.channel.send(Event::Control(ControlEvent::Keyboard {
                instance_id: self.instance,
                bottom,
            }));
        }
    }
}

struct KeyboardObserver {
    center: Retained<NSNotificationCenter>,
    token: Retained<ProtocolObject<dyn NSObjectProtocol>>,
    state: Rc<KeyboardState>,
}

impl KeyboardObserver {
    fn new(text: &NelyxPlatformTextView, viewport: &View) -> Self {
        let events = text.ivars();
        let state = Rc::new(KeyboardState {
            zoom: Cell::new(1.0),
            points: Cell::new(0.0),
            sent: Cell::new(0.0),
            channel: events.channel.clone(),
            instance: events.instance,
        });
        let view = Weak::new(viewport);
        let text = Weak::new(text);
        let keyboard = Rc::clone(&state);
        let callback = RcBlock::new(move |note: NonNull<NSNotification>| {
            if let (Some(view), Some(text)) = (view.load(), text.load()) {
                if text.isFirstResponder() {
                    // Foundation delivers this notification on the main operation queue.
                    if let Some(inset) = keyboard_inset(unsafe { note.as_ref() }, &view) {
                        keyboard.update(inset);
                    }
                }
            }
        });
        let center = NSNotificationCenter::defaultCenter();
        let token = unsafe {
            center.addObserverForName_object_queue_usingBlock(
                Some(UIKeyboardWillChangeFrameNotification),
                None,
                Some(&NSOperationQueue::mainQueue()),
                &callback,
            )
        };
        Self {
            center,
            token,
            state,
        }
    }
}

impl Drop for KeyboardObserver {
    fn drop(&mut self) {
        // The token was returned by this notification center.
        unsafe { self.center.removeObserver((&*self.token).as_ref()) };
    }
}

fn keyboard_inset(note: &NSNotification, view: &View) -> Option<f64> {
    let screen = view.window()?.screen();
    if note
        .object()
        .and_then(|object| object.downcast::<UIScreen>().ok())
        .is_some_and(|source| !ptr::eq(&*source, &*screen))
    {
        return None;
    }
    let value = note
        .userInfo()?
        .objectForKey(unsafe { UIKeyboardFrameEndUserInfoKey })?
        .downcast::<NSValue>()
        .ok()?;
    // UIKit stores this notification's frame as a CGRect in screen coordinates.
    let rect = unsafe { value.CGRectValue() };
    let space = screen.coordinateSpace();
    let keyboard: CGRect =
        unsafe { msg_send![view, convertRect: rect, fromCoordinateSpace: &*space] };
    let bounds = view.bounds();
    let bottom = bounds.origin.y + bounds.size.height;
    let overlaps_width = keyboard.origin.x < bounds.origin.x + bounds.size.width
        && keyboard.origin.x + keyboard.size.width > bounds.origin.x;
    let covers_bottom = keyboard.origin.y + keyboard.size.height >= bottom - 0.5;
    Some(if overlaps_width && covers_bottom {
        (bottom - keyboard.origin.y).clamp(0.0, bounds.size.height)
    } else {
        0.0
    })
}

pub(super) struct Editor {
    clip: Retained<View>,
    text: Retained<NelyxPlatformTextView>,
    keyboard: KeyboardObserver,
}

impl Editor {
    pub(super) fn new(
        events: EditEvents,
        root: &View,
        value: &str,
        main_thread: MainThreadMarker,
    ) -> Self {
        let clip = container(main_thread);
        clip.setHidden(true);
        let editor = NelyxPlatformTextView::alloc(main_thread).set_ivars(events);
        let text: Retained<NelyxPlatformTextView> =
            unsafe { msg_send![super(editor), initWithFrame: CGRect::ZERO] };
        text.setBackgroundColor(Some(&UIColor::systemBackgroundColor()));
        text.setFont(Some(&UIFont::systemFontOfSize(16.0)));
        text.setTextContainerInset(UIEdgeInsets {
            top: 7.0,
            left: 8.0,
            bottom: 7.0,
            right: 8.0,
        });
        text.setText(Some(&NSString::from_str(value)));
        text.setIsAccessibilityElement(true, main_thread);
        text.setAccessibilityLabel(
            Some(&NSString::from_str("Composited UIKit editor")),
            main_thread,
        );
        // UITextView holds its delegate weakly. The editor owns this text view.
        unsafe { text.setDelegate(Some(ProtocolObject::from_ref(&*text))) };
        clip.addSubview(&text);
        let keyboard = KeyboardObserver::new(&text, root);
        Self {
            clip,
            text,
            keyboard,
        }
    }

    pub(super) fn container(&self) -> &View {
        &self.clip
    }

    pub(super) fn place(&self, clip: CGRect, bounds: CGRect, zoom: f64) {
        self.clip.setFrame(clip);
        self.text.setFrame(bounds);
        self.clip.setHidden(false);
        self.keyboard.state.zoom.set(zoom);
        self.keyboard.state.update(self.keyboard.state.points.get());
    }

    #[allow(deprecated)] // Preserve the UTF-16 selection on all supported iOS versions.
    pub(super) fn set_text(&self, value: &str) {
        let value = NSString::from_str(value);
        if self.text.text() != value {
            let selection = clamp_selection(self.text.selectedRange(), value.length());
            self.text.ivars().updating.set(true);
            self.text.setText(Some(&value));
            self.text.setSelectedRange(selection);
            self.text.ivars().updating.set(false);
        }
    }

    pub(super) fn focus(&self) -> Result<(), String> {
        if !self.clip.isHidden() && self.text.becomeFirstResponder() {
            return Ok(());
        }
        Err("UIKit editor could not receive focus".into())
    }

    pub(super) fn release_focus(&self) {
        if self.text.isFirstResponder() {
            self.text.resignFirstResponder();
        }
        self.keyboard.state.update(0.0);
    }

    pub(super) fn hide(&self) {
        self.release_focus();
        self.clip.setHidden(true);
    }
}

impl Drop for Editor {
    fn drop(&mut self) {
        self.hide();
        self.clip.removeFromSuperview();
    }
}

define_class!(
    #[unsafe(super(UIView))]
    #[thread_kind = MainThreadOnly]
    #[ivars = Rc<PointerInput>]
    struct NelyxPlatformHitView;

    impl NelyxPlatformHitView {
        #[unsafe(method(touchesBegan:withEvent:))]
        fn down(&self, touches: &NSSet<UITouch>, _event: Option<&UIEvent>) {
            if let Some(touch) = touches.anyObject() {
                let device = if touch.r#type() == UITouchType::IndirectPointer { "mouse" } else { "touch" };
                self.ivars().down(touch.locationInView(Some(self)), device);
            }
        }

        #[unsafe(method(touchesMoved:withEvent:))]
        fn moved(&self, touches: &NSSet<UITouch>, _event: Option<&UIEvent>) {
            if let Some(touch) = touches.anyObject() {
                self.ivars().moved(touch.locationInView(Some(self)));
            }
        }

        #[unsafe(method(touchesEnded:withEvent:))]
        fn up(&self, touches: &NSSet<UITouch>, _event: Option<&UIEvent>) {
            if let Some(touch) = touches.anyObject() {
                self.ivars().up(touch.locationInView(Some(self)));
            }
        }

        #[unsafe(method(touchesCancelled:withEvent:))]
        fn cancelled(&self, _touches: &NSSet<UITouch>, _event: Option<&UIEvent>) {
            self.ivars().cancel();
        }
    }
);

pub(super) fn hit(
    input: Rc<PointerInput>,
    bounds: CGRect,
    main_thread: MainThreadMarker,
) -> Retained<View> {
    let view = NelyxPlatformHitView::alloc(main_thread).set_ivars(input);
    let view: Retained<NelyxPlatformHitView> =
        unsafe { msg_send![super(view), initWithFrame: bounds] };
    view.setMultipleTouchEnabled(false);
    view.setIsAccessibilityElement(false, main_thread);
    view.into_super()
}
