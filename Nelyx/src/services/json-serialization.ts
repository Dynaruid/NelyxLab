// SPDX-License-Identifier: BSD-3-Clause
import {diagnosticDoubleString} from '../foundation/debug.ts';
import {FormatException} from './message-codec.ts';
class JsonUnsupportedObjectError extends Error{constructor(message:string){super(message);this.name='JsonUnsupportedObjectError';}}
function codePoints(value:string,visit:(point:number)=>void):void{for(let i=0;i<value.length;i++){let point=value.charCodeAt(i);if(point>=0xd800&&point<=0xdbff){const next=value.charCodeAt(i+1);if(next>=0xdc00&&next<=0xdfff){point=0x10000+((point-0xd800)<<10)+(next-0xdc00);i++;}else point=0xfffd;}else if(point>=0xdc00&&point<=0xdfff)point=0xfffd;visit(point);}}
export function encodeUtf8(value:string):Uint8Array{let count=0;codePoints(value,p=>count+=p<0x80?1:p<0x800?2:p<0x10000?3:4);const bytes=new Uint8Array(count);let at=0;codePoints(value,p=>{if(p<0x80)bytes[at++]=p;else if(p<0x800){bytes[at++]=0xc0|(p>>6);bytes[at++]=0x80|(p&63);}else if(p<0x10000){bytes[at++]=0xe0|(p>>12);bytes[at++]=0x80|((p>>6)&63);bytes[at++]=0x80|(p&63);}else{bytes[at++]=0xf0|(p>>18);bytes[at++]=0x80|((p>>12)&63);bytes[at++]=0x80|((p>>6)&63);bytes[at++]=0x80|(p&63);}});return bytes;}
export function decodeUtf8(bytes:Uint8Array):string{let at=bytes.length>=3&&bytes[0]===0xef&&bytes[1]===0xbb&&bytes[2]===0xbf?3:0;const parts:string[]=[],units:number[]=[];const fail=():never=>{throw new FormatException('Invalid UTF-8 at offset '+at);};while(at<bytes.length){const first=bytes[at++]!;let point:number,count:number;if(first<0x80){point=first;count=0;}else if(first>=0xc2&&first<=0xdf){point=first&31;count=1;}else if(first>=0xe0&&first<=0xef){point=first&15;count=2;}else if(first>=0xf0&&first<=0xf4){point=first&7;count=3;}else return fail();if(at+count>bytes.length)return fail();for(let i=0;i<count;i++){const next=bytes[at++]!;if(next<0x80||next>0xbf)return fail();point=(point<<6)|(next&63);}if(count===2&&point<0x800||count===3&&point<0x10000||point>0x10ffff||point>=0xd800&&point<=0xdfff)return fail();if(point<0x10000)units.push(point);else{point-=0x10000;units.push(0xd800|(point>>10),0xdc00|(point&1023));}if(units.length>=1024){parts.push(String.fromCharCode(...units));units.length=0;}}parts.push(String.fromCharCode(...units));return parts.join('');}
/** JSON integers use bigint, while JavaScript number represents Dart double. */
export class JsonUtf8Encoder{
  convert(value:unknown):Uint8Array{const active=new Set<object>();function encode(value:unknown):string{
    if(value===null)return 'null';if(typeof value==='string'||typeof value==='boolean')return JSON.stringify(value);if(typeof value==='bigint'){if(value<BigInt('-9223372036854775808')||value>BigInt('9223372036854775807'))throw new JsonUnsupportedObjectError('JSON integer must fit the signed-int64 adapter domain');return value.toString();}if(typeof value==='number'){if(!Number.isFinite(value))throw new JsonUnsupportedObjectError('JSON cannot encode a non-finite number');return diagnosticDoubleString(value);}
    if(typeof value!=='object')throw new JsonUnsupportedObjectError('Unsupported JSON value');if(active.has(value))throw new JsonUnsupportedObjectError('Cyclic JSON value');active.add(value);try{
      if(Array.isArray(value))return '['+Array.from(value,encode).join(',')+']';
      if(ArrayBuffer.isView(value)&&!(value instanceof DataView)){const floating=value instanceof Float32Array||value instanceof Float64Array;return '['+Array.from(value as unknown as Iterable<number|bigint>,item=>encode(floating?item:BigInt(item))).join(',')+']';}
      if(value instanceof Map){const entries:string[]=[];for(const [key,item]of value){if(typeof key!=='string')throw new JsonUnsupportedObjectError('JSON object keys must be strings');entries.push(JSON.stringify(key)+':'+encode(item));}return '{'+entries.join(',')+'}';}
      const custom=(value as {toJson?:unknown}).toJson;if(typeof custom==='function'){let converted:unknown;try{converted=custom.call(value);}catch{throw new JsonUnsupportedObjectError('JSON toJson conversion failed');}return encode(converted);}
      if(Object.getPrototypeOf(value)!==Object.prototype&&Object.getPrototypeOf(value)!==null)throw new JsonUnsupportedObjectError('Unsupported JSON value');
      return '{'+Object.keys(value).map(key=>JSON.stringify(key)+':'+encode((value as Record<string,unknown>)[key])).join(',')+'}';
    }finally{active.delete(value);}
  }return encodeUtf8(encode(value));}
}
/** Native JSON.parse loses int64 precision; retain numeric tokens before conversion. */
export class JsonMessageDecoder{
  convert(bytes:Uint8Array):unknown{const text=decodeUtf8(bytes);let at=0;const fail=():never=>{throw new FormatException('Invalid JSON at offset '+at);},space=()=>{while(at<text.length&&' \t\r\n'.includes(text[at]!))at++;};
    function string():string{const start=at++;while(at<text.length){const char=text[at++]!;if(char==='"'){try{return JSON.parse(text.slice(start,at)) as string;}catch{return fail();}}if(char==='\\')at++;}return fail();}
    function value():unknown{space();const char=text[at];if(char==='"')return string();if(char==='['){at++;const result:unknown[]=[];space();if(text[at]===']'){at++;return result;}while(true){result.push(value());space();if(text[at]===']'){at++;return result;}if(text[at++]!==',')return fail();}}
      if(char==='{'){at++;const result=new Map<string,unknown>();space();if(text[at]==='}'){at++;return result;}while(true){space();if(text[at]!=='"')return fail();const key=string();space();if(text[at++]!==':')return fail();result.set(key,value());space();if(text[at]==='}'){at++;return result;}if(text[at++]!==',')return fail();}}
      for(const [token,result]of [['null',null],['true',true],['false',false]] as const)if(text.startsWith(token,at)){at+=token.length;return result;}
      const token=/^-?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?(?:[eE][+-]?[0-9]+)?/.exec(text.slice(at))?.[0];if(!token)return fail();at+=token.length;if(!/[.eE]/.test(token)){const integer=BigInt(token);if(integer>=BigInt('-9223372036854775808')&&integer<=BigInt('9223372036854775807'))return integer;}return Number(token);
    }
    const result=value();space();if(at!==text.length)fail();return result;
  }
}
