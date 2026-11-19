// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Flutter: packages/flutter/lib/src/material/app_bar.dart @ 71e4717a61786faab4c7aa39825989305ed29e8a
import { FoundationPlatform } from '@nelyx/core/foundation/platform';
import { invariant } from '@nelyx/core/foundation/errors';
import { Curves, Interval } from '@nelyx/core/framework/animation/curves';
import { Alignment } from '@nelyx/core/framework/painting/alignment';
import { AxisDirection } from '@nelyx/core/framework/painting/basic-types';
import type { ShapeBorder } from '@nelyx/core/framework/painting/borders';
import { EdgeInsets } from '@nelyx/core/framework/painting/edge-insets';
import type { EdgeInsetsGeometry } from '@nelyx/core/framework/painting/edge-insets';
import { TextStyle } from '@nelyx/core/framework/painting/text-style';
import type { BoxConstraints } from '@nelyx/core/framework/rendering/constraints';
import { SingleChildLayoutDelegate } from '@nelyx/core/framework/rendering/custom-layout';
import { OrdinalSortKey } from '@nelyx/core/framework/semantics/semantics';
import {
  AnnotatedRegion,
  systemUiOverlayStyleAnnotation,
} from '@nelyx/core/framework/widgets/annotated-region';
import { MediaQuery } from '@nelyx/core/framework/widgets/app-data';
import {
  Align,
  Column,
  Flexible,
  Padding,
  Row,
  SizedBox,
  Stack,
} from '@nelyx/core/framework/widgets/basic';
import { ClipRect } from '@nelyx/core/framework/widgets/clip';
import { CustomSingleChildLayout } from '@nelyx/core/framework/widgets/custom-layout';
import { DefaultTextStyle } from '@nelyx/core/framework/widgets/default-text-style';
import { State, StatefulWidget } from '@nelyx/core/framework/widgets/framework';
import type { BuildContext, Widget, WidgetOptions } from '@nelyx/core/framework/widgets/framework';
import { IconTheme } from '@nelyx/core/framework/widgets/icon-theme';
import { IconThemeData } from '@nelyx/core/framework/widgets/icon-theme-data';
import {
  Navigator,
  routeImpliesAppBarDismissal,
  routeTokenOf,
} from '@nelyx/core/framework/widgets/navigation';
import { NavigationToolbar } from '@nelyx/core/framework/widgets/navigation-toolbar';
import { Opacity } from '@nelyx/core/framework/widgets/opacity';
import { ConstraintsTransformBox } from '@nelyx/core/framework/widgets/overflow-box';
import { PageRoute } from '@nelyx/core/framework/widgets/pages';
import type { PreferredSizeWidget } from '@nelyx/core/framework/widgets/preferred-size';
import { SafeArea } from '@nelyx/core/framework/widgets/safe-area';
import {
  defaultScrollNotificationPredicate,
  ScrollUpdateNotification,
} from '@nelyx/core/framework/widgets/scroll-notification';
import type {
  ScrollNotification,
  ScrollNotificationPredicate,
} from '@nelyx/core/framework/widgets/scroll-notification';
import { ScrollNotificationObserver } from '@nelyx/core/framework/widgets/scroll-notification-observer';
import type { ScrollNotificationObserverState } from '@nelyx/core/framework/widgets/scroll-notification-observer';
import { Semantics } from '@nelyx/core/framework/widgets/semantics';
import {
  emptyWidgetStateSet,
  WidgetState,
  WidgetStateColor,
} from '@nelyx/core/framework/widgets/widget-state';
import { SystemUiOverlayStyle } from '@nelyx/core/services/system-ui-overlay-style';
import type { Clip } from '@nelyx/core/ui/clip';
import { Color } from '@nelyx/core/ui/color';
import type { Offset, Size } from '@nelyx/core/ui/geometry';
import { AppBarTheme } from './app-bar-theme.ts';
import { BackButton, CloseButton, DrawerButton, EndDrawerButton } from './action-buttons.ts';
import { kToolbarHeight } from './constants.ts';
import { FlexibleSpaceBarSettings } from './flexible-space-bar.ts';
import { IconButton } from './icon-button.ts';
import { IconButtonTheme, IconButtonThemeData } from './icon-button-theme.ts';
import { Material, MaterialType } from './material.ts';
import { Scaffold } from './scaffold.ts';
import { Theme } from './theme.ts';
import { ThemeData } from './theme-data.ts';

