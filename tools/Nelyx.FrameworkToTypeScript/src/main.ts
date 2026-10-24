// SPDX-License-Identifier: BSD-3-Clause
import {createHash} from 'node:crypto';
import {readFile, realpath, lstat} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import ts from 'typescript';
import {lower, Unsupported} from './lower.ts';
import type {Syntax} from './lower.ts';
import {compareSelections} from './compare.ts';
import {freshScratch,within} from './paths.ts';
import {selectionId,validateSelections} from './selection.ts';
import type {Manifest} from './selection.ts';

const arguments_=process.argv.slice(2);
if(arguments_[0]==='batch'){
  const {batchMain}=await import('./batch.ts');await batchMain(arguments_.slice(1));process.exit(process.exitCode??0);
}
let selectedLanguage:string|undefined;
if(arguments_[0]?.startsWith('--language='))selectedLanguage=arguments_.shift()!.slice('--language='.length);
if(selectedLanguage&&!['csharp','dart'].includes(selectedLanguage))throw new Error('Language must be csharp or dart');
if(arguments_[0]==='compare'){
  if(arguments_.length!==4)throw new Error('bun run port compare <old-manifest> <new-manifest> <reviewed-repository-root>');
  console.log(JSON.stringify(await compareSelections(arguments_[1]!,arguments_[2]!,arguments_[3]!),null,2));process.exit(0);
}
const [manifestFile, sourceRoot, output] = arguments_;
if (!manifestFile || !sourceRoot || !output) throw new Error('bun run port <manifest.json> <source-root> <empty-draft-directory>');
const manifest = JSON.parse(await readFile(manifestFile, 'utf8')) as Manifest;
validateSelections(manifest);
const languages=new Set(manifest.selections.map(entry=>entry.language??'csharp'));
if(languages.size>1&&!selectedLanguage)throw new Error('Mixed source repositories require --language=csharp or --language=dart and the corresponding source root');
const selections=manifest.selections.filter(entry=>!selectedLanguage||(entry.language??'csharp')===selectedLanguage);
if(!selections.length)throw new Error('No selections match the requested language');
if(selections.some(entry=>entry.language==='dart'&&entry.mode==='automatic'))throw new Error('Use port batch for automatic Dart lowering; this legacy selection command is reviewed-only');
const resolvedTarget = await freshScratch(output);
const sourceBase = await realpath(sourceRoot);
type ResolvedCoverage={source:{revision:string;toolFrontendSha256?:string;files:{path:string;sha256:string;upstreamSha256?:string}[]};analysis:{sourceDiagnostics:unknown[]};items:{id:string;upstreamId:string;members:string[];dependencies:string[]}[]};
const dartCoverage=selections.some(entry=>entry.language==='dart')?JSON.parse(await readFile(path.resolve(import.meta.dir,'../../../Nelyx/upstream/flutter-coverage.json'),'utf8')) as ResolvedCoverage:undefined;
if(dartCoverage&&dartCoverage.source.toolFrontendSha256!==createHash('sha256').update(await readFile(path.resolve(import.meta.dir,'../dart/bin/inventory.dart'))).digest('hex'))throw new Error('Dart frontend changed or lacks identity; regenerate and adopt the resolved inventory before selecting symbols');
async function selectionSource(selection:{source:string;language?:string;packagePin?:{name:string;version:string;archiveSha256:string}}):Promise<string>{
  if(selection.language==='dart'&&selection.source.startsWith('package:')){
    const match=/^package:([A-Za-z_][A-Za-z0-9_]*)\/(.+)$/.exec(selection.source);if(!match)throw new Error('Invalid Dart package source URI');
    const configFile=path.resolve(import.meta.dir,'../dart/.dart_tool/package_config.json'),config=JSON.parse(await readFile(configFile,'utf8')) as {packages:{name:string;rootUri:string;packageUri?:string}[]};
    const entry=config.packages.find(entry=>entry.name===match[1]);if(!entry)throw new Error('Dart package is not in the locked frontend configuration');
    const root=await realpath(fileURLToPath(new URL(entry.rootUri,pathToFileURL(configFile)))),file=await realpath(path.resolve(root,entry.packageUri??'lib',match[2]!));
    if(selection.packagePin){
      const pin=selection.packagePin;
      if(pin.name!==match[1]||path.basename(root)!==`${pin.name}-${pin.version}`||!/^[a-f0-9]{64}$/.test(pin.archiveSha256))throw new Error('Dart package pin does not match the resolved cache identity');
      const hashFile=path.resolve(root,'../../../hosted-hashes/pub.dev',`${pin.name}-${pin.version}.sha256`);
      if((await readFile(hashFile,'utf8')).trim()!==pin.archiveSha256)throw new Error('Dart package archive pin mismatch');
    }
    if(!within(root,file))throw new Error('Dart package source escapes its root');return file;
  }
  const source=await realpath(path.resolve(sourceBase,selection.source));if(!within(sourceBase,source))throw new Error('Source escapes source root');return source;
}
const helper = path.resolve(import.meta.dir, '../roslyn/SourceReader.csproj');
if(selections.some(entry=>entry.language!=='dart')){
  const build = Bun.spawn(['dotnet','build',helper,'--nologo','-v:q'], {stdout:'pipe',stderr:'pipe',timeout:1200000});
  const buildOutput = await new Response(build.stdout).text();
  if (await build.exited !== 0) throw new Error(buildOutput + await new Response(build.stderr).text());
}
const report: unknown[] = []; let blocked = false;
for (const selection of selections) {
  const source=await selectionSource(selection);
  const bytes=await readFile(source);
  const hash = createHash('sha256').update(selection.language==='dart'&&!selection.source.startsWith('package:')?bytes.toString('utf8').replaceAll('\r\n','\n'):bytes).digest('hex');
  if (hash !== selection.sha256) throw new Error(`Source hash mismatch: ${selection.source}`);
  if(selection.language==='dart'){
    const coverage=dartCoverage!;
    const origin=coverage.items.find(item=>item.id===selection.coverageId),file=coverage.source.files.find(file=>file.path===selection.source);
    if(coverage.source.revision!==selection.revision||coverage.analysis.sourceDiagnostics.length||(file?.upstreamSha256??file?.sha256)!==hash||origin?.upstreamId!==selectionId(selection))throw new Error('Resolved Dart selection does not match the pinned coverage; regenerate and review the inventory');
    report.push({id:selectionId(selection),language:'dart',repository:selection.repository,revision:selection.revision,source:selection.source,hash,destination:selection.destination,rules:manifest.rules,status:'manual-port-required',origin,members:coverage.items.filter(item=>origin.members.includes(item.id)),dependencies:origin.dependencies});continue;
  }
  const process = Bun.spawn(['dotnet',path.join(path.dirname(helper),'bin/Debug/net10.0/SourceReader.dll'),source,selection.symbol,(selection.excludeMembers??[]).join(',')],{stdout:'pipe',stderr:'pipe',timeout:1200000});
  const raw = await new Response(process.stdout).text();
  if (await process.exited !== 0) throw new Error(await new Response(process.stderr).text());
  const analysis = JSON.parse(raw) as {node:Syntax;dependencies:string[];syntaxDiagnostics:string[];semanticDiagnostics:string[]};
  if (analysis.syntaxDiagnostics.length) throw new Error(analysis.syntaxDiagnostics.join('\n'));
  const id=selectionId(selection);
  const record = {id,language:selection.language??'csharp',repository:selection.repository??'Doroti',revision:selection.revision??manifest.revision,symbol:selection.symbol,source:selection.source,hash,destination:selection.destination,rules:manifest.rules,dependencies:analysis.dependencies,semanticDiagnostics:analysis.semanticDiagnostics,ports:selection.ports};
  if (selection.mode === 'reviewed-port') {report.push({...record,status:'manual-port-required',origin:analysis.node});continue;}
  try {
    if (analysis.semanticDiagnostics.length) throw new Unsupported(analysis.node,'unresolved semantic diagnostics block automatic lowering');
    const imports=Object.entries(selection.imports??{}).map(([name,module])=>`import {${name}} from ${JSON.stringify(module)};`).join('\n');
    const draft = `// Source: ${record.repository} ${record.revision} ${selection.source}; SHA256 ${hash}\n// Rules: ${manifest.rules}; omitted for review: ${(selection.excludeMembers??[]).join(', ')}\n` + imports+'\n'+lower(analysis.node,selection.excludeMembers??[],selection.imports??{});
    const parsed = ts.createSourceFile('draft.ts',draft,ts.ScriptTarget.ES2022,true,ts.ScriptKind.TS);
    const formatted = ts.createPrinter({newLine:ts.NewLineKind.LineFeed}).printFile(parsed);
    const file = path.join(resolvedTarget,selection.symbol+'-'+createHash('sha256').update(id).digest('hex').slice(0,12)+'.ts');
    try {await lstat(file);throw new Error('Draft exists; use a fresh output directory');}catch(error){if (!(error instanceof Error) || !('code' in error) || error.code !== 'ENOENT') throw error;}
    await Bun.write(file,formatted);report.push({...record,status:'draft-requires-review'});
  } catch(error) {if (!(error instanceof Unsupported)) throw error;blocked=true;report.push({...record,status:'blocked',diagnostic:error.message});}
}
await Bun.write(path.join(resolvedTarget,'analysis.json'),JSON.stringify(report,null,2));
console.log(`${selections.length} symbols analyzed; ${blocked ? 'unsupported automatic selections blocked' : 'review required'}; ${resolvedTarget}`);
process.exitCode=blocked?2:0;
