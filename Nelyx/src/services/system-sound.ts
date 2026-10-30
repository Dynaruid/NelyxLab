// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Adapted from the pinned Flutter services/system_sound.dart.
import type { BinaryMessenger } from './binary-messenger.ts';
import { SystemChannels, SystemChannelSet } from './system-channels.ts';
export const SystemSoundType = Object.freeze({
  click: 'click',
  tick: 'tick',
  alert: 'alert',
} as const);
export type SystemSoundType = (typeof SystemSoundType)[keyof typeof SystemSoundType];
export class SystemSound {
  private constructor() {}
  /** The optional messenger selects the owning application. */
  static async play(type: SystemSoundType, messenger?: BinaryMessenger): Promise<void> {
    await (
      messenger ? new SystemChannelSet(messenger).platform : SystemChannels.platform
    ).invokeMethod('SystemSound.play', 'SystemSoundType.' + type);
  }
}
