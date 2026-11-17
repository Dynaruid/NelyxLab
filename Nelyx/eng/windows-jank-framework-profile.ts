// SPDX-License-Identifier: BSD-3-Clause
// Inlined only by the explicit build diagnostic; no product hooks or tree cache.
import {
  Element as WorkProfileElement,
  StatefulElement as WorkProfileStatefulElement,
  RenderObjectElement as WorkProfileRenderElement,
} from '@nelyx/core/framework/widgets/framework';
import { RenderObject as WorkProfileRenderObject } from '@nelyx/core/framework/rendering/object';

export function installFrameworkWorkProfile(root, host, active) {
  const owner = root.buildOwner,
    patches = [],
    rebuilt = new WeakSet(),
    stack = [];
  let intervals,
    counters,
    invalid = false;
  function reset() {
    if (stack.length) throw Error('Framework work profile reset during work');
    intervals = {};
    counters = { scheduleAttempts: 0, ownerCommits: 0, baseSetChildrenInCommit: 0 };
    invalid = false;
    // A phase reset must not turn existing Elements into first-build Elements.
  }
  reset();
  function measure(kind, receiver, original, args) {
    if (stack.length >= 256) {
      invalid = true;
      throw Error('Framework work profile nesting budget exceeded');
    }
    const entry = { kind, began: host.now(), nested: 0 };
    stack.push(entry);
    let failed = true;
    try {
      const result = original.apply(receiver, args);
      failed = false;
      return result;
    } finally {
      const elapsed = host.now() - entry.began;
      if (stack.pop() !== entry) invalid = true;
      if (stack.length) stack[stack.length - 1].nested += elapsed;
      const value = (intervals[kind] ??= {
        count: 0,
        failed: 0,
        inclusiveMs: 0,
        exclusiveMs: 0,
        maxMs: 0,
      });
      value.count++;
      value.failed += Number(failed);
      value.inclusiveMs += elapsed;
      value.exclusiveMs += elapsed - entry.nested;
      value.maxMs = Math.max(value.maxMs, elapsed);
    }
  }
  function patch(target, name, wrap) {
    const descriptor = Object.getOwnPropertyDescriptor(target, name),
      original = target[name];
    patches.push({ target, name, descriptor });
    Object.defineProperty(target, name, {
      configurable: true,
      writable: true,
      value: wrap(original),
    });
  }
  function observe(target, name, kind) {
    patch(
      target,
      name,
      (original) =>
        function (...args) {
          if (this.owner !== owner || !active()) return original.apply(this, args);
          return measure(kind, this, original, args);
        },
    );
  }
  const element = WorkProfileElement.prototype,
    stateful = WorkProfileStatefulElement.prototype,
    render = WorkProfileRenderElement.prototype;
  // Base mount has no owner yet. The caller passes the actual owner in args[1].
  for (const [target, kind] of [
    [element, 'elementMount'],
    [stateful, 'stateMount'],
    [render, 'renderMount'],
  ])
    patch(
      target,
      'mount',
      (original) =>
        function (...args) {
          if (args[1] !== owner || !active()) return original.apply(this, args);
          return measure(kind, this, original, args);
        },
    );
  patch(
    element,
    'rebuild',
    (original) =>
      function (...args) {
        if (this.owner !== owner) return original.apply(this, args);
        const first = !rebuilt.has(this),
          result = active()
            ? measure(first ? 'firstRebuild' : 'laterRebuild', this, original, args)
            : original.apply(this, args);
        rebuilt.add(this);
        return result;
      },
  );
  for (const [target, name, kind] of [
    [element, 'reconcile', 'reconcile'],
    [element, 'update', 'elementUpdate'],
    [stateful, 'update', 'stateUpdate'],
    [element, 'deactivate', 'elementDeactivate'],
    [stateful, 'deactivate', 'stateDeactivate'],
    [element, 'unmount', 'elementUnmount'],
    [stateful, 'unmount', 'stateUnmount'],
    [render, 'unmount', 'renderUnmount'],
    [render, 'attachRenderObject', 'renderAttach'],
    [render, 'detachRenderObject', 'renderDetach'],
  ])
    observe(target, name, kind);
  patch(
    render,
    '_commitRenderChildren',
    (original) =>
      function (...args) {
        if (this.owner !== owner || !active()) return original.apply(this, args);
        counters.ownerCommits++;
        return measure('ownerCommit', this, original, args);
      },
  );
  for (const [name, kind] of [
    ['_scheduleRenderChildren', 'ownerSchedule'],
    ['flushRenderTree', 'ownerFlush'],
  ])
    patch(
      owner,
      name,
      (original) =>
        function (...args) {
          if (!active()) return original.apply(this, args);
          if (name === '_scheduleRenderChildren') counters.scheduleAttempts++;
          return measure(kind, this, original, args);
        },
    );
  // Count the existing base call only. Never reevaluate a virtual projection or
  // equate absence of this base call with a custom hook being a structural no-op.
  patch(
    WorkProfileRenderObject.prototype,
    'setChildren',
    (original) =>
      function (...args) {
        if (stack.some((entry) => entry.kind === 'ownerCommit')) counters.baseSetChildrenInCommit++;
        return original.apply(this, args);
      },
  );
  return {
    reset,
    snapshot() {
      if (invalid || stack.length) throw Error('Framework work profile observation incomplete');
      return {
        scope: 'diagnostic-only-framework-base-calls',
        intervals: Object.fromEntries(
          Object.entries(intervals).map(([kind, value]) => [kind, { ...value }]),
        ),
        counters: { ...counters },
      };
    },
    dispose() {
      for (const { target, name, descriptor } of patches.reverse()) {
        if (descriptor) Object.defineProperty(target, name, descriptor);
        else delete target[name];
      }
    },
  };
}
