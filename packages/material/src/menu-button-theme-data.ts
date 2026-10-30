// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
import { ButtonStyle } from "./button-style.ts";
import { Diagnosticable } from "@nelyx/core/foundation/diagnosticable";
import { DiagnosticsProperty } from "@nelyx/core/foundation/diagnostics";
import type { DiagnosticPropertiesBuilder } from "@nelyx/core/foundation/diagnostics";
import "@nelyx/core/foundation/diagnostic-properties";
import "@nelyx/core/internal/framework/painting/color-property.generated";
import { valueEquals, valueHash } from "@nelyx/core/framework/painting/value-equality";
export interface MenuButtonThemeDataOptions {
  readonly style?: ButtonStyle | null;
}
export class MenuButtonThemeData extends Diagnosticable(class {}) {
  readonly style: ButtonStyle | null;
  constructor(options: MenuButtonThemeDataOptions = {}) {
    super();
    this.style = options.style ?? null;
    if (new.target === MenuButtonThemeData) Object.freeze(this);
  }
  /** @dartParam t double */
  static lerp(a: MenuButtonThemeData | null, b: MenuButtonThemeData | null, t: number): MenuButtonThemeData | null {
    if ((a === b)) {
    return a;
}
    return new MenuButtonThemeData({
      style: ButtonStyle.lerp((a?.style ?? null), (b?.style ?? null), t),
    });
}
  equals(other: unknown): boolean { return this === other || other instanceof MenuButtonThemeData && other.constructor === this.constructor && valueEquals(this.style, other.style); }
  /** @dartReturn int */
  get hashCode(): number { return valueHash(this.style); }
  override debugFillProperties(properties: DiagnosticPropertiesBuilder): void {
    super.debugFillProperties(properties);
    properties.add(new DiagnosticsProperty("style", this.style, { defaultValue: null, typeName: "ButtonStyle" }));
  }
}
