// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
import { ButtonStyle } from "./button-style.ts";
import type { Widget } from "@nelyx/core/framework/widgets/framework";
import { Diagnosticable } from "@nelyx/core/foundation/diagnosticable";
import { DiagnosticsProperty } from "@nelyx/core/foundation/diagnostics";
import type { DiagnosticPropertiesBuilder } from "@nelyx/core/foundation/diagnostics";
import { DoubleProperty, EnumProperty } from "@nelyx/core/foundation/diagnostic-properties";
import { ColorProperty } from "@nelyx/core/internal/framework/painting/color-property.generated";
import { valueEquals, valueHash, hashValues } from "@nelyx/core/framework/painting/value-equality";
export interface SegmentedButtonThemeDataOptions {
  readonly style?: ButtonStyle | null;
  readonly selectedIcon?: Widget | null;
}
export class SegmentedButtonThemeData extends Diagnosticable(class {}) {
  readonly style: ButtonStyle | null;
  readonly selectedIcon: Widget | null;
  constructor(options: SegmentedButtonThemeDataOptions = {}) {
    super();
    this.style = options.style ?? null;
    this.selectedIcon = options.selectedIcon ?? null;
    if (new.target === SegmentedButtonThemeData) Object.freeze(this);
  }
  copyWith(options: SegmentedButtonThemeDataOptions = {}): SegmentedButtonThemeData {
    return new SegmentedButtonThemeData({
      style: options.style ?? this.style,
      selectedIcon: options.selectedIcon ?? this.selectedIcon,
    });
  }
  /** @dartParam t double */
  static lerp(a: SegmentedButtonThemeData | null, b: SegmentedButtonThemeData | null, t: number): SegmentedButtonThemeData {
    if (((a === b) && (a !== null))) {
    return a;
}
    return new SegmentedButtonThemeData({
      style: ButtonStyle.lerp((a?.style ?? null), (b?.style ?? null), t),
      selectedIcon: ((t < 0.5) ? (a?.selectedIcon ?? null) : (b?.selectedIcon ?? null)),
    });
}
  equals(other: unknown): boolean { return this === other || other instanceof SegmentedButtonThemeData && other.constructor === this.constructor && valueEquals(this.style, other.style) && valueEquals(this.selectedIcon, other.selectedIcon); }
  /** @dartReturn int */
  get hashCode(): number { return hashValues(this.style, this.selectedIcon); }
  override debugFillProperties(properties: DiagnosticPropertiesBuilder): void {
    super.debugFillProperties(properties);
    properties.add(new DiagnosticsProperty("style", this.style, { defaultValue: null, typeName: "ButtonStyle" }));
  }
}
