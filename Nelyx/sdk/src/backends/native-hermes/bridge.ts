// SPDX-License-Identifier: BSD-3-Clause
import type {ViewMetrics} from '@nelyx/core/ui/types';
import type {OsEnvironment} from '../../runtime/os-services.ts';
export interface NativeHermesBridge {
  readonly abi:1;readonly mode:'bytecode'|'static-aot';readonly assetRoot:string;readonly diagnostics?:boolean;
  now():number;metrics():Omit<ViewMetrics,'nativeContextGeneration'>;
  listen(callback:(kind:string,value:unknown)=>boolean|void):void;
  publishSemantics(update:NativeSemanticsUpdate):void;
  editor(kind:string,packet:Readonly<Record<string,unknown>>):void;
  environment():OsEnvironment;service(id:number,kind:string,value:string):void;requestClose():void;
  pressedKeys():readonly {readonly keyCode:number;readonly scanCode:number}[];
  setTimer(callback:()=>void,delay:number,repeat:boolean):number;clearTimer(id:number):void;
  requestFrame(callback:(tick:number,dispatch:number)=>void):number;cancelFrame(id:number):void;
  completeShutdown():void;fail(message:string):void;log(message:string):void;
}
export interface NativeSemanticsUpdate {readonly protocol:1;readonly owner:{readonly id:string;readonly generation:number};readonly commit:number;readonly viewport:number;readonly surface:number;readonly upserts:readonly unknown[];readonly removed:readonly string[];readonly order:readonly string[];}
export function nativeHermesBridge():NativeHermesBridge {
  const value=(globalThis as unknown as {NelyxNativeHost:NativeHermesBridge}).NelyxNativeHost;
  if(!value||value.abi!==1||!['bytecode','static-aot'].includes(value.mode)||typeof value.listen!=='function'||typeof value.requestFrame!=='function')throw new Error('A matching native Hermes host is required');
  return value;
}
