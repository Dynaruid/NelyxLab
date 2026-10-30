// SPDX-License-Identifier: BSD-3-Clause
import fs from 'node:fs';import path from 'node:path';import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {nativeCohort} from '@nelyx/sdk/runtime/cohorts';
import {verifyWindowsStaticHermes,windowsStaticHermesPin,windowsCompilerEnvironment,staticHermesBridgeSha256} from './windows-static-hermes.mjs';
import {windowsTypedHermesPolicy} from './windows-typed-hermes-policy.mjs';
import {windowsHermesPolicy} from './windows-hermes-policy.mjs';
import {compileHermesImage} from './windows-hermes-image.mjs';
import {sha256,localFile} from './files.mjs';
import {createExecutionPlan,bindNativeCoverage,verifyFrontendPlan} from '@nelyx/static-aot/execution-plan';
import {verifyTypePolicy} from '@nelyx/static-aot/type-policy';
import {inventoryBody} from '@nelyx/static-aot/runtime-inventory';
import {inspectRnwJsiPal,rnwJsiPalSource,rnwJsiPalSha256} from './rnw-jsi-pal.mjs';
import {nativeImageDebugIdentity,symbolizeNativePc} from './native-pc-map.mjs';
export const staticAotBootstrap='/*nelyx:static-hermes-aot:94aa5e1d:v5*/\n';
const digest=value=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value);
const partitionPlanSha256=value=>createHash('sha256').update(value).digest('hex');
path.join(path.dirname(createRequire(import.meta.url).resolve('@nelyx/sdk/package.json')),'native/windows/StaticHermes.h');
export async function buildStaticAotMetroBundle({runner,entry,source,map,config,signal,nativeHost=false,applicationRoot=path.resolve(runner,'../..'),packageRoots}){
  signal?.throwIfAborted();
  const started=performance.now();
  const {productPartition,typedBootstrapPrefix}=await import('@nelyx/static-aot/product-partition');
  const load=createRequire(path.join(runner,'package.json'));
  const {inspectRuntimeInventory}=await import('@nelyx/metro/runtime-inventory');let before;
  await inspectRuntimeInventory({runner,appRoot:applicationRoot,entry,nativeHost,...(nativeHost?{config}:{}),signal,onCapture(value){before=value;}});
  const inspected=performance.now();
  const partition=productPartition({runner,entry,applicationRoot,packageRoots,runtimeFiles:before.records.map(record=>path.resolve(applicationRoot,record.sourceFile))});
  const partitioned=performance.now();
  const upstream=load.resolve(nativeHost?'@nelyx/metro/native-hermes-transformer':'@react-native/metro-babel-transformer'),transformer=load.resolve('@nelyx/metro/native-typed-transformer');
  if(config.transformer.babelTransformerPath!==upstream)throw Error('Static Hermes AOT owns the RN Babel transformer; configure Babel plugins in babel.config.cjs');
  {
    const planned=partition.metroPlan,plan=JSON.stringify(planned);
    let captured;fs.mkdirSync(path.dirname(source),{recursive:true});fs.mkdirSync(path.dirname(map),{recursive:true});
    await inspectRuntimeInventory({runner,appRoot:applicationRoot,entry,nativeHost,config:{...config,transformerPath:load.resolve('@nelyx/metro/native-aot-worker'),transformer:{...config.transformer,babelTransformerPath:transformer}},signal,sourceMapUrl:path.relative(path.dirname(source),map).replaceAll('\\','/'),customTransformOptions:{nelyxTypedPlan:plan,nelyxTypedPlanSha256:partitionPlanSha256(plan)},onCapture(value){captured=value;}});
    const transformed=performance.now();
    if(!captured)throw Error('Native runtime input graph was not captured');fs.writeFileSync(source,captured.code);fs.writeFileSync(map,captured.map);
    for(const record of captured.records){if(record.role==='append'||record.sourceKind==='json'||record.id==='generated/prelude')continue;const value=record.nativeEvidence;if(value?.schema!=='nelyx.metro-native-evidence/v1'||value.elimination?.sourceSha256!==record.transformSourceSha256)throw Error('Metro frontend provenance absent or stale: '+record.id);record.frontendElimination=value.elimination;}
    const records=new Map(captured.records.map(record=>[path.resolve(applicationRoot,record.id).toLowerCase(),record]));
    for(const file of planned.files){const value=records.get(path.resolve(file.file).toLowerCase())?.nativeEvidence?.consumed;if(!value||value.sha256!==file.sha256||JSON.stringify(value.bindings)!==JSON.stringify(file.bindings.map(binding=>binding.id)))throw Error('Metro typed body consumption differs: '+file.file);}
    const prefix=typedBootstrapPrefix(partition);fs.writeFileSync(source,prefix+fs.readFileSync(source,'utf8'));
    const sourceMap=JSON.parse(fs.readFileSync(map,'utf8'));if(sourceMap.version!==3||typeof sourceMap.mappings!=='string')throw Error('Typed Metro requires a flat v3 input map');sourceMap.mappings=';'.repeat(prefix.split('\n').length-1)+sourceMap.mappings;fs.writeFileSync(map,JSON.stringify(sourceMap));
    fs.writeFileSync(path.join(path.dirname(source),'index.windows.typed.ts'),partition.source);const pal=nativeHost?undefined:inspectRnwJsiPal(runner);if(pal)fs.writeFileSync(path.join(path.dirname(source),'index.windows.rnw-pal.js'),pal.source);signal?.throwIfAborted();
    const executionPlan=createExecutionPlan(captured,partition,prefix,pal?[pal]:[]);
    console.log('STATIC_AOT_FRONTEND '+JSON.stringify({inventoryMs:inspected-started,partitionMs:partitioned-inspected,metroMs:transformed-partitioned,executionMs:performance.now()-transformed,totalMs:performance.now()-started}));
    return {...partition,executionPlan};
  }
}
export async function compileWindowsStaticAot({toolchain,source,typedSource,partitionSha256,output,hermesDirectory,cohort,signal,diagnosticMap,cacheDirectory}){
  if(!digest(partitionSha256))throw Error('Static Hermes AOT requires its source partition identity');
  const checked=verifyWindowsStaticHermes(toolchain),env=windowsCompilerEnvironment(),policy=windowsTypedHermesPolicy(cohort);
  if(sha256(path.join(hermesDirectory,'build/native/win32/x64/hermes.dll'))!==windowsStaticHermesPin.runtimeSha256)throw Error('Static Hermes AOT requires its pinned supplier ABI');
  if(fs.statfsSync(path.dirname(output)).bavail*fs.statfsSync(path.dirname(output)).bsize<20*1024**3)throw Error('Need 20 GiB before typed native compilation');
  const frontend=diagnosticMap?.executionPlan,palSource=frontend?path.join(path.dirname(source),'index.windows.rnw-pal.js'):null;
  if(frontend&&(!frontend.modules.some(module=>module.nativeUnit==='nelyx_rnw_pal'&&module.emittedSha256===rnwJsiPalSha256)||fs.readFileSync(palSource,'utf8')!==rnwJsiPalSource))throw Error('Full-runtime native RNW JSI manager source missing');
  const nativePlan={schema:'nelyx.shunit-plan/v5',scope:frontend?'full-runtime':'native-probe',revision:windowsStaticHermesPin.revision,compilerPolicy:policy.id,partitionSha256,graphSha256:frontend?.sourceGraphSha256??partitionSha256,typePolicySha256:frontend?.typePolicySha256??partitionSha256,executionPlanSha256:frontend?.sha256??partitionSha256,sourceSha256:sha256(source),typedSourceSha256:sha256(typedSource),internalJavaScriptSha256:checked.manifest.internalJavaScript.sourceSha256,rnwPalSourceSha256:frontend?rnwJsiPalSha256:''};
  const descriptor=`#include <stdint.h>\nstruct UnitPlanV5{uint32_t version,count;const char *revision,*policy,*partitionSha256,*typedUnit,*untypedUnit,*scope,*graphSha256,*typePolicySha256,*executionPlanSha256,*sourceSha256,*typedSourceSha256,*internalJavaScriptSha256,*rnwPalSourceSha256,*contract;};\nstatic const struct UnitPlanV5 plan={5,${frontend?3:2},"${windowsStaticHermesPin.revision}","${policy.id}","${partitionSha256}","nelyx_typed","nelyx_app","${nativePlan.scope}","${nativePlan.graphSha256}","${nativePlan.typePolicySha256}","${nativePlan.executionPlanSha256}","${nativePlan.sourceSha256}","${nativePlan.typedSourceSha256}","${nativePlan.internalJavaScriptSha256}","${nativePlan.rnwPalSourceSha256}",${JSON.stringify(JSON.stringify(nativePlan))}};\n__declspec(dllexport) const struct UnitPlanV5* nelyx_sh_plan_v5(void){return &plan;}\n`;
  const build=await compileHermesImage({checked,env,output,signal,descriptor,cacheDirectory,units:[{name:'nelyx_typed',source:typedSource,flags:policy.flags,typed:true,requireNumeric:diagnosticMap?.bindings?.length!==0,diagnosticMap,evidence:!!diagnosticMap?.executionPlan},{name:'nelyx_app',source,flags:windowsHermesPolicy('optimized',cohort).flags,evidence:!!diagnosticMap?.executionPlan},...(palSource?[{name:'nelyx_rnw_pal',source:palSource,flags:windowsHermesPolicy('optimized',cohort).flags,evidence:true}]:[])]});
  return {mode:'static-native-aot',nativePlan,revision:windowsStaticHermesPin.revision,toolchainSha256:checked.sha256,sourceSha256:sha256(source),typedSourceSha256:sha256(typedSource),rnwPalSourceSha256:frontend?rnwJsiPalSha256:'',partitionSha256,librarySha256:sha256(output),libraryBytes:fs.statSync(output).size,compilerPolicy:policy.id,compilerFlags:policy.flags,unitOrder:['nelyx_typed','nelyx_app',...(palSource?['nelyx_rnw_pal']:[])],build};
}
export async function writeStaticAotApplication({toolchain,source,typedSource,partition,directory,bundle,hermesDirectory,cohort,signal,cacheDirectory}){
  const checked=verifyWindowsStaticHermes(toolchain);
  if(partition.sourceSha256!==sha256(typedSource))throw Error('Typed source differs from its partition');
  const compiled=await compileWindowsStaticAot({toolchain,source,typedSource,partitionSha256:partition.irSha256,output:path.join(directory,windowsStaticHermesPin.library),hermesDirectory,cohort,signal,diagnosticMap:partition,cacheDirectory});
  fs.writeFileSync(bundle,staticAotBootstrap);fs.copyFileSync(path.join(checked.directory,'build/API/hermes_shared/hermes.dll'),path.join(directory,'hermes.dll'));
  if(!compiled.build.nativePcMap)throw Error('Static AOT native PC evidence missing');
  const map={schema:'nelyx.typed-input-map/v1',irSha256:partition.irSha256,checkerSha256:partition.ir.checkerSha256,graphSha256:partition.ir.graphSha256,functions:partition.ir.functions,segments:partition.segments,nativeInstructionMap:'function-pc-v1'};
  fs.writeFileSync(path.join(directory,'Bundle/index.windows.typed.map.json'),JSON.stringify(map));
  const {build,...identity}=compiled;console.log('STATIC_AOT_BUILD '+JSON.stringify({buildMs:build.buildMs,cacheHit:build.cacheHit,nativePcFunctions:build.nativePcMap.functions.length,units:build.units.map(({nativeFunctions,...unit})=>({...unit,nativeFunctions:nativeFunctions?.functions.length}))}));
  fs.writeFileSync(path.join(directory,'static-aot-native-pc.json'),JSON.stringify(build.nativePcMap));
  const execution=partition.executionPlan?bindNativeCoverage(partition.executionPlan,build,identity):null;
  if(execution){fs.writeFileSync(path.join(directory,'static-aot-execution.json'),JSON.stringify(execution));fs.writeFileSync(path.join(directory,'static-aot-type-policy.json'),JSON.stringify(partition.typePolicy));}
  if(!execution?.summary.wholeAppNativeAot||execution.summary.typePolicyAccepted!==true)throw Error('Static Hermes full-runtime coverage incomplete: '+JSON.stringify(execution?.summary??{executionPlan:'missing'}));
  const metadata={nativePcMap:'static-aot-native-pc.json',nativePcMapSha256:sha256(path.join(directory,'static-aot-native-pc.json')),...(execution?{executionPlan:'static-aot-execution.json',executionPlanSha256:sha256(path.join(directory,'static-aot-execution.json')),typePolicy:'static-aot-type-policy.json',typePolicySha256:sha256(path.join(directory,'static-aot-type-policy.json')),acceptance:execution.summary}:{}),schema:'nelyx.windows-static-aot-app/v5',...identity,rnwPalSource:'Bundle/index.windows.rnw-pal.js',library:windowsStaticHermesPin.library,source:'Bundle/index.windows.aot.js',typedSource:'Bundle/index.windows.typed.ts',inputMap:'Bundle/index.windows.typed.map.json',inputMapSha256:sha256(path.join(directory,'Bundle/index.windows.typed.map.json')),internalJavaScript:checked.manifest.internalJavaScript,runtimeSha256:checked.manifest.runtimeSha256,baseRuntimeSha256:windowsStaticHermesPin.runtimeSha256,bridgeSha256:checked.manifest.bridgeSha256,bootstrapSha256:sha256(bundle),bootstrapFormat:'nelyx-static-hermes-native/v5',heap:'HEAP_HV_64',unitCrt:'MD',floatingPoint:'binary64-no-contract',qualification:'experimental',partition:partition.bindings.map(({id,globalName,sourceSha256,runtimeSha256})=>({id,globalName,sourceSha256,runtimeSha256})),excludedBoundaries:partition.graph.boundaries.map(({module,kind,detail})=>({module,kind,detail}))};
  fs.writeFileSync(path.join(directory,'static-aot-app.json'),JSON.stringify(metadata,null,2)+'\n');return verifyStaticAotApplication(directory);
}
export function verifyStaticAotApplication(directory){
  const metadata=JSON.parse(fs.readFileSync(localFile(directory,'static-aot-app.json'),'utf8'));
  // The current installed SDK is the bridge owner, including at public run time.
  const {bridgeSha256}=metadata;
  if(metadata.internalJavaScript?.mode!=='native'||metadata.internalJavaScript.sourceSha256!==windowsStaticHermesPin.internalJavaScriptSha256||metadata.nativePlan?.internalJavaScriptSha256!==metadata.internalJavaScript.sourceSha256)throw Error('Static AOT requires native internal JavaScript builtins');
  if(metadata.schema!=='nelyx.windows-static-aot-app/v5'||metadata.mode!=='static-native-aot'||metadata.revision!==windowsStaticHermesPin.revision||metadata.library!==windowsStaticHermesPin.library||metadata.source!=='Bundle/index.windows.aot.js'||metadata.typedSource!=='Bundle/index.windows.typed.ts'||metadata.inputMap!=='Bundle/index.windows.typed.map.json'||metadata.compilerPolicy!=='windows-hermes-94aa5e1d-typed-no-cfg-v1'||metadata.baseRuntimeSha256!==windowsStaticHermesPin.runtimeSha256||!digest(bridgeSha256)||!digest(metadata.partitionSha256)||metadata.bootstrapFormat!=='nelyx-static-hermes-native/v5'||metadata.qualification!=='experimental'||metadata.heap!=='HEAP_HV_64'||metadata.unitCrt!=='MD'||metadata.floatingPoint!=='binary64-no-contract'||JSON.stringify(metadata.unitOrder)!=='["nelyx_typed","nelyx_app","nelyx_rnw_pal"]')throw Error('Static Hermes AOT application identity differs');
  if(bridgeSha256!==staticHermesBridgeSha256())throw Error('Static Hermes AOT bridge owner differs');
  if(metadata.rnwPalSource!=='Bundle/index.windows.rnw-pal.js'||metadata.rnwPalSourceSha256!==rnwJsiPalSha256||metadata.nativePlan.rnwPalSourceSha256!==rnwJsiPalSha256)throw Error('Native RNW JSI manager source identity differs');
  const nativePlan=metadata.nativePlan;
  if(nativePlan?.schema!=='nelyx.shunit-plan/v5'||nativePlan.scope!=='full-runtime'||nativePlan.partitionSha256!==metadata.partitionSha256||nativePlan.sourceSha256!==metadata.sourceSha256||nativePlan.typedSourceSha256!==metadata.typedSourceSha256||nativePlan.revision!==metadata.revision||nativePlan.compilerPolicy!==metadata.compilerPolicy||!fs.readFileSync(localFile(directory,metadata.library)).includes(Buffer.from(JSON.stringify(nativePlan)+'\0')))throw Error('Static AOT embedded native scope/graph contract differs');
  if(JSON.stringify(metadata.compilerFlags)!==JSON.stringify(windowsTypedHermesPolicy(nativeCohort('windows')).flags))throw Error('Static Hermes AOT compiler flags differ');
  if(!Array.isArray(metadata.partition)||metadata.partition.length>4096||new Set(metadata.partition.map(item=>item.id)).size!==metadata.partition.length||metadata.partition.some(item=>!digest(item.sourceSha256)||typeof item.id!=='string'||!/^__nelyxTyped_[a-f0-9]{16}$/.test(item.globalName)))throw Error('Static Hermes AOT partition identity differs');
  for(const [name,key]of [[metadata.rnwPalSource,'rnwPalSourceSha256'],['hermes.dll','runtimeSha256'],[metadata.library,'librarySha256'],[metadata.source,'sourceSha256'],[metadata.typedSource,'typedSourceSha256'],[metadata.inputMap,'inputMapSha256'],['Bundle/index.windows.bundle','bootstrapSha256']])if(!digest(metadata[key])||sha256(localFile(directory,name))!==metadata[key])throw Error('Static Hermes AOT application file differs: '+name);
  if(fs.statSync(localFile(directory,metadata.library)).size!==metadata.libraryBytes||fs.readFileSync(localFile(directory,'Bundle/index.windows.bundle'),'utf8')!==staticAotBootstrap)throw Error('Static Hermes AOT native entry differs');
  const map=JSON.parse(fs.readFileSync(localFile(directory,metadata.inputMap),'utf8'));
  if(map.schema!=='nelyx.typed-input-map/v1'||map.irSha256!==metadata.partitionSha256||map.nativeInstructionMap!=='function-pc-v1'||map.functions?.length!==metadata.partition.length||metadata.partition.some(item=>!map.functions.some(fn=>fn.id===item.id&&fn.sourceSha256===item.sourceSha256)))throw Error('Static Hermes AOT input map differs');
  if(metadata.nativePcMap!=='static-aot-native-pc.json'||sha256(localFile(directory,metadata.nativePcMap))!==metadata.nativePcMapSha256)throw Error('Static AOT native PC map differs');
  const pc=JSON.parse(fs.readFileSync(localFile(directory,metadata.nativePcMap),'utf8')),debug=nativeImageDebugIdentity(localFile(directory,metadata.library));
  if(pc.schema!=='nelyx.native-pc-map/v1'||pc.imageSha256!==metadata.librarySha256||pc.debug.guid!==debug.guid||pc.debug.age!==debug.age||pc.precision!=='function-range'||!pc.functions.length)throw Error('Static AOT PC/image debug identity differs');
  if(metadata.executionPlan===undefined)throw Error('Static AOT requires full execution and automatic type policy evidence');
  {
    if(metadata.executionPlan!=='static-aot-execution.json'||metadata.typePolicy!=='static-aot-type-policy.json')throw Error('Static AOT execution artifact path differs');
    for(const [name,key]of [[metadata.executionPlan,'executionPlanSha256'],[metadata.typePolicy,'typePolicySha256']])if(!digest(metadata[key])||sha256(localFile(directory,name))!==metadata[key])throw Error('Static AOT execution artifact differs: '+name);
    const execution=JSON.parse(fs.readFileSync(localFile(directory,metadata.executionPlan),'utf8')),typePolicy=JSON.parse(fs.readFileSync(localFile(directory,metadata.typePolicy),'utf8'));
    verifyTypePolicy(typePolicy);
    verifyFrontendPlan(execution);
    if(execution.summary?.wholeAppNativeAot!==true||execution.summary.typePolicyAccepted!==true)throw Error('Static AOT full-runtime acceptance differs');
    if(execution.schema!=='nelyx.static-aot-execution-plan/v2'||typePolicy.schema!=='nelyx.static-aot-type-policy/v1'||execution.typePolicySha256!==typePolicy.sha256||execution.sourceGraphSha256!==typePolicy.graphSha256||execution.nativeImageSha256!==metadata.librarySha256||execution.compiler?.toolchainSha256!==metadata.toolchainSha256)throw Error('Static AOT execution policy/image identity differs');
    if(execution.frontendPlanSha256!==nativePlan.executionPlanSha256||execution.sourceGraphSha256!==nativePlan.graphSha256||execution.typePolicySha256!==nativePlan.typePolicySha256)throw Error('Static AOT embedded frontend plan differs');
    const repeated=bindNativeCoverage(execution,{units:execution.compiler.units.map(nativeFunctions=>({unit:nativeFunctions.unit,nativeFunctions}))},metadata);
    if(repeated.sha256!==execution.sha256||JSON.stringify(repeated.summary)!==JSON.stringify(metadata.acceptance))throw Error('Static AOT native coverage or acceptance differs');
    const source=fs.readFileSync(localFile(directory,metadata.source),'utf8'),nativeSources=new Map(execution.modules.filter(module=>module.nativeInput).map(module=>[module.nativeUnit,fs.readFileSync(localFile(directory,module.nativeInput),'utf8')]));
    for(const module of execution.modules){
      const text=(module.nativeUnit?nativeSources.get(module.nativeUnit):source).slice(module.span.offset,module.span.end),bodies=inventoryBody(text,{filename:module.id+'.generated.js'}).bodies;
      if(createHash('sha256').update(text).digest('hex')!==module.emittedSha256||bodies.length!==module.emitted.length||bodies.some((body,index)=>body.id!==module.emitted[index].id||body.sourceSha256!==module.emitted[index].sourceSha256||body.offset+module.span.offset!==module.emitted[index].inputOffset))throw Error('Static AOT emitted body inventory differs: '+module.id);
    }
  }
  return metadata;
}
/** Resolve an RVA (process PC minus loaded image base). Folded native aliases
 * remain multiple results. Locations describe functions, not exact statements. */
