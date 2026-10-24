// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Adapted from the pinned Flutter dart:ui channel_buffers.dart.
import {FoundationBuildMode} from '../foundation/constants.ts';
import {hostEndian} from '../foundation/serialization.ts';
import {decodeUtf8} from '../services/json-serialization.ts';
export type PlatformMessageResponseCallback=(data:DataView|null)=>void;
export type ChannelCallback=(data:DataView|null,callback:PlatformMessageResponseCallback)=>void;
export type DrainChannelCallback=(data:DataView|null,callback:PlatformMessageResponseCallback)=>PromiseLike<void>|void;
/** Capture an embedding callback context; Dart Zone/VM identity is not assumed. */
export interface ChannelCallbackContext{invoke<T>(callback:()=>T):T}
export interface ChannelBufferEnvironment{
  sendChannelUpdate(name:string,listening:boolean):void;
  printDebug(message:string):void;
  scheduleMicrotask?(callback:()=>void):void;
  captureContext?():ChannelCallbackContext;
}
const rootContext:ChannelCallbackContext={invoke:callback=>callback()};
const microtask=(callback:()=>void):void=>{void Promise.resolve().then(callback);};
class _AssertionError extends Error{constructor(message:string){super(message);this.name='_AssertionError';}}
class Exception extends Error{constructor(message:string){super(message);this.name='Exception';}override toString():string{return 'Exception: '+this.message;}}
class FormatException extends Error{constructor(){super('Invalid radix-10 number');this.name='FormatException';}override toString():string{return 'FormatException: '+this.message;}}
class StateError extends Error{constructor(){super('No element');this.name='StateError';}override toString():string{return 'Bad state: '+this.message;}}
class _ChannelCallbackRecord{
  constructor(private readonly _callback:ChannelCallback,private readonly _zone:ChannelCallbackContext){}
  invoke(data:DataView|null,callback:PlatformMessageResponseCallback):void{this._zone.invoke(()=>this._callback(data,callback));}
}
class _StoredMessage{
  constructor(readonly data:DataView|null,private readonly _callback:PlatformMessageResponseCallback,private readonly _zone:ChannelCallbackContext){}
  invoke=(data:DataView|null):void=>{this._zone.invoke(()=>this._callback(data));};
}
/** FIFO storage releases consumed references and compacts only a bounded prefix. */
class _MessageQueue{
  private entries:(_StoredMessage|undefined)[]=[];private head=0;
  get length():number{return this.entries.length-this.head;}
  addLast(message:_StoredMessage):void{this.entries.push(message);}
  removeFirst():_StoredMessage{if(!this.length)throw new StateError();const message=this.entries[this.head]!;this.entries[this.head++]=undefined;if(this.head===this.entries.length){this.entries=[];this.head=0;}else if(this.head>=1024&&this.head*2>=this.entries.length){this.entries=this.entries.slice(this.head);this.head=0;}return message;}
}
class _Channel{
  private readonly _queue:_MessageQueue;private _draining=false;private _channelCallbackRecord:_ChannelCallbackRecord|null=null;
  debugEnableDiscardWarnings=true;
  constructor(private readonly environment:ChannelBufferEnvironment,private _capacity=ChannelBuffers.kDefaultBufferSize){this._queue=new _MessageQueue();}
  get length():number{return this._queue.length;}
  get capacity():number{return this._capacity;}
  set capacity(size:number){this._capacity=size;this._dropOverflowMessages(size);}
  push(message:_StoredMessage):boolean{
    if(!this._draining&&this._channelCallbackRecord!==null){if(FoundationBuildMode.debug&&this.length!==0)throw new _AssertionError('Channel queue must be empty during immediate delivery');this._channelCallbackRecord.invoke(message.data,message.invoke);return false;}
    if(this._capacity<=0)return this.debugEnableDiscardWarnings;
    const dropped=this._dropOverflowMessages(this._capacity-1);this._queue.addLast(message);return dropped;
  }
  pop():_StoredMessage{return this._queue.removeFirst();}
  private _dropOverflowMessages(limit:number):boolean{let result=false;while(this._queue.length>limit){this._queue.removeFirst().invoke(null);result=true;}return result;}
  setListener(callback:ChannelCallback):void{const needDrain=this._channelCallbackRecord===null;this._channelCallbackRecord=new _ChannelCallbackRecord(callback,this.environment.captureContext?.()??rootContext);if(needDrain&&!this._draining)this._drain();}
  clearListener():void{this._channelCallbackRecord=null;}
  private _drain():void{if(FoundationBuildMode.debug&&this._draining)throw new _AssertionError('Channel already draining');this._draining=true;(this.environment.scheduleMicrotask??microtask)(()=>this._drainStep());}
  private _drainStep():void{if(FoundationBuildMode.debug&&!this._draining)throw new _AssertionError('Channel not draining');if(this.length&&this._channelCallbackRecord!==null){const message=this.pop();this._channelCallbackRecord.invoke(message.data,message.invoke);(this.environment.scheduleMicrotask??microtask)(()=>this._drainStep());}else this._draining=false;}
}
/** One set of incoming queues per embedding owner. Native updates are explicit. */
export class ChannelBuffers{
  static readonly kDefaultBufferSize=1;
  static readonly kControlChannelName='dev.flutter/channel-buffers';
  private readonly _channels=new Map<string,_Channel>();
  constructor(private readonly environment:ChannelBufferEnvironment){}
  private assertName(name:string):void{if(FoundationBuildMode.debug&&name.includes('\0'))throw new _AssertionError('Channel names must not contain U+0000 NULL characters.');}
  push(name:string,data:DataView|null,callback:PlatformMessageResponseCallback):void{this.assertName(name);let channel=this._channels.get(name);if(!channel){channel=new _Channel(this.environment);this._channels.set(name,channel);}if(channel.push(new _StoredMessage(data,callback,this.environment.captureContext?.()??rootContext)))this.environment.printDebug('A message on the '+name+' channel was discarded before it could be handled.\nThis happens when a plugin sends messages to the framework side before the framework has had an opportunity to register a listener. See the ChannelBuffers API documentation for details on how to configure the channel to expect more messages, or to expect messages to get discarded:\n  https://api.flutter.dev/flutter/dart-ui/ChannelBuffers-class.html\nThe capacity of the '+name+' channel is '+channel.capacity+' message'+(channel.capacity!==1?'s':'')+'.');}
  setListener(name:string,callback:ChannelCallback):void{this.assertName(name);let channel=this._channels.get(name);if(!channel){channel=new _Channel(this.environment);this._channels.set(name,channel);}channel.setListener(callback);this.sendChannelUpdate(name,{listening:true});}
  clearListener(name:string):void{const channel=this._channels.get(name);if(channel){channel.clearListener();this.sendChannelUpdate(name,{listening:false});}}
  sendChannelUpdate(name:string,{listening}:{readonly listening:boolean}):void{this._sendChannelUpdate(name,listening);}
  /** Owned SDK native/DOM plugin registration replaces the Dart external call. */
  private _sendChannelUpdate(name:string,listening:boolean):void{this.environment.sendChannelUpdate(name,listening);}
  async drain(name:string,callback:DrainChannelCallback):Promise<void>{const channel=this._channels.get(name);while(channel&&channel.length){const message=channel.pop();await callback(message.data,message.invoke);}}
  handleMessage(data:DataView):void{
    const bytes=new Uint8Array(data.buffer,data.byteOffset,data.byteLength),at=(index:number):number=>{if(index<0||index>=bytes.length)throw new RangeError('Control message index out of range');return bytes[index]!;},text=(start:number,count:number):string=>{if(start<0||count<0||start+count>bytes.length)throw new RangeError('Control message range out of bounds');return decodeUtf8(bytes.subarray(start,start+count));},control=ChannelBuffers.kControlChannelName;
    if(at(0)===7){const methodLength=at(1);if(methodLength>=254)throw new Exception('Unrecognized message sent to '+control+' (method name too long)');let index=2;const method=text(index,methodLength);index+=methodLength;
      if(method!=='resize'&&method!=='overflow')throw new Exception("Unrecognized method '"+method+"' sent to "+control);
      const fail=(reason:string):never=>{throw new Exception("Invalid arguments for '"+method+"' method sent to "+control+' ('+reason+')');};
      const listReason='arguments must be a two-element list, channel name and '+(method==='resize'?'new capacity':'flag state');if(at(index)!==12)fail(listReason);index++;if(at(index)<2)fail(listReason);index++;
      if(at(index)!==7)fail('first argument must be a string');index++;const nameLength=at(index);if(nameLength>=254)fail('channel name must be less than 254 characters long');index++;const name=text(index,nameLength);if(method==='resize'&&name.includes('\0'))fail('channel name must not contain any null bytes');index+=nameLength;
      if(method==='resize'){if(at(index)!==3)fail('second argument must be an integer in the range 0 to 2147483647');index++;this.resize(name,data.getUint32(index,hostEndian==='little'));}
      else{const flag=at(index);if(flag!==1&&flag!==2)fail('second argument must be a boolean');this.allowOverflow(name,flag===1);}
    }else{const parts=decodeUtf8(bytes).split('\r');if(parts.length===3&&parts[0]==='resize'){const raw=parts[2]!.trim();if(!/^[+-]?(?:0[xX][\da-fA-F]+|\d+)$/.test(raw))throw new FormatException();const sign=raw.startsWith('-')?-1:1,body=raw.replace(/^[+-]/,'');const size=sign*Number(body);this.resize(parts[1]!,size);}else throw new Exception('Unrecognized message ['+parts.join(', ')+'] sent to '+control+'.');}
  }
  resize(name:string,newSize:number):void{if(!Number.isSafeInteger(newSize))throw new RangeError('Channel capacity must be a safe integer');const channel=this._channels.get(name);if(!channel){this.assertName(name);this._channels.set(name,new _Channel(this.environment,newSize));}else channel.capacity=newSize;}
  allowOverflow(name:string,allowed:boolean):void{if(FoundationBuildMode.debug){let channel=this._channels.get(name);if(!channel&&allowed){this.assertName(name);channel=new _Channel(this.environment);this._channels.set(name,channel);}if(channel)channel.debugEnableDiscardWarnings=!allowed;}}
}
