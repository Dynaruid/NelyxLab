// SPDX-License-Identifier: BSD-3-Clause
import {
  EngineClient,
  EngineError,
  createPacketTransport,
  protocol as p,
  resolveEngineV2,
  drainEngineOwners,
  engineDisposer,
  nativeAppTextBackend,
  appTextServiceVersion,
  appTextQuotaBytes,
} from '@nelyx/core/engine';
import { bindAssetLoader } from '@nelyx/core/internal/services/asset-loader-binding';
import {
  bindImmutableBufferLoader,
  immutableBufferBackendRequired,
} from '@nelyx/core/internal/ui/immutable-buffer-binding';
import { EngineV2Assets, nativeAssetTransport, webAssetTransport } from './engine-v2-assets.ts';
import { EngineV2Buffers } from './engine-v2-buffers.ts';
import { EngineV2Images } from './engine-v2-images.ts';
import type { OriginalImageSource } from '@nelyx/core/internal/runtime/app';
import {
  bindImageDescriptorLoader,
  imageDescriptorBackendRequired,
} from '@nelyx/core/internal/ui/image-descriptor-binding';
import type { AssetTransport } from './engine-v2-assets.ts';
import { FoundationPlatform } from '@nelyx/core/foundation/platform';
import { BrowserPlatformEnvironment } from '../platforms/web/environment.ts';
const nativePlatform = (globalThis as unknown as { NelyxV2Native?: { operatingSystem?: string } })
  .NelyxV2Native;
if (nativePlatform?.operatingSystem)
  FoundationPlatform.configure({ kind: 'native', operatingSystem: nativePlatform.operatingSystem });
else if (typeof navigator !== 'undefined')
  FoundationPlatform.configure(new BrowserPlatformEnvironment(navigator));
