// SPDX-License-Identifier: BSD-3-Clause
import type {
  CanvasKit,
  SkPicture as Picture,
  Surface,
  TypefaceFontProvider,
  FontCollection,
  Typeface,
  GrDirectContext,
  Paragraph,
  ParagraphBuilder,
  ParagraphStyle,
  Path,
  Image,
  MallocObj,
} from 'canvaskit-wasm';
import { protocol as p } from '../../../runtime/engine-client/schema.ts';
import { decodeUtf8 } from '../../../runtime/engine-client/utf8.ts';
import type {
  EngineResponse,
  EngineNodeSnapshot,
  ProviderMeasurement,
  NodeHandle,
} from '../../../runtime/engine-client/codec.ts';
import type { FontResourceSlice } from '../../../runtime/engine-client/font-resource.ts';
import { key, script, verified, CommittedMemoryError } from '../../platform/web/common.ts';
import { lineIndexUnit, lineNumberAtUTF16, editingGeometry } from './paragraph.ts';
import type { LineIndexUnit } from './paragraph.ts';
import { paintControl } from './controls.ts';
import { providerImage, paintImage } from './image.ts';
import {
  makePath,
  makeRoundedRectPath,
  nativePaintShape,
  paintShape,
  paintNative,
  nativePaintOutset,
  paintNativeShadow,
  nativeLinearMask,
  nativeMaskBounds,
  paintNativeMask,
  canvasMatrix,
  relativeMatrix,
} from './graphics.ts';
import type { ProviderMemoryBudget } from '../../platform/web/memory.ts';
import { admitHeapGrowth } from '../../platform/web/heap.ts';
import type { AppTextInput } from '../../../runtime/engine-client/app-text.ts';
import {
  validateParagraphRuns,
  paragraphPaintOutset,
} from '../../../runtime/engine-client/paragraph-runs.ts';
import { validateParagraphPlaceholders } from '../../../runtime/engine-client/paragraph-extras.ts';
import { readFontCatalog } from '../../../runtime/engine-client/font-catalog.ts';
import { acquireImageResources } from '../../../runtime/engine-client/image-resource.ts';
import type { ImageResourceSlice } from '../../../runtime/engine-client/image-resource.ts';
import type { FontCatalog } from '../../../runtime/engine-client/font-catalog.ts';
import type { SnapshotAccess, SnapshotDecision } from '../../../runtime/engine-client/snapshot.ts';
export interface ProviderFont {
  id: string;
  family: string;
  bytes: Uint8Array;
}
export interface AppImmutableData {
  readonly length: number;
  copyForImage(offset?: number, length?: number): Uint8Array;
  read(offset: number, length: number): Uint8Array;
  close(): void;
}
export const canvasKitSupply = Object.freeze({
  version: 'm153-nelyx-paragraph.7',
  variant: 'owned-full',
  paragraphApiVersion: 1,
  pictureApiVersion: 3,
  fontApiVersion: 1,
  initialMemoryBytes: 128 * 1024 * 1024,
  maximumMemoryBytes: 256 * 1024 * 1024,
});
type PictureFont = { font: string; coordinates: { axis: number; value: number }[] };
type PictureFontCache = {
  clear(): void;
  delete(): void;
  size(): number;
  hits(): number;
  misses(): number;
};
type ParagraphRuntime = CanvasKit & {
  nelyxFontApiVersion?: () => number;
  nelyxMakeFontProvider?: (faces: Typeface[], families: string[]) => TypefaceFontProvider | null;
  nelyxParagraphApiVersion?: () => number;
  nelyxPictureApiVersion?: () => number;
  NelyxPictureFontCache?: new () => PictureFontCache;
  nelyxSerializePicture?: (
    picture: Picture,
    bases: Typeface[],
    identities: string[],
  ) => {
    bytes: Uint8Array;
    fonts: { source: number; coordinates: { axis: number; value: number }[] }[];
  } | null;
  nelyxMakePicture?: (
    bytes: Uint8Array,
    bases: Typeface[],
    coordinates: PictureFont['coordinates'][],
    identities: string[],
    cache: PictureFontCache,
  ) => Picture | null;
};
const pictureFontBytes = (fonts: readonly PictureFont[] | undefined) =>
  fonts?.reduce((sum, font) => sum + 64 + font.font.length * 2 + font.coordinates.length * 24, 0) ??
  0;

export interface WebManifest {
  schema: string;
  abi: { major: number; schema: number };
  files: { path: string; sha256: string }[];
  canvasKit: {
    version: string;
    variant: string;
    paragraphApiVersion: number;
    pictureApiVersion: number;
    fontApiVersion: number;
    initialMemoryBytes: number;
    maximumMemoryBytes: number;
    sourceManifest: string;
    js: string;
    wasm: string;
  };
  fonts: { path: string; family: string }[];
  appText?: {
    version: number;
    bootstrapVersion: number;
    script: string;
    quotaBytes: number;
    fontRevision: number;
  };
}
export interface PreparedPictures {
  preparation: bigint;
  metrics: bigint;
  device: bigint;
  document: bigint;
  pictures: { node: string; bytes: ArrayBuffer; fonts?: PictureFont[] }[];
  fontCatalogs?: { resource: NodeHandle; bytes: ArrayBuffer }[];
  /** References belong to the exact still-active immutable preparation. */
  basePreparation?: bigint;
  reused?: string[];
  fontReferences?: NodeHandle[];
  texts: {
    node: string;
    width: number;
    height: number;
    color: number;
    bounds?: { x: number; y: number; width: number; height: number };
    runs: {
      font: string;
      size: number;
      glyphs: Uint16Array;
      positions: Float32Array;
      bold: boolean;
      italic: boolean;
      weight?: number;
      probe?: string;
    }[];
  }[];
  paths: {
    node: string;
    segments: readonly import('../../../runtime/engine-client/codec.ts').PathSegment[];
    fillRule: 'winding' | 'evenOdd';
    roundedRect?: readonly number[];
    transform?: import('../../../runtime/engine-client/codec.ts').AffineMatrix;
  }[];
  local?: Map<string, Picture>;
}
type PreparedText = PreparedPictures['texts'][number];
type ContentRecord = {
  token: number;
  signature: string;
  resource: Uint8Array | undefined;
  picture: Picture | undefined;
  encoded: Uint8Array | undefined;
  fonts?: PictureFont[];
  text: PreparedText | undefined;
  bytes: number;
  release: () => void;
};
export interface AppFontCatalog {
  readonly provider: TypefaceFontProvider;
  readonly fallback: readonly string[];
  readonly families: readonly string[];
  readonly faces: readonly { readonly id: string; readonly face: Typeface }[];
  close(): void;
}
type ResourceFont = {
  readonly resource: NodeHandle;
  readonly bytes: Uint8Array;
  readonly catalog: AppFontCatalog;
  readonly release: () => void;
  holds: number;
};
const sameBytes = (a: Uint8Array | undefined, b: Uint8Array | undefined): boolean =>
  a === b || (!!a && !!b && a.length === b.length && a.every((value, index) => value === b[index]));
const copyText = (text: PreparedText): PreparedText => ({
  ...text,
  runs: text.runs.map((run) => ({
    ...run,
    glyphs: run.glyphs.slice(),
    positions: run.positions.slice(),
  })),
});
const textBytes = (text: PreparedText | undefined): number =>
  text?.runs.reduce(
    (sum, run) =>
      sum + run.glyphs.byteLength + run.positions.byteLength + (run.probe?.length ?? 0) * 2,
    0,
  ) ?? 0;
