// SPDX-License-Identifier: BSD-3-Clause
import fs from 'node:fs';import path from 'node:path';import http from 'node:http';import {createHash} from 'node:crypto';
import {serveWebDevelopment} from '@nelyx/metro/web-development';
import {readApplication} from './application.mjs';import {configureRunner} from './runner-configuration.mjs';import {execute} from './commands.mjs';
import {freshPackageDirectory,publishRunnerPackage,rememberPackage,packageFor,packRunner} from './runner-package.mjs';
import {localFile} from './files.mjs';
async function application(app){const value=await readApplication(app,'web');value.load('@nelyx/metro/web-config').inspectWebRunnerCohort({runnerRoot:value.runner});value.load('@nelyx/metro/assets').verifyAppAssets(value.app,value.config.assets);return value;}
export async function doctorWeb({app}){const value=await application(app);return {schema:'nelyx.doctor/v3',target:'web',runner:value.runner,cohort:value.cohort,profile:value.profile.id,implementation:value.profile.status,qualification:value.profile.qualification,adapters:{prepare:true,build:true,run:true,pack:true,dev:true}};}
export async function devWeb({app,host='127.0.0.1',port=8081}){
  if(!['127.0.0.1','localhost'].includes(host)||!Number.isSafeInteger(port)||port<1||port>65535)throw new Error('Web development requires a loopback host and port 1..65535');
  const controller=new AbortController(),interrupted=new Promise(resolve=>controller.signal.addEventListener('abort',resolve,{once:true})),stop=()=>controller.abort();let running;
  process.on('SIGINT',stop);process.on('SIGTERM',stop);
  try{
    const value=await application(app);controller.signal.throwIfAborted();
    const config=await value.load(path.join(value.runner,'metro.config.cjs'));controller.signal.throwIfAborted();
    running=await serveWebDevelopment({config,appRoot:value.app,assets:value.config.assets,readAssets:async()=>(await readApplication(value.app,'web')).config.assets,host,port,runtimeDirectory:process.env.NELYX_WEB_RUNTIME_ROOT});
    if(!controller.signal.aborted){process.stderr.write(JSON.stringify({event:'nelyx.dev.ready',target:'web',url:running.url,runner:value.runner})+'\n');await interrupted;}
    return {schema:'nelyx.dev/v2',target:'web',exitCode:0,url:running.url,runner:value.runner,scope:'Standard Metro HMR/React Refresh and pinned CanvasKit assets; awaited Metro/HTTP/socket close. Browser/root/SDK reload evidence is separate.',qualification:'notVerified'};
  }catch(error){if(!controller.signal.aborted)throw error;return {schema:'nelyx.dev/v2',target:'web',exitCode:0,scope:'Interrupted startup; any owned listener is awaited in finally',qualification:'notVerified'};}
  finally{try{await running?.close();}finally{process.off('SIGINT',stop);process.off('SIGTERM',stop);}}
}
export async function prepareWeb({app}){return {schema:'nelyx.prepare/v3',target:'web',...await configureRunner({app,target:'web'})};}
export async function buildWebApplication({app,output,configuration='Release'}){
  if(configuration!=='Release')throw new Error('Static Web packages require Release; development reload adapter is separate');
  const value=await application(app);await configureRunner({app:value.app,target:'web'});const directory=freshPackageDirectory(value.app,'web',output);
  await execute(process.execPath,[path.join(value.runner,'build.mjs'),directory],{cwd:value.runner});
  const build=JSON.parse(fs.readFileSync(path.join(directory,'build.json'),'utf8'));if(build.schema!=='nelyx.web-build/v1'||build.profile!==value.profile.id||build.development!==false||build.gpuBackend!=='webgl2')throw new Error('Web builder acknowledgement mismatch');
  const verified=publishRunnerPackage({directory,target:'web',application:value,entry:'index.html',details:{renderer:build.renderer,gpuBackend:build.gpuBackend,noticeQualification:build.noticeQualification}});rememberPackage(value.app,'web',directory);
  return {schema:'nelyx.build/v3',target:'web',directory,files:verified.files,bytes:verified.bytes,qualification:'notVerified'};
}
/** Serves only recorded static bytes. The caller owns the listener's close acknowledgement. */
export async function serveWeb({app,directory,host='127.0.0.1',port=8080}){
  if(!['127.0.0.1','::1','localhost'].includes(host)||!Number.isSafeInteger(port)||port<0||port>65535)throw new Error('Web server requires a loopback host and valid port');
  const verified=packageFor(app,'web',directory),records=new Map(verified.manifest.files.filter(record=>record.type==='file').map(record=>[record.path,record])),sockets=new Set();
  const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.map':'application/json','.wasm':'application/wasm','.png':'image/png','.ttf':'font/ttf','.md':'text/plain; charset=utf-8'};
  const server=http.createServer((request,response)=>{
    if(!['GET','HEAD'].includes(request.method)){response.writeHead(405,{Allow:'GET, HEAD'});response.end();return;}
    try{
      const pathname=decodeURIComponent(new URL(request.url,'http://localhost').pathname),name=pathname==='/'?'index.html':pathname.slice(1),record=records.get(name);
      if(!record){response.writeHead(404);response.end();return;}
      const bytes=fs.readFileSync(localFile(verified.directory,name));if(bytes.length!==record.bytes||createHash('sha256').update(bytes).digest('hex')!==record.sha256)throw new Error('Served package changed');
      response.writeHead(200,{'Content-Type':types[path.extname(name)]??'application/octet-stream','Content-Length':bytes.length,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});response.end(request.method==='HEAD'?undefined:bytes);
    }catch{response.writeHead(409);response.end('Static package unavailable or changed');}
  });
  server.on('connection',socket=>{sockets.add(socket);socket.once('close',()=>sockets.delete(socket));});
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(port,host,()=>{server.off('error',reject);resolve();});});
  const address=server.address(),url=`http://${host==='::1'?'[::1]':host}:${address.port}/`;let closing;
  return {url,directory:verified.directory,close(){return closing??=new Promise((resolve,reject)=>{server.close(error=>error?reject(error):resolve());for(const socket of sockets)socket.destroy();});}};
}
export async function runWeb(options){
  const running=await serveWeb({...options,port:options.port??8080});process.stderr.write(JSON.stringify({event:'nelyx.web-started',url:running.url,directory:running.directory})+'\n');
  return new Promise((resolve,reject)=>{let closing=false;const close=()=>{if(closing)return;closing=true;void running.close().then(()=>{cleanup();resolve({schema:'nelyx.run/v3',target:'web',exitCode:0});},error=>{cleanup();reject(error);});};const cleanup=()=>{process.off('SIGINT',close);process.off('SIGTERM',close);};process.on('SIGINT',close);process.on('SIGTERM',close);});
}
export function packWeb(options){return packRunner({...options,target:'web'});}
