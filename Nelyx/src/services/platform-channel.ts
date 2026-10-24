// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Adapted from the pinned Flutter services/platform_channel.dart.
import {BinaryMessenger} from './binary-messenger.ts';
import type {MessageHandler} from './binary-messenger.ts';
import type {PlatformMessageResponseCallback} from '../ui/channel-buffers.ts';
import {MessageCodec,MethodCodec,MethodCall,PlatformException,MissingPluginException} from './message-codec.ts';
import {StandardMethodCodec} from './message-codecs.ts';
import {PlatformChannelBinding} from './channel-binding.ts';
import {PlatformDispatcher} from '../ui/platform-dispatcher.ts';
import {BackgroundIsolateBinaryMessenger} from './background-isolate-binary-messenger.ts';
import {FoundationPlatform} from '../foundation/platform.ts';
import {BroadcastStreamController} from './event-stream.ts';
import type {BroadcastStream,BroadcastStreamRuntime} from './event-stream.ts';
import {castChannelList,castChannelMap} from './channel-casts.ts';
import {FoundationBuildMode} from '../foundation/constants.ts';
import {FlutterError} from '../foundation/flutter-error.ts';
import {FlutterErrorDetails} from '../foundation/assertions.ts';
import {ErrorDescription} from '../foundation/diagnostics.ts';
import {NelyxError,exceptionStack} from '../foundation/errors.ts';
import {debugPrint} from '../foundation/print.ts';
export const kProfilePlatformChannels=false;
const _profilePlatformChannelsRate=1000;
export let debugProfilePlatformChannels=false;
export function shouldProfilePlatformChannels():boolean{return kProfilePlatformChannels||!FoundationBuildMode.release&&debugProfilePlatformChannels;}
export interface ChannelTimelineEvent{readonly name:string;readonly phase:'start'|'finish';readonly timestamp:number;readonly task:number}
export interface PlatformChannelProfileServices{now():number;delay(milliseconds:number):PromiseLike<void>;output(message:string):void;timeline?(event:ChannelTimelineEvent):void}
interface ProfileHost{performance?:{now():number};setTimeout?:(callback:()=>void,milliseconds:number)=>unknown}
const host=()=>globalThis as unknown as ProfileHost;
const defaultProfileServices:PlatformChannelProfileServices={now:()=>host().performance?.now()??Date.now(),delay:milliseconds=>new Promise(resolve=>{const timer=host().setTimeout;if(!timer)throw Error('Channel profiling requires a timer service');timer(resolve,milliseconds);}),output:message=>debugPrint(message)};
class _PlatformChannelStats{
  private _upCount=0;private _upBytes=0;private _downCount=0;private _downBytes=0;
  constructor(readonly channel:string,readonly codec:string,readonly type:string){}
  get upBytes():number{return this._upBytes;}get downBytes():number{return this._downBytes;}
  addUpStream(bytes:number):void{this._upCount++;this._upBytes+=bytes;}addDownStream(bytes:number):void{this._downCount++;this._downBytes+=bytes;}
  get averageUpPayload():number{return this._upBytes/this._upCount;}get averageDownPayload():number{return this._downBytes/this._downCount;}
}
export class PlatformChannelProfiler{
  private _profilePlatformChannelsIsRunning=false;private readonly _profilePlatformChannelsStats=new Map<string,_PlatformChannelStats>();private task=0;private readonly timeline:ChannelTimelineEvent[]=[];
  constructor(private readonly services:PlatformChannelProfileServices=defaultProfileServices){}
  get timelineEvents():readonly ChannelTimelineEvent[]{return this.timeline.slice();}
  private event(name:string,phase:'start'|'finish',task:number):void{const event=Object.freeze({name,phase,task,timestamp:this.services.now()});this.timeline.push(event);if(this.timeline.length>1024)this.timeline.splice(0,this.timeline.length-1024);this.services.timeline?.(event);}
  beginTimeline(name:string):()=>void{const task=++this.task;this.event(name,'start',task);return ()=>this.event(name,'finish',task);}
  recordUpStream(type:string,name:string,codec:string,data:DataView|null):void{let stats=this._profilePlatformChannelsStats.get(name);if(!stats){stats=new _PlatformChannelStats(name,codec,type);this._profilePlatformChannelsStats.set(name,stats);}stats.addUpStream(data?.byteLength??0);void this.launch();}
  recordDownStream(type:string,name:string,codec:string,data:DataView|null):void{let stats=this._profilePlatformChannelsStats.get(name);if(!stats){stats=new _PlatformChannelStats(name,codec,type);this._profilePlatformChannelsStats.set(name,stats);}stats.addDownStream(data?.byteLength??0);void this.launch();}
  private async launch():Promise<void>{if(this._profilePlatformChannelsIsRunning)return;this._profilePlatformChannelsIsRunning=true;await this.services.delay(_profilePlatformChannelsRate);this._profilePlatformChannelsIsRunning=false;let log='Platform Channel Stats:\n';const all=[...this._profilePlatformChannelsStats.values()];all.sort((a,b)=>b.upBytes+b.downBytes-a.upBytes-a.downBytes);for(const s of all)log+='  (name:"'+s.channel+'" type:"'+s.type+'" codec:"'+s.codec+'" upBytes:'+s.upBytes+' upBytes_avg:'+s.averageUpPayload.toFixed(1)+' downBytes:'+s.downBytes+' downBytes_avg:'+s.averageDownPayload.toFixed(1)+')\n';this.services.output(log);this._profilePlatformChannelsStats.clear();}
}
/** Host settings and telemetry owner; debug flag remains an actual live binding. */
export class PlatformChannelProfiling{
  static profiler=new PlatformChannelProfiler();
  static get debugProfile():boolean{return debugProfilePlatformChannels;}static set debugProfile(value:boolean){debugProfilePlatformChannels=value;}
}
const _profiledBinaryMessengers=new WeakMap<object,_ProfiledBinaryMessenger>();
interface MessengerTarget{current:BinaryMessenger|undefined}
const messengerTargets=new WeakMap<BinaryMessenger,MessengerTarget>();
function retireTarget(target:MessengerTarget):()=>void{return ()=>{target.current=undefined;};}
function targetFor(messenger:BinaryMessenger):MessengerTarget{if(!messenger.onRetired)return {current:messenger};let target=messengerTargets.get(messenger);if(!target){target={current:messenger};messengerTargets.set(messenger,target);messenger.onRetired(retireTarget(target));}return target;}
function forwardLifetime(target:MessengerTarget,retired:boolean):(callback:()=>void)=>()=>void{return callback=>{const messenger=target.current;if(messenger){const register=retired?messenger.onRetired:messenger.onClosing;if(register)return register.call(messenger,callback);}callback();return ()=>{};};}
class _ProfiledBinaryMessenger extends BinaryMessenger{
  private readonly target:MessengerTarget;
  constructor(proxy:BinaryMessenger,readonly channelTypeName:string,readonly codecTypeName:string){const target=targetFor(proxy);super(proxy.onClosing?forwardLifetime(target,false):undefined,proxy.onRetired?forwardLifetime(target,true):undefined);this.target=target;}
  get retired():boolean{return this.target.current===undefined;}
  get proxy():BinaryMessenger{const messenger=this.target.current;if(!messenger)throw new NelyxError('closed-platform-messages','Platform message owner is closing');return messenger;}
  override handlePlatformMessage(channel:string,data:DataView|null,callback:PlatformMessageResponseCallback|null):Promise<void>{return this.proxy.handlePlatformMessage(channel,data,callback);}
  async sendWithPostfix(channel:string,postfix:string,message:DataView|null):Promise<DataView|null>{PlatformChannelProfiling.profiler.recordUpStream(this.channelTypeName,channel+postfix,this.codecTypeName,message);const finish=PlatformChannelProfiling.profiler.beginTimeline('Platform Channel send '+channel+postfix);let result:DataView|null;try{result=await this.proxy.send(channel,message);}finally{finish();}PlatformChannelProfiling.profiler.recordDownStream(this.channelTypeName,channel+postfix,this.codecTypeName,result);return result;}
  override send(channel:string,message:DataView|null):Promise<DataView|null>{return this.sendWithPostfix(channel,'',message);}
  override setMessageHandler(channel:string,handler:MessageHandler|null):void{this.proxy.setMessageHandler(channel,handler);}
}
function _findBinaryMessenger():BinaryMessenger{if(!PlatformChannelBinding.initialized&&FoundationPlatform.hostEnvironment.kind!=='web'&&PlatformDispatcher.initialized&&PlatformDispatcher.instance.rootIsolateToken===null)return BackgroundIsolateBinaryMessenger.instance;return PlatformChannelBinding.binaryMessenger;}
function profiled(owner:object,messenger:BinaryMessenger,type:string,codec:string):BinaryMessenger{if(!shouldProfilePlatformChannels())return messenger;let result=_profiledBinaryMessengers.get(owner);if(!result||result.retired){result=new _ProfiledBinaryMessenger(messenger,type,codec);_profiledBinaryMessengers.set(owner,result);}return result;}
export interface ChannelProfileNames{readonly typeName?:string;readonly codecTypeName?:string}
/** Validate and return the original value; conversions are rejected. */
export type ChannelCast<T>=(value:unknown)=>T;
const identity=(value:unknown)=>value;
function checkedCast<T>(value:unknown,cast:ChannelCast<T>):T{const result=cast(value);if(!Object.is(result,value))throw new TypeError('Channel casts must preserve the original value');return result;}
export class BasicMessageChannel<T>{
  constructor(readonly name:string,readonly codec:MessageCodec<T>,private readonly _binaryMessenger:BinaryMessenger|null=null,private readonly profileNames:ChannelProfileNames={}){}
  get binaryMessenger():BinaryMessenger{return profiled(this,this._binaryMessenger??_findBinaryMessenger(),this.profileNames.typeName??(this.constructor===BasicMessageChannel?'BasicMessageChannel<dynamic>':this.constructor.name),this.profileNames.codecTypeName??this.codec.constructor.name);}
  async send(message:T|null):Promise<T|null>{return this.codec.decodeMessage(await this.binaryMessenger.send(this.name,this.codec.encodeMessage(message)));}
  setMessageHandler(handler:((message:T|null)=>PromiseLike<T|null>|T|null)|null):void{this.binaryMessenger.setMessageHandler(this.name,handler===null?null:async message=>this.codec.encodeMessage(await handler(this.codec.decodeMessage(message))));}
}
class _AssertionError extends Error{constructor(message:string){super(message);this.name='_AssertionError';}}
export class MethodChannel{
  constructor(readonly name:string,readonly codec:MethodCodec=new StandardMethodCodec(),private readonly _binaryMessenger:BinaryMessenger|null=null,private readonly profileNames:ChannelProfileNames={}){}
  get binaryMessenger():BinaryMessenger{return profiled(this,this._binaryMessenger??_findBinaryMessenger(),this.profileNames.typeName??this.constructor.name,this.profileNames.codecTypeName??this.codec.constructor.name);}
  protected async _invokeMethod<T>(method:string,missingOk:boolean,args:unknown,cast:ChannelCast<T>):Promise<T|null>{const input=this.codec.encodeMethodCall(new MethodCall(method,args));const result=shouldProfilePlatformChannels()?await(this.binaryMessenger as _ProfiledBinaryMessenger).sendWithPostfix(this.name,'#'+method,input):await this.binaryMessenger.send(this.name,input);if(result===null){if(missingOk)return null;throw new MissingPluginException('No implementation found for method '+method+' on channel '+this.name);}const decoded=this.codec.decodeEnvelope(result);return decoded===null?null:checkedCast(decoded,cast);}
  invokeMethod(method:string,args?:unknown):Promise<unknown>;
  invokeMethod<T>(method:string,args:unknown,cast:ChannelCast<T>):Promise<T|null>;
  invokeMethod<T>(method:string,args:unknown=null,cast:ChannelCast<T>=identity as ChannelCast<T>):Promise<T|null>{return this._invokeMethod(method,false,args,cast);}
  invokeListMethod(method:string,args?:unknown):Promise<unknown[]|null>;
  invokeListMethod<T>(method:string,args:unknown,cast:ChannelCast<T>):Promise<T[]|null>;
  async invokeListMethod<T>(method:string,args:unknown=null,cast:ChannelCast<T>=identity as ChannelCast<T>):Promise<T[]|null>{const result=await this.invokeMethod(method,args);if(result===null)return null;if(!Array.isArray(result))throw new TypeError('Method result is not a List');return castChannelList(result,value=>checkedCast(value,cast));}
  invokeMapMethod(method:string,args?:unknown):Promise<Map<unknown,unknown>|null>;
  invokeMapMethod<K,V>(method:string,args:unknown,key:ChannelCast<K>,value:ChannelCast<V>):Promise<Map<K,V>|null>;
  async invokeMapMethod<K,V>(method:string,args:unknown=null,key:ChannelCast<K>=identity as ChannelCast<K>,value:ChannelCast<V>=identity as ChannelCast<V>):Promise<Map<K,V>|null>{const result=await this.invokeMethod(method,args);if(result===null)return null;if(!(result instanceof Map))throw new TypeError('Method result is not a Map');return castChannelMap(result,v=>checkedCast(v,key),v=>checkedCast(v,value));}
  setMethodCallHandler(handler:((call:MethodCall)=>unknown|PromiseLike<unknown>)|null):void{if(FoundationBuildMode.debug&&this._binaryMessenger===null&&!PlatformChannelBinding.initialized)throw new _AssertionError('Cannot set the method call handler before the binary messenger has been initialized. This happens when you call setMethodCallHandler() before the WidgetsFlutterBinding has been initialized. You can fix this by either calling WidgetsFlutterBinding.ensureInitialized() before this or by passing a custom BinaryMessenger instance to MethodChannel().');this.binaryMessenger.setMessageHandler(this.name,handler===null?null:message=>this._handleAsMethodCall(message,handler));}
  private async _handleAsMethodCall(message:DataView|null,handler:(call:MethodCall)=>unknown|PromiseLike<unknown>):Promise<DataView|null>{const call=this.codec.decodeMethodCall(message);try{return this.codec.encodeSuccessEnvelope(await handler(call));}catch(error){if(error instanceof PlatformException)return this.codec.encodeErrorEnvelope({code:error.code,message:error.message,details:error.details});if(error instanceof MissingPluginException)return null;return this.codec.encodeErrorEnvelope({code:'error',message:String(error)});}}
}
export class OptionalMethodChannel extends MethodChannel{
  override invokeMethod(method:string,args?:unknown):Promise<unknown>;
  override invokeMethod<T>(method:string,args:unknown,cast:ChannelCast<T>):Promise<T|null>;
  override async invokeMethod<T>(method:string,args:unknown=null,cast:ChannelCast<T>=identity as ChannelCast<T>):Promise<T|null>{return this._invokeMethod(method,true,args,cast);}
}
function streamError(exception:unknown,context:string):void{FlutterError.reportError(new FlutterErrorDetails({exception,stack:exceptionStack(exception),library:'services library',context:new ErrorDescription(context)}));}
/** Explicit host extension for per-application control routing. */
export interface EventChannelOptions{readonly controlBinaryMessenger?:BinaryMessenger}
export class EventChannel{
  constructor(readonly name:string,readonly codec:MethodCodec=new StandardMethodCodec(),private readonly _binaryMessenger:BinaryMessenger|null=null,private readonly options:EventChannelOptions={}){}
  get binaryMessenger():BinaryMessenger{return this._binaryMessenger??_findBinaryMessenger();}
  receiveBroadcastStream(args:unknown=null,runtime?:BroadcastStreamRuntime):BroadcastStream<unknown>{const methodChannel=new MethodChannel(this.name,this.codec,this.options.controlBinaryMessenger??null);let removeClosing:(()=>void)|undefined;const controller=new BroadcastStreamController<unknown>({onListen:async()=>{this.binaryMessenger.setMessageHandler(this.name,async reply=>{if(reply===null)await controller.close();else{try{controller.add(this.codec.decodeEnvelope(reply));}catch(error){if(error instanceof PlatformException)controller.addError(error);else throw error;}}return null;});removeClosing=this.binaryMessenger.onClosing?.(()=>controller.cancelListeners());try{await methodChannel.invokeMethod('listen',args);}catch(error){streamError(error,'while activating platform stream on channel '+this.name);}},onCancel:async()=>{removeClosing?.();removeClosing=undefined;this.binaryMessenger.setMessageHandler(this.name,null);try{await methodChannel.invokeMethod('cancel',args);}catch(error){streamError(error,'while de-activating platform stream on channel '+this.name);}}},runtime);return controller.stream;}
}
