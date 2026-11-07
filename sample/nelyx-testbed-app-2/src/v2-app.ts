// SPDX-License-Identifier: BSD-3-Clause
import {
  EngineClient,
  EngineError,
  protocol as p,
  createPacketTransport,
  WidgetHost,
  drainEngineOwners,
  engineDisposer,
} from '@nelyx/core/v2';
import type { PacketEndpoint, EngineExecutionSnapshot } from '@nelyx/core/v2';
import { engineV2Scene } from './v2-scene.ts';

type NativePort = {
  enqueue(id: number, bytes: ArrayBuffer): void;
  asset(name: string): ArrayBuffer;
  notify(message: string, execution?: EngineExecutionSnapshot): void;
};
// Structural worker ports keep the shared App bundle independent of DOM/RN types.
type AppPort = {
  start(): void;
  postMessage(value: unknown, transfer: ArrayBuffer[]): void;
  addEventListener(kind: 'message', callback: (event: { data: unknown }) => void): void;
  removeEventListener(kind: 'message', callback: (event: { data: unknown }) => void): void;
  close(): void;
};
type AppWorker = {
  postMessage(value: unknown): void;
  addEventListener(
    kind: 'message',
    callback: (event: { data: { kind: string; port: AppPort; root: string } }) => void,
  ): void;
};
const environment = globalThis as unknown as {
  NelyxV2Native?: NativePort;
  __v2Resolve?: (id: number, bytes: ArrayBuffer, error?: string) => void;
  __v2Dispose?: () => Promise<void>;
  __v2Update?: () => Promise<void>;
};
async function start(
  endpoint: PacketEndpoint,
  image: Uint8Array,
  notify: (value: Record<string, unknown>) => void,
): Promise<void> {
  const client = await EngineClient.connect(createPacketTransport(endpoint, 10000), {
    requiredCapabilities:
      p.capabilities.surface |
      p.capabilities.layoutQueries |
      p.capabilities.editing |
      p.capabilities.semantics |
      p.capabilities.lazyList |
      p.capabilities.gestures |
      p.capabilities.controls |
      p.capabilities.rawObserver |
      p.capabilities.appControlled |
      p.capabilities.graphics |
      p.capabilities.nativeExtensions,
    timeoutMs: 10000,
  });
  const view = await client.openView(1);
  const scene = engineV2Scene(image, (sample) =>
      notify({
        kind: 'raw-input',
        sequence: String(sample.sequence),
        publication: String(sample.publication),
        native: true,
      }),
    ),
    widgets = new WidgetHost(view, {
      onError: (error) => notify({ kind: 'app-error', message: String(error) }),
      onExecution: (execution) => notify({ kind: 'app-execution', execution }),
    });
  await widgets.mount(scene.root);
  // Cold Web font/provider startup can span multiple bounded activation waits.
  let active;
  const startupDeadline = Date.now() + 10000;
  for (;;) {
    try {
      active = await view.awaitActivated(view.documentEpoch, 2000);
      break;
    } catch (error) {
      if (
        !(error instanceof EngineError) ||
        error.status !== p.statuses.timedOut ||
        Date.now() >= startupDeadline
      )
        throw error;
    }
  }
  await scene.editor.refresh();
  notify({
    kind: 'app-ready',
    document: String(active.activeDocument),
    commands: widgets.counters.commands,
    engineWork: String(active.transactionWork),
    execution: widgets.execution,
    widgets: { ...widgets.counters },
    lazy: { ...scene.lazy.currentState!.counters, itemCount: 2000 },
  });
  const dispose = engineDisposer(async () => {
    try {
      await drainEngineOwners('Testbed disposal failed', [
        () => widgets.close(),
        () => client.abort(),
      ]);
      notify({ kind: 'app-disposed' });
    } catch (error) {
      notify({ kind: 'app-error', message: String(error) });
      throw error;
    }
  });
  environment.__v2Dispose = () => {
    const closing = dispose();
    void closing.catch(() => {});
    return closing;
  };
  let updating = false;
  environment.__v2Update = async () => {
    if (updating) return;
    updating = true;
    try {
      const before = widgets.counters.commands;
      scene.counter.currentState!.increment();
      await widgets.flush();
      const active = await view.awaitActivated(view.documentEpoch, 2000);
      notify({
        kind: 'app-updated',
        document: String(active.activeDocument),
        commands: widgets.counters.commands - before,
        engineWork: String(active.transactionWork),
        execution: widgets.execution,
      });
    } finally {
      updating = false;
    }
  };
}
if (environment.NelyxV2Native) {
  const callbacks = new Set<(message: unknown) => void>();
  environment.__v2Resolve = (id, bytes, error) => {
    for (const callback of callbacks) callback({ kind: 'packet-result', id, bytes, error });
  };
  const native = environment.NelyxV2Native;
  void start(
    {
      post(value) {
        const message = value as { id: number; bytes: ArrayBuffer };
        native.enqueue(message.id, message.bytes);
      },
      subscribe(callback) {
        callbacks.add(callback);
        return () => callbacks.delete(callback);
      },
      close() {
        callbacks.clear();
      },
    },
    new Uint8Array(native.asset('image')),
    (value) =>
      native.notify(JSON.stringify(value), value.execution as EngineExecutionSnapshot | undefined),
  ).catch((error) => native.notify(JSON.stringify({ kind: 'app-error', message: String(error) })));
} else {
  const scope = globalThis as unknown as AppWorker;
  scope.addEventListener('message', (event) => {
    if (event.data.kind === 'start') {
      const port = event.data.port;
      port.start();
      void (async () => {
        const result = await fetch(new URL('assets/image.webp', event.data.root).href);
        if (!result.ok) throw new Error('App image asset failed');
        const endpoint: PacketEndpoint = {
          post: (value, transfer) => port.postMessage(value, transfer),
          subscribe(callback) {
            const receive = (e: { data: unknown }) => callback(e.data);
            port.addEventListener('message', receive);
            return () => port.removeEventListener('message', receive);
          },
          close: () => port.close(),
        };
        await start(endpoint, new Uint8Array(await result.arrayBuffer()), (value) =>
          scope.postMessage(value),
        );
      })().catch((error) => scope.postMessage({ kind: 'app-error', message: String(error) }));
    } else if (event.data.kind === 'update')
      void environment
        .__v2Update?.()
        .catch((error) => scope.postMessage({ kind: 'app-error', message: String(error) }));
    else if (event.data.kind === 'close') void environment.__v2Dispose?.();
  });
}
