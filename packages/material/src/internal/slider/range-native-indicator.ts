// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Source RangeSlider indicator policy; Content resolves reference geometry and paths.
import type {
  NativePaintEntry,
  NativePaintScalar as Scalar,
  NativePaintPathSegment,
  NativeRenderMetadata,
  NativeShape,
  RenderBox,
} from '@nelyx/core/framework/rendering/object';
import type { TextPainter } from '@nelyx/core/framework/painting/text-painter';
import { Canvas } from '@nelyx/core/ui/canvas';
import { Offset } from '@nelyx/core/ui/offset';
import { Color } from '@nelyx/core/ui/color';
import {
  RectangularRangeSliderValueIndicatorShape,
  RoundedRectRangeSliderValueIndicatorShape,
  DropRangeSliderValueIndicatorShape,
  PaddleRangeSliderValueIndicatorShape,
} from '../../slider-shapes.ts';
import { Thumb } from '../../slider-theme.ts';
import { nativeRangeSliderGeometry } from './range-native-paint.ts';
import type { NativeRangeSource } from './range-native-paint.ts';
import { nativeRangeSliderShape } from './range-native-shape.ts';
import type { NativeRangeSliderIndicatorContext } from './range-native-shape.ts';

interface Source extends NativeRangeSource {
  readonly reference: RenderBox;
  readonly startLabel: TextPainter;
  readonly endLabel: TextPainter;
  readonly activation: number;
  readonly textScale: number;
  readonly screenWidth: number | null;
}
const op = (name: Exclude<Scalar, number>['op'], ...args: Scalar[]): Scalar => ({ op: name, args });
const add = (a: Scalar, b: Scalar): Scalar =>
    typeof a === 'number' && typeof b === 'number' ? a + b : op('add', a, b),
  sub = (a: Scalar, b: Scalar): Scalar =>
    typeof a === 'number' && typeof b === 'number' ? a - b : op('subtract', a, b),
  mul = (a: Scalar, b: Scalar): Scalar =>
    typeof a === 'number' && typeof b === 'number' ? a * b : op('multiply', a, b),
  div = (a: Scalar, b: Scalar): Scalar =>
    typeof a === 'number' && typeof b === 'number' ? a / b : op('divide', a, b),
  max = (a: Scalar, b: Scalar): Scalar =>
    typeof a === 'number' && typeof b === 'number' ? Math.max(a, b) : op('max', a, b),
  neg = (a: Scalar) => mul(-1, a),
  clamp = (a: Scalar, lo: Scalar, hi: Scalar) => op('clamp', a, lo, hi);
const shape: NativeShape = {
  kind: 'rrect',
  radii: Array(8).fill(0),
  strokeWidth: 0,
  strokeAlign: 0,
  strokeColor: 0,
};
const exact = (value: object | null, prototype: object) =>
  value !== null &&
  Object.getPrototypeOf(value) === prototype &&
  !['paint', 'getPreferredSize', 'getHorizontalShift'].some((name) => Object.hasOwn(value, name));

