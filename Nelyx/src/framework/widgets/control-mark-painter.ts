// SPDX-License-Identifier: BSD-3-Clause
// Geometric control marks shared by finite design compositions; no design dependency in Core.
import { CustomPainter } from '../rendering/custom-paint.ts';
import type { Canvas } from '../../ui/canvas.ts';
import { Paint } from '../../ui/paint.ts';
import { Color } from '../../ui/color.ts';
import type { Size } from '../../ui/geometry.ts';
export interface ControlMarkOptions {
  readonly kind: 'checkbox' | 'radio' | 'switch';
  readonly position: number;
  readonly mixed?: boolean;
  readonly activeColor: number;
  readonly inactiveColor: number;
  readonly markColor: number;
  readonly thumbColor?: number;
  readonly markSize: number;
  readonly trackHeight?: number;
  readonly rtl?: boolean;
  readonly focus?: boolean;
  readonly reaction?: number;
}
export class ControlMarkPainter extends CustomPainter {
  constructor(readonly options: ControlMarkOptions) {
    super();
  }
  paint(canvas: Canvas, size: Size): void {
    const o = this.options,
      cx = size.width / 2,
      cy = size.height / 2,
      p = o.position,
      color = Color.lerp(new Color(o.inactiveColor), new Color(o.activeColor), p)!.toARGB32(),
      paint = new Paint({ color }),
      extent = o.markSize;
    if (o.reaction)
      canvas.drawCircle(
        { x: cx, y: cy },
        Math.min(size.width, size.height) / 2,
        new Paint({ color: new Color(o.activeColor).withOpacity(o.reaction).toARGB32() }),
      );
    if (o.kind === 'checkbox') {
      const rect = { x: cx - extent / 2, y: cy - extent / 2, width: extent, height: extent };
      paint.style = p === 0 ? 'stroke' : 'fill';
      paint.strokeWidth = 2;
      canvas.drawRRect(rect, 2, paint);
      if (p > 0) {
        const mark = new Paint({
          color: new Color(o.markColor).withOpacity(p).toARGB32(),
          style: 'stroke',
          strokeWidth: 2,
          strokeCap: 'round',
        });
        if (o.mixed)
          canvas.drawLine({ x: cx - extent * 0.25, y: cy }, { x: cx + extent * 0.25, y: cy }, mark);
        else {
          canvas.drawLine(
            { x: cx - extent * 0.28, y: cy },
            { x: cx - extent * 0.06, y: cy + extent * 0.22 },
            mark,
          );
          canvas.drawLine(
            { x: cx - extent * 0.06, y: cy + extent * 0.22 },
            { x: cx + extent * 0.3, y: cy - extent * 0.22 },
            mark,
          );
        }
      }
    } else if (o.kind === 'radio') {
      paint.style = 'stroke';
      paint.strokeWidth = 2;
      canvas.drawCircle({ x: cx, y: cy }, extent / 2, paint);
      if (p > 0) {
        paint.style = 'fill';
        canvas.drawCircle({ x: cx, y: cy }, extent * 0.25 * p, paint);
      }
    } else {
      const height = o.trackHeight ?? extent * 0.6,
        left = cx - extent / 2;
      canvas.drawRRect({ x: left, y: cy - height / 2, width: extent, height }, height / 2, paint);
      const radius = height / 2 - 2,
        visual = o.rtl ? 1 - p : p;
      canvas.drawCircle(
        { x: left + height / 2 + (extent - height) * visual, y: cy },
        radius,
        new Paint({ color: o.thumbColor ?? o.markColor }),
      );
    }
    if (o.focus)
      canvas.drawRRect(
        { x: 1, y: 1, width: Math.max(0, size.width - 2), height: Math.max(0, size.height - 2) },
        o.kind === 'checkbox' ? 4 : Math.min(size.width, size.height) / 2,
        new Paint({ color: o.activeColor, style: 'stroke', strokeWidth: 2 }),
      );
  }
  shouldRepaint(old: ControlMarkPainter): boolean {
    return Object.keys(this.options).some(
      (key) =>
        this.options[key as keyof ControlMarkOptions] !==
        old.options[key as keyof ControlMarkOptions],
    );
  }
}
