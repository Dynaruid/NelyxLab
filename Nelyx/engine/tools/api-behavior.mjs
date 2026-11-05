// SPDX-License-Identifier: BSD-3-Clause
import assert from 'node:assert/strict';
const exportsOf = (module, coverage) =>
  Object.entries(coverage).map(([name, covers]) => ({ module, name, covers }));
/** Executed in this audit invocation; no saved receipts or test-file-existence approvals. */
export const engineV2ApiContracts = [
  {
    id: 'canonical-key-equality',
    exports: exportsOf('@nelyx/core/foundation/key', {
      ValueKey: ['construct:0', 'instance:0:equals'],
      ObjectKey: ['construct:0', 'instance:0:equals'],
      UniqueKey: ['construct:0', 'instance:0:equals'],
      sameKey: ['call:0'],
    }),
    run({ load }) {
      const { ValueKey, ObjectKey, UniqueKey, sameKey } = load('@nelyx/core/foundation/key');
      const object = {};
      assert.equal(sameKey(new ValueKey('a'), new ValueKey('a')), true);
      assert.equal(sameKey(new ValueKey('a'), new ValueKey('b')), false);
      assert.equal(sameKey(new ObjectKey(object), new ObjectKey(object)), true);
      assert.equal(sameKey(new ObjectKey({}), new ObjectKey({})), false);
      assert.equal(sameKey(new UniqueKey(), new UniqueKey()), false);
      assert.equal(sameKey(null, null), true);
    },
  },
  {
    id: 'canonical-notifier-lifetime',
    exports: exportsOf('@nelyx/core/foundation/notifier', {
      ValueNotifier: [
        'construct:0',
        'instance:0:value',
        'instance:0:addListener',
        'instance:0:removeListener',
        'instance:0:dispose',
      ],
    }),
    run({ load }) {
      const { ValueNotifier } = load('@nelyx/core/foundation/notifier');
      const value = new ValueNotifier(1),
        seen = [],
        listener = () => seen.push(value.value);
      value.addListener(listener);
      value.value = 2;
      value.value = 2;
      value.removeListener(listener);
      value.value = 3;
      assert.deepEqual(seen, [2]);
      value.dispose();
      assert.throws(() => value.addListener(listener));
    },
  },
  {
    id: 'canonical-color-value',
    exports: exportsOf('@nelyx/core/ui/color', {
      Color: ['construct:0', 'instance:0:value', 'instance:0:withAlpha'],
    }),
    run({ load }) {
      const { Color } = load('@nelyx/core/ui/color');
      const value = new Color(0xff123456);
      assert.equal(value.value, 0xff123456);
      assert.equal(value.withAlpha(0x80).value, 0x80123456);
    },
  },
  {
    id: 'canonical-linear-curve',
    exports: exportsOf('@nelyx/core/framework/animation/curves', { Curves: ['static:linear'] }),
    run({ load }) {
      const { Curves } = load('@nelyx/core/framework/animation/curves');
      for (const value of [0, 0.25, 0.75, 1]) assert.equal(Curves.linear.transform(value), value);
    },
  },
  {
    id: 'canonical-friction-initial-state',
    exports: exportsOf('@nelyx/core/framework/physics/friction-simulation', {
      FrictionSimulation: ['construct:0', 'instance:0:x', 'instance:0:dx'],
    }),
    run({ load }) {
      const { FrictionSimulation } = load('@nelyx/core/framework/physics/friction-simulation');
      const value = new FrictionSimulation(0.135, 2, 3);
      assert.equal(value.x(0), 2);
      assert.equal(value.dx(0), 3);
      assert.ok(value.x(1) > 2 && value.dx(1) < 3);
    },
  },
];