export function nativeRangeSliderIndicators(s: Source): NativeRenderMetadata {
  const t = s.theme,
    indicator = t.rangeValueIndicatorShape,
    rectangular = exact(indicator, RectangularRangeSliderValueIndicatorShape.prototype),
    rounded = exact(indicator, RoundedRectRangeSliderValueIndicatorShape.prototype),
    drop = exact(indicator, DropRangeSliderValueIndicatorShape.prototype),
    paddle = exact(indicator, PaddleRangeSliderValueIndicatorShape.prototype),
    custom = nativeRangeSliderShape(indicator, 'indicator');
  if (!custom && !rectangular && !rounded && !drop && !paddle)
    throw Error('Native Material RangeSlider custom value indicator');
  const a = s.activation;
  if (a === 0) return { kind: 'paint', entries: [] };
  if (!(a > 0 && a <= 1 && s.textScale > 0 && (s.screenWidth === null || s.screenWidth > 0)))
    throw Error('Invalid RangeSlider indicator activation/viewport');
  const g = nativeRangeSliderGeometry(s),
    entries: NativePaintEntry[] = [],
    labels = [s.startLabel, s.endLabel] as const,
    centers = [g.start, g.end] as const,
    viewportWidth = s.screenWidth ?? op('width'),
    rightEdge = sub(viewportWidth, 8);
  if (custom) {
    const label = (painter: TextPainter) => {
      const canvas = new Canvas();
      try {
        painter.paint(canvas, Offset.zero);
        const layout = painter._layoutSnapshot(),
          width = Number.isFinite(layout.width) ? layout.width : layout.maxIntrinsicWidth;
        const entries: NativePaintEntry[] = canvas.commands.map((command) => {
          if (command.op !== 'paragraph')
            throw Error('RangeSlider label recording is not a paragraph');
          return {
            kind: 'paragraph',
            reference: s.reference,
            paragraph: command.resource,
            color: 0,
            shape,
            geometry: { kind: 'program', rect: [command.x, command.y, width, painter.height] },
          };
        });
        return { width: painter.width, height: painter.height, entries };
      } finally {
        canvas.dispose();
      }
    };
    const nativeLabels = labels.map(label),
      context = (
        i: number,
        activation: number,
        onTop: Scalar,
      ): NativeRangeSliderIndicatorContext => ({
        source: s,
        geometry: g,
        center: [centers[i]!, g.cy],
        thumb: i === 0 ? Thumb.start : Thumb.end,
        activation,
        pressed: s.selected === (i === 0 ? Thumb.start : Thumb.end),
        onTop,
        reference: s.reference,
        textScale: s.textScale,
        screenWidth: s.screenWidth,
        label: nativeLabels[i]!,
      }),
      shifts = labels.map((_, i) => custom.horizontalShift(indicator!, context(i, s.indicator, 0))),
      widths = labels.map(
        (p) =>
          indicator!.getPreferredSize(s.enabled, s.divisions !== null, {
            labelPainter: p,
            textScaleFactor: s.textScale,
          }).width / 2,
      ),
      overflow = add(
        widths[0]! + widths[1]!,
        s.direction === 'ltr' ? sub(shifts[0]!, shifts[1]!) : sub(shifts[1]!, shifts[0]!),
      ),
      overlap = op('less', max(sub(g.end, g.start), sub(g.start, g.end)), overflow),
      order = s.selected === Thumb.start ? [1, 0] : [0, 1];
    for (const [position, i] of order.entries())
      for (const entry of custom.paint(indicator!, context(i, a, position === 1 ? overlap : 0)))
        entries.push({ ...entry, reference: entry.reference ?? s.reference });
    return { kind: 'paint', entries };
  }
  const width = (p: TextPainter, activation: number) =>
    (Math.max(rectangular ? 16 * s.textScale : drop ? 20 : 16, p.width) +
      (rectangular ? 32 : drop ? 8 : 20)) *
    activation;
  const paddleShift = (p: TextPainter, cx: Scalar, activation: number): Scalar => {
    const scale = activation * s.textScale;
    if (scale === 0) return 0;
    const half = Math.max(0, p.width / (2 * s.textScale) - 8),
      radius = (16 + half) * scale,
      left = sub(cx, radius),
      right = add(cx, radius),
      shift = op(
        'select',
        op('greater', right, rightEdge),
        sub(rightEdge, right),
        max(0, sub(8, left)),
      );
    return clamp(div(shift, scale), -half, half);
  };
  const horizontalShift = (p: TextPainter, cx: Scalar, activation: number): Scalar => {
    if (paddle) return mul(paddleShift(p, cx, activation), s.textScale);
    const rectangleWidth = width(p, activation),
      global = op('worldX', cx, g.cy),
      left = max(0, sub(rectangleWidth / 2 + 8, global)),
      right = max(0, sub(rectangleWidth / 2, sub(rightEdge, global))),
      difference = sub(left, right);
    return op(
      'select',
      op('less', rectangleWidth, viewportWidth),
      difference,
      op(
        'select',
        op('greater', difference, 0),
        sub(left, 8 * s.textScale),
        add(neg(right), 8 * s.textScale),
      ),
    );
  };
  const shifts = labels.map((p, i) =>
      rounded || drop ? 0 : horizontalShift(p, centers[i]!, s.indicator),
    ),
    halfWidths = labels.map(
      (p) =>
        indicator!.getPreferredSize(s.enabled, s.divisions !== null, {
          labelPainter: p,
          textScaleFactor: s.textScale,
        }).width / 2,
    ),
    overflow = add(
      halfWidths[0]! + halfWidths[1]!,
      s.direction === 'ltr' ? sub(shifts[0]!, shifts[1]!) : sub(shifts[1]!, shifts[0]!),
    ),
    distance = max(sub(g.end, g.start), sub(g.start, g.end)),
    overlapping = op('less', distance, overflow),
    startOnTop = s.selected === Thumb.start,
    order = startOnTop ? [1, 0] : [0, 1];

  for (const [position, i] of order.entries()) {
    const painter = labels[i]!,
      cx = centers[i]!,
      cy = g.cy,
      shift = horizontalShift(painter, cx, a),
      stroke = (entry: NativePaintEntry) => {
        if (entry.geometry?.kind !== 'program') throw Error('RangeSlider indicator geometry');
        const geometry = entry.geometry;
        const emit = (color: Color | null, visible?: Scalar) => {
          if (color === null) return;
          entries.push({
            ...entry,
            color: 0,
            shape: {
              ...shape,
              strokeColor: color.toARGB32(),
              strokeWidth: paddle ? a * s.textScale : a,
            },
            geometry: { ...geometry, ...(visible === undefined ? {} : { visible }) },
          });
        };
        if (position === 0) emit(t.valueIndicatorStrokeColor);
        else {
          emit(t.valueIndicatorStrokeColor, op('select', overlapping, 0, 1));
          emit(t.overlappingShapeStrokeColor, overlapping);
        }
        entries.push(entry);
      },
      background = paddle
        ? Color.lerp(t.disabledThumbColor, t.valueIndicatorColor, s.enable)!.toARGB32()
        : t.valueIndicatorColor!.toARGB32();
    let labelX: Scalar, labelY: Scalar;
    if (paddle) {
      const scale = a * s.textScale,
        inverse = 1 / s.textScale,
        half = Math.max(0, (painter.width * inverse) / 2 - 8),
        localShift = div(shift, s.textScale),
        leftWidth = sub(half, localShift),
        rightWidth = add(half, localShift),
        leftTheta = mul(sub(1, clamp(div(leftWidth, 14.5), 0, 1)), Math.PI / 6),
        rightTheta = mul(sub(1, clamp(div(rightWidth, 14.5), 0, 1)), Math.PI / 6),
        leftNeckY = add(-40, mul(op('cos', leftTheta), 29)),
        rightNeckY = add(-40, mul(op('cos', rightTheta), 29)),
        bottomY = -Math.sqrt((4.5 + 10 / scale) ** 2 - 36),
        endAngle = Math.PI + Math.atan(bottomY / 6),
        stretchBaseline = max(0, sub(bottomY, max(leftNeckY, rightNeckY))),
        stretch = sub(
          stretchBaseline,
          clamp(mul(stretchBaseline, inverse ** 3), 0, mul(10, stretchBaseline)),
        ),
        x = (v: Scalar) => add(cx, mul(v, scale)),
        y = (v: Scalar) => add(cy, mul(v, scale)),
        commands: NativePaintPathSegment[] = [['move', x(1.5), y(bottomY)]],
        arc = (x0: Scalar, y0: Scalar, radius: number, start: Scalar, end: Scalar) => {
          commands.push([
            'arc',
            x(sub(x0, radius)),
            y(sub(y0, radius)),
            radius * 2 * scale,
            radius * 2 * scale,
            start,
            sub(end, start),
            0,
          ]);
        };
      arc(6, bottomY, 4.5, Math.PI, endAngle);
      arc(0, 0, 10 / scale, endAngle - Math.PI, 2 * Math.PI - endAngle);
      arc(-6, bottomY, 4.5, Math.PI - endAngle, 0);
      arc(-14.5, add(leftNeckY, stretch), 13, 0, sub(leftTheta, Math.PI / 2));
      arc(neg(leftWidth), add(-40, stretch), 16, add(Math.PI / 2, leftTheta), (3 * Math.PI) / 2);
      arc(rightWidth, add(-40, stretch), 16, (3 * Math.PI) / 2, sub((5 * Math.PI) / 2, rightTheta));
      arc(14.5, add(rightNeckY, stretch), 13, sub((3 * Math.PI) / 2, rightTheta), Math.PI);
      stroke({
        kind: 'path',
        reference: s.reference,
        shape,
        color: background,
        path: { commands },
        geometry: { kind: 'program', rect: [0, 0, op('width'), op('height')] },
      });
      labelX = add(x(localShift), (-painter.width * a) / 2);
      labelY = add(y(add(-40, stretch)), (-painter.height * a) / 2);
    } else {
      const rectangleWidth = width(painter, a),
        rectHeight = rectangular ? painter.height + 16 : drop ? 28 : 32,
        tip = rectangular ? 14 : 16,
        gap = rectangular ? 8 : drop ? 6 : 10,
        x = add(cx, mul(sub(shift, rectangleWidth / 2), a)),
        y = sub(cy, tip + (gap + rectHeight) * a),
        rw = rectangleWidth * a,
        rh = rectHeight * a,
        radius = (rectangular ? 4 : drop ? Math.min(rectangleWidth, rectHeight) / 2 : 16) * a;
      const entry: NativePaintEntry = {
        kind: rounded ? 'shape' : 'path',
        reference: s.reference,
        shape,
        color: background,
        geometry: {
          kind: 'program',
          rect: rounded ? [x, y, rw, rh] : [0, 0, op('width'), op('height')],
          ...(rounded ? { radii: Array(8).fill(radius) } : {}),
        },
        ...(rounded
          ? {}
          : {
              path: {
                commands: [
                  ['move', cx, sub(cy, tip)],
                  ['line', sub(cx, (drop ? 10 : 8) * a), sub(cy, tip + (drop ? 10 : 8) * a)],
                  ['line', add(cx, (drop ? 10 : 8) * a), sub(cy, tip + (drop ? 10 : 8) * a)],
                  ['close'],
                  [
                    'rrect',
                    x,
                    y,
                    rw,
                    rh,
                    radius,
                    radius,
                    radius,
                    radius,
                    radius,
                    radius,
                    radius,
                    radius,
                  ],
                ] as NativePaintPathSegment[],
              },
            }),
      };
      stroke(entry);
      labelX = add(cx, mul(sub(shift, painter.width / 2), a));
      labelY = sub(
        cy,
        tip -
          a *
            (-8 -
              rectHeight +
              rectHeight / (rectangular ? 2 : drop ? 1.75 : 2.3) -
              painter.height / 2),
      );
    }
    const canvas = new Canvas();
    try {
      painter.paint(canvas, Offset.zero);
      const layout = painter._layoutSnapshot(),
        paragraphWidth = Number.isFinite(layout.width) ? layout.width : layout.maxIntrinsicWidth;
      for (const command of canvas.commands) {
        if (command.op !== 'paragraph')
          throw Error('RangeSlider label recording is not a paragraph');
        entries.push({
          kind: 'paragraph',
          reference: s.reference,
          paragraph: command.resource,
          color: 0,
          shape,
          geometry: {
            kind: 'program',
            rect: [
              add(labelX, command.x * a),
              add(labelY, command.y * a),
              paragraphWidth * a,
              painter.height * a,
            ],
          },
        });
      }
    } finally {
      canvas.dispose();
    }
  }
  return { kind: 'paint', entries };
}
