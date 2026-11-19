// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Adapted from packages/flutter/lib/src/material/menu_anchor.dart at
// 71e4717a61786faab4c7aa39825989305ed29e8a.
import { FoundationBuildMode } from '@nelyx/core/foundation/constants';
import { debugPrint } from '@nelyx/core/foundation/print';
import { AnimationStatus } from '@nelyx/core/framework/animation/animation';
import { AnimationController } from '@nelyx/core/framework/animation/animation-controller';
import { CurvedAnimation } from '@nelyx/core/framework/animation/animations';
import { Cubic, Curve, Interval } from '@nelyx/core/framework/animation/curves';
import { AlignmentDirectional } from '@nelyx/core/framework/painting/alignment';
import { Axis } from '@nelyx/core/framework/painting/basic-types';
import { BorderRadius } from '@nelyx/core/framework/painting/border-radius';
import { EdgeInsets, EdgeInsetsDirectional } from '@nelyx/core/framework/painting/edge-insets';
import type { EdgeInsetsGeometry } from '@nelyx/core/framework/painting/edge-insets';
import { RoundedRectangleBorder } from '@nelyx/core/framework/painting/rounded-rectangle-border';
import { BoxConstraints } from '@nelyx/core/framework/rendering/constraints';
import type { LayerLink } from '@nelyx/core/framework/rendering/layer';
import { HitTestBehavior } from '@nelyx/core/framework/rendering/pointer-listener';
import { ActivateIntent } from '@nelyx/core/framework/widgets/actions';
import { Directionality, MediaQuery } from '@nelyx/core/framework/widgets/app-data';
import {
  Align,
  Column,
  ConstrainedBox,
  Expanded,
  Flexible,
  IntrinsicHeight,
  IntrinsicWidth,
  Padding,
  Row,
  SizedBox,
  Text,
} from '@nelyx/core/framework/widgets/basic';
import { ClipRect } from '@nelyx/core/framework/widgets/clip';
import {
  CompositedTransformFollower,
  CompositedTransformTarget,
} from '@nelyx/core/framework/widgets/composited-transform';
import { CustomSingleChildLayout } from '@nelyx/core/framework/widgets/custom-layout';
import { DisplayFeatureSubScreen } from '@nelyx/core/framework/widgets/display-feature-sub-screen';
import { FocusNode, FocusScopeNode } from '@nelyx/core/framework/widgets/focus';
import type { KeyEventResult } from '@nelyx/core/framework/widgets/focus';
import { ExcludeFocus, Focus, FocusScope } from '@nelyx/core/framework/widgets/focus-scope';
import { FocusTraversalGroup } from '@nelyx/core/framework/widgets/focus-traversal-group';
import { ReadingOrderTraversalPolicy } from '@nelyx/core/framework/widgets/focus-traversal-policy';
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
import { ListenableBuilder } from '@nelyx/core/framework/widgets/listenable-builder';
import { MouseRegion } from '@nelyx/core/framework/widgets/mouse-region';
import { UnconstrainedBox } from '@nelyx/core/framework/widgets/overflow-box';
import { IgnorePointer } from '@nelyx/core/framework/widgets/pointer-blocking';
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
import { ScrollController } from '@nelyx/core/framework/widgets/scroll-controller';
import { ScrollConfiguration } from '@nelyx/core/framework/widgets/scroll-configuration';
import { ClampingScrollPhysics } from '@nelyx/core/framework/widgets/scroll-physics';
import { SingleBoxScrollView } from '@nelyx/core/framework/widgets/scroll-view';
import { scrollChromeTimer } from '@nelyx/core/internal/framework/widgets/scroll-chrome-timers';
import { ExcludeSemantics, Semantics } from '@nelyx/core/framework/widgets/semantics';
import {
  ShortcutRegistrar,
  Shortcuts,
  SingleActivator,
} from '@nelyx/core/framework/widgets/shortcuts';
import { TapRegion } from '@nelyx/core/framework/widgets/tap-region';
import { SingleTickerProviderStateMixin } from '@nelyx/core/framework/widgets/ticker-provider';
import { FadeTransition } from '@nelyx/core/framework/widgets/transitions';
import {
  WidgetState,
  WidgetStateMouseCursor,
  emptyWidgetStateSet,
} from '@nelyx/core/framework/widgets/widget-state';
import type {
  WidgetStateProperty,
  WidgetStatesController,
} from '@nelyx/core/framework/widgets/widget-state';
import { KeyDownEvent, KeyRepeatEvent } from '@nelyx/core/services/hardware-keyboard';
import type { KeyEvent } from '@nelyx/core/services/hardware-keyboard';
import { LogicalKeyboardKey } from '@nelyx/core/services/keyboard-key';
import { MouseCursor } from '@nelyx/core/services/mouse-cursor';
import type { Clip } from '@nelyx/core/ui/clip';
import { Color } from '@nelyx/core/ui/color';
import { Offset } from '@nelyx/core/ui/offset';
import { SemanticsRole } from '@nelyx/core/ui/semantics';
import { Size as SourceSize } from '@nelyx/core/ui/size';
import { ButtonStyle } from './button-style.ts';
import { ButtonStyleButton } from './button-style-button.ts';
import { kThemeChangeDuration } from './constants.ts';
import { Icons } from './icons.ts';
import { colorProperty } from './internal/button/style-properties.ts';
import { MenuPanelLayout } from './internal/menu-panel-layout.ts';
import { menuShortcutLabel } from './internal/menu-shortcuts.ts';
import type { MenuSerializableShortcut } from './internal/menu-shortcuts.ts';
import { Material } from './material.ts';
import { MaterialLocalizations } from './material-localizations.ts';
import { MenuAcceleratorCallbackBinding } from './menu-accelerator-label.ts';
import { MenuBarTheme } from './menu-bar-theme.ts';
import { MenuButtonTheme } from './menu-button-theme.ts';
import { MenuStyle } from './menu-style.ts';
import { MenuTheme } from './menu-theme.ts';
import { Easing } from './motion.ts';
import { Scrollbar } from './scrollbar.ts';
import { TextButton } from './text-button.ts';
import { Theme } from './theme.ts';

