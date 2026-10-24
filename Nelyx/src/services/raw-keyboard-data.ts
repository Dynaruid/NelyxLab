// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// RawKeyEventData and enum dependencies adapted from pinned raw_keyboard.dart.
import {DiagnosticableNode,DiagnosticsProperty} from '../foundation/diagnostics.ts';
import type {Diagnosticable,DiagnosticsOptions,DiagnosticPropertiesBuilder} from '../foundation/diagnostics.ts';
import type {LogicalKeyboardKey,PhysicalKeyboardKey} from './keyboard-key.ts';
export const KeyboardSide=Object.freeze({any:'any',left:'left',right:'right',all:'all'} as const);
export type KeyboardSide=typeof KeyboardSide[keyof typeof KeyboardSide];
export const ModifierKey=Object.freeze({controlModifier:'controlModifier',shiftModifier:'shiftModifier',altModifier:'altModifier',metaModifier:'metaModifier',capsLockModifier:'capsLockModifier',numLockModifier:'numLockModifier',scrollLockModifier:'scrollLockModifier',functionModifier:'functionModifier',symbolModifier:'symbolModifier'} as const);
export type ModifierKey=typeof ModifierKey[keyof typeof ModifierKey];
export abstract class RawKeyEventData implements Diagnosticable {
  abstract isModifierPressed(key:ModifierKey,options?:{readonly side?:KeyboardSide}):boolean;
  abstract getModifierSide(key:ModifierKey):KeyboardSide|null;
  abstract readonly physicalKey:PhysicalKeyboardKey;
  abstract readonly logicalKey:LogicalKeyboardKey;
  abstract readonly keyLabel:string;
  protected get equalityValues():readonly unknown[]{return [this];}
  protected get diagnosticFields():Readonly<Record<string,unknown>>{return {};}
  get isControlPressed():boolean{return this.isModifierPressed('controlModifier');}
  get isShiftPressed():boolean{return this.isModifierPressed('shiftModifier');}
  get isAltPressed():boolean{return this.isModifierPressed('altModifier');}
  get isMetaPressed():boolean{return this.isModifierPressed('metaModifier');}
  get modifiersPressed():Map<ModifierKey,KeyboardSide>{const result=new Map<ModifierKey,KeyboardSide>();for(const key of Object.values(ModifierKey))if(this.isModifierPressed(key)){const side=this.getModifierSide(key);if(side!==null)result.set(key,side);}return result;}
  shouldDispatchEvent():boolean{return true;}
  equals(other:unknown):boolean{return this===other||other instanceof RawKeyEventData&&other.constructor===this.constructor&&this.equalityValues.length===other.equalityValues.length&&this.equalityValues.every((value,index)=>value===other.equalityValues[index]);}
  get hashCode():number{let hash=0x345678;for(const value of this.equalityValues){let part:number;if((typeof value==='object'&&value!==null)||typeof value==='function'){part=identityHashes.get(value)??++nextIdentityHash;identityHashes.set(value,part);}else part=typeof value==='number'?(value>>>0)^Math.floor(value/0x100000000):typeof value==='boolean'?Number(value):value===null?7:rawStringHash(String(value));hash=Math.imul(hash^part,1000003)>>>0;}return hash;}
  debugFillProperties(properties:DiagnosticPropertiesBuilder):void{for(const [name,value] of Object.entries(this.diagnosticFields))properties.add(new DiagnosticsProperty(name,value,{...(value===null?{defaultValue:null}:{})}));}
  toDiagnosticsNode(options:DiagnosticsOptions={}){return new DiagnosticableNode(this,options);}
  toStringShort():string{return this.constructor.name;}
}
const identityHashes=new WeakMap<object,number>();let nextIdentityHash=0;
/** Dart string hashes are VM-specific. Unknown Web keys use a stable embedding hash. */
export function rawStringHash(text:string):number{let result=0x811c9dc5;for(let i=0;i<text.length;i++)result=Math.imul(result^text.charCodeAt(i),0x01000193)>>>0;return result;}
/** Plane IDs exceed 32 bits; preserve the unsigned value mask without JS bitwise truncation. */
export function rawKeyId(plane:number,value:number):number{return plane+(value>>>0);}
export function rawInteger(value:number):number{if(!Number.isSafeInteger(value))throw new TypeError('Raw keyboard fields require safe integers');return value;}
export function rawText(value:string):string{if(typeof value!=='string')throw new TypeError('Raw keyboard fields require strings');return value;}
export function rawBoolean(value:boolean):boolean{if(typeof value!=='boolean')throw new TypeError('Raw keyboard fields require booleans');return value;}
export function rawCharacter(value:number):string{return value===0?'':String.fromCodePoint(value);}
export function sealRawFields(owner:object,names:readonly string[]):void{for(const name of names)Object.defineProperty(owner,name,{writable:false,configurable:false});}
export function sidePressed(mask:number,side:KeyboardSide,any:number,left:number,right:number,policy:'requireAny'|'windows'|'apple'='requireAny'):boolean{
  const combined=mask&(left|right|any);
  if(policy==='windows'){if(combined===0)return false;if(combined===any)return true;}
  else{if((mask&any)===0)return false;if(policy==='apple'&&combined===any)return true;}
  switch(side){case 'any':return true;case 'all':return (mask&left)!==0&&(mask&right)!==0;case 'left':return (mask&left)!==0;case 'right':return (mask&right)!==0;}
}
export function modifierSide(mask:number,any:number,left:number,right:number,policy:'android'|'windows'|'fuchsia'='android'):KeyboardSide|null{
  const combined=mask&(policy==='fuchsia'?any:left|right);
  if(combined===left)return 'left';if(combined===right)return 'right';if(combined===(policy==='fuchsia'?any:left|right))return 'all';
  if(policy==='android'&&(mask&any)!==0||policy==='windows'&&(mask&(left|right|any))===any)return 'all';return null;
}
