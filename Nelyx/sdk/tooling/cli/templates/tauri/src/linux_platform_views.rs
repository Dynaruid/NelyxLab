// SPDX-License-Identifier: BSD-3-Clause
use std::{
    cell::{Cell, RefCell},
    collections::HashMap,
    rc::Rc,
};

use gtk::{atk::prelude::AtkObjectExt, cairo, gdk, glib, prelude::*};
use nelyx_skia_foreground::{ForegroundFrame, FrameKey, SUPPLY_MANIFEST};
use serde_json::{json, Value};
use tauri::{
    ipc::{Channel, InvokeBody, JavaScriptChannelId, Request},
    Builder, Manager, Webview, WindowEvent, Wry,
};

use crate::{
    desktop_platform_view_wire::{
        id, parse_frame, pixel, Bounds, Command, ControlEvent, Event, Frame, Owner, Pointer,
        HOST_WIRE_VERSION, MAX_ID, MAX_REGIONS, MAX_VIEWS,
    },
    LINUX_PLATFORM_VIEWS,
};

const EDITOR_TYPE: &str = "nelyx.gtk.edit";
const TEXT_LIMIT: usize = 65_536;

#[derive(Clone, Copy, PartialEq, Eq)]
struct Rect {
    left: i32,
    top: i32,
    right: i32,
    bottom: i32,
}

impl Rect {
    fn width(self) -> i32 {
        self.right - self.left
    }

    fn height(self) -> i32 {
        self.bottom - self.top
    }

    fn intersect(self, other: Self) -> Self {
        Self {
            left: self.left.max(other.left),
            top: self.top.max(other.top),
            right: self.right.min(other.right),
            bottom: self.bottom.min(other.bottom),
        }
    }

    fn visible(self) -> bool {
        self.width() > 0 && self.height() > 0
    }
}

impl Bounds {
    fn gtk_rect(self, origin: [i32; 2], zoom: f64) -> Result<Rect, String> {
        if self.width < 0.0 || self.height < 0.0 {
            return Err("Invalid GTK platform view bounds".into());
        }
        let [x, y] = origin.map(f64::from);
        Ok(Rect {
            left: pixel(x + self.x * zoom)?,
            top: pixel(y + self.y * zoom)?,
            right: pixel(x + (self.x + self.width) * zoom)?,
            bottom: pixel(y + (self.y + self.height) * zoom)?,
        })
    }
}

struct Editor {
    clip: gtk::Layout,
    widget: gtk::TextView,
    syncing: Rc<Cell<bool>>,
}

impl Editor {
    fn new(instance_id: u64, text: &str, events: Channel<Event>) -> Self {
        let clip = gtk::Layout::new(None::<&gtk::Adjustment>, None::<&gtk::Adjustment>);
        clip.set_direction(gtk::TextDirection::Ltr);
        clip.set_halign(gtk::Align::Start);
        clip.set_valign(gtk::Align::Start);
        let widget = gtk::TextView::new();
        widget.set_wrap_mode(gtk::WrapMode::WordChar);
        widget.set_accepts_tab(false);
        widget.set_left_margin(10);
        widget.set_right_margin(10);
        widget.set_top_margin(8);
        if let Some(accessible) = widget.accessible() {
            accessible.set_name("Composited GTK editor");
        }
        let syncing = Rc::new(Cell::new(false));
        if let Some(buffer) = widget.buffer() {
            buffer.set_text(text);
            let syncing = Rc::clone(&syncing);
            let events = events.clone();
            buffer.connect_changed(move |buffer| {
                if !syncing.get() {
                    if let Some(value) = buffer.text(&buffer.start_iter(), &buffer.end_iter(), true)
                    {
                        let _ = events.send(Event::Control(ControlEvent::Input {
                            instance_id,
                            value: value.to_string(),
                        }));
                    }
                }
            });
        }
        widget.connect_key_press_event(move |_, event| {
            let key = event.keyval();
            if !matches!(
                key,
                gdk::keys::constants::Tab | gdk::keys::constants::ISO_Left_Tab
            ) {
                return glib::Propagation::Proceed;
            }
            let backwards = key == gdk::keys::constants::ISO_Left_Tab
                || event.state().contains(gdk::ModifierType::SHIFT_MASK);
            let _ = events.send(Event::Control(ControlEvent::Tab {
                instance_id,
                backwards,
            }));
            glib::Propagation::Stop
        });
        clip.put(&widget, 0, 0);
        widget.show();
        Self {
            clip,
            widget,
            syncing,
        }
    }

