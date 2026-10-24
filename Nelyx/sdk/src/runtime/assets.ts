import type { AssetRef, AssetLoader } from '@nelyx/core/foundation/assets';
import type { AssetService, ResolvedAsset } from '@nelyx/core/hosting/services';
import type {ResolvedAppAsset as AppAsset} from './config.ts';

export interface AssetDecoder { decode(asset: AppAsset, bytes: Uint8Array): Promise<ResolvedAsset> }
/** Paths/URI/native decoded handles stay in the injected target loader and decoder. */
export class ManifestAssetService implements AssetService {
  private used = false;
  private closed = false;
  constructor(private readonly manifest: readonly AppAsset[], private readonly loader: AssetLoader,
    private readonly decoder: AssetDecoder, private readonly sha256: (bytes: Uint8Array) => Promise<string>) {}
  async resolve(declarations: readonly AssetRef[]): Promise<readonly ResolvedAsset[]> {
    if (this.closed || this.used) throw new Error('Asset service is closed or already bound to a session');
    this.used = true;
    const ids = new Set<string>();
    const selected = declarations.map(ref => {
      const match = this.manifest.filter(asset => asset.id === ref.id);
      if (ids.has(ref.id) || match.length !== 1 || match[0]!.kind !== ref.kind || match[0]!.sha256 !== ref.sha256) throw new Error(`Invalid asset declaration: ${ref.id}`);
      ids.add(ref.id); return match[0]!;
    });
    const results = await Promise.allSettled(selected.map(async asset => {
      const bytes = await this.loader.load(asset);
      if (this.closed) throw new Error('Asset service closed during load');
      if (await this.sha256(bytes) !== asset.sha256) throw new Error(`Asset content hash mismatch: ${asset.id}`);
      const resolved = await this.decoder.decode(asset, bytes);
      if (resolved.descriptor.id !== asset.id || resolved.descriptor.kind !== asset.kind || resolved.descriptor.asset?.sha256 !== asset.sha256 || this.closed) {
        resolved.retire(); throw new Error(`Invalid decoded asset: ${asset.id}`);
      }
      return resolved;
    }));
    const errors = results.filter((result): result is PromiseRejectedResult => result.status === 'rejected').map(result => result.reason);
    if (errors.length) {
      for (const result of results) if (result.status === 'fulfilled') try { result.value.retire(); } catch (error) { errors.push(error); }
      throw new AggregateError(errors, 'asset resolution failed');
    }
    return Object.freeze(results.map(result => (result as PromiseFulfilledResult<ResolvedAsset>).value));
  }
  dispose(): void { this.closed = true; }
}
