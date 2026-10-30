import React, { useImperativeHandle, useMemo, useRef } from 'react';
import { Platform } from '../Platform/Platform.ts';
// Explicit source extensions select an exact Metro file. Choose desktop
// Fabric metadata lazily so the common codegen spec is not evaluated.
const SkiaViewNativeComponent: typeof import('../specs/SkiaViewNativeComponent.ts').default =
  (Platform.OS as string) === 'linux'
    ? require('../specs/SkiaViewNativeComponent.linux.ts').default
    : (Platform.OS as string) === 'windows'
      ? require('../specs/SkiaViewNativeComponent.windows.ts').default
      : require('../specs/SkiaViewNativeComponent.ts').default;

import { SkiaViewApi } from './api.ts';
import { androidNativeProps } from './android.ts';
import { SkiaViewNativeId } from './SkiaViewNativeId.ts';
import type { SkiaGraphiteViewProps } from './graphite-types.ts';
import type { AppleSurfaceStatus, LinuxSurfaceStatus, WindowsSurfaceStatus } from './types.ts';

// The layout is known synchronously on the new architecture;
// getBoundingClientRect became stable in React Native 0.83. On the web the
// view measures itself (see SkiaView.web).
const measureLayout = (view: unknown) => {
  if (Platform.OS === 'web') {
    return { width: 0, height: 0 };
  }
  const host = view as {
    getBoundingClientRect?: () => { width: number; height: number };
    unstable_getBoundingClientRect: () => { width: number; height: number };
  };
  return host.getBoundingClientRect
    ? host.getBoundingClientRect()
    : host.unstable_getBoundingClientRect();
};

/**
 * A view whose frames are recorded from JavaScript, on any runtime, through
 * the context of its ref. See {@link SkGraphiteContext}.
 */
export const SkiaGraphiteView = ({
  opaque = false,
  highBitDepth = false,
  android,
  onLinuxSurfaceStatus,
  onAppleSurfaceStatus,
  onWindowsSurfaceStatus,
  ref,
  ...viewProps
}: SkiaGraphiteViewProps) => {
  const nativeId = useMemo(() => SkiaViewNativeId.current++, []);
  const linux = useRef<{ bound: boolean; status?: LinuxSurfaceStatus }>({ bound: false });
  const apple = useRef<{ bound: boolean; status?: AppleSurfaceStatus }>({ bound: false });
  const windows = useRef<{ bound: boolean; status?: WindowsSurfaceStatus }>({ bound: false });
  const viewRef = useRef<React.ComponentRef<typeof SkiaViewNativeComponent>>(null);
  useImperativeHandle(
    ref,
    () => ({
      getNativeId: () => nativeId,
      getMouseCursorVersion: () => {
        assertSkiaViewApi();
        const read = SkiaViewApi.mouseCursorVersion;
        if (typeof read !== 'function')
          throw new Error(
            'Native mouse cursor protocol is unavailable; rebuild matching Skia sources',
          );
        return read.call(SkiaViewApi);
      },
      getContext: () => {
        assertSkiaViewApi();
        const view = viewRef.current;
        if (!view) {
          throw new Error('SkiaGraphiteView: getContext() was called before the view was mounted.');
        }
        const platform = Platform.OS as string,
          isApple = platform === 'ios' || platform === 'macos';
        const lifecycle =
          platform === 'linux'
            ? linux.current
            : platform === 'windows'
              ? windows.current
              : isApple
                ? apple.current
                : undefined;
        const status = lifecycle?.status;
        if (
          lifecycle &&
          (!lifecycle.bound ||
            !status ||
            status.logicalWidth <= 0 ||
            status.logicalHeight <= 0 ||
            status.width <= 0 ||
            status.height <= 0)
        )
          throw new Error(
            'SkiaGraphiteView: native binding and positive backing layout are required before getContext()',
          );
        const size = status
          ? { width: status.logicalWidth, height: status.logicalHeight }
          : measureLayout(view);
        return SkiaViewApi.makeGraphiteContext(
          nativeId,
          size.width,
          size.height,
          opaque,
          highBitDepth,
          status?.scale,
        );
      },
    }),
    [nativeId, opaque, highBitDepth],
  );
  return (
    <SkiaViewNativeComponent
      ref={viewRef}
      collapsable={false}
      nativeID={`${nativeId}`}
      opaque={opaque}
      highBitDepth={highBitDepth}
      {...androidNativeProps(android)}
      {...viewProps}
      {...((Platform.OS as string) === 'linux'
        ? {
            onLinuxSurfaceStatus: (
              event: Parameters<NonNullable<SkiaGraphiteViewProps['onLinuxSurfaceStatus']>>[0],
            ) => {
              const status = event.nativeEvent;
              if (status.nativeId !== nativeId && status.phase !== 'failed') return;
              linux.current.status = status;
              linux.current.bound = status.bound;
              if (status.phase === 'failed') linux.current.bound = false;
              onLinuxSurfaceStatus?.(event);
            },
          }
        : onLinuxSurfaceStatus
          ? { onLinuxSurfaceStatus }
          : {})}
      {...(['ios', 'macos'].includes(Platform.OS as string)
        ? {
            onAppleSurfaceStatus: (
              event: Parameters<NonNullable<SkiaGraphiteViewProps['onAppleSurfaceStatus']>>[0],
            ) => {
              const status = event.nativeEvent;
              if (status.nativeId !== nativeId && status.phase !== 'failed') return;
              apple.current.status = status;
              apple.current.bound =
                status.bound && status.phase !== 'failed' && status.phase !== 'closed';
              onAppleSurfaceStatus?.(event);
            },
          }
        : onAppleSurfaceStatus
          ? { onAppleSurfaceStatus }
          : {})}
      {...((Platform.OS as string) === 'windows'
        ? {
            onWindowsSurfaceStatus: (
              event: Parameters<NonNullable<SkiaGraphiteViewProps['onWindowsSurfaceStatus']>>[0],
            ) => {
              const status = event.nativeEvent;
              if (status.nativeId !== nativeId && status.phase !== 'failed') return;
              windows.current.status = status;
              windows.current.bound =
                status.bound && status.phase !== 'failed' && status.phase !== 'closed';
              onWindowsSurfaceStatus?.(event);
            },
          }
        : onWindowsSurfaceStatus
          ? { onWindowsSurfaceStatus }
          : {})}
    />
  );
};

const assertSkiaViewApi = () => {
  if (SkiaViewApi === null || SkiaViewApi.makeGraphiteContext === null) {
    throw Error('Skia View Api was not found.');
  }
};
