// SPDX-License-Identifier: BSD-3-Clause
import { Channel, invoke } from '@tauri-apps/api/core';
import { getCurrentWebview } from '@tauri-apps/api/webview';
import type { ViewOwner } from '@nelyx/core/ui/types';
import type {
  NativePlatformViewSession,
  NativeViewEvent,
} from './browser/native-platform-views.ts';

export async function openNativePlatformViewSession(
  platform: 'windows' | 'android' | 'linux' | 'apple',
  owner: ViewOwner,
  onEvent: (event: NativeViewEvent) => void,
  releaseCallback: (id: number) => void,
): Promise<NativePlatformViewSession> {
  const events = platform === 'android' ? undefined : new Channel<NativeViewEvent>(onEvent);
  const unlisten = !events
    ? await getCurrentWebview().listen<{ owner: ViewOwner; event: NativeViewEvent }>(
        'nelyx-android-platform-view',
        ({ payload }: { payload: { owner: ViewOwner; event: NativeViewEvent } }) => {
          if (payload.owner.id === owner.id && payload.owner.generation === owner.generation)
            onEvent(payload.event);
        },
      )
    : undefined;
  const release = () => {
    if (events) releaseCallback(events.id);
    unlisten?.();
  };
  const control = platform + '_platform_view';
  const command = (request: Record<string, unknown>) =>
    invoke<void>(control, { request: { owner, ...request } });
  try {
    await invoke(control, { request: { action: 'open', owner }, ...(events ? { events } : {}) });
  } catch (error) {
    release();
    throw error;
  }
  return {
    create: (instanceId, viewType, text) =>
      command({ action: 'create', instanceId, viewType, text }),
    update: (instanceId, text) => command({ action: 'update', instanceId, text }),
    remove: (instanceId) => command({ action: 'remove', instanceId }),
    focus: (instanceId) => command({ action: 'focus', instanceId }),
    hide: (through) => command({ action: 'hide', through }),
    present: (packet) => {
      if (platform !== 'android') return invoke<void>(control + '_frame', packet);
      let serialized = '';
      for (let offset = 0; offset < packet.length; offset += 16_384)
        serialized += String.fromCharCode(...packet.subarray(offset, offset + 16_384));
      return invoke<void>('android_platform_view_frame', { packet: btoa(serialized) });
    },
    async close() {
      if (events) events.onmessage = () => {};
      try {
        await command({ action: 'close' });
      } finally {
        release();
      }
    },
  };
}
