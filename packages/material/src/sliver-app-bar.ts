// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Flutter: packages/flutter/lib/src/material/app_bar.dart @ 71e4717a61786faab4c7aa39825989305ed29e8a
import { invariant } from '@nelyx/core/foundation/errors';
import { Cubic } from '@nelyx/core/framework/animation/curves';
import { EdgeInsets } from '@nelyx/core/framework/painting/edge-insets';
import { BoxConstraints } from '@nelyx/core/framework/rendering/constraints';
import {
  RenderCustomSingleChildLayoutBox,
  SingleChildLayoutDelegate,
} from '@nelyx/core/framework/rendering/custom-layout';
import { RenderSliverPersistentHeader } from '@nelyx/core/framework/rendering/sliver-persistent-header';
import type {
  FloatingHeaderSnapConfiguration,
  OverScrollHeaderStretchConfiguration,
} from '@nelyx/core/framework/rendering/sliver-persistent-header';
import { ScrollDirection } from '@nelyx/core/framework/rendering/viewport-offset';
import { Directionality, MediaQuery } from '@nelyx/core/framework/widgets/app-data';
import { Column, Flexible, SizedBox } from '@nelyx/core/framework/widgets/basic';
import { ClipRect } from '@nelyx/core/framework/widgets/clip';
import { CustomSingleChildLayout } from '@nelyx/core/framework/widgets/custom-layout';
import { DefaultTextStyle } from '@nelyx/core/framework/widgets/default-text-style';
import { ExcludeFocus } from '@nelyx/core/framework/widgets/focus-scope';
import { Element, StatefulWidget, StatelessWidget } from '@nelyx/core/framework/widgets/framework';
import type { BuildContext, State, Widget } from '@nelyx/core/framework/widgets/framework';
import { GlobalKey } from '@nelyx/core/framework/widgets/global-key';
import { AnimatedOpacity } from '@nelyx/core/framework/widgets/implicit-animations';
import { IgnorePointer } from '@nelyx/core/framework/widgets/pointer-blocking';
import type { ScrollPosition } from '@nelyx/core/framework/widgets/scroll-position';
import { Scrollable } from '@nelyx/core/framework/widgets/scrollable';
import { ExcludeSemantics, Semantics } from '@nelyx/core/framework/widgets/semantics';
import {
  SliverPersistentHeader,
  SliverPersistentHeaderDelegate,
} from '@nelyx/core/framework/widgets/sliver-persistent-header';
import { TickerProviderStateMixin } from '@nelyx/core/framework/widgets/ticker-provider';
import { tickerScheduler } from '@nelyx/core/internal/framework/widgets/ticker-scheduler';
import type { Offset, Size } from '@nelyx/core/ui/geometry';
import { AppBar, type AppBarOptions } from './app-bar.ts';
import { AppBarTheme } from './app-bar-theme.ts';
import { kToolbarHeight } from './constants.ts';
import { FlexibleSpaceBar, FlexibleSpaceBarSettings } from './flexible-space-bar.ts';
import { Theme } from './theme.ts';

export interface SliverAppBarOptions extends Omit<
  AppBarOptions,
  'toolbarHeight' | 'toolbarOpacity' | 'bottomOpacity' | 'animateColor' | 'notificationPredicate'
> {
  readonly toolbarHeight?: number;
  readonly collapsedHeight?: number | null;
  readonly expandedHeight?: number | null;
  readonly pinned?: boolean;
  readonly floating?: boolean;
  readonly snap?: boolean;
  readonly stretch?: boolean;
  readonly stretchTriggerOffset?: number;
  readonly onStretchTrigger?: (() => void | Promise<void>) | null;
  readonly forceElevated?: boolean;
}

type SliverAppVariant = 'small' | 'medium' | 'large';
interface ScrollUnderFlexibleConfig {
  readonly collapsedHeight: number;
  readonly expandedHeight: number;
  readonly titleBottomPadding: number;
  readonly expandedStyle: 'headlineSmall' | 'headlineMedium';
}

const mediumConfig: ScrollUnderFlexibleConfig = {
  collapsedHeight: 64,
  expandedHeight: 112,
  titleBottomPadding: 20,
  expandedStyle: 'headlineSmall',
};
const largeConfig: ScrollUnderFlexibleConfig = {
  collapsedHeight: 64,
  expandedHeight: 152,
  titleBottomPadding: 28,
  expandedStyle: 'headlineMedium',
};
const titleCurve = new Cubic(0.2, 0, 0, 1);

export class SliverAppBar extends StatefulWidget {
  readonly options: Readonly<SliverAppBarOptions>;
  private sizeVariant: SliverAppVariant = 'small';

