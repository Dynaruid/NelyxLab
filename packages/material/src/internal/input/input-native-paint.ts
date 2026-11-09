// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Source border policy on generic Content expressions and conditional path commands.
import type {
  NativePaintEntry,
  NativePaintScalar as Scalar,
  NativePaintPathSegment,
  NativePaintPath,
  RenderBox,
} from '@nelyx/core/framework/rendering/object';
import { InputBorder, OutlineInputBorder, UnderlineInputBorder } from '../../input-border.ts';
import type { DecorationBorderConfiguration } from './input-decorator-layout.ts';
import { inputPaintValues } from './input-native-layout.ts';

export function nativeInputBorderPaint(
  c: DecorationBorderConfiguration,
  reference?: RenderBox,
): readonly NativePaintEntry[] {
  const border = c.border,
    prototype = Object.getPrototypeOf(border),
    none = border === InputBorder.none;
  if (
    !none &&
    prototype !== OutlineInputBorder.prototype &&
    prototype !== UnderlineInputBorder.prototype
  )
    throw Error('native custom input border');
  if (
    ['paint', 'getOuterPath', 'getInnerPath', 'paintInterior'].some((name) =>
      Object.hasOwn(border, name),
    )
  )
    throw Error('native instance input border hook');
  const e = (op: Exclude<Scalar, number>['op'], ...args: Scalar[]): Scalar => ({ op, args }),
    add = (a: Scalar, b: Scalar) => e('add', a, b),
    sub = (a: Scalar, b: Scalar) => e('subtract', a, b),
    mul = (a: Scalar, b: Scalar) => e('multiply', a, b),
    div = (a: Scalar, b: Scalar) => e('divide', a, b),
    value = (index: number): Scalar => ({ op: 'layoutValue', index }),
    width: Scalar = reference ? value(inputPaintValues.width) : { op: 'width' },
    height: Scalar = reference ? value(inputPaintValues.height) : { op: 'height' },
    x: Scalar = reference ? value(inputPaintValues.x) : 0,
    gapStart = reference ? value(inputPaintValues.gapStart) : -1,
    gapExtent = reference ? value(inputPaintValues.gapExtent) : 0,
    radius = none
      ? null
      : (border as OutlineInputBorder | UnderlineInputBorder).borderRadius.resolve(c.direction);
  const corners = radius
      ? [radius.topLeft, radius.topRight, radius.bottomRight, radius.bottomLeft].flatMap(
          (corner) => [corner.x, corner.y],
        )
      : Array<number>(8).fill(0),
    emptyShape = {
      kind: 'rrect' as const,
      radii: corners,
      strokeColor: 0,
      strokeWidth: 0,
      strokeAlign: 0,
    },
    geometry = { kind: 'program' as const, rect: [x, 0, width, height] as const },
    entries: NativePaintEntry[] = [];
  if (c.fill >>> 24)
    entries.push({
      kind: 'shape',
      color: c.fill,
      shape: emptyShape,
      geometry,
      ...(reference ? { reference } : {}),
    });
  const side = border.borderSide;
  if (none || side.style === 'none' || !(side.color >>> 24)) return entries;
  const shape = {
    ...emptyShape,
    strokeColor: side.color,
    strokeWidth: side.width,
    strokeAlign: side.strokeAlign,
  };
  const path = (commands: NativePaintPath['commands'], visible?: Scalar) =>
    entries.push({
      kind: 'path',
      color: 0,
      shape: { ...shape, radii: Array<number>(8).fill(0), strokeAlign: 0 },
      geometry: { ...geometry, ...(visible === undefined ? {} : { visible }) },
      path: { commands },
      ...(reference ? { reference } : {}),
    });
  if (prototype === UnderlineInputBorder.prototype) {
    if (corners.slice(4).some((radius) => radius !== 0))
      throw Error('native curved underline input border');
    path([
      ['move', 0, sub(height, side.width / 2)],
      ['line', width, sub(height, side.width / 2)],
    ]);
    return entries;
  }
  if (corners.some((radius, i) => i % 2 === 1 && radius !== corners[i - 1]))
    throw Error('native elliptical outline input border');
  if (!Number.isFinite(c.progress) || c.progress < 0 || c.progress > 1)
    throw Error('native input gap progress');
  const gap =
    c.progress === 0 ? 0 : mul(e('greaterEqual', gapStart, 0), e('greater', gapExtent, 0));
  entries.push({
    kind: 'border',
    color: 0,
    shape,
    geometry: { ...geometry, visible: e('equal', gap, 0) },
    ...(reference ? { reference } : {}),
  });
  if (c.progress === 0 || !reference) return entries;
  const offset = side.strokeOffset / 2,
    left = -offset,
    top = -offset,
    right = add(width, offset),
    bottom = add(height, offset),
    cw = add(width, 2 * offset),
    ch = add(height, 2 * offset),
    raw = corners.filter((_, i) => i % 2 === 0).map((r) => Math.max(0, r + offset));
  let scale: Scalar = 1;
  for (const [extent, total] of [
    [cw, raw[0]! + raw[1]!],
    [cw, raw[3]! + raw[2]!],
    [ch, raw[0]! + raw[3]!],
    [ch, raw[1]! + raw[2]!],
  ] as const)
    if (total > 0) scale = e('min', scale, div(e('max', 0, extent), total));
  const [tl, tr, br, bl] = raw.map((r) => mul(r, scale)),
    extent = mul(add(gapExtent, (border as OutlineInputBorder).gapPadding * 2), c.progress),
    start = e(
      'max',
      0,
      c.direction === 'rtl'
        ? sub(add(gapStart, (border as OutlineInputBorder).gapPadding), extent)
        : sub(gapStart, (border as OutlineInputBorder).gapPadding),
    ),
    end = add(start, extent),
    fullTR = e('less', end, sub(width, tr!)),
    partialTR = mul(e('greaterEqual', end, sub(width, tr!)), e('less', end, width)),
    positive = (r: Scalar) => e('greater', r, 0),
    commands: NativePaintPath['commands'][number][] = [],
    when = (condition: Scalar, command: NativePaintPathSegment) =>
      commands.push({ when: condition, command }),
    arc = (
      rx: Scalar,
      ry: Scalar,
      r: Scalar,
      startAngle: Scalar,
      sweep: Scalar,
    ): NativePaintPathSegment => ['arc', rx, ry, mul(r, 2), mul(r, 2), startAngle, sweep, 1];
  when(
    positive(tl!),
    arc(left, top, tl!, Math.PI, e('acos', e('clamp', sub(1, div(start, tl!)), 0, 1))),
  );
  when(e('equal', tl!, 0), ['move', left + offset, top]);
  when(e('greater', start, tl!), ['line', start, top]);
  when(fullTR, ['move', end, top]);
  when(fullTR, ['line', sub(right, tr!), top]);
  when(
    mul(fullTR, positive(tr!)),
    arc(sub(right, mul(tr!, 2)), top, tr!, Math.PI * 1.5, Math.PI / 2),
  );
  const sweep = e('asin', e('clamp', sub(1, div(sub(width, end), tr!)), 0, 1));
  when(
    mul(partialTR, positive(tr!)),
    arc(sub(right, mul(tr!, 2)), top, tr!, add(Math.PI * 1.5, sweep), sub(Math.PI / 2, sweep)),
  );
  when(positive(br!), ['move', right, add(top, tr!)]);
  commands.push(['line', right, sub(bottom, br!)]);
  when(positive(br!), arc(sub(right, mul(br!, 2)), sub(bottom, mul(br!, 2)), br!, 0, Math.PI / 2));
  commands.push(['line', add(left, bl!), bottom]);
  when(positive(bl!), arc(left, sub(bottom, mul(bl!, 2)), bl!, Math.PI / 2, Math.PI / 2));
  commands.push(['line', left, add(top, tl!)]);
  path(commands, gap);
  return entries;
}
