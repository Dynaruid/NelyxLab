// SPDX-License-Identifier: BSD-3-Clause
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {registerHooks} from 'node:module';
import {fileURLToPath} from 'node:url';
import test from 'node:test';
import ts from 'typescript';
import {FoundationPlatform} from '@nelyx/core/foundation/platform';
import {Text} from '@nelyx/core/framework/widgets/basic';
import {ListView} from '@nelyx/core/framework/widgets/scroll-view';
import {ImageService} from '@nelyx/core/hosting/images';
import {RawImage} from '@nelyx/core/framework/widgets/raw-image';
import {StandardMessageCodec} from '@nelyx/core/services/message-codecs';
import {TextField} from '@nelyx/material/text-field';
import {MaterialApp} from '@nelyx/material/app';
import {ListTile} from '@nelyx/material/list-tile';
import {EditableText} from '@nelyx/core/framework/widgets/editable-text';
import {Form} from '@nelyx/core/framework/widgets/form';
import {CupertinoTextField} from '@nelyx/cupertino/text-field';
import {CupertinoFormRow} from '@nelyx/cupertino/form-row';
import {CupertinoFormSection} from '@nelyx/cupertino/form-section';
import {EditingSession} from '@nelyx/core/ui/editing';
import {engineFixture} from '../../../packages/material/tests/engine-fixture.mjs';

const sources = new URL('../src/', import.meta.url).href;
registerHooks({load(url, context, nextLoad) {
  if (!url.startsWith(sources) || !url.endsWith('.ts')) return nextLoad(url, context);
  return {format: 'module', shortCircuit: true, source: ts.transpileModule(fs.readFileSync(fileURLToPath(url), 'utf8'), {
    compilerOptions: {target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext},
  }).outputText};
}});
const {ComponentsGallery} = await import('../src/gallery.ts');
const {ListViewPage} = await import('../src/list-view.ts');
const {demos} = await import('../src/catalog.ts');
const {cupertinoDemos} = await import('../src/cupertino-catalog.ts');
FoundationPlatform.configure({kind: 'native', operatingSystem: 'windows'});
const timeout = 1_200_000;

test('the shared app entry forwards the accessibility build override and retains its enabled default',{timeout},async()=>{
  const {main}=await import('../src/index.ts');
  assert.equal(main().definition.accessibilityEnabled,true);
  assert.equal(main(undefined,{accessibilityEnabled:false}).definition.accessibilityEnabled,false);
  assert.equal(main(undefined,{accessibilityEnabled:true}).definition.accessibilityEnabled,true);
});

test('window resizing retains scroll positions and gallery pages until responsive structure or theme changes',{timeout},async()=>{
 const f=await gallery(),metrics=f.root.context.readMetrics();
 const stateFor=predicate=>{let state;const visit=element=>{if(predicate(element.widget))state=element.stateObject;element.visitChildren(visit);};visit(f.root.root);assert(state);return state;};
 const resize=(width,height=800)=>{Object.assign(metrics,{logicalWidth:width,logicalHeight:height,physicalWidth:Math.round(width*metrics.scale),physicalHeight:Math.round(height*metrics.scale),viewportGeneration:metrics.viewportGeneration+1});f.frame();};
 const observePage=state=>{let builds=0;const page=state.page;state.page=function(...args){builds++;return page.apply(this,args);};return ()=>builds;};
 try{
  f.tap('show-list-view');const list=stateFor(widget=>widget instanceof ListViewPage),position=list.scroll.position;
  for(const width of [1000,1020,1040]){resize(width);assert(list.scroll.position===position,'A size-only change must keep the live ScrollPosition');}
  f.tap('list-view-back');const material=stateFor(widget=>widget instanceof ComponentsGallery),materialBuilds=observePage(material),materialPosition=material.firstScroll.position;
  for(const width of [1030,1020,1000]){resize(width);assert(material.firstScroll.position===materialPosition,'Material scroll position changed on resize');assert.equal(materialBuilds(),0);}
  resize(580);assert(materialBuilds()>0,'Crossing the compact breakpoint must rebuild the page');const beforeTheme=materialBuilds();f.tap('toggle-theme');assert(materialBuilds()>beforeTheme);
  f.tap('show-cupertino');const cupertino=stateFor(widget=>widget.constructor.name==='CupertinoGalleryPage'),cupertinoBuilds=observePage(cupertino),cupertinoPosition=cupertino.scroll.position;
  for(const width of [570,560,550]){resize(width);assert(cupertino.scroll.position===cupertinoPosition,'Cupertino scroll position changed on resize');assert.equal(cupertinoBuilds(),0);}
  const beforeCupertinoTheme=cupertinoBuilds();f.tap('cupertino-toggle-theme');assert(cupertinoBuilds()>beforeCupertinoTheme);
 }finally{f.close();}
});

test('control and status changes rebuild their owning section while the gallery page stays retained',{timeout},async()=>{
  const f=await gallery();
  const stateFor=predicate=>{let state;const visit=element=>{if(predicate(element.widget))state=element.stateObject;element.visitChildren(visit);};visit(f.root.root);assert(state);return state;};
  const observe=state=>{let pages=0;const sections=[];const page=state.page,section=state.group??state.section;state.page=function(...args){pages++;return page.apply(this,args);};const name=state.group?'group':'section';state[name]=function(context,demo,...args){sections.push(demo.id);return section.call(this,context,demo,...args);};return {sections,get pages(){return pages;},reset(){pages=0;sections.length=0;}};};
  try{
    const material=observe(stateFor(widget=>widget instanceof ComponentsGallery));f.tap('demo-filled');assert(texts(f).some(text=>text.includes('Filled pressed')));assert.equal(material.pages,0);assert.deepEqual(material.sections,[]);
    f.tap('category-selection');material.reset();f.tap('check-value');assert(texts(f).includes('Unchecked'));assert.equal(material.pages,0);assert(material.sections.length>0);assert(material.sections.every(id=>id==='checkboxes'));
    f.tap('category-text');material.reset();f.nativeEdit('field-outlined','local edit');assert.equal(material.pages,0);assert(material.sections.every(id=>id==='text-fields'));
    f.tap('show-cupertino');const cupertino=observe(stateFor(widget=>widget.constructor.name==='CupertinoGalleryPage'));f.tap('cupertino-filled');assert(texts(f).includes('Cupertino filled pressed'));assert.equal(cupertino.pages,0);assert.deepEqual(cupertino.sections,[]);
    f.tap('cupertino-category-selection');cupertino.reset();f.tap('cupertino-checkbox');assert.equal(cupertino.pages,0);assert(cupertino.sections.length>0);assert(cupertino.sections.every(id=>id==='checkboxes'));
  }finally{await f.close();}
});

