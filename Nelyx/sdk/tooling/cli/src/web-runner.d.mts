export interface WebRunnerOptions {
  readonly app: string;
  readonly directory?: string;
  readonly output?: string;
  readonly configuration?: 'Release';
  readonly host?: '127.0.0.1' | '::1' | 'localhost';
  readonly port?: number;
}
export interface WebServer {
  readonly url: string;
  readonly directory: string;
  close(): Promise<void>;
}
export function doctorWeb(options: Pick<WebRunnerOptions, 'app'>): Promise<unknown>;
export function devWeb(options: {
  readonly app: string;
  readonly host?: '127.0.0.1' | 'localhost';
  readonly port?: number;
}): Promise<{
  schema: 'nelyx.dev/v2';
  target: 'web';
  exitCode: number;
  url?: string;
  runner?: string;
  scope: string;
  qualification: 'notVerified';
}>;
export function prepareWeb(options: Pick<WebRunnerOptions, 'app'>): Promise<unknown>;
export function buildWebApplication(options: WebRunnerOptions): Promise<unknown>;
export function serveWeb(options: WebRunnerOptions): Promise<WebServer>;
export function runWeb(
  options: WebRunnerOptions,
): Promise<{ schema: 'nelyx.run/v3'; target: 'web'; exitCode: number }>;
export function packWeb(options: WebRunnerOptions): unknown;
