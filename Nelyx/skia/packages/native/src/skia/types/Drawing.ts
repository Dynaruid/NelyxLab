import type {SkRect} from './Rect.ts';
import type {SkSVG} from './SVG/SVG.ts';
import type {SkColor} from './Color.ts';
import type {InputRRect} from './RRect.ts';
import type {BlendMode} from './Paint/BlendMode.ts';
import type {SkPoint, PointMode, Vector} from './Point.ts';
import type {SkImageFilter, TileMode} from './ImageFilter/ImageFilter.ts';
import type {SkVertices} from './Vertices/Vertices.ts';
import type {SkRSXform} from './RSXform.ts';
import type {SkJSIInstance} from './JsiInstance.ts';
import type {SkTypeface} from './Typeface/Typeface.ts';
import type {SkData} from './Data/Data.ts';
import type {GPUTextureHandle} from './GPUTexture.ts';
import type {ColorType} from './Image/ColorType.ts';
import type {Matrix3, Matrix4, Transforms3d} from './Matrix4.ts';
import {processTransform3d} from './Matrix4.ts';
import type {SkMaskFilter} from './MaskFilter.ts';
import type {SkColorFilter} from './ColorFilter/ColorFilter.ts';

// Canvas.ts

export enum ClipOp {
  Difference,
  Intersect,
}

export enum SaveLayerFlag {
  SaveLayerInitWithPrevious = 1 << 2,
  SaveLayerF16ColorType = 1 << 4,
}

export interface SkCanvas {
  /**
   * Draws the given image with its top-left corner at (left, top) using the current clip,
   * the current matrix, and optionally-provided paint.
   * @param img
   * @param left
   * @param top
   * @param paint
   */
  drawImage: (image: SkImage, x: number, y: number, paint?: SkPaint) => void;

  /**
   * Draws sub-rectangle src from provided image, scaled and translated to fill dst rectangle.
   * @param img
   * @param src
   * @param dest
   * @param paint
   * @param fastSample - if false, will filter strictly within src.
   */
  drawImageRect(
    img: SkImage,
    src: SkRect,
    dest: SkRect,
    paint: SkPaint,
    fastSample?: boolean
  ): void;

  /**
   * Draws the given image with its top-left corner at (left, top) using the current clip,
   * the current matrix. It will use the cubic sampling options B and C if necessary.
   * @param img
   * @param left
   * @param top
   * @param B - See CubicResampler in SkSamplingOptions.h for more information
   * @param C - See CubicResampler in SkSamplingOptions.h for more information
   * @param paint
   */
  drawImageCubic(
    img: SkImage,
    left: number,
    top: number,
    B: number,
    C: number,
    paint?: SkPaint | null
  ): void;

  /**
   * Draws the given image with its top-left corner at (left, top) using the current clip,
   * the current matrix. It will use the provided sampling options if necessary.
   * @param img
   * @param left
   * @param top
   * @param fm - The filter mode.
   * @param mm - The mipmap mode. Note: for settings other than None, the image must have mipmaps
   *             calculated with makeCopyWithDefaultMipmaps;
   * @param paint
   */
  drawImageOptions(
    img: SkImage,
    left: number,
    top: number,
    fm: FilterMode,
    mm: MipmapMode,
    paint?: SkPaint | null
  ): void;

  /**
   *  Draws the provided image stretched proportionally to fit into dst rectangle.
   *  The center rectangle divides the image into nine sections: four sides, four corners, and
   *  the center.
   * @param img
   * @param center
   * @param dest
   * @param filter - what technique to use when sampling the image
   * @param paint
   */
  drawImageNine(
    img: SkImage,
    center: SkRect,
    dest: SkRect,
    filter: FilterMode,
    paint?: SkPaint | null
  ): void;

  /**
   * Draws sub-rectangle src from provided image, scaled and translated to fill dst rectangle.
   * It will use the cubic sampling options B and C if necessary.
   * @param img
   * @param src
   * @param dest
   * @param B - See CubicResampler in SkSamplingOptions.h for more information
   * @param C - See CubicResampler in SkSamplingOptions.h for more information
   * @param paint
   */
  drawImageRectCubic(
    img: SkImage,
    src: SkRect,
    dest: SkRect,
    B: number,
    C: number,
    paint?: SkPaint | null
  ): void;

  /**
   * Draws sub-rectangle src from provided image, scaled and translated to fill dst rectangle.
   * It will use the provided sampling options if necessary.
   * @param img
   * @param src
   * @param dest
   * @param fm - The filter mode.
   * @param mm - The mipmap mode. Note: for settings other than None, the image must have mipmaps
   *             calculated with makeCopyWithDefaultMipmaps;
   * @param paint
   */
  drawImageRectOptions(
    img: SkImage,
    src: SkRect,
    dest: SkRect,
    fm: FilterMode,
    mm: MipmapMode,
    paint?: SkPaint | null
  ): void;

  /** Fills clip with SkPaint paint. SkPaint components, SkShader,
        SkColorFilter, SkImageFilter, and SkBlendMode affect drawing;
        SkMaskFilter and SkPathEffect in paint are ignored.

        @param paint  graphics state used to fill SkCanvas

        example: https://fiddle.skia.org/c/@Canvas_drawPaint
    */
  drawPaint: (paint: SkPaint) => void;

  /** Draws line segment from (x0, y0) to (x1, y1) using clip, SkMatrix, and SkPaint paint.
        In paint: SkPaint stroke width describes the line thickness;
        SkPaint::Cap draws the end rounded or square;
        SkPaint::Style is ignored, as if were set to SkPaint::kStroke_Style.

        @param x0     start of line segment on x-axis
        @param y0     start of line segment on y-axis
        @param x1     end of line segment on x-axis
        @param y1     end of line segment on y-axis
        @param paint  stroke, blend, color, and so on, used to draw

        example: https://fiddle.skia.org/c/@Canvas_drawLine
    */
  drawLine: (
    x0: number,
    y0: number,
    x1: number,
    y1: number,
    paint: SkPaint
  ) => void;
  /** Draws SkRect rect using clip, SkMatrix, and SkPaint paint.
        In paint: SkPaint::Style determines if rectangle is stroked or filled;
        if stroked, SkPaint stroke width describes the line thickness, and
        SkPaint::Join draws the corners rounded or square.

        @param rect   rectangle to draw
        @param paint  stroke or fill, blend, color, and so on, used to draw

        example: https://fiddle.skia.org/c/@Canvas_drawRect
    */
  drawRect: (rect: SkRect, paint: SkPaint) => void;

