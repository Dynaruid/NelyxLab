// SPDX-License-Identifier: BSD-3-Clause
import test from 'node:test';
import assert from 'node:assert/strict';
import { PipelineOwner, RenderBox } from '@nelyx/core/framework/rendering/object';
import { RenderStack, RenderProxyBox } from '@nelyx/core/framework/rendering/boxes';
import { RenderRepaintBoundary } from '@nelyx/core/framework/rendering/repaint-boundary';
import { BoxConstraints } from '@nelyx/core/framework/rendering/constraints';
import { PaintingContext } from '@nelyx/core/framework/painting/context';
import { FoundationBuildMode } from '@nelyx/core/foundation/constants';
const timeout = 1_200_000;

test(
  'layout admission and layout failures keep the original error and every pending sibling for retry',
  { timeout },
  () => {
    const saved = FoundationBuildMode.mode;
    try {
      for (const mode of ['debug', 'release'])
        for (const phase of ['admission', 'layout'])
          for (const failure of [undefined, null, 0]) {
            FoundationBuildMode.mode = mode;
            let armed = false,
              poison = false,
              layouts = [0, 0],
              rootLayouts = 0;
            class Leaf extends RenderBox {
              constructor(index) {
                super();
                this.index = index;
              }
              get owner() {
                if (this.index === 0 && poison) throw Error('owner getter after failure');
                return super.owner;
              }
              get isRelayoutBoundary() {
                if (this.index === 0 && armed && phase === 'admission') {
                  poison = true;
                  throw failure;
                }
                return super.isRelayoutBoundary;
              }
              performLayout(constraints) {
                if (this.index === 0 && armed && phase === 'layout') {
                  poison = true;
                  throw failure;
                }
                layouts[this.index]++;
                return constraints.constrain({ width: 10, height: 10 });
              }
            }
            class Parent extends RenderBox {
              performLayout(constraints) {
                rootLayouts++;
                for (const child of this.children) child.layout(BoxConstraints.tightFor(10, 10));
                return constraints.constrain({ width: 40, height: 30 });
              }
            }
            const owner = new PipelineOwner(),
              root = new Parent(),
              first = new Leaf(0),
              second = new Leaf(1);
            root.setChildren([first, second]);
            try {
              owner.setRoot(root);
              owner.flushLayout({ width: 40, height: 30 });
              assert.deepEqual(layouts, [1, 1]);
              first.markNeedsLayout();
              second.markNeedsLayout();
              assert.equal(root.needsLayout, false);
              armed = true;
              let caught = false;
              try {
                owner.flushLayout();
              } catch (error) {
                caught = true;
                assert.equal(
                  error,
                  failure,
                  'Recovery must retain a falsey original failure without calling a poisoned owner getter',
                );
              }
              assert(caught);
              armed = false;
              poison = false;
              owner.flushLayout();
              assert.deepEqual(layouts, [2, 2]);
              assert.equal(rootLayouts, 1);
              assert.equal(first.needsLayout, false);
              assert.equal(second.needsLayout, false);
            } finally {
              armed = false;
              poison = false;
              owner.dispose();
              root.setChildren([]);
              root.dispose();
              first.dispose();
              second.dispose();
            }
          }
    } finally {
      FoundationBuildMode.mode = saved;
    }
  },
);
test(
  'failed layout callbacks do not read or readmit a child detached from the pipeline',
  { timeout },
  () => {
    const saved = FoundationBuildMode.mode;
    try {
      for (const mode of ['debug', 'release'])
        for (const failure of [undefined, null, 0]) {
          FoundationBuildMode.mode = mode;
          let armed = false,
            poison = false,
            branchLayouts = 0,
            leafLayouts = 0,
            rootLayouts = 0;
          class Leaf extends RenderBox {
            get owner() {
              if (poison) throw Error('detached owner getter');
              return super.owner;
            }
            performLayout(constraints) {
              leafLayouts++;
              return constraints.constrain({ width: 10, height: 10 });
            }
          }
          class Branch extends RenderBox {
            performLayout(constraints) {
              if (armed)
                this.invokeLayoutCallback(() => {
                  this.remove(leaf);
                  poison = true;
                  throw failure;
                });
              branchLayouts++;
              for (const child of this.children) child.layout(BoxConstraints.tightFor(10, 10));
              return constraints.constrain({ width: 20, height: 20 });
            }
          }
          class Parent extends RenderBox {
            performLayout(constraints) {
              rootLayouts++;
              for (const child of this.children) child.layout(BoxConstraints.tightFor(20, 20));
              return constraints.constrain({ width: 40, height: 30 });
            }
          }
          const owner = new PipelineOwner(),
            root = new Parent(),
            branch = new Branch(),
            leaf = new Leaf();
          branch.setChildren([leaf]);
          root.setChildren([branch]);
          try {
            owner.setRoot(root);
            owner.flushLayout({ width: 40, height: 30 });
            branch.markNeedsLayout();
            leaf.markNeedsLayout();
            armed = true;
            let caught = false;
            try {
              owner.flushLayout();
            } catch (error) {
              caught = true;
              assert.equal(error, failure);
            }
            assert(caught);
            assert.equal(leaf.parent, undefined);
            armed = false;
            assert.doesNotThrow(() => owner.flushLayout());
            assert.deepEqual([rootLayouts, branchLayouts, leafLayouts], [1, 2, 1]);
            poison = false;
            assert.equal(leaf.attached, false);
            assert.equal(branch.needsLayout, false);
          } finally {
            armed = false;
            poison = false;
            owner.dispose();
            root.setChildren([]);
            root.dispose();
            branch.dispose();
            leaf.dispose();
          }
        }
    } finally {
      FoundationBuildMode.mode = saved;
    }
  },
);