export function mapStaticAotPc(directory,rva){
  const metadata=verifyStaticAotApplication(directory),map=JSON.parse(fs.readFileSync(localFile(directory,metadata.nativePcMap),'utf8')),execution=JSON.parse(fs.readFileSync(localFile(directory,metadata.executionPlan),'utf8')),typed=JSON.parse(fs.readFileSync(localFile(directory,metadata.inputMap),'utf8'));
  return symbolizeNativePc(map,rva).map(fn=>{
    if(fn.unit==='nelyx_typed'){const index=/_kernel(\d+)$/.exec(fn.symbol),original=index?typed.functions[Number(index[1])]:null;return {...fn,precision:'function-range',original:original?{module:original.module,name:original.name,...original.position}:null};}
    const module=execution.modules.find(module=>(module.nativeUnit??'nelyx_app')===fn.unit&&fn.position&&fn.position.offset>=module.span.offset&&fn.position.offset<module.span.end),emitted=module?.emitted.filter(body=>fn.position.offset>=body.inputOffset&&fn.position.offset<body.inputEnd).sort((a,b)=>(a.inputEnd-a.inputOffset)-(b.inputEnd-b.inputOffset))[0];
    return {...fn,precision:'function-range',module:module?.sourceFile??null,originals:emitted?module.originals.filter(body=>emitted.originals.includes(body.id)).map(body=>({id:body.id,name:body.name,line:body.line,column:body.column})):[]};
  });
}
