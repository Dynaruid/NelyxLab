// SPDX-License-Identifier: BSD-3-Clause

export function sharedArrayBufferConstructor(
  realm: Pick<typeof globalThis, 'SharedArrayBuffer' | 'WebAssembly'>,
): SharedArrayBufferConstructor {
  const constructor = realm.SharedArrayBuffer;
  if (typeof constructor === 'function') return constructor;

  // Some isolated WebViews hide the global constructor. Shared Wasm memory still exposes it.
  const { buffer } = new realm.WebAssembly.Memory({ initial: 0, maximum: 0, shared: true });
  if (Object.prototype.toString.call(buffer) !== '[object SharedArrayBuffer]')
    throw new Error('WebAssembly shared memory is unavailable');
  return buffer.constructor as SharedArrayBufferConstructor;
}
