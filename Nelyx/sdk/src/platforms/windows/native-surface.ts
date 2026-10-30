// SPDX-License-Identifier: BSD-3-Clause
import type { NativeSyntheticEvent } from 'react-native';
import type { WindowsSurfaceStatus } from '@nelyx/skia-rn/views/types';
import type { ReactNativeSurfaceBinding } from '../../backends/react-native/surface.tsx';
/** Yoga layout alone cannot admit the Windows renderer. */
export function createWindowsNativeSurfaceProps(
  binding: ReactNativeSurfaceBinding,
  verifyHost: () => unknown,
  isClosing: () => boolean = () => false,
  windowViewport = false,
) {
  let failed = false,
    viewGeneration = 0,
    surfaceGeneration = 0,
    reactTag = 0,
    nativeId = 0;
  const reject = (reason: string) => {
    if (failed) return;
    failed = true;
    binding.failed(new Error(reason));
  };
  return {
    windowViewport,
    onWindowsSurfaceStatus(event: NativeSyntheticEvent<WindowsSurfaceStatus>) {
      if (failed) return;
      const status = event.nativeEvent;
      if (status.phase === 'failed') {
        reject(status.reason || 'Windows native surface failed');
        return;
      }
      // Only the admitted epoch may open first-content readiness. A completion
      // never republishes metrics or requests another frame through visibility.
      if (status.phase === 'frame') {
        if (
          status.nativeId === nativeId &&
          status.reactTag === reactTag &&
          status.viewGeneration === viewGeneration &&
          status.surfaceGeneration === surfaceGeneration &&
          status.frames > 0
        )
          binding.firstContentReady?.();
        return;
      }
      if (!['layout', 'bound', 'unbound', 'closed', 'visibility'].includes(status.phase)) return;
      if (status.framePipelineVersion !== 2) {
        reject(
          'Windows native frame pipeline2 is required; resupply and rebuild the matching host',
        );
        return;
      }
      if (status.pointerVersion !== 1) {
        reject('Windows native pointer port1 is required; rebuild the matching host');
        return;
      }
      if (status.keyboardVersion !== 2) {
        reject('Windows native keyboard port2 is required; rebuild the matching host');
        return;
      }
      if (status.visibilityVersion !== 1) {
        reject(
          'Windows native visibility port1 is required; resupply and rebuild the matching host',
        );
        return;
      }
      if (windowViewport && status.bound && status.windowViewport !== true) {
        reject(
          'Windows native full-window viewport ownership is required; resupply and rebuild the matching host',
        );
        return;
      }
      try {
        // Native close stops admission before the JS shutdown callback drains its
        // owners. Late layout/visibility receipts can still arrive in that gap.
        if (isClosing()) {
          binding.visibility(false);
          return;
        }
        verifyHost();
      } catch (error) {
        reject(String(error));
        return;
      }
      if (
        ![status.nativeId, status.reactTag, status.viewGeneration, status.surfaceGeneration].every(
          (n) => Number.isSafeInteger(n) && n > 0,
        ) ||
        ![
          status.logicalWidth,
          status.logicalHeight,
          status.width,
          status.height,
          status.scale,
        ].every(Number.isFinite) ||
        status.logicalWidth < 0 ||
        status.logicalHeight < 0 ||
        status.width < 0 ||
        status.height < 0 ||
        status.width > 4096 ||
        status.height > 4096 ||
        status.scale <= 0 ||
        status.scale > 8 ||
        Math.round(status.logicalWidth * status.scale) !== status.width ||
        Math.round(status.logicalHeight * status.scale) !== status.height ||
        typeof status.bound !== 'boolean' ||
        typeof status.visible !== 'boolean' ||
        (status.phase === 'closed' && status.bound)
      ) {
        reject('Invalid Windows native backing/lifetime metadata');
        return;
      }
      if (
        viewGeneration &&
        (status.viewGeneration !== viewGeneration ||
          status.reactTag !== reactTag ||
          status.nativeId !== nativeId)
      ) {
        reject('Windows native view owner changed; remount the application surface');
        return;
      }
      if (status.surfaceGeneration < surfaceGeneration) {
        reject('Windows native surface generation regressed');
        return;
      }
      viewGeneration = status.viewGeneration;
      surfaceGeneration = status.surfaceGeneration;
      reactTag = status.reactTag;
      nativeId = status.nativeId;
      const sized = status.bound && status.width > 0 && status.height > 0;
      binding.visibility(status.visible && sized, status.preparing === true && sized);
      if (status.phase === 'visibility') return;
      if (!status.bound || !status.width || !status.height) return;
      binding.ready(
        Object.freeze({
          logicalWidth: status.logicalWidth,
          logicalHeight: status.logicalHeight,
          physicalWidth: status.width,
          physicalHeight: status.height,
          scale: status.scale,
          nativeSurfaceGeneration: status.surfaceGeneration,
          nativeViewGeneration: status.viewGeneration,
          nativeReactTag: status.reactTag,
        }),
      );
    },
  };
}
