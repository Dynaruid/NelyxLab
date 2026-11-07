// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2013 The Flutter Authors. All rights reserved.
// Adapted from the pinned dart:ui painting.dart ImmutableBuffer contract.
import { FlutterError } from '../foundation/flutter-error.ts';
import {
  currentImmutableBufferLoader,
  registerImmutableBuffer,
  registerImmutableBufferFactory,
  retireImmutableBuffer,
} from './immutable-buffer-binding.ts';
import type { ImmutableBufferValue } from './immutable-buffer-binding.ts';
const creation = {};

/** Engine-owned immutable bytes. Dispose releases this handle; engine holders
 * can retain the underlying allocation until their own work has retired. */
export class ImmutableBuffer {
  readonly #value: ImmutableBufferValue;
  #disposed = false;
  #disposing = false;
  private constructor(key: object, value: ImmutableBufferValue) {
    if (key !== creation)
      throw new FlutterError('ImmutableBuffer must be created by its engine factory');
    this.#value = value;
    registerImmutableBuffer(this, value);
  }
  static {
    registerImmutableBufferFactory(
      ImmutableBuffer,
      (value) => new ImmutableBuffer(creation, value),
    );
  }
  static fromUint8List(list: Uint8Array): Promise<ImmutableBuffer> {
    try {
      // The engine captures the selected view synchronously, before returning
      // the Promise. Caller mutation while awaiting cannot change the buffer.
      return Promise.resolve(
        new ImmutableBuffer(creation, currentImmutableBufferLoader().create(list)),
      );
    } catch (error) {
      return Promise.reject(error);
    }
  }
  static async fromAsset(assetKey: string): Promise<ImmutableBuffer> {
    const owner = currentImmutableBufferLoader();
    return new ImmutableBuffer(creation, await owner.loadAsset(assetKey));
  }
  static async fromFilePath(path: string): Promise<ImmutableBuffer> {
    const owner = currentImmutableBufferLoader();
    return new ImmutableBuffer(creation, await owner.loadFile(path));
  }
  get length(): number {
    return this.#value.length;
  }
  get debugDisposed(): boolean {
    return this.#disposed;
  }
  dispose(): void {
    if (this.#disposed || this.#disposing)
      throw new FlutterError('ImmutableBuffer cannot be disposed more than once or reentrantly');
    this.#disposing = true;
    try {
      this.#value.dispose();
      this.#disposed = true;
      retireImmutableBuffer(this);
    } finally {
      this.#disposing = false;
    }
  }
}
