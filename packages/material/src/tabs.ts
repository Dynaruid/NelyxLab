// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
import { invariant } from '@nelyx/core/foundation/errors';
import type { DartSet } from '@nelyx/core/foundation/dart-collections';
import { Listenable } from '@nelyx/core/foundation/notifier';
import type { Animation } from '@nelyx/core/framework/animation/animation';
import { Curves } from '@nelyx/core/framework/animation/curves';
import { DragStartBehavior } from '@nelyx/core/framework/gestures/recognizer';
import { Alignment, AlignmentDirectional } from '@nelyx/core/framework/painting/alignment';
import { Axis } from '@nelyx/core/framework/painting/basic-types';
import { BorderRadius } from '@nelyx/core/framework/painting/border-radius';
import { BorderSide } from '@nelyx/core/framework/painting/borders';
import type { BorderStyle } from '@nelyx/core/framework/painting/borders';
import { Border } from '@nelyx/core/framework/painting/box-border';
import { BoxDecoration } from '@nelyx/core/framework/painting/box-decoration';
import type { BoxPainter } from '@nelyx/core/framework/painting/decoration';
import { EdgeInsets, EdgeInsetsDirectional } from '@nelyx/core/framework/painting/edge-insets';
import type { EdgeInsetsGeometry } from '@nelyx/core/framework/painting/edge-insets';
import { TextStyle } from '@nelyx/core/framework/painting/text-style';
import { BoxConstraints } from '@nelyx/core/framework/rendering/constraints';
import { CustomPainter } from '@nelyx/core/framework/rendering/custom-paint';
import { RenderBox } from '@nelyx/core/framework/rendering/object';
import { Directionality, MediaQuery } from '@nelyx/core/framework/widgets/app-data';
import {
  Align,
  Center,
  ColoredBox,
  Column,
  ConstrainedBox,
  DecoratedBox,
  Expanded,
  KeyedSubtree,
  Padding,
  Positioned,
  Row,
  SizedBox,
  SliverPadding,
  SliverToBoxAdapter,
  Stack,
  Text,
} from '@nelyx/core/framework/widgets/basic';
import { CustomPaint } from '@nelyx/core/framework/widgets/custom-paint';
import { DefaultTextStyle } from '@nelyx/core/framework/widgets/default-text-style';
import { State, StatefulWidget, StatelessWidget } from '@nelyx/core/framework/widgets/framework';
import type {
  BuildContext,
  Element,
  Widget,
  WidgetOptions,
} from '@nelyx/core/framework/widgets/framework';
import { GlobalKey } from '@nelyx/core/framework/widgets/global-key';
import { IconTheme } from '@nelyx/core/framework/widgets/icon-theme';
import { IconThemeData } from '@nelyx/core/framework/widgets/icon-theme-data';
import { createLocalImageConfiguration } from '@nelyx/core/framework/widgets/image';
import { LayoutBuilder } from '@nelyx/core/framework/widgets/layout-builder';
import { ListenableBuilder } from '@nelyx/core/framework/widgets/listenable-builder';
import { NotificationListener } from '@nelyx/core/framework/widgets/notification-listener';
import { PageController, PageMetrics, PageView } from '@nelyx/core/framework/widgets/page-view';
import type { PreferredSizeWidget } from '@nelyx/core/framework/widgets/preferred-size';
import { ScrollConfiguration } from '@nelyx/core/framework/widgets/scroll-configuration';
import { ScrollController } from '@nelyx/core/framework/widgets/scroll-controller';
import {
  ScrollEndNotification,
  ScrollNotification,
  ScrollUpdateNotification,
} from '@nelyx/core/framework/widgets/scroll-notification';
import { ClampingScrollPhysics } from '@nelyx/core/framework/widgets/scroll-physics';
import type { ScrollPhysics } from '@nelyx/core/framework/widgets/scroll-physics';
import { CustomScrollView } from '@nelyx/core/framework/widgets/scroll-view';
import { Semantics } from '@nelyx/core/framework/widgets/semantics';
import {
  WidgetState,
  WidgetStateProperty,
  emptyWidgetStateSet,
} from '@nelyx/core/framework/widgets/widget-state';
import {
  captureSourceMouseCursor,
  sourceMouseCursorType,
} from '@nelyx/core/framework/widgets/widget-state-mouse-cursor';
import { lerpDouble } from '@nelyx/core/internal/ui/lerp-double.generated';
import { SystemMouseCursors } from '@nelyx/core/services/mouse-cursor';
import type { MouseCursor } from '@nelyx/core/services/mouse-cursor';
import type { Canvas } from '@nelyx/core/ui/canvas';
import type { Clip } from '@nelyx/core/ui/clip';
import { Color } from '@nelyx/core/ui/color';
import type { Size } from '@nelyx/core/ui/geometry';
import { clampDouble } from '@nelyx/core/ui/math';
import { Radius } from '@nelyx/core/ui/radius';
import { Rect } from '@nelyx/core/ui/rect';
import { SemanticsRole } from '@nelyx/core/ui/semantics';
import { InkWell } from './ink-well.ts';
import { kTabLabelPadding } from './constants.ts';
import { colorProperty } from './internal/button/style-properties.ts';
import { Material, MaterialType } from './material.ts';
import { MaterialLocalizations } from './material-localizations.ts';
import { TabAlignment } from './tab-alignment.ts';
import { TabBarIndicatorSize } from './tab-bar-indicator-size.ts';
import { TabBarTheme } from './tab-bar-theme.ts';
import type { TabBarThemeDataOptions } from './tab-bar-theme-data.ts';
import { DefaultTabController } from './tab-controller.ts';
import type { TabController } from './tab-controller.ts';
import { UnderlineTabIndicator } from './tab-indicator.ts';
import { TabIndicatorAnimation } from './tab-indicator-animation.ts';
import { Theme } from './theme.ts';

