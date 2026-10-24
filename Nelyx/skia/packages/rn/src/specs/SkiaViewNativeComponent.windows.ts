// SPDX-License-Identifier: BSD-3-Clause
import type {HostComponent} from 'react-native';
import type {SkiaBaseViewProps} from '../views/types.ts';
// RNW's Fabric builder owns the native props; this metadata requires no
// consumer-specific codegen component or reflection placeholder.
// @ts-ignore Flow implementation has no TypeScript module declaration.
import {register} from 'react-native/Libraries/Renderer/shims/ReactNativeViewConfigRegistry';
// @ts-ignore Flow implementation has no TypeScript module declaration.
import {createViewConfig} from 'react-native/Libraries/NativeComponent/ViewConfig';
// @ts-ignore Flow implementation has no TypeScript module declaration.
import base from 'react-native/Libraries/NativeComponent/BaseViewConfig';
// RNW Fabric can run with RN$Bridgeless false. NativeComponentRegistry.get()
// then prefers reflection, which has no metadata for this app-owned builder.
const SkiaView=register('SkiaView',()=>createViewConfig({
  uiViewClassName:'SkiaView',bubblingEventTypes:base.bubblingEventTypes,
  directEventTypes:{...base.directEventTypes,topWindowsSurfaceStatus:{registrationName:'onWindowsSurfaceStatus'},topWindowsWheel:{registrationName:'onWindowsWheel'},topWindowsPointer:{registrationName:'onWindowsPointer'},topWindowsKey:{registrationName:'onWindowsKey'},topWindowsKeyboardFocus:{registrationName:'onWindowsKeyboardFocus'},topWindowsText:{registrationName:'onWindowsText'}},
  validAttributes:{...base.validAttributes,opaque:true,highBitDepth:true,mouseCursor:true,onWindowsSurfaceStatus:true,onWindowsWheel:true,onWindowsPointer:true,onWindowsKey:true,onWindowsKeyboardFocus:true,onWindowsText:true},
})) as HostComponent<SkiaBaseViewProps>;
export default SkiaView;
