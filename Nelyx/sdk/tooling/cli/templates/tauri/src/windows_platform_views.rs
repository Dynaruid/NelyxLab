// SPDX-License-Identifier: BSD-3-Clause
use std::{
    cell::{Cell, RefCell},
    collections::HashMap,
    rc::Rc,
};

use nelyx_skia_foreground::{
    win32::{
        ChildWindowLayout, CompositionForeground, ControlType, NativeControl, NativeControlEvent,
        NativeControlEvents, NativeHitRegion, NativePointerKind, PreparedForeground,
    },
    ForegroundFrame, FrameKey, SUPPLY_MANIFEST,
};
use serde_json::{json, Value};
use tauri::{
    ipc::{Channel, InvokeBody, JavaScriptChannelId, Request},
    Builder, PhysicalSize, Webview, WindowEvent, Wry,
};
use windows::Win32::{
    Foundation::{HWND, POINT, RECT},
    UI::WindowsAndMessaging::{GetClientRect, GetWindow, GW_CHILD, GW_HWNDNEXT},
};

use crate::{
    desktop_platform_view_wire::{
        id, parse_frame, pixel, Bounds, Command, ControlEvent, Event, Frame, Owner, Pointer,
        HOST_WIRE_VERSION, MAX_ID, MAX_REGIONS, MAX_VIEWS,
    },
    WINDOWS_PLATFORM_VIEWS,
};

#[derive(Clone, Copy)]
struct PointerFrame {
    sequence: u64,
    viewport_generation: u64,
    origin: POINT,
    scale: f64,
}

struct HitWindow {
    rect: RECT,
    window: NativeHitRegion,
}

struct Placement {
    id: u64,
    bounds: RECT,
    clip: RECT,
}

struct PresentedLayout {
    // The frame's geometry stays in WebView pixels until the next submission.
    pointer: PointerFrame,
    placements: Vec<Placement>,
    regions: Vec<RECT>,
    offset: POINT,
    client: RECT,
}

enum ForegroundPlacement<'a> {
    Frame(&'a PreparedForeground),
    Shift(POINT),
}

struct Session {
    owner: Owner,
    control_events: NativeControlEvents,
    controls: HashMap<u64, NativeControl>,
    foreground: Option<CompositionForeground>,
    hits: Vec<HitWindow>,
    pointer_frame: Rc<Cell<Option<PointerFrame>>>,
    events: Channel<Event>,
    submitted: Option<FrameKey>,
    layout: Option<PresentedLayout>,
    hidden_through: u64,
}

fn text_error(error: impl std::fmt::Display) -> String {
    error.to_string()
}

impl Bounds {
    fn physical(self, origin: POINT, scale: f64) -> Result<RECT, String> {
        if self.width < 0.0 || self.height < 0.0 {
            return Err("Invalid native view bounds".into());
        }
        Ok(RECT {
            left: pixel(self.x * scale + f64::from(origin.x))?,
            top: pixel(self.y * scale + f64::from(origin.y))?,
            right: pixel((self.x + self.width) * scale + f64::from(origin.x))?,
            bottom: pixel((self.y + self.height) * scale + f64::from(origin.y))?,
        })
    }
}

fn intersect(a: RECT, b: RECT) -> RECT {
    RECT {
        left: a.left.max(b.left),
        top: a.top.max(b.top),
        right: a.right.min(b.right),
        bottom: a.bottom.min(b.bottom),
    }
}

fn visible(rect: RECT) -> bool {
    rect.left < rect.right && rect.top < rect.bottom
}

fn translate(rect: RECT, offset: POINT) -> RECT {
    RECT {
        left: rect.left + offset.x,
        top: rect.top + offset.y,
        right: rect.right + offset.x,
        bottom: rect.bottom + offset.y,
    }
}

thread_local! {
    // HWNDs and composition targets are confined to Tauri's UI thread.
    static SESSIONS: RefCell<HashMap<String, Session>> = RefCell::new(HashMap::new());
}

impl Session {
    fn hide(&mut self) {
        self.layout = None;
        self.hits.clear();
        self.pointer_frame.set(None);
        for control in self.controls.values() {
            control.hide();
        }
        if self
            .foreground
            .as_mut()
            .is_some_and(|foreground| foreground.hide().is_err())
        {
            self.foreground = None;
        }
    }

