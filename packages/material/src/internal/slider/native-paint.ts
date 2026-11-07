// SPDX-License-Identifier: BSD-3-Clause
// Source Slider shape configuration; Content evaluates the geometry expressions.
import type {
  NativePaintEntry,
  NativePaintScalar as Scalar,
  NativeShape,
  NativeRenderMetadata,
} from '@nelyx/core/framework/rendering/object';
import type { SliderVisualState } from '@nelyx/core/framework/widgets/slider-control';
import { Color } from '@nelyx/core/ui/color';
import { Canvas } from '@nelyx/core/ui/canvas';
import { Offset } from '@nelyx/core/ui/offset';
import type { TextPainter } from '@nelyx/core/framework/painting/text-painter';
import type { RenderBox } from '@nelyx/core/framework/rendering/object';
import { debugDisableShadows } from '@nelyx/core/framework/painting/debug';
import { FoundationBuildMode } from '@nelyx/core/foundation/constants';
import { emptyWidgetStateSet } from '@nelyx/core/framework/widgets/widget-state';
import type { SliderThemeData } from '../../slider-theme.ts';
import {
  SliderComponentShape,
  SliderTickMarkShape,
  RoundSliderOverlayShape,
  RoundSliderThumbShape,
  HandleThumbShape,
  RoundedRectSliderValueIndicatorShape,
  DropSliderValueIndicatorShape,
  RoundedRectSliderTrackShape,
  RectangularSliderTrackShape,
  GappedSliderTrackShape,
  RoundSliderTickMarkShape,
} from '../../slider-shapes.ts';

interface Source {
  readonly theme: SliderThemeData;
  readonly trackTheme: SliderThemeData;
  readonly thumbTheme: SliderThemeData;
  readonly visual: SliderVisualState;
  readonly enabled: boolean;
  readonly divisions: number | null;
  readonly secondary: number | null;
  readonly label: string | null;
  readonly enableProgress: number;
}
const expression = (op: Exclude<Scalar, number>['op'], ...args: Scalar[]): Scalar => ({ op, args });
const add = (a: Scalar, b: Scalar) => expression('add', a, b),
  sub = (a: Scalar, b: Scalar) => expression('subtract', a, b),
  mul = (a: Scalar, b: Scalar) => expression('multiply', a, b),
  div = (a: Scalar, b: Scalar) => expression('divide', a, b),
  min = (a: Scalar, b: Scalar) => expression('min', a, b),
  max = (a: Scalar, b: Scalar) => expression('max', a, b),
  gt = (a: Scalar, b: Scalar) => expression('greater', a, b),
  lt = (a: Scalar, b: Scalar) => expression('less', a, b);
const w = expression('width'),
  h = expression('height'),
  index = expression('index');
