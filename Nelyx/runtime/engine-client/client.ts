// SPDX-License-Identifier: BSD-3-Clause
import {
  body,
  packet,
  response,
  transaction,
  uint32,
  capabilityMask,
  uint64,
  layoutQueryBody,
  editBody,
  focusBody,
  semanticActionBody,
  stateInspectionBody,
  writeHandle,
} from './codec.ts';
import type { EngineResponse, PacketOwner } from './codec.ts';
import { protocol as p } from './schema.ts';
import { drainEngineOwners } from './lifecycle.ts';
import {
  fontUploadBeginBytes,
  fontUploadChunkBytes,
  fontResourceReadBytes,
  readFontUpload,
  readFontResourceSlice,
} from './font-resource.ts';
import {
  fontTransitionResourceBytes,
  fontTransitionReadyBytes,
  fontTransitionCommitBytes,
} from './font-transition.ts';
import type { FontTransitionOwner, FontTransitionState } from './font-transition.ts';
import type { FontUploadState, FontResourceSlice } from './font-resource.ts';
import { ResourceSlots } from './resource-slots.ts';
import {
  imageUploadBeginBytes,
  imageUploadChunkBytes,
  imageResourceReadBytes,
  readImageUpload,
  readImageResourceSlice,
} from './image-resource.ts';
import type { ImageUploadState, ImageResourceSlice } from './image-resource.ts';
import { scrollCurveBytes } from './scroll-curve.ts';
import type { ScrollCurve } from './scroll-curve.ts';
const resourceSlots = new WeakMap<EngineClient, ResourceSlots>();
function slotsFor(client: EngineClient): ResourceSlots {
  const slots = resourceSlots.get(client);
  if (!slots) throw new EngineError(p.statuses.closed, 'SDK resource session closed');
  return slots;
}

