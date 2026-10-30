// SPDX-License-Identifier: BSD-3-Clause
import type { NativeAssetBackend } from '../../runtime/native-assets.ts';
import type { ReactNativeBackend } from './registration.ts';

/** RN owns opaque Metro source IDs and its Image resolver. Decoding, budgets
 * and leases belong to the common native asset owner. */
export function reactNativeAssetBackend(
  getBackend: () => Pick<ReactNativeBackend, 'native' | 'skia'>,
): () => NativeAssetBackend {
  return () => {
    const backend = getBackend(),
      Image = backend.native.Image;
    return { api: backend.skia.Skia, resolveSource: (source) => Image.resolveAssetSource(source) };
  };
}