  constructor(options: SliverAppBarOptions = {}) {
    super(options.key ?? null);
    const toolbarHeight = options.toolbarHeight ?? kToolbarHeight;
    invariant(
      !options.snap || options.floating,
      'sliver-app-bar-snap',
      'Snap requires a floating app bar',
    );
    invariant(
      Number.isFinite(toolbarHeight) &&
        toolbarHeight >= 0 &&
        (options.collapsedHeight == null ||
          (Number.isFinite(options.collapsedHeight) && options.collapsedHeight >= toolbarHeight)) &&
        (options.expandedHeight == null ||
          (Number.isFinite(options.expandedHeight) && options.expandedHeight >= 0)),
      'sliver-app-bar-extents',
      'SliverAppBar requires finite extents and a collapsed height at least as high as the toolbar',
    );
    const triggerOffset = options.stretchTriggerOffset ?? 100;
    invariant(
      Number.isFinite(triggerOffset) && triggerOffset > 0,
      'sliver-app-bar-stretch-offset',
      'Stretch must have a positive trigger offset',
    );
    this.options = Object.freeze({
      ...options,
      actions: options.actions ? Object.freeze([...options.actions]) : (options.actions ?? null),
      toolbarHeight,
      stretchTriggerOffset: triggerOffset,
    });
  }

  static medium(options: SliverAppBarOptions = {}): SliverAppBar {
    const bar = new SliverAppBar({
      ...options,
      pinned: options.pinned ?? true,
      toolbarHeight: options.toolbarHeight ?? mediumConfig.collapsedHeight,
    });
    bar.sizeVariant = 'medium';
    return bar;
  }

  static large(options: SliverAppBarOptions = {}): SliverAppBar {
    const bar = new SliverAppBar({
      ...options,
      pinned: options.pinned ?? true,
      toolbarHeight: options.toolbarHeight ?? largeConfig.collapsedHeight,
    });
    bar.sizeVariant = 'large';
    return bar;
  }

  /** @internal App bar layout variant. */
  get variant(): SliverAppVariant {
    return this.sizeVariant;
  }

  override createState(): State<SliverAppBar> {
    return new SliverAppBarState();
  }
}

class SliverAppBarState extends TickerProviderStateMixin<SliverAppBar> {
  private readonly headerKey = new GlobalKey('SliverAppBar header');
  private position: ScrollPosition | null = null;
  private activityVersion = 0;
  private readonly snapSettings: FloatingHeaderSnapConfiguration = { vsync: this };

  private get header(): RenderSliverPersistentHeader | null {
    const context = this.headerKey.currentContext;
    const render = context instanceof Element && context.active ? context.findRenderObject() : null;
    return render instanceof RenderSliverPersistentHeader ? render : null;
  }

  private readonly onScrollActivity = () => {
    const position = this.position;
    if (!position) return;
    const version = ++this.activityVersion;
    if (position.isScrollingNotifier.value) {
      this.header?.stopFloatingSnap();
      return;
    }
    const direction = position.userScrollDirection;
    if (direction === ScrollDirection.idle) return;
    // Pointer-wheel scrolling can start and end before the next layout pass.
    tickerScheduler(this.context).addPostFrame(() => {
      if (this.activityVersion === version && this.mounted && !position.isScrollingNotifier.value)
        this.header?.startFloatingSnap(direction);
    });
  };

  private listenTo(position: ScrollPosition | null): void {
    if (this.position === position) return;
    ++this.activityVersion;
    this.position?.isScrollingNotifier.removeListener(this.onScrollActivity);
    this.position = position;
    position?.isScrollingNotifier.addListener(this.onScrollActivity);
  }

  override deactivate(): void {
    this.listenTo(null);
    super.deactivate();
  }

  override dispose(): void {
    this.listenTo(null);
    super.dispose();
  }

  override build(context: BuildContext): Widget {
    const { options, variant } = this.widget;
    const media = MediaQuery.of(context);
    this.listenTo(options.snap ? (Scrollable.maybeOf(context)?.position ?? null) : null);
    const child = new SliverPersistentHeader({
      key: this.headerKey,
      pinned: options.pinned ?? false,
      floating: options.floating ?? false,
      delegate: new SliverAppBarDelegate(
        options,
        variant,
        options.primary === false ? 0 : MediaQuery.paddingOf(context).top,
        media.accessibleNavigation ?? false,
        options.snap ? this.snapSettings : null,
      ),
    });
    return MediaQuery.removePadding({ context, removeBottom: true, child });
  }
}

