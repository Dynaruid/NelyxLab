// SPDX-License-Identifier: BSD-3-Clause
use std::rc::Rc;
use std::sync::{Arc, Mutex};
use tauri::utils::config::WindowConfig;
use tauri::webview::{PageLoadEvent, Webview, WebviewBuilder};
use tauri::window::{Window, WindowBuilder};
use tauri::{App, PhysicalPosition, PhysicalSize, Wry};
use webview2_com::{ExecuteScriptCompletedHandler, Microsoft::Web::WebView2::Win32::ICoreWebView2};
use windows::core::HSTRING;
use windows::Win32::Foundation::{HWND, LPARAM, LRESULT, RECT, WPARAM};
use windows::Win32::UI::Shell::{DefSubclassProc, RemoveWindowSubclass, SetWindowSubclass};
use windows::Win32::UI::WindowsAndMessaging::{
    GetParent, GetWindowInfo, IsIconic, SetWindowPos, SWP_NOACTIVATE, SWP_NOSIZE, SWP_NOZORDER,
    WINDOWINFO, WM_DPICHANGED, WM_EXITSIZEMOVE, WM_NCDESTROY, WM_SIZING, WM_WINDOWPOSCHANGED,
};

fn window_info(hwnd: HWND) -> windows::core::Result<WINDOWINFO> {
    let mut info = WINDOWINFO {
        cbSize: std::mem::size_of::<WINDOWINFO>() as u32,
        ..Default::default()
    };
    unsafe { GetWindowInfo(hwnd, &mut info)? };
    Ok(info)
}

fn extent(rect: RECT) -> PhysicalSize<u32> {
    PhysicalSize::new(
        rect.right.abs_diff(rect.left),
        rect.bottom.abs_diff(rect.top),
    )
}

fn covering(a: PhysicalSize<u32>, b: PhysicalSize<u32>) -> PhysicalSize<u32> {
    PhysicalSize::new(a.width.max(b.width), a.height.max(b.height))
}

#[derive(Clone, Copy, PartialEq)]
struct Content {
    size: PhysicalSize<u32>,
    left: i32,
}

struct Viewport {
    client: RECT,
    content: Content,
    capacity: PhysicalSize<u32>,
    requested: Option<Content>,
    pending: Option<Content>,
    sending: bool,
}

impl Viewport {
    fn content_at(&self, rect: RECT) -> Content {
        let size = extent(rect);
        // Across a left-edge resize the right side of the last frame stays at its
        // desktop coordinate. Vertically the document scroll origin follows the caption.
        let left = if size == self.content.size {
            self.content.left
        } else {
            self.content
                .left
                .saturating_add(rect.left.saturating_sub(self.client.left))
                .clamp(0, self.capacity.width.saturating_sub(size.width) as i32)
        };
        Content { size, left }
    }
}

fn send_resize(webview: &ICoreWebView2, viewport: &Arc<Mutex<Viewport>>) {
    let content = {
        let mut state = viewport.lock().unwrap();
        if state.sending {
            return;
        }
        let Some(content) = state.pending.take() else {
            return;
        };
        state.sending = true;
        content
    };
    let script = HSTRING::from(format!(
        "window.__nelyxSetRetainedViewport?.({},{},{})",
        content.size.width, content.size.height, content.left
    ));
    let weak = Arc::downgrade(viewport);
    let next = webview.clone();
    let callback = ExecuteScriptCompletedHandler::create(Box::new(move |_, _| {
        if let Some(viewport) = weak.upgrade() {
            viewport.lock().unwrap().sending = false;
            send_resize(&next, &viewport);
        }
        Ok(())
    }));
    if unsafe { webview.ExecuteScript(&script, &callback) }.is_err() {
        let mut state = viewport.lock().unwrap();
        state.sending = false;
        state.requested = None;
    }
}

fn publish(child: &Webview<Wry>, viewport: &Arc<Mutex<Viewport>>, content: Content, force: bool) {
    {
        let mut state = viewport.lock().unwrap();
        if !force && state.requested == Some(content) {
            return;
        }
        state.requested = Some(content);
        state.pending = Some(content);
        if state.sending {
            return;
        }
    }
    let viewport = Arc::clone(viewport);
    let _ = child.with_webview(move |native| {
        if let Ok(webview) = unsafe { native.controller().CoreWebView2() } {
            send_resize(&webview, &viewport);
        }
    });
}

struct ResizeHost {
    window: Window<Wry>,
    child: Webview<Wry>,
    viewport: Arc<Mutex<Viewport>>,
}

impl ResizeHost {
    fn prepare(&self, hwnd: HWND, proposed: RECT) {
        let Ok(info) = window_info(hwnd) else {
            return;
        };
        // USER32 supplies screen coordinates including the current non-client frame.
        let client = RECT {
            left: proposed.left + (info.rcClient.left - info.rcWindow.left),
            top: proposed.top + (info.rcClient.top - info.rcWindow.top),
            right: proposed.right - (info.rcWindow.right - info.rcClient.right),
            bottom: proposed.bottom - (info.rcWindow.bottom - info.rcClient.bottom),
        };
        if client.right <= client.left || client.bottom <= client.top {
            return;
        }
        let content = self.viewport.lock().unwrap().content_at(client);
        publish(&self.child, &self.viewport, content, false);
    }

