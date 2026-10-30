// SPDX-License-Identifier: BSD-3-Clause
// Original shape owners and complete bodies, retaining each Dart library's private namespace.
export {
  SliderComponentShape,
  RoundSliderOverlayShape,
  RectangularSliderValueIndicatorShape,
  RectangularRangeSliderValueIndicatorShape,
  PaddleSliderValueIndicatorShape,
  PaddleRangeSliderValueIndicatorShape,
} from './generated/slider/slider-value-indicator-shape.generated.ts';
export {
  SliderTickMarkShape,
  SliderTrackShape,
  BaseSliderTrackShape,
  RectangularSliderTrackShape,
  RoundedRectSliderTrackShape,
  RoundSliderTickMarkShape,
  RoundSliderThumbShape,
  DropSliderValueIndicatorShape,
  HandleThumbShape,
  GappedSliderTrackShape,
  RoundedRectSliderValueIndicatorShape,
} from './generated/slider/slider-parts.generated.ts';
export {
  RangeSliderThumbShape,
  RangeSliderValueIndicatorShape,
  RangeSliderTickMarkShape,
  RangeSliderTrackShape,
  BaseRangeSliderTrackShape,
  RectangularRangeSliderTrackShape,
  RoundedRectRangeSliderTrackShape,
  RoundRangeSliderTickMarkShape,
  RoundRangeSliderThumbShape,
  GappedRangeSliderTrackShape,
  HandleRangeSliderThumbShape,
  RoundedRectRangeSliderValueIndicatorShape,
  DropRangeSliderValueIndicatorShape,
} from './generated/slider/range-slider-parts.generated.ts';
import type { SliderComponentShape } from './generated/slider/slider-value-indicator-shape.generated.ts';
import type {
  SliderTickMarkShape,
  SliderTrackShape,
} from './generated/slider/slider-parts.generated.ts';
import type {
  RangeSliderThumbShape,
  RangeSliderValueIndicatorShape,
  RangeSliderTickMarkShape,
  RangeSliderTrackShape,
} from './generated/slider/range-slider-parts.generated.ts';
export type SliderComponentPaintOptions = Parameters<SliderComponentShape['paint']>[2];
export type SliderTickMarkSizeOptions = Parameters<SliderTickMarkShape['getPreferredSize']>[0];
export type SliderTickMarkPaintOptions = Parameters<SliderTickMarkShape['paint']>[2];
export type SliderTrackRectOptions = Parameters<SliderTrackShape['getPreferredRect']>[0];
export type SliderTrackPaintOptions = Parameters<SliderTrackShape['paint']>[2];
export type RangeSliderThumbPaintOptions = Parameters<RangeSliderThumbShape['paint']>[2];
export type RangeSliderIndicatorSizeOptions = Parameters<
  RangeSliderValueIndicatorShape['getPreferredSize']
>[2];
export type RangeSliderIndicatorShiftOptions = NonNullable<
  Parameters<RangeSliderValueIndicatorShape['getHorizontalShift']>[0]
>;
export type RangeSliderIndicatorPaintOptions = Parameters<
  RangeSliderValueIndicatorShape['paint']
>[2];
export type RangeSliderTickMarkSizeOptions = Parameters<
  RangeSliderTickMarkShape['getPreferredSize']
>[0];
export type RangeSliderTickMarkPaintOptions = Parameters<RangeSliderTickMarkShape['paint']>[2];
export type RangeSliderTrackPaintOptions = Parameters<RangeSliderTrackShape['paint']>[2];
