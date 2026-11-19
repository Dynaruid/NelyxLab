// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
import { invariant } from '@nelyx/core/foundation/errors';
import type { Animation } from '@nelyx/core/framework/animation/animation';
import { Curves } from '@nelyx/core/framework/animation/curves';
import { Alignment } from '@nelyx/core/framework/painting/alignment';
import { ColorShapeDecoration } from '@nelyx/core/framework/painting/color-shape-decoration';
import { BorderRadius } from '@nelyx/core/framework/painting/border-radius';
import { EdgeInsets } from '@nelyx/core/framework/painting/edge-insets';
import type { EdgeInsetsGeometry } from '@nelyx/core/framework/painting/edge-insets';
import { StadiumBorder } from '@nelyx/core/framework/painting/stadium-border';
import { RoundedRectangleBorder } from '@nelyx/core/framework/painting/rounded-rectangle-border';
import type { ShapeBorder } from '@nelyx/core/framework/painting/borders';
import { TextStyle } from '@nelyx/core/framework/painting/text-style';
import { MediaQuery } from '@nelyx/core/framework/widgets/app-data';
import {
  DecoratedBox,
  Expanded,
  Padding,
  Positioned,
  Row,
  SizedBox,
  Stack,
  Text,
  Transform,
} from '@nelyx/core/framework/widgets/basic';
import {
  InheritedWidget,
  State,
  StatefulWidget,
  StatelessWidget,
} from '@nelyx/core/framework/widgets/framework';
import type { BuildContext, Widget, WidgetOptions } from '@nelyx/core/framework/widgets/framework';
import { IconTheme } from '@nelyx/core/framework/widgets/icon-theme';
import { IconThemeData } from '@nelyx/core/framework/widgets/icon-theme-data';
import {
  AnimatedAlign,
  AnimatedOpacity,
  AnimatedScale,
} from '@nelyx/core/framework/widgets/implicit-animations';
import { SafeArea } from '@nelyx/core/framework/widgets/safe-area';
import { Semantics } from '@nelyx/core/framework/widgets/semantics';
import { AnimatedBuilder } from '@nelyx/core/framework/widgets/transitions';
import { emptyWidgetStateSet, WidgetState } from '@nelyx/core/framework/widgets/widget-state';
import type { WidgetStateProperty } from '@nelyx/core/framework/widgets/widget-state';
import { Color } from '@nelyx/core/ui/color';
import { Radius } from '@nelyx/core/ui/radius';
import { SemanticsRole } from '@nelyx/core/ui/semantics';
import { InkWell } from './ink-well.ts';
import { Material } from './material.ts';
import { NavigationBarTheme } from './navigation-bar-theme.ts';
import type { NavigationBarThemeData } from './navigation-bar-theme.ts';
import { NavigationDestinationLabelBehavior } from './navigation-destination-label-behavior.ts';
import { Theme } from './theme.ts';
import { Tooltip } from './tooltip.ts';

export { NavigationDestinationLabelBehavior };
const indicatorShape = new StadiumBorder();
const transparent = new Color(0);

export interface NavigationBarOptions extends WidgetOptions {
  readonly destinations: readonly Widget[];
  readonly selectedIndex?: number;
  readonly onDestinationSelected?: ((index: number) => void) | null;
  readonly animationDuration?: number | null;
  readonly backgroundColor?: Color | null;
  readonly elevation?: number | null;
  readonly shadowColor?: Color | null;
  readonly surfaceTintColor?: Color | null;
  readonly indicatorColor?: Color | null;
  readonly indicatorShape?: ShapeBorder | null;
  readonly height?: number | null;
  readonly labelBehavior?: NavigationDestinationLabelBehavior | null;
  readonly overlayColor?: WidgetStateProperty<Color | null> | null;
  readonly labelTextStyle?: WidgetStateProperty<TextStyle | null> | null;
  readonly labelPadding?: EdgeInsetsGeometry | null;
  readonly maintainBottomViewPadding?: boolean;
}

export class NavigationBar extends StatelessWidget {
  readonly selectedIndex: number;
  readonly destinations: readonly Widget[];
  readonly options: Readonly<NavigationBarOptions>;

  constructor(options: NavigationBarOptions) {
    super(options.key ?? null);
    this.selectedIndex = options.selectedIndex ?? 0;
    invariant(
      options.destinations.length >= 2 &&
        Number.isSafeInteger(this.selectedIndex) &&
        this.selectedIndex >= 0 &&
        this.selectedIndex < options.destinations.length,
      'invalid-navigation-bar-destinations',
      'NavigationBar requires at least two destinations and a valid selected index',
    );
    this.destinations = Object.freeze([...options.destinations]);
    this.options = Object.freeze({ ...options, destinations: this.destinations });
  }

