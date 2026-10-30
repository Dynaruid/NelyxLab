// SPDX-License-Identifier: BSD-3-Clause
import test from 'node:test';
import assert from 'node:assert/strict';
import { ResourceRegistry, ResourceAccounting } from '@nelyx/core/hosting/resources';
import { TextLayoutBudget } from '@nelyx/core/hosting/text-layout-budget';
import { admitTextLayoutResources } from '@nelyx/core/ui/text';

const timeout = 1_200_000;
const input = (text = 'label') => ({
  text,
  width: 220,
  font: { id: 'font', generation: 1 },
  fontSize: 16,
  locale: 'en',
  direction: 'ltr',
  scale: 1,
});
const empty = {
  resident: 0,
  producers: 0,
  residentUnits: 0,
  producerUnits: 0,
  residentBytes: 0,
  producerBytes: 0,
};

test(
  'optional pressure releases logical producers before admission without repeating input serialization or draining a frame',
  { timeout },
  () => {
    const registry = new ResourceRegistry(),
      budget = new TextLayoutBudget(registry),
      layout = { resource: { id: 'optional', generation: 1 }, input: input('x'.repeat(4096)) };
    let retired = 0,
      calls = 0,
      reclaims = 0,
      frame,
      lease;
    try {
      budget.admit(layout.input);
      registry.register(
        { ...layout.resource, kind: 'paragraph' },
        () => retired++,
        budget.registration(layout),
      );
      for (let i = 1; i < 16; i++) registry.retainInitialProducer(layout.resource);
      frame = registry.acquire([layout.resource]);
      lease = registry.addOptionalResourceReclaimer(() => {
        reclaims++;
        assert.equal(
          registry.reclaimOptionalResources(),
          false,
          'Reclamation cannot recursively enter itself',
        );
        while (registry.initialProducerCount(layout.resource))
          registry.releaseProducer(layout.resource);
      });
      const candidate = {
        ...input('new'),
        toJSON() {
          calls++;
          return input('new');
        },
      };
      budget.admit(candidate);
      assert.equal(calls, 1);
      assert.equal(reclaims, 1);
      assert.equal(registry.initialProducerCount(layout.resource), 0);
      assert.equal(registry.retainedReferenceCount(layout.resource), 1);
      assert.equal(registry.accountedTotals.residentUnits, 4096);
      assert.equal(retired, 0);
      frame.returnBy('caller');
      frame = undefined;
      assert.equal(retired, 1);
      assert.deepEqual(registry.accountedTotals, empty);
    } finally {
      lease?.dispose();
      frame?.returnBy('caller');
      registry.dispose();
    }
  },
);

test(
  'unsuccessful or failed reclaimers preserve hard admission limits and later owners still retire',
  { timeout },
  () => {
    const registry = new ResourceRegistry(),
      budget = new TextLayoutBudget(registry),
      layout = { resource: { id: 'unreclaimed', generation: 1 }, input: input('x'.repeat(4096)) };
    let called = 0,
      late = 0;
    budget.admit(layout.input);
    registry.register(
      { ...layout.resource, kind: 'paragraph' },
      () => {},
      budget.registration(layout),
    );
    for (let i = 1; i < 16; i++) registry.retainInitialProducer(layout.resource);
    const first = registry.addOptionalResourceReclaimer(() => called++);
    try {
      assert.throws(() => budget.admit(input('more')), /Live paragraph content budget exhausted/);
      assert.equal(called, 1);
      first.dispose();
      const failure = {},
        bad = registry.addOptionalResourceReclaimer(() => {
          throw failure;
        }),
        good = registry.addOptionalResourceReclaimer(() => late++);
      try {
        assert.throws(
          () => budget.admit(input('more')),
          (error) => error === failure,
        );
        assert.equal(late, 1);
        assert.equal(registry.initialProducerCount(layout.resource), 16);
      } finally {
        bad.dispose();
        good.dispose();
      }
    } finally {
      first.dispose();
      registry.dispose();
    }
    assert.equal(registry.reclaimOptionalResources(), false);
  },
);

