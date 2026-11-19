// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Flutter: packages/flutter/lib/src/material/dropdown.dart
// Revision: 71e4717a61786faab4c7aa39825989305ed29e8a
import { invariant } from '@nelyx/core/foundation/errors';
import { AlignmentDirectional } from '@nelyx/core/framework/painting/alignment';
import type { AlignmentGeometry } from '@nelyx/core/framework/painting/alignment';
import type { BorderRadius } from '@nelyx/core/framework/painting/border-radius';
import { Border } from '@nelyx/core/framework/painting/box-border';
import { BoxDecoration } from '@nelyx/core/framework/painting/box-decoration';
import { BorderSide } from '@nelyx/core/framework/painting/borders';
import { EdgeInsets, EdgeInsetsDirectional } from '@nelyx/core/framework/painting/edge-insets';
import type { EdgeInsetsGeometry } from '@nelyx/core/framework/painting/edge-insets';
import { TextStyle } from '@nelyx/core/framework/painting/text-style';
import { valueEquals } from '@nelyx/core/framework/painting/value-equality';
import { BoxConstraints } from '@nelyx/core/framework/rendering/constraints';
import { RenderBox } from '@nelyx/core/framework/rendering/object';
import { HitTestBehavior } from '@nelyx/core/framework/rendering/pointer-listener';
import {
  Actions,
  ActivateIntent,
  ButtonActivateIntent,
  CallbackAction,
} from '@nelyx/core/framework/widgets/actions';
import type { ActionHandle, Intent } from '@nelyx/core/framework/widgets/actions';
import { Directionality, MediaQuery } from '@nelyx/core/framework/widgets/app-data';
import {
  Align,
  Column,
  ConstrainedBox,
  DecoratedBox,
  Expanded,
  Padding,
  Positioned,
  Row,
  SizedBox,
  Stack,
  Text,
} from '@nelyx/core/framework/widgets/basic';
import { DefaultTextStyle } from '@nelyx/core/framework/widgets/default-text-style';
import { FocusNode } from '@nelyx/core/framework/widgets/focus';
import { Focus } from '@nelyx/core/framework/widgets/focus-scope';
import { FormField, FormFieldState } from '@nelyx/core/framework/widgets/form';
import type { AutovalidateMode } from '@nelyx/core/framework/widgets/form';
import {
  Element,
  InheritedWidget,
  State,
  StatefulWidget,
  StatelessWidget,
} from '@nelyx/core/framework/widgets/framework';
import type { BuildContext, Widget, WidgetOptions } from '@nelyx/core/framework/widgets/framework';
import { GestureDetector } from '@nelyx/core/framework/widgets/gesture-detector';
import { Icon } from '@nelyx/core/framework/widgets/icon';
import { IconTheme } from '@nelyx/core/framework/widgets/icon-theme';
import { IconThemeData } from '@nelyx/core/framework/widgets/icon-theme-data';
import { IndexedStack } from '@nelyx/core/framework/widgets/indexed-stack';
import { InheritedTheme } from '@nelyx/core/framework/widgets/inherited-theme';
import { MouseRegion } from '@nelyx/core/framework/widgets/mouse-region';
import { Navigator } from '@nelyx/core/framework/widgets/navigation';
import { IgnorePointer } from '@nelyx/core/framework/widgets/pointer-blocking';
import { Semantics } from '@nelyx/core/framework/widgets/semantics';
import {
  WidgetState,
  WidgetStateMouseCursor,
  emptyWidgetStateSet,
} from '@nelyx/core/framework/widgets/widget-state';
import type { WidgetStateProperty } from '@nelyx/core/framework/widgets/widget-state';
import type { MouseCursor } from '@nelyx/core/services/mouse-cursor';
import type { Color } from '@nelyx/core/ui/color';
import { ButtonTheme } from './button-theme.ts';
import { Colors } from './colors.ts';
import { kMinInteractiveDimension } from './constants.ts';
import { Icons } from './icons.ts';
import { InkWell } from './ink-well.ts';
import { InputDecoration } from './input-decoration.ts';
import { InputDecorationTheme } from './input-decoration-theme.ts';
import { InputDecorator } from './input-decorator.ts';
import { DropdownRoute } from './internal/dropdown-route.ts';
import { MaterialLocalizations } from './material-localizations.ts';
import { Theme } from './theme.ts';

