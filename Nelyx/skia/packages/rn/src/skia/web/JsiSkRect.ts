import {arrayItem} from '../../runtime/arrays.ts';
import type { CanvasKit, Rect } from "canvaskit-wasm";

import type {SkHostRect, SkRect} from '../types/Rect.ts';

import {BaseHostObject} from './Host.ts';

export class JsiSkRect
  extends BaseHostObject<Rect, "Rect">
  implements SkHostRect
{
  static fromValue(CanvasKit: CanvasKit, rect: SkRect) {
    if (rect instanceof JsiSkRect) {
      return rect.ref;
    }
    return CanvasKit.XYWHRect(rect.x, rect.y, rect.width, rect.height);
  }

  constructor(CanvasKit: CanvasKit, ref: Rect) {
    super(CanvasKit, ref, "Rect");
  }

  setXYWH(x: number, y: number, width: number, height: number): void {
    this.ref[0] = x;
    this.ref[1] = y;
    this.ref[2] = x + width;
    this.ref[3] = y + height;
  }

  setLTRB(left: number, top: number, right: number, bottom: number): void {
    this.ref[0] = left;
    this.ref[1] = top;
    this.ref[2] = right;
    this.ref[3] = bottom;
  }

  get x() {
    return arrayItem(this.ref, 0);
  }

  get y() {
    return arrayItem(this.ref, 1);
  }

  get width() {
    return arrayItem(this.ref, 2) - arrayItem(this.ref, 0);
  }

  get height() {
    return arrayItem(this.ref, 3) - arrayItem(this.ref, 1);
  }
}
