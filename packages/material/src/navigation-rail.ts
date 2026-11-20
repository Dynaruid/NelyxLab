// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Flutter: packages/flutter/lib/src/material/navigation_rail.dart @ 71e4717a61786faab4c7aa39825989305ed29e8a
import { invariant } from '@nelyx/core/foundation/errors';
import type { Animation } from '@nelyx/core/framework/animation/animation';
import { AnimationController } from '@nelyx/core/framework/animation/animation-controller';
import { Curves, Interval } from '@nelyx/core/framework/animation/curves';
import { CurvedAnimation } from '@nelyx/core/framework/animation/animations';
import { Alignment, AlignmentDirectional } from '@nelyx/core/framework/painting/alignment';
import type { ShapeBorder } from '@nelyx/core/framework/painting/borders';
import { EdgeInsets } from '@nelyx/core/framework/painting/edge-insets';
import type { EdgeInsetsGeometry } from '@nelyx/core/framework/painting/edge-insets';
import { StadiumBorder } from '@nelyx/core/framework/painting/stadium-border';
import { CircleBorder } from '@nelyx/core/framework/painting/circle-border';
import { TextStyle } from '@nelyx/core/framework/painting/text-style';
import type { MainAxisAlignment } from '@nelyx/core/framework/rendering/boxes';
import { BoxConstraints } from '@nelyx/core/framework/rendering/constraints';
import type { RenderBox } from '@nelyx/core/framework/rendering/object';
import { Directionality } from '@nelyx/core/framework/widgets/app-data';
import {
  Align,
  Column,
  Center,
  ConstrainedBox,
  Flexible,
  Padding,
  Positioned,
  Row,
  SizedBox,
  Stack,
} from '@nelyx/core/framework/widgets/basic';
import { ClipRect } from '@nelyx/core/framework/widgets/clip';
import { DefaultTextStyle } from '@nelyx/core/framework/widgets/default-text-style';
import { ExcludeFocus } from '@nelyx/core/framework/widgets/focus-scope';
import { InheritedWidget, StatefulWidget } from '@nelyx/core/framework/widgets/framework';
import type {
  BuildContext,
  State,
  Widget,
  WidgetOptions,
} from '@nelyx/core/framework/widgets/framework';
import { IconTheme } from '@nelyx/core/framework/widgets/icon-theme';
import { IconThemeData } from '@nelyx/core/framework/widgets/icon-theme-data';
import { ListenableBuilder } from '@nelyx/core/framework/widgets/listenable-builder';
import { Opacity } from '@nelyx/core/framework/widgets/opacity';
import { IgnorePointer } from '@nelyx/core/framework/widgets/pointer-blocking';
import { SafeArea } from '@nelyx/core/framework/widgets/safe-area';
import { SingleBoxScrollView } from '@nelyx/core/framework/widgets/scroll-view';
import { ExcludeSemantics, Semantics } from '@nelyx/core/framework/widgets/semantics';
import { TickerProviderStateMixin } from '@nelyx/core/framework/widgets/ticker-provider';
import { Color } from '@nelyx/core/ui/color';
import { Rect } from '@nelyx/core/ui/rect';
import { SemanticsRole } from '@nelyx/core/ui/semantics';
import { MaterialLocalizations } from './material-localizations.ts';
import type { RectCallback } from './ink-feature.ts';
import { InkWell } from './ink-well.ts';
import type { InkWellOptions } from './ink-well.ts';
import { Material, MaterialType } from './material.ts';
import { NavigationIndicator } from './navigation-bar.ts';
import { NavigationRailLabelType } from './navigation-rail-label-type.ts';
import { NavigationRailTheme } from './navigation-rail-theme.ts';
import type { NavigationRailThemeData } from './navigation-rail-theme.ts';
import { Theme } from './theme.ts';

export { NavigationRailLabelType } from './navigation-rail-label-type.ts';

const duration = 200;
const indicatorShape = new StadiumBorder();
const circularIndicatorShape = new CircleBorder();
const indicatorWidth = 56;
const indicatorHeight = 32;
const horizontalPadding = 8;
const verticalSpacing = 12;
const iconLabelSpacing = 4;
const material2PaddingNoLabel = 24;
const material2PaddingWithLabel = 16;
const spacer = new SizedBox(undefined, 8);
const labelFadeIn = new Interval(0.25, 0.75);
const labelFadeOut = new Interval(0.75, 1);
const expandedLabelFade = new Interval(0, 0.25);

