// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Flutter: packages/flutter/lib/src/material/flexible_space_bar.dart @ 71e4717a61786faab4c7aa39825989305ed29e8a
import { invariant } from '@nelyx/core/foundation/errors';
import { Interval } from '@nelyx/core/framework/animation/curves';
import { Alignment, AlignmentDirectional } from '@nelyx/core/framework/painting/alignment';
import { EdgeInsetsDirectional } from '@nelyx/core/framework/painting/edge-insets';
import type { EdgeInsetsGeometry } from '@nelyx/core/framework/painting/edge-insets';
import { Directionality } from '@nelyx/core/framework/widgets/app-data';
import { BackdropFilter } from '@nelyx/core/framework/widgets/backdrop-filter';
import {
  Align,
  ColoredBox,
  Padding,
  Positioned,
  SizedBox,
  Stack,
  Transform,
} from '@nelyx/core/framework/widgets/basic';
import { ClipRect } from '@nelyx/core/framework/widgets/clip';
import { DefaultTextStyle } from '@nelyx/core/framework/widgets/default-text-style';
import { InheritedWidget, StatelessWidget } from '@nelyx/core/framework/widgets/framework';
import type { Widget, WidgetOptions } from '@nelyx/core/framework/widgets/framework';
import { LayoutBuilder } from '@nelyx/core/framework/widgets/layout-builder';
import { Opacity } from '@nelyx/core/framework/widgets/opacity';
import { Semantics } from '@nelyx/core/framework/widgets/semantics';
import { Color } from '@nelyx/core/ui/color';
import { ImageFilter } from '@nelyx/core/ui/image-filter';
import { kToolbarHeight } from './constants.ts';
import { Theme } from './theme.ts';

export enum CollapseMode {
  parallax = 'parallax',
  pin = 'pin',
  none = 'none',
}

export enum StretchMode {
  zoomBackground = 'zoomBackground',
  blurBackground = 'blurBackground',
  fadeTitle = 'fadeTitle',
}

export interface FlexibleSpaceBarSettingsOptions extends WidgetOptions {
  readonly child: Widget;
  readonly currentExtent: number;
  readonly minExtent: number;
  readonly maxExtent: number;
  readonly toolbarOpacity: number;
  readonly isScrolledUnder?: boolean | null;
  readonly hasLeading?: boolean | null;
}

export interface CreateFlexibleSpaceBarSettingsOptions extends Omit<
  FlexibleSpaceBarSettingsOptions,
  'minExtent' | 'maxExtent' | 'toolbarOpacity'
> {
  readonly minExtent?: number;
  readonly maxExtent?: number;
  readonly toolbarOpacity?: number;
}

export class FlexibleSpaceBarSettings extends InheritedWidget {
  readonly currentExtent: number;
  readonly minExtent: number;
  readonly maxExtent: number;
  readonly toolbarOpacity: number;
  readonly isScrolledUnder: boolean | null;
  readonly hasLeading: boolean | null;

  constructor(options: FlexibleSpaceBarSettingsOptions) {
    super(options.child, options.key ?? null);
    const { minExtent, maxExtent, currentExtent, toolbarOpacity } = options;
    invariant(
      Number.isFinite(maxExtent) &&
        minExtent >= 0 &&
        minExtent <= currentExtent &&
        currentExtent <= maxExtent,
      'invalid-flexible-space-extents',
      'Flexible space requires 0 <= minExtent <= currentExtent <= maxExtent',
    );
    invariant(
      toolbarOpacity >= 0 && toolbarOpacity <= 1,
      'invalid-flexible-space-opacity',
      'Flexible space toolbar opacity must be in [0, 1]',
    );
    this.currentExtent = currentExtent;
    this.minExtent = minExtent;
    this.maxExtent = maxExtent;
    this.toolbarOpacity = toolbarOpacity;
    this.isScrolledUnder = options.isScrolledUnder ?? null;
    this.hasLeading = options.hasLeading ?? null;
  }

  override updateShouldNotify(old: this): boolean {
    return (
      this.currentExtent !== old.currentExtent ||
      this.minExtent !== old.minExtent ||
      this.maxExtent !== old.maxExtent ||
      this.toolbarOpacity !== old.toolbarOpacity ||
      this.isScrolledUnder !== old.isScrolledUnder ||
      this.hasLeading !== old.hasLeading
    );
  }
}

export interface FlexibleSpaceBarOptions extends WidgetOptions {
  readonly title?: Widget | null;
  readonly background?: Widget | null;
  readonly centerTitle?: boolean | null;
  readonly titlePadding?: EdgeInsetsGeometry | null;
  readonly collapseMode?: CollapseMode;
  readonly stretchModes?: readonly StretchMode[];
  readonly expandedTitleScale?: number;
}

const defaultStretchModes = Object.freeze([StretchMode.zoomBackground]);

export class FlexibleSpaceBar extends StatelessWidget {
  readonly title: Widget | null;
  readonly background: Widget | null;
  readonly centerTitle: boolean | null;
  readonly titlePadding: EdgeInsetsGeometry | null;
  readonly collapseMode: CollapseMode;
  readonly stretchModes: readonly StretchMode[];
  readonly expandedTitleScale: number;