export { TabAlignment, TabBarIndicatorSize, TabIndicatorAnimation };

const tabHeight = 46;
const textAndIconHeight = 72;
const iconMargin = EdgeInsets.fromLTRB(0, 0, 0, 2);
const scrollStartPadding = EdgeInsetsDirectional.fromSTEB(52, 0, 0, 0);
const clampingPhysics = new ClampingScrollPhysics();

export interface TabOptions extends WidgetOptions {
  readonly text?: string | null;
  readonly icon?: Widget | null;
  readonly iconMargin?: EdgeInsetsGeometry | null;
  readonly height?: number | null;
  readonly child?: Widget | null;
}

export class Tab extends StatelessWidget implements PreferredSizeWidget {
  readonly text: string | null;
  readonly icon: Widget | null;
  readonly iconMargin: EdgeInsetsGeometry | null;
  readonly height: number | null;
  readonly child: Widget | null;

  constructor({
    text = null,
    icon = null,
    iconMargin = null,
    height = null,
    child = null,
    key = null,
  }: TabOptions) {
    super(key);
    invariant(
      (text !== null || icon !== null || child !== null) && (text === null || child === null),
      'invalid-tab-label',
      'Tab requires text, child or icon and text and child are mutually exclusive',
    );
    this.text = text;
    this.icon = icon;
    this.iconMargin = iconMargin;
    this.height = height;
    this.child = child;
  }

  get preferredSize(): Size {
    return {
      width: Infinity,
      height:
        this.height ??
        (this.icon && (this.text !== null || this.child) ? textAndIconHeight : tabHeight),
    };
  }

  override build(): Widget {
    const label =
      this.child ??
      (this.text === null ? null : new Text(this.text, { softWrap: false, overflow: 'fade' }));
    const content =
      this.icon && label
        ? new Column([new Padding(this.iconMargin ?? iconMargin, this.icon), label], {
            mainAxisAlignment: 'center',
          })
        : (this.icon ?? label)!;
    return new SizedBox(
      undefined,
      this.preferredSize.height,
      new Center(content, { widthFactor: 1 }),
    );
  }
}

export type TabValueChanged<T> = (value: T, index: number) => void;

export interface TabBarOptions extends WidgetOptions, Omit<TabBarThemeDataOptions, 'mouseCursor'> {
  readonly tabs: readonly Widget[];
  readonly controller?: TabController | null;
  readonly scrollController?: ScrollController | null;
  readonly isScrollable?: boolean;
  readonly padding?: EdgeInsetsGeometry | null;
  readonly automaticIndicatorColorAdjustment?: boolean;
  readonly indicatorWeight?: number;
  readonly indicatorPadding?: EdgeInsetsGeometry;
  readonly dragStartBehavior?: DragStartBehavior;
  readonly mouseCursor?: MouseCursor | WidgetStateProperty<MouseCursor | null> | null;
  readonly enableFeedback?: boolean | null;
  readonly onTap?: ((index: number) => void) | null;
  readonly onHover?: TabValueChanged<boolean> | null;
  readonly onFocusChange?: TabValueChanged<boolean> | null;
  readonly physics?: ScrollPhysics | null;
}

