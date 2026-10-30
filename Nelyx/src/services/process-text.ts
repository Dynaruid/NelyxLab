// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Reviewed services/process_text.dart at the pinned Flutter revision.
import { FoundationBuildMode } from '../foundation/constants.ts';
import { protect } from '../ui/value-math.ts';
import { hashValues } from '../framework/painting/value-equality.ts';
import { SystemChannels, SystemChannelSet } from './system-channels.ts';
import type { BinaryMessenger } from './binary-messenger.ts';
import type { MethodChannel } from './platform-channel.ts';
export class ProcessTextAction {
  constructor(
    readonly id: string,
    readonly label: string,
  ) {
    protect(this, ['id', 'label']);
  }
  equals(other: unknown): boolean {
    return (
      this === other ||
      (other instanceof ProcessTextAction && other.id === this.id && other.label === this.label)
    );
  }
  get hashCode(): number {
    return hashValues(this.id, this.label);
  }
}
export abstract class ProcessTextService {
  abstract queryTextActions(): Promise<ProcessTextAction[]>;
  abstract processTextAction(id: string, text: string, readOnly: boolean): Promise<string | null>;
}
export class DefaultProcessTextService extends ProcessTextService {
  private channel: MethodChannel;
  constructor(messenger?: BinaryMessenger) {
    super();
    this.channel = messenger
      ? new SystemChannelSet(messenger).processText
      : SystemChannels.processText;
  }
  setChannel(channel: MethodChannel): void {
    if (FoundationBuildMode.debug) this.channel = channel;
  }
  async queryTextActions(): Promise<ProcessTextAction[]> {
    let raw: Map<unknown, unknown>;
    try {
      const result = await this.channel.invokeMethod('ProcessText.queryTextActions');
      if (result === null) return [];
      if (!(result instanceof Map)) throw new TypeError('ProcessText actions must be a map');
      raw = result;
    } catch {
      return [];
    }
    return [...raw.keys()].map((id) => {
      const label = raw.get(id);
      if (typeof id !== 'string' || typeof label !== 'string')
        throw new TypeError('ProcessText action id and label must be strings');
      return new ProcessTextAction(id, label);
    });
  }
  async processTextAction(id: string, text: string, readOnly: boolean): Promise<string | null> {
    const result = await this.channel.invokeMethod('ProcessText.processTextAction', [
      id,
      text,
      readOnly,
    ]);
    if (result !== null && typeof result !== 'string')
      throw new TypeError('Processed text must be a string or null');
    return result;
  }
}
