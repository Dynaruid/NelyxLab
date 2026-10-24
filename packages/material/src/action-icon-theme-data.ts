// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
import type { BuildContext } from "@nelyx/core/framework/widgets/framework";
import type { Widget } from "@nelyx/core/framework/widgets/framework";
import { Diagnosticable } from "@nelyx/core/foundation/diagnosticable";
import { DiagnosticsProperty } from "@nelyx/core/foundation/diagnostics";
import type { DiagnosticPropertiesBuilder } from "@nelyx/core/foundation/diagnostics";
import { DoubleProperty, EnumProperty } from "@nelyx/core/foundation/diagnostic-properties";
import { ColorProperty } from "@nelyx/core/internal/framework/painting/color-property.generated";
import { valueEquals, valueHash, hashValues } from "@nelyx/core/framework/painting/value-equality";
import { sourceFunctionIdentity } from "@nelyx/core/internal/foundation/dart-function";
const builderIdentity = (value: ((context: BuildContext) => Widget) | null): Function | null => value === null ? null : sourceFunctionIdentity(value);
export interface ActionIconThemeDataOptions {
  readonly backButtonIconBuilder?: ((context: BuildContext) => Widget) | null;
  readonly closeButtonIconBuilder?: ((context: BuildContext) => Widget) | null;
  readonly drawerButtonIconBuilder?: ((context: BuildContext) => Widget) | null;
  readonly endDrawerButtonIconBuilder?: ((context: BuildContext) => Widget) | null;
}
export class ActionIconThemeData extends Diagnosticable(class {}) {
  readonly backButtonIconBuilder: ((context: BuildContext) => Widget) | null;
  readonly closeButtonIconBuilder: ((context: BuildContext) => Widget) | null;
  readonly drawerButtonIconBuilder: ((context: BuildContext) => Widget) | null;
  readonly endDrawerButtonIconBuilder: ((context: BuildContext) => Widget) | null;
  constructor(options: ActionIconThemeDataOptions = {}) {
    super();
    this.backButtonIconBuilder = options.backButtonIconBuilder ?? null;
    this.closeButtonIconBuilder = options.closeButtonIconBuilder ?? null;
    this.drawerButtonIconBuilder = options.drawerButtonIconBuilder ?? null;
    this.endDrawerButtonIconBuilder = options.endDrawerButtonIconBuilder ?? null;
    if (new.target === ActionIconThemeData) Object.freeze(this);
  }
  copyWith(options: ActionIconThemeDataOptions = {}): ActionIconThemeData {
    return new ActionIconThemeData({
      backButtonIconBuilder: options.backButtonIconBuilder ?? this.backButtonIconBuilder,
      closeButtonIconBuilder: options.closeButtonIconBuilder ?? this.closeButtonIconBuilder,
      drawerButtonIconBuilder: options.drawerButtonIconBuilder ?? this.drawerButtonIconBuilder,
      endDrawerButtonIconBuilder: options.endDrawerButtonIconBuilder ?? this.endDrawerButtonIconBuilder,
    });
  }
  /** @dartParam t double */
  static lerp(a: ActionIconThemeData | null, b: ActionIconThemeData | null, t: number): ActionIconThemeData | null {
    if (((a === null) && (b === null))) {
    return null;
}
    return new ActionIconThemeData({
      backButtonIconBuilder: ((t < 0.5) ? (a?.backButtonIconBuilder ?? null) : (b?.backButtonIconBuilder ?? null)),
      closeButtonIconBuilder: ((t < 0.5) ? (a?.closeButtonIconBuilder ?? null) : (b?.closeButtonIconBuilder ?? null)),
      drawerButtonIconBuilder: ((t < 0.5) ? (a?.drawerButtonIconBuilder ?? null) : (b?.drawerButtonIconBuilder ?? null)),
      endDrawerButtonIconBuilder: ((t < 0.5) ? (a?.endDrawerButtonIconBuilder ?? null) : (b?.endDrawerButtonIconBuilder ?? null)),
    });
}
  equals(other: unknown): boolean { return this === other || other instanceof ActionIconThemeData && other.constructor === this.constructor && valueEquals(builderIdentity(this.backButtonIconBuilder), builderIdentity(other.backButtonIconBuilder)) && valueEquals(builderIdentity(this.closeButtonIconBuilder), builderIdentity(other.closeButtonIconBuilder)) && valueEquals(builderIdentity(this.drawerButtonIconBuilder), builderIdentity(other.drawerButtonIconBuilder)) && valueEquals(builderIdentity(this.endDrawerButtonIconBuilder), builderIdentity(other.endDrawerButtonIconBuilder)); }
  /** @dartReturn int */
  get hashCode(): number { return hashValues(builderIdentity(this.backButtonIconBuilder), builderIdentity(this.closeButtonIconBuilder), builderIdentity(this.drawerButtonIconBuilder), builderIdentity(this.endDrawerButtonIconBuilder)); }
  override debugFillProperties(properties: DiagnosticPropertiesBuilder): void {
    super.debugFillProperties(properties);
    properties.add(new DiagnosticsProperty("backButtonIconBuilder", this.backButtonIconBuilder, { defaultValue: null, typeName: "WidgetBuilder" }));
    properties.add(new DiagnosticsProperty("closeButtonIconBuilder", this.closeButtonIconBuilder, { defaultValue: null, typeName: "WidgetBuilder" }));
    properties.add(new DiagnosticsProperty("drawerButtonIconBuilder", this.drawerButtonIconBuilder, { defaultValue: null, typeName: "WidgetBuilder" }));
    properties.add(new DiagnosticsProperty("endDrawerButtonIconBuilder", this.endDrawerButtonIconBuilder, { defaultValue: null, typeName: "WidgetBuilder" }));
  }
}
