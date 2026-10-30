// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Source state/style/layout/material/ink responsibilities on canonical Nelyx owners.
import { StatefulWidget, Element } from '@nelyx/core/framework/widgets/framework';
import type { Widget, BuildContext, State } from '@nelyx/core/framework/widgets/framework';
import { GlobalKey } from '@nelyx/core/framework/widgets/global-key';
import { MediaQuery } from '@nelyx/core/framework/widgets/app-data';
import { DiagnosticsProperty } from '@nelyx/core/foundation/diagnostics';
import type { DiagnosticPropertiesBuilder } from '@nelyx/core/foundation/diagnostics';
import { FlagProperty } from '@nelyx/core/foundation/diagnostic-properties';
import type { ControlInteractionOptions } from '@nelyx/core/framework/widgets/control-interaction';
import {
  WidgetState,
  WidgetStatesController,
  WidgetStateProperty,
  WidgetStateMouseCursor,
} from '@nelyx/core/framework/widgets/widget-state';
import type { DartSet } from '@nelyx/core/foundation/dart-collections';
import { DartDouble } from '@nelyx/core/foundation/dart-numeric';
import type { DartTypeWitness } from '@nelyx/core/foundation/dart-type-witness';
import { Padding, ConstrainedBox, Align, Text } from '@nelyx/core/framework/widgets/basic';
import { BoxConstraints } from '@nelyx/core/framework/rendering/constraints';
import { IconTheme } from '@nelyx/core/framework/widgets/icon-theme';
import '@nelyx/core/framework/widgets/icon-theme-data';
import { Semantics } from '@nelyx/core/framework/widgets/semantics';
import { RepaintBoundary } from '@nelyx/core/framework/widgets/repaint-boundary';
import { TickerProviderStateMixin } from '@nelyx/core/framework/widgets/ticker-provider';
import { AnimationController } from '@nelyx/core/framework/animation/animation-controller';
import { AnimationStatus } from '@nelyx/core/framework/animation/animation';
import { Color } from '@nelyx/core/ui/color';
import { Size } from '@nelyx/core/ui/size';
import type { Clip } from '@nelyx/core/ui/clip';
import { EdgeInsets, EdgeInsetsGeometry } from '@nelyx/core/framework/painting/edge-insets';
import { Alignment } from '@nelyx/core/framework/painting/alignment';
import { StadiumBorder } from '@nelyx/core/framework/painting/stadium-border';
import { BorderSide } from '@nelyx/core/framework/painting/borders';
import { SystemMouseCursors } from '@nelyx/core/services/mouse-cursor';
import { invariant } from '@nelyx/core/foundation/errors';
import { Theme } from './theme.ts';
import { MaterialTapTargetSize } from './theme-data.ts';
import { ButtonStyle } from './button-style.ts';
import type { ColorScheme } from './color-scheme.ts';
import { FilledButtonTheme } from './filled-button-theme.ts';
import { TextButtonTheme } from './text-button-theme.ts';
import { OutlinedButtonTheme } from './outlined-button-theme.ts';
import { ElevatedButtonTheme } from './elevated-button-theme.ts';
import { Material, MaterialType } from './material.ts';
import { InkWell } from './ink-well.ts';
import { Tooltip } from './tooltip.ts';
import {
  colorProperty,
  doubleProperty,
  doubleAll,
  sizeAll,
  insetsAll,
  shapeAll,
  textAll,
  sideProperty,
} from './internal/button/style-properties.ts';
import { ButtonInputPadding } from './internal/button/input-padding.ts';
export { IconAlignment } from './icon-alignment.ts';
export type MaterialButtonVariant = 'filled' | 'text' | 'outlined' | 'elevated' | 'tonal';
export interface MaterialButtonColors {
  readonly foreground: Color;
  readonly background: Color;
  readonly overlay: Color | null;
}
export function resolveMaterialButtonColors(
  colors: ColorScheme,
  variant: MaterialButtonVariant,
  states: DartSet<WidgetState>,
): MaterialButtonColors {
  const disabled = states.contains(WidgetState.disabled),
    filled = variant === 'filled',
    tonal = variant === 'tonal',
    surface = variant === 'elevated',
    foreground = disabled
      ? new Color(colors.onSurface).withOpacity(0.38)
      : new Color(filled ? colors.onPrimary : tonal ? colors.onSecondaryContainer : colors.primary),
    background =
      disabled && (filled || tonal || surface)
        ? new Color(colors.onSurface).withOpacity(0.12)
        : new Color(
            filled
              ? colors.primary
              : tonal
                ? colors.secondaryContainer
                : surface
                  ? colors.surfaceContainerLow
                  : 0,
          ),
    opacity = states.contains(WidgetState.pressed)
      ? 0.1
      : states.contains(WidgetState.hovered)
        ? 0.08
        : states.contains(WidgetState.focused)
          ? 0.1
          : 0;
  return Object.freeze({
    foreground,
    background,
    overlay: opacity
      ? new Color(
          filled ? colors.onPrimary : tonal ? colors.onSecondaryContainer : colors.primary,
        ).withOpacity(opacity)
      : null,
  });
}
export interface MaterialButtonOptions extends Omit<
  ControlInteractionOptions,
  'selected' | 'semantics' | 'gestures' | 'onHover' | 'onFocusChange'
