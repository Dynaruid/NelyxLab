import {finishOwnedDisposal} from '../../runtime/owned-disposal.ts';
// SPDX-License-Identifier: BSD-3-Clause
import type {NativeAssetConfiguration} from '../../runtime/native-assets.ts';
export interface WindowsNativeHostStatus {
  readonly abi:1;readonly platform:'windows';readonly runtimeGeneration:number;
  readonly phase:'active'|'closed'|'failed';readonly compositionPhase:'bound'|'active'|'closing'|'closed'|'failed';
  readonly deviceCreations:number;readonly pendingAsync:number;readonly uiConsumers:number;readonly registeredViews:number;
  readonly gpuCreatedOnJs:boolean;readonly gpuDrained:boolean;readonly nativeAdapter:string;readonly assetRoot:string;
  readonly compositionFailure?:string;readonly uiFailure?:string;
}
interface WindowsNativeApi {
  getStatus():unknown;prepareCompositionGpu():void;closeBindings():void;
  registerShutdownHandler(handler:(complete:(failure?:string)=>void)=>void):void;
}
const currentApi=():unknown=>(globalThis as unknown as {NelyxWindowsHost?:unknown}).NelyxWindowsHost;
export function verifyWindowsFrameworkVersion(constants:unknown,expected:string):void {
  const version=(constants as {reactNativeWindowsVersion?:{major:number;minor:number;patch:number}}|undefined)?.reactNativeWindowsVersion;
  if(!version||![version.major,version.minor,version.patch].every(n=>Number.isSafeInteger(n)&&n>=0)||`${version.major}.${version.minor}.${version.patch}`!==expected)
    throw new Error(`Incompatible native RNW framework; requires ${expected}`);
}
export function readWindowsNativeHostStatus(api:unknown=currentApi()):WindowsNativeHostStatus {
  if(!api||typeof api!=='object'||typeof (api as WindowsNativeApi).getStatus!=='function')throw new Error('Owned Windows native host status API unavailable');
  const value=(api as WindowsNativeApi).getStatus() as WindowsNativeHostStatus;
  if(!value||value.abi!==1||value.platform!=='windows'||!Number.isSafeInteger(value.runtimeGeneration)||value.runtimeGeneration<=0||
    !['active','closed','failed'].includes(value.phase)||!['bound','active','closing','closed','failed'].includes(value.compositionPhase)||
    ![value.deviceCreations,value.pendingAsync,value.uiConsumers,value.registeredViews].every(n=>Number.isSafeInteger(n)&&n>=0)||value.deviceCreations>1||value.uiConsumers>64||value.registeredViews>64||
    typeof value.gpuCreatedOnJs!=='boolean'||typeof value.gpuDrained!=='boolean'||typeof value.nativeAdapter!=='string'||
    typeof value.assetRoot!=='string'||!/^[A-Za-z]:[\\/]/.test(value.assetRoot))throw new Error('Invalid Windows native host status');
  return Object.freeze({...value});
}
/** One actual RNW module generation owns the GPU and every SDK effect lease. */
export function bindWindowsNativeHost(readApi:()=>unknown=currentApi) {
  const api=readApi() as WindowsNativeApi,initial=readWindowsNativeHostStatus(api);
  const getter=api.getStatus,prepare=api.prepareCompositionGpu,register=api.registerShutdownHandler,closeBindings=api.closeBindings;
  if(initial.phase!=='active'||!['bound','active'].includes(initial.compositionPhase)||typeof prepare!=='function'||typeof register!=='function'||typeof closeBindings!=='function')throw new Error('Active Windows native Composition/shutdown ports required');
  const verifyApi=()=>{
    if(readApi()!==api||api.getStatus!==getter||api.prepareCompositionGpu!==prepare||api.registerShutdownHandler!==register||api.closeBindings!==closeBindings)throw new Error('Windows native host API changed; runtime restart required');
  };
  const verify=(phase:'active'|'closing'|'closed')=>{
    verifyApi();
    const status=readWindowsNativeHostStatus(api);
    // The binding remains active while the native UI session closes admission.
    if(status.runtimeGeneration!==initial.runtimeGeneration||status.phase!==(phase==='closing'?'active':phase)||status.assetRoot!==initial.assetRoot)throw new Error('Windows native host generation/phase/root changed');
    if(status.compositionPhase!==phase||status.deviceCreations!==1||!status.gpuCreatedOnJs||!status.nativeAdapter||phase!=='closed'&&status.gpuDrained||phase==='closed'&&!status.gpuDrained)throw new Error(`Windows native GPU owner/phase failed admission: expected=${phase} actual=${status.compositionPhase} generation=${status.runtimeGeneration} deviceCreations=${status.deviceCreations} gpuCreatedOnJs=${status.gpuCreatedOnJs} gpuDrained=${status.gpuDrained} views=${status.registeredViews} consumers=${status.uiConsumers} pending=${status.pendingAsync} compositionFailure=${status.compositionFailure??''} uiFailure=${status.uiFailure??''}`);
    return status;
  };
  prepare.call(api);verify('active');
  const owners=new Set<()=>Promise<void>>();let closing=false;
  register.call(api,complete=>{
    if(closing)throw new Error('Windows SDK shutdown requested twice');closing=true;
    try{verify('closing');}catch(error){complete(String(error));return;}
    const tasks=[...owners].map(close=>finishOwnedDisposal(close));
    void (async()=>{
      try {
        const settled=await Promise.allSettled(tasks);
        if(settled.some(result=>result.status==='rejected')||owners.size)throw new Error('Windows SDK owner drain failed; dependencies retained');
        const deadline=Date.now()+5000;
        for(;;){const status=verify('closing');if(!status.uiConsumers&&!status.registeredViews&&!status.pendingAsync)break;if(Date.now()>deadline)throw new Error('Windows native view/UI completion timed out; dependencies retained');await new Promise(resolve=>setTimeout(resolve,16));}
        closeBindings.call(api);const final=verify('closed');
        if(final.uiConsumers||final.registeredViews||final.pendingAsync)throw new Error('Windows native close acknowledgement is incomplete');
        complete();
      }catch(error){complete(String(error));}
    })();
  });
  const isClosing=()=>{if(closing)return true;verifyApi();const status=readWindowsNativeHostStatus(api);if(status.runtimeGeneration!==initial.runtimeGeneration||status.assetRoot!==initial.assetRoot)throw new Error('Windows native host generation/phase/root changed');return status.compositionPhase==='closing'||status.compositionPhase==='closed';};
  return Object.freeze({runtimeGeneration:initial.runtimeGeneration,assetRoot:initial.assetRoot,isClosing,verify:()=>verify('active'),retainOwner(close:()=>Promise<void>){
    verify('active');if(closing||owners.has(close))throw new Error('Windows SDK owner admission is closed or duplicate');
    owners.add(close);let released=false;return {release(){if(released)return;released=true;owners.delete(close);}};
  }});
}
/** Explicit runner-local assets use the native module's allowlisted directory. */
export function windowsAssetUri(uri:string,root:string):string {
  if(!uri.startsWith('nelyx-asset:/'))return uri;
  const relative=uri.slice('nelyx-asset:/'.length),parts=relative.split('/');
  // oxlint-disable-next-line no-control-regex -- Control code points are deliberately matched for input validation or normalization.
  if(!relative||relative.length>512||parts.some(part=>!part||part==='.'||part==='..'||/[\\:%?#\x00-\x1f]/.test(part)))throw new Error('Invalid Windows runner asset path');
  if(!/^[A-Za-z]:[\\/]/.test(root))throw new Error('Invalid Windows native asset root');
  const normalized=root.replaceAll('\\','/');
  return 'file:///'+normalized.slice(0,2)+'/'+normalized.slice(2).split('/').filter(Boolean).map(encodeURIComponent).join('/')+'/'+parts.map(encodeURIComponent).join('/');
}
export function resolveWindowsAssetSources(configuration:NativeAssetConfiguration,root:string):NativeAssetConfiguration {
  const sources=Object.freeze(Object.fromEntries(Object.entries(configuration.sources).map(([id,source])=>[id,typeof source==='number'?source:Object.freeze({uri:windowsAssetUri(source.uri,root)})])));
  return Object.freeze({manifest:configuration.manifest,sources});
}