    fn submit(
        &mut self,
        parent: HWND,
        offset: POINT,
        frame: Frame,
        commands: &[u8],
    ) -> Result<(), String> {
        let key = frame.key()?;
        if Frame::is_stale(key, self.submitted, self.hidden_through) {
            return Ok(());
        }
        let result = self.apply(parent, offset, frame, key, commands);
        if result.is_ok() {
            self.submitted = Some(key);
        } else {
            self.hide();
        }
        result
    }

    fn apply(
        &mut self,
        parent: HWND,
        offset: POINT,
        frame: Frame,
        key: FrameKey,
        commands: &[u8],
    ) -> Result<(), String> {
        if !(frame.scale > 0.0 && frame.scale <= 64.0)
            || frame.width <= 0
            || frame.height <= 0
            || frame.placements.len() > MAX_VIEWS
            || frame.input.len() > MAX_REGIONS
        {
            return Err("Invalid native frame geometry".into());
        }
        let origin = POINT {
            x: pixel(frame.origin[0] * frame.scale)?,
            y: pixel(frame.origin[1] * frame.scale)?,
        };
        let mut client = RECT::default();
        unsafe { GetClientRect(parent, &mut client) }.map_err(text_error)?;
        let mut placements: Vec<Placement> = Vec::with_capacity(frame.placements.len());
        for placement in frame.placements {
            if !self.controls.contains_key(&placement.instance_id)
                || placements
                    .iter()
                    .any(|item| item.id == placement.instance_id)
            {
                return Err("Unknown or duplicate native view placement".into());
            }
            let bounds = placement.bounds.physical(origin, frame.scale)?;
            let clip = intersect(placement.clip.physical(origin, frame.scale)?, bounds);
            placements.push(Placement {
                id: placement.instance_id,
                bounds,
                clip,
            });
        }
        let mut regions = Vec::with_capacity(frame.input.len());
        for hit in frame.input {
            let placement = placements
                .iter()
                .find(|placement| placement.id == hit.instance_id)
                .ok_or("Unknown native view input target")?;
            let rect = intersect(hit.rect.physical(origin, frame.scale)?, placement.clip);
            if visible(rect) && !regions.contains(&rect) {
                regions.push(rect);
            }
        }
        let foreground_clip = placements
            .iter()
            .map(|placement| intersect(translate(placement.clip, offset), client))
            .filter(|clip| visible(*clip))
            .reduce(|a, b| RECT {
                left: a.left.min(b.left),
                top: a.top.min(b.top),
                right: a.right.max(b.right),
                bottom: a.bottom.max(b.bottom),
            });
        let foreground = if commands.is_empty() {
            None
        } else {
            let decoded = ForegroundFrame::decode(commands, key)
                .map_err(|error| format!("Unsupported native foreground: {error:?}"))?;
            if !decoded.matches_dimensions(frame.width, frame.height, frame.scale) {
                return Err("The native drawing and window placement dimensions differ".into());
            }
            Some(decoded)
        };
        let prepared = if let Some((decoded, clip)) = foreground.zip(foreground_clip) {
            if self.foreground.is_none() {
                self.foreground = Some(CompositionForeground::new(parent).map_err(text_error)?);
            }
            self.foreground
                .as_mut()
                .unwrap()
                .prepare(
                    &decoded,
                    POINT {
                        x: origin.x + offset.x,
                        y: origin.y + offset.y,
                    },
                    clip,
                )
                .map_err(text_error)?
        } else {
            None
        };
        let layout = PresentedLayout {
            pointer: PointerFrame {
                sequence: key.sequence,
                viewport_generation: key.viewport_generation,
                origin,
                scale: frame.scale,
            },
            placements,
            regions,
            offset,
            client,
        };
        if prepared.is_none() {
            if let Some(foreground) = &mut self.foreground {
                foreground.hide().map_err(text_error)?;
            }
        }
        self.place(
            parent,
            &layout,
            prepared.as_ref().map(ForegroundPlacement::Frame),
            None,
        )?;
        if let Some((foreground, frame)) = self.foreground.as_mut().zip(prepared) {
            // The pixels were uploaded first. Publish them after positioning the siblings.
            foreground.present(frame).map_err(text_error)?;
        }
        self.layout = Some(layout);
        Ok(())
    }

