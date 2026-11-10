// SPDX-License-Identifier: BSD-3-Clause
import type { RenderObject } from '@nelyx/core/framework/rendering/object';
import { protocol as p } from '../engine-client/schema.ts';
import { retainSceneConfiguration, SceneNode } from '../engine-client/scene.ts';

type Count = { value: number };
type Refresh = (count: Count, depth: number) => SceneNode;
type Child = { scene: SceneNode; refresh: Refresh; depth: number; count: number };
type Entry = {
  scene: SceneNode;
  parent: RenderObject | undefined;
  input: string;
  context: string;
  count: number;
  height: number;
  dynamic: boolean;
  hasDynamic: boolean;
  children: readonly Child[];
};
type CaptureFrame = {
  depth: number;
  deepest: number;
  dynamic: boolean;
  hasDynamic: boolean;
  children: Child[];
};

/** Configuration cache with independently dirty nodes and descendant edges.
 * Dynamic owners still execute their registration/retirement work each pass;
 * static ancestors only reconnect changed child scenes. */
export class RenderSceneCapture {
  private entries = new WeakMap<RenderObject, Entry>();
  private dirty = new WeakSet<RenderObject>();
  private localDirty = new WeakSet<RenderObject>();
  private frames: CaptureFrame[] = [];
  context = '';
  readonly counters = { captured: 0, reused: 0, relinked: 0, dynamic: 0, passes: 0 };
  invalidate(render: RenderObject): void {
    this.localDirty.add(render);
    for (let at: RenderObject | undefined = render, depth = 0; at; at = at.parent) {
      if (++depth > p.limits.depth) throw Error('Native capture parent depth exceeded');
      if (this.dirty.has(at)) break;
      this.dirty.add(at);
    }
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
    build: () => SceneNode,
    refresh: Refresh,
  ): SceneNode {
    const parent = this.frames.at(-1),
      before = count.value;
    const scene = this.read(render, input, count, depth, build);
    const entry = this.entries.get(render)!;
    if (parent) {
      parent.children.push({
        scene,
        refresh,
        depth: depth - parent.depth,
        count: count.value - before,
      });
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
    build: () => SceneNode,
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
    this.dirty.delete(render);
    this.localDirty.delete(render);
    const before = count.value;
    const frame: CaptureFrame = {
      depth,
      deepest: depth,
      dynamic: false,
      hasDynamic: false,
      children: [],
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
          const next = child.refresh(count, depth + child.depth);
          if (next !== child.scene) {
            const index = old.children.indexOf(child.scene);
            if (index < 0) throw Error('Native capture child edge is absent');
            children ??= old.children.slice();
            children[index] = next;
          }
        }
        scene = children
          ? new SceneNode(
              old.reference,
              old.kind,
              children,
              old.options,
              old.text,
              old.image,
              old.editor,
              old.editorFlags,
              old.maximumLength,
            )
          : old;
        ++this.counters.relinked;
      } else {
        ++this.counters.captured;
        scene = build();
      }
      if (!frame.dynamic) retainSceneConfiguration(scene);
      else ++this.counters.dynamic;
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
      });
      return scene;
    } catch (error) {
      this.entries.delete(render);
      throw error;
    } finally {
      this.frames.pop();
    }
  }
  clear(): void {
    this.entries = new WeakMap();
    this.dirty = new WeakSet();
    this.localDirty = new WeakSet();
  }
}