class ObservedBox extends RenderStack {
  detaches = 0;
  detach() {
    this.detaches++;
    super.detach();
  }
}

test(
  'layout paint transactions preserve the newest cached pixels across repeated changes and intermediate paint',
  { timeout },
  () => {
    class Leaf extends RenderBox {
      color = 0xff123456;
      change(color) {
        this.color = color;
        this.markNeedsPaint();
      }
      performLayout(c) {
        return c.smallest;
      }
      paint(canvas) {
        canvas.rect({ x: 0, y: 0, width: 8, height: 8 }, this.color);
      }
    }
    class Driver extends RenderProxyBox {
      run;
      performLayout(c) {
        const size = super.performLayout(c);
        this.run?.();
        return size;
      }
    }
    const leaf = new Leaf(),
      driver = new Driver(leaf),
      root = new RenderRepaintBoundary(new BoxConstraints(), driver),
      owner = new PipelineOwner();
    const painted = () => {
      const canvas = new PaintingContext();
      try {
        root.paint(canvas);
        return canvas.commands
          .filter((command) => command.op === 'rect')
          .map((command) => command.color);
      } finally {
        canvas.dispose();
      }
    };
    try {
      owner.setRoot(root);
      owner.flushLayout({ width: 40, height: 30 });
      assert.deepEqual(painted(), [leaf.color]);
      driver.run = () => {
        leaf.change(0xff112233);
        leaf.change(0xff445566);
      };
      driver.markNeedsLayout();
      owner.flushLayout();
      assert.deepEqual(painted(), [0xff445566]);
      driver.run = () => {
        leaf.change(0xff778899);
        assert.deepEqual(painted(), [0xff778899]);
        leaf.change(0xffaabbcc);
        assert.deepEqual(painted(), [0xffaabbcc]);
      };
      driver.markNeedsLayout();
      owner.flushLayout();
      assert.deepEqual(painted(), [0xffaabbcc]);
      leaf.change(0xffddeeff);
      assert.deepEqual(painted(), [0xffddeeff]);
    } finally {
      driver.run = undefined;
      owner.dispose();
      root.dispose();
    }
  },
);

test(
  'layout paint coalescing preserves every custom ancestor boundary getter and retirement hook',
  { timeout },
  () => {
    const calls = [];
    class Leaf extends RenderBox {
      performLayout(c) {
        return c.smallest;
      }
    }
    class Custom extends RenderProxyBox {
      constructor(name, child) {
        super(child);
        this.name = name;
      }
      get isRepaintBoundary() {
        calls.push(this.name + ' boundary');
        return true;
      }
      retainedPaintInvalidated() {
        calls.push(this.name + ' retirement');
      }
    }
    class Driver extends RenderProxyBox {
      run;
      performLayout(c) {
        const size = super.performLayout(c);
        this.run?.();
        return size;
      }
    }
    const leaf = new Leaf(),
      low = new Custom('low', leaf),
      high = new Custom('high', low),
      root = new Driver(high),
      owner = new PipelineOwner();
    try {
      owner.setRoot(root);
      owner.flushLayout({ width: 40, height: 30 });
      root.run = () => {
        for (let i = 0; i < 2; i++) {
          calls.length = 0;
          leaf.markNeedsPaint();
          assert.deepEqual(calls, ['low boundary', 'low retirement', 'high boundary']);
        }
      };
      root.markNeedsLayout();
      owner.flushLayout();
    } finally {
      root.run = undefined;
      owner.dispose();
      root.dispose();
    }
  },
);

