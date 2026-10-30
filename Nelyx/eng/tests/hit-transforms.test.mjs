// SPDX-License-Identifier: BSD-3-Clause
import test from 'node:test';
import assert from 'node:assert/strict';
import { HitTestResult, HitTestEntry } from '@nelyx/core/framework/gestures/hit-test';
import {
  captureTransform,
  multiply,
  fullTransform,
  translate,
  identity,
  inverse,
  inversePaintTransform,
} from '@nelyx/core/ui/geometry';
import { RenderBox, RenderObject, BoxParentData } from '@nelyx/core/framework/rendering/object';
import { MouseRegion } from '@nelyx/core/framework/widgets/mouse-region';
import { Padding, SizedBox } from '@nelyx/core/framework/widgets/basic';
import { EdgeInsets } from '@nelyx/core/framework/painting/edge-insets';
import { fixture } from '../../../packages/material/tests/root-fixture.mjs';
import {
  matrix4Identity,
  captureMatrix4,
  multiplyMatrix4,
  inverseMatrix4,
} from '@nelyx/core/ui/matrix4';
import { Offset } from '@nelyx/core/ui/offset';
import { SliverHitTestResult } from '@nelyx/core/framework/rendering/sliver';
import { MouseTracker } from '@nelyx/core/framework/rendering/mouse-tracker';
import { MouseCursorManager, SystemMouseCursors } from '@nelyx/core/services/mouse-cursor';
import { PointerHoverEvent, PointerRemovedEvent } from '@nelyx/core/framework/gestures/events';
const timeout = 1_200_000,
  target = { handleEvent() {} };

test(
  'stationary post-layout mouse checks retain fresh transforms and target order',
  { timeout },
  () => {
    const events = [];
    let entries;
    const first = {
        validForMouseTracker: true,
        onEnter: (e) => events.push(['enter-a', e.localPosition.dx]),
        onExit: (e) => events.push(['exit-a', e.localPosition.dx]),
      },
      second = {
        validForMouseTracker: true,
        onEnter: () => events.push(['enter-b']),
        onExit: () => events.push(['exit-b']),
      },
      tracker = new MouseTracker(() => entries);
    const point = {
      kind: 'hover',
      device: 'mouse',
      pointer: 1,
      x: 10,
      y: 20,
      buttons: 0,
      timestamp: 0,
      viewportGeneration: 1,
    };
    try {
      entries = [
        { target: first, transform: captureTransform([1, 0, 0, 1, -2, 0]) },
        { target: second, transform: identity },
      ];
      tracker.updateWithEvent(point);
      assert.deepEqual(events, [['enter-b'], ['enter-a', 8]]);
      events.length = 0;
      entries = [
        { target: second, transform: identity },
        { target: first, transform: captureTransform([1, 0, 0, 1, -7, 0]) },
      ];
      tracker.updateAllDevices();
      assert.deepEqual(events, [], 'Reordering the same targets produces no false enter/exit');
      entries = [{ target: second, transform: identity }];
      tracker.updateAllDevices();
      assert.deepEqual(events, [['exit-a', 3]], 'Exit uses the latest post-layout transform');
      tracker.clearDevices();
      assert.deepEqual(events.at(-1), ['exit-b']);
    } finally {
      tracker.dispose();
    }
  },
);

