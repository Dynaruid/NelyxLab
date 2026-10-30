import type { CanvasKit } from 'canvaskit-wasm';
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
const runtimes = new Map<string, Promise<CanvasKit>>();
export const sha256 = async (bytes: Uint8Array) =>
  Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new Uint8Array(bytes))), (byte) =>
    byte.toString(16).padStart(2, '0'),
  ).join('');
export async function loadCanvasKit(root: URL, manifest: CanvasKitManifest): Promise<CanvasKit> {
  if (
    !['http:', 'https:'].includes(root.protocol) ||
    !root.href.endsWith('/') ||
    manifest.schema !== 'nelyx.canvaskit/v1' ||
    manifest.version !== 'm153-nelyx-paragraph.1' ||
    manifest.adapterAbi !== 1 ||
    manifest.files.length !== 2 ||
    manifest.paragraphApiVersion !== 1
  )
    throw new Error('Invalid CanvasKit runtime manifest');
  const ids = new Set<string>();
  for (const file of manifest.files) {
    if (
      ids.has(file.id) ||
      !['canvaskit.js', 'canvaskit.wasm'].includes(file.id) ||
      !/^[-a-zA-Z0-9_.]+$/.test(file.path) ||
      file.path === '.' ||
      file.path === '..' ||
      !/^[a-f0-9]{64}$/.test(file.sha256)
    )
      throw new Error('CanvasKit artifact identity/path/hash');
    ids.add(file.id);
  }
  const key = manifest.files.map((file) => file.sha256).join('/');
  if (runtimes.has(key)) return runtimes.get(key)!;
  if (runtimes.size) throw new Error('CanvasKit runtime changes require page reload');
  const load = (async () => {
    const bytes = await Promise.all(
      manifest.files.map(async (file) => {
        const response = await fetch(new URL(file.path, root));
        if (!response.ok) throw new Error('CanvasKit HTTP ' + response.status);
        const data = new Uint8Array(await response.arrayBuffer());
        if (data.byteLength > 32 * 1024 * 1024 || (await sha256(data)) !== file.sha256)
          throw new Error('CanvasKit artifact size/hash mismatch');
        return data;
      }),
    );
    const script = bytes[manifest.files.findIndex((file) => file.id === 'canvaskit.js')]!,
      wasm = bytes[manifest.files.findIndex((file) => file.id === 'canvaskit.wasm')]!;
    const url = URL.createObjectURL(
        new Blob([new Uint8Array(script)], { type: 'text/javascript' }),
      ),
      element = document.createElement('script');
    element.src = url;
    try {
      await new Promise<void>((resolve, reject) => {
        element.onload = () => resolve();
        element.onerror = () => reject(new Error('CanvasKit script load failed'));
        document.head.append(element);
      });
    } finally {
      element.remove();
      URL.revokeObjectURL(url);
    }
    const factory = (
      globalThis as typeof globalThis & {
        CanvasKitInit?: (options: {
          wasmBinary: Uint8Array;
          locateFile: (name: string) => string;
        }) => Promise<CanvasKit>;
      }
    ).CanvasKitInit;
    if (!factory) throw new Error('CanvasKit initialization export missing');
    const runtime = await factory({
      wasmBinary: wasm,
      locateFile: (name) => new URL(name, root).href,
    });
    if (
      (
        runtime as CanvasKit & { nelyxParagraphApiVersion?: () => number }
      ).nelyxParagraphApiVersion?.() !== 1
    )
      throw new Error('CanvasKit paragraph API1 binding mismatch');
    return runtime;
  })();
  runtimes.set(key, load);
  try {
    return await load;
  } catch (error) {
    runtimes.delete(key);
    throw error;
  }
}
