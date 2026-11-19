// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Flutter: packages/flutter/lib/src/material/dropdown.dart
// Revision: 71e4717a61786faab4c7aa39825989305ed29e8a
import { FoundationPlatform } from '@nelyx/core/foundation/platform';
import type { Animation } from '@nelyx/core/framework/animation/animation';
import { CurvedAnimation } from '@nelyx/core/framework/animation/animations';
import { Curves, Interval, Threshold } from '@nelyx/core/framework/animation/curves';
import { CurveTween } from '@nelyx/core/framework/animation/tween';
import { BorderRadius } from '@nelyx/core/framework/painting/border-radius';
import { BoxDecoration } from '@nelyx/core/framework/painting/box-decoration';
import type { BoxPainter } from '@nelyx/core/framework/painting/decoration';
import { EdgeInsets } from '@nelyx/core/framework/painting/edge-insets';
import { ImageConfiguration } from '@nelyx/core/framework/painting/image-configuration';
import type { TextStyle } from '@nelyx/core/framework/painting/text-style';
import { hashValues, valueEquals } from '@nelyx/core/framework/painting/value-equality';
import { BoxConstraints } from '@nelyx/core/framework/rendering/constraints';
import { CustomPainter } from '@nelyx/core/framework/rendering/custom-paint';
import { SingleChildLayoutDelegate } from '@nelyx/core/framework/rendering/custom-layout';
import { RenderBox } from '@nelyx/core/framework/rendering/object';
import { Directionality, MediaQuery } from '@nelyx/core/framework/widgets/app-data';
import { Padding, SizedBox } from '@nelyx/core/framework/widgets/basic';
import { ClipRRect } from '@nelyx/core/framework/widgets/clip';
import { CustomPaint } from '@nelyx/core/framework/widgets/custom-paint';
import { CustomSingleChildLayout } from '@nelyx/core/framework/widgets/custom-layout';
import { FocusHighlightMode } from '@nelyx/core/framework/widgets/focus';
import { Focus } from '@nelyx/core/framework/widgets/focus-scope';
import { Element, State, StatefulWidget } from '@nelyx/core/framework/widgets/framework';
import type { BuildContext, Widget } from '@nelyx/core/framework/widgets/framework';
import type { CapturedThemes } from '@nelyx/core/framework/widgets/inherited-theme';
import { LayoutBuilder } from '@nelyx/core/framework/widgets/layout-builder';
import type { NavigatorController } from '@nelyx/core/framework/widgets/navigation';
import { PageRoute } from '@nelyx/core/framework/widgets/pages';
import { ScrollConfiguration } from '@nelyx/core/framework/widgets/scroll-configuration';
import { ScrollController } from '@nelyx/core/framework/widgets/scroll-controller';
import { ClampingScrollPhysics } from '@nelyx/core/framework/widgets/scroll-physics';
import { ListView } from '@nelyx/core/framework/widgets/scroll-view';
import { RawScrollbar } from '@nelyx/core/framework/widgets/scrollbar';
import { Semantics } from '@nelyx/core/framework/widgets/semantics';
import { FadeTransition } from '@nelyx/core/framework/widgets/transitions';
import { LogicalKeyboardKey } from '@nelyx/core/services/keyboard-key';
import type { MouseCursor } from '@nelyx/core/services/mouse-cursor';
import type { Canvas } from '@nelyx/core/ui/canvas';
import type { Color } from '@nelyx/core/ui/color';
import type { Size } from '@nelyx/core/ui/geometry';
import { KeyDownEvent, KeyRepeatEvent } from '@nelyx/core/services/hardware-keyboard';
import { Offset } from '@nelyx/core/ui/offset';
import { Rect } from '@nelyx/core/ui/rect';
import { SemanticsRole } from '@nelyx/core/ui/semantics';
import type { TextDirection } from '@nelyx/core/ui/typography';
import { kMaterialListPadding, kMinInteractiveDimension } from '../constants.ts';
import type { DropdownMenuItem } from '../dropdown.ts';
import { Ink } from '../ink-decoration.ts';
import { InkWell } from '../ink-well.ts';
import { Material, MaterialType } from '../material.ts';
import { MaterialLocalizations } from '../material-localizations.ts';
import { kElevationToShadow } from '../shadows.ts';
import { Theme } from '../theme.ts';
import { MenuItemMeasure } from './menu-item-measure.ts';

