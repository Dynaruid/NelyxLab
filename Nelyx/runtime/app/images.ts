// SPDX-License-Identifier: BSD-3-Clause
import type { Image } from '@nelyx/core/ui/image';
import type { ResourceRegistry } from '@nelyx/core/hosting/resources';
import type { ImageService } from '@nelyx/core/hosting/images';
import type { ImageResource } from '../engine-client/scene.ts';
import type { Disposable } from '@nelyx/core/foundation/disposable';
import type { AppImageClockSnapshot } from '../engine-client/app-image-clock.ts';
export interface OriginalImageClock {
  readonly execution?: AppImageClockSnapshot;
  now(): number;
  requestFrame(callback: () => void): Disposable;
  scheduleTimer(callback: () => void, milliseconds: number): Disposable;
}
export interface OriginalImageSceneLease {
  readonly key: string;
  readonly resource: ImageResource;
  release(): void;
}
/** App-owned bridge. Only immutable RGBA bytes enter Content; decoder handles
 * and native/Wasm image objects remain on their original owner. */
export interface OriginalImageSource {
  readonly resources: ResourceRegistry;
  readonly service: ImageService;
  bindClock(clock: OriginalImageClock): Disposable;
  capture(image: Image): OriginalImageSceneLease;
}
