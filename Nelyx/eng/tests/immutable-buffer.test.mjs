// SPDX-License-Identifier: BSD-3-Clause
import test from 'node:test';
import assert from 'node:assert/strict';
import { ImmutableBuffer, CachingAssetBundle } from '@nelyx/core/services/asset-bundle';
import {
  bindImmutableBufferLoader,
  retainImmutableBuffer,
} from '@nelyx/core/internal/ui/immutable-buffer-binding';
import { EngineV2Assets } from '../../sdk/src/runtime/engine-v2-assets.ts';
import { EngineV2Buffers } from '../../sdk/src/runtime/engine-v2-buffers.ts';
const timeout = 1_200_000;
function owner(
  transport = async () => {
    throw Error('unexpected IO');
  },
) {
  let next = 0,
    copies = 0,
    copyBytes = 0,
    reads = 0,
    readBytes = 0;
  const values = new Map(),
    credits = new Set();
  const backend = {
    createBuffer(bytes) {
      const handle = ++next;
      values.set(handle, { bytes: bytes.slice() });
      ++copies;
      copyBytes += bytes.length;
      return { handle, length: bytes.length };
    },
    retainBuffer(handle) {
      assert.ok(values.has(handle));
      const id = ++next;
      values.set(id, values.get(handle));
      return id;
    },
    releaseBuffer(handle) {
      assert.ok(values.delete(handle));
    },
    bufferChunk(handle, offset, size) {
      ++reads;
      readBytes += size;
      return values.get(handle).bytes.slice(offset, offset + size);
    },
    reserveAssetBytes() {
      const id = ++next;
      credits.add(id);
      return id;
    },
    finishAssetLoad(id) {
      assert.ok(credits.delete(id));
    },
    snapshot() {
      const unique = [...new Set(values.values())];
      return {
        immutableBuffers: values.size,
        immutableBufferDataBytes: unique.reduce((sum, value) => sum + value.bytes.length, 0),
        immutableBufferBytes: unique.reduce(
          (sum, value) => sum + 2 * value.bytes.length + 65536,
          0,
        ),
        immutableBufferCopies: copies,
        immutableBufferCopyBytes: copyBytes,
        immutableBufferReads: reads,
        immutableBufferReadBytes: readBytes,
        immutableBufferFileReads: 0,
        immutableBufferFileBytes: 0,
      };
    },
  };
  const assets = new EngineV2Assets(async () => backend, transport),
    buffers = new EngineV2Buffers(
      () => backend,
      async () => backend,
      assets,
    );
  return { backend, buffers, assets, values, credits };
}
test(
  'ImmutableBuffer captures a selected view before yielding and retains engine memory at the last holder',
  { timeout },
  async () => {
    const value = owner(),
      binding = bindImmutableBufferLoader(value.buffers);
    let buffer, held;
    try {
      const bytes = new Uint8Array([99, 1, 2, 3, 99]),
        pending = ImmutableBuffer.fromUint8List(bytes.subarray(1, 4));
      bytes.fill(9);
      buffer = await pending;
      held = retainImmutableBuffer(buffer);
      assert.deepEqual([...held.read(0, 3)], [1, 2, 3]);
      const mutated = held.read(0, 3);
      mutated.fill(8);
      assert.deepEqual([...held.read(0, 3)], [1, 2, 3]);
      const credit = value.buffers.execution.creditBytes;
      buffer.dispose();
      assert.equal(buffer.debugDisposed, true);
      assert.equal(buffer.length, 3);
      assert.throws(() => buffer.dispose(), /more than once/);
      assert.throws(() => retainImmutableBuffer(buffer), /disposed/);
      assert.throws(() => retainImmutableBuffer({}), /foreign/);
      assert.equal(value.buffers.execution.creditBytes, credit);
      assert.deepEqual([...held.read(0, 3)], [1, 2, 3]);
      held.dispose();
      held = undefined;
      assert.equal(value.buffers.execution.creditBytes, 0);
      assert.throws(
        () => value.buffers.create(new Uint8Array(new SharedArrayBuffer(3))),
        /Invalid/,
      );
      await value.buffers.close();
    } finally {
      held?.dispose();
      if (buffer && !buffer.debugDisposed) buffer.dispose();
      binding.dispose();
      await value.assets.close();
      await value.buffers.close();
    }
    await assert.rejects(ImmutableBuffer.fromUint8List(new Uint8Array()), /initialized App/);
  },
);
test(
  'A custom AssetBundle buffer keeps its captured App while a late read crosses a default-owner replacement',
  { timeout },
  async () => {
    const first = owner(),
      second = owner();
    let finish,
      value,
      binding = bindImmutableBufferLoader(first.buffers),
      next;
    const bytes = new Promise((resolve) => {
      finish = resolve;
    });
    class Custom extends CachingAssetBundle {
      load() {
        return bytes;
      }
    }
    try {
      const pending = new Custom().loadBuffer('old');
      binding.dispose();
      next = bindImmutableBufferLoader(second.buffers);
      finish(new Uint8Array([1, 2]));
      value = await pending;
      assert.equal(first.buffers.execution.copies, 1);
      assert.equal(second.buffers.execution.copies, 0);
      value.dispose();
      value = undefined;
    } finally {
      value?.dispose();
      binding.dispose();
      next?.dispose();
      await first.buffers.close();
      await second.buffers.close();
    }
  },
);
test(
  'Buffer startup IO cancels without publishing a late capture and a failed release prevents a drained close',
  { timeout },
  async () => {
    let entered;
    const start = new Promise((resolve) => {
        entered = resolve;
      }),
      value = owner(async (_backend, _key, cancel) => ({
        size: 3,
        read() {
          return new Promise((_, reject) => {
            cancel.listen(() => reject(Error('cancelled')));
            entered();
          });
        },
        close() {},
      }));
    const pending = value.buffers.loadAsset('pending'),
      rejected = assert.rejects(pending, /cancelled/);
    await start;
    await value.buffers.close();
    await rejected;
    assert.equal(value.buffers.execution.copies, 0);
    assert.equal(value.credits.size, 0);
    const failed = owner(),
      captured = failed.buffers.create(new Uint8Array([1]));
    const release = failed.backend.releaseBuffer;
    failed.backend.releaseBuffer = () => {
      throw Error('release refused');
    };
    assert.throws(() => captured.dispose(), /release refused/);
    await assert.rejects(failed.buffers.close(), /remain live/);
    assert.equal(failed.buffers.execution.handles, 1);
    failed.backend.releaseBuffer = release;
    captured.dispose();
    await failed.buffers.close();
    assert.equal(failed.buffers.execution.handles, 0);
  },
);
