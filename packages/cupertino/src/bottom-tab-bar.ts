// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
import { invariant } from '@nelyx/core/foundation/errors';
import { FoundationPlatform } from '@nelyx/core/foundation/platform';
import { BorderSide } from '@nelyx/core/framework/painting/borders';
import { Border } from '@nelyx/core/framework/painting/box-border';
import { BoxDecoration } from '@nelyx/core/framework/painting/box-decoration';
import { EdgeInsets } from '@nelyx/core/framework/painting/edge-insets';
import { MediaQuery } from '@nelyx/core/framework/widgets/app-data';
import { BackdropFilter } from '@nelyx/core/framework/widgets/backdrop-filter';
import {
  Center,
  Column,
  DecoratedBox,
  Expanded,
  Padding,
  Row,
  SizedBox,
  Text,
} from '@nelyx/core/framework/widgets/basic';
import { BottomNavigationBarItem } from '@nelyx/core/framework/widgets/bottom-navigation-bar-item';
import { ClipRect } from '@nelyx/core/framework/widgets/clip';
import { ControlInteraction } from '@nelyx/core/framework/widgets/control-interaction';
import { DefaultTextStyle } from '@nelyx/core/framework/widgets/default-text-style';
import { StatelessWidget } from '@nelyx/core/framework/widgets/framework';
import type { BuildContext, Widget, WidgetOptions } from '@nelyx/core/framework/widgets/framework';
import { IconTheme } from '@nelyx/core/framework/widgets/icon-theme';
import { IconThemeData } from '@nelyx/core/framework/widgets/icon-theme-data';
import type { PreferredSizeWidget } from '@nelyx/core/framework/widgets/preferred-size';
import { ExcludeSemantics, Semantics } from '@nelyx/core/framework/widgets/semantics';
import { TextFieldTapRegion } from '@nelyx/core/framework/widgets/tap-region';
import { MouseCursor, SystemMouseCursors } from '@nelyx/core/services/mouse-cursor';
import { Color } from '@nelyx/core/ui/color';
import type { Size } from '@nelyx/core/ui/geometry';
import { ImageFilter } from '@nelyx/core/ui/image-filter';
import { SemanticsRole } from '@nelyx/core/ui/semantics';
import { CupertinoColors } from './colors.ts';
import { CupertinoLocalizations } from './cupertino-localizations.ts';
import { resolveCupertinoColor } from './internal/colors/color-values.ts';
import type { CupertinoColor } from './internal/colors/color-values.ts';
import { CupertinoTheme } from './theme.ts';

export { BottomNavigationBarItem };
export type { BottomNavigationBarItemOptions } from '@nelyx/core/framework/widgets/bottom-navigation-bar-item';

const tabBarHeight = 50;
const blur = ImageFilter.blur({ sigmaX: 10, sigmaY: 10 });
const defaultBorder = new Border({ top: new BorderSide({ color: 0x4d000000, width: 0 }) });
const darkDefaultBorder = new Border({ top: new BorderSide({ color: 0x29000000, width: 0 }) });
const labelPadding = EdgeInsets.only({ bottom: 4 });

export interface CupertinoTabBarOptions extends WidgetOptions {
  readonly items: readonly BottomNavigationBarItem[];
  readonly onTap?: ((index: number) => void) | null;
  readonly currentIndex?: number;
  readonly backgroundColor?: CupertinoColor | null;
  readonly activeColor?: CupertinoColor | null;
  readonly inactiveColor?: CupertinoColor;
  readonly iconSize?: number;
  readonly height?: number;
  readonly border?: Border | null;
}

export class CupertinoTabBar extends StatelessWidget implements PreferredSizeWidget {
  readonly items: readonly BottomNavigationBarItem[];
  readonly onTap: ((index: number) => void) | null;
  readonly currentIndex: number;
  readonly backgroundColor: CupertinoColor | null;
  readonly activeColor: CupertinoColor | null;
  readonly inactiveColor: CupertinoColor;
  readonly iconSize: number;
  readonly height: number;
  readonly border: Border | null;
  readonly preferredSize: Size;

