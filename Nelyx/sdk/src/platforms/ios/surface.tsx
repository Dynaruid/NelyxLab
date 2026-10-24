// SPDX-License-Identifier: BSD-3-Clause
import {iosBackend,iosEnvironment,iosAssets,retainIOSNativeHostOwner} from './application.ts';
import {acquireIOSAssets,iosAssetService} from './assets.ts';
import {IOSInteraction} from './interaction.ts';
import {createReactNativeSurface} from '../../backends/react-native/surface.tsx';
import {createAppleNativeSurfaceProps} from '../../backends/react-native/apple-surface.ts';
import type {ReactNativeSurfaceProps} from '../../backends/react-native/surface.tsx';
export interface ApplicationSurfaceProps extends ReactNativeSurfaceProps {}
const Surface=createReactNativeSurface<ApplicationSurfaceProps>({
  target:'ios',backend:iosBackend,assets:iosAssets,environment:iosEnvironment,
  retainOwner:retainIOSNativeHostOwner,
  assetServices:{acquire:acquireIOSAssets,service:iosAssetService},visibility:()=>iosBackend().native.AppState,
  interaction:owner=>new IOSInteraction(owner),requiresNativeBinding:true,nativeViewProps:(_props,binding)=>createAppleNativeSurfaceProps(binding),
});
/** The native Apple Fabric SkiaView owns its CAMetalLayer; shared RN code owns the application session. */
export function ApplicationSurface(props:ApplicationSurfaceProps){return iosBackend().react.createElement(Surface,props);}
