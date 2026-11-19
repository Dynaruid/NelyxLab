// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Flutter: packages/flutter/lib/src/cupertino/nav_bar.dart @ 71e4717a61786faab4c7aa39825989305ed29e8a
import { invariant } from '@nelyx/core/foundation/errors';
import { AnimationController } from '@nelyx/core/framework/animation/animation-controller';
import { Curves } from '@nelyx/core/framework/animation/curves';
import { AlignmentDirectional } from '@nelyx/core/framework/painting/alignment';
import { AxisDirection } from '@nelyx/core/framework/painting/basic-types';
import { allInsets } from '@nelyx/core/ui/geometry';
import type { Size } from '@nelyx/core/ui/geometry';
import { EdgeInsets, EdgeInsetsDirectional } from '@nelyx/core/framework/painting/edge-insets';
import type { EdgeInsetsGeometry } from '@nelyx/core/framework/painting/edge-insets';
import { TextScaler } from '@nelyx/core/framework/painting/text-scaler';
import type { OverScrollHeaderStretchConfiguration } from '@nelyx/core/framework/rendering/sliver-persistent-header';
import {
  Element,
  State,
  StatefulWidget,
  StatelessWidget,
} from '@nelyx/core/framework/widgets/framework';
import type { Widget, BuildContext, WidgetOptions } from '@nelyx/core/framework/widgets/framework';
import {
  Align,
  Center,
  Column,
  Expanded,
  DecoratedBox,
  Flexible,
  Padding,
  Positioned,
  Row,
  SizedBox,
  Stack,
  Text,
} from '@nelyx/core/framework/widgets/basic';
import { AppTheme, Directionality, MediaQuery } from '@nelyx/core/framework/widgets/app-data';
import { ClipRect } from '@nelyx/core/framework/widgets/clip';
import { ControlInteraction } from '@nelyx/core/framework/widgets/control-interaction';
import { DefaultTextStyle } from '@nelyx/core/framework/widgets/default-text-style';
import { FocusScopeNode } from '@nelyx/core/framework/widgets/focus';
import { ExcludeFocus, FocusScope } from '@nelyx/core/framework/widgets/focus-scope';
import type { GlobalKey } from '@nelyx/core/framework/widgets/global-key';
import { Icon } from '@nelyx/core/framework/widgets/icon';
import { IconTheme } from '@nelyx/core/framework/widgets/icon-theme';
import { IconThemeData } from '@nelyx/core/framework/widgets/icon-theme-data';
import { ListenableBuilder } from '@nelyx/core/framework/widgets/listenable-builder';
import { Navigator, routeOf, routeTokenOf } from '@nelyx/core/framework/widgets/navigation';
import { NavigationToolbar } from '@nelyx/core/framework/widgets/navigation-toolbar';
import { Opacity } from '@nelyx/core/framework/widgets/opacity';
import { PageRoute } from '@nelyx/core/framework/widgets/pages';
import { AbsorbPointer, IgnorePointer } from '@nelyx/core/framework/widgets/pointer-blocking';
import type { PreferredSizeWidget } from '@nelyx/core/framework/widgets/preferred-size';
import { SafeArea } from '@nelyx/core/framework/widgets/safe-area';
import { ScrollNotificationObserver } from '@nelyx/core/framework/widgets/scroll-notification-observer';
import type { ScrollNotificationObserverState } from '@nelyx/core/framework/widgets/scroll-notification-observer';
import { ScrollUpdateNotification } from '@nelyx/core/framework/widgets/scroll-notification';
import type { ScrollNotification } from '@nelyx/core/framework/widgets/scroll-notification';
import type { ScrollPosition } from '@nelyx/core/framework/widgets/scroll-position';
import { Scrollable } from '@nelyx/core/framework/widgets/scrollable';
import { ExcludeSemantics, Semantics } from '@nelyx/core/framework/widgets/semantics';
import {
  SliverPersistentHeader,
  SliverPersistentHeaderDelegate,
} from '@nelyx/core/framework/widgets/sliver-persistent-header';
import { SingleTickerProviderStateMixin } from '@nelyx/core/framework/widgets/ticker-provider';
import { Color } from '@nelyx/core/ui/color';
import { CupertinoButton } from './button.ts';
import { kMinInteractiveDimensionCupertino } from './constants.ts';
import { CupertinoLocalizations } from './cupertino-localizations.ts';
import { CupertinoIcons } from './icons.ts';
import { coreCupertinoColor, resolveCupertinoColor } from './internal/colors/color-values.ts';
import type { CupertinoColor } from './internal/colors/color-values.ts';
import {
  clampedFraction,
  dampNavBarScale,
  fadeNavBarTitle,
  maxNavBarScale,
  minNavBarScale,
  navBarBottomPadding,
  navBarEdgePadding,
  navBarLargeTitle,
  navBarLargeTitleDamping,
  navBarLargeTitleHeight,
  navBarLargeTitleThreshold,
  navBarScrollUnderExtent,
  navBarSurface,
  paintNavBarSurface,
} from './internal/navigation-bar-layout.ts';
import type { NavBarSurfaceOptions } from './internal/navigation-bar-layout.ts';
import {
  NavigationBarKeys,
  navigationBarHero,
  navigationBarPart,
} from './internal/navigation-bar-flight.ts';
import type { NavBarPart } from './internal/navigation-bar-flight.ts';
import { CupertinoPageScaffoldBackgroundColor } from './page-scaffold.ts';
import type { ObstructingPreferredSizeWidget } from './page-scaffold.ts';
import { CupertinoRouteTransitionMixin } from './route.ts';
import { CupertinoSheetRoute } from './sheet.ts';
import { CupertinoTheme } from './theme.ts';

