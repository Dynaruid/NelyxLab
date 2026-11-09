// SPDX-License-Identifier: BSD-3-Clause
// Source RangeSlider policy. Content evaluates all dimensions and child placement.
import {
  NativeLayoutBuilder,
  nativeLayoutExpression as expr,
  nativeLayoutInput as input,
} from '@nelyx/core/framework/rendering/object';
import type {
  NativeBoxConfiguration,
  NativeLayoutScalar,
  NativePaintEntry,
  NativePaintScalar as Scalar,
  NativeShape,
} from '@nelyx/core/framework/rendering/object';
import { Color } from '@nelyx/core/ui/color';
import { FoundationBuildMode } from '@nelyx/core/foundation/constants';
import { debugDisableShadows } from '@nelyx/core/framework/painting/debug';
import { emptyWidgetStateSet, WidgetState } from '@nelyx/core/framework/widgets/widget-state';
import type { Size } from '@nelyx/core/ui/size';
import { Thumb } from '../../slider-theme.ts';
import type { SliderThemeData } from '../../slider-theme.ts';
import { nativeRangeSliderShape } from './range-native-shape.ts';
import type {
  NativeRangeSliderGeometry,
  NativeRangeSliderRect,
  NativeRangeSliderShapeContext,
} from './range-native-shape.ts';
import { materialRangeSliderPaintThemes } from './range-paint-policy.ts';
import {
  RoundedRectRangeSliderTrackShape,
  RectangularRangeSliderTrackShape,
  GappedRangeSliderTrackShape,
  RoundRangeSliderThumbShape,
  HandleRangeSliderThumbShape,
  RoundRangeSliderTickMarkShape,
  RoundSliderOverlayShape,
  SliderComponentShape,
} from '../../slider-shapes.ts';

export interface NativeRangeSource {
  readonly theme: SliderThemeData;
  readonly preferred: Size;
  readonly direction: 'ltr' | 'rtl';
  readonly start: number;
  readonly end: number;
  readonly enabled: boolean;
  readonly divisions: number | null;
  readonly enable: number;
  readonly overlay: number;
  readonly indicator: number;
  readonly active: boolean;
  readonly selected: Thumb | null;
  readonly focusedStart: boolean;
  readonly focusedEnd: boolean;
  readonly hoverStart: boolean;
  readonly hoverEnd: boolean;
}
const op = (name: Exclude<Scalar, number>['op'], ...args: Scalar[]): Scalar => ({ op: name, args });
const add = (a: Scalar, b: Scalar) => op('add', a, b),
  sub = (a: Scalar, b: Scalar) => op('subtract', a, b),
  mul = (a: Scalar, b: Scalar) => op('multiply', a, b),
  div = (a: Scalar, b: Scalar) => op('divide', a, b),
  min = (a: Scalar, b: Scalar) => op('min', a, b),
  max = (a: Scalar, b: Scalar) => op('max', a, b),
  lt = (a: Scalar, b: Scalar) => op('less', a, b),
  gt = (a: Scalar, b: Scalar) => op('greater', a, b);
const w = op('width'),
  h = op('height');
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
const exact = (value: object | null, prototype: object) =>
  value !== null &&
  Object.getPrototypeOf(value) === prototype &&
  !['paint', 'getPreferredSize', 'getPreferredRect'].some((name) => Object.hasOwn(value, name));

