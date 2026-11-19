// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
import { Element, State, StatefulWidget } from '@nelyx/core/framework/widgets/framework';
import type { BuildContext, Widget, WidgetOptions } from '@nelyx/core/framework/widgets/framework';
import { Align, ConstrainedBox, Padding, Row, SizedBox } from '@nelyx/core/framework/widgets/basic';
import { Hero, HeroControllerScope } from '@nelyx/core/framework/widgets/heroes';
import { routeTokenOf } from '@nelyx/core/framework/widgets/navigation';
import { ConstraintsTransformBox } from '@nelyx/core/framework/widgets/overflow-box';
import { IconTheme } from '@nelyx/core/framework/widgets/icon-theme';
import { IconThemeData } from '@nelyx/core/framework/widgets/icon-theme-data';
import {
  ExcludeSemantics,
  MergeSemantics,
  Semantics,
} from '@nelyx/core/framework/widgets/semantics';
import {
  WidgetState,
  WidgetStateColor,
  WidgetStatesController,
  WidgetStateMouseCursor,
} from '@nelyx/core/framework/widgets/widget-state';
import { BoxConstraints } from '@nelyx/core/framework/rendering/constraints';
import { BorderRadius } from '@nelyx/core/framework/painting/border-radius';
import type { ShapeBorder } from '@nelyx/core/framework/painting/borders';
import { EdgeInsetsDirectional } from '@nelyx/core/framework/painting/edge-insets';
import type { EdgeInsetsGeometry } from '@nelyx/core/framework/painting/edge-insets';
import { RoundedRectangleBorder } from '@nelyx/core/framework/painting/rounded-rectangle-border';
import { TextStyle } from '@nelyx/core/framework/painting/text-style';
import type { FocusNode } from '@nelyx/core/framework/widgets/focus';
import type { MouseCursor } from '@nelyx/core/services/mouse-cursor';
import { ValueKey } from '@nelyx/core/foundation/key';
import { Color } from '@nelyx/core/ui/color';
import type { Clip } from '@nelyx/core/ui/clip';
import { FloatingActionButtonTheme } from './floating-action-button-theme.ts';
import { ButtonInputPadding } from './internal/button/input-padding.ts';
import { InkWell } from './ink-well.ts';
import { Material, MaterialType } from './material.ts';
import { Theme } from './theme.ts';
import { Tooltip } from './tooltip.ts';
import { MaterialTapTargetSize } from './theme-data.ts';

export type FloatingActionButtonHeroTag = object | string | number | boolean | bigint;

interface FloatingActionButtonCommonOptions extends WidgetOptions {
  readonly onPressed: (() => void) | null;
  readonly tooltip?: string | null;
  readonly foregroundColor?: Color | null;
  readonly backgroundColor?: Color | null;
  readonly focusColor?: Color | null;
  readonly hoverColor?: Color | null;
  readonly splashColor?: Color | null;
  readonly heroTag?: FloatingActionButtonHeroTag | null;
  readonly elevation?: number | null;
  readonly focusElevation?: number | null;
  readonly hoverElevation?: number | null;
  readonly highlightElevation?: number | null;
  readonly disabledElevation?: number | null;
  readonly mouseCursor?: MouseCursor | null;
  readonly shape?: ShapeBorder | null;
  readonly clipBehavior?: Clip;
  readonly focusNode?: FocusNode | null;
  readonly autofocus?: boolean;
  readonly materialTapTargetSize?: MaterialTapTargetSize | null;
  readonly enableFeedback?: boolean | null;
}

export interface FloatingActionButtonOptions extends FloatingActionButtonCommonOptions {
  readonly child?: Widget | null;
  readonly mini?: boolean;
  readonly isExtended?: boolean;
}

export interface FloatingActionButtonSizedOptions extends FloatingActionButtonCommonOptions {
  readonly child?: Widget | null;
}