  /**
   * Draws a circle at (cx, cy) with the given radius.
   * @param cx
   * @param cy
   * @param radius
   * @param paint
   */
  drawCircle(cx: number, cy: number, radius: number, paint: SkPaint): void;

  /**
   * Draws the given vertices (a triangle mesh) using the current clip, current matrix, and the
   * provided paint.
   *  If paint contains an Shader and vertices does not contain texCoords, the shader
   *  is mapped using the vertices' positions.
   *  If vertices colors are defined in vertices, and Paint paint contains Shader,
   *  BlendMode mode combines vertices colors with Shader.
   * @param verts
   * @param mode
   * @param paint
   */
  drawVertices(verts: SkVertices, mode: BlendMode, paint: SkPaint): void;

  /**
   * Draws a cubic patch defined by 12 control points [top, right, bottom, left] with optional
   * colors and shader-coordinates [4] specifed for each corner [top-left, top-right, bottom-right, bottom-left]
   * @param cubics 12 points : 4 connected cubics specifying the boundary of the patch
   * @param colors optional colors interpolated across the patch
   * @param texs optional shader coordinates interpolated across the patch
   * @param mode Specifies how shader and colors blend (if both are specified)
   * @param paint
   */
  drawPatch(
    cubics: readonly SkPoint[],
    colors?: readonly SkColor[] | null,
    texs?: readonly SkPoint[] | null,
    mode?: BlendMode | null,
    paint?: SkPaint
  ): void;

  /**
   * Restores state to a previous stack value.
   * @param saveCount
   */
  restoreToCount(saveCount: number): void;

  /**
   * Legacy version of getLocalToDevice(), which strips away any Z information, and
   * just returns a 3x3 version.
   */
  getTotalMatrix(): SkMatrix;

  /**
   * Draws the given points using the current clip, current matrix, and the provided paint.
   *
   * See Canvas.h for more on the mode and its interaction with paint.
   * @param mode
   * @param points
   * @param paint
   */
  drawPoints(mode: PointMode, points: SkPoint[], paint: SkPaint): void;

  /** Draws arc using clip, SkMatrix, and SkPaint paint.

        Arc is part of oval bounded by oval, sweeping from startAngle to startAngle plus
        sweepAngle. startAngle and sweepAngle are in degrees.

        startAngle of zero places start point at the right middle edge of oval.
        A positive sweepAngle places arc end point clockwise from start point;
        a negative sweepAngle places arc end point counterclockwise from start point.
        sweepAngle may exceed 360 degrees, a full circle.
        If useCenter is true, draw a wedge that includes lines from oval
        center to arc end points. If useCenter is false, draw arc between end points.

        If SkRect oval is empty or sweepAngle is zero, nothing is drawn.

        @param oval        SkRect bounds of oval containing arc to draw
        @param startAngle  angle in degrees where arc begins
        @param sweepAngle  sweep angle in degrees; positive is clockwise
        @param useCenter   if true, include the center of the oval
        @param paint       SkPaint stroke or fill, blend, color, and so on, used to draw
    */
  drawArc: (
    oval: SkRect,
    startAngle: number,
    sweepAngle: number,
    useCenter: boolean,
    paint: SkPaint
  ) => void;

  /**
   * Draws the given rectangle with rounded corners using the current clip, current matrix,
   * and the provided paint.
   * @param rrect
   * @param paint
   */
  drawRRect(rrect: InputRRect, paint: SkPaint): void;

  /**
   * Draws RRect outer and inner using clip, Matrix, and Paint paint.
   * outer must contain inner or the drawing is undefined.
   * @param outer
   * @param inner
   * @param paint
   */
  drawDRRect(outer: InputRRect, inner: InputRRect, paint: SkPaint): void;

  /**
   * Draws an oval bounded by the given rectangle using the current clip, current matrix,
   * and the provided paint.
   * @param oval
   * @param paint
   */
  drawOval(oval: SkRect, paint: SkPaint): void;

  /** Draws SkPath path using clip, SkMatrix, and SkPaint paint.
        SkPath contains an array of path contour, each of which may be open or closed.

        In paint: SkPaint::Style determines if SkRRect is stroked or filled:
        if filled, SkPath::FillType determines whether path contour describes inside or
        outside of fill; if stroked, SkPaint stroke width describes the line thickness,
        SkPaint::Cap describes line ends, and SkPaint::Join describes how
        corners are drawn.

        @param path   SkPath to draw
        @param paint  stroke, blend, color, and so on, used to draw

        example: https://fiddle.skia.org/c/@Canvas_drawPath
    */
  drawPath: (path: SkPath, paint: SkPaint) => void;
  /** Nelyx's pinned Flutter directional/tonal SkShadowUtils operation. */
  nelyxDrawShadow: (path: SkPath, color:number, elevation:number, transparentOccluder:boolean, devicePixelRatio:number) => void;

  /**
   * Draw the given text at the location (x, y) using the provided paint and font. The text will
   * be drawn as is; no shaping, left-to-right, etc.
   * @param str
   * @param x
   * @param y
   * @param paint
   * @param font
   */
  drawText(
    str: string,
    x: number,
    y: number,
    paint: SkPaint,
    font: SkFont
  ): void;

  /**
   * Draws the given TextBlob at (x, y) using the current clip, current matrix, and the
   * provided paint. Reminder that the fonts used to draw TextBlob are part of the blob.
   * @param blob
   * @param x
   * @param y
   * @param paint
   */
  drawTextBlob(blob: SkTextBlob, x: number, y: number, paint: SkPaint): void;

  /**
   * Draws a run of glyphs, at corresponding positions, in a given font.
   * @param glyphs the array of glyph IDs (Uint16TypedArray)
   * @param positions the array of x,y floats to position each glyph
   * @param x x-coordinate of the origin of the entire run
   * @param y y-coordinate of the origin of the entire run
   * @param font the font that contains the glyphs
   * @param paint
   */
  drawGlyphs(
    glyphs: number[],
    positions: SkPoint[],
    x: number,
    y: number,
    font: SkFont,
    paint: SkPaint
  ): void;

