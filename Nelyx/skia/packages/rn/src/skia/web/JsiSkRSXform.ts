import {arrayItem} from '../../runtime/arrays.ts';
import type { CanvasKit } from "canvaskit-wasm";

import type {SkRSXform} from '../types/RSXform.ts';

import {BaseHostObject} from './Host.ts';

export type RSXform = Float32Array;

export class JsiSkRSXform
  extends BaseHostObject<RSXform, "RSXform">
  implements SkRSXform
{
  static fromValue(rsxform: SkRSXform) {
    if (rsxform instanceof JsiSkRSXform) {
      return rsxform.ref;
    }
    return Float32Array.of(rsxform.scos, rsxform.ssin, rsxform.tx, rsxform.ty);
  }

  constructor(CanvasKit: CanvasKit, ref: RSXform) {
    super(CanvasKit, ref, "RSXform");
  }

  set(scos: number, ssin: number, tx: number, ty: number) {
    this.ref[0] = scos;
    this.ref[1] = ssin;
    this.ref[2] = tx;
    this.ref[3] = ty;
  }

  get scos() {
    return arrayItem(this.ref, 0);
  }

  get ssin() {
    return arrayItem(this.ref, 1);
  }

  get tx() {
    return arrayItem(this.ref, 2);
  }

  get ty() {
    return arrayItem(this.ref, 3);
  }
}
