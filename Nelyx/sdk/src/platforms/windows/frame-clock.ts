// SPDX-License-Identifier: BSD-3-Clause
import type {SurfaceFrameScheduler} from '../../runtime/frame-clock.ts';
interface WindowsFrameApi {
  readonly frameClockVersion:1;
  requestFrame(callback:(failure?:string,timing?:{nativeTick:number;nativeDispatch:number})=>void):number;
  getMonotonicTime?():number;
  cancelFrame(id:number):void;
}
const currentApi=():unknown=>(globalThis as {NelyxWindowsHost?:unknown}).NelyxWindowsHost;
const domains=new WeakMap<WindowsFrameApi,{offset:number;uncertainty:number}>();
function domain(api:WindowsFrameApi){
  let value=domains.get(api);if(value)return value;
  if(typeof api.getMonotonicTime!=='function')throw new Error('Windows native monotonic clock requires matching rebuilt inputs');
  const before=performance.now(),native=api.getMonotonicTime(),after=performance.now();
  if(!Number.isFinite(native))throw new Error('Invalid Windows native clock sample');
  value={offset:(before+after)/2-native,uncertainty:(after-before)/2};domains.set(api,value);return value;
}
/** QPC milliseconds are calibrated once per native owner; never treated as JS time directly. */
export function windowsMonotonicTimestamp(value:number,readApi:()=>unknown=currentApi):number{
  if(!Number.isFinite(value))throw new Error('Invalid Windows native timestamp');
  return value+domain(readApi() as WindowsFrameApi).offset;
}
/** RNW's UI-post RAF is unpaced. Each surface uses the owned compositor clock. */
export function createWindowsFrameScheduler(readApi:()=>unknown=currentApi):SurfaceFrameScheduler {
  const api=readApi() as WindowsFrameApi;
  if(!api||api.frameClockVersion!==1||typeof api.requestFrame!=='function'||typeof api.cancelFrame!=='function')throw new Error('Windows compositor frame clock1 requires matching rebuilt native inputs');
  const request=api.requestFrame,cancel=api.cancelFrame;
  const verify=()=>{if(readApi()!==api||api.requestFrame!==request||api.cancelFrame!==cancel||api.frameClockVersion!==1)throw new Error('Windows compositor frame owner changed; runtime restart required');};
  return {
    request(callback,onError){verify();return request.call(api,(failure,timing)=>{
      if(failure!==undefined){const error=new Error(failure);if(onError)onError(error);else throw error;return;}
      if(!timing){callback();return;}
      try{
        if(!Number.isFinite(timing.nativeTick)||!Number.isFinite(timing.nativeDispatch)||timing.nativeDispatch<timing.nativeTick)throw new Error('Invalid Windows frame clock receipt');
        const clock=domain(api);callback(Object.freeze({tick:timing.nativeTick+clock.offset,dispatch:timing.nativeDispatch+clock.offset,queueDelay:timing.nativeDispatch-timing.nativeTick,clockUncertainty:clock.uncertainty}));
      }catch(error){if(onError)onError(error);else throw error;}
    });},
    cancel(id){verify();cancel.call(api,id);},
  };
}