export { MenuController, MenuStyle };
export { MenuAcceleratorCallbackBinding, MenuAcceleratorLabel } from './menu-accelerator-label.ts';
export type {
  MenuAcceleratorCallbackBindingOptions,
  MenuAcceleratorChildBuilder,
  MenuAcceleratorLabelOptions,
} from './menu-accelerator-label.ts';
export type {
  MenuSerializableShortcut,
  MenuShortcutSerialization,
} from './internal/menu-shortcuts.ts';
export type MenuAnchorChildBuilder = RawMenuAnchorChildBuilder;
const defaultPanelShape = new RoundedRectangleBorder({ borderRadius: BorderRadius.circular(4) });
const defaultItemShape = new RoundedRectangleBorder();
const barHorizontalPadding = 4;
const defaultPanelPadding = EdgeInsets.symmetric({ vertical: 8 });
const defaultEdgePadding = EdgeInsets.all(8);
const defaultLabelSpacing = 12;
const minimumLabelSpacing = 4;
const defaultSubmenuIconSize = 24;
const openingDuration = 500;
const closingDuration = 150;
const panelHeightIn = new Cubic(0.3, 0, 0, 1);
const panelOpacityIn = new Interval(0, 50 / openingDuration);
const panelOpacityOut = new Interval(100 / closingDuration, 1).flipped;
const itemFadeIn = 1 / 2;
const itemFadeOut = 1 / 3;
const itemFadeOutDelay = 1 / 3;
const transparent = new Color(0x00000000);
const debugMenus = false;
const gamepadActivation = new Map([
  [new SingleActivator(LogicalKeyboardKey.gameButtonA), new ActivateIntent()],
]);

class TweenCurve extends Curve {
  constructor(
    readonly begin: number,
    readonly end: number,
    readonly curve: Curve,
  ) {
    super();
  }
  protected override transformInternal(t: number): number {
    return this.begin + (this.end - this.begin) * this.curve.transform(t);
  }
}

const panelHeightOut = new TweenCurve(0.35, 1, Easing.emphasizedAccelerate.flipped);

function debugMenuInfo(message: string, details: readonly string[] = []): void {
  if (!FoundationBuildMode.debug || !debugMenus) return;
  debugPrint(`MENU: ${message}`);
  for (const detail of details) debugPrint(`    ${detail}`);
}

class MenuOrientation extends InheritedWidget {
  constructor(
    readonly vertical: boolean,
    readonly controller: MenuController,
    readonly anchor: MenuAnchorState | null,
    readonly interactive: boolean,
    child: Widget,
  ) {
    super(child);
  }
  override updateShouldNotify(old: MenuOrientation): boolean {
    return (
      old.vertical !== this.vertical ||
      old.controller !== this.controller ||
      old.anchor !== this.anchor ||
      old.interactive !== this.interactive
    );
  }
}

