export interface CreateAppOptions {
  readonly name?: string;
  readonly designs?: readonly ('material' | 'cupertino')[];
  readonly packages?: string;
  readonly target?: 'web' | 'tauri' | 'both';
  readonly staticWeb?: boolean;
  readonly noBackend?: boolean;
}
export function createApp(destination: string, options?: CreateAppOptions): string;
