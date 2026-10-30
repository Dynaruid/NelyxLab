// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Adapted from pinned painting/image_cache.dart. Deferred handle retirement is injectable.
import {invariant,exceptionStack} from '../../foundation/errors.ts';
import {ImageStreamListener} from './image-stream.ts';
import type {ImageStreamCompleter,ImageStreamCompleterHandle,ImageErrorListener} from './image-stream.ts';
import {valueEquals,hashValues} from './value-equality.ts';
export class ImageCacheStatus {
  readonly pending:boolean;readonly keepAlive:boolean;readonly live:boolean;
  constructor({pending=false,keepAlive=false,live=false}:{readonly pending?:boolean;readonly keepAlive?:boolean;readonly live?:boolean}={}){invariant(!pending||!keepAlive,'invalid-image-cache-status','An image cannot be pending and keepAlive at once');this.pending=pending;this.keepAlive=keepAlive;this.live=live;}
  get tracked():boolean{return this.pending||this.keepAlive||this.live;}get untracked():boolean{return !this.tracked;}
  equals(other:unknown):boolean{return other instanceof ImageCacheStatus&&other.pending===this.pending&&other.keepAlive===this.keepAlive&&other.live===this.live;}
  get hashCode():number{return hashValues(this.pending,this.keepAlive,this.live);}
  toString():string{return `ImageCacheStatus(pending: ${this.pending}, live: ${this.live}, keepAlive: ${this.keepAlive})`;}
}
interface Cached {readonly completer:ImageStreamCompleter;readonly handle:ImageStreamCompleterHandle;sizeBytes:number|null}
interface Live extends Cached {readonly remove:()=>void}
interface Pending {readonly completer:ImageStreamCompleter;readonly listener:ImageStreamListener;active:boolean}
function failures(errors:unknown[]):void{if(errors.length===1)throw errors[0];if(errors.length>1)throw new AggregateError(errors,'Image cache retirement failed');}
export class ImageCache {
  private pending=new Map<unknown,Pending>();private cache=new Map<unknown,Cached>();private live=new Map<unknown,Live>();private inFlight=new Set<Pending>();private deferred=new Set<()=>void>();private retired=new WeakSet<Cached>();private max=1000;private maxBytes=100<<20;private bytes=0;private closed=false;
  constructor(private readonly scheduleDisposal:(callback:()=>void)=>void=callback=>{void Promise.resolve().then(callback);}){}
  private key(value:unknown):unknown{for(const map of [this.pending,this.cache,this.live])for(const key of map.keys())if(valueEquals(key,value))return key;return value;}
  get maximumSize():number{return this.max;}set maximumSize(value:number){invariant(Number.isSafeInteger(value)&&value>=0,'invalid-image-cache-size','Image cache size must be nonnegative');if(this.max===value)return;this.max=value;if(value===0)this.clear();else this.trim();}
  get maximumSizeBytes():number{return this.maxBytes;}set maximumSizeBytes(value:number){invariant(Number.isSafeInteger(value)&&value>=0,'invalid-image-cache-size','Image cache byte size must be nonnegative');if(this.maxBytes===value)return;this.maxBytes=value;if(value===0)this.clear();else this.trim();}
  get currentSize():number{return this.cache.size;}get currentSizeBytes():number{return this.bytes;}get liveImageCount():number{return this.live.size;}get pendingImageCount():number{return this.pending.size;}
  private retire(image:Cached):void{if(this.retired.has(image))return;this.retired.add(image);let active=true;const release=()=>{if(!active)return;active=false;this.deferred.delete(release);image.handle.dispose();};this.deferred.add(release);if(this.closed)release();else try{this.scheduleDisposal(release);}catch(error){release();throw error;}}
  private removeLive(key:unknown,image:Live):void{if(this.live.get(key)===image)this.live.delete(key);image.completer.removeOnLastListenerRemovedCallback(image.remove);this.retire(image);}
  private trackLive(key:unknown,completer:ImageStreamCompleter,sizeBytes:number|null):void{const current=this.live.get(key);if(current){current.sizeBytes??=sizeBytes;return;}const handle=completer.keepAlive();let image:Live;const remove=()=>this.removeLive(key,image);image={completer,handle,sizeBytes,remove};this.live.set(key,image);completer.addOnLastListenerRemovedCallback(remove);}
  private touch(key:unknown,image:Cached):void{if(image.sizeBytes!==null&&image.sizeBytes<=this.maxBytes&&this.max>0){this.bytes+=image.sizeBytes;this.cache.set(key,image);this.trim();}else this.retire(image);}
  private trim():void{const errors:unknown[]=[];while(this.bytes>this.maxBytes||this.cache.size>this.max){const [key,image]=this.cache.entries().next().value!;this.cache.delete(key);this.bytes-=image.sizeBytes!;try{this.retire(image);}catch(error){errors.push(error);}}failures(errors);}
  private removePending(image:Pending):void{if(!image.active)return;image.active=false;this.inFlight.delete(image);if(!image.completer.debugDisposed)image.completer.removeListener(image.listener);}
  clear():void{const cached=[...this.cache.values()],pending=[...this.inFlight];this.cache.clear();this.pending.clear();this.bytes=0;const errors:unknown[]=[];for(const image of cached)try{this.retire(image);}catch(error){errors.push(error);}for(const image of pending)try{this.removePending(image);}catch(error){errors.push(error);}failures(errors);}
  clearLiveImages():void{const entries=[...this.live.entries()];this.live.clear();const errors:unknown[]=[];for(const [key,image]of entries)try{this.removeLive(key,image);}catch(error){errors.push(error);}failures(errors);}
  evict(value:unknown,{includeLive=true}:{readonly includeLive?:boolean}={}):boolean{const key=this.key(value);if(includeLive){const live=this.live.get(key);if(live)this.removeLive(key,live);}const pending=this.pending.get(key);if(pending){this.pending.delete(key);this.removePending(pending);return true;}const image=this.cache.get(key);if(image){this.cache.delete(key);this.bytes-=image.sizeBytes!;this.retire(image);return true;}return false;}
  putIfAbsent(value:unknown,loader:()=>ImageStreamCompleter,{onError=null}:{readonly onError?:ImageErrorListener|null}={}):ImageStreamCompleter|null{invariant(!this.closed,'closed-image-cache','Image cache is closed');const key=this.key(value),pending=this.pending.get(key);if(pending)return pending.completer;const cached=this.cache.get(key);if(cached){this.cache.delete(key);this.trackLive(key,cached.completer,cached.sizeBytes);this.cache.set(key,cached);return cached.completer;}const live=this.live.get(key);if(live){this.touch(key,{completer:live.completer,handle:live.completer.keepAlive(),sizeBytes:live.sizeBytes});return live.completer;}let completer:ImageStreamCompleter;try{completer=loader();this.trackLive(key,completer,null);}catch(error){if(onError){onError(error,exceptionStack(error));return null;}throw error;}
    const track=this.max>0&&this.maxBytes>0;let entry:Pending;const listener=new ImageStreamListener(info=>{const sizeBytes=info.sizeBytes;info.dispose();if(!entry.active)return;const cached={completer,handle:completer.keepAlive(),sizeBytes};this.trackLive(key,completer,sizeBytes);if(track)this.touch(key,cached);else this.retire(cached);if(this.pending.get(key)===entry)this.pending.delete(key);this.removePending(entry);},{onError:(error,_stack)=>{if(this.pending.get(key)===entry)this.pending.delete(key);this.removePending(entry);throw error;}});entry={completer,listener,active:true};this.inFlight.add(entry);if(track)this.pending.set(key,entry);try{completer.addListener(listener);}catch(error){if(this.pending.get(key)===entry)this.pending.delete(key);this.removePending(entry);throw error;}return completer;
  }
  statusForKey(value:unknown):ImageCacheStatus{const key=this.key(value);return new ImageCacheStatus({pending:this.pending.has(key),keepAlive:this.cache.has(key),live:this.live.has(key)});}
  containsKey(value:unknown):boolean{const key=this.key(value);return this.pending.has(key)||this.cache.has(key);}
  /** Owner shutdown flushes deferred handles even when its frame clock has stopped. */
  dispose():void{if(this.closed)return;this.closed=true;const errors:unknown[]=[];for(const cleanup of [()=>this.clear(),()=>this.clearLiveImages(),...this.deferred])try{cleanup();}catch(error){errors.push(error);}failures(errors);}
}
