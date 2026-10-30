// SPDX-License-Identifier: BSD-3-Clause
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SemanticsNode,
  SemanticsOwner,
  SemanticsConfiguration,
  DebugSemanticsDumpOrder,
  SemanticsSortKey,
} from '@nelyx/core/framework/semantics/semantics';
import { Rect } from '@nelyx/core/ui/rect';
import { Matrix4 } from '@nelyx/core/math/matrix4';
import { FoundationPlatform } from '@nelyx/core/foundation/platform';
import { FoundationBuildMode } from '@nelyx/core/foundation/constants';
const timeout = 1_200_000,
  order = (node) => node.debugListChildrenInOrder(DebugSemanticsDumpOrder.traversalOrder);
function config(direction = 'ltr') {
  const value = new SemanticsConfiguration();
  value.textDirection = direction;
  return value;
}
function leaf(x) {
  const node = new SemanticsNode();
  node.rect = Rect.fromLTWH(x, 0, 10, 10);
  node.updateWith({ config: config() });
  return node;
}

test(
  'semantics order reuses unchanged local geometry and refreshes direction, rect, transforms and children',
  { timeout },
  () => {
    FoundationPlatform.configure({ kind: 'native', operatingSystem: 'windows' });
    const root = new SemanticsNode(),
      parent = new SemanticsNode(),
      left = leaf(0),
      right = leaf(20),
      third = leaf(40),
      direction = config(),
      inherit = new SemanticsConfiguration();
    parent.updateWith({ config: inherit, childrenInInversePaintOrder: [right, left] });
    root.updateWith({ config: direction, childrenInInversePaintOrder: [parent] });
    let sorts = 0;
    const deflate = Rect.prototype.deflate;
    Rect.prototype.deflate = function (...args) {
      sorts++;
      return deflate.apply(this, args);
    };
    try {
      assert.deepEqual(order(parent), [left, right]);
      const initial = sorts;
      assert(initial > 0);
      order(parent).reverse();
      assert.deepEqual(order(parent), [left, right]);
      assert.equal(sorts, initial, 'A caller must not mutate the cached order');
      root.transform = Matrix4.translationValues(100, 200, 0);
      parent.transform = Matrix4.translationValues(-20, 50, 0);
      assert.deepEqual(order(parent), [left, right]);
      assert.equal(sorts, initial, 'Ancestor motion does not change local reading order');
      root.updateWith({ config: config('rtl'), childrenInInversePaintOrder: [parent] });
      assert.deepEqual(order(parent), [right, left]);
      assert(sorts > initial);
      root.updateWith({ config: direction, childrenInInversePaintOrder: [parent] });
      left.rect = Rect.fromLTWH(30, 0, 10, 10);
      assert.deepEqual(order(parent), [right, left]);
      left.rect = Rect.fromLTWH(0, 0, 10, 10);
      const transform = Matrix4.translationValues(30, 0, 0);
      left.transform = transform;
      assert.deepEqual(order(parent), [right, left]);
      transform.storage[12] = -30;
      assert.deepEqual(
        order(parent),
        [left, right],
        'In-place Matrix4 changes must invalidate the sort',
      );
      parent.updateWith({ config: inherit, childrenInInversePaintOrder: [third, left] });
      assert.deepEqual(order(parent), [left, third]);
      assert.equal(right.parent, null);
      parent.updateWith({ config: inherit, childrenInInversePaintOrder: [] });
      assert.deepEqual(order(parent), []);
    } finally {
      Rect.prototype.deflate = deflate;
    }
  },
);

test(
  'custom sort keys, node implementations and matrix transforms keep live source ordering',
  { timeout },
  () => {
    FoundationPlatform.configure({ kind: 'native', operatingSystem: 'windows' });
    class MutableKey extends SemanticsSortKey {
      constructor(rank) {
        super();
        this.rank = rank;
      }
      doCompare(other) {
        return this.rank - other.rank;
      }
    }
    const parent = new SemanticsNode(),
      left = leaf(0),
      right = leaf(20),
      first = new MutableKey(0),
      second = new MutableKey(1),
      a = config(),
      b = config();
    a.sortKey = first;
    b.sortKey = second;
    left.updateWith({ config: a });
    right.updateWith({ config: b });
    parent.updateWith({ config: config(), childrenInInversePaintOrder: [right, left] });
    assert.deepEqual(order(parent), [left, right]);
    first.rank = 2;
    assert.deepEqual(order(parent), [right, left]);
    class MovingMatrix extends Matrix4 {
      shift = 0;
      transform3(vector) {
        super.transform3(vector);
        vector.x += this.shift;
        return vector;
      }
    }
    left.updateWith({ config: config() });
    right.updateWith({ config: config() });
    const matrix = new MovingMatrix(new Float64Array(16));
    matrix.setIdentity();
    matrix.storage[13] = 1;
    left.transform = matrix;
    assert.deepEqual(order(parent), [left, right]);
    matrix.shift = 40;
    assert.deepEqual(
      order(parent),
      [right, left],
      'Virtual transforms cannot use a raw-storage cache',
    );
    class CustomNode extends SemanticsNode {
      offset = 0;
      get rect() {
        return Rect.fromLTWH(this.offset, 0, 10, 10);
      }
      set rect(value) {
        super.rect = value;
      }
    }
    const custom = new CustomNode();
    custom.updateWith({ config: config() });
    parent.updateWith({ config: config(), childrenInInversePaintOrder: [right, custom] });
    assert.deepEqual(order(parent), [custom, right]);
    custom.offset = 40;
    assert.deepEqual(order(parent), [right, custom]);
  },
);

