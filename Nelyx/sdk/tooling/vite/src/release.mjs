// SPDX-License-Identifier: BSD-3-Clause
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import {
  backendFiles,
  backendHash,
  backendProtocol,
} from '@nelyx/tooling-contracts/backend-supply';
import { createProviderRegistry } from '@nelyx/sdk/runtime/providers';
import {
  fileTree,
  localFile,
  relativeFile,
  sha256,
  verifyInventory,
} from '@nelyx/tooling-contracts/node-files';
import { inspectRunner, profile, readJson, renderer, writeJson } from './runner.mjs';
import { serviceWorker } from './service-worker.mjs';
import { frontendSession } from './config.mjs';

const schema = 'nelyx.frontend-build/v1';
const buildFile = 'build.json';
const rendererWorkerPath = /^chunks\/nelyx-render-worker-[\w-]+\.js$/;
const profileValues = {
  schema,
  provider: 'web',
  renderer,
  profile,
  gpuBackend: 'webgl2',
};
const required = [
  'index.html',
  'runtime/native-manifest.json',
  'runtime/canvaskit.js',
  'runtime/canvaskit.wasm',
  'licenses/canvaskit-BSD-3-Clause.txt',
];
const hash = (text) => createHash('sha256').update(text).digest('hex');
function identity(data) {
  const {
    target,
    format,
    appId,
    name,
    version,
    appEntry,
    entry,
    sdkVersion,
    rendererWorker,
    canvasKit,
    backend,
    toolchain,
    files,
  } = data;
  return {
    ...profileValues,
    target,
    format,
    appId,
    name,
    version,
    appEntry,
    entry,
    sdkVersion,
    ...(rendererWorker ? { rendererWorker } : {}),
    canvasKit,
    backend,
    ...(toolchain ? { toolchain } : {}),
    files,
  };
}

function rendererIdentity(runtime) {
  return {
    wireAbi: createProviderRegistry().profile('web', profile).wireAbi,
    version: runtime.version,
    files: Object.fromEntries(runtime.files.map(({ id, sha256 }) => [id, sha256])),
  };
}

function inventory(directory) {
  return fileTree(directory).map((name) => {
    const file = localFile(directory, name);
    return { path: name, bytes: fs.statSync(file).size, sha256: sha256(file) };
  });
}

function verifyReleaseEntries(output, manifest) {
  const visited = new Set();
  function visit(key) {
    if (visited.has(key)) return;
    visited.add(key);
    const chunk = manifest[key];
    if (!chunk?.file?.startsWith('chunks/')) throw new Error('Missing Vite chunk: ' + key);
    for (const name of [chunk.file, ...(chunk.css ?? []), ...(chunk.assets ?? [])]) {
      if (!fs.statSync(localFile(output, name)).isFile())
        throw new Error('Missing Vite output ' + name);
    }
    for (const child of [...(chunk.imports ?? []), ...(chunk.dynamicImports ?? [])]) visit(child);
  }
  for (const key of Object.keys(manifest)) visit(key);
  if (!manifest['index.html']?.isEntry)
    throw new Error('Vite requires the index.html module entry');
  return manifest['index.html'].file;
}

function writeAsset(directory, file, bytes) {
  const name = path.join(directory, relativeFile(file));
  fs.mkdirSync(path.dirname(name), { recursive: true });
  fs.writeFileSync(name, bytes, { flag: 'wx' });
}

function writeLicenses(directory, value, modules) {
  const roots = new Set([
    value.roots['@nelyx/core'],
    value.roots['@nelyx/sdk'],
    value.roots['@nelyx/skia-web'],
  ]);
  for (const id of modules) {
    const file = id.split('?')[0].replaceAll('\\', '/');
    const split = file.lastIndexOf('/node_modules/');
    if (split === -1 || !path.isAbsolute(file)) continue;
    const parts = file.slice(split + '/node_modules/'.length).split('/');
    const name = parts.slice(0, parts[0].startsWith('@') ? 2 : 1).join('/');
    const root = path.resolve(file.slice(0, split), 'node_modules', name);
    if (fs.existsSync(path.join(root, 'package.json'))) roots.add(root);
  }
  for (const root of roots) {
    const { name, version } = readJson(path.join(root, 'package.json'));
    const prefix = 'licenses/' + name.replace(/^@/, '').replace('/', '-') + '-' + version + '/';
    const top = fs
      .readdirSync(root, { withFileTypes: true })
      .filter(
        (entry) => entry.isFile() && /^(?:licen[sc]e|notice|copying)(?:[._-]|$)/i.test(entry.name),
      );
    if (!top.length) throw new Error('Missing license for bundled package ' + name);
    for (const { name: file } of top) {
      const destination = prefix + file;
      if (fs.existsSync(path.join(directory, destination))) continue;
      writeAsset(directory, destination, fs.readFileSync(localFile(root, file)));
    }
    const notices = path.join(root, 'licenses');
    if (fs.existsSync(notices)) {
      for (const file of fileTree(notices)) {
        const destination = prefix + file;
        if (fs.existsSync(path.join(directory, destination))) continue;
        writeAsset(directory, destination, fs.readFileSync(localFile(notices, file)));
      }
    }
  }
}

