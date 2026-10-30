// SPDX-License-Identifier: BSD-3-Clause
import test from 'node:test';
import assert from 'node:assert/strict';
import { ResourceRegistry } from '@nelyx/core/hosting/resources';
import {
  TextLayoutCache,
  textLayoutCacheLimits as limits,
} from '../../dist/hosting/text-layout-cache.js';
import { ParagraphFontCatalog } from '@nelyx/core/hosting/text-fonts';
import { TextLayoutBudget } from '@nelyx/core/hosting/text-layout-budget';
import {
  textLimits,
  freezeTextInput,
  textInputCost,
  serializeTextInput,
} from '@nelyx/core/ui/text';
const timeout = 1_200_000;
test(
  'only engine-captured canonical input shares one serialization across key, cost, painter and layout snapshot',
  { timeout },
  () => {
    const f = fixture(),
      snapshot = freezeTextInput(f.input('owned', { style: Object.freeze({ fontSize: 17 }) })),
      stringify = JSON.stringify;
    const expected = stringify([snapshot, [[f.font.id, f.font.generation, 'Fixture', 0]]]);
    let serializations = 0;
    try {
      JSON.stringify = function (value, ...args) {
        if (value === snapshot) serializations++;
        return stringify.call(this, value, ...args);
      };
      assert.equal(f.cache.key(snapshot, f.catalog.capture(f.fonts)), '1:' + expected);
      const cost = textInputCost(snapshot);
      assert.equal(cost.bytes, serializeTextInput(snapshot).length * 2);
      assert.equal(f.cache.key(snapshot, f.catalog.capture(f.fonts)), '1:' + expected);
      assert.equal(freezeTextInput(snapshot), snapshot);
      assert.equal(serializations, 1);
      assert.notEqual(
        textInputCost(snapshot),
        cost,
        'Public cost records remain independent values',
      );
    } finally {
      JSON.stringify = stringify;
      f.registry.dispose();
    }
  },
);

test(
  'public frozen proxies and captured extension hooks keep observable serialization and fresh validation',
  { timeout },
  () => {
    const f = fixture();
    let reads = 0,
      hooks = 0;
    try {
      const external = new Proxy(f.input(), {
        get(target, key, receiver) {
          if (key === 'text') reads++;
          return Reflect.get(target, key, receiver);
        },
      });
      f.cache.key(external, f.catalog.capture(f.fonts));
      f.cache.key(external, f.catalog.capture(f.fonts));
      assert(reads >= 2);
      const before = reads;
      freezeTextInput(external);
      freezeTextInput(external);
      assert(reads > before);
      const custom = freezeTextInput(
        f.input('hook', {
          style: Object.freeze({
            fontSize: 17,
            toJSON() {
              hooks++;
              return { fontSize: 17 };
            },
          }),
        }),
      );
      const first = f.cache.key(custom, f.catalog.capture(f.fonts)),
        second = f.cache.key(custom, f.catalog.capture(f.fonts));
      assert.notEqual(first, second);
      assert.equal(hooks, 2);
      textInputCost(custom);
      serializeTextInput(custom);
      assert.equal(hooks, 4);
      assert.notEqual(freezeTextInput(custom), custom);
    } finally {
      f.registry.dispose();
    }
  },
);
test(
  'inherited serialization hooks invalidate certified text data without suppressing hook calls',
  { timeout },
  () => {
    const f = fixture(),
      snapshot = freezeTextInput(f.input());
    let calls = 0;
    try {
      f.cache.key(snapshot, f.catalog.capture(f.fonts));
      Object.defineProperty(Object.prototype, 'toJSON', {
        configurable: true,
        value: function () {
          calls++;
          return this;
        },
      });
      assert.notEqual(
        f.cache.key(snapshot, f.catalog.capture(f.fonts)),
        f.cache.key(snapshot, f.catalog.capture(f.fonts)),
      );
      const before = calls;
      textInputCost(snapshot);
      serializeTextInput(snapshot);
      assert(calls > before);
    } finally {
      delete Object.prototype.toJSON;
      f.registry.dispose();
    }
  },
);
function fixture() {
  const registry = new ResourceRegistry(),
    catalog = new ParagraphFontCatalog(registry),
    cache = new TextLayoutCache(registry, catalog),
    budget = new TextLayoutBudget(registry),
    retired = [];
  const font = Object.freeze({ id: 'font', generation: 1 });
  registry.register({ ...font, kind: 'font' }, () => {});
  const fonts = [{ resource: font, family: 'Fixture' }];
  const input = (text = 'A', extra = {}) =>
    Object.freeze({
      text,
      width: 220,
      font,
      fontSize: 16,
      locale: 'en',
      direction: 'ltr',
      scale: 1,
      ...extra,
    });
  function make(value = input(), { keep = true, retire } = {}) {
    const key = cache.key(value, catalog.capture(fonts));
    budget.admit(value, {}, undefined, cache);
    const layout = Object.freeze({ resource: registry.allocateId('paragraph'), input: value }),
      registration = budget.registration(layout, value);
    registry.register(
      { ...layout.resource, kind: 'paragraph' },
      () => {
        retired.push(layout);
        retire?.();
        cache.forget(key, layout);
      },
      registration,
    );
    cache.remember(key, layout, registration.cost, keep);
    return { layout, key, registration };
  }
  return { registry, catalog, cache, budget, retired, font, fonts, input, make };
}

