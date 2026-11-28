// SPDX-License-Identifier: BSD-3-Clause
use std::{cell::Cell, marker::PhantomData, rc::Rc};

use windows::{
    core::{w, Error, Interface, Result, PCWSTR},
    Win32::{
        Foundation::{
            ERROR_CLASS_ALREADY_EXISTS, E_FAIL, E_INVALIDARG, HWND, LPARAM, LRESULT, POINT, RECT,
            WPARAM,
        },
        Graphics::{
            Direct3D::{D3D_DRIVER_TYPE_HARDWARE, D3D_DRIVER_TYPE_WARP},
            Direct3D11::{
                D3D11CreateDevice, ID3D11Device, ID3D11DeviceContext, ID3D11Texture2D, D3D11_BOX,
                D3D11_CREATE_DEVICE_BGRA_SUPPORT, D3D11_SDK_VERSION,
            },
            DirectComposition::{
                DCompositionCreateDevice, IDCompositionDevice, IDCompositionSurface,
                IDCompositionTarget, IDCompositionVisual,
            },
            Dxgi::{
                Common::{DXGI_ALPHA_MODE_PREMULTIPLIED, DXGI_FORMAT_B8G8R8A8_UNORM},
                IDXGIDevice, IDXGISurface,
            },
            Gdi::{
                CreateRectRgn, DeleteObject, RedrawWindow, SetWindowRgn, RDW_ERASE, RDW_FRAME,
                RDW_INVALIDATE, RDW_UPDATENOW,
            },
        },
        System::LibraryLoader::GetModuleHandleW,
        UI::{
            Input::KeyboardAndMouse::{GetFocus, SetFocus},
            WindowsAndMessaging::{
                BeginDeferWindowPos, CreateWindowExW, DefWindowProcW, DeferWindowPos,
                DestroyWindow, EndDeferWindowPos, GetParent, GetWindow, IsWindowVisible,
                RegisterClassW, SetLayeredWindowAttributes, SetWindowTextW, ShowWindow,
                ES_AUTOVSCROLL, ES_MULTILINE, GW_HWNDPREV, HTTRANSPARENT, HWND_TOP, LWA_ALPHA,
                SET_WINDOW_POS_FLAGS, SWP_NOACTIVATE, SWP_NOMOVE, SWP_NOOWNERZORDER, SWP_NOSIZE,
                SWP_NOZORDER, SWP_SHOWWINDOW, SW_HIDE, WINDOW_EX_STYLE, WINDOW_STYLE,
                WM_ERASEBKGND, WM_NCHITTEST, WNDCLASSW, WS_BORDER, WS_CHILD, WS_DISABLED,
                WS_EX_LAYERED, WS_EX_NOACTIVATE, WS_EX_NOREDIRECTIONBITMAP, WS_EX_TRANSPARENT,
                WS_TABSTOP, WS_VSCROLL,
            },
        },
    },
};

pub use crate::win32_control_events::{NativeControlEvent, NativeControlEvents};
pub use crate::win32_pointer::{NativeHitRegion, NativePointer, NativePointerKind};
use crate::{ColorType, ForegroundFrame, FrameKey};

// Keep the comparison bounded even when a foreground fills the viewport.
const RETAINED_FOREGROUND_BYTES: usize = 1024 * 1024;

struct WindowPosition {
    hwnd: HWND,
    insert_after: HWND,
    bounds: RECT,
    flags: SET_WINDOW_POS_FLAGS,
}

struct ControlPlacement<'a> {
    control: &'a NativeControl,
    bounds: RECT,
    clip: Option<RECT>,
    clip_changed: bool,
    size_changed: bool,
}

/// Positions siblings in one USER32 operation. Update the cached geometry
/// only after USER32 has applied the batch.
#[derive(Default)]
pub struct ChildWindowLayout<'a> {
    positions: Vec<WindowPosition>,
    controls: Vec<ControlPlacement<'a>>,
    foreground: Option<(&'a CompositionForeground, RECT)>,
}

