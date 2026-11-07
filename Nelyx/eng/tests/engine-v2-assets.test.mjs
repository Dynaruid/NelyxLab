// SPDX-License-Identifier: BSD-3-Clause
import test from 'node:test';
import assert from 'node:assert/strict';
import { EngineV2Assets } from '../../sdk/src/runtime/engine-v2-assets.ts';
const timeout = 1_200_000;
function backend() {
  const credits = new Map();
  let next = 0;
  return {
    credits,
    reserveAssetBytes(size) {
      const id = ++next;
      credits.set(id, { size, delivered: false });
      return id;
    },
    finishAssetLoad(id, delivered) {
      const entry = credits.get(id);
      if (!entry || entry.delivered) throw Error('foreign/delivered');
      if (delivered) entry.delivered = true;
      else credits.delete(id);
    },
    resizeAssetBytes(id, size) {
      const entry = credits.get(id);
      if (!entry || entry.delivered) throw Error('foreign/delivered');
      entry.size = size;
    },
    snapshot() {
      return {
        assetBuffers: credits.size,
        assetBufferBytes: [...credits.values()].reduce((n, e) => n + 3 * e.size + 65536, 0),
        assetDataBytes: [...credits.values()].reduce((n, e) => n + e.size, 0),
        assetNativeReads: 0,
        assetNativeReadBytes: 0,
      };
    },
  };
}

test(
  'An unresolved asynchronous transport keeps staging credit and blocks later IO and drained close',
  { timeout },
  async () => {
    const owner = backend();
    let fail;
    const retiring = new Promise((_resolve, reject) => {
      fail = reject;
    });
    const assets = new EngineV2Assets(
      async () => owner,
      async () => ({ size: 3, read: async () => new Uint8Array([1, 2, 3]), close: () => retiring }),
    );
    const work = assets.load('input');
    while (!owner.credits.size) await new Promise((resolve) => setImmediate(resolve));
    assert.equal(owner.credits.size, 1);
    fail(Error('OS callback retirement unresolved'));
    await assert.rejects(work, /retirement failed/);
    assert.equal(owner.credits.size, 1);
    assert.equal(assets.execution.failedClosures, 1);
    assert.equal(assets.execution.failedCredits, 1);
    await assert.rejects(assets.load('next'), /unresolved/);
    await assert.rejects(assets.close(), /unresolved/);
  },
);

test(
  'A captured immutable result is retired if internal asset staging cannot return its credit',
  { timeout },
  async () => {
    const owner = backend();
    let retired = 0;
    owner.finishAssetLoad = () => {
      throw Error('release refused');
    };
    const assets = new EngineV2Assets(
      async () => owner,
      async () => ({
        size: 3,
        async read() {
          return new Uint8Array([1, 2, 3]);
        },
        close() {},
      }),
    );
    await assert.rejects(
      assets.consumeBuffer(
        'input',
        () => ({
          dispose() {
            ++retired;
          },
        }),
        (value) => value.dispose(),
      ),
      (error) =>
        error instanceof AggregateError &&
        error.errors.some((item) => item.message === 'release refused'),
    );
    assert.equal(retired, 1);
    assert.equal(assets.execution.failedCredits, 1);
    await assert.rejects(assets.close(), /unresolved until realm termination/);
  },
);
test(
  'App assets admit before allocation, reject hidden backing storage and keep delivered credit through close',
  { timeout },
  async () => {
    const owner = backend();
    let mode = 'valid',
      descriptions = 0,
      reads = 0;
    const assets = new EngineV2Assets(
      async () => owner,
      async () => {
        ++descriptions;
        return {
          size: mode === 'huge' ? 33 * 1024 * 1024 : 3,
          async read() {
            ++reads;
            assert.ok(owner.credits.size > 0);
            return mode === 'hidden'
              ? new Uint8Array(100).subarray(2, 5)
              : new Uint8Array([1, 2, 3]);
          },
          close() {},
        };
      },
    );
    for (const key of [
      '../bad',
      '/bad',
      'a//b',
      'a/./b',
      'bad\\key',
      'bad\u0000key',
      'bad?key',
      'bad.',
    ])
      await assert.rejects(assets.load(key), /Invalid application asset name/);
    assert.equal(descriptions, 0);
    mode = 'huge';
    await assert.rejects(assets.load('valid'), /resource budget/);
    assert.equal(reads, 0);
    assert.equal(owner.credits.size, 0);
    mode = 'hidden';
    await assert.rejects(assets.load('valid'), /size\/ownership/);
    assert.equal(owner.credits.size, 0);
    mode = 'valid';
    const bytes = await assets.load('한글 data.bin');
    assert.deepEqual([...bytes], [1, 2, 3]);
    const credit = assets.execution.creditBytes;
    assert.ok(credit > bytes.length);
    await assets.close();
    assert.equal(assets.execution.creditBytes, credit);
    assert.deepEqual([...bytes], [1, 2, 3]);
    await assert.rejects(assets.load('valid'), /closing/);
  },
);
test(
  'Closing during owned IO aborts it, rejects the caller and returns its undelivered credit',
  { timeout },
  async () => {
    const owner = backend();
    let entered;
    const started = new Promise((resolve) => {
        entered = resolve;
      }),
      assets = new EngineV2Assets(
        async () => owner,
        async (_backend, _key, cancel) => ({
          size: 4,
          read() {
            return new Promise((_yes, no) => {
              cancel.listen(() => no(Error('cancelled')));
              entered();
            });
          },
          close() {},
        }),
      );
    const load = assets.load('pending');
    const rejected = assert.rejects(load, /cancelled/);
    await started;
    assert.equal(owner.credits.size, 1);
    await assets.close();
    await rejected;
    assert.equal(owner.credits.size, 0);
    assert.equal(assets.execution.pending, 0);
  },
);
test(
  'A failed credit return is quarantined and closing cannot claim that the resource drained',
  { timeout },
  async () => {
    const owner = backend();
    owner.finishAssetLoad = () => {
      throw Error('release failed');
    };
    const assets = new EngineV2Assets(
      async () => owner,
      async () => ({
        size: 4,
        async read() {
          throw Error('IO failed');
        },
        close() {},
      }),
    );
    await assert.rejects(
      assets.load('broken'),
      (e) => e instanceof AggregateError && e.errors.length === 2,
    );
    assert.equal(assets.execution.failedCredits, 1);
    assert.equal(owner.credits.size, 1);
    await assert.rejects(assets.close(), /unresolved until realm termination/);
  },
);
