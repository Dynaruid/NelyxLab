// SPDX-License-Identifier: BSD-3-Clause
import type {PlatformId, ReactNativePlatform} from '@nelyx/core/hosting/platform';
import {matchesVersion} from './compatibility.ts';

export interface ProviderCohort {
  readonly id:string;
  readonly react:string;
  readonly reactNative:string|null;
  readonly nativeReactNative:string|null;
  readonly framework:'react-native'|'react-native-windows'|'react-native-macos'|'react-native-linux'|'react-native-web';
  readonly frameworkVersion:string;
  readonly frameworkRevision:string|null;
  readonly engine:'hermes'|'v8'|'jsc'|'browser';
  readonly engineVersion:string|null;
  readonly engineRevision:string|null;
  readonly bytecodeVersion:number|null;
}
export interface ProviderCohortEnvironment {readonly cohort?:string;readonly reactVersion?:string;readonly reactNativeVersion?:string;readonly nativeReactNativeVersion?:string;}
export function validateCohort(value:unknown,target:PlatformId):ProviderCohort {
  if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('Invalid provider cohort');
  const input=value as Record<string,unknown>;
  const names=['id','react','reactNative','nativeReactNative','framework','frameworkVersion','frameworkRevision','engine','engineVersion','engineRevision','bytecodeVersion'];
  if(Object.keys(input).some(key=>!names.includes(key))||names.some(key=>!Object.hasOwn(input,key)))throw new Error('Invalid provider cohort property');
  if(typeof input.id!=='string'||!/^[a-z0-9][a-z0-9.-]*$/.test(input.id))throw new Error('Invalid cohort id');
  for(const key of ['react','frameworkVersion'])if(typeof input[key]!=='string'||!matchesVersion(input[key] as string,input[key] as string))throw new Error('Invalid cohort '+key);
  const web=target==='web';
  const framework=target==='windows'?'react-native-windows':target==='macos'?'react-native-macos':target==='linux'?'react-native-linux':web?'react-native-web':'react-native';
  if(input.framework!==framework||!(web?input.engine==='browser':input.engine==='hermes'||target==='windows'&&['v8','jsc'].includes(input.engine as string)))throw new Error('Cohort framework/engine does not match target');
  if(web ? input.reactNative!==null : typeof input.reactNative!=='string')throw new Error('Invalid cohort React Native version');
  if(typeof input.reactNative==='string')matchesVersion(input.reactNative,input.reactNative);
  if(input.nativeReactNative!==null){if(typeof input.nativeReactNative!=='string')throw new Error('Invalid native React Native version');matchesVersion(input.nativeReactNative,input.nativeReactNative);}
  if(web&&input.nativeReactNative!==null)throw new Error('Browser cohort has no native React Native version');
  if(input.engineVersion!==null){if(typeof input.engineVersion!=='string')throw new Error('Invalid engine version');matchesVersion(input.engineVersion,input.engineVersion);}
  if(input.frameworkRevision!==null&&(typeof input.frameworkRevision!=='string'||!/^[a-f0-9]{40}$/.test(input.frameworkRevision)))throw new Error('Invalid framework revision');
  if((target==='android'||target==='ios')&&input.frameworkVersion!==input.reactNative)throw new Error('Cohort framework version must match React Native');
  if(input.engineRevision!==null&&(typeof input.engineRevision!=='string'||!/^[a-f0-9]{40}$/.test(input.engineRevision)))throw new Error('Invalid engine revision');
  if(input.bytecodeVersion!==null&&(!Number.isSafeInteger(input.bytecodeVersion)||(input.bytecodeVersion as number)<1))throw new Error('Invalid bytecode version');
  if(web&&(input.engineVersion!==null||input.engineRevision!==null||input.bytecodeVersion!==null))throw new Error('Browser engine version is environment-owned');
  if(!web&&input.engineVersion===null)throw new Error('Native cohort requires a declared engine version');
  if(input.engine==='v8'&&(input.bytecodeVersion!==null||input.engineRevision===null))throw new Error('V8 uses source bundles and requires a pinned engine revision');
  if(input.engine==='jsc'&&(input.bytecodeVersion!==null||input.engineRevision===null))throw new Error('JSC uses source bundles and requires a pinned engine revision');
  return Object.freeze({...input}) as unknown as ProviderCohort;
}

/** Windows-only source supplier; the stock RNW binary still uses Hermes. */
export function windowsV8Cohort():ProviderCohort {
  return validateCohort({...nativeCohort('windows'),id:'rn-0.83.10-v8',engine:'v8',engineVersion:'24.1.10',engineRevision:'c1877966a8285b7cbacbdd03e26ca003496436bc',bytecodeVersion:null},'windows');
}

export function windowsJscCohort():ProviderCohort {
  return validateCohort({...nativeCohort('windows'),id:'rn-0.83.10-jsc',engine:'jsc',engineVersion:'26.4.0',engineRevision:'482d54b279fd6147a45aaa122242f2ac315f46df',bytecodeVersion:null},'windows');
}

/** Exact source cohorts; their declaration does not qualify native execution. */
export function nativeCohort(target:ReactNativePlatform,legacyAndroid=false):ProviderCohort {
  if(legacyAndroid&&target!=='android')throw new Error('Legacy mobile cohort is Android-only');
  const linux=target==='linux',version=legacyAndroid?'0.83.1':linux?'0.81.6':'0.83.10';
  return validateCohort({id:`rn-${version}`,react:linux?'19.1.4':'19.2.0',reactNative:version,nativeReactNative:target==='windows'?'0.83.4':target==='macos'?'0.83.0':version,
    framework:target==='windows'?'react-native-windows':target==='macos'?'react-native-macos':linux?'react-native-linux':'react-native',
    frameworkVersion:target==='windows'?'0.83.2':target==='macos'?'0.83.0':linux?'0.0.1':version,
    frameworkRevision:linux?'9412cf605c7cc77f920916401926ff9a9873ecd3':null,
    engine:'hermes',engineVersion:linux?'0.12.0':target==='windows'?'1.0.0':legacyAndroid?'0.14.0':'0.14.1',
    engineRevision:linux?'e0fc67142ec0763c6b6153ca2bf96df815539782':target==='windows'?'94aa5e1d40a4ce99df79d951cbe45310ec40680c':legacyAndroid?'7ad93ab30325ed437a6eaaf310f7f87e9a3070e7':'5a1485fd688eafdf40637f4f2f44ec830f099b80',bytecodeVersion:target==='windows'?99:96},target);
}
