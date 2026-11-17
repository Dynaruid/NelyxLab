// SPDX-License-Identifier: BSD-3-Clause
import { build } from 'esbuild';
import { createRequire } from 'node:module';
import path from 'node:path';
import { execute } from '../sdk/tooling/cli/src/commands.mjs';

const hermesLowering = process.argv.includes('--hermes-lowering');
if (!process.argv.includes('--child')) {
  try {
    await execute(
      process.execPath,
      [import.meta.filename, '--child', ...(hermesLowering ? ['--hermes-lowering'] : [])],
      { cwd: process.cwd(), timeout: 1_200_000 },
    );
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
} else {
  const result = await build({
    stdin: {
      resolveDir: process.cwd(),
      loader: 'ts',
      contents: `
import assert from 'node:assert/strict';
import {Widget,Element,BuildOwner,InheritedWidget,LeafRenderObjectWidget,RenderObjectElement} from './Nelyx/src/framework/widgets/framework.ts';
import {RenderBox} from './Nelyx/src/framework/rendering/object.ts';
import {Text,SizedBox} from './Nelyx/src/framework/widgets/basic.ts';
import {RichText} from './Nelyx/src/framework/widgets/rich-text.ts';
import {TextSpan} from './Nelyx/src/framework/painting/text-span.ts';
import {DefaultTextStyle} from './Nelyx/src/framework/widgets/default-text-style.ts';
import {TextStyle} from './Nelyx/src/framework/painting/text-style.ts';
import {Directionality} from './Nelyx/src/framework/widgets/app-data.ts';
import {ResourceRegistry} from './Nelyx/src/hosting/resources.ts';
import {GlobalKey} from './Nelyx/src/framework/widgets/global-key.ts';
import {FlutterError} from './Nelyx/src/foundation/flutter-error.ts';
FlutterError.onError=details=>{throw details.exception;};

class Host extends Widget {
  constructor(readonly items:Widget[]=[],key=null){super(key);}
  createElement(){return new HostElement(this);}
}
class HostElement extends Element {
  protected build(){return (this.widget as Host).items;}
  replace(items){this.children=this.reconcile(this.children,items);this.owner.parentRebuilt(this);}
}
class Data extends InheritedWidget {
  constructor(readonly value:number,child:Widget){super(child);}
  updateShouldNotify(old){return old.value!==this.value;}
}
class ProbeBox extends RenderBox {
  value=0;
  protected performLayout(constraints){return constraints.smallest;}
}
let updates=0,creates=0;
class Probe extends LeafRenderObjectWidget {
  constructor(readonly initial=false,key=null,readonly afterCreate=undefined){super(key);}
  override _hasInitialRenderObjectConfiguration(){return this.initial;}
  private value(context){return (context.maybeDependOn(Data)?.value??0)+context.services.readMetrics('scale').scale;}
  createRenderObject(context){creates++;const render=new ProbeBox();render.value=this.value(context);this.afterCreate?.(context);return render;}
  updateRenderObject(context,render){updates++;render.value=this.value(context);}
}
function fixture(widget){
  const resources=new ResourceRegistry(),font={id:'initial-font',generation:1};let scale=1;
  resources.register({...font,kind:'font'},()=>{});resources.bindResource(font);
  const metrics=()=>({logicalWidth:100,logicalHeight:100,physicalWidth:100,physicalHeight:100,scale,viewportGeneration:1,rendererGeneration:1,nativeContextGeneration:null,nativeSurfaceGeneration:null});
  const owner=new BuildOwner({owner:{id:'initial',generation:1},resources,assets:new Map(),defaultFont:font,text:{layout(){throw Error('Unexpected text layout');}},readMetrics:metrics,clock:{now:()=>0}} as any,()=>{});
  const root=widget.createElement();
  const flush=()=>{owner.flushBuild();owner.finalizeTree();};
  root.mount(undefined,owner);
  return {owner,root,flush,resize(value){const before=metrics();scale=value;owner._viewMetricsChanged(before,metrics());},close(){try{root.unmount();owner.dispose();assert.equal(owner.globalKeyCount,0);}finally{resources.dispose();}}};
}
for(const initial of [false,true]){
  updates=creates=0;const f=fixture(new Probe(initial));
  try{
    f.flush();assert.equal(creates,1);assert.equal(updates,initial?0:1);
    f.root.markNeedsBuild();f.flush();assert.equal(updates,initial?1:2,'A later self-dirty update was skipped');
    f.resize(2);f.flush();assert.equal(f.root.renderObject.value,2,'Creation metrics were not attributed to their Element');
  }finally{f.close();}
}
// Invalidation during creation and after creation both cancel the one-time credit.
for(const invalidate of ['during','after','dependency','widget']){
  updates=0;const f=fixture(new Probe(true,null,invalidate==='during'?context=>context.markNeedsBuild():undefined));
  try{
    if(invalidate==='after')f.root.markNeedsBuild();
    if(invalidate==='dependency')f.root.dependenciesChanged();
    if(invalidate==='widget')f.root.update(new Probe(true));
    f.flush();assert.equal(updates,1,'Lost configuration invalidation: '+invalidate);
  }finally{f.close();}
}
// A first child getter failure consumes the credit, even if the caller retries directly.
{
  updates=0;const failure={children:true},widget=new Probe(true),f=fixture(widget);
  Object.defineProperty(widget,'childWidgets',{configurable:true,get(){throw failure;}});
  try{
    assert.throws(()=>f.owner.flushBuild(),error=>error===failure);assert.equal(updates,0);
    delete widget.childWidgets;f.root.markNeedsBuild();f.flush();assert.equal(updates,1);
  }finally{f.close();}
}
// Creation restores the owner's current receiver on success and failure.
{
  const f=fixture(new Host());f.flush();const parent=f.root;
  try{
    const child=new Probe(true).createElement();f.owner.currentElement=parent;
    child.mount(parent,f.owner);assert.equal(f.owner.currentElement,parent);
    parent.children.push(child);f.owner.currentElement=undefined;f.flush();
    f.resize(2);assert(child.dirty);assert.equal(parent.dirty,false,'Creation registered View metrics on the parent');f.flush();
    const failure={creation:true},bad=new Probe(true,null,()=>{throw failure;}).createElement();
    f.owner.currentElement=parent;
    try{assert.throws(()=>bad.mount(parent,f.owner),error=>error===failure);assert.equal(f.owner.currentElement,parent);}
    finally{f.owner.currentElement=undefined;bad.unmount();}
  }finally{f.owner.currentElement=undefined;f.close();}
}
// Providers and GlobalKey activation keep their normal update and retirement protocols.
{
  const key=new GlobalKey('initial-probe'),f=fixture(new Host([new Data(10,new Host([new Probe(true,key)])),new Data(20,new Host())]));
  try{
    f.flush();const element=key.currentElement,left=f.root.children[0].children[0],right=f.root.children[1].children[0];
    assert.equal(element.renderObject.value,11);
    f.root.children[0].update(new Data(12,left.widget));f.flush();assert.equal(element.renderObject.value,13);
    right.replace([new Probe(true,key)]);left.replace([]);f.flush();assert.equal(key.currentElement,element);assert.equal(element.renderObject.value,21);
    right.replace([]);f.flush();assert.equal(key.currentElement,undefined);
  }finally{f.close();}
}
// A GlobalKey can move a configured renderer before its first queued build.
{
  const key=new GlobalKey('prebuild-probe'),f=fixture(new Host([new Data(10,new Host([new Probe(true,key)])),new Data(20,new Host())]));
  try{
    f.root.rebuild();for(const provider of f.root.children){provider.rebuild();provider.children[0].rebuild();}
    const element=key.currentElement,left=f.root.children[0].children[0],right=f.root.children[1].children[0];
    right.replace([new Probe(true,key)]);left.replace([]);f.flush();assert.equal(key.currentElement,element);assert.equal(element.renderObject.value,21);
  }finally{f.close();}
}
function findRender(root){if(root instanceof RenderObjectElement)return root;for(const child of root.children){const found=findRender(child);if(found)return found;}}
// A real Text resolves its ambient configuration once on creation. Later builds
// still reread live options and providers; its semantics are complete immediately.
{
  let reads=0,size=17;const options={get fontSize(){reads++;return size;}},text=new Text('한글🙂',options);
  const f=fixture(new DefaultTextStyle(new TextStyle({color:0xff123456}),new Directionality('ltr',text)));
  try{
    f.flush();const element=findRender(f.root),render=element.renderObject;
    assert.equal(reads,1,'Text resolved its first configuration twice');assert.equal(render.config.style.fontSize,17);
    assert.equal(render.semantics.name,'한글🙂');assert.equal(render.semantics.role,'text');
    size=23;element.markNeedsBuild();f.flush();assert.equal(reads,2);assert.equal(render.config.style.fontSize,23);
    f.resize(2);f.flush();assert.equal(render.devicePixelRatio,2);assert.equal(reads,3);
    f.root.update(new DefaultTextStyle(new TextStyle({color:0xff654321}),f.root.widget.child));f.flush();
    assert.equal(render.config.style.color,0xff654321);assert.equal(reads,4);assert.equal(findRender(f.root),element);
    f.root.children[0].update(new Directionality('rtl',text));f.flush();assert.equal(render.config.painterOptions.textDirection,'rtl');
  }finally{f.close();}
}
// Public Text extensions and a runtime prototype replacement retain both hooks.
{
  let made=0,configured=0;
  class CustomText extends Text{override make(context){made++;return super.make(context);}override configure(render,context){configured++;super.configure(render,context);}}
  const f=fixture(new CustomText('custom'));try{f.flush();assert.equal(made,1);assert.equal(configured,1);}finally{f.close();}
  const g=fixture(new Text('prototype'));
  g.root.rebuild(); // Create the internal render Element before replacing the hook.
  const original=Text.prototype.configure;Text.prototype.configure=function(render,context){configured++;return original.call(this,render,context);};
  try{const before=configured;g.flush();assert.equal(configured,before+1);}finally{g.close();Text.prototype.configure=original;}
}
for(const accessor of ['own','prototype','proxy']){
  let made=0,configured=0;const text=new Text('accessor'),make=Text.prototype.make,configure=Text.prototype.configure;
  const target=accessor==='prototype'?Text.prototype:text,descriptors=accessor==='prototype'?Object.getOwnPropertyDescriptors(Text.prototype):null;
  let widget=text;
  if(accessor==='proxy')widget=new Proxy(text,{get(target,key,receiver){if(key==='make')made++;if(key==='configure')configured++;return Reflect.get(target,key,receiver);}});
  else{
    Object.defineProperty(target,'make',{configurable:true,get(){made++;return make;}});
    Object.defineProperty(target,'configure',{configurable:true,get(){configured++;return configure;}});
  }
  const f=fixture(widget);
  try{f.flush();assert.equal(made,1,'Admission observed a custom make getter: '+accessor);assert.equal(configured,1,'Admission hid or observed a custom configure getter: '+accessor);}
  finally{if(descriptors){Object.defineProperty(Text.prototype,'make',descriptors.make);Object.defineProperty(Text.prototype,'configure',descriptors.configure);}f.close();}
}
// Rich text retains its initial update even for captured spans: their public
// plain-text/traversal methods can change without changing the captured fields.
for(const custom of [false,true]){
  let reads=0;
  class UserSpan extends TextSpan{override toPlainText(options){reads++;return super.toPlainText(options);}}
  const span=custom?new UserSpan({text:'rich'}):new TextSpan({text:'rich'}),f=fixture(new RichText(span));
  try{f.flush();const element=findRender(f.root);assert.equal(element.widget._hasInitialRenderObjectConfiguration(),false);assert.equal(element.renderObject.semantics.name,'rich');if(custom)assert(reads>=2);}
  finally{f.close();}
}
for(const method of ['toPlainText','visitDirectChildren']){
  const f=fixture(new RichText(new TextSpan({text:'parent',children:[new TextSpan({text:'child'})]})));
  f.root.rebuild();const element=findRender(f.root),descriptor=Object.getOwnPropertyDescriptor(TextSpan.prototype,method),original=TextSpan.prototype[method];let calls=0;
  Object.defineProperty(TextSpan.prototype,method,{configurable:true,writable:true,value:method==='toPlainText'?function(options){calls++;return original.call(this,options)+'!';}:function(){calls++;return true;}});
  try{f.flush();assert.equal(calls,1,'Initial update hid a live span prototype hook');assert.equal(element.renderObject.semantics.name,method==='toPlainText'?'parentchild!':'parent');}
  finally{if(descriptor)Object.defineProperty(TextSpan.prototype,method,descriptor);else delete TextSpan.prototype[method];f.close();}
}
// Unqualified sizing adapters still configure their renderer on the first build.
{
  const f=fixture(new SizedBox(37,19));try{f.flush();assert.equal(f.root.renderObject.additional.maxWidth,37);assert.equal(f.root.renderObject.additional.maxHeight,19);}finally{f.close();}
}
console.log('Render initialization: one-time configuration, invalidation/retry, live custom hooks, ambient/metrics ownership, GlobalKey movement, real plain/rich text and cleanup PASS.');
`,
    },
    bundle: true,
    write: false,
    platform: 'node',
    format: 'esm',
    target: 'node24',
    logLevel: 'silent',
  });
  let contents = result.outputFiles[0].text;
  if (hermesLowering) {
    const load = createRequire(import.meta.url),
      transformed = load('../sdk/tooling/metro/src/native-hermes-transformer.cjs').transform({
        src: contents,
        filename: path.join(process.cwd(), 'render-initialization-fixture.mjs'),
        options: {
          projectRoot: process.cwd(),
          platform: 'windows',
          dev: false,
          hot: false,
          experimentalImportSupport: true,
          customTransformOptions: { nelyxTemporalRefOptimization: false },
        },
      });
    contents = load('@babel/core').transformFromAstSync(transformed.ast, contents, {
      configFile: false,
      babelrc: false,
      ast: false,
      code: true,
    }).code;
    console.log(
      'RENDER_INITIALIZATION_HERMES_LOWERING ' +
        JSON.stringify({ pruning: false, ...transformed.metadata?.nelyxTemporalRefs }),
    );
  }
  await import('data:text/javascript;base64,' + Buffer.from(contents).toString('base64')).catch(
    (error) => {
      console.error(error.message);
      process.exitCode = 1;
    },
  );
}
