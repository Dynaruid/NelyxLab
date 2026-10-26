// SPDX-License-Identifier: BSD-3-Clause
import {nativeHermesBridge} from './bridge.ts';
import {AbortController,AbortSignal} from 'abort-controller';
import {installVmEnvironment,formatVmValue} from '../../runtime/vm-environment.ts';
const bridge=nativeHermesBridge();
/** Startup can reject after its VM environment has already retired. Report
 * through the host directly, with the same non-throwing error formatter. */
export function failNativeHermesStartup(error:unknown):void{bridge.fail(formatVmValue(error));}
const hermes=(globalThis as unknown as {HermesInternal?:{enablePromiseRejectionTracker(options:{allRejections:boolean;onUnhandled(id:number,error:unknown):void;onHandled(id:number):void}):void}}).HermesInternal;
if(typeof hermes?.enablePromiseRejectionTracker!=='function')throw new Error('Native Hermes requires observable Promise rejection tracking');
/** One VM owner, installed before app module evaluation by the generated entry. */
export const nativeHermesEnvironment=installVmEnvironment(globalThis as unknown as Record<string,unknown>,{
  now:()=>bridge.now(),setTimer:(run,delay,repeat)=>bridge.setTimer(run,delay,repeat),clearTimer:id=>bridge.clearTimer(id),
  requestFrame:run=>bridge.requestFrame(run),cancelFrame:id=>bridge.cancelFrame(id),queueMicrotask:run=>bridge.queueMicrotask(run),
  trackRejections:onUnhandled=>hermes.enablePromiseRejectionTracker({allRejections:true,onUnhandled:(_id,error)=>onUnhandled(error),onHandled:()=>{}}),
  fail:message=>bridge.fail(message),log:message=>bridge.log(message),
},{AbortController,AbortSignal});
