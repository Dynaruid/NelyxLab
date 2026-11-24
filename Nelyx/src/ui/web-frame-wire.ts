// SPDX-License-Identifier: BSD-3-Clause
import { invariant } from '../foundation/errors.ts';
import { freezeFrame, paintFrameLimits } from './frame.ts';
import { blendModes } from './paint.ts';
import type { PaintSnapshot, StrokeCap, StrokeJoin } from './paint.ts';
import { pathOperationArities, pathOperationNames } from './path.ts';
import type { PathSnapshot } from './path.ts';
import type { RRectValues } from './rrect-data.ts';
import { blurStyles, filterQualities, paintEffectLimits, tileModes } from './paint-effects-data.ts';
import type {
  ColorFilterSnapshot,
  ImageFilterSnapshot,
  ShaderSnapshot,
} from './paint-effects-data.ts';
import type {
  PaintCommand,
  PaintFrame,
  Rect,
  ResourceDescriptor,
  ResourceId,
  ViewOwner,
} from './types.ts';
import {
  maxWebFrameBytes,
  webFrameHeaderBytes,
  webFrameMagic,
  webFrameRecordBytes,
  webFrameWireVersion,
} from './web-frame-wire-format.ts';

export { maxWebFrameBytes, webFrameWireVersion } from './web-frame-wire-format.ts';

type Resolve = (id: number, generation: number, kind: ResourceDescriptor['kind']) => ResourceId;
interface Row {
  readonly op: number;
  readonly color: number;
  readonly flags: number;
  readonly id: number;
  readonly generation: number;
  readonly values: readonly number[];
}
type Read = (opcode?: number) => Row;

function check(condition: unknown, detail: string): asserts condition {
  invariant(condition, 'invalid-web-frame-wire', detail);
}
function boundedCount(value: number, maximum: number): number {
  check(Number.isInteger(value) && value >= 0 && value <= maximum, 'Invalid record count');
  return value;
}
function withMask(flags: number, mask: number): number {
  check((flags & mask) >>> 0 === flags, 'Invalid record flags');
  return flags;
}
function item<T>(values: readonly T[], index: number): T {
  const value = values[index];
  check(value !== undefined, 'Invalid record enum');
  return value;
}
function rect(values: readonly number[]): Rect {
  return { x: values[0]!, y: values[1]!, width: values[2]!, height: values[3]! };
}
function resource(row: Row, kind: ResourceDescriptor['kind'], resolve: Resolve): ResourceId {
  check(row.id > 0 && row.generation > 0, 'Invalid resource identity');
  return resolve(row.id, row.generation, kind);
}

