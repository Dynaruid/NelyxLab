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
  input(
    value: Omit<InputPacket, 'sequence' | 'metrics' | 'target' | 'stream' | 'time'>,
  ): Promise<boolean>;
  close(): Promise<Record<string, unknown>>;
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
  let closed = false,
    sequence = 0n,
    pendingInputs = 0,
    latest: EngineResponse | undefined,
    appPorts = 0;
  let diagnostics: Record<string, unknown> = {
    requestedProfile: requested,
    selectedProfile: selected,
    selectionReason: reason,
  };
  const inputStats = { collected: 0, dispatched: 0, rejected: 0, canceledStreams: 0 };
  let contentDelayPending = false,
    canceling = false,
    restarting = false,
    needsBegin = false;
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
  const offscreen = canvas.transferControlToOffscreen();
  worker.postMessage(
    {
      kind: 'initialize',
      root: options.root.href,
      profile: selected,
      canvas: offscreen,
      viewport: viewport(),
    },
    [offscreen],
  );
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
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
    transport.close();
    worker.terminate();
    worker.removeEventListener('message', receive);
    worker.removeEventListener('error', failed);
    throw error;
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
  const owner = { session: 1, app: 1, view: 1, generation: 1 };
  type InputValue = Omit<InputPacket, 'sequence' | 'metrics' | 'target' | 'stream' | 'time'>;
  const sendInput = async (value: InputValue): Promise<EngineResponse> => {
    const state = response(
      await transport.exchange(
        packet(
          p.opcodes.input,
          owner,
          inputBody({
            ...value,
            sequence: ++sequence,
            metrics: latest!.metrics,
            target: { slot: 0, generation: 0 },
            stream: 1,
            time: performance.now() / 1000,
          }),
        ),
      ),
    );
    if (state.status !== p.statuses.ok) throw new Error('Engine input rejected: ' + state.status);
    latest = state;
    return state;
  };
  const input = async (
    value: Omit<InputPacket, 'sequence' | 'metrics' | 'target' | 'stream' | 'time'>,
  ): Promise<boolean> => {
    ++inputStats.collected;
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
      if (!closed && latest && !latest.closed && !canceling && !restarting) {
        canceling = true;
        needsBegin = true;
        ++pendingInputs;
        void sendInput({ ...value, phase: 'cancel', dx: 0, dy: 0, velocity: 0 })
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
      if (needsBegin && value.phase !== 'begin') {
        restarting = true;
        await sendInput({ ...value, phase: 'begin', dx: 0, dy: 0, velocity: 0 });
        restarting = false;
      }
      needsBegin = false;
      await sendInput(value);
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
    if (!closed) worker.postMessage({ kind: 'viewport', viewport: viewport() });
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
  let pointer: number | undefined,
    lastY = 0,
    lastX = 0,
    lastTime = 0,
    velocity = 0;
  const down = (event: PointerEvent) => {
    if (pointer !== undefined) return;
    canvas.focus();
    pointer = event.pointerId;
    canvas.setPointerCapture(pointer);
    const rect = canvas.getBoundingClientRect();
    lastY = event.clientY;
    lastX = event.clientX;
    lastTime = performance.now();
    velocity = 0;
    void input({
      phase: 'begin',
      source: 'engineDriven',
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
      buttons: event.buttons,
      contact: event.pointerId,
    });
  };
  const move = (event: PointerEvent) => {
    if (pointer !== event.pointerId) return;
    const rect = canvas.getBoundingClientRect(),
      now = performance.now(),
      dy = lastY - event.clientY;
    velocity = dy / Math.max(0.001, (now - lastTime) / 1000);
    void input({
      phase: 'update',
      source: 'engineDriven',
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
      dx: lastX - event.clientX,
      dy,
      velocity,
      buttons: event.buttons,
      contact: event.pointerId,
    });
    lastX = event.clientX;
    lastY = event.clientY;
    lastTime = now;
  };
  const end = (event: PointerEvent) => {
    if (pointer !== event.pointerId) return;
    pointer = undefined;
    const rect = canvas.getBoundingClientRect();
    void input({
      phase: event.type === 'pointercancel' ? 'cancel' : 'end',
      source: 'engineDriven',
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
      velocity,
      contact: event.pointerId,
    });
  };
  canvas.style.touchAction = 'none';
  canvas.tabIndex = 0;
  canvas.addEventListener('wheel', wheel, { passive: false });
  const overlayWheel = (event: WheelEvent) => {
    const target = event.target as Element | null;
    if (target?.closest('[data-nelyx-v2-semantics]')) wheel(event);
  };
  document.addEventListener('wheel', overlayWheel, { passive: false });
  canvas.addEventListener('pointerdown', down);
  canvas.addEventListener('pointermove', move);
  canvas.addEventListener('pointerup', end);
  canvas.addEventListener('pointercancel', end);
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
      resize.disconnect();
      if (resizeFrame) cancelAnimationFrame(resizeFrame);
      document.removeEventListener('visibilitychange', visibility);
      window.removeEventListener('focus', visibility);
      window.removeEventListener('blur', visibility);
      canvas.removeEventListener('wheel', wheel);
      document.removeEventListener('wheel', overlayWheel);
      canvas.removeEventListener('pointerdown', down);
      canvas.removeEventListener('pointermove', move);
      canvas.removeEventListener('pointerup', end);
      canvas.removeEventListener('pointercancel', end);
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
        transport.close();
        worker.removeEventListener('message', receive);
        worker.removeEventListener('error', failed);
        worker.terminate();
      }
    },
  };
}
