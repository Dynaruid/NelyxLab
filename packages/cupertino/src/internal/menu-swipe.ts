// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Adapted from packages/flutter/lib/src/cupertino/menu_anchor.dart at
// 71e4717a61786faab4c7aa39825989305ed29e8a.
import { ValueNotifier } from '@nelyx/core/foundation/notifier';
import type { GestureBinding } from '@nelyx/core/framework/gestures/binding';
import { Drag } from '@nelyx/core/framework/gestures/drag';
import type { DragUpdateDetails } from '@nelyx/core/framework/gestures/drag-details';
import { kPrimaryButton } from '@nelyx/core/framework/gestures/events';
import type { PointerDownEvent } from '@nelyx/core/framework/gestures/events';
import { HitTestResult } from '@nelyx/core/framework/gestures/hit-test';
import {
  DelayedMultiDragGestureRecognizer,
  ImmediateMultiDragGestureRecognizer,
} from '@nelyx/core/framework/gestures/multidrag';
import type { MultiDragGestureRecognizer } from '@nelyx/core/framework/gestures/multidrag';
import { RenderMetaData } from '@nelyx/core/framework/rendering/meta-data';
import { RenderBox } from '@nelyx/core/framework/rendering/object';
import { HitTestBehavior } from '@nelyx/core/framework/rendering/pointer-listener';
import { MediaQuery } from '@nelyx/core/framework/widgets/app-data';
import { MetaData } from '@nelyx/core/framework/widgets/basic';
import {
  Element,
  InheritedWidget,
  State,
  StatefulWidget,
} from '@nelyx/core/framework/widgets/framework';
import type { BuildContext, Widget } from '@nelyx/core/framework/widgets/framework';
import { GlobalKey } from '@nelyx/core/framework/widgets/global-key';
import { Listener } from '@nelyx/core/framework/widgets/listener';
import { bounds } from '@nelyx/core/ui/geometry';
import type { Offset } from '@nelyx/core/ui/geometry';
import { Offset as SourceOffset } from '@nelyx/core/ui/offset';
import type { Rect } from '@nelyx/core/ui/types';

export function squaredDistanceToMenuRect(point: Offset, rect: Rect): number {
  const dx = Math.max(rect.x - point.x, 0, point.x - rect.x - rect.width);
  const dy = Math.max(rect.y - point.y, 0, point.y - rect.y - rect.height);
  return dx * dx + dy * dy;
}

export interface MenuSwipeTarget {
  enter(): void;
  leave(): void;
  activate(): void;
}

class MenuSwipeHit {
  constructor(
    readonly region: MenuSwipeRegion,
    readonly target: MenuSwipeTarget,
    readonly opaque: boolean,
  ) {}
}

export class MenuSwipeScope extends InheritedWidget {
  constructor(
    readonly region: MenuSwipeRegion,
    child: Widget,
  ) {
    super(child);
  }

  static target(
    context: BuildContext,
    target: MenuSwipeTarget,
    child: Widget,
    behavior: HitTestBehavior,
  ): Widget {
    const scope = context.maybeDependOn(MenuSwipeScope);
    return scope
      ? new MetaData(child, {
          behavior,
          metaData: new MenuSwipeHit(scope.region, target, behavior === HitTestBehavior.opaque),
        })
      : child;
  }

  override updateShouldNotify(old: MenuSwipeScope): boolean {
    return old.region !== this.region;
  }
}

export class MenuSwipeRegion {
  readonly distance = new ValueNotifier(0);
  readonly surfaces = new Set<GlobalKey>();
  private recognizer: MultiDragGestureRecognizer | null = null;
  private drag: MenuSwipeHandle | null = null;
  private disposed = false;
  enabled = true;

  start(
    context: BuildContext,
    event: PointerDownEvent,
    delay: number,
    onStart: (() => void) | null,
  ): void {
    if (
      !this.enabled ||
      this.disposed ||
      this.drag !== null ||
      !(context instanceof Element) ||
      event.buttons !== kPrimaryButton
    )
      return;
    this.recognizer?.dispose();
    const binding = context.owner.gestureBinding;
    const recognizerOptions = {
      binding,
      allowedButtonsFilter: (buttons: number) => buttons === kPrimaryButton,
    };
    const recognizer =
      delay > 0
        ? new DelayedMultiDragGestureRecognizer({ ...recognizerOptions, delay })
        : new ImmediateMultiDragGestureRecognizer(recognizerOptions);
    this.recognizer = recognizer;
    recognizer.gestureSettings = MediaQuery.maybeGestureSettingsOf(context);
    recognizer.onStart = (position) => {
      if (!this.enabled || this.disposed || this.drag !== null) return null;
      onStart?.();
      if (!this.enabled || this.disposed) return null;
      const drag = new MenuSwipeHandle(this, binding, event.viewId);
      this.drag = drag;
      drag.move(position);
      return drag;
    };
    recognizer.addPointer(event);
  }

