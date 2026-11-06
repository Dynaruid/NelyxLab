// SPDX-License-Identifier: BSD-3-Clause
/** The deployment description is portable; importing it does not load a GPU type environment. */
export interface CanvasKitManifest {
  readonly schema: 'nelyx.canvaskit/v1';
  readonly adapterAbi: 1;
  readonly version: 'm153-nelyx-paragraph.1';
  readonly paragraphApiVersion: 1;
  readonly files: readonly {
    readonly id: 'canvaskit.js' | 'canvaskit.wasm';
    readonly path: string;
    readonly sha256: string;
  }[];
}
