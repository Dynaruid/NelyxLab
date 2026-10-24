import type { PlatformId } from '@nelyx/core/hosting/platform';

export interface ArtifactManifest {
  readonly schema: 'nelyx.artifacts/v1';
  readonly target: PlatformId;
  readonly profile: string;
  readonly architecture: string;
  readonly sdkVersion: string;
  readonly nativeAbi: Readonly<{host: number; skia: number}>;
  readonly wireAbi: number;
  readonly files: readonly {readonly id: string; readonly path: string; readonly sha256: string}[];
}
export async function verifyArtifacts(value: ArtifactManifest, expected: {
  readonly target: PlatformId; readonly profile: string; readonly architecture: string; readonly sdkVersion: string;
  readonly nativeAbi: Readonly<{host: number; skia: number}>; readonly wireAbi: number; readonly required: readonly string[];
}, read: (id: string, path: string) => Promise<Uint8Array>, sha256: (bytes: Uint8Array) => Promise<string>): Promise<void> {
  if (value.schema !== 'nelyx.artifacts/v1' || value.target !== expected.target || value.profile !== expected.profile || value.architecture !== expected.architecture || value.sdkVersion !== expected.sdkVersion || value.nativeAbi.host !== expected.nativeAbi.host || value.nativeAbi.skia !== expected.nativeAbi.skia || value.wireAbi !== expected.wireAbi) throw new Error('Artifact target/profile/architecture/version/ABI mismatch');
  const ids = new Set<string>();
  for (const file of value.files) {
    if (!file.id || ids.has(file.id) || !/^[a-f0-9]{64}$/.test(file.sha256) || !/^[A-Za-z0-9_.-]+$/.test(file.path) || file.path === '.' || file.path === '..') throw new Error('Invalid or duplicate artifact identity/path/hash');
    ids.add(file.id);
  }
  for (const id of expected.required) if (!ids.has(id)) throw new Error(`Missing required artifact/hash: ${id}`);
  for (const file of value.files) if (await sha256(await read(file.id, file.path)) !== file.sha256) throw new Error(`Artifact content hash mismatch: ${file.id}`);
}
