import type { CanvasKit, ImageFilter } from "canvaskit-wasm";

import type {SkImageFilter} from '../types/ImageFilter/ImageFilter.ts';

import {HostObject} from './Host.ts';

export class JsiSkImageFilter
  extends HostObject<ImageFilter, "ImageFilter">
  implements SkImageFilter
{
  constructor(CanvasKit: CanvasKit, ref: ImageFilter) {
    super(CanvasKit, ref, "ImageFilter");
  }
}
