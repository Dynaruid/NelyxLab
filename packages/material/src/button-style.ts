// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Complete pinned ButtonStyle value contract over the canonical Core value owners.
import { DartDouble } from '@nelyx/core/foundation/dart-numeric';
import { lerpDouble } from '@nelyx/core/internal/ui/lerp-double.generated';
import {
  WidgetStateProperty,
  WidgetStateBorderSide,
} from '@nelyx/core/framework/widgets/widget-state';
import type { WidgetState } from '@nelyx/core/framework/widgets/widget-state';
import type { DartSet } from '@nelyx/core/foundation/dart-collections';
import { dartDoubleType, nullableDartType } from '@nelyx/core/foundation/dart-type-witness';
import { Color } from '@nelyx/core/ui/color';
import { sourceColorType } from '@nelyx/core/ui/color-source';
import { Size } from '@nelyx/core/ui/size';
import { sourceSizeType, sourceSizeLerp } from '@nelyx/core/ui/size-source';
import { TextStyle } from '@nelyx/core/framework/painting/text-style';
import { EdgeInsetsGeometry } from '@nelyx/core/framework/painting/edge-insets';
import { AlignmentGeometry } from '@nelyx/core/framework/painting/alignment';
import { OutlinedBorder } from '@nelyx/core/framework/painting/borders';
import type { BorderSide } from '@nelyx/core/framework/painting/borders';
import {
  sourceTextStyleType,
  sourceEdgeInsetsGeometryType,
  sourceOutlinedBorderType,
  captureSourceTextStyle,
  captureSourceEdgeInsetsGeometry,
  captureSourceOutlinedBorder,
} from '@nelyx/core/internal/framework/painting/source-value-types';
import type { MouseCursor } from '@nelyx/core/services/mouse-cursor';
import type { Widget, BuildContext } from '@nelyx/core/framework/widgets/framework';
import { Diagnosticable } from '@nelyx/core/foundation/diagnosticable';
import { DiagnosticsProperty } from '@nelyx/core/foundation/diagnostics';
import type { DiagnosticPropertiesBuilder } from '@nelyx/core/foundation/diagnostics';
import { valueEquals, hashValues } from '@nelyx/core/framework/painting/value-equality';
import type { VisualDensity, MaterialTapTargetSize } from './theme-data.ts';
import type { InteractiveInkFeatureFactory } from './ink-feature.ts';
import { IconAlignment } from './icon-alignment.ts';
export type ButtonLayerBuilder = (
  context: BuildContext,
  states: DartSet<WidgetState>,
  child: Widget | null,
) => Widget;
export interface ButtonStyleOptions {
  readonly textStyle?: WidgetStateProperty<TextStyle | null> | null;
  readonly backgroundColor?: WidgetStateProperty<Color | null> | null;
  readonly foregroundColor?: WidgetStateProperty<Color | null> | null;
  readonly overlayColor?: WidgetStateProperty<Color | null> | null;
  readonly shadowColor?: WidgetStateProperty<Color | null> | null;
  readonly surfaceTintColor?: WidgetStateProperty<Color | null> | null;
  /** @dartType WidgetStateProperty<double?>? */ readonly elevation?: WidgetStateProperty<DartDouble | null> | null;
  readonly padding?: WidgetStateProperty<EdgeInsetsGeometry | null> | null;
  readonly minimumSize?: WidgetStateProperty<Size | null> | null;
  readonly fixedSize?: WidgetStateProperty<Size | null> | null;
  readonly maximumSize?: WidgetStateProperty<Size | null> | null;
  readonly iconColor?: WidgetStateProperty<Color | null> | null;
  /** @dartType WidgetStateProperty<double?>? */ readonly iconSize?: WidgetStateProperty<DartDouble | null> | null;
  readonly iconAlignment?: IconAlignment | null;
  readonly side?: WidgetStateProperty<BorderSide | null> | null;
  readonly shape?: WidgetStateProperty<OutlinedBorder | null> | null;
  readonly mouseCursor?: WidgetStateProperty<MouseCursor | null> | null;
  readonly visualDensity?: VisualDensity | null;
  readonly tapTargetSize?: MaterialTapTargetSize | null;
  readonly animationDuration?: number | null; // Source Duration in host milliseconds.
  readonly enableFeedback?: boolean | null;
  readonly alignment?: AlignmentGeometry | null;
  readonly splashFactory?: InteractiveInkFeatureFactory | null;
  readonly backgroundBuilder?: ButtonLayerBuilder | null;
  readonly foregroundBuilder?: ButtonLayerBuilder | null;
}
type Values = {
  readonly [K in keyof Required<ButtonStyleOptions>]: Exclude<ButtonStyleOptions[K], undefined>;
};
export class ButtonStyle extends Diagnosticable(class {}) {
  private readonly values: Values;
  get textStyle(): WidgetStateProperty<TextStyle | null> | null {
    return this.values.textStyle;
  }
  get backgroundColor(): WidgetStateProperty<Color | null> | null {
    return this.values.backgroundColor;
  }
  get foregroundColor(): WidgetStateProperty<Color | null> | null {
    return this.values.foregroundColor;
  }
  get overlayColor(): WidgetStateProperty<Color | null> | null {
    return this.values.overlayColor;
  }
  get shadowColor(): WidgetStateProperty<Color | null> | null {
    return this.values.shadowColor;
  }
  get surfaceTintColor(): WidgetStateProperty<Color | null> | null {
    return this.values.surfaceTintColor;
  }
  /** @dartType WidgetStateProperty<double?>? */ get elevation(): WidgetStateProperty<DartDouble | null> | null {
    return this.values.elevation;
  }
  get padding(): WidgetStateProperty<EdgeInsetsGeometry | null> | null {
    return this.values.padding;
  }
  get minimumSize(): WidgetStateProperty<Size | null> | null {
    return this.values.minimumSize;
  }
  get fixedSize(): WidgetStateProperty<Size | null> | null {
    return this.values.fixedSize;
  }
  get maximumSize(): WidgetStateProperty<Size | null> | null {
    return this.values.maximumSize;
  }
  get iconColor(): WidgetStateProperty<Color | null> | null {
    return this.values.iconColor;
  }
  /** @dartType WidgetStateProperty<double?>? */ get iconSize(): WidgetStateProperty<DartDouble | null> | null {
    return this.values.iconSize;
  }
  get iconAlignment(): IconAlignment | null {
    return this.values.iconAlignment;
  }
  get side(): WidgetStateProperty<BorderSide | null> | null {
    return this.values.side;
  }
  get shape(): WidgetStateProperty<OutlinedBorder | null> | null {
    return this.values.shape;
  }
  get mouseCursor(): WidgetStateProperty<MouseCursor | null> | null {
    return this.values.mouseCursor;
  }
  get visualDensity(): VisualDensity | null {
    return this.values.visualDensity;
  }
  get tapTargetSize(): MaterialTapTargetSize | null {
    return this.values.tapTargetSize;
  }
  get animationDuration(): number | null {
    return this.values.animationDuration;
  }
  get enableFeedback(): boolean | null {
    return this.values.enableFeedback;
  }
  get alignment(): AlignmentGeometry | null {
    return this.values.alignment;
  }
  get splashFactory(): InteractiveInkFeatureFactory | null {
    return this.values.splashFactory;
  }
  get backgroundBuilder(): ButtonLayerBuilder | null {
    return this.values.backgroundBuilder;
  }
  get foregroundBuilder(): ButtonLayerBuilder | null {
    return this.values.foregroundBuilder;
  }
  /** @dartParam elevation WidgetStateProperty<double?>?
   * @dartParam iconSize WidgetStateProperty<double?>? */
  constructor(options: ButtonStyleOptions = {}) {
    super();
    if (options.iconAlignment != null && !IconAlignment.values.includes(options.iconAlignment))
      throw new TypeError('ButtonStyle requires a canonical IconAlignment');
    if (Object.hasOwn(options, 'radius'))
      throw new TypeError('ButtonStyle.radius has been removed; use an OutlinedBorder shape');
    this.values = Object.freeze({
      textStyle: options.textStyle ?? null,
      backgroundColor: options.backgroundColor ?? null,
      foregroundColor: options.foregroundColor ?? null,
      overlayColor: options.overlayColor ?? null,
      shadowColor: options.shadowColor ?? null,
      surfaceTintColor: options.surfaceTintColor ?? null,
      elevation: options.elevation ?? null,
      padding: options.padding ?? null,
      minimumSize: options.minimumSize ?? null,
      fixedSize: options.fixedSize ?? null,
      maximumSize: options.maximumSize ?? null,
      iconColor: options.iconColor ?? null,
      iconSize: options.iconSize ?? null,
      iconAlignment: options.iconAlignment ?? null,
      side: options.side ?? null,
      shape: options.shape ?? null,
      mouseCursor: options.mouseCursor ?? null,
      visualDensity: options.visualDensity ?? null,
      tapTargetSize: options.tapTargetSize ?? null,
      animationDuration: options.animationDuration ?? null,
      enableFeedback: options.enableFeedback ?? null,
      alignment: options.alignment ?? null,
      splashFactory: options.splashFactory ?? null,
      backgroundBuilder: options.backgroundBuilder ?? null,
      foregroundBuilder: options.foregroundBuilder ?? null,
    });
    if (new.target === ButtonStyle) Object.freeze(this);
  }
  /** @dartParam elevation WidgetStateProperty<double?>?
   * @dartParam iconSize WidgetStateProperty<double?>? */
  copyWith(options: ButtonStyleOptions = {}): ButtonStyle {
    if (Object.hasOwn(options, 'radius'))
      throw new TypeError('ButtonStyle.radius has been removed; use an OutlinedBorder shape');
    return new ButtonStyle({
      textStyle: options.textStyle ?? this.textStyle,
      backgroundColor: options.backgroundColor ?? this.backgroundColor,
      foregroundColor: options.foregroundColor ?? this.foregroundColor,
      overlayColor: options.overlayColor ?? this.overlayColor,
      shadowColor: options.shadowColor ?? this.shadowColor,
      surfaceTintColor: options.surfaceTintColor ?? this.surfaceTintColor,
      elevation: options.elevation ?? this.elevation,
      padding: options.padding ?? this.padding,
      minimumSize: options.minimumSize ?? this.minimumSize,
      fixedSize: options.fixedSize ?? this.fixedSize,
      maximumSize: options.maximumSize ?? this.maximumSize,
      iconColor: options.iconColor ?? this.iconColor,
      iconSize: options.iconSize ?? this.iconSize,
      iconAlignment: options.iconAlignment ?? this.iconAlignment,
      side: options.side ?? this.side,
      shape: options.shape ?? this.shape,
      mouseCursor: options.mouseCursor ?? this.mouseCursor,
      visualDensity: options.visualDensity ?? this.visualDensity,
      tapTargetSize: options.tapTargetSize ?? this.tapTargetSize,
      animationDuration: options.animationDuration ?? this.animationDuration,
      enableFeedback: options.enableFeedback ?? this.enableFeedback,
      alignment: options.alignment ?? this.alignment,
      splashFactory: options.splashFactory ?? this.splashFactory,
      backgroundBuilder: options.backgroundBuilder ?? this.backgroundBuilder,
      foregroundBuilder: options.foregroundBuilder ?? this.foregroundBuilder,
    });
  }
  merge(other: ButtonStyle | null): ButtonStyle {
    return other === null
      ? this
      : this.copyWith({
          textStyle: this.textStyle ?? other.textStyle,
          backgroundColor: this.backgroundColor ?? other.backgroundColor,
          foregroundColor: this.foregroundColor ?? other.foregroundColor,
          overlayColor: this.overlayColor ?? other.overlayColor,
          shadowColor: this.shadowColor ?? other.shadowColor,
          surfaceTintColor: this.surfaceTintColor ?? other.surfaceTintColor,
          elevation: this.elevation ?? other.elevation,
          padding: this.padding ?? other.padding,
          minimumSize: this.minimumSize ?? other.minimumSize,
          fixedSize: this.fixedSize ?? other.fixedSize,
          maximumSize: this.maximumSize ?? other.maximumSize,
          iconColor: this.iconColor ?? other.iconColor,
          iconSize: this.iconSize ?? other.iconSize,
          iconAlignment: this.iconAlignment ?? other.iconAlignment,
          side: this.side ?? other.side,
          shape: this.shape ?? other.shape,
          mouseCursor: this.mouseCursor ?? other.mouseCursor,
          visualDensity: this.visualDensity ?? other.visualDensity,
          tapTargetSize: this.tapTargetSize ?? other.tapTargetSize,
          animationDuration: this.animationDuration ?? other.animationDuration,
          enableFeedback: this.enableFeedback ?? other.enableFeedback,
          alignment: this.alignment ?? other.alignment,
          splashFactory: this.splashFactory ?? other.splashFactory,
          backgroundBuilder: this.backgroundBuilder ?? other.backgroundBuilder,
          foregroundBuilder: this.foregroundBuilder ?? other.foregroundBuilder,
        });
  }
  equals(other: unknown): boolean {
    return (
      this === other ||
      (other instanceof ButtonStyle && styleFields.every((n) => valueEquals(this[n], other[n])))
    );
  }
  /** @dartReturn int */ get hashCode(): number {
    return hashValues(...styleFields.map((n) => this[n]));
  }
  override debugFillProperties(properties: DiagnosticPropertiesBuilder): void {
    super.debugFillProperties(properties);
    for (const name of styleFields)
      if (name !== 'splashFactory')
        properties.add(new DiagnosticsProperty(name, this[name], { defaultValue: null }));
  }
  /** @dartParam t double */
  static lerp(a: ButtonStyle | null, b: ButtonStyle | null, t: number): ButtonStyle | null {
    if (a === b) return a;
    const color = (name: (typeof colorFields)[number]) =>
      WidgetStateProperty.lerp<Color | null>(
        nullableDartType(sourceColorType),
        a?.[name] ?? null,
        b?.[name] ?? null,
        t,
        Color.lerp,
      );
    const number = (name: 'elevation' | 'iconSize') =>
      WidgetStateProperty.lerp(
        nullableDartType(dartDoubleType),
        a?.[name] ?? null,
        b?.[name] ?? null,
        t,
        (x, y, q) => {
          if ((x !== null && !DartDouble.is(x)) || (y !== null && !DartDouble.is(y)))
            throw new TypeError(
              'Button numeric interpolation requires retained DartDouble provenance',
            );
          if (x === null && y === null) return null;
          if (x === y) return x;
          return DartDouble.fromSource(lerpDouble(x?.value ?? null, y?.value ?? null, q)!);
        },
      );
    const size = (name: 'minimumSize' | 'fixedSize' | 'maximumSize') =>
      WidgetStateProperty.lerp<Size | null>(
        nullableDartType(sourceSizeType),
        a?.[name] ?? null,
        b?.[name] ?? null,
        t,
        sourceSizeLerp,
      );
    return new ButtonStyle({
      textStyle: WidgetStateProperty.lerp(
        nullableDartType(sourceTextStyleType),
        a?.textStyle ?? null,
        b?.textStyle ?? null,
        t,
        (x, y, q) => {
          const v = TextStyle.lerp(x, y, q);
          return v === null ? null : captureSourceTextStyle(v);
        },
      ),
      backgroundColor: color('backgroundColor'),
      foregroundColor: color('foregroundColor'),
      overlayColor: color('overlayColor'),
      shadowColor: color('shadowColor'),
      surfaceTintColor: color('surfaceTintColor'),
      elevation: number('elevation'),
      padding: WidgetStateProperty.lerp(
        nullableDartType(sourceEdgeInsetsGeometryType),
        a?.padding ?? null,
        b?.padding ?? null,
        t,
        (x, y, q) => {
          const v = EdgeInsetsGeometry.lerp(x, y, q);
          return v === null ? null : captureSourceEdgeInsetsGeometry(v);
        },
      ),
      minimumSize: size('minimumSize'),
      fixedSize: size('fixedSize'),
      maximumSize: size('maximumSize'),
      iconColor: color('iconColor'),
      iconSize: number('iconSize'),
      iconAlignment: t < 0.5 ? (a?.iconAlignment ?? null) : (b?.iconAlignment ?? null),
      side: WidgetStateBorderSide.lerp(a?.side ?? null, b?.side ?? null, t),
      shape: WidgetStateProperty.lerp(
        nullableDartType(sourceOutlinedBorderType),
        a?.shape ?? null,
        b?.shape ?? null,
        t,
        (x, y, q) => {
          const v = OutlinedBorder.lerp(x, y, q);
          return v === null ? null : captureSourceOutlinedBorder(v);
        },
      ),
      mouseCursor: t < 0.5 ? (a?.mouseCursor ?? null) : (b?.mouseCursor ?? null),
      visualDensity: t < 0.5 ? (a?.visualDensity ?? null) : (b?.visualDensity ?? null),
      tapTargetSize: t < 0.5 ? (a?.tapTargetSize ?? null) : (b?.tapTargetSize ?? null),
      animationDuration: t < 0.5 ? (a?.animationDuration ?? null) : (b?.animationDuration ?? null),
      enableFeedback: t < 0.5 ? (a?.enableFeedback ?? null) : (b?.enableFeedback ?? null),
      alignment: AlignmentGeometry.lerp(a?.alignment ?? null, b?.alignment ?? null, t),
      splashFactory: t < 0.5 ? (a?.splashFactory ?? null) : (b?.splashFactory ?? null),
      backgroundBuilder: t < 0.5 ? (a?.backgroundBuilder ?? null) : (b?.backgroundBuilder ?? null),
      foregroundBuilder: t < 0.5 ? (a?.foregroundBuilder ?? null) : (b?.foregroundBuilder ?? null),
    });
  }
}
const styleFields = [
  'textStyle',
  'backgroundColor',
  'foregroundColor',
  'overlayColor',
  'shadowColor',
  'surfaceTintColor',
  'elevation',
  'padding',
  'minimumSize',
  'fixedSize',
  'maximumSize',
  'iconColor',
  'iconSize',
  'iconAlignment',
  'side',
  'shape',
  'mouseCursor',
  'visualDensity',
  'tapTargetSize',
  'animationDuration',
  'enableFeedback',
  'alignment',
  'splashFactory',
  'backgroundBuilder',
  'foregroundBuilder',
] as const;
const colorFields = [
  'backgroundColor',
  'foregroundColor',
  'overlayColor',
  'shadowColor',
  'surfaceTintColor',
  'iconColor',
] as const;
