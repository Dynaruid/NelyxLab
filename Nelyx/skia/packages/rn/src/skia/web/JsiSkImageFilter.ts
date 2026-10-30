import type { CanvasKit, ImageFilter } from 'canvaskit-wasm';

import type { SkImageFilter } from '@nelyx/skia-native/skia/types/ImageFilter/ImageFilter';

import { HostObject } from './Host.ts';

export class JsiSkImageFilter
  extends HostObject<ImageFilter, 'ImageFilter'>
  implements SkImageFilter
{
  constructor(CanvasKit: CanvasKit, ref: ImageFilter) {
    super(CanvasKit, ref, 'ImageFilter');
  }
}
