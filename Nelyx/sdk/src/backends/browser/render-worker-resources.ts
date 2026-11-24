// SPDX-License-Identifier: BSD-3-Clause
import { disposeFrame } from '@nelyx/core/ui/frame';
import type { NativeFrameResource } from '@nelyx/core/ui/frame-wire';
import { decodeWebFrame } from '@nelyx/core/ui/web-frame-wire';
import type { ResourceRegistry } from '@nelyx/core/hosting/resources';
import { imageLimits } from '@nelyx/core/hosting/images';
import { Picture } from '@nelyx/core/ui/picture';
import type { ResourceDescriptor, ResourceId } from '@nelyx/core/ui/types';
import type { WebSkiaLibrary } from '@nelyx/skia-web/library';
import {
  mapParagraphResources,
  renderResourceCost,
  wireResourceId,
  workerResourceBytes,
  workerResourceCount,
} from './render-protocol.ts';
import type { RenderResource } from './render-protocol.ts';

interface Entry {
  readonly generation: number;
  readonly resource: ResourceId;
  readonly kind: ResourceDescriptor['kind'];
  readonly cost: number;
}

export class RenderResourceReceiver {
  private readonly entries = new Map<number, Entry>();
  private sequence = 0;
  private bytes = 0;
  get resourceBytes(): number {
    return this.bytes;
  }

  constructor(
    private readonly library: WebSkiaLibrary,
    private readonly registry: ResourceRegistry,
  ) {}
  readonly resolve = (
    id: number,
    generation: number,
    kind: ResourceDescriptor['kind'],
  ): ResourceId => {
    const entry = this.entries.get(id);
    if (!entry || entry.generation !== generation || entry.kind !== kind)
      throw new Error('Unregistered, stale or mismatched Web render resource');
    return entry.resource;
  };
  register(data: RenderResource): void {
    if (
      !Number.isSafeInteger(data.id) ||
      data.id !== this.sequence + 1 ||
      data.id > 0xffffffff ||
      !Number.isSafeInteger(data.generation) ||
      data.generation < 1 ||
      this.entries.size >= workerResourceCount
    )
      throw new Error('Invalid Web render resource identity or count');
    const cost = renderResourceCost(data);
    if (!Number.isSafeInteger(cost) || cost < 0 || this.bytes + cost > workerResourceBytes)
      throw new Error('Web renderer resource byte budget');
    const descriptor = { ...wireResourceId(data), kind: data.kind };
    let resource: ResourceId = descriptor;
    if (data.kind === 'paragraph') {
      if (!Array.isArray(data.fonts) || data.fonts.length < 1 || data.fonts.length > 64)
        throw new Error('Invalid Web render paragraph font catalog');
      const input = mapParagraphResources(data.input, (ref, kind) => {
        const id = Number(ref.id);
        if (String(id) !== ref.id) throw new Error('Invalid Web render paragraph dependency');
        return this.resolve(id, ref.generation, kind);
      });
      const fonts = data.fonts.map(({ id, generation }) => this.resolve(id, generation, 'font'));
      resource = this.library.layout(input, { transient: true }, fonts).resource;
    } else {
      let retire: () => void;
      switch (data.kind) {
        case 'font':
          if (
            !(data.bytes instanceof Uint8Array) ||
            !data.bytes.length ||
            typeof data.family !== 'string' ||
            !data.family
          )
            throw new Error('Invalid Web render font source');
          retire = this.library.restoreFont(resource, data.family, data.bytes);
          break;
        case 'image':
          if (
            !(data.bytes instanceof Uint8Array) ||
            !data.bytes.length ||
            ![data.width, data.height].every(
              (side) => Number.isSafeInteger(side) && side > 0 && side <= imageLimits.dimension,
            ) ||
            !['encoded', 'rgba8888-premul-srgb'].includes(data.encoding)
          )
            throw new Error('Invalid Web render image source');
          retire = this.library.restoreImage(resource, data);
          break;
        case 'picture':
          retire = this.picture(descriptor, data);
          break;
      }
      try {
        this.registry.register(descriptor, retire);
      } catch (error) {
        retire();
        throw error;
      }
      this.registry.bindResource(descriptor);
    }
    this.sequence = data.id;
    this.entries.set(data.id, { resource, kind: data.kind, generation: data.generation, cost });
    this.bytes += cost;
  }
  release({ id, generation }: NativeFrameResource): void {
    const entry = this.entries.get(id);
    if (!entry || generation !== entry.generation)
      throw new Error('Stale Web render resource release');
    this.registry.releaseProducer(entry.resource);
    this.entries.delete(id);
    this.bytes -= entry.cost;
  }
  private picture(
    descriptor: ResourceDescriptor,
    data: Extract<RenderResource, { kind: 'picture' }>,
  ): () => void {
    if (
      !(data.bytes instanceof Uint8Array) ||
      !Number.isSafeInteger(data.nativeBytes) ||
      data.nativeBytes < 0
    )
      throw new Error('Invalid Web render Picture source');
    const frame = decodeWebFrame(
      data.bytes,
      { id: 'picture-recording', generation: 1 },
      this.resolve,
    );
    let picture: Picture;
    try {
      picture = Picture._fromRecording(frame.commands);
    } finally {
      disposeFrame(frame);
    }
    const capture = picture._capture();
    picture.dispose();
    let lease: ReturnType<ResourceRegistry['acquire']> | undefined;
    try {
      lease = this.registry.acquire(capture.frame.resources);
      const native = this.library.framePictureBackend.compile(capture, descriptor);
      const retire = () => {
        native.retire();
        lease!.returnBy('caller');
        capture.dispose();
      };
      if (native.bytes <= data.nativeBytes) return retire;
      // Allocation differs across renderers even with identical commands.
      native.retire();
      throw new Error('Web render Picture exceeds its source memory budget');
    } catch (error) {
      lease?.returnBy('caller');
      capture.dispose();
      throw error;
    }
  }
}
