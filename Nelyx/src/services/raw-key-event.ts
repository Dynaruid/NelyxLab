// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// RawKeyEvent family adapted from pinned services/raw_keyboard.dart.
import {RawKeyEventData,rawInteger,rawText,rawBoolean,rawCharacter,sealRawFields} from './raw-keyboard-data.ts';
import {RawKeyEventDataAndroid} from './raw-keyboard-android.ts';
import {RawKeyEventDataFuchsia} from './raw-keyboard-fuchsia.ts';
import {RawKeyEventDataMacOs} from './raw-keyboard-macos.ts';
import {RawKeyEventDataIos} from './raw-keyboard-ios.ts';
import {RawKeyEventDataLinux} from './raw-keyboard-linux.ts';
import {KeyHelper} from './raw-keyboard-linux-key-helper.ts';
import {RawKeyEventDataWindows} from './raw-keyboard-windows.ts';
import {RawKeyEventDataWeb} from './raw-keyboard-web.ts';
import {RawKeyboard} from './raw-keyboard.ts';
import {LogicalKeyboardKey} from './keyboard-key.ts';
import type {PhysicalKeyboardKey} from './keyboard-key.ts';
import {FoundationPlatform} from '../foundation/platform.ts';
import {FlutterError} from '../foundation/flutter-error.ts';
import {DiagnosticableNode,DiagnosticsProperty} from '../foundation/diagnostics.ts';
import type {Diagnosticable,DiagnosticsOptions,DiagnosticPropertiesBuilder} from '../foundation/diagnostics.ts';
export type RawKeyMessage=ReadonlyMap<string,unknown>|Readonly<Record<string,unknown>>;
export interface RawKeyEventOptions {readonly data:RawKeyEventData;readonly character?:string|null;readonly repeat?:boolean;/** App-owned embedding state; source uses its global RawKeyboard. */readonly keyboard?:RawKeyboard}
const keyboardOwners=new WeakMap<RawKeyEvent,RawKeyboard>();
export abstract class RawKeyEvent implements Diagnosticable {
  readonly data:RawKeyEventData;readonly character:string|null;readonly repeat:boolean;
  constructor(options:RawKeyEventOptions){if(!(options.data instanceof RawKeyEventData))throw new TypeError('Raw event requires platform key data');this.data=options.data;this.character=options.character==null?null:rawText(options.character);this.repeat=rawBoolean(options.repeat===undefined?false:options.repeat);if(options.keyboard)keyboardOwners.set(this,options.keyboard);sealRawFields(this,['data','character','repeat']);}
  static fromMessage(message:RawKeyMessage,{keyboard=RawKeyboard.instance}:{readonly keyboard?:RawKeyboard}={}):RawKeyEvent{
    if(!message||typeof message!=='object')throw new TypeError('Raw key message must be a map');
    const get=(name:string):unknown=>typeof (message as ReadonlyMap<string,unknown>).get==='function'?(message as ReadonlyMap<string,unknown>).get(name):(message as Readonly<Record<string,unknown>>)[name];
    const integer=(name:string):number=>get(name)==null?0:rawInteger(get(name) as number),text=(name:string):string=>get(name)==null?'':rawText(get(name) as string),nullableInteger=(name:string):number|null=>get(name)==null?null:rawInteger(get(name) as number);
    let character:string|null=null,data:RawKeyEventData;
    const web=()=>{const key=text('key');if(key.length===1)character=key;return new RawKeyEventDataWeb({code:text('code'),key,location:integer('location'),metaState:integer('metaState'),keyCode:integer('keyCode')});};
    if(FoundationPlatform.hostEnvironment.kind==='web')data=web();
    else switch(rawText(get('keymap') as string)){
      case 'android':data=new RawKeyEventDataAndroid({flags:integer('flags'),codePoint:integer('codePoint'),plainCodePoint:integer('plainCodePoint'),keyCode:integer('keyCode'),scanCode:integer('scanCode'),metaState:integer('metaState'),eventSource:integer('source'),vendorId:integer('vendorId'),productId:integer('productId'),deviceId:integer('deviceId'),repeatCount:integer('repeatCount')});character=get('character')==null?null:rawText(get('character') as string);break;
      case 'fuchsia':data=new RawKeyEventDataFuchsia({hidUsage:integer('hidUsage'),codePoint:integer('codePoint'),modifiers:integer('modifiers')});character=integer('codePoint')===0?null:rawCharacter(integer('codePoint'));break;
      case 'macos':data=new RawKeyEventDataMacOs({characters:text('characters'),charactersIgnoringModifiers:text('charactersIgnoringModifiers'),keyCode:integer('keyCode'),modifiers:integer('modifiers'),specifiedLogicalKey:nullableInteger('specifiedLogicalKey')});character=get('characters')==null?null:rawText(get('characters') as string);break;
      case 'ios':data=new RawKeyEventDataIos({characters:text('characters'),charactersIgnoringModifiers:text('charactersIgnoringModifiers'),keyCode:integer('keyCode'),modifiers:integer('modifiers')});character=text('characters')||null;break;
      case 'linux':data=new RawKeyEventDataLinux({keyHelper:KeyHelper.forToolkit(text('toolkit')),unicodeScalarValues:integer('unicodeScalarValues'),keyCode:integer('keyCode'),scanCode:integer('scanCode'),modifiers:integer('modifiers'),isDown:get('type')==='keydown',specifiedLogicalKey:nullableInteger('specifiedLogicalKey')});character=integer('unicodeScalarValues')===0?null:rawCharacter(integer('unicodeScalarValues'));break;
      case 'windows':data=new RawKeyEventDataWindows({keyCode:integer('keyCode'),scanCode:integer('scanCode'),characterCodePoint:integer('characterCodePoint'),modifiers:integer('modifiers')});character=integer('characterCodePoint')===0?null:rawCharacter(integer('characterCodePoint'));break;
      case 'web':data=web();break;
      default:throw new FlutterError('Unknown keymap for key events: '+String(get('keymap')));
    }
    const type=rawText(get('type') as string);if(type==='keydown')return new RawKeyDownEvent({data,character,repeat:keyboard.physicalKeysPressed.has(data.physicalKey),keyboard});if(type==='keyup')return new RawKeyUpEvent({data,keyboard});throw new FlutterError('Unknown key event type: '+type);
  }
  isKeyPressed(key:LogicalKeyboardKey):boolean{return (keyboardOwners.get(this)??RawKeyboard.instance).keysPressed.has(key);}
  get isControlPressed():boolean{return this.isKeyPressed(LogicalKeyboardKey.controlLeft)||this.isKeyPressed(LogicalKeyboardKey.controlRight);}
  get isShiftPressed():boolean{return this.isKeyPressed(LogicalKeyboardKey.shiftLeft)||this.isKeyPressed(LogicalKeyboardKey.shiftRight);}
  get isAltPressed():boolean{return this.isKeyPressed(LogicalKeyboardKey.altLeft)||this.isKeyPressed(LogicalKeyboardKey.altRight);}
  get isMetaPressed():boolean{return this.isKeyPressed(LogicalKeyboardKey.metaLeft)||this.isKeyPressed(LogicalKeyboardKey.metaRight);}
  get physicalKey():PhysicalKeyboardKey{return this.data.physicalKey;}get logicalKey():LogicalKeyboardKey{return this.data.logicalKey;}
  debugFillProperties(properties:DiagnosticPropertiesBuilder):void{properties.add(new DiagnosticsProperty('logicalKey',this.logicalKey));properties.add(new DiagnosticsProperty('physicalKey',this.physicalKey));if(this instanceof RawKeyDownEvent)properties.add(new DiagnosticsProperty('repeat',this.repeat));}
  toDiagnosticsNode(options:DiagnosticsOptions={}){return new DiagnosticableNode(this,options);}toStringShort():string{return this.constructor.name;}
}
export class RawKeyDownEvent extends RawKeyEvent {constructor(options:RawKeyEventOptions){super(options);}}
export class RawKeyUpEvent extends RawKeyEvent {constructor(options:Omit<RawKeyEventOptions,'repeat'>){super({...options,repeat:false});}}
export type RawKeyEventHandler=(event:RawKeyEvent)=>boolean;
