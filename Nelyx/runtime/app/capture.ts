// SPDX-License-Identifier: BSD-3-Clause
import type { RenderObject, NativeRenderChange } from '@nelyx/core/framework/rendering/object';
import { nativeRenderFields } from '@nelyx/core/framework/rendering/object';
import { protocol as p } from '../engine-client/schema.ts';
import {
  retainSceneConfiguration,
  SceneNode,
  sceneConfiguration,
  relinkRenderBinding,
} from '../engine-client/scene.ts';

type Count = { value: number };
type Refresh = (count: Count, depth: number) => SceneNode;
type Build = (fields: number, previous: SceneNode | undefined, initial: boolean) => SceneNode;
/** One host supplies these methods for its lifetime. Child records retain only
 * their edge input; reading a reused node needs no new build/refresh closure. */
export interface RenderSceneProjection<Input> {
  build(
    render: RenderObject,
    count: Count,
    depth: number,
    input: Input | undefined,
    fields: number,
    previous: SceneNode | undefined,
    initial: boolean,
  ): SceneNode;
  refresh(render: RenderObject, count: Count, depth: number, input: Input | undefined): SceneNode;
}
type Child<Input> = {
  render: RenderObject;
  scene: SceneNode;
  refresh: Refresh | undefined;
  input?: Input | undefined;
  depth: number;
  count: number;
};
type Uses = Map<string, Map<unknown, unknown>>;
const changeBits: Record<NativeRenderChange, number> = {
  children: 1,
  layout: 2,
  paint: 4,
  semantics: 8,
  interaction: 16,
  resource: 32,
};
type Dependencies = Map<RenderObject, number>;
// Most owners have neither registrations nor cross-owner dependencies. These
// sentinels are never mutated; allocate a private map only at its first write.
const emptyUses: Uses = new Map();
const emptyDependencies: Dependencies = new Map();
type Entry<Input> = {
  scene: SceneNode;
  parent: RenderObject | undefined;
  input: string;
  context: string;
  count: number;
  height: number;
  dynamic: boolean;
  hasDynamic: boolean;
  children: readonly Child<Input>[];
  uses: Uses;
  dependencies: ReadonlyMap<RenderObject, number>;
};
type CaptureFrame<Input> = {
  depth: number;
  deepest: number;
  dynamic: boolean;
  hasDynamic: boolean;
  children: Child<Input>[];
  uses: Uses;
  dependencies: Dependencies;
};

/** Configuration cache with independently dirty nodes and descendant edges.
 * Dynamic owners still execute their registration/retirement work each pass;
 * static ancestors only reconnect changed child scenes. */
