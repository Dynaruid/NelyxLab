// SPDX-License-Identifier: BSD-3-Clause
import {linuxBackend,linuxEnvironment,linuxAssets,verifyLinuxNativeHost,retainLinuxNativeHostOwner} from './application.ts';
import {acquireLinuxAssets,linuxAssetService} from './assets.ts';
import {LinuxInteraction} from './interaction.ts';
import {createReactNativeSurface} from '../../backends/react-native/surface.tsx';
import type {ReactNativeSurfaceProps} from '../../backends/react-native/surface.tsx';
import {createLinuxNativeSurfaceProps} from './native-surface.ts';
export interface ApplicationSurfaceProps extends ReactNativeSurfaceProps {}
const Surface=createReactNativeSurface<ApplicationSurfaceProps>({
  target:'linux',backend:linuxBackend,assets:linuxAssets,environment:linuxEnvironment,
  retainOwner:retainLinuxNativeHostOwner,
  assetServices:{acquire:acquireLinuxAssets,service:linuxAssetService},visibility:()=>linuxBackend().native.AppState,
  interaction:owner=>new LinuxInteraction(owner),requiresNativeBinding:true,nativeViewProps:(_props,binding)=>createLinuxNativeSurfaceProps(binding,verifyLinuxNativeHost),
});
/** The Linux Fabric SkiaView owns its GTK import surface; shared RN code owns the application session. */
export function ApplicationSurface(props:ApplicationSurfaceProps){return linuxBackend().react.createElement(Surface,props);}
