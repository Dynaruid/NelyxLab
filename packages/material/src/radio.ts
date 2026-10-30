// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
import { StatefulWidget, State } from '@nelyx/core/framework/widgets/framework';
import type { BuildContext, Widget } from '@nelyx/core/framework/widgets/framework';
import type { RawRadioOptions } from '@nelyx/core/framework/widgets/radio-group';
import type { RadioGroupRegistry } from '@nelyx/core/framework/widgets/radio-group';
import { FocusNode } from '@nelyx/core/framework/widgets/focus';
import type { Color } from '@nelyx/core/ui/color';
import type { WidgetStateProperty } from '@nelyx/core/framework/widgets/widget-state';
import type { BorderSide } from '@nelyx/core/framework/painting/borders';
import type { MouseCursor } from '@nelyx/core/services/mouse-cursor';
import type { DartDouble } from '@nelyx/core/foundation/dart-numeric';
import { invariant } from '@nelyx/core/foundation/errors';
import type { MaterialTapTargetSize, VisualDensity } from './theme-data.ts';
import { buildMaterialRadio } from './internal/radio/radio-build.ts';
export interface RadioOptions<T> extends Omit<
  RawRadioOptions<T>,
  'builder' | 'semantics' | 'onLongPress' | 'gestures' | 'mouseCursor' | 'enabled' | 'motion'
> {
  readonly semanticLabel?: string | null;
  readonly id?: string;
  readonly mouseCursor?: MouseCursor | null;
  readonly enabled?: boolean | null;
  readonly activeColor?: Color | null;
  readonly fillColor?: WidgetStateProperty<Color | null> | null;
  readonly focusColor?: Color | null;
  readonly hoverColor?: Color | null;
  readonly overlayColor?: WidgetStateProperty<Color | null> | null;
  /** @dartType double? */
  readonly splashRadius?: number | null;
  readonly materialTapTargetSize?: MaterialTapTargetSize | null;
  readonly visualDensity?: VisualDensity | null;
  readonly backgroundColor?: WidgetStateProperty<Color | null> | null;
  readonly side?: BorderSide | null;
  /** @dartType WidgetStateProperty<double?>? */
  readonly innerRadius?: WidgetStateProperty<DartDouble | null> | null;
}
export interface RadioAdaptiveOptions<T> extends RadioOptions<T> {
  readonly useCupertinoCheckmarkStyle?: boolean;
}
const adaptiveRadios = new WeakMap<Widget, boolean>();
export class Radio<T> extends StatefulWidget {
  readonly options: Readonly<RadioOptions<T>>;
  /**
   * @dartParam splashRadius double?
   * @dartParam innerRadius WidgetStateProperty<double?>?
   */
  constructor(options: RadioOptions<T>) {
    super(options.key ?? null);
    invariant(
      !('groupValue' in options) && !('onChanged' in options),
      'deprecated-radio-option',
      'Radio uses a typed RadioGroup or groupRegistry',
    );
    invariant(
      options.splashRadius == null ||
        (Number.isFinite(options.splashRadius) && options.splashRadius >= 0),
      'invalid-radio-radius',
      'Radio splashRadius must be finite and nonnegative',
    );
    this.options = Object.freeze({ ...options });
  }
  /**
   * @dartParam splashRadius double?
   * @dartParam innerRadius WidgetStateProperty<double?>?
   */
  static adaptive<T>(options: RadioAdaptiveOptions<T>): Radio<T> {
    const { useCupertinoCheckmarkStyle = false, ...standard } = options;
    const result = new Radio(standard);
    adaptiveRadios.set(result, useCupertinoCheckmarkStyle);
    return result;
  }
  get useCupertinoCheckmarkStyle(): boolean {
    return adaptiveRadios.get(this) ?? false;
  }
  get value(): T {
    return this.options.value;
  }
  get groupRegistry(): RadioGroupRegistry<T> | null {
    return this.options.groupRegistry ?? null;
  }
  get toggleable(): boolean {
    return this.options.toggleable ?? false;
  }
  get enabled(): boolean | null {
    return this.options.enabled ?? null;
  }
  get mouseCursor(): MouseCursor | null {
    return this.options.mouseCursor ?? null;
  }
  get activeColor(): Color | null {
    return this.options.activeColor ?? null;
  }
  get fillColor(): WidgetStateProperty<Color | null> | null {
    return this.options.fillColor ?? null;
  }
  get focusColor(): Color | null {
    return this.options.focusColor ?? null;
  }
  get hoverColor(): Color | null {
    return this.options.hoverColor ?? null;
  }
  get overlayColor(): WidgetStateProperty<Color | null> | null {
    return this.options.overlayColor ?? null;
  }
  /** @dartType double? */
  get splashRadius(): number | null {
    return this.options.splashRadius ?? null;
  }
  get materialTapTargetSize(): MaterialTapTargetSize | null {
    return this.options.materialTapTargetSize ?? null;
  }
  get visualDensity(): VisualDensity | null {
    return this.options.visualDensity ?? null;
  }
  get backgroundColor(): WidgetStateProperty<Color | null> | null {
    return this.options.backgroundColor ?? null;
  }
  get side(): BorderSide | null {
    return this.options.side ?? null;
  }
  /** @dartType WidgetStateProperty<double?>? */
  get innerRadius(): WidgetStateProperty<DartDouble | null> | null {
    return this.options.innerRadius ?? null;
  }
  get focusNode(): FocusNode | null {
    return this.options.focusNode ?? null;
  }
  get autofocus(): boolean {
    return this.options.autofocus ?? false;
  }
  createState(): State<Radio<T>> {
    return new RadioState<T>();
  }
}
class RadioState<T> extends State<Radio<T>> {
  private internalFocusNode: FocusNode | null = null;
  build(context: BuildContext): Widget {
    const widget = this.widget,
      focusNode =
        widget.focusNode ?? (this.internalFocusNode ??= new FocusNode({ debugLabel: 'Radio' }));
    return buildMaterialRadio(
      { ...widget.options, focusNode },
      context,
      adaptiveRadios.has(widget),
      widget.useCupertinoCheckmarkStyle,
    );
  }
  override dispose(): void {
    try {
      this.internalFocusNode?.dispose();
    } finally {
      super.dispose();
    }
  }
}
