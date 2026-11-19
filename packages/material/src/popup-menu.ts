// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Flutter: packages/flutter/lib/src/material/popup_menu.dart
// Revision: 71e4717a61786faab4c7aa39825989305ed29e8a
import { invariant } from '@nelyx/core/foundation/errors';
import { FoundationPlatform } from '@nelyx/core/foundation/platform';
import type { Animation } from '@nelyx/core/framework/animation/animation';
import { AnimationStyle } from '@nelyx/core/framework/animation/animation-style';
import { CurvedAnimation } from '@nelyx/core/framework/animation/animations';
import { Curves, Interval } from '@nelyx/core/framework/animation/curves';
import { CurveTween } from '@nelyx/core/framework/animation/tween';
import { AlignmentDirectional } from '@nelyx/core/framework/painting/alignment';
import { BorderRadius } from '@nelyx/core/framework/painting/border-radius';
import type { BorderRadiusGeometry } from '@nelyx/core/framework/painting/border-radius';
import type { ShapeBorder } from '@nelyx/core/framework/painting/borders';
import { EdgeInsets } from '@nelyx/core/framework/painting/edge-insets';
import type { EdgeInsetsGeometry } from '@nelyx/core/framework/painting/edge-insets';
import { RoundedRectangleBorder } from '@nelyx/core/framework/painting/rounded-rectangle-border';
import { RelativeRect } from '@nelyx/core/framework/rendering/boxes';
import { BoxConstraints } from '@nelyx/core/framework/rendering/constraints';
import { SingleChildLayoutDelegate } from '@nelyx/core/framework/rendering/custom-layout';
import { RenderBox } from '@nelyx/core/framework/rendering/object';
import { Directionality, MediaQuery } from '@nelyx/core/framework/widgets/app-data';
import {
  Align,
  ColoredBox,
  Column,
  ConstrainedBox,
  IntrinsicWidth,
} from '@nelyx/core/framework/widgets/basic';
import { CustomSingleChildLayout } from '@nelyx/core/framework/widgets/custom-layout';
import { DisplayFeatureSubScreen } from '@nelyx/core/framework/widgets/display-feature-sub-screen';
import { Element, State, StatefulWidget } from '@nelyx/core/framework/widgets/framework';
import type { BuildContext, Widget, WidgetOptions } from '@nelyx/core/framework/widgets/framework';
import { GlobalKey } from '@nelyx/core/framework/widgets/global-key';
import { Icon } from '@nelyx/core/framework/widgets/icon';
import { IconTheme } from '@nelyx/core/framework/widgets/icon-theme';
import { InheritedTheme } from '@nelyx/core/framework/widgets/inherited-theme';
import type { CapturedThemes } from '@nelyx/core/framework/widgets/inherited-theme';
import { LayoutBuilder } from '@nelyx/core/framework/widgets/layout-builder';
import { ListenableBuilder } from '@nelyx/core/framework/widgets/listenable-builder';
import { Navigator } from '@nelyx/core/framework/widgets/navigation';
import { PageRoute } from '@nelyx/core/framework/widgets/pages';
import type { RouteSettings } from '@nelyx/core/framework/widgets/pages';
import { SingleBoxScrollView } from '@nelyx/core/framework/widgets/scroll-view';
import { Scrollable } from '@nelyx/core/framework/widgets/scrollable';
import { Semantics } from '@nelyx/core/framework/widgets/semantics';
import { FadeTransition } from '@nelyx/core/framework/widgets/transitions';
import type { Clip } from '@nelyx/core/ui/clip';
import { Color } from '@nelyx/core/ui/color';
import type { Size } from '@nelyx/core/ui/geometry';
import { Offset } from '@nelyx/core/ui/offset';
import { Rect } from '@nelyx/core/ui/rect';
import { SemanticsRole } from '@nelyx/core/ui/semantics';
import type { TextDirection } from '@nelyx/core/ui/typography';
import type { ButtonStyle } from './button-style.ts';
import { kMinInteractiveDimension } from './constants.ts';
import { debugCheckHasMaterialLocalizations } from './debug.ts';
import { IconButton } from './icon-button.ts';
import { Icons } from './icons.ts';
import { InkWell } from './ink-well.ts';
import { MenuItemMeasure } from './internal/menu-item-measure.ts';
import type { PopupMenuEntry } from './internal/popup-menu-entry.ts';
import { Material, MaterialType } from './material.ts';
import { MaterialLocalizations } from './material-localizations.ts';
import { PopupMenuPosition } from './popup-menu-position.ts';
import { PopupMenuTheme } from './popup-menu-theme.ts';
import { MaterialTapTargetSize } from './theme-data.ts';
import { Theme } from './theme.ts';
import { Tooltip } from './tooltip.ts';

