// SPDX-License-Identifier: BSD-3-Clause
import type { PaintFrame } from '@nelyx/core/ui/types';
import type { PaintSnapshot } from '@nelyx/core/ui/paint';
import { blendModes } from '@nelyx/core/ui/paint';
import { freezePath } from '@nelyx/core/ui/path';
import type { PathSnapshot } from '@nelyx/core/ui/path';
import { resourceKey } from '@nelyx/core/ui/frame';
import type { FrameDiagnostics } from '@nelyx/core/ui/frame';
import type { Skia } from './skia/types/Skia.ts';
import type { SkPaint } from './skia/types/Drawing.ts';
import type { GraphiteResources } from './renderer.ts';
import type { DisplayListTarget } from './display-list.ts';
import { displayListVersion } from './display-list.ts';
import { configurePaint } from './paint.ts';
import { applyPaintEffects } from './paint-effects.ts';
import { createEnginePath, encodePath } from './path.ts';

/** A frame-scoped numeric owner. No canvas facade, rest-argument arrays or
 * intermediate JS word list. Native validates the whole packet before replay.
 * Buffers and handle roots cannot survive this synchronous binding call. */
class ScenePacket {
  data: Float64Array;
  private used: number;
  private commands = 0;
  readonly handles: unknown[] = [];
  private readonly ids = new Map<unknown, number>();
  private readonly pathIds = new Map<PathSnapshot, number>();
  private readonly paintIds = new Map<PaintSnapshot, number>();
  private readonly paths: number[][] = [];
  private readonly paints: number[][] = [];
  private tableWords = 0;
  constructor(
    commands: number,
    private readonly frame: PaintFrame,
    readonly batch: boolean,
  ) {
    this.used = batch ? 16 : 4;
    this.data = new Float64Array(Math.min(2 * 1024 * 1024, Math.max(32, 4 + commands * 8)));
  }
  path(value: PathSnapshot): number {
    const snapshot = freezePath(value),
      known = this.pathIds.get(snapshot);
    if (known !== undefined) return known;
    const words = encodePath(snapshot),
      id = -2 - this.paths.length;
    this.addTable(words.length);
    this.paths.push(words);
    this.pathIds.set(snapshot, id);
    return id;
  }
  paint(value: PaintSnapshot): number {
    const known = this.paintIds.get(value);
    if (known !== undefined) return known;
    const id = -2 - this.paints.length;
    this.addTable(8);
    this.paints.push([
      value.color >>> 0,
      value.isAntiAlias ? 1 : 0,
      value.style === 'stroke' ? 1 : 0,
      value.strokeWidth,
      value.strokeMiterLimit,
      ['butt', 'round', 'square'].indexOf(value.strokeCap),
      ['miter', 'round', 'bevel'].indexOf(value.strokeJoin),
      blendModes.indexOf(value.blendMode),
    ]);
    this.paintIds.set(value, id);
    return id;
  }
  private addTable(words: number): void {
    if (
      this.paths.length + this.paints.length >= 65536 ||
      this.used + this.tableWords + words > 2 * 1024 * 1024
    )
      throw Error('Native scene table exceeds its entry/16MiB budget');
    this.tableWords += words;
  }
  rect(
    op: number,
    r: { x: number; y: number; width: number; height: number },
    a: number,
    b: number,
  ): void {
    const at = this.begin(op, 6),
      d = this.data;
    d[at] = r.x;
    d[at + 1] = r.y;
    d[at + 2] = r.width;
    d[at + 3] = r.height;
    d[at + 4] = a;
    d[at + 5] = b;
  }
  rounded(
    op: number,
    value: {
      readonly rrect?: { readonly values: readonly number[] };
      readonly rect?: { x: number; y: number; width: number; height: number };
      readonly radius?: number;
    },
    a: number,
    b?: number,
  ): void {
    const at = this.begin(op, op === 24 ? 15 : 14),
      d = this.data;
    d[at] = value.rrect ? 1 : 0;
    if (value.rrect) for (let i = 0; i < 12; i++) d[at + 1 + i] = value.rrect.values[i]!;
    else {
      const r = value.rect!;
      d[at + 1] = r.x;
      d[at + 2] = r.y;
      d[at + 3] = r.width;
      d[at + 4] = r.height;
      for (let i = 4; i < 12; i++) d[at + 1 + i] = value.radius!;
    }
    d[at + 13] = a;
    if (op === 24) d[at + 14] = b!;
  }
  ref(value: unknown): number {
    if (value == null) return -1;
    const known = this.ids.get(value);
    if (known !== undefined) return known;
    if (this.handles.length >= 65536) throw Error('Native scene handle budget exceeded');
    const id = this.handles.length;
    this.ids.set(value, id);
    this.handles.push(value);
    return id;
  }
  begin(op: number, count: number): number {
    const end = this.used + 2 + count;
    if (this.commands >= 65536 || end + this.tableWords > 2 * 1024 * 1024)
      throw Error('Native scene packet exceeds 16MiB');
    if (end > this.data.length) {
      const next = new Float64Array(Math.min(2 * 1024 * 1024, Math.max(end, this.data.length * 2)));
      next.set(this.data);
      this.data = next;
    }
    this.data[this.used] = op;
    this.data[this.used + 1] = count;
    const at = this.used + 2;
    this.used = end;
    this.commands++;
    return at;
  }
  one(op: number, a: number): void {
    const at = this.begin(op, 1);
    this.data[at] = a;
  }
  two(op: number, a: number, b: number): void {
    const at = this.begin(op, 2);
    this.data[at] = a;
    this.data[at + 1] = b;
  }
  three(op: number, a: number, b: number, c: number): void {
    const at = this.begin(op, 3);
    this.data[at] = a;
    this.data[at + 1] = b;
    this.data[at + 2] = c;
  }
  fill(
    shape: number,
    rect: { x: number; y: number; width: number; height: number },
    radius: number,
    color: number,
  ): void {
    const at = this.begin(22, 9),
      data = this.data;
    data[at] = shape;
    data[at + 1] = rect.x;
    data[at + 2] = rect.y;
    data[at + 3] = rect.width;
    data[at + 4] = rect.height;
    data[at + 5] = radius;
    data[at + 6] = radius;
    data[at + 7] = color >>> 0;
    data[at + 8] = 1;
  }
  submit(target: DisplayListTarget): void {
    this.data[0] = 0x4e4c444c;
    this.data[1] = this.batch ? 2 : displayListVersion;
    this.data[2] = this.commands;
    this.data[3] = this.handles.length;
    if (this.batch) {
      const out = new Float64Array(this.used + this.tableWords),
        token = this.frame.token,
        m = token.metrics;
      out.set(this.data.subarray(0, 16));
      out.set(
        [
          out.length,
          this.paths.length,
          this.paints.length,
          16 + this.tableWords,
          token.owner.generation,
          token.sequence,
          m.viewportGeneration,
          m.rendererGeneration,
          m.nativeContextGeneration ?? -1,
          m.nativeSurfaceGeneration ?? -1,
          m.scale,
          0,
        ],
        4,
      );
      let at = 16;
      for (const table of [this.paths, this.paints])
        for (const row of table) {
          out.set(row, at);
          at += row.length;
        }
      out.set(this.data.subarray(16, this.used), at);
      target.nelyxReplayDisplayList(out.buffer, this.handles);
    } else
      target.nelyxReplayDisplayList(
        this.data.buffer.slice(0, this.used * 8) as ArrayBuffer,
        this.handles,
      );
  }
  get byteLength(): number {
    return (this.used + this.tableWords) * 8;
  }
  clear(): void {
    this.handles.length = 0;
    this.ids.clear();
    this.paths.length = this.paints.length = 0;
    this.pathIds.clear();
    this.paintIds.clear();
    this.data = new Float64Array(0);
  }
}
function plainFill(value: PaintSnapshot): boolean {
  return (
    value.blendMode === 'srcOver' &&
    value.style === 'fill' &&
    value.isAntiAlias &&
    value.strokeWidth === 0 &&
    value.strokeCap === 'butt' &&
    value.strokeJoin === 'miter' &&
    value.strokeMiterLimit === 4 &&
    !value.shader &&
    !value.colorFilter &&
    !value.imageFilter &&
    !value.maskFilter &&
    (value.filterQuality ?? 'none') === 'none' &&
    !value.invertColors &&
    !value.dither
  );
}
/** Consume Core frame, retained picture and raster recordings directly. Generic
 * Canvas replay is reserved for hosts that explicitly lack this capability. */
