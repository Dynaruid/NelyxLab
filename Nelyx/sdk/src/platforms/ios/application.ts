// SPDX-License-Identifier: BSD-3-Clause
import {readHermesRuntimeIdentity} from '../../backends/react-native/engine.ts';
import type {ComponentType} from 'react';
import {createReactNativeRegistration} from '../../backends/react-native/registration.ts';
import type {ReactNativeRegistrationOptions} from '../../backends/react-native/registration.ts';
import {createReactNativeEnvironment,useReactNativeViewport} from '../../backends/react-native/environment.ts';
import type {ReactNativeApplication} from '../../backends/react-native/surface.tsx';
import type {NativeAssetConfiguration} from '../../runtime/native-assets.ts';
import {bindAppleNativeHost,readAppleRuntimeHostHook} from '../../backends/react-native/apple-host.ts';

let nativeAdmission:ReturnType<typeof bindAppleNativeHost>|undefined;
const registration=createReactNativeRegistration('ios',{
  loadReact:()=>require('react') as typeof import('react'),
  loadNative:()=>require('react-native') as typeof import('react-native'),
  initializeSkia:()=>require('@nelyx/skia-rn/runtime/native-bootstrap').initializeNativeSkia() as ReturnType<typeof import('@nelyx/skia-rn/runtime/native-bootstrap').initializeNativeSkia>,
  runtime:()=> (globalThis as unknown as {HermesInternal?:unknown}).HermesInternal?'hermes':'other',
  runtimeIdentity:readHermesRuntimeIdentity,
  preflight(cohort){readAppleRuntimeHostHook('ios',cohort.nativeReactNative!);},
  configure({skia,cohort}) {
    if(typeof skia.Skia.Data.nelyxConfigureGpuPolicy!=='function')throw new Error('Owned Apple Skia GPU policy API unavailable');
    skia.Skia.Data.nelyxConfigureGpuPolicy(false);
    nativeAdmission=bindAppleNativeHost('ios',undefined,undefined,cohort.nativeReactNative!);
  },
});
export interface IOSRegistrationOptions extends ReactNativeRegistrationOptions {}
export interface IOSAssets extends NativeAssetConfiguration {}
export interface IOSApplication extends ReactNativeApplication {}
export function iosBackend(){return registration.backend();}
export function verifyIOSNativeHost(){if(!nativeAdmission)throw new Error('Apple native host not admitted');return nativeAdmission.verify();}
export function retainIOSNativeHostOwner(close:()=>Promise<void>){if(!nativeAdmission)throw new Error('Apple native host not admitted');return nativeAdmission.retainOwner(close);}
export function shutdownIOSRuntime(){if(!nativeAdmission)throw new Error('Apple native host not admitted');return nativeAdmission.shutdown();}
export function iosAssets():IOSAssets{return registration.assets();}
export const iosEnvironment=createReactNativeEnvironment(iosBackend);
export function useViewport(){return useReactNativeViewport(iosBackend);}
/** Apple composes the shared owner with native Metal/Dawn loading. Provider admission remains gated by target supply. */
export function registerApplication(name:string,application:ComponentType,options:IOSRegistrationOptions):void {nativeAdmission?.verify();registration.register(name,application,options);}
