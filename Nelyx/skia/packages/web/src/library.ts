import { readWebImageBytes } from './image-bytes.ts';
import { browserWebPSize, decodeBrowserWebP } from './webp-decode.ts';
import type { BrowserWebP } from './webp-decode.ts';
import { createEnginePath } from './path.ts';
import { invariant } from '@nelyx/core/foundation/errors';
import type { PathSnapshot, PathQueryService } from '@nelyx/core/ui/path';
import type { Offset } from '@nelyx/core/ui/geometry';
import type {
  CanvasKit,
  Surface,
  Image,
  FontCollection,
  TypefaceFontProvider,
  Paragraph,
} from 'canvaskit-wasm';
import type { Renderer } from '@nelyx/core/hosting/runtime';
import type { ResourceLease, ResourceRegistry } from '@nelyx/core/hosting/resources';
import type { AssetRef } from '@nelyx/core/foundation/assets';
import type { Disposable } from '@nelyx/core/foundation/disposable';
import type {
  PaintFrame,
  RendererCapabilities,
  RendererNotification,
  SubmitResult,
  ViewOwner,
  TextLayoutInput,
  TextLayout,
  TextLayoutService,
  ResourceId,
  TextLayoutRequest,
  TextBoxQuery,
  TextBoxGeometry,
} from '@nelyx/core/ui/types';
import { isCurrent, resourceKey } from '@nelyx/core/ui/frame';
import type { FrameDiagnostics } from '@nelyx/core/ui/frame';
import { RendererEvents } from '@nelyx/core/hosting/renderer-events';
import type { PlatformViewDrawRange } from '@nelyx/core/hosting/platform-views';
import { platformViewDrawCommands } from '@nelyx/core/ui/platform-view-scene';
import { freezeTextInput, freezeTextLayout, freezeTextRect, textRange } from '@nelyx/core/ui/text';
import { Paint as UiPaint } from '@nelyx/core/ui/paint';
import type { ImageByteFormat } from '@nelyx/core/ui/image';
import type { TextRunStyle } from '@nelyx/core/ui/text-styles';
import { createRuntimeShaderCache } from './paint-effects.ts';
import { WebSkiaReplay } from './replay.ts';
import type { WebParagraphDrawing } from './replay.ts';
import { WebSkiaSurface } from './surface.ts';
import type { WebSkiaCanvas, WebSkiaSurfaceOptions, WebSurfaceMetrics } from './surface.ts';
export { webBackingSize, webGpuResourceCacheBytes } from './surface.ts';
export type { WebSkiaSurfaceOptions, WebSurfaceMetrics } from './surface.ts';
import { imageTargetSize } from '@nelyx/core/hosting/images';
import type {
  ImageDecodeOptions,
  NativeImageCodec,
  NativeImageFrame,
} from '@nelyx/core/hosting/images';
import { imageLimits } from '@nelyx/core/hosting/images';
import { NativePictureCache, NativeRetirementError } from '@nelyx/core/hosting/rasterization';
import type { PictureCapture } from '@nelyx/core/ui/picture';
import type { FramePictureBackend } from '@nelyx/core/hosting/pictures';
import { ParagraphFontCatalog, ParagraphFontProviders } from '@nelyx/core/hosting/text-fonts';
import { TextLayoutCache } from '@nelyx/core/hosting/text-layout-cache';
import { TextLayoutBudget } from '@nelyx/core/hosting/text-layout-budget';
import { TextPaintResources } from '@nelyx/core/hosting/text-paints';
import type { FontProviderLease } from '@nelyx/core/hosting/text-fonts';
import { buildStyledText, mergeTextRunStyle } from '@nelyx/core/ui/text-builder';
import { webFontStyleKeys, webTextStyle, webParagraphStyle } from './text-style.ts';

// Leave headroom for Skia's signed integer clip width and height.
const framePictureCullExtent = 2 ** 29;
const webImageByteBudget = 256 * 1024 * 1024;

interface Font {
  resource: ResourceId;
  family: string;
  bytes: Uint8Array;
  sourceBytes: number;
}
/** Share Skia's typeface lookups across paragraphs with the same font catalog. */
class WebParagraphFonts {
  private collection: FontCollection | undefined;
  private readonly styles = new Set<string>();
  private retirementFailure: { error: unknown } | undefined;
  constructor(
    private readonly ck: CanvasKit,
    readonly fontProvider: TypefaceFontProvider,
  ) {}
  collectionFor(input: TextLayoutInput, primary: string, families: readonly string[]) {
    if (this.retirementFailure) throw this.retirementFailure.error;
    const styles = webFontStyleKeys(input, primary, families);
    if (!styles) return;
    const added = [...styles].filter((key) => !this.styles.has(key));
    // CanvasKit's collection keeps family and variation lookups for its entire lifetime.
    if (this.styles.size + added.length > 64) return;
    if (!this.collection) {
      const collection = (this.collection = this.ck.FontCollection.Make());
      try {
        collection.setDefaultFontManager(this.fontProvider);
        collection.enableFontFallback();
      } catch (error) {
        try {
          this.retireCollection();
        } catch (cleanup) {
          throw new AggregateError(
            [error, cleanup],
            'Web font collection setup and retirement failed',
          );
        }
        throw error;
      }
    }
    for (const key of added) this.styles.add(key);
    return this.collection;
  }
  retireCollection(): void {
    if (this.retirementFailure) throw this.retirementFailure.error;
    try {
      this.collection?.delete();
    } catch (error) {
      this.retirementFailure = { error };
      throw error;
    }
    this.collection = undefined;
    this.styles.clear();
  }
}
interface Entry extends WebParagraphDrawing {
  layout: TextLayout;
  fonts: FontProviderLease<Font, WebParagraphFonts>;
  paintResources: TextPaintResources;
}
interface Pending {
  fences: readonly { surface: WebSkiaSurface; fence: WebGLSync }[];
  lease: ResourceLease;
  started: number;
}
export interface WebDisplayComposition {
  readonly background: PlatformViewDrawRange;
  readonly layers: readonly { canvas: WebSkiaCanvas; range: PlatformViewDrawRange }[];
}
type ImageSource = {
  readonly kind: 'image';
  readonly width: number;
  readonly height: number;
  readonly encoding: 'encoded' | 'rgba8888-premul-srgb';
  readonly byteLength: number;
  read(): Uint8Array<ArrayBuffer>;
};
export type WebSkiaResourceSource =
  | ImageSource
  | { readonly kind: 'font'; readonly family: string; readonly bytes: Uint8Array }
  | {
      readonly kind: 'paragraph';
      readonly input: TextLayoutInput;
      readonly fonts: readonly ResourceId[];
    }
  | { readonly kind: 'picture'; readonly frame: PaintFrame };
