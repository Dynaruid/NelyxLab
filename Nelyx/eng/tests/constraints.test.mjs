// SPDX-License-Identifier: BSD-3-Clause
import test from 'node:test';
import assert from 'node:assert/strict';
import { BoxConstraints } from '@nelyx/core/framework/rendering/constraints';
import { Column, Row, SizedBox } from '@nelyx/core/framework/widgets/basic';
import { fixture } from '../../../packages/material/tests/root-fixture.mjs';
import { RenderBox, PipelineOwner } from '@nelyx/core/framework/rendering/object';
import { RenderProxyBox } from '@nelyx/core/framework/rendering/boxes';

const timeout = 1_200_000;
test(
  'bursts invalidate the size-dependent ancestor chain once and still refresh dirty intrinsic queries',
  { timeout },
  () => {
    class Leaf extends RenderBox {
      value = 10;
      performLayout(c) {
        return c.constrain({ width: this.value, height: 10 });
      }
      computeMinIntrinsicWidth() {
        return this.value;
      }
    }
    class Parent extends RenderProxyBox {
      clears = 0;
      clearCachedLayoutData() {
        super.clearCachedLayoutData();
        this.clears++;
      }
      performLayout(c) {
        this.child.layout(c.loosen(), { parentUsesSize: true });
        return c.constrain(this.child.size);
      }
    }
    const leaf = new Leaf(),
      parents = [];
    let root = leaf;
    for (let i = 0; i < 8; i++) {
      root = new Parent(root);
      parents.push(root);
    }
    const pipeline = new PipelineOwner();
    pipeline.setRoot(root);
    try {
      pipeline.flushLayout({ width: 240, height: 160 });
      for (const parent of parents) parent.clears = 0;
      for (let i = 0; i < 24; i++) {
        leaf.value = 20 + i;
        leaf.markNeedsLayout();
      }
      assert(
        parents.every((parent) => parent.clears === 1),
        'Already-dirty ancestor chains must not repeat for each wheel/update in a burst',
      );
      assert.equal(root.getMinIntrinsicWidth(0), 43);
      leaf.value = 90;
      leaf.markNeedsLayout();
      assert.equal(
        root.getMinIntrinsicWidth(0),
        90,
        'Intrinsic queries populated while dirty must be invalidated through their dependency edges',
      );
      pipeline.flushLayout({ width: 240, height: 160 });
      assert.equal(leaf.size.width, 90);
      assert.equal(root.needsLayout, false);
    } finally {
      pipeline.setRoot(undefined);
      root.dispose();
      pipeline.dispose();
    }
  },
);
test(
  'valid constraints never evaluate diagnostic formatting or error collectors',
  { timeout },
  () => {
    let formats = 0,
      collections = 0;
    class Probe extends BoxConstraints {
      toString() {
        formats++;
        throw new Error('Diagnostic formatting must only run for an invalid constraint');
      }
    }
    const constraints = new Probe(0, 20, 0, 40),
      options = {
        isAppliedConstraint: true,
        informationCollector() {
          collections++;
          return ['unexpected'];
        },
      };
    assert.equal(constraints.debugAssertIsValid(options), true);
    assert.deepEqual(constraints.constrain({ width: 100, height: 30 }), { width: 20, height: 30 });
    assert.equal(constraints.isSatisfiedBy({ width: 10, height: 20 }), true);
    assert.equal(constraints.equals(new Probe(0, 20, 0, 40)), true);
    assert.equal(formats, 0);
    assert.equal(collections, 0);
  },
);

test(
  'invalid and infinitely applied constraints retain error code, description and collector details',
  { timeout },
  () => {
    let formats = 0,
      collections = 0;
    class Probe extends BoxConstraints {
      toString() {
        formats++;
        return super.toString();
      }
    }
    const invalid = new Probe(-1, 20, 0, 40);
    assert.throws(
      () =>
        invalid.debugAssertIsValid({
          informationCollector() {
            collections++;
            return ['layout owner detail'];
          },
        }),
      (error) => {
        assert.equal(error.code, 'invalid-constraints');
        assert.match(error.message, /NOT NORMALIZED/);
        assert.match(error.message, /layout owner detail/);
        return true;
      },
    );
    assert.equal(formats, 1);
    assert.equal(collections, 1);
    const infinite = new Probe(Infinity, Infinity, 0, 40);
    assert.equal(infinite.debugAssertIsValid(), true);
    assert.equal(formats, 1);
    assert.throws(
      () => infinite.debugAssertIsValid({ isAppliedConstraint: true }),
      (error) =>
        error.code === 'invalid-constraints' &&
        error.message.includes('cannot be applied to a finite render box'),
    );
    assert.equal(formats, 2);
    assert.throws(
      () => new BoxConstraints(NaN, 20, 0, 40).debugAssertIsValid(),
      (error) => error.code === 'invalid-constraints',
    );
    assert.throws(
      () => new BoxConstraints('0'),
      (error) => error.code === 'invalid-constraints',
    );
  },
);

test(
  'real repeated Core layout remains independent of diagnostic toString overrides',
  { timeout },
  (t) => {
    t.mock.method(BoxConstraints.prototype, 'toString', () => {
      throw new Error('A valid Core layout must not format a diagnostic');
    });
    const f = fixture();
    try {
      for (const width of [100, 120, 100]) {
        f.set(
          new SizedBox(
            width,
            100,
            new Column(
              [
                new Row([new SizedBox(10, 20), new SizedBox(20, 20)], { mainSize: 'min' }),
                new SizedBox(30, 30),
              ],
              { mainSize: 'min' },
            ),
          ),
        );
        f.frame();
      }
    } finally {
      f.close();
    }
  },
);