export interface FloatingActionButtonExtendedOptions extends FloatingActionButtonCommonOptions {
  readonly icon?: Widget | null;
  readonly label: Widget;
  readonly isExtended?: boolean;
  readonly extendedIconLabelSpacing?: number | null;
  readonly extendedPadding?: EdgeInsetsGeometry | null;
  readonly extendedTextStyle?: TextStyle | null;
}

const defaultHeroTag = Object.freeze({});
const objectHeroTags = new WeakMap<object, string>();
let nextObjectTag = 0;
function heroKey(tag: FloatingActionButtonHeroTag): string {
  if (tag === defaultHeroTag) return 'FloatingActionButton:default';
  if (typeof tag === 'string') return tag;
  if (typeof tag !== 'object' && typeof tag !== 'function') {
    return `FloatingActionButton:${typeof tag}:${String(tag)}`;
  }
  let key = objectHeroTags.get(tag);
  if (key === undefined) {
    key = `FloatingActionButton:object:${++nextObjectTag}`;
    objectHeroTags.set(tag, key);
  }
  return key;
}

const dimensions = {
  regular: { width: 56, radius: 16, iconSize: 24, constraints: 'sizeConstraints' },
  small: { width: 40, radius: 12, iconSize: 24, constraints: 'smallSizeConstraints' },
  large: { width: 96, radius: 28, iconSize: 36, constraints: 'largeSizeConstraints' },
} as const;

type FabVariant = keyof typeof dimensions | 'extended';

export class FloatingActionButton extends StatefulWidget {
  readonly options: Readonly<FloatingActionButtonOptions>;
  private variant: FabVariant;
  private extension: Readonly<FloatingActionButtonExtendedOptions> | null = null;

  constructor(options: FloatingActionButtonOptions) {
    super(options.key ?? null);
    for (const elevation of [
      options.elevation,
      options.focusElevation,
      options.hoverElevation,
      options.highlightElevation,
      options.disabledElevation,
    ]) {
      if (elevation != null && (!Number.isFinite(elevation) || elevation < 0)) {
        throw new RangeError('FloatingActionButton elevations must be finite and nonnegative');
      }
    }
    this.options = Object.freeze({ ...options });
    this.variant = options.mini ? 'small' : 'regular';
  }

  static small(options: FloatingActionButtonSizedOptions): FloatingActionButton {
    return new FloatingActionButton({ ...options, mini: true, isExtended: false });
  }

  static large(options: FloatingActionButtonSizedOptions): FloatingActionButton {
    const button = new FloatingActionButton({ ...options, mini: false, isExtended: false });
    button.variant = 'large';
    return button;
  }

  static extended(options: FloatingActionButtonExtendedOptions): FloatingActionButton {
    const { icon, label, extendedPadding, extendedTextStyle, extendedIconLabelSpacing, ...common } =
      options;
    const button = new FloatingActionButton({
      ...common,
      child: icon ?? null,
      mini: false,
      isExtended: options.isExtended ?? true,
    });
    button.variant = 'extended';
    button.extension = Object.freeze({
      ...common,
      icon: icon ?? null,
      label,
      extendedPadding: extendedPadding ?? null,
      extendedTextStyle: extendedTextStyle ?? null,
      extendedIconLabelSpacing: extendedIconLabelSpacing ?? null,
    });
    return button;
  }

