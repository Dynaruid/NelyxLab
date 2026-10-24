// SPDX-License-Identifier: BSD-3-Clause
import type {ComponentType} from 'react';
import type {ReactNativePlatform} from '@nelyx/core/hosting/platform';
import {createProviderRegistry} from '../../runtime/providers.ts';
import type {ProviderProfile,ProviderRegistry} from '../../runtime/providers.ts';
import type {ProviderCohort} from '../../runtime/cohorts.ts';
import type {ReactNativeAssetConfiguration} from './assets.ts';
import {validateNativeRuntimeIdentity} from './engine.ts';
import type {HermesRuntimeIdentity,V8RuntimeIdentity,JscRuntimeIdentity} from './engine.ts';

export interface ReactNativeBackend {
  readonly react:typeof import('react');
  readonly native:typeof import('react-native');
  readonly skia:ReturnType<typeof import('@nelyx/skia-rn/runtime/native-bootstrap').initializeNativeSkia>;
  readonly profile:ProviderProfile;
  readonly cohort:ProviderCohort;
}
export interface ReactNativeRegistrationOptions {
  readonly profile?:string;
  readonly cohort?:string;
  readonly assets:ReactNativeAssetConfiguration;
}
export interface ReactNativeRegistrationPorts {
  loadReact():ReactNativeBackend['react'];
  loadNative():ReactNativeBackend['native'];
  initializeSkia():ReactNativeBackend['skia'];
  runtime():string;
  runtimeIdentity():HermesRuntimeIdentity|V8RuntimeIdentity|JscRuntimeIdentity|undefined;
  preflight?(cohort:ProviderCohort):void;
  configure(backend:ReactNativeBackend):void;
  resolveAssets?(configuration:ReactNativeAssetConfiguration,backend:ReactNativeBackend):ReactNativeAssetConfiguration;
}
const failedInstallations=new Set<unknown>();
function snapshotAssets(value:ReactNativeAssetConfiguration):ReactNativeAssetConfiguration {
  const ids=new Set<string>();
  if(!value||!Array.isArray(value.manifest)||!value.sources||value.manifest.length>64)throw new Error('Invalid React Native manifest/source budget');
  const manifest=value.manifest.map(asset=>{
    if(!asset.id||ids.has(asset.id)||!/^[a-f0-9]{64}$/.test(asset.sha256)||!['image','font'].includes(asset.kind)||(asset.kind==='font'&&!asset.fontFamily)||!Object.hasOwn(value.sources,asset.id))throw new Error(`Invalid React Native manifest/source: ${asset.id}`);
    ids.add(asset.id);return Object.freeze({...asset});
  });
  const sources=Object.fromEntries(Object.entries(value.sources).map(([id,source])=>{
    if(!ids.has(id)||!(typeof source==='number'&&Number.isSafeInteger(source)&&source>0||source&&typeof source==='object'&&typeof source.uri==='string'&&source.uri.length>0))throw new Error(`Invalid React Native source: ${id}`);
    return [id,typeof source==='number'?source:Object.freeze({uri:source.uri})];
  }));
  return Object.freeze({manifest:Object.freeze(manifest),sources:Object.freeze(sources)});
}
/** One platform composition per JS runtime. Native installation is never rolled back by dropping JS references. */
export function createReactNativeRegistration(target:ReactNativePlatform,ports:ReactNativeRegistrationPorts,registry:ProviderRegistry=createProviderRegistry()) {
  let initialized:ReactNativeBackend|undefined;
  let registration:{name:string;assets:ReactNativeAssetConfiguration}|undefined;
  let poisoned=false;
  function backend():ReactNativeBackend {
    if(!registration||!initialized)throw new Error(`Call ${target} registerApplication before using host components`);
    return initialized;
  }
  function assets():ReactNativeAssetConfiguration {
    if(!registration)throw new Error(`${target} bootstrap must register a manifest and Metro asset sources`);
    return registration.assets;
  }
  function register(name:string,application:ComponentType,options:ReactNativeRegistrationOptions):void {
    if(!/^[A-Z][A-Za-z0-9]*$/.test(name)||typeof application!=='function'&&(!application||typeof application!=='object'))throw new Error('Invalid React Native application name/component');
    const selected=registry.profile(target,options.profile);
    const cohort=registry.cohort(target,{...(options.cohort?{cohort:options.cohort}:{})},selected.id);
    if(selected.status==='unsupported')throw new Error(`Unsupported profile: ${target}/${selected.id}: ${selected.reason}`);
    const configuration=snapshotAssets(options.assets);
    if(poisoned)throw new Error('Native initialization failed; reload the JS runtime before registration');
    if(registration&&registration.name!==name)throw new Error('A platform composition cannot register a different application name');
    if(initialized&&(initialized.profile.id!==selected.id||initialized.cohort.id!==cohort.id))throw new Error('React Native profile/cohort changes require process restart');
    if(!initialized) {
      const react=ports.loadReact(),native=ports.loadNative();
      if((native.Platform.OS as string)!==target)throw new Error(`${target} provider cannot execute on ${native.Platform.OS}`);
      const rn=native.Platform.constants.reactNativeVersion;
      const version=`${rn.major}.${rn.minor}.${rn.patch}${rn.prerelease?`-${rn.prerelease}`:''}`;
      registry.cohort(target,{cohort:cohort.id,reactVersion:react.version,nativeReactNativeVersion:version},selected.id);
      if(ports.runtime()!==cohort.engine)throw new Error(`Incompatible runtime; ${target} requires ${cohort.engine}`);
      validateNativeRuntimeIdentity(cohort,ports.runtimeIdentity());
      ports.preflight?.(cohort);
      let installed:ReactNativeBackend['skia']|undefined;
      try {
        const skia=installed=ports.initializeSkia();
        if(typeof skia.Skia.Data.nelyxArchitecture!=='function'||typeof skia.Skia.Data.nelyxCoreAbi!=='function')throw new Error('Native Skia ABI introspection unavailable; rebuild the owned source fork');
        if(skia.Skia.Data.nelyxCoreAbi()!==selected.nativeAbi.skia)throw new Error('Incompatible native Skia ABI');
        const profile=registry.select(target,selected.id,{cohort:cohort.id,os:target==='macos'?'darwin':target,architecture:skia.Skia.Data.nelyxArchitecture(),artifacts:selected.artifactManifest.required});
        const prepared=Object.freeze({react,native,skia,profile,cohort});
        ports.configure(prepared);initialized=prepared;
      } catch(error) {poisoned=true;failedInstallations.add({target,ports,installed,error});throw error;}
    }
    const assets=ports.resolveAssets?snapshotAssets(ports.resolveAssets(configuration,initialized)):configuration;
    initialized.native.AppRegistry.registerComponent(name,()=>application);
    registration={name,assets};
  }
  return {backend,assets,register};
}
