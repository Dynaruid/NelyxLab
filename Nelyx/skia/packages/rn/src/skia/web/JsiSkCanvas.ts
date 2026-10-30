import { arrayItem } from '@nelyx/skia-native/runtime/arrays';
import type {
  Canvas,
  CanvasKit,
  CubicResampler as CKCubicResampler,
  FilterOptions as CKFilterOptions,
} from 'canvaskit-wasm';

import { type BlendMode } from '@nelyx/skia-native/skia/types/Paint/BlendMode';
import {
  type ClipOp,
  type SaveLayerFlag,
  type SkCanvas,
} from '@nelyx/skia-native/skia/types/Drawing';
import {
  type FilterMode,
  type MipmapMode,
  type SkImage,
  type CubicResampler,
  type FilterOptions,
  isCubicSampling,
} from '@nelyx/skia-native/skia/types/Drawing';
import { type PointMode, type SkPoint } from '@nelyx/skia-native/skia/types/Point';
import { type ImageInfo } from '@nelyx/skia-native/skia/types/Drawing';
import { type SkColor } from '@nelyx/skia-native/skia/types/Color';
import { type SkFont } from '@nelyx/skia-native/skia/types/Drawing';
import { type SkImageFilter } from '@nelyx/skia-native/skia/types/ImageFilter/ImageFilter';
import { type SkMatrix } from '@nelyx/skia-native/skia/types/Drawing';
import { type SkPaint } from '@nelyx/skia-native/skia/types/Drawing';
import { type SkPath } from '@nelyx/skia-native/skia/types/Drawing';
import { type SkPicture } from '@nelyx/skia-native/skia/types/Drawing';
import { type SkRect } from '@nelyx/skia-native/skia/types/Rect';
import { type InputRRect } from '@nelyx/skia-native/skia/types/RRect';
import { type SkSVG } from '@nelyx/skia-native/skia/types/SVG/SVG';
import { type SkTextBlob } from '@nelyx/skia-native/skia/types/Drawing';
import { type SkVertices } from '@nelyx/skia-native/skia/types/Vertices/Vertices';
import { type SkRSXform } from '@nelyx/skia-native/skia/types/RSXform';

import { getEnum, HostObject } from './Host.ts';
import { JsiSkPaint } from './JsiSkPaint.ts';
import { JsiSkRect } from './JsiSkRect.ts';
import { JsiSkRRect } from './JsiSkRRect.ts';
import { JsiSkImage } from './JsiSkImage.ts';
import { JsiSkVertices } from './JsiSkVertices.ts';
import { JsiSkPath } from './JsiSkPath.ts';
import { JsiSkFont } from './JsiSkFont.ts';
import { JsiSkTextBlob } from './JsiSkTextBlob.ts';
import { JsiSkPicture } from './JsiSkPicture.ts';
import { JsiSkMatrix } from './JsiSkMatrix.ts';
import { JsiSkImageFilter } from './JsiSkImageFilter.ts';
import { JsiSkPoint } from './JsiSkPoint.ts';
import { JsiSkRSXform } from './JsiSkRSXform.ts';
import type { JsiSkSVG } from './JsiSkSVG.ts';

export class JsiSkCanvas extends HostObject<Canvas, 'Canvas'> implements SkCanvas {
  private invalidateBorrowedCanvas: () => void;
  invalidateBorrow(): void {
    this.invalidateBorrowedCanvas();
  }
  override [Symbol.dispose](): void {
    this.invalidateBorrow();
  }
  constructor(CanvasKit: CanvasKit, ref: Canvas) {
    super(CanvasKit, ref, 'Canvas');
    let value: Canvas | null = ref;
    this.invalidateBorrowedCanvas = () => {
      value = null;
    };
    Object.defineProperty(this, 'ref', {
      get: () => {
        if (value === null) throw new Error('Borrowed canvas owner has ended');
        return value;
      },
    });
  }

  drawRect(rect: SkRect, paint: SkPaint) {
    this.ref.drawRect(JsiSkRect.fromValue(this.CanvasKit, rect), JsiSkPaint.fromValue(paint));
  }

  drawImage(image: SkImage, x: number, y: number, paint?: SkPaint) {
    this.ref.drawImage(
      JsiSkImage.fromValue(image),
      x,
      y,
      paint ? JsiSkPaint.fromValue(paint) : paint,
    );
  }