impl ChildWindowLayout<'_> {
    pub fn is_empty(&self) -> bool {
        self.positions.is_empty()
    }

    pub(super) fn show(&mut self, hwnd: HWND, insert_after: HWND, bounds: RECT) {
        self.positions.push(WindowPosition {
            hwnd,
            insert_after,
            bounds,
            flags: SWP_NOACTIVATE | SWP_NOOWNERZORDER | SWP_SHOWWINDOW,
        });
    }

    fn raise_label(&mut self, hwnd: HWND) {
        self.positions.push(WindowPosition {
            hwnd,
            insert_after: HWND_TOP,
            bounds: RECT::default(),
            flags: SWP_NOMOVE | SWP_NOSIZE | SWP_NOACTIVATE | SWP_NOOWNERZORDER,
        });
    }

    pub fn move_webview(&mut self, hwnd: HWND, bounds: RECT, resize: bool) {
        let mut flags = SWP_NOZORDER | SWP_NOACTIVATE;
        if !resize {
            flags |= SWP_NOSIZE;
        }
        self.positions.push(WindowPosition {
            hwnd,
            insert_after: HWND_TOP,
            bounds,
            flags,
        });
    }

    pub fn apply(self) -> Result<()> {
        if self.is_empty() {
            return Ok(());
        }
        for update in &self.controls {
            if update.clip_changed {
                update.control.set_clip(update.clip)?;
            }
        }
        unsafe {
            let mut batch = BeginDeferWindowPos(self.positions.len() as i32)?;
            for WindowPosition {
                hwnd,
                insert_after,
                bounds,
                flags,
            } in self.positions
            {
                batch = DeferWindowPos(
                    batch,
                    hwnd,
                    Some(insert_after),
                    bounds.left,
                    bounds.top,
                    bounds.right - bounds.left,
                    bounds.bottom - bounds.top,
                    flags,
                )?;
            }
            EndDeferWindowPos(batch)?;
        }
        for update in self.controls {
            if update.clip_changed || update.size_changed {
                update.control.repaint()?;
            }
            update.control.bounds.set(Some(update.bounds));
        }
        if let Some((foreground, bounds)) = self.foreground {
            foreground.bounds.set(Some(bounds));
        }
        Ok(())
    }
}

pub struct PreparedForeground {
    key: FrameKey,
    bounds: RECT,
}

struct ChildWindow(HWND);

impl Drop for ChildWindow {
    fn drop(&mut self) {
        let _ = unsafe { DestroyWindow(self.0) };
    }
}

struct ForegroundWindow {
    target: IDCompositionTarget,
    window: ChildWindow,
}

impl ForegroundWindow {
    fn new(
        parent: HWND,
        device: &IDCompositionDevice,
        visual: &IDCompositionVisual,
    ) -> Result<Self> {
        let class = w!("NelyxSkiaForeground");
        unsafe {
            let instance = GetModuleHandleW(None)?.into();
            let atom = RegisterClassW(&WNDCLASSW {
                lpfnWndProc: Some(foreground_proc),
                hInstance: instance,
                lpszClassName: class,
                ..Default::default()
            });
            if atom == 0 {
                let error = Error::from_thread();
                if error.code() != ERROR_CLASS_ALREADY_EXISTS.to_hresult() {
                    return Err(error);
                }
            }
            let window = ChildWindow(CreateWindowExW(
                WS_EX_NOACTIVATE | WS_EX_NOREDIRECTIONBITMAP | WS_EX_TRANSPARENT,
                class,
                w!(""),
                WS_CHILD | WS_DISABLED,
                0,
                0,
                0,
                0,
                Some(parent),
                None,
                Some(instance),
                None,
            )?);
            let target = device.CreateTargetForHwnd(window.0, true)?;
            target.SetRoot(visual)?;
            Ok(Self { target, window })
        }
    }
}

unsafe extern "system" fn foreground_proc(
    hwnd: HWND,
    message: u32,
    wp: WPARAM,
    lp: LPARAM,
) -> LRESULT {
    match message {
        WM_NCHITTEST => LRESULT(HTTRANSPARENT as isize),
        WM_ERASEBKGND => LRESULT(1),
        _ => unsafe { DefWindowProcW(hwnd, message, wp, lp) },
    }
}

