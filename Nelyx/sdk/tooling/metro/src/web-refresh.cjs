// SPDX-License-Identifier: BSD-3-Clause
'use strict';
let beforeReload;
/** Runner installs its SDK/root close ACK before a full browser reload. */
function setWebReloadHandler(handler){beforeReload=handler;}
module.exports={setWebReloadHandler};

if(typeof __DEV__!=='undefined'&&__DEV__&&globalThis.__NELYX_WEB_DEVELOPMENT__){
  const metadata=globalThis.__NELYX_WEB_DEVELOPMENT__,Refresh=require('react-refresh/runtime'),HMRClient=require('metro-runtime/modules/HMRClient');
  const bundleUrl=new URL(metadata.bundle,location.href),socketUrl=new URL('/hot',location.href);socketUrl.protocol=location.protocol==='https:'?'wss:':'ws:';
  const state={connected:false,updates:0,reloads:0,errors:0,stage:'connecting'};let client,events,timer,disposed=false,reloading,updateFailed=false;
  function display(error){updateFailed=true;state.errors++;state.stage='error';let overlay=document.getElementById('nelyx-development-error');if(!overlay){overlay=document.createElement('pre');overlay.id='nelyx-development-error';overlay.setAttribute('role','alert');overlay.style.cssText='position:fixed;inset:16px;z-index:2147483647;overflow:auto;white-space:pre-wrap;background:#28151b;color:#fff;padding:20px;border:2px solid #e66;font:14px monospace';document.body.appendChild(overlay);}overlay.textContent=error?.message??String(error);}
  function clear(){document.getElementById('nelyx-development-error')?.remove();state.stage='ready';}
  const reload=()=>reloading??=(async()=>{state.stage='closing';state.reloads++;client.disable();if(!beforeReload)throw Error('Web runner must register its reload close handler');await beforeReload();state.stage='reloading';location.reload();})().catch(error=>{display(error);throw error;});
  const previousEval=globalThis.globalEvalWithSourceUrl;
  globalThis.globalEvalWithSourceUrl=(code,sourceURL)=>{if(disposed||reloading)return;if(previousEval)previousEval(code,sourceURL);else(0,eval)(code+'\n//# sourceURL='+String(sourceURL).replace(/[\r\n]/g,''));};
  Refresh.injectIntoGlobalHook(globalThis);
  globalThis[(globalThis.__METRO_GLOBAL_PREFIX__||'')+'__ReactRefresh']={
    createSignatureFunctionForTransform:Refresh.createSignatureFunctionForTransform,isLikelyComponentType:Refresh.isLikelyComponentType,getFamilyByType:Refresh.getFamilyByType,register:Refresh.register,
    performFullRefresh(){void reload().catch(()=>{});},performReactRefresh(){if(disposed||reloading)return;try{Refresh.performReactRefresh();}catch(error){display(error);}}
  };
  function connect(){
    if(disposed||reloading)return;const current=new HMRClient(socketUrl.toString());client=current;
    current.on('open',()=>{void(async()=>{
      const response=await fetch(new URL('/__nelyx/status',location.href),{signal:AbortSignal.timeout(5000)}),server=await response.json();
      if(disposed||reloading||current!==client)return;
      if(!response.ok||server.session!==metadata.session){await reload();return;}
      state.connected=true;state.stage='connected';current.send(JSON.stringify({type:'register-entrypoints',entryPoints:[bundleUrl.toString()]}));current.enable();
    })().catch(()=>current.close());});
    current.on('bundle-registered',()=>{if(!reloading)state.stage='ready';});
    current.on('update-start',()=>{updateFailed=false;});
    current.on('update-done',()=>{if(!updateFailed){state.updates++;if(!reloading)clear();}});
    current.on('error',error=>{if(current===client&&!reloading)display(error);});
    current.on('close',()=>{current.disable();if(current!==client)return;state.connected=false;if(!disposed&&!reloading){state.stage='disconnected';timer=setTimeout(connect,1000);}});
    current.on('connection-error',()=>{if(current===client)state.connected=false;});
  }
  connect();events=new EventSource(new URL(metadata.events,location.href));events.addEventListener('reload',()=>{void reload().catch(()=>{});});
  const close=()=>{disposed=true;clearTimeout(timer);events.close();client.close();};
  globalThis.__nelyxWebDevelopment={status:()=>({...state}),reload,close};
  addEventListener('error',event=>display(event.error??event.message));
  addEventListener('unhandledrejection',event=>display(event.reason));
  addEventListener('pagehide',close,{once:true});
}