test(
  'cache residency is independent of logical producers and remains bounded by real frame drain',
  { timeout },
  () => {
    const f = fixture();
    let frame;
    try {
      const { layout, key } = f.make();
      frame = f.registry.acquire([layout.resource]);
      f.registry.releaseProducer(layout.resource);
      assert.equal(f.registry.initialProducerCount(layout.resource), 0);
      assert(f.registry.isRetained(layout.resource));
      assert.equal(
        f.cache.reuse(key, (retained) => f.budget.admit(layout.input, {}, retained, f.cache)),
        layout,
      );
      assert.equal(f.cache.debugStats.cacheOnlyHits, 0, 'A recording also owns this first hit');
      assert.equal(f.registry.initialProducerCount(layout.resource), 1);
      f.registry.releaseProducer(layout.resource);
      frame.returnBy('caller');
      frame = undefined;
      assert.equal(
        f.cache.reuse(key, (retained) => f.budget.admit(layout.input, {}, retained, f.cache)),
        layout,
      );
      assert.equal(
        f.cache.debugStats.cacheOnlyHits,
        1,
        'Only the separate cache owner preserved this second hit',
      );
      frame = f.registry.acquire([layout.resource]);
      f.registry.releaseProducer(layout.resource);
      f.cache.trimIdle(layout);
      assert.equal(f.cache.debugStats.resident, 1, 'Admission protects its exact reused layout');
      f.cache.trimIdle();
      assert.equal(f.cache.debugStats.resident, 0);
      assert(
        f.registry.isRetained(layout.resource),
        'A frame remains charged after cache eviction',
      );
      f.registry.dispose();
      assert(f.retired.length === 0, 'Close must still wait for the real frame');
      frame.returnBy('caller');
      frame = undefined;
      assert.deepEqual(f.retired, [layout]);
      assert.equal(f.cache.debugStats.indexed, 0);
    } finally {
      if (frame && !frame.released) frame.returnBy('caller');
      f.registry.dispose();
    }
  },
);

test(
  'FIFO cache respects paragraph count, UTF16 units and serialized input plus key bytes',
  { timeout },
  () => {
    const f = fixture();
    try {
      const first = f.make(f.input('first')).layout;
      f.registry.releaseProducer(first.resource);
      // One count-boundary case needs 65 entries; no native shaping or repeated scenario run.
      for (let i = 0; i < limits.resident; i++) {
        const { layout } = f.make(f.input('small-' + i));
        f.registry.releaseProducer(layout.resource);
      }
      assert.equal(f.cache.debugStats.resident, limits.resident);
      assert(!f.registry.isRetained(first.resource));
      f.cache.trimIdle();
      const unitFirst = f.make(f.input('A'.repeat(4096))).layout;
      f.registry.releaseProducer(unitFirst.resource);
      for (let i = 0; i < 17; i++) {
        const { layout } = f.make(f.input('A'.repeat(4096), { color: i }));
        f.registry.releaseProducer(layout.resource);
      }
      assert(f.cache.debugStats.units <= limits.units);
      assert(!f.registry.isRetained(unitFirst.resource));
      f.cache.trimIdle();
      const runs = Object.freeze(
        Array.from({ length: 8 }, (_, i) =>
          Object.freeze({
            start: i,
            end: i + 1,
            style: Object.freeze({
              fontFamilies: Object.freeze(
                Array.from({ length: 64 }, (_, j) => 'Family' + j + 'x'.repeat(120)),
              ),
            }),
          }),
        ),
      );
      const byteFirst = f.make(f.input('A'.repeat(512), { runs, color: 0 })).layout;
      f.registry.releaseProducer(byteFirst.resource);
      for (let i = 1; i < 5; i++) {
        const { layout } = f.make(f.input('A'.repeat(512), { runs, color: i }));
        f.registry.releaseProducer(layout.resource);
      }
      assert(f.cache.debugStats.bytes <= limits.bytes);
      assert(!f.registry.isRetained(byteFirst.resource));
    } finally {
      f.registry.dispose();
      assert.equal(f.cache.debugStats.resident, 0);
    }
  },
);

