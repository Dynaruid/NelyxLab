// SPDX-License-Identifier: BSD-3-Clause
import test from 'node:test';
import assert from 'node:assert/strict';
import {registerHooks} from 'node:module';
import {NativeInteraction} from '../../sdk/dist/runtime/native-interaction.js';

const timeout=1_200_000;
test('one Windows semantics tree subscribes once, refreshes every packet and preserves standalone node updates',{timeout},async()=>{
  const mocks=new Map([
    ['react-native/Libraries/Renderer/shims/ReactNativeViewConfigRegistry',"export const register=name=>name;"],
    ['react-native/Libraries/NativeComponent/ViewConfig',"export const createViewConfig=value=>value;"],
    ['react-native/Libraries/NativeComponent/BaseViewConfig',"export default {bubblingEventTypes:{},directEventTypes:{},validAttributes:{}};"],
  ]);
  const hook=registerHooks({resolve(name,context,next){return mocks.has(name)?{url:'data:text/javascript,'+encodeURIComponent(mocks.get(name)),shortCircuit:true}:next(name,context);}});
  const interaction=new NativeInteraction({id:'tree',generation:1},{commands:true,selectionEvents:true,semantics:'native-controls'});
  const subscriptions=[],packets=[];let notifications=0;
  const backend={react:{
    Fragment:Symbol('Fragment'),
    useSyncExternalStore(subscribe,read){subscriptions.push(subscribe(()=>notifications++));return read();},
    useRef(){return {current:null};},useLayoutEffect(){},
    createElement(type,props,...children){return {type,props:{...props,children}};},
  },native:{NativeModules:{NelyxWindowsSemantics:{getSemanticsProtocol:()=>4}},findNodeHandle:()=>42}};
  const nodes=y=>Array.from({length:24},(_,i)=>({id:'node'+i,sourceNodeId:i+1,role:'button',name:'Button '+i,enabled:true,bounds:{x:0,y:y+i*30,width:100,height:28},actions:{activate(){}}}));
  const binding=interaction.semantics.bind(nodes(0));
  const unmount=()=>{for(const unsubscribe of subscriptions.splice(0))unsubscribe();};
  const mount=element=>{if(!element)return;if(Array.isArray(element)){element.forEach(mount);return;}if(typeof element.type==='function'){mount(element.type(element.props));return;}if(element.props?.coreSnapshot)packets.push(element.props.coreSnapshot);mount(element.props?.children);};
  try{
    const {createWindowsSemanticsTree,createWindowsSemantics}=await import('../../sdk/dist/backends/react-native/windows-semantics.js');
    const Tree=createWindowsSemanticsTree(()=>backend),props={interaction,readView:()=>({currentMetrics:{nativeSurfaceGeneration:3,viewportGeneration:2}}),readNativeMetrics:()=>({nativeReactTag:42}),onError:error=>{throw error;}};
    mount({type:Tree,props});assert.equal(subscriptions.length,1);assert.equal(packets.length,24);
    notifications=0;binding.update(nodes(10));assert.equal(notifications,1,'A moving tree must schedule one store update regardless of node count');
    unmount();packets.length=0;mount({type:Tree,props});assert.equal(subscriptions.length,1);assert.equal(packets.length,24);
    for(let i=0;i<24;i++){assert.equal(packets[i].bounds.y,10+i*30);assert.equal(packets[i].commit,interaction.snapshot());}
    unmount();notifications=0;binding.update(nodes(20));assert.equal(notifications,0);
    const Node=createWindowsSemantics(()=>backend);mount({type:Node,props:{interaction,node:interaction.semanticNodes[0],surface:{surfaceId:42,nativeSurfaceGeneration:3,viewportGeneration:2},onError:props.onError}});
    assert.equal(subscriptions.length,1);binding.update(nodes(30));assert.equal(notifications,1,'A standalone node retains its own update subscription');
  }finally{unmount();binding.dispose();interaction.dispose();hook.deregister();}
});

test('a queued native focus reaches the live field after a newer React commit, while aborted and unmounted receivers retire',{timeout},async()=>{
  const mocks=new Map([
    ['react-native/Libraries/Renderer/shims/ReactNativeViewConfigRegistry',"export const register=name=>name;"],
    ['react-native/Libraries/NativeComponent/ViewConfig',"export const createViewConfig=value=>value;"],
    ['react-native/Libraries/NativeComponent/BaseViewConfig',"export default {bubblingEventTypes:{},directEventTypes:{},validAttributes:{}};"],
  ]);
  const hook=registerHooks({resolve(name,context,next){return mocks.has(name)?{url:'data:text/javascript,'+encodeURIComponent(mocks.get(name)),shortCircuit:true}:next(name,context);}});
  const interaction=new NativeInteraction({id:'focus-race',generation:1},{commands:true,selectionEvents:true,semantics:'native-controls'}),calls=[];
  const refs=[],effects=[];let cursor=0,pending=[];
  const backend={react:{
    useSyncExternalStore(_subscribe,read){cursor++;return read();},
    useRef(value){const index=cursor++;return refs[index]??={current:value};},
    useLayoutEffect(callback,deps){const index=cursor++,previous=effects[index];if(!deps||!previous||deps.some((value,i)=>value!==previous.deps?.[i]))pending.push({index,callback,deps});},
    createElement(type,props,...children){return {type,props:{...props,children}};},
  },native:{NativeModules:{NelyxWindowsSemantics:{getSemanticsProtocol:()=>4}},findNodeHandle:()=>42}};
  const field=(y,label)=>({id:'field',sourceNodeId:7,role:'text-field',name:'Core',bounds:{x:1,y,width:100,height:30},enabled:true,focusable:true,focused:false,textInputRevision:11,textRevision:4,textInputGeneration:5,value:'Core',actions:{focus:()=>calls.push(label)}});
  const binding=interaction.semantics.bind([field(0,'first')]),surface={surfaceId:42,nativeSurfaceGeneration:3,viewportGeneration:2};
  const unmount=()=>{for(const effect of effects.splice(0))effect?.cleanup?.();};
  try{
    const {createWindowsSemantics}=await import('../../sdk/dist/backends/react-native/windows-semantics.js'),Node=createWindowsSemantics(()=>backend);
    const render=(commit=true)=>{
      cursor=0;pending=[];
      const element=Node({interaction,node:interaction.semanticNodes[0],surface,onError:error=>{throw error;}});
      if(commit)for(const effect of pending){effects[effect.index]?.cleanup?.();effects[effect.index]={deps:effect.deps,cleanup:effect.callback()};}
      return element.props;
    };
    const first=render(),event={protocol:1,id:'field',source:7,commit:first.coreSnapshot.commit,kind:'focus'};
    binding.update([field(10,'latest')]);const current=render();assert.notEqual(current.coreSnapshot.commit,event.commit);
    current.onCoreSemanticsAction({nativeEvent:event});assert.deepEqual(calls,['latest'],'React may commit again before the native focus event reaches its latest handler');
    binding.update([field(20,'aborted')]);const abandoned=render(false);
    current.onCoreSemanticsAction({nativeEvent:{...event,commit:abandoned.coreSnapshot.commit}});assert.deepEqual(calls,['latest'],'An abandoned render never publishes an actionable native packet');
    current.onCoreSemanticsAction({nativeEvent:event});assert.deepEqual(calls,['latest','aborted'],'A real published request uses the current live callback');
    unmount();current.onCoreSemanticsAction({nativeEvent:event});assert.deepEqual(calls,['latest','aborted'],'An unmounted receiver cannot keep an active Core action');
  }finally{unmount();binding.dispose();interaction.dispose();hook.deregister();}
});
