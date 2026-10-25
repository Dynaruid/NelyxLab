// SPDX-License-Identifier: BSD-3-Clause
import {PluginPlatformMessagePort} from '../../runtime/plugin-port.ts';
import {installOsServices} from '../../runtime/os-services.ts';
import {MissingPluginException} from '@nelyx/core/services/message-codec';
import type {NativeHermesBridge} from './bridge.ts';
import {installNativeKeyboardState} from '../../runtime/native-keyboard-state.ts';
import {installNativeAccessibility} from '../../runtime/native-accessibility.ts';
import {StandardMethodCodec} from '@nelyx/core/services/message-codecs';
export function createNativeServices(bridge:NativeHermesBridge){
  const port=new PluginPlatformMessagePort(),pending=new Map<number,{resolve(value:string):void;reject(error:Error):void}>();let sequence=0,changed:(()=>void)|undefined;
  const request=(kind:string,value='')=>new Promise<string>((resolve,reject)=>{if(pending.size>=64)throw new Error('Native service admission exceeds64');const id=++sequence;pending.set(id,{resolve,reject});try{bridge.service(id,kind,value);}catch(error){pending.delete(id);reject(error);}});
  installNativeKeyboardState(port,{getKeyboardState:async()=>({protocol:1,target:'windows',keys:bridge.pressedKeys()})},'windows');
  const accessibility={getAccessibilityProtocol:()=>1,async dispatchAccessibilityEvent(_root:number,_target:number,_type:string,message:string|null){await request('announce',message??'');return true;}};
  installNativeAccessibility(port,()=>accessibility,'windows',{viewId:0,isLive:()=>true,rootTag:()=>1,nodeTag:()=>null});
  port.registerMethod('flutter/mousecursor',new StandardMethodCodec(),async call=>{const args=call.arguments;if(call.method!=='activateSystemCursor')throw new MissingPluginException();if(!(args instanceof Map)||!Number.isSafeInteger(args.get('device'))||typeof args.get('kind')!=='string'||args.get('kind').length>64)throw new TypeError('Invalid native system cursor');await request('cursor',args.get('kind'));return null;});
  installOsServices(port,{
    readEnvironment:()=>bridge.environment(),
    observe(update,_pressure,failed){changed=update;let previous=JSON.stringify(bridge.environment());const timer=setInterval(()=>{try{const next=JSON.stringify(bridge.environment());if(next!==previous){previous=next;update();}}catch(error){failed(error);}},1000);return {dispose(){clearInterval(timer);changed=undefined;}};},
    readText:()=>request('clipboard-read'),writeText:async text=>{await request('clipboard-write',text);},hasStrings:async()=>(await request('clipboard-read')).length>0,
    pop:()=>{bridge.requestClose();},
    navigation(method){if(['getRouteInformation','selectSingleEntryHistory','selectMultiEntryHistory','routeInformationUpdated'].includes(method))return null;throw new MissingPluginException();},
  });
  return {port,event(value:unknown){const reply=value as {id:number;value:string;error:string};const operation=pending.get(reply.id);if(!operation)return false;pending.delete(reply.id);if(reply.error)operation.reject(new Error(reply.error));else operation.resolve(reply.value);return true;},environmentChanged(){changed?.();}};
}
