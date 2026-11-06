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
interface AppWidgetHost {
  mount(root: Widget): Promise<void>;
  close(): Promise<void>;
  readonly counters: Pick<WidgetHost['counters'], 'commands'>;
  readonly execution: EngineExecutionSnapshot;
}
const appWidgetHosts = new WeakMap<
  EngineV2App,
  (
    view: EngineViewClient,
    onError: (error: unknown) => void,
    onExecution: (execution: EngineExecutionSnapshot) => void,
  ) => AppWidgetHost
>();
/** @internal Installed only by an explicit implemented App model entry. */
export function registerEngineV2WidgetHost(
  app: EngineV2App,
  create: (
    view: EngineViewClient,
    onError: (error: unknown) => void,
    onExecution: (execution: EngineExecutionSnapshot) => void,
  ) => AppWidgetHost,
): EngineV2App {
  appWidgetHosts.set(app, create);
  return app;
}
type AppMessage = { kind: string; root?: string; port?: MessagePort; identity?: EngineIdentity };
type Native = {
  identity: EngineIdentity;
  enqueue(id: number, bytes: ArrayBuffer): void;
  asset(name: string): ArrayBuffer;
  notify(text: string, execution?: EngineExecutionSnapshot): void;
  clock?(): number;
};
/** Shared App-worker/Hermes bootstrap; all framework work enters the same C++ packet port. */
export function launchEngineV2App(definition: EngineV2App): void {
  const environment = globalThis as unknown as {
    NelyxV2Native?: Native;
    __v2Resolve?: (id: number, bytes: ArrayBuffer, error?: string) => void;
    __v2Dispose?: () => Promise<void>;
  };
  let started = false,
    closeRequested = false;
  const start = async (
    endpoint: PacketEndpoint,
    asset: (name: string) => Promise<Uint8Array>,
    notify: (value: Record<string, unknown>) => void,
    identity: EngineIdentity,
  ) => {
    if (started) throw new Error('Application already started');
    started = true;
    const nativeClock = environment.NelyxV2Native?.clock;
    const clock =
      nativeClock ?? (typeof performance !== 'undefined' ? () => performance.now() : undefined);
    const timestamp = () => clock?.() ?? null;
    const elapsed = (from: number | null, to: number | null) =>
      from === null || to === null ? null : to - from;
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
    const onError = (error: unknown) => notify({ kind: 'app-error', message: String(error) });
    const onExecution = (execution: EngineExecutionSnapshot) =>
      notify({ kind: 'app-execution', engine: 'v2', execution });
    const widgets =
      appWidgetHosts.get(definition)?.(view, onError, onExecution) ??
      new WidgetHost(view, { onError, onExecution });
    const context = { view, asset, notify };
    let starting = true,
      buildEntered = false;
    let finishStartup!: () => void;
    const startupEnded = new Promise<void>((resolve) => {
      finishStartup = resolve;
    });
    const dispose = engineDisposer(async () => {
      await drainEngineOwners('App disposal failed', [
        () => {
          if (buildEntered) return definition.dispose?.();
        },
        () => widgets.close(),
        () => client.abort(),
      ]);
      notify({ kind: 'app-disposed' });
    });
    let reportedDisposal = false;
    environment.__v2Dispose = () => {
      closeRequested = true;
      const disposal = starting ? startupEnded.then(dispose) : dispose();
      if (!reportedDisposal) {
        reportedDisposal = true;
        // Native callers pump microtasks without awaiting JS Promises.
        void disposal.catch((error) => notify({ kind: 'app-error', message: String(error) }));
      }
      return disposal;
    };
    try {
      if (closeRequested) {
        await dispose();
        return;
      }
      buildEntered = true;
      const buildStartedAtMs = timestamp();
      const widget = await definition.build(context);
      const buildCompletedAtMs = timestamp();
      if (closeRequested) {
        await dispose();
        return;
      }
      await widgets.mount(widget);
      const mountCompletedAtMs = timestamp();
      const deadline = Date.now() + 10000;
      let state;
      for (;;) {
        if (closeRequested) {
          await dispose();
          return;
        }
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
      if (closeRequested) {
        await dispose();
        return;
      }
      const activationCompletedAtMs = timestamp();
      await definition.ready?.(context);
      const readyCompletedAtMs = timestamp();
      if (closeRequested) {
        await dispose();
        return;
      }
      // ready() can commit another tree. Observe the ordered App port after
      // that callback so native work and acknowledged SDK commands agree.
      try {
        state = await view.request(p.opcodes.inspect);
      } catch (error) {
        if (closeRequested) {
          await dispose();
          return;
        }
        throw error;
      }
      if (closeRequested) {
        await dispose();
        return;
      }
      if (state.status !== p.statuses.ok)
        throw new EngineError(state.status, 'App-ready native observation failed', state);
      const readyObservedAtMs = timestamp();
      notify({
        kind: 'app-ready',
        engine: 'v2',
        document: String(state.activeDocument),
        commands: widgets.counters.commands,
        engineWork: String(state.transactionWork),
        execution: widgets.execution,
        memory: { total: String(state.memory.total), limit: String(state.memory.limit) },
        timing: {
          scope: 'initial-app-build',
          domain: nativeClock ? 'qpc-milliseconds' : clock ? 'owner-performance' : 'unobserved',
          timeOriginMs: nativeClock
            ? 0
            : typeof performance !== 'undefined'
              ? performance.timeOrigin
              : null,
          buildStartedAtMs,
          buildCompletedAtMs,
          buildElapsedMs: elapsed(buildStartedAtMs, buildCompletedAtMs),
          mountAndAckElapsedMs: elapsed(buildCompletedAtMs, mountCompletedAtMs),
          activationWaitElapsedMs: elapsed(mountCompletedAtMs, activationCompletedAtMs),
          readyCallbackElapsedMs: elapsed(activationCompletedAtMs, readyCompletedAtMs),
          readyObservationElapsedMs: elapsed(readyCompletedAtMs, readyObservedAtMs),
          document: String(state.activeDocument),
        },
      });
    } catch (error) {
      await drainEngineOwners('App startup and cleanup failed', [
        () => {
          throw error;
        },
        dispose,
      ]);
    } finally {
      starting = false;
      finishStartup();
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
        closeRequested = true;
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
