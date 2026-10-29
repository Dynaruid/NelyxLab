// SPDX-License-Identifier: BSD-3-Clause
import test from 'node:test';
import assert from 'node:assert/strict';
import {PaintingContext} from '@nelyx/core/framework/painting/context';
import {ContainerLayer,PictureLayer,AnnotatedRegionLayer,AnnotationType,LayerHandle,LayerLink,LeaderLayer,FollowerLayer} from '@nelyx/core/framework/rendering/layer';
import {Paint} from '@nelyx/core/ui/paint';
import {Picture} from '@nelyx/core/ui/picture';
import {Gradient,ImageShader} from '@nelyx/core/ui/shader';
import {FramePictureService} from '@nelyx/core/hosting/pictures';
import {ResourceRegistry} from '@nelyx/core/hosting/resources';
const timeout=1_200_000,bounds={x:0,y:0,width:800,height:600};
function fixture({beforeCompile}={}){
  const resources=new ResourceRegistry(),compiled=[],retired=[],root=new ContainerLayer(),context=new PaintingContext(null,bounds,true);
  const pictures=new FramePictureService(resources,{compile(capture,resource){beforeCompile?.(capture,resource);compiled.push(capture.frame.commands);return {bytes:0,retire(){retired.push(resource.id);}};}},{id:'batch-test',generation:1});
  return {root,context,compiled,retired,pictures,resources,close(){context.dispose();root.dispose();pictures.dispose();resources.dispose();assert.equal(retired.length,compiled.length);}};
}
function siblings(context,count=20){const paint=new Paint();for(let i=0;i<count;i++){context.save();context.translate(i*3,0);context.clipRect({x:0,y:0,width:30,height:30});context.drawRect({x:0,y:0,width:10,height:10},paint);context.restore();}}

test('replacement recording bodies keep retained descendant depths and annotation geometry',{timeout},()=>{
  for(const childLayer of [false,true]){
    const f=fixture(),contexts=[],type=new AnnotationType('replacement-depth'),value={};let target=f.root;
    for(let n=0;n<8;n++){const next=new ContainerLayer();target.append(next);target=next;}
    let redepths=0;
    class ObservedBranch extends ContainerLayer{redepthChild(child){redepths++;super.redepthChild(child);}}
    const branch=new ObservedBranch(),nested=new ObservedBranch(),region=new AnnotatedRegionLayer(value,{annotationType:type,size:{width:5,height:5}}),handles=[new LayerHandle(branch)],destination=new ContainerLayer();
    branch.append(nested);nested.append(region);f.root.attach({});if(childLayer)target.append(destination);
    const paint=color=>{
      const c=new PaintingContext(null,bounds,true);contexts.push(c);
      const record=context=>{context.rect({x:0,y:0,width:10,height:10},color);context.translate(20,30);context.addLayer(branch);};
      if(childLayer)c.pushLayer(destination,record);else record(c);
      c.compose(target,bounds,f.pictures);return c;
    };
    try{
      paint(0xff123456).dispose();const before=[branch.depth,nested.depth,region.depth];redepths=0;
      paint(0xff654321).dispose();assert.deepEqual([branch.depth,nested.depth,region.depth],before);assert.equal(redepths,0,'An unchanged destination needs no transient subtree depth rewrite');
      assert.equal(f.root.find(type,{x:21,y:31}),value);assert.equal(f.root.find(type,{x:1,y:1}),null);assert.equal(branch.owner,f.root.owner);assert.equal(f.compiled.at(-1).find(command=>command.op==='rect').color,0xff654321);
    }finally{for(const c of contexts)c.dispose();f.close();for(const h of handles)h.dispose();if(!destination.debugDisposed)destination.dispose();}
  }
});