/// A pixel-only child window staged with the native controls it covers.
pub struct CompositionForeground {
    parent: HWND,
    device: IDCompositionDevice,
    visual: IDCompositionVisual,
    immediate: ID3D11DeviceContext,
    window: Option<ForegroundWindow>,
    buffer: Option<ForegroundBuffer>,
    bounds: Cell<Option<RECT>>,
    presented: Option<FrameKey>,
    thread: PhantomData<Rc<()>>,
}

struct ForegroundBuffer {
    size: (i32, i32),
    surface: IDCompositionSurface,
    pixels: Vec<u8>,
    needs_commit: bool,
}

impl CompositionForeground {
    /// The parent belongs to this process and must outlive the foreground.
    pub fn new(parent: HWND) -> Result<Self> {
        unsafe {
            let mut device: Option<ID3D11Device> = None;
            let mut immediate = None;
            let mut open = |driver| {
                D3D11CreateDevice(
                    None,
                    driver,
                    Default::default(),
                    D3D11_CREATE_DEVICE_BGRA_SUPPORT,
                    None,
                    D3D11_SDK_VERSION,
                    Some(&mut device),
                    None,
                    Some(&mut immediate),
                )
            };
            open(D3D_DRIVER_TYPE_HARDWARE).or_else(|_| open(D3D_DRIVER_TYPE_WARP))?;
            let dxgi: IDXGIDevice = device.ok_or_else(|| Error::from_hresult(E_FAIL))?.cast()?;
            let device: IDCompositionDevice = DCompositionCreateDevice(&dxgi)?;
            let visual = device.CreateVisual()?;
            Ok(Self {
                parent,
                device,
                visual,
                immediate: immediate.ok_or_else(|| Error::from_hresult(E_FAIL))?,
                window: None,
                buffer: None,
                bounds: Cell::new(None),
                presented: None,
                thread: PhantomData,
            })
        }
    }

    pub fn prepare(
        &mut self,
        frame: &ForegroundFrame,
        origin: POINT,
        clip: RECT,
    ) -> Result<Option<PreparedForeground>> {
        if self.presented.is_some_and(|key| {
            frame.key.owner_generation != key.owner_generation
                || frame.key.sequence <= key.sequence
                || frame.key.viewport_generation < key.viewport_generation
                || frame.key.renderer_generation < key.renderer_generation
        }) {
            return Err(Error::new(
                E_INVALIDARG,
                "Stale native platform-view foreground",
            ));
        }
        let left = clip.left.max(origin.x);
        let top = clip.top.max(origin.y);
        let right = clip.right.min(origin.x + frame.size.0);
        let bottom = clip.bottom.min(origin.y + frame.size.1);
        if right <= left || bottom <= top {
            return Ok(None);
        }
        let size = (right - left, bottom - top);
        let mut raster = frame
            .rasterize_as(ColorType::BGRA8888, (left - origin.x, top - origin.y), size)
            .map_err(|error| {
                Error::new(E_FAIL, format!("Skia foreground raster failed: {error:?}"))
            })?;
        let pixels = raster
            .peek_pixels()
            .ok_or_else(|| Error::from_hresult(E_FAIL))?;
        let bytes = pixels.bytes().ok_or_else(|| Error::from_hresult(E_FAIL))?;
        let stride = pixels.row_bytes();
        let Some(painted) = painted_bounds(bytes, stride, size) else {
            return Ok(None);
        };
        if self.window.is_none() {
            self.window = Some(ForegroundWindow::new(
                self.parent,
                &self.device,
                &self.visual,
            )?);
        }
        // On resize the displayed bitmap can follow the new paint origin
        // without waiting for a surface sized to the entire editor.
        let size = (painted.right - painted.left, painted.bottom - painted.top);
        let first_pixel = painted.top as usize * stride + painted.left as usize * 4;
        let (width, height) = size;
        let row_bytes = width as usize * 4;
        let rows = bytes[first_pixel..]
            .chunks(stride)
            .take(height as usize)
            .map(|row| &row[..row_bytes]);
        if self
            .buffer
            .as_ref()
            .is_none_or(|previous| previous.size != size)
        {
            let surface = unsafe {
                self.device.CreateSurface(
                    width as u32,
                    height as u32,
                    DXGI_FORMAT_B8G8R8A8_UNORM,
                    DXGI_ALPHA_MODE_PREMULTIPLIED,
                )?
            };
            self.buffer = Some(ForegroundBuffer {
                size,
                surface,
                pixels: Vec::new(),
                needs_commit: false,
            });
        }
        let buffer = self.buffer.as_mut().unwrap();
        // A position-only change can keep the presented surface with its child window.
        if !buffer.pixels.chunks_exact(row_bytes).eq(rows.clone()) {
            unsafe {
                let mut offset = POINT::default();
                let texture = buffer
                    .surface
                    .BeginDraw::<IDXGISurface>(None, &mut offset)?;
                let upload = texture.cast::<ID3D11Texture2D>().map(|texture| {
                    let area = D3D11_BOX {
                        left: offset.x as u32,
                        top: offset.y as u32,
                        front: 0,
                        right: (offset.x + width) as u32,
                        bottom: (offset.y + height) as u32,
                        back: 1,
                    };
                    self.immediate.UpdateSubresource(
                        &texture,
                        0,
                        Some(&area),
                        bytes[first_pixel..].as_ptr().cast(),
                        stride as u32,
                        0,
                    );
                });
                let end = buffer.surface.EndDraw();
                upload?;
                end?;
            }
            buffer.needs_commit = true;
            if row_bytes * height as usize <= RETAINED_FOREGROUND_BYTES {
                buffer.pixels.clear();
                for row in rows {
                    buffer.pixels.extend_from_slice(row);
                }
            }
        }
        Ok(Some(PreparedForeground {
            key: frame.key,
            bounds: RECT {
                left: left + painted.left,
                top: top + painted.top,
                right: left + painted.right,
                bottom: top + painted.bottom,
            },
        }))
    }

