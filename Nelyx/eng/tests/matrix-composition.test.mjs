// SPDX-License-Identifier: BSD-3-Clause
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  captureMatrix4,
  multiplyMatrix4,
  matrix4FromAffine,
  transformMatrix4Point,
} from '@nelyx/core/ui/matrix4';
import { bounds, transform } from '@nelyx/core/ui/geometry';
import { Matrix4 } from '@nelyx/core/math/matrix4';
const timeout = 1_200_000;

test(
  'source Matrix4 products preserve IEEE lanes, self aliasing and private borrowed storage',
  { timeout },
  () => {
    class PrivateMatrix extends Matrix4 {
      get storage() {
        throw Error('Public storage is not the private numeric receiver');
      }
    }
    const values = [
      matrix4FromAffine([1, 0, 0, 1, 11, -13]),
      [-0, 0, 1, 0, 0, -0, 0, 1, 1, 0, -0, 0, 0, 1, 0, -0],
      [1e150, 1e-150, 0, 0.002, -3, 4, 0, 0.003, 0, 0, 1, 0, -20, 10, 0, 1],
      Array.from({ length: 16 }, (_, i) => (i === 0 ? Infinity : i === 5 ? NaN : i - 8)),
    ];
    for (const input of values) {
      const borrowed = Float64Array.from(input),
        actual = new PrivateMatrix(borrowed),
        expected = Matrix4.fromList(input);
      expected.leftMultiply(Matrix4.fromList(input));
      actual.multiply(actual);
      assert.deepEqual([...borrowed], [...expected.storage]);
      /* oxlint-disable unicorn/no-useless-spread -- Convert typed views to ordinary arrays for strict value comparisons. */
      borrowed.set(input);
      const right = Matrix4.fromList([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0.25, -0.5, 2, 1]);
      right.leftMultiply(Matrix4.fromList(input));
      actual.translateByDouble(0.25, -0.5, 2, 1);
      assert.deepEqual([...borrowed.slice(0, 12)], input.slice(0, 12));
      assert.deepEqual([...borrowed.slice(12)], [...right.storage.slice(12)]);
      /* oxlint-enable unicorn/no-useless-spread */
    }
  },
);

test(
  'source Matrix4 inversion preserves singular overrides and ordered partial writes to short views',
  { timeout },
  () => {
    const borrowed = new Float64Array(16);
    class PrivateMatrix extends Matrix4 {
      copies = 0;
      get storage() {
        throw Error('Private inverse used public storage');
      }
      setFrom(other) {
        this.copies++;
        super.setFrom(other);
      }
    }
    const inverse = new PrivateMatrix(borrowed),
      matrix = Matrix4.translationValues(10, -20, 30);
    matrix.scaleByDouble(2, 4, 5, 1);
    assert.equal(inverse.copyInverse(matrix), 40);
    matrix.multiply(inverse);
    assert.deepEqual([...matrix.storage], [...Matrix4.identity().storage]);
    assert.equal(inverse.copyInverse(Matrix4.zero()), 0);
    assert.equal(inverse.copies, 1);
    assert.deepEqual([...borrowed], Array(16).fill(0));
    const shortValues = new Float64Array([7, 9]),
      short = Matrix4.fromFloat64List(shortValues);
    assert.throws(
      () => short.translateByDouble(1, 2, 3, 1),
      (error) => error.code === 'numeric-index-range',
    );
    assert.deepEqual([...shortValues], [7, 9]);
    assert.throws(
      () => short.copyInverse(Matrix4.identity()),
      (error) => error.code === 'numeric-index-range',
    );
    assert.deepEqual([...shortValues], [1, 0]);
    const zero = Matrix4.zero;
    try {
      shortValues.set([7, 9]);
      Matrix4.zero = () => short;
      assert.throws(
        () => Matrix4.identity(),
        (error) => error.code === 'numeric-index-range',
      );
      assert.deepEqual([...shortValues], [1, 9]);
    } finally {
      Matrix4.zero = zero;
    }
  },
);

