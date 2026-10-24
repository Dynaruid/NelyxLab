import {DisposalSequence,PendingDisposalError} from '@nelyx/core/foundation/disposable';
// SPDX-License-Identifier: BSD-3-Clause
import type {PlatformMessagePort,PlatformMessageReceiver} from '@nelyx/core/hosting/platform-messages';
import type {PlatformMessageResponseCallback} from '@nelyx/core/ui/channel-buffers';
import type {Disposable} from '@nelyx/core/foundation/disposable';
import type {MethodCodec,MethodCall} from '@nelyx/core/services/message-codec';
import {MissingPluginException,PlatformException} from '@nelyx/core/services/message-codec';
import {FlutterError} from '@nelyx/core/foundation/flutter-error';
import {FlutterErrorDetails} from '@nelyx/core/foundation/assertions';

export interface PlatformPluginContext {readonly signal:AbortSignal}
export type PlatformPluginHandler=(data:DataView|null,context:PlatformPluginContext)=>DataView|null|PromiseLike<DataView|null>;
function copy(data:DataView|null,limit=1024*1024):DataView|null {
  if(data===null)return null;
  if(data.byteLength>limit)throw new RangeError('Platform message exceeds its channel byte budget');
  const bytes=new Uint8Array(data.byteLength);bytes.set(new Uint8Array(data.buffer,data.byteOffset,data.byteLength));return new DataView(bytes.buffer);
}
function report(exception:unknown):void{FlutterError.reportError(new FlutterErrorDetails({exception,library:'SDK platform plugins'}));}
/** One plugin registry per application. Close waits admitted OS operations and replies. */
export class PluginPlatformMessagePort implements PlatformMessagePort {
  private readonly plugins=new Map<string,PlatformPluginHandler>();
  private readonly pending=new Set<Promise<void>>();private readonly listening=new Set<string>();
  private readonly incoming=new Set<(value:DataView|null)=>void>();
  private readonly observers=new Set<(channel:string,listening:boolean)=>void>();
  private readonly owners=new Set<Disposable>();private readonly abort=new AbortController();
  private readonly stopCallbacks=new Set<()=>void>();private readonly stopErrors:unknown[]=[];
  private receiver:PlatformMessageReceiver|undefined;private attached=false;private gated=false;private closing:Promise<void>|undefined;
  register(channel:string,handler:PlatformPluginHandler):this {
    if(this.attached||this.gated||!channel||channel.includes('\0')||this.plugins.has(channel))throw new Error('Plugin registration is closed, invalid or duplicate');
    this.plugins.set(channel,handler);return this;
  }
  registerMethod(channel:string,codec:MethodCodec,handler:(call:MethodCall,context:PlatformPluginContext)=>unknown|PromiseLike<unknown>):this {
    return this.register(channel,async(data,context)=>{
      try{return codec.encodeSuccessEnvelope(await handler(codec.decodeMethodCall(data),context));}
      catch(error){if(error instanceof MissingPluginException)return null;return codec.encodeErrorEnvelope(error instanceof PlatformException?error:{code:'platform-error',message:String(error)});}
    });
  }
  own(owner:Disposable):void{if(this.gated)throw new Error('Plugin port is closing');this.owners.add(owner);}
  onStop(callback:()=>void):void{if(this.attached||this.gated)throw new Error('Stop callbacks must register before attach');this.stopCallbacks.add(callback);}
  stop():void{if(this.gated)return;this.gated=true;this.receiver=undefined;this.abort.abort();for(const callback of this.stopCallbacks)try{callback();}catch(error){this.stopErrors.push(error);}this.stopCallbacks.clear();for(const finish of [...this.incoming])finish(null);}
  onListening(callback:(channel:string,listening:boolean)=>void):void{if(this.attached||this.gated)throw new Error('Listener observers must register before attach');this.observers.add(callback);}
  attach(receiver:PlatformMessageReceiver):Disposable {
    if(this.attached||this.gated)throw new Error('Plugin port can attach only once');this.attached=true;this.receiver=receiver;
    return {dispose:()=>{this.receiver=undefined;}};
  }
  send(channel:string,data:DataView|null,reply:PlatformMessageResponseCallback):void {
    if(!this.attached||this.gated)throw new Error('Plugin port is not open');
    if(this.pending.size>=256)throw new RangeError('Too many pending platform operations');
    const limit=channel==='flutter/restoration'?4*1024*1024+256:1024*1024;
    const handler=this.plugins.get(channel),captured=copy(data,limit);
    let complete!:()=>void;const task=new Promise<void>(resolve=>{complete=resolve;}).finally(()=>{this.pending.delete(task);});
    this.pending.add(task);
    // Invoke synchronously to retain browser transient clipboard user activation.
    let result:DataView|null|PromiseLike<DataView|null>;
    try{result=handler?handler(captured,{signal:this.abort.signal}):null;}catch(error){report(error);result=null;}
    void Promise.resolve(result).then(value=>{
      let captured:DataView|null;
      try{captured=copy(value,limit);}catch(error){report(error);captured=null;}
      reply(captured);
    },error=>{report(error);reply(null);}).catch(report).finally(complete);
  }
  sendChannelUpdate(channel:string,listening:boolean):void {
    if(this.gated)throw new Error('Plugin port is closing');
    if(this.listening.has(channel)===listening)return;
    if(listening)this.listening.add(channel);else this.listening.delete(channel);
    const notified:((channel:string,listening:boolean)=>void)[]=[];
    try{for(const observer of this.observers){notified.push(observer);observer(channel,listening);}}
    catch(error){
      if(listening)this.listening.delete(channel);else this.listening.add(channel);
      const errors:unknown[]=[error];
      for(const observer of notified.reverse())try{observer(channel,!listening);}catch(cleanup){errors.push(cleanup);}
      if(errors.length>1)throw new AggregateError(errors,'Plugin listener update failed');throw error;
    }
  }
  /** Host events are delivered only to this owner's registered listener. */
  emit(channel:string,data:DataView|null):Promise<DataView|null> {
    const receiver=this.receiver;if(this.gated||!receiver||!this.listening.has(channel))return Promise.resolve(null);
    if(this.pending.size>=256)return Promise.reject(new RangeError('Too many pending platform operations'));
    const limit=channel==='flutter/restoration'?4*1024*1024+256:1024*1024,captured=copy(data,limit);
    let resolve!:(value:DataView|null)=>void,reject!:(error:unknown)=>void,finished=false;
    const result=new Promise<DataView|null>((done,fail)=>{resolve=done;reject=fail;});
    const finish=(value:DataView|null)=>{if(finished)return;finished=true;this.incoming.delete(finish);try{resolve(copy(value,limit));}catch(error){reject(error);}};
    const task=result.then(()=>{},report).finally(()=>{this.pending.delete(task);});this.pending.add(task);this.incoming.add(finish);
    try{receiver(channel,captured,finish);}catch(error){if(!finished){finished=true;this.incoming.delete(finish);reject(error);}}
    return result;
  }
  dispose():Promise<void> {
    if(this.closing)return this.closing;
    // Seed the promise before callbacks can reenter disposal.
    let resolve!:()=>void,reject!:(error:unknown)=>void;this.closing=new Promise<void>((done,fail)=>{resolve=done;reject=fail;});
    this.stop();
    // A stop/abort callback may reenter dispose before all stop callbacks have
    // returned. Begin the asynchronous drain after their errors are captured.
    void Promise.resolve().then(()=>this.close()).then(resolve,reject);return this.closing;
  }
  private shutdown:DisposalSequence|undefined;
  retryDispose():Promise<void>{if(!this.shutdown)return this.closing??this.dispose();if(this.shutdown.status.state==='closing'||this.shutdown.status.state==='closed')return this.closing!;if(!this.shutdown.status.recoverable)return Promise.reject(new Error('No explicitly recoverable plugin shutdown is pending'));return this.closing=this.shutdown.retryDispose().catch(error=>{if(error instanceof PendingDisposalError)throw new PendingDisposalError([error],()=>this.retryDispose());throw error;});}
  private async close():Promise<void> {
    const errors:unknown[]=[...this.stopErrors];
    for(const channel of this.listening)for(const observer of this.observers)try{observer(channel,false);}catch(error){errors.push(error);}
    this.listening.clear();
    // Admitted handlers may still use owned services until their replies finish.
    await Promise.all([...this.pending]);
    this.shutdown=new DisposalSequence([
      ...[...this.owners].map((owner,index)=>({name:'plugin-owner-'+index,run:async()=>{try{await owner.dispose();this.owners.delete(owner);}catch(error){if(error instanceof PendingDisposalError)throw new PendingDisposalError([...errors,error],async()=>{await error.retry();this.owners.delete(owner);});errors.push(error);}}})),
      {name:'completion',run:()=>{if(errors.length)throw new AggregateError(errors,'Plugin shutdown failed; owners retained');this.plugins.clear();this.observers.clear();this.owners.clear();}},
    ]);
    try{await this.shutdown.dispose();}catch(error){if(error instanceof PendingDisposalError)throw new PendingDisposalError([error],()=>this.retryDispose());throw error;}
  }
}
