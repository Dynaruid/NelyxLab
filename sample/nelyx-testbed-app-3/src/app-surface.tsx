// SPDX-License-Identifier: BSD-3-Clause
import { useEffect, useMemo, useState } from 'react';
import { describeError } from '@nelyx/core/foundation/errors';
import type { ViewMetrics } from '@nelyx/core/ui/types';
import { defineApp } from '@nelyx/sdk/app';
import type { WebApplication } from '@nelyx/sdk/frontend/dom/application';
import { windowAcrylicFor } from '@nelyx/sdk/frontend/dom/environment';
import { ApplicationSurface } from '@nelyx/sdk/frontend/dom/surface';
import type { FrontendProps } from '@nelyx/vite/client';
import { Testbed } from './app.ts';
import { HostPanel } from './host-panel.tsx';
import type { HostPlacement } from './host-slot.ts';
import {
  nativeEditorDemos,
  nativeEditorHost,
  platformViewFactories,
  PlatformViewsScreen,
} from './platform-views.ts';
import { MaterialApp } from '@nelyx/material/widgets';

declare global {
  interface Window {
    nelyxTestbedMetricsProbe?: (read: () => ViewMetrics) => void;
  }
}

function reportMetrics(application: WebApplication) {
  window.nelyxTestbedMetricsProbe?.(() => application.view.currentMetrics);
}

export function App({ options }: FrontendProps) {
  const [placement, setPlacement] = useState<HostPlacement | null>(null);
  const [error, setError] = useState('');
  const [acrylic] = useState(() => windowAcrylicFor());
  const [transparent, setTransparent] = useState(acrylic?.enabled ?? false);
  const host = options.backend?.host;
  const nativeHost = host?.target === 'tauri' ? nativeEditorHost(host.os) : undefined;
  const nativeEditor =
    nativeHost && new URL(location.href).searchParams.has(nativeEditorDemos[nativeHost].query)
      ? nativeHost
      : undefined;
  // The framework clears and redraws the gallery on every frame.
  const surfaceOptions = useMemo(
    () => ({
      ...options,
      preserveDrawingBuffer: false,
      platformViews: platformViewFactories,
      ...(nativeEditor === 'windows'
        ? { windowsPlatformViews: [nativeEditorDemos.windows.type] as const }
        : {}),
      ...(nativeEditor === 'android' ? { androidPlatformViews: true } : {}),
      ...(nativeEditor === 'linux' ? { linuxPlatformViews: true } : {}),
      ...(nativeEditor === 'iOS' || nativeEditor === 'macOS' ? { applePlatformViews: true } : {}),
    }),
    [options, nativeEditor],
  );
  useEffect(() => {
    document.documentElement.toggleAttribute('data-window-acrylic', transparent);
    return () => document.documentElement.removeAttribute('data-window-acrylic');
  }, [transparent]);
  const definition = useMemo(
    () =>
      defineApp({
        id: 'nelyx.testbed-3',
        defaultFont: 'roboto-regular',
        accessibilityEnabled: true,
        // Geometry-only updates can share a snapshot while the window moves.
        semanticsUpdateInterval: 100,
        ...(acrylic ? { background: 0 } : {}),
        createRoot: () =>
          nativeEditor
            ? new MaterialApp({
                title: 'Nelyx Testbed 3',
                debugShowCheckedModeBanner: false,
                home: new PlatformViewsScreen(nativeEditor),
              })
            : new Testbed(setPlacement, acrylic, setTransparent),
      }),
    [acrylic, nativeEditor],
  );

  return (
    <main className="testbed-surface">
      {error && <p role="alert">{error}</p>}
      <ApplicationSurface
        definition={definition}
        options={surfaceOptions}
        style={{ flex: 1, width: '100%', height: '100%' }}
        onReady={reportMetrics}
        onError={(error) => {
          const message = describeError(error);
          console.error(message, error);
          setError(message);
        }}
      />
      {placement && <HostPanel key={placement.page} placement={placement} />}
    </main>
  );
}
