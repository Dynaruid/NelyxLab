import { arrayItem } from '@nelyx/skia-native/runtime/arrays';
import type { CanvasKit, RRect } from 'canvaskit-wasm';

import type { InputRRect, SkRRect } from '@nelyx/skia-native/skia/types/RRect';
import type { SkRect } from '@nelyx/skia-native/skia/types/Rect';

import { BaseHostObject } from './Host.ts';
import { JsiSkRect } from './JsiSkRect.ts';

export class JsiSkRRect extends BaseHostObject<RRect, 'RRect'> implements SkRRect {
  [Symbol.dispose]() {
    // nothing to do here, RRect is a Float32Array
  }

  static fromValue(CanvasKit: CanvasKit, rect: InputRRect) {
    if (rect instanceof JsiSkRRect) {
      return rect.ref;
    }
    if ('topLeft' in rect && 'topRight' in rect && 'bottomRight' in rect && 'bottomLeft' in rect) {
      const bounds = JsiSkRect.fromValue(CanvasKit, rect.rect);
      return Float32Array.of(
        arrayItem(bounds, 0),
        arrayItem(bounds, 1),
        arrayItem(bounds, 2),
        arrayItem(bounds, 3),
        rect.topLeft.x,
        rect.topLeft.y,
        rect.topRight.x,
        rect.topRight.y,
        rect.bottomRight.x,
        rect.bottomRight.y,
        rect.bottomLeft.x,
        rect.bottomLeft.y,
      );
    }
    return CanvasKit.RRectXY(JsiSkRect.fromValue(CanvasKit, rect.rect), rect.rx, rect.ry);
  }

  constructor(CanvasKit: CanvasKit, rect: SkRect, rx: number, ry: number) {
    // based on https://github.com/google/skia/blob/main/src/core/SkRRect.cpp#L51
    if (rx === Infinity || ry === Infinity) {
      rx = ry = 0;
    }
    if (rect.width < rx + rx || rect.height < ry + ry) {
      // At most one of these two divides will be by zero, and neither numerator is zero.
      const scale = Math.min(rect.width / (rx + rx), rect.height / (ry + ry));
      rx *= scale;
      ry *= scale;
    }
    const ref = CanvasKit.RRectXY(JsiSkRect.fromValue(CanvasKit, rect), rx, ry);
    super(CanvasKit, ref, 'RRect');
  }

  get rx() {
    return arrayItem(this.ref, 4);
  }

  get ry() {
    return arrayItem(this.ref, 5);
  }

  get rect() {
    return new JsiSkRect(
      this.CanvasKit,
      Float32Array.of(...[0, 1, 2, 3].map((index) => arrayItem(this.ref, index))),
    );
  }
}