    fn place(
        &mut self,
        parent: HWND,
        layout: &PresentedLayout,
        foreground_placement: Option<ForegroundPlacement<'_>>,
        webview_move: Option<(HWND, RECT, bool)>,
    ) -> Result<(), String> {
        for (id, control) in &self.controls {
            if !layout
                .placements
                .iter()
                .any(|placement| placement.id == *id)
            {
                control.hide();
            }
        }
        let mut windows = ChildWindowLayout::default();
        for placement in &layout.placements {
            let bounds = translate(placement.bounds, layout.offset);
            let clip = intersect(translate(placement.clip, layout.offset), layout.client);
            self.controls[&placement.id]
                .queue(&mut windows, bounds, clip)
                .map_err(text_error)?;
        }
        if let Some((foreground, placement)) = self.foreground.as_ref().zip(foreground_placement) {
            match placement {
                ForegroundPlacement::Frame(frame) => foreground.queue_frame(&mut windows, frame),
                ForegroundPlacement::Shift(delta) => foreground.queue_shift(&mut windows, delta),
            }
        }
        let mut regions = Vec::with_capacity(layout.regions.len());
        for rect in &layout.regions {
            let rect = intersect(translate(*rect, layout.offset), layout.client);
            if visible(rect) && !regions.contains(&rect) {
                regions.push(rect);
            }
        }
        self.hits.truncate(regions.len());
        let raise_hits = !windows.is_empty();
        for (index, rect) in regions.into_iter().enumerate() {
            if let Some(hit) = self.hits.get_mut(index) {
                let moved = hit.rect != rect;
                if moved {
                    hit.window.cancel_pointer();
                    hit.rect = rect;
                }
                if moved || raise_hits {
                    hit.window.queue(&mut windows, rect).map_err(text_error)?;
                }
            } else {
                let events = self.events.clone();
                let presented = Rc::clone(&self.pointer_frame);
                let window = NativeHitRegion::new(parent, move |pointer| {
                    let Some(frame) = presented.get() else {
                        return;
                    };
                    let kind = match pointer.kind {
                        NativePointerKind::Down => "down",
                        NativePointerKind::Move => "move",
                        NativePointerKind::Up => "up",
                        NativePointerKind::Cancel => "cancel",
                        NativePointerKind::Hover => "hover",
                    };
                    let _ = events.send(Event::Pointer(Pointer {
                        kind,
                        sequence: frame.sequence,
                        viewport_generation: frame.viewport_generation,
                        x: f64::from(pointer.position.x - frame.origin.x) / frame.scale,
                        y: f64::from(pointer.position.y - frame.origin.y) / frame.scale,
                    }));
                })
                .map_err(text_error)?;
                window.queue(&mut windows, rect).map_err(text_error)?;
                self.hits.push(HitWindow { rect, window });
            }
        }
        if let Some((webview, bounds, resize)) = webview_move {
            windows.move_webview(webview, bounds, resize);
        }
        windows.apply().map_err(text_error)?;
        self.pointer_frame.set(Some(PointerFrame {
            origin: POINT {
                x: layout.pointer.origin.x + layout.offset.x,
                y: layout.pointer.origin.y + layout.offset.y,
            },
            ..layout.pointer
        }));
        Ok(())
    }

    fn reposition(
        &mut self,
        parent: HWND,
        offset: POINT,
        client: RECT,
        webview_move: Option<(HWND, RECT, bool)>,
    ) -> Result<(), String> {
        let Some(mut layout) = self.layout.take() else {
            return Ok(());
        };
        if layout.offset != offset || layout.client != client || webview_move.is_some() {
            let delta = POINT {
                x: offset.x - layout.offset.x,
                y: offset.y - layout.offset.y,
            };
            layout.offset = offset;
            layout.client = client;
            self.place(
                parent,
                &layout,
                Some(ForegroundPlacement::Shift(delta)),
                webview_move,
            )?;
        }
        self.layout = Some(layout);
        Ok(())
    }
}

pub fn layout_retained_views(
    webview: &Webview<Wry>,
    parent: HWND,
    size: PhysicalSize<u32>,
    webview_move: Option<(HWND, RECT, bool)>,
) -> bool {
    SESSIONS.with(|sessions| {
        let Ok(mut sessions) = sessions.try_borrow_mut() else {
            return false;
        };
        let Some(session) = sessions
            .get_mut(webview.label())
            .filter(|session| session.layout.is_some())
        else {
            return false;
        };
        let offset = match webview_move {
            Some((_, bounds, _)) => POINT {
                x: bounds.left,
                y: bounds.top,
            },
            None => {
                let Ok(position) = webview.position() else {
                    return false;
                };
                POINT {
                    x: position.x,
                    y: position.y,
                }
            }
        };
        let client = RECT {
            right: size.width as i32,
            bottom: size.height as i32,
            ..Default::default()
        };
        if session
            .reposition(parent, offset, client, webview_move)
            .is_err()
        {
            session.hide();
            return false;
        }
        true
    })
}

