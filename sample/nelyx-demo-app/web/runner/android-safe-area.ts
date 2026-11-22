// SPDX-License-Identifier: BSD-3-Clause
import type { ViewEnvironment } from '@nelyx/core/ui/types';
import type { WebSafeAreaSource } from '@nelyx/sdk/platforms/web/application';
import { getWebDeployment } from '@nelyx/sdk/platforms/web/environment';

type SafeArea = ViewEnvironment['safeArea'];
interface SafeAreaChannel {
  onmessage: (insets: SafeArea) => void;
}

export function connectAndroidSafeArea(): WebSafeAreaSource | undefined {
  const { host, os } = getWebDeployment();
  if (host !== 'tauri' || os !== 'android') return;
  const core = (
    window as Window & {
      __TAURI__?: {
        core: {
          Channel: new () => SafeAreaChannel;
          invoke: (command: string, args: { onChange: SafeAreaChannel }) => Promise<void>;
        };
      };
    }
  ).__TAURI__?.core;
  if (!core) return undefined;
  const onChange = new core.Channel();
  const listeners = new Set<() => void>();
  let physical: SafeArea | undefined;
  onChange.onmessage = (insets) => {
    physical = insets;
    for (const listener of listeners) listener();
  };
  void core.invoke('watch_safe_area', { onChange }).catch((error: unknown) => {
    console.error('Could not subscribe to Android safe area', error);
  });
  return {
    read() {
      if (!physical) return undefined;
      const scale = window.devicePixelRatio || 1;
      return {
        top: physical.top / scale,
        right: physical.right / scale,
        bottom: physical.bottom / scale,
        left: physical.left / scale,
      };
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
