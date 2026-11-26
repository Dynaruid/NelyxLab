import { OwnedDisposal, finishOwnedDisposal } from '../../runtime/owned-disposal.ts';
import * as React from 'react';
import type { ComponentType } from 'react';
import { createRoot } from 'react-dom/client';
import type { ApplicationDefinition } from '@nelyx/core/hosting/runtime';
import type { ViewOwner } from '@nelyx/core/ui/types';
import type { PlatformMessagePort } from '@nelyx/core/hosting/platform-messages';
import type { WebSkiaSurfaceOptions } from '@nelyx/skia-web/library';
import type { ComposedApplication } from '../../runtime/bootstrap.ts';
import type { ResolvedAppAsset as AppAsset } from '../../runtime/config.ts';
import type { CanvasKitManifest } from '../../backends/browser/canvaskit-manifest.ts';
import { createProviderRegistry } from '../../runtime/providers.ts';
import { bootstrapApplication } from '../../runtime/bootstrap.ts';
import { createWebServices, readBrowserAssets } from '../../backends/browser/services.ts';
import type { BackendConnection } from '../../backends/backend-contract.ts';
import type { WebSafeAreaSource } from '../../backends/browser/environment.ts';
import { loadCanvasKit } from '../../backends/browser/canvaskit.ts';
import { createBrowserPlatformMessages } from '../../backends/browser/platform-messages.ts';
import { webDialogWindows } from './dialog-windows.ts';
import { browserDeviceServices } from '../../backends/browser/devices.ts';
import { DeviceScope } from '../../runtime/device-scope.ts';
import { BrowserRenderer } from '../../backends/browser/renderer.ts';
import type { WebRenderMode } from '../../backends/browser/render-protocol.ts';
import type { WebRenderDiagnostics } from '../../backends/browser/render-telemetry.ts';

export type { WebRenderMode, WebRenderPath } from '../../backends/browser/render-protocol.ts';
export type { WebRenderDiagnostics } from '../../backends/browser/render-telemetry.ts';

export type { WebSafeAreaSource } from '../../backends/browser/environment.ts';

const backend = Object.freeze({ react: React });
let generation = 0;
interface WebRoot {
  readonly element: HTMLElement;
  readonly surfaces: Set<Promise<void>>;
  readonly retained: Set<unknown>;
  unmount(): void;
  close(): Promise<void>;
  closing: boolean;
  failure?: { error: unknown };
}
const roots = new WeakMap<HTMLElement, WebRoot>(),
  registrations = new Set<WebRoot>();
interface WebOpening {
  readonly opening: Promise<WebApplication>;
  application?: WebApplication;
  retained?: unknown;
}
const applications = new Set<WebOpening>();
let widgetRevision = 0;
/** Request a normal framework frame on every live or opening DOM surface. */
export function queueWebWidgetRebuild(revision: number): void {
  if (runtimeClosing || revision <= widgetRevision) return;
  widgetRevision = revision;
  for (const { application } of applications) application?.session.queueWidgetRebuild(revision);
}
export interface WebApplicationDiagnostics {
  readonly owner: ViewOwner;
  readonly rendering: WebRenderDiagnostics;
  readonly text: {
    readonly paragraphs: number;
    readonly producers: number;
    readonly retainedOnly: number;
    readonly fontProviders: number;
    readonly fontProviderSourceBytes: number;
    readonly failed: boolean;
  };
}
/** Read actual app-owned counters without exposing native objects or changing prototypes. */
export function readWebApplicationDiagnostics(): readonly WebApplicationDiagnostics[] {
  const snapshots: WebApplicationDiagnostics[] = [];
  for (const job of applications) {
    const retained = job.retained as
      | {
          readonly library?: {
            readonly debugOwner: ViewOwner;
            readonly debugTextStats: WebApplicationDiagnostics['text'];
          };
          readonly renderer?: BrowserRenderer;
        }
      | undefined;
    const library = retained?.library,
      rendering = retained?.renderer?.diagnostics;
    if (!library || !rendering) continue;
    const text = library.debugTextStats,
      owner = library.debugOwner;
    if (!owner || !Number.isInteger(text.producers) || !Number.isInteger(text.retainedOnly))
      throw new Error('Matching Web text diagnostics cohort is required');
    snapshots.push(
      Object.freeze({
        owner: Object.freeze({ ...owner }),
        rendering,
        text: Object.freeze({ ...text }),
      }),
    );
  }
  return Object.freeze(snapshots);
}
let runtimeClosing = false,
  shutdown: Promise<void> | undefined;
