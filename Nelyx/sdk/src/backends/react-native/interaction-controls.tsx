// SPDX-License-Identifier: BSD-3-Clause
import type {SemanticsNode,SemanticsAction} from '@nelyx/core/ui/types';
import type {ReactNativeBackend} from './registration.ts';
import type {ReactNativeInteraction} from './interaction.ts';
import {nativeEditorStyle} from '../editor-style.ts';
import {createReactNativeControls} from './controls.tsx';
import {createAndroidSemantics} from './android-semantics.tsx';

/** Input endpoints have Core binding lifetimes; accessibility proxies have semantics lifetimes. */
export function createReactNativeInteractionControls(getBackend:()=>ReactNativeBackend) {
 const controls=createReactNativeControls(getBackend),AndroidSemantics=createAndroidSemantics(getBackend);
 return function InteractionControls({interaction,accessibilityEnabled=true}:{interaction:ReactNativeInteraction;accessibilityEnabled?:boolean}){
   const {react,native}=getBackend();react.useSyncExternalStore(interaction.subscribe,interaction.snapshot);
   const render=(node:SemanticsNode,parentX=0,parentY=0):import('react').ReactNode=>{
     const style={position:'absolute' as const,left:node.bounds.x-parentX,top:node.bounds.y-parentY,width:node.bounds.width,height:node.bounds.height};
     if(native.Platform.OS==='android')return react.createElement(AndroidSemantics,{key:node.id,node,interaction,style:style as import('react-native').ViewStyle},node.children?.map(child=>render(child,node.bounds.x,node.bounds.y)));
     if(node.role==='button')return react.createElement(controls.NativeButton,{key:node.id,label:node.name,interaction,controlId:node.id,onActivate:()=>{},passThrough:true,style});
     if(node.role==='text-field'){
       const {bounds:full,scaleX,scaleY}=node.editorGeometry??{bounds:node.bounds,scaleX:1,scaleY:1},width=full.width/scaleX,height=full.height/scaleY;
       // Stable clipping parent and stable TextInput: zoom must not end composition.
       const editorTransform={position:'absolute' as const,left:full.x-node.bounds.x+width*(scaleX-1)/2,top:full.y-node.bounds.y+height*(scaleY-1)/2,width,height,transform:[{scaleX},{scaleY}]};
       const editorStyle={position:'absolute',left:0,top:0,width,height,...(node.editorStyle?nativeEditorStyle(node.editorStyle,interaction.editorConfiguration(node.id)?.multiline??false):{color:'#e8eef8',backgroundColor:'#1e2c43',fontSize:18})};
       return react.createElement(native.View,{key:node.id,style:{...style,overflow:'hidden'},pointerEvents:'box-none',accessible:false},react.createElement(native.View,{style:editorTransform,pointerEvents:'box-none',accessible:false},react.createElement(controls.NativeTextField,{key:node.id,label:node.name,interaction,controlId:node.id,initialValue:interaction.editorValue(node.id)?.text??'',onText:()=>{},onSelection:()=>{},onFocus:()=>{},onBlur:()=>{},style:editorStyle})));
     }
     return react.createElement(native.View,{key:node.id,style:style as import('react-native').ViewStyle,pointerEvents:'box-none',accessible:!node.children?.length,accessibilityLabel:node.name,accessibilityRole:node.role==='image'?'image':node.role==='text'?'text':undefined,accessibilityState:{disabled:!node.enabled,...(node.selected!==undefined?{selected:node.selected}:{}),...(node.checked!==undefined?{checked:node.checked}:{})},...(node.value?{accessibilityValue:{text:node.value}}:{}),accessibilityActions:Object.keys(node.actions??{}).map(name=>({name})),onAccessibilityAction:event=>{if(interaction.isLiveNodeSnapshot(node))interaction.performAction(node.id,event.nativeEvent.actionName as SemanticsAction);}},node.children?.map(child=>render(child,node.bounds.x,node.bounds.y)));
   };
   const inputClients=native.Platform.OS==='android'||!accessibilityEnabled?interaction.editorClients.map(client=>{const bounds=interaction.editorInputBounds(client.id)??{x:0,y:0,width:1,height:1};return react.createElement(controls.NativeTextField,{key:`input:${client.id}:${client.generation}`,label:interaction.editorInputState(client.id).label,interaction,controlId:client.id,initialValue:interaction.editorCoreValue(client.id)?.text??'',onText:()=>{},onSelection:()=>{},onFocus:()=>{},onBlur:()=>{},style:{position:'absolute',left:bounds.x,top:bounds.y,width:bounds.width,height:bounds.height}});}):[];
   return react.createElement(react.Fragment,null,react.createElement(react.Fragment,{key:'semantics'},...(accessibilityEnabled?interaction.semanticNodes.map(node=>render(node)):[])),react.createElement(react.Fragment,{key:'input-clients'},...inputClients));
 }
}