const toolbarHeight = kMinInteractiveDimensionCupertino;
const navBarBackButtonTapWidth = 50;
const searchFieldHeight = 36;
const searchCancelWidth = 67;
const searchDuration = 300;
const searchCurve = Curves.easeInOut;

interface NavigationBarOptions extends WidgetOptions, NavBarSurfaceOptions {
  readonly leading?: Widget | null;
  readonly middle?: Widget | null;
  readonly trailing?: Widget | null;
  readonly automaticallyImplyLeading?: boolean;
  readonly previousPageTitle?: string | null;
  readonly backgroundColor?: CupertinoColor | null;
  readonly padding?: EdgeInsetsGeometry | null;
  readonly bottom?: PreferredSizeWidget | null;
  readonly transitionBetweenRoutes?: boolean;
  readonly heroTag?: NonNullable<unknown>;
}

export interface CupertinoNavigationBarOptions extends NavigationBarOptions {
  readonly automaticallyImplyMiddle?: boolean;
}

export interface CupertinoLargeNavigationBarOptions extends Omit<NavigationBarOptions, 'middle'> {
  readonly largeTitle?: Widget | null;
  readonly automaticallyImplyTitle?: boolean;
}

export enum NavigationBarBottomMode {
  automatic = 'automatic',
  always = 'always',
}

export interface CupertinoSliverNavigationBarOptions extends NavigationBarOptions {
  readonly largeTitle?: Widget | null;
  readonly automaticallyImplyTitle?: boolean;
  readonly alwaysShowMiddle?: boolean;
  readonly bottomMode?: NavigationBarBottomMode | null;
  readonly stretch?: boolean;
}

export interface CupertinoSearchNavigationBarOptions extends Omit<
  CupertinoSliverNavigationBarOptions,
  'bottom'
> {
  readonly searchField: Widget;
  readonly onSearchableBottomTap?: ((active: boolean) => void) | null;
}

export interface CupertinoNavigationBarBackButtonOptions extends WidgetOptions {
  readonly color?: CupertinoColor | null;
  readonly previousPageTitle?: string | null;
  readonly onPressed?: (() => void) | null;
}

const backButtonKeys = new WeakMap<CupertinoNavigationBarBackButton, NavigationBarKeys>();

export class CupertinoNavigationBarBackButton extends StatelessWidget {
  readonly options: Readonly<CupertinoNavigationBarBackButtonOptions>;

