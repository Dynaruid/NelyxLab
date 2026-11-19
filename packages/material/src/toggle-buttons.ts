// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Flutter: packages/flutter/lib/src/material/toggle_buttons.dart @ 71e4717a61786faab4c7aa39825989305ed29e8a
import { invariant } from '@nelyx/core/foundation/errors';
import { Axis, VerticalDirection } from '@nelyx/core/framework/painting/basic-types';
import { BorderRadius } from '@nelyx/core/framework/painting/border-radius';
import { BorderSide } from '@nelyx/core/framework/painting/borders';
import { EdgeInsets } from '@nelyx/core/framework/painting/edge-insets';
import { RoundedRectangleBorder } from '@nelyx/core/framework/painting/rounded-rectangle-border';
import { TextStyle } from '@nelyx/core/framework/painting/text-style';
import { CustomPainter } from '@nelyx/core/framework/rendering/custom-paint';
import { Directionality } from '@nelyx/core/framework/widgets/app-data';
import {
  Center,
  Column,
  IntrinsicHeight,
  IntrinsicWidth,
  Padding,
  Row,
} from '@nelyx/core/framework/widgets/basic';
import { ClipRRect } from '@nelyx/core/framework/widgets/clip';
import { CustomPaint } from '@nelyx/core/framework/widgets/custom-paint';
import type { FocusNode } from '@nelyx/core/framework/widgets/focus';
import { StatelessWidget } from '@nelyx/core/framework/widgets/framework';
import type { BuildContext, Widget, WidgetOptions } from '@nelyx/core/framework/widgets/framework';
import { MergeSemantics, Semantics } from '@nelyx/core/framework/widgets/semantics';
import {
  WidgetState,
  WidgetStateColor,
  emptyWidgetStateSet,
} from '@nelyx/core/framework/widgets/widget-state';
import type { MouseCursor } from '@nelyx/core/services/mouse-cursor';
import type { Canvas } from '@nelyx/core/ui/canvas';
import { Color } from '@nelyx/core/ui/color';
import type { Size as BoxSize } from '@nelyx/core/ui/geometry';
import { Paint } from '@nelyx/core/ui/paint';
import { Radius } from '@nelyx/core/ui/radius';
import { Rect } from '@nelyx/core/ui/rect';
import { Size } from '@nelyx/core/ui/size';
import { kMinInteractiveDimension, kThemeChangeDuration } from './constants.ts';
import { InkRipple } from './ink-ripple.ts';
import { ButtonInputPadding } from './internal/button/input-padding.ts';
import { colorProperty, cursorProperty } from './internal/button/style-properties.ts';
import { TextButton } from './text-button.ts';
import { Theme } from './theme.ts';
import { MaterialTapTargetSize, VisualDensity } from './theme-data.ts';
import { ToggleButtonsTheme } from './toggle-buttons-theme.ts';
import type { ToggleButtonsThemeDataOptions } from './toggle-buttons-theme-data.ts';

export interface ToggleButtonsOptions extends WidgetOptions, ToggleButtonsThemeDataOptions {
  readonly children: readonly Widget[];
  readonly isSelected: readonly boolean[];
  readonly onPressed?: ((index: number) => void) | null;
  readonly focusNodes?: readonly FocusNode[] | null;
  readonly mouseCursor?: MouseCursor | null;
  readonly tapTargetSize?: MaterialTapTargetSize | null;
  readonly renderBorder?: boolean;
  readonly direction?: Axis | 'horizontal' | 'vertical';
  readonly verticalDirection?: VerticalDirection | 'up' | 'down';
}

const squareBorder = new RoundedRectangleBorder();

export class ToggleButtons extends StatelessWidget {
  constructor(readonly options: ToggleButtonsOptions) {
    super(options.key ?? null);
    invariant(
      options.children.length === options.isSelected.length &&
        (options.focusNodes == null || options.focusNodes.length === options.children.length),
      'toggle-buttons-length',
      'ToggleButtons children, selection and focus nodes must have the same length',
    );
  }