const transitionDuration = 300;
const minimumItemHeight = kMinInteractiveDimension;
const menuItemPadding = EdgeInsets.symmetric({ horizontal: 16 });
const clamping = new ClampingScrollPhysics();
const menuRadius = BorderRadius.circular(2);
const growInterval = new Interval(0.25, 0.5);
const fadeInterval = new Interval(0, 0.25);
const reverseFadeInterval = new Interval(0.75, 1);
const visible = new Threshold(0);

interface MenuLimits {
  readonly top: number;
  readonly bottom: number;
  readonly height: number;
  readonly scrollOffset: number;
}

export class DropdownRouteResult<T> {
  constructor(readonly result: T | null) {}
  equals(other: unknown): boolean {
    return other instanceof DropdownRouteResult && valueEquals(this.result, other.result);
  }
  get hashCode(): number {
    return hashValues(this.result);
  }
}

export interface DropdownRouteOptions<T> {
  readonly navigator: NavigatorController;
  readonly anchor: RenderBox;
  readonly margin: EdgeInsets;
  readonly items: readonly DropdownMenuItem<T>[];
  readonly selectedIndex: number;
  readonly itemHeight: number | null;
  readonly menuWidth: number | null;
  readonly menuMaxHeight: number | null;
  readonly elevation: number;
  readonly color: Color | null;
  readonly theme: CapturedThemes;
  readonly textStyle: TextStyle;
  readonly borderRadius: BorderRadius | null;
  readonly barrierDismissible: boolean;
  readonly barrierLabel: string;
  readonly enableFeedback: boolean;
  readonly mouseCursor: MouseCursor | null;
}

export class DropdownRoute<T> extends PageRoute<DropdownRouteResult<T>> {
  readonly itemHeights: number[];
  private anchorRect = Rect.zero;
  private landscape: boolean | undefined;
  private dismissing = false;

  constructor(readonly options: DropdownRouteOptions<T>) {
    super({
      barrierDismissible: options.barrierDismissible,
      traversalEdgeBehavior: 'closedLoop',
      directionalTraversalEdgeBehavior: 'closedLoop',
    });
    this.itemHeights = options.items.map(() => options.itemHeight ?? minimumItemHeight);
  }
  override get opaque(): boolean {
    return false;
  }
  override get maintainState(): boolean {
    return true;
  }
  override get barrierColor(): null {
    return null;
  }
  override get barrierLabel(): string {
    return this.options.barrierLabel;
  }
  override get transitionDuration(): number {
    return transitionDuration;
  }
  override canTransitionTo(): boolean {
    return false;
  }
  override canTransitionFrom(): boolean {
    return false;
  }
  override buildTransitions(
    _context: BuildContext,
    _animation: Animation<number>,
    _secondary: Animation<number>,
    child: Widget,
  ): Widget {
    return child;
  }

  dismiss(): void {
    if (this.dismissing) return;
    this.dismissing = true;
    const context = this.navigatorContext;
    void Promise.resolve()
      .then(() => {
        if (this.options.navigator.isAttached) this.options.navigator.removeRoute(this);
      })
      .catch((error: unknown) => context?.services.reportError?.(error));
  }

  select(item: DropdownMenuItem<T>): void {
    if (!this.isCurrent || this.dismissing || !item.enabled) return;
    item.onTap?.();
    if (this.isCurrent && !this.dismissing)
      this.options.navigator.pop(new DropdownRouteResult(item.value));
  }

