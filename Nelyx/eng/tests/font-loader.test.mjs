// SPDX-License-Identifier: BSD-3-Clause
import test from 'node:test';
import assert from 'node:assert/strict';
import { FontLoader, bindFontLoader } from '@nelyx/core/services/font-loader';
import { loadFontFromList } from '@nelyx/core/ui/fonts';
const timeout = 1_200_000;
const deferred = () => {
  let resolve, reject;
  const promise = new Promise((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
};
const stateError = (error) =>
  error.name === 'StateError' && error.message === 'FontLoader is already loaded';
test(
  'ui.loadFontFromList shares the Source font owner and forwards views and optional families',
  { timeout },
  async () => {
    const backing = new Uint8Array([9, 1, 2, 8]),
      bytes = backing.subarray(1, 3),
      calls = [],
      fault = {},
      binding = bindFontLoader({
        async loadFont(data, family) {
          calls.push({ data, family });
          if (family === 'Fail') throw fault;
        },
      });
    try {
      await loadFontFromList(bytes);
      await loadFontFromList(bytes, { fontFamily: null });
      await loadFontFromList(bytes, { fontFamily: '' });
      await loadFontFromList(bytes, { fontFamily: 'Alias' });
      await assert.rejects(loadFontFromList(bytes, { fontFamily: 'Fail' }), (e) => e === fault);
      assert.deepEqual(
        calls.map((call) => call.family),
        [undefined, undefined, '', 'Alias', 'Fail'],
      );
      assert.ok(calls.every((call) => call.data === bytes && call.data.byteOffset === 1));
    } finally {
      binding.dispose();
    }
    await assert.rejects(loadFontFromList(bytes), /initialized App font owner/);
  },
);
test(
  'A pending ui font load remains with its captured App after the default owner changes',
  { timeout },
  async () => {
    const pending = deferred(),
      calls = [],
      bytes = new Uint8Array(12),
      original = bindFontLoader({
        loadFont() {
          calls.push('old');
          return pending.promise;
        },
      });
    let replacement;
    try {
      const loading = loadFontFromList(bytes);
      original.dispose();
      replacement = bindFontLoader({
        async loadFont() {
          calls.push('new');
        },
      });
      pending.reject('old App closed');
      await assert.rejects(loading, (e) => e === 'old App closed');
      assert.deepEqual(calls, ['old']);
      await loadFontFromList(bytes);
      assert.deepEqual(calls, ['old', 'new']);
    } finally {
      original.dispose();
      replacement?.dispose();
    }
  },
);
test(
  'Source FontLoader loads in add order, preserves ByteData views and locks before awaiting assets',
  { timeout },
  async () => {
    const first = deferred(),
      gate = deferred(),
      calls = [],
      backing = new Uint8Array([9, 1, 2, 3, 8]);
    class CustomLoader extends FontLoader {
      async loadFont(bytes, family) {
        calls.push({ bytes, family });
        if (calls.length === 1) await gate.promise;
      }
    }
    const loader = new CustomLoader('Family');
    loader.addFont(first.promise);
    loader.addFont(Promise.resolve(new Uint8Array([4, 5, 6])));
    const loading = loader.load();
    assert.throws(() => loader.addFont(Promise.resolve(new Uint8Array(0))), stateError);
    await assert.rejects(loader.load(), stateError);
    assert.deepEqual(calls, []);
    first.resolve(backing.subarray(1, 4));
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(calls.length, 1);
    assert.equal(calls[0].family, 'Family');
    assert.equal(calls[0].bytes.buffer, backing.buffer);
    assert.equal(calls[0].bytes.byteOffset, 1);
    assert.deepEqual([...calls[0].bytes], [1, 2, 3]);
    gate.resolve();
    await loading;
    assert.deepEqual(
      calls.map((call) => [...call.bytes]),
      [
        [1, 2, 3],
        [4, 5, 6],
      ],
    );
    await assert.rejects(loader.load(), stateError);
  },
);
test(
  'Source FontLoader keeps one-shot state after asset/hook failure and an empty loader needs no backend',
  { timeout },
  async () => {
    const fault = {},
      later = deferred(),
      calls = [];
    class CustomLoader extends FontLoader {
      async loadFont(bytes) {
        calls.push(bytes);
      }
    }
    const loader = new CustomLoader('Family');
    loader.addFont(Promise.reject(fault));
    loader.addFont(later.promise);
    later.reject('later asset failed');
    await assert.rejects(loader.load(), (error) => error === fault);
    assert.equal(calls.length, 0);
    await assert.rejects(loader.load(), stateError);
    class FailingHook extends FontLoader {
      async loadFont() {
        throw false;
      }
    }
    const failing = new FailingHook('Family');
    failing.addFont(Promise.resolve(new Uint8Array(12)));
    await assert.rejects(failing.load(), (error) => error === false);
    await assert.rejects(failing.load(), stateError);
    await new FontLoader('Empty').load();
  },
);
test(
  'FontLoader rejects an unbound/foreign namespace and releases only its own realm lease',
  { timeout },
  async () => {
    const unbound = new FontLoader('Family');
    unbound.addFont(Promise.resolve(new Uint8Array(12)));
    await assert.rejects(unbound.load(), /initialized App font owner/);
    const calls = [],
      backend = {
        async loadFont(bytes, family) {
          calls.push({ bytes, family });
        },
      },
      a = bindFontLoader(backend),
      b = bindFontLoader(backend);
    try {
      assert.throws(() => bindFontLoader({ async loadFont() {} }), /different default FontLoader/);
      a.dispose();
      a.dispose();
      const loader = new FontLoader('Family');
      loader.addFont(Promise.resolve(new Uint8Array(12)));
      await loader.load();
      assert.equal(calls.length, 1);
      assert.equal(calls[0].family, 'Family');
    } finally {
      a.dispose();
      b.dispose();
    }
    const retired = new FontLoader('Family');
    retired.addFont(Promise.resolve(new Uint8Array(12)));
    await assert.rejects(retired.load(), /initialized App font owner/);
  },
);
test(
  'An unresolved Source font future cannot migrate to a replacement default App',
  { timeout },
  async () => {
    const asset = deferred(),
      calls = [];
    let closed = false;
    const old = bindFontLoader({
      async loadFont() {
        if (closed) throw Error('old App is closed');
        calls.push('old');
      },
    });
    let replacement;
    try {
      const loader = new FontLoader('Family');
      loader.addFont(asset.promise);
      const loading = loader.load();
      closed = true;
      old.dispose();
      replacement = bindFontLoader({
        async loadFont() {
          calls.push('new');
        },
      });
      asset.resolve(new Uint8Array(12));
      await assert.rejects(loading, /old App is closed/);
      assert.deepEqual(calls, []);
    } finally {
      old.dispose();
      replacement?.dispose();
    }
  },
);
