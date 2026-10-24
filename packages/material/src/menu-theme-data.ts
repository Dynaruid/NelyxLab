// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
import { MenuStyle } from "./menu-style.ts";
import type { Widget } from "@nelyx/core/framework/widgets/framework";
import { WidgetStateProperty } from "@nelyx/core/framework/widgets/widget-state";
import { Diagnosticable } from "@nelyx/core/foundation/diagnosticable";
import { DiagnosticsProperty } from "@nelyx/core/foundation/diagnostics";
import type { DiagnosticPropertiesBuilder } from "@nelyx/core/foundation/diagnostics";
import { DoubleProperty, EnumProperty } from "@nelyx/core/foundation/diagnostic-properties";
import { ColorProperty } from "@nelyx/core/internal/framework/painting/color-property.generated";
import { valueEquals, valueHash, hashValues } from "@nelyx/core/framework/painting/value-equality";
export interface MenuThemeDataOptions {
  readonly style?: MenuStyle | null;
  readonly submenuIcon?: WidgetStateProperty<Widget | null> | null;
}
export class MenuThemeData extends Diagnosticable(class {}) {
  readonly style: MenuStyle | null;
  readonly submenuIcon: WidgetStateProperty<Widget | null> | null;
  constructor(options: MenuThemeDataOptions = {}) {
    super();
    this.style = options.style ?? null;
    this.submenuIcon = options.submenuIcon ?? null;
    if (new.target === MenuThemeData) Object.freeze(this);
  }
  /** @dartParam t double */
  static lerp(a: MenuThemeData | null, b: MenuThemeData | null, t: number): MenuThemeData | null {
    if ((a === b)) {
    return a;
}
    return new MenuThemeData({
      style: MenuStyle.lerp((a?.style ?? null), (b?.style ?? null), t),
      submenuIcon: ((t < 0.5) ? (a?.submenuIcon ?? null) : (b?.submenuIcon ?? null)),
    });
}
  equals(other: unknown): boolean { return this === other || other instanceof MenuThemeData && other.constructor === this.constructor && valueEquals(this.style, other.style) && valueEquals(this.submenuIcon, other.submenuIcon); }
  /** @dartReturn int */
  get hashCode(): number { return hashValues(this.style, this.submenuIcon); }
  override debugFillProperties(properties: DiagnosticPropertiesBuilder): void {
    super.debugFillProperties(properties);
    properties.add(new DiagnosticsProperty("style", this.style, { defaultValue: null, typeName: "MenuStyle" }));
    properties.add(new DiagnosticsProperty("submenuIcon", this.submenuIcon, { defaultValue: null, typeName: "WidgetStateProperty<Widget?>" }));
  }
}
