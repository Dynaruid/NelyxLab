// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
import { AnimationStatus } from '@nelyx/core/framework/animation/animation';
import { AnimationController } from '@nelyx/core/framework/animation/animation-controller';
import { Curves } from '@nelyx/core/framework/animation/curves';
import { AlignmentDirectional } from '@nelyx/core/framework/painting/alignment';
import type { AlignmentGeometry } from '@nelyx/core/framework/painting/alignment';
import { BorderRadius } from '@nelyx/core/framework/painting/border-radius';
import { EdgeInsets } from '@nelyx/core/framework/painting/edge-insets';
import type { EdgeInsetsGeometry } from '@nelyx/core/framework/painting/edge-insets';
import { RoundedRectangleBorder } from '@nelyx/core/framework/painting/rounded-rectangle-border';
import { BoxConstraints } from '@nelyx/core/framework/rendering/constraints';
import { SingleChildLayoutDelegate } from '@nelyx/core/framework/rendering/custom-layout';
import type { LayerLink } from '@nelyx/core/framework/rendering/layer';
import { HitTestBehavior } from '@nelyx/core/framework/rendering/pointer-listener';
import { Directionality, MediaQuery } from '@nelyx/core/framework/widgets/app-data';
import { Align, Flexible, Padding, Row, SizedBox } from '@nelyx/core/framework/widgets/basic';
import { ClipRect } from '@nelyx/core/framework/widgets/clip';
import { CompositedTransformTarget } from '@nelyx/core/framework/widgets/composited-transform';
import { CustomSingleChildLayout } from '@nelyx/core/framework/widgets/custom-layout';
import { FocusNode, FocusScopeNode } from '@nelyx/core/framework/widgets/focus';
import { FocusScope } from '@nelyx/core/framework/widgets/focus-scope';
import {
  InheritedWidget,
  State,
  StatefulWidget,
  StatelessWidget,
} from '@nelyx/core/framework/widgets/framework';
import type { BuildContext, Widget, WidgetOptions } from '@nelyx/core/framework/widgets/framework';
import { GestureDetector } from '@nelyx/core/framework/widgets/gesture-detector';
import { Icon } from '@nelyx/core/framework/widgets/icon';
import { ListenableBuilder } from '@nelyx/core/framework/widgets/listenable-builder';
import { Opacity } from '@nelyx/core/framework/widgets/opacity';
import {
  dismissMenu,
  MenuController,
  RawMenuAnchor,
  RawMenuAnchorGroup,
} from '@nelyx/core/framework/widgets/raw-menu-anchor';
import type {
  RawMenuAnchorChildBuilder,
  RawMenuOverlayInfo,
} from '@nelyx/core/framework/widgets/raw-menu-anchor';
import { ListView } from '@nelyx/core/framework/widgets/scroll-view';
import { Semantics } from '@nelyx/core/framework/widgets/semantics';
import { TapRegion } from '@nelyx/core/framework/widgets/tap-region';
import { SingleTickerProviderStateMixin } from '@nelyx/core/framework/widgets/ticker-provider';
import { WidgetState, emptyWidgetStateSet } from '@nelyx/core/framework/widgets/widget-state';
import type {
  WidgetStateProperty,
  WidgetStatesController,
} from '@nelyx/core/framework/widgets/widget-state';
import { KeyDownEvent } from '@nelyx/core/services/hardware-keyboard';
import { LogicalKeyboardKey } from '@nelyx/core/services/keyboard-key';
import type { Clip } from '@nelyx/core/ui/clip';
import { Color } from '@nelyx/core/ui/color';
import type { Size } from '@nelyx/core/ui/geometry';
import { Offset } from '@nelyx/core/ui/offset';
import { SemanticsRole } from '@nelyx/core/ui/semantics';
import { Size as SourceSize } from '@nelyx/core/ui/size';
import type { TextDirection } from '@nelyx/core/ui/typography';
import type { ButtonStyle } from './button-style.ts';
import { Icons } from './icons.ts';
import { Material } from './material.ts';
import { MenuBarTheme } from './menu-bar-theme.ts';
import { MenuButtonTheme } from './menu-button-theme.ts';
import { MenuStyle } from './menu-style.ts';
import { MenuTheme } from './menu-theme.ts';
import { TextButton } from './text-button.ts';
import { Theme } from './theme.ts';

