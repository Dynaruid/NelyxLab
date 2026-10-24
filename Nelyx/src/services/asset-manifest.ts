// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
import {invariant} from '../foundation/errors.ts';
import {FoundationPlatform} from '../foundation/platform.ts';
import {StandardMessageCodec} from './message-codecs.ts';
import {encodeUtf8} from './json-serialization.ts';
import {AssetBundle,CachingAssetBundle} from './asset-bundle.ts';
const alphabet='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
function encode64(data:Uint8Array):string{let result='';for(let i=0;i<data.length;i+=3){const a=data[i]!,b=data[i+1]??0,c=data[i+2]??0;result+=alphabet[a>>2]!+alphabet[((a&3)<<4)|(b>>4)]!+(i+1<data.length?alphabet[((b&15)<<2)|(c>>6)]!:'=')+(i+2<data.length?alphabet[c&63]!:'=');}return result;}
function decode64(value:string):Uint8Array{invariant(value.length%4===0&&/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value),'invalid-asset-manifest','Malformed base64 asset manifest');const bytes:number[]=[];for(let i=0;i<value.length;i+=4){const n=(alphabet.indexOf(value[i]!)<<18)|(alphabet.indexOf(value[i+1]!)<<12)|((value[i+2]==='='?0:alphabet.indexOf(value[i+2]!))<<6)|(value[i+3]==='='?0:alphabet.indexOf(value[i+3]!));bytes.push((n>>16)&255);if(value[i+2]!=='=')bytes.push((n>>8)&255);if(value[i+3]!=='=')bytes.push(n&255);}return Uint8Array.from(bytes);}
/** SDK root bundles supply the pin's JSON(base64(binary)) Web representation. */
export function assetManifestWebBytes(binary:Uint8Array):Uint8Array{return encodeUtf8(JSON.stringify(encode64(binary)));}
export class AssetMetadata {constructor(readonly key:string,readonly targetDevicePixelRatio:number|null,readonly main:boolean){}}
export abstract class AssetManifest {
  static tryGetFromAssetBundle(bundle:AssetBundle):AssetManifest|null{const web=FoundationPlatform.hostEnvironment.kind==='web';return bundle instanceof CachingAssetBundle?bundle.peekStructuredData<AssetManifest>(web?'AssetManifest.bin.json':'AssetManifest.bin',{binary:!web})??null:null;}
  static loadFromAssetBundle(bundle:AssetBundle):Promise<AssetManifest>{if(FoundationPlatform.hostEnvironment.kind==='web')return bundle.loadStructuredData('AssetManifest.bin.json',text=>{const value:unknown=JSON.parse(text);invariant(typeof value==='string','invalid-asset-manifest','Web asset manifest must contain a base64 string');return _AssetManifestBin.fromStandardMessageCodecMessage(decode64(value));});return bundle.loadStructuredBinaryData('AssetManifest.bin',_AssetManifestBin.fromStandardMessageCodecMessage);}
  abstract listAssets():readonly string[];
  abstract getAssetVariants(key:string):readonly AssetMetadata[]|null;
}
class _AssetManifestBin extends AssetManifest {
  private typed=new Map<string,readonly AssetMetadata[]>();
  constructor(private readonly data:Map<unknown,unknown>){super();}
  static fromStandardMessageCodecMessage(message:Uint8Array):AssetManifest{const value=new StandardMessageCodec().decodeMessage(new DataView(message.buffer,message.byteOffset,message.byteLength));invariant(value instanceof Map,'invalid-asset-manifest','Asset manifest must be a standard-codec map');return new _AssetManifestBin(value);}
  static _stripContentHash(path:string):string{return path.replace(/\.[0-9a-f]{8}((?:\.(?:js|wasm|mjs)\.map)|(?:\.[^./]+))?$/,(_match,suffix:string|undefined)=>suffix??'');}
  getAssetVariants(key:string):readonly AssetMetadata[]|null{const existing=this.typed.get(key);if(existing)return existing;const data=this.data.get(key);if(data===undefined||data===null)return null;invariant(Array.isArray(data),'invalid-asset-manifest','Asset variants must be a list');const variants=data.map(item=>{invariant(item instanceof Map&&typeof item.get('asset')==='string','invalid-asset-manifest','Invalid asset variant');const asset=item.get('asset') as string,dpr=item.get('dpr') as unknown;invariant(dpr==null||typeof dpr==='number'&&Number.isFinite(dpr)&&dpr>0,'invalid-asset-manifest','Invalid asset variant resolution');return new AssetMetadata(asset,dpr==null?null:dpr as number,key===asset||_AssetManifestBin._stripContentHash(asset)===key);});this.typed.set(key,variants);this.data.delete(key);return variants;}
  listAssets():readonly string[]{const keys=[...this.data.keys()];invariant(keys.every(x=>typeof x==='string'),'invalid-asset-manifest','Asset names must be strings');return [...keys as string[],...this.typed.keys()];}
}
