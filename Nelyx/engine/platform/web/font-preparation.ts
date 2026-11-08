// SPDX-License-Identifier: BSD-3-Clause
import { protocol as p } from '../../../runtime/engine-client/schema.ts';
import {
  fontResourceReadBytes,
  readFontResourceSlice,
} from '../../../runtime/engine-client/font-resource.ts';
import { fontTransitionReadyBytes } from '../../../runtime/engine-client/font-transition.ts';
import type { EngineResponse } from '../../../runtime/engine-client/codec.ts';
import type { FontTransitionOwner } from '../../../runtime/engine-client/font-transition.ts';
import type { CanvasKitProvider } from '../../render/canvaskit-web/provider.ts';
import { request, failure } from './common.ts';
import type { BrowserModule } from './common.ts';

/** This owner's prepared collection survives commit, independently of any frame.
 * Old paragraph/Picture/table holders retain the preceding collections. */
export class FontPreparation {
  private pending: { token: bigint; release: () => void } | undefined;
  private active: { revision: bigint; release: () => void } | undefined;
  private stopped = false;
  constructor(
    private readonly module: BrowserModule,
    private readonly engine: number,
    private readonly provider: CanvasKitProvider,
    private readonly owner: FontTransitionOwner,
    private readonly post: (value: Record<string, unknown>) => void,
  ) {}
  private discardPending(): void {
    this.pending?.release();
    this.pending = undefined;
  }
  check(): void {
    if (this.stopped) return;
    const state = request(this.module, this.engine, p.opcodes.inspect),
      stage = state.fontTransition;
    if (this.active && (state.closed || this.active.revision !== state.fontRevision)) {
      this.active.release();
      this.active = undefined;
    }
    if (!stage || state.closed) {
      this.discardPending();
      return;
    }
    if (this.pending && this.pending.token !== stage.token) this.discardPending();
    if (stage.phase === 'committed') {
      if (this.pending && stage.fontRevision === state.fontRevision) {
        this.active?.release();
        this.active = { revision: stage.fontRevision, release: this.pending.release };
        this.pending = undefined;
      } else this.discardPending();
      return;
    }
    if (stage.phase !== 'preparing') {
      this.discardPending();
      return;
    }
    if (this.pending) return;
    try {
      const release = this.provider.acquireFontResources(
        {
          ...state,
          nodes: stage.resource ? [{ fontBinding: { resource: stage.resource } }] : [],
        } as unknown as EngineResponse,
        (resource, offset, length) => {
          const result = request(
            this.module,
            this.engine,
            p.opcodes.fontResourceRead,
            fontResourceReadBytes(resource, offset, length, 0n, stage.token),
          );
          if (result.status !== p.statuses.ok)
            throw Error('Core font preparation read rejected: ' + result.status);
          const slice = readFontResourceSlice(result);
          if (!slice) throw Error('Core font preparation bytes are missing');
          return slice;
        },
      );
      this.pending = { token: stage.token, release };
      const ready = request(
        this.module,
        this.engine,
        p.opcodes.fontTransitionReady,
        fontTransitionReadyBytes(this.owner),
        stage.token,
      );
      if (ready.status !== p.statuses.ok) this.discardPending();
      else if (ready.fontTransition?.phase !== 'preparing') this.check();
      this.post({ kind: 'font-wake' });
    } catch (error) {
      this.discardPending();
      if (error instanceof Error && 'fatalMemory' in error) throw error;
      const current = request(this.module, this.engine, p.opcodes.inspect);
      if (
        current.fontTransition?.token !== stage.token ||
        current.fontTransition.phase !== 'preparing'
      )
        return;
      request(
        this.module,
        this.engine,
        p.opcodes.fontTransitionReady,
        fontTransitionReadyBytes(this.owner, p.statuses.invalidValue),
        stage.token,
      );
      this.post({
        kind: 'font-preparation-error',
        owner: this.owner,
        token: stage.token,
        message: failure(error),
      });
      this.post({ kind: 'font-wake' });
    }
  }
  stop(): void {
    this.stopped = true;
    this.discardPending();
    this.active?.release();
    this.active = undefined;
  }
}
