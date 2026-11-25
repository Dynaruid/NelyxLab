// SPDX-License-Identifier: BSD-3-Clause
import type { CanvasKit } from 'canvaskit-wasm';
import type { CanvasKitManifest } from './canvaskit-manifest.ts';
import type { CanvasKitScript, PreparedCanvasKit } from './canvaskit-loader.ts';
import {
  CanvasKitIntegrityError,
  checkCanvasKitManifest,
  instantiateCanvasKit,
  readCanvasKit,
} from './canvaskit-loader.ts';

export type { CanvasKitManifest } from './canvaskit-manifest.ts';
export { sha256 } from './canvaskit-loader.ts';
interface RuntimeCache {
  readonly key: string;
  readonly assets: Promise<PreparedCanvasKit>;
  runtime?: Promise<CanvasKit>;
}
let cache: RuntimeCache | undefined;

function cachedCanvasKit(root: URL, manifest: CanvasKitManifest): RuntimeCache {
  const key = checkCanvasKitManifest(root, manifest);
  if (cache) {
    if (cache.key !== key)
      throw new CanvasKitIntegrityError('CanvasKit runtime changes require page reload');
    return cache;
  }
  const assets = readCanvasKit(root, manifest, key);
  cache = { key, assets };
  void assets.catch(() => {
    if (cache?.assets === assets) cache = undefined;
  });
  return cache;
}

export async function prepareCanvasKit(root: URL, manifest: CanvasKitManifest) {
  return cachedCanvasKit(root, manifest).assets;
}

export async function loadCanvasKit(root: URL, manifest: CanvasKitManifest): Promise<CanvasKit> {
  const entry = cachedCanvasKit(root, manifest);
  return (entry.runtime ??= entry.assets.then(async (assets) => {
    try {
      return await instantiateCanvasKit(assets, loadScript, true);
    } catch (error) {
      delete entry.runtime;
      throw error;
    }
  }));
}

async function loadScript(source: Blob): Promise<CanvasKitScript | undefined> {
  // Give the pinned classic script a factory-local fetch without changing the window.
  const url = URL.createObjectURL(
    new Blob(
      [
        'document.currentScript.nelyxCanvasKit = (fetch) => {\n',
        source,
        '\nreturn CanvasKitInit;\n};\n',
      ],
      { type: 'text/javascript' },
    ),
  );
  const script = document.createElement('script') as HTMLScriptElement & {
    nelyxCanvasKit?: CanvasKitScript;
  };
  script.src = url;
  try {
    await new Promise<void>((resolve, reject) => {
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('CanvasKit script load failed'));
      document.head.append(script);
    });
    return script.nelyxCanvasKit;
  } finally {
    script.remove();
    URL.revokeObjectURL(url);
  }
}
