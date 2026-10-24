// SPDX-License-Identifier: BSD-3-Clause
import type {GestureResponderEvent,PointerEvent as NativePointerEvent} from 'react-native';
import type {ViewRuntime} from '@nelyx/core/hosting/runtime';
import type {PointerEvent} from '@nelyx/core/ui/input';
import type {WindowsWheelEvent,WindowsPointerEvent} from '@nelyx/skia-rn/views/types';
interface NativeMouseEvent {readonly protocol:1;readonly nativeId:number;readonly kind:'hover'|'leave';readonly device:'mouse'|'pen';readonly pointer:number;readonly buttons:number;readonly x:number;readonly y:number;readonly timestamp:number}
import {WindowsKeyConnection,windowsKeyConnection,windowsKeyboardRoute} from './windows-keyboard-input.ts';
import {androidPointerInput} from './android-pointer-input.ts';
import {windowsMonotonicTimestamp} from '../../platforms/windows/frame-clock.ts';
/** Fabric publishes logical local coordinates. Platform event availability is qualified separately. */
export function nativeInputProps(target:string,readView:()=>ViewRuntime|undefined,requestKeyboardFocus?:()=>void,readNativeViewGeneration?:()=>number|undefined,readNativeId?:()=>number|undefined,androidPointerConstants?:unknown):Record<string,unknown>{
  let lastInputSequence=0;
  const deliver=(view:ViewRuntime,event:PointerEvent)=>typeof view.queuePointer==='function'?view.queuePointer(event):view.dispatchPointer(event);
  const time=(native:{timestamp?:number})=>native.timestamp===undefined?performance.now():windowsMonotonicTimestamp(native.timestamp);
  const ordered=(native:{sequence?:number})=>{if(native.sequence===undefined)return true;if(!Number.isSafeInteger(native.sequence)||native.sequence<1)throw new Error('Invalid Windows input sequence');if(native.sequence<=lastInputSequence)return false;lastInputSequence=native.sequence;return true;};
  const touch=(kind:PointerEvent['kind'])=>(event:GestureResponderEvent)=>{const view=readView();if(!view)return;if(target==='android'&&kind==='down')requestKeyboardFocus?.();for(const touch of event.nativeEvent.changedTouches){const pointer=Number(touch.identifier);if(!Number.isSafeInteger(pointer))throw new Error('Invalid native touch identity');view.dispatchPointer({kind,pointer,device:'touch',buttons:kind==='up'||kind==='cancel'?0:1,x:touch.locationX,y:touch.locationY,timestamp:touch.timestamp,viewportGeneration:view.currentMetrics.viewportGeneration});}};
  const pointer=(kind:PointerEvent['kind'])=>(event:NativePointerEvent)=>{const view=readView();if(!view)return;if(target==='windows'&&kind==='down')requestKeyboardFocus?.();const native=event.nativeEvent;if((target==='macos'||target==='linux')&&kind==='move'&&!native.buttons&&(native.pointerType==='mouse'||native.pointerType==='pen'))return;view.dispatchPointer({kind:kind==='move'&&!native.buttons?'hover':kind,pointer:native.pointerId,device:native.pointerType==='mouse'||native.pointerType==='touch'||native.pointerType==='pen'?native.pointerType:'unknown',buttons:native.buttons,x:native.offsetX,y:native.offsetY,timestamp:performance.now(),viewportGeneration:view.currentMetrics.viewportGeneration});};
  if(target==='windows')return {
    onWindowsKey(event:Parameters<WindowsKeyConnection['key']>[0]){const view=readView();if(!view)return;if(!readNativeViewGeneration)throw new Error('Windows raw input requires its native View generation');const route=windowsKeyboardRoute(view);if(route)route.key(event);else windowsKeyConnection(view,readNativeViewGeneration).key(event);},
    onWindowsKeyboardFocus(event:Parameters<WindowsKeyConnection['focus']>[0]){const view=readView();if(!view)return;if(!readNativeViewGeneration)throw new Error('Windows raw input requires its native View generation');const route=windowsKeyboardRoute(view);if(route)route.focus(event);else windowsKeyConnection(view,readNativeViewGeneration).focus(event);},
    onWindowsText(event:Parameters<WindowsKeyConnection['text']>[0]){const view=readView();if(!view)return;windowsKeyboardRoute(view)?.text(event);},
    onWindowsPointer(event:{nativeEvent:WindowsPointerEvent}){
      const view=readView(),native=event.nativeEvent;if(!view||native.surfaceGeneration!==view.currentMetrics.nativeSurfaceGeneration)return;
      if(native.protocol!==1||!['down','move','up','cancel','hover','leave','panZoomStart','panZoomUpdate','panZoomEnd','inertiaCancel'].includes(native.kind)||!['mouse','touch','pen','trackpad','unknown'].includes(native.device)||
        !Number.isSafeInteger(native.pointer)||native.pointer<0||!Number.isSafeInteger(native.buttons)||native.buttons<0||native.buttons>31||![native.x,native.y].every(Number.isFinite))throw new Error('Invalid Windows native pointer event');
      if(!ordered(native))return;
      if(native.kind==='down')requestKeyboardFocus?.();
      const pan=native.kind.startsWith('panZoom')||native.kind==='inertiaCancel';
      if(pan&&native.device!=='trackpad')throw new Error('Precision gesture requires its actual trackpad source');
      if(native.kind==='panZoomUpdate'&&![native.panX,native.panY,native.deltaX,native.deltaY,native.scale,native.rotation].every(value=>typeof value==='number'&&Number.isFinite(value)))throw new Error('Invalid precision gesture');
      deliver(view,{kind:native.kind,pointer:native.pointer,device:native.device,buttons:native.buttons,x:native.x,y:native.y,timestamp:time(native),viewportGeneration:view.currentMetrics.viewportGeneration,...(native.sequence!==undefined?{inputSequence:native.sequence}:{}),...(pan?{panX:native.panX,panY:native.panY,deltaX:native.deltaX,deltaY:native.deltaY,scale:native.scale,rotation:native.rotation}:{})});
    },
    onWindowsWheel(event:{nativeEvent:WindowsWheelEvent}){const view=readView(),native=event.nativeEvent;if(!view||native.surfaceGeneration!==view.currentMetrics.nativeSurfaceGeneration)return;if(![native.x,native.y,native.deltaX,native.deltaY].every(Number.isFinite)||native.device!==undefined&&!['mouse','trackpad'].includes(native.device))throw new Error('Invalid native wheel event');if(!ordered(native))return;deliver(view,{kind:'wheel',pointer:native.pointer??0,device:native.device??'mouse',buttons:0,x:native.x,y:native.y,deltaX:native.deltaX,deltaY:native.deltaY,timestamp:time(native),viewportGeneration:view.currentMetrics.viewportGeneration,...(native.sequence!==undefined?{inputSequence:native.sequence}:{})});},
  };
  const mouse={onNativeMouseEvent(event:{nativeEvent:NativeMouseEvent}){const view=readView(),native=event.nativeEvent;if(!view)return;if(!readNativeId)throw new Error('Native mouse observations require their actual View identity');if(native.nativeId!==readNativeId())return;if(native.protocol!==1||!['hover','leave'].includes(native.kind)||!['mouse','pen'].includes(native.device)||!Number.isSafeInteger(native.pointer)||native.pointer<0||!Number.isSafeInteger(native.buttons)||native.buttons<0||![native.x,native.y,native.timestamp].every(Number.isFinite))throw new Error('Invalid native mouse observation');view.dispatchPointer({kind:native.kind,pointer:native.pointer,device:native.device,buttons:native.buttons,x:native.x,y:native.y,timestamp:native.timestamp,viewportGeneration:view.currentMetrics.viewportGeneration});}};
  if(target==='android'){
    if(!readNativeId||!androidPointerConstants||typeof androidPointerConstants!=='object'||!('androidPointerProtocol'in androidPointerConstants)||androidPointerConstants.androidPointerProtocol!==1)throw new Error('Rebuild Android Skia pointer protocol 1 bindings');
    return {...mouse,onAndroidPointer:androidPointerInput(readView,readNativeId,requestKeyboardFocus)};
  }
  return target==='ios'?{...mouse,onTouchStart:touch('down'),onTouchMove:touch('move'),onTouchEnd:touch('up'),onTouchCancel:touch('cancel')}:{...mouse,onPointerDown:pointer('down'),onPointerMove:pointer('move'),onPointerUp:pointer('up'),onPointerCancel:pointer('cancel')};
}
/** RNW's standard View owns hardware focus/key events; the custom Skia component has no standard key emitter. */
export interface WindowsKeyboardOptions {readonly rawKeyboard?:boolean;readonly pressed?:Set<string>;readonly canvasFocused?:boolean;readonly onCanvasFocus?:(focused:boolean)=>void}
export function nativeKeyboardProps(target:string,readView:()=>ViewRuntime|undefined,options:WindowsKeyboardOptions={}):Record<string,unknown>{
  if(target!=='windows')return {};
  const pressed=options.pressed??new Set<string>();
  const atSelf=(event:{target?:unknown;currentTarget?:unknown})=>event.target===undefined||event.currentTarget===undefined||event.target===event.currentTarget;
  const keyboard=(kind:'down'|'up')=>(event:{target?:unknown;currentTarget?:unknown;nativeEvent:{key:string;code?:string;location?:number;shiftKey:boolean;ctrlKey:boolean;altKey:boolean;metaKey:boolean}})=>{if(event.target!==undefined&&event.currentTarget!==undefined&&event.target!==event.currentTarget)return;const view=readView(),key=event.nativeEvent.key,identity=event.nativeEvent.code||key,repeat=kind==='down'&&pressed.has(identity);if(kind==='down')pressed.add(identity);else pressed.delete(identity);if(view)view.dispatchKey({kind,key,...(event.nativeEvent.code?{code:event.nativeEvent.code}:{}),...(event.nativeEvent.location!==undefined?{location:event.nativeEvent.location}:{}),timestamp:performance.now(),platform:'windows',shift:event.nativeEvent.shiftKey,control:event.nativeEvent.ctrlKey,alt:event.nativeEvent.altKey,meta:event.nativeEvent.metaKey,repeat});};
  // RNW handles these native routed keys before its default focus walk. The
  // surface owns plain/Shift Tab, including its Core semantics descendants.
  // This is an explicit static canvas policy, not dynamic native acknowledgement.
  const tabEvents=options.rawKeyboard||options.canvasFocused?[{code:'Tab',handledEventPhase:3},{code:'Tab',shiftKey:true,handledEventPhase:3}]:[];
  return {focusable:true,keyDownEvents:tabEvents,keyUpEvents:tabEvents,onFocus:(event:{target?:unknown;currentTarget?:unknown})=>{if(atSelf(event)){options.onCanvasFocus?.(true);if(!options.rawKeyboard)readView()?.dispatchKeyboardFocusGained();}},onBlur:(event:{target?:unknown;currentTarget?:unknown})=>{if(!atSelf(event))return;pressed.clear();options.onCanvasFocus?.(false);if(!options.rawKeyboard)readView()?.dispatchKeyboardFocusLost();},...(options.rawKeyboard?{}:{onKeyDown:keyboard('down'),onKeyUp:keyboard('up')})};
}
