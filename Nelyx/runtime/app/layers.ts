// SPDX-License-Identifier: BSD-3-Clause
import {
  RenderLeaderLayer,
  RenderFollowerLayer,
  synchronizeNativeProxyLayer,
  releaseNativeProxyLayer,
} from '@nelyx/core/framework/rendering/proxy-layer';
import type { LayerLink, Layer } from '@nelyx/core/framework/rendering/layer';
import type { RenderObject } from '@nelyx/core/framework/rendering/object';
import type { NodeHandle, EngineResponse } from '../engine-client/codec.ts';
import type { SceneNodeOptions } from '../engine-client/scene.ts';
import { Alignment } from '@nelyx/core/framework/painting/alignment';
import { protocol as p } from '../engine-client/schema.ts';
const owners = new WeakMap<LayerLink, OriginalLayers>();
interface Binding {
  readonly render: RenderLeaderLayer | RenderFollowerLayer;
  readonly link: LayerLink;
  readonly configuration?: {
    readonly offset: { readonly x: number; readonly y: number };
    readonly leaderAnchor: Alignment;
    readonly followerAnchor: Alignment;
  };
}

/** Resolve Source link identities; Content owns every linked transform and anchor. */
export class OriginalLayers {
  private leaders = new Map<LayerLink, RenderLeaderLayer>();
  private links = new Set<LayerLink>();
  private acceptedLinks = new Set<LayerLink>();
  private prepared: Binding[] = [];
  private snapshots = new Map<bigint, readonly Binding[]>();
  private mirrors = new Set<RenderObject>();
  private publication: EngineResponse | undefined;
  private state: EngineResponse | undefined;
  private notified = 0n;
  private closed = false;
  constructor(
    private readonly owner: object,
    private readonly fail: (reason: string) => never,
    private readonly handle: (render: RenderObject) => NodeHandle | null,
  ) {}
  begin(): void {
    this.leaders.clear();
    this.prepared = [];
    for (const render of this.mirrors) if (render.debugDisposed) this.mirrors.delete(render);
  }
  accept(epoch: bigint): void {
    if (this.closed) return;
    this.snapshots.set(epoch, this.prepared);
    this.acceptedLinks = new Set(this.prepared.map((binding) => binding.link));
    this.prepared = [];
    this.releaseUnusedOwners();
    this.trimSnapshots();
    this.synchronize();
  }
  reject(): void {
    this.prepared = [];
    this.releaseUnusedOwners();
  }
  private releaseUnusedOwners(): void {
    for (const link of this.links)
      if (!this.acceptedLinks.has(link)) {
        if (owners.get(link) === this) owners.delete(link);
        this.links.delete(link);
      }
  }
  observePublication(frame: EngineResponse): void {
    if (!this.closed) {
      this.publication = frame;
      this.synchronize();
    }
  }
  observeState(state: EngineResponse): void {
    if (!this.closed) {
      this.state = state;
      this.trimSnapshots();
      this.synchronize();
    }
  }
  private trimSnapshots(): void {
    const pinned = new Set([
      this.publication?.publishedDocument,
      this.state?.activeDocument,
      this.state?.preparationDocument,
    ]);
    for (const epoch of this.snapshots.keys()) {
      if (this.snapshots.size <= p.limits.publicationSnapshots) break;
      if (!pinned.has(epoch)) this.snapshots.delete(epoch);
    }
  }
  private synchronize(): void {
    const frame = this.publication;
    if (!frame?.publication) return;
    const bindings = this.snapshots.get(frame.publishedDocument);
    if (!bindings) return;
    const layers: Layer[] = [];
    for (const prototype of [RenderLeaderLayer.prototype, RenderFollowerLayer.prototype])
      for (const binding of bindings) {
        const { render, link, configuration } = binding;
        if (render.debugDisposed || Object.getPrototypeOf(render) !== prototype) continue;
        const layer = synchronizeNativeProxyLayer(render, link, configuration);
        if (layer) {
          layers.push(layer);
          this.mirrors.add(render);
        }
      }
    if (this.notified === frame.publication || (!layers.length && bindings.length)) return;
    this.notified = frame.publication;
    const errors: unknown[] = [];
    for (const layer of layers)
      try {
        layer._fireCompositionCallbacks(false);
      } catch (error) {
        errors.push(error);
      }
    if (errors.length)
      throw new AggregateError(errors, 'Native composition observation callbacks failed');
  }
  configuration(render: RenderObject): SceneNodeOptions | undefined {
    const prototype = Object.getPrototypeOf(render);
    if (prototype !== RenderLeaderLayer.prototype && prototype !== RenderFollowerLayer.prototype)
      return;
    const source = render as RenderLeaderLayer | RenderFollowerLayer,
      owner = owners.get(source.link);
    if (
      (owner && owner !== this) ||
      (source.link.leader?.owner && source.link.leader.owner !== this.owner)
    )
      this.fail('foreign-layer-link');
    // Registration follows the projected scene. Source can retain offscreen
    // list children whose native nodes have already left this transaction.
    this.prepared.push({
      render: source,
      link: source.link,
      ...(source instanceof RenderFollowerLayer
        ? {
            configuration: Object.freeze({
              offset: Object.freeze({ ...source.offset }),
              leaderAnchor: new Alignment(source.leaderAnchor.x, source.leaderAnchor.y),
              followerAnchor: new Alignment(source.followerAnchor.x, source.followerAnchor.y),
            }),
          }
        : {}),
    });
    owners.set(source.link, this);
    this.links.add(source.link);
    if (source instanceof RenderLeaderLayer) {
      if (this.leaders.has(source.link)) this.fail('duplicate-layer-leader');
      this.leaders.set(source.link, source);
      return { layerLink: { kind: 'leader' } };
    }
    return {
      layerLink: () => {
        // A retained follower can outlive a lazily removed leader. Resolve the
        // current prepared tree even when its SceneNode options are reused.
        const leader = this.leaders.get(source.link);
        return {
          kind: 'follower',
          leader: leader ? (this.handle(leader) ?? this.fail('unbound-layer-leader')) : null,
          showWhenUnlinked: source.showWhenUnlinked,
          offset: source.offset,
          leaderAnchor: source.leaderAnchor,
          followerAnchor: source.followerAnchor,
        };
      },
    };
  }
  close(): void {
    if (this.closed) return;
    this.closed = true;
    const errors: unknown[] = [];
    for (const render of this.mirrors)
      try {
        releaseNativeProxyLayer(render);
      } catch (error) {
        errors.push(error);
      }
    this.mirrors.clear();
    this.snapshots.clear();
    this.prepared = [];
    this.acceptedLinks.clear();
    this.publication = undefined;
    this.state = undefined;
    for (const link of this.links) if (owners.get(link) === this) owners.delete(link);
    this.links.clear();
    this.leaders.clear();
    if (errors.length) throw new AggregateError(errors, 'Native Source layer close failed');
  }
}
