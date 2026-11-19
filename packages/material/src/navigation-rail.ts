// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
import { invariant } from '@nelyx/core/foundation/errors';
import type { Animation } from '@nelyx/core/framework/animation/animation';
import { AnimationController } from '@nelyx/core/framework/animation/animation-controller';
import { Curves } from '@nelyx/core/framework/animation/curves';
import { CurvedAnimation } from '@nelyx/core/framework/animation/animations';
import { Alignment } from '@nelyx/core/framework/painting/alignment';
import type { ShapeBorder } from '@nelyx/core/framework/painting/borders';
import { ColorShapeDecoration } from '@nelyx/core/framework/painting/color-shape-decoration';
import { EdgeInsets } from '@nelyx/core/framework/painting/edge-insets';
import type { EdgeInsetsGeometry } from '@nelyx/core/framework/painting/edge-insets';
import { StadiumBorder } from '@nelyx/core/framework/painting/stadium-border';
import { TextStyle } from '@nelyx/core/framework/painting/text-style';
import type { MainAxisAlignment } from '@nelyx/core/framework/rendering/boxes';
import {
  Align,
  Center,
  Column,
  DecoratedBox,
  Expanded,
  Padding,
  Positioned,
  Row,
  SizedBox,
  Stack,
} from '@nelyx/core/framework/widgets/basic';
import { ClipRect } from '@nelyx/core/framework/widgets/clip';
import { DefaultTextStyle } from '@nelyx/core/framework/widgets/default-text-style';
import { InheritedWidget, StatefulWidget } from '@nelyx/core/framework/widgets/framework';
import type {
  BuildContext,
  State,
  Widget,
  WidgetOptions,
} from '@nelyx/core/framework/widgets/framework';
import { IconTheme } from '@nelyx/core/framework/widgets/icon-theme';
import { IconThemeData } from '@nelyx/core/framework/widgets/icon-theme-data';
import { AnimatedOpacity, AnimatedScale } from '@nelyx/core/framework/widgets/implicit-animations';
import { ListenableBuilder } from '@nelyx/core/framework/widgets/listenable-builder';
import { Opacity } from '@nelyx/core/framework/widgets/opacity';
import { ListView } from '@nelyx/core/framework/widgets/scroll-view';
import { ExcludeSemantics, Semantics } from '@nelyx/core/framework/widgets/semantics';
import { SingleTickerProviderStateMixin } from '@nelyx/core/framework/widgets/ticker-provider';
import { Color } from '@nelyx/core/ui/color';
import { SemanticsRole } from '@nelyx/core/ui/semantics';
import { InkWell } from './ink-well.ts';
import { Material } from './material.ts';
import { NavigationRailLabelType } from './navigation-rail-label-type.ts';
import { NavigationRailTheme } from './navigation-rail-theme.ts';
import type { NavigationRailThemeData } from './navigation-rail-theme.ts';
import { Theme } from './theme.ts';

export { NavigationRailLabelType } from './navigation-rail-label-type.ts';

const duration = 200;
const indicatorShape = new StadiumBorder();

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

class NavigationRailState extends SingleTickerProviderStateMixin<NavigationRail> {
  private controller!: AnimationController;
  private extension!: CurvedAnimation;

  override initState(): void {
    super.initState();
    this.controller = new AnimationController({
      duration,
      vsync: this,
      value: this.widget.extended ? 1 : 0,
    });
    this.extension = new CurvedAnimation({ parent: this.controller, curve: Curves.easeInOut });
  }

  override didUpdateWidget(old: NavigationRail): void {
    super.didUpdateWidget(old);
    if (old.extended === this.widget.extended) return;
    if (this.widget.extended) this.controller.forward();
    else this.controller.reverse();
  }