    fn commit(&self, hwnd: HWND, dpi_changed: bool) {
        if unsafe { IsIconic(hwnd) }.as_bool() {
            return;
        }
        let Ok(info) = window_info(hwnd) else {
            return;
        };
        let client = info.rcClient;
        if client.right <= client.left || client.bottom <= client.top {
            return;
        }
        let (content, capacity, grew, moved, origin_changed) = {
            let mut state = self.viewport.lock().unwrap();
            let mut capacity = covering(state.capacity, extent(client));
            if capacity != state.capacity || dpi_changed {
                if let Ok(Some(monitor)) = self.window.current_monitor() {
                    capacity = covering(capacity, monitor.work_area().size);
                }
            }
            let grew = capacity != state.capacity;
            state.capacity = capacity;
            let content = state.content_at(client);
            let moved = content.left != state.content.left;
            let origin_changed = client.top != state.client.top
                || client.left - content.left != state.client.left - state.content.left;
            state.client = client;
            state.content = content;
            (content, capacity, grew, moved, origin_changed)
        };
        if grew || moved || origin_changed || dpi_changed {
            let parent = hwnd.0 as usize;
            let _ = self.child.with_webview(move |native| unsafe {
                let controller = native.controller();
                let mut container = HWND::default();
                if controller.ParentWindow(&mut container).is_err()
                    || GetParent(container).ok() != Some(HWND(parent as _))
                {
                    return;
                }
                if grew || dpi_changed {
                    let bounds = RECT {
                        left: 0,
                        top: 0,
                        right: capacity.width as i32,
                        bottom: capacity.height as i32,
                    };
                    let _ = controller.SetBounds(bounds);
                }
                if grew || moved || dpi_changed {
                    let mut flags = SWP_NOZORDER | SWP_NOACTIVATE;
                    if !grew && !dpi_changed {
                        flags |= SWP_NOSIZE;
                    }
                    let _ = SetWindowPos(
                        container,
                        None,
                        -content.left,
                        0,
                        capacity.width as i32,
                        capacity.height as i32,
                        flags,
                    );
                }
                if origin_changed || dpi_changed {
                    let _ = controller.NotifyParentWindowPositionChanged();
                }
            });
        }
        // Also correct a rejected sizing proposal (including Escape or a DPI change).
        publish(&self.child, &self.viewport, content, dpi_changed);
    }
}

unsafe extern "system" fn resize_proc(
    hwnd: HWND,
    message: u32,
    wp: WPARAM,
    lp: LPARAM,
    id: usize,
    data: usize,
) -> LRESULT {
    if !matches!(
        message,
        WM_SIZING | WM_WINDOWPOSCHANGED | WM_DPICHANGED | WM_EXITSIZEMOVE | WM_NCDESTROY
    ) {
        return unsafe { DefSubclassProc(hwnd, message, wp, lp) };
    }
    let ptr = data as *const ResizeHost;
    // A nested window message can destroy the registration while this call is on the stack.
    unsafe { Rc::increment_strong_count(ptr) };
    let host = unsafe { Rc::from_raw(ptr) };
    match message {
        WM_SIZING if lp.0 != 0 => host.prepare(hwnd, unsafe { *(lp.0 as *const RECT) }),
        WM_WINDOWPOSCHANGED | WM_EXITSIZEMOVE => host.commit(hwnd, false),
        WM_NCDESTROY => unsafe {
            let _ = RemoveWindowSubclass(hwnd, Some(resize_proc), id);
            drop(Rc::from_raw(ptr));
        },
        _ => {}
    }
    let result = unsafe { DefSubclassProc(hwnd, message, wp, lp) };
    if message == WM_DPICHANGED {
        host.commit(hwnd, true);
    }
    result
}

fn create_window(app: &App<Wry>, config: &WindowConfig) -> Result<(), Box<dyn std::error::Error>> {
    let window = WindowBuilder::from_config(app, config)?
        .no_redirection_bitmap(true)
        .visible(false)
        .build()?;
    let hwnd = window.hwnd()?;
    let client = window_info(hwnd)?.rcClient;
    let monitor = window.current_monitor()?;
    let size = extent(client);
    let capacity = monitor
        .as_ref()
        .map_or(size, |m| covering(size, m.work_area().size));
    let left = monitor.as_ref().map_or(0, |m| {
        (client.left - m.work_area().position.x)
            .clamp(0, capacity.width.saturating_sub(size.width) as i32)
    });
    let content = Content { size, left };
    let viewport = Arc::new(Mutex::new(Viewport {
        client,
        content,
        capacity,
        requested: None,
        pending: None,
        sending: false,
    }));
    let init = format!(
        "({})({},{},{});",
        include_str!("windows_viewport.js").trim_end(),
        size.width,
        size.height,
        left
    );
    let on_load = Arc::clone(&viewport);
    let child = window.add_child(
        WebviewBuilder::from_config(config)
            .initialization_script(init)
            .on_page_load(move |child, page| {
                if matches!(page.event(), PageLoadEvent::Finished) {
                    let content = on_load.lock().unwrap().content;
                    publish(&child, &on_load, content, true);
                }
            }),
        PhysicalPosition::new(-left, 0),
        capacity,
    )?;
    let host = Rc::into_raw(Rc::new(ResizeHost {
        window: window.clone(),
        child,
        viewport,
    }));
    if !unsafe { SetWindowSubclass(hwnd, Some(resize_proc), 1, host as usize) }.as_bool() {
        unsafe {
            drop(Rc::from_raw(host));
        }
        return Err("Could not attach the Windows resize handler".into());
    }
    if config.visible {
        window.show()?;
    }
    Ok(())
}

pub fn create(app: &App<Wry>, labels: &[&str]) -> Result<(), Box<dyn std::error::Error>> {
    for config in &app.config().app.windows {
        if labels.contains(&config.label.as_str()) {
            create_window(app, config)?;
        }
    }
    Ok(())
}