  /**
   * Renders the SVG Dom object to the canvas. If width/height are omitted,
   * the SVG will be rendered to fit the canvas.
   */
  drawSvg: (svgDom: SkSVG, width?: number, height?: number) => void;
  /** Saves SkMatrix and clip.
        Calling restore() discards changes to SkMatrix and clip,
        restoring the SkMatrix and clip to their state when save() was called.

        SkMatrix may be changed by translate(), scale(), rotate(), skew(), concat(), setMatrix(),
        and resetMatrix(). Clip may be changed by clipRect(), clipRRect(), clipPath(), clipRegion().

        Saved SkCanvas state is put on a stack; multiple calls to save() should be balance
        by an equal number of calls to restore().

        Call restoreToCount() with result to restore this and subsequent saves.

        @return  depth of saved stack

        example: https://fiddle.skia.org/c/@Canvas_save
    */
  save: () => number;

  /**
   * Saves Matrix and clip, and allocates a SkBitmap for subsequent drawing.
   * Calling restore() discards changes to Matrix and clip, and draws the SkBitmap.
   * It returns the height of the stack.
   * See Canvas.h for more.
   * @param paint
   * @param bounds
   * @param backdrop
   * @param flags
   */
  saveLayer(
    paint?: SkPaint,
    bounds?: SkRect | null,
    backdrop?: SkImageFilter | null,
    flags?: SaveLayerFlag
  ): number;

  /** Removes changes to SkMatrix and clip since SkCanvas state was
        last saved. The state is removed from the stack.

        Does nothing if the stack is empty.

        example: https://fiddle.skia.org/c/@AutoCanvasRestore_restore

        example: https://fiddle.skia.org/c/@Canvas_restore
    */
  restore: () => void;

  /**
   * Rotates the current matrix by the number of degrees.
   * @param rot - angle of rotation in degrees.
   * @param rx
   * @param ry
   */
  rotate(rotationInDegrees: number, rx: number, ry: number): void;

  /**
   * Scales the current matrix by sx on the x-axis and sy on the y-axis.
   * @param sx
   * @param sy
   */
  scale(sx: number, sy: number): void;

  /**
   *  Skews Matrix by sx on the x-axis and sy on the y-axis. A positive value of sx
   *  skews the drawing right as y-axis values increase; a positive value of sy skews
   *  the drawing down as x-axis values increase.
   * @param sx
   * @param sy
   */
  skew(sx: number, sy: number): void;

  /**
   * Translates Matrix by dx along the x-axis and dy along the y-axis.
   * @param dx
   * @param dy
   */
  translate(dx: number, dy: number): void;

  /**
   * Fills clip with the given color.
   * @param color
   * @param blendMode - defaults to SrcOver.
   */
  drawColor(color: SkColor, blendMode?: BlendMode): void;

  /**
   * Fills the current clip with the given color using Src BlendMode.
   * This has the effect of replacing all pixels contained by clip with color.
   * @param color
   */
  clear(color: SkColor): void;

  /**
   * Replaces clip with the intersection or difference of the current clip and path,
   * with an aliased or anti-aliased clip edge.
   * @param path
   * @param op
   * @param doAntiAlias
   */
  clipPath(path: SkPath, op: ClipOp, doAntiAlias: boolean): void;

  /**
   * Replaces clip with the intersection or difference of the current clip and rect,
   * with an aliased or anti-aliased clip edge.
   * @param rect
   * @param op
   * @param doAntiAlias
   */
  clipRect(rect: SkRect, op: ClipOp, doAntiAlias: boolean): void;

  /**
   * Replaces clip with the intersection or difference of the current clip and rrect,
   * with an aliased or anti-aliased clip edge.
   * @param rrect
   * @param op
   * @param doAntiAlias
   */
  clipRRect(rrect: InputRRect, op: ClipOp, doAntiAlias: boolean): void;

  /**
   * Replaces current matrix with m premultiplied with the existing matrix.
   * @param m
   */
  concat(m: InputMatrix): void;

  /**
   * Draws the given picture using the current clip, current matrix, and the provided paint.
   * @param skp
   */
  drawPicture(skp: SkPicture): void;

  /**
   * This method is used to draw an atlas on the canvas.
   *
   * @method drawAtlas
   * @param {SkImage} atlas - The image to be drawn.
   * @param {SkRect[]} srcs - The source rectangles.
   * @param {SkRSXform[]} dsts - The destination transformations.
   * @param {SkPaint} paint - The paint used for drawing.
   * @param {BlendMode} [blendMode] - The blend mode used for drawing. Optional.
   * @param {SkColor[]} [colors] - The colors used for drawing. Optional.
   * @param {CubicResampler | FilterOptions} [sampling] - The sampling options. Optional.
   * @returns {void} This method does not return anything.
   */
  drawAtlas(
    atlas: SkImage,
    srcs: SkRect[],
    dsts: SkRSXform[],
    paint: SkPaint,
    blendMode?: BlendMode,
    colors?: SkColor[],
    sampling?: SamplingOptions
  ): void;

  /** Read Image pixels
   *
   * @param srcX - x-axis upper left corner of the rectangle to read from
   * @param srcY - y-axis upper left corner of the rectangle to read from
   * @param imageInfo - describes the pixel format and dimensions of the data to read into
   * @return Float32Array or Uint8Array with data or null if the read failed.
   */
  readPixels(
    srcX: number,
    srcY: number,
    imageInfo: ImageInfo
  ): Float32Array | Uint8Array | null;
}

// Font/Font.ts

export interface FontMetrics {
  ascent: number; // suggested space above the baseline. < 0
  descent: number; // suggested space below the baseline. > 0
  leading: number; // suggested spacing between descent of previous line and ascent of next line.
  bounds?: SkRect; // smallest rect containing all glyphs (relative to 0,0)
}

export interface SkFont extends SkJSIInstance<"Font"> {
  /**
   * Returns the advance width of text.
   * The advance is the normal distance to move before drawing additional text.
   * Returns the bounding box of text
   * @param text
   * @param paint
   */
  measureText(text: string, paint?: SkPaint): SkRect;

  /**
   * Retrieves the total width of the provided text
   * @param text
   * @param paint
   * @deprecated Use measureText or getGlyphWidths instead
   */
  getTextWidth(text: string, paint?: SkPaint): number;

  /**
   * Retrieves the advanceX measurements for each glyph.
   * If paint is not null, its stroking, PathEffect, and MaskFilter fields are respected.
   * One width per glyph is returned in the returned array.
   * @param glyphs
   * @param paint
   */
  getGlyphWidths(glyphs: number[], paint?: SkPaint): number[];