test(
  'reclaimer registrations have independent lifetimes even when they share a callback',
  { timeout },
  () => {
    const registry = new ResourceRegistry();
    let calls = 0;
    const reclaim = () => calls++,
      a = registry.addOptionalResourceReclaimer(reclaim),
      b = registry.addOptionalResourceReclaimer(reclaim);
    try {
      registry.reclaimOptionalResources();
      assert.equal(calls, 2);
      a.dispose();
      registry.reclaimOptionalResources();
      assert.equal(calls, 3);
      a.dispose();
      b.dispose();
      assert.equal(registry.reclaimOptionalResources(), false);
    } finally {
      a.dispose();
      b.dispose();
      registry.dispose();
    }
  },
);
test(
  'resource costs follow shared producers, independent owners, frame leases and closing',
  { timeout },
  () => {
    const registry = new ResourceRegistry(),
      accounting = new ResourceAccounting(registry),
      resource = { id: 'paragraph', generation: 1 },
      identity = {},
      cost = { units: 7, bytes: 80 };
    let retired = 0;
    registry.register({ ...resource, kind: 'paragraph' }, () => retired++, {
      owner: accounting,
      identity,
      cost,
    });
    cost.units = 99;
    const expect = (producers, resident = 1) =>
      assert.deepEqual(accounting.totals, {
        resident,
        producers,
        residentUnits: resident * 7,
        producerUnits: producers * 7,
        residentBytes: resident * 80,
        producerBytes: producers * 80,
      });
    expect(1);
    registry.retainInitialProducer(resource);
    expect(2);
    const frame = registry.acquire([resource]),
      owner = registry.retainProducer(resource);
    registry.releaseProducer(resource);
    registry.releaseProducer(resource);
    expect(0);
    assert.equal(accounting.record(resource, identity).producers, 0);
    assert.equal(retired, 0);
    registry.retainInitialProducer(resource);
    expect(1);
    registry.dispose();
    expect(0);
    assert.equal(accounting.record(resource, identity), undefined);
    assert.equal(retired, 0);
    owner.dispose();
    frame.returnBy('caller');
    assert.equal(retired, 1);
    assert.deepEqual(accounting.totals, empty);
  },
);
test(
  'registry aggregation shares actual residency across services and retains in-flight costs after producers leave',
  { timeout },
  () => {
    const registry = new ResourceRegistry(),
      first = new ResourceAccounting(registry),
      second = new ResourceAccounting(registry),
      a = { id: 'a', generation: 1 },
      b = { id: 'b', generation: 1 };
    registry.register({ ...a, kind: 'paragraph' }, () => {}, {
      owner: first,
      identity: {},
      cost: { units: 3, bytes: 30 },
    });
    registry.register({ ...b, kind: 'paragraph' }, () => {}, {
      owner: second,
      identity: {},
      cost: { units: 7, bytes: 70 },
    });
    assert.deepEqual(registry.accountedTotals, {
      resident: 2,
      producers: 2,
      residentUnits: 10,
      producerUnits: 10,
      residentBytes: 100,
      producerBytes: 100,
    });
    const frame = registry.acquire([a, b]);
    registry.releaseProducer(a);
    registry.releaseProducer(b);
    assert.deepEqual(registry.accountedTotals, {
      resident: 2,
      producers: 0,
      residentUnits: 10,
      producerUnits: 0,
      residentBytes: 100,
      producerBytes: 0,
    });
    registry.dispose();
    assert.equal(registry.accountedTotals.resident, 2);
    frame.returnBy('caller');
    assert.deepEqual(registry.accountedTotals, empty);
  },
);

