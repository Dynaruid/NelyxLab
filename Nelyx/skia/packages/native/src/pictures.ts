// SPDX-License-Identifier: BSD-3-Clause
import { NativeRetirementError } from '@nelyx/core/hosting/rasterization';
import type { FramePictureBackend } from '@nelyx/core/hosting/pictures';
import type { PictureCapture } from '@nelyx/core/ui/picture';
import { resourceKey } from '@nelyx/core/ui/frame';
import type { Skia } from './skia/types/Skia.ts';
import type { SkPicture } from './skia/types/Drawing.ts';
import { replayFrame } from './renderer.ts';
import { submitNativeScene } from './scene.ts';
import type { DisplayListTarget } from './display-list.ts';
import type { GraphiteResources } from './renderer.ts';

export function createFramePictureBackend(
  api: Skia,
  resources: GraphiteResources,
  generation: () => number,
): FramePictureBackend & { picture(key: string): SkPicture } {
  const entries = new Map<
    string,
    {
      capture: PictureCapture;
      native: SkPicture | null;
      generation: number;
      bytes: number;
      failure?: NativeRetirementError;
    }
  >();
  let unconfirmed: NativeRetirementError | undefined;
  const ensure = () => {
    if (unconfirmed) throw unconfirmed;
  };
  const fail = (errors: readonly unknown[], owners: readonly unknown[]): never => {
    unconfirmed = new NativeRetirementError(errors, owners);
    throw unconfirmed;
  };
  const retireNative = (entry: { native: SkPicture | null; failure?: NativeRetirementError }) => {
    if (entry.failure) throw entry.failure;
    try {
      entry.native?.dispose();
      entry.native = null;
    } catch (error) {
      entry.failure = new NativeRetirementError([error], [entry.native]);
      unconfirmed = entry.failure;
      throw entry.failure;
    }
  };
  const compile = (capture: PictureCapture): SkPicture => {
    ensure();
    const errors: unknown[] = [],
      unknownOwners: unknown[] = [];
    let picture: SkPicture | undefined,
      recorder: ReturnType<Skia['PictureRecorder']> | undefined,
      bounds: ReturnType<Skia['XYWHRect']> | undefined;
    try {
      recorder = api.PictureRecorder();
      bounds = api.XYWHRect(0, 0, 0, 0);
      const limit = 3.4028234663852886e38;
      bounds.setLTRB(-limit, -limit, limit, limit);
      const canvas = recorder.beginRecording(bounds);
      if (resources.nativeDisplayLists) {
        if (typeof recorder.nelyxReplayDisplayList !== 'function')
          throw new Error(
            'Native picture display-list1 binding required; rebuild the native supplier',
          );
        submitNativeScene(api, recorder as DisplayListTarget, capture.frame, resources);
      } else replayFrame(api, canvas, capture.frame, resources);
      picture = recorder.finishRecordingAsPicture();
    } catch (error) {
      errors.push(error);
    } finally {
      for (const value of [bounds, recorder])
        try {
          value?.dispose();
        } catch (error) {
          unknownOwners.push(value);
          errors.push(error);
        }
    }
    if (errors.length) {
      try {
        picture?.dispose();
      } catch (error) {
        unknownOwners.push(picture);
        errors.push(error);
      }
      if (unknownOwners.length) fail(errors, unknownOwners);
      throw new AggregateError(errors, 'Native frame picture compile failed');
    }
    return picture!;
  };
  const lookup = (key: string): SkPicture => {
    ensure();
    const entry = entries.get(key);
    if (!entry) throw new Error('Native frame picture retired');
    const current = generation();
    if (entry.generation !== current) {
      retireNative(entry);
      entry.generation = current;
    }
    if (!entry.native) {
      const picture = compile(entry.capture);
      try {
        if (picture.approximateBytesUsed() > entry.bytes)
          throw new Error('Restored native picture exceeded admitted memory budget');
      } catch (error) {
        try {
          picture.dispose();
        } catch (cleanup) {
          fail([error, cleanup], [picture]);
        }
        throw error;
      }
      entry.native = picture;
    }
    return entry.native;
  };
  return {
    picture: lookup,
    compile(capture, descriptor) {
      ensure();
      const key = resourceKey(descriptor);
      if (entries.has(key)) throw new Error('Duplicate native frame picture');
      const native = compile(capture);
      let bytes: number, current: number;
      try {
        bytes = native.approximateBytesUsed();
        current = generation();
      } catch (error) {
        try {
          native.dispose();
        } catch (cleanup) {
          fail([error, cleanup], [native]);
        }
        throw error;
      }
      const entry = { capture, native: native as SkPicture | null, generation: current, bytes };
      entries.set(key, entry);
      let retired = false;
      return {
        bytes,
        retire() {
          if (retired) return;
          retireNative(entry);
          entries.delete(key);
          retired = true;
        },
      };
    },
  };
}