  /**
   * Returns the FontMetrics for this font.
   */
  getMetrics(): FontMetrics;

  /**
   * Retrieves the glyph ids for each code point in the provided string. This call is passed to
   * the typeface of this font. Note that glyph IDs are typeface-dependent; different faces
   * may have different ids for the same code point.
   * @param str
   * @param numCodePoints - the number of code points in the string. Defaults to str.length.
   */
  getGlyphIDs(str: string, numCodePoints?: number): number[];

  /**
   * Computes any intersections of a thick "line" and a run of positionsed glyphs.
   * The thick line is represented as a top and bottom coordinate (positive for
   * below the baseline, negative for above). If there are no intersections
   * (e.g. if this is intended as an underline, and there are no "collisions")
   * then the returned array will be empty. If there are intersections, the array
   * will contain pairs of X coordinates [start, end] for each segment that
   * intersected with a glyph.
   *
   * @param glyphs        the glyphs to intersect with
   * @param positions     x,y coordinates (2 per glyph) for each glyph
   * @param top           top of the thick "line" to use for intersection testing
   * @param bottom        bottom of the thick "line" to use for intersection testing
   * @return              array of [start, end] x-coordinate pairs. Maybe be empty.
   */
  getGlyphIntercepts(
    glyphs: number[],
    positions: SkPoint[],
    top: number,
    bottom: number
  ): number[];

  /**
   * Returns text scale on x-axis. Default value is 1.
   */
  getScaleX(): number;

  /**
   * Returns text size in points.
   */
  getSize(): number;

  /**
   * Returns text skew on x-axis. Default value is zero.
   */
  getSkewX(): number;

  /**
   * Returns embolden effect for this font. Default value is false.
   */
  isEmbolden(): boolean;

  /**
   * Returns the Typeface set for this font.
   */
  getTypeface(): SkTypeface | null;

  /**
   * Requests, but does not require, that edge pixels draw opaque or with partial transparency.
   * @param edging
   */
  setEdging(edging: FontEdging): void;

  /**
   * Requests, but does not require, to use bitmaps in fonts instead of outlines.
   * @param embeddedBitmaps
   */
  setEmbeddedBitmaps(embeddedBitmaps: boolean): void;

  /**
   * Sets level of glyph outline adjustment.
   * @param hinting
   */
  setHinting(hinting: FontHinting): void;

  /**
   * Requests, but does not require, linearly scalable font and glyph metrics.
   *
   * For outline fonts 'true' means font and glyph metrics should ignore hinting and rounding.
   * Note that some bitmap formats may not be able to scale linearly and will ignore this flag.
   * @param linearMetrics
   */
  setLinearMetrics(linearMetrics: boolean): void;

  /**
   * Sets the text scale on the x-axis.
   * @param sx
   */
  setScaleX(sx: number): void;

  /**
   * Sets the text size in points on this font.
   * @param points
   */
  setSize(points: number): void;

  /**
   * Sets the text-skew on the x axis for this font.
   * @param sx
   */
  setSkewX(sx: number): void;

  /**
   * Set embolden effect for this font.
   * @param embolden
   */
  setEmbolden(embolden: boolean): void;

  /**
   * Requests, but does not require, that glyphs respect sub-pixel positioning.
   * @param subpixel
   */
  setSubpixel(subpixel: boolean): void;

  /**
   * Sets the typeface to use with this font. null means to clear the typeface and use the
   * default one.
   * @param face
   */
  setTypeface(face: SkTypeface | null): void;
}

const fontStyle = (
  weight: FontWeight,
  width: FontWidth,
  slant: FontSlant
): FontStyle => ({ weight, width, slant });

export interface FontStyle {
  weight?: FontWeight;
  width?: FontWidth;
  slant?: FontSlant;
}

export enum FontWeight {
  Invisible = 0,
  Thin = 100,
  ExtraLight = 200,
  Light = 300,
  Normal = 400,
  Medium = 500,
  SemiBold = 600,
  Bold = 700,
  ExtraBold = 800,
  Black = 900,
  ExtraBlack = 1000,
}

export enum FontWidth {
  UltraCondensed = 1,
  ExtraCondensed = 2,
  Condensed = 3,
  SemiCondensed = 4,
  Normal = 5,
  SemiExpanded = 6,
  Expanded = 7,
  ExtraExpanded = 8,
  UltraExpanded = 9,
}

export enum FontSlant {
  Upright,
  Italic,
  Oblique,
}

export enum FontEdging {
  Alias,
  AntiAlias,
  SubpixelAntiAlias,
}

export enum FontHinting {
  None,
  Slight,
  Normal,
  Full,
}

export const FontStyle = {
  Normal: fontStyle(FontWeight.Normal, FontWidth.Normal, FontSlant.Upright),
  Bold: fontStyle(FontWeight.Bold, FontWidth.Normal, FontSlant.Upright),
  Italic: fontStyle(FontWeight.Normal, FontWidth.Normal, FontSlant.Italic),
  BoldItalic: fontStyle(FontWeight.Bold, FontWidth.Normal, FontSlant.Italic),
};

// Image/Image.ts

export interface CubicResampler {
  B: number;
  C: number;
}

export interface FilterOptions {
  filter: FilterMode;
  mipmap?: MipmapMode;
}

export enum FilterMode {
  Nearest,
  Linear,
}

export enum MipmapMode {
  None,
  Nearest,
  Linear,
}

export enum ImageFormat {
  JPEG = 3,
  PNG = 4,
  WEBP = 6,
}

export type SamplingOptions = CubicResampler | FilterOptions;

export const isCubicSampling = (
  sampling: SamplingOptions
): sampling is CubicResampler => {
  "worklet";
  return "B" in sampling && "C" in sampling;
};

export const MitchellCubicSampling = { B: 1 / 3.0, C: 1 / 3.0 };

export const CatmullRomCubicSampling = { B: 0, C: 1 / 2.0 };

export const CubicSampling = { B: 0, C: 0 };

export const MakeCubic = (B: number, C: number) => ({ B, C });

export interface SkImage extends SkJSIInstance<"Image"> {
  /**
   * Returns the possibly scaled height of the image.
   */
  height(): number;

  /**
   * Returns the possibly scaled width of the image.
   */
  width(): number;

  /**
   * Returns the ImageInfo describing the image.
   */
  getImageInfo(): ImageInfo;

