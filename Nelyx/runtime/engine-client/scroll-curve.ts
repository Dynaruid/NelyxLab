// SPDX-License-Identifier: BSD-3-Clause
import { protocol as p } from './schema.ts';
import type { NativeCurveConfiguration } from '@nelyx/core/framework/animation/curves';
export type ScrollCurve = NativeCurveConfiguration;
type Node = { kind: number; first: number; second: number; values: readonly number[] };
const none = 0xffff_ffff;
function compile(curve: ScrollCurve): { nodes: Node[]; captured: ScrollCurve } {
  const nodes: Node[] = [],
    active = new Set<ScrollCurve>();
  const number = (value: number) => {
    if (!Number.isFinite(value) || Math.abs(value) > 1e12)
      throw RangeError('Invalid native scroll curve number');
    return value;
  };
  const read = (value: ScrollCurve, depth = 0): { index: number; value: ScrollCurve } => {
    if (
      !value ||
      depth >= p.limits.scrollCurveDepth ||
      active.has(value) ||
      nodes.length >= p.limits.scrollCurveNodes
    )
      throw RangeError('Native scroll curve composition exceeds its bound');
    active.add(value);
    try {
      const kind = p.scrollCurveKinds[value.kind];
      if (!kind) throw RangeError('Invalid native scroll curve kind');
      let first = none,
        second = none,
        values: number[] = [],
        captured: ScrollCurve;
      const child = (curve: ScrollCurve) => read(curve, depth + 1);
      switch (value.kind) {
        case 'cubic':
          values = [value.a, value.b, value.c, value.d].map(number);
          captured = {
            kind: value.kind,
            a: values[0]!,
            b: values[1]!,
            c: values[2]!,
            d: values[3]!,
          };
          break;
        case 'split': {
          const x = number(value.x),
            y = number(value.y);
          if (x < 0 || x > 1) throw RangeError('Invalid native scroll curve split');
          const a = child(value.first),
            b = child(value.second);
          first = a.index;
          second = b.index;
          values = [x, y];
          captured = { kind: value.kind, x, y, first: a.value, second: b.value };
          break;
        }
        case 'interval': {
          const begin = number(value.begin),
            end = number(value.end);
          if (begin < 0 || end > 1 || begin >= end)
            throw RangeError('Invalid native scroll curve interval');
          const a = child(value.curve);
          first = a.index;
          values = [begin, end];
          captured = { kind: value.kind, begin, end, curve: a.value };
          break;
        }
        case 'flipped': {
          const a = child(value.curve);
          first = a.index;
          captured = { kind: value.kind, curve: a.value };
          break;
        }
        case 'threshold': {
          const threshold = number(value.threshold);
          if (threshold < 0 || threshold > 1)
            throw RangeError('Invalid native scroll curve threshold');
          values = [threshold];
          captured = { kind: value.kind, threshold };
          break;
        }
        case 'sawTooth': {
          const count = number(value.count);
          values = [count];
          captured = { kind: value.kind, count };
          break;
        }
        case 'elasticIn':
        case 'elasticOut':
        case 'elasticInOut': {
          const period = number(value.period);
          if (Math.abs(period) < 1e-6)
            throw RangeError('Invalid native scroll curve elastic period');
          values = [period];
          captured = { kind: value.kind, period };
          break;
        }
        default:
          captured = { kind: value.kind };
      }
      if (nodes.length >= p.limits.scrollCurveNodes)
        throw RangeError('Native scroll curve composition exceeds its bound');
      const index = nodes.length;
      nodes.push({ kind, first, second, values });
      return { index, value: Object.freeze(captured) };
    } finally {
      active.delete(value);
    }
  };
  return { nodes, captured: read(curve).value };
}
/** Copy every numeric input and child before an asynchronous command can wait. */
export function captureScrollCurve(curve: ScrollCurve): ScrollCurve {
  return compile(curve).captured;
}
/** Optional tail after the legacy 56-byte scroll body. */
export function scrollCurveBytes(curve: ScrollCurve): Uint8Array {
  const { nodes } = compile(curve),
    bytes = new Uint8Array(p.scrollCurveHeaderBytes + nodes.length * p.scrollCurveNodeBytes),
    v = new DataView(bytes.buffer);
  v.setUint32(0, nodes.length, true);
  v.setUint32(4, nodes.length - 1, true);
  nodes.forEach((node, i) => {
    const at = p.scrollCurveHeaderBytes + i * p.scrollCurveNodeBytes;
    v.setUint32(at, node.kind, true);
    v.setUint32(at + 4, node.first, true);
    v.setUint32(at + 8, node.second, true);
    node.values.forEach((value, j) => v.setFloat64(at + 16 + j * 8, value, true));
  });
  return bytes;
}
