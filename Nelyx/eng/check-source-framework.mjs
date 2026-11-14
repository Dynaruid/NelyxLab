// SPDX-License-Identifier: BSD-3-Clause
import { build } from 'esbuild';
import path from 'node:path';
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';
import { execute } from '../sdk/tooling/cli/src/commands.mjs';
const root = path.resolve(import.meta.dirname, '../..');
const oracleIndex = process.argv.indexOf('--oracle');
const oracleFile = oracleIndex < 0 ? null : process.argv[oracleIndex + 1];
function removeTemporary(temporary, parent) {
  if (path.dirname(temporary) !== parent || fs.lstatSync(temporary).isSymbolicLink())
    throw Error('Source fixture temporary owner differs');
  fs.rmSync(temporary, { recursive: true, force: true });
}
if (oracleIndex >= 0 && (!oracleFile || oracleFile.startsWith('--')))
  throw Error('Missing Source oracle file');
if (!process.argv.includes('--child')) {
  const parent = path.join(root, '.tmp');
  fs.mkdirSync(parent, { recursive: true });
  const temporary = fs.mkdtempSync(path.join(parent, 'source-framework-'));
  try {
    await execute(
      process.execPath,
      [
        import.meta.filename,
        ...(oracleFile ? ['--oracle', path.resolve(oracleFile)] : []),
        '--child',
        temporary,
      ],
      { cwd: root, timeout: 1_200_000 },
    );
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  } finally {
    removeTemporary(temporary, parent);
  }
} else {
  const temporary = path.resolve(process.argv.at(-1));
  if (
    path.dirname(temporary) !== path.join(root, '.tmp') ||
    !path.basename(temporary).startsWith('source-framework-')
  )
    throw Error('Invalid Source fixture temporary owner');
  const bundle = await build({
    define: {
      ORIGINAL_PAGE_EXPECTATIONS: JSON.stringify(
        oracleFile ? JSON.parse(fs.readFileSync(oracleFile, 'utf8')).pages : null,
      ),
      ORIGINAL_SLIVER_EXPECTATIONS: JSON.stringify(
        oracleFile ? (JSON.parse(fs.readFileSync(oracleFile, 'utf8')).slivers ?? null) : null,
      ),
      ORIGINAL_LIFECYCLE_EXPECTATIONS: JSON.stringify(
        oracleFile ? JSON.parse(fs.readFileSync(oracleFile, 'utf8')).lifecycle : null,
      ),
    },
    stdin: {
      resolveDir: root,
      loader: 'ts',
      sourcefile: 'source-framework-fixture.ts',
      contents: `
import assert from 'node:assert/strict';
import {FrameworkRoot} from './Nelyx/src/framework/widgets/root.ts';
import {LeafRenderObjectWidget} from './Nelyx/src/framework/widgets/framework.ts';
import {Builder,SizedBox} from './Nelyx/src/framework/widgets/basic.ts';
import {FlutterError} from './Nelyx/src/foundation/flutter-error.ts';
import {FoundationPlatform} from './Nelyx/src/foundation/platform.ts';
import {RenderBox,PipelineOwner} from './Nelyx/src/framework/rendering/object.ts';
import {Directionality} from './Nelyx/src/framework/widgets/app-data.ts';
import {ResourceRegistry} from './Nelyx/src/hosting/resources.ts';
import {releaseSceneFrameSource} from './Nelyx/src/ui/frame.ts';
import {Paint} from './Nelyx/src/ui/paint.ts';
import {CustomPaint} from './Nelyx/src/framework/widgets/custom-paint.ts';
import {CustomPainter} from './Nelyx/src/framework/rendering/custom-paint.ts';
import {RawGestureDetector,GestureRecognizerFactoryWithHandlers} from './Nelyx/src/framework/widgets/raw-gesture-detector.ts';
import {TapGestureRecognizer} from './Nelyx/src/framework/gestures/tap.ts';
import {PageController,PageView,PageMetrics} from './Nelyx/src/framework/widgets/page-view.ts';
import {Axis} from './Nelyx/src/framework/painting/basic-types.ts';
import {RenderSliverFillViewport} from './Nelyx/src/framework/rendering/sliver-fill.ts';
import {LayoutBuilder} from './Nelyx/src/framework/widgets/layout-builder.ts';
import {ListView,GridView} from './Nelyx/src/framework/widgets/scroll-view.ts';
import {ScrollController} from './Nelyx/src/framework/widgets/scroll-controller.ts';
import {RenderSliverList} from './Nelyx/src/framework/rendering/sliver-list.ts';
import {RenderSliverGrid,SliverGridDelegate,SliverGridRegularTileLayout} from './Nelyx/src/framework/rendering/sliver-grid.ts';
import {PaintingContext} from './Nelyx/src/framework/painting/context.ts';
import {PageStorage,PageStorageBucket,PageStorageKey} from './Nelyx/src/framework/widgets/page-storage.ts';
import {Curves} from './Nelyx/src/framework/animation/curves.ts';
const trace=[];
FlutterError.onError=(details)=>{throw details.exception;};
FoundationPlatform.configure({kind:'native',operatingSystem:'windows'});
class TestBox extends RenderBox {
  protected performLayout(constraints){trace.push('layout');return constraints.constrain({width:80,height:60});}
  paint(context){trace.push('paint');const p=new Paint();p.color=0xff126734;context.drawRect({x:0,y:0,...this.size},p);}
  protected hitTestSelf(){return true;}
  handleEvent(event,entry){trace.push(event.constructor.name);super.handleEvent(event,entry);}
}
class TestWidget extends LeafRenderObjectWidget {createRenderObject(){return new TestBox();}}
class Painter extends CustomPainter {
  paint(canvas,size){trace.push('custom-paint');const p=new Paint();p.color=0xff123456;canvas.drawRect({x:1,y:2,width:3,height:4},p);}
  hitTest(){trace.push('custom-hit-test');return false;}
  shouldRepaint(){return false;}
}
function harness(child,direction='ltr'){
  let now=0,sequence=0,status='open',rootElement;
  const owner={id:'source-test',generation:1};
  let metrics={logicalWidth:120,logicalHeight:80,physicalWidth:120,physicalHeight:80,scale:1,viewportGeneration:1,rendererGeneration:1,nativeContextGeneration:null,nativeSurfaceGeneration:null};
  const resources=new ResourceRegistry(),errors=[];
  const context={owner,resources,assets:new Map(),text:{layout(){throw Error('Unexpected text service use');}},clock:{now:()=>now},editing:{capabilities:{},dispose(){}},semantics:{capability:'unavailable',bind(){throw Error('Unavailable semantics transport used');},dispose(){}},readMetrics:()=>metrics,readStatus:()=>status,requestFrame(){},reportError:(error)=>errors.push(error)};
  const view=new FrameworkRoot(context,{id:'source-test',createRoot:()=>new Directionality(direction,new Builder(context=>{rootElement=context;return child;}))});
  const frame=()=>{now+=16;const result=view.build({token:{owner,metrics,sequence:++sequence},resources});try{return [...result.commands];}finally{releaseSceneFrameSource(result);}};
  return {view,frame,errors,update(next){child=next;rootElement.markNeedsBuild();},resize(width,height){metrics={...metrics,logicalWidth:width,logicalHeight:height,physicalWidth:width,physicalHeight:height,viewportGeneration:metrics.viewportGeneration+1};},pointer(kind,pointer=1,x=10,y=10){now+=5;view.pointer({kind,pointer,x,y,device:'touch',buttons:kind==='up'?0:1,timestamp:now,viewportGeneration:metrics.viewportGeneration});},close(){status='closing';view.dispose();resources.dispose();assert.deepEqual(errors,[]);}};
}
// Arbitrary subclasses execute layout/paint/hit and a custom recognizer enters the Source arena.
class UserTap extends TapGestureRecognizer {
  acceptGesture(pointer){trace.push('arena-accept');super.acceptGesture(pointer);}
}
const custom=new Builder(context=>new RawGestureDetector(new CustomPaint(new TestWidget(),{foregroundPainter:new Painter()}),{gestures:new Map([[UserTap,new GestureRecognizerFactoryWithHandlers(UserTap,()=>new UserTap({binding:context.owner.gestureBinding}),r=>{r.onTap=()=>trace.push('tap');})]])}));
const first=harness(custom);
try{
  const commands=first.frame();
  assert(trace.indexOf('layout')<trace.indexOf('paint'),'Source layout did not precede paint');
  assert(trace.includes('custom-paint'),'Unregistered CustomPainter did not execute');
  assert(commands.some(c=>c.op==='drawRect'&&c.rect.width===3),'Custom canvas command did not reach the frame');
  first.pointer('down');first.pointer('up');await Promise.resolve();
  assert(trace.includes('custom-hit-test'),'Custom painter hit hook was bypassed');
  assert(trace.includes('arena-accept')&&trace.includes('tap'),'Custom Source recognizer did not win the arena');
  first.pointer('down',2);first.pointer('cancel',2);await Promise.resolve();
  assert.equal(trace.filter(s=>s==='tap').length,1,'Canceled pointer synthesized a tap');
}finally{first.close();}
// LayoutBuilder consumes the real layout constraints and its descendants keep their build scope.
let layoutBuilds=0,descendantBuilds=0,layoutElement,descendantElement;
const layout=harness(new LayoutBuilder((context,constraints)=>{
  layoutElement=context;++layoutBuilds;assert.equal(constraints.maxHeight,80);
  return new Builder(context=>{descendantElement=context;++descendantBuilds;return new TestWidget();});
}));
try{
  layout.frame();assert.equal(layoutBuilds,1);assert.equal(descendantBuilds,1);
  layout.frame();assert.equal(layoutBuilds,1,'Clean layout reran its builder');
  descendantElement.markNeedsBuild();layout.frame();assert.equal(layoutBuilds,1);assert.equal(descendantBuilds,2,'Scoped descendant rebuild was lost');
  layoutElement.markNeedsBuild();layout.frame();assert.equal(layoutBuilds,2);
  layout.resize(140,80);layout.frame();assert.equal(layoutBuilds,3,'Changed constraints did not reach LayoutBuilder');
}finally{layout.close();}
// The original PagePosition conversion must survive zero-size layout and delayed page commands.
const cases=[];
for(const fraction of [0.5,1,1.5])for(const [axis,direction,reverse] of [[Axis.horizontal,'ltr',false],[Axis.horizontal,'rtl',false],[Axis.horizontal,'ltr',true],[Axis.vertical,'ltr',true]]){
  const controller=new PageController({initialPage:2,viewportFraction:fraction}),changes=[];
  const view=harness(new PageView({controller,scrollDirection:axis,reverse,children:Array.from({length:8},()=>new TestWidget()),onPageChanged:p=>changes.push(p)}),direction);
  const dimension=axis===Axis.horizontal?120:80;
  try{
    view.frame();
    assert.equal(controller.page,2,'Initial page was not established');
    const expected=2*dimension*fraction+Math.max(0,dimension*(fraction-1)/2);
    assert.equal(controller.position.pixels,expected,'Page fraction/initial offset differs');
    assert(controller.position.copyWith() instanceof PageMetrics,'Scroll notification lost PageMetrics');
    const visit=(node)=>{if(node instanceof RenderSliverFillViewport)return true;return node.children.some(visit);};
    assert(visit(view.view.pipeline.root),'PageView did not execute Source SliverFillViewport');
    controller.jumpToPage(3);view.frame();assert.equal(controller.page,3);
    assert.deepEqual(changes,[3],'onPageChanged count/order differs');
    view.resize(axis===Axis.horizontal?0:120,axis===Axis.vertical?0:80);view.frame();
    controller.jumpToPage(4);assert.equal(controller.page,4,'Zero-size viewport lost the cached page');
    view.resize(120,80);view.frame();assert.equal(controller.page,4,'Resize did not restore the cached page');
    cases.push({fraction,axis:axis===Axis.horizontal?'horizontal':'vertical',direction,reverse,pixels:controller.position.pixels,page:controller.page});
  }finally{view.close();assert(!controller.hasClients,'Source disposal left an attached position');controller.dispose();}
}
// Recreated scroll owners restore page units; controller transfer preserves the attached position.
const lifecycle=[];
const pageChildren=()=>Array.from({length:8},()=>new TestWidget());
for(const keepPage of [true,false]){
  const bucket=new PageStorageBucket(),controller=new PageController({initialPage:1,keepPage,viewportFraction:0.5});
  const make=()=>new PageStorage({bucket,child:new PageView({key:new PageStorageKey('pages'),controller,children:pageChildren()})});
  const view=harness(make());
  try{view.frame();controller.jumpToPage(3);view.frame();view.update(new SizedBox());view.frame();assert(!controller.hasClients);view.update(make());view.frame();lifecycle.push({kind:'storage',keepPage,page:controller.page,pixels:controller.offset});}
  finally{view.close();controller.dispose();}
}
{
  const events=[],first=new PageController({initialPage:2,onAttach:()=>events.push('first-attach'),onDetach:()=>events.push('first-detach')}),second=new PageController({initialPage:0,viewportFraction:0.5,onAttach:()=>events.push('second-attach'),onDetach:()=>events.push('second-detach')});
  const make=controller=>new PageView({controller,children:pageChildren()});const view=harness(make(first));
  try{view.frame();first.jumpToPage(3);view.frame();view.update(make(second));view.frame();assert(!first.hasClients);lifecycle.push({kind:'transfer',page:second.page,pixels:second.offset,events:[...events]});}
  finally{view.close();first.dispose();second.dispose();}
}
{
  const controller=new PageController(),view=harness(new PageView({controller,children:pageChildren()}));
  try{view.frame();const done=controller.animateToPage(4,{duration:200,curve:Curves.linear});view.frame();controller.jumpToPage(1);view.frame();await done;lifecycle.push({kind:'interrupt',page:controller.page,pixels:controller.offset,scrolling:controller.position.isScrollingNotifier.value});}
  finally{view.close();controller.dispose();}
}
for(const empty of [false,true]){
  const controller=new PageController({viewportFraction:0.5}),view=harness(new PageView({controller,padEnds:false,children:empty?[]:pageChildren()}));
  try{view.frame();lifecycle.push({kind:empty?'empty':'no-padding',page:controller.page,pixels:controller.offset,min:controller.position.minScrollExtent,max:controller.position.maxScrollExtent});}
  finally{view.close();controller.dispose();}
}
// A variable-height list and an arbitrary grid delegate execute the same Source child manager.
const slivers=[];
function findRender(node,type){if(node instanceof type)return node;for(const child of node.children){const found=findRender(child,type);if(found)return found;}return null;}
function recordSliver(view,controller,type,kind){
  const render=findRender(view.view.pipeline.root,type);assert(render,'Source sliver was replaced');
  const rows=[];for(let child=render.firstChild;child!==null;child=render.childAfter(child))rows.push({index:render.indexOf(child),offset:child.parentData.layoutOffset,height:child.size.height,cross:child.parentData.crossAxisOffset??0});
  return {kind,pixels:controller.offset,max:controller.position.maxScrollExtent,rows};
}
const extents=[17,43,29,61,23,37,52,31],listController=new ScrollController();
const list=harness(ListView.builder({controller:listController,cacheExtent:0,itemCount:extents.length,itemBuilder:(_context,index)=>new SizedBox(undefined,extents[index],new TestWidget())}));
try{list.frame();listController.jumpTo(60);list.frame();listController.jumpTo(200);list.frame();slivers.push(recordSliver(list,listController,RenderSliverList,'variable-list'));}
finally{list.close();assert(!listController.hasClients);listController.dispose();}
class UserGridDelegate extends SliverGridDelegate{
  calls=0;getLayout(constraints){++this.calls;assert.equal(constraints.crossAxisExtent,120);return new SliverGridRegularTileLayout({crossAxisCount:2,mainAxisStride:40,crossAxisStride:60,childMainAxisExtent:35,childCrossAxisExtent:55,reverseCrossAxis:false});}
  shouldRelayout(){return false;}
}
const delegate=new UserGridDelegate(),gridController=new ScrollController();
const grid=harness(GridView.builder({controller:gridController,cacheExtent:0,gridDelegate:delegate,itemCount:10,itemBuilder:()=>new TestWidget()}));
try{grid.frame();gridController.jumpTo(65);grid.frame();assert(delegate.calls>0,'Custom delegate was bypassed');slivers.push(recordSliver(grid,gridController,RenderSliverGrid,'custom-grid'));}
finally{grid.close();assert(!gridController.hasClients);gridController.dispose();}
// A compositing change propagates through the same render tree before paint.
class CompositedBox extends TestBox {composite=false;get alwaysNeedsCompositing(){return this.composite;}}
const pipeline=new PipelineOwner(),parent=new TestBox(),child=new CompositedBox();parent.setChildren([child]);pipeline.setRoot(parent);
try{
  pipeline.flushLayout({width:120,height:80});pipeline.flushCompositingBits();assert(!parent.needsCompositing);
  child.composite=true;child.markNeedsCompositingBitsUpdate();pipeline.flushCompositingBits();assert(parent.needsCompositing&&child.needsCompositing);
  parent.remove(child);pipeline.flushCompositingBits();assert(!parent.needsCompositing,'Removed child retained compositing bits');
}finally{pipeline.setRoot(undefined);pipeline.dispose();parent.dispose();child.dispose();}
// Every clip mode, including the noncomposited saveLayer path, is observable drawing.
for(const behavior of ['none','hardEdge','antiAlias','antiAliasWithSaveLayer']){
  const context=new PaintingContext();
  try{context.pushClipRect(false,{x:2,y:3},{x:4,y:5,width:10,height:20},()=>context.drawRect({x:1,y:2,width:3,height:4},new Paint()),{clipBehavior:behavior});
    const clips=context.commands.filter(c=>c.op==='clipRect');assert.equal(clips.length,behavior==='none'?0:1);
    if(clips.length){assert.equal(clips[0].rect.x,6);assert.equal(clips[0].doAntiAlias,behavior!=='hardEdge');}
    assert.equal(context.commands.filter(c=>c.op==='saveLayer').length,behavior==='antiAliasWithSaveLayer'?1:0);
  }finally{context.dispose();}
}
if(ORIGINAL_PAGE_EXPECTATIONS!==null)assert.deepEqual(cases,ORIGINAL_PAGE_EXPECTATIONS,'Pinned Flutter PageView observations differ');
if(ORIGINAL_SLIVER_EXPECTATIONS!==null)assert.deepEqual(slivers,ORIGINAL_SLIVER_EXPECTATIONS,'Pinned Flutter list/grid observations differ');
if(ORIGINAL_LIFECYCLE_EXPECTATIONS!==null)assert.deepEqual(lifecycle,ORIGINAL_LIFECYCLE_EXPECTATIONS,'Pinned Flutter PageView lifecycle observations differ');
console.log('SOURCE_FRAMEWORK',JSON.stringify({result:'PASS-scoped',originalComparison:ORIGINAL_PAGE_EXPECTATIONS===null?'not-run':'PASS-scoped',cases:cases.length+slivers.length+lifecycle.length,scope:'Source layout/paint/hit/arena/build scope; PageView geometry/storage/transfer/interruption/empty; variable list; custom grid; compositing; clip commands',pages:cases,slivers,lifecycle}));
`,
    },
    bundle: true,
    write: false,
    platform: 'node',
    format: 'esm',
    target: 'node24',
    logLevel: 'silent',
  });
  try {
    const file = path.join(temporary, 'fixture.mjs');
    fs.writeFileSync(file, bundle.outputFiles[0].contents);
    await import(pathToFileURL(file).href);
  } catch (error) {
    console.error(error.stack?.split('\n').slice(0, 8).join('\n') ?? error.message);
    process.exitCode = 1;
  }
}
