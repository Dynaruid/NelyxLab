// SPDX-License-Identifier: BSD-3-Clause
import type { CanvasKit } from 'canvaskit-wasm';
import type { CanvasKitManifest } from './canvaskit-manifest.ts';
import type { CanvasKitFactory } from './canvaskit-loader.ts';
import {
  CanvasKitIntegrityError,
  checkCanvasKitManifest,
  instantiateCanvasKit,
} from './canvaskit-loader.ts';

export type { CanvasKitManifest } from './canvaskit-manifest.ts';
export { sha256 } from './canvaskit-loader.ts';
const runtimes = new Map<string, Promise<CanvasKit>>();

export async function loadCanvasKit(root: URL, manifest: CanvasKitManifest): Promise<CanvasKit> {
  const key = checkCanvasKitManifest(root, manifest);
  if (runtimes.has(key)) return runtimes.get(key)!;
  if (runtimes.size)
    throw new CanvasKitIntegrityError('CanvasKit runtime changes require page reload');
  const load = instantiateCanvasKit(root, manifest, async (bytes) => {
    const url = URL.createObjectURL(new Blob([bytes], { type: 'text/javascript' }));
    const script = document.createElement('script');
    script.src = url;
    try {
      await new Promise<void>((resolve, reject) => {
        script.onload = () => resolve();
        script.onerror = () => reject(new Error('CanvasKit script load failed'));
        document.head.append(script);
      });
      return (globalThis as typeof globalThis & { CanvasKitInit?: CanvasKitFactory }).CanvasKitInit;
    } finally {
      script.remove();
      URL.revokeObjectURL(url);
    }
  });
  runtimes.set(key, load);
  try {
    return await load;
  } catch (error) {
    runtimes.delete(key);
    throw error;
  }
}
