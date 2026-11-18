// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Stateful M3 input decoration; rendering and editing retain their Core owners.
import {
  StatefulWidget,
  Element,
  InheritedWidget,
  Widget,
} from '@nelyx/core/framework/widgets/framework';
import type { WidgetOptions, BuildContext, State } from '@nelyx/core/framework/widgets/framework';
import { TickerProviderStateMixin } from '@nelyx/core/framework/widgets/ticker-provider';
import { AnimationController } from '@nelyx/core/framework/animation/animation-controller';
import { ValueNotifier } from '@nelyx/core/foundation/notifier';
import type { ValueListenable } from '@nelyx/core/foundation/notifier';
import { Curves } from '@nelyx/core/framework/animation/curves';
import {
  Padding,
  Text,
  SizedBox,
  ConstrainedBox,
  KeyedSubtree,
} from '@nelyx/core/framework/widgets/basic';
import { Directionality, MediaQuery } from '@nelyx/core/framework/widgets/app-data';
import { DefaultTextStyle } from '@nelyx/core/framework/widgets/default-text-style';
import { Opacity } from '@nelyx/core/framework/widgets/opacity';
import { Semantics } from '@nelyx/core/framework/widgets/semantics';
import { SemanticsProperties } from '@nelyx/core/framework/semantics/semantics';
import { AnimatedSwitcher } from '@nelyx/core/framework/widgets/animated-switcher';
import { IconTheme } from '@nelyx/core/framework/widgets/icon-theme';
import { IconThemeData } from '@nelyx/core/framework/widgets/icon-theme-data';
import {
  WidgetState,
  WidgetStateColor,
  WidgetStateBorderSide,
  WidgetStateTextStyle,
} from '@nelyx/core/framework/widgets/widget-state';
import { emptyWidgetStateSet } from '@nelyx/core/framework/widgets/widget-state';
import type { DartSet } from '@nelyx/core/foundation/dart-collections';
import { ValueKey } from '@nelyx/core/foundation/key';
import { GlobalKey } from '@nelyx/core/framework/widgets/global-key';
import { TextStyle } from '@nelyx/core/framework/painting/text-style';
import type { TextAlign } from '@nelyx/core/ui/typography';
import type { TextAlignVertical } from '@nelyx/core/framework/painting/text-align-vertical';
import { EdgeInsets, EdgeInsetsDirectional } from '@nelyx/core/framework/painting/edge-insets';
import { BorderSide, ShapeBorder } from '@nelyx/core/framework/painting/borders';
import { BoxConstraints } from '@nelyx/core/framework/rendering/constraints';
import { RenderBox } from '@nelyx/core/framework/rendering/object';
import type { RenderObject } from '@nelyx/core/framework/rendering/object';
import { Color } from '@nelyx/core/ui/color';
import { invariant } from '@nelyx/core/foundation/errors';
import { valueEquals } from '@nelyx/core/framework/painting/value-equality';
import {
  DiagnosticPropertiesBuilder,
  DiagnosticsProperty,
} from '@nelyx/core/foundation/diagnostics';
import { InputDecoration } from './input-decoration.ts';
import { InputDecorationTheme } from './input-decoration-theme.ts';
import { InputBorder, UnderlineInputBorder, OutlineInputBorder } from './input-border.ts';
import { FloatingLabelBehavior } from './floating-label-behavior.ts';
import { FloatingLabelAlignment } from './floating-label-alignment.ts';
import { floatingLabelAlignmentX } from './internal/input/floating-label-values.ts';
import { Theme } from './theme.ts';
import { DecorationLayout, DecorationBorder } from './internal/input/input-decorator-layout.ts';
import type {
  DecorationSlot,
  DecorationBorderConfiguration,
} from './internal/input/input-decorator-layout.ts';
export { InputDecoration } from './input-decoration.ts';
export type {
  InputDecorationOptions,
  CollapsedInputDecorationOptions,
} from './input-decoration.ts';

