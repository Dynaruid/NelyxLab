// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Adapted from the pinned Flutter services/binary_messenger.dart and binding.dart.
import {ChannelBuffers} from '../ui/channel-buffers.ts';
import type {PlatformMessageResponseCallback} from '../ui/channel-buffers.ts';
import {FlutterError} from '../foundation/flutter-error.ts';
import {FlutterErrorDetails} from '../foundation/assertions.ts';
import {ErrorDescription} from '../foundation/diagnostics.ts';
import {exceptionStack} from '../foundation/errors.ts';
export type MessageHandler=(message:DataView|null)=>PromiseLike<DataView|null>|DataView|null;
export abstract class BinaryMessenger{
  /** Optional embedding lifetime capability; global source messengers may omit it. */
  declare readonly onClosing?:((callback:()=>void)=>()=>void)|undefined;
  declare readonly onRetired?:((callback:()=>void)=>()=>void)|undefined;
  constructor(onClosing?:((callback:()=>void)=>()=>void)|undefined,onRetired?:((callback:()=>void)=>()=>void)|undefined){if(onClosing)this.onClosing=onClosing;if(onRetired)this.onRetired=onRetired;}
  abstract handlePlatformMessage(channel:string,data:DataView|null,callback:PlatformMessageResponseCallback|null):Promise<void>;
  abstract send(channel:string,message:DataView|null):PromiseLike<DataView|null>|null;
  abstract setMessageHandler(channel:string,handler:MessageHandler|null):void;
}
export interface BinaryMessageTransport{send(channel:string,message:DataView|null,callback:PlatformMessageResponseCallback):void;checkActive?(operation:'send'|'receive'|'listen'|'unlisten'):void;onClosing?:(callback:()=>void)=>()=>void;onRetired?:(callback:()=>void)=>()=>void}
class StateError extends Error{constructor(){super('Future already completed');this.name='StateError';}override toString():string{return 'Bad state: '+this.message;}}
/** The embedding supplies a real send transport and the same incoming buffer owner. */
export class DefaultBinaryMessenger extends BinaryMessenger{
  constructor(private readonly channelBuffers:ChannelBuffers,private readonly transport:BinaryMessageTransport){super(transport.onClosing?callback=>transport.onClosing!(callback):undefined,transport.onRetired?callback=>transport.onRetired!(callback):undefined);}
  override async handlePlatformMessage(channel:string,data:DataView|null,callback:PlatformMessageResponseCallback|null):Promise<void>{this.transport.checkActive?.('receive');this.channelBuffers.push(channel,data,response=>callback?.(response));}
  override send(channel:string,message:DataView|null):Promise<DataView|null>{this.transport.checkActive?.('send');let complete!:(reply:DataView|null)=>void;const future=new Promise<DataView|null>(resolve=>{complete=resolve;});let completed=false;this.transport.send(channel,message,reply=>{try{if(completed)throw new StateError();completed=true;complete(reply);}catch(exception){FlutterError.reportError(new FlutterErrorDetails({exception,stack:exceptionStack(exception),library:'services library',context:new ErrorDescription('during a platform message response callback')}));}});return future;}
  override setMessageHandler(channel:string,handler:MessageHandler|null):void{this.transport.checkActive?.(handler===null?'unlisten':'listen');if(handler===null)this.channelBuffers.clearListener(channel);else this.channelBuffers.setListener(channel,(data,callback)=>this.handleMessage(data,callback,handler));}
  private async handleMessage(data:DataView|null,callback:PlatformMessageResponseCallback,handler:MessageHandler):Promise<void>{let response:DataView|null=null;try{response=await handler(data);}catch(exception){FlutterError.reportError(new FlutterErrorDetails({exception,stack:exceptionStack(exception),library:'services library',context:new ErrorDescription('during a platform message callback')}));}finally{callback(response);}}
}
