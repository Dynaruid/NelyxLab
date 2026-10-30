// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Adapted from the pinned Flutter services/message_codecs.dart.
import {FoundationBuildMode} from '../foundation/constants.ts';
import {ReadBuffer,WriteBuffer} from '../foundation/serialization.ts';
import {codecValueString} from './value-string.ts';
import {MessageCodec,MethodCodec,MethodCall,PlatformException,FormatException} from './message-codec.ts';
import type {ErrorEnvelope} from './message-codec.ts';
import {encodeUtf8,decodeUtf8,JsonUtf8Encoder,JsonMessageDecoder} from './json-serialization.ts';
const _writeBufferStartCapacity=64;
const bytes=(value:DataView)=>new Uint8Array(value.buffer,value.byteOffset,value.byteLength);
const data=(value:Uint8Array)=>new DataView(value.buffer,value.byteOffset,value.byteLength);
class _AssertionError extends Error{constructor(){super('Message codec size assertion failed');this.name='_AssertionError';}}
class ArgumentError extends Error{constructor(){super('Unsupported standard message value');this.name='ArgumentError';}}
class ConcurrentModificationError extends Error{constructor(){super('Decoded codec map changed during iteration');this.name='ConcurrentModificationError';}}
class _CodecKey{constructor(readonly original:number){}}
/** Preserve source numeric key equality while keeping the first key's type. */
class _StandardCodecMap extends Map<unknown,unknown>{
  private readonly integers=new Map<bigint,unknown>();
  private version=0;
  private token(key:unknown):bigint|undefined{return typeof key==='bigint'?key:typeof key==='number'&&Number.isFinite(key)&&Number.isInteger(key)?BigInt(key):undefined;}
  private original(key:unknown):unknown{const token=this.token(key);return token!==undefined&&this.integers.has(token)?this.integers.get(token):key;}
  override set(key:unknown,value:unknown):this{const token=this.token(key);let original=this.original(key);if(token===undefined||!this.integers.has(token)){if(typeof key==='number'&&(Number.isNaN(key)||Object.is(key,-0)))original=new _CodecKey(key);if(token!==undefined)this.integers.set(token,original);}if(!super.has(original))this.version++;super.set(original,value);return this;}
  override get(key:unknown):unknown{return super.get(this.original(key));}
  override has(key:unknown):boolean{return super.has(this.original(key));}
  override delete(key:unknown):boolean{const original=this.original(key),deleted=super.delete(original),token=this.token(key);if(deleted){this.version++;if(token!==undefined)this.integers.delete(token);}return deleted;}
  override clear():void{if(this.size)this.version++;this.integers.clear();super.clear();}
  override entries():MapIterator<[unknown,unknown]>{const version=this.version,iterator=super.entries(),owner=this;return(function*():MapIterator<[unknown,unknown]>{for(const [key,value]of iterator){if(owner.version!==version)throw new ConcurrentModificationError();yield [key instanceof _CodecKey?key.original:key,value];}if(owner.version!==version)throw new ConcurrentModificationError();})();}
  override keys():MapIterator<unknown>{const entries=this.entries();return(function*():MapIterator<unknown>{for(const [key]of entries)yield key;})();}
  override values():MapIterator<unknown>{const entries=this.entries();return(function*():MapIterator<unknown>{for(const [,value]of entries)yield value;})();}
  override [Symbol.iterator]():MapIterator<[unknown,unknown]>{return this.entries();}
  override forEach(callback:(value:unknown,key:unknown,map:Map<unknown,unknown>)=>void,thisArg?:unknown):void{const version=this.version;for(const [key,value]of this.entries()){callback.call(thisArg,value,key,this);if(this.version!==version)throw new ConcurrentModificationError();}}
}
export class BinaryCodec extends MessageCodec<DataView>{decodeMessage(message:DataView|null):DataView|null{return message;}encodeMessage(message:DataView|null):DataView|null{return message;}}
export class StringCodec extends MessageCodec<string>{decodeMessage(message:DataView|null):string|null{return message===null?null:decodeUtf8(bytes(message));}encodeMessage(message:string|null):DataView|null{return message===null?null:data(encodeUtf8(message));}}
export class JSONMessageCodec extends MessageCodec<unknown>{
  private static readonly _encoder=new JsonUtf8Encoder();private static readonly _decoder=new JsonMessageDecoder();
  encodeMessage(message:unknown):DataView|null{return message===null?null:data(JSONMessageCodec._encoder.convert(message));}
  decodeMessage(message:DataView|null):unknown{return message===null?null:JSONMessageCodec._decoder.convert(bytes(message));}
}
export class JSONMethodCodec extends MethodCodec{
  encodeMethodCall(call:MethodCall):DataView{return new JSONMessageCodec().encodeMessage(new Map([['method',call.method],['args',call.arguments]]))!;}
  decodeMethodCall(message:DataView|null):MethodCall{const value=new JSONMessageCodec().decodeMessage(message);if(!(value instanceof Map))throw new FormatException('Expected method call Map, got '+codecValueString(value));const method=value.get('method');if(typeof method==='string')return new MethodCall(method,value.has('args')?value.get('args'):null);throw new FormatException('Invalid method call: '+codecValueString(value));}
  decodeEnvelope(envelope:DataView):unknown{const value=new JSONMessageCodec().decodeMessage(envelope);if(!Array.isArray(value))throw new FormatException('Expected envelope List, got '+codecValueString(value));if(value.length===1)return value[0];if((value.length===3||value.length===4)&&typeof value[0]==='string'&&(value[1]===null||typeof value[1]==='string')&&(value.length===3||value[3]===null||typeof value[3]==='string'))throw new PlatformException({code:value[0],message:value[1],details:value[2],stacktrace:value.length===4?value[3]:null});throw new FormatException('Invalid envelope: '+codecValueString(value));}
  encodeSuccessEnvelope(result:unknown):DataView{return new JSONMessageCodec().encodeMessage([result])!;}
  encodeErrorEnvelope({code,message=null,details=null}:ErrorEnvelope):DataView{return new JSONMessageCodec().encodeMessage([code,message,details])!;}
}
/** JavaScript numbers are doubles; bigint is the explicit signed-int64 adapter. */
export class StandardMessageCodec extends MessageCodec<unknown>{
  private static readonly _valueNull=0;private static readonly _valueTrue=1;private static readonly _valueFalse=2;private static readonly _valueInt32=3;private static readonly _valueInt64=4;private static readonly _valueLargeInt=5;private static readonly _valueFloat64=6;private static readonly _valueString=7;private static readonly _valueUint8List=8;private static readonly _valueInt32List=9;private static readonly _valueInt64List=10;private static readonly _valueFloat64List=11;private static readonly _valueList=12;private static readonly _valueMap=13;private static readonly _valueFloat32List=14;
  encodeMessage(message:unknown):DataView|null{if(message===null)return null;const buffer=new WriteBuffer({startCapacity:_writeBufferStartCapacity});this.writeValue(buffer,message);return buffer.done();}
  decodeMessage(message:DataView|null):unknown{if(message===null)return null;const buffer=new ReadBuffer(message),result=this.readValue(buffer);if(buffer.hasRemaining)throw new FormatException('Message corrupted');return result;}
  writeValue(buffer:WriteBuffer,value:unknown):void{
    if(value===null){buffer.putUint8(StandardMessageCodec._valueNull);return;}if(typeof value==='boolean'){buffer.putUint8(value?StandardMessageCodec._valueTrue:StandardMessageCodec._valueFalse);return;}if(typeof value==='number'){buffer.putUint8(StandardMessageCodec._valueFloat64);buffer.putFloat64(value);return;}
    if(typeof value==='bigint'){if(value<BigInt('-9223372036854775808')||value>BigInt('9223372036854775807'))throw new RangeError('Standard codec integer must fit signed int64');if(value>=BigInt('-2147483648')&&value<=BigInt('2147483647')){buffer.putUint8(StandardMessageCodec._valueInt32);buffer.putInt32(value);}else{buffer.putUint8(StandardMessageCodec._valueInt64);buffer.putInt64(value);}return;}
    if(typeof value==='string'){buffer.putUint8(StandardMessageCodec._valueString);const encoded=encodeUtf8(value);this.writeSize(buffer,encoded.length);buffer.putUint8List(encoded);return;}
    if(value instanceof Uint8Array){buffer.putUint8(StandardMessageCodec._valueUint8List);this.writeSize(buffer,value.length);buffer.putUint8List(value);return;}
    if(value instanceof Int32Array){buffer.putUint8(StandardMessageCodec._valueInt32List);this.writeSize(buffer,value.length);buffer.putInt32List(value);return;}
    if(value instanceof BigInt64Array){buffer.putUint8(StandardMessageCodec._valueInt64List);this.writeSize(buffer,value.length);buffer.putInt64List(value);return;}
    if(value instanceof Float32Array){buffer.putUint8(StandardMessageCodec._valueFloat32List);this.writeSize(buffer,value.length);buffer.putFloat32List(value);return;}
    if(value instanceof Float64Array){buffer.putUint8(StandardMessageCodec._valueFloat64List);this.writeSize(buffer,value.length);buffer.putFloat64List(value);return;}
    if(Array.isArray(value)){buffer.putUint8(StandardMessageCodec._valueList);this.writeSize(buffer,value.length);for(const item of value)this.writeValue(buffer,item);return;}
    if(value instanceof Map){buffer.putUint8(StandardMessageCodec._valueMap);this.writeSize(buffer,value.size);value.forEach((item,key)=>{this.writeValue(buffer,key);this.writeValue(buffer,item);});return;}
    throw new ArgumentError();
  }
  readValue(buffer:ReadBuffer):unknown{if(!buffer.hasRemaining)throw new FormatException('Message corrupted');return this.readValueOfType(buffer.getUint8(),buffer);}
  // oxlint-disable-next-line unicorn/no-new-array -- The numeric argument is the required length; preserve preallocation and sparse storage semantics.
  readValueOfType(type:number,buffer:ReadBuffer):unknown{switch(type){case StandardMessageCodec._valueNull:return null;case StandardMessageCodec._valueTrue:return true;case StandardMessageCodec._valueFalse:return false;case StandardMessageCodec._valueInt32:return BigInt(buffer.getInt32());case StandardMessageCodec._valueInt64:return buffer.getInt64();case StandardMessageCodec._valueFloat64:return buffer.getFloat64();case StandardMessageCodec._valueLargeInt:case StandardMessageCodec._valueString:return decodeUtf8(buffer.getUint8List(this.readSize(buffer)));case StandardMessageCodec._valueUint8List:return buffer.getUint8List(this.readSize(buffer));case StandardMessageCodec._valueInt32List:return buffer.getInt32List(this.readSize(buffer));case StandardMessageCodec._valueInt64List:return buffer.getInt64List(this.readSize(buffer));case StandardMessageCodec._valueFloat32List:return buffer.getFloat32List(this.readSize(buffer));case StandardMessageCodec._valueFloat64List:return buffer.getFloat64List(this.readSize(buffer));case StandardMessageCodec._valueList:{const count=this.readSize(buffer),result:unknown[]=new Array(count);for(let i=0;i<count;i++)result[i]=this.readValue(buffer);return result;}case StandardMessageCodec._valueMap:{const count=this.readSize(buffer),result=new _StandardCodecMap();for(let i=0;i<count;i++){const key=this.readValue(buffer);result.set(key,this.readValue(buffer));}return result;}default:throw new FormatException('Message corrupted');}}
  writeSize(buffer:WriteBuffer,value:number):void{if(FoundationBuildMode.debug&&(value<0||value>0xffffffff)){throw new _AssertionError();}if(value<254)buffer.putUint8(value);else if(value<=0xffff){buffer.putUint8(254);buffer.putUint16(value);}else{buffer.putUint8(255);buffer.putUint32(value);}}
  readSize(buffer:ReadBuffer):number{const value=buffer.getUint8();return value===254?buffer.getUint16():value===255?buffer.getUint32():value;}
}
export class StandardMethodCodec extends MethodCodec{
  constructor(readonly messageCodec:StandardMessageCodec=new StandardMessageCodec()){super();}
  encodeMethodCall(call:MethodCall):DataView{const buffer=new WriteBuffer({startCapacity:_writeBufferStartCapacity});this.messageCodec.writeValue(buffer,call.method);this.messageCodec.writeValue(buffer,call.arguments);return buffer.done();}
  decodeMethodCall(call:DataView|null):MethodCall{if(call===null)throw new TypeError('Method call must not be null');const buffer=new ReadBuffer(call),method=this.messageCodec.readValue(buffer),args=this.messageCodec.readValue(buffer);if(typeof method==='string'&&!buffer.hasRemaining)return new MethodCall(method,args);throw new FormatException('Invalid method call');}
  encodeSuccessEnvelope(result:unknown):DataView{const buffer=new WriteBuffer({startCapacity:_writeBufferStartCapacity});buffer.putUint8(0);this.messageCodec.writeValue(buffer,result);return buffer.done();}
  encodeErrorEnvelope({code,message=null,details=null}:ErrorEnvelope):DataView{const buffer=new WriteBuffer({startCapacity:_writeBufferStartCapacity});buffer.putUint8(1);this.messageCodec.writeValue(buffer,code);this.messageCodec.writeValue(buffer,message);this.messageCodec.writeValue(buffer,details);return buffer.done();}
  decodeEnvelope(envelope:DataView):unknown{if(envelope.byteLength===0)throw new FormatException('Expected envelope, got nothing');const buffer=new ReadBuffer(envelope);if(buffer.getUint8()===0)return this.messageCodec.readValue(buffer);const code=this.messageCodec.readValue(buffer),message=this.messageCodec.readValue(buffer),details=this.messageCodec.readValue(buffer),stacktrace=buffer.hasRemaining?this.messageCodec.readValue(buffer):null;if(stacktrace!==null&&typeof stacktrace!=='string')throw new TypeError('Error stacktrace must be a string or null');if(typeof code==='string'&&(message===null||typeof message==='string')&&!buffer.hasRemaining)throw new PlatformException({code,message,details,stacktrace});throw new FormatException('Invalid envelope');}
}
