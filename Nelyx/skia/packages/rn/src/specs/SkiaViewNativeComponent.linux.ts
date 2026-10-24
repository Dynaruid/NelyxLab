// SPDX-License-Identifier: BSD-3-Clause
import type {HostComponent} from 'react-native';
import type {SkiaBaseViewProps} from '../views/types.ts';
// RN's pinned Linux overlay owns BaseViewConfig; no native reflection stub.
// @ts-ignore Flow implementation has no TypeScript module declaration.
import {get} from 'react-native/Libraries/NativeComponent/NativeComponentRegistry';
// @ts-ignore Flow implementation has no TypeScript module declaration.
import base from 'react-native/Libraries/NativeComponent/BaseViewConfig';
const SkiaView = get('SkiaView',()=>({
  uiViewClassName:'SkiaView',bubblingEventTypes:base.bubblingEventTypes,
  directEventTypes:{...base.directEventTypes,topLinuxSurfaceStatus:{registrationName:'onLinuxSurfaceStatus'},topNativeMouseEvent:{registrationName:'onNativeMouseEvent'}},
  validAttributes:{...base.validAttributes,opaque:true,highBitDepth:true,mouseCursor:true,onLinuxSurfaceStatus:true,onNativeMouseEvent:true},
})) as HostComponent<SkiaBaseViewProps>;
export default SkiaView;
