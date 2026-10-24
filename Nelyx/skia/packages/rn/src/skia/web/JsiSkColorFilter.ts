import type { CanvasKit, ColorFilter } from "canvaskit-wasm";

import type {SkColorFilter} from '../types/ColorFilter/ColorFilter.ts';

import {HostObject} from './Host.ts';

export class JsiSkColorFilter
  extends HostObject<ColorFilter, "ColorFilter">
  implements SkColorFilter
{
  constructor(CanvasKit: CanvasKit, ref: ColorFilter) {
    super(CanvasKit, ref, "ColorFilter");
  }
}
