// SPDX-License-Identifier: BSD-3-Clause
import type { CanvasKit } from 'canvaskit-wasm';
import { ResourceLease, ResourceRegistry } from '@nelyx/core/hosting/resources';
import {
  captureMetrics,
  disposeFrame,
  FrameDiagnostics,
  freezeFrame,
  isCurrent,
} from '@nelyx/core/ui/frame';
import { frameWireVersion } from '@nelyx/core/ui/frame-wire';
import {
  decodeWebFrame,
  maxWebFrameBytes,
  webFrameWireVersion,
} from '@nelyx/core/ui/web-frame-wire';
import type { PaintFrame, ViewMetrics, ViewOwner } from '@nelyx/core/ui/types';
import { WebSkiaLibrary, webBackingSize } from '@nelyx/skia-web/library';
import type { WebSkiaSurfaceOptions } from '@nelyx/skia-web/library';
import { CanvasKitIntegrityError } from './canvaskit-loader.ts';
import { loadWorkerCanvasKit } from './canvaskit-worker.ts';
import {
  renderCapacity,
  renderProtocolVersion,
  sameRenderSession,
  sharedBufferBytes,
  sharedHeaderWords,
  sharedProbeReply,
  sharedProbeRequest,
  sharedSlotBytes,
  workerBackingBytes,
} from './render-protocol.ts';
import type {
  RenderFailureStage,
  RenderRequest,
  RenderResponse,
  RenderSession,
} from './render-protocol.ts';
import { sharedArrayBufferConstructor } from './render-shared-memory.ts';
import { RenderResourceReceiver } from './render-worker-resources.ts';

const scope = globalThis as unknown as {
  readonly isSecureContext: boolean;
  readonly crossOriginIsolated: boolean;
  postMessage(message: unknown, transfer: Transferable[]): void;
  onmessage: ((event: MessageEvent<RenderRequest>) => void) | null;
  onmessageerror: (() => void) | null;
};
let session: RenderSession | undefined;
let options: WebSkiaSurfaceOptions;
let ck: CanvasKit | undefined;
let probed = false;
let failed = false;
let stopping = false;
let library: WebSkiaLibrary | undefined;
let registry: ResourceRegistry | undefined;
let resources: RenderResourceReceiver | undefined;
let canvas: OffscreenCanvas | undefined;
let shared: SharedArrayBuffer | undefined;
let metrics: ViewMetrics | undefined;
let visible = true;
let lastSequence = 0;
let queueTimer: ReturnType<typeof setTimeout> | undefined;
const queue: Extract<RenderRequest, { kind: 'frame' }>[] = [];
const submitted = new Map<number, number>();
const diagnostics = new FrameDiagnostics(performance, 8);

function reply(response: RenderResponse, transfer: Transferable[] = []): void {
  scope.postMessage({ ...session!, ...response }, transfer);
}
function fault(stage: RenderFailureStage, error: unknown): void {
  if (failed || !session) return;
  failed = true;
  clearTimeout(queueTimer);
  reply({
    kind: 'fault',
    stage,
    reason: (error instanceof Error ? error.message : String(error)).slice(0, 512),
    ...(error instanceof CanvasKitIntegrityError ? { integrity: true as const } : {}),
  });
}
function contextLost(event: Event): void {
  event.preventDefault();
  fault('worker-context-loss', new Error('Worker WebGL2 context lost'));
}