const shape: NativeShape = {
  kind: 'rrect',
  radii: Array(8).fill(0),
  strokeWidth: 0,
  strokeAlign: 0,
  strokeColor: 0,
};
const corners = (tl: Scalar, tr: Scalar, br: Scalar, bl: Scalar) => [
  tl,
  tl,
  tr,
  tr,
  br,
  br,
  bl,
  bl,
];
function exact(value: object | null, prototype: object): boolean {
  return value !== null && Object.getPrototypeOf(value) === prototype;
}
export function nativeMaterialSliderPaint(source: Source): NativeRenderMetadata {
  const { theme: t, visual: v, enabled, divisions, enableProgress: a } = source,
    discrete = divisions !== null,
    rtl = v.direction === 'rtl';
  const track = t.trackShape,
    thumb = t.thumbShape,
    overlay = t.overlayShape,
    tick = t.tickMarkShape;
  const rounded = exact(track, RoundedRectSliderTrackShape.prototype),
    gapped = exact(track, GappedSliderTrackShape.prototype),
    rectangular = exact(track, RectangularSliderTrackShape.prototype),
    roundThumb = exact(thumb, RoundSliderThumbShape.prototype),
    handle = exact(thumb, HandleThumbShape.prototype);
  if (!rounded && !gapped && !rectangular) throw Error('Native Material Slider custom track shape');
  if (!roundThumb && !handle && thumb !== SliderComponentShape.noThumb)
    throw Error('Native Material Slider custom thumb shape');
  if (
    !exact(overlay, RoundSliderOverlayShape.prototype) &&
    overlay !== SliderComponentShape.noOverlay
  )
    throw Error('Native Material Slider custom overlay shape');
  if (!exact(tick, RoundSliderTickMarkShape.prototype) && tick !== SliderTickMarkShape.noTickMark)
    throw Error('Native Material Slider custom tick shape');
  if (roundThumb && FoundationBuildMode.debug && debugDisableShadows)
    throw Error('Native Material Slider debug shadow override');
  const mix = (from: Color | null, to: Color | null) => Color.lerp(from, to, a)!.toARGB32();
  const configuredHeight = t.trackHeight ?? 0,
    trackHeight =
      t.activeTrackColor!.toARGB32() === 0 && t.inactiveTrackColor!.toARGB32() === 0
        ? 0
        : configuredHeight;
  const bounds = (isEnabled: boolean) => {
    const thumbWidth = thumb!.getPreferredSize(isEnabled, discrete).width,
      overlayWidth = overlay!.getPreferredSize(isEnabled, discrete).width,
      inset = t.padding === null ? Math.max(thumbWidth / 2, overlayWidth / 2) : 0,
      rawRight = sub(w, t.padding === null ? Math.max(thumbWidth, overlayWidth) - inset : 0),
      left = min(inset, rawRight),
      right = max(inset, rawRight);
    return { left, right, width: sub(right, left) };
  };
  // The track paint uses the actual enabled state, while Source rect() defaults to false.
  const { left, width } = bounds(false),
    { cx, cy } = nativeSliderCenter(source),
    top = sub(cy, trackHeight / 2);
  const entries: NativePaintEntry[] = [];
  const rect = (
    x: Scalar,
    y: Scalar,
    width: Scalar,
    height: Scalar,
    color: number,
    radii: readonly Scalar[] = Array(8).fill(0),
    visible?: Scalar,
    kind: NativePaintEntry['kind'] = 'shape',
  ) => {
    entries.push({
      kind,
      shape,
      color,
      geometry: {
        kind: 'program',
        rect: [x, y, width, height],
        radii,
        ...(visible === undefined ? {} : { visible }),
      },
    });
  };
  const circle = (x: Scalar, y: Scalar, radius: number, color: number, visible?: Scalar) =>
    rect(
      sub(x, radius),
      sub(y, radius),
      radius * 2,
      radius * 2,
      color,
      Array(8).fill(radius),
      visible,
    );
  const active = mix(t.disabledActiveTrackColor, t.activeTrackColor),
    inactive = mix(t.disabledInactiveTrackColor, t.inactiveTrackColor),
    secondary = mix(t.disabledSecondaryActiveTrackColor, t.secondaryActiveTrackColor),
    leftColor = rtl ? inactive : active,
    rightColor = rtl ? active : inactive;
  const secondaryX =
    source.secondary === null
      ? null
      : add(left, mul(rtl ? 1 - source.secondary : source.secondary, width));
  if (configuredHeight > 0) {
    const { left, right, width } = bounds(enabled);
    if (rectangular) {
      rect(left, top, sub(cx, left), trackHeight, leftColor);
      rect(cx, top, sub(right, cx), trackHeight, rightColor);
      if (secondaryX !== null)
        rect(
          rtl ? secondaryX : cx,
          top,
          rtl ? sub(cx, secondaryX) : sub(secondaryX, cx),
          trackHeight,
          secondary,
          Array(8).fill(0),
          rtl ? lt(secondaryX, cx) : gt(secondaryX, cx),
        );
    } else if (rounded) {
      const radius = trackHeight / 2,
        activeRadius = (trackHeight + 2) / 2;
      rect(
        sub(cx, configuredHeight / 2),
        rtl ? sub(top, 1) : top,
        sub(right, sub(cx, configuredHeight / 2)),
        rtl ? trackHeight + 2 : trackHeight,
        rightColor,
        Array(8).fill(rtl ? activeRadius : radius),
        lt(cx, sub(right, configuredHeight / 2)),
      );
      rect(
        left,
        rtl ? top : sub(top, 1),
        sub(add(cx, configuredHeight / 2), left),
        rtl ? trackHeight : trackHeight + 2,
        leftColor,
        Array(8).fill(rtl ? radius : activeRadius),
        gt(cx, add(left, configuredHeight / 2)),
      );
      if (secondaryX !== null)
        rect(
          rtl ? secondaryX : cx,
          top,
          rtl ? sub(cx, secondaryX) : sub(secondaryX, cx),
          trackHeight,
          secondary,
          rtl ? corners(radius, 0, 0, radius) : corners(0, radius, radius, 0),
          rtl ? lt(secondaryX, cx) : gt(secondaryX, cx),
        );
    } else {
      const radius = div(min(width, trackHeight), 2),
        gap = source.trackTheme.trackGap ?? 0;
      entries.push({ kind: 'save', shape, color: 0 });
      rect(left, top, width, trackHeight, 0, Array(8).fill(radius), undefined, 'clip');
      rect(
        left,
        top,
        sub(max(left, sub(cx, gap)), left),
        trackHeight,
        leftColor,
        corners(radius, 2, 2, radius),
        gt(cx, add(left, configuredHeight / 2)),
      );
      rect(
        add(cx, gap),
        top,
        sub(right, add(cx, gap)),
        trackHeight,
        rightColor,
        corners(2, radius, radius, 2),
        lt(cx, sub(right, configuredHeight / 2)),
      );
      if (secondaryX !== null)
        rect(
          rtl ? sub(secondaryX, gap) : add(cx, gap),
          top,
          rtl ? sub(cx, sub(secondaryX, gap)) : sub(secondaryX, add(cx, gap)),
          trackHeight,
          secondary,
          corners(2, radius, radius, 2),
          rtl ? lt(secondaryX, sub(cx, gap)) : gt(secondaryX, add(cx, gap)),
        );
      entries.push({ kind: 'restore', shape, color: 0 });
      if (!discrete) {
        const stop = rtl ? add(left, configuredHeight / 2) : sub(right, configuredHeight / 2);
        circle(stop, cy, 2, active, rtl ? gt(cx, stop) : lt(cx, stop));
      }
    }
  }
  if (v.pressProgress !== 0 && overlay !== SliderComponentShape.noOverlay)
    circle(
      cx,
      cy,
      (overlay as RoundSliderOverlayShape).overlayRadius * v.pressProgress,
      t.overlayColor!.toARGB32(),
    );
  if (discrete && tick !== SliderTickMarkShape.noTickMark) {
    const tickWidth = tick!.getPreferredSize({ isEnabled: enabled, sliderTheme: t }).width,
      radius = tickWidth / 2;
    const trackWidth = sub(width, trackHeight),
      x = add(add(left, mul(div(index, divisions), trackWidth)), trackHeight / 2);
    const inactiveTick = rtl ? lt(x, cx) : gt(x, cx);
    entries.push({
      kind: 'shape',
      shape,
      color: 0,
      geometry: {
        kind: 'program',
        rect: [sub(x, radius), sub(cy, radius), tickWidth, tickWidth],
        radii: Array(8).fill(radius),
        visible: mul(
          expression('greaterEqual', div(trackWidth, divisions), 3 * tickWidth),
          radius > 0 ? 1 : 0,
        ),
        color: expression(
          'select',
          inactiveTick,
          mix(t.disabledInactiveTickMarkColor, t.inactiveTickMarkColor),
          mix(t.disabledActiveTickMarkColor, t.activeTickMarkColor),
        ),
        repeat: divisions + 1,
      },
    });
  }
  const color = mix(t.disabledThumbColor, t.thumbColor);
  if (roundThumb) {
    const sourceThumb = thumb as RoundSliderThumbShape,
      radius =
        (sourceThumb.disabledThumbRadius ?? sourceThumb.enabledThumbRadius) +
        (sourceThumb.enabledThumbRadius -
          (sourceThumb.disabledThumbRadius ?? sourceThumb.enabledThumbRadius)) *
          a;
    const elevation =
      sourceThumb.elevation +
      (sourceThumb.pressedElevation - sourceThumb.elevation) * v.pressProgress;
    entries.push({
      kind: 'elevationShadow',
      shape: { ...shape, kind: 'circle' },
      color: 0xff000000,
      elevation,
      transparentOccluder: true,
      geometry: {
        kind: 'program',
        rect: [sub(cx, radius), sub(cy, radius), radius * 2, radius * 2],
      },
    });
    circle(cx, cy, radius, color);
  } else if (handle) {
    const size = source.thumbTheme.thumbSize!.resolve(emptyWidgetStateSet())!;
    rect(
      sub(cx, size.width / 2),
      sub(cy, size.height / 2),
      size.width,
      size.height,
      color,
      Array(8).fill(Math.min(size.width, size.height) / 2),
    );
  }
  return { kind: 'paint', entries };
}

