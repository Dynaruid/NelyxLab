// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Flutter: packages/flutter/lib/src/cupertino/button.dart @ 71e4717a61786faab4c7aa39825989305ed29e8a
import { FoundationPlatform } from '@nelyx/core/foundation/platform';
import { Curves } from '@nelyx/core/framework/animation/curves';
import type { AlignmentGeometry } from '@nelyx/core/framework/painting/alignment';
import { BorderRadius } from '@nelyx/core/framework/painting/border-radius';
import type { BorderRadiusGeometry } from '@nelyx/core/framework/painting/border-radius';
import { BorderSide } from '@nelyx/core/framework/painting/borders';
import { ColorShapeDecoration } from '@nelyx/core/framework/painting/color-shape-decoration';
import type { EdgeInsetsGeometry } from '@nelyx/core/framework/painting/edge-insets';
import { RoundedSuperellipseBorder } from '@nelyx/core/framework/painting/rounded-superellipse-border';
import { StatelessWidget } from '@nelyx/core/framework/widgets/framework';
import type { Widget, BuildContext } from '@nelyx/core/framework/widgets/framework';
import { ControlInteraction } from '@nelyx/core/framework/widgets/control-interaction';
import type { ControlInteractionOptions } from '@nelyx/core/framework/widgets/control-interaction';
import { WidgetState, WidgetStateMouseCursor } from '@nelyx/core/framework/widgets/widget-state';
import { MouseCursor, SystemMouseCursors } from '@nelyx/core/services/mouse-cursor';
import {
  Padding,
  Text,
  DecoratedBox,
  ConstrainedBox,
  Align,
} from '@nelyx/core/framework/widgets/basic';
import { BoxConstraints } from '@nelyx/core/framework/rendering/constraints';
import { DefaultTextStyle } from '@nelyx/core/framework/widgets/default-text-style';
import { IconTheme } from '@nelyx/core/framework/widgets/icon-theme';
import { Opacity } from '@nelyx/core/framework/widgets/opacity';
import type { Size, Insets } from '@nelyx/core/ui/geometry';
import { Color } from '@nelyx/core/ui/color';
import type { CupertinoColor } from './internal/colors/color-values.ts';
import { resolveCupertinoColor } from './internal/colors/color-values.ts';
import { CupertinoTheme } from './theme.ts';
import { CupertinoColors } from './colors.ts';
import {
  kCupertinoButtonDefaultIconSize,
  kCupertinoButtonMinSize,
  kCupertinoButtonPadding,
  kCupertinoButtonSizeBorderRadius,
  kCupertinoButtonTapMoveSlop,
  kCupertinoButtonTintedOpacityDark,
  kCupertinoButtonTintedOpacityLight,
} from './constants.ts';
import { cupertinoFocusOutlineColor } from './internal/toggle/control-values.ts';

export const CupertinoButtonSize = Object.freeze({
  small: 'small',
  medium: 'medium',
  large: 'large',
} as const);
export type CupertinoButtonSize = (typeof CupertinoButtonSize)[keyof typeof CupertinoButtonSize];
export interface CupertinoButtonOptions extends Omit<
  ControlInteractionOptions,
  'selected' | 'semantics' | 'gestures' | 'pointerPress'