export function nativeRangeSliderGeometry(s: NativeRangeSource): NativeRangeSliderGeometry {
  const t = s.theme,
    discrete = s.divisions !== null,
    custom = nativeRangeSliderShape(t.rangeTrackShape, 'track');
  const rect = (enabled: boolean, isDiscrete: boolean, source = s): NativeRangeSliderRect => {
    if (custom) return custom.rect(t.rangeTrackShape!, { source, enabled, discrete: isDiscrete });
    const thumb = t.rangeThumbShape!.getPreferredSize(enabled, isDiscrete),
      overlay = t.overlayShape!.getPreferredSize(enabled, isDiscrete),
      inset = t.padding === null ? Math.max(overlay.width / 2, thumb.width / 2) : thumb.width / 2,
      other = sub(w, inset),
      left = min(inset, other),
      right = max(inset, other);
    const height =
      t.activeTrackColor!.toARGB32() === 0 && t.inactiveTrackColor!.toARGB32() === 0
        ? 0
        : (t.trackHeight ?? 0);
    return { left, width: sub(right, left), top: sub(div(h, 2), height / 2), height };
  };
  // Source centers() requests the default disabled rect; track paint requests enabled.
  const centersRect = rect(false, discrete),
    paintRect = rect(s.enabled, discrete, {
      ...s,
      theme: materialRangeSliderPaintThemes(t, s.active).track,
    }),
    padding = t.rangeTrackShape!.isRounded ? centersRect.height : 0,
    thumb = t.rangeThumbShape!.getPreferredSize(s.enabled, discrete),
    inset = op('select', gt(padding, thumb.width / 2), div(padding, 2), 0),
    centersRight = add(centersRect.left, centersRect.width),
    center = (value: number) => {
      const visual = s.direction === 'rtl' ? 1 - value : value,
        position = discrete
          ? add(
              add(centersRect.left, mul(visual, sub(centersRect.width, padding))),
              div(padding, 2),
            )
          : add(centersRect.left, mul(visual, centersRect.width));
      return op('clamp', position, add(centersRect.left, inset), sub(centersRight, inset));
    },
    start = center(s.start),
    end = center(s.end),
    cy = add(centersRect.top, div(centersRect.height, 2));
  return {
    ...paintRect,
    right: add(paintRect.left, paintRect.width),
    start,
    end,
    cy,
    first: s.direction === 'rtl' ? end : start,
    last: s.direction === 'rtl' ? start : end,
    centersRect,
  };
}

function nativeLayout(
  value: Scalar,
  width: NativeLayoutScalar,
  height: NativeLayoutScalar,
): NativeLayoutScalar {
  if (typeof value === 'number') return value;
  if (value.op === 'width') return width;
  if (value.op === 'height') return height;
  switch (value.op) {
    case 'add':
    case 'subtract':
    case 'multiply':
    case 'divide':
    case 'min':
    case 'max':
    case 'clamp':
    case 'less':
    case 'greater':
    case 'lessEqual':
    case 'greaterEqual':
    case 'equal':
    case 'select':
      return expr(value.op, ...(value.args ?? []).map((v) => nativeLayout(v, width, height)));
    default:
      throw Error('Unsupported Source range layout scalar');
  }
}

export function nativeRangeSliderConfiguration(s: NativeRangeSource): NativeBoxConfiguration {
  const paint = nativeRangeSliderPaint(s);
  const b = new NativeLayoutBuilder(),
    dimension = (lo: NativeLayoutScalar, hi: NativeLayoutScalar, preferred: number) =>
      b.value(expr('clamp', expr('select', expr('finite', hi), hi, preferred), lo, hi)),
    width = dimension(input.minWidth, input.maxWidth, s.preferred.width),
    height = dimension(input.minHeight, input.maxHeight, s.preferred.height),
    g = nativeRangeSliderGeometry(s),
    centers = s.direction === 'rtl' ? [g.end, g.start] : [g.start, g.end];
  for (let i = 0; i < 2; i++) {
    b.child(i, [48, 48, 48, 48]);
    b.place(
      i,
      expr('subtract', nativeLayout(centers[i]!, width, height), 24),
      expr('subtract', nativeLayout(g.cy, width, height), 24),
    );
  }
  b.size(width, height);
  const result = (value: number) => [{ kind: 'result' as const, values: [value] }];
  return {
    kind: 'box',
    layout: {},
    hitTest: 'deferToChild',
    semanticsPolicy: { boundary: true, explicitChildren: true },
    layoutProgram: {
      children: 2,
      layout: b.commands,
      minWidth: result(s.preferred.width),
      maxWidth: result(s.preferred.width),
      minHeight: result(s.preferred.height),
      maxHeight: result(s.preferred.height),
    },
    paint,
  };
}

