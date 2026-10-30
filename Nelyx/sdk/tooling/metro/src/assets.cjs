// SPDX-License-Identifier: BSD-3-Clause
'use strict';
const fs=require('node:fs'),path=require('node:path'),{createHash}=require('node:crypto');
/** Copy explicitly configured package assets to their app-local, content-qualified paths. */
function materializeAppAssets(projectRoot,assets,resolveModule){
  projectRoot=fs.realpathSync(projectRoot);if(!Array.isArray(assets)||assets.length>64||typeof resolveModule!=='function')throw new Error('Invalid package asset preparation');
  const pending=new Map(),ids=new Set();let total=verifyAppAssets(projectRoot,assets.filter(a=>a?.packageSource===undefined)).reduce((sum,a)=>sum+a.bytes+(a.notice?.bytes??0),0);
  const local=value=>typeof value==='string'&&/^\.\/[a-zA-Z0-9_./-]+$/.test(value)&&value.slice(2).split('/').every(p=>p&&p!=='.'&&p!=='..');
  function target(reference){if(!reference||!local(reference.path)||(reference.sha256!==undefined&&!/^[a-f0-9]{64}$/.test(reference.sha256)))throw new Error('Invalid package asset destination');let current=projectRoot;for(const part of reference.path.slice(2).split('/')){current=path.join(current,part);if(fs.existsSync(current)){const stat=fs.lstatSync(current);if(stat.isSymbolicLink())throw new Error('Package asset destination symlink rejected');}}const relative=path.relative(projectRoot,current);if(relative.startsWith('..')||path.isAbsolute(relative))throw new Error('Package asset outside application root');return current;}
  function prepare(reference,specifier,limit){const destination=target(reference),source=fs.realpathSync(resolveModule(specifier));if(!fs.statSync(source).isFile())throw new Error('Package asset source must be a regular file');const bytes=fs.readFileSync(source);total+=bytes.length;if(bytes.length>limit||total>64*1024*1024)throw new Error('Package asset byte budget');const hash=createHash('sha256').update(bytes).digest('hex');if(reference.sha256!==undefined&&hash!==reference.sha256)throw new Error('Package asset source hash mismatch: '+specifier);if(fs.existsSync(destination)){if(!fs.statSync(destination).isFile()||createHash('sha256').update(fs.readFileSync(destination)).digest('hex')!==hash)throw new Error('Refusing to replace an edited app asset: '+reference.path);return;}const prior=pending.get(destination);if(prior&&!prior.equals(bytes))throw new Error('Conflicting package asset destinations');pending.set(destination,bytes);}
  for(const asset of assets){if(!asset||typeof asset.id!=='string'||!asset.id||ids.has(asset.id)||!['image','font'].includes(asset.kind))throw new Error('Invalid/duplicate app asset');ids.add(asset.id);if(asset.packageSource===undefined)continue;const source=asset.packageSource;if(!source||Object.keys(source).some(k=>!['package','path','noticePath'].includes(k))||!/^(?:@[a-z0-9][a-z0-9._-]*\/)?[a-z0-9][a-z0-9._-]*$/.test(source.package)||!local(source.path)||(asset.notice!==undefined)!==(source.noticePath!==undefined)||source.noticePath!==undefined&&!local(source.noticePath))throw new Error('Invalid package asset source');if(asset.notice?.path===asset.path)throw new Error('Asset notice must be separate');prepare(asset,source.package+source.path.slice(1),16*1024*1024);if(asset.notice)prepare(asset.notice,source.package+source.noticePath.slice(1),1024*1024);}
  // Validate the entire source set before creating any output; existing files are never overwritten.
  for(const [destination,bytes]of pending){let current=projectRoot;for(const part of path.relative(projectRoot,path.dirname(destination)).split(path.sep).filter(Boolean)){current=path.join(current,part);fs.mkdirSync(current,{recursive:true});if(fs.lstatSync(current).isSymbolicLink()||fs.realpathSync(current)!==current)throw new Error('Package asset output ancestor symlink rejected');}fs.writeFileSync(destination,bytes,{flag:'wx'});}
  return verifyAppAssets(projectRoot,assets);
}
/** Verify SDK-configured app assets before the runner copies or bundles them. */
function verifyAppAssets(projectRoot,assets){
  projectRoot=fs.realpathSync(projectRoot);
  if(!Array.isArray(assets)||assets.length>64)throw new Error('App asset count budget: at most 64 references');
  const ids=new Set();let total=0;
  function verify(reference,limit){
    if(!reference||(reference.sha256!==undefined&&!/^[a-f0-9]{64}$/.test(reference.sha256))||typeof reference.path!=='string'||!/^\.\/[a-zA-Z0-9_./-]+$/.test(reference.path)||reference.path.slice(2).split('/').some(part=>!part||part==='.'||part==='..'))throw new Error('Invalid app-relative asset/notice reference');
    let file=projectRoot;for(const part of reference.path.slice(2).split('/')){file=path.join(file,part);if(fs.lstatSync(file).isSymbolicLink())throw new Error('App asset symlink rejected');}
    const actual=fs.realpathSync(file),relative=path.relative(projectRoot,actual);
    if(relative.startsWith('..')||path.isAbsolute(relative)||!fs.statSync(actual).isFile())throw new Error('App asset outside application root or non-regular');
    const bytes=fs.statSync(actual).size;total+=bytes;
    if(bytes>limit||total>64*1024*1024)throw new Error('App asset/notice byte budget');
    const sha256=createHash('sha256').update(fs.readFileSync(actual)).digest('hex');
    if(reference.sha256!==undefined&&sha256!==reference.sha256)throw new Error('App asset/notice hash mismatch: '+reference.path);
    return Object.freeze({...reference,sha256,file:actual,bytes});
  }
  return Object.freeze(assets.map(asset=>{
    if(!asset||typeof asset.id!=='string'||!asset.id||ids.has(asset.id)||!['image','font'].includes(asset.kind))throw new Error('Invalid/duplicate app asset');ids.add(asset.id);
    const verified=verify(asset,16*1024*1024);
    if(asset.notice?.path===asset.path)throw new Error('Asset notice must be a separate file');
    return Object.freeze({...verified,...(asset.notice===undefined?{}:{notice:verify(asset.notice,1024*1024)})});
  }));
}
/** Derive portable runtime metadata from app-owned input; never write hashes back to package.json. */
function prepareAppAssetConfiguration(projectRoot,runnerRoot){
  projectRoot=fs.realpathSync(projectRoot);runnerRoot=fs.realpathSync(runnerRoot);
  if(path.resolve(runnerRoot,'../..')!==projectRoot||path.basename(runnerRoot)!=='runner')throw new Error('Asset preparation requires an app-owned runner');
  const declared=JSON.parse(fs.readFileSync(path.join(projectRoot,'package.json'),'utf8')).nelyx;
  if(!declared||typeof declared.name!=='string'||!/^[A-Z][A-Za-z0-9]*$/.test(declared.name))throw new Error('Application package.json requires an nelyx configuration object');
  const load=require('node:module').createRequire(path.join(runnerRoot,'package.json'));
  const verified=materializeAppAssets(projectRoot,declared.assets,specifier=>load.resolve(specifier));
  const portable=({file,bytes,...reference})=>reference;
  const assets=verified.map(asset=>Object.freeze({...portable(asset),...(asset.notice?{notice:Object.freeze(portable(asset.notice))}:{})}));
  const file=path.join(runnerRoot,'app-config.json');let previous={};
  if(fs.existsSync(file)){if(!fs.lstatSync(file).isFile()||fs.lstatSync(file).isSymbolicLink())throw new Error('Runner app-config must be a regular file');previous=JSON.parse(fs.readFileSync(file,'utf8'));}
  const prepared={...previous,name:declared.name,assets},content=JSON.stringify(prepared,null,2)+'\n';
  if(!fs.existsSync(file)||fs.readFileSync(file,'utf8')!==content)fs.writeFileSync(file,content);
  return prepared;
}
/** Copy explicitly declared, verified notices into an owned artifact tree. */
function copyAppNotices(projectRoot,assets,destination){
  const verified=verifyAppAssets(projectRoot,assets);destination=path.resolve(destination);
  let ancestor=destination;while(!fs.existsSync(ancestor)&&path.dirname(ancestor)!==ancestor)ancestor=path.dirname(ancestor);
  if(fs.realpathSync(ancestor)!==ancestor)throw new Error('Notice output ancestor symlink rejected');
  fs.mkdirSync(destination,{recursive:true});if(fs.realpathSync(destination)!==destination||fs.lstatSync(destination).isSymbolicLink())throw new Error('Notice output symlink rejected');
  const records=new Map();
  for(const asset of verified){if(!asset.notice)continue;const notice=asset.notice,name=notice.path.slice(2);let parent=destination;
    for(const part of name.split('/').slice(0,-1)){parent=path.join(parent,part);fs.mkdirSync(parent,{recursive:true});if(fs.realpathSync(parent)!==parent||fs.lstatSync(parent).isSymbolicLink())throw new Error('Notice output symlink rejected');}
    const target=path.join(destination,name);let existing;try{existing=fs.lstatSync(target);}catch(error){if(error.code!=='ENOENT')throw error;}
    if(existing&&(!existing.isFile()||existing.isSymbolicLink()))throw new Error('Notice output must be a regular file');
    fs.copyFileSync(notice.file,target);if(createHash('sha256').update(fs.readFileSync(target)).digest('hex')!==notice.sha256)throw new Error('Copied asset notice changed');
    records.set(name,Object.freeze({path:name,sha256:notice.sha256,bytes:notice.bytes}));
  }
  return Object.freeze([...records.values()]);
}
/** Supply the exact app-declared font bytes to the Android Skia loader.
 * Only this manifest's previous hash-named font files are pruned. */