export {
  PopupMenuEntry,
  PopupMenuItem,
  PopupMenuItemState,
  CheckedPopupMenuItem,
  PopupMenuDivider,
} from './internal/popup-menu-entry.ts';
export type {
  PopupMenuItemOptions,
  CheckedPopupMenuItemOptions,
  PopupMenuDividerOptions,
} from './internal/popup-menu-entry.ts';
export { PopupMenuPosition, RelativeRect };

const menuDuration = 300;
const menuCloseInterval = new Interval(0, 2 / 3);
const widthStep = 56;
const menuMinWidth = 2 * widthStep;
const menuMaxWidth = 5 * widthStep;
const menuScreenPadding = 8;
const menuPadding = EdgeInsets.symmetric({ vertical: 8 });
const menuShape = new RoundedRectangleBorder({ borderRadius: BorderRadius.circular(4) });
const transparent = new Color(0);

export type PopupMenuPositionBuilder = (
  context: BuildContext,
  constraints: BoxConstraints,
) => RelativeRect;
export type PopupMenuItemSelected<T> = (value: T) => void;
export type PopupMenuCanceled = () => void;
export type PopupMenuItemBuilder<T> = (context: BuildContext) => readonly PopupMenuEntry<T>[];

export interface ShowMenuOptions<T> {
  readonly context: BuildContext;
  readonly position?: RelativeRect | null;
  readonly positionBuilder?: PopupMenuPositionBuilder | null;
  readonly items: readonly PopupMenuEntry<T>[];
  readonly initialValue?: T | null;
  readonly elevation?: number | null;
  readonly shadowColor?: Color | null;
  readonly surfaceTintColor?: Color | null;
  readonly semanticLabel?: string | null;
  readonly shape?: ShapeBorder | null;
  readonly menuPadding?: EdgeInsetsGeometry | null;
  readonly color?: Color | null;
  readonly useRootNavigator?: boolean;
  readonly constraints?: BoxConstraints | null;
  readonly clipBehavior?: Clip;
  readonly routeSettings?: RouteSettings | null;
  readonly popUpAnimationStyle?: AnimationStyle | null;
  readonly requestFocus?: boolean | null;
}

export async function showMenu<T>(options: ShowMenuOptions<T>): Promise<T | null> {
  const { context, useRootNavigator = false, position, positionBuilder, items } = options;
  invariant(items.length > 0, 'empty-popup-menu', 'showMenu needs at least one entry');
  invariant(
    (position != null) !== (positionBuilder != null),
    'invalid-popup-menu-anchor',
    'Provide one popup menu position or position builder',
  );
  debugCheckHasMaterialLocalizations(context);
  const localization = MaterialLocalizations.of(context);
  const platform = FoundationPlatform.defaultTargetPlatform;
  const semanticLabel =
    options.semanticLabel ??
    (platform === 'iOS' || platform === 'macOS' ? null : localization.popupMenuLabel);
  const route = new PopupMenuRoute(
    options,
    semanticLabel,
    localization.menuDismissLabel,
    InheritedTheme.capture(context),
  );
  return (await Navigator.of(context, { rootNavigator: useRootNavigator }).push(route)) ?? null;
}