export interface NavigationRailDestinationOptions {
  readonly icon: Widget;
  readonly selectedIcon?: Widget | null;
  readonly label: Widget;
  readonly indicatorColor?: Color | null;
  readonly indicatorShape?: ShapeBorder | null;
  readonly padding?: EdgeInsetsGeometry | null;
  readonly disabled?: boolean;
}

export class NavigationRailDestination {
  readonly icon: Widget;
  readonly selectedIcon: Widget;
  readonly label: Widget;
  readonly indicatorColor: Color | null;
  readonly indicatorShape: ShapeBorder | null;
  readonly padding: EdgeInsetsGeometry | null;
  readonly disabled: boolean;

  constructor({
    icon,
    label,
    selectedIcon = null,
    indicatorColor = null,
    indicatorShape = null,
    padding = null,
    disabled = false,
  }: NavigationRailDestinationOptions) {
    this.icon = icon;
    this.selectedIcon = selectedIcon ?? icon;
    this.label = label;
    this.indicatorColor = indicatorColor;
    this.indicatorShape = indicatorShape;
    this.padding = padding;
    this.disabled = disabled;
  }
}

export interface NavigationRailOptions extends WidgetOptions {
  readonly backgroundColor?: Color | null;
  readonly extended?: boolean;
  readonly leading?: Widget | null;
  readonly trailing?: Widget | null;
  readonly destinations: readonly NavigationRailDestination[];
  readonly selectedIndex: number | null;
  readonly onDestinationSelected?: ((index: number) => void) | null;
  readonly elevation?: number | null;
  readonly groupAlignment?: number | null;
  readonly labelType?: NavigationRailLabelType | null;
  readonly unselectedLabelTextStyle?: TextStyle | null;
  readonly selectedLabelTextStyle?: TextStyle | null;
  readonly unselectedIconTheme?: IconThemeData | null;
  readonly selectedIconTheme?: IconThemeData | null;
  readonly minWidth?: number | null;
  readonly minExtendedWidth?: number | null;
  readonly useIndicator?: boolean | null;
  readonly indicatorColor?: Color | null;
  readonly indicatorShape?: ShapeBorder | null;
  readonly leadingAtTop?: boolean;
  readonly trailingAtBottom?: boolean;
  readonly scrollable?: boolean;
  readonly mainAxisAlignment?: MainAxisAlignment | null;
}

export class NavigationRail extends StatefulWidget {
  readonly options: Readonly<NavigationRailOptions>;
  readonly destinations: readonly NavigationRailDestination[];
  readonly selectedIndex: number | null;
  readonly extended: boolean;

  constructor(options: NavigationRailOptions) {
    super(options.key ?? null);
    const { destinations, selectedIndex } = options;
    invariant(
      selectedIndex === null ||
        (Number.isSafeInteger(selectedIndex) &&
          selectedIndex >= 0 &&
          selectedIndex < destinations.length),
      'invalid-navigation-rail-selection',
      'NavigationRail selection must index a destination',
    );
    invariant(
      !options.extended ||
        options.labelType == null ||
        options.labelType === NavigationRailLabelType.none,
      'invalid-navigation-rail-labels',
      'Extended NavigationRail requires labelType none',
    );
    this.destinations = Object.freeze([...destinations]);
    this.selectedIndex = selectedIndex;
    this.extended = options.extended ?? false;
    this.options = Object.freeze({ ...options, destinations: this.destinations });
  }

  static extendedAnimation(context: BuildContext): Animation<number> {
    return context.dependOn(RailExtension).animation;
  }

  override createState(): State<NavigationRail> {
    return new NavigationRailState();
  }
}

class RailExtension extends InheritedWidget {
  constructor(
    readonly animation: Animation<number>,
    child: Widget,
  ) {
    super(child);
  }
  override updateShouldNotify(old: RailExtension): boolean {
    return old.animation !== this.animation;
  }
}

class NavigationRailState extends TickerProviderStateMixin<NavigationRail> {
  private controller!: AnimationController;
  private extension!: CurvedAnimation;
  private selection: AnimationController[] = [];

