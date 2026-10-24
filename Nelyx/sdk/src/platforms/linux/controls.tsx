// SPDX-License-Identifier: BSD-3-Clause
import type {Ref} from 'react';
import {linuxBackend} from './application.ts';
import {createReactNativeControls} from '../../backends/react-native/controls.tsx';
import type {NativeLayerProps as LayerProps,NativeButtonProps as ButtonProps,NativeTextFieldProps as FieldProps,NativeTextFieldHandle as FieldHandle} from '../../backends/react-native/controls.tsx';
import type {LinuxInteraction} from './interaction.ts';
export interface NativeStyle {readonly [property:string]:string|number|undefined;}
export interface NativeLayerProps extends LayerProps {}
export interface NativeButtonProps extends ButtonProps {readonly interaction?:LinuxInteraction;}
export interface NativeTextFieldHandle extends FieldHandle {}
export interface NativeTextFieldProps extends FieldProps {readonly interaction?:LinuxInteraction;}
const controls=createReactNativeControls(linuxBackend);
export function NativeLayer(props:NativeLayerProps){return linuxBackend().react.createElement(controls.NativeLayer,props);}
export function NativeText(props:NativeLayerProps&{readonly scale?:boolean}){return linuxBackend().react.createElement(controls.NativeText,props);}
export function NativeButton(props:NativeButtonProps){return linuxBackend().react.createElement(controls.NativeButton,props);}
export function NativeTextField(props:NativeTextFieldProps&{readonly ref?:Ref<NativeTextFieldHandle>}){return linuxBackend().react.createElement(controls.NativeTextField,props);}