  itemOffset(index: number): number {
    let offset = kMaterialListPadding.top;
    for (let i = 0; i < index; ++i) offset += this.itemHeights[i]!;
    return offset;
  }

  maxHeight(height: number): number {
    return Math.max(
      0,
      Math.min(height - 2 * minimumItemHeight, this.options.menuMaxHeight ?? Infinity),
    );
  }

  menuLimits(button: Rect, height: number, index: number, menuHeight?: number): MenuLimits {
    const selectedHeight = this.itemHeights[this.options.selectedIndex]!;
    const itemOffset = this.itemOffset(index);
    const preferredHeight = this.itemOffset(this.itemHeights.length) + kMaterialListPadding.bottom;
    const maximumHeight = this.maxHeight(height);
    const visibleHeight = Math.min(maximumHeight, menuHeight ?? preferredHeight);
    const buttonBottom = Math.min(height, button.bottom);
    const topLimit = Math.min(minimumItemHeight, button.top);
    const bottomLimit = Math.max(height - minimumItemHeight, buttonBottom);
    let top = button.top - itemOffset - (selectedHeight - button.height) / 2;
    let bottom = top + visibleHeight;
    if (top < topLimit) {
      top = topLimit;
      bottom = top + visibleHeight;
    }
    if (bottom > bottomLimit) {
      bottom = bottomLimit;
      top = bottom - visibleHeight;
    }
    const minimumBottom = buttonBottom - button.height / 2 + selectedHeight / 2;
    if (bottom < minimumBottom) {
      bottom = minimumBottom;
      top = bottom - visibleHeight;
    }
    top = Math.min(Math.max(0, top), Math.max(0, height - visibleHeight));
    bottom = top + visibleHeight;
    const scrollOffset =
      preferredHeight <= maximumHeight
        ? 0
        : Math.min(Math.max(0, itemOffset - (button.top - top)), preferredHeight - visibleHeight);
    return { top, bottom, height: visibleHeight, scrollOffset };
  }

  override buildPage(context: BuildContext, animation: Animation<number>): Widget {
    const anchor = this.options.anchor;
    if (anchor.attached && anchor.hasSize && this.anchorRect.isEmpty) {
      const parent = this.navigatorContext?.findRenderObject();
      const ancestor =
        parent?.attached && parent.owner === anchor.owner ? { ancestor: parent } : {};
      const topLeft = anchor.localToGlobal(Offset.zero, ancestor);
      const bottomRight = anchor.localToGlobal(
        new Offset(anchor.size.width, anchor.size.height),
        ancestor,
      );
      this.anchorRect = this.options.margin.inflateRect(Rect.fromPoints(topLeft, bottomRight));
    }
    const button = this.anchorRect;
    const direction = Directionality.of(context);
    return MediaQuery.removePadding({
      context,
      removeTop: true,
      removeBottom: true,
      removeLeft: true,
      removeRight: true,
      child: new LayoutBuilder((_context, constraints) => {
        const size = constraints.biggest;
        const landscape = size.width > size.height;
        this.landscape ??= landscape;
        if (landscape !== this.landscape) this.dismiss();
        if (this.dismissing) return new SizedBox();
        return new CustomSingleChildLayout(
          this.options.theme.wrap(new DropdownRoutePage(this, animation, button, size.height)),
          new DropdownRouteLayout(this, button, direction),
        );
      }),
    });
  }
}