export class TabBar extends StatefulWidget implements PreferredSizeWidget {
  readonly options: Readonly<TabBarOptions>;
  readonly indicatorWeight: number;
  readonly tabs: readonly Widget[];
  readonly controller: TabController | null;
  readonly isScrollable: boolean;

  constructor(
    options: TabBarOptions,
    readonly primary = true,
  ) {
    super(options.key ?? null);
    this.indicatorWeight = options.indicatorWeight ?? 2;
    invariant(
      options.indicator || this.indicatorWeight > 0,
      'invalid-tab-indicator-weight',
      'Tab indicator weight must be positive',
    );
    this.tabs = Object.freeze([...options.tabs]);
    this.controller = options.controller ?? null;
    this.isScrollable = options.isScrollable ?? false;
    this.options = Object.freeze({ ...options, tabs: this.tabs });
  }

  static secondary(options: TabBarOptions): TabBar {
    return new TabBar(options, false);
  }

  get preferredSize(): Size {
    let height = tabHeight;
    for (const tab of this.tabs) {
      if ('preferredSize' in tab)
        height = Math.max(height, (tab as PreferredSizeWidget).preferredSize.height);
    }
    return { width: Infinity, height: height + this.indicatorWeight };
  }

  override createState(): State<TabBar> {
    return new TabBarState();
  }
}

interface TabGeometry {
  readonly tab: GlobalKey;
  readonly label: GlobalKey;
}

function selectionFraction(controller: TabController, index: number): number {
  const value = controller.animation!.value;
  if (!controller.indexIsChanging) return clampDouble(1 - Math.abs(index - value), 0, 1);
  const distance = Math.abs(controller.index - controller.previousIndex);
  if (distance === 0) return index === controller.index ? 1 : 0;
  const remaining = clampDouble(Math.abs(controller.index - value) / distance, 0, 1);
  if (index === controller.index) return 1 - remaining;
  return index === controller.previousIndex ? remaining : 0;
}

class TabBarState extends State<TabBar> {
  private owner: TabController | null = null;
  private animation: Animation<number> | null = null;
  private listenable: Listenable | null = null;
  private readonly scroller = new ScrollController();
  private readonly paintKey = new GlobalKey('TabBar indicator');
  private readonly geometries: TabGeometry[] = [];
  private indicator: BoxPainter | null = null;
  private centeredIndex: number | null = null;
  private centeredScroller: ScrollController | null = null;