test('narrow gallery secure-input hit remains aligned after keyboard-height restoration',{timeout},async()=>{
  const f=await gallery(),metrics=f.root.context.readMetrics();
  const resize=height=>{Object.assign(metrics,{logicalWidth:1080/2.75,physicalWidth:1080,logicalHeight:height,physicalHeight:Math.round(height*2.75),scale:2.75,viewportGeneration:metrics.viewportGeneration+1});f.frame();};
  const field=()=>{const node=f.root.nodes.find(node=>node.id==='field-filled');assert(node);return node;};
  try{
    resize(2138/2.75);f.tap('category-text');f.root.nodes.find(node=>node.id==='field-filled').actions.focus();await Promise.resolve();f.frame();
    resize(400);f.nativeEdit('field-filled','안녕하세요, Nelyx!XY');resize(2138/2.75);f.reveal('toggle-secure-input');
    const node=f.root.nodes.find(node=>node.id==='toggle-secure-input');assert(node);assert.equal(field().obscured,false);
    for(const kind of ['down','up']){f.root.pointer({kind,x:node.bounds.x+node.bounds.width/2,y:node.bounds.y+node.bounds.height/2,pointer:88,device:'touch',buttons:kind==='up'?0:1,timestamp:f.root.context.clock.now(),viewportGeneration:metrics.viewportGeneration});f.frame();}
    assert.equal(field().obscured,true,'Published secure-input bounds must hit the real Core control: '+JSON.stringify(node.bounds));
  }finally{await f.close();}
});
test('wide gallery text-field traversal stays in the content column across sidebar rows',{timeout},async()=>{
  const f=await gallery(),metrics=f.root.context.readMetrics();
  try{
    Object.assign(metrics,{logicalWidth:1280,physicalWidth:1280,logicalHeight:730,physicalHeight:730,viewportGeneration:metrics.viewportGeneration+1});f.frame();f.tap('category-text');
    const first=f.root.nodes.find(node=>node.id==='field-filled');assert(first?.actions?.focus);first.actions.focus();await Promise.resolve();f.frame();
    assert(f.root.nodes.find(node=>node.id==='field-filled')?.focused);
    assert(f.root.buildOwner.focus.next());await Promise.resolve();f.frame();
    assert(f.root.nodes.find(node=>node.id==='field-outlined')?.focused,'Tab must reach the following text field before returning to sidebar navigation: '+f.root.nodes.filter(node=>node.focused).map(node=>node.id));
    assert(f.root.buildOwner.focus.next(true));await Promise.resolve();f.frame();assert(f.root.nodes.find(node=>node.id==='field-filled')?.focused,'Reverse traversal returns to the first editor');
  }finally{await f.close();}
});
function galleryControllers(fixture) {
  const controllers = new Set();
  const visit = element => {
    if (element.widget instanceof ListView && element.widget.controller?.debugLabel?.includes('gallery')) controllers.add(element.widget.controller);
    element.visitChildren(visit);
  };
  visit(fixture.root.root);
  return [...controllers].filter(controller => controller.hasClients);
}
function sweep(fixture, inspect) {
  for (const controller of galleryControllers(fixture)) {
    controller.jumpTo(0); fixture.frame();
    for (let step = 0; step < 30; step++) {
      inspect();
      const position = controller.position;
      if (position.pixels >= position.maxScrollExtent) break;
      controller.jumpTo(Math.min(position.maxScrollExtent, position.pixels + position.viewportDimension * .75)); fixture.frame();
      assert(step < 29, 'The selected gallery workload must finish its continuous traversal within 30 steps');
    }
  }
}
async function gallery({withImages = false, onParagraphLayout} = {}) {
  const fixture = await engineFixture({fonts: true});
  if (onParagraphLayout) {
    const layout = fixture.library.layout.bind(fixture.library);
    fixture.library.layout = (...args) => {const result = layout(...args); onParagraphLayout(fixture.library.debugTextStats); return result;};
  }
  const tap = fixture.tap;
  fixture.reveal = id => {
    const visible = () => fixture.root.nodes.some(node => node.id === id && node.bounds.width > 0 && node.bounds.height > 0 && node.bounds.y + node.bounds.height / 2 >= 0 && node.bounds.y + node.bounds.height / 2 < fixture.root.context.readMetrics().logicalHeight);
    if (visible()) return;
    for (const controller of galleryControllers(fixture)) {
      controller.jumpTo(0); fixture.frame();
      for (let step = 0; step < 30; step++) {
        if (visible()) return;
        const position = controller.position;
        if (position.pixels >= position.maxScrollExtent) break;
        controller.jumpTo(Math.min(position.maxScrollExtent, position.pixels + position.viewportDimension * .5)); fixture.frame();
      }
    }
    assert(visible(), 'Expected control in the continuous gallery: ' + id);
  };
  fixture.tap = id => {try {fixture.reveal(id); tap(id); fixture.frame();} catch (cause) {throw new Error('Gallery action failed: ' + id, {cause});}};
  const context = fixture.root.context, metrics = context.readMetrics();
  // Host IO fixture; validation/revisions and all widget/controller logic stay
  // in the actual Core implementations. This does not simulate an OS editor.
  const bindings = new Set(), editorActions = new Map();
  context.editing = {
    capabilities: {indexUnit: 'utf16', composing: 'unavailable', selectionDirection: 'unavailable'},
    bind(owner, initial, changed, options) {
      assert(!bindings.has(options.id), 'Only one editor may own each host binding');
      bindings.add(options.id);
      const session = new EditingSession(owner, initial);
      editorActions.set(options.id, {session, changed, options});
      return {
        get isComposing() {return session.value.composing.status==='active';},
        read: () => session.value,
        replace(value) {assert(session.update({...value, revision: session.value.revision + 1})); changed(session.value);},
        focus() {options.focusChanged?.(true);},
        blur() {options.focusChanged?.(false);},
        dispose() {session.dispose(); bindings.delete(options.id);editorActions.delete(options.id);},
      };
    },
    dispose() {assert.equal(bindings.size, 0);},
  };
  fixture.nativeEdit = (id, text) => {
    const editor=editorActions.get(id);assert(editor,'Expected mounted editor '+id);
    assert(editor.session.update({...editor.session.value,text,selection:{anchor:text.length,focus:text.length},revision:editor.session.value.revision+1,source:'native'}));editor.changed(editor.session.value);fixture.frame();
  };
  fixture.submitEditor = id => {const editor=editorActions.get(id);assert(editor);editor.options.onAction?.(editor.session.value);};
  Object.assign(metrics, {logicalWidth: 1440, logicalHeight: 1200, physicalWidth: 1440, physicalHeight: 1200});
  const bytes = fs.readFileSync(new URL('../assets/NotoSansKR.ttf', import.meta.url));
  const font = fixture.library.decode({id: 'gallery-font', kind: 'font', fontFamily: 'NelyxSample', sha256: createHash('sha256').update(bytes).digest('hex')}, bytes);
  context.resources.register(font.descriptor, font.retire);
  context.assets.set('gallery-font', font.descriptor);
  context.defaultFont = font.descriptor;
  const iconBytes = fs.readFileSync(new URL('../assets/CupertinoIcons.ttf', import.meta.resolve('@nelyx/cupertino/icon-assets')));
  const icons = fixture.library.decode({id: 'cupertino-icons', kind: 'font', fontFamily: 'packages/cupertino_icons/CupertinoIcons', sha256: createHash('sha256').update(iconBytes).digest('hex')}, iconBytes);
  context.resources.register(icons.descriptor, icons.retire);
  context.assets.set('cupertino-icons', icons.descriptor);
  const assetCatalog = new StandardMessageCodec().encodeMessage(new Map([
    ['component-image', [new Map([['asset', './assets/component-image.webp'], ['dpr', 1]])]],
  ]));
  const images = new ImageService(context.resources, {
    ...(withImages ? {assetManifestBytes: new Uint8Array(assetCatalog.buffer, assetCatalog.byteOffset, assetCatalog.byteLength)} : {}),
    instantiateCodec: (bytes, options) => fixture.library.instantiateImageCodec(bytes, options),
    async loadAsset(key) {
      if (withImages && (key === 'component-image' || key === './assets/component-image.webp')) return fs.readFileSync(new URL('../assets/component-image.webp', import.meta.url));
      throw new Error('Unexpected image asset request: ' + key);
    },
    async loadNetwork() {throw new Error('This Core interaction test does not use the network');},
  }, {request(callback) {const immediate = setImmediate(callback); return {dispose() {clearImmediate(immediate);}};}}, {
    now: context.clock.now,
    scheduleTimer(callback, milliseconds) {const timer = setTimeout(callback, milliseconds); return {dispose() {clearTimeout(timer);}};},
  });
  context.images = images;
  const close = fixture.close;
  fixture.close = async () => {fixture.root.dispose(); await images.dispose(); await close(); context.editing.dispose();};
  try {fixture.set(new ComponentsGallery());} catch (error) {await fixture.close(); throw error;}
  return fixture;
}
function texts(fixture) {
  const result = [];
  const visit = element => {if (element.widget instanceof Text) result.push(element.widget.text); element.visitChildren(visit);};
  visit(fixture.root.root);
  return result;
}
test('ListView route lazily reaches both ends, retains selection through scrolling and resize, and retires on return', {timeout}, async () => {
  const f = await gallery();
  const settle = async () => {f.advance(501); await Promise.resolve(); await Promise.resolve(); f.frame();};
  const rows = () => {
    const result = [];
    const visit = element => {if (element.widget instanceof ListTile && element.widget.id?.startsWith('list-view-item-')) result.push(element.widget); element.visitChildren(visit);};
    visit(f.root.root);
    assert(result.length > 0 && result.length < 40, 'Only viewport/cache rows should be mounted for the 1,000-item list');
    return result;
  };
  const controller = () => {
    let found;
    const visit = element => {if (element.widget instanceof ListView && element.widget.controller?.debugLabel === 'list-view-page') found = element.widget.controller; element.visitChildren(visit);};
    visit(f.root.root); assert(found?.hasClients); return found;
  };
  try {
    f.tap('category-selection');
    f.tap('check-value');
    f.tap('toggle-theme');
    f.tap('show-list-view'); await settle();
    rows(); assert(texts(f).includes('항목 0001')); assert(!texts(f).includes('항목 1000'));
    f.tap('list-view-item-0'); assert(texts(f).includes('선택: 항목 0001'));
    assert(rows().find(row => row.id === 'list-view-item-0')?.selected);
    f.tap('list-view-last'); rows(); assert(texts(f).includes('항목 1000'));
    assert.equal(controller().offset, controller().position.maxScrollExtent);
    f.tap('list-view-item-999'); assert(texts(f).includes('선택: 항목 1000'));
    f.tap('list-view-first'); rows(); assert(texts(f).includes('선택: 항목 1000'));
    assert.equal(controller().offset, 0);
    const metrics = f.root.context.readMetrics();
    Object.assign(metrics, {logicalWidth: 390, physicalWidth: 390, logicalHeight: 480, physicalHeight: 480, viewportGeneration: metrics.viewportGeneration + 1}); f.frame();
    assert(texts(f).includes('선택: 항목 1000'));
    f.tap('list-view-last'); rows(); assert(rows().find(row => row.id === 'list-view-item-999')?.selected);
    f.tap('list-view-clear'); assert(texts(f).includes('항목을 선택하세요.'));
    assert(rows().every(row => !row.selected));
    f.tap('list-view-item-999');
    const scroll = controller();
    f.tap('list-view-back'); await settle();
    assert.equal(scroll.hasClients, false, 'Popping the route detaches its scroll owner');
    assert(texts(f).includes('Unchecked'), 'The gallery retains its controlled values');
    f.tap('show-list-view'); await settle();
    rows(); assert.equal(controller().offset, 0); assert(texts(f).includes('항목을 선택하세요.'));
  } finally {await f.close();}
});