export { kToolbarHeight } from './constants.ts';
export { SliverAppBar } from './sliver-app-bar.ts';
export type { SliverAppBarOptions } from './sliver-app-bar.ts';
export { systemUiOverlayStyleAnnotation };
const transparent = new Color(0);
const toolbarFade = new Interval(0.25, 1, { curve: Curves.fastOutSlowIn });
const maxTitleTextScaleFactor = 1.34;

export interface AppBarOptions extends WidgetOptions {
  readonly leading?: Widget | null;
  readonly automaticallyImplyLeading?: boolean;
  readonly title?: Widget | null;
  readonly actions?: readonly Widget[] | null;
  readonly automaticallyImplyActions?: boolean;
  readonly flexibleSpace?: Widget | null;
  readonly bottom?: PreferredSizeWidget | null;
  readonly elevation?: number | null;
  readonly scrolledUnderElevation?: number | null;
  readonly notificationPredicate?: ScrollNotificationPredicate;
  readonly shadowColor?: Color | null;
  readonly surfaceTintColor?: Color | null;
  readonly shape?: ShapeBorder | null;
  readonly backgroundColor?: Color | null;
  readonly foregroundColor?: Color | null;
  readonly iconTheme?: IconThemeData | null;
  readonly actionsIconTheme?: IconThemeData | null;
  readonly primary?: boolean;
  readonly centerTitle?: boolean | null;
  readonly excludeHeaderSemantics?: boolean;
  readonly titleSpacing?: number | null;
  readonly toolbarOpacity?: number;
  readonly bottomOpacity?: number;
  readonly toolbarHeight?: number | null;
  readonly leadingWidth?: number | null;
  readonly toolbarTextStyle?: TextStyle | null;
  readonly titleTextStyle?: TextStyle | null;
  readonly systemOverlayStyle?: SystemUiOverlayStyle | null;
  readonly forceMaterialTransparency?: boolean;
  readonly useDefaultSemanticsOrder?: boolean;
  readonly clipBehavior?: Clip | null;
  readonly actionsPadding?: EdgeInsetsGeometry | null;
  readonly animateColor?: boolean;
}

class PreferredAppBarSize implements Size {
  readonly width = 0;
  readonly height: number;

  constructor(
    readonly toolbar: number | null,
    readonly bottom: number,
  ) {
    this.height = (toolbar ?? kToolbarHeight) + bottom;
  }
}

class ToolbarContainerLayout extends SingleChildLayoutDelegate {
  constructor(readonly height: number) {
    super();
  }
  override getSize(constraints: BoxConstraints): Size {
    return { width: constraints.maxWidth, height: this.height };
  }
  override getConstraintsForChild(constraints: BoxConstraints): BoxConstraints {
    return constraints.tighten(undefined, this.height);
  }
  override getPositionForChild(size: Size, child: Size): Offset {
    return { x: 0, y: size.height - child.height };
  }
  override shouldRelayout(old: ToolbarContainerLayout): boolean {
    return this.height !== old.height;
  }
}

export class AppBar extends StatefulWidget implements PreferredSizeWidget {
  readonly options: Readonly<AppBarOptions>;
  readonly preferredSize: Size;
  readonly primary: boolean;

