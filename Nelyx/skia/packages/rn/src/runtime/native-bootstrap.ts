import type {Skia} from '../skia/types/Skia.ts';
import type {SkiaGraphiteView} from '../views/SkiaGraphiteView.tsx';
import type {GraphiteRenderer} from '../renderer.ts';
import type {ReactNativeTextLayoutService} from '../text.ts';

export interface NativeSkiaBackend {
  readonly Skia: Skia;
  readonly SkiaGraphiteView: typeof SkiaGraphiteView;
  createRenderer(...parameters: ConstructorParameters<typeof GraphiteRenderer>): GraphiteRenderer;
  createTextService(...parameters: ConstructorParameters<typeof ReactNativeTextLayoutService>): ReactNativeTextLayoutService;
}
let backend: NativeSkiaBackend | undefined;
/** Explicit JSI installation. Importing this module does not load React/RN or Skia. */
export function initializeNativeSkia(): NativeSkiaBackend {
  if(backend)return backend;
  require('../skia/NativeSetup.ts');
  const {Skia}=require('../skia/Skia.ts');
  const {SkiaGraphiteView}=require('../views/SkiaGraphiteView.tsx');
  const {GraphiteRenderer}=require('../renderer.ts');
  const {ReactNativeTextLayoutService}=require('../text.ts');
  backend={Skia,SkiaGraphiteView,
    createRenderer(...parameters) {return new GraphiteRenderer(...parameters);},
    createTextService(...parameters) {return new ReactNativeTextLayoutService(...parameters);},
  };
  return backend;
}