test(
  'owned canonical affine products match dense IEEE arithmetic through chained transforms and mutable external values',
  { timeout },
  () => {
    const affine = [
      [1, 0, 0, 1, 0, 0],
      [-0, -0, -0, -0, -0, 0],
      [0, -1, 1, 0, 11, -13],
      [1e150, 1e-150, -1e150, 1e-150, -1e150, 1e150],
      [1e-300, -1e-300, -0, 0, -0, -1e-300],
    ];
    const dense = (a, b) => {
      const result = Array(16).fill(0);
      for (let column = 0; column < 4; column++)
        for (let row = 0; row < 4; row++)
          for (let k = 0; k < 4; k++)
            result[column * 4 + row] += a[k * 4 + row] * b[column * 4 + k];
      return result;
    };
    for (const left of affine)
      for (const right of affine) {
        const a = matrix4FromAffine(left),
          b = captureMatrix4(matrix4FromAffine(right)),
          result = multiplyMatrix4(a, b);
        assert.deepEqual(result, dense(a, b));
        const chained = dense(result, a);
        if (chained.every(Number.isFinite)) assert.deepEqual(multiplyMatrix4(result, a), chained);
        else assert.throws(() => multiplyMatrix4(result, a), /finite/);
        assert(Object.isFrozen(result));
      }
    const a = [...matrix4FromAffine([1, 0, 0, 1, 2, 3])],
      b = matrix4FromAffine([2, 0, 0, 2, 0, 0]);
    multiplyMatrix4(a, b);
    a[3] = 0.25;
    assert.deepEqual(multiplyMatrix4(a, b), dense(a, b));
    assert.throws(
      () =>
        multiplyMatrix4(
          matrix4FromAffine([1e308, 0, 0, 1, 0, 0]),
          matrix4FromAffine([2, 0, 0, 1, 0, 0]),
        ),
      /finite/,
    );
  },
);
test(
  'Full composition preserves 3D and perspective projection and captures independent finite storage',
  { timeout },
  () => {
    const source = [1, 0, 0, 0.002, 0, 1, 0, 0, 0, 0, 1, 0, 10, 20, 0, 1],
      a = captureMatrix4(source),
      b = captureMatrix4([2, 0, 0, 0, 0, 3, 0, 0, 0, 0, 4, 0, 5, 6, 7, 1]),
      composed = multiplyMatrix4(a, b);
    source[0] = 99;
    assert.equal(a[0], 1);
    assert(Object.isFrozen(composed));
    assert.deepEqual(composed, [2, 0, 0, 0.004, 0, 3, 0, 0, 0, 0, 4, 0, 15, 26, 7, 1.01]);
    assert.deepEqual(transformMatrix4Point(composed, { x: 3, y: 4 }), {
      x: 21 / 1.022,
      y: 38 / 1.022,
    });
    assert.throws(
      () => multiplyMatrix4(captureMatrix4(Array(16).fill(Number.MAX_VALUE)), b),
      /finite/,
    );
  },
);
test(
  'Dense composition retains IEEE accumulation order across signed zeros, small and large finite values',
  { timeout },
  () => {
    const values = [0, -0, 1, -1, 0.1, 1e-150, 1e150];
    let seed = 1729;
    const next = () => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return values[seed % values.length];
    };
    for (let i = 0; i < 24; i++) {
      const a = captureMatrix4(Array.from({ length: 16 }, next)),
        b = captureMatrix4(Array.from({ length: 16 }, next)),
        expected = Array(16).fill(0);
      for (let column = 0; column < 4; column++)
        for (let row = 0; row < 4; row++)
          for (let k = 0; k < 4; k++)
            expected[column * 4 + row] += a[k * 4 + row] * b[column * 4 + k];
      assert.deepEqual(multiplyMatrix4(a, b), expected);
    }
  },
);

test(
  'projected bounds preserve rotation, reflection, shear and perspective horizons',
  { timeout },
  () => {
    assert.deepEqual(bounds([0, 1, -1, 0, -10, 3], { width: 4, height: 2 }), {
      x: -12,
      y: 3,
      width: 2,
      height: 4,
    });
    assert.deepEqual(bounds([2, 1, 0.5, 3, 7, 11], { width: 8, height: 4 }), {
      x: 7,
      y: 11,
      width: 18,
      height: 20,
    });
    assert.deepEqual(bounds([-2, 0, 0, -3, 5, 7], { width: 8, height: 4 }), {
      x: -11,
      y: -5,
      width: 16,
      height: 12,
    });
    const perspective = captureMatrix4([1, 0, 0, 0.1, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
    assert.deepEqual(bounds(perspective, { width: 10, height: 10 }), {
      x: 0,
      y: 0,
      width: 5,
      height: 10,
    });
    const horizon = captureMatrix4([1, 0, 0, 0.1, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, -1]);
    assert(Object.values(bounds(horizon, { width: 10, height: 10 })).every(Number.isNaN));
    assert.deepEqual(
      bounds(captureMatrix4([1, 0, 0, -0.1, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, -1]), {
        width: 10,
        height: 10,
      }),
      { x: -5, y: -10, width: 5, height: 10 },
    );
  },
);

test(
  'bounds agree with the public point projection across finite extremes and signed zero',
  { timeout },
  () => {
    for (const matrix of [
      [-0, 0, 0, -0, -0, 0],
      [1e-150, -1e150, 0.1, -0.1, 1, -1],
      captureMatrix4([-0, 0, 0, 0, 0, -0, 0, 0, 0, 0, 1, 0, -0, 0, 0, 1]),
      captureMatrix4([1, 2, 0, 0.002, -3, 4, 0, 0.003, 0, 0, 1, 0, -20, 10, 0, 1]),
    ])
      for (const [width, height] of [
        [0, -0],
        [8, 4],
        [0.125, 73],
      ]) {
        const points = [
            [0, 0],
            [width, 0],
            [0, height],
            [width, height],
          ].map(([x, y]) => transform(matrix, { x, y })),
          xs = points.map((p) => p.x),
          ys = points.map((p) => p.y),
          x = Math.min(...xs),
          y = Math.min(...ys);
        assert.deepEqual(bounds(matrix, { width, height }), {
          x,
          y,
          width: Math.max(...xs) - x,
          height: Math.max(...ys) - y,
        });
      }
  },
);