async function probeGpu(ck: CanvasKit, owner: ViewOwner): Promise<void> {
  const canvas = new OffscreenCanvas(8, 8),
    probe = new WebSkiaLibrary(ck, canvas, owner, { preserveDrawingBuffer: true }),
    metrics: ViewMetrics = {
      logicalWidth: 8,
      logicalHeight: 8,
      physicalWidth: 8,
      physicalHeight: 8,
      scale: 1,
      viewportGeneration: 1,
      rendererGeneration: 1,
      nativeContextGeneration: 1,
      nativeSurfaceGeneration: 1,
    },
    frame = freezeFrame({ owner, metrics, sequence: 1 }, [{ op: 'clear', color: 0xffd41824 }]);
  try {
    probe.updateMetrics(metrics);
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Probe GPU fence timeout')), 5500);
      const observation = probe.observe((event) => {
        if (event.kind === 'failed') reject(new Error(event.reason));
        if (event.kind === 'retired') resolve();
        if (event.kind !== 'submitted') {
          clearTimeout(timer);
          observation.dispose();
        }
      });
      try {
        if (probe.submit(frame, new ResourceLease([], () => {})).status !== 'accepted')
          throw new Error('Probe frame rejected');
      } catch (error) {
        clearTimeout(timer);
        observation.dispose();
        reject(error);
      }
    });
    const gl = canvas.getContext('webgl2') as WebGL2RenderingContext,
      pixel = new Uint8Array(4);
    gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel);
    if (!pixel.every((value, index) => value === [212, 24, 36, 255][index]))
      throw new Error('Worker WebGL2 probe pixel mismatch');
  } finally {
    disposeFrame(frame);
    await probe.dispose();
  }
}

async function probe(request: Extract<RenderRequest, { kind: 'probe' }>): Promise<void> {
  if (session) return;
  session = { owner: request.owner, generation: request.generation };
  options = request.options;
  if (
    typeof request.owner?.id !== 'string' ||
    !request.owner.id ||
    !Number.isSafeInteger(request.owner.generation) ||
    request.owner.generation < 1 ||
    !Number.isSafeInteger(request.generation) ||
    request.generation < 1 ||
    request.protocol !== renderProtocolVersion ||
    request.frameWire !== frameWireVersion ||
    request.webFrameWire !== webFrameWireVersion
  ) {
    fault('worker-protocol', new Error('Incompatible Web renderer protocol or frame wire version'));
    return;
  }
  let stage: RenderFailureStage = 'worker-runtime';
  try {
    reply({ kind: 'stage', stage });
    ck = await loadWorkerCanvasKit(new URL(request.root), request.manifest, request.assets);
    stage = 'worker-webgl2';
    reply({ kind: 'stage', stage });
    await probeGpu(ck, request.owner);
    probed = true;
    reply({ kind: 'ready', isolated: scope.crossOriginIsolated === true });
  } catch (error) {
    fault(stage, error);
  }
}

function checkShared(request: Extract<RenderRequest, { kind: 'check-shared' }>): void {
  if (!probed || library) throw new Error('Unexpected Web shared memory probe');
  let accepted = false;
  if (scope.isSecureContext && scope.crossOriginIsolated) {
    try {
      const SharedBuffer = sharedArrayBufferConstructor(globalThis);
      if (
        !(request.probe instanceof SharedBuffer) ||
        !(request.buffer instanceof SharedBuffer) ||
        request.buffer.byteLength !== sharedBufferBytes
      )
        throw new Error('Invalid Web render shared buffer');
      const slot = new Int32Array(request.probe);
      if (slot.length === 1 && Atomics.load(slot, 0) === sharedProbeRequest) {
        Atomics.store(slot, 0, sharedProbeReply);
        shared = request.buffer;
        accepted = true;
      }
    } catch {
      shared = undefined;
    }
  }
  reply({ kind: 'checked-shared', shared: accepted });
}

function attach(request: Extract<RenderRequest, { kind: 'attach' }>): void {
  if (!probed || !ck || library || !(request.canvas instanceof OffscreenCanvas))
    throw new Error('Unexpected Web render canvas attachment');
  if (request.useShared && !shared) throw new Error('Web render slots were not prepared');
  if (!request.useShared) shared = undefined;
  canvas = request.canvas;
  library = new WebSkiaLibrary(ck, canvas, request.owner, options);
  registry = new ResourceRegistry();
  resources = new RenderResourceReceiver(library, registry);
  library.bind(registry);
  canvas.addEventListener('webglcontextlost', contextLost);
  library.prepareDisplay();
  library.observe((event) => {
    if (stopping || failed || event.kind === 'submitted') return;
    if (event.kind === 'failed') {
      const lost = (canvas?.getContext('webgl2') as WebGL2RenderingContext | null)?.isContextLost();
      fault(lost ? 'worker-context-loss' : 'worker-frame', new Error(event.reason));
      return;
    }
    const started = submitted.get(event.submission);
    if (started === undefined) {
      fault('worker-frame', new Error('Missing Web renderer GPU submission'));
      return;
    }
    submitted.delete(event.submission);
    reply({
      kind: 'retired',
      sequence: event.submission,
      context: event.token.metrics.nativeContextGeneration,
      result: event.result === 'gpu-retired' ? 'gpu-retired' : 'discarded',
      fenceMs: performance.now() - started,
    });
  });
  reply({ kind: 'attached' });
}