  override build(context: BuildContext): Widget {
    const { options, controller, tabs, isScrollable, primary, indicatorWeight } = this.widget;
    const owner = controller ?? DefaultTabController.of(context);
    invariant(
      owner.length === tabs.length,
      'tab-count-mismatch',
      'TabBar requires one tab for each controller index',
    );
    const animation = owner.animation;
    invariant(animation, 'disposed-tab-controller', 'TabBar requires a live TabController');
    if (owner !== this.owner || animation !== this.animation) {
      this.owner = owner;
      this.animation = animation;
      this.listenable = Listenable.merge([owner, animation]);
      this.centeredIndex = null;
    }
    if (tabs.length === 0) return new SizedBox(Infinity, this.widget.preferredSize.height);
    this.geometries.length = Math.min(this.geometries.length, tabs.length);
    while (this.geometries.length < tabs.length)
      this.geometries.push({ tab: new GlobalKey(), label: new GlobalKey() });

    const theme = Theme.of(context);
    const colors = theme.colorScheme;
    const local = TabBarTheme.of(context);
    const direction = Directionality.of(context);
    const alignment =
      options.tabAlignment ??
      local.tabAlignment ??
      (isScrollable ? TabAlignment.startOffset : TabAlignment.fill);
    invariant(
      isScrollable
        ? alignment !== TabAlignment.fill
        : alignment === TabAlignment.fill || alignment === TabAlignment.center,
      'invalid-tab-alignment',
      'TabBar alignment must match whether tabs can scroll',
    );
    const underlineSize =
      options.indicatorSize ??
      local.indicatorSize ??
      (primary ? TabBarIndicatorSize.label : TabBarIndicatorSize.tab);
    const rounded = primary && underlineSize === TabBarIndicatorSize.label;
    const indicatorColor =
      options.indicatorColor ?? local.indicatorColor ?? new Color(colors.primary);
    const materialColor = Material.maybeOf(context)?.color;
    const weight = Math.max(indicatorWeight, rounded ? 3 : 2);
    const underline =
      options.indicator ??
      local.indicator ??
      new UnderlineTabIndicator({
        borderSide: new BorderSide({
          width: weight,
          color: (options.automaticIndicatorColorAdjustment !== false &&
          materialColor?.equals(indicatorColor)
            ? new Color(0xffffffff)
            : indicatorColor
          ).toARGB32(),
        }),
        borderRadius: rounded
          ? new BorderRadius({
              topLeft: Radius.circular(weight),
              topRight: Radius.circular(weight),
            })
          : null,
      });
    this.indicator?.dispose();
    this.indicator = underline.createBoxPainter(() =>
      this.paintKey.currentContext?.findRenderObject()?.markNeedsPaint(),
    );
    const underlinePadding = (options.indicatorPadding ?? EdgeInsets.zero).resolve(direction);
    const underlineAnimation =
      options.indicatorAnimation ??
      local.indicatorAnimation ??
      (rounded ? TabIndicatorAnimation.elastic : TabIndicatorAnimation.linear);
    const configuration = createLocalImageConfiguration(context);
    const geometries = [...this.geometries];
    const painter = new TabIndicatorPainter(
      animation,
      this.indicator,
      (size, index) => {
        const anchor =
          underlineSize === TabBarIndicatorSize.label
            ? geometries[index]?.label
            : geometries[index]?.tab;
        const tab = anchor?.currentContext?.findRenderObject();
        const strip = this.paintKey.currentContext?.findRenderObject();
        if (!(tab instanceof RenderBox) || !tab.hasSize || !tab.attached || !strip?.attached)
          return null;
        const start = tab.localToGlobal({ x: 0, y: 0 }, { ancestor: strip });
        invariant(
          tab.size.width >= underlinePadding.horizontal && size.height >= underlinePadding.vertical,
          'invalid-tab-indicator-padding',
          'Tab indicator padding must fit its tab',
        );
        return underlinePadding.deflateRect(Rect.fromLTWH(start.x, 0, tab.size.width, size.height));
      },
      owner,
      underlineAnimation,
      configuration,
    );

    const selectedStyle = (
      options.labelStyle ??
      local.labelStyle ??
      theme.textTheme.titleSmall ??
      new TextStyle()
    ).copyWith({
      color:
        options.labelColor?.toARGB32() ??
        local.labelColor?.toARGB32() ??
        options.labelStyle?.color ??
        local.labelStyle?.color ??
        (primary ? colors.primary : colors.onSurface),
    });
    const unselectedStyle = (
      options.unselectedLabelStyle ??
      local.unselectedLabelStyle ??
      options.labelStyle ??
      local.labelStyle ??
      theme.textTheme.titleSmall ??
      new TextStyle()
    ).copyWith({
      color:
        options.unselectedLabelColor?.toARGB32() ??
        local.unselectedLabelColor?.toARGB32() ??
        options.unselectedLabelStyle?.color ??
        local.unselectedLabelStyle?.color ??
        options.labelColor?.toARGB32() ??
        local.labelColor?.toARGB32() ??
        colors.onSurfaceVariant,
    });
    const padding = options.labelPadding ?? local.labelPadding ?? kTabLabelPadding;
    const scrollController = options.scrollController ?? this.scroller;
    const strip = new ListenableBuilder(this.listenable!, (context) => {
      const fill = alignment === TabAlignment.fill;
      const height = this.widget.preferredSize.height;
      const buttons = tabs.map((tab, index) => {
        const selected = owner.index === index;
        const style = TextStyle.lerp(
          unselectedStyle,
          selectedStyle,
          selectionFraction(owner, index),
        )!;
        const select = () => {
          owner.animateTo(index);
          options.onTap?.(index);
        };
        const overlay = options.overlayColor ?? local.overlayColor;
        const cursor = options.mouseCursor ?? local.mouseCursor;
        const statesFor = (states: DartSet<WidgetState>) => {
          if (!selected || states.contains(WidgetState.selected)) return states;
          const result = emptyWidgetStateSet();
          result.addAll(states);
          result.add(WidgetState.selected);
          return result;
        };
        const label = new Center(
          new DefaultTextStyle(
            style,
            IconTheme.merge({
              data: new IconThemeData({
                color: style.color === null ? null : new Color(style.color),
              }),
              child: tab,
            }),
          ),
          { widthFactor: 1, key: geometries[index]!.label },
        );
        const ink = new InkWell({
          key: geometries[index]!.tab,
          onTap: select,
          onHover: (hovered) => options.onHover?.(hovered, index),
          onFocusChange: (focused) => options.onFocusChange?.(focused, index),
          enableFeedback: options.enableFeedback ?? true,
          excludeFromSemantics: true,
          borderRadius: options.splashBorderRadius ?? local.splashBorderRadius,
          splashFactory: options.splashFactory ?? local.splashFactory ?? theme.splashFactory,
          mouseCursor:
            cursor instanceof WidgetStateProperty
              ? WidgetStateProperty.resolveWith(sourceMouseCursorType, (states) =>
                  captureSourceMouseCursor(
                    cursor.resolve(statesFor(states)) ?? SystemMouseCursors.click,
                  ),
                )
              : cursor,
          overlayColor: colorProperty((states) => {
            if (overlay) return overlay.resolve(statesFor(states));
            if (states.contains(WidgetState.pressed))
              return new Color(
                selected && !primary ? colors.onSurface : colors.primary,
              ).withOpacity(0.1);
            if (states.contains(WidgetState.hovered))
              return new Color(selected && primary ? colors.primary : colors.onSurface).withOpacity(
                0.08,
              );
            if (states.contains(WidgetState.focused))
              return new Color(selected && primary ? colors.primary : colors.onSurface).withOpacity(
                0.1,
              );
            return null;
          }),
          child: new Padding(
            EdgeInsets.fromLTRB(0, 0, 0, indicatorWeight),
            new Padding(padding, label),
          ),
        });
        const button = new Semantics({
          container: true,
          role: SemanticsRole.tab,
          button: true,
          enabled: true,
          selected,
          onTap: select,
          child: ink,
        });
        return fill ? new Expanded(button) : button;
      });
      const row = new CustomPaint(
        new Row(buttons, { mainAxisSize: fill ? 'max' : 'min', crossAxisAlignment: 'stretch' }),
        { foregroundPainter: painter, key: this.paintKey },
      );
      const tabList = new Semantics({
        role: SemanticsRole.tabBar,
        container: true,
        explicitChildNodes: true,
        child: row,
      });
      let contents: Widget = new Align(tabList, { heightFactor: 1 });
      if (isScrollable) {
        const outerPadding = options.padding ?? EdgeInsets.zero;
        const insets =
          alignment === TabAlignment.startOffset
            ? outerPadding.add(scrollStartPadding)
            : outerPadding;
        contents = new LayoutBuilder((context, constraints) => {
          const minimum =
            alignment === TabAlignment.center
              ? Math.max(0, constraints.maxWidth - insets.resolve(direction).horizontal)
              : 0;
          return new CustomScrollView({
            scrollDirection: Axis.horizontal,
            controller: scrollController,
            primary: false,
            physics: options.physics ?? null,
            dragStartBehavior: options.dragStartBehavior ?? DragStartBehavior.start,
            scrollBehavior: ScrollConfiguration.of(context).copyWith({
              overscroll: false,
              scrollbars: false,
            }),
            slivers: [
              new SliverPadding({
                padding: insets,
                sliver: new SliverToBoxAdapter({
                  child: new ConstrainedBox(
                    new Align(tabList, {
                      alignment:
                        alignment === TabAlignment.center
                          ? Alignment.center
                          : AlignmentDirectional.centerStart,
                    }),
                    new BoxConstraints(minimum),
                  ),
                }),
              }),
            ],
          });
        });
        this.centerSelection(scrollController, owner, geometries);
      } else if (options.padding) {
        contents = new Padding(options.padding, contents);
      }
      const dividerHeight = options.dividerHeight ?? local.dividerHeight ?? 1;
      return new SizedBox(
        Infinity,
        height,
        new Stack([
          new Positioned(
            new ColoredBox({
              color:
                options.dividerColor?.toARGB32() ??
                local.dividerColor?.toARGB32() ??
                colors.outlineVariant,
            }),
            { left: 0, right: 0, bottom: 0, height: dividerHeight },
          ),
          new Positioned(contents, { left: 0, right: 0, top: 0, bottom: 0 }),
        ]),
      );
    });
    const scaler = options.textScaler ?? local.textScaler;
    return new Material({
      type: MaterialType.transparency,
      child: scaler
        ? new MediaQuery({ ...MediaQuery.of(context), textScaler: scaler }, strip)
        : strip,
    });
  }

