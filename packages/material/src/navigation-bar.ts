// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Flutter: packages/flutter/lib/src/material/navigation_bar.dart @ 71e4717a61786faab4c7aa39825989305ed29e8a
import { invariant } from '@nelyx/core/foundation/errors';
import { LocalKey } from '@nelyx/core/foundation/key';
import { FoundationPlatform } from '@nelyx/core/foundation/platform';
import type { Animation } from '@nelyx/core/framework/animation/animation';
import { AnimationController } from '@nelyx/core/framework/animation/animation-controller';
import {
  CurvedAnimation,
  kAlwaysCompleteAnimation,
  kAlwaysDismissedAnimation,
} from '@nelyx/core/framework/animation/animations';
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
import { BoxConstraints } from '@nelyx/core/framework/rendering/constraints';
import { MultiChildLayoutDelegate } from '@nelyx/core/framework/rendering/custom-layout';
import { RenderBox } from '@nelyx/core/framework/rendering/object';
import { MediaQuery } from '@nelyx/core/framework/widgets/app-data';
import {
  DecoratedBox,
  Expanded,
  KeyedSubtree,
  Padding,
  Row,
  SizedBox,
  Stack,
  Text,
  Transform,
} from '@nelyx/core/framework/widgets/basic';
import { CustomMultiChildLayout, LayoutId } from '@nelyx/core/framework/widgets/custom-layout';
import { FocusNode } from '@nelyx/core/framework/widgets/focus';
import { ExcludeFocus } from '@nelyx/core/framework/widgets/focus-scope';
import {
  InheritedWidget,
  StatefulWidget,
  StatelessWidget,
} from '@nelyx/core/framework/widgets/framework';
import type {
  BuildContext,
  State,
  Widget,
  WidgetOptions,
} from '@nelyx/core/framework/widgets/framework';
import { GlobalKey } from '@nelyx/core/framework/widgets/global-key';
import { IconTheme } from '@nelyx/core/framework/widgets/icon-theme';
import { IconThemeData } from '@nelyx/core/framework/widgets/icon-theme-data';
import { AnimatedOpacity } from '@nelyx/core/framework/widgets/implicit-animations';
import { SafeArea } from '@nelyx/core/framework/widgets/safe-area';
import { Semantics } from '@nelyx/core/framework/widgets/semantics';
import { AnimatedBuilder, FadeTransition } from '@nelyx/core/framework/widgets/transitions';
import { SingleTickerProviderStateMixin } from '@nelyx/core/framework/widgets/ticker-provider';
import { emptyWidgetStateSet, WidgetState } from '@nelyx/core/framework/widgets/widget-state';
import type { WidgetStateProperty } from '@nelyx/core/framework/widgets/widget-state';
import { Color } from '@nelyx/core/ui/color';
import type { Size } from '@nelyx/core/ui/geometry';
import { Offset } from '@nelyx/core/ui/offset';
import { Radius } from '@nelyx/core/ui/radius';
import { Rect } from '@nelyx/core/ui/rect';
import { SemanticsRole } from '@nelyx/core/ui/semantics';
import { InkResponse } from './ink-well.ts';
import type { InkResponseOptions } from './ink-well.ts';
import type { RectCallback } from './ink-feature.ts';
import { Material } from './material.ts';
import { MaterialLocalizations } from './material-localizations.ts';
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
                    ? destination
                    : new Semantics({
                        role: SemanticsRole.tab,
                        selected: index === this.selectedIndex,
                        child: destination,
                      });
                return new Expanded(
                  new DestinationScope(this, index, theme, duration, child),
                  1,
                  destination.key instanceof LocalKey ? destination.key : null,
                );
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

class NavigationTileState extends SingleTickerProviderStateMixin<NavigationTile> {
  private selection!: AnimationController;
  private labelVisibility!: CurvedAnimation;
  private readonly iconKey = new GlobalKey('Navigation destination icon');
  private readonly focus = new FocusNode({ debugLabel: 'Navigation destination' });
  private hovered = false;
  private focused = false;
  private pressed = false;

  private get selected(): boolean {
    const { bar, index } = this.widget.scope;
    return bar.selectedIndex === index;
  }

  override initState(): void {
    super.initState();
    this.selection = new AnimationController({
      vsync: this,
      duration: this.widget.scope.duration,
      value: this.selected ? 1 : 0,
    });
    this.labelVisibility = new CurvedAnimation({
      parent: this.selection,
      curve: Curves.easeInOutCubicEmphasized,
      reverseCurve: Curves.easeInOutCubicEmphasized.flipped,
    });
  }

