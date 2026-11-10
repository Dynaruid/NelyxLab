// SPDX-License-Identifier: BSD-3-Clause
import { stateInspectionBody } from '../../../runtime/engine-client/codec.ts';
import { body, protocol as p, measurementBody } from '../../../runtime/engine-client/codec.ts';
import type { EngineResponse } from '../../../runtime/engine-client/codec.ts';
import {
  fontResourceReadBytes,
  readFontResourceSlice,
} from '../../../runtime/engine-client/font-resource.ts';
import {
  imageResourceReadBytes,
  readImageResourceSlice,
} from '../../../runtime/engine-client/image-resource.ts';
import { CanvasKitProvider } from '../../render/canvaskit-web/provider.ts';
import type { PreparedPictures } from '../../render/canvaskit-web/provider.ts';
import { exchange, request, failure } from './common.ts';
import type { BrowserModule } from './common.ts';
import { DemandFrameClock } from './frame-clock.ts';
import type { FrameClockSample } from './frame-clock.ts';
import { FontPreparation } from './font-preparation.ts';

export type Viewport = {
  width: number;
  height: number;
  scale: number;
  visible: boolean;
  focused: boolean;
};
export type ActorPost = (value: Record<string, unknown>, transfer?: ArrayBuffer[]) => void;
function changeNotifier(post: ActorPost): (state: EngineResponse) => void {
  let previous = '';
  return (state) => {
    const key = [
      state.document,
      state.publication,
      state.metrics,
      state.device,
      state.failedDocument,
      state.preparation,
      state.layoutBuildRequest?.id,
      state.visible,
      state.focused,
      state.focusWork,
      state.editingWork,
      state.controlWork,
      state.appFrameWork,
      state.consumedThrough,
    ].join('/');
    if (key !== previous || state.interactionCount) {
      previous = key;
      post({ kind: 'engine-change' });
    }
  };
}
export function preparedTransfers(packet: PreparedPictures): ArrayBuffer[] {
  return [
    ...packet.pictures.map((p) => p.bytes),
    ...(packet.fontCatalogs ?? []).map((font) => font.bytes),
    ...packet.texts.flatMap((p) =>
      p.runs.flatMap((r) => [r.glyphs.buffer as ArrayBuffer, r.positions.buffer as ArrayBuffer]),
    ),
  ];
}
export class ContentActor {
  private readonly notifyChange = changeNotifier((value) => this.post(value));
  private readonly fontPreparation: FontPreparation;
  private scheduled = false;
  private stopped = false;
  private last = 0n;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private pumping = false;
  private timingPreparation = 0n;
  private timing = {
    startedAtMs: 0,
    steps: 0,
    layoutStepElapsedMs: 0,
    measurementElapsedMs: 0,
    recordElapsedMs: 0,
  };
  constructor(
    private module: BrowserModule,
    private engine: number,
    private provider: CanvasKitProvider,
    private post: ActorPost,
    private sharedOwner: boolean,
  ) {
    this.fontPreparation = new FontPreparation(module, engine, provider, 'content', post);
  }
  checkFonts(): void {
    this.fontPreparation.check();
  }
  kick(): void {
    if (this.stopped || this.scheduled) return;
    this.scheduled = true;
    if (this.pumping) return;
    this.timer = setTimeout(() => {
      this.timer = undefined;
      this.pumping = true;
      const deadline = performance.now() + 4;
      try {
        // Measurements and bounded Core steps are synchronous on this owner.
        // Continue ready work within one time slice instead of paying the
        // browser's nested-timer clamp for every paragraph/layout step.
        let steps = 0;
        do {
          this.step();
        } while (this.scheduled && !this.stopped && ++steps < 32 && performance.now() < deadline);
      } finally {
        this.pumping = false;
        if (this.scheduled && !this.stopped) {
          this.scheduled = false;
          this.kick();
        }
      }
    }, 0);
  }
  private resources(scene: EngineResponse): { scene: EngineResponse; release(): void } {
    const images = this.provider.acquireImageResources(
      scene,
      (resource, offset, length, preparation) => {
        const result = request(
          this.module,
          this.engine,
          p.opcodes.imageResourceRead,
          imageResourceReadBytes(resource, offset, length, preparation),
        );
        if (result.status !== p.statuses.ok)
          throw Error('Core image resource read rejected: ' + result.status);
        const slice = readImageResourceSlice(result);
        if (!slice) throw Error('Core image resource read is missing');
        return slice;
      },
    );
    try {
      const fonts = this.provider.acquireFontResources(
        scene,
        (resource, offset, length, preparation) => {
          const result = request(
            this.module,
            this.engine,
            p.opcodes.fontResourceRead,
            fontResourceReadBytes(resource, offset, length, preparation),
          );
          if (result.status !== p.statuses.ok)
            throw Error('Core font resource read rejected: ' + result.status);
          const slice = readFontResourceSlice(result);
          if (!slice) throw Error('Core font resource read is missing');
          return slice;
        },
      );
      return {
        scene: images.scene,
        release: () => {
          try {
            fonts();
          } finally {
            images.release();
          }
        },
      };
    } catch (error) {
      images.release();
      throw error;
    }
  }
  private step(): void {
    this.scheduled = false;
    if (this.stopped) return;
    let attempt: { id: bigint; metrics: bigint; device: bigint } | undefined;
    try {
      const startedAtMs = performance.now();
      const state = request(
        this.module,
        this.engine,
        p.opcodes.contentStep,
        body(8, (v) => v.setUint32(0, p.limits.contentPerStep, true)),
      );
      if (state.status !== p.statuses.ok || state.closed) return;
      this.notifyChange(state);
      if (state.preparation !== this.timingPreparation) {
        this.timingPreparation = state.preparation;
        this.timing = {
          startedAtMs,
          steps: 0,
          layoutStepElapsedMs: 0,
          measurementElapsedMs: 0,
          recordElapsedMs: 0,
        };
      }
      ++this.timing.steps;
      this.timing.layoutStepElapsedMs += performance.now() - startedAtMs;
      if (!state.preparation) this.provider.discardMeasurements();
      if (state.measureRequest) {
        const measurement = request(this.module, this.engine, p.opcodes.measureRequest);
        if (measurement.status !== p.statuses.ok) {
          this.kick();
          return;
        }
        attempt = {
          id: measurement.measurePreparation,
          metrics: measurement.metrics,
          device: measurement.device,
        };
        const measurementStart = performance.now();
        const resources = this.resources(measurement);
        let result;
        try {
          result = request(
            this.module,
            this.engine,
            p.opcodes.measureResult,
            measurementBody(measurement, this.provider.measure(resources.scene)),
          );
        } finally {
          resources.release();
        }
        this.timing.measurementElapsedMs += performance.now() - measurementStart;
        if (![p.statuses.ok, p.statuses.stale].includes(result.status as 0))
          throw new Error('Provider metrics rejected: ' + result.status);
        this.kick();
      } else if (state.preparationReady && state.preparation !== this.last) {
        const recordStart = performance.now();
        const scene = request(this.module, this.engine, p.opcodes.preparationScene);
        if (scene.status !== p.statuses.ok)
          throw new Error('Preparation snapshot rejected (' + scene.status + ')');
        this.last = scene.preparation;
        attempt = { id: scene.preparation, metrics: scene.metrics, device: scene.device };
        const resources = this.resources(scene);
        let packet: PreparedPictures;
        try {
          packet = this.provider.prepare(resources.scene, this.sharedOwner);
        } finally {
          resources.release();
        }
        this.timing.recordElapsedMs = performance.now() - recordStart;
        try {
          this.post(
            { kind: 'prepared', packet },
            this.sharedOwner ? [] : preparedTransfers(packet),
          );
        } catch (error) {
          this.provider.releasePacket(packet.preparation);
          this.provider.retireExcept(scene.activePreparation);
          throw error;
        }
        this.post({
          kind: 'content-stats',
          counters: { ...this.provider.counters },
          textCapabilities: this.provider.textCapabilities,
          timing: {
            domain: 'owner-performance',
            timeOriginMs: performance.timeOrigin,
            ...this.timing,
            completedAtMs: performance.now(),
            preparation: scene.preparation,
            document: scene.document,
            nativeContentWork: scene.contentWork,
            nativeLayoutWork: scene.layoutWork,
          },
        });
      } else if (
        (!state.preparationReady && state.preparation && !state.layoutBuildPending) ||
        state.layoutQuery?.status === p.statuses.pending
      )
        this.kick();
    } catch (error) {
      if (error instanceof Error && 'fatalMemory' in error) {
        this.stopped = true;
        this.post({ kind: 'provider-error', message: failure(error) });
        return;
      }
      const state = request(this.module, this.engine, p.opcodes.inspect, stateInspectionBody());
      this.provider.discardMeasurements();
      const failed = attempt ?? {
        id: state.measurePreparation || state.preparation,
        metrics: state.metrics,
        device: state.device,
      };
      if (failed.id)
        request(
          this.module,
          this.engine,
          p.opcodes.preparationResult,
          body(24, (v) => {
            v.setBigUint64(0, failed.id, true);
            v.setBigUint64(8, failed.metrics, true);
            v.setBigUint64(16, failed.device, true);
          }),
        );
      this.post({ kind: 'preparation-error', message: failure(error) });
      this.kick();
    }
  }
  packet(bytes: Uint8Array): Uint8Array {
    const result = exchange(this.module, this.engine, bytes);
    const opcode = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint16(
      p.headerFields.opcode,
      true,
    );
    if (
      [
        p.opcodes.fontTransitionBegin,
        p.opcodes.fontTransitionCommit,
        p.opcodes.fontTransitionAbort,
        p.opcodes.fontRevision,
      ].includes(opcode as 51)
    ) {
      this.checkFonts();
      this.post({ kind: 'font-wake' });
    }
    if (
      [
        p.opcodes.transaction,
        p.opcodes.openView,
        p.opcodes.fontRevision,
        p.opcodes.fontTransitionCommit,
        p.opcodes.layoutQuery,
      ].includes(opcode as 2)
    )
      this.kick();
    return result;
  }
  stop(): void {
    this.stopped = true;
    this.fontPreparation.stop();
    if (this.timer !== undefined) clearTimeout(this.timer);
  }
}
export class RenderActor {
  private readonly notifyChange = changeNotifier((value) => this.post(value));
  private readonly fontPreparation: FontPreparation;
  private stopped = false;
  private running: Promise<void> | undefined;
  private clock: DemandFrameClock;
  private wanted = false;
  private wakeAt: number | undefined;
  private candidate = 0n;
  private viewport: Viewport = { width: 0, height: 0, scale: 1, visible: true, focused: true };
  private cppMetrics = '';
  private last: EngineResponse | undefined;
  private offsets: number[] = [];
  private publishedTiming: Record<string, unknown> | undefined;
  constructor(
    private module: BrowserModule,
    private engine: number,
    private provider: CanvasKitProvider,
    private post: ActorPost,
  ) {
    this.fontPreparation = new FontPreparation(module, engine, provider, 'render', post);
    provider.bindSnapshots((frame, phase, node, token) => {
      const result = request(
        module,
        engine,
        p.opcodes.snapshotPaint,
        body(32, (v) => {
          v.setBigUint64(0, frame, true);
          v.setUint32(8, node?.slot ?? 0, true);
          v.setUint32(12, node?.generation ?? 0, true);
          v.setBigUint64(16, token ?? 0n, true);
          v.setUint32(24, phase, true);
          v.setUint32(28, phase === 1 ? 1 : 0, true);
        }),
      );
      if (
        result.status !== p.statuses.ok ||
        ((phase === 0 || phase === 1) && !result.snapshotDecision)
      )
        throw Error('Snapshot Core request failed: ' + result.status);
      return result.snapshotDecision;
    });
    this.clock = new DemandFrameClock(
      (sample) => this.beginFrame(sample),
      (error) => this.post({ kind: 'provider-error', message: failure(error) }),
    );
  }
  checkFonts(): void {
    this.fontPreparation.check();
  }
  get clockSnapshot(): FrameClockSample {
    return this.clock.snapshot;
  }
  attach(canvas: OffscreenCanvas, viewport: Viewport, clockPort?: MessagePort): void {
    if (clockPort) this.clock.connect(clockPort);
    this.provider.attach(canvas);
    this.viewport = viewport;
    // Probe the actual owner WebGL2 surface even if the DOM starts at zero size.
    this.provider.resize(Math.max(1, viewport.width), Math.max(1, viewport.height), viewport.scale);
  }
  update(viewport: Viewport): void {
    if (this.stopped) return;
    this.viewport = viewport;
    const state = request(this.module, this.engine, p.opcodes.inspect, stateInspectionBody());
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
    const current = request(this.module, this.engine, p.opcodes.inspect, stateInspectionBody());
    request(
      this.module,
      this.engine,
      p.opcodes.visibility,
      body(16, (v) => {
        v.setUint32(0, (viewport.visible ? 1 : 0) | (viewport.focused ? 2 : 0), true);
        v.setBigUint64(8, current.lastInput, true);
      }),
    );
    if (!viewport.visible || viewport.width <= 0 || viewport.height <= 0) {
      this.clock.cancel();
      this.wanted = false;
      this.wakeAt = undefined;
      this.report(
        request(this.module, this.engine, p.opcodes.inspect, stateInspectionBody()),
        this.clock.snapshot,
      );
    } else this.kick();
  }
  prepared(packet: PreparedPictures): void {
    if (this.stopped) return;
    const state = request(this.module, this.engine, p.opcodes.inspect, stateInspectionBody());
    if (
      state.preparation !== packet.preparation ||
      state.metrics !== packet.metrics ||
      state.device !== packet.device
    ) {
      this.provider.retireExcept(state.activePreparation, this.candidate);
      return;
    }
    try {
      if (
        (packet.reused?.length || packet.fontReferences?.length) &&
        packet.basePreparation !== state.activePreparation
      )
        throw Error('Prepared reference no longer belongs to the active preparation');
      // The previous candidate is superseded by this preparation. Drop it
      // before import so active + obsolete + incoming never coexist here.
      this.provider.retireExcept(state.activePreparation, packet.preparation);
      if (this.candidate !== state.activePreparation) this.candidate = 0n;
      this.provider.import(packet);
    } catch (error) {
      request(
        this.module,
        this.engine,
        p.opcodes.preparationResult,
        body(24, (v) => {
          v.setBigUint64(0, packet.preparation, true);
          v.setBigUint64(8, packet.metrics, true);
          v.setBigUint64(16, packet.device, true);
        }),
      );
      this.provider.retireExcept(state.activePreparation, this.candidate);
      this.post({ kind: 'preparation-error', message: failure(error) });
      return;
    }
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
      this.provider.retireExcept(state.activePreparation, this.candidate);
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
      ![
        p.opcodes.inspect,
        p.opcodes.hello,
        p.opcodes.pollEvents,
        p.opcodes.queryResult,
        p.opcodes.semanticsSnapshot,
        p.opcodes.editSnapshot,
        p.opcodes.pollInteractionEvents,
        p.opcodes.pollRaw,
        p.opcodes.layoutSnapshot,
      ].includes(op as 14)
    )
      this.kick();
    return result;
  }
  kick(delay = 0): void {
    if (
      this.stopped ||
      !this.viewport.visible ||
      this.viewport.width <= 0 ||
      this.viewport.height <= 0
    )
      return;
    this.wanted = true;
    const at = performance.now() + Math.max(0, delay);
    this.wakeAt = Math.min(this.wakeAt ?? at, at);
    if (this.running) return;
    this.clock.request(this.wakeAt);
  }
  private beginFrame(sample: FrameClockSample): void {
    this.wakeAt = undefined;
    this.wanted = false;
    this.running = this.frame(sample)
      .catch((error) => this.post({ kind: 'provider-error', message: failure(error) }))
      .finally(() => {
        this.running = undefined;
        if (this.wanted && !this.stopped)
          this.kick(Math.max(0, (this.wakeAt ?? performance.now()) - performance.now()));
      });
  }
  private async frame(clock: FrameClockSample): Promise<void> {
    const startedAtMs = performance.now();
    let state = request(
      this.module,
      this.engine,
      p.opcodes.tick,
      body(8, (v) => v.setFloat64(0, performance.now() / 1000, true)),
    );
    if (state.status !== p.statuses.ok || state.closed) return;
    const tickEndMs = performance.now();
    let drawElapsedMs = 0,
      publicationElapsedMs = 0,
      submission: bigint | null = null;
    const frame = request(this.module, this.engine, p.opcodes.takeFrame);
    if (
      frame.status !== p.statuses.ok &&
      frame.status !== p.statuses.notFound &&
      frame.status !== p.statuses.busy &&
      frame.status !== p.statuses.closed &&
      frame.status !== p.statuses.contentUnavailable
    )
      throw Error('Core frame response rejected: ' + frame.status);
    if (frame.status === p.statuses.ok) {
      submission = frame.submission;
      this.offsets = frame.nodes
        .filter((n) => n.kind === p.kinds.scrollViewport)
        .map((n) => n.offset);
      let drawn = false;
      try {
        const drawStart = performance.now();
        this.provider.draw(frame, this.viewport.width, this.viewport.height, this.viewport.scale);
        drawElapsedMs = performance.now() - drawStart;
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
        const publicationStart = performance.now();
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
        publicationElapsedMs = performance.now() - publicationStart;
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
    this.notifyChange(state);
    if (submission !== null)
      this.publishedTiming = {
        domain: 'owner-performance',
        timeOriginMs: performance.timeOrigin,
        startedAtMs,
        tickElapsedMs: tickEndMs - startedAtMs,
        drawAndSubmitElapsedMs: drawElapsedMs,
        publicationElapsedMs,
        completedAtMs: performance.now(),
        submission,
        document: state.activeDocument,
        publication: state.publication,
        metrics: state.metrics,
        consumedThrough: state.consumedThrough,
        build: 'unobserved',
        scanout: 'unobserved',
      };
    this.report(state, clock, events.events);
    if (state.pendingDocument) this.post({ kind: 'content-wake' });
    if (state.renderWake) this.kick(this.clock.source === 'timer-fallback' ? 16 : 0);
    if (state.nextDeadline !== null)
      this.kick(Math.max(0, (state.nextDeadline - performance.now() / 1000) * 1000));
  }
  private report(
    state: EngineResponse,
    frameClock: FrameClockSample,
    events: EngineResponse['events'] = [],
  ): void {
    this.last = state;
    this.post({
      kind: 'render-stats',
      state,
      scrollOffsets: this.offsets,
      counters: { ...this.provider.counters },
      gl: this.provider.gl,
      events,
      publicationStage: state.publication ? 'publicationIssued' : 'unobserved',
      gpuComplete: 'unobserved',
      frameClock,
      timing: this.publishedTiming ?? null,
    });
  }
  async stop(): Promise<void> {
    this.stopped = true;
    this.clock.close();
    await this.running;
    this.fontPreparation.stop();
    this.post({ kind: 'render-stopped', state: this.last, frameClock: this.clock.snapshot });
  }
}
