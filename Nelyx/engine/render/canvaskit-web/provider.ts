// SPDX-License-Identifier: BSD-3-Clause
import type {
  CanvasKit,
  SkPicture as Picture,
  Surface,
  TypefaceFontProvider,
  Typeface,
  GrDirectContext,
  Paragraph,
  ParagraphBuilder,
  ParagraphStyle,
  Path,
} from 'canvaskit-wasm';
import { decodeUtf8, protocol as p } from '../../../runtime/engine-client/index.ts';
import type {
  EngineResponse,
  EngineNodeSnapshot,
  ProviderMeasurement,
} from '../../../runtime/engine-client/index.ts';
import { key, script, verified, CommittedMemoryError } from '../../platform/web/common.ts';
import { lineIndexUnit, lineNumberAtUTF16, editingGeometry } from './paragraph.ts';
import type { LineIndexUnit } from './paragraph.ts';
import { paintControl } from './controls.ts';
import {
  makePath,
  paintShape,
  paintNative,
  paintNativeShadow,
  canvasMatrix,
  relativeMatrix,
} from './graphics.ts';
import type { ProviderBudget } from '../../platform/web/memory.ts';
export interface ProviderFont {
  id: string;
  family: string;
  bytes: Uint8Array;
}
export const canvasKitSupply = Object.freeze({
  version: 'm153-nelyx-paragraph.1',
  variant: 'owned-full',
  paragraphApiVersion: 1,
});
type ParagraphRuntime = CanvasKit & { nelyxParagraphApiVersion?: () => number };