  updateDistance(point: Offset): void {
    let squared = Infinity;
    for (const key of this.surfaces) {
      const render = key.currentContext?.findRenderObject();
      if (render instanceof RenderBox && render.attached && render.hasSize)
        squared = Math.min(
          squared,
          squaredDistanceToMenuRect(point, bounds(render.getTransformTo(null), render.size)),
        );
    }
    this.distance.value = squared === Infinity ? 0 : Math.min(150, Math.sqrt(squared));
  }

  complete(drag: MenuSwipeHandle): void {
    if (drag !== this.drag) return;
    this.drag = null;
    if (!this.disposed) this.distance.value = 0;
  }

  reset(): void {
    const recognizer = this.recognizer;
    this.recognizer = null;
    recognizer?.dispose();
    this.drag?.cancel();
    if (!this.disposed) this.distance.value = 0;
  }

  dispose(): void {
    this.disposed = true;
    this.reset();
    this.distance.dispose();
    this.surfaces.clear();
  }
}

class MenuSwipeHandle extends Drag {
  private targets: MenuSwipeTarget[] = [];
  private ended = false;

  constructor(
    private readonly region: MenuSwipeRegion,
    private readonly binding: GestureBinding,
    private readonly viewId: string | number,
  ) {
    super();
  }

  move(point: Offset): void {
    if (this.ended) return;
    const hit = new HitTestResult();
    this.binding.hitTestInView(hit, new SourceOffset(point.x, point.y), this.viewId);
    const hits: MenuSwipeHit[] = [];
    for (const entry of hit.path) {
      const value = entry.target;
      if (!(value instanceof RenderMetaData)) continue;
      const metadata = value.metaData;
      if (!(metadata instanceof MenuSwipeHit) || metadata.region !== this.region) continue;
      if (!hits.some((entry) => entry.target === metadata.target)) hits.push(metadata);
    }
    const hitsBefore = this.targets.filter((target) => hits.some((hit) => hit.target === target));
    for (const target of this.targets) if (!hitsBefore.includes(target)) target.leave();
    const targets: MenuSwipeTarget[] = [];
    const entering: MenuSwipeTarget[] = [];
    let reachedPrevious = false;
    for (const { target, opaque } of hits) {
      if (hitsBefore.includes(target)) {
        targets.push(target);
        reachedPrevious = true;
      } else if (!reachedPrevious) {
        targets.push(target);
        entering.push(target);
      }
      if (opaque) break;
    }
    for (const target of hitsBefore.reverse()) if (!targets.includes(target)) target.leave();
    for (const target of entering.reverse()) target.enter();
    this.targets = targets;
    this.region.updateDistance(point);
  }

  override update(details: DragUpdateDetails): void {
    this.move(details.globalPosition);
  }

  override end(): void {
    this.finish(true);
  }

  override cancel(): void {
    this.finish(false);
  }

  private finish(activate: boolean): void {
    if (this.ended) return;
    this.ended = true;
    const targets = this.targets;
    this.targets = [];
    this.region.complete(this);
    for (const target of targets) target.leave();
    if (activate) for (const target of targets) target.activate();
  }
}

export class MenuSwipeSurface extends StatefulWidget {
  constructor(
    readonly child: Widget,
    readonly region: MenuSwipeRegion,
    readonly delay = 0,
    readonly onStart: (() => void) | null = null,
  ) {
    super();
  }

  override createState(): State<MenuSwipeSurface> {
    return new MenuSwipeSurfaceState();
  }
}

class MenuSwipeSurfaceState extends State<MenuSwipeSurface> {
  private readonly boundsKey = new GlobalKey('Cupertino menu swipe area');

  override initState(): void {
    super.initState();
    this.widget.region.surfaces.add(this.boundsKey);
  }

  override didUpdateWidget(old: MenuSwipeSurface): void {
    super.didUpdateWidget(old);
    if (old.region !== this.widget.region) {
      old.region.surfaces.delete(this.boundsKey);
      this.widget.region.surfaces.add(this.boundsKey);
    }
  }

  override dispose(): void {
    this.widget.region.surfaces.delete(this.boundsKey);
    super.dispose();
  }

  override build(context: BuildContext): Widget {
    const { child, region, delay, onStart } = this.widget;
    return new Listener(child, {
      key: this.boundsKey,
      behavior: HitTestBehavior.opaque,
      onPointerDown: (event) => region.start(context, event, delay, onStart),
    });
  }
}
