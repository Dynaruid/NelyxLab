// TODO: suggest to rename SkPicture to Picture for consistency
import type { CanvasKit, SkPicture as Picture } from "canvaskit-wasm";

import type {FilterMode} from "../types/Drawing.ts";
import type {SkRect} from '../types/Rect.ts';
import type {TileMode} from '../types/ImageFilter/ImageFilter.ts';
import type {SkPicture} from "../types/Drawing.ts";
import type {SkMatrix} from "../types/Drawing.ts";

import {HostObject, getEnum} from './Host.ts';
import {JsiSkShader} from './JsiSkShader.ts';
import {JsiSkMatrix} from './JsiSkMatrix.ts';
import {JsiSkRect} from './JsiSkRect.ts';

export class JsiSkPicture
  extends HostObject<Picture, "Picture">
  implements SkPicture
{
  constructor(CanvasKit: CanvasKit, ref: Picture) {
    super(CanvasKit, ref, "Picture");
  }

  makeShader(
    tmx: TileMode,
    tmy: TileMode,
    mode: FilterMode,
    localMatrix?: SkMatrix,
    tileRect?: SkRect
  ) {
    return new JsiSkShader(
      this.CanvasKit,
      this.ref.makeShader(
        getEnum(this.CanvasKit, "TileMode", tmx),
        getEnum(this.CanvasKit, "TileMode", tmy),
        getEnum(this.CanvasKit, "FilterMode", mode),
        localMatrix ? JsiSkMatrix.fromValue(localMatrix) : undefined,
        tileRect ? JsiSkRect.fromValue(this.CanvasKit, tileRect) : undefined
      )
    );
  }

  approximateBytesUsed():number{return this.ref.approximateBytesUsed();}

  serialize() {
    return this.ref.serialize();
  }
}
