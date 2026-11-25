// SPDX-License-Identifier: BSD-3-Clause
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { transformWithOxc } from 'vite';
import {
  inspectWidgetModule,
  instrumentWidgetModule,
  widgetRuntimeId,
  widgetUpdateId,
  widgetUpdateModule,
} from './widget-reload.mjs';

const fileSource = (name) => fs.readFileSync(new URL(name, import.meta.url), 'utf8');
const normalPath = (file) => file.replaceAll('\\', '/');
const viteClientLifecycle = "globalThis[Symbol.for('nelyx.frontend.reload')]";
export const devClientId = 'virtual:nelyx-dev-client';

// Vite 8.3.8 reloads directly in the transport and in two client HMR paths.
// Route those calls through the same owner drain as server-requested restarts.
function controlViteClient(source) {
  function replace(before, after) {
    if (source.split(before).length !== 2)
      throw Error('The pinned Vite client no longer has the expected Nelyx restart hook');
    source = source.replace(before, after);
  }
  replace(
    'await waitForSuccessfulPing(url.href);',
    `const recover = ${viteClientLifecycle}?.recoverSocket;
          if (recover) {
            await recover(() => transport.connect(createHMRHandler(handleMessage)));
            break;
          }
          await waitForSuccessfulPing(url.href);`,
  );
  replace(
    'onDisconnection();\n\t\t\t\t});',
    'if (ws === socket) clearInterval(pingIntervalId);\n\t\t\t\t\tonDisconnection();\n\t\t\t\t});',
  );
  replace(
    'onMessage({\n\t\t\t\ttype: "custom",\n\t\t\t\tevent: "vite:ws:connect",',
    `(${viteClientLifecycle} ??= {}).socket = socket;
      onMessage({
        type: "custom",
        event: "vite:ws:connect",`,
  );
  replace(
    'await connectingPromise;\n\t\t\t\tconnectingPromise = void 0;',
    'try { await connectingPromise; } finally { connectingPromise = void 0; }',
  );
  replace(
    'timer = setTimeout(() => {\n\t\t\tlocation.reload();',
    `timer = setTimeout(() => {
      const restart = ${viteClientLifecycle}?.restart;
      if (restart) restart('Vite module graph changed');
      else location.reload();`,
  );
  // Suppress the special first-update reload when the development client owns the page.
  replace(
    'isFirstUpdate && hasErrorOverlay()',
    `isFirstUpdate && hasErrorOverlay() && !${viteClientLifecycle}?.restart`,
  );
  return source;
}

