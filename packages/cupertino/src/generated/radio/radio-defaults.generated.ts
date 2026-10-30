// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Generated from verified analyzer-resolved cupertino/radio.dart constants.
import { canonicalDartList } from '@nelyx/core/internal/foundation/dart-const';
import { dartDoubleType } from '@nelyx/core/foundation/dart-type-witness';
import { DartDouble } from '@nelyx/core/foundation/dart-numeric';
import { Color } from '@nelyx/core/ui/color';
import { Size } from '@nelyx/core/ui/size';
import { constSourceColor } from '@nelyx/core/ui/color-source';
import { CupertinoColors, constCupertinoDynamicColorWithBrightness } from '../../colors.ts';
export const _size = Object.freeze(new Size(18, 18));
/** @dartType double */
export const _kOuterRadius = 7;
/** @dartType double */
export const _kInnerRadius = 2.975;
export const _kDisabledOuterColor = CupertinoColors.white.withOpacity(0.5);
export const _kDisabledInnerColor = constCupertinoDynamicColorWithBrightness({
  color: constSourceColor(Color, 1073741824),
  darkColor: constSourceColor(Color, 1090519039),
});
export const _kDisabledBorderColor = constCupertinoDynamicColorWithBrightness({
  color: constSourceColor(Color, 1073741824),
  darkColor: constSourceColor(Color, 1073741824),
});
export const _kDefaultBorderColor = constCupertinoDynamicColorWithBrightness({
  color: constSourceColor(Color, 4291940822),
  darkColor: constSourceColor(Color, 1073741824),
});
export const _kDefaultInnerColor = constCupertinoDynamicColorWithBrightness({
  color: CupertinoColors.white,
  darkColor: constSourceColor(Color, 4292798712),
});
export const _kDefaultOuterColor = constCupertinoDynamicColorWithBrightness({
  color: CupertinoColors.activeBlue,
  darkColor: constSourceColor(Color, 4281492695),
});
/** @dartType double */
export const _kPressedOverlayOpacity = 0.15;
/** @dartType double */
export const _kCheckmarkStrokeWidth = 2;
/** @dartType double */
export const _kFocusOutlineStrokeWidth = 3;
/** @dartType double */
export const _kBorderOutlineStrokeWidth = 0.3;
/** @dartType List<double> */
export const _kDarkGradientOpacities = canonicalDartList(dartDoubleType, [
  DartDouble.fromSource(0.14),
  DartDouble.fromSource(0.29),
]);
/** @dartType List<double> */
export const _kDisabledDarkGradientOpacities = canonicalDartList(dartDoubleType, [
  DartDouble.fromSource(0.08),
  DartDouble.fromSource(0.14),
]);
