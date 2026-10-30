// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Pinned matrix_utils.dart adapters for patterns, cascades and named options.
import { MatrixUtilsBase } from './matrix-utils-base.ts';
import { Matrix4 } from '../../math/matrix4.ts';
import { Offset } from '../../ui/offset.ts';
import { Rect } from '../../ui/rect.ts';
import { Axis } from './basic-types.ts';
import { FoundationBuildMode } from '../../foundation/constants.ts';
import { invariant } from '../../foundation/errors.ts';
import { debugFormatDouble } from '../../foundation/debug.ts';
import { DiagnosticsProperty } from '../../foundation/diagnostics.ts';
import type {
  DiagnosticsPropertyOptions,
  DiagnosticsStringOptions,
} from '../../foundation/diagnostics.ts';
/** Source diagnostic representation uses matrix rows, independent of storage layout. */
export function debugDescribeTransform(transform: Matrix4 | null): string[] {
  if (transform === null) return ['null'];
  return Array.from(
    { length: 4 },
    (_, row) =>
      `[${row}] ${Array.from({ length: 4 }, (_, column) => debugFormatDouble(transform.entry(row, column))).join(',')}`,
  );
}
export class TransformProperty extends DiagnosticsProperty<Matrix4> {
  constructor(
    name: string,
    value: Matrix4 | null,
    options: DiagnosticsPropertyOptions<Matrix4> = {},
  ) {
    super(name, value, { ...options, typeName: 'Matrix4' });
  }
  override valueToString(options: DiagnosticsStringOptions = {}): string {
    if (options.parentConfiguration?.lineBreakProperties === false) {
      invariant(
        this.value !== null,
        'null-transform-diagnostic',
        'Single-line matrix formatting requires a transform',
      );
      return (
        '[' +
        Array.from({ length: 4 }, (_, row) =>
          Array.from({ length: 4 }, (_, column) =>
            debugFormatDouble(this.value!.entry(row, column)),
          ).join(','),
        ).join('; ') +
        ']'
      );
    }
    return debugDescribeTransform(this.value).join('\n');
  }
}
/** Manual adapter file; the separately generated base owns scalar algorithms. */
export class MatrixUtils extends MatrixUtilsBase {
  private constructor() {
    super();
  }
  static getAsTranslation(transform: Matrix4): Offset | null {
    const s = transform.storage;
    return s.length === 16 &&
      s[0] === 1 &&
      s[1] === 0 &&
      s[2] === 0 &&
      s[3] === 0 &&
      s[4] === 0 &&
      s[5] === 1 &&
      s[6] === 0 &&
      s[7] === 0 &&
      s[8] === 0 &&
      s[9] === 0 &&
      s[10] === 1 &&
      s[11] === 0 &&
      s[14] === 0 &&
      s[15] === 1
      ? new Offset(s[12]!, s[13]!)
      : null;
  }
  static getAsScale(transform: Matrix4): number | null {
    const storage = transform.storage,
      identity = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
    return storage[0] === storage[5] &&
      storage.every((value, index) => index === 0 || index === 5 || value === identity[index])
      ? storage[0]!
      : null;
  }
  static inverseTransformRect(transform: Matrix4, rect: Rect): Rect {
    if (this.isIdentity(transform)) return rect;
    const inverse = Matrix4.copy(transform);
    inverse.invert();
    return this.transformRect(inverse, rect);
  }
  static createCylindricalProjectionTransform({
    radius,
    angle,
    perspective = 0.001,
    orientation = Axis.vertical,
  }: {
    readonly radius: number;
    readonly angle: number;
    readonly perspective?: number;
    readonly orientation?: Axis;
  }): Matrix4 {
    if (FoundationBuildMode.debug)
      invariant(
        perspective >= 0 && perspective <= 1,
        'invalid-cylinder-perspective',
        'Perspective must lie in [0, 1]',
      );
    const result = Matrix4.identity();
    result.setEntry(3, 2, -perspective);
    result.setEntry(2, 3, -radius);
    result.setEntry(3, 3, perspective * radius + 1);
    const rotation =
      orientation === Axis.horizontal
        ? Matrix4.rotationY(angle)
        : orientation === Axis.vertical
          ? Matrix4.rotationX(angle)
          : (() => {
              throw new TypeError('Unknown cylinder orientation');
            })();
    rotation.multiply(Matrix4.translationValues(0, 0, radius));
    result.multiply(rotation);
    return result;
  }
}