class MenuAnchorScope extends InheritedWidget {
  constructor(
    readonly anchor: MenuAnchorState,
    child: Widget,
  ) {
    super(child);
  }
  override updateShouldNotify(old: MenuAnchorScope): boolean {
    return old.anchor !== this.anchor;
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
  /** @internal A dropdown matches at least the width of its field. */
  readonly minimumAnchorWidth?: boolean;
  readonly useRootOverlay?: boolean;
  /** @internal Controls whether opening transfers focus from an editable anchor. */
  readonly autofocusMenu?: boolean;
  /** @internal Close a submenu when focus leaves its button and panel. */
  readonly closeOnFocusExit?: boolean;
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
  private readonly scroll = new ScrollController();
  private animation!: AnimationController;
  private height!: CurvedAnimation;
  private opacity!: CurvedAnimation;
  private itemAnimations: CurvedAnimation[] = [];
  private parentMenu: MenuOrientation | undefined;
  private pendingClose: (() => void) | null = null;
  private pendingFocus: 'first' | 'last' | null = null;
  private motionRequest = 0;

  get controller(): MenuController {
    return this.widget.controller ?? this.internal;
  }
  get menuHasFocus(): boolean {
    return this.menuFocus.hasFocus;
  }
  get menuIsOpeningOrOpen(): boolean {
    return this.animation.isForwardOrCompleted;
  }
  override initState(): void {
    super.initState();
    this.animation = new AnimationController({ vsync: this, duration: 0 });
    this.height = new CurvedAnimation({
      parent: this.animation,
      curve: panelHeightIn,
      reverseCurve: panelHeightOut,
    });
    this.opacity = new CurvedAnimation({
      parent: this.animation,
      curve: panelOpacityIn,
      reverseCurve: panelOpacityOut,
    });
    this.configureMotion();
    this.animation.addStatusListener((status) => {
      if (status === AnimationStatus.dismissed) {
        const closed = this.pendingClose;
        this.pendingClose = null;
        closed?.();
      }
      if (this.context instanceof Element && this.context.active) this.setState(() => {});
      this.widget.options.onAnimationStatusChanged?.(status);
    });
  }

  override didUpdateWidget(old: MenuAnchor): void {
    super.didUpdateWidget(old);
    if (
      old.options.animated !== this.widget.options.animated ||
      old.menuChildren.length !== this.widget.menuChildren.length
    )
      this.configureMotion();
  }

  private configureMotion(): void {
    const animated = this.widget.options.animated ?? false;
    this.animation.duration = animated ? openingDuration : 0;
    this.animation.reverseDuration = animated ? closingDuration : 0;
    for (const animation of this.itemAnimations) animation.dispose();
    const count = animated ? this.widget.menuChildren.length : 0;
    this.itemAnimations = Array.from({ length: count }, (_, index) => {
      const fraction = index / Math.max(1, count - 1);
      const forward = (1 - itemFadeIn) * fraction;
      const reverse = (1 - itemFadeOut - itemFadeOutDelay) * fraction;
      return new CurvedAnimation({
        parent: this.animation,
        curve: new Interval(forward, forward + itemFadeIn),
        reverseCurve: new Interval(reverse, reverse + itemFadeOut),
      });
    });
  }

  private readonly openRequested = (_position: Offset | null, show: () => void) => {
    if (this.parentMenu?.interactive === false) return;
    debugMenuInfo('Opening menu');
    const request = ++this.motionRequest;
    this.pendingClose = null;
    show();
    if (request === this.motionRequest && this.mounted && !this.animation.isForwardOrCompleted)
      this.animation.forward();
  };
  private readonly closeRequested = (hide: () => void) => {
    debugMenuInfo('Closing menu');
    ++this.motionRequest;
    this.pendingFocus = null;
    if (this.menuFocus.hasFocus && this.parentMenu?.interactive !== false)
      this.widget.options.childFocusNode?.requestFocus();
    if (this.animation.isDismissed) hide();
    else {
      this.pendingClose = hide;
      this.animation.reverse();
    }
  };

  openAndFocus(last = false): void {
    const target = last ? 'last' : 'first';
    if (this.controller.isOpen && this.animation.isForwardOrCompleted && this.focusEdge(target))
      return;
    this.pendingFocus = target;
    this.controller.open();
    this.scheduleFocus();
  }

  private focusEdge(target: 'first' | 'last'): boolean {
    const focusContext = this.menuFocus.context;
    if (!(focusContext instanceof Element && focusContext.active)) return false;
    const policy =
      FocusTraversalGroup.maybeOfNode(this.menuFocus) ?? new ReadingOrderTraversalPolicy();
    const focus =
      target === 'first'
        ? policy.findFirstFocus(this.menuFocus, { ignoreCurrentFocus: true })
        : policy.findLastFocus(this.menuFocus, { ignoreCurrentFocus: true });
    focus?.requestFocus();
    return focus !== null;
  }

  private scheduleFocus(): void {
    const context = this.context;
    if (this.pendingFocus === null || !(context instanceof Element)) return;
    context.owner.postFrame(() => {
      const target = this.pendingFocus;
      if (target && this.mounted && this.animation.isForwardOrCompleted && this.focusEdge(target))
        this.pendingFocus = null;
    });
  }

  private readonly handleMenuKey = (_node: FocusNode, event: KeyEvent): KeyEventResult => {
    if (!(event instanceof KeyDownEvent || event instanceof KeyRepeatEvent)) return 'ignored';
    const key = event.logicalKey;
    const keyboard = this.context instanceof Element ? this.context.owner.keyboard : null;
    if (
      keyboard?.isAltPressed ||
      keyboard?.isControlPressed ||
      keyboard?.isMetaPressed ||
      (keyboard?.isShiftPressed && !key.equals(LogicalKeyboardKey.tab))
    )
      return 'ignored';
    if (key.equals(LogicalKeyboardKey.escape)) {
      dismissMenu(this.controller);
      let root: MenuAnchorState = this;
      while (root.parentMenu?.anchor) root = root.parentMenu.anchor;
      root.widget.options.childFocusNode?.requestFocus();
      return 'handled';
    }
    if (key.equals(LogicalKeyboardKey.arrowDown))
      return this.menuFocus.nextFocus() ? 'handled' : 'ignored';
    if (key.equals(LogicalKeyboardKey.arrowUp))
      return this.menuFocus.previousFocus() ? 'handled' : 'ignored';
    if (key.equals(LogicalKeyboardKey.tab)) {
      const backwards = keyboard?.isShiftPressed ?? false;
      return (backwards ? this.menuFocus.previousFocus() : this.menuFocus.nextFocus())
        ? 'handled'
        : 'ignored';
    }
    const ltr = Directionality.maybeOf(this.context) !== 'rtl';
    const backward = key.equals(ltr ? LogicalKeyboardKey.arrowLeft : LogicalKeyboardKey.arrowRight);
    if (this.parentMenu?.vertical && backward) {
      this.controller.close();
      return 'handled';
    }
    const anchorFocus = this.widget.options.childFocusNode;
    if (
      this.parentMenu &&
      !this.parentMenu.vertical &&
      anchorFocus &&
      (backward || key.equals(ltr ? LogicalKeyboardKey.arrowRight : LogicalKeyboardKey.arrowLeft))
    ) {
      this.controller.close();
      anchorFocus.requestFocus();
      return (backward ? anchorFocus.previousFocus() : anchorFocus.nextFocus())
        ? 'handled'
        : 'ignored';
    }
    return 'ignored';
  };

  private readonly handleMenuFocusChange = (focused: boolean): void => {
    const { options } = this.widget;
    if (
      !focused &&
      options.closeOnFocusExit &&
      this.mounted &&
      this.context instanceof Element &&
      this.context.active &&
      this.menuIsOpeningOrOpen &&
      !options.childFocusNode?.hasPrimaryFocus
    )
      this.controller.close();
  };

  override build(): Widget {
    const { options } = this.widget;
    this.parentMenu = this.context.maybeDependOn(MenuOrientation);
    const anchor = new RawMenuAnchor({
      controller: this.controller,
      childFocusNode: options.childFocusNode ?? null,
      consumeOutsideTaps: options.consumeOutsideTap ?? false,
      useRootOverlay: options.useRootOverlay ?? false,
      onOpen: options.onOpen ?? null,
      onClose: options.onClose ?? null,
      onOpenRequested: this.openRequested,
      onCloseRequested: this.closeRequested,
      restoreFocusOnClose: false,
      builder: (context, controller, child) => {
        let anchor = options.builder?.(context, controller, child) ?? child ?? new SizedBox();
        if (options.anchorTapClosesMenu && controller.isOpen)
          anchor = new GestureDetector(anchor, {
            onTap: () => controller.close(),
            excludeFromSemantics: true,
          });
        return anchor;
      },
      child: options.child ?? null,
      overlayBuilder: this.buildPanel,
    });
    const scoped = new MenuAnchorScope(
      this,
      new Focus(anchor, {
        canRequestFocus: false,
        skipTraversal: true,
        includeSemantics: false,
        onKeyEvent: (_node, event) => {
          if (
            event instanceof KeyDownEvent &&
            event.logicalKey.equals(LogicalKeyboardKey.escape) &&
            this.controller.isOpen
          ) {
            dismissMenu(this.controller);
            return 'handled';
          }
          return 'ignored';
        },
      }),
    );
    return options.layerLink
      ? new CompositedTransformTarget(scoped, { link: options.layerLink })
      : scoped;
  }

  private readonly buildPanel = (context: BuildContext, info: RawMenuOverlayInfo): Widget => {
    this.scheduleFocus();
    const options = this.widget.options;
    const theme = Theme.of(context);
    const nested = this.parentMenu?.vertical ?? false;
    const menuTheme = MenuTheme.of(context).style;
    const themeStyle = nested
      ? menuTheme
      : (MenuBarTheme.of(context).style?.merge(menuTheme) ?? menuTheme);
    const style = options.style?.merge(themeStyle) ?? themeStyle ?? new MenuStyle();
    const states = emptyWidgetStateSet();
    const direction = Directionality.of(context);
    const media = MediaQuery.maybePaddingOf(context) ?? EdgeInsets.zero;
    const keyboard = MediaQuery.maybeViewInsetsOf(context) ?? EdgeInsets.zero;
    const outerInsets = media
      .add(keyboard)
      .add(options.reservedPadding ?? defaultEdgePadding)
      .resolve(direction);
    const avoided = MediaQuery.maybeDisplayFeaturesOf(context)?.length
      ? DisplayFeatureSubScreen.avoidBounds(MediaQuery.of(context))
      : [];
    const colors = theme.colorScheme;
    const shape = style.shape?.resolve(states) ?? defaultPanelShape;
    const side = style.side?.resolve(states);
    const density = style.visualDensity ?? theme.visualDensity;
    const extraPadding = Math.max(0, density.baseSizeAdjustment.dx);
    const padding = (
      style.padding?.resolve(states) ??
      (nested ? defaultPanelPadding : EdgeInsets.symmetric({ horizontal: barHorizontalPadding }))
    )
      .resolve(direction)
      .add(EdgeInsets.symmetric({ horizontal: extraPadding }));
    const minimum = style.minimumSize?.resolve(states);
    const maximum = style.maximumSize?.resolve(states);
    const fixed = style.fixedSize?.resolve(states);
    let limits = density.effectiveConstraints(
      new BoxConstraints(
        minimum?.width ?? 0,
        maximum?.width ?? Infinity,
        minimum?.height ?? 0,
        maximum?.height ?? Infinity,
      ),
    );
    if (fixed)
      limits = limits.tighten(
        Number.isFinite(fixed.width) ? fixed.width : null,
        Number.isFinite(fixed.height) ? fixed.height : null,
      );
    const layout = (factor: number) =>
      new MenuPanelLayout(
        info,
        style.alignment ??
          (nested ? AlignmentDirectional.topEnd : AlignmentDirectional.bottomStart),
        options.alignmentOffset ?? Offset.zero,
        direction,
        outerInsets,
        avoided,
        limits,
        options.minimumAnchorWidth === true && !(fixed && Number.isFinite(fixed.width)),
        nested,
        factor,
      );
    const children = options.menuChildren.map((child, index) => {
      const animation = this.itemAnimations[index];
      return animation
        ? new FadeTransition({ child, opacity: animation, alwaysIncludeSemantics: true })
        : child;
    });
    const list = new SingleBoxScrollView({
      child: new Column(children, { mainAxisSize: 'min', crossAxisAlignment: 'stretch' }),
      controller: this.scroll,
      primary: false,
      physics: new ClampingScrollPhysics(),
    });
    let content: Widget = new Padding(
      padding,
      new ScrollConfiguration({
        behavior: ScrollConfiguration.of(context).copyWith({
          scrollbars: false,
          overscroll: false,
        }),
        child: new Scrollbar({
          child: list,
          controller: this.scroll,
          thumbVisibility: this.animation.status === AnimationStatus.completed,
        }),
      }),
    );
    if (options.animated) {
      content = new ListenableBuilder({
        listenable: this.height,
        child: content,
        builder: (_context, child) =>
          new Align(child ?? undefined, {
            heightFactor: this.height.value,
            alignment: AlignmentDirectional.topStart,
            widthFactor: 1,
          }),
      });
    }
    let panel: Widget = new IntrinsicWidth(
      new Material({
        color: style.backgroundColor?.resolve(states) ?? new Color(colors.surfaceContainer),
        elevation: style.elevation?.resolve(states)?.value ?? 3,
        shadowColor: style.shadowColor?.resolve(states) ?? new Color(colors.shadow),
        surfaceTintColor: style.surfaceTintColor?.resolve(states) ?? transparent,
        shape: side ? shape.copyWith({ side }) : shape,
        clipBehavior: options.clipBehavior ?? 'hardEdge',
        child: content,
      }),
    );
    if (options.crossAxisUnconstrained !== false)
      panel = new UnconstrainedBox(panel, {
        constrainedAxis: 'vertical',
        alignment: AlignmentDirectional.centerStart,
        clipBehavior: 'hardEdge',
      });
    if (options.animated)
      panel = new FadeTransition({
        child: panel,
        opacity: this.opacity,
        alwaysIncludeSemantics: true,
      });
    const interactive = this.animation.isForwardOrCompleted;
    const cursor = WidgetStateMouseCursor.resolveWith(
      (states) => style.mouseCursor?.resolve(states) ?? MouseCursor.uncontrolled,
      { debugDescription: 'Menu cursor' },
    );
    panel = new MouseRegion(panel, { cursor, hitTestBehavior: 'deferToChild' });
    const region = new TapRegion(
      new FocusScope(
        new Shortcuts({
          shortcuts: gamepadActivation,
          child: new Semantics({
            container: true,
            explicitChildNodes: true,
            role: SemanticsRole.menu,
            child: new MenuOrientation(true, this.controller, this, interactive, panel),
          }),
        }),
        {
          node: this.menuFocus,
          autofocus: options.autofocusMenu ?? true,
          skipTraversal: true,
          includeSemantics: false,
          traversalEdgeBehavior: 'closedLoop',
          onKeyEvent: this.handleMenuKey,
          onFocusChange: this.handleMenuFocusChange,
        },
      ),
      { groupId: info.tapRegionGroupId, behavior: HitTestBehavior.opaque },
    );
    const guarded = new ShortcutRegistrar(
      new ExcludeSemantics({
        excluding: !interactive,
        child: new IgnorePointer(new ExcludeFocus(region, { excluding: !interactive }), {
          ignoring: !interactive,
        }),
      }),
    );
    const positioned = options.animated
      ? new ListenableBuilder({
          listenable: this.height,
          child: guarded,
          builder: (_context, child) =>
            new CustomSingleChildLayout(child ?? undefined, layout(this.height.value)),
        })
      : new CustomSingleChildLayout(guarded, layout(1));
    const linked = options.layerLink
      ? new CompositedTransformFollower(positioned, {
          link: options.layerLink,
          showWhenUnlinked: false,
          offset: new Offset(-info.anchorRect.left, -info.anchorRect.top),
        })
      : positioned;
    return style.visualDensity
      ? new Theme(theme.copyWith({ visualDensity: density }), linked)
      : linked;
  };

  override dispose(): void {
    for (const animation of this.itemAnimations) animation.dispose();
    this.height.dispose();
    this.opacity.dispose();
    this.animation.dispose();
    this.menuFocus.dispose();
    this.scroll.dispose();
    super.dispose();
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
  readonly shortcut?: MenuSerializableShortcut | null;
  readonly closeOnActivate?: boolean;
  readonly child?: Widget | null;
  /** @internal Accessible state supplied by the checkbox and radio menu variants. */
  readonly checkedState?: {
    readonly checked: boolean;
    readonly mixed?: boolean;
    readonly radio?: boolean;
  };
  /** @internal The arrow is laid out separately from the caller's trailing icon. */
  readonly submenuIndicator?: Widget | null;
  /** @internal Whether to transfer focus to a submenu instead of dismissing it. */
  readonly hasSubmenu?: boolean;
  /** @internal Exposed to the item's semantics while its submenu is opening or open. */
  readonly submenuExpanded?: boolean;
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
  private hovered = false;

  private readonly selectItem = () => {
    const { options, enabled } = this.widget;
    const context = this.context;
    const menu = context.maybeDependOn(MenuOrientation);
    if (!enabled || menu?.interactive === false) return;
    const controller = MenuController.maybeOf(context);
    const pressed = options.onPressed;
    debugMenuInfo('Selected menu item');
    if (controller && options.closeOnActivate !== false) {
      dismissMenu(controller);
      if (pressed && context instanceof Element) {
        context.owner.postFrame(pressed);
        return;
      }
    }
    pressed?.();
  };

  override build(context: BuildContext): Widget {
    const { options, enabled } = this.widget;
    const menu = context.maybeDependOn(MenuOrientation);
    const focus = options.focusNode ?? this.ownFocus;
    const interactive = enabled && menu?.interactive !== false;
    const buttonLabel = options.child
      ? new MenuAcceleratorCallbackBinding({
          child: options.child,
          onInvoke: interactive ? this.selectItem : null,
          hasSubmenu: options.hasSubmenu ?? false,
        })
      : null;
    const child = new MenuItemLabel(options, buttonLabel, menu?.vertical ?? null);
    const check = options.checkedState;
    let button: Widget = new MenuTextButton({
      child,
      style: options.style ?? null,
      focusNode: focus,
      autofocus: options.autofocus ?? false,
      ...(options.semanticsLabel == null ? {} : { semanticsLabel: options.semanticsLabel }),
      statesController: options.statesController ?? null,
      clipBehavior: options.clipBehavior ?? 'none',
      ...(menu
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
      onPressed: interactive ? this.selectItem : null,
      onFocusChange: (focused) => {
        if (!focused && !options.hasSubmenu && menu && context instanceof Element && context.active)
          menu.controller.closeChildren();
        options.onFocusChange?.(focused);
      },
    });
    if (options.hasSubmenu) {
      button = new Semantics({ expanded: options.submenuExpanded ?? false, child: button });
    }
    if (!options.onHover && options.requestFocusOnHover === false) return button;
    return new MouseRegion(button, {
      onHover: () => {
        if (this.hovered) return;
        this.hovered = true;
        options.onHover?.(true);
        if (!interactive || options.requestFocusOnHover === false) return;
        focus.requestFocus();
        if (focus.nearestScope)
          FocusTraversalGroup.maybeOfNode(focus)?.invalidateScopeData(focus.nearestScope);
        if (menu?.vertical && !options.hasSubmenu) menu.controller.closeChildren();
      },
      onExit: () => {
        if (!this.hovered) return;
        this.hovered = false;
        options.onHover?.(false);
      },
    });
  }
  override dispose(): void {
    this.ownFocus.dispose();
    super.dispose();
  }
}

class MenuItemLabel extends StatelessWidget {
  constructor(
    readonly options: MenuItemButtonOptions,
    readonly label: Widget | null,
    readonly vertical: boolean | null,
  ) {
    super();
  }

  override build(context: BuildContext): Widget {
    const { options, label, vertical } = this;
    const spacing = Math.max(
      minimumLabelSpacing,
      defaultLabelSpacing + Theme.of(context).visualDensity.horizontal * 2,
    );
    const padding = EdgeInsetsDirectional.only({ start: spacing });
    let heading = label && options.leadingIcon ? new Padding(padding, label) : label;
    if (heading && vertical) heading = new Expanded(new ClipRect(heading));
    const lead = new Row(
      [...(options.leadingIcon ? [options.leadingIcon] : []), ...(heading ? [heading] : [])],
      { mainAxisSize: 'min' },
    );
    const items: Widget[] = [vertical ? new Expanded(new ClipRect(lead)) : new Flexible(lead)];
    if (options.trailingIcon) items.push(new Padding(padding, options.trailingIcon));
    if (vertical !== false && options.shortcut) {
      items.push(
        new Padding(
          padding,
          new Text(menuShortcutLabel(options.shortcut, MaterialLocalizations.of(context))),
        ),
      );
    }
    if (vertical && options.submenuIndicator)
      items.push(new Padding(padding, options.submenuIndicator));
    return new Row(items, {
      mainAxisSize: vertical ? 'max' : 'min',
      mainAxisAlignment: 'spaceBetween',
    });
  }
}

class MenuTextButton extends TextButton {
  override defaultStyleOf(context: BuildContext): ButtonStyle {
    const theme = Theme.of(context);
    const density = theme.visualDensity;
    const foreground = new Color(theme.colorScheme.onSurface);
    const disabled = foreground.withOpacity(0.38);
    const inset = (value: number) =>
      EdgeInsets.symmetric({
        horizontal: Math.max(
          defaultEdgePadding.left,
          value + Math.min(0, density.baseSizeAdjustment.dx),
        ),
      });
    const textStyle = theme.textTheme.labelLarge;
    const textSize = textStyle?.fontSize ?? 14;
    const padding = ButtonStyleButton.scaledPadding(
      inset(defaultLabelSpacing),
      inset(8),
      inset(8),
      (MediaQuery.maybeTextScalerOf(context)?.scale(textSize) ?? textSize) / 14,
    );
    const style = TextButton.styleFrom({
      backgroundColor: transparent,
      elevation: 0,
      foregroundColor: foreground,
      disabledForegroundColor: disabled,
      iconColor: new Color(theme.colorScheme.onSurfaceVariant),
      disabledIconColor: disabled,
      iconSize: 24,
      textStyle,
      padding,
      minimumSize: new SourceSize(64, 48),
      maximumSize: SourceSize.infinite,
      alignment: AlignmentDirectional.centerStart,
      shape: defaultItemShape,
      visualDensity: density,
      tapTargetSize: theme.materialTapTargetSize,
      splashFactory: theme.splashFactory,
      animationDuration: kThemeChangeDuration,
      enableFeedback: true,
    });
    return style.copyWith({
      mouseCursor: WidgetStateMouseCursor.adaptiveClickable,
      overlayColor: colorProperty((states) => {
        if (states.contains(WidgetState.pressed) || states.contains(WidgetState.focused))
          return foreground.withOpacity(0.1);
        if (states.contains(WidgetState.hovered)) return foreground.withOpacity(0.08);
        return transparent;
      }),
    });
  }

  override themeStyleOf(context: BuildContext): ButtonStyle | null {
    return MenuButtonTheme.of(context).style;
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
  /** Time in milliseconds before hover or keyboard focus opens the submenu. */
  readonly hoverOpenDelay?: number;
}

export class SubmenuButton extends StatefulWidget {
  constructor(readonly options: SubmenuButtonOptions) {
    super(options.key ?? null);
  }
  override createState(): State<SubmenuButton> {
    return new SubmenuButtonState();
  }
}

class SubmenuButtonState extends State<SubmenuButton> {
  private readonly ownFocus = new FocusNode({ debugLabel: 'Material submenu button' });
  private hoverTimer: ReturnType<typeof scrollChromeTimer> | null = null;
  private hovered = false;
  private focused = false;
  private restoringFocus = false;

  private clearHoverTimer(): void {
    this.hoverTimer?.dispose();
    this.hoverTimer = null;
  }

  private scheduleOpen(anchor: MenuAnchorState, parent: MenuOrientation | undefined): void {
    this.clearHoverTimer();
    if (
      this.restoringFocus ||
      !this.widget.options.menuChildren.length ||
      parent?.interactive === false ||
      anchor.controller.isOpen ||
      anchor.menuIsOpeningOrOpen ||
      (!parent?.vertical && !parent?.controller.isOpen)
    )
      return;
    const open = () => {
      this.hoverTimer = null;
      if (
        this.mounted &&
        this.context instanceof Element &&
        this.context.active &&
        (this.hovered || this.focused) &&
        this.widget.options.menuChildren.length &&
        (parent?.vertical || parent?.controller.isOpen)
      )
        anchor.controller.open();
    };
    const delay = this.widget.options.hoverOpenDelay ?? 0;
    if (delay > 0) this.hoverTimer = scrollChromeTimer(delay, open);
    else open();
  }

  override build(context: BuildContext): Widget {
    const options = this.widget.options;
    const parent = context.maybeDependOn(MenuOrientation);
    const nested = parent?.vertical ?? false;
    const enabled = options.menuChildren.length > 0;
    const focus = options.focusNode ?? this.ownFocus;
    const states = emptyWidgetStateSet();
    if (!enabled) states.add(WidgetState.disabled);
    if (this.hovered) states.add(WidgetState.hovered);
    if (this.focused) states.add(WidgetState.focused);
    const direction = Directionality.maybeOf(context) ?? 'ltr';
    const ltr = direction === 'ltr';
    const menuTheme = MenuTheme.of(context);
    const indicator =
      options.submenuIcon?.resolve(states) ??
      menuTheme.submenuIcon?.resolve(states) ??
      new Icon(Icons.arrow_right, { size: defaultSubmenuIconSize, textDirection: direction });
    const padding = (
      options.menuStyle?.padding?.resolve(states) ??
      menuTheme.style?.padding?.resolve(states) ??
      defaultPanelPadding
    ).resolve(direction);
    const offset = options.alignmentOffset ?? Offset.zero;
    return new MenuAnchor({
      ...options,
      key: null,
      style: options.menuStyle ?? null,
      childFocusNode: focus,
      closeOnFocusExit: true,
      alignmentOffset: nested
        ? new Offset(offset.dx, offset.dy - padding.top)
        : new Offset(offset.dx - (ltr ? padding.left : padding.right), offset.dy),
      onClose: () => {
        this.clearHoverTimer();
        this.restoringFocus = true;
        if (this.context instanceof Element)
          this.context.owner.postFrame(() => {
            this.restoringFocus = false;
          });
        options.onClose?.();
      },
      builder: (anchorContext, controller) => {
        const anchor = anchorContext.maybeDependOn(MenuAnchorScope)?.anchor;
        const item = new MenuItemButton({
          ...options,
          key: null,
          focusNode: focus,
          submenuIndicator: nested ? indicator : null,
          hasSubmenu: true,
          submenuExpanded: enabled && (anchor?.menuIsOpeningOrOpen ?? controller.isOpen),
          closeOnActivate: false,
          requestFocusOnHover: false,
          onPressed: enabled
            ? () => {
                this.clearHoverTimer();
                if (anchor?.menuIsOpeningOrOpen ?? controller.isOpen) controller.close();
                else controller.open();
              }
            : null,
          onHover: (hovered) => {
            if (this.mounted)
              this.setState(() => {
                this.hovered = hovered;
              });
            options.onHover?.(hovered);
            if (!hovered) this.clearHoverTimer();
            else if (
              anchor &&
              enabled &&
              options.requestFocusOnHover !== false &&
              (nested || parent?.controller.isOpen)
            ) {
              focus.requestFocus();
              this.scheduleOpen(anchor, parent);
            }
          },
          onFocusChange: (focused) => {
            if (this.mounted)
              this.setState(() => {
                this.focused = focused;
              });
            options.onFocusChange?.(focused);
            if (!focused) {
              this.clearHoverTimer();
              if (anchor?.menuIsOpeningOrOpen && !anchor.menuHasFocus) controller.close();
            } else if (anchor) this.scheduleOpen(anchor, parent);
          },
        });
        return new Focus(item, {
          canRequestFocus: false,
          skipTraversal: true,
          includeSemantics: false,
          onKeyEvent: (_node, event) => {
            if (
              !(event instanceof KeyDownEvent || event instanceof KeyRepeatEvent) ||
              !anchor ||
              !enabled
            )
              return 'ignored';
            const key = event.logicalKey;
            const forward = key.equals(
              ltr ? LogicalKeyboardKey.arrowRight : LogicalKeyboardKey.arrowLeft,
            );
            const backward = key.equals(
              ltr ? LogicalKeyboardKey.arrowLeft : LogicalKeyboardKey.arrowRight,
            );
            if (nested && forward) {
              anchor.openAndFocus();
              return 'handled';
            }
            if (
              !nested &&
              (key.equals(LogicalKeyboardKey.arrowDown) || key.equals(LogicalKeyboardKey.arrowUp))
            ) {
              anchor.openAndFocus(key.equals(LogicalKeyboardKey.arrowUp));
              return 'handled';
            }
            if (parent && !nested && (forward || backward)) {
              return (forward ? focus.nextFocus() : focus.previousFocus()) ? 'handled' : 'ignored';
            }
            return 'ignored';
          },
        });
      },
    });
  }

  override deactivate(): void {
    this.clearHoverTimer();
    super.deactivate();
  }
  override dispose(): void {
    this.clearHoverTimer();
    this.ownFocus.dispose();
    super.dispose();
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
  private readonly focus = new FocusScopeNode({ debugLabel: 'Material menu bar focus' });
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
    const materialTheme = Theme.of(context);
    const colors = materialTheme.colorScheme;
    const menu = controller ?? this.owned;
    const shape = style?.shape?.resolve(states) ?? defaultPanelShape;
    const side = style?.side?.resolve(states);
    const density = style?.visualDensity ?? materialTheme.visualDensity;
    const padding =
      style?.padding?.resolve(states) ?? EdgeInsets.symmetric({ horizontal: barHorizontalPadding });
    const minimum = style?.minimumSize?.resolve(states);
    const maximum = style?.maximumSize?.resolve(states);
    const fixed = style?.fixedSize?.resolve(states);
    let limits = density.effectiveConstraints(
      new BoxConstraints(
        minimum?.width ?? 0,
        maximum?.width ?? Infinity,
        minimum?.height ?? 0,
        maximum?.height ?? Infinity,
      ),
    );
    if (fixed)
      limits = limits.tighten(
        Number.isFinite(fixed.width) ? fixed.width : null,
        Number.isFinite(fixed.height) ? fixed.height : null,
      );
    let panel: Widget = new Material({
      color: style?.backgroundColor?.resolve(states) ?? new Color(colors.surfaceContainer),
      elevation: style?.elevation?.resolve(states)?.value ?? 3,
      shadowColor: style?.shadowColor?.resolve(states) ?? new Color(colors.shadow),
      surfaceTintColor: style?.surfaceTintColor?.resolve(states) ?? transparent,
      shape: side ? shape.copyWith({ side }) : shape,
      clipBehavior,
      child: new FocusScope(
        new Shortcuts({
          shortcuts: gamepadActivation,
          child: new Semantics({
            container: true,
            explicitChildNodes: true,
            role: SemanticsRole.menuBar,
            child: new MenuOrientation(
              false,
              menu,
              null,
              true,
              new Padding(
                padding.add(
                  EdgeInsets.symmetric({ horizontal: Math.max(0, density.baseSizeAdjustment.dx) }),
                ),
                new IntrinsicHeight(
                  new SingleBoxScrollView({
                    child: new Row(children, { mainAxisSize: 'min' }),
                    scrollDirection: Axis.horizontal,
                    primary: false,
                    physics: new ClampingScrollPhysics(),
                  }),
                ),
              ),
            ),
          }),
        }),
        {
          node: this.focus,
          includeSemantics: false,
          traversalEdgeBehavior: 'closedLoop',
          onKeyEvent: (_node, event) => {
            if (
              event instanceof KeyDownEvent &&
              event.logicalKey.equals(LogicalKeyboardKey.escape) &&
              menu.isOpen
            ) {
              menu.close();
              return 'handled';
            }
            return 'ignored';
          },
        },
      ),
    });
    const cursor = style?.mouseCursor?.resolve(states);
    if (cursor) panel = new MouseRegion(panel, { cursor, hitTestBehavior: 'deferToChild' });
    if (style?.visualDensity)
      panel = new Theme(materialTheme.copyWith({ visualDensity: density }), panel);
    return new RawMenuAnchorGroup({
      controller: menu,
      child: new ConstrainedBox(panel, limits),
    });
  }
  override dispose(): void {
    this.focus.dispose();
    super.dispose();
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
