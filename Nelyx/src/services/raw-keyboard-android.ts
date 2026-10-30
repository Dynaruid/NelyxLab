// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Reviewed port of services/raw_keyboard_android.dart at 71e4717a61786faab4c7aa39825989305ed29e8a.
import { RawKeyEventData, rawInteger, rawCharacter, rawKeyId, sealRawFields, sidePressed, modifierSide } from './raw-keyboard-data.ts';
import type {KeyboardSide,ModifierKey} from './raw-keyboard-data.ts';
import {LogicalKeyboardKey,PhysicalKeyboardKey} from './keyboard-key.ts';
import * as maps from './keyboard-platform-maps.ts';
function logical(id:number):LogicalKeyboardKey{return LogicalKeyboardKey.findKeyByKeyId(id)??new LogicalKeyboardKey(id);}
export interface RawKeyEventDataAndroidOptions {readonly flags?:number;readonly codePoint?:number;readonly plainCodePoint?:number;readonly keyCode?:number;readonly scanCode?:number;readonly metaState?:number;readonly eventSource?:number;readonly vendorId?:number;readonly productId?:number;readonly deviceId?:number;readonly repeatCount?:number;}
export class RawKeyEventDataAndroid extends RawKeyEventData {
  readonly flags:number;
  readonly codePoint:number;
  readonly plainCodePoint:number;
  readonly keyCode:number;
  readonly scanCode:number;
  readonly metaState:number;
  readonly eventSource:number;
  readonly vendorId:number;
  readonly productId:number;
  readonly deviceId:number;
  readonly repeatCount:number;
  constructor(options:RawKeyEventDataAndroidOptions={}) {
    super();
    this.flags=rawInteger((options.flags===undefined?0:options.flags));
    this.codePoint=rawInteger((options.codePoint===undefined?0:options.codePoint));
    this.plainCodePoint=rawInteger((options.plainCodePoint===undefined?0:options.plainCodePoint));
    this.keyCode=rawInteger((options.keyCode===undefined?0:options.keyCode));
    this.scanCode=rawInteger((options.scanCode===undefined?0:options.scanCode));
    this.metaState=rawInteger((options.metaState===undefined?0:options.metaState));
    this.eventSource=rawInteger((options.eventSource===undefined?0:options.eventSource));
    this.vendorId=rawInteger((options.vendorId===undefined?0:options.vendorId));
    this.productId=rawInteger((options.productId===undefined?0:options.productId));
    this.deviceId=rawInteger((options.deviceId===undefined?0:options.deviceId));
    this.repeatCount=rawInteger((options.repeatCount===undefined?0:options.repeatCount));
    sealRawFields(this,["flags", "codePoint", "plainCodePoint", "keyCode", "scanCode", "metaState", "eventSource", "vendorId", "productId", "deviceId", "repeatCount"]);
  }
  private static readonly sourceJoystick=0x01000010;
  static readonly modifierNone=0;
  static readonly modifierAlt=0x02;
  static readonly modifierLeftAlt=0x10;
  static readonly modifierRightAlt=0x20;
  static readonly modifierShift=0x01;
  static readonly modifierLeftShift=0x40;
  static readonly modifierRightShift=0x80;
  static readonly modifierSym=0x04;
  static readonly modifierFunction=0x08;
  static readonly modifierControl=0x1000;
  static readonly modifierLeftControl=0x2000;
  static readonly modifierRightControl=0x4000;
  static readonly modifierMeta=0x10000;
  static readonly modifierLeftMeta=0x20000;
  static readonly modifierRightMeta=0x40000;
  static readonly modifierCapsLock=0x100000;
  static readonly modifierNumLock=0x200000;
  static readonly modifierScrollLock=0x400000;
  get keyLabel():string{return rawCharacter(this.plainCodePoint&0x7fffffff);}
  get physicalKey():PhysicalKeyboardKey{const known=maps.kAndroidToPhysicalKey.get(this.scanCode);if(known)return known;if((this.eventSource&RawKeyEventDataAndroid.sourceJoystick)===RawKeyEventDataAndroid.sourceJoystick){const key=maps.kAndroidToLogicalKey.get(this.keyCode);for(const [l,k] of [[LogicalKeyboardKey.arrowUp,PhysicalKeyboardKey.arrowUp],[LogicalKeyboardKey.arrowDown,PhysicalKeyboardKey.arrowDown],[LogicalKeyboardKey.arrowLeft,PhysicalKeyboardKey.arrowLeft],[LogicalKeyboardKey.arrowRight,PhysicalKeyboardKey.arrowRight]] as const)if(key?.equals(l))return k;}return new PhysicalKeyboardKey(LogicalKeyboardKey.androidPlane+this.scanCode);}
  get logicalKey():LogicalKeyboardKey{const pad=maps.kAndroidNumPadMap.get(this.keyCode);if(pad)return pad;if(this.keyLabel&&!LogicalKeyboardKey.isControlCharacter(this.keyLabel))return logical(rawKeyId(LogicalKeyboardKey.unicodePlane,this.plainCodePoint&0x7fffffff));return maps.kAndroidToLogicalKey.get(this.keyCode)??logical(rawKeyId(LogicalKeyboardKey.androidPlane,this.keyCode));}
  isModifierPressed(key:ModifierKey,{side='any'}:{readonly side?:KeyboardSide}={}):boolean{switch(key){case 'controlModifier':return sidePressed(this.metaState,side,RawKeyEventDataAndroid.modifierControl,RawKeyEventDataAndroid.modifierLeftControl,RawKeyEventDataAndroid.modifierRightControl,'requireAny');case 'shiftModifier':return sidePressed(this.metaState,side,RawKeyEventDataAndroid.modifierShift,RawKeyEventDataAndroid.modifierLeftShift,RawKeyEventDataAndroid.modifierRightShift,'requireAny');case 'altModifier':return sidePressed(this.metaState,side,RawKeyEventDataAndroid.modifierAlt,RawKeyEventDataAndroid.modifierLeftAlt,RawKeyEventDataAndroid.modifierRightAlt,'requireAny');case 'metaModifier':return sidePressed(this.metaState,side,RawKeyEventDataAndroid.modifierMeta,RawKeyEventDataAndroid.modifierLeftMeta,RawKeyEventDataAndroid.modifierRightMeta,'requireAny');case 'capsLockModifier':return (this.metaState&RawKeyEventDataAndroid.modifierCapsLock)!==0;case 'numLockModifier':return (this.metaState&RawKeyEventDataAndroid.modifierNumLock)!==0;case 'scrollLockModifier':return (this.metaState&RawKeyEventDataAndroid.modifierScrollLock)!==0;case 'functionModifier':return (this.metaState&RawKeyEventDataAndroid.modifierFunction)!==0;case 'symbolModifier':return (this.metaState&RawKeyEventDataAndroid.modifierSym)!==0;}}
  getModifierSide(key:ModifierKey):KeyboardSide|null{switch(key){case 'controlModifier':return modifierSide(this.metaState,RawKeyEventDataAndroid.modifierControl,RawKeyEventDataAndroid.modifierLeftControl,RawKeyEventDataAndroid.modifierRightControl,'android');case 'shiftModifier':return modifierSide(this.metaState,RawKeyEventDataAndroid.modifierShift,RawKeyEventDataAndroid.modifierLeftShift,RawKeyEventDataAndroid.modifierRightShift,'android');case 'altModifier':return modifierSide(this.metaState,RawKeyEventDataAndroid.modifierAlt,RawKeyEventDataAndroid.modifierLeftAlt,RawKeyEventDataAndroid.modifierRightAlt,'android');case 'metaModifier':return modifierSide(this.metaState,RawKeyEventDataAndroid.modifierMeta,RawKeyEventDataAndroid.modifierLeftMeta,RawKeyEventDataAndroid.modifierRightMeta,'android');case 'capsLockModifier':return 'all';case 'numLockModifier':return 'all';case 'scrollLockModifier':return 'all';case 'functionModifier':return 'all';case 'symbolModifier':return 'all';}}
  protected get equalityValues():readonly unknown[]{return [this.flags,this.codePoint,this.plainCodePoint,this.keyCode,this.scanCode,this.metaState];}
  protected get diagnosticFields():Readonly<Record<string,unknown>>{return {flags:this.flags,codePoint:this.codePoint,plainCodePoint:this.plainCodePoint,keyCode:this.keyCode,scanCode:this.scanCode,metaState:this.metaState};}
}
