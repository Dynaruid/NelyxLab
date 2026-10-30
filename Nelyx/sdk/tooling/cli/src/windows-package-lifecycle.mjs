// SPDX-License-Identifier: BSD-3-Clause
import fs from 'node:fs';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {fileTree,localFile,sha256,verifyInventory} from './files.mjs';

const manifestName='nelyx-package.json';
function directDirectory(parent,directory){
  if(path.dirname(directory)!==parent||fs.realpathSync(parent)!==parent||fs.lstatSync(directory).isSymbolicLink()||fs.realpathSync(directory)!==directory)throw Error('Windows package cleanup path rejected');
}

/** Assets is the runner-owned output tree, rebuilt from verified app inputs. */
export function resetWindowsBuildAssets({app,configuration}){
  if(!['Debug','Release'].includes(configuration)||!path.isAbsolute(app)||fs.realpathSync(app)!==app)throw Error('Windows asset cleanup path rejected');
  const output=localFile(app,'windows/x64/'+configuration),assets=path.join(output,'Assets');
  if(!fs.statSync(output).isDirectory())throw Error('Windows asset output must be a directory');
  const retired=['OzeliRNHost.exe','OzeliRNHost.pdb','OzeliRNHost.pri'].map(name=>path.join(output,name)).filter(file=>fs.lstatSync(file,{throwIfNoEntry:false}));
  const assetStat=fs.lstatSync(assets,{throwIfNoEntry:false});
  // Validate every deletion target before changing any output. Native project
  // sources, the current host, runtime DLLs and the bundle are outside this set.
  for(const file of retired)if(fs.lstatSync(file).isSymbolicLink()||!fs.statSync(file).isFile()||fs.realpathSync(file)!==file)throw Error('Retired Windows host output rejected');
  if(assetStat){
    if(assetStat.isSymbolicLink()||!assetStat.isDirectory()||fs.realpathSync(assets)!==assets)throw Error('Windows asset cleanup symlink rejected');
    fileTree(assets);
  }
  for(const file of retired)fs.unlinkSync(file);
  if(assetStat)fs.rmSync(assets,{recursive:true});
  fs.mkdirSync(assets);return assets;
}

/** Publish only a fully verified package; failures preserve the previous locator. */
export function publishWindowsPackage({app,appName,directory,prepare,verify,replace=false,listRunning=runningWindowsPackages}){
  const parent=path.dirname(directory),work=path.join(parent,'.package-'+path.basename(directory));
  if(fs.realpathSync(parent)!==parent)throw Error('Windows package output parent symlink rejected');
  // The fixed work directory also excludes concurrent publication to this slot.
  fs.mkdirSync(work);
  const stage=path.join(work,'stage'),previous=path.join(work,'previous');
  const locator=path.join(app,'.nelyx/windows/last-package.json'),temporary=locator+'.'+randomUUID()+'.tmp';
  const cleanup={removed:[],retained:[]};let renamed=false,backedUp=false,committed=false;
  try{
    fs.mkdirSync(stage);
    prepare(stage);verify(stage);
    if(fs.existsSync(directory)){
      if(!replace)throw Error('Windows package output already exists');
      assertWindowsPackageReplaceable({app,appName,directory,listRunning});
      fs.renameSync(directory,previous);backedUp=true;
    }
    fs.renameSync(stage,directory);renamed=true;
    const verified=verify(directory);
    fs.writeFileSync(temporary,JSON.stringify({schema:'nelyx.rnw-package-locator/v1',directory,manifestSha256:sha256(localFile(directory,manifestName))},null,2)+'\n',{flag:'wx'});
    fs.renameSync(temporary,locator);committed=true;
    return {...verified,cleanup};
  }finally{
    try{
      fs.rmSync(temporary,{force:true});
      if(!committed){
        if(renamed){directDirectory(parent,directory);fs.rmSync(directory,{recursive:true});}
        if(backedUp){directDirectory(work,previous);fs.renameSync(previous,directory);backedUp=false;}
      }
    }finally{
      // A failed restore must leave the old package available for recovery.
      // oxlint-disable-next-line no-unsafe-finally -- Reject cleanup when directory ownership or rollback safety cannot be established.
      if(!committed&&backedUp)throw Error('Windows package restore failed; previous package preserved at '+previous);
      try{directDirectory(parent,work);fs.rmSync(work,{recursive:true});}
      // oxlint-disable-next-line no-unsafe-finally -- Retirement and finalization failures must propagate, including while unwinding a frame or test.
      catch(error){if(!committed)throw error;cleanup.retained.push({directory:work,reason:String(error.message??error)});}
    }
  }
}

