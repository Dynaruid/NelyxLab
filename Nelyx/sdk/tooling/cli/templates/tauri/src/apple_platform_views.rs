// SPDX-License-Identifier: BSD-3-Clause
use std::{
    borrow::Cow,
    cell::{Cell, RefCell},
    collections::HashMap,
    rc::Rc,
};

use nelyx_skia_foreground::{metal::MetalForeground, ForegroundFrame, FrameKey, SUPPLY_MANIFEST};
use objc2::{rc::Retained, MainThreadMarker};
use objc2_core_foundation::{CGPoint, CGRect, CGSize};
use objc2_foundation::{NSRange, NSString};
use serde_json::{json, Value};
use tauri::{
    ipc::{Channel, InvokeBody, JavaScriptChannelId, Request},
    Builder, Webview, WindowEvent, Wry,
};

use crate::{
    desktop_platform_view_wire::{
        id, parse_frame, pixel, Bounds, Command, ControlEvent, Event, Frame, Owner, Pointer,
        HOST_WIRE_VERSION, MAX_ID, MAX_REGIONS, MAX_VIEWS,
    },
    APPLE_PLATFORM_VIEWS,
};

#[cfg(target_os = "ios")]
#[path = "apple_platform_views_ios.rs"]
mod native;
#[cfg(target_os = "macos")]
#[path = "apple_platform_views_macos.rs"]
mod native;
use native::{Editor, View};

const EDITOR: &str = "nelyx.apple.edit";
const TEXT_LIMIT: usize = 65_536;

#[derive(Clone, Copy, PartialEq, Eq)]
struct Rect {
    left: i32,
    top: i32,
    right: i32,
    bottom: i32,
}

impl Rect {
    fn viewport(right: i32, bottom: i32) -> Self {
        Self {
            left: 0,
            top: 0,
            right,
            bottom,
        }
    }

    fn size(self) -> (i32, i32) {
        (self.right - self.left, self.bottom - self.top)
    }

    fn points(self, relative_to: [i32; 2], scale: f64) -> CGRect {
        let (width, height) = self.size();
        CGRect::new(
            CGPoint::new(
                f64::from(self.left - relative_to[0]) / scale,
                f64::from(self.top - relative_to[1]) / scale,
            ),
            CGSize::new(f64::from(width) / scale, f64::from(height) / scale),
        )
    }

    fn origin(self) -> [i32; 2] {
        [self.left, self.top]
    }

    fn intersect(self, other: Self) -> Self {
        Self {
            left: self.left.max(other.left),
            top: self.top.max(other.top),
            right: self.right.min(other.right),
            bottom: self.bottom.min(other.bottom),
        }
    }

    fn union(self, other: Self) -> Self {
        Self {
            left: self.left.min(other.left),
            top: self.top.min(other.top),
            right: self.right.max(other.right),
            bottom: self.bottom.max(other.bottom),
        }
    }

    fn visible(self) -> bool {
        self.right > self.left && self.bottom > self.top
    }
}

impl Bounds {
    fn apple_rect(self, origin: [i32; 2], scale: f64) -> Result<Rect, String> {
        if self.width < 0.0 || self.height < 0.0 {
            return Err("Invalid Apple platform view bounds".into());
        }
        let [x, y] = origin.map(f64::from);
        Ok(Rect {
            left: pixel(x + self.x * scale)?,
            top: pixel(y + self.y * scale)?,
            right: pixel(x + (self.x + self.width) * scale)?,
            bottom: pixel(y + (self.y + self.height) * scale)?,
        })
    }
}

struct EditEvents {
    channel: Channel<Event>,
    instance: u64,
    updating: Cell<bool>,
}

impl EditEvents {
    fn input(&self, text: &NSString) {
        if !self.updating.get() {
            let _ = self.channel.send(Event::Control(ControlEvent::Input {
                instance_id: self.instance,
                value: text.to_string(),
            }));
        }
    }

    fn tab(&self, backwards: bool) {
        let _ = self.channel.send(Event::Control(ControlEvent::Tab {
            instance_id: self.instance,
            backwards,
        }));
    }
}

