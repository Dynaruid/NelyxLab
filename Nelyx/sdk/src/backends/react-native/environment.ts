// SPDX-License-Identifier: BSD-3-Clause
export interface ReactNativeEnvironmentBackend {
  readonly native: Pick<typeof import('react-native'), 'PixelRatio' | 'useWindowDimensions'>;
  readonly skia: Pick<
    ReturnType<typeof import('@nelyx/skia-rn/runtime/native-bootstrap').initializeNativeSkia>,
    'Skia'
  >;
}
/** RN clock/runtime metadata; the platform composition supplies initialized modules. */
export function createReactNativeEnvironment(getBackend: () => ReactNativeEnvironmentBackend) {
  return {
    now: () => (globalThis as unknown as { performance: { now(): number } }).performance.now(),
    frame: (callback: () => void) => requestAnimationFrame(callback),
    defer: (callback: () => void, milliseconds: number) => setTimeout(callback, milliseconds),
    nextFrame: () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())),
    get scale() {
      return getBackend().native.PixelRatio.get();
    },
    get textScale() {
      return getBackend().native.PixelRatio.getFontScale();
    },
    get architecture() {
      return getBackend().skia.Skia.Data.nelyxArchitecture();
    },
    get nativeAbi() {
      return getBackend().skia.Skia.Data.nelyxCoreAbi();
    },
    get development() {
      return __DEV__;
    },
    get runtime() {
      return (globalThis as unknown as { HermesInternal?: unknown }).HermesInternal
        ? 'hermes'
        : 'other';
    },
  };
}
/** Logical RN viewport only; native surface/backing metrics remain adapter-owned. */
export function useReactNativeViewport(getBackend: () => ReactNativeEnvironmentBackend) {
  const { width, height, scale, fontScale } = getBackend().native.useWindowDimensions();
  return { width, height, scale, textScale: fontScale };
}