export { MenuController, MenuStyle };
export type MenuAnchorChildBuilder = RawMenuAnchorChildBuilder;
const defaultPanelShape = new RoundedRectangleBorder({ borderRadius: BorderRadius.circular(4) });
const defaultItemShape = new RoundedRectangleBorder();
const defaultPanelPadding = EdgeInsets.symmetric({ vertical: 8 });
const defaultEdgePadding = EdgeInsets.all(8);

class MenuOrientation extends InheritedWidget {
  constructor(
    readonly vertical: boolean,
    child: Widget,
  ) {
    super(child);
  }
  override updateShouldNotify(old: MenuOrientation): boolean {
    return old.vertical !== this.vertical;
  }
}

export interface MenuAnchorOptions extends WidgetOptions {
  readonly controller?: MenuController | null;
  readonly childFocusNode?: FocusNode | null;
  readonly style?: MenuStyle | null;
  readonly alignmentOffset?: Offset;
  readonly reservedPadding?: EdgeInsetsGeometry | null;
  readonly layerLink?: LayerLink | null;
  readonly clipBehavior?: Clip;
  readonly anchorTapClosesMenu?: boolean;
  readonly consumeOutsideTap?: boolean;
  readonly onOpen?: (() => void) | null;
  readonly onClose?: (() => void) | null;
  readonly crossAxisUnconstrained?: boolean;
  readonly useRootOverlay?: boolean;
  readonly animated?: boolean;
  readonly onAnimationStatusChanged?: ((status: AnimationStatus) => void) | null;
  readonly menuChildren: readonly Widget[];
  readonly builder?: MenuAnchorChildBuilder | null;
  readonly child?: Widget | null;
}

export class MenuAnchor extends StatefulWidget {
  readonly options: Readonly<MenuAnchorOptions>;
  constructor(options: MenuAnchorOptions) {
    super(options.key ?? null);
    this.options = Object.freeze({ ...options });
  }
  get controller(): MenuController | null {
    return this.options.controller ?? null;
  }
  get menuChildren(): readonly Widget[] {
    return this.options.menuChildren;
  }
  override createState(): State<MenuAnchor> {
    return new MenuAnchorState();
  }
}

class MenuAnchorState extends SingleTickerProviderStateMixin<MenuAnchor> {
  private readonly internal = new MenuController();
  private readonly menuFocus = new FocusScopeNode({ debugLabel: 'Material menu focus' });
  private animation!: AnimationController;
  private pendingClose: (() => void) | null = null;

  get controller(): MenuController {
    return this.widget.controller ?? this.internal;
  }
  override initState(): void {
    super.initState();
    this.animation = new AnimationController({ vsync: this, duration: 500, reverseDuration: 150 });
    this.animation.addStatusListener((status) => {
      if (status === AnimationStatus.dismissed) {
        const closed = this.pendingClose;
        this.pendingClose = null;
        closed?.();
      }
      this.widget.options.onAnimationStatusChanged?.(status);
    });
  }
  private readonly openRequested = (_position: Offset | null, show: () => void) => {
    this.pendingClose = null;
    show();
    this.animation.forward();
  };
  private readonly closeRequested = (hide: () => void) => {
    if (this.animation.isDismissed) hide();
    else {
      this.pendingClose = hide;
      this.animation.reverse();
    }
  };

  override build(): Widget {
    const { options } = this.widget;
    return new RawMenuAnchor({
      controller: this.controller,
      childFocusNode: options.childFocusNode ?? null,
      consumeOutsideTaps: options.consumeOutsideTap ?? false,
      useRootOverlay: options.useRootOverlay ?? false,
      onOpen: options.onOpen ?? null,
      onClose: options.onClose ?? null,
      ...(options.animated
        ? { onOpenRequested: this.openRequested, onCloseRequested: this.closeRequested }
        : {}),
      builder: (context, controller, child) => {
        let anchor = options.builder?.(context, controller, child) ?? child ?? new SizedBox();
        if (options.anchorTapClosesMenu && controller.isOpen)
          anchor = new GestureDetector(anchor, {
            onTap: () => controller.close(),
            excludeFromSemantics: true,
          });
        return options.layerLink
          ? new CompositedTransformTarget(anchor, { link: options.layerLink })
          : anchor;
      },
      child: options.child ?? null,
      overlayBuilder: this.buildPanel,
    });
  }

