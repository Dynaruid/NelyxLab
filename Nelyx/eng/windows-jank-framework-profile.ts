// SPDX-License-Identifier: BSD-3-Clause
// Inlined only by the explicit build diagnostic; no product hooks or tree cache.
import {
  Element as WorkProfileElement,
  StatefulElement as WorkProfileStatefulElement,
  RenderObjectElement as WorkProfileRenderElement,
} from '@nelyx/core/framework/widgets/framework';
import {
  RenderObject as WorkProfileRenderObject,
  RenderBox as WorkProfileRenderBox,
} from '@nelyx/core/framework/rendering/object';
import { RenderSliver as WorkProfileRenderSliver } from '@nelyx/core/framework/rendering/sliver';
import { RenderSliverFillViewport as WorkProfilePage } from '@nelyx/core/framework/rendering/sliver-fill';
import { RenderViewport as WorkProfileViewport } from '@nelyx/core/framework/rendering/viewport';
import { SliverMultiBoxAdaptorElement as WorkProfileSliver } from '@nelyx/core/framework/widgets/sliver';
import { SliverGridGeometry as WorkProfileTile } from '@nelyx/core/framework/rendering/sliver-grid';
import { RenderRichParagraph as WorkProfileParagraph } from '@nelyx/core/framework/rendering/paragraph';
import { SemanticsNode as WorkProfileSemanticsNode } from '@nelyx/core/framework/semantics/semantics';
import { Semantics as WorkProfileSemanticsWidget } from '@nelyx/core/framework/widgets/semantics';
import { TextLayoutCache as WorkProfileTextCache } from '@nelyx/core/hosting/text-layout-cache';
import { ViewRuntime as WorkProfileViewRuntime } from '@nelyx/core/hosting/runtime';
import { NativeTextLayoutService as WorkProfileTextService } from '@nelyx/skia-native/text';

