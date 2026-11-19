// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Adapted from Flutter packages/flutter/lib/src/material/navigation_drawer.dart
// at 71e4717a61786faab4c7aa39825989305ed29e8a.
import { AnimationController } from '@nelyx/core/framework/animation/animation-controller';
import { Alignment } from '@nelyx/core/framework/painting/alignment';
import { EdgeInsets } from '@nelyx/core/framework/painting/edge-insets';
import type { EdgeInsetsGeometry } from '@nelyx/core/framework/painting/edge-insets';
import type { ShapeBorder } from '@nelyx/core/framework/painting/borders';
import { StadiumBorder } from '@nelyx/core/framework/painting/stadium-border';
import { TextStyle } from '@nelyx/core/framework/painting/text-style';
import {
  Column,
  Expanded,
  KeyedSubtree,
  Padding,
  Row,
  SizedBox,
  Stack,
} from '@nelyx/core/framework/widgets/basic';
import { DefaultTextStyle } from '@nelyx/core/framework/widgets/default-text-style';
import {
  InheritedWidget,
  StatefulWidget,
  StatelessWidget,
} from '@nelyx/core/framework/widgets/framework';
import type { BuildContext, Widget, WidgetOptions } from '@nelyx/core/framework/widgets/framework';
import { IconTheme } from '@nelyx/core/framework/widgets/icon-theme';
import { IconThemeData } from '@nelyx/core/framework/widgets/icon-theme-data';
import { SafeArea } from '@nelyx/core/framework/widgets/safe-area';
import { ListView } from '@nelyx/core/framework/widgets/scroll-view';
import { Semantics } from '@nelyx/core/framework/widgets/semantics';
import { SingleTickerProviderStateMixin } from '@nelyx/core/framework/widgets/ticker-provider';
import { emptyWidgetStateSet, WidgetState } from '@nelyx/core/framework/widgets/widget-state';
import { Color } from '@nelyx/core/ui/color';
import { Drawer } from './drawer.ts';
import { Ink } from './ink-decoration.ts';
import { InkWell } from './ink-well.ts';
import { Material, MaterialType } from './material.ts';
import { MaterialLocalizations } from './material-localizations.ts';
import { NavigationIndicator } from './navigation-bar.ts';
import { NavigationDrawerTheme } from './navigation-drawer-theme.ts';
import { Theme } from './theme.ts';

const defaultPadding = EdgeInsets.symmetric({ horizontal: 12 });
const defaultShape = new StadiumBorder();
const transparent = new Color(0);

export interface NavigationDrawerOptions extends WidgetOptions {
  readonly children: readonly Widget[];
  readonly header?: Widget | null;
  readonly footer?: Widget | null;
  readonly backgroundColor?: Color | null;
  readonly shadowColor?: Color | null;
  readonly surfaceTintColor?: Color | null;
  readonly elevation?: number | null;
  readonly indicatorColor?: Color | null;
  readonly indicatorShape?: ShapeBorder | null;
  readonly selectedIndex?: number | null;
  readonly onDestinationSelected?: ((index: number) => void) | null;
  readonly tilePadding?: EdgeInsetsGeometry;
}

export class NavigationDrawer extends StatelessWidget {
  readonly children: readonly Widget[];
  readonly header: Widget | null;
  readonly footer: Widget | null;
  readonly backgroundColor: Color | null;
  readonly shadowColor: Color | null;
  readonly surfaceTintColor: Color | null;
  readonly elevation: number | null;
  readonly indicatorColor: Color | null;
  readonly indicatorShape: ShapeBorder | null;
  readonly selectedIndex: number | null;
  readonly onDestinationSelected: ((index: number) => void) | null;
  readonly tilePadding: EdgeInsetsGeometry;

  constructor({
    children,
    header = null,
    footer = null,
    backgroundColor = null,
    shadowColor = null,
    surfaceTintColor = null,
    elevation = null,
    indicatorColor = null,
    indicatorShape = null,
    selectedIndex = 0,
    onDestinationSelected = null,
    tilePadding = defaultPadding,
    key = null,
  }: NavigationDrawerOptions) {
    super(key);
    this.children = children;
    this.header = header;
    this.footer = footer;
    this.backgroundColor = backgroundColor;
    this.shadowColor = shadowColor;
    this.surfaceTintColor = surfaceTintColor;
    this.elevation = elevation;
    this.indicatorColor = indicatorColor;
    this.indicatorShape = indicatorShape;
    this.selectedIndex = selectedIndex;
    this.onDestinationSelected = onDestinationSelected;
    this.tilePadding = tilePadding;
  }

  override build(context: BuildContext): Widget {
    const theme = NavigationDrawerTheme.of(context);
    const count = this.children.filter(
      (child) => child instanceof NavigationDrawerDestination,
    ).length;
    let index = 0;
    const children = this.children.map((child, slot) => {
      if (!(child instanceof NavigationDrawerDestination)) return child;
      return new NavigationDrawerDestinationScope(
        this,
        index++,
        count,
        child,
        KeyedSubtree.wrap(child, slot).key,
      );
    });
    return new Drawer({
      backgroundColor: this.backgroundColor ?? theme.backgroundColor,
      shadowColor: this.shadowColor ?? theme.shadowColor,
      surfaceTintColor: this.surfaceTintColor ?? theme.surfaceTintColor,
      elevation: this.elevation ?? theme.elevation,
      child: new SafeArea({
        bottom: false,
        child: new Column(
          [
            ...(this.header ? [this.header] : []),
            new Expanded(
              new Material({
                type: MaterialType.transparency,
                child: new ListView({ children, primary: false }),
              }),
            ),
            ...(this.footer ? [this.footer] : []),
          ],
          { crossAxisAlignment: 'stretch' },
        ),
      }),
    });
  }
}

