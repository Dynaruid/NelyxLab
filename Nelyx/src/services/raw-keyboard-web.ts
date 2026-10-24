// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Reviewed port of services/raw_keyboard_web.dart at 71e4717a61786faab4c7aa39825989305ed29e8a.
import {RawKeyEventData,rawInteger,rawText,rawBoolean,rawCharacter,rawKeyId,rawStringHash,sealRawFields,sidePressed,modifierSide} from './raw-keyboard-data.ts';
import type {KeyboardSide,ModifierKey} from './raw-keyboard-data.ts';
import {LogicalKeyboardKey,PhysicalKeyboardKey} from './keyboard-key.ts';
import * as maps from './keyboard-platform-maps.ts';
function logical(id:number):LogicalKeyboardKey{return LogicalKeyboardKey.findKeyByKeyId(id)??new LogicalKeyboardKey(id);}
export interface RawKeyEventDataWebOptions {readonly code:string;readonly key:string;readonly location?:number;readonly metaState?:number;readonly keyCode?:number;}
export class RawKeyEventDataWeb extends RawKeyEventData {
  readonly code:string;
  readonly key:string;
  readonly location:number;
  readonly metaState:number;
  readonly keyCode:number;
  constructor(options:RawKeyEventDataWebOptions) {
    super();
    this.code=rawText((options.code));
    this.key=rawText((options.key));
    this.location=rawInteger((options.location===undefined?0:options.location));
    this.metaState=rawInteger((options.metaState===undefined?RawKeyEventDataWeb.modifierNone:options.metaState));
    this.keyCode=rawInteger((options.keyCode===undefined?0:options.keyCode));
    sealRawFields(this,["code", "key", "location", "metaState", "keyCode"]);
  }
  static readonly modifierNone=0;
  static readonly modifierShift=0x01;
  static readonly modifierAlt=0x02;
  static readonly modifierControl=0x04;
  static readonly modifierMeta=0x08;
  static readonly modifierNumLock=0x10;
  static readonly modifierCapsLock=0x20;
  static readonly modifierScrollLock=0x40;
  get keyLabel():string{return this.key==='Unidentified'?'':this.key.length===1?this.key:'';}
  get physicalKey():PhysicalKeyboardKey{return maps.kWebToPhysicalKey.get(this.code)??new PhysicalKeyboardKey(LogicalKeyboardKey.webPlane+rawStringHash(this.code));}
  get logicalKey():LogicalKeyboardKey{const locations=maps.kWebLocationMap.get(this.key);if(locations){if(this.location<0||this.location>=locations.length)throw new RangeError('Raw Web keyboard location is out of range');const location=locations[this.location];if(location)return location;}return maps.kWebToLogicalKey.get(this.key)??logical(this.key.length===1?this.key.toLowerCase().charCodeAt(0):LogicalKeyboardKey.webPlane+rawStringHash(this.code));}
  isModifierPressed(key:ModifierKey,_options:{readonly side?:KeyboardSide}={}):boolean{const mask=({controlModifier:RawKeyEventDataWeb.modifierControl,shiftModifier:RawKeyEventDataWeb.modifierShift,altModifier:RawKeyEventDataWeb.modifierAlt,metaModifier:RawKeyEventDataWeb.modifierMeta,numLockModifier:RawKeyEventDataWeb.modifierNumLock,capsLockModifier:RawKeyEventDataWeb.modifierCapsLock,scrollLockModifier:RawKeyEventDataWeb.modifierScrollLock,functionModifier:0,symbolModifier:0})[key];return (this.metaState&mask)!==0;}
  getModifierSide(_key:ModifierKey):KeyboardSide{return 'any';}
  protected get equalityValues():readonly unknown[]{return [this.code,this.key,this.location,this.metaState,this.keyCode];}
  protected get diagnosticFields():Readonly<Record<string,unknown>>{return {code:this.code,key:this.key,location:this.location,metaState:this.metaState,keyCode:this.keyCode};}
}