function setMetrics(next: ViewMetrics): void {
  const captured = captureMetrics(next);
  if (
    metrics &&
    (captured.viewportGeneration < metrics.viewportGeneration ||
      captured.rendererGeneration !== metrics.rendererGeneration ||
      captured.nativeContextGeneration !== metrics.nativeContextGeneration)
  )
    throw new Error('Stale Web render metrics');
  const { width, height } = webBackingSize(captured, options.maxRasterScale);
  if (width * height * 12 > workerBackingBytes) throw new Error('Web render backing memory budget');
  metrics = captured;
  library!.updateMetrics(captured);
}

function readPacket(request: Extract<RenderRequest, { kind: 'frame' }>): {
  bytes: Uint8Array;
  consume(): void;
} {
  const sequence = request.sequence;
  if (request.transport === 'transfer') {
    const { buffer, length } = request;
    if (
      !(buffer instanceof ArrayBuffer) ||
      !Number.isInteger(length) ||
      length <= 0 ||
      length > buffer.byteLength ||
      buffer.byteLength > maxWebFrameBytes
    )
      throw new Error('Invalid Web render transfer packet length');
    return {
      bytes: new Uint8Array(buffer, 0, length),
      consume: () => reply({ kind: 'consumed', sequence, buffer }, [buffer]),
    };
  }
  const { slot, ticket } = request;
  if (
    !shared ||
    !Number.isInteger(slot) ||
    slot < 0 ||
    slot >= renderCapacity ||
    !Number.isInteger(ticket) ||
    ticket < 1
  )
    throw new Error('Invalid Web render shared slot');
  const header = new Int32Array(shared, 0, sharedHeaderWords),
    at = slot * 2;
  if (Atomics.load(header, at) !== ticket)
    throw new Error('Web render shared slot has not been published');
  const length = Atomics.load(header, at + 1);
  if (length <= 0 || length > sharedSlotBytes)
    throw new Error('Invalid Web render shared packet length');
  return {
    bytes: new Uint8Array(shared, header.byteLength + slot * sharedSlotBytes, length),
    consume() {
      Atomics.store(header, at + 1, 0);
      Atomics.store(header, at, 0);
      reply({ kind: 'consumed', sequence, slot });
    },
  };
}