function runningWindowsPackages(){
  const script="$ErrorActionPreference='Stop'; $paths=@(Get-CimInstance Win32_Process -Filter \"Name='NelyxRNHost.exe'\" | ForEach-Object { if (!$_.ExecutablePath) { throw 'Cannot inspect running Windows host' }; $_.ExecutablePath }); ConvertTo-Json -InputObject $paths -Compress";
  const result=spawnSync('powershell.exe',['-NoProfile','-NonInteractive','-Command',script],{encoding:'utf8',windowsHide:true,timeout:30000});
  if(result.error||result.status!==0)throw Error('Cannot inspect running Windows packages: '+String(result.error??result.stderr));
  const paths=JSON.parse(result.stdout.replace(/^\uFEFF/,''));
  if(!Array.isArray(paths)||paths.some(value=>typeof value!=='string'||!path.isAbsolute(value)))throw Error('Invalid running Windows package paths');
  return paths;
}

function ownedPackage(directory,appName){
  const manifest=JSON.parse(fs.readFileSync(localFile(directory,manifestName),'utf8'));
  if(manifest.schema!=='nelyx.rnw-package/v1'||manifest.target!=='windows'||!['rn-graphite-vulkan','rn-v8-graphite-vulkan','rn-jsc-graphite-vulkan'].includes(manifest.profile)||manifest.architecture!=='x64'||manifest.app!==appName||!['Debug','Release'].includes(manifest.configuration)||!new RegExp('^'+manifest.configuration+'(?:-\\d+)?$').test(path.basename(directory))||manifest.executable!=='NelyxRNHost.exe'||manifest.bundle!=='Bundle/index.windows.bundle')throw Error('Package ownership differs');
  for(const required of [manifest.executable,manifest.bundle,'hermes.dll'])if(!manifest.files?.some(file=>file.path===required))throw Error('Package ownership inventory incomplete');
  return manifest;
}
function assertNotRunning(directory,listRunning){
  if(listRunning().some(executable=>path.resolve(executable).toLowerCase().startsWith(directory.toLowerCase()+path.sep)))throw Error('Windows package is running; close the app before rebuilding: '+directory);
}

/** Only the app's fixed configuration slots can be replaced in place. */
export function assertWindowsPackageReplaceable({app,appName,directory,listRunning=runningWindowsPackages}){
  const root=path.resolve(app,'.nelyx/windows/packages');
  if(!['Debug','Release'].includes(path.basename(directory)))throw Error('Only fixed Windows configuration packages can be replaced');
  directDirectory(root,directory);const manifest=ownedPackage(directory,appName);
  assertNotRunning(directory,listRunning);verifyInventory(directory,manifest.files,[manifestName]);
}

/** Only managed, unmodified packages of this app may be removed after publication. */
export function pruneWindowsPackages({app,appName,current,listRunning=runningWindowsPackages}){
  const root=path.resolve(app,'.nelyx/windows/packages'),locator=path.join(app,'.nelyx/windows/last-package.json');
  const result={removed:[],retained:[]};
  if(!fs.existsSync(root))return result;
  try{
    if(fs.realpathSync(root)!==root)throw Error('Windows package root symlink rejected');
    const isCurrent=()=>{
      const value=JSON.parse(fs.readFileSync(localFile(path.dirname(locator),path.basename(locator)),'utf8'));
      return value.schema==='nelyx.rnw-package-locator/v1'&&value.directory===current&&value.manifestSha256===sha256(localFile(current,manifestName));
    };
    if(!isCurrent())throw Error('Windows package locator changed; cleanup skipped');
    const candidates=fs.readdirSync(root).filter(name=>/^(Debug|Release)-\d+$/.test(name)).map(name=>path.join(root,name)).filter(directory=>directory!==current);
    if(!candidates.length)return result;
    const running=listRunning().map(executable=>path.resolve(executable).toLowerCase());
    for(const directory of candidates){
      try{
        directDirectory(root,directory);
        const manifest=ownedPackage(directory,appName);
        if(running.some(executable=>executable.startsWith(directory.toLowerCase()+path.sep)))throw Error('Package is running; retry cleanup after it exits');
        // Old compiler/cohort versions are allowed, but changed files and links are not.
        verifyInventory(directory,manifest.files,[manifestName]);
        if(!isCurrent())throw Error('Windows package locator changed; cleanup skipped');
        directDirectory(root,directory);fs.rmSync(directory,{recursive:true});result.removed.push(directory);
      }catch(error){result.retained.push({directory,reason:String(error.message??error)});}
    }
  }catch(error){result.retained.push({directory:root,reason:String(error.message??error)});}
  return result;
}
