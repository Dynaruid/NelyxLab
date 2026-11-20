// SPDX-License-Identifier: BSD-3-Clause
import fs from 'node:fs';
import path from 'node:path';
import { isBuiltin } from 'node:module';
import { mergeConfig } from 'vite';
import { appFiles, appPath, inspectRunner, prepareRunnerFiles } from './runner.mjs';
import { mediaType } from './content.mjs';

const retired =
  /^(?:react-native(?:-web|-windows|-macos|-linux)?|@react-native\/[^/]+|metro(?:-[^/]+)?|@nelyx\/(?:metro|static-aot|skia-(?:rn|native)))(?:\/|$)|^@nelyx\/sdk\/(?:platforms\/(?!web\/)|backends\/(?:react-native|native-hermes)|runtime\/native-)/;
const inDirectory = (directory, file) => {
  const rel = path.relative(directory, file);
  return rel !== '..' && !rel.startsWith('..' + path.sep) && !path.isAbsolute(rel);
};
const devClient = 'virtual:nelyx-dev-client';

export function definePwaConfig(directory, overrides = {}) {
  const value = inspectRunner(path.resolve(directory, '../..'));
  const { app, runner, roots, config } = value;
  if (fs.realpathSync(directory) !== runner)
    throw new Error('Vite config must belong to web/runner');
  const files = prepareRunnerFiles(value);
  const appEntry = appPath(app, config.appEntry);
  const component = appPath(app, config.pwa.component);
  const generated = new Set(
    ['app-config.json', 'tsconfig.nelyx.json'].map((name) => path.join(runner, name)),
  );
  const packages = Object.keys(roots).filter((name) => name !== 'vite');
  return mergeConfig(
    {
      root: runner,
      base: './',
      publicDir: false,
      cacheDir: path.join(app, '.nelyx/vite'),
      resolve: {
        dedupe: packages,
        alias: [
          { find: /^virtual:nelyx-component$/, replacement: component },
          { find: /^virtual:nelyx-app$/, replacement: appEntry },
        ],
      },
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
      server: {
        strictPort: true,
        fs: {
          allow: [
            runner,
            path.join(app, 'src'),
            path.join(app, 'package.json'),
            appEntry,
            component,
            ...Object.values(roots),
          ],
        },
        watch: {
          ignored: (file) => {
            const absolute = path.resolve(file);
            return (
              generated.has(absolute) ||
              ['.nelyx', 'src-tauri'].some((name) => inDirectory(path.join(app, name), absolute))
            );
          },
        },
      },
      plugins: [
        {
          name: 'nelyx:pwa-modules',
          enforce: 'pre',
          async resolveId(specifier, importer, options) {
            if (specifier.startsWith('node:') || isBuiltin(specifier) || retired.test(specifier))
              this.error(
                `Browser build cannot import "${specifier}" from ${importer ?? 'entry'}. Use React DOM and @nelyx/sdk/platforms/web APIs.`,
              );
            const name = packages.find(
              (candidate) => specifier === candidate || specifier.startsWith(candidate + '/'),
            );
            if (!name) return;
            const result = await this.resolve(specifier, importer, { ...options, skipSelf: true });
            if (
              result &&
              !result.external &&
              path.isAbsolute(result.id) &&
              ![roots[name], path.join(app, '.nelyx/vite')].some((root) =>
                inDirectory(root, result.id),
              )
            ) {
              this.error(
                `"${specifier}" from ${importer} resolved outside the PWA runner: ${result.id}`,
              );
            }
            return result;
          },
          generateBundle(_options, bundle) {
            for (const output of Object.values(bundle)) {
              if (output.type !== 'chunk') continue;
              for (const id of Object.keys(output.modules)) {
                const name = id.replaceAll('\\', '/').split('/node_modules/').at(-1);
                if (retired.test(name) || id.includes('__vite-browser-external'))
                  this.error('Unsupported browser graph module: ' + id);
              }
            }
          },
        },
        pwaPlugin(value, files),
      ],
    },
    overrides,
  );
}

function pwaPlugin(value, initial) {
  let deployment = initial;
  let fastRefresh = false;
  let refreshError;
  const sdkWatchers = [];
  const pendingSdkFiles = new Set();
  let sdkReload;
  const { app, runner, config } = value;
  const assetInputs = new Set(
    config.assets.flatMap(({ path: name, notice }) =>
      [name, notice?.path].filter(Boolean).map((file) => path.resolve(app, file)),
    ),
  );
  for (const icon of config.pwa.icons ?? []) assetInputs.add(path.resolve(app, icon.src));
  const packageFile = path.join(app, 'package.json');
  return {
    name: 'nelyx:pwa',
    resolveId(id) {
      if (id === devClient) return '\0' + id;
    },
    load(id) {
      if (id === '\0' + devClient)
        return fs.readFileSync(new URL('./dev-client.mjs', import.meta.url), 'utf8');
    },
    configResolved(config) {
      fastRefresh = config.plugins.some(({ name }) => name === 'vite:react-refresh');
    },
    transformIndexHtml: {
      order: 'post',
      handler(html, { server }) {
        const open = /<head(?:\s[^>]*)?>/i;
        if (!open.test(html)) throw new Error('Nelyx PWA requires an HTML head element');
        const icon = deployment.icons.find(
          ({ sizes, purpose }) => sizes === '192x192' && purpose !== 'maskable',
        );
        const favicon = '<link rel="icon" type="image/png" href="' + icon.src + '">';
        return html.replace(
          open,
          '$&<!--nelyx-base-->' +
            favicon +
            (server
              ? '<script type="module" src="/@id/' + devClient + '"></script>'
              : '<link rel="manifest" href="./manifest.webmanifest">'),
        );
      },
    },
    configureServer(server) {
      const reload = () => server.ws.send('nelyx:reload', {});
      server.watcher.add([
        packageFile,
        path.join(app, 'src'),
        ...assetInputs,
        ...Object.values(value.roots).filter((file) => !inDirectory(runner, file)),
      ]);
      for (const [name, directory] of Object.entries(value.roots)) {
        if (!name.startsWith('@nelyx/') || !inDirectory(runner, directory)) continue;
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
          if (origin && new URL(origin).host !== req.headers.host) {
            res.writeHead(403).end();
            return;
          }
          reload();
          res.writeHead(204).end();
          return;
        }
        const name = request.pathname.slice(1);
        if (!/^(?:runtime|assets|icons|licenses)\//.test(name)) return next();
        if (!['GET', 'HEAD'].includes(req.method)) return next();
        const bytes = deployment.files.get(name);
        if (refreshError || !bytes) {
          res.writeHead(refreshError ? 503 : 404).end();
          return;
        }
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
        const absolute = path.resolve(file);
        if (/\.css(?:$|\?)/.test(file)) return;
        if (assetInputs.has(absolute) || absolute === packageFile) {
          try {
            deployment = appFiles(inspectRunner(app), true);
            refreshError = undefined;
          } catch (error) {
            refreshError = error;
            server.ws.send({ type: 'error', err: { message: error.message, stack: error.stack } });
            return [];
          }
        }
        if (
          fastRefresh &&
          /\.[jt]sx$/.test(file) &&
          inDirectory(app, absolute) &&
          !inDirectory(path.join(runner, 'node_modules'), absolute) &&
          absolute !== path.resolve(app, config.appEntry)
        )
          return;
        server.ws.send('nelyx:reload', {});
        return [];
      },
    },
  };
}