  drawImageRect(img: SkImage, src: SkRect, dest: SkRect, paint: SkPaint, fastSample?: boolean) {
    this.ref.drawImageRect(
      JsiSkImage.fromValue(img),
      JsiSkRect.fromValue(this.CanvasKit, src),
      JsiSkRect.fromValue(this.CanvasKit, dest),
      JsiSkPaint.fromValue(paint),
      fastSample,
    );
  }

  drawImageCubic(
    img: SkImage,
    left: number,
    top: number,
    B: number,
    C: number,
    paint?: SkPaint | null,
  ) {
    this.ref.drawImageCubic(
      JsiSkImage.fromValue(img),
      left,
      top,
      B,
      C,
      paint ? JsiSkPaint.fromValue(paint) : paint,
    );
  }

  drawImageOptions(
    img: SkImage,
    left: number,
    top: number,
    fm: FilterMode,
    mm: MipmapMode,
    paint?: SkPaint | null,
  ) {
    this.ref.drawImageOptions(
      JsiSkImage.fromValue(img),
      left,
      top,
      getEnum(this.CanvasKit, 'FilterMode', fm),
      getEnum(this.CanvasKit, 'MipmapMode', mm),
      paint ? JsiSkPaint.fromValue(paint) : paint,
    );
  }

  drawImageNine(
    img: SkImage,
    center: SkRect,
    dest: SkRect,
    filter: FilterMode,
    paint?: SkPaint | null,
  ) {
    this.ref.drawImageNine(
      JsiSkImage.fromValue(img),
      Array.from(JsiSkRect.fromValue(this.CanvasKit, center)),
      JsiSkRect.fromValue(this.CanvasKit, dest),
      getEnum(this.CanvasKit, 'FilterMode', filter),
      paint ? JsiSkPaint.fromValue(paint) : paint,
    );
  }

  drawImageRectCubic(
    img: SkImage,
    src: SkRect,
    dest: SkRect,
    B: number,
    C: number,
    paint?: SkPaint | null,
  ) {
    this.ref.drawImageRectCubic(
      JsiSkImage.fromValue(img),
      JsiSkRect.fromValue(this.CanvasKit, src),
      JsiSkRect.fromValue(this.CanvasKit, dest),
      B,
      C,
      paint ? JsiSkPaint.fromValue(paint) : paint,
    );
  }

  drawImageRectOptions(
    img: SkImage,
    src: SkRect,
    dest: SkRect,
    fm: FilterMode,
    mm: MipmapMode,
    paint?: SkPaint | null,
  ) {
    this.ref.drawImageRectOptions(
      JsiSkImage.fromValue(img),
      JsiSkRect.fromValue(this.CanvasKit, src),
      JsiSkRect.fromValue(this.CanvasKit, dest),
      getEnum(this.CanvasKit, 'FilterMode', fm),
      getEnum(this.CanvasKit, 'MipmapMode', mm),
      paint ? JsiSkPaint.fromValue(paint) : paint,
    );
  }

  drawPaint(paint: SkPaint) {
    this.ref.drawPaint(JsiSkPaint.fromValue(paint));
  }

  drawLine(x0: number, y0: number, x1: number, y1: number, paint: SkPaint) {
    this.ref.drawLine(x0, y0, x1, y1, JsiSkPaint.fromValue(paint));
  }

  drawCircle(cx: number, cy: number, radius: number, paint: SkPaint) {
    this.ref.drawCircle(cx, cy, radius, JsiSkPaint.fromValue(paint));
  }

  drawVertices(verts: SkVertices, mode: BlendMode, paint: SkPaint) {
    this.ref.drawVertices(
      JsiSkVertices.fromValue(verts),
      getEnum(this.CanvasKit, 'BlendMode', mode),
      JsiSkPaint.fromValue(paint),
    );
  }

  drawPatch(
    cubics: SkPoint[],
    colors?: SkColor[] | null,
    texs?: SkPoint[] | null,
    mode?: BlendMode | null,
    paint?: SkPaint,
  ) {
    const defaultPaint = paint ? null : new this.CanvasKit.Paint();
    try {
      this.ref.drawPatch(
        cubics.map(({ x, y }) => [x, y]).flat(),
        colors,
        texs ? texs.flatMap((p) => Array.from(JsiSkPoint.fromValue(p))) : texs,
        mode !== undefined && mode !== null ? getEnum(this.CanvasKit, 'BlendMode', mode) : null,
        paint ? JsiSkPaint.fromValue(paint) : defaultPaint!,
      );
    } finally {
      defaultPaint?.delete();
    }
  }

  restoreToCount(saveCount: number) {
    this.ref.restoreToCount(saveCount);
  }

