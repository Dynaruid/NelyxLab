// SPDX-License-Identifier: BSD-3-Clause
import { ImmutableBuffer } from '@nelyx/core/ui/immutable-buffer';
import { ImageDescriptor } from '@nelyx/core/ui/image-descriptor';
import {
  instantiateImageCodec,
  instantiateImageCodecFromBuffer,
  instantiateImageCodecWithSize,
} from '@nelyx/core/ui/image-decoder';
import { bindImageDescriptorLoader } from '@nelyx/core/internal/ui/image-descriptor-binding';
import { bindImmutableBufferLoader } from '@nelyx/core/internal/ui/immutable-buffer-binding';
import { EngineV2Assets } from '../../sdk/src/runtime/engine-v2-assets.ts';
import { EngineV2Buffers } from '../../sdk/src/runtime/engine-v2-buffers.ts';
import { EngineV2Images } from '../../sdk/src/runtime/engine-v2-images.ts';
import { Image } from '@nelyx/core/ui/image';
import { ResourceRegistry } from '@nelyx/core/hosting/resources';
import { readRasterImage } from '@nelyx/core/v2';
export const imageFixture = {
  png: 'iVBORw0KGgoAAAANSUhEUgAAAAIAAAABCAYAAAD0In+KAAAADklEQVR4nGP4z8DwHwQBEPgD/U6VwW8AAAAASUVORK5CYII=',
  gif: 'R0lGODlhAgABAIEAAP8AAAAAAAAAAAAAACH/C05FVFNDQVBFMi4wAwEBAAAh+QQIBQAAACwAAAAAAgABAAAIBQABAAgIACH5BAgMAAAALAAAAAACAAEAgQCAAAAAAAAAAAAAAAgFAAEACAgAOw==',
};
const check = (value, message) => {
  if (!value) throw Error(message);
};
const equal = (a, b) => a.length === b.length && a.every((value, i) => value === b[i]);
async function rejects(work, part) {
  let error;
  try {
    await work();
  } catch (value) {
    error = value;
  }
  check(error && String(error).includes(part), 'Expected rejection ' + part + ': ' + error);
}
/** Shared unchanged by actual Windows/Hermes, owned CanvasKit and normal App fixtures. */
export async function imageDescriptorProbe(png, gif, notify = () => {}, assetKey = null) {
  const check = (value, message) => {
    if (!value) throw Error(message);
  };
  const equal = (a, b) => a.length === b.length && a.every((value, i) => value === b[i]);
  const rejects = async (work, part) => {
    let error;
    try {
      await work();
    } catch (value) {
      error = value;
    }
    check(error && String(error).includes(part), 'Expected rejection ' + part + ': ' + error);
  };
  const raw = new Uint8Array([
    99, 255, 0, 0, 255, 0, 255, 0, 255, 91, 92, 93, 94, 0, 0, 255, 255, 255, 255, 255, 255, 99,
  ]);
  const pending = ImmutableBuffer.fromUint8List(raw.subarray(1, 21));
  raw.fill(9);
  const buffer = await pending;
  let descriptor, codec, resized, first, second, clone;
  try {
    descriptor = ImageDescriptor.raw(buffer, {
      width: 2,
      height: 2,
      rowBytes: 12,
      pixelFormat: 'rgba8888',
    });
    check(
      descriptor.width === 2 && descriptor.height === 2 && descriptor.bytesPerPixel === 4,
      'Raw descriptor metadata',
    );
    await rejects(
      () =>
        Promise.resolve(
          ImageDescriptor.raw(buffer, {
            width: 2,
            height: 2,
            rowBytes: 4,
            pixelFormat: 'rgba8888',
          }),
        ),
      'row',
    );
    await rejects(
      () =>
        Promise.resolve(
          ImageDescriptor.raw(buffer, { width: 2, height: 2, pixelFormat: 'rgbaFloat32' }),
        ),
      'floating-point',
    );
    buffer.dispose();
    notify('raw-descriptor');
    codec = await descriptor.instantiateCodec({ targetWidth: 0, targetHeight: -1 });
    resized = await descriptor.instantiateCodec({ targetWidth: 1 });
    descriptor.dispose();
    descriptor = undefined;
    const frames = await Promise.all([codec.getNextFrame(), codec.getNextFrame()]);
    first = frames[0].image;
    second = frames[1].image;
    check(
      frames.every((frame) => frame.duration === 0) &&
        codec.frameCount === 1 &&
        codec.repetitionCount === 0,
      'Still codec metadata',
    );
    codec.dispose();
    codec = undefined;
    const small = await resized.getNextFrame();
    try {
      check(small.image.width === 1 && small.image.height === 1, 'Aspect preserving resize');
    } finally {
      small.image.dispose();
    }
    resized.dispose();
    resized = undefined;
    clone = first.clone();
    check(clone.isCloneOf(first), 'Decoded image canonical clone identity');
    first.dispose();
    first = undefined;
    check(
      equal(
        await clone.toByteData(),
        [255, 0, 0, 255, 0, 255, 0, 255, 0, 0, 255, 255, 255, 255, 255, 255],
      ),
      'Raw padded rows/immutable captured pixels survive all source owners',
    );
    await rejects(() => clone.toByteData({ format: 'png' }), 'currently requires');
    second.dispose();
    second = undefined;
    clone.dispose();
    clone = undefined;
  } finally {
    clone?.dispose();
    first?.dispose();
    second?.dispose();
    codec?.dispose();
    resized?.dispose();
    descriptor?.dispose();
    if (!buffer.debugDisposed) buffer.dispose();
  }
  // Encoded factory must retain before yielding to its caller.
  const encoded =
      assetKey === null
        ? await ImmutableBuffer.fromUint8List(png)
        : await ImmutableBuffer.fromAsset(assetKey),
    creating = ImageDescriptor.encoded(encoded);
  encoded.dispose();
  descriptor = await creating;
  try {
    check(descriptor.width === 2 && descriptor.height === 1, 'Encoded metadata before pixels');
    codec = await descriptor.instantiateCodec();
    descriptor.dispose();
    descriptor = undefined;
    const frame = await codec.getNextFrame();
    try {
      check(
        equal(await frame.image.toByteData(), [255, 0, 0, 255, 0, 255, 0, 255]),
        'Actual PNG pixels',
      );
    } finally {
      frame.image.dispose();
    }
  } finally {
    codec?.dispose();
    codec = undefined;
    descriptor?.dispose();
    descriptor = undefined;
  }
  notify('png');
  const scaled = await ImmutableBuffer.fromUint8List(png);
  codec = await instantiateImageCodecFromBuffer(scaled, {
    targetWidth: 8,
    targetHeight: 8,
    allowUpscaling: false,
  });
  try {
    check(scaled.debugDisposed, 'Convenience factory takes caller buffer ownership');
    const frame = await codec.getNextFrame();
    try {
      check(frame.image.width === 2 && frame.image.height === 1, 'No upscaling');
    } finally {
      frame.image.dispose();
    }
  } finally {
    codec.dispose();
    codec = undefined;
  }
  const broken = await ImmutableBuffer.fromUint8List(new Uint8Array([1, 2, 3]));
  await rejects(() => instantiateImageCodecFromBuffer(broken), 'invalid/unsupported');
  check(broken.debugDisposed, 'Failed encoded creation relinquishes caller bytes');
  const throwing = await ImmutableBuffer.fromUint8List(png);
  await rejects(
    () =>
      instantiateImageCodecWithSize(throwing, {
        getTargetSize: () => {
          throw Error('target callback');
        },
      }),
    'target callback',
  );
  check(throwing.debugDisposed, 'Target callback failure relinquishes caller bytes');
  const options = {
    get targetWidth() {
      throw Error('option getter');
    },
  };
  await rejects(() => instantiateImageCodec(png, options), 'option getter');
  const invalidOptions = await ImmutableBuffer.fromUint8List(png);
  await rejects(() => instantiateImageCodecFromBuffer(invalidOptions, options), 'option getter');
  check(invalidOptions.debugDisposed, 'Invalid target options relinquish transferred caller bytes');
  const invalidSize = await ImmutableBuffer.fromUint8List(png);
  await rejects(
    () =>
      instantiateImageCodecWithSize(invalidSize, {
        get getTargetSize() {
          throw Error('size getter');
        },
      }),
    'size getter',
  );
  check(invalidSize.debugDisposed, 'Invalid size options relinquish transferred caller bytes');
  notify('failed-target');
  const animated = await ImmutableBuffer.fromUint8List(gif);
  codec = await instantiateImageCodecFromBuffer(animated);
  try {
    check(
      codec.frameCount === 2 && codec.repetitionCount === 1,
      'Actual animated frame/repetition metadata',
    );
    for (let index = 0; index < 4; ++index) {
      const frame = await codec.getNextFrame();
      try {
        check(frame.duration === (index % 2 ? 120 : 50), 'Animated duration/order/wrap');
        const expected =
          index % 2 ? [0, 128, 0, 255, 0, 128, 0, 255] : [255, 0, 0, 255, 255, 0, 0, 255];
        check(equal(await frame.image.toByteData(), expected), 'Actual animated pixels/order/wrap');
      } finally {
        frame.image.dispose();
      }
    }
  } finally {
    codec.dispose();
    codec = undefined;
  }
  notify('animation');
  // BGRA swaps channels while premultiplied alpha remains premultiplied.
  const bgra = await ImmutableBuffer.fromUint8List(new Uint8Array([0, 0, 128, 128]));
  descriptor = ImageDescriptor.raw(bgra, { width: 1, height: 1, pixelFormat: 'bgra8888' });
  bgra.dispose();
  try {
    codec = await descriptor.instantiateCodec();
    descriptor.dispose();
    descriptor = undefined;
    const frame = await codec.getNextFrame();
    try {
      check(equal(await frame.image.toByteData(), [128, 0, 0, 128]), 'BGRA premultiplied alpha');
    } finally {
      frame.image.dispose();
    }
  } finally {
    descriptor?.dispose();
    codec?.dispose();
  }
  notify('complete');
  return { functional: true, animatedFrames: 4, pixelBytes: 16 + 8 + 4 * 8 + 4 };
}
export async function appImagesProbe(backend, png, gif) {
  const assets = new EngineV2Assets(
      async () => backend,
      async (_backend, key) => {
        if (key !== 'image.png') throw Error('Unexpected IO');
        return { size: png.length, read: async () => png.slice(), close() {} };
      },
    ),
    buffers = new EngineV2Buffers(
      () => backend,
      async () => backend,
      assets,
    ),
    images = new EngineV2Images(buffers, assets),
    bufferBinding = bindImmutableBufferLoader(buffers),
    imageBinding = bindImageDescriptorLoader(images);
  try {
    const result = await imageDescriptorProbe(
      png,
      gif,
      (phase) => {
        globalThis.__imageStage = phase;
      },
      'image.png',
    );
    // HostedCodec retires after its queued frame jobs have settled.
    await Promise.resolve();
    await Promise.resolve();
    const execution = images.execution,
      state = backend.images.snapshot();
    check(
      state.descriptorCreates === execution.descriptorCreates,
      'SDK/backend descriptor work agrees',
    );
    check(state.codecCreates === execution.codecCreates, 'SDK/backend codec work agrees');
    check(
      state.frameDecodes === execution.frameDecodes && state.frameDecodes === 10,
      'SDK/backend actual frame work agrees',
    );
    check(
      state.pixelReads === execution.pixelReads &&
        state.pixelReadBytes === execution.pixelReadBytes,
      'SDK/backend pixel work agrees',
    );
    check(
      !state.descriptors && !state.codecs && !state.frames,
      'All independent image holders retired',
    );
    check(
      state.reservedBytes === state.readbackBytes && state.readbackBytes > 0,
      'Only delivered pixel buffers retain credit',
    );
    check(buffers.execution.creditBytes === 0, 'All immutable source backing retired');
    const controls = await imageLifetimeControls(backend);
    const captureControls = await imageCaptureControls(images, backend);
    await images.close();
    await assets.close();
    await buffers.close();
    backend.close();
    return { ...result, execution, controls, captureControls, closed: backend.snapshot() };
  } finally {
    imageBinding.dispose();
    bufferBinding.dispose();
    await images.close();
    await assets.close();
    await buffers.close();
  }
}
async function imageCaptureControls(owner, backend) {
  const buffer = await ImmutableBuffer.fromUint8List(new Uint8Array([255, 0, 0, 255])),
    descriptor = ImageDescriptor.raw(buffer, { width: 1, height: 1, pixelFormat: 'rgba8888' });
  buffer.dispose();
  const codec = await descriptor.instantiateCodec();
  descriptor.dispose();
  const image = (await codec.getNextFrame()).image,
    clone = image.clone();
  codec.dispose();
  await Promise.resolve();
  await Promise.resolve();
  const before = backend.images.snapshot(),
    original = backend.images.frameChunk;
  let a, b, wrong, foreign;
  const other = new ResourceRegistry();
  try {
    backend.images.frameChunk = () => {
      throw Error('Injected Scene pixel read failure');
    };
    await rejects(() => owner.capture(image), 'Injected Scene pixel read failure');
    backend.images.frameChunk = original;
    check(
      backend.images.snapshot().sceneBuffers === before.sceneBuffers &&
        backend.images.snapshot().sceneCreditBytes === before.sceneCreditBytes &&
        backend.images.snapshot().reservedBytes <= before.reservedBytes &&
        owner.execution.sceneSnapshots === 0,
      'A failed pixel capture returns Scene credit and the registry read lease',
    );
    a = owner.capture(image);
    b = owner.capture(clone);
    check(
      a.resource === b.resource &&
        owner.execution.sceneSnapshots === 1 &&
        owner.execution.sceneLeases === 2,
      'Frame clones share one immutable admitted Scene snapshot',
    );
    const id = image.resource;
    wrong = Image.fromResource(owner.resources, id, 2, 1);
    await rejects(() => owner.capture(wrong), 'dimensions');
    other.register({ ...id, kind: 'image' }, () => {});
    foreign = Image.fromResource(other, { id: id.id, generation: id.generation }, 1, 1);
    await rejects(() => owner.capture(foreign), 'foreign');
    wrong.dispose();
    wrong = undefined;
    foreign.dispose();
    foreign = undefined;
    other.dispose();
    image.dispose();
    await rejects(() => owner.capture(image), 'disposed');
    clone.dispose();
    await Promise.resolve();
    await Promise.resolve();
    check(
      backend.images.snapshot().frames === 0,
      'Source frame owners may retire before a retained Scene snapshot',
    );
    check(
      equal(readRasterImage(a.resource.bytes).pixels, [255, 0, 0, 255]),
      'Retired Source handles do not change Scene pixels',
    );
    a.release();
    a = undefined;
    check(backend.images.snapshot().sceneBuffers === 1, 'A second Scene holder retains its credit');
    b.release();
    b = undefined;
    check(
      backend.images.snapshot().sceneBuffers === 0 &&
        backend.images.snapshot().reservedBytes === before.readbackBytes,
      'Last Scene holder returns exactly its independent credit',
    );
    return {
      failedCaptureReleased: true,
      cloneSharedSnapshot: true,
      foreignAndDimensionsRefused: true,
      sourceFramesRetiredBeforeScene: true,
      sceneCreditDrained: true,
    };
  } finally {
    backend.images.frameChunk = original;
    a?.release();
    b?.release();
    wrong?.dispose();
    foreign?.dispose();
    if (!image.debugDisposed) image.dispose();
    if (!clone.debugDisposed) clone.dispose();
    other.dispose();
  }
}
async function imageLifetimeControls(backend) {
  const images = backend.images,
    before = images.snapshot();
  const source = backend.createBuffer(new Uint8Array([255, 0, 0, 255]));
  const descriptor = images.createDescriptor(source.handle, {
    width: 1,
    height: 1,
    rowBytes: 4,
    pixelFormat: 'rgba8888',
  });
  backend.releaseBuffer(source.handle);
  await rejects(() => Promise.resolve(images.instantiateCodec(source.handle, 1, 1)), 'foreign');
  await rejects(() => Promise.resolve(backend.bufferChunk(descriptor.handle, 0, 1)), 'foreign');
  await rejects(
    () => Promise.resolve(images.instantiateCodec(descriptor.handle, 8192, 8192)),
    'pixel',
  );
  await rejects(
    () => Promise.resolve(images.instantiateCodec(descriptor.handle, 4096, 4096)),
    'memory',
  );
  const codec = images.instantiateCodec(descriptor.handle, 1, 1);
  images.releaseDescriptor(descriptor.handle);
  const frame = images.nextFrame(codec.handle);
  images.releaseCodec(codec.handle);
  const native = typeof globalThis.NelyxV2Native !== 'undefined',
    constructor = native ? 'ArrayBuffer' : 'Uint8Array',
    original = globalThis[constructor];
  let reentered = false;
  try {
    globalThis[constructor] = class extends original {
      constructor(...args) {
        if (!reentered && args[0] === 4) {
          reentered = true;
          images.releaseFrame(frame.handle);
          check(
            images.snapshot().frames === 0 &&
              images.snapshot().reservedBytes > before.reservedBytes,
            'Borrowed read holds retired frame storage',
          );
          let refused = false;
          try {
            backend.close();
          } catch {
            refused = true;
          }
          check(refused, 'Owner close refuses a borrowed image read');
          refused = false;
          try {
            images.reserveReadback(32 * 1024 * 1024);
          } catch {
            refused = true;
          }
          check(refused, 'Borrowed image storage cannot be replaced by over-budget caller bytes');
        }
        super(...args);
      }
    };
    check(
      equal(images.frameChunk(frame.handle, 0, 4), [255, 0, 0, 255]) && reentered,
      'Borrowed pixels survive constructor reentry',
    );
  } finally {
    globalThis[constructor] = original;
    if (!reentered) images.releaseFrame(frame.handle);
  }
  check(
    images.snapshot().reservedBytes === before.reservedBytes,
    'Borrowed frame retires only after read returns',
  );
  await rejects(() => Promise.resolve(images.nextFrame(codec.handle)), 'foreign');
  await rejects(() => Promise.resolve(images.finishReadback(descriptor.handle, false)), 'foreign');
  const credit = images.reserveReadback(4);
  await rejects(() => Promise.resolve(backend.releaseBuffer(credit)), 'foreign');
  images.finishReadback(credit, false);
  check(
    images.snapshot().reservedBytes === before.reservedBytes,
    'Failed/cancelled readback credit retired',
  );
  check(images.snapshot().version === 2, 'Scene credit service version');
  const temporaryReadbacks = [],
    temporarySize = (native ? 10 : 9) * 1024 * 1024;
  let scene;
  try {
    temporaryReadbacks.push(images.reserveReadback(temporarySize));
    temporaryReadbacks.push(images.reserveReadback(temporarySize));
    await rejects(() => Promise.resolve(images.reserveReadback(10 * 1024 * 1024)), 'memory');
    const beforeScene = images.snapshot();
    const size = 1024 * 1024;
    scene = images.reserveScene(size);
    const held = images.snapshot();
    check(
      held.sceneBuffers === 1 &&
        held.sceneDataBytes === size &&
        held.sceneCreditBytes === 3 * size + 2 * 262144 + 65536 &&
        (!native || held.reservedBytes > 64 * 1024 * 1024),
      'Independent admitted Scene pixel snapshots',
    );
    check(
      held.readbackBytes === beforeScene.readbackBytes,
      'Scene pixels do not spend delivered caller readback credit',
    );
    await rejects(() => Promise.resolve(backend.close()), 'image');
    await rejects(() => Promise.resolve(images.releaseFrame(scene)), 'foreign');
  } finally {
    if (scene !== undefined) images.releaseScene(scene);
    for (const token of temporaryReadbacks) images.finishReadback(token, false);
  }
  check(
    images.snapshot().reservedBytes === before.reservedBytes,
    'Scene credit retires at its last host reference',
  );
  return {
    borrowedFrameRetired: true,
    wrongKindRefused: true,
    oversizedDecodeRefused: true,
    sceneCreditIndependent: true,
  };
}
