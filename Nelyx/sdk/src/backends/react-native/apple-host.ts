import { finishOwnedDisposal } from '../../runtime/owned-disposal.ts';
// SPDX-License-Identifier: BSD-3-Clause
export interface AppleNativeHostStatus {
  readonly abi: 3;
  readonly platform: 'ios' | 'macos';
  readonly runtimeGeneration: number;
  readonly phase: 'active' | 'closing' | 'closed' | 'failed';
  readonly stage: string;
  readonly shutdownProtocol: 3;
  readonly hostHookGeneration: number;
  readonly nativeReactNativeVersion: string;
  readonly pendingViewTasks: number;
  readonly sealedViewTasks: boolean;
  readonly failedViewTasks: boolean;
  readonly hostTeardownRequested: boolean;
  readonly gpuPrepared: boolean;
  readonly gpuCreatedOnJs: boolean;
  readonly gpuDrained: boolean;
  readonly gpuBackend: 'metal';
  readonly gpuImplementation: 'dawn';
  readonly softwareAllowed: false;
}
const currentApi = (): unknown =>
  (globalThis as unknown as { NelyxAppleHost?: unknown }).NelyxAppleHost;
const currentHook = (): unknown => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'NelyxAppleRuntimeHost');
  return descriptor && !descriptor.writable && !descriptor.configurable && 'value' in descriptor
    ? descriptor.value
    : undefined;
};
export function readAppleRuntimeHostHook(
  target: 'ios' | 'macos',
  nativeVersion: string,
  marker: unknown = currentHook(),
  allowClosing = false,
) {
  const value = marker as
    | {
        abi: number;
        shutdownProtocol: number;
        platform: string;
        nativeReactNativeVersion: string;
        generation: number;
        isTeardownRequested(): unknown;
      }
    | undefined;
  if (
    !value ||
    typeof value !== 'object' ||
    !Object.isFrozen(value) ||
    value.abi !== 1 ||
    value.shutdownProtocol !== 3 ||
    value.platform !== target ||
    value.nativeReactNativeVersion !== nativeVersion ||
    !Number.isSafeInteger(value.generation) ||
    value.generation < 1
  )
    throw new Error(
      'Apple native host protocol3/cohort marker unavailable; npm ci, prepare and rebuild the native runner',
    );
  if (typeof value.isTeardownRequested !== 'function')
    throw new Error('Apple native teardown probe unavailable');
  const teardownRequested = value.isTeardownRequested();
  if (typeof teardownRequested !== 'boolean' || (teardownRequested && !allowClosing))
    throw new Error('Apple native host teardown admission closed');
  return Object.freeze({
    abi: 1 as const,
    shutdownProtocol: 3 as const,
    platform: target,
    nativeReactNativeVersion: nativeVersion,
    generation: value.generation,
    teardownRequested,
  });
}
export function readAppleNativeHostStatus(api: unknown = currentApi()): AppleNativeHostStatus {
  if (
    !api ||
    typeof api !== 'object' ||
    typeof (api as { getStatus?: unknown }).getStatus !== 'function'
  )
    throw new Error('Owned Apple shutdown API unavailable');
  const value = (api as { getStatus(): unknown }).getStatus() as AppleNativeHostStatus;
  if (
    !value ||
    value.abi !== 3 ||
    value.shutdownProtocol !== 3 ||
    !['ios', 'macos'].includes(value.platform) ||
    ![value.runtimeGeneration, value.hostHookGeneration].every(
      (n) => Number.isSafeInteger(n) && n > 0,
    ) ||
    !['active', 'closing', 'closed', 'failed'].includes(value.phase) ||
    !['active', 'sdk', 'ui', 'native', 'closed', 'failed'].includes(value.stage) ||
    value.phase !==
      (value.stage === 'sdk' || value.stage === 'ui' || value.stage === 'native'
        ? 'closing'
        : value.stage) ||
    typeof value.nativeReactNativeVersion !== 'string' ||
    !Number.isSafeInteger(value.pendingViewTasks) ||
    value.pendingViewTasks < 0 ||
    value.pendingViewTasks > 128 ||
    ![
      value.sealedViewTasks,
      value.failedViewTasks,
      value.gpuPrepared,
      value.gpuCreatedOnJs,
      value.gpuDrained,
      value.hostTeardownRequested,
    ].every((n) => typeof n === 'boolean') ||
    value.gpuBackend !== 'metal' ||
    value.gpuImplementation !== 'dawn' ||
    value.softwareAllowed !== false
  )
    throw new Error('Invalid Apple native host status; owned protocol3 required');
  return Object.freeze({ ...value });
}
/** Captures one native runtime. Every effect releases its owner only after its
 * AppSession, renderer, input services and pooled assets have drained. */