  constructor(options: CupertinoNavigationBarBackButtonOptions = {}) {
    super(options.key ?? null);
    this.options = Object.freeze({ ...options });
  }
  override build(context: BuildContext): Widget {
    const { color, onPressed, previousPageTitle } = this.options;
    const navigation = Navigator.maybeOf(context);
    const token = routeTokenOf(context);
    const index = navigation?.routes.findIndex((entry) => entry.token === token) ?? -1;
    const route = routeOf(context);
    const priorTitle =
      index !== 0 && route instanceof CupertinoRouteTransitionMixin ? route.previousTitle : null;
    const localizations = CupertinoLocalizations.of(context);
    const theme = CupertinoTheme.of(context);
    const actionStyle = theme.textTheme.navActionTextStyle;
    const resolvedColor =
      color == null
        ? new Color(actionStyle.color ?? theme.primaryColor)
        : resolveCupertinoColor(color, context);
    const style = actionStyle.copyWith({ color: resolvedColor.toARGB32() });
    const buildLabel = (title: string | null): Widget =>
      title === null
        ? new SizedBox()
        : new Text(title.length > 12 ? localizations.backButtonLabel : title, {
            maxLines: 1,
            overflow: 'ellipsis',
          });
    const label =
      previousPageTitle != null
        ? buildLabel(previousPageTitle)
        : priorTitle
          ? new ListenableBuilder(priorTitle, () => buildLabel(priorTitle.value))
          : new SizedBox();
    const direction = Directionality.of(context);
    const keys = backButtonKeys.get(this);
    const chevron = new Icon(direction === 'rtl' ? CupertinoIcons.forward : CupertinoIcons.back, {
      size: 30,
      color: resolvedColor,
    });
    return new CupertinoButton({
      semanticsLabel: localizations.backButtonLabel,
      padding: EdgeInsets.zero,
      minimumSize: { width: navBarBackButtonTapWidth, height: toolbarHeight },
      foregroundColor: resolvedColor,
      onPressed:
        onPressed ??
        (navigation && index > 0
          ? () => {
              void navigation.maybePop();
            }
          : null),
      child: new DefaultTextStyle(
        style,
        new Row(
          [
            new Padding(
              EdgeInsetsDirectional.only({ start: 14, end: 8 }),
              keys ? navigationBarPart(context, chevron, keys.backChevron) : chevron,
            ),
            new Flexible(keys ? navigationBarPart(context, label, keys.backLabel) : label),
          ],
          { mainSize: 'min' },
        ),
      ),
    });
  }
}

export class CupertinoNavigationBar
  extends StatelessWidget
  implements ObstructingPreferredSizeWidget
{
  readonly title: string;
  readonly onBack: (() => void) | undefined;
  readonly options: Readonly<CupertinoNavigationBarOptions> | null;
  readonly preferredSize: Size;
  readonly largeTitle: Widget | null;
  private readonly large: boolean;

  constructor(options?: CupertinoNavigationBarOptions);
  constructor(title: string, onBack?: () => void);
  constructor(
    first:
      | string
      | (CupertinoNavigationBarOptions &
          Pick<CupertinoLargeNavigationBarOptions, 'largeTitle'>) = {},
    onBack?: () => void,
  ) {
    super(typeof first === 'string' ? null : (first.key ?? null));
    this.title = typeof first === 'string' ? first : '';
    this.onBack = onBack;
    this.options = typeof first === 'string' ? null : Object.freeze({ ...first });
    this.large = typeof first !== 'string' && Object.hasOwn(first, 'largeTitle');
    this.largeTitle = typeof first === 'string' ? null : (first.largeTitle ?? null);
    this.preferredSize = Object.freeze({
      width: 0,
      height:
        toolbarHeight +
        (this.options?.bottom?.preferredSize.height ?? 0) +
        (this.large ? navBarLargeTitleHeight : 0),
    });
  }

  static large(options: CupertinoLargeNavigationBarOptions = {}): CupertinoNavigationBar {
    const configuration = {
      ...options,
      largeTitle: options.largeTitle ?? null,
      automaticallyImplyMiddle: options.automaticallyImplyTitle ?? true,
    };
    return new CupertinoNavigationBar(configuration);
  }

  shouldFullyObstruct(context: BuildContext): boolean {
    const background =
      this.options === null
        ? new Color(AppTheme.of(context).surface)
        : navigationBarColor(context, this.options);
    return background.alpha === 255;
  }

  override build(context: BuildContext): Widget {
    if (this.options) return new FixedNavigationBar(this.options, this.large, this.largeTitle);
    const theme = AppTheme.of(context);
    return new DecoratedBox(
      new Padding(
        allInsets(12),
        new Row(
          [
            ...(this.onBack
              ? [
                  new SizedBox(
                    80,
                    undefined,
                    new CupertinoButton('cupertino-back', 'Back', this.onBack),
                  ),
                ]
              : []),
            new Expanded(new Text(this.title, { fontSize: 22, color: theme.foreground })),
          ],
          { spacing: 12, crossAlign: 'center' },
        ),
      ),
      theme.surface,
    );
  }
}

