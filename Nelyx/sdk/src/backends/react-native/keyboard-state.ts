// SPDX-License-Identifier: BSD-3-Clause
import type {ReactNativePlatform} from '@nelyx/core/hosting/platform';
import {LogicalKeyboardKey} from '@nelyx/core/services/keyboard-key';
import {scanCodeToPhysical,keyCodeToLogical} from '@nelyx/core/services/android-key-map';
import {windowsPhysicalKeyId,windowsLogicalKeyId} from '@nelyx/core/services/windows-engine-key-map';
import {StandardMethodCodec} from '@nelyx/core/services/message-codecs';
import {MissingPluginException,PlatformException} from '@nelyx/core/services/message-codec';
import type {PluginPlatformMessagePort} from '../../runtime/plugin-port.ts';

function invalid(message:string):never{throw new PlatformException({code:'native-keyboard-state',message});}
/** Native producer observations use actual VK/keyCode and scan fields. This
 * adapter maps only those observations; it does not infer globally held keys
 * or the native engine's complete critical-key/pressing-goal algorithm. */
export function decodeNativeKeyboardState(value:unknown,target:'windows'|'android'):ReadonlyMap<number,number>{
  if(!value||typeof value!=='object')return invalid('Native keyboard snapshot is not an object');
  const data=value as {protocol?:unknown;target?:unknown;keys?:unknown};
  if(data.protocol!==1||data.target!==target||!Array.isArray(data.keys)||data.keys.length>1024)return invalid('Native keyboard snapshot protocol/target/budget mismatch');
  const result=new Map<number,number>();
  for(const raw of data.keys){
    if(!raw||typeof raw!=='object')return invalid('Native keyboard observation is not an object');
    const {keyCode,scanCode}=raw as {keyCode?:unknown;scanCode?:unknown};
    if(typeof keyCode!=='number'||typeof scanCode!=='number'||!Number.isSafeInteger(keyCode)||!Number.isSafeInteger(scanCode)||keyCode<0||keyCode>0xffff||scanCode<0||scanCode>0xffff)return invalid('Native keyboard key/scan fields are invalid');
    if(target==='windows'&&keyCode===0xe5)continue; // Same paired PROCESSKEY skip as current raw ingress.
    const physical=target==='windows'?(scanCode===0?LogicalKeyboardKey.windowsPlane+keyCode:windowsPhysicalKeyId(scanCode)):(scanCode===0?LogicalKeyboardKey.androidPlane+keyCode:scanCodeToPhysical.get(scanCode)??LogicalKeyboardKey.androidPlane+scanCode);
    const logical=target==='windows'?windowsLogicalKeyId(keyCode,scanCode):keyCodeToLogical.get(keyCode)??LogicalKeyboardKey.androidPlane+keyCode;
    const previous=result.get(physical);if(previous!==undefined&&previous!==logical)return invalid('Native observations have ambiguous physical identities');
    result.set(physical,logical);
  }
  return result;
}

/** Register the actual optional Flutter method before ServicesBinding.ready. */
export function installNativeKeyboardState(port:PluginPlatformMessagePort,modules:Readonly<Record<string,unknown>>,target:ReactNativePlatform):void{
  const candidate=target==='windows'?modules.RNSkiaModule:target==='android'?modules.NelyxPlatformServices:undefined;
  const module=candidate&&typeof candidate==='object'?candidate as {getKeyboardState?:()=>PromiseLike<unknown>}:undefined;
  port.registerMethod('flutter/keyboard',new StandardMethodCodec(),async(call,{signal})=>{
    if(call.method!=='getKeyboardState'||signal.aborted||typeof module?.getKeyboardState!=='function'||target!=='windows'&&target!=='android')throw new MissingPluginException();
    let snapshot:unknown;
    try{snapshot=await module.getKeyboardState();}catch(error){if(signal.aborted)throw new MissingPluginException();throw error;}
    if(signal.aborted)throw new MissingPluginException();
    return decodeNativeKeyboardState(snapshot,target);
  });
}