  private centerSelection(
    scroller: ScrollController,
    owner: TabController,
    geometries: readonly TabGeometry[],
  ): void {
    const index = owner.index;
    if (this.centeredScroller === scroller && this.centeredIndex === index) return;
    this.centeredScroller = scroller;
    this.centeredIndex = index;
    const duration = owner.indexIsChanging ? owner.animationDuration : 0;
    (this.context as Element).owner.postFrame(() => {
      if (
        !this.mounted ||
        this.centeredScroller !== scroller ||
        this.centeredIndex !== index ||
        !scroller.hasClients
      )
        return;
      const render = geometries[index]?.tab.currentContext?.findRenderObject();
      if (render?.attached && scroller.position.hasContentDimensions)
        void scroller.position.ensureVisible(render, {
          alignment: 0.5,
          duration,
          curve: Curves.ease,
        });
    });
  }

  override dispose(): void {
    this.indicator?.dispose();
    this.scroller.dispose();
    super.dispose();
  }
}

class TabIndicatorPainter extends CustomPainter {
  constructor(
    readonly animation: Animation<number>,
    readonly indicator: BoxPainter,
    readonly rectFor: (size: Size, index: number) => Rect | null,
    readonly controller: TabController,
    readonly effect: TabIndicatorAnimation,
    readonly configuration: ReturnType<typeof createLocalImageConfiguration>,
  ) {
    super({ repaint: animation });
  }

