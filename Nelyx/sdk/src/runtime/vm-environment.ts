// SPDX-License-Identifier: BSD-3-Clause
/** VM-local ports. No OS handle, JSI value, or adapter registry crosses here. */
export interface VmEnvironmentPorts {
  now():number;
  setTimer(callback:()=>void,delay:number,repeat:boolean):number;
  clearTimer(id:number):void;
  requestFrame(callback:(tick:number)=>void):number;
  cancelFrame(id:number):void;
  queueMicrotask(callback:()=>void):void;
  trackRejections(onUnhandled:(error:unknown)=>void):void;
  fail(message:string):void;
  log(message:string):void;
}
export interface VmConstructors {readonly AbortController:unknown;readonly AbortSignal:unknown;}
export interface VmEnvironment {
  readonly state:'open'|'closing'|'closed';
  claimApplication():void;
  reportError(error:unknown):void;
  /** Fence app callbacks immediately. Native completion/retirement ports stay live. */
  beginClose():void;
  /** Internal drain work has a separate admission path while app timers stop. */
  readonly retirement:{now():number;delay(milliseconds:number):Promise<void>};
  dispose():void;
}
const environments=new WeakMap<object,{ports:VmEnvironmentPorts;owner:VmEnvironment}>();
const methods=['now','setTimer','clearTimer','requestFrame','cancelFrame','queueMicrotask','trackRejections','fail','log'] as const;

/** Console/error formatting is best effort; cycles, BigInt, toJSON and hostile
 * getters must not turn reporting the original error into a second failure. */
export function formatVmValue(value:unknown):string {
  try {
    if(value instanceof Error){const detail=value.stack??value.message;return typeof detail==='string'?detail:String(detail);}
    if(typeof value==='string')return value;
    if(typeof value!=='object'||value===null)return String(value);
    const seen=new WeakSet<object>();
    return JSON.stringify(value,(_key,item:unknown)=>{
      if(typeof item==='bigint')return String(item)+'n';
      if(item!==null&&typeof item==='object'){if(seen.has(item))return '[Circular]';seen.add(item);}
      return item;
    })??String(value);
  }catch{return '<unprintable>';}
}

/** Install once, before loading application modules. Closing a VM never
 * reopens it or restores a previous app's callbacks. Web/RN keep their host's
 * environment; native embedders provide these small explicit ports instead. */