/** Same Source thumb/track policy for the overlay and the control recording. */
function nativeSliderCenter(source: Source) {
  const t = source.theme,
    discrete = source.divisions !== null,
    thumb = t.thumbShape!.getPreferredSize(false, discrete),
    overlay = t.overlayShape!.getPreferredSize(false, discrete),
    inset = t.padding === null ? Math.max(thumb.width / 2, overlay.width / 2) : 0,
    rawRight = sub(w, t.padding === null ? Math.max(thumb.width, overlay.width) - inset : 0),
    left = min(inset, rawRight),
    right = max(inset, rawRight),
    width = sub(right, left),
    trackHeight =
      t.activeTrackColor!.toARGB32() === 0 && t.inactiveTrackColor!.toARGB32() === 0
        ? 0
        : (t.trackHeight ?? 0),
    padding = t.trackShape!.isRounded ? trackHeight : 0,
    position =
      source.visual.direction === 'rtl'
        ? 1 - source.visual.position.value
        : source.visual.position.value,
    proposed = discrete
      ? add(add(left, mul(position, sub(width, padding))), padding / 2)
      : add(left, mul(position, width)),
    thumbWidth = t.thumbShape!.getPreferredSize(source.enabled, discrete).width,
    thumbInset = padding > thumbWidth / 2 ? padding / 2 : 0;
  return {
    cx: expression('clamp', proposed, add(left, thumbInset), sub(right, thumbInset)),
    cy: div(h, 2),
  };
}
/** The pinned indicator command composition stays in TypeScript.
 * Content resolves dimensions, local-to-global overflow and paragraph placement. */
