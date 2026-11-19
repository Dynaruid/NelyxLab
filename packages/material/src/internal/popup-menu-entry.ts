// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Flutter: packages/flutter/lib/src/material/popup_menu.dart
// Revision: 71e4717a61786faab4c7aa39825989305ed29e8a
import { invariant } from '@nelyx/core/foundation/errors';
import { AnimationController } from '@nelyx/core/framework/animation/animation-controller';
import { AlignmentDirectional } from '@nelyx/core/framework/painting/alignment';
import type { BorderRadiusGeometry } from '@nelyx/core/framework/painting/border-radius';
import { EdgeInsets } from '@nelyx/core/framework/painting/edge-insets';
import type { EdgeInsetsGeometry } from '@nelyx/core/framework/painting/edge-insets';
import { TextStyle } from '@nelyx/core/framework/painting/text-style';
import { valueEquals } from '@nelyx/core/framework/painting/value-equality';
import { BoxConstraints } from '@nelyx/core/framework/rendering/constraints';
import { Align, ConstrainedBox, Padding } from '@nelyx/core/framework/widgets/basic';
import { State, StatefulWidget } from '@nelyx/core/framework/widgets/framework';
import type { BuildContext, Widget, WidgetOptions } from '@nelyx/core/framework/widgets/framework';
import { Icon } from '@nelyx/core/framework/widgets/icon';
import { IconTheme } from '@nelyx/core/framework/widgets/icon-theme';
import { IconThemeData } from '@nelyx/core/framework/widgets/icon-theme-data';
import { AnimatedDefaultTextStyle } from '@nelyx/core/framework/widgets/implicit-animations';
import { Navigator } from '@nelyx/core/framework/widgets/navigation';
import { IgnorePointer } from '@nelyx/core/framework/widgets/pointer-blocking';
import { MergeSemantics, Semantics } from '@nelyx/core/framework/widgets/semantics';
import { SingleTickerProviderStateMixin } from '@nelyx/core/framework/widgets/ticker-provider';
import { FadeTransition } from '@nelyx/core/framework/widgets/transitions';
import {
  WidgetState,
  WidgetStateMouseCursor,
  emptyWidgetStateSet,
} from '@nelyx/core/framework/widgets/widget-state';
import type { WidgetStateProperty } from '@nelyx/core/framework/widgets/widget-state';
import type { MouseCursor } from '@nelyx/core/services/mouse-cursor';
import { Color } from '@nelyx/core/ui/color';
import { SemanticsRole } from '@nelyx/core/ui/semantics';
import { kMinInteractiveDimension, kThemeChangeDuration } from '../constants.ts';
import { Divider } from '../divider.ts';
import { Icons } from '../icons.ts';
import { InkWell } from '../ink-well.ts';
import { ListTileTheme } from '../list-tile-theme.ts';
import { ListTile } from '../list-tile.ts';
import { PopupMenuTheme } from '../popup-menu-theme.ts';
import { Theme } from '../theme.ts';

const menuDividerHeight = 16;
const itemPadding = EdgeInsets.symmetric({ horizontal: 12 });

export abstract class PopupMenuEntry<T> extends StatefulWidget {
  constructor(options: WidgetOptions = {}) {
    super(options.key ?? null);
  }
  abstract get height(): number;
  abstract represents(value: T | null): boolean;
}

export interface PopupMenuDividerOptions extends WidgetOptions {
  readonly height?: number;
  readonly thickness?: number | null;
  readonly indent?: number | null;
  readonly endIndent?: number | null;
  readonly radius?: BorderRadiusGeometry | null;
  readonly color?: Color | null;
}

export class PopupMenuDivider extends PopupMenuEntry<never> {
  constructor(readonly options: PopupMenuDividerOptions = {}) {
    super(options);
  }
  override get height(): number {
    return this.options.height ?? menuDividerHeight;
  }
  override represents(_value: unknown): boolean {
    return false;
  }
  override createState(): State<PopupMenuDivider> {
    return new PopupMenuDividerState();
  }
}

class PopupMenuDividerState extends State<PopupMenuDivider> {
  override build(): Widget {
    return new Divider({ ...this.widget.options, key: null, height: this.widget.height });
  }
}

export interface PopupMenuItemOptions<T> extends WidgetOptions {
  readonly value?: T | null;
  readonly onTap?: (() => void) | null;
  readonly enabled?: boolean;
  readonly height?: number;
  readonly padding?: EdgeInsetsGeometry | null;
  readonly textStyle?: TextStyle | null;
  readonly labelTextStyle?: WidgetStateProperty<TextStyle | null> | null;
  readonly mouseCursor?: MouseCursor | null;
  readonly child: Widget | null;
}

export class PopupMenuItem<T> extends PopupMenuEntry<T> {
  constructor(readonly options: PopupMenuItemOptions<T>) {
    super(options);
    invariant(
      Number.isFinite(this.height) && this.height >= 0,
      'invalid-popup-menu-item-height',
      'The menu item height must be finite and nonnegative',
    );
  }
  override get height(): number {
    return this.options.height ?? kMinInteractiveDimension;
  }
  get value(): T | null {
    return this.options.value ?? null;
  }
  get enabled(): boolean {
    return this.options.enabled ?? true;
  }
  get child(): Widget | null {
    return this.options.child;
  }
  override represents(value: T | null): boolean {
    return valueEquals(this.value, value);
  }
  override createState(): PopupMenuItemState<T, PopupMenuItem<T>> {
    return new PopupMenuItemState<T, PopupMenuItem<T>>();
  }
}