  private readonly buildPanel = (context: BuildContext, info: RawMenuOverlayInfo): Widget => {
    const options = this.widget.options;
    const style =
      options.style?.merge(MenuTheme.of(context).style) ??
      MenuTheme.of(context).style ??
      new MenuStyle();
    const states = emptyWidgetStateSet();
    const direction = Directionality.of(context);
    const media = MediaQuery.maybePaddingOf(context) ?? EdgeInsets.zero;
    const keyboard = MediaQuery.maybeViewInsetsOf(context) ?? EdgeInsets.zero;
    const outerInsets = media
      .add(keyboard)
      .add(options.reservedPadding ?? defaultEdgePadding)
      .resolve(direction);
    const colors = Theme.of(context).colorScheme;
    const shape = style.shape?.resolve(states) ?? defaultPanelShape;
    const side = style.side?.resolve(states);
    const padding = style.padding?.resolve(states) ?? defaultPanelPadding;
    const layout = new MenuLayout(
      info,
      style.alignment ?? AlignmentDirectional.bottomStart,
      options.alignmentOffset ?? Offset.zero,
      direction,
      outerInsets,
      style.minimumSize?.resolve(states) ?? null,
      style.maximumSize?.resolve(states) ?? null,
      style.fixedSize?.resolve(states) ?? null,
      options.crossAxisUnconstrained ?? true,
    );
    const list = new ListView({
      children: options.menuChildren,
      shrinkWrap: true,
      padding,
      primary: false,
    });
    let panel: Widget = new Material({
      color: style.backgroundColor?.resolve(states) ?? new Color(colors.surfaceContainer),
      elevation: style.elevation?.resolve(states)?.value ?? 3,
      shadowColor: style.shadowColor?.resolve(states) ?? null,
      surfaceTintColor: style.surfaceTintColor?.resolve(states) ?? null,
      shape: side ? shape.copyWith({ side }) : shape,
      clipBehavior: options.clipBehavior ?? 'hardEdge',
      child: list,
    });
    if (options.animated) {
      const surface = panel;
      panel = new ListenableBuilder(this.animation, () => {
        const fraction = Curves.easeOut.transform(this.animation.value);
        return new Opacity(
          new ClipRect(
            new Align(surface, {
              heightFactor: fraction,
              alignment: AlignmentDirectional.topStart,
            }),
          ),
          { opacity: fraction },
        );
      });
    }
    return new CustomSingleChildLayout(
      new TapRegion(
        new FocusScope(
          new Semantics({
            container: true,
            explicitChildNodes: true,
            role: SemanticsRole.menu,
            child: new MenuOrientation(true, panel),
          }),
          {
            node: this.menuFocus,
            autofocus: true,
            skipTraversal: true,
            includeSemantics: false,
            traversalEdgeBehavior: 'closedLoop',
            onKeyEvent: (_node, event) => {
              if (!(event instanceof KeyDownEvent)) return 'ignored';
              if (event.logicalKey.equals(LogicalKeyboardKey.escape)) {
                dismissMenu(this.controller);
                return 'handled';
              }
              if (event.logicalKey.equals(LogicalKeyboardKey.arrowDown))
                return this.menuFocus.nextFocus() ? 'handled' : 'ignored';
              if (event.logicalKey.equals(LogicalKeyboardKey.arrowUp))
                return this.menuFocus.previousFocus() ? 'handled' : 'ignored';
              return 'ignored';
            },
          },
        ),
        { groupId: info.tapRegionGroupId, behavior: HitTestBehavior.opaque },
      ),
      layout,
    );
  };