  override paint(canvas: Canvas, size: Size): void {
    const { controller, configuration } = this;
    const value = clampDouble(this.animation.value, 0, controller.length - 1);
    const elastic = this.effect === TabIndicatorAnimation.elastic;
    const changing = controller.indexIsChanging && value !== controller.index;
    const fromIndex = elastic && changing ? controller.previousIndex : Math.floor(value);
    const toIndex = elastic && changing ? controller.index : Math.ceil(value);
    const from = this.rectFor(size, fromIndex);
    const to = this.rectFor(size, toIndex);
    if (!from || !to) return;
    let rect = Rect.lerp(from, to, value - Math.floor(value))!;
    if (elastic && fromIndex !== toIndex) {
      const selectionMovesBackward = !changing && value < controller.index;
      const begin = selectionMovesBackward ? to : from;
      const end = selectionMovesBackward ? from : to;
      const progress = changing
        ? clampDouble(1 - Math.abs(value - toIndex) / Math.abs(fromIndex - toIndex), 0, 1)
        : Math.abs(value - controller.index);
      const slow = 1 - Math.cos((progress * Math.PI) / 2);
      const fast = Math.sin((progress * Math.PI) / 2);
      const movesRight = end.left > begin.left;
      rect = Rect.fromLTRB(
        lerpDouble(begin.left, end.left, movesRight ? slow : fast)!,
        begin.top,
        lerpDouble(begin.right, end.right, movesRight ? fast : slow)!,
        begin.bottom,
      );
    }
    this.indicator.paint(canvas, rect.topLeft, configuration.copyWith({ size: rect.size }));
  }

  override shouldRepaint(): boolean {
    return true;
  }
  override shouldRebuildSemantics(): boolean {
    return false;
  }
}

export interface TabBarViewOptions extends WidgetOptions {
  readonly children: readonly Widget[];
  readonly controller?: TabController | null;
  readonly physics?: ScrollPhysics | null;
  readonly dragStartBehavior?: DragStartBehavior;
  readonly viewportFraction?: number;
  readonly clipBehavior?: Clip;
}

export class TabBarView extends StatefulWidget {
  readonly children: readonly Widget[];
  readonly controller: TabController | null;
  readonly physics: ScrollPhysics | null;
  readonly dragStartBehavior: DragStartBehavior;
  readonly viewportFraction: number;
  readonly clipBehavior: Clip;

  constructor({
    children,
    controller = null,
    physics = null,
    dragStartBehavior = DragStartBehavior.start,
    viewportFraction = 1,
    clipBehavior = 'hardEdge',
    key = null,
  }: TabBarViewOptions) {
    super(key);
    invariant(
      Number.isFinite(viewportFraction) && viewportFraction > 0,
      'invalid-tab-viewport-fraction',
      'Tab view requires a positive finite viewport fraction',
    );
    this.children = children;
    this.controller = controller;
    this.physics = physics;
    this.dragStartBehavior = dragStartBehavior;
    this.viewportFraction = viewportFraction;
    this.clipBehavior = clipBehavior;
  }

