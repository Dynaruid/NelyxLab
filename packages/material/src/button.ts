// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Flutter: packages/flutter/lib/src/material/button.dart @ 71e4717a61786faab4c7aa39825989305ed29e8a
import { invariant } from '@nelyx/core/foundation/errors';
import type { ShapeBorder } from '@nelyx/core/framework/painting/borders';
import { EdgeInsets } from '@nelyx/core/framework/painting/edge-insets';
import type { EdgeInsetsGeometry } from '@nelyx/core/framework/painting/edge-insets';
import { RoundedRectangleBorder } from '@nelyx/core/framework/painting/rounded-rectangle-border';
import { resolveTextStyleColors } from '@nelyx/core/framework/painting/text-style';
import type { TextStyle } from '@nelyx/core/framework/painting/text-style';
import { BoxConstraints } from '@nelyx/core/framework/rendering/constraints';
import { Center, ConstrainedBox, Padding } from '@nelyx/core/framework/widgets/basic';
import type { FocusNode } from '@nelyx/core/framework/widgets/focus';
import { StatefulWidget } from '@nelyx/core/framework/widgets/framework';
import type { BuildContext, Widget, WidgetOptions } from '@nelyx/core/framework/widgets/framework';
import { IconTheme } from '@nelyx/core/framework/widgets/icon-theme';
import { IconThemeData } from '@nelyx/core/framework/widgets/icon-theme-data';
import { Semantics } from '@nelyx/core/framework/widgets/semantics';
import {
  WidgetState,
  WidgetStateColor,
  WidgetStateMouseCursor,
  WidgetStateOutlinedBorder,
} from '@nelyx/core/framework/widgets/widget-state';
import type { WidgetStateProperty } from '@nelyx/core/framework/widgets/widget-state';
import type { MouseCursor } from '@nelyx/core/services/mouse-cursor';
import type { Clip } from '@nelyx/core/ui/clip';
import { Color } from '@nelyx/core/ui/color';
import { Size } from '@nelyx/core/ui/size';
import { kMinInteractiveDimension, kThemeChangeDuration } from './constants.ts';
import { InkWell } from './ink-well.ts';
import { ButtonInputPadding } from './internal/button/input-padding.ts';
import { Material, MaterialType } from './material.ts';
import { MaterialStateMixin } from './material-state-mixin.ts';
import { Theme } from './theme.ts';
import { MaterialTapTargetSize, VisualDensity } from './theme-data.ts';

interface RawButtonInteractionOptions extends WidgetOptions {
  readonly onPressed: (() => void) | null;
  readonly onLongPress?: (() => void) | null;
  readonly onHighlightChanged?: ((highlighted: boolean) => void) | null;
  readonly mouseCursor?: MouseCursor | WidgetStateProperty<MouseCursor> | null;
  readonly focusColor?: Color | null;
  readonly hoverColor?: Color | null;
  readonly highlightColor?: Color | null;
  readonly splashColor?: Color | null;
  readonly clipBehavior?: Clip;
  readonly focusNode?: FocusNode | null;
  readonly autofocus?: boolean;
  readonly enableFeedback?: boolean;
  readonly child?: Widget | null;
}

export interface RawMaterialButtonOptions extends RawButtonInteractionOptions {
  readonly textStyle?: TextStyle | null;
  readonly fillColor?: Color | null;
  readonly elevation?: number;
  readonly focusElevation?: number;
  readonly hoverElevation?: number;
  readonly highlightElevation?: number;
  readonly disabledElevation?: number;
  readonly padding?: EdgeInsetsGeometry;
  readonly visualDensity?: VisualDensity;
  readonly constraints?: BoxConstraints;
  readonly shape?: ShapeBorder;
  readonly animationDuration?: number;
  readonly materialTapTargetSize?: MaterialTapTargetSize | null;
}

const defaultConstraints = new BoxConstraints(88, Infinity, 36, Infinity);
const defaultShape = new RoundedRectangleBorder();

