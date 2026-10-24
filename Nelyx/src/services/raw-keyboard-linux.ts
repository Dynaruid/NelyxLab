// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Reviewed port of services/raw_keyboard_linux.dart at 71e4717a61786faab4c7aa39825989305ed29e8a.
import {RawKeyEventData,rawInteger,rawText,rawBoolean,rawCharacter,rawKeyId,rawStringHash,sealRawFields,sidePressed,modifierSide} from './raw-keyboard-data.ts';
import type {KeyboardSide,ModifierKey} from './raw-keyboard-data.ts';
import {LogicalKeyboardKey,PhysicalKeyboardKey} from './keyboard-key.ts';
import * as maps from './keyboard-platform-maps.ts';
function logical(id:number):LogicalKeyboardKey{return LogicalKeyboardKey.findKeyByKeyId(id)??new LogicalKeyboardKey(id);}
import {KeyHelper} from './raw-keyboard-linux-key-helper.ts';
export interface RawKeyEventDataLinuxOptions {readonly keyHelper:KeyHelper;readonly unicodeScalarValues?:number;readonly scanCode?:number;readonly keyCode?:number;readonly modifiers?:number;readonly isDown:boolean;readonly specifiedLogicalKey?:number|null;}
export class RawKeyEventDataLinux extends RawKeyEventData {
  readonly keyHelper:KeyHelper;
  readonly unicodeScalarValues:number;
  readonly scanCode:number;
  readonly keyCode:number;
  readonly modifiers:number;
  readonly isDown:boolean;
  readonly specifiedLogicalKey:number|null;
  constructor(options:RawKeyEventDataLinuxOptions) {
    super();
    if(options.keyHelper==null)throw new TypeError('Raw Linux data requires KeyHelper');this.keyHelper=options.keyHelper;
    this.unicodeScalarValues=rawInteger((options.unicodeScalarValues===undefined?0:options.unicodeScalarValues));
    this.scanCode=rawInteger((options.scanCode===undefined?0:options.scanCode));
    this.keyCode=rawInteger((options.keyCode===undefined?0:options.keyCode));
    this.modifiers=rawInteger((options.modifiers===undefined?0:options.modifiers));
    this.isDown=rawBoolean((options.isDown));
    const specifiedLogicalKey=(options.specifiedLogicalKey===undefined?null:options.specifiedLogicalKey);this.specifiedLogicalKey=specifiedLogicalKey===null?null:rawInteger(specifiedLogicalKey);
    sealRawFields(this,["keyHelper", "unicodeScalarValues", "scanCode", "keyCode", "modifiers", "isDown", "specifiedLogicalKey"]);
  }
  get keyLabel():string{return rawCharacter(this.unicodeScalarValues);}
  get physicalKey():PhysicalKeyboardKey{return maps.kLinuxToPhysicalKey.get(this.scanCode)??new PhysicalKeyboardKey(LogicalKeyboardKey.webPlane+this.scanCode);}
  get logicalKey():LogicalKeyboardKey{if(this.specifiedLogicalKey!==null)return logical(this.specifiedLogicalKey);const pad=this.keyHelper.numpadKey(this.keyCode);if(pad)return pad;if(this.keyLabel&&!LogicalKeyboardKey.isControlCharacter(this.keyLabel))return logical(rawKeyId(LogicalKeyboardKey.unicodePlane,this.unicodeScalarValues));return this.keyHelper.logicalKey(this.keyCode)??logical(rawKeyId(this.keyHelper.platformPlane,this.keyCode));}
  isModifierPressed(key:ModifierKey,{side='any'}:{readonly side?:KeyboardSide}={}):boolean{return this.keyHelper.isModifierPressed(key,this.modifiers,{side,keyCode:this.keyCode,isDown:this.isDown});}
  getModifierSide(key:ModifierKey):KeyboardSide{return this.keyHelper.getModifierSide(key);}
  protected get equalityValues():readonly unknown[]{return [this.keyHelper.constructor,this.unicodeScalarValues,this.scanCode,this.keyCode,this.modifiers,this.isDown];}
  protected get diagnosticFields():Readonly<Record<string,unknown>>{return {unicodeScalarValues:this.unicodeScalarValues,scanCode:this.scanCode,keyCode:this.keyCode,modifiers:this.modifiers,isDown:this.isDown,specifiedLogicalKey:this.specifiedLogicalKey,toolkit:this.keyHelper.debugToolkit};}
}
