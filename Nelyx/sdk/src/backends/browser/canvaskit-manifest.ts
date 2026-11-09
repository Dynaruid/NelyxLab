// SPDX-License-Identifier: BSD-3-Clause
/** The deployment description is portable; importing it does not load a GPU type environment. */
export interface CanvasKitManifest {
  readonly schema: 'nelyx.canvaskit/v1';
  readonly adapterAbi: 1;
  readonly version: 'm153-nelyx-paragraph.6';
  readonly paragraphApiVersion: 1;
  readonly pictureApiVersion: 3;
  readonly fontApiVersion: 1;
  readonly initialMemoryBytes: 134217728;
  readonly maximumMemoryBytes: 268435456;
  readonly files: readonly {
    readonly id: 'canvaskit.js' | 'canvaskit.wasm';
    readonly path: string;
    readonly sha256: string;
  }[];
}
