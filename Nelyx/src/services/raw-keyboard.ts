// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// RawKeyboard state, modifier synchronization and legacy handler from pinned raw_keyboard.dart.
import {LogicalKeyboardKey as L,PhysicalKeyboardKey as P} from './keyboard-key.ts';
import type {KeyboardKey} from './keyboard-key.ts';
import {RawKeyDownEvent,RawKeyUpEvent} from './raw-key-event.ts';
import type {RawKeyEvent,RawKeyEventHandler} from './raw-key-event.ts';
import type {ModifierKey,KeyboardSide} from './raw-keyboard-data.ts';
import {RawKeyEventDataLinux} from './raw-keyboard-linux.ts';
import {RawKeyEventDataWeb} from './raw-keyboard-web.ts';
import {RawKeyEventDataFuchsia} from './raw-keyboard-fuchsia.ts';
import {RawKeyEventDataMacOs} from './raw-keyboard-macos.ts';
import {RawKeyEventDataIos} from './raw-keyboard-ios.ts';
import {RawKeyEventDataAndroid} from './raw-keyboard-android.ts';
import {ServicesBinding} from './binding.ts';
import type {KeyMessageHandler} from './key-message.ts';
import {FlutterError} from '../foundation/flutter-error.ts';
import {FlutterErrorDetails} from '../foundation/assertions.ts';
import {ErrorDescription} from '../foundation/diagnostics.ts';
import {FoundationBuildMode} from '../foundation/constants.ts';
export interface RawKeyboardMessageBinding {keyMessageHandler:KeyMessageHandler|null}
const modifierGroups:readonly {key:ModifierKey;physical:readonly P[];logical:readonly L[]}[]=[
  {key:'altModifier',physical:[P.altLeft,P.altRight],logical:[L.altLeft,L.altRight]},
  {key:'shiftModifier',physical:[P.shiftLeft,P.shiftRight],logical:[L.shiftLeft,L.shiftRight]},
  {key:'controlModifier',physical:[P.controlLeft,P.controlRight],logical:[L.controlLeft,L.controlRight]},
  {key:'metaModifier',physical:[P.metaLeft,P.metaRight],logical:[L.metaLeft,L.metaRight]},
  {key:'capsLockModifier',physical:[P.capsLock],logical:[L.capsLock]},
  {key:'numLockModifier',physical:[P.numLock],logical:[L.numLock]},
  {key:'scrollLockModifier',physical:[P.scrollLock],logical:[L.scrollLock]},
  {key:'functionModifier',physical:[P.fn],logical:[L.fn]},
];
const allModifiers=new Map(modifierGroups.flatMap(group=>group.physical.map((physical,i)=>[physical.usbHidUsage,group.logical[i]!] as const)));
/** Fresh mutable source Set snapshots retain keyboard value equality. */
class RawKeySet<T extends KeyboardKey> extends Set<T>{
  override has(value:T):boolean{for(const key of this)if(key.equals(value))return true;return false;}
  override add(value:T):this{if(!this.has(value))super.add(value);return this;}
  override delete(value:T):boolean{for(const key of this)if(key.equals(value))return super.delete(key);return false;}
}
export class RawKeyboard {
  static get instance():RawKeyboard{return ServicesBinding.instance.rawKeyboard;}
  private readonly pressed=new Map<number,{physical:P;logical:L}>();private listeners:((event:RawKeyEvent)=>void)[]=[];private live=true;
  private cachedKeyMessageHandler:KeyMessageHandler|null=null;private cachedKeyEventHandler:RawKeyEventHandler|null=null;
  constructor(readonly messageBinding:RawKeyboardMessageBinding={keyMessageHandler:null}){}
  private checkOpen():void{if(!this.live)throw new FlutterError('RawKeyboard is closed');}
  addListener(listener:(event:RawKeyEvent)=>void):void{this.checkOpen();this.listeners.push(listener);}
  removeListener(listener:(event:RawKeyEvent)=>void):void{const index=this.listeners.indexOf(listener);if(index>=0)this.listeners.splice(index,1);}
  get keyEventHandler():RawKeyEventHandler|null{
    this.checkOpen();if(this.messageBinding.keyMessageHandler!==this.cachedKeyMessageHandler){this.cachedKeyMessageHandler=this.messageBinding.keyMessageHandler;this.cachedKeyEventHandler=this.cachedKeyMessageHandler===null?null:()=>{if(FoundationBuildMode.debug)throw new FlutterError('The framework RawKeyboard keyEventHandler compatibility callback must not be called directly; dispatch a KeyMessage instead');return true;};}return this.cachedKeyEventHandler;
  }
  set keyEventHandler(handler:RawKeyEventHandler|null){this.checkOpen();this.cachedKeyEventHandler=handler;this.cachedKeyMessageHandler=handler===null?null:message=>message.rawEvent===null?false:handler(message.rawEvent);this.messageBinding.keyMessageHandler=this.cachedKeyMessageHandler;}
  handleRawKeyEvent(event:RawKeyEvent):boolean{
    this.checkOpen();if(event instanceof RawKeyDownEvent)this.pressed.set(event.physicalKey.usbHidUsage,{physical:event.physicalKey,logical:event.logicalKey});else if(event instanceof RawKeyUpEvent)this.pressed.delete(event.physicalKey.usbHidUsage);
    this.synchronizeModifiers(event);
    if(FoundationBuildMode.debug&&event instanceof RawKeyDownEvent&&this.pressed.size===0)throw new FlutterError('Attempted key down when RawKeyboard.keysPressed is empty; modifier flags may be inconsistent');
    for(const listener of [...this.listeners]){if(!this.live)break;if(this.listeners.includes(listener))try{listener(event);}catch(exception){FlutterError.reportError(new FlutterErrorDetails({exception,library:'services library',context:new ErrorDescription('while processing a raw key listener')}));}}
    return false;
  }
  private synchronizeModifiers(event:RawKeyEvent):void{
    const modifiers=event.data.modifiersPressed,mapped=new Map<number,{physical:P;logical:L}>(),anySide=new Set<number>(),after=new Set(this.pressed.keys());if(event instanceof RawKeyDownEvent)after.add(event.physicalKey.usbHidUsage);let thisModifier:ModifierKey|undefined;
    for(const group of modifierGroups){if(group.physical.some(key=>key.equals(event.physicalKey)))thisModifier=group.key;const side=modifiers.get(group.key);
      if(side==='any'){for(const key of group.physical)anySide.add(key.usbHidUsage);if(group.physical.some(key=>after.has(key.usbHidUsage)))continue;}
      const keys=this.mappedModifierKeys(group.physical,side);if(keys===null)continue;
      for(const key of keys)mapped.set(key.usbHidUsage,{physical:key,logical:allModifiers.get(key.usbHidUsage)!});
    }
    const caps=this.pressed.get(P.capsLock.usbHidUsage),nonModifierCaps=(event.data instanceof RawKeyEventDataLinux||event.data instanceof RawKeyEventDataWeb)&&!!caps&&!caps.logical.equals(L.capsLock);
    for(const group of modifierGroups)if(group.key!=='functionModifier')for(const key of group.physical)if(!anySide.has(key.usbHidUsage)&&!(nonModifierCaps&&key.equals(P.capsLock)))this.pressed.delete(key.usbHidUsage);
    if(!(event.data instanceof RawKeyEventDataFuchsia||event.data instanceof RawKeyEventDataMacOs))this.pressed.delete(P.fn.usbHidUsage);
    for(const [id,pair]of mapped)this.pressed.set(id,pair);
    if(event instanceof RawKeyDownEvent&&thisModifier!==undefined&&!this.pressed.has(event.physicalKey.usbHidUsage)){
      if(event.data instanceof RawKeyEventDataLinux&&event.physicalKey.equals(P.altRight)||event.data instanceof RawKeyEventDataIos||event.data instanceof RawKeyEventDataAndroid){const key=event.physicalKey.equals(P.fn)?undefined:allModifiers.get(event.physicalKey.usbHidUsage);if(key)this.pressed.set(event.physicalKey.usbHidUsage,{physical:event.physicalKey,logical:key});}
      if(event.data instanceof RawKeyEventDataWeb&&event.physicalKey.equals(P.altRight))this.pressed.set(event.physicalKey.usbHidUsage,{physical:event.physicalKey,logical:event.logicalKey});
    }
  }
  private mappedModifierKeys(keys:readonly P[],side:KeyboardSide|undefined):readonly P[]|null{if(side===undefined)return [];if(side==='all')return keys;if(keys.length!==2)return null;return side==='right'?[keys[1]!]:[keys[0]!];}
  get keysPressed():Set<L>{return new RawKeySet([...this.pressed.values()].map(value=>value.logical));}
  get physicalKeysPressed():Set<P>{return new RawKeySet([...this.pressed.values()].map(value=>value.physical));}
  lookUpLayout(key:P):L|undefined{return this.pressed.get(key.usbHidUsage)?.logical;}
  clearKeysPressed():void{this.pressed.clear();}
  /** Application lifetime adaptation; source RawKeyboard is process-global. */
  dispose():void{if(!this.live)return;this.live=false;this.pressed.clear();this.listeners=[];this.messageBinding.keyMessageHandler=null;this.cachedKeyEventHandler=null;this.cachedKeyMessageHandler=null;}
}