test('direct batch capture preserves create callbacks, their falsey failures and the previous valid scene',{timeout},()=>{
  const f=fixture(),contexts=[],savedCreate=Picture.onCreate,savedDispose=Picture.onDispose,created=[],disposed=[];
  const paint=color=>{const c=new PaintingContext(null,bounds,true);contexts.push(c);c.rect({x:0,y:0,width:5,height:5},color);c.compose(f.root,bounds,f.pictures);return c;};
  try{
    Picture.onCreate=picture=>created.push(picture);Picture.onDispose=picture=>disposed.push(picture);
    paint(0xff123456).dispose();const previous=f.root.firstChild;assert.equal(created.length,1);
    Picture.onCreate=picture=>{created.push(picture);assert.equal(picture.debugDisposed,false);throw null;};
    assert.throws(()=>paint(0xff654321),error=>error===null);assert.equal(f.root.firstChild,previous);
    assert.equal(f.compiled.length,1);assert.equal(created.length,2);assert.equal(disposed.includes(created[1]),true);
    Picture.onCreate=picture=>created.push(picture);paint(0xff654321).dispose();
    assert.equal(created.length,3);assert.equal(f.compiled.length,2);assert.equal(f.compiled.at(-1).find(command=>command.op==='rect').color,0xff654321);
  }finally{Picture.onCreate=savedCreate;Picture.onDispose=savedDispose;for(const c of contexts)c.dispose();f.close();}
});
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
    assert.equal(region.attachedCount,0);assert.equal(region.detachedCount,0);assert.deepEqual(calls,[true]);assert.equal(f.compiled.length,compiled+1,'The first retained frame captures the complete hierarchy');assert.equal(second.commands.filter(command=>command.op==='drawPicture').length,1);assert.equal(f.root.find(type,{x:15,y:15}),value);
    const third=paint(10);assert.equal(f.compiled.length,compiled+1,'Later retained frames must not compile again');assert.deepEqual(third.commands,second.commands);third.dispose();
    const original=first.commands.find(command=>command.op==='drawPicture').resource;first.dispose();second.dispose();paint(40).dispose();assert.equal(f.root.find(type,{x:45,y:15}),value);assert.equal(f.root.find(type,{x:15,y:15}),null);assert(f.resources.has(original),'The earlier admitted frame still owns its picture');
    held.returnBy('renderer');held=undefined;assert(f.resources.has(original),'Moving the canvas scope still uses the same primitive picture');f.root.removeAllChildren();assert.equal(f.retired.length,f.compiled.length);
  }finally{if(held)held.returnBy('renderer');for(const c of contexts)c.dispose();f.close();handle.dispose();}
});

