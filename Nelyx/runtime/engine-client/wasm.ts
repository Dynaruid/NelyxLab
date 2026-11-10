// SPDX-License-Identifier: BSD-3-Clause
import type { EngineTransport } from './client.ts';
import { protocol as p } from './schema.ts';

export interface EngineWasmModule {
  readonly HEAPU8: Uint8Array;
  _nelyx_wasm_refresh_heap?(): void;
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
  const counters = { exchanges: 0, inputCopyBytes: 0, outputCopyBytes: 0 };
  return {
    diagnostics: () => ({ ...counters }),
    async exchange(bytes) {
      if (!engine) throw new Error('Engine Wasm session closed');
      if (bytes.length > p.limits.packetBytes)
        throw new RangeError('Engine Wasm packet budget exceeded');
      module._nelyx_wasm_refresh_heap?.();
      const input = module._malloc(bytes.length || 1);
      if (!input) throw new Error('Engine Wasm input allocation failed');
      let output = 0;
      try {
        // Acquire views after each allocation/dispatch: memory may have grown.
        module._nelyx_wasm_refresh_heap?.();
        module.HEAPU8.set(bytes, input);
        ++counters.exchanges;
        counters.inputCopyBytes += bytes.length;
        output = module._nelyx_wasm_dispatch(engine, input, bytes.length);
        if (!output) throw new Error('Engine Wasm dispatch allocation failed');
        const pointer = module._nelyx_wasm_buffer_data(output),
          length = module._nelyx_wasm_buffer_length(output);
        module._nelyx_wasm_refresh_heap?.();
        if (length > p.limits.responseBytes || pointer + length > module.HEAPU8.length)
          throw new Error('Invalid engine Wasm output bounds');
        // The engine owns and releases this allocation in finally. A response
        // must survive release and the next memory.grow, so this copy is owned
        // by the caller and cannot be replaced with a borrowed heap view.
        const response = module.HEAPU8.slice(pointer, pointer + length);
        counters.outputCopyBytes += length;
        return response;
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
