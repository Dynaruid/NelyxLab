// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2013 The Flutter Authors. All rights reserved.
// Adapted from the pinned ui_web BrowserDetection.detectOperatingSystem.
import type {
  BrowserOperatingSystem,
  WebPlatformEnvironment,
} from '@nelyx/core/foundation/platform';
import type {
  BackendConnection,
  FrontendHost,
  WebViewScrollEdgeEffects,
  WindowAcrylic,
} from '../../backends/backend-contract.ts';

export type { WebViewScrollEdgeEffects, WindowAcrylic } from '../../backends/backend-contract.ts';

export interface BrowserPlatformNavigator {
  readonly platform: string;
  readonly maxTouchPoints?: number | null;
  readonly userAgent: string;
}
/** Lazy browser detection; injected navigator data also supports standalone hosts. */
export class BrowserPlatformEnvironment implements WebPlatformEnvironment {
  readonly kind = 'web';
  debugOperatingSystemOverride: BrowserOperatingSystem | null = null;
  debugUserAgentOverride: string | null = null;
  private cached: BrowserOperatingSystem | undefined;
  private cachedUserAgent: string | undefined;
  constructor(
    private readonly navigator: BrowserPlatformNavigator,
    readonly isTest = false,
  ) {}
  get userAgent(): string {
    return this.debugUserAgentOverride ?? (this.cachedUserAgent ??= this.navigator.userAgent);
  }
  get operatingSystem(): BrowserOperatingSystem {
    return this.debugOperatingSystemOverride ?? (this.cached ??= this.detectOperatingSystem());
  }
  detectOperatingSystem({
    overridePlatform,
    overrideMaxTouchPoints,
  }: {
    readonly overridePlatform?: string;
    readonly overrideMaxTouchPoints?: number;
  } = {}): BrowserOperatingSystem {
    const platform = overridePlatform ?? this.navigator.platform;
    if (platform.startsWith('Mac'))
      return (overrideMaxTouchPoints ?? Math.trunc(this.navigator.maxTouchPoints ?? 0)) > 2
        ? 'iOS'
        : 'macOS';
    const lower = platform.toLowerCase();
    if (lower.includes('iphone') || lower.includes('ipad') || lower.includes('ipod')) return 'iOS';
    if (this.userAgent.includes('Android')) return 'android';
    return platform.startsWith('Linux')
      ? 'linux'
      : platform.startsWith('Win')
        ? 'windows'
        : 'unknown';
  }
}
let defaultEnvironment: BrowserPlatformEnvironment | undefined;
/** Built-in Web applications share the detected OS cache within this realm. */
export function getBrowserPlatformEnvironment(): BrowserPlatformEnvironment {
  return (defaultEnvironment ??= new BrowserPlatformEnvironment(navigator));
}

const backends = new WeakMap<Window, BackendConnection>();

export function bindFrontendBackend(view: Window, backend: BackendConnection): () => void {
  if (backends.has(view)) throw new Error('The frontend backend is already bound');
  backends.set(view, backend);
  return () => {
    if (backends.get(view) === backend) backends.delete(view);
  };
}

export function getFrontendHost(view: Window = window): FrontendHost {
  return (
    (backends.get(view) ?? backends.get(view.opener))?.host ?? {
      target: 'web',
      os: new BrowserPlatformEnvironment(view.navigator).operatingSystem,
    }
  );
}

/** The native iOS WebView associated with this frontend window. */
export function webViewScrollEdgeEffectsFor(
  view: Window = window,
): WebViewScrollEdgeEffects | undefined {
  return backends.get(view)?.scrollEdgeEffects;
}

/** Desktop Acrylic for the current opted-in Windows Tauri window, when supported by DWM. */
export function windowAcrylicFor(view: Window = window): WindowAcrylic | undefined {
  return backends.get(view)?.windowAcrylic;
}

export async function invokeAppBackend(command: string, input?: unknown, view: Window = window) {
  const backend = backends.get(view) ?? backends.get(view.opener);
  if (!backend) throw new Error('Start the Nelyx frontend before calling the app backend');
  return backend.invoke(command, input);
}
