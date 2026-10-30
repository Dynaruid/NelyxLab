import type { CanvasKit, Shader } from 'canvaskit-wasm';

import type { SkShader } from '@nelyx/skia-native/skia/types/Drawing';

import { HostObject } from './Host.ts';

export class JsiSkShader extends HostObject<Shader, 'Shader'> implements SkShader {
  constructor(CanvasKit: CanvasKit, ref: Shader) {
    super(CanvasKit, ref, 'Shader');
  }
  nelyxIsValid(): boolean {
    return this.ref !== null;
  }
}