export class PopupMenuItemState<
  T,
  W extends PopupMenuItem<T> = PopupMenuItem<T>,
> extends SingleTickerProviderStateMixin<W> {
  protected buildChild(): Widget | null {
    return this.widget.child;
  }

  protected handleTap(): void {
    Navigator.of(this.context).pop(this.widget.value);
    this.widget.options.onTap?.();
  }

  protected buildSemantics(child: Widget): Widget {
    return new Semantics({
      role: SemanticsRole.menuItem,
      enabled: this.widget.enabled,
      button: true,
      child,
    });
  }

  protected labelStyle(context: BuildContext, selected = false): TextStyle {
    const theme = Theme.of(context),
      menuTheme = PopupMenuTheme.of(context);
    const states = emptyWidgetStateSet();
    if (!this.widget.enabled) states.add(WidgetState.disabled);
    if (selected) states.add(WidgetState.selected);
    const foreground = new Color(theme.colorScheme.onSurface);
    return (
      this.widget.options.labelTextStyle?.resolve(states) ??
      menuTheme.labelTextStyle?.resolve(states) ??
      (theme.textTheme.labelLarge ?? new TextStyle()).copyWith({
        color: (this.widget.enabled ? foreground : foreground.withOpacity(0.38)).toARGB32(),
      })
    );
  }

  override build(context: BuildContext): Widget {
    const { options, enabled, height } = this.widget;
    const theme = Theme.of(context);
    const menuTheme = PopupMenuTheme.of(context);
    const style = this.labelStyle(context);
    const cursor = WidgetStateMouseCursor.resolveWith(
      (states) => {
        const local = options.mouseCursor;
        return (
          (local instanceof WidgetStateMouseCursor ? local.resolve(states) : local) ??
          menuTheme.mouseCursor?.resolve(states) ??
          WidgetStateMouseCursor.clickable.resolve(states)
        );
      },
      { debugDescription: 'Popup menu item cursor' },
    );
    let item: Widget = new AnimatedDefaultTextStyle({
      style,
      duration: kThemeChangeDuration,
      child: new ConstrainedBox(
        new Padding(
          options.padding ?? itemPadding,
          new Align(this.buildChild() ?? undefined, {
            alignment: AlignmentDirectional.centerStart,
          }),
        ),
        new BoxConstraints(0, Infinity, height),
      ),
    });
    if (!enabled)
      item = IconTheme.merge({
        data: new IconThemeData({ opacity: theme.brightness === 'dark' ? 0.5 : 0.38 }),
        child: item,
      });
    return new MergeSemantics({
      child: this.buildSemantics(
        new InkWell({
          onTap: enabled ? () => this.handleTap() : null,
          canRequestFocus: enabled,
          mouseCursor: cursor,
          child: ListTileTheme.merge({
            contentPadding: EdgeInsets.zero,
            titleTextStyle: style,
            child: item,
          }),
        }),
      ),
    });
  }
}

export interface CheckedPopupMenuItemOptions<T> extends Omit<PopupMenuItemOptions<T>, 'child'> {
  readonly child?: Widget | null;
  readonly checked?: boolean;
}

export class CheckedPopupMenuItem<T> extends PopupMenuItem<T> {
  readonly checked: boolean;
  constructor({ checked = false, child = null, ...options }: CheckedPopupMenuItemOptions<T> = {}) {
    super({ ...options, child });
    this.checked = checked;
  }
  override createState(): PopupMenuItemState<T, CheckedPopupMenuItem<T>> {
    return new CheckedPopupMenuItemState<T>();
  }
}

class CheckedPopupMenuItemState<T> extends PopupMenuItemState<T, CheckedPopupMenuItem<T>> {
  private checkmark!: AnimationController;

  override initState(): void {
    super.initState();
    this.checkmark = new AnimationController({
      vsync: this,
      duration: 150,
      value: this.widget.checked ? 1 : 0,
    });
  }

  override didUpdateWidget(old: CheckedPopupMenuItem<T>): void {
    super.didUpdateWidget(old);
    if (old.checked !== this.widget.checked) this.animateCheckmark(this.widget.checked);
  }

  private animateCheckmark(checked: boolean): void {
    if (checked) this.checkmark.forward();
    else this.checkmark.reverse();
  }

  protected override handleTap(): void {
    this.animateCheckmark(!this.widget.checked);
    super.handleTap();
  }

  protected override buildSemantics(child: Widget): Widget {
    return new Semantics({
      role: SemanticsRole.menuItemCheckbox,
      enabled: this.widget.enabled,
      checked: this.widget.checked,
      button: true,
      child,
    });
  }

  protected override buildChild(): Widget {
    const widget = this.widget;
    return new IgnorePointer(
      new ListTile({
        contentPadding: EdgeInsets.zero,
        title: widget.child,
        enabled: widget.enabled,
        titleTextStyle: this.labelStyle(this.context, widget.checked),
        leading: new FadeTransition({ opacity: this.checkmark, child: new Icon(Icons.done) }),
      }),
    );
  }

  override dispose(): void {
    this.checkmark.dispose();
    super.dispose();
  }
}
