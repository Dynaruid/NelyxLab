// SPDX-License-Identifier: BSD-3-Clause
import { protocol as p, packet, response } from '../../../runtime/engine-client/index.ts';
import { CanvasKitProvider } from '../../render/canvaskit-web/provider.ts';
import type { PreparedPictures, WebManifest } from '../../render/canvaskit-web/provider.ts';
import { ContentActor, RenderActor, preparedTransfers } from './actors.ts';
import type { Viewport } from './actors.ts';
import { exchange, failure, script, verified, sessionOwner } from './common.ts';
import type { BrowserModule } from './common.ts';

const scope = globalThis as unknown as DedicatedWorkerGlobalScope;
type ClientPort = MessagePort | DedicatedWorkerGlobalScope;
let module: BrowserModule,
  engine = 0,
  profile = '',
  root = '',
  viewport: Viewport;
let content: ContentActor | undefined,
  render: RenderActor | undefined,
  provider: CanvasKitProvider | undefined;
let contentWorker: Worker | undefined, renderWorker: Worker | undefined;
let closing = false,
  next = 0,
  telemetryPending = false,
  telemetry: Record<string, unknown> | undefined;
let pendingBytes = 0;
const pending = new Map<number, { port: ClientPort; id: number; bytes: number; op: number }>();
const ready = new Set<number>(),
  stopped = new Set<number>();
let contentThread = 0,
  renderThread = 0,
  attached = false;
const ports = new Set<MessagePort>();
let telemetryRevision = 0,
  sentRevision = 0;
