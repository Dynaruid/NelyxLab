// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
import { AlignmentGeometry } from "@nelyx/core/framework/painting/alignment";
import { BorderSide } from "@nelyx/core/framework/painting/borders";
import { Color } from "@nelyx/core/ui/color";
import { DartDouble } from "@nelyx/core/foundation/dart-numeric";
import { EdgeInsetsGeometry } from "@nelyx/core/framework/painting/edge-insets";
import type { MouseCursor } from "@nelyx/core/services/mouse-cursor";
import { OutlinedBorder } from "@nelyx/core/framework/painting/borders";
import { Size } from "@nelyx/core/ui/size";
import type { VisualDensity } from "./theme-data.ts";
import { WidgetStateProperty } from "@nelyx/core/framework/widgets/widget-state";
import { lerpColorProperty, lerpDoubleProperty, lerpEdgeInsetsGeometryProperty, lerpSizeProperty, lerpOutlinedBorderProperty } from "./internal/theme/value-interpolation.ts";
import { WidgetStateBorderSide } from "@nelyx/core/framework/widgets/widget-state";
import { Diagnosticable } from "@nelyx/core/foundation/diagnosticable";
import { DiagnosticsProperty } from "@nelyx/core/foundation/diagnostics";
import type { DiagnosticPropertiesBuilder } from "@nelyx/core/foundation/diagnostics";
import "@nelyx/core/foundation/diagnostic-properties";
import "@nelyx/core/internal/framework/painting/color-property.generated";
import { valueEquals, hashValues } from "@nelyx/core/framework/painting/value-equality";
export interface MenuStyleOptions {
  readonly backgroundColor?: WidgetStateProperty<Color | null> | null;
  readonly shadowColor?: WidgetStateProperty<Color | null> | null;
  readonly surfaceTintColor?: WidgetStateProperty<Color | null> | null;
  /** @dartType WidgetStateProperty<double?>? */
  readonly elevation?: WidgetStateProperty<DartDouble | null> | null;
  readonly padding?: WidgetStateProperty<EdgeInsetsGeometry | null> | null;
  readonly minimumSize?: WidgetStateProperty<Size | null> | null;
  readonly fixedSize?: WidgetStateProperty<Size | null> | null;
  readonly maximumSize?: WidgetStateProperty<Size | null> | null;
  readonly side?: WidgetStateProperty<BorderSide | null> | null;
  readonly shape?: WidgetStateProperty<OutlinedBorder | null> | null;
  readonly mouseCursor?: WidgetStateProperty<MouseCursor | null> | null;
  readonly visualDensity?: VisualDensity | null;
  readonly alignment?: AlignmentGeometry | null;
}
export class MenuStyle extends Diagnosticable(class {}) {
  readonly backgroundColor: WidgetStateProperty<Color | null> | null;
  readonly shadowColor: WidgetStateProperty<Color | null> | null;
  readonly surfaceTintColor: WidgetStateProperty<Color | null> | null;
  /** @dartType WidgetStateProperty<double?>? */
  readonly elevation: WidgetStateProperty<DartDouble | null> | null;
  readonly padding: WidgetStateProperty<EdgeInsetsGeometry | null> | null;
  readonly minimumSize: WidgetStateProperty<Size | null> | null;
  readonly fixedSize: WidgetStateProperty<Size | null> | null;
  readonly maximumSize: WidgetStateProperty<Size | null> | null;
  readonly side: WidgetStateProperty<BorderSide | null> | null;
  readonly shape: WidgetStateProperty<OutlinedBorder | null> | null;
  readonly mouseCursor: WidgetStateProperty<MouseCursor | null> | null;
  readonly visualDensity: VisualDensity | null;
  readonly alignment: AlignmentGeometry | null;
  /** @dartParam elevation WidgetStateProperty<double?>? */
  constructor(options: MenuStyleOptions = {}) {
    super();
    this.backgroundColor = options.backgroundColor ?? null;
    this.shadowColor = options.shadowColor ?? null;
    this.surfaceTintColor = options.surfaceTintColor ?? null;
    this.elevation = options.elevation ?? null;
    this.padding = options.padding ?? null;
    this.minimumSize = options.minimumSize ?? null;
    this.fixedSize = options.fixedSize ?? null;
    this.maximumSize = options.maximumSize ?? null;
    this.side = options.side ?? null;
    this.shape = options.shape ?? null;
    this.mouseCursor = options.mouseCursor ?? null;
    this.visualDensity = options.visualDensity ?? null;
    this.alignment = options.alignment ?? null;
    if (new.target === MenuStyle) Object.freeze(this);
  }
  /** @dartParam elevation WidgetStateProperty<double?>? */
  copyWith(options: MenuStyleOptions = {}): MenuStyle {
    return new MenuStyle({
      backgroundColor: options.backgroundColor ?? this.backgroundColor,
      shadowColor: options.shadowColor ?? this.shadowColor,
      surfaceTintColor: options.surfaceTintColor ?? this.surfaceTintColor,
      elevation: options.elevation ?? this.elevation,
      padding: options.padding ?? this.padding,
      minimumSize: options.minimumSize ?? this.minimumSize,
      fixedSize: options.fixedSize ?? this.fixedSize,
      maximumSize: options.maximumSize ?? this.maximumSize,
      side: options.side ?? this.side,
      shape: options.shape ?? this.shape,
      mouseCursor: options.mouseCursor ?? this.mouseCursor,
      visualDensity: options.visualDensity ?? this.visualDensity,
      alignment: options.alignment ?? this.alignment,
    });
  }
  merge(other: MenuStyle | null): MenuStyle {
    return other === null ? this : this.copyWith({
      backgroundColor: this.backgroundColor ?? other.backgroundColor,
      shadowColor: this.shadowColor ?? other.shadowColor,
      surfaceTintColor: this.surfaceTintColor ?? other.surfaceTintColor,
      elevation: this.elevation ?? other.elevation,
      padding: this.padding ?? other.padding,
      minimumSize: this.minimumSize ?? other.minimumSize,
      fixedSize: this.fixedSize ?? other.fixedSize,
      maximumSize: this.maximumSize ?? other.maximumSize,
      side: this.side ?? other.side,
      shape: this.shape ?? other.shape,
      mouseCursor: this.mouseCursor ?? other.mouseCursor,
      visualDensity: this.visualDensity ?? other.visualDensity,
      alignment: this.alignment ?? other.alignment,
    });
  }
  /** @dartParam t double */
  static lerp(a: MenuStyle | null, b: MenuStyle | null, t: number): MenuStyle | null {
    if ((a === b)) {
    return a;
}
    return new MenuStyle({
      backgroundColor: lerpColorProperty((a?.backgroundColor ?? null), (b?.backgroundColor ?? null), t),
      shadowColor: lerpColorProperty((a?.shadowColor ?? null), (b?.shadowColor ?? null), t),
      surfaceTintColor: lerpColorProperty((a?.surfaceTintColor ?? null), (b?.surfaceTintColor ?? null), t),
      elevation: lerpDoubleProperty((a?.elevation ?? null), (b?.elevation ?? null), t),
      padding: lerpEdgeInsetsGeometryProperty((a?.padding ?? null), (b?.padding ?? null), t),
      minimumSize: lerpSizeProperty((a?.minimumSize ?? null), (b?.minimumSize ?? null), t),
      fixedSize: lerpSizeProperty((a?.fixedSize ?? null), (b?.fixedSize ?? null), t),
      maximumSize: lerpSizeProperty((a?.maximumSize ?? null), (b?.maximumSize ?? null), t),
      side: WidgetStateBorderSide.lerp((a?.side ?? null), (b?.side ?? null), t),
      shape: lerpOutlinedBorderProperty((a?.shape ?? null), (b?.shape ?? null), t),
      mouseCursor: ((t < 0.5) ? (a?.mouseCursor ?? null) : (b?.mouseCursor ?? null)),
      visualDensity: ((t < 0.5) ? (a?.visualDensity ?? null) : (b?.visualDensity ?? null)),
      alignment: AlignmentGeometry.lerp((a?.alignment ?? null), (b?.alignment ?? null), t),
    });
}
  equals(other: unknown): boolean { return this === other || other instanceof MenuStyle && other.constructor === this.constructor && valueEquals(this.backgroundColor, other.backgroundColor) && valueEquals(this.shadowColor, other.shadowColor) && valueEquals(this.surfaceTintColor, other.surfaceTintColor) && valueEquals(this.elevation, other.elevation) && valueEquals(this.padding, other.padding) && valueEquals(this.minimumSize, other.minimumSize) && valueEquals(this.fixedSize, other.fixedSize) && valueEquals(this.maximumSize, other.maximumSize) && valueEquals(this.side, other.side) && valueEquals(this.shape, other.shape) && valueEquals(this.mouseCursor, other.mouseCursor) && valueEquals(this.visualDensity, other.visualDensity) && valueEquals(this.alignment, other.alignment); }
  /** @dartReturn int */
  get hashCode(): number { return hashValues(this.backgroundColor, this.shadowColor, this.surfaceTintColor, this.elevation, this.padding, this.minimumSize, this.fixedSize, this.maximumSize, this.side, this.shape, this.mouseCursor, this.visualDensity, this.alignment); }
  override debugFillProperties(properties: DiagnosticPropertiesBuilder): void {
    super.debugFillProperties(properties);
    properties.add(new DiagnosticsProperty("backgroundColor", this.backgroundColor, { defaultValue: null, typeName: "WidgetStateProperty<Color?>" }));
    properties.add(new DiagnosticsProperty("shadowColor", this.shadowColor, { defaultValue: null, typeName: "WidgetStateProperty<Color?>" }));
    properties.add(new DiagnosticsProperty("surfaceTintColor", this.surfaceTintColor, { defaultValue: null, typeName: "WidgetStateProperty<Color?>" }));
    properties.add(new DiagnosticsProperty("elevation", this.elevation, { defaultValue: null, typeName: "WidgetStateProperty<double?>" }));
    properties.add(new DiagnosticsProperty("padding", this.padding, { defaultValue: null, typeName: "WidgetStateProperty<EdgeInsetsGeometry?>" }));
    properties.add(new DiagnosticsProperty("minimumSize", this.minimumSize, { defaultValue: null, typeName: "WidgetStateProperty<Size?>" }));
    properties.add(new DiagnosticsProperty("fixedSize", this.fixedSize, { defaultValue: null, typeName: "WidgetStateProperty<Size?>" }));
    properties.add(new DiagnosticsProperty("maximumSize", this.maximumSize, { defaultValue: null, typeName: "WidgetStateProperty<Size?>" }));
    properties.add(new DiagnosticsProperty("side", this.side, { defaultValue: null, typeName: "WidgetStateProperty<BorderSide?>" }));
    properties.add(new DiagnosticsProperty("shape", this.shape, { defaultValue: null, typeName: "WidgetStateProperty<OutlinedBorder?>" }));
    properties.add(new DiagnosticsProperty("mouseCursor", this.mouseCursor, { defaultValue: null, typeName: "WidgetStateProperty<MouseCursor?>" }));
    properties.add(new DiagnosticsProperty("visualDensity", this.visualDensity, { defaultValue: null, typeName: "VisualDensity" }));
    properties.add(new DiagnosticsProperty("alignment", this.alignment, { defaultValue: null, typeName: "AlignmentGeometry" }));
  }
}