  override build(context: BuildContext): Widget {
    const options = this.options;
    const theme = Theme.of(context);
    const local = ToggleButtonsTheme.of(context);
    const onPressed = options.onPressed ?? null;
    const textDirection = Directionality.of(context);
    const horizontal = options.direction !== Axis.vertical && options.direction !== 'vertical';
    const up =
      options.verticalDirection === VerticalDirection.up || options.verticalDirection === 'up';
    const reversed = horizontal ? textDirection === 'rtl' : up;
    const onSurface = new Color(theme.colorScheme.onSurface);
    const primary = new Color(theme.colorScheme.primary);
    const emptyFill = new Color(theme.colorScheme.surface).withOpacity(0);
    const defaultBorder = onSurface.withOpacity(0.12);
    const normalBorder = options.borderColor ?? local.borderColor ?? defaultBorder;
    const selectedBorder =
      options.selectedBorderColor ?? local.selectedBorderColor ?? defaultBorder;
    const disabledBorder =
      options.disabledBorderColor ?? local.disabledBorderColor ?? defaultBorder;
    const disabled = options.disabledColor ?? local.disabledColor ?? onSurface.withOpacity(0.38);
    const unselected = options.color ?? local.color ?? onSurface.withOpacity(0.87);
    const selected = options.selectedColor ?? local.selectedColor ?? primary;
    const style =
      options.textStyle ?? local.textStyle ?? theme.textTheme.bodyMedium ?? new TextStyle();
    const constraints = options.constraints ?? local.constraints;
    const minSize = constraints
      ? new Size(constraints.minWidth, constraints.minHeight)
      : new Size(kMinInteractiveDimension, kMinInteractiveDimension);
    const maxSize = constraints
      ? new Size(constraints.maxWidth, constraints.maxHeight)
      : new Size(Infinity, Infinity);
    const padded =
      (options.tapTargetSize ?? theme.materialTapTargetSize) === MaterialTapTargetSize.padded;
    const crossTarget = padded ? kMinInteractiveDimension : 0;
    const hitSize = horizontal ? new Size(0, crossTarget) : new Size(crossTarget, 0);
    const radius = options.borderRadius ?? local.borderRadius ?? BorderRadius.zero;
    const strokeWidth = options.borderWidth ?? local.borderWidth ?? 1;
    invariant(
      Number.isFinite(strokeWidth) && strokeWidth >= 0,
      'toggle-border-width',
      'ToggleButtons border width must be finite and nonnegative',
    );
    const renderBorder = options.renderBorder !== false;
    const width = renderBorder ? strokeWidth : 0;

    const buttons = options.children.map((child, index) => {
      const active = onPressed !== null && options.isSelected[index] === true;
      const first = index === 0;
      const last = index === options.children.length - 1;
      const start = reversed ? last : first;
      const end = reversed ? first : last;
      const edgeRadius = new BorderRadius({
        topLeft: start ? radius.topLeft : Radius.zero,
        topRight: (horizontal ? end : start) ? radius.topRight : Radius.zero,
        bottomLeft: (horizontal ? start : end) ? radius.bottomLeft : Radius.zero,
        bottomRight: end ? radius.bottomRight : Radius.zero,
      });
      const insets = horizontal
        ? EdgeInsets.fromLTRB(
            reversed && !last ? 0 : width,
            width,
            reversed || last ? width : 0,
            width,
          )
        : EdgeInsets.fromLTRB(
            width,
            reversed && !last ? 0 : width,
            width,
            reversed || last ? width : 0,
          );
      const foreground = onPressed === null ? disabled : active ? selected : unselected;
      const stateSet = emptyWidgetStateSet();
      if (onPressed === null) stateSet.add(WidgetState.disabled);
      if (active) stateSet.add(WidgetState.selected);
      const fill = options.fillColor ?? local.fillColor;
      const background =
        fill instanceof WidgetStateColor
          ? fill.resolve(stateSet)
          : active
            ? (fill ?? primary.withOpacity(0.12))
            : emptyFill;
      const overlayBase = active ? primary : onSurface;
      const buttonStyle = TextButton.styleFrom({
        foregroundColor: foreground,
        disabledForegroundColor: foreground,
        iconColor: foreground,
        disabledIconColor: foreground,
        iconSize: 24,
        backgroundColor: background,
        disabledBackgroundColor: background,
        elevation: 0,
        textStyle: style.copyWith({ color: foreground.toARGB32() }),
        padding: EdgeInsets.zero,
        minimumSize: minSize,
        maximumSize: maxSize,
        side: BorderSide.none,
        shape: squareBorder,
        visualDensity: VisualDensity.standard,
        tapTargetSize: MaterialTapTargetSize.shrinkWrap,
        animationDuration: kThemeChangeDuration,
        enableFeedback: true,
        splashFactory: InkRipple.splashFactory,
      }).copyWith({
        mouseCursor: cursorProperty(() => options.mouseCursor ?? null),
        overlayColor: colorProperty((states) => {
          if (onPressed === null) return null;
          if (states.contains(WidgetState.pressed))
            return (
              options.splashColor ??
              local.splashColor ??
              (active ? null : (options.highlightColor ?? local.highlightColor)) ??
              overlayBase.withOpacity(0.16)
            );
          if (states.contains(WidgetState.hovered))
            return options.hoverColor ?? local.hoverColor ?? overlayBase.withOpacity(0.04);
          if (states.contains(WidgetState.focused))
            return options.focusColor ?? local.focusColor ?? overlayBase.withOpacity(0.12);
          return null;
        }),
      });
      const clipRadius = edgeRadius.subtract(BorderRadius.circular(strokeWidth / 2));
      let button: Widget = new ClipRRect(
        new TextButton({
          onPressed: onPressed === null ? null : () => onPressed(index),
          focusNode: options.focusNodes?.[index] ?? null,
          style: buttonStyle,
          child,
        }),
        { borderRadius: clipRadius },
      );
      if (renderBorder) {
        const edgeColor =
          onPressed === null ? disabledBorder : active ? selectedBorder : normalBorder;
        const dividerColor =
          onPressed !== null && (active || options.isSelected[index - 1])
            ? selectedBorder
            : edgeColor;
        const painter = new ToggleButtonBorder(
          edgeRadius,
          horizontal,
          start,
          end,
          first ? null : dividerColor,
          reversed,
          width,
          edgeColor,
        );
        button = new CustomPaint(new Padding(insets, button), { foregroundPainter: painter });
      }
      if (constraints !== null) button = new Center(button);
      return new MergeSemantics({
        child: new Semantics({
          container: true,
          checked: options.isSelected[index]!,
          enabled: onPressed !== null,
          child: new ButtonInputPadding(hitSize, button, horizontal ? 'horizontal' : 'vertical'),
        }),
      });
    });

    const layout = { mainAxisSize: 'min', crossAxisAlignment: 'stretch' } as const;
    return horizontal
      ? new IntrinsicHeight(new Row(buttons, { ...layout, textDirection }))
      : new IntrinsicWidth(
          new Column(buttons, { ...layout, verticalDirection: up ? 'up' : 'down' }),
        );
  }
}

