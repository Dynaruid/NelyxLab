// SPDX-License-Identifier: BSD-3-Clause
import {BinaryMessenger} from '@nelyx/core/services/binary-messenger';
import type {MessageHandler} from '@nelyx/core/services/binary-messenger';
import type {PlatformMessageResponseCallback} from '@nelyx/core/ui/channel-buffers';
import {PlatformChannelBinding} from '@nelyx/core/services/channel-binding';
import type {Disposable} from '@nelyx/core/foundation/disposable';
import {RootIsolateToken} from '@nelyx/core/ui/root-isolate-token';
import {PlatformDispatcher} from '@nelyx/core/ui/platform-dispatcher';
import {BackgroundIsolateBinaryMessenger} from '@nelyx/core/services/background-isolate-binary-messenger';

/** Cloneable routing identity; the transferred MessagePort grants access. */
export interface RootPlatformMessageToken {readonly owner:string}
export interface PlatformWorkerEndpoint {
  postMessage(message:unknown):void;
  addEventListener(type:'message'|'messageerror',listener:(event:MessageEvent)=>void):void;
  removeEventListener(type:'message'|'messageerror',listener:(event:MessageEvent)=>void):void;
  start():void;close():void;
}
type Bytes=Uint8Array|null;
function bytes(data:DataView|null):Bytes{if(data===null)return null;if(data.byteLength>1024*1024)throw new RangeError('Worker message exceeds 1 MiB');return new Uint8Array(new Uint8Array(data.buffer,data.byteOffset,data.byteLength));}
function view(data:unknown):DataView|null{if(data===null)return null;if(!(data instanceof Uint8Array)||data.byteLength>1024*1024)throw new TypeError('Invalid worker message bytes');const copy=new Uint8Array(data);return new DataView(copy.buffer);}
function record(value:unknown):Record<string,unknown>{if(!value||typeof value!=='object')throw new TypeError('Invalid worker message');return value as Record<string,unknown>;}
function identifier(value:unknown):number{if(typeof value!=='number'||!Number.isSafeInteger(value)||value<=0)throw new TypeError('Invalid worker request identifier');return value;}
function channel(value:unknown):string{if(typeof value!=='string'||!value||value.length>1024||value.includes('\0'))throw new TypeError('Invalid worker channel');return value;}
interface Peer {readonly endpoint:PlatformWorkerEndpoint;readonly pending:Set<Promise<void>>;stop():void;close():Promise<void>;gated:boolean}
/** Root requests always use the app messenger captured at construction. */
export class PlatformMessageWorkerOwner implements Disposable {
  readonly token:RootPlatformMessageToken;readonly rootToken:RootIsolateToken;
  private readonly peers=new Set<Peer>();private gated=false;private pending=0;
  private closing:Promise<void>|undefined;private readonly releaseClosing:(()=>void)|undefined;private readonly releaseRetired:(()=>void)|undefined;
  constructor(private readonly messenger:BinaryMessenger){
    const token=PlatformDispatcher.forMessenger(messenger).rootIsolateToken;if(!token)throw new Error('A root SDK messenger is required');this.rootToken=token;this.token=token.toMessage();
    this.releaseClosing=messenger.onClosing?.(()=>this.stop());
    this.releaseRetired=messenger.onRetired?.(()=>{void this.dispose().catch(()=>{});});
  }
  attach(endpoint:PlatformWorkerEndpoint):Disposable {
    if(this.gated||this.peers.size>=16)throw new Error('Worker dispatcher is closed or at capacity');
    let last=0,close:Promise<void>|undefined;
    const send=(message:unknown)=>endpoint.postMessage(message);
    const peer:Peer={endpoint,pending:new Set(),gated:false,stop(){if(peer.gated)return;peer.gated=true;send({kind:'closing'});},close:()=>{
      if(close)return close;
      let resolve!:()=>void,reject!:(error:unknown)=>void;close=new Promise<void>((done,fail)=>{resolve=done;reject=fail;});
      // A failed notification or reply does not permit skipping the drain or
      // abandoning the other endpoint releases.
      const errors:unknown[]=[];
      try{peer.stop();}catch(error){errors.push(error);}
      void Promise.resolve().then(async()=>{
        for(const result of await Promise.allSettled([...peer.pending]))if(result.status==='rejected')errors.push(result.reason);
        for(const release of [()=>send({kind:'closed'}),()=>endpoint.removeEventListener('message',receive),()=>endpoint.removeEventListener('messageerror',failed)])try{release();}catch(error){errors.push(error);}
        try{endpoint.close();this.peers.delete(peer);}catch(error){errors.push(error);}
        if(errors.length)throw new AggregateError(errors,'Worker endpoint shutdown failed');
      }).then(resolve,reject);return close;
    }};
    const failed=()=>{void peer.close().catch(()=>{});};
    const receive=(event:MessageEvent)=>{
      let request:Record<string,unknown>,id:number;
      try{request=record(event.data);if(request.kind==='dispose'){void peer.close().catch(()=>{});return;}if(request.kind!=='send'||request.owner!==this.token.owner)throw new Error('Worker root identity mismatch');id=identifier(request.id);if(id<=last)throw new Error('Worker identifiers must increase');last=id;
        if(this.gated||peer.gated){send({kind:'error',id,error:'Worker dispatcher is closing'});return;}
        if(this.pending>=256){send({kind:'error',id,error:'Worker dispatcher is at capacity'});return;}
        const name=channel(request.channel),data=view(request.bytes);this.pending++;
        let response:PromiseLike<DataView|null>|null;
        try{response=this.messenger.send(name,data);}catch(error){this.pending--;send({kind:'error',id,error:String(error)});return;}
        const task=Promise.resolve(response).then(value=>send({kind:'reply',id,bytes:bytes(value)}),error=>send({kind:'error',id,error:String(error)})).finally(()=>{this.pending--;peer.pending.delete(task);});peer.pending.add(task);
        // Errors are observed; the endpoint's close ACK settles unanswered worker requests.
        void task.catch(()=>{void peer.close().catch(()=>{});});
      }catch(error){
        try{send({kind:'protocol-error',error:String(error)});}catch{}
        void peer.close().catch(()=>{});
      }
    };
    this.peers.add(peer);
    try{
      endpoint.addEventListener('message',receive);endpoint.addEventListener('messageerror',failed);endpoint.start();
      // start() can reenter root shutdown in an embedding implementation.
      if(this.gated||peer.gated)throw new Error('Worker dispatcher closed during registration');
      send({kind:'ready',owner:this.token.owner});
    }catch(error){
      const errors:unknown[]=[error];
      for(const release of [()=>endpoint.removeEventListener('message',receive),()=>endpoint.removeEventListener('messageerror',failed)])try{release();}catch(failure){errors.push(failure);}
      try{endpoint.close();this.peers.delete(peer);}catch(failure){errors.push(failure);}
      if(errors.length>1)throw new AggregateError(errors,'Worker registration and rollback failed');throw error;
    }
    return {dispose:()=>peer.close()};
  }
  stop():void{if(this.gated)return;this.gated=true;const errors:unknown[]=[];for(const peer of this.peers)try{peer.stop();}catch(error){errors.push(error);}if(errors.length)throw new AggregateError(errors,'Worker admission shutdown failed');}
  dispose():Promise<void>{
    if(this.closing)return this.closing;
    let resolve!:()=>void,reject!:(error:unknown)=>void;this.closing=new Promise<void>((done,fail)=>{resolve=done;reject=fail;});
    const errors:unknown[]=[];try{this.stop();}catch(error){errors.push(error);}
    void Promise.resolve().then(async()=>{
      for(const result of await Promise.allSettled([...this.peers].map(peer=>peer.close())))if(result.status==='rejected')errors.push(result.reason);
      // Keep messenger subscriptions when an endpoint has not retired.
      if(!this.peers.size)for(const release of [this.releaseClosing,this.releaseRetired])try{release?.();}catch(error){errors.push(error);}
      if(errors.length)throw new AggregateError(errors,'Worker owner shutdown failed');
    }).then(resolve,reject);return this.closing;
  }
}
interface Pending {resolve(value:DataView|null):void;reject(error:unknown):void}
/** Background messengers send requests only; unsolicited host messages stay at root. */
export class BackgroundPlatformMessageConnection extends BinaryMessenger implements Disposable {
  readonly ready:Promise<void>;
  private readonly requests=new Map<number,Pending>();private sequence=0;private gated=false;private retired=false;
  private readonly closingListeners=new Set<()=>void>();private readonly retiredListeners=new Set<()=>void>();
  private resolveReady!:()=>void;private rejectReady!:(error:unknown)=>void;
  private closing:Promise<void>|undefined;private resolveClose:(()=>void)|undefined;private rejectClose:((error:unknown)=>void)|undefined;
  private defaultLease:Disposable|undefined;
  private readonly callbackErrors:unknown[]=[];
  private sourceDispatcherLease:Disposable|undefined;private sourceMessenger:BinaryMessenger|undefined;
  constructor(private readonly endpoint:PlatformWorkerEndpoint,private readonly token:RootPlatformMessageToken,options:{readonly useAsDefault?:boolean}={}) {
    let owner:BackgroundPlatformMessageConnection;
    super(callback=>{if(owner.gated)callback();else owner.closingListeners.add(callback);return ()=>{owner.closingListeners.delete(callback);};},callback=>{if(owner.retired)callback();else owner.retiredListeners.add(callback);return ()=>{owner.retiredListeners.delete(callback);};});owner=this;
    if(!token||typeof token.owner!=='string'||!token.owner)throw new TypeError('A root platform token is required');
    this.token=Object.freeze({owner:token.owner});
    this.ready=new Promise<void>((resolve,reject)=>{this.resolveReady=resolve;this.rejectReady=reject;});
    // ready remains rejectable to callers even if nobody is awaiting it yet.
    void this.ready.catch(()=>{});
    try{
      this.endpoint.addEventListener('message',this.receive);this.endpoint.addEventListener('messageerror',this.failed);this.endpoint.start();
      if(options.useAsDefault)this.defaultLease=PlatformChannelBinding.bind(this);
    }catch(error){
      this.stop();const errors:unknown[]=[error];
      for(const release of [()=>this.endpoint.removeEventListener('message',this.receive),()=>this.endpoint.removeEventListener('messageerror',this.failed),()=>this.endpoint.close()])try{release();}catch(failure){errors.push(failure);}
      if(errors.length>1)throw new AggregateError(errors,'Background registration and rollback failed');throw error;
    }
  }
  private stop():void{if(this.gated)return;this.gated=true;for(const callback of [...this.closingListeners])try{callback();}catch(error){this.callbackErrors.push(error);}this.closingListeners.clear();}
  /** Source IO facade. Web retains its source UnsupportedError; use this SDK
   * connection directly for the explicit DedicatedWorker extension. */
  async initializeBackgroundIsolate(options:{readonly useAsDefault?:boolean}={}):Promise<BinaryMessenger>{
    await this.ready;if(this.gated)throw new Error('Background messenger is closing');if(this.sourceMessenger)return this.sourceMessenger;
    const rootToken=RootIsolateToken.fromMessage(this.token);
    const lease=PlatformDispatcher.bindBackground({rootIsolateToken:null,
      registerBackgroundIsolate:token=>{if(this.gated||token.owner!==this.token.owner)throw new Error('Worker root identity mismatch or retired owner');},
      sendPlatformMessage:()=>{throw new Error('Background messages require a reply port');},
      sendPortPlatformMessage:(name,data,identifier,port)=>{void this.send(name,data).then(response=>{const captured=bytes(response);port.postMessage([identifier,captured]);},error=>port.postError(identifier,error));},
      onClosing:callback=>this.onClosing!(callback),onRetired:callback=>this.onRetired!(callback),
    });
    try{BackgroundIsolateBinaryMessenger.ensureInitialized(rootToken);const messenger=BackgroundIsolateBinaryMessenger.instance;
      if(options.useAsDefault){this.defaultLease?.dispose();this.defaultLease=PlatformChannelBinding.bind(messenger);}
      this.sourceDispatcherLease=lease;this.sourceMessenger=messenger;return messenger;
    }catch(error){await lease.dispose();throw error;}
  }
  private readonly failed=()=>{this.rejectReady(new Error('Worker message could not be decoded'));void this.dispose().catch(()=>{});};
  private readonly receive=(event:MessageEvent)=>{
    if(this.retired)return;
    try{const message=record(event.data);switch(message.kind){
      case 'ready':if(message.owner!==this.token.owner){this.rejectReady(new Error('Worker root identity mismatch'));void this.dispose().catch(()=>{});return;}this.resolveReady();return;
      case 'closing':this.rejectReady(new Error('Worker root is closing'));this.stop();return;
      case 'closed':void this.retire();return;
      case 'reply':case 'error':{const id=identifier(message.id),request=this.requests.get(id);if(!request)throw new Error('Unknown worker response identifier');const value=message.kind==='reply'?view(message.bytes):null;this.requests.delete(id);if(message.kind==='error')request.reject(new Error(String(message.error)));else request.resolve(value);return;}
      case 'protocol-error':this.rejectReady(new Error(String(message.error)));void this.dispose().catch(()=>{});return;
      default:throw new Error('Unknown root message');
    }}catch(error){this.rejectReady(error);void this.dispose().catch(()=>{});}
  };
  private async retire():Promise<void>{
    // Seed and gate retirement before closing callbacks can reenter dispose.
    this.closing??=new Promise<void>((resolve,reject)=>{this.resolveClose=resolve;this.rejectClose=reject;});
    void this.closing.catch(()=>{});
    this.retired=true;this.rejectReady(new Error('Worker root closed before registration'));this.stop();
    for(const request of this.requests.values())request.reject(new Error('Worker root closed without replying'));this.requests.clear();
    const lease=this.sourceDispatcherLease;this.sourceDispatcherLease=undefined;this.sourceMessenger=undefined;
    const defaultLease=this.defaultLease;this.defaultLease=undefined;
    const releases=[()=>defaultLease?.dispose(),()=>this.endpoint.removeEventListener('message',this.receive),()=>this.endpoint.removeEventListener('messageerror',this.failed),()=>this.endpoint.close(),...[...this.retiredListeners],()=>lease?.dispose()];this.retiredListeners.clear();
    for(const release of releases)try{await release();}catch(error){this.callbackErrors.push(error);}
    if(this.callbackErrors.length)this.rejectClose?.(new AggregateError(this.callbackErrors,'Background messenger cleanup failed after retirement'));else this.resolveClose?.();
  }
  override async send(name:string,data:DataView|null):Promise<DataView|null>{channel(name);const captured=bytes(data);await this.ready;if(this.gated)throw new Error('Background messenger is closing');if(this.requests.size>=256||this.sequence>=Number.MAX_SAFE_INTEGER)throw new RangeError('Background messenger capacity exceeded');const id=++this.sequence;return new Promise<DataView|null>((resolve,reject)=>{this.requests.set(id,{resolve,reject});try{this.endpoint.postMessage({kind:'send',owner:this.token.owner,id,channel:name,bytes:captured});}catch(error){this.requests.delete(id);reject(error);}});}
  override setMessageHandler(_channel:string,_handler:MessageHandler|null):never{throw new Error('Background workers do not support setMessageHandler; host messages go to the root owner');}
  override handlePlatformMessage(_channel:string,_data:DataView|null,_callback:PlatformMessageResponseCallback|null):never{throw new Error('handlePlatformMessage is not supported in a background worker');}
  dispose():Promise<void>{if(this.closing)return this.closing;if(this.retired)return this.closing=this.callbackErrors.length?Promise.reject(new AggregateError(this.callbackErrors,'Background messenger cleanup failed after retirement')):Promise.resolve();this.closing=new Promise<void>((resolve,reject)=>{this.resolveClose=resolve;this.rejectClose=reject;});this.stop();this.rejectReady(new Error('Background messenger is closing'));try{this.endpoint.postMessage({kind:'dispose'});}catch(error){this.rejectClose?.(error);}return this.closing;}
}
