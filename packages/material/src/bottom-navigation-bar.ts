// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Flutter: packages/flutter/lib/src/material/bottom_navigation_bar.dart @ 71e4717a61786faab4c7aa39825989305ed29e8a
import { invariant } from '@nelyx/core/foundation/errors';
import { AnimationStatus } from '@nelyx/core/framework/animation/animation';
import { AnimationController } from '@nelyx/core/framework/animation/animation-controller';
import { CurvedAnimation } from '@nelyx/core/framework/animation/animations';
import { Curves } from '@nelyx/core/framework/animation/curves';
import { Alignment } from '@nelyx/core/framework/painting/alignment';
import { EdgeInsets } from '@nelyx/core/framework/painting/edge-insets';
import { TextStyle } from '@nelyx/core/framework/painting/text-style';
import { BoxConstraints } from '@nelyx/core/framework/rendering/constraints';
import { CustomPainter } from '@nelyx/core/framework/rendering/custom-paint';
import { Directionality, MediaQuery } from '@nelyx/core/framework/widgets/app-data';
import {
  Align,
  Column,
  ConstrainedBox,
  Expanded,
  Flexible,
  IntrinsicWidth,
  Padding,
  Row,
  SizedBox,
  Text,
  Transform,
} from '@nelyx/core/framework/widgets/basic';
import type { BottomNavigationBarItem } from '@nelyx/core/framework/widgets/bottom-navigation-bar-item';
import { CustomPaint } from '@nelyx/core/framework/widgets/custom-paint';
import { StatefulWidget } from '@nelyx/core/framework/widgets/framework';
import type { BuildContext, Widget, WidgetOptions } from '@nelyx/core/framework/widgets/framework';
import { IconTheme } from '@nelyx/core/framework/widgets/icon-theme';
import { IconThemeData } from '@nelyx/core/framework/widgets/icon-theme-data';
import { Opacity } from '@nelyx/core/framework/widgets/opacity';
import { MergeSemantics, Semantics } from '@nelyx/core/framework/widgets/semantics';
import { TickerProviderStateMixin } from '@nelyx/core/framework/widgets/ticker-provider';
import {
  WidgetState,
  WidgetStateMouseCursor,
  emptyWidgetStateSet,
} from '@nelyx/core/framework/widgets/widget-state';
import type { MouseCursor } from '@nelyx/core/services/mouse-cursor';
import type { Canvas } from '@nelyx/core/ui/canvas';
import { Color } from '@nelyx/core/ui/color';
import type { Size } from '@nelyx/core/ui/geometry';
import { Paint } from '@nelyx/core/ui/paint';
import { Rect } from '@nelyx/core/ui/rect';
import { BottomNavigationBarLandscapeLayout } from './bottom-navigation-bar-landscape-layout.ts';
import { BottomNavigationBarType } from './bottom-navigation-bar-type.ts';
import { BottomNavigationBarTheme } from './bottom-navigation-bar-theme.ts';
import type { BottomNavigationBarThemeData } from './bottom-navigation-bar-theme-data.ts';
import { kBottomNavigationBarHeight, kThemeChangeDuration } from './constants.ts';
import { InkResponse } from './ink-well.ts';
import { Material, MaterialType } from './material.ts';
import { MaterialLocalizations } from './material-localizations.ts';
import { Theme } from './theme.ts';
import { Tooltip } from './tooltip.ts';

export { BottomNavigationBarItem } from '@nelyx/core/framework/widgets/bottom-navigation-bar-item';
export type { BottomNavigationBarItemOptions } from '@nelyx/core/framework/widgets/bottom-navigation-bar-item';
export { BottomNavigationBarType, BottomNavigationBarLandscapeLayout };

