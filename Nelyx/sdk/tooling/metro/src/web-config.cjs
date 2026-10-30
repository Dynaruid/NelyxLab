'use strict';
const path = require('node:path');
const { prepareAppAssetConfiguration } = require('./assets.cjs');
const { isBuiltin } = require('node:module');
const fs = require('node:fs');
const { createRequire } = require('node:module');
const { assertInstalledSupply } = require('./installed-supply.cjs');
const inside = (file, directory) => {
  const relative = path.relative(directory, file);
  return !relative.startsWith('..') && !path.isAbsolute(relative);
};
function inspectWebRunnerCohort({ runnerRoot }) {
  runnerRoot = fs.realpathSync(runnerRoot);
  if (path.basename(runnerRoot) !== 'runner' || path.basename(path.dirname(runnerRoot)) !== 'web')
    throw new Error('Owning web/runner required');
  assertInstalledSupply(runnerRoot);
  const load = createRequire(path.join(runnerRoot, 'package.json')),
    nodeModules = path.join(runnerRoot, 'node_modules'),
    roots = {};
  for (const [name, version] of Object.entries({
    react: '19.2.0',
    'react-dom': '19.2.0',
    'react-native-web': '0.21.3',
    'canvaskit-wasm': '0.41.0',
  })) {
    const file = load.resolve(name + '/package.json');
    if (!inside(file, nodeModules) || JSON.parse(fs.readFileSync(file, 'utf8')).version !== version)
      throw new Error('Web runner requires its own ' + name + '@' + version);
    roots[name] = path.dirname(file);
  }
  for (const name of [
    'react-native',
    '@nelyx/skia-rn',
    '@nelyx/skia-deno',
    '@react-native/metro-config',
  ])
    if (fs.existsSync(path.join(nodeModules, name)))
      throw new Error('Native dependency entered Web runner: ' + name);
  return Object.freeze({
    runnerRoot,
    nodeModules,
    react: '19.2.0',
    reactDom: '19.2.0',
    reactNativeWeb: '0.21.3',
    canvasKit: '0.41.0',
    roots: Object.freeze(roots),
  });
}
async function createWebRunnerConfig({ runnerRoot, appRoot }) {
  const cohort = inspectWebRunnerCohort({ runnerRoot }),
    load = createRequire(path.join(cohort.runnerRoot, 'package.json')),
    { FileStore } = load('metro-cache');
  appRoot = fs.realpathSync(appRoot);
  if (path.resolve(cohort.runnerRoot, '../..') !== appRoot)
    throw new Error('Web runner must belong to its application');
  prepareAppAssetConfiguration(appRoot, cohort.runnerRoot);
  const config = await createWebConfig({
    projectRoot: cohort.runnerRoot,
    watchFolders: [appRoot],
    nodeModulesPaths: [cohort.nodeModules],
  });
  return {
    ...config,
    cacheStores: [new FileStore({ root: path.join(cohort.runnerRoot, '.metro-cache') })],
    resolver: {
      ...config.resolver,
      disableHierarchicalLookup: true,
      extraNodeModules: { ...config.resolver.extraNodeModules, ...cohort.roots },
    },
  };
}
function createWebRunnerTypeScriptConfig({ runnerRoot, appRoot }) {
  const cohort = inspectWebRunnerCohort({ runnerRoot }),
    paths = {};
  createRequire(path.join(cohort.runnerRoot, 'package.json'));
  const installed = JSON.parse(
    fs.readFileSync(path.join(cohort.runnerRoot, 'package.json'), 'utf8'),
  );
  for (const name of [
    '@nelyx/core',
    '@nelyx/sdk',
    ...['material', 'cupertino', 'localizations']
      .map((name) => '@nelyx/' + name)
      .filter((name) => installed.dependencies?.[name]),
  ]) {
    let directory = path.join(cohort.nodeModules, name);
    if (!fs.existsSync(path.join(directory, 'package.json')))
      throw new Error('Missing selected package: ' + name);
    if (!inside(directory, cohort.nodeModules)) throw new Error('Web public types escaped runner');
    const manifest = JSON.parse(fs.readFileSync(path.join(directory, 'package.json'), 'utf8'));
    if (manifest.name !== name) throw new Error('Web public type owner differs');
    for (const [subpath, entry] of Object.entries(manifest.exports))
      if (typeof entry === 'object' && entry.types) {
        const file = path.resolve(directory, entry.types);
        if (!inside(file, directory) || !fs.existsSync(file))
          throw new Error('Missing Web public type');
        paths[name + subpath.slice(1)] = [
          path.relative(cohort.runnerRoot, file).replaceAll('\\', '/'),
        ];
      }
  }
  appRoot = fs.realpathSync(appRoot);
  if (path.resolve(cohort.runnerRoot, '../..') !== appRoot)
    throw new Error('Web type runner outside app');
  prepareAppAssetConfiguration(appRoot, cohort.runnerRoot);
  return {
    compilerOptions: {
      target: 'ES2022',
      module: 'NodeNext',
      moduleResolution: 'NodeNext',
      jsx: 'react-jsx',
      strict: true,
      noEmit: true,
      resolveJsonModule: true,
      allowImportingTsExtensions: true,
      skipLibCheck: true,
      lib: ['ES2022', 'DOM'],
      types: ['node'],
      baseUrl: '.',
      paths,
    },
    include: ['main.ts', 'App.tsx', '../../src/**/*.ts'],
    exclude: ['node_modules'],
  };
}
async function createWebConfig({ projectRoot, watchFolders = [], nodeModulesPaths = [] }) {
  const { getDefaultConfig, mergeConfig } = require('metro-config'),
    defaults = await getDefaultConfig(projectRoot);
  const native =
    /^(?:node:|@nelyx\/sdk\/(?:backends\/deno|platforms\/(?:windows|macos|linux|android|ios))|@nelyx\/skia-(?:rn|deno)(?:\/|$))/;
  const restart = [
    /(?:^|[\\/])node_modules[\\/](?:react(?:-dom|-native-web|-refresh)?|metro-runtime)[\\/]/,
    /(?:^|[\\/])node_modules[\\/]@nelyx[\\/](?:core|sdk|skia-web|metro)[\\/]/,
  ];
  return mergeConfig(defaults, {
    projectRoot,
    watchFolders,
    maxWorkers: 2,
    transformer: {
      babelTransformerPath: require.resolve('./web-transformer.cjs'),
      getTransformOptions: async () => ({
        transform: { experimentalImportSupport: false, inlineRequires: false },
      }),
    },
    resolver: {
      nodeModulesPaths,
      unstable_forceFullRefreshPatterns: restart,
      sourceExts: ['ts', 'tsx', 'js', 'jsx', 'mjs', 'cjs', 'json'],
      resolverMainFields: ['browser', 'module', 'main'],
      unstable_enablePackageExports: true,
      unstable_conditionNames: ['require'],
      unstable_conditionsByPlatform: { web: ['browser'] },
      resolveRequest(context, specifier, platform) {
        if (platform !== 'web' || native.test(specifier) || isBuiltin(specifier))
          throw new Error('Native/Node module rejected from Web graph: ' + specifier);
        return context.resolveRequest(
          context,
          specifier === 'react-native' ? 'react-native-web' : specifier,
          platform,
        );
      },
    },
  });
}
module.exports = {
  createWebConfig,
  inspectWebRunnerCohort,
  createWebRunnerConfig,
  createWebRunnerTypeScriptConfig,
};
