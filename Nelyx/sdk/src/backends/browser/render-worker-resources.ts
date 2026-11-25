// SPDX-License-Identifier: BSD-3-Clause
import { disposeFrame } from '@nelyx/core/ui/frame';
import type { NativeFrameResource } from '@nelyx/core/ui/frame-wire';
import { decodeWebFrame } from '@nelyx/core/ui/web-frame-wire';
import type { ResourceRegistry } from '@nelyx/core/hosting/resources';
import { RasterizationPendingError } from '@nelyx/core/hosting/rasterization';
import { imageLimits } from '@nelyx/core/hosting/images';
import { Picture } from '@nelyx/core/ui/picture';
import type { ResourceDescriptor, ResourceId } from '@nelyx/core/ui/types';
import type { WebSkiaLibrary } from '@nelyx/skia-web/library';
import {
  mapParagraphResources,
  renderResourceReservation,
  wireResourceId,
  workerResourceBytes,
  workerResourceCount,
} from './render-protocol.ts';
import type { RegisteredRenderResource, RenderResource } from './render-protocol.ts';

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
  registerBatch(batch: readonly RenderResource[]): RegisteredRenderResource[] {
    if (
      !Array.isArray(batch) ||
      !batch.length ||
      this.entries.size + batch.length > workerResourceCount
    )
      throw new Error('Invalid Web render resource batch size');
    const reservations = batch.map((data: RenderResource) => {
      const cost = renderResourceReservation(data);
      this.checkBudget(cost);
      return cost;
    });
    let pending = reservations.reduce((total, cost) => total + cost, 0);
    this.checkBudget(pending);
    let pictureWireBytes = 0;
    return batch.map((data, index) => {
      const reservation = reservations[index]!;
      pending -= reservation;
      // The received message still owns these buffers while the batch is processed.
      if (data.kind === 'picture') pictureWireBytes += data.bytes.byteLength;
      return this.register(data, reservation, pending + pictureWireBytes);
    });
  }
  private checkBudget(cost: number): void {
    if (!Number.isSafeInteger(cost) || cost < 0 || this.bytes + cost > workerResourceBytes)
      throw new Error('Web renderer resource byte budget');
  }
  private register(
    data: RenderResource,
    reservation: number,
    pendingBytes: number,
  ): RegisteredRenderResource {
    if (
      !Number.isSafeInteger(data.id) ||
      data.id !== this.sequence + 1 ||
      data.id > 0xffffffff ||
      !Number.isSafeInteger(data.generation) ||
      data.generation < 1 ||
      this.entries.size >= workerResourceCount
    )
      throw new Error('Invalid Web render resource identity or count');
    let cost = reservation;
    let nativeBytes: number | undefined;
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
        case 'picture': {
          const picture = this.picture(descriptor, data, pendingBytes);
          ({ retire, nativeBytes, cost } = picture);
          break;
        }
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
    return {
      id: data.id,
      generation: data.generation,
      cost,
      ...(nativeBytes === undefined ? {} : { nativeBytes }),
    };
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
    pendingBytes: number,
  ): { retire(): void; cost: number; nativeBytes: number } {
    if (
      !(data.bytes instanceof Uint8Array) ||
      !Number.isSafeInteger(data.captureBytes) ||
      data.captureBytes < 0
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
    let retire: (() => void) | undefined;
    try {
      const captureBytes = capture.frame.estimatedBytes;
      this.checkBudget(captureBytes + pendingBytes);
      lease = this.registry.acquire(capture.frame.resources);
      const native = this.library.framePictureBackend.compile(capture, descriptor);
      retire = () => {
        native.retire();
        try {
          lease!.returnBy('caller');
        } finally {
          capture.dispose();
        }
      };
      const cost = captureBytes + native.bytes;
      this.checkBudget(cost + pendingBytes);
      return { retire, nativeBytes: native.bytes, cost };
    } catch (error) {
      if (retire) {
        retire();
      } else if (!(error instanceof RasterizationPendingError)) {
        try {
          lease?.returnBy('caller');
        } finally {
          capture.dispose();
        }
      }
      throw error;
    }
  }
}
