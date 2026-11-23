import type { ProviderCohort } from '@nelyx/sdk/runtime/cohorts';
import type { BackendIdentity } from '@nelyx/sdk/backends/backend-contract';
import type { ViteDevServer } from 'vite';

export interface WebRunnerOptions {
  readonly app: string;
  readonly directory?: string;
  readonly host?: string;
  readonly port?: number;
  readonly base?: string;
  readonly updateLock?: boolean;
}
interface BrowserResult {
  readonly provider: 'web';
  readonly host: 'browser';
  readonly target: 'web';
  readonly os: string;
}
export interface FrontendPreparation {
  readonly schema: 'nelyx.prepare/v4';
  readonly target: 'web' | 'tauri';
  readonly app: string;
  readonly runner: string;
  readonly cohort: ProviderCohort;
}
export type WebPreparation = FrontendPreparation &
  BrowserResult & { readonly backend: BackendIdentity };
interface WebDevEvent {
  readonly event: 'nelyx.dev.ready';
  readonly format: 'web' | 'pwa' | 'tauri';
  readonly provider: 'web';
  readonly host: 'browser' | 'tauri';
  readonly os: string;
  readonly target: 'web' | 'tauri';
  readonly app: string;
  readonly runner: string;
  readonly session: string;
  readonly url: string;
}
export function doctorWeb(options: Pick<WebRunnerOptions, 'app'>): BrowserResult & {
  schema: 'nelyx.doctor/v4';
  app: string;
} & (
    | { ready: true; exitCode: 0; runner: string; cohort: ProviderCohort; backend: BackendIdentity }
    | { ready: false; exitCode: 1; error: string }
  );
export function prepareFrontend(app: string, target: 'web' | 'tauri'): FrontendPreparation;
export function prepareWeb(
  options: Pick<WebRunnerOptions, 'app' | 'updateLock'>,
  signal: AbortSignal,
): Promise<WebPreparation>;
export function buildWebApplication(
  options: Pick<WebRunnerOptions, 'app'>,
  signal: AbortSignal,
): Promise<
  BrowserResult & {
    schema: 'nelyx.frontend-build/v1';
    format: 'web' | 'pwa';
    directory: string;
    buildId: string;
    entry: string;
    fileCount: number;
    bytes: number;
  }
>;
export function openVite(
  options: WebRunnerOptions & {
    advertisedHost?: string;
    target?: 'web' | 'tauri';
    os?: string;
    backend: { identity: BackendIdentity; files?: ReadonlyMap<string, Uint8Array> };
  },
  signal: AbortSignal,
): Promise<{
  server: ViteDevServer;
  event: WebDevEvent;
  healthUrl: string;
  frontend: {
    updateBackend(
      backend: { identity: BackendIdentity; files?: ReadonlyMap<string, Uint8Array> },
      notify?: boolean,
    ): void;
  };
}>;
export function devWeb(
  options: WebRunnerOptions,
  signal: AbortSignal,
): Promise<WebDevEvent & { exitCode: 0 }>;
export function runWeb(
  options: WebRunnerOptions,
  signal: AbortSignal,
): Promise<
  BrowserResult & {
    schema: 'nelyx.run/v4';
    format: 'web' | 'pwa';
    url: string;
    directory: string;
    buildId: string;
    exitCode: 0;
  }
>;
export function webDirectory(app: string): string;
export function hostOs(): string;
