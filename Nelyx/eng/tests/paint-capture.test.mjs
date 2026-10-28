// SPDX-License-Identifier: BSD-3-Clause
import test from 'node:test';import assert from 'node:assert/strict';
import {freezePaintCommand,freezeFrame,captureBorrowedFrame,disposeFrame} from '@nelyx/core/ui/frame';
import {Canvas} from '@nelyx/core/ui/canvas';
import {PaintingContext} from '@nelyx/core/framework/painting/context';
import {captureTransform} from '@nelyx/core/ui/geometry';
import {Paint,freezePaint} from '@nelyx/core/ui/paint';
import {ImageShader} from '@nelyx/core/ui/shader';
import {ResourceRegistry} from '@nelyx/core/hosting/resources';
import {bindResourceRetainer,releaseCommandResources,ownFrameResources,releaseFrameResources} from '../../dist/ui/resource-retention.js';
const timeout=1_200_000;

test('borrowed recording capture keeps its source and multiple admitted frames independently live',{timeout},()=>{
  const registry=new ResourceRegistry(),image={id:'borrowed-image',generation:1,kind:'image'},canvas=new Canvas();let retired=0,first,second;
  const token={owner:{id:'borrowed-frame',generation:1},sequence:1,metrics:{logicalWidth:1,logicalHeight:1,physicalWidth:1,physicalHeight:1,scale:1,viewportGeneration:1,rendererGeneration:1,nativeContextGeneration:null,nativeSurfaceGeneration:null}};
  try{
    registry.register(image,()=>retired++);registry.bindResource(image);canvas.image(image,{x:0,y:0,width:1,height:1});registry.releaseProducer(image);
    first=captureBorrowedFrame(token,canvas.commands);
    assert.notEqual(first.commands[0],canvas.commands[0]);assert.equal(first.commands[0].resource,canvas.commands[0].resource);assert(Object.isFrozen(first.commands[0].resource));
    assert.throws(()=>captureBorrowedFrame(token,[...canvas.commands,{op:'restore'}]),/restore without save/);
    disposeFrame(first);first=undefined;assert.equal(retired,0,'The failed capture and first frame cannot consume the source');
    first=captureBorrowedFrame(token,canvas.commands);second=captureBorrowedFrame({...token,sequence:2},canvas.commands);
    canvas.dispose();assert.equal(retired,0);disposeFrame(first);first=undefined;assert.equal(retired,0);
    disposeFrame(second);second=undefined;assert.equal(retired,1);
  }finally{if(first)disposeFrame(first);if(second)disposeFrame(second);canvas.dispose();registry.dispose();}
});

test('borrowed frame validation rolls back new holds after a falsey cleanup failure without retiring the source',{timeout},()=>{
  const resource={id:'borrowed-failure',generation:1},token={owner:{id:'borrowed-frame',generation:1},sequence:1,metrics:{logicalWidth:1,logicalHeight:1,physicalWidth:1,physicalHeight:1,scale:1,viewportGeneration:1,rendererGeneration:1,nativeContextGeneration:null,nativeSurfaceGeneration:null}};
  let disposed=0;
  bindResourceRetainer(resource,()=>({dispose(){disposed++;throw null;}}));
  const command=freezePaintCommand({op:'paragraph',resource,x:0,y:0});
  assert.throws(()=>captureBorrowedFrame(token,[command,{op:'restore'}]),error=>error instanceof AggregateError&&/restore without save/.test(error.errors[0].message)&&error.errors[1]===null);
  assert.equal(disposed,1);assert.throws(()=>releaseCommandResources([command]),error=>error===null);assert.equal(disposed,2);
  releaseCommandResources([command]);assert.equal(disposed,2);
});

test('Canvas and PaintingContext snapshot transforms before custom recording hooks and validate native scalar limits',{timeout},()=>{
  for(const Base of [Canvas,PaintingContext]){
  const matrix=[1,0,0,1,5,8],canvas=new Base(),observed=[];
  class Custom extends Base{record(command){observed.push(command.matrix);if(command.op==='transform')command.matrix[4]=17;super.record(command);}}
  const custom=new Custom();try{
    canvas.transform(matrix);matrix[4]=9;assert.equal(canvas.commands[0].matrix[4],5);
    custom.transform(matrix);assert.notEqual(observed[0],matrix);assert.equal(matrix[4],9);assert.equal(custom.commands[0].matrix[4],17);
    const typed=new Float64Array([1,0,0,1,12,13]);canvas.transform(typed);typed[4]=100;assert.equal(canvas.commands[1].matrix[4],12);
    custom.transform(typed);assert.notEqual(observed[1],typed);assert.equal(typed[4],100);assert.equal(custom.commands[1].matrix[4],17);
    observed[1][4]=200;assert.equal(custom.commands[1].matrix[4],17);
    assert.throws(()=>canvas.transform([1,0,0,1,1e100,0]),/SkScalar/);assert.equal(canvas.commands.length,2);
  }finally{canvas.dispose();custom.dispose();}
  }
});

