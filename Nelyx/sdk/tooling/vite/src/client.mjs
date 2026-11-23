// SPDX-License-Identifier: BSD-3-Clause
import { createElement, StrictMode } from 'react';
import { closeAllWebApplications, registerApplication } from '@nelyx/sdk/frontend/dom/application';
import { bindFrontendBackend } from '@nelyx/sdk/frontend/dom/environment';
import { defineAssetManifest } from '@nelyx/sdk/runtime/config';
import { frontend, openBackend } from 'virtual:nelyx-backend';

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

export function startFrontend(component) {
  const root = new URL('./', document.baseURI);
  const runtime = new URL('runtime/', root);
  const key = Symbol.for('nelyx.frontend.reload');
  const lifetime = new AbortController();
  let unbind;
  const close = async () => {
    try {
      await closeAllWebApplications();
    } finally {
      lifetime.abort();
      unbind?.();
    }
  };
  if (import.meta.hot) (window[key] ??= {}).close = close;
  async function mount() {
    const container = document.getElementById('app');
    if (!container) throw new Error('Nelyx requires an #app element');
    const signal = lifetime.signal;
    const started = performance.now();
    const backendReady = openBackend(root, signal).then((backend) => ({
      backend,
      elapsed: performance.now() - started,
    }));
    const manifestReady = fetch(new URL('native-manifest.json', runtime), {
      signal,
      redirect: 'error',
    }).then((response) => {
      if (!response.ok) throw new Error('CanvasKit manifest HTTP ' + response.status);
      return response.json();
    });
    const [{ backend, elapsed }, canvasKitManifest] = await Promise.all([
      backendReady,
      manifestReady,
    ]);
    signal.throwIfAborted();
    if (window[key]?.reloading) return;
    const { target, os, backend: description } = backend.host;
    document.title = frontend.displayName;
    await backend.setTitle?.(
      (description?.title ?? frontend.displayName) +
        ' ' +
        frontend.appVersion +
        ' (' +
        description?.os +
        ')',
    );
    signal.throwIfAborted();
    Object.assign(document.documentElement.dataset, {
      nelyxFormat: frontend.pwa ? 'pwa' : target,
      nelyxTarget: target,
      nelyxHost: target === 'tauri' ? 'tauri' : 'browser',
      nelyxOs: os,
      nelyxAppVersion: frontend.appVersion,
      nelyxBackendMs: String(Math.round(elapsed)),
      nelyxBackendVersion: description.backendVersion,
      nelyxBackendSourceId: description.sourceId,
      nelyxBackendProtocol: String(description.protocolVersion),
      ...(target === 'tauri'
        ? {
            tauriOs: description.os,
            tauriVersion: frontend.appVersion,
            nelyxFrontendBuildId: description.frontendBuildId ?? '',
          }
        : {}),
    });
    unbind = bindFrontendBackend(window, backend);
    const profile = new URL(location.href).searchParams.get('profile');
    const options = {
      backend,
      manifest: defineAssetManifest(frontend.assets),
      assetsRoot: root,
      canvasKitRoot: runtime,
      canvasKitManifest,
      ...(profile ? { profile } : {}),
    };
    registerApplication(
      frontend.name,
      () => createElement(StrictMode, null, createElement(component, { options })),
      container,
    );
    if (
      import.meta.env.PROD &&
      frontend.pwa &&
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
  void mount().catch((error) => {
    if (lifetime.signal.aborted) return;
    lifetime.abort();
    unbind?.();
    showError(error);
  });
}
