// SPDX-License-Identifier: BSD-3-Clause
import type {NativeSyntheticEvent} from 'react-native';
import type {ViewRuntime} from '@nelyx/core/hosting/runtime';
import type {KeyEvent} from '@nelyx/core/ui/input';
import type {WindowsKeyEvent,WindowsKeyboardFocusEvent,WindowsTextEvent} from '@nelyx/skia-rn/views/types';
import {LogicalKeyboardKey as L} from '@nelyx/core/services/keyboard-key';
import {windowsLogicalKeyId} from '@nelyx/core/services/windows-engine-key-map';
const labels=new Map<number,string>([[L.tab.keyId,'Tab'],[L.enter.keyId,'Enter'],[L.numpadEnter.keyId,'Enter'],[L.space.keyId,' '],[L.arrowLeft.keyId,'ArrowLeft'],[L.arrowRight.keyId,'ArrowRight'],[L.arrowUp.keyId,'ArrowUp'],[L.arrowDown.keyId,'ArrowDown'],[L.pageUp.keyId,'PageUp'],[L.pageDown.keyId,'PageDown'],[L.shiftLeft.keyId,'Shift'],[L.shiftRight.keyId,'Shift'],[L.controlLeft.keyId,'Control'],[L.controlRight.keyId,'Control'],[L.altLeft.keyId,'Alt'],[L.altRight.keyId,'Alt'],[L.metaLeft.keyId,'Meta'],[L.metaRight.keyId,'Meta']]);
export type WindowsKeyboardPacket<T>=Pick<NativeSyntheticEvent<T>,'nativeEvent'>;
export interface WindowsKeyboardRoute {key(event:WindowsKeyboardPacket<WindowsKeyEvent>):void;focus(event:WindowsKeyboardPacket<WindowsKeyboardFocusEvent>):void;text(event:WindowsKeyboardPacket<WindowsTextEvent>):void}
const connections=new WeakMap<ViewRuntime,WindowsKeyConnection>(),routes=new WeakMap<ViewRuntime,WindowsKeyboardRoute>(),managed=new WeakSet<ViewRuntime>();
const retiredRoute:WindowsKeyboardRoute=Object.freeze({key(){},focus(){},text(){}});
export function windowsKeyConnection(view:ViewRuntime,readGeneration:()=>number|undefined):WindowsKeyConnection{let connection=connections.get(view);if(!connection){connection=new WindowsKeyConnection(view,readGeneration);connections.set(view,connection);}return connection;}
export function bindWindowsKeyboardRoute(view:ViewRuntime,route:WindowsKeyboardRoute):()=>void{if(routes.has(view))throw new Error('Windows View keyboard route already owned');managed.add(view);routes.set(view,route);return()=>{if(routes.get(view)===route)routes.delete(view);};}
// A retired nonvisual owner cannot fall back into the transitional direct
// keyboard route while its native/View cleanup is still pending. A new
// explicit lease may bind the same surviving View after native retirement.
export function windowsKeyboardRoute(view:ViewRuntime):WindowsKeyboardRoute|undefined{return routes.get(view)??(managed.has(view)?retiredRoute:undefined);}
/** Owned native packets have one sequence across focus and keys. */
export class WindowsKeyConnection {
  private sequence=0;
  get sequenceNumber():number{return this.sequence;}
  constructor(private readonly view:Pick<ViewRuntime,'controller'|'dispatchKey'|'dispatchRawKey'|'dispatchKeyboardFocusLost'|'dispatchKeyboardFocusGained'>,private readonly readGeneration:()=>number|undefined){}
  private admit(data:WindowsKeyboardFocusEvent|WindowsKeyEvent|WindowsTextEvent):boolean{
    if(data.viewGeneration!==this.readGeneration())return false;
    if(data.protocol!==1||!Number.isSafeInteger(data.viewGeneration)||data.viewGeneration<=0||!Number.isSafeInteger(data.sequence)||data.sequence<=0)throw new Error('Invalid Windows native keyboard packet');
    if(data.sequence<=this.sequence)return false;this.sequence=data.sequence;return true;
  }
  focus(event:WindowsKeyboardPacket<WindowsKeyboardFocusEvent>):void{const data=event.nativeEvent;if(!this.admit(data))return;if(typeof data.focused!=='boolean')throw new Error('Invalid Windows keyboard focus');if(data.focused)this.view.dispatchKeyboardFocusGained();else this.view.dispatchKeyboardFocusLost();}
  text(event:WindowsKeyboardPacket<WindowsTextEvent>):string|null{
    const data=event.nativeEvent;if(!this.admit(data))return null;
    if(!Number.isSafeInteger(data.characterCodePoint)||data.characterCodePoint<0x20||data.characterCodePoint===0x7f||data.characterCodePoint>0x10ffff||data.characterCodePoint>=0xd800&&data.characterCodePoint<=0xdfff||!Number.isSafeInteger(data.repeatCount)||data.repeatCount<=0||data.repeatCount>0xffff||!Number.isSafeInteger(data.focusEpoch)||data.focusEpoch<=0)throw new Error('Invalid Windows native text observation');
    return String.fromCodePoint(data.characterCodePoint).repeat(data.repeatCount);
  }
  key(event:WindowsKeyboardPacket<WindowsKeyEvent>):boolean{
    const data=event.nativeEvent;if(!this.admit(data))return false;
    if(!['down','up'].includes(data.kind)||!['keyCode','scanCode','characterCodePoint','modifiers','repeatCount','focusEpoch'].every(name=>Number.isSafeInteger(data[name as keyof WindowsKeyEvent]))||data.focusEpoch<0||data.keyCode<0||data.keyCode>0xffff||data.scanCode<0||data.scanCode>0xffff||data.characterCodePoint<0||data.characterCodePoint>0x10ffff||data.characterCodePoint>=0xd800&&data.characterCodePoint<=0xdfff||data.modifiers<0||data.modifiers>0x3fff||data.repeatCount<0||data.repeatCount>0xffff||['repeat','dead','capsLock','numLock','scrollLock'].some(name=>typeof data[name as keyof WindowsKeyEvent]!=='boolean')||data.kind==='up'&&(data.characterCodePoint!==0||data.repeat))throw new Error('Invalid Windows native key fields');
    const logical=windowsLogicalKeyId(data.keyCode,data.scanCode),key=L.findKeyByKeyId(logical),character=data.kind==='down'&&data.characterCodePoint!==0?String.fromCodePoint(data.characterCodePoint):null;
    if(data.timestamp!==undefined&&(!Number.isFinite(data.timestamp)||data.timestamp<0))throw new Error('Invalid Windows native key timestamp');
    const transport:KeyEvent=Object.freeze({kind:data.kind,key:character??labels.get(logical)??key?.keyLabel??'Unidentified',character,shift:(data.modifiers&1)!==0,control:(data.modifiers&8)!==0,alt:(data.modifiers&64)!==0,meta:(data.modifiers&1536)!==0,repeat:data.repeat,timestamp:data.timestamp??performance.now(),platform:'windows',windows:Object.freeze({keyCode:data.keyCode,scanCode:data.scanCode,characterCodePoint:data.characterCodePoint,modifiers:data.modifiers}),locks:Object.freeze({capsLock:data.capsLock,numLock:data.numLock,scrollLock:data.scrollLock})});
    return this.view.controller?.rawKey?this.view.dispatchRawKey(Object.freeze({type:data.kind==='down'?'keydown':'keyup',keymap:'windows',keyCode:data.keyCode,scanCode:data.scanCode,characterCodePoint:data.characterCodePoint,modifiers:data.modifiers}),transport):this.view.dispatchKey(transport);
  }
}