test(
  'root hover dispatch leaves unused hit transforms lazy while preserving annotation and handler coordinates',
  { timeout },
  () => {
    const f = fixture(),
      entered = [],
      hovered = [],
      exited = [],
      descriptor = Object.getOwnPropertyDescriptor(HitTestEntry.prototype, 'transform');
    let unused = 0;
    let child = new MouseRegion(new SizedBox(20, 20), {
      onEnter: (event) => entered.push(event.localPosition),
      onHover: (event) => hovered.push(event.localPosition),
      onExit: (event) => exited.push(event.localPosition),
    });
    for (let depth = 0; depth < 16; depth++) child = new Padding(EdgeInsets.all(1), child);
    try {
      f.set(child);
      const pending = [f.root.pipeline.root];
      let semanticAncestors = 0;
      while (pending.length) {
        const render = pending.pop();
        if (render.constructor.name === 'RenderPadding')
          render.semantics = {
            id: 'hover-ancestor-' + semanticAncestors++,
            role: 'text',
            name: 'Ancestor',
            enabled: true,
          };
        pending.push(...render.children);
      }
      assert.equal(semanticAncestors, 16);
      f.frame();
      Object.defineProperty(HitTestEntry.prototype, 'transform', {
        ...descriptor,
        get() {
          const value = descriptor.get.call(this);
          if (
            value !== null &&
            this.target instanceof RenderObject &&
            this.target.handleEvent === RenderObject.prototype.handleEvent &&
            this.target.onPointer === undefined
          )
            unused++;
          return value;
        },
      });
      for (const [x, y] of [
        [17, 17],
        [18, 18],
      ])
        f.root.pointer({
          kind: 'hover',
          pointer: 91,
          device: 'mouse',
          buttons: 0,
          x,
          y,
          timestamp: f.root.context.clock.now(),
          viewportGeneration: 1,
        });
      f.root.pointer({
        kind: 'leave',
        pointer: 91,
        device: 'mouse',
        buttons: 0,
        x: 19,
        y: 19,
        timestamp: f.root.context.clock.now(),
        viewportGeneration: 1,
      });
      assert.equal(unused, 0, 'No-op ancestors must not materialize transforms for MouseTracker');
      assert.deepEqual(entered, [new Offset(1, 1)]);
      assert.deepEqual(hovered, [new Offset(1, 1), new Offset(2, 2)]);
      assert.deepEqual(exited, [new Offset(3, 3)]);
    } finally {
      Object.defineProperty(HitTestEntry.prototype, 'transform', descriptor);
      f.close();
    }
  },
);

test(
  'cursor-only mouse motion avoids duplicate source events and still activates the requested system cursor',
  { timeout },
  () => {
    const calls = [],
      channel = {
        invokeMethod(method, args) {
          calls.push([method, args]);
          return Promise.resolve();
        },
      },
      annotation = {
        handleEvent() {},
        validForMouseTracker: true,
        cursor: SystemMouseCursors.text,
      },
      path = [{ target: annotation, transform: identity }],
      tracker = new MouseTracker(() => path, 7, channel);
    let reads = 0;
    const event = (x) => ({
      kind: 'hover',
      pointer: 1,
      device: 'mouse',
      buttons: 0,
      x,
      y: 4,
      timestamp: 1,
      viewportGeneration: 1,
      get globalPosition() {
        reads++;
        return { x: this.x, y: this.y };
      },
    });
    try {
      tracker.updateWithEvent(event(3), path);
      tracker.updateWithEvent(event(5), path);
      assert.equal(reads, 0, 'Cursor-only updates must not construct source geometry');
      assert.equal(calls.length, 1);
      assert.equal(calls[0][0], 'activateSystemCursor');
      assert.equal(calls[0][1].get('kind'), 'text');
      tracker.clearDevices();
      assert.equal(tracker.mouseIsConnected, false);
    } finally {
      tracker.dispose();
    }
  },
);