class DropdownRouteLayout<T> extends SingleChildLayoutDelegate {
  constructor(
    readonly route: DropdownRoute<T>,
    readonly button: Rect,
    readonly direction: TextDirection,
  ) {
    super();
  }
  override getConstraintsForChild(outer: BoxConstraints): BoxConstraints {
    const width = Math.min(outer.maxWidth, this.route.options.menuWidth ?? this.button.width);
    return new BoxConstraints(width, width, 0, this.route.maxHeight(outer.maxHeight));
  }
  override getPositionForChild(size: Size, child: Size): Offset {
    const x = this.direction === 'rtl' ? this.button.right - child.width : this.button.left;
    const top = this.route.menuLimits(
      this.button,
      size.height,
      this.route.options.selectedIndex,
      child.height,
    ).top;
    return new Offset(Math.max(0, Math.min(x, size.width - child.width)), top);
  }
  override shouldRelayout(old: SingleChildLayoutDelegate): boolean {
    return (
      !(old instanceof DropdownRouteLayout) ||
      this.route !== old.route ||
      !this.button.equals(old.button) ||
      this.direction !== old.direction
    );
  }
}

class DropdownMenuPainter<T> extends CustomPainter {
  private readonly brush: BoxPainter;
  constructor(
    readonly color: Color,
    readonly route: DropdownRoute<T>,
    readonly resize: Animation<number>,
  ) {
    super({ repaint: resize });
    this.brush = new BoxDecoration({
      color: color.toARGB32(),
      borderRadius: route.options.borderRadius ?? menuRadius,
      boxShadow: kElevationToShadow.get(route.options.elevation) ?? null,
    }).createBoxPainter();
  }
  override paint(canvas: Canvas, size: Size): void {
    const start = Math.max(
      0,
      Math.min(
        this.route.itemOffset(this.route.options.selectedIndex),
        size.height - minimumItemHeight,
      ),
    );
    const end = Math.min(size.height, start + minimumItemHeight);
    const resize = this.resize.value;
    const top = start * (1 - resize);
    const bottom = end + (size.height - end) * resize;
    this.brush.paint(
      canvas,
      new Offset(0, top),
      new ImageConfiguration({
        size: { width: size.width, height: bottom - top },
      }),
    );
  }
  override shouldRepaint(old: CustomPainter): boolean {
    return old !== this;
  }
  dispose(): void {
    this.brush.dispose();
  }
}

class DropdownRoutePage<T> extends StatefulWidget {
  constructor(
    readonly route: DropdownRoute<T>,
    readonly animation: Animation<number>,
    readonly button: Rect,
    readonly height: number,
  ) {
    super();
  }
  override createState(): State<DropdownRoutePage<T>> {
    return new DropdownRoutePageState();
  }
}

class DropdownRoutePageState<T> extends State<DropdownRoutePage<T>> {
  private controller!: ScrollController;
  private fade!: CurvedAnimation;
  private resize!: CurvedAnimation;
  private itemOpacities: readonly Animation<number>[] = [];
  private painter: DropdownMenuPainter<T> | null = null;

  override initState(): void {
    super.initState();
    const { route, animation, button, height } = this.widget;
    const { selectedIndex, items } = route.options;
    this.controller = new ScrollController({
      initialScrollOffset: route.menuLimits(button, height, selectedIndex).scrollOffset,
      keepScrollOffset: false,
    });
    this.fade = new CurvedAnimation({
      parent: animation,
      curve: fadeInterval,
      reverseCurve: reverseFadeInterval,
    });
    this.resize = new CurvedAnimation({
      parent: animation,
      curve: growInterval,
      reverseCurve: visible,
    });
    const unit = 0.5 / (items.length + 1.5);
    this.itemOpacities = items.map((_item, index) => {
      const start = Math.min(1, 0.5 + (index + 1) * unit);
      const end = Math.min(1, start + 1.5 * unit);
      return animation.drive(
        new CurveTween({ curve: index === selectedIndex ? visible : new Interval(start, end) }),
      );
    });
  }

