// SPDX-License-Identifier: BSD-3-Clause
import test from 'node:test';
import assert from 'node:assert/strict';
import {registerHooks} from 'node:module';
import {ReactNativeInteraction} from '../../sdk/dist/backends/react-native/interaction.js';

const timeout=1_200_000;
test('one Windows semantics tree subscribes once, refreshes every packet and preserves standalone node updates',{timeout},async()=>{
  const mocks=new Map([
    ['react-native/Libraries/Renderer/shims/ReactNativeViewConfigRegistry',"export const register=name=>name;"],
    ['react-native/Libraries/NativeComponent/ViewConfig',"export const createViewConfig=value=>value;"],
    ['react-native/Libraries/NativeComponent/BaseViewConfig',"export default {bubblingEventTypes:{},directEventTypes:{},validAttributes:{}};"],
  ]);
  const hook=registerHooks({resolve(name,context,next){return mocks.has(name)?{url:'data:text/javascript,'+encodeURIComponent(mocks.get(name)),shortCircuit:true}:next(name,context);}});
  const interaction=new ReactNativeInteraction({id:'tree',generation:1},{commands:true,selectionEvents:true,semantics:'native-controls'});
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
    const Node=createWindowsSemantics(()=>backend);mount({type:Node,props:{interaction,node:interaction.semanticNodes[0],surface:{nativeReactTag:42,nativeSurfaceGeneration:3,viewportGeneration:2},onError:props.onError}});
    assert.equal(subscriptions.length,1);binding.update(nodes(30));assert.equal(notifications,1,'A standalone node retains its own update subscription');
  }finally{unmount();binding.dispose();interaction.dispose();hook.deregister();}
});
