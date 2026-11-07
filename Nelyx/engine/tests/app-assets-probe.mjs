// SPDX-License-Identifier: BSD-3-Clause
import { EngineV2Assets, nativeAssetTransport } from '../../sdk/src/runtime/engine-v2-assets.ts';
import { rootBundle } from '@nelyx/core/services/asset-bundle';
import { bindAssetLoader } from '@nelyx/core/internal/services/asset-loader-binding';
const check = (value, message) => {
  if (!value) throw Error(message);
};
export async function appAssetsProbe(backend) {
  const assets = new EngineV2Assets(async () => backend, nativeAssetTransport),
    binding = bindAssetLoader(assets);
  let captured;
  try {
    check((await rootBundle.loadString('text.txt')) === 'hello 한글', 'Native UTF-8 asset text');
    const reads = backend.snapshot().assetNativeReads;
    await rootBundle.loadString('text.txt');
    check(backend.snapshot().assetNativeReads === reads, 'Canonical string hits must avoid IO');
    await rootBundle.loadString('text.txt', { cache: false });
    check(backend.snapshot().assetNativeReads === reads + 1, 'Uncached text must read fresh bytes');
    let rejected = false;
    try {
      await rootBundle.loadStructuredData('data.json', () => {
        throw Error('parser refused');
      });
    } catch {
      rejected = true;
    }
    check(rejected, 'A caller parser failure must reject');
    const value = await rootBundle.loadStructuredData('data.json', JSON.parse);
    check(value.value === 2, 'Structured data retries from real packaged bytes');
    check(
      (await rootBundle.loadStructuredData('data.json', () => {
        throw Error('cache failed');
      })) === value,
      'Structured hit identity',
    );
    captured = await rootBundle.load('한글 data.bin');
    check(
      captured.length === 3 && captured[0] === 1,
      'Native UTF-8/space path and exact byte buffer',
    );
    captured[0] = 9;
    const fresh = await rootBundle.load('한글 data.bin');
    check(
      fresh[0] === 1 && fresh.buffer !== captured.buffer,
      'Binary loads are independent caller data',
    );
    check((await rootBundle.load('empty.bin')).length === 0, 'Empty assets are valid');
    const before = backend.snapshot();
    for (const key of ['missing.bin', '../text.txt', '/text.txt', 'bad\\key']) {
      rejected = false;
      try {
        await rootBundle.load(key);
      } catch {
        rejected = true;
      }
      check(rejected, 'Missing/foreign assets must fail');
    }
    check(
      backend.snapshot().assetNativeReads === before.assetNativeReads &&
        backend.snapshot().assetBuffers === before.assetBuffers,
      'Rejected inputs must neither read nor retain new credit',
    );
    const credit = backend.reserveAssetBytes(0);
    let blocked = false;
    try {
      backend.close();
    } catch {
      blocked = true;
    }
    check(blocked, 'An undelivered asset must prevent premature close');
    backend.finishAssetLoad(credit, false);
    blocked = false;
    try {
      backend.finishAssetLoad(credit, false);
    } catch {
      blocked = true;
    }
    check(blocked, 'Duplicate asset credit return');
    const execution = assets.execution;
    check(
      execution.reads >= 7 &&
        execution.reads === execution.nativeReads &&
        execution.bytes === execution.nativeReadBytes,
      'Actual C++ asset reads and bytes must match SDK IO',
    );
    await assets.close();
    binding.dispose();
    backend.close();
    const closed = backend.snapshot();
    check(
      closed.closed &&
        closed.assetBuffers === execution.reads &&
        closed.reservedBytes >= closed.assetBufferBytes &&
        captured[0] === 9,
      'Delivered caller bytes retain their credit after logical close until realm teardown',
    );
    return { execution, closed, callerBytesRetained: true };
  } finally {
    binding.dispose();
    await assets.close();
    if (!backend.snapshot().closed) backend.close();
  }
}
