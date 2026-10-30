// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Flutter material/tooltip_theme.dart at 71e4717a61786faab4c7aa39825989305ed29e8a.
import { Diagnosticable } from '@nelyx/core/foundation/diagnosticable';
import { DiagnosticsProperty } from '@nelyx/core/foundation/diagnostics';
import type { DiagnosticPropertiesBuilder } from '@nelyx/core/foundation/diagnostics';
import { DoubleProperty, FlagProperty } from '@nelyx/core/foundation/diagnostic-properties';
import { BoxConstraints } from '@nelyx/core/framework/rendering/constraints';
import { EdgeInsetsGeometry } from '@nelyx/core/framework/painting/edge-insets';
import { TextStyle } from '@nelyx/core/framework/painting/text-style';
import { Decoration } from '@nelyx/core/framework/painting/decoration';
import type { TextAlign } from '@nelyx/core/ui/typography';
import { TooltipTriggerMode } from '@nelyx/core/framework/widgets/raw-tooltip';
import { valueEquals, hashValues } from '@nelyx/core/framework/painting/value-equality';
import { protect } from '@nelyx/core/internal/ui/value-math';
import { invariant } from '@nelyx/core/foundation/errors';

export interface TooltipThemeDataOptions {
  readonly height?: number | null;
  readonly constraints?: BoxConstraints | null;
  readonly padding?: EdgeInsetsGeometry | null;
  readonly margin?: EdgeInsetsGeometry | null;
  readonly verticalOffset?: number | null;
  readonly preferBelow?: boolean | null;
  readonly excludeFromSemantics?: boolean | null;
  readonly decoration?: Decoration | null;
  readonly textStyle?: TextStyle | null;
  readonly textAlign?: TextAlign | null;
  readonly waitDuration?: number | null;
  readonly showDuration?: number | null;
  readonly exitDuration?: number | null;
  readonly triggerMode?: TooltipTriggerMode | null;
  readonly enableFeedback?: boolean | null;
}

const fields = [
  'height',
  'constraints',
  'padding',
  'margin',
  'verticalOffset',
  'preferBelow',
  'excludeFromSemantics',
  'decoration',
  'textStyle',
  'textAlign',
  'waitDuration',
  'showDuration',
  'exitDuration',
  'triggerMode',
  'enableFeedback',
] as const;