import type {
  PacketEndpoint,
  EngineViewClient,
  EngineIdentity,
  EngineExecutionSnapshot,
  AppTextBackend,
  NativeAppTextService,
} from '@nelyx/core/engine';
export interface EngineV2AppContext {
  readonly view: EngineViewClient;
  asset(name: string): Promise<Uint8Array>;
  notify(value: Record<string, unknown>): void;
}
export interface AppSessionDefinition<T> {
  readonly requiredCapabilities?: number;
  build(context: EngineV2AppContext): T | Promise<T>;
  ready?(context: EngineV2AppContext): void | Promise<void>;
  dispose?(): void | Promise<void>;
}
export interface AppSceneHost<T> {
  prepare?(context: EngineV2AppContext): void | Promise<void>;
  mount(root: T): Promise<void>;
  close(): Promise<void>;
  readonly counters: { readonly commands: number };
  readonly execution: EngineExecutionSnapshot;
}
export type AppSceneHostFactory<T> = (
  view: EngineViewClient,
  onError: (error: unknown) => void,
  onExecution: (execution: EngineExecutionSnapshot) => void,
  text: () => Promise<AppTextBackend>,
  images: OriginalImageSource,
) => AppSceneHost<T>;
type AppMessage = { kind: string; root?: string; port?: MessagePort; identity?: EngineIdentity };
type Native = NativeAppTextService & {
  identity: EngineIdentity;
  enqueue(id: number, bytes: ArrayBuffer): void;
  notify(text: string, execution?: EngineExecutionSnapshot): void;
  clock?(): number;
  readonly clockDomain?: 'qpc-milliseconds' | 'monotonic-milliseconds';
};
function appFailure(error: unknown): Record<string, unknown> {
  let remaining = 8192;
  const seen = new Set<unknown>();
  const describe = (cause: unknown, stackLimit: number): Record<string, unknown> => {
    const message = String(cause).slice(0, Math.min(2048, remaining));
    remaining -= message.length;
    const result: Record<string, unknown> = { message };
    if (cause instanceof Error && remaining > 0 && cause.stack) {
      result.stack = cause.stack.slice(0, Math.min(stackLimit, remaining));
      remaining -= (result.stack as string).length;
    }
    return result;
  };
  const description = describe(error, 2048);
  const pending = [error],
    causes: Record<string, unknown>[] = [];
  for (let work = 0; work < 128 && pending.length && causes.length < 8 && remaining > 0; ++work) {
    const cause = pending.pop();
    if (seen.has(cause)) continue;
    seen.add(cause);
    if (cause instanceof AggregateError) pending.push(...cause.errors.slice(0, 4).reverse());
    else if (cause instanceof Error && cause.cause !== undefined) pending.push(cause.cause);
    else if (cause !== error) causes.push(describe(cause, 1024));
  }
  return {
    kind: 'app-error',
    ...description,
    ...(causes.length ? { causes } : {}),
    ...(error instanceof EngineError && error.result
      ? {
          engine: {
            opcode: error.result.opcode,
            status: error.status,
            document: String(error.result.document),
            activeDocument: String(error.result.activeDocument),
          },
        }
      : {}),
  };
}
/** Shared App-worker/Hermes bootstrap; all framework work enters the same C++ packet port. */
export function launchAppSession<T>(
  definition: AppSessionDefinition<T>,
  createHost: AppSceneHostFactory<T>,
): void {
  const environment = globalThis as unknown as {
    NelyxV2Native?: Native;
    __v2Resolve?: (id: number, bytes: ArrayBuffer, error?: string) => void;
    __v2Dispose?: () => Promise<void>;
  };
  let started = false,
    closeRequested = false;
  const start = async (
    endpoint: PacketEndpoint,
    assetTransport: AssetTransport,
    notify: (value: Record<string, unknown>) => void,
    identity: EngineIdentity,
    loadText: (signal?: AbortSignal) => Promise<AppTextBackend>,
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
    const textAbort = environment.NelyxV2Native ? undefined : new AbortController();
    let textPromise: Promise<AppTextBackend> | undefined,
      textBackend: AppTextBackend | undefined,
      servicesClosing = false;
    const canceled = () => new EngineError(p.statuses.canceled, 'App services are closing');
    const text = (): Promise<AppTextBackend> => {
      if (servicesClosing || closeRequested) return Promise.reject(canceled());
      return (textPromise ??= loadText(textAbort?.signal).then((value) => {
        textBackend = value;
        if (servicesClosing || closeRequested) throw canceled();
        return value;
      }));
    };
    const assets = new EngineV2Assets(text, assetTransport);
    const buffers = new EngineV2Buffers(() => textBackend, text, assets);
    const images = new EngineV2Images(buffers, assets);
    let assetBinding: ReturnType<typeof bindAssetLoader> | undefined;
    let bufferBinding: ReturnType<typeof bindImmutableBufferLoader> | undefined;
    let imageBinding: ReturnType<typeof bindImageDescriptorLoader> | undefined;
    const onError = (error: unknown) => notify(appFailure(error));
    const onExecution = (execution: EngineExecutionSnapshot) =>
      notify({
        kind: 'app-execution',
        engine: 'v2',
        execution,
        assets: assets.execution,
        buffers: buffers.execution,
        images: images.execution,
      });
    const widgets = createHost(view, onError, onExecution, text, images);
    const context = {
      view,
      asset: (name: string) => assets.load(name),
      notify: (value: Record<string, unknown>) =>
        notify({
          ...value,
          assets: assets.execution,
          buffers: buffers.execution,
          images: images.execution,
        }),
    };
    let starting = true,
      buildEntered = false;
    let finishStartup!: () => void;
    const startupEnded = new Promise<void>((resolve) => {
      finishStartup = resolve;
    });
    const dispose = engineDisposer(async () => {
      servicesClosing = true;
      textAbort?.abort(canceled());
      assets.cancel();
      images.cancel();
      buffers.cancel();
      await drainEngineOwners('App disposal failed', [
        () => {
          if (buildEntered) return definition.dispose?.();
        },
        () => assetBinding?.dispose(),
        () => bufferBinding?.dispose(),
        () => imageBinding?.dispose(),
        () => assets.close(),
        () => widgets.close(),
        () => images.close(),
        () => buffers.close(),
        async () => {
          // A failed bootstrap is reported by its caller. Still settle it here
          // before checking for a backend created while disposal was requested.
          await textPromise?.catch(() => {});
          if (textBackend && !textBackend.snapshot().closed) textBackend.close();
        },
        () => client.abort(),
      ]);
      notify({
        kind: 'app-disposed',
        assets: assets.execution,
        buffers: buffers.execution,
        images: images.execution,
      });
    });
    let reportedDisposal = false;
    environment.__v2Dispose = () => {
      closeRequested = true;
      servicesClosing = true;
      textAbort?.abort(canceled());
      assets.cancel();
      images.cancel();
      buffers.cancel();
      const disposal = starting ? startupEnded.then(dispose) : dispose();
      if (!reportedDisposal) {
        reportedDisposal = true;
        // Native callers pump microtasks without awaiting JS Promises.
        void disposal.catch(onError);
      }
      return disposal;
    };
    try {
      if (closeRequested) {
        await dispose();
        return;
      }
      assetBinding = bindAssetLoader({
        load: (key) => assets.load(key),
        loadBuffer: (key) => buffers.loadAsset(key),
        loadNetwork: (baseUrl, key) => assets.loadNetwork(baseUrl, key),
        loadNetworkBuffer: (baseUrl, key) => buffers.loadNetwork(baseUrl, key),
      });
      bufferBinding = bindImmutableBufferLoader(buffers);
      imageBinding = bindImageDescriptorLoader(images);
      const buildStartedAtMs = timestamp();
      // The canonical API promises a synchronous input copy. Its actual module
      // declares that requirement before launch, so no caller bytes queue while
      // this realm is still waiting for host memory admission.
      if (immutableBufferBackendRequired() || imageDescriptorBackendRequired()) await text();
      if (imageDescriptorBackendRequired() && textBackend?.images?.snapshot().version !== 2)
        throw Error('Required App image descriptor service version 2 is unavailable');
      const servicesPreparedAtMs = timestamp();
      if (closeRequested) {
        await dispose();
        return;
      }
      await widgets.prepare?.(context);
      if (closeRequested) {
        await dispose();
        return;
      }
      buildEntered = true;
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
        assets: assets.execution,
        buffers: buffers.execution,
        images: images.execution,
        memory: { total: String(state.memory.total), limit: String(state.memory.limit) },
        timing: {
          scope: 'initial-app-build',
          domain: nativeClock
            ? (environment.NelyxV2Native?.clockDomain ?? 'native-monotonic-milliseconds')
            : clock
              ? 'owner-performance'
              : 'unobserved',
          timeOriginMs: nativeClock
            ? 0
            : typeof performance !== 'undefined'
              ? performance.timeOrigin
              : null,
          buildStartedAtMs,
          servicesPreparedAtMs,
          servicesPreparationElapsedMs: elapsed(buildStartedAtMs, servicesPreparedAtMs),
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
          if (
            closeRequested &&
            error instanceof EngineError &&
            error.status === p.statuses.canceled
          )
            return;
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
      nativeAssetTransport,
      notify,
      native.identity,
      async () => nativeAppTextBackend(native),
    ).catch((error) => notify(appFailure(error)));
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
        webAssetTransport(message.root!),
        notify,
        message.identity!,
        (signal) => loadWebAppText(message.root!, port, signal!),
      ).catch((error) => notify(appFailure(error)));
    });
  }
}

