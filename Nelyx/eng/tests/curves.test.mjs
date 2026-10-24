// SPDX-License-Identifier: BSD-3-Clause
import test from 'node:test';import assert from 'node:assert/strict';
import fs from 'node:fs';import path from 'node:path';import os from 'node:os';
import {spawnSync} from 'node:child_process';import {createRequire} from 'node:module';
import {Cubic} from '@nelyx/core/framework/animation/curves';
import {windowsHermesProfileFlags} from './windows-hermes-profile.mjs';
const timeout=1_200_000,root=path.resolve(import.meta.dirname,'../../..');
// Pinned Flutter 71e4717a, curves.dart Cubic.transformInternal arithmetic,
// evaluated as JavaScript binary64 at the t values below (not a Dart VM run).
// The extreme finite coordinates also require more than 64 bisections.
const times=[.055,.25,.5,.75],cases=[
  {points:[.4,0,.2,1],values:[.006919726729393005,.23698604106903076,.7755804806947708,.9595602750778198]},
  {points:[.4,0,1,1],values:[.005872622132301331,.09862061031162739,.32467134296894073,.6304780691862106]},
  {points:[0,0,.2,1],values:[.18809235095977783,.5788082629442215,.8393326997756958,.9644094705581665]},
  {points:[.175,.885,.32,1.275],values:[.2633014565706253,.8481117981672287,1.0674425686150788,1.0759368389844894]},
  {points:[2**100,0,2**100,1],values:[6.427312417911164e-64,1.2863526930583977e-62,5.206123058508043e-62,1.166815364598964e-61]},
  {points:[2**-100,0,2**-100,1],values:[.3219107389450073,.6904420908540487,.8901219572871923,.976267084479332]},
];
const affineCases=[[1,0,0,1,0,0],[-0,-0,-0,-0,-0,0],[0,-1,1,0,11,-13],[1e150,1e-150,-1e150,1e-150,-1e150,1e150],[1e-300,-1e-300,-0,0,-0,-1e-300]];
const encode=values=>values.map(value=>Object.is(value,-0)?'-0':String(value));
function expectedMatrices(){const expand=m=>[m[0],m[1],0,0,m[2],m[3],0,0,0,0,1,0,m[4],m[5],0,1],dense=(a,b)=>{const r=Array(16).fill(0);for(let c=0;c<4;c++)for(let row=0;row<4;row++)for(let k=0;k<4;k++)r[c*4+row]+=a[k*4+row]*b[c*4+k];return r;};return affineCases.flatMap(left=>affineCases.map(right=>{const a=expand(left),r=dense(a,expand(right)),chained=dense(r,a);return [encode(r),chained.every(Number.isFinite)?encode(chained):'overflow'];}));}
test('Cubic retains pinned evaluation results, overshoot and extreme finite control points',{timeout},()=>{
  for(const {points,values} of cases){const curve=new Cubic(...points);assert.equal(curve.transform(0),0);assert.equal(curve.transform(1),1);assert.deepEqual(times.map(t=>curve.transform(t)),values);}
});
test('Cubic fails explicitly when its floating point search cannot converge',{timeout},()=>{
  for(const x of [NaN,Infinity,-Infinity,Number.MAX_VALUE])assert.throws(()=>new Cubic(x,0,x,1).transform(.5),{name:'RangeError',message:/did not converge/});
});

