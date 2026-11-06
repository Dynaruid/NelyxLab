// SPDX-License-Identifier: BSD-3-Clause
import {
  protocol as p,
  body,
  packet,
  response,
  inputBody,
  createPacketTransport,
} from '@nelyx/core/v2';
import type { EngineResponse, InputPacket, PacketEndpoint } from '@nelyx/core/v2';
import type { EngineV2Host } from './engine-v2.ts';
import { EngineV2BrowserInteraction } from './engine-v2-interaction.ts';

export type EngineWebProfile = 'auto' | 'single-worker' | 'threaded';
export interface EngineBrowserSurface {
  readonly host: EngineV2Host;
  readonly selectedProfile: 'single-worker' | 'threaded';
  readonly selectionReason: string;
  readonly diagnostics: Record<string, unknown>;
  readonly inputStats: {
    collected: number;
    dispatched: number;
    rejected: number;
    canceledStreams: number;
  };
  createAppPort(): MessagePort;
  delayContent(milliseconds: number): void;
  /** Requests a bounded cache policy change; diagnostics report actual owner acknowledgement. */
  setMemoryPressure(low: boolean): void;
  input(
    value: Omit<InputPacket, 'sequence' | 'metrics' | 'target' | 'stream' | 'time'>,
  ): Promise<boolean>;
  close(): Promise<Record<string, unknown>>;
}
function createMainFrameClock() {
  const channel = new MessageChannel();
  let ticket: number | undefined,
    animation: number | undefined,
    closed = false;
  const stats = {
    source: 'window-raf',
    requests: 0,
    callbacks: 0,
    cancellations: 0,
    outstanding: 0,
  };
  const cancel = () => {
    if (animation !== undefined) {
      cancelAnimationFrame(animation);
      ++stats.cancellations;
    }
    animation = undefined;
    ticket = undefined;
    stats.outstanding = 0;
  };
  channel.port1.addEventListener('message', (event: MessageEvent) => {
    if (closed) return;
    const value = event.data;
    if (value.kind === 'cancel') {
      if (value.id === ticket) cancel();
      return;
    }
    if (value.kind !== 'request' || !Number.isSafeInteger(value.id) || value.id <= 0) return;
    if (ticket !== undefined) {
      if (ticket !== value.id)
        channel.port1.postMessage({
          kind: 'error',
          id: value.id,
          message: 'Frame demand credit exceeded',
        });
      return;
    }
    ticket = value.id;
    ++stats.requests;
    stats.outstanding = 1;
    animation = requestAnimationFrame((time) => {
      if (closed || ticket !== value.id) return;
      animation = undefined;
      ticket = undefined;
      stats.outstanding = 0;
      ++stats.callbacks;
      channel.port1.postMessage({
        kind: 'frame',
        id: value.id,
        time,
        timeOrigin: performance.timeOrigin,
      });
    });
  });
  channel.port1.start();
  return {
    port: channel.port2,
    stats,
    close() {
      closed = true;
      cancel();
      channel.port1.close();
      channel.port2.close();
    },
  };
}
export async function createBrowserEngineV2Surface(
  canvas: HTMLCanvasElement,
  options: {
    root: URL;
    profile?: EngineWebProfile;
    requiredCapabilities?: number;
    onStats?(value: Record<string, unknown>): void;
    onError?(message: string): void;
  },
): Promise<EngineBrowserSurface> {
  const requested = options.profile ?? 'auto';
  if (!['auto', 'single-worker', 'threaded'].includes(requested))
    throw new Error('Invalid v2 Web profile');
  if (!['http:', 'https:'].includes(options.root.protocol) || !options.root.href.endsWith('/'))
    throw new Error('Engine asset root must be an HTTP directory');
  if (
    typeof Worker !== 'function' ||
    typeof OffscreenCanvas !== 'function' ||
    !canvas.transferControlToOffscreen
  )
    throw new Error('V2 requires Worker and transferable OffscreenCanvas');
  let shared = false;
  if (globalThis.crossOriginIsolated && typeof SharedArrayBuffer === 'function') {
    try {
      shared =
        new WebAssembly.Memory({ initial: 1, maximum: 1, shared: true }).buffer instanceof
        SharedArrayBuffer;
    } catch {
      /* Capability probe only; asset errors never switch profiles. */
    }
  }
  if (requested === 'threaded' && !shared)
    throw new Error('Threaded profile requires cross-origin isolation and shared Wasm memory');
  const selected = requested === 'auto' ? (shared ? 'threaded' : 'single-worker') : requested;
  const reason =
    requested === 'auto'
      ? shared
        ? 'isolated-shared-memory'
        : 'shared-memory-unavailable'
      : 'explicit-profile';
  const required = options.requiredCapabilities ?? p.capabilities.surface;
  if (required & p.capabilities.contentIndependent && selected !== 'threaded')
    throw new Error('Requested contentIndependent capability is unavailable');
  const worker = new Worker(new URL('web/coordinator.js', options.root));
  const frameClock = createMainFrameClock();
  let closed = false,
    sequence = 0n,
    pendingInputs = 0,
    latest: EngineResponse | undefined,
    appPorts = 0;
  let diagnostics: Record<string, unknown> = {
    requestedProfile: requested,
    selectedProfile: selected,
    selectionReason: reason,
    frameClockMain: frameClock.stats,
  };
  const inputStats = { collected: 0, dispatched: 0, rejected: 0, canceledStreams: 0 };
  let contentDelayPending = false,
    canceling = false,
    restarting = false;
  let requestedPressure = false,
    pressureRevision = 0,
    pressureApplied: boolean | undefined,
    pressurePending: { revision: number; low: boolean } | undefined,
    pressureFailed = false,
    pressureTimer: ReturnType<typeof setTimeout> | undefined;
  const pumpPressure = () => {
    const low = requestedPressure || document.visibilityState !== 'visible';
    if (closed || pressureFailed || pressurePending || pressureApplied === low) return;
    pressurePending = { revision: ++pressureRevision, low };
    worker.postMessage({
      kind: 'memory-pressure',
      revision: pressureRevision,
      low,
      source: document.visibilityState !== 'visible' ? 'hidden' : 'host',
    });
    pressureTimer = setTimeout(() => {
      pressureFailed = true;
      pressurePending = undefined;
      diagnostics = {
        ...diagnostics,
        memoryPressureError: 'Memory pressure owner acknowledgement timed out',
      };
      options.onError?.('Memory pressure owner acknowledgement timed out');
    }, 15000);
  };
  const needsBegin = new Set<number>();
  let resolveReady: (value: Record<string, unknown>) => void = () => {},
    rejectReady: (error: Error) => void = () => {};
  const ready = new Promise<Record<string, unknown>>((resolve, reject) => {
    resolveReady = resolve;
    rejectReady = reject;
  });
  let resolveClose: (value: Record<string, unknown>) => void = () => {},
    rejectClose: (error: Error) => void = () => {};
  const closingResult = new Promise<Record<string, unknown>>((resolve, reject) => {
    resolveClose = resolve;
    rejectClose = reject;
  });
  // The close result may be rejected before the caller starts awaiting close.
  void closingResult.catch(() => {});
  const endpoint: PacketEndpoint = {
    post: (value, transfer) => worker.postMessage(value, transfer),
    subscribe(callback) {
      const receive = (event: MessageEvent<unknown>) => callback(event.data);
      worker.addEventListener('message', receive);
      return () => worker.removeEventListener('message', receive);
    },
    close() {},
  };
  const transport = createPacketTransport(endpoint, 10000);
  const interaction = new EngineV2BrowserInteraction(canvas, transport.exchange, (message) =>
    options.onError?.(message),
  );
  const receive = (event: MessageEvent<Record<string, unknown>>) => {
    const message = event.data;
    if (message.kind === 'ready') resolveReady(message);
    else if (message.kind === 'stats') {
      diagnostics = { ...diagnostics, ...(message.value as object) };
      const state = (diagnostics['render-stats'] as { state?: EngineResponse } | undefined)?.state;
      if (state) latest = state;
      if (state?.publication) interaction.update();
      diagnostics = {
        ...diagnostics,
        interaction: { profile: interaction.profile, ...interaction.counters },
      };
      options.onStats?.(diagnostics);
      worker.postMessage({ kind: 'stats-ack' });
    } else if (message.kind === 'memory-pressure') {
      const pendingPressure = pressurePending;
      if (!pendingPressure || pendingPressure.revision !== message.revision) return;
      pressureApplied = pendingPressure.low;
      pressurePending = undefined;
      if (pressureTimer !== undefined) clearTimeout(pressureTimer);
      pressureTimer = undefined;
      diagnostics = { ...diagnostics, 'memory-pressure': message.value };
      options.onStats?.(diagnostics);
      pumpPressure();
    } else if (message.kind === 'ui-packet') {
      const bytes = message.bytes as ArrayBuffer;
      void interaction.gateway(new Uint8Array(bytes)).then(
        (result) =>
          worker.postMessage({ kind: 'ui-result', id: message.id, bytes: result.buffer }, [
            result.buffer as ArrayBuffer,
          ]),
        (error) => worker.postMessage({ kind: 'ui-result', id: message.id, error: String(error) }),
      );
    } else if (message.kind === 'content-control') {
      const value = message.value as Record<string, unknown>;
      diagnostics = { ...diagnostics, [String(value.kind)]: value };
      if (value.kind === 'delay-ended') contentDelayPending = false;
      options.onStats?.(diagnostics);
    } else if (message.kind === 'closed') resolveClose(message.state as Record<string, unknown>);
    else if (message.kind === 'error' || message.kind === 'runtime-error') {
      const error = new Error(String(message.message));
      rejectReady(error);
      rejectClose(error);
      options.onError?.(error.message);
    }
  };
  const failed = (event: ErrorEvent) => {
    const error = new Error(event.message || 'Engine worker failed');
    rejectReady(error);
    rejectClose(error);
    options.onError?.(error.message);
  };
  worker.addEventListener('message', receive);
  worker.addEventListener('error', failed);
  const viewport = () => ({
    width: canvas.clientWidth,
    height: canvas.clientHeight,
    scale: window.devicePixelRatio || 1,
    visible: document.visibilityState === 'visible',
    focused: document.hasFocus(),
  });
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const offscreen = canvas.transferControlToOffscreen();
    worker.postMessage(
      {
        kind: 'initialize',
        root: options.root.href,
        profile: selected,
        canvas: offscreen,
        viewport: viewport(),
        frameClock: frameClock.port,
      },
      [offscreen, frameClock.port],
    );
    await Promise.race([
      ready,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error('Engine owner READY timed out')), 20000);
      }),
    ]);
    const hello = response(
      await transport.exchange(
        packet(
          p.opcodes.hello,
          { session: 1, app: 1, view: 0, generation: 0 },
          body(8, (v) => v.setUint32(0, required, true)),
        ),
      ),
    );
    if (hello.status !== p.statuses.ok || (hello.capabilities & required) !== required)
      throw new Error('Engine surface capability handshake rejected');
  } catch (error) {
    frameClock.close();
    transport.close();
    worker.terminate();
    worker.removeEventListener('message', receive);
    worker.removeEventListener('error', failed);
    throw error;
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
  const owner = { session: 1, app: 1, view: 1, generation: 1 };
  type InputValue = Omit<InputPacket, 'sequence' | 'metrics' | 'target' | 'stream' | 'time'> & {
    readonly stream?: number;
    readonly collectedMetrics?: bigint;
    readonly collectedTime?: number;
  };
  const liveInputs = new Map<number, InputValue>();
  const sendInput = async (value: InputValue): Promise<EngineResponse> => {
    const state = response(
      await transport.exchange(
        packet(
          p.opcodes.input,
          owner,
          inputBody({
            ...value,
            sequence: ++sequence,
            metrics: value.collectedMetrics ?? latest!.metrics,
            publication: value.publication ?? latest!.publication,
            target: { slot: 0, generation: 0 },
            stream: value.stream ?? 1,
            time: value.collectedTime ?? performance.now() / 1000,
          }),
        ),
      ),
    );
    if (state.status !== p.statuses.ok) throw new Error('Engine input rejected: ' + state.status);
    latest = state;
    return state;
  };
  const input = async (value: InputValue): Promise<boolean> => {
    value = {
      ...value,
      publication: latest?.publication ?? 0n,
      collectedMetrics: latest?.metrics ?? 0n,
      collectedTime: performance.now() / 1000,
    };
    ++inputStats.collected;
    const stream = value.stream ?? 1;
    if (!value.hover) liveInputs.set(stream, value);
    if (
      closed ||
      !latest ||
      latest.closed ||
      canceling ||
      restarting ||
      pendingInputs >= 24 ||
      latest.sessionQueued + pendingInputs >= (value.phase === 'update' ? 224 : 256)
    ) {
      ++inputStats.rejected;
      if (!value.hover) needsBegin.add(stream);
      if (!closed && latest && !latest.closed && !canceling && !restarting) {
        canceling = true;
        const canceled = [...liveInputs.values()];
        liveInputs.clear();
        for (const input of canceled) needsBegin.add(input.stream ?? 1);
        ++pendingInputs;
        void Promise.all(
          canceled.map((input) =>
            sendInput({
              ...input,
              phase: 'cancel',
              dx: 0,
              dy: 0,
              velocity: 0,
              publication: latest!.publication,
              collectedMetrics: latest!.metrics,
              collectedTime: performance.now() / 1000,
            }),
          ),
        )
          .then(() => {
            ++inputStats.canceledStreams;
          })
          .catch(() => {})
          .finally(() => {
            canceling = false;
            --pendingInputs;
          });
      }
      return false;
    }
    ++pendingInputs;
    try {
      if (needsBegin.has(stream) && (value.phase === 'end' || value.phase === 'cancel')) {
        liveInputs.delete(stream);
        needsBegin.delete(stream);
        return false;
      }
      if (needsBegin.has(stream) && !value.hover && value.phase !== 'begin') {
        restarting = true;
        await sendInput({ ...value, phase: 'begin', dx: 0, dy: 0, velocity: 0 });
        restarting = false;
      }
      if (!value.hover) needsBegin.delete(stream);
      await sendInput(value);
      if (value.phase === 'end' || value.phase === 'cancel') liveInputs.delete(stream);
      ++inputStats.dispatched;
      return true;
    } catch {
      ++inputStats.rejected;
      return false;
    } finally {
      restarting = false;
      --pendingInputs;
    }
  };
  let resizeFrame = 0;
  const update = () => {
    if (closed || resizeFrame) return;
    resizeFrame = requestAnimationFrame(() => {
      resizeFrame = 0;
      if (!closed) worker.postMessage({ kind: 'viewport', viewport: viewport() });
    });
  };
  const resize = new ResizeObserver(update);
  resize.observe(canvas);
  const visibility = () => {
    if (!closed) {
      pumpPressure();
      worker.postMessage({ kind: 'viewport', viewport: viewport() });
    }
  };
  document.addEventListener('visibilitychange', visibility);
  window.addEventListener('focus', visibility);
  window.addEventListener('blur', visibility);
  const wheel = (event: WheelEvent) => {
    event.preventDefault();
    const rect = canvas.getBoundingClientRect();
    const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? canvas.clientHeight : 1;
    void input({
      phase: 'update',
      source: 'wheelUnknown',
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
      dx: event.deltaX * unit,
      dy: event.deltaY * unit,
    });
  };
  const pointers = new Map<
    number,
    { stream: number; x: number; y: number; at: number; velocity: number }
  >();
  const isEditor = (event: PointerEvent) =>
    event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement;
  const down = (event: PointerEvent) => {
    if (
      isEditor(event) ||
      pointers.has(event.pointerId) ||
      pointers.size >= 15 ||
      event.button !== 0
    )
      return;
    if (event.target === canvas) canvas.focus();
    let stream = 2;
    while ([...pointers.values()].some((value) => value.stream === stream)) ++stream;
    canvas.setPointerCapture(event.pointerId);
    const rect = canvas.getBoundingClientRect();
    pointers.set(event.pointerId, {
      stream,
      x: event.clientX,
      y: event.clientY,
      at: performance.now(),
      velocity: 0,
    });
    void input({
      stream,
      pointer: true,
      kind:
        event.pointerType === 'mouse'
          ? 'mouse'
          : event.pointerType === 'touch'
            ? 'touch'
            : event.pointerType === 'pen'
              ? 'stylus'
              : 'unknown',
      phase: 'begin',
      source: 'engineDriven',
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
      buttons: event.buttons,
      contact: event.pointerId,
    });
  };
  const move = (event: PointerEvent) => {
    if (isEditor(event)) return;
    const pointer = pointers.get(event.pointerId);
    const rect = canvas.getBoundingClientRect(),
      now = performance.now();
    if (!pointer) {
      void input({
        pointer: true,
        kind:
          event.pointerType === 'mouse'
            ? 'mouse'
            : event.pointerType === 'touch'
              ? 'touch'
              : event.pointerType === 'pen'
                ? 'stylus'
                : 'unknown',
        hover: true,
        phase: 'update',
        source: 'engineDriven',
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
      });
      return;
    }
    const dy = pointer.y - event.clientY;
    pointer.velocity = dy / Math.max(0.001, (now - pointer.at) / 1000);
    void input({
      stream: pointer.stream,
      pointer: true,
      kind:
        event.pointerType === 'mouse'
          ? 'mouse'
          : event.pointerType === 'touch'
            ? 'touch'
            : event.pointerType === 'pen'
              ? 'stylus'
              : 'unknown',
      phase: 'update',
      source: 'engineDriven',
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
      dx: pointer.x - event.clientX,
      dy,
      velocity: pointer.velocity,
      buttons: event.buttons,
      contact: event.pointerId,
    });
    pointer.x = event.clientX;
    pointer.y = event.clientY;
    pointer.at = now;
  };
  const end = (event: PointerEvent) => {
    const pointer = pointers.get(event.pointerId);
    if (!pointer) return;
    pointers.delete(event.pointerId);
    const rect = canvas.getBoundingClientRect();
    void input({
      stream: pointer.stream,
      pointer: true,
      kind:
        event.pointerType === 'mouse'
          ? 'mouse'
          : event.pointerType === 'touch'
            ? 'touch'
            : event.pointerType === 'pen'
              ? 'stylus'
              : 'unknown',
      phase: event.type === 'pointerup' ? 'end' : 'cancel',
      source: 'engineDriven',
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
      velocity: performance.now() - pointer.at > 80 ? 0 : pointer.velocity,
      contact: event.pointerId,
    });
  };
  const leave = (event: PointerEvent) => {
    if (!pointers.size) {
      const rect = canvas.getBoundingClientRect(),
        inside =
          event.clientX >= rect.left &&
          event.clientX < rect.right &&
          event.clientY >= rect.top &&
          event.clientY < rect.bottom,
        relatedSurface =
          event.relatedTarget === canvas || interaction.ownsTarget(event.relatedTarget);
      void input({
        pointer: true,
        kind:
          event.pointerType === 'mouse'
            ? 'mouse'
            : event.pointerType === 'touch'
              ? 'touch'
              : event.pointerType === 'pen'
                ? 'stylus'
                : 'unknown',
        hover: true,
        phase: 'update',
        source: 'engineDriven',
        x: inside && relatedSurface ? event.clientX - rect.left : -1,
        y: inside && relatedSurface ? event.clientY - rect.top : -1,
      });
    }
  };
  const overlayLeave = (event: PointerEvent) => {
    if (interaction.ownsTarget(event.target)) leave(event);
  };
  canvas.addEventListener('pointerleave', leave);
  document.addEventListener('pointerleave', overlayLeave, true);
  canvas.style.touchAction = 'none';
  canvas.tabIndex = 0;
  canvas.addEventListener('wheel', wheel, { passive: false });
  const overlayWheel = (event: WheelEvent) => {
    const target = event.target as Element | null;
    if (interaction.ownsTarget(target)) wheel(event);
  };
  document.addEventListener('wheel', overlayWheel, { passive: false });
  canvas.addEventListener('pointerdown', down);
  canvas.addEventListener('pointermove', move);
  canvas.addEventListener('pointerup', end);
  canvas.addEventListener('pointercancel', end);
  canvas.addEventListener('lostpointercapture', end);
  const overlayPointer = (event: PointerEvent) => {
    if (!interaction.ownsTarget(event.target)) return;
    if (event.type === 'pointerdown') down(event);
    else if (event.type === 'pointermove') move(event);
    else end(event);
  };
  document.addEventListener('pointerdown', overlayPointer);
  document.addEventListener('pointermove', overlayPointer);
  document.addEventListener('pointerup', overlayPointer);
  document.addEventListener('pointercancel', overlayPointer);
  pumpPressure();
  return {
    host: {
      identity: { engine: 'v2', abiMajor: p.abiMajor, schema: p.schema },
      exchange: transport.exchange,
      close: () => transport.close(),
    },
    selectedProfile: selected,
    selectionReason: reason,
    get diagnostics() {
      return diagnostics;
    },
    inputStats,
    input,
    setMemoryPressure(low) {
      if (closed || pressureFailed) throw new Error('Engine pressure control is closed');
      if (typeof low !== 'boolean') throw new TypeError('Memory pressure must be boolean');
      requestedPressure = low;
      pumpPressure();
    },
    createAppPort() {
      if (closed || ++appPorts > 8) throw new Error('App port budget exceeded');
      const channel = new MessageChannel();
      worker.postMessage({ kind: 'port', port: channel.port2 }, [channel.port2]);
      return channel.port1;
    },
    delayContent(milliseconds) {
      if (closed) throw new Error('Engine surface closed');
      if (contentDelayPending) throw new Error('Content delay is already pending');
      if (!Number.isFinite(milliseconds) || milliseconds < 0 || milliseconds > 2000)
        throw new Error('Content delay must be within 0..2000 ms');
      contentDelayPending = true;
      worker.postMessage({
        kind: 'delay-content',
        milliseconds: Math.min(2000, Math.max(0, milliseconds)),
      });
    },
    async close() {
      if (closed) return diagnostics;
      closed = true;
      if (pressureTimer !== undefined) clearTimeout(pressureTimer);
      pressurePending = undefined;
      resize.disconnect();
      if (resizeFrame) cancelAnimationFrame(resizeFrame);
      document.removeEventListener('visibilitychange', visibility);
      window.removeEventListener('focus', visibility);
      window.removeEventListener('blur', visibility);
      canvas.removeEventListener('wheel', wheel);
      document.removeEventListener('wheel', overlayWheel);
      canvas.removeEventListener('pointerleave', leave);
      document.removeEventListener('pointerleave', overlayLeave, true);
      canvas.removeEventListener('pointerdown', down);
      canvas.removeEventListener('pointermove', move);
      canvas.removeEventListener('pointerup', end);
      canvas.removeEventListener('pointercancel', end);
      canvas.removeEventListener('lostpointercapture', end);
      document.removeEventListener('pointerdown', overlayPointer);
      document.removeEventListener('pointermove', overlayPointer);
      document.removeEventListener('pointerup', overlayPointer);
      document.removeEventListener('pointercancel', overlayPointer);
      pointers.clear();
      let timeout: ReturnType<typeof setTimeout> | undefined;
      try {
        await interaction.close();
        worker.postMessage({ kind: 'close' });
        const state = await Promise.race([
          closingResult,
          new Promise<never>((_, reject) => {
            timeout = setTimeout(() => reject(new Error('Surface close timed out')), 15000);
          }),
        ]);
        diagnostics = { ...diagnostics, closed: state };
        return state;
      } finally {
        if (timeout !== undefined) clearTimeout(timeout);
        frameClock.close();
        transport.close();
        worker.removeEventListener('message', receive);
        worker.removeEventListener('error', failed);
        worker.terminate();
      }
    },
  };
}