export function installSliverLayoutProfile(root, host, diagnostics, active) {
  const frames = new Map(),
    restore = [],
    generations = new WeakMap(),
    pageElements = new WeakMap(),
    attachedSemanticsNodes = new WeakSet(),
    owner = root.buildOwner;
  const semanticsStages = [
    'semantics',
    'semantics-flush',
    'semantics-snapshot',
    'semantics-freeze',
    'semantics-publish',
  ];
  let frame,
    nestedMs = 0,
    generation = 0,
    nextPage = 0,
    semanticsHandoff = { updates: 0, resets: 0, upserts: 0, removed: 0, maxMs: 0 };
  function patch(target, name, wrap) {
    const descriptor = Object.getOwnPropertyDescriptor(target, name),
      original = target[name];
    Object.defineProperty(target, name, {
      configurable: true,
      writable: true,
      value: wrap(original),
    });
    restore.push(() => {
      if (descriptor) Object.defineProperty(target, name, descriptor);
      else delete target[name];
    });
  }
  function observe(target, name, kind, count, trace) {
    patch(
      target,
      name,
      (original) =>
        function (...args) {
          if (!frame) {
            const result = original.apply(this, args);
            trace?.call(this, args, result);
            return result;
          }
          const began = host.now(),
            parentNested = nestedMs;
          nestedMs = 0;
          try {
            const result = original.apply(this, args);
            trace?.call(this, args, result);
            const label = count?.call(this, args, result);
            if (label) frame.counts[label] = (frame.counts[label] ?? 0) + 1;
            return result;
          } finally {
            const elapsed = host.now() - began;
            const totals = (frame.work[kind] ??= [0, 0, 0]);
            totals[0]++;
            totals[1] += elapsed;
            totals[2] += Math.max(0, elapsed - nestedMs);
            nestedMs = parentNested + elapsed;
          }
        },
    );
  }
  function preparationEvent(action, scope, slot) {
    const previous = generations.get(scope);
    const event = {
      generation: previous?.generation ?? ++generation,
      slot: slot ?? previous?.slot,
    };
    generations.set(scope, event);
    host.log('FAST_SLIVER_PREPARATION ' + JSON.stringify({ action, ...event, at: host.now() }));
    return event;
  }
  patch(
    WorkProfileViewRuntime.prototype,
    'flushPointerInput',
    (original) =>
      function (...args) {
        if (this.owner === root.context.owner && this.frameDiagnostics !== diagnostics) {
          const previous = this.frameDiagnostics;
          this.frameDiagnostics = diagnostics;
          restore.push(() => {
            this.frameDiagnostics = previous;
          });
        }
        return original.apply(this, args);
      },
  );
  observe(WorkProfileRenderBox.prototype, 'performLayoutInScope', 'boxLayout');
  observe(WorkProfileRenderSliver.prototype, 'performLayoutInScope', 'sliverLayout');
  observe(WorkProfileRenderObject.prototype, 'performLayoutInScope', 'otherLayout');
  observe(WorkProfileRenderObject.prototype, 'layoutMutationAllowed', 'layoutMembership');
  observe(WorkProfileElement.prototype, 'markRenderTreeSyncDirty', 'registerRenderOwner');
  observe(owner, '_scheduleRenderChildren', 'admitRenderOwner');
  observe(owner, 'flushRenderTree', 'flushRenderOwners');
  observe(WorkProfileSliver.prototype, 'createChild', 'requiredSlot');
  function logPage(action, value) {
    host.log('FAST_SLIVER_PAGE ' + JSON.stringify({ action, ...value, frame: frame?.sequence }));
  }
  // Weak identities distinguish a returning index from a returning Element.
  patch(
    WorkProfileSliver.prototype,
    'createChild',
    (original) =>
      function (index, position) {
        const result = original.call(this, index, position);
        if (this.owner === owner && this.renderObject instanceof WorkProfilePage) {
          const element = this._childElements.get(index);
          if (element) {
            let page = pageElements.get(element);
            if (!page) {
              page = { index, element: ++nextPage };
              pageElements.set(element, page);
            }
            logPage('required', page);
          }
        }
        return result;
      },
  );
  patch(
    WorkProfileSliver.prototype,
    'removeChild',
    (original) =>
      function (child) {
        const page =
          this.owner === owner && this.renderObject instanceof WorkProfilePage
            ? pageElements.get(this._childElements.get(this.renderObject.indexOf(child)))
            : undefined;
        if (page) logPage('removed', page);
        return original.call(this, child);
      },
  );
  patch(
    WorkProfileElement.prototype,
    'unmount',
    (original) =>
      function (...args) {
        const page = pageElements.get(this);
        const result = original.apply(this, args);
        if (page) logPage('unmounted', page);
        return result;
      },
  );
  observe(WorkProfileElement.prototype, 'rebuild', 'elementRebuild');
  observe(WorkProfileSliver.prototype, 'updateChildAt', 'reconcileSlot', ([, old], child) =>
    child ? (child === old ? 'updated' : 'produced') : old ? 'removed' : 'empty',
  );
  observe(WorkProfileTile.prototype, 'getBoxConstraints', 'tileConstraints');
  observe(WorkProfileParagraph.prototype, 'layoutCanonical', 'paragraphLayout');
  observe(WorkProfileTextService.prototype, 'layout', 'textService');
  observe(WorkProfileTextCache.prototype, 'reuse', 'textCache', (_args, hit) =>
    hit ? 'textCacheHit' : 'textCacheMiss',
  );
  observe(WorkProfileSemanticsWidget.prototype, 'createRenderObject', 'semanticsRenderCreate');
  observe(WorkProfileRenderObject.prototype, 'clearSemantics', 'semanticsClear');
  observe(WorkProfileSemanticsNode.prototype, 'attach', 'semanticsAttach', undefined, function () {
    const kind = attachedSemanticsNodes.has(this) ? 'reattached' : 'firstAttach';
    attachedSemanticsNodes.add(this);
    if (frame) frame.counts[kind] = (frame.counts[kind] ?? 0) + 1;
  });
  observe(WorkProfileSemanticsNode.prototype, 'detach', 'semanticsDetach', () => 'detached');
  patch(
    host,
    'publishSemantics',
    (original) =>
      function (update) {
        if (!active()) return original.call(this, update);
        const began = host.now();
        const result = original.call(this, update);
        semanticsHandoff.updates++;
        semanticsHandoff.resets += update.reset ? 1 : 0;
        semanticsHandoff.upserts += update.upserts.length;
        semanticsHandoff.removed += update.removed.length;
        semanticsHandoff.maxMs = Math.max(semanticsHandoff.maxMs, host.now() - began);
        return result;
      },
  );
  observe(WorkProfileRenderElement.prototype, '_commitRenderChildren', 'commit');
  observe(owner, 'buildScope', 'buildScope');
  observe(owner, 'deactivateChildren', 'deactivate');
  observe(owner, '_retireInactiveSubtreeWithoutGlobalKeys', 'earlyRetirement');
  observe(owner, 'finalizeTree', 'finalize');
  observe(owner, '_requiredPreparationCompletion', 'completePreparation');
  observe(owner, '_createPreparationScope', 'startPreparation', undefined, (_args, scope) => {
    preparationEvent('started', scope, owner.activePreparationCandidate?.index);
  });
  observe(owner, '_adoptPreparation', 'promote', undefined, ([scope, , , slot]) => {
    const adoption = preparationEvent('adopted', scope, slot);
    if (frame) frame.promotion = adoption;
  });
  observe(owner, '_disposePreparationScope', 'disposePreparation', undefined, ([scope]) => {
    preparationEvent('cancelled', scope);
  });
  observe(owner, '_cancelPreparation', 'cancelPreparation');
  observe(
    WorkProfileViewport.prototype,
    '_attemptLayout',
    'viewportAttempt',
    (_args, correction) => correction !== 0 && 'corrections',
  );
  function lifetime(name) {
    let activeElements = 0;
    const element = Reflect.get(root, 'root');
    const pending = element ? [element] : [];
    while (pending.length) {
      const current = pending.pop();
      if (!current.active) continue;
      activeElements++;
      pending.push(...current.children);
    }
    host.log(
      'FAST_SLIVER_PROFILE ' +
        JSON.stringify({
          kind: 'lifetime',
          name,
          activeElements,
          detachedRoots: owner.inactive.size,
          preparationElements: owner.preparationStats.elements,
          preparationActive: owner.preparationStats.active,
          preparationWake: !!owner.preparationWake,
          schedulerDisposed: root.scheduler.disposed,
          resources: root.context.resources.accountedTotals,
        }),
    );
  }
  return {
    build(build, scene) {
      if (!active()) return build(scene);
      const sequence = scene.token.sequence;
      if (frames.size >= 2048 || frames.has(sequence) || frame)
        throw Error('Sliver layout profile frame budget or token differs');
      frame = { sequence, work: {}, counts: {}, input: scene.token.inputSequence ?? 0 };
      frames.set(sequence, frame);
      nestedMs = 0;
      try {
        return build(scene);
      } finally {
        frame = undefined;
      }
    },
    report(name, samples, inputs, surfaces, scenes) {
      const shortScenes = new Map(
        scenes.filter((scene) => scene.cpu <= 1000 / 30).map((scene) => [scene.frame, scene]),
      );
      const submits = new Map(
        samples
          .filter((sample) => sample.stage === 'submit')
          .map((sample) => [sample.frame, sample]),
      );
      const shortRows = [];
      for (let i = 0; i < surfaces.length; i += 11) {
        const id = surfaces[i + 4],
          scene = shortScenes.get(id),
          submit = submits.get(id);
        if (scene && submit)
          shortRows.push([id, scene.end, submit.begin, submit.end, surfaces[i + 10]]);
      }
      for (let i = 0; i < shortRows.length; i += 20)
        host.log(
          'FAST_SLIVER_SHORT_SCENES ' + JSON.stringify({ name, rows: shortRows.slice(i, i + 20) }),
        );
      const peak = samples.reduce(
        (result, sample) =>
          sample.stage === 'layout' && (!result || sample.duration > result.duration)
            ? sample
            : result,
        undefined,
      );
      if (!peak || !frames.has(peak.frame))
        throw Error('Peak sliver layout has no frame observation');
      const { work, counts, input, promotion } = frames.get(peak.frame);
      const stages = samples.filter(
        (sample) =>
          sample.frame === peak.frame ||
          (sample.frame === 0 &&
            sample.input === input &&
            (sample.stage === 'input-queue' || sample.stage === 'input-dispatch')),
      );
      const submit = stages.find((sample) => sample.stage === 'submit');
      const dispatch = stages.find((sample) => sample.stage === 'input-dispatch');
      let delivery, receipt, fence;
      for (let i = 0; i < inputs.length; i += 10) {
        if (inputs[i + 1] === input && inputs[i + 9]) {
          receipt = inputs[i + 4];
          delivery = inputs[i + 5];
        }
      }
      for (let i = 0; i < surfaces.length; i += 11)
        if (surfaces[i + 4] === peak.frame) fence = surfaces[i + 10];
      const round = (value) => Math.round(value * 1000) / 1000;
      host.log(
        'FAST_SLIVER_PROFILE ' +
          JSON.stringify({
            name,
            frame: peak.frame,
            input,
            promotion,
            counts,
            timing: {
              receipt,
              delivery,
              dispatchStart: dispatch?.begin,
              dispatchEnd: dispatch?.end,
              layoutStart: peak.begin,
              submitStart: submit?.begin,
              submitEnd: submit?.end,
              fence,
            },
            stages: Object.fromEntries(
              stages
                .filter((sample) =>
                  [
                    'build',
                    'layout',
                    'paint',
                    'compose',
                    ...semanticsStages,
                    'input-geometry',
                    'capture',
                    'capture-transfer',
                    'pending',
                    'admission',
                    'submit',
                    'input-queue',
                    'input-dispatch',
                  ].includes(sample.stage),
                )
                .map((sample) => [sample.stage, round(sample.duration)]),
            ),
            work: Object.fromEntries(
              Object.entries(work).map(([kind, times]) => [kind, times.map(round)]),
            ),
          }),
      );
      const semanticsPeak = samples.reduce(
        (result, sample) =>
          sample.stage === 'semantics' && (!result || sample.duration > result.duration)
            ? sample
            : result,
        undefined,
      );
      const peakFrame = frames.get(semanticsPeak?.frame);
      if (peakFrame) {
        host.log(
          'FAST_SLIVER_PROFILE ' +
            JSON.stringify({
              kind: 'accessibility',
              name,
              frame: peakFrame.sequence,
              stages: Object.fromEntries(
                samples
                  .filter(
                    (sample) =>
                      sample.frame === peakFrame.sequence && semanticsStages.includes(sample.stage),
                  )
                  .map((sample) => [sample.stage, round(sample.duration)]),
              ),
              firstAttach: peakFrame.counts.firstAttach ?? 0,
              reattached: peakFrame.counts.reattached ?? 0,
              detached: peakFrame.counts.detached ?? 0,
              attachMs: round(peakFrame.work.semanticsAttach?.[2] ?? 0),
              detachMs: round(peakFrame.work.semanticsDetach?.[2] ?? 0),
              handoff: { ...semanticsHandoff, maxMs: round(semanticsHandoff.maxMs) },
            }),
        );
      }
      semanticsHandoff = { updates: 0, resets: 0, upserts: 0, removed: 0, maxMs: 0 };
      lifetime(name);
      frames.clear();
    },
    dispose() {
      frames.clear();
      for (const undo of restore.reverse()) undo();
      lifetime('closed');
    },
  };
}

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
