// SPDX-License-Identifier: BSD-3-Clause
import {readHermesRuntimeIdentity} from '../../backends/react-native/engine.ts';
import {createReactNativeEnvironment,useReactNativeViewport} from '../../backends/react-native/environment.ts';
import {createReactNativeRegistration} from '../../backends/react-native/registration.ts';
import type {ReactNativeRegistrationOptions} from '../../backends/react-native/registration.ts';
import type {ReactNativeAssetConfiguration} from '../../backends/react-native/assets.ts';
import type {ComponentType} from 'react';
import type {ReactNativeTextService,ReactNativeApplication} from '../../backends/react-native/surface.tsx';

const registration=createReactNativeRegistration('android',{
  loadReact:()=>require('react') as typeof import('react'),
  loadNative:()=>require('react-native') as typeof import('react-native'),
  initializeSkia:()=>require('@nelyx/skia-rn/runtime/native-bootstrap').initializeNativeSkia() as ReturnType<typeof import('@nelyx/skia-rn/runtime/native-bootstrap').initializeNativeSkia>,
  runtime:()=> (globalThis as unknown as {HermesInternal?:unknown}).HermesInternal?'hermes':'other',
  runtimeIdentity:readHermesRuntimeIdentity,
  configure({skia,profile}) {
    if(typeof skia.Skia.Data.nelyxConfigureGpuPolicy!=='function')throw new Error('Native GPU policy API unavailable; rebuild the owned RN binding');
    skia.Skia.Data.nelyxConfigureGpuPolicy(profile.id==='emulator-vulkan');
  },
});
export function androidAssets():AndroidAssets{return registration.assets();}
export function androidBackend(){return registration.backend();}
export const androidEnvironment=createReactNativeEnvironment(androidBackend);
export function useViewport(){return useReactNativeViewport(androidBackend);}
export interface AndroidRegistrationOptions extends ReactNativeRegistrationOptions {readonly profile:string;}
/** Android supplies native module loading and its explicit hardware/emulator GPU policy. */
export function registerApplication(name:string,application:ComponentType,options:AndroidRegistrationOptions):void {
  registration.register(name,application,options);
}
export type AndroidSurfaceKind = 'texture' | 'surface';
export interface AndroidAssets extends ReactNativeAssetConfiguration {}
export interface AndroidTextService extends ReactNativeTextService {}
export interface AndroidApplication extends ReactNativeApplication {}