  get child(): Widget | null {
    return this.options.child ?? null;
  }
  get onPressed(): (() => void) | null {
    return this.options.onPressed;
  }
  get tooltip(): string | null {
    return this.options.tooltip ?? null;
  }
  get foregroundColor(): Color | null {
    return this.options.foregroundColor ?? null;
  }
  get backgroundColor(): Color | null {
    return this.options.backgroundColor ?? null;
  }
  get focusColor(): Color | null {
    return this.options.focusColor ?? null;
  }
  get hoverColor(): Color | null {
    return this.options.hoverColor ?? null;
  }
  get splashColor(): Color | null {
    return this.options.splashColor ?? null;
  }
  get heroTag(): FloatingActionButtonHeroTag | null {
    return this.options.heroTag === undefined ? defaultHeroTag : this.options.heroTag;
  }
  get elevation(): number | null {
    return this.options.elevation ?? null;
  }
  get focusElevation(): number | null {
    return this.options.focusElevation ?? null;
  }
  get hoverElevation(): number | null {
    return this.options.hoverElevation ?? null;
  }
  get highlightElevation(): number | null {
    return this.options.highlightElevation ?? null;
  }
  get disabledElevation(): number | null {
    return this.options.disabledElevation ?? null;
  }
  get mouseCursor(): MouseCursor | null {
    return this.options.mouseCursor ?? null;
  }
  get shape(): ShapeBorder | null {
    return this.options.shape ?? null;
  }
  get clipBehavior(): Clip {
    return this.options.clipBehavior ?? 'none';
  }
  get focusNode(): FocusNode | null {
    return this.options.focusNode ?? null;
  }
  get autofocus(): boolean {
    return this.options.autofocus ?? false;
  }
  get materialTapTargetSize(): MaterialTapTargetSize | null {
    return this.options.materialTapTargetSize ?? null;
  }
  get enableFeedback(): boolean | null {
    return this.options.enableFeedback ?? null;
  }
  get mini(): boolean {
    return this.variant === 'small';
  }
  get isExtended(): boolean {
    return this.options.isExtended ?? false;
  }
  get extendedIconLabelSpacing(): number | null {
    return this.extension?.extendedIconLabelSpacing ?? null;
  }
  get extendedPadding(): EdgeInsetsGeometry | null {
    return this.extension?.extendedPadding ?? null;
  }
  get extendedTextStyle(): TextStyle | null {
    return this.extension?.extendedTextStyle ?? null;
  }

  createState(): State<FloatingActionButton> {
    return new FloatingActionButtonState((button) => [
      button.variant,
      button.extension?.label ?? null,
    ]);
  }
}

class FloatingActionButtonState extends State<FloatingActionButton> {
  private readonly states = new WidgetStatesController();
  private readonly statesChanged = () => {
    if (this.mounted && this.context instanceof Element && this.context.active)
      this.setState(() => {});
  };

  constructor(
    private readonly variantOf: (
      button: FloatingActionButton,
    ) => readonly [FabVariant, Widget | null],
  ) {
    super();
  }

  override initState(): void {
    super.initState();
    this.states.update(WidgetState.disabled, this.widget.onPressed === null);
    this.states.addListener(this.statesChanged);
  }

  override didUpdateWidget(old: FloatingActionButton): void {
    super.didUpdateWidget(old);
    this.states.removeListener(this.statesChanged);
    this.states.update(WidgetState.disabled, this.widget.onPressed === null);
    if (this.widget.onPressed === null) this.states.update(WidgetState.pressed, false);
    this.states.addListener(this.statesChanged);
  }

  override dispose(): void {
    this.states.dispose();
    super.dispose();
  }

