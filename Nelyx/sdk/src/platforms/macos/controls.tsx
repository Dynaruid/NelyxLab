// SPDX-License-Identifier: BSD-3-Clause
import type {Ref} from 'react';
import {macosBackend} from './application.ts';
import {createReactNativeControls} from '../../backends/react-native/controls.tsx';
import type {NativeLayerProps as LayerProps,NativeButtonProps as ButtonProps,NativeTextFieldProps as FieldProps,NativeTextFieldHandle as FieldHandle} from '../../backends/react-native/controls.tsx';
import type {MacOSInteraction} from './interaction.ts';
export interface NativeStyle {readonly [property:string]:string|number|undefined;}
export interface NativeLayerProps extends LayerProps {}
export interface NativeButtonProps extends ButtonProps {readonly interaction?:MacOSInteraction;}
export interface NativeTextFieldHandle extends FieldHandle {}
export interface NativeTextFieldProps extends FieldProps {readonly interaction?:MacOSInteraction;}
const controls=createReactNativeControls(macosBackend);
export function NativeLayer(props:NativeLayerProps){return macosBackend().react.createElement(controls.NativeLayer,props);}
export function NativeText(props:NativeLayerProps&{readonly scale?:boolean}){return macosBackend().react.createElement(controls.NativeText,props);}
export function NativeButton(props:NativeButtonProps){return macosBackend().react.createElement(controls.NativeButton,props);}
export function NativeTextField(props:NativeTextFieldProps&{readonly ref?:Ref<NativeTextFieldHandle>}){return macosBackend().react.createElement(controls.NativeTextField,props);}
