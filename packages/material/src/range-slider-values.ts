// SPDX-License-Identifier: BSD-3-Clause
export { RangeValues, RangeLabels } from "./generated/slider/range-slider-parts-values.generated.ts";
import type { RangeValues } from "./generated/slider/range-slider-parts-values.generated.ts";
import type { Thumb } from "./generated/slider/slider-theme-values.generated.ts";
import type { Size } from '@nelyx/core/ui/size';
/** @dartParam tapValue double
 * @dartParam dx double
 * Source RangeThumbSelector resolved signature; receiver geometry uses the actual Core Size.
 */
export type RangeThumbSelector = (textDirection: 'ltr' | 'rtl', values: RangeValues, tapValue: number, thumbSize: Size, trackSize: Size, dx: number) => Thumb | null;