export function nativeMaterialSliderIndicator(
  source: Source & {
    readonly painter: TextPainter;
    readonly reference: RenderBox;
    readonly activation: number;
    readonly textScale: number;
    readonly screenWidth: number;
  },
): NativeRenderMetadata {
  const t = source.theme,
    a = source.activation;
  const drop = exact(t.valueIndicatorShape, DropSliderValueIndicatorShape.prototype);
  if (!drop && !exact(t.valueIndicatorShape, RoundedRectSliderValueIndicatorShape.prototype))
    throw Error('Native Material Slider value indicator shape is not connected');
  if (a === 0) return { kind: 'paint', entries: [] };
  if (!(a > 0 && a <= 1) || !(source.screenWidth > 0))
    throw Error('Invalid Slider indicator activation/viewport');
  const { cx, cy } = nativeSliderCenter(source),
    painter = source.painter,
    rectangleWidth = (Math.max(drop ? 20 : 16, painter.width) + (drop ? 8 : 20)) * a,
    rectangleHeight = drop ? 28 : 32,
    globalCenter = expression('worldX', cx, cy),
    overflowLeft = max(0, sub(rectangleWidth / 2 + 8, globalCenter)),
    overflowRight = max(0, sub(rectangleWidth / 2, sub(source.screenWidth - 8, globalCenter))),
    difference = sub(overflowLeft, overflowRight),
    shift =
      rectangleWidth < source.screenWidth
        ? difference
        : expression(
            'select',
            gt(difference, 0),
            sub(overflowLeft, 8 * source.textScale),
            add(mul(overflowRight, -1), 8 * source.textScale),
          ),
    x = add(cx, mul(sub(shift, rectangleWidth / 2), a)),
    y = sub(cy, 16 + (drop ? 34 : 42) * a),
    entries: NativePaintEntry[] = [];
  const radius = (Math.min(rectangleWidth, rectangleHeight) / 2) * a;
  const rect = (color: number, strokeWidth = 0): NativePaintEntry => ({
    kind: drop ? 'path' : 'shape',
    reference: source.reference,
    shape: { ...shape, strokeWidth, strokeColor: color },
    color: strokeWidth ? 0 : color,
    ...(drop
      ? {
          path: {
            commands: [
              ['move', cx, sub(cy, 16)],
              ['line', sub(cx, 10 * a), sub(cy, 16 + 10 * a)],
              ['line', add(cx, 10 * a), sub(cy, 16 + 10 * a)],
              ['close'],
              [
                'rrect',
                x,
                y,
                rectangleWidth * a,
                rectangleHeight * a,
                radius,
                radius,
                radius,
                radius,
                radius,
                radius,
                radius,
                radius,
              ],
            ],
          },
        }
      : {}),
    geometry: {
      kind: 'program',
      rect: drop ? [0, 0, w, h] : [x, y, rectangleWidth * a, rectangleHeight * a],
      ...(drop ? {} : { radii: Array(8).fill(16 * a) }),
    },
  });
  // The original path strokes before filling; the fill covers its inner stroke half.
  if (t.valueIndicatorStrokeColor) entries.push(rect(t.valueIndicatorStrokeColor.toARGB32(), a));
  entries.push(rect(t.valueIndicatorColor!.toARGB32()));
  const canvas = new Canvas();
  try {
    painter.paint(canvas, Offset.zero);
    for (const command of canvas.commands) {
      if (command.op !== 'paragraph') throw Error('Slider label recording is not a paragraph');
      const layout = painter._layoutSnapshot(),
        paragraphWidth = Number.isFinite(layout.width) ? layout.width : layout.maxIntrinsicWidth;
      entries.push({
        kind: 'paragraph',
        paragraph: command.resource,
        reference: source.reference,
        shape,
        color: 0,
        geometry: {
          kind: 'program',
          rect: [
            add(cx, mul(add(sub(shift, painter.width / 2), command.x), a)),
            add(
              sub(cy, 16),
              a *
                (-8 -
                  rectangleHeight +
                  rectangleHeight / (drop ? 1.75 : 2.3) -
                  painter.height / 2 +
                  command.y),
            ),
            paragraphWidth * a,
            painter.height * a,
          ],
        },
      });
    }
  } finally {
    canvas.dispose();
  }
  return { kind: 'paint', entries };
}
