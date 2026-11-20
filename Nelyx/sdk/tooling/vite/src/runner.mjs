// SPDX-License-Identifier: BSD-3-Clause
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { defineAssetManifest, defineConfig } from '@nelyx/sdk/runtime/config';
import { createProviderRegistry } from '@nelyx/sdk/runtime/providers';
import { resolveAppAssetManifest, verifyAppAssets } from '@nelyx/tooling-contracts/app-assets';
import { assertInstalledSupply } from '@nelyx/tooling-contracts/installed-supply';
import { readWebRuntime } from '@nelyx/tooling-contracts/web-runtime';
import { localFile } from '@nelyx/tooling-contracts/node-files';

export const viteVersion = '8.3.8';
export const profile = 'ganesh-webgl2';
export const renderer = 'skia-ganesh';
const defaults = path.resolve(import.meta.dirname, '../assets');
export const readJson = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));
export const writeJson = (file, value) => {
  const next = JSON.stringify(value, null, 2) + '\n';
  const existing = fs.lstatSync(file, { throwIfNoEntry: false });
  if (existing && !existing.isFile()) throw new Error('Expected a regular file: ' + file);
  if (!existing || fs.readFileSync(file, 'utf8') !== next) fs.writeFileSync(file, next);
};
export const appPath = (app, file) => localFile(app, file.slice(2));
export const relative = (directory, file) => path.relative(directory, file).replaceAll('\\', '/');

export function readApp(app) {
  app = fs.realpathSync(app);
  const { nelyx, version } = readJson(path.join(app, 'package.json'));
  const config = defineConfig(nelyx);
  if (typeof version !== 'string' || !/^\d+\.\d+\.\d+(?:[-+][\w.+-]+)?$/.test(version))
    throw new Error('App package.json requires a semantic version');
  const warnings = [];
  if (nelyx.schema === 'nelyx.app/v2') {
    const oldTargets = Object.keys(nelyx.targets).filter((target) => target !== 'web');
    warnings.push('Read nelyx.app/v2 as PWA. Migrate package.json to nelyx.app/v3 when ready.');
    if (oldTargets.length) warnings.push('Transfer Tauri settings for: ' + oldTargets.join(', '));
  }
  return { app, config, version, warnings };
}

export function inspectRunner(app) {
  const value = readApp(app);
  const runner = path.join(value.app, 'web', 'runner');
  const file = path.join(runner, 'package.json');
  if (!fs.existsSync(file) || fs.realpathSync(runner) !== runner)
    throw new Error('Add the PWA starter web/runner at ' + runner);
  const load = createRequire(file);
  const declarations = readJson(file);
  const packages = { ...declarations.dependencies, ...declarations.devDependencies };
  const nodeModules = path.join(runner, 'node_modules');
  const roots = {};
  for (const name of [
    'react',
    'react-dom',
    'vite',
    '@nelyx/vite',
    '@nelyx/core',
    '@nelyx/sdk',
    '@nelyx/skia-web',
    '@nelyx/tooling-contracts',
    ...['@nelyx/material', '@nelyx/cupertino', '@nelyx/localizations'].filter(
      (name) => packages[name],
    ),
  ]) {
    const own = path.join(nodeModules, name);
    const manifest = path.join(own, 'package.json');
    if (!fs.existsSync(manifest) || readJson(manifest).name !== name)
      throw new Error(`Install ${name} in ${runner} with npm ci --workspaces=false after supply`);
    roots[name] = fs.realpathSync(own);
  }
  assertInstalledSupply(runner);
  if (readJson(path.join(roots.vite, 'package.json')).version !== viteVersion)
    throw new Error('Install the pinned Vite ' + viteVersion + ' in ' + runner);
  const installed = Object.fromEntries(
    ['react', 'react-dom'].map((name) => [
      name,
      readJson(path.join(roots[name], 'package.json')).version,
    ]),
  );
  const registry = createProviderRegistry();
  const cohort = registry.cohort(
    'web',
    {
      reactVersion: installed.react,
      reactDomVersion: installed['react-dom'],
    },
    profile,
  );
  for (const forbidden of [
    'react-native',
    'react-native-web',
    '@react-native',
    'metro',
    'metro-runtime',
    '@nelyx/metro',
    '@nelyx/skia-rn',
    '@nelyx/skia-native',
    '@nelyx/static-aot',
  ]) {
    if (fs.existsSync(path.join(nodeModules, forbidden)))
      throw new Error(
        `Retired package ${forbidden} in ${runner}; resupply and clean-install the PWA runner`,
      );
  }
  appPath(value.app, value.config.appEntry);
  appPath(value.app, value.config.pwa.component);
  const legacy = [
    'metro.config.cjs',
    'metro.config.js',
    'babel.config.js',
    'babel.config.cjs',
    'build.mjs',
  ].filter((name) => fs.existsSync(path.join(runner, name)));
  const entry = path.join(runner, 'main.ts');
  if (
    fs.existsSync(entry) &&
    /@nelyx\/metro|react-native|webBackend\(\)\.native/.test(fs.readFileSync(entry, 'utf8'))
  )
    throw new Error(
      `Migrate ${entry} to the Vite starter entry and React DOM imports. Review ${legacy.join(', ') || 'the old resolver and transformer'} for custom settings to move into vite.config.ts.`,
    );
  if (legacy.length)
    value.warnings.push('Review legacy runner files for custom settings: ' + legacy.join(', '));
  return {
    ...value,
    runner,
    load,
    roots,
    cohort,
    runtime: readWebRuntime(runner),
    vite: () => import(pathToFileURL(load.resolve('vite')).href),
  };
}

