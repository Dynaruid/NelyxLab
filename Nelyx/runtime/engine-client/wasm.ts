// SPDX-License-Identifier: BSD-3-Clause
import type { EngineTransport } from './client.ts';
import { protocol as p } from './schema.ts';

export interface EngineWasmModule {
  readonly HEAPU8: Uint8Array;
  _malloc(bytes: number): number;
  _free(pointer: number): void;
  _nelyx_wasm_open(session: number, app: number, schema: number, required: number): number;
  _nelyx_wasm_dispatch(engine: number, pointer: number, length: number): number;
  _nelyx_wasm_buffer_data(buffer: number): number;
  _nelyx_wasm_buffer_length(buffer: number): number;
  _nelyx_wasm_release(buffer: number): void;
  _nelyx_engine_destroy(engine: number): void;
}
/** Invoke in the selected engine worker. No CanvasKit pointer enters this heap. */
export function createWasmTransport(
  module: EngineWasmModule,
  options: {
    session?: number;
    app?: number;
    requiredCapabilities?: number;
  } = {},
): EngineTransport {
  let engine = module._nelyx_wasm_open(
    options.session ?? 1,
    options.app ?? 1,
    p.schema,
    options.requiredCapabilities ?? p.capabilities.protocol,
  );
  if (!engine) throw new Error('Engine Wasm ABI/schema/capability initialization failed');
  return {
    async exchange(bytes) {
      if (!engine) throw new Error('Engine Wasm session closed');
      if (bytes.length > p.limits.packetBytes)
        throw new RangeError('Engine Wasm packet budget exceeded');
      const input = module._malloc(bytes.length || 1);
      if (!input) throw new Error('Engine Wasm input allocation failed');
      let output = 0;
      try {
        // Acquire views after each allocation/dispatch: memory may have grown.
        module.HEAPU8.set(bytes, input);
        output = module._nelyx_wasm_dispatch(engine, input, bytes.length);
        if (!output) throw new Error('Engine Wasm dispatch allocation failed');
        const pointer = module._nelyx_wasm_buffer_data(output),
          length = module._nelyx_wasm_buffer_length(output);
        if (length > p.limits.packetBytes || pointer + length > module.HEAPU8.length)
          throw new Error('Invalid engine Wasm output bounds');
        return module.HEAPU8.slice(pointer, pointer + length);
      } finally {
        if (output) module._nelyx_wasm_release(output);
        module._free(input);
      }
    },
    close() {
      if (engine) {
        module._nelyx_engine_destroy(engine);
        engine = 0;
      }
    },
  };
}
