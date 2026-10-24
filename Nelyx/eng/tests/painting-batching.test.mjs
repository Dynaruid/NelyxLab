// SPDX-License-Identifier: BSD-3-Clause
import test from 'node:test';
import assert from 'node:assert/strict';
import {PaintingContext} from '@nelyx/core/framework/painting/context';
import {ContainerLayer,AnnotatedRegionLayer,AnnotationType,LayerHandle,LayerLink,LeaderLayer,FollowerLayer} from '@nelyx/core/framework/rendering/layer';
import {Paint} from '@nelyx/core/ui/paint';
import {FramePictureService} from '@nelyx/core/hosting/pictures';
import {ResourceRegistry} from '@nelyx/core/hosting/resources';
const timeout=1_200_000,bounds={x:0,y:0,width:800,height:600};
function fixture({beforeCompile}={}){
  const resources=new ResourceRegistry(),compiled=[],retired=[],root=new ContainerLayer(),context=new PaintingContext(null,bounds,true);
  const pictures=new FramePictureService(resources,{compile(capture,resource){beforeCompile?.(capture,resource);compiled.push(capture.frame.commands);return {bytes:0,retire(){retired.push(resource.id);}};}},{id:'batch-test',generation:1});
  return {root,context,compiled,retired,pictures,resources,close(){context.dispose();root.dispose();pictures.dispose();resources.dispose();assert.equal(retired.length,compiled.length);}};
}
function siblings(context,count=20){const paint=new Paint();for(let i=0;i<count;i++){context.save();context.translate(i*3,0);context.clipRect({x:0,y:0,width:30,height:30});context.drawRect({x:0,y:0,width:10,height:10},paint);context.restore();}}
test('empty canvas state scopes avoid native pictures while retained annotation geometry remains active',{timeout},()=>{
  const f=fixture(),type=new AnnotationType('empty-state-region'),value={};try{
    const c=f.context;c.save();c.translate(300,0);c.clipRect({x:0,y:0,width:10,height:10});c.restore();
    c.save();c.translate(40,50);c.clipRect({x:0,y:0,width:20,height:20});c.addLayer(new AnnotatedRegionLayer(value,{annotationType:type,size:{width:30,height:30}}));c.restore();
    c.save();c.translate(100,100);c.save();c.clipRect({x:0,y:0,width:10,height:10});c.restore();c.restore();
    c.compose(f.root,bounds,f.pictures);assert.equal(f.compiled.length,0);assert.equal(f.root.find(type,{x:45,y:55}),value);assert.equal(f.root.find(type,{x:65,y:55}),null);
  }finally{f.close();}
});
test('an empty offscreen layer retains its paint effect and native ownership',{timeout},()=>{
  const f=fixture();try{const c=f.context,paint=new Paint();paint.blendMode='clear';c.saveLayer(bounds,paint);c.restore();const commands=[...c.commands];c.compose(f.root,bounds,f.pictures);assert.equal(f.compiled.length,1);assert.deepEqual(f.compiled[0],commands);}finally{f.close();}
});
test('Sibling canvas scopes compile together and preserve every transform, clip and paint command',{timeout},()=>{
  const f=fixture();try{siblings(f.context);const commands=[...f.context.commands];f.context.compose(f.root,bounds,f.pictures);assert.equal(f.compiled.length,1,'A primitive subtree should produce one native picture');assert.deepEqual(f.compiled[0],commands);}finally{f.close();}
});
test('Retained annotation insertions keep their actual transform between batched sibling scopes',{timeout},()=>{
  const f=fixture(),type=new AnnotationType('batch-region'),annotation={name:'retained'};try{
    const c=f.context;c.save();c.translate(40,50);siblings(c);c.addLayer(new AnnotatedRegionLayer(annotation,{annotationType:type,size:{width:20,height:20}}));siblings(c);c.restore();siblings(c);
    c.compose(f.root,bounds,f.pictures);assert.equal(f.root.find(type,{x:45,y:55}),annotation);assert.equal(f.root.find(type,{x:5,y:5}),null);assert.equal(f.compiled.length,3,'Only retained insertions should split primitive batches');
    assert.equal(f.compiled.flat().filter(command=>command.op==='drawRect').length,60);
  }finally{f.close();}
});
test('Offscreen saveLayer scopes remain balanced inside a batched picture and retain admitted resources',{timeout},()=>{
  const f=fixture();try{const c=f.context;c.saveLayer(bounds,new Paint());siblings(c,3);c.restore();const commands=[...c.commands];c.compose(f.root,bounds,f.pictures);assert.equal(f.compiled.length,1);assert.deepEqual(f.compiled[0],commands);
    const held=f.resources.acquire(c.commands.filter(command=>command.op==='drawPicture').map(command=>command.resource));held.transfer();c.dispose();f.root.removeAllChildren();f.pictures.dispose();assert.equal(f.retired.length,0,'An admitted frame owns its native picture after tree replacement');held.returnBy('renderer');assert.equal(f.retired.length,1);
  }finally{f.close();}
});
test('Expanded matrix and paint records split batches at the existing wire budget',{timeout},()=>{
  const f=fixture();try{const c=f.context,paint=new Paint();for(let i=0;i<700;i++){c.save();c.transform([1,0,0,0,0,1,0,0,0,0,1,0,i,0,0,1]);c.drawRect({x:0,y:0,width:1,height:1},paint);c.restore();}c.compose(f.root,bounds,f.pictures);assert.equal(f.compiled.length,2);assert.equal(f.compiled.flat().filter(command=>command.op==='drawRect').length,700);}finally{f.close();}
});

