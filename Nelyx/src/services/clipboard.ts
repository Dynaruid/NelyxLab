// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Adapted from the pinned Flutter services/clipboard.dart.
import type { BinaryMessenger } from './binary-messenger.ts';
import { SystemChannels, SystemChannelSet } from './system-channels.ts';
export class ClipboardData {
  constructor(readonly text: string) {
    if (typeof text !== 'string') throw new TypeError('Clipboard text must be a string');
    Object.freeze(this);
  }
}
export class Clipboard {
  static readonly kTextPlain = 'text/plain';
  private static channel(messenger?: BinaryMessenger) {
    return messenger ? new SystemChannelSet(messenger).platform : SystemChannels.platform;
  }
  static async setData(data: ClipboardData, messenger?: BinaryMessenger): Promise<void> {
    await this.channel(messenger).invokeMethod('Clipboard.setData', new Map([['text', data.text]]));
  }
  static async getData(format: string, messenger?: BinaryMessenger): Promise<ClipboardData | null> {
    const result = await this.channel(messenger).invokeMethod('Clipboard.getData', format);
    if (result === null) return null;
    if (!(result instanceof Map) || typeof result.get('text') !== 'string')
      throw new TypeError('Invalid clipboard text response');
    return new ClipboardData(result.get('text'));
  }
  static async hasStrings(messenger?: BinaryMessenger): Promise<boolean> {
    const result = await this.channel(messenger).invokeMethod(
      'Clipboard.hasStrings',
      this.kTextPlain,
    );
    if (result === null) return false;
    if (!(result instanceof Map) || typeof result.get('value') !== 'boolean')
      throw new TypeError('Invalid clipboard availability response');
    return result.get('value');
  }
}
