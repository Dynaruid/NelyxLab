// SPDX-License-Identifier: BSD-3-Clause
import { EngineError } from '../engine-client/client.ts';
import type { EngineViewClient } from '../engine-client/client.ts';
import type { EngineResponse, NodeHandle } from '../engine-client/codec.ts';
import type { AppTextBackend } from '../engine-client/app-text.ts';
import type { AppParagraphFontLease } from './text.ts';
import { protocol as p } from '../engine-client/schema.ts';
import {
  fontCatalogBytes,
  fontFamilyBytes,
  readFontCatalog,
} from '../engine-client/font-catalog.ts';
import { readFontUpload } from '../engine-client/font-resource.ts';

type Binding = AppParagraphFontLease['binding'];
type Entry = { binding: Binding; holds: number; size: number };
type FontLoad = {
  bytes: Uint8Array;
  readonly family: string | undefined;
  readonly credit: number;
  cancelled: boolean;
  resolve(): void;
  reject(error: unknown): void;
};
type Pending = {
  stage: number;
  resource: NodeHandle | null;
  size: number;
  cancelled: boolean;
  uploadToken?: bigint;
  transition?: bigint;
  uploadCommitted: boolean;
  beginAttempted: boolean;
  revision?: number;
  entry?: Entry;
  afterInput?: bigint;
  beginRejected?: boolean;
  discardAllocated?: boolean;
  published?: boolean;
  appFinished?: boolean;
};
const same = (a: NodeHandle | null, b: NodeHandle | null) =>
  a?.slot === b?.slot && a?.generation === b?.generation;
const cancelled = () => new EngineError(p.statuses.canceled, 'App font update cancelled');

/** App-owned bridge, not a replacement FontLoader API. Every transition keeps
 * its App stage and Core producer until a known terminal ACK resolves ownership. */