class PopupMenuRoute<T> extends PageRoute<T> {
  readonly items: readonly PopupMenuEntry<T>[];
  readonly itemSizes: (Size | null)[];
  readonly itemKeys: readonly GlobalKey[];
  readonly selectedIndex: number;
  constructor(
    readonly options: ShowMenuOptions<T>,
    readonly semanticLabel: string | null,
    readonly dismissLabel: string,
    readonly themes: CapturedThemes,
  ) {
    super({
      settings: options.routeSettings ?? null,
      requestFocus: options.requestFocus ?? null,
      barrierDismissible: true,
      traversalEdgeBehavior: 'closedLoop',
      directionalTraversalEdgeBehavior: 'closedLoop',
    });
    this.items = Object.freeze([...options.items]);
    this.itemSizes = this.items.map(() => null);
    this.itemKeys = this.items.map(() => new GlobalKey('Popup menu entry'));
    const initial = options.initialValue;
    this.selectedIndex =
      initial == null ? -1 : this.items.findIndex((entry) => entry.represents(initial));
  }
  override get opaque(): boolean {
    return false;
  }
  override get barrierColor(): null {
    return null;
  }
  override get maintainState(): boolean {
    return true;
  }
  override get barrierLabel(): string {
    return this.dismissLabel;
  }
  override get transitionDuration(): number {
    return this.options.popUpAnimationStyle?.duration ?? menuDuration;
  }
  override get reverseTransitionDuration(): number {
    return this.options.popUpAnimationStyle?.reverseDuration ?? this.transitionDuration;
  }
  override canTransitionFrom(): boolean {
    return false;
  }
  override canTransitionTo(): boolean {
    return false;
  }
  override buildPage(context: BuildContext, animation: Animation<number>): Widget {
    const media = MediaQuery.of(context);
    const safeInsets = MediaQuery.paddingOf(context);
    const direction = Directionality.of(context);
    const panel = this.themes.wrap(new PopupMenuPanel(this, animation));
    return MediaQuery.removePadding({
      context,
      removeLeft: true,
      removeTop: true,
      removeRight: true,
      removeBottom: true,
      child: new LayoutBuilder(
        (layoutContext, constraints) =>
          new CustomSingleChildLayout(
            panel,
            new PopupMenuRouteLayout(
              this.options.positionBuilder?.(layoutContext, constraints) ?? this.options.position!,
              this.itemSizes,
              this.selectedIndex,
              direction,
              safeInsets,
              DisplayFeatureSubScreen.avoidBounds(media),
            ),
          ),
      ),
    });
  }
  override buildTransitions(
    _context: BuildContext,
    _animation: Animation<number>,
    _secondary: Animation<number>,
    child: Widget,
  ): Widget {
    return child;
  }
}

class PopupMenuRouteLayout extends SingleChildLayoutDelegate {
  constructor(
    readonly position: RelativeRect,
    readonly itemSizes: readonly (Size | null)[],
    readonly selectedIndex: number,
    readonly direction: TextDirection,
    readonly padding: EdgeInsets,
    readonly avoidBounds: readonly Rect[],
  ) {
    super();
  }