  constructor(options: AppBarOptions = {}) {
    super(options.key ?? null);
    for (const value of [
      options.elevation,
      options.scrolledUnderElevation,
      options.toolbarHeight,
      options.leadingWidth,
    ]) {
      invariant(
        value == null || (Number.isFinite(value) && value >= 0),
        'invalid-app-bar-size',
        'AppBar dimensions and elevation must be finite and nonnegative',
      );
    }
    for (const opacity of [options.toolbarOpacity, options.bottomOpacity]) {
      invariant(
        opacity == null || (opacity >= 0 && opacity <= 1),
        'invalid-app-bar-opacity',
        'AppBar opacity must be in [0, 1]',
      );
    }
    this.options = Object.freeze({
      ...options,
      ...(options.actions == null ? {} : { actions: Object.freeze([...options.actions]) }),
    });
    this.primary = options.primary ?? true;
    this.preferredSize = Object.freeze(
      new PreferredAppBarSize(
        options.toolbarHeight ?? null,
        options.bottom?.preferredSize.height ?? 0,
      ),
    );
  }

  static preferredHeightFor(context: BuildContext, preferredSize: Size): number {
    if (preferredSize instanceof PreferredAppBarSize && preferredSize.toolbar === null)
      return (AppBarTheme.of(context).toolbarHeight ?? kToolbarHeight) + preferredSize.bottom;
    return preferredSize.height;
  }

  override createState(): State<AppBar> {
    return new AppBarState();
  }
}

class AppBarState extends State<AppBar> {
  private observer: ScrollNotificationObserverState | null = null;
  private scrolledUnder = false;
  private readonly onScroll = (notification: ScrollNotification): void => {
    const predicate =
      this.widget.options.notificationPredicate ?? defaultScrollNotificationPredicate;
    if (!(notification instanceof ScrollUpdateNotification) || !predicate(notification)) return;
    const scaffold = Scaffold.maybeOf(this.context);
    if (scaffold?.isDrawerOpen || scaffold?.isEndDrawerOpen) return;
    const { metrics } = notification;
    let value = this.scrolledUnder;
    if (metrics.axisDirection === AxisDirection.down) value = metrics.extentBefore > 0;
    if (metrics.axisDirection === AxisDirection.up) value = metrics.extentAfter > 0;
    if (value !== this.scrolledUnder)
      this.setState(() => {
        this.scrolledUnder = value;
      });
  };

  override didChangeDependencies(): void {
    super.didChangeDependencies();
    const observer = ScrollNotificationObserver.maybeOf(this.context);
    if (observer === this.observer) return;
    this.observer?.removeListener(this.onScroll);
    this.observer = observer;
    observer?.addListener(this.onScroll);
  }

  override dispose(): void {
    this.observer?.removeListener(this.onScroll);
    this.observer = null;
    super.dispose();
  }

  private impliedLeading(context: BuildContext, iconSize: number): Widget | null {
    if (Scaffold.hasDrawer(context)) {
      return new DrawerButton({ style: IconButton.styleFrom({ iconSize }) });
    }
    if (!routeImpliesAppBarDismissal(context)) return null;
    const navigator = Navigator.maybeOf(context);
    const token = routeTokenOf(context);
    if (navigator === null || token === null) return null;
    const route = navigator.routes.find((entry) => entry.token === token)?.route;
    const close = route instanceof PageRoute && route.fullscreenDialog;
    return close ? new CloseButton() : new BackButton();
  }