  getTotalMatrix(): SkMatrix {
    return new JsiSkMatrix(this.CanvasKit, Float32Array.of(...this.ref.getTotalMatrix()));
  }

  drawPoints(mode: PointMode, points: SkPoint[], paint: SkPaint) {
    this.ref.drawPoints(
      getEnum(this.CanvasKit, 'PointMode', mode),
      points.map(({ x, y }) => [x, y]).flat(),
      JsiSkPaint.fromValue(paint),
    );
  }

  drawArc(
    oval: SkRect,
    startAngle: number,
    sweepAngle: number,
    useCenter: boolean,
    paint: SkPaint,
  ) {
    this.ref.drawArc(
      JsiSkRect.fromValue(this.CanvasKit, oval),
      startAngle,
      sweepAngle,
      useCenter,
      JsiSkPaint.fromValue(paint),
    );
  }

  drawRRect(rrect: InputRRect, paint: SkPaint) {
    this.ref.drawRRect(JsiSkRRect.fromValue(this.CanvasKit, rrect), JsiSkPaint.fromValue(paint));
  }

  drawDRRect(outer: InputRRect, inner: InputRRect, paint: SkPaint) {
    this.ref.drawDRRect(
      JsiSkRRect.fromValue(this.CanvasKit, outer),
      JsiSkRRect.fromValue(this.CanvasKit, inner),
      JsiSkPaint.fromValue(paint),
    );
  }

  drawOval(oval: SkRect, paint: SkPaint) {
    this.ref.drawOval(JsiSkRect.fromValue(this.CanvasKit, oval), JsiSkPaint.fromValue(paint));
  }

  drawPath(path: SkPath, paint: SkPaint) {
    const p = JsiSkPath.pathFromValue(path);
    this.ref.drawPath(p, JsiSkPaint.fromValue(paint));
    p.delete();
  }

  nelyxDrawShadow(
    path: SkPath,
    color: number,
    elevation: number,
    transparentOccluder: boolean,
    devicePixelRatio: number,
  ): void {
    const native = JsiSkPath.pathFromValue(path),
      alpha = color >>> 24,
      rgb = [(color >>> 16) & 255, (color >>> 8) & 255, color & 255] as const;
    try {
      const tonal = this.CanvasKit.computeTonalColors({
        ambient: this.CanvasKit.Color(...rgb, Math.trunc(Math.fround(0.039) * alpha) / 255),
        spot: this.CanvasKit.Color(...rgb, Math.trunc(0.25 * alpha) / 255),
      });
      this.ref.drawShadow(
        native,
        [0, 0, Math.fround(Math.fround(devicePixelRatio) * Math.fround(elevation))],
        [0, -1, 1],
        Math.fround(800 / 600),
        tonal.ambient,
        tonal.spot,
        4 | (transparentOccluder ? 1 : 0),
      );
    } finally {
      native.delete();
    }
  }

  drawText(str: string, x: number, y: number, paint: SkPaint, font: SkFont) {
    this.ref.drawText(str, x, y, JsiSkPaint.fromValue(paint), JsiSkFont.fromValue(font));
  }

  drawTextBlob(blob: SkTextBlob, x: number, y: number, paint: SkPaint) {
    this.ref.drawTextBlob(JsiSkTextBlob.fromValue(blob), x, y, JsiSkPaint.fromValue(paint));
  }

  drawGlyphs(
    glyphs: number[],
    positions: SkPoint[],
    x: number,
    y: number,
    font: SkFont,
    paint: SkPaint,
  ) {
    this.ref.drawGlyphs(
      glyphs,
      positions.map((p) => [p.x, p.y]).flat(),
      x,
      y,
      JsiSkFont.fromValue(font),
      JsiSkPaint.fromValue(paint),
    );
  }

  drawSvg(svg: SkSVG, _width?: number, _height?: number) {
    const image = this.CanvasKit.MakeImageFromCanvasImageSource((svg as JsiSkSVG).ref);
    this.ref.drawImage(image, 0, 0);
  }

  save() {
    return this.ref.save();
  }

  saveLayer(
    paint?: SkPaint,
    bounds?: SkRect | null,
    backdrop?: SkImageFilter | null,
    flags?: SaveLayerFlag,
  ) {
    return this.ref.saveLayer(
      paint ? JsiSkPaint.fromValue(paint) : undefined,
      bounds ? JsiSkRect.fromValue(this.CanvasKit, bounds) : bounds,
      backdrop ? JsiSkImageFilter.fromValue(backdrop) : backdrop,
      flags,
    );
  }

