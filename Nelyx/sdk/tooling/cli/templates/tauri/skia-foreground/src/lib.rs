// SPDX-License-Identifier: BSD-3-Clause
//! Native replay for the shape-only platform-view foreground.
use skia_safe::{
    surfaces, AlphaType, Canvas, Color, ColorSpace, ColorType, ImageInfo, Paint, RRect, Rect,
    Surface, Vector,
};

#[cfg(any(target_os = "macos", target_os = "ios"))]
pub mod metal;
#[cfg(windows)]
pub mod win32;
#[cfg(windows)]
mod win32_control_events;
#[cfg(windows)]
mod win32_pointer;

const HEADER: usize = 104;
const RECORD: usize = 72;
const MAX_RECORDS: usize = 4096;
const MAX_SAVES: usize = 32;
const MAX_SAFE_INTEGER: f64 = 9_007_199_254_740_991.0;
const MAX_PIXELS: u64 = 16_777_216;
const SKIA_COORDINATE_LIMIT: f64 = 16_777_216.0;
pub const FOREGROUND_WIRE_VERSION: u32 = 1;
pub const SUPPLY_MANIFEST: &str = include_str!("../supply.json");

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct FrameKey {
    pub owner_generation: u64,
    pub sequence: u64,
    pub viewport_generation: u64,
    pub renderer_generation: u64,
    pub context_generation: u64,
    pub surface_generation: u64,
}

#[derive(Debug, Eq, PartialEq)]
pub enum FrameError {
    Packet,
    Generation,
    Dimensions,
    CanvasState,
    Unsupported(u32),
    Surface,
}

enum Command {
    Clear,
    Save,
    Restore,
    Translate(f32, f32),
    Clip(Rect, bool),
    Rect(Rect, Paint),
    RoundRect(RRect, Paint),
    Line((f32, f32), (f32, f32), Paint),
}

pub struct ForegroundFrame {
    #[cfg(windows)]
    key: FrameKey,
    commands: Vec<Command>,
    size: (i32, i32),
    scale: f32,
}

fn u32_at(bytes: &[u8], index: usize) -> u32 {
    u32::from_le_bytes(bytes[index..index + 4].try_into().unwrap())
}

fn f64_at(bytes: &[u8], index: usize) -> f64 {
    f64::from_le_bytes(bytes[index..index + 8].try_into().unwrap())
}

fn exact_integer(value: f64, min: f64) -> Option<u64> {
    (value >= min && value <= MAX_SAFE_INTEGER && value.fract() == 0.0).then_some(value as u64)
}

fn bounds(v: &[f32; 6]) -> Result<Rect, FrameError> {
    if v[2] < 0.0 || v[3] < 0.0 {
        return Err(FrameError::Packet);
    }
    Ok(Rect::from_xywh(v[0], v[1], v[2], v[3]))
}

fn coordinates(row: &[u8]) -> Result<[f32; 6], FrameError> {
    if u32_at(row, 12) != 0 || f64_at(row, 16) != 0.0 {
        return Err(FrameError::Packet);
    }
    let mut values = [0.0; 6];
    for (index, target) in values.iter_mut().enumerate() {
        let value = f64_at(row, 24 + 8 * index);
        if !value.is_finite() || value.abs() > SKIA_COORDINATE_LIMIT {
            return Err(FrameError::Packet);
        }
        *target = value as f32;
    }
    Ok(values)
}

fn round_rect(head: [f32; 6], tail: &[u8]) -> Result<RRect, FrameError> {
    if u32_at(tail, 0) != 26 || u32_at(tail, 4) != 0 || u32_at(tail, 8) != 0 {
        return Err(FrameError::Packet);
    }
    let [left, top, right, bottom, upper_left_x, upper_left_y] = head;
    let [upper_right_x, upper_right_y, lower_right_x, lower_right_y, lower_left_x, lower_left_y] =
        coordinates(tail)?;
    let radii = [
        Vector::new(upper_left_x, upper_left_y),
        Vector::new(upper_right_x, upper_right_y),
        Vector::new(lower_right_x, lower_right_y),
        Vector::new(lower_left_x, lower_left_y),
    ];
    if right < left || bottom < top || radii.iter().any(|radius| radius.x < 0.0 || radius.y < 0.0) {
        return Err(FrameError::Packet);
    }
    Ok(RRect::new_rect_radii(
        Rect::new(left, top, right, bottom),
        &radii,
    ))
}