test(
  'retirement keeps unconfirmed costs and cannot erase a reentrant registration with the same ID',
  { timeout },
  () => {
    const registry = new ResourceRegistry(),
      accounting = new ResourceAccounting(registry),
      resource = { id: 'again', generation: 1 },
      old = {},
      next = {};
    registry.register(
      { ...resource, kind: 'paragraph' },
      () =>
        registry.register({ ...resource, kind: 'paragraph' }, () => {}, {
          owner: accounting,
          identity: next,
          cost: { units: 4, bytes: 40 },
        }),
      { owner: accounting, identity: old, cost: { units: 1, bytes: 10 } },
    );
    registry.releaseProducer(resource);
    assert.equal(accounting.record(resource, old), undefined);
    assert.deepEqual(accounting.record(resource, next), { producers: 1, units: 4, bytes: 40 });
    assert.deepEqual(accounting.totals, {
      resident: 1,
      producers: 1,
      residentUnits: 4,
      producerUnits: 4,
      residentBytes: 40,
      producerBytes: 40,
    });
    registry.releaseProducer(resource);
    assert.deepEqual(accounting.totals, empty);
    registry.register(
      { ...resource, kind: 'paragraph' },
      () => {
        throw Error('native retirement failed');
      },
      { owner: accounting, identity: old, cost: { units: 3, bytes: 30 } },
    );
    assert.throws(() => registry.releaseProducer(resource), /native retirement failed/);
    assert.equal(accounting.record(resource, old), undefined);
    assert.deepEqual(accounting.totals, {
      resident: 1,
      producers: 0,
      residentUnits: 3,
      producerUnits: 0,
      residentBytes: 30,
      producerBytes: 0,
    });
    registry.dispose();
  },
);
test(
  'foreign or invalid accounting rejects before registration and preserves prior totals',
  { timeout },
  () => {
    const registry = new ResourceRegistry(),
      accounting = new ResourceAccounting(registry),
      foreign = new ResourceAccounting(new ResourceRegistry()),
      resource = { id: 'invalid', generation: 1 };
    for (const registration of [
      { owner: foreign, identity: {}, cost: { units: 1, bytes: 2 } },
      { owner: accounting, identity: null, cost: { units: 1, bytes: 2 } },
      ...[-1, NaN, 1.5].map((units) => ({
        owner: accounting,
        identity: {},
        cost: { units, bytes: 2 },
      })),
    ]) {
      assert.throws(
        () =>
          registry.register(
            { ...resource, kind: 'paragraph' },
            () => assert.fail('Unregistered retirement'),
            registration,
          ),
        /accounting|costs/i,
      );
      assert.equal(registry.isRetained(resource), false);
      assert.deepEqual(accounting.totals, empty);
    }
    registry.dispose();
  },
);
test(
  'incremental paragraph admission agrees with the iterable owner through reuse, replacement and retirement',
  { timeout },
  () => {
    const registry = new ResourceRegistry(),
      budget = new TextLayoutBudget(registry),
      other = new TextLayoutBudget(registry),
      live = new Set(),
      layout = { resource: { id: 'shared', generation: 1 }, input: input('x'.repeat(4096)) };
    const register = (layout, owner = budget) => {
      owner.admit(layout.input);
      registry.register(
        { ...layout.resource, kind: 'paragraph' },
        () => live.delete(layout),
        owner.registration(layout),
      );
      if (owner === budget) live.add(layout);
    };
    const result = (callback) => {
      try {
        callback();
        return 'accepted';
      } catch (error) {
        return error.code + ':' + error.message;
      }
    };
    const same = (candidate = input(), request = {}, retained) =>
      assert.equal(
        result(() => budget.admit(candidate, request, retained)),
        result(() =>
          admitTextLayoutResources(
            live,
            (item) => registry.initialProducerCount(item.resource),
            candidate,
            request,
            retained,
          ),
        ),
      );
    same();
    register(layout);
    register(
      { resource: { id: 'another-service', generation: 1 }, input: input('y'.repeat(4096)) },
      other,
    );
    same();
    for (let i = 1; i < 15; i++) registry.retainInitialProducer(layout.resource);
    same(layout.input);
    registry.retainInitialProducer(layout.resource);
    same(layout.input);
    same(layout.input, { replacing: layout });
    same(layout.input, {}, layout);
    same(layout.input, { replacing: layout }, layout);
    same(layout.input, { transient: true });
    const proxy = new Proxy(layout, {
      get() {
        throw Error('Unrequested foreign layout read');
      },
    });
    same(input(), { replacing: proxy });
    same(input(), {}, proxy);
    same(input(), { transient: 'invalid' });
    const frame = registry.acquire([layout.resource]);
    for (let i = 0; i < 16; i++) registry.releaseProducer(layout.resource);
    same();
    same(layout.input, {}, layout);
    same(input(), { replacing: layout });
    registry.retainInitialProducer(layout.resource);
    same(layout.input, { replacing: layout }, layout);
    registry.releaseProducer(layout.resource);
    frame.returnBy('caller');
    same();
    same(input(), {}, layout);
    register({ ...layout, input: input('fresh') });
    same(input(), {}, layout);
    registry.dispose();
  },
);
test(
  'paragraph admission reads live totals after reentrant input serialization',
  { timeout },
  () => {
    const registry = new ResourceRegistry(),
      budget = new TextLayoutBudget(registry),
      layout = { resource: { id: 'reentrant', generation: 1 }, input: input('x'.repeat(4096)) };
    budget.admit(layout.input);
    registry.register(
      { ...layout.resource, kind: 'paragraph' },
      () => {},
      budget.registration(layout),
    );
    for (let i = 1; i < 15; i++) registry.retainInitialProducer(layout.resource);
    let calls = 0;
    const candidate = {
      ...layout.input,
      toJSON() {
        calls++;
        registry.retainInitialProducer(layout.resource);
        return layout.input;
      },
    };
    assert.throws(() => budget.admit(candidate), /Live paragraph content budget exhausted/);
    assert.equal(calls, 1);
    assert.equal(registry.initialProducerCount(layout.resource), 16);
    registry.dispose();
  },
);
