// SPDX-License-Identifier: BSD-3-Clause
/** The deployment description is portable; importing it does not load a GPU type environment. */
export interface CanvasKitManifest {
  readonly schema: 'nelyx.canvaskit/v2';
  readonly adapterAbi: 1;
  readonly version: '0.42.0';
  readonly source: 'npm';
  readonly initialMemoryBytes: 134217728;
  readonly maximumMemoryBytes: 2147483648;
  readonly files: readonly {
    readonly id: 'canvaskit.js' | 'canvaskit.wasm';
    readonly path: string;
    readonly sha256: string;
  }[];
}
