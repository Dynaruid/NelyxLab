// TODO: suggest to rename SkPicture to Picture for consistency
import type { CanvasKit, SkPicture as Picture } from 'canvaskit-wasm';

import type { FilterMode } from '@nelyx/skia-native/skia/types/Drawing';
import type { SkRect } from '@nelyx/skia-native/skia/types/Rect';
import type { TileMode } from '@nelyx/skia-native/skia/types/ImageFilter/ImageFilter';
import type { SkPicture } from '@nelyx/skia-native/skia/types/Drawing';
import type { SkMatrix } from '@nelyx/skia-native/skia/types/Drawing';

import { HostObject, getEnum } from './Host.ts';
import { JsiSkShader } from './JsiSkShader.ts';
import { JsiSkMatrix } from './JsiSkMatrix.ts';
import { JsiSkRect } from './JsiSkRect.ts';

export class JsiSkPicture extends HostObject<Picture, 'Picture'> implements SkPicture {
  constructor(CanvasKit: CanvasKit, ref: Picture) {
    super(CanvasKit, ref, 'Picture');
  }

  makeShader(
    tmx: TileMode,
    tmy: TileMode,
    mode: FilterMode,
    localMatrix?: SkMatrix,
    tileRect?: SkRect,
  ) {
    return new JsiSkShader(
      this.CanvasKit,
      this.ref.makeShader(
        getEnum(this.CanvasKit, 'TileMode', tmx),
        getEnum(this.CanvasKit, 'TileMode', tmy),
        getEnum(this.CanvasKit, 'FilterMode', mode),
        localMatrix ? JsiSkMatrix.fromValue(localMatrix) : undefined,
        tileRect ? JsiSkRect.fromValue(this.CanvasKit, tileRect) : undefined,
      ),
    );
  }

  approximateBytesUsed(): number {
    return this.ref.approximateBytesUsed();
  }

  serialize() {
    return this.ref.serialize();
  }
}
