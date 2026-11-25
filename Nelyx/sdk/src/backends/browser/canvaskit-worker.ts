// SPDX-License-Identifier: BSD-3-Clause
import type { CanvasKitManifest } from './canvaskit-manifest.ts';
import type { CanvasKitScript, PreparedCanvasKit } from './canvaskit-loader.ts';
import {
  checkCanvasKitManifest,
  checkPreparedCanvasKit,
  instantiateCanvasKit,
} from './canvaskit-loader.ts';

export function loadWorkerCanvasKit(
  root: URL,
  manifest: CanvasKitManifest,
  assets: PreparedCanvasKit,
) {
  checkPreparedCanvasKit(assets, checkCanvasKitManifest(root, manifest));
  return instantiateCanvasKit(assets, async (script) => {
    // The pinned Emscripten file is a classic script with a local factory.
    const url = URL.createObjectURL(
      new Blob(['export default (fetch) => {\n', script, '\nreturn CanvasKitInit;\n};\n'], {
        type: 'text/javascript',
      }),
    );
    try {
      const module = (await import(/* @vite-ignore */ url)) as { default?: CanvasKitScript };
      return module.default;
    } finally {
      URL.revokeObjectURL(url);
    }
  });
}