    pub fn queue_frame<'a>(
        &'a self,
        layout: &mut ChildWindowLayout<'a>,
        frame: &PreparedForeground,
    ) {
        self.queue_bounds(layout, frame.bounds);
    }

    pub fn queue_shift<'a>(&'a self, layout: &mut ChildWindowLayout<'a>, delta: POINT) {
        if let Some(bounds) = self.bounds.get() {
            self.queue_bounds(
                layout,
                RECT {
                    left: bounds.left + delta.x,
                    top: bounds.top + delta.y,
                    right: bounds.right + delta.x,
                    bottom: bounds.bottom + delta.y,
                },
            );
        }
    }

    fn queue_bounds<'a>(&'a self, layout: &mut ChildWindowLayout<'a>, bounds: RECT) {
        if let Some(window) = &self.window {
            if self.bounds.get() != Some(bounds) || !layout.is_empty() {
                layout.show(window.window.0, HWND_TOP, bounds);
                layout.foreground = Some((self, bounds));
            }
        }
    }

    pub fn present(&mut self, frame: PreparedForeground) -> Result<()> {
        debug_assert_eq!(self.bounds.get(), Some(frame.bounds));
        let buffer = self
            .buffer
            .as_mut()
            .ok_or_else(|| Error::from_hresult(E_FAIL))?;
        if buffer.needs_commit {
            unsafe {
                self.visual.SetContent(&buffer.surface)?;
                self.device.Commit()?;
            }
            buffer.needs_commit = false;
        } else if !unsafe { self.device.CheckDeviceState()? }.as_bool() {
            return Err(Error::new(
                E_FAIL,
                "The native foreground device is no longer valid",
            ));
        }
        self.presented = Some(frame.key);
        Ok(())
    }

    pub fn hide(&mut self) -> Result<()> {
        self.bounds.set(None);
        self.buffer = None;
        let Some(window) = self.window.take() else {
            return Ok(());
        };
        unsafe {
            self.visual.SetContent(None)?;
            window.target.SetRoot(None)?;
            self.device.Commit()?;
        }
        Ok(())
    }

    pub fn hwnd(&self) -> Option<HWND> {
        self.window.as_ref().map(|window| window.window.0)
    }

    #[cfg(test)]
    pub(crate) fn needs_commit(&self) -> bool {
        self.buffer
            .as_ref()
            .is_some_and(|buffer| buffer.needs_commit)
    }

    pub fn wait_for_commit(&self) -> Result<()> {
        unsafe { self.device.WaitForCommitCompletion() }
    }
}