  /**
   * Returns this image as a shader with the specified tiling. It will use cubic sampling.
   * @param tx - tile mode in the x direction.
   * @param ty - tile mode in the y direction.
   * @param fm - The filter mode. (default nearest)
   * @param mm - The mipmap mode. Note: for settings other than None, the image must have mipmaps (default none)
   *             calculated with makeCopyWithDefaultMipmaps;
   * @param localMatrix
   */
  makeShaderOptions(
    tx: TileMode,
    ty: TileMode,
    fm: FilterMode,
    mm: MipmapMode,
    localMatrix?: SkMatrix
  ): SkShader;

  /**
   * Returns this image as a shader with the specified tiling. It will use cubic sampling.
   * @param tx - tile mode in the x direction.
   * @param ty - tile mode in the y direction.
   * @param B - See CubicResampler in SkSamplingOptions.h for more information
   * @param C - See CubicResampler in SkSamplingOptions.h for more information
   * @param localMatrix
   */
  makeShaderCubic(
    tx: TileMode,
    ty: TileMode,
    B: number,
    C: number,
    localMatrix?: SkMatrix
  ): SkShader;

  /** Encodes Image pixels, returning result as UInt8Array. Returns existing
     encoded data if present; otherwise, SkImage is encoded with
     SkEncodedImageFormat::kPNG. Skia must be built with SK_ENCODE_PNG to encode
     SkImage.

    Returns nullptr if existing encoded data is missing or invalid, and
    encoding fails.

    @param fmt - PNG is the default value.
    @param quality - a value from 0 to 100; 100 is the least lossy. May be ignored.

    @return  Uint8Array with data
  */
  encodeToBytes(fmt?: ImageFormat, quality?: number): Uint8Array;

  /** Encodes Image pixels, returning result as a base64 encoded string. Returns existing
     encoded data if present; otherwise, SkImage is encoded with
     SkEncodedImageFormat::kPNG. Skia must be built with SK_ENCODE_PNG to encode
     SkImage.

    Returns nullptr if existing encoded data is missing or invalid, and
    encoding fails.

    @param fmt - PNG is the default value.
    @param quality - a value from 0 to 100; 100 is the least lossy. May be ignored.

    @return  base64 encoded string of data
  */
  encodeToBase64(fmt?: ImageFormat, quality?: number): string;

  /** Read Image pixels
   *
   * @param srcX - optional x-axis upper left corner of the rectangle to read from
   * @param srcY - optional y-axis upper left corner of the rectangle to read from
   * @param imageInfo - optional describes the pixel format and dimensions of the data to read into
   * @return Float32Array or Uint8Array with data or null if the read failed.
   */
  readPixels(
    srcX?: number,
    srcY?: number,
    imageInfo?: ImageInfo
  ): Float32Array | Uint8Array | null;

  /**
   * Returns raster image or lazy image. Copies SkImage backed by GPU texture
   * into CPU memory if needed. Returns original SkImage if decoded in raster
   * bitmap, or if encoded in a stream.
   * Returns null if the conversion fails.
   */
  makeNonTextureImage(): SkImage | null;
}

// Image/ImageFactory.ts

export enum AlphaType {
  Unknown,
  Opaque,
  Premul,
  Unpremul,
}

export interface ImageInfo {
  alphaType: AlphaType;
  // TODO: add support for color space
  // colorSpace: ColorSpace;
  colorType: ColorType;
  height: number;
  width: number;
}

export interface ImageFactory {
  MakeNull: () => SkImage;
  /**
   * Return an Image backed by the encoded data, but attempt to defer decoding until the image
   * is actually used/drawn. This deferral allows the system to cache the result, either on the
   * CPU or on the GPU, depending on where the image is drawn.
   * This decoding uses the codecs that have been compiled into CanvasKit. If the bytes are
   * invalid (or an unrecognized codec), null will be returned. See Image.h for more details.
   * @param data - Data object with bytes of data
   * @returns If the encoded format is not supported, or subset is outside of the bounds of the decoded
   *  image, nullptr is returned.
   */
  MakeImageFromEncoded: (encoded: SkData) => SkImage | null;

  /**
   * Web only. Creates an image from a `CanvasImageSource`: an
   * `HTMLVideoElement`, an `ImageBitmap`, a canvas, an `HTMLImageElement`...
   *
   * On native platforms, camera and video frames are rendered into a texture
   * of the shared device by React Native WebGPU
   * (`queue.copyExternalImageToTexture()`), and the texture is wrapped with
   * {@link MakeImageFromGPUTexture}. Calling this method there throws.
   *
   * @param source The image source
   */
  MakeImageFromNativeBuffer: (source: CanvasImageSource) => SkImage;

  /**
   * Returns an image that will be a screenshot of the view represented by
   * the view tag
   * @param viewTag - The tag of the view to make an image from.
   * @returns Returns a valid SkImage, if the view tag is invalid, nullptr is returned.
   */
  MakeImageFromViewTag: (viewTag: number) => Promise<SkImage | null>;

  /**
   * Returns an image with the given pixel data and format.
   * Note that we will always make a copy of the pixel data, because of inconsistencies in
   * behavior between GPU and CPU (i.e. the pixel data will be turned into a GPU texture and
   * not modifiable after creation).
   *
   * @param info
   * @param data - bytes representing the pixel data.
   * @param bytesPerRow
   */
  MakeImage(info: ImageInfo, data: SkData, bytesPerRow: number): SkImage | null;

  /**
   * Creates an SkImage from a WebGPU texture, without copying it.
   * The texture must be created with React Native WebGPU on the shared
   * device (importDevice(Skia.getNativeDevice())) with the TEXTURE_BINDING
   * usage. The image takes its own reference to the texture, so it stays
   * valid even if the JS GPUTexture is garbage collected; do not call
   * texture.destroy() while the image is in use, as destroy() releases the
   * GPU resource regardless of references.
   *
   * Native only.
   *
   * @param texture - The GPUTexture (see {@link GPUTextureHandle})
   * @returns An SkImage sampling the texture, or throws if the texture is invalid
   */
  MakeImageFromGPUTexture(texture: GPUTextureHandle): SkImage;

