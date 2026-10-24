import type { CanvasKit, TextBlob } from "canvaskit-wasm";

import type {SkTextBlob} from "../types/Drawing.ts";

import {HostObject} from './Host.ts';

export class JsiSkTextBlob
  extends HostObject<TextBlob, "TextBlob">
  implements SkTextBlob
{
  constructor(CanvasKit: CanvasKit, ref: TextBlob) {
    super(CanvasKit, ref, "TextBlob");
  }
}
