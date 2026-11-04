// SPDX-License-Identifier: BSD-3-Clause
import { body, protocol as p } from '../../../runtime/engine-client/index.ts';
import type { EngineResponse } from '../../../runtime/engine-client/index.ts';
import { CanvasKitProvider } from '../../render/canvaskit-web/provider.ts';
import type { PreparedPictures } from '../../render/canvaskit-web/provider.ts';
import { exchange, request, failure } from './common.ts';
import type { BrowserModule } from './common.ts';

export type Viewport = {
  width: number;
  height: number;
  scale: number;
  visible: boolean;
  focused: boolean;
};
export type ActorPost = (value: Record<string, unknown>, transfer?: ArrayBuffer[]) => void;
export function preparedTransfers(packet: PreparedPictures): ArrayBuffer[] {
  return [
    ...packet.pictures.map((p) => p.bytes),
    ...packet.texts.flatMap((p) =>
      p.runs.flatMap((r) => [r.glyphs.buffer as ArrayBuffer, r.positions.buffer as ArrayBuffer]),
    ),
  ];
}
export class ContentActor {
  private scheduled = false;
  private stopped = false;
  private last = 0n;
  private timer: ReturnType<typeof setTimeout> | undefined;
  constructor(
    private module: BrowserModule,
    private engine: number,
    private provider: CanvasKitProvider,
    private post: ActorPost,
    private sharedOwner: boolean,
  ) {}
  kick(): void {
    if (this.stopped || this.scheduled) return;
    this.scheduled = true;
    this.timer = setTimeout(() => this.step(), 0);
  }
  private step(): void {
    this.scheduled = false;
    if (this.stopped) return;
    try {
      const state = request(
        this.module,
        this.engine,
        p.opcodes.contentStep,
        body(8, (v) => v.setUint32(0, p.limits.contentPerStep, true)),
      );
      if (state.status !== p.statuses.ok || state.closed) return;
      if (state.preparationReady && state.preparation !== this.last) {
        const scene = request(this.module, this.engine, p.opcodes.preparationScene);
        if (scene.status !== p.statuses.ok)
          throw new Error('Preparation snapshot rejected (' + scene.status + ')');
        this.last = scene.preparation;
        const packet = this.provider.prepare(scene, this.sharedOwner);
        this.post({ kind: 'prepared', packet }, this.sharedOwner ? [] : preparedTransfers(packet));
        this.post({ kind: 'content-stats', counters: { ...this.provider.counters } });
      } else if (!state.preparationReady && (state.preparation || state.pendingDocument))
        this.kick();
    } catch (error) {
      const state = request(this.module, this.engine, p.opcodes.inspect);
      if (state.preparation)
        request(
          this.module,
          this.engine,
          p.opcodes.preparationResult,
          body(24, (v) => {
            v.setBigUint64(0, state.preparation, true);
            v.setBigUint64(8, state.metrics, true);
            v.setBigUint64(16, state.device, true);
          }),
        );
      this.post({ kind: 'provider-error', message: failure(error) });
    }
  }
  packet(bytes: Uint8Array): Uint8Array {
    const result = exchange(this.module, this.engine, bytes);
    const opcode = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint16(
      p.headerFields.opcode,
      true,
    );
    if ([p.opcodes.transaction, p.opcodes.openView].includes(opcode as 2)) this.kick();
    return result;
  }
  stop(): void {
    this.stopped = true;
    if (this.timer !== undefined) clearTimeout(this.timer);
  }
}
export class RenderActor {
  private stopped = false;
  private running: Promise<void> | undefined;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private wanted = false;
  private candidate = 0n;
  private viewport: Viewport = { width: 0, height: 0, scale: 1, visible: true, focused: true };
  private cppMetrics = '';
  private last: EngineResponse | undefined;
  constructor(
    private module: BrowserModule,
    private engine: number,
    private provider: CanvasKitProvider,
    private post: ActorPost,
  ) {}
  attach(canvas: OffscreenCanvas, viewport: Viewport): void {
    this.provider.attach(canvas);
    this.viewport = viewport;
    this.provider.resize(viewport.width, viewport.height, viewport.scale);
  }
  update(viewport: Viewport): void {
    this.viewport = viewport;
    const state = request(this.module, this.engine, p.opcodes.inspect);
    if (state.status !== p.statuses.ok || state.closed) return;
    const identity = [viewport.width, viewport.height, viewport.scale].join('/');
    if (identity !== this.cppMetrics) {
      const result = request(
        this.module,
        this.engine,
        p.opcodes.metrics,
        body(40, (v) => {
          v.setBigUint64(0, state.metrics + 1n, true);
          v.setFloat64(8, viewport.width, true);
          v.setFloat64(16, viewport.height, true);
          v.setFloat64(24, viewport.scale, true);
          v.setBigUint64(32, state.lastInput, true);
        }),
      );
      if (result.status !== p.statuses.ok) throw new Error('Metrics rejected: ' + result.status);
      this.cppMetrics = identity;
      this.post({ kind: 'content-wake' });
    }
    const current = request(this.module, this.engine, p.opcodes.inspect);
    request(
      this.module,
      this.engine,
      p.opcodes.visibility,
      body(16, (v) => {
        v.setUint32(0, (viewport.visible ? 1 : 0) | (viewport.focused ? 2 : 0), true);
        v.setBigUint64(8, current.lastInput, true);
      }),
    );
    this.kick();
  }
  prepared(packet: PreparedPictures): void {
    if (this.stopped) return;
    const state = request(this.module, this.engine, p.opcodes.inspect);
    if (
      state.preparation !== packet.preparation ||
      state.metrics !== packet.metrics ||
      state.device !== packet.device
    )
      return;
    this.provider.import(packet);
    const result = request(
      this.module,
      this.engine,
      p.opcodes.providerReady,
      body(24, (v) => {
        v.setBigUint64(0, packet.preparation, true);
        v.setBigUint64(8, packet.metrics, true);
        v.setBigUint64(16, packet.device, true);
      }),
    );
    if (result.status === p.statuses.ok) {
      this.candidate = packet.preparation;
      this.kick();
    } else this.provider.retireExcept(state.activePreparation, this.candidate);
  }
  packet(bytes: Uint8Array): Uint8Array {
    const result = exchange(this.module, this.engine, bytes);
    const op = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint16(
      p.headerFields.opcode,
      true,
    );
    if (
      ![p.opcodes.inspect, p.opcodes.hello, p.opcodes.pollEvents, p.opcodes.queryResult].includes(
        op as 14,
      )
    )
      this.kick();
    return result;
  }
  kick(delay = 0): void {
    if (this.stopped) return;
    this.wanted = true;
    if (this.timer !== undefined || this.running) return;
    this.timer = setTimeout(() => {
      this.timer = undefined;
      this.wanted = false;
      this.running = this.frame()
        .catch((error) => this.post({ kind: 'provider-error', message: failure(error) }))
        .finally(() => {
          this.running = undefined;
          if (this.wanted && !this.stopped) this.kick(16);
        });
    }, delay);
  }
  private async frame(): Promise<void> {
    let state = request(
      this.module,
      this.engine,
      p.opcodes.tick,
      body(8, (v) => v.setFloat64(0, performance.now() / 1000, true)),
    );
    if (state.status !== p.statuses.ok || state.closed) return;
    const frame = request(this.module, this.engine, p.opcodes.takeFrame);
    if (frame.status === p.statuses.ok) {
      let drawn = false;
      try {
        this.provider.draw(frame, this.viewport.width, this.viewport.height, this.viewport.scale);
        drawn = true;
        // Provider flush is submission, with its public resource-retention
        // contract. No GPU-complete receipt is invented for WebGL.
        request(
          this.module,
          this.engine,
          p.opcodes.releaseFrame,
          body(24, (v) => {
            v.setBigUint64(0, frame.submission, true);
            v.setBigUint64(8, frame.device, true);
          }),
        );
        await new Promise<void>((resolve) => setTimeout(resolve, 0));
        if (!this.stopped)
          state = request(
            this.module,
            this.engine,
            p.opcodes.publish,
            body(24, (v) => {
              v.setBigUint64(0, frame.submission, true);
              v.setBigUint64(8, frame.device, true);
            }),
          );
        if (this.candidate === frame.activePreparation) this.candidate = 0n;
        this.provider.retireExcept(frame.activePreparation, this.candidate);
      } finally {
        if (!drawn)
          request(
            this.module,
            this.engine,
            p.opcodes.releaseFrame,
            body(24, (v) => {
              v.setBigUint64(0, frame.submission, true);
              v.setBigUint64(8, frame.device, true);
              v.setUint32(20, 1, true);
            }),
          );
      }
    }
    this.last = state;
    const events = request(this.module, this.engine, p.opcodes.pollEvents);
    this.post({
      kind: 'render-stats',
      state,
      scrollOffsets: frame.nodes
        .filter((n) => n.kind === p.kinds.scrollViewport)
        .map((n) => n.offset),
      counters: { ...this.provider.counters },
      gl: this.provider.gl,
      events: events.events,
      publicationStage: 'publicationIssued',
      gpuComplete: 'unobserved',
    });
    if (state.pendingDocument) this.post({ kind: 'content-wake' });
    if (state.renderWake) this.wanted = true;
    if (state.nextDeadline !== null)
      this.kick(Math.min(16, Math.max(0, (state.nextDeadline - performance.now() / 1000) * 1000)));
  }
  async stop(): Promise<void> {
    this.stopped = true;
    if (this.timer !== undefined) clearTimeout(this.timer);
    await this.running;
    this.post({ kind: 'render-stopped', state: this.last });
  }
}
