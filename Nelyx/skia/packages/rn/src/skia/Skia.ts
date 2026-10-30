/*global SkiaApi*/
import type { Skia as SkSkiaApi } from './types/Skia.ts';

/**
 * Declares the SkiaApi as an available object in the global scope
 */
declare global {
  var SkiaApi: SkSkiaApi;
}

export const Skia = SkiaApi;