export function nativeRangeSliderPaint(s: NativeRangeSource): readonly NativePaintEntry[] {
  const t = s.theme,
    track = t.rangeTrackShape,
    thumb = t.rangeThumbShape,
    tick = t.rangeTickMarkShape,
    overlay = t.overlayShape,
    rounded = exact(track, RoundedRectRangeSliderTrackShape.prototype),
    rectangular = exact(track, RectangularRangeSliderTrackShape.prototype),
    gapped = exact(track, GappedRangeSliderTrackShape.prototype),
    round = exact(thumb, RoundRangeSliderThumbShape.prototype),
    handle = exact(thumb, HandleRangeSliderThumbShape.prototype),
    customTrack = nativeRangeSliderShape(track, 'track'),
    customThumb = nativeRangeSliderShape(thumb, 'thumb'),
    customTick = nativeRangeSliderShape(tick, 'tick'),
    customOverlay = nativeRangeSliderShape(overlay, 'overlay'),
    themes = materialRangeSliderPaintThemes(t, s.active);
  if (!customTrack && !rounded && !rectangular && !gapped)
    throw Error('Native Material RangeSlider custom track');
  if (!customThumb && !round && !handle) throw Error('Native Material RangeSlider custom thumb');
  if (!customTick && !exact(tick, RoundRangeSliderTickMarkShape.prototype))
    throw Error('Native Material RangeSlider custom tick');
  if (
    !customOverlay &&
    !exact(overlay, RoundSliderOverlayShape.prototype) &&
    overlay !== SliderComponentShape.noOverlay
  )
    throw Error('Native Material RangeSlider custom overlay');
  if (round && FoundationBuildMode.debug && debugDisableShadows)
    throw Error('Native Material RangeSlider debug shadow override');
  const g = nativeRangeSliderGeometry(s),
    discrete = s.divisions !== null,
    mix = (a: Color | null, b: Color | null) => Color.lerp(a, b, s.enable)!.toARGB32(),
    active = mix(t.disabledActiveTrackColor, t.activeTrackColor),
    inactive = mix(t.disabledInactiveTrackColor, t.inactiveTrackColor),
    entries: NativePaintEntry[] = [];
  const context = (
    x: Scalar,
    thumb: Thumb,
    activation: number,
    pressed: boolean,
    onTop: Scalar,
  ): NativeRangeSliderShapeContext => ({
    source: s,
    geometry: g,
    center: [x, g.cy],
    thumb,
    activation,
    pressed,
    onTop,
  });
  const customEntries = (values: readonly NativePaintEntry[], visible?: Scalar) => {
    for (const entry of values) {
      if (visible === undefined) entries.push(entry);
      else {
        const geometry = entry.geometry ?? {
          kind: 'program' as const,
          rect: [0, 0, w, h] as const,
        };
        if (geometry.kind !== 'program')
          throw Error('Custom RangeSlider conditional paint requires program geometry');
        entries.push({
          ...entry,
          geometry: { ...geometry, visible: mul(visible, geometry.visible ?? 1) },
        });
      }
    }
  };
  const rect = (
    x: Scalar,
    y: Scalar,
    width: Scalar,
    height: Scalar,
    color: number,
    radii: readonly Scalar[] = Array(8).fill(0),
    visible?: Scalar,
    kind: NativePaintEntry['kind'] = 'shape',
    stroke = 0,
  ) => {
    entries.push({
      kind,
      color: stroke ? 0 : color,
      shape: stroke ? { ...shape, strokeColor: color, strokeWidth: stroke } : shape,
      geometry: {
        kind: 'program',
        rect: [x, y, max(0, width), max(0, height)],
        radii,
        ...(visible === undefined ? {} : { visible }),
      },
    });
  };
  const circle = (x: Scalar, radius: number, color: number, visible?: Scalar, stroke = 0) =>
    rect(
      sub(x, radius),
      sub(g.cy, radius),
      radius * 2,
      radius * 2,
      color,
      Array(8).fill(radius),
      visible,
      'shape',
      stroke,
    );
  if (customTrack) {
    customEntries(
      customTrack.paint(track!, {
        ...context(g.start, Thumb.start, s.indicator, s.active, 0),
        source: { ...s, theme: themes.track },
      }),
    );
  } else if (rectangular) {
    rect(g.left, g.top, sub(g.first, g.left), g.height, inactive, undefined, gt(g.first, g.left));
    rect(g.first, g.top, sub(g.last, g.first), g.height, active, undefined, gt(g.last, g.first));
    rect(g.last, g.top, sub(g.right, g.last), g.height, inactive, undefined, gt(g.right, g.last));
  } else if (rounded) {
    const radius = div(g.height, 2),
      configured = t.trackHeight ?? 0;
    rect(g.left, g.top, sub(g.first, g.left), g.height, inactive, corners(radius, 0, 0, radius));
    rect(g.last, g.top, sub(g.right, g.last), g.height, inactive, corners(0, radius, radius, 0));
    rect(
      sub(g.first, configured / 2),
      sub(g.top, 1),
      add(sub(g.last, g.first), configured),
      add(g.height, 2),
      active,
      Array(8).fill(radius),
    );
  } else {
    const radius = div(min(g.width, g.height), 2),
      normal = t.thumbSize?.resolve(emptyWidgetStateSet()),
      pressed = emptyWidgetStateSet();
    pressed.add(WidgetState.pressed);
    const pressedWidth = t.thumbSize?.resolve(pressed)?.width,
      gap =
        (t.trackGap ?? 0) -
        (s.active && normal && pressedWidth !== undefined && (t.trackGap ?? 0) > 0
          ? (normal.width - pressedWidth) / 2
          : 0);
    entries.push({ kind: 'save', color: 0, shape });
    rect(g.left, g.top, g.width, g.height, 0, Array(8).fill(radius), undefined, 'clip');
    rect(
      g.left,
      g.top,
      sub(sub(g.first, gap), g.left),
      g.height,
      inactive,
      corners(radius, 2, 2, radius),
      gt(g.start, add(g.left, (t.trackHeight ?? 0) / 2)),
    );
    rect(
      add(g.last, gap),
      g.top,
      sub(g.right, add(g.last, gap)),
      g.height,
      inactive,
      corners(2, radius, radius, 2),
      lt(g.end, sub(g.right, (t.trackHeight ?? 0) / 2)),
    );
    rect(
      add(g.first, gap),
      g.top,
      sub(sub(g.last, gap), add(g.first, gap)),
      g.height,
      active,
      Array(8).fill(2),
      lt(add(g.first, gap), sub(g.last, gap)),
    );
    entries.push({ kind: 'restore', color: 0, shape });
    if (!discrete) {
      const startStop = add(g.left, (t.trackHeight ?? 0) / 2),
        endStop = sub(g.right, (t.trackHeight ?? 0) / 2);
      circle(startStop, 2, active, gt(g.start, startStop));
      circle(endStop, 2, active, lt(g.end, endStop));
    }
  }
  const startSelected = s.selected === Thumb.start && !s.hoverEnd,
    endSelected = s.selected === Thumb.end && !s.hoverStart;
  if (overlay !== SliderComponentShape.noOverlay) {
    for (const [x, focused, selected, hovered, thumb] of [
      [g.start, s.focusedStart, startSelected, s.hoverStart, Thumb.start],
      [g.end, s.focusedEnd, endSelected, s.hoverEnd, Thumb.end],
    ] as const) {
      if (customOverlay) {
        if (focused)
          customEntries(customOverlay.paint(overlay!, context(x, thumb, 1, selected, 0)));
        if (s.overlay !== 0 && (selected || hovered))
          customEntries(customOverlay.paint(overlay!, context(x, thumb, s.overlay, selected, 0)));
      } else {
        const radius = (overlay as RoundSliderOverlayShape).overlayRadius,
          color = t.overlayColor!.toARGB32();
        if (focused) circle(x, radius, color);
        if (s.overlay !== 0 && (selected || hovered)) circle(x, radius * s.overlay, color);
      }
    }
  }
  if (s.divisions !== null) {
    const width = tick!.getPreferredSize({ sliderTheme: t, isEnabled: s.enabled }).width,
      radius = width / 2,
      trackWidth = sub(g.centersRect.width, g.centersRect.height),
      tickX = (index: Scalar) =>
        add(
          add(g.centersRect.left, mul(div(index, s.divisions!), trackWidth)),
          div(g.centersRect.height, 2),
        ),
      x = tickX(op('index')),
      between = mul(gt(x, g.first), lt(x, g.last)),
      gap = t.trackGap !== null && t.trackGap > 0,
      visible = mul(
        op('greaterEqual', div(trackWidth, s.divisions), 3 * width),
        gap
          ? mul(op('equal', op('equal', x, g.start), 0), op('equal', op('equal', x, g.end), 0))
          : 1,
      );
    if (customTick) {
      if (s.divisions > 127)
        throw Error('Custom RangeSlider tick paint exceeds bounded entry budget');
      const visible = op('greaterEqual', div(trackWidth, s.divisions), 3 * width);
      for (let i = 0; i <= s.divisions; i++)
        customEntries(
          customTick.paint(tick!, {
            ...context(tickX(i), Thumb.start, s.enable, false, 0),
            tickIndex: i,
          }),
          visible,
        );
    } else
      entries.push({
        kind: 'shape',
        color: 0,
        shape,
        geometry: {
          kind: 'program',
          rect: [sub(x, radius), sub(g.cy, radius), width, width],
          radii: Array(8).fill(radius),
          visible,
          color: op(
            'select',
            between,
            mix(t.disabledActiveTickMarkColor, t.activeTickMarkColor),
            mix(t.disabledInactiveTickMarkColor, t.inactiveTickMarkColor),
          ),
          repeat: s.divisions + 1,
        },
      });
  }
  const lastStart = s.selected === Thumb.start,
    order = lastStart ? [g.end, g.start] : [g.start, g.end],
    distance = max(sub(g.end, g.start), sub(g.start, g.end)),
    color = mix(t.disabledThumbColor, t.thumbColor),
    thumbWidth = thumb!.getPreferredSize(s.enabled, discrete).width;
  for (let i = 0; i < 2; i++) {
    const x = order[i]!,
      current = (i === 1) === lastStart ? Thumb.start : Thumb.end;
    if (customThumb) {
      customEntries(
        customThumb.paint(thumb!, {
          ...context(
            x,
            current,
            i === 1 ? s.overlay : s.indicator,
            current === Thumb.start ? startSelected : endSelected,
            i === 1 ? lt(distance, thumbWidth) : 0,
          ),
          source: { ...s, theme: themes.thumb },
        }),
      );
    } else if (round) {
      const source = thumb as RoundRangeSliderThumbShape,
        radius =
          (source.disabledThumbRadius ?? source.enabledThumbRadius) +
          (source.enabledThumbRadius - (source.disabledThumbRadius ?? source.enabledThumbRadius)) *
            s.enable;
      if (i === 1)
        circle(x, radius, t.overlappingShapeStrokeColor!.toARGB32(), lt(distance, thumbWidth), 1);
      entries.push({
        kind: 'elevationShadow',
        color: 0xff000000,
        shape: { ...shape, kind: 'circle' },
        elevation: source.elevation,
        transparentOccluder: true,
        geometry: {
          kind: 'program',
          rect: [sub(x, radius), sub(g.cy, radius), radius * 2, radius * 2],
        },
      });
      circle(x, radius, color);
    } else {
      const normal = t.thumbSize!.resolve(emptyWidgetStateSet())!,
        pressed = emptyWidgetStateSet();
      pressed.add(WidgetState.pressed);
      const width = s.active
        ? (t.thumbSize!.resolve(pressed)?.width ?? normal.width)
        : normal.width;
      rect(
        sub(x, width / 2),
        sub(g.cy, normal.height / 2),
        width,
        normal.height,
        color,
        Array(8).fill(Math.min(width, normal.height) / 2),
      );
    }
  }
  return entries;
}