const itemConstraints = new BoxConstraints(0, Infinity, kMinInteractiveDimension);
const denseButtonHeight = 24;
const alignedButtonPadding = EdgeInsetsDirectional.only({ start: 16, end: 4 });
const unalignedButtonPadding = EdgeInsets.zero;
const alignedMenuMargin = EdgeInsets.zero;
const unalignedMenuMargin = EdgeInsetsDirectional.only({ start: 16, end: 24 });
const underlineDecoration = new BoxDecoration({
  border: new Border({ bottom: new BorderSide({ color: 0xffbdbdbd, width: 0 }) }),
});

export type DropdownButtonBuilder = (context: BuildContext) => readonly Widget[];

class DropdownMenuItemContainer extends StatelessWidget {
  constructor(
    readonly child: Widget,
    readonly alignment: AlignmentGeometry,
    options: WidgetOptions = {},
  ) {
    super(options.key ?? null);
  }
  override build(): Widget {
    return new Semantics({
      button: true,
      child: new ConstrainedBox(
        new Align(this.child, { alignment: this.alignment }),
        itemConstraints,
      ),
    });
  }
}

export interface DropdownMenuItemOptions<T> extends WidgetOptions {
  readonly child: Widget;
  readonly alignment?: AlignmentGeometry;
  readonly enabled?: boolean;
  readonly onTap?: (() => void) | null;
  readonly value?: T | null;
}

export class DropdownMenuItem<T> extends DropdownMenuItemContainer {
  readonly value: T | null;
  readonly enabled: boolean;
  readonly onTap: (() => void) | null;
  constructor(options: DropdownMenuItemOptions<T>) {
    super(options.child, options.alignment ?? AlignmentDirectional.centerStart, options);
    this.value = options.value ?? null;
    this.enabled = options.enabled ?? true;
    this.onTap = options.onTap ?? null;
  }
}

export interface DropdownButtonHideUnderlineOptions extends WidgetOptions {
  readonly child: Widget;
}

export class DropdownButtonHideUnderline extends InheritedWidget {
  constructor({ child, key = null }: DropdownButtonHideUnderlineOptions) {
    super(child, key);
  }
  static at(context: BuildContext): boolean {
    return context.maybeDependOn(DropdownButtonHideUnderline) !== undefined;
  }
  override updateShouldNotify(): boolean {
    return false;
  }
}

export interface DropdownButtonOptions<T> extends WidgetOptions {
  readonly items: readonly DropdownMenuItem<T>[] | null;
  readonly onChanged: ((value: T | null) => void) | null;
  readonly value?: T | null;
  readonly hint?: Widget | null;
  readonly disabledHint?: Widget | null;
  readonly selectedItemBuilder?: DropdownButtonBuilder | null;
  readonly onTap?: (() => void) | null;
  readonly elevation?: number;
  readonly style?: TextStyle | null;
  readonly underline?: Widget | null;
  readonly icon?: Widget | null;
  readonly iconDisabledColor?: Color | null;
  readonly iconEnabledColor?: Color | null;
  readonly iconSize?: number;
  readonly isDense?: boolean;
  readonly isExpanded?: boolean;
  readonly itemHeight?: number | null;
  readonly menuWidth?: number | null;
  readonly focusColor?: Color | null;
  readonly focusNode?: FocusNode | null;
  readonly autofocus?: boolean;
  readonly dropdownColor?: Color | null;
  readonly menuMaxHeight?: number | null;
  readonly enableFeedback?: boolean | null;
  readonly alignment?: AlignmentGeometry;
  readonly borderRadius?: BorderRadius | null;
  readonly padding?: EdgeInsetsGeometry | null;
  readonly barrierDismissible?: boolean;
  readonly mouseCursor?: MouseCursor | WidgetStateProperty<MouseCursor> | null;
  readonly dropdownMenuItemMouseCursor?: MouseCursor | null;
}

