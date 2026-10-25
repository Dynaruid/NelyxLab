// SPDX-License-Identifier: BSD-3-Clause
import test from 'node:test';import assert from 'node:assert/strict';
import {createDisplayListCanvas} from "../../skia/packages/native/src/display-list.ts";
import {replayFrame} from '@nelyx/skia-native/renderer';
import {Paint} from '@nelyx/core/ui/paint';
const timeout=1_200_000;
test('a native batch carries exact ordering, duplicate handles and original primitive colours',{timeout},()=>{
  const handle={},calls=[];const canvas=createDisplayListCanvas({nelyxReplayDisplayList(packet,handles){calls.push({words:[...new Float64Array(packet)],handles:[...handles]});}});
  canvas.save();canvas.nelyxFillRect({x:1,y:2,width:3,height:4},0xff123456);canvas.nelyxParagraph(handle,5,6);canvas.nelyxParagraph(handle,7,8);canvas.restore();canvas.nelyxFlush();
  assert.equal(calls.length,1);const [{words,handles}]=calls;assert.deepEqual(words.slice(0,4),[0x4e4c444c,1,5,1]);assert.deepEqual(words.slice(6,17),[22,9,0,1,2,3,4,0,0,0xff123456,1]);assert.deepEqual(handles,[handle]);assert.throws(()=>canvas.save(),/consumed/);assert.throws(()=>canvas.nelyxFlush(),/consumed/);
});
test('plain fills encode without native rect/colour/paint wrappers and effectful paints retain their path',{timeout},()=>{
  let paints=0,rects=0,packets=0;const state=[];
  const api={Paint(){paints++;return {setAntiAlias(){},dispose(){}};},Color(){throw Error('Plain fills must not cross the JSI colour boundary');},XYWHRect(){rects++;throw Error('Plain fills must not allocate JSI rectangles');}};
  const target={nelyxReplayDisplayList(packet){packets++;state.push([...new Float64Array(packet)]);}};
  const canvas=createDisplayListCanvas(target),commands=[{op:'rect',rect:{x:0,y:0,width:20,height:20},color:0xffff0000},{op:'drawRect',rect:{x:2,y:2,width:3,height:4},paint:new Paint({color:0xff00ff00}).snapshot()},{op:'drawOval',rect:{x:7,y:7,width:8,height:9},paint:new Paint({color:0xff0000ff}).snapshot()}];
  replayFrame(api,canvas,{commands},{image(){throw Error('Unexpected image');},paragraph(){throw Error('Unexpected text');}});
  assert.equal(packets,1);assert.equal(paints,1);assert.equal(rects,0);assert.deepEqual([state[0][13],state[0][24],state[0][35]],[0xffff0000,0xff00ff00,0xff0000ff]);
});
test('native packet failure consumes the recording and the command budget rejects before dispatch',{timeout},()=>{
  let retained;const canvas=createDisplayListCanvas({nelyxReplayDisplayList(_packet,handles){retained=handles;throw Error('native rejected');}});canvas.drawPicture({});assert.throws(()=>canvas.nelyxFlush(),/native rejected/);assert.equal(retained.length,0);assert.throws(()=>canvas.drawPicture({}),/consumed/);
  let dispatched=false;const full=createDisplayListCanvas({nelyxReplayDisplayList(){dispatched=true;}});for(let i=0;i<65536;i++)full.save();assert.throws(()=>full.save(),/exceeds/);assert.equal(dispatched,false);
});

test('signed ARGB colours retain the same 32 native bits for fills and shadows',{timeout},()=>{
  let words;const canvas=createDisplayListCanvas({nelyxReplayDisplayList(packet){words=[...new Float64Array(packet)];}});
  canvas.nelyxFillRect({x:0,y:0,width:10,height:10},-16776961);
  canvas.nelyxDrawShadow({},-2147418368,3,false,2);canvas.nelyxFlush();
  assert.equal(words[13],0xff0000ff);assert.equal(words[18],0x8000ff00);
});
