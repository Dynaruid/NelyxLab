import type { CanvasKit, Vertices } from "canvaskit-wasm";

import type {SkVertices} from '../types/Vertices/Vertices.tsx';

import {HostObject} from './Host.ts';
import {JsiSkRect} from './JsiSkRect.ts';

export class JsiSkVertices
  extends HostObject<Vertices, "Vertices">
  implements SkVertices
{
  constructor(CanvasKit: CanvasKit, ref: Vertices) {
    super(CanvasKit, ref, "Vertices");
  }

  bounds() {
    return new JsiSkRect(this.CanvasKit, this.ref.bounds());
  }

  uniqueID() {
    return this.ref.uniqueID();
  }
}
