import { reactNativeAssetBackend } from '../../backends/react-native/assets.ts';
import type { AssetService } from '@nelyx/core/hosting/services';
// SPDX-License-Identifier: BSD-3-Clause
import { iosBackend } from './application.ts';
import type { IOSAssets } from './application.ts';
import { createNativeAssetServices } from '../../runtime/native-assets.ts';
const services = createNativeAssetServices(reactNativeAssetBackend(iosBackend));
export function acquireIOSAssets(configuration: IOSAssets) {
  return services.acquire(configuration);
}
export function iosAssetService(configuration: IOSAssets): AssetService {
  return services.service(configuration);
}
