// SPDX-License-Identifier: BSD-3-Clause
import { CanvasKitProvider } from '../../render/canvaskit-web/provider.ts';
import type { PreparedPictures } from '../../render/canvaskit-web/provider.ts';
import { ContentActor, RenderActor } from './actors.ts';
import type { Viewport } from './actors.ts';
import { failure } from './common.ts';
import type { BrowserModule } from './common.ts';
import { ProviderBudget } from './memory.ts';

export async function boot(
  module: BrowserModule,
  engine: number,
  role: number,
  root: string,
): Promise<void> {
  const scope = globalThis as unknown as DedicatedWorkerGlobalScope;
  const provider = await CanvasKitProvider.load(root, new ProviderBudget(module, engine, role));
  const post = (value: Record<string, unknown>, transfer: ArrayBuffer[] = []) =>
    scope.postMessage({ kind: 'nelyx-v2-owner', role, ...value }, transfer);
  const actor =
    role === 1
      ? new ContentActor(module, engine, provider, post, false)
      : new RenderActor(module, engine, provider, post);
  scope.addEventListener('message', (event: MessageEvent) => {
    const message = event.data as {
      kind: string;
      id?: number;
      bytes?: ArrayBuffer;
      packet?: PreparedPictures;
      canvas?: OffscreenCanvas;
      frameClock?: MessagePort;
      viewport?: Viewport;
      low?: boolean;
      revision?: number;
    };
    if (!message.kind?.startsWith('v2-')) return;
    void (async () => {
      try {
        if (message.kind === 'v2-packet') {
          const bytes = actor.packet(new Uint8Array(message.bytes!));
          scope.postMessage({ kind: 'v2-packet-result', id: message.id, bytes: bytes.buffer }, [
            bytes.buffer,
          ]);
        } else if (message.kind === 'v2-wake') {
          actor.kick();
        } else if (message.kind === 'v2-font-check') {
          actor.checkFonts();
        } else if (message.kind === 'v2-viewport' && actor instanceof RenderActor) {
          actor.update(message.viewport!);
        } else if (message.kind === 'v2-attach' && actor instanceof RenderActor) {
          actor.attach(message.canvas!, message.viewport!, message.frameClock);
          post({ kind: 'render-attached', gl: provider.gl, counters: { ...provider.counters } });
        } else if (message.kind === 'v2-prepared' && actor instanceof RenderActor) {
          try {
            actor.prepared(message.packet!);
          } finally {
            post({ kind: 'prepared-released', preparation: message.packet!.preparation });
          }
        } else if (message.kind === 'v2-release-prepared') {
          provider.releasePacket((message as unknown as { preparation: bigint }).preparation);
        } else if (message.kind === 'v2-memory-pressure') {
          if (typeof message.low !== 'boolean' || !Number.isSafeInteger(message.revision))
            throw new Error('Invalid memory pressure control');
          provider.setMemoryPressure(message.low);
          post({
            kind: 'memory-pressure',
            low: message.low,
            revision: message.revision,
            counters: { ...provider.counters },
          });
        } else if (message.kind === 'v2-halt') {
          await actor.stop();
        } else if (message.kind === 'v2-stop') {
          await actor.stop();
          provider.close();
          post({
            kind: 'owner-stopped',
            counters: { ...provider.counters },
            frameClock: actor instanceof RenderActor ? actor.clockSnapshot : undefined,
          });
          setTimeout(() => module._nelyx_host_exit(), 0);
        }
      } catch (error) {
        if (message.id !== undefined)
          scope.postMessage({ kind: 'v2-packet-result', id: message.id, error: failure(error) });
        else post({ kind: 'provider-error', message: failure(error) });
      }
    })();
  });
  post({
    kind: 'owner-ready',
    thread: module._nelyx_host_thread_id(),
    heapShared:
      typeof SharedArrayBuffer !== 'undefined' && module.HEAPU8.buffer instanceof SharedArrayBuffer,
    providerShared:
      typeof SharedArrayBuffer !== 'undefined' &&
      (provider.ck as unknown as { HEAPU8: Uint8Array }).HEAPU8.buffer instanceof SharedArrayBuffer,
    counters: { ...provider.counters },
    textCapabilities: provider.textCapabilities,
  });
}