test('loaded ListView scrolling retains the page title paint while its selected ink moves', {timeout}, async () => {
  const f=await gallery();let title,scroll,paint,paints=0;
  try{
    f.set(new MaterialApp({home:new ListViewPage(()=>{})}));f.advance(600);f.tap('list-view-item-0');f.advance(600);
    const visit=element=>{if(element.widget instanceof Text&&element.widget.text==='ListView')title=element.findRenderObject();if(element.widget instanceof ListView)scroll=element.widget.controller;element.visitChildren(visit);};visit(f.root.root);assert(title&&scroll?.hasClients);
    scroll.jumpTo(60);f.advance(600);paint=title.paint;title.paint=function(...args){paints++;return paint.apply(this,args);};
    for(const offset of [65,69,61,60]){scroll.jumpTo(offset);f.frame();}
    assert.equal(paints,0,'List-owned scroll/ink invalidation must retain the static page title recording');
    assert(texts(f).includes('선택: 항목 0001'));assert(f.root.nodes.find(node=>node.id==='list-view-item-0')?.selected);
  }finally{if(title&&paint)title.paint=paint;await f.close();}
});

test('ListView selected, hover and splash ink stay inside the list Material across partial rows and resize', {timeout}, async () => {
  const f=await gallery();let surface;
  const find=predicate=>{let found;const visit=element=>{if(predicate(element))found=element;element.visitChildren(visit);};visit(f.root.root);assert(found);return found;};
  try{
    f.set(new MaterialApp({home:new ListViewPage(()=>{})}));
    for(const [width,height] of [[390,480],[620,520]]){
      const metrics=f.root.context.readMetrics();Object.assign(metrics,{logicalWidth:width,physicalWidth:width,logicalHeight:height,physicalHeight:height,viewportGeneration:metrics.viewportGeneration+1});f.frame();
      surface?.delete();surface=f.ck.MakeSurface(width,height);assert(surface);
      const viewport=find(element=>element.renderObject?.constructor.name==='RenderViewport').renderObject;
      const top=viewport.localToGlobal({x:0,y:0}).y,bottom=top+viewport.size.height;
      const controller=find(element=>element.widget instanceof ListView&&element.widget.controller?.debugLabel==='list-view-page').widget.controller;
      controller.jumpTo(0);f.frame();f.tap('list-view-clear');f.advance(501);
      const pixel=(x,y)=>{const image=surface.makeImageSnapshot();try{return [...image.readPixels(x,y,{width:1,height:1,colorType:f.ck.ColorType.RGBA_8888,alphaType:f.ck.AlphaType.Unpremul,colorSpace:f.ck.ColorSpace.SRGB})];}finally{image.delete();}};
      const paint=()=>{f.library.replay(surface.getCanvas(),{commands:f.frame()});surface.flush();};
      paint();const before=pixel(4,Math.floor(top-20));
      f.tap('list-view-item-0');controller.jumpTo(60);f.advance(501);paint();
      assert.deepEqual(pixel(4,Math.floor(top-20)),before,'Selected ink may not reach page controls');
      const y=Math.floor(top+4),x=100;
      for(const kind of ['hover','down','up']){
        f.root.pointer({kind,x,y,pointer:61,device:'mouse',buttons:kind==='down'?1:0,timestamp:f.root.context.clock.now(),viewportGeneration:metrics.viewportGeneration});f.advance(40);paint();
        assert.deepEqual(pixel(4,Math.floor(top-20)),before,kind+' ink must obey the same Material boundary');
      }
      assert(bottom<height,'The footer remains outside the list owner');
      assert.notDeepEqual(pixel(4,y),before,'The selected row must still paint inside the list');
    }
  }finally{surface?.delete();await f.close();}
});

