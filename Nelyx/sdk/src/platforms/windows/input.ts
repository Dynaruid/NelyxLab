// SPDX-License-Identifier: BSD-3-Clause
import type { ViewRuntime } from '@nelyx/core/hosting/runtime';
import type { NativeInteraction } from '../../runtime/native-interaction.ts';
import type {
  ReactNativeSurfaceInputLease,
  ReactNativeViewMetrics,
} from '../../backends/react-native/surface.tsx';
import { WindowsInputView } from './input-view.ts';
import type { WindowsInputModule, WindowsInputEvents } from './input-service.ts';

export function requireWindowsInputModule(value: unknown): WindowsInputModule {
  if (!value || typeof value !== 'object')
    throw new Error('Windows nonvisual input module is required');
  const candidate = value as Partial<WindowsInputModule>;
  for (const name of [
    'getInputProtocol',
    'connect',
    'openClient',
    'configureClient',
    'command',
    'insertText',
    'closeClient',
    'disconnect',
  ] as const)
    if (typeof candidate[name] !== 'function')
      throw new Error('Windows nonvisual input module lacks ' + name);
  return candidate as WindowsInputModule;
}
/** One input lease uses the actual Fabric tag, never Skia's content id. */
export function openWindowsInput(
  interaction: NativeInteraction,
  view: ViewRuntime,
  metrics: ReactNativeViewMetrics,
  module: unknown,
  events: WindowsInputEvents,
  onError: (error: unknown) => void,
): ReactNativeSurfaceInputLease {
  const tag = metrics.nativeReactTag,
    generation = metrics.nativeViewGeneration;
  if (
    typeof tag !== 'number' ||
    !Number.isSafeInteger(tag) ||
    tag <= 0 ||
    typeof generation !== 'number' ||
    !Number.isSafeInteger(generation) ||
    generation <= 0
  )
    throw new Error('Windows input requires its admitted native tag and generation');
  if (
    interaction.owner.id !== view.owner.id ||
    interaction.owner.generation !== view.owner.generation
  )
    throw new Error('Windows input requires the exact Core View owner');
  const input = new WindowsInputView(
    interaction,
    requireWindowsInputModule(module),
    events,
    tag,
    onError,
  );
  try {
    input.bindKeyboard(view, () => generation);
  } catch (error) {
    // Return the failed lease so the surface still owns pending native cleanup
    // and can retry retirement before releasing its Core/GPU dependencies.
    void input.dispose().catch(() => {});
    return { ready: Promise.reject(error), dispose: () => input.dispose() };
  }
  return input;
}