function deploymentPath(reference) {
  const name = reference.path.slice(2);
  return name.startsWith('assets/') ? name : 'assets/' + name;
}

export function readIcons({ app, config }) {
  return (
    config.pwa.icons ??
    [192, 512].map((size) => ({
      src: `./icon-${size}.png`,
      sizes: `${size}x${size}`,
      type: 'image/png',
    }))
  ).map(({ src, sizes, type, purpose }) => {
    const file = appPath(config.pwa.icons ? app : defaults, src);
    const bytes = fs.readFileSync(file);
    const size = Number.parseInt(sizes, 10);
    if (
      bytes.length < 24 ||
      bytes.length > 2 * 1024 * 1024 ||
      bytes.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a' ||
      bytes.toString('ascii', 12, 16) !== 'IHDR' ||
      bytes.readUInt32BE(16) !== size ||
      bytes.readUInt32BE(20) !== size
    ) {
      throw new Error(`PWA icon must be a ${sizes} PNG: ${src}`);
    }
    return {
      bytes,
      src: 'icons/' + sizes + (purpose ? '-' + purpose.replace(' ', '-') : '') + '.png',
      sizes,
      type,
      ...(purpose ? { purpose } : {}),
    };
  });
}

export function appFiles(value, prepare) {
  const { app, runner, config, runtime } = value;
  const verified = prepare
    ? resolveAppAssetManifest(app, runner, config.assets).verified
    : verifyAppAssets(app, config.assets);
  const assets = [];
  const files = new Map();
  function publish(name, bytes) {
    const key = name.toLowerCase();
    const existing = files.get(key);
    if (existing && (existing.name !== name || !existing.bytes.equals(bytes)))
      throw new Error('Conflicting PWA file: ' + name);
    files.set(key, { name, bytes });
  }
  const storeAsset = ({ file, bytes, ...metadata }) => {
    const name = deploymentPath(metadata);
    const content = fs.readFileSync(file);
    if (
      content.length !== bytes ||
      createHash('sha256').update(content).digest('hex') !== metadata.sha256
    )
      throw new Error('App asset changed during preparation: ' + file);
    publish(name, content);
    return { ...metadata, path: './' + name };
  };
  for (const { notice, ...asset } of verified) {
    assets.push({ ...storeAsset(asset), ...(notice ? { notice: storeAsset(notice) } : {}) });
  }
  const icons = readIcons(value).map(({ bytes, ...icon }) => {
    publish(icon.src, bytes);
    return { ...icon, src: './' + icon.src };
  });
  for (const { file, bytes } of runtime.runtime) publish('runtime/' + file.id, bytes);
  publish('runtime/native-manifest.json', Buffer.from(JSON.stringify(runtime.manifest) + '\n'));
  publish('licenses/canvaskit-BSD-3-Clause.txt', fs.readFileSync(runtime.license));
  const metadata = {
    name: config.name,
    target: 'web',
    profile,
    cohort: value.cohort,
    assets: defineAssetManifest(assets),
  };
  if (prepare) writeJson(path.join(runner, 'app-config.json'), metadata);
  return {
    files: new Map([...files.values()].map(({ name, bytes }) => [name, bytes])),
    icons,
    metadata,
  };
}

export function prepareRunnerFiles(value) {
  const { runner, app, roots, config } = value;
  const paths = {};
  paths['virtual:nelyx-component'] = ['./' + relative(runner, appPath(app, config.pwa.component))];
  paths['virtual:nelyx-app'] = ['./' + relative(runner, appPath(app, config.appEntry))];
  for (const [name, directory] of Object.entries(roots)) {
    if (!name.startsWith('@nelyx/') || name === '@nelyx/vite') continue;
    for (const [entry, target] of Object.entries(
      readJson(path.join(directory, 'package.json')).exports ?? {},
    )) {
      if (!target?.types) continue;
      const file = localFile(directory, target.types.slice(2));
      paths[name + entry.slice(1)] = ['./' + relative(runner, file)];
    }
  }
  const types = ['react', 'react-dom'].map((name) => {
    const base = path.join(runner, 'node_modules/@types', name);
    return [name, base];
  });
  for (const [name, base] of types) {
    paths[name] = ['./' + relative(runner, path.join(base, 'index.d.ts'))];
    paths[name + '/*'] = ['./' + relative(runner, path.join(base, '*'))];
  }
  writeJson(path.join(runner, 'tsconfig.nelyx.json'), {
    compilerOptions: {
      target: 'ES2022',
      module: 'ESNext',
      moduleResolution: 'Bundler',
      lib: ['ES2022', 'DOM', 'DOM.Iterable'],
      types: ['node', 'vite/client'],
      jsx: 'react-jsx',
      strict: true,
      noEmit: true,
      resolveJsonModule: true,
      allowImportingTsExtensions: true,
      skipLibCheck: true,
      paths,
    },
    include: [
      'main.ts',
      'vite.config.ts',
      relative(runner, appPath(app, config.appEntry)),
      relative(runner, appPath(app, config.pwa.component)),
      '../../src/**/*.ts',
      '../../src/**/*.tsx',
    ],
  });
  const configFile = path.join(runner, 'tsconfig.json');
  if (!fs.existsSync(configFile))
    fs.writeFileSync(configFile, '{"extends":"./tsconfig.nelyx.json"}\n', { flag: 'wx' });
  return appFiles(value, true);
}
