// SPDX-License-Identifier: BSD-3-Clause
import {JSONMethodCodec} from '@nelyx/core/services/message-codecs';
import {MissingPluginException,PlatformException} from '@nelyx/core/services/message-codec';
import type {PluginPlatformMessagePort} from './plugin-port.ts';
interface NativeAutofill {getAutofillProtocol?():number;getAutofillCapabilities?(rootTag:number):PromiseLike<unknown>;requestAutofill?(rootTag:number):PromiseLike<unknown>;finishAutofillContext?(rootTag:number,shouldSave:boolean):PromiseLike<unknown>}
const unavailable=(reason:string)=>new Map<string,unknown>([['status','unavailable'],['scope','unavailable'],['reason',reason]]);
function invalid(message:string):never{throw new PlatformException({code:'native-autofill-data',message});}
function object(value:unknown):Record<string,unknown>{if(!value||typeof value!=='object'||Array.isArray(value))return invalid('Autofill native acknowledgement must be an object');return value as Record<string,unknown>;}
function outcome(value:unknown):Map<string,unknown>{const item=object(value);if(item.protocol!==1||!['requested','unavailable'].includes(item.status as string)||!['activity','unavailable'].includes(item.scope as string)||!(item.reason===null||typeof item.reason==='string'&&item.reason.length<=256)||item.status==='requested'&&item.scope!=='activity')return invalid('Invalid native autofill request acknowledgement');return new Map([['status',item.status],['scope',item.scope],['reason',item.reason]]);}
function capability(value:unknown):Map<string,unknown>{const item=object(value);if(item.protocol!==1||typeof item.hints!=='boolean'||!['activity','section','unavailable'].includes(item.groups as string)||typeof item.request!=='boolean'||typeof item.finish!=='boolean'||!['activity','unavailable'].includes(item.scope as string)||!['enabled','disabled','unknown'].includes(item.provider as string)||(item.request||item.finish)&&item.scope!=='activity')return invalid('Invalid native autofill capability acknowledgement');return new Map(Object.entries(item));}
/** Owns admitted native operations through completion, then cancels its OS context once. */
export function installAutofillMessages(port:PluginPlatformMessagePort,target:string,candidate?:unknown,view?:{readonly isLive:()=>boolean;readonly rootTag:()=>number|null}):void{
  const host=candidate as NativeAutofill|undefined;let admittedRoot:number|null=null;let closed=false,tail:Promise<void>=Promise.resolve(),closing:Promise<void>|undefined;
  const supported=()=>host?.getAutofillProtocol?.()===2&&typeof host.getAutofillCapabilities==='function'&&typeof host.requestAutofill==='function'&&typeof host.finishAutofillContext==='function';
  const root=()=>{const tag=view?.isLive()?view.rootTag():null;if(tag===null)return null;if(!Number.isSafeInteger(tag)||tag<=0||tag>0x7fffffff)return invalid('Invalid native autofill View tag');if(admittedRoot!==null&&admittedRoot!==tag)return invalid('Native autofill View changed without remount');return admittedRoot=tag;};
  if(supported()&&view){const tag=view.rootTag();if(tag!==null){if(!Number.isSafeInteger(tag)||tag<=0||tag>0x7fffffff)return invalid('Invalid native autofill View tag');admittedRoot=tag;}}
  const acknowledged=async(operation:unknown)=>{if(!operation||typeof (operation as {then?:unknown}).then!=='function')return invalid('Autofill native operation requires a completion acknowledgement');return await operation;};
  port.registerMethod('flutter/textinput',new JSONMethodCodec(),(call,{signal})=>{
    if(!['TextInput.getAutofillCapabilities','TextInput.requestAutofill','TextInput.finishAutofillContext'].includes(call.method))throw new MissingPluginException();
    if(call.method==='TextInput.finishAutofillContext'?typeof call.arguments!=='boolean':call.arguments!==null)throw new PlatformException({code:'invalid-arguments',message:'Invalid autofill method arguments'});
    const task=tail.then(async()=>{
      if(closed||signal.aborted)return unavailable('closed');
      const rootTag=supported()?root():null;
      if(rootTag===null){
        if(call.method==='TextInput.getAutofillCapabilities')return new Map<string,unknown>([['protocol',1],['hints',target==='web'||target==='ios'||target==='macos'],['groups',target==='web'?'section':'unavailable'],['request',false],['finish',false],['scope','unavailable'],['provider','unknown']]);
        return unavailable('no-native-context-api');
      }
      if(call.method==='TextInput.getAutofillCapabilities')return capability(await acknowledged(host!.getAutofillCapabilities!(rootTag)));
      const value=call.method==='TextInput.requestAutofill'?host!.requestAutofill!(rootTag):host!.finishAutofillContext!(rootTag,call.arguments as boolean);return outcome(await acknowledged(value));
    });tail=task.then(()=>{},()=>{});return task;
  });
  port.own({dispose(){if(closing)return closing;let resolve!:()=>void,reject!:(error:unknown)=>void;closing=new Promise<void>((done,fail)=>{resolve=done;reject=fail;});closed=true;void Promise.resolve().then(async()=>{await tail;if(supported()&&admittedRoot!==null)outcome(await acknowledged(host!.finishAutofillContext!(admittedRoot,false)));}).then(resolve,reject);return closing;}});
}
