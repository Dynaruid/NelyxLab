// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Adapted from the pinned Flutter foundation/print.dart.
export interface DebugPrintOptions{readonly wrapWidth?:number|null}
export type DebugPrintCallback=(message:string|null,options?:DebugPrintOptions)=>void;
/** Runtime services for a logging owner; times and delays are milliseconds. */
export interface DebugPrintServices{now():number;schedule(delayMilliseconds:number,callback:()=>void):void;output(message:string|null):void}
interface PrintHost{console?:{log(message:string|null):void};performance?:{now():number};setTimeout?:(callback:()=>void,delay:number)=>unknown}
const host=()=>globalThis as unknown as PrintHost;
const defaultServices:DebugPrintServices={now:()=>host().performance?.now()??Date.now(),schedule(delay,callback){const timer=host().setTimeout;if(!timer)throw new Error('Throttled debug output requires a timer service');timer(callback,delay);},output:message=>host().console?.log(message)};
const _kDebugPrintCapacity=12*1024,_kDebugPrintPauseTime=1000;
interface Completion{readonly promise:Promise<void>;complete():void}
class _DebugPrintStopwatch{private started:number|undefined;private accumulated=0;constructor(private readonly now:()=>number){}get elapsed():number{return this.accumulated+(this.started===undefined?0:this.now()-this.started);}start():void{this.started??=this.now();}stop():void{if(this.started!==undefined){this.accumulated+=this.now()-this.started;this.started=undefined;}}reset():void{this.accumulated=0;if(this.started!==undefined)this.started=this.now();}}
/** The default global owner implements the source buffer/stopwatch/completion protocol. */
export class DebugPrintController{
  private _debugPrintedCharacters=0;private readonly _debugPrintBuffer:string[]=[];private bufferHead=0;private _debugPrintScheduled=false;
  private readonly _debugPrintStopwatch:_DebugPrintStopwatch;private _debugPrintCompleter:Completion|undefined;
  constructor(private readonly services:DebugPrintServices=defaultServices){this._debugPrintStopwatch=new _DebugPrintStopwatch(()=>services.now());}
  printSynchronously(message:string|null,{wrapWidth=null}:DebugPrintOptions={}):void{this.services.output(message!==null&&wrapWidth!==null?message.split('\n').flatMap(line=>Array.from(debugWordWrap(line,wrapWidth))).join('\n'):message);}
  printThrottled(message:string|null,{wrapWidth=null}:DebugPrintOptions={}):void{const lines=message?.split('\n')??['null'];if(wrapWidth!==null){for(const line of lines)for(const wrapped of debugWordWrap(line,wrapWidth))this._debugPrintBuffer.push(wrapped);}else for(const line of lines)this._debugPrintBuffer.push(line);if(!this._debugPrintScheduled)this._debugPrintTask();}
  get done():Promise<void>{return this._debugPrintCompleter?.promise??new Promise<void>(resolve=>resolve());}
  private _debugPrintTask():void{
    this._debugPrintScheduled=false;if(this._debugPrintStopwatch.elapsed>_kDebugPrintPauseTime){this._debugPrintStopwatch.stop();this._debugPrintStopwatch.reset();this._debugPrintedCharacters=0;}
    while(this._debugPrintedCharacters<_kDebugPrintCapacity&&this.bufferHead<this._debugPrintBuffer.length){const line=this._debugPrintBuffer[this.bufferHead]!;this._debugPrintBuffer[this.bufferHead++]='';this._debugPrintedCharacters+=line.length;this.services.output(line);}
    if(this.bufferHead<this._debugPrintBuffer.length){if(this.bufferHead>=1024&&this.bufferHead*2>=this._debugPrintBuffer.length){this._debugPrintBuffer.splice(0,this.bufferHead);this.bufferHead=0;}this._debugPrintScheduled=true;this._debugPrintedCharacters=0;this.services.schedule(_kDebugPrintPauseTime,()=>this._debugPrintTask());if(!this._debugPrintCompleter){let complete!:()=>void;const promise=new Promise<void>(resolve=>{complete=resolve;});this._debugPrintCompleter={promise,complete};}}
    else{this._debugPrintBuffer.length=0;this.bufferHead=0;this._debugPrintStopwatch.start();this._debugPrintCompleter?.complete();this._debugPrintCompleter=undefined;}
  }
}
/** Mutable debugPrint callback adapts Dart's assignable top-level function variable. */
export class DebugPrint{static readonly controller=new DebugPrintController();static get callback():DebugPrintCallback{return debugPrint;}static set callback(value:DebugPrintCallback){debugPrint=value;}static get done():Promise<void>{return this.controller.done;}}
export let debugPrint:DebugPrintCallback=debugPrintThrottled;
export function debugPrintSynchronously(message:string|null,options:DebugPrintOptions={}):void{DebugPrint.controller.printSynchronously(message,options);}
export function debugPrintThrottled(message:string|null,options:DebugPrintOptions={}):void{DebugPrint.controller.printThrottled(message,options);}
const _indentPattern=/^ *(?:[-+*] |[0-9]+[.):] )?/;
type _WordWrapParseMode='inSpace'|'inWord'|'atBreak';
const trimLeft=(message:string)=>message.replace(/^[\u0009-\u000d\u0020\u0085\u00a0\u1680\u2000-\u200a\u2028\u2029\u202f\u205f\u3000\ufeff]+/,'');
function substring(message:string,start:number,end:number):string{if(start<0||end<start||end>message.length)throw new RangeError('Word wrap substring is outside the message');return message.slice(start,end);}
/** Error-message wrapping preserves ASCII break points and the source indentation rules. */
export function debugWordWrap(message:string,width:number,{wrapIndent=''}:{readonly wrapIndent?:string}={}):Iterable<string>{
  if(!Number.isSafeInteger(width))throw new RangeError('Word wrap width must be a safe integer');
  if(message.length<width)return [message];const trimmed=trimLeft(message);if(!trimmed.length)throw new RangeError('Empty trimmed message has no first character');if(trimmed[0]==='#')return [message];
  const wrapped:string[]=[],prefix=wrapIndent+' '.repeat(_indentPattern.exec(message)![0].length);let start=0,startForLengthCalculations=0,addPrefix=false,index=prefix.length,mode:_WordWrapParseMode='inSpace',lastWordStart=0,lastWordEnd:number|null=null;
  while(true){if(mode==='inSpace'){while(index<message.length&&message[index]===' ')index++;lastWordStart=index;mode='inWord';}if(mode==='inWord'){while(index<message.length&&message[index]!==' ')index++;mode='atBreak';}
    if(index-startForLengthCalculations>width||index===message.length){if(index-startForLengthCalculations<=width||lastWordEnd===null)lastWordEnd=index;wrapped.push((addPrefix?prefix:'')+substring(message,start,lastWordEnd));addPrefix=true;if(lastWordEnd>=message.length)return wrapped;if(lastWordEnd===index){while(index<message.length&&message[index]===' ')index++;start=index;mode='inWord';}else{start=lastWordStart;mode='atBreak';}startForLengthCalculations=start-prefix.length;lastWordEnd=null;}else{lastWordEnd=index;mode='inSpace';}
  }
}