pub fn can_align_retained_views(webview: &Webview<Wry>, parent: HWND, container: HWND) -> bool {
    SESSIONS.with(|sessions| {
        let Ok(sessions) = sessions.try_borrow() else {
            return false;
        };
        let Some(session) = sessions.get(webview.label()).filter(|s| s.layout.is_some()) else {
            return false;
        };
        let foreground = session
            .foreground
            .as_ref()
            .and_then(CompositionForeground::hwnd);
        let mut next = unsafe { GetWindow(parent, GW_CHILD) };
        let mut has_container = false;
        while let Ok(child) = next {
            if child == container {
                has_container = true;
            } else if foreground != Some(child)
                && !session
                    .controls
                    .values()
                    .any(|control| control.owns_window(child))
                && !session.hits.iter().any(|hit| hit.window.hwnd() == child)
            {
                return false;
            }
            next = unsafe { GetWindow(child, GW_HWNDNEXT) };
        }
        has_container
    })
}

fn grants(webview: &Webview<Wry>) -> Result<&'static [&'static str], String> {
    tauri_plugin_nelyx_backend::verify_app_webview(webview).map_err(|error| error.message)?;
    if webview.label() != webview.window().label() {
        return Err("Windows platform views require the named app WebView".into());
    }
    WINDOWS_PLATFORM_VIEWS
        .iter()
        .find(|(label, _)| *label == webview.label())
        .map(|(_, types)| *types)
        .ok_or_else(|| "Windows platform views are disabled for this WebView".into())
}

async fn ui<T: Send + 'static>(
    webview: Webview<Wry>,
    operation: impl FnOnce(&Webview<Wry>) -> Result<T, String> + Send + 'static,
) -> Result<T, String> {
    grants(&webview)?;
    let (send, mut receive) = tauri::async_runtime::channel(1);
    webview
        .clone()
        .run_on_main_thread(move || {
            let result = grants(&webview).and_then(|_| operation(&webview));
            let _ = send.try_send(result);
        })
        .map_err(text_error)?;
    receive
        .recv()
        .await
        .ok_or("The native view UI thread closed")?
}