  override initState(): void {
    super.initState();
    this.controller = new AnimationController({
      duration,
      vsync: this,
      value: this.widget.extended ? 1 : 0,
    });
    this.extension = new CurvedAnimation({ parent: this.controller, curve: Curves.easeInOut });
    this.resetSelection();
  }

  override didUpdateWidget(old: NavigationRail): void {
    super.didUpdateWidget(old);
    const { extended, destinations, selectedIndex } = this.widget;
    if (old.extended !== extended) {
      if (extended) this.controller.forward();
      else this.controller.reverse();
    }
    if (old.destinations.length !== destinations.length) this.resetSelection();
    else if (old.selectedIndex !== selectedIndex) {
      if (old.selectedIndex !== null) this.selection[old.selectedIndex]!.reverse();
      if (selectedIndex !== null) this.selection[selectedIndex]!.forward();
    }
  }

  private resetSelection(): void {
    for (const controller of this.selection) controller.dispose();
    this.selection = this.widget.destinations.map(
      (_, index) =>
        new AnimationController({
          duration,
          vsync: this,
          value: this.widget.selectedIndex === index ? 1 : 0,
        }),
    );
  }

  override dispose(): void {
    for (const controller of this.selection) controller.dispose();
    this.extension.dispose();
    this.controller.dispose();
    super.dispose();
  }

  override build(): Widget {
    return new RailExtension(
      this.extension,
      new ListenableBuilder(this.extension, (context) => this.buildRail(context)),
    );
  }

  private buildRail(context: BuildContext): Widget {
    const { options, destinations, extended } = this.widget;
    const direction = Directionality.of(context);
    const localizations = MaterialLocalizations.of(context);
    const rail = NavigationRailTheme.of(context);
    const { colorScheme, useMaterial3 } = Theme.of(context);
    const narrowWidth = options.minWidth ?? rail.minWidth ?? (useMaterial3 ? 80 : 72);
    const wideWidth = options.minExtendedWidth ?? rail.minExtendedWidth ?? 256;
    const elevation = options.elevation ?? rail.elevation ?? 0;
    invariant(
      Number.isFinite(narrowWidth) &&
        narrowWidth > 0 &&
        Number.isFinite(wideWidth) &&
        wideWidth >= narrowWidth &&
        Number.isFinite(elevation) &&
        elevation >= 0,
      'invalid-navigation-rail-size',
      'NavigationRail requires finite widths and nonnegative elevation',
    );
    const fraction = this.extension.value;
    const width = narrowWidth + (wideWidth - narrowWidth) * fraction;
    const labelType =
      extended || fraction > 0
        ? NavigationRailLabelType.none
        : (options.labelType ?? rail.labelType ?? NavigationRailLabelType.none);
    const leading = options.leading;
    const trailing = options.trailing;
    const leadingAtTop = options.leadingAtTop ?? true;
    const trailingAtBottom = options.trailingAtBottom ?? false;
    let group: Widget = new Column(
      [
        ...(leading && !leadingAtTop ? [leading, spacer] : []),
        ...(destinations.length
          ? [
              new Semantics({
                container: true,
                explicitChildNodes: true,
                role: SemanticsRole.tabBar,
                child: new Column(
                  destinations.map((destination, index) => {
                    const selection = this.selection[index]!;
                    return new ListenableBuilder(selection, (context) =>
                      this.buildDestination(
                        context,
                        destination,
                        index,
                        selection,
                        rail,
                        narrowWidth,
                        width,
                        fraction,
                        labelType,
                        localizations.tabLabel({
                          tabIndex: index + 1,
                          tabCount: destinations.length,
                        }),
                      ),
                    );
                  }),
                  { mainSize: 'min' },
                ),
              }),
            ]
          : []),
        ...(trailing && !trailingAtBottom ? [trailing] : []),
      ],
      {
        mainSize: options.mainAxisAlignment == null ? 'min' : 'max',
        mainAxisAlignment: options.mainAxisAlignment ?? 'start',
      },
    );
    if (options.scrollable)
      group = new SingleBoxScrollView({
        primary: false,
        child: group,
      });
    const alignment = options.groupAlignment ?? rail.groupAlignment ?? -1;
    const start = leading && leadingAtTop ? [spacer, leading, spacer] : [spacer];
    const end = trailing && trailingAtBottom ? [trailing] : [];
    const body = new Column([
      ...start,
      new Flexible(new Align(group, { alignment: new Alignment(0, alignment), widthFactor: 1 })),
      ...end,
    ]);
    return new Material({
      color: options.backgroundColor ?? rail.backgroundColor ?? new Color(colorScheme.surface),
      elevation,
      child: new SafeArea({
        left: direction === 'ltr',
        right: direction === 'rtl',
        child: new ConstrainedBox(body, new BoxConstraints(width)),
      }),
    });
  }

