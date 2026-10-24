import type {AssetService} from '@nelyx/core/hosting/services';
// SPDX-License-Identifier: BSD-3-Clause
import {macosBackend,macosAssets} from './application.ts';
import type {MacOSAssets} from './application.ts';
import {createReactNativeAssetServices} from '../../backends/react-native/assets.ts';
const services=createReactNativeAssetServices(macosBackend);
export function acquireMacOSAssets(configuration:MacOSAssets){return services.acquire(configuration);}
export function macosAssetService(configuration:MacOSAssets):AssetService{return services.service(configuration);}
