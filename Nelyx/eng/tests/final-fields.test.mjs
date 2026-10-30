// SPDX-License-Identifier: BSD-3-Clause
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SemanticsData,
  SemanticsProperties,
  SemanticsNode,
} from '@nelyx/core/framework/semantics/semantics';
import { finalFieldProtector } from '../../dist/ui/value-math.js';
const timeout = 1_200_000;
test(
  'compiled semantics field layouts stay final while derived instances can add fields',
  { timeout },
  () => {
    class Properties extends SemanticsProperties {
      extra = 42;
    }
    class Data extends SemanticsData {
      extra = 17;
    }
    const properties = new Properties({ label: 'retained' }),
      node = new SemanticsNode(),
      data = node.getSemanticsData();
    assert(data instanceof SemanticsData);
    assert.equal(properties.extra, 42);
    const tags = new Set(),
      controls = new Set(),
      actions = new Map(),
      derived = new Data({ ...data, tags, controlsNodes: controls }),
      base = new SemanticsProperties({ controlsNodes: controls, customSemanticsActions: actions });
    assert.equal(derived.extra, 17);
    for (const [value, key] of [
      [properties, 'label'],
      [base, 'label'],
      [data, 'flagsCollection'],
      [data, 'rect'],
      [derived, 'rect'],
    ]) {
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      assert.equal(descriptor.writable, false);
      assert.equal(descriptor.configurable, false);
      assert.equal(descriptor.enumerable, true);
      assert.throws(() => {
        value[key] = null;
      }, TypeError);
    }
    controls.add('live');
    actions.set({}, () => {});
    tags.add({});
    assert.equal(base.controlsNodes, controls);
    assert.equal(base.customSemanticsActions, actions);
    assert.equal(derived.tags, tags);
    assert.equal(derived.controlsNodes, controls);
    assert.equal(data.tags, null);
  },
);
test(
  'fixed final-field definitions preserve duplicate/numeric proxy order and partial failure',
  { timeout },
  () => {
    for (const keys of [
      ['second', 'first'],
      ['9', '2'],
      ['same', 'same'],
    ]) {
      const calls = [],
        seal = finalFieldProtector(keys),
        target = new Proxy(
          {},
          {
            defineProperty(target, key, descriptor) {
              calls.push(key);
              return Reflect.defineProperty(target, key, descriptor);
            },
          },
        );
      seal(target);
      assert.deepEqual(calls, keys);
    }
    const value = { first: 1 };
    Object.defineProperty(value, 'blocked', { get: () => 2, configurable: false });
    assert.throws(() => finalFieldProtector(['first', 'blocked', 'last'])(value), TypeError);
    assert.equal(Object.getOwnPropertyDescriptor(value, 'first').writable, false);
    assert(!Object.hasOwn(value, 'last'));
  },
);