test(
  'custom cursor update hooks and actual enter/exit handlers retain their source pointer events',
  { timeout },
  () => {
    const original = MouseCursorManager.prototype.handleDeviceCursorUpdate,
      events = [],
      entered = [],
      exited = [],
      channel = {
        invokeMethod() {
          return Promise.resolve();
        },
      },
      annotation = {
        handleEvent() {},
        validForMouseTracker: true,
        cursor: SystemMouseCursors.click,
        onEnter: (event) => entered.push(event),
        onExit: (event) => exited.push(event),
      },
      path = [{ target: annotation, transform: identity }],
      tracker = new MouseTracker(() => path, 7, channel);
    MouseCursorManager.prototype.handleDeviceCursorUpdate = function (device, event, candidates) {
      events.push(event);
      return original.call(this, device, event, candidates);
    };
    try {
      tracker.updateWithEvent(
        {
          kind: 'hover',
          pointer: 1,
          device: 'mouse',
          buttons: 0,
          x: 3,
          y: 4,
          timestamp: 1,
          viewportGeneration: 1,
        },
        path,
      );
      assert(events[0] instanceof PointerHoverEvent);
      assert.equal(entered.length, 1);
      assert.equal(entered[0].position.dx, 3);
      tracker.clearDevices();
      assert(events.at(-1) instanceof PointerRemovedEvent);
      assert.equal(exited.length, 1);
    } finally {
      MouseCursorManager.prototype.handleDeviceCursorUpdate = original;
      tracker.dispose();
    }
  },
);
class Builder extends HitTestResult {
  push(matrix) {
    this.pushTransform(matrix);
  }
  offset(value) {
    this.pushOffset(value);
  }
  pop() {
    this.popTransform();
  }
  admit(legacy) {
    return this.addCapturedLegacyEntry(legacy);
  }
}

test(
  'owned affine identity products reuse storage without changing signed zero, extremes or mutable callers',
  { timeout },
  () => {
    for (const values of [
      [1, 0, 0, 1, 13, -17],
      [1e-300, -1e300, 1e300, -1e-300, Number.MAX_VALUE, -Number.MIN_VALUE],
      [-0, 0, -0, 1, -0, 0],
    ]) {
      const captured = captureTransform(values),
        neutral = captureTransform([1, -0, -0, 1, -0, 0]);
      for (const [a, b] of [
        [identity, captured],
        [captured, identity],
        [neutral, captured],
        [captured, neutral],
      ]) {
        assert.deepEqual(multiply(a, b), multiply([...a], [...b]));
        if (!values.some((v) => Object.is(v, -0))) assert.equal(multiply(a, b), captured);
      }
      const external = [...values],
        expected = multiply([...identity], [...values]),
        product = multiply(identity, external);
      external[4] = 71;
      assert.deepEqual(product, expected);
    }
  },
);

test(
  'owned affine products preserve retained snapshots across later products and keep nonfinite arithmetic uncaptured',
  { timeout },
  () => {
    const left = captureTransform([0.75, -0.25, 0.5, 2, 13, -17]),
      right = captureTransform([-0, 0.125, -0.5, 1, -0, 7]),
      expected = multiply([...left], [...right]),
      first = multiply(left, right),
      held = fullTransform(first),
      snapshot = [...held];
    assert.deepEqual(first, expected);
    assert(Object.isFrozen(first));
    assert.equal(captureTransform(first), first);
    const next = multiply(left, captureTransform([2, -0.125, 0.25, 3, 5, -11]));
    assert.notEqual(next, first);
    assert.deepEqual(first, expected);
    assert.deepEqual(held, snapshot);
    assert.equal(fullTransform(first), held);
    const huge = captureTransform([1e308, 0, 0, 1, 0, 0]),
      twice = captureTransform([2, 0, 0, 1, 0, 0]),
      overflow = multiply(huge, twice);
    assert.equal(overflow[0], Infinity);
    assert.equal(Object.isFrozen(overflow), false);
    assert.notEqual(multiply(huge, twice), overflow);
    assert.throws(() => captureTransform(overflow), /finite/);
  },
);