export interface BottomNavigationBarOptions extends WidgetOptions {
  readonly items: readonly BottomNavigationBarItem[];
  readonly currentIndex?: number;
  readonly onTap?: ((index: number) => void) | null;
  readonly elevation?: number | null;
  readonly type?: BottomNavigationBarType | null;
  readonly fixedColor?: Color | null;
  readonly backgroundColor?: Color | null;
  readonly selectedItemColor?: Color | null;
  readonly unselectedItemColor?: Color | null;
  readonly iconSize?: number;
  readonly selectedIconTheme?: IconThemeData | null;
  readonly unselectedIconTheme?: IconThemeData | null;
  readonly selectedFontSize?: number;
  readonly unselectedFontSize?: number;
  readonly selectedLabelStyle?: TextStyle | null;
  readonly unselectedLabelStyle?: TextStyle | null;
  readonly showSelectedLabels?: boolean | null;
  readonly showUnselectedLabels?: boolean | null;
  readonly mouseCursor?: MouseCursor | null;
  readonly enableFeedback?: boolean | null;
  readonly landscapeLayout?: BottomNavigationBarLandscapeLayout | null;
  readonly useLegacyColorScheme?: boolean;
}

export class BottomNavigationBar extends StatefulWidget {
  readonly currentIndex: number;
  readonly selectedItemColor: Color | null;
  readonly iconSize: number;
  readonly selectedFontSize: number;
  readonly unselectedFontSize: number;

  constructor(readonly options: BottomNavigationBarOptions) {
    super(options.key ?? null);
    this.currentIndex = options.currentIndex ?? 0;
    this.selectedItemColor = options.selectedItemColor ?? options.fixedColor ?? null;
    this.iconSize = options.iconSize ?? 24;
    this.selectedFontSize = options.selectedFontSize ?? 14;
    this.unselectedFontSize = options.unselectedFontSize ?? 12;
    invariant(
      options.items.length >= 2 &&
        options.items.every((item) => item.label !== null) &&
        Number.isInteger(this.currentIndex) &&
        this.currentIndex >= 0 &&
        this.currentIndex < options.items.length,
      'invalid-bottom-navigation-items',
      'BottomNavigationBar requires at least two labeled items and a valid index',
    );
    invariant(
      [options.elevation ?? 0, this.iconSize, this.selectedFontSize, this.unselectedFontSize].every(
        (value) => Number.isFinite(value) && value >= 0,
      ),
      'invalid-bottom-navigation-dimensions',
      'Bar elevation, icon size and font sizes must be nonnegative and finite',
    );
    invariant(
      options.fixedColor == null || options.selectedItemColor == null,
      'ambiguous-bottom-navigation-color',
      'Set either fixedColor or selectedItemColor',
    );
  }

  get items(): readonly BottomNavigationBarItem[] {
    return this.options.items;
  }
  get fixedColor(): Color | null {
    return this.selectedItemColor;
  }
  override createState(): BottomNavigationBarState {
    return new BottomNavigationBarState();
  }
}

interface Motion {
  readonly controller: AnimationController;
  readonly curve: CurvedAnimation;
}
interface ColorSplash extends Motion {
  readonly index: number;
  readonly color: Color;
}
interface PaintedSplash {
  readonly progress: number;
  readonly leading: number;
  readonly color: Color;
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

class BottomNavigationBarState extends TickerProviderStateMixin<BottomNavigationBar> {
  private motions: Motion[] = [];
  private splashes: ColorSplash[] = [];
  private background: Color | null = null;
  private readonly refresh = () => this.setState(() => {});

  private motion(value: number, reverse = false): Motion {
    const controller = new AnimationController({
      vsync: this,
      duration: kThemeChangeDuration,
      value,
    });
    const curve = new CurvedAnimation({
      parent: controller,
      curve: Curves.fastOutSlowIn,
      reverseCurve: reverse ? Curves.fastOutSlowIn.flipped : null,
    });
    controller.addListener(this.refresh);
    return { controller, curve };
  }

  private disposeMotion({ controller, curve }: Motion): void {
    controller.removeListener(this.refresh);
    curve.dispose();
    controller.dispose();
  }

