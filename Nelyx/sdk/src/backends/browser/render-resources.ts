// SPDX-License-Identifier: BSD-3-Clause
import { encodeFrame } from '@nelyx/core/ui/frame-wire';
import type { NativeFrameResource } from '@nelyx/core/ui/frame-wire';
import { resourceKey } from '@nelyx/core/ui/frame';
import type { ResourceId } from '@nelyx/core/ui/types';
import type { WebSkiaLibrary } from '@nelyx/skia-web/library';
import {
  mapParagraphResources,
  renderResourceCost,
  wireResourceId,
  workerResourceBytes,
  workerResourceCount,
} from './render-protocol.ts';
import type { RenderCommand, RenderResource } from './render-protocol.ts';

interface ResourceEntry extends NativeFrameResource {
  readonly cost: number;
  ready: boolean;
}

/** Mirrors resources on demand, in dependency order. IDs are never reused in an epoch. */
export class RenderResourceSender {
  private readonly entries = new Map<string, ResourceEntry>();
  private readonly byId = new Map<number, ResourceEntry>();
  private sequence = 0;
  private bytes = 0;
  private waiting = 0;

  constructor(
    private readonly library: WebSkiaLibrary,
    private readonly post: (command: RenderCommand, transfer?: Transferable[]) => void,
  ) {}
  get resourceBytes(): number {
    return this.bytes;
  }
  get hasPendingRegistration(): boolean {
    return this.waiting > 0;
  }

  ready(resources: readonly ResourceId[]): boolean {
    const batch: RenderResource[] = [],
      transfer: Transferable[] = [],
      visiting = new Set<string>();
    const stage = (resource: ResourceId): ResourceEntry => {
      const key = resourceKey(resource),
        previous = this.entries.get(key);
      if (previous) return previous;
      if (visiting.has(key) || visiting.size >= 64)
        throw new Error('Web rendering resource dependency cycle or depth budget');
      if (this.byId.size >= workerResourceCount)
        throw new Error('Web rendering resource count budget');
      visiting.add(key);
      const source = this.library.resourceSource(resource);
      // Assign the ID after dependencies, so reception can validate monotonic IDs.
      const identity = () => ({ id: ++this.sequence, generation: resource.generation });
      let data: RenderResource;
      switch (source.kind) {
        case 'image':
          this.checkBudget(source.byteLength + source.width * source.height * 4);
          data = {
            ...identity(),
            kind: 'image',
            encoding: source.encoding,
            width: source.width,
            height: source.height,
            bytes: source.read(),
          };
          break;
        case 'font':
          this.checkBudget(source.bytes.byteLength * 2);
          data = {
            ...identity(),
            kind: 'font',
            family: source.family,
            bytes: source.bytes.slice(),
          };
          break;
        case 'paragraph': {
          const fonts = source.fonts.map((font) => {
            const { id, generation } = stage(font);
            return { id, generation };
          });
          const input = mapParagraphResources(source.input, (resource) =>
            wireResourceId(stage(resource)),
          );
          data = { ...identity(), kind: 'paragraph', input, fonts };
          break;
        }
        case 'picture': {
          source.frame.resources.forEach(stage);
          const bytes = encodeFrame(source.frame, this.resolve, {
            format: 'web',
          }) as Uint8Array<ArrayBuffer>;
          data = { ...identity(), kind: 'picture', nativeBytes: source.nativeBytes, bytes };
          break;
        }
      }
      visiting.delete(key);
      const cost = renderResourceCost(data);
      this.checkBudget(cost);
      const entry = { id: data.id, generation: data.generation, ready: false, cost };
      this.entries.set(key, entry);
      this.byId.set(data.id, entry);
      this.waiting++;
      this.bytes += cost;
      batch.push(data);
      if ('bytes' in data) transfer.push(data.bytes.buffer);
      return entry;
    };
    let allReady = true;
    for (const resource of resources) if (!stage(resource).ready) allReady = false;
    if (batch.length) this.post({ kind: 'register', resources: batch }, transfer);
    return allReady;
  }
  readonly resolve = (resource: ResourceId): ResourceEntry => {
    const entry = this.entries.get(resourceKey(resource));
    if (!entry) throw new Error('Web rendering resource has not been registered');
    return entry;
  };
  registered(ids: readonly number[]): void {
    for (const id of ids) {
      const entry = this.byId.get(id);
      if (!entry || entry.ready) throw new Error('Unexpected Web render resource acknowledgement');
      entry.ready = true;
      this.waiting--;
    }
  }
  retire(key: string): void {
    const entry = this.entries.get(key);
    if (!entry) return;
    this.entries.delete(key);
    this.post({ kind: 'release', resource: { id: entry.id, generation: entry.generation } });
  }
  released(id: number): void {
    const entry = this.byId.get(id);
    if (!entry || !entry.ready) throw new Error('Unexpected Web render resource retirement');
    this.byId.delete(id);
    this.bytes -= entry.cost;
  }
  private checkBudget(cost: number): void {
    if (!Number.isSafeInteger(cost) || cost < 0 || this.bytes + cost > workerResourceBytes)
      throw new Error('Web rendering resource byte budget');
  }
}
