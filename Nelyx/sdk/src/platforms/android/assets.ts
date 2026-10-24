import type {AssetService} from '@nelyx/core/hosting/services';
// SPDX-License-Identifier: BSD-3-Clause
import {androidBackend, androidAssets} from './application.ts';
import type {AndroidAssets} from './application.ts';
import {createReactNativeAssetServices} from '../../backends/react-native/assets.ts';

// Android owns registration/GPU policy; shared RN services own decoding/leases.
const services = createReactNativeAssetServices(androidBackend);
export function acquireAndroidAssets(configuration: AndroidAssets) {return services.acquire(configuration);}
export function androidAssetService(configuration: AndroidAssets):AssetService{return services.service(configuration);}
