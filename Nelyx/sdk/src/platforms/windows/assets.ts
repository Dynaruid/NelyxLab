import type {AssetService} from '@nelyx/core/hosting/services';
// SPDX-License-Identifier: BSD-3-Clause
import {windowsBackend,windowsAssets,verifyWindowsNativeHost} from './application.ts';
import type {WindowsAssets} from './application.ts';
import {resolveWindowsAssetSources} from './native-host.ts';
import {createReactNativeAssetServices} from '../../backends/react-native/assets.ts';
const services=createReactNativeAssetServices(windowsBackend),resolved=new WeakMap<WindowsAssets,WindowsAssets>();
/** Explicit runner-local sources resolve within the actual native allowlist. */
export function resolveWindowsAssetConfiguration(configuration:WindowsAssets):WindowsAssets {
  const status=verifyWindowsNativeHost(),cached=resolved.get(configuration);if(cached)return cached;
  const result=resolveWindowsAssetSources(configuration,status.assetRoot);resolved.set(configuration,result);resolved.set(result,result);return result;
}
export function acquireWindowsAssets(configuration:WindowsAssets){return services.acquire(resolveWindowsAssetConfiguration(configuration));}
export function windowsAssetService(configuration:WindowsAssets):AssetService{return services.service(resolveWindowsAssetConfiguration(configuration));}