export function submitNativeScene(
  api: Skia,
  target: DisplayListTarget,
  frame: PaintFrame,
  resources: GraphiteResources,
  programs = resources.runtimePrograms,
  diagnostics?: FrameDiagnostics,
): void {
  let diagnosticAt = diagnostics?.now();
  let pathsCount = 0,
    verbsCount = 0,
    clipsCount = 0,
    paintsCount = 0,
    nativePaintsCount = 0;
  const mode = resources.sceneBatch,
    batchPaths = mode === 'path' || mode === 'all',
    batchPaints = mode === 'paint' || mode === 'all';
  if (mode && api.nelyxScenePacketVersion?.() !== 2)
    throw Error('Native scene2 binding required; rebuild the native supplier');
  const packet = new ScenePacket(frame.commands.length, frame, !!mode),
    temporary: unknown[] = [],
    errors: unknown[] = [];
  const own = <T>(value: T): T => {
      temporary.push(value);
      return value;
    },
    rect = (value: { x: number; y: number; width: number; height: number }) =>
      own(api.XYWHRect(value.x, value.y, value.width, value.height));
  const fills = new Map<number, SkPaint>();
  let imagePaint: SkPaint | undefined;
  const style = (value: PaintSnapshot, backdrop = false) => {
    if (diagnostics) paintsCount++;
    if (
      batchPaints &&
      !backdrop &&
      !value.shader &&
      !value.colorFilter &&
      !value.imageFilter &&
      !value.maskFilter &&
      !value.invertColors &&
      !value.dither &&
      value.strokeMiterLimit <= 2147483647
    ) {
      if (diagnostics) nativePaintsCount++;
      return { id: packet.paint(value), filter: null };
    }
    const shared = !backdrop && plainFill(value);
    let paint = shared ? fills.get(value.color) : undefined;
    let filter: ReturnType<typeof applyPaintEffects> = null;
    if (!paint) {
      paint = own(api.Paint());
      if (shared) paint.setColor(api.Color(value.color));
      else {
        configurePaint(api, paint, value);
        filter = applyPaintEffects(api, paint, value, own, (key) => resources.image(key), programs);
        if (backdrop) paint.setImageFilter(null);
      }
      if (shared && fills.size < 64) fills.set(value.color, paint);
    }
    return { id: packet.ref(paint), filter };
  };
  const path = (value: PathSnapshot) => {
    if (diagnostics) pathsCount++;
    if (diagnostics) verbsCount += value.operations.length;
    return batchPaths ? packet.path(value) : packet.ref(own(createEnginePath(api, value)));
  };
  const rounded = (v: readonly number[]) => {
    const rect = own(api.XYWHRect(0, 0, 0, 0));
    rect.setLTRB(v[0]!, v[1]!, v[2]!, v[3]!);
    return {
      rect,
      topLeft: { x: v[4]!, y: v[5]! },
      topRight: { x: v[6]!, y: v[7]! },
      bottomRight: { x: v[8]!, y: v[9]! },
      bottomLeft: { x: v[10]!, y: v[11]! },
    };
  };
  try {
    for (const command of frame.commands) {
      if (
        diagnostics &&
        (command.op === 'clip' || command.op === 'clipRect' || command.op === 'clipRRect')
      )
        clipsCount++;
      if ('paint' in command) {
        const value = command.paint,
          primitive =
            command.op === 'drawRect' ||
            command.op === 'drawOval' ||
            command.op === 'drawRRect' ||
            command.op === 'drawLine' ||
            command.op === 'drawPath' ||
            command.op === 'drawPaint';
        if (
          primitive &&
          value.color >>> 24 === 0 &&
          value.blendMode === 'srcOver' &&
          !value.shader &&
          !value.colorFilter &&
          !value.imageFilter &&
          !value.maskFilter &&
          !value.invertColors
        )
          continue;
      }
      switch (command.op) {
        case 'save':
          packet.begin(0, 0);
          break;
        case 'restore':
          packet.begin(1, 0);
          break;
        case 'clear':
          packet.one(2, packet.ref(api.Color(command.color)));
          break;
        case 'rect':
        case 'rrect':
          packet.fill(
            command.op === 'rect' ? 0 : 2,
            command.rect,
            command.op === 'rect' ? 0 : command.radius,
            command.color,
          );
          break;
        case 'transform': {
          const at = packet.begin(13, 16),
            data = packet.data,
            matrix = command.matrix;
          if (matrix.length === 16) {
            for (let i = 0; i < 16; i++) data[at + i] = matrix[i]!;
          } else {
            // Inline the affine embedding in the existing column-major opcode.
            // No per-transform Matrix HostObject or temporary JS array.
            data[at] = matrix[0]!;
            data[at + 1] = matrix[1]!;
            data[at + 2] = 0;
            data[at + 3] = 0;
            data[at + 4] = matrix[2]!;
            data[at + 5] = matrix[3]!;
            data[at + 6] = 0;
            data[at + 7] = 0;
            data[at + 8] = 0;
            data[at + 9] = 0;
            data[at + 10] = 1;
            data[at + 11] = 0;
            data[at + 12] = matrix[4]!;
            data[at + 13] = matrix[5]!;
            data[at + 14] = 0;
            data[at + 15] = 1;
          }
          break;
        }
        case 'clip':
          if (batchPaints) packet.rect(23, command.rect, 1, 1);
          else packet.three(8, packet.ref(rect(command.rect)), 1, 1);
          break;
        case 'clipRect':
          if (batchPaints) {
            packet.rect(
              23,
              command.rect,
              command.clipOp === 'intersect' ? 1 : 0,
              command.doAntiAlias ? 1 : 0,
            );
            break;
          }
          packet.three(
            8,
            packet.ref(rect(command.rect)),
            command.clipOp === 'intersect' ? 1 : 0,
            command.doAntiAlias ? 1 : 0,
          );
          break;
        case 'clipRRect': {
          if (batchPaints) {
            packet.rounded(
              24,
              command,
              command.clipOp === 'intersect' ? 1 : 0,
              command.doAntiAlias ? 1 : 0,
            );
            break;
          }
          const r =
            'rrect' in command
              ? rounded(command.rrect.values)
              : own(api.RRectXY(rect(command.rect), command.radius, command.radius));
          packet.three(
            9,
            packet.ref(r),
            command.clipOp === 'intersect' ? 1 : 0,
            command.doAntiAlias ? 1 : 0,
          );
          break;
        }
        case 'drawRect':
        case 'drawOval': {
          if (plainFill(command.paint))
            packet.fill(command.op === 'drawRect' ? 0 : 1, command.rect, 0, command.paint.color);
          else if (batchPaints) {
            const at = packet.begin(25, 6),
              d = packet.data,
              r = command.rect;
            d[at] = command.op === 'drawRect' ? 0 : 1;
            d[at + 1] = r.x;
            d[at + 2] = r.y;
            d[at + 3] = r.width;
            d[at + 4] = r.height;
            d[at + 5] = style(command.paint).id;
          } else
            packet.two(
              command.op === 'drawRect' ? 4 : 5,
              packet.ref(rect(command.rect)),
              style(command.paint).id,
            );
          break;
        }
        case 'drawRRect': {
          if (batchPaints) {
            packet.rounded(26, command, style(command.paint).id);
            break;
          }
          const r =
            'rrect' in command
              ? rounded(command.rrect.values)
              : own(api.RRectXY(rect(command.rect), command.radius, command.radius));
          packet.two(6, packet.ref(r), style(command.paint).id);
          break;
        }
        case 'drawLine': {
          const paint = style(command.paint).id,
            at = packet.begin(7, 5),
            data = packet.data;
          data[at] = command.from.x;
          data[at + 1] = command.from.y;
          data[at + 2] = command.to.x;
          data[at + 3] = command.to.y;
          data[at + 4] = paint;
          break;
        }
        case 'drawPath':
          packet.two(10, path(command.path), style(command.paint).id);
          break;
        case 'clipPath':
          packet.three(
            11,
            path(command.path),
            command.clipOp === 'intersect' ? 1 : 0,
            command.doAntiAlias ? 1 : 0,
          );
          break;
        case 'drawShadow': {
          const shape = path(command.path),
            at = packet.begin(21, 5),
            data = packet.data;
          data[at] = shape;
          data[at + 1] = command.color >>> 0;
          data[at + 2] = command.elevation;
          data[at + 3] = command.transparentOccluder ? 1 : 0;
          data[at + 4] = command.devicePixelRatio;
          break;
        }
        case 'drawPaint':
          packet.one(3, style(command.paint).id);
          break;
        case 'saveLayer':
        case 'saveBackdropFilter': {
          const value = style(command.paint, command.op === 'saveBackdropFilter');
          packet.three(
            20,
            value.id,
            command.op === 'saveLayer' && command.bounds ? packet.ref(rect(command.bounds)) : -1,
            packet.ref(value.filter),
          );
          break;
        }
        case 'paragraph': {
          const paragraph = resources.paragraph(resourceKey(command.resource));
          if (!paragraph.nativeParagraph) throw Error('Native scene paragraph handle unavailable');
          packet.three(19, packet.ref(paragraph.nativeParagraph), command.x, command.y);
          break;
        }
        case 'drawPicture': {
          const picture = resources.picture?.(resourceKey(command.resource));
          if (!picture) throw Error('Stale native frame picture');
          packet.one(18, packet.ref(picture));
          break;
        }
        case 'image': {
          const image = resources.image(resourceKey(command.resource));
          if (!imagePaint) {
            imagePaint = own(api.Paint());
            imagePaint.setAntiAlias(true);
            imagePaint.setColor(api.Color(0xff000000));
          }
          const imageId = packet.ref(image),
            src = packet.ref(rect({ x: 0, y: 0, width: image.width(), height: image.height() })),
            dst = packet.ref(rect(command.rect)),
            paint = packet.ref(imagePaint),
            at = packet.begin(14, 4),
            data = packet.data;
          data[at] = imageId;
          data[at + 1] = src;
          data[at + 2] = dst;
          data[at + 3] = paint;
          break;
        }
        case 'drawImageRect':
        case 'drawImageNine': {
          const image = packet.ref(resources.image(resourceKey(command.resource))),
            src = packet.ref(rect(command.op === 'drawImageRect' ? command.src : command.center)),
            dst = packet.ref(rect(command.dst)),
            paint = style(command.paint).id,
            quality = command.paint.filterQuality ?? 'none',
            nine = command.op === 'drawImageNine',
            op = nine ? 17 : quality === 'high' ? 16 : 15,
            at = packet.begin(op, nine ? 5 : 6),
            data = packet.data;
          data[at] = image;
          data[at + 1] = src;
          data[at + 2] = dst;
          data[at + 3] = quality === 'high' && !nine ? 1 / 3 : quality === 'none' ? 0 : 1;
          if (!nine) data[at + 4] = quality === 'high' ? 1 / 3 : quality === 'medium' ? 2 : 0;
          data[at + (nine ? 4 : 5)] = paint;
          break;
        }
        default:
          throw Error(
            'Unsupported native scene command: ' + String((command as { op: string }).op),
          );
      }
    }
    if (diagnostics) {
      for (const [stage, count] of [
        ['scene-paths', pathsCount],
        ['scene-path-native', batchPaths ? pathsCount : 0],
        ['scene-path-verbs', verbsCount],
        ['scene-clips', clipsCount],
        ['scene-clip-native', batchPaints ? clipsCount : 0],
        ['scene-paints', paintsCount],
        ['scene-paint-native', nativePaintsCount],
        ['scene-wrappers', temporary.length],
      ] as const)
        diagnostics.recordDuration(frame.token, stage, 0, count);
      diagnosticAt = diagnostics.record(
        frame.token,
        'packet',
        diagnosticAt!,
        frame.commands.length,
        packet.byteLength,
      );
    }
    try {
      // The synchronous native call includes buffer copy, validation and replay.
      // Do not report this combined span as independent GPU execution time.
      packet.submit(target);
    } finally {
      if (diagnostics)
        diagnostics.record(
          frame.token,
          'native-replay',
          diagnosticAt!,
          frame.commands.length,
          packet.byteLength,
        );
    }
  } catch (error) {
    errors.push(error);
  } finally {
    packet.clear();
    for (let i = temporary.length - 1; i >= 0; i--)
      try {
        const value = temporary[i] as { dispose?: () => void };
        if (typeof value?.dispose === 'function') value.dispose();
      } catch (error) {
        errors.push(error);
      }
  }
  if (errors.length === 1) throw errors[0];
  if (errors.length)
    throw new AggregateError(errors, 'Native scene submission/temporary disposal failed');
}