  /**
   * Draws an SkImage into a new WebGPU texture on the shared device.
   * The returned pointer carries one reference and must be adopted exactly
   * once with React Native WebGPU's adoptTexture(), which builds the
   * GPUTexture and owns the reference from then on.
   *
   * Native only.
   *
   * @param image - The SkImage to draw into the texture
   * @returns A WGPUTexture pointer for adoptTexture(), or throws on failure
   */
  MakeGPUTextureFromImage(image: SkImage): bigint;
}

// Matrix.ts

export const isMatrix = (obj: unknown): obj is SkMatrix =>
  obj !== null && (obj as SkJSIInstance<string>).__typename__ === "Matrix";

export interface SkMatrix extends SkJSIInstance<"Matrix"> {
  concat: (matrix: InputMatrix) => SkMatrix;
  translate: (x: number, y: number) => SkMatrix;
  scale: (x: number, y?: number) => SkMatrix;
  skew: (x: number, y: number) => SkMatrix;
  rotate: (theta: number) => SkMatrix;
  postTranslate: (x: number, y: number) => SkMatrix;
  postScale: (x: number, y?: number) => SkMatrix;
  postSkew: (x: number, y: number) => SkMatrix;
  postRotate: (theta: number) => SkMatrix;
  identity: () => SkMatrix;
  get: () => number[];
}

export type InputMatrix = SkMatrix | Matrix3 | Matrix4 | number[];

export interface TransformProp {
  transform?: Transforms3d;
}

export const processTransform = <T extends SkMatrix | SkCanvas>(
  m: T,
  transforms: Transforms3d
) => {
  "worklet";
  const m3 = processTransform3d(transforms);
  m.concat(m3);
  return m;
};

export const toDegrees = (rad: number) => {
  return (rad * 180) / Math.PI;
};

// Paint/Paint.ts

export enum PaintStyle {
  Fill,
  Stroke,
}

export enum StrokeCap {
  Butt,
  Round,
  Square,
}

export enum StrokeJoin {
  Miter,
  Round,
  Bevel,
}

export const isPaint = (obj: SkJSIInstance<string> | null): obj is SkPaint =>
  obj !== null && obj.__typename__ === "Paint";

export interface SkPaint extends SkJSIInstance<"Paint"> {
  /**
   * Retrieves alpha from the color used when stroking and filling.
   */
  getAlphaf(): number;

  /**
   * Returns a copy of this paint.
   */
  copy(): SkPaint;

  /**
   * Sets all SkPaint contents to their initial values. This is equivalent to replacing
     SkPaint with the result of SkPaint().
   */
  reset(): void;

  assign(paint: SkPaint): void;

  /**
   * Retrieves the alpha and RGB unpremultiplied. RGB are extended sRGB values
   * (sRGB gamut, and encoded with the sRGB transfer function).
   */
  getColor(): SkColor;

  /**
   * Returns the geometry drawn at the beginning and end of strokes.
   */
  getStrokeCap(): StrokeCap;

  /**
   * Returns the geometry drawn at the corners of strokes.
   */
  getStrokeJoin(): StrokeJoin;

  /**
   *  Returns the limit at which a sharp corner is drawn beveled.
   */
  getStrokeMiter(): number;

  /**
   * Returns the thickness of the pen used to outline the shape.
   */
  getStrokeWidth(): number;

  /**
   * Replaces alpha, leaving RGBA unchanged. 0 means fully transparent, 1.0 means opaque.
   * @param alpha
   */
  setAlphaf(alpha: number): void;

  /**
   * Requests, but does not require, that edge pixels draw opaque or with
   * partial transparency.
   * @param aa
   */
  setAntiAlias: (aa: boolean) => void;

  /**
   * Requests, but does not require, to distribute color error.
   * @param dither
   */
  setDither: (dither: boolean) => void;

  /**
   * Sets the blend mode that is, the mode used to combine source color
   * with destination color.
   * @param mode
   */
  setBlendMode: (blendMode: BlendMode) => void;

  /**
   *  Sets alpha and RGB used when stroking and filling. The color is a 32-bit
   *  value, unpremultiplied, packing 8-bit components for alpha, red, blue,
   *  and green.
   *
   *   @param color  unpremultiplied ARGB
   *
   *    example: https://fiddle.skia.org/c/@Paint_setColor
   */
  setColor(color: SkColor): void;

  /**
   * Sets the current color filter, replacing the existing one if there was one.
   * @param filter
   */
  setColorFilter(filter: SkColorFilter | null): void;

  /**
   * Sets the current image filter, replacing the existing one if there was one.
   * @param filter
   */
  setImageFilter(filter: SkImageFilter | null): void;

  /**
   * Sets the current mask filter, replacing the existing one if there was one.
   * @param filter
   */
  setMaskFilter(filter: SkMaskFilter | null): void;

  /**
   * Sets the current path effect, replacing the existing one if there was one.
   * @param effect
   */
  setPathEffect(effect: SkPathEffect | null): void;

  /**
   * Sets the current shader, replacing the existing one if there was one.
   * @param shader
   */
  setShader(shader: SkShader | null): void;

  /**
   * Sets the geometry drawn at the beginning and end of strokes.
   * @param cap
   */
  setStrokeCap(cap: StrokeCap): void;

  /**
   * Sets the geometry drawn at the corners of strokes.
   * @param join
   */
  setStrokeJoin(join: StrokeJoin): void;

  /**
   * Sets the limit at which a sharp corner is drawn beveled.
   * @param limit
   */
  setStrokeMiter(limit: number): void;

  /**
   * Sets the thickness of the pen used to outline the shape.
   * @param width
   */
  setStrokeWidth(width: number): void;

  /**
   * Sets whether the geometry is filled or stroked.
   * @param style
   */
  setStyle(style: PaintStyle): void;
}

// PathEffect.ts

export interface SkPathEffect extends SkJSIInstance<"PathEffect"> {}

export const isPathEffect = (
  obj: SkJSIInstance<string> | null
): obj is SkPathEffect => obj !== null && obj.__typename__ === "PathEffect";

export enum Path1DEffectStyle {
  Translate,
  Rotate,
  Morph,
}

export interface PathEffectFactory {
  /**
   * Returns a PathEffect that can turn sharp corners into rounded corners.
   * @param radius - if <=0, returns null
   */
  MakeCorner(radius: number): SkPathEffect | null;

  /**
   * Returns a PathEffect that add dashes to the path.
   *
   * See SkDashPathEffect.h for more details.
   *
   * @param intervals - even number of entries with even indicies specifying the length of
   *                    the "on" intervals, and the odd indices specifying the length of "off".
   * @param phase - offset length into the intervals array. Defaults to 0.
   */
  MakeDash(intervals: number[], phase?: number): SkPathEffect;

