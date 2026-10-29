// SPDX-License-Identifier: BSD-3-Clause
import test from 'node:test';import assert from 'node:assert/strict';
import {PaintingContext} from '@nelyx/core/framework/painting/context';
import {ContainerLayer,PictureLayer,OffsetLayer,AnnotatedRegionLayer,AnnotationType,LayerHandle} from '@nelyx/core/framework/rendering/layer';
import {Canvas} from '@nelyx/core/ui/canvas';
import {Paint} from '@nelyx/core/ui/paint';
import {Path} from '@nelyx/core/ui/path';
import {RRect} from '@nelyx/core/ui/rrect';
import {Radius} from '@nelyx/core/ui/radius';
import {PictureRecorder} from '@nelyx/core/ui/picture-recorder';
import {ImageFilter} from '@nelyx/core/ui/image-filter';
import {Gradient,ImageShader} from '@nelyx/core/ui/shader';
import {ResourceRegistry} from '@nelyx/core/hosting/resources';
import {FramePictureService} from '@nelyx/core/hosting/pictures';
import {freezeFrame,disposeFrame} from '@nelyx/core/ui/frame';
import {matrix4Identity,matrix4FromAffine,multiplyMatrix4,captureMatrix4} from '@nelyx/core/ui/matrix4';
import {engineFixture} from '../../../packages/material/tests/engine-fixture.mjs';
import {RecordedCompositionLayer} from '../../dist/framework/painting/recorded-layer.js';
const timeout=1_200_000,bounds={x:0,y:0,width:64,height:64};

test('recorded scope transforms are live before sealing and reuse immutable work afterward without capturing caller matrices',{timeout},()=>{
  const layer=new RecordedCompositionLayer(),child=new ContainerLayer(),hold=new LayerHandle(child),matrix=[1,0,0,1,7,11];
  try{
    layer.appendState({op:'transform',matrix});layer.appendRecordedChild(child);const expected=matrix4FromAffine(matrix);assert.deepEqual(layer.applyTransform(child),expected);matrix[4]=99;layer.seal();
    const captured=layer.applyTransform(child);assert.deepEqual(captured,expected);assert.equal(layer.applyTransform(child),captured);assert.equal(layer.applyTransform(child,captureMatrix4([...matrix4Identity])),captured);
    const negativeZero=[...matrix4Identity];negativeZero[3]=-0;const signed=layer.applyTransform(child,captureMatrix4(negativeZero));assert.notEqual(signed,captured);assert.deepEqual(signed,multiplyMatrix4(captureMatrix4(negativeZero),expected));
    const incoming=[...matrix4Identity];incoming[12]=13;assert.equal(layer.applyTransform(child,incoming)[12],20);incoming[12]=31;assert.equal(layer.applyTransform(child,incoming)[12],38);
    const owned=captureMatrix4(incoming),ownedResult=layer.applyTransform(child,owned);assert.equal(layer.applyTransform(child,captureMatrix4([...incoming])),ownedResult);
    incoming[12]=53;assert.equal(layer.applyTransform(child,captureMatrix4(incoming))[12],60);assert.equal(layer.applyTransform(child,Object.freeze([...incoming]))[12],60);
    child.remove();layer.append(child);assert.deepEqual(layer.applyTransform(child),matrix4Identity);
  }finally{layer.dispose();hold.dispose();}
});

test('an unchanged picture exposes current pixels beyond its old estimated bounds after viewport growth',{timeout},async()=>{
  const f=await engineFixture(),surface=f.ck.MakeSurface(64,64),root=new ContainerLayer(),contexts=[];assert(surface);
  const read=(commands,width)=>{
    const destination=new Canvas();try{destination.addCommands([{op:'clear',color:0xff000000}]);destination.clipRect({...bounds,width},{doAntiAlias:false});destination.addCommands(commands);f.library.replay(surface.getCanvas(),{commands:destination.commands});surface.flush();const image=surface.makeImageSnapshot();try{return Buffer.from(image.readPixels(0,0,{width:64,height:64,colorType:f.ck.ColorType.RGBA_8888,alphaType:f.ck.AlphaType.Unpremul,colorSpace:f.ck.ColorSpace.SRGB}));}finally{image.delete();}}finally{destination.dispose();}
  };
  let picture;
  try{
    for(const width of [32,64,24,64]){
      const current={...bounds,width},context=new PaintingContext(null,current,true),reference=new Canvas();contexts.push(context);
      try{
        for(const canvas of [context,reference])canvas.rect({x:48,y:8,width:8,height:8},0xffff0000);
        context.compose(root,current);const layer=root.firstChild.firstChild;if(picture)assert.equal(layer.picture,picture);else picture=layer.picture;
        const pixels=read(context.commands,width);assert.deepEqual(pixels,read(reference.commands,width));assert.equal(pixels[(10*64+50)*4],width===64?255:0);
      }finally{reference.dispose();context.dispose();}
    }
  }finally{for(const context of contexts)context.dispose();root.dispose();surface.dispose();await f.close();}
});

