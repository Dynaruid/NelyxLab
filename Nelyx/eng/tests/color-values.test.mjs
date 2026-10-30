// SPDX-License-Identifier: BSD-3-Clause
import test from 'node:test';
import assert from 'node:assert/strict';
import { Color, ColorSpace } from '@nelyx/core/ui/color';

const timeout = 1_200_000;
test(
  'integer Color construction keeps low bits, final value fields and writable subclass state',
  { timeout },
  () => {
    for (const [value, expected] of [
      [0, 0],
      [0x01020304, 0x01020304],
      [0xffffffff, 0xffffffff],
      [-1, 0xffffffff],
      [0x100000000, 0],
      [0x1000000001n, 1],
      [-1n, 0xffffffff],
    ]) {
      const color = new Color(value);
      assert.equal(color.toARGB32(), expected);
      for (const name of ['a', 'r', 'g', 'b', 'colorSpace']) {
        const d = Object.getOwnPropertyDescriptor(color, name);
        assert.equal(d.enumerable, true);
        assert.equal(d.writable, false);
        assert.equal(d.configurable, false);
      }
    }
    class DerivedColor extends Color {
      marker = 7;
    }
    const derived = new DerivedColor(0xff123456);
    assert.equal(Object.getPrototypeOf(derived), DerivedColor.prototype);
    assert.equal(derived.marker, 7);
    derived.marker = 8;
    assert.equal(derived.marker, 8);
    assert.throws(() => {
      derived.r = 0;
    }, TypeError);
    assert.throws(
      () => new Color(1.5),
      (error) => error.code === 'inexact-color-integer',
    );
    assert.throws(
      () => new Color(Number.MAX_SAFE_INTEGER + 1),
      (error) => error.code === 'inexact-color-integer',
    );
  },
);

test(
  'floating Color factories preserve precision, space, canonical prototype and final field descriptors',
  { timeout },
  () => {
    for (const colorSpace of ColorSpace.values) {
      const color = Color.from({ alpha: 0.5, red: -0, green: 1.5, blue: -0.25, colorSpace });
      assert.equal(Object.getPrototypeOf(color), Color.prototype);
      assert(color instanceof Color);
      assert.equal(color.a, 0.5);
      assert(Object.is(color.r, -0));
      assert.equal(color.g, 1.5);
      assert.equal(color.b, -0.25);
      assert.equal(color.colorSpace, colorSpace);
      assert.equal(color.toARGB32(), 0x8000ff00);
      assert.deepEqual(Object.keys(color), ['a', 'r', 'g', 'b', 'colorSpace']);
      for (const name of Object.keys(color)) {
        const descriptor = Object.getOwnPropertyDescriptor(color, name);
        assert.equal(descriptor.enumerable, true);
        assert.equal(descriptor.writable, false);
        assert.equal(descriptor.configurable, false);
        assert.equal(Reflect.defineProperty(color, name, { value: 'changed' }), false);
      }
      assert.throws(() => {
        color.a = 1;
      }, TypeError);
      assert(Object.isExtensible(color));
    }
    class DerivedColor extends Color {}
    assert.equal(
      Object.getPrototypeOf(DerivedColor.from({ alpha: 1, red: 0, green: 0, blue: 0 })),
      Color.prototype,
    );
    Object.defineProperty(Color.prototype, 'r', {
      configurable: true,
      set() {
        throw Error('inherited setter must not run');
      },
    });
    try {
      assert.equal(Color.from({ alpha: 1, red: 0.25, green: 0.5, blue: 0.75 }).r, 0.25);
    } finally {
      delete Color.prototype.r;
    }
  },
);

test(
  'floating Color factories keep nonfinite components until the explicit integer conversion boundary',
  { timeout },
  () => {
    for (const component of [NaN, Infinity, -Infinity]) {
      const color = Color.from({ alpha: component, red: 0.125, green: 0.25, blue: 0.5 });
      assert(Object.is(color.a, component));
      assert.equal(color.r, 0.125);
      assert.equal(color.g, 0.25);
      assert.equal(color.b, 0.5);
      assert.throws(
        () => color.toARGB32(),
        (error) => error.code === 'nonfinite-integer-conversion',
      );
    }
    assert.equal(Color.fromARGB(128, 10, 20, 30).toARGB32(), 0x800a141e);
    assert.equal(Color.fromRGBO(10, 20, 30, 0.5).toARGB32(), 0x800a141e);
    const first = Color.from({ alpha: 0.25, red: 0.125, green: 0.25, blue: 0.5 }),
      second = first.withValues({ alpha: 0.75 });
    assert.equal(first.a, 0.25);
    assert.equal(second.a, 0.75);
    assert.equal(second.r, first.r);
    assert.equal(second.colorSpace, first.colorSpace);
  },
);