  override dispose(): void {
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
    const rail = NavigationRailTheme.of(context);
    const { colorScheme } = Theme.of(context);
    const narrowWidth = options.minWidth ?? rail.minWidth ?? 80;
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
        ...(leading && !leadingAtTop ? [new Center(leading)] : []),
        ...(destinations.length
          ? [
              new Semantics({
                container: true,
                explicitChildNodes: true,
                role: SemanticsRole.tabBar,
                child: new Column(
                  destinations.map((destination, index) =>
                    this.buildDestination(
                      context,
                      destination,
                      index,
                      rail,
                      narrowWidth,
                      fraction,
                      labelType,
                    ),
                  ),
                  { mainSize: 'min', crossAlign: 'stretch' },
                ),
              }),
            ]
          : []),
        ...(trailing && !trailingAtBottom ? [new Center(trailing)] : []),
      ],
      { mainSize: 'min', crossAlign: 'stretch' },
    );
    if (options.scrollable)
      group = new ListView({
        shrinkWrap: true,
        primary: false,
        children: [group],
        padding: EdgeInsets.zero,
      });
    const alignment = options.groupAlignment ?? rail.groupAlignment ?? -1;
    const start = leading && leadingAtTop ? [new Center(leading)] : [];
    const end = trailing && trailingAtBottom ? [new Center(trailing)] : [];
    const body =
      options.mainAxisAlignment && !options.scrollable
        ? new Column([...start, group, ...end], {
            mainAxisAlignment: options.mainAxisAlignment,
            crossAlign: 'stretch',
          })
        : new Column(
            [
              ...start,
              new Expanded(new Align(group, { alignment: new Alignment(0, alignment) })),
              ...end,
            ],
            { crossAlign: 'stretch' },
          );
    return new Material({
      color: options.backgroundColor ?? rail.backgroundColor ?? new Color(colorScheme.surface),
      elevation,
      child: new SizedBox(
        width,
        undefined,
        new Padding(EdgeInsets.only({ top: 8, bottom: 8 }), body),
      ),
    });
  }

  private buildDestination(
    context: BuildContext,
    destination: NavigationRailDestination,
    index: number,
    theme: NavigationRailThemeData,
    narrowWidth: number,
    fraction: number,
    labelType: NavigationRailLabelType,
  ): Widget {
    const { options, selectedIndex } = this.widget;
    const selected = index === selectedIndex;
    const { colorScheme: colors, textTheme } = Theme.of(context);
    const iconStyle =
      (selected
        ? (options.selectedIconTheme ?? theme.selectedIconTheme)
        : (options.unselectedIconTheme ?? theme.unselectedIconTheme)) ??
      new IconThemeData({
        size: 24,
        color: new Color(selected ? colors.onSecondaryContainer : colors.onSurfaceVariant),
      });
    const icons = destination.disabled
      ? iconStyle.copyWith({ opacity: 0.38 * (iconStyle.opacity ?? 1) })
      : iconStyle;
    const textStyle =
      (selected
        ? (options.selectedLabelTextStyle ?? theme.selectedLabelTextStyle)
        : (options.unselectedLabelTextStyle ?? theme.unselectedLabelTextStyle)) ??
      (textTheme.labelMedium ?? new TextStyle({ fontSize: 12 })).copyWith({
        color: colors.onSurface,
      });
    const labelStyle =
      destination.disabled && textStyle.color !== null
        ? textStyle.copyWith({ color: new Color(textStyle.color).withOpacity(0.38).toARGB32() })
        : textStyle;
    const label = new DefaultTextStyle(labelStyle, destination.label, {
      maxLines: 1,
      overflow: 'ellipsis',
      softWrap: false,
    });
    const shape =
      destination.indicatorShape ??
      options.indicatorShape ??
      theme.indicatorShape ??
      indicatorShape;
    const color =
      destination.indicatorColor ??
      options.indicatorColor ??
      theme.indicatorColor ??
      new Color(colors.secondaryContainer);
    const showIndicator = options.useIndicator ?? theme.useIndicator ?? true;
    const icon = new SizedBox(
      narrowWidth,
      40,
      new Stack(
        [
          ...(showIndicator
            ? [
                new AnimatedScale({
                  duration,
                  scale: selected ? 1 : 0.55,
                  child: new AnimatedOpacity({
                    duration,
                    opacity: selected ? 1 : 0,
                    child: new SizedBox(
                      56,
                      32,
                      new DecoratedBox(undefined, {
                        decoration: new ColorShapeDecoration(shape, color),
                      }),
                    ),
                  }),
                }),
              ]
            : []),
          new ExcludeSemantics(
            new IconTheme(icons, selected ? destination.selectedIcon : destination.icon),
          ),
        ],
        { alignment: Alignment.center },
      ),
    );
    let visual: Widget;
    if (fraction > 0) {
      visual = new SizedBox(
        undefined,
        56,
        new Row([
          icon,
          new Expanded(
            new ClipRect(new Opacity(label, { opacity: fraction, alwaysIncludeSemantics: true })),
          ),
        ]),
      );
    } else if (
      labelType === NavigationRailLabelType.all ||
      (labelType === NavigationRailLabelType.selected && selected)
    ) {
      visual = new Column([icon, label], { mainSize: 'min', spacing: 2 });
    } else {
      visual = new Stack([
        new SizedBox(undefined, 56, new Center(icon)),
        Positioned.fill(new Opacity(label, { opacity: 0, alwaysIncludeSemantics: true })),
      ]);
    }
    const activate = destination.disabled ? null : () => options.onDestinationSelected?.(index);
    return new Semantics({
      container: true,
      role: SemanticsRole.tab,
      selected,
      enabled: !destination.disabled,
      onTap: activate,
      child: new InkWell({
        onTap: activate,
        canRequestFocus: !destination.disabled,
        excludeFromSemantics: true,
        child: new Padding(destination.padding ?? EdgeInsets.symmetric({ vertical: 4 }), visual),
      }),
    });
  }
}