test('actual Core curves and affine products retain values under pinned Hermes debug and optimizing profiles',{timeout,skip:process.platform!=='win32'},async()=>{
  assert(fs.statfsSync(root).bavail*fs.statfsSync(root).bsize>=20*1024**3,'Need 20 GiB before bundling');
  const runner=fs.realpathSync(process.env.NELYX_WINDOWS_TEST_RUNNER??path.join(root,'sample/nelyx-testbed-app-2/windows/runner'));
  const load=createRequire(path.join(runner,'package.json')),{runBuild,loadConfig}=load('metro');
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'nelyx-hermes-curves-'));
  const entry=path.join(runner,'nelyx-hermes-curves-'+process.pid+'.js'),configFile=path.join(directory,'metro.config.cjs');let entryOwned=false;
  const architecture=process.env.NELYX_WINDOWS_HERMES_ARCH??'x64';assert(['x64','x86'].includes(architecture));
  const compiler=path.join(process.env.USERPROFILE,'.nuget/packages/microsoft.javascript.hermes/0.0.0-2604.21001-94aa5e1d/tools/native/release',architecture,'hermes.exe');
  const run=(args,watchdog=timeout)=>{const result=spawnSync(compiler,args,{encoding:'utf8',windowsHide:true,timeout:watchdog,maxBuffer:1024*1024});assert.ifError(result.error);assert.equal(result.status,0,(result.stdout+result.stderr).slice(-3000));return result.stdout.trim();};
  try{
    const expected={curves:cases.map(item=>item.values),matrices:expectedMatrices()};
    fs.writeFileSync(entry,"import {Cubic} from '@nelyx/core/framework/animation/curves';import {matrix4FromAffine,multiplyMatrix4,captureMatrix4} from '@nelyx/core/ui/matrix4';const cases="+JSON.stringify(cases)+",times="+JSON.stringify(times)+",affine="+JSON.stringify(affineCases.map(encode))+".map(row=>row.map(value=>value==='-0'?-0:Number(value)));const results=cases.map(item=>{const curve=new Cubic(...item.points);return times.map(t=>curve.transform(t));});let rejected=false;try{new Cubic(NaN,0,NaN,1).transform(.5);}catch(error){rejected=error instanceof RangeError;}if(!rejected)throw Error('Nonconvergent curve accepted');const encode=values=>values.map(value=>Object.is(value,-0)?'-0':String(value));const matrices=affine.flatMap(left=>affine.map(right=>{const a=matrix4FromAffine(left),r=multiplyMatrix4(a,captureMatrix4(matrix4FromAffine(right)));let chained;try{chained=encode(multiplyMatrix4(r,a));}catch(error){if(error.code!=='invalid-transform')throw error;chained='overflow';}return [encode(r),chained];}));print(JSON.stringify({curves:results,matrices}));\n",{flag:'wx'});entryOwned=true;
    const core=path.join(root,'Nelyx');
    fs.writeFileSync(configFile,"module.exports=require("+JSON.stringify(path.join(root,'Nelyx/sdk/tooling/metro/src/runner-config.cjs'))+").createRunnerConfig("+JSON.stringify({target:'windows',runnerRoot:runner,appRoot:path.join(root,'sample/nelyx-testbed-app-2'),packageRoots:{'@nelyx/core':core}})+",{resolver:{resolveRequest(context,name,platform){if(name.startsWith('@nelyx/core/'))return {type:'sourceFile',filePath:require('node:module').createRequire("+JSON.stringify(path.join(core,'package.json'))+").resolve(name)};return context.resolveRequest(context,name,platform);}}});\n");
    const config=await loadConfig({cwd:runner,config:configFile,maxWorkers:2});
    config.serializer={...config.serializer,getModulesRunBeforeMainModule:()=>[],getPolyfills:()=>[]};
    const bundle=path.join(directory,'curves.js');
    await runBuild(config,{entry:path.basename(entry),platform:'windows',dev:false,minify:true,maxWorkers:2,out:bundle,sourceMap:false});
    for(const profile of ['Og','optimized','O','O-no-inline','O-no-cfg','O-no-cfg-inline']){
      const flags=windowsHermesProfileFlags(profile);
      const bytecode=path.join(directory,'curves.hbc');run([...flags,'-emit-binary','-out',bytecode,bundle]);
      assert.equal(fs.readFileSync(bytecode).readUInt32LE(8),99);
      // A regression previously spins forever; this owned child has a 30s
      // watchdog within the 20-minute test deadline. No UI/native runtime.
      assert.deepEqual(JSON.parse(run(['-exec','-b',bytecode],30_000)),expected,flags.join(' '));
    }
    // Preserve the original unbounded loop as an independent compiler control.
    // The known-bad -O profile is not run here: it spins indefinitely. Removing
    // CFG simplification must preserve both branch-specific loop-carried values.
    const control=path.join(directory,'unbounded.js');
    fs.writeFileSync(control,'function evaluate(a,b,m){return 3*a*(1-m)*(1-m)*m+3*b*(1-m)*m*m+m*m*m;}function transform(p,t){let start=0,end=1;for(;;){const m=(start+end)/2,x=evaluate(p[0],p[2],m);if(Math.abs(t-x)<.001)return evaluate(p[1],p[3],m);if(x<t)start=m;else end=m;}}const cases='+JSON.stringify(cases)+',times='+JSON.stringify(times)+';print(JSON.stringify(cases.map(item=>times.map(t=>transform(item.points,t)))));');
    for(const profile of ['Og','optimized','O-no-cfg','O-no-cfg-inline']){
      const bytecode=path.join(directory,'unbounded.hbc');run([...windowsHermesProfileFlags(profile),'-emit-binary','-out',bytecode,control]);
      assert.deepEqual(JSON.parse(run(['-exec','-b',bytecode],30_000)),expected.curves,profile+' original loop');
    }
  }finally{
    if(entryOwned){assert.equal(path.dirname(entry),runner);assert(!fs.lstatSync(entry).isSymbolicLink());fs.unlinkSync(entry);}
    assert.equal(path.dirname(directory),fs.realpathSync(os.tmpdir()));assert(path.basename(directory).startsWith('nelyx-hermes-curves-'));assert(!fs.lstatSync(directory).isSymbolicLink());fs.rmSync(directory,{recursive:true,force:true,maxRetries:5,retryDelay:100});
  }
});
