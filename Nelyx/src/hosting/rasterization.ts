// SPDX-License-Identifier: BSD-3-Clause
// App-owned raster jobs and native display-list cache; outputs use ordinary image/frame ownership.
import {invariant} from '../foundation/errors.ts';
import {PendingDisposalError} from '../foundation/disposable.ts';
import {ResourceRegistry} from './resources.ts';
import {PictureBitmapCache} from './bitmap-cache.ts';
import type {ResourceLease} from './resources.ts';
import {Image} from '../ui/image.ts';
import type {PictureCapture,PictureRasterizer} from '../ui/picture.ts';
import type {NativeImageFrame} from './images.ts';
import {imageTargetSize} from './images.ts';
export interface RasterizationBackend {rasterize(capture:PictureCapture,width:number,height:number):NativeImageFrame;dispose():void|Promise<void>}
/** A backend must preserve every native owner until drain confirms completion. */
export class RasterizationPendingError extends Error {constructor(readonly errors:readonly unknown[],readonly drain:()=>void|Promise<void>,readonly recovery?:{readonly canRetry:()=>boolean;readonly retry:()=>void|Promise<void>}){super('Rasterization completion unconfirmed; owners retained until checked drain');this.name='RasterizationPendingError';}}
/** A native delete has no completion query: retain its owners and never repeat it. */
export class NativeRetirementError extends RasterizationPendingError {
  readonly owners:readonly unknown[];
  constructor(errors:readonly unknown[],owners:readonly unknown[]){const terminal=new AggregateError(errors,'Native resource retirement unconfirmed');super(Object.freeze([...errors]),()=>{throw terminal;});this.name='NativeRetirementError';this.owners=Object.freeze([...owners]);}
}
function failures(errors:unknown[],message:string):void{if(errors.length===1)throw errors[0];if(errors.length)throw new AggregateError(errors,message);}
export class RasterizationService implements PictureRasterizer {
  private closed=false;private closing:Promise<void>|undefined;private readonly jobs=new Set<Promise<unknown>>();
  private closingActive=false;private disposed=false;
  private retryDrain:(()=>void|Promise<void>)|undefined;
  private readonly failedFrames:NativeImageFrame[]=[];
  private readonly uncertain:Array<{readonly error:RasterizationPendingError;readonly capture:PictureCapture;readonly lease:ResourceLease}>=[];
  private readonly bitmaps:PictureBitmapCache|null;
  constructor(readonly resources:ResourceRegistry,private readonly backend:RasterizationBackend,options:{readonly bitmapCache?:boolean}={}){this.bitmaps=options.bitmapCache===false?null:new PictureBitmapCache();}
  get debugBitmapCacheStats(){return this.bitmaps?.debugStats??null;}
  get isClosed():boolean{return this.closed;}
  private begin(capture:PictureCapture,width:number,height:number):ResourceLease{invariant(!this.closed,'closed-rasterizer','Rasterization owner is closed');imageTargetSize(width,height);invariant(this.jobs.size<8,'raster-job-budget','Too many queued raster jobs');return this.resources.acquire([...capture.frame.resources]);}
  private readonly rendering=new Set<object>();
  private render(capture:PictureCapture,width:number,height:number):Image{invariant(!this.rendering.has(capture.frame),'reentrant-rasterization','The same recording is already being rasterized');this.rendering.add(capture.frame);try{return this.renderOwned(capture,width,height);}catch(error){if(this.bitmaps?.debugStats.failed)this.stop();throw error;}finally{this.rendering.delete(capture.frame);}}
  private renderOwned(capture:PictureCapture,width:number,height:number):Image{invariant(!this.closed,'closed-rasterizer','Rasterization owner is closed');const cached=this.bitmaps?.lookup(capture,width,height);if(cached)return cached;const frame=this.backend.rasterize(capture,width,height);let registered=false,initial=false,image:Image|undefined;try{invariant(!this.closed,'closed-rasterizer','Rasterization owner closed during rendering');invariant(frame.descriptor.kind==='image'&&frame.width===width&&frame.height===height,'invalid-raster-output','Rasterizer returned the wrong image kind or dimensions');imageTargetSize(frame.width,frame.height);this.resources.register(frame.descriptor,()=>this.retire(frame));registered=initial=true;image=Image.fromResource(this.resources,frame.descriptor,width,height,frame.readBytes??null);invariant(!this.closed,'closed-rasterizer','Rasterization owner closed during image creation');this.resources.releaseProducer(frame.descriptor);initial=false;this.bitmaps?.admit(capture,image);invariant(!this.closed,'closed-rasterizer','Rasterization owner closed during bitmap admission');return image;}catch(error){const errors=[error];if(image&&!image.debugDisposed)try{image.dispose();}catch(cleanup){errors.push(cleanup);}if(initial)try{this.resources.releaseProducer(frame.descriptor);}catch(cleanup){errors.push(cleanup);}else if(!registered)try{this.retire(frame);}catch(cleanup){errors.push(cleanup);}failures(errors,'Raster output admission and retirement failed');throw error;}}
  private retire(frame:NativeImageFrame):void{try{frame.retire();}catch(error){this.failedFrames.push(frame);this.stop();throw error;}}
  private preserve(error:unknown,capture:PictureCapture,lease:ResourceLease|undefined):boolean{if(!(error instanceof RasterizationPendingError)||!lease)return false;this.uncertain.push({error,capture:capture.retain(),lease});this.stop();return true;}
  private finish(capture:PictureCapture,lease:ResourceLease|undefined,errors:unknown[]):void{try{lease?.returnBy('caller');}catch(error){errors.push(error);}try{capture.dispose();}catch(error){errors.push(error);}}
  rasterizeSync(capture:PictureCapture,width:number,height:number):Image{let lease:ResourceLease|undefined,image:Image|undefined;const errors:unknown[]=[];try{lease=this.begin(capture,width,height);image=this.render(capture,width,height);}catch(error){errors.push(error);if(this.preserve(error,capture,lease))lease=undefined;}this.finish(capture,lease,errors);if(errors.length&&image&&!image.debugDisposed)try{image.dispose();}catch(error){errors.push(error);}failures(errors,'Synchronous rasterization and retirement failed');return image!;}
  rasterize(capture:PictureCapture,width:number,height:number):Promise<Image>{let lease:ResourceLease;try{lease=this.begin(capture,width,height);}catch(error){const errors=[error];this.finish(capture,undefined,errors);return Promise.reject(errors.length===1?error:new AggregateError(errors,'Raster request admission and retirement failed'));}const job=Promise.resolve().then(()=>{const errors:unknown[]=[];let image:Image|undefined,owned:ResourceLease|undefined=lease;try{image=this.render(capture,width,height);}catch(error){errors.push(error);if(this.preserve(error,capture,lease))owned=undefined;}this.finish(capture,owned,errors);if(errors.length&&image&&!image.debugDisposed)try{image.dispose();}catch(error){errors.push(error);}failures(errors,'Asynchronous rasterization and retirement failed');return image!;});this.jobs.add(job);void job.then(()=>this.jobs.delete(job),()=>this.jobs.delete(job));return job;}
  stop():void{this.closed=true;}
  dispose():Promise<void>{if(!this.closing){this.stop();this.startClose();}return this.closing!;}
  /** Only an explicit backend completion query may recover a blocked drain. */
  retryDispose():Promise<void>{if(this.closingActive||this.disposed)return this.closing!;if(!this.retryDrain)return Promise.reject(new Error('Raster drain has no explicit recovery'));return this.startClose();}
  private startClose():Promise<void>{let resolve!:()=>void,reject!:(error:unknown)=>void;this.closing=new Promise<void>((done,fail)=>{resolve=done;reject=fail;});this.closingActive=true;void Promise.resolve().then(()=>this.close()).then(()=>{this.closingActive=false;resolve();},error=>{this.closingActive=false;reject(error);});return this.closing;}
  private async close():Promise<void>{
    await Promise.allSettled([...this.jobs]);
    for(const item of [...this.uncertain]){
      const drain=this.retryDrain??item.error.drain;this.retryDrain=undefined;
      try{await drain();}catch(error){if(item.error.recovery?.canRetry()){this.retryDrain=item.error.recovery.retry;throw new PendingDisposalError([...item.error.errors,error],()=>this.retryDispose());}throw error;}
      // Input release is attempted once even when retirement callbacks throw.
      this.uncertain.splice(this.uncertain.indexOf(item),1);const errors:unknown[]=[];this.finish(item.capture,item.lease,errors);failures(errors,'Unconfirmed raster input retirement failed');
    }
    this.bitmaps?.dispose();
    invariant(this.failedFrames.length===0,'failed-raster-retirement','Raster output retirement failed; backend retained');await this.backend.dispose();this.disposed=true;
  }

}
/** Per-backend actual SkPicture cache, evicted by recording retirement and owner shutdown. */
interface CachedNativePicture<T> {readonly value:T;readonly bytes:number;cancel:()=>void;retirement:'live'|'retiring'|'failed';failure?:unknown}
export class NativePictureCache<T> {
  private readonly entries=new Map<object,CachedNativePicture<T>>();private bytes=0;private closed=false;
  private readonly building=new Set<object>();private readonly unconfirmed=new Set<T>();private readonly cleanupErrors:unknown[]=[];
  constructor(private readonly compile:(capture:PictureCapture)=>T,private readonly size:(value:T)=>number,private readonly retire:(value:T)=>void){}
  get(capture:PictureCapture):T{
    invariant(!this.closed,'closed-picture-cache','Native picture cache closed');const key=capture.frame;
    invariant(!this.building.has(key),'reentrant-picture-compilation','Native picture is still being admitted');
    const old=this.entries.get(key);if(old){invariant(old.retirement==='live','retiring-picture-cache','Native picture retirement is in progress');this.entries.delete(key);this.entries.set(key,old);return old.value;}
    this.building.add(key);try{return this.admit(capture,key);}finally{this.building.delete(key);}
  }
  private admit(capture:PictureCapture,key:object):T{
    const value=this.compile(capture);let bytes:number;
    try{
      invariant(!this.closed,'closed-picture-cache','Native picture cache closed during compilation');bytes=this.size(value);
      invariant(Number.isSafeInteger(bytes)&&bytes>=0&&bytes<=32*1024*1024,'native-picture-budget','Native picture exceeds byte budget');
      while(this.entries.size>=64||this.bytes+bytes>32*1024*1024)this.remove(this.entries.keys().next().value!);
      invariant(!this.closed,'closed-picture-cache','Native picture cache closed during admission');
    }catch(error){try{this.retireUnadmitted(value);}catch(cleanup){throw new AggregateError([error,cleanup],'Native picture admission and retirement failed');}throw error;}
    const entry:CachedNativePicture<T>={value,bytes,cancel:()=>{},retirement:'live'};this.entries.set(key,entry);this.bytes+=bytes;
    try{
      const cancel=capture.onRetire(()=>this.remove(key));invariant(typeof cancel==='function','invalid-picture-subscription','Picture retirement requires an unsubscribe callback');
      if(this.entries.get(key)!==entry){this.cancelSubscription(cancel);throw new Error('Native picture retired during subscription');}
      entry.cancel=cancel;invariant(!this.closed&&entry.retirement==='live','closed-picture-cache','Native picture cache closed during subscription');
    }catch(error){try{this.remove(key);}catch(cleanup){throw new AggregateError([error,cleanup],'Native picture subscription and retirement failed');}throw error;}
    return value;
  }
  private retireUnadmitted(value:T):void{try{this.retire(value);}catch(error){this.closed=true;this.unconfirmed.add(value);this.cleanupErrors.push(error);throw error;}}
  private remove(key:object):void{
    const entry=this.entries.get(key);if(!entry||entry.retirement==='retiring')return;if(entry.retirement==='failed')throw entry.failure;
    entry.retirement='retiring';try{this.retire(entry.value);}catch(error){entry.retirement='failed';entry.failure=error;this.closed=true;throw error;}
    this.entries.delete(key);this.bytes-=entry.bytes;
    this.cancelSubscription(entry.cancel);
  }
  private cancelSubscription(cancel:()=>void):void{try{cancel();}catch(error){this.closed=true;this.cleanupErrors.push(error);throw error;}}
  get debugEntryCount():number{return this.entries.size;}
  get debugBytes():number{return this.bytes;}
  get debugUnconfirmedCount():number{return this.unconfirmed.size+[...this.entries.values()].filter(entry=>entry.retirement==='failed').length;}
  dispose():void{this.closed=true;const errors:unknown[]=[...this.cleanupErrors];for(const key of this.entries.keys())try{this.remove(key);}catch(error){errors.push(error);}failures(errors,'Native picture cache retirement failed');}
}
