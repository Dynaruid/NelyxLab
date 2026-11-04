// SPDX-License-Identifier: BSD-3-Clause
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawnSync } from 'node:child_process';
import { windowsCompilerEnvironment } from '../../sdk/tooling/cli/src/windows-static-hermes.mjs';
import { execute } from '../../sdk/tooling/cli/src/commands.mjs';
import { createPointerTargetsService } from '@nelyx/skia-native/pointer-targets';
import { RenderObject, RenderBox, PipelineOwner } from '@nelyx/core/framework/rendering/object';
import {
  RenderPointerListener,
  HitTestBehavior,
} from '@nelyx/core/framework/rendering/pointer-listener';
import {
  captureTransform,
  identity,
  inverse,
  inversePaintTransform,
  multiply,
  transform,
  createPointerPosition,
  isOwnedPointerPosition,
} from '@nelyx/core/ui/geometry';
import { BoxConstraints } from '@nelyx/core/framework/rendering/constraints';
const timeout = 1_200_000;
test('explicit pointer selection fails without its native version/session', { timeout }, () => {
  assert.throws(() => createPointerTargetsService({}, 1, () => {}), /capability missing/);
});
test('point provenance follows live services, including failed native close', { timeout }, () => {
  assert.equal(isOwnedPointerPosition(transform(identity, { x: 1, y: 2 })), false);
  const api = {
    nelyxPointerTargetsVersion: () => 2,
    nelyxPointerTargetsSession: () => ({ close() {} }),
  };
  const first = createPointerTargetsService(api, 1, () => {}),
    second = createPointerTargetsService(api, 2, () => {}),
    point = transform(identity, { x: 1, y: 2 });
  assert.equal(isOwnedPointerPosition(point), true);
  first.dispose();
  first.dispose();
  assert.equal(isOwnedPointerPosition(point), true);
  second.dispose();
  assert.equal(isOwnedPointerPosition(point), false);
  const failed = createPointerTargetsService(
    {
      ...api,
      nelyxPointerTargetsSession: () => ({
        close() {
          throw new Error('native close failed');
        },
      }),
    },
    3,
    () => {},
  );
  const last = createPointerPosition(1, 2);
  assert.equal(isOwnedPointerPosition(last), true);
  assert.throws(() => failed.dispose(), /native close failed/);
  assert.equal(isOwnedPointerPosition(last), false);
});
test(
  'C++ hit paths match live TS hooks, changes between events, opaque/translucent order, and unchanged trees send no patch',
  { timeout, skip: process.platform !== 'win32' },
  async () => {
    const parent = fs.realpathSync(os.tmpdir()),
      directory = fs.mkdtempSync(path.join(parent, 'nelyx-pointer-targets-'));
    try {
      const executable = path.join(directory, 'pointer.exe'),
        env = windowsCompilerEnvironment();
      await execute(
        'cl.exe',
        [
          '/nologo',
          '/std:c++20',
          '/O2',
          '/fp:strict',
          '/EHsc',
          '/MD',
          '/DNOMINMAX',
          '/I' + path.resolve(import.meta.dirname, '../../skia/native/host'),
          '/I' + path.resolve(import.meta.dirname, '../../skia/native/core'),
          path.join(import.meta.dirname, 'scroll-coordinator-native.cpp'),
          '/Fe' + executable,
        ],
        { cwd: directory, env, timeout },
      );
      let nativeCalls = 0;
      const api = {
        nelyxPointerTargetsVersion: () => 2,
        nelyxPointerTargetsSession(generation) {
          const trees = new Map();
          return {
            patch(bytes) {
              const p = Array.from(new Float64Array(bytes)),
                old = trees.get(p[3]) ?? [];
              old.length = p[5];
              for (let i = 7; i < p.length; i += 8) old[p[i] - 1] = p.slice(i, i + 8);
              trees.set(p[3], old);
            },
            query(bytes) {
              nativeCalls++;
              const q = new Float64Array(bytes),
                rows = trees.get(q[1]),
                p = new Float64Array([
                  0x4e4c5054,
                  2,
                  generation,
                  q[1],
                  q[2],
                  rows.length,
                  rows.length,
                  ...rows.flat(),
                ]);
              const sizes = Buffer.alloc(8);
              sizes.writeUInt32LE(p.length);
              sizes.writeUInt32LE(q.length, 4);
              const result = spawnSync(executable, ['pointer', 'query'], {
                cwd: directory,
                env,
                timeout,
                windowsHide: true,
                input: Buffer.concat([sizes, Buffer.from(p.buffer), Buffer.from(bytes)]),
              });
              assert.equal(result.status, 0, result.stderr.toString());
              return Array.from({ length: result.stdout.length / 8 }, (_, i) =>
                result.stdout.readDoubleLE(i * 8),
              );
            },
            drop(id) {
              trees.delete(id);
            },
            close() {
              trees.clear();
            },
          };
        },
      };
      const service = createPointerTargetsService(api, 7, () => {}, {
          strategy: 'closed-reference',
        }),
        pipeline = new PipelineOwner(),
        root = new RenderBox(),
        bottom = new RenderBox(),
        top = new RenderPointerListener({ behavior: HitTestBehavior.translucent });
      root.size = bottom.size = top.size = { width: 100, height: 100 };
      bottom.onPointer = () => {};
      root.setChildren([bottom, top]);
      pipeline.setRoot(root);
      const query = (native, matrix = identity) => {
        pipeline.pointerTargets = native ? service : undefined;
        const result = [];
        const hit = root.hitTest(createPointerPosition(9.25, 7.5), result, matrix);
        return {
          hit,
          result: result.map((e) => [
            e.target === root ? 'root' : e.target === top ? 'top' : 'bottom',
            [...e.transform],
          ]),
        };
      };
      const compare = () => assert.deepEqual(query(true), query(false));
      try {
        compare();
        const patches = service.execution().patches;
        compare();
        assert.equal(service.execution().patches, patches);
        for (const behavior of HitTestBehavior.values) {
          top.behavior = behavior;
          compare();
        }
        top.parentData.offset = { x: 200.3, y: -0 };
        compare();
        top.parentData.offset = { x: 1.25, y: 2.5 };
        compare();
        assert.deepEqual(
          query(true, captureTransform([1.1, 0.2, -0.3, 0.9, 10.5, -3.75])),
          query(false, captureTransform([1.1, 0.2, -0.3, 0.9, 10.5, -3.75])),
        );
        const inherited = Object.getOwnPropertyDescriptor(RenderBox.prototype, 'size');
        let reads = [];
        Object.defineProperty(top, 'size', {
          configurable: true,
          get() {
            reads.push('top-size');
            bottom.parentData.offset = { x: 2, y: 0 };
            return inherited.get.call(this);
          },
        });
        reads = [];
        const actual = query(true),
          actualReads = reads;
        bottom.parentData.offset = { x: 0, y: 0 };
        reads = [];
        const expected = query(false);
        assert.deepEqual(actual, expected);
        assert.deepEqual(actualReads, reads);
        delete top.size;
        const topPrototype = Object.getPrototypeOf(top);
        try {
          Object.setPrototypeOf(
            top,
            new Proxy(topPrototype, {
              get(target, key, receiver) {
                if (key === 'hitTest') reads.push('proxy-hit');
                return Reflect.get(target, key, receiver);
              },
            }),
          );
          reads = [];
          const nativeProxy = query(true),
            nativeReads = reads;
          reads = [];
          assert.deepEqual(nativeProxy, query(false));
          assert.deepEqual(nativeReads, reads);
        } finally {
          Object.setPrototypeOf(top, topPrototype);
        }
        const oldHit = RenderBox.prototype.hitTest;
        try {
          RenderBox.prototype.hitTest = function (...args) {
            reads.push('override');
            return oldHit.apply(this, args);
          };
          reads = [];
          const a = query(true),
            ar = reads;
          reads = [];
          assert.deepEqual(a, query(false));
          assert.deepEqual(ar, reads);
        } finally {
          RenderBox.prototype.hitTest = oldHit;
        }
        assert(nativeCalls > 0);
        assert(service.execution().tsFallbacks > 0);
        assert(service.execution().paths > 0);
      } finally {
        pipeline.setRoot(undefined);
        root.dispose();
        pipeline.dispose();
        service.dispose();
      }
      const prefix = createPointerTargetsService(api, 7, () => {}),
        owner = new PipelineOwner(),
        outer = new RenderBox(),
        middle = new RenderPointerListener({ behavior: HitTestBehavior.translucent }),
        boundary = new RenderBox();
      let leafReturns = true,
        lastEntries,
        trace = [],
        rootPoint,
        change;
      class CustomLeaf extends RenderBox {
        hitTest(point, result, matrix) {
          trace.push(['leaf', point.x, point.y]);
          change?.();
          result.push({ target: this, transform: matrix });
          return leafReturns;
        }
      }
      const leaf = new CustomLeaf();
      for (const node of [outer, middle, boundary, leaf]) node.size = { width: 100, height: 100 };
      outer.setChildren([middle]);
      middle.setChildren([boundary]);
      boundary.setChildren([leaf]);
      middle.parentData.offset = { x: 1.25, y: 2.5 };
      boundary.parentData.offset = { x: 3.5, y: 4.25 };
      Object.defineProperty(outer, 'hitTestSelf', {
        configurable: true,
        get() {
          trace.push('outer-self-get');
          return (point) => {
            trace.push(['outer-self', point === rootPoint, point.x]);
            return true;
          };
        },
      });
      Object.defineProperty(middle, 'hitTestSelf', {
        configurable: true,
        get() {
          trace.push('middle-self-get');
          return (point) => {
            trace.push(['middle-self', point.x]);
            return false;
          };
        },
      });
      owner.setRoot(outer);
      const prefixQuery = (enabled, matrix = identity, point = { x: 9.25, y: 17.5 }) => {
        owner.pointerTargets = enabled ? prefix : undefined;
        trace = [];
        rootPoint = createPointerPosition(point.x, point.y);
        const entries = [];
        const hit = outer.hitTest(rootPoint, entries, matrix);
        lastEntries = entries;
        return {
          hit,
          trace,
          entries: entries.map((entry) => [
            [outer, middle, boundary, leaf].indexOf(entry.target),
            [...entry.transform],
          ]),
        };
      };
      try {
        // Uncaptured JS matrices bypass the shared inverse/product caches.
        // This oracle cannot consume a result previously admitted by native.
        for (const incoming of [
          identity,
          captureTransform([1, -0, -0, 1, -0, 0]),
          captureTransform([1.1, 0.2, -0.3, 0.9, 10.5, -3.75]),
        ]) {
          const rows = [
            [1, 0, 100, 100, 0, 0, 0, 0],
            [2, 1, 100, 100, 0, -0, 3, 0],
            [3, 2, 0, 0, 1.25, 2.5, 4, 0],
          ];
          const value = prefix.prefix({}, rows, 9.25, 17.5, incoming);
          let point = { x: 9.25, y: 17.5 },
            matrix = incoming;
          assert.equal(value.terminal, 3);
          for (let i = 0; i < rows.length; i++) {
            assert.deepEqual(value.steps[i].position, point);
            assert.deepEqual([...value.steps[i].transform], [...matrix]);
            if (i + 1 < rows.length) {
              const row = rows[i + 1],
                inv = inverse([1, 0, 0, 1, 0 + row[4], 0 + row[5]]);
              point = transform(inv, point);
              matrix = multiply(inv, matrix);
            }
          }
        }
        assert.deepEqual(prefixQuery(true), prefixQuery(false));
        assert(prefix.execution().prefixQueries > 0);
        assert(prefix.execution().prefixNodes >= 2);
        const proxyQuery = (enabled) => {
          owner.pointerTargets = enabled ? prefix : undefined;
          trace = [];
          rootPoint = new Proxy(
            { x: 9.25, y: 17.5 },
            {
              getOwnPropertyDescriptor(target, key) {
                trace.push(['point-descriptor', String(key)]);
                return Reflect.getOwnPropertyDescriptor(target, key);
              },
            },
          );
          outer.hitTest(rootPoint, [], identity);
          return trace;
        };
        assert.deepEqual(proxyQuery(true), proxyQuery(false));
        const baseChildren = Object.getOwnPropertyDescriptor(RenderObject.prototype, 'children');
        const beforeCustomChildren = nativeCalls;
        try {
          Object.defineProperty(RenderObject.prototype, 'children', {
            ...baseChildren,
            get() {
              trace.push(['children', [outer, middle, boundary, leaf].indexOf(this)]);
              return baseChildren.get.call(this);
            },
          });
          assert.deepEqual(prefixQuery(true), prefixQuery(false));
          assert.equal(nativeCalls, beforeCustomChildren);
          assert(prefix.execution().fallbackReasons['base-children-protocol'] > 0);
        } finally {
          Object.defineProperty(RenderObject.prototype, 'children', baseChildren);
        }
        const parentGetter = Object.getOwnPropertyDescriptor(RenderObject.prototype, 'parent').get;
        try {
          Object.defineProperty(middle, 'parent', {
            configurable: true,
            get() {
              trace.push('middle-parent');
              return parentGetter.call(this);
            },
          });
          const before = nativeCalls;
          assert.deepEqual(prefixQuery(true), prefixQuery(false));
          assert.equal(nativeCalls, before);
        } finally {
          delete middle.parent;
        }
        const patches = prefix.execution().patches;
        assert.deepEqual(prefixQuery(true), prefixQuery(false));
        assert.equal(prefix.execution().patches, patches);
        prefixQuery(false);
        const previousTransforms = lastEntries.map((entry) => entry.transform);
        prefixQuery(true);
        assert.equal(lastEntries.length, previousTransforms.length);
        lastEntries.forEach((entry, i) =>
          assert.equal(
            entry.transform,
            previousTransforms[i],
            'Native results share the existing TS product cache',
          ),
        );
        change = () => {
          rootPoint.x = 25;
          middle.behavior = HitTestBehavior.opaque;
        };
        middle.behavior = HitTestBehavior.translucent;
        const mutated = prefixQuery(true);
        middle.behavior = HitTestBehavior.translucent;
        assert.deepEqual(mutated, prefixQuery(false));
        change = undefined;
        const oldTranslucent = HitTestBehavior.translucent;
        leafReturns = false;
        middle.behavior = oldTranslucent;
        try {
          HitTestBehavior.translucent = HitTestBehavior.opaque;
          assert.deepEqual(prefixQuery(true), prefixQuery(false));
        } finally {
          HitTestBehavior.translucent = oldTranslucent;
        }
        leafReturns = true;
        middle.size = { width: 1, height: 1 };
        assert.deepEqual(prefixQuery(true), prefixQuery(false));
        const missedInverse = inversePaintTransform(outer.childTransform(middle)),
          firstIncoming = captureTransform([1, 0, 0, 1, 0.25, 0.5]),
          secondIncoming = captureTransform([1, 0, 0, 1, 0.75, 1.5]);
        const missReusesOldProduct = (enabled) => {
          const previous = multiply(missedInverse, firstIncoming);
          prefixQuery(enabled, secondIncoming);
          return multiply(missedInverse, firstIncoming) === previous;
        };
        assert.equal(missReusesOldProduct(false), false);
        assert.equal(
          missReusesOldProduct(true),
          false,
          'A bounds miss must still replace the original one-product cache before self hooks',
        );
        middle.size = { width: 100, height: 100 };
        const affine = captureTransform([1.1, 0.2, -0.3, 0.9, 10.5, -3.75]);
        assert.deepEqual(prefixQuery(true, affine), prefixQuery(false, affine));
        middle.parentData.offset = { x: -0, y: 0 };
        boundary.parentData.offset = { x: 0, y: -0 };
        for (const matrix of [
          identity,
          captureTransform([1, -0, -0, 1, -0, 0]),
          captureTransform([-1, 0, -0, -1, 0, -0]),
        ]) {
          assert.deepEqual(
            prefixQuery(true, matrix, { x: -0, y: -0 }),
            prefixQuery(false, matrix, { x: -0, y: -0 }),
          );
        }
        const bottom = new RenderBox();
        bottom.size = { width: 100, height: 100 };
        bottom.onPointer = () => {};
        boundary.setChildren([bottom, leaf]);
        leafReturns = false;
        change = () => {
          bottom.parentData.offset = { x: 200, y: 0 };
        };
        bottom.parentData.offset = { x: 0, y: 0 };
        const sibling = prefixQuery(true);
        bottom.parentData.offset = { x: 0, y: 0 };
        assert.deepEqual(sibling, prefixQuery(false));
        change = undefined;
        leafReturns = true;
        boundary.setChildren([leaf]);
        bottom.dispose();
        middle.parentData.offset = { x: -Number.MAX_VALUE, y: 0 };
        const huge = captureTransform([1, 0, 0, 1, Number.MAX_VALUE, 0]);
        assert.deepEqual(prefixQuery(true, huge), prefixQuery(false, huge));
        assert(prefix.execution().fallbackReasons['nonfinite-prefix'] > 0);
        middle.parentData.offset = { x: 0, y: 0 };
        Object.defineProperty(outer, 'performLayout', {
          value() {
            const before = nativeCalls;
            for (const enabled of [true, false])
              assert.throws(() => prefixQuery(enabled), /parentUsesSize true/);
            assert.equal(nativeCalls, before);
            return { width: 100, height: 100 };
          },
        });
        outer.layout(BoxConstraints.tight({ width: 100, height: 100 }));
        assert(prefix.execution().fallbackReasons['layout-query'] > 0);
      } finally {
        owner.setRoot(undefined);
        outer.dispose();
        owner.dispose();
        prefix.dispose();
      }
    } finally {
      assert.equal(path.dirname(fs.realpathSync(directory)), parent);
      assert(!fs.lstatSync(directory).isSymbolicLink());
      fs.rmSync(directory, { recursive: true, force: true });
    }
  },
);
