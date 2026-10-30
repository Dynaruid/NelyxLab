// SPDX-License-Identifier: BSD-3-Clause
import test from 'node:test';
import assert from 'node:assert/strict';
import { ResourceRegistry } from '@nelyx/core/hosting/resources';
import { ParagraphFontCatalog, ParagraphFontProviders } from '@nelyx/core/hosting/text-fonts';
import { TextLayoutCache } from '@nelyx/core/hosting/text-layout-cache';
import { NativeTextLayoutService } from '../../skia/packages/native/dist/text.js';
import { resourceKey } from '@nelyx/core/ui/frame';
const timeout = 1_200_000;
function fixture() {
  const registry = new ResourceRegistry(),
    catalog = new ParagraphFontCatalog(registry),
    cache = new TextLayoutCache(registry, catalog),
    retired = [];
  const a = { resource: { id: 'font-a', generation: 1 }, family: 'A', sourceBytes: 100 },
    b = { resource: { id: 'font-b', generation: 1 }, family: 'B', sourceBytes: 200 };
  for (const font of [a, b])
    registry.register({ ...font.resource, kind: 'font' }, () => retired.push(font.family));
  return {
    registry,
    catalog,
    cache,
    a,
    b,
    retired,
    input: {
      text: '한글 A😀',
      width: 200,
      font: a.resource,
      fontSize: 16,
      locale: 'ko',
      direction: 'ltr',
      scale: 1,
    },
  };
}
function thrown(run, value) {
  let caught = false;
  try {
    run();
  } catch (error) {
    caught = true;
    assert.equal(error, value);
  }
  assert(caught, 'Expected the original thrown value');
}

test(
  'cache and provider consume one captured font revision and never reread its source metadata',
  { timeout },
  () => {
    const f = fixture();
    let family = 'A',
      reads = 0,
      iterations = 0,
      created = 0,
      retired = 0;
    const source = {
        ...f.a,
        get family() {
          reads++;
          return family;
        },
      },
      iterable = {
        *[Symbol.iterator]() {
          iterations++;
          yield source;
        },
      },
      providers = new ParagraphFontProviders(f.registry, f.catalog, (fonts) => {
        created++;
        assert.equal(fonts[0].family, 'A');
        return {
          provider: {},
          retire() {
            retired++;
          },
        };
      });
    try {
      const snapshot = f.catalog.capture(iterable),
        key = f.cache.key(f.input, snapshot);
      family = 'B';
      const first = providers.acquire(f.a.resource, snapshot),
        second = providers.acquire(f.a.resource, snapshot);
      assert.equal(first.provider, second.provider);
      assert.deepEqual(first.families, ['A']);
      assert.equal(first.fonts[0].source, source);
      assert.equal(reads, 1);
      assert.equal(iterations, 1);
      assert.equal(created, 1);
      const next = f.catalog.capture(iterable);
      assert.equal(next.revision, snapshot.revision + 1);
      assert.equal(next.fonts[0].family, 'B');
      assert.throws(
        () => f.cache.reuse(key, () => assert.fail('Stale admission')),
        /catalog changed/,
        'Capture alone invalidates an old cache key',
      );
      assert.throws(() => providers.acquire(f.a.resource, snapshot), /catalog changed/);
      first.release();
      assert.equal(retired, 0);
      second.release();
      second.release();
      assert.equal(retired, 1);
      assert.equal(providers.debugSourceBytes, 0);
      assert.equal(
        f.catalog.capture(iterable),
        next,
        'Unchanged sources share a canonical revision',
      );
      const back = f.catalog.capture([f.a]);
      assert(back.revision > next.revision, 'A to B to A does not revive stale revisions');
    } finally {
      f.registry.dispose();
    }
  },
);

