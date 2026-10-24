// SPDX-License-Identifier: BSD-3-Clause
import type {PointerEvent as TransportPointerEvent} from '../../ui/input.ts';
import {PointerDeviceKind} from '../../ui/pointer.ts';
import {Offset} from '../../ui/offset.ts';
import {PointerDownEvent,PointerMoveEvent,PointerUpEvent,PointerCancelEvent,PointerHoverEvent,PointerExitEvent,PointerScrollEvent,PointerAddedEvent,PointerRemovedEvent,PointerPanZoomStartEvent,PointerPanZoomUpdateEvent,PointerPanZoomEndEvent,PointerScrollInertiaCancelEvent} from './events.ts';
import type {PointerEvent} from './events.ts';
/** Actual embedding fields become source events. Unobserved physical device,
 * pressure and embedder metadata retain source defaults, not invented readings. */
export function pointerEventFromTransport(event:TransportPointerEvent,options:{readonly viewId?:number|string}={}):PointerEvent {
  const kind=event.device==='mouse'?PointerDeviceKind.mouse:event.device==='touch'?PointerDeviceKind.touch:event.device==='pen'?PointerDeviceKind.stylus:event.device==='trackpad'?PointerDeviceKind.trackpad:PointerDeviceKind.unknown;
  const position=event.globalPosition??event,common={viewId:event.viewId??options.viewId??0,timeStamp:event.timestamp,pointer:event.pointer,kind,position:new Offset(position.x,position.y),buttons:event.buttons};
  let result:PointerEvent;
  switch(event.kind){
    case 'panZoomStart':result=new PointerPanZoomStartEvent(common);break;
    case 'panZoomUpdate':result=new PointerPanZoomUpdateEvent({...common,pan:new Offset(event.panX??0,event.panY??0),panDelta:new Offset(event.deltaX??0,event.deltaY??0),scale:event.scale??1,rotation:event.rotation??0});break;
    case 'panZoomEnd':result=new PointerPanZoomEndEvent(common);break;
    case 'inertiaCancel':result=new PointerScrollInertiaCancelEvent(common);break;
    case 'down':result=new PointerDownEvent(common);break;
    case 'move':result=new PointerMoveEvent({...common,delta:event.globalDelta?new Offset(event.globalDelta.x,event.globalDelta.y):new Offset(event.deltaX??0,event.deltaY??0)});break;
    case 'up':result=new PointerUpEvent(common);break;
    case 'cancel':result=new PointerCancelEvent(common);break;
    case 'hover':result=new PointerHoverEvent({...common,delta:event.globalDelta?new Offset(event.globalDelta.x,event.globalDelta.y):new Offset(event.deltaX??0,event.deltaY??0)});break;
    case 'leave':result=new PointerExitEvent(common);break;
    case 'wheel':result=new PointerScrollEvent({viewId:common.viewId,timeStamp:common.timeStamp,kind,position:common.position,scrollDelta:new Offset(event.deltaX??0,event.deltaY??0),...(event.respondToSignal?{onRespond:({allowPlatformDefault})=>event.respondToSignal!(allowPlatformDefault)}:{})});break;
  }
  return event.localTransform?result.transformed(event.localTransform):result;
}
/** Source callbacks keep physical metadata. Only legacy transport consumers
 * use this deliberately narrower logical DTO; pan/zoom has no legacy shape. */
export function pointerEventToTransport(event:PointerEvent,viewportGeneration:number):TransportPointerEvent|null {
  const kind=event instanceof PointerDownEvent?'down':event instanceof PointerMoveEvent?'move':event instanceof PointerUpEvent?'up':event instanceof PointerCancelEvent?'cancel':event instanceof PointerHoverEvent||event instanceof PointerAddedEvent?'hover':event instanceof PointerExitEvent||event instanceof PointerRemovedEvent?'leave':event instanceof PointerScrollEvent?'wheel':null;
  if(kind===null)return null;
  const device=event.kind===PointerDeviceKind.mouse?'mouse':event.kind===PointerDeviceKind.touch?'touch':event.kind===PointerDeviceKind.stylus||event.kind===PointerDeviceKind.invertedStylus?'pen':'unknown';
  const local=event.localPosition,delta=event instanceof PointerScrollEvent?event.scrollDelta:event.localDelta;
  return {kind,pointer:event.pointer,device,buttons:event.buttons,timestamp:event.timeStamp,x:local.dx,y:local.dy,deltaX:delta.dx,deltaY:delta.dy,viewId:event.viewId,globalPosition:event.position,globalDelta:event.delta,...(event.transform?{localTransform:event.transform}:{}),viewportGeneration,...(event instanceof PointerScrollEvent?{respondToSignal:allowPlatformDefault=>event.respond({allowPlatformDefault})}:{})};
}