test('precision pan events reach the actual ListView drag recognizer and a new gesture gets a fresh contact', {timeout}, async () => {
  const f=await gallery();
  try{
    f.set(new MaterialApp({home:new ListViewPage(()=>{})}));let scroll;
    const visit=element=>{if(element.widget instanceof ListView)scroll=element.widget.controller;element.visitChildren(visit);};visit(f.root.root);assert(scroll?.hasClients);
    const metrics=f.root.context.readMetrics(),row=f.root.nodes.find(node=>node.id==='list-view-item-0');assert(row);
    const event=(kind,panY=0,deltaY=0)=>{f.elapse(16);f.root.pointer({kind,pointer:707,device:'trackpad',buttons:0,x:row.bounds.x+100,y:row.bounds.y+20,timestamp:f.root.context.clock.now(),viewportGeneration:metrics.viewportGeneration,panX:0,panY,deltaX:0,deltaY,scale:1,rotation:0});f.frame();};
    for(let gesture=0;gesture<2;gesture++){const before=scroll.offset;event('panZoomStart');event('panZoomUpdate',-60,-60);event('panZoomUpdate',-120,-60);assert(scroll.offset>before,'Trackpad drag must move the real fixed-extent viewport');event('panZoomEnd');event('inertiaCancel');}
  }finally{await f.close();}
});