  override build(context: BuildContext): Widget {
    const theme = NavigationBarTheme.of(context);
    const colors = Theme.of(context).colorScheme;
    const options = this.options;
    const height = options.height ?? theme.height ?? 80;
    const duration = options.animationDuration ?? 500;
    invariant(
      Number.isFinite(height) && height >= 0 && Number.isFinite(duration) && duration >= 0,
      'invalid-navigation-bar-size',
      'NavigationBar height and animation duration must be finite and nonnegative',
    );
    return new Material({
      color: options.backgroundColor ?? theme.backgroundColor ?? new Color(colors.surfaceContainer),
      elevation: options.elevation ?? theme.elevation ?? 3,
      shadowColor: options.shadowColor ?? theme.shadowColor ?? transparent,
      surfaceTintColor: options.surfaceTintColor ?? theme.surfaceTintColor ?? transparent,
      child: new SafeArea({
        maintainBottomViewPadding: options.maintainBottomViewPadding ?? false,
        child: new Semantics({
          container: true,
          explicitChildNodes: true,
          role: SemanticsRole.tabBar,
          child: new SizedBox(
            undefined,
            height,
            new Row(
              this.destinations.map((destination, index) => {
                const child =
                  destination instanceof NavigationDestination
                    ? new DestinationScope(this, index, theme, duration, destination)
                    : new Semantics({
                        role: SemanticsRole.tab,
                        selected: index === this.selectedIndex,
                        child: destination,
                      });
                return new Expanded(child, 1, destination.key);
              }),
              { crossAlign: 'stretch' },
            ),
          ),
        }),
      }),
    });
  }
}

class DestinationScope extends InheritedWidget {
  constructor(
    readonly bar: NavigationBar,
    readonly index: number,
    readonly theme: NavigationBarThemeData,
    readonly duration: number,
    child: Widget,
  ) {
    super(child);
  }
  override updateShouldNotify(old: DestinationScope): boolean {
    return (
      old.bar !== this.bar ||
      old.index !== this.index ||
      old.theme !== this.theme ||
      old.duration !== this.duration
    );
  }
}

export interface NavigationDestinationOptions extends WidgetOptions {
  readonly icon: Widget;
  readonly selectedIcon?: Widget | null;
  readonly label: string;
  readonly tooltip?: string | null;
  readonly enabled?: boolean;
}

export class NavigationDestination extends StatelessWidget {
  readonly icon: Widget;
  readonly selectedIcon: Widget | null;
  readonly label: string;
  readonly tooltip: string | null;
  readonly enabled: boolean;

  constructor({
    icon,
    selectedIcon = null,
    label,
    tooltip = null,
    enabled = true,
    key = null,
  }: NavigationDestinationOptions) {
    super(key);
    this.icon = icon;
    this.selectedIcon = selectedIcon;
    this.label = label;
    this.tooltip = tooltip;
    this.enabled = enabled;
  }

  override build(context: BuildContext): Widget {
    return new NavigationTile(this, context.dependOn(DestinationScope));
  }
}

class NavigationTile extends StatefulWidget {
  constructor(
    readonly destination: NavigationDestination,
    readonly scope: DestinationScope,
  ) {
    super();
  }
  override createState(): State<NavigationTile> {
    return new NavigationTileState();
  }
}

class NavigationTileState extends State<NavigationTile> {
  private hovered = false;
  private focused = false;
  private pressed = false;

