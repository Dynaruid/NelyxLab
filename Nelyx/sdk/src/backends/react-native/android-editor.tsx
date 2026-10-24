// SPDX-License-Identifier: BSD-3-Clause
import type {HostComponent,ViewProps,NativeSyntheticEvent} from 'react-native';
import type {Ref,ComponentRef} from 'react';
import type {ReactNativeBackend} from './registration.ts';
import type {NativeTextFieldProps,NativeTextFieldHandle} from './controls.tsx';
import type {NativeEditingSnapshot,ReactNativeEditorPort} from './interaction.ts';
import type {EditingConfiguration,TextInputAction} from '@nelyx/core/hosting/interaction';
import type {ViewOwner} from '@nelyx/core/ui/types';
interface NativeInputProps extends ViewProps {
  readonly initialValue:{readonly owner:ViewOwner;readonly text:string;readonly anchor:number;readonly focus:number};
  readonly coreDocument:{readonly value:string;readonly selection:{readonly anchor:number;readonly focus:number}};
  readonly editingConfiguration:EditingConfiguration;readonly editable:boolean;readonly maxLength:number;readonly inputAction:TextInputAction;
  readonly onNelyxEditing:(event:NativeSyntheticEvent<NativeEditingSnapshot>)=>void;
  readonly onNelyxInputBounds:(event:NativeSyntheticEvent<{readonly start:number;readonly end:number;readonly revision:number}>)=>void;
}
/** A nonvisual InputConnection View. Pointer policy and all glyphs belong to Core. */
export function createAndroidEditor(getBackend:()=>Pick<ReactNativeBackend,'react'|'native'>){
  let NativeInput:HostComponent<NativeInputProps>|undefined;
  return function AndroidInput(props:NativeTextFieldProps&{readonly ref?:Ref<NativeTextFieldHandle>}){
    const {react,native}=getBackend(),interaction=props.interaction,id=props.controlId??'editor';
    if(!interaction)throw new Error('Android input connections require a Core editing owner');
    const config=native.UIManager.getViewManagerConfig('NelyxInputConnection'),constants=config&&'Constants'in config?config.Constants:undefined;
    if(!constants||typeof constants!=='object'||!('inputConnectionProtocol'in constants)||constants.inputConnectionProtocol!==4)throw new Error('Rebuild Android nonvisual InputConnection protocol 4 bindings');
    NativeInput??=native.requireNativeComponent<NativeInputProps>('NelyxInputConnection');
    const ref=react.useRef<ComponentRef<HostComponent<NativeInputProps>>>(null),token=react.useRef({}),revision=react.useRef(0),sequence=react.useRef(0);
    const commands=react.useMemo<ReactNativeEditorPort>(()=>{
      const dispatch=(name:string,args:unknown[])=>{const tag=native.findNodeHandle(ref.current);if(tag===null)throw new Error('Android input connection detached');native.UIManager.dispatchViewManagerCommand(tag,name,args);};
      const replace=(name:string,text:string,selection:{start:number;end:number},expected=revision.current,request?:number)=>{const next=request??++sequence.current;sequence.current=Math.max(sequence.current,next);dispatch(name,[text,selection.start,selection.end,expected,next]);};
      return {readNativeTag:()=>native.findNodeHandle(ref.current),replace:(...args)=>replace('replace',...args),replaceComposing:(...args)=>replace('replaceComposing',...args),updateGeometry:(geometry,text,characters,nativeRevision)=>dispatch('geometry',[{geometry,text,characters,nativeRevision}]),focus:request=>dispatch('focus',[request??null]),blur:()=>{if(ref.current)dispatch('blur',[]);}};
    },[native]);
    react.useImperativeHandle(props.ref,()=>commands,[commands]);
    react.useLayoutEffect(()=>interaction.attachEditor(id,token.current,commands),[interaction,id,commands]);
    react.useSyncExternalStore(interaction.subscribe,interaction.snapshot);
    const state=interaction.editorInputState(id),value=interaction.editorCoreValue(id)??interaction.editorValue(id),configuration=interaction.editorConfiguration(id);
    return react.createElement(NativeInput,{ref,style:props.style,pointerEvents:'none',accessible:false,importantForAccessibility:'no',accessibilityLabel:state.label,focusable:state.enabled&&state.focusable,initialValue:{owner:interaction.owner,text:value?.text??props.initialValue,anchor:value?.selection.anchor??props.initialValue.length,focus:value?.selection.focus??props.initialValue.length},coreDocument:{value:value?.text??'',selection:value?.selection??{anchor:0,focus:0}},editingConfiguration:configuration,maxLength:props.maxLength??4096,inputAction:interaction.editorAction(id),editable:state.enabled&&!!value,onNelyxEditing:event=>{
      const snapshot=event.nativeEvent;if(snapshot.revision<=revision.current)return;revision.current=snapshot.revision;interaction.observeSnapshot(token.current,snapshot);
    },onNelyxInputBounds:event=>{const request=event.nativeEvent;interaction.requestCharacterBounds(token.current,request.start,request.end,request.revision);}});
  };
}