test('ListView CPU profile separates fixed-extent row entry from retained frames', {timeout,skip:process.env.NELYX_LIST_PROFILE!=='1'}, async t => {
  const {Session}=await import('node:inspector'),session=new Session(),f=await gallery();session.connect();
  const post=(method,args={})=>new Promise((resolve,reject)=>session.post(method,args,(error,result)=>error?reject(error):resolve(result)));
  try{
    const metrics=f.root.context.readMetrics();Object.assign(metrics,{logicalWidth:487,physicalWidth:974,logicalHeight:464.5,physicalHeight:929,scale:2,viewportGeneration:metrics.viewportGeneration+1});
    f.set(new MaterialApp({home:new ListViewPage(()=>{})}));f.advance(300);let scroll;
    const visit=element=>{if(element.widget instanceof ListView)scroll=element.widget.controller;element.visitChildren(visit);};visit(f.root.root);
    const layouts=new Map(),layout=f.library.layout.bind(f.library);
    f.library.layout=(input,request)=>{const key=JSON.stringify([input.text,input.width,request?.transient??false]),entry=layouts.get(key)??{n:0,ms:0};layouts.set(key,entry);const before=performance.now();try{return layout(input,request);}finally{entry.n++;entry.ms+=performance.now()-before;}};
    await post('Profiler.enable');await post('Profiler.setSamplingInterval',{interval:100});await post('Profiler.start');
    const times=[];for(const offset of [20000,60000,20000,0]){const begin=performance.now();scroll.jumpTo(offset);f.frame();times.push(performance.now()-begin);f.advance(300);}
    const {profile}=await post('Profiler.stop'),weights=new Map();profile.samples.forEach((id,index)=>weights.set(id,(weights.get(id)??0)+profile.timeDeltas[index]));
    const self=new Map();for(const node of profile.nodes){const frame=node.callFrame,key=frame.url.split('/').slice(-3).join('/')+':'+(frame.lineNumber+1)+':'+frame.functionName;self.set(key,(self.get(key)??0)+(weights.get(node.id)??0)/1000);}
    const top=[...self].sort((a,b)=>b[1]-a[1]).slice(0,20);
    const parents=new Map(),nodes=new Map(profile.nodes.map(node=>[node.id,node]));for(const node of profile.nodes)for(const id of node.children??[])parents.set(id,node.id);
    const inclusive=new Map();profile.samples.forEach((id,index)=>{const seen=new Set();while(id){const node=nodes.get(id),frame=node.callFrame;if(frame.url.includes('/Nelyx/')||frame.url.includes('/packages/')){const key=frame.url.split('/').slice(-3).join('/')+':'+frame.functionName;if(!seen.has(key)){inclusive.set(key,(inclusive.get(key)??0)+profile.timeDeltas[index]/1000);seen.add(key);}}id=parents.get(id);}});
    // Observe ownership after profiling; walking diagnostic fields must not add
    // work to the measured seeks or replace the platform's collection classes.
    const collections={},shapes={};
    for(const [kind,root,fields]of [['Element',f.root.root,['dependencies']],['RenderObject',f.root.pipeline.root,['layoutDependencies','layoutDependents','layoutCache','childStore','childMap']]]){
      const pending=[root];while(pending.length){const node=pending.pop();if(!node)continue;pending.push(...node.children);
        const shape=shapes[kind+'.'+node.constructor.name]??={owners:0,maximumOwnKeys:0};shape.owners++;shape.maximumOwnKeys=Math.max(shape.maximumOwnKeys,Reflect.ownKeys(node).length);
        for(const field of fields){const value=field==='childMap'?Object.getOwnPropertyDescriptor(Object.getOwnPropertyDescriptor(node,'childStore')?.value??{},'many')?.value:Object.getOwnPropertyDescriptor(node,field)?.value,entry=collections[kind+'.'+field]??={owners:0,allocated:0,empty:0};entry.owners++;if(value instanceof Map||value instanceof Set||field==='childStore'&&value!==undefined){entry.allocated++;if(value.size===0)entry.empty++;}}
      }
    }
    t.diagnostic('CanvasKit CPU only '+JSON.stringify({times,top,collections,shapes:Object.entries(shapes).sort((a,b)=>b[1].maximumOwnKeys-a[1].maximumOwnKeys).slice(0,16),inclusive:[...inclusive].sort((a,b)=>b[1]-a[1]).slice(0,24),text:[...inclusive].filter(([key])=>/paragraph|text-painter|text\.js|library\.js/.test(key)).sort((a,b)=>b[1]-a[1]).slice(0,16),layouts:[...layouts].sort((a,b)=>b[1].ms-a[1].ms).slice(0,15),layoutCalls:[...layouts.values()].reduce((sum,e)=>sum+e.n,0)}));
  }finally{session.disconnect();await f.close();}
});
test('all 29 Material sections remain continuously reachable in two and one columns with bounded paragraph ownership', {timeout}, async t => {
  const peaks = {producers: 0, paragraphs: 0};
  const observe = stats => {for (const key of Object.keys(peaks)) peaks[key] = Math.max(peaks[key], stats[key]);};
  const f = await gallery({withImages: true, onParagraphLayout: observe});
  const sample = () => observe(f.library.debugTextStats);
  const findEditor = () => {
    let found;
    const visit = element => {if (element.widget instanceof EditableText && element.widget.id === 'field-filled') found = element.stateObject; element.visitChildren(visit);};
    visit(f.root.root); return found;
  };
  try {
    f.tap('toggle-planned');
    assert.equal(galleryControllers(f).length, 2);
    const metrics = f.root.context.readMetrics();
    for (const width of [1440, 390]) {
      Object.assign(metrics, {logicalWidth: width, physicalWidth: width, viewportGeneration: metrics.viewportGeneration + 1}); f.frame();
      const seen = new Set();
      sweep(f, () => {sample(); for (const text of texts(f)) seen.add(text);});
      for (const demo of demos) assert(seen.has(demo.title), 'Expected continuously reachable Material section ' + demo.id + ' at width ' + width);
    }
    f.reveal('field-filled'); f.tap('field-filled'); f.nativeEdit('field-filled', '연속 탐색 😀');
    const editor = findEditor(), controller = editor.widget.controller;
    controller.selection = {anchor: 4, focus: 1}; f.frame();
    for (const width of [1440, 390]) {
      Object.assign(metrics, {logicalWidth: width, physicalWidth: width, viewportGeneration: metrics.viewportGeneration + 1}); f.frame();
      f.reveal('field-filled'); sample();
      assert(findEditor() === editor, 'The same editor State survives column changes');
      assert.equal(controller.text, '연속 탐색 😀');
      assert.deepEqual(controller.selection, {anchor: 4, focus: 1});
    }
    assert(peaks.producers <= 128, 'The selected gallery must remain within its 128-producer workload target: ' + JSON.stringify(peaks));
    assert(peaks.paragraphs <= 256, 'The selected CPU consumer must remain within its 256-resident workload target');
    t.diagnostic('CanvasKit continuous Material workload: ' + JSON.stringify(peaks));
  } finally {await f.close();}
});
test('real gallery buttons, controlled values, category changes and responsive reparent retain State and release resources', {timeout}, async () => {
  const f = await gallery();
  const theme=()=>{let data;const visit=element=>{if(element.widget instanceof MaterialApp)data=element.widget.options.theme;element.visitChildren(visit);};visit(f.root.root);assert(data);return data;};
  try {
    const originalTheme=theme();
    f.tap('demo-filled');
    assert.equal(theme(),originalTheme,'A control value change must preserve the inherited theme and section metric revision');
    assert(texts(f).some(text => text.includes('Filled pressed')));
    f.tap('category-selection');
    f.tap('check-value');
    assert(texts(f).includes('Unchecked'));
    f.tap('radio-second');
    f.tap('switch-value');
    assert(texts(f).includes('On'));
    const metrics = f.root.context.readMetrics();
    Object.assign(metrics, {logicalWidth: 540, physicalWidth: 540, viewportGeneration: 2});
    f.frame();
    assert(texts(f).includes('On'));
    f.tap('toggle-theme');
    f.advance(250);
    assert.notEqual(theme(),originalTheme,'Actual theme inputs must still replace the inherited theme');
    f.tap('category-actions');
    f.tap('category-selection');
    assert(texts(f).includes('Unchecked'));
    f.reveal('switch-value');
    assert(texts(f).includes('On'));
  } finally {await f.close();}
});
test('progress animation retires on category replacement; basic dialog opens and returns to the gallery', {timeout}, async () => {
  const f = await gallery();
  try {
    f.tap('category-communication');
    f.tap('toggle-progress');
    f.advance(300);
    assert(texts(f).includes('Stop animation'));
    f.tap('category-containment');
    f.tap('open-dialog');
    f.advance(500);
    assert(texts(f).includes('현재 공개된 기본 Dialog API 데모입니다.'));
    f.tap('gallery-dialog-close');
    f.advance(500);
    await Promise.resolve();
    f.frame();
    assert(texts(f).some(text => text.includes('Dialog closed')));
  } finally {await f.close();}
});
test('the packaged photo decodes inside the real codec budget, reaches RawImage and retires on navigation', {timeout}, async () => {
  const f = await gallery({withImages: true});
  const photo = () => {
    let found = null;
    const visit = element => {if (element.widget instanceof RawImage && element.widget.image) found = element.widget.image; element.visitChildren(visit);};
    visit(f.root.root);
    return found;
  };
  try {
    f.tap('category-images');
    for (let attempt = 0; attempt < 12 && photo() === null; attempt++) {
      await new Promise(resolve => setImmediate(resolve));
      f.advance(16);
    }
    assert(photo(), 'Expected the real packaged photo instead of an empty/error image');
    assert.equal(photo().width, 720);
    assert.equal(photo().height, 1080);
    f.tap('category-actions');
    f.advance(32);
    assert.equal(photo(), null);
  } finally {await f.close();}
});
test('mounted text editors keep one controller owner and edited content through narrow and wide layouts', {timeout}, async () => {
  const f = await gallery();
  const controller = () => {
    let result = null;
    const visit = element => {if (element.widget instanceof TextField && element.widget.id === 'field-filled') result = element.widget.controller; element.visitChildren(visit);};
    visit(f.root.root);
    return result;
  };
  try {
    f.tap('category-text');
    const original = controller();
    assert(original);
    original.text = 'Edited before resizing';
    f.frame();
    const metrics = f.root.context.readMetrics();
    for (const width of [390, 1440]) {
      Object.assign(metrics, {logicalWidth: width, physicalWidth: width, viewportGeneration: metrics.viewportGeneration + 1});
      f.frame();
      assert.equal(controller(), original);
      assert.equal(controller().text, 'Edited before resizing');
    }
    f.tap('category-actions');
    f.tap('category-text');
    assert.equal(controller().text, 'Edited before resizing');
  } finally {await f.close();}
});

