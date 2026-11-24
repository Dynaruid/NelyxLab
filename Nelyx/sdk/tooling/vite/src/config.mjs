// SPDX-License-Identifier: BSD-3-Clause
import fs from 'node:fs';
import path from 'node:path';
import { isBuiltin } from 'node:module';
import { createHash } from 'node:crypto';
import { mergeConfig } from 'vite';
import { appFiles, inspectRunner, prepareRunnerFiles } from './runner.mjs';
import { mediaType } from './content.mjs';

const retired =
  /^(?:react-native(?:-web|-windows|-macos|-linux)?|@react-native\/[^/]+|metro(?:-[^/]+)?|@nelyx\/(?:metro|static-aot|skia-(?:rn|native)))(?:\/|$)/;
const native =
  /(?:^|\/)@tauri-apps\/|@nelyx\/sdk\/backends\/tauri(?:$|[./?])|\/backends\/tauri\.[jt]s(?:\?|$)/;
const nativeGlobal = /\b(?:__TAURI__|__TAURI_INTERNALS__)\b|\b(?:window|globalThis)\.isTauri\b/;
const within = (directory, file) => {
  const relative = path.relative(directory, file);
  return relative !== '..' && !relative.startsWith('..' + path.sep) && !path.isAbsolute(relative);
};
const backendId = 'virtual:nelyx-backend';
const devClient = 'virtual:nelyx-dev-client';

export const crossOriginIsolationHeaders = Object.freeze({
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Embedder-Policy': 'require-corp',
});

export function defineAppConfig(directory, overrides = {}) {
  const value = inspectRunner(directory);
  const { app, roots } = value;
  const packages = Object.keys(roots).filter((name) => name !== 'vite');
  return mergeConfig(
    {
      root: app,
      base: './',
      publicDir: false,
      cacheDir: path.join(app, '.nelyx/vite'),
      resolve: { dedupe: packages },
      optimizeDeps: {
        include: [
          'react',
          'react/jsx-runtime',
          'react/jsx-dev-runtime',
          'react-dom',
          'react-dom/client',
        ],
        exclude: packages.filter((name) => name.startsWith('@nelyx/')),
      },
      build: { assetsDir: 'chunks', manifest: true, target: 'es2022' },
      worker: { format: 'es' },
      server: {
        strictPort: true,
        fs: { allow: [app, ...Object.values(roots)] },
        watch: {
          ignored: (file) =>
            ['.nelyx', 'backend', 'platform'].some((name) =>
              within(path.join(app, name), path.resolve(file)),
            ),
        },
      },
    },
    overrides,
  );
}

function verifyModules(value, target) {
  const { app, roots } = value;
  const packages = Object.keys(roots).filter((name) => name !== 'vite');
  return {
    name: 'nelyx:modules',
    enforce: 'pre',
    async resolveId(specifier, importer, options) {
      if (specifier.startsWith('node:') || isBuiltin(specifier) || retired.test(specifier))
        this.error('Unsupported DOM import "' + specifier + '" from ' + (importer ?? 'entry'));
      if (target === 'web' && native.test(specifier))
        this.error('Web target cannot import "' + specifier + '" from ' + (importer ?? 'entry'));
      const name = packages.find(
        (candidate) => specifier === candidate || specifier.startsWith(candidate + '/'),
      );
      if (!name) return;
      const result = await this.resolve(specifier, importer, { ...options, skipSelf: true });
      if (
        result &&
        !result.external &&
        path.isAbsolute(result.id) &&
        ![roots[name], path.join(app, '.nelyx/vite')].some((root) => within(root, result.id))
      )
        this.error('"' + specifier + '" resolved outside the app installation: ' + result.id);
      return result;
    },
    generateBundle(_options, bundle) {
      for (const item of Object.values(bundle)) {
        if (item.type !== 'chunk') continue;
        for (const id of Object.keys(item.modules)) {
          const file = id.replaceAll('\\', '/');
          const name = file.split('/node_modules/').at(-1);
          if (
            retired.test(name) ||
            id.includes('__vite-browser-external') ||
            (target === 'web' && native.test(file))
          )
            this.error('Unsupported ' + target + ' graph module: ' + id);
        }
        if (target === 'web' && nativeGlobal.test(item.code))
          this.error('Web bundle contains a Tauri global');
      }
    },
  };
}

