// SPDX-License-Identifier: BSD-3-Clause
import { Color } from '@nelyx/core/ui/color';
import { Offset } from '@nelyx/core/ui/offset';
import { Rect } from '@nelyx/core/ui/rect';
import { RRect } from '@nelyx/core/ui/rrect';
import { Paint } from '@nelyx/core/ui/paint';
import { Size } from '@nelyx/core/ui/size';
import type { PaintingContext } from '@nelyx/core/framework/painting/context';
import { SliderThemeData } from '@nelyx/material/slider-theme';
import {
  RangeSliderTrackShape,
  RangeSliderThumbShape,
  RoundRangeSliderTickMarkShape,
  RangeSliderValueIndicatorShape,
  SliderComponentShape,
} from '@nelyx/material/slider-shapes';
import type {
  RangeSliderTrackPaintOptions,
  RangeSliderThumbPaintOptions,
  SliderComponentPaintOptions,
  RangeSliderIndicatorSizeOptions,
  RangeSliderIndicatorShiftOptions,
  RangeSliderIndicatorPaintOptions,
} from '@nelyx/material/slider-shapes';
const blend = (disabled: Color | null, enabled: Color | null, amount: number) =>
  Color.lerp(disabled, enabled, amount)!.toARGB32();
function draw(context: PaintingContext, rect: Rect, color: number, radius = 0): void {
  context.canvas.drawRRect(RRect.fromRectXY(rect, radius, radius), new Paint({ color }));
}
export class DemoRangeTrack extends RangeSliderTrackShape {
  override getPreferredRect({
    parentBox,
    offset = Offset.zero,
  }: Parameters<RangeSliderTrackShape['getPreferredRect']>[0]): Rect {
    // Paint, thumb layout and drag mapping ask for the track with different flags.
    const inset = Math.min(parentBox.size.width / 2, 27);
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
      amount = options.enableAnimation.value,
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
        options.enableAnimation.value,
      ),
      4,
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
    const radius = 20 * options.activationAnimation.value;
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
    const a = options.activationAnimation.value,
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

export const demoRangeTheme = new SliderThemeData({
  rangeTrackShape: new DemoRangeTrack(),
  rangeThumbShape: new DemoRangeThumb(),
  rangeTickMarkShape: new RoundRangeSliderTickMarkShape({ tickMarkRadius: 0.2 }),
  overlayShape: new DemoRangeOverlay(),
  rangeValueIndicatorShape: new DemoRangeIndicator(),
});
