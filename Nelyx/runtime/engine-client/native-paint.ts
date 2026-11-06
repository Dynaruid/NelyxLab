// SPDX-License-Identifier: BSD-3-Clause
import type { NativePaintEntry, NativePaintScalar } from '@nelyx/core/framework/rendering/object';
import type { NodeHandle, AffineMatrix } from './codec.ts';
import { protocol as p } from './schema.ts';
export interface NativePaintOptions extends Omit<NativePaintEntry, 'reference'> {
  readonly reference?: NodeHandle | (() => NodeHandle | null);
  readonly fillParent?: boolean;
}
export interface NativePaintSnapshot extends Omit<NativePaintOptions, 'reference'> {
  readonly reference: NodeHandle;
  readonly width: number;
  readonly height: number;
  readonly cx: number;
  readonly cy: number;
  readonly resolvedRadius: number;
  readonly transform: AffineMatrix;
  readonly points: readonly { readonly x: number; readonly y: number }[];
}
const kinds = [
  'physical',
  'border',
  'highlight',
  'ripple',
  'checkbox',
  'mark',
  'circle',
  'shape',
  'shadow',
  'clip',
  'hitRegion',
  'elevationShadow',
  'save',
  'restore',
] as const;
const geometryKinds = [
  'none',
  'switchTrack',
  'switchThumb',
  'switchReaction',
  'switchOnLabel',
  'switchOffLabel',
  'linear',
  'program',
] as const;
const shapes = ['rrect', 'stadium', 'circle'] as const;
const clips = ['none', 'hardEdge', 'antiAlias', 'antiAliasWithSaveLayer'] as const;
const finite = (n: number) => {
  if (!Number.isFinite(n)) throw Error('Non-finite native paint value');
  return n;
};
const noExpression = 0xffffffff;
const operationArity = [0, 0, 0, 0, 2, 2, 2, 2, 2, 2, 3, 2, 2, 2, 2, 2, 3];
class Expressions {
  readonly nodes: { op: number; args: number[]; value: number }[] = [];
  private readonly objects = new WeakMap<object, number>();
  private readonly active = new WeakSet<object>();
  private readonly constants = new Map<string, number>();
  add(value: NativePaintScalar): number {
    const constant = typeof value === 'number',
      key = constant ? (Object.is(value, -0) ? '-0' : String(value)) : '';
    const previous = constant ? this.constants.get(key) : this.objects.get(value);
    if (previous !== undefined) return previous;
    if (!constant && this.active.has(value)) throw Error('Cyclic native paint expression');
    if (!constant) this.active.add(value);
    const op = constant ? 0 : p.nativePaintOperations[value.op],
      args = constant ? [] : (value.args ?? []);
    if (op === undefined || args.length !== operationArity[op])
      throw Error('Invalid native paint expression operation');
    const operands = args.map((v) => this.add(v));
    if (this.nodes.length >= p.limits.nativePaintExpressions)
      throw RangeError('Native paint expression budget');
    const index = this.nodes.length;
    this.nodes.push({ op, args: operands, value: constant ? finite(value) : 0 });
    if (constant) this.constants.set(key, index);
    else {
      this.active.delete(value);
      this.objects.set(value, index);
    }
    return index;
  }
}
export function nativePaintBody(entries: readonly NativePaintOptions[]): Uint8Array {
  if (entries.length > p.limits.nativePaintEntries) throw RangeError('Native paint entry budget');
  const expressions = new Expressions();
  const programs = entries.map((entry) => {
    const g = entry.geometry;
    if (g?.kind !== 'program') return;
    if (g.rect.length !== 4 || (g.radii && g.radii.length !== 8))
      throw Error('Invalid native paint program fields');
    const refs = [
      ...g.rect.map((v) => expressions.add(v)),
      ...Array.from({ length: 8 }, (_, i) =>
        g.radii ? expressions.add(g.radii[i]!) : noExpression,
      ),
      g.visible === undefined ? noExpression : expressions.add(g.visible),
      g.color === undefined ? noExpression : expressions.add(g.color),
    ];
    const repeat = g.repeat ?? 1;
    if (!Number.isInteger(repeat) || !Number.isFinite(repeat) || repeat < 0)
      throw Error('Invalid native paint repeat count');
    return { refs, repeat };
  });
  const expressionAt = p.nativePaintHeaderBytes + entries.length * p.nativePaintBytes;
  const bytes = new Uint8Array(
      expressionAt + expressions.nodes.length * p.nativePaintExpressionBytes,
    ),
    v = new DataView(bytes.buffer);
  v.setUint32(0, entries.length, true);
  v.setUint32(8, expressions.nodes.length, true);
  expressions.nodes.forEach((node, index) => {
    const at = expressionAt + index * p.nativePaintExpressionBytes;
    v.setUint32(at, node.op, true);
    node.args.forEach((arg, i) => v.setUint32(at + 4 + i * 4, arg, true));
    v.setFloat64(at + 16, node.value, true);
  });
  entries.forEach((entry, index) => {
    const at = p.nativePaintHeaderBytes + index * p.nativePaintBytes,
      reference = typeof entry.reference === 'function' ? entry.reference() : entry.reference;
    if (entry.kind === 'ripple' || entry.kind === 'highlight') {
      if (!reference) throw Error('Native ink reference is not mounted');
    }
    v.setUint32(at, kinds.indexOf(entry.kind) + 1, true);
    v.setUint32(
      at + 4,
      (entry.contained ? 1 : 0) |
        (entry.center ? 2 : 0) |
        (entry.circular ? 4 : 0) |
        (entry.customClip ? 8 : 0) |
        (entry.fillParent ? 16 : 0) |
        (entry.dash ? 32 : 0) |
        (entry.transparentOccluder ? 64 : 0),
      true,
    );
    v.setUint32(at + 8, entry.color, true);
    v.setUint32(at + 12, entry.shadowColor ?? 0, true);
    v.setUint32(at + 16, reference?.slot ?? 0, true);
    v.setUint32(at + 20, reference?.generation ?? 0, true);
    v.setUint32(at + 24, shapes.indexOf(entry.shape.kind), true);
    v.setUint32(at + 28, clips.indexOf(entry.clip ?? 'none'), true);
    v.setUint32(at + 32, entry.shape.strokeColor, true);
    const values = [
      entry.elevation ?? 0,
      entry.shape.strokeWidth,
      entry.shape.strokeAlign,
      entry.x ?? 0,
      entry.y ?? 0,
      entry.radius ?? -1,
      entry.progress ?? (entry.kind === 'circle' ? 1 : 0),
      ...entry.shape.radii,
    ];
    if (entry.shape.radii.length !== 8) throw Error('Native shape needs eight corner radii');
    values.forEach((value, i) => v.setFloat64(at + 40 + i * 8, finite(value), true));
    const geometry = entry.geometry;
    const legacy =
      geometry?.kind === 'linear' || geometry?.kind === 'program' ? undefined : geometry;
    v.setUint32(at + 256, geometry ? geometryKinds.indexOf(geometry.kind) + 0 : 0, true);
    v.setUint32(at + 260, legacy?.rtl ? 1 : 0, true);
    [
      legacy?.trackWidth ?? 0,
      legacy?.trackHeight ?? 0,
      legacy?.thumbWidth ?? 0,
      legacy?.thumbHeight ?? 0,
      legacy?.extension ?? 0,
      legacy?.position ?? 0,
      legacy?.inset ?? 0,
      entry.blurSigma ?? 0,
      entry.spread ?? 0,
    ].forEach((value, i) => v.setFloat64(at + 264 + i * 8, finite(value), true));
    if (geometry?.kind === 'linear') {
      if (geometry.rect.length !== 8)
        throw Error('Native linear geometry needs eight coefficients');
      geometry.rect.forEach((value, i) => v.setFloat64(at + 336 + i * 8, finite(value), true));
    }
    const program = programs[index];
    if (program) {
      program.refs.forEach((ref, i) => v.setUint32(at + 400 + i * 4, ref, true));
      v.setFloat64(at + 456, program.repeat, true);
    }
  });
  return bytes;
}
export function readNativePaint(bytes: Uint8Array): readonly NativePaintSnapshot[] {
  const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength),
    count = v.getUint32(0, true);
  if (
    bytes.length < p.nativePaintHeaderBytes ||
    count > (v.getUint32(4, true) ? p.limits.nativePaintDraws : p.limits.nativePaintEntries) ||
    v.getUint32(4, true) > 1 ||
    v.getUint32(8, true) > p.limits.nativePaintExpressions ||
    v.getUint32(12, true) ||
    bytes.length !==
      p.nativePaintHeaderBytes +
        count * p.nativePaintBytes +
        v.getUint32(8, true) * p.nativePaintExpressionBytes
  )
    throw Error('Invalid native paint snapshot');
  const expressions: NativePaintScalar[] = [];
  const expressionAt = p.nativePaintHeaderBytes + count * p.nativePaintBytes;
  const names = Object.keys(p.nativePaintOperations) as (keyof typeof p.nativePaintOperations)[];
  for (let i = 0; i < v.getUint32(8, true); i++) {
    const at = expressionAt + i * p.nativePaintExpressionBytes,
      op = v.getUint32(at, true),
      arity = operationArity[op];
    if (arity === undefined) throw Error('Invalid native paint expression');
    const args: NativePaintScalar[] = [];
    for (let j = 0; j < 3; j++) {
      const ref = v.getUint32(at + 4 + j * 4, true);
      if (j < arity) {
        if (ref >= i) throw Error('Forward native paint expression');
        args.push(expressions[ref]!);
      } else if (ref) throw Error('Unused native paint operand');
    }
    const value = finite(v.getFloat64(at + 16, true));
    if (op && value) throw Error('Unused native paint constant');
    expressions.push(
      op
        ? { op: names[op] as Exclude<keyof typeof p.nativePaintOperations, 'constant'>, args }
        : value,
    );
  }
  return Object.freeze(
    Array.from({ length: count }, (_, index) => {
      const at = p.nativePaintHeaderBytes + index * p.nativePaintBytes,
        flags = v.getUint32(at + 4, true),
        f = (offset: number) => finite(v.getFloat64(at + offset, true)),
        kind = kinds[v.getUint32(at, true) - 1],
        shape = shapes[v.getUint32(at + 24, true)],
        clip = clips[v.getUint32(at + 28, true)];
      if (!kind || !shape || !clip || flags & ~127 || v.getUint32(at + 36, true) || f(248))
        throw Error('Invalid native paint entry');
      if (
        (flags & 32 && kind !== 'mark') ||
        (kind === 'mark' && v.getUint32(4, true) && f(144) !== 2 && f(144) !== 3)
      )
        throw Error('Invalid native mark');
      const geometryKind = geometryKinds[v.getUint32(at + 256, true)],
        geometryFlags = v.getUint32(at + 260, true);
      if (!geometryKind || geometryFlags > 1) throw Error('Invalid native paint geometry');
      return Object.freeze({
        kind,
        color: v.getUint32(at + 8, true),
        shadowColor: v.getUint32(at + 12, true),
        reference: Object.freeze({
          slot: v.getUint32(at + 16, true),
          generation: v.getUint32(at + 20, true),
        }),
        shape: Object.freeze({
          kind: shape,
          strokeColor: v.getUint32(at + 32, true),
          strokeWidth: f(48),
          strokeAlign: f(56),
          radii: Object.freeze(Array.from({ length: 8 }, (_, i) => f(96 + i * 8))),
        }),
        elevation: f(40),
        x: f(64),
        y: f(72),
        radius: f(80),
        progress: f(88),
        clip,
        contained: !!(flags & 1),
        center: !!(flags & 2),
        circular: !!(flags & 4),
        customClip: !!(flags & 8),
        fillParent: !!(flags & 16),
        dash: !!(flags & 32),
        transparentOccluder: !!(flags & 64),
        ...(geometryKind === 'none'
          ? {}
          : geometryKind === 'program'
            ? {
                geometry: Object.freeze(
                  (() => {
                    const ref = (
                      offset: number,
                      optional = false,
                    ): NativePaintScalar | undefined => {
                      const index = v.getUint32(at + offset, true);
                      if (optional && index === noExpression) return;
                      if (index >= expressions.length)
                        throw Error('Invalid native paint expression reference');
                      return expressions[index]!;
                    };
                    const radii = Array.from({ length: 8 }, (_, i) => ref(416 + i * 4, true)),
                      visible = ref(448, true),
                      color = ref(452, true);
                    return {
                      kind: 'program' as const,
                      rect: [ref(400)!, ref(404)!, ref(408)!, ref(412)!] as const,
                      ...(radii.every((r) => r === undefined)
                        ? {}
                        : { radii: radii.map((r, i) => r ?? f(96 + i * 8)) }),
                      ...(visible === undefined ? {} : { visible }),
                      ...(color === undefined ? {} : { color }),
                      repeat: f(456),
                    };
                  })(),
                ),
              }
            : geometryKind === 'linear'
              ? {
                  geometry: Object.freeze({
                    kind: 'linear' as const,
                    rect: Object.freeze(
                      Array.from({ length: 8 }, (_, i) => f(336 + i * 8)),
                    ) as unknown as readonly [
                      number,
                      number,
                      number,
                      number,
                      number,
                      number,
                      number,
                      number,
                    ],
                  }),
                }
              : {
                  geometry: Object.freeze({
                    kind: geometryKind,
                    rtl: !!geometryFlags,
                    trackWidth: f(264),
                    trackHeight: f(272),
                    thumbWidth: f(280),
                    thumbHeight: f(288),
                    extension: f(296),
                    position: f(304),
                    inset: f(312),
                  }),
                }),
        blurSigma: f(320),
        spread: f(328),
        width: f(160),
        height: f(168),
        cx: f(176),
        cy: f(184),
        resolvedRadius: f(192),
        transform: Object.freeze(
          Array.from({ length: 6 }, (_, i) => f(200 + i * 8)),
        ) as unknown as AffineMatrix,
        points: Object.freeze(
          kind === 'mark' && v.getUint32(4, true)
            ? Array.from({ length: f(144) }, (_, i) =>
                Object.freeze({ x: f(96 + i * 16), y: f(104 + i * 16) }),
              )
            : [],
        ),
      });
    }),
  );
}