class ToggleButtonBorder extends CustomPainter {
  constructor(
    private readonly radius: BorderRadius,
    private readonly horizontal: boolean,
    private readonly start: boolean,
    private readonly end: boolean,
    private readonly divider: Color | null,
    private readonly reversed: boolean,
    private readonly width: number,
    private readonly color: Color,
  ) {
    super();
  }

  override paint(canvas: Canvas, size: BoxSize): void {
    if (size.width <= 0 || size.height <= 0) return;
    const cross = this.horizontal ? size.height : size.width;
    const main = this.horizontal ? size.width : size.height;
    const width = Math.min(this.width, cross, main);
    const inset = width / 2;
    // Open edges continue to the next segment, which owns the shared stroke.
    const open = -(inset || 1);
    const rect = (from: number, to: number, crossFrom: number, crossTo: number) =>
      this.horizontal
        ? Rect.fromLTRB(from, crossFrom, to, crossTo)
        : Rect.fromLTRB(crossFrom, from, crossTo, to);
    const frame = rect(
      this.start ? inset : open,
      this.end ? main - inset : main - open,
      inset,
      cross - inset,
    );
    const split = this.divider === null ? 0 : width;
    canvas.save();
    canvas.clipRect(rect(this.reversed ? 0 : split, main - (this.reversed ? split : 0), 0, cross));
    canvas.drawRRect(
      this.radius.toRRect(frame),
      new Paint({ color: this.color.toARGB32(), style: 'stroke', strokeWidth: width }),
    );
    canvas.restore();
    if (this.divider === null) return;
    const edge = this.reversed ? main : 0;
    if (width === 0) {
      const p = this.horizontal ? { x: edge, y: 0 } : { x: 0, y: edge };
      const q = this.horizontal ? { x: edge, y: cross } : { x: cross, y: edge };
      canvas.drawLine(p, q, new Paint({ color: this.divider.toARGB32(), style: 'stroke' }));
    } else {
      canvas.drawRect(
        rect(this.reversed ? edge - width : edge, this.reversed ? edge : edge + width, 0, cross),
        new Paint({ color: this.divider.toARGB32() }),
      );
    }
  }

  override shouldRepaint(old: ToggleButtonBorder): boolean {
    return (
      !this.radius.equals(old.radius) ||
      this.horizontal !== old.horizontal ||
      this.start !== old.start ||
      this.end !== old.end ||
      this.reversed !== old.reversed ||
      this.width !== old.width ||
      !this.color.equals(old.color) ||
      (this.divider === null ? old.divider !== null : !this.divider.equals(old.divider))
    );
  }
}
