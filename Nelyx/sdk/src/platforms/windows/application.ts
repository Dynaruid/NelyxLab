// SPDX-License-Identifier: BSD-3-Clause
import {readHermesRuntimeIdentity,readV8RuntimeIdentity,readJscRuntimeIdentity} from '../../backends/react-native/engine.ts';
import type {ComponentType} from 'react';
import {createReactNativeRegistration} from '../../backends/react-native/registration.ts';
import type {ReactNativeRegistrationOptions} from '../../backends/react-native/registration.ts';
import {createReactNativeEnvironment,useReactNativeViewport} from '../../backends/react-native/environment.ts';
import type {ReactNativeApplication} from '../../backends/react-native/surface.tsx';
import type {NativeAssetConfiguration} from '../../runtime/native-assets.ts';
import {bindWindowsNativeHost,resolveWindowsAssetSources,verifyWindowsFrameworkVersion} from './native-host.ts';

let nativeAdmission:ReturnType<typeof bindWindowsNativeHost>|undefined;
const registration=createReactNativeRegistration('windows',{
  loadReact(){if(!(globalThis as unknown as {HermesInternal?:unknown}).HermesInternal&&!readV8RuntimeIdentity()&&!readJscRuntimeIdentity())throw new Error('Windows SDK registration requires an owning RNW Hermes, V8 or JSC runtime');return require('react') as typeof import('react');},
  loadNative:()=>require('react-native') as typeof import('react-native'),
  initializeSkia:()=>require('@nelyx/skia-rn/runtime/native-bootstrap').initializeNativeSkia() as ReturnType<typeof import('@nelyx/skia-rn/runtime/native-bootstrap').initializeNativeSkia>,
  runtime:()=> (globalThis as unknown as {HermesInternal?:unknown}).HermesInternal?'hermes':readV8RuntimeIdentity()?'v8':readJscRuntimeIdentity()?'jsc':'other',
  runtimeIdentity:()=>readJscRuntimeIdentity()??readV8RuntimeIdentity()??readHermesRuntimeIdentity(),
  configure({skia,native,cohort}) {
    verifyWindowsFrameworkVersion(native.Platform.constants,cohort.frameworkVersion);
    if(typeof skia.Skia.Data.nelyxConfigureGpuPolicy!=='function')throw new Error('Owned Windows native GPU policy API unavailable');
    skia.Skia.Data.nelyxConfigureGpuPolicy(false);nativeAdmission=bindWindowsNativeHost();
  },
  resolveAssets:configuration=>resolveWindowsAssetSources(configuration,verifyWindowsNativeHost().assetRoot),
});
export interface WindowsRegistrationOptions extends ReactNativeRegistrationOptions {}
export interface RegistrationOptions extends WindowsRegistrationOptions {}
export interface WindowsAssets extends NativeAssetConfiguration {}
export interface WindowsApplication extends ReactNativeApplication {}
export function windowsBackend(){return registration.backend();}
export function verifyWindowsNativeHost(){if(!nativeAdmission)throw new Error('Windows native host has not been admitted');return nativeAdmission.verify();}
export function retainWindowsNativeHostOwner(close:()=>Promise<void>){if(!nativeAdmission)throw new Error('Windows native host has not been admitted');return nativeAdmission.retainOwner(close);}
export function isWindowsNativeHostClosing():boolean{return nativeAdmission?.isClosing()??false;}
export function windowsAssets():WindowsAssets{return registration.assets();}
export const windowsEnvironment=createReactNativeEnvironment(windowsBackend);
export function useViewport(){return useReactNativeViewport(windowsBackend);}
/** SDK owns native installation/GPU admission, AppRegistry registration and normal host close. */
export function registerApplication(name:string,application:ComponentType,options:WindowsRegistrationOptions):void {nativeAdmission?.verify();registration.register(name,application,options);}