export function createDevUpdates(app, viteRoot, { classify, refresh, invalidate, onClosed }) {
  const clientPath = normalPath(path.join(viteRoot, 'dist/client/client.mjs'));
  let active;
  let nativeStatus;
  const widgetFile = (file) => /(?<!\.d)\.ts$/.test(file) && classify(file) === 'widget';
  const send = (state, event, data) => state.send({ type: 'custom', event, data });
  const snapshot = (state) => ({
    session: state.session,
    sequence: state.sequence,
    restart: state.restart,
    style: state.style,
    reason: state.reason,
    patch: state.patch?.url,
    error: state.uiError ?? state.backendError,
    backend: nativeStatus,
  });
  function report(state, message, kind) {
    state[kind] = { message };
    state.instance.config.logger.error(message);
    send(state, 'nelyx:sync', snapshot(state));
  }

  function schedule(state) {
    clearTimeout(state.timer);
    state.timer = setTimeout(() => {
      if (!state.processing) void flush(state);
    }, 75);
  }

  async function flush(state) {
    state.processing = true;
    const files = new Map([...state.rejected, ...state.changed]);
    try {
      const reasons = new Set(state.reasons);
      state.changed.clear();
      state.reasons.clear();
      const modules = new Map(state.modules);
      const updates = new Map(state.updates);
      const refreshInputs = [...files.keys()].some((file) => classify(file) === 'assets');
      const nextDeployment = refreshInputs ? refresh() : undefined;
      for (const [file, type] of files) {
        const label = normalPath(path.relative(app, file));
        if (!widgetFile(file) || type !== 'update') {
          reasons.add(`${label} (${type})`);
          modules.delete(file);
          updates.delete(label);
          continue;
        }
        const previous = modules.get(file);
        const text = fs.readFileSync(file, 'utf8');
        if (text === previous?.text) continue;
        const analysis = inspectWidgetModule(file, text);
        await transformWithOxc(text, file, { lang: 'ts' });
        const sameShape = previous?.shape === analysis.shape && previous.methods.size > 0;
        const hasBindings =
          sameShape &&
          [...analysis.methods.values()].every(({ reads }) =>
            [...reads].every((name) => previous.bindings.has(name)),
          );
        if (!hasBindings) {
          reasons.add(label + ' (change outside supported build bodies)');
          modules.delete(file);
          updates.delete(label);
          continue;
        }
        modules.set(file, { ...analysis, text, bindings: previous.bindings });
        if (
          [...analysis.methods].some(
            ([name, method]) => method.body !== previous.methods.get(name)?.body,
          )
        )
          updates.set(label, analysis);
      }
      const changed =
        reasons.size > 0 || [...updates].some(([key, value]) => value !== state.updates.get(key));
      if (state.closed) return;
      if (state.changed.size || state.reasons.size) {
        // Files touched during validation belong to the next stable snapshot.
        for (const [file, type] of files)
          if (!state.changed.has(file)) state.changed.set(file, type);
        for (const reason of reasons) state.reasons.add(reason);
        return;
      }
      if (changed && !reasons.size) {
        const id = widgetUpdateId + state.session + '/' + (state.sequence + 1) + '.mjs';
        const url = '/@id/' + id;
        // Vite's normal Oxc filter excludes virtual IDs. Compile the detached
        // TypeScript bodies explicitly before the virtual JS module is served.
        const { code } = await transformWithOxc(
          widgetUpdateModule(updates),
          path.join(app, '.nelyx', 'widget-update.ts'),
          { lang: 'ts' },
        );
        const candidate = { id, url, code };
        state.candidate = candidate;
        try {
          if (!(await state.instance.transformRequest(id)))
            throw Error('Vite could not prepare the changed widget implementations');
        } catch (error) {
          forgetPatch(state, candidate);
          throw error;
        } finally {
          state.candidate = undefined;
        }
        if (state.closed) return;
        if (state.changed.size || state.reasons.size) {
          forgetPatch(state, candidate);
          for (const [file, type] of files)
            if (!state.changed.has(file)) state.changed.set(file, type);
          return;
        }
        // Bound retained Vite modules to the most recent complete update.
        forgetPatch(state);
        state.patch = candidate;
        state.updates = updates;
      }
      state.modules = modules;
      state.rejected.clear();
      if (nextDeployment) nextDeployment();
      if (changed) {
        state.sequence++;
        state.reason = reasons.size ? [...reasons].join(', ') : 'widget build bodies updated';
        if (reasons.size) {
          state.restart = state.sequence;
          forgetPatch(state);
          state.patch = undefined;
          state.updates.clear();
          // Active documents now join the new graph. No old transform may be
          // reused as a new document's lexical environment.
          for (const file of files.keys()) invalidate(file, state.instance);
        }
        state.instance.config.logger.info('[nelyx] ' + state.reason);
      }
      if (changed || state.uiError) {
        state.uiError = undefined;
        send(state, 'nelyx:sync', snapshot(state));
      }
    } catch (error) {
      if (!state.closed) {
        state.rejected = files;
        report(state, error.message, 'uiError');
      }
    } finally {
      state.processing = false;
      if (!state.closed && (state.changed.size || state.reasons.size)) schedule(state);
    }
  }

  function forgetPatch(state, patch = state.patch) {
    // Vite's invalidateModule leaves the node in the graph. Remove the file
    // record too, so successive edits do not retain old generated modules.
    const graph = state.instance.environments.client.moduleGraph;
    if (!patch) return;
    const id = '\0' + patch.id;
    const mod = graph.getModuleById(id);
    if (!mod) return;
    graph.invalidateModule(mod);
    graph.idToModuleMap.delete(id);
    graph.urlToModuleMap.delete(mod.url);
    for (const url of graph._unresolvedUrlToModuleMap.keys())
      if (url.includes(patch.id)) graph._unresolvedUrlToModuleMap.delete(url);
    graph.fileToModulesMap.get(mod.file)?.delete(mod);
    if (!graph.fileToModulesMap.get(mod.file)?.size) graph.fileToModulesMap.delete(mod.file);
  }

  const plugin = {
    name: 'nelyx:dev-updates',
    enforce: 'pre',
    resolveId(id) {
      if (id === devClientId || id === widgetRuntimeId || id.startsWith(widgetUpdateId))
        return '\0' + id;
    },
    load(id) {
      if (id === '\0' + devClientId) return fileSource('./dev-client.mjs');
      if (id === '\0' + widgetRuntimeId) return fileSource('./widget-runtime.mjs');
      const patch = active?.candidate?.id === id.slice(1) ? active.candidate : active?.patch;
      if (patch && id === '\0' + patch.id) return patch.code;
    },
    transform(code, id) {
      if (this.environment.name !== 'client') return;
      if (normalPath(id) === clientPath) return controlViteClient(code);
      if (!active || !path.isAbsolute(id) || !widgetFile(path.resolve(id))) return;
      const file = path.resolve(id);
      const expected = active.modules.get(file);
      const analysis = expected?.text === code ? expected : inspectWidgetModule(file, code);
      const bindings = expected?.shape === analysis.shape ? expected.bindings : analysis.bindings;
      if (!expected) active.modules.set(file, { ...analysis, text: code });
      return instrumentWidgetModule(code, normalPath(path.relative(app, file)), analysis, bindings);
    },
    configureServer(instance) {
      const transport = instance.ws;
      const state = {
        instance,
        session: randomUUID(),
        sequence: 0,
        style: 0,
        restart: 0,
        modules: new Map(),
        updates: new Map(),
        changed: new Map(),
        rejected: new Map(),
        reasons: new Set(),
        clients: new Set(),
        send: transport.send.bind(transport),
      };
      active = state;
      transport.send = (payload, data) => {
        if (payload?.type === 'full-reload') {
          state.reasons.add(
            payload.path && payload.path !== '*' ? payload.path : 'Vite module graph changed',
          );
          schedule(state);
          return;
        }
        state.send(payload, data);
        if (payload?.type === 'update') send(state, 'nelyx:style', ++state.style);
      };
      instance.middlewares.use((req, res, next) => {
        if (req.method !== 'GET' || req.url !== '/__nelyx/update') return next();
        res
          .writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' })
          .end(JSON.stringify(snapshot(state)));
      });
      transport.on('nelyx:hello', (data, client) => {
        if (!state.clients.has(client) && typeof data?.socket === 'string') {
          state.clients.add(client);
          client.socket?.once('close', () => state.clients.delete(client));
          instance.config.logger.info(
            JSON.stringify({
              event: 'nelyx.dev.connected',
              session: state.session,
              socket: data.socket.slice(0, 512),
            }),
          );
        }
        client.send('nelyx:sync', snapshot(state));
      });
      transport.on('nelyx:drained', (data, client) => state.acknowledge?.(data, client));
      transport.on('nelyx:client-error', (data) => {
        if (typeof data?.message === 'string') instance.config.logger.error(data.message);
      });
      transport.on('nelyx:backend-ready', (data, client) => {
        if (
          !state.clients.has(client) ||
          nativeStatus?.state !== 'pending' ||
          data?.sourceId !== nativeStatus.sourceId ||
          data?.buildId !== nativeStatus.buildId
        )
          return;
        nativeStatus = { ...nativeStatus, state: 'ready' };
        instance.config.logger.info(
          JSON.stringify({ event: 'nelyx.dev.backend.ready', ...nativeStatus }),
        );
        send(state, 'nelyx:sync', snapshot(state));
      });
      if (typeof instance._closeServer !== 'function')
        throw Error('The pinned Vite server no longer exposes its pre-restart close hook');
      const close = instance._closeServer.bind(instance);
      instance._closeServer = async (reason) => {
        // Vite only calls this after the replacement configuration has loaded.
        if (reason === 'restart') await drain(state, 'Vite configuration changed');
        state.closed = true;
        clearTimeout(state.timer);
        return close(reason);
      };
    },
    closeServer({ reason }) {
      if (reason !== 'restart') onClosed?.();
    },
    hotUpdate: {
      order: 'post',
      handler({ file, type }) {
        if (this.environment.name !== 'client' || !active || active.closed) return;
        const absolute = path.resolve(file);
        const disposition = classify(absolute);
        if (disposition === 'ignore') return [];
        if (disposition === 'vite') return;
        active.changed.set(absolute, type);
        schedule(active);
        return [];
      },
    },
  };
  async function drain(state, reason) {
    const waiting = new Set(
      [...state.instance.ws.clients].filter((client) => state.clients.has(client)),
    );
    if (!waiting.size) return;
    const token = randomUUID();
    let timeout;
    try {
      await new Promise((resolve) => {
        timeout = setTimeout(() => {
          state.instance.config.logger.warn(
            '[nelyx] Owner shutdown confirmation timed out (' + reason + ')',
          );
          resolve();
        }, 2_000);
        state.acknowledge = (data, client) => {
          if (data?.token !== token) return;
          waiting.delete(client);
          if (!waiting.size) resolve();
        };
        for (const client of waiting) client.send('nelyx:prepare-restart', { token, reason });
      });
    } finally {
      clearTimeout(timeout);
      state.acknowledge = undefined;
    }
  }
  return {
    plugin,
    html() {
      if (!active) return '';
      const { session, sequence, style } = snapshot(active);
      return (
        `<meta name="nelyx-dev-state" content="${session}:${sequence}:${style}">` +
        `<script type="module" src="/@id/${devClientId}"></script>`
      );
    },
    reload(reason) {
      if (!active || active.closed) return;
      active.reasons.add(reason);
      schedule(active);
    },
    report(error) {
      if (active && !active.closed) report(active, error.message, 'backendError');
    },
    clearError() {
      if (!active?.backendError || active.closed) return;
      active.backendError = undefined;
      send(active, 'nelyx:sync', snapshot(active));
    },
    status() {
      if (!active) return;
      return {
        session: active.session,
        connected: [...active.instance.ws.clients].filter((client) => active.clients.has(client))
          .length,
        backend: nativeStatus,
      };
    },
    backend(status) {
      nativeStatus = status;
      if (active && !active.closed) send(active, 'nelyx:sync', snapshot(active));
    },
    drain: (reason) => (active && !active.closed ? drain(active, reason) : undefined),
  };
}