export interface WebManifest {
  schema: string;
  abi: { major: number; schema: number };
  files: { path: string; sha256: string }[];
  canvasKit: {
    version: string;
    variant: string;
    paragraphApiVersion: number;
    sourceManifest: string;
    js: string;
    wasm: string;
  };
  fonts: { path: string; family: string }[];
}
export interface PreparedPictures {
  preparation: bigint;
  metrics: bigint;
  device: bigint;
  document: bigint;
  pictures: { node: string; bytes: ArrayBuffer }[];
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
    segments: readonly import('../../../runtime/engine-client/index.ts').PathSegment[];
    fillRule: 'winding' | 'evenOdd';
  }[];
  local?: Map<string, Picture>;
}
type PreparedText = PreparedPictures['texts'][number];
type ContentRecord = {
  signature: string;
  resource: Uint8Array | undefined;
  picture: Picture | undefined;
  encoded: Uint8Array | undefined;
  text: PreparedText | undefined;
  bytes: number;
  release: () => void;
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
  private static readonly fontVariationLimit = 16;
  private packetHolds = new Map<bigint, () => void>();
  private backingRelease: (() => void) | undefined;
  private cacheRelease: (() => void) | undefined;
  private closing = false;
  private memoryPressure = false;
  private recorded = new Map<string, ContentRecord>();
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
    paragraphs: 0,
    images: 0,
    pictures: 0,
    imports: 0,
    draws: 0,
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
    cachedContentBytes: 0,
    memoryPressure: false,
    gpuCacheLimitBytes: 32 * 1024 * 1024,
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
    for (const entry of this.regularTypefaces.values()) {
      entry.face.delete();
      entry.release();
    }
    this.regularTypefaces.clear();
    this.counters.liveFontVariations = 0;
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
    private budget?: ProviderBudget,
  ) {
    this.fontProvider = ck.TypefaceFontProvider.Make();
    try {
      for (const input of font instanceof Uint8Array
        ? [{ id: 'default', family: 'NelyxDefault', bytes: font }]
        : font) {
        if (this.typefaces.has(input.id)) throw new Error('Duplicate provider font identity');
        this.counters.fontBytes += input.bytes.length;
        if (this.counters.fontBytes > 16 * 1024 * 1024)
          throw new Error('Provider font budget exceeded');
        this.fontProvider.registerFont(input.bytes, input.family);
        const face = ck.Typeface.MakeTypefaceFromData(input.bytes.slice().buffer);
        if (!face) throw new Error('Provider font decode failed');
        this.typefaces.set(input.id, face);
        this.fontAliases.set(input.id, input.family);
        this.families.set(face.getFamilyName(), input.id);
        this.fontFamilies.push(input.family);
      }
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
  static async load(root: string, budget?: ProviderBudget): Promise<CanvasKitProvider> {
    const release = budget?.reserve(4, 48 * 1024 * 1024);
    try {
      const manifest = (await (
        await fetch(new URL('engine-manifest.json', root))
      ).json()) as WebManifest;
      if (
        manifest.canvasKit.version !== canvasKitSupply.version ||
        manifest.canvasKit.variant !== canvasKitSupply.variant ||
        manifest.canvasKit.paragraphApiVersion !== canvasKitSupply.paragraphApiVersion
      )
        throw new Error('CanvasKit supplier differs');
      const entry = (name: string) => {
        const file = manifest.files.find((f) => f.path === name);
        if (!file) throw new Error('Asset absent from manifest: ' + name);
        return file;
      };
      if (!manifest.fonts?.length || manifest.fonts.length > 8)
        throw new Error('Declared provider fonts missing');
      const [js, wasm, source, ...fonts] = await Promise.all([
        verified(root, entry(manifest.canvasKit.js)),
        verified(root, entry(manifest.canvasKit.wasm)),
        verified(root, entry(manifest.canvasKit.sourceManifest)),
        ...manifest.fonts.map((font) => verified(root, entry(font.path), 16 * 1024 * 1024)),
      ]);
      const supplied = JSON.parse(new TextDecoder().decode(source));
      if (
        supplied.schema !== 'nelyx.canvaskit/v1' ||
        supplied.version !== canvasKitSupply.version ||
        supplied.paragraphApiVersion !== canvasKitSupply.paragraphApiVersion ||
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
      const factory = (
        globalThis as unknown as { CanvasKitInit?: (options: unknown) => Promise<CanvasKit> }
      ).CanvasKitInit;
      if (!factory) throw new Error('Owned CanvasKit factory missing');
      const ck = await factory({
        wasmBinary: wasm,
        locateFile: () => new URL(manifest.canvasKit.wasm, root).href,
      });
      if (
        (ck as ParagraphRuntime).nelyxParagraphApiVersion?.() !==
          canvasKitSupply.paragraphApiVersion ||
        !ck.MakePicture ||
        !ck.ParagraphBuilder.MakeFromFontProvider ||
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
      release?.();
      budget?.close();
      throw error;
    } finally {
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
      builder = this.ck.ParagraphBuilder.MakeFromFontProvider(
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
        this.fontProvider,
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
  private paragraph(node: EngineNodeSnapshot, text: string, width: number): Paragraph {
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
    ]);
    const previous = this.measuredParagraphs.get(key(node.node));
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
          ? [options.fontFamily, ...this.fontFamilies]
          : this.fontFamilies,
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
    const builder = this.ck.ParagraphBuilder.MakeFromFontProvider(
      new this.ck.ParagraphStyle(paragraphStyle),
      this.fontProvider,
    );
    let paragraph: Paragraph | undefined;
    try {
      builder.addText(text);
      paragraph = builder.build();
      paragraph.layout(width);
      ++this.counters.paragraphLayouts;
      return paragraph;
    } catch (error) {
      paragraph?.delete();
      throw error;
    } finally {
      builder.delete();
    }
  }
  discardMeasurements(): void {
    for (const value of this.measuredParagraphs.values()) value.paragraph.delete();
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
      const image = data && this.ck.MakeImageFromEncoded(data.bytes);
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
        didExceedMaxLines: paragraph.didExceedMaxLines(),
      };
      this.measuredParagraphs.get(key(node.node))?.paragraph.delete();
      this.measuredParagraphs.set(key(node.node), {
        signature: JSON.stringify([
          text,
          node.fontSize,
          node.color,
          width,
          node.textDirection ?? 0,
          node.paragraph,
        ]),
        paragraph,
      });
      this.counters.liveParagraphs = this.measuredParagraphs.size;
      retained = true;
      return result;
    } finally {
      if (!retained) paragraph.delete();
    }
  }
  prepare(scene: EngineResponse, sharedOwner: boolean): PreparedPictures {
    const holds: (() => void)[] = [];
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
        () => this.prepareInner(scene, sharedOwner, retain),
      );
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
    const local = new Map<string, Picture>();
    const paths = new Map<string, Path>();
    const nextRecorded = new Map<string, ContentRecord>();
    let nextCachedBytes = 0;
    let bytes = 0;
    try {
      for (const node of scene.nodes) {
        const id = key(node.node),
          text = texts.get(id) ?? '',
          resource = node.resource ? resources.get(key(node.resource)) : undefined,
          signature = JSON.stringify([
            sharedOwner,
            String(scene.metrics),
            String(scene.device),
            String(scene.fontRevision),
            node.kind,
            node.width,
            node.height,
            node.color,
            node.radius,
            node.fontSize,
            node.paragraph,
            node.textDirection,
            node.content,
            node.graphics,
            node.nativePaint,
            node.editing?.flags ?? 0,
            text,
          ]);
        if (node.graphics?.hasPath) {
          const segments = node.graphics.path ?? [],
            fillRule = node.graphics.fillRule ?? 'winding';
          retain(128 + segments.length * 64);
          paths.set(key(node.node), makePath(this.ck, segments, fillRule));
          packet.paths.push({ node: key(node.node), segments, fillRule });
        }

        const previous = this.recorded.get(id);
        if (previous?.signature === signature && sameBytes(previous.resource, resource)) {
          if (sharedOwner) {
            if (!previous.picture) throw new Error('Local cached Picture missing');
            this.holdPicture(previous.picture);
            local.set(id, previous.picture);
          } else if (previous.encoded) {
            retain(previous.encoded.byteLength);
            bytes += previous.encoded.byteLength;
            packet.pictures.push({ node: id, bytes: previous.encoded.slice().buffer });
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
        const nativeOutset = (node.nativePaint ?? []).reduce(
          (maximum, entry) =>
            entry.kind === 'circle'
              ? Math.max(
                  maximum,
                  entry.resolvedRadius +
                    entry.shape.strokeWidth -
                    Math.min(node.width, node.height) / 2,
                )
              : maximum,
          0,
        );
        const recording = {
          x:
            Math.min(0, content.x) -
            Math.abs(node.graphics?.shadow?.x ?? 0) -
            (node.graphics?.shadow?.sigma ?? 0) * 4 -
            nativeOutset -
            2,
          y:
            Math.min(0, content.y) -
            Math.abs(node.graphics?.shadow?.y ?? 0) -
            (node.graphics?.shadow?.sigma ?? 0) * 4 -
            nativeOutset -
            2,
          width:
            Math.max(1, node.width, content.x + content.width) -
            Math.min(0, content.x) +
            Math.abs(node.graphics?.shadow?.x ?? 0) * 2 +
            (node.graphics?.shadow?.sigma ?? 0) * 8 +
            nativeOutset * 2 +
            4,
          height:
            Math.max(1, node.height, content.y + content.height) -
            Math.min(0, content.y) +
            Math.abs(node.graphics?.shadow?.y ?? 0) * 2 +
            (node.graphics?.shadow?.sigma ?? 0) * 8 +
            nativeOutset * 2 +
            4,
        };
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
              if (!sharedOwner) {
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
              paragraph?.delete();
            }
          } else if (node.kind === p.kinds.image) {
            const data = resources.get(key(node.resource));
            if (!data) throw new Error('Image resource missing');
            const image = this.ck.MakeImageFromEncoded(data);
            if (!image) throw new Error('Image decode failed');
            try {
              canvas.drawImageRect(
                image,
                this.ck.XYWHRect(0, 0, image.width(), image.height()),
                this.ck.XYWHRect(content.x, content.y, content.width, content.height),
                paint,
              );
              ++this.counters.images;
            } finally {
              image.delete();
            }
          } else {
            paintShape(this.ck, canvas, node, paths.get(key(node.node)), paint);
            paintNative(this.ck, canvas, node, paint);
          }
          picture = recorder.finishRecordingAsPicture();
          ++this.counters.pictures;
          if (sharedOwner) {
            this.holdPicture(picture);
            local.set(key(node.node), picture);
            picture = null;
          } else if (node.kind !== p.kinds.paragraph && node.kind !== p.kinds.editable) {
            const encoded = picture.serialize();
            if (!encoded) throw new Error('Picture serialization failed');
            retain(encoded.byteLength);
            const copy = encoded.slice();
            bytes += copy.length;
            if (bytes > p.limits.resourceBytes)
              throw new Error('Prepared Picture transfer budget exceeded');
            packet.pictures.push({ node: key(node.node), bytes: copy.buffer });
          }
          const encoded = packet.pictures[pictureStart]?.bytes,
            shaped = packet.texts[textStart],
            entryBytes =
              256 +
              signature.length * 2 +
              (resource?.byteLength ?? 0) +
              (encoded?.byteLength ?? 0) +
              textBytes(shaped) +
              (sharedOwner && text ? 65536 + text.length * 256 : 0);
          if (!this.memoryPressure && entryBytes <= 16 * 1024 * 1024 - nextCachedBytes) {
            const release = this.budget?.reserve(2, entryBytes) ?? (() => {});
            let kept = false;
            try {
              const record: ContentRecord = {
                signature,
                resource,
                picture: sharedOwner ? local.get(id) : undefined,
                encoded: encoded ? new Uint8Array(encoded).slice() : undefined,
                text: shaped ? copyText(shaped) : undefined,
                bytes: entryBytes,
                release,
              };
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
    let bytes = 0;
    try {
      if (packet.pictures.length + packet.texts.length > p.limits.nodes)
        throw new Error('Prepared node budget exceeded');
      for (const path of packet.paths ?? []) {
        if (paths.has(path.node)) throw new Error('Duplicate prepared clip path');
        paths.set(path.node, makePath(this.ck, path.segments, path.fillRule));
      }
      for (const item of packet.pictures) {
        bytes += item.bytes.byteLength;
        if (table.has(item.node) || bytes > p.limits.resourceBytes)
          throw new Error('Duplicate/oversize prepared Picture');
        const picture = this.ck.MakePicture(item.bytes);
        if (!picture) throw new Error('Prepared Picture decode failed');
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
      this.tables.set(packet.preparation, table);
      this.pathTables.set(packet.preparation, paths);
    } catch (error) {
      for (const picture of table.values()) this.dropPicture(picture);
      for (const path of paths.values()) path.delete();
      throw error;
    }
  }
  draw(frame: EngineResponse, width: number, height: number, scale: number): void {
    const layerBytes = frame.nodes.reduce(
      (total, n) =>
        total +
        ((n.localOpacity < 1 || (n.graphics?.blur ?? 0) > 0
          ? Math.ceil(width * scale) *
            Math.ceil(height * scale) *
            4 *
            ((n.graphics?.blur ?? 0) > 0 ? 3 : 1)
          : 0) +
          (n.flags & p.nodeFlags.clipSaveLayer
            ? Math.ceil(width * scale) * Math.ceil(height * scale) * 4
            : 0)),
      0,
    );
    const release = this.budget?.reserve(3, layerBytes);
    try {
      this.guarded(1024 * 1024, () => this.drawInner(frame, width, height, scale));
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
    const target = this.surface.getCanvas();
    target.clear(this.ck.Color(244, 246, 250, 1));
    target.save();
    target.scale(scale, scale);
    const saves: { count: number; matrix: EngineNodeSnapshot['matrix']; culled: boolean }[] = [];
    try {
      for (const item of frame.nodes) {
        while (saves.length > item.depth) {
          const { count } = saves.pop()!;
          for (let i = 0; i < count; ++i) target.restore();
        }
        const parent = saves.at(-1),
          relative = relativeMatrix(parent?.matrix ?? [1, 0, 0, 1, 0, 0], item.matrix);
        const culled =
          !!parent?.culled ||
          !relative ||
          item.matrix[0] * item.matrix[3] - item.matrix[1] * item.matrix[2] === 0;
        target.save();
        let count = 1;
        if (culled) target.clipRect(this.ck.XYWHRect(0, 0, 0, 0), this.ck.ClipOp.Intersect, false);
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
            if (style.shape === 'rect') target.clipRect(rect, this.ck.ClipOp.Intersect, antiAlias);
            else
              target.clipRRect(
                style.shape === 'oval'
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
        saves.push({ count, matrix: item.matrix, culled });
        if (!culled) this.drawItem(target, table, item);
      }
    } finally {
      while (saves.length) {
        const { count } = saves.pop()!;
        for (let i = 0; i < count; ++i) target.restore();
      }
    }
    target.restore();
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
    item: EngineNodeSnapshot,
  ): void {
    if (!(item.flags & 16) || !item.clip.width || !item.clip.height) return;
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
    if (item.control) paintControl(this.ck, canvas, item.control, item.width, item.height, 1);
    if (geometry && item.caretVisible && item.editing?.base === item.editing?.extent)
      paintTextRect(geometry.caret, 0xff172033);
  }
  retireExcept(active: bigint, candidate = 0n): void {
    for (const [id, table] of this.tables)
      if (id !== active && id !== candidate) {
        for (const picture of table.values()) this.dropPicture(picture);
        this.tables.delete(id);
        for (const path of this.pathTables.get(id)?.values() ?? []) path.delete();
        this.pathTables.delete(id);
      }
  }
  close(): void {
    if (this.closing) return;
    this.closing = true;
    this.trimCache();
    this.retireExcept(-1n);
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
    for (const release of this.packetHolds.values()) release();
    this.packetHolds.clear();
    this.counters.gpuReservedBytes = 0;
    this.budget?.close();
  }
}
