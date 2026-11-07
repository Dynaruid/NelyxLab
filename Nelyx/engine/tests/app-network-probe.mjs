// SPDX-License-Identifier: BSD-3-Clause
import { nativeAppTextBackend } from '@nelyx/core/v2';
import { NetworkAssetBundle } from '@nelyx/core/services/asset-bundle';
import { bindAssetLoader } from '@nelyx/core/internal/services/asset-loader-binding';
import { bindImmutableBufferLoader } from '@nelyx/core/internal/ui/immutable-buffer-binding';
import { EngineV2Assets, nativeAssetTransport } from '../../sdk/src/runtime/engine-v2-assets.ts';
import { EngineV2Buffers } from '../../sdk/src/runtime/engine-v2-buffers.ts';

export async function appNetworkProbe(native, origin, runPublicProbe) {
  globalThis.__networkStage = 'foreign';
  const check = (value, message) => {
    if (!value) throw Error(message);
  };
  const tick = () => new Promise((resolve) => setTimeout(resolve, 5));
  const backend = nativeAppTextBackend(native),
    foreign = nativeAppTextBackend(native);
  const retire = async (owner, handle) => {
    owner.cancelNetwork(handle);
    while (!owner.retireNetwork(handle)) await tick();
  };
  const fail = (run, message) => {
    let rejected = false;
    try {
      run();
    } catch {
      rejected = true;
    }
    check(rejected, message);
  };
  const first = backend.openNetwork(origin + '/network/', 'stall-headers');
  const alien = foreign.openNetwork(origin + '/network/', 'stall-headers');
  try {
    fail(() => foreign.pollNetwork(first), 'Foreign HTTP owner');
    fail(() => backend.cancelNetwork(alien), 'Foreign HTTP cancellation');
    fail(() => backend.close(), 'Live HTTP metadata/callbacks prevent close');
    const credit = backend.reserveAssetBytes(0);
    try {
      fail(() => backend.pollNetwork(credit), 'Wrong-kind HTTP handle');
      fail(() => backend.resizeAssetBytes(first, 1), 'Wrong-kind asset resize');
      fail(() => foreign.resizeAssetBytes(credit, 1), 'Foreign asset resize');
      backend.resizeAssetBytes(credit, 7);
      fail(() => backend.finishAssetLoad(credit, true, 8), 'Final asset size admission');
      check(backend.snapshot().assetDataBytes === 7, 'Resize updates admitted data');
    } finally {
      backend.finishAssetLoad(credit, false);
    }
  } finally {
    await retire(backend, first);
    await retire(foreign, alien);
    foreign.close();
  }
  const handles = [];
  globalThis.__networkStage = 'count';
  try {
    // One deterministic count-capacity case, not repeated trials.
    for (let i = 0; i < 32; ++i)
      handles.push(backend.openNetwork(origin + '/network/', 'stall-headers'));
    check(backend.snapshot().networkBuffers === 32, 'Native HTTP count admission');
    check(backend.snapshot().networkBufferBytes === 32 * 512 * 1024, 'Native HTTP metadata credit');
    fail(
      () => backend.openNetwork(origin + '/network/', 'stall-headers'),
      'Native HTTP count limit',
    );
  } finally {
    for (const handle of handles) backend.cancelNetwork(handle);
    for (const handle of handles) await retire(backend, handle);
  }
  const borrowed = backend.openNetwork(origin + '/network/', 'bytes');
  globalThis.__networkStage = 'borrowed';
  while (backend.pollNetwork(borrowed).phase === 0) await tick();
  check(backend.pollNetwork(borrowed).phase === 1, 'Borrowed HTTP headers');
  backend.readNetwork(borrowed);
  while (backend.pollNetwork(borrowed).phase === 2) await tick();
  const ArrayBufferType = globalThis.ArrayBuffer;
  let held = false;
  globalThis.ArrayBuffer = function (length) {
    backend.cancelNetwork(borrowed);
    held = !backend.retireNetwork(borrowed) && backend.snapshot().networkBufferBytes === 512 * 1024;
    fail(() => backend.readNetwork(borrowed), 'Reentrant read cannot overwrite a borrowed chunk');
    return new ArrayBufferType(length);
  };
  try {
    const chunk = backend.networkChunk(borrowed);
    check(
      chunk.length === 3 && chunk[2] === 3 && held,
      'JSI HTTP chunk survives reentrant cancellation',
    );
  } finally {
    globalThis.ArrayBuffer = ArrayBufferType;
    await retire(backend, borrowed);
  }
  const baseline = backend.snapshot();
  const assets = new EngineV2Assets(async () => backend, nativeAssetTransport);
  const buffers = new EngineV2Buffers(
    () => backend,
    async () => backend,
    assets,
  );
  const assetBinding = bindAssetLoader({
    load: (key) => assets.load(key),
    loadNetwork: (base, key) => {
      globalThis.__networkStage = 'load:' + key;
      return assets.loadNetwork(base, key);
    },
    loadNetworkBuffer: (base, key) => {
      globalThis.__networkStage = 'buffer:' + key;
      return buffers.loadNetwork(base, key);
    },
  });
  globalThis.__networkInspect = () =>
    JSON.stringify({
      stage: globalThis.__networkStage,
      assets: assets.execution,
      buffers: buffers.execution,
      text: backend.snapshot(),
    });
  const bufferBinding = bindImmutableBufferLoader(buffers);
  let checkpoint;
  try {
    const result = await runPublicProbe(NetworkAssetBundle, origin, (expected) => {
      const state = backend.snapshot(),
        execution = assets.execution;
      checkpoint = {
        requests: state.networkRequests - baseline.networkRequests,
        bytes: state.networkReadBytes - baseline.networkReadBytes,
        sdkRawReads: execution.networkReads,
        sdkRawBytes: execution.networkBytes,
        sdkBufferReads: execution.networkBufferReads,
        sdkBufferBytes: execution.networkBufferBytes,
      };
      check(checkpoint.requests === 16, 'Actual Native GET/redirect requests');
      check(
        checkpoint.bytes === expected.rawBytes + expected.bufferBytes,
        'Native read completions equal SDK captures',
      );
      check(
        execution.networkReads === expected.rawReads &&
          execution.networkBytes === expected.rawBytes,
        'SDK raw network aggregation',
      );
      check(
        execution.networkBufferReads === expected.bufferReads &&
          execution.networkBufferBytes === expected.bufferBytes,
        'SDK immutable network aggregation',
      );
      check(
        state.networkBuffers === 0 && buffers.execution.creditBytes === 0,
        'Last HTTP callback and immutable holder retire',
      );
    });
    const after = backend.snapshot();
    globalThis.__networkStage = 'pending';
    const pending = new NetworkAssetBundle(origin + '/network/').load('stall');
    while (backend.snapshot().networkReadBytes === after.networkReadBytes) await tick();
    check(
      assets.execution.pending === 1 && backend.snapshot().networkBuffers === 1,
      'Actual HTTP read is pending before close',
    );
    await assets.close();
    globalThis.__networkStage = 'closed';
    let cancelled = false;
    try {
      await pending;
    } catch {
      cancelled = true;
    }
    check(cancelled, 'App close cancels HTTP body reads');
    await buffers.close();
    const execution = assets.execution,
      finalBuffers = buffers.execution;
    check(
      execution.networkCreditBytes === 0 &&
        execution.failedCredits === 0 &&
        execution.failedClosures === 0,
      'HTTP close returns all staging',
    );
    check(
      execution.reads === 14 &&
        execution.bytes === 86 &&
        execution.buffers === 14 &&
        execution.creditBytes === 917762,
      'Only delivered ByteData survives logical close',
    );
    check(
      finalBuffers.copies === 1 && finalBuffers.bytes === 3 && finalBuffers.creditBytes === 0,
      'Native immutable network capture',
    );
    backend.close();
    return {
      result,
      checkpoint,
      execution,
      buffers: finalBuffers,
      closed: backend.snapshot(),
      controls: {
        countLimit: 32,
        metadataBytes: 512 * 1024,
        foreign: true,
        borrowedRead: true,
        cancelled: true,
        appParagraphDemand: 0,
      },
    };
  } finally {
    assetBinding.dispose();
    bufferBinding.dispose();
  }
}