function navigationBarColor(context: BuildContext, options: NavigationBarOptions): Color {
  return options.backgroundColor == null
    ? new Color(CupertinoTheme.of(context).barBackgroundColor)
    : resolveCupertinoColor(options.backgroundColor, context);
}

function navBarParts(
  context: BuildContext,
  options: NavigationBarOptions,
  keys: NavigationBarKeys,
  explicitTitle: Widget | null,
  implyTitle: boolean,
) {
  const navigation = Navigator.maybeOf(context);
  const token = routeTokenOf(context);
  const index = navigation?.routes.findIndex((entry) => entry.token === token) ?? -1;
  const route = routeOf(context);
  const routeTitle =
    implyTitle && route instanceof CupertinoRouteTransitionMixin && route.title != null
      ? new Text(route.title)
      : null;
  const title = explicitTitle ?? routeTitle;
  const typography = CupertinoTheme.of(context).textTheme;
  const padding = options.padding?.resolve(Directionality.of(context));
  const rtl = Directionality.of(context) === 'rtl';
  const leadingInset = padding ? (rtl ? padding.right : padding.left) : navBarEdgePadding;
  const trailingInset = padding ? (rtl ? padding.left : padding.right) : navBarEdgePadding;
  const edgeContent = (child: Widget, insets: EdgeInsetsGeometry) =>
    new Padding(
      insets,
      MediaQuery.withClampedTextScaling({
        minScaleFactor: minNavBarScale,
        maxScaleFactor: maxNavBarScale,
        child: IconTheme.merge({ data: new IconThemeData({ size: 32 }), child }),
      }),
    );
  let leading = options.leading ?? null;
  let automaticBack = false;
  const fullscreen = route instanceof PageRoute && route.fullscreenDialog;
  const canPop = index > 0 || (index < 0 && route instanceof PageRoute && !route.isFirst);
  if (leading === null && navigation && canPop && options.automaticallyImplyLeading !== false) {
    if (fullscreen) {
      const label = CupertinoLocalizations.of(context).cancelButtonLabel;
      leading = new CupertinoButton({
        semanticsLabel: label,
        padding: EdgeInsets.zero,
        onPressed: () => {
          void navigation.maybePop();
        },
        child: new Text(label),
      });
    } else if (!CupertinoSheetRoute.hasParentSheet(context)) {
      const back = new CupertinoNavigationBarBackButton({
        previousPageTitle: options.previousPageTitle ?? null,
      });
      backButtonKeys.set(back, keys);
      automaticBack = true;
      leading = MediaQuery.withClampedTextScaling({
        minScaleFactor: minNavBarScale,
        maxScaleFactor: maxNavBarScale,
        child: back,
      });
    }
  }
  if (leading && (options.leading || fullscreen))
    leading = edgeContent(leading, EdgeInsetsDirectional.only({ start: leadingInset }));
  const trailing = options.trailing
    ? edgeContent(options.trailing, EdgeInsetsDirectional.only({ end: trailingInset }))
    : null;
  return {
    leading,
    automaticBack,
    title,
    trailing,
    typography,
    padding,
    middle: options.middle ?? title,
  };
}

function navigationToolbar(
  context: BuildContext,
  parts: ReturnType<typeof navBarParts>,
  keys: NavigationBarKeys,
  top: number,
  bodyHeight: number,
  visibleMiddle: boolean,
  visibleActions = true,
): Widget {
  const { leading, middle, trailing, typography } = parts;
  const action = (child: Widget, key: GlobalKey) =>
    fadeNavBarTitle(navigationBarPart(context, child, key), visibleActions);
  const middleLabel =
    middle === null
      ? null
      : fadeNavBarTitle(
          navigationBarPart(
            context,
            new Semantics({
              header: true,
              child: new DefaultTextStyle(typography.navTitleTextStyle, middle, {
                maxLines: 1,
                overflow: 'ellipsis',
                softWrap: false,
              }),
            }),
            keys.middle,
          ),
          visibleMiddle,
        );
  const contents = new NavigationToolbar({
    leading: leading
      ? new Center(
          parts.automaticBack
            ? fadeNavBarTitle(leading, visibleActions)
            : action(leading, keys.leading),
          { widthFactor: 1 },
        )
      : null,
    middle: middleLabel,
    trailing: trailing ? action(trailing, keys.trailing) : null,
    middleSpacing: 6,
  });
  const padding = EdgeInsets.only({
    top: parts.padding?.top ?? 0,
    bottom: parts.padding?.bottom ?? 0,
  });
  return new SizedBox(
    undefined,
    top + bodyHeight,
    new SafeArea({
      top: top > 0,
      bottom: false,
      child: new Padding(padding, new DefaultTextStyle(typography.navActionTextStyle, contents)),
    }),
  );
}

