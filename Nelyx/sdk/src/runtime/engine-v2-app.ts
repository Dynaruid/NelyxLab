// SPDX-License-Identifier: BSD-3-Clause
import {
  EngineClient,
  EngineError,
  WidgetHost,
  createPacketTransport,
  protocol as p,
  resolveEngineV2,
  drainEngineOwners,
  engineDisposer,
} from '@nelyx/core/v2';
import type {
  Widget,
  PacketEndpoint,
  EngineViewClient,
  EngineIdentity,
  EngineExecutionSnapshot,
} from '@nelyx/core/v2';
export interface EngineV2AppContext {
  readonly view: EngineViewClient;
  asset(name: string): Promise<Uint8Array>;
  notify(value: Record<string, unknown>): void;
}
export interface EngineV2App {
  readonly requiredCapabilities?: number;
  build(context: EngineV2AppContext): Widget | Promise<Widget>;
  ready?(context: EngineV2AppContext): void | Promise<void>;
  dispose?(): void | Promise<void>;
}
export function defineEngineV2App(app: EngineV2App): EngineV2App {
  return app;
}
type AppMessage = { kind: string; root?: string; port?: MessagePort; identity?: EngineIdentity };
type Native = {
  identity: EngineIdentity;
  enqueue(id: number, bytes: ArrayBuffer): void;
  asset(name: string): ArrayBuffer;
  notify(text: string, execution?: EngineExecutionSnapshot): void;
};
/** Shared App-worker/Hermes bootstrap; all framework work enters the same C++ packet port. */
export function launchEngineV2App(definition: EngineV2App): void {
  const environment = globalThis as unknown as {
    NelyxV2Native?: Native;
    __v2Resolve?: (id: number, bytes: ArrayBuffer, error?: string) => void;
    __v2Dispose?: () => Promise<void>;
  };
  let started = false;
  const start = async (
    endpoint: PacketEndpoint,
    asset: (name: string) => Promise<Uint8Array>,
    notify: (value: Record<string, unknown>) => void,
    identity: EngineIdentity,
  ) => {
    if (started) throw new Error('Application already started');
    started = true;
    resolveEngineV2({ engine: 'v2', abiMajor: p.abiMajor, schema: p.schema }, identity);
    const client = await EngineClient.connect(createPacketTransport(endpoint, 10000), {
      requiredCapabilities:
        p.capabilities.surface |
        p.capabilities.memoryBudget |
        (definition.requiredCapabilities ?? 0),
      timeoutMs: 10000,
    });
    let view: EngineViewClient;
    try {
      view = await client.openView(1);
    } catch (error) {
      await drainEngineOwners('App view startup and cleanup failed', [
        () => {
          throw error;
        },
        () => client.abort(),
      ]);
      throw error;
    }
    const widgets = new WidgetHost(view, {
      onError: (error) => notify({ kind: 'app-error', message: String(error) }),
    });
    const context = { view, asset, notify };
    let starting = true;
    const dispose = engineDisposer(async () => {
      await drainEngineOwners('App disposal failed', [
        () => definition.dispose?.(),
        () => widgets.close(),
        () => client.abort(),
      ]);
      notify({ kind: 'app-disposed' });
    });
    let reportedDisposal = false;
    environment.__v2Dispose = () => {
      const disposal = dispose();
      if (!starting && !reportedDisposal) {
        reportedDisposal = true;
        // Native callers pump microtasks without awaiting JS Promises.
        void disposal.catch((error) => notify({ kind: 'app-error', message: String(error) }));
      }
      return disposal;
    };
    try {
      await widgets.mount(await definition.build(context));
      const deadline = Date.now() + 10000;
      let state;
      for (;;) {
        try {
          state = await view.awaitActivated(view.documentEpoch);
          break;
        } catch (error) {
          if (
            !(error instanceof EngineError) ||
            error.status !== p.statuses.timedOut ||
            Date.now() >= deadline
          )
            throw error;
        }
      }
      await definition.ready?.(context);
      starting = false;
      notify({
        kind: 'app-ready',
        engine: 'v2',
        document: String(state.activeDocument),
        commands: widgets.counters.commands,
        engineWork: String(state.transactionWork),
        execution: widgets.execution,
        memory: { total: String(state.memory.total), limit: String(state.memory.limit) },
      });
    } catch (error) {
      await drainEngineOwners('App startup and cleanup failed', [
        () => {
          throw error;
        },
        dispose,
      ]);
    }
  };
  const native = environment.NelyxV2Native;
  if (native) {
    const callbacks = new Set<(value: unknown) => void>();
    environment.__v2Resolve = (id, bytes, error) => {
      for (const callback of callbacks) callback({ kind: 'packet-result', id, bytes, error });
    };
    const notify = (value: Record<string, unknown>) =>
      native.notify(JSON.stringify(value), value.execution as EngineExecutionSnapshot | undefined);
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
      async (name) => new Uint8Array(native.asset(name)),
      notify,
      native.identity,
    ).catch((error) => notify({ kind: 'app-error', message: String(error) }));
  } else {
    const scope = globalThis as unknown as {
        postMessage(value: unknown): void;
        addEventListener(
          kind: 'message',
          callback: (event: MessageEvent<AppMessage>) => void,
        ): void;
      },
      notify = (value: Record<string, unknown>) => scope.postMessage(value);
    scope.addEventListener('message', (event: MessageEvent<AppMessage>) => {
      const message = event.data;
      if (message.kind === 'close') {
        void environment.__v2Dispose?.();
        return;
      }
      if (message.kind !== 'start') return;
      const port = message.port!;
      port.start();
      void start(
        {
          post: (value, transfer) => port.postMessage(value, transfer),
          subscribe(callback) {
            const receive = (event: MessageEvent) => callback(event.data);
            port.addEventListener('message', receive);
            return () => port.removeEventListener('message', receive);
          },
          close: () => port.close(),
        },
        async (name) => {
          if (!/^[A-Za-z0-9][A-Za-z0-9._/-]*$/.test(name) || name.split('/').includes('..'))
            throw new Error('Invalid application asset name');
          const result = await fetch(new URL('application/assets/' + name, message.root));
          if (!result.ok) throw new Error('Application asset unavailable: ' + name);
          const bytes = new Uint8Array(await result.arrayBuffer());
          if (bytes.length > p.limits.resourceBytes)
            throw new Error('Application asset exceeds resource budget');
          return bytes;
        },
        notify,
        message.identity!,
      ).catch((error) => notify({ kind: 'app-error', message: String(error) }));
    });
  }
}
