// SPDX-License-Identifier: BSD-3-Clause
// Actual sample widgets in Node/CanvasKit. CPU attribution, not native FPS or
// physical trackpad/display acceptance. Prints results without saving profiles.
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {registerHooks} from 'node:module';
import {Session} from 'node:inspector';
import {fileURLToPath} from 'node:url';
import ts from 'typescript';
import {engineFixture} from '../../packages/material/tests/engine-fixture.mjs';
import {FoundationPlatform} from '@nelyx/core/foundation/platform';
import {copyResourceId} from '@nelyx/core/ui/resource-retention';
import {PipelineOwner,RenderObject} from '@nelyx/core/framework/rendering/object';
import {BuildOwner} from '@nelyx/core/framework/widgets/framework';
import {PaintingContext} from '@nelyx/core/framework/painting/context';
import {WindowsInteraction} from '../sdk/dist/platforms/windows/interaction.js';
import {DefaultAssetBundle} from '@nelyx/core/framework/widgets/default-asset-bundle';
import {AssetBundle} from '@nelyx/core/services/asset-bundle';
import {ImageService} from '@nelyx/core/hosting/images';
import {ListView} from '@nelyx/core/framework/widgets/scroll-view';
import {EditableText} from '@nelyx/core/framework/widgets/editable-text';
import {RenderEditable} from '@nelyx/core/framework/rendering/editable';
import {MouseTracker} from '@nelyx/core/framework/rendering/mouse-tracker';
import {TextField} from '@nelyx/material/text-field';
import {InputDecorator} from '@nelyx/material/input-decorator';
import {RenderInputDecoration} from '../../packages/material/dist/internal/input/input-decorator-layout.js';

const profiling=process.argv.includes('--profile'),entries=process.argv.includes('--entries'),hover=process.argv.includes('--hover'),policy=process.argv.find(value=>value.startsWith('--children='))?.slice(11)??'product',viewport=process.argv.find(value=>value.startsWith('--viewport='))?.slice(11)??'compact';
if(!['product','legacy','dormant','bounded'].includes(policy)||!['compact','wide'].includes(viewport)||process.argv.slice(2).some(value=>value!=='--profile'&&value!=='--entries'&&value!=='--hover'&&!value.startsWith('--children=')&&!value.startsWith('--viewport=')))throw Error('Choose --profile, --entries, --hover, --viewport=compact|wide and/or --children=product|legacy|dormant|bounded');

