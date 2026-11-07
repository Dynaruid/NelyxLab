// SPDX-License-Identifier: BSD-3-Clause
import { ImmutableBuffer, CachingAssetBundle, rootBundle } from '@nelyx/core/services/asset-bundle';
import {
  retainImmutableBuffer,
  bindImmutableBufferLoader,
} from '@nelyx/core/internal/ui/immutable-buffer-binding';
import { bindAssetLoader } from '@nelyx/core/internal/services/asset-loader-binding';
import { EngineV2Buffers } from '../../sdk/src/runtime/engine-v2-buffers.ts';
import { EngineV2Assets, nativeAssetTransport } from '../../sdk/src/runtime/engine-v2-assets.ts';
const check = (value, message) => {
  if (!value) throw Error(message);
};
export async function appBuffersProbe(backend, options = {}) {
  const assets = new EngineV2Assets(async () => backend, options.transport ?? nativeAssetTransport),
    buffers = new EngineV2Buffers(
      () => backend,
      async () => backend,
      assets,
    ),
    binding = bindImmutableBufferLoader(buffers),
    assetBinding = bindAssetLoader({
      load: (key) => assets.load(key),
      loadBuffer: (key) => buffers.loadAsset(key),
    });
  const live = [];
  try {
    const source = new Uint8Array([99, 1, 2, 3, 99]),
      pending = ImmutableBuffer.fromUint8List(source.subarray(1, 4));
    source.fill(7);
    const copied = await pending,
      held = retainImmutableBuffer(copied);
    live.push(held);
    const same = (value) =>
      value.length === 3 && value[0] === 1 && value[1] === 2 && value[2] === 3;
    const chunk = held.read(0, 3);
    check(same(chunk), 'C++ copied the selected input view before returning the future');
    chunk.fill(9);
    check(same(held.read(0, 3)), 'Mutable chunk cannot change engine-owned immutable bytes');
    const credit = backend.snapshot().immutableBufferBytes;
    copied.dispose();
    check(
      copied.debugDisposed && copied.length === 3 && same(held.read(0, 3)),
      'Engine holder survives public dispose',
    );
    check(
      backend.snapshot().immutableBufferBytes === credit,
      'Public dispose cannot return a retained allocation credit',
    );
    let rejected = false;
    try {
      copied.dispose();
    } catch {
      rejected = true;
    }
    check(rejected, 'Double Source dispose rejected');
    rejected = false;
    try {
      retainImmutableBuffer(copied);
    } catch {
      rejected = true;
    }
    check(rejected, 'Disposed Source handle cannot retain');
    held.dispose();
    live.pop();
    check(
      backend.snapshot().immutableBufferBytes === 0,
      'Last holder returns real allocation credit',
    );
    class Custom extends CachingAssetBundle {
      async load() {
        return new Uint8Array([99, 1, 2, 3, 99]).subarray(1, 4);
      }
    }
    const values = [
      await rootBundle.loadBuffer('한글 data.bin'),
      await ImmutableBuffer.fromAsset('한글 data.bin'),
      await ImmutableBuffer.fromAsset('empty.bin'),
      await new Custom().loadBuffer('custom'),
    ];
    live.push(...values);
    for (const value of values) {
      const lease = retainImmutableBuffer(value);
      try {
        check(
          value.length === 0 ? lease.read(0, 0).length === 0 : same(lease.read(0, 3)),
          'Asset/custom/empty immutable bytes',
        );
      } finally {
        lease.dispose();
      }
    }
    if (options.filePath) {
      const file = await ImmutableBuffer.fromFilePath(options.filePath);
      live.push(file);
      const lease = retainImmutableBuffer(file);
      try {
        check(same(lease.read(0, 3)), 'Native UTF-8 filesystem buffer');
      } finally {
        lease.dispose();
      }
    } else {
      rejected = false;
      try {
        await ImmutableBuffer.fromFilePath('no-native-file');
      } catch {
        rejected = true;
      }
      check(rejected, 'Web file capability is explicitly unavailable');
    }
    for (const value of live.splice(0)) value.dispose();
    const baseline = backend.snapshot().immutableBufferBytes;
    check(
      baseline === 0 && backend.snapshot().immutableBuffers === 0,
      'All fixture handles retired',
    );
    for (const key of ['../text.txt', 'missing.bin']) {
      rejected = false;
      try {
        await ImmutableBuffer.fromAsset(key);
      } catch {
        rejected = true;
      }
      check(
        rejected && backend.snapshot().immutableBufferBytes === baseline,
        'Failed asset creates no allocation credit',
      );
    }
    const bytes = new Uint8Array(8 * 1024 * 1024);
    let admitted = 0;
    for (let index = 0; index < 6; ++index) {
      try {
        live.push(await ImmutableBuffer.fromUint8List(bytes));
        ++admitted;
      } catch {
        break;
      }
    }
    check(
      admitted >= 3 && admitted <= 4,
      'Real memory/data ceiling refuses before another engine copy',
    );
    const before = backend.snapshot();
    rejected = false;
    try {
      backend.close();
    } catch {
      rejected = true;
    }
    check(
      rejected && !backend.snapshot().closed,
      'Backend cannot claim a drain with live immutable buffers',
    );
    for (const value of live.splice(0)) value.dispose();
    const execution = buffers.execution;
    check(
      execution.handles === 0 && execution.nativeHandles === 0 && execution.creditBytes === 0,
      'Immutable buffers fully drained',
    );
    check(
      execution.copies === execution.nativeCopies &&
        execution.bytes === execution.nativeCopyBytes &&
        execution.reads === execution.nativeReads &&
        execution.readBytes === execution.nativeReadBytes,
      'Actual engine allocations/chunks match SDK counts',
    );
    await assets.close();
    await buffers.close();
    binding.dispose();
    assetBinding.dispose();
    if (options.closeBackend !== false) backend.close();
    return {
      admitted,
      execution,
      peakCreditBytes: before.immutableBufferBytes,
      closed: backend.snapshot(),
      assetReads: assets.execution.bufferReads,
    };
  } finally {
    for (const value of live)
      try {
        value.dispose();
      } catch {}
    binding.dispose();
    assetBinding.dispose();
    await assets.close();
    await buffers.close();
    if (options.closeBackend !== false && !backend.snapshot().closed) backend.close();
  }
}
