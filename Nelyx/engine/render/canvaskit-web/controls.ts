// SPDX-License-Identifier: BSD-3-Clause
import type { CanvasKit, Canvas } from 'canvaskit-wasm';
import type { ControlSnapshot } from '../../../runtime/engine-client/codec.ts';
import { protocol as p } from '../../../runtime/engine-client/schema.ts';
export function paintControl(
  ck: CanvasKit,
  canvas: Canvas,
  c: ControlSnapshot,
  width: number,
  height: number,
  opacity: number,
): void {
  const paint = new ck.Paint();
  paint.setAntiAlias(true);
  const color = (argb: number) => {
    paint.setColor(
      ck.Color(
        (argb >>> 16) & 255,
        (argb >>> 8) & 255,
        argb & 255,
        ((argb >>> 24) / 255) * opacity * (c.disabled ? 0.4 : 1),
      ),
    );
  };
  const round = (x: number, y: number, w: number, h: number, r: number, argb: number) => {
    color(argb);
    canvas.drawRRect(ck.RRectXY(ck.XYWHRect(x, y, Math.max(0, w), Math.max(0, h)), r, r), paint);
  };
  const circle = (x: number, y: number, r: number, argb: number) => {
    color(argb);
    canvas.drawCircle(x, y, Math.max(0, r), paint);
  };
  const value = Math.max(0, Math.min(1, (c.value - c.minimum) / (c.maximum - c.minimum))),
    cy = height / 2;
  try {
    if (c.kind === p.controlKinds.button) {
      if (c.appearance === 3) round(0, 3, width, height, Math.min(12, cy), 0x33000000);
      if (c.appearance === 1) {
        paint.setStyle(ck.PaintStyle.Stroke);
        paint.setStrokeWidth(1.5);
      }
      if (c.appearance !== 2) round(0, 0, width, height, Math.min(12, cy), c.foreground);
      paint.setStyle(ck.PaintStyle.Fill);
      if (c.pressed || c.hovered)
        round(0, 0, width, height, Math.min(12, cy), c.pressed ? 0x33000000 : 0x14000000);
    } else if (c.kind === p.controlKinds.toggle && c.appearance === 4)
      round(0, 0, width, height, Math.min(12, cy), value > 0 ? c.foreground : 0xff79747e);
    else if (c.kind === p.controlKinds.toggle) {
      const h = Math.min(32, height),
        w = Math.min(56, width),
        x = (width - w) / 2,
        y = (height - h) / 2;
      round(x, y, w, h, h / 2, value > 0 ? c.foreground : c.track);
      circle(x + h / 2 + (w - h) * value, cy, h * 0.375, 0xffffffff);
    } else if (c.kind === p.controlKinds.radio) {
      circle(width / 2, cy, Math.min(width, height) * 0.45, c.track);
      if (value > 0) circle(width / 2, cy, Math.min(width, height) * 0.28, c.foreground);
    } else if (c.kind === p.controlKinds.checkbox) {
      const size = Math.min(width, height) * 0.8,
        x = (width - size) / 2,
        y = (height - size) / 2;
      round(x, y, size, size, 3, value > 0 ? c.foreground : c.track);
      if (value > 0) {
        color(0xffffffff);
        paint.setStrokeWidth(2);
        canvas.drawLine(x + size * 0.2, y + size * 0.5, x + size * 0.43, y + size * 0.75, paint);
        canvas.drawLine(x + size * 0.43, y + size * 0.75, x + size * 0.85, y + size * 0.25, paint);
      }
    } else if (c.kind === p.controlKinds.circularProgress || c.kind === p.controlKinds.activity) {
      color(c.foreground);
      paint.setStyle(ck.PaintStyle.Stroke);
      paint.setStrokeWidth(3);
      const radius = Math.max(0, Math.min(width, height) / 2 - 3);
      canvas.drawArc(
        ck.XYWHRect(width / 2 - radius, cy - radius, radius * 2, radius * 2),
        c.kind === p.controlKinds.activity ? value * 360 : -90,
        c.kind === p.controlKinds.activity ? 240 : value * 360,
        false,
        paint,
      );
    } else {
      const r = 6,
        span = Math.max(0, width - 2 * r),
        x = r + span * value;
      round(r, cy - 2, span, 4, 2, c.track);
      if (c.kind === p.controlKinds.rangeSlider) {
        const second = Math.max(
            value,
            Math.min(1, (c.second - c.minimum) / (c.maximum - c.minimum)),
          ),
          right = r + span * second;
        round(x, cy - 2, right - x, 4, 2, c.foreground);
        circle(right, cy, c.pressed ? 9 : 7, c.foreground);
      } else round(r, cy - 2, Math.max(0, x - r), 4, 2, c.foreground);
      if (c.kind !== p.controlKinds.progress) circle(x, cy, c.pressed ? 9 : 7, c.foreground);
    }
  } finally {
    paint.delete();
  }
}