  override createState(): State<TabBarView> {
    return new TabBarViewState();
  }
}

class TabBarViewState extends State<TabBarView> {
  private controller: TabController | null = null;
  private pages: PageController | null = null;
  private widgets: readonly Widget[] = [];
  private sourceChildren: readonly Widget[] | null = null;
  private warp: { readonly children: readonly Widget[] } | null = null;
  private selectedIndex = 0;
  private driving = false;

  override didChangeDependencies(): void {
    super.didChangeDependencies();
    this.updateController();
  }

  override didUpdateWidget(old: TabBarView): void {
    super.didUpdateWidget(old);
    this.updateController();
  }

  private updateController(): void {
    const controller = this.widget.controller ?? DefaultTabController.of(this.context);
    if (controller !== this.controller) {
      this.controller?.removeListener(this.selectionChanged);
      this.controller = controller;
      this.selectedIndex = controller.index;
      controller.addListener(this.selectionChanged);
      this.warp = null;
      const existing = this.pages;
      if (existing)
        (this.context as Element).owner.postFrame(() => {
          if (
            !this.mounted ||
            this.pages !== existing ||
            this.controller !== controller ||
            !existing.hasClients ||
            !controller.length ||
            this.warp
          )
            return;
          this.driving = true;
          try {
            existing.jumpToPage(controller.index);
          } finally {
            this.driving = false;
          }
        });
    }
    if (this.pages?.viewportFraction !== this.widget.viewportFraction) {
      const previous = this.pages;
      this.warp = null;
      this.pages = new PageController({
        initialPage: this.selectedIndex,
        viewportFraction: this.widget.viewportFraction,
      });
      if (previous) (this.context as Element).owner.postFrame(() => previous.dispose());
    }
  }

  private readonly selectionChanged = (): void => {
    const controller = this.controller!;
    const pages = this.pages!;
    if (this.driving || this.selectedIndex === controller.index) return;
    const target = controller.index;
    this.selectedIndex = target;
    if (!pages.hasClients) return;
    const from = Math.max(
      0,
      Math.min(this.widgets.length - 1, Math.round(pages.page ?? controller.previousIndex)),
    );
    const duration = controller.indexIsChanging ? controller.animationDuration : 0;
    const adjacent = target > from ? target - 1 : target + 1;
    const widgets = [...this.widgets];
    const active = { children: widgets };
    const swap = duration > 0 && Math.abs(target - from) > 1 && adjacent < widgets.length;
    if (swap) [widgets[adjacent], widgets[from]] = [widgets[from]!, widgets[adjacent]!];
    this.setState(() => {
      this.warp = active;
    });
    const move = () => {
      if (!this.mounted || this.warp !== active || this.pages !== pages || !pages.hasClients)
        return;
      if (swap) pages.jumpToPage(adjacent);
      if (duration === 0) {
        pages.jumpToPage(target);
        this.setState(() => {
          this.warp = null;
        });
        return;
      }
      void pages.animateToPage(target, { duration, curve: Curves.ease }).finally(() => {
        if (this.mounted && this.warp === active)
          this.setState(() => {
            this.warp = null;
          });
      });
    };
    if (swap) (this.context as Element).owner.postFrame(move);
    else move();
  };

  private readonly handleScroll = (notification: ScrollNotification): boolean => {
    const controller = this.controller!;
    if (
      this.warp ||
      this.driving ||
      notification.depth !== 0 ||
      !controller.length ||
      !(notification.metrics instanceof PageMetrics)
    )
      return false;
    const page = notification.metrics.page;
    if (page === null || controller.indexIsChanging || !controller.animation) return false;
    if (
      !(
        notification instanceof ScrollUpdateNotification ||
        notification instanceof ScrollEndNotification
      )
    )
      return false;
    this.driving = true;
    try {
      if (notification instanceof ScrollEndNotification || Math.abs(page - controller.index) > 1) {
        controller.index = clampDouble(Math.round(page), 0, controller.length - 1);
        this.selectedIndex = controller.index;
      }
      controller.offset = clampDouble(page - controller.index, -1, 1);
    } finally {
      this.driving = false;
    }
    return false;
  };

