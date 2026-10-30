// SPDX-License-Identifier: BSD-3-Clause
import { invariant } from '../foundation/errors.ts';
import { RRect } from './rrect.ts';
import { Radius } from './radius.ts';
export type RRectValues = readonly [
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
];
/** LTRB followed by TL/TR/BR/BL elliptical radii; no GPU handle. */
export interface RRectSnapshot {
  readonly values: RRectValues;
}
function values(source: readonly number[]): RRectValues {
  invariant(
    Array.isArray(source) &&
      source.length === 12 &&
      source.every(
        (v) => typeof v === 'number' && Number.isFinite(v) && Number.isFinite(Math.fround(v)),
      ),
    'invalid-rrect',
    'Rounded rectangle needs twelve finite SkScalar values',
  );
  invariant(
    source[2]! >= source[0]! && source[3]! >= source[1]! && source.slice(4).every((v) => v >= 0),
    'invalid-rrect',
    'Rounded bounds/radii must have nonnegative size',
  );
  return Object.freeze([...source]) as RRectValues;
}
export function freezeRRect(source: RRectSnapshot): RRectSnapshot {
  invariant(source && typeof source === 'object', 'invalid-rrect', 'Missing rounded rectangle');
  return Object.freeze({ values: values(values(source.values).map(Math.fround)) });
}
function read(source: RRect): RRectValues {
  invariant(source instanceof RRect, 'invalid-rrect', 'Expected RRect');
  return values([
    source.left,
    source.top,
    source.right,
    source.bottom,
    source.tlRadiusX,
    source.tlRadiusY,
    source.trRadiusX,
    source.trRadiusY,
    source.brRadiusX,
    source.brRadiusY,
    source.blRadiusX,
    source.blRadiusY,
  ]);
}
/** The pinned engine rrect.cc normalizes inverted Dart bounds before display-list capture.
 * Wire snapshots remain strictly positive and preserve the original corner radii order. */
export function captureRRect(source: RRect): RRectSnapshot {
  invariant(source instanceof RRect, 'invalid-rrect', 'Expected RRect');
  return freezeRRect({
    values: [
      Math.min(source.left, source.right),
      Math.min(source.top, source.bottom),
      Math.max(source.left, source.right),
      Math.max(source.top, source.bottom),
      source.tlRadiusX,
      source.tlRadiusY,
      source.trRadiusX,
      source.trRadiusY,
      source.brRadiusX,
      source.brRadiusY,
      source.blRadiusX,
      source.blRadiusY,
    ],
  });
}
/** Keep CPU hit testing in double precision; raster snapshots narrow independently. */
export function copyRRect(source: RRect): RRect {
  const v = read(source);
  return new RRect(v[0], v[1], v[2], v[3], {
    topLeft: new Radius(v[4], v[5]),
    topRight: new Radius(v[6], v[7]),
    bottomRight: new Radius(v[8], v[9]),
    bottomLeft: new Radius(v[10], v[11]),
  });
}