  override build(context: BuildContext): Widget {
    const { destination, scope } = this.widget;
    const { index, bar, theme, duration } = scope;
    const { enabled, label, icon, selectedIcon } = destination;
    const selected = bar.selectedIndex === index;
    const options = bar.options;
    const { textTheme, colorScheme: colors } = Theme.of(context);
    const states = emptyWidgetStateSet();
    if (selected) states.add(WidgetState.selected);
    if (!enabled) states.add(WidgetState.disabled);
    if (enabled && this.hovered) states.add(WidgetState.hovered);
    if (enabled && this.focused) states.add(WidgetState.focused);
    if (enabled && this.pressed) states.add(WidgetState.pressed);
    const contentColor = new Color(colors.onSurfaceVariant);
    const iconTheme =
      theme.iconTheme?.resolve(states) ??
      new IconThemeData({
        size: 24,
        color: !enabled
          ? contentColor.withOpacity(0.38)
          : selected
            ? new Color(colors.onSecondaryContainer)
            : contentColor,
      });
    const labelStyle =
      options.labelTextStyle?.resolve(states) ??
      theme.labelTextStyle?.resolve(states) ??
      (textTheme.labelMedium ?? new TextStyle({ fontSize: 12 })).copyWith({
        color: (!enabled
          ? contentColor.withOpacity(0.38)
          : selected
            ? new Color(colors.onSurface)
            : contentColor
        ).toARGB32(),
      });
    const behavior =
      options.labelBehavior ?? theme.labelBehavior ?? NavigationDestinationLabelBehavior.alwaysShow;
    const showLabel =
      behavior === NavigationDestinationLabelBehavior.alwaysShow ||
      (behavior === NavigationDestinationLabelBehavior.onlyShowSelected && selected);
    const fill =
      options.indicatorColor ?? theme.indicatorColor ?? new Color(colors.secondaryContainer);
    const shape = options.indicatorShape ?? theme.indicatorShape ?? indicatorShape;
    const activate = enabled ? () => options.onDestinationSelected?.(index) : null;
    const labelWidget = new Padding(
      options.labelPadding ?? theme.labelPadding ?? EdgeInsets.only({ top: 4 }),
      new Text(label, { maxLines: 1, softWrap: false, style: labelStyle, textAlign: 'center' }),
    );
    const indicator = new AnimatedScale({
      duration,
      scale: selected ? 1 : 0.4,
      child: new AnimatedOpacity({
        duration,
        opacity: selected ? 1 : 0,
        child: new SizedBox(
          64,
          32,
          new DecoratedBox(undefined, { decoration: new ColorShapeDecoration(shape, fill) }),
        ),
      }),
    });
    const icons =
      selectedIcon === null
        ? icon
        : new Stack([
            new AnimatedOpacity({ duration, opacity: selected ? 0 : 1, child: icon }),
            new AnimatedOpacity({ duration, opacity: selected ? 1 : 0, child: selectedIcon }),
          ]);
    const iconWidget = new Stack([indicator, new IconTheme(iconTheme, icons)], {
      alignment: Alignment.center,
    });
    const visual = new Stack(
      [
        Positioned.fill(
          new AnimatedAlign({
            alignment: showLabel ? new Alignment(0, -0.38) : Alignment.center,
            duration,
            child: iconWidget,
          }),
        ),
        new Positioned(
          new AnimatedOpacity({
            opacity: showLabel ? 1 : 0,
            duration,
            child: labelWidget,
          }),
          { left: 0, right: 0, bottom: 10 },
        ),
      ],
      { alignment: Alignment.bottomCenter },
    );
    const tile = new InkWell({
      child: MediaQuery.withClampedTextScaling({ maxScaleFactor: 1.3, child: visual }),
      onTap: activate,
      canRequestFocus: enabled,
      excludeFromSemantics: true,
      overlayColor: options.overlayColor ?? theme.overlayColor,
      onHover: (value) =>
        this.setState(() => {
          this.hovered = value;
        }),
      onFocusChange: (value) =>
        this.setState(() => {
          this.focused = value;
        }),
      onHighlightChanged: (value) =>
        this.setState(() => {
          this.pressed = value;
        }),
    });
    const tooltip = destination.tooltip ?? label;
    return new Semantics({
      container: true,
      excludeSemantics: true,
      role: SemanticsRole.tab,
      label,
      selected,
      enabled,
      focusable: enabled,
      focused: enabled && this.focused,
      onTap: activate,
      child:
        tooltip.length === 0
          ? tile
          : new Tooltip({ message: tooltip, child: tile, excludeFromSemantics: true }),
    });
  }
}

export interface NavigationIndicatorOptions extends WidgetOptions {
  readonly animation: Animation<number>;
  readonly color?: Color | null;
  readonly width?: number;
  readonly height?: number;
  readonly borderRadius?: BorderRadius;
  readonly shape?: ShapeBorder | null;
}

export class NavigationIndicator extends StatelessWidget {
  constructor(readonly options: NavigationIndicatorOptions) {
    super(options.key ?? null);
  }
  override build(context: BuildContext): Widget {
    const {
      animation,
      color,
      shape,
      width = 64,
      height = 32,
      borderRadius = BorderRadius.all(Radius.circular(16)),
    } = this.options;
    const fill = color ?? new Color(Theme.of(context).colorScheme.secondary);
    const outline = shape ?? new RoundedRectangleBorder({ borderRadius });
    return new AnimatedBuilder({
      animation,
      child: new SizedBox(
        width,
        height,
        new DecoratedBox(undefined, {
          decoration: new ColorShapeDecoration(outline, fill),
        }),
      ),
      builder: (_context, child) => {
        const scale = animation.isDismissed
          ? 0
          : 0.4 + 0.6 * Curves.easeInOutCubicEmphasized.transform(animation.value);
        return new AnimatedOpacity({
          duration: 100,
          opacity: animation.isForwardOrCompleted ? 1 : 0,
          child: Transform.scale(child ?? undefined, { scaleX: scale, transformHitTests: false }),
        });
      },
    });
  }
}