  /**
   * Returns a PathEffect that breaks path into segments of segLength length, and randomly move
   * the endpoints away from the original path by a maximum of deviation.
   * @param segLength - length of the subsegments.
   * @param dev - limit of the movement of the endpoints.
   * @param seedAssist - modifies the randomness. See SkDiscretePathEffect.h for more.
   */
  MakeDiscrete(
    segLength: number,
    dev: number,
    seedAssist: number
  ): SkPathEffect;

  /**
   *
   * A pathEffect whose effect is to apply first the inner pathEffect and the the
   * outer pathEffect (i.e. outer(inner(path))).
   *
   */
  MakeCompose(outer: SkPathEffect, inner: SkPathEffect): SkPathEffect;

  /**
   *
   * A pathEffect pathEffect whose effect is to apply two effects,
   * in sequence (i.e. first(path) + second(path)).
   *
   */
  MakeSum(outer: SkPathEffect, inner: SkPathEffect): SkPathEffect;

  /**
   * Returns a PathEffect that will fill the drawing path with a pattern made by applying
   * the given matrix to a repeating set of infinitely long lines of the given width.
   * For example, the scale of the provided matrix will determine how far apart the lines
   * should be drawn its rotation affects the lines' orientation.
   * @param width - must be >= 0
   * @param matrix
   */
  MakeLine2D(width: number, matrix: SkMatrix): SkPathEffect | null;

  /**
   * Returns a PathEffect which implements dashing by replicating the specified path.
   *   @param path The path to replicate (dash)
   *   @param advance The space between instances of path
   *   @param phase distance (mod advance) along path for its initial position
   *   @param style how to transform path at each point (based on the current
   *                position and tangent)
   */
  MakePath1D(
    path: SkPath,
    advance: number,
    phase: number,
    style: Path1DEffectStyle
  ): SkPathEffect | null;

  /**
   * Returns a PathEffect that will fill the drawing path with a pattern by repeating the
   * given path according to the provided matrix. For example, the scale of the matrix
   * determines how far apart the path instances should be drawn.
   * @param matrix
   * @param path
   */
  MakePath2D(matrix: SkMatrix, path: SkPath): SkPathEffect | null;
}

// Path/Path.ts

/**
 * Options used for Path.stroke(). If an option is omitted, a sensible default will be used.
 */
export interface StrokeOpts {
  /** The width of the stroked lines. */
  width?: number;
  miter_limit?: number;
  /**
   * if > 1, increase precision, else if (0 < resScale < 1) reduce precision to
   * favor speed and size
   */
  precision?: number;
  join?: StrokeJoin;
  cap?: StrokeCap;
}

export enum FillType {
  Winding,
  EvenOdd,
  InverseWinding,
  InverseEvenOdd,
}

export enum PathOp {
  Difference, //!< subtract the op path from the first path
  Intersect, //!< intersect the two paths
  Union, //!< union (inclusive-or) the two paths
  XOR, //!< exclusive-or the two paths
  ReverseDifference,
}

export enum PathVerb {
  Move,
  Line,
  Quad,
  Conic,
  Cubic,
  Close,
}

export type PathCommand = number[];

export const isPath = (obj: SkJSIInstance<string> | null): obj is SkPath => {
  "worklet";
  return obj !== null && obj.__typename__ === "Path";
};

export interface SkPath extends SkJSIInstance<"Path"> {
  /**
   * Returns the number of points in this path. Initially zero.
   */
  countPoints(): number;

  /**
   * Returns minimum and maximum axes values of the lines and curves in Path.
   * Returns (0, 0, 0, 0) if Path contains no points.
   * Returned bounds width and height may be larger or smaller than area affected
   * when Path is drawn.
   *
   * Behaves identically to getBounds() when Path contains
   * only lines. If Path contains curves, computed bounds includes
   * the maximum extent of the quad, conic, or cubic; is slower than getBounds();
   * and unlike getBounds(), does not cache the result.
   */
  computeTightBounds(): SkRect;

  /**
   * Returns true if the point (x, y) is contained by Path, taking into
   * account FillType.
   * @param x
   * @param y
   */
  contains(x: number, y: number): boolean;

  /**
   * Returns a copy of this Path.
   */
  copy(): SkPath;

  /**
   * Returns true if other path is equal to this path.
   * @param other
   */
  equals(other: SkPath): boolean;

  /**
   * Returns minimum and maximum axes values of Point array.
   * Returns (0, 0, 0, 0) if Path contains no points. Returned bounds width and height may
   * be larger or smaller than area affected when Path is drawn.
   */
  getBounds(): SkRect;

  /**
   * Return the FillType for this path.
   */
  getFillType(): FillType;

  /**
   * Returns the Point at index in Point array. Valid range for index is
   * 0 to countPoints() - 1.
   * @param index
   */
  getPoint(index: number): SkPoint;

  /**
   * Returns true if there are no verbs in the path.
   */
  isEmpty(): boolean;

  /**
   * Returns true if the path is volatile; it will not be altered or discarded
   * by the caller after it is drawn. Path by default have volatile set false, allowing
   * Surface to attach a cache of data which speeds repeated drawing. If true, Surface
   * may not speed repeated drawing.
   */
  isVolatile(): boolean;

  getLastPt(): { x: number; y: number };

  /**
   * Returns this path as an SVG string.
   */
  toSVGString(): string;

  /**
   * Interpolates between Path with point array of equal size.
   * Copy verb array and weights to result, and set result path to a weighted
   * average of this path array and ending path.

   *  weight is most useful when between zero (ending path) and
      one (this path); will work with values outside of this
      range.

   * interpolate() returns undefined if path is not
   * the same size as ending path. Call isInterpolatable() to check Path
   * compatibility prior to calling interpolate().

   * @param ending  path to interpolate with
   * @param weight  contribution of this path, and
   *                 one minus contribution of ending path
   * @return        New path of interpolated averages or null if 
   *                not interpolatable
   * */
  interpolate(end: SkPath, weight: number): SkPath | null;

  /** Returns true if Path contain equal verbs and equal weights.
   *     @param compare  path to compare
   *     @return         true if Path can be interpolated equivalent
   *
   * */
  isInterpolatable(compare: SkPath): boolean;