class SliverAppBarDelegate extends SliverPersistentHeaderDelegate {
  readonly minExtent: number;
  readonly maxExtent: number;
  private readonly bottomHeight: number;
  private readonly toolbarHeight: number;
  private readonly flexibleSpace: Widget | null;
  private readonly stretch: OverScrollHeaderStretchConfiguration | null;

  constructor(
    private readonly options: Readonly<SliverAppBarOptions>,
    private readonly variant: SliverAppVariant,
    private readonly topPadding: number,
    private readonly accessibleNavigation: boolean,
    private readonly snap: FloatingHeaderSnapConfiguration | null,
  ) {
    super();
    const config = variant === 'medium' ? mediumConfig : variant === 'large' ? largeConfig : null;
    const bottomHeight = options.bottom?.preferredSize.height ?? 0;
    this.bottomHeight = bottomHeight;
    this.toolbarHeight = options.toolbarHeight ?? kToolbarHeight;
    const floatsAboveBottom = options.pinned && options.floating && options.bottom != null;
    this.minExtent = config
      ? (options.collapsedHeight ?? topPadding + config.collapsedHeight + bottomHeight)
      : topPadding +
        bottomHeight +
        (options.collapsedHeight ?? (floatsAboveBottom ? 0 : this.toolbarHeight));
    this.maxExtent = Math.max(
      this.minExtent,
      topPadding +
        (options.expandedHeight ?? (config?.expandedHeight ?? this.toolbarHeight) + bottomHeight),
    );
    this.flexibleSpace =
      options.flexibleSpace ??
      (config ? new ExpandedAppBarTitle(options, config, bottomHeight) : null);
    this.stretch = options.stretch
      ? {
          stretchTriggerOffset: options.stretchTriggerOffset ?? 100,
          onStretchTrigger: options.onStretchTrigger ?? null,
        }
      : null;
  }

  override get snapConfiguration(): FloatingHeaderSnapConfiguration | null {
    return this.snap;
  }

  override get stretchConfiguration(): OverScrollHeaderStretchConfiguration | null {
    return this.stretch;
  }

  override build(_context: BuildContext, shrinkOffset: number, overlapsContent: boolean): Widget {
    const options = this.options;
    const visibleHeight = this.maxExtent - shrinkOffset - this.topPadding;
    const extraToolbarHeight = Math.max(
      0,
      this.minExtent - this.bottomHeight - this.topPadding - this.toolbarHeight,
    );
    const scrolledUnder =
      overlapsContent ||
      options.forceElevated === true ||
      (options.pinned === true && shrinkOffset > this.maxExtent - this.minExtent);
    const pinnedFade =
      options.pinned && options.floating && options.bottom != null && extraToolbarHeight === 0;
    const toolbarOpacity =
      !this.accessibleNavigation && (!options.pinned || pinnedFade) && this.toolbarHeight > 0
        ? fraction((visibleHeight - this.bottomHeight - extraToolbarHeight) / this.toolbarHeight)
        : 1;
    let title = options.title ?? null;
    if (title && this.variant !== 'small') {
      title = new ExcludeFocus(
        new IgnorePointer(
          new AnimatedOpacity({
            child: title,
            opacity: scrolledUnder ? 1 : 0,
            duration: 500,
            curve: titleCurve,
          }),
          { ignoring: !scrolledUnder },
        ),
        { excluding: !scrolledUnder },
      );
    }
    const flexibleSpace =
      this.flexibleSpace && !title && !options.excludeHeaderSemantics
        ? new Semantics({ child: this.flexibleSpace, header: true })
        : this.flexibleSpace;
    const opacity =
      options.pinned || this.bottomHeight === 0 ? 1 : fraction(visibleHeight / this.bottomHeight);
    return FlexibleSpaceBar.createSettings({
      minExtent: this.minExtent,
      maxExtent: this.maxExtent,
      currentExtent: Math.max(this.minExtent, this.maxExtent - shrinkOffset),
      toolbarOpacity,
      isScrolledUnder: scrolledUnder,
      hasLeading: options.leading != null || (options.automaticallyImplyLeading ?? true),
      child: new AppBar({
        ...options,
        key: null,
        title,
        flexibleSpace,
        elevation: scrolledUnder ? (options.elevation ?? null) : 0,
        toolbarHeight: this.toolbarHeight,
        toolbarOpacity,
        bottomOpacity: opacity,
      }),
    });
  }

  override shouldRebuild(old: SliverPersistentHeaderDelegate): boolean {
    return (
      !(old instanceof SliverAppBarDelegate) ||
      this.options !== old.options ||
      this.variant !== old.variant ||
      this.topPadding !== old.topPadding ||
      this.accessibleNavigation !== old.accessibleNavigation ||
      this.snap !== old.snap
    );
  }
}

