// SPDX-License-Identifier: BSD-3-Clause
import type {
  CanvasKit,
  SkPicture as Picture,
  Surface,
  TypefaceFontProvider,
  Typeface,
  GrDirectContext,
  Paragraph,
} from 'canvaskit-wasm';
import { decodeUtf8, protocol as p } from '../../../runtime/engine-client/index.ts';
import type {
  EngineResponse,
  EngineNodeSnapshot,
  ProviderMeasurement,
} from '../../../runtime/engine-client/index.ts';
import { key, script, verified } from '../../platform/web/common.ts';
import { lineIndexUnit, lineNumberAtUTF16, editingGeometry } from './paragraph.ts';
import type { LineIndexUnit } from './paragraph.ts';
import { paintControl } from './controls.ts';
export interface ProviderFont {
  id: string;
  family: string;
  bytes: Uint8Array;
}

export interface WebManifest {
  schema: string;
  abi: { major: number; schema: number };
  files: { path: string; sha256: string }[];
  canvasKit: { version: string; variant: string; js: string; wasm: string };
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
    runs: {
      font: string;
      size: number;
      glyphs: Uint16Array;
      positions: Float32Array;
      bold: boolean;
      italic: boolean;
    }[];
  }[];
  local?: Map<string, Picture>;
}
export class CanvasKitProvider {
  private measuredParagraphs = new Map<string, { signature: string; paragraph: Paragraph }>();
  private measurePreparation = 0n;
  private fontProvider: TypefaceFontProvider;
  private typefaces = new Map<string, Typeface>();
  private families = new Map<string, string>();
  private fontFamilies: string[] = [];
  readonly textCapabilities: {
    lineIndexUnit: LineIndexUnit;
    unscaledAscent: false;
    softHyphenSwitch: false;
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
    sourceBytes: 0,
    heapBytes: 0,
    textPictureProbeBytes: 0,
    glyphBytes: 0,
    measurements: 0,
    paragraphLayouts: 0,
    liveParagraphs: 0,
  };
  gl: { version: number; renderer: string } | undefined;
  private constructor(
    readonly ck: CanvasKit,
    font: Uint8Array | ProviderFont[],
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
          unscaledAscent: false,
          softHyphenSwitch: false,
        };
      } finally {
        probe.delete();
      }
    } catch (error) {
      for (const face of this.typefaces.values()) face.delete();
      this.fontProvider.delete();
      throw error;
    }
    this.counters.heapBytes = (ck as unknown as { HEAPU8: Uint8Array }).HEAPU8.byteLength;
  }
  static async load(root: string): Promise<CanvasKitProvider> {
    const manifest = (await (
      await fetch(new URL('engine-manifest.json', root))
    ).json()) as WebManifest;
    if (manifest.canvasKit.version !== '0.41.0' || manifest.canvasKit.variant !== 'full')
      throw new Error('CanvasKit supplier differs');
    const entry = (name: string) => {
      const file = manifest.files.find((f) => f.path === name);
      if (!file) throw new Error('Asset absent from manifest: ' + name);
      return file;
    };
    if (!manifest.fonts?.length || manifest.fonts.length > 8)
      throw new Error('Declared provider fonts missing');
    const [js, wasm, ...fonts] = await Promise.all([
      verified(root, entry(manifest.canvasKit.js)),
      verified(root, entry(manifest.canvasKit.wasm)),
      ...manifest.fonts.map((font) => verified(root, entry(font.path), 16 * 1024 * 1024)),
    ]);
    await script(js);
    const factory = (
      globalThis as unknown as { CanvasKitInit?: (options: unknown) => Promise<CanvasKit> }
    ).CanvasKitInit;
    if (!factory) throw new Error('Official CanvasKit factory missing');
    const ck = await factory({
      wasmBinary: wasm,
      locateFile: () => new URL(manifest.canvasKit.wasm, root).href,
    });
    if (
      !ck.MakePicture ||
      !ck.ParagraphBuilder.MakeFromFontProvider ||
      !ck.GetWebGLContext ||
      !ck.MakeWebGLContext ||
      !ck.MakeOnScreenGLSurface ||
      !ck.deleteContext
    )
      throw new Error('Official CanvasKit public capability missing');
    return new CanvasKitProvider(
      ck,
      manifest.fonts.map((font, i) => ({
        id: entry(font.path).sha256,
        family: font.family,
        bytes: fonts[i]!,
      })),
    );
  }
  attach(canvas: OffscreenCanvas): void {
    if (this.canvas) throw new Error('Canvas owner already attached');
    this.canvas = canvas;
  }
  private color(argb: number) {
    return this.ck.Color((argb >>> 16) & 255, (argb >>> 8) & 255, argb & 255, (argb >>> 24) / 255);
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
    ]);
    const previous = this.measuredParagraphs.get(key(node.node));
    if (previous?.signature === signature) {
      this.measuredParagraphs.delete(key(node.node));
      --this.counters.liveParagraphs;
      return previous.paragraph;
    }
    const builder = this.ck.ParagraphBuilder.MakeFromFontProvider(
      new this.ck.ParagraphStyle({
        textStyle: {
          fontFamilies: this.fontFamilies,
          fontSize: node.fontSize,
          color: this.color(node.color),
        },
        textAlign: this.ck.TextAlign.Left,
        textDirection:
          node.textDirection === 1 ? this.ck.TextDirection.RTL : this.ck.TextDirection.LTR,
      }),
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
        width = Math.ceil(paragraph.getMaxIntrinsicWidth());
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
      };
      this.measuredParagraphs.get(key(node.node))?.paragraph.delete();
      this.measuredParagraphs.set(key(node.node), {
        signature: JSON.stringify([
          text,
          node.fontSize,
          node.color,
          width,
          node.textDirection ?? 0,
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
    };
    const local = new Map<string, Picture>();
    let bytes = 0;
    try {
      for (const node of scene.nodes) {
        const content = node.content ?? { x: 0, y: 0, width: node.width, height: node.height };
        const recorder = new this.ck.PictureRecorder();
        const paint = new this.ck.Paint();
        paint.setAntiAlias(true);
        let picture: Picture | null = null;
        try {
          const canvas = recorder.beginRecording(
            this.ck.XYWHRect(0, 0, Math.max(1, node.width), Math.max(1, node.height)),
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
                        bold: run.fakeBold,
                        italic: run.fakeItalic,
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
          } else if (node.color >>> 24) {
            paint.setColor(this.color(node.color));
            if (node.radius)
              canvas.drawRRect(
                this.ck.RRectXY(
                  this.ck.XYWHRect(0, 0, node.width, node.height),
                  node.radius,
                  node.radius,
                ),
                paint,
              );
            else canvas.drawRect(this.ck.XYWHRect(0, 0, node.width, node.height), paint);
          }
          picture = recorder.finishRecordingAsPicture();
          ++this.counters.pictures;
          if (sharedOwner) {
            local.set(key(node.node), picture);
            picture = null;
          } else if (node.kind !== p.kinds.paragraph && node.kind !== p.kinds.editable) {
            const encoded = picture.serialize();
            if (!encoded) throw new Error('Picture serialization failed');
            const copy = new Uint8Array(encoded).slice();
            bytes += copy.length;
            if (bytes > p.limits.resourceBytes)
              throw new Error('Prepared Picture transfer budget exceeded');
            packet.pictures.push({ node: key(node.node), bytes: copy.buffer });
          } else if (!this.counters.textPictureProbeBytes) {
            const probe = picture.serialize();
            if (!probe) throw new Error('Public text Picture serialization failed');
            this.counters.textPictureProbeBytes = probe.length;
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
        this.counters.livePictures += local.size;
      }
      return packet;
    } catch (error) {
      for (const picture of local.values()) picture.delete();
      throw error;
    } finally {
      this.discardMeasurements();
    }
  }
  import(packet: PreparedPictures): void {
    if (this.tables.has(packet.preparation)) return;
    const table = new Map<string, Picture>();
    let bytes = 0;
    try {
      if (packet.pictures.length + packet.texts.length > p.limits.nodes)
        throw new Error('Prepared node budget exceeded');
      for (const item of packet.pictures) {
        bytes += item.bytes.byteLength;
        if (table.has(item.node) || bytes > p.limits.resourceBytes)
          throw new Error('Duplicate/oversize prepared Picture');
        const picture = this.ck.MakePicture(item.bytes);
        if (!picture) throw new Error('Prepared Picture decode failed');
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
          const canvas = recorder.beginRecording(
            this.ck.XYWHRect(0, 0, Math.max(1, item.width), Math.max(1, item.height)),
          );
          for (const run of item.runs) {
            bytes += run.glyphs.byteLength + run.positions.byteLength;
            if (bytes > p.limits.resourceBytes)
              throw new Error('Prepared glyph import budget exceeded');
            if (run.positions.length !== 2 * (run.glyphs.length + 1) || run.glyphs.length > 65536)
              throw new Error('Prepared glyph position budget/length');
            const face = this.typefaces.get(run.font);
            if (!face) throw new Error('Prepared glyph font identity is not installed');
            const font = new this.ck.Font(face, run.size);
            font.setSubpixel(true);
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
          table.set(item.node, recorder.finishRecordingAsPicture());
          ++this.counters.imports;
        } finally {
          paint.delete();
          recorder.delete();
        }
      }
      this.tables.set(packet.preparation, table);
      this.counters.livePictures += table.size;
    } catch (error) {
      for (const picture of table.values()) picture.delete();
      throw error;
    }
  }
  draw(frame: EngineResponse, width: number, height: number, scale: number): void {
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
    for (const item of frame.nodes) this.drawItem(target, table, item);
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
      this.surface?.delete();
      this.surface = null;
      this.counters.liveSurfaces = 0;
      canvas.width = pixelWidth;
      canvas.height = pixelHeight;
      // Own one public GrDirectContext for the entire Render owner. The canvas
      // convenience helper creates another context on each resize and has a
      // software-surface fallback; this port requires WebGL2 explicitly.
      if (!this.context) {
        this.contextHandle = this.ck.GetWebGLContext(canvas, { majorVersion: 2 });
        if (!this.contextHandle) throw new Error('Worker WebGL2 context unavailable');
        this.context = this.ck.MakeWebGLContext(this.contextHandle);
        if (!this.context) throw new Error('CanvasKit GPU context unavailable');
        this.context.setResourceCacheLimitBytes(32 * 1024 * 1024);
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
    canvas.save();
    canvas.clipRect(
      this.ck.XYWHRect(item.clip.x, item.clip.y, item.clip.width, item.clip.height),
      this.ck.ClipOp.Intersect,
      false,
    );
    canvas.translate(item.x, item.y);
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
      paint.setAlphaf(((color >>> 24) / 255) * item.opacity);
      try {
        canvas.drawRect(this.ck.XYWHRect(r.x, r.y, r.width, r.height), paint);
      } finally {
        paint.delete();
      }
    };
    if (geometry) for (const rect of geometry.selection) paintTextRect(rect, 0x663582f6);
    if (item.opacity < 1) {
      const paint = new this.ck.Paint();
      paint.setAlphaf(item.opacity);
      canvas.saveLayer(paint);
      canvas.drawPicture(picture);
      canvas.restore();
      paint.delete();
    } else canvas.drawPicture(picture);
    if (item.control)
      paintControl(this.ck, canvas, item.control, item.width, item.height, item.opacity);
    if (geometry && item.caretVisible && item.editing?.base === item.editing?.extent)
      paintTextRect(geometry.caret, 0xff172033);
    canvas.restore();
  }
  retireExcept(active: bigint, candidate = 0n): void {
    for (const [id, table] of this.tables)
      if (id !== active && id !== candidate) {
        for (const picture of table.values()) picture.delete();
        this.counters.livePictures -= table.size;
        this.tables.delete(id);
      }
  }
  close(): void {
    this.discardMeasurements();
    this.retireExcept(-1n);
    this.surface?.delete();
    this.surface = null;
    this.counters.liveSurfaces = 0;
    this.fontProvider.delete();
    for (const face of this.typefaces.values()) face.delete();
    this.typefaces.clear();
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
  }
}