function visibleToolbarParts(
  { leading, middle, trailing, automaticBack }: ReturnType<typeof navBarParts>,
  showMiddle: boolean,
  showActions: boolean,
): NavBarPart[] {
  const include: NavBarPart[] = [];
  if (showActions && leading) {
    if (automaticBack) include.push('backChevron', 'backLabel');
    else include.push('leading');
  }
  if (showActions && trailing) include.push('trailing');
  if (showMiddle && middle) include.push('middle');
  return include;
}

class FixedNavigationBar extends StatefulWidget {
  constructor(
    readonly options: CupertinoNavigationBarOptions,
    readonly large: boolean,
    readonly largeTitle: Widget | null,
  ) {
    super();
  }

  override createState(): State<FixedNavigationBar> {
    return new FixedNavigationBarState();
  }
}

class FixedNavigationBarState extends State<FixedNavigationBar> {
  private readonly keys = new NavigationBarKeys();
  private observer: ScrollNotificationObserverState | null = null;
  private backgroundProgress = 0;
  private readonly onScroll = (notification: ScrollNotification): void => {
    if (!(notification instanceof ScrollUpdateNotification) || notification.depth !== 0) return;
    const { metrics } = notification;
    let extent: number;
    if (metrics.axisDirection === AxisDirection.down) extent = metrics.extentBefore;
    else if (metrics.axisDirection === AxisDirection.up) extent = metrics.extentAfter;
    else return;
    const progress = clampedFraction(extent / navBarScrollUnderExtent);
    if (progress !== this.backgroundProgress)
      this.setState(() => {
        this.backgroundProgress = progress;
      });
  };

  override didChangeDependencies(): void {
    super.didChangeDependencies();
    const observer = ScrollNotificationObserver.maybeOf(this.context);
    if (observer !== this.observer) {
      this.observer?.removeListener(this.onScroll);
      this.observer = observer;
      observer?.addListener(this.onScroll);
    }
  }

  override dispose(): void {
    this.observer?.removeListener(this.onScroll);
    super.dispose();
  }

  override build(context: BuildContext): Widget {
    const { options, large, largeTitle } = this.widget;
    const top = CupertinoSheetRoute.hasParentSheet(context) ? 0 : MediaQuery.paddingOf(context).top;
    const parts = navBarParts(
      context,
      options,
      this.keys,
      largeTitle,
      options.automaticallyImplyMiddle !== false,
    );
    const toolbar = navigationToolbar(
      context,
      large ? { ...parts, middle: null } : parts,
      this.keys,
      top,
      toolbarHeight,
      !large,
    );
    const children = [toolbar];
    const include = visibleToolbarParts(parts, !large, true);
    if (large) {
      const { title, typography } = parts;
      const style = typography.navLargeTitleTextStyle;
      const scale = dampNavBarScale(
        MediaQuery.textScalerOf(context),
        style.fontSize ?? 34,
        navBarLargeTitleDamping,
      );
      if (title) include.push('title');
      children.push(
        new SizedBox(
          undefined,
          navBarLargeTitleHeight,
          title === null
            ? undefined
            : navBarLargeTitle(
                navigationBarPart(context, title, this.keys.title),
                navBarLargeTitleHeight,
                style,
                scale,
              ),
        ),
      );
    }
    if (options.bottom) {
      include.push('bottom');
      children.push(
        new SizedBox(
          undefined,
          options.bottom.preferredSize.height,
          navigationBarPart(context, options.bottom, this.keys.bottom),
        ),
      );
    }
    const surface = navBarSurface(
      options,
      navigationBarColor(context, options),
      CupertinoPageScaffoldBackgroundColor.maybeOf(context),
      this.backgroundProgress,
    );
    const bar = paintNavBarSurface(
      new Column(children, { mainSize: 'min', crossAlign: 'stretch' }),
      surface,
      options,
    );
    return navigationBarHero(context, bar, {
      keys: this.keys,
      surface,
      include,
      options,
      searchable: false,
    });
  }
}

export class CupertinoSliverNavigationBar extends StatefulWidget {
  readonly options: Readonly<CupertinoSliverNavigationBarOptions>;
  readonly searchField: Widget | null;
  readonly onSearchableBottomTap: ((active: boolean) => void) | null;

