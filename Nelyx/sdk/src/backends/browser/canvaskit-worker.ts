// SPDX-License-Identifier: BSD-3-Clause
import type { CanvasKitManifest } from './canvaskit-manifest.ts';
import type { CanvasKitFactory } from './canvaskit-loader.ts';
import { checkCanvasKitManifest, instantiateCanvasKit } from './canvaskit-loader.ts';

export function loadWorkerCanvasKit(root: URL, manifest: CanvasKitManifest) {
  checkCanvasKitManifest(root, manifest);
  return instantiateCanvasKit(root, manifest, async (bytes) => {
    // The pinned Emscripten file is a classic script with a local factory.
    const url = URL.createObjectURL(
      new Blob([bytes, '\nexport default CanvasKitInit;\n'], { type: 'text/javascript' }),
    );
    try {
      const module = (await import(/* @vite-ignore */ url)) as { default?: CanvasKitFactory };
      return module.default;
    } finally {
      URL.revokeObjectURL(url);
    }
  });
}
