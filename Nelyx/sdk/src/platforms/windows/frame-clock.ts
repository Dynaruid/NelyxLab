// SPDX-License-Identifier: BSD-3-Clause
import type { SurfaceFrameScheduler } from '../../runtime/frame-clock.ts';
import type { FrameTiming } from '@nelyx/core/foundation/clock';
export interface WindowsFrameReceipt {
  readonly nativeTick: number;
  readonly nativeDispatch: number;
  readonly nativeFrameStart?: number;
  readonly nativeFrameTarget?: number;
  readonly refreshInterval?: number;
  readonly nativeUncertainty?: number;
  readonly timingRevision?: number;
  readonly timingSource?: 'dwm-predicted' | 'timer-fallback';
}
interface WindowsFrameApi {
  readonly frameClockVersion: 2;
  requestFrame(callback: (failure?: string, timing?: WindowsFrameReceipt) => void): number;
  getMonotonicTime?(): number;
  cancelFrame(id: number): void;
}
const currentApi = (): unknown => (globalThis as { NelyxWindowsHost?: unknown }).NelyxWindowsHost;
const domains = new WeakMap<
  WindowsFrameApi,
  { offset: number; uncertainty: number; sampledAt: number; revision: number | undefined }
>();
function domain(api: WindowsFrameApi, revision?: number) {
  let value = domains.get(api);
  if (
    value &&
    performance.now() - value.sampledAt < 1000 &&
    (revision === undefined || value.revision === revision)
  )
    return value;
  if (typeof api.getMonotonicTime !== 'function')
    throw new Error('Windows native monotonic clock requires matching rebuilt inputs');
  const before = performance.now(),
    native = api.getMonotonicTime(),
    after = performance.now();
  if (!Number.isFinite(native)) throw new Error('Invalid Windows native clock sample');
  value = {
    offset: (before + after) / 2 - native,
    uncertainty: (after - before) / 2,
    sampledAt: after,
    revision: revision ?? value?.revision,
  };
  domains.set(api, value);
  return value;
}
/** Recalibrate periodically and when native cadence changes. QPC is not the JS epoch. */
export function windowsMonotonicTimestamp(
  value: number,
  readApi: () => unknown = currentApi,
): number {
  if (!Number.isFinite(value)) throw new Error('Invalid Windows native timestamp');
  return value + domain(readApi() as WindowsFrameApi).offset;
}
/** Shared by RNW and the direct host. Missing predictions keep required work alive. */
export function captureWindowsFrameTiming(
  timing: WindowsFrameReceipt,
  clock: { readonly offset: number; readonly uncertainty: number } = { offset: 0, uncertainty: 0 },
): FrameTiming {
  if (
    !Number.isFinite(timing.nativeTick) ||
    !Number.isFinite(timing.nativeDispatch) ||
    timing.nativeDispatch < timing.nativeTick
  )
    throw new Error('Invalid Windows frame clock receipt');
  const base = {
    tick: timing.nativeTick + clock.offset,
    dispatch: timing.nativeDispatch + clock.offset,
    queueDelay: timing.nativeDispatch - timing.nativeTick,
    clockUncertainty: clock.uncertainty,
  };
  if (
    timing.nativeFrameTarget === undefined &&
    timing.nativeFrameStart === undefined &&
    timing.refreshInterval === undefined &&
    timing.nativeUncertainty === undefined &&
    timing.timingSource === undefined &&
    timing.timingRevision === undefined
  )
    return Object.freeze(base);
  const {
    nativeFrameStart: start,
    nativeFrameTarget: target,
    refreshInterval: interval,
    nativeUncertainty: uncertainty,
    timingRevision: revision,
    timingSource: source,
  } = timing;
  if (
    !Number.isFinite(start) ||
    !Number.isFinite(target) ||
    !Number.isFinite(interval) ||
    interval! <= 0 ||
    interval! > 1000 ||
    Math.abs(target! - start! - interval!) > 0.001 ||
    !Number.isFinite(uncertainty) ||
    uncertainty! < 0 ||
    !Number.isSafeInteger(revision) ||
    revision! < 1 ||
    (source !== 'dwm-predicted' && source !== 'timer-fallback')
  )
    throw new Error('Invalid Windows frame clock prediction');
  const clockUncertainty = clock.uncertainty + uncertainty!;
  return Object.freeze({
    ...base,
    frameStart: start! + clock.offset,
    frameTarget: target! + clock.offset,
    refreshInterval: interval!,
    timingSource: source,
    timingRevision: revision!,
    clockUncertainty,
    ...(source === 'dwm-predicted' &&
    clockUncertainty <= interval! / 4 &&
    timing.nativeDispatch + clockUncertainty < target!
      ? { observedDeadline: target! + clock.offset }
      : {}),
  });
}
/** RNW's UI-post RAF is unpaced. Each surface uses the owned compositor clock. */
export function createWindowsFrameScheduler(
  readApi: () => unknown = currentApi,
): SurfaceFrameScheduler {
  const api = readApi() as WindowsFrameApi;
  if (
    !api ||
    api.frameClockVersion !== 2 ||
    typeof api.requestFrame !== 'function' ||
    typeof api.cancelFrame !== 'function'
  )
    throw new Error('Windows compositor frame clock2 requires matching rebuilt native inputs');
  const request = api.requestFrame,
    cancel = api.cancelFrame;
  const verify = () => {
    if (
      readApi() !== api ||
      api.requestFrame !== request ||
      api.cancelFrame !== cancel ||
      api.frameClockVersion !== 2
    )
      throw new Error('Windows compositor frame owner changed; runtime restart required');
  };
  return {
    request(callback, onError) {
      verify();
      return request.call(api, (failure, timing) => {
        if (failure !== undefined) {
          const error = new Error(failure);
          if (onError) onError(error);
          else throw error;
          return;
        }
        if (!timing) {
          callback();
          return;
        }
        try {
          callback(captureWindowsFrameTiming(timing, domain(api, timing.timingRevision)));
        } catch (error) {
          if (onError) onError(error);
          else throw error;
        }
      });
    },
    cancel(id) {
      verify();
      cancel.call(api, id);
    },
  };
}