test('deep Canvas scopes retain one Layer owner with ordered real children and exact source transforms',{timeout},()=>{
  const root=new ContainerLayer(),context=new PaintingContext(null,bounds,true),type=new AnnotationType('recorded-depth'),first={},second={},a=new AnnotatedRegionLayer(first,{annotationType:type,size:{width:40,height:40}}),b=new AnnotatedRegionLayer(second,{annotationType:type,size:{width:10,height:10}}),seen=[];
  root.attach({});a.addCompositionCallback(layer=>seen.push(layer.parent.applyTransform(layer)));
  try{
    for(let index=0;index<24;index++){context.save();context.translate(1,0);context.clipRect({x:0,y:0,width:60,height:60});}
    context.addLayer(a);for(let index=0;index<24;index++)context.restore();context.addLayer(b);context.compose(root,bounds);
    const body=root.firstChild;assert.deepEqual(root.depthFirstIterateChildren(),[body,a,b]);assert.deepEqual(body.children,[a,b]);assert.equal(a.parent,b.parent);
    assert.deepEqual(seen,[matrix4FromAffine([1,0,0,1,24,0])]);assert.equal(root.find(type,{x:25,y:1}),first);assert.equal(root.find(type,{x:1,y:1}),second);
    const input=[1,2,0,.002,-3,4,0,.003,0,0,1,0,-20,10,0,1];let expected=input;for(let index=0;index<24;index++)expected=multiplyMatrix4(expected,matrix4FromAffine([1,0,0,1,1,0]));
    assert.deepEqual(body.applyTransform(a,input),expected);
  }finally{context.dispose();root.dispose();}
});

test('captured Layer mutation keeps detach geometry, immutable child snapshots and untransformed public reappends',{timeout},()=>{
  const root=new ContainerLayer(),context=new PaintingContext(null,bounds,true),type=new AnnotationType('recorded-mutation'),aValue={},bValue={},detaches=[];
  class Region extends AnnotatedRegionLayer{detach(){detaches.push(this.parent.applyTransform(this));assert(!this.parent.findAllAnnotations(type,{x:11,y:1}).annotations.includes(aValue));super.detach();}}
  const a=new Region(aValue,{annotationType:type,size:{width:10,height:10}}),hold=new LayerHandle(a),b=new AnnotatedRegionLayer(bValue,{annotationType:type,size:{width:10,height:10}});
  root.attach({});
  try{
    context.save();context.translate(10,0);context.addLayer(a);context.restore();context.compose(root,bounds);const body=root.firstChild;body.append(b);const before=body.children;
    a.remove();assert.deepEqual(detaches,[matrix4FromAffine([1,0,0,1,10,0])]);assert.deepEqual(before,[a,b]);assert(Object.isFrozen(before));
    body.append(a);assert.deepEqual(body.children,[b,a]);assert.deepEqual(body.applyTransform(a),matrix4Identity);assert.deepEqual(root.findAllAnnotations(type,{x:1,y:1}).annotations,[aValue,bValue]);assert.equal(root.find(type,{x:11,y:1}),null);
    root.buildScene().dispose();assert.throws(()=>body.append(a),/detached/);assert.deepEqual(body.children,[b,a]);
  }finally{context.dispose();root.dispose();hold.dispose();}
});

test('annotation walks keep shared and empty clip-path query order and recover after a missing geometry port',{timeout},()=>{
  const root=new ContainerLayer(),context=new PaintingContext(null,bounds,true),type=new AnnotationType('recorded-clips'),a={},b={},path=new Path(),calls=[];path.addRect(bounds);
  const paths={contains(_path,point){calls.push([point.x,point.y]);return true;}};
  try{
    context.save();context.clipPath(path);context.addLayer(new AnnotatedRegionLayer(a,{annotationType:type}));context.save();context.translate(10,10);context.clipPath(path);context.addLayer(new AnnotatedRegionLayer(b,{annotationType:type}));context.restore();context.restore();context.clipPath(path);context.compose(root,bounds);
    assert.throws(()=>root.find(type,{x:15,y:15}),/geometry service/);
    const result=root.findAllAnnotations(type,{x:15,y:15},{paths});assert.deepEqual(result.annotations,[b,a]);assert.deepEqual(result.entries.map(entry=>entry.localPosition),[{x:5,y:5},{x:15,y:15}]);assert.deepEqual(calls,[[15,15],[15,15],[5,5]]);
    calls.length=0;assert.equal(root.find(type,{x:15,y:15},{paths}),b);assert.deepEqual(calls,[[15,15],[15,15],[5,5]]);
  }finally{context.dispose();root.dispose();}
});