  override dispose(): void {
    this.animation.dispose();
    this.menuFocus.dispose();
    super.dispose();
  }
}

class MenuLayout extends SingleChildLayoutDelegate {
  constructor(
    readonly info: RawMenuOverlayInfo,
    readonly alignment: AlignmentGeometry,
    readonly adjustment: Offset,
    readonly direction: TextDirection,
    readonly insets: EdgeInsets,
    readonly minimum: Size | null,
    readonly maximum: Size | null,
    readonly fixed: Size | null,
    readonly unconstrained: boolean,
  ) {
    super();
  }

  override getConstraintsForChild(constraints: BoxConstraints): BoxConstraints {
    const available = this.insets.deflateSize(constraints.biggest);
    const maxWidth = Math.max(0, Math.min(available.width, this.maximum?.width ?? Infinity));
    const maxHeight = Math.max(0, Math.min(available.height, this.maximum?.height ?? Infinity));
    const suggested = this.unconstrained
      ? Math.max(196, this.info.anchorRect.width)
      : this.info.anchorRect.width;
    const width = Math.min(
      maxWidth,
      Math.max(this.minimum?.width ?? 0, this.fixed?.width ?? suggested),
    );
    const height = this.fixed?.height;
    const minHeight = Math.min(maxHeight, height ?? this.minimum?.height ?? 0);
    return new BoxConstraints(
      width,
      width,
      minHeight,
      height === undefined ? maxHeight : minHeight,
    );
  }

  override getPositionForChild(size: Size, child: Size) {
    const ltr = this.direction === 'ltr';
    const rect = this.info.anchorRect;
    const preferred = this.alignment.resolve(this.direction).withinRect(rect);
    const pos = this.info.position;
    const horizontal =
      this.alignment instanceof AlignmentDirectional && !ltr
        ? -this.adjustment.dx
        : this.adjustment.dx;
    const x = pos ? rect.left + pos.dx : preferred.dx + horizontal - (ltr ? 0 : child.width);
    let y = pos ? rect.top + pos.dy : preferred.dy + this.adjustment.dy;
    const bottom = size.height - this.insets.bottom - child.height;
    if (!pos && y > bottom && rect.top - child.height >= this.insets.top)
      y = rect.top - child.height - this.adjustment.dy;
    return {
      x: Math.max(this.insets.left, Math.min(size.width - this.insets.right - child.width, x)),
      y: Math.max(this.insets.top, Math.min(bottom, y)),
    };
  }
  override shouldRelayout(): boolean {
    return true;
  }
}

export interface MenuItemButtonOptions extends WidgetOptions {
  readonly onPressed?: (() => void) | null;
  readonly onHover?: ((hovered: boolean) => void) | null;
  readonly requestFocusOnHover?: boolean;
  readonly onFocusChange?: ((focused: boolean) => void) | null;
  readonly focusNode?: FocusNode | null;
  readonly autofocus?: boolean;
  readonly semanticsLabel?: string | null;
  readonly style?: ButtonStyle | null;
  readonly statesController?: WidgetStatesController | null;
  readonly clipBehavior?: Clip;
  readonly leadingIcon?: Widget | null;
  readonly trailingIcon?: Widget | null;
  readonly closeOnActivate?: boolean;
  readonly child?: Widget | null;
  /** @internal Accessible state supplied by the checkbox and radio menu variants. */
  readonly checkedState?: {
    readonly checked: boolean;
    readonly mixed?: boolean;
    readonly radio?: boolean;
  };
}

export class MenuItemButton extends StatefulWidget {
  constructor(readonly options: MenuItemButtonOptions = {}) {
    super(options.key ?? null);
  }
  get enabled(): boolean {
    return this.options.onPressed != null;
  }
  static styleFrom(options: Parameters<typeof TextButton.styleFrom>[0] = {}): ButtonStyle {
    return TextButton.styleFrom(options);
  }
  override createState(): State<MenuItemButton> {
    return new MenuItemButtonState();
  }
}

