import type {ImageFilterFactory} from './ImageFilter/ImageFilterFactory.ts';
import type {PathFactory} from './Path/PathFactory.ts';
import type {PathBuilderFactory} from './Path/PathBuilderFactory.ts';
import type {ColorFilterFactory} from './ColorFilter/ColorFilterFactory.ts';
import type {SkFont} from "./Drawing.ts";
import type {FontMgrFactory} from './Font/FontMgrFactory.ts';
import type {SkTypeface} from './Typeface/Typeface.ts';
import type {TypefaceFactory} from './Typeface/TypefaceFactory.ts';
import type {ImageFactory} from "./Drawing.ts";
import type {MaskFilterFactory} from './MaskFilter.ts';
import type {SkPaint} from "./Drawing.ts";
import type {SkHostRect, SkRect} from './Rect.ts';
import type {SkRRect} from './RRect.ts';
import type {RuntimeEffectFactory} from './RuntimeEffect/RuntimeEffectFactory.ts';
import type {SkRuntimeEffect, SkRuntimeShaderBuilder} from "./Drawing.ts";
import type {ShaderFactory} from './Shader/ShaderFactory.ts';
import type {SkMatrix} from "./Drawing.ts";
import type {PathEffectFactory} from "./Drawing.ts";
import type {SkPoint} from './Point.ts';
import type {SkVertices, VertexMode} from './Vertices/Vertices.tsx';
import type {DataFactory} from './Data/DataFactory.ts';
import type {SVGFactory} from './SVG/SVGFactory.ts';
import type {TextBlobFactory} from "./Drawing.ts";
import type {SurfaceFactory} from './Surface/SurfaceFactory.ts';
import type {SkRSXform} from './RSXform.ts';
import type {SkPath} from "./Drawing.ts";
import type {SkContourMeasureIter} from './ContourMeasure.tsx';
import type {PictureFactory} from './Picture/PictureFactory.ts';
import type {SkPictureRecorder} from './Picture/PictureRecorder.ts';
import type {Color, SkColor} from './Color.ts';
import type {TypefaceFontProviderFactory} from './Paragraph/TypefaceFontProviderFactory.ts';
import type {AnimatedImageFactory} from './AnimatedImage/AnimatedImageFactory.ts';
import type {ParagraphBuilderFactory} from './Paragraph/ParagraphBuilder.ts';
import type {JsiRecorder} from './Recorder.ts';
import type {SkottieFactory} from './Skottie.ts';

/**
 * Declares the interface for the native Skia API
 */
export interface Skia {
  Point: (x: number, y: number) => SkPoint;
  XYWHRect: (x: number, y: number, width: number, height: number) => SkHostRect;
  RuntimeShaderBuilder: (rt: SkRuntimeEffect) => SkRuntimeShaderBuilder;
  RRectXY: (rect: SkRect, rx: number, ry: number) => SkRRect;
  RSXform: (scos: number, ssin: number, tx: number, ty: number) => SkRSXform;
  RSXformFromRadians: (
    scale: number,
    radians: number,
    tx: number,
    ty: number,
    px: number,
    py: number
  ) => SkRSXform;
  Color: (color: Color) => SkColor;
  ContourMeasureIter: (
    path: SkPath,
    forceClosed: boolean,
    resScale: number
  ) => SkContourMeasureIter;
  Paint: () => SkPaint;
  PictureRecorder: () => SkPictureRecorder;
  Picture: PictureFactory;
  Path: PathFactory;
  PathBuilder: PathBuilderFactory;
  Matrix: (matrix?: readonly number[]) => SkMatrix;
  ColorFilter: ColorFilterFactory;
  Font: (typeface?: SkTypeface, size?: number) => SkFont;
  Typeface: TypefaceFactory;
  TypefaceFontProvider: TypefaceFontProviderFactory;
  FontMgr: FontMgrFactory;
  MaskFilter: MaskFilterFactory;
  RuntimeEffect: RuntimeEffectFactory;
  ImageFilter: ImageFilterFactory;
  Shader: ShaderFactory;
  PathEffect: PathEffectFactory;
  /**
   * Returns an Vertices based on the given positions and optional parameters.
   * See SkVertices.h (especially the Builder) for more details.
   * @param mode
   * @param positions
   * @param textureCoordinates
   * @param colors - either a list of int colors or a flattened color array.
   * @param indices
   * @param isVolatile
   */
  MakeVertices(
    mode: VertexMode,
    positions: SkPoint[],
    textureCoordinates?: SkPoint[] | null,
    colors?: SkColor[],
    indices?: number[] | null,
    isVolatile?: boolean
  ): SkVertices;
  Data: DataFactory;
  Image: ImageFactory;
  AnimatedImage: AnimatedImageFactory;
  SVG: SVGFactory;
  TextBlob: TextBlobFactory;
  Surface: SurfaceFactory;
  ParagraphBuilder: ParagraphBuilderFactory;
  Skottie: SkottieFactory;
  Recorder(): JsiRecorder;
  /**
   * Raw WGPUDevice pointer of Skia's Graphite device, as a BigInt. Pass it to
   * react-native-webgpu's importDevice() to get a GPUDevice sharing Skia's
   * device (zero-copy interop). Native only.
   */
  getNativeDevice(): bigint;
}
