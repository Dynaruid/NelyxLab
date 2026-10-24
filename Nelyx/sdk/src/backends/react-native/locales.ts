// SPDX-License-Identifier: BSD-3-Clause
import {PlatformException} from '@nelyx/core/services/message-codec';
export interface NativeLocaleModule {getPreferredLocales():unknown;popSystemNavigator?(animated:boolean):PromiseLike<void>|void}
export function nativeLocaleModule(value:unknown):NativeLocaleModule|undefined {
  if(value===undefined||value===null)return undefined;
  if(typeof value!=='object'||typeof (value as NativeLocaleModule).getPreferredLocales!=='function')throw new PlatformException({code:'invalid-native-locale-port',message:'Preferred locale snapshot API is missing'});
  return value as NativeLocaleModule;
}
function posixTag(value:string):string {
  const [encoded,modifier]=value.split('@'),base=encoded!.split('.')[0]!;
  if(base==='C'||base==='POSIX')return 'und-x-posix-'+base.toLowerCase();
  const fields=base.split('_'),language=fields.shift()!,script=modifier==='latin'?'Latn':modifier==='cyrillic'?'Cyrl':undefined;
  let tag=[language,...(script?[script]:[]),...fields].join('-');
  if(modifier&&!script){if(!/^[a-zA-Z0-9_-]+$/.test(modifier))throw new PlatformException({code:'unsupported-locale',message:'Unsupported POSIX locale modifier: '+value});tag+='-x-posix-'+modifier.toLowerCase().split(/[_-]/).flatMap(part=>part.match(/.{1,8}/g)??[]).join('-');}
  return tag;
}
/** Preserve ordered preferences; C/POSIX remain undefined-language private tags. */
export function readNativeLocales(module:NativeLocaleModule):readonly string[]|null {
  const snapshot=module.getPreferredLocales();
  if(!snapshot||typeof snapshot!=='object')throw new PlatformException({code:'invalid-native-locale-port',message:'Invalid preferred locale snapshot'});
  const value=snapshot as {readonly error?:unknown;readonly locales?:unknown;readonly format?:unknown};
  if(value.error!==undefined)throw new PlatformException({code:'platform-error',message:String(value.error)});
  if(!Array.isArray(value.locales)||value.locales.length>256||!value.locales.every(item=>typeof item==='string'&&item.length>0&&item.length<=128)||!['bcp47','posix'].includes(value.format as string))throw new PlatformException({code:'invalid-native-locale-port',message:'Invalid preferred locale list/format'});
  const result:string[]=[],seen=new Set<string>();
  for(const raw of value.locales){const input=value.format==='posix'?posixTag(raw):raw;let tag:string;try{if(typeof Intl==='object'&&typeof Intl.getCanonicalLocales==='function')tag=Intl.getCanonicalLocales(input)[0]!;else{if(!/^[a-zA-Z0-9]{1,8}(?:-[a-zA-Z0-9]{1,8})*$/.test(input))throw new Error('Invalid tag');tag=input;}}catch{throw new PlatformException({code:'unsupported-locale',message:'Invalid native language tag: '+raw});}const identity=tag.toLowerCase();if(!seen.has(identity)){seen.add(identity);result.push(tag);}}
  return result.length?Object.freeze(result):null;
}