  override didUpdateWidget(old: NavigationTile): void {
    super.didUpdateWidget(old);
    const previous = old.scope.bar.selectedIndex === old.scope.index;
    this.selection.duration = this.widget.scope.duration;
    if (previous !== this.selected) {
      if (this.selected) this.selection.forward();
      else this.selection.reverse();
    }
    if (!this.widget.destination.enabled) {
      this.pressed = false;
      this.hovered = false;
    }
  }

  override dispose(): void {
    this.labelVisibility.dispose();
    this.selection.dispose();
    this.focus.dispose();
    super.dispose();
  }

  override build(context: BuildContext): Widget {
    const { destination, scope } = this.widget;
    const { index, bar, theme } = scope;
    const { enabled, label, icon, selectedIcon } = destination;
    const selected = this.selected;
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
    const labelAnimation =
      behavior === NavigationDestinationLabelBehavior.alwaysShow
        ? kAlwaysCompleteAnimation
        : behavior === NavigationDestinationLabelBehavior.alwaysHide
          ? kAlwaysDismissedAnimation
          : this.labelVisibility;
    const fill =
      options.indicatorColor ?? theme.indicatorColor ?? new Color(colors.secondaryContainer);
    const shape = options.indicatorShape ?? theme.indicatorShape ?? indicatorShape;
    const activate = enabled ? () => options.onDestinationSelected?.(index) : null;
    const labelWidget = new Padding(
      options.labelPadding ?? theme.labelPadding ?? EdgeInsets.only({ top: 4 }),
      MediaQuery.withClampedTextScaling({
        maxScaleFactor: 1.3,
        child: new Text(label, {
          maxLines: 1,
          softWrap: false,
          style: labelStyle,
          textAlign: 'center',
        }),
      }),
    );
    const indicator = new NavigationIndicator({ animation: this.selection, shape, color: fill });
    const iconWidget = new Stack(
      [
        indicator,
        IconTheme.merge({ data: iconTheme, child: selected ? (selectedIcon ?? icon) : icon }),
      ],
      { alignment: Alignment.center },
    );
    const visual = new CustomMultiChildLayout(
      [
        new LayoutId(new KeyedSubtree({ key: this.iconKey, child: iconWidget }), 'icon'),
        new LayoutId(
          new FadeTransition({
            opacity: labelAnimation,
            child: labelWidget,
            alwaysIncludeSemantics: true,
          }),
          'label',
        ),
      ],
      new NavigationTileLayout(labelAnimation),
    );
    const tile = new DestinationInkResponse(this.iconKey, {
      child: visual,
      onTap: activate,
      focusNode: this.focus,
      customBorder: shape,
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
    const indexLabel = FoundationPlatform.isWeb
      ? ''
      : MaterialLocalizations.of(context).tabLabel({
          tabIndex: index + 1,
          tabCount: bar.destinations.length,
        });
    return new Semantics({
      container: true,
      excludeSemantics: true,
      role: SemanticsRole.tab,
      label: [label, indexLabel].filter(Boolean).join(', '),
      selected,
      enabled,
      focusable: enabled,
      focused: enabled && this.focused,
      onFocus: enabled ? () => this.focus.requestFocus() : null,
      onTap: activate,
      child: new ExcludeFocus(
        tooltip.length === 0
          ? tile
          : new Tooltip({
              message: tooltip,
              child: tile,
              excludeFromSemantics: true,
              preferBelow: false,
              verticalOffset: 42,
            }),
        { excluding: !enabled },
      ),
    });
  }
}

class NavigationTileLayout extends MultiChildLayoutDelegate {
  constructor(private readonly visibility: Animation<number>) {
    super({ relayout: visibility });
  }

  override performLayout(size: Size): void {
    const loose = BoxConstraints.loose(size);
    const icon = this.layoutChild('icon', loose);
    const label = this.layoutChild('label', loose);
    const top = (size.height - icon.height - label.height * this.visibility.value) / 2;
    this.positionChild('icon', { x: (size.width - icon.width) / 2, y: top });
    this.positionChild('label', { x: (size.width - label.width) / 2, y: top + icon.height });
  }

  override shouldRelayout(old: NavigationTileLayout): boolean {
    return old.visibility !== this.visibility;
  }
}

class DestinationInkResponse extends InkResponse {
  constructor(
    private readonly icon: GlobalKey,
    options: InkResponseOptions,
  ) {
    super({
      ...options,
      containedInkWell: true,
      highlightShape: 'rectangle',
      highlightColor: transparent,
    });
  }

  override getRectCallback(reference: RenderBox): RectCallback {
    return () => {
      const context = this.icon.currentElement;
      const icon = context?.active ? context.findRenderObject() : null;
      if (!(icon instanceof RenderBox) || !icon.hasSize || !icon.attached) return Rect.zero;
      const position = reference.globalToLocal(icon.localToGlobal(Offset.zero));
      return Rect.fromLTWH(position.x, position.y, icon.size.width, icon.size.height);
    };
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
