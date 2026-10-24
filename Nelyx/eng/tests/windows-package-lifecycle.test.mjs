// SPDX-License-Identifier: BSD-3-Clause
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {fileTree,sha256,verifyInventory} from '../../sdk/tooling/cli/src/files.mjs';
import {assertWindowsPackageReplaceable,publishWindowsPackage,pruneWindowsPackages} from '../../sdk/tooling/cli/src/windows-package-lifecycle.mjs';

const timeout=1_200_000,appName='LifecycleTest',manifestName='nelyx-package.json';
function fixture(run){
  const temporary=fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),'nelyx-windows-packages-')));
  const app=path.join(temporary,'app'),root=path.join(app,'.nelyx/windows/packages'),locator=path.join(app,'.nelyx/windows/last-package.json');
  fs.mkdirSync(root,{recursive:true});
  const write=(directory,contents='fixture')=>{
    fs.mkdirSync(path.join(directory,'Bundle'),{recursive:true});
    for(const name of ['NelyxRNHost.exe','hermes.dll','Bundle/index.windows.bundle'])fs.writeFileSync(path.join(directory,name),contents+' '+name);
    const files=fileTree(directory).map(name=>({path:name,bytes:fs.statSync(path.join(directory,name)).size,sha256:sha256(path.join(directory,name))}));
    fs.writeFileSync(path.join(directory,manifestName),JSON.stringify({schema:'nelyx.rnw-package/v1',target:'windows',profile:'rn-graphite-vulkan',architecture:'x64',configuration:path.basename(directory).startsWith('Debug')?'Debug':'Release',app:appName,executable:'NelyxRNHost.exe',bundle:'Bundle/index.windows.bundle',files}));
  };
  const make=name=>{const directory=path.join(root,name);write(directory);return directory;};
  const locate=directory=>fs.writeFileSync(locator,JSON.stringify({schema:'nelyx.rnw-package-locator/v1',directory,manifestSha256:sha256(path.join(directory,manifestName))}));
  const prune=(current,options={})=>pruneWindowsPackages({app,appName,current,listRunning:()=>[],...options});
  const verify=directory=>{const manifest=JSON.parse(fs.readFileSync(path.join(directory,manifestName),'utf8'));return verifyInventory(directory,manifest.files,[manifestName]);};
  try{run({app,root,locator,temporary,write,make,locate,prune,verify});}
  finally{
    assert.equal(path.dirname(temporary),fs.realpathSync(os.tmpdir()));assert(path.basename(temporary).startsWith('nelyx-windows-packages-'));assert(!fs.lstatSync(temporary).isSymbolicLink());
    fs.rmSync(temporary,{recursive:true,force:true});
  }
}

test('JSC packages can replace the fixed slot when switching modes and engines',{timeout},()=>fixture(f=>{
  const current=f.make('Release'),file=path.join(current,manifestName),manifest=JSON.parse(fs.readFileSync(file,'utf8'));
  fs.writeFileSync(file,JSON.stringify({...manifest,profile:'rn-jsc-graphite-vulkan',jscExecutionMode:'interpreter'}));
  assertWindowsPackageReplaceable({app:f.app,appName,directory:current,listRunning:()=>[]});
  publishWindowsPackage({app:f.app,appName,directory:current,replace:true,listRunning:()=>[],prepare(stage){f.write(stage);},verify:f.verify});
  assert.equal(JSON.parse(fs.readFileSync(file,'utf8')).profile,'rn-graphite-vulkan');
  assert(!fs.readdirSync(f.root).some(name=>name.startsWith('.package-')));
}));

test('publication verifies before replacing the locator, then prunes managed Debug/Release packages only',{timeout},()=>fixture(f=>{
  const old=f.make('Release-1'),debug=f.make('Debug-2');f.locate(old);
  const archive=path.join(f.root,'backup.zip');fs.writeFileSync(archive,'keep');
  const custom=f.make('custom-output'),external=path.join(f.temporary,'external');f.write(external);
  const current=path.join(f.root,'Release-3'),previous=fs.readFileSync(f.locator,'utf8');let checked=0;
  const result=publishWindowsPackage({app:f.app,directory:current,prepare:f.write,verify(directory){
    checked++;assert.equal(fs.readFileSync(f.locator,'utf8'),previous);assert(fs.existsSync(old));return f.verify(directory);
  }});
  assert.equal(checked,2);assert.equal(result.files,3);
  assert.equal(JSON.parse(fs.readFileSync(f.locator,'utf8')).directory,current);
  const cleanup=f.prune(current);assert.deepEqual(new Set(cleanup.removed),new Set([old,debug]));assert.deepEqual(cleanup.retained,[]);
  for(const preserved of [current,archive,custom,external])assert(fs.existsSync(preserved));
  assert(!fs.readdirSync(f.root).some(name=>name.startsWith('.package-')));
}));

