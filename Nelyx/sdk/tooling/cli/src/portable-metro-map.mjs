// SPDX-License-Identifier: BSD-3-Clause
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {relativeFile,localFile} from './files.mjs';

const allowed=new Set(['version','file','sourceRoot','sources','sourcesContent','names','mappings','x_facebook_sources','x_google_ignoreList','x_hermes_function_offsets']);
const alphabet='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
function verifyMappings(map){
  let source=0,line=0,column=0,name=0,generated=0,value=0,shift=0,pending=false,mapped=false,fields=[],previous=';';
  const integer=value=>{if(!Number.isSafeInteger(value)||value<0)throw Error('Invalid Metro mapping offset');return value;};
  for(let index=0;index<=map.mappings.length;index++){
    const char=index===map.mappings.length?';':map.mappings[index];
    if(char===','||char===';'){
      if(pending||!fields.length&&(char===','||previous===','))throw Error('Incomplete Metro mapping segment');
      if(fields.length){
        if(![1,4,5].includes(fields.length)||fields[0]<0)throw Error('Invalid Metro mapping segment');
        generated=integer(generated+fields[0]);
        if(fields.length>1){source=integer(source+fields[1]);line=integer(line+fields[2]);column=integer(column+fields[3]);if(source>=map.sources.length)throw Error('Metro mapping source index differs');mapped=true;}
        if(fields.length===5){name=integer(name+fields[4]);if(name>=map.names.length)throw Error('Metro mapping name index differs');}
      }
      fields=[];if(char===';')generated=0;previous=char;continue;
    }
    const digit=alphabet.indexOf(char);if(digit<0)throw Error('Invalid Metro mapping VLQ');
    value+=(digit&31)*2**shift;if(!Number.isSafeInteger(value))throw Error('Metro mapping VLQ overflow');
    pending=Boolean(digit&32);
    if(pending){if(shift>=50)throw Error('Metro mapping VLQ overflow');shift+=5;}
    else{fields.push(Math.floor(value/2)*(value%2?-1:1));if(fields.length>5)throw Error('Invalid Metro mapping segment');value=0;shift=0;}
    previous=char;
  }
  if(!mapped)throw Error('Metro source map has no source mappings');
}
function readMap(file){
  if(fs.statSync(file).size>128*1024*1024)throw Error('Metro source map exceeds128MiB');
  const map=JSON.parse(fs.readFileSync(file,'utf8'));
  if(!map||map.version!==3||Object.keys(map).some(key=>!allowed.has(key))||(map.file!==undefined&&typeof map.file!=='string')||(map.sourceRoot!==undefined&&typeof map.sourceRoot!=='string')||!Array.isArray(map.sources)||!map.sources.length||map.sources.length>2048||map.sources.some(value=>typeof value!=='string')||!Array.isArray(map.sourcesContent)||map.sourcesContent.length!==map.sources.length||map.sourcesContent.some(value=>typeof value!=='string')||typeof map.mappings!=='string'||!map.mappings||!Array.isArray(map.names)||map.names.some(value=>typeof value!=='string'))throw Error('Complete flat Metro source map required');
  if(map.sourcesContent.reduce((size,text)=>size+Buffer.byteLength(text),0)>64*1024*1024)throw Error('Metro source text exceeds64MiB');
  if(map.x_facebook_sources!==undefined&&(!Array.isArray(map.x_facebook_sources)||map.x_facebook_sources.length!==map.sources.length))throw Error('Metro function map source identities differ');
  if(map.x_google_ignoreList!==undefined&&(!Array.isArray(map.x_google_ignoreList)||map.x_google_ignoreList.some(value=>!Number.isSafeInteger(value)||value<0||value>=map.sources.length)))throw Error('Metro ignore-list source identity differs');
  if(map.x_hermes_function_offsets!==undefined&&(!map.x_hermes_function_offsets||typeof map.x_hermes_function_offsets!=='object'||Array.isArray(map.x_hermes_function_offsets)||Object.entries(map.x_hermes_function_offsets).some(([key,offsets])=>!/^\d+$/.test(key)||!Array.isArray(offsets)||offsets.some((value,index)=>!Number.isSafeInteger(value)||value<0||index>0&&value<offsets[index-1]))))throw Error('Invalid Hermes function offsets');
  verifyMappings(map);
  return map;
}
function portableName(source,app,runner,sourceRoot){
  if(source==='__prelude__')return 'source-maps/generated/__prelude__.js';
  if(sourceRoot!==undefined&&typeof sourceRoot!=='string')throw Error('Invalid Metro source root');
  const normalized=source.replaceAll('\\','/'),file=normalized.startsWith('file:')?fileURLToPath(normalized):path.resolve(runner,sourceRoot??'',normalized),relative=path.relative(app,file).replaceAll('\\','/');
  relativeFile(relative);if(relative.startsWith('../')||path.isAbsolute(relative))throw Error('Metro source escaped its owning app');
  return 'source-maps/app/'+relative;
}
/** Normalize a copied map in fresh package staging; producer files stay intact. */
export function writePortableMetroMap({app,runner,directory,bundle,mapPath=bundle+'.map'}){
  app=fs.realpathSync(app);runner=fs.realpathSync(runner);directory=fs.realpathSync(directory);relativeFile(bundle);
  const mapFile=localFile(directory,mapPath),map=readMap(mapFile),base=path.dirname(mapFile),names=map.sources.map(source=>portableName(source,app,runner,map.sourceRoot)),texts=new Map(),caseNames=new Map();
  // Validate every output before publishing any new source file.
  for(let index=0;index<names.length;index++){
    const name=relativeFile(names[index]),lower=name.toLowerCase();
    if(caseNames.has(lower)&&caseNames.get(lower)!==name||texts.has(name)&&texts.get(name)!==map.sourcesContent[index])throw Error('Metro source identity collision');
    caseNames.set(lower,name);texts.set(name,map.sourcesContent[index]);
  }
  if(fs.existsSync(path.join(base,'source-maps')))throw Error('Portable source output must be a fresh directory');
  for(const [name,text]of texts){const file=path.join(base,name);fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,text,{flag:'wx'});}
  map.file=path.basename(bundle);delete map.sourceRoot;map.sources=names;fs.writeFileSync(mapFile,JSON.stringify(map));
  return {modules:map.sources.length,sourceFiles:texts.size};
}
/** Inventory hashes alone do not establish safe, complete source-map paths. */
export function verifyPortableMetroMap({directory,records,bundle,mapPath=bundle+'.map'}){
  relativeFile(bundle);relativeFile(mapPath);const names=new Set(records.map(record=>record.path));
  if(!names.has(mapPath))throw Error('Portable Metro source map missing');
  const map=readMap(localFile(directory,mapPath));
  if(map.sourceRoot!==undefined||map.file!==path.basename(bundle))throw Error('Portable Metro source map identity differs');
  const sourceFiles=new Set(),base=path.posix.dirname(mapPath),caseNames=new Map();
  for(let index=0;index<map.sources.length;index++){
    const source=relativeFile(map.sources[index]);
    if(source!=='source-maps/generated/__prelude__.js'&&!source.startsWith('source-maps/app/'))throw Error('Portable Metro source path escaped');
    const file=base==='.'?source:base+'/'+source,lower=file.toLowerCase();
    if(caseNames.has(lower)&&caseNames.get(lower)!==file||!names.has(file)||fs.readFileSync(localFile(directory,file),'utf8')!==map.sourcesContent[index])throw Error('Portable Metro source text missing or changed');
    caseNames.set(lower,file);sourceFiles.add(file);
  }
  return {modules:map.sources.length,sourceFiles:sourceFiles.size};
}
