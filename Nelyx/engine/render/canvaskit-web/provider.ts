// SPDX-License-Identifier: BSD-3-Clause
import type {
  CanvasKit,
  SkPicture as Picture,
  Surface,
  TypefaceFontProvider,
  Typeface,
} from 'canvaskit-wasm';
import { decodeUtf8, protocol as p } from '../../../runtime/engine-client/index.ts';
import type { EngineResponse, EngineNodeSnapshot } from '../../../runtime/engine-client/index.ts';
import { key, script, verified } from '../../platform/web/common.ts';

export interface WebManifest {
  schema: string;
  abi: { major: number; schema: number };
  files: { path: string; sha256: string }[];
  canvasKit: { version: string; variant: string; js: string; wasm: string };
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
  private fontProvider: TypefaceFontProvider;
  private typeface: Typeface;
  private surface: Surface | null = null;
  private canvas: OffscreenCanvas | undefined;
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
    fontBytes: 0,
    sourceBytes: 0,
    heapBytes: 0,
    textPictureProbeBytes: 0,
    glyphBytes: 0,
  };
  gl: { version: number; renderer: string } | undefined;
  private constructor(
    readonly ck: CanvasKit,
    font: Uint8Array,
  ) {
    this.fontProvider = ck.TypefaceFontProvider.Make();
    this.fontProvider.registerFont(font, 'NelyxDefault');
    this.counters.fontBytes = font.length;
    const face = ck.Typeface.MakeTypefaceFromData(font.slice().buffer);
    if (!face) throw new Error('Provider font decode failed');
    this.typeface = face;
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
    const [js, wasm, font] = await Promise.all([
      verified(root, entry(manifest.canvasKit.js)),
      verified(root, entry(manifest.canvasKit.wasm)),
      verified(root, entry('assets/font.ttf'), 16 * 1024 * 1024),
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
    if (!ck.MakePicture || !ck.ParagraphBuilder.MakeFromFontProvider || !ck.MakeWebGLCanvasSurface)
      throw new Error('Official CanvasKit public capability missing');
    return new CanvasKitProvider(ck, font);
  }
  attach(canvas: OffscreenCanvas): void {
    if (this.canvas) throw new Error('Canvas owner already attached');
    this.canvas = canvas;
  }
  private color(argb: number) {
    return this.ck.Color((argb >>> 16) & 255, (argb >>> 8) & 255, argb & 255, (argb >>> 24) / 255);
  }
  prepare(scene: EngineResponse, sharedOwner: boolean): PreparedPictures {
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
        const recorder = new this.ck.PictureRecorder();
        const paint = new this.ck.Paint();
        paint.setAntiAlias(true);
        let picture: Picture | null = null;
        try {
          const canvas = recorder.beginRecording(
            this.ck.XYWHRect(0, 0, Math.max(1, node.width), Math.max(1, node.height)),
          );
          if (node.kind === p.kinds.paragraph) {
            const builder = this.ck.ParagraphBuilder.MakeFromFontProvider(
              new this.ck.ParagraphStyle({
                textStyle: {
                  fontFamilies: ['NelyxDefault'],
                  fontSize: node.fontSize,
                  color: this.color(node.color),
                },
                maxLines: 8,
                textAlign: this.ck.TextAlign.Left,
              }),
              this.fontProvider,
            );
            let paragraph;
            try {
              const text = texts.get(key(node.node)) ?? '';
              builder.addText(text);
              paragraph = builder.build();
              paragraph.layout(Math.max(1, node.width));
              // Exercise public UTF-16 line indexing and retained paragraph painting.
              if (text.length) paragraph.getLineNumberAt(0);
              canvas.drawParagraph(paragraph, 0, 0);
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
                      if (
                        !run.typeface ||
                        run.typeface.getFamilyName() !== this.typeface.getFamilyName()
                      )
                        throw new Error(
                          'Prepared glyph font is outside the declared provider font set',
                        );
                      const glyphs = new Uint16Array(run.glyphs),
                        positions = new Float32Array(run.positions);
                      this.counters.glyphBytes += glyphs.byteLength + positions.byteLength;
                      record.runs.push({
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
              builder.delete();
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
                this.ck.XYWHRect(0, 0, node.width, node.height),
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
          } else if (node.kind !== p.kinds.paragraph) {
            const encoded = picture.serialize();
            if (!encoded) throw new Error('Picture serialization failed');
            const copy = new Uint8Array(encoded).slice();
            bytes += copy.length;
            if (bytes > 96 * 1024 * 1024)
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
        packet.local = local;
        this.tables.set(packet.preparation, local);
        this.counters.livePictures += local.size;
      }
      return packet;
    } catch (error) {
      for (const picture of local.values()) picture.delete();
      throw error;
    }
  }
  import(packet: PreparedPictures): void {
    if (this.tables.has(packet.preparation)) return;
    const table = new Map<string, Picture>();
    try {
      for (const item of packet.pictures) {
        const picture = this.ck.MakePicture(item.bytes);
        if (!picture) throw new Error('Prepared Picture decode failed');
        table.set(item.node, picture);
        ++this.counters.imports;
      }
      for (const item of packet.texts) {
        const recorder = new this.ck.PictureRecorder(),
          paint = new this.ck.Paint();
        paint.setColor(this.color(item.color));
        paint.setAntiAlias(true);
        try {
          const canvas = recorder.beginRecording(
            this.ck.XYWHRect(0, 0, Math.max(1, item.width), Math.max(1, item.height)),
          );
          for (const run of item.runs) {
            if (run.positions.length !== 2 * (run.glyphs.length + 1) || run.glyphs.length > 65536)
              throw new Error('Prepared glyph position budget/length');
            const font = new this.ck.Font(this.typeface, run.size);
            font.setSubpixel(true);
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
      this.surface = this.ck.MakeWebGLCanvasSurface(canvas, this.ck.ColorSpace.SRGB, {
        majorVersion: 2,
      });
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
    if (item.opacity < 1) {
      const paint = new this.ck.Paint();
      paint.setAlphaf(item.opacity);
      canvas.saveLayer(paint);
      canvas.drawPicture(picture);
      canvas.restore();
      paint.delete();
    } else canvas.drawPicture(picture);
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
    this.retireExcept(-1n);
    this.surface?.delete();
    this.surface = null;
    this.counters.liveSurfaces = 0;
    this.fontProvider.delete();
    this.typeface.delete();
    this.counters.fontBytes = 0;
    this.counters.sourceBytes = 0;
  }
}