fn clamp_selection(selection: NSRange, length: usize) -> NSRange {
    let start = selection.location.min(length);
    NSRange::new(start, selection.length.min(length - start))
}

#[derive(Clone, Copy)]
struct PointerCoordinates {
    key: FrameKey,
    origin: [i32; 2],
    rect: Rect,
    backing: f64,
    scale: f64,
}

struct PointerInput {
    channel: Channel<Event>,
    coordinates: Cell<PointerCoordinates>,
    active_device: Cell<Option<&'static str>>,
    point: Cell<CGPoint>,
}

impl PointerInput {
    fn update(&self, coordinates: PointerCoordinates) {
        let old = self.coordinates.get();
        if old.rect != coordinates.rect
            || old.key.viewport_generation != coordinates.key.viewport_generation
            || old.key.renderer_generation != coordinates.key.renderer_generation
            || old.backing != coordinates.backing
        {
            self.cancel();
        }
        self.coordinates.set(coordinates);
    }

    fn send(&self, kind: &'static str, point: CGPoint, device: &'static str) {
        let coordinates = self.coordinates.get();
        let [x, y] = coordinates.origin;
        let _ = self.channel.send(Event::Pointer(Pointer {
            kind,
            sequence: coordinates.key.sequence,
            viewport_generation: coordinates.key.viewport_generation,
            x: (point.x * coordinates.backing + f64::from(coordinates.rect.left - x))
                / coordinates.scale,
            y: (point.y * coordinates.backing + f64::from(coordinates.rect.top - y))
                / coordinates.scale,
            device,
        }));
    }

    fn down(&self, point: CGPoint, device: &'static str) {
        if self.active_device.get().is_none() {
            self.active_device.set(Some(device));
            self.point.set(point);
            self.send("down", point, device);
        }
    }

    fn moved(&self, point: CGPoint) {
        if let Some(device) = self.active_device.get() {
            self.point.set(point);
            self.send("move", point, device);
        }
    }

    fn up(&self, point: CGPoint) {
        if let Some(device) = self.active_device.take() {
            self.send("up", point, device);
        }
    }

    fn cancel(&self) {
        if let Some(device) = self.active_device.take() {
            self.send("cancel", self.point.get(), device);
        }
    }
}

struct HitWindow {
    view: Retained<View>,
    input: Rc<PointerInput>,
}

impl Drop for HitWindow {
    fn drop(&mut self) {
        self.input.cancel();
        self.view.removeFromSuperview();
    }
}

struct Foreground {
    view: Retained<View>,
    metal: MetalForeground,
}

impl Drop for Foreground {
    fn drop(&mut self) {
        self.view.removeFromSuperview();
    }
}

struct Session {
    owner: Owner,
    webview: Retained<View>,
    root: Retained<View>,
    editors: Retained<View>,
    hits: Vec<HitWindow>,
    controls: HashMap<u64, Editor>,
    foreground: Option<Foreground>,
    channel: Channel<Event>,
    submitted: Option<FrameKey>,
    hidden_through: u64,
    main_thread: MainThreadMarker,
}

impl Session {
    fn new(
        owner: Owner,
        webview: Retained<View>,
        channel: Channel<Event>,
        main_thread: MainThreadMarker,
    ) -> Result<Self, String> {
        let root = native::container(main_thread);
        let editors = native::container(main_thread);
        root.setHidden(true);
        root.addSubview(&editors);
        native::attach(&root, &webview)?;
        Ok(Self {
            owner,
            webview,
            root,
            editors,
            channel,
            main_thread,
            controls: HashMap::new(),
            hits: Vec::new(),
            foreground: None,
            submitted: None,
            hidden_through: 0,
        })
    }

    fn hide(&mut self) {
        self.hits.clear();
        self.foreground = None;
        for control in self.controls.values() {
            control.hide();
        }
        self.root.setHidden(true);
    }