test('stationary retained composition preserves layer attachment, callbacks and in-flight native pictures',{timeout},()=>{
  class Region extends AnnotatedRegionLayer{attachedCount=0;detachedCount=0;attach(owner){this.attachedCount++;super.attach(owner);}detach(){this.detachedCount++;super.detach();}}
  const f=fixture(),type=new AnnotationType('stable-compose'),value={},region=new Region(value,{annotationType:type,size:{width:20,height:20}}),handle=new LayerHandle(region),contexts=[],calls=[];let held;
  region.addCompositionCallback(layer=>calls.push(layer.attached));f.root.attach({});
  const paint=x=>{const c=new PaintingContext(null,bounds,true);contexts.push(c);c.save();c.translate(x,10);c.addLayer(region);c.restore();c.rect({x:0,y:0,width:5,height:5},0xff123456);c.compose(f.root,bounds,f.pictures);return c;};
  try{
    const first=paint(10),compiled=f.compiled.length;held=f.resources.acquire(first.commands.filter(command=>command.op==='drawPicture').map(command=>command.resource));held.transfer();
    region.attachedCount=region.detachedCount=0;calls.length=0;const second=paint(10);
    assert.equal(region.attachedCount,0);assert.equal(region.detachedCount,0);assert.deepEqual(calls,[true]);assert.equal(f.compiled.length,compiled);assert.deepEqual(second.commands,first.commands);assert.equal(f.root.find(type,{x:15,y:15}),value);
    first.dispose();second.dispose();paint(40);assert.equal(f.root.find(type,{x:45,y:15}),value);assert.equal(f.root.find(type,{x:15,y:15}),null);assert.equal(f.retired.length,0,'The earlier admitted frame still owns its picture');
    held.returnBy('renderer');held=undefined;assert.equal(f.retired.length,1);
  }finally{if(held)held.returnBy('renderer');for(const c of contexts)c.dispose();f.close();handle.dispose();}
});

test('a failed composition retries the same content and never reuses a partially built assembly',{timeout},()=>{
  let fail=false;const f=fixture({beforeCompile(){if(fail)throw Error('compile interrupted');}}),contexts=[];
  const paint=color=>{const c=new PaintingContext(null,bounds,true);contexts.push(c);c.rect({x:0,y:0,width:10,height:10},color);c.compose(f.root,bounds,f.pictures);return c;};
  try{paint(0xff123456).dispose();fail=true;assert.throws(()=>paint(0xffabcdef),/compile interrupted/);fail=false;const current=paint(0xffabcdef);assert.equal(f.compiled.at(-1).find(command=>command.op==='rect').color,0xffabcdef);const compiled=f.compiled.length;paint(0xffabcdef);assert.equal(f.compiled.length,compiled);assert(current.commands.some(command=>command.op==='drawPicture'));}
  finally{for(const c of contexts)c.dispose();f.close();}
});

test('cached composition refreshes follower transforms without reattaching its linked leader',{timeout},()=>{
  const f=fixture(),link=new LayerLink(),leader=new LeaderLayer({link,offset:{x:10,y:20}}),follower=new FollowerLayer({link}),handles=[new LayerHandle(leader),new LayerHandle(follower)],contexts=[],type=new AnnotationType('cached-follower'),value={};
  follower.append(new AnnotatedRegionLayer(value,{annotationType:type,size:{width:5,height:5}}));f.root.attach({});
  const paint=()=>{const c=new PaintingContext(null,bounds,true);contexts.push(c);c.addLayer(leader);c.addLayer(follower);c.compose(f.root,bounds,f.pictures);};
  try{paint();const body=f.root.firstChild;assert.equal(f.root.find(type,{x:11,y:21}),value);leader.offset={x:40,y:50};paint();assert.equal(f.root.firstChild,body);assert.equal(link.leader,leader);assert.equal(f.root.find(type,{x:41,y:51}),value);assert.equal(f.root.find(type,{x:11,y:21}),null);assert.equal(f.compiled.length,0);}
  finally{for(const c of contexts)c.dispose();f.close();for(const handle of handles)handle.dispose();}
});

test('external changes to a cached body invalidate its assembly while old child snapshots stay immutable',{timeout},()=>{
  const f=fixture(),contexts=[];const paint=()=>{const c=new PaintingContext(null,bounds,true);contexts.push(c);c.rect({x:0,y:0,width:10,height:10},0xff123456);c.compose(f.root,bounds,f.pictures);};
  try{paint();const body=f.root.firstChild,children=body.children;body.removeAllChildren();assert(Object.isFrozen(children));assert.equal(children.length,1);assert.equal(body.children.length,0);paint();assert.equal(f.compiled.length,2);assert.equal(f.compiled.at(-1)[0].color,0xff123456);}
  finally{for(const c of contexts)c.dispose();f.close();}
});
