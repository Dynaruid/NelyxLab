// SPDX-License-Identifier: BSD-3-Clause
import { KeyMap } from '@nelyx/core/foundation/key';
import type { Key } from '@nelyx/core/foundation/key';
import type { RenderSceneCapture } from './capture.ts';
import {
  nativeTapRegionConfiguration,
  bindNativeTapRegionSemantics,
  RenderTapRegionSurface,
} from '@nelyx/core/framework/widgets/tap-region';
import type { RenderObject } from '@nelyx/core/framework/rendering/object';
import type { SemanticsActionEvent } from '@nelyx/core/ui/semantics-action';
import { PointerDownEvent, PointerUpEvent } from '@nelyx/core/framework/gestures/events';
import { PointerDeviceKind } from '@nelyx/core/ui/pointer';
import { Offset } from '@nelyx/core/ui/offset';
import { fullTransform } from '@nelyx/core/ui/geometry';
import { FlutterError } from '@nelyx/core/foundation/flutter-error';
import { FlutterErrorDetails } from '@nelyx/core/foundation/assertions';
import type { EngineEvent, NodeHandle } from '../engine-client/codec.ts';
import type { OriginalControlConfiguration } from './controls.ts';
import { protocol as p } from '../engine-client/schema.ts';

/** Source supplies policy/callbacks. Every inside/outside decision is native. */
export class OriginalTapRegions {
  private groups = new KeyMap<number>();
  private nextGroup = 0;
  private readonly groupKeys = new Map<number, Key>();
  private readonly freeGroups: number[] = [];
  private readonly surfaces = new Map<
    RenderTapRegionSurface,
    { release: () => void; ancestors: readonly RenderObject[] }
  >();
  private retained = new Set<RenderTapRegionSurface>();
  private readonly failed = new WeakMap<RenderTapRegionSurface, bigint>();
  private readonly semanticEvents = new Map<
    bigint,
    { surface: RenderTapRegionSurface; invoke: (viewId: number | string) => void }[]
  >();
  private semanticBatch = 0n;
  private closed = false;
  constructor(
    private readonly viewId: number,
    private readonly handle: (render: RenderObject) => NodeHandle | null,
    private readonly reject: (reason: string) => never,
    private readonly capture?: Pick<RenderSceneCapture, 'bind' | 'bindings' | 'dependOn'>,
  ) {}
  beginBuild(): void {
    if (!this.capture) {
      this.groups.clear();
      this.nextGroup = 0;
    }
    this.retained.clear();
  }
  finishBuild(): void {
    if (this.capture) {
      for (const surface of this.capture
        .bindings<RenderTapRegionSurface, RenderTapRegionSurface>('tapSurfaces')
        .keys())
        this.retain(surface);
      const active = this.capture.bindings<number, Key>('tapGroups');
      for (const [group, key] of this.groupKeys)
        if (!active.has(group)) {
          this.groups.delete(key);
          this.groupKeys.delete(group);
          this.freeGroups.push(group);
        }
    }
    for (const [surface, binding] of this.surfaces)
      if (!this.retained.has(surface)) {
        binding.release();
        this.surfaces.delete(surface);
      }
    this.retained.clear();
    if (!this.capture) this.groups.clear();
  }
  retain(render: RenderObject): void {
    const source = nativeTapRegionConfiguration(render);
    if (source?.kind !== 'surface' || this.closed) return;
    const surface = source.render;
    this.retained.add(surface);
    const ancestors: RenderObject[] = [];
    for (let parent = surface.parent; parent; parent = parent.parent) {
      if (ancestors.length >= p.limits.depth) return this.reject('tap-region-parent-depth');
      ancestors.push(parent);
    }
    const previous = this.surfaces.get(surface);
    if (
      previous &&
      (previous.ancestors.length !== ancestors.length ||
        previous.ancestors.some((parent, index) => parent !== ancestors[index]))
    ) {
      previous.release();
      this.surfaces.delete(surface);
    }
    // Called after children, matching Source attach's listener order.
    if (!this.surfaces.has(surface))
      this.surfaces.set(surface, {
        release: bindNativeTapRegionSemantics(surface, (event) =>
          this.semanticSurface(surface, event),
        ),
        ancestors,
      });
  }
  configuration(render: RenderObject): OriginalControlConfiguration | undefined {
    const source = nativeTapRegionConfiguration(render);
    if (!source) return undefined;
    if (this.capture) {
      for (let ancestor = render.parent, depth = 0; ancestor; ancestor = ancestor.parent) {
        if (++depth > p.limits.depth) return this.reject('tap-region-parent-depth');
        this.capture.dependOn(ancestor);
      }
      if (source.kind === 'surface') this.capture.bind('tapSurfaces', source.render, source.render);
    }
    const options = {
      layout: { childConstraints: 'inherit' as const },
      pointerHitTest: source.pointerHitTest,
    };
    if (source.kind === 'surface')
      return { options: { ...options, tapRegion: { kind: 'surface' } } };
    const region = source.render,
      surface = source.registry;
    if (!surface) return { options };
    if (Object.getPrototypeOf(surface) !== RenderTapRegionSurface.prototype)
      return this.reject('custom-tap-region-registry');
    const registry = surface as RenderTapRegionSurface;
    let group = 0;
    if (source.groupKey) {
      group = this.groups.get(source.groupKey) ?? 0;
      if (!group) {
        group = this.freeGroups.pop() ?? ++this.nextGroup;
        if (group > p.limits.nodes) return this.reject('tap-region-group-budget');
        this.groups.set(source.groupKey, group);
        this.groupKeys.set(group, source.groupKey);
      }
      this.capture?.bind('tapGroups', group, source.groupKey);
    }
    const revision = source.revision;
    const invoke = (event: EngineEvent, viewId: number | string = this.viewId): void => {
      if (
        this.closed ||
        registry.debugDisposed ||
        region.debugDisposed ||
        !region.enabled ||
        region.registry !== registry ||
        nativeTapRegionConfiguration(region)?.revision !== revision
      )
        return;
      const inside =
          event.status === p.tapRegionEvents.downInside ||
          event.status === p.tapRegionEvents.upInside,
        up =
          event.status === p.tapRegionEvents.upInside ||
          event.status === p.tapRegionEvents.upOutside,
        tap = event.tapRegion!,
        details = event.gesture!;
      const eventOptions = tap.semanticTarget.slot
        ? { viewId, position: new Offset(event.x, event.y) }
        : {
            viewId,
            position: new Offset(event.x, event.y),
            pointer: details.stream,
            device: tap.device,
            kind: PointerDeviceKind[details.pointerKind],
            timeStamp: details.timestamp * 1000,
            buttons: details.buttons,
          };
      if (up) {
        const pointer = new PointerUpEvent(eventOptions).transformed(
          tap.semanticTarget.slot ? null : fullTransform(tap.inverse),
        );
        if (inside) region.onTapUpInside?.(pointer);
        else region.onTapUpOutside?.(pointer);
      } else {
        const pointer = new PointerDownEvent(eventOptions).transformed(
          tap.semanticTarget.slot ? null : fullTransform(tap.inverse),
        );
        if (inside) region.onTapInside?.(pointer);
        else region.onTapOutside?.(pointer);
      }
    };
    return {
      options: {
        ...options,
        tapRegion: () => ({
          kind: 'region',
          surface: this.handle(registry) ?? this.reject('unbound-tap-region-surface'),
          revision,
          group,
          enabled: region.enabled,
          consumeOutside: region.consumeOutsideTaps,
          downInside: !!region.onTapInside,
          downOutside: !!region.onTapOutside,
          upInside: !!region.onTapUpInside,
          upOutside: !!region.onTapUpOutside,
        }),
        onTapRegion: (event) => {
          const tap = event.tapRegion ?? this.reject('native-tap-region-details');
          if (tap.semanticTarget.slot) {
            let batch = this.semanticEvents.get(tap.batch);
            if (!batch) {
              if (this.semanticEvents.size >= p.limits.interactionEvents)
                return this.reject('native-tap-region-batches');
              this.semanticEvents.set(tap.batch, (batch = []));
            }
            if (batch.length >= p.limits.interactionEvents)
              return this.reject('native-tap-region-events');
            batch.push({ surface: registry, invoke: (viewId) => invoke(event, viewId) });
            return;
          }
          if (this.failed.get(registry) === tap.batch) return;
          try {
            invoke(event);
          } catch (exception) {
            this.failed.set(registry, tap.batch);
            FlutterError.reportError(
              new FlutterErrorDetails({ exception, library: 'native tap regions' }),
            );
          }
        },
      },
    };
  }
  private semanticSurface(surface: RenderTapRegionSurface, event: SemanticsActionEvent): void {
    if (
      this.closed ||
      !this.semanticBatch ||
      !surface.semanticsBinding.getRectOfSemanticsNodeInViewCoordinates(event.viewId, event.nodeId)
    )
      return;
    for (const pending of this.semanticEvents.get(this.semanticBatch) ?? [])
      if (pending.surface === surface) {
        if (surface.debugDisposed) return;
        pending.invoke(event.viewId);
      }
  }
  action(event: EngineEvent, dispatch: () => void): void {
    const previous = this.semanticBatch,
      batch = event.tapRegion?.batch ?? 0n;
    this.semanticBatch = batch;
    try {
      dispatch();
    } finally {
      this.semanticBatch = previous;
      if (batch) this.semanticEvents.delete(batch);
    }
  }
  close(): void {
    if (this.closed) return;
    this.closed = true;
    for (const binding of this.surfaces.values()) binding.release();
    this.surfaces.clear();
    this.retained.clear();
    this.groups.clear();
    this.groupKeys.clear();
    this.freeGroups.length = 0;
    this.semanticEvents.clear();
    this.semanticBatch = 0n;
  }
}
