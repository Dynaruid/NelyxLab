// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Resolved pinned API/default projection; functional build/paint share existing Core owners.
import {canonicalDartList} from '@nelyx/core/internal/foundation/dart-const';import {dartDoubleType} from '@nelyx/core/foundation/dart-type-witness';import {DartDouble} from '@nelyx/core/foundation/dart-numeric';import {Color} from '@nelyx/core/ui/color';import {constSourceColor} from '@nelyx/core/ui/color-source';import {CupertinoColors,constCupertinoDynamicColorWithBrightness} from "../../colors.ts";
export const _kDisabledCheckColor=constCupertinoDynamicColorWithBrightness({color:constSourceColor(Color,1073741824),darkColor:constSourceColor(Color,1090519039)});
export const _kDisabledBorderColor=constCupertinoDynamicColorWithBrightness({color:constSourceColor(Color,218103808),darkColor:constSourceColor(Color,218103808)});
export const _kDefaultBorderColor=constCupertinoDynamicColorWithBrightness({color:constSourceColor(Color,4291940822),darkColor:constSourceColor(Color,847282304)});
export const _kDefaultFillColor=constCupertinoDynamicColorWithBrightness({color:CupertinoColors.activeBlue,darkColor:constSourceColor(Color,4281492695)});
export const _kDefaultCheckColor=constCupertinoDynamicColorWithBrightness({color:CupertinoColors.white,darkColor:constSourceColor(Color,4292798712)});
/** @dartType double */ export const _kPressedOverlayOpacity=0.15;
/** @dartType List<double> */ export const _kDarkGradientOpacities=canonicalDartList(dartDoubleType,[DartDouble.fromSource(0.14),DartDouble.fromSource(0.29)]);
/** @dartType List<double> */ export const _kDisabledDarkGradientOpacities=canonicalDartList(dartDoubleType,[DartDouble.fromSource(0.08),DartDouble.fromSource(0.14)]);
/** @dartType double */ export const kMinInteractiveDimensionCupertino=44;
/** @dartType double */ export const kCupertinoFocusColorOpacity=0.8;
/** @dartType double */ export const kCupertinoFocusColorBrightness=0.69;
/** @dartType double */ export const kCupertinoFocusColorSaturation=0.835;
