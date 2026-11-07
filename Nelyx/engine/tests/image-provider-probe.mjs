// SPDX-License-Identifier: BSD-3-Clause
import { EngineV2Assets, nativeAssetTransport } from '../../sdk/src/runtime/engine-v2-assets.ts';
import { EngineV2Buffers } from '../../sdk/src/runtime/engine-v2-buffers.ts';
import { EngineV2Images } from '../../sdk/src/runtime/engine-v2-images.ts';
import {
  MemoryImage,
  FileImage,
  NetworkImage,
  ExactAssetImage,
  ResizeImage,
  imageAssetBundleFor,
  imageCacheFor,
} from '@nelyx/core/framework/painting/image-provider';
import { ImageConfiguration } from '@nelyx/core/framework/painting/image-configuration';
import { ImageStreamListener } from '@nelyx/core/framework/painting/image-stream';

// This is an App decoder/IO ownership control. Core deadlines and the actual
// Original Widget clock are exercised separately, without this manual clock.
export async function imageProviderProbe(backend, png, gif, origin, fileUri) {
  const check = (value, message) => {
    if (!value) throw Error(message);
  };
  const equal = (a, b) => a.length === b.length && a.every((value, index) => value === b[index]);
  const settle = async () => {
    for (let index = 0; index < 20; ++index) await Promise.resolve();
  };
  const rejects = async (run, part) => {
    let error;
    try {
      await run();
    } catch (value) {
      error = value;
    }
    check(error && String(error).includes(part), 'Expected ' + part + ': ' + error);
  };
  const frames = new Set(),
    timers = new Set();
  let now = 0;
  const assets = new EngineV2Assets(async () => backend, nativeAssetTransport),
    buffers = new EngineV2Buffers(
      () => backend,
      async () => backend,
      assets,
    ),
    images = new EngineV2Images(buffers, assets),
    clock = images.bindClock({
      now: () => now,
      requestFrame(callback) {
        frames.add(callback);
        return { dispose: () => frames.delete(callback) };
      },
      scheduleTimer(callback, delay) {
        const value = { callback, at: now + delay };
        timers.add(value);
        return { dispose: () => timers.delete(value) };
      },
    }),
    service = images.service,
    cache = imageCacheFor(service),
    config = new ImageConfiguration({ images: service, bundle: imageAssetBundleFor(service) });
  const advance = async (at) => {
    now = at;
    const ready = [...frames],
      due = [...timers].filter((value) => value.at <= now);
    for (const callback of ready) if (frames.delete(callback)) callback();
    for (const timer of due) if (timers.delete(timer)) timer.callback();
    await settle();
  };
  const listen = (provider) => {
    const stream = provider.resolve(config),
      values = [],
      chunks = [],
      errors = [];
    let ready;
    const first = new Promise((resolve) => (ready = resolve));
    const listener = new ImageStreamListener(
      (info, synchronous) => {
        values.push({ info, synchronous });
        ready(info);
      },
      { onChunk: (value) => chunks.push(value), onError: (error) => errors.push(String(error)) },
    );
    stream.addListener(listener);
    return {
      stream,
      first,
      values,
      chunks,
      errors,
      stop() {
        if (!stream.completer?.debugDisposed) stream.removeListener(listener);
        for (const value of values) if (!value.info.image.debugDisposed) value.info.dispose();
      },
    };
  };
  const listeners = [];
  try {
    globalThis.__networkStage = 'provider-capture';
    const mutable = png.slice(),
      pending = service.instantiateImageCodec(mutable);
    mutable.fill(9);
    const codec = await pending,
      frame = await codec.getNextFrame();
    codec.dispose();
    check(
      equal(await frame.image.toByteData(), [255, 0, 0, 255, 0, 255, 0, 255]),
      'Admitted provider bytes captured before yield',
    );
    frame.image.dispose();
    const creates = images.execution.descriptorCreates;
    await rejects(
      () =>
        service.instantiateImageCodec(png, {
          getTargetSize() {
            throw Error('target failure');
          },
        }),
      'target failure',
    );
    check(
      images.execution.descriptorCreates === creates + 1 &&
        backend.images.snapshot().descriptors === 0,
      'Failed target retires captured backing/descriptor',
    );

    globalThis.__networkStage = 'provider-cache';
    const memory = new MemoryImage(png),
      first = listen(memory),
      shared = listen(new MemoryImage(png));
    listeners.push(first, shared);
    const one = await first.first,
      two = await shared.first;
    check(
      first.stream.completer === shared.stream.completer,
      'Equivalent providers share one cache decoder',
    );
    check(one.image.isCloneOf(two.image), 'Cache delivery clones share native frame ownership');
    const beforeReuse = images.execution.descriptorCreates,
      reuse = listen(memory);
    listeners.push(reuse);
    await reuse.first;
    check(
      reuse.values[0].synchronous && images.execution.descriptorCreates === beforeReuse,
      'Cache reuse is synchronous with no new decoder',
    );

    const asset = listen(new ExactAssetImage('image.png')),
      file = listen(new FileImage(fileUri)),
      resized = listen(new ResizeImage(memory, { width: 1, height: 1 }));
    listeners.push(asset, file, resized);
    for (const value of [asset, file]) {
      const info = await value.first;
      check(
        equal(await info.image.toByteData(), [255, 0, 0, 255, 0, 255, 0, 255]),
        'Actual packaged/file provider pixels',
      );
    }
    const small = await resized.first;
    check(
      small.image.width === 1 && small.image.height === 1,
      'ResizeImage drives actual decoder target',
    );

    globalThis.__networkStage = 'provider-http';
    const network = listen(
      new NetworkImage(origin + '/provider/chunks?source=provider', {
        headers: { 'X-Nelyx-Image': 'fixture', Authorization: 'Bearer fixture' },
      }),
    );
    listeners.push(network);
    check(
      equal(await (await network.first).image.toByteData(), [255, 0, 0, 255, 0, 255, 0, 255]),
      'Actual header-authenticated streamed image',
    );
    check(
      network.chunks.some(
        (value) =>
          value.cumulativeBytesLoaded > 0 && value.cumulativeBytesLoaded < value.expectedTotalBytes,
      ) && network.chunks.at(-1).cumulativeBytesLoaded === 128 * 1024 + 12 + png.length,
      'Actual streamed image reports bounded progress: ' + JSON.stringify(network.chunks),
    );
    for (const path of ['same', 'cross']) {
      const bytes = await service.loadNetwork(origin + '/provider/' + path, {
        Authorization: 'Bearer fixture',
        Cookie: 'session=fixture',
        'X-Nelyx-Image': 'fixture',
      });
      check(equal(bytes, png), 'Redirected image bytes: ' + path);
    }
    await rejects(
      () =>
        service.loadNetwork(origin + '/provider/chunks', {
          'X-Nelyx-Image': 'bad\r\nInjected: value',
        }),
      'header',
    );
    await rejects(() => service.loadNetwork(origin + '/provider/large'), 'resource budget');
    const request = service.loadNetworkRequest(origin + '/provider/stall'),
      progress = new Promise((resolve) =>
        request.addProgressListener((event) => {
          if (event.cumulativeBytesLoaded) resolve();
        }),
      );
    await progress;
    request.cancel();
    await rejects(() => request.promise, 'cancel');
    check(
      assets.execution.pending === 0 && backend.snapshot().networkBuffers === 0,
      'Cancelled image read retires all asynchronous HTTP callbacks',
    );

    globalThis.__networkStage = 'provider-animation';
    const animated = listen(new MemoryImage(gif));
    listeners.push(animated);
    await settle();
    await advance(100);
    check(animated.values.length === 1, 'Actual GIF first frame');
    check(
      equal(await animated.values[0].info.image.toByteData(), [255, 0, 0, 255, 255, 0, 0, 255]),
      'Actual GIF first pixels',
    );
    await advance(110);
    check(
      animated.values.length === 1 && timers.size === 1,
      'GIF duration waits instead of repeatedly requesting frames',
    );
    await advance(149);
    check(animated.values.length === 1, 'GIF cannot advance before its deadline');
    await advance(150);
    await advance(151);
    check(animated.values.length === 2, 'Actual GIF second frame');
    check(
      equal(await animated.values[1].info.image.toByteData(), [0, 128, 0, 255, 0, 128, 0, 255]),
      'Actual GIF second pixels',
    );
    animated.stop();
    await advance(152); // Retire the cache's deferred last-listener handle too.
    check(
      timers.size === 0 && frames.size === 0,
      'Removing final GIF listener cancels its pending clock work',
    );
    for (const value of listeners) {
      value.stop();
      check(value.errors.length === 0, 'Provider listener failures: ' + value.errors);
    }
    check(await memory.evict({ configuration: config }), 'Canonical provider cache eviction');
    cache.clear();
    cache.clearLiveImages();
    await advance(300);
    await settle();
    const execution = images.execution;
    check(
      execution.descriptorCreates === execution.backend.descriptorCreates &&
        execution.frameDecodes === execution.backend.frameDecodes &&
        execution.pixelReadBytes === execution.backend.pixelReadBytes,
      'SDK and actual decoder work agree',
    );
    check(
      execution.backend.descriptors === 0 &&
        execution.backend.codecs === 0 &&
        execution.backend.frames === 0,
      'All provider handles retire after eviction',
    );
    check(
      buffers.execution.creditBytes === 0 && assets.execution.pending === 0,
      'Provider immutable/IO owners drain',
    );
    return {
      execution,
      assets: assets.execution,
      buffers: buffers.execution,
      streamedProgress: network.chunks.length,
      cacheReused: true,
      canceled: true,
      clockControl: 'manual-App-control; Core deadlines tested separately',
    };
  } finally {
    for (const listener of listeners) listener.stop();
    clock.dispose();
    await images.close();
    await assets.close();
    await buffers.close();
    backend.close();
  }
}
