// SPDX-License-Identifier: BSD-3-Clause
use crate::system_chrome::{
    Brightness, DeviceOrientation, SystemChromeRequest, SystemUiMode, SystemUiOverlay,
};
use nelyx_backend_core::BackendError;
use objc2::{
    class, ffi, msg_send,
    rc::Retained,
    runtime::{AnyClass, AnyObject, Bool, ClassBuilder, Sel},
    sel,
};
use tauri::{Runtime, Webview};

static STATUS_BAR_STYLE_KEY: u8 = 0;

pub(crate) async fn apply<R: Runtime>(
    webview: &Webview<R>,
    request: SystemChromeRequest,
) -> Result<(), BackendError> {
    let (sender, mut receiver) = tauri::async_runtime::channel(1);
    webview
        .with_webview(move |native| {
            // Tauri owns the controller and calls this closure on the UIKit thread.
            let controller = unsafe { native.view_controller().cast::<AnyObject>().as_ref() };
            let result = controller
                .ok_or_else(|| {
                    BackendError::new("platform-error", "iOS view controller is unavailable")
                })
                .and_then(|controller| apply_to_controller(controller, request));
            let _ = sender.try_send(result);
        })
        .map_err(|error| BackendError::new("platform-error", error.to_string()))?;
    receiver.recv().await.ok_or_else(|| {
        BackendError::new(
            "platform-error",
            "iOS view closed before SystemChrome was applied",
        )
    })?
}

fn apply_to_controller(
    controller: &AnyObject,
    request: SystemChromeRequest,
) -> Result<(), BackendError> {
    match request {
        SystemChromeRequest::Orientations(orientations) => {
            set_orientations(controller, orientations)
        }
        SystemChromeRequest::Mode(mode) => {
            let visible = matches!(mode, SystemUiMode::EdgeToEdge);
            set_visibility(controller, visible, visible);
            Ok(())
        }
        SystemChromeRequest::Overlays(overlays) => {
            set_visibility(
                controller,
                overlays.contains(&SystemUiOverlay::Top),
                overlays.contains(&SystemUiOverlay::Bottom),
            );
            Ok(())
        }
        SystemChromeRequest::Restore => {
            // The controller retains both preferences while UIKit controls actual visibility.
            unsafe {
                let _: () = msg_send![controller, setNeedsStatusBarAppearanceUpdate];
                let _: () = msg_send![controller, setNeedsUpdateOfHomeIndicatorAutoHidden];
            }
            Ok(())
        }
        SystemChromeRequest::Style(style) => {
            if let Some(brightness) = style.status_bar_brightness {
                set_style(controller, brightness)?;
            }
            Ok(())
        }
    }
}

fn set_visibility(controller: &AnyObject, status_bar: bool, home_indicator: bool) {
    // These Tao controller setters also notify UIKit that the preferences changed.
    unsafe {
        let _: () = msg_send![controller, setPrefersStatusBarHidden: Bool::new(!status_bar)];
        let _: () =
            msg_send![controller, setPrefersHomeIndicatorAutoHidden: Bool::new(!home_indicator)];
    }
}

fn set_orientations(
    controller: &AnyObject,
    orientations: Vec<DeviceOrientation>,
) -> Result<(), BackendError> {
    let view: Retained<AnyObject> = unsafe { msg_send![controller, view] };
    let window: Option<Retained<AnyObject>> = unsafe { msg_send![&*view, window] };
    let window =
        window.ok_or_else(|| BackendError::new("platform-error", "iOS window is unavailable"))?;
    let app: Retained<AnyObject> = unsafe { msg_send![class!(UIApplication), sharedApplication] };
    let allowed: usize =
        unsafe { msg_send![&*app, supportedInterfaceOrientationsForWindow: &*window] };
    // UIKit's interface orientation masks are indexed by UIInterfaceOrientation.
    let requested = orientations.iter().fold(0, |mask, orientation| {
        mask | (1
            << match orientation {
                DeviceOrientation::PortraitUp => 1,
                DeviceOrientation::PortraitDown => 2,
                DeviceOrientation::LandscapeRight => 3,
                DeviceOrientation::LandscapeLeft => 4,
            })
    });
    let mask = if orientations.is_empty() {
        allowed
    } else {
        allowed & requested
    };
    if mask == 0 {
        return Err(BackendError::new(
            "unsupported",
            "The iOS app supports none of the requested interface orientations",
        ));
    }
    unsafe {
        let _: () = msg_send![controller, setSupportedInterfaceOrientations: mask];
        if let Some(preferences_class) = AnyClass::get(c"UIWindowSceneGeometryPreferencesIOS") {
            let _: () = msg_send![controller, setNeedsUpdateOfSupportedInterfaceOrientations];
            let scene: Option<Retained<AnyObject>> = msg_send![&*window, windowScene];
            if let Some(scene) = scene {
                let orientation: isize = msg_send![&*scene, interfaceOrientation];
                if mask & (1 << orientation) == 0 {
                    let preferences: Retained<AnyObject> = msg_send![
                        msg_send![preferences_class, alloc],
                        initWithInterfaceOrientations: mask
                    ];
                    let _: () = msg_send![&*scene, requestGeometryUpdateWithPreferences: &*preferences, errorHandler: ffi::nil];
                }
            }
        }
    }
    Ok(())
}

extern "C-unwind" fn preferred_status_bar_style(controller: *mut AnyObject, _: Sel) -> isize {
    unsafe {
        let style =
            ffi::objc_getAssociatedObject(controller, (&raw const STATUS_BAR_STYLE_KEY).cast());
        if let Some(style) = style.as_ref() {
            msg_send![style, integerValue]
        } else {
            msg_send![
                super(controller, class!(UIViewController)),
                preferredStatusBarStyle
            ]
        }
    }
}

fn set_style(controller: &AnyObject, brightness: Brightness) -> Result<(), BackendError> {
    let base = controller.class();
    let name = c"NelyxSystemChromeViewController";
    let subclass = match AnyClass::get(name) {
        Some(subclass) => subclass,
        None => {
            let mut builder = ClassBuilder::new(name, base).ok_or_else(|| {
                BackendError::new(
                    "platform-error",
                    "Could not register the iOS status bar style",
                )
            })?;
            // Override one UIKit getter while keeping Tao's controller state and lifecycle.
            unsafe {
                builder.add_method(
                    sel!(preferredStatusBarStyle),
                    preferred_status_bar_style as extern "C-unwind" fn(*mut AnyObject, Sel) -> isize,
                );
            }
            builder.register()
        }
    };
    if base != subclass {
        if subclass.superclass() != Some(base) {
            return Err(BackendError::new(
                "platform-error",
                "Unexpected iOS view controller class",
            ));
        }
        // This subclass adds no ivars. All controller access runs on the UIKit thread.
        unsafe { AnyObject::set_class(controller, subclass) };
    }
    let style: isize = match brightness {
        Brightness::Light => 3, // UIStatusBarStyleDarkContent
        Brightness::Dark => 1,  // UIStatusBarStyleLightContent
    };
    unsafe {
        let value: Retained<AnyObject> = msg_send![class!(NSNumber), numberWithInteger: style];
        ffi::objc_setAssociatedObject(
            std::ptr::from_ref(controller).cast_mut(),
            (&raw const STATUS_BAR_STYLE_KEY).cast(),
            Retained::as_ptr(&value).cast_mut(),
            ffi::OBJC_ASSOCIATION_RETAIN_NONATOMIC,
        );
        let _: () = msg_send![controller, setNeedsStatusBarAppearanceUpdate];
    }
    Ok(())
}