function validateButton<T>(
  items: readonly DropdownMenuItem<T>[] | null,
  value: T | null,
  height: number | null,
): void {
  invariant(
    value === null ||
      !items?.length ||
      items.filter((item) => valueEquals(item.value, value)).length === 1,
    'invalid-dropdown-selection',
    'Dropdown selection must correspond to exactly one item',
  );
  invariant(
    height === null || (Number.isFinite(height) && height >= kMinInteractiveDimension),
    'invalid-dropdown-item-height',
    'Dropdown items require a nullable height or at least 48 logical pixels',
  );
}

export class DropdownButton<T> extends StatefulWidget {
  readonly itemHeight: number | null;
  constructor(readonly options: DropdownButtonOptions<T>) {
    super(options.key ?? null);
    this.itemHeight =
      options.itemHeight === undefined ? kMinInteractiveDimension : options.itemHeight;
    validateButton(options.items, options.value ?? null, this.itemHeight);
  }
  get items(): readonly DropdownMenuItem<T>[] | null {
    return this.options.items;
  }
  get value(): T | null {
    return this.options.value ?? null;
  }
  get onChanged(): DropdownButtonOptions<T>['onChanged'] {
    return this.options.onChanged;
  }
  override createState(): State<DropdownButton<T>> {
    return new DropdownButtonState();
  }
}

class FormDropdownButton<T> extends DropdownButton<T> {
  constructor(
    options: DropdownButtonOptions<T>,
    readonly decoration: InputDecoration,
    readonly isEmpty: boolean,
  ) {
    super(options);
  }
}

class DropdownButtonState<T> extends State<DropdownButton<T>> {
  private readonly ownFocus = new FocusNode({ debugLabel: 'Dropdown button' });
  private route: DropdownRoute<T> | null = null;
  private hovering = false;
  private get focus(): FocusNode {
    return this.widget.options.focusNode ?? this.ownFocus;
  }
  private get enabled(): boolean {
    return Boolean(this.widget.items?.length && this.widget.onChanged);
  }
  private get selectedIndex(): number | null {
    const value = this.widget.value;
    const index =
      this.widget.items?.findIndex(
        (item) => valueEquals(item.value, value) && (value !== null || item.enabled),
      ) ?? -1;
    return index >= 0 ? index : null;
  }
  private readonly onFocusChange = (): void => {
    if (!(this.widget instanceof FormDropdownButton)) return;
    const context = this.context;
    if (this.mounted && context instanceof Element && context.active) {
      if (context.owner.building) {
        context.owner.postFrame(() => {
          if (this.mounted && context.active) this.setState(() => {});
        });
      } else this.setState(() => {});
    }
  };
  private setHovering(value: boolean): void {
    if (this.hovering !== value && this.mounted)
      this.setState(() => {
        this.hovering = value;
      });
  }

  override initState(): void {
    super.initState();
    this.focus.addListener(this.onFocusChange);
  }
  override didUpdateWidget(old: DropdownButton<T>): void {
    super.didUpdateWidget(old);
    const oldFocus = old.options.focusNode ?? this.ownFocus;
    if (oldFocus !== this.focus) {
      oldFocus.removeListener(this.onFocusChange);
      this.focus.addListener(this.onFocusChange);
    }
    if (!this.enabled) this.route?.dismiss();
  }
  override dispose(): void {
    this.route?.dismiss();
    this.focus.removeListener(this.onFocusChange);
    this.ownFocus.dispose();
    super.dispose();
  }