test('copy, staged verification and final verification failures preserve the previous package and locator',{timeout},()=>fixture(f=>{
  const old=f.make('Release-1');f.locate(old);const previous=fs.readFileSync(f.locator,'utf8');
  for(const failure of ['copy','stage','final']){
    const current=path.join(f.root,'Release-2');let checks=0;
    assert.throws(()=>publishWindowsPackage({app:f.app,directory:current,prepare(stage){f.write(stage);if(failure==='copy')throw Error('copy failure');},verify(directory){
      checks++;if(checks===(failure==='stage'?1:2))throw Error('verification failure');return f.verify(directory);
    }}),/failure/);
    assert.equal(fs.readFileSync(f.locator,'utf8'),previous);f.verify(old);
    assert.deepEqual(fs.readdirSync(f.root),['Release-1']);
    assert.deepEqual(fs.readdirSync(path.dirname(f.locator)).sort(),['last-package.json','packages']);
  }
}));

test('locator commit failure rolls back the new package and removes staging/temporary locator',{timeout},()=>fixture(f=>{
  const old=f.make('Release-1');fs.mkdirSync(f.locator);fs.writeFileSync(path.join(f.locator,'keep'),'previous');
  assert.throws(()=>publishWindowsPackage({app:f.app,directory:path.join(f.root,'Release-2'),prepare:f.write,verify:f.verify}));
  f.verify(old);assert.equal(fs.readFileSync(path.join(f.locator,'keep'),'utf8'),'previous');
  assert.deepEqual(fs.readdirSync(f.root),['Release-1']);assert.deepEqual(fs.readdirSync(path.dirname(f.locator)).sort(),['last-package.json','packages']);
}));

test('running packages remain intact and are removed on the next build cleanup after exit',{timeout},()=>fixture(f=>{
  const old=f.make('Release-1'),current=f.make('Release-2');f.locate(current);
  const retained=f.prune(current,{listRunning:()=>[path.join(old,'NelyxRNHost.exe')]});
  assert.deepEqual(retained.removed,[]);assert.match(retained.retained[0].reason,/running/);f.verify(old);
  assert.deepEqual(f.prune(current).removed,[old]);assert(fs.existsSync(current));
}));

test('a custom output still prunes managed packages without deleting external siblings',{timeout},()=>fixture(f=>{
  const old=f.make('Release-1'),previous=path.join(f.temporary,'custom-previous'),current=path.join(f.temporary,'custom-current');
  f.write(previous);f.write(current);f.locate(current);
  assert.deepEqual(f.prune(current).removed,[old]);f.verify(previous);f.verify(current);
}));

test('foreign, malformed, modified and linked packages are preserved',{timeout},()=>fixture(f=>{
  const current=f.make('Release-9');f.locate(current);
  const foreign=f.make('Release-1'),foreignManifest=path.join(foreign,manifestName),manifest=JSON.parse(fs.readFileSync(foreignManifest,'utf8'));
  fs.writeFileSync(foreignManifest,JSON.stringify({...manifest,app:'AnotherApp'}));
  const modified=f.make('Release-2');fs.appendFileSync(path.join(modified,'hermes.dll'),'changed');
  const malformed=f.make('Release-3');fs.writeFileSync(path.join(malformed,manifestName),'{');
  const extra=f.make('Release-4');fs.writeFileSync(path.join(extra,'user-file'),'keep');
  const external=path.join(f.temporary,'external');f.write(external);
  const linked=path.join(f.root,'Release-5');fs.symlinkSync(external,linked,process.platform==='win32'?'junction':'dir');
  const nested=f.make('Release-6');fs.symlinkSync(external,path.join(nested,'link'),process.platform==='win32'?'junction':'dir');
  const cleanup=f.prune(current);assert.deepEqual(cleanup.removed,[]);assert.equal(cleanup.retained.length,6);
  for(const directory of [foreign,modified,malformed,extra,linked,nested,external])assert(fs.existsSync(directory));
  f.verify(external);f.verify(current);
}));

test('unavailable process inspection and changed locator skip cleanup',{timeout},()=>fixture(f=>{
  const old=f.make('Release-1'),current=f.make('Release-2');f.locate(current);
  assert.match(f.prune(current,{listRunning(){throw Error('inspection failed');}}).retained[0].reason,/inspection failed/);f.verify(old);
  f.locate(old);assert.match(f.prune(current).retained[0].reason,/locator changed/);f.verify(old);f.verify(current);
}));

test('a linked managed root cannot delete packages in another directory',{timeout},()=>fixture(f=>{
  const old=f.make('Release-1'),current=f.make('Release-2');f.locate(current);
  const external=path.join(f.temporary,'external');fs.renameSync(f.root,external);fs.symlinkSync(external,f.root,process.platform==='win32'?'junction':'dir');
  const cleanup=f.prune(current);assert.deepEqual(cleanup.removed,[]);assert.match(cleanup.retained[0].reason,/symlink/);
  f.verify(old);f.verify(current);
}));

