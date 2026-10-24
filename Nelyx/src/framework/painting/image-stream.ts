// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Adapted from the pinned Flutter painting/image_stream.dart.
import {invariant,exceptionStack} from '../../foundation/errors.ts';
import {FlutterError} from '../../foundation/flutter-error.ts';
import {FlutterErrorDetails} from '../../foundation/assertions.ts';
import {ErrorDescription} from '../../foundation/diagnostics.ts';
import type {InformationCollector} from '../../foundation/assertions.ts';
import type {Disposable} from '../../foundation/disposable.ts';
import type {ImageService} from '../../hosting/images.ts';
import type {Image} from '../../ui/image.ts';
import type {Codec,FrameInfo} from '../../ui/codec.ts';
import {hashValues} from './value-equality.ts';
export class ImageInfo {
  readonly image:Image;readonly scale:number;readonly debugLabel:string|null;
  constructor({image,scale=1,debugLabel=null}:{readonly image:Image;readonly scale?:number;readonly debugLabel?:string|null}){invariant(Number.isFinite(scale)&&scale>0,'invalid-image-scale','Image scale must be finite and positive');this.image=image;this.scale=scale;this.debugLabel=debugLabel;}
  clone():ImageInfo{return new ImageInfo({image:this.image.clone(),scale:this.scale,debugLabel:this.debugLabel});}
  isCloneOf(other:ImageInfo):boolean{return other.image.isCloneOf(this.image)&&other.scale===this.scale&&other.debugLabel===this.debugLabel;}
  get sizeBytes():number{return this.image.width*this.image.height*4;}
  dispose():void{this.image.dispose();}
  equals(other:unknown):boolean{return other instanceof ImageInfo&&other.constructor===this.constructor&&other.image===this.image&&other.scale===this.scale&&other.debugLabel===this.debugLabel;}
  get hashCode():number{return hashValues(this.image,this.scale,this.debugLabel);}
  toString():string{return `${this.debugLabel===null?'':this.debugLabel+' '}${this.image} @ ${this.scale}x`;}
}
export type ImageListener=(image:ImageInfo,synchronousCall:boolean)=>void;
export type ImageChunkListener=(event:ImageChunkEvent)=>void;
export type ImageErrorListener=(exception:unknown,stack:string|null)=>void;
export class ImageStreamListener {
  readonly onChunk:ImageChunkListener|null;readonly onError:ImageErrorListener|null;readonly reportErrors:boolean;
  constructor(readonly onImage:ImageListener,{onChunk=null,onError=null,reportErrors=true}:{readonly onChunk?:ImageChunkListener|null;readonly onError?:ImageErrorListener|null;readonly reportErrors?:boolean}={}){this.onChunk=onChunk;this.onError=onError;this.reportErrors=reportErrors;}
  equals(other:unknown):boolean{return other instanceof ImageStreamListener&&other.constructor===this.constructor&&other.onImage===this.onImage&&other.onChunk===this.onChunk&&other.onError===this.onError&&other.reportErrors===this.reportErrors;}
  get hashCode():number{return hashValues(this.onImage,this.onChunk,this.onError,this.reportErrors);}
}
export class ImageChunkEvent {readonly cumulativeBytesLoaded:number;readonly expectedTotalBytes:number|null;constructor({cumulativeBytesLoaded,expectedTotalBytes=null}:{readonly cumulativeBytesLoaded:number;readonly expectedTotalBytes?:number|null}){invariant(Number.isSafeInteger(cumulativeBytesLoaded)&&cumulativeBytesLoaded>=0&&(expectedTotalBytes===null||Number.isSafeInteger(expectedTotalBytes)&&expectedTotalBytes>=0),'invalid-image-progress','Invalid image chunk byte counts');this.cumulativeBytesLoaded=cumulativeBytesLoaded;this.expectedTotalBytes=expectedTotalBytes;}}
export class ImageStream {
  private value:ImageStreamCompleter|null=null;private listeners:ImageStreamListener[]=[];
  get completer():ImageStreamCompleter|null{return this.value;}
  get key():object{return this.value??this;}
  setCompleter(value:ImageStreamCompleter):void{invariant(this.value===null,'image-stream-completed','An ImageStream completer can only be assigned once');this.value=value;const initial=this.listeners;this.listeners=[];value._addingInitialListeners=true;try{for(const listener of initial)value.addListener(listener);}finally{value._addingInitialListeners=false;}}
  addListener(listener:ImageStreamListener):void{if(this.value)this.value.addListener(listener);else this.listeners.push(listener);}
  removeListener(listener:ImageStreamListener):void{if(this.value)this.value.removeListener(listener);else{const index=this.listeners.findIndex(x=>x.equals(listener));if(index>=0)this.listeners.splice(index,1);}}
}
export class ImageStreamCompleterHandle {
  private value:ImageStreamCompleter|null;
  constructor(completer:ImageStreamCompleter){this.value=completer;completer._retainHandle();}
  dispose():void{invariant(this.value!==null,'disposed-image-stream-handle','Image stream handle already disposed');const value=this.value;this.value=null;value._releaseHandle();}
}
export interface ImageErrorOptions {readonly exception:unknown;readonly stack?:string|null;readonly context?:ErrorDescription|null;readonly informationCollector?:InformationCollector|null;readonly silent?:boolean}
export abstract class ImageStreamCompleter {
  protected _listeners:ImageStreamListener[]=[];protected _currentImage:ImageInfo|null=null;private currentError:FlutterErrorDetails|null=null;private ephemeral:ImageErrorListener[]=[];private lastRemoved:(()=>void)[]=[];private handles=0;private disposed=false;private hadErrorListener=false;
  debugLabel:string|null=null;_addingInitialListeners=false;
  get hasListeners():boolean{return this._listeners.length>0;}get debugDisposed():boolean{return this.disposed;}
  protected checkLive():void{invariant(!this.disposed,'disposed-image-stream','Image stream completer has been disposed');}
  addListener(listener:ImageStreamListener):void{this.checkLive();if(!listener.reportErrors)this.hadErrorListener=true;this._listeners.push(listener);if(this._currentImage)this.deliver(listener,this._currentImage,!this._addingInitialListeners);if(this.currentError&&listener.onError)this.deliverError(listener.onError,this.currentError.exception,this.currentError.stack,'by a synchronously-called image error listener');}
  private deliver(listener:ImageStreamListener,image:ImageInfo,synchronous:boolean):void{let copy:ImageInfo|undefined;try{copy=image.clone();listener.onImage(copy,synchronous);}catch(exception){if(copy&&!copy.image.debugDisposed)copy.dispose();this.reportError({exception,stack:exceptionStack(exception),context:new ErrorDescription(synchronous?'by a synchronously-called image listener':'by an image listener')});}}
  private deliverError(listener:ImageErrorListener,exception:unknown,stack:string|null,context:string):boolean{try{listener(exception,stack);return true;}catch(error){if(error!==exception)FlutterError.reportError(new FlutterErrorDetails({exception:error,stack:exceptionStack(error),library:'image resource service',context:new ErrorDescription(context)}));return false;}}
  addEphemeralErrorListener(listener:ImageErrorListener):void{this.checkLive();if(this.currentError)this.deliverError(listener,this.currentError.exception,this.currentError.stack,'by a synchronously-called image error listener');else if(this._currentImage===null)this.ephemeral.push(listener);}
  keepAlive():ImageStreamCompleterHandle{this.checkLive();return new ImageStreamCompleterHandle(this);}
  _retainHandle():void{this.checkLive();this.handles++;}
  _releaseHandle():void{invariant(this.handles>0,'invalid-image-keepalive','Image keepalive count underflow');this.handles--;this.maybeDispose();}
  removeListener(listener:ImageStreamListener):void{this.checkLive();const index=this._listeners.findIndex(x=>x.equals(listener));if(index>=0)this._listeners.splice(index,1);if(!this.hasListeners){const callbacks=[...this.lastRemoved];this.lastRemoved=[];const errors:unknown[]=[];for(const callback of callbacks)try{callback();}catch(error){errors.push(error);}try{this.maybeDispose();}catch(error){errors.push(error);}if(errors.length===1)throw errors[0];if(errors.length>1)throw new AggregateError(errors,'Image listener removal and disposal failed');}}
  addOnLastListenerRemovedCallback(callback:()=>void):void{this.checkLive();this.lastRemoved.push(callback);}
  removeOnLastListenerRemovedCallback(callback:()=>void):void{const index=this.lastRemoved.indexOf(callback);if(index>=0)this.lastRemoved.splice(index,1);}
  maybeDispose():void{if(this.disposed||this.hasListeners||this.handles!==0)return;this.disposed=true;this.ephemeral=[];this.lastRemoved=[];const current=this._currentImage;this._currentImage=null;const errors:unknown[]=[];try{current?.dispose();}catch(error){errors.push(error);}try{this.onDisposed();}catch(error){errors.push(error);}if(errors.length===1)throw errors[0];if(errors.length>1)throw new AggregateError(errors,'Image stream disposal failed');}
  protected onDisposed():void{}
  setImage(image:ImageInfo):void{this.checkLive();const old=this._currentImage;this._currentImage=image;this.ephemeral=[];old?.dispose();for(const listener of [...this._listeners])this.deliver(listener,image,false);}
  reportError({exception,stack=null,context=null,informationCollector=null,silent=false}:ImageErrorOptions):void{if(this.disposed)return;const details=this.currentError=new FlutterErrorDetails({exception,stack,context,informationCollector,silent,library:'image resource service'}),listeners=[...this._listeners.flatMap(x=>x.onError?[x.onError]:[]),...this.ephemeral];this.ephemeral=[];let handled=false;for(const listener of listeners)handled=this.deliverError(listener,exception,stack,'when reporting an error to an image listener')||handled;if(!handled&&!this.hadErrorListener)FlutterError.reportError(details);}
  reportImageChunkEvent(event:ImageChunkEvent):void{this.checkLive();for(const listener of [...this._listeners])listener.onChunk?.(event);}
}
export class OneFrameImageStreamCompleter extends ImageStreamCompleter {
  constructor(image:Promise<ImageInfo>,{informationCollector=null}:{readonly informationCollector?:InformationCollector|null}={}){super();void image.then(value=>{if(this.debugDisposed)value.dispose();else this.setImage(value);},exception=>this.reportError({exception,stack:exceptionStack(exception),context:new ErrorDescription('resolving a single-frame image stream'),informationCollector,silent:true}));}
}
export interface MultiFrameImageStreamCompleterOptions {readonly codec:Promise<Codec>;readonly scale:number;readonly imageService:ImageService;readonly debugLabel?:string|null;readonly informationCollector?:InformationCollector|null;readonly onDisposed?:()=>void}
export class MultiFrameImageStreamCompleter extends ImageStreamCompleter {
  private codec:Codec|null=null;private next:FrameInfo|null=null;private decoding=false;private frame:Disposable|null=null;private timer:Disposable|null=null;private emitted=0;private shown=0;private duration:number|null=null;private epoch=0;
  constructor(private readonly options:MultiFrameImageStreamCompleterOptions){super();invariant(Number.isFinite(options.scale)&&options.scale>0,'invalid-image-scale','Image scale must be positive');this.debugLabel=options.debugLabel??null;void options.codec.then(codec=>{if(this.debugDisposed||options.imageService.isClosed){codec.dispose();return;}this.codec=codec;if(this.hasListeners)void this.decodeNext();},error=>this.error(error));}
  private error(exception:unknown):void{if(!this.debugDisposed&&!this.options.imageService.isClosed)this.reportError({exception,stack:exceptionStack(exception),context:new ErrorDescription('resolving an image frame'),informationCollector:this.options.informationCollector??null,silent:true});}
  private async decodeNext():Promise<void>{if(this.decoding||!this.codec||this.debugDisposed||this.options.imageService.isClosed)return;this.decoding=true;const codec=this.codec,epoch=this.epoch;this.next?.image.dispose();this.next=null;try{const next=await codec.getNextFrame();if(this.debugDisposed||epoch!==this.epoch||this.options.imageService.isClosed){next.image.dispose();return;}this.next=next;if(codec.frameCount===1){if(this.hasListeners)this.emit();}else this.scheduleFrame();}catch(error){this.error(error);}finally{this.decoding=false;}}
  private scheduleFrame():void{if(this.frame||!this.hasListeners||this.debugDisposed||this.options.imageService.isClosed)return;this.frame=this.options.imageService.scheduleFrame(()=>{this.frame=null;if(!this.hasListeners||!this.next)return;const elapsed=this.options.imageService.now()-this.shown;if(this.duration===null||elapsed>=this.duration)this.emit();else this.timer=this.options.imageService.scheduleTimer(()=>{this.timer=null;this.scheduleFrame();},this.duration-elapsed);});}
  private emit():void{const next=this.next,codec=this.codec;if(!next||!codec)return;this.next=null;const image=new ImageInfo({image:next.image.clone(),scale:this.options.scale,debugLabel:this.debugLabel});this.shown=this.options.imageService.now();this.duration=next.duration;this.emitted++;next.image.dispose();this.setImage(image);if(this.debugDisposed||!this.codec)return;const cycles=Math.floor(this.emitted/codec.frameCount);if(codec.frameCount===1||codec.repetitionCount!==-1&&cycles>codec.repetitionCount){codec.dispose();this.codec=null;}else{void Promise.resolve().then(()=>this.decodeNext());}}
  override addListener(listener:ImageStreamListener):void{const first=!this.hasListeners;super.addListener(listener);if(first&&this.codec){if(this.next){if(this.codec.frameCount===1)this.emit();else this.scheduleFrame();}else if(this._currentImage===null||this.codec.frameCount>1)void this.decodeNext();}}
  override removeListener(listener:ImageStreamListener):void{super.removeListener(listener);if(!this.hasListeners){this.timer?.dispose();this.timer=null;this.frame?.dispose();this.frame=null;}}
  protected override onDisposed():void{this.epoch++;const errors:unknown[]=[];for(const cleanup of [()=>this.frame?.dispose(),()=>this.timer?.dispose(),()=>this.next?.image.dispose(),()=>this.codec?.dispose(),()=>this.options.onDisposed?.()])try{cleanup();}catch(error){errors.push(error);}this.frame=this.timer=null;this.next=null;this.codec=null;super.onDisposed();if(errors.length===1)throw errors[0];if(errors.length>1)throw new AggregateError(errors,'Animated image disposal failed');}
}