  constructor(options: FlexibleSpaceBarOptions = {}) {
    super(options.key ?? null);
    this.title = options.title ?? null;
    this.background = options.background ?? null;
    this.centerTitle = options.centerTitle ?? null;
    this.titlePadding = options.titlePadding ?? null;
    this.collapseMode = options.collapseMode ?? CollapseMode.parallax;
    this.stretchModes = options.stretchModes
      ? Object.freeze([...options.stretchModes])
      : defaultStretchModes;
    this.expandedTitleScale = options.expandedTitleScale ?? 1.5;
    invariant(
      Number.isFinite(this.expandedTitleScale) && this.expandedTitleScale >= 1,
      'invalid-flexible-space-title-scale',
      'Flexible space expanded title scale must be at least 1',
    );
  }

  static createSettings(options: CreateFlexibleSpaceBarSettingsOptions): FlexibleSpaceBarSettings {
    return new FlexibleSpaceBarSettings({
      ...options,
      minExtent: options.minExtent ?? options.currentExtent,
      maxExtent: options.maxExtent ?? options.currentExtent,
      toolbarOpacity: options.toolbarOpacity ?? 1,
    });
  }

  private backgroundTop(t: number, settings: FlexibleSpaceBarSettings): number {
    switch (this.collapseMode) {
      case CollapseMode.pin:
        return settings.currentExtent - settings.maxExtent;
      case CollapseMode.none:
        return 0;
      case CollapseMode.parallax:
        return -((settings.maxExtent - settings.minExtent) / 4) * t;
    }
  }

  override build(): Widget {
    return new LayoutBuilder((context, constraints) => {
      const settings = context.maybeDependOn(FlexibleSpaceBarSettings);
      invariant(
        settings,
        'missing-flexible-space-settings',
        'Wrap the app bar in FlexibleSpaceBar.createSettings to provide its extents',
      );
      const { currentExtent, minExtent, maxExtent, toolbarOpacity, hasLeading } = settings;
      const delta = maxExtent - minExtent;
      const t = delta === 0 ? 0 : Math.min(1, Math.max(0, 1 - (currentExtent - minExtent) / delta));
      const height = constraints.hasBoundedHeight ? constraints.maxHeight : currentExtent;
      const stretch = Math.max(0, height - maxExtent);
      const children: Widget[] = [];
      if (this.background) {
        const fadeStart = delta === 0 ? 0 : Math.max(0, 1 - kToolbarHeight / delta);
        const opacity = delta === 0 ? 1 : 1 - new Interval(fadeStart, 1).transform(t);
        children.push(
          new Positioned(new Opacity(this.background, { opacity, alwaysIncludeSemantics: true }), {
            top: this.backgroundTop(t, settings),
            left: 0,
            right: 0,
            height:
              maxExtent + (this.stretchModes.includes(StretchMode.zoomBackground) ? stretch : 0),
          }),
        );
        if (stretch > 0 && this.stretchModes.includes(StretchMode.blurBackground)) {
          const sigma = stretch / 10;
          children.push(
            Positioned.fill(
              new BackdropFilter({
                filter: ImageFilter.blur({ sigmaX: sigma, sigmaY: sigma }),
                child: new ColoredBox({ color: 0 }),
              }),
            ),
          );
        }
      }
      if (this.title && toolbarOpacity > 0) {
        const theme = Theme.of(context);
        const apple = theme.platform === 'iOS' || theme.platform === 'macOS';
        let title: Widget = apple
          ? this.title
          : new Semantics({ namesRoute: true, child: this.title });
        if (stretch > 0 && this.stretchModes.includes(StretchMode.fadeTitle)) {
          title = new Opacity(title, { opacity: 1 - Math.min(1, stretch / 100) });
        }
        const center = this.centerTitle ?? apple;
        const alignment = center
          ? Alignment.bottomCenter
          : AlignmentDirectional.bottomStart.resolve(Directionality.maybeOf(context) ?? 'ltr');
        const padding =
          this.titlePadding ??
          EdgeInsetsDirectional.only({
            start: center || hasLeading === false ? 0 : 72,
            bottom: 16,
          });
        const scale = this.expandedTitleScale + (1 - this.expandedTitleScale) * t;
        const textStyle = theme.textTheme.titleLarge;
        const style = textStyle?.copyWith({
          color: new Color(textStyle.color ?? theme.colorScheme.onSurface)
            .withOpacity(toolbarOpacity)
            .toARGB32(),
        });
        const fittedTitle = new LayoutBuilder(
          (_context, inner) =>
            new SizedBox(
              inner.hasBoundedWidth ? inner.maxWidth / scale : undefined,
              undefined,
              new Align(title, { alignment }),
            ),
        );
        children.push(
          new Padding(
            padding,
            Transform.scale(
              new Align(style ? new DefaultTextStyle(style, fittedTitle) : fittedTitle, {
                alignment,
              }),
              { alignment, scale },
            ),
          ),
        );
      }
      return new SizedBox(
        undefined,
        height,
        new ClipRect(new Stack(children, { fit: 'expand', clipBehavior: 'none' })),
      );
    });
  }
}
