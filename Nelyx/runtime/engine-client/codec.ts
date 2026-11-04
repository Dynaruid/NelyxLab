// SPDX-License-Identifier: BSD-3-Clause
import { protocol as p } from './schema.ts';
import { encodeUtf8 } from './utf8.ts';
export { protocol } from './schema.ts';

export interface NodeHandle {
  readonly slot: number;
  readonly generation: number;
}
export interface PacketOwner {
  readonly session: number;
  readonly app: number;
  readonly view: number;
  readonly generation: number;
}
export type AxisBound =
  | { readonly kind: 'finite'; readonly min: number; readonly max: number }
  | { readonly kind: 'unbounded'; readonly min?: number }
  | { readonly kind: 'expand' };
export interface NodeProperties {
  readonly x?: number;
  readonly y?: number;
  readonly width?: number;
  readonly height?: number;
  readonly opacity?: number;
  readonly minimum?: number;
  readonly maximum?: number;
  readonly extent?: keyof typeof p.extents;
  readonly horizontal?: boolean;
  readonly chaining?: boolean;
}
export function uint32(value: number): number {
  if (!Number.isInteger(value) || value < 0 || value > 0xffff_ffff)
    throw new RangeError('Expected uint32');
  return value;
}
export function uint64(value: bigint): bigint {
  if (typeof value !== 'bigint' || value < 0n || value > 0xffff_ffff_ffff_ffffn)
    throw new RangeError('Expected uint64 BigInt');
  return value;
}
function finite(value: number): number {
  if (!Number.isFinite(value) || Math.abs(value) > 1e12)
    throw new RangeError('Invalid engine scalar');
  return value;
}
export function body(size: number, write: (view: DataView) => void): Uint8Array {
  const bytes = new Uint8Array(size);
  write(new DataView(bytes.buffer));
  return bytes;
}
export function writeHandle(v: DataView, offset: number, h: NodeHandle): void {
  v.setUint32(offset, uint32(h.slot), true);
  v.setUint32(offset + 4, uint32(h.generation), true);
}
function readHandle(v: DataView, offset: number): NodeHandle {
  return Object.freeze({
    slot: v.getUint32(offset, true),
    generation: v.getUint32(offset + 4, true),
  });
}
export function packet(
  opcode: number,
  owner: PacketOwner,
  payload: Uint8Array = new Uint8Array(0),
  id = 0n,
  base = 0n,
  count = 0,
): Uint8Array {
  if (payload.byteLength > p.limits.packetBytes - p.headerBytes)
    throw new RangeError('Engine packet budget exceeded');
  const bytes = body(p.headerBytes + payload.byteLength, (v) => {
    v.setUint32(p.headerFields.magic, p.magic, true);
    v.setUint16(p.headerFields.major, p.abiMajor, true);
    v.setUint16(p.headerFields.minor, p.abiMinor, true);
    v.setUint32(p.headerFields.schema, p.schema, true);
    v.setUint16(p.headerFields.opcode, uint32(opcode), true);
    v.setUint32(p.headerFields.length, v.byteLength, true);
    v.setUint32(p.headerFields.session, uint32(owner.session), true);
    v.setUint32(p.headerFields.app, uint32(owner.app), true);
    v.setUint32(p.headerFields.view, uint32(owner.view), true);
    v.setUint32(p.headerFields.generation, uint32(owner.generation), true);
    v.setBigUint64(p.headerFields.id, uint64(id), true);
    v.setBigUint64(p.headerFields.base, uint64(base), true);
    v.setUint32(p.headerFields.count, uint32(count), true);
  });
  bytes.set(payload, p.headerBytes);
  return bytes;
}
function command(
  op: number,
  node: NodeHandle,
  payload: Uint8Array = new Uint8Array(0),
): Uint8Array {
  if (payload.length % 8 !== 0) throw new RangeError('Unaligned engine command');
  const bytes = body(16 + payload.length, (v) => {
    v.setUint16(0, op, true);
    v.setUint32(4, v.byteLength, true);
    writeHandle(v, 8, node);
  });
  bytes.set(payload, 16);
  return bytes;
}
function axis(v: DataView, offset: number, bound: AxisBound): void {
  v.setUint32(offset, p.bounds[bound.kind], true);
  const minimum = bound.kind === 'expand' ? 0 : (bound.min ?? 0);
  const maximum = bound.kind === 'finite' ? bound.max : 0;
  if (minimum < 0 || maximum < 0 || (bound.kind === 'finite' && minimum > maximum))
    throw new RangeError('Invalid engine constraints');
  v.setFloat64(offset + 8, finite(minimum), true);
  v.setFloat64(offset + 16, finite(maximum), true);
}
export const commands = {
  paint(node: NodeHandle, color: number, radius = 0): Uint8Array {
    return command(
      p.commands.paint,
      node,
      body(16, (v) => {
        v.setUint32(0, uint32(color), true);
        v.setFloat64(8, finite(radius), true);
      }),
    );
  },
  text(node: NodeHandle, text: string, fontSize = 18, color = 0xff172033): Uint8Array {
    const bytes = encodeUtf8(text, p.limits.textBytes);
    const data = body(24 + Math.ceil(bytes.length / 8) * 8, (v) => {
      v.setUint32(0, uint32(color), true);
      v.setFloat64(8, finite(fontSize), true);
      v.setUint32(16, bytes.length, true);
    });
    data.set(bytes, 24);
    return command(p.commands.text, node, data);
  },
  create(node: NodeHandle, kind: keyof typeof p.kinds): Uint8Array {
    return command(
      p.commands.create,
      node,
      body(8, (v) => v.setUint32(0, p.kinds[kind], true)),
    );
  },
  properties(node: NodeHandle, value: NodeProperties): Uint8Array {
    const values = [
      value.x ?? 0,
      value.y ?? 0,
      value.width ?? 0,
      value.height ?? 0,
      value.opacity ?? 1,
      value.minimum ?? 0,
      value.maximum ?? 0,
    ];
    return command(
      p.commands.properties,
      node,
      body(64, (v) => {
        values.forEach((scalar, i) => v.setFloat64(i * 8, finite(scalar), true));
        v.setUint32(56, p.extents[value.extent ?? 'finite'], true);
        v.setUint32(60, (value.horizontal ? 1 : 0) | (value.chaining ? 2 : 0), true);
      }),
    );
  },
  attach(node: NodeHandle, parent: NodeHandle, index = 0): Uint8Array {
    return command(
      p.commands.attach,
      node,
      body(16, (v) => {
        writeHandle(v, 0, parent);
        v.setUint32(8, uint32(index), true);
      }),
    );
  },
  move(node: NodeHandle, parent: NodeHandle, index = 0): Uint8Array {
    const bytes = this.attach(node, parent, index);
    new DataView(bytes.buffer).setUint16(0, p.commands.move, true);
    return bytes;
  },
  detach(node: NodeHandle): Uint8Array {
    return command(p.commands.detach, node);
  },
  destroy(node: NodeHandle): Uint8Array {
    return command(p.commands.destroy, node);
  },
  acquireResource(resource: NodeHandle, bytes: Uint8Array): Uint8Array {
    if (bytes.length > p.limits.packetBytes - 88)
      throw new RangeError('Engine resource packet budget exceeded');
    const payload = body(8 + Math.ceil(bytes.length / 8) * 8, (v) =>
      v.setUint32(0, bytes.length, true),
    );
    payload.set(bytes, 8);
    return command(p.commands.acquireResource, resource, payload);
  },
  releaseResource(resource: NodeHandle): Uint8Array {
    return command(p.commands.releaseResource, resource);
  },
  bindResource(node: NodeHandle, resource: NodeHandle | null): Uint8Array {
    return command(
      p.commands.bindResource,
      node,
      body(8, (v) => writeHandle(v, 0, resource ?? { slot: 0, generation: 0 })),
    );
  },
  eventPolicy(node: NodeHandle, flags: number): Uint8Array {
    return command(
      p.commands.eventPolicy,
      node,
      body(8, (v) => v.setUint32(0, uint32(flags), true)),
    );
  },
  motion(
    node: NodeHandle,
    id: bigint,
    baseRevision: bigint,
    opacity: number,
    seconds: number,
  ): Uint8Array {
    return command(
      p.commands.motion,
      node,
      body(32, (v) => {
        v.setBigUint64(0, uint64(id), true);
        v.setBigUint64(8, uint64(baseRevision), true);
        v.setFloat64(16, finite(opacity), true);
        v.setFloat64(24, finite(seconds), true);
      }),
    );
  },
  constraints(node: NodeHandle, horizontal: AxisBound, vertical: AxisBound): Uint8Array {
    return command(
      p.commands.constraints,
      node,
      body(48, (v) => {
        axis(v, 0, horizontal);
        axis(v, 24, vertical);
      }),
    );
  },
};
export function transaction(
  owner: PacketOwner,
  id: bigint,
  base: bigint,
  changes: readonly Uint8Array[],
): Uint8Array {
  if (changes.length > p.limits.commands)
    throw new RangeError('Engine command count budget exceeded');
  const length = changes.reduce((sum, bytes) => sum + bytes.length, 0);
  if (length > p.limits.packetBytes - p.headerBytes)
    throw new RangeError('Engine transaction budget exceeded');
  const payload = new Uint8Array(length);
  let offset = 0;
  for (const bytes of changes) {
    payload.set(bytes, offset);
    offset += bytes.length;
  }
  return packet(p.opcodes.transaction, owner, payload, id, base, changes.length);
}
export interface InputPacket {
  readonly sequence: bigint;
  readonly metrics: bigint;
  readonly target: NodeHandle;
  readonly stream: number;
  readonly phase: keyof typeof p.phases;
  readonly source: keyof typeof p.sources;
  /** Engine monotonic seconds, after host clock conversion. */
  readonly time: number;
  /** Original sample clock value; never subtracted from engine time. */
  readonly sample?: number;
  readonly x?: number;
  readonly y?: number;
  readonly dx?: number;
  readonly dy?: number;
  readonly velocity?: number;
  readonly clock?: number;
  readonly buttons?: number;
  readonly modifiers?: number;
  readonly device?: number;
  readonly contact?: number;
}
export function inputBody(value: InputPacket): Uint8Array {
  return body(p.inputBytes, (v) => {
    v.setBigUint64(0, uint64(value.sequence), true);
    v.setBigUint64(8, uint64(value.metrics), true);
    writeHandle(v, 16, value.target);
    v.setUint32(24, uint32(value.stream), true);
    v.setUint32(28, p.phases[value.phase], true);
    v.setUint32(32, p.sources[value.source], true);
    v.setUint32(36, value.sample === undefined ? 0 : 1, true);
    [
      value.time,
      value.sample ?? 0,
      value.x ?? 0,
      value.y ?? 0,
      value.dx ?? 0,
      value.dy ?? 0,
      value.velocity ?? 0,
    ].forEach((scalar, i) => v.setFloat64(40 + i * 8, finite(scalar), true));
    [
      value.clock ?? 1,
      value.buttons ?? 0,
      value.modifiers ?? 0,
      value.device ?? 0,
      value.contact ?? 0,
    ].forEach((scalar, i) => v.setUint32(96 + i * 4, uint32(scalar), true));
  });
}
export interface EngineNodeSnapshot {
  readonly node: NodeHandle;
  readonly kind: number;
  readonly parent: NodeHandle;
  readonly flags: number;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly offset: number;
  readonly velocity: number;
  readonly scrollRevision: bigint;
  readonly opacity: number;
  readonly motion: bigint;
  readonly color: number;
  readonly order: number;
  readonly radius: number;
  readonly fontSize: number;
  readonly resource: NodeHandle;
  readonly clip: {
    readonly x: number;
    readonly y: number;
    readonly width: number;
    readonly height: number;
  };
}
export interface EngineBlob {
  readonly type: number;
  readonly handle: NodeHandle;
  readonly bytes: Uint8Array;
}
export interface EngineEvent {
  readonly kind: number;
  readonly status: number;
  readonly id: bigint;
  readonly epoch: bigint;
  readonly detail: bigint;
  readonly node: NodeHandle;
}
export interface EngineResponse {
  readonly status: number;
  readonly opcode: number;
  readonly owner: PacketOwner;
  readonly id: bigint;
  readonly resultEpoch: bigint;
  readonly document: bigint;
  readonly activeDocument: bigint;
  readonly scene: bigint;
  readonly preparation: bigint;
  readonly metrics: bigint;
  readonly property: bigint;
  readonly consumedThrough: bigint;
  readonly received: bigint;
  readonly consumed: bigint;
  readonly canceled: bigint;
  readonly rejected: bigint;
  readonly duplicates: bigint;
  readonly queued: number;
  readonly holds: number;
  readonly pendingDocument: bigint;
  readonly reservedBytes: bigint;
  readonly resourceBytes: bigint;
  readonly nodeBlocks: bigint;
  readonly submission: bigint;
  readonly publication: bigint;
  readonly surfaceCommit: bigint | null;
  readonly submitted: bigint;
  readonly ticks: bigint;
  readonly activated: bigint;
  readonly device: bigint;
  readonly nodeCount: number;
  readonly closed: boolean;
  readonly visible: boolean;
  readonly focused: boolean;
  readonly wake: boolean;
  readonly preparationReady: boolean;
  readonly sharedMemory: boolean;
  readonly contentIndependent: boolean;
  readonly capabilities: number;
  readonly pendingPublication: bigint;
  readonly lastInput: bigint;
  readonly lastTransaction: bigint;
  readonly acknowledged: bigint;
  readonly activePreparation: bigint;
  readonly failedDocument: bigint;
  readonly sessionQueued: number;
  readonly sessionUpdates: number;
  /** Engine monotonic seconds; null means no command timer is needed. */
  readonly nextDeadline: number | null;
  readonly providerPending: boolean;
  readonly transactionWork: bigint;
  readonly contentWork: bigint;
  readonly contentOwner: bigint;
  readonly renderOwner: bigint;
  readonly renderWake: boolean;
  readonly preparationDocument: bigint;
  readonly blobs: readonly EngineBlob[];
  readonly nodes: readonly EngineNodeSnapshot[];
  readonly events: readonly EngineEvent[];
}
export function response(bytes: Uint8Array): EngineResponse {
  if (bytes.length < p.headerBytes + p.stateBytes || bytes.length > p.limits.packetBytes)
    throw new Error('Malformed engine response length');
  const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (
    v.getUint32(p.headerFields.magic, true) !== p.magic ||
    v.getUint16(p.headerFields.major, true) !== p.abiMajor ||
    v.getUint32(p.headerFields.schema, true) !== p.schema ||
    v.getUint32(p.headerFields.length, true) !== bytes.length ||
    !(v.getUint16(p.headerFields.opcode, true) & 0x8000)
  )
    throw new Error('Incompatible engine response');
  const b = p.headerBytes,
    rows = v.getUint32(p.headerFields.count, true),
    eventCount = v.getUint32(b + p.stateFields.eventCount, true),
    blobCount = v.getUint32(b + p.stateFields.blobCount, true),
    blobBytes = v.getUint32(b + p.stateFields.blobBytes, true);
  if (
    rows > p.limits.nodes ||
    eventCount > p.limits.eventsPerPoll ||
    blobCount > p.limits.nodes + p.limits.resources ||
    p.headerBytes + p.stateBytes + rows * p.nodeBytes + eventCount * p.eventBytes + blobBytes !==
      bytes.length
  )
    throw new Error('Malformed engine response tables');
  const u64 = (offset: number) => v.getBigUint64(b + offset, true);
  const u32 = (offset: number) => v.getUint32(b + offset, true);
  const nodes: EngineNodeSnapshot[] = [],
    events: EngineEvent[] = [];
  let cursor = p.headerBytes + p.stateBytes;
  for (let i = 0; i < rows; ++i, cursor += p.nodeBytes) {
    const f = (offset: number) => finite(v.getFloat64(cursor + offset, true));
    nodes.push(
      Object.freeze({
        node: readHandle(v, cursor),
        kind: v.getUint32(cursor + 8, true),
        parent: readHandle(v, cursor + 12),
        flags: v.getUint32(cursor + 20, true),
        x: f(24),
        y: f(32),
        width: f(40),
        height: f(48),
        offset: f(56),
        velocity: f(64),
        scrollRevision: v.getBigUint64(cursor + 72, true),
        opacity: f(80),
        motion: v.getBigUint64(cursor + 88, true),
        color: v.getUint32(cursor + p.nodeFields.color, true),
        order: v.getUint32(cursor + p.nodeFields.order, true),
        radius: f(p.nodeFields.radius),
        fontSize: f(p.nodeFields.fontSize),
        resource: readHandle(v, cursor + p.nodeFields.resource),
        clip: Object.freeze({
          x: f(p.nodeFields.clipX),
          y: f(p.nodeFields.clipY),
          width: f(p.nodeFields.clipWidth),
          height: f(p.nodeFields.clipHeight),
        }),
      }),
    );
  }
  for (let i = 0; i < eventCount; ++i, cursor += p.eventBytes)
    events.push(
      Object.freeze({
        kind: v.getUint32(cursor, true),
        status: v.getUint32(cursor + 4, true),
        id: v.getBigUint64(cursor + 8, true),
        epoch: v.getBigUint64(cursor + 16, true),
        detail: v.getBigUint64(cursor + 24, true),
        node: readHandle(v, cursor + 32),
      }),
    );
  const blobs: EngineBlob[] = [];
  for (let i = 0; i < blobCount; ++i) {
    if (cursor + 24 > bytes.length) throw new Error('Truncated engine blob');
    const type = v.getUint32(cursor, true),
      length = v.getUint32(cursor + 16, true);
    const stride = 24 + Math.ceil(length / 8) * 8;
    if (
      ![1, 2].includes(type) ||
      stride > bytes.length - cursor ||
      v.getUint32(cursor + 4, true) ||
      v.getUint32(cursor + 20, true)
    )
      throw new Error('Invalid engine blob');
    blobs.push(
      Object.freeze({
        type,
        handle: readHandle(v, cursor + 8),
        bytes: bytes.slice(cursor + 24, cursor + 24 + length),
      }),
    );
    cursor += stride;
  }
  if (cursor !== bytes.length) throw new Error('Engine blob table length mismatch');
  const flags = u32(p.stateFields.flags),
    commit = u64(p.stateFields.surfaceCommit);
  return Object.freeze({
    status: v.getUint16(p.headerFields.status, true),
    opcode: v.getUint16(p.headerFields.opcode, true) & 0x7fff,
    owner: Object.freeze({
      session: v.getUint32(p.headerFields.session, true),
      app: v.getUint32(p.headerFields.app, true),
      view: v.getUint32(p.headerFields.view, true),
      generation: v.getUint32(p.headerFields.generation, true),
    }),
    id: v.getBigUint64(p.headerFields.id, true),
    resultEpoch: v.getBigUint64(p.headerFields.base, true),
    document: u64(p.stateFields.document),
    activeDocument: u64(p.stateFields.activeDocument),
    scene: u64(p.stateFields.scene),
    preparation: u64(p.stateFields.preparation),
    metrics: u64(p.stateFields.metrics),
    property: u64(p.stateFields.property),
    consumedThrough: u64(p.stateFields.consumedThrough),
    received: u64(p.stateFields.received),
    consumed: u64(p.stateFields.consumed),
    canceled: u64(p.stateFields.canceled),
    rejected: u64(p.stateFields.rejected),
    duplicates: u64(p.stateFields.duplicates),
    queued: u32(p.stateFields.queued),
    holds: u32(p.stateFields.holds),
    pendingDocument: u64(p.stateFields.pendingDocument),
    reservedBytes: u64(p.stateFields.reservedBytes),
    resourceBytes: u64(p.stateFields.resourceBytes),
    nodeBlocks: u64(p.stateFields.nodeBlocks),
    submission: u64(p.stateFields.submission),
    publication: u64(p.stateFields.publication),
    surfaceCommit: commit === 0n ? null : commit,
    submitted: u64(p.stateFields.submitted),
    ticks: u64(p.stateFields.ticks),
    activated: u64(p.stateFields.activated),
    device: u64(p.stateFields.device),
    nodeCount: u32(p.stateFields.nodeCount),
    closed: !!(flags & 1),
    visible: !!(flags & 2),
    focused: !!(flags & 4),
    wake: !!(flags & 8),
    preparationReady: !!(flags & 16),
    sharedMemory: !!(flags & 32),
    contentIndependent: !!(flags & 64),
    capabilities: u32(p.stateFields.capabilities),
    pendingPublication: u64(p.stateFields.pendingPublication),
    lastInput: u64(p.stateFields.lastInput),
    lastTransaction: u64(p.stateFields.lastTransaction),
    acknowledged: u64(p.stateFields.acknowledged),
    activePreparation: u64(p.stateFields.activePreparation),
    failedDocument: u64(p.stateFields.failedDocument),
    sessionQueued: u32(p.stateFields.sessionQueued),
    sessionUpdates: u32(p.stateFields.sessionUpdates),
    nextDeadline: v.getFloat64(b + p.stateFields.nextDeadline, true) || null,
    providerPending: !!u32(p.stateFields.providerPending),
    transactionWork: u64(p.stateFields.transactionWork),
    contentWork: u64(p.stateFields.contentWork),
    contentOwner: u64(p.stateFields.contentOwner),
    renderOwner: u64(p.stateFields.renderOwner),
    preparationDocument: u64(p.stateFields.preparationDocument),
    renderWake: !!(flags & 128),
    blobs: Object.freeze(blobs),
    nodes: Object.freeze(nodes),
    events: Object.freeze(events),
  });
}