test(
  'retained children preserve cycle checks through reorder, removal and reparent',
  { timeout },
  () => {
    const root = new ObservedBox(),
      branch = new ObservedBox(),
      leaf = new ObservedBox(),
      sibling = new ObservedBox();
    try {
      root.setChildren([branch, sibling]);
      branch.insert(leaf);
      root.setChildren([sibling, branch]);
      root.setChildren([sibling, branch]);
      assert.deepEqual(root.children, [sibling, branch]);
      assert.equal(leaf.parent, branch);
      assert.throws(() => leaf.insert(root), /cycle/);
      assert.throws(() => root.insert(root), /cycle/);
      assert.throws(() => sibling.insert(leaf), /another parent|already has a parent/);
      branch.remove(leaf);
      sibling.insert(leaf);
      root.setChildren([branch, sibling]);
      assert.equal(leaf.parent, sibling);
      assert.throws(() => leaf.insert(root), /cycle/);
    } finally {
      for (const node of [root, branch, sibling, leaf]) node.setChildren([]);
      for (const node of [leaf, sibling, branch, root]) node.dispose();
    }
  },
);

test(
  'a retired render subtree detaches once and detached child-list disposal does not repeat lifecycle hooks',
  { timeout },
  () => {
    const owner = new PipelineOwner(),
      nodes = Array.from({ length: 16 }, () => new ObservedBox());
    for (let i = 0; i < nodes.length - 1; i++) nodes[i].insert(nodes[i + 1]);
    try {
      owner.setRoot(nodes[0]);
      owner.setRoot(undefined);
      for (let i = 0; i < nodes.length - 1; i++) nodes[i].remove(nodes[i + 1]);
      for (const node of nodes) {
        assert.equal(node.detaches, 1);
        assert.equal(node.owner, undefined);
        assert.equal(node.parent, undefined);
      }
      const fresh = new ObservedBox();
      nodes[0].insert(fresh);
      nodes[0].remove(fresh);
      assert.equal(fresh.detaches, 0, 'An unattached child has no detach transition');
      fresh.dispose();
    } finally {
      owner.dispose();
      for (const node of nodes.reverse()) {
        node.setChildren([]);
        node.dispose();
      }
    }
  },
);
test(
  'attached adoption keeps cycle and pipeline ownership checks before and after subtree moves',
  { timeout },
  () => {
    const owners = [new PipelineOwner(), new PipelineOwner()],
      roots = [new ObservedBox(), new ObservedBox()],
      branch = new ObservedBox(),
      leaf = new ObservedBox();
    try {
      owners.forEach((owner, index) => owner.setRoot(roots[index]));
      roots[0].insert(branch);
      branch.insert(leaf);
      assert.equal(leaf.owner, owners[0]);
      assert.throws(() => leaf.insert(roots[0]), /cycle/);
      assert.throws(() => leaf.insert(roots[1]), /attached root/);
      assert.equal(roots[1].parent, undefined);
      roots[0].remove(branch);
      assert.equal(leaf.owner, undefined);
      assert.throws(() => leaf.insert(branch), /cycle/);
      roots[1].insert(branch);
      assert.equal(leaf.owner, owners[1]);
      assert.throws(() => leaf.insert(roots[1]), /cycle/);
    } finally {
      for (const owner of owners) owner.dispose();
      for (const node of [...roots, branch, leaf]) {
        node.setChildren([]);
        node.dispose();
      }
    }
  },
);
test(
  'a detach hook rejects its transitioning ancestor before running any adoption hook',
  { timeout },
  () => {
    let attempted = false;
    class DuringDetach extends ObservedBox {
      adoptions = 0;
      setupParentData(child) {
        this.adoptions++;
        super.setupParentData(child);
      }
      detach() {
        if (!attempted && this.parent && !this.parent.owner) {
          attempted = true;
          const before = this.adoptions;
          assert.throws(() => this.insert(this.parent), /cycle/);
          assert.equal(this.adoptions, before);
        }
        super.detach();
      }
    }
    const owner = new PipelineOwner(),
      root = new ObservedBox(),
      child = new DuringDetach();
    try {
      root.insert(child);
      owner.setRoot(root);
      owner.setRoot(undefined);
      assert(attempted);
      assert.equal(child.parent, root);
      assert.equal(root.owner, undefined);
      assert.equal(child.owner, undefined);
    } finally {
      owner.dispose();
      root.setChildren([]);
      child.dispose();
      root.dispose();
    }
  },
);
test(
  'a failed attached detach still clears the actual child and descendant pipeline owners',
  { timeout },
  () => {
    class FailingBox extends ObservedBox {
      detach() {
        this.detaches++;
        throw Error('detach probe');
      }
    }
    const owner = new PipelineOwner(),
      root = new ObservedBox(),
      child = new FailingBox(),
      leaf = new ObservedBox();
    root.insert(child);
    child.insert(leaf);
    try {
      owner.setRoot(root);
      assert.throws(() => root.remove(child), /detach probe/);
      assert.equal(child.detaches, 1);
      assert.equal(leaf.detaches, 1);
      assert.equal(child.parent, undefined);
      assert.equal(child.owner, undefined);
      assert.equal(leaf.owner, undefined);
      child.remove(leaf);
      assert.equal(leaf.detaches, 1, 'Failure recovery already retired the descendant owner');
    } finally {
      owner.dispose();
      for (const node of [root, child, leaf]) {
        node.setChildren([]);
        node.dispose();
      }
    }
  },
);
test(
  'attach rollback still retires a subclass resource created before super.attach',
  { timeout },
  () => {
    class EarlyFailure extends ObservedBox {
      resources = 0;
      attach() {
        this.resources++;
        throw Error('early attach probe');
      }
      detach() {
        this.resources--;
        super.detach();
      }
    }
    const owner = new PipelineOwner(),
      root = new ObservedBox(),
      child = new EarlyFailure();
    try {
      owner.setRoot(root);
      assert.throws(() => root.insert(child), /early attach probe/);
      assert.equal(child.resources, 0);
      assert.equal(child.detaches, 1);
      assert.equal(child.owner, undefined);
      assert.equal(child.parent, undefined);
      assert.equal(child.parentData, undefined);
      assert.deepEqual(root.children, []);
    } finally {
      owner.dispose();
      root.dispose();
      child.dispose();
    }
  },
);

