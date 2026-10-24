import {finishOwnedDisposal} from '../../runtime/owned-disposal.ts';
import type {ApplicationDefinition} from '@nelyx/core/hosting/runtime';
import type {CSSProperties} from 'react';
import {webBackend,openApplication,ownWebSurface} from './application.ts';
import type {WebApplication,WebApplicationOptions} from './application.ts';
export interface WebSurfaceProps {readonly definition:ApplicationDefinition;readonly options:Omit<WebApplicationOptions,'canvas'|'input'|'button'>;readonly style?:CSSProperties;readonly onReady?:(application:WebApplication)=>void;readonly onError?:(error:unknown)=>void}
/** RN Web owns the DOM root; StrictMode serializes each canvas's start/drain. */
export function ApplicationSurface(properties:WebSurfaceProps){
  const {react:React,native}=webBackend(),container=React.useRef<HTMLDivElement>(null),input=React.useRef<HTMLInputElement>(null),button=React.useRef<HTMLButtonElement>(null),drain=React.useRef(Promise.resolve());
  React.useEffect(()=>{
    const parent=container.current!,target=document.createElement('canvas'),lifetime=ownWebSurface(parent);let alive=true,application:WebApplication|undefined;
    target.style.cssText='width:100%;height:100%;display:block';target.setAttribute('aria-hidden','true');
    const previous=drain.current;
    // A disposed WebGL context cannot be reused on its old DOM canvas. Each
    // effect owns a fresh child, published only after the previous owner drains.
    const opened=previous.then(async()=>{if(!alive)return;parent.appendChild(target);application=await openApplication(properties.definition,{...properties.options,canvas:target,input:input.current!,button:button.current!,...(properties.onError?{onError:properties.onError}:{})});if(!alive){await finishOwnedDisposal(()=>application!.dispose());return;}application.view.requestFrame();properties.onReady?.(application);});
    void opened.catch(error=>{if(alive)properties.onError?.(error);});
    return ()=>{alive=false;const closed=previous.then(async()=>{try{await opened;}catch(error){if(error instanceof AggregateError)throw error;}await finishOwnedDisposal(()=>application?.dispose());target.remove();});drain.current=closed;void closed.then(()=>lifetime.complete(),error=>{lifetime.complete({error,retained:{application,target}});properties.onError?.(error);});};
  },[properties.definition,properties.options]);
  return React.createElement(native.View,{style:[{position:'relative',width:480,height:640},properties.style]},
    React.createElement('div',{ref:container,style:{width:'100%',height:'100%'}}),
    React.createElement(native.TextInput,{ref:input,style:{position:'absolute',display:'none',fontSize:22,color:'#e8eef8'}}),
    React.createElement('button',{ref:button,style:{position:'absolute',display:'none',fontSize:22}}));
}