  override build(): Widget {
    const { children, physics, dragStartBehavior, clipBehavior } = this.widget;
    invariant(
      this.controller!.length === children.length,
      'tab-page-count-mismatch',
      'TabBarView requires one page for each controller index',
    );
    if (children !== this.sourceChildren) {
      this.sourceChildren = children;
      this.widgets = children.map(
        (child, index) =>
          new Semantics({
            key: KeyedSubtree.wrap(child, index).key,
            role: SemanticsRole.tabPanel,
            child,
          }),
      );
    }
    return new NotificationListener({
      notificationType: ScrollNotification,
      onNotification: this.handleScroll,
      child: new PageView({
        controller: this.pages!,
        children: this.warp?.children ?? this.widgets,
        physics: physics ?? clampingPhysics,
        dragStartBehavior,
        clipBehavior,
      }),
    });
  }

  override dispose(): void {
    this.controller?.removeListener(this.selectionChanged);
    this.pages?.dispose();
    this.warp = null;
    super.dispose();
  }
}

export interface TabPageSelectorIndicatorOptions extends WidgetOptions {
  readonly backgroundColor: Color;
  readonly borderColor: Color;
  readonly size: number;
  readonly borderStyle?: BorderStyle;
}

export class TabPageSelectorIndicator extends StatelessWidget {
  readonly backgroundColor: Color;
  readonly borderColor: Color;
  readonly size: number;
  readonly borderStyle: BorderStyle;

  constructor({
    backgroundColor,
    borderColor,
    size,
    borderStyle = 'solid',
    key = null,
  }: TabPageSelectorIndicatorOptions) {
    super(key);
    this.backgroundColor = backgroundColor;
    this.borderColor = borderColor;
    this.size = size;
    this.borderStyle = borderStyle;
  }

  override build(): Widget {
    return new Padding(
      EdgeInsets.all(4),
      SizedBox.square(
        this.size,
        new DecoratedBox(undefined, {
          decoration: new BoxDecoration({
            color: this.backgroundColor.toARGB32(),
            border: Border.all({ color: this.borderColor.toARGB32(), style: this.borderStyle }),
            shape: 'circle',
          }),
        }),
      ),
    );
  }
}

export interface TabPageSelectorOptions extends WidgetOptions {
  readonly controller?: TabController | null;
  readonly indicatorSize?: number;
  readonly color?: Color | null;
  readonly selectedColor?: Color | null;
  readonly borderStyle?: BorderStyle | null;
}

export class TabPageSelector extends StatelessWidget {
  readonly controller: TabController | null;
  readonly indicatorSize: number;
  readonly color: Color | null;
  readonly selectedColor: Color | null;
  readonly borderStyle: BorderStyle | null;

  constructor({
    controller = null,
    indicatorSize = 12,
    color = null,
    selectedColor = null,
    borderStyle = null,
    key = null,
  }: TabPageSelectorOptions = {}) {
    super(key);
    invariant(
      Number.isFinite(indicatorSize) && indicatorSize > 0,
      'invalid-tab-selector-size',
      'Tab page indicator size must be positive',
    );
    this.controller = controller;
    this.indicatorSize = indicatorSize;
    this.color = color;
    this.selectedColor = selectedColor;
    this.borderStyle = borderStyle;
  }

  override build(context: BuildContext): Widget {
    const controller = this.controller ?? DefaultTabController.of(context);
    const animation = controller.animation;
    invariant(
      animation,
      'disposed-tab-controller',
      'TabPageSelector requires a live TabController',
    );
    const localizations = MaterialLocalizations.of(context);
    const base = this.color ?? new Color(0);
    const selected = this.selectedColor ?? new Color(Theme.of(context).colorScheme.secondary);
    return new ListenableBuilder(
      Listenable.merge([controller, animation]),
      () =>
        new Semantics({
          label:
            controller.length > 0
              ? localizations.tabLabel({
                  tabIndex: controller.index + 1,
                  tabCount: controller.length,
                })
              : null,
          child: new Row(
            Array.from(
              { length: controller.length },
              (_, index) =>
                new TabPageSelectorIndicator({
                  backgroundColor: Color.lerp(
                    base,
                    selected,
                    Curves.fastOutSlowIn.transform(selectionFraction(controller, index)),
                  )!,
                  borderColor: selected,
                  size: this.indicatorSize,
                  borderStyle: this.borderStyle ?? 'solid',
                }),
            ),
            { mainAxisSize: 'min' },
          ),
        }),
    );
  }
}