test(
  'paint and semantics invalidate the current pipeline through attach and subtree reparent',
  { timeout },
  () => {
    const counts = [0, 0],
      owners = counts.map(
        (_value, index) =>
          new PipelineOwner({
            onNeedVisualUpdate: () => counts[index]++,
            onSemanticsUpdate: () => {},
          }),
      );
    class EarlyPaint extends ObservedBox {
      attach(owner) {
        if (this.parent?.owner) {
          const index = owners.indexOf(owner),
            before = counts[index];
          this.markNeedsPaint();
          assert(
            counts[index] > before,
            'The attached parent still owns invalidation before child attach',
          );
        }
        super.attach(owner);
      }
    }
    const roots = [new ObservedBox(), new ObservedBox()],
      child = new EarlyPaint(),
      leaf = new ObservedBox();
    child.insert(leaf);
    const handles = [];
    try {
      owners.forEach((owner, index) => {
        owner.setRoot(roots[index]);
        handles.push(owner.ensureSemantics());
      });
      roots[0].insert(child);
      counts.fill(0);
      leaf.markNeedsPaint();
      assert(counts[0] > 0);
      assert.equal(counts[1], 0);
      roots[0].remove(child);
      roots[1].insert(child);
      counts.fill(0);
      leaf.markNeedsSemanticsUpdate();
      assert.equal(counts[0], 0);
      assert(counts[1] > 0);
      assert.throws(() => roots[0].insert(child), /another parent|already has a parent/);
    } finally {
      for (const handle of handles) handle.dispose();
      for (const owner of owners) owner.dispose();
      for (const node of [...roots, child, leaf]) {
        node.setChildren([]);
        node.dispose();
      }
    }
  },
);

