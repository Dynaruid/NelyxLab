// SPDX-License-Identifier: BSD-3-Clause
import { build } from 'esbuild';
import path from 'node:path';
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
import { execute } from '../sdk/tooling/cli/src/commands.mjs';
const root = path.resolve(import.meta.dirname, '../..');
const oracleIndex = process.argv.indexOf('--oracle');
const oracleFile = oracleIndex < 0 ? null : process.argv[oracleIndex + 1];
const hermesLowering = process.argv.includes('--hermes-lowering');
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
        ...(hermesLowering ? ['--hermes-lowering'] : []),
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
      ORIGINAL_LAYOUT_QUEUE_EXPECTATIONS: JSON.stringify(
        oracleFile ? (JSON.parse(fs.readFileSync(oracleFile, 'utf8')).layoutQueues ?? null) : null,
      ),
      ORIGINAL_LAYOUT_QUERY_EXPECTATIONS: JSON.stringify(
        oracleFile ? (JSON.parse(fs.readFileSync(oracleFile, 'utf8')).layoutQueries ?? null) : null,
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
import {BoxConstraints} from './Nelyx/src/framework/rendering/constraints.ts';
import {ParagraphBuilder} from './Nelyx/src/ui/paragraph-builder.ts';
import {ParagraphStyle} from './Nelyx/src/ui/paragraph-style.ts';
import {ParagraphConstraints} from './Nelyx/src/ui/paragraph-constraints.ts';
import {freezeTextInput,ownedTextInputSerialization,serializeTextInput} from './Nelyx/src/ui/text.ts';
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
import {FocusManager,FocusNode,FocusScopeNode} from './Nelyx/src/framework/widgets/focus.ts';
const trace=[];
FlutterError.onError=(details)=>{throw details.exception;};
FoundationPlatform.configure({kind:'native',operatingSystem:'windows'});
// Focus child snapshots retain their old ordered membership across moves and
// retirement, while traversal still calls a subclass's live children getter.
const focusManager=new FocusManager(),otherFocusManager=new FocusManager();
let focusChildReads=0;
class ObservedFocusScope extends FocusScopeNode{get children(){focusChildReads++;return super.children;}}
const focusScope=new ObservedFocusScope(),focusA=new FocusNode(),focusB=new FocusNode();
try{
  focusManager.add(focusA);const initial=focusManager.rootScope.children;
  focusManager.add(focusB);assert.deepEqual(initial,[focusA]);
  const siblings=focusManager.rootScope.children;assert.deepEqual(siblings,[focusA,focusB]);
  assert(Object.isFrozen(initial));assert.throws(()=>initial.push(focusB),TypeError);
  focusManager.remove(focusA);assert.deepEqual(focusManager.rootScope.children,[focusB]);
  focusManager.add(focusScope);focusScope.autofocus(focusA);await Promise.resolve();
  assert.deepEqual(focusScope.children,[focusA]);assert.equal(focusA.parent,focusScope);
  assert.deepEqual(siblings,[focusA,focusB]);
  const childSnapshot=focusScope.children,reads=focusChildReads;
  assert.deepEqual(focusScope.descendants,[focusA]);assert(focusChildReads>reads,'Virtual focus children getter was bypassed');
  assert.throws(()=>otherFocusManager.add(focusA));assert.deepEqual(focusScope.children,[focusA]);
  focusA.dispose();assert.deepEqual(focusScope.children,[]);assert.deepEqual(childSnapshot,[focusA]);
  focusB.dispose();assert.deepEqual(focusManager.rootScope.children,[focusScope]);
}finally{focusA.dispose();focusB.dispose();focusScope.dispose();focusManager.dispose();otherFocusManager.dispose();}
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
// Layout batches preserve depth/order, callback membership and retry ownership.
const layoutOrder=[],layoutQueues=[];
class QueueBox extends RenderBox {
  constructor(name){super();this.name=name;}
  action;
  admissionAction;
  suppressed=false;
  get layoutSuppressedByAncestor(){this.admissionAction?.();return this.suppressed||super.layoutSuppressedByAncestor;}
  performLayout(c){layoutOrder.push(this.name);this.action?.();for(const child of this.children)child.layout(BoxConstraints.tight({width:10,height:10}));return c.smallest;}
}
const queueOwner=new PipelineOwner({accessibilityEnabled:false}),queueRoot=new QueueBox('root'),queueLeft=new QueueBox('left'),queueRight=new QueueBox('right'),queueLeaf=new QueueBox('leaf');
queueLeft.setChildren([queueLeaf]);queueRoot.setChildren([queueLeft,queueRight]);queueOwner.setRoot(queueRoot);
try{
  queueOwner.flushLayout({width:120,height:80});layoutOrder.length=0;
  queueRight.markNeedsLayout();queueLeft.markNeedsLayout();queueOwner.requestLayoutCallback(queueLeft);queueOwner.flushLayout();
  assert.deepEqual(layoutOrder,['right','left'],'Equal-depth queue order or duplicate callback changed');
  layoutQueues.push([...layoutOrder]);
  layoutOrder.length=0;queueLeaf.markNeedsLayout();queueLeft.markNeedsLayout();queueOwner.flushLayout();
  assert.deepEqual(layoutOrder,['left','leaf'],'Parent must cover a child without duplicate layout');
  layoutQueues.push([...layoutOrder]);
  layoutOrder.length=0;let reenter=true;queueLeft.action=()=>{if(reenter){reenter=false;queueLeft.markNeedsLayout();queueOwner.requestLayoutCallback(queueLeft);}};
  queueLeft.markNeedsLayout();queueOwner.flushLayout();assert.deepEqual(layoutOrder,['left','left']);queueLeft.action=undefined;
  layoutOrder.length=0;let fail=true;queueLeft.action=()=>{if(fail){fail=false;throw Error('queued layout failed');}};
  queueLeft.markNeedsLayout();queueRight.markNeedsLayout();queueOwner.requestLayoutCallback(queueRight);
  assert.throws(()=>queueOwner.flushLayout(),/queued layout failed/);assert(queueRight.needsLayout);
  queueOwner.flushLayout();assert.deepEqual(layoutOrder,['left','left','right'],'Failure lost pending siblings');queueLeft.action=undefined;
  layoutOrder.length=0;let admit=true;queueLeaf.admissionAction=()=>{if(admit){admit=false;queueRight.markNeedsLayout();}};
  queueLeaf.markNeedsLayout();queueOwner.flushLayout();assert.deepEqual(layoutOrder,['leaf','right'],'Admission hook changed the current batch membership');queueLeaf.admissionAction=undefined;
  layoutOrder.length=0;queueRight.suppressed=true;queueRight.markNeedsLayout();queueOwner.requestLayoutCallback(queueRight);queueOwner.flushLayout();assert.deepEqual(layoutOrder,[]);
  queueRight.suppressed=false;queueOwner.flushLayout();assert.deepEqual(layoutOrder,['right'],'Covered callback was lost');
  layoutOrder.length=0;queueRight.markNeedsLayout();queueRoot.remove(queueRight);queueOwner.flushLayout();assert(!layoutOrder.includes('right'),'Detached queued node was laid out');
}finally{queueOwner.setRoot(undefined);queueOwner.dispose();queueRoot.setChildren([]);queueLeft.setChildren([]);for(const node of [queueRoot,queueLeft,queueRight,queueLeaf])node.dispose();}
// Measurement cache hits, dependency invalidation, null baselines and failure
// recovery must keep their public semantics when the query dispatch changes.
class QueryBox extends RenderBox {
  intrinsicCalls=0;dryCalls=0;baselineCalls=0;extra=10;fail=false;cycle=false;
  computeMinIntrinsicWidth(height){++this.intrinsicCalls;if(this.fail)throw Error('query failed');if(this.cycle)return this.getMinIntrinsicWidth(height+1);return height+this.extra;}
  computeMaxIntrinsicWidth(height){return this.getMinIntrinsicWidth(height)+1;}
  computeDryLayout(constraints){++this.dryCalls;return constraints.constrain({width:15,height:25});}
  computeDryBaseline(){return null;}
  performLayout(constraints){return constraints.constrain({width:15,height:25});}
  computeDistanceToActualBaseline(){++this.baselineCalls;return this.size.height/2;}
}
const queryBox=new QueryBox(),queryConstraints=new BoxConstraints(0,100,0,100),layoutQueries=[];
try{
  layoutQueries.push(queryBox.getMinIntrinsicWidth(20),queryBox.getMinIntrinsicWidth(20));
  assert.equal(queryBox.intrinsicCalls,1);assert.equal(queryBox.getMaxIntrinsicWidth(20),31);
  queryBox.extra=15;queryBox.markNeedsLayout();layoutQueries.push(queryBox.getMinIntrinsicWidth(20));
  const dry=queryBox.getDryLayout(queryConstraints);assert.deepEqual(queryBox.getDryLayout(new BoxConstraints(0,100,0,100)),dry);assert.equal(queryBox.dryCalls,1);
  layoutQueries.push(dry.width,dry.height,queryBox.getDryBaseline(queryConstraints,'alphabetic'));
  queryBox.layout(queryConstraints);layoutQueries.push(queryBox.getDistanceToBaseline('alphabetic',{onlyReal:true}),queryBox.getDistanceToBaseline('alphabetic',{onlyReal:true}));assert.equal(queryBox.baselineCalls,1);
  assert.deepEqual(layoutQueries.slice(6),[12.5,12.5]);
  queryBox.markNeedsLayout();queryBox.fail=true;assert.throws(()=>queryBox.getMinIntrinsicWidth(21),/query failed/);
  queryBox.fail=false;assert.equal(queryBox.getMinIntrinsicWidth(21),36,'Failed query poisoned its cache/stack');
  queryBox.cycle=true;assert.throws(()=>queryBox.getMinIntrinsicWidth(22),/recursively requested/);
  queryBox.cycle=false;assert.equal(queryBox.getMinIntrinsicWidth(22),37);
  queryBox.computeDryLayout=()=>queryBox.size;queryBox.markNeedsLayout();assert.throws(()=>queryBox.getDryLayout(queryConstraints),/cannot read wet size/);
}finally{queryBox.dispose();}
const dependent=new QueryBox(),measurementChild=new QueryBox();dependent.setChildren([measurementChild]);
dependent.computeMinIntrinsicWidth=height=>measurementChild.getMinIntrinsicWidth(height)+1;
try{assert.equal(dependent.getMinIntrinsicWidth(10),21);measurementChild.extra=20;measurementChild.markNeedsLayout();assert.equal(dependent.getMinIntrinsicWidth(10),31,'Cached query lost its dependency');}
finally{dependent.setChildren([]);dependent.dispose();measurementChild.dispose();}
// Source requests reuse immutable captures without bypassing locale/width/hooks.
const textRegistry=new ResourceRegistry(),textFont=textRegistry.allocateId('capture-font'),capturedText=[];
textRegistry.register({...textFont,kind:'font'},()=>{});textRegistry.bindResource(textFont);
const captureText={layout(input){const snapshot=freezeTextInput(input);capturedText.push(snapshot);const resource=textRegistry.allocateId('capture-paragraph');textRegistry.register({...resource,kind:'paragraph'},()=>{});return {resource,input:snapshot,indexUnit:'utf16',width:0,height:0,alphabeticBaseline:0,ideographicBaseline:0,minIntrinsicWidth:0,maxIntrinsicWidth:0,longestLine:0,overflow:false,unresolvedGlyphs:0,lines:[]};}};
let localeCalls=0,localeName='ko-KR';const locale={toString(){++localeCalls;return localeName;}};
const textBuilder=new ParagraphBuilder(new ParagraphStyle({locale}),{text:captureText,resources:textRegistry,font:textFont,scale:1});textBuilder.addText('한글 😀');const sourceParagraph=textBuilder.build();
try{
  const beforeLocale=localeCalls;sourceParagraph.layout(new ParagraphConstraints({width:120}));sourceParagraph.layout(new ParagraphConstraints({width:120}));
  assert.equal(capturedText[0],capturedText[1],'Same Source request was recaptured');assert.equal(localeCalls,beforeLocale+2,'Locale hooks were memoized');
  sourceParagraph.layout(new ParagraphConstraints({width:100}));assert.notEqual(capturedText[1],capturedText[2]);assert.equal(capturedText[2].width,100);
  localeName='en-US';sourceParagraph.layout(new ParagraphConstraints({width:100}));assert.equal(capturedText[3].locale,'en-US');
  assert.throws(()=>sourceParagraph.layout(new ParagraphConstraints({width:NaN})),/width/);assert.equal(sourceParagraph.width,0,'Failed capture replaced the completed producer');
  let reads=0;const external=Object.freeze({...capturedText[0],get fontSize(){++reads;return 14;}});freezeTextInput(external);const firstReads=reads;freezeTextInput(external);assert(reads>firstReads,'Public getters were cached');
  assert(ownedTextInputSerialization(capturedText[0])!==undefined);let jsonCalls=0;
  Object.defineProperty(Object.prototype,'toJSON',{configurable:true,value(){++jsonCalls;return this;}});
  try{assert.equal(ownedTextInputSerialization(capturedText[0]),undefined);serializeTextInput(capturedText[0]);assert(jsonCalls>0,'Prototype serialization hook was hidden');
    sourceParagraph.layout(new ParagraphConstraints({width:100}));sourceParagraph.layout(new ParagraphConstraints({width:100}));
    assert.notEqual(capturedText.at(-1),capturedText.at(-2),'Prototype hooks reused a previous capture identity');
  }finally{delete Object.prototype.toJSON;}
}finally{sourceParagraph.dispose();textRegistry.dispose();}
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
if(ORIGINAL_LAYOUT_QUEUE_EXPECTATIONS!==null)assert.deepEqual(layoutQueues,ORIGINAL_LAYOUT_QUEUE_EXPECTATIONS,'Pinned Flutter layout queue observations differ');
if(ORIGINAL_LAYOUT_QUERY_EXPECTATIONS!==null)assert.deepEqual(layoutQueries.slice(0,6),ORIGINAL_LAYOUT_QUERY_EXPECTATIONS,'Pinned Flutter intrinsic/dry measurement observations differ');
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
    let contents = bundle.outputFiles[0].text;
    if (hermesLowering) {
      const load = createRequire(import.meta.url),
        transformer = load('../sdk/tooling/metro/src/native-hermes-transformer.cjs'),
        transformed = transformer.transform({
          src: contents,
          filename: path.join(root, 'source-framework-fixture.mjs'),
          options: {
            projectRoot: root,
            platform: 'windows',
            dev: false,
            hot: false,
            experimentalImportSupport: true,
            customTransformOptions: { nelyxTemporalRefOptimization: true },
          },
        });
      const counts = transformed.metadata?.nelyxTemporalRefs;
      if (!counts?.removed) throw Error('Source Hermes lowering exercised no TDZ pruning');
      contents = load('@babel/core').transformFromAstSync(transformed.ast, contents, {
        configFile: false,
        babelrc: false,
        ast: false,
        code: true,
      }).code;
      try {
        load('@babel/core').parseSync(contents, {
          configFile: false,
          babelrc: false,
          sourceType: 'module',
        });
      } catch (error) {
        throw new Error(
          'Invalid Hermes fixture JavaScript: ' +
            error.message.split('\n')[0] +
            '\n' +
            contents.slice(Math.max(0, error.pos - 100), error.pos + 100),
        );
      }
      console.log('SOURCE_HERMES_LOWERING ' + JSON.stringify(counts));
    }
    fs.writeFileSync(file, contents);
    await import(pathToFileURL(file).href);
  } catch (error) {
    console.error(error.stack?.split('\n').slice(0, 8).join('\n') ?? error.message);
    process.exitCode = 1;
  }
}
