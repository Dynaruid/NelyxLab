// SPDX-License-Identifier: BSD-3-Clause
import type { CanvasKit } from 'canvaskit-wasm';
import { sha256 as portableSha256 } from '@noble/hashes/sha2.js';
import type { CanvasKitManifest } from './canvaskit-manifest.ts';
import { isAppUrl } from './local-url.ts';

export class CanvasKitIntegrityError extends Error {}
export type CanvasKitFactory = (options: {
  wasmBinary: Uint8Array;
  locateFile: (name: string) => string;
}) => Promise<CanvasKit>;

export async function sha256(bytes: Uint8Array): Promise<string> {
  const hash = crypto.subtle
    ? new Uint8Array(await crypto.subtle.digest('SHA-256', new Uint8Array(bytes)))
    : portableSha256(bytes);
  return Array.from(hash, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export function checkCanvasKitManifest(root: URL, manifest: CanvasKitManifest): string {
  if (
    !isAppUrl(root, root) ||
    manifest?.schema !== 'nelyx.canvaskit/v2' ||
    manifest.version !== '0.42.0' ||
    manifest.source !== 'npm' ||
    manifest.adapterAbi !== 1 ||
    manifest.initialMemoryBytes !== 128 * 1024 * 1024 ||
    manifest.maximumMemoryBytes !== 2 * 1024 * 1024 * 1024 ||
    !Array.isArray(manifest.files) ||
    manifest.files.length !== 2
  )
    throw new CanvasKitIntegrityError('Invalid CanvasKit runtime manifest');
  const ids = new Set<string>();
  for (const file of manifest.files) {
    if (
      !file ||
      ids.has(file.id) ||
      !['canvaskit.js', 'canvaskit.wasm'].includes(file.id) ||
      file.path !== file.id ||
      !/^[a-f0-9]{64}$/.test(file.sha256)
    )
      throw new CanvasKitIntegrityError('CanvasKit artifact identity/path/hash');
    ids.add(file.id);
  }
  return manifest.files.map((file) => file.sha256).join('/');
}

export async function instantiateCanvasKit(
  root: URL,
  manifest: CanvasKitManifest,
  load: (script: Uint8Array<ArrayBuffer>) => Promise<CanvasKitFactory | undefined>,
): Promise<CanvasKit> {
  const bytes = new Map(
    await Promise.all(
      manifest.files.map(async (file) => {
        const url = new URL(file.path, root);
        if (!isAppUrl(url, root))
          throw new CanvasKitIntegrityError('CanvasKit asset escaped runtime root');
        const response = await fetch(url, { redirect: 'error' });
        if (!response.ok) throw new Error('CanvasKit HTTP ' + response.status);
        const data = new Uint8Array(await response.arrayBuffer());
        if (data.byteLength > 32 * 1024 * 1024 || (await sha256(data)) !== file.sha256)
          throw new CanvasKitIntegrityError('CanvasKit artifact size/hash mismatch');
        return [file.id, data] as const;
      }),
    ),
  );
  const factory = await load(bytes.get('canvaskit.js')!);
  if (!factory) throw new CanvasKitIntegrityError('CanvasKit initialization export missing');
  const runtime = await factory({
    wasmBinary: bytes.get('canvaskit.wasm')!,
    locateFile: (name) => new URL(name, root).href,
  });
  if (
    typeof runtime?.ParagraphBuilder?.MakeFromFontCollection !== 'function' ||
    typeof runtime.TypefaceFontProvider?.Make !== 'function' ||
    typeof runtime.PictureRecorder !== 'function'
  )
    throw new CanvasKitIntegrityError(
      'CanvasKit is missing the required paragraph or picture APIs',
    );
  return runtime;
}
