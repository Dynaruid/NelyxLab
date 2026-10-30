// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Reviewed port of services/raw_keyboard_macos.dart at 71e4717a61786faab4c7aa39825989305ed29e8a.
import { RawKeyEventData, rawInteger, rawText, rawKeyId, sealRawFields, sidePressed, modifierSide } from './raw-keyboard-data.ts';
import type {KeyboardSide,ModifierKey} from './raw-keyboard-data.ts';
import {LogicalKeyboardKey,PhysicalKeyboardKey} from './keyboard-key.ts';
import * as maps from './keyboard-platform-maps.ts';
function logical(id:number):LogicalKeyboardKey{return LogicalKeyboardKey.findKeyByKeyId(id)??new LogicalKeyboardKey(id);}
function unprintable(label:string):boolean{return label.length===1&&label.charCodeAt(0)>=0xf700&&label.charCodeAt(0)<=0xf8ff;}
export function runeToLowerCase(rune:number):number{return rune>0xd7ff?rune:String.fromCodePoint(rune).toLowerCase().charCodeAt(0);}
export interface RawKeyEventDataMacOsOptions {readonly characters?:string;readonly charactersIgnoringModifiers?:string;readonly keyCode?:number;readonly modifiers?:number;readonly specifiedLogicalKey?:number|null;}
export class RawKeyEventDataMacOs extends RawKeyEventData {
  readonly characters:string;
  readonly charactersIgnoringModifiers:string;
  readonly keyCode:number;
  readonly modifiers:number;
  readonly specifiedLogicalKey:number|null;
  constructor(options:RawKeyEventDataMacOsOptions={}) {
    super();
    this.characters=rawText((options.characters===undefined?'':options.characters));
    this.charactersIgnoringModifiers=rawText((options.charactersIgnoringModifiers===undefined?'':options.charactersIgnoringModifiers));
    this.keyCode=rawInteger((options.keyCode===undefined?0:options.keyCode));
    this.modifiers=rawInteger((options.modifiers===undefined?0:options.modifiers));
    const specifiedLogicalKey=(options.specifiedLogicalKey===undefined?null:options.specifiedLogicalKey);this.specifiedLogicalKey=specifiedLogicalKey===null?null:rawInteger(specifiedLogicalKey);
    sealRawFields(this,["characters", "charactersIgnoringModifiers", "keyCode", "modifiers", "specifiedLogicalKey"]);
  }
  static readonly modifierCapsLock=0x10000;
  static readonly modifierShift=0x20000;
  static readonly modifierLeftShift=0x02;
  static readonly modifierRightShift=0x04;
  static readonly modifierControl=0x40000;
  static readonly modifierLeftControl=0x01;
  static readonly modifierRightControl=0x2000;
  static readonly modifierOption=0x80000;
  static readonly modifierLeftOption=0x20;
  static readonly modifierRightOption=0x40;
  static readonly modifierCommand=0x100000;
  static readonly modifierLeftCommand=0x08;
  static readonly modifierRightCommand=0x10;
  static readonly modifierNumericPad=0x200000;
  static readonly modifierHelp=0x400000;
  static readonly modifierFunction=0x800000;
  static readonly deviceIndependentMask=0xffff0000;
  get keyLabel():string{return this.charactersIgnoringModifiers;}
  get physicalKey():PhysicalKeyboardKey{return maps.kMacOsToPhysicalKey.get(this.keyCode)??new PhysicalKeyboardKey(LogicalKeyboardKey.windowsPlane+this.keyCode);}
  get logicalKey():LogicalKeyboardKey{if(this.specifiedLogicalKey!==null)return logical(this.specifiedLogicalKey);const pad=maps.kMacOsNumPadMap.get(this.keyCode);if(pad)return pad;const known=maps.kMacOsToLogicalKey.get(this.keyCode);if(known)return known;const runes=[...this.keyLabel];if(runes.length===1&&!LogicalKeyboardKey.isControlCharacter(this.keyLabel)&&!unprintable(this.keyLabel))return logical(rawKeyId(LogicalKeyboardKey.unicodePlane,runeToLowerCase(runes[0]!.codePointAt(0)!)));return logical(rawKeyId(LogicalKeyboardKey.macosPlane,this.keyCode));}
  override shouldDispatchEvent():boolean{return !this.logicalKey.equals(LogicalKeyboardKey.fn);}
  isModifierPressed(key:ModifierKey,{side='any'}:{readonly side?:KeyboardSide}={}):boolean{switch(key){case 'controlModifier':return sidePressed(this.modifiers,side,(this.modifiers&RawKeyEventDataMacOs.deviceIndependentMask)&RawKeyEventDataMacOs.modifierControl,RawKeyEventDataMacOs.modifierLeftControl,RawKeyEventDataMacOs.modifierRightControl,'apple');case 'shiftModifier':return sidePressed(this.modifiers,side,(this.modifiers&RawKeyEventDataMacOs.deviceIndependentMask)&RawKeyEventDataMacOs.modifierShift,RawKeyEventDataMacOs.modifierLeftShift,RawKeyEventDataMacOs.modifierRightShift,'apple');case 'altModifier':return sidePressed(this.modifiers,side,(this.modifiers&RawKeyEventDataMacOs.deviceIndependentMask)&RawKeyEventDataMacOs.modifierOption,RawKeyEventDataMacOs.modifierLeftOption,RawKeyEventDataMacOs.modifierRightOption,'apple');case 'metaModifier':return sidePressed(this.modifiers,side,(this.modifiers&RawKeyEventDataMacOs.deviceIndependentMask)&RawKeyEventDataMacOs.modifierCommand,RawKeyEventDataMacOs.modifierLeftCommand,RawKeyEventDataMacOs.modifierRightCommand,'apple');case 'capsLockModifier':return (this.modifiers&RawKeyEventDataMacOs.modifierCapsLock)!==0;case 'numLockModifier':return false;case 'scrollLockModifier':return false;case 'functionModifier':return false;case 'symbolModifier':return false;}}
  getModifierSide(key:ModifierKey):KeyboardSide|null{switch(key){case 'controlModifier':return modifierSide(this.modifiers,RawKeyEventDataMacOs.modifierControl,RawKeyEventDataMacOs.modifierLeftControl,RawKeyEventDataMacOs.modifierRightControl,'windows');case 'shiftModifier':return modifierSide(this.modifiers,RawKeyEventDataMacOs.modifierShift,RawKeyEventDataMacOs.modifierLeftShift,RawKeyEventDataMacOs.modifierRightShift,'windows');case 'altModifier':return modifierSide(this.modifiers,RawKeyEventDataMacOs.modifierOption,RawKeyEventDataMacOs.modifierLeftOption,RawKeyEventDataMacOs.modifierRightOption,'windows');case 'metaModifier':return modifierSide(this.modifiers,RawKeyEventDataMacOs.modifierCommand,RawKeyEventDataMacOs.modifierLeftCommand,RawKeyEventDataMacOs.modifierRightCommand,'windows');case 'capsLockModifier':return 'all';case 'numLockModifier':return 'all';case 'scrollLockModifier':return 'all';case 'functionModifier':return 'all';case 'symbolModifier':return 'all';}}
  protected get equalityValues():readonly unknown[]{return [this.characters,this.charactersIgnoringModifiers,this.keyCode,this.modifiers];}
  protected get diagnosticFields():Readonly<Record<string,unknown>>{return {characters:this.characters,charactersIgnoringModifiers:this.charactersIgnoringModifiers,keyCode:this.keyCode,modifiers:this.modifiers,specifiedLogicalKey:this.specifiedLogicalKey};}
}
