// SPDX-License-Identifier: BSD-3-Clause
import type { NativeSyntheticEvent } from 'react-native';
import type { AppleSurfaceStatus } from '@nelyx/skia-rn/views/types';
import type { ReactNativeSurfaceBinding } from './surface.tsx';

/** A Yoga layout cannot admit an Apple renderer without its native owner/backing. */
export function createAppleNativeSurfaceProps(binding: ReactNativeSurfaceBinding) {
  let failed = false,
    viewGeneration = 0,
    lastGeneration = 0;
  const reject = (reason: string) => {
    if (failed) return;
    failed = true;
    binding.failed(new Error(reason));
  };
  return {
    onAppleSurfaceStatus(event: NativeSyntheticEvent<AppleSurfaceStatus>) {
      if (failed) return;
      const status = event.nativeEvent;
      if (status.phase === 'failed') {
        reject(status.reason || 'Apple native surface failed');
        return;
      }
      if (!['layout', 'bound', 'detached', 'closed'].includes(status.phase)) return;
      if (
        ![status.nativeId, status.viewGeneration, status.surfaceGeneration].every(
          (value) => Number.isSafeInteger(value) && value > 0,
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
        (status.visible && !status.bound) ||
        (['closed', 'detached'].includes(status.phase) && status.bound)
      ) {
        reject('Invalid Apple native backing/lifetime metadata');
        return;
      }
      if (viewGeneration && status.viewGeneration !== viewGeneration) {
        reject('Apple native view owner changed; remount the application surface');
        return;
      }
      viewGeneration = status.viewGeneration;
      if (status.surfaceGeneration < lastGeneration) {
        reject('Apple native surface generation regressed');
        return;
      }
      lastGeneration = status.surfaceGeneration;
      binding.visibility(status.visible && status.bound && status.width > 0 && status.height > 0);
      if (
        !status.bound ||
        status.logicalWidth <= 0 ||
        status.logicalHeight <= 0 ||
        status.width <= 0 ||
        status.height <= 0
      )
        return;
      binding.ready(
        Object.freeze({
          logicalWidth: status.logicalWidth,
          logicalHeight: status.logicalHeight,
          physicalWidth: status.width,
          physicalHeight: status.height,
          scale: status.scale,
          nativeSurfaceGeneration: status.surfaceGeneration,
          nativeViewGeneration: status.viewGeneration,
        }),
      );
    },
  };
}
