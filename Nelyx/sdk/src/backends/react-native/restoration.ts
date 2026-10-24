// SPDX-License-Identifier: BSD-3-Clause
import {MissingPluginException,PlatformException} from '@nelyx/core/services/message-codec';
import {StringCodec,StandardMethodCodec} from '@nelyx/core/services/message-codecs';
import type {PluginPlatformMessagePort} from '../../runtime/plugin-port.ts';
import {sha256} from '../sha256.ts';

const limit=4*1024*1024,alphabet='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
interface NativeStore {
  getRestorationProtocol?():number;
  readRestoration?(key:string):PromiseLike<string|null>;
  writeRestoration?(key:string,value:string):PromiseLike<boolean>;
}
function invalid(message:string):never{throw new PlatformException({code:'native-restoration-data',message});}
function encode(data:Uint8Array):string{
  const chunks:string[]=[];let chunk='';
  for(let index=0;index<data.length;index+=3){const a=data[index]!,b=data[index+1],c=data[index+2];chunk+=alphabet[a>>>2]!+alphabet[((a&3)<<4)|((b??0)>>>4)]!+(b===undefined?'=':alphabet[((b&15)<<2)|((c??0)>>>6)]!)+(c===undefined?'=':alphabet[c&63]!);if(chunk.length>=8192){chunks.push(chunk);chunk='';}}
  chunks.push(chunk);return chunks.join('');
}
function decode(value:string):Uint8Array{
  if(value.length>Math.ceil(limit/3)*4||value.length%4!==0)return invalid('Stored restoration data exceeds its budget or has invalid base64 length');
  const padding=value.endsWith('==')?2:value.endsWith('=')?1:0,length=value.length/4*3-padding;if(length>limit)return invalid('Stored restoration data exceeds 4 MiB');
  const data=new Uint8Array(length);let offset=0;
  for(let index=0;index<value.length;index+=4){const last=index+4===value.length,parts=[0,0,0,0];
    for(let part=0;part<4;part++){const character=value[index+part]!;if(last&&part>=4-padding){if(character!=='=')return invalid('Malformed restoration padding');}else{const digit=alphabet.indexOf(character);if(digit<0)return invalid('Malformed restoration base64');parts[part]=digit;}}
    if(last&&(padding===2&&(parts[1]!&15)!==0||padding===1&&(parts[2]!&3)!==0))return invalid('Noncanonical restoration base64');
    const word=(parts[0]!<<18)|(parts[1]!<<12)|(parts[2]!<<6)|parts[3]!;data[offset++]=(word>>>16)&255;if(offset<length)data[offset++]=(word>>>8)&255;if(offset<length)data[offset++]=word&255;
  }
  return data;
}
/** Native IO acknowledges the durable replacement before an admitted write drains. */
export function installNativeRestoration(port:PluginPlatformMessagePort,candidate:unknown,applicationKey:string):void{
  if(!applicationKey||applicationKey.length>256)throw new TypeError('Restoration requires a bounded application key');
  const encodedKey=new StringCodec().encodeMessage(applicationKey)!;
  const key=sha256(new Uint8Array(encodedKey.buffer,encodedKey.byteOffset,encodedKey.byteLength)),host=candidate as NativeStore|undefined;
  // Keep admission order even when independently supplied native promises differ.
  let tail:Promise<void>=Promise.resolve();
  port.registerMethod('flutter/restoration',new StandardMethodCodec(),(call,{signal})=>{
    if(call.method!=='get'&&call.method!=='put')throw new MissingPluginException();
    let captured:Uint8Array|undefined;
    if(call.method==='put'){if(!(call.arguments instanceof Uint8Array)||call.arguments.length>limit)return invalid('Restoration put requires at most 4 MiB of bytes');captured=new Uint8Array(call.arguments);}
    if(host?.getRestorationProtocol?.()!==1||typeof host.readRestoration!=='function'||typeof host.writeRestoration!=='function')throw new PlatformException({code:'native-restoration-cohort',message:'Restoration protocol1 requires matching rebuilt SDK native sources'});
    const task=tail.then(async()=>{
      if(signal.aborted)throw new PlatformException({code:'closed-owner',message:'Restoration owner is closing'});
      if(call.method==='get'){
        const operation=host.readRestoration!(key);if(!operation||typeof operation.then!=='function')return invalid('Native restoration read requires an acknowledgement');
        const value=await operation;if(value!==null&&typeof value!=='string')return invalid('Native restoration read must return base64 or null');
        if(signal.aborted)throw new PlatformException({code:'closed-owner',message:'Restoration owner closed during read'});
        return new Map<string,unknown>([['enabled',true],['data',value===null?null:decode(value)]]);
      }
      const operation=host.writeRestoration!(key,encode(captured!));if(!operation||typeof operation.then!=='function')return invalid('Native restoration write requires an acknowledgement');
      if(await operation!==true)return invalid('Native restoration write was not committed');return null;
    });tail=task.then(()=>{},()=>{});return task;
  });
}
