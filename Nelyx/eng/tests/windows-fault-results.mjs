// SPDX-License-Identifier: BSD-3-Clause
import fs from 'node:fs';import path from 'node:path';import {spawnSync} from 'node:child_process';import {createHash} from 'node:crypto';import {createRequire} from 'node:module';

/** Map only this execution's reported Core build failures. This supplements
 * the original failure and never turns a failed process into a qualification. */
export function symbolizeWindowsJavaScript(output,bundle,runner){
 const file=path.join(bundle,'input-surface.js.map');if(!fs.existsSync(file))return [];
 const {TraceMap,originalPositionFor}=createRequire(path.join(runner,'package.json'))('@jridgewell/trace-mapping'),map=new TraceMap(JSON.parse(fs.readFileSync(file,'utf8'))),result=[],canonical=value=>process.platform==='win32'?path.resolve(value).toLowerCase():path.resolve(value),owned=canonical(path.join(bundle,'input-surface.js'));
 for(const line of output.split('\n').filter(value=>value.startsWith('ANIMATION_JS CORE_FAILURE ')).slice(0,3)){
  const failure=JSON.parse(line.slice('ANIMATION_JS CORE_FAILURE '.length));
  for(const cause of (failure.causes??[]).slice(0,4)){
   const frames=[];for(const stackLine of String(cause.stack??'').split('\n').slice(0,25)){
    const position=stackLine.match(/(?:^|[\\/])input-surface\.js:(\d+):(\d+)\)?\s*$/);if(!position)continue;
    const filename=stackLine.slice(stackLine.lastIndexOf('(')+1,position.index+1)+'input-surface.js';if(canonical(filename)!==owned)continue;
    const line=Number(position[1]),column=Number(position[2]);if(!Number.isSafeInteger(line)||line<1||!Number.isSafeInteger(column)||column<1)continue;
    frames.push({generated:{line,column},...originalPositionFor(map,{line,column:column-1})});
   }
   result.push({path:cause.path,message:cause.message,frames});
  }
 }
 return result;
}

export function compactWindowsSymbols(records){
 return records.map(record=>{
  if(record.error)return {module:record.module,error:record.error};
  try{return {module:record.module,entries:JSON.parse(record.output).map(value=>({rva:Number(value.Address),symbols:value.Symbol.map(symbol=>{
   const full=symbol.FunctionName;let depth=0,name='';for(const character of full){if(character==='<'){if(depth++===0)name+='<...>';}else if(character==='>'){if(depth>0)depth--;}else if(!depth)name+=character;}
   const file=symbol.FileName.replaceAll('\\','/'),at=file.lastIndexOf('/source/');
   return {function:name.slice(0,320),signatureSha256:createHash('sha256').update(full).digest('hex'),resolved:full!=='??',file:at>=0?file.slice(at+8):file.slice(-240),line:symbol.Line,column:symbol.Column};
  })}))};}catch(error){return {module:record.module,error:'Symbol result could not be decoded: '+String(error)};}
 });
}

/** Resolve only images owned by this execution. Missing symbols supplement,
 * rather than replace, the original exception and process exit status. */
export function symbolizeWindowsFault(frames,directory,{compact=false}={}){
 const groups=new Map();for(const frame of frames){const name=frame.module;if(typeof name!=='string'||!name||path.basename(name)!==name||!Number.isSafeInteger(frame.rva)||frame.rva<0)continue;let addresses=groups.get(name);if(!addresses)groups.set(name,addresses=new Set());addresses.add(frame.rva);}
 const symbols=[];
 for(const [module,addresses]of groups){
  const image=path.resolve(directory,module);if(path.dirname(image)!==path.resolve(directory)||!fs.existsSync(image)||fs.lstatSync(image).isSymbolicLink())continue;
  const result=spawnSync(path.join(process.env.ProgramFiles,'LLVM/bin/llvm-symbolizer.exe'),['--obj='+image,'--relative-address','--no-inlines','--output-style=JSON',...[...addresses].slice(0,24).map(rva=>'0x'+rva.toString(16))],{encoding:'utf8',windowsHide:true,timeout:1_200_000,maxBuffer:1024*1024});
  const record={module,addresses:[...addresses].slice(0,24),output:compact?(result.stdout??''):(result.stdout??'').slice(0,24000),...(result.error||result.status!==0?{error:String(result.error??result.stderr).slice(0,2000)}:{})};
  symbols.push(compact?compactWindowsSymbols([record])[0]:record);
 }
 return symbols;
}