fn paint(color: u32, flags: u32, values: [f32; 6]) -> Result<Paint, FrameError> {
    use skia_safe::paint::{Cap, Join, Style};
    // Web wire uses the pinned Flutter blend order. SrcOver is slot 3.
    if flags >> 6 != 3 || values[0] < 0.0 || values[1] < 0.0 {
        return Err(FrameError::Unsupported(10));
    }
    let mut paint = Paint::default();
    paint.set_color(Color::new(color));
    paint.set_anti_alias(flags & 32 != 0);
    paint.set_style(if flags & 1 == 0 {
        Style::Fill
    } else {
        Style::Stroke
    });
    paint.set_stroke_cap(match (flags >> 1) & 3 {
        0 => Cap::Butt,
        1 => Cap::Round,
        2 => Cap::Square,
        _ => return Err(FrameError::Packet),
    });
    paint.set_stroke_join(match (flags >> 3) & 3 {
        0 => Join::Miter,
        1 => Join::Round,
        2 => Join::Bevel,
        _ => return Err(FrameError::Packet),
    });
    paint.set_stroke_width(values[0]);
    paint.set_stroke_miter(values[1]);
    Ok(paint)
}

impl ForegroundFrame {
    /// Consume Web frame wire v1. Window identity and the expected background
    /// token come from the embedding, independently of these bytes.
    pub fn decode(bytes: &[u8], expected: FrameKey) -> Result<Self, FrameError> {
        if bytes.len() < HEADER || bytes.len() > HEADER + MAX_RECORDS * RECORD {
            return Err(FrameError::Packet);
        }
        let count = u32_at(bytes, 12) as usize;
        if u32_at(bytes, 0) != 0x574c5a4e
            || u32_at(bytes, 4) != FOREGROUND_WIRE_VERSION
            || u32_at(bytes, 8) as usize != bytes.len()
            || count == 0
            || count > MAX_RECORDS
            || HEADER + count * RECORD != bytes.len()
        {
            return Err(FrameError::Packet);
        }
        let fields = [
            expected.owner_generation,
            expected.sequence,
            expected.viewport_generation,
            expected.renderer_generation,
            expected.context_generation,
            expected.surface_generation,
        ];
        for (index, value) in fields.into_iter().enumerate() {
            let min = if index < 4 { 1.0 } else { 0.0 };
            if exact_integer(f64_at(bytes, 16 + 8 * index), min) != Some(value) {
                return Err(FrameError::Generation);
            }
        }
        let width = exact_integer(f64_at(bytes, 64), 1.0).ok_or(FrameError::Dimensions)?;
        let height = exact_integer(f64_at(bytes, 72), 1.0).ok_or(FrameError::Dimensions)?;
        let scale = f64_at(bytes, 96);
        if width > 16_384
            || height > 16_384
            || width * height > MAX_PIXELS
            || !(scale > 0.0 && scale <= 64.0)
            || ![80, 88].into_iter().all(|offset| {
                let value = f64_at(bytes, offset);
                value > 0.0 && value <= SKIA_COORDINATE_LIMIT
            })
        {
            return Err(FrameError::Dimensions);
        }
        let mut commands = Vec::with_capacity(count);
        let mut style = None;
        let mut depth = 0;
        let mut records = bytes[HEADER..].chunks_exact(RECORD).enumerate();
        while let Some((index, row)) = records.next() {
            let op = u32_at(row, 0);
            let color = u32_at(row, 4);
            let flags = u32_at(row, 8);
            if matches!(op, 8 | 9 | 31 | 33 | 35) {
                return Err(FrameError::Unsupported(op));
            }
            let values = coordinates(row)?;
            if index == 0 && op != 1 {
                return Err(FrameError::CanvasState);
            }
            let painted = matches!(op, 11 | 12 | 14 | 24);
            if (op != 10 && painted != style.is_some()) || (op == 10 && style.is_some()) {
                return Err(FrameError::Unsupported(op));
            }
            let command = match op {
                1 if index == 0 && color == 0 && flags == 0 => Command::Clear,
                2 if flags == 0 && depth < MAX_SAVES => {
                    depth += 1;
                    Command::Save
                }
                3 if flags == 0 && depth > 0 => {
                    depth -= 1;
                    Command::Restore
                }
                1..=3 => return Err(FrameError::CanvasState),
                4 if [24, 32, 40, 48].map(|offset| f64_at(row, offset)) == [1.0, 0.0, 0.0, 1.0]
                    && flags == 0 =>
                {
                    Command::Translate(values[4], values[5])
                }
                5 if flags == 0 => Command::Clip(bounds(&values)?, false),
                6 | 7 if flags == 0 => {
                    let mut paint = Paint::default();
                    paint.set_color(Color::new(color));
                    paint.set_anti_alias(true);
                    let rect = bounds(&values)?;
                    if op == 7 {
                        let radius = values[4];
                        if radius < 0.0 {
                            return Err(FrameError::Packet);
                        }
                        Command::RoundRect(RRect::new_rect_xy(rect, radius, radius), paint)
                    } else {
                        Command::Rect(rect, paint)
                    }
                }
                10 => {
                    style = Some(paint(color, flags, values)?);
                    continue;
                }
                11 if flags == 0 => Command::Rect(bounds(&values)?, style.take().unwrap()),
                12 if flags == 0 && values[4] >= 0.0 => Command::RoundRect(
                    RRect::new_rect_xy(bounds(&values)?, values[4], values[4]),
                    style.take().unwrap(),
                ),
                14 if flags == 0 => Command::Line(
                    (values[0], values[1]),
                    (values[2], values[3]),
                    style.take().unwrap(),
                ),
                16 if flags <= 1 => Command::Clip(bounds(&values)?, flags != 0),
                24 if flags == 0 => {
                    let (_, tail) = records.next().ok_or(FrameError::Packet)?;
                    Command::RoundRect(round_rect(values, tail)?, style.take().unwrap())
                }
                _ => return Err(FrameError::Unsupported(op)),
            };
            commands.push(command);
        }
        if depth != 0 || style.is_some() {
            return Err(FrameError::CanvasState);
        }
        Ok(Self {
            #[cfg(windows)]
            key: expected,
            size: (width as i32, height as i32),
            scale: scale as f32,
            commands,
        })
    }

