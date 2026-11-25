// SPDX-License-Identifier: BSD-3-Clause
import { applyWidgetUpdate } from 'virtual:nelyx-widget-runtime';

const lifetime = (globalThis[Symbol.for('nelyx.frontend.reload')] ??= {});
const initial = document.querySelector('meta[name="nelyx-dev-state"]')?.content.split(':');
const hot = import.meta.hot;

if (hot && initial) {
  const [session, sequence, style] = initial;
  let applied = Number(sequence);
  let styles = Number(style);
  let desired;
  let processing;
  let closing;
  let closeFailed = false;
  let detached = false;
  let panel;
  let restartOnReconnect;
  let backendReady = lifetime.description;

  function show(text, { error = false, manual = false } = {}) {
    if (!text) {
      panel?.remove();
      panel = undefined;
      return;
    }
    if (!panel) {
      panel = document.createElement('aside');
      panel.style.cssText =
        'position:fixed;inset:1rem 1rem auto;z-index:2147483647;padding:1rem;background:#222;color:#fff;font:14px system-ui';
      (document.body ?? document.documentElement).append(panel);
    }
    panel.setAttribute('role', error ? 'alert' : 'status');
    panel.textContent = text;
    if (manual) {
      const button = document.createElement('button');
      button.textContent = 'Reload page';
      button.addEventListener('click', () => location.reload(), { once: true });
      panel.append(' ', button);
    }
  }

  function report(error) {
    const message = String(error);
    console.error('[nelyx]', error);
    hot.send('nelyx:client-error', { message });
    show(message, { error: true, manual: closeFailed });
  }

  function drain(reason) {
    if (closing) return closing;
    lifetime.reloading = true;
    console.info('[nelyx] ' + reason);
    return (closing = Promise.resolve()
      .then(() => lifetime.close?.())
      .then(() => true)
      .catch((error) => {
        closeFailed = true;
        report(
          new Error('Nelyx could not close the previous application: ' + reason + ' — ' + error, {
            cause: error,
          }),
        );
        return false;
      }));
  }

  lifetime.restart = async (reason) => {
    if ((await drain(reason)) && !detached) {
      detached = true;
      location.reload();
    }
  };

  hot.on('nelyx:prepare-restart', async ({ reason, token }) => {
    restartOnReconnect = reason;
    const closed = await drain(reason);
    hot.send('nelyx:drained', { token, closed });
  });

  function receive(state, checkStyle = false) {
    if (!state?.session) return;
    if (
      state.session !== session ||
      state.restart > applied ||
      (checkStyle && state.style > styles)
    ) {
      void lifetime.restart(
        state.session !== session
          ? (restartOnReconnect ?? 'Vite session changed')
          : state.restart > applied
            ? state.reason
            : 'A Vite stylesheet or module update was missed',
      );
      return;
    }
    if (lifetime.reloading || state.sequence < applied) return;
    if (state.error) show(state.error.message, { error: true });
    else if (state.backend?.state === 'pending') show('Waiting for the updated Tauri backend.');
    else show();
    if (state.sequence <= applied || !state.patch) return;
    desired = state;
    if (!processing) processing = processUpdates();
  }

  async function processUpdates() {
    try {
      while (desired && !lifetime.reloading) {
        const update = desired;
        try {
          const { default: replacement } = await import(
            /* @vite-ignore */ new URL(update.patch, import.meta.url).href
          );
          if (desired !== update || lifetime.reloading) continue;
          if (!applyWidgetUpdate(replacement)) {
            void lifetime.restart('Widget modules belong to a different source generation');
            return;
          }
          applied = update.sequence;
          document.documentElement.dataset.nelyxHotRevision = String(applied);
          lifetime.rebuild?.(applied);
        } catch (error) {
          if (desired !== update) continue;
          const current = await getState();
          if (current?.sequence > update.sequence || (current && current.session !== session)) {
            receive(current);
            if (desired !== update || lifetime.reloading) continue;
          }
          report(error);
        }
        if (desired === update) desired = undefined;
      }
    } finally {
      processing = undefined;
    }
  }

  async function getState() {
    try {
      const response = await fetch('/__nelyx/update', {
        cache: 'no-store',
        signal: AbortSignal.timeout(2_000),
      });
      if (response.ok) return await response.json();
    } catch {
      // Vite may be replacing its HTTP listener, or the view is offline.
    }
  }

  function hello(socket = lifetime.socket) {
    if (!socket || socket.readyState !== WebSocket.OPEN) return;
    const address = new URL(socket.url);
    address.search = '';
    address.hash = '';
    document.documentElement.dataset.nelyxHmr = address.href;
    hot.send('nelyx:hello', { socket: address.href });
    if (backendReady) hot.send('nelyx:backend-ready', backendReady);
  }

  lifetime.backendReady = (value) => {
    backendReady = value;
    hello();
  };
  lifetime.recoverSocket = async (connect) => {
    delete document.documentElement.dataset.nelyxHmr;
    while (!detached && !closeFailed) {
      const state = await getState();
      if (state) {
        if (!restartOnReconnect || state.session !== session) {
          receive(state, true);
          if (lifetime.reloading) return;
          try {
            await connect();
            if (lifetime.socket?.readyState === WebSocket.OPEN) {
              hello();
              return;
            }
          } catch {
            // The connection can disappear between the HTTP and WebSocket requests.
          }
          const latest = await getState();
          if (latest?.session === session) {
            await lifetime.restart('Vite WebSocket could not reconnect');
            return;
          }
        }
      }
      await new Promise((resolve) => setTimeout(resolve, 1_000));
    }
  };
  hot.on('nelyx:sync', (state) => receive(state));
  hot.on('nelyx:style', (revision) => {
    styles = revision;
  });
  hot.on('vite:ws:connect', ({ webSocket }) => hello(webSocket));
  const catchUp = async () => {
    if (document.visibilityState === 'visible') receive(await getState(), true);
  };
  document.addEventListener('visibilitychange', catchUp);
  window.addEventListener('pageshow', catchUp);
  window.addEventListener('online', catchUp);
  hello();
  void catchUp();
}