  restore() {
    this.ref.restore();
  }

  rotate(rotationInDegrees: number, rx: number, ry: number) {
    this.ref.rotate(rotationInDegrees, rx, ry);
  }

  scale(sx: number, sy: number) {
    this.ref.scale(sx, sy);
  }

  skew(sx: number, sy: number) {
    this.ref.skew(sx, sy);
  }

  translate(dx: number, dy: number) {
    this.ref.translate(dx, dy);
  }

  drawColor(color: SkColor, blendMode?: BlendMode) {
    this.ref.drawColor(
      color,
      blendMode !== undefined ? getEnum(this.CanvasKit, 'BlendMode', blendMode) : undefined,
    );
  }

  clear(color: SkColor) {
    this.ref.clear(color);
  }

  clipPath(path: SkPath, op: ClipOp, doAntiAlias: boolean) {
    const p = JsiSkPath.pathFromValue(path);
    this.ref.clipPath(p, getEnum(this.CanvasKit, 'PathOp', op), doAntiAlias);
    p.delete();
  }

  clipRect(rect: SkRect, op: ClipOp, doAntiAlias: boolean) {
    this.ref.clipRect(
      JsiSkRect.fromValue(this.CanvasKit, rect),
      getEnum(this.CanvasKit, 'PathOp', op),
      doAntiAlias,
    );
  }

  clipRRect(rrect: InputRRect, op: ClipOp, doAntiAlias: boolean) {
    this.ref.clipRRect(
      JsiSkRRect.fromValue(this.CanvasKit, rrect),
      getEnum(this.CanvasKit, 'PathOp', op),
      doAntiAlias,
    );
  }

  concat(m: SkMatrix | number[]) {
    this.ref.concat(Array.isArray(m) ? m : JsiSkMatrix.fromValue(m));
  }

  drawPicture(skp: SkPicture) {
    this.ref.drawPicture(JsiSkPicture.fromValue(skp));
  }

  drawAtlas(
    atlas: SkImage,
    srcs: SkRect[],
    dsts: SkRSXform[],
    paint: SkPaint,
    blendMode?: BlendMode,
    colors?: SkColor[],
    sampling?: CubicResampler | FilterOptions,
  ) {
    const src = srcs.flatMap((s) => Array.from(JsiSkRect.fromValue(this.CanvasKit, s)));
    const dst = dsts.flatMap((s) => Array.from(JsiSkRSXform.fromValue(s)));
    let cls: Uint32Array | undefined;
    if (colors) {
      cls = new Uint32Array(colors.length);
      for (let i = 0; i < colors.length; i++) {
        const color = arrayItem(colors, i);
        const r = arrayItem(color, 0),
          g = arrayItem(color, 1),
          b = arrayItem(color, 2),
          a = arrayItem(color, 3);
        cls[i] = this.CanvasKit.ColorAsInt(r * 255, g * 255, b * 255, a * 255);
      }
    }
    let ckSampling: CKCubicResampler | CKFilterOptions = {
      filter: this.CanvasKit.FilterMode.Linear,
      mipmap: this.CanvasKit.MipmapMode.None,
    };
    if (sampling && isCubicSampling(sampling)) {
      ckSampling = sampling;
    } else if (sampling) {
      ckSampling = {
        filter: getEnum(this.CanvasKit, 'FilterMode', sampling.filter),
        mipmap:
          sampling.mipmap !== undefined
            ? getEnum(this.CanvasKit, 'MipmapMode', sampling.mipmap)
            : this.CanvasKit.MipmapMode.None,
      };
    }
    this.ref.drawAtlas(
      JsiSkImage.fromValue(atlas),
      src,
      dst,
      JsiSkPaint.fromValue(paint),
      blendMode !== undefined
        ? getEnum(this.CanvasKit, 'BlendMode', blendMode)
        : this.CanvasKit.BlendMode.DstOver,
      cls,
      ckSampling,
    );
  }

  readPixels(srcX: number, srcY: number, imageInfo: ImageInfo) {
    const pxInfo = {
      width: imageInfo.width,
      height: imageInfo.height,
      colorSpace: this.CanvasKit.ColorSpace.SRGB,
      alphaType: getEnum(this.CanvasKit, 'AlphaType', imageInfo.alphaType),
      colorType: getEnum(this.CanvasKit, 'ColorType', imageInfo.colorType),
    };
    return this.ref.readPixels(srcX, srcY, pxInfo);
  }
}
