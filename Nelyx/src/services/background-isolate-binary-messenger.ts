// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Adapted from services/_background_isolate_binary_messenger_io.dart and its
// conditional Web implementation. VM ReceivePort is an owned host reply port.
import {BinaryMessenger} from './binary-messenger.ts';
import type {MessageHandler} from './binary-messenger.ts';
import {PlatformDispatcher} from '../ui/platform-dispatcher.ts';
import type {PlatformMessageReplyPort} from '../ui/platform-dispatcher.ts';
import type {RootIsolateToken} from '../ui/root-isolate-token.ts';
import type {PlatformMessageResponseCallback} from '../ui/channel-buffers.ts';
import {FoundationPlatform} from '../foundation/platform.ts';
import {FlutterError} from '../foundation/flutter-error.ts';
import {FlutterErrorDetails} from '../foundation/assertions.ts';
import {ErrorDescription} from '../foundation/diagnostics.ts';
import {exceptionStack} from '../foundation/errors.ts';

class StateError extends Error{constructor(message:string){super(message);this.name='StateError';}}
class UnsupportedError extends Error{constructor(message:string){super(message);this.name='UnsupportedError';}}
class UnimplementedError extends Error{constructor(message:string){super(message);this.name='UnimplementedError';}}
interface Completer {readonly bytes:DataView|null;resolve(value:DataView|null):void;reject(error:unknown):void}
function report(exception:unknown):void{FlutterError.reportError(new FlutterErrorDetails({exception,stack:exceptionStack(exception),library:'services library',context:new ErrorDescription('during a platform message response callback')}));}
function snapshot(data:DataView|null):DataView|null{if(data===null)return null;const bytes=new Uint8Array(new Uint8Array(data.buffer,data.byteOffset,data.byteLength));return new DataView(bytes.buffer);}
export class BackgroundIsolateBinaryMessenger extends BinaryMessenger {
  private static _instance:BackgroundIsolateBinaryMessenger|undefined;
  private readonly _completers=new Map<number,Completer>();private _messageCount=0;
  private closing=false;private retired=false;
  private readonly closingCallbacks=new Set<()=>void>();private readonly retiredCallbacks=new Set<()=>void>();
  private readonly releases:(()=>void)[]=[];
  private readonly _receivePort:PlatformMessageReplyPort={
    postMessage:message=>{const captured:unknown=Array.isArray(message)&&message.length===2?[message[0],message[1] instanceof Uint8Array?new Uint8Array(message[1]):message[1]]:message;void Promise.resolve().then(()=>this.receive(captured)).catch(report);},
    postError:(identifier,error)=>{void Promise.resolve().then(()=>{const completer=this._completers.get(identifier);if(!completer)throw new StateError('Unknown background response identifier');this._completers.delete(identifier);completer.reject(error);}).catch(report);},
  };
  private constructor(private readonly dispatcher:PlatformDispatcher) {
    let owner:BackgroundIsolateBinaryMessenger;
    super(callback=>{if(owner.closing)callback();else owner.closingCallbacks.add(callback);return ()=>{owner.closingCallbacks.delete(callback);};},callback=>{if(owner.retired)callback();else owner.retiredCallbacks.add(callback);return ()=>{owner.retiredCallbacks.delete(callback);};});owner=this;
    this.releases.push(dispatcher.onClosing(()=>this.stop()),dispatcher.onRetired(()=>this.retire()));
  }
  static get instance():BinaryMessenger {
    if(FoundationPlatform.hostEnvironment.kind==='web')throw new UnsupportedError('Isolates not supported on web.');
    if(!this._instance)throw new StateError('The BackgroundIsolateBinaryMessenger.instance value is invalid until BackgroundIsolateBinaryMessenger.ensureInitialized is executed.');
    return this._instance;
  }
  static ensureInitialized(token:RootIsolateToken):void {
    if(FoundationPlatform.hostEnvironment.kind==='web')throw new UnsupportedError('Isolates not supported on web.');
    if(this._instance&&!this._instance.retired)return;
    const dispatcher=PlatformDispatcher.instance;
    dispatcher.registerBackgroundIsolate(token);
    this._instance=new BackgroundIsolateBinaryMessenger(dispatcher);
  }
  private receive(message:unknown):void {
    if(this.retired)throw new StateError('Background reply arrived after retirement');
    if(!Array.isArray(message)||message.length!==2||!Number.isSafeInteger(message[0])||message[0]<=0||!(message[1]===null||message[1] instanceof Uint8Array))throw new TypeError('Invalid background response');
    const completer=this._completers.get(message[0]);if(!completer)throw new StateError('Unknown background response identifier');
    const bytes=message[1],data=bytes===null?null:snapshot(new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength));
    this._completers.delete(message[0]);completer.resolve(data);
  }
  override send(channel:string,message:DataView|null):Promise<DataView|null> {
    if(this.closing)throw new StateError('Background messenger is closing');
    if(message!==null&&message.byteLength>1024*1024)throw new RangeError('Background message exceeds 1 MiB');
    if(this._messageCount>=Number.MAX_SAFE_INTEGER||this._completers.size>=256)throw new RangeError('Background messenger capacity exceeded');
    const bytes=snapshot(message),identifier=++this._messageCount;let resolve!:(value:DataView|null)=>void,reject!:(error:unknown)=>void;
    const future=new Promise<DataView|null>((done,fail)=>{resolve=done;reject=fail;});this._completers.set(identifier,{bytes,resolve,reject});
    // Synchronous failure does not establish that the host rejected admission.
    this.dispatcher.sendPortPlatformMessage(channel,bytes,identifier,this._receivePort);return future;
  }
  override handlePlatformMessage(_channel:string,_data:DataView|null,_callback:PlatformMessageResponseCallback|null):never{throw new UnimplementedError('handlePlatformMessage is deprecated.');}
  override setMessageHandler(_channel:string,_handler:MessageHandler|null):never{throw new UnsupportedError('Background isolates do not support setMessageHandler(). Messages from the host platform always go to the root isolate.');}
  private stop():void{if(this.closing)return;this.closing=true;for(const callback of [...this.closingCallbacks])try{callback();}catch(error){report(error);}this.closingCallbacks.clear();}
  private retire():void{if(this.retired)return;this.stop();this.retired=true;for(const completer of this._completers.values())completer.resolve(null);this._completers.clear();for(const release of this.releases)release();this.releases.length=0;for(const callback of [...this.retiredCallbacks])try{callback();}catch(error){report(error);}this.retiredCallbacks.clear();}
}