    fn set_text(&self, text: &str) {
        if let Some(buffer) = self.widget.buffer() {
            if buffer
                .text(&buffer.start_iter(), &buffer.end_iter(), true)
                .as_deref()
                == Some(text)
            {
                return;
            }
            self.syncing.set(true);
            buffer.set_text(text);
            self.syncing.set(false);
        }
    }

    fn place(&self, bounds: Rect, clip: Rect) {
        if !clip.visible() {
            self.clip.hide();
            return;
        }
        self.widget
            .set_size_request(bounds.width(), bounds.height());
        self.clip.set_size_request(clip.width(), clip.height());
        self.clip
            .set_size(clip.width() as u32, clip.height() as u32);
        self.clip.set_margin_start(clip.left);
        self.clip.set_margin_top(clip.top);
        // Its GDK viewport cuts off both the original editor's drawing and its input windows.
        self.clip
            .move_(&self.widget, bounds.left - clip.left, bounds.top - clip.top);
        self.clip.show();
    }
}

#[derive(Clone, Copy)]
struct PointerFrame {
    key: FrameKey,
    origin: [i32; 2],
    zoom: f64,
}

struct PointerInput {
    frame: Cell<Option<PointerFrame>>,
    pressed: Cell<Option<(f64, f64)>>,
    events: Channel<Event>,
}

impl PointerInput {
    fn send(&self, kind: &'static str, (x, y): (f64, f64)) {
        if let Some(frame) = self.frame.get() {
            let _ = self.events.send(Event::Pointer(Pointer {
                kind,
                sequence: frame.key.sequence,
                viewport_generation: frame.key.viewport_generation,
                x: (x - f64::from(frame.origin[0])) / frame.zoom,
                y: (y - f64::from(frame.origin[1])) / frame.zoom,
            }));
        }
    }

    fn cancel(&self) {
        if let Some(point) = self.pressed.take() {
            self.send("cancel", point);
        }
    }
}

struct HitRegion {
    rect: Rect,
    widget: gtk::EventBox,
}

impl HitRegion {
    fn new(rect: Rect, layer: &gtk::Fixed, input: &Rc<PointerInput>) -> Self {
        let widget = gtk::EventBox::new();
        widget.set_visible_window(false);
        widget.set_size_request(rect.width(), rect.height());
        widget.add_events(
            gdk::EventMask::BUTTON_PRESS_MASK
                | gdk::EventMask::BUTTON_RELEASE_MASK
                | gdk::EventMask::POINTER_MOTION_MASK,
        );
        let to_layer = move |(x, y)| (x + f64::from(rect.left), y + f64::from(rect.top));
        let pointer = Rc::clone(input);
        widget.connect_button_press_event(move |_, event| {
            if event.button() == 1
                && event.event_type() == gdk::EventType::ButtonPress
                && pointer.pressed.get().is_none()
            {
                let point = to_layer(event.position());
                pointer.pressed.set(Some(point));
                pointer.send("down", point);
            }
            glib::Propagation::Stop
        });
        let pointer = Rc::clone(input);
        widget.connect_motion_notify_event(move |_, event| {
            let point = to_layer(event.position());
            if pointer.pressed.get().is_some() {
                pointer.pressed.set(Some(point));
                pointer.send("move", point);
            } else {
                pointer.send("hover", point);
            }
            glib::Propagation::Stop
        });
        let pointer = Rc::clone(input);
        widget.connect_button_release_event(move |_, event| {
            if event.button() == 1 && pointer.pressed.take().is_some() {
                pointer.send("up", to_layer(event.position()));
            }
            glib::Propagation::Stop
        });
        let pointer = Rc::clone(input);
        widget.connect_grab_broken_event(move |_, _| {
            pointer.cancel();
            glib::Propagation::Proceed
        });
        layer.put(&widget, rect.left, rect.top);
        widget.show();
        Self { rect, widget }
    }
}

