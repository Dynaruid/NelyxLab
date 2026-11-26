// SPDX-License-Identifier: BSD-3-Clause
use nelyx_backend_core::BackendError;
use tauri::{Runtime, Window};
use windows::Win32::Graphics::Dwm::{
    DwmGetWindowAttribute, DwmSetWindowAttribute, DWMSBT_AUTO, DWMSBT_TRANSIENTWINDOW,
    DWMWA_SYSTEMBACKDROP_TYPE, DWM_SYSTEMBACKDROP_TYPE,
};

const BACKDROP_SIZE: u32 = std::mem::size_of::<DWM_SYSTEMBACKDROP_TYPE>() as u32;

pub fn enabled<R: Runtime>(window: &Window<R>) -> Option<bool> {
    let hwnd = window.hwnd().ok()?;
    let mut material = DWMSBT_AUTO;
    // DWM writes one DWM_SYSTEMBACKDROP_TYPE when the window supports this attribute.
    unsafe {
        DwmGetWindowAttribute(
            hwnd,
            DWMWA_SYSTEMBACKDROP_TYPE,
            (&mut material as *mut DWM_SYSTEMBACKDROP_TYPE).cast(),
            BACKDROP_SIZE,
        )
    }
    .ok()?;
    Some(material == DWMSBT_TRANSIENTWINDOW)
}

pub fn set_enabled<R: Runtime>(window: &Window<R>, enabled: bool) -> Result<(), BackendError> {
    let hwnd = window
        .hwnd()
        .map_err(|error| BackendError::new("platform-error", error.to_string()))?;
    let material = if enabled {
        DWMSBT_TRANSIENTWINDOW
    } else {
        DWMSBT_AUTO
    };
    // The handle belongs to the calling WebView's window. DWM reads one enum value.
    unsafe {
        DwmSetWindowAttribute(
            hwnd,
            DWMWA_SYSTEMBACKDROP_TYPE,
            (&material as *const DWM_SYSTEMBACKDROP_TYPE).cast(),
            BACKDROP_SIZE,
        )
    }
    .map_err(|error| BackendError::new("platform-error", error.to_string()))
}
