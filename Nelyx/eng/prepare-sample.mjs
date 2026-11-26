// SPDX-License-Identifier: BSD-3-Clause
import fs from 'node:fs';
import path from 'node:path';
import { capture } from '../sdk/tooling/cli/src/commands.mjs';
import { withPublicationLock, removeDirectory } from '../sdk/tooling/cli/src/publication.mjs';
import { readWebRuntime } from '../sdk/tooling/contracts/src/web-runtime.mjs';
import { verifyPackageSourceInputs } from './package-source-inputs.mjs';
import { checkRustPackages } from '../backend/eng/build-supply.mjs';
import { rustPackages } from '../sdk/tooling/cli/src/rust-supply.mjs';
import { sha256 } from '../sdk/tooling/contracts/src/node-files.mjs';
import {
  buildStage,
  fingerprint,
  readBuildState,
  writeBuildState,
} from '../sdk/tooling/cli/src/build-cache.mjs';
import { buildSdk } from './build-sdk.mjs';
import { withSdkLock } from './sdk-lock.mjs';

const root = path.resolve(import.meta.dirname, '../..');
const workspace = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const packages = new Map(
  workspace.workspaces.map((relative) => {
    const directory = path.join(root, relative);
    const { name } = JSON.parse(fs.readFileSync(path.join(directory, 'package.json'), 'utf8'));
    return [name, directory];
  }),
);
const supply = [
  'core',
  'sdk',
  'skia-web',
  'vite',
  'cli',
  'tooling-contracts',
  'material',
  'cupertino',
  'backend-rust',
  'backend-wasm',
  'backend-tauri',
];
const args = process.argv.slice(2);

function pack(directory, names = supply) {
  const started = performance.now();
  if (!names.length) {
    buildStage('sdk-pack', started, {
      calls: 0,
      packages: [],
      reason: 'current archives verified',
    });
    return;
  }
  fs.mkdirSync(directory, { recursive: true });
  const args = [
    'pack',
    ...names.flatMap((name) => ['--workspace', '@nelyx/' + name]),
    '--pack-destination',
    directory,
    '--ignore-scripts',
    '--json',
  ];
  if (process.env.npm_execpath)
    capture(process.execPath, [process.env.npm_execpath, ...args], {
      cwd: root,
      timeout: 1_200_000,
    });
  else
    capture(
      process.platform === 'win32' ? 'cmd.exe' : 'npm',
      process.platform === 'win32' ? ['/d', '/c', 'npm.cmd', ...args] : args,
      { cwd: root, timeout: 1_200_000 },
    );
  buildStage('sdk-pack', started, {
    calls: 1,
    packages: names,
    reason: 'archive inputs or current archive changed',
  });
}

function verifySource(names) {
  readWebRuntime(root);
  checkRustPackages();
  for (const name of names.filter((name) => !name.startsWith('backend-')))
    verifyPackageSourceInputs(packages.get('@nelyx/' + name));
}