  private readonly open = (): void => {
    if (!this.mounted || this.route || !this.enabled) return;
    const context = this.context;
    if (context instanceof Element && !context.active) return;
    const anchor = context.findRenderObject();
    if (!(anchor instanceof RenderBox) || !anchor.attached || !anchor.hasSize) return;
    const options = this.widget.options;
    const theme = Theme.of(context);
    const margin = ButtonTheme.of(context).alignedDropdown
      ? alignedMenuMargin
      : unalignedMenuMargin;
    const navigator = Navigator.of(context);
    const route = new DropdownRoute({
      navigator,
      anchor,
      margin: margin.resolve(Directionality.of(context)),
      items: [...options.items!],
      selectedIndex: this.selectedIndex ?? 0,
      itemHeight: this.widget.itemHeight,
      menuWidth: options.menuWidth ?? null,
      menuMaxHeight: options.menuMaxHeight ?? null,
      elevation: options.elevation ?? 8,
      color: options.dropdownColor ?? null,
      theme: InheritedTheme.capture(context),
      textStyle: options.style ?? theme.textTheme.titleMedium ?? new TextStyle(),
      borderRadius: options.borderRadius ?? null,
      barrierDismissible: options.barrierDismissible ?? true,
      barrierLabel: MaterialLocalizations.of(context).modalBarrierDismissLabel,
      enableFeedback: options.enableFeedback ?? true,
      mouseCursor: options.dropdownMenuItemMouseCursor ?? null,
    });
    this.focus.requestFocus();
    this.setState(() => {
      this.route = route;
    });
    let result: Promise<import('./internal/dropdown-route.ts').DropdownRouteResult<T> | undefined>;
    try {
      result = navigator.push(route);
    } catch (error) {
      this.setState(() => {
        this.route = null;
      });
      throw error;
    }
    void result.then(
      (result) => {
        if (
          !this.mounted ||
          this.route !== route ||
          (context instanceof Element && !context.active)
        )
          return;
        this.setState(() => {
          this.route = null;
        });
        if (result !== undefined) this.widget.onChanged?.(result.result);
      },
      (error: unknown) => {
        if (
          this.mounted &&
          this.route === route &&
          (!(context instanceof Element) || context.active)
        )
          this.setState(() => {
            this.route = null;
          });
        context.services.reportError?.(error);
      },
    );
    options.onTap?.();
  };

  private decorate(
    child: Widget,
    icon: Widget,
    field: FormDropdownButton<T>,
    cursor: MouseCursor,
  ): Widget {
    const options = field.options;
    const { decoration, isEmpty } = field;
    const iconSize = options.iconSize ?? 24;
    const iconMargin = decoration.filled || decoration.border?.isOutline ? 12 : 0;
    const focusColor = this.focus.hasPrimaryFocus
      ? (options.focusColor ?? decoration.focusColor)
      : null;
    const effective = decoration.copyWith({
      suffixIcon: new Padding(EdgeInsetsDirectional.only({ end: iconMargin }), icon),
      suffixIconConstraints: new BoxConstraints(iconSize + iconMargin, Infinity, iconSize),
      ...(focusColor ? { fillColor: focusColor } : {}),
    });
    return new Focus(
      new MouseRegion(
        new GestureDetector(
          new InputDecorator({
            decoration: effective,
            isEmpty,
            child,
            isFocused: this.focus.hasPrimaryFocus,
            isHovering: this.hovering,
          }),
          {
            onTap: this.enabled ? this.open : null,
            behavior: HitTestBehavior.opaque,
            excludeFromSemantics: true,
          },
        ),
        {
          cursor,
          onEnter: () => this.setHovering(true),
          onExit: () => this.setHovering(false),
        },
      ),
      {
        focusNode: this.focus,
        includeSemantics: false,
        canRequestFocus: this.enabled,
        autofocus: options.autofocus ?? false,
      },
    );
  }

