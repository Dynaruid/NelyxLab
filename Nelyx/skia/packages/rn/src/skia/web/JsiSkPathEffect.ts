import type { CanvasKit, PathEffect } from "canvaskit-wasm";

import type {SkPathEffect} from "../types/Drawing.ts";

import {HostObject} from './Host.ts';

export class JsiSkPathEffect
  extends HostObject<PathEffect, "PathEffect">
  implements SkPathEffect
{
  constructor(CanvasKit: CanvasKit, ref: PathEffect) {
    super(CanvasKit, ref, "PathEffect");
  }
}