    fn submit(&mut self, frame: Frame, commands: &[u8]) -> Result<(), String> {
        let key = frame.key()?;
        if Frame::is_stale(key, self.submitted, self.hidden_through) {
            return Ok(());
        }
        let result = self.place(frame, key, commands);
        match result {
            Ok(()) => self.submitted = Some(key),
            Err(_) => self.hide(),
        }
        result
    }

    fn place(&mut self, frame: Frame, key: FrameKey, commands: &[u8]) -> Result<(), String> {
        if !(frame.scale > 0.0 && frame.scale <= 64.0)
            || !(1..=65_536).contains(&frame.width)
            || !(1..=65_536).contains(&frame.height)
            || frame.placements.len() > MAX_VIEWS
            || frame.input.len() > MAX_REGIONS
        {
            return Err("Invalid Apple platform view geometry".into());
        }
        let scale = frame.scale;
        let origin = [
            pixel(frame.origin[0] * scale)?,
            pixel(frame.origin[1] * scale)?,
        ];
        let frame_rect = Rect {
            left: origin[0],
            top: origin[1],
            right: origin[0] + frame.width,
            bottom: origin[1] + frame.height,
        };
        let backing = native::scale(&self.webview)?;
        let bounds = native::attach(&self.root, &self.webview)?;
        self.editors
            .setFrame(CGRect::new(CGPoint::ZERO, bounds.size));
        let viewport = Rect::viewport(
            pixel(bounds.size.width * backing)?,
            pixel(bounds.size.height * backing)?,
        )
        .intersect(frame_rect);
        let mut placements = Vec::with_capacity(frame.placements.len());
        for item in frame.placements {
            if !self.controls.contains_key(&item.instance_id)
                || placements.iter().any(|(id, _, _)| *id == item.instance_id)
            {
                return Err("Unknown or duplicate Apple platform view placement".into());
            }
            let bounds = item.bounds.apple_rect(origin, scale)?;
            let clip = item
                .clip
                .apple_rect(origin, scale)?
                .intersect(bounds)
                .intersect(viewport);
            placements.push((item.instance_id, bounds, clip));
        }
        let mut regions = Vec::with_capacity(frame.input.len());
        for hit in frame.input {
            let (_, _, clip) = placements
                .iter()
                .find(|(id, _, _)| *id == hit.instance_id)
                .ok_or("Unknown Apple platform view input target")?;
            let rect = hit.rect.apple_rect(origin, scale)?.intersect(*clip);
            if rect.visible() && !regions.contains(&rect) {
                regions.push(rect);
            }
        }
        let crop = placements
            .iter()
            .map(|(_, _, clip)| *clip)
            .filter(|clip| clip.visible())
            .reduce(Rect::union);
        let drawing = if commands.is_empty() {
            None
        } else {
            let decoded = ForegroundFrame::decode(commands, key)
                .map_err(|error| format!("Unsupported Apple foreground drawing: {error:?}"))?;
            if !decoded.matches_dimensions(frame.width, frame.height, scale) {
                return Err("The Apple foreground and placement sizes differ".into());
            }
            Some(decoded)
        };
        let Some(crop) = crop else {
            self.hide();
            return Ok(());
        };
        self.root.setHidden(false);
        for (&id, editor) in &self.controls {
            if let Some((_, bounds, clip)) = placements
                .iter()
                .find(|item| item.0 == id && item.2.visible())
            {
                editor.place(
                    clip.points([0, 0], backing),
                    bounds.points(clip.origin(), backing),
                    scale / backing,
                );
            } else {
                editor.hide();
            }
        }
        if let Some(drawing) = drawing {
            if self.foreground.is_none() {
                let (view, layer) = native::foreground(self.main_thread)?;
                let metal = MetalForeground::new(layer, self.main_thread)?;
                self.root.addSubview(&view);
                self.foreground = Some(Foreground { view, metal });
            }
            let foreground = self.foreground.as_mut().unwrap();
            foreground.view.setFrame(crop.points([0, 0], backing));
            foreground.metal.present(
                &drawing,
                (crop.left - origin[0], crop.top - origin[1]),
                crop.size(),
                backing,
            )?;
        } else {
            self.foreground = None;
        }
        self.hits.truncate(regions.len());
        for (index, rect) in regions.into_iter().enumerate() {
            let coordinates = PointerCoordinates {
                key,
                rect,
                origin,
                scale,
                backing,
            };
            let native_rect = rect.points([0, 0], backing);
            if let Some(hit) = self.hits.get(index) {
                hit.input.update(coordinates);
                hit.view.setFrame(native_rect);
            } else {
                let input = Rc::new(PointerInput {
                    channel: self.channel.clone(),
                    coordinates: Cell::new(coordinates),
                    active_device: Cell::new(None),
                    point: Cell::new(CGPoint::ZERO),
                });
                let view = native::hit(Rc::clone(&input), native_rect, self.main_thread);
                self.root.addSubview(&view);
                self.hits.push(HitWindow { view, input });
            }
        }
        Ok(())
    }
}