    pub fn rasterize(&self) -> Result<Surface, FrameError> {
        self.rasterize_as(ColorType::BGRA8888, (0, 0), self.size)
    }

    pub fn matches_dimensions(&self, width: i32, height: i32, scale: f64) -> bool {
        self.size == (width, height) && self.scale == scale as f32
    }

    #[cfg(target_os = "android")]
    pub fn android_pixels(
        &self,
        width: i32,
        height: i32,
        scale: f64,
    ) -> Result<Vec<u8>, FrameError> {
        if !self.matches_dimensions(width, height, scale) {
            return Err(FrameError::Dimensions);
        }
        let mut surface = self.rasterize_as(ColorType::RGBA8888, (0, 0), self.size)?;
        let pixels = surface.peek_pixels().ok_or(FrameError::Surface)?;
        if pixels.row_bytes() != width as usize * 4 {
            return Err(FrameError::Surface);
        }
        Ok(pixels.bytes().ok_or(FrameError::Surface)?.to_vec())
    }

    fn rasterize_as(
        &self,
        color_type: ColorType,
        origin: (i32, i32),
        size: (i32, i32),
    ) -> Result<Surface, FrameError> {
        let info = ImageInfo::new(size, color_type, AlphaType::Premul, ColorSpace::new_srgb());
        let mut surface = surfaces::raster(&info, None, None).ok_or(FrameError::Surface)?;
        let canvas = surface.canvas();
        canvas.translate((-origin.0 as f32, -origin.1 as f32));
        self.replay(canvas);
        Ok(surface)
    }

