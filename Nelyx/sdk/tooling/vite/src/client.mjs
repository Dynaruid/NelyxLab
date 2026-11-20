// SPDX-License-Identifier: BSD-3-Clause
import { createElement, StrictMode } from 'react';
import { closeAllWebApplications, registerApplication } from '@nelyx/sdk/platforms/web/application';
import { getWebDeployment } from '@nelyx/sdk/platforms/web/environment';
import { defineAssetManifest } from '@nelyx/sdk/runtime/config';

function showError(error) {
  document.body.dataset.error = String(error);
  let alert = document.querySelector('#nelyx-start-error');
  if (!alert) {
    alert = document.createElement('p');
    alert.id = 'nelyx-start-error';
    alert.setAttribute('role', 'alert');
    document.body.prepend(alert);
  }
  alert.textContent = String(error);
  console.error(error);
}

export function startPwa({ config, assets, component, configure }) {
  const root = new URL('./', document.baseURI);
  const runtime = new URL('runtime/', root);
  const host = getWebDeployment();
  Object.assign(document.documentElement.dataset, {
    nelyxFormat: host.format,
    nelyxHost: host.host,
    nelyxOs: host.os,
  });
  document.title = config.displayName ?? config.name;
  const key = Symbol.for('nelyx.pwa.reload');
  if (import.meta.hot) {
    (window[key] ??= {}).close = closeAllWebApplications;
  }
  async function mount() {
    const container = document.getElementById('app');
    if (!container) throw new Error('Nelyx PWA requires an #app element');
    const response = await fetch(new URL('native-manifest.json', runtime), { redirect: 'error' });
    if (!response.ok) throw new Error('CanvasKit manifest HTTP ' + response.status);
    const canvasKitManifest = await response.json();
    if (import.meta.hot && window[key]?.reloading) return;
    const profile = new URL(location.href).searchParams.get('profile');
    configure({
      manifest: defineAssetManifest(assets),
      assetsRoot: root,
      canvasKitRoot: runtime,
      canvasKitManifest,
      ...(profile ? { profile } : {}),
    });
    registerApplication(
      config.name,
      () => createElement(StrictMode, null, createElement(component)),
      container,
    );
    if (
      import.meta.env.PROD &&
      host.host === 'browser' &&
      'serviceWorker' in navigator &&
      (root.protocol === 'https:' ||
        (root.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(root.hostname)))
    ) {
      void navigator.serviceWorker
        .register(new URL('sw.js', root), { scope: root.href, updateViaCache: 'none' })
        .catch((error) => {
          document.body.dataset.offlineError = String(error);
          console.error(error);
        });
    }
  }
  void mount().catch(showError);
}
