// SPDX-License-Identifier: BSD-3-Clause
import assert from 'node:assert/strict';
import { Element, RenderObjectElement, BuildScope } from '@nelyx/core/framework/widgets/framework';
import { RenderObject } from '@nelyx/core/framework/rendering/object';
import { SliverMultiBoxAdaptorElement } from '@nelyx/core/framework/widgets/sliver';
import { DepthQueue } from '../dist/runtime/depth-queue.js';

export function observe(view) {
  const owner = view.buildOwner,
    stack = [],
    restore = [],
    rows = {},
    types = {},
    regions = new WeakMap(),
    reasons = new WeakMap(),
    created = new WeakSet();
  let coveredMs = 0;
  function region(e) {
    if (!e?.widget) return stack.at(-1)?.group ?? 'other';
    let v = regions.get(e);
    if (v) return v;
    const name = e.widget.constructor.name;
    if (name === '_Day') v = 'day';
    else if (e instanceof SliverMultiBoxAdaptorElement) v = 'sliver';
    else if (name === '_DayPicker' || name === '_MonthPicker') v = 'month';
    else if (/Header|ToggleButton/.test(name)) v = 'header';
    else v = e.parent ? region(e.parent) : 'other';
    // mount's first instruction has not assigned the parent yet. Do not cache
    // this provisional attribution across the subsequent build and render hooks.
    if (e.parent || e === view.root) regions.set(e, v);
    return v;
  }
  function timed(op, e, fn) {
    const group = region(e),
      token = { op, e, group, nested: 0 },
      start = performance.now();
    stack.push(token);
    try {
      return fn();
    } finally {
      const elapsed = performance.now() - start,
        exclusive = elapsed - token.nested;
      stack.pop();
      if (stack.length) stack.at(-1).nested += elapsed;
      else coveredMs += elapsed;
      const add = (data, k) => {
        const row = (data[k] ??= [0, 0, 0]);
        row[0]++;
        row[1] += exclusive;
        row[2] += elapsed;
      };
      add(rows, group + ':' + op);
      if (
        group === 'day' &&
        (op === 'renderCreate' ||
          op === 'renderUpdate' ||
          op === 'initialUpdate' ||
          op === 'buildBody')
      )
        add(types, op + ':' + e.widget.constructor.name);
    }
  }
  const previous = globalThis.__w7CalendarMeasure;
  globalThis.__w7CalendarMeasure = (op, e, fn) => {
    if (op === 'renderCreate') created.add(e);
    if (op === 'renderUpdate' && created.delete(e)) op = 'initialUpdate';
    return timed(op, e, fn);
  };
  function patch(obj, k, wrap) {
    const old = obj[k],
      d = Object.getOwnPropertyDescriptor(obj, k);
    assert.equal(typeof old, 'function', k);
    Object.defineProperty(obj, k, { configurable: true, writable: true, value: wrap(old) });
    restore.push(() => (d ? Object.defineProperty(obj, k, d) : delete obj[k]));
  }
  const wrap = (obj, k, op, getE) =>
    patch(
      obj,
      k,
      (old) =>
        function (...a) {
          return timed(op, getE ? getE.call(this, a) : this, () => old.apply(this, a));
        },
    );
  const current = () => owner.currentElement;
  wrap(Element.prototype, 'reconcile', 'matchList');
  wrap(Element.prototype, 'reconcileOneChild', 'matchOne');
  wrap(Element.prototype, 'updateSlotForChild', 'slot');
  wrap(Element.prototype, 'markRenderTreeSyncDirty', 'registerOwner');
  wrap(owner, '_scheduleRenderChildren', 'admitOwner', (a) => a[0]);
  wrap(owner, 'flushRenderTree', 'commit', current);
  wrap(RenderObjectElement.prototype, '_commitRenderChildren', 'compareChildren');
  // These linked-list operations happen only on actual structural changes, unlike
  // a call to move(child,after) which can discover that the slot already matches.
  for (const k of ['linkChild', 'unlink']) wrap(RenderObject.prototype, k, k, current);
  wrap(SliverMultiBoxAdaptorElement.prototype, 'updateChildAt', 'sliverSlot');
  wrap(SliverMultiBoxAdaptorElement.prototype, 'createChild', 'sliverDemand');
  patch(
    BuildScope.prototype,
    '_flushDirtyElements',
    (old) =>
      function (fn, callback, ...rest) {
        return timed('flush', current(), () =>
          old.call(
            this,
            fn,
            callback ? () => timed('scopeCallback', current(), callback) : undefined,
            ...rest,
          ),
        );
      },
  );
  patch(
    DepthQueue.prototype,
    'schedule',
    (old) =>
      function (e) {
        const cause = stack.some((t) => t.op === 'deliver' && t.e === e)
          ? 'parent'
          : stack.some((t) => t.op === 'mount' && t.e === e)
            ? 'mount'
            : 'independent';
        reasons.set(e, cause);
        return timed('schedule/' + cause, e, () => old.call(this, e));
      },
  );
  patch(
    DepthQueue.prototype,
    'pop',
    (old) =>
      function () {
        const e = this.storage.first();
        return timed('pop/' + (reasons.get(e) ?? 'prequeued'), e, () => old.call(this));
      },
  );
  wrap(Element.prototype, 'mount', 'mount');
  let inline;
  if (owner._rebuildChild)
    patch(
      owner,
      '_rebuildChild',
      (old) =>
        function (e, origin) {
          const prior = inline;
          inline = { e, origin };
          try {
            return old.call(this, e, origin);
          } finally {
            inline = prior;
          }
        },
    );
  patch(
    Element.prototype,
    'rebuild',
    (old) =>
      function (...a) {
        const cause = inline?.e === this ? inline.origin : 'dirty';
        try {
          return timed('rebuild/' + cause, this, () => old.apply(this, a));
        } finally {
          created.delete(this);
        }
      },
  );
  wrap(owner, 'flushBuild', 'frameBuild', current);
  wrap(view, 'flushLayout', 'frameLayout', current);
  return {
    stop() {
      assert.equal(stack.length, 0);
      globalThis.__w7CalendarMeasure = previous;
      for (const undo of restore.reverse()) undo();
    },
    result() {
      for (const row of Object.values(types)) row[1] = +row[1].toFixed(3);
      return { coveredMs, rows, dayTypes: types };
    },
  };
}
