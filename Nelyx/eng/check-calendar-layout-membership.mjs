// SPDX-License-Identifier: BSD-3-Clause
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { execute } from '../sdk/tooling/cli/src/commands.mjs';

// Use the actual parent values read by the existing guard. The shadow cache
// never authorizes a mutation. Record the most optimistic reusable suffix,
// even for custom nodes, so this bounds the opportunities for a narrower patch.
function observeWalk(source) {
  function replace(before, after) {
    assert.equal(source.split(before).length, 2, 'unexpected emit at ' + before);
    source = source.replace(before, after);
  }
  replace(
    'layoutMutationAllowed() {',
    'layoutMutationAllowed() { globalThis.membershipTrial.calls++;',
  );
  replace(
    'let node = this;\n        while (node) {\n            if (node === scope.root)',
    'const path = []; let node = this;\n        while (node) {\n            if (node === scope.root)',
  );
  replace(
    'if (node === scope.root)\n                return true;\n            node = node.parent;',
    'if (node === scope.root) { globalThis.membershipTrial.finish(path, scope, true); return true; }\n            path.push(node); node = node.parent;',
  );
  replace(
    'return this.needsLayout && !this.doingLayout;',
    'globalThis.membershipTrial.finish(path, scope, false); return this.needsLayout && !this.doingLayout;',
  );
  for (const edge of ['child.renderParent = undefined;', 'this.pipelineOwner = undefined;'])
    replace(edge, 'globalThis.membershipTrial.invalidate(activeLayoutCallbacks); ' + edge);
  return source;
}

async function run(mode) {
  const target = import.meta.resolve('@nelyx/core/framework/rendering/object');
  const hooks =
    mode === 'walk' &&
    registerHooks({
      load(url, context, next) {
        const result = next(url, context);
        if (url !== target) return result;
        return {
          ...result,
          source: observeWalk(Buffer.from(result.source).toString().replaceAll('\r\n', '\n')),
        };
      },
    });
  try {
    const { exercise } = await import('./calendar-midpoint-fixture.mjs');
    const { RenderObject, RenderBox, PipelineOwner } = await import(target);
    const original = RenderObject.prototype.layoutMutationAllowed;
    const cache = new WeakMap();
    const trial = {
      calls: 0,
      visits: 0,
      hits: 0,
      reusableVisits: 0,
      invalidate(scopes) {
        for (const scope of scopes) cache.delete(scope);
      },
      finish(path, scope, success) {
        const known = cache.get(scope) ?? new WeakSet();
        const cut = path.findIndex((node) => known.has(node));
        this.visits += path.length;
        if (cut >= 0) {
          assert(success, 'cached ancestor no longer reaches callback root');
          this.hits++;
          this.reusableVisits += path.length - cut;
        }
        if (success) {
          for (const node of path) known.add(node);
          cache.set(scope, known);
        }
      },
    };
    globalThis.membershipTrial = trial;
    function observe() {
      trial.calls = trial.visits = trial.hits = trial.reusableVisits = 0;
      let ms = 0,
        nested = 0;
      if (mode === 'time')
        RenderObject.prototype.layoutMutationAllowed = function () {
          const outer = nested++ === 0;
          const start = outer ? performance.now() : 0;
          try {
            return original.call(this);
          } finally {
            nested--;
            if (outer) ms += performance.now() - start;
            trial.calls++;
          }
        };
      return {
        stop() {
          if (mode === 'time') RenderObject.prototype.layoutMutationAllowed = original;
        },
        result: () =>
          mode === 'time'
            ? { calls: trial.calls, ms }
            : {
                calls: trial.calls,
                visits: trial.visits,
                hits: trial.hits,
                reusableVisits: trial.reusableVisits,
              },
      };
    }
    for (const direction of ['forward', 'reverse', 'cold'])
      exercise(
        direction,
        observe,
        (label, { firstSceneMs, calls, visits, hits, reusableVisits, ms }) => {
          console.log(
            mode,
            label,
            JSON.stringify({ firstSceneMs, calls, visits, hits, reusableVisits, ms }),
          );
          if (label === 'cold') assert(calls > 0 && (mode === 'time' ? ms > 0 : visits > 0));
        },
      );
    if (mode === 'walk') {
      const { BoxConstraints } = await import('@nelyx/core/framework/rendering/constraints');
      const constraint = BoxConstraints.tight({ width: 10, height: 10 });
      class Box extends RenderBox {
        performLayout(c) {
          if (this.task) this.invokeLayoutCallback(this.task);
          return c.smallest;
        }
      }
      class ObservableParent extends Box {
        get parent() {
          if (this.failRead) throw failure;
          return super.parent;
        }
      }
      const failure = new Error('callback trial');
      const owner = new PipelineOwner({ accessibilityEnabled: false });
      const root = new Box(),
        outer = new Box(),
        inner = new Box(),
        sibling = new Box();
      const branch = new Box(),
        leaf = new ObservableParent();
      root.setChildren([outer, sibling]);
      outer.setChildren([branch, inner]);
      branch.setChildren([leaf]);
      owner.setRoot(root);
      try {
        leaf.layout(constraint);
        outer.task = () => {
          assert(leaf.layoutMutationAllowed());
          inner.task = () => {
            assert.equal(leaf.layoutMutationAllowed(), false);
            throw failure;
          };
          assert.throws(
            () => inner.layout(constraint),
            (e) => e === failure,
          );
          assert(leaf.layoutMutationAllowed());
          leaf.failRead = true;
          assert.throws(
            () => leaf.layoutMutationAllowed(),
            (e) => e === failure,
          );
          leaf.failRead = false;
          outer.remove(branch);
          sibling.insert(branch);
          leaf.layout(constraint);
          assert.equal(leaf.layoutMutationAllowed(), false);
        };
        outer.layout(constraint);
        assert(leaf.layoutMutationAllowed());
        console.log('Nested callback, throwing getter, reentry and ancestor reparent passed');
      } finally {
        owner.setRoot(undefined);
        owner.dispose();
      }
    }
  } finally {
    delete globalThis.membershipTrial;
    if (hooks) hooks.deregister();
  }
}
if (process.argv[2]) {
  assert(['walk', 'time'].includes(process.argv[2]));
  await run(process.argv[2]);
} else {
  for (const mode of ['walk', 'time'])
    await execute(process.execPath, [import.meta.filename, mode], { timeout: 1_200_000 });
}