class MenuItemButtonState extends State<MenuItemButton> {
  private readonly ownFocus = new FocusNode();
  override build(context: BuildContext): Widget {
    const { options, enabled } = this.widget;
    const controller = MenuController.maybeOf(context);
    const focus = options.focusNode ?? this.ownFocus;
    const theme = MenuButtonTheme.of(context).style;
    const base = TextButton.styleFrom({
      foregroundColor: new Color(Theme.of(context).colorScheme.onSurface),
      padding: EdgeInsets.symmetric({ horizontal: 12 }),
      minimumSize: new SourceSize(64, 48),
      alignment: AlignmentDirectional.centerStart,
      shape: defaultItemShape,
    });
    const style = options.style?.merge(theme)?.merge(base) ?? theme?.merge(base) ?? base;
    const child = new Row(
      [
        ...(options.leadingIcon ? [options.leadingIcon] : []),
        new Flexible(options.child ?? new SizedBox()),
        ...(options.trailingIcon ? [options.trailingIcon] : []),
      ],
      { spacing: 12, mainAxisSize: 'min' },
    );
    const inMenu = context.maybeDependOn(MenuOrientation) !== undefined;
    const check = options.checkedState;
    return new TextButton({
      child,
      style,
      focusNode: focus,
      autofocus: options.autofocus ?? false,
      ...(options.semanticsLabel == null ? {} : { semanticsLabel: options.semanticsLabel }),
      statesController: options.statesController ?? null,
      clipBehavior: options.clipBehavior ?? 'none',
      ...(inMenu
        ? {
            menuSemantics: {
              role: check
                ? check.radio
                  ? SemanticsRole.menuItemRadio
                  : SemanticsRole.menuItemCheckbox
                : SemanticsRole.menuItem,
              ...check,
            },
          }
        : {}),
      onPressed: enabled
        ? () => {
            if (controller && options.closeOnActivate !== false) dismissMenu(controller);
            options.onPressed?.();
          }
        : null,
      onHover: (hovered) => {
        if (hovered && enabled && options.requestFocusOnHover !== false) focus.requestFocus();
        options.onHover?.(hovered);
      },
      onFocusChange: options.onFocusChange ?? null,
    });
  }
  override dispose(): void {
    this.ownFocus.dispose();
    super.dispose();
  }
}

export interface SubmenuButtonOptions extends Omit<
  MenuItemButtonOptions,
  'onPressed' | 'closeOnActivate' | 'semanticsLabel'
> {
  readonly controller?: MenuController | null;
  readonly menuStyle?: MenuStyle | null;
  readonly alignmentOffset?: Offset;
  readonly submenuIcon?: WidgetStateProperty<Widget | null> | null;
  readonly menuChildren: readonly Widget[];
  readonly onOpen?: (() => void) | null;
  readonly onClose?: (() => void) | null;
  readonly animated?: boolean;
  readonly onAnimationStatusChanged?: ((status: AnimationStatus) => void) | null;
  readonly useRootOverlay?: boolean;
}

export class SubmenuButton extends StatelessWidget {
  constructor(readonly options: SubmenuButtonOptions) {
    super(options.key ?? null);
  }
  override build(context: BuildContext): Widget {
    const options = this.options;
    const submenu = context.maybeDependOn(MenuOrientation)?.vertical ?? false;
    const states = emptyWidgetStateSet();
    if (!options.menuChildren.length) states.add(WidgetState.disabled);
    const accent =
      options.submenuIcon?.resolve(states) ?? MenuTheme.of(context).submenuIcon?.resolve(states);
    const ltr = Directionality.maybeOf(context) !== 'rtl';
    const trailing =
      options.trailingIcon ??
      (submenu
        ? (accent ?? new Icon(ltr ? Icons.chevron_right : Icons.chevron_left, { size: 18 }))
        : null);
    return new MenuAnchor({
      ...options,
      key: null,
      style:
        options.menuStyle ??
        (submenu ? new MenuStyle({ alignment: AlignmentDirectional.topEnd }) : null),
      builder: (_context, controller) =>
        new MenuItemButton({
          ...options,
          key: null,
          trailingIcon: trailing,
          closeOnActivate: false,
          onPressed: options.menuChildren.length
            ? () => {
                if (controller.isOpen) controller.close();
                else controller.open();
              }
            : null,
          onHover: (hover) => {
            if (hover && submenu && options.menuChildren.length && !controller.isOpen)
              controller.open();
            options.onHover?.(hover);
          },
        }),
    });
  }
}