struct Foreground {
    origin: [i32; 2],
    surface: cairo::ImageSurface,
}

impl Foreground {
    fn new(
        frame: &Frame,
        key: FrameKey,
        commands: &[u8],
        origin: [i32; 2],
        device_scale: f64,
    ) -> Result<Self, String> {
        let drawing = ForegroundFrame::decode(commands, key)
            .map_err(|error| format!("Unsupported native foreground: {error:?}"))?;
        if !drawing.matches_dimensions(frame.width, frame.height, frame.scale) {
            return Err("The native drawing and GTK placement dimensions differ".into());
        }
        let mut skia = drawing
            .rasterize()
            .map_err(|error| format!("Skia raster: {error:?}"))?;
        let pixels = skia
            .peek_pixels()
            .ok_or("Could not read the Skia surface")?;
        let bytes = pixels.bytes().ok_or("Skia did not expose BGRA pixels")?;
        // On the supplied Linux targets Cairo ARGB32 uses premultiplied BGRA in memory.
        let surface = cairo::ImageSurface::create_for_data(
            bytes.to_vec(),
            cairo::Format::ARgb32,
            frame.width,
            frame.height,
            pixels.row_bytes() as i32,
        )
        .map_err(text_error)?;
        surface.set_device_scale(device_scale, device_scale);
        Ok(Self { origin, surface })
    }
}

struct Host {
    webview: gtk::Widget,
    overlay: gtk::Overlay,
    drawing: gtk::DrawingArea,
    foreground: Rc<RefCell<Option<Foreground>>>,
    input: gtk::Fixed,
}

impl Host {
    fn attach(webview: gtk::Widget) -> Result<Self, String> {
        let parent = webview
            .parent()
            .and_downcast::<gtk::Box>()
            .ok_or("The Linux WebView requires Tauri's GTK box parent")?;
        let (expand, fill, padding, side) = parent.query_child_packing(&webview);
        let position = parent.child_position(&webview);
        let had_focus = webview.is_focus();
        let overlay = gtk::Overlay::new();
        parent.remove(&webview);
        overlay.add(&webview);
        parent.pack_start(&overlay, expand, fill, padding);
        parent.set_child_packing(&overlay, expand, fill, padding, side);
        parent.set_child_position(&overlay, position);

        let drawing = gtk::DrawingArea::new();
        drawing.set_app_paintable(true);
        // GtkOverlay marks its child window; GtkDrawingArea also owns a GDK window.
        drawing.connect_realize(|widget| {
            if let Some(window) = widget.window() {
                window.set_pass_through(true);
            }
        });
        let foreground = Rc::new(RefCell::new(None::<Foreground>));
        let picture = Rc::clone(&foreground);
        drawing.connect_draw(move |_, context| {
            if let Some(image) = picture.borrow().as_ref() {
                let [x, y] = image.origin.map(f64::from);
                if context.set_source_surface(&image.surface, x, y).is_ok() {
                    let _ = context.paint();
                }
            }
            glib::Propagation::Stop
        });

        overlay.show();
        if had_focus {
            webview.grab_focus();
        }
        Ok(Self {
            webview,
            overlay,
            drawing,
            foreground,
            input: gtk::Fixed::new(),
        })
    }

    fn attach_editor(&self, editor: &Editor) {
        // GtkOverlay creates each child window on insertion. Insert the drawing
        // and hit windows after the editor to match that stacking order too.
        self.close_layers();
        self.overlay.add_overlay(&editor.clip);
        let layers: [&gtk::Widget; 2] = [self.drawing.upcast_ref(), self.input.upcast_ref()];
        for layer in layers {
            self.overlay.add_overlay(layer);
            self.overlay.set_overlay_pass_through(layer, true);
        }
    }

