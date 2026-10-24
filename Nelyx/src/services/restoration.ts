// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Bucket hierarchy and flutter/restoration protocol from services/restoration.dart
// at 71e4717a61786faab4c7aa39825989305ed29e8a. App-owned messenger; StandardMessageCodec data.
import {ChangeNotifier} from '../foundation/notifier.ts';
import {invariant} from '../foundation/errors.ts';
import type {BinaryMessenger} from './binary-messenger.ts';
import {OptionalMethodChannel} from './platform-channel.ts';
import {StandardMessageCodec} from './message-codecs.ts';
import {MissingPluginException} from './message-codec.ts';
const codec=new StandardMessageCodec();
type RawBucket=Map<unknown,unknown>;
function dataView(bytes:Uint8Array):DataView{return new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);}
function bytes(view:DataView):Uint8Array{return new Uint8Array(view.buffer,view.byteOffset,view.byteLength).slice();}
function rawBucket(value:unknown):RawBucket {
  invariant(value instanceof Map,'invalid-restoration-data','Restoration data must be a StandardMessageCodec map');
  for(const key of value.keys())invariant(key==='v'||key==='c','invalid-restoration-bucket-key','Restoration buckets contain v/c maps');
  for(const key of ['v','c']){const entries=value.get(key);if(entries!==undefined){invariant(entries instanceof Map,'invalid-restoration-map','Restoration values and children must be maps');for(const [id,item]of entries){invariant(typeof id==='string','invalid-restoration-id','Restoration IDs must be strings');if(key==='c')rawBucket(item);}}}return value;
}
export function debugIsSerializableForRestoration(value:unknown):boolean{try{codec.encodeMessage(value);return true;}catch{return false;}}
export class RestorationManager extends ChangeNotifier {
  private readonly channel:OptionalMethodChannel|null;private root:RestorationBucket|null=null;private valid=false;private pending:Promise<RestorationBucket|null>|null=null;private resolvePending:((bucket:RestorationBucket|null)=>void)|null=null;
  private live=true;private dirty=false;private scheduled=false;private epoch=0;private replacing=false;private pendingError:unknown=null;
  private sending:Promise<void>=Promise.resolve();
  /** Explicit messenger is Nelyx's application ownership adapter; null is suitable for an injected-data host. */
  constructor(messenger:BinaryMessenger|null=null){super();this.channel=messenger===null?null:new OptionalMethodChannel('flutter/restoration',undefined,messenger);this.channel?.setMethodCallHandler(call=>{if(call.method!=='push')throw new MissingPluginException();this.acceptEnvelope(call.arguments);return null;});}
  get isReplacing():boolean{return this.replacing;}
  get rootBucket():Promise<RestorationBucket|null>{
    this.checkOpen();if(this.valid)return Promise.resolve(this.root);if(this.pending)return this.pending;
    this.pending=new Promise(resolve=>{this.resolvePending=resolve;});const requestEpoch=this.epoch;
    if(this.channel)void this.channel.invokeMethod('get').then(value=>{if(this.live&&!this.valid&&this.epoch===requestEpoch)this.acceptEnvelope(value);}).catch(error=>{if(this.live&&!this.valid&&this.epoch===requestEpoch){this.pendingError=error;this.handleRestorationUpdateFromEngine({enabled:false,data:null});}});
    else this.handleRestorationUpdateFromEngine({enabled:false,data:null});return this.pending??Promise.resolve(this.root);
  }
  /** Synchronous access after rootBucket completes, used by the owning RootRestorationScope listener. */
  get currentRootBucket():RestorationBucket|null{this.checkOpen();return this.root;}
  get generation():number{return this.epoch;}
  private checkOpen():void{invariant(this.live,'disposed-restoration-manager','RestorationManager used after disposal');}
  private acceptEnvelope(value:unknown):void{if(value===null){this.handleRestorationUpdateFromEngine({enabled:false,data:null});return;}invariant(value instanceof Map&&typeof value.get('enabled')==='boolean'&&(value.get('data')===null||value.get('data') instanceof Uint8Array),'invalid-restoration-envelope','Restoration get/push requires enabled and Uint8List data');this.handleRestorationUpdateFromEngine({enabled:value.get('enabled'),data:value.get('data')});}
  handleRestorationUpdateFromEngine({enabled,data}:{readonly enabled:boolean;readonly data:Uint8Array|null}):void{
    this.checkOpen();invariant(enabled||data===null,'disabled-restoration-data','Disabled restoration cannot carry data');const raw=enabled?(data===null?new Map():rawBucket(codec.decodeMessage(dataView(data)))):null;
    const previous=this.root;this.replacing=this.valid&&enabled;this.epoch++;this.root=raw===null?null:RestorationBucket.root({manager:this,rawData:raw});this.valid=true;this.dirty=false;this.resolvePending?.(this.root);this.resolvePending=null;this.pending=null;
    try{this.notifyListeners();}finally{previous?.dispose();}
  }
  /** @internal Root scopes retire the one-frame replacement flag after their actual View build. */
  _didFinishRestoration():void{if(this.live)this.replacing=false;}
  /** @internal Bucket writes coalesce; explicit saveOffset flush still works without another frame. */
  _scheduleSerialization():void{if(!this.live)return;this.dirty=true;if(this.scheduled)return;this.scheduled=true;void Promise.resolve().then(()=>{this.scheduled=false;return this.live?this.flushData():undefined;}).catch(error=>{this.pendingError=error;});}
  /** Flush hierarchy integrity synchronously; the returned transport work is also observable. */
  flushData():Promise<void>{this.checkOpen();if(this.pendingError!==null){const error=this.pendingError;this.pendingError=null;throw error;}if(!this.dirty||this.root===null)return this.sending;this.root._verifyClaims();const encoded=bytes(codec.encodeMessage(this.root._raw())!),epoch=this.epoch;this.dirty=false;const sending=this.sending.catch(()=>{}).then(async()=>{if(!this.live||epoch!==this.epoch)return;try{await this.sendToEngine(encoded);}catch(error){if(this.live&&epoch===this.epoch)this.dirty=true;throw error;}});this.sending=sending;return sending;}
  sendToEngine(data:Uint8Array):Promise<void>{return this.channel?.invokeMethod('put',data).then(()=>undefined)??Promise.resolve();}
  /** Nelyx host snapshot adapter, using the same codec as the engine protocol. */
  takeSnapshot():Uint8Array|null{this.checkOpen();if(this.root===null)return null;this.root._verifyClaims();return bytes(codec.encodeMessage(this.root._raw())!);}
  override dispose():void{if(!this.live)return;this.live=false;this.channel?.setMethodCallHandler(null);this.resolvePending?.(null);this.resolvePending=null;this.pending=null;this.root?.dispose();this.root=null;super.dispose();}
}
export class RestorationBucket {
  private parent:RestorationBucket|null=null;private manager:RestorationManager|null;private live=true;private id:string;
  private readonly claims=new Map<string,RestorationBucket[]>();private readonly raw:RawBucket;readonly debugOwner:unknown;
  private constructor(id:string,raw:RawBucket,manager:RestorationManager|null,debugOwner:unknown){this.id=id;this.raw=raw;this.manager=manager;this.debugOwner=debugOwner;}
  static empty({restorationId,debugOwner}:{readonly restorationId:string;readonly debugOwner:unknown}):RestorationBucket{return new RestorationBucket(restorationId,new Map(),null,debugOwner);}
  static root({manager,rawData}:{readonly manager:RestorationManager;readonly rawData:RawBucket|null}):RestorationBucket{return new RestorationBucket('root',rawData===null?new Map():rawBucket(rawData),manager,manager);}
  get restorationId():string{this.checkOpen();return this.id;}get isReplacing():boolean{return this.manager?.isReplacing??false;}
  /** @internal Compare root generations even if another View has already completed its restore frame. */
  get _restorationGeneration():unknown{return this.manager===null?null:this.manager.generation;}
  get _restorationManager():RestorationManager|null{return this.manager;}
  private checkOpen():void{invariant(this.live,'disposed-restoration-bucket','RestorationBucket used after disposal');}
  private map(key:'v'|'c'):Map<string,unknown>{let values=this.raw.get(key);if(values===undefined){values=new Map();this.raw.set(key,values);}return values as Map<string,unknown>;}
  read<T=unknown>(restorationId:string):T|null{this.checkOpen();return this.map('v').has(restorationId)?this.map('v').get(restorationId) as T:null;}
  contains(restorationId:string):boolean{this.checkOpen();return this.map('v').has(restorationId);}
  write(restorationId:string,value:unknown):void{this.checkOpen();invariant(debugIsSerializableForRestoration(value),'unserializable-restoration-value','Restoration values must be StandardMessageCodec primitives');const values=this.map('v');if(!values.has(restorationId)||values.get(restorationId)!==value){values.set(restorationId,value);this.manager?._scheduleSerialization();}}
  remove<T=unknown>(restorationId:string):T|null{const old=this.read<T>(restorationId);if(this.map('v').delete(restorationId))this.manager?._scheduleSerialization();return old;}
  claimChild(restorationId:string,{debugOwner}:{readonly debugOwner:unknown}):RestorationBucket {
    this.checkOpen();const claimed=this.claims.get(restorationId),stored=this.map('c').get(restorationId),child=new RestorationBucket(restorationId,!claimed?.length&&stored!==undefined?rawBucket(stored):new Map(),this.manager,debugOwner);this.adoptChild(child);return child;
  }
  private updateManager(manager:RestorationManager|null):void{this.manager=manager;for(const entries of this.claims.values())for(const child of entries)child.updateManager(manager);}
  private removeChild(child:RestorationBucket):void{const entries=this.claims.get(child.id);if(!entries)return;const index=entries.indexOf(child);if(index<0)return;entries.splice(index,1);if(entries.length){this.map('c').set(child.id,entries[0]!.raw);}else{this.claims.delete(child.id);this.map('c').delete(child.id);}child.parent=null;this.manager?._scheduleSerialization();}
  adoptChild(child:RestorationBucket):void{this.checkOpen();child.checkOpen();if(child.parent===this)return;let ancestor:RestorationBucket|null=this;while(ancestor){invariant(ancestor!==child,'cyclic-restoration-bucket','Restoration buckets cannot adopt an ancestor');ancestor=ancestor.parent;}child.parent?.removeChild(child);child.parent=this;child.updateManager(this.manager);const entries=this.claims.get(child.id)??[];entries.push(child);this.claims.set(child.id,entries);if(entries.length===1)this.map('c').set(child.id,child.raw);this.manager?._scheduleSerialization();}
  rename(newRestorationId:string):void{this.checkOpen();if(this.id===newRestorationId)return;const parent=this.parent;parent?.removeChild(this);this.id=newRestorationId;parent?.adoptChild(this);}
  /** @internal End-of-frame duplicate claims fail instead of silently overwriting a sibling. */
  _verifyClaims():void{this.checkOpen();for(const [id,entries]of this.claims){invariant(entries.length===1,'duplicate-restoration-id','Multiple active owners claimed restoration ID '+id);entries[0]!._verifyClaims();}}
  /** @internal StandardMessageCodec wire data; owners should use read/write/claimChild. */
  _raw():RawBucket{this.checkOpen();return this.raw;}
  dispose():void{if(!this.live)return;for(const entries of this.claims.values())for(const child of entries){child.parent=null;child.updateManager(null);}this.claims.clear();this.parent?.removeChild(this);this.parent=null;this.updateManager(null);this.live=false;}
}
