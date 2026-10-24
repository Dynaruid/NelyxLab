import {nativeEditingConfiguration} from './editing-configuration.ts';
import {freezeEditingConfiguration} from '@nelyx/core/hosting/interaction';
import {nativeControlInputProps} from './control-input.ts';
import {windowsSurfaceEnvelope} from './windows-surface-envelope.ts';
// SPDX-License-Identifier: BSD-3-Clause
import type {ReactNode,Ref} from 'react';
import type {TextInput} from 'react-native';
import type {ReactNativeBackend} from './registration.ts';
import type {ReactNativeInteraction} from './interaction.ts';
import {createAndroidEditor} from './android-editor.tsx';
import {editorColor} from '../editor-style.ts';
export interface NativeStyle { readonly [property: string]: string | number | boolean | undefined }
export interface NativeLayerProps { readonly style?: NativeStyle; readonly children?: ReactNode; readonly passThrough?: boolean }
export interface NativeTextFieldHandle { replace(text: string, selection: { start: number; end: number }): void; focus(): void;blur():void }
export interface NativeTextFieldProps {
  readonly label: string; readonly initialValue: string; readonly maxLength?: number; readonly style?: NativeStyle;
  readonly onText: (text: string, revision: number) => void;
  readonly onSelection: (start: number, end: number) => void;
  readonly onFocus: () => void; readonly onBlur: () => void;
  readonly interaction?: ReactNativeInteraction; readonly controlId?: string;
}
export interface NativeButtonProps extends NativeLayerProps {readonly label:string;readonly onActivate:()=>void;readonly interaction?:ReactNativeInteraction;readonly controlId?:string;}
/** Components are created once per platform composition and resolve initialized modules when rendered. */
export function createReactNativeControls(getBackend:()=>Pick<ReactNativeBackend,'react'|'native'>) {
const AndroidEditor=createAndroidEditor(getBackend);
function NativeLayer({ style, children, passThrough }: NativeLayerProps) { const {react, native} = getBackend(); return react.createElement(native.View, {style,...(native.Platform.OS==='windows'?{collapsable:false,testID:windowsSurfaceEnvelope(style)}:{}),pointerEvents: passThrough ? 'box-none' : 'auto'}, children); }
function NativeText({ style, children, scale = true }: NativeLayerProps & { readonly scale?: boolean }) { const {react, native} = getBackend(); return react.createElement(native.Text, {style, allowFontScaling: scale}, children); }
function NativeButton({ style, children, label, onActivate, interaction, controlId,passThrough }: NativeButtonProps) {
  const {react, native} = getBackend();
  react.useSyncExternalStore(interaction?.subscribe ?? emptySubscribe, interaction?.snapshot ?? emptySnapshot);
  const node=interaction?.node(controlId ?? '', 'button'), enabled=interaction ? !!node?.enabled : true;
  const activate=()=>{if(interaction){if(node&&interaction.isLiveNodeSnapshot(node))interaction.activate(controlId??'');}else onActivate();};
  return react.createElement(native.Pressable, {style,pointerEvents:passThrough?'none':'auto',disabled:!enabled, accessibilityRole: node?.isLink?'link':'button', accessibilityLabel: node?.name ?? label,...(node?.semanticsIdentifier!==undefined?{testID:node.semanticsIdentifier}:{}), accessibilityState:{disabled:!enabled}, onPress:activate,...nativeControlInputProps(native.Platform.OS,interaction,node),...(native.Platform.OS==='windows'?{onAccessibilityTap:activate}:{})}, children);
}
const emptySubscribe = () => () => {};
const emptySnapshot = () => 0;
/** React 19 supplies ref as a prop; hooks and native modules resolve after bootstrap. */
function NativePublicTextField(props: NativeTextFieldProps & { readonly ref?: Ref<NativeTextFieldHandle> }) {
  const {react, native: host} = getBackend();
  const native = react.useRef<TextInput>(null);
  const token=react.useRef({});
  const commands=react.useMemo(()=>({replace(text:string,selection:{start:number;end:number}) {if(props.interaction&&!props.interaction.policy.commands)throw new Error('Native editing replacement unavailable');native.current?.setNativeProps({text,selection});},focus(){if(props.interaction&&!props.interaction.policy.commands)throw new Error('Native editing focus unavailable');native.current?.focus();},blur(){if(props.interaction&&!props.interaction.policy.commands)throw new Error('Native editing blur unavailable');native.current?.blur();}}),[props.interaction]);
  react.useImperativeHandle(props.ref, () => commands, [commands]);
  react.useLayoutEffect(()=>props.interaction?.attachEditor(props.controlId ?? '',token.current,commands),[props.interaction,props.controlId,commands]);
  react.useLayoutEffect(()=>props.interaction?.attachSemanticsNode(props.controlId??'',token.current,()=>host.findNodeHandle(native.current)),[props.interaction,props.controlId,host]);
  react.useSyncExternalStore(props.interaction?.subscribe ?? emptySubscribe,props.interaction?.snapshot ?? emptySnapshot);
  const node=props.interaction?.node(props.controlId ?? '', 'text-field'),enabled=props.interaction ? !!node?.enabled&&!!props.interaction.editorValue(props.controlId??'editor') : true;
  const action=props.interaction?.editorAction(props.controlId??'editor')??'done',configuration=props.interaction?.editorConfiguration(props.controlId??'editor')??freezeEditingConfiguration();
  return react.createElement(host.TextInput, {ref: native, accessibilityLabel: node?.name ?? props.label, ...nativeEditingConfiguration(configuration,host.Platform.OS),...(node?.editorStyle?{allowFontScaling:false,selectionColor:editorColor(node.editorStyle.selectionColor),cursorColor:editorColor(node.editorStyle.cursorColor),underlineColorAndroid:'transparent'}:{}),editable:enabled&&!configuration.readOnly,focusable:node?.focusable!==false, accessibilityState:{disabled:!enabled}, defaultValue: props.interaction?.editorValue(props.controlId??'editor')?.text??props.initialValue, maxLength: props.maxLength, style: props.style,returnKeyType:action==='enter'?'default':action,submitBehavior:configuration.multiline&&action==='enter'?'newline':'submit',...nativeControlInputProps(host.Platform.OS,props.interaction,node),
    onSubmitEditing:()=>{props.interaction?.observe(token.current,{kind:'submit'});},
    onChange: ({nativeEvent}) => {if(props.interaction)props.interaction.observe(token.current,{kind:'text',text:nativeEvent.text,eventCount:nativeEvent.eventCount});else props.onText(nativeEvent.text,nativeEvent.eventCount);},
    onSelectionChange: ({nativeEvent}) => {if(props.interaction)props.interaction.observe(token.current,{kind:'selection',...nativeEvent.selection});else props.onSelection(nativeEvent.selection.start,nativeEvent.selection.end);},
    onFocus: () => {if(!props.interaction || props.interaction.observe(token.current,{kind:'focus'}))props.onFocus();}, onBlur: () => {if(!props.interaction || props.interaction.observe(token.current,{kind:'blur'}))props.onBlur();}});
}
function NativeTextField(props:NativeTextFieldProps&{readonly ref?:Ref<NativeTextFieldHandle>}){const {react,native}=getBackend();react.useSyncExternalStore(props.interaction?.subscribe??emptySubscribe,props.interaction?.snapshot??emptySnapshot);if(props.interaction&&native.Platform.OS==='windows')throw new Error('Core Windows editing is owned by ApplicationSurface nonvisual input');const observed=props.interaction?.policy.nativeSnapshots,Editor=observed&&native.Platform.OS==='android'?AndroidEditor:NativePublicTextField;return react.createElement(Editor,{...props,key:props.interaction?.editorGeneration(props.controlId??'editor')??0});}
 return {NativeLayer,NativeText,NativeButton,NativeTextField};
}
