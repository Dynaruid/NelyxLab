// SPDX-License-Identifier: BSD-3-Clause
import { useEffect, useMemo, useState } from 'react';
import { describeError } from '@nelyx/core/foundation/errors';
import { defineApp } from '@nelyx/sdk/app';
import { windowAcrylicFor } from '@nelyx/sdk/frontend/dom/environment';
import { ApplicationSurface } from '@nelyx/sdk/frontend/dom/surface';
import type { FrontendProps } from '@nelyx/vite/client';
import { Testbed } from './app.ts';
import { HostPanel } from './host-panel.tsx';
import type { HostPlacement } from './host-slot.ts';

export function App({ options }: FrontendProps) {
  const [placement, setPlacement] = useState<HostPlacement | null>(null);
  const [error, setError] = useState('');
  const [acrylic] = useState(() => windowAcrylicFor());
  const [transparent, setTransparent] = useState(acrylic?.enabled ?? false);
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
        ...(acrylic ? { background: 0 } : {}),
        createRoot: () => new Testbed(setPlacement, acrylic, setTransparent),
      }),
    [acrylic],
  );

  return (
    <main className="testbed-surface">
      {error && <p role="alert">{error}</p>}
      <ApplicationSurface
        definition={definition}
        options={options}
        style={{ flex: 1, width: '100%', height: '100%' }}
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
