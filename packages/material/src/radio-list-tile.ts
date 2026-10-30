// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Full nondeprecated public field projection from retained resolved IR; functional Core build below.
import type { DartDouble } from '@nelyx/core/foundation/dart-numeric';
import { invariant } from '@nelyx/core/foundation/errors';
import type { BorderSide, ShapeBorder } from '@nelyx/core/framework/painting/borders';
import type { EdgeInsetsGeometry } from '@nelyx/core/framework/painting/edge-insets';
import type { FocusNode } from '@nelyx/core/framework/widgets/focus';
import type { State, Widget, WidgetOptions } from '@nelyx/core/framework/widgets/framework';
import { StatefulWidget } from '@nelyx/core/framework/widgets/framework';
import type { RadioGroupRegistry } from '@nelyx/core/framework/widgets/radio-group';
import type {
  WidgetStateProperty,
  WidgetStatesController,
} from '@nelyx/core/framework/widgets/widget-state';
import type { MouseCursor } from '@nelyx/core/services/mouse-cursor';
import type { Color } from '@nelyx/core/ui/color';
import { createRadioListTileState } from './internal/list/radio-list-tile-state.ts';
import type { ListTileControlAffinity, ListTileTitleAlignment } from './list-tile.ts';
import type { MaterialTapTargetSize, VisualDensity } from './theme-data.ts';
export interface RadioListTileOptions<T> extends WidgetOptions {
  readonly id?: string;
  readonly groupToken?: object | symbol;
  readonly groupRegistry?: RadioGroupRegistry<T>;
  readonly value: T;
  readonly mouseCursor?: MouseCursor | null;
  readonly toggleable?: boolean;
  readonly activeColor?: Color | null;
  readonly fillColor?: WidgetStateProperty<Color | null> | null;
  readonly materialTapTargetSize?: MaterialTapTargetSize | null;
  readonly hoverColor?: Color | null;
  readonly overlayColor?: WidgetStateProperty<Color | null> | null;
  /** @dartType double? */
  readonly splashRadius?: number | null;
  readonly title?: Widget | null;
  readonly subtitle?: Widget | null;
  readonly secondary?: Widget | null;
  readonly isThreeLine?: boolean | null;
  readonly dense?: boolean | null;
  readonly selected?: boolean;
  readonly controlAffinity?: ListTileControlAffinity | null;
  readonly autofocus?: boolean;
  readonly contentPadding?: EdgeInsetsGeometry | null;
  readonly shape?: ShapeBorder | null;
  readonly tileColor?: Color | null;
  readonly selectedTileColor?: Color | null;
  readonly visualDensity?: VisualDensity | null;
  readonly focusNode?: FocusNode | null;
  readonly statesController?: WidgetStatesController | null;
  readonly onFocusChange?: ((value0: boolean) => void) | null;
  readonly enableFeedback?: boolean | null;
  /** @dartType double? */
  readonly horizontalTitleGap?: number | null;
  /** @dartType double? */
  readonly minVerticalPadding?: number | null;
  /** @dartType double? */
  readonly minLeadingWidth?: number | null;
  /** @dartType double? */
  readonly minTileHeight?: number | null;
  readonly titleAlignment?: ListTileTitleAlignment | null;
  readonly internalAddSemanticForOnTap?: boolean;
  /** @dartType double */
  readonly radioScaleFactor?: number;
  readonly enabled?: boolean | null;
  readonly radioBackgroundColor?: WidgetStateProperty<Color | null> | null;
  readonly radioSide?: BorderSide | null;
  /** @dartType WidgetStateProperty<double?>? */
  readonly radioInnerRadius?: WidgetStateProperty<DartDouble | null> | null;
}
export interface RadioListTileAdaptiveOptions<T> extends RadioListTileOptions<T> {
  readonly useCupertinoCheckmarkStyle?: boolean;
}
const adaptiveTiles = new WeakSet<Widget>();
export class RadioListTile<T> extends StatefulWidget {
  readonly options: Readonly<RadioListTileAdaptiveOptions<T>>;
  /**
   * @dartParam splashRadius double?
   * @dartParam horizontalTitleGap double?
   * @dartParam minVerticalPadding double?
   * @dartParam minLeadingWidth double?
   * @dartParam minTileHeight double?
   * @dartParam radioScaleFactor double
   * @dartParam radioInnerRadius WidgetStateProperty<double?>?
   */
  constructor(options: RadioListTileOptions<T>) {
    super(options.key ?? null);
    invariant(
      !('groupValue' in options || 'onChanged' in options),
      'deprecated-toggle-tile-option',
      'RadioListTile has no deprecated groupValue/onChanged option',
    );
    invariant(
      options.isThreeLine !== true || options.subtitle != null,
      'invalid-three-line-tile',
      'A three-line tile requires a subtitle',
    );
    this.options = Object.freeze({ ...options });
  }
  /**
   * @dartParam splashRadius double?
   * @dartParam horizontalTitleGap double?
   * @dartParam minVerticalPadding double?
   * @dartParam minLeadingWidth double?
   * @dartParam minTileHeight double?
   * @dartParam radioScaleFactor double
   * @dartParam radioInnerRadius WidgetStateProperty<double?>?
   */
  static adaptive<T>(options: RadioListTileAdaptiveOptions<T>): RadioListTile<T> {
    const result = new RadioListTile<T>(options);
    adaptiveTiles.add(result);
    return result;
  }
  get value(): T {
    return this.options.value;
  }
  get mouseCursor(): MouseCursor | null {
    return this.options.mouseCursor ?? null;
  }
  get toggleable(): boolean {
    return this.options.toggleable ?? false;
  }
  get activeColor(): Color | null {
    return this.options.activeColor ?? null;
  }
  get fillColor(): WidgetStateProperty<Color | null> | null {
    return this.options.fillColor ?? null;
  }
  get materialTapTargetSize(): MaterialTapTargetSize | null {
    return this.options.materialTapTargetSize ?? null;
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
  get title(): Widget | null {
    return this.options.title ?? null;
  }
  get subtitle(): Widget | null {
    return this.options.subtitle ?? null;
  }
  get secondary(): Widget | null {
    return this.options.secondary ?? null;
  }
  get isThreeLine(): boolean | null {
    return this.options.isThreeLine ?? null;
  }
  get dense(): boolean | null {
    return this.options.dense ?? null;
  }
  get selected(): boolean {
    return this.options.selected ?? false;
  }
  get controlAffinity(): ListTileControlAffinity | null {
    return this.options.controlAffinity ?? null;
  }
  get autofocus(): boolean {
    return this.options.autofocus ?? false;
  }
  get contentPadding(): EdgeInsetsGeometry | null {
    return this.options.contentPadding ?? null;
  }
  get shape(): ShapeBorder | null {
    return this.options.shape ?? null;
  }
  get tileColor(): Color | null {
    return this.options.tileColor ?? null;
  }
  get selectedTileColor(): Color | null {
    return this.options.selectedTileColor ?? null;
  }
  get visualDensity(): VisualDensity | null {
    return this.options.visualDensity ?? null;
  }
  get focusNode(): FocusNode | null {
    return this.options.focusNode ?? null;
  }
  get statesController(): WidgetStatesController | null {
    return this.options.statesController ?? null;
  }
  get onFocusChange(): ((value0: boolean) => void) | null {
    return this.options.onFocusChange ?? null;
  }
  get enableFeedback(): boolean | null {
    return this.options.enableFeedback ?? null;
  }
  /** @dartType double? */
  get horizontalTitleGap(): number | null {
    return this.options.horizontalTitleGap ?? null;
  }
  /** @dartType double? */
  get minVerticalPadding(): number | null {
    return this.options.minVerticalPadding ?? null;
  }
  /** @dartType double? */
  get minLeadingWidth(): number | null {
    return this.options.minLeadingWidth ?? null;
  }
  /** @dartType double? */
  get minTileHeight(): number | null {
    return this.options.minTileHeight ?? null;
  }
  get titleAlignment(): ListTileTitleAlignment | null {
    return this.options.titleAlignment ?? null;
  }
  get internalAddSemanticForOnTap(): boolean {
    return this.options.internalAddSemanticForOnTap ?? false;
  }
  get useCupertinoCheckmarkStyle(): boolean {
    return this.options.useCupertinoCheckmarkStyle ?? false;
  }
  /** @dartType double */
  get radioScaleFactor(): number {
    return this.options.radioScaleFactor ?? 1;
  }
  get enabled(): boolean | null {
    return this.options.enabled ?? null;
  }
  get radioBackgroundColor(): WidgetStateProperty<Color | null> | null {
    return this.options.radioBackgroundColor ?? null;
  }
  get radioSide(): BorderSide | null {
    return this.options.radioSide ?? null;
  }
  /** @dartType WidgetStateProperty<double?>? */
  get radioInnerRadius(): WidgetStateProperty<DartDouble | null> | null {
    return this.options.radioInnerRadius ?? null;
  }
  createState(): State<RadioListTile<T>> {
    return createRadioListTileState<T>((widget) => adaptiveTiles.has(widget));
  }
}