test(
  'internal sliver bridges defer unconsumed transform products and capture the exact final path',
  { timeout },
  () => {
    const local = [0.75, -0.3, 0.2, -2, 40, -50],
      targets = [{ handleEvent() {} }, { handleEvent() {} }];
    class Child extends RenderBox {
      get localTransform() {
        return local;
      }
      hitTest(_position, path, toLocal) {
        for (const target of targets) path.push({ target, transform: toLocal });
        return true;
      }
    }
    const child = new Child(),
      offset = new Offset(13, -17),
      outer = [1, 0, 0, 1, 29, -31],
      source = new SliverHitTestResult(),
      bridge = SliverHitTestResult._forLegacy();
    const hit = (result) =>
      result.addWithAxisOffset({
        paintOffset: new Offset(-3, 5),
        mainAxisOffset: 0,
        crossAxisOffset: 0,
        mainAxisPosition: 0,
        crossAxisPosition: 0,
        hitTest: (r) => SliverHitTestResult.wrap(r)._addBoxChild(child, new Offset(4, 7), offset),
      });
    try {
      hit(source);
      const expected = source.path.map((entry) => multiply(entry.transform, outer)),
        freeze = Object.freeze;
      let fullMatrices = 0;
      Object.freeze = (value) => {
        if (Array.isArray(value) && value.length === 16) fullMatrices++;
        return freeze(value);
      };
      try {
        hit(bridge);
        const path = bridge._toLegacy(outer);
        assert.equal(fullMatrices, 0, 'Unused bridges must not allocate full matrix products');
        const root = new Builder();
        for (const legacy of path) assert(root.admit(legacy));
        assert.equal(fullMatrices, 0, 'Root admission must preserve the captured lazy path too');
        local[4] = 100;
        outer[4] = 200;
        assert.equal(path.length, 2);
        assert.equal(path[0].target, targets[0]);
        assert.deepEqual(path[0].transform, expected[0]);
        assert.deepEqual(path[1].transform, expected[1]);
        assert.equal(path[0].transform, path[0].transform);
        assert.deepEqual(
          root.path.map((entry) => entry.transform),
          expected.map((value) => multiply(value, matrix4Identity)),
        );
        assert.equal(
          new Builder().admit(Object.freeze({ target: targets[0], transform: matrix4Identity })),
          false,
          'A frozen external entry cannot claim captured bridge ownership',
        );
        const create = path[0].createSourceEntry;
        path[0].createSourceEntry = () => new HitTestEntry(targets[0]);
        assert.equal(
          new Builder().admit(path[0]),
          false,
          'A changed factory keeps its original eager protocol',
        );
        path[0].createSourceEntry = create;
      } finally {
        Object.freeze = freeze;
      }
    } finally {
      child.dispose();
    }
  },
);

