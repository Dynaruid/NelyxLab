// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
import { invariant } from '../foundation/errors.ts';
import type { Image } from './image.ts';
/** Duration is expressed in milliseconds at the JavaScript host boundary. */
export class FrameInfo {
  constructor(
    readonly duration: number,
    readonly image: Image,
  ) {
    invariant(
      Number.isFinite(duration) && duration >= 0,
      'invalid-frame-duration',
      'Image frame duration must be finite and nonnegative',
    );
  }
}
export abstract class Codec {
  abstract get frameCount(): number;
  abstract get repetitionCount(): number;
  abstract getNextFrame(): Promise<FrameInfo>;
  abstract dispose(): void;
}
