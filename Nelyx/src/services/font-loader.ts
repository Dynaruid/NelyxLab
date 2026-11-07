// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Adapted from services/font_loader.dart at flutter-coverage.json's source pin.
// ByteData uses the existing AssetBundle-owned Uint8Array adaptation.
import { FlutterError } from '../foundation/flutter-error.ts';
import type { FontLoaderBackend } from '../ui/font-loader-binding.ts';
import { currentFontLoader } from '../ui/font-loader-binding.ts';
export type { FontLoaderBackend } from '../ui/font-loader-binding.ts';
export { bindFontLoader } from '../ui/font-loader-binding.ts';
function alreadyLoaded(): never {
  const error = new Error('FontLoader is already loaded');
  error.name = 'StateError';
  throw error;
}
/** A one-shot family builder. Futures and the protected hook run in add order. */
export class FontLoader {
  private loaded = false;
  private fontFutures: Promise<Uint8Array>[] = [];
  private backend: FontLoaderBackend | null | undefined;
  constructor(readonly family: string) {}
  addFont(bytes: Promise<Uint8Array>): void {
    if (this.loaded) alreadyLoaded();
    const converted = bytes.then((data) => {
      if (!(data instanceof Uint8Array)) throw new TypeError('Font ByteData requires Uint8Array');
      return new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
    });
    // Preserve the rejection for load(), including futures not reached after
    // an earlier failure; JS must not report an unrelated unhandled rejection.
    void converted.catch(() => {});
    this.fontFutures.push(converted);
  }
  async load(): Promise<void> {
    if (this.loaded) alreadyLoaded();
    this.loaded = true;
    // A pending asset from an old App cannot switch to a later default owner.
    this.backend = currentFontLoader();
    try {
      for (const font of this.fontFutures) await this.loadFont(await font, this.family);
    } finally {
      this.fontFutures = [];
    }
  }
  protected loadFont(list: Uint8Array, family: string): Promise<void> {
    const backend = this.backend === undefined ? currentFontLoader() : this.backend;
    if (!backend)
      return Promise.reject(new FlutterError('FontLoader requires an initialized App font owner'));
    return backend.loadFont(list, family);
  }
}
