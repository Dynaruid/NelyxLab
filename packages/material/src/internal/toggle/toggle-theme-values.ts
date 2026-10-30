// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
import { WidgetStateProperty } from '@nelyx/core/framework/widgets/widget-state';
import { WidgetStateBorderSide } from '@nelyx/core/framework/widgets/widget-state-border-side';
import { constEmptyWidgetStateSet } from '@nelyx/core/internal/framework/widgets/widget-state-full-collections';
import { BorderSide, withSourceBorderSideColor } from '@nelyx/core/framework/painting/borders';
import { sourceBorderSideColor } from '@nelyx/core/internal/framework/painting/border-side-source';
import { Color } from '@nelyx/core/ui/color';
import { nullableDartType, dartDoubleType } from '@nelyx/core/foundation/dart-type-witness';
import { sourceColorType, sourceColorLerp } from '@nelyx/core/ui/color-source';
import { DartDouble } from '@nelyx/core/foundation/dart-numeric';
import { lerpDouble } from '@nelyx/core/internal/ui/lerp-double.generated';
/** @dartParam t double */
export function lerpToggleColors(
  a: WidgetStateProperty<Color | null> | null,
  b: WidgetStateProperty<Color | null> | null,
  t: number,
): WidgetStateProperty<Color | null> | null {
  return WidgetStateProperty.lerp<Color | null>(
    nullableDartType(sourceColorType),
    a,
    b,
    t,
    sourceColorLerp,
  );
}
/** @dartParam t double */
export function lerpToggleDoubles(
  a: WidgetStateProperty<DartDouble | null> | null,
  b: WidgetStateProperty<DartDouble | null> | null,
  t: number,
): WidgetStateProperty<DartDouble | null> | null {
  return WidgetStateProperty.lerp<DartDouble | null>(
    nullableDartType(dartDoubleType),
    a,
    b,
    t,
    (x, y, q) => {
      const n = lerpDouble(x?.value ?? null, y?.value ?? null, q);
      return n === null ? null : DartDouble.fromSource(n);
    },
  );
}
/** @dartParam t double */
export function lerpToggleSides(
  a: BorderSide | null,
  b: BorderSide | null,
  t: number,
): BorderSide | null {
  if (a === null && b === null) return null;
  if (a instanceof WidgetStateBorderSide) a = a.resolve(constEmptyWidgetStateSet());
  if (b instanceof WidgetStateBorderSide) b = b.resolve(constEmptyWidgetStateSet());
  if (a === null && b === null)
    throw new TypeError('Source toggle theme side interpolation requires a non-null resolved side');
  a ??= withSourceBorderSideColor(
    new BorderSide({ width: 0 }),
    sourceBorderSideColor(b!).withAlpha(0),
  );
  b ??= withSourceBorderSideColor(
    new BorderSide({ width: 0 }),
    sourceBorderSideColor(a).withAlpha(0),
  );
  return BorderSide.lerp(a, b, t);
}