test(
  'virtual traversal children follow ownership changes after a cached local order',
  { timeout },
  () => {
    FoundationPlatform.configure({ kind: 'native', operatingSystem: 'windows' });
    const owner = new SemanticsOwner({ onSemanticsUpdate: (update) => update.dispose() }),
      root = SemanticsNode.root({ owner }),
      parent = leaf(0),
      local = leaf(0),
      virtual = leaf(20),
      rootConfig = config(),
      parentConfig = config(),
      virtualConfig = config();
    root.rect = Rect.fromLTWH(0, 0, 100, 100);
    parent.rect = Rect.fromLTWH(0, 0, 100, 100);
    parent.updateWith({ config: parentConfig, childrenInInversePaintOrder: [local] });
    root.updateWith({ config: rootConfig, childrenInInversePaintOrder: [parent, virtual] });
    try {
      owner.sendSemanticsUpdate();
      assert.deepEqual(order(parent), [local]);
      parentConfig.traversalParentIdentifier = 'target';
      virtualConfig.traversalChildIdentifier = 'target';
      parent.updateWith({ config: parentConfig, childrenInInversePaintOrder: [local] });
      virtual.updateWith({ config: virtualConfig });
      owner.sendSemanticsUpdate();
      assert.deepEqual(order(parent), [local, virtual]);
      root.updateWith({ config: rootConfig, childrenInInversePaintOrder: [parent] });
      owner.sendSemanticsUpdate();
      assert.deepEqual(order(parent), [local]);
    } finally {
      root.detach();
      owner.dispose();
    }
  },
);

test(
  'overlapping source reading-order knots project immutable centers once and match virtual node ordering',
  { timeout },
  () => {
    FoundationPlatform.configure({ kind: 'native', operatingSystem: 'windows' });
    class SourceNode extends SemanticsNode {}
    class SourceMatrix extends Matrix4 {}
    const mode = FoundationBuildMode.mode,
      center = Object.getOwnPropertyDescriptor(Rect.prototype, 'center');
    let centerReads = 0;
    FoundationBuildMode.mode = 'release';
    Object.defineProperty(Rect.prototype, 'center', {
      ...center,
      get() {
        centerReads++;
        return center.get.call(this);
      },
    });
    try {
      for (const direction of ['ltr', 'rtl'])
        for (const variant of [0, 1, 2, 3, 4, 5]) {
          const groups = [[], []],
            matrices = [[], []];
          for (let index = 0; index < 12; index++)
            for (let source = 0; source < 2; source++) {
              const node = source ? new SourceNode() : new SemanticsNode(),
                values = Matrix4.identity().storage.slice();
              values[0] = variant === 1 ? -1 : variant === 2 ? 0.3 : 1;
              values[1] = variant === 2 ? 0.7 : 0;
              values[4] = variant === 2 ? -0.7 : 0;
              values[5] = variant === 3 ? 0 : variant === 2 ? 0.3 : 1;
              values[12] = (index % 4) * 5;
              values[13] = Math.floor(index / 4) * 4;
              values[3] = variant === 4 ? 0.01 : 0;
              values[7] = variant === 4 ? -0.02 : 0;
              values[8] = variant === 5 ? Infinity : 0;
              const matrix = source ? new SourceMatrix(values) : new Matrix4(values);
              node.rect = Rect.fromLTWH(0, 0, 100, 100);
              node.transform = matrix;
              node.updateWith({ config: config(direction) });
              groups[source].push(node);
              matrices[source].push(values);
            }
          const parents = groups.map((children) => {
            const parent = new SemanticsNode();
            parent.updateWith({ config: config(direction), childrenInInversePaintOrder: children });
            return parent;
          });
          centerReads = 0;
          const actual = order(parents[0]).map((node) => groups[0].indexOf(node)),
            fastReads = centerReads;
          centerReads = 0;
          const expected = order(parents[1]).map((node) => groups[1].indexOf(node));
          assert.deepEqual(actual, expected, { direction, variant });
          if (variant === 0) {
            assert.equal(
              fastReads,
              12,
              'A geometric knot must not allocate/project its center in every pair comparison',
            );
            assert(centerReads > fastReads);
          }
          for (let index = 0; index < 12; index++)
            for (const list of matrices) list[index][12] -= 7;
          assert.deepEqual(
            order(parents[0]).map((node) => groups[0].indexOf(node)),
            order(parents[1]).map((node) => groups[1].indexOf(node)),
            { direction, variant, mutated: true },
          );
        }
    } finally {
      Object.defineProperty(Rect.prototype, 'center', center);
      FoundationBuildMode.mode = mode;
    }
  },
);

test(
  'standard matrix projection and cached fingerprints use private values when the public storage getter is overridden',
  { timeout },
  () => {
    FoundationPlatform.configure({ kind: 'native', operatingSystem: 'windows' });
    const parent = new SemanticsNode(),
      left = leaf(0),
      right = leaf(20),
      matrix = Matrix4.translationValues(1, 0, 0),
      values = matrix.storage;
    left.transform = matrix;
    Object.defineProperty(matrix, 'storage', {
      get() {
        throw Error('Public storage is not transform3 private storage');
      },
    });
    parent.updateWith({ config: config(), childrenInInversePaintOrder: [right, left] });
    assert.deepEqual(order(parent), [left, right]);
    assert.deepEqual(order(parent), [left, right]);
    values[12] = 40;
    assert.deepEqual(order(parent), [right, left]);
  },
);
