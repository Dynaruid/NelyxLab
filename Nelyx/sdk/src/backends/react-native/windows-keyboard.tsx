// SPDX-License-Identifier: BSD-3-Clause
import type {Ref} from 'react';
import type {View,ViewProps} from 'react-native';
import type {ViewRuntime} from '@nelyx/core/hosting/runtime';
import type {ReactNativeBackend} from './registration.ts';
import {nativeKeyboardProps} from './input.ts';
export interface WindowsKeyboardProps extends ViewProps {readonly ref?:Ref<View>;readonly readView:()=>ViewRuntime|undefined}
/** RNW routes keys from this canvas and its registered nonvisual Core proxies. */
export function createWindowsKeyboardHost(getBackend:()=>Pick<ReactNativeBackend,'react'|'native'>){
  return function WindowsKeyboardHost({readView,ref:forwarded,children,...props}:WindowsKeyboardProps){
    const {react,native}=getBackend(),[focused,setFocused]=react.useState(false),pressed=react.useRef(new Set<string>()).current;
    return react.createElement(native.View,{...props,ref:forwarded,...nativeKeyboardProps('windows',readView,{rawKeyboard:true,pressed,canvasFocused:focused,onCanvasFocus:setFocused})},children);
  };
}
