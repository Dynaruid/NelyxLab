// SPDX-License-Identifier: BSD-3-Clause
import type { ResourceLease } from '@nelyx/core/hosting/resources';
import type { RendererEvents } from '@nelyx/core/hosting/renderer-events';
import type { FrameDiagnostics } from '@nelyx/core/ui/frame';
import { encodeFrame } from '@nelyx/core/ui/frame-wire';
import { maxWebFrameBytes } from '@nelyx/core/ui/web-frame-wire';
import type { FrameBuildToken, PaintFrame, SubmitResult, ViewMetrics } from '@nelyx/core/ui/types';
import type { WebSkiaLibrary } from '@nelyx/skia-web/library';
import { renderCapacity, sharedHeaderWords, sharedSlotBytes } from './render-protocol.ts';
import type { RenderPacket, RenderReply } from './render-protocol.ts';
import { RenderResourceSender } from './render-resources.ts';
import type { RenderRegistration } from './render-resources.ts';
import { RenderWorkerError } from './render-worker-port.ts';
import type { RenderWorkerPort } from './render-worker-port.ts';
import type { WebRenderTelemetry } from './render-telemetry.ts';

interface PendingFrame {
  readonly token: FrameBuildToken;
  readonly sentAt: number;
  readonly lease: ResourceLease;
  readonly diagnostics: FrameDiagnostics | undefined;
  readonly packet: RenderPacket;
  readonly bufferCapacity?: number;
  consumed: boolean;
  submitted: boolean;
}

export class RenderWorkerFrames {
  private readonly pending = new Map<number, PendingFrame>();
  private readonly buffers: ArrayBuffer[] = [];
  private readonly slots = Array.from({ length: renderCapacity }, () => false);
  private readonly header: Int32Array | undefined;
  private readonly resources: RenderResourceSender;
  private closing: Promise<void> | undefined;
  private watchdog: ReturnType<typeof setTimeout> | undefined;
  private watchdogDeadline = Infinity;
  private registrationStarted: number | undefined;
  private preparingSequence: number | undefined;
  private failed = false;

  constructor(
    private readonly port: RenderWorkerPort,
    private readonly shared: SharedArrayBuffer | undefined,
    library: WebSkiaLibrary,
    private readonly events: RendererEvents,
    private readonly telemetry: WebRenderTelemetry,
    private readonly inputTimeOrigin: number,
    private readonly onFailure: (error: RenderWorkerError) => void,
    private readonly submitPrepared: () => void,
  ) {
    this.header = shared ? new Int32Array(shared, 0, sharedHeaderWords) : undefined;
    this.resources = new RenderResourceSender(library, (resource) =>
      port.post({ kind: 'release', resource }),
    );
    port.watch(
      (message) => {
        try {
          this.message(message);
        } catch (error) {
          this.fail(new RenderWorkerError('worker-protocol', String(error)));
        }
      },
      (error) => this.fail(error),
    );
  }

  private fail(error: RenderWorkerError): void {
    if (this.failed || this.closing) return;
    this.failed = true;
    clearTimeout(this.watchdog);
    this.onFailure(error);
  }

  private noteResourceBytes(bytes: number): void {
    this.telemetry.resourceBytes = bytes;
    this.telemetry.peakResourceBytes = Math.max(bytes, this.telemetry.peakResourceBytes);
  }

  private beginRegistration(batch: RenderRegistration, sequence?: number): void {
    this.resources.commit(batch, sequence);
    this.registrationStarted = performance.now();
    this.telemetry.registrationBatches++;
    this.telemetry.resourceUploadBytes += batch.uploadBytes;
    this.noteResourceBytes(this.resources.resourceBytes);
  }

  private watch(): void {
    if (this.failed || this.closing) return;
    const oldest = this.pending.values().next().value?.sentAt ?? Infinity;
    const deadline = Math.min(oldest, this.registrationStarted ?? Infinity) + 7500;
    if (deadline === this.watchdogDeadline) return;
    this.watchdogDeadline = deadline;
    clearTimeout(this.watchdog);
    if (deadline === Infinity) return;
    this.watchdog = setTimeout(
      () => {
        this.fail(
          new RenderWorkerError(
            oldest <= (this.registrationStarted ?? Infinity) ? 'worker-frame' : 'worker-resources',
            'Render worker stopped acknowledging work',
          ),
        );
      },
      Math.max(0, deadline - performance.now()),
    );
  }

  canBuildFrame(): boolean {
    return (
      !this.failed &&
      !this.closing &&
      this.pending.size < renderCapacity &&
      !this.resources.hasPendingRegistration
    );
  }

  keepPendingFrame(frame: PaintFrame): boolean {
    return frame.token.sequence === this.preparingSequence && this.canBuildFrame();
  }