  override build(context: BuildContext): Widget {
    const { options, primary } = this.widget;
    const theme = Theme.of(context);
    const { colorScheme: colors, textTheme } = theme;
    const appTheme = AppBarTheme.of(context);
    const spaceSettings = context.maybeDependOn(FlexibleSpaceBarSettings);
    const scrolledUnder = spaceSettings?.isScrolledUnder ?? this.scrolledUnder;
    const states = emptyWidgetStateSet();
    if (scrolledUnder) states.add(WidgetState.scrolledUnder);
    const background =
      [options.backgroundColor, appTheme.backgroundColor]
        .map((color) => (color instanceof WidgetStateColor ? color.resolve(states) : color))
        .find((color) => color != null) ??
      new Color(scrolledUnder ? colors.surfaceContainer : colors.surface);
    const customForeground = options.foregroundColor ?? appTheme.foregroundColor;
    const foreground = customForeground ?? new Color(colors.onSurface);
    const toolbarOpacity = toolbarFade.transform(options.toolbarOpacity ?? 1);
    const toolbarHeight = options.toolbarHeight ?? appTheme.toolbarHeight ?? kToolbarHeight;
    const baseElevation = options.elevation ?? appTheme.elevation ?? 0;
    const elevation = scrolledUnder
      ? (options.scrolledUnderElevation ?? appTheme.scrolledUnderElevation ?? 3)
      : baseElevation;
    const defaultIcons = new IconThemeData({ color: new Color(colors.onSurface), size: 24 });
    const defaultActionIcons = new IconThemeData({
      color: new Color(colors.onSurfaceVariant),
      size: 24,
    });
    const icons =
      options.iconTheme ?? appTheme.iconTheme ?? defaultIcons.copyWith({ color: foreground });
    const actionIcons =
      options.actionsIconTheme ??
      appTheme.actionsIconTheme ??
      options.iconTheme ??
      appTheme.iconTheme ??
      defaultActionIcons.copyWith(customForeground ? { color: customForeground } : {});
    const fadeIcon = (style: IconThemeData) =>
      toolbarOpacity === 1
        ? style
        : style.copyWith({ opacity: toolbarOpacity * (style.opacity ?? 1) });
    const buttons = IconButtonTheme.of(context);
    const themeButtons = (child: Widget, actual: IconThemeData, defaults: IconThemeData) => {
      if (!buttons.style || actual.equals(defaults)) return new IconButtonTheme(buttons, child);
      const overrides = IconButton.styleFrom({
        foregroundColor: actual.color,
        iconSize: actual.size,
      });
      return new IconButtonTheme(
        new IconButtonThemeData({
          style: buttons.style.copyWith({
            foregroundColor: overrides.foregroundColor,
            overlayColor: overrides.overlayColor,
            iconSize: overrides.iconSize,
          }),
        }),
        child,
      );
    };
    const fadeText = (style: TextStyle) =>
      toolbarOpacity === 1 || style.color === null
        ? style
        : style.copyWith({ color: new Color(style.color).withOpacity(toolbarOpacity).toARGB32() });
    const toolbarTextStyle =
      options.toolbarTextStyle ??
      appTheme.toolbarTextStyle ??
      (textTheme.bodyMedium ?? new TextStyle()).copyWith({ color: foreground.toARGB32() });
    const titleTextStyle =
      options.titleTextStyle ??
      appTheme.titleTextStyle ??
      (textTheme.titleLarge ?? new TextStyle()).copyWith({ color: foreground.toARGB32() });
    let leading = options.leading;
    if (leading == null && (options.automaticallyImplyLeading ?? true))
      leading = this.impliedLeading(context, icons.size ?? 24);
    if (leading)
      leading = themeButtons(
        leading instanceof IconButton ? new Align(leading) : leading,
        fadeIcon(icons),
        defaultIcons,
      );
    const leadingWidget =
      leading == null
        ? null
        : new SizedBox(
            options.leadingWidth ?? appTheme.leadingWidth ?? kToolbarHeight,
            undefined,
            leading,
          );
    let title: Widget | null = options.title
      ? new ConstraintsTransformBox(options.title, {
          constraintsTransform: ConstraintsTransformBox.maxHeightUnconstrained,
        })
      : null;
    if (title && !(options.excludeHeaderSemantics ?? false)) {
      const platform =
        FoundationPlatform.hostEnvironment.operatingSystem === 'unknown'
          ? theme.platform
          : FoundationPlatform.defaultTargetPlatform;
      title = new Semantics({
        header: true,
        namesRoute: platform === 'iOS' || platform === 'macOS' ? null : true,
        child: title,
      });
    }
    const titleWidget =
      title == null
        ? null
        : MediaQuery.withClampedTextScaling({
            maxScaleFactor: maxTitleTextScaleFactor,
            child: new DefaultTextStyle(fadeText(titleTextStyle), title, {
              softWrap: false,
              overflow: 'ellipsis',
            }),
          });
    const actions = options.actions ?? [];
    const trailing =
      actions.length > 0
        ? new Padding(
            options.actionsPadding ?? appTheme.actionsPadding ?? EdgeInsets.zero,
            new Row(actions, { mainSize: 'min' }),
          )
        : (options.automaticallyImplyActions ?? true) && Scaffold.hasEndDrawer(context)
          ? new EndDrawerButton({ style: IconButton.styleFrom({ iconSize: icons.size ?? 24 }) })
          : null;
    const fadedActionIcons = fadeIcon(actionIcons);
    const actionsWidget = trailing
      ? themeButtons(
          IconTheme.merge({ data: fadedActionIcons, child: trailing }),
          fadedActionIcons,
          defaultActionIcons,
        )
      : null;
    const platformCenters =
      (theme.platform === 'iOS' || theme.platform === 'macOS') && actions.length < 2;
    const clipBehavior = options.clipBehavior ?? 'hardEdge';
    let bar: Widget = new ClipRect(
      new CustomSingleChildLayout(
        IconTheme.merge({
          data: fadeIcon(icons),
          child: new DefaultTextStyle(
            fadeText(toolbarTextStyle),
            new NavigationToolbar({
              leading: leadingWidget,
              middle: titleWidget,
              trailing: actionsWidget,
              centerMiddle: options.centerTitle ?? appTheme.centerTitle ?? platformCenters,
              middleSpacing:
                options.titleSpacing ?? appTheme.titleSpacing ?? NavigationToolbar.kMiddleSpacing,
            }),
          ),
        }),
        new ToolbarContainerLayout(toolbarHeight),
      ),
      { clipBehavior },
    );
    if (options.bottom) {
      const bottomOpacity = toolbarFade.transform(options.bottomOpacity ?? 1);
      bar = new Column(
        [
          new Flexible(new SizedBox(undefined, toolbarHeight, bar)),
          bottomOpacity === 1
            ? options.bottom
            : new Opacity(options.bottom, { opacity: bottomOpacity }),
        ],
        { mainAxisAlignment: 'spaceBetween', crossAlign: 'stretch' },
      );
    }
    if (primary) bar = new SafeArea({ bottom: false, child: bar });
    bar = new Align(bar, { alignment: Alignment.topCenter });
    if (options.flexibleSpace) {
      const defaultOrder = options.useDefaultSemanticsOrder ?? true;
      bar = new Stack(
        [
          new Semantics({
            sortKey: defaultOrder ? new OrdinalSortKey(1) : null,
            explicitChildNodes: true,
            child: options.flexibleSpace,
          }),
          new Semantics({
            sortKey: defaultOrder ? new OrdinalSortKey(0) : null,
            explicitChildNodes: true,
            child: new Material({ type: MaterialType.transparency, child: bar }),
          }),
        ],
        { fit: 'passthrough' },
      );
    }
    const defaultOverlay =
      ThemeData.estimateBrightnessForColor(background) === 'dark'
        ? SystemUiOverlayStyle.light
        : SystemUiOverlayStyle.dark;
    return new Semantics({
      container: true,
      child: new AnnotatedRegion(
        new Material({
          type: options.forceMaterialTransparency ? MaterialType.transparency : MaterialType.canvas,
          color: background,
          elevation,
          shadowColor: options.shadowColor ?? appTheme.shadowColor ?? transparent,
          surfaceTintColor:
            options.surfaceTintColor ?? appTheme.surfaceTintColor ?? new Color(colors.surfaceTint),
          shape: options.shape ?? appTheme.shape,
          animateColor: options.animateColor ?? false,
          child: new Semantics({ explicitChildNodes: true, child: bar }),
        }),
        {
          annotationType: systemUiOverlayStyleAnnotation,
          value:
            options.systemOverlayStyle ??
            appTheme.systemOverlayStyle ??
            new SystemUiOverlayStyle({
              statusBarColor: transparent,
              statusBarBrightness: defaultOverlay.statusBarBrightness,
              statusBarIconBrightness: defaultOverlay.statusBarIconBrightness,
              systemStatusBarContrastEnforced: defaultOverlay.systemStatusBarContrastEnforced,
            }),
        },
      ),
    });
  }
}