function draw(request: Extract<RenderRequest, { kind: 'frame' }>): void {
  const { sequence, viewport, context } = request;
  const packet = readPacket(request),
    start = performance.now();
  let frame: PaintFrame | undefined;
  try {
    if (
      visible &&
      metrics &&
      viewport === metrics.viewportGeneration &&
      context === metrics.nativeContextGeneration
    ) {
      frame = decodeWebFrame(packet.bytes, request.owner, resources!.resolve);
      const { token } = frame,
        next = token.metrics;
      if (
        token.sequence !== sequence ||
        !isCurrent(frame, request.owner, metrics) ||
        next.physicalWidth !== metrics.physicalWidth ||
        next.physicalHeight !== metrics.physicalHeight ||
        next.logicalWidth !== metrics.logicalWidth ||
        next.logicalHeight !== metrics.logicalHeight ||
        next.scale !== metrics.scale
      ) {
        disposeFrame(frame);
        throw new Error('Web render frame metadata mismatch');
      }
    }
  } finally {
    packet.consume();
  }
  if (!frame) {
    reply({ kind: 'retired', sequence, context, result: 'discarded', fenceMs: 0 });
    return;
  }
  const decoded = performance.now();
  const lease = registry!.acquire(frame.resources);
  try {
    if (library!.submit(frame, lease, diagnostics).status !== 'accepted') {
      lease.returnBy('caller');
      throw new Error('Worker rejected an admitted Web frame');
    }
    const sent = performance.now();
    submitted.set(sequence, sent);
    const samples = diagnostics.drain().samples;
    reply({
      kind: 'submitted',
      sequence,
      context,
      decodeMs: decoded - start,
      replayMs: samples.find((sample) => sample.stage === 'native-replay')?.duration ?? 0,
      submitMs: samples.find((sample) => sample.stage === 'native-submit')?.duration ?? 0,
      submittedAt: performance.timeOrigin + sent,
    });
  } finally {
    disposeFrame(frame);
  }
}
function checkFrame(sequence: number): void {
  if (
    !Number.isSafeInteger(sequence) ||
    sequence <= lastSequence ||
    queue.length + submitted.size >= renderCapacity
  )
    throw new Error('Invalid Web render frame sequence or capacity');
}
function register(
  batch: Parameters<RenderResourceReceiver['registerBatch']>[0],
  sequence?: number,
): void {
  const started = performance.now();
  const registered = resources!.registerBatch(batch);
  reply({
    kind: 'registered',
    resources: registered,
    bytes: resources!.resourceBytes,
    durationMs: performance.now() - started,
    ...(sequence === undefined ? {} : { sequence }),
  });
}
function enqueue(request: Extract<RenderRequest, { kind: 'frame' }>): void {
  lastSequence = request.sequence;
  queue.push(request);
  queueTimer ??= setTimeout(() => {
    queueTimer = undefined;
    try {
      while (queue.length && !failed && !stopping) draw(queue.shift()!);
    } catch (error) {
      const lost = (canvas?.getContext('webgl2') as WebGL2RenderingContext | null)?.isContextLost();
      fault(lost ? 'worker-context-loss' : 'worker-frame', error);
    }
  }, 0);
}
async function close(): Promise<void> {
  if (stopping) return;
  stopping = true;
  clearTimeout(queueTimer);
  queue.length = 0;
  canvas?.removeEventListener('webglcontextlost', contextLost);
  try {
    await library?.dispose();
    registry?.dispose();
    reply({ kind: 'closed' });
  } catch (error) {
    fault('worker-frame', error);
  }
}
scope.onmessageerror = () => {
  if (probed && !library && !failed && !stopping) {
    reply({ kind: 'checked-shared', shared: false });
    return;
  }
  fault('worker-protocol', new Error('Worker could not deserialize a render message'));
};
scope.onmessage = ({ data }) => {
  if (data.kind === 'probe') {
    void probe(data);
    return;
  }
  if (!session || !sameRenderSession(data, session) || stopping) return;
  if (data.kind === 'close') {
    void close();
    return;
  }
  if (failed) return;
  let stage: RenderFailureStage = 'worker-frame';
  try {
    if (data.kind === 'check-shared') {
      stage = 'shared-memory';
      checkShared(data);
      return;
    }
    if (data.kind === 'attach') {
      stage = 'worker-attach';
      attach(data);
      return;
    }
    if (!resources || !library) throw new Error('Web render canvas is not attached');
    switch (data.kind) {
      case 'metrics':
        setMetrics(data.metrics);
        break;
      case 'visibility':
        visible = data.visible;
        library.setVisible(visible);
        break;
      case 'register':
        stage = 'worker-resources';
        if (shared) throw new Error('Shared renderer registrations require a frame');
        register(data.resources);
        break;
      case 'release':
        stage = 'worker-resources';
        resources.release(data.resource);
        reply({ kind: 'released', resource: data.resource, bytes: resources.resourceBytes });
        break;
      case 'frame': {
        checkFrame(data.sequence);
        if (data.resources === undefined) {
          enqueue(data);
          break;
        }
        stage = 'worker-resources';
        if (!shared) throw new Error('Transfer renderer frames require prior registration');
        const { resources: batch, ...frame } = data;
        register(batch, frame.sequence);
        stage = 'worker-frame';
        enqueue(frame);
        break;
      }
    }
  } catch (error) {
    fault(stage, error);
  }
};
