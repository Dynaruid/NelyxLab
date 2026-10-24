// SPDX-License-Identifier: BSD-3-Clause
import type {FrameClock,FrameTiming} from '@nelyx/core/foundation/clock';

export interface ReactNativeAppStatePort {
  readonly isAvailable:boolean;
  readonly currentState:string|null;
  addEventListener(type:'change',changed:(state:string)=>void):{remove():void};
}
/** Native platform adapters must supply an observed visibility port; absence never implies active. */
export function bindReactNativeVisibility(port:ReactNativeAppStatePort,changed:(visible:boolean)=>void) {
  if(!port.isAvailable)throw new Error('React Native AppState is unavailable; supply a native visibility adapter');
  let live=true;
  const subscription=port.addEventListener('change',state=>{if(live)changed(state==='active');});
  return {visible:port.currentState==='active',dispose(){if(!live)return;live=false;subscription.remove();}};
}
export interface ReactNativeFrameScheduler {request(callback:(timing?:FrameTiming)=>void,onError?:(error:unknown)=>void):number;cancel(id:number):void;}
/** Frame and retirement polling belong to one surface owner, including late-callback suppression. */
export function createReactNativeFrameClock(options:{pending():boolean;poll():void;onError(error:unknown):void},scheduler:ReactNativeFrameScheduler={request:callback=>requestAnimationFrame(()=>callback()),cancel:id=>cancelAnimationFrame(id)}):FrameClock&{dispose():void} {
  let live=true,notification:number|undefined,pollFailed=false;
  const frames=new Set<{id:number;live:boolean}>();
  function schedule() {
    if(!live||pollFailed||notification!==undefined||!options.pending())return;
    notification=scheduler.request(()=>{
      notification=undefined;if(!live)return;
      try{options.poll();schedule();}catch(error){pollFailed=true;options.onError(error);}
    },error=>{notification=undefined;if(live){pollFailed=true;options.onError(error);}});
  }
  return {
    request(callback) {
      if(!live)throw new Error('React Native surface frame clock is closed');
      const frame={id:0,live:true};frames.add(frame);
      try{frame.id=scheduler.request(timing=>{frames.delete(frame);if(!live||!frame.live)return;frame.live=false;try{callback(timing);}finally{schedule();}},error=>{frames.delete(frame);if(live&&frame.live){frame.live=false;options.onError(error);}});}catch(error){frames.delete(frame);frame.live=false;throw error;}
      return {dispose(){if(!frame.live)return;frame.live=false;frames.delete(frame);scheduler.cancel(frame.id);}};
    },
    dispose(){if(!live)return;live=false;if(notification!==undefined){scheduler.cancel(notification);notification=undefined;}for(const frame of frames){frame.live=false;scheduler.cancel(frame.id);}frames.clear();},
  };
}
