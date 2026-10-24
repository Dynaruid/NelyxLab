import type {AssetService} from '@nelyx/core/hosting/services';
// SPDX-License-Identifier: BSD-3-Clause
import {linuxBackend,linuxAssets,verifyLinuxNativeHost} from './application.ts';
import type {LinuxAssets} from './application.ts';
import {createReactNativeAssetServices} from '../../backends/react-native/assets.ts';
const services=createReactNativeAssetServices(linuxBackend);
export function acquireLinuxAssets(configuration:LinuxAssets){verifyLinuxNativeHost();return services.acquire(configuration);}
export function linuxAssetService(configuration:LinuxAssets):AssetService{verifyLinuxNativeHost();return services.service(configuration);}