function effects(header: Row, read: Read, resolve: Resolve): Partial<PaintSnapshot> {
  const flags = withMask(header.flags, 15);
  const matrix = (read: Read, length: number) => {
    const values: number[] = [];
    for (let offset = 0; offset < length; offset += 6) values.push(...read(30).values);
    return values.slice(0, length);
  };
  function colorFilter(read: Read, row: Row): ColorFilterSnapshot {
    switch (row.color) {
      case 10:
        return { kind: 'colorMode', color: row.id, blendMode: item(blendModes, row.flags) };
      case 11:
        return { kind: 'colorMatrix', matrix: matrix(read, 20) };
      case 12:
        return { kind: 'linearToSrgb' };
      case 13:
        return { kind: 'srgbToLinear' };
      default:
        throw new Error('Invalid Web color filter record');
    }
  }
  function imageFilter(read: Read, depth: number): ImageFilterSnapshot {
    check(depth <= paintEffectLimits.depth, 'Image filter depth exceeded');
    const row = read(28);
    switch (row.color) {
      case 20: {
        const flags = withMask(row.flags, 15);
        return {
          kind: 'blur',
          sigmaX: row.values[0]!,
          sigmaY: row.values[1]!,
          tileMode: (flags & 7) === 4 ? null : item(tileModes, flags & 7),
          bounds: flags & 8 ? rect(read(30).values) : null,
        };
      }
      case 21:
      case 22:
        return {
          kind: row.color === 21 ? 'dilate' : 'erode',
          radiusX: row.values[0]!,
          radiusY: row.values[1]!,
        };
      case 23:
        return {
          kind: 'matrix',
          matrix: matrix(read, 16),
          filterQuality: item(filterQualities, row.flags),
        };
      case 24:
        return {
          kind: 'compose',
          outer: imageFilter(read, depth + 1),
          inner: imageFilter(read, depth + 1),
        };
      default:
        return colorFilter(read, row);
    }
  }
  function shader(read: Read): ShaderSnapshot {
    const row = read(28);
    if (row.color === 4) {
      const flags = withMask(row.flags, 127);
      return {
        kind: 'image',
        image: resource(row, 'image', resolve),
        tileModeX: item(tileModes, flags & 3),
        tileModeY: item(tileModes, (flags >>> 2) & 3),
        filterQuality: flags >>> 4 === 4 ? null : item(filterQualities, flags >>> 4),
        matrix: matrix(read, 16),
      };
    }
    if (row.color === 5) {
      const length = boundedCount(row.id, 16384),
        packed = matrix(read, Math.ceil(length / 3));
      let source = '';
      for (const word of packed) {
        check(
          Number.isInteger(word) && word >= 0 && word <= 0xffffff,
          'Invalid shader source record',
        );
        source += String.fromCharCode(word & 255, (word >>> 8) & 255, word >>> 16);
      }
      return {
        kind: 'runtime',
        source: source.slice(0, length),
        uniforms: matrix(read, boundedCount(row.generation, 256)),
      };
    }
    const kind = item(['linear', 'radial', 'sweep'] as const, row.color - 1),
      flags = withMask(row.flags, 15),
      count = boundedCount(row.id, paintEffectLimits.colors),
      colors: number[] = [],
      stops: number[] = [];
    for (let i = 0; i < count; i++) {
      const stop = read(29);
      colors.push(stop.color);
      stops.push(stop.values[0]!);
    }
    return {
      kind,
      colors,
      stops: flags & 8 ? null : stops,
      tileMode: item(tileModes, flags & 3),
      points: row.values.slice(0, kind === 'radial' ? 6 : 4),
      matrix: flags & 4 ? matrix(read, 16) : null,
    };
  }
  // Section sizes prevent an effect parser from consuming following commands.
  function section<T>(index: number, parse: (reader: Read) => T): T | null {
    let remaining = boundedCount(header.values[index]!, paintFrameLimits.commands);
    if (!remaining) return null;
    const value = parse((op) => {
      check(remaining-- > 0, 'Paint effect exceeds its declared length');
      return read(op);
    });
    check(remaining === 0, 'Paint effect has unused records');
    return value;
  }
  return {
    shader: section(0, shader),
    colorFilter: section(1, (read) => colorFilter(read, read(28))),
    imageFilter: section(2, (read) => imageFilter(read, 0)),
    maskFilter: section(3, (read) => {
      const row = read(28);
      check(row.color === 30, 'Invalid mask filter record');
      return { sigma: row.values[0]!, style: item(blurStyles, row.flags) };
    }),
    filterQuality: item(filterQualities, flags & 3),
    invertColors: !!(flags & 4),
    dither: !!(flags & 8),
  };
}