  updateMetrics(metrics: ViewMetrics): void {
    try {
      this.port.post({ kind: 'metrics', metrics });
    } catch (error) {
      this.fail(new RenderWorkerError('worker-frame', String(error)));
    }
  }

  setVisible(visible: boolean): void {
    try {
      this.port.post({ kind: 'visibility', visible });
    } catch (error) {
      this.fail(new RenderWorkerError('worker-frame', String(error)));
    }
  }

  retireResource(key: string): void {
    if (this.failed || this.closing) return;
    try {
      this.resources.retire(key);
    } catch (error) {
      this.fail(new RenderWorkerError('worker-resources', String(error)));
    }
  }

  submit(frame: PaintFrame, lease: ResourceLease, diagnostics?: FrameDiagnostics): SubmitResult {
    const token = frame.token,
      sequence = token.sequence;
    if (!this.canBuildFrame() || this.pending.has(sequence))
      return { status: 'rejected', reason: 'busy' };
    let batch: RenderRegistration | undefined;
    try {
      batch = this.resources.prepare(frame.resources);
      if (batch && !this.shared) {
        this.beginRegistration(batch);
        this.port.post({ kind: 'register', resources: batch.resources }, [...batch.transfer]);
        this.telemetry.registrationWaits++;
        this.preparingSequence = sequence;
        this.watch();
        return { status: 'rejected', reason: 'busy' };
      }
      this.preparingSequence = undefined;
    } catch (error) {
      this.fail(new RenderWorkerError('worker-resources', String(error)));
      return { status: 'rejected', reason: 'busy' };
    }
    const started = performance.now(),
      diagnosticStart = diagnostics?.now();
    let packet: RenderPacket | undefined;
    let transfer: ArrayBuffer[] = [];
    let length: number;
    try {
      const bytes = encodeFrame(frame, batch?.resolve ?? this.resources.resolve, {
        format: 'web',
        allocate: (size) => {
          if (size > maxWebFrameBytes)
            throw new Error('Web encoded frame exceeds the transport limit');
          const slot = size <= sharedSlotBytes ? this.slots.indexOf(false) : -1;
          if (this.shared && this.header && slot >= 0) {
            if (Atomics.load(this.header, slot * 2) !== 0)
              throw new Error('Web render slot is still published');
            packet = { transport: 'shared', slot, ticket: (sequence % 0x7ffffffe) + 1 };
            return new Uint8Array(
              this.shared,
              this.header.byteLength + slot * sharedSlotBytes,
              size,
            );
          }
          const index = this.buffers.findIndex((buffer) => buffer.byteLength >= size);
          const buffer =
            index >= 0
              ? this.buffers.splice(index, 1)[0]!
              : new ArrayBuffer(Math.min(maxWebFrameBytes, 2 ** Math.ceil(Math.log2(size))));
          if (index >= 0) this.telemetry.buffersReused++;
          packet = { transport: 'transfer', buffer, length: size };
          transfer = [buffer];
          return new Uint8Array(buffer, 0, size);
        },
      });
      if (!packet) throw new Error('Web frame packet allocator did not run');
      length = bytes.byteLength;
      if (batch) transfer.push(...batch.transfer);
    } catch (error) {
      this.fail(new RenderWorkerError('worker-frame', String(error)));
      return { status: 'rejected', reason: 'busy' };
    }
    this.telemetry.sample('encode', performance.now() - started);
    diagnostics?.record(token, 'web-frame-encode', diagnosticStart!, frame.commands.length, length);
    this.telemetry.encodedBytes += length;
    lease.transfer();
    this.pending.set(sequence, {
      token,
      sentAt: performance.now(),
      lease,
      diagnostics,
      packet,
      consumed: false,
      submitted: false,
      ...(packet.transport === 'transfer' ? { bufferCapacity: packet.buffer.byteLength } : {}),
    });
    this.telemetry.maxPending = Math.max(this.telemetry.maxPending, this.pending.size);
    try {
      if (batch) this.beginRegistration(batch, sequence);
      if (packet.transport === 'shared') {
        this.slots[packet.slot] = true;
        Atomics.store(this.header!, packet.slot * 2 + 1, length);
        Atomics.store(this.header!, packet.slot * 2, packet.ticket);
        this.telemetry.sharedPublished++;
      }
      this.port.post(
        {
          kind: 'frame',
          ...packet,
          sequence,
          viewport: token.metrics.viewportGeneration,
          context: token.metrics.nativeContextGeneration,
          ...(batch ? { resources: batch.resources } : {}),
        },
        transfer,
      );
      if (batch) this.telemetry.framesWithRegistration++;
      if (packet.transport === 'transfer' && packet.buffer.byteLength === 0)
        this.telemetry.buffersDetached++;
    } catch (error) {
      // The frame may have crossed the boundary. Keep the lease through termination.
      this.fail(new RenderWorkerError('worker-frame', String(error)));
    }
    this.events.accepted(sequence, token);
    this.telemetry.accepted++;
    this.watch();
    return { status: 'accepted', submission: sequence };
  }