export class OriginalFontOwner {
  private readonly entries = new Map<number, Entry>();
  private current: Entry;
  private pending: Pending | undefined;
  private running: Promise<number> | undefined;
  private stopping = false;
  private closed = false;
  private wake: (() => void) | undefined;
  private readonly loads: FontLoad[] = [];
  private activeLoad: FontLoad | undefined;
  private pumping: Promise<void> | undefined;
  private loadBytes = 0;
  private readonly failedLoadCredits = new Set<FontLoad>();
  private readonly catalogCredits = new Set<number>();
  private readonly retiring = new Map<NodeHandle, { work: Promise<void>; error?: unknown }>();
  private updates = 0;
  private rollbacks = 0;
  private commits = 0;
  private recoveries = 0;
  constructor(
    private readonly view: EngineViewClient,
    private readonly backend: AppTextBackend,
    private readonly changed: (revision: bigint) => void,
  ) {
    if (backend.snapshot().fontRevision !== 1)
      throw Error('Original font owner requires the initial bundled cohort');
    this.current = {
      binding: Object.freeze({ resource: null, fontRevision: 1n }),
      holds: 1,
      size: 0,
    };
    this.entries.set(1, this.current);
  }
  get execution() {
    return Object.freeze({
      updates: this.updates,
      commits: this.commits,
      rollbacks: this.rollbacks,
      recoveries: this.recoveries,
      fontRevision: Number(this.current.binding.fontRevision),
      pending: !!this.pending,
      bindings: this.entries.size,
      retiring: this.retiring.size,
      fontLoadsPending: this.loads.length + (this.activeLoad ? 1 : 0),
      fontLoadBytes: this.loadBytes,
      fontLoadFailedCredits: this.failedLoadCredits.size,
      fontLoadCatalogCredits: this.catalogCredits.size,
    });
  }
  retain(revision: number): AppParagraphFontLease {
    const entry = this.entries.get(revision);
    if (this.closed || !entry || !entry.holds)
      throw Error('Foreign or retired Original font binding');
    ++entry.holds;
    let held = true;
    return {
      binding: entry.binding,
      release: () => {
        if (!held) throw Error('Original font lease released twice');
        held = false;
        this.drop(entry);
      },
    };
  }
  private drop(entry: Entry): void {
    if (!entry.holds) throw Error('Original font binding ownership underflow');
    if (--entry.holds) return;
    this.entries.delete(Number(entry.binding.fontRevision));
    if (entry.binding.resource) this.retire(entry.binding.resource);
  }
  private retire(resource: NodeHandle): void {
    if (this.retiring.has(resource)) return;
    const task: { work: Promise<void>; error?: unknown } = { work: Promise.resolve() };
    this.retiring.set(resource, task);
    task.work = this.retry(() => this.view.releaseFontResource(resource)).then(
      () => {
        this.view.recycleResource(resource, true);
        this.retiring.delete(resource);
      },
      (error) => {
        task.error = error;
      },
    );
  }
  async drain(): Promise<void> {
    // A failed release is reinserted below; iterate one finite snapshot.
    const snapshot = [...this.retiring];
    for (const [resource, task] of snapshot) {
      await task.work;
      if (!this.retiring.has(resource)) continue;
      this.retiring.delete(resource);
      this.retire(resource);
      const retry = this.retiring.get(resource)!;
      await retry.work;
      if (this.retiring.has(resource))
        throw retry.error ?? Error('Original font retirement is unresolved');
    }
  }
  private async retry<T>(
    operation: () => Promise<T>,
    knownRejected?: (error: EngineError) => void,
  ): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      if (error instanceof EngineError && error.result && error.status !== p.statuses.timedOut) {
        knownRejected?.(error);
        throw error;
      }
      ++this.recoveries;
      return operation();
    }
  }
  private async inspect(): Promise<EngineResponse> {
    const state = await this.retry(() => this.view.request(p.opcodes.inspect));
    if (state.status !== p.statuses.ok || state.closed)
      throw new EngineError(
        state.closed ? p.statuses.closed : state.status,
        'Original font owner is unavailable',
        state,
      );
    return state;
  }
  private checkCancellation(update: Pending): void {
    if (this.stopping || update.cancelled) throw cancelled();
  }
  private pause(milliseconds: number): Promise<void> {
    return new Promise((resolve) => {
      const finish = () => {
        clearTimeout(timer);
        if (this.wake === finish) this.wake = undefined;
        resolve();
      };
      const timer = setTimeout(finish, milliseconds);
      this.wake = finish;
    });
  }
  /** One candidate per App owner. Concurrent requests fail before decoding. */
  update(catalog: Uint8Array | null): Promise<number> {
    if (
      this.activeLoad ||
      this.loads.length ||
      this.failedLoadCredits.size ||
      this.catalogCredits.size
    )
      return Promise.reject(new EngineError(p.statuses.busy, 'Original font loads are pending'));
    return this.startUpdate(catalog);
  }
  private startUpdate(catalog: Uint8Array | null): Promise<number> {
    if (this.stopping || this.closed)
      return Promise.reject(Error('Original font owner is closing'));
    if (this.running || this.pending)
      return Promise.reject(
        new EngineError(
          p.statuses.busy,
          'An Original font update is pending; recover it before replacing it',
        ),
      );
    let stage: number, resource: NodeHandle | null;
    try {
      const bytes = catalog ?? fontCatalogBytes({ fonts: [] });
      if (this.backend.snapshot().fontRevision !== Number(this.current.binding.fontRevision))
        throw Error('App font cohort changed outside its coordinator');
      stage = this.backend.prepareFonts(bytes);
      try {
        resource = catalog === null ? null : this.view.allocateResource();
      } catch (error) {
        this.backend.finishFonts(stage, false);
        throw error;
      }
      this.pending = {
        stage,
        resource,
        size: bytes.length,
        cancelled: false,
        uploadCommitted: false,
        beginAttempted: false,
      };
    } catch (error) {
      return Promise.reject(error);
    }
    ++this.updates;
    const update = this.pending;
    this.running = Promise.resolve()
      .then(() => this.perform(update))
      .finally(() => {
        this.running = undefined;
      });
    return this.running;
  }
  /** Canonical loads append to the namespace in admission order. Only bounded,
   * immutable snapshots wait here; their credit belongs to the App backend. */
  loadFont(bytes: Uint8Array, family?: string): Promise<void> {
    let credit: number, captured: Uint8Array;
    try {
      if (this.stopping || this.closed) throw Error('Original font owner is closing');
      if (
        this.failedLoadCredits.size ||
        (this.catalogCredits.size && !this.activeLoad) ||
        (this.pending && !this.running)
      )
        throw new EngineError(p.statuses.busy, 'Recover the unresolved Original font owner first');
      if (family !== undefined && family !== '') fontFamilyBytes(family);
      if (
        !(bytes instanceof Uint8Array) ||
        !(bytes.buffer instanceof ArrayBuffer) ||
        bytes.length < 12 ||
        bytes.length > p.limits.fontCatalogBytes ||
        this.loads.length + (this.activeLoad ? 1 : 0) >= 32 ||
        this.loadBytes + bytes.length > p.limits.fontCatalogBytes
      )
        throw Error('Original font load input/queue byte budget exceeded');
      credit = this.backend.reserveFontBytes(2 * bytes.length + 65536);
      try {
        captured = bytes.slice();
      } catch (error) {
        this.backend.releaseFontBytes(credit);
        throw error;
      }
    } catch (error) {
      return Promise.reject(error);
    }
    const work = new Promise<void>((resolve, reject) => {
      this.loads.push({ bytes: captured, family, credit, cancelled: false, resolve, reject });
      this.loadBytes += captured.length;
    });
    this.startLoads();
    return work;
  }
  private startLoads(): void {
    if (!this.pumping && this.loads.length && !this.stopping) {
      // Enter through a microtask so admission and the owner pointer are complete.
      this.pumping = Promise.resolve()
        .then(() => this.pumpLoads())
        .finally(() => {
          this.pumping = undefined;
          this.startLoads();
        });
      void this.pumping.catch(() => {
        /* Each caller receives its own terminal. */
      });
    }
  }
  private finishLoad(load: FontLoad, errors: unknown[]): void {
    try {
      this.backend.releaseFontBytes(load.credit);
      this.loadBytes -= load.bytes.length;
      load.bytes = new Uint8Array(0);
      this.failedLoadCredits.delete(load);
    } catch (error) {
      this.failedLoadCredits.add(load);
      errors.push(error);
    }
    if (!errors.length) load.resolve();
    else
      load.reject(
        errors.length === 1
          ? errors[0]
          : new AggregateError(errors, 'Font loading/credit retirement failed'),
      );
  }
  private async pumpLoads(): Promise<void> {
    if (this.running) await this.running.catch(() => {});
    while (this.loads.length) {
      const load = this.loads.shift()!;
      this.activeLoad = load;
      const errors: unknown[] = [];
      try {
        if (this.stopping || load.cancelled) throw cancelled();
        if (this.pending || this.failedLoadCredits.size || this.catalogCredits.size)
          throw new EngineError(
            p.statuses.busy,
            'Recover the unresolved Original font owner first',
          );
        await this.appendFont(load);
      } catch (error) {
        errors.push(error);
      }
      this.finishLoad(load, errors);
      this.activeLoad = undefined;
    }
  }
  private async appendFont(load: FontLoad): Promise<void> {
    const family = load.family || this.backend.fontFamily(load.bytes);
    const current = this.current,
      bundled = current.binding.resource ? undefined : fontCatalogBytes({ fonts: [] }),
      size = bundled?.length ?? current.size,
      aligned = (length: number) => Math.ceil(length / 8) * 8,
      total = size + 16 + aligned(fontFamilyBytes(family).length) + aligned(load.bytes.length);
    if (size < 32 || total > p.limits.fontCatalogBytes)
      throw Error('Original additive font catalog byte budget exceeded');
    const credit = this.backend.reserveFontBytes(
      size + total + 4 * p.limits.fontChunkBytes + 65536,
    );
    this.catalogCredits.add(credit);
    try {
      const bytes = bundled ?? new Uint8Array(size);
      if (current.binding.resource) {
        for (let at = 0; at < size; at += p.limits.fontChunkBytes) {
          if (this.stopping || load.cancelled) throw cancelled();
          const slice = await this.retry(() =>
            this.view.readFontResource(
              current.binding.resource!,
              at,
              Math.min(p.limits.fontChunkBytes, size - at),
            ),
          );
          if (slice.total !== size)
            throw Error('Original font catalog size changed during loading');
          bytes.set(slice.bytes, at);
        }
      }
      if (this.stopping || load.cancelled) throw cancelled();
      const previous = readFontCatalog(bytes),
        catalog = fontCatalogBytes({
          fonts: [...previous.fonts, { family, bytes: load.bytes }],
          fallback: previous.fallback,
        });
      await this.startUpdate(catalog);
    } finally {
      this.backend.releaseFontBytes(credit);
      this.catalogCredits.delete(credit);
    }
  }
  private async perform(update: Pending): Promise<number> {
    try {
      const initial = await this.inspect();
      this.checkCancellation(update);
      if (initial.fontRevision !== this.current.binding.fontRevision)
        throw Error('Core/App font cohort differs before preparation');
      const upload = readFontUpload(initial);
      if (initial.fontTransition?.phase === 'preparing' || upload?.phase === 'uploading')
        throw new EngineError(p.statuses.busy, 'Another Core font candidate is preparing');
      update.transition = (initial.fontTransition?.token ?? 0n) + 1n;
      if (update.resource) {
        update.uploadToken = (upload?.token ?? 0n) + 1n;
        await this.retry(
          () => this.view.beginFontUpload(update.resource!, update.size, update.uploadToken!),
          (error) => {
            delete update.uploadToken;
            update.discardAllocated = error.status === p.statuses.invalidHandle;
          },
        );
        for (let at = 0; at < update.size; at += p.limits.fontChunkBytes) {
          this.checkCancellation(update);
          const bytes = this.backend.fontChunk(
            update.stage,
            at,
            Math.min(p.limits.fontChunkBytes, update.size - at),
          );
          await this.retry(() => this.view.appendFontUpload(update.uploadToken!, at, bytes));
        }
        this.checkCancellation(update);
        await this.retry(() => this.view.finishFontUpload(update.uploadToken!, true));
        update.uploadCommitted = true;
      }
      this.checkCancellation(update);
      update.beginAttempted = true;
      await this.retry(
        () => this.view.beginFontTransition(update.resource, update.transition!),
        () => {
          update.beginRejected = true;
        },
      );
      await this.retry(() => this.view.fontTransitionReady(update.transition!, 'app'));
      let state: EngineResponse | undefined;
      const deadline = Date.now() + 30000;
      for (let attempt = 0; attempt < 30; ++attempt) {
        this.checkCancellation(update);
        state = await this.inspect();
        const candidate = state.fontTransition;
        if (candidate?.token !== update.transition || candidate.phase !== 'preparing')
          throw Error(
            'Core font preparation failed or was replaced: ' +
              candidate?.failedOwner +
              '/' +
              candidate?.failedStatus,
          );
        if (candidate.ready === 7) break;
        if (attempt === 29 || Date.now() >= deadline)
          throw new EngineError(
            p.statuses.timedOut,
            'Font providers did not acknowledge preparation',
          );
        await this.pause(
          Math.min(Math.max(8, 2 ** Math.min(attempt + 3, 10)), 1000, deadline - Date.now()),
        );
      }
      this.checkCancellation(update);
      update.revision = this.backend.activateFonts(update.stage);
      update.entry = {
        binding: Object.freeze({
          resource: update.resource,
          fontRevision: BigInt(update.revision),
        }),
        holds: 1,
        size: update.size,
      };
      this.entries.set(update.revision, update.entry);
      update.afterInput = state!.lastInput;
      for (let attempt = 0; attempt < 30; ++attempt) {
        this.checkCancellation(update);
        try {
          await this.retry(() =>
            this.view.commitFontTransition(
              update.transition!,
              BigInt(update.revision!),
              update.afterInput!,
            ),
          );
          return this.commit(update);
        } catch (error) {
          const latest = error instanceof EngineError ? error.result : undefined;
          if (latest && this.isCommitted(update, latest)) return this.commit(update);
          if (
            error instanceof EngineError &&
            error.status === p.statuses.stale &&
            latest?.fontTransition?.token === update.transition &&
            latest.fontTransition.phase === 'preparing'
          ) {
            update.afterInput = latest.lastInput;
            continue;
          }
          throw error;
        }
      }
      throw new EngineError(p.statuses.timedOut, 'Font commit input fence did not settle');
    } catch (error) {
      if (this.pending !== update) throw error;
      try {
        const committed = await this.settle(update);
        if (committed !== undefined) return committed;
      } catch (cleanup) {
        throw new AggregateError(
          [error, cleanup],
          'Original font update is unresolved; recover before replacing or retiring it',
        );
      }
      throw error;
    }
  }
  private isCommitted(update: Pending, state: EngineResponse): boolean {
    const candidate = state.fontTransition;
    return (
      !!update.revision &&
      !!candidate &&
      candidate.token === update.transition &&
      candidate.phase === 'committed' &&
      candidate.fontRevision === BigInt(update.revision) &&
      state.fontRevision === candidate.fontRevision &&
      same(candidate.resource, update.resource)
    );
  }
  private commit(update: Pending): number {
    if (!update.entry || !update.revision) throw Error('Committed font has no App generation');
    if (!update.published) {
      const previous = this.current;
      this.current = update.entry;
      this.drop(previous);
      update.published = true;
    }
    this.finishApp(update, true);
    this.pending = undefined;
    ++this.commits;
    this.changed(BigInt(update.revision));
    return update.revision;
  }
  private finishApp(update: Pending, committed: boolean): void {
    if (update.appFinished) return;
    try {
      this.backend.finishFonts(update.stage, committed);
    } catch (error) {
      const state = this.backend.snapshot();
      if (
        state.fontStages !== 0 ||
        state.fontRevision !==
          (committed ? update.revision : Number(this.current.binding.fontRevision))
      )
        throw error;
    }
    update.appFinished = true;
  }
  /** Abort is the ownership fence: an inspect showing "preparing" alone cannot
   * prove that a timed-out commit is absent from another owner's mailbox. */
  private async settle(update: Pending): Promise<number | undefined> {
    if (update.beginAttempted && !update.beginRejected) {
      let terminal: EngineResponse | undefined;
      let aborted = false;
      try {
        await this.retry(() => this.view.abortFontTransition(update.transition!));
        aborted = true;
      } catch (error) {
        terminal = error instanceof EngineError ? error.result : undefined;
        if (terminal && this.isCommitted(update, terminal)) return this.commit(update);
      }
      if (!aborted) {
        const state = terminal ?? (await this.inspect());
        if (this.isCommitted(update, state)) return this.commit(update);
        if (
          !state.fontTransition ||
          state.fontTransition.token !== update.transition ||
          !['aborted', 'failed'].includes(state.fontTransition.phase)
        )
          throw Error('Core font transition terminal is unknown');
      }
    }
    if (update.resource && update.uploadToken !== undefined && !update.uploadCommitted) {
      const state = await this.inspect(),
        upload = readFontUpload(state);
      if (upload?.token !== update.uploadToken || !same(upload.resource, update.resource))
        throw Error('Core font upload terminal is unknown');
      if (upload.phase === 'uploading')
        await this.retry(() => this.view.finishFontUpload(update.uploadToken!, false));
      else if (upload.phase === 'committed') update.uploadCommitted = true;
    }
    this.finishApp(update, false);
    if (update.entry) this.drop(update.entry);
    else if (update.resource) {
      if (update.uploadCommitted) this.retire(update.resource);
      else if (update.discardAllocated) this.view.discardResource(update.resource);
      else this.view.recycleResource(update.resource, false);
    }
    this.pending = undefined;
    ++this.rollbacks;
    await this.drain();
    return undefined;
  }
  cancel(): void {
    if (this.pending) this.pending.cancelled = true;
    if (this.activeLoad) this.activeLoad.cancelled = true;
    for (const load of this.loads.splice(0)) this.finishLoad(load, [cancelled()]);
    this.wake?.();
  }
  async recover(): Promise<number | undefined> {
    if (this.running || this.activeLoad || this.loads.length)
      throw new EngineError(p.statuses.busy, 'Original font update is still running');
    const revision = this.pending ? await this.settle(this.pending) : undefined;
    this.drainLoadCredits();
    await this.drain();
    return revision;
  }
  private drainLoadCredits(): void {
    for (const credit of this.catalogCredits) {
      this.backend.releaseFontBytes(credit);
      this.catalogCredits.delete(credit);
    }
    for (const load of this.failedLoadCredits) this.finishLoad(load, [cancelled()]);
    if (this.failedLoadCredits.size) throw Error('Original font buffer retirement is unresolved');
  }
  async stop(): Promise<void> {
    this.stopping = true;
    this.cancel();
    try {
      await this.running;
    } catch {
      /* The update caller owns a resolved rejection. */
    }
    await this.pumping;
    if (this.pending) await this.settle(this.pending);
    this.drainLoadCredits();
  }
  async close(): Promise<void> {
    await this.stop();
    if (this.closed) {
      await this.drain();
      return;
    }
    if ([...this.entries.values()].some((entry) => entry.holds > (entry === this.current ? 1 : 0)))
      throw Error('Original font bindings still have Source holders');
    this.closed = true;
    this.drop(this.current);
    await this.drain();
  }
}
