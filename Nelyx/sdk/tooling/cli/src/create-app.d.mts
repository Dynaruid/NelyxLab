export interface CreateAppOptions {
  readonly name?: string;
  readonly designs?: readonly ('material' | 'cupertino')[];
  readonly packages?: string;
}
export function createApp(destination: string, options?: CreateAppOptions): string;