test('a failed composition retries the same content and never reuses a partially built assembly',{timeout},()=>{
  let fail=false;const f=fixture({beforeCompile(){if(fail)throw Error('compile interrupted');}}),contexts=[];
  const paint=color=>{const c=new PaintingContext(null,bounds,true);contexts.push(c);c.rect({x:0,y:0,width:10,height:10},color);c.compose(f.root,bounds,f.pictures);return c;};
  try{paint(0xff123456).dispose();fail=true;assert.throws(()=>paint(0xffabcdef),/compile interrupted/);fail=false;const current=paint(0xffabcdef);assert.equal(f.compiled.at(-1).find(command=>command.op==='rect').color,0xffabcdef);paint(0xffabcdef);const compiled=f.compiled.length;paint(0xffabcdef);assert.equal(f.compiled.length,compiled,'The completed retained hierarchy is reusable after retry');assert(current.commands.some(command=>command.op==='drawPicture'));}
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

test('unchanged painted and resource commands reuse an assembly while old frames retain independent pictures',{timeout},()=>{
  const f=fixture(),contexts=[],image={id:'retained-paint-image',generation:1,kind:'image'},paragraph={id:'retained-paint-text',generation:1,kind:'paragraph'};let released=0,held;
  for(const resource of [image,paragraph]){f.resources.register(resource,()=>released++);f.resources.bindResource(resource);}
  const paint=(color=0xff123456)=>{const c=new PaintingContext(null,bounds,true);contexts.push(c);c.drawRect({x:0,y:0,width:20,height:20},new Paint({color}));c.image(image,{x:1,y:2,width:4,height:5});c.paragraph(paragraph,7,8);c.compose(f.root,bounds,f.pictures);return c;};
  try{
    const first=paint(),body=f.root.firstChild;held=f.resources.acquire(first.commands.filter(command=>command.op==='drawPicture').map(command=>command.resource));held.transfer();first.dispose();
    const second=paint();assert.equal(f.root.firstChild,body);assert.equal(f.compiled.length,2);assert.equal(f.compiled[0].filter(command=>'resource'in command).length,2);paint().dispose();assert.equal(f.compiled.length,2,'The retained hierarchy compiles only once');
    second.dispose();paint(0xffabcdef).dispose();assert.notEqual(f.root.firstChild,body);assert.equal(f.compiled.length,3);assert.equal(f.compiled[0].find(command=>command.op==='drawRect').paint.color,0xff123456);assert.equal(f.retired.length,1,'Only the replaced aggregate retires while its original submitted picture stays held');
    for(const resource of [image,paragraph])f.resources.releaseProducer(resource);assert.equal(released,0);f.root.removeAllChildren();assert.equal(f.retired.length,f.compiled.length-1);assert.equal(released,0);held.returnBy('renderer');held=undefined;assert.equal(released,2);
  }finally{if(held)held.returnBy('renderer');for(const c of contexts)c.dispose();f.close();}
});

test('equal resource names from different registries and unbound names cannot reuse a composition',{timeout},()=>{
  const registries=[new ResourceRegistry(),new ResourceRegistry()],resources=registries.map(()=>({id:'same-paragraph-name',generation:1,kind:'paragraph'})),root=new ContainerLayer(),contexts=[];let released=0,registered=2;
  registries.forEach((registry,index)=>{registry.register(resources[index],()=>released++);registry.bindResource(resources[index]);});
  const paint=resource=>{const c=new PaintingContext(null,bounds,true);contexts.push(c);c.paragraph(resource,1,2);c.compose(root,bounds);c.dispose();return root.firstChild;};
  try{
    const original=paint(resources[0]);assert.equal(paint(resources[0]),original);const replacement=paint(resources[1]);assert.notEqual(replacement,original);assert.equal(paint(resources[1]),replacement);
    const unbound={id:'unbound-paragraph',generation:1};assert.notEqual(paint(unbound),paint(unbound));
    const firstGeneration={id:'same-paragraph-name',generation:2,kind:'paragraph'};registries[1].register(firstGeneration,()=>released++);registered++;registries[1].bindResource(firstGeneration);const next=paint(firstGeneration);assert.notEqual(next,replacement);assert.equal(paint(firstGeneration),next);
  }finally{for(const c of contexts)c.dispose();root.dispose();for(const registry of registries)registry.dispose();assert.equal(released,registered);}
});

test('paint effects, signed zero and externally inserted commands invalidate retained assembly',{timeout},()=>{
  const root=new ContainerLayer(),contexts=[];
  const paint=(invertColors,x=0,external=false)=>{const c=new PaintingContext(null,bounds,true);contexts.push(c);if(external)c.commands.push(Object.freeze({op:'rect',rect:Object.freeze({x:0,y:0,width:1,height:1}),color:0xff123456}));else c.drawRect({x,y:0,width:5,height:5},new Paint({invertColors}));c.compose(root,bounds);c.dispose();return root.firstChild;};
  try{const original=paint(false);assert.equal(paint(false),original);const changed=paint(true);assert.notEqual(changed,original);assert.equal(paint(true),changed);const signed=paint(true,-0);assert.notEqual(signed,changed);assert.equal(paint(true,-0),signed);assert.notEqual(paint(false,0,true),paint(false,0,true));}
  finally{for(const c of contexts)c.dispose();root.dispose();}
});

test('image shader ownership and nested gradient values participate in composition identity',{timeout},()=>{
  const root=new ContainerLayer(),contexts=[],shaders=[],registries=[new ResourceRegistry(),new ResourceRegistry()],images=registries.map(()=>({id:'same-shader-image',generation:1,kind:'image'}));let released=0;
  registries.forEach((registry,index)=>{registry.register(images[index],()=>released++);registry.bindResource(images[index]);});
  const paint=shader=>{shaders.push(shader);const c=new PaintingContext(null,bounds,true);contexts.push(c);c.drawRect({x:0,y:0,width:20,height:20},new Paint({shader}));c.compose(root,bounds);c.dispose();shader.dispose();return root.firstChild;};
  const image=index=>new ImageShader(images[index],'clamp','clamp',[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]);
  const gradient=end=>Gradient.linear({x:0,y:0},{x:end,y:10},[0xff123456,0xffabcdef]);
  try{const original=paint(image(0));assert.equal(paint(image(0)),original);const replacement=paint(image(1));assert.notEqual(replacement,original);assert.equal(paint(image(1)),replacement);const values=paint(gradient(10));assert.equal(paint(gradient(10)),values);assert.notEqual(paint(gradient(11)),values);}
  finally{for(const c of contexts)c.dispose();root.dispose();for(const shader of shaders)if(!shader.debugDisposed)shader.dispose();for(const registry of registries)registry.dispose();assert.equal(released,2);}
});

test('captured extension metadata stays outside composition reuse and is never traversed',{timeout},()=>{
  const root=new ContainerLayer(),contexts=[];
  const paint=()=>{const metadata={};metadata.self=metadata;Object.defineProperty(metadata,'value',{enumerable:true,get(){throw Error('Extension metadata must not be inspected');}});Object.freeze(metadata);const c=new PaintingContext(null,bounds,true);contexts.push(c);c.addCommands([{op:'rect',rect:{x:0,y:0,width:2,height:2},color:0xff123456,metadata}]);c.compose(root,bounds);c.dispose();return root.firstChild;};
  try{assert.notEqual(paint(),paint());}
  finally{for(const c of contexts)c.dispose();root.dispose();}
});

test('moving a retained insertion preserves unchanged primitive batches and the earlier admitted frame',{timeout},()=>{
  const f=fixture(),contexts=[],type=new AnnotationType('moving-compose-batches'),value={},region=new AnnotatedRegionLayer(value,{annotationType:type,size:{width:10,height:10}}),handle=new LayerHandle(region),callbacks=[];let held;
  region.addCompositionCallback(layer=>callbacks.push(layer.attached));f.root.attach({});
  const paint=(x,color=0xff123456)=>{const c=new PaintingContext(null,bounds,true);contexts.push(c);c.drawRect({x:0,y:0,width:5,height:5},new Paint({color}));c.save();c.translate(x,20);c.addLayer(region);c.restore();c.drawRect({x:10,y:0,width:5,height:5},new Paint());c.compose(f.root,bounds,f.pictures);return c;};
  try{
    const first=paint(10),body=f.root.firstChild;assert.equal(f.compiled.length,2);held=f.resources.acquire(first.commands.filter(command=>command.op==='drawPicture').map(command=>command.resource));held.transfer();first.dispose();callbacks.length=0;
    paint(40).dispose();assert.notEqual(f.root.firstChild,body);assert.equal(f.compiled.length,2,'Transform changes around an insertion must not recompile either static picture');assert.deepEqual([...callbacks],[false,true]);assert.equal(f.root.find(type,{x:45,y:25}),value);assert.equal(f.root.find(type,{x:15,y:25}),null);
    paint(60,0xffabcdef).dispose();assert.equal(f.compiled.length,3,'Only the changed primitive batch needs a new picture');assert.equal(f.compiled[0].find(command=>command.op==='drawRect').paint.color,0xff123456);assert.equal(f.retired.length,0);
    f.root.removeAllChildren();assert.equal(f.retired.length,1);held.returnBy('renderer');held=undefined;assert.equal(f.retired.length,3);
  }finally{if(held)held.returnBy('renderer');for(const c of contexts)c.dispose();f.close();handle.dispose();}
});

test('viewport changes retain identical primitive pictures with current bounds and independent admitted frames',{timeout},()=>{
  for(const childLayer of [false,true]){
    const f=fixture(),contexts=[],destination=new ContainerLayer(),type=new AnnotationType('resize-batches'),value={},region=new AnnotatedRegionLayer(value,{annotationType:type,size:{width:10,height:10}}),handles=[new LayerHandle(destination),new LayerHandle(region)];let held;
    const paint=(width,color=0xff123456)=>{
      const current={...bounds,width},c=new PaintingContext(null,current,true);contexts.push(c);
      const draw=context=>{context.rect({x:0,y:0,width:5,height:5},color);context.save();context.translate(width-20,20);context.addLayer(region);context.restore();context.rect({x:10,y:0,width:5,height:5},0xffabcdef);};
      if(childLayer)c.pushLayer(destination,draw,{x:0,y:0},current);else draw(c);
      c.compose(f.root,current,f.pictures);return c;
    };
    const layers=layer=>layer instanceof PictureLayer?[layer]:(layer.children??[]).flatMap(layers);
    try{
      const first=paint(300);held=f.resources.acquire(first.commands.filter(command=>command.op==='drawPicture').map(command=>command.resource));held.transfer();first.dispose();
      const original=layers(f.root).map(layer=>layer.picture),oldBounds=layers(f.root).map(layer=>layer.canvasBounds);assert.equal(f.compiled.length,2);
      for(const width of [420,240,300]){
        const current=paint(width);assert.equal(f.compiled.length,2,'A new viewport must not recompile identical primitive commands');
        assert.deepEqual(layers(f.root).map(layer=>layer.picture),original);assert(layers(f.root).every(layer=>layer.canvasBounds.width===width));
        assert.equal(f.root.find(type,{x:width-15,y:25}),value);assert.equal(f.root.find(type,{x:width+5,y:25}),null);current.dispose();
      }
      assert(oldBounds.every(rect=>rect.width===300),'Previously observed bounds must remain immutable');
      paint(420,0xff654321).dispose();assert.equal(f.compiled.length,3,'Changed drawing must still compile and submit a new picture');assert.equal(f.retired.length,0);
      f.root.removeAllChildren();for(const handle of handles)handle.dispose();assert.equal(f.retired.length,1,'The earlier admitted frame keeps its original pictures alive');
      held.returnBy('renderer');held=undefined;assert.equal(f.retired.length,3);
    }finally{if(held)held.returnBy('renderer');for(const c of contexts)c.dispose();f.close();for(const handle of handles)handle.dispose();}
  }
});

test('resizing a background recompiles its drawing while unchanged nested content retains independent native pictures',{timeout},()=>{
  const f=fixture(),contexts=[];let held,staticPicture;
  const paint=width=>{
    const current={...bounds,width},c=new PaintingContext(null,current,true);contexts.push(c);
    c.save();c.translate(10,20);c.rect({x:0,y:0,width,height:40},0xff123456);
    c.save();c.translate(5,7);c.rect({x:0,y:0,width:5,height:6},0xffabcdef);c.restore();c.restore();
    c.compose(f.root,current,f.pictures);return c;
  };
  try{
    const first=paint(300);held=f.resources.acquire(first.commands.filter(command=>command.op==='drawPicture').map(command=>command.resource));held.transfer();first.dispose();
    paint(320).dispose();assert.equal(f.compiled.length,3,'The first change separates the background and static nested scope');
    const layers=()=>f.root.firstChild.children.filter(layer=>layer instanceof PictureLayer);
    staticPicture=layers().at(-1).picture;
    for(const width of [340,280,300]){
      const before=f.compiled.length;paint(width).dispose();assert.equal(f.compiled.length,before+1);
      assert.deepEqual(f.compiled.at(-1).map(command=>command.op),['rect'],'Only the changed background is compiled');
      assert.equal(f.compiled.at(-1)[0].rect.width,width);assert.equal(layers().at(-1).picture,staticPicture);
      assert(layers().every(layer=>layer.canvasBounds.width===width));
    }
    paint(300).dispose();const before=f.compiled.length;paint(300).dispose();assert.equal(f.compiled.length,before,'A stationary frame keeps its completed retained hierarchy');
    f.root.removeAllChildren();assert.equal(staticPicture.debugDisposed,true);assert.equal(f.retired.length,f.compiled.length-1);
    held.returnBy('renderer');held=undefined;assert.equal(f.retired.length,f.compiled.length);
  }finally{if(held)held.returnBy('renderer');for(const c of contexts)c.dispose();f.close();}
});

test('an adaptive static scope observes changed resource generations while an earlier submitted frame retains its original input',{timeout},()=>{
  const f=fixture(),contexts=[],retired=[],images=[1,2].map(generation=>({id:'adaptive-image',generation,kind:'image'}));let held;
  for(const image of images){f.resources.register(image,()=>retired.push(image.generation));f.resources.bindResource(image);}
  const paint=(width,image)=>{const c=new PaintingContext(null,bounds,true);contexts.push(c);c.save();c.rect({x:0,y:0,width,height:40},0xff123456);c.save();c.translate(3,4);c.image(image,{x:0,y:0,width:8,height:9});c.restore();c.restore();c.compose(f.root,bounds,f.pictures);return c;};
  try{
    const first=paint(30,images[0]);held=f.resources.acquire(first.commands.filter(command=>command.op==='drawPicture').map(command=>command.resource));held.transfer();first.dispose();
    paint(40,images[0]).dispose();const before=f.compiled.length;paint(50,images[0]).dispose();assert.equal(f.compiled.length,before+1);
    const changed=f.compiled.length;paint(60,images[1]).dispose();assert.equal(f.compiled.length,changed+2,'The static scope must recompile its new resource generation');assert.equal(f.compiled.at(-1).find(command=>command.op==='image').resource.generation,2);
    for(const image of images)f.resources.releaseProducer(image);assert.deepEqual(retired,[]);f.root.removeAllChildren();assert.deepEqual(retired,[2]);
    held.returnBy('renderer');held=undefined;assert.deepEqual(retired,[2,1]);
  }finally{if(held)held.returnBy('renderer');for(const c of contexts)c.dispose();f.close();}
});

test('a recording failure after batch reuse retires partial frame holds and retries without a cached partial assembly',{timeout},()=>{
  let fail=false;const f=fixture({beforeCompile(){if(fail)throw Error('partial batch recording failed');}}),contexts=[],region=new AnnotatedRegionLayer({},{annotationType:new AnnotationType('failed-reuse'),size:{width:5,height:5}}),handle=new LayerHandle(region);let held;
  const paint=(x,color)=>{const c=new PaintingContext(null,bounds,true);contexts.push(c);c.rect({x:0,y:0,width:5,height:5},0xff123456);c.save();c.translate(x,10);c.addLayer(region);c.restore();c.rect({x:10,y:0,width:5,height:5},color);c.compose(f.root,bounds,f.pictures);return c;};
  try{
    const first=paint(10,0xffabcdef);held=f.resources.acquire(first.commands.filter(command=>command.op==='drawPicture').map(command=>command.resource));held.transfer();first.dispose();
    fail=true;assert.throws(()=>paint(40,0xff654321),/partial batch recording failed/);assert.equal(contexts.at(-1).commands.length,0,'Failed scene streaming must roll back independent destination holds');assert.equal(f.retired.length,0,'The earlier submitted frame must survive the failed replacement');
    fail=false;paint(40,0xff654321).dispose();assert.equal(f.compiled.length,4,'A failed composition must not reuse its partially assembled cache');assert.equal(f.compiled[1].find(command=>command.op==='rect').color,0xffabcdef);assert.equal(f.compiled.at(-1).find(command=>command.op==='rect').color,0xff654321);
    held.returnBy('renderer');held=undefined;assert.equal(f.retired.length,2);
  }finally{if(held)held.returnBy('renderer');for(const c of contexts)c.dispose();f.close();handle.dispose();}
});