async function loadWebAppText(
  root: string,
  port: MessagePort,
  signal: AbortSignal,
): Promise<AppTextBackend> {
  signal.throwIfAborted();
  // The coordinator alone may reserve the session's App quota; ordinary App
  // packet memoryReport commands remain forbidden. This credit has no App release.
  const quota = await new Promise<number>((resolve, reject) => {
    let timer: ReturnType<typeof setTimeout>;
    const cleanup = () => {
      clearTimeout(timer);
      port.removeEventListener('message', receive);
      signal.removeEventListener('abort', abort);
    };
    const abort = () => {
      cleanup();
      reject(signal.reason);
    };
    const receive = (event: MessageEvent) => {
      if (event.data?.kind !== 'app-text-reservation') return;
      cleanup();
      if (
        event.data.error ||
        event.data.version !== appTextServiceVersion ||
        event.data.bytes !== appTextQuotaBytes
      )
        reject(Error(event.data.error ?? 'App paragraph quota/version differs'));
      else resolve(event.data.bytes);
    };
    port.addEventListener('message', receive);
    signal.addEventListener('abort', abort, { once: true });
    timer = setTimeout(() => {
      cleanup();
      reject(Error('App paragraph reservation timed out'));
    }, 10000);
    port.postMessage({ kind: 'app-text-reserve', version: appTextServiceVersion });
  });
  signal.throwIfAborted();
  const manifest = await (await fetch(new URL('engine-manifest.json', root), { signal })).json(),
    service = manifest.appText;
  signal.throwIfAborted();
  if (
    !service ||
    service.version !== appTextServiceVersion ||
    service.bootstrapVersion !== 1 ||
    service.fontRevision !== 1 ||
    service.quotaBytes !== quota ||
    service.script !== 'web/app-text.js'
  )
    throw Error('Required App paragraph supply is unavailable');
  const entry = manifest.files.find((file: { path: string }) => file.path === service.script);
  if (!entry || !/^[a-f0-9]{64}$/.test(entry.sha256))
    throw Error('App paragraph module identity is absent');
  const result = await fetch(new URL(service.script, root), { signal });
  if (!result.ok) throw Error('App paragraph module is unavailable');
  const bytes = new Uint8Array(await result.arrayBuffer());
  if (bytes.length > 4 * 1024 * 1024) throw Error('App paragraph module budget exceeded');
  const hash = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), (value) =>
    value.toString(16).padStart(2, '0'),
  ).join('');
  signal.throwIfAborted();
  if (hash !== entry.sha256) throw Error('App paragraph module identity differs');
  const script = URL.createObjectURL(new Blob([bytes], { type: 'text/javascript' }));
  try {
    (globalThis as unknown as { importScripts(url: string): void }).importScripts(script);
  } finally {
    URL.revokeObjectURL(script);
  }
  const factory = (
    globalThis as unknown as {
      NelyxV2AppText?: {
        version: number;
        bootstrapVersion: number;
        loadAppText(root: string, quota: number, signal: AbortSignal): Promise<AppTextBackend>;
      };
    }
  ).NelyxV2AppText;
  if (
    factory?.version !== appTextServiceVersion ||
    factory.bootstrapVersion !== 1 ||
    typeof factory.loadAppText !== 'function'
  )
    throw Error('App paragraph factory version differs');
  signal.throwIfAborted();
  return factory.loadAppText(root, quota, signal);
}