export class CanvasKitProvider {
  private readonly paragraphCollections = new Map<TypefaceFontProvider, FontCollection>();
  private paragraphCollection(provider: TypefaceFontProvider): FontCollection {
    let collection = this.paragraphCollections.get(provider);
    if (collection) return collection;
    collection = this.ck.FontCollection.Make();
    try {
      collection.setDefaultFontManager(provider);
      collection.enableFontFallback();
      this.paragraphCollections.set(provider, collection);
      return collection;
    } catch (error) {
      collection.delete();
      throw error;
    }
  }
  private releaseParagraphCollection(provider: TypefaceFontProvider): void {
    this.paragraphCollections.get(provider)?.delete();
    this.paragraphCollections.delete(provider);
  }
  private snapshotAccess: SnapshotAccess | undefined;
  private readonly snapshots = new Map<bigint, { image: Image; release: () => void }>();
  bindSnapshots(access: SnapshotAccess): void {
    if (this.snapshotAccess) throw Error('Snapshot Core connection is already bound');
    this.snapshotAccess = access;
  }
  private pruneSnapshots(decision: SnapshotDecision): void {
    for (const [token, entry] of this.snapshots)
      if (!decision.liveTokens.has(token)) {
        entry.release();
        this.snapshots.delete(token);
      }
    this.counters.liveSnapshots = this.snapshots.size;
  }
  private captureSnapshot(
    frame: bigint,
    node: NodeHandle,
    decision: SnapshotDecision,
    paint: (canvas: ReturnType<Surface['getCanvas']>) => void,
    scratchBytes: number,
  ): void {
    let surface: Surface | null = null,
      pixels: MallocObj | null = null,
      image: Image | null = null;
    let releaseMetadata: (() => void) | undefined;
    const release = () => {
      image?.delete();
      image = null;
      surface?.delete();
      surface = null;
      if (pixels) this.ck.Free(pixels);
      pixels = null;
      releaseMetadata?.();
    };
    try {
      releaseMetadata = this.budget?.reserve(2, 256);
      this.guarded(decision.pixelWidth * decision.pixelHeight * 16 + scratchBytes, () => {
        pixels = this.ck.Malloc(Uint8Array, decision.pixelWidth * decision.pixelHeight * 4);
        if (!pixels.byteOffset) throw Error('Snapshot raster pixels allocation failed');
        surface = this.ck.MakeRasterDirectSurface(
          {
            width: decision.pixelWidth,
            height: decision.pixelHeight,
            alphaType: this.ck.AlphaType.Premul,
            colorType: this.ck.ColorType.RGBA_8888,
            colorSpace: this.ck.ColorSpace.SRGB,
          },
          pixels,
          decision.pixelWidth * 4,
        );
        if (!surface) throw Error('Snapshot raster surface allocation failed');
        const target = surface.getCanvas();
        target.clear(this.ck.TRANSPARENT);
        target.scale(decision.ratio, decision.ratio);
        paint(target);
        const original = surface.makeImageSnapshot();
        try {
          image = original.makeCopyWithDefaultMipmaps();
        } finally {
          original.delete();
        }
        if (!image) throw Error('Snapshot image allocation failed');
      });
      this.snapshots.set(decision.token, { image: image!, release });
      this.snapshotAccess!(frame, 2, node, decision.token);
      ++this.counters.snapshotCaptures;
      this.counters.liveSnapshots = this.snapshots.size;
    } catch (error) {
      this.snapshots.delete(decision.token);
      release();
      try {
        this.snapshotAccess!(frame, 3, node, decision.token);
      } catch (failure) {
        throw new AggregateError([error, failure], 'Snapshot capture and rollback failed');
      }
      throw error;
    }
  }
  private static readonly fontVariationLimit = 16;
  private packetHolds = new Map<bigint, () => void>();
  private backingRelease: (() => void) | undefined;
  private cacheRelease: (() => void) | undefined;
  private closing = false;
  private memoryPressure = false;
  private recorded = new Map<string, ContentRecord>();
  private nextRecordToken = 0;
  private readonly preparedRecords = new Map<
    bigint,
    {
      tokens: ReadonlyMap<string, number>;
      fonts: ReadonlySet<string>;
      release(): void;
    }
  >();
  private pictureOwners = new Map<Picture, number>();
  private pathTables = new Map<bigint, Map<string, Path>>();
  private measuredParagraphs = new Map<string, { signature: string; paragraph: Paragraph }>();
  private measurePreparation = 0n;
  private fontProvider: TypefaceFontProvider;
  private typefaces = new Map<string, Typeface>();
  private regularTypefaces = new Map<string, { face: Typeface; release: () => void }>();
  private regularProbes = new Map<string, string>();
  private fontAliases = new Map<string, string>();
  private families = new Map<string, string>();
  private fontFamilies: string[] = [];
  private readonly appFonts = new Set<AppFontCatalog>();
  private fontCatalogSequence = 0;
  private readonly resourceFonts = new Map<string, ResourceFont>();
  private readonly paragraphFonts = new WeakMap<Paragraph, () => void>();
  private readonly tableFonts = new Map<bigint, () => void>();
  private pictureFonts: PictureFontCache | undefined;
  private fontScopes = 0;
  private readonly immutableBuffers = new Set<AppImmutableData>();
  readonly textCapabilities: {
    lineIndexUnit: LineIndexUnit;
    unscaledAscent: boolean;
    softHyphenSwitch: boolean;
  };
  private surface: Surface | null = null;
  private canvas: OffscreenCanvas | undefined;
  private context: GrDirectContext | null = null;
  private contextHandle = 0;
  readonly tables = new Map<bigint, Map<string, Picture>>();
  readonly counters = {
    dynamicFontLoads: 0,
    resourceFontCatalogs: 0,
    resourceFontBytes: 0,
    paragraphs: 0,
    images: 0,
    pictures: 0,
    imports: 0,
    draws: 0,
    clipCulledNodes: 0,
    snapshotCaptures: 0,
    snapshotReuses: 0,
    liveSnapshots: 0,
    livePaints: 0,
    livePaintEntries: 0,
    orderedParagraphs: 0,
    foregroundPaints: 0,
    serializedBytes: 0,
    livePictures: 0,
    liveSurfaces: 0,
    liveContexts: 0,
    fontBytes: 0,
    liveFontVariations: 0,
    fontVariationLimit: CanvasKitProvider.fontVariationLimit,
    sourceBytes: 0,
    heapBytes: 0,
    textPictureProbeBytes: 0,
    glyphBytes: 0,
    fontReferencePictures: 0,
    fontReferenceImports: 0,
    fontReferenceBytes: 0,
    livePictureFontVariations: 0,
    pictureFontCacheHits: 0,
    pictureFontCacheMisses: 0,
    measurements: 0,
    paragraphLayouts: 0,
    liveParagraphs: 0,
    gpuReservedBytes: 0,
    unifiedMemory: false,
    graphicsRecords: 0,
    nativeExtensions: 0,
    reusedPictures: 0,
    reusedParagraphs: 0,
    reusedImages: 0,
    referencedPictures: 0,
    referencedImports: 0,
    referencedFontCatalogs: 0,
    fontCatalogCopyBytes: 0,
    avoidedPictureCopyBytes: 0,
    livePaintKeysSkipped: 0,
    cachedContentBytes: 0,
    memoryPressure: false,
    gpuCacheLimitBytes: 32 * 1024 * 1024,
    immutableBufferCopies: 0,
    immutableBufferCopyBytes: 0,
    immutableBufferReads: 0,
    immutableBufferReadBytes: 0,
    liveImmutableBuffers: 0,
    liveImmutableBufferBytes: 0,
  };
  private holdPicture(picture: Picture): void {
    const count = this.pictureOwners.get(picture) ?? 0;
    if (!count) ++this.counters.livePictures;
    this.pictureOwners.set(picture, count + 1);
  }
  private dropPicture(picture: Picture): void {
    const count = this.pictureOwners.get(picture);
    if (!count) throw new Error('Picture ownership underflow');
    if (count === 1) {
      this.pictureOwners.delete(picture);
      picture.delete();
      --this.counters.livePictures;
    } else this.pictureOwners.set(picture, count - 1);
  }
  trimCache(): void {
    for (const record of this.recorded.values()) {
      if (record.picture) this.dropPicture(record.picture);
      record.release();
    }
    this.recorded.clear();
    this.counters.cachedContentBytes = 0;
    this.discardMeasurements();
    for (const provider of this.paragraphCollections.keys())
      this.releaseParagraphCollection(provider);
    for (const entry of this.regularTypefaces.values()) {
      entry.face.delete();
      entry.release();
    }
    this.regularTypefaces.clear();
    this.counters.liveFontVariations = 0;
    this.pictureFonts?.clear();
    this.counters.livePictureFontVariations = 0;
  }
  setMemoryPressure(low: boolean): void {
    this.memoryPressure = this.counters.memoryPressure = low;
    this.counters.gpuCacheLimitBytes = (low ? 4 : 32) * 1024 * 1024;
    this.context?.setResourceCacheLimitBytes(this.counters.gpuCacheLimitBytes);
    if (low) this.trimCache();
    // CanvasKit's committed heap and in-use GPU resources remain reserved.
    // A lower cache limit does not prove that the driver returned those bytes.
  }
  gl: { version: number; renderer: string } | undefined;
  private constructor(
    readonly ck: CanvasKit,
    font: Uint8Array | ProviderFont[],
    private budget?: ProviderMemoryBudget,
  ) {
    this.fontProvider = ck.TypefaceFontProvider.Make();
    try {
      const runtime = ck as ParagraphRuntime;
      if (
        runtime.nelyxPictureApiVersion?.() !== canvasKitSupply.pictureApiVersion ||
        !runtime.nelyxSerializePicture ||
        !runtime.nelyxMakePicture ||
        !runtime.NelyxPictureFontCache
      )
        throw Error('Owned font-reference Picture capability missing');
      if (
        runtime.nelyxFontApiVersion?.() !== canvasKitSupply.fontApiVersion ||
        !runtime.nelyxMakeFontProvider
      )
        throw Error('Owned immutable font-collection capability missing');
      for (const input of font instanceof Uint8Array
        ? [{ id: 'default', family: 'NelyxDefault', bytes: font }]
        : font) {
        if (this.typefaces.has(input.id)) throw new Error('Duplicate provider font identity');
        this.counters.fontBytes += input.bytes.length;
        if (this.counters.fontBytes > 16 * 1024 * 1024)
          throw new Error('Provider font budget exceeded');
        const face = ck.Typeface.MakeTypefaceFromData(input.bytes.slice().buffer);
        if (!face) throw new Error('Provider font decode failed');
        this.typefaces.set(input.id, face);
        this.fontAliases.set(input.id, input.family);
        this.families.set(face.getFamilyName(), input.id);
        this.fontFamilies.push(input.family);
      }
      const collection = runtime.nelyxMakeFontProvider!(
        [...this.typefaces.values()],
        [...this.fontAliases.values()],
      );
      if (!collection) throw Error('Bundled immutable font collection failed');
      this.fontProvider.delete();
      this.fontProvider = collection;
      const probeNode = {
        node: { slot: 0, generation: 0 },
        fontSize: 18,
        color: 0xff000000,
        textDirection: 0,
      } as EngineNodeSnapshot;
      const text = '한글\nA😀\ne\u0301',
        probe = this.paragraph(probeNode, text, 300);
      try {
        this.textCapabilities = {
          lineIndexUnit: lineIndexUnit(probe, text),
          unscaledAscent: 'unscaledAscent' in probe.getLineMetrics()[0]!,
          softHyphenSwitch: (ck as ParagraphRuntime).nelyxParagraphApiVersion?.() === 1,
        };
      } finally {
        probe.delete();
      }
      this.counters.heapBytes = (ck as unknown as { HEAPU8: Uint8Array }).HEAPU8.byteLength;
      this.syncMemory();
      this.counters.unifiedMemory = !!budget;
    } catch (error) {
      for (const provider of this.paragraphCollections.keys())
        this.releaseParagraphCollection(provider);
      for (const face of this.typefaces.values()) face.delete();
      this.fontProvider.delete();
      throw error;
    }
  }
  private syncMemory(): void {
    this.counters.heapBytes = (this.ck as unknown as { HEAPU8: Uint8Array }).HEAPU8.byteLength;
    try {
      this.budget?.set(1, this.counters.heapBytes);
    } catch (error) {
      throw new CommittedMemoryError(
        'CanvasKit committed heap exceeded the unified budget: ' + String(error),
      );
    }
  }
  private guarded<T>(bytes: number, run: () => T): T {
    this.syncMemory();
    const release = this.budget?.reserve(4, bytes);
    try {
      return run();
    } finally {
      try {
        this.syncMemory();
      } finally {
        release?.();
      }
    }
  }
  releasePacket(preparation: bigint): void {
    this.packetHolds.get(preparation)?.();
    this.packetHolds.delete(preparation);
  }
  private forgetPreparedRecords(preparation: bigint): void {
    this.preparedRecords.get(preparation)?.release();
    this.preparedRecords.delete(preparation);
  }
  private rememberPreparedRecords(
    preparation: bigint,
    records: ReadonlyMap<string, ContentRecord>,
    fonts: readonly ResourceFont[],
  ): void {
    const release = this.budget?.reserve(2, 256 + (records.size + fonts.length) * 64) ?? (() => {});
    let kept = false;
    try {
      const tokens = new Map([...records].map(([id, record]) => [id, record.token]));
      const ids = new Set(fonts.map((font) => key(font.resource)));
      this.forgetPreparedRecords(preparation);
      this.preparedRecords.set(preparation, { tokens, fonts: ids, release });
      kept = true;
    } finally {
      if (!kept) release();
    }
  }
  createImmutableBuffer(bytes: Uint8Array): AppImmutableData {
    if (
      this.closing ||
      !(bytes instanceof Uint8Array) ||
      !(bytes.buffer instanceof ArrayBuffer) ||
      bytes.length > p.limits.resourceBytes
    )
      throw Error('Invalid/closed immutable buffer capture');
    this.syncMemory();
    const allocation = this.ck.Malloc(Uint8Array, Math.max(1, bytes.length));
    let dead = false;
    try {
      if (!allocation.byteOffset) throw Error('CanvasKit immutable buffer allocation failed');
      (this.ck as unknown as { HEAPU8: Uint8Array }).HEAPU8.set(bytes, allocation.byteOffset);
      this.syncMemory();
      const length = bytes.length;
      const value: AppImmutableData = {
        length,
        copyForImage: (offset = 0, size = length) => {
          if (dead) throw Error('Image source immutable buffer is retired');
          if (
            !Number.isSafeInteger(offset) ||
            !Number.isSafeInteger(size) ||
            offset < 0 ||
            size < 0 ||
            offset > length - size
          )
            throw Error('Image source copy is outside its immutable buffer');
          return new Uint8Array(
            (this.ck as unknown as { HEAPU8: Uint8Array }).HEAPU8.subarray(
              allocation.byteOffset + offset,
              allocation.byteOffset + offset + size,
            ),
          );
        },
        read: (offset, size) => {
          if (
            dead ||
            !Number.isSafeInteger(offset) ||
            !Number.isSafeInteger(size) ||
            offset < 0 ||
            size < 0 ||
            size > p.limits.fontChunkBytes ||
            offset > length ||
            size > length - offset
          )
            throw Error('ImmutableBuffer chunk is outside a live buffer');
          // Heap growth invalidates old views; always use the current heap.
          const result = new Uint8Array(
            (this.ck as unknown as { HEAPU8: Uint8Array }).HEAPU8.subarray(
              allocation.byteOffset + offset,
              allocation.byteOffset + offset + size,
            ),
          );
          ++this.counters.immutableBufferReads;
          this.counters.immutableBufferReadBytes += size;
          return result;
        },
        close: () => {
          if (dead) return;
          this.ck.Free(allocation);
          dead = true;
          this.immutableBuffers.delete(value);
          --this.counters.liveImmutableBuffers;
          this.counters.liveImmutableBufferBytes -= length;
          this.syncMemory();
        },
      };
      this.immutableBuffers.add(value);
      ++this.counters.immutableBufferCopies;
      this.counters.immutableBufferCopyBytes += length;
      ++this.counters.liveImmutableBuffers;
      this.counters.liveImmutableBufferBytes += length;
      return value;
    } catch (error) {
      this.ck.Free(allocation);
      this.syncMemory();
      throw error;
    }
  }
  syncAppImageMemory(): void {
    this.syncMemory();
  }
  static async load(
    root: string,
    budget?: ProviderMemoryBudget,
    signal?: AbortSignal,
  ): Promise<CanvasKitProvider> {
    const downloads: Promise<Uint8Array>[] = [];
    const controller = new AbortController();
    const cancel = () => controller.abort(signal?.reason);
    signal?.addEventListener('abort', cancel, { once: true });
    let release: (() => void) | undefined;
    try {
      signal?.throwIfAborted();
      release = budget?.reserve(4, 48 * 1024 * 1024);
      const manifest = (await (
        await fetch(new URL('engine-manifest.json', root), { signal: controller.signal })
      ).json()) as WebManifest;
      controller.signal.throwIfAborted();
      if (
        manifest.canvasKit.version !== canvasKitSupply.version ||
        manifest.canvasKit.variant !== canvasKitSupply.variant ||
        manifest.canvasKit.paragraphApiVersion !== canvasKitSupply.paragraphApiVersion ||
        manifest.canvasKit.pictureApiVersion !== canvasKitSupply.pictureApiVersion ||
        manifest.canvasKit.fontApiVersion !== canvasKitSupply.fontApiVersion ||
        manifest.canvasKit.initialMemoryBytes !== canvasKitSupply.initialMemoryBytes ||
        manifest.canvasKit.maximumMemoryBytes !== canvasKitSupply.maximumMemoryBytes
      )
        throw new Error('CanvasKit supplier differs');
      const entry = (name: string) => {
        const file = manifest.files.find((f) => f.path === name);
        if (!file) throw new Error('Asset absent from manifest: ' + name);
        return file;
      };
      if (!manifest.fonts?.length || manifest.fonts.length > 8)
        throw new Error('Declared provider fonts missing');
      const download = (name: string, maximum = 32 * 1024 * 1024) => {
        const work = verified(root, entry(name), maximum, controller.signal);
        downloads.push(work);
        return work;
      };
      const [js, wasm, source, ...fonts] = await Promise.all([
        download(manifest.canvasKit.js),
        download(manifest.canvasKit.wasm),
        download(manifest.canvasKit.sourceManifest),
        ...manifest.fonts.map((font) => download(font.path, 16 * 1024 * 1024)),
      ]);
      controller.signal.throwIfAborted();
      const supplied = JSON.parse(new TextDecoder().decode(source));
      if (
        supplied.schema !== 'nelyx.canvaskit/v1' ||
        supplied.version !== canvasKitSupply.version ||
        supplied.paragraphApiVersion !== canvasKitSupply.paragraphApiVersion ||
        supplied.pictureApiVersion !== canvasKitSupply.pictureApiVersion ||
        supplied.fontApiVersion !== canvasKitSupply.fontApiVersion ||
        supplied.initialMemoryBytes !== canvasKitSupply.initialMemoryBytes ||
        supplied.maximumMemoryBytes !== canvasKitSupply.maximumMemoryBytes ||
        !supplied.files?.some(
          (file: { id: string; sha256: string }) =>
            file.id === 'canvaskit.js' && file.sha256 === entry(manifest.canvasKit.js).sha256,
        ) ||
        !supplied.files?.some(
          (file: { id: string; sha256: string }) =>
            file.id === 'canvaskit.wasm' && file.sha256 === entry(manifest.canvasKit.wasm).sha256,
        )
      )
        throw Error('Owned CanvasKit source manifest differs');
      await script(js);
      controller.signal.throwIfAborted();
      const factory = (
        globalThis as unknown as { CanvasKitInit?: (options: unknown) => Promise<CanvasKit> }
      ).CanvasKitInit;
      if (!factory) throw new Error('Owned CanvasKit factory missing');
      // Initial Wasm memory cannot be undone with delete(). Keep its credit on
      // initialization failure/cancellation until the App worker is terminated.
      budget?.set(1, canvasKitSupply.initialMemoryBytes);
      const ck = await factory({
        wasmBinary: wasm,
        locateFile: () => new URL(manifest.canvasKit.wasm, root).href,
      });
      const memory = (ck as unknown as { wasmMemory: WebAssembly.Memory }).wasmMemory;
      if (!(memory instanceof WebAssembly.Memory))
        throw Error('Owned CanvasKit memory admission capability missing');
      if (budget) admitHeapGrowth(memory, budget);
      budget?.set(1, (ck as unknown as { HEAPU8: Uint8Array }).HEAPU8.byteLength);
      // Instantiation itself is not abortable. Do not publish a late result or
      // claim disposal until the factory has actually settled.
      controller.signal.throwIfAborted();
      if (
        (ck as ParagraphRuntime).nelyxParagraphApiVersion?.() !==
          canvasKitSupply.paragraphApiVersion ||
        (ck as ParagraphRuntime).nelyxPictureApiVersion?.() !== canvasKitSupply.pictureApiVersion ||
        !(ck as ParagraphRuntime).nelyxSerializePicture ||
        !(ck as ParagraphRuntime).nelyxMakePicture ||
        !(ck as ParagraphRuntime).NelyxPictureFontCache ||
        (ck as ParagraphRuntime).nelyxFontApiVersion?.() !== canvasKitSupply.fontApiVersion ||
        !(ck as ParagraphRuntime).nelyxMakeFontProvider ||
        !ck.MakePicture ||
        !ck.ParagraphBuilder.MakeFromFontCollection ||
        !ck.FontCollection?.Make ||
        !ck.GetWebGLContext ||
        !ck.MakeWebGLContext ||
        !ck.MakeOnScreenGLSurface ||
        !ck.deleteContext
      )
        throw new Error('Owned CanvasKit paragraph/graphics capability missing');
      return new CanvasKitProvider(
        ck,
        manifest.fonts.map((font, i) => ({
          id: entry(font.path).sha256,
          family: font.family,
          bytes: fonts[i]!,
        })),
        budget,
      );
    } catch (error) {
      controller.abort(error);
      // One failed download must retire its siblings before staging is freed.
      await Promise.allSettled(downloads);
      release?.();
      budget?.close();
      throw error;
    } finally {
      signal?.removeEventListener('abort', cancel);
      release?.();
    }
  }
  attach(canvas: OffscreenCanvas): void {
    if (this.canvas) throw new Error('Canvas owner already attached');
    this.canvas = canvas;
  }
  private color(argb: number) {
    return this.ck.Color((argb >>> 16) & 255, (argb >>> 8) & 255, argb & 255, (argb >>> 24) / 255);
  }
  private regularTypeface(id: string, probe: string, weight = 400): Typeface {
    const variationKey = id + ':' + weight;
    if (typeof probe !== 'string' || Array.from(probe).length !== 1 || /[\p{C}\p{Z}]/u.test(probe))
      throw Error('Invalid prepared font variation probe');
    const previous = this.regularTypefaces.get(variationKey);
    if (previous) {
      this.regularTypefaces.delete(variationKey);
      this.regularTypefaces.set(variationKey, previous);
      return previous.face;
    }
    const base = this.typefaces.get(id),
      family = this.fontAliases.get(id);
    if (!base || !family || !base.getGlyphIDs(probe)[0])
      throw Error('Prepared font variation probe is outside the installed font');
    // The public paragraph API returns the actual varied typeface. Preserve
    // that instance rather than reconstructing a variable font at its default.
    if (this.regularTypefaces.size >= CanvasKitProvider.fontVariationLimit) {
      const oldest = this.regularTypefaces.entries().next().value!;
      this.regularTypefaces.delete(oldest[0]);
      oldest[1].face.delete();
      oldest[1].release();
      this.counters.liveFontVariations = this.regularTypefaces.size;
    }
    const release = this.budget?.reserve(2, 65536) ?? (() => {});
    let builder: ParagraphBuilder | undefined,
      paragraph: Paragraph | undefined,
      selected: Typeface | undefined;
    try {
      builder = this.ck.ParagraphBuilder.MakeFromFontCollection(
        new this.ck.ParagraphStyle({
          textStyle: {
            fontFamilies: [family],
            fontSize: 14,
            fontStyle: {
              weight: weight as unknown as import('canvaskit-wasm').FontWeight,
              slant: this.ck.FontSlant.Upright,
            },
            fontVariations: [{ axis: 'wght', value: weight }],
          },
        }),
        this.paragraphCollection(this.fontProvider),
      );
      builder.addText(probe);
      paragraph = builder.build();
      paragraph.layout(1024);
      for (const line of paragraph.getShapedLines())
        for (const run of line.runs) {
          if (!selected && run.typeface?.getFamilyName() === base.getFamilyName())
            selected = run.typeface;
          else run.typeface?.delete();
        }
      if (!selected) throw Error('Installed font variation could not be prepared');
      this.regularTypefaces.set(variationKey, { face: selected, release });
      this.counters.liveFontVariations = this.regularTypefaces.size;
      return selected;
    } catch (error) {
      selected?.delete();
      release();
      throw error;
    } finally {
      paragraph?.delete();
      builder?.delete();
    }
  }
  private paragraph(
    node: EngineNodeSnapshot,
    text: string,
    width: number,
    catalog?: AppFontCatalog,
  ): Paragraph {
    const resource = node.fontBinding?.resource,
      resourceFont = resource ? this.resourceFonts.get(key(resource)) : undefined,
      selectedCatalog = catalog ?? resourceFont?.catalog;
    if (resource && !resourceFont)
      throw Error('Content font resource has not been prepared on this owner');
    const fontFamilies = selectedCatalog?.fallback ?? this.fontFamilies;
    if (node.paintPlacement?.unbounded) width = Infinity;
    if (node.kind === p.kinds.editable) {
      if (node.editing?.flags && node.editing.flags & p.editFlags.password)
        text = text.replace(/[^\r\n]/g, '\u2022');
      if (!text) text = '\u200b';
    }
    const signature = JSON.stringify([
      text,
      node.fontSize,
      node.color,
      width,
      node.textDirection ?? 0,
      node.paragraph,
      node.fontBinding && [
        node.fontBinding.resource,
        String(node.fontBinding.fontRevision),
        node.fontBinding.pinned,
      ],
    ]);
    const previous = catalog ? undefined : this.measuredParagraphs.get(key(node.node));
    if (previous?.signature === signature) {
      this.measuredParagraphs.delete(key(node.node));
      --this.counters.liveParagraphs;
      return previous.paragraph;
    }
    const options = node.paragraph,
      align = {
        start: this.ck.TextAlign.Start,
        end: this.ck.TextAlign.End,
        left: this.ck.TextAlign.Left,
        right: this.ck.TextAlign.Right,
        center: this.ck.TextAlign.Center,
        justify: this.ck.TextAlign.Justify,
      }[options?.textAlign ?? 'start'],
      first = options?.applyHeightToFirstAscent !== false,
      last = options?.applyHeightToLastDescent !== false;
    if (options && !this.textCapabilities?.softHyphenSwitch)
      throw Error('Paragraph styles require the owned soft-hyphen runtime');
    const paragraphStyle: ParagraphStyle & { renderSoftHyphens: boolean } = {
      renderSoftHyphens: options?.hyphens === 'manual',
      ...(options
        ? { disableHinting: true, replaceTabCharacters: true, applyRoundingHack: false }
        : {}),
      textStyle: {
        fontFamilies: options?.fontFamily
          ? [options.fontFamily, ...fontFamilies]
          : [...fontFamilies],
        fontSize: node.fontSize,
        ...(options
          ? {
              fontStyle: {
                weight: (options.fontWeight ??
                  400) as unknown as import('canvaskit-wasm').FontWeight,
                slant: this.ck.FontSlant.Upright,
              },
              fontVariations: [{ axis: 'wght', value: options.fontWeight ?? 400 }],
            }
          : {}),
        color: this.color(node.color),
        locale: options?.locale ?? 'en',
        letterSpacing: options?.letterSpacing ?? 0,
        wordSpacing: options?.wordSpacing ?? 0,
        halfLeading: options?.halfLeading ?? false,
        ...(options?.height == null ? {} : { heightMultiplier: options.height }),
      },
      textAlign: align,
      ...(options?.strut
        ? {
            strutStyle: {
              strutEnabled: true,
              fontFamilies: [...options.strut.fontFamilies, ...fontFamilies],
              fontSize: options.strut.fontSize,
              fontStyle: {
                weight: options.strut.fontWeight as unknown as import('canvaskit-wasm').FontWeight,
                slant:
                  options.strut.fontStyle === 'italic'
                    ? this.ck.FontSlant.Italic
                    : this.ck.FontSlant.Upright,
              },
              ...(options.strut.height === null ? {} : { heightMultiplier: options.strut.height }),
              halfLeading: options.strut.halfLeading,
              leading: options.strut.leading,
              forceStrutHeight: options.strut.forceStrutHeight,
            },
          }
        : {}),
      ...(options?.maxLines ? { maxLines: options.maxLines } : {}),
      ...(options?.ellipsis ? { ellipsis: options.ellipsis } : {}),
      textHeightBehavior: first
        ? last
          ? this.ck.TextHeightBehavior.All
          : this.ck.TextHeightBehavior.DisableLastDescent
        : last
          ? this.ck.TextHeightBehavior.DisableFirstAscent
          : this.ck.TextHeightBehavior.DisableAll,
      textDirection:
        node.textDirection === 1 ? this.ck.TextDirection.RTL : this.ck.TextDirection.LTR,
    };
    // One collection per immutable font catalog preserves Skia's typeface and
    // shaping caches. MakeFromFontProvider constructs a new collection for every
    // paragraph and repeatedly clones variable faces across route transitions.
    const builder = this.ck.ParagraphBuilder.MakeFromFontCollection(
      new this.ck.ParagraphStyle(paragraphStyle),
      this.paragraphCollection(selectedCatalog?.provider ?? this.fontProvider),
    );
    let paragraph: Paragraph | undefined;
    try {
      validateParagraphRuns(text, options?.runs);
      validateParagraphPlaceholders(text, options?.placeholders);
      let placeholderIndex = 0;
      const append = (start: number, end: number) => {
        let cursor = start;
        while (
          placeholderIndex < (options?.placeholders?.length ?? 0) &&
          options!.placeholders![placeholderIndex]!.offset < end
        ) {
          const item = options!.placeholders![placeholderIndex++]!;
          if (item.offset < cursor) throw Error('Paragraph placeholder range is not contiguous');
          if (cursor < item.offset) builder.addText(text.slice(cursor, item.offset));
          builder.addPlaceholder(
            item.width,
            item.height,
            [
              this.ck.PlaceholderAlignment.Baseline,
              this.ck.PlaceholderAlignment.AboveBaseline,
              this.ck.PlaceholderAlignment.BelowBaseline,
              this.ck.PlaceholderAlignment.Top,
              this.ck.PlaceholderAlignment.Bottom,
              this.ck.PlaceholderAlignment.Middle,
            ][
              ['baseline', 'aboveBaseline', 'belowBaseline', 'top', 'bottom', 'middle'].indexOf(
                item.alignment,
              )
            ]!,
            item.baseline === 'ideographic'
              ? this.ck.TextBaseline.Ideographic
              : this.ck.TextBaseline.Alphabetic,
            item.baselineOffset,
          );
          cursor = item.offset + 1;
        }
        if (cursor < end) builder.addText(text.slice(cursor, end));
      };
      if (!options?.runs?.length) append(0, text.length);
      else
        for (const run of options.runs) {
          builder.pushStyle(
            new this.ck.TextStyle({
              fontFamilies: [...run.fontFamilies, ...fontFamilies],
              fontSize: run.fontSize,
              fontStyle: {
                weight: run.fontWeight as unknown as import('canvaskit-wasm').FontWeight,
                slant:
                  run.fontStyle === 'italic' ? this.ck.FontSlant.Italic : this.ck.FontSlant.Upright,
              },
              fontVariations: run.fontVariations?.some((value) => value.axis === 'wght')
                ? run.fontVariations.map((value) => ({ ...value }))
                : [{ axis: 'wght', value: run.fontWeight }, ...(run.fontVariations ?? [])],
              ...(run.fontFeatures
                ? { fontFeatures: run.fontFeatures.map((value) => ({ ...value })) }
                : {}),
              ...(run.shadows
                ? {
                    shadows: run.shadows.map((shadow) => ({
                      color: this.color(shadow.color),
                      offset: [shadow.offset.x, shadow.offset.y],
                      blurRadius: shadow.blurSigma,
                    })),
                  }
                : {}),
              color: this.color(run.color),
              ...(run.backgroundColor === undefined
                ? {}
                : { backgroundColor: this.color(run.backgroundColor) }),
              locale: run.locale,
              letterSpacing: run.letterSpacing,
              wordSpacing: run.wordSpacing,
              halfLeading: run.halfLeading,
              textBaseline:
                run.textBaseline === 'ideographic'
                  ? this.ck.TextBaseline.Ideographic
                  : this.ck.TextBaseline.Alphabetic,
              ...(run.height === null ? {} : { heightMultiplier: run.height }),
              decoration: run.decoration,
              decorationStyle: [
                this.ck.DecorationStyle.Solid,
                this.ck.DecorationStyle.Double,
                this.ck.DecorationStyle.Dotted,
                this.ck.DecorationStyle.Dashed,
                this.ck.DecorationStyle.Wavy,
              ][['solid', 'double', 'dotted', 'dashed', 'wavy'].indexOf(run.decorationStyle)]!,
              decorationThickness: run.decorationThickness,
              ...(run.decorationColor === undefined
                ? {}
                : { decorationColor: this.color(run.decorationColor) }),
            }),
          );
          try {
            append(run.start, run.end);
          } finally {
            builder.pop();
          }
        }
      if (placeholderIndex !== (options?.placeholders?.length ?? 0))
        throw Error('Paragraph placeholder was not consumed');
      paragraph = builder.build();
      paragraph.layout(width);
      ++this.counters.paragraphLayouts;
      if (resourceFont) this.paragraphFonts.set(paragraph, this.holdFontEntries([resourceFont]));
      return paragraph;
    } catch (error) {
      if (paragraph) this.deleteParagraph(paragraph);
      throw error;
    } finally {
      builder.delete();
    }
  }
  /** App-owner-only query instance; no surface, scene or render resource escapes. */
  appParagraph(input: AppTextInput, catalog?: AppFontCatalog): Paragraph {
    if (catalog && !this.appFonts.has(catalog)) throw Error('App font catalog is foreign/retired');
    let paragraph: Paragraph | undefined;
    try {
      return this.appTextGuard(
        0,
        () =>
          (paragraph = this.paragraph(
            {
              node: { slot: 0, generation: 0 },
              kind: p.kinds.paragraph,
              fontSize: input.fontSize,
              color: input.color,
              textDirection: input.textDirection,
              paragraph: input.paragraph,
            } as EngineNodeSnapshot,
            input.text,
            input.width,
            catalog,
          )),
      );
    } catch (error) {
      paragraph?.delete();
      throw error;
    }
  }
  appFontFamily(bytes: Uint8Array): string {
    if (this.closing) throw Error('App paragraph provider is closed');
    return this.guarded(3 * bytes.length + 65536, () => {
      const face = this.ck.Typeface.MakeTypefaceFromData(bytes.slice().buffer);
      if (!face) throw Error('Dynamic CanvasKit font decode failed');
      ++this.counters.dynamicFontLoads;
      try {
        return face.getFamilyName();
      } finally {
        face.delete();
      }
    });
  }
  makeAppFontCatalog(
    input: FontCatalog,
    identity = 'app:' + ++this.fontCatalogSequence,
  ): AppFontCatalog {
    if (this.closing) throw Error('App paragraph provider is closed');
    const owned: Typeface[] = [],
      faces: Typeface[] = [],
      identifiers: string[] = [],
      families: string[] = [],
      replaced = new Set(input.fonts.map((font) => font.family)),
      release =
        this.budget?.reserve(2, 8 * 1024 * 1024 + 65536 + input.fonts.length * 1024) ?? (() => {});
    let provider: TypefaceFontProvider | null = null;
    try {
      for (const font of input.fonts) {
        // The catalog already owns its immutable input. CanvasKit copies into
        // its separately admitted Wasm heap; only this one JS slice is staging.
        this.guarded(font.bytes.length + 65536, () => {
          const face = this.ck.Typeface.MakeTypefaceFromData(font.bytes.slice().buffer);
          if (!face) throw Error('Dynamic CanvasKit font decode failed');
          ++this.counters.dynamicFontLoads;
          owned.push(face);
          faces.push(face);
          identifiers.push(identity + '/' + (owned.length - 1));
          families.push(font.family);
        });
      }
      for (const [id, face] of this.typefaces) {
        const name = this.fontAliases.get(id)!;
        if (!replaced.has(name)) {
          faces.push(face);
          identifiers.push(id);
          families.push(name);
        }
      }
      this.guarded(65536 + faces.length * 1024, () => {
        provider = (this.ck as ParagraphRuntime).nelyxMakeFontProvider!(faces, families);
        if (!provider) throw Error('Dynamic CanvasKit font collection failed');
      });
      const collection = provider!;
      const catalog: AppFontCatalog = Object.freeze({
        provider: collection,
        fallback: Object.freeze([...input.fallback]),
        families: Object.freeze([...new Set(families)]),
        faces: Object.freeze(
          faces.map((face, index) => Object.freeze({ id: identifiers[index]!, face })),
        ),
        close: () => {
          if (!this.appFonts.delete(catalog)) return;
          this.releaseParagraphCollection(collection);
          collection.delete();
          for (const face of owned) face.delete();
          release();
        },
      });
      this.appFonts.add(catalog);
      return catalog;
    } catch (error) {
      (provider as TypefaceFontProvider | null)?.delete();
      for (const face of owned) face.delete();
      release();
      throw error;
    }
  }
  private holdFontEntries(entries: readonly ResourceFont[]): () => void {
    for (const entry of entries) ++entry.holds;
    let held = true;
    return () => {
      if (!held) return;
      held = false;
      for (const entry of entries) {
        if (!entry.holds) throw Error('Font resource ownership underflow');
        if (--entry.holds) continue;
        this.resourceFonts.delete(key(entry.resource));
        --this.counters.resourceFontCatalogs;
        this.counters.resourceFontBytes -= entry.bytes.length;
        try {
          entry.catalog.close();
        } finally {
          entry.release();
        }
      }
    };
  }
  private sceneFonts(scene: EngineResponse): ResourceFont[] {
    const result = new Map<string, ResourceFont>();
    for (const node of scene.nodes) {
      const resource = node.fontBinding?.resource;
      if (!resource || result.has(key(resource))) continue;
      const entry = this.resourceFonts.get(key(resource));
      if (!entry) throw Error('Content font resource has not been prepared on this owner');
      result.set(key(resource), entry);
    }
    return [...result.values()];
  }
  private installFontResource(
    resource: NodeHandle,
    size: number,
    load: () => Uint8Array,
  ): ResourceFont {
    if (
      this.closing ||
      !Number.isInteger(resource.slot) ||
      resource.slot <= 0 ||
      resource.slot > p.limits.resources ||
      !Number.isInteger(resource.generation) ||
      resource.generation <= 0 ||
      resource.generation > 0xffffffff ||
      !Number.isInteger(size) ||
      size < 32 ||
      size > p.limits.fontCatalogBytes ||
      this.resourceFonts.has(key(resource))
    )
      throw Error('Invalid font resource admission');
    const release = this.budget?.reserve(2, size + 256) ?? (() => {});
    let catalog: AppFontCatalog | undefined;
    try {
      const bytes = load();
      if (bytes.length !== size) throw Error('Font resource length changed');
      catalog = this.makeAppFontCatalog(readFontCatalog(bytes), 'resource:' + key(resource));
      const entry: ResourceFont = {
        resource: Object.freeze({ ...resource }),
        bytes,
        catalog,
        release,
        holds: 0,
      };
      this.resourceFonts.set(key(resource), entry);
      ++this.counters.resourceFontCatalogs;
      this.counters.resourceFontBytes += bytes.length;
      return entry;
    } catch (error) {
      catalog?.close();
      release();
      throw error;
    }
  }
  /** A bounded Core read scope; paragraphs, packets and tables acquire their own holds. */
  acquireFontResources(
    scene: EngineResponse,
    read: (
      resource: NodeHandle,
      offset: number,
      length: number,
      preparation: bigint,
    ) => FontResourceSlice,
  ): () => void {
    if (this.closing) throw Error('Font resource provider is closed');
    const resources = new Map<string, NodeHandle>();
    for (const node of scene.nodes) {
      const resource = node.fontBinding?.resource;
      if (resource) resources.set(key(resource), resource);
    }
    if (!resources.size) return () => {};
    const holds: (() => void)[] = [],
      release = () => {
        for (const hold of holds.splice(0)) hold();
      },
      staging = [...resources.keys()].some((id) => !this.resourceFonts.has(id))
        ? this.budget?.reserve(4, 4 * p.limits.fontChunkBytes + 65536)
        : undefined;
    try {
      for (const [id, resource] of resources) {
        let entry = this.resourceFonts.get(id);
        if (!entry) {
          const preparation = scene.measurePreparation || scene.preparation,
            first = read(resource, 0, 32, preparation);
          if (
            key(first.resource) !== id ||
            first.offset !== 0 ||
            first.bytes.length !== 32 ||
            first.total < 32 ||
            first.total > p.limits.fontCatalogBytes
          )
            throw Error('Invalid font resource header read');
          entry = this.installFontResource(resource, first.total, () => {
            const bytes = new Uint8Array(first.total);
            bytes.set(first.bytes);
            for (let offset = 32; offset < bytes.length;) {
              const length = Math.min(p.limits.fontChunkBytes, bytes.length - offset),
                part = read(resource, offset, length, preparation);
              if (
                key(part.resource) !== id ||
                part.offset !== offset ||
                part.total !== bytes.length ||
                part.bytes.length !== length
              )
                throw Error('Font resource chunk identity/length changed');
              bytes.set(part.bytes, offset);
              offset += length;
            }
            return bytes;
          });
        }
        holds.push(this.holdFontEntries([entry]));
      }
      ++this.fontScopes;
      let held = true;
      return () => {
        if (!held) return;
        held = false;
        --this.fontScopes;
        release();
      };
    } catch (error) {
      release();
      throw error;
    } finally {
      staging?.();
    }
  }
  private deleteParagraph(paragraph: Paragraph): void {
    try {
      paragraph.delete();
    } finally {
      this.paragraphFonts.get(paragraph)?.();
      this.paragraphFonts.delete(paragraph);
    }
  }
  acquireImageResources(
    scene: EngineResponse,
    read: (
      resource: NodeHandle,
      offset: number,
      length: number,
      preparation: bigint,
    ) => ImageResourceSlice,
  ) {
    if (this.closing) throw Error('Image resource provider is closed');
    return acquireImageResources(
      scene,
      read,
      (bytes) => this.budget?.reserve(2, bytes) ?? (() => {}),
    );
  }
  appTextGuard<T>(bytes: number, run: () => T): T {
    if (this.closing) throw Error('App paragraph provider is closed');
    return this.guarded(bytes, run);
  }
  discardMeasurements(): void {
    for (const value of this.measuredParagraphs.values()) this.deleteParagraph(value.paragraph);
    this.measuredParagraphs.clear();
    this.counters.liveParagraphs = 0;
  }
  measure(scene: EngineResponse): ProviderMeasurement {
    return this.guarded(
      Math.min(
        p.limits.resourceBytes,
        scene.blobs.reduce((n, b) => n + b.bytes.length * 2, 0) + 1024 * 1024,
      ),
      () => this.measureInner(scene),
    );
  }
  private measureInner(scene: EngineResponse): ProviderMeasurement {
    if (!scene.measureRequest || scene.nodes.length !== 1)
      throw new Error('Invalid measurement request');
    if (this.measurePreparation !== (scene.measurePreparation || scene.preparation)) {
      this.discardMeasurements();
      this.measurePreparation = scene.measurePreparation || scene.preparation;
    }
    const node = scene.nodes[0]!;
    ++this.counters.measurements;
    if (node.kind === p.kinds.image) {
      const data = scene.blobs.find((b) => b.type === 2 && key(b.handle) === key(node.resource));
      const image = data && providerImage(this.ck, data.bytes, node);
      if (!image) throw new Error('Intrinsic image decode failed');
      try {
        return {
          width: image.width(),
          height: image.height(),
          minimum: image.width(),
          maximum: image.width(),
          baseline: -1,
        };
      } finally {
        image.delete();
      }
    }
    if (node.kind !== p.kinds.paragraph && node.kind !== p.kinds.editable)
      throw new Error('Unsupported provider measurement');
    const text = decodeUtf8(scene.blobs.find((b) => b.type === 1)?.bytes ?? new Uint8Array());
    const paragraph = this.paragraph(node, text, node.flags & 32 ? Infinity : node.width);
    let retained = false;
    try {
      if (paragraph.unresolvedCodepoints().length)
        throw new Error('Declared provider fonts do not cover the paragraph');
      let width = node.width;
      if (node.flags & 32) {
        width = node.paragraph
          ? paragraph.getMaxIntrinsicWidth()
          : Math.ceil(paragraph.getMaxIntrinsicWidth());
        paragraph.layout(width);
        ++this.counters.paragraphLayouts;
      }
      const result = {
        ...(node.editing
          ? { geometry: editingGeometry(this.ck, paragraph, node.editing, node.fontSize) }
          : {}),
        width,
        height: paragraph.getHeight(),
        minimum: paragraph.getMinIntrinsicWidth(),
        maximum: paragraph.getMaxIntrinsicWidth(),
        baseline: paragraph.getAlphabeticBaseline(),
        ideographicBaseline: paragraph.getIdeographicBaseline(),
        ...(node.paragraph?.inlineChildren
          ? {
              placeholders: paragraph.getRectsForPlaceholders().map((box) => ({
                x: box.rect[0]!,
                y: box.rect[1]!,
                width: box.rect[2]! - box.rect[0]!,
                height: box.rect[3]! - box.rect[1]!,
                direction: (box.dir === this.ck.TextDirection.RTL ? 1 : 0) as 0 | 1,
              })),
            }
          : {}),
        didExceedMaxLines: paragraph.didExceedMaxLines(),
      };
      const previous = this.measuredParagraphs.get(key(node.node));
      if (previous) this.deleteParagraph(previous.paragraph);
      this.measuredParagraphs.set(key(node.node), {
        signature: JSON.stringify([
          text,
          node.fontSize,
          node.color,
          node.paintPlacement?.unbounded ? Infinity : width,
          node.textDirection ?? 0,
          node.paragraph,
          node.fontBinding && [
            node.fontBinding.resource,
            String(node.fontBinding.fontRevision),
            node.fontBinding.pinned,
          ],
        ]),
        paragraph,
      });
      this.counters.liveParagraphs = this.measuredParagraphs.size;
      retained = true;
      return result;
    } finally {
      if (!retained) this.deleteParagraph(paragraph);
    }
  }
  prepare(scene: EngineResponse, sharedOwner: boolean): PreparedPictures {
    for (const id of this.preparedRecords.keys())
      if (id !== scene.activePreparation) this.forgetPreparedRecords(id);
    // Retire optional records from departed nodes before allocating the next
    // route, while live tables keep their independent Picture/font references.
    const present = new Set(scene.nodes.map((node) => key(node.node)));
    for (const [id, record] of this.recorded)
      if (!present.has(id)) {
        if (record.picture) this.dropPicture(record.picture);
        record.release();
        this.recorded.delete(id);
        this.counters.cachedContentBytes -= record.bytes;
      }
    const fontEntries = this.sceneFonts(scene),
      holds: (() => void)[] = [this.holdFontEntries(fontEntries)];
    let transferred = 0;
    const release = () => {
      for (const hold of holds.splice(0)) hold();
    };
    const retain = (bytes: number) => {
      if (transferred + bytes > p.limits.resourceBytes)
        throw new Error('Prepared transport budget exceeded');
      const hold = this.budget?.reserve(4, bytes);
      if (hold) holds.push(hold);
      transferred += bytes;
    };
    try {
      const packet = this.guarded(
        // Provider allocations occupy the already reported CanvasKit heap;
        // transport copies have their own exact retain() accounts below. A
        // second full transport-limit reservation rejects valid DPR 2 scenes.
        1024 * 1024 +
          scene.nodes.length * 256 +
          scene.blobs.reduce((n, b) => n + b.bytes.length * 2, 0),
        () => this.prepareInner(scene, sharedOwner, retain, fontEntries),
      );
      if (!sharedOwner)
        this.rememberPreparedRecords(packet.preparation, this.recorded, fontEntries);
      this.releasePacket(packet.preparation);
      this.packetHolds.set(packet.preparation, release);
      return packet;
    } catch (error) {
      release();
      throw error;
    }
  }
  private prepareInner(
    scene: EngineResponse,
    sharedOwner: boolean,
    retain: (bytes: number) => void,
    fontEntries: readonly ResourceFont[],
  ): PreparedPictures {
    if (this.measurePreparation !== scene.preparation) this.discardMeasurements();
    const resources = new Map(
      scene.blobs.filter((b) => b.type === 2).map((b) => [key(b.handle), b.bytes]),
    );
    const texts = new Map(
      scene.blobs.filter((b) => b.type === 1).map((b) => [key(b.handle), decodeUtf8(b.bytes)]),
    );
    const packet: PreparedPictures = {
      preparation: scene.preparation,
      document: scene.preparationDocument,
      metrics: scene.metrics,
      device: scene.device,
      pictures: [],
      texts: [],
      paths: [],
    };
    const base = !sharedOwner ? this.preparedRecords.get(scene.activePreparation) : undefined;
    if (base) packet.basePreparation = scene.activePreparation;
    const local = new Map<string, Picture>();
    const paths = new Map<string, Path>();
    const nextRecorded = new Map<string, ContentRecord>();
    let nextCachedBytes = 0;
    let bytes = 0;
    let referenceBytes = 0;
    try {
      if (!sharedOwner && fontEntries.length) {
        packet.fontCatalogs = [];
        packet.fontReferences = [];
        for (const entry of fontEntries) {
          if (base?.fonts.has(key(entry.resource))) {
            retain(16);
            packet.fontReferences.push(entry.resource);
            ++this.counters.referencedFontCatalogs;
          } else {
            retain(entry.bytes.length + 32);
            packet.fontCatalogs.push({
              resource: entry.resource,
              bytes: entry.bytes.slice().buffer,
            });
            this.counters.fontCatalogCopyBytes += entry.bytes.length;
          }
        }
      }
      for (const node of scene.nodes) {
        let paintKey = '';
        if (node.flags & p.nodeFlags.livePaint) {
          // Render executes this paint from the current frame. Its changing
          // values cannot invalidate the separately recorded base Picture.
          if (node.nativePaint?.length) ++this.counters.livePaintKeysSkipped;
        } else if (node.nativePaint) {
          paintKey = JSON.stringify(node.nativePaint);
        }
        const id = key(node.node),
          text = texts.get(id) ?? '',
          resource = node.resource ? resources.get(key(node.resource)) : undefined,
          previous = this.recorded.get(id),
          signature =
            JSON.stringify([
              sharedOwner,
              String(scene.metrics),
              String(scene.device),
              String(node.fontBinding?.fontRevision ?? scene.fontRevision),
              node.kind,
              node.width,
              node.height,
              node.color,
              node.radius,
              node.fontSize,
              node.paragraph,
              node.fontBinding && [
                node.fontBinding.resource,
                String(node.fontBinding.fontRevision),
                node.fontBinding.pinned,
              ],
              node.paintPlacement?.unbounded ?? false,
              node.textDirection,
              node.content,
              node.graphics,
              node.imagePaint,
              node.editing?.flags ?? 0,
              text,
              node.flags & p.nodeFlags.livePaint,
            ]) +
            '\n' +
            paintKey;
        if (node.graphics?.hasPath) {
          const segments = node.graphics.path ?? [],
            fillRule = node.graphics.fillRule ?? 'winding',
            physical = node.nativePaint?.find((entry) => entry.kind === 'physical'),
            roundedRect = physical ? Array.from(nativePaintShape(this.ck, physical)) : undefined;
          retain(128 + segments.length * 64 + (physical ? 256 : 0));
          paths.set(
            key(node.node),
            roundedRect
              ? makeRoundedRectPath(this.ck, roundedRect, physical!.transform)
              : makePath(this.ck, segments, fillRule),
          );
          packet.paths.push({
            node: key(node.node),
            segments,
            fillRule,
            ...(roundedRect ? { roundedRect, transform: physical!.transform } : {}),
          });
        }

        if (previous?.signature === signature && sameBytes(previous.resource, resource)) {
          if (sharedOwner) {
            if (!previous.picture) throw new Error('Local cached Picture missing');
            this.holdPicture(previous.picture);
            local.set(id, previous.picture);
          } else if (base?.tokens.get(id) === previous.token) {
            // These small entries are covered by prepare's per-node scratch
            // reservation while staged. Adopt their exact transport credit
            // together, rather than dispatching one memory report per node.
            referenceBytes += 16 + id.length * 2;
            (packet.reused ??= []).push(id);
            ++this.counters.referencedPictures;
            this.counters.avoidedPictureCopyBytes +=
              previous.encoded?.byteLength ?? textBytes(previous.text);
          } else if (previous.encoded) {
            const size = previous.encoded.byteLength + pictureFontBytes(previous.fonts);
            retain(size);
            bytes += size;
            packet.pictures.push({
              node: id,
              bytes: previous.encoded.slice().buffer,
              ...(previous.fonts ? { fonts: previous.fonts } : {}),
            });
          } else if (previous.text) {
            const size = textBytes(previous.text);
            retain(size);
            bytes += size;
            this.counters.glyphBytes += size;
            packet.texts.push(copyText(previous.text));
          } else throw new Error('Transport cached record missing');
          if (previous.bytes <= 16 * 1024 * 1024 - nextCachedBytes) {
            nextRecorded.set(id, previous);
            nextCachedBytes += previous.bytes;
          }
          ++this.counters.reusedPictures;
          if (node.kind === p.kinds.paragraph || node.kind === p.kinds.editable)
            ++this.counters.reusedParagraphs;
          if (node.kind === p.kinds.image) ++this.counters.reusedImages;
          continue;
        }
        if (node.graphics) ++this.counters.graphicsRecords;
        if (node.flags & p.nodeFlags.nativeExtension) ++this.counters.nativeExtensions;

        const content = node.content ?? { x: 0, y: 0, width: node.width, height: node.height };
        const referencedParagraph = !!(
          node.fontBinding?.resource ||
          node.paragraph?.runs?.length ||
          node.paragraph?.strut ||
          node.paragraph?.placeholders?.length
        );
        const nativeOutset =
          Math.max(
            paragraphPaintOutset(
              node.paragraph?.runs,
              node.fontSize,
              !!node.paragraph?.strut?.forceStrutHeight ||
                (node.paragraph?.height != null && node.paragraph.height < 1),
            ),
            (node.nativePaint ?? []).reduce(
              (maximum, entry) =>
                Math.max(
                  maximum,
                  nativePaintOutset(entry, node.width, node.height, scene.viewport?.scale ?? 1),
                ),
              0,
            ),
          ) +
          (node.graphics?.blur ?? 0) * 4;
        const imageBounds = node.imagePaint?.bounds ?? [0, 0, 0, 0];
        const recording = {
          x:
            Math.min(0, content.x, imageBounds[0]!) -
            Math.abs(node.graphics?.shadow?.x ?? 0) -
            (node.graphics?.shadow?.sigma ?? 0) * 4 -
            nativeOutset -
            2,
          y:
            Math.min(0, content.y, imageBounds[1]!) -
            Math.abs(node.graphics?.shadow?.y ?? 0) -
            (node.graphics?.shadow?.sigma ?? 0) * 4 -
            nativeOutset -
            2,
          width:
            Math.max(1, node.width, content.x + content.width, imageBounds[0]! + imageBounds[2]!) -
            Math.min(0, content.x, imageBounds[0]!) +
            Math.abs(node.graphics?.shadow?.x ?? 0) * 2 +
            (node.graphics?.shadow?.sigma ?? 0) * 8 +
            nativeOutset * 2 +
            4,
          height:
            Math.max(
              1,
              node.height,
              content.y + content.height,
              imageBounds[1]! + imageBounds[3]!,
            ) -
            Math.min(0, content.y, imageBounds[1]!) +
            Math.abs(node.graphics?.shadow?.y ?? 0) * 2 +
            (node.graphics?.shadow?.sigma ?? 0) * 8 +
            nativeOutset * 2 +
            4,
        };
        const nativePathBytes = (node.nativePaint ?? []).reduce(
          (bytes, entry) => bytes + (entry.path?.commands.length ?? 0) * 256,
          0,
        );
        if (nativePathBytes) retain(nativePathBytes);
        const recorder = new this.ck.PictureRecorder();
        const paint = new this.ck.Paint();
        paint.setAntiAlias(true);
        let picture: Picture | null = null;
        const pictureStart = packet.pictures.length,
          textStart = packet.texts.length;
        try {
          const canvas = recorder.beginRecording(
            this.ck.XYWHRect(recording.x, recording.y, recording.width, recording.height),
          );
          if (node.kind === p.kinds.paragraph || node.kind === p.kinds.editable) {
            let paragraph;
            try {
              const text = texts.get(key(node.node)) ?? '';
              paragraph = this.paragraph(node, text, content.width);
              if (paragraph.unresolvedCodepoints().length)
                throw new Error('Declared provider fonts do not cover the paragraph');
              // Exercise public UTF-16 line indexing and retained paragraph painting.
              if (text.length)
                lineNumberAtUTF16(paragraph, text, 0, this.textCapabilities.lineIndexUnit);
              canvas.drawParagraph(paragraph, content.x, content.y);
              ++this.counters.paragraphs;
              if (!sharedOwner && !referencedParagraph) {
                const record = {
                  node: key(node.node),
                  width: node.width,
                  height: node.height,
                  color: node.color,
                  bounds: recording,
                  runs: [] as PreparedPictures['texts'][number]['runs'],
                };
                for (const line of paragraph.getShapedLines())
                  for (const run of line.runs) {
                    try {
                      const font = run.typeface && this.families.get(run.typeface.getFamilyName());
                      if (!font)
                        throw new Error(
                          'Prepared glyph font is outside the declared provider font set',
                        );
                      let probe: string | undefined;
                      if (node.paragraph) {
                        probe = this.regularProbes.get(font);
                        if (!probe) {
                          // A generated discretionary hyphen can use a fallback
                          // face that none of the original source scalars use.
                          probe = Array.from(text + node.paragraph.ellipsis + '\u2010-').find(
                            (character) =>
                              !/[\p{C}\p{Z}]/u.test(character) &&
                              !!run.typeface.getGlyphIDs(character)[0],
                          );
                          if (!probe)
                            throw Error('Prepared varied glyph font has no source character');
                          this.regularProbes.set(font, probe);
                        }
                      }
                      retain(
                        run.glyphs.byteLength + run.positions.byteLength + (probe?.length ?? 0) * 2,
                      );
                      const glyphs = new Uint16Array(run.glyphs),
                        positions = new Float32Array(run.positions);
                      for (let i = 0; i < positions.length; i += 2) {
                        positions[i]! += content.x;
                        positions[i + 1]! += content.y;
                      }
                      bytes += glyphs.byteLength + positions.byteLength;
                      if (glyphs.length > p.limits.textBytes || bytes > p.limits.resourceBytes)
                        throw new Error('Prepared glyph transfer budget exceeded');
                      this.counters.glyphBytes += glyphs.byteLength + positions.byteLength;
                      record.runs.push({
                        font,
                        size: run.size,
                        glyphs,
                        positions,
                        bold: !!run.fakeBold,
                        italic: !!run.fakeItalic,
                        ...(probe ? { weight: node.paragraph?.fontWeight ?? 400, probe } : {}),
                      });
                    } finally {
                      run.typeface?.delete();
                    }
                  }
                packet.texts.push(record);
              }
            } finally {
              if (paragraph) this.deleteParagraph(paragraph);
            }
          } else if (node.kind === p.kinds.image) {
            if (!node.imagePaint || node.imagePaint.tiles.length) {
              const data = resources.get(key(node.resource));
              if (!data) throw new Error('Image resource missing');
              const image = providerImage(this.ck, data, node);
              if (!image) throw new Error('Image decode failed');
              try {
                paintImage(this.ck, canvas, image, node, paint);
                ++this.counters.images;
              } finally {
                image.delete();
              }
            }
          } else {
            paintShape(this.ck, canvas, node, paths.get(key(node.node)), paint);
            if (!(node.flags & p.nodeFlags.livePaint))
              paintNative(this.ck, canvas, node, paint, scene.viewport?.scale ?? 1);
          }
          picture = recorder.finishRecordingAsPicture();
          ++this.counters.pictures;
          if (sharedOwner) {
            this.holdPicture(picture);
            local.set(key(node.node), picture);
            picture = null;
          } else if (
            referencedParagraph ||
            (node.kind !== p.kinds.paragraph && node.kind !== p.kinds.editable)
          ) {
            const origins = referencedParagraph
                ? node.fontBinding?.resource
                  ? this.resourceFonts.get(key(node.fontBinding.resource))!.catalog.faces
                  : [...this.typefaces].map(([id, face]) => ({ id, face }))
                : [],
              referenced = referencedParagraph
                ? (this.ck as ParagraphRuntime).nelyxSerializePicture!(
                    picture,
                    origins.map((origin) => origin.face),
                    origins.map((origin) => origin.id),
                  )
                : undefined;
            if (referenced === null) throw Error('Font-reference Picture serialization failed');
            const fonts = referenced?.fonts.map((face) => {
              const font = origins[face.source]?.id;
              if (!Number.isInteger(face.source) || !font)
                throw Error('Prepared Picture font is outside the declared provider font set');
              return { font, coordinates: face.coordinates };
            });
            const encoded = referenced?.bytes ?? picture.serialize();
            if (!encoded) throw new Error('Picture serialization failed');
            retain(encoded.byteLength + pictureFontBytes(fonts));
            const copy = encoded.slice();
            bytes += copy.length + pictureFontBytes(fonts);
            if (bytes > p.limits.resourceBytes)
              throw new Error('Prepared Picture transfer budget exceeded');
            packet.pictures.push({
              node: key(node.node),
              bytes: copy.buffer,
              ...(fonts ? { fonts } : {}),
            });
            if (referenced) {
              ++this.counters.fontReferencePictures;
              this.counters.fontReferenceBytes += encoded.length + pictureFontBytes(fonts);
            }
          }
          const encoded = packet.pictures[pictureStart]?.bytes,
            shaped = packet.texts[textStart],
            entryBytes =
              256 +
              nativePathBytes +
              signature.length * 2 +
              (resource?.byteLength ?? 0) +
              (encoded?.byteLength ?? 0) +
              pictureFontBytes(packet.pictures[pictureStart]?.fonts) +
              textBytes(shaped) +
              (sharedOwner && text ? 65536 + text.length * 256 : 0);
          if (!this.memoryPressure && entryBytes <= 16 * 1024 * 1024 - nextCachedBytes) {
            const budgetRelease = this.budget?.reserve(2, entryBytes) ?? (() => {}),
              fontRelease = this.holdFontEntries(
                node.fontBinding?.resource
                  ? [this.resourceFonts.get(key(node.fontBinding.resource))!]
                  : [],
              ),
              release = () => {
                try {
                  fontRelease();
                } finally {
                  budgetRelease();
                }
              };
            let kept = false;
            try {
              const record: ContentRecord = {
                token: ++this.nextRecordToken,
                signature,
                resource,
                picture: sharedOwner ? local.get(id) : undefined,
                encoded: encoded ? new Uint8Array(encoded).slice() : undefined,
                ...(packet.pictures[pictureStart]?.fonts
                  ? { fonts: packet.pictures[pictureStart]!.fonts! }
                  : {}),
                text: shaped ? copyText(shaped) : undefined,
                bytes: entryBytes,
                release,
              };
              if (!Number.isSafeInteger(record.token))
                throw Error('Prepared record identity exhausted');
              if (record.picture) this.holdPicture(record.picture);
              nextRecorded.set(id, record);
              nextCachedBytes += entryBytes;
              kept = true;
            } finally {
              if (!kept) release();
            }
          }
        } finally {
          picture?.delete();
          paint.delete();
          recorder.delete();
        }
      }
      if (referenceBytes) retain(referenceBytes);
      this.counters.serializedBytes += bytes;
      this.counters.sourceBytes = [...resources.values()].reduce(
        (sum, data) => sum + data.length,
        0,
      );
      if (sharedOwner) {
        if (this.tables.has(packet.preparation))
          throw new Error('Prepared resource identity reused');
        packet.local = local;
        this.tables.set(packet.preparation, local);
        this.pathTables.set(packet.preparation, paths);
        this.tableFonts.set(packet.preparation, this.holdFontEntries(fontEntries));
      }
      if (!sharedOwner) for (const path of paths.values()) path.delete();
      for (const [id, record] of this.recorded)
        if (nextRecorded.get(id) !== record) {
          if (record.picture) this.dropPicture(record.picture);
          record.release();
        }
      this.recorded = nextRecorded;
      this.counters.cachedContentBytes = nextCachedBytes;
      return packet;
    } catch (error) {
      for (const path of paths.values()) path.delete();
      for (const picture of local.values()) this.dropPicture(picture);
      for (const [id, record] of nextRecorded)
        if (this.recorded.get(id) !== record) {
          if (record.picture) this.dropPicture(record.picture);
          record.release();
        }
      throw error;
    } finally {
      this.discardMeasurements();
    }
  }
  import(packet: PreparedPictures): void {
    const temporaryBytes =
      1024 * 1024 +
      (packet.pictures.length + packet.texts.length) * 256 +
      packet.texts.reduce(
        (sum, text) => sum + text.runs.reduce((n, run) => n + run.glyphs.length * 16, 0),
        0,
      ) +
      (packet.paths ?? []).reduce((sum, path) => sum + path.segments.length * 64, 0);
    // The incoming bytes retain their transport lease until prepared-released;
    // native Picture storage is already part of the committed provider heap.
    this.guarded(temporaryBytes, () => this.importInner(packet));
  }
  private importInner(packet: PreparedPictures): void {
    if (this.tables.has(packet.preparation)) return;
    const table = new Map<string, Picture>();
    const paths = new Map<string, Path>();
    const fontEntries: ResourceFont[] = [],
      fontHolds: (() => void)[] = [],
      fontIds = new Set<string>(),
      fontFaces = new Map(this.typefaces);
    let bytes = 0;
    try {
      if (
        packet.pictures.length + packet.texts.length + (packet.reused?.length ?? 0) >
        p.limits.nodes
      )
        throw new Error('Prepared node budget exceeded');
      if ((packet.fontCatalogs?.length ?? 0) > p.limits.resources)
        throw Error('Prepared font catalog count exceeded');
      for (const item of packet.fontCatalogs ?? []) {
        if (!(item.bytes instanceof ArrayBuffer)) throw Error('Invalid prepared font catalog');
        bytes += item.bytes.byteLength + 32;
        const id = key(item.resource);
        if (fontIds.has(id) || bytes > p.limits.resourceBytes)
          throw Error('Duplicate/oversize prepared font catalog');
        fontIds.add(id);
        const input = new Uint8Array(item.bytes);
        let entry = this.resourceFonts.get(id);
        if (entry) {
          if (!sameBytes(entry.bytes, input))
            throw Error('Prepared font resource identity changed');
        } else entry = this.installFontResource(item.resource, input.length, () => input.slice());
        fontHolds.push(this.holdFontEntries([entry]));
        fontEntries.push(entry);
        for (const origin of entry.catalog.faces) fontFaces.set(origin.id, origin.face);
      }
      const base = packet.basePreparation ? this.tables.get(packet.basePreparation) : undefined;
      const baseRecords = packet.basePreparation
        ? this.preparedRecords.get(packet.basePreparation)
        : undefined;
      if ((packet.reused?.length || packet.fontReferences?.length) && (!base || !baseRecords))
        throw Error('Prepared reference base is unavailable');
      if ((packet.fontReferences?.length ?? 0) + fontIds.size > p.limits.resources)
        throw Error('Prepared font reference budget exceeded');
      for (const resource of packet.fontReferences ?? []) {
        const id = key(resource),
          entry = this.resourceFonts.get(id);
        if (fontIds.has(id) || !baseRecords!.fonts.has(id) || !entry)
          throw Error('Invalid/duplicate prepared font reference');
        fontIds.add(id);
        fontHolds.push(this.holdFontEntries([entry]));
        fontEntries.push(entry);
        for (const origin of entry.catalog.faces) fontFaces.set(origin.id, origin.face);
      }
      for (const id of packet.reused ?? []) {
        const picture = base!.get(id);
        if (!picture || table.has(id)) throw Error('Invalid/duplicate prepared Picture reference');
        this.holdPicture(picture);
        table.set(id, picture);
        ++this.counters.referencedImports;
      }
      for (const path of packet.paths ?? []) {
        if (paths.has(path.node)) throw new Error('Duplicate prepared clip path');
        paths.set(
          path.node,
          path.roundedRect
            ? makeRoundedRectPath(this.ck, path.roundedRect, path.transform)
            : makePath(this.ck, path.segments, path.fillRule),
        );
      }
      for (const item of packet.pictures) {
        bytes += item.bytes.byteLength + pictureFontBytes(item.fonts);
        if (table.has(item.node) || bytes > p.limits.resourceBytes)
          throw new Error('Duplicate/oversize prepared Picture');
        if (
          item.fonts &&
          (item.fonts.length > 1024 ||
            item.fonts.some(
              (font) =>
                typeof font.font !== 'string' ||
                !font.font.length ||
                font.font.length > 128 ||
                font.coordinates.length > 32 ||
                font.coordinates.some(
                  (coordinate) =>
                    !Number.isInteger(coordinate.axis) ||
                    coordinate.axis < 0 ||
                    coordinate.axis > 0xffffffff ||
                    !Number.isFinite(coordinate.value) ||
                    Math.abs(coordinate.value) > 1e6,
                ) ||
                new Set(font.coordinates.map((coordinate) => coordinate.axis)).size !==
                  font.coordinates.length,
            ))
        )
          throw Error('Invalid prepared Picture font descriptors');
        const bases = item.fonts?.map((font) => {
          const base = fontFaces.get(font.font);
          if (!base) throw Error('Prepared Picture font identity is not installed');
          return base;
        });
        const picture = item.fonts
          ? (this.ck as ParagraphRuntime).nelyxMakePicture!(
              new Uint8Array(item.bytes),
              bases!,
              item.fonts.map((font) => font.coordinates),
              item.fonts.map((font) => font.font),
              (this.pictureFonts ??= new (this.ck as ParagraphRuntime).NelyxPictureFontCache!()),
            )
          : this.ck.MakePicture(item.bytes);
        if (!picture) throw new Error('Prepared Picture decode failed');
        if (item.fonts) {
          ++this.counters.fontReferenceImports;
          this.counters.livePictureFontVariations = this.pictureFonts!.size();
          this.counters.pictureFontCacheHits = this.pictureFonts!.hits();
          this.counters.pictureFontCacheMisses = this.pictureFonts!.misses();
        }
        this.holdPicture(picture);
        table.set(item.node, picture);
        ++this.counters.imports;
      }
      for (const item of packet.texts) {
        if (table.has(item.node)) throw new Error('Duplicate prepared text');
        const recorder = new this.ck.PictureRecorder(),
          paint = new this.ck.Paint();
        paint.setColor(this.color(item.color));
        paint.setAntiAlias(true);
        try {
          const bounds = item.bounds ?? {
            x: 0,
            y: 0,
            width: Math.max(1, item.width),
            height: Math.max(1, item.height),
          };
          if (
            Object.values(bounds).some(
              (value) => !Number.isFinite(value) || Math.abs(value) > 3e12,
            ) ||
            bounds.width <= 0 ||
            bounds.height <= 0
          )
            throw Error('Invalid prepared text bounds');
          const canvas = recorder.beginRecording(
            this.ck.XYWHRect(bounds.x, bounds.y, bounds.width, bounds.height),
          );
          for (const run of item.runs) {
            bytes += run.glyphs.byteLength + run.positions.byteLength;
            if (bytes > p.limits.resourceBytes)
              throw new Error('Prepared glyph import budget exceeded');
            if (run.positions.length !== 2 * (run.glyphs.length + 1) || run.glyphs.length > 65536)
              throw new Error('Prepared glyph position budget/length');
            if (
              (run.weight !== undefined &&
                (!Number.isInteger(run.weight) || run.weight < 100 || run.weight > 900)) ||
              (run.weight === undefined) !== (run.probe === undefined)
            )
              throw Error('Invalid prepared font variation');
            const face =
              run.weight !== undefined
                ? this.regularTypeface(run.font, run.probe!, run.weight)
                : this.typefaces.get(run.font);
            if (!face) throw new Error('Prepared glyph font identity is not installed');
            const font = new this.ck.Font(face, run.size);
            font.setSubpixel(true);
            // ParagraphStyle.disableHinting controls layout rounding. The
            // paragraph's TextStyle still paints with its default Slight hinting.
            font.setHinting(this.ck.FontHinting.Slight);
            font.setEmbolden(run.bold);
            if (run.italic) font.setSkewX(-0.25);
            const transforms = new Float32Array(run.glyphs.length * 4);
            for (let i = 0; i < run.glyphs.length; ++i) {
              const x = run.positions[i * 2]!,
                y = run.positions[i * 2 + 1]!;
              if (
                !Number.isFinite(x) ||
                !Number.isFinite(y) ||
                Math.abs(x) > 1e12 ||
                Math.abs(y) > 1e12
              )
                throw new Error('Invalid prepared glyph position');
              transforms.set([1, 0, x, y], i * 4);
            }
            const blob = this.ck.TextBlob.MakeFromRSXformGlyphs(run.glyphs, transforms, font);
            try {
              canvas.drawTextBlob(blob, 0, 0, paint);
            } finally {
              blob.delete();
              font.delete();
            }
          }
          const picture = recorder.finishRecordingAsPicture();
          this.holdPicture(picture);
          table.set(item.node, picture);
          ++this.counters.imports;
        } finally {
          paint.delete();
          recorder.delete();
        }
      }
      this.rememberPreparedRecords(packet.preparation, new Map(), fontEntries);
      this.tables.set(packet.preparation, table);
      this.pathTables.set(packet.preparation, paths);
      this.tableFonts.set(packet.preparation, this.holdFontEntries(fontEntries));
    } catch (error) {
      this.forgetPreparedRecords(packet.preparation);
      for (const picture of table.values()) this.dropPicture(picture);
      for (const path of paths.values()) path.delete();
      throw error;
    } finally {
      for (const release of fontHolds) release();
    }
  }
  draw(frame: EngineResponse, width: number, height: number, scale: number): void {
    const layerBytes = frame.nodes.reduce(
      (total, n) =>
        total +
        (n.opacity <= 0 || n.matrix[0] * n.matrix[3] - n.matrix[1] * n.matrix[2] === 0
          ? 0
          : (n.localOpacity < 1 || (n.graphics?.blur ?? 0) > 0
              ? Math.ceil(width * scale) *
                Math.ceil(height * scale) *
                4 *
                ((n.graphics?.blur ?? 0) > 0 ? 3 : 1)
              : 0) +
            (n.flags & p.nodeFlags.clipSaveLayer
              ? Math.ceil(width * scale) * Math.ceil(height * scale) * 4
              : 0) +
            (nativeLinearMask(n) ? Math.ceil(width * scale) * Math.ceil(height * scale) * 4 : 0) +
            ((n.snapshot?.live?.opacity ?? 1) < 1
              ? Math.ceil(width * scale) * Math.ceil(height * scale) * 4
              : 0)),
      0,
    );
    const pathBytes = frame.nodes.reduce(
      (total, node) =>
        total +
        (node.flags & p.nodeFlags.livePaint
          ? (node.nativePaint ?? []).reduce(
              (sum, entry) => sum + (entry.path?.commands.length ?? 0) * 256,
              0,
            ) + 1024
          : 0),
      0,
    );
    const release = this.budget?.reserve(3, layerBytes);
    try {
      const releasePaths = this.budget?.reserve(2, pathBytes);
      try {
        this.guarded(1024 * 1024 + pathBytes, () => this.drawInner(frame, width, height, scale));
      } finally {
        releasePaths?.();
      }
    } finally {
      release?.();
    }
  }
  private drawInner(frame: EngineResponse, width: number, height: number, scale: number): void {
    this.resize(width, height, scale);
    if (!this.surface) return;
    if (this.canvas?.getContext('webgl2')?.isContextLost())
      throw new Error('Worker WebGL2 context lost; create a new session');
    const table = this.tables.get(frame.activePreparation);
    if (!table) throw new Error('Active scene has no prepared provider resources');
    if (!this.snapshotAccess) throw Error('Snapshot Core connection is unavailable');
    this.pruneSnapshots(this.snapshotAccess(frame.submission, 0)!);
    const target = this.surface.getCanvas();
    target.clear(this.ck.Color(244, 246, 250, 1));
    target.save();
    target.scale(scale, scale);
    const nodes = new Map(frame.nodes.map((node) => [key(node.node), node]));
    const ends = frame.nodes.map(() => frame.nodes.length),
      indices: number[] = [];
    for (let i = 0; i < frame.nodes.length; ++i) {
      while (indices.length && frame.nodes[indices.at(-1)!]!.depth >= frame.nodes[i]!.depth)
        ends[indices.pop()!] = i;
      indices.push(i);
    }
    const drawRange = (
      target: ReturnType<Surface['getCanvas']>,
      begin: number,
      end: number,
      baseMatrix: EngineNodeSnapshot['matrix'],
      scale: number,
      sceneClip = true,
    ): void => {
      const baseDepth = begin < end ? frame.nodes[begin]!.depth : 0;
      const saves: {
        count: number;
        matrix: EngineNodeSnapshot['matrix'];
        culled: boolean;
        item: EngineNodeSnapshot;
      }[] = [];
      const finish = (draw: boolean) => {
        const { count, item, culled } = saves.pop()!;
        try {
          if (draw && !culled) {
            this.drawPaint(target, table, nodes, item, scale, true);
            const mask = nativeLinearMask(item);
            if (mask) paintNativeMask(this.ck, target, mask);
          }
        } finally {
          for (let i = 0; i < count; ++i) target.restore();
        }
      };
      try {
        for (let index = begin; index < end; ++index) {
          const item = frame.nodes[index]!;
          while (saves.length > item.depth - baseDepth) {
            finish(true);
          }
          if (item.flags & p.nodeFlags.paintResource) {
            index = ends[index]! - 1;
            continue;
          }
          // Core's empty paint clip excludes the descendants too. Physical
          // shadows precede the node's own clip and can still reach the parent
          // viewport. Snapshot recording also needs content outside that live
          // viewport, using its own bounds for a later move/replay.
          if (
            sceneClip &&
            (item.clip.width <= 0 || item.clip.height <= 0) &&
            !item.nativePaint?.some(
              (entry) =>
                entry.kind === 'physical' && entry.elevation! > 0 && entry.shadowColor! >>> 24,
            )
          ) {
            this.counters.clipCulledNodes += ends[index]! - index;
            index = ends[index]! - 1;
            continue;
          }
          const parent = saves.at(-1),
            relative = relativeMatrix(parent?.matrix ?? baseMatrix, item.matrix);
          const culled =
            !!parent?.culled ||
            item.opacity <= 0 ||
            !relative ||
            item.matrix[0] * item.matrix[3] - item.matrix[1] * item.matrix[2] === 0;
          target.save();
          let count = 1;
          if (culled)
            target.clipRect(this.ck.XYWHRect(0, 0, 0, 0), this.ck.ClipOp.Intersect, false);
          else target.concat(canvasMatrix(relative!));
          paintNativeShadow(
            this.ck,
            target,
            item,
            this.pathTables.get(frame.activePreparation)?.get(key(item.node)),
            scale,
          );
          if (
            (item.kind === p.kinds.clip && item.clipStyle?.behavior !== 'none') ||
            item.kind === p.kinds.scrollViewport ||
            item.flags & p.nodeFlags.clipsChildren
          ) {
            const path = this.pathTables.get(frame.activePreparation)?.get(key(item.node)),
              style = item.clipStyle,
              antiAlias = !(item.flags & p.nodeFlags.hardEdgeClip),
              rect = this.ck.XYWHRect(0, 0, item.width, item.height);
            if (item.nativePaint?.some((entry) => entry.kind === 'physical') && path) {
              target.clipPath(path, this.ck.ClipOp.Intersect, antiAlias);
            } else if (item.flags & p.nodeFlags.rectangularClip || (!style && !antiAlias)) {
              target.clipRect(rect, this.ck.ClipOp.Intersect, false);
            } else if (style) {
              if (style.shape === 'rect')
                target.clipRect(rect, this.ck.ClipOp.Intersect, antiAlias);
              else
                target.clipRRect(
                  style.shape === 'circle'
                    ? this.ck.RRectXY(
                        this.ck.XYWHRect(
                          (item.width - Math.min(item.width, item.height)) / 2,
                          (item.height - Math.min(item.width, item.height)) / 2,
                          Math.min(item.width, item.height),
                          Math.min(item.width, item.height),
                        ),
                        Math.min(item.width, item.height) / 2,
                        Math.min(item.width, item.height) / 2,
                      )
                    : style.shape === 'stadium'
                      ? this.ck.RRectXY(
                          rect,
                          Math.min(item.width, item.height) / 2,
                          Math.min(item.width, item.height) / 2,
                        )
                      : style.shape === 'oval'
                        ? this.ck.RRectXY(rect, item.width / 2, item.height / 2)
                        : Float32Array.from([0, 0, item.width, item.height, ...style.radii]),
                  this.ck.ClipOp.Intersect,
                  antiAlias,
                );
            } else if (path) {
              target.clipRect(
                this.ck.XYWHRect(0, 0, item.width, item.height),
                this.ck.ClipOp.Intersect,
                antiAlias,
              );
              target.clipPath(path, this.ck.ClipOp.Intersect, antiAlias);
            } else
              target.clipRRect(
                this.ck.RRectXY(
                  this.ck.XYWHRect(0, 0, item.width, item.height),
                  item.radius,
                  item.radius,
                ),
                this.ck.ClipOp.Intersect,
                antiAlias,
              );
            if (item.flags & p.nodeFlags.clipSaveLayer) {
              const paint = new this.ck.Paint();
              try {
                target.saveLayer(paint, rect);
                ++count;
              } finally {
                paint.delete();
              }
            }
          }
          if (item.localOpacity < 1 || (item.graphics?.blur ?? 0) > 0) {
            const paint = new this.ck.Paint();
            const filter =
              (item.graphics?.blur ?? 0) > 0
                ? this.ck.ImageFilter.MakeBlur(
                    item.graphics!.blur!,
                    item.graphics!.blur!,
                    this.ck.TileMode.Decal,
                    null,
                  )
                : null;
            try {
              paint.setAlphaf(item.localOpacity);
              if (filter) paint.setImageFilter(filter);
              target.saveLayer(paint);
              ++count;
            } finally {
              paint.delete();
              filter?.delete();
            }
          }
          const mask = !culled && nativeLinearMask(item);
          if (mask) {
            const bounds = nativeMaskBounds(this.ck, mask),
              paint = new this.ck.Paint();
            try {
              target.clipRect(bounds, this.ck.ClipOp.Intersect, false);
              target.saveLayer(paint, bounds);
              ++count;
            } finally {
              paint.delete();
            }
          }
          saves.push({ count, matrix: item.matrix, culled, item });
          if (!culled) {
            this.drawItem(target, table, nodes, item, scale);
            if (item.snapshot) {
              const decision = this.snapshotAccess!(frame.submission, 1, item.node)!;
              this.pruneSnapshots(decision);
              if (decision.action === 1) {
                let layers = 0;
                for (let childIndex = index + 1; childIndex < ends[index]!; ++childIndex) {
                  const child = frame.nodes[childIndex]!;
                  if (child.opacity <= 0 || child.flags & p.nodeFlags.paintResource) continue;
                  if (child.localOpacity < 1 || (child.graphics?.blur ?? 0) > 0)
                    layers += (child.graphics?.blur ?? 0) > 0 ? 3 : 1;
                  if (child.flags & p.nodeFlags.clipSaveLayer) ++layers;
                  if (nativeLinearMask(child)) ++layers;
                  if ((child.snapshot?.live?.opacity ?? 1) < 1) ++layers;
                }
                this.captureSnapshot(
                  frame.submission,
                  item.node,
                  decision,
                  (recording) =>
                    drawRange(
                      recording,
                      index + 1,
                      ends[index]!,
                      item.matrix,
                      decision.ratio,
                      false,
                    ),
                  decision.pixelWidth * decision.pixelHeight * 4 * layers,
                );
              }
              if (decision.background) {
                const paint = new this.ck.Paint();
                try {
                  paint.setColor(this.color(decision.background));
                  target.drawRect(
                    this.ck.XYWHRect(0, 0, decision.boxWidth, decision.boxHeight),
                    paint,
                  );
                } finally {
                  paint.delete();
                }
              }
              target.save();
              let layers = 1;
              try {
                target.concat(canvasMatrix(decision.matrix));
                if (decision.action === 1 || decision.action === 2) {
                  const image = this.snapshots.get(decision.token)?.image;
                  if (!image) throw Error('Snapshot raster token is unavailable');
                  const paint = new this.ck.Paint();
                  try {
                    paint.setAlphaf(decision.opacity);
                    target.drawImageRectOptions(
                      image,
                      this.ck.XYWHRect(0, 0, decision.sourceRectWidth, decision.sourceRectHeight),
                      this.ck.XYWHRect(0, 0, decision.destinationWidth, decision.destinationHeight),
                      this.ck.FilterMode.Linear,
                      this.ck.MipmapMode.Linear,
                      paint,
                    );
                  } finally {
                    paint.delete();
                  }
                  if (decision.action === 2) ++this.counters.snapshotReuses;
                } else if (
                  decision.boxWidth > 0 &&
                  decision.boxHeight > 0 &&
                  decision.opacity > 0
                ) {
                  if (decision.opacity < 1) {
                    const paint = new this.ck.Paint();
                    try {
                      paint.setAlphaf(decision.opacity);
                      target.saveLayer(paint);
                      ++layers;
                    } finally {
                      paint.delete();
                    }
                  }
                  drawRange(target, index + 1, ends[index]!, item.matrix, scale, sceneClip);
                }
              } finally {
                while (layers--) target.restore();
              }
              index = ends[index]! - 1;
            }
          }
        }
        while (saves.length) finish(true);
      } finally {
        while (saves.length) finish(false);
      }
    };
    try {
      drawRange(target, 0, frame.nodes.length, [1, 0, 0, 1, 0, 0], scale);
    } finally {
      target.restore();
    }
    this.surface.flush();
    ++this.counters.draws;
  }
  resize(width: number, height: number, scale: number): void {
    const canvas = this.canvas;
    if (!canvas) throw new Error('Render canvas owner is not ready');
    const pixelWidth = Math.round(width * scale),
      pixelHeight = Math.round(height * scale);
    if (!pixelWidth || !pixelHeight) return;
    if (pixelWidth > 8192 || pixelHeight > 8192 || pixelWidth * pixelHeight > 16 * 1024 * 1024)
      throw new Error('Canvas backing budget exceeded');
    if (!this.surface || canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
      const nextBacking = this.budget?.reserve(3, pixelWidth * pixelHeight * 4 * 3);
      let installed = false;
      try {
        this.surface?.delete();
        this.surface = null;
        this.counters.liveSurfaces = 0;
        canvas.width = pixelWidth;
        canvas.height = pixelHeight;
        // Own one public GrDirectContext for the entire Render owner. The canvas
        // convenience helper creates another context on each resize and has a
        // software-surface fallback; this port requires WebGL2 explicitly.
        if (!this.context) {
          this.cacheRelease = this.budget?.reserve(3, 32 * 1024 * 1024);
          this.contextHandle = this.ck.GetWebGLContext(canvas, { majorVersion: 2 });
          if (!this.contextHandle) throw new Error('Worker WebGL2 context unavailable');
          this.context = this.ck.MakeWebGLContext(this.contextHandle);
          if (!this.context) throw new Error('CanvasKit GPU context unavailable');
          this.context.setResourceCacheLimitBytes(this.counters.gpuCacheLimitBytes);
          this.counters.liveContexts = 1;
        }
        this.surface = this.ck.MakeOnScreenGLSurface(
          this.context,
          pixelWidth,
          pixelHeight,
          this.ck.ColorSpace.SRGB,
        );
        if (!this.surface) throw new Error('Worker WebGL2 CanvasKit surface unavailable');
        const gl = canvas.getContext('webgl2');
        if (!gl) throw new Error('CanvasKit did not create WebGL2');
        const debug = gl.getExtension('WEBGL_debug_renderer_info');
        this.gl = {
          version: 2,
          renderer: String(gl.getParameter(debug ? debug.UNMASKED_RENDERER_WEBGL : gl.RENDERER)),
        };
        this.counters.liveSurfaces = 1;
        this.backingRelease?.();
        this.backingRelease = nextBacking;
        installed = true;
        this.counters.gpuReservedBytes = 32 * 1024 * 1024 + pixelWidth * pixelHeight * 12;
      } finally {
        if (!installed) nextBacking?.();
      }
    }
  }
  private drawItem(
    canvas: ReturnType<Surface['getCanvas']>,
    table: Map<string, Picture>,
    nodes: Map<string, EngineNodeSnapshot>,
    item: EngineNodeSnapshot,
    scale: number,
  ): void {
    if (item.width <= 0 || item.height <= 0) return;
    const picture = table.get(key(item.node));
    if (!picture) throw new Error('Prepared node generation missing');
    const geometry =
      item.hasFocus && item.textGeometry?.revision === item.editing?.revision
        ? item.textGeometry
        : null;
    const paintTextRect = (
      r: import('../../../runtime/engine-client/codec.ts').TextRect,
      color: number,
    ) => {
      const paint = new this.ck.Paint();
      paint.setColor(this.color(color));
      paint.setAlphaf((color >>> 24) / 255);
      try {
        canvas.drawRect(this.ck.XYWHRect(r.x, r.y, r.width, r.height), paint);
      } finally {
        paint.delete();
      }
    };
    if (geometry) for (const rect of geometry.selection) paintTextRect(rect, 0x663582f6);
    canvas.drawPicture(picture);
    this.drawPaint(canvas, table, nodes, item, scale, false);
    if (item.control) paintControl(this.ck, canvas, item.control, item.width, item.height, 1);
    if (geometry && item.caretVisible && item.editing?.base === item.editing?.extent)
      paintTextRect(geometry.caret, 0xff172033);
  }
  private drawPaint(
    canvas: ReturnType<Surface['getCanvas']>,
    table: Map<string, Picture>,
    nodes: Map<string, EngineNodeSnapshot>,
    item: EngineNodeSnapshot,
    scale: number,
    foreground: boolean,
  ): void {
    if (
      !(item.flags & p.nodeFlags.livePaint) ||
      (foreground && !item.nativePaint?.some((entry) => entry.kind === 'children'))
    )
      return;
    const paint = new this.ck.Paint();
    paint.setAntiAlias(true);
    try {
      paintNative(this.ck, canvas, item, paint, scale, foreground, (reference) => {
        const resource = nodes.get(key(reference)),
          picture = table.get(key(reference));
        if (!resource || !picture || !(resource.flags & p.nodeFlags.paintResource))
          throw Error('Prepared paragraph generation missing');
        if (resource.localOpacity <= 0) return;
        const layered = resource.localOpacity < 1 || (resource.graphics?.blur ?? 0) > 0;
        if (layered) {
          const alpha = new this.ck.Paint(),
            blur = resource.graphics?.blur ?? 0,
            filter =
              blur > 0
                ? this.ck.ImageFilter.MakeBlur(blur, blur, this.ck.TileMode.Decal, null)
                : null;
          try {
            alpha.setAlphaf(resource.localOpacity);
            if (filter) alpha.setImageFilter(filter);
            canvas.saveLayer(alpha);
          } finally {
            alpha.delete();
            filter?.delete();
          }
        }
        try {
          canvas.drawPicture(picture);
          ++this.counters.orderedParagraphs;
        } finally {
          if (layered) canvas.restore();
        }
      });
      if (foreground) ++this.counters.foregroundPaints;
      else {
        ++this.counters.livePaints;
        this.counters.livePaintEntries += item.nativePaint?.length ?? 0;
      }
    } finally {
      paint.delete();
    }
  }
  retireExcept(active: bigint, candidate = 0n): void {
    for (const id of this.preparedRecords.keys())
      if (id !== active && id !== candidate) this.forgetPreparedRecords(id);
    for (const [id, table] of this.tables)
      if (id !== active && id !== candidate) {
        for (const picture of table.values()) this.dropPicture(picture);
        this.tables.delete(id);
        for (const path of this.pathTables.get(id)?.values() ?? []) path.delete();
        this.pathTables.delete(id);
        this.tableFonts.get(id)?.();
        this.tableFonts.delete(id);
      }
  }
  close(): void {
    if (this.closing) return;
    if (this.fontScopes || this.appFonts.size > this.resourceFonts.size)
      throw Error('App provider still has live font catalogs/scopes');
    if (this.immutableBuffers.size) throw Error('App provider still has live immutable buffers');
    this.closing = true;
    for (const entry of this.snapshots.values()) entry.release();
    this.snapshots.clear();
    this.counters.liveSnapshots = 0;
    this.snapshotAccess = undefined;
    this.trimCache();
    this.retireExcept(-1n);
    this.pictureFonts?.delete();
    this.pictureFonts = undefined;
    for (const release of this.packetHolds.values()) release();
    this.packetHolds.clear();
    this.surface?.delete();
    this.surface = null;
    this.counters.liveSurfaces = 0;
    this.fontProvider.delete();
    for (const face of this.typefaces.values()) face.delete();
    this.typefaces.clear();
    this.regularProbes.clear();
    this.fontAliases.clear();
    this.families.clear();
    this.counters.fontBytes = 0;
    this.counters.sourceBytes = 0;
    if (this.context) {
      this.context.releaseResourcesAndAbandonContext();
      this.context.delete();
      this.context = null;
    }
    if (this.contextHandle) {
      this.ck.deleteContext(this.contextHandle);
      this.contextHandle = 0;
    }
    this.counters.liveContexts = 0;
    this.backingRelease?.();
    this.backingRelease = undefined;
    this.cacheRelease?.();
    this.cacheRelease = undefined;
    this.counters.gpuReservedBytes = 0;
    this.budget?.close();
  }
}
