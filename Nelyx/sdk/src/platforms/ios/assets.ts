import type {AssetService} from '@nelyx/core/hosting/services';
// SPDX-License-Identifier: BSD-3-Clause
import {iosBackend,iosAssets} from './application.ts';
import type {IOSAssets} from './application.ts';
import {createReactNativeAssetServices} from '../../backends/react-native/assets.ts';
const services=createReactNativeAssetServices(iosBackend);
export function acquireIOSAssets(configuration:IOSAssets){return services.acquire(configuration);}
export function iosAssetService(configuration:IOSAssets):AssetService{return services.service(configuration);}