impl Drop for CompositionForeground {
    fn drop(&mut self) {
        let _ = self.hide();
    }
}

fn painted_bounds(bytes: &[u8], stride: usize, (width, height): (i32, i32)) -> Option<RECT> {
    let mut bounds = RECT {
        left: width,
        top: height,
        right: 0,
        bottom: 0,
    };
    for y in 0..height {
        let offset = y as usize * stride;
        let mut row = bytes[offset..offset + width as usize * 4].chunks_exact(4);
        let Some(left) = row.position(|pixel| pixel[3] != 0) else {
            continue;
        };
        let right = match row.rev().position(|pixel| pixel[3] != 0) {
            Some(from_end) => width - from_end as i32,
            None => left as i32 + 1,
        };
        bounds.left = bounds.left.min(left as i32);
        bounds.right = bounds.right.max(right);
        bounds.top = bounds.top.min(y);
        bounds.bottom = y + 1;
    }
    (bounds.top < bounds.bottom).then_some(bounds)
}

#[derive(Clone, Copy)]
pub enum ControlType {
    Editor,
    Button,
}

/// A child window whose original size is independent of the visible region.
pub struct NativeControl {
    hwnd: HWND,
    bounds: Cell<Option<RECT>>,
    clip: Cell<Option<RECT>>,
    label: Option<HWND>,
    thread: PhantomData<Rc<()>>,
}

impl NativeControl {
    pub fn new(parent: HWND, kind: ControlType, text: &str, layered: bool) -> Result<Self> {
        let (class, style) = match kind {
            ControlType::Editor => (
                w!("EDIT"),
                WS_BORDER | WS_VSCROLL | WINDOW_STYLE((ES_MULTILINE | ES_AUTOVSCROLL) as u32),
            ),
            ControlType::Button => (w!("BUTTON"), WINDOW_STYLE(0)),
        };
        unsafe {
            let title = wide(text)?;
            let module = GetModuleHandleW(None)?;
            let hwnd = CreateWindowExW(
                if layered {
                    WS_EX_LAYERED
                } else {
                    WINDOW_EX_STYLE::default()
                },
                class,
                PCWSTR(title.as_ptr()),
                WS_CHILD | WS_TABSTOP | style,
                0,
                0,
                0,
                0,
                Some(parent),
                None,
                Some(module.into()),
                None,
            )?;
            let control = Self {
                hwnd,
                bounds: Cell::new(None),
                clip: Cell::new(None),
                label: None,
                thread: PhantomData,
            };
            if layered {
                // A dedicated redirection surface keeps the real control visible
                // alongside the windowed WebView2 composition surface.
                SetLayeredWindowAttributes(hwnd, Default::default(), 255, LWA_ALPHA)?;
            }
            Ok(control)
        }
    }

    pub fn hwnd(&self) -> HWND {
        self.hwnd
    }

    pub fn owns_window(&self, hwnd: HWND) -> bool {
        self.hwnd == hwnd || self.label == Some(hwnd)
    }

    pub fn set_accessible_name(&mut self, name: &str) -> Result<()> {
        let name = wide(name)?;
        unsafe {
            if let Some(label) = self.label {
                return SetWindowTextW(label, PCWSTR(name.as_ptr()));
            }
            self.label = Some(CreateWindowExW(
                WINDOW_EX_STYLE::default(),
                w!("STATIC"),
                PCWSTR(name.as_ptr()),
                WS_CHILD,
                0,
                0,
                0,
                0,
                Some(GetParent(self.hwnd)?),
                None,
                Some(GetModuleHandleW(None)?.into()),
                None,
            )?);
        }
        Ok(())
    }