  constructor(options?: CupertinoSliverNavigationBarOptions);
  constructor(
    options: CupertinoSliverNavigationBarOptions &
      Partial<CupertinoSearchNavigationBarOptions> = {},
  ) {
    super(options.key ?? null);
    const { searchField = null, onSearchableBottomTap = null, ...navigation } = options;
    invariant(
      navigation.automaticallyImplyTitle !== false || navigation.largeTitle != null,
      'cupertino-sliver-nav-bar-title',
      'Provide a largeTitle when automaticallyImplyTitle is false',
    );
    invariant(
      navigation.bottomMode == null || navigation.bottom != null || searchField !== null,
      'cupertino-sliver-nav-bar-bottom',
      'Provide a bottom or search field when specifying bottomMode',
    );
    this.options = Object.freeze(navigation);
    this.searchField = searchField;
    this.onSearchableBottomTap = onSearchableBottomTap;
  }

  static search(options: CupertinoSearchNavigationBarOptions): CupertinoSliverNavigationBar {
    return new CupertinoSliverNavigationBar(options);
  }

  get opaque(): boolean {
    const background = this.options.backgroundColor;
    return background != null && coreCupertinoColor(background).alpha === 255;
  }

  override createState(): State<CupertinoSliverNavigationBar> {
    return new CupertinoSliverNavigationBarState();
  }
}

class CupertinoSliverNavigationBarState extends SingleTickerProviderStateMixin<CupertinoSliverNavigationBar> {
  private readonly keys = new NavigationBarKeys();
  private readonly scope = new FocusScopeNode({ debugLabel: 'Navigation bar search' });
  private motion!: AnimationController;
  private searchActive = false;
  private position: ScrollPosition | null = null;
  private collapseBottom = 0;
  private collapseTitle = 0;
  private scrollRevision = 0;

  override initState(): void {
    super.initState();
    this.motion = new AnimationController({ duration: searchDuration, vsync: this });
    this.motion.addListener(() => this.setState(() => {}));
  }

  override didUpdateWidget(old: CupertinoSliverNavigationBar): void {
    super.didUpdateWidget(old);
    if (old.searchField !== null && this.widget.searchField === null) {
      this.searchActive = false;
      this.scope.unfocus();
      this.motion.reset();
    }
  }

  private readonly onScrollActivity = () => {
    const position = this.position;
    const revision = ++this.scrollRevision;
    const context = this.context;
    if (position === null || position.isScrollingNotifier.value || !(context instanceof Element))
      return;
    context.owner.postFrame(() => {
      if (
        !this.mounted ||
        !context.active ||
        this.searchActive ||
        revision !== this.scrollRevision ||
        position.isScrollingNotifier.value ||
        !position.hasPixels ||
        !position.hasContentDimensions
      )
        return;
      const offset = position.pixels - position.minScrollExtent;
      const titleEnd = this.collapseBottom + this.collapseTitle;
      let target: number;
      if (offset > 0 && offset < this.collapseBottom) {
        target = offset > this.collapseBottom / 2 ? this.collapseBottom : 0;
      } else if (offset > this.collapseBottom && offset < titleEnd) {
        target =
          offset > this.collapseBottom + this.collapseTitle / 2 ? titleEnd : this.collapseBottom;
      } else return;
      const pixels = position.minScrollExtent + target;
      if (pixels <= position.maxScrollExtent)
        void position.animateTo(pixels, {
          duration: searchDuration,
          curve: Curves.fastEaseInToSlowEaseOut,
        });
    });
  };

  private observeScroll(position: ScrollPosition | null): void {
    if (position === this.position) return;
    ++this.scrollRevision;
    this.position?.isScrollingNotifier.removeListener(this.onScrollActivity);
    this.position = position;
    position?.isScrollingNotifier.addListener(this.onScrollActivity);
  }

  override deactivate(): void {
    this.observeScroll(null);
    super.deactivate();
  }

  override dispose(): void {
    this.observeScroll(null);
    this.motion.dispose();
    this.scope.dispose();
    super.dispose();
  }

  private readonly toggleSearch = () => {
    if (!this.mounted) return;
    const active = !this.searchActive;
    this.setState(() => {
      this.searchActive = active;
    });
    if (active) {
      this.motion.forward();
      const context = this.context;
      if (context instanceof Element) {
        context.owner.postFrame(() => {
          if (!this.mounted || !context.active || !this.searchActive || this.scope.hasFocus) return;
          this.scope.traversalDescendants.find((node) => node.canRequestFocus)?.requestFocus();
        });
      }
    } else {
      this.scope.unfocus({ disposition: 'previouslyFocusedChild' });
      this.motion.reverse();
    }
    this.widget.onSearchableBottomTap?.(active);
  };