  override build(context: BuildContext): Widget {
    const options = this.widget.options;
    const theme = Theme.of(context);
    const enabled = this.enabled;
    const alignment = options.alignment ?? AlignmentDirectional.centerStart;
    const style = options.style ?? theme.textTheme.titleMedium ?? new TextStyle();
    const itemHeight = this.widget.itemHeight;
    const field = this.widget instanceof FormDropdownButton ? this.widget : null;
    const selection = this.selectedIndex;
    const supplied = options.selectedItemBuilder?.(context);
    invariant(
      !supplied || !options.items || supplied.length === options.items.length,
      'invalid-dropdown-selected-items',
      'selectedItemBuilder must return one widget for each dropdown item',
    );
    const items = [...(supplied ?? options.items ?? [])];
    const hint = enabled ? options.hint : (options.disabledHint ?? options.hint);
    const hintIndex = hint ? items.length : null;
    if (hint)
      items.push(
        new DefaultTextStyle(
          style.copyWith({ color: theme.hintColor.toARGB32() }),
          new IgnorePointer(new DropdownMenuItemContainer(hint, alignment)),
        ),
      );
    const dense = options.isDense ?? false;
    const contents = items.length
      ? new IndexedStack(
          dense
            ? items
            : items.map((item) =>
                itemHeight !== null
                  ? new SizedBox(undefined, itemHeight, item)
                  : new Column([item], { mainAxisSize: 'min' }),
              ),
          { alignment, index: selection ?? hintIndex },
        )
      : new SizedBox();
    const iconSize = options.iconSize ?? 24;
    const iconColor = enabled
      ? (options.iconEnabledColor ??
        (theme.brightness === 'dark' ? Colors.white70 : Colors.grey.shade700))
      : (options.iconDisabledColor ??
        (theme.brightness === 'dark' ? Colors.white10 : Colors.grey.shade400));
    const icon = new IconTheme(
      new IconThemeData({ color: iconColor, size: iconSize }),
      options.icon ?? field?.decoration.suffixIcon ?? new Icon(Icons.arrow_drop_down),
    );
    const themePadding =
      !field && ButtonTheme.of(context).alignedDropdown
        ? alignedButtonPadding
        : unalignedButtonPadding;
    const scaledLineHeight = MediaQuery.textScalerOf(context).scale(
      (style.fontSize ?? theme.textTheme.titleMedium?.fontSize ?? 16) *
        (style.height ?? theme.textTheme.titleMedium?.height ?? 1),
    );
    const row = new Row(
      [options.isExpanded ? new Expanded(contents) : contents, ...(field ? [] : [icon])],
      { mainAxisSize: 'min', mainAxisAlignment: 'spaceBetween' },
    );
    let child: Widget = new DefaultTextStyle(
      enabled ? style : style.copyWith({ color: theme.disabledColor.toARGB32() }),
      new SizedBox(
        undefined,
        dense ? Math.max(denseButtonHeight, iconSize, scaledLineHeight) : undefined,
        new Padding(themePadding, row),
      ),
    );
    if (!DropdownButtonHideUnderline.at(context)) {
      const underline =
        options.underline ??
        new DecoratedBox(new SizedBox(undefined, 1), { decoration: underlineDecoration });
      child = new Stack(
        [
          child,
          new Positioned(underline, {
            left: 0,
            right: 0,
            bottom: dense || itemHeight === null ? 0 : 8,
          }),
        ],
        { clipBehavior: 'none' },
      );
    }
    if (options.padding) child = new Padding(options.padding, child);
    const states = emptyWidgetStateSet();
    if (!enabled) states.add(WidgetState.disabled);
    const requestedCursor = options.mouseCursor ?? WidgetStateMouseCursor.adaptiveClickable;
    const cursor = 'resolve' in requestedCursor ? requestedCursor.resolve(states) : requestedCursor;
    const trigger = field
      ? this.decorate(child, icon, field, cursor)
      : new InkWell({
          child,
          mouseCursor: cursor,
          canRequestFocus: enabled,
          focusNode: this.focus,
          autofocus: options.autofocus ?? false,
          borderRadius: options.borderRadius ?? null,
          focusColor: options.focusColor ?? theme.focusColor,
          enableFeedback: false,
          onTap: enabled ? this.open : null,
          excludeFromSemantics: true,
        });
    const actions = new Map<typeof Intent, ActionHandle>([
      [ActivateIntent, new CallbackAction(ActivateIntent, this.open)],
      [ButtonActivateIntent, new CallbackAction(ButtonActivateIntent, this.open)],
    ]);
    return new Semantics({
      button: true,
      expanded: this.route !== null,
      enabled,
      onTap: enabled ? this.open : null,
      child: new Actions({ actions, child: trigger }),
    });
  }
}

