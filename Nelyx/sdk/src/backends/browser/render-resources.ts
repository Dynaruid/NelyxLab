// SPDX-License-Identifier: BSD-3-Clause
import { encodeFrame } from '@nelyx/core/ui/frame-wire';
import type { NativeFrameResource } from '@nelyx/core/ui/frame-wire';
import { resourceKey } from '@nelyx/core/ui/frame';
import type { ResourceId } from '@nelyx/core/ui/types';
import type { WebSkiaLibrary } from '@nelyx/skia-web/library';
import {
  mapParagraphResources,
  renderResourceReservation,
  wireResourceId,
  workerResourceBytes,
  workerResourceCount,
} from './render-protocol.ts';
import type { RenderReply, RenderResource } from './render-protocol.ts';

interface ResourceEntry extends NativeFrameResource {
  readonly kind: RenderResource['kind'];
  cost: number;
  retiring: boolean;
}

export interface RenderRegistration {
  readonly resources: readonly RenderResource[];
  readonly transfer: readonly ArrayBuffer[];
  readonly entries: ReadonlyMap<string, ResourceEntry>;
  readonly bytes: number;
  readonly uploadBytes: number;
  readonly resolve: (resource: ResourceId) => NativeFrameResource;
}

/** Mirrors resources in dependency order. Only a posted batch consumes IDs in an epoch. */
export class RenderResourceSender {
  private readonly entries = new Map<string, ResourceEntry>();
  private readonly byId = new Map<number, ResourceEntry>();
  private sequence = 0;
  private bytes = 0;
  private pending:
    | {
        readonly sequence: number | undefined;
        readonly entries: readonly ResourceEntry[];
        readonly bytes: number;
      }
    | undefined;

  constructor(
    private readonly library: WebSkiaLibrary,
    private readonly release: (resource: NativeFrameResource) => void,
  ) {}
  get resourceBytes(): number {
    return this.bytes;
  }
  get hasPendingRegistration(): boolean {
    return !!this.pending;
  }

  prepare(resources: readonly ResourceId[]): RenderRegistration | undefined {
    if (resources.every((resource) => this.entries.has(resourceKey(resource)))) return;
    const batch: RenderResource[] = [],
      transfer: ArrayBuffer[] = [],
      entries = new Map<string, ResourceEntry>(),
      visiting = new Set<string>();
    let bytes = 0,
      uploadBytes = 0;
    const checkBudget = (cost: number) => this.checkBudget(this.bytes + bytes + cost);
    const resolve = (resource: ResourceId) =>
      entries.get(resourceKey(resource)) ?? this.resolve(resource);
    const stage = (resource: ResourceId): ResourceEntry => {
      const key = resourceKey(resource),
        previous = entries.get(key) ?? this.entries.get(key);
      if (previous) return previous;
      if (visiting.has(key) || visiting.size >= 64)
        throw new Error('Web rendering resource dependency cycle or depth budget');
      visiting.add(key);
      const source = this.library.resourceSource(resource);
      // Assign the ID after dependencies, so reception can validate monotonic IDs.
      const identity = () => {
        const id = this.sequence + entries.size + 1;
        if (this.byId.size + entries.size >= workerResourceCount || id > 0xffffffff)
          throw new Error('Web rendering resource count or identity budget');
        return { id, generation: resource.generation };
      };
      let data: RenderResource;
      switch (source.kind) {
        case 'image':
          checkBudget(source.byteLength + source.width * source.height * 4);
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
          checkBudget(source.bytes.byteLength * 2);
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
          const bytes = encodeFrame(source.frame, resolve, {
            format: 'web',
            allocate: (size) => {
              checkBudget(size * 2 + source.frame.estimatedBytes);
              return new Uint8Array(size);
            },
          }) as Uint8Array<ArrayBuffer>;
          data = {
            ...identity(),
            kind: 'picture',
            captureBytes: source.frame.estimatedBytes,
            bytes,
          };
          break;
        }
      }
      visiting.delete(key);
      const cost = renderResourceReservation(data);
      checkBudget(cost);
      const entry = {
        id: data.id,
        generation: data.generation,
        kind: data.kind,
        retiring: false,
        cost,
      };
      entries.set(key, entry);
      bytes += cost;
      batch.push(data);
      if ('bytes' in data) {
        transfer.push(data.bytes.buffer);
        uploadBytes += data.bytes.byteLength;
      }
      return entry;
    };
    resources.forEach(stage);
    return { resources: batch, transfer, entries, bytes, uploadBytes, resolve };
  }
  commit(batch: RenderRegistration, sequence?: number): void {
    const entries = [];
    for (const [key, entry] of batch.entries) {
      this.entries.set(key, entry);
      this.byId.set(entry.id, entry);
      entries.push(entry);
    }
    this.sequence += entries.length;
    this.bytes += batch.bytes;
    this.pending = { sequence, entries, bytes: batch.bytes };
  }
  readonly resolve = (resource: ResourceId): ResourceEntry => {
    const entry = this.entries.get(resourceKey(resource));
    if (!entry) throw new Error('Web rendering resource has not been registered');
    return entry;
  };
  registered(message: Extract<RenderReply, { kind: 'registered' }>): void {
    const batch = this.pending;
    if (
      !batch ||
      message.sequence !== batch.sequence ||
      message.resources.length !== batch.entries.length
    )
      throw new Error('Unexpected Web render registration acknowledgement');
    let bytes = this.bytes - batch.bytes;
    for (const [index, receipt] of message.resources.entries()) {
      const entry = batch.entries[index]!;
      if (
        receipt.id !== entry.id ||
        receipt.generation !== entry.generation ||
        !Number.isSafeInteger(receipt.cost) ||
        receipt.cost < 0 ||
        (entry.kind === 'picture'
          ? !Number.isSafeInteger(receipt.nativeBytes) ||
            receipt.nativeBytes! < 0 ||
            receipt.nativeBytes! > receipt.cost
          : receipt.nativeBytes !== undefined || receipt.cost !== entry.cost)
      )
        throw new Error('Invalid Web render resource cost acknowledgement');
      bytes += receipt.cost;
    }
    this.checkBudget(bytes);
    if (bytes !== message.bytes) throw new Error('Web render resource budget is out of sync');
    batch.entries.forEach((entry, index) => {
      entry.cost = message.resources[index]!.cost;
    });
    this.bytes = bytes;
    this.pending = undefined;
  }
  retire(key: string): void {
    const entry = this.entries.get(key);
    if (!entry) return;
    this.entries.delete(key);
    entry.retiring = true;
    this.release({ id: entry.id, generation: entry.generation });
  }
  released({
    resource: { id, generation },
    bytes,
  }: Extract<RenderReply, { kind: 'released' }>): void {
    const entry = this.byId.get(id);
    if (
      !entry?.retiring ||
      entry.generation !== generation ||
      bytes !== this.bytes - entry.cost - (this.pending?.bytes ?? 0)
    )
      throw new Error('Unexpected Web render resource retirement');
    this.byId.delete(id);
    this.bytes -= entry.cost;
  }
  clear(): void {
    this.entries.clear();
    this.byId.clear();
    this.pending = undefined;
    this.bytes = 0;
  }
  private checkBudget(bytes: number): void {
    if (!Number.isSafeInteger(bytes) || bytes < 0 || bytes > workerResourceBytes)
      throw new Error('Web rendering resource byte budget');
  }
}
