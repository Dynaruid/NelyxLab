// SPDX-License-Identifier: BSD-3-Clause
import test from 'node:test';
import assert from 'node:assert/strict';
import { replayFrame } from '@nelyx/skia-native/renderer';
import { configurePaint } from '@nelyx/skia-native/paint';
import { Paint } from '@nelyx/core/ui/paint';
import { Gradient } from '@nelyx/core/ui/shader';
import { ColorFilter } from '@nelyx/core/ui/color-filter';
const timeout = 1_200_000;
function fixture({ failDraw = false, failRetire = false } = {}) {
  const paints = [],
    rects = [],
    draws = [];
  let drawCalls = 0;
  // Match the pinned JsiSkPaint fresh constructor, including its anti-alias override.
  const api = {
    Color: (value) => value,
    Paint() {
      const value = {
        state: {
          Color: 0xff000000,
          AntiAlias: true,
          Style: 0,
          StrokeWidth: 0,
          StrokeMiter: 4,
          StrokeCap: 0,
          StrokeJoin: 0,
          BlendMode: 3,
          Shader: null,
          ColorFilter: null,
          ImageFilter: null,
          MaskFilter: null,
          Dither: false,
        },
        retired: 0,
        dispose() {
          this.retired++;
          if (failRetire && this === paints[0]) throw Error('retire-failure');
        },
      };
      for (const name of [
        'Color',
        'AntiAlias',
        'Style',
        'StrokeWidth',
        'StrokeMiter',
        'StrokeCap',
        'StrokeJoin',
        'BlendMode',
        'Shader',
        'ColorFilter',
        'ImageFilter',
        'MaskFilter',
        'Dither',
      ])
        value['set' + name] = (field) => {
          value.state[name] = field;
        };
      paints.push(value);
      return value;
    },
    XYWHRect(...values) {
      const rect = {
        values,
        retired: 0,
        dispose() {
          this.retired++;
        },
      };
      rects.push(rect);
      return rect;
    },
  };
  const canvas = {
    drawRect(rect, paint) {
      if (failDraw && ++drawCalls === 2) throw Error('draw-failure');
      draws.push({ rect: [...rect.values], paint: { ...paint.state } });
    },
  };
  return {
    api,
    canvas,
    paints,
    rects,
    draws,
    verifyRetired() {
      for (const value of [...paints, ...rects]) assert.equal(value.retired, 1);
    },
  };
}
const command = (color, options = {}) => ({
  op: 'drawRect',
  rect: { x: 0, y: 0, width: 1, height: 2 },
  paint: new Paint({ color, ...options }).snapshot(),
});
const replay = (f, commands) =>
  replayFrame(
    f.api,
    f.canvas,
    { commands },
    {
      image() {
        throw Error('Unexpected image lookup');
      },
      paragraph() {
        throw Error('Unexpected paragraph lookup');
      },
    },
  );
test(
  'native replay shares equal ordinary fills without changing colours or mutating styles',
  { timeout },
  () => {
    const f = fixture(),
      red = 0xffff0000,
      blue = 0xff0000ff;
    replay(f, [
      command(red),
      command(blue),
      command(red, { style: 'stroke', strokeWidth: 2 }),
      command(red),
      command(red, { isAntiAlias: false }),
      command(blue),
    ]);
    assert.equal(f.paints.length, 5);
    assert.deepEqual(
      f.draws.map((draw) => draw.paint.Color),
      [red, blue, red, red, red, blue],
    );
    assert.deepEqual(
      f.draws.map((draw) => draw.paint.Style),
      [0, 0, 1, 0, 0, 0],
    );
    assert.equal(f.draws[2].paint.StrokeWidth, 2);
    assert.equal(f.draws[4].paint.AntiAlias, false);
    f.verifyRetired();
  },
);