test('Material input page validates and resets its public Form without leaking owned editors on navigation',{timeout},async()=>{
  const f=await gallery();
  const controller=id=>{let value;const visit=e=>{if(e.widget instanceof TextField&&e.widget.id===id)value=e.widget.controller;e.visitChildren(visit);};visit(f.root.root);assert(value);return value;};
  try{
    f.tap('category-text');f.tap('form-save');f.advance(168);assert(texts(f).includes('이름을 입력하세요.'));assert(texts(f).includes('이메일 형식을 확인하세요.'));
    const name=controller('form-name'),email=controller('form-email');name.text='Ada';email.text='ada@example.com';f.frame();f.tap('form-save');f.advance(168);assert(texts(f).includes('Saved: Ada · ada@example.com'));
    f.tap('form-reset');f.advance(168);assert.equal(name.text,'');assert.equal(email.text,'');assert(texts(f).includes('Form reset'));assert(!texts(f).includes('이름을 입력하세요.'));
    f.tap('category-actions');assert.throws(()=>name.addListener(()=>{}),/dispose/);assert.throws(()=>email.addListener(()=>{}),/dispose/);
  }finally{await f.close();}
});

test('both real gallery Forms traverse Next to email, submit Done and reset interaction errors at keyboard height',{timeout},async()=>{
  const f=await gallery(),metrics=f.root.context.readMetrics();
  try {
    Object.assign(metrics,{logicalWidth:390,physicalWidth:390,logicalHeight:498,physicalHeight:498,viewportGeneration:metrics.viewportGeneration+1});f.frame();
    for(const [category,name,email,saved,design]of [['category-text','form-name','form-email','Saved: Ada · ada@example.com','show-cupertino'],['cupertino-category-text','cupertino-form-name','cupertino-form-email','Cupertino saved: Ada · ada@example.com','show-material']]){
      // Select the category in the full header, then retain it through IME resize.
      Object.assign(metrics,{logicalHeight:780,physicalHeight:780,viewportGeneration:metrics.viewportGeneration+1});f.frame();f.tap(category);
      Object.assign(metrics,{logicalHeight:498,physicalHeight:498,viewportGeneration:metrics.viewportGeneration+1});f.frame();
      const find=id=>{const node=f.root.nodes.find(node=>node.id===id);assert(node,'Expected visible editor '+id);return node;};
      let nameElement;const visit=element=>{if(element.widget instanceof EditableText&&element.widget.id===name)nameElement=element;element.visitChildren(visit);};visit(f.root.root);assert(nameElement?.widget.focusNode);nameElement.widget.focusNode.requestFocus();await Promise.resolve();f.frame();assert.equal(find(name).focused,true);f.nativeEdit(name,'Ada');f.submitEditor(name);await Promise.resolve();f.frame();
      assert.equal(find(email).focused,true,'Next must focus the email editor in the actual gallery tree');
      f.nativeEdit(email,'ada@example.com');f.submitEditor(email);await Promise.resolve();f.frame();assert(texts(f).includes(saved));assert.equal(find(email).focused,false);
      const form=Form.of(nameElement);form.reset();f.advance(168);assert.equal(form.hasInteractedByUser,false);assert(!texts(f).includes('이름을 입력하세요.'));assert(!texts(f).includes('이메일 형식을 확인하세요.'));
      Object.assign(metrics,{logicalHeight:780,physicalHeight:780,viewportGeneration:metrics.viewportGeneration+1});f.frame();f.tap(design);
    }
  }finally{await f.close();}
});

test('Material message switches between multiline and single-line policies without replacing its editor State or losing content',{timeout},async()=>{
  const f=await gallery();const find=type=>{let result;const visit=e=>{if(e.widget instanceof type&&(e.widget.id==='field-outlined'||e.widget.options?.id==='field-outlined'))result=e;e.visitChildren(visit);};visit(f.root.root);assert(result);return result;};
  try{
    f.tap('category-text');const controller=find(TextField).widget.controller,state=find(EditableText).stateObject;controller.text='First\nSecond';controller.selection={anchor:12,focus:6};f.frame();assert.equal(find(EditableText).widget.inputOptions.maxLines,4);
    f.tap('toggle-message-lines');assert.equal(find(EditableText).stateObject,state);assert.equal(find(EditableText).widget.inputOptions.maxLines,1);assert.equal(controller.text,'First\nSecond');assert.deepEqual(controller.selection,{anchor:12,focus:6});
    f.tap('toggle-message-lines');assert.equal(find(EditableText).stateObject,state);assert.equal(find(EditableText).widget.inputOptions.maxLines,4);assert.equal(controller.text,'First\nSecond');assert(controller.undo());f.frame();assert.equal(controller.text,'Material 3');
    f.tap('category-actions');f.tap('category-text');assert.equal(find(TextField).widget.controller,controller);
  }finally{await f.close();}
});