export class TooltipThemeData extends Diagnosticable(class {}) {
  /** @dartType double? */ readonly height: number | null;
  readonly constraints: BoxConstraints | null;
  readonly padding: EdgeInsetsGeometry | null;
  readonly margin: EdgeInsetsGeometry | null;
  /** @dartType double? */ readonly verticalOffset: number | null;
  readonly preferBelow: boolean | null;
  readonly excludeFromSemantics: boolean | null;
  readonly decoration: Decoration | null;
  readonly textStyle: TextStyle | null;
  readonly textAlign: TextAlign | null;
  readonly waitDuration: number | null;
  readonly showDuration: number | null;
  readonly exitDuration: number | null;
  readonly triggerMode: TooltipTriggerMode | null;
  readonly enableFeedback: boolean | null;
  /** @dartParam height double?
   * @dartParam verticalOffset double? */
  constructor(o: TooltipThemeDataOptions = {}) {
    super();
    this.height = o.height ?? null;
    this.constraints = o.constraints ?? null;
    this.padding = o.padding ?? null;
    this.margin = o.margin ?? null;
    this.verticalOffset = o.verticalOffset ?? null;
    this.preferBelow = o.preferBelow ?? null;
    this.excludeFromSemantics = o.excludeFromSemantics ?? null;
    this.decoration = o.decoration ?? null;
    this.textStyle = o.textStyle ?? null;
    this.textAlign = o.textAlign ?? null;
    this.waitDuration = o.waitDuration ?? null;
    this.showDuration = o.showDuration ?? null;
    this.exitDuration = o.exitDuration ?? null;
    this.triggerMode = o.triggerMode ?? null;
    this.enableFeedback = o.enableFeedback ?? null;
    invariant(
      this.height === null || this.constraints === null,
      'ambiguous-tooltip-size',
      'Only one of height and constraints may be specified',
    );
    protect(this, fields);
  }
  copyWith(o: TooltipThemeDataOptions = {}): TooltipThemeData {
    // The pinned source omits exitDuration in its returned constructor.
    return new TooltipThemeData({
      height: o.height ?? this.height,
      constraints: o.constraints ?? this.constraints,
      padding: o.padding ?? this.padding,
      margin: o.margin ?? this.margin,
      verticalOffset: o.verticalOffset ?? this.verticalOffset,
      preferBelow: o.preferBelow ?? this.preferBelow,
      excludeFromSemantics: o.excludeFromSemantics ?? this.excludeFromSemantics,
      decoration: o.decoration ?? this.decoration,
      textStyle: o.textStyle ?? this.textStyle,
      textAlign: o.textAlign ?? this.textAlign,
      waitDuration: o.waitDuration ?? this.waitDuration,
      showDuration: o.showDuration ?? this.showDuration,
      triggerMode: o.triggerMode ?? this.triggerMode,
      enableFeedback: o.enableFeedback ?? this.enableFeedback,
    });
  }
  static lerp(
    a: TooltipThemeData | null,
    b: TooltipThemeData | null,
    t: number,
  ): TooltipThemeData | null {
    if (a === b) return a;
    const scalar = (a: number | null | undefined, b: number | null | undefined) =>
      a == null && b == null ? null : (a ?? 0) * (1 - t) + (b ?? 0) * t;
    return new TooltipThemeData({
      height: scalar(a?.height, b?.height),
      constraints: BoxConstraints.lerp(a?.constraints ?? null, b?.constraints ?? null, t),
      padding: EdgeInsetsGeometry.lerp(a?.padding ?? null, b?.padding ?? null, t),
      margin: EdgeInsetsGeometry.lerp(a?.margin ?? null, b?.margin ?? null, t),
      verticalOffset: scalar(a?.verticalOffset, b?.verticalOffset),
      preferBelow: (t < 0.5 ? a : b)?.preferBelow ?? null,
      excludeFromSemantics: (t < 0.5 ? a : b)?.excludeFromSemantics ?? null,
      decoration: Decoration.lerp(a?.decoration ?? null, b?.decoration ?? null, t),
      textStyle: TextStyle.lerp(a?.textStyle ?? null, b?.textStyle ?? null, t),
      textAlign: (t < 0.5 ? a : b)?.textAlign ?? null,
    });
  }
  equals(other: unknown): boolean {
    return (
      this === other ||
      (other instanceof TooltipThemeData &&
        other.constructor === this.constructor &&
        fields.every((f) => valueEquals(this[f], other[f])))
    );
  }
  get hashCode(): number {
    return hashValues(fields.map((f) => this[f]));
  }
  override debugFillProperties(p: DiagnosticPropertiesBuilder): void {
    super.debugFillProperties(p);
    p.add(new DoubleProperty('height', this.height, { defaultValue: null }));
    p.add(new DiagnosticsProperty('constraints', this.constraints, { defaultValue: null }));
    p.add(new DiagnosticsProperty('padding', this.padding, { defaultValue: null }));
    p.add(new DiagnosticsProperty('margin', this.margin, { defaultValue: null }));
    p.add(new DoubleProperty('vertical offset', this.verticalOffset, { defaultValue: null }));
    p.add(
      new FlagProperty('position', this.preferBelow, {
        ifTrue: 'below',
        ifFalse: 'above',
        showName: true,
      }),
    );
    p.add(
      new FlagProperty('semantics', this.excludeFromSemantics, {
        ifTrue: 'excluded',
        showName: true,
      }),
    );
    p.add(new DiagnosticsProperty('decoration', this.decoration, { defaultValue: null }));
    p.add(new DiagnosticsProperty('textStyle', this.textStyle, { defaultValue: null }));
    p.add(new DiagnosticsProperty('textAlign', this.textAlign, { defaultValue: null }));
    p.add(new DiagnosticsProperty('wait duration', this.waitDuration, { defaultValue: null }));
    p.add(new DiagnosticsProperty('show duration', this.showDuration, { defaultValue: null }));
    p.add(new DiagnosticsProperty('exit duration', this.exitDuration, { defaultValue: null }));
    p.add(new DiagnosticsProperty('triggerMode', this.triggerMode, { defaultValue: null }));
    p.add(
      new FlagProperty('enableFeedback', this.enableFeedback, { ifTrue: 'true', showName: true }),
    );
  }
}