let failed = false;
const post = (value: Record<string, unknown>) => scope.postMessage(value);
function failHost(message: string, stack?: string): void {
  if (failed) return;
  failed = true;
  closing = true;
  content?.stop();
  void render
    ?.stop()
    .then(() => provider?.close())
    .catch(() => {});
  module?.PThread?.terminateAllThreads();
  for (const request of pending.values())
    send(request.port, { kind: 'packet-result', id: request.id, error: message });
  pending.clear();
  pendingBytes = 0;
  post({ kind: 'error', message, stack });
}
function stats(value: Record<string, unknown>): void {
  telemetry = {
    ...telemetry,
    ...value,
    selectedProfile: profile,
    contentIndependent: profile === 'threaded',
  };
  ++telemetryRevision;
  if (!telemetryPending) {
    telemetryPending = true;
    sentRevision = telemetryRevision;
    post({ kind: 'stats', value: telemetry });
  }
}
function send(
  port: ClientPort,
  value: Record<string, unknown>,
  transfer: ArrayBuffer[] = [],
): void {
  port.postMessage(value, transfer);
}
function actorMessage(value: Record<string, unknown>, transfer: ArrayBuffer[] = []): void {
  const kind = value.kind;
  if (
    closing &&
    kind !== 'owner-stopped' &&
    kind !== 'provider-error' &&
    kind !== 'nelyx-v2-owner-error'
  )
    return;
  if (kind === 'provider-error' || kind === 'nelyx-v2-owner-error') {
    failHost(String(value.message));
    return;
  }
  if (kind === 'owner-ready') {
    const role = Number(value.role),
      thread = Number(value.thread);
    if (value.heapShared !== true || value.providerShared !== false)
      throw new Error('Owner module memory kind mismatch');
    ready.add(role);
    if (role === 1) contentThread = thread;
    else renderThread = thread;
    if (role === 2) {
      renderWorker!.postMessage({ kind: 'v2-attach', canvas: initialCanvas, viewport }, [
        initialCanvas!,
      ]);
      initialCanvas = undefined;
    }
    stats({ [role === 1 ? 'content' : 'render']: value });
    maybeReady();
  } else if (kind === 'render-attached') {
    attached = true;
    stats({ gl: value.gl });
    maybeReady();
  } else if (kind === 'prepared') {
    const packet = value.packet as PreparedPictures;
    if (closing) return;
    if (render) render.prepared(packet);
    else
      renderWorker!.postMessage(
        { kind: 'v2-prepared', packet },
        transfer.length ? transfer : preparedTransfers(packet),
      );
  } else if (kind === 'content-wake') {
    if (content) content.kick();
    else contentWorker?.postMessage({ kind: 'v2-wake' });
  } else if (kind === 'owner-stopped') {
    stopped.add(Number(value.role));
    stats({ [Number(value.role) === 1 ? 'contentClosed' : 'renderClosed']: value.counters });
  } else if (
    kind === 'render-stats' ||
    kind === 'content-stats' ||
    kind === 'delay-started' ||
    kind === 'delay-ended'
  ) {
    if (kind === 'delay-started' || kind === 'delay-ended')
      post({ kind: 'content-control', value });
    stats({ [String(kind)]: value });
  }
}
let initialCanvas: OffscreenCanvas | undefined;
let announced = false;
function maybeReady(): void {
  if (announced || !attached || ready.size !== 2) return;
  if (profile === 'threaded' && contentThread === renderThread)
    throw new Error('Content and Render owners share one pthread');
  const status = module._nelyx_wasm_connect(
    engine,
    profile === 'threaded' ? 1 : 0,
    contentThread,
    renderThread,
  );
  if (status) throw new Error('Engine provider connection rejected: ' + status);
  announced = true;
  post({
    kind: 'ready',
    identity: { engine: 'v2', abiMajor: p.abiMajor, schema: p.schema },
    selectedProfile: profile,
    contentOwner: contentThread,
    renderOwner: renderThread,
    contentIndependent: profile === 'threaded',
    canvasKit: '0.41.0/full',
    memoryShared:
      typeof SharedArrayBuffer !== 'undefined' && module.HEAPU8.buffer instanceof SharedArrayBuffer,
  });
}
function cppString(text: string): number {
  const size = module.lengthBytesUTF8(text) + 1,
    pointer = module._malloc(size);
  if (!pointer) throw new Error('Owner configuration allocation failed');
  module.stringToUTF8(text, pointer, size);
  return pointer;
}
async function initialize(message: {
  root: string;
  profile: string;
  canvas: OffscreenCanvas;
  viewport: Viewport;
}): Promise<void> {
  root = message.root;
  profile = message.profile;
  viewport = message.viewport;
  initialCanvas = message.canvas;
  const manifest = (await (
    await fetch(new URL('engine-manifest.json', root))
  ).json()) as WebManifest;
  if (manifest.abi.major !== p.abiMajor || manifest.abi.schema !== p.schema)
    throw new Error('Engine bundle/host major/schema mismatch');
  const name = profile + '/engine-browser.js',
    entry = manifest.files.find((f) => f.path === name);
  if (!entry) throw new Error('Selected engine profile is not supplied');
  await script(await verified(root, entry));
  const factory = (
    globalThis as unknown as { NelyxEngineModule: (options: unknown) => Promise<BrowserModule> }
  ).NelyxEngineModule;
  if (!factory) throw new Error('Engine module factory missing');
  const wasmEntry = manifest.files.find((f) => f.path === profile + '/engine-browser.wasm');
  if (!wasmEntry) throw new Error('Selected engine Wasm identity absent');
  const wasm = await verified(root, wasmEntry);
  module = await factory({
    wasmBinary: wasm,
    locateFile: (file: string) => new URL(profile + '/' + file, root).href,
    mainScriptUrlOrBlob: new URL(name, root).href,
    printErr: (message: string) => post({ kind: 'runtime-error', message }),
  });
  const shared =
    typeof SharedArrayBuffer !== 'undefined' && module.HEAPU8.buffer instanceof SharedArrayBuffer;
  if (shared !== (profile === 'threaded'))
    throw new Error('Selected engine has the wrong memory profile');
  engine = module._nelyx_wasm_open(1, 1, p.schema, 15);
  if (!engine) throw new Error('Engine session initialization failed');
  if (profile === 'threaded') {
    const adapter = cppString(new URL('web/owner.js', root).href),
      configuration = cppString(root);
    try {
      const contentId = module._nelyx_host_start(engine, 1, adapter, configuration),
        renderId = module._nelyx_host_start(engine, 2, adapter, configuration);
      if (!contentId || !renderId || contentId === renderId)
        throw new Error('Native pthread owner creation failed');
      contentWorker = module.PThread?.pthreads[contentId];
      renderWorker = module.PThread?.pthreads[renderId];
      if (!contentWorker || !renderWorker)
        throw new Error('Pinned Emscripten pthread transport is unavailable');
      for (const worker of [contentWorker, renderWorker])
        worker.addEventListener('message', (event) => {
          const value = event.data as Record<string, unknown>;
          if (value.kind === 'v2-packet-result') complete(value);
          else if (value.kind) actorMessage(value);
        });
    } finally {
      module._free(adapter);
      module._free(configuration);
    }
  } else {
    provider = await CanvasKitProvider.load(root);
    contentThread = renderThread = module._nelyx_host_thread_id();
    content = new ContentActor(module, engine, provider, actorMessage, true);
    render = new RenderActor(module, engine, provider, actorMessage);
    render.attach(initialCanvas, viewport);
    initialCanvas = undefined;
    ready.add(1);
    ready.add(2);
    attached = true;
    stats({
      gl: provider.gl,
      content: { counters: { ...provider.counters } },
      render: { counters: { ...provider.counters } },
    });
    maybeReady();
  }
}
const contentOps = new Set<number>([
  p.opcodes.openView,
  p.opcodes.transaction,
  p.opcodes.queryResult,
  p.opcodes.acknowledge,
]);
function complete(message: Record<string, unknown>): void {
  const ticket = Number(message.id),
    request = pending.get(ticket);
  if (!request) return;
  pending.delete(ticket);
  pendingBytes -= request.bytes;
  const bytes = message.bytes as ArrayBuffer | undefined,
    error = message.error;
  send(request.port, { kind: 'packet-result', id: request.id, bytes, error }, bytes ? [bytes] : []);
  if (request.op === p.opcodes.openView && !error) {
    if (render) render.update(viewport);
    else renderWorker?.postMessage({ kind: 'v2-viewport', viewport });
    if (content) content.kick();
    else contentWorker?.postMessage({ kind: 'v2-wake' });
  }
}
function route(port: ClientPort, message: { kind: string; id: number; bytes: ArrayBuffer }): void {
  if (closing || !announced) {
    send(port, {
      kind: 'packet-result',
      id: message.id,
      error: 'Engine host is not accepting work',
    });
    return;
  }
  if (
    !(message.bytes instanceof ArrayBuffer) ||
    message.bytes.byteLength < p.headerBytes ||
    message.bytes.byteLength > p.limits.packetBytes ||
    pending.size >= 32 ||
    pendingBytes + message.bytes.byteLength > p.limits.packetBytes * 4
  ) {
    send(port, {
      kind: 'packet-result',
      id: message.id,
      error: 'Engine host transport admission exceeded',
    });
    return;
  }
  const bytes = new Uint8Array(message.bytes),
    op = new DataView(message.bytes).getUint16(p.headerFields.opcode, true);
  const ticket = ++next;
  if (ticket > 0xffff_ffff) throw new Error('Host transport ID exhausted');
  pending.set(ticket, { port, id: message.id, bytes: bytes.length, op });
  pendingBytes += bytes.length;
  if (profile === 'single-worker') {
    try {
      const result = (contentOps.has(op) ? content! : render!).packet(bytes);
      complete({ id: ticket, bytes: result.buffer });
    } catch (error) {
      complete({ id: ticket, error: failure(error) });
    }
  } else {
    (contentOps.has(op) ? contentWorker! : renderWorker!).postMessage(
      { kind: 'v2-packet', id: ticket, bytes: message.bytes },
      [message.bytes],
    );
  }
}
async function shutdown(): Promise<void> {
  if (closing) return;
  closing = true;
  for (const [id, request] of pending) {
    send(request.port, { kind: 'packet-result', id: request.id, error: 'Engine host closed' });
    pending.delete(id);
  }
  pendingBytes = 0;
  if (content) {
    content.stop();
    await render?.stop();
    provider!.close();
    stats({ contentClosed: { ...provider!.counters }, renderClosed: { ...provider!.counters } });
  } else {
    contentWorker?.postMessage({ kind: 'v2-stop' });
    renderWorker?.postMessage({ kind: 'v2-stop' });
    const deadline = performance.now() + 10000;
    while (stopped.size < 2 && performance.now() < deadline)
      await new Promise((resolve) => setTimeout(resolve, 4));
    if (stopped.size !== 2) throw new Error('Owner drain timeout');
  }
  if (engine) {
    const result = response(exchange(module, engine, packet(p.opcodes.closeSession, sessionOwner)));
    if (result.status !== p.statuses.ok || result.holds || result.reservedBytes !== 0n)
      throw new Error('Core did not drain before shutdown');
    module._nelyx_engine_destroy(engine);
    engine = 0;
  }
  module.PThread?.terminateAllThreads();
  for (const port of ports) port.close();
  ports.clear();
  post({
    kind: 'closed',
    state: {
      reservedBytes: 0,
      workersStopped: true,
      provider: provider ? { ...provider.counters } : telemetry,
    },
  });
}
scope.addEventListener('message', (event) => {
  const message = event.data;
  if (closing && message.kind !== 'close') return;
  void (async () => {
    if (message.kind === 'initialize') await initialize(message);
    else if (message.kind === 'packet') route(scope, message);
    else if (message.kind === 'port') {
      const port = message.port as MessagePort;
      ports.add(port);
      port.start();
      port.addEventListener('message', (e) => {
        if (e.data.kind === 'packet') route(port, e.data);
      });
    } else if (message.kind === 'viewport') {
      viewport = message.viewport;
      if (render) render.update(viewport);
      else renderWorker?.postMessage({ kind: 'v2-viewport', viewport });
    } else if (message.kind === 'stats-ack') {
      telemetryPending = false;
      if (telemetryRevision > sentRevision) {
        telemetryPending = true;
        sentRevision = telemetryRevision;
        post({ kind: 'stats', value: telemetry });
      }
    } else if (message.kind === 'delay-content') {
      if (content) {
        const start = performance.now(),
          ms = Math.min(2000, Math.max(0, message.milliseconds));
        actorMessage({ kind: 'delay-started', start, milliseconds: ms });
        while (performance.now() - start < ms) {}
        actorMessage({ kind: 'delay-ended', end: performance.now() });
      } else contentWorker?.postMessage({ kind: 'v2-delay', milliseconds: message.milliseconds });
    } else if (message.kind === 'close') await shutdown();
  })().catch((error) => failHost(failure(error), error instanceof Error ? error.stack : undefined));
});