class NavigationDrawerDestinationScope extends InheritedWidget {
  constructor(
    readonly drawer: NavigationDrawer,
    readonly index: number,
    readonly count: number,
    child: Widget,
    key: Widget['key'],
  ) {
    super(child, key);
  }
  override updateShouldNotify(old: NavigationDrawerDestinationScope): boolean {
    return this.drawer !== old.drawer || this.index !== old.index || this.count !== old.count;
  }
}

export interface NavigationDrawerDestinationOptions extends WidgetOptions {
  readonly backgroundColor?: Color | null;
  readonly icon: Widget;
  readonly selectedIcon?: Widget | null;
  readonly label: Widget;
  readonly enabled?: boolean;
}

export class NavigationDrawerDestination extends StatelessWidget {
  readonly backgroundColor: Color | null;
  readonly icon: Widget;
  readonly selectedIcon: Widget | null;
  readonly label: Widget;
  readonly enabled: boolean;

  constructor({
    backgroundColor = null,
    icon,
    selectedIcon = null,
    label,
    enabled = true,
    key = null,
  }: NavigationDrawerDestinationOptions) {
    super(key);
    this.backgroundColor = backgroundColor;
    this.icon = icon;
    this.selectedIcon = selectedIcon;
    this.label = label;
    this.enabled = enabled;
  }

  override build(context: BuildContext): Widget {
    return new NavigationDrawerTile(this, context.dependOn(NavigationDrawerDestinationScope));
  }
}

class NavigationDrawerTile extends StatefulWidget {
  constructor(
    readonly destination: NavigationDrawerDestination,
    readonly scope: NavigationDrawerDestinationScope,
  ) {
    super();
  }
  get selected(): boolean {
    return this.scope.drawer.selectedIndex === this.scope.index;
  }
  override createState(): NavigationDrawerTileState {
    return new NavigationDrawerTileState();
  }
}

class NavigationDrawerTileState extends SingleTickerProviderStateMixin<NavigationDrawerTile> {
  private progress!: AnimationController;

  override initState(): void {
    super.initState();
    this.progress = new AnimationController({
      value: this.widget.selected ? 1 : 0,
      duration: 500,
      vsync: this,
    });
  }

  override didUpdateWidget(old: NavigationDrawerTile): void {
    super.didUpdateWidget(old);
    if (old.selected !== this.widget.selected) {
      if (this.widget.selected) this.progress.forward();
      else this.progress.reverse();
    }
  }

  override build(context: BuildContext): Widget {
    const { destination, scope, selected } = this.widget;
    const { drawer, index, count } = scope;
    const { enabled, icon, selectedIcon, label, backgroundColor } = destination;
    const theme = NavigationDrawerTheme.of(context);
    const { colorScheme: colors, textTheme } = Theme.of(context);
    const contextStates = emptyWidgetStateSet();
    if (!enabled) contextStates.add(WidgetState.disabled);
    else if (selected) contextStates.add(WidgetState.selected);
    const unselectedColor = new Color(colors.onSurfaceVariant);
    const textAndIconColor = !enabled
      ? unselectedColor.withOpacity(0.38)
      : selected
        ? new Color(colors.onSecondaryContainer)
        : unselectedColor;
    const iconTheme =
      theme.iconTheme?.resolve(contextStates) ??
      new IconThemeData({ size: 24, color: textAndIconColor });
    const labelStyle =
      theme.labelTextStyle?.resolve(contextStates) ??
      (textTheme.labelLarge ?? new TextStyle()).copyWith({ color: textAndIconColor.toARGB32() });
    const indicatorShape = drawer.indicatorShape ?? theme.indicatorShape ?? defaultShape;
    const activate = enabled ? () => drawer.onDestinationSelected?.(index) : null;
    const ordinal = MaterialLocalizations.of(context).tabLabel({
      tabIndex: index + 1,
      tabCount: count,
    });
    const tile = new Padding(
      drawer.tilePadding,
      new Semantics({
        container: true,
        button: true,
        enabled,
        selected,
        label: ordinal,
        onTap: activate,
        child: new SizedBox(
          undefined,
          theme.tileHeight ?? 56,
          new InkWell({
            customBorder: indicatorShape,
            highlightColor: transparent,
            excludeFromSemantics: true,
            canRequestFocus: enabled,
            onTap: activate,
            child: new Stack(
              [
                new NavigationIndicator({
                  animation: this.progress,
                  color:
                    drawer.indicatorColor ??
                    theme.indicatorColor ??
                    new Color(colors.secondaryContainer),
                  shape: indicatorShape,
                  width: theme.indicatorSize?.width ?? 336,
                  height: theme.indicatorSize?.height ?? 56,
                }),
                new Row([
                  new SizedBox(16),
                  IconTheme.merge({
                    data: iconTheme,
                    child: selected ? (selectedIcon ?? icon) : icon,
                  }),
                  new SizedBox(12),
                  new Expanded(new DefaultTextStyle(labelStyle, label)),
                ]),
              ],
              { alignment: Alignment.center },
            ),
          }),
        ),
      }),
    );
    return backgroundColor ? new Ink({ color: backgroundColor, child: tile }) : tile;
  }

  override dispose(): void {
    this.progress.dispose();
    super.dispose();
  }
}
