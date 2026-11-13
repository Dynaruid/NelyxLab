// SPDX-License-Identifier: BSD-3-Clause
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { buildSync, transformSync } from 'esbuild';
import { windowsCompilerEnvironment } from '../sdk/tooling/cli/src/windows-static-hermes.mjs';
import {
  windowsHermesPolicy,
  windowsHermesSyntax,
} from '../sdk/tooling/cli/src/windows-hermes-policy.mjs';
import { nativeCohort } from '@nelyx/sdk/runtime/cohorts';
import { textStyleApplyReference } from './text-style-apply-reference.mjs';
const root = path.resolve(import.meta.dirname, '../..');
const parent = path.join(root, '.nelyx');
const temporary = fs.mkdtempSync(path.join(parent, 'hermes-syntax-'));
if (!temporary.startsWith(parent + path.sep)) throw Error('Temporary check escaped its owner');
const hermes = path.join(root, '.nelyx/windows-hermes');
const supply = path.join(root, 'Nelyx/engine/dist/windows-app-sdk');
const env = windowsCompilerEnvironment();
const compilerRequire = createRequire(
  path.join(root, 'Nelyx/sdk/tooling/cli/src/engine-v2-runner.mjs'),
);
const pathKey = Object.keys(env).find((k) => k.toLowerCase() === 'path') ?? 'PATH';
env[pathKey] = supply + path.delimiter + env[pathKey];
const run = (command, args) => {
  const result = spawnSync(command, args, {
    cwd: temporary,
    env,
    encoding: 'utf8',
    timeout: 1200000,
    windowsHide: true,
  });
  if (result.error || result.status)
    throw Error(`${command}: ${result.error ?? result.status}\n${result.stdout}${result.stderr}`);
  return result.stdout.trim();
};
try {
  fs.writeFileSync(
    path.join(temporary, 'check.cpp'),
    `
    #include <hermes/hermes.h>
    #include <jsi/jsi.h>
    #include <fstream>
    #include <iostream>
    #include <sstream>
    int main(int argc,char** argv){try{
      if(argc!=2)return 2;
      auto rt=facebook::hermes::makeHermesRuntime(::hermes::vm::RuntimeConfig::Builder().withMicrotaskQueue(true).withES6BlockScoping(true).build());
      std::ifstream file(argv[1],std::ios::binary);std::stringstream data;data<<file.rdbuf();
      rt->evaluateJavaScript(std::make_shared<facebook::jsi::StringBuffer>(data.str()),"syntax.hbc");
      rt->drainMicrotasks();
      std::cout<<rt->global().getProperty(*rt,"result").getString(*rt).utf8(*rt)<<"\\n";
    }catch(const facebook::jsi::JSError& e){std::cerr<<e.getStack()<<"\\n";return 1;}
    catch(const std::exception& e){std::cerr<<e.what()<<"\\n";return 1;}return 0;}
  `,
  );
  run('cl.exe', [
    '/nologo',
    '/std:c++20',
    '/EHsc',
    '/MD',
    '/O2',
    '/DJSI_USE_HERMES',
    '/DNDEBUG',
    '/I' + path.join(hermes, 'source/API'),
    '/I' + path.join(hermes, 'source/API/jsi'),
    '/I' + path.join(hermes, 'source/public'),
    'check.cpp',
    path.join(hermes, 'build/lib/hermesvm.lib'),
    path.join(hermes, 'build/jsi/jsi.lib'),
    '/Fe:check.exe',
  ]);
  // A small Widget graph cannot qualify module initialization of the real App.
  // This optional probe stops before launchApp, so it requires no native host.
  const applicationInit = process.argv.find((argument) =>
    argument.startsWith('--application-init='),
  );
  if (applicationInit) {
    const application = fs.readFileSync(
      path.resolve(applicationInit.slice('--application-init='.length)),
      'utf8',
    );
    const launch = 'launchApp(app_default);';
    assert.equal(application.split(launch).length, 2, 'Expected exactly one canonical App launch');
    const source = path.join(temporary, 'application-init.js');
    fs.writeFileSync(
      source,
      application.replace(launch, 'globalThis.result="App module initialization PASS";'),
    );
    let failed = false;
    for (const profile of ['debug', 'optimized']) {
      const bytecode = path.join(temporary, 'application-init-' + profile + '.hbc');
      run(path.join(supply, 'hermesc.exe'), [
        ...windowsHermesPolicy(profile, nativeCohort('windows')).flags,
        '-Xes6-block-scoping',
        '-emit-binary',
        '-out',
        bytecode,
        source,
      ]);
      try {
        console.log(profile + ': ' + run(path.join(temporary, 'check.exe'), [bytecode]));
      } catch (error) {
        failed = true;
        console.error(profile + ': ' + error.message);
      }
    }
    assert(!failed, 'The actual App module initialization failed in the pinned VM');
  }
  const liveNames = Array.from({ length: 650 }, (_, index) => 'live' + index);
  const classSpillFixture = `
    globalThis.spillValue=()=>({value:7});
    globalThis.spillObserve=(...values)=>{if(values.length!==650||values.some(value=>value.value!==7))throw Error('Class spill corrupted a live value');};
    (()=>{
      ${liveNames.map((name) => 'const ' + name + '=globalThis.spillValue();').join('\n')}
      const Implicit=diagnostic(class {});
      const Explicit=diagnostic(class {constructor(){}});
      const first=new Implicit(),second=new Explicit();
      check(first.describe()==='value'&&second.describe()==='value','wide-register class constructor/home-object spill');
      globalThis.spillObserve(${liveNames.join(',')});
    })();
    delete globalThis.spillValue;delete globalThis.spillObserve;
  `;
  const fixture = `
    const check=(ok,message)=>{if(!ok)throw Error(message);};
    const symbol=Symbol('key');let reads=0,setters=0;
    const source=Object.create({inherited:3});
    Object.defineProperties(source,{value:{enumerable:true,get(){++reads;return 7;}},hidden:{value:9},__proto__:{value:null}});
    Object.defineProperty(source,'__proto__',{enumerable:true,value:11});source[symbol]=13;
    const copy={...null,...undefined,...source,value:17};
    check(reads===1&&copy.value===17&&copy[symbol]===13&&!('inherited' in copy)&&!('hidden' in copy),'spread ownership/getters/symbols');
    check(Object.getPrototypeOf(copy)===Object.prototype&&Object.hasOwn(copy,'__proto__')&&copy.__proto__===11,'spread proto safety');
    const {value,...rest}=copy;
    check(value===17&&!Object.hasOwn(rest,'value')&&rest[symbol]===13,'rest exclusions');
    if(globalThis.nativeSyntax)check(Object.hasOwn(rest,'__proto__')&&rest.__proto__===11,'native rest proto safety');
    class Base {set value(v){++setters;}}
    class Child extends Base { value=21; next=this.value+1; static first=23; static next=this.first+1; }
    const child=new Child();const descriptor=Object.getOwnPropertyDescriptor(child,'value');
    check(setters===0&&child.next===22&&Child.next===24&&descriptor.enumerable&&descriptor.writable&&descriptor.configurable,'field define semantics and order');
    class Parent {constructor(v){this.v=v;} get doubled(){return this.v*2;} method(){return this.v+1;} static code(){return 31;} }
    const mixin=Type=>class extends Type {method(){return super.method()+2;} get doubled(){return super.doubled+1;}};
    class Mixed extends mixin(Parent) { field=this.method();static code(){return super.code()+1;} }
    const mixed=Reflect.construct(Mixed,[5]);
    check(mixed instanceof Mixed&&mixed instanceof Parent&&mixed.field===8&&mixed.doubled===11&&Mixed.code()===32,'mixin inheritance and Reflect.construct');
    class Entries extends Array {total(){return this.reduce((a,b)=>a+b,0);}}
    class Failure extends Error {code=17;}
    const entries=new Entries(2,3),failure=new Failure('expected');
    check(entries instanceof Array&&entries.total()===5&&failure instanceof Error&&failure.message==='expected'&&failure.code===17,'builtin subclass construction');
    if(globalThis.nativeClasses){
      const targets=[];
      class TargetBase {constructor(value){targets.push(new.target);this.value=value;}}
      class TargetChild extends TargetBase {}
      function AlternateTarget(){}
      const alternate=Reflect.construct(TargetChild,[37],AlternateTarget);
      check(targets[0]===AlternateTarget&&Object.getPrototypeOf(alternate)===AlternateTarget.prototype&&alternate.value===37,'custom new.target through implicit super');
      class ReplacementBase {constructor(value){targets.push(new.target);this.value=value+1;}}
      Object.setPrototypeOf(TargetChild,ReplacementBase);
      const replacement=new TargetChild(41);
      check(targets[1]===TargetChild&&replacement.value===42&&Object.getPrototypeOf(replacement)===TargetChild.prototype,'replacement superclass with original new.target');
      const returned={value:43};
      class ReturnsObject {constructor(){return returned;}}
      class UsesReturnedObject extends ReturnsObject {field=this.value+1;}
      check(new UsesReturnedObject()===returned&&returned.field===44,'super constructor replacement object and field order');
      let denied=false;try{Reflect.apply(TargetBase,TargetBase.prototype,[47]);}catch(error){denied=error instanceof TypeError;}
      check(denied,'native class call without new');
    }
    const diagnostic=Base=>class extends Base { describe(){return 'value';} };
    class First extends diagnostic(class {}) {}
    class Second extends diagnostic(class {}) { constructor(options={}){super();this.options=options;} }
    check(new First().describe()==='value'&&new Second().describe()==='value','anonymous empty mixin bases');
    ${classSpillFixture}
    let sum=0;const started=Date.now();
    for(let pass=0;pass<12;++pass) for(let i=0;i<1000;++i){
      const a={a:i,b:2,c:3,d:4,e:5,f:6,g:7,h:8};
      const b={...a,...{i:9},...{j:10},...{k:11},...{l:12},...{m:13},...{n:14},...{o:15}};
      const {a:leading,...tail}=b;sum+=leading+tail.o+new Child().next;
    }
    const elapsedMs=Date.now()-started;
    async function continuations() {
      const order=[];let reads=0;
      const receiver={base:7,async method(v){await 0;return this.base+v;}};
      const arrow=function(v){return (async()=>{await 0;return this.base+arguments[0];})();};
      check(await receiver.method(5)===12&&await arrow.call(receiver,6)===13,'async receiver/arrow arguments');
      const adopted=await {get then(){++reads;return resolve=>resolve(17);}};
      check(adopted===17&&reads===1,'await thenable adoption');
      async function failure(){try{await Promise.reject(19);}catch(error){order.push(error);}finally{await 0;order.push(23);}return 29;}
      check(await failure()===29&&order.join(',')==='19,23','async catch/finally/return');
      class AsyncBase {async value(){await 0;return 31;}}
      class AsyncChild extends AsyncBase {async value(){return (await super.value())+1;}}
      check(await new AsyncChild().value()===32,'async super');
      let synchronous=true;const pending=(async()=>{await 0;check(!synchronous,'await must suspend');})();
      synchronous=false;await pending;
      const values=await Promise.all([receiver.method(3),receiver.method(4)]);
      check(values.join(',')==='10,11','async concurrent completion');
      globalThis.result=JSON.stringify({sum,elapsedMs});
    }
    continuations();
  `;
  const outputs = {};
  for (const [name, supported] of [
    ['lowered', { bigint: true }],
    ['native', windowsHermesSyntax],
  ]) {
    const code = transformSync(
      'globalThis.nativeSyntax=' +
        String(name === 'native') +
        ';globalThis.nativeClasses=' +
        String(!process.argv.includes('--babel-classes')) +
        ';' +
        fixture,
      { target: 'es2015', supported, format: 'iife' },
    ).code;
    if (name === 'native')
      assert(
        !/__spreadValues|__spreadProps|__async/.test(code),
        'Qualified syntax was lowered again',
      );
    const sourceFile = path.join(temporary, name + '.js'),
      bytecode = path.join(temporary, name + '.hbc');
    const lowered = process.argv.includes('--babel-classes')
      ? compilerRequire('@babel/core').transformSync(code, {
          configFile: false,
          babelrc: false,
          plugins: [compilerRequire.resolve('@babel/plugin-transform-classes')],
        })
      : { code };
    fs.writeFileSync(sourceFile, lowered.code);
    run(path.join(supply, 'hermesc.exe'), [
      ...windowsHermesPolicy(
        process.argv.includes('--debug-classes') ? 'debug' : 'optimized',
        nativeCohort('windows'),
      ).flags,
      '-Xes6-block-scoping',
      '-emit-binary',
      '-out',
      bytecode,
      sourceFile,
    ]);
    try {
      outputs[name] = JSON.parse(run(path.join(temporary, 'check.exe'), [bytecode]));
    } catch (error) {
      throw Error(name + ': ' + error.message);
    }
  }
  assert.equal(outputs.native.sum, outputs.lowered.sum);
  console.log(
    'Pinned compiler + VM spread/rest/symbol/getter/proto, async and class field semantics PASS.',
    outputs,
  );
  const cachedFixture = buildSync({
    stdin: {
      resolveDir: root,
      loader: 'ts',
      contents: `
    import {ObservationDecodeCache} from './Nelyx/runtime/engine-client/observation-cache.ts';
    import {semanticBody,readSemanticBody} from './Nelyx/runtime/engine-client/semantics.ts';
    import {SceneNode,SceneReference,SceneWriter,sceneConfiguration,retainSceneConfiguration,immutableSceneData,renderBindingConfiguration} from './Nelyx/dist/v2/engine-client/scene.js';
    import {protocol as p} from './Nelyx/dist/v2/engine-client/schema.js';
    import {DateTime} from './packages/material/dist/internal/date/date-time.js';
    import {ownFieldInitializer} from './Nelyx/dist/ui/value-math.js';
    import {SemanticsProperties,sourceSemanticsProperties} from './Nelyx/dist/framework/semantics/semantics.js';
    import {TextStyle} from './Nelyx/dist/framework/painting/text-style.js';
    import {FontWeight,kTextHeightNone} from './Nelyx/dist/ui/typography.js';
    import {invariant} from './Nelyx/dist/foundation/errors.js';
    import {FoundationBuildMode} from './Nelyx/dist/foundation/constants.js';
    import {BuildOwner} from './Nelyx/dist/framework/widgets/framework.js';
    import {LayoutBuilder,nativeLayoutBuilderCosts} from './Nelyx/dist/framework/widgets/layout-builder.js';
    import {SizedBox} from './Nelyx/dist/framework/widgets/basic.js';
    import {BoxConstraints} from './Nelyx/dist/framework/rendering/constraints.js';
    import {claimNativeRenderObject} from './Nelyx/dist/framework/rendering/object.js';
    import {FrameScheduler} from './Nelyx/dist/framework/scheduler/scheduler.js';
    import {registerTickerScheduler,unregisterTickerScheduler} from './Nelyx/dist/framework/widgets/ticker-scheduler.js';
    ${textStyleApplyReference()}
    const textBase=new TextStyle({fontSize:17,color:0xff123456,fontWeight:FontWeight.w500,fontFamilyFallback:['a']});
    const expectedText=referenceApply.call(textBase,{color:0xff654321}),sourceText=textBase.apply({color:0xff654321});
    if(JSON.stringify(Object.getOwnPropertyDescriptors(expectedText))!==JSON.stringify(Object.getOwnPropertyDescriptors(sourceText))||Object.getPrototypeOf(sourceText)!==TextStyle.prototype||!Object.isFrozen(sourceText)||sourceText===textBase.apply({color:0xff654321})||sourceText.fontFamilyFallback===textBase.fontFamilyFallback)throw Error('Hermes applied TextStyle construction differs');
    class ExtendedTextStyle extends TextStyle {extra=19;}
    const extendedText=new ExtendedTextStyle({fontSize:13});
    if(extendedText.extra!==19||!Object.isExtensible(extendedText)||Object.getPrototypeOf(extendedText.apply())!==TextStyle.prototype)throw Error('Hermes applied TextStyle subclass differs');
    let textSum=0,textStarted=Date.now();
    for(let i=0;i<2000;++i)textSum+=referenceApply.call(textBase,{color:0xff654321}).fontSize;
    const textConstructorMs=Date.now()-textStarted;textStarted=Date.now();
    for(let i=0;i<2000;++i)textSum-=textBase.apply({color:0xff654321}).fontSize;
    const textSourceMs=Date.now()-textStarted;if(textSum)throw Error('Hermes applied TextStyle result differs');
    const buildOwner=new BuildOwner({},()=>{}),frameScheduler=new FrameScheduler({now:()=>0},()=>{}, {reportError:error=>{throw error;}});
    registerTickerScheduler(buildOwner,frameScheduler);let widgetBuilds=0;
    const layoutElement=new LayoutBuilder(()=>{++widgetBuilds;return SizedBox.shrink();}).createElement();
    layoutElement.mount(undefined,buildOwner);const layoutRender=layoutElement.renderObject;
    claimNativeRenderObject(layoutRender,{},()=>{});const constraints=BoxConstraints.tight({width:100,height:60});
    const answerLayout=()=>{const config=layoutRender.nativeBuilderConfiguration();if(!config.rebuild(config.revision,constraints))throw Error('Hermes native LayoutBuilder refused its input');};
    try{
      answerLayout();layoutElement.children[0].markNeedsBuild();answerLayout();
      if(widgetBuilds!==1||frameScheduler.transientCallbackCount||nativeLayoutBuilderCosts(buildOwner).calls!==2)throw Error('Hermes isolated dirty scope repeated a builder or retained a stale frame');
      layoutElement.markNeedsBuild();answerLayout();if(widgetBuilds!==2||nativeLayoutBuilderCosts(buildOwner).builds!==2)throw Error('Hermes lost its original builder invalidation');
    }finally{layoutElement.unmount();unregisterTickerScheduler(buildOwner);frameScheduler.dispose();buildOwner.dispose();}
    const partCounts={partEncodes:0,partReuses:0},partReference=new SceneReference(),partWriter=new SceneWriter({}, {pollEvents:false,retainedScene:true});let partAction=0;
    const sourcePart=callback=>renderBindingConfiguration(partReference,'box',[],{color:7,layout:{gap:3},semantics:{role:'button',label:'day'},onAction:()=>{partAction=callback;}},undefined,true,partCounts);
    partWriter.adopt(partWriter.records(sourcePart(1)),[]);const partEncoded=partCounts.partEncodes,partReused=partCounts.partReuses;
    const equalParts=partWriter.records(sourcePart(2));
    if(partCounts.partEncodes!==partEncoded||partCounts.partReuses<=partReused||partWriter.diff(equalParts).length)throw Error('Hermes Source field journal repeated encoders or changed bytes');
    partWriter.adopt(equalParts,[]);Array.from(partWriter.accepted.values())[0].node.options.onAction();if(partAction!==2)throw Error('Hermes Source field journal retained its callback');
    const initialize=ownFieldInitializer(['first','second']);
    let fieldSetters=0;class FieldBase {set first(value){++fieldSetters;}}
    class StandardFields extends FieldBase {first;second;constructor(input){super();this.first=input.first;this.second=input.second;}}
    class GroupedFields extends FieldBase {constructor(input){super();initialize(this);this.first=input.first;this.second=input.second;}}
    const fieldReads=[],input={get first(){fieldReads.push('first');return 3;},get second(){fieldReads.push('second');return 7;}};
    const standard=new StandardFields(input),grouped=new GroupedFields(input);
    if(fieldSetters||fieldReads.join(',')!=='first,second,first,second'||JSON.stringify(Object.getOwnPropertyDescriptors(standard))!==JSON.stringify(Object.getOwnPropertyDescriptors(grouped)))throw Error('Batched field definitions changed setters, evaluation order or descriptors');
    let semanticsSetters=0;Object.defineProperty(SemanticsProperties.prototype,'label',{configurable:true,set(value){semanticsSetters++;}});
    try {
      const properties=new SemanticsProperties({label:'day',button:true,selected:false});
      const sourceProperties=sourceSemanticsProperties({label:'day',button:true,selected:false});
      if(JSON.stringify(Object.getOwnPropertyDescriptors(properties))!==JSON.stringify(Object.getOwnPropertyDescriptors(sourceProperties))||Object.getPrototypeOf(properties)!==Object.getPrototypeOf(sourceProperties))throw Error('Hermes Source semantics value layout differs');
      if(semanticsSetters||properties.label!=='day'||!Object.isFrozen(properties)||Object.keys(properties).length!==78)throw Error('Semantics final field layout differs');
      class ExtendedProperties extends SemanticsProperties {extra=13;}
      const derived=new ExtendedProperties({label:'derived'}),descriptor=Object.getOwnPropertyDescriptor(derived,'label');
      if(derived.extra!==13||!Object.isExtensible(derived)||descriptor.writable||descriptor.configurable||!descriptor.enumerable)throw Error('Semantics subclass fields/final descriptors differ');
    }finally{delete SemanticsProperties.prototype.label;}
    const writer=new SceneWriter({}, {pollEvents:false,retainedScene:true});writer.nextSlot=37;
    const desired=writer.records(new SceneNode(new SceneReference(),'stack',[
      new SceneNode(new SceneReference(),'box',[],{layout:{childConstraints:'inherit'},pointerHitTest:'self'}),
      new SceneNode(new SceneReference(),'box',[],{properties:{width:42},color:0xff123456,layout:false}),
    ]));
    const changes=writer.diff(desired),kind=bytes=>new DataView(bytes.buffer,bytes.byteOffset).getUint16(0,true);
    if(changes.filter(bytes=>kind(bytes)===p.commands.properties).length!==1||changes.filter(bytes=>kind(bytes)===p.commands.paint).length!==1)throw Error('Hermes creation default comparison differs');
    const sourceWriter=new SceneWriter({}, {pollEvents:false,retainedScene:true});sourceWriter.nextSlot=51;
    const sourceRef=new SceneReference(),source=options=>{const node=sceneConfiguration(sourceRef,'box',[],options);retainSceneConfiguration(node);return node;};
    sourceWriter.adopt(sourceWriter.records(source({color:0xff123456})),[]);
    const resets=sourceWriter.diff(sourceWriter.records(source({}))),paintReset=resets.find(bytes=>kind(bytes)===p.commands.paint);
    if(!paintReset||new DataView(paintReset.buffer,paintReset.byteOffset).getUint32(8,true)!==sourceRef.currentNode.slot||!sourceWriter.counters.sharedDefaultConfigs)throw Error('Hermes shared default reset lost its destination');
    const mutablePolicy={commands:[{values:[7,11]}]},ownedPolicy=immutableSceneData(mutablePolicy);
    mutablePolicy.commands[0].values[0]=19;
    if(ownedPolicy.commands[0].values[0]!==7||!Object.isFrozen(ownedPolicy.commands[0].values)||immutableSceneData(ownedPolicy)!==ownedPolicy)throw Error('Hermes immutable policy copied a shared value or retained a mutable producer alias');
    let accessorRuns=0,refused=false;try{immutableSceneData({get value(){++accessorRuns;return 1;}});}catch{refused=true;}
    if(!refused||accessorRuns)throw Error('Hermes immutable policy evaluated an accessor');
    const payloadRef=new SceneReference(),payloadWriter=new SceneWriter({}, {pollEvents:false,retainedScene:true});let action=0;
    const initialPayload=sceneConfiguration(payloadRef,'box',[],{layout:{gap:7},onAction:()=>{action=1;}});
    retainSceneConfiguration(initialPayload);payloadWriter.adopt(payloadWriter.records(initialPayload),[]);
    const initialRecord=Array.from(payloadWriter.accepted.values())[0];
    const updatedPayload=sceneConfiguration(payloadRef,'box',[],{layout:{gap:7},onAction:()=>{action=2;}});
    retainSceneConfiguration(updatedPayload,initialPayload);
    const updatedRecords=payloadWriter.records(updatedPayload),updatedRecord=Array.from(updatedRecords.values())[0];
    if(updatedRecord.config!==initialRecord.config||payloadWriter.diff(updatedRecords).length)throw Error('Hermes equal Source payload repeated command configuration');
    payloadWriter.adopt(updatedRecords,[]);Array.from(payloadWriter.accepted.values())[0].node.options.onAction('activate');
    if(action!==2)throw Error('Hermes payload reuse retained an old callback');
    const date=new DateTime(2024,2,29),dateCopy=date.toDate();dateCopy.setTime(0);
    if(date.year!==2024||date.month!==2||date.day!==29||!DateTime.fromMillisecondsSinceEpoch(date.millisecondsSinceEpoch).equals(date))throw Error('Hermes civil date reader or mutable-copy isolation differs');
    const reference=new SceneReference(),ordinary=new SceneNode(reference,'box'),direct=sceneConfiguration(reference,'box');
    if(!(direct instanceof SceneNode)||Object.getPrototypeOf(direct)!==Object.getPrototypeOf(ordinary)||JSON.stringify(Object.getOwnPropertyDescriptors(direct))!==JSON.stringify(Object.getOwnPropertyDescriptors(ordinary)))throw Error('Source configuration differs from public constructor');
    let setterCalls=0;Object.defineProperty(SceneNode.prototype,'editorFlags',{configurable:true,set(value){++setterCalls;}});
    try{if(new SceneNode(reference,'box').editorFlags!==0||setterCalls)throw Error('Public field definition invoked an inherited setter');if(sceneConfiguration(reference,'box').editorFlags!==0||setterCalls)throw Error('Source field definition invoked an inherited setter');}finally{delete SceneNode.prototype.editorFlags;}
    let beginScene=Date.now(),sceneSum=0;
    for(let i=0;i<2000;++i)sceneSum+=new SceneNode(reference,'box').maximumLength;
    const sceneConstructorMs=Date.now()-beginScene;beginScene=Date.now();
    for(let i=0;i<2000;++i)sceneSum-=sceneConfiguration(reference,'box').maximumLength;
    const sceneConfigurationMs=Date.now()-beginScene;if(sceneSum)throw Error('Source configuration values differ');
    const bodies=Array.from({length:512},(_,i)=>semanticBody({role:'button',label:'Day '+i}));
    const cache=new ObservationDecodeCache();let plainSum=0,cachedSum=0;
    let begin=Date.now();
    for(let frame=0;frame<20;++frame)for(let i=0;i<bodies.length;++i)plainSum+=readSemanticBody(bodies[i]).label.length;
    const plainMs=Date.now()-begin;begin=Date.now();
    for(let frame=0;frame<20;++frame)for(let i=0;i<bodies.length;++i)cachedSum+=cache.read('view1/'+i,bodies[i],readSemanticBody).label.length;
    const cachedMs=Date.now()-begin;
    if(plainSum!==cachedSum||cache.counters.hits!==19*512)throw Error('Observation decode cache differs');
    globalThis.result=JSON.stringify({plainMs,cachedMs,hits:cache.counters.hits,bytes:cache.byteLength,sceneConstructorMs,sceneConfigurationMs,textConstructorMs,textSourceMs,partEncodes:partCounts.partEncodes,partReuses:partCounts.partReuses});
  `,
    },
    bundle: true,
    write: false,
    platform: 'neutral',
    format: 'iife',
    tsconfigRaw: { compilerOptions: { useDefineForClassFields: true } },
    target: 'es2015',
    supported: windowsHermesSyntax,
    logLevel: 'silent',
  }).outputFiles[0].text;
  const cacheSource = path.join(temporary, 'observation.js'),
    cacheBytecode = path.join(temporary, 'observation.hbc');
  fs.writeFileSync(
    cacheSource,
    process.argv.includes('--babel-classes')
      ? compilerRequire('@babel/core').transformSync(cachedFixture, {
          configFile: false,
          babelrc: false,
          plugins: [compilerRequire.resolve('@babel/plugin-transform-classes')],
        }).code
      : cachedFixture,
  );
  run(path.join(supply, 'hermesc.exe'), [
    ...windowsHermesPolicy(
      process.argv.includes('--debug-classes') ? 'debug' : 'optimized',
      nativeCohort('windows'),
    ).flags,
    '-Xes6-block-scoping',
    '-emit-binary',
    '-out',
    cacheBytecode,
    cacheSource,
  ]);
  console.log(
    'Pinned VM unchanged observation decode comparison PASS.',
    JSON.parse(run(path.join(temporary, 'check.exe'), [cacheBytecode])),
  );
} finally {
  fs.rmSync(temporary, { recursive: true, force: true });
}
