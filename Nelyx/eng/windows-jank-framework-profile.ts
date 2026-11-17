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

// H3 screening: two clock reads per frame, none per collection/descriptor call.
// Keep the normal framework work observer off: its nested method timers would
// distort the small operations being screened. The existing build observer only
// distinguishes frames producing new day Elements from existing-day rebuilds.
export function installRepresentationProfile(root, host, active, conflicts) {
  if (!host.cpuProfileClock) throw Error('Representation profile requires native CPU clocks');
  if (host.definePropertiesProfile) {
    const converted = {},
      partial = {},
      nested = {},
      order = [],
      expected = new Error('descriptor conversion');
    Object.defineProperty(partial, 'locked', { value: 1, configurable: false });
    let stats;
    host.definePropertiesProfile('begin');
    try {
      let failure;
      try {
        Object.defineProperties(converted, {
          first: { value: 1 },
          second: {
            get value() {
              order.push('convert');
              throw expected;
            },
          },
        });
      } catch (error) {
        failure = error;
      }
      if (failure !== expected || Object.hasOwn(converted, 'first'))
        throw Error('Descriptor conversion lost two-stage failure semantics');
      failure = undefined;
      try {
        Object.defineProperties(partial, { first: { value: 2 }, locked: { value: 2 } });
      } catch (error) {
        failure = error;
      }
      if (!(failure instanceof TypeError) || partial.first !== 2 || partial.locked !== 1)
        throw Error('Descriptor application lost partial failure semantics');
      const outer = Object.defineProperties(
        {},
        {
          value: {
            get value() {
              order.push('outer');
              Object.defineProperties(nested, { value: { value: 3 } });
              order.push('nested');
              return 4;
            },
          },
        },
      );
      if (outer.value !== 4 || nested.value !== 3 || order.join(',') !== 'convert,outer,nested')
        throw Error('Descriptor callback or reentry observation differs');
    } finally {
      stats = host.definePropertiesProfile('end');
    }
    if (stats[0] !== 4 || stats[1] !== 2)
      throw Error('Descriptor nested call/failure accounting differs');
    host.log(
      'FAST_DESCRIPTOR_CONTRACT ' + JSON.stringify({ calls: stats[0], failed: stats[1], order }),
    );
  }
  if (host.namedPropertyProfile) {
    const expected = new Error('getter fixture'),
      order = [],
      receiver = {
        get nested() {
          order.push('nested');
          return 7;
        },
        get outer() {
          order.push('outer');
          return this.nested;
        },
        get failing() {
          order.push('failing');
          throw expected;
        },
      };
    host.namedPropertyProfile('begin');
    if (receiver.outer !== 7) throw Error('Property getter receiver differs');
    try {
      const result = receiver.failing;
      throw Error('Property exception was lost: ' + result);
    } catch (error) {
      if (error !== expected) throw error;
    }
    const stats = host.namedPropertyProfile('end');
    if (stats[4] !== 3 || stats[5] !== 3 || order.join(',') !== 'outer,nested,failing')
      throw Error('Property nested/exception loop coverage differs: ' + JSON.stringify(stats));
    host.log(
      'FAST_PROPERTY_FIXTURE ' +
        JSON.stringify({ getters: stats[4], interpreted: stats[5], order }),
    );
  }
  const build = root.build,
    rebuilt = new WeakSet(),
    frames = [],
    overhead = [];
  const nativeClock = host.definePropertiesProfile?.('calibrate');
  const propertyClock = host.namedPropertyProfile?.('calibrate');
  let current;
  for (let index = 0; index < 128; index++) {
    const before = host.cpuProfileClock();
    overhead.push(host.cpuProfileClock()[0] - before[0]);
  }
  root.build = function (scene) {
    if (!active()) return build.call(this, scene);
    if (current || frames.length >= 2048) throw Error('Representation frame budget exceeded');
    const before = host.cpuProfileClock();
    current = { sequence: scene.token.sequence, begin: before[0], newDays: 0, rebuiltDays: 0 };
    host.definePropertiesProfile?.('begin');
    host.namedPropertyProfile?.('begin');
    conflicts?.beginFrame();
    try {
      return build.call(this, scene);
    } finally {
      const semanticsConflict = conflicts?.endFrame();
      const property = host.namedPropertyProfile?.('end');
      const native = host.definePropertiesProfile?.('end');
      const after = host.cpuProfileClock();
      frames.push({
        ...current,
        end: after[0],
        cpuMs: after[1] - before[1],
        ...(native ? { native: native.slice(0, 4) } : {}),
        ...(property ? { property: property.slice(0, 7) } : {}),
        ...(semanticsConflict ? { semanticsConflict } : {}),
      });
      current = undefined;
    }
  };
  root.buildOwner._setElementBuildObserver({
    active: () => true,
    begin(element) {
      if (element.widget.constructor.name !== '_Day') return;
      const first = !rebuilt.has(element);
      rebuilt.add(element);
      if (current) current[first ? 'newDays' : 'rebuiltDays']++;
    },
    end() {},
  });
  return {
    reset() {
      if (current) throw Error('Representation reset inside a frame');
      frames.length = 0;
    },
    log(name, trace) {
      if (current || trace.length > 8 * 1024 * 1024)
        throw Error('Representation profile is incomplete or exceeds budget');
      host.log(
        'FAST_REPRESENTATION_BEGIN ' +
          JSON.stringify({
            name,
            length: trace.length,
            frames: frames.length,
            ...(nativeClock
              ? { nativeClockPairMs: { mean: nativeClock[4], max: nativeClock[5] } }
              : {}),
            ...(propertyClock
              ? { propertyClockPairMs: { mean: propertyClock[7], max: propertyClock[8] } }
              : {}),
            clockPairMs: {
              mean: overhead.reduce((a, b) => a + b, 0) / overhead.length,
              max: Math.max(...overhead),
            },
          }),
      );
      // NativeHost.log is bounded to 8 KiB. Even worst-case JSON escaping of
      // these chunks stays below that limit. The parent consumes them in RAM.
      for (let index = 0; index < frames.length; index += 8)
        host.log('FAST_REPRESENTATION_FRAMES ' + JSON.stringify(frames.slice(index, index + 8)));
      for (let index = 0; index < trace.length; index += 1000)
        host.log('FAST_REPRESENTATION_CHUNK ' + JSON.stringify(trace.slice(index, index + 1000)));
      host.log('FAST_REPRESENTATION_END');
    },
    dispose() {
      root.build = build;
      root.buildOwner._setElementBuildObserver(undefined);
      frames.length = 0;
      conflicts?.dispose();
    },
  };
}
