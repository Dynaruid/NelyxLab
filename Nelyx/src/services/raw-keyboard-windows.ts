// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Reviewed port of services/raw_keyboard_windows.dart at 71e4717a61786faab4c7aa39825989305ed29e8a.
import {RawKeyEventData,rawInteger,rawText,rawBoolean,rawCharacter,rawKeyId,rawStringHash,sealRawFields,sidePressed,modifierSide} from './raw-keyboard-data.ts';
import type {KeyboardSide,ModifierKey} from './raw-keyboard-data.ts';
import {LogicalKeyboardKey,PhysicalKeyboardKey} from './keyboard-key.ts';
import * as maps from './keyboard-platform-maps.ts';
function logical(id:number):LogicalKeyboardKey{return LogicalKeyboardKey.findKeyByKeyId(id)??new LogicalKeyboardKey(id);}
export interface RawKeyEventDataWindowsOptions {readonly keyCode?:number;readonly scanCode?:number;readonly characterCodePoint?:number;readonly modifiers?:number;}
export class RawKeyEventDataWindows extends RawKeyEventData {
  readonly keyCode:number;
  readonly scanCode:number;
  readonly characterCodePoint:number;
  readonly modifiers:number;
  constructor(options:RawKeyEventDataWindowsOptions={}) {
    super();
    this.keyCode=rawInteger((options.keyCode===undefined?0:options.keyCode));
    this.scanCode=rawInteger((options.scanCode===undefined?0:options.scanCode));
    this.characterCodePoint=rawInteger((options.characterCodePoint===undefined?0:options.characterCodePoint));
    this.modifiers=rawInteger((options.modifiers===undefined?0:options.modifiers));
    sealRawFields(this,["keyCode", "scanCode", "characterCodePoint", "modifiers"]);
  }
  static readonly modifierShift=1 << 0;
  static readonly modifierLeftShift=1 << 1;
  static readonly modifierRightShift=1 << 2;
  static readonly modifierControl=1 << 3;
  static readonly modifierLeftControl=1 << 4;
  static readonly modifierRightControl=1 << 5;
  static readonly modifierAlt=1 << 6;
  static readonly modifierLeftAlt=1 << 7;
  static readonly modifierRightAlt=1 << 8;
  static readonly modifierLeftMeta=1 << 9;
  static readonly modifierRightMeta=1 << 10;
  static readonly modifierCaps=1 << 11;
  static readonly modifierNumLock=1 << 12;
  static readonly modifierScrollLock=1 << 13;
  get keyLabel():string{return rawCharacter(this.characterCodePoint);}
  get physicalKey():PhysicalKeyboardKey{return maps.kWindowsToPhysicalKey.get(this.scanCode)??new PhysicalKeyboardKey(LogicalKeyboardKey.windowsPlane+this.scanCode);}
  get logicalKey():LogicalKeyboardKey{const pad=maps.kWindowsNumPadMap.get(this.keyCode);if(pad)return pad;if(this.keyLabel&&!LogicalKeyboardKey.isControlCharacter(this.keyLabel))return logical(rawKeyId(LogicalKeyboardKey.unicodePlane,this.characterCodePoint));return maps.kWindowsToLogicalKey.get(this.keyCode)??logical(rawKeyId(LogicalKeyboardKey.windowsPlane,this.keyCode));}
  override shouldDispatchEvent():boolean{return this.keyCode!==0xe5;}
  isModifierPressed(key:ModifierKey,{side='any'}:{readonly side?:KeyboardSide}={}):boolean{switch(key){case 'controlModifier':return sidePressed(this.modifiers,side,RawKeyEventDataWindows.modifierControl,RawKeyEventDataWindows.modifierLeftControl,RawKeyEventDataWindows.modifierRightControl,'windows');case 'shiftModifier':return sidePressed(this.modifiers,side,RawKeyEventDataWindows.modifierShift,RawKeyEventDataWindows.modifierLeftShift,RawKeyEventDataWindows.modifierRightShift,'windows');case 'altModifier':return sidePressed(this.modifiers,side,RawKeyEventDataWindows.modifierAlt,RawKeyEventDataWindows.modifierLeftAlt,RawKeyEventDataWindows.modifierRightAlt,'windows');case 'metaModifier':return sidePressed(this.modifiers,side,RawKeyEventDataWindows.modifierLeftMeta | RawKeyEventDataWindows.modifierRightMeta,RawKeyEventDataWindows.modifierLeftMeta,RawKeyEventDataWindows.modifierRightMeta,'windows');case 'capsLockModifier':return (this.modifiers&RawKeyEventDataWindows.modifierCaps)!==0;case 'numLockModifier':return (this.modifiers&RawKeyEventDataWindows.modifierNumLock)!==0;case 'scrollLockModifier':return (this.modifiers&RawKeyEventDataWindows.modifierScrollLock)!==0;case 'functionModifier':return false;case 'symbolModifier':return false;}}
  getModifierSide(key:ModifierKey):KeyboardSide|null{switch(key){case 'controlModifier':return modifierSide(this.modifiers,RawKeyEventDataWindows.modifierControl,RawKeyEventDataWindows.modifierLeftControl,RawKeyEventDataWindows.modifierRightControl,'windows');case 'shiftModifier':return modifierSide(this.modifiers,RawKeyEventDataWindows.modifierShift,RawKeyEventDataWindows.modifierLeftShift,RawKeyEventDataWindows.modifierRightShift,'windows');case 'altModifier':return modifierSide(this.modifiers,RawKeyEventDataWindows.modifierAlt,RawKeyEventDataWindows.modifierLeftAlt,RawKeyEventDataWindows.modifierRightAlt,'windows');case 'metaModifier':return modifierSide(this.modifiers,0,RawKeyEventDataWindows.modifierLeftMeta,RawKeyEventDataWindows.modifierRightMeta,'windows');case 'capsLockModifier':return 'all';case 'numLockModifier':return 'all';case 'scrollLockModifier':return 'all';case 'functionModifier':return 'all';case 'symbolModifier':return 'all';}}
  protected get equalityValues():readonly unknown[]{return [this.keyCode,this.scanCode,this.characterCodePoint,this.modifiers];}
  protected get diagnosticFields():Readonly<Record<string,unknown>>{return {keyCode:this.keyCode,scanCode:this.scanCode,characterCodePoint:this.characterCodePoint,modifiers:this.modifiers};}
}