    pub fn set_text(&self, text: &str) -> Result<()> {
        let title = wide(text)?;
        unsafe { SetWindowTextW(self.hwnd, PCWSTR(title.as_ptr())) }
    }

    pub fn focus(&self) -> bool {
        if !unsafe { IsWindowVisible(self.hwnd) }.as_bool() {
            return false;
        }
        let _ = unsafe { SetFocus(Some(self.hwnd)) };
        unsafe { GetFocus() == self.hwnd }
    }

    pub fn place(&self, bounds: RECT, visible: RECT) -> Result<()> {
        let mut layout = ChildWindowLayout::default();
        self.queue(&mut layout, bounds, visible)?;
        layout.apply()
    }

    pub fn queue<'a>(
        &'a self,
        layout: &mut ChildWindowLayout<'a>,
        bounds: RECT,
        visible: RECT,
    ) -> Result<()> {
        if visible.left >= visible.right || visible.top >= visible.bottom {
            self.hide();
            return Ok(());
        }
        if visible.left < bounds.left
            || visible.top < bounds.top
            || visible.right > bounds.right
            || visible.bottom > bounds.bottom
            || bounds.right.checked_sub(bounds.left).is_none()
            || bounds.bottom.checked_sub(bounds.top).is_none()
        {
            return Err(Error::from_hresult(E_INVALIDARG));
        }
        // The HWND already clips to its own extent. Updating a full-size region
        // would issue a separate window-position change before the layout batch.
        let clip = (visible != bounds).then_some(RECT {
            left: visible.left - bounds.left,
            top: visible.top - bounds.top,
            right: visible.right - bounds.left,
            bottom: visible.bottom - bounds.top,
        });
        let previous = self.bounds.get();
        let clip_changed = self.clip.get() != clip;
        if previous == Some(bounds) && !clip_changed {
            return Ok(());
        }
        let size_changed = previous.is_none_or(|old| {
            old.right - old.left != bounds.right - bounds.left
                || old.bottom - old.top != bounds.bottom - bounds.top
        });
        let insert_after = self.label.unwrap_or(HWND_TOP);
        if let Some(label) = self.label {
            // A standard EDIT takes its accessible name from the preceding STATIC.
            if unsafe { GetWindow(self.hwnd, GW_HWNDPREV) }.ok() != Some(label) {
                layout.raise_label(label);
            }
        }
        layout.show(self.hwnd, insert_after, bounds);
        layout.controls.push(ControlPlacement {
            control: self,
            bounds,
            clip,
            clip_changed,
            size_changed,
        });
        Ok(())
    }

    fn set_clip(&self, clip: Option<RECT>) -> Result<()> {
        unsafe {
            let region =
                clip.map(|rect| CreateRectRgn(rect.left, rect.top, rect.right, rect.bottom));
            if region.is_some_and(|region| region.is_invalid()) {
                return Err(Error::from_thread());
            }
            if SetWindowRgn(self.hwnd, region, false) == 0 {
                let error = Error::from_thread();
                if let Some(region) = region {
                    let _ = DeleteObject(region.into());
                }
                return Err(error);
            }
        }
        self.clip.set(clip);
        Ok(())
    }

    fn repaint(&self) -> Result<()> {
        // USER32 may leave newly exposed pixels in a layered surface unpainted.
        unsafe {
            RedrawWindow(
                Some(self.hwnd),
                None,
                None,
                RDW_INVALIDATE | RDW_ERASE | RDW_FRAME | RDW_UPDATENOW,
            )
            .ok()
        }
    }

    pub fn hide(&self) {
        self.bounds.set(None);
        let _ = unsafe { ShowWindow(self.hwnd, SW_HIDE) };
    }
}

impl Drop for NativeControl {
    fn drop(&mut self) {
        unsafe {
            let _ = DestroyWindow(self.hwnd);
            if let Some(label) = self.label {
                let _ = DestroyWindow(label);
            }
        }
    }
}

fn wide(text: &str) -> Result<Vec<u16>> {
    if text.contains('\0') {
        return Err(Error::from_hresult(E_INVALIDARG));
    }
    Ok(text.encode_utf16().chain([0]).collect())
}
