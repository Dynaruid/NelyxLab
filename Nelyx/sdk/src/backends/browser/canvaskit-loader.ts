// SPDX-License-Identifier: BSD-3-Clause
import type { CanvasKit } from 'canvaskit-wasm';
import { sha256 as portableSha256 } from '@noble/hashes/sha2.js';
import type { CanvasKitManifest } from './canvaskit-manifest.ts';
import { isAppUrl } from './local-url.ts';

export class CanvasKitIntegrityError extends Error {}
export type CanvasKitFactory = (options: {
  locateFile: (name: string) => string;
}) => Promise<CanvasKit>;
export type CanvasKitScript = (fetchWasm: typeof fetch) => CanvasKitFactory;

export interface PreparedCanvasKit {
  readonly identity: string;
  readonly script: Blob;
  readonly wasm: Blob;
}

const maxArtifactBytes = 32 * 1024 * 1024;
const scriptType = 'text/javascript';
const wasmType = 'application/wasm';

export async function sha256(bytes: Uint8Array): Promise<string> {
  const hash = crypto.subtle
    ? new Uint8Array(
        await crypto.subtle.digest(
          'SHA-256',
          bytes.buffer instanceof ArrayBuffer
            ? new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength)
            : new Uint8Array(bytes),
        ),
      )
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
      typeof file.sha256 !== 'string' ||
      !/^[a-f0-9]{64}$/.test(file.sha256)
    )
      throw new CanvasKitIntegrityError('CanvasKit artifact identity/path/hash');
    ids.add(file.id);
  }
  return ['canvaskit.js', 'canvaskit.wasm']
    .map((id) => manifest.files.find((file) => file.id === id)!.sha256)
    .join('/');
}

export async function readCanvasKit(
  root: URL,
  manifest: CanvasKitManifest,
  identity: string,
): Promise<PreparedCanvasKit> {
  const blobs = new Map(
    await Promise.all(
      manifest.files.map(async ({ id, path, sha256: expectedHash }) => {
        const url = new URL(path, root);
        if (!isAppUrl(url, root))
          throw new CanvasKitIntegrityError('CanvasKit asset escaped runtime root');
        const response = await fetch(url, { redirect: 'error' });
        if (!response.ok) throw new Error('CanvasKit HTTP ' + response.status);
        const data = new Uint8Array(await response.arrayBuffer());
        if (
          !data.byteLength ||
          data.byteLength > maxArtifactBytes ||
          (await sha256(data)) !== expectedHash
        )
          throw new CanvasKitIntegrityError('CanvasKit artifact size/hash mismatch');
        return [
          id,
          new Blob([data], { type: id === 'canvaskit.js' ? scriptType : wasmType }),
        ] as const;
      }),
    ),
  );
  return Object.freeze({
    identity,
    script: blobs.get('canvaskit.js')!,
    wasm: blobs.get('canvaskit.wasm')!,
  });
}

/** A dedicated worker receives immutable Blobs from its owning document's verifier. */
export function checkPreparedCanvasKit(assets: PreparedCanvasKit, identity: string): void {
  const valid = (blob: Blob, type: string) =>
    blob instanceof Blob && blob.type === type && blob.size > 0 && blob.size <= maxArtifactBytes;
  if (
    assets?.identity !== identity ||
    !valid(assets.script, scriptType) ||
    !valid(assets.wasm, wasmType)
  )
    throw new CanvasKitIntegrityError('CanvasKit prepared artifact identity/type/size mismatch');
}

export async function instantiateCanvasKit(
  { script, wasm }: PreparedCanvasKit,
  load: (script: Blob) => Promise<CanvasKitScript | undefined>,
  allowMemoryFallback = false,
): Promise<CanvasKit> {
  const wasmUrl = URL.createObjectURL(wasm);
  const localResponse = () => new Response(wasm, { headers: { 'Content-Type': wasmType } });
  try {
    // Check that this realm can read its object URL before entering the pinned
    // initializer, which rejects an internal promise as well as throwing on abort.
    const read = fetch(wasmUrl, { credentials: 'same-origin' }).catch((error) => {
      if (!allowMemoryFallback) throw error;
      return localResponse();
    });
    const [create, response] = await Promise.all([load(script), read]);
    let initial: Response | undefined = response;
    const factory = create?.(async (input, init) => {
      if (input !== wasmUrl) return globalThis.fetch(input, init);
      const result = initial ?? localResponse();
      initial = undefined;
      return result;
    });
    if (typeof factory !== 'function')
      throw new CanvasKitIntegrityError('CanvasKit initialization export missing');
    const runtime = await factory({
      locateFile: (name) => {
        if (name !== 'canvaskit.wasm')
          throw new CanvasKitIntegrityError('Unknown CanvasKit artifact');
        return wasmUrl;
      },
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
  } finally {
    URL.revokeObjectURL(wasmUrl);
  }
}