    fn close_layers(&self) {
        if self.drawing.parent().is_some() {
            self.overlay.remove(&self.input);
            self.overlay.remove(&self.drawing);
        }
    }

    fn draw(&self, foreground: Option<Foreground>) {
        let shown = foreground.is_some();
        self.foreground.replace(foreground);
        self.drawing.set_visible(shown);
        self.drawing.queue_draw();
    }
}

struct Session {
    owner: Owner,
    host: Rc<Host>,
    editors: HashMap<u64, Editor>,
    hits: Vec<HitRegion>,
    pointer: Rc<PointerInput>,
    submitted: Option<FrameKey>,
    hidden_through: u64,
}

impl Session {
    fn replace_hits(&mut self, regions: Vec<Rect>) {
        if self
            .hits
            .iter()
            .map(|hit| hit.rect)
            .eq(regions.iter().copied())
        {
            return;
        }
        self.pointer.cancel();
        for hit in self.hits.drain(..) {
            self.host.input.remove(&hit.widget);
        }
        self.hits = regions
            .into_iter()
            .map(|rect| HitRegion::new(rect, &self.host.input, &self.pointer))
            .collect();
        self.host.input.set_visible(!self.hits.is_empty());
    }

    fn hide(&mut self) {
        self.replace_hits(Vec::new());
        self.pointer.frame.set(None);
        self.host.draw(None);
        for editor in self.editors.values() {
            editor.clip.hide();
        }
    }

    fn close(mut self) {
        self.hide();
        for editor in self.editors.into_values() {
            self.host.overlay.remove(&editor.clip);
        }
        self.host.close_layers();
    }

    fn submit(&mut self, frame: Frame, commands: &[u8]) -> Result<(), String> {
        let result = (|| {
            let key = frame.key()?;
            if !Frame::is_stale(key, self.submitted, self.hidden_through) {
                self.apply(&frame, key, commands)?;
                self.submitted = Some(key);
            }
            Ok(())
        })();
        if result.is_err() {
            self.hide();
        }
        result
    }

    fn apply(&mut self, frame: &Frame, key: FrameKey, commands: &[u8]) -> Result<(), String> {
        if !(frame.scale > 0.0 && frame.scale <= 64.0)
            || !(1..=16_384).contains(&frame.width)
            || !(1..=16_384).contains(&frame.height)
            || frame.placements.len() != 1
            || frame.input.len() > MAX_REGIONS
        {
            return Err("Invalid GTK platform view geometry".into());
        }
        let slot = &frame.placements[0];
        if !self.editors.contains_key(&slot.instance_id) {
            return Err("Unknown GTK platform view".into());
        }
        let device_scale = f64::from(self.host.webview.scale_factor());
        let zoom = frame.scale / device_scale;
        let origin = [
            pixel(frame.origin[0] * zoom)?,
            pixel(frame.origin[1] * zoom)?,
        ];
        let viewport = Rect {
            left: origin[0],
            top: origin[1],
            right: origin[0] + pixel(f64::from(frame.width) / device_scale)?,
            bottom: origin[1] + pixel(f64::from(frame.height) / device_scale)?,
        };
        let parent = Rect {
            left: 0,
            top: 0,
            right: self.host.webview.allocated_width(),
            bottom: self.host.webview.allocated_height(),
        };
        let bounds = slot.bounds.gtk_rect(origin, zoom)?;
        let clip = slot
            .clip
            .gtk_rect(origin, zoom)?
            .intersect(bounds)
            .intersect(viewport)
            .intersect(parent);
        let mut regions = Vec::with_capacity(frame.input.len());
        for hit in &frame.input {
            if hit.instance_id != slot.instance_id {
                return Err("Unknown GTK platform view input target".into());
            }
            let rect = hit.rect.gtk_rect(origin, zoom)?.intersect(clip);
            if rect.visible() && !regions.contains(&rect) {
                regions.push(rect);
            }
        }
        let foreground = (!commands.is_empty())
            .then(|| Foreground::new(frame, key, commands, origin, device_scale))
            .transpose()?;
        self.replace_hits(regions);
        for (id, editor) in &self.editors {
            if *id == slot.instance_id {
                editor.place(bounds, clip);
            } else {
                editor.clip.hide();
            }
        }
        self.host.draw(foreground);
        self.pointer
            .frame
            .set(Some(PointerFrame { key, origin, zoom }));
        Ok(())
    }
}