test(
  'capture errors preserve the last revision; foreign and Proxy receipts fail before property access',
  { timeout },
  () => {
    const f = fixture(),
      snapshot = f.catalog.capture([f.a]),
      providers = new ParagraphFontProviders(f.registry, f.catalog, () =>
        assert.fail('Foreign provider'),
      );
    try {
      for (const value of [undefined, null, 0]) {
        thrown(
          () =>
            f.catalog.capture([
              {
                ...f.a,
                get family() {
                  throw value;
                },
              },
            ]),
          value,
        );
        assert.equal(f.catalog.capture([f.a]), snapshot);
      }
      assert.throws(
        () =>
          f.catalog.capture([
            {
              ...f.a,
              get family() {
                f.catalog.capture([]);
                return 'A';
              },
            },
          ]),
        /cannot reenter/,
      );
      assert.equal(f.catalog.capture([f.a]), snapshot);
      const proxy = new Proxy(snapshot, {
        get() {
          assert.fail('Receipt must be rejected by identity');
        },
      });
      assert.throws(() => f.cache.key(f.input, proxy), /catalog changed/);
      assert.throws(() => providers.acquire(f.a.resource, proxy), /catalog changed/);
      const foreign = new ResourceRegistry();
      try {
        assert.throws(() => new TextLayoutCache(foreign, f.catalog), /another resource registry/);
      } finally {
        foreign.dispose();
      }
    } finally {
      f.registry.dispose();
    }
  },
);

test(
  'serialization reentry cannot stamp an old font key with the new catalog revision',
  { timeout },
  () => {
    const f = fixture(),
      snapshot = f.catalog.capture([f.a]);
    let calls = 0;
    try {
      const input = {
        ...f.input,
        toJSON() {
          calls++;
          f.catalog.capture([f.b]);
          return f.input;
        },
      };
      assert.throws(() => f.cache.key(input, snapshot), /catalog changed/);
      assert.equal(calls, 1);
      const current = f.catalog.capture([f.b]);
      assert.doesNotThrow(() => f.cache.key(f.input, current));
    } finally {
      f.registry.dispose();
    }
  },
);

test(
  'provider construction reentry retires its unpublished provider and returns its exact font lease',
  { timeout },
  () => {
    const f = fixture(),
      snapshot = f.catalog.capture([f.a]);
    let creates = 0,
      retires = 0;
    const providers = new ParagraphFontProviders(f.registry, f.catalog, () => {
      creates++;
      assert.throws(() => providers.acquire(f.a.resource, snapshot), /cannot reenter/);
      f.catalog.capture([f.b]);
      return {
        provider: {},
        retire() {
          retires++;
        },
      };
    });
    try {
      assert.throws(() => providers.acquire(f.a.resource, snapshot), /catalog changed/);
      assert.equal(creates, 1);
      assert.equal(retires, 1);
      assert.equal(providers.debugProviderCount, 0);
      assert.equal(providers.debugSourceBytes, 0);
      f.registry.releaseProducer(f.a.resource);
      assert.deepEqual(
        f.retired,
        ['A'],
        'Rollback returned the lease rather than retaining an unpublished catalog',
      );
    } finally {
      f.registry.dispose();
    }
  },
);