export function bindAppleNativeHost(
  target: 'ios' | 'macos',
  readApi: () => unknown = currentApi,
  readHook: () => unknown = currentHook,
  nativeVersion = target === 'ios' ? '0.83.10' : '0.83.0',
) {
  const api = readApi(),
    initial = readAppleNativeHostStatus(api);
  const marker = readHook(),
    hook = readAppleRuntimeHostHook(target, nativeVersion, marker);
  const native = api as {
    getStatus: unknown;
    prepareCompositionGpu: () => void;
    registerShutdownHandler: (handler: (complete: (error?: string) => void) => void) => void;
    requestShutdown: (complete: (error?: string) => void) => void;
  };
  const getter = native.getStatus,
    prepare = native.prepareCompositionGpu,
    register = native.registerShutdownHandler,
    request = native.requestShutdown;
  if (
    initial.platform !== target ||
    initial.phase !== 'active' ||
    initial.hostHookGeneration !== hook.generation ||
    initial.nativeReactNativeVersion !== nativeVersion ||
    typeof prepare !== 'function' ||
    typeof register !== 'function' ||
    typeof request !== 'function'
  )
    throw new Error('Active Apple runtime shutdown protocol required');
  const owners = new Set<() => Promise<void>>();
  let closing = false,
    shutdown: Promise<void> | undefined;
  const verify = (phase: 'active' | 'closing' | 'closed') => {
    if (
      readApi() !== api ||
      native.getStatus !== getter ||
      native.prepareCompositionGpu !== prepare ||
      native.registerShutdownHandler !== register ||
      native.requestShutdown !== request ||
      readHook() !== marker
    )
      throw new Error('Apple native shutdown API changed');
    const status = readAppleNativeHostStatus(api);
    readAppleRuntimeHostHook(target, nativeVersion, marker, phase !== 'active');
    if (
      status.platform !== target ||
      status.runtimeGeneration !== initial.runtimeGeneration ||
      status.phase !== phase ||
      status.hostHookGeneration !== hook.generation ||
      status.nativeReactNativeVersion !== nativeVersion
    )
      throw new Error('Apple native shutdown generation/phase changed');
    if (
      !status.gpuPrepared ||
      !status.gpuCreatedOnJs ||
      status.failedViewTasks ||
      (phase === 'active' &&
        (status.sealedViewTasks || status.gpuDrained || status.hostTeardownRequested)) ||
      (phase === 'closed' &&
        (!status.gpuDrained || !status.sealedViewTasks || status.pendingViewTasks))
    )
      throw new Error('Apple native Metal owner/view drain failed admission');
    return status;
  };
  if (initial.failedViewTasks || initial.sealedViewTasks || initial.gpuDrained)
    throw new Error('Apple native owner admission already closed');
  prepare.call(api);
  verify('active');
  register.call(api, (complete) => {
    if (closing) throw new Error('Apple SDK shutdown requested twice');
    closing = true;
    try {
      verify('closing');
    } catch (error) {
      complete(String(error));
      return;
    }
    const tasks = [...owners].map((close) => finishOwnedDisposal(close));
    void Promise.allSettled(tasks).then((results) => {
      let failure: string | undefined;
      try {
        verify('closing');
        if (results.some((result) => result.status === 'rejected') || owners.size)
          throw new Error('Apple SDK owner drain failed; dependencies retained');
      } catch (error) {
        failure = String(error);
      }
      complete(failure);
    });
  });
  return Object.freeze({
    verify: () => verify('active'),
    retainOwner(close: () => Promise<void>) {
      verify('active');
      if (closing || owners.has(close) || owners.size >= 64)
        throw new Error('Apple SDK owner admission closed, duplicate or budget exceeded');
      owners.add(close);
      let released = false;
      return {
        release() {
          if (!released) {
            released = true;
            owners.delete(close);
          }
        },
      };
    },
    shutdown() {
      return (shutdown ??= new Promise<void>((resolve, reject) => {
        try {
          verify('active');
          request.call(api, (error) => {
            if (error) {
              reject(new Error(error));
              return;
            }
            try {
              verify('closed');
              resolve();
            } catch (failure) {
              reject(failure);
            }
          });
        } catch (error) {
          reject(error);
        }
      }));
    },
  });
}