> {
  readonly child: Widget | null;
  readonly style?: ButtonStyle | null;
  readonly semanticsLabel?: string;
  readonly id?: string;
  readonly onHover?: ((hovered: boolean) => void) | null;
  readonly onFocusChange?: ((focused: boolean) => void) | null;
  readonly tooltip?: string | null;
  readonly clipBehavior?: Clip | null;
  readonly isSemanticButton?: boolean;
  /** @internal Source selectable-icon state. */ readonly selected?: boolean | null;
}
export abstract class ButtonStyleButton extends StatefulWidget {
  readonly options: Readonly<MaterialButtonOptions>;
  abstract get variant(): MaterialButtonVariant;
  constructor(options: MaterialButtonOptions);
  constructor(id: string, label: string, onPressed: (() => void) | undefined);
  constructor(first: MaterialButtonOptions | string, label?: string, onPressed?: () => void) {
    const options: MaterialButtonOptions =
      typeof first === 'string'
        ? {
            id: first,
            semanticsLabel: label ?? '',
            child: new Text(label ?? ''),
            onPressed: onPressed ?? null,
          }
        : first;
    super(options.key ?? null);
    if (Object.hasOwn(options, 'iconAlignment'))
      throw new TypeError(
        'Deprecated constructor iconAlignment has been removed; use ButtonStyle.iconAlignment',
      );
    this.options = Object.freeze({ ...options });
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
  get onPressed(): (() => void) | null {
    return this.options.onPressed ?? null;
  }
  get onLongPress(): NonNullable<MaterialButtonOptions['onLongPress']> | null {
    return this.options.onLongPress ?? null;
  }
  get onHover(): NonNullable<MaterialButtonOptions['onHover']> | null {
    return this.options.onHover ?? null;
  }
  get onFocusChange(): NonNullable<MaterialButtonOptions['onFocusChange']> | null {
    return this.options.onFocusChange ?? null;
  }
  get style(): ButtonStyle | null {
    return this.options.style ?? null;
  }
  get clipBehavior(): Clip | null {
    return this.options.clipBehavior ?? null;
  }
  get focusNode(): NonNullable<MaterialButtonOptions['focusNode']> | null {
    return this.options.focusNode ?? null;
  }
  get autofocus(): boolean {
    return this.options.autofocus ?? false;
  }
  get statesController(): WidgetStatesController | null {
    return this.options.statesController ?? null;
  }
  get isSemanticButton(): boolean {
    return this.options.isSemanticButton ?? true;
  }
  get tooltip(): string | null {
    return this.options.tooltip ?? null;
  }
  get child(): Widget | null {
    return this.options.child;
  }
  get enabled(): boolean {
    return (
      (this.options.enabled ?? true) &&
      (this.options.onPressed != null || this.options.onLongPress != null)
    );
  }
  static allOrNull<T extends {}>(
    type: DartTypeWitness<T>,
    value: T | null,
  ): WidgetStateProperty<T> | null {
    return value === null ? null : WidgetStateProperty.all(type, value);
  }
  static defaultColor(
    enabled: Color | null,
    disabled: Color | null,
  ): WidgetStateProperty<Color | null> | null {
    return enabled === null && disabled === null
      ? null
      : colorProperty((states) => (states.contains(WidgetState.disabled) ? disabled : enabled));
  }
  /** @dartParam fontSizeMultiplier double */
  static scaledPadding(
    geometry1x: EdgeInsetsGeometry,
    geometry2x: EdgeInsetsGeometry,
    geometry3x: EdgeInsetsGeometry,
    fontSizeMultiplier: number,
  ): EdgeInsetsGeometry {
    return fontSizeMultiplier <= 1
      ? geometry1x
      : fontSizeMultiplier < 2
        ? EdgeInsetsGeometry.lerp(geometry1x, geometry2x, fontSizeMultiplier - 1)!
        : fontSizeMultiplier < 3
          ? EdgeInsetsGeometry.lerp(geometry2x, geometry3x, fontSizeMultiplier - 2)!
          : geometry3x;
  }
  override debugFillProperties(properties: DiagnosticPropertiesBuilder): void {
    super.debugFillProperties(properties);
    properties.add(new FlagProperty('enabled', this.enabled, { ifFalse: 'disabled' }));
    properties.add(new DiagnosticsProperty('style', this.style, { defaultValue: null }));
    properties.add(new DiagnosticsProperty('focusNode', this.focusNode, { defaultValue: null }));
  }
  defaultStyleOf(context: BuildContext): ButtonStyle {
    const theme = Theme.of(context),
      variant = this.variant,
      colors = theme.colorScheme,
      scale =
        MediaQuery.textScalerOf(context).scale(theme.textTheme.labelLarge?.fontSize ?? 14) / 14;
    const scaled =
      variant === 'text'
        ? ButtonStyleButton.scaledPadding(
            EdgeInsets.symmetric({ horizontal: 12, vertical: 8 }),
            EdgeInsets.symmetric({ horizontal: 8 }),
            EdgeInsets.symmetric({ horizontal: 4 }),
            scale,
          )
        : ButtonStyleButton.scaledPadding(
            EdgeInsets.symmetric({ horizontal: 24 }),
            EdgeInsets.symmetric({ horizontal: 12 }),
            EdgeInsets.symmetric({ horizontal: 6 }),
            scale,
          );
    return new ButtonStyle({
      textStyle: textAll(theme.textTheme.labelLarge),
      foregroundColor: colorProperty(
        (states) => resolveMaterialButtonColors(colors, variant, states).foreground,
      ),
      backgroundColor: colorProperty(
        (states) => resolveMaterialButtonColors(colors, variant, states).background,
      ),
      overlayColor: colorProperty(
        (states) => resolveMaterialButtonColors(colors, variant, states).overlay,
      ),
      shadowColor: colorProperty(
        () => new Color(variant === 'text' || variant === 'outlined' ? 0 : colors.shadow),
      ),
      surfaceTintColor: colorProperty(() => new Color(0)),
      elevation: doubleProperty((states) =>
        states.contains(WidgetState.disabled)
          ? 0
          : variant === 'elevated'
            ? states.contains(WidgetState.pressed)
              ? 1
              : states.contains(WidgetState.hovered)
                ? 3
                : 1
            : variant === 'filled' || variant === 'tonal'
              ? states.contains(WidgetState.pressed)
                ? 0
                : states.contains(WidgetState.hovered)
                  ? 1
                  : 0
              : 0,
      ),
      padding: insetsAll(scaled),
      minimumSize: sizeAll(new Size(64, 40)),
      maximumSize: sizeAll(Size.infinite),
      iconSize: doubleAll(18),
      iconColor: colorProperty(
        (states) => resolveMaterialButtonColors(colors, variant, states).foreground,
      ),
      side:
        variant === 'outlined'
          ? sideProperty(
              (states) =>
                new BorderSide({
                  color: (states.contains(WidgetState.disabled)
                    ? new Color(colors.onSurface).withOpacity(0.12)
                    : new Color(
                        states.contains(WidgetState.focused) ? colors.primary : colors.outline,
                      )
                  ).toARGB32(),
                }),
            )
          : null,
      shape: shapeAll(new StadiumBorder()),
      mouseCursor: WidgetStateMouseCursor.adaptiveClickable,
      visualDensity: theme.visualDensity,
      tapTargetSize: theme.materialTapTargetSize,
      animationDuration: 200,
      enableFeedback: true,
      alignment: Alignment.center,
      splashFactory: theme.splashFactory,
    });
  }
  themeStyleOf(context: BuildContext): ButtonStyle | null {
    const variant = this.variant;
    return variant === 'filled' || variant === 'tonal'
      ? FilledButtonTheme.of(context).style
      : variant === 'text'
        ? TextButtonTheme.of(context).style
        : variant === 'outlined'
          ? OutlinedButtonTheme.of(context).style
          : ElevatedButtonTheme.of(context).style;
  }
  createState(): ButtonStyleState {
    return new ButtonStyleState();
  }
}
class ButtonStyleState extends TickerProviderStateMixin<ButtonStyleButton> {
  /** Closed adapter to the actual private InkResponseState returned by InkWell. */
  private readonly inkKey = new GlobalKey<
    State & {
      simulateTap(): void;
      simulateLongPress(): void;
    }
  >('Button ink');
  private semanticsTap = () => this.inkKey.currentState?.simulateTap();
  private semanticsLongPress = () => this.inkKey.currentState?.simulateLongPress();
  private internal: WidgetStatesController | null = null;
  private retired = false;
  private suspended = false;
  private delay: AnimationController | null = null;
  private background: Color | null = null;
  private elevation: number | null = null;
  private get controller(): WidgetStatesController {
    return this.widget.options.statesController ?? this.internal!;
  }
  private get live(): boolean {
    return this.mounted && !this.retired && !this.suspended && (this.context as Element).active;
  }
  private readonly statesChanged = () => {
    if (this.live) this.setState(() => {});
  };
  private connect(): void {
    if (!this.widget.options.statesController) this.internal = new WidgetStatesController();
    this.controller.update(WidgetState.disabled, !this.widget.enabled);
    if (Object.hasOwn(this.widget.options, 'selected'))
      this.controller.update(WidgetState.selected, this.widget.options.selected ?? false);
    this.controller.addListener(this.statesChanged);
  }
  override initState(): void {
    super.initState();
    this.connect();
  }
  override didUpdateWidget(old: ButtonStyleButton): void {
    super.didUpdateWidget(old);
    if (old.options.onPressed !== this.widget.options.onPressed)
      this.semanticsTap = () => this.inkKey.currentState?.simulateTap();
    if (old.options.onLongPress !== this.widget.options.onLongPress)
      this.semanticsLongPress = () => this.inkKey.currentState?.simulateLongPress();
    if (old.options.statesController !== this.widget.options.statesController) {
      (old.options.statesController ?? this.internal)?.removeListener(this.statesChanged);
      if (this.widget.options.statesController) {
        this.internal?.dispose();
        this.internal = null;
      }
      this.connect();
    }
    if (old.enabled !== this.widget.enabled) {
      this.controller.update(WidgetState.disabled, !this.widget.enabled);
      if (!this.widget.enabled) this.controller.update(WidgetState.pressed, false);
    }
    if (old.options.selected !== this.widget.options.selected)
      this.controller.update(WidgetState.selected, this.widget.options.selected ?? false);
  }
  override deactivate(): void {
    this.suspended = true;
    super.deactivate();
  }
  override activate(): void {
    super.activate();
    this.suspended = false;
  }
  override dispose(): void {
    this.retired = true;
    try {
      this.controller.removeListener(this.statesChanged);
      this.internal?.dispose();
      this.delay?.dispose();
    } finally {
      super.dispose();
    }
  }
  build(context: BuildContext): Widget {
    const widget = this.widget,
      o = widget.options,
      styles = [o.style ?? null, widget.themeStyleOf(context), widget.defaultStyleOf(context)],
      states = this.controller.value;
    const direct = <T extends {}>(get: (style: ButtonStyle) => T | null): T | null => {
      for (const style of styles) {
        const value = style === null ? null : get(style);
        if (value !== null) return value;
      }
      return null;
    };
    const resolve = <T extends {}>(
      get: (style: ButtonStyle) => WidgetStateProperty<T | null> | null,
    ): T | null => direct((style) => get(style)?.resolve(states) ?? null);
    const numeric = (value: DartDouble | null): number | null => {
      if (value === null) return null;
      invariant(
        DartDouble.is(value),
        'invalid-button-style-number',
        'Button numeric properties require retained DartDouble provenance',
      );
      return value.value;
    };
    const shape = resolve((s) => s.shape),
      side = resolve((s) => s.side),
      minimum = resolve((s) => s.minimumSize),
      maximum = resolve((s) => s.maximumSize),
      fixed = resolve((s) => s.fixedSize),
      density = direct((s) => s.visualDensity),
      target = direct((s) => s.tapTargetSize),
      duration = direct((s) => s.animationDuration),
      alignment = direct((s) => s.alignment),
      padding = resolve((s) => s.padding),
      elevation = numeric(resolve((s) => s.elevation));
    invariant(
      shape !== null &&
        minimum !== null &&
        maximum !== null &&
        density !== null &&
        target !== null &&
        duration !== null &&
        alignment !== null &&
        padding !== null &&
        elevation !== null,
      'missing-button-default',
      'ButtonStyleButton defaults must provide complete layout/material values',
    );
    let constraints = density.effectiveConstraints(
      new BoxConstraints(minimum.width, maximum.width, minimum.height, maximum.height),
    );
    if (fixed) {
      const size = constraints.constrain(fixed);
      constraints = constraints.copyWith({
        ...(Number.isFinite(size.width) ? { minWidth: size.width, maxWidth: size.width } : {}),
        ...(Number.isFinite(size.height) ? { minHeight: size.height, maxHeight: size.height } : {}),
      });
    }
    const adjust = density.baseSizeAdjustment,
      effectivePadding = padding
        .add(
          EdgeInsets.fromLTRB(Math.max(0, adjust.dx), adjust.dy, Math.max(0, adjust.dx), adjust.dy),
        )
        .clamp(EdgeInsets.zero, EdgeInsets.infinity);
    let background = resolve((s) => s.backgroundColor);
    if (
      duration > 0 &&
      this.elevation !== null &&
      this.background !== null &&
      this.elevation !== elevation &&
      background !== null &&
      !this.background.equals(background) &&
      this.background.a === 1 &&
      background.a < 1 &&
      elevation === 0
    ) {
      if (!this.delay || this.delay.duration !== duration) {
        this.delay?.dispose();
        this.delay = new AnimationController({ vsync: this, duration });
        this.delay.addStatusListener((status) => {
          if (status === AnimationStatus.completed && this.live) this.setState(() => {});
        });
      }
      this.delay.forward({ from: 0 });
      this.elevation = elevation;
      background = this.background;
    } else if (this.delay?.isAnimating) {
      background = this.background;
    } else {
      this.background = background;
      this.elevation = elevation;
    }
    const foreground = resolve((s) => s.foregroundColor),
      iconColor =
        styles[0]?.iconColor?.resolve(states) ??
        styles[1]?.iconColor?.resolve(states) ??
        styles[0]?.foregroundColor?.resolve(states) ??
        styles[1]?.foregroundColor?.resolve(states) ??
        styles[2]?.iconColor?.resolve(states) ??
        styles[2]?.foregroundColor?.resolve(states) ??
        null,
      iconSize = numeric(resolve((s) => s.iconSize)),
      iconTheme = IconTheme.of(context),
      border = shape.copyWith(side === null ? {} : { side });
    let child: Widget | null = o.child;
    const foregroundBuilder = direct((s) => s.foregroundBuilder);
    if (foregroundBuilder) child = foregroundBuilder(context, states, child);
    let result: Widget = new Padding(
      effectivePadding,
      new Align(child ?? undefined, { alignment, widthFactor: 1, heightFactor: 1 }),
    );
    const backgroundBuilder = direct((s) => s.backgroundBuilder);
    if (backgroundBuilder) result = backgroundBuilder(context, states, result);
    result = new IconTheme(iconTheme.copyWith({ color: iconColor, size: iconSize }), result);
    const overlay = colorProperty((next) => {
      for (const style of styles) {
        const color = style?.overlayColor?.resolve(next);
        if (color != null) return color;
      }
      return null;
    });
    result = new InkWell({
      key: this.inkKey,
      child: result,
      onTap: widget.enabled ? (o.onPressed ?? null) : null,
      onLongPress: widget.enabled ? (o.onLongPress ?? null) : null,
      ...(o.onHover ? { onHover: o.onHover } : {}),
      ...(o.onFocusChange ? { onFocusChange: o.onFocusChange } : {}),
      autofocus: o.autofocus ?? false,
      focusNode: o.focusNode ?? null,
      canRequestFocus: widget.enabled,
      statesController: this.controller,
      mouseCursor: WidgetStateMouseCursor.resolveWith((next) => {
        for (const style of styles) {
          const cursor = style?.mouseCursor?.resolve(next);
          if (cursor != null) return cursor;
        }
        return SystemMouseCursors.basic;
      }),
      overlayColor: overlay,
      highlightColor: new Color(0),
      customBorder: border,
      enableFeedback: direct((s) => s.enableFeedback) ?? true,
      splashFactory: direct((s) => s.splashFactory),
    });
    if (o.tooltip != null) result = new Tooltip({ message: o.tooltip, child: result });
    result = new Material({
      elevation,
      color: background,
      shadowColor: resolve((s) => s.shadowColor),
      surfaceTintColor: resolve((s) => s.surfaceTintColor),
      textStyle:
        resolve((s) => s.textStyle)?.copyWith({ color: foreground?.toARGB32() ?? null }) ?? null,
      shape: border,
      type: background === null ? MaterialType.transparency : MaterialType.button,
      animationDuration: duration,
      clipBehavior:
        o.clipBehavior ?? (backgroundBuilder || foregroundBuilder ? 'antiAlias' : 'none'),
      borderOnForeground: false,
      child: result,
    });
    // Include the animated physical shape and ink, so their repaint does
    // not expand every other button's recording in the enclosing section.
    return new Semantics({
      container: true,
      button: o.isSemanticButton ?? true,
      enabled: widget.enabled,
      selected: o.selected ?? null,
      label: o.semanticsLabel ?? null,
      excludeSemantics: o.semanticsLabel !== undefined,
      onTap:
        o.semanticsLabel !== undefined && widget.enabled && o.onPressed ? this.semanticsTap : null,
      onLongPress:
        o.semanticsLabel !== undefined && widget.enabled && o.onLongPress
          ? this.semanticsLongPress
          : null,
      identifier: o.id ?? null,
      transportId: o.id ?? null,
      child: new RepaintBoundary(
        new ButtonInputPadding(
          target === MaterialTapTargetSize.padded
            ? { width: 48 + adjust.dx, height: 48 + adjust.dy }
            : Size.zero,
          new ConstrainedBox(result, constraints),
        ),
      ),
    });
  }
}