  /**
   * Serializes the contents of this path as a series of commands.
   */
  toCmds(): PathCommand[];
}

// Picture/Picture.ts

export interface SkPicture extends SkJSIInstance<"Picture"> {
  approximateBytesUsed():number;
  /**
   *  Returns a new shader that will draw with this picture.
   *
   *  @param tmx  The tiling mode to use when sampling in the x-direction.
   *  @param tmy  The tiling mode to use when sampling in the y-direction.
   *  @param mode How to filter the tiles
   *  @param localMatrix Optional matrix used when sampling
   *  @param tileRect The tile rectangle in picture coordinates: this represents the subset
   *              (or superset) of the picture used when building a tile. It is not
   *              affected by localMatrix and does not imply scaling (only translation
   *              and cropping). If null, the tile rect is considered equal to the picture
   *              bounds.
   */
  makeShader(
    tmx: TileMode,
    tmy: TileMode,
    mode: FilterMode,
    localMatrix?: SkMatrix,
    tileRect?: SkRect
  ): SkShader;

  /**
   * Returns the serialized format of this SkPicture. The format may change at anytime and
   * no promises are made for backwards or forward compatibility.
   */
  serialize(): Uint8Array | null;
}

// RuntimeEffect/RuntimeEffect.ts

export interface SkSLUniform {
  columns: number;
  rows: number;
  /** The index into the uniforms array that this uniform begins. */
  slot: number;
  isInteger: boolean;
}

export interface SkRuntimeShaderBuilder extends SkJSIInstance<"RuntimeShaderBuilder"> {
  setUniform(name: string, value: readonly number[]): void;
}

export interface SkRuntimeEffect extends SkJSIInstance<"RuntimeEffect"> {
  /**
   * Returns a shader executed using the given uniform data.
   * @param uniforms
   * @param localMatrix
   */
  makeShader(uniforms: number[], localMatrix?: SkMatrix): SkShader;

  /**
   * Returns a shader executed using the given uniform data and the children as inputs.
   * @param uniforms
   * @param children
   * @param localMatrix
   */
  makeShaderWithChildren(
    uniforms: number[],
    children?: SkShader[],
    localMatrix?: SkMatrix
  ): SkShader;

  /**
   * Returns the nth uniform from the effect.
   * @param index
   */
  getUniform(index: number): SkSLUniform;

  /**
   * Returns the number of uniforms in the effect.
   */
  getUniformCount(): number;

  /**
   * Returns the total number of floats across all uniforms on the effect. This is the length
   * of the uniforms array expected by makeShader. For example, an effect with a single float3
   * uniform, would return 1 from `getUniformCount()`, but 3 from `getUniformFloatCount()`.
   */
  getUniformFloatCount(): number;

  /**
   * Returns the name of the nth effect uniform.
   * @param index
   */
  getUniformName(index: number): string;

  /**
   * Returns the SkSL source of the runtime effect shader.
   */
  source(): string;
}

// Shader/Shader.ts

export const isShader = (obj: SkJSIInstance<string> | null): obj is SkShader =>
  obj !== null && obj.__typename__ === "Shader";

export interface SkShader extends SkJSIInstance<"Shader"> {nelyxIsValid():boolean}

export type Uniform =
  number | Vector | Float32Array | readonly Uniform[] | Uniform[];

export interface Uniforms {
  [name: string]: Uniform;
}

const isVector = (obj: unknown): obj is Vector => {
  "worklet";
  // We have an issue to check property existence on JSI backed instances
  return (obj as any).x !== undefined && (obj as any).y !== undefined;
};

function processValue(values: number[], value: Uniform) {
  "worklet";
  if (typeof value === "number") {
    values.push(value);
  } else if (Array.isArray(value)) {
    value.forEach((v) => processValue(values, v));
  } else if (isVector(value)) {
    values.push(value.x, value.y);
  } else if (value instanceof Float32Array) {
    values.push(...value);
  }
}

export const processUniforms = (
  source: SkRuntimeEffect,
  uniforms: Uniforms,
  builder?: SkRuntimeShaderBuilder
) => {
  "worklet";
  const result: number[] = [];
  const uniformsCount = source.getUniformCount();
  for (let i = 0; i < uniformsCount; i++) {
    const name = source.getUniformName(i);
    const value = uniforms[name];
    if (value === undefined) {
      throw new Error(
        `The runtime effect has the uniform value "${name}" declared, but it is missing from the uniforms property of the Runtime effect.`
      );
    }
    if (builder === undefined) {
      processValue(result, value);
    } else {
      const uniformValue: number[] = [];
      processValue(uniformValue, value);
      builder.setUniform(name, uniformValue);
      result.push(...uniformValue);
    }
  }
  return result;
};

// TextBlob.ts

export interface SkTextBlob extends SkJSIInstance<"TextBlob"> {}

export interface TextBlobFactory {
  /**
   * Return a TextBlob with a single run of text.
   *
   * It uses the default character-to-glyph mapping from the typeface in the font.
   * It does not perform typeface fallback for characters not found in the Typeface.
   * It does not perform kerning or other complex shaping; glyphs are positioned based on their
   * default advances.
   * @param str
   * @param font
   */
  MakeFromText(str: string, font: SkFont): SkTextBlob;
  /**
   * Return a TextBlob with a single run of text.
   *
   * It does not perform typeface fallback for characters not found in the Typeface.
   * It does not perform kerning or other complex shaping; glyphs are positioned based on their
   * default advances.
   * @param glyphs - if using Malloc'd array, be sure to use CanvasKit.MallocGlyphIDs().
   * @param font
   */
  MakeFromGlyphs(glyphs: number[], font: SkFont): SkTextBlob;

  /**
   * Returns a TextBlob built from a single run of text with rotation, scale, and translations.
   *
   * It uses the default character-to-glyph mapping from the typeface in the font.
   * @param str
   * @param rsxforms
   * @param font
   */
  MakeFromRSXform(str: string, rsxforms: SkRSXform[], font: SkFont): SkTextBlob;

  /**
   * Returns a TextBlob built from a single run of text with rotation, scale, and translations.
   *
   * @param glyphs - if using Malloc'd array, be sure to use CanvasKit.MallocGlyphIDs().
   * @param rsxforms
   * @param font
   */
  MakeFromRSXformGlyphs(
    glyphs: number[],
    rsxforms: SkRSXform[],
    font: SkFont
  ): SkTextBlob;
}