function fraction(value: number): number {
  return Math.max(0, Math.min(1, value));
}

class ExpandedAppBarTitle extends StatelessWidget {
  constructor(
    private readonly options: Readonly<SliverAppBarOptions>,
    private readonly config: ScrollUnderFlexibleConfig,
    private readonly bottomHeight: number,
  ) {
    super();
  }

  override build(context: BuildContext): Widget {
    const settings = context.dependOn(FlexibleSpaceBarSettings);
    const theme = Theme.of(context);
    const appTheme = AppBarTheme.of(context);
    const foreground = this.options.foregroundColor ?? appTheme.foregroundColor;
    const expandedStyle =
      this.options.titleTextStyle ??
      appTheme.titleTextStyle ??
      theme.textTheme[this.config.expandedStyle]?.copyWith({
        color: foreground?.toARGB32() ?? theme.colorScheme.onSurface,
      });
    const title = this.options.title;
    if (!title) return SizedBox.shrink();
    const styled = expandedStyle ? new DefaultTextStyle(expandedStyle, title) : title;
    const visible = settings.currentExtent > settings.minExtent;
    const padding = EdgeInsets.fromLTRB(
      16,
      0,
      16,
      this.bottomHeight === 0 ? this.config.titleBottomPadding : 0,
    );
    const layout = new ExpandedTitleLayout(
      padding,
      Directionality.of(context),
      settings.maxExtent - settings.minExtent,
    );
    return MediaQuery.withClampedTextScaling({
      maxScaleFactor: 1.34,
      child: new Column(
        [
          new SizedBox(undefined, Math.max(0, settings.minExtent - this.bottomHeight)),
          new Flexible(
            new ClipRect(
              new ExpandedTitleBox(
                new ExcludeFocus(
                  new ExcludeSemantics({
                    child: new IgnorePointer(styled, { ignoring: !visible }),
                    excluding: !visible,
                  }),
                  { excluding: !visible },
                ),
                layout,
              ),
            ),
          ),
          new SizedBox(undefined, this.bottomHeight),
        ],
        { crossAlign: 'stretch' },
      ),
    });
  }
}

class ExpandedTitleLayout extends SingleChildLayoutDelegate {
  constructor(
    readonly padding: EdgeInsets,
    readonly direction: 'ltr' | 'rtl',
    readonly maxExtent: number,
  ) {
    super();
  }

  override getSize(constraints: BoxConstraints): Size {
    return constraints.biggest;
  }

  override getConstraintsForChild(constraints: BoxConstraints): BoxConstraints {
    return constraints.widthConstraints().deflate(this.padding);
  }

  override getPositionForChild(size: Size, child: Size): Offset {
    const adjust = Math.min(
      this.padding.bottom,
      Math.max(0, child.height + this.padding.bottom - this.maxExtent),
    );
    return {
      x:
        this.direction === 'ltr'
          ? this.padding.left
          : size.width - child.width - this.padding.right,
      y: size.height - child.height - this.padding.bottom + adjust,
    };
  }

  override shouldRelayout(old: ExpandedTitleLayout): boolean {
    return (
      !this.padding.equals(old.padding) ||
      this.maxExtent !== old.maxExtent ||
      this.direction !== old.direction
    );
  }
}

class ExpandedTitleBox extends CustomSingleChildLayout {
  override createRenderObject(): RenderExpandedTitleBox {
    return new RenderExpandedTitleBox(this.delegate);
  }
}

class RenderExpandedTitleBox extends RenderCustomSingleChildLayoutBox {
  private get padding(): EdgeInsets {
    return (this.delegate as ExpandedTitleLayout).padding;
  }

  protected override computeMinIntrinsicWidth(_height: number): number {
    return this.child ? this.child.getMinIntrinsicWidth(Infinity) + this.padding.horizontal : 0;
  }

  protected override computeMaxIntrinsicWidth(_height: number): number {
    return this.child ? this.child.getMaxIntrinsicWidth(Infinity) + this.padding.horizontal : 0;
  }

  protected override computeMinIntrinsicHeight(width: number): number {
    const padding = this.padding;
    return this.child
      ? this.child.getMinIntrinsicHeight(Math.max(0, width - padding.horizontal)) + padding.vertical
      : 0;
  }

  protected override computeMaxIntrinsicHeight(width: number): number {
    const padding = this.padding;
    return this.child
      ? this.child.getMaxIntrinsicHeight(Math.max(0, width - padding.horizontal)) + padding.vertical
      : 0;
  }
}