test('transform validation captures an external iterator once and validates the recorded length and values',{timeout},()=>{
  for(const Base of [Canvas,PaintingContext]){
    const canvas=new Base(),values=[1,0,0,1,5,8];let reads=0;
    const matrix=Array(6).fill(0);matrix[Symbol.iterator]=function*(){reads++;for(let index=0;index<6;index++)yield reads===1?values[index]:NaN;};
    try{
      canvas.transform(matrix);assert.equal(reads,1);assert.deepEqual(canvas.commands[0].matrix,values);
      for(const length of [5,7]){const input=Array(6).fill(0);input[Symbol.iterator]=function*(){for(let index=0;index<length;index++)yield 0;};assert.throws(()=>canvas.transform(input),/six affine or sixteen/);}
      const invalid=Array(6).fill(0);invalid[Symbol.iterator]=function*(){yield* [1,0,0,1,NaN,0];};assert.throws(()=>canvas.transform(invalid),/finite/);assert.equal(canvas.commands.length,1);
    }finally{canvas.dispose();}
  }
});

test('built-in state recording shares only owned values while custom hooks keep independent mutable arguments',{timeout},()=>{
  for(const Base of [Canvas,PaintingContext]){
    const first=new Base(),second=new Base(),observed=[];
    class Custom extends Base{record(command){command.marker=observed.length+1;observed.push(command);if(command.op==='transform')command.matrix[4]=17;super.record(command);}}
    const custom=new Custom();
    try{
      first.save();first.restore();second.save();second.restore();
      assert.equal(first.commands[0],second.commands[0],'Save has no mutable values or resource holds');
      assert.equal(first.commands[1],second.commands[1],'Restore has no mutable values or resource holds');
      for(const length of [6,16]){
        const values=length===6?[1,-0,0,1,-0,8]:[1,-0,0,0,0,1,0,0,0,0,1,0,-0,8,0,1],owned=captureTransform(values),start=first.commands.length;
        first.transform(owned);second.transform(owned);
        assert.equal(first.commands[start].matrix,owned);assert.equal(second.commands.at(-1).matrix,owned);
        assert.equal(first.commands[start],second.commands.at(-1),'Owned transforms have no command resource sidecar');
        const external=Object.freeze([...values]);first.transform(external);first.transform(external);
        assert.notEqual(first.commands.at(-1).matrix,external);assert.notEqual(first.commands.at(-1).matrix,first.commands.at(-2).matrix);
        const invalid=[...values];invalid[0]=1e100;assert.throws(()=>first.transform(captureTransform(invalid)),/SkScalar/);
        custom.transform(owned);assert.equal(owned[4],values[4]);assert.notEqual(observed.at(-1).matrix,owned);
      }
      custom.save();custom.save();custom.restore();
      assert.notEqual(observed.at(-2),observed.at(-3));assert(observed.every(command=>!Object.isFrozen(command)));
      for(const command of observed)command.marker=99;
      assert.deepEqual(custom.commands.map(command=>command.marker),[1,2,3,4,5]);
      const external=freezePaintCommand({op:'save',marker:'external'});assert.equal(external.marker,'external');assert.notEqual(external,first.commands[0]);
    }finally{first.dispose();second.dispose();custom.dispose();}
  }
});

test('command retirement detaches duplicate holds before reentrant and failing callbacks',{timeout},()=>{
  const first={id:'first-retirement',generation:1},second={id:'second-retirement',generation:1},retired=[],failure=Error('first retirement failed');let commands;
  bindResourceRetainer(first,()=>({dispose(){retired.push('first');releaseCommandResources(commands);throw failure;}}));
  bindResourceRetainer(second,()=>({dispose(){retired.push('second');}}));
  const a=freezePaintCommand({op:'paragraph',resource:first,x:0,y:0}),b=freezePaintCommand({op:'paragraph',resource:second,x:0,y:0}),plain=freezePaintCommand({op:'save'});
  commands=[plain,a,a,b,plain,b];assert.throws(()=>releaseCommandResources(commands),error=>error===failure);assert.deepEqual(retired,['first','second']);
  releaseCommandResources(commands);assert.deepEqual(retired,['first','second']);
});

