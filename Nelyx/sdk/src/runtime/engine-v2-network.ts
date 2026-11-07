// SPDX-License-Identifier: BSD-3-Clause
import { protocol as p, encodeUtf8, httpHeaders } from '@nelyx/core/v2';
import type { AppTextBackend } from '@nelyx/core/v2';
import { FlutterError } from '@nelyx/core/foundation/flutter-error';
import type {
  AssetCancellation,
  AssetRead,
  AssetTransport,
  AssetProgress,
} from './engine-v2-assets.ts';

const transportBytes = 512 * 1024;
const tick = () => new Promise<void>((resolve) => setTimeout(resolve, 5));
export function networkAssetAddress(baseUrl: string, key: string): void {
  for (const value of [baseUrl, key]) {
    if (typeof value !== 'string' || value.length > 4096)
      throw Error('Invalid NetworkAssetBundle URL');
    for (let at = 0; at < value.length; ++at)
      if (value.charCodeAt(at) < 32 || value.charCodeAt(at) === 127)
        throw Error('Invalid NetworkAssetBundle URL');
    encodeUtf8(value, 4096);
  }
  if (!/^https?:\/\//i.test(baseUrl))
    throw Error('NetworkAssetBundle requires an HTTP(S) base URL');
}
function httpStatus(key: string, status: number): never {
  throw new FlutterError(`Unable to load asset: "${key}". HTTP status code ${status}`);
}
/** Grow only after credit admission. Unknown/compressed responses do not need a
 * guessed Content-Length or a full-resource reservation before the first byte. */
async function readStream(
  backend: AppTextBackend,
  token: number,
  size: number,
  next: () => Promise<Uint8Array | null>,
  cancellation: AssetCancellation,
  progress: AssetProgress | undefined,
  maximumBytes: number,
): Promise<Uint8Array> {
  let bytes = new Uint8Array(Math.max(0, size)),
    at = 0;
  for (;;) {
    cancellation.check();
    const chunk = await next();
    cancellation.check();
    if (chunk === null) break;
    const needed = at + chunk.length;
    if (needed > maximumBytes || (size >= 0 && needed > size))
      throw Error('Network asset exceeds its admitted size');
    if (needed > bytes.length) {
      const other = backend.snapshot().assetDataBytes - bytes.length;
      const limit = Math.min(maximumBytes, p.limits.resourceBytes - other);
      if (needed > limit) throw Error('Network asset data budget exceeded');
      const capacity = Math.min(limit, Math.max(needed, bytes.length * 2, 65536));
      backend.resizeAssetBytes(token, capacity);
      const grown = new Uint8Array(capacity);
      grown.set(bytes);
      bytes = grown;
    }
    bytes.set(chunk, at);
    at = needed;
    progress?.({ cumulativeBytesLoaded: at, expectedTotalBytes: size < 0 ? null : size });
  }
  if (size >= 0 && at !== size) throw Error('Network asset is shorter than its declared size');
  if (at !== bytes.length) bytes = bytes.slice(0, at);
  backend.resizeAssetBytes(token, at);
  return bytes;
}
async function nativeRead(
  backend: AppTextBackend,
  baseUrl: string,
  key: string,
  cancellation: AssetCancellation,
  headers: Readonly<Record<string, string>>,
): Promise<AssetRead> {
  if (
    !backend.openNetwork ||
    !backend.pollNetwork ||
    !backend.readNetwork ||
    !backend.networkChunk ||
    !backend.cancelNetwork ||
    !backend.retireNetwork
  )
    throw Error('Required Native App HTTP service is unavailable');
  if (Object.keys(headers).length && backend.networkVersion !== 2)
    throw Error('Required Native App HTTP header service version 2 is unavailable');
  const handle = backend.openNetwork(baseUrl, key, headers);
  let unbind = () => {},
    closing: Promise<void> | undefined;
  const close = () =>
    (closing ??= (async () => {
      unbind();
      backend.cancelNetwork!(handle);
      // A cancelled WinHTTP handle can still issue callbacks. Keep its memory
      // until the final HANDLE_CLOSING callback and every borrowed copy retire.
      while (!backend.retireNetwork!(handle)) await tick();
    })());
  const state = () => {
    cancellation.check();
    const result = backend.pollNetwork!(handle);
    if (result.phase === 5 || result.error)
      throw Error('Native NetworkAssetBundle HTTP failure: ' + result.error);
    return result;
  };
  try {
    unbind = cancellation.listen(() => backend.cancelNetwork!(handle));
    let headers = state();
    while (headers.phase === 0) {
      await tick();
      headers = state();
    }
    if (headers.status !== 200) httpStatus(key, headers.status);
    if (headers.phase !== 1) throw Error('Invalid Native HTTP response state');
    return {
      size: Math.max(0, headers.size),
      variableSize: headers.size < 0,
      read: (token, progress, maximumBytes: number = p.limits.resourceBytes) =>
        readStream(
          backend,
          token,
          headers.size,
          async () => {
            cancellation.check();
            backend.readNetwork!(handle);
            for (;;) {
              const current = state();
              if (current.phase === 4) return null;
              if (current.phase === 3) return backend.networkChunk!(handle);
              if (current.phase !== 2) throw Error('Invalid Native HTTP read state');
              await tick();
            }
          },
          cancellation,
          progress,
          maximumBytes,
        ),
      close,
    };
  } catch (error) {
    await close();
    throw error;
  }
}
async function webRead(
  backend: AppTextBackend,
  baseUrl: string,
  key: string,
  cancellation: AssetCancellation,
  headers: Readonly<Record<string, string>>,
): Promise<AssetRead> {
  const url = new URL(key, baseUrl);
  if (!['http:', 'https:'].includes(url.protocol)) throw Error('Network assets require HTTP(S)');
  encodeUtf8(url.href, 4096);
  if (!backend.reserveNetworkBytes) throw Error('Required Web App HTTP credit is unavailable');
  const release = backend.reserveNetworkBytes(transportBytes),
    controller = new AbortController();
  let unbind = () => {},
    reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
  let closing: Promise<void> | undefined;
  const close = () =>
    (closing ??= (async () => {
      unbind();
      controller.abort();
      if (reader) {
        await reader.cancel().catch(() => {});
        reader.releaseLock();
      }
      release();
    })());
  try {
    unbind = cancellation.listen(() => controller.abort());
    const response = await fetch(url, { signal: controller.signal, headers: { ...headers } });
    cancellation.check();
    reader = response.body?.getReader();
    if (response.status !== 200) httpStatus(key, response.status);
    const raw = response.headers.get('Content-Length');
    if (raw !== null && !/^[0-9]+$/.test(raw)) throw Error('Invalid network Content-Length');
    const encoded = response.headers.get('Content-Encoding');
    const size =
      encoded && encoded.toLowerCase() !== 'identity' ? -1 : raw === null ? -1 : Number(raw);
    if (size > p.limits.resourceBytes) throw Error('Network asset exceeds resource budget');
    if (!response.body && size > 0) throw Error('Network response streaming is unavailable');
    return {
      size: Math.max(0, size),
      variableSize: size < 0,
      read: (token, progress, maximumBytes: number = p.limits.resourceBytes) =>
        readStream(
          backend,
          token,
          size,
          async () => {
            if (!reader) return null;
            const chunk = await reader.read();
            return chunk.done ? null : chunk.value;
          },
          cancellation,
          progress,
          maximumBytes,
        ),
      close,
    };
  } catch (error) {
    await close();
    throw error;
  }
}
export const networkAssetHeaders = httpHeaders;
export function networkAssetTransport(
  baseUrl: string,
  headers: Readonly<Record<string, string>> = {},
): AssetTransport {
  const snapshot = networkAssetHeaders(headers);
  return (backend, key, cancellation) => {
    networkAssetAddress(baseUrl, key);
    cancellation.check();
    return backend.openNetwork
      ? nativeRead(backend, baseUrl, key, cancellation, snapshot)
      : webRead(backend, baseUrl, key, cancellation, snapshot);
  };
}