test('invalidation preserves callback receivers and falsey thrown values', { timeout }, () => {
  for (const method of ['markNeedsPaint', 'markNeedsSemanticsUpdate', 'markNeedsLayout'])
    for (const failure of [new Error('owner callback'), undefined, null, 0]) {
      const owner = new PipelineOwner(),
        root = new RenderStack();
      owner.setRoot(root);
      const original = Object.getOwnPropertyDescriptor(owner, 'invalidate');
      let lookups = 0,
        calls = 0,
        receiver = 'not called';
      Object.defineProperty(owner, 'invalidate', {
        configurable: true,
        get() {
          lookups++;
          return function () {
            calls++;
            receiver = this;
            throw failure;
          };
        },
      });
      try {
        let caught = false;
        try {
          root[method]();
        } catch (error) {
          caught = true;
          assert.equal(error, failure);
        }
        assert(caught, method + ' must retain even a falsey thrown value');
        assert.equal(lookups, 1);
        assert.equal(calls, 1);
        assert.equal(receiver, method === 'markNeedsLayout' ? owner : undefined);
      } finally {
        Object.defineProperty(owner, 'invalidate', original);
        owner.dispose();
        root.dispose();
      }
    }
});

test(
  'paint finishes invalidation and preserves ordered semantic and host failures before retry',
  { timeout },
  () => {
    const failures = [new Error('semantic wake'), new Error('paint wake')],
      calls = [];
    let armed = false;
    const owner = new PipelineOwner({
        onSemanticsUpdate() {},
        onNeedVisualUpdate() {
          if (armed) {
            const failure = failures[calls.length];
            calls.push(failure);
            throw failure;
          }
        },
      }),
      root = new RenderProxyBox();
    let handle;
    try {
      owner.setRoot(root);
      owner.flushLayout({ width: 40, height: 30 });
      handle = owner.ensureSemantics();
      owner.flushSemantics();
      const before = root.paintVersion;
      armed = true;
      assert.throws(
        () => root.markNeedsPaint(),
        (error) =>
          error instanceof AggregateError &&
          error.errors.length === 2 &&
          error.errors.every((value, index) => value === failures[index]),
      );
      assert.deepEqual(calls, failures);
      assert(root.paintVersion > before);
      armed = false;
      assert.doesNotThrow(() => {
        root.markNeedsPaint();
        owner.flushSemantics();
      });
    } finally {
      armed = false;
      handle?.dispose();
      owner.dispose();
      root.dispose();
    }
  },
);

test(
  'paint queues semantic hooks until commit and retains callback getter failures before retry',
  { timeout },
  () => {
    const semanticFailure = new Error('semantic getter'),
      lookupFailure = new Error('owner getter'),
      calls = [];
    let armed = false;
    const owner = new PipelineOwner({ onSemanticsUpdate() {} }),
      root = new RenderProxyBox();
    let handle, original;
    Object.defineProperty(root, 'semanticsTransport', {
      get() {
        if (armed) {
          calls.push('semantic');
          throw semanticFailure;
        }
        return null;
      },
    });
    try {
      owner.setRoot(root);
      owner.flushLayout({ width: 40, height: 30 });
      handle = owner.ensureSemantics();
      owner.flushSemantics();
      original = Object.getOwnPropertyDescriptor(owner, 'invalidate');
      Object.defineProperty(owner, 'invalidate', {
        configurable: true,
        get() {
          calls.push('owner');
          throw lookupFailure;
        },
      });
      armed = true;
      assert.throws(
        () => root.markNeedsPaint(),
        (error) => error === lookupFailure,
      );
      assert.deepEqual(calls, ['owner', 'owner']);
      Object.defineProperty(owner, 'invalidate', original);
      calls.length = 0;
      assert.throws(
        () => owner.flushSemantics(),
        (error) => error === semanticFailure,
      );
      assert.deepEqual(calls, ['semantic']);
      armed = false;
      assert.doesNotThrow(() => owner.flushSemantics());
    } finally {
      armed = false;
      if (original) Object.defineProperty(owner, 'invalidate', original);
      handle?.dispose();
      owner.dispose();
      root.dispose();
    }
  },
);

