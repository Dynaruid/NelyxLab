// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Shared presentation follows SnackBar and MaterialBanner at Flutter
// 71e4717a61786faab4c7aa39825989305ed29e8a.
import { ObjectKey } from '@nelyx/core/foundation/key';
import { RenderRepaintBoundary } from '@nelyx/core/framework/rendering/repaint-boundary';
import { MediaQuery } from '@nelyx/core/framework/widgets/app-data';
import { KeyedSubtree, SizedBox } from '@nelyx/core/framework/widgets/basic';
import { GlobalKey } from '@nelyx/core/framework/widgets/global-key';
import { State, StatefulWidget, StatelessWidget } from '@nelyx/core/framework/widgets/framework';
import type { BuildContext, Widget } from '@nelyx/core/framework/widgets/framework';
import { Hero } from '@nelyx/core/framework/widgets/heroes';
import type { HeroFlightDetails } from '@nelyx/core/framework/widgets/heroes';
import type { NavigatorController } from '@nelyx/core/framework/widgets/navigation';
import { IgnorePointer } from '@nelyx/core/framework/widgets/pointer-blocking';
import { RawImage } from '@nelyx/core/framework/widgets/raw-image';
import { RepaintBoundary } from '@nelyx/core/framework/widgets/repaint-boundary';
import { ExcludeSemantics } from '@nelyx/core/framework/widgets/semantics';
import type { Size } from '@nelyx/core/ui/geometry';
import type { Image } from '@nelyx/core/ui/image';
import { MenuItemMeasure } from './menu-item-measure.ts';

interface FeatureSlot {
  readonly contentKey: GlobalKey;
  extent: Size | null;
}

interface FeatureImage {
  readonly image: Image;
  readonly scale: number;
}

const slots = new WeakMap<Widget, WeakMap<NavigatorController, Map<number, FeatureSlot>>>();

export class ScaffoldFeatureFlight extends StatefulWidget {
  constructor(
    readonly feature: Widget,
    navigator: NavigatorController,
    ordinal: number,
    readonly active: boolean,
    readonly transitionOnUserGestures: boolean,
  ) {
    let navigators = slots.get(feature);
    if (!navigators) slots.set(feature, (navigators = new WeakMap()));
    let endpoints = navigators.get(navigator);
    if (!endpoints) navigators.set(navigator, (endpoints = new Map()));
    let slot = endpoints.get(ordinal);
    if (!slot) endpoints.set(ordinal, (slot = { contentKey: new GlobalKey(), extent: null }));
    super(new ObjectKey(slot));
    this.slot = slot;
  }

  readonly slot: FeatureSlot;

  override createState(): State<ScaffoldFeatureFlight> {
    return new ScaffoldFeatureFlightState();
  }
}

class ScaffoldFeatureFlightState extends State<ScaffoldFeatureFlight> {
  private readonly boundary = new GlobalKey();
  private inactiveSize: Size | null = null;
  private inactiveImage: FeatureImage | null = null;

  private readonly measured = (size: Size): void => {
    this.widget.slot.extent = size;
  };

  override didUpdateWidget(old: ScaffoldFeatureFlight): void {
    super.didUpdateWidget(old);
    if (old.active && !this.widget.active) {
      const render = this.boundary.currentContext?.findRenderObject();
      if (render instanceof RenderRepaintBoundary && render.hasSize)
        this.inactiveSize = render.size;
      this.inactiveImage = this.capture();
    } else if (!old.active && this.widget.active) {
      this.inactiveImage?.image.dispose();
      this.inactiveImage = null;
    }
  }

  private capture(): FeatureImage | null {
    const render = this.boundary.currentContext?.findRenderObject();
    const rasterizer = this.context.services.rasterizer;
    if (!rasterizer || !(render instanceof RenderRepaintBoundary) || !render.canCaptureImage)
      return null;
    const scale = MediaQuery.devicePixelRatioOf(this.context);
    try {
      return { image: render.toImageSync({ rasterizer, pixelRatio: scale }), scale };
    } catch {
      return null;
    }
  }

  imageForFlight(): FeatureImage | null {
    const snapshot = this.inactiveImage;
    return snapshot ? { image: snapshot.image.clone(), scale: snapshot.scale } : this.capture();
  }

  override build(): Widget {
    const { active, slot, feature, transitionOnUserGestures } = this.widget;
    const size = this.inactiveSize ?? slot.extent;
    const snapshot = this.inactiveImage;
    const child = active
      ? new RepaintBoundary(
          new MenuItemMeasure(
            new KeyedSubtree({ key: slot.contentKey, child: feature }),
            this.measured,
          ),
          this.boundary,
        )
      : new SizedBox(
          size?.width ?? 0,
          size?.height ?? 0,
          snapshot ? new ExcludeSemantics(new IgnorePointer(imageWidget(snapshot))) : undefined,
        );
    return new Hero({
      tag: slot,
      child: new ScaffoldFeatureEndpoint(this, child),
      flightShuttleBuilder: buildFeatureFlight,
      useRouteLayout: true,
      useRouteAnimation: true,
      transitionOnUserGestures,
    });
  }

  override dispose(): void {
    this.inactiveImage?.image.dispose();
    this.inactiveImage = null;
    super.dispose();
  }
}

class ScaffoldFeatureEndpoint extends StatelessWidget {
  constructor(
    readonly state: ScaffoldFeatureFlightState,
    readonly child: Widget,
  ) {
    super();
  }
  override build(): Widget {
    return this.child;
  }
}

function imageWidget(snapshot: FeatureImage): RawImage {
  return new RawImage({ image: snapshot.image, scale: snapshot.scale, fit: 'fill' });
}

function buildFeatureFlight(
  _context: BuildContext,
  _direction: 'push' | 'pop',
  details: HeroFlightDetails,
): Widget | null {
  const from = details.from.hero.options.child;
  const to = details.to.hero.options.child;
  if (
    !(from instanceof ScaffoldFeatureEndpoint) ||
    !(to instanceof ScaffoldFeatureEndpoint) ||
    details.from.rect.width <= 0 ||
    details.from.rect.height <= 0 ||
    details.to.rect.width <= 0 ||
    details.to.rect.height <= 0
  )
    return null;
  const snapshot = from.state.imageForFlight() ?? to.state.imageForFlight();
  if (!snapshot) return null;
  details.onDispose(() => snapshot.image.dispose());
  return new ExcludeSemantics(new IgnorePointer(imageWidget(snapshot)));
}
