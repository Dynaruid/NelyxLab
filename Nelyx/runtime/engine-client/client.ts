// SPDX-License-Identifier: BSD-3-Clause
import {
  body,
  packet,
  response,
  transaction,
  uint32,
  uint64,
  layoutQueryBody,
  editBody,
  focusBody,
  semanticActionBody,
  writeHandle,
} from './codec.ts';
import type { EngineResponse, PacketOwner } from './codec.ts';
import { protocol as p } from './schema.ts';
import { drainEngineOwners } from './lifecycle.ts';

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
  private aborting: Promise<void> | undefined;
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
      await drainEngineOwners('Engine connection and cleanup failed', [
        () => {
          throw error;
        },
        () => client.abort(),
      ]);
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
    await drainEngineOwners('Engine close failed', [
      () => {
        checked(result);
      },
      () => this.abort(),
    ]);
  }
  /** Forced transport loss. Normal hosts drain their provider before teardown. */
  abort(): Promise<void> {
    if (this.aborting) return this.aborting;
    this.closed = true;
    const error = new EngineError(p.statuses.closed, 'Engine session closed');
    for (const reject of this.closing) reject(error);
    this.closing.clear();
    for (const view of this.views) view.sessionClosed();
    this.views.clear();
    this.aborting = Promise.resolve().then(() => this.transport.close());
    return this.aborting;
  }
}
export class EngineViewClient {
  private rawGeneration = 0n;
  private nextScroll = 0n;
  private nextEdit = 0n;
  private querying = false;
  private queryId = 0n;
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
  /** Last activated layout, with parent-local coordinates and document/metrics
   * epochs. Composed transforms and property overlays belong to the published
   * frame. Acceptance of a newer transaction does not advance this snapshot. */
  async layoutSnapshot(): Promise<EngineResponse> {
    return checked(await this.request(p.opcodes.layoutSnapshot));
  }
  /** Starts a Content-owned scroll; scrollTerminal carries its completion. */
  startScroll(
    node: import('./codec.ts').NodeHandle,
    target: number,
    durationMs = 0,
  ): {
    readonly id: bigint;
    readonly receipt: Promise<EngineResponse>;
  } {
    this.ensureOpen();
    if (
      !Number.isFinite(target) ||
      Math.abs(target) > 1e12 ||
      !Number.isFinite(durationMs) ||
      durationMs < 0 ||
      durationMs > p.limits.commandTimeoutMs - 100
    )
      throw new RangeError('Invalid native scroll target or duration');
    const id = ++this.nextScroll;
    return {
      id,
      receipt: this.request(
        p.opcodes.scroll,
        body(56, (value) => {
          writeHandle(value, 0, node);
          value.setFloat64(24, target, true);
          value.setFloat64(32, durationMs / 1000, true);
          value.setFloat64(40, p.limits.commandTimeoutMs / 1000, true);
          value.setUint32(48, 3, true);
        }),
        id,
      ).then((result) => checked(result, [p.statuses.pending, p.statuses.ok])),
    };
  }
  /** Receipt for a bounded, cancellable seek. Its scrollTerminal event reports completion. */
  async seekList(
    viewport: import('./codec.ts').NodeHandle,
    list: import('./codec.ts').NodeHandle,
    generation: bigint,
    index: number,
    alignment = 0,
  ): Promise<EngineResponse> {
    return this.startListSeek(viewport, list, generation, index, alignment).receipt;
  }
  startListSeek(
    viewport: import('./codec.ts').NodeHandle,
    list: import('./codec.ts').NodeHandle,
    generation: bigint,
    index: number,
    alignment = 0,
  ): { readonly id: bigint; readonly receipt: Promise<EngineResponse> } {
    this.ensureOpen();
    if (
      !Number.isInteger(index) ||
      index < 0 ||
      !Number.isFinite(alignment) ||
      alignment < 0 ||
      alignment > 1
    )
      throw new RangeError('Invalid list seek');
    const id = ++this.nextScroll;
    return {
      id,
      receipt: this.request(
        p.opcodes.listSeek,
        body(48, (v) => {
          writeHandle(v, 0, viewport);
          writeHandle(v, 8, list);
          v.setBigUint64(16, uint64(generation), true);
          v.setUint32(24, index, true);
          v.setFloat64(32, alignment, true);
          v.setFloat64(40, p.limits.commandTimeoutMs / 1000, true);
        }),
        id,
      ).then((result) => checked(result, [p.statuses.pending, p.statuses.ok])),
    };
  }
  async semanticsSnapshot(): Promise<EngineResponse> {
    return checked(await this.request(p.opcodes.semanticsSnapshot));
  }
  async editSnapshot(
    node: import('./codec.ts').NodeHandle,
  ): Promise<import('./codec.ts').EditingSnapshot> {
    const r = checked(
      await this.request(
        p.opcodes.editSnapshot,
        body(8, (v) => writeHandle(v, 0, node)),
      ),
    );
    if (!r.nodes[0]?.editing) throw new EngineError(p.statuses.notFound, 'Editor snapshot missing');
    return r.nodes[0].editing;
  }
  async edit(
    node: import('./codec.ts').NodeHandle,
    value: import('./codec.ts').EditingUpdate,
  ): Promise<import('./codec.ts').EditingSnapshot> {
    const id = ++this.nextEdit,
      bytes = editBody(node, value),
      deadline = Date.now() + p.limits.commandTimeoutMs;
    let r = await this.request(p.opcodes.edit, bytes, id);
    while (
      r.status === p.statuses.busy &&
      value.kind === 'replace' &&
      value.policy &&
      value.policy !== 'preserve' &&
      Date.now() < deadline
    ) {
      await new Promise<void>((resolve) => setTimeout(resolve, 8));
      r = await this.request(p.opcodes.edit, bytes, id);
    }
    checked(r);
    if (!r.nodes[0]?.editing) throw new EngineError(p.statuses.notFound, 'Editor snapshot missing');
    return r.nodes[0].editing;
  }
  async focus(
    node: import('./codec.ts').NodeHandle | null,
    publication: bigint,
    session = 0n,
    exactSession = false,
  ): Promise<EngineResponse> {
    return checked(
      await this.request(p.opcodes.focus, focusBody(node, publication, session, exactSession)),
    );
  }
  async semanticAction(
    node: import('./codec.ts').NodeHandle,
    publication: bigint,
    action: keyof typeof p.semanticsActions,
    session = 0n,
    value?: number,
  ): Promise<EngineResponse> {
    return checked(
      await this.request(
        p.opcodes.semanticsAction,
        semanticActionBody(node, publication, action, session, value),
      ),
    );
  }
  async pollInteractionEvents(): Promise<EngineResponse> {
    return checked(await this.request(p.opcodes.pollInteractionEvents));
  }
  async subscribeRaw(): Promise<EngineResponse> {
    return checked(
      await this.request(
        p.opcodes.subscribeRaw,
        body(8, (v) => v.setBigUint64(0, ++this.rawGeneration, true)),
      ),
    );
  }
  async pollRaw(): Promise<EngineResponse> {
    return checked(await this.request(p.opcodes.pollRaw));
  }
  async replyGesture(
    sample: import('./codec.ts').RawInputSample,
    accept: boolean,
  ): Promise<EngineResponse> {
    return checked(
      await this.request(
        p.opcodes.gestureReply,
        body(24, (v) => {
          v.setUint32(0, sample.stream, true);
          v.setUint32(4, accept ? 1 : 0, true);
          v.setBigUint64(8, sample.sequence, true);
        }),
      ),
    );
  }
  async queryLayout(
    node: import('./codec.ts').NodeHandle,
    kind: import('./codec.ts').LayoutQueryKind,
    horizontal: import('./codec.ts').AxisBound,
    vertical: import('./codec.ts').AxisBound,
    timeoutMs = p.limits.commandTimeoutMs,
  ): Promise<import('./codec.ts').EngineLayoutQuery> {
    this.ensureOpen();
    if (this.querying)
      throw new EngineError(p.statuses.busy, 'One layout query may be pending per view');
    if (!Number.isFinite(timeoutMs) || timeoutMs <= 0 || timeoutMs > p.limits.commandTimeoutMs)
      throw new RangeError('Invalid layout query timeout');
    this.querying = true;
    let completed = false,
      id = 0n;
    try {
      const state = checked(await this.request(p.opcodes.inspect));
      this.queryId = uint64(
        (state.layoutQuery && state.layoutQuery.id > this.queryId
          ? state.layoutQuery.id
          : this.queryId) + 1n,
      );
      id = this.queryId;
      let result = checked(
        await this.request(
          p.opcodes.layoutQuery,
          layoutQueryBody(node, kind, horizontal, vertical),
          id,
        ),
        [p.statuses.ok, p.statuses.pending],
      );
      const end = Date.now() + timeoutMs;
      while (result.status === p.statuses.pending && Date.now() < end) {
        await new Promise<void>((resolve) => setTimeout(resolve, 8));
        this.ensureOpen();
        result = checked(await this.request(p.opcodes.layoutQueryResult, new Uint8Array(), id), [
          p.statuses.ok,
          p.statuses.pending,
        ]);
      }
      if (result.status === p.statuses.pending)
        throw new EngineError(p.statuses.timedOut, 'Layout query timed out', result);
      if (!result.layoutQuery || result.layoutQuery.id !== id)
        throw new EngineError(p.statuses.failed, 'Layout query identity differs');
      completed = true;
      return result.layoutQuery;
    } finally {
      if (!completed && id && !this.closed)
        await this.request(p.opcodes.layoutQueryCancel, new Uint8Array(), id).catch(() => {});
      this.querying = false;
    }
  }
  dryLayout(
    node: import('./codec.ts').NodeHandle,
    horizontal: import('./codec.ts').AxisBound,
    vertical: import('./codec.ts').AxisBound,
  ) {
    return this.queryLayout(node, 'dry', horizontal, vertical);
  }
  intrinsic(
    node: import('./codec.ts').NodeHandle,
    kind: Exclude<import('./codec.ts').LayoutQueryKind, 'dry'>,
    extent: number | 'unbounded' = 'unbounded',
  ) {
    const other: import('./codec.ts').AxisBound =
      extent === 'unbounded' ? { kind: 'unbounded' } : { kind: 'finite', min: 0, max: extent };
    return this.queryLayout(
      node,
      kind,
      kind === 'minWidth' || kind === 'maxWidth' ? { kind: 'unbounded' } : other,
      kind === 'minWidth' || kind === 'maxWidth' ? other : { kind: 'unbounded' },
    );
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
