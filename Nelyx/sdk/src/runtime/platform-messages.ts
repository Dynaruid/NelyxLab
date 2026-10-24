// SPDX-License-Identifier: BSD-3-Clause
import {ChannelBuffers} from '@nelyx/core/ui/channel-buffers';
import type {PlatformMessageResponseCallback} from '@nelyx/core/ui/channel-buffers';
import {DefaultBinaryMessenger} from '@nelyx/core/services/binary-messenger';
import {PlatformChannelBinding} from '@nelyx/core/services/channel-binding';
import type {PlatformMessagePort} from '@nelyx/core/hosting/platform-messages';
import type {Disposable} from '@nelyx/core/foundation/disposable';
import {DisposalSequence,PendingDisposalError} from '@nelyx/core/foundation/disposable';
import {debugPrint} from '@nelyx/core/foundation/print';
import {FlutterError} from '@nelyx/core/foundation/flutter-error';
import {FlutterErrorDetails} from '@nelyx/core/foundation/assertions';
import {ErrorDescription} from '@nelyx/core/foundation/diagnostics';
import {NelyxError,exceptionStack} from '@nelyx/core/foundation/errors';
import {RootIsolateToken} from '@nelyx/core/ui/root-isolate-token';
import {PlatformDispatcher} from '@nelyx/core/ui/platform-dispatcher';
interface Request{readonly data:DataView|null;finish(reply:DataView|null):void}
const failedOwners=new Set<PlatformMessageConnection>();
let rootSequence=0;
function snapshot(data:DataView|null):DataView|null{if(data===null)return null;const bytes=new Uint8Array(data.byteLength);bytes.set(new Uint8Array(data.buffer,data.byteOffset,data.byteLength));return new DataView(bytes.buffer);}
function report(exception:unknown):void{FlutterError.reportError(new FlutterErrorDetails({exception,stack:exceptionStack(exception),library:'services library',context:new ErrorDescription('during a platform message callback')}));}
function guarded<T>(callback:()=>T):T{const result=callback();if(result!==null&&typeof result==='object'&&'then'in result&&typeof result.then==='function')void Promise.resolve(result).catch(report);return result;}
/** Per-application byte and callback ownership around an actual embedding port. */
export class PlatformMessageConnection implements Disposable{
  /** Native retirement remains known even when a cleanup observer reports an error. */
  get retired():boolean{return this.state==='closed';}
  private readonly channelBuffers:ChannelBuffers;readonly binaryMessenger:DefaultBinaryMessenger;
  private state:'open'|'closing'|'closed'|'failed'='open';private binding:Disposable|undefined;private attached=false;
  private closing:Promise<void>|undefined;private readonly outgoing=new Set<Request>();private readonly incoming=new Set<Request>();
  private readonly channels=new Set<string>();private readonly listening=new Set<string>();private readonly stopErrors:unknown[]=[];private drains:Promise<void>[]=[];
  private readonly closingListeners=new Set<()=>void>();private readonly retiredListeners=new Set<()=>void>();private notifyingClosing=false;private defaultLease:{dispose():void}|undefined;
  private dispatcherLease:Disposable|undefined;
  readonly rootToken=RootIsolateToken.fromMessage({owner:`nelyx-root-${Date.now()}-${++rootSequence}-${Math.random().toString(36).slice(2)}`});
  constructor(private readonly port:PlatformMessagePort,private readonly options:{readonly useAsDefault?:boolean}={}){
    this.channelBuffers=new ChannelBuffers({sendChannelUpdate:(name,listening)=>{if(this.state==='closed'||this.state==='failed')throw new NelyxError('closed-platform-messages','Platform message owner is closed');if(listening)this.listening.add(name);else this.listening.delete(name);this.port.sendChannelUpdate(name,listening);},printDebug:message=>debugPrint(message),scheduleMicrotask:callback=>{void Promise.resolve().then(callback).catch(report);},captureContext:()=>({invoke:guarded})});
    this.binaryMessenger=new DefaultBinaryMessenger(this.channelBuffers,{send:(name,data,reply)=>this.send(name,data,reply),checkActive:operation=>{if(this.state==='open'||this.state==='closing'&&(operation==='unlisten'||operation==='send'&&this.notifyingClosing))return;throw new NelyxError('closed-platform-messages','Platform message owner is closing');},onClosing:callback=>{if(this.state==='open')this.closingListeners.add(callback);else callback();return ()=>{this.closingListeners.delete(callback);};},onRetired:callback=>{if(this.state==='closed')callback();else this.retiredListeners.add(callback);return ()=>{this.retiredListeners.delete(callback);};}});
  }
  attach():void{if(this.attached||this.state!=='open')throw new NelyxError('platform-messages-attached','Platform message port can only attach once');this.attached=true;this.binding=this.port.attach((name,data,reply)=>this.receive(name,data,reply));
    this.dispatcherLease=PlatformDispatcher.bindRoot(this.binaryMessenger,{rootIsolateToken:this.rootToken,channelBuffers:this.channelBuffers,
      captureCallbackContext:()=>({invoke:guarded}),
      sendPlatformMessage:(name,data,reply)=>this.send(name,data,reply??(()=>{})),
      sendPortPlatformMessage:(name,data,identifier,port)=>this.send(name,data,response=>{const captured=snapshot(response);port.postMessage([identifier,captured===null?null:new Uint8Array(captured.buffer)]);}),
      registerBackgroundIsolate:()=>{throw new NelyxError('root-isolate-registration','Register a transferred background endpoint in its worker realm, not in the root application');},
      onClosing:callback=>this.binaryMessenger.onClosing!(callback),onRetired:callback=>this.binaryMessenger.onRetired!(callback),
    });
    if(this.options.useAsDefault)this.defaultLease=PlatformChannelBinding.bind(this.binaryMessenger);}
  private send(name:string,data:DataView|null,reply:PlatformMessageResponseCallback):void{
    if(this.state!=='open'&&!(this.state==='closing'&&this.notifyingClosing))throw new NelyxError('closed-platform-messages','Platform message owner is closing');
    let finished=false;const captured=snapshot(data),record:Request={data:captured,finish:response=>{if(finished)return;finished=true;if(this.state==='closed'){report(new NelyxError('late-platform-message','Platform replied after its drain completed'));return;}this.outgoing.delete(record);reply(snapshot(response));}};this.outgoing.add(record);
    // A synchronous send failure does not prove that native rejected admission.
    this.port.send(name,captured,record.finish);
  }
  private receive(name:string,data:DataView|null,reply:PlatformMessageResponseCallback):void{
    if(this.state==='closed'){report(new NelyxError('late-platform-message','Platform delivered a message after its drain completed'));return;}
    if(this.state!=='open'){reply(null);return;}
    let finished=false;const captured=snapshot(data),record:Request={data:captured,finish:response=>{if(finished)return;finished=true;this.incoming.delete(record);reply(snapshot(response));}};this.incoming.add(record);this.channels.add(name);
    if(name===ChannelBuffers.kControlChannelName){try{this.channelBuffers.handleMessage(captured!);}catch(error){report(error);}finally{record.finish(null);}return;}
    this.channelBuffers.push(name,captured,record.finish);
  }
  /** Synchronously gate new work; existing native bytes remain owned until drain. */
  stop():void{if(this.state!=='open')return;this.state='closing';
    this.notifyingClosing=true;try{for(const callback of [...this.closingListeners])try{callback();}catch(error){this.stopErrors.push(error);}}finally{this.notifyingClosing=false;this.closingListeners.clear();}
    try{const result=this.binding?.dispose();if(result&&typeof result.then==='function')this.drains.push(result);}catch(error){this.stopErrors.push(error);}
    for(const name of [...this.listening])try{this.channelBuffers.clearListener(name);}catch(error){this.stopErrors.push(error);}
    for(const request of [...this.incoming])try{request.finish(null);}catch(error){this.stopErrors.push(error);}
    this.drains.push(...[...this.channels].map(name=>this.channelBuffers.drain(name,(_data,reply)=>reply(null))));
    try{this.port.stop?.();}catch(error){this.stopErrors.push(error);}
  }
  dispose():Promise<void>{if(!this.closing){let resolve!:()=>void,reject!:(error:unknown)=>void;this.closing=new Promise<void>((a,b)=>{resolve=a;reject=b;});this.stop();void Promise.resolve().then(()=>this.close()).then(resolve,reject);}return this.closing;}
  private shutdown:DisposalSequence|undefined;
  retryDispose():Promise<void>{if(!this.shutdown)return this.closing??this.dispose();if(this.shutdown.status.state==='closing'||this.shutdown.status.state==='closed')return this.closing!;if(!this.shutdown.status.recoverable)return Promise.reject(new Error('No explicitly recoverable platform shutdown is pending'));return this.closing=this.shutdown.retryDispose().catch(error=>{if(error instanceof PendingDisposalError)throw new PendingDisposalError([error],()=>this.retryDispose());throw error;});}
  private async close():Promise<void>{const errors=[...this.stopErrors];for(const drain of this.drains)try{await drain;}catch(error){errors.push(error);}
    this.defaultLease?.dispose();this.defaultLease=undefined;
    this.shutdown=new DisposalSequence([{name:'native-port',run:async()=>{try{await this.port.dispose();}catch(error){this.state='failed';failedOwners.add(this);if(error instanceof PendingDisposalError)throw new PendingDisposalError([...errors,error],error.retry);throw new AggregateError([...errors,error],'platform message drain failed; port and bytes retained');}}},{name:'byte-retirement',run:async()=>{
    // Native has retired all byte access; unanswered sends now settle as missing.
    for(const request of [...this.outgoing])try{request.finish(null);}catch(error){errors.push(error);}
    this.state='closed';this.outgoing.clear();this.incoming.clear();this.channels.clear();this.listening.clear();this.drains=[];this.binding=undefined;
    for(const callback of [...this.retiredListeners])try{callback();}catch(error){errors.push(error);}this.retiredListeners.clear();
    try{await this.dispatcherLease?.dispose();}catch(error){errors.push(error);}this.dispatcherLease=undefined;
    failedOwners.delete(this);if(errors.length)throw new AggregateError(errors,'platform message shutdown failed');
    }}]);
    try{await this.shutdown.dispose();}catch(error){if(error instanceof PendingDisposalError)throw new PendingDisposalError([error],()=>this.retryDispose());throw error;}
  }
}
