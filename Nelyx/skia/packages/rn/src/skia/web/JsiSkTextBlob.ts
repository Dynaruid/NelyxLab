import type { CanvasKit, TextBlob } from 'canvaskit-wasm';

import type { SkTextBlob } from '@nelyx/skia-native/skia/types/Drawing';

import { HostObject } from './Host.ts';

export class JsiSkTextBlob extends HostObject<TextBlob, 'TextBlob'> implements SkTextBlob {
  constructor(CanvasKit: CanvasKit, ref: TextBlob) {
    super(CanvasKit, ref, 'TextBlob');
  }
}
