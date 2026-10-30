// SPDX-License-Identifier: BSD-3-Clause
import test from 'node:test';
import assert from 'node:assert/strict';
import { TextStyle, copyCapturedTextStyle } from '@nelyx/core/framework/painting/text-style';
import { FontWeight, FontFeature, FontVariation, TextDecoration } from '@nelyx/core/ui/typography';
import { Paint } from '@nelyx/core/ui/paint';
import { Shadow } from '@nelyx/core/ui/shadow';
import { TextScaler } from '@nelyx/core/framework/painting/text-scaler';
import {
  freezeRunStyle,
  inheritTextRunStyle,
  freezeStrutStyle,
} from '../../dist/ui/text-style-validation.js';
import { FoundationBuildMode } from '@nelyx/core/foundation/constants';

const timeout = 1_200_000;

test(
  'internal text overrides reuse immutable values while custom copy receivers and mutable paint remain observable',
  { timeout },
  () => {
    const base = new TextStyle({ fontSize: 16, color: 0xff000000 }),
      options = { color: 0xff123456, fontSize: 18, locale: 'ko' };
    const first = copyCapturedTextStyle(base, base.copyWith, options),
      second = copyCapturedTextStyle(base, base.copyWith, { ...options });
    assert.equal(first, second);
    assert(first.equals(base.copyWith(options)));
    assert(Object.isFrozen(first));
    assert.equal(base.fontSize, 16);
    const changed = copyCapturedTextStyle(base, base.copyWith, { ...options, color: 0xff654321 });
    assert.equal(changed.color, 0xff654321);
    assert.notEqual(changed, first);
    assert.equal(first.color, 0xff123456);
    const events = [];
    class Custom extends TextStyle {
      #calls = 0;
      copyWith(value) {
        events.push({ receiver: this, call: ++this.#calls, keys: Object.keys(value) });
        return super.copyWith(value);
      }
    }
    const custom = new Custom();
    for (let i = 0; i < 2; i++) copyCapturedTextStyle(custom, custom.copyWith, { color: 1 });
    assert.equal(events.length, 2);
    assert(events.every((event) => event.receiver === custom));
    assert.deepEqual(events[1].keys, ['color']);
    const paint = new Paint({ color: 0xff112233 }),
      borrowed = new TextStyle({ foreground: paint });
    const a = copyCapturedTextStyle(borrowed, borrowed.copyWith, { fontSize: 18 });
    paint.color = 0xffabcdef;
    const b = copyCapturedTextStyle(borrowed, borrowed.copyWith, { fontSize: 18 });
    assert.notEqual(a, b);
    assert.equal(b.toRunStyle().foreground.color, 0xffabcdef);
  },
);
test(
  'builder style inheritance shares captured nested values and preserves paint precedence',
  { timeout },
  () => {
    const base = freezeRunStyle({
        fontFamilies: ['UI'],
        fontFeatures: [{ name: 'tnum', value: 1 }],
        color: 0xff112233,
      }),
      run = freezeRunStyle({
        fontSize: 17,
        foreground: new Paint({ color: 0xffabcdef }).snapshot(),
      }),
      merged = inheritTextRunStyle(base, run);
    assert.equal(merged.fontFamilies, base.fontFamilies);
    assert.equal(merged.fontFeatures, base.fontFeatures);
    assert.equal(merged.foreground, run.foreground);
    assert.equal(merged.color, undefined);
    assert.equal(merged.fontSize, 17);
    assert(Object.isFrozen(merged));
    let reads = 0;
    const external = {
      get fontSize() {
        reads++;
        return 19;
      },
    };
    assert.equal(inheritTextRunStyle(base, external).fontSize, 19);
    assert.equal(reads, 1, 'External styles cross a normal spread/capture boundary');
    const strut = freezeStrutStyle({ fontFamilies: ['UI'], fontSize: 14, forceStrutHeight: true });
    assert.equal(freezeStrutStyle(strut), strut);
    assert(Object.isFrozen(strut.fontFamilies));
  },
);
test(
  'owned TextStyle copies preserve generic getter order, inherited values, Proxy traps and thrown errors',
  { timeout },
  () => {
    class BorrowedStyle extends TextStyle {}
    const saved = FoundationBuildMode.mode,
      base = {
        color: 0xff123456,
        fontFamily: 'UI',
        fontSize: 17,
        fontWeight: FontWeight.w500,
        debugLabel: 'source',
      };
    const run = (Ctor, kind) => {
      const trace = [],
        prototype =
          kind === 'inherited'
            ? {
                get fontSize() {
                  trace.push('inherited fontSize');
                  return 19;
                },
              }
            : null,
        target = Object.create(prototype);
      Object.defineProperty(target, 'color', {
        get() {
          trace.push('color getter');
          return 0xffabcdef;
        },
      });
      const options = new Proxy(target, {
        get(target, key, receiver) {
          trace.push('get ' + String(key));
          if (kind === 'throws' && key === 'fontStyle') throw Error('style option getter');
          return Reflect.get(target, key, receiver);
        },
        ownKeys() {
          throw Error('Unrequested ownKeys');
        },
        getOwnPropertyDescriptor() {
          throw Error('Unrequested descriptor');
        },
      });
      let result, error;
      try {
        const copy = new Ctor(base).copyWith(options);
        result = { run: copy.toRunStyle(), label: copy.debugLabel };
      } catch (value) {
        error = String(value);
      }
      return { trace, result, error };
    };
    try {
      for (const mode of ['release', 'debug']) {
        FoundationBuildMode.mode = mode;
        for (const kind of ['color', 'inherited', 'throws'])
          assert.deepEqual(run(TextStyle, kind), run(BorrowedStyle, kind), mode + ' ' + kind);
      }
      class PrivateOptions {
        #size = 21;
        reads = 0;
        get fontSize() {
          this.reads++;
          return this.#size;
        }
      }
      const options = new PrivateOptions(),
        copy = new TextStyle(base).copyWith(options);
      assert.equal(options.reads, 2);
      assert.equal(copy.fontSize, 21);
      FoundationBuildMode.mode = 'release';
      for (const options of [
        { color: -1 },
        { debugLabel: 0, color: -1 },
        { inherit: 'invalid', color: -1 },
      ]) {
        const error = (Ctor) => {
          try {
            new Ctor(base).copyWith(options);
          } catch (value) {
            return String(value);
          }
          assert.fail('Invalid style copy accepted');
        };
        assert.equal(error(TextStyle), error(BorrowedStyle));
      }
    } finally {
      FoundationBuildMode.mode = saved;
    }
  },
);

test('color copies preserve canonical run keys and immutable nested data', { timeout }, () => {
  const options = {
      fontFamily: 'UI',
      fontFamilyFallback: ['Fallback'],
      fontSize: 17,
      color: 0xff123456,
      fontWeight: FontWeight.w500,
      fontFeatures: [FontFeature.tabularFigures()],
      fontVariations: [FontVariation.weight(500)],
      shadows: [new Shadow({ color: 0xff112233, offset: { x: 1, y: 2 }, blurRadius: 3 })],
    },
    base = new TextStyle(options),
    before = base.toRunStyle();
  for (const colors of [
    { color: 0xffabcdef },
    { backgroundColor: 0xff445566 },
    { color: 0xffabcdef, backgroundColor: 0xff445566 },
    { debugLabel: 'copy' },
  ]) {
    const actual = base.copyWith(colors).toRunStyle(),
      expected = new TextStyle({ ...options, ...colors }).toRunStyle();
    assert.deepEqual(actual, expected);
    assert.deepEqual(Object.keys(actual), Object.keys(expected));
    assert(Object.isFrozen(actual));
    assert(Object.isFrozen(actual.fontFamilies));
    assert(Object.isFrozen(actual.shadows));
  }
  assert.equal(base.toRunStyle(), before);
  assert.equal(before.color, options.color);
  assert.throws(() => base.copyWith({ color: -1 }), /ARGB/);
});

test('style copying preserves values after reentrant success and failure', { timeout }, () => {
  const base = new TextStyle({ fontFamily: 'UI', fontSize: 17, color: 0xff123456 }),
    freeze = Object.freeze;
  let entered = false,
    nested;
  try {
    Object.freeze = (value) => {
      if (!entered) {
        entered = true;
        nested = base.copyWith({ color: 0xff445566 });
        assert.throws(() => base.copyWith({ color: -1 }), /ARGB/);
      }
      return freeze(value);
    };
    const copied = base.copyWith({ color: 0xffabcdef });
    assert.equal(copied.toRunStyle().color, 0xffabcdef);
    assert.equal(nested.toRunStyle().color, 0xff445566);
  } finally {
    Object.freeze = freeze;
  }
  assert.throws(() => new TextStyle({ color: -1 }), /ARGB/);
  assert.throws(() => new TextStyle({ fontSize: -1 }), /Font size/);
  assert.equal(base.toRunStyle().color, 0xff123456);
});
test(
  'TextStyle copying preserves every scalar/list field and applies a font package exactly once',
  { timeout },
  () => {
    const base = new TextStyle({
      inherit: false,
      color: 0xff123456,
      backgroundColor: 0xff654321,
      fontFamily: 'UI',
      fontFamilyFallback: ['Fallback', 'Emoji'],
      package: 'test',
      fontSize: 19,
      fontWeight: FontWeight.w600,
      fontStyle: 'italic',
      letterSpacing: 0.3,
      wordSpacing: 0.7,
      textBaseline: 'ideographic',
      height: 1.4,
      leadingDistribution: 'even',
      locale: 'ar',
      shadows: [new Shadow({ color: 0xff246810, offset: { x: 1.5, y: -2 }, blurRadius: 3 })],
      fontFeatures: [FontFeature.tabularFigures()],
      fontVariations: [FontVariation.weight(550)],
      decoration: TextDecoration.underline,
      decorationColor: 0xff135790,
      decorationThickness: 1.5,
      decorationStyle: 'wavy',
      overflow: 'ellipsis',
    });
    const copy = base.copyWith();
    assert.notEqual(copy, base);
    assert(copy.equals(base));
    assert.deepEqual(copy.toRunStyle(), base.toRunStyle());
    assert.equal(copy.fontFamily, 'packages/test/UI');
    assert.deepEqual(copy.fontFamilyFallback, ['packages/test/Fallback', 'packages/test/Emoji']);
    assert.equal(copy.inherit, false);
    assert.equal(copy.overflow, 'ellipsis');
    assert.equal(copy.debugLabel, null);
    const changed = base.copyWith({ fontSize: 21, color: 0xffabcdef }),
      expected = base.toRunStyle();
    assert.deepEqual(changed.toRunStyle(), { ...expected, fontSize: 21, color: 0xffabcdef });
    assert.equal(base.fontSize, 19);
    assert.equal(base.color, 0xff123456);
    assert.deepEqual(base.copyWith({ fontSize: null, color: null }).toRunStyle(), expected);
    assert.throws(() => {
      copy.fontSize = 10;
    }, TypeError);
  },
);

test(
  'TextStyle copies retain mutable Paint identity and capture its latest value only at the run boundary',
  { timeout },
  () => {
    const foreground = new Paint({ color: 0xff123456 }),
      background = new Paint({ color: 0xff654321 }),
      style = new TextStyle({ foreground, background, fontSize: 18 }),
      copy = style.copyWith();
    assert.equal(copy.foreground, foreground);
    assert.equal(copy.background, background);
    assert.equal(copy.color, null);
    assert.equal(copy.backgroundColor, null);
    const first = copy.toRunStyle();
    foreground.color = 0xffabcdef;
    background.color = 0xfffedcba;
    const next = copy.toRunStyle();
    assert.equal(first.foreground.color, 0xff123456);
    assert.equal(first.background.color, 0xff654321);
    assert.equal(next.foreground.color, 0xffabcdef);
    assert.equal(next.background.color, 0xfffedcba);
    assert.deepEqual(next, style.toRunStyle());
  },
);

test('TextStyle final fields allow derived state and keep borrowed Paint live', { timeout }, () => {
  class DerivedStyle extends TextStyle {
    extra = 'initial';
  }
  const paint = new Paint({ color: 0xff123456 });
  for (const style of [
    new TextStyle({ foreground: paint, fontSize: 18 }),
    new DerivedStyle({ foreground: paint, fontSize: 18 }),
  ]) {
    for (const key of Object.keys(style).filter((key) => key !== 'extra')) {
      const descriptor = Object.getOwnPropertyDescriptor(style, key);
      assert.equal(descriptor.writable, false, key);
      assert.equal(descriptor.configurable, false, key);
    }
    if (style instanceof DerivedStyle) {
      style.extra = 'updated';
      assert.equal(style.extra, 'updated');
    }
    const before = style.toRunStyle();
    paint.color = paint.color === 0xff123456 ? 0xffabcdef : 0xff123456;
    assert.equal(style.foreground, paint);
    assert.notEqual(style.toRunStyle().foreground.color, before.foreground.color);
  }
});

test(
  'immutable run reuse preserves input snapshots and reads a custom scaler on each use',
  { timeout },
  () => {
    const families = ['UI'],
      features = [FontFeature.tabularFigures()],
      style = new TextStyle({ fontFamilyFallback: families, fontSize: 18, fontFeatures: features });
    const first = style.toRunStyle();
    families.push('Later');
    features.length = 0;
    assert.deepEqual(style.toRunStyle(), first);
    assert.deepEqual(first.fontFamilies, ['UI']);
    assert.equal(first.fontFeatures.length, 1);
    assert.throws(() => {
      first.fontFamilies.push('Mutation');
    }, TypeError);
    class MutableScaler extends TextScaler {
      factor = 1;
      calls = 0;
      scale(size) {
        this.calls++;
        return size * this.factor;
      }
      get textScaleFactor() {
        return this.factor;
      }
    }
    const scaler = new MutableScaler();
    assert.equal(style.toRunStyle(scaler).fontSize, 18);
    scaler.factor = 2;
    assert.equal(style.toRunStyle(scaler).fontSize, 36);
    assert.equal(scaler.calls, 2);
    assert.equal(first.fontSize, 18);
  },
);

test(
  'run snapshots still validate caller-frozen input and isolate nested mutable values',
  { timeout },
  () => {
    const family = ['UI'],
      shadow = { color: 0xff123456, offset: { x: 1, y: 2 }, blurSigma: 3 };
    const input = Object.freeze({ fontFamilies: family, shadows: [shadow] }),
      captured = freezeRunStyle(input);
    family.push('Later');
    shadow.offset.x = 40;
    shadow.color = 0xffabcdef;
    assert.deepEqual(freezeRunStyle(captured).fontFamilies, ['UI']);
    assert.deepEqual(captured.shadows, [
      { color: 0xff123456, offset: { x: 1, y: 2 }, blurSigma: 3 },
    ]);
    assert.deepEqual(freezeRunStyle(input).fontFamilies, ['UI', 'Later']);
    assert.equal(freezeRunStyle(input).shadows[0].offset.x, 40);
    assert.throws(() => freezeRunStyle(Object.freeze({ fontSize: NaN })), /Font size/);
    assert.throws(() => freezeRunStyle(Object.freeze({ fontFamilies: [''] })), /Font family/);
  },
);

test(
  'structural typography values with mutable fields keep their run-boundary observations',
  { timeout },
  () => {
    const weight = { value: 400 },
      feature = { feature: 'tnum', value: 1 },
      variation = { axis: 'wght', value: 400 },
      decoration = { mask: 1 };
    const style = new TextStyle({
      fontWeight: weight,
      fontFeatures: [feature],
      fontVariations: [variation],
      decoration,
    });
    const first = style.toRunStyle();
    weight.value = 600;
    feature.value = 0;
    variation.value = 600;
    decoration.mask = 2;
    const next = style.toRunStyle();
    assert.equal(first.fontWeight, 400);
    assert.equal(next.fontWeight, 600);
    assert.equal(next.fontFeatures[0].value, 0);
    assert.equal(next.fontVariations[0].value, 600);
    assert.equal(next.decoration, 2);
    const target = { value: 400 },
      proxy = new Proxy(target, {
        getOwnPropertyDescriptor() {
          throw Error('Unrequested descriptor access');
        },
      }),
      proxied = new TextStyle({ fontWeight: proxy });
    assert.equal(proxied.toRunStyle().fontWeight, 400);
    target.value = 600;
    assert.equal(proxied.toRunStyle().fontWeight, 600);
  },
);

test(
  'repeated exact-style merges retain live Paint and typography references and derived copy behavior',
  { timeout },
  () => {
    const paint = new Paint({ color: 0xff123456 }),
      feature = { feature: 'tnum', value: 1 };
    const base = new TextStyle({ fontSize: 18, fontFamily: 'UI' }),
      other = new TextStyle({ foreground: paint, fontFeatures: [feature] });
    const first = base.merge(other).toRunStyle();
    paint.color = 0xffabcdef;
    feature.value = 0;
    const next = base.merge(other).toRunStyle();
    assert.equal(first.foreground.color, 0xff123456);
    assert.equal(next.foreground.color, 0xffabcdef);
    assert.equal(next.fontFeatures[0].value, 0);
    assert.equal(next.fontSize, 18);
    class DerivedStyle extends TextStyle {
      size = 20;
      copyWith(options) {
        return super.copyWith({ ...options, fontSize: this.size });
      }
    }
    const derived = new DerivedStyle();
    assert.equal(derived.merge(other).fontSize, 20);
    derived.size = 24;
    assert.equal(derived.merge(other).fontSize, 24);
  },
);

test(
  'merge reuse cannot suppress Proxy reads, mutable typography capture or replaced copy accessors',
  { timeout },
  () => {
    const base = new TextStyle({ fontSize: 18 }),
      other = new TextStyle({ color: 0xff123456 }),
      reads = [];
    const proxy = new Proxy(other, {
      get(target, key, receiver) {
        reads.push(key);
        return Reflect.get(target, key, receiver);
      },
    });
    const first = base.merge(proxy);
    const expected = [...reads];
    reads.length = 0;
    const second = base.merge(proxy);
    assert.deepEqual(reads, expected);
    assert(reads.includes('color'));
    assert.notEqual(first, second);
    let captures = 0;
    const feature = {
        feature: 'tnum',
        get value() {
          captures++;
          return 1;
        },
      },
      borrowed = new TextStyle({ fontFeatures: [feature] });
    base.merge(borrowed);
    captures = 0;
    base.merge(borrowed);
    assert(captures > 0, 'Each mutable typography merge crosses its run validation boundary');
    base.merge(other);
    const descriptor = Object.getOwnPropertyDescriptor(TextStyle.prototype, 'copyWith');
    let copies = 0;
    try {
      Object.defineProperty(TextStyle.prototype, 'copyWith', {
        configurable: true,
        get() {
          copies++;
          return descriptor.value;
        },
      });
      assert.equal(base.merge(other).color, other.color);
      assert.equal(base.merge(other).color, other.color);
      assert.equal(copies, 2);
    } finally {
      Object.defineProperty(TextStyle.prototype, 'copyWith', descriptor);
    }
  },
);

test('style merge diagnostics follow the current build mode', { timeout }, () => {
  const mode = FoundationBuildMode.mode;
  try {
    FoundationBuildMode.mode = 'release';
    const base = new TextStyle({ debugLabel: 'base' }),
      other = new TextStyle({ debugLabel: 'other' });
    assert.equal(base.merge(other).debugLabel, null);
    FoundationBuildMode.mode = 'debug';
    assert.match(base.merge(other).debugLabel, /base.*merge.*other/);
    FoundationBuildMode.mode = 'release';
    assert.equal(base.merge(other).debugLabel, null);
  } finally {
    FoundationBuildMode.mode = mode;
  }
});
