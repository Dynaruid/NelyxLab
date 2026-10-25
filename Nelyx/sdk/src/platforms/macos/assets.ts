import {reactNativeAssetBackend} from '../../backends/react-native/assets.ts';
import type {AssetService} from '@nelyx/core/hosting/services';
// SPDX-License-Identifier: BSD-3-Clause
import {macosBackend,macosAssets} from './application.ts';
import type {MacOSAssets} from './application.ts';
import {createNativeAssetServices} from '../../runtime/native-assets.ts';
const services=createNativeAssetServices(reactNativeAssetBackend(macosBackend));
export function acquireMacOSAssets(configuration:MacOSAssets){return services.acquire(configuration);}
export function macosAssetService(configuration:MacOSAssets):AssetService{return services.service(configuration);}
