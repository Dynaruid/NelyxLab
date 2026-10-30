// SPDX-License-Identifier: BSD-3-Clause
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {capture} from '../sdk/tooling/cli/src/commands.mjs';
import {supplyRunner,readRnlSupply} from '../sdk/tooling/cli/src/supply-runner.mjs';
import {checkWebRuntime} from '../skia/eng/prepare-web-runtime.mjs';
import {verifyPackageSourceInputs} from './package-source-inputs.mjs';
import {verifyNativeSourceInputs} from '../skia/eng/native-source-inputs.mjs';
const root=path.resolve(import.meta.dirname,'../..'),targets=(process.argv[2]??'web').split(',');
if(new Set(targets).size!==targets.length||targets.some(target=>!['android','ios','windows','macos','linux','web'].includes(target)))throw new Error('Choose one target or comma-separated distinct targets');
if(targets.includes('web'))checkWebRuntime();
const app=path.resolve(process.argv[3]??path.join(root,'sample/nelyx-testbed-app-2'));
const cache=path.join(root,'Nelyx/.cache/packages');fs.mkdirSync(cache,{recursive:true});
const allPackages=['core','sdk','skia-native','skia-rn','skia-web','metro','cli','static-aot','material','cupertino'],selected=process.env.NELYX_PREPARE_PACKAGES?.split(',');
if(selected&&(!selected.length||new Set(selected).size!==selected.length||selected.some(name=>!allPackages.includes(name))))throw Error('NELYX_PREPARE_PACKAGES must name distinct owned packages');
// npm pack deliberately skips build scripts. Verify its TS inputs before any
// archive/runner mutation, rather than discovering stale emit at native build.
const workspace=JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8'));
const packageDirectories=new Map(workspace.workspaces.map(directory=>{
  const folder=path.resolve(root,directory),manifest=JSON.parse(fs.readFileSync(path.join(folder,'package.json'),'utf8'));return [manifest.name,folder];
}));
for(const name of selected??allPackages){const directory=packageDirectories.get('@nelyx/'+name);if(!directory)throw Error('Workspace package absent: '+name);verifyPackageSourceInputs(directory);verifyNativeSourceInputs(directory);}
const packages=fs.mkdtempSync(path.join(cache,'supply-'));
try {
for(const name of selected??allPackages){
  const args=['pack','--workspace','@nelyx/'+name,'--pack-destination',packages,'--ignore-scripts','--json'];
  capture(process.platform==='win32'?'cmd.exe':'npm',process.platform==='win32'?['/d','/c','npm.cmd',...args]:args,{cwd:root,timeout:180000});
}
// One immutable packed candidate can supply several affected hosts.
for(const target of targets){
const extra={};
if(target==='linux')Object.assign(extra,readRnlSupply(path.resolve(process.argv[4]??path.join(root,'Nelyx/.cache/native/linux/supply-current/tarballs/supply.json'))));
if(target==='ios'||target==='macos'){
  const pin=JSON.parse(fs.readFileSync(path.join(root,'Nelyx/skia/vendor/apple-rn-binaries.lock.json'))).targets[target];
  const destination=path.join(root,'Nelyx/.cache/native/apple',pin.package+'-'+pin.version+'.tgz');
  if(!fs.existsSync(destination)){
    const response=await fetch(pin.url,{signal:AbortSignal.timeout(120000)});if(!response.ok)throw new Error('Apple supplier HTTP '+response.status);
    const bytes=Buffer.from(await response.arrayBuffer());
    if(createHash('sha256').update(bytes).digest('hex')!==pin.archiveSha256)throw new Error('Apple supplier hash mismatch');
    fs.mkdirSync(path.dirname(destination),{recursive:true});fs.writeFileSync(destination,bytes,{flag:'wx'});
  }
  if(createHash('sha256').update(fs.readFileSync(destination)).digest('hex')!==pin.archiveSha256)throw new Error('Apple supplier hash mismatch');
  extra[pin.package]='file:'+destination;
}
console.log({...supplyRunner({app,target,packages,extra,reuseCurrent:!!selected}),packageDirectory:packages});
}
} finally {
  const owned=path.resolve(packages);
  // oxlint-disable-next-line no-unsafe-finally -- Reject cleanup when directory ownership or rollback safety cannot be established.
  if(path.dirname(owned)!==cache||!path.basename(owned).startsWith('supply-')||fs.lstatSync(owned).isSymbolicLink())throw new Error('Unexpected package temporary directory owner');
  fs.rmSync(owned,{recursive:true,force:true});
}