/** Decode the command records shared with native encoding using Web scalar precision. */
export function decodeWebFrame(bytes: Uint8Array, owner: ViewOwner, resolve: Resolve): PaintFrame {
  check(
    bytes.byteLength >= webFrameHeaderBytes && bytes.byteLength <= maxWebFrameBytes,
    'Web packet length',
  );
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const uint = (offset: number) => view.getUint32(offset, true),
    number = (offset: number) => view.getFloat64(offset, true);
  const records = uint(12);
  check(
    uint(0) === webFrameMagic &&
      uint(4) === webFrameWireVersion &&
      uint(8) === bytes.byteLength &&
      webFrameHeaderBytes + records * webFrameRecordBytes === bytes.byteLength &&
      number(16) === owner.generation,
    'Web packet header or owner mismatch',
  );
  const context = number(48),
    surface = number(56);
  const token = {
    owner,
    sequence: number(24),
    metrics: {
      viewportGeneration: number(32),
      rendererGeneration: number(40),
      nativeContextGeneration: context === 0 ? null : context,
      nativeSurfaceGeneration: surface === 0 ? null : surface,
      physicalWidth: number(64),
      physicalHeight: number(72),
      logicalWidth: number(80),
      logicalHeight: number(88),
      scale: number(96),
    },
  };
  let offset = webFrameHeaderBytes;
  const read: Read = (expected) => {
    check(offset < bytes.byteLength, 'Truncated command record');
    const at = offset;
    offset += webFrameRecordBytes;
    const op = uint(at),
      generation = number(at + 16);
    check(expected === undefined || op === expected, 'Unexpected command opcode');
    const values = Array.from({ length: 6 }, (_, index) => number(at + 24 + index * 8));
    check(
      values.every(Number.isFinite) && Number.isSafeInteger(generation) && generation >= 0,
      'Invalid record data',
    );
    return { op, color: uint(at + 4), flags: uint(at + 8), id: uint(at + 12), generation, values };
  };
  const peek = () => (offset < bytes.byteLength ? uint(offset) : undefined);
  function path(fill: boolean, count: number): PathSnapshot {
    const operations: PathSnapshot['operations'][number][] = [];
    for (let i = 0, length = boundedCount(count, paintFrameLimits.commands); i < length; i++) {
      const row = read(23),
        verb = item(pathOperationNames, row.color - 1);
      const values =
        verb === 'addRRect'
          ? [...row.values, ...read(26).values]
          : row.values.slice(0, pathOperationArities[verb]);
      operations.push({ verb, values });
    }
    return { fillType: fill ? 'evenOdd' : 'nonZero', operations };
  }
  const rounded = (row: Row) => ({
    values: [...row.values, ...read(26).values] as unknown as RRectValues,
  });
  function clip(flags: number) {
    withMask(flags, 3);
    return {
      clipOp: flags & 2 ? ('difference' as const) : ('intersect' as const),
      doAntiAlias: !!(flags & 1),
    };
  }
  const caps: readonly StrokeCap[] = ['butt', 'round', 'square'],
    joins: readonly StrokeJoin[] = ['miter', 'round', 'bevel'];
  function paint(row: Row): PaintSnapshot {
    return {
      color: row.color,
      style: row.flags & 1 ? 'stroke' : 'fill',
      strokeCap: item(caps, (row.flags >>> 1) & 3),
      strokeJoin: item(joins, (row.flags >>> 3) & 3),
      isAntiAlias: !!(row.flags & 32),
      blendMode: item(blendModes, row.flags >>> 6),
      strokeWidth: row.values[0]!,
      strokeMiterLimit: row.values[1]!,
      ...(peek() === 27 ? effects(read(27), read, resolve) : {}),
    };
  }
  function command(row: Row, style?: PaintSnapshot): PaintCommand {
    const { op, color, flags, values: v } = row;
    const painted = [11, 12, 13, 14, 15, 21, 24, 31, 33, 37, 38].includes(op);
    check(painted === !!style, 'Missing or unexpected paint record');
    switch (op) {
      case 1:
        return { op: 'clear', color };
      case 2:
        return { op: 'save' };
      case 3:
        return { op: 'restore' };
      case 4:
        return { op: 'transform', matrix: v };
      case 5:
        return { op: 'clip', rect: rect(v) };
      case 6:
        return { op: 'rect', rect: rect(v), color };
      case 7:
        return { op: 'rrect', rect: rect(v), radius: v[4]!, color };
      case 8:
        return { op: 'image', rect: rect(v), resource: resource(row, 'image', resolve) };
      case 9:
        return {
          op: 'paragraph',
          x: v[0]!,
          y: v[1]!,
          resource: resource(row, 'paragraph', resolve),
        };
      case 11:
        return { op: 'drawRect', rect: rect(v), paint: style! };
      case 12:
        return { op: 'drawRRect', rect: rect(v), radius: v[4]!, paint: style! };
      case 13:
        return { op: 'drawOval', rect: rect(v), paint: style! };
      case 14:
        return {
          op: 'drawLine',
          from: { x: v[0]!, y: v[1]! },
          to: { x: v[2]!, y: v[3]! },
          paint: style!,
        };
      case 15:
        return { op: 'saveLayer', bounds: withMask(flags, 1) ? rect(v) : null, paint: style! };
      case 16:
        return { op: 'clipRect', rect: rect(v), ...clip(flags) };
      case 17:
        return { op: 'clipRRect', rect: rect(v), radius: v[4]!, ...clip(flags) };
      case 18:
        return {
          op: 'transform',
          matrix: [...v, ...read(19).values, ...read(20).values.slice(0, 4)],
        };
      case 21:
        return { op: 'drawPath', path: path(!!withMask(color, 1), row.generation), paint: style! };
      case 22:
        return { op: 'clipPath', path: path(!!withMask(color, 1), row.generation), ...clip(flags) };
      case 24:
        return { op: 'drawRRect', rrect: rounded(row), paint: style! };
      case 25:
        return { op: 'clipRRect', rrect: rounded(row), ...clip(flags) };
      case 31:
      case 33: {
        const image = resource(row, 'image', resolve),
          quality = item(filterQualities, flags),
          dst = rect(read(op === 31 ? 32 : 34).values);
        check((style!.filterQuality ?? 'none') === quality, 'Image sampling does not match paint');
        return op === 31
          ? { op: 'drawImageRect', src: rect(v), dst, resource: image, paint: style! }
          : { op: 'drawImageNine', center: rect(v), dst, resource: image, paint: style! };
      }
      case 35:
        return { op: 'drawPicture', resource: resource(row, 'picture', resolve) };
      case 36:
        withMask(flags, 3);
        return {
          op: 'drawShadow',
          path: path(!!(flags & 2), row.id),
          color,
          elevation: v[0]!,
          devicePixelRatio: v[1]!,
          transparentOccluder: !!(flags & 1),
        };
      case 37:
        return { op: 'drawPaint', paint: style! };
      case 38:
        return { op: 'saveBackdropFilter', paint: style! };
      default:
        throw new Error('Unknown Web frame opcode ' + op);
    }
  }
  const commands: PaintCommand[] = [];
  while (offset < bytes.byteLength) {
    const row = read();
    if (row.op === 10) {
      const style = paint(row);
      commands.push(command(read(), style));
    } else commands.push(command(row));
  }
  return freezeFrame(token, commands);
}