#[tauri::command]
async fn windows_platform_view(
    webview: Webview<Wry>,
    request: Command,
    events: Option<String>,
) -> Result<Value, String> {
    ui(webview, move |webview| {
        let types = grants(webview)?;
        if matches!(request, Command::Probe) {
            let skia: Value = serde_json::from_str(SUPPLY_MANIFEST).map_err(text_error)?;
            return Ok(json!({ "wireVersion": HOST_WIRE_VERSION, "types": types, "skia": skia }));
        }
        let parent = webview.window().hwnd().map_err(text_error)?;
        SESSIONS.with_borrow_mut(|sessions| {
            let label = webview.label();
            let owner = request.owner()?;
            if let Command::Open { owner } = request {
                if sessions.contains_key(label) {
                    return Err("This WebView already owns a native view session".into());
                }
                let events: JavaScriptChannelId = events
                    .ok_or("Native view event channel is required")?
                    .parse()?;
                let events: Channel<Event> = events.channel_on(webview.clone());
                let channel = events.clone();
                let control_events =
                    NativeControlEvents::attach(parent, move |instance_id, event| {
                        let event = match event {
                            NativeControlEvent::Input(value) => {
                                ControlEvent::Input { instance_id, value }
                            }
                            NativeControlEvent::Click => ControlEvent::Click { instance_id },
                            NativeControlEvent::Tab { backwards } => ControlEvent::Tab {
                                instance_id,
                                backwards,
                            },
                        };
                        let _ = channel.send(Event::Control(event));
                    })
                    .map_err(text_error)?;
                sessions.insert(
                    label.to_owned(),
                    Session {
                        owner,
                        control_events,
                        controls: HashMap::new(),
                        foreground: None,
                        hits: Vec::new(),
                        pointer_frame: Rc::new(Cell::new(None)),
                        events,
                        submitted: None,
                        layout: None,
                        hidden_through: 0,
                    },
                );
                return Ok(Value::Null);
            }
            let session = sessions
                .get_mut(label)
                .filter(|session| &session.owner == owner)
                .ok_or("Stale native view owner")?;
            match request {
                Command::Create {
                    instance_id,
                    view_type,
                    text,
                    ..
                } => {
                    if !id(instance_id)
                        || session.controls.len() == MAX_VIEWS
                        || session.controls.contains_key(&instance_id)
                        || !types.contains(&view_type.as_str())
                        || text.len() > 65_536
                    {
                        return Err("Invalid native control registration".into());
                    }
                    let kind = match view_type.as_str() {
                        "nelyx.win32.edit" => ControlType::Editor,
                        "nelyx.win32.button" => ControlType::Button,
                        _ => return Err("Unknown native control type".into()),
                    };
                    let mut control =
                        NativeControl::new(parent, kind, &text, true).map_err(text_error)?;
                    if matches!(kind, ControlType::Editor) {
                        control
                            .set_accessible_name("Composited Win32 editor")
                            .map_err(text_error)?;
                    }
                    session
                        .control_events
                        .watch(&control, instance_id, kind)
                        .map_err(text_error)?;
                    session.controls.insert(instance_id, control);
                }
                Command::Update {
                    instance_id, text, ..
                } => {
                    if text.len() > 65_536 {
                        return Err("Native control text is too large".into());
                    }
                    session
                        .controls
                        .get(&instance_id)
                        .ok_or("Unknown native control")?
                        .set_text(&text)
                        .map_err(text_error)?;
                }
                Command::Remove { instance_id, .. } => {
                    if let Some(control) = session.controls.remove(&instance_id) {
                        session.control_events.unwatch(&control);
                        session.hide();
                    }
                    if session.controls.is_empty() {
                        session.foreground = None;
                    }
                }
                Command::Focus { instance_id, .. } => {
                    if let Some(instance_id) = instance_id {
                        let control = session
                            .controls
                            .get(&instance_id)
                            .ok_or("Unknown native control")?;
                        if !control.focus() {
                            return Err("The native control could not receive focus".into());
                        }
                    } else {
                        webview.set_focus().map_err(text_error)?;
                    }
                }
                Command::Hide { through, .. } => {
                    if through > MAX_ID {
                        return Err("Invalid native view sequence".into());
                    }
                    session.hidden_through = session.hidden_through.max(through);
                    if session.submitted.is_none_or(|key| key.sequence <= through) {
                        session.hide();
                    }
                }
                Command::Close { .. } => {
                    sessions.remove(label);
                }
                Command::Probe | Command::Open { .. } => unreachable!(),
            }
            Ok(Value::Null)
        })
    })
    .await
}

#[tauri::command]
async fn windows_platform_view_frame(
    webview: Webview<Wry>,
    request: Request<'_>,
) -> Result<(), String> {
    let InvokeBody::Raw(bytes) = request.body() else {
        return Err("Expected a native frame packet".into());
    };
    let (frame, commands) = parse_frame(bytes)?;
    let commands = commands.to_vec();
    ui(webview, move |webview| {
        let parent = webview.window().hwnd().map_err(text_error)?;
        let offset = webview.position().map_err(text_error)?;
        SESSIONS.with_borrow_mut(|sessions| {
            let session = sessions
                .get_mut(webview.label())
                .filter(|session| session.owner == frame.owner)
                .ok_or("Stale native frame owner")?;
            session.submit(
                parent,
                POINT {
                    x: offset.x,
                    y: offset.y,
                },
                frame,
                &commands,
            )
        })
    })
    .await
}

pub fn register(builder: Builder<Wry>) -> Builder<Wry> {
    builder
        .invoke_handler(tauri::generate_handler![
            windows_platform_view,
            windows_platform_view_frame
        ])
        .on_page_load(|webview, page| {
            if matches!(page.event(), tauri::webview::PageLoadEvent::Started) {
                SESSIONS.with_borrow_mut(|sessions| {
                    sessions.remove(webview.label());
                });
            }
        })
        .on_window_event(|window, event| {
            if matches!(event, WindowEvent::Destroyed) {
                SESSIONS.with_borrow_mut(|sessions| {
                    sessions.remove(window.label());
                });
            }
        })
}
