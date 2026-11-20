// SPDX-License-Identifier: BSD-3-Clause
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import {
  fileTree,
  localFile,
  relativeFile,
  sha256,
  verifyInventory,
} from '@nelyx/tooling-contracts/node-files';
import {
  inspectRunner,
  prepareRunnerFiles,
  profile,
  readJson,
  renderer,
  writeJson,
} from './runner.mjs';
import { serviceWorker } from './service-worker.mjs';

const schema = 'nelyx.pwa-build/v1';
const buildFile = 'build.json';
const profileValues = {
  schema,
  format: 'pwa',
  provider: 'web',
  renderer,
  profile,
  gpuBackend: 'webgl2',
};
const required = [
  'index.html',
  'manifest.webmanifest',
  'sw.js',
  'runtime/native-manifest.json',
  'runtime/canvaskit.js',
  'runtime/canvaskit.wasm',
  'licenses/canvaskit-BSD-3-Clause.txt',
];
const hash = (text) => createHash('sha256').update(text).digest('hex');
const identity = ({ appId, name, version, entry, files }) => ({
  ...profileValues,
  appId,
  name,
  version,
  entry,
  files,
});

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
export async function buildPwa(app, output) {
  const value = inspectRunner(app);
  const { config, version, runner } = value;
  const { files, icons, metadata } = prepareRunnerFiles(value);
  const { build } = await value.vite();
  const modules = new Set();
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
    plugins: [
      {
        name: 'nelyx:release-licenses',
        generateBundle(_options, bundle) {
          for (const item of Object.values(bundle)) {
            if (item.type === 'chunk') for (const id of Object.keys(item.modules)) modules.add(id);
          }
        },
      },
    ],
  });
  if (JSON.stringify(readJson(path.join(runner, 'app-config.json'))) !== JSON.stringify(metadata))
    throw new Error('App assets changed during the Vite build; retry with stable inputs');
  const viteManifest = path.join(output, '.vite/manifest.json');
  const entry = verifyReleaseEntries(output, readJson(viteManifest));
  fs.unlinkSync(viteManifest);
  fs.rmdirSync(path.dirname(viteManifest));
  for (const [name, bytes] of files) writeAsset(output, name, bytes);
  writeLicenses(output, value, modules);
  writeJson(path.join(output, 'manifest.webmanifest'), {
    id: config.pwa.id,
    start_url: './',
    scope: './',
    display: 'standalone',
    name: config.displayName ?? config.name,
    short_name: config.pwa.shortName,
    theme_color: config.pwa.themeColor,
    background_color: config.pwa.themeColor,
    icons,
  });
  writeAsset(output, 'sw.js', serviceWorker(config.pwa.id, inventory(output)));
  const data = identity({
    appId: config.pwa.id,
    name: config.name,
    version,
    entry,
    files: inventory(output),
  });
  writeJson(path.join(output, buildFile), { ...data, buildId: hash(JSON.stringify(data)) });
  return verifyPwa(output, value);
}

function checkInstallManifest(directory, data) {
  const manifest = readJson(localFile(directory, 'manifest.webmanifest'));
  if (
    manifest.id !== data.appId ||
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

export function verifyPwa(directory, { config, version }) {
  directory = path.resolve(directory);
  if (!fs.existsSync(directory))
    throw new Error('PWA input missing at ' + directory + '. Run nelyx build --target pwa first.');
  if (
    path.relative(directory, fs.realpathSync(directory)) ||
    !fs.lstatSync(directory).isDirectory()
  )
    throw new Error('PWA input must be an ordinary directory: ' + directory);
  const data = readJson(localFile(directory, buildFile));
  if (
    Object.entries(profileValues).some(([key, expected]) => data[key] !== expected) ||
    data.appId !== config.pwa.id ||
    data.name !== config.name ||
    data.version !== version
  )
    throw new Error(
      'PWA input belongs to another app/version or cohort. Run nelyx build --target pwa first.',
    );
  const { files, bytes } = verifyInventory(directory, data.files, [buildFile]);
  const names = data.files.map((file) => file.path);
  if (
    !/^(?:chunks\/[\w.-]+\.m?js)$/.test(data.entry) ||
    !names.includes(data.entry) ||
    required.some((name) => !names.includes(name)) ||
    names.some((name, index) => index > 0 && name <= names[index - 1]) ||
    data.buildId !== hash(JSON.stringify(identity(data)))
  )
    throw new Error('Invalid PWA build inventory/identity');
  const html = fs.readFileSync(localFile(directory, 'index.html'), 'utf8');
  if (
    !html.includes('<!--nelyx-base-->') ||
    !html.includes('./' + data.entry) ||
    !html.includes('./manifest.webmanifest')
  )
    throw new Error('Missing PWA HTML entry');
  checkInstallManifest(directory, data);
  const runtime = readJson(localFile(directory, 'runtime/native-manifest.json'));
  if (
    runtime.schema !== 'nelyx.canvaskit/v1' ||
    runtime.version !== 'm153-nelyx-paragraph.7' ||
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
    )
  ) {
    throw new Error('PWA CanvasKit runtime identity mismatch');
  }
  return { ...data, directory, fileCount: files, bytes };
}
