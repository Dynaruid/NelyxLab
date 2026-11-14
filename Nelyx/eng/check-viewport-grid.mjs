// SPDX-License-Identifier: BSD-3-Clause
import { build } from 'esbuild';
import fs from 'node:fs';
import assert from 'node:assert/strict';
import ts from 'typescript';
import { format } from 'oxfmt';
const watchdog = setTimeout(() => {
  throw Error('Viewport grid checks exceeded 20 minutes');
}, 1_200_000);
const stackTraceLimit = Error.stackTraceLimit;
Error.stackTraceLimit = 0;
try {
  // Verify the exact adapter emitted by the generator without requiring a
  // different Dart SDK to rerun the unrelated source analyzer.
  const generator = ts.createSourceFile(
    'generator.ts',
    fs.readFileSync('tools/Nelyx.FrameworkToTypeScript/generate-date-picker.ts', 'utf8'),
    ts.ScriptTarget.Latest,
  );
  let adapter;
  const visit = (node) => {
    if (
      ts.isNoSubstitutionTemplateLiteral(node) &&
      node.text.includes(
        'registerNativeRegularGridDelegate(_DayPickerGridDelegate.prototype, (delegate)',
      )
    )
      adapter = node.text;
    ts.forEachChild(node, visit);
  };
  visit(generator);
  assert(adapter, 'Generator omitted the viewport grid policy');
  const formatOptions = JSON.parse(fs.readFileSync('.oxfmtrc.json', 'utf8'));
  delete formatOptions.$schema;
  const formatted = await format('adapter.ts', adapter, formatOptions);
  assert.equal(formatted.errors.length, 0);
  assert(
    fs
      .readFileSync(
        'packages/material/src/generated/date/calendar_date_picker.generated.ts',
        'utf8',
      )
      .endsWith(formatted.code),
  );
  const result = await build({
    stdin: {
      resolveDir: process.cwd(),
      loader: 'ts',
      contents: `
import assert from 'node:assert/strict';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {EngineClient} from './Nelyx/runtime/engine-client/client.ts';
import {createWasmTransport} from './Nelyx/runtime/engine-client/wasm.ts';
import {protocol as p} from './Nelyx/runtime/engine-client/schema.ts';
import {response} from './Nelyx/runtime/engine-client/codec.ts';
import {OriginalWidgetHost} from './Nelyx/runtime/app/host.ts';
import {SceneWriter,SceneNode,SceneReference} from './Nelyx/runtime/engine-client/scene.ts';
import {viewportGridPrograms} from './Nelyx/runtime/app/grid.ts';
import {OriginalNativeRender} from './Nelyx/runtime/app/native-node.ts';
import {StatelessWidget,StatefulWidget,State} from '@nelyx/core/framework/widgets/framework';
import {GridView} from '@nelyx/core/framework/widgets/scroll-view';
import {SliverChildListDelegate} from '@nelyx/core/framework/widgets/scroll-delegate';
import {SizedBox} from '@nelyx/core/framework/widgets/basic';
import {Directionality,MediaQuery} from '@nelyx/core/framework/widgets/app-data';
import {ValueKey} from '@nelyx/core/foundation/key';
import {EdgeInsets} from '@nelyx/core/framework/painting/edge-insets';
import {FoundationPlatform} from '@nelyx/core/foundation/platform';
import {FlutterError} from '@nelyx/core/foundation/flutter-error';
import {AxisDirection} from '@nelyx/core/framework/painting/basic-types';
import {SliverConstraints,GrowthDirection} from '@nelyx/core/framework/rendering/sliver';
import {ScrollDirection} from '@nelyx/core/framework/rendering/viewport-offset';
import {ScrollController} from '@nelyx/core/framework/widgets/scroll-controller';
import {nativeViewportGridPolicy} from '@nelyx/core/internal/framework/rendering/native-grid';
import {_DayPickerGridDelegate} from './packages/material/src/generated/date/calendar_date_picker.generated.ts';
const factory=(await import(pathToFileURL(path.resolve('Nelyx/engine/dist/single-worker/engine.mjs')).href)).default;
const module=await factory(),transport=createWasmTransport(module),exchange=transport.exchange.bind(transport);
let closedState;
transport.exchange=async bytes=>{const output=await exchange(bytes);
  if(new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength).getUint16(p.headerFields.opcode,true)===p.opcodes.closeSession)closedState=response(output);
  return output;};
const client=await EngineClient.connect(transport),view=await client.openView(1);
const app=new OriginalWidgetHost(view,{pollEvents:false,onError:error=>{throw error;}}) as any;
FlutterError.onError=details=>{throw details.exception;};
FoundationPlatform.configure({kind:'native',operatingSystem:'windows'});
let clock=0,metricsEpoch=1n,commits=0,requests=0,settings,oracle,currentStates=new Map(),updates=0;
const controller=new ScrollController();
class Cell extends StatefulWidget {
  constructor(readonly index:number,readonly version:number){super(new ValueKey(index));}
  createState(){return new CellState();}
}
class CellState extends State<Cell> {
  override initState(){super.initState();currentStates.set(this.widget.index,this);}
  override didUpdateWidget(old:Cell){super.didUpdateWidget(old);++updates;}
  build(){return new SizedBox(1,1);}
}
class Grid extends StatelessWidget {
  build(context){
    const delegate=new _DayPickerGridDelegate(context),s=settings;
    oracle=delegate.getLayout(new SliverConstraints({axisDirection:AxisDirection.down,growthDirection:GrowthDirection.forward,
      userScrollDirection:ScrollDirection.idle,scrollOffset:0,precedingScrollExtent:0,overlap:0,remainingPaintExtent:s.height,
      crossAxisExtent:s.width,crossAxisDirection:s.rtl?AxisDirection.left:AxisDirection.right,
      viewportMainAxisExtent:s.height,remainingCacheExtent:s.height,cacheOrigin:0}));
    const policy=nativeViewportGridPolicy(delegate,s.count);
    assert.equal(!!policy,s.count<=49);
    // Instance hooks cannot opt into the registered numeric policy.
    const overridden=new _DayPickerGridDelegate(context);overridden.getLayout=delegate.getLayout.bind(delegate);
    assert.throws(()=>nativeViewportGridPolicy(overridden,s.count),/overridden/);
    return GridView.custom({controller,padding:EdgeInsets.zero,gridDelegate:delegate,
      childrenDelegate:new SliverChildListDelegate(Array.from({length:s.count},(_,i)=>new Cell(i,s.version)),{addRepaintBoundaries:false})});
  }
}
class Root extends StatelessWidget {
  build(context){return new MediaQuery({...MediaQuery.of(context),textScale:settings.scale},new Directionality(settings.rtl?'rtl':'ltr',new Grid()));}
}
const core=async(op,data?)=>{const state=await view.request(op,data);assert.equal(state.status,p.statuses.ok,'opcode '+op);return state;};
const commit=view.commit.bind(view);
view.commit=async(changes)=>{
  const receipt=await commit(changes);++commits;
  for(let i=0;i<32;i++){
    const s=await core(p.opcodes.contentStep,new Uint8Array(new Uint32Array([p.limits.contentPerStep,0]).buffer));
    if(s.layoutBuildPending){++requests;return receipt;}
    if(!s.preparation||s.preparationReady)break;
  }
  await core(p.opcodes.tick,new Uint8Array(new Float64Array([++clock]).buffer));
  const frame=await core(p.opcodes.takeFrame),done=new Uint8Array(24),fields=new DataView(done.buffer);
  for(const node of frame.nodes.filter(n=>n.kind===p.kinds.scrollViewport))
    assert(node.flags&p.nodeFlags.hardEdgeClip,'A fitted grid changed its declared hard-edge viewport into an antialiased clip');
  fields.setBigUint64(0,frame.submission,true);fields.setBigUint64(8,frame.device,true);
  await core(p.opcodes.releaseFrame,done);await core(p.opcodes.publish,done);return receipt;
};
const near=(a,b,label)=>assert(Math.abs(a-b)<1e-8,label+': '+a+' != '+b);
try {
  let cases=0;
  for(const s of [
    {width:344,height:336,scale:1,count:42,rtl:false},
    {width:344,height:105,scale:2,count:49,rtl:true},
    {width:720,height:320,scale:3,count:38,rtl:false},
    {width:333,height:601,scale:1.4,count:7,rtl:true},
    {width:344,height:336,scale:1,count:0,rtl:false},
  ]){
    settings={...s,version:++cases};
    const metrics=new Uint8Array(40),fields=new DataView(metrics.buffer);
    fields.setBigUint64(0,++metricsEpoch,true);fields.setFloat64(8,s.width,true);fields.setFloat64(16,s.height,true);fields.setFloat64(24,2,true);
    await core(p.opcodes.metrics,metrics);
    const before=commits;if(before)await app.update(new Root());else await app.mount(new Root());
    assert.equal(requests,0,'A fitted source grid waited for a LayoutBuilder/row reply');
    assert.equal(commits-before,1,'A fitted source grid required more than one transaction');
    const frame=await core(p.opcodes.layoutSnapshot);
    assert.equal(frame.document,frame.publishedDocument);
    const viewport=frame.nodes.find(n=>n.kind===p.kinds.scrollViewport);assert(viewport);
    near(viewport.width,s.width,'viewport width');near(viewport.height,s.height,'viewport height');near(viewport.scrollMaximum,0,'fitted scroll extent');
    const content=frame.nodes.find(n=>n.parent.slot===viewport.node.slot);
    const cells=frame.nodes.filter(n=>n.parent.slot===content.node.slot);
    assert.equal(cells.length,s.count);
    for(let i=0;i<cells.length;i++){
      const expected=oracle.getGeometryForChildIndex(i),cell=cells[i];
      near(cell.x,expected.crossAxisOffset,'cell x');near(cell.y,expected.scrollOffset,'cell y');
      near(cell.width,expected.crossAxisExtent,'cell width');near(cell.height,expected.mainAxisExtent,'cell height');
    }
    assert.equal([...controller.positions].length,1,'Grid lost its canonical controller attachment');
    if(s.count===42){
      const sourcePrograms=()=>{const result=new Map();const visit=render=>{if(render instanceof OriginalNativeRender&&render.options.layoutProgram)result.set(render,render.options.layoutProgram);for(const child of render.children)visit(child);};for(const root of app.root.renderObjects)visit(root);return result;};
      const identities=new Map(currentStates),programs=sourcePrograms();
      assert.equal(programs.size,2,'The actual Source viewport/tile programs were not inspected');
      for(const data of programs.values())assert(Object.isFrozen(data)&&Object.isFrozen(data.layout),'Layout program is not deeply owned');
      settings={...settings,version:99};
      await app.update(new Root());assert.equal(requests,0);
      const nextPrograms=sourcePrograms();assert.equal(nextPrograms.size,programs.size);
      for(const [render,data] of nextPrograms)assert.equal(data,programs.get(render),'Same GridView Element recreated an unchanged layout program');
      assert.equal(updates,42,'A new source child configuration was skipped');
      for(const [index,state] of identities)assert.equal(currentStates.get(index),state,'Keyed cell State was recreated');
    }
  }
  const badView=await client.openView(2),writer=new SceneWriter(badView,{pollEvents:false});
  try {
    const original=viewportGridPrograms({columns:7,rows:7,maximumRowExtent:48},2,false).viewport;
    const invalid={...original,children:2,layout:[...original.layout.slice(0,-1),
      {kind:'layout',child:1,target:0,values:[0,0,0,0]},
      {kind:'position',child:1,values:[0,0]},original.layout.at(-1)]};
    await assert.rejects(writer.mount(new SceneNode(new SceneReference(),'scrollViewport',[
      new SceneNode(new SceneReference(),'box'),new SceneNode(new SceneReference(),'box')
    ],{layoutProgram:invalid})),error=>error.status===p.statuses.invalidGraph,
    'A viewport program relaxed the single-content-child invariant');
    assert.equal(badView.documentEpoch,0n,'An invalid viewport program advanced its document');
  } finally {await writer.close();await badView.close();}
  console.log('Fitted source grid: real Core, exact generated getLayout oracle, resize/DPR2/text scale/RTL/partial/empty, one transaction, no builder reply, keyed State/update/controller, immutable policy and malformed viewport rejection PASS.');
} finally {
  await app.close();controller.dispose();await view.close();await client.close();
  assert.equal(closedState.status,p.statuses.ok);assert.equal(closedState.reservedBytes,0n);assert.equal(closedState.memory.total,0n);
}
`,
    },
    bundle: true,
    write: false,
    format: 'esm',
    platform: 'node',
    target: 'node24',
    logLevel: 'silent',
    loader: { '.sksl': 'text' },
  });
  await import(
    'data:text/javascript;base64,' + Buffer.from(result.outputFiles[0].contents).toString('base64')
  );
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  Error.stackTraceLimit = stackTraceLimit;
  clearTimeout(watchdog);
}
