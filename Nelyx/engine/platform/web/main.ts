// SPDX-License-Identifier: BSD-3-Clause
import { createBrowserEngineV2Surface } from '@nelyx/sdk/engine-v2';
import type { EngineWebProfile } from '@nelyx/sdk/engine-v2';

const canvas = document.querySelector('canvas')!;
const status = document.querySelector<HTMLElement>('#status')!;
const error = document.querySelector<HTMLElement>('#error')!;
const fail = (message: string) => {
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
  const app = new Worker(new URL('web/app-worker.js', root));
  app.addEventListener('message', (event) => {
    if (event.data.kind === 'app-error') fail(event.data.message);
  });
  app.addEventListener('error', (event) => fail(event.message));
  const port = surface.createAppPort(app);
  app.postMessage({ kind: 'start', root: root.href, port }, [port]);
  document
    .querySelector('#update')!
    .addEventListener('click', () => app.postMessage({ kind: 'update' }));
  const close = async () => {
    try {
      return await surface.close();
    } finally {
      status.textContent = 'Closed';
    }
  };
  document.querySelector('#close')!.addEventListener('click', () => {
    void close().catch((e) => fail(String(e)));
  });
})().catch((e) => fail(String(e)));
