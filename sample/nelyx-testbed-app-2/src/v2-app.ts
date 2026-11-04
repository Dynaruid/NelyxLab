// SPDX-License-Identifier: BSD-3-Clause
import {
  EngineClient,
  protocol as p,
  createPacketTransport,
} from '../../../Nelyx/runtime/engine-client/index.ts';
import type { PacketEndpoint } from '../../../Nelyx/runtime/engine-client/index.ts';
import { engineV2Scene } from './v2-scene.ts';

type NativePort = {
  enqueue(id: number, bytes: ArrayBuffer): void;
  asset(name: string): ArrayBuffer;
  notify(message: string): void;
};
const environment = globalThis as unknown as {
  NelyxV2Native?: NativePort;
  __v2Resolve?: (id: number, bytes: ArrayBuffer, error?: string) => void;
  __v2Delay?: (ms: number) => void;
  __v2Dispose?: () => Promise<void>;
};
async function start(
  endpoint: PacketEndpoint,
  image: Uint8Array,
  notify: (value: Record<string, unknown>) => void,
): Promise<void> {
  const client = await EngineClient.connect(createPacketTransport(endpoint, 10000), {
    requiredCapabilities: p.capabilities.surface,
    timeoutMs: 10000,
  });
  const view = await client.openView(1);
  const changes = engineV2Scene(image);
  const accepted = await view.commit(changes);
  const active = await view.awaitActivated(accepted.document, 2000);
  notify({
    kind: 'app-ready',
    document: String(active.activeDocument),
    commands: changes.length,
    engineWork: String(active.transactionWork),
    fallbacks: 0,
  });
  environment.__v2Delay = (milliseconds) => {
    const until = Date.now() + Math.min(2000, Math.max(0, milliseconds));
    notify({ kind: 'app-delay-start', time: Date.now() });
    while (Date.now() < until) {}
    notify({ kind: 'app-delay-end', time: Date.now() });
  };
  environment.__v2Dispose = () => client.close();
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
    (value) => native.notify(JSON.stringify(value)),
  ).catch((error) => native.notify(JSON.stringify({ kind: 'app-error', message: String(error) })));
} else {
  const scope = globalThis as unknown as DedicatedWorkerGlobalScope;
  scope.addEventListener('message', (event: MessageEvent) => {
    if (event.data.kind === 'start') {
      const port = event.data.port as MessagePort;
      port.start();
      void (async () => {
        const result = await fetch(new URL('assets/image.webp', event.data.root));
        if (!result.ok) throw new Error('App image asset failed');
        const endpoint: PacketEndpoint = {
          post: (value, transfer) => port.postMessage(value, transfer),
          subscribe(callback) {
            const receive = (e: MessageEvent<unknown>) => callback(e.data);
            port.addEventListener('message', receive);
            return () => port.removeEventListener('message', receive);
          },
          close: () => port.close(),
        };
        await start(endpoint, new Uint8Array(await result.arrayBuffer()), (value) =>
          scope.postMessage(value),
        );
      })().catch((error) => scope.postMessage({ kind: 'app-error', message: String(error) }));
    } else if (event.data.kind === 'delay') environment.__v2Delay?.(event.data.milliseconds);
    else if (event.data.kind === 'close') void environment.__v2Dispose?.();
  });
}
