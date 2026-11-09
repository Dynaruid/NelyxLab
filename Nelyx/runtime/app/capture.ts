// SPDX-License-Identifier: BSD-3-Clause
import type { RenderObject } from '@nelyx/core/framework/rendering/object';
import { protocol as p } from '../engine-client/schema.ts';
import { retainSceneConfiguration } from '../engine-client/scene.ts';
import type { SceneNode } from '../engine-client/scene.ts';

type Entry = {
  scene: SceneNode;
  parent: RenderObject | undefined;
  input: string;
  context: string;
  count: number;
  height: number;
};

/** Retains configuration, never layout/paint output. Invalidation walks the
 * ancestor path even though native-owned Source objects never flush TS layout.
 * Dynamic ownership boundaries opt out and propagate that decision upward. */
export class RenderSceneCapture {
  private entries = new WeakMap<RenderObject, Entry>();
  private dirty = new WeakSet<RenderObject>();
  private frames: { reusable: boolean; deepest: number }[] = [];
  context = '';
  readonly counters = { captured: 0, reused: 0, passes: 0 };
  invalidate(render: RenderObject): void {
    for (let at: RenderObject | undefined = render, depth = 0; at; at = at.parent) {
      if (++depth > p.limits.depth) throw Error('Native capture parent depth exceeded');
      if (this.dirty.has(at)) break;
      this.dirty.add(at);
    }
  }
  dynamic(): void {
    const frame = this.frames.at(-1);
    if (frame) frame.reusable = false;
  }
  node(
    render: RenderObject,
    input: string,
    count: { value: number },
    depth: number,
    build: () => SceneNode,
  ): SceneNode {
    const parent = this.frames.at(-1),
      entry = this.entries.get(render);
    if (
      !render.debugDisposed &&
      entry &&
      !this.dirty.has(render) &&
      entry.parent === render.parent &&
      entry.input === input &&
      entry.context === this.context
    ) {
      if (count.value + entry.count >= p.limits.nodes || depth + entry.height >= p.limits.depth)
        throw Error('Native capture node/depth budget exceeded');
      count.value += entry.count;
      this.counters.reused += entry.count;
      if (parent) parent.deepest = Math.max(parent.deepest, depth + entry.height);
      return entry.scene;
    }
    this.dirty.delete(render);
    const before = count.value,
      frame = { reusable: true, deepest: depth };
    this.frames.push(frame);
    ++this.counters.captured;
    try {
      const scene = build();
      if (frame.reusable) {
        retainSceneConfiguration(scene);
        this.entries.set(render, {
          scene,
          parent: render.parent,
          input,
          context: this.context,
          count: count.value - before,
          height: frame.deepest - depth,
        });
      } else this.entries.delete(render);
      return scene;
    } catch (error) {
      this.entries.delete(render);
      throw error;
    } finally {
      this.frames.pop();
      if (parent) {
        parent.reusable &&= frame.reusable;
        parent.deepest = Math.max(parent.deepest, frame.deepest);
      }
    }
  }
  clear(): void {
    this.entries = new WeakMap();
    this.dirty = new WeakSet();
  }
}