export interface DropdownButtonFormFieldOptions<T> extends Omit<
  DropdownButtonOptions<T>,
  'underline' | 'menuWidth'
> {
  readonly initialValue?: T | null;
  readonly decoration?: InputDecoration | null;
  readonly onSaved?: ((value: T | null) => void) | null;
  readonly validator?: ((value: T | null) => string | null) | null;
  readonly errorBuilder?: ((context: BuildContext, errorText: string) => Widget) | null;
  readonly forceErrorText?: string | null;
  readonly autovalidateMode?: AutovalidateMode;
}

export class DropdownButtonFormField<T> extends FormField<T | null> {
  readonly dropdownOptions: DropdownButtonFormFieldOptions<T>;
  constructor(options: DropdownButtonFormFieldOptions<T>) {
    const initialValue = options.initialValue ?? options.value ?? null;
    validateButton(options.items, initialValue, options.itemHeight ?? null);
    invariant(
      !options.errorBuilder || options.decoration?.errorText == null,
      'invalid-dropdown-error-decoration',
      'errorBuilder and decoration.errorText cannot both be supplied',
    );
    super({
      key: options.key ?? null,
      initialValue,
      autovalidateMode: options.autovalidateMode ?? 'disabled',
      forceErrorText: options.forceErrorText ?? null,
      ...(options.validator ? { validator: options.validator } : {}),
      ...(options.onSaved ? { onSaved: options.onSaved } : {}),
      builder: (field) => buildDropdownField(field, options),
    });
    this.dropdownOptions = options;
  }
  get onChanged(): DropdownButtonOptions<T>['onChanged'] {
    return this.dropdownOptions.onChanged;
  }
  override createState(): FormFieldState<T | null> {
    return new DropdownButtonFormFieldState();
  }
}

function buildDropdownField<T>(
  field: FormFieldState<T | null>,
  options: DropdownButtonFormFieldOptions<T>,
): Widget {
  const context = field.context;
  const decoration = (options.decoration ?? new InputDecoration()).applyDefaults(
    InputDecorationTheme.of(context),
  );
  const hint =
    options.hint ?? (decoration.hintText !== null ? new Text(decoration.hintText) : null);
  const disabledHint = options.disabledHint ?? hint;
  const enabled = Boolean(options.onChanged && options.items?.length);
  const visibleValue = options.items?.some((item) => valueEquals(item.value, field.value)) ?? false;
  const isEmpty = !visibleValue && (enabled ? hint === null : disabledHint === null);
  const error = field.errorText;
  const effective = new InputDecoration({
    ...decoration,
    hintText: null,
    ...(error !== null
      ? {
          error: options.errorBuilder ? options.errorBuilder(context, error) : null,
          errorText: options.errorBuilder ? null : error,
        }
      : {}),
  });
  return new DropdownButtonHideUnderline({
    child: new FormDropdownButton(
      {
        ...options,
        key: null,
        value: field.value,
        hint,
        disabledHint,
        isDense: options.isDense ?? true,
        itemHeight: options.itemHeight ?? null,
        onChanged: options.onChanged ? (value) => field.didChange(value) : null,
      },
      effective,
      isEmpty,
    ),
  });
}

class DropdownButtonFormFieldState<T> extends FormFieldState<T | null> {
  private get dropdown(): DropdownButtonFormField<T> {
    return this.widget as DropdownButtonFormField<T>;
  }
  override didUpdateWidget(old: FormField<T | null>): void {
    super.didUpdateWidget(old);
    if (!valueEquals(old.options.initialValue, this.widget.options.initialValue))
      this.setValue(this.widget.options.initialValue);
  }
  override didChange(value: T | null): void {
    super.didChange(value);
    this.dropdown.onChanged?.(value);
  }
  override reset(): void {
    super.reset();
    this.dropdown.onChanged?.(this.value);
  }
}