export interface InputDecoratorOptions extends WidgetOptions {
  readonly decoration: InputDecoration;
  readonly baseStyle?: TextStyle | null;
  readonly textAlign?: TextAlign | null;
  readonly textAlignVertical?: TextAlignVertical | null;
  readonly isFocused?: boolean;
  readonly isHovering?: boolean;
  /** @internal Hover input from the TextField's mounted pointer region. */
  readonly hoverListenable?: ValueListenable<boolean> | null;
  readonly expands?: boolean;
  readonly isEmpty?: boolean;
  readonly child?: Widget | null;
}
export class InputDecorator extends StatefulWidget {
  readonly decoration: InputDecoration;
  readonly baseStyle: TextStyle | null;
  readonly textAlign: TextAlign | null;
  readonly textAlignVertical: TextAlignVertical | null;
  readonly isFocused: boolean;
  private readonly initialHovering: boolean;
  readonly hoverListenable: ValueListenable<boolean> | null;
  readonly expands: boolean;
  readonly isEmpty: boolean;
  readonly child: Widget | null;
  constructor(options: InputDecoratorOptions) {
    super(options.key ?? null);
    invariant(
      options.decoration instanceof InputDecoration,
      'invalid-input-decoration',
      'InputDecorator requires canonical InputDecoration',
    );
    this.decoration = options.decoration;
    this.baseStyle = options.baseStyle ?? null;
    this.textAlign = options.textAlign ?? null;
    this.textAlignVertical = options.textAlignVertical ?? null;
    this.isFocused = options.isFocused ?? false;
    this.initialHovering = options.isHovering ?? false;
    this.hoverListenable = options.hoverListenable ?? null;
    this.expands = options.expands ?? false;
    this.isEmpty = options.isEmpty ?? false;
    this.child = options.child ?? null;
  }
  get isHovering(): boolean {
    return this.hoverListenable?.value ?? this.initialHovering;
  }
  static containerOf(context: BuildContext): RenderBox<RenderObject> | null {
    const render = context
      .maybeDependOn(DecorationScope)
      ?.borderKey.currentContext?.findRenderObject();
    return render instanceof RenderBox ? render : null;
  }
  createState(): State {
    return new InputDecoratorState();
  }
  override debugFillProperties(properties: DiagnosticPropertiesBuilder): void {
    super.debugFillProperties(properties);
    properties.add(new DiagnosticsProperty('decoration', this.decoration));
    for (const name of ['isFocused', 'isHovering', 'expands', 'isEmpty'] as const)
      properties.add(new DiagnosticsProperty(name, this[name], { defaultValue: false }));
  }
}
class DecorationScope extends InheritedWidget {
  constructor(
    readonly borderKey: GlobalKey,
    child: Widget,
  ) {
    super(child);
  }
  updateShouldNotify(old: this): boolean {
    return old.borderKey !== this.borderKey;
  }
}
interface Visual {
  readonly border: InputBorder;
  readonly fill: Color;
  readonly hover: Color;
  readonly label: TextStyle;
  readonly floating: TextStyle;
  readonly hint: TextStyle;
  readonly helper: TextStyle;
  readonly error: TextStyle;
  readonly counter: TextStyle;
  readonly prefix: TextStyle;
  readonly suffix: TextStyle;
  readonly icon: Color;
  readonly prefixIcon: Color;
  readonly suffixIcon: Color;
  readonly base: TextStyle;
}
const decorationContentFields = [
  'base',
  'label',
  'floating',
  'hint',
  'helper',
  'error',
  'counter',
  'prefix',
  'suffix',
  'icon',
  'prefixIcon',
  'suffixIcon',
] as const;
function sameBorderLayout(a: InputBorder, b: InputBorder): boolean {
  return (
    a.isOutline === b.isOutline &&
    a.borderSide.strokeOffset === b.borderSide.strokeOffset &&
    (a instanceof OutlineInputBorder ? a.gapPadding : null) ===
      (b instanceof OutlineInputBorder ? b.gapPadding : null)
  );
}
const transitionDuration = 167;
class InputDecoratorState extends TickerProviderStateMixin<InputDecorator> {
  private floating!: AnimationController;
  private border!: AnimationController;
  private hover!: AnimationController;
  private hint!: AnimationController;
  private decoration!: InputDecoration;
  private begin: Visual | null = null;
  private end: Visual | null = null;
  private readonly containerKey = new GlobalKey('InputDecorator container');
  private floatingTarget = 0;
  private hoverTarget = 0;
  private hintTarget = 0;
  private queued = false;
  private readonly stableChildren = new Map<
    string,
    { readonly values: readonly unknown[]; readonly child: Widget | null }
  >();
  private hintProperties: SemanticsProperties | null = null;
  private borderPaint: ValueNotifier<DecorationBorderConfiguration> | undefined;
  private paintDirection: 'ltr' | 'rtl' = 'ltr';
  private layoutBorder: InputBorder | null = null;
  /** Animation ticks reuse unchanged content instead of reconfiguring text,
   * editor and semantic owners for a background/border color change. */
  private stableChild(
    key: string,
    values: readonly unknown[],
    create: () => Widget | null,
  ): Widget | null {
    const previous = this.stableChildren.get(key);
    if (
      previous &&
      previous.values.length === values.length &&
      values.every((value, index) =>
        value instanceof Widget || previous.values[index] instanceof Widget
          ? value === previous.values[index]
          : valueEquals(value, previous.values[index]),
      )
    )
      return previous.child;
    const child = create();
    this.stableChildren.set(key, { values: Object.freeze([...values]), child });
    return child;
  }
  private readonly animationChanged = () => {
    if (!this.mounted || !(this.context instanceof Element) || !this.context.active) return;
    if (this.context.owner.building) {
      if (!this.queued) {
        this.queued = true;
        this.context.owner.postFrame(() => {
          this.queued = false;
          if (this.mounted && this.context instanceof Element && this.context.active)
            this.setState(() => {});
        });
      }
    } else this.setState(() => {});
  };
  private updateBorderPaint(): void {
    if (
      !this.borderPaint ||
      !this.end ||
      !this.mounted ||
      !(this.context instanceof Element) ||
      !this.context.active
    )
      return;
    const v = this.visual(),
      fill = Color.alphaBlend(
        v.hover.withValues({ alpha: v.hover.a * this.hover.value }),
        v.fill,
      ).toARGB32(),
      progress = Curves.fastOutSlowIn.transform(this.floating.value),
      current = this.borderPaint.value;
    if (
      current.fill === fill &&
      current.direction === this.paintDirection &&
      current.progress === progress &&
      valueEquals(current.border, v.border)
    )
      return;
    this.borderPaint.value = Object.freeze({
      border: v.border,
      fill,
      direction: this.paintDirection,
      progress,
    });
  }
  private readonly borderChanged = () => {
    this.updateBorderPaint();
    if (!this.begin || !this.end) return;
    const border = this.visual().border,
      layout = this.layoutBorder;
    // Stroke offset and outline gap also position the floating label.
    const layoutChanged = layout !== null && !sameBorderLayout(layout, border);
    if (
      layoutChanged ||
      !this.begin.label.equals(this.end.label) ||
      !this.begin.floating.equals(this.end.floating)
    )
      this.animationChanged();
  };
  private readonly hoverChanged = () => this.updateBorderPaint();
  private readonly hoverInputChanged = () => {
    if (!this.end || !this.mounted || !(this.context as Element).active) return;
    const previous = this.end,
      next = this.resolve();
    this.updateVisualTarget(next);
    this.syncHover(false);
    if (
      !sameBorderLayout(previous.border, next.border) ||
      decorationContentFields.some((field) => !valueEquals(previous[field], next[field]))
    )
      this.animationChanged();
    else this.updateBorderPaint();
  };
  private readonly floatingChanged = () => {
    this.updateBorderPaint();
    this.animationChanged();
  };
  override initState(): void {
    super.initState();
    this.floating = new AnimationController({ vsync: this, duration: transitionDuration });
    this.border = new AnimationController({ vsync: this, duration: transitionDuration, value: 1 });
    this.hover = new AnimationController({ vsync: this, duration: 15 });
    this.hint = new AnimationController({ vsync: this, duration: 20 });
    this.floating.addListener(this.floatingChanged);
    this.border.addListener(this.borderChanged);
    this.hover.addListener(this.hoverChanged);
    this.hint.addListener(this.animationChanged);
    this.widget.hoverListenable?.addListener(this.hoverInputChanged);
  }
  private states(): DartSet<WidgetState> {
    const states = emptyWidgetStateSet();
    if (!this.decoration.enabled) states.add(WidgetState.disabled);
    if (this.widget.isFocused) states.add(WidgetState.focused);
    if (this.widget.isHovering) states.add(WidgetState.hovered);
    if (this.decoration.error !== null || this.decoration.errorText !== null)
      states.add(WidgetState.error);
    return states;
  }
  private hasLabel(): boolean {
    return this.decoration.label !== null || this.decoration.labelText !== null;
  }
  private withdrawn(): boolean {
    return !this.widget.isEmpty || (this.widget.isFocused && this.decoration.enabled);
  }
  private shouldFloat(): boolean {
    const behavior = this.decoration.floatingLabelBehavior ?? FloatingLabelBehavior.auto;
    return (
      this.hasLabel() &&
      behavior !== FloatingLabelBehavior.never &&
      (behavior === FloatingLabelBehavior.always || this.withdrawn())
    );
  }
  private hintVisible(): boolean {
    return (
      this.widget.isEmpty &&
      (!this.hasLabel() ||
        this.withdrawn() ||
        this.decoration.floatingLabelBehavior === FloatingLabelBehavior.always)
    );
  }
  private resolve(): Visual {
    const theme = Theme.of(this.context),
      d = this.decoration,
      states = this.states(),
      colors = theme.colorScheme,
      disabled = !d.enabled,
      focused = this.widget.isFocused,
      error = states.contains(WidgetState.error),
      hovered = this.widget.isHovering;
    const color = (value: Color | null, fallback: Color) =>
      value instanceof WidgetStateColor ? value.resolve(states) : (value ?? fallback);
    const style = (value: TextStyle | null) =>
      value instanceof WidgetStateTextStyle ? value.resolve(states) : value;
    const side = (value: BorderSide | null) =>
      value instanceof WidgetStateBorderSide ? value.resolve(states) : value;
    const surface = new Color(colors.onSurface),
      variant = new Color(colors.onSurfaceVariant),
      errorColor = new Color(colors.error),
      primary = new Color(colors.primary);
    const labelColor = disabled
      ? surface.withOpacity(0.38)
      : error
        ? errorColor
        : focused
          ? primary
          : variant;
    const base = (theme.textTheme.bodyLarge ?? new TextStyle({ fontSize: 16 })).merge(
      this.widget.baseStyle,
    );
    const labelBase = base.copyWith({ color: labelColor.toARGB32() });
    const helperBase = (theme.textTheme.bodySmall ?? new TextStyle({ fontSize: 12 })).copyWith({
      color: variant.toARGB32(),
    });
    const selected = !d.enabled
      ? d.disabledBorder
      : focused
        ? error
          ? d.focusedErrorBorder
          : d.focusedBorder
        : error
          ? d.errorBorder
          : d.enabledBorder;
    let border = selected ?? d.border ?? new UnderlineInputBorder();
    if (selected === null && border !== InputBorder.none) {
      const sourceSide = side(
        border.isOutline
          ? InputDecorationTheme.of(this.context).outlineBorder
          : InputDecorationTheme.of(this.context).activeIndicatorBorder,
      );
      const borderColor = disabled
        ? surface.withOpacity(border.isOutline ? 0.12 : 0.38)
        : error
          ? focused
            ? errorColor
            : hovered
              ? new Color(colors.onErrorContainer)
              : errorColor
          : focused
            ? primary
            : hovered
              ? surface
              : border.isOutline
                ? new Color(colors.outline)
                : variant;
      border = border.copyWith({
        borderSide:
          sourceSide ??
          new BorderSide({ color: borderColor.toARGB32(), width: focused && !disabled ? 2 : 1 }),
      });
    }
    return {
      border,
      base,
      fill: d.filled
        ? color(
            d.fillColor,
            disabled ? surface.withOpacity(0.04) : new Color(colors.surfaceContainerHighest),
          )
        : new Color(0),
      hover: d.filled && !disabled ? color(d.hoverColor, theme.hoverColor) : new Color(0),
      label: labelBase.merge(style(d.labelStyle)),
      floating: labelBase.merge(style(d.floatingLabelStyle ?? d.labelStyle)),
      hint: base
        .copyWith({ color: (disabled ? surface.withOpacity(0.38) : variant).toARGB32() })
        .merge(style(d.hintStyle)),
      helper: helperBase.merge(style(d.helperStyle)),
      error: helperBase.copyWith({ color: errorColor.toARGB32() }).merge(style(d.errorStyle)),
      counter: helperBase.merge(style(d.counterStyle)),
      prefix: base.merge(style(d.prefixStyle)),
      suffix: base.merge(style(d.suffixStyle)),
      icon: color(d.iconColor, variant),
      prefixIcon: color(d.prefixIconColor, disabled ? surface.withOpacity(0.38) : variant),
      suffixIcon: color(
        d.suffixIconColor,
        disabled
          ? surface.withOpacity(0.38)
          : error
            ? hovered
              ? new Color(colors.onErrorContainer)
              : errorColor
            : variant,
      ),
    };
  }
  private visual(): Visual {
    invariant(
      this.end,
      'missing-input-decoration-visual',
      'InputDecorator must resolve dependencies before building',
    );
    if (!this.begin || this.border.value === 1) return this.end;
    const t = Curves.fastOutSlowIn.transform(this.border.value),
      border = ShapeBorder.lerp(this.begin.border, this.end.border, t);
    invariant(
      border instanceof InputBorder,
      'invalid-input-border-interpolation',
      'Input border interpolation must retain its canonical owner',
    );
    return {
      ...this.end,
      border,
      fill: Color.lerp(this.begin.fill, this.end.fill, t)!,
      label: TextStyle.lerp(this.begin.label, this.end.label, t)!,
      floating: TextStyle.lerp(this.begin.floating, this.end.floating, t)!,
    };
  }
  private updateVisualTarget(next: Visual): void {
    const previousTarget = this.end;
    if (previousTarget === null) {
      this.end = next;
      this.begin = next;
    } else {
      if (
        !valueEquals(previousTarget.border, next.border) ||
        !previousTarget.fill.equals(next.fill) ||
        !previousTarget.label.equals(next.label) ||
        !previousTarget.floating.equals(next.floating)
      ) {
        this.begin = this.visual();
        this.end = next;
        this.border.value = 0;
        this.border.forward();
      } else this.end = next;
    }
  }
  private syncHover(initial: boolean): void {
    const target = this.widget.isHovering ? 1 : 0;
    if (initial) this.hover.value = target;
    else if (this.hoverTarget !== target) this.hover.animateTo(target, { duration: 15 });
    this.hoverTarget = target;
  }
  private sync(): void {
    this.decoration = this.widget.decoration.applyDefaults(InputDecorationTheme.of(this.context));
    const initial = this.end === null;
    this.updateVisualTarget(this.resolve());
    this.syncHover(initial);
    for (const [controller, value, duration, target] of [
      [this.floating, this.shouldFloat() ? 1 : 0, transitionDuration, 'floatingTarget'],
      [this.hint, this.hintVisible() ? 1 : 0, this.decoration.hintFadeDuration ?? 20, 'hintTarget'],
    ] as const) {
      if (initial) {
        this[target] = value;
        controller.value = value;
      } else if (this[target] !== value) {
        this[target] = value;
        controller.animateTo(value, { duration });
      }
    }
  }
  override didChangeDependencies(): void {
    super.didChangeDependencies();
    this.sync();
  }
  override didUpdateWidget(old: InputDecorator): void {
    super.didUpdateWidget(old);
    if (old.hoverListenable !== this.widget.hoverListenable) {
      old.hoverListenable?.removeListener(this.hoverInputChanged);
      this.widget.hoverListenable?.addListener(this.hoverInputChanged);
    }
    this.sync();
  }
  override dispose(): void {
    this.widget.hoverListenable?.removeListener(this.hoverInputChanged);
    try {
      for (const controller of [this.floating, this.border, this.hover, this.hint])
        controller.dispose();
    } finally {
      this.borderPaint?.dispose();
      this.borderPaint = undefined;
      this.stableChildren.clear();
      this.hintProperties = null;
      this.layoutBorder = null;
      super.dispose();
    }
  }
  build(context: BuildContext): Widget {
    const d = this.decoration,
      v = this.visual(),
      direction = Directionality.of(context),
      theme = Theme.of(context),
      progress = Curves.fastOutSlowIn.transform(this.floating.value),
      border = v.border,
      outline = border.isOutline,
      collapsed = d.isCollapsed ?? false,
      dense = d.isDense ?? false;
    const padding =
      d.contentPadding ??
      (collapsed
        ? EdgeInsets.zero
        : outline
          ? new EdgeInsets(12, dense ? 16 : 20, 12, dense ? 8 : 12)
          : new EdgeInsets(d.filled ? 12 : 0, dense ? 4 : 8, d.filled ? 12 : 0, dense ? 4 : 8));
    const slots = new Map<DecorationSlot, Widget>();
    const fill = Color.alphaBlend(
      v.hover.withValues({ alpha: v.hover.a * this.hover.value }),
      v.fill,
    );
    this.paintDirection = direction;
    this.layoutBorder = border;
    const paint = Object.freeze({ border, fill: fill.toARGB32(), direction, progress });
    if (this.borderPaint) this.borderPaint.value = paint;
    else this.borderPaint = new ValueNotifier(paint);
    slots.set('container', new DecorationBorder(paint, this.containerKey, this.borderPaint));
    if (d.icon)
      slots.set(
        'icon',
        this.stableChild(
          'icon',
          [d.icon, v.icon],
          () =>
            new Padding(
              EdgeInsetsDirectional.only({ end: 16 }),
              IconTheme.merge({
                data: new IconThemeData({ color: v.icon, size: 24 }),
                child: d.icon!,
              }),
            ),
        )!,
      );
    const putOpacity = (slot: DecorationSlot, child: Widget | null, opacity: number): void => {
      if (child)
        slots.set(
          slot,
          this.stableChild(
            'opacity:' + slot,
            [child, opacity],
            () => new Opacity(child, { opacity }),
          )!,
        );
    };
    const withStyle = (
      slot: DecorationSlot,
      child: Widget | null,
      text: string | null,
      style: TextStyle,
      maxLines: number | null = null,
      textDirection: 'ltr' | 'rtl' = direction,
    ): Widget | null =>
      this.stableChild(
        'text:' + slot,
        [child, text, style, maxLines, textDirection, this.widget.textAlign],
        () =>
          child === null && text === null
            ? null
            : new DefaultTextStyle(
                style,
                child ??
                  new Text(text!, {
                    style,
                    ...(maxLines === null ? {} : { maxLines }),
                    direction: textDirection,
                  }),
                {
                  ...(this.widget.textAlign === null ? {} : { textAlign: this.widget.textAlign }),
                  maxLines,
                },
              ),
      );
    const label = withStyle(
      'label',
      d.label,
      d.labelText,
      TextStyle.lerp(v.label, v.floating, progress)!,
    );
    const inlineHidden =
      d.floatingLabelBehavior === FloatingLabelBehavior.never && this.withdrawn();
    putOpacity('label', label, inlineHidden ? 0 : 1);
    const hint = withStyle(
      'hint',
      d.hint,
      d.hintText,
      v.hint,
      d.hintMaxLines,
      d.hintTextDirection ?? direction,
    );
    putOpacity('hint', hint, this.hint.value);
    const prefix = withStyle('prefix', d.prefix, d.prefixText, v.prefix),
      suffix = withStyle('suffix', d.suffix, d.suffixText, v.suffix),
      affixOpacity = !this.hasLabel() || this.withdrawn() ? 1 : 0;
    putOpacity('prefix', prefix, affixOpacity);
    putOpacity('suffix', suffix, affixOpacity);
    for (const [slot, child, constraints, color] of [
      ['prefixIcon', d.prefixIcon, d.prefixIconConstraints, v.prefixIcon],
      ['suffixIcon', d.suffixIcon, d.suffixIconConstraints, v.suffixIcon],
    ] as const) {
      const icon = this.stableChild(slot, [child, constraints, color], () =>
        child
          ? new ConstrainedBox(
              IconTheme.merge({ data: new IconThemeData({ color, size: 24 }), child }),
              constraints ?? new BoxConstraints(48, Infinity, 48, Infinity),
            )
          : null,
      );
      if (icon) slots.set(slot, icon);
    }
    slots.set(
      'input',
      this.stableChild(
        'input',
        [v.base, this.widget.child, this.widget.textAlign],
        () =>
          new DefaultTextStyle(v.base, this.widget.child ?? SizedBox.shrink(), {
            ...(!(this.widget.textAlign === null) && { textAlign: this.widget.textAlign }),
          }),
      )!,
    );
    const error = d.error !== null || d.errorText !== null,
      helper = error
        ? withStyle('helperError', d.error, d.errorText, v.error, d.errorMaxLines)
        : withStyle('helperError', d.helper, d.helperText, v.helper, d.helperMaxLines);
    const helperChild = this.stableChild('helper:wrapper', [helper, error], () =>
      helper
        ? new KeyedSubtree({
            key: new ValueKey(error ? 'error' : 'helper'),
            child: new Semantics({ liveRegion: error, child: helper }),
          })
        : null,
    );
    slots.set(
      'helperError',
      this.stableChild(
        'helper:switcher',
        [helperChild],
        () => new AnimatedSwitcher({ duration: transitionDuration, child: helperChild }),
      )!,
    );
    const counter = withStyle(
      'counter',
      d.counter,
      d.counterText === '' ? null : d.counterText,
      v.counter,
    );
    const counterChild = this.stableChild('counter:wrapper', [counter, d.semanticCounterText], () =>
      counter
        ? d.semanticCounterText === null
          ? counter
          : new Semantics({ label: d.semanticCounterText, excludeSemantics: true, child: counter })
        : null,
    );
    if (counterChild) slots.set('counter', counterChild);
    const density = (d.visualDensity ?? theme.visualDensity).baseSizeAdjustment;
    const properties =
      this.hintProperties?.hint === d.errorText
        ? this.hintProperties
        : (this.hintProperties = new SemanticsProperties({ hint: d.errorText }));
    let result: Widget = Semantics.fromProperties({
      properties,
      child: new DecorationLayout(slots, {
        padding: padding.resolve(direction),
        direction,
        baseline: v.base.textBaseline ?? 'alphabetic',
        floatingLabelHeight: MediaQuery.textScalerOf(context).scale(
          4 + 0.75 * (v.label.fontSize ?? 16),
        ),
        labelProgress: progress,
        labelAlignment: floatingLabelAlignmentX(
          d.floatingLabelAlignment ?? FloatingLabelAlignment.start,
        ),
        outline,
        borderStrokeOffset: border.borderSide.strokeOffset,
        hasLabel: label !== null,
        isEmpty: this.widget.isEmpty,
        isCollapsed: collapsed,
        isDense: dense,
        maintainHintSize: d.maintainHintSize,
        maintainLabelSize: d.maintainLabelSize,
        labelVisible: !inlineHidden,
        alignLabelWithHint: d.alignLabelWithHint ?? false,
        density: { width: density.dx, height: density.dy },
        inputGap:
          border instanceof OutlineInputBorder ? border.gapPadding : outline || d.filled ? 4 : 0,
        expands: this.widget.expands,
        vertical: this.widget.textAlignVertical,
      }),
    });
    if (d.constraints) result = new ConstrainedBox(result, d.constraints);
    return new DecorationScope(this.containerKey, result);
  }
}
