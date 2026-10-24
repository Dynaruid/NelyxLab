import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {runBuild} from 'metro';
import {readWebRuntime} from './web-runtime.mjs';
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
/** Build a self-contained Ganesh/WebGL2 static app from the consumer's Metro config. */
export async function buildWeb({config,entry,outputDirectory,assetsDirectory,profile='ganesh-webgl2',development=false,runtimeDirectory}){
  if(profile!=='ganesh-webgl2')throw new Error('Unsupported Web profile; use ganesh-webgl2');
  const require=createRequire(path.join(config.projectRoot,'package.json'));
  const {manifest,runtime,license}=readWebRuntime(config,runtimeDirectory);
  const output=path.resolve(outputDirectory);fs.mkdirSync(output,{recursive:true});
  const result=await runBuild(config,{entry:path.resolve(config.projectRoot,entry),platform:'web',dev:development,minify:false,sourceMap:true,sourceMapUrl:'application.js.map'});
  const map=JSON.parse(result.map);map.file='application.js';delete map.sourceRoot;
  map.sources=map.sources.map((_,index)=>`sources/${index}.js`);
  for(let index=0;index<map.sources.length;index++){const file=path.join(output,map.sources[index]);fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,map.sourcesContent[index]??'');}
  fs.writeFileSync(path.join(output,'application.js'),result.code+'\n//# sourceMappingURL=application.js.map\n');
  fs.writeFileSync(path.join(output,'application.js.map'),JSON.stringify(map));
  fs.cpSync(assetsDirectory,path.join(output,'assets'),{recursive:true});fs.mkdirSync(path.join(output,'runtime'),{recursive:true});
  for(const {file,bytes} of runtime)fs.writeFileSync(path.join(output,'runtime',file.id),bytes);
  fs.writeFileSync(path.join(output,'runtime/native-manifest.json'),JSON.stringify(manifest,null,2)+'\n');
  fs.mkdirSync(path.join(output,'licenses'),{recursive:true});
  fs.copyFileSync(license,path.join(output,'licenses/canvaskit-BSD-3-Clause.txt'));
  fs.copyFileSync(path.join(path.dirname(require.resolve('react-refresh/package.json')),'LICENSE'),path.join(output,'licenses/react-refresh-MIT.txt'));
  fs.copyFileSync(path.join(import.meta.dirname,'../licenses/metro-MIT.txt'),path.join(output,'licenses/metro-runtime-MIT.txt'));
  fs.copyFileSync(path.join(import.meta.dirname,'../licenses/eventemitter3-NOTICE.txt'),path.join(output,'licenses/eventemitter3-NOTICE.txt'));
  for(const [specifier,file,folder] of [['@nelyx/core/version','Nelyx-core-BSD-3-Clause.md','core'],['@nelyx/sdk/version','Nelyx-sdk-BSD-3-Clause.md','sdk'],['@nelyx/skia-web/library','Nelyx-skia-web-LICENSE.md','skia-web']]){
    const root=path.resolve(path.dirname(require.resolve(specifier)),'..');fs.copyFileSync(path.join(root,'LICENSE.md'),path.join(output,'licenses',file));
    if(fs.existsSync(path.join(root,'licenses')))fs.cpSync(path.join(root,'licenses'),path.join(output,'licenses',folder),{recursive:true,dereference:false});
  }
  fs.writeFileSync(path.join(output,'index.html'),'<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Nelyx Web</title><style>html,body{margin:0;background:#101827}#app{min-height:100vh}</style><div id="app"></div><script src="application.js"></script></html>\n');
  const files=['application.js','application.js.map','index.html','runtime/canvaskit.js','runtime/canvaskit.wasm','runtime/native-manifest.json'].map(file=>({path:file,sha256:digest(fs.readFileSync(path.join(output,file)))}));
  const build={schema:'nelyx.web-build/v1',profile,renderer:'skia-ganesh',gpuBackend:'webgl2',gpuImplementation:'browser-webgl2',development,files,sourceRebuild:'notVerified',noticeQualification:'PARTIAL'};
  fs.writeFileSync(path.join(output,'build.json'),JSON.stringify(build,null,2)+'\n');return {outputDirectory:output,...build};
}