impl Drop for Session {
    fn drop(&mut self) {
        self.hide();
        self.root.removeFromSuperview();
    }
}

thread_local! {
    static SESSIONS: RefCell<HashMap<String, Session>> = RefCell::new(HashMap::new());
}

fn text_error(error: impl std::fmt::Display) -> String {
    error.to_string()
}

fn allowed(webview: &Webview<Wry>) -> Result<(), String> {
    tauri_plugin_nelyx_backend::verify_app_webview(webview).map_err(|error| error.message)?;
    if webview.label() != webview.window().label()
        || !APPLE_PLATFORM_VIEWS.contains(&webview.label())
    {
        return Err("This WebView cannot create Apple platform views".into());
    }
    Ok(())
}

async fn ui<T: Send + 'static>(
    webview: Webview<Wry>,
    operation: impl FnOnce(&Webview<Wry>, Retained<View>, MainThreadMarker) -> Result<T, String>
        + Send
        + 'static,
) -> Result<T, String> {
    let (send, mut receive) = tauri::async_runtime::channel(1);
    let view = webview.clone();
    webview
        .with_webview(move |native| {
            let result = (|| {
                allowed(&view)?;
                let main_thread = MainThreadMarker::new()
                    .ok_or("Apple platform views require the main thread")?;
                // Wry's WKWebView is respectively a UIView or NSView. Stay on its UI thread.
                let webkit = unsafe { Retained::retain(native.inner().cast::<View>()) }
                    .ok_or("WKWebView is unavailable")?;
                operation(&view, webkit, main_thread)
            })();
            let _ = send.try_send(result);
        })
        .map_err(text_error)?;
    receive
        .recv()
        .await
        .ok_or_else(|| "The Apple platform view UI thread closed".to_owned())?
}