test(
  'relative render transforms stop at the common ancestor and preserve live offsets, perspective and reparented depth gaps',
  { timeout },
  () => {
    class Box extends RenderBox {
      current = identity;
      reads = 0;
      get localTransform() {
        this.reads++;
        return this.current;
      }
      setupParentData(child) {
        child.parentData ??= new BoxParentData();
      }
    }
    const root = new Box(),
      branch = new Box(),
      left = new Box(),
      right = new Box(),
      child = new Box(),
      deep = new Box(),
      nodes = [root, branch, left, right, child, deep];
    try {
      root.insert(branch);
      branch.setChildren([left, right]);
      left.insert(child);
      child.insert(deep);
      branch.current = [0, 0, 0, 0, 0, 0];
      left.parentData.offset = { x: 11, y: 13 };
      right.parentData.offset = { x: -7, y: 5 };
      child.parentData.offset = { x: 2, y: 3 };
      child.current = [1, 0, 0, 0.002, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
      const local = fullTransform(multiply(translate(2, 3), child.current)),
        toBranch = fullTransform(multiply(translate(11, 13), local));
      for (const node of nodes) node.reads = 0;
      assert.deepEqual(child.getTransformTo(left), local);
      assert.equal(branch.reads, 0);
      assert.equal(root.reads, 0);
      const expected = multiplyMatrix4(inverseMatrix4(fullTransform(translate(-7, 5))), toBranch);
      assert.deepEqual(child.getTransformTo(right), expected);
      assert.equal(
        branch.reads,
        0,
        'A singular shared ancestor does not invalidate sibling coordinates',
      );
      assert.equal(root.reads, 0);
      right.current = [0, 0, 0, 0, 0, 0];
      assert.deepEqual(child.getTransformTo(right), Array(16).fill(0));
      right.current = identity;
      child.current[12] = 29;
      assert.equal(child.getTransformTo(left)[12], 31);
      const previousDepth = deep.depth;
      child.remove(deep);
      root.insert(deep);
      deep.parentData.offset = { x: 17, y: -19 };
      assert.equal(deep.depth, previousDepth);
      assert.deepEqual(deep.getTransformTo(root), fullTransform(translate(17, -19)));
      root.current = [2, 0, 0, 3, 4, 5];
      assert.deepEqual(
        deep.getTransformTo(),
        fullTransform(multiply(root.current, translate(17, -19))),
      );
      assert.equal(deep.getTransformTo(deep), matrix4Identity);
      class OpaqueDepth extends Box {
        get depth() {
          throw Error('A relative transform must not need the diagnostic depth getter');
        }
      }
      const opaque = new OpaqueDepth();
      nodes.push(opaque);
      root.insert(opaque);
      opaque.parentData.offset = { x: 23, y: 29 };
      assert.deepEqual(opaque.getTransformTo(root), fullTransform(translate(23, 29)));
      const other = new Box();
      try {
        assert.throws(() => deep.getTransformTo(other), /share a render tree/);
      } finally {
        other.dispose();
      }
    } finally {
      for (const node of nodes) node.setChildren([]);
      for (const node of nodes.reverse()) node.dispose();
    }
  },
);

test(
  'owned box translations reuse paint inverses and reread offsets and virtual mutable transforms',
  { timeout },
  () => {
    class Box extends RenderBox {
      get childMatrix() {
        return this.current ?? identity;
      }
      get localTransform() {
        return this.childMatrix;
      }
      matrix(child) {
        return this.childTransform(child);
      }
    }
    class MutableData extends BoxParentData {
      value = { x: 0, y: 0 };
      get offset() {
        return this.value;
      }
      set offset(value) {
        this.value = value;
      }
    }
    const parent = new Box(),
      child = new Box();
    child.parentData = new MutableData();
    const first = parent.matrix(child),
      firstInverse = inversePaintTransform(first);
    assert(Object.isFrozen(first));
    assert.equal(parent.matrix(child), first);
    assert.equal(inversePaintTransform(first), firstInverse);
    assert.deepEqual(firstInverse, inverse(first));
    child.parentData.offset = { x: 13, y: -17 };
    const moved = parent.matrix(child);
    assert.notEqual(moved, first);
    assert.deepEqual(moved, multiply(translate(13, -17), identity));
    assert.equal(parent.matrix(child), moved);
    child.parentData.offset.x = 29;
    assert.equal(parent.matrix(child)[4], 29);
    assert.equal(moved[4], 13);
    for (const [x, y] of [
      [-0, -0],
      [Number.MIN_VALUE, -Number.MIN_VALUE],
      [Number.MAX_VALUE, -Number.MAX_VALUE],
      [0, 17],
      [-19, 0],
    ]) {
      child.parentData.offset = { x, y };
      const value = parent.matrix(child);
      assert.deepEqual(value, multiply(translate(x, y), identity));
      assert.equal(captureTransform(value), value);
      assert.equal(parent.matrix(child), value);
    }
    child.parentData.offset = { x: 29, y: -17 };
    child.current = [1, 0, 0, 1, 3, 4];
    assert.equal(parent.matrix(child)[4], 32);
    child.current[4] = 8;
    assert.equal(parent.matrix(child)[4], 37);
    for (const matrix of [
      [1, -0, 0, 1, -0, 0],
      [0, 0, 0, 0, 0, 0],
      [1e-309, 0, 0, 1, 0, 0],
    ]) {
      const owned = captureTransform(matrix);
      assert.deepEqual(inversePaintTransform(owned), inverse(matrix));
    }
    const external = [1, 0, 0, 1, 5, 6];
    assert.equal(inversePaintTransform(external)[4], -5);
    external[4] = 18;
    assert.equal(inversePaintTransform(external)[4], -18);
    const a = captureTransform([1, -0, 0.3, 2, 13, -17]),
      b = captureTransform([2, 0.1, -0.4, 3, 0, 0]),
      product = multiply(a, b);
    assert.equal(multiply(a, b), product);
    assert(Object.isFrozen(product));
    assert.deepEqual(product, multiply([...a], [...b]));
    const changing = [...b];
    multiply(a, changing);
    changing[4] = 31;
    assert.deepEqual(multiply(a, changing), multiply([...a], [...changing]));
    const huge = captureTransform([1e308, 0, 0, 1, 0, 0]),
      twice = captureTransform([2, 0, 0, 1, 0, 0]);
    assert.equal(multiply(huge, twice)[0], Infinity);
  },
);

test(
  'captured transforms retain owned immutable storage while external and arithmetic arrays remain independent',
  { timeout },
  () => {
    for (const external of [
      [1, -0, 0, 1, 13, -17],
      new Float64Array(matrix4Identity),
      Object.freeze([...matrix4Identity]),
    ]) {
      const captured = captureTransform(external);
      assert.notEqual(captured, external);
      assert(Object.isFrozen(captured));
      assert.equal(captureTransform(captured), captured);
      if (captured.length === 16) assert.equal(captureMatrix4(captured), captured);
      else {
        assert.equal(fullTransform(captured), fullTransform(captured));
        assert(Object.is(fullTransform(captured)[1], -0));
      }
      if (!Object.isFrozen(external)) {
        external[0] = 8;
        assert.equal(captured[0], 1);
        assert.equal(captureTransform(external)[0], 8);
      }
    }
    assert.equal(captureTransform(identity), identity);
    assert.equal(captureMatrix4(matrix4Identity), matrix4Identity);
    const product = multiplyMatrix4(matrix4Identity, matrix4Identity);
    assert.equal(captureTransform(product), product);
    for (const value of [translate(2, 3), multiply(identity, [1, 0, 0, 1, 2, 3])]) {
      const captured = captureTransform(value),
        expanded = fullTransform(value);
      value[4] = 41;
      assert.equal(captured[4], 2);
      assert.equal(expanded[12], 2);
      assert.equal(fullTransform(value)[12], 41);
      assert.equal(captureTransform(value)[4], 41);
    }
  },
);

test(
  'matrix admission checks actual iterable storage and rejects malformed or nonfinite captured values',
  { timeout },
  () => {
    for (const length of [6, 16])
      for (const count of [length - 1, length + 1]) {
        const input = {
          length,
          *[Symbol.iterator]() {
            yield* Array(count).fill(1);
          },
        };
        assert.throws(() => captureTransform(input), /six|sixteen/);
        if (length === 16) assert.throws(() => captureMatrix4(input), /sixteen/);
      }
    for (const length of [6, 16]) {
      const matrix = Array(length).fill(0);
      matrix[0] = NaN;
      assert.throws(() => captureTransform(Object.freeze(matrix)), /finite/);
    }
    for (let lane = 0; lane < 6; lane++)
      for (const invalid of [NaN, Infinity, -Infinity]) {
        const matrix = [1, 0, 0, 1, 0, 0];
        matrix[lane] = invalid;
        assert.throws(
          () => captureTransform(Object.freeze(matrix)),
          /finite/,
          'Affine lane ' + lane + ' must be validated',
        );
      }
  },
);
test(
  'root hit entries retain the exact full matrix product, signed-zero normalization and captured caller values',
  { timeout },
  () => {
    const matrices = [
      [1, 0, 0, 1, 0, 0],
      [-0, -0, 0, -0, -0, 0],
      [0.75, -0.3, 0.2, -2, 400, -50],
      [1e-120, 1e120, -1e120, 1e-120, -1e100, 1e100],
      [...matrix4Identity],
      [1, -0, 5e-11, 0.01, 0, -1, 0, -0.02, 0, 0, 1, 0, -0, 50, 0, 2],
      [-0, -0, -0, -0, -0, -0, -0, -0, -0, -0, 1, -0, -0, -0, -0, -0],
    ];
    const result = new Builder();
    for (const input of matrices) {
      const expected = multiply(captureTransform(input), matrix4Identity);
      result.push(input);
      input[0] = 7;
      const entry = new HitTestEntry(target);
      result.add(entry);
      assert.equal(entry.transform.length, 16);
      assert.deepEqual(entry.transform, expected);
      assert(Object.isFrozen(entry.transform));
      result.pop();
    }
    const root = new HitTestEntry(target);
    result.add(root);
    assert.equal(root.transform, matrix4Identity);
    assert.throws(() => result.add(root), /only be added once/);
  },
);
test(
  'nested matrix/offset parts, wrapped results and later sibling entries preserve independent accumulated transforms',
  { timeout },
  () => {
    const result = new Builder(),
      wrapped = new Builder(result),
      first = [1, 0, 0, 1, 20, -10],
      second = [2, 0.1, -0.4, 3, 0, 0];
    let expected = matrix4Identity;
    result.push(first);
    expected = multiply(captureTransform(first), expected);
    wrapped.offset(new Offset(-3, 4));
    expected = multiply([1, 0, 0, 1, -3, 4], expected);
    wrapped.push(second);
    expected = multiply(captureTransform(second), expected);
    const nested = new HitTestEntry(target);
    wrapped.add(nested);
    assert.deepEqual(nested.transform, expected);
    wrapped.pop();
    result.pop();
    const sibling = new HitTestEntry(target);
    result.add(sibling);
    assert.deepEqual(sibling.transform, multiply(captureTransform(first), matrix4Identity));
    assert.deepEqual(nested.transform, expected);
    result.pop();
    assert.deepEqual(result.path, [nested, sibling]);
    assert(Object.isFrozen(result.path));
    assert.throws(() => result.pop(), /base hit-test/);
    const outside = [...matrix4Identity];
    outside[2] = 1;
    assert.throws(() => result.push(outside), /isolated XY plane/);
    assert.throws(() => result.push([1, 0, 0, 1, NaN, 0]), /finite/);
  },
);
test(
  'unconsumed root hit paths defer full matrix storage while nested consumers share the captured result',
  { timeout },
  () => {
    const result = new Builder(),
      matrix = [1, 0, 0, 1, 13, 17],
      freeze = Object.freeze;
    let matrices = 0;
    Object.freeze = (value) => {
      if (Array.isArray(value) && value.length === 16) matrices++;
      return freeze(value);
    };
    try {
      result.push(matrix);
      const first = new HitTestEntry(target),
        second = new HitTestEntry(target);
      result.add(first);
      result.add(second);
      assert.equal(
        matrices,
        0,
        'Unused no-op hit targets must not allocate full identity products',
      );
      matrix[4] = 100;
      const initial = first.transform;
      assert.equal(matrices, 1);
      assert.equal(second.transform, initial);
      assert.equal(first.transform, initial);
      assert.equal(initial[12], 13);
      result.push([2, 0, 0, 2, 0, 0]);
      const nested = new HitTestEntry(target);
      result.add(nested);
      assert.deepEqual(nested.transform, multiply(captureTransform([2, 0, 0, 2, 0, 0]), initial));
      result.pop();
      result.pop();
      assert.equal(second.transform, initial);
      assert.equal(initial[13], 17);
    } finally {
      Object.freeze = freeze;
    }
  },
);
test(
  'a deferred first entry preserves immediate nested overflow failure and the caller pop protocol',
  { timeout },
  () => {
    const result = new Builder(),
      first = new HitTestEntry(target);
    result.push([1e308, 0, 0, 1, 0, 0]);
    result.add(first);
    result.push([2, 0, 0, 1, 0, 0]);
    assert.throws(() => result.add(new HitTestEntry(target)), /finite/);
    result.pop();
    result.pop();
    const root = new HitTestEntry(target);
    result.add(root);
    assert.equal(root.transform, matrix4Identity);
    assert.equal(first.transform[0], 1e308);
    assert.deepEqual(result.path, [first, root]);
  },
);