export class RenderSceneCapture<Input = unknown> {
  private entries = new WeakMap<RenderObject, Entry<Input>>();
  private dirty = new WeakSet<RenderObject>();
  private localDirty = new WeakSet<RenderObject>();
  private fields = new WeakMap<RenderObject, number>();
  private frames: CaptureFrame<Input>[] = [];
  private readonly active = new Map<RenderObject, Entry<Input>>();
  private roots = new Set<RenderObject>();
  private readonly parents = new Map<RenderObject, RenderObject | undefined>();
  private readonly consumers = new Map<RenderObject, Map<RenderObject, number>>();
  private readonly registrations = new Map<string, Map<unknown, Map<RenderObject, unknown>>>();
  private readonly values = new Map<string, Map<unknown, unknown>>();
  private readonly channelRevisions = new Map<string, number>();
  private invalidationBatch: WeakMap<RenderObject, number> | undefined;
  context = '';
  readonly counters = {
    captured: 0,
    created: 0,
    reused: 0,
    relinked: 0,
    dynamic: 0,
    passes: 0,
    activated: 0,
    retired: 0,
    registrationEdits: 0,
    dependencyInvalidations: 0,
    coalescedInvalidations: 0,
    fullCaptures: 0,
    fieldCaptures: 0,
    captureMaps: 0,
  };
  constructor(private readonly projection?: RenderSceneProjection<Input>) {}
  /** Source build is synchronous and capture follows only after it finishes.
   * Coalesce repeated dependency walks within that boundary; every canonical
   * setter/callback still runs, and the following capture reads final values.
   * Never extend this scope across a capture or an asynchronous owner wait. */
  batchInvalidations<T>(callback: () => T): T {
    if (this.invalidationBatch) return callback();
    this.invalidationBatch = new WeakMap();
    try {
      return callback();
    } finally {
      this.invalidationBatch = undefined;
    }
  }
  invalidate(
    render: RenderObject,
    kind: NativeRenderChange = 'layout',
    visited?: Set<RenderObject>,
    fields: number = nativeRenderFields.all,
  ): void {
    if (visited?.has(render)) return;
    visited?.add(render);
    // Accumulate before coalescing the dependency walk: two setters can change
    // different commands in the same coarse invalidation category.
    this.fields.set(render, (this.fields.get(render) ?? 0) | fields);
    if (this.invalidationBatch) {
      const mask = this.invalidationBatch.get(render) ?? 0;
      if (mask & changeBits[kind]) {
        ++this.counters.coalescedInvalidations;
        return;
      }
      this.invalidationBatch.set(render, mask | changeBits[kind]);
    }
    this.localDirty.add(render);
    for (let at: RenderObject | undefined = render, depth = 0; at; at = at.parent) {
      if (++depth > p.limits.depth) throw Error('Native capture parent depth exceeded');
      if (this.dirty.has(at)) break;
      this.dirty.add(at);
    }
    const consumers = this.consumers.get(render);
    if (!consumers?.size) return;
    if (!visited) {
      visited = new Set();
      visited.add(render);
    }
    for (const [consumer, mask] of consumers) {
      if (!(mask & changeBits[kind])) continue;
      ++this.counters.dependencyInvalidations;
      this.invalidate(consumer, kind, visited);
    }
  }
  /** A registration belongs to this projected owner, including while its
   * configuration is reused. Parking retires it; a remount captures it anew. */
  bind(channel: string, key: unknown, value: unknown): void {
    const frame = this.frames.at(-1);
    if (!frame) throw Error('Capture registration has no owner');
    if (frame.uses === emptyUses) {
      frame.uses = new Map();
      ++this.counters.captureMaps;
    }
    let uses = frame.uses.get(channel);
    if (!uses) {
      frame.uses.set(channel, (uses = new Map()));
      ++this.counters.captureMaps;
    }
    uses.set(key, value);
  }
  bindings<K, V>(channel: string): ReadonlyMap<K, V> {
    let values = this.values.get(channel);
    if (!values) this.values.set(channel, (values = new Map()));
    return values as Map<K, V>;
  }
  bindingRevision(channel: string): number {
    return this.channelRevisions.get(channel) ?? 0;
  }
  binding<K, V>(channel: string, key: K): V | undefined {
    for (let i = this.frames.length - 1; i >= 0; --i) {
      const uses = this.frames[i]!.uses.get(channel);
      if (uses?.has(key)) return uses.get(key) as V;
    }
    return this.bindings<K, V>(channel).get(key);
  }
  dependOn(render: RenderObject, changes?: readonly NativeRenderChange[]): void {
    const frame = this.frames.at(-1);
    if (!frame) return;
    if (frame.dependencies === emptyDependencies) {
      frame.dependencies = new Map();
      ++this.counters.captureMaps;
    }
    const dependencies = frame.dependencies;
    const mask = changes ? changes.reduce((bits, kind) => bits | changeBits[kind], 0) : 63;
    dependencies.set(render, (dependencies.get(render) ?? 0) | mask);
  }
  private register(render: RenderObject, entry: Entry<Input>, add: boolean): void {
    for (const [channel, uses] of entry.uses) {
      let keys = this.registrations.get(channel);
      if (!keys) this.registrations.set(channel, (keys = new Map()));
      const values = this.bindings(channel) as Map<unknown, unknown>;
      for (const [key, value] of uses) {
        let owners = keys.get(key);
        if (add) {
          if (!owners) keys.set(key, (owners = new Map()));
          owners.set(render, value);
        } else owners?.delete(render);
        if (owners?.size) values.set(key, owners.values().next().value);
        else {
          keys.delete(key);
          values.delete(key);
        }
        ++this.counters.registrationEdits;
        this.channelRevisions.set(channel, this.bindingRevision(channel) + 1);
      }
    }
    for (const [target, mask] of entry.dependencies) {
      let owners = this.consumers.get(target);
      if (add) {
        if (!owners) this.consumers.set(target, (owners = new Map()));
        owners.set(render, mask);
      } else {
        owners?.delete(render);
        if (!owners?.size) this.consumers.delete(target);
      }
    }
  }
  /** Commit the desired projection. Only changed edges and removed subtrees
   * are visited; a reused subtree retains all its registrations in O(1). */
  commit(roots: readonly RenderObject[]): void {
    if (this.invalidationBatch)
      throw Error('Native projection cannot commit inside a Source build batch');
    const nextRoots = new Set(roots),
      candidates = new Set(this.roots);
    const visit = (render: RenderObject, parent?: RenderObject): void => {
      const next = this.entries.get(render);
      if (!next) throw Error('Uncaptured projected owner');
      const previous = this.active.get(render);
      this.parents.set(render, parent);
      if (previous === next) return;
      if (previous) {
        if (previous.uses !== next.uses || previous.dependencies !== next.dependencies)
          this.register(render, previous, false);
        if (
          previous.children.length !== next.children.length ||
          previous.children.some((child, index) => child.render !== next.children[index]!.render)
        ) {
          const children = new Set(next.children.map((child) => child.render));
          for (const child of previous.children)
            if (!children.has(child.render)) candidates.add(child.render);
        }
      } else ++this.counters.activated;
      this.active.set(render, next);
      if (!previous || previous.uses !== next.uses || previous.dependencies !== next.dependencies)
        this.register(render, next, true);
      for (const child of next.children) visit(child.render, render);
    };
    for (const render of roots) visit(render);
    this.roots = nextRoots;
    const connected = (render: RenderObject): boolean => {
      for (let at: RenderObject | undefined = render, depth = 0; at;) {
        if (++depth > p.limits.depth) throw Error('Capture projection cycle/depth exceeded');
        if (nextRoots.has(at)) return true;
        const parent = this.parents.get(at);
        if (!parent || !this.active.get(parent)?.children.some((child) => child.render === at))
          return false;
        at = parent;
      }
      return false;
    };
    const retire = (render: RenderObject): void => {
      if (connected(render)) return;
      const entry = this.active.get(render);
      if (!entry) return;
      this.active.delete(render);
      this.parents.delete(render);
      this.entries.delete(render);
      this.register(render, entry, false);
      ++this.counters.retired;
      // Reference encoders still resolve the current handle at commit. Mark
      // their Source owners too, so the next projection cannot reuse a stale
      // configuration after this target parks or changes generations.
      // Retirement invalidates every reference consumer, regardless of which
      // changes it observes while the target is alive. Its handle may recycle.
      for (const [owner] of this.consumers.get(render) ?? []) this.invalidate(owner);
      for (const child of entry.children) retire(child.render);
    };
    for (const render of candidates) retire(render);
  }
  /** A failed capture never becomes the next cache baseline. This full walk
   * is deliberately confined to recovery, not successful scene updates. */
  abort(): void {
    this.entries = new WeakMap(this.active);
    for (const render of this.active.keys()) this.invalidate(render);
  }
  dynamic(): void {
    const frame = this.frames.at(-1);
    if (frame) frame.dynamic = frame.hasDynamic = true;
  }
  node(
    render: RenderObject,
    input: string,
    count: Count,
    depth: number,
    build: Build | undefined,
    refresh: Refresh | undefined,
    edgeInput?: Input,
  ): SceneNode {
    if (!build && !this.projection) throw Error('Native capture has no host projection');
    if (this.invalidationBatch)
      throw Error('Native capture cannot run inside a Source build batch');
    const parent = this.frames.at(-1),
      before = count.value;
    const scene = this.read(render, input, count, depth, build, edgeInput);
    const entry = this.entries.get(render)!;
    if (parent) {
      parent.children.push(
        refresh
          ? { render, scene, refresh, depth: depth - parent.depth, count: count.value - before }
          : {
              render,
              scene,
              refresh,
              input: edgeInput,
              depth: depth - parent.depth,
              count: count.value - before,
            },
      );
      parent.deepest = Math.max(parent.deepest, depth + entry.height);
      parent.hasDynamic ||= entry.hasDynamic;
    }
    return scene;
  }
  private read(
    render: RenderObject,
    input: string,
    count: Count,
    depth: number,
    build: Build | undefined,
    edgeInput: Input | undefined,
  ): SceneNode {
    const entry = this.entries.get(render);
    const valid =
      !render.debugDisposed &&
      entry &&
      entry.parent === render.parent &&
      entry.input === input &&
      entry.context === this.context;
    if (valid && !this.dirty.has(render) && !entry.hasDynamic) {
      if (count.value + entry.count >= p.limits.nodes || depth + entry.height >= p.limits.depth)
        throw Error('Native capture node/depth budget exceeded');
      count.value += entry.count;
      this.counters.reused += entry.count;
      return entry.scene;
    }
    const reconnect = valid && !entry.dynamic && !this.localDirty.has(render);
    const fields =
      valid && !entry.dynamic
        ? (this.fields.get(render) ?? nativeRenderFields.all)
        : nativeRenderFields.all;
    // New invalidations during projection belong to the following capture.
    this.fields.delete(render);
    this.dirty.delete(render);
    this.localDirty.delete(render);
    const before = count.value;
    const frame: CaptureFrame<Input> = {
      depth,
      deepest: depth,
      dynamic: false,
      hasDynamic: false,
      children: [],
      uses: reconnect ? entry.uses : emptyUses,
      dependencies: reconnect ? (entry.dependencies as Dependencies) : emptyDependencies,
    };
    this.frames.push(frame);
    try {
      let scene: SceneNode;
      if (reconnect) {
        // Synthetic paint nodes are owned by this configuration; render-child
        // subtrees account for their own node/depth limits during refresh.
        count.value += entry.count - entry.children.reduce((sum, child) => sum + child.count, 0);
        if (count.value >= p.limits.nodes || depth >= p.limits.depth)
          throw Error('Native capture node/depth budget exceeded');
        const old = entry.scene;
        let children: SceneNode[] | undefined;
        for (const child of entry.children) {
          const next = child.refresh
            ? child.refresh(count, depth + child.depth)
            : this.projection!.refresh(child.render, count, depth + child.depth, child.input);
          if (next !== child.scene) {
            const index = old.children.indexOf(child.scene);
            if (index < 0) throw Error('Native capture child edge is absent');
            children ??= old.children.slice();
            children[index] = next;
          }
        }
        scene = children
          ? (relinkRenderBinding(old, children) ??
            sceneConfiguration(
              old.reference,
              old.kind,
              children,
              old.options,
              old.text,
              old.image,
              old.editor,
              old.editorFlags,
              old.maximumLength,
            ))
          : old;
        ++this.counters.relinked;
      } else {
        ++this.counters.captured;
        if (fields === nativeRenderFields.all) ++this.counters.fullCaptures;
        else ++this.counters.fieldCaptures;
        if (!entry) ++this.counters.created;
        const previous = valid && !entry.dynamic ? entry.scene : undefined;
        scene = build
          ? build(fields, previous, !entry)
          : this.projection!.build(render, count, depth, edgeInput, fields, previous, !entry);
      }
      if (!frame.dynamic) {
        retainSceneConfiguration(scene, entry?.scene);
        // Paint/inline projections are owned by this Source configuration too.
        // Stop at render-child boundaries: their owners decide independently
        // whether live references/control policies can retain configuration.
        if (
          scene.children.length !== frame.children.length ||
          frame.children.some((child, index) => child.scene !== scene.children[index])
        ) {
          const renderChildren = new Set(frame.children.map((child) => child.scene));
          const retain = (node: SceneNode): void => {
            if (renderChildren.has(node)) return;
            retainSceneConfiguration(node);
            for (const child of node.children) retain(child);
          };
          for (const child of scene.children) retain(child);
        }
      } else ++this.counters.dynamic;
      this.entries.set(render, {
        scene,
        parent: render.parent,
        input,
        context: this.context,
        count: count.value - before,
        height: frame.deepest - depth,
        dynamic: frame.dynamic,
        hasDynamic: frame.hasDynamic,
        children: frame.children,
        uses: frame.uses,
        dependencies: frame.dependencies,
      });
      return scene;
    } catch (error) {
      this.entries.delete(render);
      this.invalidate(render);
      throw error;
    } finally {
      this.frames.pop();
    }
  }
  clear(): void {
    this.entries = new WeakMap();
    this.dirty = new WeakSet();
    this.localDirty = new WeakSet();
    this.fields = new WeakMap();
    this.active.clear();
    this.roots.clear();
    this.parents.clear();
    this.consumers.clear();
    this.registrations.clear();
    this.channelRevisions.clear();
    for (const values of this.values.values()) values.clear();
  }
}