  private searchBottom(
    context: BuildContext,
    field: Widget,
    height: number,
    progress: number,
  ): Widget {
    const active = this.searchActive;
    const localization = CupertinoLocalizations.of(context);
    const editor = new FocusScope(
      new ExcludeSemantics({
        excluding: !active,
        child: new AbsorbPointer(field, { absorbing: !active }),
      }),
      { node: this.scope, skipTraversal: true, descendantsAreFocusable: active },
    );
    const fieldStack = new Stack([
      Positioned.fill(editor),
      ...(!active
        ? [
            Positioned.fill(
              new ControlInteraction(() => new SizedBox(), {
                onPressed: this.toggleSearch,
                semantics: { button: true, label: localization.searchTextFieldPlaceholderLabel },
              }),
            ),
          ]
        : []),
    ]);
    const cancel = new ExcludeFocus(
      new IgnorePointer(
        new Opacity(
          new Align(
            new CupertinoButton({
              padding: EdgeInsets.zero,
              onPressed: this.toggleSearch,
              child: new Text(localization.cancelButtonLabel, { maxLines: 1, softWrap: false }),
            }),
            { alignment: AlignmentDirectional.centerStart },
          ),
          { opacity: progress * (active ? 1 : 0.4) },
        ),
        { ignoring: !active },
      ),
      { excluding: !active },
    );
    return new Padding(
      EdgeInsetsDirectional.only({
        start: navBarEdgePadding,
        end: navBarEdgePadding * (1 - progress),
        bottom: navBarBottomPadding,
      }),
      MediaQuery.withNoTextScaling({
        child: new Row(
          [
            new Expanded(new SizedBox(undefined, height, fieldStack)),
            new SizedBox(12 * progress),
            new SizedBox(
              searchCancelWidth * progress,
              height,
              new ClipRect(new ExcludeSemantics({ child: cancel, excluding: !active })),
            ),
          ],
          { crossAlign: 'center' },
        ),
      }),
    );
  }

  override build(context: BuildContext): Widget {
    const { options, searchField } = this.widget;
    const scaler = MediaQuery.textScalerOf(context);
    const media = MediaQuery.of(context);
    const portrait = media.height >= media.width;
    const top = CupertinoSheetRoute.hasParentSheet(context) ? 0 : MediaQuery.paddingOf(context).top;
    const fieldHeight =
      searchFieldHeight * dampNavBarScale(scaler, searchFieldHeight, maxNavBarScale);
    const titleHeight = portrait
      ? navBarLargeTitleHeight *
        dampNavBarScale(scaler, navBarLargeTitleHeight, navBarLargeTitleDamping)
      : 0;
    const bottomHeight =
      searchField !== null
        ? fieldHeight + navBarBottomPadding
        : (options.bottom?.preferredSize.height ?? 0);
    const bottom =
      searchField !== null
        ? this.searchBottom(
            context,
            searchField,
            fieldHeight,
            searchCurve.transform(this.motion.value),
          )
        : (options.bottom ?? null);
    const bottomPinned = this.searchActive || options.bottomMode === NavigationBarBottomMode.always;
    this.collapseBottom = bottomPinned ? 0 : bottomHeight;
    this.collapseTitle = titleHeight;
    this.observeScroll(Scrollable.maybeOf(context)?.position ?? null);
    const expansion = 1 - this.motion.value;
    return new SliverPersistentHeader({
      pinned: true,
      delegate: new LargeTitleNavigationBarDelegate({
        options,
        keys: this.keys,
        bottom,
        bottomHeight,
        bottomPinned,
        top,
        toolbarHeight: toolbarHeight * expansion,
        titleHeight: titleHeight * expansion,
        searchActive: this.searchActive || this.motion.isAnimating,
        searchable: searchField !== null,
        scale: scaler,
        middleAlwaysVisible:
          !portrait || (options.middle != null && options.alwaysShowMiddle !== false),
      }),
    });
  }
}

