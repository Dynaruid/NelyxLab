// SPDX-License-Identifier: BSD-3-Clause
import {windowsBackend,windowsEnvironment,windowsAssets,verifyWindowsNativeHost,retainWindowsNativeHostOwner,isWindowsNativeHostClosing} from './application.ts';
import {acquireWindowsAssets,windowsAssetService,resolveWindowsAssetConfiguration} from './assets.ts';
import {WindowsInteraction} from './interaction.ts';
import {createReactNativeSurface} from '../../backends/react-native/surface.tsx';
import type {ReactNativeSurfaceProps} from '../../backends/react-native/surface.tsx';
import {createWindowsNativeSurfaceProps} from './native-surface.ts';
import {createWindowsSemanticsTree} from '../../backends/react-native/windows-semantics.tsx';
import {openWindowsInput} from './input.ts';
import {createWindowsFrameScheduler} from './frame-clock.ts';
export interface ApplicationSurfaceProps extends ReactNativeSurfaceProps {}
const Surface=createReactNativeSurface<ApplicationSurfaceProps>({
  target:'windows',backend:windowsBackend,assets:windowsAssets,environment:windowsEnvironment,retainOwner:retainWindowsNativeHostOwner,isClosing:isWindowsNativeHostClosing,
  assetServices:{acquire:acquireWindowsAssets,service:windowsAssetService},visibility:()=>windowsBackend().native.AppState,frameScheduler:createWindowsFrameScheduler,
  interaction:owner=>new WindowsInteraction(owner),interactionControls:createWindowsSemanticsTree(windowsBackend),
  openInput(interaction,view,metrics,onError){const {native}=windowsBackend();return openWindowsInput(interaction,view,metrics,native.NativeModules.NelyxWindowsInput,native.DeviceEventEmitter,onError);},
  requiresNativeBinding:true,nativeViewProps:(_props,binding)=>createWindowsNativeSurfaceProps(binding,verifyWindowsNativeHost,isWindowsNativeHostClosing),
});
/** Fabric owns the native surface; shared RN services own AppSession and bounded Graphite leases. */
export function ApplicationSurface(props:ApplicationSurfaceProps){return windowsBackend().react.createElement(Surface,{...props,...(props.assets?{assets:resolveWindowsAssetConfiguration(props.assets)}:{})});}
