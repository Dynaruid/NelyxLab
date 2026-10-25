import type {Skia} from '../skia/types/Skia.ts';
import type {SkiaGraphiteView} from '../views/SkiaGraphiteView.tsx';

export interface NativeSkiaBackend {
  readonly Skia: Skia;
  readonly SkiaGraphiteView: typeof SkiaGraphiteView;
}
let backend: NativeSkiaBackend | undefined;
/** Explicit JSI installation. Importing this module does not load React/RN or Skia. */
export function initializeNativeSkia(): NativeSkiaBackend {
  if(backend)return backend;
  require('../skia/NativeSetup.ts');
  const {Skia}=require('../skia/Skia.ts');
  const {SkiaGraphiteView}=require('../views/SkiaGraphiteView.tsx');
  backend={Skia,SkiaGraphiteView};
  return backend;
}