test(
  'fresh ordinary fills preserve native defaults while configuring an existing paint resets every scalar',
  { timeout },
  () => {
    const f = fixture(),
      paint = f.api.Paint();
    configurePaint(
      f.api,
      paint,
      new Paint({
        color: 0xffabcdef,
        style: 'stroke',
        isAntiAlias: false,
        strokeWidth: 7,
        strokeCap: 'round',
        strokeJoin: 'bevel',
        strokeMiterLimit: 9,
        blendMode: 'src',
      }).snapshot(),
    );
    configurePaint(f.api, paint, new Paint({ color: 0xff123456 }).snapshot());
    replay(f, [command(0xff123456)]);
    assert.deepEqual(f.draws[0].paint, paint.state);
    paint.dispose();
    f.verifyRetired();
  },
);
test(
  'native replay palette is bounded to 64 colours and never survives the recording',
  { timeout },
  () => {
    const f = fixture(),
      commands = Array.from({ length: 70 }, (_, n) => command((0xff000000 + n) >>> 0));
    replay(f, [...commands, ...commands]);
    assert.equal(f.paints.length, 77);
    assert.equal(f.draws.length, 140);
    f.verifyRetired();
    const next = fixture();
    replay(next, [commands[0]]);
    assert.equal(next.paints.length, 2);
    next.verifyRetired();
  },
);
test(
  'effectful native paints keep their own wrappers even when gradients are equal',
  { timeout },
  () => {
    const f = fixture(),
      shaders = [],
      gradient = Gradient.linear({ x: 0, y: 0 }, { x: 10, y: 0 }, [0xff000000, 0xffffffff]);
    f.api.Shader = {
      MakeLinearGradient() {
        const shader = {
          retired: 0,
          nelyxIsValid: () => true,
          dispose() {
            this.retired++;
          },
        };
        shaders.push(shader);
        return shader;
      },
    };
    try {
      replay(f, [
        command(0xff123456, { shader: gradient }),
        command(0xff123456, { shader: gradient }),
      ]);
      assert.equal(f.paints.length, 3);
      assert.equal(shaders.length, 2);
      assert.notEqual(f.draws[0].paint.Shader, f.draws[1].paint.Shader);
      for (const shader of shaders) assert.equal(shader.retired, 1);
      f.verifyRetired();
    } finally {
      gradient.dispose();
    }
  },
);
test(
  'a failed native draw retires shared paint once and preserves the first failure',
  { timeout },
  () => {
    const f = fixture({ failDraw: true, failRetire: true });
    assert.throws(
      () => replay(f, [command(0xff123456), command(0xff123456)]),
      (error) => {
        assert(error instanceof AggregateError);
        assert.equal(error.errors[0].message, 'draw-failure');
        assert.equal(error.errors[1].message, 'retire-failure');
        return true;
      },
    );
    f.verifyRetired();
  },
);
test('backdrop paint mutation stays separate from an equal cached fill', { timeout }, () => {
  const f = fixture(),
    color = 0xff123456,
    backdrops = [];
  f.canvas.saveLayer = (paint, bounds, filter) => backdrops.push({ paint, bounds, filter });
  f.canvas.restore = () => {};
  replay(f, [
    command(color),
    { op: 'saveBackdropFilter', paint: new Paint({ color }).snapshot() },
    { op: 'restore' },
    command(color),
  ]);
  assert.equal(f.paints.length, 3);
  assert.equal(backdrops.length, 1);
  assert.notEqual(backdrops[0].paint, f.paints[1]);
  assert.equal(backdrops[0].filter, null);
  assert.equal(f.draws[1].paint.Color, color);
  f.verifyRetired();
});

test(
  'transparent srcOver shapes preserve commands while destination-changing blends and layers still replay',
  { timeout },
  () => {
    const f = fixture(),
      layers = [],
      transparent = new Paint({ color: 0x00123456 }).snapshot();
    f.canvas.saveLayer = (paint, bounds) => layers.push({ paint, bounds });
    f.canvas.restore = () => {};
    const commands = [
      command(0xff123456),
      command(0),
      { op: 'drawPath', path: { operations: [], fillType: 'nonZero' }, paint: transparent },
      ...['clear', 'src', 'dstIn'].map((blendMode) => command(0, { blendMode })),
      { op: 'saveLayer', bounds: null, paint: transparent },
      command(0xffffffff),
      { op: 'restore' },
      command(0x01000000),
    ];
    const before = JSON.stringify(commands);
    replay(f, commands);
    assert.equal(
      JSON.stringify(commands),
      before,
      'Replay must retain the complete captured command stream',
    );
    assert.deepEqual(
      f.draws.map((draw) => draw.paint.Color),
      [0xff123456, 0, 0, 0, 0xffffffff, 0x01000000],
    );
    assert.equal(
      layers.length,
      1,
      'A zero-alpha layer still participates in save/restore composition',
    );
    f.verifyRetired();
  },
);

test(
  'transparent colours with shaders and alpha-changing filters retain effects, draw order and retirement',
  { timeout },
  () => {
    const f = fixture(),
      nativeEffects = [],
      gradient = Gradient.linear({ x: 0, y: 0 }, { x: 10, y: 0 }, [0xff000000, 0xffffffff]),
      filter = ColorFilter.mode(0xffff0000, 'src');
    const ownEffect = () => {
      const effect = {
        retired: 0,
        nelyxIsValid: () => true,
        dispose() {
          this.retired++;
        },
      };
      nativeEffects.push(effect);
      return effect;
    };
    f.api.Shader = { MakeLinearGradient: ownEffect };
    f.api.ColorFilter = { MakeBlend: ownEffect };
    try {
      replay(f, [
        command(0, { shader: gradient }),
        command(0),
        command(0, { colorFilter: filter }),
        command(0xff123456),
      ]);
      assert.deepEqual(
        f.draws.map((draw) => draw.paint.Color),
        [0, 0, 0xff123456],
      );
      assert(f.draws[0].paint.Shader);
      assert(f.draws[1].paint.ColorFilter);
      for (const effect of nativeEffects) assert.equal(effect.retired, 1);
      f.verifyRetired();
    } finally {
      gradient.dispose();
    }
  },
);