  private buildItem(
    item: DropdownMenuItem<T>,
    index: number,
    touchMode: boolean,
    focusColor: Color,
  ): Widget {
    const { route, button, height } = this.widget;
    const { selectedIndex, itemHeight, mouseCursor, enableFeedback } = route.options;
    const selected = index === selectedIndex;
    let child: Widget = new MenuItemMeasure(new Padding(menuItemPadding, item), (size) => {
      route.itemHeights[index] = itemHeight ?? size.height;
    });
    if (itemHeight !== null) child = new SizedBox(undefined, itemHeight, child);
    if (item.enabled) {
      child = new InkWell({
        autofocus: selected,
        mouseCursor,
        enableFeedback,
        onTap: () => route.select(item),
        onFocusChange: (focused) => {
          const context = this.context;
          if (
            !focused ||
            !this.controller.hasClients ||
            !this.controller.position.hasContentDimensions ||
            (context instanceof Element &&
              context.owner.focus.highlightMode === FocusHighlightMode.touch)
          )
            return;
          const offset = route.menuLimits(button, height, index).scrollOffset;
          const target = Math.min(offset, this.controller.position.maxScrollExtent);
          if (target !== this.controller.offset)
            void this.controller.animateTo(target, {
              duration: 100,
              curve: Curves.easeInOut,
            });
        },
        child: touchMode && selected ? new Ink({ color: focusColor, child }) : child,
      });
    }
    return new Semantics({
      role: SemanticsRole.menuItem,
      selected,
      enabled: item.enabled,
      child: new FadeTransition({ opacity: this.itemOpacities[index]!, child }),
    });
  }

  override build(context: BuildContext): Widget {
    const { route } = this.widget;
    const theme = Theme.of(context);
    const color = route.options.color ?? theme.canvasColor;
    if (!this.painter || !valueEquals(this.painter.color, color)) {
      this.painter?.dispose();
      this.painter = new DropdownMenuPainter(color, route, this.resize);
    }
    const touchMode =
      context instanceof Element && context.owner.focus.highlightMode === FocusHighlightMode.touch;
    const list = new ListView({
      controller: this.controller,
      primary: false,
      shrinkWrap: true,
      padding: kMaterialListPadding,
      itemExtent: route.options.itemHeight,
      physics: clamping,
      children: route.options.items.map((item, index) =>
        this.buildItem(item, index, touchMode, theme.focusColor),
      ),
    });
    let body: Widget = new ScrollConfiguration({
      behavior: ScrollConfiguration.of(context).copyWith({
        scrollbars: false,
        overscroll: false,
        physics: clamping,
        platform: theme.platform,
      }),
      child: new RawScrollbar({ controller: this.controller, thumbVisibility: true, child: list }),
    });
    if (FoundationPlatform.isWeb) {
      body = new Focus(body, {
        canRequestFocus: false,
        skipTraversal: true,
        includeSemantics: false,
        onKeyEvent: (_node, event) => {
          if (
            !(event instanceof KeyDownEvent || event instanceof KeyRepeatEvent) ||
            !(context instanceof Element)
          )
            return 'ignored';
          const direction = event.logicalKey.equals(LogicalKeyboardKey.arrowUp)
            ? 'up'
            : event.logicalKey.equals(LogicalKeyboardKey.arrowDown)
              ? 'down'
              : null;
          return direction && context.owner.focus.primaryFocus?.focusInDirection(direction)
            ? 'handled'
            : 'ignored';
        },
      });
    }
    const child = new Semantics({
      role: SemanticsRole.menu,
      scopesRoute: true,
      namesRoute: true,
      explicitChildNodes: true,
      label: MaterialLocalizations.of(context).popupMenuLabel,
      child: new ClipRRect(
        new Material({
          type: MaterialType.transparency,
          textStyle: route.options.textStyle,
          child: body,
        }),
        {
          borderRadius: route.options.borderRadius ?? BorderRadius.zero,
          clipBehavior: route.options.borderRadius ? 'antiAlias' : 'none',
        },
      ),
    });
    return new FadeTransition({
      opacity: this.fade,
      child: new CustomPaint(child, { painter: this.painter }),
    });
  }
  override dispose(): void {
    this.painter?.dispose();
    this.fade.dispose();
    this.resize.dispose();
    this.controller.dispose();
    super.dispose();
  }
}