type SkPicture = import('canvaskit-wasm').SkPicture;
interface FramePictureEntry {
  readonly capture: PictureCapture;
  native: SkPicture | null;
  bytes: number;
  updateBytes?: (bytes: number) => void;
  failure?: NativeRetirementError;
}
/** Fork-owned CanvasKit resources and replay; no React, RN or native bootstrap import. */
export class WebSkiaLibrary implements Renderer, TextLayoutService, PathQueryService {
  private readonly replay: WebSkiaReplay;
  private readonly runtimePrograms: ReturnType<typeof createRuntimeShaderCache>;
  get debugRuntimePrograms() {
    return this.runtimePrograms.debugStats;
  }
  readonly singleSubmissionPerTick = true;
  readonly capabilities: RendererCapabilities = Object.freeze({
    admission: 'bounded',
    completion: 'gpu-retired',
    present: 'unobserved',
    textRanges: true,
    nativeIdentity: true,
    notifications: 'submitted-and-retired',
  });
  private images = new Map<string, Image>();
  private imageSources = new Map<string, ImageSource>();
  private resourceRetired: ((key: string) => void) | undefined;
  setResourceRetirementListener(listener: ((key: string) => void) | undefined): void {
    this.resourceRetired = listener;
    if (!listener) this.imageSources.clear();
  }
  resourceSource(resource: ResourceId): WebSkiaResourceSource {
    const key = resourceKey(resource),
      font = this.fonts.get(key),
      paragraph = this.paragraphs.get(key),
      picture = this.framePictures.get(key);
    if (font) return { kind: 'font', family: font.family, bytes: font.bytes };
    if (paragraph)
      return {
        kind: 'paragraph',
        input: paragraph.layout.input,
        fonts: paragraph.fonts.fonts.map((font) => font.resource),
      };
    if (picture) return { kind: 'picture', frame: picture.capture.frame };
    const image = this.imageSources.get(key);
    if (image) return image;
    throw new Error('Web render resource retired or missing a restoration source');
  }
  private captureImageSource(
    key: string,
    image: Image,
    byteLength: number,
    encoding: ImageSource['encoding'],
    read: () => Uint8Array | null,
  ): void {
    if (!this.resourceRetired) return;
    this.imageSources.set(key, {
      kind: 'image',
      width: image.width(),
      height: image.height(),
      byteLength,
      encoding,
      read: () => {
        const bytes = read();
        if (!bytes || bytes.byteLength !== byteLength)
          throw new Error('Web render image restoration readback failed');
        if (
          encoding === 'rgba8888-premul-srgb' &&
          bytes.buffer instanceof ArrayBuffer &&
          bytes.byteOffset === 0 &&
          bytes.byteLength === bytes.buffer.byteLength
        )
          return new Uint8Array(bytes.buffer);
        return new Uint8Array(bytes);
      },
    });
  }
  private forgetImage(key: string): void {
    this.images.delete(key);
    this.imageSources.delete(key);
    this.resourceRetired?.(key);
  }
  private fonts = new Map<string, Font>();
  private paragraphs = new Map<string, Entry>();
  private pending = new Map<number, Pending>();
  private events: RendererEvents;
  private metrics: WebSurfaceMetrics | undefined;
  private display: WebSkiaSurface | undefined;
  private readonly platformDisplays = new Map<
    WebSkiaCanvas,
    { surface: WebSkiaSurface; retiring: boolean }
  >();
  private auxiliary: { readonly surface: WebSkiaSurface; stop(): void; lost: boolean } | undefined;
  private registry: ResourceRegistry | undefined;
  private sequence = 0;
  private closed = false;
  private lost = false;
  private visible = true;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private closePromise: Promise<void> | undefined;
  private layoutCache: TextLayoutCache<Font> | undefined;
  private textBudget: TextLayoutBudget | undefined;
  private fontCatalog: ParagraphFontCatalog<Font> | undefined;
  private failed = false;
  private providers: ParagraphFontProviders<Font, WebParagraphFonts> | undefined;
  private textFailed = false;
  private readonly uncertainText: unknown[] = [];
  private dynamicImageBytes = 0;
  private codecBytes = 0;
  private pictures: NativePictureCache<import('canvaskit-wasm').SkPicture> | undefined;
  private pictureCompilations = 0;
  private unconfirmedPicture: NativeRetirementError | undefined;
  private failPicture(errors: readonly unknown[], owners: readonly unknown[]): never {
    this.unconfirmedPicture = new NativeRetirementError(errors, owners);
    throw this.unconfirmedPicture;
  }
  private retireFrameEntry(entry: FramePictureEntry): void {
    if (entry.failure) throw entry.failure;
    try {
      entry.native?.delete();
      entry.native = null;
    } catch (error) {
      entry.failure = new NativeRetirementError([error], [entry.native]);
      this.unconfirmedPicture = entry.failure;
      throw entry.failure;
    }
  }
  private readonly framePictures = new Map<string, FramePictureEntry>();
  private deferredFramePictures = false;
  private framePictureCompilations = 0;
  setDeferredFramePictures(deferred: boolean): void {
    this.deferredFramePictures = deferred;
  }
  readonly framePictureBackend: FramePictureBackend = {
    compile: (capture, descriptor, updateBytes) => {
      this.ensureOpen();
      const key = resourceKey(descriptor);
      if (this.framePictures.has(key)) throw new Error('Duplicate Web frame picture');
      const entry: FramePictureEntry = { capture, native: null, bytes: 0 };
      if (!this.deferredFramePictures && !this.lost) this.materializeFramePicture(entry);
      if (updateBytes) entry.updateBytes = updateBytes;
      this.framePictures.set(key, entry);
      let retired = false;
      return {
        get bytes() {
          return entry.bytes;
        },
        retire: () => {
          if (retired) return;
          this.retireFrameEntry(entry);
          this.framePictures.delete(key);
          this.resourceRetired?.(key);
          retired = true;
        },
      };
    },
  };
  private allocateResource(kind: string): ResourceId {
    let resource: ResourceId;
    do {
      resource = this.registry?.allocateId(`${this.owner.id}:${this.owner.generation}:${kind}`) ?? {
        id: `${this.owner.id}:${this.owner.generation}:${kind}:${++this.sequence}`,
        generation: 1,
      };
    } while (
      this.images.has(resourceKey(resource)) ||
      this.fonts.has(resourceKey(resource)) ||
      this.paragraphs.has(resourceKey(resource)) ||
      this.framePictures.has(resourceKey(resource))
    );
    return resource;
  }
  private framePicture(key: string): SkPicture {
    const entry = this.framePictures.get(key);
    if (!entry) throw new Error('Web frame picture retired');
    return entry.native ?? this.materializeFramePicture(entry);
  }
  private materializeFramePicture(entry: FramePictureEntry): SkPicture {
    const native = this.compilePicture(entry.capture, true);
    try {
      const bytes = native.approximateBytesUsed();
      if (!Number.isSafeInteger(bytes) || bytes < 0)
        throw new Error('Invalid Web native picture size');
      entry.updateBytes?.(bytes);
      entry.bytes = bytes;
      entry.native = native;
      return native;
    } catch (error) {
      try {
        native.delete();
      } catch (cleanup) {
        this.failPicture([error, cleanup], [native]);
      }
      throw error;
    }
  }
  private retireFrameNative(): void {
    const errors: unknown[] = [];
    for (const entry of this.framePictures.values())
      try {
        this.retireFrameEntry(entry);
        if (entry.bytes > 0) {
          entry.updateBytes?.(0);
          entry.bytes = 0;
        }
      } catch (error) {
        errors.push(error);
      }
    if (errors.length)
      throw new AggregateError(errors, 'Web native frame pictures retirement failed');
  }
  constructor(
    private ck: CanvasKit,
    private readonly canvas: WebSkiaCanvas | (() => HTMLCanvasElement),
    private owner: ViewOwner,
    private readonly options: WebSkiaSurfaceOptions = {},
  ) {
    const { maxRasterScale } = options;
    if (maxRasterScale !== undefined && (!Number.isFinite(maxRasterScale) || maxRasterScale < 1))
      throw new RangeError('Web raster scale limit must be finite and at least one');
    if (typeof canvas !== 'function') this.display = new WebSkiaSurface(ck, canvas, options);
    this.events = new RendererEvents(owner);
    this.runtimePrograms = createRuntimeShaderCache(ck);
    this.replay = new WebSkiaReplay(
      ck,
      {
        image: (key) => this.images.get(key),
        paragraph: (key) => this.paragraphs.get(key),
        picture: (key) => this.framePicture(key),
      },
      this.runtimePrograms,
    );
  }
  contains(path: PathSnapshot, point: Offset): boolean {
    this.ensureOpen();
    if (!Number.isFinite(point.x) || !Number.isFinite(point.y))
      throw new Error('Path query point must be finite');
    const native = createEnginePath(this.ck, path),
      errors: unknown[] = [];
    let value = false;
    try {
      value = native.contains(point.x, point.y);
    } catch (error) {
      errors.push(error);
    } finally {
      try {
        native.delete();
      } catch (error) {
        errors.push(error);
      }
    }
    if (errors.length === 1) throw errors[0];
    if (errors.length) throw new AggregateError(errors, 'Web path query/retirement failed');
    return value;
  }
  bind(registry: ResourceRegistry) {
    if (this.registry) throw new Error('Web Skia registry already bound');
    this.registry = registry;
    this.fontCatalog = new ParagraphFontCatalog(registry);
    this.textBudget = new TextLayoutBudget(registry);
    this.providers = new ParagraphFontProviders(registry, this.fontCatalog, (fonts) => {
      const provider = this.ck.TypefaceFontProvider.Make();
      try {
        for (const font of fonts) provider.registerFont(font.source.bytes, font.family);
      } catch (error) {
        provider.delete();
        throw error;
      }
      const paragraphFonts = new WebParagraphFonts(this.ck, provider);
      return {
        provider: paragraphFonts,
        retire: () => {
          paragraphFonts.retireCollection();
          provider.delete();
        },
      };
    });
  }
  observe(listener: (event: RendererNotification) => void): Disposable {
    return this.events.subscribe(listener);
  }
  private compilePicture(
    capture: PictureCapture,
    framePicture = false,
  ): import('canvaskit-wasm').SkPicture {
    const recorder = new this.ck.PictureRecorder(),
      errors: unknown[] = [],
      unknownOwners: unknown[] = [];
    let picture: import('canvaskit-wasm').SkPicture | undefined;
    try {
      // A parent clip can cut across a nested picture that records no clip itself.
      // Replay in order so the canvas clips each draw without picture-index omissions.
      const canvas = recorder.beginRecording(
        framePicture
          ? this.ck.LTRBRect(
              -framePictureCullExtent,
              -framePictureCullExtent,
              framePictureCullExtent,
              framePictureCullExtent,
            )
          : this.ck.XYWHRect(0, 0, imageLimits.dimension, imageLimits.dimension),
        false,
      );
      this.replay.draw(canvas, capture.frame);
      picture = recorder.finishRecordingAsPicture();
      if (framePicture) this.framePictureCompilations++;
      else this.pictureCompilations++;
    } catch (error) {
      errors.push(error);
    } finally {
      try {
        recorder.delete();
      } catch (error) {
        unknownOwners.push(recorder);
        errors.push(error);
      }
    }
    if (errors.length) {
      try {
        picture?.delete();
      } catch (error) {
        unknownOwners.push(picture);
        errors.push(error);
      }
      if (unknownOwners.length) this.failPicture(errors, unknownOwners);
      if (errors.length === 1) throw errors[0];
      throw new AggregateError(errors, 'Web picture recording/retirement failed');
    }
    return picture!;
  }
  get debugRasterizationStats() {
    return Object.freeze({
      pictures: this.pictures?.debugEntryCount ?? 0,
      pictureBytes: this.pictures?.debugBytes ?? 0,
      pictureCompilations: this.pictureCompilations,
      framePictures: this.framePictures.size,
      framePictureCompilations: this.framePictureCompilations,
      dynamicImageBytes: this.dynamicImageBytes,
    });
  }
  get debugOwner() {
    return this.owner;
  }
  get debugTextStats() {
    const values = [...this.paragraphs.values()],
      producers = values.reduce(
        (sum, entry) => sum + (this.registry?.initialProducerCount(entry.layout.resource) ?? 0),
        0,
      ),
      live = values.filter((entry) =>
        this.registry?.hasInitialProducer(entry.layout.resource),
      ).length;
    return Object.freeze({
      cache: this.layoutCache?.debugStats,
      paragraphs: this.paragraphs.size,
      producers,
      retainedOnly: this.paragraphs.size - live,
      fontProviders: this.providers?.debugProviderCount ?? 0,
      fontProviderSourceBytes: this.providers?.debugSourceBytes ?? 0,
      failed: this.textFailed,
    });
  }
  retirePictures(): void {
    this.pictures?.dispose();
    this.pictures = undefined;
  }
  /** Actual GPU rendering/readback produces a CPU-restorable sRGB image resource. */
  rasterize(capture: PictureCapture, width: number, height: number): NativeImageFrame {
    this.ensureOpen();
    if (this.lost || this.failed) throw new Error('Web rasterization GPU context unavailable');
    imageTargetSize(width, height);
    const cost = width * height * 4;
    if (
      this.images.size >= 1024 ||
      this.dynamicImageBytes + this.codecBytes + cost * 3 > webImageByteBudget
    )
      throw new Error('Web rasterization image/temporary byte budget');
    const context = this.rasterContext();
    let resource: { id: string; generation: number }, key: string;
    do {
      resource = this.allocateResource('raster');
      key = resourceKey(resource);
    } while (
      this.images.has(key) ||
      this.fonts.has(key) ||
      this.paragraphs.has(key) ||
      this.registry?.isRetained(resource)
    );
    this.pictures ??= new NativePictureCache(
      (c) => this.compilePicture(c),
      (picture) => picture.approximateBytesUsed(),
      (picture) => picture.delete(),
    );
    const picture = this.pictures.get(capture),
      info = {
        width,
        height,
        colorType: this.ck.ColorType.RGBA_8888,
        alphaType: this.ck.AlphaType.Premul,
        colorSpace: this.ck.ColorSpace.SRGB,
      },
      errors: unknown[] = [];
    let surface: Surface | null = null,
      texture: Image | null = null,
      output: Image | null = null;
    try {
      surface = this.ck.MakeRenderTarget(context, info);
      if (!surface) throw new Error('Web rasterization GPU surface unavailable');
      surface.getCanvas().clear(this.ck.Color(0, 0, 0, 0));
      surface.getCanvas().drawPicture(picture);
      surface.flush();
      texture = surface.makeImageSnapshot();
      const pixels = texture.readPixels(0, 0, info);
      if (!(pixels instanceof Uint8Array) || pixels.byteLength !== cost)
        throw new Error('Web rasterization GPU readback failed');
      output = this.ck.MakeImage(info, pixels, width * 4);
      if (!output) throw new Error('Web raster image copy failed');
    } catch (error) {
      errors.push(error);
    } finally {
      for (const cleanup of [() => texture?.delete(), () => surface?.delete()])
        try {
          cleanup();
        } catch (error) {
          errors.push(error);
        }
    }
    if (errors.length) {
      try {
        output?.delete();
      } catch (error) {
        errors.push(error);
      }
      if (errors.length === 1) throw errors[0];
      throw new AggregateError(errors, 'Web rasterization/temporary retirement failed');
    }
    const image = output!;
    this.images.set(key, image);
    this.captureImageSource(key, image, cost, 'rgba8888-premul-srgb', () =>
      readWebImageBytes(this.ck, image, 'rawRgba'),
    );
    this.dynamicImageBytes += cost;
    let retired = false;
    return {
      descriptor: { ...resource, kind: 'image' },
      width,
      height,
      duration: 0,
      readBytes: async (format) => {
        if (retired) throw new Error('Web raster image retired');
        return readWebImageBytes(this.ck, image, format);
      },
      retire: () => {
        if (retired) return;
        image.delete();
        retired = true;
        this.dynamicImageBytes -= cost;
        this.forgetImage(key);
      },
    };
  }
  instantiateBrowserImageCodec(
    bytes: Uint8Array,
    options: ImageDecodeOptions,
  ): NativeImageCodec | Promise<NativeImageCodec> {
    this.ensureOpen();
    // Keep target-size callbacks and resampling on the established codec path.
    const size =
      options.targetWidth == null && options.targetHeight == null && !options.getTargetSize
        ? browserWebPSize(bytes)
        : null;
    if (size) {
      const cost = size.width * size.height * 4;
      const reserved = cost * 3 + bytes.byteLength;
      if (this.codecBytes + this.dynamicImageBytes + reserved <= webImageByteBudget)
        return this.instantiateWebP(bytes, options, size, cost, reserved);
    }
    return this.instantiateImageCodec(bytes, options);
  }
  private async instantiateWebP(
    bytes: Uint8Array,
    options: ImageDecodeOptions,
    size: BrowserWebP,
    cost: number,
    reserved: number,
  ): Promise<NativeImageCodec> {
    const info = {
      width: size.width,
      height: size.height,
      colorType: this.ck.ColorType.RGBA_8888,
      alphaType: this.ck.AlphaType.Premul,
      colorSpace: this.ck.ColorSpace.SRGB,
    };
    this.codecBytes += reserved;
    let image: Image | null = null;
    let retainedPixels: Uint8Array<ArrayBuffer> | null = null;
    try {
      const pixels = await decodeBrowserWebP(bytes, size);
      this.ensureOpen();
      if (pixels) {
        // CanvasKit can upload these immutable browser bytes straight into
        // the drawing context, including a replacement context after loss.
        image = this.ck.MakeLazyImageFromTextureSource?.(pixels, info, true) ?? null;
        if (image) retainedPixels = pixels;
        else image = this.ck.MakeImage(info, pixels, size.width * 4);
      }
    } finally {
      this.codecBytes -= reserved;
    }
    if (!image) return this.instantiateImageCodec(bytes, options);

    this.codecBytes += cost;
    // A codec and each published frame hold independent lifetime references.
    const source = image;
    let references = 1;
    let disposed = false;
    const release = () => {
      if (references === 1) {
        source.delete();
        retainedPixels = null;
      }
      references--;
    };
    const read = (format: ImageByteFormat): Uint8Array | null => {
      const pixels = retainedPixels;
      if (!pixels) return readWebImageBytes(this.ck, source, format);
      // This path admits only opaque sRGB images. The stored RGBA bytes are
      // identical for premultiplied, straight and unmodified readback.
      if (format === 'rawRgba' || format === 'rawStraightRgba' || format === 'rawUnmodified')
        return pixels.slice();
      const raster = this.ck.MakeImage(info, pixels, size.width * 4);
      if (!raster) return null;
      try {
        return readWebImageBytes(this.ck, raster, format);
      } finally {
        raster.delete();
      }
    };
    return {
      frameCount: 1,
      repetitionCount: 0,
      getNextFrame: () => {
        this.ensureOpen();
        if (disposed) throw new Error('WebP codec disposed');
        this.checkImageFrameBudget(cost);
        const frame = this.registerCodecFrame(source, size, 0, release, read);
        references++;
        return frame;
      },
      dispose: () => {
        if (disposed) return;
        release();
        disposed = true;
        this.codecBytes -= cost;
      },
    };
  }
  private checkImageFrameBudget(cost: number): void {
    if (
      this.images.size >= 1024 ||
      this.dynamicImageBytes + this.codecBytes + cost > webImageByteBudget
    )
      throw new Error('Web dynamic image resource/byte budget');
  }
  private registerCodecFrame(
    image: Image,
    { width, height }: { readonly width: number; readonly height: number },
    duration: number,
    release: () => void = () => image.delete(),
    read: (format: ImageByteFormat) => Uint8Array | null = (format) =>
      readWebImageBytes(this.ck, image, format),
  ): NativeImageFrame {
    const cost = width * height * 4;
    const resource = this.allocateResource('image');
    const key = resourceKey(resource);
    this.images.set(key, image);
    this.captureImageSource(key, image, cost, 'rgba8888-premul-srgb', () => read('rawRgba'));
    this.dynamicImageBytes += cost;
    let retired = false;
    return {
      descriptor: { ...resource, kind: 'image' },
      width,
      height,
      duration,
      readBytes: async (format) => {
        if (retired) throw new Error('Web image retired');
        return read(format);
      },
      retire: () => {
        if (retired) return;
        release();
        retired = true;
        this.dynamicImageBytes -= cost;
        this.forgetImage(key);
      },
    };
  }
  /** CPU codec/resampling is separate from the GPU-only surface renderer. */
  instantiateImageCodec(bytes: Uint8Array, options: ImageDecodeOptions = {}): NativeImageCodec {
    this.ensureOpen();
    const animated = this.ck.MakeAnimatedImageFromEncoded(bytes),
      still = animated ? null : this.ck.MakeImageFromEncoded(bytes);
    if (!animated && !still) throw new Error('CanvasKit image codec creation failed');
    const frameCount = animated?.getFrameCount() ?? 1,
      repetitionCount = frameCount === 1 ? 0 : animated!.getRepetitionCount(),
      naturalWidth = animated ? animated.width() : still!.width(),
      naturalHeight = animated ? animated.height() : still!.height(),
      codecCost = naturalWidth * naturalHeight * 4 * (frameCount > 1 ? 3 : 1);
    let target: { width: number; height: number };
    try {
      target = imageTargetSize(naturalWidth, naturalHeight, options);
      if (this.codecBytes + this.dynamicImageBytes + codecCost > webImageByteBudget)
        throw new Error('Web codec memory budget');
    } catch (error) {
      animated?.delete();
      still?.delete();
      throw error;
    }
    this.codecBytes += codecCost;
    let dead = false,
      index = 0;
    return {
      frameCount,
      repetitionCount,
      getNextFrame: (): NativeImageFrame => {
        this.ensureOpen();
        if (dead) throw new Error('CanvasKit codec disposed');
        if (animated && index > 0) {
          if (index % frameCount === 0) animated.reset();
          else if (animated.decodeNextFrame() === -1)
            throw new Error('Image animation frame decode failed');
        }
        index++;
        const raw = animated ? animated.makeImageAtCurrentFrame() : still;
        if (!raw) throw new Error('CanvasKit image frame decode failed');
        let surface: Surface | null = null,
          output: Image | null = null;
        try {
          const size = target;
          this.checkImageFrameBudget(size.width * size.height * 4);
          surface = this.ck.MakeSurface(size.width, size.height);
          if (!surface) throw new Error('CanvasKit image resize surface creation failed');
          surface
            .getCanvas()
            .drawImageRectOptions(
              raw,
              this.ck.XYWHRect(0, 0, raw.width(), raw.height()),
              this.ck.XYWHRect(0, 0, size.width, size.height),
              this.ck.FilterMode.Linear,
              this.ck.MipmapMode.None,
            );
          output = surface.makeImageSnapshot();
          const frame = this.registerCodecFrame(
            output,
            size,
            frameCount === 1 ? 0 : animated!.currentFrameDuration(),
          );
          output = null;
          return frame;
        } finally {
          output?.delete();
          // MakeSurface owns a CanvasKit-allocated raster buffer outside the
          // native Surface. The immutable image snapshot has independent pixels.
          surface?.dispose();
          if (animated) raw.delete();
        }
      },
      dispose: () => {
        if (dead) return;
        dead = true;
        animated?.delete();
        still?.delete();
        this.codecBytes -= codecCost;
      },
    };
  }
  decode(asset: AssetRef & { fontFamily?: string }, bytes: Uint8Array) {
    const resource = { id: asset.id, generation: 1 };
    if (this.images.size + this.fonts.size >= 64) throw new Error('Web asset count budget');
    const retire =
      asset.kind === 'image'
        ? this.restoreImage(resource, { encoding: 'encoded', bytes })
        : this.restoreFont(resource, asset.fontFamily!, bytes);
    return {
      descriptor: {
        ...resource,
        kind: asset.kind,
        asset: Object.freeze({ id: asset.id, kind: asset.kind, sha256: asset.sha256 }),
      },
      retire,
    };
  }
  restoreFont(resource: ResourceId, family: string, bytes: Uint8Array): () => void {
    this.ensureOpen();
    const key = resourceKey(resource);
    if (this.images.has(key) || this.fonts.has(key)) throw new Error('Duplicate web resource');
    if (!family) throw new Error('Bundled font family required');
    const source = new Uint8Array(bytes),
      typeface = this.ck.Typeface.MakeTypefaceFromData(source.buffer);
    if (!typeface) throw new Error('CanvasKit font decode failed');
    // registerFont decodes its own face and silently skips invalid font data.
    typeface.delete();
    this.fonts.set(key, { resource, family, bytes: source, sourceBytes: source.length });
    return () => {
      if (!this.fonts.delete(key)) return;
      this.resourceRetired?.(key);
    };
  }
  restoreImage(
    resource: ResourceId,
    data:
      | { readonly encoding: 'encoded'; readonly bytes: Uint8Array }
      | {
          readonly encoding: 'rgba8888-premul-srgb';
          readonly bytes: Uint8Array;
          readonly width: number;
          readonly height: number;
        },
  ): () => void {
    this.ensureOpen();
    const key = resourceKey(resource);
    if (this.images.has(key) || this.fonts.has(key)) throw new Error('Duplicate web resource');
    let image: Image | null;
    if (data.encoding === 'encoded') {
      image = this.ck.MakeImageFromEncoded(data.bytes);
    } else {
      const { width, height } = data;
      imageTargetSize(width, height);
      if (data.bytes.byteLength !== width * height * 4) throw new Error('Invalid Web image pixels');
      image = this.ck.MakeImage(
        {
          width,
          height,
          colorType: this.ck.ColorType.RGBA_8888,
          alphaType: this.ck.AlphaType.Premul,
          colorSpace: this.ck.ColorSpace.SRGB,
        },
        data.bytes,
        width * 4,
      );
    }
    if (!image) throw new Error('CanvasKit image decode failed');
    this.images.set(key, image);
    this.captureImageSource(key, image, data.bytes.byteLength, data.encoding, () => data.bytes);
    return () => {
      if (!this.images.has(key)) return;
      image.delete();
      this.forgetImage(key);
    };
  }
  fontFamily(resource: ResourceId): string {
    this.ensureOpen();
    const font = this.fonts.get(resourceKey(resource));
    if (!font || !this.registry?.has(resource)) throw new Error('Stale font resource');
    return font.family;
  }
  layout(
    input: TextLayoutInput,
    request?: TextLayoutRequest,
    fontResources?: readonly ResourceId[],
  ): TextLayout {
    this.ensureOpen();
    if (this.textFailed) throw Error('Web paragraph native retirement failed');
    const snapshot = freezeTextInput(input),
      font = this.fonts.get(resourceKey(snapshot.font)),
      registry = this.registry;
    if (!font || !registry?.has(snapshot.font)) throw new Error('Stale font resource');
    const sources = fontResources
      ? fontResources.map((resource) => {
          const source = this.fonts.get(resourceKey(resource));
          if (!source || !registry.has(resource)) throw new Error('Stale paragraph catalog font');
          return source;
        })
      : this.fonts.values();
    const catalog = this.fontCatalog!.capture(sources),
      cache = (this.layoutCache ??= new TextLayoutCache(registry, this.fontCatalog!)),
      cacheKey = cache.key(snapshot, catalog),
      cached = cache.reuse(cacheKey, (retained) =>
        this.textBudget!.admit(snapshot, request, retained, cache),
      );
    if (cached) return cached;
    const primaryFamily = catalog.fonts.find((value) => value.source === font)?.family;
    if (primaryFamily === undefined)
      throw new Error('Primary paragraph font is not in the captured catalog');
    const fonts = this.providers!.acquire(snapshot.font, catalog);
    let paragraph: Paragraph | undefined,
      admitted = false,
      paintResources: TextPaintResources | undefined;
    let hyphenGlyphs: Map<TextRunStyle | undefined, Paragraph> | undefined;
    const retireParagraphs = () => {
      paragraph?.delete();
      if (hyphenGlyphs) for (const glyph of hyphenGlyphs.values()) glyph.delete();
    };
    const temporary: { delete(): void }[] = [],
      uncertainTemporary: { delete(): void }[] = [];
    const own = <T extends { delete(): void }>(value: T): T => {
      temporary.push(value);
      return value;
    };
    const releaseTemporary = () => {
      const errors: unknown[] = [];
      for (const value of temporary.splice(0).reverse())
        try {
          value.delete();
        } catch (error) {
          uncertainTemporary.push(value);
          errors.push(error);
        }
      if (errors.length)
        throw new AggregateError(errors, 'Web text paint wrapper retirement failed');
    };
    let builder: ReturnType<CanvasKit['ParagraphBuilder']['MakeFromFontProvider']> | undefined;
    try {
      paintResources = new TextPaintResources(registry, snapshot);
      const collection = fonts.provider.collectionFor(snapshot, primaryFamily, fonts.families);
      const makeBuilder = (input: TextLayoutInput) => {
        const style = webParagraphStyle(this.ck, input, primaryFamily, fonts.families);
        return collection
          ? this.ck.ParagraphBuilder.MakeFromFontCollection(style, collection)
          : this.ck.ParagraphBuilder.MakeFromFontProvider(style, fonts.provider.fontProvider);
      };
      builder = makeBuilder(snapshot);
      const push = (style: TextRunStyle) => {
        const native = webTextStyle(this.ck, snapshot, style, primaryFamily, fonts.families);
        if (!style.foreground && !style.background) {
          builder!.pushStyle(native);
          return;
        }
        const foreground = own(new this.ck.Paint()),
          background = own(new this.ck.Paint());
        this.replay.configurePaint(
          foreground,
          style.foreground ??
            new UiPaint({ color: style.color ?? snapshot.color ?? 0xffeef5ff }).snapshot(),
          own,
        );
        this.replay.configurePaint(
          background,
          style.background ?? new UiPaint({ color: style.backgroundColor ?? 0 }).snapshot(),
          own,
        );
        builder!.pushPaintStyle(native, foreground, background);
      };
      buildStyledText(snapshot, {
        push,
        pop: () => builder!.pop(),
        addText: (text) => builder!.addText(text),
        addPlaceholder: (p) =>
          builder!.addPlaceholder(
            p.width,
            p.height,
            this.ck.PlaceholderAlignment[
              (p.alignment[0]!.toUpperCase() + p.alignment.slice(1)) as
                | 'Baseline'
                | 'AboveBaseline'
                | 'BelowBaseline'
                | 'Top'
                | 'Bottom'
                | 'Middle'
            ],
            p.baseline === 'ideographic'
              ? this.ck.TextBaseline.Ideographic
              : this.ck.TextBaseline.Alphabetic,
            p.baselineOffset,
          ),
      });
      paragraph = builder.build();
      builder.delete();
      builder = undefined;
      releaseTemporary();
      paragraph.layout(snapshot.width);
      const unresolvedGlyphs = paragraph.unresolvedCodepoints().length;
      // This CanvasKit does not restore unresolved codepoints on a shaping cache hit.
      const lines = paragraph.getLineMetrics();
      let longestLine = paragraph.getLongestLine();
      let hyphens: { paragraph: Paragraph; x: number; y: number }[] | undefined;
      if (snapshot.hyphens !== 'hidden' && snapshot.text.includes('\u00ad')) {
        // Keep SkParagraph's source text and UTF-16 geometry. CanvasKit 0.42
        // exposes the break positions, so paint the hyphen at the end of that line.
        const runs = snapshot.runs ?? [];
        const ellipsized = !!snapshot.ellipsis && paragraph.didExceedMaxLines();
        const { strutStyle: _strutStyle, ...inputWithoutStrut } = snapshot;
        const hyphenInput: TextLayoutInput = {
          ...inputWithoutStrut,
          text: '-',
          textAlign: 'left',
        };
        let runIndex = 0;
        for (const line of lines) {
          const offset = line.endExcludingWhitespaces - 1;
          if (
            snapshot.text[offset] !== '\u00ad' ||
            line.endIndex === snapshot.text.length ||
            (ellipsized && line === lines.at(-1))
          )
            continue;
          while (runs[runIndex] && runs[runIndex]!.end <= offset) runIndex++;
          const run = runs[runIndex];
          const style = run && run.start <= offset ? run.style : undefined;
          hyphenGlyphs ??= new Map();
          let glyph = hyphenGlyphs.get(style);
          if (!glyph) {
            builder = makeBuilder(hyphenInput);
            push(mergeTextRunStyle(snapshot.style, style));
            builder.addText('-');
            builder.pop();
            glyph = builder.build();
            hyphenGlyphs.set(style, glyph);
            builder.delete();
            builder = undefined;
            releaseTemporary();
            glyph.layout(Infinity);
          }
          const width = glyph.getLongestLine();
          longestLine = Math.max(longestLine, line.width + width);
          (hyphens ??= []).push({
            paragraph: glyph,
            x: snapshot.direction === 'rtl' ? line.left - width : line.left + line.width,
            y: line.baseline - glyph.getAlphabeticBaseline(),
          });
        }
      }
      if (collection && unresolvedGlyphs) fonts.provider.retireCollection();
      const resource = this.allocateResource('paragraph');
      const placeholderBoxes = paragraph.getRectsForPlaceholders();
      const layout = freezeTextLayout(resource, snapshot, {
        width: paragraph.getMaxWidth(),
        height: paragraph.getHeight(),
        alphabeticBaseline: paragraph.getAlphabeticBaseline(),
        ideographicBaseline: paragraph.getIdeographicBaseline(),
        minIntrinsicWidth: paragraph.getMinIntrinsicWidth(),
        maxIntrinsicWidth: paragraph.getMaxIntrinsicWidth(),
        longestLine,
        overflow: paragraph.didExceedMaxLines(),
        unresolvedGlyphs,
        lines: lines.map((line) => ({
          start: line.startIndex,
          end: line.endIndex,
          baseline: line.baseline,
          height: line.height,
          bounds: {
            x: line.left,
            y: line.baseline - line.ascent,
            width: line.width,
            height: line.ascent + line.descent,
          },
          metrics: {
            hardBreak: line.isHardBreak,
            ascent: line.ascent,
            descent: line.descent,
            // Skia's TextLine::getMetrics uses the same run metric for both fields.
            unscaledAscent: line.ascent,
            height: line.height,
            width: line.width,
            left: line.left,
            baseline: line.baseline,
            lineNumber: line.lineNumber,
          },
        })),
        placeholderBoxes: placeholderBoxes.map((box) =>
          freezeTextRect({
            x: box.rect[0]!,
            y: box.rect[1]!,
            width: box.rect[2]! - box.rect[0]!,
            height: box.rect[3]! - box.rect[1]!,
          }),
        ),
        placeholderDirections: placeholderBoxes.map((box) =>
          box.dir === this.ck.TextDirection.RTL ? 'rtl' : 'ltr',
        ),
      });
      const key = resourceKey(resource),
        entry = { layout, paragraph, fonts, paintResources, hyphens };
      const registration = this.textBudget!.registration(layout, snapshot);
      registry.register(
        { ...resource, kind: 'paragraph' },
        () => {
          try {
            retireParagraphs();
          } catch (error) {
            this.textFailed = true;
            this.uncertainText.push(entry);
            throw error;
          }
          cache.forget(cacheKey, layout);
          this.paragraphs.delete(key);
          this.resourceRetired?.(key);
          const errors: unknown[] = [];
          for (const cleanup of [() => entry.paintResources.dispose(), () => entry.fonts.release()])
            try {
              cleanup();
            } catch (error) {
              this.textFailed = true;
              errors.push(error);
            }
          if (errors.length)
            throw new AggregateError(errors, 'Web paragraph dependency retirement failed');
        },
        registration,
      );
      admitted = true;
      this.paragraphs.set(key, entry);
      try {
        registry.bindResource(layout.resource);
        cache.remember(cacheKey, layout, registration.cost, request?.transient !== true);
      } catch (error) {
        registry.releaseProducer(resource);
        throw error;
      }
      return layout;
    } catch (error) {
      if (admitted) throw error;
      const errors = [error];
      let retired = uncertainTemporary.length === 0;
      for (const cleanup of [retireParagraphs, () => builder?.delete(), releaseTemporary])
        try {
          cleanup();
        } catch (failure) {
          retired = false;
          errors.push(failure);
        }
      if (retired) {
        for (const cleanup of [() => paintResources?.dispose(), () => fonts.release()])
          try {
            cleanup();
          } catch (failure) {
            this.textFailed = true;
            errors.push(failure);
          }
      } else {
        this.textFailed = true;
        this.uncertainText.push({
          paragraph,
          hyphenGlyphs,
          builder,
          fonts,
          paintResources,
          uncertainTemporary,
        });
      }
      if (errors.length === 1) throw error;
      throw new AggregateError(errors, 'Web paragraph construction/retirement failed');
    }
  }
  private entry(layout: TextLayout) {
    this.ensureOpen();
    const entry = this.paragraphs.get(resourceKey(layout.resource));
    if (entry?.layout !== layout || !this.registry?.hasInitialProducer(layout.resource))
      throw new Error('Stale/foreign web paragraph');
    return entry;
  }
  range(layout: TextLayout, start: number, end: number) {
    textRange(layout, start, end);
    return Object.freeze(
      this.entry(layout)
        .paragraph.getRectsForRange(
          start,
          end,
          this.ck.RectHeightStyle.Tight,
          this.ck.RectWidthStyle.Tight,
        )
        .map((value) =>
          freezeTextRect({
            x: value.rect[0]!,
            y: value.rect[1]!,
            width: value.rect[2]! - value.rect[0]!,
            height: value.rect[3]! - value.rect[1]!,
          }),
        ),
    );
  }
  boxes(
    layout: TextLayout,
    start: number,
    end: number,
    { heightStyle = 'tight', widthStyle = 'tight' }: TextBoxQuery = {},
  ): readonly TextBoxGeometry[] {
    if (
      !Number.isInteger(start) ||
      !Number.isInteger(end) ||
      start < 0 ||
      end < 0 ||
      start > 0xffffffff ||
      end > 0xffffffff
    )
      throw new Error('Text box range is outside Uint32 ABI');
    const height = {
        tight: this.ck.RectHeightStyle.Tight,
        max: this.ck.RectHeightStyle.Max,
        includeLineSpacingMiddle: this.ck.RectHeightStyle.IncludeLineSpacingMiddle,
        includeLineSpacingTop: this.ck.RectHeightStyle.IncludeLineSpacingTop,
        includeLineSpacingBottom: this.ck.RectHeightStyle.IncludeLineSpacingBottom,
        strut: this.ck.RectHeightStyle.Strut,
      }[heightStyle],
      width = { tight: this.ck.RectWidthStyle.Tight, max: this.ck.RectWidthStyle.Max }[widthStyle];
    if (!height || !width) throw new Error('Unknown text box height/width style');
    return Object.freeze(
      this.entry(layout)
        .paragraph.getRectsForRange(start, end, height, width)
        .map((value) =>
          Object.freeze({
            rect: freezeTextRect({
              x: value.rect[0]!,
              y: value.rect[1]!,
              width: value.rect[2]! - value.rect[0]!,
              height: value.rect[3]! - value.rect[1]!,
            }),
            direction:
              value.dir === this.ck.TextDirection.RTL ? ('rtl' as const) : ('ltr' as const),
          }),
        ),
    );
  }
  closestGlyph(layout: TextLayout, x: number, y: number) {
    if (!Number.isFinite(x) || !Number.isFinite(y)) throw new Error('Nonfinite paragraph hit');
    const glyph = this.entry(layout).paragraph.getClosestGlyphInfoAtCoordinate(x, y);
    if (!glyph) return null;
    const bounds = glyph.graphemeLayoutBounds,
      range = glyph.graphemeClusterTextRange;
    textRange(layout, range.start, range.end);
    return Object.freeze({
      start: range.start,
      end: range.end,
      direction: glyph.dir === this.ck.TextDirection.RTL ? ('rtl' as const) : ('ltr' as const),
      bounds: freezeTextRect({
        x: bounds[0]!,
        y: bounds[1]!,
        width: bounds[2]! - bounds[0]!,
        height: bounds[3]! - bounds[1]!,
      }),
    });
  }
  hit(layout: TextLayout, x: number, y: number) {
    if (!Number.isFinite(x) || !Number.isFinite(y)) throw new Error('Nonfinite paragraph hit');
    const paragraph = this.entry(layout).paragraph,
      hit = paragraph.getGlyphPositionAtCoordinate(x, y),
      glyph = paragraph.getClosestGlyphInfoAtCoordinate(x, y),
      bounds = glyph?.graphemeLayoutBounds,
      range = glyph?.graphemeClusterTextRange;
    return Object.freeze({
      position: hit.pos,
      affinity:
        hit.affinity === this.ck.Affinity.Upstream
          ? ('upstream' as const)
          : ('downstream' as const),
      ...(glyph && bounds && range && !glyph.isEllipsis
        ? {
            start: range.start,
            end: range.end,
            direction:
              glyph.dir === this.ck.TextDirection.RTL ? ('rtl' as const) : ('ltr' as const),
            bounds: freezeTextRect({
              x: bounds[0]!,
              y: bounds[1]!,
              width: bounds[2]! - bounds[0]!,
              height: bounds[3]! - bounds[1]!,
            }),
          }
        : {}),
    });
  }
  glyphAt(layout: TextLayout, offset: number) {
    const paragraph = this.entry(layout).paragraph;
    if (!Number.isInteger(offset) || offset < 0 || offset > layout.input.text.length)
      throw new Error('Glyph offset outside UTF16 body');
    const glyph = paragraph.getGlyphInfoAt(offset);
    if (!glyph) return null;
    const bounds = glyph.graphemeLayoutBounds,
      range = glyph.graphemeClusterTextRange;
    textRange(layout, range.start, range.end);
    return Object.freeze({
      start: range.start,
      end: range.end,
      bounds: freezeTextRect({
        x: bounds[0]!,
        y: bounds[1]!,
        width: bounds[2]! - bounds[0]!,
        height: bounds[3]! - bounds[1]!,
      }),
      direction: glyph.dir === this.ck.TextDirection.RTL ? ('rtl' as const) : ('ltr' as const),
      isEllipsis: glyph.isEllipsis,
    });
  }
  lineNumberAt(layout: TextLayout, offset: number): number | null {
    const paragraph = this.entry(layout).paragraph,
      text = layout.input.text;
    invariant(
      Number.isInteger(offset) && offset >= 0 && offset <= 0xffffffff,
      'invalid-line-offset',
      'Line offset outside Uint32 ABI',
    );
    if (offset >= text.length) return null;
    // CanvasKit 0.42 binds the UTF-8 SkParagraph lookup.
    let bytes = 0;
    for (let unit = 0; unit < offset;) {
      const scalar = text.codePointAt(unit)!;
      if (scalar > 0xffff && unit + 1 === offset) break;
      bytes += scalar <= 0x7f ? 1 : scalar <= 0x7ff ? 2 : scalar <= 0xffff ? 3 : 4;
      unit += scalar > 0xffff ? 2 : 1;
    }
    const result = paragraph.getLineNumberAt(bytes);
    invariant(
      Number.isInteger(result) && result >= -1 && result < layout.lines.length,
      'invalid-line-number',
      'Malformed engine line number',
    );
    return result < 0 ? null : result;
  }
  wordBoundary(layout: TextLayout, offset: number) {
    const paragraph = this.entry(layout).paragraph;
    if (!Number.isInteger(offset) || offset < 0 || offset > 0xffffffff)
      throw new Error('Word offset outside Uint32 ABI');
    const range = paragraph.getWordBoundary(offset);
    textRange(layout, range.start, range.end);
    return Object.freeze({ start: range.start, end: range.end });
  }
  updateMetrics(metrics: WebSurfaceMetrics): void {
    this.ensureOpen();
    this.metrics = metrics;
  }
  /** Install the display context after worker selection or fallback. */
  useDisplayCanvas(canvas: WebSkiaCanvas): void {
    this.ensureOpen();
    if (this.display) throw new Error('Web Skia display already installed');
    this.closeAuxiliary();
    const display = new WebSkiaSurface(this.ck, canvas, this.options);
    display.prepare();
    this.display = display;
  }
  prepareDisplay(): void {
    this.ensureOpen();
    if (!this.display) throw new Error('Web Skia display is absent');
    this.display.prepare();
  }
  releaseDisplayCanvas(canvas: WebSkiaCanvas): void {
    const entry = this.platformDisplays.get(canvas);
    if (!entry) return;
    entry.retiring = true;
    this.releasePlatformDisplays();
  }
  private releasePlatformDisplays(): void {
    for (const [canvas, entry] of this.platformDisplays) {
      if (!entry.retiring) continue;
      if (
        [...this.pending.values()].some(({ fences }) =>
          fences.some(({ surface }) => surface === entry.surface),
        )
      )
        continue;
      this.platformDisplays.delete(canvas);
      entry.surface.reset(this.lost, true);
    }
  }
  private rasterContext() {
    if (this.display) return this.display.prepare();
    if (!this.auxiliary) {
      if (typeof this.canvas !== 'function') throw new Error('Missing Web rasterization canvas');
      const canvas = this.canvas(),
        surface = new WebSkiaSurface(this.ck, canvas, { preserveDrawingBuffer: false }),
        auxiliary = {
          surface,
          lost: false,
          stop() {
            canvas.removeEventListener('webglcontextlost', lost);
            canvas.removeEventListener('webglcontextrestored', restored);
          },
        };
      const lost = (event: Event) => {
        event.preventDefault();
        auxiliary.lost = true;
        this.retirePictures();
        surface.reset(true);
      };
      const restored = () => {
        auxiliary.lost = false;
      };
      canvas.addEventListener('webglcontextlost', lost);
      canvas.addEventListener('webglcontextrestored', restored);
      this.auxiliary = auxiliary;
    }
    if (this.auxiliary.lost) throw new Error('Web rasterization auxiliary context lost');
    return this.auxiliary.surface.prepare();
  }
  private closeAuxiliary(): void {
    const auxiliary = this.auxiliary;
    if (!auxiliary) return;
    this.retirePictures();
    auxiliary.stop();
    auxiliary.surface.reset(auxiliary.lost, true);
    this.auxiliary = undefined;
  }
  canBuildFrame(): boolean {
    return (
      !!this.display &&
      !this.closed &&
      !this.lost &&
      !this.failed &&
      this.visible &&
      this.pending.size < 2
    );
  }
  submit(
    frame: PaintFrame,
    lease: ResourceLease,
    diagnostics?: FrameDiagnostics,
    composition?: WebDisplayComposition,
  ): SubmitResult {
    if (this.closed) return { status: 'rejected', reason: 'closed' };
    if (!this.metrics || !isCurrent(frame, this.owner, this.metrics))
      return { status: 'rejected', reason: 'stale' };
    if (!this.metrics.physicalWidth || !this.metrics.physicalHeight)
      return { status: 'rejected', reason: 'zero-size' };
    if (frame.estimatedBytes > 512 * 1024) return { status: 'rejected', reason: 'oversize' };
    if (!this.canBuildFrame() || this.pending.has(frame.token.sequence)) {
      return { status: 'rejected', reason: 'busy' };
    }
    const displays =
      composition?.layers.map(({ canvas, range }) => {
        const commands = platformViewDrawCommands(frame.commands, range);
        let entry = this.platformDisplays.get(canvas);
        if (!entry) {
          const surface = new WebSkiaSurface(this.ck, canvas, this.options);
          surface.prepare();
          this.platformDisplays.set(canvas, (entry = { surface, retiring: false }));
        }
        if (entry.retiring) throw new Error('Platform view display canvas has retired');
        return { surface: entry.surface, commands };
      }) ?? [];
    displays.push({
      surface: this.display!,
      commands: composition
        ? platformViewDrawCommands(frame.commands, composition.background)
        : frame.commands,
    });
    const fences: Pending['fences'][number][] = [];
    try {
      for (const { surface, commands } of displays) {
        const fence = surface.submit(
          frame,
          (canvas, scale) => this.replay.draw(canvas, frame, scale, commands),
          surface === this.display ? diagnostics : undefined,
          this.metrics,
        );
        fences.push({ surface, fence });
      }
    } catch (error) {
      if (composition) {
        // Some surfaces may already have submitted. Complete their reads before
        // the caller retries the unsplit frame with the same resource lease.
        for (const { surface } of displays) surface.finish();
        for (const { surface, fence } of fences) surface.release(fence);
      }
      throw error;
    }
    lease.transfer();
    this.pending.set(frame.token.sequence, { fences, lease, started: performance.now() });
    this.events.accepted(frame.token.sequence, frame.token);
    this.schedule();
    return { status: 'accepted', submission: frame.token.sequence };
  }
  private schedule() {
    if (this.timer !== undefined || this.closed || !this.pending.size) return;
    this.timer = setTimeout(() => {
      this.timer = undefined;
      this.pollCompletedFrames();
    }, 5);
  }
  /** Reclaim signaled slots before a browser frame, even if its timer has not run. */
  pollCompletedFrames(): void {
    if (this.closed || this.lost || this.failed || !this.pending.size) return;
    for (const [id, pending] of this.pending) {
      const statuses = pending.fences.map(({ surface, fence }) =>
        surface.poll(fence, pending.started),
      );
      const failed = statuses.includes('failed');
      if (statuses.every((status) => status === 'signaled')) {
        this.pending.delete(id);
        for (const { surface, fence } of pending.fences) surface.release(fence);
        try {
          pending.lease.returnBy('renderer');
        } finally {
          this.events.retired(id, 'gpu-retired');
          this.releasePlatformDisplays();
        }
      } else if (failed || statuses.includes('timeout')) {
        this.failed = true;
        this.events.failed(
          id,
          failed
            ? 'WebGL fence failed; lease retained until owned drain'
            : 'WebGL fence timeout; lease retained until owned drain',
        );
      }
    }
    if (this.failed || !this.pending.size) this.clearTimer();
    else this.schedule();
  }
  setVisible(value: boolean) {
    this.visible = value;
  }
  lose() {
    if (this.closed || this.lost) return;
    this.lost = true;
    this.clearTimer();
    this.retirePictures();
    this.retireFrameNative();
    this.runtimePrograms.clear();
    for (const { surface } of this.platformDisplays.values()) {
      surface.finish();
      surface.reset(true);
    }
    this.display?.reset(true);
    this.releasePending('discarded');
    this.releasePlatformDisplays();
  }
  restore() {
    this.ensureOpen();
    this.lost = false;
    this.failed = false;
  }
  private clearTimer() {
    if (this.timer !== undefined) {
      clearTimeout(this.timer);
      this.timer = undefined;
    }
  }
  private releasePending(result: 'discarded' | 'drained') {
    for (const [id, pending] of this.pending) {
      this.pending.delete(id);
      if (!this.lost) for (const { surface, fence } of pending.fences) surface.release(fence);
      try {
        pending.lease.returnBy('renderer');
      } finally {
        this.events.retired(id, result);
      }
    }
  }
  private ensureOpen() {
    if (this.runtimePrograms.retirementError) throw this.runtimePrograms.retirementError;
    if (this.unconfirmedPicture) throw this.unconfirmedPicture;
    if (this.closed) throw new Error('Web Skia library closed');
  }
  dispose(): Promise<void> {
    if (this.closePromise) return this.closePromise;
    let resolve!: () => void, reject!: (error: unknown) => void;
    const closing = new Promise<void>((done, fail) => {
      resolve = done;
      reject = fail;
    });
    this.closePromise = closing;
    this.closed = true;
    try {
      this.events.stop();
      this.clearTimer();
      if (this.runtimePrograms.retirementError) throw this.runtimePrograms.retirementError;
      if (this.unconfirmedPicture) throw this.unconfirmedPicture;
      this.retirePictures();
      if (!this.lost) this.display?.finish();
      if (!this.lost) for (const { surface } of this.platformDisplays.values()) surface.finish();
      this.releasePending('drained');
      this.retireFrameNative();
      this.runtimePrograms.dispose();
      this.display?.reset(this.lost, true);
      for (const { surface } of this.platformDisplays.values()) surface.reset(this.lost, true);
      this.platformDisplays.clear();
      this.closeAuxiliary();
      this.events.drain();
      resolve();
    } catch (error) {
      reject(error);
    }
    return closing;
  }
}
