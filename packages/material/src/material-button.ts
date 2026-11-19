// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Flutter: packages/flutter/lib/src/material/material_button.dart @ 71e4717a61786faab4c7aa39825989305ed29e8a
import { invariant } from '@nelyx/core/foundation/errors';
import { StatelessWidget } from '@nelyx/core/framework/widgets/framework';
import type { BuildContext, Widget } from '@nelyx/core/framework/widgets/framework';
import type { Color } from '@nelyx/core/ui/color';
import { RawMaterialButton } from './button.ts';
import type { RawMaterialButtonOptions } from './button.ts';
import { ButtonTheme } from './button-theme.ts';
import type { ButtonTextTheme, ButtonThemeButton } from './button-theme.ts';
import type { VisualDensity } from './theme-data.ts';
import { Theme } from './theme.ts';

export interface MaterialButtonOptions extends Omit<
  RawMaterialButtonOptions,
  | 'fillColor'
  | 'constraints'
  | 'textStyle'
  | 'elevation'
  | 'focusElevation'
  | 'hoverElevation'
  | 'highlightElevation'
  | 'disabledElevation'
  | 'padding'
  | 'visualDensity'
  | 'shape'
  | 'animationDuration'
> {
  readonly textTheme?: ButtonTextTheme | null;
  readonly textColor?: Color | null;
  readonly disabledTextColor?: Color | null;
  readonly color?: Color | null;
  readonly disabledColor?: Color | null;
  readonly colorBrightness?: 'light' | 'dark' | null;
  readonly elevation?: number | null;
  readonly focusElevation?: number | null;
  readonly hoverElevation?: number | null;
  readonly highlightElevation?: number | null;
  readonly disabledElevation?: number | null;
  readonly padding?: RawMaterialButtonOptions['padding'] | null;
  readonly visualDensity?: VisualDensity | null;
  readonly shape?: RawMaterialButtonOptions['shape'] | null;
  readonly animationDuration?: number | null;
  readonly minWidth?: number | null;
  readonly height?: number | null;
}

export class MaterialButton extends StatelessWidget implements ButtonThemeButton {
  readonly options: Readonly<MaterialButtonOptions>;
  constructor(options: MaterialButtonOptions) {
    super(options.key ?? null);
    invariant(
      [
        options.elevation,
        options.focusElevation,
        options.hoverElevation,
        options.highlightElevation,
        options.disabledElevation,
      ].every((value) => value == null || (Number.isFinite(value) && value >= 0)),
      'invalid-material-button-elevation',
      'Button elevations must be finite and nonnegative',
    );
    this.options = Object.freeze({ ...options });
  }

  get onPressed() {
    return this.options.onPressed;
  }
  get onLongPress() {
    return this.options.onLongPress ?? null;
  }
  get onHighlightChanged() {
    return this.options.onHighlightChanged ?? null;
  }
  get mouseCursor() {
    return this.options.mouseCursor ?? null;
  }
  get textTheme() {
    return this.options.textTheme ?? null;
  }
  get textColor() {
    return this.options.textColor ?? null;
  }
  get disabledTextColor() {
    return this.options.disabledTextColor ?? null;
  }
  get color() {
    return this.options.color ?? null;
  }
  get disabledColor() {
    return this.options.disabledColor ?? null;
  }
  get focusColor() {
    return this.options.focusColor ?? null;
  }
  get hoverColor() {
    return this.options.hoverColor ?? null;
  }
  get highlightColor() {
    return this.options.highlightColor ?? null;
  }
  get splashColor() {
    return this.options.splashColor ?? null;
  }
  get colorBrightness() {
    return this.options.colorBrightness ?? null;
  }
  get elevation() {
    return this.options.elevation ?? null;
  }
  get focusElevation() {
    return this.options.focusElevation ?? null;
  }
  get hoverElevation() {
    return this.options.hoverElevation ?? null;
  }
  get highlightElevation() {
    return this.options.highlightElevation ?? null;
  }
  get disabledElevation() {
    return this.options.disabledElevation ?? null;
  }
  get padding() {
    return this.options.padding ?? null;
  }
  get visualDensity() {
    return this.options.visualDensity ?? null;
  }
  get shape() {
    return this.options.shape ?? null;
  }
  get animationDuration() {
    return this.options.animationDuration ?? null;
  }
  get clipBehavior() {
    return this.options.clipBehavior ?? 'none';
  }
  get focusNode() {
    return this.options.focusNode ?? null;
  }
  get autofocus() {
    return this.options.autofocus ?? false;
  }
  get materialTapTargetSize() {
    return this.options.materialTapTargetSize ?? null;
  }
  get minWidth() {
    return this.options.minWidth ?? null;
  }
  get height() {
    return this.options.height ?? null;
  }
  get enableFeedback() {
    return this.options.enableFeedback ?? true;
  }
  get child() {
    return this.options.child ?? null;
  }
  get enabled(): boolean {
    return this.onPressed != null || this.onLongPress !== null;
  }
  get filled(): boolean {
    return this.constructor !== MaterialButton;
  }

  build(context: BuildContext): Widget {
    const theme = Theme.of(context);
    const buttonTheme = ButtonTheme.of(context);
    const constraints = buttonTheme.getConstraints(this);
    return new RawMaterialButton({
      onPressed: this.onPressed,
      onLongPress: this.onLongPress,
      enableFeedback: this.enableFeedback,
      onHighlightChanged: this.onHighlightChanged,
      mouseCursor: this.mouseCursor,
      fillColor: buttonTheme.getFillColor(this),
      textStyle:
        theme.textTheme.labelLarge?.copyWith({ color: buttonTheme.getTextColor(this) }) ?? null,
      focusColor: this.focusColor ?? buttonTheme.getFocusColor(this),
      hoverColor: this.hoverColor ?? buttonTheme.getHoverColor(this),
      highlightColor: this.highlightColor ?? theme.highlightColor,
      splashColor: this.splashColor ?? theme.splashColor,
      elevation: buttonTheme.getElevation(this),
      focusElevation: buttonTheme.getFocusElevation(this),
      hoverElevation: buttonTheme.getHoverElevation(this),
      highlightElevation: buttonTheme.getHighlightElevation(this),
      disabledElevation: this.disabledElevation ?? 0,
      padding: buttonTheme.getPadding(this),
      visualDensity: this.visualDensity ?? theme.visualDensity,
      constraints: constraints.copyWith({
        minWidth: this.minWidth ?? constraints.minWidth,
        minHeight: this.height ?? constraints.minHeight,
      }),
      shape: buttonTheme.getShape(this),
      clipBehavior: this.clipBehavior,
      focusNode: this.focusNode,
      autofocus: this.autofocus,
      animationDuration: buttonTheme.getAnimationDuration(this),
      materialTapTargetSize: this.materialTapTargetSize ?? theme.materialTapTargetSize,
      child: this.child,
    });
  }
}
