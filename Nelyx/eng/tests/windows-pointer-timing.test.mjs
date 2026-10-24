// SPDX-License-Identifier: BSD-3-Clause
import test from 'node:test';import assert from 'node:assert/strict';
import {nativeInputProps} from '../../sdk/dist/backends/react-native/input.js';
import {pointerEventFromTransport} from '../../dist/framework/gestures/pointer-event-adapter.js';
import {PointerPanZoomStartEvent,PointerPanZoomUpdateEvent,PointerPanZoomEndEvent,PointerScrollInertiaCancelEvent} from '../../dist/framework/gestures/events.js';
const timeout=1_200_000;
test('Windows input preserves fractional wheel, precision stream, sequence boundaries and native time',{timeout},()=>{
  const previous=globalThis.NelyxWindowsHost,events=[];
  globalThis.NelyxWindowsHost={getMonotonicTime:()=>performance.now()+5000};
  try{
    const view={currentMetrics:{nativeSurfaceGeneration:9,viewportGeneration:4},dispatchPointer:event=>events.push(event)},props=nativeInputProps('windows',()=>view);
    const now=performance.now(),base={protocol:1,pointer:32,device:'trackpad',buttons:0,x:40,y:60,surfaceGeneration:9,timestamp:now+5000-20};
    props.onWindowsWheel({nativeEvent:{...base,sequence:1,deltaX:.125,deltaY:.25}});
    for(const [index,kind] of ['panZoomStart','panZoomUpdate','panZoomEnd','inertiaCancel'].entries())props.onWindowsPointer({nativeEvent:{...base,sequence:index+2,kind,panX:3.5,panY:-7.25,deltaX:.5,deltaY:-1.25,scale:1.1,rotation:0}});
    props.onWindowsPointer({nativeEvent:{...base,kind:'panZoomEnd',sequence:3}});
    props.onWindowsWheel({nativeEvent:{...base,surfaceGeneration:8,sequence:99,deltaX:99,deltaY:99}});
    assert.equal(events.length,5);assert.equal(events[0].deltaY,.25);assert.equal(events[0].viewportGeneration,4);
    assert(Math.abs(events[0].timestamp-(now-20))<1,'Bridge delivery time must not replace native time');
    const types=[PointerPanZoomStartEvent,PointerPanZoomUpdateEvent,PointerPanZoomEndEvent,PointerScrollInertiaCancelEvent];
    events.slice(1).forEach((event,index)=>assert(pointerEventFromTransport(event) instanceof types[index]));
    const update=pointerEventFromTransport(events[2]);assert.equal(update.pan.dy,-7.25);assert.equal(update.panDelta.dy,-1.25);assert.equal(update.pointer,32);
  }finally{if(previous===undefined)delete globalThis.NelyxWindowsHost;else globalThis.NelyxWindowsHost=previous;}
});
