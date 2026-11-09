// SPDX-License-Identifier: BSD-3-Clause
import { Color } from '@nelyx/core/ui/color';
import { Offset } from '@nelyx/core/ui/offset';
import { Rect } from '@nelyx/core/ui/rect';
import { RRect } from '@nelyx/core/ui/rrect';
import { Paint } from '@nelyx/core/ui/paint';
import { Size } from '@nelyx/core/ui/size';
import { unwrapSourceDartNum } from '@nelyx/core/foundation/dart-numeric';
import type { PaintingContext } from '@nelyx/core/framework/painting/context';
import type {
  NativePaintEntry,
  NativePaintScalar as Scalar,
} from '@nelyx/core/framework/rendering/object';
import { SliderThemeData } from '@nelyx/material/slider-theme';
import {
  RangeSliderTrackShape,
  RangeSliderThumbShape,
  RangeSliderTickMarkShape,
  RangeSliderValueIndicatorShape,
  SliderComponentShape,
  registerNativeRangeSliderShape,
} from '@nelyx/material/slider-shapes';
import type {
  RangeSliderTrackPaintOptions,
  RangeSliderThumbPaintOptions,
  RangeSliderTickMarkPaintOptions,
  RangeSliderTickMarkSizeOptions,
  SliderComponentPaintOptions,
  RangeSliderIndicatorSizeOptions,
  RangeSliderIndicatorShiftOptions,
  RangeSliderIndicatorPaintOptions,
  NativeRangeSliderIndicatorContext,
} from '@nelyx/material/slider-shapes';

const op = (name: Exclude<Scalar, number>['op'], ...args: Scalar[]): Scalar => ({ op: name, args });
const add = (a: Scalar, b: Scalar) => op('add', a, b),
  sub = (a: Scalar, b: Scalar) => op('subtract', a, b),
  mul = (a: Scalar, b: Scalar) => op('multiply', a, b);
const shape = {
  kind: 'rrect' as const,
  radii: Array(8).fill(0),
  strokeWidth: 0,
  strokeAlign: 0,
  strokeColor: 0,
};
function box(
  x: Scalar,
  y: Scalar,
  w: Scalar,
  h: Scalar,
  color: number,
  radius = 0,
): NativePaintEntry {
  return {
    kind: 'shape',
    color,
    shape,
    geometry: { kind: 'program', rect: [x, y, w, h], radii: Array(8).fill(radius) },
  };
}
const blend = (disabled: Color | null, enabled: Color | null, amount: number) =>
  Color.lerp(disabled, enabled, amount)!.toARGB32();
function draw(context: PaintingContext, rect: Rect, color: number, radius = 0): void {
  context.canvas.drawRRect(RRect.fromRectXY(rect, radius, radius), new Paint({ color }));
}
const trackInset = (enabled: boolean, discrete: boolean) =>
  24 + (enabled ? 2 : 0) + (discrete ? 1 : 0);