thread_local! {
    // The WebView keeps one GTK parent across all frontend owners and reloads.
    static HOSTS: RefCell<HashMap<&'static str, Result<Rc<Host>, String>>> = RefCell::new(HashMap::new());
    static SESSIONS: RefCell<HashMap<String, Session>> = RefCell::new(HashMap::new());
}

fn text_error(error: impl std::fmt::Display) -> String {
    error.to_string()
}

fn allowed(webview: &Webview<Wry>) -> Result<(), String> {
    tauri_plugin_nelyx_backend::verify_app_webview(webview).map_err(|error| error.message)?;
    if webview.label() != webview.window().label()
        || !LINUX_PLATFORM_VIEWS.contains(&webview.label())
    {
        return Err("GTK platform views are disabled for this WebView".into());
    }
    Ok(())
}

async fn ui<T: Send + 'static>(
    webview: Webview<Wry>,
    operation: impl FnOnce(&Webview<Wry>) -> Result<T, String> + Send + 'static,
) -> Result<T, String> {
    allowed(&webview)?;
    let (send, mut receive) = tauri::async_runtime::channel(1);
    webview
        .clone()
        .run_on_main_thread(move || {
            let result = allowed(&webview).and_then(|_| operation(&webview));
            let _ = send.try_send(result);
        })
        .map_err(text_error)?;
    receive.recv().await.ok_or("The GTK platform view closed")?
}

