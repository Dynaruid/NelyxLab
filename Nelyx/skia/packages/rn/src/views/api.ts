import type { ISkiaViewApi } from './types.ts';

declare global {
  var SkiaViewApi: ISkiaViewApi;
}

export const { SkiaViewApi } = globalThis;