export function webBackend(): typeof backend {
  return backend;
}
export function registerApplication(
  name: string,
  application: ComponentType,
  rootTag: HTMLElement,
): { dispose(): void; close(): Promise<void> } {
  if (runtimeClosing || roots.has(rootTag))
    throw new Error('Web runtime/root is closing, mounted or draining');
  if (typeof document === 'undefined' || !/^[A-Z][A-Za-z0-9]*$/.test(name))
    throw new Error('Web application environment/name');
  const root: WebRoot = {
    element: rootTag,
    surfaces: new Set(),
    retained: new Set(),
    closing: false,
    unmount() {},
    async close() {
      throw new Error('Web root registration is incomplete');
    },
  };
  roots.set(rootTag, root);
  registrations.add(root);
  try {
    const mounted = createRoot(rootTag);
    root.unmount = () => mounted.unmount();
    mounted.render(React.createElement(application));
  } catch (error) {
    root.unmount();
    roots.delete(rootTag);
    registrations.delete(root);
    throw error;
  }
  let closed: Promise<void> | undefined;
  const close = () =>
    (closed ??= (async () => {
      /* oxlint-disable unicorn/no-useless-spread -- Snapshot pending work before Promise assimilation can trigger reentrant collection mutations. */
      root.closing = true;
      root.unmount();
      await Promise.all([...root.surfaces]);
      /* oxlint-enable unicorn/no-useless-spread */
      if (root.failure) throw root.failure.error;
      roots.delete(rootTag);
      registrations.delete(root);
    })());
  root.close = close;
  return {
    close,
    dispose() {
      void close().catch((error) => console.error('Web root drain failed', error));
    },
  };
}
/** Seal this JS realm and wait every registered root before controlled reload. */
export function closeAllWebApplications(): Promise<void> {
  runtimeClosing = true;
  return (shutdown ??= (async () => {
    const tasks = [...registrations].map((root) => root.close());
    for (const job of applications)
      tasks.push(
        (async () => {
          let application;
          try {
            application = await job.opening;
          } catch (error) {
            if (error instanceof AggregateError) throw error;
            return;
          }
          await finishOwnedDisposal(() => application.dispose());
        })(),
      );
    const results = await Promise.allSettled(tasks),
      errors = results.flatMap((value) => (value.status === 'rejected' ? [value.reason] : []));
    if (errors.length)
      throw new AggregateError(errors, 'Web runtime drain failed; remaining owners retained');
  })());
}
/** Surface lifetime belongs to its registered DOM root, including pending opens. */
export function ownWebSurface(element: HTMLElement): {
  complete(failure?: { error: unknown; retained: unknown }): void;
} {
  let root: WebRoot | undefined;
  for (const candidate of registrations)
    if (candidate.element.contains(element) && (!root || root.element.contains(candidate.element)))
      root = candidate;
  if (!root || runtimeClosing || root.closing || root.failure)
    throw new Error('Web surface root is absent, closing or failed');
  const owner = root;
  let resolve!: () => void,
    finished = false;
  const lifetime = new Promise<void>((done) => {
    resolve = done;
  });
  root.surfaces.add(lifetime);
  return {
    complete(failure) {
      if (finished) return;
      finished = true;
      if (failure) {
        owner.failure = { error: failure.error };
        owner.retained.add(failure.retained);
      }
      owner.surfaces.delete(lifetime);
      resolve();
    },
  };
}
export interface WebApplicationOptions extends WebSkiaSurfaceOptions {
  /** The SDK entry point owns the document when it hosts a single view. */
  readonly ownsDocument?: boolean;
  /** A DOM boundary owned solely by this view. Defaults to its canvas. */
  readonly localeBoundary?: HTMLElement;
  /** Enable separately owned dialog surfaces when the browser admits a popup. */
  readonly enableDialogWindows?: boolean;
  readonly initializePlatformServices?: boolean;
  readonly useDefaultBinaryMessenger?: boolean;
  readonly platformMessages?: PlatformMessagePort;
  readonly backend?: BackendConnection;
  readonly deviceNamespace?: string;
  readonly safeArea?: WebSafeAreaSource;
  readonly canvas: HTMLCanvasElement;
  readonly input: HTMLInputElement;
  readonly button: HTMLButtonElement;
  readonly manifest: readonly AppAsset[];
  readonly assetsRoot: URL;
  readonly canvasKitRoot: URL;
  readonly canvasKitManifest: CanvasKitManifest;
  readonly profile?: string;
  /** Opt into capability-based worker selection or select a route for comparison. */
  readonly renderMode?: WebRenderMode;
  /** Grants replacement of a transferred canvas while keeping its view and app data. */
  readonly replaceCanvas?: (previous: HTMLCanvasElement) => HTMLCanvasElement;
  readonly signal?: AbortSignal;
  readonly onError?: (error: unknown) => void;
}
export interface WebApplication extends ComposedApplication {
  readonly rendering: WebRenderDiagnostics;
}
/** Start the shared verified runtime while the application module is loading. */
export async function prepareWebGraphics(root: URL, manifest: CanvasKitManifest): Promise<void> {
  await loadCanvasKit(root, manifest);
}
export function openApplication(
  definition: ApplicationDefinition,
  options: WebApplicationOptions,
): Promise<WebApplication> {
  if (runtimeClosing) return Promise.reject(new Error('Web runtime is closing'));
  let resolve!: (application: WebApplication) => void, reject!: (error: unknown) => void;
  const opening = new Promise<WebApplication>((done, fail) => {
      resolve = done;
      reject = fail;
    }),
    job: WebOpening = { opening };
  applications.add(job);
  void openWebApplication(definition, options, job).then(
    (application) => {
      const dispose = application.dispose.bind(application),
        lifetime = new OwnedDisposal([
          { name: 'application', run: dispose },
          {
            name: 'registration',
            run: () => {
              applications.delete(job);
              job.retained = undefined;
            },
          },
        ]);
      Object.assign(application, {
        dispose: () => lifetime.dispose(),
        retryDispose: () => lifetime.retryDispose(),
      });
      job.application = application;
      if (widgetRevision && !runtimeClosing) application.session.queueWidgetRebuild(widgetRevision);
      resolve(application);
    },
    (error) => {
      if (!(error instanceof AggregateError)) applications.delete(job);
      reject(error);
    },
  );
  return opening;
}
async function openWebApplication(
  definition: ApplicationDefinition,
  options: WebApplicationOptions,
  job: WebOpening,
): Promise<WebApplication> {
  const view = options.canvas.ownerDocument.defaultView;
  options.signal?.throwIfAborted();
  if (runtimeClosing || !view || view.closed || !options.canvas.isConnected)
    throw new Error('Web requires an open runtime and attached DOM canvas');
  const selected = createProviderRegistry().select('web', options.profile, {
    os: 'browser',
    architecture: 'wasm32',
    artifacts: ['canvaskit.js', 'canvaskit.wasm'],
  });
  const reads = new AbortController();
  const cancelReads = () => reads.abort(options.signal?.reason);
  options.signal?.addEventListener('abort', cancelReads, { once: true });
  const [ck, { WebSkiaLibrary }, files] = await Promise.all([
    loadCanvasKit(options.canvasKitRoot, options.canvasKitManifest),
    import('@nelyx/skia-web/library'),
    readBrowserAssets(
      options.manifest,
      options.assetsRoot,
      definition.assets ?? options.manifest,
      reads.signal,
    ),
  ]).finally(() => {
    options.signal?.removeEventListener('abort', cancelReads);
    reads.abort();
  });
  options.signal?.throwIfAborted();
  if (runtimeClosing || view.closed || !options.canvas.isConnected)
    throw new Error('Web surface opening cancelled');
  const nonce = Array.from(crypto.getRandomValues(new Uint32Array(4)), (word) =>
      word.toString(16).padStart(8, '0'),
    ).join(''),
    owner = Object.freeze({ id: 'web-view-' + nonce, generation: ++generation }),
    library = new WebSkiaLibrary(
      ck,
      () => options.canvas.ownerDocument.createElement('canvas'),
      owner,
      options,
    );
  let renderer: BrowserRenderer | undefined;
  let canvas: HTMLCanvasElement;
  let binding: ReturnType<typeof createWebServices>;
  job.retained = { library };
  try {
    renderer = new BrowserRenderer(library, options.canvas, owner, options, () => !runtimeClosing);
    job.retained = { library, renderer };
    canvas = await renderer.open();
    binding = createWebServices(
      library,
      renderer,
      canvas,
      options.input,
      options.button,
      selected.identity,
      owner,
      options.manifest,
      options.assetsRoot,
      definition,
      files,
      options.safeArea ?? options.backend?.safeArea?.(view),
      options,
    );
  } catch (error) {
    try {
      await (renderer?.dispose() ?? library.dispose());
    } catch (failure) {
      throw new AggregateError([error, failure], 'Web initialization native cleanup failed');
    }
    throw error;
  }
  job.retained = { library, renderer, binding };
  let platformMessages: PlatformMessagePort;
  let clipboard: ReturnType<BackendConnection['clipboard']> | undefined;
  const deviceScope = new DeviceScope();
  let deviceServices;
  try {
    const deviceOptions = {
      scope: deviceScope,
      root: options.assetsRoot,
      namespace: options.deviceNamespace ?? definition.id,
    };
    deviceServices =
      options.backend?.devices?.(view, deviceOptions) ??
      (options.backend?.host.target === 'tauri' ? {} : browserDeviceServices(view, deviceOptions));
    platformMessages =
      options.platformMessages ??
      createBrowserPlatformMessages(
        view,
        binding.cursor,
        binding.selectionContextMenu,
        {
          hostElement: canvas.parentElement!,
          viewId: binding.services.platformViewId ?? 0,
        },
        { key: binding.definition.id, root: options.assetsRoot },
        binding.definition.accessibilityEnabled !== false,
        (clipboard = options.backend?.clipboard(view)),
        {
          haptics: options.backend?.haptics?.(view),
          androidBack: options.backend?.androidBack?.(view),
          systemChrome: options.backend?.systemChrome?.(view),
        },
      );
  } catch (error) {
    const cleanup = await Promise.allSettled([
      deviceScope.dispose(),
      Promise.resolve().then(() => clipboard?.dispose()),
      Promise.resolve().then(() => binding.services.surface.dispose()),
    ]);
    const failures = cleanup.flatMap((result) =>
      result.status === 'rejected' ? [result.reason] : [],
    );
    if (failures.length)
      throw new AggregateError(
        [error, ...failures],
        'Web platform service initialization cleanup failed',
      );
    throw error;
  }
  const application = await bootstrapApplication(binding.definition, {
    ...binding.services,
    ...(options.enableDialogWindows
      ? {
          dialogWindows: webDialogWindows(
            binding.definition,
            { ...options, canvas },
            openApplication,
          ),
        }
      : {}),
    platformMessages,
    devices: { scope: deviceScope, services: deviceServices },
    initializePlatformServices: options.initializePlatformServices ?? !options.platformMessages,
    ...(options.useDefaultBinaryMessenger ? { useDefaultBinaryMessenger: true } : {}),
    ...(options.onError ? { reportError: options.onError } : {}),
  });
  return Object.defineProperty(application, 'rendering', {
    get: () => renderer.diagnostics,
  }) as WebApplication;
}