test(
  'transient measurements, Paint dependencies and oversized entries do not acquire cache owners',
  { timeout },
  () => {
    const f = fixture();
    try {
      for (const options of [
        { value: f.input('transient'), keep: false },
        { value: f.input('paint', { style: { foreground: { color: 0xff000000 } } }) },
        {
          value: f.input('run-paint', {
            runs: [{ start: 0, end: 1, style: { background: { color: 0xff000000 } } }],
          }),
        },
        { value: f.input('byte-heavy', { padding: 'x'.repeat(limits.bytes) }) },
      ]) {
        const { layout } = f.make(options.value, { keep: options.keep });
        f.registry.releaseProducer(layout.resource);
        assert(!f.registry.isRetained(layout.resource));
      }
      assert.equal(f.cache.debugStats.resident, 0);
    } finally {
      f.registry.dispose();
    }
  },
);

test(
  'font catalog A to B to A releases idle owners and fences a reentrant old key',
  { timeout },
  () => {
    const f = fixture();
    try {
      const { layout, key } = f.make();
      f.registry.releaseProducer(layout.resource);
      const second = { resource: { id: 'font-b', generation: 1 }, family: 'Second' };
      f.registry.register({ ...second.resource, kind: 'font' }, () => {});
      f.fonts.push(second);
      const b = f.cache.key(layout.input, f.catalog.capture(f.fonts));
      assert(!f.registry.isRetained(layout.resource));
      assert.throws(() => f.cache.reuse(key, () => {}), /catalog changed/);
      f.fonts.pop();
      const a = f.cache.key(layout.input, f.catalog.capture(f.fonts));
      assert.notEqual(a, key);
      assert.notEqual(a, b);
      const current = f.make().layout;
      f.registry.releaseProducer(current.resource);
      const currentKey = f.cache.key(current.input, f.catalog.capture(f.fonts));
      assert.throws(
        () =>
          f.cache.reuse(currentKey, () => {
            f.fonts.push(second);
            f.cache.key(current.input, f.catalog.capture(f.fonts));
          }),
        /catalog changed during admission/,
      );
      assert.equal(f.registry.initialProducerCount(current.resource), 0);
    } finally {
      f.registry.dispose();
    }
  },
);

test(
  'resident pressure evicts idle cache before admission and serializes each input once',
  { timeout },
  () => {
    const f = fixture(),
      frames = [];
    let calls = 0;
    try {
      const idle = f.make().layout;
      f.registry.releaseProducer(idle.resource);
      const large = f.input('A', {
        toJSON() {
          calls++;
          return 'x'.repeat(textLimits.producerInputBytes / 2 - 2);
        },
      });
      for (let i = 0; i < 4; i++) {
        f.budget.admit(large, {}, undefined, f.cache);
        const layout = Object.freeze({ resource: f.registry.allocateId('large'), input: large }),
          registration = f.budget.registration(layout, large);
        f.registry.register({ ...layout.resource, kind: 'paragraph' }, () => {}, registration);
        frames.push(f.registry.acquire([layout.resource]));
        f.registry.releaseProducer(layout.resource);
      }
      assert.equal(calls, 4);
      assert(!f.registry.isRetained(idle.resource));
      assert.equal(f.cache.debugStats.resident, 0);
      assert.throws(
        () => f.budget.admit(f.input('new'), {}, undefined, f.cache),
        /Retained paragraph content budget exhausted/,
        'Frames cannot be evicted for cache admission',
      );
      frames.shift().returnBy('caller');
      assert.doesNotThrow(() => f.budget.admit(f.input('new'), {}, undefined, f.cache));
    } finally {
      for (const frame of frames) if (!frame.released) frame.returnBy('caller');
      f.registry.dispose();
    }
  },
);

test(
  'uncertain cache retirement remains charged and prevents later cache borrows',
  { timeout },
  () => {
    const f = fixture();
    try {
      const { layout, registration } = f.make(f.input('failure'), {
        retire() {
          throw Error('native retirement probe');
        },
      });
      f.registry.releaseProducer(layout.resource);
      assert.throws(() => f.cache.trimIdle(), /native retirement probe/);
      assert.equal(f.cache.debugStats.failed, true);
      assert.equal(
        registration.owner.totals.resident,
        1,
        'Only an acknowledged native retirement removes the charge',
      );
      assert.throws(
        () => f.cache.key(f.input('later'), f.catalog.capture(f.fonts)),
        /cache retirement failed/,
      );
    } finally {
      f.registry.dispose();
    }
  },
);
