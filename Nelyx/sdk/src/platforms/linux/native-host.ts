import {finishOwnedDisposal} from '../../runtime/owned-disposal.ts';
// SPDX-License-Identifier: BSD-3-Clause
export interface LinuxNativeHostStatus {
  readonly abi:1;readonly platform:'linux';readonly runtimeGeneration:number;
  readonly windowSystem:'x11'|'wayland';readonly gpuMode:'hardware-dmabuf';
  readonly phase:'prepared'|'active'|'closing'|'closed';readonly gpuPrepared:boolean;
}
export interface LinuxNativeHostAdmission {
  readonly runtimeGeneration:number;readonly windowSystem:'x11'|'wayland';
  verify():LinuxNativeHostStatus;
  retainOwner(close:()=>Promise<void>):{release():void};
}
const currentApi=():unknown=>(globalThis as unknown as {NelyxLinuxHost?:unknown}).NelyxLinuxHost;
/** Coordinates SDK owners before the native runtime is destroyed. */
export function createLinuxNativeHostShutdown(readApi:()=>unknown=currentApi) {
  const api=readApi(),initial=readLinuxNativeHostStatus(api);
  const native=api as {getStatus:unknown;registerShutdownHandler?:(handler:(complete:(error?:string)=>void)=>void)=>void};
  const getter=native.getStatus,register=native.registerShutdownHandler;
  if(initial.phase!=='active' || typeof register!=='function')throw new Error('Active Linux native shutdown protocol unavailable');
  const verify=(phase:'active'|'closing')=>{
    if(readApi()!==api || native.getStatus!==getter || native.registerShutdownHandler!==register)throw new Error('Linux native shutdown API changed');
    const status=readLinuxNativeHostStatus(api);
    if(status.runtimeGeneration!==initial.runtimeGeneration || status.phase!==phase)throw new Error('Linux native shutdown generation/phase changed');
  };
  const owners=new Set<()=>Promise<void>>();let closing=false;
  register.call(api,(complete)=>{
    if(closing)throw new Error('Linux native shutdown requested twice');
    closing=true;
    try{verify('closing');}catch(error){complete(String(error));return;}
    // Call every owner immediately, even if another throws, before awaiting drain.
    const tasks=[...owners].map(close=>finishOwnedDisposal(close));
    void Promise.allSettled(tasks).then(results=>{
      let failure:string|undefined;
      try {
        verify('closing');
        const failures=results.filter(result=>result.status==='rejected');
        if(failures.length)throw new Error(`Linux SDK owner drain failed (${failures.length}); dependencies retained`);
        if(owners.size)throw new Error('Linux SDK owners remained after disposal');
      }catch(error){failure=String(error);}
      complete(failure);
    });
  });
  return Object.freeze({retainOwner(close:()=>Promise<void>) {
    verify('active');if(closing || owners.has(close))throw new Error('Linux SDK owner admission is closed or duplicate');
    owners.add(close);let released=false;
    return {release(){if(released)return;released=true;owners.delete(close);}};
  }});
}
/** Read the native host without admitting metadata/prepared/closing runtimes. */
export function readLinuxNativeHostStatus(api:unknown=currentApi()):LinuxNativeHostStatus {
  if(!api || typeof api!=='object' || typeof (api as {getStatus?:unknown}).getStatus!=='function')throw new Error('Owned Linux native host status API unavailable');
  const value=(api as {getStatus():unknown}).getStatus();
  if(!value || typeof value!=='object')throw new Error('Invalid Linux native host status');
  const status=value as LinuxNativeHostStatus;
  if(status.abi!==1 || status.platform!=='linux' || !Number.isSafeInteger(status.runtimeGeneration) || status.runtimeGeneration<=0 ||
    !['x11','wayland'].includes(status.windowSystem) || status.gpuMode!=='hardware-dmabuf' ||
    !['prepared','active','closing','closed'].includes(status.phase) || typeof status.gpuPrepared!=='boolean')throw new Error('Invalid Linux native host status');
  return Object.freeze({abi:status.abi,platform:status.platform,runtimeGeneration:status.runtimeGeneration,
    windowSystem:status.windowSystem,gpuMode:status.gpuMode,phase:status.phase,gpuPrepared:status.gpuPrepared});
}
/** Registration captures one native API/generation; later callbacks cannot switch hosts. */
export function bindLinuxNativeHost(profile:string,readApi:()=>unknown=currentApi):LinuxNativeHostAdmission {
  const expected=profile==='rn-graphite-vulkan-x11'?'x11':profile==='rn-graphite-vulkan-wayland'?'wayland':undefined;
  if(!expected)throw new Error('Unsupported Linux native window profile');
  const api=readApi(),initial=readLinuxNativeHostStatus(api);
  const getter=(api as {getStatus:unknown}).getStatus;
  const verify=()=>{
    if(readApi()!==api || (api as {getStatus:unknown}).getStatus!==getter)throw new Error('Linux native host API changed; process restart required');
    const status=readLinuxNativeHostStatus(api);
    if(status.runtimeGeneration!==initial.runtimeGeneration)throw new Error('Linux native host generation changed; process restart required');
    if(status.windowSystem!==expected)throw new Error('Linux native window system differs from its requested profile');
    if(status.phase!=='active')throw new Error('Linux native host is not active');
    if(status.gpuMode!=='hardware-dmabuf' || !status.gpuPrepared)throw new Error('Linux hardware Vulkan/DMA-BUF host is not prepared; hardware admission denied');
    return status;
  };
  verify();const shutdown=createLinuxNativeHostShutdown(readApi);
  return Object.freeze({runtimeGeneration:initial.runtimeGeneration,windowSystem:expected,verify,retainOwner:shutdown.retainOwner});
}