  build(context: BuildContext): Widget {
    const w = this.widget,
      theme = Theme.of(context),
      fab = FloatingActionButtonTheme.of(context),
      { colorScheme } = theme,
      [variant, label] = this.variantOf(w),
      size = variant === 'extended' ? null : dimensions[variant],
      constraints =
        size === null
          ? (fab.extendedSizeConstraints ?? BoxConstraints.tightFor(null, 56))
          : (fab[size.constraints] ?? BoxConstraints.tightFor(size.width, size.width)),
      configuredForeground =
        w.foregroundColor ?? fab.foregroundColor ?? new Color(colorScheme.onPrimaryContainer),
      background =
        w.backgroundColor ?? fab.backgroundColor ?? new Color(colorScheme.primaryContainer),
      layer = new Color(colorScheme.onPrimaryContainer),
      shape =
        w.shape ??
        fab.shape ??
        new RoundedRectangleBorder({ borderRadius: BorderRadius.circular(size?.radius ?? 16) }),
      enabled = w.onPressed !== null,
      states = this.states.value,
      foreground =
        configuredForeground instanceof WidgetStateColor
          ? configuredForeground.resolve(states)
          : configuredForeground,
      elevation = w.elevation ?? fab.elevation ?? 6,
      effectiveElevation = !enabled
        ? (w.disabledElevation ?? fab.disabledElevation ?? elevation)
        : states.contains(WidgetState.pressed)
          ? (w.highlightElevation ?? fab.highlightElevation ?? 6)
          : states.contains(WidgetState.hovered)
            ? (w.hoverElevation ?? fab.hoverElevation ?? 8)
            : states.contains(WidgetState.focused)
              ? (w.focusElevation ?? fab.focusElevation ?? 6)
              : elevation;
    const textStyle = (
      w.extendedTextStyle ??
      fab.extendedTextStyle ??
      theme.textTheme.labelLarge ??
      new TextStyle()
    ).copyWith({
      color: foreground.toARGB32(),
    });

    const child =
      size === null
        ? new ConstraintsTransformBox(
            new Padding(
              w.extendedPadding ??
                fab.extendedPadding ??
                EdgeInsetsDirectional.only({ start: w.child !== null ? 16 : 20, end: 20 }),
              new Row(
                [
                  ...(w.child === null ? [] : [w.child]),
                  ...(w.isExtended && label !== null ? [label] : []),
                ],
                {
                  mainSize: 'min',
                  spacing: w.extendedIconLabelSpacing ?? fab.extendedIconLabelSpacing ?? 8,
                },
              ),
            ),
            { constraintsTransform: ConstraintsTransformBox.unconstrained },
          )
        : w.child;
    const content = IconTheme.merge({
      data: new IconThemeData({
        color: foreground,
        size: size === null ? null : (fab.iconSize ?? size.iconSize),
      }),
      child: new Align(child ?? undefined, { widthFactor: 1, heightFactor: 1 }),
    });
    const material = (child: Widget) =>
      new Material({
        type: MaterialType.button,
        elevation: effectiveElevation,
        color: background,
        shadowColor: theme.shadowColor,
        shape,
        textStyle,
        clipBehavior: w.clipBehavior,
        child,
      });
    const padded = (child: Widget) =>
      new ButtonInputPadding(
        (w.materialTapTargetSize ?? theme.materialTapTargetSize) === MaterialTapTargetSize.padded
          ? { width: 48, height: 48 }
          : { width: 0, height: 0 },
        new ConstrainedBox(material(child), constraints),
      );
    let result: Widget = new Semantics({
      container: true,
      button: true,
      enabled,
      child: padded(
        new InkWell({
          child: content,
          onTap: w.onPressed,
          focusNode: w.focusNode,
          canRequestFocus: enabled,
          autofocus: w.autofocus,
          statesController: this.states,
          customBorder: shape,
          splashColor: w.splashColor ?? fab.splashColor ?? layer.withOpacity(0.1),
          focusColor: w.focusColor ?? fab.focusColor ?? layer.withOpacity(0.1),
          hoverColor: w.hoverColor ?? fab.hoverColor ?? layer.withOpacity(0.08),
          enableFeedback: w.enableFeedback ?? fab.enableFeedback ?? true,
          mouseCursor:
            (w.mouseCursor instanceof WidgetStateMouseCursor
              ? w.mouseCursor.resolve(states)
              : w.mouseCursor) ??
            fab.mouseCursor?.resolve(states) ??
            WidgetStateMouseCursor.adaptiveClickable.resolve(states),
        }),
      ),
    });
    if (w.tooltip !== null) result = new Tooltip({ message: w.tooltip, child: result });
    if (
      w.heroTag !== null &&
      routeTokenOf(context) !== null &&
      context.findAncestorWidgetOfExactType(HeroControllerScope)
    ) {
      const tag = heroKey(w.heroTag);
      result = new Hero({
        key: new ValueKey(tag),
        tag,
        child: result,
        flightShuttleBuilder: () => new ExcludeSemantics({ child: padded(content) }),
      });
    }
    return new MergeSemantics({ child: result });
  }
}