#[tauri::command]
async fn linux_platform_view(
    webview: Webview<Wry>,
    request: Command,
    events: Option<String>,
) -> Result<Value, String> {
    ui(webview, move |webview| {
        let label = webview.label();
        let host = HOSTS
            .with_borrow(|hosts| hosts.get(label).cloned())
            .ok_or("The generated GTK host is unavailable")??;
        if matches!(request, Command::Probe) {
            let skia: Value = serde_json::from_str(SUPPLY_MANIFEST).map_err(text_error)?;
            let display = host.webview.display().type_().name();
            return Ok(json!({
                "wireVersion": HOST_WIRE_VERSION, "types": [EDITOR_TYPE], "skia": skia,
                "display": display,
            }));
        }
        SESSIONS.with_borrow_mut(|sessions| {
            let owner = request.owner()?;
            if let Command::Open { owner } = request {
                if sessions.contains_key(label) {
                    return Err("This WebView already owns a GTK view session".into());
                }
                let channel: JavaScriptChannelId =
                    events.ok_or("A GTK event channel is required")?.parse()?;
                sessions.insert(
                    label.to_owned(),
                    Session {
                        owner,
                        host,
                        editors: HashMap::new(),
                        hits: Vec::new(),
                        pointer: Rc::new(PointerInput {
                            frame: Cell::new(None),
                            pressed: Cell::new(None),
                            events: channel.channel_on(webview.clone()),
                        }),
                        submitted: None,
                        hidden_through: 0,
                    },
                );
                return Ok(Value::Null);
            }
            let session = sessions
                .get_mut(label)
                .filter(|session| &session.owner == owner)
                .ok_or("Stale GTK view owner")?;
            match request {
                Command::Create {
                    instance_id,
                    view_type,
                    text,
                    ..
                } => {
                    if !id(instance_id)
                        || view_type != EDITOR_TYPE
                        || text.len() > TEXT_LIMIT
                        || text.contains('\0')
                        || session.editors.len() >= MAX_VIEWS
                        || session.editors.contains_key(&instance_id)
                    {
                        return Err("Invalid GTK editor registration".into());
                    }
                    let editor = Editor::new(instance_id, &text, session.pointer.events.clone());
                    session.pointer.cancel();
                    session.host.attach_editor(&editor);
                    session.editors.insert(instance_id, editor);
                }
                Command::Update {
                    instance_id, text, ..
                } => {
                    if text.len() > TEXT_LIMIT || text.contains('\0') {
                        return Err("Invalid GTK editor text".into());
                    }
                    session
                        .editors
                        .get(&instance_id)
                        .ok_or("Unknown GTK editor")?
                        .set_text(&text);
                }
                Command::Remove { instance_id, .. } => {
                    if let Some(editor) = session.editors.remove(&instance_id) {
                        if editor.clip.is_visible() {
                            session.hide();
                        }
                        session.host.overlay.remove(&editor.clip);
                    }
                }
                Command::Focus { instance_id, .. } => {
                    if let Some(id) = instance_id {
                        let editor = session
                            .editors
                            .get(&id)
                            .filter(|editor| editor.clip.is_mapped())
                            .ok_or("The GTK editor is hidden")?;
                        editor.widget.grab_focus();
                        if !editor.widget.is_focus() {
                            return Err("The GTK editor could not receive focus".into());
                        }
                    } else {
                        session.host.webview.grab_focus();
                    }
                }
                Command::Hide { through, .. } => {
                    if through > MAX_ID {
                        return Err("Invalid GTK view sequence".into());
                    }
                    session.hidden_through = session.hidden_through.max(through);
                    if session.submitted.is_none_or(|key| key.sequence <= through) {
                        session.hide();
                    }
                }
                Command::Close { .. } => {
                    sessions.remove(label).unwrap().close();
                }
                Command::Probe | Command::Open { .. } => unreachable!(),
            }
            Ok(Value::Null)
        })
    })
    .await
}

#[tauri::command]
async fn linux_platform_view_frame(
    webview: Webview<Wry>,
    request: Request<'_>,
) -> Result<(), String> {
    let InvokeBody::Raw(bytes) = request.body() else {
        return Err("Expected a GTK frame packet".into());
    };
    let (frame, commands) = parse_frame(bytes)?;
    let commands = commands.to_vec();
    ui(webview, move |webview| {
        SESSIONS.with_borrow_mut(|sessions| {
            sessions
                .get_mut(webview.label())
                .filter(|session| session.owner == frame.owner)
                .ok_or("Stale GTK frame owner")?
                .submit(frame, &commands)
        })
    })
    .await
}

pub fn register(builder: Builder<Wry>) -> Builder<Wry> {
    builder
        .setup(|app| {
            for &label in LINUX_PLATFORM_VIEWS {
                if let Some(webview) = app.get_webview_window(label) {
                    webview.with_webview(move |platform| {
                        let host = Host::attach(platform.inner().upcast()).map(Rc::new);
                        HOSTS.with_borrow_mut(|hosts| hosts.insert(label, host));
                    })?;
                }
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            linux_platform_view,
            linux_platform_view_frame
        ])
        .on_page_load(|webview, page| {
            if matches!(page.event(), tauri::webview::PageLoadEvent::Started) {
                let session = SESSIONS.with_borrow_mut(|sessions| sessions.remove(webview.label()));
                if let Some(session) = session {
                    session.close();
                }
            }
        })
        .on_window_event(|window, event| match event {
            WindowEvent::Focused(false) => SESSIONS.with_borrow(|sessions| {
                if let Some(session) = sessions.get(window.label()) {
                    session.pointer.cancel();
                }
            }),
            WindowEvent::Destroyed => SESSIONS.with_borrow_mut(|sessions| {
                sessions.remove(window.label());
                HOSTS.with_borrow_mut(|hosts| hosts.remove(window.label()));
            }),
            _ => {}
        })
}
