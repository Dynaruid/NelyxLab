// SPDX-License-Identifier: BSD-3-Clause
import {macosBackend,macosEnvironment,macosAssets,retainMacOSNativeHostOwner} from './application.ts';
import {acquireMacOSAssets,macosAssetService} from './assets.ts';
import {MacOSInteraction} from './interaction.ts';
import {createReactNativeSurface} from '../../backends/react-native/surface.tsx';
import {createAppleNativeSurfaceProps} from '../../backends/react-native/apple-surface.ts';
import type {ReactNativeSurfaceProps} from '../../backends/react-native/surface.tsx';
export interface ApplicationSurfaceProps extends ReactNativeSurfaceProps {}
const Surface=createReactNativeSurface<ApplicationSurfaceProps>({
  target:'macos',backend:macosBackend,assets:macosAssets,environment:macosEnvironment,
  retainOwner:retainMacOSNativeHostOwner,
  assetServices:{acquire:acquireMacOSAssets,service:macosAssetService},visibility:()=>macosBackend().native.AppState,
  interaction:owner=>new MacOSInteraction(owner),requiresNativeBinding:true,nativeViewProps:(_props,binding)=>createAppleNativeSurfaceProps(binding),
});
/** The native Apple Fabric SkiaView owns its CAMetalLayer; shared RN code owns the application session. */
export function ApplicationSurface(props:ApplicationSurfaceProps){return macosBackend().react.createElement(Surface,props);}
