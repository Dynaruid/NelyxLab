// SPDX-License-Identifier: BSD-3-Clause
import fs from 'node:fs';
import path from 'node:path';
import { isBuiltin } from 'node:module';
import { createHash } from 'node:crypto';
import { mergeConfig } from 'vite';
import { appFiles, inspectRunner, prepareRunnerFiles, readApp } from './runner.mjs';
import { mediaType } from './content.mjs';
import { createDevUpdates } from './dev-updates.mjs';

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
      build: {
        assetsDir: 'chunks',
        manifest: true,
        target: 'es2022',
        reportCompressedSize: false,
      },
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

export function frontendSession(initial, target, backend, { dev = false, onClosed } = {}) {
  let value = initial;
  let deployment = prepareRunnerFiles(value, target);
  let server;
  let fastRefresh = false;
  const { app } = value;
  const packageFile = path.join(app, 'package.json');
  const assetInputs = (config) =>
    new Set(
      [
        ...config.assets.flatMap(({ path: name, notice }) => [name, notice?.path].filter(Boolean)),
        ...(target === 'web' ? (config.targets.web?.pwa?.icons ?? []) : []).map(({ src }) => src),
      ].map((file) => path.resolve(app, file)),
    );
  const pwa = () => target === 'web' && !!value.config.targets.web?.pwa;
  let assets = assetInputs(value.config);
  let pendingAssets = assets;
  function invalidate(file, instance = server) {
    if (!instance) return;
    const graph = instance.environments.client.moduleGraph;
    if (file) graph.onFileChange(file.replaceAll('\\', '/'));
    else {
      const module = graph.getModuleById('\0' + backendId);
      if (module) graph.invalidateModule(module);
    }
  }
  const updates = dev
    ? createDevUpdates(app, value.roots.vite, {
        onClosed,
        invalidate,
        classify(file) {
          if (file === packageFile || assets.has(file) || pendingAssets.has(file)) return 'assets';
          if (file.endsWith('.css')) return 'vite';
          const name = path.relative(app, file).split(path.sep)[0];
          if (
            !within(app, file) ||
            ['node_modules', 'backend', 'platform', 'dist'].includes(name) ||
            name.startsWith('.') ||
            file === path.join(app, 'package-lock.json')
          )
            return 'ignore';
          if (file === path.resolve(app, value.config.appEntry)) return 'entry';
          if (fastRefresh && /\.[jt]sx$/.test(file)) return 'vite';
          return 'widget';
        },
        refresh() {
          pendingAssets = assetInputs(readApp(app).config);
          server.watcher.add([...pendingAssets]);
          const next = inspectRunner(app);
          if (!next.config.targets[target])
            throw Error('Declare targets.' + target + ' in package.json');
          const files = appFiles(next, true, target);
          return () => {
            value = next;
            deployment = files;
            assets = pendingAssets;
            invalidate();
          };
        },
      })
    : undefined;
  if (dev && target === 'tauri')
    updates.backend({
      state: 'pending',
      sourceId: backend.identity.sourceId,
      buildId: backend.developmentBuildId,
    });
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
          ', signal, ' +
          (JSON.stringify(backend.developmentBuildId) ?? 'undefined') +
          ');',
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
      if (id === backendId) return '\0' + id;
    },
    load(id) {
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
      instance.watcher.add([packageFile, path.join(app, 'src'), ...assets, ...pendingAssets]);
      const sdkWatchers = [];
      const pendingSdkFiles = new Set();
      let sdkReload;
      for (const [name, directory] of Object.entries(value.roots)) {
        if (!name.startsWith('@nelyx/')) continue;
        const dist = path.join(directory, 'dist');
        if (!fs.existsSync(dist)) continue;
        const watcher = fs.watch(dist, { recursive: true }, (_event, file) => {
          if (!file || !/\.(?:m?js|json)$/.test(file)) return;
          pendingSdkFiles.add(path.join(dist, file));
          clearTimeout(sdkReload);
          sdkReload = setTimeout(() => {
            for (const changed of pendingSdkFiles) invalidate(changed, instance);
            pendingSdkFiles.clear();
            updates.reload('Installed Nelyx SDK changed');
          }, 80);
        });
        watcher.on('error', (error) => instance.config.logger.error(String(error)));
        sdkWatchers.push(watcher);
      }
      instance.httpServer?.once('close', () => {
        clearTimeout(sdkReload);
        for (const watcher of sdkWatchers) watcher.close();
      });
      instance.middlewares.use((req, res, next) => {
        const request = new URL(req.url ?? '/', 'http://localhost');
        if (request.pathname === '/reload' && req.method === 'POST') {
          const origin = req.headers.origin;
          if (origin && new URL(origin).host !== req.headers.host) return res.writeHead(403).end();
          updates.reload('Manual reload requested');
          return res.writeHead(204).end();
        }
        const name = request.pathname.slice(1);
        if (
          !/^(?:runtime|assets|icons|licenses)\//.test(name) ||
          !['GET', 'HEAD'].includes(req.method)
        )
          return next();
        const bytes = deployment.files.get(name) ?? backend.files?.get(name);
        if (!bytes) return res.writeHead(404).end();
        res
          .writeHead(200, {
            'Content-Type': mediaType(name),
            'Content-Length': bytes.length,
            'Cache-Control': 'no-store',
          })
          .end(req.method === 'HEAD' ? undefined : bytes);
      });
    },
  };
  return {
    get deployment() {
      return deployment;
    },
    updateBackend(next, notify = true) {
      backend = next;
      invalidate();
      if (target === 'tauri')
        updates?.backend({
          state: 'pending',
          sourceId: next.identity.sourceId,
          buildId: next.developmentBuildId,
        });
      if (notify) updates?.reload('Web Wasm backend updated');
    },
    drain: updates?.drain,
    report: updates?.report,
    clearError: updates?.clearError,
    developmentStatus: updates?.status,
    backendStatus: updates?.backend,
    workerPlugins: () => [verifyModules(value, target)],
    plugins: [
      verifyModules(value, target),
      ...(updates ? [updates.plugin] : []),
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
                ? (updates?.html() ?? '')
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
