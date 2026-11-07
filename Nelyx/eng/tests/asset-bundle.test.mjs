// SPDX-License-Identifier: BSD-3-Clause
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CachingAssetBundle,
  PlatformAssetBundle,
  NetworkAssetBundle,
  rootBundle,
} from '@nelyx/core/services/asset-bundle';
import { bindAssetLoader } from '@nelyx/core/internal/services/asset-loader-binding';
import { DefaultAssetBundle } from '@nelyx/core/framework/widgets/default-asset-bundle';
const timeout = 1_200_000;
const utf8 = (value) => new TextEncoder().encode(value);

test(
  'Network bundles capture their realm before IO and never cache string or parser results',
  { timeout },
  async () => {
    let reads = 0,
      resolve;
    const first = bindAssetLoader({
      load: async () => new Uint8Array(),
      loadNetwork(base, key) {
        assert.equal(base, 'https://example.test/base/');
        assert.equal(key, '../asset');
        ++reads;
        return new Promise((done) => {
          resolve = done;
        });
      },
    });
    const bundle = new NetworkAssetBundle('https://example.test/base/');
    let second;
    try {
      const old = bundle.load('../asset');
      first.dispose();
      second = bindAssetLoader({
        load: async () => new Uint8Array(),
        loadNetwork: async () => utf8(JSON.stringify({ value: ++reads })),
      });
      resolve(utf8('old realm'));
      assert.equal(new TextDecoder().decode(await old), 'old realm');
      assert.notEqual(await bundle.loadString('a'), await bundle.loadString('a'));
      let parses = 0;
      const parser = (text) => {
        ++parses;
        return JSON.parse(text);
      };
      assert.notDeepEqual(
        await bundle.loadStructuredData('a', parser),
        await bundle.loadStructuredData('a', parser),
      );
      assert.equal(parses, 2);
      assert.equal(reads, 5);
      assert.equal(bundle.toString(), 'NetworkAssetBundle(https://example.test/base/)');
      assert.throws(() => new NetworkAssetBundle(null), /Invalid NetworkAssetBundle/);
    } finally {
      first.dispose();
      second?.dispose();
    }
  },
);
test(
  'Structured asset caching runs one parser, retries failure from fresh bytes and does not populate the string cache',
  { timeout },
  async () => {
    let reads = 0,
      parses = 0,
      source = 'broken';
    class Bundle extends CachingAssetBundle {
      async load() {
        ++reads;
        return utf8(source);
      }
    }
    const bundle = new Bundle();
    await assert.rejects(bundle.loadStructuredData('config', JSON.parse));
    source = '{"value":2}';
    const value = await bundle.loadStructuredData('config', (text) => {
      ++parses;
      return JSON.parse(text);
    });
    assert.deepEqual(value, { value: 2 });
    assert.equal(reads, 2);
    assert.equal(
      await bundle.loadStructuredData('config', () => {
        throw Error('cached parser ran twice');
      }),
      value,
    );
    assert.equal(bundle.peekStructuredData('config'), value);
    assert.equal(parses, 1);
    await bundle.loadString('config');
    assert.equal(reads, 3);
    bundle.evict('config');
    assert.equal(bundle.peekStructuredData('config'), undefined);
    await bundle.loadStructuredData('config', JSON.parse);
    assert.equal(reads, 4);
    bundle.clear();
    assert.equal(bundle.peekStructuredData('config'), undefined);
  },
);
test(
  'Platform/root bundles reject foreign owners, scope cache hits and keep a late old result out of the replacement App',
  { timeout },
  async () => {
    let finish,
      reads = 0;
    const pending = new Promise((resolve) => {
        finish = resolve;
      }),
      backend = {
        load() {
          ++reads;
          return pending;
        },
      },
      a = bindAssetLoader(backend),
      b = bindAssetLoader(backend),
      bundle = new PlatformAssetBundle();
    let next;
    try {
      assert.throws(
        () =>
          bindAssetLoader({
            async load() {
              return utf8('foreign');
            },
          }),
        /different default AssetBundle/,
      );
      const old = bundle.loadStructuredData('same', JSON.parse);
      a.dispose();
      a.dispose();
      b.dispose();
      next = bindAssetLoader({
        async load() {
          return utf8('{"owner":"new"}');
        },
      });
      assert.deepEqual(await bundle.loadStructuredData('same', JSON.parse), { owner: 'new' });
      finish(utf8('{"owner":"old"}'));
      assert.deepEqual(await old, { owner: 'old' });
      assert.deepEqual(bundle.peekStructuredData('same'), { owner: 'new' });
      assert.equal(reads, 1);
      assert.equal(await rootBundle.loadString('root'), '{"owner":"new"}');
    } finally {
      a.dispose();
      b.dispose();
      next?.dispose();
    }
    await assert.rejects(rootBundle.loadString('root'), /initialized App asset owner/);
    await assert.rejects(bundle.load('same'), /initialized App asset owner/);
  },
);
test(
  'DefaultAssetBundle uses the App root without an ImageService and preserves inherited overrides',
  { timeout },
  async () => {
    const binding = bindAssetLoader({
      async load() {
        return utf8('root');
      },
    });
    try {
      const context = {
        maybeDependOn() {
          return null;
        },
        get services() {
          throw Error('ImageService was consulted');
        },
      };
      assert.equal(DefaultAssetBundle.of(context), rootBundle);
      const custom = new PlatformAssetBundle();
      assert.equal(
        DefaultAssetBundle.of({
          maybeDependOn() {
            return { bundle: custom };
          },
        }),
        custom,
      );
      assert.equal(await custom.loadString('value'), 'root');
    } finally {
      binding.dispose();
    }
  },
);
