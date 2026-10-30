// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Reviewed port of services/raw_keyboard_fuchsia.dart at 71e4717a61786faab4c7aa39825989305ed29e8a.
import { RawKeyEventData, rawInteger, rawCharacter, rawKeyId, sealRawFields, sidePressed, modifierSide } from './raw-keyboard-data.ts';
import type {KeyboardSide,ModifierKey} from './raw-keyboard-data.ts';
import {LogicalKeyboardKey,PhysicalKeyboardKey} from './keyboard-key.ts';
import * as maps from './keyboard-platform-maps.ts';
function logical(id:number):LogicalKeyboardKey{return LogicalKeyboardKey.findKeyByKeyId(id)??new LogicalKeyboardKey(id);}
export interface RawKeyEventDataFuchsiaOptions {readonly hidUsage?:number;readonly codePoint?:number;readonly modifiers?:number;}
export class RawKeyEventDataFuchsia extends RawKeyEventData {
  readonly hidUsage:number;
  readonly codePoint:number;
  readonly modifiers:number;
  constructor(options:RawKeyEventDataFuchsiaOptions={}) {
    super();
    this.hidUsage=rawInteger((options.hidUsage===undefined?0:options.hidUsage));
    this.codePoint=rawInteger((options.codePoint===undefined?0:options.codePoint));
    this.modifiers=rawInteger((options.modifiers===undefined?0:options.modifiers));
    sealRawFields(this,["hidUsage", "codePoint", "modifiers"]);
  }
  static readonly modifierNone=0x0;
  static readonly modifierCapsLock=0x1;
  static readonly modifierLeftShift=0x2;
  static readonly modifierRightShift=0x4;
  static readonly modifierShift=RawKeyEventDataFuchsia.modifierLeftShift | RawKeyEventDataFuchsia.modifierRightShift;
  static readonly modifierLeftControl=0x8;
  static readonly modifierRightControl=0x10;
  static readonly modifierControl=RawKeyEventDataFuchsia.modifierLeftControl | RawKeyEventDataFuchsia.modifierRightControl;
  static readonly modifierLeftAlt=0x20;
  static readonly modifierRightAlt=0x40;
  static readonly modifierAlt=RawKeyEventDataFuchsia.modifierLeftAlt | RawKeyEventDataFuchsia.modifierRightAlt;
  static readonly modifierLeftMeta=0x80;
  static readonly modifierRightMeta=0x100;
  static readonly modifierMeta=RawKeyEventDataFuchsia.modifierLeftMeta | RawKeyEventDataFuchsia.modifierRightMeta;
  get keyLabel():string{return rawCharacter(this.codePoint);}
  get physicalKey():PhysicalKeyboardKey{return maps.kFuchsiaToPhysicalKey.get(this.hidUsage)??new PhysicalKeyboardKey(LogicalKeyboardKey.fuchsiaPlane+this.hidUsage);}
  get logicalKey():LogicalKeyboardKey{const id=rawKeyId(this.codePoint!==0?LogicalKeyboardKey.unicodePlane:LogicalKeyboardKey.fuchsiaPlane,this.codePoint!==0?this.codePoint:this.hidUsage);return maps.kFuchsiaToLogicalKey.get(id)??logical(id);}
  isModifierPressed(key:ModifierKey,{side='any'}:{readonly side?:KeyboardSide}={}):boolean{switch(key){case 'controlModifier':return sidePressed(this.modifiers,side,RawKeyEventDataFuchsia.modifierControl,RawKeyEventDataFuchsia.modifierLeftControl,RawKeyEventDataFuchsia.modifierRightControl,'requireAny');case 'shiftModifier':return sidePressed(this.modifiers,side,RawKeyEventDataFuchsia.modifierShift,RawKeyEventDataFuchsia.modifierLeftShift,RawKeyEventDataFuchsia.modifierRightShift,'requireAny');case 'altModifier':return sidePressed(this.modifiers,side,RawKeyEventDataFuchsia.modifierAlt,RawKeyEventDataFuchsia.modifierLeftAlt,RawKeyEventDataFuchsia.modifierRightAlt,'requireAny');case 'metaModifier':return sidePressed(this.modifiers,side,RawKeyEventDataFuchsia.modifierMeta,RawKeyEventDataFuchsia.modifierLeftMeta,RawKeyEventDataFuchsia.modifierRightMeta,'requireAny');case 'capsLockModifier':return (this.modifiers&RawKeyEventDataFuchsia.modifierCapsLock)!==0;case 'numLockModifier':return false;case 'scrollLockModifier':return false;case 'functionModifier':return false;case 'symbolModifier':return false;}}
  getModifierSide(key:ModifierKey):KeyboardSide|null{switch(key){case 'controlModifier':return modifierSide(this.modifiers,RawKeyEventDataFuchsia.modifierControl,RawKeyEventDataFuchsia.modifierLeftControl,RawKeyEventDataFuchsia.modifierRightControl,'fuchsia');case 'shiftModifier':return modifierSide(this.modifiers,RawKeyEventDataFuchsia.modifierShift,RawKeyEventDataFuchsia.modifierLeftShift,RawKeyEventDataFuchsia.modifierRightShift,'fuchsia');case 'altModifier':return modifierSide(this.modifiers,RawKeyEventDataFuchsia.modifierAlt,RawKeyEventDataFuchsia.modifierLeftAlt,RawKeyEventDataFuchsia.modifierRightAlt,'fuchsia');case 'metaModifier':return modifierSide(this.modifiers,RawKeyEventDataFuchsia.modifierMeta,RawKeyEventDataFuchsia.modifierLeftMeta,RawKeyEventDataFuchsia.modifierRightMeta,'fuchsia');case 'capsLockModifier':return (this.modifiers&RawKeyEventDataFuchsia.modifierCapsLock)!==0?'all':null;case 'numLockModifier':return null;case 'scrollLockModifier':return null;case 'functionModifier':return null;case 'symbolModifier':return null;}}
  protected get equalityValues():readonly unknown[]{return [this.hidUsage,this.codePoint,this.modifiers];}
  protected get diagnosticFields():Readonly<Record<string,unknown>>{return {hidUsage:this.hidUsage,codePoint:this.codePoint,modifiers:this.modifiers};}
}
