import { OwnedDisposal, finishOwnedDisposal } from '../../runtime/owned-disposal.ts';
import type { ComponentType } from 'react';
import type { ApplicationDefinition } from '@nelyx/core/hosting/runtime';
import type { ViewOwner } from '@nelyx/core/ui/types';
import type { PlatformMessagePort } from '@nelyx/core/hosting/platform-messages';
import type { ComposedApplication } from '../../runtime/bootstrap.ts';
import type { ResolvedAppAsset as AppAsset } from '../../runtime/config.ts';
import type { CanvasKitManifest } from '../../backends/browser/canvaskit.ts';
import { createProviderRegistry } from '../../runtime/providers.ts';
import { bootstrapApplication } from '../../runtime/bootstrap.ts';
import { createWebServices } from '../../backends/browser/services.ts';
import { loadCanvasKit } from '../../backends/browser/canvaskit.ts';
import { createBrowserPlatformMessages } from '../../backends/browser/platform-messages.ts';
interface WebBackend {
  react: typeof import('react');
  native: {
    View: ComponentType<any>;
    TextInput: ComponentType<any>;
    AppRegistry: {
      registerComponent(name: string, application: () => ComponentType): void;
      runApplication(name: string, options: { rootTag: HTMLElement }): { unmount(): void };
    };
  };
}
let backend: WebBackend | undefined,
  generation = 0;
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
  retained?: unknown;
}
const applications = new Set<WebOpening>();
export interface WebApplicationDiagnostics {
  readonly owner: ViewOwner;
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
    const library = (
      job.retained as
        | {
            library?: {
              readonly debugOwner: ViewOwner;
              readonly debugTextStats: WebApplicationDiagnostics['text'];
            };
          }
        | undefined
    )?.library;
    if (!library) continue;
    const text = library.debugTextStats,
      owner = library.debugOwner;
    if (!owner || !Number.isInteger(text.producers) || !Number.isInteger(text.retainedOnly))
      throw new Error('Matching Web text diagnostics cohort is required');
    snapshots.push(
      Object.freeze({ owner: Object.freeze({ ...owner }), text: Object.freeze({ ...text }) }),
    );
  }
  return Object.freeze(snapshots);
}
let runtimeClosing = false,
  shutdown: Promise<void> | undefined;
export function webBackend(): WebBackend {
  if (!backend) throw new Error('Call Web registerApplication before rendering');
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
  if (!backend)
    backend = {
      react: require('react') as WebBackend['react'],
      native: require('react-native-web') as WebBackend['native'],
    };
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
    backend.native.AppRegistry.registerComponent(name, () => application);
    const mounted = backend.native.AppRegistry.runApplication(name, { rootTag });
    root.unmount = () => mounted.unmount();
  } catch (error) {
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
export interface WebApplicationOptions {
  readonly initializePlatformServices?: boolean;
  readonly useDefaultBinaryMessenger?: boolean;
  readonly platformMessages?: PlatformMessagePort;
  readonly canvas: HTMLCanvasElement;
  readonly input: HTMLInputElement;
  readonly button: HTMLButtonElement;
  readonly manifest: readonly AppAsset[];
  readonly assetsRoot: URL;
  readonly canvasKitRoot: URL;
  readonly canvasKitManifest: CanvasKitManifest;
  readonly profile?: string;
  readonly onError?: (error: unknown) => void;
}
export interface WebApplication extends ComposedApplication {}
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
  if (runtimeClosing || typeof document === 'undefined' || !options.canvas.isConnected)
    throw new Error('Web requires an open runtime and attached DOM canvas');
  const selected = createProviderRegistry().select('web', options.profile, {
    os: 'browser',
    architecture: 'wasm32',
    artifacts: ['canvaskit.js', 'canvaskit.wasm'],
  });
  const [ck, { WebSkiaLibrary }] = await Promise.all([
    loadCanvasKit(options.canvasKitRoot, options.canvasKitManifest),
    import('@nelyx/skia-web/library'),
  ]);
  if (runtimeClosing || !options.canvas.isConnected)
    throw new Error('Web surface opening cancelled');
  const owner = Object.freeze({ id: 'web-view-' + crypto.randomUUID(), generation: ++generation }),
    library = new WebSkiaLibrary(ck, options.canvas, owner);
  let binding: ReturnType<typeof createWebServices>;
  job.retained = { library };
  try {
    binding = createWebServices(
      library,
      options.canvas,
      options.input,
      options.button,
      selected.identity,
      owner,
      options.manifest,
      options.assetsRoot,
      definition,
    );
  } catch (error) {
    try {
      await library.dispose();
    } catch (failure) {
      throw new AggregateError([error, failure], 'Web initialization native cleanup failed');
    }
    throw error;
  }
  job.retained = { library, binding };
  const application = await bootstrapApplication(binding.definition, {
    ...binding.services,
    platformMessages:
      options.platformMessages ??
      createBrowserPlatformMessages(
        window,
        binding.cursor,
        binding.selectionContextMenu,
        {
          hostElement: options.canvas.parentElement!,
          viewId: binding.services.platformViewId ?? 0,
        },
        { key: binding.definition.id },
        binding.definition.accessibilityEnabled !== false,
      ),
    initializePlatformServices: options.initializePlatformServices ?? !options.platformMessages,
    ...(options.useDefaultBinaryMessenger ? { useDefaultBinaryMessenger: true } : {}),
    ...(options.onError ? { reportError: options.onError } : {}),
  });
  return application;
}