const generated = new Set([
  '.git',
  '.nelyx',
  '.cache',
  '.gradle',
  '.kotlin',
  '.metro-cache',
  '.cxx',
  '.vs',
  'node_modules',
  'DerivedData',
]);
function archiveInput(name) {
  const directory = packages.get('@nelyx/' + name);
  const metadata = JSON.parse(fs.readFileSync(path.join(directory, 'package.json'), 'utf8'));
  const positives = metadata.files.filter((file) => !file.startsWith('!'));
  const negatives = metadata.files
    .filter((file) => file.startsWith('!'))
    .map((file) => file.slice(1));
  const inputs = new Map();
  function visit(file) {
    const full = path.join(directory, file);
    const stat = fs.lstatSync(full, { throwIfNoEntry: false });
    if (
      !stat ||
      stat.isSymbolicLink() ||
      negatives.some((rule) => path.posix.matchesGlob(file, rule))
    )
      return;
    if (stat.isFile()) inputs.set(file, sha256(full));
    else if (stat.isDirectory())
      for (const entry of fs.readdirSync(full))
        if (!generated.has(entry)) visit(path.posix.join(file, entry));
  }
  for (const entry of [
    'package.json',
    '.npmignore',
    '.gitignore',
    ...positives,
    ...(metadata.main ? [metadata.main] : []),
    ...Object.values(
      typeof metadata.bin === 'string' ? { bin: metadata.bin } : (metadata.bin ?? {}),
    ),
    ...fs
      .readdirSync(directory)
      .filter((file) => /^(?:readme|licen[cs]e|copying|notice)(?:[._-]|$)/i.test(file)),
  ]) {
    const file = entry.replace(/^\.\//, '');
    const glob = file.split(/[?*[{]/, 1)[0];
    // Include all files under a glob's literal prefix. Matching extra files
    // causes another pack and cannot hide a file npm would include.
    visit(glob === file ? file : path.posix.dirname(glob));
  }
  return fingerprint([
    process.version,
    process.env.npm_config_user_agent,
    sha256(import.meta.filename),
    [...inputs].sort(([a], [b]) => a.localeCompare(b)),
  ]);
}

function currentArchive(app, manifest, name) {
  const reference =
    manifest.dependencies?.['@nelyx/' + name] ?? manifest.devDependencies?.['@nelyx/' + name];
  if (!reference?.startsWith('file:')) return;
  const archive = path.resolve(app, reference.slice(5));
  if (
    path.dirname(archive) !== path.join(app, '.nelyx', 'supply') ||
    !fs.lstatSync(archive, { throwIfNoEntry: false })?.isFile() ||
    fs.realpathSync(archive) !== archive ||
    !archive.endsWith('-' + sha256(archive) + '.tgz')
  )
    return;
  return reference;
}

export function prepareSample(app, install, buildSignal) {
  app = fs.realpathSync(app);
  return withSdkLock(async () => {
    if (buildSignal) await buildSdk(buildSignal);
    // Both tooling modules load the SDK config validator from the current dist.
    const [{ readApp }, { supplyRunner }] = await Promise.all([
      import('../sdk/tooling/vite/src/runner.mjs'),
      import('../sdk/tooling/cli/src/supply-runner.mjs'),
    ]);
    return withPublicationLock(app, async () => {
      const manifestPath = path.join(app, 'package.json');
      const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
      const selected = new Set(rustPackages(readApp(app).config.targets));
      const names = supply.filter((name) =>
        name.startsWith('backend-')
          ? selected.has(name)
          : !['material', 'cupertino'].includes(name) || manifest.dependencies?.['@nelyx/' + name],
      );
      if (!buildSignal) verifySource(names);
      const state = path.join(app, '.nelyx', 'sdk-archive-inputs.json');
      const previous = readBuildState(state);
      const keys = Object.fromEntries(names.map((name) => [name, archiveInput(name)]));
      const changed = names.filter(
        (name) =>
          !previous?.[name] ||
          keys[name] !== previous[name].key ||
          currentArchive(app, manifest, name) !== previous[name].reference,
      );
      const cache = path.join(root, 'Nelyx/.cache');
      fs.mkdirSync(cache, { recursive: true });
      const temporary = fs.realpathSync(fs.mkdtempSync(path.join(cache, 'packages-')));
      try {
        pack(temporary, changed);
        for (const name of changed)
          if (archiveInput(name) !== keys[name])
            throw Error('SDK package changed while packing: ' + name);
        buildSignal?.throwIfAborted();
        supplyRunner({ app, packages: temporary, reuseCurrent: true });
        const supplied = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
        writeBuildState(
          state,
          Object.fromEntries(
            names.map((name) => [
              name,
              { key: keys[name], reference: currentArchive(app, supplied, name) },
            ]),
          ),
        );
      } finally {
        removeDirectory(temporary, path.dirname(temporary));
      }
      await install?.();
    });
  });
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === path.join(import.meta.dirname, 'prepare-sample.mjs')
) {
  if (args[0] === '--packages' && args.length === 2) {
    const directory = path.resolve(args[1]);
    await withSdkLock(() => {
      verifySource(supply);
      pack(directory);
    });
    console.log(directory);
  } else if (!args.length || (args[0] === '--app' && args.length === 2)) {
    await prepareSample(args[1] ?? path.join(root, 'sample/nelyx-testbed-app-2'));
  } else {
    throw new Error(
      'Use npm run prepare:sample -- --app <app> or npm run pack:sdk -- <archive-directory>',
    );
  }
}