const sourceRoot=new URL('../../sample/nelyx-testbed-app-2/src/',import.meta.url).href;
const hook=registerHooks({load(url,context,next){
  if(!url.startsWith(sourceRoot)||!url.endsWith('.ts'))return next(url,context);
  return {format:'module',shortCircuit:true,source:ts.transpileModule(fs.readFileSync(fileURLToPath(url),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText};
}});
const {ComponentsGallery}=await import('../../sample/nelyx-testbed-app-2/src/gallery.ts');
const {ListViewPage}=await import('../../sample/nelyx-testbed-app-2/src/list-view.ts');
const inspector=new Session();inspector.connect();
const post=(method,args={})=>new Promise((resolve,reject)=>inspector.post(method,args,(error,result)=>error?reject(error):resolve(result)));
const deadline=setTimeout(()=>{console.error('Gallery diagnosis exceeded 20 minutes');process.exit(1);},1_200_000);
let fixture,interaction,images,sampling=false,active=null,textEntries=[],semanticInvalidations={},layoutInvalidations={};
const restores=[];
if(policy!=='product'){
  const builder=ListView.builder;ListView.builder=function(options){return builder.call(this,options.extentIndex?{...options,childPolicy:policy==='legacy'?'legacy':policy==='dormant'?{mode:'dormant',capacity:4}:{mode:'bounded',preparation:'disabled'}}:options);};restores.push(()=>{ListView.builder=builder;});
}
const summarize=values=>{const sorted=[...values].sort((a,b)=>a-b);return {n:sorted.length,sum:sorted.reduce((a,b)=>a+b,0),p50:sorted[Math.ceil(sorted.length*.5)-1]??0,p95:sorted[Math.ceil(sorted.length*.95)-1]??0,max:sorted.at(-1)??0};};
function measure(target,method,label){const original=target[method];target[method]=function(...args){const start=performance.now();try{return original.apply(this,args);}finally{if(active)(active[label]??=[]).push(performance.now()-start);}};restores.push(()=>{target[method]=original;});}
function stateFor(f,Type){const pending=[f.root.root];while(pending.length){const element=pending.pop();if(element.widget instanceof Type)return element.stateObject;pending.push(...element.children);}throw Error('Missing actual sample state '+Type.name);}
try{
  FoundationPlatform.configure({kind:'native',operatingSystem:'windows'});
  const f=fixture=await engineFixture(),context=f.root.context;
  Object.assign(context.readMetrics(),viewport==='wide'?{logicalWidth:1280,logicalHeight:730,physicalWidth:2560,physicalHeight:1460,scale:2}:{logicalWidth:487,logicalHeight:464.5,physicalWidth:974,physicalHeight:929,scale:2});
  f.root.options.semanticsUpdateInterval=300;
  interaction=new WindowsInteraction(context.owner);context.editing=interaction.editing;context.semantics=interaction.semantics;
  const app=fileURLToPath(new URL('../../sample/nelyx-testbed-app-2/',import.meta.url));
  images=new ImageService(context.resources,{
    instantiateCodec:(bytes,options)=>f.library.instantiateImageCodec(bytes,options),
    async loadAsset(key){if(key==='component-image')return fs.readFileSync(path.join(app,'assets/component-image.webp'));throw Error('Unexpected image: '+key);},
    async loadNetwork(){throw Error('Gallery diagnosis does not use network images');},
  },{request(callback){const pending=setImmediate(callback);return {dispose(){clearImmediate(pending);}};}},{now:context.clock.now,scheduleTimer(callback,ms){const timer=setTimeout(callback,ms);return {dispose(){clearTimeout(timer);}};}});
  context.images=images;
  for(const asset of JSON.parse(fs.readFileSync(path.join(app,'package.json'),'utf8')).nelyx.assets.filter(asset=>asset.kind==='font')){
    const bytes=fs.readFileSync(path.join(app,asset.path)),font=f.library.decode({...asset,sha256:createHash('sha256').update(bytes).digest('hex')},bytes);
    context.resources.register(font.descriptor,font.retire);const resource=copyResourceId(font.descriptor);context.assets.set(asset.id,resource);if(asset.id==='sample-font')context.defaultFont=resource;
  }
  measure(PipelineOwner.prototype,'flushLayout','layout');measure(PipelineOwner.prototype,'flushSemantics','semantics');measure(BuildOwner.prototype,'flushBuild','build');measure(PaintingContext.prototype,'compose','compose');
  measure(f.root,'recordPaint','paint');measure(f.root.sourceSemanticsSnapshot,'capture','transport');measure(RenderObject.prototype,'commitTextInputGeometries','inputGeometry');
  measure(f.library,'layout','textLayout');
  if(entries){const layout=f.library.layout;f.library.layout=function(input,request){const start=performance.now();try{return layout.call(this,input,request);}finally{if(active)textEntries.push({text:input.text.slice(0,60),width:Number.isFinite(input.width)?input.width:'Infinity',fontSize:input.fontSize,transient:request?.transient===true,ms:performance.now()-start});}};restores.push(()=>{f.library.layout=layout;});}
  class DeclaredAssets extends AssetBundle{async load(key){throw Error('Gallery probe requested undeclared bytes: '+key);}}
  f.set(new DefaultAssetBundle(new DeclaredAssets(),new ComponentsGallery()));
  const gallery=stateFor(f,ComponentsGallery);
  if(profiling){await post('Profiler.enable');await post('Profiler.setSamplingInterval',{interval:500});}
  async function phase(name,scroll,offsets){
    const frames=[],counts=[],details=[];active={};semanticInvalidations={};layoutInvalidations={};if(profiling){await post('Profiler.start');sampling=true;}
    for(const offset of offsets){
      const before=entries?Object.fromEntries(Object.entries(active).map(([key,value])=>[key,value.length])):null;
      textEntries=[];scroll.jumpTo(offset);f.elapse(17);const start=performance.now(),commands=f.frame(),cpu=performance.now()-start;frames.push(cpu);counts.push(commands.length);
      if(entries)details.push({offset:scroll.offset,cpu,commands:commands.length,stages:Object.fromEntries(Object.entries(active).map(([key,value])=>[key,value.slice(before[key]??0).reduce((a,b)=>a+b,0)])),textEntries});
    }
    const stages=Object.fromEntries(Object.entries(active).map(([key,value])=>[key,summarize(value)]));active=null;
    const {profile}=profiling?await post('Profiler.stop'):{};sampling=false;
    let hottest;
    if(profile){
    const nodes=new Map(profile.nodes.map(node=>[node.id,node])),totals=new Map();
    for(let i=0;i<profile.samples.length;i++){const node=nodes.get(profile.samples[i]),frame=node.callFrame;if(frame.url==='node:inspector')continue;const key=JSON.stringify({function:frame.functionName,file:frame.url.replace('file:///',''),line:frame.lineNumber+1});totals.set(key,(totals.get(key)??0)+(profile.timeDeltas[i]??0)/1000);}
    hottest=[...totals].sort((a,b)=>b[1]-a[1]).slice(0,8).map(([key,ms])=>({...JSON.parse(key),ms}));
    }
    console.log(JSON.stringify({name,policy,viewport,scope:'Node/CanvasKit CPU attribution; not native FPS or physical input/display acceptance',frames:summarize(frames),commands:summarize(counts),stages,...(hover?{semanticInvalidations,layoutInvalidations}:{}),...(hottest?{hottest}:{}),...(entries?{longestFrames:details.sort((a,b)=>b.cpu-a.cpu).slice(0,4)}:{})}));
  }
  await phase('gallery-cold',gallery.firstScroll,Array.from({length:24},(_,i)=>(i+1)*140));
  await phase('gallery-revisit',gallery.firstScroll,Array.from({length:24},(_,i)=>(23-i)*140));
  await phase('gallery-retained',gallery.firstScroll,Array.from({length:24},(_,i)=>60+(i%12)*2));
  gallery.select('text');f.frame();
  await phase('gallery-text',gallery.firstScroll,Array.from({length:24},(_,i)=>60+(i%12)*2));
  if(hover){
    for(const [method,counts]of [['markNeedsSemanticsUpdate',()=>semanticInvalidations],['markNeedsLayout',()=>layoutInvalidations]]){const original=RenderObject.prototype[method];RenderObject.prototype[method]=function(...args){if(active){const name=this.constructor.name,record=counts()[name]??={n:0,...(entries?{stack:new Error().stack.split('\n').slice(2,5)}:{})};record.n++;}return original.apply(this,args);};restores.push(()=>{RenderObject.prototype[method]=original;});}
    measure(MouseTracker.prototype,'updateAllDevices','mouseTracker');measure(RenderInputDecoration.prototype,'performLayout','decorationLayout');measure(RenderEditable.prototype,'performLayout','editableLayout');
    measure(Object.getPrototypeOf(stateFor(f,TextField)),'build','fieldBuild');measure(Object.getPrototypeOf(stateFor(f,InputDecorator)),'build','decorationBuild');measure(Object.getPrototypeOf(stateFor(f,EditableText)),'build','editableBuild');
    const offsets=Array.from({length:24},(_,i)=>(i<12?i:23-i)*16);
    gallery.firstScroll.jumpTo(0);f.elapse(200);f.frame();
    await phase('gallery-text-no-hover',gallery.firstScroll,offsets);
    gallery.firstScroll.jumpTo(0);f.elapse(200);f.frame();
    const field=f.root.nodes.find(node=>node.id==='field-filled');if(!field)throw Error('Expected the visible Material field');
    const point={pointer:1,device:'mouse',buttons:0,x:field.bounds.x+Math.min(20,field.bounds.width/2),y:field.bounds.y+field.bounds.height/2,viewportGeneration:context.readMetrics().viewportGeneration};
    f.root.pointer({...point,kind:'hover',timestamp:context.clock.now()});f.frame();f.elapse(200);f.frame();
    await phase('gallery-text-hover',gallery.firstScroll,offsets);
    f.root.pointer({...point,kind:'leave',timestamp:context.clock.now()});f.frame();f.elapse(200);f.frame();
  }
  gallery.select('all');f.frame();
  f.tap('show-list-view');const list=stateFor(f,ListViewPage);
  await phase('list-cold',list.scroll,Array.from({length:24},(_,i)=>(i+1)*70));
  await phase('list-revisit',list.scroll,Array.from({length:24},(_,i)=>(23-i)*70));
}finally{
  active=null;try{if(sampling)await post('Profiler.stop');}finally{inspector.disconnect();clearTimeout(deadline);for(const restore of restores.reverse())restore();try{fixture?.root.dispose();await images?.dispose();await fixture?.close();}finally{interaction?.dispose();hook.deregister();}}
}
