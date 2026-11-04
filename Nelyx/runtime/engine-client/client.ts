// SPDX-License-Identifier: BSD-3-Clause
import { body, packet, response, transaction, uint32, uint64 } from './codec.ts';
import type { EngineResponse, PacketOwner } from './codec.ts';
import { protocol as p } from './schema.ts';

export interface EngineTransport {
  /** The port returns standalone bytes, never a live native/Wasm heap view. */
  exchange(bytes: Uint8Array): Promise<Uint8Array>;
  close(): void | Promise<void>;
}
export class EngineError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly result?: EngineResponse,
  ) {
    super(message);
  }
}
export interface EngineIdentity {
  readonly engine: 'v2';
  readonly abiMajor: number;
  readonly schema: number;
}
/** Bundle and host select the same entrypoint before application code is loaded. */
export function resolveEngineV2(bundle: EngineIdentity, host: EngineIdentity): '@nelyx/core/v2' {
  for (const identity of [bundle, host])
    if (
      identity.engine !== 'v2' ||
      identity.abiMajor !== p.abiMajor ||
      identity.schema !== p.schema
    )
      throw new EngineError(p.statuses.incompatible, 'Engine v2 bundle/host identity differs');
  return '@nelyx/core/v2';
}
function checked(
  result: EngineResponse,
  allowed: readonly number[] = [p.statuses.ok],
): EngineResponse {
  if (!allowed.includes(result.status))
    throw new EngineError(result.status, `Engine v2 request failed (${result.status})`, result);
  return result;
}
export class EngineClient {
  readonly owner: PacketOwner;
  private closed = false;
  private pending = 0;
  private pendingBytes = 0;
  private readonly views = new Set<EngineViewClient>();
  private readonly closing = new Set<(error: Error) => void>();
  private constructor(
    private readonly transport: EngineTransport,
    session: number,
    app: number,
    private readonly timeoutMs: number,
  ) {
    this.owner = Object.freeze({
      session: uint32(session),
      app: uint32(app),
      view: 0,
      generation: 0,
    });
  }
  static async connect(
    transport: EngineTransport,
    options: {
      session?: number;
      app?: number;
      requiredCapabilities?: number;
      timeoutMs?: number;
    } = {},
  ): Promise<EngineClient> {
    const timeoutMs = options.timeoutMs ?? 2000;
    if (!Number.isFinite(timeoutMs) || timeoutMs <= 0 || timeoutMs > 1_200_000)
      throw new RangeError('Invalid engine transport timeout');
    const client = new EngineClient(transport, options.session ?? 1, options.app ?? 1, timeoutMs);
    try {
      const required = uint32(options.requiredCapabilities ?? p.capabilities.protocol);
      const result = await client.send(
        packet(
          p.opcodes.hello,
          client.owner,
          body(8, (v) => v.setUint32(0, required, true)),
        ),
      );
      checked(result);
      if ((result.capabilities & required) !== required)
        throw new EngineError(
          p.statuses.capabilityMissing,
          'Required engine v2 capability is absent',
        );
      return client;
    } catch (error) {
      await client.abort();
      throw error;
    }
  }
  async send(bytes: Uint8Array): Promise<EngineResponse> {
    if (this.closed) throw new EngineError(p.statuses.closed, 'Engine client closed');
    if (
      bytes.length > p.limits.packetBytes ||
      this.pending >= p.limits.results ||
      this.pendingBytes + bytes.length > p.limits.packetBytes * 4
    )
      throw new EngineError(p.statuses.budgetExceeded, 'Engine transport queue budget exceeded');
    const owned = bytes.slice();
    const sent = new DataView(owned.buffer);
    const expected = {
      session: sent.getUint32(20, true),
      app: sent.getUint32(24, true),
      view: sent.getUint32(28, true),
      generation: sent.getUint32(32, true),
      id: sent.getBigUint64(40, true),
      opcode: sent.getUint16(12, true),
    };
    const length = owned.length;
    ++this.pending;
    this.pendingBytes += owned.length;
    let cancel: ((error: Error) => void) | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    // Timed-out work continues to count until the port settles. A caller timeout
    // never cancels an accepted transaction or admits an unbounded orphan tail.
    const work = Promise.resolve()
      .then(() => this.transport.exchange(owned))
      .then((received) => {
        const result = response(received);
        if (
          result.owner.session !== expected.session ||
          result.owner.app !== expected.app ||
          result.owner.view !== expected.view ||
          result.owner.generation !== expected.generation ||
          result.id !== expected.id ||
          result.opcode !== expected.opcode
        )
          throw new EngineError(
            p.statuses.staleGeneration,
            'Engine response owner/request differs',
          );
        return result;
      })
      .finally(() => {
        --this.pending;
        this.pendingBytes -= length;
      });
    try {
      return await Promise.race([
        work,
        new Promise<never>((_, reject) => {
          cancel = reject;
          this.closing.add(reject);
          timer = setTimeout(
            () =>
              reject(
                new EngineError(
                  p.statuses.timedOut,
                  'Engine request timed out; query or retry the identical transaction',
                ),
              ),
            this.timeoutMs,
          );
        }),
      ]);
    } finally {
      if (timer !== undefined) clearTimeout(timer);
      if (cancel) this.closing.delete(cancel);
    }
  }
  async openView(view: number, generation = 1): Promise<EngineViewClient> {
    const owner = Object.freeze({
      ...this.owner,
      view: uint32(view),
      generation: uint32(generation),
    });
    checked(await this.send(packet(p.opcodes.openView, owner)));
    const client = new EngineViewClient(this, owner);
    this.views.add(client);
    return client;
  }
  /** @internal Remove closed generations instead of retaining a session history. */
  releaseView(view: EngineViewClient): void {
    this.views.delete(view);
  }
  async close(): Promise<void> {
    if (this.closed) return;
    const result = await this.send(packet(p.opcodes.closeSession, this.owner));
    if (result.status === p.statuses.busy) {
      for (const view of this.views) view.sessionClosed();
      throw new EngineError(
        p.statuses.busy,
        'Engine close awaits provider frame retirement',
        result,
      );
    }
    try {
      checked(result);
    } finally {
      await this.abort();
    }
  }
  /** Forced transport loss. Normal hosts drain their provider before teardown. */
  async abort(): Promise<void> {
    if (this.closed) return;
    this.closed = true;
    const error = new EngineError(p.statuses.closed, 'Engine session closed');
    for (const reject of this.closing) reject(error);
    this.closing.clear();
    for (const view of this.views) view.sessionClosed();
    this.views.clear();
    await this.transport.close();
  }
}
export class EngineViewClient {
  private epoch = 0n;
  private nextId = 0n;
  private inFlight: Uint8Array | undefined;
  private resolving = false;
  private closed = false;
  private readonly waits = new Set<(error: Error) => void>();
  constructor(
    private readonly client: EngineClient,
    readonly owner: PacketOwner,
  ) {}
  get documentEpoch(): bigint {
    return this.epoch;
  }
  get hasPendingTransaction(): boolean {
    return this.inFlight !== undefined;
  }
  private ensureOpen(): void {
    if (this.closed) throw new EngineError(p.statuses.closed, 'Engine view closed');
  }
  async request(
    opcode: number,
    data: Uint8Array = new Uint8Array(0),
    id = 0n,
  ): Promise<EngineResponse> {
    this.ensureOpen();
    const result = await this.client.send(packet(opcode, this.owner, data, id));
    if (result.closed) this.sessionClosed();
    return result;
  }
  async commit(changes: readonly Uint8Array[]): Promise<EngineResponse> {
    this.ensureOpen();
    if (this.inFlight)
      throw new EngineError(p.statuses.busy, 'A view already has a transaction in flight');
    this.nextId = uint64(this.nextId + 1n);
    this.inFlight = transaction(this.owner, this.nextId, this.epoch, changes);
    return this.retryCommit();
  }
  async retryCommit(): Promise<EngineResponse> {
    this.ensureOpen();
    if (!this.inFlight) throw new EngineError(p.statuses.notFound, 'No transaction to retry');
    if (this.resolving)
      throw new EngineError(p.statuses.busy, 'Transaction result is already being resolved');
    this.resolving = true;
    try {
      const result = await this.client.send(this.inFlight);
      this.inFlight = undefined;
      if (result.status === p.statuses.accepted && result.resultEpoch > this.epoch)
        this.epoch = result.resultEpoch;
      if (result.closed) this.sessionClosed();
      return checked(result, [p.statuses.accepted]);
    } finally {
      this.resolving = false;
    }
  }
  async queryCommitResult(): Promise<EngineResponse> {
    this.ensureOpen();
    if (!this.inFlight) throw new EngineError(p.statuses.notFound, 'No transaction result pending');
    if (this.resolving)
      throw new EngineError(p.statuses.busy, 'Transaction result is already being resolved');
    this.resolving = true;
    try {
      const result = await this.request(p.opcodes.queryResult, new Uint8Array(0), this.nextId);
      if (result.status !== p.statuses.notFound) {
        this.inFlight = undefined;
        if (result.status === p.statuses.accepted && result.resultEpoch > this.epoch)
          this.epoch = result.resultEpoch;
      }
      return result;
    } finally {
      this.resolving = false;
    }
  }
  async resynchronize(): Promise<EngineResponse> {
    if (this.inFlight)
      throw new EngineError(
        p.statuses.busy,
        'Resolve the pending transaction before resynchronizing',
      );
    const result = checked(await this.request(p.opcodes.inspect));
    this.epoch = result.document;
    this.nextId = this.nextId > result.lastTransaction ? this.nextId : result.lastTransaction;
    return result;
  }
  async awaitActivated(
    atLeastDocumentEpoch: bigint,
    timeoutMs = p.limits.commandTimeoutMs,
  ): Promise<EngineResponse> {
    this.ensureOpen();
    uint64(atLeastDocumentEpoch);
    if (this.waits.size >= p.limits.results)
      throw new EngineError(p.statuses.budgetExceeded, 'Activation waiter budget exceeded');
    if (!Number.isFinite(timeoutMs) || timeoutMs <= 0 || timeoutMs > p.limits.commandTimeoutMs)
      throw new RangeError('Invalid activation timeout');
    let stop: ((error: Error) => void) | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const deadline = Date.now() + timeoutMs;
    let done = false;
    try {
      return await Promise.race([
        new Promise<never>((_, reject) => {
          stop = reject;
          this.waits.add(reject);
          timer = setTimeout(
            () => reject(new EngineError(p.statuses.timedOut, 'Scene activation timed out')),
            timeoutMs,
          );
        }),
        (async () => {
          while (!done && !this.closed && Date.now() < deadline) {
            const result = checked(await this.request(p.opcodes.inspect));
            if (result.activeDocument >= atLeastDocumentEpoch) return result;
            if (result.failedDocument >= atLeastDocumentEpoch)
              throw new EngineError(p.statuses.failed, 'Scene preparation failed', result);
            await new Promise<void>((resolve) => setTimeout(resolve, 8));
          }
          throw new EngineError(
            this.closed ? p.statuses.closed : p.statuses.timedOut,
            'Scene activation ended',
          );
        })(),
      ]);
    } finally {
      done = true;
      if (timer !== undefined) clearTimeout(timer);
      if (stop) this.waits.delete(stop);
    }
  }
  sessionClosed(): void {
    this.closed = true;
    this.inFlight = undefined;
    for (const reject of this.waits)
      reject(new EngineError(p.statuses.closed, 'Engine view closed'));
    this.waits.clear();
    this.client.releaseView(this);
  }
  async close(): Promise<void> {
    if (this.closed) return;
    try {
      checked(await this.request(p.opcodes.closeView));
    } finally {
      this.sessionClosed();
    }
  }
}