export class DemoRangeTrack extends RangeSliderTrackShape {
  override getPreferredRect({
    parentBox,
    offset = Offset.zero,
    isEnabled = false,
    isDiscrete = false,
  }: Parameters<RangeSliderTrackShape['getPreferredRect']>[0]): Rect {
    const inset = Math.min(parentBox.size.width / 2, trackInset(isEnabled, isDiscrete));
    return Rect.fromLTWH(
      offset.dx + inset,
      offset.dy + parentBox.size.height / 2 - 3,
      Math.max(0, parentBox.size.width - 2 * inset),
      6,
    );
  }
  override paint(
    context: PaintingContext,
    offset: Offset,
    options: RangeSliderTrackPaintOptions,
  ): void {
    const rect = this.getPreferredRect({ ...options, offset }),
      t = options.sliderTheme,
      amount = unwrapSourceDartNum(options.enableAnimation.value),
      first = Math.max(rect.left, Math.min(options.startThumbCenter.dx, options.endThumbCenter.dx)),
      last = Math.min(rect.right, Math.max(options.startThumbCenter.dx, options.endThumbCenter.dx));
    draw(context, rect, blend(t.disabledInactiveTrackColor, t.inactiveTrackColor, amount), 3);
    draw(
      context,
      Rect.fromLTWH(first, rect.top, Math.max(0, last - first), rect.height),
      blend(t.disabledActiveTrackColor, t.activeTrackColor, amount),
      3,
    );
  }
}
export class DemoRangeThumb extends RangeSliderThumbShape {
  override getPreferredSize(): Size {
    return new Size(14, 22);
  }
  override paint(
    context: PaintingContext,
    center: Offset,
    options: RangeSliderThumbPaintOptions,
  ): void {
    draw(
      context,
      Rect.fromLTWH(center.dx - 7, center.dy - 11, 14, 22),
      blend(
        options.sliderTheme.disabledThumbColor,
        options.sliderTheme.thumbColor,
        unwrapSourceDartNum(options.enableAnimation.value),
      ),
      4,
    );
  }
}
export class DemoRangeTick extends RangeSliderTickMarkShape {
  override getPreferredSize(_options: RangeSliderTickMarkSizeOptions): Size {
    return new Size(0.4, 0.4);
  }
  override paint(
    context: PaintingContext,
    center: Offset,
    options: RangeSliderTickMarkPaintOptions,
  ): void {
    const between =
        center.dx > Math.min(options.startThumbCenter.dx, options.endThumbCenter.dx) &&
        center.dx < Math.max(options.startThumbCenter.dx, options.endThumbCenter.dx),
      t = options.sliderTheme;
    draw(
      context,
      Rect.fromLTWH(center.dx - 0.2, center.dy - 0.2, 0.4, 0.4),
      blend(
        between ? t.disabledActiveTickMarkColor : t.disabledInactiveTickMarkColor,
        between ? t.activeTickMarkColor : t.inactiveTickMarkColor,
        unwrapSourceDartNum(options.enableAnimation.value),
      ),
      0.2,
    );
  }
}
export class DemoRangeOverlay extends SliderComponentShape {
  override getPreferredSize(): Size {
    return new Size(40, 40);
  }
  override paint(
    context: PaintingContext,
    center: Offset,
    options: SliderComponentPaintOptions,
  ): void {
    const radius = 20 * unwrapSourceDartNum(options.activationAnimation.value);
    draw(
      context,
      Rect.fromLTWH(center.dx - radius, center.dy - radius, radius * 2, radius * 2),
      options.sliderTheme.overlayColor!.toARGB32(),
      radius,
    );
  }
}
export class DemoRangeIndicator extends RangeSliderValueIndicatorShape {
  override getPreferredSize(
    _enabled: boolean,
    _discrete: boolean,
    options: RangeSliderIndicatorSizeOptions,
  ): Size {
    return new Size(options.labelPainter.width + 16, options.labelPainter.height + 12);
  }
  override getHorizontalShift(options: RangeSliderIndicatorShiftOptions = {}): number {
    if (!options.parentBox || !options.center || !options.labelPainter) return 0;
    const x = options.parentBox.localToGlobal(options.center).x,
      half = options.labelPainter.width / 2 + 8,
      width = options.sizeWithOverflow?.width ?? options.parentBox.size.width;
    return Math.max(8 + half - x, Math.min(0, width - 8 - half - x));
  }
  override paint(
    context: PaintingContext,
    center: Offset,
    options: RangeSliderIndicatorPaintOptions,
  ): void {
    const a = unwrapSourceDartNum(options.activationAnimation.value),
      painter = options.labelPainter,
      shift = this.getHorizontalShift({ ...options, center });
    const canvas = context.canvas;
    canvas.save();
    try {
      canvas.translate(center.dx, center.dy);
      canvas.scale(a, a);
      draw(
        context,
        Rect.fromLTWH(
          shift - painter.width / 2 - 8,
          -painter.height - 40,
          painter.width + 16,
          painter.height + 12,
        ),
        options.sliderTheme.valueIndicatorColor!.toARGB32(),
        5,
      );
      painter.paint(canvas, new Offset(shift - painter.width / 2, -painter.height - 34));
    } finally {
      canvas.restore();
    }
  }
}

