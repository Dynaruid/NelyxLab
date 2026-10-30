// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// The pinned conditional Web implementation is intentionally a stand-in.
import type { BinaryMessenger } from './binary-messenger.ts';
import type { RootIsolateToken } from '../ui/root-isolate-token.ts';
class UnsupportedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UnsupportedError';
  }
}
export class BackgroundIsolateBinaryMessenger {
  static get instance(): BinaryMessenger {
    throw new UnsupportedError('Isolates not supported on web.');
  }
  static ensureInitialized(_token: RootIsolateToken): void {
    throw new UnsupportedError('Isolates not supported on web.');
  }
}