export function installVmEnvironment(target:Record<string,unknown>,ports:VmEnvironmentPorts,constructors:VmConstructors):VmEnvironment {
  const previous=environments.get(target);
  if(previous){if(previous.ports!==ports)throw new Error('VM environment already has a host owner');return previous.owner;}
  for(const method of methods)if(typeof ports[method]!=='function')throw new Error('Missing VM environment port: '+method);
  let state:VmEnvironment['state']='open',claimed=false,live=true,cancelledTimer=0;
  const stopErrors:unknown[]=[];
  const timers=new Map<number,object>(),frames=new Map<number,object>(),retirement=new Set<number>();
  const assertOpen=()=>{if(state!=='open')throw new Error('VM application callbacks are closed');};
  const callback=(value:unknown):((...args:unknown[])=>void)=>{if(typeof value!=='function')throw new TypeError('VM callback must be a function');return value as (...args:unknown[])=>void;};
  const delay=(value:unknown)=>{const number=Number(value);return Number.isFinite(number)?Math.min(2147483647,Math.max(0,number)):0;};
  const report=(error:unknown)=>{if(!live)return;let message=formatVmValue(error);try{stopApplication();}catch(cleanup){message+='\nVM callback cancellation: '+formatVmValue(cleanup);}ports.fail(message);};
  const cancel=(owners:Map<number,object>,stop:(id:number)=>void,errors:unknown[])=>{const ids=[...owners.keys()];owners.clear();for(const id of ids)try{stop(id);}catch(error){errors.push(error);}};
  const throwFailures=(errors:unknown[])=>{if(errors.length===1)throw errors[0];if(errors.length)throw new AggregateError(errors,'VM callback retirement failed');};
  const stopApplication=()=>{
    if(state!=='open'){throwFailures(stopErrors);return;}state='closing';
    cancel(timers,id=>ports.clearTimer(id),stopErrors);cancel(frames,id=>ports.cancelFrame(id),stopErrors);throwFailures(stopErrors);
  };
  const owner:VmEnvironment=Object.freeze({
    get state(){return state;},
    claimApplication(){assertOpen();if(claimed)throw new Error('VM already has an application owner');claimed=true;},
    reportError:report,
    beginClose:stopApplication,
    retirement:Object.freeze({now:()=>ports.now(),delay(milliseconds:number){
      if(state==='closed')return Promise.reject(new Error('VM retirement port is closed'));
      return new Promise<void>((resolve,reject)=>{
        let id:number;try{id=ports.setTimer(()=>{if(!retirement.delete(id))return;resolve();},delay(milliseconds),false);retirement.add(id);}catch(error){reject(error);}
      });
    }}),
    dispose(){
      if(state==='closed')return;
      const errors:unknown[]=[];try{stopApplication();}catch(error){errors.push(error);}
      // A failed drain keeps its timer/VM dependencies. The embedder must not
      // destroy the runtime while an internal retirement callback is pending.
      if(retirement.size){errors.push(new Error('VM still has pending retirement work'));throwFailures(errors);return;}
      throwFailures(errors);state='closed';live=false;
    },
  });
  const timer=(repeat:boolean,value:unknown,milliseconds:unknown,args:unknown[])=>{
    const run=callback(value);
    // Hermes' pinned Promise tracker calls the global timer even for a
    // rejection that is handled synchronously during shutdown. Return an inert
    // handle after the fence, without retaining or executing a new callback.
    // Throwing here would replace the original shutdown error in the VM.
    if(state!=='open'){if(cancelledTimer<=-Number.MAX_SAFE_INTEGER)throw new Error('Cancelled VM timer ID exhausted');return --cancelledTimer;}
    const token={},wait=delay(milliseconds);
    const id=ports.setTimer(()=>{if(state!=='open'||timers.get(id)!==token)return;if(!repeat)timers.delete(id);try{run(...args);}catch(error){report(error);}},wait,repeat);
    timers.set(id,token);return id;
  };
  const clear=(id:number)=>{if(timers.delete(id))ports.clearTimer(id);};
  const format=(values:unknown[])=>values.map(formatVmValue).join(' ');
  const values:Record<string,unknown>={
    AbortController:constructors.AbortController,AbortSignal:constructors.AbortSignal,
    performance:Object.freeze({now:()=>ports.now(),timeOrigin:Date.now()-ports.now()}),
    setTimeout:(run:unknown,milliseconds=0,...args:unknown[])=>timer(false,run,milliseconds,args),
    setInterval:(run:unknown,milliseconds=0,...args:unknown[])=>timer(true,run,milliseconds,args),
    clearTimeout:clear,clearInterval:clear,
    requestAnimationFrame:(value:unknown)=>{assertOpen();const run=callback(value),token={};const id=ports.requestFrame(tick=>{if(state!=='open'||frames.get(id)!==token)return;frames.delete(id);try{run(tick);}catch(error){report(error);}});frames.set(id,token);return id;},
    cancelAnimationFrame:(id:number)=>{if(frames.delete(id))ports.cancelFrame(id);},
    queueMicrotask:(value:unknown)=>{assertOpen();const run=callback(value);ports.queueMicrotask(()=>{if(state==='open')try{run();}catch(error){report(error);}});},
    console:Object.freeze({...Object.fromEntries(['log','info','warn','error','debug','trace'].map(name=>[name,(...items:unknown[])=>ports.log(format(items))])),assert:(condition:unknown,...items:unknown[])=>{if(!condition)ports.log('Assertion failed: '+format(items));}}),
  };
  const descriptors=new Map<string,PropertyDescriptor|undefined>();
  for(const name of Object.keys(values)){const descriptor=Object.getOwnPropertyDescriptor(target,name);if(descriptor&&!descriptor.configurable)throw new Error('VM global is not configurable: '+name);descriptors.set(name,descriptor);}
  try{
    ports.trackRejections(report);
    for(const [name,value]of Object.entries(values))Object.defineProperty(target,name,{value,writable:true,configurable:true,enumerable:true});
    environments.set(target,{ports,owner});return owner;
  }catch(error){
    live=false;for(const [name,descriptor]of descriptors)if(descriptor)Object.defineProperty(target,name,descriptor);else delete target[name];throw error;
  }
}
