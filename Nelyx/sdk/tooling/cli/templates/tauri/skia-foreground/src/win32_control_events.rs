// SPDX-License-Identifier: BSD-3-Clause
use std::{
    cell::RefCell,
    collections::HashMap,
    panic::{catch_unwind, AssertUnwindSafe},
    rc::Rc,
};

use windows::{
    core::{Error, Result},
    Win32::{
        Foundation::{HWND, LPARAM, LRESULT, WPARAM},
        UI::{
            Input::KeyboardAndMouse::{GetKeyState, VK_SHIFT, VK_TAB},
            Shell::{DefSubclassProc, RemoveWindowSubclass, SetWindowSubclass},
            WindowsAndMessaging::{
                GetWindowTextLengthW, GetWindowTextW, BN_CLICKED, EN_CHANGE, WM_CHAR, WM_COMMAND,
                WM_KEYDOWN, WM_NCDESTROY,
            },
        },
    },
};

use crate::win32::{ControlType, NativeControl};

pub enum NativeControlEvent {
    Input(String),
    Click,
    Tab { backwards: bool },
}

struct Observers {
    controls: RefCell<HashMap<usize, (u64, ControlType)>>,
    callback: Box<dyn Fn(u64, NativeControlEvent)>,
}

/// Listen only for notifications from the controls owned by this view host.
pub struct NativeControlEvents {
    parent: HWND,
    state: Rc<Observers>,
}

impl NativeControlEvents {
    pub fn attach(
        parent: HWND,
        callback: impl Fn(u64, NativeControlEvent) + 'static,
    ) -> Result<Self> {
        let state = Rc::new(Observers {
            controls: RefCell::new(HashMap::new()),
            callback: Box::new(callback),
        });
        let registered = unsafe {
            SetWindowSubclass(parent, Some(command_proc), 1, Rc::as_ptr(&state) as usize)
        };
        if !registered.as_bool() {
            return Err(Error::from_thread());
        }
        Ok(Self { parent, state })
    }

    pub fn watch(&self, control: &NativeControl, id: u64, kind: ControlType) -> Result<()> {
        let registered = unsafe {
            SetWindowSubclass(
                control.hwnd(),
                Some(tab_proc),
                1,
                Rc::as_ptr(&self.state) as usize,
            )
        };
        if !registered.as_bool() {
            return Err(Error::from_thread());
        }
        self.state
            .controls
            .borrow_mut()
            .insert(control.hwnd().0 as usize, (id, kind));
        Ok(())
    }

    pub fn unwatch(&self, control: &NativeControl) {
        self.state
            .controls
            .borrow_mut()
            .remove(&(control.hwnd().0 as usize));
        let _ = unsafe { RemoveWindowSubclass(control.hwnd(), Some(tab_proc), 1) };
    }
}

impl Drop for NativeControlEvents {
    fn drop(&mut self) {
        for hwnd in self.state.controls.borrow().keys() {
            let _ = unsafe { RemoveWindowSubclass(HWND(*hwnd as *mut _), Some(tab_proc), 1) };
        }
        unsafe {
            let _ = RemoveWindowSubclass(self.parent, Some(command_proc), 1);
        }
    }
}

unsafe extern "system" fn tab_proc(
    hwnd: HWND,
    message: u32,
    wparam: WPARAM,
    lparam: LPARAM,
    id: usize,
    data: usize,
) -> LRESULT {
    if message == WM_NCDESTROY {
        let state = unsafe { &*(data as *const Observers) };
        state.controls.borrow_mut().remove(&(hwnd.0 as usize));
        let _ = unsafe { RemoveWindowSubclass(hwnd, Some(tab_proc), id) };
    } else if wparam.0 == usize::from(VK_TAB.0) {
        if message == WM_CHAR {
            return LRESULT(0);
        }
        if message == WM_KEYDOWN {
            let raw = data as *const Observers;
            let state = unsafe {
                Rc::increment_strong_count(raw);
                Rc::from_raw(raw)
            };
            let instance = state.controls.borrow().get(&(hwnd.0 as usize)).copied();
            if let Some((instance_id, _)) = instance {
                let backwards = unsafe { GetKeyState(i32::from(VK_SHIFT.0)) } < 0;
                let _ = catch_unwind(AssertUnwindSafe(|| {
                    (state.callback)(instance_id, NativeControlEvent::Tab { backwards })
                }));
            }
            return LRESULT(0);
        }
    }
    unsafe { DefSubclassProc(hwnd, message, wparam, lparam) }
}

unsafe extern "system" fn command_proc(
    hwnd: HWND,
    message: u32,
    wparam: WPARAM,
    lparam: LPARAM,
    id: usize,
    data: usize,
) -> LRESULT {
    if message == WM_NCDESTROY {
        let _ = unsafe { RemoveWindowSubclass(hwnd, Some(command_proc), id) };
    } else if message == WM_COMMAND && lparam.0 != 0 {
        let raw = data as *const Observers;
        let state = unsafe {
            Rc::increment_strong_count(raw);
            Rc::from_raw(raw)
        };
        let observed = state.controls.borrow().get(&(lparam.0 as usize)).copied();
        if let Some((instance_id, kind)) = observed {
            let code = (wparam.0 >> 16) as u32 & 0xffff;
            let event = match kind {
                ControlType::Editor if code == EN_CHANGE => {
                    let control = HWND(lparam.0 as *mut _);
                    let length = unsafe { GetWindowTextLengthW(control) } as usize;
                    if length > 65_536 {
                        None
                    } else {
                        let mut text = vec![0; length + 1];
                        let length = unsafe { GetWindowTextW(control, &mut text) } as usize;
                        Some(NativeControlEvent::Input(String::from_utf16_lossy(
                            &text[..length],
                        )))
                    }
                }
                ControlType::Button if code == BN_CLICKED => Some(NativeControlEvent::Click),
                _ => None,
            };
            if let Some(event) = event {
                let _ = catch_unwind(AssertUnwindSafe(|| (state.callback)(instance_id, event)));
            }
        }
    }
    unsafe { DefSubclassProc(hwnd, message, wparam, lparam) }
}
