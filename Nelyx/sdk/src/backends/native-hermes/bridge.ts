// SPDX-License-Identifier: BSD-3-Clause
import type { ViewMetrics } from '@nelyx/core/ui/types';
import type { OsEnvironment } from '../../runtime/os-services.ts';
import type { WindowsFrameReceipt } from '../../platforms/windows/frame-clock.ts';
export interface NativeHermesBridge {
  readonly abi: 2;
  readonly frameClockVersion: 2;
  readonly capabilities: {
    readonly vm: 1;
    readonly services: 1;
    readonly editing: 1;
    readonly semantics: 1;
  };
  readonly mode: 'bytecode' | 'static-aot';
  readonly assetRoot: string;
  readonly diagnostics?: boolean;
  now(): number;
  metrics(): Omit<ViewMetrics, 'nativeContextGeneration'>;
  listen(callback: (kind: string, value: unknown) => boolean | void): void;
  publishSemantics(update: NativeSemanticsUpdate): void;
  editor(kind: string, packet: Readonly<Record<string, unknown>>): void;
  environment(): OsEnvironment;
  service(id: number, kind: string, value: string): void;
  requestClose(): void;
  pressedKeys(): readonly { readonly keyCode: number; readonly scanCode: number }[];
  setTimer(callback: () => void, delay: number, repeat: boolean): number;
  clearTimer(id: number): void;
  requestFrame(
    callback: (
      tick: number,
      dispatch: number,
      timing?: Omit<WindowsFrameReceipt, 'nativeTick' | 'nativeDispatch'>,
    ) => void,
  ): number;
  cancelFrame(id: number): void;
  queueMicrotask(callback: () => void): void;
  completeShutdown(): void;
  fail(message: string): void;
  log(message: string): void;
}
export interface NativeSemanticsUpdate {
  readonly protocol: 1;
  readonly owner: { readonly id: string; readonly generation: number };
  readonly commit: number;
  readonly viewport: number;
  readonly surface: number;
  readonly upserts: readonly unknown[];
  readonly removed: readonly string[];
  readonly order: readonly string[];
}
export function nativeHermesBridge(): NativeHermesBridge {
  const value = (globalThis as unknown as { NelyxNativeHost: NativeHermesBridge }).NelyxNativeHost;
  if (
    !value ||
    value.abi !== 2 ||
    value.frameClockVersion !== 2 ||
    !['bytecode', 'static-aot'].includes(value.mode) ||
    typeof value.assetRoot !== 'string' ||
    !value.assetRoot
  )
    throw new Error('Native Hermes host ABI 2 and frame clock2 are required');
  for (const capability of ['vm', 'services', 'editing', 'semantics'] as const)
    if (value.capabilities?.[capability] !== 1)
      throw new Error('Missing native Hermes capability: ' + capability);
  for (const method of [
    'now',
    'metrics',
    'listen',
    'publishSemantics',
    'editor',
    'environment',
    'service',
    'requestClose',
    'pressedKeys',
    'setTimer',
    'clearTimer',
    'requestFrame',
    'cancelFrame',
    'queueMicrotask',
    'completeShutdown',
    'fail',
    'log',
  ] as const)
    if (typeof value[method] !== 'function')
      throw new Error('Missing native Hermes host port: ' + method);
  return value;
}