  private reset(): void {
    this.motions.forEach((motion) => this.disposeMotion(motion));
    this.splashes.forEach((motion) => this.disposeMotion(motion));
    this.splashes = [];
    this.motions = this.widget.items.map((_item, index) =>
      this.motion(index === this.widget.currentIndex ? 1 : 0, true),
    );
    this.background = this.widget.items[this.widget.currentIndex]!.backgroundColor;
  }

  override initState(): void {
    super.initState();
    this.reset();
  }

  private shifting(local: BottomNavigationBarThemeData): boolean {
    const type = this.widget.options.type ?? local.type;
    return type === null ? this.widget.items.length > 3 : type === BottomNavigationBarType.shifting;
  }

  private splash(index: number, color: Color): void {
    const splash: ColorSplash = { ...this.motion(0), index, color };
    this.splashes.push(splash);
    splash.controller.addStatusListener((status) => {
      if (status !== AnimationStatus.completed) return;
      this.setState(() => {
        while (this.splashes[0]?.controller.isCompleted) {
          const completed = this.splashes.shift()!;
          this.background = completed.color;
          this.disposeMotion(completed);
        }
      });
    });
    splash.controller.forward();
  }

  override didUpdateWidget(old: BottomNavigationBar): void {
    super.didUpdateWidget(old);
    const bar = this.widget;
    if (old.items.length !== bar.items.length) {
      this.reset();
      return;
    }
    const color = bar.items[bar.currentIndex]!.backgroundColor;
    if (old.currentIndex !== bar.currentIndex) {
      if (this.shifting(BottomNavigationBarTheme.of(this.context))) {
        if (color !== null) this.splash(bar.currentIndex, color);
      } else this.background = color;
      this.motions[old.currentIndex]!.controller.reverse();
      this.motions[bar.currentIndex]!.controller.forward();
    } else {
      const previous = old.items[bar.currentIndex]!.backgroundColor;
      if (previous === null ? color !== null : !previous.equals(color)) {
        this.splashes.forEach((motion) => this.disposeMotion(motion));
        this.splashes = [];
        this.background = color;
      }
    }
  }

  override dispose(): void {
    this.motions.forEach((motion) => this.disposeMotion(motion));
    this.splashes.forEach((motion) => this.disposeMotion(motion));
    super.dispose();
  }