/** Build into a disposable directory. The CLI owns the publication lock and promotion. */
export async function buildFrontend(app, output, target, project, backend) {
  const value = inspectRunner(app);
  const { config, version, runner, name } = value;
  const pwa = target === 'web' ? config.targets.web?.pwa : undefined;
  const session = frontendSession(value, target, project);
  const { files, icons } = session.deployment;
  const { build } = await value.vite();
  const modules = new Set();
  const sdkBrowser = path
    .join(value.roots['@nelyx/sdk'], 'dist', 'backends', 'browser')
    .replaceAll('\\', '/');
  const sdkModule = (id, name) =>
    id?.split('?')[0].replaceAll('\\', '/') === sdkBrowser + '/' + name;
  const collectLicenses = () => ({
    name: 'nelyx:release-licenses',
    generateBundle(_options, bundle) {
      for (const item of Object.values(bundle)) {
        if (item.type === 'chunk') for (const id of Object.keys(item.modules)) modules.add(id);
      }
    },
  });
  await build({
    root: runner,
    configFile: path.join(runner, 'vite.config.ts'),
    base: './',
    publicDir: false,
    build: {
      outDir: output,
      emptyOutDir: false,
      assetsDir: 'chunks',
      manifest: true,
      sourcemap: false,
    },
    plugins: [...session.plugins, collectLicenses()],
    worker: {
      format: 'es',
      plugins: () => [...session.workerPlugins(), collectLicenses()],
      rolldownOptions: {
        output: {
          entryFileNames({ facadeModuleId }) {
            return sdkModule(facadeModuleId, 'renderer-worker.js')
              ? 'chunks/nelyx-render-worker-[hash].js'
              : 'chunks/[name]-[hash].js';
          },
        },
      },
    },
  });
  const viteManifest = path.join(output, '.vite/manifest.json');
  const entry = verifyReleaseEntries(output, readJson(viteManifest));
  fs.unlinkSync(viteManifest);
  fs.rmdirSync(path.dirname(viteManifest));
  const workers = fileTree(output).filter((name) => rendererWorkerPath.test(name));
  const usesWebRenderer = [...modules].some(
    (id) => sdkModule(id, 'render-worker-port.js'),
  );
  if (workers.length !== (usesWebRenderer ? 1 : 0))
    throw new Error('Nelyx render worker does not match the application module graph');
  for (const source of [files, project.files ?? []])
    for (const [name, bytes] of source) writeAsset(output, name, bytes);
  writeLicenses(output, value, modules);
  if (pwa) {
    writeJson(path.join(output, 'manifest.webmanifest'), {
      id: pwa.id,
      start_url: './',
      scope: './',
      display: 'standalone',
      name: config.displayName ?? config.name,
      short_name: pwa.shortName,
      theme_color: pwa.themeColor,
      background_color: pwa.themeColor,
      icons,
    });
    writeAsset(output, 'sw.js', serviceWorker(pwa.id, inventory(output)));
  }
  const data = identity({
    target,
    format: pwa ? 'pwa' : target,
    appId: name,
    name: config.name,
    version,
    appEntry: config.appEntry,
    entry,
    sdkVersion: readJson(path.join(value.roots['@nelyx/sdk'], 'package.json')).version,
    rendererWorker: workers[0],
    canvasKit: rendererIdentity(value.runtime.manifest),
    backend,
    toolchain: project.toolchain,
    files: inventory(output),
  });
  writeJson(path.join(output, buildFile), { ...data, buildId: hash(JSON.stringify(data)) });
  return verifyFrontend(output, value, target, backend);
}

function checkInstallManifest(directory, data, pwa) {
  const manifest = readJson(localFile(directory, 'manifest.webmanifest'));
  if (
    manifest.id !== pwa.id ||
    manifest.display !== 'standalone' ||
    manifest.start_url !== './' ||
    manifest.scope !== './' ||
    !Array.isArray(manifest.icons)
  ) {
    throw new Error('Invalid PWA installation manifest');
  }
  for (const size of ['192x192', '512x512']) {
    if (
      !manifest.icons.some(
        (icon) =>
          icon.sizes === size &&
          icon.type === 'image/png' &&
          icon.src.startsWith('./icons/') &&
          data.files.some((file) => file.path === icon.src.slice(2)),
      )
    ) {
      throw new Error('Missing PWA installation icon ' + size);
    }
  }
}