test(
  'provider result failures preserve falsey errors and retire with the original callback receiver',
  { timeout },
  () => {
    for (const value of [undefined, null, 0]) {
      const f = fixture(),
        snapshot = f.catalog.capture([f.a]);
      let retired = 0;
      class Result {
        #live = true;
        get provider() {
          throw value;
        }
        retire() {
          assert(this.#live);
          this.#live = false;
          retired++;
        }
      }
      const providers = new ParagraphFontProviders(f.registry, f.catalog, () => new Result());
      try {
        thrown(() => providers.acquire(f.a.resource, snapshot), value);
        assert.equal(retired, 1);
        assert.equal(providers.debugSourceBytes, 0);
        f.registry.releaseProducer(f.a.resource);
        assert.deepEqual(f.retired, ['A']);
      } finally {
        f.registry.dispose();
      }
    }
  },
);

test(
  'a retiring provider cannot be borrowed by a reentrant retirement callback',
  { timeout },
  () => {
    const f = fixture(),
      snapshot = f.catalog.capture([f.a]);
    let creates = 0,
      retires = 0;
    const providers = new ParagraphFontProviders(f.registry, f.catalog, () => ({
      provider: ++creates,
      retire() {
        retires++;
        assert.throws(
          () => providers.acquire(f.a.resource, snapshot),
          /retiring paragraph font provider/,
        );
      },
    }));
    try {
      const first = providers.acquire(f.a.resource, snapshot);
      first.release();
      const second = providers.acquire(f.a.resource, snapshot);
      assert.notEqual(second.provider, first.provider);
      second.release();
      assert.equal(retires, 2);
      assert.equal(providers.debugProviderCount, 0);
    } finally {
      f.registry.dispose();
    }
  },
);

test(
  'unacknowledged construction retirement retains font residency and prevents later borrows',
  { timeout },
  () => {
    const f = fixture(),
      snapshot = f.catalog.capture([f.a]);
    const providers = new ParagraphFontProviders(f.registry, f.catalog, () => {
      f.catalog.capture([f.b]);
      return {
        provider: {},
        retire() {
          throw 0;
        },
      };
    });
    try {
      assert.throws(
        () => providers.acquire(f.a.resource, snapshot),
        (error) =>
          error instanceof AggregateError &&
          error.errors[0].code === 'text-cache-catalog-changed' &&
          error.errors[1] === 0,
      );
      assert.equal(providers.debugSourceBytes, 100);
      assert.equal(providers.debugProviderCount, 1);
      f.registry.releaseProducer(f.a.resource);
      assert(f.registry.isRetained(f.a.resource));
      assert.deepEqual(f.retired, []);
      assert.throws(
        () => providers.acquire(f.b.resource, f.catalog.capture([f.b])),
        /retirement failed/,
      );
    } finally {
      f.registry.dispose();
    }
  },
);

test(
  'native text adapter uses one catalog capture for cache, fallback shaping and frame-owned retirement',
  { timeout },
  () => {
    const f = fixture(),
      styles = [],
      registered = [],
      disposed = [];
    let iterations = 0,
      sequence = 0;
    const font = (source) => ({
        ...source,
        typeface: {},
        provider: {},
        bundledTypefaceId: source === f.a ? 1 : 2,
      }),
      a = font(f.a),
      b = font(f.b),
      fonts = new Map([[resourceKey(a.resource), a]]),
      values = fonts.values;
    fonts.values = function () {
      iterations++;
      return values.call(this);
    };
    const api = {
      Color: (value) => value,
      TypefaceFontProvider: {
        Make() {
          const id = ++sequence;
          return {
            registerFont(face, family) {
              registered.push([id, family]);
            },
            dispose() {
              disposed.push('provider' + id);
            },
          };
        },
      },
      ParagraphBuilder: {
        nelyxTextStyleVersion: () => 1,
        nelyxTextBoundaryVersion: () => 2,
        nelyxParagraphApiVersion: () => 2,
        Make(style) {
          styles.push(style.textStyle.fontFamilies);
          return {
            pushStyle() {},
            pop() {},
            addText() {},
            dispose() {},
            build() {
              let width;
              return {
                layout(value) {
                  width = value;
                },
                getMaxWidth: () => width,
                getHeight: () => 20,
                nelyxTextMetrics: () => [12, 14, 10, 10, 10, 0, 0],
                getLineMetrics: () => [],
                getRectsForPlaceholders: () => [],
                dispose() {
                  disposed.push('paragraph');
                },
              };
            },
          };
        },
      },
    };
    const service = new NativeTextLayoutService(
      api,
      f.registry,
      { id: 'view', generation: 1 },
      fonts,
    );
    let frame;
    try {
      const first = service.layout(f.input),
        again = service.layout(f.input),
        paint = service.layout({ ...f.input, color: 0xff123456 });
      assert.equal(first, again);
      assert.notEqual(first, paint);
      assert.equal(iterations, 3);
      assert.equal(service.debugStats.fontProviders, 1);
      frame = f.registry.acquire([first.resource]);
      fonts.set(resourceKey(b.resource), b);
      const fallback = service.layout(f.input);
      assert.notEqual(fallback, first);
      assert.equal(iterations, 4);
      assert.deepEqual(styles, [['A'], ['A'], ['A', 'B']]);
      assert.deepEqual(registered, [
        [1, 'A'],
        [2, 'A'],
        [2, 'B'],
      ]);
      assert.equal(service.debugStats.fontProviders, 2);
      f.registry.releaseProducer(first.resource);
      f.registry.releaseProducer(again.resource);
      f.registry.releaseProducer(paint.resource);
      assert.equal(
        service.debugStats.fontProviders,
        2,
        'A recorded old paragraph still owns its provider',
      );
      frame.returnBy('caller');
      frame = undefined;
      assert.equal(service.debugStats.fontProviders, 1);
      assert(disposed.includes('provider1'));
      f.registry.releaseProducer(fallback.resource);
      f.registry.dispose();
      assert.equal(service.debugStats.fontProviders, 0);
      assert.equal(disposed.filter((value) => value === 'paragraph').length, 3);
      assert(disposed.includes('provider2'));
    } finally {
      if (frame && !frame.released) frame.returnBy('caller');
      f.registry.dispose();
    }
  },
);
