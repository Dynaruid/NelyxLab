// SPDX-License-Identifier: BSD-3-Clause
import type { CanvasKit, Canvas, Path, Paint } from 'canvaskit-wasm';
import type {
  GraphicsOptions,
  EngineNodeSnapshot,
  PathSegment,
  AffineMatrix,
  NodeHandle,
} from '../../../runtime/engine-client/index.ts';
import { protocol as p } from '../../../runtime/engine-client/index.ts';
import type { NativePaintSnapshot } from '../../../runtime/engine-client/native-paint.ts';
/** Recording bounds include displaced paint and blur, while input-only regions never paint. */
export function nativePaintOutset(
  entry: NativePaintSnapshot,
  width: number,
  height: number,
  scale = 1,
): number {
  if (
    entry.kind === 'hitRegion' ||
    entry.kind === 'clip' ||
    entry.kind === 'save' ||
    entry.kind === 'restore' ||
    entry.kind === 'children'
  )
    return 0;
  const circle =
    entry.kind === 'circle' ||
    entry.kind === 'ripple' ||
    (entry.kind === 'highlight' && entry.circular);
  const stroke =
    entry.kind === 'border' && entry.shape.strokeWidth === 0 && entry.shape.strokeColor >>> 24
      ? 1 / Math.max(0.125, scale)
      : entry.shape.strokeWidth;
  const padding =
    (entry.kind === 'path'
      ? 2 * entry.shape.strokeWidth
      : (stroke * (1 + Math.abs(entry.shape.strokeAlign))) / 2) +
    (entry.kind === 'shadow'
      ? 4 * (entry.blurSigma ?? 0)
      : entry.kind === 'elevationShadow'
        ? 4 * scale * (entry.elevation ?? 0) + 2
        : 0);
  const radius = entry.resolvedRadius + padding;
  const pathBounds = entry.kind === 'path' ? entry.pathBounds : undefined;
  const x = pathBounds ? pathBounds.x - padding : circle ? entry.cx - radius : -padding,
    y = pathBounds ? pathBounds.y - padding : circle ? entry.cy - radius : -padding;
  const right = pathBounds
      ? pathBounds.x + pathBounds.width + padding
      : circle
        ? entry.cx + radius
        : entry.width + padding,
    bottom = pathBounds
      ? pathBounds.y + pathBounds.height + padding
      : circle
        ? entry.cy + radius
        : entry.height + padding;
  const [a, b, c, d, tx, ty] = entry.transform;
  let left = Infinity,
    top = Infinity,
    r = -Infinity,
    bt = -Infinity;
  for (const [px, py] of [
    [x, y],
    [right, y],
    [x, bottom],
    [right, bottom],
  ]) {
    const xx = a * px! + c * py! + tx,
      yy = b * px! + d * py! + ty;
    left = Math.min(left, xx);
    top = Math.min(top, yy);
    r = Math.max(r, xx);
    bt = Math.max(bt, yy);
  }
  return Math.max(0, -left, -top, r - width, bt - height);
}
function nativePaintShape(ck: CanvasKit, entry: NativePaintSnapshot, delta = 0): Float32Array {
  let x = 0,
    y = 0,
    w = entry.width,
    h = entry.height;
  if (entry.shape.kind === 'circle') {
    const d = Math.min(w, h);
    x = (w - d) / 2;
    y = (h - d) / 2;
    w = h = d;
  }
  return Float32Array.from([
    x - delta,
    y - delta,
    x + w + delta,
    y + h + delta,
    ...entry.shape.radii.map((radius) => Math.max(0, radius + delta)),
  ]);
}
function nativePaintPath(ck: CanvasKit, entry: NativePaintSnapshot): Path {
  if (!entry.path || entry.path.commands.length > p.limits.pathCommands)
    throw Error('Missing or oversized native path');
  const builder = new ck.PathBuilder();
  try {
    builder.setFillType(
      entry.path.fillRule === 'evenOdd' ? ck.FillType.EvenOdd : ck.FillType.Winding,
    );
    for (const command of entry.path.commands) {
      const values = command.slice(1).map((value) => {
        if (typeof value !== 'number' || !Number.isFinite(value))
          throw Error('Unresolved native path');
        return value;
      });
      switch (command[0]) {
        case 'move':
          builder.moveTo(values[0]!, values[1]!);
          break;
        case 'line':
          builder.lineTo(values[0]!, values[1]!);
          break;
        case 'quad':
          builder.quadTo(values[0]!, values[1]!, values[2]!, values[3]!);
          break;
        case 'cubic':
          builder.cubicTo(values[0]!, values[1]!, values[2]!, values[3]!, values[4]!, values[5]!);
          break;
        case 'close':
          builder.close();
          break;
        case 'conic':
          builder.conicTo(values[0]!, values[1]!, values[2]!, values[3]!, values[4]!);
          break;
        case 'rect':
          builder.addRect(ck.XYWHRect(values[0]!, values[1]!, values[2]!, values[3]!), false);
          break;
        case 'rrect':
          builder.addRRect(
            Float32Array.from([
              values[0]!,
              values[1]!,
              values[0]! + values[2]!,
              values[1]! + values[3]!,
              ...values.slice(4),
            ]),
            false,
          );
          break;
      }
    }
    return builder.detach();
  } finally {
    builder.delete();
  }
}
export function paintNative(
  ck: CanvasKit,
  canvas: Canvas,
  node: EngineNodeSnapshot,
  paint: Paint,
  scale = 1,
  foreground = false,
  paragraph?: (node: NodeHandle) => void,
): void {
  if (!node.nativePaint) return;
  const boundary = node.nativePaint.findIndex((entry) => entry.kind === 'children');
  if (foreground && boundary < 0) return;
  const entries = foreground
    ? node.nativePaint.slice(boundary + 1)
    : boundary < 0
      ? node.nativePaint
      : node.nativePaint.slice(0, boundary);
  const saved = canvas.getSaveCount();
  canvas.save();
  try {
    if (entries.some((entry) => entry.kind === 'highlight' || entry.kind === 'ripple'))
      canvas.clipRect(ck.XYWHRect(0, 0, node.width, node.height), ck.ClipOp.Intersect, false);
    for (const entry of entries) {
      if (entry.kind === 'hitRegion') continue;
      if (entry.kind === 'save') {
        canvas.save();
        continue;
      }
      if (entry.kind === 'restore') {
        canvas.restore();
        continue;
      }
      if (entry.kind === 'clip') {
        const rect = nativePaintShape(ck, entry);
        rect[0]! += entry.transform[4];
        rect[2]! += entry.transform[4];
        rect[1]! += entry.transform[5];
        rect[3]! += entry.transform[5];
        canvas.clipRRect(rect, ck.ClipOp.Intersect, true);
        continue;
      }
      canvas.save();
      try {
        canvas.concat(canvasMatrix(entry.transform));
        paint.setColor(color(ck, entry.color));
        paint.setStyle(ck.PaintStyle.Fill);
        if (entry.kind === 'paragraph') {
          if (!paragraph) throw Error('Prepared paragraph paint resolver is unavailable');
          paragraph(entry.reference);
        } else if (entry.kind === 'path') {
          const path = nativePaintPath(ck, entry);
          try {
            const pathPaint = new ck.Paint();
            try {
              pathPaint.setAntiAlias(true);
              if (entry.color >>> 24) {
                pathPaint.setColor(color(ck, entry.color));
                canvas.drawPath(path, pathPaint);
              }
              if (entry.shape.strokeWidth > 0 && entry.shape.strokeColor >>> 24) {
                pathPaint.setColor(color(ck, entry.shape.strokeColor));
                pathPaint.setStyle(ck.PaintStyle.Stroke);
                pathPaint.setStrokeWidth(entry.shape.strokeWidth);
                canvas.drawPath(path, pathPaint);
              }
            } finally {
              pathPaint.delete();
            }
          } finally {
            path.delete();
          }
        } else if (entry.kind === 'border') {
          if (entry.shape.strokeColor >>> 24) {
            paint.setColor(color(ck, entry.shape.strokeColor));
            paint.setStyle(ck.PaintStyle.Stroke);
            paint.setStrokeWidth(entry.shape.strokeWidth);
            canvas.drawRRect(
              nativePaintShape(ck, entry, (entry.shape.strokeWidth * entry.shape.strokeAlign) / 2),
              paint,
            );
            paint.setStyle(ck.PaintStyle.Fill);
          }
        } else if (entry.kind === 'physical') canvas.drawRRect(nativePaintShape(ck, entry), paint);
        else if (entry.kind === 'checkbox' || entry.kind === 'shape') {
          canvas.drawRRect(nativePaintShape(ck, entry), paint);
          if (entry.shape.strokeWidth > 0 && entry.shape.strokeColor >>> 24) {
            paint.setColor(color(ck, entry.shape.strokeColor));
            paint.setStyle(ck.PaintStyle.Stroke);
            paint.setStrokeWidth(entry.shape.strokeWidth);
            canvas.drawRRect(
              nativePaintShape(ck, entry, (entry.shape.strokeWidth * entry.shape.strokeAlign) / 2),
              paint,
            );
            paint.setStyle(ck.PaintStyle.Fill);
          }
        } else if (entry.kind === 'elevationShadow') {
          if (entry.elevation! > 0 && entry.color >>> 24) {
            const builder = new ck.PathBuilder();
            let path: Path | null = null;
            try {
              builder.addRRect(nativePaintShape(ck, entry), false);
              path = builder.detach();
              const alpha = entry.color >>> 24,
                rgb = [
                  (entry.color >>> 16) & 255,
                  (entry.color >>> 8) & 255,
                  entry.color & 255,
                ] as const;
              const tonal = ck.computeTonalColors({
                ambient: ck.Color(...rgb, Math.trunc(Math.fround(0.039) * alpha) / 255),
                spot: ck.Color(...rgb, Math.trunc(0.25 * alpha) / 255),
              });
              canvas.drawShadow(
                path,
                [0, 0, Math.fround(Math.fround(scale) * Math.fround(entry.elevation!))],
                [0, -1, 1],
                Math.fround(800 / 600),
                tonal.ambient,
                tonal.spot,
                4 | (entry.transparentOccluder ? 1 : 0),
              );
            } finally {
              path?.delete();
              builder.delete();
            }
          }
        } else if (entry.kind === 'shadow') {
          const filter =
            entry.blurSigma! > 0
              ? ck.MaskFilter.MakeBlur(ck.BlurStyle.Normal, entry.blurSigma!, true)
              : null;
          try {
            paint.setMaskFilter(filter);
            canvas.drawRRect(nativePaintShape(ck, entry), paint);
          } finally {
            paint.setMaskFilter(null);
            filter?.delete();
          }
        } else if (entry.kind === 'mark') {
          const path = makePath(
            ck,
            entry.points.map(
              (point, index) => [index ? 'line' : 'move', point.x, point.y] as const,
            ),
            'winding',
          );
          try {
            paint.setStyle(ck.PaintStyle.Stroke);
            paint.setStrokeWidth(entry.shape.strokeWidth);
            canvas.drawPath(path, paint);
          } finally {
            paint.setStyle(ck.PaintStyle.Fill);
            path.delete();
          }
        } else if (entry.kind === 'circle') {
          canvas.drawCircle(entry.cx, entry.cy, entry.resolvedRadius, paint);
          if (entry.shape.strokeWidth > 0 && entry.shape.strokeColor >>> 24) {
            paint.setColor(color(ck, entry.shape.strokeColor));
            paint.setStyle(ck.PaintStyle.Stroke);
            paint.setStrokeWidth(entry.shape.strokeWidth);
            canvas.drawCircle(
              entry.cx,
              entry.cy,
              Math.max(
                0,
                entry.resolvedRadius + (entry.shape.strokeWidth * entry.shape.strokeAlign) / 2,
              ),
              paint,
            );
            paint.setStyle(ck.PaintStyle.Fill);
          }
        } else {
          if (
            (entry.kind === 'highlight' && entry.customClip) ||
            (entry.kind === 'ripple' && entry.contained)
          )
            canvas.clipRRect(nativePaintShape(ck, entry), ck.ClipOp.Intersect, true);
          if (entry.kind === 'ripple' || entry.circular)
            canvas.drawCircle(entry.cx, entry.cy, entry.resolvedRadius, paint);
          else canvas.drawRRect(nativePaintShape(ck, entry), paint);
        }
      } finally {
        canvas.restore();
      }
    }
  } finally {
    canvas.restoreToCount(saved);
  }
}
export function paintNativeShadow(
  ck: CanvasKit,
  canvas: Canvas,
  node: EngineNodeSnapshot,
  path: Path | undefined,
  scale: number,
): void {
  const entry = node.nativePaint?.find((item) => item.kind === 'physical');
  if (!entry || !path || !entry.elevation || !(entry.shadowColor! >>> 24)) return;
  const argb = entry.shadowColor!,
    alpha = argb >>> 24,
    rgb = [(argb >>> 16) & 255, (argb >>> 8) & 255, argb & 255] as const,
    tonal = ck.computeTonalColors({
      ambient: ck.Color(...rgb, Math.trunc(Math.fround(0.039) * alpha) / 255),
      spot: ck.Color(...rgb, Math.trunc(0.25 * alpha) / 255),
    });
  canvas.drawShadow(
    path,
    [0, 0, Math.fround(Math.fround(scale) * Math.fround(entry.elevation))],
    [0, -1, 1],
    Math.fround(800 / 600),
    tonal.ambient,
    tonal.spot,
    4 | (entry.color >>> 24 !== 255 ? 1 : 0),
  );
}
export function canvasMatrix(m: AffineMatrix, scale = 1): number[] {
  return [
    m[0] * scale,
    m[2] * scale,
    m[4] * scale,
    m[1] * scale,
    m[3] * scale,
    m[5] * scale,
    0,
    0,
    1,
  ];
}
export function relativeMatrix(parent: AffineMatrix, child: AffineMatrix): AffineMatrix | null {
  const determinant = parent[0] * parent[3] - parent[1] * parent[2];
  if (!Number.isFinite(determinant) || determinant === 0) return null;
  const a = parent[3] / determinant,
    b = -parent[1] / determinant,
    c = -parent[2] / determinant,
    d = parent[0] / determinant;
  const x = child[4] - parent[4],
    y = child[5] - parent[5];
  const result: AffineMatrix = [
    a * child[0] + c * child[1],
    b * child[0] + d * child[1],
    a * child[2] + c * child[3],
    b * child[2] + d * child[3],
    a * x + c * y,
    b * x + d * y,
  ];
  return result.every(Number.isFinite) ? result : null;
}
export function makePath(
  ck: CanvasKit,
  segments: readonly PathSegment[],
  fillRule: GraphicsOptions['fillRule'],
): Path {
  if (segments.length > p.limits.pathCommands) throw new Error('Provider path command budget');
  const builder = new ck.PathBuilder();
  try {
    builder.setFillType(fillRule === 'evenOdd' ? ck.FillType.EvenOdd : ck.FillType.Winding);
    for (const segment of segments) {
      for (const value of segment.slice(1))
        if (!Number.isFinite(value)) throw new Error('Non-finite path command');
      switch (segment[0]) {
        case 'move':
          builder.moveTo(segment[1], segment[2]);
          break;
        case 'line':
          builder.lineTo(segment[1], segment[2]);
          break;
        case 'quad':
          builder.quadTo(segment[1], segment[2], segment[3], segment[4]);
          break;
        case 'cubic':
          builder.cubicTo(segment[1], segment[2], segment[3], segment[4], segment[5], segment[6]);
          break;
        case 'close':
          builder.close();
          break;
      }
    }
    return builder.detach();
  } finally {
    builder.delete();
  }
}
function color(ck: CanvasKit, argb: number) {
  return ck.Color((argb >>> 16) & 255, (argb >>> 8) & 255, argb & 255, (argb >>> 24) / 255);
}
export function paintShape(
  ck: CanvasKit,
  canvas: Canvas,
  node: EngineNodeSnapshot,
  path: Path | undefined,
  paint: Paint,
): void {
  const shape = () => {
    if (node.kind === p.kinds.path) {
      if (path) canvas.drawPath(path, paint);
    } else
      canvas.drawRRect(
        ck.RRectXY(ck.XYWHRect(0, 0, node.width, node.height), node.radius, node.radius),
        paint,
      );
  };
  if (node.graphics?.shadow?.color) {
    const shadow = node.graphics.shadow;
    const filter =
      shadow.sigma > 0 ? ck.MaskFilter.MakeBlur(ck.BlurStyle.Normal, shadow.sigma, true) : null;
    canvas.save();
    try {
      canvas.translate(shadow.x, shadow.y);
      paint.setColor(color(ck, shadow.color));
      if (filter) paint.setMaskFilter(filter);
      shape();
    } finally {
      paint.setMaskFilter(null);
      filter?.delete();
      canvas.restore();
    }
  }
  if (node.color >>> 24) {
    paint.setColor(color(ck, node.color));
    shape();
  }
  if (node.graphics?.stroke?.color && node.graphics.stroke.width > 0) {
    paint.setColor(color(ck, node.graphics.stroke.color));
    paint.setStyle(ck.PaintStyle.Stroke);
    paint.setStrokeWidth(node.graphics.stroke.width);
    try {
      shape();
    } finally {
      paint.setStyle(ck.PaintStyle.Fill);
    }
  }
}
