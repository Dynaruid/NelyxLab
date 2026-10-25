// SPDX-License-Identifier: BSD-3-Clause
import {nativeHermesBridge} from './bridge.ts';
import {AbortController,AbortSignal} from 'abort-controller';
const bridge=nativeHermesBridge();
const globals=globalThis as unknown as Record<string,unknown>;
globals.AbortController=AbortController;globals.AbortSignal=AbortSignal;
globals.performance=Object.freeze({now:()=>bridge.now(),timeOrigin:Date.now()-bridge.now()});
globals.setTimeout=(callback:(...args:unknown[])=>void,delay=0,...args:unknown[])=>bridge.setTimer(()=>callback(...args),Math.max(0,Number(delay)||0),false);
globals.setInterval=(callback:(...args:unknown[])=>void,delay=0,...args:unknown[])=>bridge.setTimer(()=>callback(...args),Math.max(0,Number(delay)||0),true);
globals.clearTimeout=globals.clearInterval=(id:number)=>bridge.clearTimer(id);
globals.requestAnimationFrame=(callback:(time:number)=>void)=>bridge.requestFrame(tick=>callback(tick));
globals.cancelAnimationFrame=(id:number)=>bridge.cancelFrame(id);
globals.queueMicrotask=(callback:()=>void)=>{void Promise.resolve().then(callback).catch(error=>bridge.fail(String(error)));};
const hermes=(globalThis as unknown as {HermesInternal?:{enablePromiseRejectionTracker(options:{allRejections:boolean;onUnhandled(id:number,error:unknown):void;onHandled(id:number):void}):void}}).HermesInternal;
if(!hermes?.enablePromiseRejectionTracker)throw new Error('Native Hermes requires observable Promise rejection tracking');
hermes.enablePromiseRejectionTracker({allRejections:true,onUnhandled:(_id,error)=>bridge.fail(error instanceof Error?error.stack??error.message:String(error)),onHandled:()=>{}});
const format=(values:unknown[])=>values.map(value=>value instanceof Error?value.stack??value.message:typeof value==='string'?value:JSON.stringify(value)).join(' ');
globals.console=Object.freeze({...Object.fromEntries(['log','info','warn','error','debug','trace'].map(name=>[name,(...values:unknown[])=>bridge.log(format(values))])),assert:(condition:unknown,...values:unknown[])=>{if(!condition)bridge.log('Assertion failed: '+format(values));}});
