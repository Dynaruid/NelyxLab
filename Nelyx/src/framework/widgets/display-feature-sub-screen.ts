// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Flutter: packages/flutter/lib/src/widgets/display_feature_sub_screen.dart
// @ 71e4717a61786faab4c7aa39825989305ed29e8a
import { Offset } from '../../ui/offset.ts';
import { Rect } from '../../ui/rect.ts';
import { EdgeInsets } from '../painting/edge-insets.ts';
import { Directionality, MediaQuery } from './app-data.ts';
import type { MediaData } from './app-data.ts';
import { Padding } from './basic.ts';
import { StatelessWidget } from './framework.ts';
import type { BuildContext, Widget, WidgetOptions } from './framework.ts';

export interface DisplayFeatureSubScreenOptions extends WidgetOptions {
  readonly child: Widget;
  readonly anchorPoint?: Offset | null;
}

export class DisplayFeatureSubScreen extends StatelessWidget {
  readonly child: Widget;
  readonly anchorPoint: Offset | null;

  constructor({ child, anchorPoint = null, key = null }: DisplayFeatureSubScreenOptions) {
    super(key);
    this.child = child;
    this.anchorPoint = anchorPoint;
  }

  static avoidBounds(media: MediaData): readonly Rect[] {
    return (media.displayFeatures ?? [])
      .filter(({ bounds, state }) => bounds.shortestSide > 0 || state === 'postureHalfOpened')
      .map(({ bounds }) => bounds);
  }

  static subScreensInBounds(wanted: Rect, avoided: Iterable<Rect>): readonly Rect[] {
    let screens = [wanted];
    for (const bounds of avoided) {
      const parts: Rect[] = [];
      for (const screen of screens) {
        if (
          bounds.top <= screen.top &&
          bounds.bottom >= screen.bottom &&
          bounds.right > screen.left &&
          bounds.left < screen.right
        ) {
          if (screen.left < bounds.left) {
            parts.push(Rect.fromLTRB(screen.left, screen.top, bounds.left, screen.bottom));
          }
          if (screen.right > bounds.right) {
            parts.push(Rect.fromLTRB(bounds.right, screen.top, screen.right, screen.bottom));
          }
        } else if (
          bounds.left <= screen.left &&
          bounds.right >= screen.right &&
          bounds.bottom > screen.top &&
          bounds.top < screen.bottom
        ) {
          if (screen.top < bounds.top) {
            parts.push(Rect.fromLTRB(screen.left, screen.top, screen.right, bounds.top));
          }
          if (screen.bottom > bounds.bottom) {
            parts.push(Rect.fromLTRB(screen.left, bounds.bottom, screen.right, screen.bottom));
          }
        } else {
          parts.push(screen);
        }
      }
      if (parts.length > 0) screens = parts;
    }
    return screens;
  }

  override build(context: BuildContext): Widget {
    if (!MediaQuery.maybeDisplayFeaturesOf(context)?.length) return this.child;
    const media = MediaQuery.of(context);
    const viewport = Rect.fromLTWH(0, 0, media.width, media.height);
    const screens = DisplayFeatureSubScreen.subScreensInBounds(
      viewport,
      DisplayFeatureSubScreen.avoidBounds(media),
    );
    if (screens.length === 1 && screens[0]?.equals(viewport)) return this.child;

    const anchor =
      this.anchorPoint ?? new Offset(Directionality.of(context) === 'rtl' ? media.width : 0, 0);
    const x = Math.max(0, Math.min(anchor.dx, media.width));
    const y = Math.max(0, Math.min(anchor.dy, media.height));
    let nearest = viewport;
    let distance = Infinity;
    for (const screen of screens) {
      const dx = Math.max(screen.left - x, 0, x - screen.right);
      const dy = Math.max(screen.top - y, 0, y - screen.bottom);
      const candidate = Math.hypot(dx, dy);
      if (candidate < distance) {
        nearest = screen;
        distance = candidate;
      }
    }
    return new Padding(
      new EdgeInsets(
        nearest.left,
        nearest.top,
        media.width - nearest.right,
        media.height - nearest.bottom,
      ),
      MediaQuery.removeDisplayFeatures(media, nearest, this.child),
    );
  }
}