  private message(message: RenderReply): void {
    if (this.failed || this.closing) return;
    switch (message.kind) {
      case 'registered': {
        const frame =
          message.sequence === undefined ? undefined : this.pending.get(message.sequence);
        if (
          (message.sequence !== undefined && !frame) ||
          this.registrationStarted === undefined ||
          !Number.isFinite(message.durationMs) ||
          message.durationMs < 0
        )
          throw new Error('Invalid Web render registration timing or frame');
        this.resources.registered(message);
        this.telemetry.sample('registrationAck', performance.now() - this.registrationStarted);
        this.telemetry.sample('workerRegistration', message.durationMs);
        for (const resource of message.resources)
          if (resource.nativeBytes !== undefined) this.telemetry.workerPictureCompilations++;
        frame?.diagnostics?.recordDuration(frame.token, 'web-worker-register', message.durationMs);
        this.registrationStarted = undefined;
        this.noteResourceBytes(this.resources.resourceBytes);
        if (message.sequence === undefined) this.submitPrepared();
        break;
      }
      case 'released':
        this.resources.released(message);
        this.noteResourceBytes(this.resources.resourceBytes);
        break;
      case 'consumed':
      case 'submitted':
      case 'retired':
        this.frameMessage(message);
        break;
      default:
        throw new Error('Unexpected Web render worker message');
    }
    this.watch();
  }

  private frameMessage(
    message: Extract<RenderReply, { kind: 'consumed' | 'submitted' | 'retired' }>,
  ): void {
    const frame = this.pending.get(message.sequence);
    if (!frame) return;
    const { diagnostics, token, packet } = frame;
    if (message.kind === 'consumed') {
      if (frame.consumed) throw new Error('Web render frame buffer returned twice');
      if (packet.transport === 'transfer') {
        if (
          !(message.buffer instanceof ArrayBuffer) ||
          message.buffer.byteLength !== frame.bufferCapacity
        )
          throw new Error('Web render worker returned an invalid transfer buffer');
        if (this.buffers.length < renderCapacity) this.buffers.push(message.buffer);
        this.telemetry.buffersReturned++;
      } else {
        if (message.slot !== packet.slot || Atomics.load(this.header!, packet.slot * 2) !== 0)
          throw new Error('Web render worker did not release the shared slot');
        this.slots[packet.slot] = false;
        this.telemetry.sharedConsumed++;
      }
      frame.consumed = true;
      return;
    }
    if (message.context !== token.metrics.nativeContextGeneration || !frame.consumed)
      throw new Error('Web render response has an invalid context generation or order');
    if (message.kind === 'submitted') {
      if (frame.submitted) throw new Error('Web render GPU submission repeated');
      frame.submitted = true;
      this.telemetry.sample('workerDecode', message.decodeMs);
      this.telemetry.sample('workerReplay', message.replayMs);
      this.telemetry.sample('workerSubmit', message.submitMs);
      this.telemetry.inputSubmitted(token, this.inputTimeOrigin, message.submittedAt);
      diagnostics?.recordDuration(token, 'web-worker-decode', message.decodeMs);
      diagnostics?.recordDuration(token, 'web-worker-replay', message.replayMs);
      diagnostics?.recordDuration(token, 'web-worker-submit', message.submitMs);
      return;
    }
    if (message.result === 'gpu-retired') {
      if (!frame.submitted) throw new Error('Web render fence arrived before GPU submission');
      this.telemetry.sample('fence', message.fenceMs);
      diagnostics?.recordDuration(token, 'web-worker-fence', message.fenceMs);
    }
    this.finish(message.sequence, frame, message.result);
  }

  private finish(
    sequence: number,
    frame: PendingFrame,
    result: 'gpu-retired' | 'discarded' | 'drained',
  ): void {
    this.pending.delete(sequence);
    try {
      frame.lease.returnBy('renderer');
    } finally {
      this.telemetry.retired(result);
      this.events.retired(sequence, result);
    }
  }

  close(graceful: boolean): Promise<void> {
    clearTimeout(this.watchdog);
    return (this.closing ??= (async () => {
      await this.port.close(graceful);
      const errors: unknown[] = [];
      for (const [sequence, frame] of this.pending)
        try {
          this.finish(sequence, frame, graceful ? 'drained' : 'discarded');
        } catch (error) {
          errors.push(error);
        }
      this.buffers.length = 0;
      this.resources.clear();
      this.noteResourceBytes(0);
      if (errors.length)
        throw new AggregateError(errors, 'Web render worker frame retirement failed');
    })());
  }
}