interface SliverNavigationBarLayout {
  readonly options: CupertinoSliverNavigationBarOptions;
  readonly keys: NavigationBarKeys;
  readonly bottom: Widget | null;
  readonly bottomHeight: number;
  readonly bottomPinned: boolean;
  readonly top: number;
  readonly toolbarHeight: number;
  readonly titleHeight: number;
  readonly searchActive: boolean;
  readonly searchable: boolean;
  readonly scale: TextScaler;
  readonly middleAlwaysVisible: boolean;
}

class LargeTitleNavigationBarDelegate extends SliverPersistentHeaderDelegate {
  constructor(private readonly layout: SliverNavigationBarLayout) {
    super();
  }

  override get minExtent(): number {
    const { top, toolbarHeight, bottomPinned, bottomHeight } = this.layout;
    return top + toolbarHeight + (bottomPinned ? bottomHeight : 0);
  }

  override get maxExtent(): number {
    const { top, toolbarHeight, bottomHeight, titleHeight } = this.layout;
    return top + toolbarHeight + bottomHeight + titleHeight;
  }

  override get stretchConfiguration(): OverScrollHeaderStretchConfiguration | null {
    return this.layout.options.stretch === true && !this.layout.searchActive
      ? { stretchTriggerOffset: 100 }
      : null;
  }

  override shouldRebuild(old: SliverPersistentHeaderDelegate): boolean {
    return !(old instanceof LargeTitleNavigationBarDelegate) || old.layout !== this.layout;
  }

  override build(context: BuildContext, shrinkOffset: number, overlapsContent: boolean): Widget {
    const {
      options,
      keys,
      bottom,
      bottomHeight,
      bottomPinned,
      top,
      toolbarHeight,
      titleHeight,
      searchActive,
    } = this.layout;
    const persistentHeight = top + toolbarHeight;
    const threshold = this.maxExtent - this.minExtent - navBarLargeTitleThreshold;
    const expandedTitle = titleHeight > 0 && shrinkOffset < threshold;
    const visibleBottomHeight = bottomPinned
      ? bottomHeight
      : Math.max(0, bottomHeight - shrinkOffset);
    const progress = clampedFraction(
      (shrinkOffset - threshold - navBarScrollUnderExtent) / navBarScrollUnderExtent,
    );
    const parts = navBarParts(
      context,
      options,
      keys,
      options.largeTitle ?? null,
      options.automaticallyImplyTitle !== false,
    );
    const showMiddle = !searchActive && (this.layout.middleAlwaysVisible || !expandedTitle);
    const showTitle = expandedTitle && !searchActive;
    const toolbar = navigationToolbar(
      context,
      parts,
      keys,
      top,
      toolbarHeight,
      showMiddle,
      !searchActive,
    );
    const titleStyle = parts.typography.navLargeTitleTextStyle;
    const titleScale = dampNavBarScale(
      this.layout.scale,
      titleStyle.fontSize ?? 34,
      navBarLargeTitleDamping,
    );
    const content = new Stack(
      [
        ...(parts.title === null
          ? []
          : [
              new Positioned(
                fadeNavBarTitle(
                  navBarLargeTitle(
                    navigationBarPart(context, parts.title, keys.title),
                    titleHeight,
                    titleStyle,
                    titleScale,
                  ),
                  showTitle,
                ),
                { left: 0, right: 0, top: persistentHeight, bottom: visibleBottomHeight },
              ),
            ]),
        new Positioned(new ClipRect(toolbar), { left: 0, right: 0, top: 0 }),
        ...(bottom === null
          ? []
          : [
              new Positioned(
                new ClipRect(
                  new ExcludeFocus(
                    new ExcludeSemantics({
                      excluding: visibleBottomHeight <= 0,
                      child: navigationBarPart(context, bottom, keys.bottom),
                    }),
                    { excluding: visibleBottomHeight <= 0 },
                  ),
                ),
                { left: 0, right: 0, bottom: 0, height: visibleBottomHeight },
              ),
            ]),
      ],
      { fit: 'expand' },
    );
    const surface = navBarSurface(
      options,
      navigationBarColor(context, options),
      CupertinoPageScaffoldBackgroundColor.maybeOf(context),
      overlapsContent && this.maxExtent === this.minExtent ? 1 : progress,
    );
    const include = visibleToolbarParts(parts, showMiddle, !searchActive);
    if (showTitle && parts.title) include.push('title');
    if (bottom && visibleBottomHeight > 0) include.push('bottom');
    const bar = paintNavBarSurface(content, surface, options);
    return navigationBarHero(context, bar, {
      keys,
      surface,
      include,
      options,
      searchable: this.layout.searchable,
    });
  }
}
