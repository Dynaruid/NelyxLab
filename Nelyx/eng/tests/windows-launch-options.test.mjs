// SPDX-License-Identifier: BSD-3-Clause
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {spawnSync} from 'node:child_process';
import {configureWindowsApplication} from '../../sdk/tooling/cli/src/application.mjs';
const timeout=1_200_000;

test('Windows build metadata carries the accessibility override and clears it for the next default build',{timeout},()=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'nelyx-launch-options-')),previous=process.env.NELYX_ACCESSIBILITY_ENABLED;
  try{
    const app={runner:root,config:{name:'TestApp',assets:[]}},file=path.join(root,'app-config.json');
    for(const value of ['false','true',undefined]){
      if(value===undefined)delete process.env.NELYX_ACCESSIBILITY_ENABLED;else process.env.NELYX_ACCESSIBILITY_ENABLED=value;
      configureWindowsApplication(app);const config=JSON.parse(fs.readFileSync(file));
      assert.equal(config.accessibilityEnabled,value===undefined?undefined:value==='true');
      assert.equal(Object.hasOwn(config,'accessibilityEnabled'),value!==undefined);
    }
    const before=fs.readFileSync(file);process.env.NELYX_ACCESSIBILITY_ENABLED='invalid';
    assert.throws(()=>configureWindowsApplication(app),/must be true or false/);assert.deepEqual(fs.readFileSync(file),before);
  }finally{
    if(previous===undefined)delete process.env.NELYX_ACCESSIBILITY_ENABLED;else process.env.NELYX_ACCESSIBILITY_ENABLED=previous;
    assert.equal(path.dirname(root),fs.realpathSync(os.tmpdir()));assert(path.basename(root).startsWith('nelyx-launch-options-'));
    fs.rmSync(root,{recursive:true,force:true});
  }
});

test('PowerShell switch reaches build and launch while restoring the caller environment and directory',{timeout,skip:process.platform!=='win32'},()=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'nelyx-launch-options-'));
  try{
    const sample=path.join(root,'sample/testbed'),bin=path.join(root,'bin'),log=path.join(root,'calls.jsonl');
    fs.mkdirSync(path.join(sample,'windows/runner/node_modules/.bin'),{recursive:true});fs.mkdirSync(bin);
    const script=path.join(sample,'start-windows-static-aot.ps1');
    fs.copyFileSync(new URL('../../../sample/nelyx-testbed-app-2/start-windows-static-aot.ps1',import.meta.url),script);
    fs.writeFileSync(path.join(sample,'windows/runner/node_modules/.bin/nelyx.cmd'),'');
    fs.writeFileSync(path.join(bin,'npm.cmd'),'@"%NELYX_TEST_NODE%" "%~dp0npm-test.mjs" %*\r\n');
    fs.writeFileSync(path.join(bin,'npm-test.mjs'),"import fs from 'node:fs';import path from 'node:path';if(process.argv.includes('build'))fs.writeFileSync(path.join(process.env.NELYX_TEST_RUNNER,'app-config.json'),JSON.stringify(process.env.NELYX_TEST_IGNORE==='1'?{}:{accessibilityEnabled:process.env.NELYX_ACCESSIBILITY_ENABLED==='false'?false:undefined}));fs.appendFileSync(process.env.NELYX_TEST_CALLS,JSON.stringify({args:process.argv.slice(2),accessibility:process.env.NELYX_ACCESSIBILITY_ENABLED,cwd:process.cwd()})+'\\n');process.exit(Number(process.env.NELYX_TEST_FAIL??0));");
    for(const scenario of [{disabled:true,repeat:2},{disabled:false,repeat:2},{disabled:false,previous:'',hermes:true,repeat:2},{disabled:true,previous:''},{disabled:false,previous:'true'},{disabled:false,previous:'false'},{disabled:false,fail:'3'},{disabled:true,previous:'true',fail:'3'},{disabled:true,ignore:'1'}]){
      fs.writeFileSync(log,'');const env={...process.env,PATH:bin+path.delimiter+process.env.PATH,NELYX_TEST_NODE:process.execPath,NELYX_TEST_SCRIPT:script,NELYX_TEST_CALLS:log,NELYX_TEST_FAIL:scenario.fail??'0',NELYX_TEST_IGNORE:scenario.ignore??'0',NELYX_TEST_RUNNER:path.join(sample,'windows/runner')};
      if(scenario.previous===undefined)delete env.NELYX_ACCESSIBILITY_ENABLED;else env.NELYX_ACCESSIBILITY_ENABLED=scenario.previous;
      const command="$ErrorActionPreference='Stop'; $before=(Get-Location).Path; for($iteration=0;$iteration -lt "+(scenario.repeat??1)+";$iteration++){ try { & $env:NELYX_TEST_SCRIPT "+(scenario.hermes?'':'-RefreshSdk ')+(scenario.disabled?'-DisableAccessibility ':'')+(scenario.hermes?'':'-Engine jsc -JscMode interpreter ')+"} catch { Write-Output ('EXPECTED_FAILURE='+$_.Exception.Message) }; Write-Output ('RESTORED='+$env:NELYX_ACCESSIBILITY_ENABLED); Write-Output ('RESTORED_PRESENT='+($null -ne [Environment]::GetEnvironmentVariable('NELYX_ACCESSIBILITY_ENABLED','Process'))); if((Get-Location).Path -ne $before){throw 'Working directory changed'} }";
      const result=spawnSync('pwsh',['-NoProfile','-Command',command],{env,cwd:root,encoding:'utf8',windowsHide:true,timeout});
      assert.ifError(result.error);assert.equal(result.status,0,result.stdout+result.stderr);
      assert(result.stdout.includes('RESTORED='+(scenario.previous??'')));
      assert.deepEqual([...result.stdout.matchAll(/RESTORED_PRESENT=(True|False)/g)].map(match=>match[1]),Array(scenario.repeat??1).fill(scenario.previous?'True':'False'),'An absent or empty override must be removed, including after a second launch');
      const calls=fs.readFileSync(log,'utf8').trim().split('\n').map(line=>JSON.parse(line));
      assert(calls.length);assert(calls.every(call=>call.accessibility===(scenario.disabled?'false':scenario.previous||undefined)),'Every launch must inherit only an explicit true/false override');
      if(scenario.ignore){assert(result.stdout.includes('disablement was not supplied'));assert(!calls.some(call=>call.args.includes('run:windows')));}
      else if(scenario.fail)assert.equal(calls.length,1,'A failed SDK step must not build or launch');
      else{assert(calls.some(call=>call.args.includes('build')));assert(calls.some(call=>call.args.includes('run:windows')));}
      if(scenario.hermes){assert.equal(calls.length,6);assert(calls.filter(call=>call.args.includes('build')).every(call=>call.args.includes('static-aot')&&call.args.includes('optimized')));}
    }
  }finally{
    assert.equal(path.dirname(root),fs.realpathSync(os.tmpdir()));assert(path.basename(root).startsWith('nelyx-launch-options-'));
    fs.rmSync(root,{recursive:true,force:true});
  }
});