export function frontendSession(initial, target, backend, { dev = false } = {}) {
  let value = initial;
  let deployment = prepareRunnerFiles(value, target);
  let server;
  let fastRefresh = false;
  let refreshError;
  const sdkWatchers = [];
  const pendingSdkFiles = new Set();
  let sdkReload;
  const { app } = value;
  const packageFile = path.join(app, 'package.json');
  const assetInputs = () =>
    new Set(
      [
        ...value.config.assets.flatMap(({ path: name, notice }) =>
          [name, notice?.path].filter(Boolean),
        ),
        ...(target === 'web' ? (value.config.targets.web?.pwa?.icons ?? []) : []).map(
          ({ src }) => src,
        ),
      ].map((file) => path.resolve(app, file)),
    );
  const pwa = () => target === 'web' && !!value.config.targets.web?.pwa;
  const reload = () => server?.ws.send('nelyx:reload', {});
  function invalidate() {
    if (!server) return;
    const module = server.moduleGraph.getModuleById('\0' + backendId);
    if (module) server.moduleGraph.invalidateModule(module);
  }
  function moduleSource() {
    const { config, version } = value;
    const frontend = JSON.stringify({
      target,
      name: config.name,
      displayName: config.displayName ?? config.name,
      appVersion: version,
      pwa: pwa(),
      assets: deployment.metadata.assets,
    });
    const expected = JSON.stringify(backend.identity);
    if (target === 'tauri')
      return [
        'import { openTauriBackend } from "@nelyx/sdk/backends/tauri";',
        'export const frontend = ' + frontend + ';',
        'export const openBackend = (root, signal) => openTauriBackend(root, ' +
          expected +
          ', ' +
          !dev +
          ', signal);',
      ].join('\n');
    const hash = createHash('sha256')
      .update(backend.files.get('runtime/backend/backend_bg.wasm'))
      .digest('hex');
    return [
      'import { openWasmBackend } from "@nelyx/sdk/backends/web-wasm";',
      'export const frontend = ' + frontend + ';',
      'export const openBackend = (root, signal) => openWasmBackend(root, ' +
        expected +
        ', ' +
        JSON.stringify(hash) +
        ', signal);',
    ].join('\n');
  }
  const plugin = {
    name: 'nelyx:frontend',
    resolveId(id) {
      if (id === devClient || id === backendId) return '\0' + id;
    },
    load(id) {
      if (id === '\0' + devClient)
        return fs.readFileSync(new URL('./dev-client.mjs', import.meta.url), 'utf8');
      if (id === '\0' + backendId) return moduleSource();
    },
    configResolved(config) {
      fastRefresh = config.plugins.some(({ name }) => name === 'vite:react-refresh');
    },
    transformIndexHtml: {
      order: 'pre',
      handler(html) {
        const marker = /<script\b[^>]*\bdata-nelyx-entry\b[^>]*>\s*<\/script>/i;
        const entry = '/' + value.config.appEntry.slice(2);
        if (marker.test(html))
          return html.replace(marker, '<script type="module" src="' + entry + '"></script>');
        if (!html.includes('src="' + entry + '"') && !html.includes("src='" + entry + "'"))
          throw new Error('index.html must load the appEntry module: ' + entry);
        return html;
      },
    },
    configureServer(instance) {
      server = instance;
      server.watcher.add([packageFile, path.join(app, 'src'), ...assetInputs()]);
      for (const [name, directory] of Object.entries(value.roots)) {
        if (!name.startsWith('@nelyx/')) continue;
        const dist = path.join(directory, 'dist');
        if (!fs.existsSync(dist)) continue;
        const watcher = fs.watch(dist, { recursive: true }, (_event, file) => {
          if (!file || !/\.(?:m?js|json)$/.test(file)) return;
          pendingSdkFiles.add(path.join(dist, file));
          clearTimeout(sdkReload);
          sdkReload = setTimeout(() => {
            for (const changed of pendingSdkFiles)
              server.moduleGraph.onFileChange(changed.replaceAll('\\', '/'));
            pendingSdkFiles.clear();
            reload();
          }, 80);
        });
        watcher.on('error', (error) => server.config.logger.error(String(error)));
        sdkWatchers.push(watcher);
      }
      server.middlewares.use((req, res, next) => {
        const request = new URL(req.url ?? '/', 'http://localhost');
        if (request.pathname === '/reload' && req.method === 'POST') {
          const origin = req.headers.origin;
          if (origin && new URL(origin).host !== req.headers.host) return res.writeHead(403).end();
          reload();
          return res.writeHead(204).end();
        }
        const name = request.pathname.slice(1);
        if (
          !/^(?:runtime|assets|icons|licenses)\//.test(name) ||
          !['GET', 'HEAD'].includes(req.method)
        )
          return next();
        const bytes = deployment.files.get(name) ?? backend.files?.get(name);
        if (refreshError || !bytes) return res.writeHead(refreshError ? 503 : 404).end();
        res
          .writeHead(200, {
            'Content-Type': mediaType(name),
            'Content-Length': bytes.length,
            'Cache-Control': 'no-store',
          })
          .end(req.method === 'HEAD' ? undefined : bytes);
      });
    },
    closeBundle() {
      clearTimeout(sdkReload);
      for (const watcher of sdkWatchers) watcher.close();
    },
    hotUpdate: {
      order: 'post',
      handler({ file, server }) {
        if (this.environment.name !== 'client') return;
        if (/\.css(?:$|\?)/.test(file)) return;
        const absolute = path.resolve(file);
        if (assetInputs().has(absolute) || absolute === packageFile) {
          try {
            value = inspectRunner(app);
            deployment = appFiles(value, true, target);
            server.watcher.add([...assetInputs()]);
            refreshError = undefined;
            invalidate();
          } catch (error) {
            refreshError = error;
            server.ws.send({ type: 'error', err: { message: error.message, stack: error.stack } });
            return [];
          }
        }
        if (
          fastRefresh &&
          /\.[jt]sx$/.test(file) &&
          within(app, absolute) &&
          !within(path.join(app, 'node_modules'), absolute) &&
          absolute !== path.resolve(app, value.config.appEntry)
        )
          return;
        reload();
        return [];
      },
    },
  };
  return {
    get deployment() {
      return deployment;
    },
    updateBackend(next, notify = true) {
      backend = next;
      invalidate();
      if (notify) reload();
    },
    workerPlugins: () => [verifyModules(value, target)],
    plugins: [
      verifyModules(value, target),
      plugin,
      {
        name: 'nelyx:html',
        transformIndexHtml: {
          order: 'post',
          handler(html, { server }) {
            const head = /<head(?:\s[^>]*)?>/i;
            if (!head.test(html)) throw new Error('Nelyx requires an HTML head element');
            const icon = deployment.icons.find(
              ({ sizes, purpose }) => sizes === '192x192' && purpose !== 'maskable',
            );
            const extra =
              (icon ? '<link rel="icon" type="image/png" href="' + icon.src + '">' : '') +
              (server
                ? '<script type="module" src="/@id/' + devClient + '"></script>'
                : pwa()
                  ? '<link rel="manifest" href="./manifest.webmanifest">'
                  : '');
            return html.replace(head, '$&<!--nelyx-base-->' + extra);
          },
        },
      },
    ],
  };
}