  private screen(size: Size): Rect {
    const container = Rect.fromLTWH(0, 0, size.width, size.height);
    const anchor = this.position.toRect(container);
    const origin = { x: anchor.x + anchor.width / 2, y: anchor.y + anchor.height / 2 };
    let closest = container,
      distance = Infinity;
    for (const screen of DisplayFeatureSubScreen.subScreensInBounds(container, this.avoidBounds)) {
      const d = Math.hypot(screen.center.dx - origin.x, screen.center.dy - origin.y);
      if (d < distance) {
        distance = d;
        closest = screen;
      }
    }
    return closest;
  }
  override getConstraintsForChild(constraints: BoxConstraints): BoxConstraints {
    const available = this.screen(constraints.biggest);
    return BoxConstraints.loose(available.size).deflate(
      this.padding.add(EdgeInsets.all(menuScreenPadding)),
    );
  }
  override getPositionForChild(size: Size, child: Size): { x: number; y: number } {
    const screen = this.padding
      .add(EdgeInsets.all(menuScreenPadding))
      .deflateRect(this.screen(size));
    const { left, right, top } = this.position;
    const growsLeft = left > right || (left === right && this.direction === 'rtl');
    const x = growsLeft ? size.width - right - child.width : left;
    return {
      x: Math.max(screen.left, Math.min(x, screen.right - child.width)),
      y: Math.max(screen.top, Math.min(top, screen.bottom - child.height)),
    };
  }
  override shouldRelayout(old: PopupMenuRouteLayout): boolean {
    return (
      !this.position.equals(old.position) ||
      this.direction !== old.direction ||
      this.selectedIndex !== old.selectedIndex ||
      !this.padding.equals(old.padding) ||
      this.avoidBounds !== old.avoidBounds ||
      this.itemSizes !== old.itemSizes
    );
  }
}

class PopupMenuPanel<T> extends StatefulWidget {
  constructor(
    readonly route: PopupMenuRoute<T>,
    readonly animation: Animation<number>,
  ) {
    super();
  }
  override createState(): State<PopupMenuPanel<T>> {
    return new PopupMenuPanelState();
  }
}

class PopupMenuPanelState<T> extends State<PopupMenuPanel<T>> {
  private routeAnimation!: Animation<number>;
  private routeCurve: CurvedAnimation | null = null;
  private itemOpacity: Animation<number>[] = [];
  private opacity!: Animation<number>;
  private width!: Animation<number>;
  private height!: Animation<number>;

  override initState(): void {
    super.initState();
    this.setupAnimations();
    const index = this.widget.route.selectedIndex;
    const context = this.context;
    if (index >= 0 && context instanceof Element)
      context.owner.postFrame(() => {
        const target = this.widget.route.itemKeys[index]?.currentContext;
        if (this.mounted && target instanceof Element && target.active)
          void Scrollable.ensureVisible(target);
      });
  }

  override didUpdateWidget(old: PopupMenuPanel<T>): void {
    super.didUpdateWidget(old);
    if (old.animation !== this.widget.animation || old.route !== this.widget.route)
      this.setupAnimations();
  }

  private setupAnimations(): void {
    this.routeCurve?.dispose();
    const { animation, route } = this.widget;
    const style = route.options.popUpAnimationStyle;
    this.routeCurve =
      style === AnimationStyle.noAnimation
        ? null
        : new CurvedAnimation({
            parent: animation,
            curve: style?.curve ?? Curves.linear,
            reverseCurve: style?.reverseCurve ?? menuCloseInterval,
          });
    const parent = (this.routeAnimation = this.routeCurve ?? animation);
    const count = route.items.length,
      unit = 1 / (count + 1.5);
    const phase = (start: number, end: number) =>
      new CurveTween({ curve: new Interval(start, end) }).animate(parent);
    this.opacity = phase(0, 1 / 3);
    this.width = phase(0, unit);
    this.height = phase(0, unit * count);
    this.itemOpacity = route.items.map((_item, index) => {
      const start = (index + 1) * unit;
      return phase(start, Math.min(start + unit * 1.5, 1));
    });
  }

