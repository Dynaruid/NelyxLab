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
  if (source.label !== null)
    throw Error('Native Material Slider label requires the TextPainter bridge');
  if (roundThumb && FoundationBuildMode.debug && debugDisableShadows)
    throw Error('Native Material Slider debug shadow override');
  const mix = (from: Color | null, to: Color | null) => Color.lerp(from, to, a)!.toARGB32();
  const thumbSize = thumb!.getPreferredSize(enabled, discrete);
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
  // MaterialSliderRender.rect() uses the shape's default isEnabled=false;
  // track.paint() separately uses the actual enabled state. Preserve both Source calls.
  const { left, right, width } = bounds(false),
    cy = div(h, 2),
    top = sub(cy, trackHeight / 2);
  const padding = track!.isRounded ? trackHeight : 0,
    position = rtl ? 1 - v.position.value : v.position.value;
  const proposed = discrete
    ? add(add(left, mul(position, sub(width, padding))), padding / 2)
    : add(left, mul(position, width));
  const thumbInset = padding > thumbSize.width / 2 ? padding / 2 : 0;
  const cx = expression('clamp', proposed, add(left, thumbInset), sub(right, thumbInset));
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