export class RawMaterialButton extends StatefulWidget {
  readonly options: Readonly<RawMaterialButtonOptions>;
  constructor(options: RawMaterialButtonOptions) {
    super(options.key ?? null);
    invariant(
      [
        options.elevation,
        options.focusElevation,
        options.hoverElevation,
        options.highlightElevation,
        options.disabledElevation,
      ].every((value) => value === undefined || (Number.isFinite(value) && value >= 0)),
      'invalid-raw-button-elevation',
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
  get textStyle() {
    return this.options.textStyle ?? null;
  }
  get fillColor() {
    return this.options.fillColor ?? null;
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
  get elevation() {
    return this.options.elevation ?? 2;
  }
  get focusElevation() {
    return this.options.focusElevation ?? 4;
  }
  get hoverElevation() {
    return this.options.hoverElevation ?? 4;
  }
  get highlightElevation() {
    return this.options.highlightElevation ?? 8;
  }
  get disabledElevation() {
    return this.options.disabledElevation ?? 0;
  }
  get padding() {
    return this.options.padding ?? EdgeInsets.zero;
  }
  get visualDensity() {
    return this.options.visualDensity ?? VisualDensity.standard;
  }
  get constraints() {
    return this.options.constraints ?? defaultConstraints;
  }
  get shape() {
    return this.options.shape ?? defaultShape;
  }
  get animationDuration() {
    return this.options.animationDuration ?? kThemeChangeDuration;
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
    return this.options.materialTapTargetSize ?? MaterialTapTargetSize.padded;
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

  createState(): MaterialStateMixin<RawMaterialButton> {
    return new RawMaterialButtonState();
  }
}

class RawMaterialButtonState extends MaterialStateMixin<RawMaterialButton> {
  override initState(): void {
    if (!this.widget.enabled) this.materialStates.add(WidgetState.disabled);
  }

  override didUpdateWidget(): void {
    if (this.widget.enabled) this.materialStates.remove(WidgetState.disabled);
    else {
      this.materialStates.add(WidgetState.disabled);
      this.materialStates.remove(WidgetState.pressed);
    }
  }

  private get elevation(): number {
    if (this.isDisabled) return this.widget.disabledElevation;
    if (this.isPressed) return this.widget.highlightElevation;
    if (this.isHovered) return this.widget.hoverElevation;
    if (this.isFocused) return this.widget.focusElevation;
    return this.widget.elevation;
  }

  build(context: BuildContext): Widget {
    const button = this.widget;
    const theme = Theme.of(context);
    const textStyle =
      button.textStyle === null
        ? null
        : resolveTextStyleColors(button.textStyle, (color) =>
            color instanceof WidgetStateColor ? color.resolve(this.materialStates) : color,
          );
    const shape =
      button.shape instanceof WidgetStateOutlinedBorder
        ? button.shape.resolve(this.materialStates)
        : button.shape;
    const densityAdjustment = button.visualDensity.baseSizeAdjustment;
    const { dx, dy } = densityAdjustment;
    const padding = button.padding
      .add(EdgeInsets.fromLTRB(dx, dy, dx, dy))
      .clamp(EdgeInsets.zero, EdgeInsets.infinity);
    const child = IconTheme.merge({
      data: new IconThemeData({
        color: textStyle?.color == null ? null : new Color(textStyle.color),
      }),
      child: new Padding(
        padding,
        new Center(button.child ?? undefined, { widthFactor: 1, heightFactor: 1 }),
      ),
    });
    const ink = new InkWell({
      focusNode: button.focusNode,
      autofocus: button.autofocus,
      canRequestFocus: button.enabled,
      onFocusChange: this.updateMaterialState(WidgetState.focused),
      onHighlightChanged: this.updateMaterialState(
        WidgetState.pressed,
        button.onHighlightChanged === null ? {} : { onChanged: button.onHighlightChanged },
      ),
      onHover: this.updateMaterialState(WidgetState.hovered),
      onTap: button.onPressed,
      onLongPress: button.onLongPress,
      splashColor: button.splashColor,
      focusColor: button.focusColor,
      hoverColor: button.hoverColor,
      highlightColor: button.highlightColor,
      mouseCursor: button.mouseCursor ?? WidgetStateMouseCursor.adaptiveClickable,
      enableFeedback: button.enableFeedback,
      customBorder: shape,
      child,
    });
    return new Semantics({
      button: true,
      container: true,
      enabled: button.enabled,
      child: new ButtonInputPadding(
        button.materialTapTargetSize === MaterialTapTargetSize.padded
          ? new Size(kMinInteractiveDimension + dx, kMinInteractiveDimension + dy)
          : Size.zero,
        new ConstrainedBox(
          new Material({
            elevation: this.elevation,
            textStyle,
            shape,
            type: button.fillColor === null ? MaterialType.transparency : MaterialType.button,
            color: button.fillColor,
            shadowColor: theme.shadowColor,
            animationDuration: button.animationDuration,
            clipBehavior: button.clipBehavior,
            child: ink,
          }),
          button.visualDensity.effectiveConstraints(button.constraints),
        ),
      ),
    });
  }
}