test('Cupertino controls use real input, retain selected values across sections and ignore disabled controls', {timeout}, async () => {
  const f = await gallery();
  try {
    f.tap('show-cupertino');
    f.tap('cupertino-filled');
    assert(texts(f).includes('Cupertino filled pressed'));
    f.tap('cupertino-disabled');
    assert(texts(f).includes('Cupertino filled pressed'));
    f.tap('cupertino-category-selection');
    f.tap('cupertino-switch');
    f.advance(400);
    assert(texts(f).includes('On'));
    f.tap('cupertino-checkbox');
    assert(texts(f).includes('Mixed'));
    f.tap('cupertino-checkbox-disabled');
    assert(texts(f).includes('Mixed'));
    f.tap('cupertino-radio-second');
    assert(texts(f).includes('Selected: second'));
    f.reveal('cupertino-slider');
    const slider = f.root.nodes.find(node => node.id === 'cupertino-slider').bounds;
    for (const [kind, fraction] of [['down', .4], ['move', .6], ['move', .8], ['up', .8]]) {
      f.root.pointer({kind, x: slider.x + slider.width * fraction, y: slider.y + slider.height / 2, pointer: 1, device: 'mouse', buttons: kind === 'up' ? 0 : 1, timestamp: 100, viewportGeneration: 1});
      f.frame();
    }
    assert(!texts(f).includes('Value: 40'));
    f.tap('cupertino-category-actions');
    f.tap('cupertino-category-selection');
    assert(texts(f).includes('On'));
    assert(texts(f).includes('Mixed'));
    f.reveal('cupertino-radio-second');
    assert(texts(f).includes('Selected: second'));
  } finally {await f.close();}
});

test('Material and Cupertino editors keep their values and one host binding through design, theme and viewport changes', {timeout}, async () => {
  const f = await gallery();
  const controller = (type, id) => {
    let found = null;
    const visit = element => {if (element.widget instanceof type && element.widget.id === id) found = element.widget.controller; element.visitChildren(visit);};
    visit(f.root.root);
    return found;
  };
  try {
    f.tap('category-text');
    const material = controller(TextField, 'field-filled');
    material.text = 'Material edit';
    f.frame();
    f.tap('show-cupertino');
    f.tap('cupertino-category-text');
    const cupertino = controller(CupertinoTextField, 'cupertino-field');
    assert(cupertino);
    const formOwners=[];const visitForm=element=>{if(element.widget instanceof CupertinoFormRow||element.widget instanceof CupertinoFormSection)formOwners.push(element.widget);element.visitChildren(visitForm);};visitForm(f.root.root);
    assert.equal(formOwners.filter(owner=>owner instanceof CupertinoFormSection).length,1);
    assert.equal(formOwners.filter(owner=>owner instanceof CupertinoFormRow).length,2,'Both form fields consume the public Cupertino row owner');
    cupertino.text = 'Cupertino edit 한글';
    f.frame();
    f.tap('cupertino-toggle-theme');
    f.tap('cupertino-accent-2');
    const metrics = f.root.context.readMetrics();
    for (const width of [390, 1440]) {
      Object.assign(metrics, {logicalWidth: width, physicalWidth: width, viewportGeneration: metrics.viewportGeneration + 1});
      f.frame();
      assert.equal(controller(CupertinoTextField, 'cupertino-field'), cupertino);
      assert.equal(cupertino.text, 'Cupertino edit 한글');
    }
    f.tap('show-material');
    assert.equal(controller(TextField, 'field-filled'), material);
    assert.equal(material.text, 'Material edit');
    f.tap('show-cupertino');
    assert.equal(controller(CupertinoTextField, 'cupertino-field'), cupertino);
    assert.equal(cupertino.text, 'Cupertino edit 한글');
  } finally {await f.close();}
});

test('low-height gallery chrome preserves the focused editor owner and visible selection across keyboard-sized viewports',{timeout},async()=>{
  const f=await gallery(),metrics=f.root.context.readMetrics();
  const resize=height=>{Object.assign(metrics,{logicalWidth:390,physicalWidth:390,logicalHeight:height,physicalHeight:height,viewportGeneration:metrics.viewportGeneration+1});f.frame();};
  const editor=id=>{let found;const visit=element=>{if(element.widget instanceof EditableText&&element.widget.id===id)found=element;element.visitChildren(visit);};visit(f.root.root);assert(found,'Expected editor '+id);return found;};
  try {
    resize(780);
    for(const [id,category,theme,design]of [['field-filled','category-text','toggle-theme','show-cupertino'],['cupertino-field','cupertino-category-text','cupertino-toggle-theme','show-material']]){
      f.tap(category);const original=editor(id),state=original.stateObject,controller=original.widget.controller;
      controller.text='Retained 한글';controller.selection={anchor:7,focus:2};f.frame();
      const semantic=f.root.nodes.find(node=>node.id===id);assert(semantic?.actions?.focus);semantic.actions.focus();await Promise.resolve();f.frame();const binding=state.binding;
      for(const height of [498,360,780]){
        resize(height);const current=editor(id),node=f.root.nodes.find(node=>node.id===id);
        assert.equal(current.stateObject,state);assert.equal(current.widget.controller,controller);assert.equal(state.binding,binding);assert.equal(controller.text,'Retained 한글');assert.deepEqual(controller.selection,{anchor:7,focus:2});
        assert(node?.focused&&node.bounds.height>0&&node.bounds.y>=0&&node.bounds.y+node.bounds.height<=height,'Focused editor must remain visible at height '+height);
        assert(f.root.nodes.some(node=>node.id===theme));assert(f.root.nodes.some(node=>node.id===design));
      }
      f.tap(design);
    }
  }finally{await f.close();}
});

test('Cupertino default named route returns a result and preserves gallery values after reverse completion', {timeout}, async () => {
  const f = await gallery();
  const settle = async () => {f.advance(501); await Promise.resolve(); await Promise.resolve(); f.frame();};
  try {
    f.tap('show-cupertino');
    f.tap('cupertino-category-selection');
    f.tap('cupertino-switch');
    f.advance(400);
    f.tap('cupertino-category-navigation');
    f.tap('cupertino-open-route');
    await settle();
    assert(texts(f).includes('Named route · count: 0'));
    f.tap('cupertino-route-increment');
    assert(texts(f).includes('Named route · count: 1'));
    const metrics = f.root.context.readMetrics();
    Object.assign(metrics, {logicalWidth: 390, physicalWidth: 390, viewportGeneration: metrics.viewportGeneration + 1});
    f.frame();
    const actions = ['increment', 'reset', 'return'].map(id => f.root.nodes.find(node => node.id === 'cupertino-route-' + id));
    assert(actions[0].bounds.y < actions[1].bounds.y && actions[1].bounds.y < actions[2].bounds.y, 'Narrow action bar must overflow into a column');
    assert(texts(f).includes('Named route · count: 1'), 'Resizing retains the route counter');
    f.tap('cupertino-route-return');
    await settle();
    assert(texts(f).includes('Cupertino route result: 1'));
    f.tap('cupertino-category-selection');
    assert(texts(f).includes('On'));
    f.tap('cupertino-category-navigation');
    f.tap('cupertino-open-route');
    await settle();
    assert(texts(f).includes('Named route · count: 0'), 'A new route owns a new counter');
  } finally {await f.close();}
});

