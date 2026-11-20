import type { ProviderCohort } from '@nelyx/sdk/runtime/cohorts';
import type { ViteDevServer } from 'vite';

export interface WebRunnerOptions {
  readonly app: string;
  readonly directory?: string;
  readonly host?: string;
  readonly port?: number;
  readonly base?: string;
}
interface BrowserResult {
  readonly format: 'pwa';
  readonly provider: 'web';
  readonly host: 'browser';
  readonly os: string;
}
export interface WebPreparation extends BrowserResult {
  readonly schema: 'nelyx.prepare/v3';
  readonly app: string;
  readonly runner: string;
  readonly cohort: ProviderCohort;
  readonly warnings: readonly string[];
}
interface WebDevEvent {
  readonly event: 'nelyx.dev.ready';
  readonly format: 'pwa';
  readonly provider: 'web';
  readonly host: 'browser' | 'tauri';
  readonly os: string;
  readonly target: 'web';
  readonly app: string;
  readonly runner: string;
  readonly session: string;
  readonly url: string;
}
export function doctorWeb(options: Pick<WebRunnerOptions, 'app'>): BrowserResult & {
  schema: 'nelyx.doctor/v3';
  app: string;
} & (
    | { ready: true; exitCode: 0; runner: string; cohort: ProviderCohort; warnings: string[] }
    | { ready: false; exitCode: 1; error: string }
  );
export function prepareWeb(options: Pick<WebRunnerOptions, 'app'>): WebPreparation;
export function buildWebApplication(
  options: Pick<WebRunnerOptions, 'app'>,
  signal: AbortSignal,
): Promise<
  BrowserResult & {
    schema: 'nelyx.pwa-build/v1';
    directory: string;
    buildId: string;
    entry: string;
    fileCount: number;
    bytes: number;
  }
>;
export function openVite(
  options: WebRunnerOptions & { advertisedHost?: string; tauri?: boolean; os?: string },
  signal: AbortSignal,
): Promise<{
  server: ViteDevServer;
  event: WebDevEvent;
  healthUrl: string;
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
    schema: 'nelyx.run/v3';
    url: string;
    directory: string;
    buildId: string;
    exitCode: 0;
  }
>;
export function pwaDirectory(app: string): string;
export function hostOs(): string;