test('repeated fixed-slot publication replaces bytes without accumulating packages or removing the other configuration',{timeout},()=>fixture(f=>{
  const directory=f.make('Release'),debug=f.make('Debug');f.locate(directory);
  for(const contents of ['second','third']){
    const result=publishWindowsPackage({app:f.app,appName,directory,replace:true,listRunning:()=>[],prepare(stage){f.write(stage,contents);},verify:f.verify});
    assert.deepEqual(result.cleanup,{removed:[],retained:[]});
    assert.equal(fs.readFileSync(path.join(directory,'hermes.dll'),'utf8'),contents+' hermes.dll');
    const locator=JSON.parse(fs.readFileSync(f.locator,'utf8'));assert.equal(locator.directory,directory);assert.equal(locator.manifestSha256,sha256(path.join(directory,manifestName)));
    assert.deepEqual(fs.readdirSync(f.root).sort(),['Debug','Release']);
    assert.deepEqual(f.prune(directory),{removed:[],retained:[]});f.verify(debug);
  }
}));

test('fixed-slot copy, stage/final verification and locator failures restore the original package and locator',{timeout},t=>fixture(f=>{
  const directory=f.make('Release');f.locate(directory);const previous=fs.readFileSync(f.locator,'utf8');
  for(const failure of ['copy','stage','final','locator']){
    let checks=0;
    const rename=fs.renameSync;
    const mocked=t.mock.method(fs,'renameSync',function(from,to){if(failure==='locator'&&to===f.locator)throw Error('locator failure');return rename(from,to);});
    try{
      assert.throws(()=>publishWindowsPackage({app:f.app,appName,directory,replace:true,listRunning:()=>[],prepare(stage){f.write(stage,'new');if(failure==='copy')throw Error('copy failure');},verify(candidate){
        checks++;if((failure==='stage'&&checks===1)||(failure==='final'&&checks===2))throw Error('verification failure');return f.verify(candidate);
      }}),/failure/);
    }finally{mocked.mock.restore();}
    assert.equal(fs.readFileSync(f.locator,'utf8'),previous);f.verify(directory);
    assert.equal(fs.readFileSync(path.join(directory,'hermes.dll'),'utf8'),'fixture hermes.dll');
    assert.deepEqual(fs.readdirSync(f.root),['Release']);assert.deepEqual(fs.readdirSync(path.dirname(f.locator)).sort(),['last-package.json','packages']);
  }
}));

test('a running fixed package is rejected before building and rechecked after staging',{timeout},()=>fixture(f=>{
  const directory=f.make('Release');f.locate(directory);const previous=fs.readFileSync(f.locator,'utf8'),listRunning=()=>[path.join(directory,'NelyxRNHost.exe')];
  assert.throws(()=>assertWindowsPackageReplaceable({app:f.app,appName,directory,listRunning}),/close the app before rebuilding/);
  assert.throws(()=>publishWindowsPackage({app:f.app,appName,directory,replace:true,listRunning,prepare(stage){f.write(stage,'new');},verify:f.verify}),/close the app before rebuilding/);
  assert.equal(fs.readFileSync(f.locator,'utf8'),previous);f.verify(directory);assert.deepEqual(fs.readdirSync(f.root),['Release']);
}));

test('fixed-slot replacement preserves modified, foreign and external output',{timeout},()=>fixture(f=>{
  const directory=f.make('Release');f.locate(directory);
  fs.appendFileSync(path.join(directory,'hermes.dll'),'user change');
  const publish=()=>publishWindowsPackage({app:f.app,appName,directory,replace:true,listRunning:()=>[],prepare:f.write,verify:f.verify});
  assert.throws(publish,/mismatch/);assert.match(fs.readFileSync(path.join(directory,'hermes.dll'),'utf8'),/user change/);
  fs.rmSync(path.join(directory,manifestName));f.write(directory);
  const manifest=JSON.parse(fs.readFileSync(path.join(directory,manifestName),'utf8'));fs.writeFileSync(path.join(directory,manifestName),JSON.stringify({...manifest,app:'OtherApp'}));
  assert.throws(publish,/ownership/);assert.equal(JSON.parse(fs.readFileSync(path.join(directory,manifestName),'utf8')).app,'OtherApp');
  const external=path.join(f.temporary,'Release');f.write(external);
  assert.throws(()=>publishWindowsPackage({app:f.app,appName,directory:external,replace:true,listRunning:()=>[],prepare:f.write,verify:f.verify}),/path rejected/);f.verify(external);
  assert.throws(()=>publishWindowsPackage({app:f.app,directory,prepare:f.write,verify:f.verify}),/already exists/);
  assert.deepEqual(fs.readdirSync(f.root),['Release']);
}));

test('an existing publication workspace blocks concurrent replacement and remains untouched',{timeout},()=>fixture(f=>{
  const directory=f.make('Release');f.locate(directory);const work=path.join(f.root,'.package-Release');fs.mkdirSync(work);fs.writeFileSync(path.join(work,'owner'),'keep');
  assert.throws(()=>publishWindowsPackage({app:f.app,appName,directory,replace:true,listRunning:()=>[],prepare:f.write,verify:f.verify}),{code:'EEXIST'});
  assert.equal(fs.readFileSync(path.join(work,'owner'),'utf8'),'keep');f.verify(directory);
}));