registerNativeRangeSliderShape(DemoRangeTrack.prototype, {
  kind: 'track',
  rect: (_, { enabled, discrete }) => {
    const inset = op('min', mul(op('width'), 0.5), trackInset(enabled, discrete));
    return {
      left: inset,
      top: sub(mul(op('height'), 0.5), 3),
      width: op('max', 0, sub(op('width'), mul(2, inset))),
      height: 6,
    };
  },
  paint: (_, { source: s, geometry: g }) => [
    box(
      g.left,
      g.top,
      g.width,
      g.height,
      blend(s.theme.disabledInactiveTrackColor, s.theme.inactiveTrackColor, s.enable),
      3,
    ),
    box(
      op('max', g.left, g.first),
      g.top,
      op('max', 0, sub(op('min', g.right, g.last), op('max', g.left, g.first))),
      g.height,
      blend(s.theme.disabledActiveTrackColor, s.theme.activeTrackColor, s.enable),
      3,
    ),
  ],
});
registerNativeRangeSliderShape(DemoRangeThumb.prototype, {
  kind: 'thumb',
  paint: (_, { center: [x, y], source: s }) => [
    box(
      sub(x, 7),
      sub(y, 11),
      14,
      22,
      blend(s.theme.disabledThumbColor, s.theme.thumbColor, s.enable),
      4,
    ),
  ],
});
registerNativeRangeSliderShape(DemoRangeTick.prototype, {
  kind: 'tick',
  repeat: true,
  paint: (_, { center: [x, y], source: s, geometry: g }) => {
    const between = mul(op('greater', x, g.first), op('less', x, g.last)),
      t = s.theme;
    const entry = box(sub(x, 0.2), sub(y, 0.2), 0.4, 0.4, 0, 0.2);
    return [
      {
        ...entry,
        geometry: {
          ...(entry.geometry as Extract<NativePaintEntry['geometry'], { kind: 'program' }>),
          color: op(
            'select',
            between,
            blend(t.disabledActiveTickMarkColor, t.activeTickMarkColor, s.enable),
            blend(t.disabledInactiveTickMarkColor, t.inactiveTickMarkColor, s.enable),
          ),
        },
      },
    ];
  },
});
registerNativeRangeSliderShape(DemoRangeOverlay.prototype, {
  kind: 'overlay',
  paint: (_, { center: [x, y], activation, source: s }) => {
    const radius = 20 * activation;
    return [
      box(
        sub(x, radius),
        sub(y, radius),
        radius * 2,
        radius * 2,
        s.theme.overlayColor!.toARGB32(),
        radius,
      ),
    ];
  },
});
function indicatorShift(c: NativeRangeSliderIndicatorContext): Scalar {
  const x = op('worldX', c.center[0], c.center[1]),
    half = c.label.width / 2 + 8,
    width = c.screenWidth ?? op('width');
  return op('max', sub(8 + half, x), op('min', 0, sub(sub(width, 8 + half), x)));
}
registerNativeRangeSliderShape(DemoRangeIndicator.prototype, {
  kind: 'indicator',
  horizontalShift: (_, c) => indicatorShift(c),
  paint: (_, c) => {
    const a = c.activation,
      x = add(c.center[0], mul(sub(indicatorShift(c), c.label.width / 2), a)),
      y = sub(c.center[1], (c.label.height + 34) * a);
    return [
      box(
        sub(x, 8 * a),
        sub(y, 6 * a),
        (c.label.width + 16) * a,
        (c.label.height + 12) * a,
        c.source.theme.valueIndicatorColor!.toARGB32(),
        5 * a,
      ),
      ...c.label.entries.map((entry) => {
        if (entry.geometry?.kind !== 'program') throw Error('Invalid Demo label geometry');
        const r = entry.geometry.rect;
        return {
          ...entry,
          geometry: {
            kind: 'program' as const,
            rect: [add(x, mul(r[0], a)), add(y, mul(r[1], a)), mul(r[2], a), mul(r[3], a)] as const,
          },
        };
      }),
    ];
  },
});

export const demoRangeTheme = new SliderThemeData({
  rangeTrackShape: new DemoRangeTrack(),
  rangeThumbShape: new DemoRangeThumb(),
  rangeTickMarkShape: new DemoRangeTick(),
  overlayShape: new DemoRangeOverlay(),
  rangeValueIndicatorShape: new DemoRangeIndicator(),
});