#[tauri::command]
async fn apple_platform_view(
    webview: Webview<Wry>,
    request: Command,
    events: Option<String>,
) -> Result<Value, String> {
    ui(webview, move |webview, webkit, main_thread| {
        if matches!(request, Command::Probe) {
            let skia: Value = serde_json::from_str(SUPPLY_MANIFEST).map_err(text_error)?;
            return Ok(
                json!({ "wireVersion": HOST_WIRE_VERSION, "types": [EDITOR], "skia": skia }),
            );
        }
        let label = webview.label();
        SESSIONS.with_borrow_mut(|sessions| {
            if matches!(request, Command::Open { .. }) {
                request.owner()?;
                if sessions.contains_key(label) {
                    return Err("This WebView already owns a native view session".into());
                }
                let channel: JavaScriptChannelId = events
                    .ok_or("Native view event channel is required")?
                    .parse()?;
                let Command::Open { owner } = request else {
                    unreachable!()
                };
                sessions.insert(
                    label.to_owned(),
                    Session::new(
                        owner,
                        webkit,
                        channel.channel_on(webview.clone()),
                        main_thread,
                    )?,
                );
                return Ok(Value::Null);
            }
            let owner = request.owner()?;
            let session = sessions
                .get_mut(label)
                .filter(|session| &session.owner == owner)
                .ok_or("Stale native frame owner")?;
            match request {
                Command::Create {
                    instance_id,
                    view_type,
                    text,
                    ..
                } => {
                    if !id(instance_id)
                        || view_type != EDITOR
                        || text.len() > TEXT_LIMIT
                        || session.controls.len() == MAX_VIEWS
                        || session.controls.contains_key(&instance_id)
                    {
                        return Err("Invalid Apple platform view registration".into());
                    }
                    let editor = Editor::new(
                        EditEvents {
                            channel: session.channel.clone(),
                            instance: instance_id,
                            updating: Cell::new(false),
                        },
                        &session.root,
                        &text,
                        main_thread,
                    );
                    session.editors.addSubview(editor.container());
                    session.controls.insert(instance_id, editor);
                }
                Command::Update {
                    instance_id, text, ..
                } => {
                    if text.len() > TEXT_LIMIT {
                        return Err("Native control text is too large".into());
                    }
                    session
                        .controls
                        .get(&instance_id)
                        .ok_or("Unknown Apple platform view")?
                        .set_text(&text);
                }
                Command::Remove { instance_id, .. } => {
                    if session.controls.remove(&instance_id).is_some() {
                        session.hide();
                    }
                }
                Command::Focus { instance_id, .. } => {
                    if let Some(instance_id) = instance_id {
                        session
                            .controls
                            .get(&instance_id)
                            .ok_or("Unknown Apple platform view")?
                            .focus()?;
                    } else {
                        for control in session.controls.values() {
                            control.release_focus();
                        }
                        #[cfg(target_os = "macos")]
                        webview.set_focus().map_err(text_error)?;
                        #[cfg(target_os = "ios")]
                        {
                            let _ = session.webview.becomeFirstResponder();
                        }
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
                Command::Open { .. } | Command::Probe => unreachable!(),
            }
            Ok(Value::Null)
        })
    })
    .await
}

#[tauri::command]
async fn apple_platform_view_frame(
    webview: Webview<Wry>,
    request: Request<'_>,
) -> Result<(), String> {
    let bytes = match request.body() {
        InvokeBody::Raw(bytes) => Cow::Borrowed(bytes.as_slice()),
        // WKWebView's postMessage IPC fallback serializes a Uint8Array as JSON.
        InvokeBody::Json(Value::Array(values)) if values.len() <= 384 * 1024 => Cow::Owned(
            values
                .iter()
                .map(|value| {
                    value
                        .as_u64()
                        .and_then(|byte| u8::try_from(byte).ok())
                        .ok_or("Invalid native frame byte")
                })
                .collect::<Result<Vec<_>, _>>()?,
        ),
        _ => return Err("Expected a native frame packet".into()),
    };
    let (frame, commands) = parse_frame(&bytes)?;
    let commands = commands.to_vec();
    ui(webview, move |webview, _, _| {
        SESSIONS.with_borrow_mut(|sessions| {
            sessions
                .get_mut(webview.label())
                .filter(|session| session.owner == frame.owner)
                .ok_or("Stale native frame owner")?
                .submit(frame, &commands)
        })
    })
    .await
}

pub fn register(builder: Builder<Wry>) -> Builder<Wry> {
    builder
        .invoke_handler(tauri::generate_handler![
            apple_platform_view,
            apple_platform_view_frame
        ])
        .on_page_load(|webview, page| {
            if matches!(page.event(), tauri::webview::PageLoadEvent::Started) {
                SESSIONS.with_borrow_mut(|sessions| {
                    sessions.remove(webview.label());
                });
            }
        })
        .on_window_event(|window, event| match event {
            WindowEvent::Destroyed => SESSIONS.with_borrow_mut(|sessions| {
                sessions.remove(window.label());
            }),
            WindowEvent::Focused(false) => SESSIONS.with_borrow(|sessions| {
                if let Some(session) = sessions.get(window.label()) {
                    for hit in &session.hits {
                        hit.input.cancel();
                    }
                }
            }),
            _ => {}
        })
}
