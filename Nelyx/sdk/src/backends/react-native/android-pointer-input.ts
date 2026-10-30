// SPDX-License-Identifier: BSD-3-Clause
import type { ViewRuntime } from '@nelyx/core/hosting/runtime';
import type { PointerEvent } from '@nelyx/core/ui/input';
import type { AndroidPointerEvent } from '@nelyx/skia-rn/views/types';

/** Admission is atomic; callbacks cannot transfer the remaining samples to another View. */
export function androidPointerInput(
  readView: () => ViewRuntime | undefined,
  readNativeId: () => number | undefined,
  requestKeyboardFocus?: () => void,
) {
  return (event: { readonly nativeEvent: AndroidPointerEvent }): void => {
    const view = readView(),
      batch = event.nativeEvent;
    if (!view || batch.nativeId !== readNativeId()) return;
    if (batch.protocol !== 1 || !Array.isArray(batch.samples) || batch.samples.length === 0)
      throw new Error('Invalid Android pointer batch');
    let previous = -Infinity;
    for (const sample of batch.samples) {
      if (
        !['down', 'move', 'up', 'cancel'].includes(sample.kind) ||
        !['mouse', 'touch', 'pen', 'unknown'].includes(sample.device) ||
        !Number.isSafeInteger(sample.pointer) ||
        sample.pointer < 0 ||
        !Number.isSafeInteger(sample.buttons) ||
        sample.buttons < 0 ||
        sample.buttons > 31 ||
        ![sample.x, sample.y, sample.timestamp].every(Number.isFinite) ||
        sample.timestamp < 0 ||
        sample.timestamp < previous ||
        ((sample.kind === 'up' || sample.kind === 'cancel') && sample.buttons !== 0)
      )
        throw new Error('Invalid Android pointer sample');
      previous = sample.timestamp;
    }
    const viewportGeneration = view.currentMetrics.viewportGeneration;
    for (const sample of batch.samples) {
      if (
        readView() !== view ||
        readNativeId() !== batch.nativeId ||
        view.currentMetrics.viewportGeneration !== viewportGeneration
      )
        return;
      if (sample.kind === 'down') requestKeyboardFocus?.();
      if (
        readView() !== view ||
        readNativeId() !== batch.nativeId ||
        view.currentMetrics.viewportGeneration !== viewportGeneration
      )
        return;
      view.dispatchPointer({
        ...sample,
        kind: sample.kind as PointerEvent['kind'],
        device: sample.device as PointerEvent['device'],
        viewportGeneration,
      });
    }
  };
}