  override build(context: BuildContext): Widget {
    const { route } = this.widget,
      { options } = route;
    const theme = Theme.of(context),
      defaults = theme.colorScheme,
      menuTheme = PopupMenuTheme.of(context);
    const children = route.items.map((entry, index) => {
      const initial = options.initialValue;
      const item =
        initial != null && entry.represents(initial)
          ? new ColoredBox({ color: theme.highlightColor.toARGB32(), child: entry })
          : entry;
      return new MenuItemMeasure(
        new FadeTransition({
          key: route.itemKeys[index]!,
          opacity: this.itemOpacity[index]!,
          child: item,
        }),
        (size) => {
          route.itemSizes[index] = size;
        },
      );
    });
    const scroll = new SingleBoxScrollView({
      padding: options.menuPadding ?? menuTheme.menuPadding ?? menuPadding,
      primary: false,
      child: new Column(children, { mainAxisSize: 'min', crossAxisAlignment: 'stretch' }),
    });
    const content = new ConstrainedBox(
      new IntrinsicWidth(
        new Semantics({
          role: SemanticsRole.menu,
          label: route.semanticLabel ?? '',
          container: true,
          explicitChildNodes: true,
          scopesRoute: true,
          namesRoute: true,
          child: scroll,
        }),
        { stepWidth: widthStep },
      ),
      options.constraints ?? new BoxConstraints(menuMinWidth, menuMaxWidth),
    );
    return new FadeTransition({
      opacity: this.opacity,
      child: new Material({
        type: MaterialType.card,
        color: options.color ?? menuTheme.color ?? new Color(defaults.surfaceContainer),
        shape: options.shape ?? menuTheme.shape ?? menuShape,
        elevation: options.elevation ?? menuTheme.elevation ?? 3,
        shadowColor: options.shadowColor ?? menuTheme.shadowColor ?? new Color(defaults.shadow),
        surfaceTintColor: options.surfaceTintColor ?? menuTheme.surfaceTintColor ?? transparent,
        clipBehavior: options.clipBehavior ?? 'none',
        child: new ListenableBuilder({
          listenable: this.routeAnimation,
          child: content,
          builder: (_context, child) =>
            new Align(child ?? undefined, {
              alignment: AlignmentDirectional.topEnd,
              widthFactor: this.width.value,
              heightFactor: this.height.value,
            }),
        }),
      }),
    });
  }

  override dispose(): void {
    this.routeCurve?.dispose();
    super.dispose();
  }
}

export interface PopupMenuButtonOptions<T>
  extends
    WidgetOptions,
    Omit<
      ShowMenuOptions<T>,
      'context' | 'position' | 'positionBuilder' | 'items' | 'semanticLabel'
    > {
  readonly itemBuilder: PopupMenuItemBuilder<T>;
  readonly onOpened?: (() => void) | null;
  readonly onSelected?: PopupMenuItemSelected<T> | null;
  readonly onCanceled?: PopupMenuCanceled | null;
  readonly tooltip?: string | null;
  readonly padding?: EdgeInsetsGeometry;
  readonly child?: Widget | null;
  readonly borderRadius?: BorderRadiusGeometry | null;
  readonly splashRadius?: number | null;
  readonly icon?: Widget | null;
  readonly iconSize?: number | null;
  readonly iconColor?: Color | null;
  readonly offset?: Offset;
  readonly enabled?: boolean;
  readonly enableFeedback?: boolean | null;
  readonly position?: PopupMenuPosition | null;
  readonly style?: ButtonStyle | null;
}

const triggerPadding = EdgeInsets.all(8);

export class PopupMenuButton<T> extends StatefulWidget {
  constructor(readonly options: PopupMenuButtonOptions<T>) {
    super(options.key ?? null);
    invariant(
      !(options.child && options.icon),
      'invalid-popup-menu-trigger',
      'A popup menu button accepts a child or an icon',
    );
  }
  override createState(): PopupMenuButtonState<T> {
    return new PopupMenuButtonState<T>();
  }
}

export class PopupMenuButtonState<T> extends State<PopupMenuButton<T>> {
  private expanded = false;
  private lastPosition: RelativeRect | null = null;
  private anchor: RenderBox | null = null;
  private anchorOffset = Offset.zero;
  private anchorPosition = PopupMenuPosition.over;
  private iconPadding = 0;

