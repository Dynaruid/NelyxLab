// SPDX-License-Identifier: BSD-3-Clause
import test from 'node:test';import assert from 'node:assert/strict';
import {submitNativeScene} from '@nelyx/skia-native/scene';
import {replayFrame,GraphiteRenderer} from '@nelyx/skia-native/renderer';
import {createDisplayListCanvas} from '@nelyx/skia-native/display-list';
import {Paint} from '@nelyx/core/ui/paint';
import {ImageFilter} from '@nelyx/core/ui/image-filter';
const timeout=1_200_000;
test('a required scene binding is checked before configuring or admitting a recording',{timeout},()=>{
  let configured=0;const native={nelyxReserve(){},nelyxSubmit(){},nelyxNotifications:()=>[],nelyxCoreVersion:()=>1,nelyxWireVersion:()=>11,nelyxIdentity:()=>7,nelyxConfigure(){configured++;}};
  assert.throws(()=>new GraphiteRenderer({},()=>native,{id:'missing-scene',generation:1},{nativeDisplayLists:true,image(){},paragraph(){}}),/display-list1 binding required/);assert.equal(configured,0);
});
function fixture({failNative=false,failRetire=false}={}){
  const temporary=[],packets=[],opcodes=[];let mutations=0;
  const own=(kind,value)=>{const handle={kind,value,retired:0,dispose(){this.retired++;if(failRetire)throw Error('retire-'+kind);}};temporary.push(handle);return handle;};
  const api={Color:value=>[value>>>24&255,value>>>16&255,value>>>8&255,value&255].map(x=>x/255),XYWHRect(x,y,width,height){const r=own('rect',{x,y,width,height});r.setLTRB=(left,top,right,bottom)=>{r.value={x:left,y:top,width:right-left,height:bottom-top};};return r;},RRectXY:(rect,rx,ry)=>own('rrect',{rect:rect.value,rx,ry}),Matrix:values=>own('matrix',values),Paint(){const paint=own('paint',{Color:api.Color(0xff000000),AntiAlias:true,Style:0,StrokeWidth:0,StrokeMiter:4,StrokeCap:0,StrokeJoin:0,BlendMode:3,Shader:null,ColorFilter:null,ImageFilter:null,MaskFilter:null,Dither:false});for(const field of Object.keys(paint.value))paint['set'+field]=value=>{paint.value[field]=value;};return paint;}};
  api.PathBuilder={Make(){const builder=own('builder',{fillType:0,ops:[]});builder.setFillType=value=>{builder.value.fillType=value;};for(const name of ['moveTo','lineTo','close'])builder[name]=(...values)=>builder.value.ops.push([name,...values]);builder.build=()=>own('path',structuredClone(builder.value));return builder;}};
  api.ImageFilter={MakeBlur:(sigmaX,sigmaY,tileMode)=>own('filter',{sigmaX,sigmaY,tileMode})};
  const image={kind:'image',width:()=>20,height:()=>30},paragraph={kind:'paragraph'},picture={kind:'picture'};
  const resources={image:()=>image,paragraph:()=>({nativeParagraph:paragraph}),picture:()=>picture};
  const snapshot=value=>Array.isArray(value)?value.map(snapshot):value?.kind?{kind:value.kind,...(value.value===undefined?{}:{value:snapshot(value.value)})}:value&&typeof value==='object'?Object.fromEntries(Object.entries(value).filter(([,item])=>typeof item!=='function').map(([key,item])=>[key,snapshot(item)])):value;
  const target={nelyxReplayDisplayList(buffer,handles){if(failNative)throw Error('native-reject');mutations++;const data=new Float64Array(buffer),commands=[],refs={2:[0],3:[0],4:[0,1],5:[0,1],6:[0,1],7:[4],8:[0],9:[0],10:[0,1],11:[0],12:[0],14:[0,1,2,3],15:[0,1,2,5],16:[0,1,2,5],17:[0,1,2,4],18:[0],19:[0],20:[0,1,2],21:[0]};let at=4;for(let n=0;n<data[2];n++){const op=data[at++],count=data[at++],values=[...data.subarray(at,at+count)];at+=count;for(const index of refs[op]??[])values[index]=values[index]===-1?null:snapshot(handles[values[index]]);opcodes.push(op);if(op===12){const m=values[0].value;commands.push({op:13,values:[m[0],m[3],0,m[6],m[1],m[4],0,m[7],0,0,1,0,m[2],m[5],0,m[8]].map(Math.fround)});}else commands.push({op,values:op===13?values.map(Math.fround):values});}assert.equal(at,data.length);packets.push(commands);}};
  return {api,target,resources,temporary,packets,opcodes,get mutations(){return mutations;},verifyRetired(){for(const value of temporary)assert.equal(value.retired,1,value.kind);}};
}
const resource={id:'resource',generation:1},rect={x:1,y:2,width:3,height:4};
test('the native scene consumes Core commands directly with the existing packet meaning',{timeout},()=>{
  const plain=new Paint({color:0xff123456}).snapshot(),stroke=new Paint({color:0xff223344,style:'stroke',strokeWidth:2}).snapshot();
  const commands=[{op:'clear',color:0xff000011},{op:'save'},{op:'transform',matrix:[1,0,0,1,5,6]},{op:'transform',matrix:[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]},{op:'clip',rect},{op:'clipRect',rect,clipOp:'difference',doAntiAlias:false},{op:'clipRRect',rect,radius:2,clipOp:'intersect',doAntiAlias:true},{op:'rect',rect,color:0xffabcdef},{op:'rrect',rect,radius:1,color:-16776961},{op:'drawRect',rect,paint:plain},{op:'drawOval',rect,paint:plain},{op:'drawRRect',rect,radius:1,paint:plain},{op:'drawRect',rect,paint:stroke},{op:'drawLine',from:{x:0,y:1},to:{x:2,y:3},paint:stroke},{op:'drawPaint',paint:plain},{op:'image',rect,resource},...[undefined,'low','medium','high'].map(filterQuality=>({op:'drawImageRect',resource,src:rect,dst:rect,paint:new Paint({filterQuality}).snapshot()})),{op:'drawImageNine',resource,center:rect,dst:rect,paint:plain},{op:'paragraph',resource,x:5,y:6},{op:'drawPicture',resource},{op:'saveLayer',paint:plain,bounds:rect},{op:'restore'},{op:'restore'}];
  const path={fillType:'nonZero',operations:[{verb:'moveTo',values:[0,0]},{verb:'lineTo',values:[4,0]},{verb:'lineTo',values:[0,4]},{verb:'close',values:[]}]},rrect={values:[0,0,10,11,1,2,3,4,5,6,7,8]};
  commands.splice(2,0,{op:'drawOval',rect,paint:stroke},{op:'drawPath',path,paint:stroke},{op:'clipPath',path,clipOp:'difference',doAntiAlias:false},{op:'drawShadow',path,color:0x80123456,elevation:3,transparentOccluder:false,devicePixelRatio:2},{op:'clipRRect',rrect,clipOp:'intersect',doAntiAlias:true},{op:'drawRRect',rrect,paint:plain},{op:'saveBackdropFilter',paint:new Paint({imageFilter:ImageFilter.blur({sigmaX:2,sigmaY:3})}).snapshot()},{op:'restore'});
  const direct=fixture(),generic=fixture();submitNativeScene(direct.api,direct.target,{commands},direct.resources);replayFrame(generic.api,createDisplayListCanvas(generic.target),{commands},generic.resources);
  assert.deepEqual(direct.packets,generic.packets);assert.deepEqual([...new Set(generic.opcodes)].sort((a,b)=>a-b),Array.from({length:23},(_,index)=>index));assert.deepEqual([...new Set(direct.opcodes)].sort((a,b)=>a-b),Array.from({length:23},(_,index)=>index).filter(op=>op!==12));assert(!direct.temporary.some(value=>value.kind==='matrix'));assert.equal(direct.mutations,1);direct.verifyRetired();generic.verifyRetired();
});
test('affine scene transforms retain native float32 matrix meaning without Matrix wrappers',{timeout},()=>{
  const direct=fixture(),generic=fixture(),matrices=[[1,0,0,1,5,6],[-2.5,.25,.5,3,-12,21],[1/3,-2/3,4/3,.1,123.456,-789.123],[0,0,0,0,0,0]],commands=matrices.map(matrix=>({op:'transform',matrix}));
  direct.api.Matrix=()=>{throw Error('An affine scene must not allocate a Matrix wrapper');};
  submitNativeScene(direct.api,direct.target,{commands},direct.resources);replayFrame(generic.api,createDisplayListCanvas(generic.target),{commands},generic.resources);
  assert.deepEqual(direct.packets,generic.packets);assert.deepEqual(direct.opcodes,[13,13,13,13]);assert.deepEqual(direct.temporary,[]);generic.verifyRetired();
});

