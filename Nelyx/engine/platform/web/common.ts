// SPDX-License-Identifier: BSD-3-Clause
import { protocol as p, packet, response } from '../../../runtime/engine-client/codec.ts';
import type { EngineResponse, PacketOwner } from '../../../runtime/engine-client/codec.ts';
import type { PacketEndpoint } from '../../../runtime/engine-client/message-port.ts';
import type { EngineWasmModule } from '../../../runtime/engine-client/wasm.ts';

export interface BrowserModule extends EngineWasmModule {
  _nelyx_wasm_connect(engine: number, independent: number, content: number, render: number): number;
  _nelyx_host_start(engine: number, role: number, adapter: number, root: number): number;
  _nelyx_host_thread_id(): number;
  _nelyx_host_exit(): void;
  stringToUTF8(value: string, pointer: number, maximum: number): void;
  lengthBytesUTF8(value: string): number;
  PThread?: { pthreads: Record<number, Worker>; terminateAllThreads(): void };
}
export const owner: PacketOwner = { session: 1, app: 1, view: 1, generation: 1 };
export const sessionOwner: PacketOwner = { ...owner, view: 0, generation: 0 };
export class CommittedMemoryError extends Error {
  readonly fatalMemory = true;
}
export function key(handle: { slot: number; generation: number }): string {
  return handle.generation + ':' + handle.slot;
}
export function endpoint(port: MessagePort): PacketEndpoint {
  port.start();
  return {
    post: (value, transfer) => port.postMessage(value, transfer),
    subscribe(callback) {
      const receive = (event: MessageEvent<unknown>) => callback(event.data);
      port.addEventListener('message', receive);
      return () => port.removeEventListener('message', receive);
    },
    close: () => port.close(),
  };
}
export function exchange(module: BrowserModule, engine: number, bytes: Uint8Array): Uint8Array {
  if (bytes.length > p.limits.packetBytes) throw new Error('Engine packet budget exceeded');
  const op =
    bytes.length >= p.headerBytes
      ? new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint16(
          p.headerFields.opcode,
          true,
        )
      : 0;
  const sync = () => {
    const data = new Uint8Array(16),
      view = new DataView(data.buffer);
    view.setBigUint64(8, BigInt(module.HEAPU8.byteLength), true);
    const result = exchange(module, engine, packet(p.opcodes.memoryReport, sessionOwner, data));
    if (
      new DataView(result.buffer, result.byteOffset, result.byteLength).getUint16(
        p.headerFields.status,
        true,
      ) !== p.statuses.ok
    )
      throw new CommittedMemoryError(
        'Committed engine heap exceeds the unified memory budget; session cannot continue',
      );
  };
  if (op !== p.opcodes.memoryReport) sync();
  const input = module._malloc(bytes.length || 1);
  if (!input) throw new Error('Engine packet allocation failed');
  let result = 0;
  try {
    module.HEAPU8.set(bytes, input);
    result = module._nelyx_wasm_dispatch(engine, input, bytes.length);
    if (!result) throw new Error('Engine dispatch failed');
    const pointer = module._nelyx_wasm_buffer_data(result),
      length = module._nelyx_wasm_buffer_length(result);
    if (length > p.limits.packetBytes || pointer + length > module.HEAPU8.length)
      throw new Error('Engine packet output bounds');
    return module.HEAPU8.slice(pointer, pointer + length);
  } finally {
    if (result) module._nelyx_wasm_release(result);
    module._free(input);
    if (op !== p.opcodes.memoryReport && op !== p.opcodes.closeSession) sync();
  }
}
export function request(
  module: BrowserModule,
  engine: number,
  op: number,
  data: Uint8Array = new Uint8Array(0),
  id = 0n,
): EngineResponse {
  return response(exchange(module, engine, packet(op, owner, data, id)));
}
export async function sha256(bytes: Uint8Array): Promise<string> {
  const hash = await crypto.subtle.digest('SHA-256', bytes.slice());
  return [...new Uint8Array(hash)].map((v) => v.toString(16).padStart(2, '0')).join('');
}
export async function verified(
  root: string,
  file: { path: string; sha256: string },
  maximum = 32 * 1024 * 1024,
  signal?: AbortSignal,
): Promise<Uint8Array> {
  signal?.throwIfAborted();
  const result = await fetch(new URL(file.path, root), { signal: signal ?? null });
  if (!result.ok) throw new Error('Asset HTTP ' + result.status + ': ' + file.path);
  const bytes = new Uint8Array(await result.arrayBuffer());
  if (bytes.length > maximum || (await sha256(bytes)) !== file.sha256)
    throw new Error('Asset identity/size mismatch: ' + file.path);
  signal?.throwIfAborted();
  return bytes;
}
export async function script(bytes: Uint8Array): Promise<void> {
  const url = URL.createObjectURL(new Blob([bytes.slice()], { type: 'text/javascript' }));
  try {
    (globalThis as unknown as { importScripts(url: string): void }).importScripts(url);
  } finally {
    URL.revokeObjectURL(url);
  }
}
export function failure(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