export interface EngineTransport {
  /** Coalesced readiness hint; packet responses and ACKs remain authoritative. */
  subscribeChanges?(callback: () => void): () => void;
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
    throw new EngineError(
      result.status,
      `Engine v2 request failed (opcode ${result.opcode}, status ${result.status})`,
      result,
    );
  return result;
}
export class EngineClient {
  private changeRevision = 0;
  private readonly changes = new Set<() => void>();
  private unsubscribeChanges: (() => void) | undefined;
  get notificationRevision(): number {
    return this.changeRevision;
  }
  subscribeChanges(callback: () => void): (() => void) | undefined {
    if (!this.transport.subscribeChanges) return undefined;
    this.changes.add(callback);
    return () => {
      this.changes.delete(callback);
    };
  }
  readonly owner: PacketOwner;
  private closed = false;
  private aborting: Promise<void> | undefined;
  private pending = 0;
  private pendingBytes = 0;
  private actualCapabilities = 0;
  get capabilities(): number {
    return this.actualCapabilities;
  }
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
    resourceSlots.set(this, new ResourceSlots());
    this.unsubscribeChanges = transport.subscribeChanges?.(() => {
      ++this.changeRevision;
      for (const callback of Array.from(this.changes)) callback();
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
      const required = capabilityMask(options.requiredCapabilities ?? p.capabilities.protocol);
      const result = await client.send(
        packet(
          p.opcodes.hello,
          client.owner,
          body(8, (v) => v.setUint32(0, required, true)),
        ),
      );
      checked(result);
      client.actualCapabilities = result.capabilities;
      if ((result.capabilities & required) >>> 0 !== required)
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
    resourceSlots.get(this)?.clear();
    resourceSlots.delete(this);
    this.unsubscribeChanges?.();
    this.changes.clear();
    this.aborting = Promise.resolve().then(() => this.transport.close());
    return this.aborting;
  }
}
export class EngineViewClient {
  private readonly changeWaits = new Set<() => void>();
  /** @internal Release readiness waits before the owning App host drains. */
  wakeChangeWaits(): void {
    for (const finish of Array.from(this.changeWaits)) finish();
  }
  get notificationRevision(): number {
    return this.client.notificationRevision;
  }
  subscribeChanges(callback: () => void): (() => void) | undefined {
    return this.client.subscribeChanges(callback);
  }
  async waitForChange(revision: number): Promise<void> {
    this.ensureOpen();
    if (revision !== this.notificationRevision) return;
    await new Promise<void>((resolve, reject) => {
      let timer: ReturnType<typeof setTimeout> | undefined;
      let unsubscribe: (() => void) | undefined;
      const finish = (error?: Error) => {
        if (timer !== undefined) clearTimeout(timer);
        unsubscribe?.();
        this.waits.delete(cancel);
        this.changeWaits.delete(finish);
        if (error) reject(error);
        else resolve();
      };
      const cancel = (error: Error) => finish(error);
      this.waits.add(cancel);
      this.changeWaits.add(finish);
      unsubscribe = this.subscribeChanges(() => finish());
      if (!unsubscribe) timer = setTimeout(() => finish(), 8);
      else if (revision !== this.notificationRevision) finish();
    });
  }
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
  /** @internal A reservation; upload/transaction ACK still owns Core admission. */
  allocateResource(): import('./codec.ts').NodeHandle {
    this.ensureOpen();
    return slotsFor(this.client).allocate(this);
  }
  /** @internal Call only after known rejection (false) or producer release (true). */
  recycleResource(resource: import('./codec.ts').NodeHandle, released: boolean): void {
    slotsFor(this.client).recycle(this, resource, released);
  }
  /** @internal Quarantine a slot contradicted by a raw Core producer. */
  discardResource(resource: import('./codec.ts').NodeHandle): void {
    slotsFor(this.client).discard(this, resource);
  }
  private requireFontResources(): void {
    if (!(this.client.capabilities & p.capabilities.fontResources))
      throw new EngineError(
        p.statuses.capabilityMissing,
        'Required Core font resource capability is absent',
      );
  }
  async beginImageUpload(
    resource: import('./codec.ts').NodeHandle,
    total: number,
    token: bigint,
  ): Promise<ImageUploadState> {
    const state = readImageUpload(
      checked(
        await this.request(
          p.opcodes.imageUploadBegin,
          imageUploadBeginBytes(resource, total),
          token,
        ),
      ),
    );
    if (
      !state ||
      state.token !== token ||
      state.resource.slot !== resource.slot ||
      state.resource.generation !== resource.generation ||
      state.total !== total
    )
      throw Error('Image upload receipt identity differs');
    return state;
  }
  async appendImageUpload(
    token: bigint,
    offset: number,
    bytes: Uint8Array,
  ): Promise<ImageUploadState> {
    const state = readImageUpload(
      checked(
        await this.request(p.opcodes.imageUploadChunk, imageUploadChunkBytes(offset, bytes), token),
      ),
    );
    if (
      !state ||
      state.token !== token ||
      state.phase !== 'uploading' ||
      state.filled < offset + bytes.length
    )
      throw Error('Image upload append receipt differs');
    return state;
  }
  async finishImageUpload(token: bigint, commit: boolean): Promise<ImageUploadState> {
    if (typeof commit !== 'boolean') throw Error('Invalid image upload terminal');
    const state = readImageUpload(
      checked(
        await this.request(
          commit ? p.opcodes.imageUploadCommit : p.opcodes.imageUploadAbort,
          undefined,
          token,
        ),
      ),
    );
    if (!state || state.token !== token || state.phase !== (commit ? 'committed' : 'aborted'))
      throw Error('Image upload terminal receipt differs');
    return state;
  }
  async readImageResource(
    resource: import('./codec.ts').NodeHandle,
    offset: number,
    length: number,
    preparation = 0n,
  ): Promise<ImageResourceSlice> {
    const slice = readImageResourceSlice(
      checked(
        await this.request(
          p.opcodes.imageResourceRead,
          imageResourceReadBytes(resource, offset, length, preparation),
        ),
      ),
    );
    if (
      !slice ||
      slice.resource.slot !== resource.slot ||
      slice.resource.generation !== resource.generation ||
      slice.offset !== offset ||
      slice.bytes.length !== length
    )
      throw Error('Image resource read identity differs');
    return slice;
  }
  async releaseImageResource(resource: import('./codec.ts').NodeHandle): Promise<void> {
    checked(
      await this.request(
        p.opcodes.imageResourceRelease,
        body(8, (data) => writeHandle(data, 0, resource)),
      ),
    );
  }
  async beginFontUpload(
    resource: import('./codec.ts').NodeHandle,
    total: number,
    token: bigint,
  ): Promise<FontUploadState> {
    this.requireFontResources();
    const result = checked(
        await this.request(p.opcodes.fontUploadBegin, fontUploadBeginBytes(resource, total), token),
      ),
      state = readFontUpload(result);
    if (
      !state ||
      state.token !== token ||
      state.resource.slot !== resource.slot ||
      state.resource.generation !== resource.generation ||
      state.total !== total
    )
      throw Error('Font upload receipt identity differs');
    return state;
  }
  async appendFontUpload(
    token: bigint,
    offset: number,
    bytes: Uint8Array,
  ): Promise<FontUploadState> {
    this.requireFontResources();
    const result = checked(
        await this.request(p.opcodes.fontUploadChunk, fontUploadChunkBytes(offset, bytes), token),
      ),
      state = readFontUpload(result);
    if (
      !state ||
      state.token !== token ||
      state.phase !== 'uploading' ||
      state.filled < offset + bytes.length
    )
      throw Error('Font upload append receipt differs');
    return state;
  }
  async finishFontUpload(token: bigint, commit: boolean): Promise<FontUploadState> {
    this.requireFontResources();
    if (typeof commit !== 'boolean') throw Error('Invalid font upload terminal');
    const result = checked(
        await this.request(
          commit ? p.opcodes.fontUploadCommit : p.opcodes.fontUploadAbort,
          undefined,
          token,
        ),
      ),
      state = readFontUpload(result);
    if (!state || state.token !== token || state.phase !== (commit ? 'committed' : 'aborted'))
      throw Error('Font upload terminal receipt differs');
    return state;
  }
  async readFontResource(
    resource: import('./codec.ts').NodeHandle,
    offset: number,
    length: number,
    preparation = 0n,
    transition = 0n,
  ): Promise<FontResourceSlice> {
    this.requireFontResources();
    const result = checked(
        await this.request(
          p.opcodes.fontResourceRead,
          fontResourceReadBytes(resource, offset, length, preparation, transition),
        ),
      ),
      slice = readFontResourceSlice(result);
    if (
      !slice ||
      slice.resource.slot !== resource.slot ||
      slice.resource.generation !== resource.generation ||
      slice.offset !== offset ||
      slice.bytes.length !== length
    )
      throw Error('Font resource read identity differs');
    return slice;
  }
  private fontTransitionReceipt(result: EngineResponse, token: bigint): FontTransitionState {
    const state = checked(result).fontTransition;
    if (!state || state.token !== token) throw Error('Font transition receipt identity differs');
    return state;
  }
  async beginFontTransition(
    resource: import('./codec.ts').NodeHandle | null,
    token: bigint,
  ): Promise<FontTransitionState> {
    this.requireFontResources();
    const state = this.fontTransitionReceipt(
      await this.request(
        p.opcodes.fontTransitionBegin,
        fontTransitionResourceBytes(resource),
        token,
      ),
      token,
    );
    if (
      state.resource?.slot !== resource?.slot ||
      state.resource?.generation !== resource?.generation
    )
      throw Error('Font transition resource receipt differs');
    return state;
  }
  async fontTransitionReady(
    token: bigint,
    owner: FontTransitionOwner,
    failure = 0,
  ): Promise<FontTransitionState> {
    this.requireFontResources();
    return this.fontTransitionReceipt(
      await this.request(
        p.opcodes.fontTransitionReady,
        fontTransitionReadyBytes(owner, failure),
        token,
      ),
      token,
    );
  }
  async commitFontTransition(
    token: bigint,
    revision: bigint,
    afterInput = 0n,
  ): Promise<FontTransitionState> {
    this.requireFontResources();
    const state = this.fontTransitionReceipt(
      await this.request(
        p.opcodes.fontTransitionCommit,
        fontTransitionCommitBytes(revision, afterInput),
        token,
      ),
      token,
    );
    if (state.phase !== 'committed' || state.fontRevision !== revision)
      throw Error('Font transition commit receipt differs');
    return state;
  }
  async abortFontTransition(token: bigint): Promise<FontTransitionState> {
    this.requireFontResources();
    const state = this.fontTransitionReceipt(
      await this.request(p.opcodes.fontTransitionAbort, undefined, token),
      token,
    );
    if (state.phase !== 'aborted') throw Error('Font transition abort receipt differs');
    return state;
  }
  async releaseFontResource(resource: import('./codec.ts').NodeHandle): Promise<void> {
    this.requireFontResources();
    checked(
      await this.request(p.opcodes.fontResourceRelease, fontTransitionResourceBytes(resource)),
    );
  }
  /** Core binding only; the embedder must prepare every provider owner first. */
  async setFontCatalog(
    fontRevision: bigint,
    resource: import('./codec.ts').NodeHandle | null,
    afterInput = 0n,
  ): Promise<EngineResponse> {
    this.requireFontResources();
    return checked(
      await this.request(
        p.opcodes.fontRevision,
        body(24, (value) => {
          value.setBigUint64(0, uint64(fontRevision), true);
          value.setBigUint64(8, uint64(afterInput), true);
          writeHandle(value, 16, resource ?? { slot: 0, generation: 0 });
        }),
      ),
    );
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
  /** Lightweight owner/status query; inspect without this flag still returns the scene. */
  async inspectState(): Promise<EngineResponse> {
    return checked(await this.request(p.opcodes.inspect, stateInspectionBody()));
  }
  /** Starts a Content-owned scroll; scrollTerminal carries its completion. */
  startScroll(
    node: import('./codec.ts').NodeHandle,
    target: number,
    durationMs = 0,
    curve?: ScrollCurve,
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
      durationMs > p.limits.scrollDurationMs
    )
      throw new RangeError('Invalid native scroll target or duration');
    const tail = curve ? scrollCurveBytes(curve) : new Uint8Array(),
      id = ++this.nextScroll;
    return {
      id,
      receipt: this.request(
        p.opcodes.scroll,
        body(56 + tail.length, (value) => {
          writeHandle(value, 0, node);
          value.setFloat64(24, target, true);
          value.setFloat64(32, durationMs / 1000, true);
          value.setFloat64(40, (durationMs + p.limits.commandTimeoutMs) / 1000, true);
          value.setUint32(48, 3, true);
          new Uint8Array(value.buffer, value.byteOffset, value.byteLength).set(tail, 56);
        }),
        id,
      ).then((result) => checked(result, [p.statuses.pending, p.statuses.ok])),
    };
  }
  /** Cancel exactly one command; a delayed owner cannot cancel its successor. */
  async cancelScroll(id: bigint): Promise<void> {
    this.ensureOpen();
    if (id <= 0n || id > 0xffff_ffff_ffff_ffffn) throw RangeError('Invalid scroll command');
    checked(
      await this.request(
        p.opcodes.scrollCancel,
        body(8, (value) => value.setBigUint64(0, id, true)),
      ),
      [p.statuses.ok, p.statuses.resultExpired],
    );
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
  /** Content locates and measures a Source list's destination from its own metric cache. */
  startListOffsetSeek(
    viewport: import('./codec.ts').NodeHandle,
    list: import('./codec.ts').NodeHandle,
    generation: bigint,
    offset: number,
  ): { readonly id: bigint; readonly receipt: Promise<EngineResponse> } {
    this.ensureOpen();
    if (!Number.isFinite(offset) || offset < 0 || offset > 1e12)
      throw new RangeError('Invalid list offset seek');
    const id = ++this.nextScroll;
    return {
      id,
      receipt: this.request(
        p.opcodes.listSeek,
        body(48, (v) => {
          writeHandle(v, 0, viewport);
          writeHandle(v, 8, list);
          v.setBigUint64(16, uint64(generation), true);
          v.setUint32(28, p.listSeekFlags.offset, true);
          v.setFloat64(32, offset, true);
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
      const state = checked(await this.inspectState());
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
    const result = checked(await this.inspectState());
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
            const result = checked(await this.inspectState());
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