  private readonly positionBuilder: PopupMenuPositionBuilder = (context, constraints) => {
    const overlay = context.findRenderObject(),
      anchor = this.anchor;
    if (anchor?.attached && anchor.hasSize) {
      const target =
        overlay instanceof RenderBox && overlay.attached && anchor.owner === overlay.owner
          ? { ancestor: overlay }
          : {};
      const offset =
        this.anchorPosition === PopupMenuPosition.under
          ? this.anchorOffset.add(new Offset(0, anchor.size.height - this.iconPadding))
          : this.anchorOffset;
      const start = anchor.localToGlobal(offset, target);
      const end = anchor.localToGlobal(
        offset.add(new Offset(anchor.size.width, anchor.size.height)),
        target,
      );
      const rect = Rect.fromPoints(start, end);
      this.lastPosition = RelativeRect.fromSize(rect, constraints.biggest);
    }
    return this.lastPosition ?? RelativeRect.fromSize(Rect.zero, constraints.biggest);
  };

  readonly showButtonMenu = (): void => {
    if (!this.mounted || this.expanded) return;
    const context = this.context;
    if (context instanceof Element && !context.active) return;
    const { options } = this.widget;
    const items = options.itemBuilder(context);
    if (!items.length) return;
    const anchor = context.findRenderObject();
    this.anchor = anchor instanceof RenderBox ? anchor : null;
    this.lastPosition = null;
    this.anchorPosition =
      options.position ?? PopupMenuTheme.of(context).position ?? PopupMenuPosition.over;
    this.anchorOffset = options.offset ?? Offset.zero;
    const padding = (options.padding ?? triggerPadding).resolve(Directionality.of(context));
    this.iconPadding = options.child ? 0 : padding.vertical / 2;
    this.setState(() => {
      this.expanded = true;
    });
    try {
      options.onOpened?.();
    } catch (error) {
      if (this.mounted && (!(context instanceof Element) || context.active))
        this.setState(() => {
          this.expanded = false;
        });
      throw error;
    }
    if (!this.mounted || (context instanceof Element && !context.active)) return;
    const { position: _position, ...menuOptions } = options;
    void showMenu({ ...menuOptions, context, items, positionBuilder: this.positionBuilder }).then(
      (result) => {
        if (!this.mounted || (context instanceof Element && !context.active)) return;
        this.setState(() => {
          this.expanded = false;
        });
        if (result === null) this.widget.options.onCanceled?.();
        else this.widget.options.onSelected?.(result);
      },
      (error: unknown) => {
        if (this.mounted && (!(context instanceof Element) || context.active)) {
          this.setState(() => {
            this.expanded = false;
          });
          context.services.reportError?.(error);
        }
      },
    );
  };

  override build(context: BuildContext): Widget {
    const { options } = this.widget;
    const theme = PopupMenuTheme.of(context),
      iconTheme = IconTheme.of(context);
    const onTap = options.enabled === false ? null : this.showButtonMenu;
    const enableFeedback = options.enableFeedback ?? theme.enableFeedback ?? true;
    const tooltip = options.tooltip ?? MaterialLocalizations.of(context).showMenuTooltip;
    let child: Widget;
    if (options.child) {
      const borderRadius = options.borderRadius?.resolve(Directionality.of(context)) ?? null;
      child = new Tooltip({
        message: tooltip,
        child: new InkWell({
          onTap,
          canRequestFocus:
            onTap !== null || MediaQuery.maybeNavigationModeOf(context) === 'directional',
          enableFeedback,
          borderRadius,
          radius: options.splashRadius ?? null,
          child: options.child,
        }),
      });
      if (options.style?.tapTargetSize === MaterialTapTargetSize.padded)
        child = new ConstrainedBox(
          child,
          new BoxConstraints(kMinInteractiveDimension, Infinity, kMinInteractiveDimension),
        );
    } else {
      child = new IconButton({
        icon: options.icon ?? new Icon(Icons.adaptive.more),
        onPressed: onTap,
        padding: options.padding ?? triggerPadding,
        splashRadius: options.splashRadius ?? null,
        iconSize: options.iconSize ?? theme.iconSize ?? iconTheme.size,
        color: options.iconColor ?? theme.iconColor ?? iconTheme.color,
        tooltip,
        enableFeedback,
        style: options.style ?? null,
      });
    }
    return new Semantics({ expanded: this.expanded, child });
  }
}
