// SPDX-License-Identifier: BSD-3-Clause
use std::{ptr, rc::Rc};

use objc2::{
    define_class, msg_send,
    rc::Retained,
    runtime::{AnyObject, ProtocolObject},
    AnyThread, DefinedClass, MainThreadMarker, MainThreadOnly,
};
use objc2_app_kit::{
    NSAutoresizingMaskOptions, NSEvent, NSResponder, NSScrollView, NSTextDelegate,
    NSTextInputClient, NSTextView, NSTextViewDelegate, NSTrackingArea, NSTrackingAreaOptions,
    NSView, NSWindowOrderingMode,
};
use objc2_core_foundation::{CGPoint, CGRect, CGSize};
use objc2_foundation::{NSNotification, NSObjectProtocol, NSString};
use objc2_quartz_core::CAMetalLayer;

use super::{clamp_selection, EditEvents, PointerInput};

pub(super) type View = NSView;

define_class!(
    #[unsafe(super(NSView))]
    #[thread_kind = MainThreadOnly]
    struct NelyxPlatformViewContainer;

    impl NelyxPlatformViewContainer {
        #[unsafe(method(isFlipped))]
        fn flipped(&self) -> bool {
            true
        }

        #[unsafe(method_id(hitTest:))]
        fn hit_test(&self, point: CGPoint) -> Option<Retained<NSView>> {
            let own: &NSView = self;
            let hit: Option<Retained<NSView>> = unsafe { msg_send![super(self), hitTest: point] };
            hit.filter(|view| !ptr::eq(&**view, own))
        }
    }
);

pub(super) fn container(main_thread: MainThreadMarker) -> Retained<View> {
    let view: Retained<NelyxPlatformViewContainer> = unsafe {
        msg_send![NelyxPlatformViewContainer::alloc(main_thread), initWithFrame: CGRect::ZERO]
    };
    view.setWantsLayer(true);
    if let Some(layer) = view.layer() {
        layer.setMasksToBounds(true);
    }
    view.into_super()
}

pub(super) fn scale(webview: &View) -> Result<f64, String> {
    webview
        .window()
        .map(|window| window.backingScaleFactor())
        .filter(|scale| scale.is_finite() && *scale > 0.0)
        .ok_or_else(|| "WKWebView backing scale is unavailable".into())
}

pub(super) fn attach(root: &View, webview: &View) -> Result<CGRect, String> {
    // The flipped sibling follows the WKWebView's frame in its AppKit parent.
    let parent = unsafe { webview.superview() }.ok_or("WKWebView has no AppKit parent")?;
    if !unsafe { root.superview() }.is_some_and(|current| ptr::eq(&*current, &*parent)) {
        root.removeFromSuperview();
        parent.addSubview_positioned_relativeTo(root, NSWindowOrderingMode::Above, Some(webview));
    }
    let bounds = webview.convertRect_toView(webview.bounds(), Some(&parent));
    if root.frame() != bounds {
        root.setFrame(bounds);
    }
    Ok(bounds)
}

pub(super) fn foreground(
    main_thread: MainThreadMarker,
) -> Result<(Retained<View>, Retained<CAMetalLayer>), String> {
    let view = container(main_thread);
    let layer = CAMetalLayer::new();
    view.setLayer(Some(&layer));
    Ok((view, layer))
}

define_class!(
    #[unsafe(super(NSTextView))]
    #[thread_kind = MainThreadOnly]
    #[ivars = EditEvents]
    struct NelyxPlatformTextView;

    unsafe impl NSObjectProtocol for NelyxPlatformTextView {}
    unsafe impl NSTextViewDelegate for NelyxPlatformTextView {}

    unsafe impl NSTextDelegate for NelyxPlatformTextView {
        #[unsafe(method(textDidChange:))]
        fn text_did_change(&self, _note: &NSNotification) {
            self.ivars().input(&self.string());
        }
    }

    impl NelyxPlatformTextView {
        #[unsafe(method(insertTab:))]
        fn insert_tab(&self, sender: Option<&AnyObject>) {
            if self.hasMarkedText() {
                let _: () = unsafe { msg_send![super(self), insertTab: sender] };
            } else {
                self.ivars().tab(false);
            }
        }

        #[unsafe(method(insertBacktab:))]
        fn insert_backtab(&self, sender: Option<&AnyObject>) {
            if self.hasMarkedText() {
                let _: () = unsafe { msg_send![super(self), insertBacktab: sender] };
            } else {
                self.ivars().tab(true);
            }
        }
    }
);

pub(super) struct Editor {
    clip: Retained<View>,
    scroll: Retained<NSScrollView>,
    text: Retained<NelyxPlatformTextView>,
}