> {
  readonly child: Widget;
  readonly id?: string;
  readonly semanticsLabel?: string;
  readonly color?: CupertinoColor;
  readonly foregroundColor?: CupertinoColor;
  readonly disabledColor?: CupertinoColor;
  readonly sizeStyle?: CupertinoButtonSize;
  readonly padding?: Insets | EdgeInsetsGeometry;
  /** @deprecated Use minimumSize. */
  readonly minSize?: number;
  readonly minimumSize?: Size;
  readonly pressedOpacity?: number | null;
  readonly borderRadius?: number | BorderRadiusGeometry;
  readonly alignment?: AlignmentGeometry;
  readonly focusColor?: CupertinoColor;
}
/** Plain/filled/tinted functional button on the common input owner. */
export class CupertinoButton extends StatelessWidget {
  readonly options: Readonly<CupertinoButtonOptions>;
  private variant: 'plain' | 'filled' | 'tinted' = 'plain';
  constructor(options: CupertinoButtonOptions);
  constructor(id: string, label: string, onPressed: (() => void) | undefined);
  constructor(first: CupertinoButtonOptions | string, label?: string, onPressed?: () => void) {
    const options: CupertinoButtonOptions =
      typeof first === 'string'
        ? {
            id: first,
            semanticsLabel: label ?? '',
            child: new Text(label ?? ''),
            onPressed: onPressed ?? null,
          }
        : first;
    super(options.key ?? null);
    this.options = Object.freeze({ ...options });
    const opacity = options.pressedOpacity;
    if (opacity != null && (!Number.isFinite(opacity) || opacity < 0 || opacity > 1))
      throw new RangeError('pressedOpacity must be within [0,1]');
    if (options.minimumSize != null && options.minSize != null)
      throw new TypeError('Supply either minimumSize or minSize');
  }
  static filled(options: CupertinoButtonOptions): CupertinoButton {
    const button = new CupertinoButton(options);
    button.variant = 'filled';
    return button;
  }
  static tinted(options: CupertinoButtonOptions): CupertinoButton {
    const button = new CupertinoButton(options);
    button.variant = 'tinted';
    return button;
  }
  static tapMoveSlop(): number {
    switch (FoundationPlatform.defaultTargetPlatform) {
      case 'iOS':
      case 'android':
      case 'fuchsia':
        return kCupertinoButtonTapMoveSlop;
      default:
        return 0;
    }
  }
  get id(): string {
    if (this.options.id === undefined) throw new TypeError('No string button id was supplied');
    return this.options.id;
  }
  get label(): string {
    if (this.options.semanticsLabel === undefined)
      throw new TypeError('No string button label was supplied; read options.child');
    return this.options.semanticsLabel;
  }
  get onPressed(): (() => void) | undefined {
    return this.options.onPressed ?? undefined;
  }
  get enabled(): boolean {
    return (
      (this.options.enabled ?? true) &&
      (this.options.onPressed != null || this.options.onLongPress != null)
    );
  }
  build(context: BuildContext): Widget {
    const options = this.options,
      theme = CupertinoTheme.of(context),
      enabled = this.enabled,
      filled = this.variant === 'filled',
      tinted = this.variant === 'tinted',
      base =
        options.color === undefined
          ? filled || tinted
            ? new Color(theme.primaryColor)
            : null
          : resolveCupertinoColor(options.color, context),
      foreground =
        options.foregroundColor !== undefined
          ? resolveCupertinoColor(options.foregroundColor, context)
          : filled
            ? new Color(theme.primaryContrastingColor)
            : enabled
              ? new Color(theme.primaryColor)
              : resolveCupertinoColor(CupertinoColors.tertiaryLabel, context),
      fill =
        tinted && base
          ? base.withOpacity(
              theme.brightness === 'dark'
                ? kCupertinoButtonTintedOpacityDark
                : kCupertinoButtonTintedOpacityLight,
            )
          : base,
      background =
        !enabled && fill
          ? resolveCupertinoColor(
              options.disabledColor ?? CupertinoColors.quaternarySystemFill,
              context,
            )
          : fill;
    const size = options.sizeStyle ?? CupertinoButtonSize.large;
    const minSize = options.minSize ?? kCupertinoButtonMinSize[size];
    const minimum = options.minimumSize ?? { width: minSize, height: minSize };
    const padding = options.padding ?? kCupertinoButtonPadding[size];
    const radius =
      typeof options.borderRadius === 'number'
        ? BorderRadius.circular(options.borderRadius)
        : (options.borderRadius ?? kCupertinoButtonSizeBorderRadius[size]);
    const focusColor =
      options.focusColor === undefined
        ? cupertinoFocusOutlineColor(fill ?? CupertinoColors.activeBlue)
        : resolveCupertinoColor(options.focusColor, context);
    const {
      key: _key,
      child,
      id,
      semanticsLabel,
      color: _color,
      foregroundColor: _foregroundColor,
      disabledColor: _disabledColor,
      sizeStyle: _sizeStyle,
      padding: _padding,
      minSize: _minSize,
      minimumSize: _minimumSize,
      pressedOpacity: _pressedOpacity,
      borderRadius: _borderRadius,
      alignment,
      focusColor: _focusColor,
      ...interaction
    } = options;
    return new ControlInteraction(
      (controlContext, state) => {
        const text = (
          size === 'small' ? theme.textTheme.actionSmallTextStyle : theme.textTheme.actionTextStyle
        ).copyWith({ color: foreground.toARGB32() });
        const iconTheme = IconTheme.of(controlContext).copyWith({
          color: foreground,
          size: text.fontSize === null ? kCupertinoButtonDefaultIconSize : text.fontSize * 1.2,
        });
        const side =
          enabled && state.showFocusHighlight
            ? new BorderSide({
                color: focusColor.toARGB32(),
                width: 3.5,
                strokeAlign: BorderSide.strokeAlignOutside,
              })
            : BorderSide.none;
        const body = new ConstrainedBox(
          new DecoratedBox(
            new Padding(
              padding,
              new Align(new DefaultTextStyle(text, new IconTheme(iconTheme, child)), {
                widthFactor: 1,
                heightFactor: 1,
                ...(alignment ? { alignment } : {}),
              }),
            ),
            {
              decoration: new ColorShapeDecoration(
                new RoundedSuperellipseBorder({ borderRadius: radius, side }),
                background,
              ),
            },
          ),
          new BoxConstraints(minimum.width, Infinity, minimum.height, Infinity),
        );
        return new Opacity(body, {
          opacity:
            1 -
            state.pressProgress *
              (1 - (options.pressedOpacity === null ? 1 : (options.pressedOpacity ?? 0.4))),
        });
      },
      {
        ...interaction,
        enabled,
        requestFocusOnPointer: interaction.requestFocusOnPointer ?? false,
        pointerPress: {
          hitSlop: CupertinoButton.tapMoveSlop(),
          pressDuration: 120,
          releaseDuration: 180,
          pressCurve: Curves.easeInOutCubicEmphasized,
          releaseCurve: Curves.easeOutCubic,
          progressCurve: Curves.decelerate,
        },
        mouseCursorResolver:
          interaction.mouseCursorResolver ??
          ((states) =>
            interaction.mouseCursor instanceof WidgetStateMouseCursor
              ? interaction.mouseCursor.resolve(states)
              : (interaction.mouseCursor ??
                (FoundationPlatform.hostEnvironment.kind === 'web' &&
                !states.contains(WidgetState.disabled)
                  ? SystemMouseCursors.click
                  : MouseCursor.defer))),
        semantics: {
          button: true,
          label: semanticsLabel ?? null,
          excludeSemantics: semanticsLabel !== undefined,
          identifier: id ?? null,
          transportId: id ?? null,
        },
      },
    );
  }
}