test(
  'layout clears every dependent once, queues failed work and preserves ordered failures',
  { timeout },
  () => {
    const failures = [new Error('leaf clear'), new Error('root clear'), new Error('layout wake')],
      calls = [];
    let armed = false,
      layouts = 0;
    class Leaf extends RenderBox {
      performLayout(constraints) {
        return constraints.constrain({ width: 10, height: 10 });
      }
      clearCachedLayoutData() {
        super.clearCachedLayoutData();
        if (armed) {
          calls.push('leaf');
          throw failures[0];
        }
      }
    }
    class Parent extends RenderProxyBox {
      performLayout(constraints) {
        layouts++;
        this.child.layout(constraints.loosen(), { parentUsesSize: true });
        return constraints.constrain(this.child.size);
      }
      clearCachedLayoutData() {
        super.clearCachedLayoutData();
        if (armed) {
          calls.push('root');
          throw failures[1];
        }
      }
    }
    const leaf = new Leaf(),
      root = new Parent(leaf),
      owner = new PipelineOwner({
        onNeedVisualUpdate() {
          if (armed) {
            calls.push('wake');
            throw failures[2];
          }
        },
      });
    try {
      owner.setRoot(root);
      owner.flushLayout({ width: 40, height: 30 });
      root.getMinIntrinsicWidth(0);
      const before = layouts;
      armed = true;
      assert.throws(
        () => leaf.markNeedsLayout(),
        (error) =>
          error instanceof AggregateError &&
          error.errors.length === 3 &&
          error.errors.every((value, index) => value === failures[index]),
      );
      assert.deepEqual(calls, ['leaf', 'root', 'wake']);
      assert(root.needsLayout);
      assert(leaf.needsLayout);
      armed = false;
      owner.flushLayout();
      assert.equal(layouts, before + 1);
      assert.equal(root.needsLayout, false);
      assert.equal(leaf.needsLayout, false);
    } finally {
      armed = false;
      owner.dispose();
      root.dispose();
    }
  },
);

test(
  'layout dependency cycles and parent backedges keep independent reentrant visits and falsey failures',
  { timeout },
  () => {
    const calls = [];
    let armed = false,
      reenter = true,
      failLeaf = true,
      failWake = true;
    class Leaf extends RenderBox {
      depend(source) {
        this.dependOnLayoutOf(source);
      }
      performLayout(c) {
        return c.constrain({ width: 10, height: 10 });
      }
      clearCachedLayoutData() {
        super.clearCachedLayoutData();
        if (armed) {
          calls.push('leaf');
          if (failLeaf) throw 0;
        }
      }
    }
    class Parent extends RenderProxyBox {
      depend(source) {
        this.dependOnLayoutOf(source);
      }
      performLayout(c) {
        this.child.layout(c.loosen(), { parentUsesSize: true });
        return c.constrain(this.child.size);
      }
      clearCachedLayoutData() {
        super.clearCachedLayoutData();
        if (armed) {
          calls.push('root');
          if (reenter) {
            reenter = false;
            this.child.markNeedsLayout();
          }
        }
      }
    }
    const leaf = new Leaf(),
      root = new Parent(leaf),
      owner = new PipelineOwner({
        onNeedVisualUpdate() {
          if (armed) {
            calls.push('wake');
            if (failWake) throw undefined;
          }
        },
      });
    const dependencies = () => {
      root.depend(leaf);
      leaf.depend(root);
    };
    try {
      owner.setRoot(root);
      owner.flushLayout({ width: 40, height: 30 });
      dependencies();
      armed = true;
      assert.throws(
        () => root.markNeedsLayout(),
        (error) =>
          error instanceof AggregateError &&
          error.errors.length === 2 &&
          error.errors[0] === 0 &&
          error.errors[1] === undefined,
      );
      assert.deepEqual(
        calls,
        ['root', 'leaf', 'root', 'wake'],
        'The nested invalidation has its own visits while the outer operation retains both failures',
      );
      assert(root.needsLayout && leaf.needsLayout);
      armed = false;
      owner.flushLayout();
      assert.equal(root.needsLayout, false);
      assert.equal(leaf.needsLayout, false);
      dependencies();
      calls.length = 0;
      failLeaf = false;
      failWake = false;
      armed = true;
      root.markNeedsLayout();
      assert.deepEqual(
        calls,
        ['root', 'leaf', 'wake'],
        'One invalidation visits the dependency cycle and parent backedge once',
      );
      armed = false;
      owner.flushLayout();
      assert.equal(root.needsLayout, false);
      assert.equal(leaf.needsLayout, false);
    } finally {
      armed = false;
      owner.dispose();
      root.dispose();
    }
  },
);