  constructor({
    items,
    onTap = null,
    currentIndex = 0,
    backgroundColor = null,
    activeColor = null,
    inactiveColor = CupertinoColors.inactiveGray,
    iconSize = 30,
    height = tabBarHeight,
    border = defaultBorder,
    key = null,
  }: CupertinoTabBarOptions) {
    super(key);
    invariant(
      items.length >= 2 &&
        Number.isSafeInteger(currentIndex) &&
        currentIndex >= 0 &&
        currentIndex < items.length,
      'invalid-cupertino-tab-bar-index',
      'CupertinoTabBar requires at least two items and a valid currentIndex',
    );
    invariant(
      Number.isFinite(height) && height >= 0,
      'invalid-cupertino-tab-height',
      'Tab bar height must be finite and nonnegative',
    );
    this.items = items;
    this.onTap = onTap;
    this.currentIndex = currentIndex;
    this.backgroundColor = backgroundColor;
    this.activeColor = activeColor;
    this.inactiveColor = inactiveColor;
    this.iconSize = iconSize;
    this.height = height;
    this.border = border;
    this.preferredSize = Object.freeze({ width: 0, height });
  }

  private fill(context: BuildContext): Color {
    return this.backgroundColor == null
      ? new Color(CupertinoTheme.of(context).barBackgroundColor)
      : resolveCupertinoColor(this.backgroundColor, context);
  }

  opaque(context: BuildContext): boolean {
    return this.fill(context).alpha === 255;
  }

  copyWith(options: Partial<CupertinoTabBarOptions> = {}): CupertinoTabBar {
    return new CupertinoTabBar({
      key: options.key ?? this.key,
      items: options.items ?? this.items,
      onTap: options.onTap ?? this.onTap,
      currentIndex: options.currentIndex ?? this.currentIndex,
      backgroundColor: options.backgroundColor ?? this.backgroundColor,
      activeColor: options.activeColor ?? this.activeColor,
      inactiveColor: options.inactiveColor ?? this.inactiveColor,
      iconSize: options.iconSize ?? this.iconSize,
      height: options.height ?? this.height,
      border: options.border ?? this.border,
    });
  }

  override build(context: BuildContext): Widget {
    const theme = CupertinoTheme.of(context);
    const localizations = CupertinoLocalizations.of(context);
    const bottomPadding = MediaQuery.viewPaddingOf(context).bottom;
    const fill = this.fill(context);
    const selectedColor =
      this.activeColor == null
        ? new Color(theme.primaryColor)
        : resolveCupertinoColor(this.activeColor, context);
    const inactiveColor = resolveCupertinoColor(this.inactiveColor, context);
    const border =
      this.border === defaultBorder && theme.brightness === 'dark'
        ? darkDefaultBorder
        : this.border;
    const items = this.items.map((item, index) => {
      const selected = index === this.currentIndex;
      const color = selected ? selectedColor : inactiveColor;
      const ordinal = localizations.tabSemanticsLabel({
        tabIndex: index + 1,
        tabCount: this.items.length,
      });
      const visual = new Padding(
        labelPadding,
        new Column(
          [
            new Expanded(new Center(selected ? item.activeIcon : item.icon)),
            ...(item.label === null ? [] : [new ExcludeSemantics({ child: new Text(item.label) })]),
          ],
          { mainAxisAlignment: 'end' },
        ),
      );
      return new Expanded(
        new TextFieldTapRegion(
          new ControlInteraction(
            () =>
              IconTheme.merge({
                data: new IconThemeData({ color, size: this.iconSize }),
                child: new DefaultTextStyle(
                  theme.textTheme.tabLabelTextStyle.copyWith({ color: color.toARGB32() }),
                  visual,
                ),
              }),
            {
              enabled: this.onTap !== null,
              selected,
              onPressed: this.onTap === null ? null : () => this.onTap!(index),
              requestFocusOnPointer: false,
              mouseCursor: FoundationPlatform.isWeb ? SystemMouseCursors.click : MouseCursor.defer,
              semantics: {
                role: SemanticsRole.tab,
                button: true,
                selected,
                label: item.semanticsLabel ?? item.label,
                hint: ordinal,
                tooltip: FoundationPlatform.isWeb ? ordinal : null,
              },
            },
          ),
        ),
      );
    });
    const tabList = new Semantics({
      container: true,
      explicitChildNodes: true,
      role: SemanticsRole.tabBar,
      child: new Row(items, { crossAxisAlignment: 'stretch' }),
    });
    const surface = new DecoratedBox(
      new SizedBox(
        undefined,
        this.height + bottomPadding,
        new Padding(EdgeInsets.only({ bottom: bottomPadding }), tabList),
      ),
      { decoration: new BoxDecoration({ color: fill.toARGB32(), border }) },
    );
    return fill.alpha === 255
      ? surface
      : new ClipRect(new BackdropFilter({ filter: blur, child: surface }));
  }
}
