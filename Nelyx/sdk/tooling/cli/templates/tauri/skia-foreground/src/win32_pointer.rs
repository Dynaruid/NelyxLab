// SPDX-License-Identifier: BSD-3-Clause
use std::{
    cell::Cell,
    panic::{catch_unwind, AssertUnwindSafe},
    rc::Rc,
};

use windows::{
    core::{w, Error, Result},
    Win32::{
        Foundation::{E_INVALIDARG, HWND, LPARAM, LRESULT, POINT, RECT, WPARAM},
        Graphics::Gdi::{MapWindowPoints, ValidateRect},
        System::LibraryLoader::GetModuleHandleW,
        UI::{
            Input::KeyboardAndMouse::{GetCapture, ReleaseCapture, SetCapture},
            Shell::{DefSubclassProc, RemoveWindowSubclass, SetWindowSubclass},
            WindowsAndMessaging::{
                CreateWindowExW, DestroyWindow, ShowWindow, HTCLIENT, HWND_TOP, MA_NOACTIVATE,
                SW_HIDE, WM_CANCELMODE, WM_CAPTURECHANGED, WM_ERASEBKGND, WM_LBUTTONDOWN,
                WM_LBUTTONUP, WM_MOUSEACTIVATE, WM_MOUSEMOVE, WM_NCDESTROY, WM_NCHITTEST, WM_PAINT,
                WS_CHILD, WS_EX_NOACTIVATE, WS_EX_TRANSPARENT,
            },
        },
    },
};

use crate::win32::ChildWindowLayout;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum NativePointerKind {
    Down,
    Move,
    Up,
    Cancel,
    Hover,
}

#[derive(Clone, Copy, Debug)]
pub struct NativePointer {
    pub kind: NativePointerKind,
    /// Physical coordinates in the parent client area.
    pub position: POINT,
}

struct PointerState {
    parent: HWND,
    pressed: Cell<bool>,
    last: Cell<POINT>,
    callback: Box<dyn Fn(NativePointer)>,
}

impl PointerState {
    fn emit(&self, kind: NativePointerKind) {
        let pointer = NativePointer {
            kind,
            position: self.last.get(),
        };
        let _ = catch_unwind(AssertUnwindSafe(|| (self.callback)(pointer)));
    }

    fn cancel(&self, hwnd: HWND) {
        if self.pressed.replace(false) {
            if unsafe { GetCapture() } == hwnd {
                let _ = unsafe { ReleaseCapture() };
            }
            self.emit(NativePointerKind::Cancel);
        }
    }
}

/// Pixel-transparent pointer input for one rectangular foreground control.
/// The window and its capture belong to the same UI thread as the parent.
pub struct NativeHitRegion {
    hwnd: HWND,
    state: Rc<PointerState>,
}

impl NativeHitRegion {
    pub fn new(parent: HWND, callback: impl Fn(NativePointer) + 'static) -> Result<Self> {
        let state = Rc::new(PointerState {
            parent,
            pressed: Cell::new(false),
            last: Cell::new(POINT::default()),
            callback: Box::new(callback),
        });
        unsafe {
            let module = GetModuleHandleW(None)?;
            let hwnd = CreateWindowExW(
                WS_EX_NOACTIVATE | WS_EX_TRANSPARENT,
                w!("STATIC"),
                w!(""),
                WS_CHILD,
                0,
                0,
                0,
                0,
                Some(parent),
                None,
                Some(module.into()),
                None,
            )?;
            if !SetWindowSubclass(hwnd, Some(pointer_proc), 1, Rc::as_ptr(&state) as usize)
                .as_bool()
            {
                let error = Error::from_thread();
                let _ = DestroyWindow(hwnd);
                return Err(error);
            }
            Ok(Self { hwnd, state })
        }
    }

    pub fn hwnd(&self) -> HWND {
        self.hwnd
    }

    pub fn place(&self, rect: RECT) -> Result<()> {
        let mut layout = ChildWindowLayout::default();
        self.queue(&mut layout, rect)?;
        layout.apply()
    }

    pub fn queue(&self, layout: &mut ChildWindowLayout<'_>, rect: RECT) -> Result<()> {
        let width = rect
            .right
            .checked_sub(rect.left)
            .ok_or_else(|| Error::from_hresult(E_INVALIDARG))?;
        let height = rect
            .bottom
            .checked_sub(rect.top)
            .ok_or_else(|| Error::from_hresult(E_INVALIDARG))?;
        if width <= 0 || height <= 0 {
            self.hide();
            return Ok(());
        }
        layout.show(self.hwnd, HWND_TOP, rect);
        Ok(())
    }

    pub fn cancel_pointer(&self) {
        self.state.cancel(self.hwnd);
    }

    pub fn hide(&self) {
        self.cancel_pointer();
        let _ = unsafe { ShowWindow(self.hwnd, SW_HIDE) };
    }
}

impl Drop for NativeHitRegion {
    fn drop(&mut self) {
        self.cancel_pointer();
        let _ = unsafe { DestroyWindow(self.hwnd) };
    }
}

unsafe extern "system" fn pointer_proc(
    hwnd: HWND,
    message: u32,
    wparam: WPARAM,
    lparam: LPARAM,
    subclass: usize,
    data: usize,
) -> LRESULT {
    let raw = data as *const PointerState;
    // Application callbacks may remove the hit region from the parent.
    Rc::increment_strong_count(raw);
    let state = Rc::from_raw(raw);
    match message {
        WM_NCHITTEST => return LRESULT(HTCLIENT as isize),
        WM_MOUSEACTIVATE => return LRESULT(MA_NOACTIVATE as isize),
        WM_ERASEBKGND => return LRESULT(1),
        WM_PAINT => {
            let _ = ValidateRect(Some(hwnd), None);
            return LRESULT(0);
        }
        WM_LBUTTONDOWN | WM_MOUSEMOVE | WM_LBUTTONUP => {
            let mut points = [POINT {
                x: (lparam.0 as u16 as i16) as i32,
                y: ((lparam.0 >> 16) as u16 as i16) as i32,
            }];
            MapWindowPoints(Some(hwnd), Some(state.parent), &mut points);
            state.last.set(points[0]);
            if message == WM_LBUTTONDOWN && !state.pressed.replace(true) {
                SetCapture(hwnd);
                state.emit(NativePointerKind::Down);
            } else if message == WM_MOUSEMOVE {
                state.emit(if state.pressed.get() {
                    NativePointerKind::Move
                } else {
                    NativePointerKind::Hover
                });
            } else if message == WM_LBUTTONUP && state.pressed.replace(false) {
                if GetCapture() == hwnd {
                    let _ = ReleaseCapture();
                }
                state.emit(NativePointerKind::Up);
            }
            return LRESULT(0);
        }
        WM_CAPTURECHANGED | WM_CANCELMODE => state.cancel(hwnd),
        WM_NCDESTROY => {
            state.cancel(hwnd);
            let _ = RemoveWindowSubclass(hwnd, Some(pointer_proc), subclass);
        }
        _ => {}
    }
    DefSubclassProc(hwnd, message, wparam, lparam)
}
