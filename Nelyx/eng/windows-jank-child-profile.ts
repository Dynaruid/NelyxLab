// SPDX-License-Identifier: BSD-3-Clause
// Inlined only by the explicit build diagnostic. No hooks enter product builds.
import { SliverMultiBoxAdaptorElement as ProfileSliverElement } from '@nelyx/core/framework/widgets/sliver';
import { Element as ProfileElement } from '@nelyx/core/framework/widgets/framework';
import { RenderSliverFillViewport as ProfileFillViewport } from '@nelyx/core/framework/rendering/sliver-fill';
import {
  GlobalKey as ProfileGlobalKey,
  isFrameworkAnchorKey as profileFrameworkAnchor,
} from '@nelyx/core/framework/widgets/global-key';
import { dormantChildLimits as profileDormantLimits } from './windows/runner/node_modules/@nelyx/core/dist/framework/widgets/dormant-child-cache.js';

export function installChildReuseProfile(root, host, active) {
  const owner = root.buildOwner,
    prototype = ProfileSliverElement.prototype,
    patches = [],
    identities = new WeakMap(),
    watched = new WeakSet(),
    stack = [];
  let nextIdentity = 0,
    invalid = false,
    values,
    pages,
    events;
  function reset() {
    if (stack.length) throw Error('Child profile reset during lifecycle work');
    values = {};
    pages = new Map();
    events = [];
    invalid = false;
  }
  reset();
  function identity(element) {
    if (!identities.has(element)) identities.set(element, ++nextIdentity);
    return identities.get(element);
  }
  function event(value) {
    if (events.length >= 128) {
      invalid = true;
      throw Error('Child profile event budget exceeded');
    }
    events.push(value);
  }
  // These intervals nest. Only exclusiveMs is additive across categories;
  // inclusiveMs includes descendant builds/commits and must not be added to layout.
  function measure(kind, task) {
    const entry = { began: host.now(), nested: 0 };
    stack.push(entry);
    try {
      return task();
    } finally {
      const elapsed = host.now() - entry.began;
      if (stack.pop() !== entry) invalid = true;
      if (stack.length) stack[stack.length - 1].nested += elapsed;
      const value = (values[kind] ??= { count: 0, inclusiveMs: 0, exclusiveMs: 0, maxMs: 0 });
      value.count++;
      value.inclusiveMs += elapsed;
      value.exclusiveMs += elapsed - entry.nested;
      value.maxMs = Math.max(value.maxMs, elapsed);
    }
  }
  function patch(target, name, value) {
    const descriptor = Object.getOwnPropertyDescriptor(target, name);
    patches.push({ target, name, descriptor });
    Object.defineProperty(target, name, { configurable: true, writable: true, value });
  }
  function inspect(page) {
    const pending = [page];
    let elements = 0,
      states = 0,
      globalKeys = 0,
      frameworkAnchors = 0;
    const keyTypes = new Map();
    while (pending.length) {
      const element = pending.pop(),
        key = element.widget.key;
      elements++;
      if (element.stateObject) states++;
      if (key instanceof ProfileGlobalKey) {
        if (profileFrameworkAnchor(key)) frameworkAnchors++;
        else {
          globalKeys++;
          const type = element.widget.constructor.name;
          keyTypes.set(type, (keyTypes.get(type) ?? 0) + 1);
        }
      }
      for (const child of element.children) pending.push(child);
    }
    const box = page.renderObjects[0],
      data = box?.parentData,
      id = identity(page);
    pages.set(id, {
      id,
      index: page.slot,
      elements,
      states,
      globalKeys,
      frameworkAnchors,
      excludedKeyWidgets: [...keyTypes],
      explicitKeepAlive: data?.keepAlive === true,
      eligible: !globalKeys && elements <= profileDormantLimits.elements,
    });
    if (pages.size > 64) throw Error('Child profile census budget exceeded');
    watched.add(page);
  }
  function relevant(element) {
    return element.owner === owner && element.renderObject instanceof ProfileFillViewport;
  }
  const unmount = ProfileElement.prototype.unmount;
  patch(ProfileElement.prototype, 'unmount', function (...args) {
    if (this.owner !== owner || !this.mounted || !watched.has(this) || !active())
      return unmount.apply(this, args);
    event({ operation: 'unmount', id: identity(this), index: this.slot });
    return measure('retirement', () => unmount.apply(this, args));
  });
  for (const name of [
    'createChild',
    'removeChild',
    'didStartLayout',
    'didFinishLayout',
    'update',
  ]) {
    const original = prototype[name];
    patch(prototype, name, function (...args) {
      if (!relevant(this)) return original.apply(this, args);
      const observing = active();
      if (name === 'didFinishLayout') {
        const result = original.apply(this, args);
        if (observing) for (const page of this.children) inspect(page);
        return result;
      }
      if (!observing) return original.apply(this, args);
      if (name === 'createChild') {
        const index = args[0],
          previous = this.children.find((child) => child.slot === index),
          dormant = owner.maybeDormantChildren?.peek(this, index),
          kind = previous ? 'existingChildRequest' : dormant ? 'resume' : 'freshChild';
        const result = measure(kind, () => original.apply(this, args)),
          page = this.children.find((child) => child.slot === index);
        event({ operation: kind, index, id: page ? identity(page) : null });
        if (page) inspect(page);
        return result;
      }
      if (name === 'removeChild') {
        const index = this.renderObject.indexOf(args[0]),
          page = this.children.find((child) => child.slot === index);
        if (page) inspect(page);
        const result = measure('deactivateAndRemove', () => original.apply(this, args));
        event({ operation: 'remove', index, id: page ? identity(page) : null });
        return result;
      }
      if (name === 'update') {
        event({ operation: 'delegateUpdate', changed: this.widget.delegate !== args[0].delegate });
        return measure('delegateUpdate', () => original.apply(this, args));
      }
      return measure('activeBuildFlush', () => original.apply(this, args));
    });
  }
  return {
    reset,
    snapshot() {
      if (invalid || stack.length) throw Error('Child profile observation incomplete');
      return {
        scope: 'diagnostic-only-fill-viewport-lifecycle',
        limits: profileDormantLimits,
        intervals: values,
        pages: [...pages.values()],
        events,
        dormant: owner.maybeDormantChildren?.debugStats ?? null,
        resumeComparison: 'not-run-legacy-baseline',
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