test('preflight failure never dispatches and native/cleanup errors preserve all owners',{timeout},()=>{
  const f=fixture(),paint=new Paint({style:'stroke'}).snapshot();assert.throws(()=>submitNativeScene(f.api,f.target,{commands:[{op:'drawRect',rect,paint},{op:'paragraph',resource,x:0,y:0}]},{...f.resources,paragraph(){throw Error('retired-paragraph');}}),/retired-paragraph/);assert.equal(f.mutations,0);f.verifyRetired();
  const g=fixture({failNative:true,failRetire:true});let failure;try{submitNativeScene(g.api,g.target,{commands:[{op:'drawRect',rect,paint}]},g.resources);}catch(error){failure=error;}assert(failure instanceof AggregateError);assert.deepEqual(failure.errors.map(x=>x.message),['native-reject','retire-paint','retire-rect']);g.verifyRetired();
});
test('growing packets preserve values, refuse excess commands and drop synchronous handle roots',{timeout},()=>{
  const f=fixture(),command={op:'rect',rect,color:0xff334455};submitNativeScene(f.api,f.target,{commands:Array(300).fill(command)},f.resources);assert.equal(f.packets[0].length,300);assert(f.packets[0].every(x=>x.op===22&&x.values[7]===command.color));
  const g=fixture();assert.throws(()=>submitNativeScene(g.api,g.target,{commands:Array(65537).fill({op:'save'})},g.resources),/budget|exceeds/);assert.equal(g.mutations,0);
  let roots;submitNativeScene(f.api,{nelyxReplayDisplayList(_buffer,handles){roots=handles;assert.equal(handles.length,1);}},{commands:[{op:'drawPicture',resource}]},f.resources);assert.equal(roots.length,0);
});