    fn replay(&self, canvas: &Canvas) {
        canvas.save();
        canvas.scale((self.scale, self.scale));
        for command in &self.commands {
            match command {
                Command::Clear => {
                    canvas.clear(Color::TRANSPARENT);
                }
                Command::Save => {
                    canvas.save();
                }
                Command::Restore => {
                    canvas.restore();
                }
                Command::Translate(x, y) => {
                    canvas.translate((*x, *y));
                }
                Command::Clip(rect, antialias) => {
                    canvas.clip_rect(rect, None, *antialias);
                }
                Command::Rect(rect, paint) => {
                    canvas.draw_rect(rect, paint);
                }
                Command::RoundRect(rect, paint) => {
                    canvas.draw_rrect(rect, paint);
                }
                Command::Line(from, to, paint) => {
                    canvas.draw_line(*from, *to, paint);
                }
            }
        }
        canvas.restore();
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const KEY: FrameKey = FrameKey {
        owner_generation: 0x1_0000_0001,
        sequence: 0x1_0000_0002,
        viewport_generation: 3,
        renderer_generation: 4,
        context_generation: 5,
        surface_generation: 6,
    };

    fn packet(records: &[(u32, u32, u32, &[f64])]) -> Vec<u8> {
        packet_with_key(KEY, records)
    }

    fn packet_with_key(key: FrameKey, records: &[(u32, u32, u32, &[f64])]) -> Vec<u8> {
        let length = HEADER + records.len() * RECORD;
        let mut packet = vec![0; length];
        for (index, value) in [0x574c5a4e, 1, length as u32, records.len() as u32]
            .into_iter()
            .enumerate()
        {
            packet[4 * index..4 * index + 4].copy_from_slice(&value.to_le_bytes());
        }
        let header = [
            key.owner_generation as f64,
            key.sequence as f64,
            key.viewport_generation as f64,
            key.renderer_generation as f64,
            key.context_generation as f64,
            key.surface_generation as f64,
            32.0,
            32.0,
            32.0,
            32.0,
            1.0,
        ];
        for (index, value) in header.into_iter().enumerate() {
            let at = 16 + 8 * index;
            packet[at..at + 8].copy_from_slice(&value.to_le_bytes());
        }
        for ((op, color, flag, values), row) in records
            .iter()
            .zip(packet[HEADER..].chunks_exact_mut(RECORD))
        {
            row[0..4].copy_from_slice(&op.to_le_bytes());
            row[4..8].copy_from_slice(&color.to_le_bytes());
            row[8..12].copy_from_slice(&flag.to_le_bytes());
            for (index, value) in values.iter().enumerate() {
                let at = 24 + index * 8;
                row[at..at + 8].copy_from_slice(&value.to_le_bytes());
            }
        }
        packet
    }

    #[test]
    fn replays_alpha_clips_and_lines_into_premultiplied_skia_pixels() {
        let bytes = packet(&[
            (1, 0, 0, &[]),
            (2, 0, 0, &[]),
            (4, 0, 0, &[1.0, 0.0, 0.0, 1.0, 5.0, 5.0]),
            (16, 0, 0, &[0.0, 0.0, 15.0, 15.0]),
            (6, 0x80402010, 0, &[1.0, 1.0, 20.0, 20.0]),
            (10, 0xffffffff, 3 << 6, &[2.0, 4.0]),
            (14, 0, 0, &[1.0, 3.0, 13.0, 3.0]),
            (3, 0, 0, &[]),
        ]);
        let mut surface = ForegroundFrame::decode(&bytes, KEY)
            .unwrap()
            .rasterize()
            .unwrap();
        let pixels = surface.peek_pixels().unwrap();
        assert_eq!(pixels.get_color((7, 13)), Color::new(0x80402010));
        assert_eq!(pixels.get_color((7, 8)), Color::WHITE);
        assert_eq!(pixels.get_color((20, 14)), Color::TRANSPARENT);
        let frame = ForegroundFrame::decode(&bytes, KEY).unwrap();
        let mut cropped = frame
            .rasterize_as(ColorType::BGRA8888, (6, 7), (14, 12))
            .unwrap();
        let crop = cropped.peek_pixels().unwrap();
        for y in 0..12 {
            for x in 0..14 {
                assert_eq!(crop.get_color((x, y)), pixels.get_color((x + 6, y + 7)));
            }
        }
    }

    #[test]
    fn replays_a_rounded_scrollbar_and_checks_its_continuation_record() {
        let head: &[f64] = &[4.0, 4.0, 12.0, 28.0, 4.0, 4.0];
        let radii: &[f64] = &[4.0, 4.0, 4.0, 4.0, 4.0, 4.0];
        let records = [
            (1, 0, 0, &[][..]),
            (10, 0x80402010, (3 << 6) | 32, &[]),
            (24, 0, 0, head),
            (26, 0, 0, radii),
        ];
        let mut surface = ForegroundFrame::decode(&packet(&records), KEY)
            .unwrap()
            .rasterize()
            .unwrap();
        let pixels = surface.peek_pixels().unwrap();
        assert_eq!(pixels.get_color((8, 16)), Color::new(0x80402010));
        assert_eq!(pixels.get_color((4, 4)), Color::TRANSPARENT);
        assert_eq!(
            ForegroundFrame::decode(&packet(&records[..3]), KEY).err(),
            Some(FrameError::Packet),
        );
    }

    #[test]
    fn rejects_malformed_stale_and_unsupported_frames() {
        let mut bytes = packet(&[(1, 0, 0, &[]), (6, 0xffffffff, 0, &[0.0, 0.0, 2.0, 2.0])]);
        let stale = FrameKey {
            sequence: KEY.sequence + 1,
            ..KEY
        };
        assert_eq!(
            ForegroundFrame::decode(&bytes, stale).err(),
            Some(FrameError::Generation)
        );
        assert_eq!(
            ForegroundFrame::decode(&bytes[..bytes.len() - 1], KEY).err(),
            Some(FrameError::Packet)
        );
        bytes[HEADER + RECORD + 24..HEADER + RECORD + 32].copy_from_slice(&f64::NAN.to_le_bytes());
        assert_eq!(
            ForegroundFrame::decode(&bytes, KEY).err(),
            Some(FrameError::Packet)
        );
        assert_eq!(
            ForegroundFrame::decode(&packet(&[(1, 0, 0, &[]), (3, 0, 0, &[])]), KEY).err(),
            Some(FrameError::CanvasState),
        );
        assert_eq!(
            ForegroundFrame::decode(&packet(&[(1, 0, 0, &[]), (35, 0, 0, &[])]), KEY).err(),
            Some(FrameError::Unsupported(35)),
        );
    }

    #[cfg(windows)]
    #[test]
    fn moves_native_siblings_and_retires_the_foreground_window() {
        use crate::win32::{
            ChildWindowLayout, CompositionForeground, ControlType, NativeControl, NativeHitRegion,
            NativePointerKind,
        };
        use std::{cell::RefCell, rc::Rc};
        use windows::core::w;
        use windows::Win32::{
            Foundation::{HWND, LPARAM, POINT, RECT},
            Graphics::Gdi::{GetWindowRgnBox, RGN_ERROR, SIMPLEREGION},
            UI::WindowsAndMessaging::{
                CreateWindowExW, DestroyWindow, GetClassNameW, GetParent, GetWindow, GetWindowRect,
                GetWindowTextW, IsWindow, SendMessageW, GW_HWNDNEXT, WM_LBUTTONDOWN, WM_LBUTTONUP,
                WM_MOUSEMOVE, WS_POPUP,
            },
        };

        struct Parent(HWND);
        impl Drop for Parent {
            fn drop(&mut self) {
                let _ = unsafe { DestroyWindow(self.0) };
            }
        }
        let parent = Parent(unsafe {
            CreateWindowExW(
                Default::default(),
                w!("STATIC"),
                w!("Nelyx Skia test"),
                WS_POPUP,
                0,
                0,
                64,
                64,
                None,
                None,
                None,
                None,
            )
            .unwrap()
        });
        let editor = NativeControl::new(parent.0, ControlType::Editor, "한글", false).unwrap();
        let button = NativeControl::new(parent.0, ControlType::Button, "Test", false).unwrap();
        let mut class = [0; 16];
        let len = unsafe { GetClassNameW(editor.hwnd(), &mut class) };
        assert_eq!(
            String::from_utf16_lossy(&class[..len as usize]).to_uppercase(),
            "EDIT"
        );
        assert_eq!(unsafe { GetParent(editor.hwnd()) }.unwrap(), parent.0);
        assert_eq!(unsafe { GetParent(button.hwnd()) }.unwrap(), parent.0);
        let bounds = RECT {
            left: 4,
            top: 4,
            right: 36,
            bottom: 36,
        };
        editor
            .place(
                bounds,
                RECT {
                    right: 24,
                    ..bounds
                },
            )
            .unwrap();
        let handle = editor.hwnd();
        let mut clip = RECT::default();
        assert_eq!(unsafe { GetWindowRgnBox(handle, &mut clip) }, SIMPLEREGION);
        assert_eq!(
            clip,
            RECT {
                left: 0,
                top: 0,
                right: 20,
                bottom: 32
            }
        );
        editor.hide();
        editor.place(bounds, bounds).unwrap();
        assert_eq!(unsafe { GetWindowRgnBox(handle, &mut clip) }, RGN_ERROR);
        let mut positioned = RECT::default();
        unsafe { GetWindowRect(handle, &mut positioned) }.unwrap();
        assert_eq!(
            positioned.right - positioned.left,
            bounds.right - bounds.left
        );
        let mut text = [0; 8];
        let len = unsafe { GetWindowTextW(handle, &mut text) };
        assert_eq!(String::from_utf16_lossy(&text[..len as usize]), "한글");
        let mut foreground = CompositionForeground::new(parent.0).unwrap();
        let bytes = packet(&[(1, 0, 0, &[]), (6, 0x80ff0000, 0, &[0.0, 0.0, 12.0, 12.0])]);
        let frame = ForegroundFrame::decode(&bytes, KEY).unwrap();
        let prepared = foreground
            .prepare(&frame, POINT { x: 4, y: 4 }, bounds)
            .unwrap()
            .unwrap();
        assert!(foreground.needs_commit());
        let surface = foreground.hwnd().unwrap();
        assert_eq!(unsafe { GetParent(surface) }.unwrap(), parent.0);
        let mut layout = ChildWindowLayout::default();
        foreground.queue_frame(&mut layout, &prepared);
        layout.apply().unwrap();
        let mut cropped = RECT::default();
        unsafe { GetWindowRect(surface, &mut cropped) }.unwrap();
        assert_eq!(
            (cropped.right - cropped.left, cropped.bottom - cropped.top),
            (12, 12)
        );
        foreground.present(prepared).unwrap();
        assert!(foreground
            .prepare(&frame, POINT { x: 4, y: 4 }, bounds)
            .is_err());
        for (sequence, color, needs_commit) in [
            (KEY.sequence + 1, 0x80ff0000, false),
            (KEY.sequence + 2, 0x800000ff, true),
        ] {
            let key = FrameKey { sequence, ..KEY };
            let bytes = packet_with_key(
                key,
                &[(1, 0, 0, &[]), (6, color, 0, &[0.0, 0.0, 12.0, 12.0])],
            );
            let frame = ForegroundFrame::decode(&bytes, key).unwrap();
            let prepared = foreground
                .prepare(&frame, POINT { x: 5, y: 5 }, bounds)
                .unwrap()
                .unwrap();
            assert_eq!(foreground.needs_commit(), needs_commit);
            let mut layout = ChildWindowLayout::default();
            foreground.queue_frame(&mut layout, &prepared);
            layout.apply().unwrap();
            foreground.present(prepared).unwrap();
        }
        let events = Rc::new(RefCell::new(Vec::new()));
        let recorded = Rc::clone(&events);
        let hit = NativeHitRegion::new(parent.0, move |event| {
            recorded
                .borrow_mut()
                .push((event.kind, event.position.x, event.position.y));
        })
        .unwrap();
        let moved = RECT {
            left: 6,
            top: 9,
            right: 38,
            bottom: 41,
        };
        let mut layout = ChildWindowLayout::default();
        editor
            .queue(&mut layout, moved, RECT { right: 26, ..moved })
            .unwrap();
        foreground.queue_shift(&mut layout, POINT { x: 1, y: 4 });
        hit.queue(&mut layout, moved).unwrap();
        layout.apply().unwrap();
        assert_eq!(unsafe { GetWindowRgnBox(handle, &mut clip) }, SIMPLEREGION);
        assert_eq!(clip.right, 20);
        let mut host = RECT::default();
        unsafe { GetWindowRect(parent.0, &mut host) }.unwrap();
        for hwnd in [editor.hwnd(), surface, hit.hwnd()] {
            let mut rect = RECT::default();
            unsafe { GetWindowRect(hwnd, &mut rect) }.unwrap();
            assert_eq!(
                (rect.left - host.left, rect.top - host.top),
                (moved.left, moved.top)
            );
        }
        assert_eq!(
            unsafe { GetWindow(hit.hwnd(), GW_HWNDNEXT) }.unwrap(),
            surface
        );
        foreground.hide().unwrap();
        foreground.wait_for_commit().unwrap();
        assert!(!unsafe { IsWindow(Some(surface)) }.as_bool());
        let send = |message| unsafe {
            SendMessageW(hit.hwnd(), message, None, Some(LPARAM((7 << 16) | 5)))
        };
        send(WM_LBUTTONDOWN);
        send(WM_MOUSEMOVE);
        hit.hide();
        send(WM_LBUTTONUP);
        assert_eq!(
            *events.borrow(),
            [
                (NativePointerKind::Down, 11, 16),
                (NativePointerKind::Move, 11, 16),
                (NativePointerKind::Cancel, 11, 16),
            ],
        );
        drop(hit);
        drop(foreground);
        let hwnd = editor.hwnd();
        drop(editor);
        assert!(!unsafe { IsWindow(Some(hwnd)) }.as_bool());
    }
}