impl Editor {
    pub(super) fn new(
        events: EditEvents,
        _root: &View,
        value: &str,
        main_thread: MainThreadMarker,
    ) -> Self {
        let clip = container(main_thread);
        clip.setHidden(true);
        let scroll = NSScrollView::initWithFrame(NSScrollView::alloc(main_thread), CGRect::ZERO);
        scroll.setHasVerticalScroller(true);
        let editor = NelyxPlatformTextView::alloc(main_thread).set_ivars(events);
        let text: Retained<NelyxPlatformTextView> =
            unsafe { msg_send![super(editor), initWithFrame: CGRect::ZERO] };
        text.setRichText(false);
        text.setEditable(true);
        text.setSelectable(true);
        text.setDrawsBackground(true);
        text.setTextContainerInset(CGSize::new(8.0, 7.0));
        text.setString(&NSString::from_str(value));
        text.setMaxSize(CGSize::new(65_536.0, 65_536.0));
        text.setVerticallyResizable(true);
        text.setHorizontallyResizable(false);
        text.setAutoresizingMask(NSAutoresizingMaskOptions::ViewWidthSizable);
        // The text view owns the container created by its initializer.
        if let Some(container) = unsafe { text.textContainer() } {
            container.setWidthTracksTextView(true);
        }
        let label = NSString::from_str("Composited AppKit editor");
        let _: () = unsafe { msg_send![&*text, setAccessibilityLabel: &*label] };
        text.setDelegate(Some(ProtocolObject::from_ref(&*text)));
        scroll.setDocumentView(Some(&text));
        clip.addSubview(&scroll);
        Self { clip, scroll, text }
    }

    pub(super) fn container(&self) -> &View {
        &self.clip
    }

    pub(super) fn place(&self, clip: CGRect, bounds: CGRect, _zoom: f64) {
        self.clip.setFrame(clip);
        if self.scroll.frame() != bounds {
            self.scroll.setFrame(bounds);
            let size = self.scroll.contentSize();
            self.text.setMinSize(CGSize::new(0.0, size.height));
            self.text.setFrameSize(CGSize::new(
                size.width,
                self.text.frame().size.height.max(size.height),
            ));
        }
        self.clip.setHidden(false);
    }

    pub(super) fn set_text(&self, value: &str) {
        let value = NSString::from_str(value);
        if self.text.string() != value {
            let selection = clamp_selection(self.text.selectedRange(), value.length());
            self.text.ivars().updating.set(true);
            self.text.setString(&value);
            self.text.setSelectedRange(selection);
            self.text.ivars().updating.set(false);
        }
    }

    pub(super) fn focus(&self) -> Result<(), String> {
        if !self.clip.isHiddenOrHasHiddenAncestor()
            && self
                .text
                .window()
                .is_some_and(|window| window.makeFirstResponder(Some(&self.text)))
        {
            return Ok(());
        }
        Err("AppKit editor could not receive focus".into())
    }

    pub(super) fn release_focus(&self) {
        if let Some(window) = self.text.window() {
            let own: &NSResponder = &self.text;
            if window
                .firstResponder()
                .is_some_and(|focus| ptr::eq(&*focus, own))
            {
                window.makeFirstResponder(None);
            }
        }
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
    #[unsafe(super(NSView))]
    #[thread_kind = MainThreadOnly]
    #[ivars = Rc<PointerInput>]
    struct NelyxPlatformHitView;

    impl NelyxPlatformHitView {
        #[unsafe(method(isFlipped))]
        fn flipped(&self) -> bool {
            true
        }

        #[unsafe(method(mouseDown:))]
        fn down(&self, event: &NSEvent) {
            self.ivars().down(self.point(event), "mouse");
        }

        #[unsafe(method(mouseDragged:))]
        fn moved(&self, event: &NSEvent) {
            self.ivars().moved(self.point(event));
        }

        #[unsafe(method(mouseUp:))]
        fn up(&self, event: &NSEvent) {
            self.ivars().up(self.point(event));
        }

        #[unsafe(method(mouseMoved:))]
        fn hover(&self, event: &NSEvent) {
            self.ivars().send("hover", self.point(event), "mouse");
        }

        #[unsafe(method(mouseExited:))]
        fn exited(&self, event: &NSEvent) {
            self.ivars().send("hover", self.point(event), "mouse");
        }
    }
);

impl NelyxPlatformHitView {
    fn point(&self, event: &NSEvent) -> CGPoint {
        self.convertPoint_fromView(event.locationInWindow(), None)
    }
}

pub(super) fn hit(
    input: Rc<PointerInput>,
    bounds: CGRect,
    main_thread: MainThreadMarker,
) -> Retained<View> {
    let view = NelyxPlatformHitView::alloc(main_thread).set_ivars(input);
    let view: Retained<NelyxPlatformHitView> =
        unsafe { msg_send![super(view), initWithFrame: bounds] };
    let tracking = unsafe {
        NSTrackingArea::initWithRect_options_owner_userInfo(
            NSTrackingArea::alloc(),
            CGRect::ZERO,
            NSTrackingAreaOptions::MouseEnteredAndExited
                | NSTrackingAreaOptions::MouseMoved
                | NSTrackingAreaOptions::ActiveInKeyWindow
                | NSTrackingAreaOptions::InVisibleRect,
            Some(&view),
            None,
        )
    };
    view.addTrackingArea(&tracking);
    view.into_super()
}