test('Cupertino activity, lists and basic dialog retire correctly and all planned sections remain browsable', {timeout}, async () => {
  const f = await gallery();
  try {
    f.tap('show-cupertino');
    f.tap('cupertino-category-communication');
    f.tap('cupertino-toggle-activity');
    f.advance(300);
    assert(texts(f).includes('Stop animation'));
    f.tap('cupertino-category-containment');
    f.advance(400);
    assert.equal(f.root.scheduler.transientCallbackCount, 0);
    f.tap('cupertino-list-notifications');
    await Promise.resolve();
    f.frame();
    assert(texts(f).includes('Notifications selected'));
    f.tap('cupertino-open-dialog');
    f.advance(200);
    assert(texts(f).includes('현재 공개된 기본 AlertDialog API 데모입니다.'));
    f.tap('cupertino-dialog-close');
    f.advance(200);
    await Promise.resolve();
    f.frame();
    assert(texts(f).includes('Cupertino dialog closed'));
    f.tap('cupertino-category-all');
    f.tap('cupertino-toggle-planned');
    const seen = new Set();
    sweep(f, () => {for (const text of texts(f)) seen.add(text);});
    for (const demo of cupertinoDemos) assert(seen.has(demo.title), 'Expected continuously reachable Cupertino section ' + demo.id);
    assert(seen.has('준비 중'));
    f.tap('cupertino-toggle-planned');
    assert(texts(f).includes('10개 섹션 · 스크롤하여 탐색'));
    f.tap('show-material');
    f.advance(400);
    assert.equal(f.root.scheduler.transientCallbackCount, 0);
  } finally {await f.close();}
});


test('Cupertino contact form remains touch-scrollable after Done hides the keyboard',{timeout},async()=>{
  const f=await gallery(),metrics=f.root.context.readMetrics();
  const resize=height=>{Object.assign(metrics,{logicalWidth:411,physicalWidth:411,logicalHeight:height,physicalHeight:height,viewportGeneration:metrics.viewportGeneration+1});f.frame();};
  try {
    resize(820);f.tap('show-cupertino');f.tap('cupertino-category-text');
    f.tap('cupertino-form-name');resize(520);f.nativeEdit('cupertino-form-name','Ada');f.submitEditor('cupertino-form-name');
    f.nativeEdit('cupertino-form-email','ada@example.com');f.submitEditor('cupertino-form-email');resize(820);
    let timestamp=0;
    for(let swipe=0;swipe<3&&!f.root.nodes.some(node=>node.id==='cupertino-form-reset');swipe++){
      for(const [kind,y]of [['down',615],['move',590],['move',530],['move',460],['move',390],['up',370]]){
        timestamp+=50;f.elapse(50);f.root.pointer({kind,x:205,y,pointer:1,device:'touch',buttons:kind==='up'?0:1,timestamp,viewportGeneration:metrics.viewportGeneration});f.frame();
      }
    }
    assert(f.root.nodes.some(node=>node.id==='cupertino-form-reset'),'Touch drag must reveal the reset control');f.tap('cupertino-form-reset');
    assert(texts(f).includes('Cupertino form reset'));
  }finally{await f.close();}
});

test('both gallery selection controls retain the editor while their public keyboard affordances are disabled',{timeout},async()=>{
  const f=await gallery();const editor=id=>{let state;const visit=element=>{if(element.widget instanceof EditableText&&element.widget.id===id)state=element.stateObject;element.visitChildren(visit);};visit(f.root.root);assert(state);return state;};
  const selectAll=()=>{for(const kind of ['down','up'])f.root.key({kind,key:'a',control:true,meta:false,alt:false,shift:false,repeat:false});f.frame();};
  try{
    f.tap('category-text');let state=editor('field-filled');const controller=state.widget.controller;controller.text='Select me';controller.selection={anchor:1,focus:3};f.frame();f.tap('toggle-message-selection');assert.equal(editor('field-filled'),state);assert.equal(state.widget.selectionEnabled,false);state.requestKeyboard();f.root.buildOwner.focus.applyFocusChangesIfNeeded();f.frame();selectAll();assert.deepEqual(controller.selection,{anchor:1,focus:3});assert.equal(state.showToolbar(),false);
    f.tap('toggle-message-selection');assert.equal(state.widget.selectionEnabled,true);state.requestKeyboard();f.root.buildOwner.focus.applyFocusChangesIfNeeded();f.frame();selectAll();assert.deepEqual(controller.selection,{anchor:0,focus:9});
    f.tap('show-cupertino');f.tap('cupertino-category-text');state=editor('cupertino-field');const cupertino=state.widget.controller;cupertino.text='Keep me';cupertino.selection={anchor:1,focus:4};f.frame();f.tap('cupertino-toggle-selection');assert.equal(editor('cupertino-field'),state);assert.equal(state.widget.selectionEnabled,false);state.requestKeyboard();f.root.buildOwner.focus.applyFocusChangesIfNeeded();f.frame();selectAll();assert.deepEqual(cupertino.selection,{anchor:1,focus:4});assert.equal(cupertino.text,'Keep me');
    f.tap('cupertino-toggle-selection');assert.equal(state.widget.selectionEnabled,true);
  }finally{await f.close();}
});

test('both gallery message scroll controls move their actual Core paragraph while preserving document and selection',{timeout},async()=>{
  const f=await gallery(),body='A\nB\nC\nD\nE\nF\nG';const editor=id=>{let state;const visit=element=>{if(element.widget instanceof EditableText&&element.widget.id===id)state=element.stateObject;element.visitChildren(visit);};visit(f.root.root);assert(state);return state;};
  try{
    for(const [open,id,top,end]of [['category-text','field-outlined','message-scroll-top','message-scroll-end'],['cupertino-category-text','cupertino-field','cupertino-scroll-top','cupertino-scroll-end']]){
      if(id==='cupertino-field')f.tap('show-cupertino');f.tap(open);const state=editor(id),controller=state.widget.controller;controller.text=body;controller.selection={anchor:0,focus:0};f.frame();const scroll=state.widget.inputOptions.scrollController;assert(scroll?.hasClients);assert.equal(state.renderEditable.offset,scroll.position);assert(scroll.position.maxScrollExtent>0);
      state.requestKeyboard();f.root.buildOwner.focus.applyFocusChangesIfNeeded();f.frame();assert.equal(f.root.nodes.find(node=>node.id===id).focused,true);
      f.tap(end);assert.equal(scroll.offset,scroll.position.maxScrollExtent);assert.equal(state.renderEditable.scrollOffset.y,scroll.offset);assert.equal(editor(id),state);assert.equal(controller.text,body);assert.deepEqual(controller.selection,{anchor:0,focus:0});assert.equal(f.root.nodes.find(node=>node.id===id).focused,true);f.tap(top);assert.equal(scroll.offset,0);assert.equal(controller.text,body);
    }
  }finally{await f.close();}
});
