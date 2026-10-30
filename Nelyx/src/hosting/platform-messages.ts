// SPDX-License-Identifier: BSD-3-Clause
import type { Disposable } from '../foundation/disposable.ts';
import type { PlatformMessageResponseCallback } from '../ui/channel-buffers.ts';
export type PlatformMessageReceiver = (
  channel: string,
  data: DataView | null,
  reply: PlatformMessageResponseCallback,
) => void;
/**
 * One SDK application owns one port. attach returns a synchronous ingress gate.
 * send preserves call admission order; reply ends its native byte ownership.
 * dispose stops ingress and drains all native access before resolving, including
 * requests whose plugins never replied. A failed drain must retain native owners.
 */
export interface PlatformMessagePort extends Disposable {
  /** Optional synchronous gate for host callbacks/timers before async drain. */
  stop?(): void;
  attach(receiver: PlatformMessageReceiver): Disposable;
  send(channel: string, data: DataView | null, reply: PlatformMessageResponseCallback): void;
  sendChannelUpdate(channel: string, listening: boolean): void;
}
