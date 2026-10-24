import type { CanvasKit, MaskFilter } from "canvaskit-wasm";

import type {SkMaskFilter} from '../types/MaskFilter.ts';

import {HostObject} from './Host.ts';

export class JsiSkMaskFilter
  extends HostObject<MaskFilter, "MaskFilter">
  implements SkMaskFilter
{
  constructor(CanvasKit: CanvasKit, ref: MaskFilter) {
    super(CanvasKit, ref, "MaskFilter");
  }
}