function copyAndroidFontAssets(projectRoot,assets,destination){
  const verified=verifyAppAssets(projectRoot,assets),fonts=verified.filter(asset=>asset.kind==='font');destination=path.resolve(destination);
  // oxlint-disable-next-line no-control-regex -- Control code points are deliberately matched for input validation or normalization.
  for(const font of fonts)if(typeof font.fontFamily!=='string'||font.fontFamily.length===0||font.fontFamily.length>256||/[\u0000-\u001f]/.test(font.fontFamily))throw new Error('Invalid Android font family: '+font.id);
  const records=fonts.map(font=>Object.freeze({id:font.id,family:font.fontFamily,sha256:font.sha256,bytes:font.bytes,file:'nelyx/fonts/'+font.sha256+'.ttf'})),unique=new Map(records.map(record=>[record.sha256,record]));
  const manifest=Object.freeze({schema:'nelyx.android-font-assets/v1',fonts:Object.freeze(records)});
  const encoded=JSON.stringify(manifest,null,2)+'\n';if(Buffer.byteLength(encoded)>65536)throw new Error('Android font manifest byte budget exceeded');
  function directory(target){let current=path.parse(target).root;for(const part of target.slice(current.length).split(path.sep).filter(Boolean)){current=path.join(current,part);if(fs.existsSync(current)){if(fs.lstatSync(current).isSymbolicLink()||!fs.statSync(current).isDirectory()||fs.realpathSync(current)!==current)throw new Error('Android font output ancestor must be a real directory');}else fs.mkdirSync(current);}}
  directory(destination);const owned=path.join(destination,'nelyx'),folder=path.join(owned,'fonts');directory(folder);
  const manifestFile=path.join(owned,'fonts.json');
  const safe=file=>typeof file==='string'&&/^nelyx\/fonts\/[a-f0-9]{64}\.ttf$/.test(file);
  let previous=[];
  if(fs.existsSync(manifestFile)){if(fs.lstatSync(manifestFile).isSymbolicLink())throw new Error('Android font manifest symlink rejected');if(fs.statSync(manifestFile).size>65536)throw new Error('Android font manifest byte budget exceeded');const value=JSON.parse(fs.readFileSync(manifestFile,'utf8'));if(value.schema!=='nelyx.android-font-assets/v1'||!Array.isArray(value.fonts)||value.fonts.length>64||value.fonts.some(font=>!font||!safe(font.file)||font.file!=='nelyx/fonts/'+font.sha256+'.ttf'))throw new Error('Unrecognized Android font output');previous=value.fonts;}
  for(const record of unique.values()){
    const target=path.join(destination,record.file),source=fonts.find(font=>font.sha256===record.sha256).file;
    if(fs.existsSync(target)&&(!fs.lstatSync(target).isFile()||fs.lstatSync(target).isSymbolicLink()))throw new Error('Android font output must be a regular file');
    fs.copyFileSync(source,target);if(createHash('sha256').update(fs.readFileSync(target)).digest('hex')!==record.sha256)throw new Error('Copied Android font changed');
  }
  const staging=fs.mkdtempSync(path.join(owned,'.fonts-')),temporary=path.join(staging,'fonts.json');
  try{fs.writeFileSync(temporary,encoded,{flag:'wx'});fs.renameSync(temporary,manifestFile);}finally{if(fs.existsSync(temporary))fs.unlinkSync(temporary);fs.rmdirSync(staging);}
  const current=new Set(records.map(record=>record.file));for(const record of previous)if(!current.has(record.file)){const target=path.join(destination,record.file);if(fs.existsSync(target)){if(!fs.lstatSync(target).isFile()||fs.lstatSync(target).isSymbolicLink())throw new Error('Retired Android font must be a regular file');fs.unlinkSync(target);}}
  return manifest;
}
module.exports={verifyAppAssets,copyAppNotices,materializeAppAssets,prepareAppAssetConfiguration,copyAndroidFontAssets};
