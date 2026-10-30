import type { CanvasKit, Typeface } from 'canvaskit-wasm';

import type { SkTypeface } from '@nelyx/skia-native/skia/types/Typeface/Typeface';

import { HostObject } from './Host.ts';

export class JsiSkTypeface extends HostObject<Typeface, 'Typeface'> implements SkTypeface {
  constructor(CanvasKit: CanvasKit, ref: Typeface) {
    super(CanvasKit, ref, 'Typeface');
  }

  get bold(): boolean {
    console.warn(
      'Typeface.bold is deprecated and will be removed in a future release. The property will return false.',
    );
    return false;
  }

  get italic(): boolean {
    console.warn(
      'Typeface.italic is deprecated and will be removed in a future release. The property will return false.',
    );
    return false;
  }

  getGlyphIDs(str: string, numCodePoints?: number) {
    return Array.from(this.ref.getGlyphIDs(str, numCodePoints));
  }
}