test('frame admission moves duplicate command ownership once and rollback releases both image holds',{timeout},()=>{
  const image={id:'frame-hold',generation:1},resources=Object.freeze([image]);let retired=0;
  bindResourceRetainer(image,()=>({dispose(){retired++;}}));const command=freezePaintCommand({op:'paragraph',resource:image,x:0,y:0});
  ownFrameResources(resources,[command,command]);releaseCommandResources([command]);assert.equal(retired,0);releaseFrameResources(resources);releaseFrameResources(resources);assert.equal(retired,1);
  const shader={id:'failing-image-shader',generation:1},captureFailure=Error('shader capture failed'),rollbackFailure=Error('image rollback failed');
  bindResourceRetainer(image,()=>({dispose(){retired++;throw rollbackFailure;}}));bindResourceRetainer(shader,()=>{throw captureFailure;});
  assert.throws(()=>freezePaintCommand({op:'drawImageRect',resource:image,src:{x:0,y:0,width:1,height:1},dst:{x:0,y:0,width:1,height:1},paint:{...new Paint().snapshot(),shader:{kind:'image',image:shader,tileModeX:'clamp',tileModeY:'clamp',matrix:[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1],filterQuality:'none'}}}),error=>error instanceof AggregateError&&error.errors[0]===captureFailure&&error.errors[1]===rollbackFailure);
  assert.equal(retired,2);
});

test('a captured frame owns the final command list and a partial admission retires every captured and source hold',{timeout},()=>{
  const token={owner:{id:'capture-frame',generation:1},sequence:1,metrics:{logicalWidth:1,logicalHeight:1,physicalWidth:1,physicalHeight:1,scale:1,viewportGeneration:1,rendererGeneration:1,nativeContextGeneration:null,nativeSurfaceGeneration:null}};
  for(const fail of [false,true]){
    const registry=new ResourceRegistry(),image={id:'frame-image',generation:1,kind:'image'},canvas=new Canvas();let retired=0,frame;
    registry.register(image,()=>retired++);registry.bindResource(image);canvas.image(image,{x:0,y:0,width:1,height:1});registry.releaseProducer(image);
    const source=[canvas.commands[0],fail?{op:'restore'}:{op:'clear',color:0xff123456}];
    try{
      if(fail){assert.throws(()=>freezeFrame(token,source),error=>error.code==='unbalanced-save');assert.equal(retired,1);}
      else{frame=freezeFrame(token,source);assert.notEqual(frame.commands,source);assert(Object.isFrozen(frame.commands));assert.equal(frame.commands.length,2);canvas.dispose();assert.equal(retired,0);disposeFrame(frame);assert.equal(retired,1);}
    }finally{if(frame)disposeFrame(frame);canvas.dispose();registry.dispose();}assert.equal(retired,1);
  }
});

test('repeated default colors keep recorded values, custom scalar settings and constructor hooks independent',{timeout},()=>{
  const canvas=new Canvas(),first=new Paint(),second=new Paint(),colors=[0x04000000,0x03000000,0x02000000,0x01000000,0];
  try{
    for(const color of colors){first.color=color;canvas.drawRect({x:0,y:0,width:1,height:1},first);second.color=color;assert.equal(second.snapshot(),first.snapshot());}
    assert.deepEqual(canvas.commands.map(command=>command.paint.color),colors);second.strokeWidth=3;second.color=colors[0];assert.equal(second.snapshot().strokeWidth,3);assert.equal(first.strokeWidth,0);
    const copied=Paint.from(first);copied.color=colors[1];assert.equal(first.color,0);assert.equal(copied.color,colors[1]);
    assert.throws(()=>{first.color=NaN;},/ARGB/);assert.equal(first.color,0);first.color=-0;assert(Object.is(first.color,-0));first.color=0;assert(!Object.is(first.color,-0));
    const calls=[];class CustomPaint extends Paint{set shader(value){calls.push(value);super.shader=value;}}
    new CustomPaint();assert.deepEqual(calls,[null],'Subclass constructor setters must still observe their default assignment');
  }finally{canvas.dispose();}
});