  override build(context: BuildContext): Widget {
    const bar = this.widget,
      options = bar.options;
    const theme = Theme.of(context),
      local = BottomNavigationBarTheme.of(context);
    const media = MediaQuery.of(context);
    const textDirection = Directionality.of(context);
    const shifting = this.shifting(local);
    const landscape = media.width > media.height;
    const layout =
      options.landscapeLayout ?? local.landscapeLayout ?? BottomNavigationBarLandscapeLayout.spread;
    const linear = landscape && layout === BottomNavigationBarLandscapeLayout.linear;
    const showSelected = options.showSelectedLabels ?? local.showSelectedLabels ?? true;
    const showUnselected = options.showUnselectedLabels ?? local.showUnselectedLabels ?? !shifting;
    const legacy = options.useLegacyColorScheme !== false;
    const selectedStyle = options.selectedLabelStyle ?? local.selectedLabelStyle ?? new TextStyle();
    const unselectedStyle =
      options.unselectedLabelStyle ?? local.unselectedLabelStyle ?? new TextStyle();
    const selectedSize = selectedStyle.fontSize ?? bar.selectedFontSize;
    const unselectedSize = unselectedStyle.fontSize ?? bar.unselectedFontSize;
    const accent = new Color(
      theme.brightness === 'dark' ? theme.colorScheme.secondary : theme.colorScheme.primary,
    );
    const surface = new Color(theme.colorScheme.surface);
    const explicitSelected = bar.selectedItemColor ?? local.selectedItemColor;
    const explicitUnselected = options.unselectedItemColor ?? local.unselectedItemColor;
    const baseSelected = explicitSelected ?? (shifting && legacy ? surface : accent);
    const baseUnselected = explicitUnselected ?? (shifting ? surface : theme.unselectedWidgetColor);
    const selectedIcon =
      options.selectedIconTheme ??
      local.selectedIconTheme ??
      (legacy ? null : new IconThemeData({ color: explicitSelected ?? accent }));
    const unselectedIcon =
      options.unselectedIconTheme ??
      local.unselectedIconTheme ??
      (legacy
        ? null
        : new IconThemeData({ color: explicitUnselected ?? theme.unselectedWidgetColor }));
    const selectedIconSize = selectedIcon?.size ?? bar.iconSize;
    const unselectedIconSize = unselectedIcon?.size ?? bar.iconSize;
    const selectedDiff = Math.max(0, selectedIconSize - unselectedIconSize) / 2;
    const unselectedDiff = Math.max(0, unselectedIconSize - selectedIconSize) / 2;
    const weights = this.motions.map(({ curve }) => (shifting ? 1 + 0.5 * curve.value : 1));
    const totalWeight = weights.reduce((total, weight) => total + weight, 0);
    const edges = [0];
    for (const weight of weights) edges.push(edges.at(-1)! + weight);
    const localizations = MaterialLocalizations.of(context);

    const tiles = bar.items.map((item, index) => {
      const current = index === bar.currentIndex;
      const t = this.motions[index]!.curve.value;
      const state = emptyWidgetStateSet();
      if (current) state.add(WidgetState.selected);
      const cursor =
        (options.mouseCursor instanceof WidgetStateMouseCursor
          ? options.mouseCursor.resolve(state)
          : options.mouseCursor) ??
        local.mouseCursor?.resolve(state) ??
        WidgetStateMouseCursor.clickable.resolve(state);
      const labelFrom =
        legacy || unselectedStyle.color === null
          ? baseUnselected
          : new Color(unselectedStyle.color);
      const labelTo =
        legacy || selectedStyle.color === null ? baseSelected : new Color(selectedStyle.color);
      const labelColor = Color.lerp(labelFrom, labelTo, t)!;
      const iconColor = Color.lerp(
        legacy
          ? baseUnselected
          : ((shifting ? unselectedIcon : selectedIcon)?.color ?? baseUnselected),
        legacy ? baseSelected : ((shifting ? selectedIcon : unselectedIcon)?.color ?? baseSelected),
        t,
      );
      const iconBase = new IconThemeData({ color: iconColor, size: bar.iconSize });
      const icon = new Align(
        new IconTheme(
          IconThemeData.lerp(iconBase.merge(unselectedIcon), iconBase.merge(selectedIcon), t),
          current ? item.activeIcon : item.icon,
        ),
        { alignment: Alignment.topCenter, heightFactor: 1 },
      );
      const text = new Text(item.label!, {
        style: TextStyle.lerp(unselectedStyle, selectedStyle, t)!.copyWith({
          fontSize: selectedSize,
          color: labelColor.toARGB32(),
        }),
        overflow: 'ellipsis',
      });
      const labelContent =
        item.semanticsLabel === null
          ? text
          : new Semantics({ label: item.semanticsLabel, excludeSemantics: true, child: text });
      const scaled = Transform.scale(labelContent, {
        scale: selectedSize === 0 ? 1 : lerp(unselectedSize / selectedSize, 1, t),
        alignment: Alignment.bottomCenter,
      });
      const opacity = lerp(showUnselected ? 1 : 0, showSelected ? 1 : 0, t);
      const label = MediaQuery.withClampedTextScaling({
        maxScaleFactor: 1,
        child: new Align(new Opacity(scaled, { opacity, alwaysIncludeSemantics: true }), {
          alignment: Alignment.bottomCenter,
          heightFactor: 1,
        }),
      });
      const content = linear
        ? new Align(
            new Row([icon, new Flexible(new IntrinsicWidth(label))], {
              mainAxisSize: 'min',
              spacing: 8,
            }),
            { heightFactor: 1 },
          )
        : new Column([icon, label], { mainAxisSize: 'min', mainAxisAlignment: 'spaceBetween' });

      const top = showUnselected
        ? lerp(selectedSize / 2 + selectedDiff, selectedSize / 2 + unselectedDiff, t)
        : lerp(
            selectedSize + selectedDiff,
            showSelected ? selectedSize / 2 - unselectedDiff : selectedSize + unselectedDiff,
            t,
          );
      const bottom = showUnselected
        ? top
        : lerp(selectedDiff, showSelected ? selectedSize / 2 - unselectedDiff : unselectedDiff, t);
      let target: Widget = new InkResponse({
        onTap: () => options.onTap?.(index),
        mouseCursor: cursor,
        enableFeedback: options.enableFeedback ?? local.enableFeedback ?? true,
        child: new Padding(
          EdgeInsets.only({ top: Math.max(0, top), bottom: Math.max(0, bottom) }),
          content,
        ),
      });
      if (item.tooltip)
        target = new Tooltip({
          message: item.tooltip,
          verticalOffset: selectedIconSize + selectedSize,
          preferBelow: false,
          excludeFromSemantics: true,
          child: target,
        });
      return new Expanded(
        new MergeSemantics({
          child: new Semantics({
            container: true,
            selected: current,
            button: true,
            label: localizations.tabLabel({ tabIndex: index + 1, tabCount: bar.items.length }),
            child: target,
          }),
        }),
        Math.round(weights[index]! * 1000),
        item.key,
      );
    });
    const safeBottom = MediaQuery.viewPaddingOf(context).bottom;
    const row = MediaQuery.removePadding({
      context,
      removeBottom: true,
      child: new Row(tiles, {
        mainAxisAlignment: 'spaceBetween',
        textDirection,
      }),
    });
    let body: Widget = new Material({
      type: MaterialType.transparency,
      child: new Padding(EdgeInsets.only({ bottom: safeBottom }), row),
    });
    if (shifting && this.splashes.length > 0)
      body = new CustomPaint(body, {
        painter: new RadialBackground(
          this.splashes.map(({ curve, color, index }) => ({
            progress: curve.value,
            color,
            leading: (edges[index]! + weights[index]! / 2) / totalWeight,
          })),
          textDirection,
        ),
      });
    body = new ConstrainedBox(
      body,
      new BoxConstraints(0, Infinity, kBottomNavigationBarHeight + safeBottom),
    );
    if (landscape && layout === BottomNavigationBarLandscapeLayout.centered)
      body = new Align(new SizedBox(media.height, undefined, body), {
        alignment: Alignment.bottomCenter,
        heightFactor: 1,
      });
    return new Semantics({
      explicitChildNodes: true,
      child: new Material({
        elevation: options.elevation ?? local.elevation ?? 8,
        color: shifting ? this.background : (options.backgroundColor ?? local.backgroundColor),
        animateColor: !shifting,
        child: body,
      }),
    });
  }
}

class RadialBackground extends CustomPainter {
  constructor(
    private readonly circles: readonly PaintedSplash[],
    private readonly direction: 'ltr' | 'rtl',
  ) {
    super();
  }
  override paint(canvas: Canvas, size: Size): void {
    canvas.save();
    canvas.clipRect(Rect.fromLTWH(0, 0, size.width, size.height));
    for (const { leading, progress, color } of this.circles) {
      const x = (this.direction === 'rtl' ? 1 - leading : leading) * size.width;
      const y = size.height / 2;
      const radius = Math.hypot(Math.max(x, size.width - x), y) * progress;
      canvas.drawCircle({ x, y }, radius, new Paint({ color: color.toARGB32() }));
    }
    canvas.restore();
  }
  override shouldRepaint(old: RadialBackground): boolean {
    return (
      this.direction !== old.direction ||
      this.circles.length !== old.circles.length ||
      this.circles.some(({ progress, leading, color }, index) => {
        const previous = old.circles[index]!;
        return (
          progress !== previous.progress ||
          leading !== previous.leading ||
          !color.equals(previous.color)
        );
      })
    );
  }
}
