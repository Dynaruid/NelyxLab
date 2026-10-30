export interface AssetRef {
  readonly id: string;
  readonly sha256: string;
  readonly kind: 'image' | 'font';
}
export interface AssetLoader {
  load(asset: AssetRef): Promise<Uint8Array>;
}
