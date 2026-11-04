// SPDX-License-Identifier: BSD-3-Clause
import { createBrowserEngineV2Surface } from '@nelyx/sdk/engine-v2';
import type { EngineBrowserSurface, EngineWebProfile } from '@nelyx/sdk/engine-v2';

const canvas = document.querySelector('canvas')!;
const status = document.querySelector<HTMLElement>('#status')!;
const error = document.querySelector<HTMLElement>('#error')!;
const environment = globalThis as unknown as {
  __v2: {
    surface?: EngineBrowserSurface;
    app?: Worker;
    ready: boolean;
    errors: string[];
    appReady?: Record<string, unknown>;
    appEvents: Record<string, unknown>[];
    close?: () => Promise<unknown>;
  };
};
const current = (environment.__v2 = {
  ready: false,
  errors: [],
  appEvents: [],
} as typeof environment.__v2);
const fail = (message: string) => {
  current.errors.push(message);
  if (current.errors.length > 16) current.errors.shift();
  error.textContent = message;
};
void (async () => {
  const root = new URL('.', location.href),
    profile = (new URL(location.href).searchParams.get('profile') ?? 'auto') as EngineWebProfile;
  const surface = await createBrowserEngineV2Surface(canvas, {
    root,
    profile,
    onError: fail,
    onStats(value) {
      const render = value['render-stats'] as { counters?: { draws: number } } | undefined;
      status.textContent = `${value.selectedProfile ?? 'starting'} · frames ${render?.counters?.draws ?? 0}`;
    },
  });
  current.surface = surface;
  const app = new Worker(new URL('web/app-worker.js', root));
  current.app = app;
  app.addEventListener('message', (event) => {
    current.appEvents.push(event.data);
    if (current.appEvents.length > 16) current.appEvents.shift();
    if (event.data.kind === 'app-ready') {
      current.appReady = event.data;
      current.ready = true;
    } else if (event.data.kind === 'app-error') fail(event.data.message);
  });
  app.addEventListener('error', (event) => fail(event.message));
  const port = surface.createAppPort();
  app.postMessage({ kind: 'start', root: root.href, port }, [port]);
  document
    .querySelector('#app-delay')!
    .addEventListener('click', () => app.postMessage({ kind: 'delay', milliseconds: 200 }));
  document
    .querySelector('#content-delay')!
    .addEventListener('click', () => surface.delayContent(200));
  document
    .querySelector('#update')!
    .addEventListener('click', () => app.postMessage({ kind: 'update' }));
  current.close = async () => {
    try {
      return await surface.close();
    } finally {
      app.terminate();
      current.ready = false;
      status.textContent = 'Closed';
    }
  };
  document.querySelector('#close')!.addEventListener('click', () => {
    void current.close!().catch((e) => fail(String(e)));
  });
})().catch((e) => fail(String(e)));