export interface MenuBarOptions extends WidgetOptions {
  readonly children: readonly Widget[];
  readonly style?: MenuStyle | null;
  readonly clipBehavior?: Clip;
  readonly controller?: MenuController | null;
}

export class MenuBar extends StatefulWidget {
  constructor(readonly options: MenuBarOptions) {
    super(options.key ?? null);
  }
  override createState(): State<MenuBar> {
    return new MenuBarState();
  }
}

class MenuBarState extends State<MenuBar> {
  private readonly owned = new MenuController();
  override build(context: BuildContext): Widget {
    const {
      children,
      style: override,
      clipBehavior = 'none',
      controller = null,
    } = this.widget.options;
    const theme = MenuBarTheme.of(context).style;
    const style = override?.merge(theme) ?? theme;
    const states = emptyWidgetStateSet();
    const colors = Theme.of(context).colorScheme;
    return new RawMenuAnchorGroup({
      controller: controller ?? this.owned,
      child: new Material({
        color: style?.backgroundColor?.resolve(states) ?? new Color(colors.surfaceContainer),
        elevation: style?.elevation?.resolve(states)?.value ?? 3,
        shadowColor: style?.shadowColor?.resolve(states) ?? null,
        surfaceTintColor: style?.surfaceTintColor?.resolve(states) ?? null,
        shape: style?.shape?.resolve(states) ?? defaultPanelShape,
        clipBehavior,
        child: new Semantics({
          container: true,
          explicitChildNodes: true,
          role: SemanticsRole.menuBar,
          child: new MenuOrientation(
            false,
            new Padding(
              style?.padding?.resolve(states) ?? EdgeInsets.symmetric({ horizontal: 8 }),
              new Row(children, { mainAxisSize: 'min' }),
            ),
          ),
        }),
      }),
    });
  }
}

export interface CheckboxMenuButtonOptions extends Omit<
  MenuItemButtonOptions,
  'onPressed' | 'leadingIcon'
> {
  readonly value: boolean | null;
  readonly onChanged?: ((value: boolean | null) => void) | null;
  readonly tristate?: boolean;
}

export class CheckboxMenuButton extends StatelessWidget {
  constructor(readonly options: CheckboxMenuButtonOptions) {
    super(options.key ?? null);
  }
  override build(): Widget {
    const { value, onChanged, tristate = false } = this.options;
    const next = value === false ? true : value === true && tristate ? null : false;
    return new MenuItemButton({
      ...this.options,
      key: null,
      checkedState: { checked: value === true, mixed: value === null },
      leadingIcon: new Icon(
        value === null
          ? Icons.indeterminate_check_box
          : value
            ? Icons.check_box
            : Icons.check_box_outline_blank,
      ),
      onPressed: onChanged ? () => onChanged(next) : null,
    });
  }
}

export interface RadioMenuButtonOptions<T> extends Omit<
  MenuItemButtonOptions,
  'onPressed' | 'leadingIcon'
> {
  readonly value: T;
  readonly groupValue: T | null;
  readonly onChanged?: ((value: T | null) => void) | null;
  readonly toggleable?: boolean;
}

export class RadioMenuButton<T> extends StatelessWidget {
  constructor(readonly options: RadioMenuButtonOptions<T>) {
    super(options.key ?? null);
  }
  override build(): Widget {
    const { value, groupValue, onChanged, toggleable = false } = this.options;
    const selected = Object.is(value, groupValue);
    return new MenuItemButton({
      ...this.options,
      key: null,
      checkedState: { checked: selected, radio: true },
      leadingIcon: new Icon(selected ? Icons.radio_button_checked : Icons.radio_button_unchecked),
      onPressed: onChanged
        ? () => {
            if (!selected || toggleable) onChanged(selected ? null : value);
          }
        : null,
    });
  }
}
