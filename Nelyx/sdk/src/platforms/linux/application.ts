// SPDX-License-Identifier: BSD-3-Clause
import { readHermesRuntimeIdentity } from '../../backends/react-native/engine.ts';
import type { ComponentType } from 'react';
import { createReactNativeRegistration } from '../../backends/react-native/registration.ts';
import type { ReactNativeRegistrationOptions } from '../../backends/react-native/registration.ts';
import {
  createReactNativeEnvironment,
  useReactNativeViewport,
} from '../../backends/react-native/environment.ts';
import type { ReactNativeApplication } from '../../backends/react-native/surface.tsx';
import type { NativeAssetConfiguration } from '../../runtime/native-assets.ts';
import { bindLinuxNativeHost } from './native-host.ts';
import type { LinuxNativeHostAdmission } from './native-host.ts';

let nativeAdmission: LinuxNativeHostAdmission | undefined;
const registration = createReactNativeRegistration('linux', {
  loadReact: () => require('react') as typeof import('react'),
  loadNative: () => require('react-native') as typeof import('react-native'),
  initializeSkia: () =>
    require('@nelyx/skia-rn/runtime/native-bootstrap').initializeNativeSkia() as ReturnType<
      typeof import('@nelyx/skia-rn/runtime/native-bootstrap').initializeNativeSkia
    >,
  runtime: () =>
    (globalThis as unknown as { HermesInternal?: unknown }).HermesInternal ? 'hermes' : 'other',
  runtimeIdentity: readHermesRuntimeIdentity,
  configure({ skia, profile }) {
    const admission = bindLinuxNativeHost(profile.id);
    if (typeof skia.Skia.Data.nelyxConfigureGpuPolicy !== 'function')
      throw new Error('Owned Linux Skia GPU policy API unavailable');
    skia.Skia.Data.nelyxConfigureGpuPolicy(false);
    nativeAdmission = admission;
  },
});
export interface LinuxRegistrationOptions extends ReactNativeRegistrationOptions {}
export interface LinuxAssets extends NativeAssetConfiguration {}
export interface LinuxApplication extends ReactNativeApplication {}
export function linuxBackend() {
  return registration.backend();
}
export function verifyLinuxNativeHost() {
  if (!nativeAdmission) throw new Error('Linux native host has not been admitted');
  return nativeAdmission.verify();
}
export function retainLinuxNativeHostOwner(close: () => Promise<void>) {
  if (!nativeAdmission) throw new Error('Linux native host has not been admitted');
  return nativeAdmission.retainOwner(close);
}
export function linuxAssets(): LinuxAssets {
  return registration.assets();
}
export const linuxEnvironment = createReactNativeEnvironment(linuxBackend);
export function useViewport() {
  return useReactNativeViewport(linuxBackend);
}
/** Linux composes the shared RN owner with its native Vulkan binding. Provider admission remains gated by native services and lifecycle. */
export function registerApplication(
  name: string,
  application: ComponentType,
  options: LinuxRegistrationOptions,
): void {
  nativeAdmission?.verify();
  registration.register(name, application, options);
}