test('retained state shaders survive owner replacement only for the independently admitted frame',{timeout},()=>{
  const resources=new ResourceRegistry(),image={id:'recorded-state-image',generation:1,kind:'image'},root=new ContainerLayer(),context=new PaintingContext(null,bounds,true);let retired=0,frame;
  resources.register(image,()=>retired++);resources.bindResource(image);const shader=new ImageShader(image,'clamp','clamp',matrix4Identity);
  try{
    context.saveLayer(bounds,new Paint({shader}));context.addLayer(new ContainerLayer());context.restore();context.compose(root,bounds);
    frame=freezeFrame({owner:{id:'recorded-state',generation:1},sequence:1,metrics:{logicalWidth:64,logicalHeight:64,physicalWidth:64,physicalHeight:64,scale:1,viewportGeneration:1,rendererGeneration:1,nativeContextGeneration:null,nativeSurfaceGeneration:null}},context.commands);
    context.dispose();root.dispose();shader.dispose();resources.releaseProducer(image);assert.equal(retired,0);disposeFrame(frame);frame=undefined;assert.equal(retired,1);
  }finally{if(frame)disposeFrame(frame);context.dispose();if(!root.debugDisposed)root.dispose();if(!shader.debugDisposed)shader.dispose();resources.dispose();}
});

test('native recording state and retained insertions match direct CanvasKit pixels for clip, matrix and filter recipes',{timeout},async()=>{
  const f=await engineFixture(),surface=f.ck.MakeSurface(64,64),pictures=new FramePictureService(f.root.context.resources,f.library.framePictureBackend,f.root.context.owner);assert(surface);
  const paint=new Paint({color:0xffed6a23}),outline=new Paint({color:0xff2462e3}),path=new Path();path.addOval({x:0,y:0,width:43,height:49});
  const recorder=new PictureRecorder(),leaf=new Canvas(recorder);leaf.drawRect({x:0,y:0,width:27,height:31},paint);leaf.drawOval({x:4,y:6,width:30,height:22},outline);const picture=recorder.endRecording();leaf.dispose();
  const read=commands=>{f.library.replay(surface.getCanvas(),{commands});surface.flush();const image=surface.makeImageSnapshot();try{return Buffer.from(image.readPixels(0,0,{width:64,height:64,colorType:f.ck.ColorType.RGBA_8888,alphaType:f.ck.AlphaType.Unpremul,colorSpace:f.ck.ColorSpace.SRGB}));}finally{image.delete();}};
  const prefix=(canvas,index)=>{
    canvas.save();canvas.transform(index===7?[1,0,0,.004,0,1,0,.002,0,0,1,0,9,5,0,1]:index===6?[0,0,0,1,10,4]:index===5?[1,.2,-.1,1,9,7]:[1,0,0,1,7,5]);
    if(index===0)canvas.clipRect({x:1,y:2,width:35,height:37});
    if(index===1)canvas.clipRect({x:10,y:11,width:8,height:9},{clipOp:'difference'});
    if(index===2)canvas.clipRRect(new RRect(0,0,44,46,{topLeft:new Radius(2,5),topRight:new Radius(7,3),bottomLeft:new Radius(4,8),bottomRight:new Radius(9,6)}));
    if(index===3)canvas.clipPath(path,{clipOp:'difference'});
    if(index===4)canvas.saveLayer(bounds,new Paint({color:0x9fffffff,imageFilter:ImageFilter.blur({sigmaX:1,sigmaY:2})}));
    if(index===8){canvas.drawRect({x:0,y:0,width:43,height:46},outline);canvas.saveBackdropFilter(new Paint({imageFilter:ImageFilter.blur({sigmaX:2,sigmaY:1})}));}
  };
  try{
    for(let index=0;index<9;index++){
      const root=new ContainerLayer(),offset=new OffsetLayer({offset:{x:3,y:5}}),pictureLayer=new PictureLayer(bounds);
      // Each source Layer owns its separate Picture producer.
      const localRecorder=new PictureRecorder(),local=new Canvas(localRecorder);local.drawPicture(picture);pictureLayer.picture=localRecorder.endRecording();local.dispose();offset.append(pictureLayer);
      try{
       for(const width of [2,11,2]){
        const context=new PaintingContext(null,bounds,true),reference=new Canvas(),shaders=[];
        try{
        for(const canvas of [context,reference]){canvas.addCommands([{op:'clear',color:0xffd0d8e0}]);prefix(canvas,index);const shader=Gradient.linear({x:0,y:0},{x:3,y:3},[0xffff0000,0xff00ff00]);shaders.push(shader);canvas.save();canvas.drawRect({x:0,y:0,width,height:3},new Paint({shader}));canvas.save();canvas.translate(2,1);canvas.drawOval({x:0,y:0,width:4,height:5},outline);canvas.restore();canvas.restore();}
        context.addLayer(offset);reference.save();reference.translate(3,5);reference.drawPicture(picture);reference.restore();
        for(const canvas of [context,reference]){canvas.drawRect({x:31,y:28,width:9,height:8},outline);if(index===4||index===8)canvas.restore();canvas.restore();canvas.drawRect({x:55,y:57,width:4,height:3},paint);}
        context.compose(root,bounds,pictures);assert.deepEqual(read(context.commands),read(reference.commands),'Canvas recipe '+index+' width '+width);
        }finally{reference.dispose();context.dispose();for(const shader of shaders)shader.dispose();}
       }
      }finally{root.dispose();}
    }
  }finally{picture.dispose();pictures.dispose();surface.dispose();await f.close();}
});