export function verifyFrontend(
  directory,
  { config, name, version, roots, runtime: expectedRuntime },
  target,
  backend,
) {
  directory = path.resolve(directory);
  if (!fs.existsSync(directory))
    throw new Error(
      'Frontend input missing at ' + directory + '. Run nelyx build --target ' + target + ' first.',
    );
  if (
    path.relative(directory, fs.realpathSync(directory)) ||
    !fs.lstatSync(directory).isDirectory()
  )
    throw new Error('Frontend input must be an ordinary directory: ' + directory);
  const data = readJson(localFile(directory, buildFile));
  const pwa = target === 'web' ? config.targets.web?.pwa : undefined;
  const sdk = roots && readJson(path.join(roots['@nelyx/sdk'], 'package.json'));
  if (
    Object.entries(profileValues).some(([key, expected]) => data[key] !== expected) ||
    data.target !== target ||
    data.format !== (pwa ? 'pwa' : target) ||
    data.appId !== name ||
    data.name !== config.name ||
    data.version !== version ||
    data.appEntry !== config.appEntry ||
    typeof data.sdkVersion !== 'string' ||
    (sdk && data.sdkVersion !== sdk.version)
  )
    throw new Error('Frontend input belongs to another app, version, target or SDK');
  if (
    data.backend?.kind !== (target === 'web' ? 'wasm' : 'native') ||
    data.backend.protocolVersion !== backendProtocol ||
    !/^[a-f0-9]{64}$/.test(data.backend.sourceId) ||
    typeof data.backend.backendVersion !== 'string' ||
    (backend && backendHash(data.backend) !== backendHash(backend))
  )
    throw new Error(
      'Frontend backend contract differs from the app source, protocol or Cargo lock',
    );
  const { files, bytes } = verifyInventory(directory, data.files, [buildFile]);
  const names = data.files.map((file) => file.path);
  const wasmFiles = names.filter((name) => name.startsWith('runtime/backend/'));
  const pwaFiles = names.includes('sw.js') || names.includes('manifest.webmanifest');
  if (
    !/^(?:chunks\/[\w.-]+\.m?js)$/.test(data.entry) ||
    !names.includes(data.entry) ||
    required.some((name) => !names.includes(name)) ||
    (data.rendererWorker !== undefined &&
      (!rendererWorkerPath.test(data.rendererWorker) || !names.includes(data.rendererWorker))) ||
    names.some((name) => rendererWorkerPath.test(name) && name !== data.rendererWorker) ||
    (pwa ? !['sw.js', 'manifest.webmanifest'].every((name) => names.includes(name)) : pwaFiles) ||
    (target === 'web'
      ? !backendFiles.every((name) => wasmFiles.includes('runtime/backend/' + name))
      : wasmFiles.length !== 0) ||
    names.some((name, index) => index > 0 && name <= names[index - 1]) ||
    data.buildId !== hash(JSON.stringify(identity(data)))
  )
    throw new Error('Invalid frontend build inventory/identity');
  const html = fs.readFileSync(localFile(directory, 'index.html'), 'utf8');
  if (
    !html.includes('<!--nelyx-base-->') ||
    !html.includes('./' + data.entry) ||
    html.includes('./manifest.webmanifest') !== !!pwa
  )
    throw new Error('Missing or mismatched frontend HTML entry');
  if (pwa) checkInstallManifest(directory, data, pwa);
  const runtime = readJson(localFile(directory, 'runtime/native-manifest.json'));
  if (
    runtime.schema !== 'nelyx.canvaskit/v1' ||
    runtime.version !== 'm153-nelyx-paragraph.8' ||
    runtime.files?.length !== 2 ||
    !['canvaskit.js', 'canvaskit.wasm'].every((name) =>
      runtime.files.some(
        (file) =>
          file.id === name &&
          file.path === name &&
          data.files.some(
            (record) => record.path === 'runtime/' + name && record.sha256 === file.sha256,
          ),
      ),
    ) ||
    backendHash(data.canvasKit) !== backendHash(rendererIdentity(runtime)) ||
    (expectedRuntime &&
      backendHash(data.canvasKit) !== backendHash(rendererIdentity(expectedRuntime.manifest)))
  )
    throw new Error('Frontend CanvasKit runtime identity mismatch');
  return { ...data, directory, fileCount: files, bytes };
}
