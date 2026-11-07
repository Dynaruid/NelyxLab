// SPDX-License-Identifier: BSD-3-Clause
import { protocol as p } from './schema.ts';
import type { EngineResponse, NodeHandle } from './codec.ts';

export type FontTransitionOwner = keyof typeof p.fontTransitionOwners;
export interface FontTransitionState {
  readonly token: bigint;
  readonly resource: NodeHandle | null;
  readonly phase: keyof typeof p.fontTransitionPhases;
  readonly ready: number;
  readonly failedOwner: number;
  readonly failedStatus: number;
  readonly fontRevision: bigint;
}
const failures: readonly number[] = [
  p.statuses.invalidValue,
  p.statuses.budgetExceeded,
  p.statuses.closed,
];
export function fontTransitionResourceBytes(resource: NodeHandle | null): Uint8Array {
  const bytes = new Uint8Array(8),
    data = new DataView(bytes.buffer);
  if (resource) {
    if (
      !Number.isInteger(resource.slot) ||
      resource.slot <= 0 ||
      resource.slot > p.limits.resources ||
      !Number.isInteger(resource.generation) ||
      resource.generation <= 0 ||
      resource.generation > 0xffffffff
    )
      throw Error('Invalid font transition resource');
    data.setUint32(0, resource.slot, true);
    data.setUint32(4, resource.generation, true);
  }
  return bytes;
}
export function fontTransitionReadyBytes(owner: FontTransitionOwner, failure = 0): Uint8Array {
  if (
    !Object.hasOwn(p.fontTransitionOwners, owner) ||
    (failure !== 0 && !failures.includes(failure))
  )
    throw Error('Invalid font preparation owner/status');
  const bytes = new Uint8Array(8),
    data = new DataView(bytes.buffer);
  data.setUint32(0, p.fontTransitionOwners[owner], true);
  data.setUint32(4, failure, true);
  return bytes;
}
export function fontTransitionCommitBytes(revision: bigint, afterInput: bigint): Uint8Array {
  if (
    typeof revision !== 'bigint' ||
    revision < 2n ||
    revision > BigInt(Number.MAX_SAFE_INTEGER) ||
    typeof afterInput !== 'bigint' ||
    afterInput < 0n ||
    afterInput > 0xffffffffffffffffn
  )
    throw Error('Invalid font transition revision/input fence');
  const bytes = new Uint8Array(16),
    data = new DataView(bytes.buffer);
  data.setBigUint64(0, revision, true);
  data.setBigUint64(8, afterInput, true);
  return bytes;
}
export function readFontTransition(blobs: EngineResponse['blobs']): FontTransitionState | null {
  const rows = blobs.filter((blob) => blob.type === p.fontTransitionBlob);
  if (rows.length > 1) throw Error('Duplicate font transition metadata');
  const blob = rows[0];
  if (!blob) return null;
  if (blob.bytes.length !== 32) throw Error('Invalid font transition metadata size');
  const data = new DataView(blob.bytes.buffer, blob.bytes.byteOffset, blob.bytes.byteLength),
    token = data.getBigUint64(0, true),
    phase = data.getUint32(8, true),
    ready = data.getUint32(12, true),
    failedOwner = data.getUint32(16, true),
    failedStatus = data.getUint32(20, true),
    fontRevision = data.getBigUint64(24, true),
    resource = blob.handle,
    failed = failedOwner !== 0 || failedStatus !== 0;
  if (
    !token ||
    phase < 1 ||
    phase > 4 ||
    ready > 7 ||
    !Number.isInteger(resource.slot) ||
    resource.slot < 0 ||
    resource.slot > p.limits.resources ||
    !Number.isInteger(resource.generation) ||
    resource.generation < 0 ||
    resource.generation > 0xffffffff ||
    !resource.slot !== !resource.generation ||
    (failed && (![1, 2, 4].includes(failedOwner) || !failures.includes(failedStatus))) ||
    (phase === p.fontTransitionPhases.preparing && (failed || fontRevision)) ||
    (phase === p.fontTransitionPhases.committed &&
      (failed ||
        ready !== 7 ||
        fontRevision < 2n ||
        fontRevision > BigInt(Number.MAX_SAFE_INTEGER))) ||
    (phase === p.fontTransitionPhases.failed && (!failed || fontRevision)) ||
    (phase === p.fontTransitionPhases.aborted && fontRevision)
  )
    throw Error('Invalid font transition metadata');
  return Object.freeze({
    token,
    resource: resource.slot ? Object.freeze({ ...resource }) : null,
    phase: ['preparing', 'committed', 'aborted', 'failed'][
      phase - 1
    ] as FontTransitionState['phase'],
    ready,
    failedOwner,
    failedStatus,
    fontRevision,
  });
}