  private buildDestination(
    context: BuildContext,
    destination: NavigationRailDestination,
    index: number,
    animation: Animation<number>,
    theme: NavigationRailThemeData,
    narrowWidth: number,
    minimumWidth: number,
    fraction: number,
    labelType: NavigationRailLabelType,
    indexLabel: string,
  ): Widget {
    const { options, selectedIndex } = this.widget;
    const selected = index === selectedIndex;
    const { colorScheme: colors, textTheme, useMaterial3 } = Theme.of(context);
    const disabledColor = new Color(colors.onSurface).withOpacity(0.38);
    const iconStyle =
      (selected
        ? (options.selectedIconTheme ?? theme.selectedIconTheme)
        : (options.unselectedIconTheme ?? theme.unselectedIconTheme)) ??
      new IconThemeData({
        size: 24,
        color: new Color(
          useMaterial3
            ? selected
              ? colors.onSecondaryContainer
              : colors.onSurfaceVariant
            : selected
              ? colors.primary
              : colors.onSurface,
        ),
      });
    const effectiveIconStyle =
      !useMaterial3 && !selected && iconStyle.opacity == null
        ? iconStyle.copyWith({ opacity: 0.64 })
        : iconStyle;
    const icons = destination.disabled
      ? effectiveIconStyle.copyWith({ color: disabledColor })
      : effectiveIconStyle;
    const textStyle =
      (selected
        ? (options.selectedLabelTextStyle ?? theme.selectedLabelTextStyle)
        : (options.unselectedLabelTextStyle ?? theme.unselectedLabelTextStyle)) ??
      (
        (useMaterial3 ? textTheme.labelMedium : textTheme.bodyLarge) ??
        new TextStyle({ fontSize: 12 })
      ).copyWith({
        color: useMaterial3
          ? colors.onSurface
          : selected
            ? colors.primary
            : new Color(colors.onSurface).withOpacity(0.64).toARGB32(),
      });
    const labelStyle = destination.disabled
      ? textStyle.copyWith({ color: disabledColor.toARGB32() })
      : textStyle;
    const label = new DefaultTextStyle(labelStyle, destination.label, {
      maxLines: 1,
      overflow: 'ellipsis',
      softWrap: false,
    });
    const noLabel = labelType === NavigationRailLabelType.none;
    const circular = !useMaterial3 && noLabel;
    const shape = circular
      ? circularIndicatorShape
      : (destination.indicatorShape ??
        options.indicatorShape ??
        theme.indicatorShape ??
        indicatorShape);
    const color =
      destination.indicatorColor ??
      options.indicatorColor ??
      theme.indicatorColor ??
      new Color(useMaterial3 ? colors.secondaryContainer : colors.secondary);
    const showIndicator = options.useIndicator ?? theme.useIndicator ?? useMaterial3;
    const glyph = new ExcludeSemantics(
      new IconTheme(icons, selected ? destination.selectedIcon : destination.icon),
    );
    const icon = showIndicator
      ? new Stack(
          [
            new NavigationIndicator({
              width: indicatorWidth,
              height: circular ? indicatorWidth : indicatorHeight,
              shape,
              color,
              animation,
            }),
            glyph,
          ],
          { alignment: Alignment.center },
        )
      : glyph;
    const direction = Directionality.of(context);
    const pad = (
      destination.padding ??
      (labelType === NavigationRailLabelType.none
        ? EdgeInsets.zero
        : EdgeInsets.symmetric({ horizontal: horizontalPadding }))
    ).resolve(direction);
    const iconOffset = Math.max(0, ((icons.size ?? 24) - indicatorHeight) / 2);
    const withLabel = labelType === NavigationRailLabelType.all;
    const labelHeight = withLabel ? 1 : Curves.easeInOut.transform(animation.value);
    const labelPadding =
      material2PaddingNoLabel + (material2PaddingWithLabel - material2PaddingNoLabel) * labelHeight;
    const iconSpacing = useMaterial3 ? verticalSpacing / 2 : 0;
    const caption = (opacity: number) =>
      new ExcludeFocus(
        new IgnorePointer(
          new Opacity(label, {
            opacity,
            alwaysIncludeSemantics: true,
          }),
        ),
        { excluding: opacity === 0 },
      );
    let visual: Widget;
    if (noLabel) {
      const iconPart = new Column(
        [
          new SizedBox(undefined, iconSpacing),
          new SizedBox(narrowWidth, useMaterial3 ? undefined : narrowWidth, new Center(icon)),
          new SizedBox(undefined, iconSpacing),
        ],
        { mainSize: 'min' },
      );
      visual =
        fraction === 0
          ? new Stack([iconPart, Positioned.fill(caption(0))])
          : new ConstrainedBox(
              new ClipRect(
                new Row(
                  [
                    iconPart,
                    new Flexible(
                      new Align(caption(expandedLabelFade.transform(fraction)), {
                        widthFactor: fraction,
                        heightFactor: 1,
                        alignment: AlignmentDirectional.centerStart,
                      }),
                    ),
                    new SizedBox(horizontalPadding * fraction),
                  ],
                  { mainSize: 'min' },
                ),
              ),
              new BoxConstraints(minimumWidth),
            );
    } else {
      visual = new ClipRect(
        new Column(
          [
            ...(useMaterial3 ? [] : [new SizedBox(undefined, labelPadding)]),
            icon,
            new SizedBox(undefined, useMaterial3 ? labelHeight * iconLabelSpacing : 0),
            ...(labelHeight === 0
              ? []
              : [
                  new Align(
                    caption(
                      withLabel
                        ? 1
                        : (selected ? labelFadeIn : labelFadeOut).transform(animation.value),
                    ),
                    {
                      alignment: Alignment.topCenter,
                      widthFactor: 1,
                      heightFactor: labelHeight,
                    },
                  ),
                ]),
            new SizedBox(undefined, useMaterial3 ? verticalSpacing : labelPadding),
          ],
          { mainSize: 'min' },
        ),
      );
      if (labelHeight === 0) visual = new Stack([visual, Positioned.fill(caption(0))]);
    }
    const activate = destination.disabled ? null : () => options.onDestinationSelected?.(index);
    const primary = new Color(colors.primary);
    const inkCenter =
      noLabel && fraction > 0
        ? (direction === 'ltr' ? pad.left : pad.right) + narrowWidth / 2
        : null;
    const padded = new Padding(pad, visual);
    return new Semantics({
      container: true,
      role: SemanticsRole.tab,
      selected,
      enabled: !destination.disabled,
      onTap: activate,
      child: new Stack(
        [
          new ExcludeFocus(
            new Material({
              type: MaterialType.transparency,
              child: new RailIndicatorInkWell(
                {
                  onTap: activate,
                  canRequestFocus: !destination.disabled,
                  excludeFromSemantics: true,
                  customBorder: useMaterial3 && showIndicator ? shape : null,
                  splashColor: primary.alpha < 255 ? primary : primary.withOpacity(0.12),
                  hoverColor: primary.alpha < 255 ? primary : primary.withOpacity(0.04),
                  child: noLabel
                    ? padded
                    : new ConstrainedBox(
                        padded,
                        new BoxConstraints(narrowWidth, Infinity, useMaterial3 ? 0 : narrowWidth),
                      ),
                },
                direction,
                inkCenter,
                pad.top + iconOffset + (noLabel ? iconSpacing : 0),
              ),
            }),
            { excluding: destination.disabled },
          ),
          new Semantics({ label: indexLabel }),
        ],
        { fit: 'passthrough' },
      ),
    });
  }
}

class RailIndicatorInkWell extends InkWell {
  constructor(
    options: InkWellOptions,
    private readonly direction: 'ltr' | 'rtl',
    private readonly center: number | null,
    private readonly top: number,
  ) {
    super(options);
  }

  override getRectCallback(reference: RenderBox): RectCallback {
    return () => {
      const width = reference.size.width;
      const center = this.center ?? width / 2;
      const x = this.direction === 'ltr' ? center : width - center;
      return Rect.fromLTWH(x - indicatorWidth / 2, this.top, indicatorWidth, indicatorHeight);
    };
  }
}
