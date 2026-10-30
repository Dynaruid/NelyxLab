// SPDX-License-Identifier: BSD-3-Clause
import type { ResolvedAppAsset as AppAsset } from './config.ts';
import type { SkImage } from '@nelyx/skia-native/skia/types/Drawing';
import type { NativeFont, NelyxTypeface } from '@nelyx/skia-native/text';
import type { Skia } from '@nelyx/skia-native/skia/types/Skia';
import type { AssetService } from '@nelyx/core/hosting/services';
import { resourceKey } from '@nelyx/core/ui/frame';
import { SharedAssetPool } from '../backends/shared-assets.ts';
import { sha256 } from '../backends/sha256.ts';

export type NativeAssetSource = number | { readonly uri: string };
export interface NativeAssetConfiguration {
  readonly manifest: readonly AppAsset[];
  readonly sources: Readonly<Record<string, NativeAssetSource>>;
}
export interface NativeAssetBackend {
  readonly api: Skia;
  resolveSource(source: NativeAssetSource): { readonly uri?: string } | null;
}
export interface LoadedNativeAssets {
  readonly images: ReadonlyMap<string, SkImage>;
  readonly fonts: ReadonlyMap<string, NativeFont>;
  readonly sourceBytes: number;
}
/** One native composition owns this pool; loading starts on acquire. */
export function createNativeAssetServices(getBackend: () => NativeAssetBackend) {
  function retire(assets: Pick<LoadedNativeAssets, 'images' | 'fonts'>): void {
    for (const image of assets.images.values()) {
      image.dispose();
    }
    for (const font of assets.fonts.values()) {
      try {
        font.provider.dispose();
      } finally {
        font.typeface?.dispose();
      }
    }
  }
  const pool = new SharedAssetPool<NativeAssetConfiguration, LoadedNativeAssets>(
    async (configuration) => {
      if (configuration.manifest.length > 64) throw new Error('Native asset count budget exceeded');
      const ids = new Set<string>();
      for (const asset of configuration.manifest) {
        if (
          !asset.id ||
          ids.has(asset.id) ||
          !/^[a-f0-9]{64}$/.test(asset.sha256) ||
          !['image', 'font'].includes(asset.kind) ||
          !Object.hasOwn(configuration.sources, asset.id)
        )
          throw new Error(`Invalid Native manifest/source: ${asset.id}`);
        ids.add(asset.id);
      }
      const backend = getBackend(),
        Skia = backend.api;
      const images = new Map<string, SkImage>(),
        fonts = new Map<string, NativeFont>();
      let total = 0;
      try {
        // Sequential reads bound temporary storage as well as the total source bytes.
        for (const asset of configuration.manifest) {
          const source = configuration.sources[asset.id];
          if (source === undefined) throw new Error(`Missing Native asset source: ${asset.id}`);
          const uri = backend.resolveSource(source)?.uri;
          if (!uri) throw new Error(`Invalid Native asset URI: ${asset.id}`);
          const data = await Skia.Data.fromURI(uri, 16 * 1024 * 1024);
          try {
            const bytes = data.nelyxBytes(16 * 1024 * 1024);
            total += bytes.length;
            if (total > 64 * 1024 * 1024) throw new Error('Native asset byte budget exceeded');
            const hash = data.nelyxSha256(16 * 1024 * 1024);
            if (bytes.length <= 64 * 1024 && sha256(bytes) !== hash)
              throw new Error('Native native/JS SHA-256 implementations disagree');
            if (hash !== asset.sha256) throw new Error(`Asset content hash mismatch: ${asset.id}`);
            const resource = Object.freeze({ id: asset.id, generation: 1 }),
              key = resourceKey(resource);
            if (asset.kind === 'image') {
              const image = Skia.Image.MakeImageFromEncoded(data);
              if (!image) throw new Error(`Native image decode failed: ${asset.id}`);
              if (
                image.width() > 8192 ||
                image.height() > 8192 ||
                image.width() * image.height() > 16 * 1024 * 1024
              ) {
                image.dispose();
                throw new Error('Native image pixel budget exceeded');
              }
              images.set(key, image);
            } else {
              if (!asset.fontFamily) throw new Error(`Missing Native font family: ${asset.id}`);
              const face = Skia.Typeface.MakeFreeTypeFaceFromData(data) as NelyxTypeface | null;
              if (!face) throw new Error(`Native font decode failed: ${asset.id}`);
              const provider = Skia.TypefaceFontProvider.Make();
              try {
                provider.registerFont(face, asset.fontFamily);
                fonts.set(key, {
                  resource,
                  provider,
                  family: asset.fontFamily,
                  sourceBytes: bytes.length,
                  bundledTypefaceId: face.nelyxIdentity(),
                  typeface: face,
                });
              } catch (error) {
                try {
                  provider.dispose();
                } finally {
                  face.dispose();
                }
                throw error;
              }
            }
          } finally {
            data.dispose();
          }
        }
        return { images, fonts, sourceBytes: total };
      } catch (error) {
        retire({ images, fonts });
        throw error;
      }
    },
    retire,
  );
  function acquire(configuration: NativeAssetConfiguration) {
    return pool.acquire(configuration);
  }
  /** Each registry owns IDs; shared native objects retire after all surface owners drain. */
  function service(configuration: NativeAssetConfiguration): AssetService {
    let used = false,
      closed = false;
    return {
      async resolve(declarations) {
        if (used || closed) throw new Error('Native assets already bound or closed');
        used = true;
        const ids = new Set<string>();
        return declarations.map((ref) => {
          const matches = configuration.manifest.filter((asset) => asset.id === ref.id),
            asset = matches[0];
          if (
            ids.has(ref.id) ||
            matches.length !== 1 ||
            !asset ||
            asset.kind !== ref.kind ||
            asset.sha256 !== ref.sha256
          )
            throw new Error(`Invalid Native asset declaration: ${ref.id}`);
          ids.add(ref.id);
          return {
            descriptor: {
              id: ref.id,
              generation: 1,
              kind: ref.kind,
              asset: Object.freeze({ id: ref.id, kind: ref.kind, sha256: ref.sha256 }),
            },
            retire() {},
          };
        });
      },
      dispose() {
        closed = true;
      },
    };
  }

  return Object.freeze({ acquire, service });
}