test('default Paint values can share a capture while every mutable Paint and recorded colour stays independent',{timeout},()=>{
  const first=new Paint(),second=new Paint(undefined),explicit=new Paint({}),copy=Paint.from(first),original=first.snapshot(),canvas=new Canvas();
  try{
    assert.deepEqual(original,{color:0xff000000,blendMode:'srcOver',style:'fill',isAntiAlias:true,strokeWidth:0,strokeCap:'butt',strokeJoin:'miter',strokeMiterLimit:4});
    assert.equal(second.snapshot(),original);assert.equal(copy.snapshot(),original);assert.deepEqual(explicit.snapshot(),original);assert(Object.isFrozen(original));
    canvas.drawRect({x:0,y:0,width:1,height:1},first);
    first.color=0xff123456;copy.strokeWidth=3;second.isAntiAlias=false;
    assert.equal(canvas.commands[0].paint,original);assert.equal(original.color,0xff000000);
    assert.equal(explicit.color,0xff000000);assert.equal(explicit.strokeWidth,0);assert.equal(explicit.isAntiAlias,true);
    assert.equal(first.strokeWidth,0);assert.equal(first.isAntiAlias,true);assert.equal(copy.color,0xff000000);assert.equal(copy.isAntiAlias,true);
    assert.equal(second.color,0xff000000);assert.equal(second.strokeWidth,0);
    assert.throws(()=>new Paint({strokeWidth:-1}),/nonnegative/);
    assert.throws(()=>new Paint({unsupported:true}),/unsupported/);
  }finally{canvas.dispose();}
});

test('Paint reuses owned immutable snapshots, preserves recorded values and revalidates external effects',{timeout},()=>{
  const paint=new Paint({color:0xff123456}),original=paint.snapshot(),canvas=new Canvas();
  try{
    canvas.drawRect({x:0,y:0,width:1,height:1},paint);assert.equal(canvas.commands[0].paint,original);
    paint.color=0xff123456;paint.strokeWidth=0;assert.equal(paint.snapshot(),original);
    paint.color=0xff654321;assert.notEqual(paint.snapshot(),original);assert.equal(canvas.commands[0].paint.color,0xff123456);
    assert.throws(()=>{paint.color=NaN;},/ARGB/);assert.equal(paint.color,0xff654321);
    const colors=[0xff000000,0xffffffff],external=Object.freeze({...original,shader:{kind:'linear',points:[0,0,10,0],colors,stops:null,tileMode:'clamp',matrix:null}});
    const captured=freezePaint(external);assert.equal(freezePaint(captured),captured);assert.notEqual(captured.shader.colors,colors);
    colors[0]=NaN;assert.equal(captured.shader.colors[0],0xff000000);assert.throws(()=>freezePaint(external),/ARGB/);
    assert.throws(()=>freezePaint(Object.freeze({...original,strokeWidth:-1})),/nonnegative/);
  }finally{canvas.dispose();}
});
test('Internal command copies share immutable values while external frozen commands are validated again',{timeout},()=>{
  const input={op:'transform',matrix:[1,0,0,1,5,8]},first=freezePaintCommand(input),second=freezePaintCommand(first);
  assert.equal(first,second);assert.equal(first.matrix,second.matrix);assert(Object.isFrozen(second.matrix));input.matrix[4]=100;assert.equal(second.matrix[4],5);
  const matrix=[1,0,0,1,0,0],external=Object.freeze({op:'transform',matrix});freezePaintCommand(external);matrix[0]=NaN;assert.throws(()=>freezePaintCommand(external),/finite/);
  assert.throws(()=>freezePaintCommand(Object.freeze({op:'rect',rect:Object.freeze({x:0,y:0,width:-1,height:1}),color:0xff000000})),/negative/);
});
test('Copied image and image-shader commands have independent bindings and resource holds',{timeout},()=>{
  const registry=new ResourceRegistry(),image={id:'capture-image',generation:1,kind:'image'},canvas=new Canvas();let retired=0;registry.register(image,()=>retired++);registry.bindResource(image);
  const shader=new ImageShader(image,'clamp','clamp',[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]),imageCopy=new Canvas(),shaderCopy=new Canvas();
  try{
    canvas.image(image,{x:0,y:0,width:1,height:1});canvas.drawRect({x:0,y:0,width:1,height:1},new Paint({shader}));
    imageCopy.addCommands([canvas.commands[0]]);shaderCopy.addCommands([canvas.commands[1]]);
    assert.notEqual(imageCopy.commands[0].resource,canvas.commands[0].resource);assert.notEqual(shaderCopy.commands[0].paint.shader.image,canvas.commands[1].paint.shader.image);
    canvas.dispose();shader.dispose();registry.releaseProducer(image);assert.equal(retired,0);imageCopy.dispose();assert.equal(retired,0);shaderCopy.dispose();assert.equal(retired,1);
  }finally{canvas.dispose();if(!shader.debugDisposed)shader.dispose();imageCopy.dispose();shaderCopy.dispose();registry.dispose();}
});
