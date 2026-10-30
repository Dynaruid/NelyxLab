// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Managed resolved API projection; complete source value operations use canonical Core owners.
import type { WidgetStateProperty } from '@nelyx/core/framework/widgets/widget-state';
import type { MouseCursor } from '@nelyx/core/services/mouse-cursor';
import type { Color } from '@nelyx/core/ui/color';
import { OutlinedBorder } from '@nelyx/core/framework/painting/borders';
import type { BorderSide } from '@nelyx/core/framework/painting/borders';
import type { Icon } from '@nelyx/core/framework/widgets/icon';
import { EdgeInsetsGeometry } from '@nelyx/core/framework/painting/edge-insets';
import type { DartDouble } from '@nelyx/core/foundation/dart-numeric';
import type { MaterialTapTargetSize, VisualDensity } from '../../theme-data.ts';
import { Diagnosticable } from '@nelyx/core/foundation/diagnosticable';
import { DiagnosticsProperty } from '@nelyx/core/foundation/diagnostics';
import type { DiagnosticPropertiesBuilder } from '@nelyx/core/foundation/diagnostics';
import { DoubleProperty } from '@nelyx/core/foundation/diagnostic-properties';
import { valueEquals, hashValues } from '@nelyx/core/framework/painting/value-equality';
import { lerpDouble } from '@nelyx/core/internal/ui/lerp-double.generated';
import {
  lerpToggleColors,
  lerpToggleDoubles,
  lerpToggleSides,
} from '../../internal/toggle/toggle-theme-values.ts';
export interface CheckboxThemeOptions {
  readonly mouseCursor?: WidgetStateProperty<MouseCursor | null> | null;
  readonly fillColor?: WidgetStateProperty<Color | null> | null;
  readonly checkColor?: WidgetStateProperty<Color | null> | null;
  readonly overlayColor?: WidgetStateProperty<Color | null> | null;
  /** @dartType double? */ readonly splashRadius?: number | null;
  readonly materialTapTargetSize?: MaterialTapTargetSize | null;
  readonly visualDensity?: VisualDensity | null;
  readonly shape?: OutlinedBorder | null;
  readonly side?: BorderSide | null;
}
const CheckboxThemeDataFields = [
  'mouseCursor',
  'fillColor',
  'checkColor',
  'overlayColor',
  'splashRadius',
  'materialTapTargetSize',
  'visualDensity',
  'shape',
  'side',
] as const;
export class CheckboxThemeData extends Diagnosticable(class {}) {
  readonly mouseCursor: WidgetStateProperty<MouseCursor | null> | null;
  readonly fillColor: WidgetStateProperty<Color | null> | null;
  readonly checkColor: WidgetStateProperty<Color | null> | null;
  readonly overlayColor: WidgetStateProperty<Color | null> | null;
  /** @dartType double? */ readonly splashRadius: number | null;
  readonly materialTapTargetSize: MaterialTapTargetSize | null;
  readonly visualDensity: VisualDensity | null;
  readonly shape: OutlinedBorder | null;
  readonly side: BorderSide | null;
  /**
   * @dartParam splashRadius double?
   */
  constructor(o: CheckboxThemeOptions = {}) {
    super();
    this.mouseCursor = o.mouseCursor ?? null;
    this.fillColor = o.fillColor ?? null;
    this.checkColor = o.checkColor ?? null;
    this.overlayColor = o.overlayColor ?? null;
    this.splashRadius = o.splashRadius ?? null;
    this.materialTapTargetSize = o.materialTapTargetSize ?? null;
    this.visualDensity = o.visualDensity ?? null;
    this.shape = o.shape ?? null;
    this.side = o.side ?? null;
    if (new.target === CheckboxThemeData) Object.freeze(this);
  }
  /**
   * @dartParam splashRadius double?
   */
  copyWith(o: CheckboxThemeOptions = {}): CheckboxThemeData {
    return new CheckboxThemeData({
      mouseCursor: o.mouseCursor ?? this.mouseCursor,
      fillColor: o.fillColor ?? this.fillColor,
      checkColor: o.checkColor ?? this.checkColor,
      overlayColor: o.overlayColor ?? this.overlayColor,
      splashRadius: o.splashRadius ?? this.splashRadius,
      materialTapTargetSize: o.materialTapTargetSize ?? this.materialTapTargetSize,
      visualDensity: o.visualDensity ?? this.visualDensity,
      shape: o.shape ?? this.shape,
      side: o.side ?? this.side,
    });
  }
  /** @dartParam t double */ static lerp(
    a: CheckboxThemeData | null,
    b: CheckboxThemeData | null,
    t: number,
  ): CheckboxThemeData {
    if (a === b && a !== null) return a;
    return new CheckboxThemeData({
      mouseCursor: t < 0.5 ? (a?.mouseCursor ?? null) : (b?.mouseCursor ?? null),
      fillColor: lerpToggleColors(a?.fillColor ?? null, b?.fillColor ?? null, t),
      checkColor: lerpToggleColors(a?.checkColor ?? null, b?.checkColor ?? null, t),
      overlayColor: lerpToggleColors(a?.overlayColor ?? null, b?.overlayColor ?? null, t),
      splashRadius: lerpDouble(a?.splashRadius ?? null, b?.splashRadius ?? null, t),
      materialTapTargetSize:
        t < 0.5 ? (a?.materialTapTargetSize ?? null) : (b?.materialTapTargetSize ?? null),
      visualDensity: t < 0.5 ? (a?.visualDensity ?? null) : (b?.visualDensity ?? null),
      shape: OutlinedBorder.lerp(a?.shape ?? null, b?.shape ?? null, t),
      side: lerpToggleSides(a?.side ?? null, b?.side ?? null, t),
    });
  }
  equals(other: unknown): boolean {
    return (
      this === other ||
      (other instanceof CheckboxThemeData &&
        other.constructor === this.constructor &&
        CheckboxThemeDataFields.every((f) => valueEquals(this[f], other[f])))
    );
  }
  /** @dartReturn int */ get hashCode(): number {
    return hashValues(...CheckboxThemeDataFields.map((f) => this[f]));
  }
  override debugFillProperties(p: DiagnosticPropertiesBuilder): void {
    super.debugFillProperties(p);
    p.add(
      new DiagnosticsProperty('mouseCursor', this.mouseCursor, {
        defaultValue: null,
        typeName: 'WidgetStateProperty<MouseCursor?>',
      }),
    );
    p.add(
      new DiagnosticsProperty('fillColor', this.fillColor, {
        defaultValue: null,
        typeName: 'WidgetStateProperty<Color?>',
      }),
    );
    p.add(
      new DiagnosticsProperty('checkColor', this.checkColor, {
        defaultValue: null,
        typeName: 'WidgetStateProperty<Color?>',
      }),
    );
    p.add(
      new DiagnosticsProperty('overlayColor', this.overlayColor, {
        defaultValue: null,
        typeName: 'WidgetStateProperty<Color?>',
      }),
    );
    p.add(new DoubleProperty('splashRadius', this.splashRadius, { defaultValue: null }));
    p.add(
      new DiagnosticsProperty('materialTapTargetSize', this.materialTapTargetSize, {
        defaultValue: null,
        typeName: 'MaterialTapTargetSize',
      }),
    );
    p.add(
      new DiagnosticsProperty('visualDensity', this.visualDensity, {
        defaultValue: null,
        typeName: 'VisualDensity',
      }),
    );
    p.add(
      new DiagnosticsProperty('shape', this.shape, {
        defaultValue: null,
        typeName: 'OutlinedBorder',
      }),
    );
    p.add(
      new DiagnosticsProperty('side', this.side, { defaultValue: null, typeName: 'BorderSide' }),
    );
  }
}
export interface RadioThemeOptions {
  readonly mouseCursor?: WidgetStateProperty<MouseCursor | null> | null;
  readonly fillColor?: WidgetStateProperty<Color | null> | null;
  readonly overlayColor?: WidgetStateProperty<Color | null> | null;
  /** @dartType double? */ readonly splashRadius?: number | null;
  readonly materialTapTargetSize?: MaterialTapTargetSize | null;
  readonly visualDensity?: VisualDensity | null;
  readonly backgroundColor?: WidgetStateProperty<Color | null> | null;
  readonly side?: BorderSide | null;
  /** @dartType WidgetStateProperty<double?>? */ readonly innerRadius?: WidgetStateProperty<DartDouble | null> | null;
}
const RadioThemeDataFields = [
  'mouseCursor',
  'fillColor',
  'overlayColor',
  'splashRadius',
  'materialTapTargetSize',
  'visualDensity',
  'backgroundColor',
  'side',
  'innerRadius',
] as const;
export class RadioThemeData extends Diagnosticable(class {}) {
  readonly mouseCursor: WidgetStateProperty<MouseCursor | null> | null;
  readonly fillColor: WidgetStateProperty<Color | null> | null;
  readonly overlayColor: WidgetStateProperty<Color | null> | null;
  /** @dartType double? */ readonly splashRadius: number | null;
  readonly materialTapTargetSize: MaterialTapTargetSize | null;
  readonly visualDensity: VisualDensity | null;
  readonly backgroundColor: WidgetStateProperty<Color | null> | null;
  readonly side: BorderSide | null;
  /** @dartType WidgetStateProperty<double?>? */ readonly innerRadius: WidgetStateProperty<DartDouble | null> | null;
  /**
   * @dartParam splashRadius double?
   * @dartParam innerRadius WidgetStateProperty<double?>?
   */
  constructor(o: RadioThemeOptions = {}) {
    super();
    this.mouseCursor = o.mouseCursor ?? null;
    this.fillColor = o.fillColor ?? null;
    this.overlayColor = o.overlayColor ?? null;
    this.splashRadius = o.splashRadius ?? null;
    this.materialTapTargetSize = o.materialTapTargetSize ?? null;
    this.visualDensity = o.visualDensity ?? null;
    this.backgroundColor = o.backgroundColor ?? null;
    this.side = o.side ?? null;
    this.innerRadius = o.innerRadius ?? null;
    if (new.target === RadioThemeData) Object.freeze(this);
  }
  /**
   * @dartParam splashRadius double?
   * @dartParam innerRadius WidgetStateProperty<double?>?
   */
  copyWith(o: RadioThemeOptions = {}): RadioThemeData {
    return new RadioThemeData({
      mouseCursor: o.mouseCursor ?? this.mouseCursor,
      fillColor: o.fillColor ?? this.fillColor,
      overlayColor: o.overlayColor ?? this.overlayColor,
      splashRadius: o.splashRadius ?? this.splashRadius,
      materialTapTargetSize: o.materialTapTargetSize ?? this.materialTapTargetSize,
      visualDensity: o.visualDensity ?? this.visualDensity,
      backgroundColor: o.backgroundColor ?? this.backgroundColor,
      side: o.side ?? this.side,
      innerRadius: o.innerRadius ?? this.innerRadius,
    });
  }
  /** @dartParam t double */ static lerp(
    a: RadioThemeData | null,
    b: RadioThemeData | null,
    t: number,
  ): RadioThemeData {
    if (a === b && a !== null) return a;
    return new RadioThemeData({
      mouseCursor: t < 0.5 ? (a?.mouseCursor ?? null) : (b?.mouseCursor ?? null),
      fillColor: lerpToggleColors(a?.fillColor ?? null, b?.fillColor ?? null, t),
      overlayColor: lerpToggleColors(a?.overlayColor ?? null, b?.overlayColor ?? null, t),
      splashRadius: lerpDouble(a?.splashRadius ?? null, b?.splashRadius ?? null, t),
      materialTapTargetSize:
        t < 0.5 ? (a?.materialTapTargetSize ?? null) : (b?.materialTapTargetSize ?? null),
      visualDensity: t < 0.5 ? (a?.visualDensity ?? null) : (b?.visualDensity ?? null),
      backgroundColor: lerpToggleColors(a?.backgroundColor ?? null, b?.backgroundColor ?? null, t),
      side: lerpToggleSides(a?.side ?? null, b?.side ?? null, t),
      innerRadius: lerpToggleDoubles(a?.innerRadius ?? null, b?.innerRadius ?? null, t),
    });
  }
  equals(other: unknown): boolean {
    return (
      this === other ||
      (other instanceof RadioThemeData &&
        other.constructor === this.constructor &&
        RadioThemeDataFields.every((f) => valueEquals(this[f], other[f])))
    );
  }
  /** @dartReturn int */ get hashCode(): number {
    return hashValues(...RadioThemeDataFields.map((f) => this[f]));
  }
  override debugFillProperties(p: DiagnosticPropertiesBuilder): void {
    super.debugFillProperties(p);
    p.add(
      new DiagnosticsProperty('mouseCursor', this.mouseCursor, {
        defaultValue: null,
        typeName: 'WidgetStateProperty<MouseCursor?>',
      }),
    );
    p.add(
      new DiagnosticsProperty('fillColor', this.fillColor, {
        defaultValue: null,
        typeName: 'WidgetStateProperty<Color?>',
      }),
    );
    p.add(
      new DiagnosticsProperty('overlayColor', this.overlayColor, {
        defaultValue: null,
        typeName: 'WidgetStateProperty<Color?>',
      }),
    );
    p.add(new DoubleProperty('splashRadius', this.splashRadius, { defaultValue: null }));
    p.add(
      new DiagnosticsProperty('materialTapTargetSize', this.materialTapTargetSize, {
        defaultValue: null,
        typeName: 'MaterialTapTargetSize',
      }),
    );
    p.add(
      new DiagnosticsProperty('visualDensity', this.visualDensity, {
        defaultValue: null,
        typeName: 'VisualDensity',
      }),
    );
    p.add(
      new DiagnosticsProperty('backgroundColor', this.backgroundColor, {
        defaultValue: null,
        typeName: 'WidgetStateProperty<Color?>',
      }),
    );
    p.add(
      new DiagnosticsProperty('side', this.side, { defaultValue: null, typeName: 'BorderSide' }),
    );
    p.add(
      new DiagnosticsProperty('innerRadius', this.innerRadius, {
        defaultValue: null,
        typeName: 'WidgetStateProperty<double?>',
      }),
    );
  }
}
export interface SwitchThemeOptions {
  readonly thumbColor?: WidgetStateProperty<Color | null> | null;
  readonly trackColor?: WidgetStateProperty<Color | null> | null;
  readonly trackOutlineColor?: WidgetStateProperty<Color | null> | null;
  /** @dartType WidgetStateProperty<double?>? */ readonly trackOutlineWidth?: WidgetStateProperty<DartDouble | null> | null;
  readonly materialTapTargetSize?: MaterialTapTargetSize | null;
  readonly mouseCursor?: WidgetStateProperty<MouseCursor | null> | null;
  readonly overlayColor?: WidgetStateProperty<Color | null> | null;
  /** @dartType double? */ readonly splashRadius?: number | null;
  readonly thumbIcon?: WidgetStateProperty<Icon | null> | null;
  readonly padding?: EdgeInsetsGeometry | null;
}
const SwitchThemeDataFields = [
  'thumbColor',
  'trackColor',
  'trackOutlineColor',
  'trackOutlineWidth',
  'materialTapTargetSize',
  'mouseCursor',
  'overlayColor',
  'splashRadius',
  'thumbIcon',
  'padding',
] as const;
export class SwitchThemeData extends Diagnosticable(class {}) {
  readonly thumbColor: WidgetStateProperty<Color | null> | null;
  readonly trackColor: WidgetStateProperty<Color | null> | null;
  readonly trackOutlineColor: WidgetStateProperty<Color | null> | null;
  /** @dartType WidgetStateProperty<double?>? */ readonly trackOutlineWidth: WidgetStateProperty<DartDouble | null> | null;
  readonly materialTapTargetSize: MaterialTapTargetSize | null;
  readonly mouseCursor: WidgetStateProperty<MouseCursor | null> | null;
  readonly overlayColor: WidgetStateProperty<Color | null> | null;
  /** @dartType double? */ readonly splashRadius: number | null;
  readonly thumbIcon: WidgetStateProperty<Icon | null> | null;
  readonly padding: EdgeInsetsGeometry | null;
  /**
   * @dartParam trackOutlineWidth WidgetStateProperty<double?>?
   * @dartParam splashRadius double?
   */
  constructor(o: SwitchThemeOptions = {}) {
    super();
    this.thumbColor = o.thumbColor ?? null;
    this.trackColor = o.trackColor ?? null;
    this.trackOutlineColor = o.trackOutlineColor ?? null;
    this.trackOutlineWidth = o.trackOutlineWidth ?? null;
    this.materialTapTargetSize = o.materialTapTargetSize ?? null;
    this.mouseCursor = o.mouseCursor ?? null;
    this.overlayColor = o.overlayColor ?? null;
    this.splashRadius = o.splashRadius ?? null;
    this.thumbIcon = o.thumbIcon ?? null;
    this.padding = o.padding ?? null;
    if (new.target === SwitchThemeData) Object.freeze(this);
  }
  /**
   * @dartParam trackOutlineWidth WidgetStateProperty<double?>?
   * @dartParam splashRadius double?
   */
  copyWith(o: SwitchThemeOptions = {}): SwitchThemeData {
    return new SwitchThemeData({
      thumbColor: o.thumbColor ?? this.thumbColor,
      trackColor: o.trackColor ?? this.trackColor,
      trackOutlineColor: o.trackOutlineColor ?? this.trackOutlineColor,
      trackOutlineWidth: o.trackOutlineWidth ?? this.trackOutlineWidth,
      materialTapTargetSize: o.materialTapTargetSize ?? this.materialTapTargetSize,
      mouseCursor: o.mouseCursor ?? this.mouseCursor,
      overlayColor: o.overlayColor ?? this.overlayColor,
      splashRadius: o.splashRadius ?? this.splashRadius,
      thumbIcon: o.thumbIcon ?? this.thumbIcon,
      padding: o.padding ?? this.padding,
    });
  }
  /** @dartParam t double */ static lerp(
    a: SwitchThemeData | null,
    b: SwitchThemeData | null,
    t: number,
  ): SwitchThemeData {
    if (a === b && a !== null) return a;
    return new SwitchThemeData({
      thumbColor: lerpToggleColors(a?.thumbColor ?? null, b?.thumbColor ?? null, t),
      trackColor: lerpToggleColors(a?.trackColor ?? null, b?.trackColor ?? null, t),
      trackOutlineColor: lerpToggleColors(
        a?.trackOutlineColor ?? null,
        b?.trackOutlineColor ?? null,
        t,
      ),
      trackOutlineWidth: lerpToggleDoubles(
        a?.trackOutlineWidth ?? null,
        b?.trackOutlineWidth ?? null,
        t,
      ),
      materialTapTargetSize:
        t < 0.5 ? (a?.materialTapTargetSize ?? null) : (b?.materialTapTargetSize ?? null),
      mouseCursor: t < 0.5 ? (a?.mouseCursor ?? null) : (b?.mouseCursor ?? null),
      overlayColor: lerpToggleColors(a?.overlayColor ?? null, b?.overlayColor ?? null, t),
      splashRadius: lerpDouble(a?.splashRadius ?? null, b?.splashRadius ?? null, t),
      thumbIcon: t < 0.5 ? (a?.thumbIcon ?? null) : (b?.thumbIcon ?? null),
      padding: EdgeInsetsGeometry.lerp(a?.padding ?? null, b?.padding ?? null, t),
    });
  }
  equals(other: unknown): boolean {
    return (
      this === other ||
      (other instanceof SwitchThemeData &&
        other.constructor === this.constructor &&
        SwitchThemeDataFields.every((f) => valueEquals(this[f], other[f])))
    );
  }
  /** @dartReturn int */ get hashCode(): number {
    return hashValues(...SwitchThemeDataFields.map((f) => this[f]));
  }
  override debugFillProperties(p: DiagnosticPropertiesBuilder): void {
    super.debugFillProperties(p);
    p.add(
      new DiagnosticsProperty('thumbColor', this.thumbColor, {
        defaultValue: null,
        typeName: 'WidgetStateProperty<Color?>',
      }),
    );
    p.add(
      new DiagnosticsProperty('trackColor', this.trackColor, {
        defaultValue: null,
        typeName: 'WidgetStateProperty<Color?>',
      }),
    );
    p.add(
      new DiagnosticsProperty('trackOutlineColor', this.trackOutlineColor, {
        defaultValue: null,
        typeName: 'WidgetStateProperty<Color?>',
      }),
    );
    p.add(
      new DiagnosticsProperty('trackOutlineWidth', this.trackOutlineWidth, {
        defaultValue: null,
        typeName: 'WidgetStateProperty<double?>',
      }),
    );
    p.add(
      new DiagnosticsProperty('materialTapTargetSize', this.materialTapTargetSize, {
        defaultValue: null,
        typeName: 'MaterialTapTargetSize',
      }),
    );
    p.add(
      new DiagnosticsProperty('mouseCursor', this.mouseCursor, {
        defaultValue: null,
        typeName: 'WidgetStateProperty<MouseCursor?>',
      }),
    );
    p.add(
      new DiagnosticsProperty('overlayColor', this.overlayColor, {
        defaultValue: null,
        typeName: 'WidgetStateProperty<Color?>',
      }),
    );
    p.add(new DoubleProperty('splashRadius', this.splashRadius, { defaultValue: null }));
    p.add(
      new DiagnosticsProperty('thumbIcon', this.thumbIcon, {
        defaultValue: null,
        typeName: 'WidgetStateProperty<Icon?>',
      }),
    );
    p.add(
      new DiagnosticsProperty('padding', this.padding, {
        defaultValue: null,
        typeName: 'EdgeInsetsGeometry',
      }),
    );
  }
}
