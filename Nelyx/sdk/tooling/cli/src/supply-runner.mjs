// SPDX-License-Identifier: BSD-3-Clause
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { capture } from './commands.mjs';
import { sha256 } from '@nelyx/tooling-contracts/node-files';

const names = {
  core: 'nelyx-core-',
  sdk: 'nelyx-sdk-',
  web: 'nelyx-skia-web-',
  vite: 'nelyx-vite-',
  cli: 'nelyx-cli-',
  'tooling-contracts': 'nelyx-tooling-contracts-',
};
const retired =
  /^(?:react-native(?:-|$)|@react-native\/|@lucid-softworks\/react-native|metro(?:-|$)|hermes-compiler$|@nelyx\/(?:metro|static-aot|skia-(?:native|rn))$)/;
function installationLock(runner) {
  const modules = path.join(runner, 'node_modules'),
    file = path.join(modules, '.package-lock.json');
  const optionalStat = (file) => {
    try {
      return fs.lstatSync(file);
    } catch (error) {
      if (error?.code === 'ENOENT') return null;
      throw error;
    }
  };
  const directory = optionalStat(modules),
    stat = optionalStat(file);
  if (
    directory &&
    (!directory.isDirectory() || directory.isSymbolicLink() || fs.realpathSync(modules) !== modules)
  )
    throw new Error('Runner node_modules symlink rejected');
  if (stat && (!stat.isFile() || stat.isSymbolicLink()))
    throw new Error('Runner hidden npm lock must be a plain file');
  return file;
}
function pruneSupplyArchives(supply, runner, manifest) {
  if (fs.realpathSync(supply) !== supply) throw new Error('Supply cleanup symlink rejected');
  const current = new Set();
  for (const section of ['dependencies', 'devDependencies', 'optionalDependencies'])
    for (const reference of Object.values(manifest[section] ?? {})) {
      if (typeof reference === 'string' && reference.startsWith('file:'))
        current.add(path.resolve(runner, reference.slice(5)));
    }
  for (const entry of fs.readdirSync(supply, { withFileTypes: true })) {
    // Only content-addressed files written by supplyRunner belong to this owner.
    if (!/-[a-f0-9]{64}\.tgz$/.test(entry.name)) continue;
    const file = path.join(supply, entry.name);
    if (path.dirname(file) !== supply || !entry.isFile() || entry.isSymbolicLink())
      throw new Error('Supply cleanup requires an owned plain archive');
    if (!current.has(file)) fs.unlinkSync(file);
  }
}
function references(directory, required = Object.keys(names), fallback = {}) {
  directory = fs.realpathSync(directory);
  const references = Object.fromEntries(
    Object.entries(names).flatMap(([name, prefix]) => {
      const files = fs
        .readdirSync(directory)
        .filter((file) => file.startsWith(prefix) && file.endsWith('.tgz'));
      if (files.length > 1 || (!files.length && required.includes(name) && !fallback[name]))
        throw new Error(`Supply directory requires one ${prefix} archive`);
      return files.length
        ? [[name, 'file:' + path.join(directory, files[0])]]
        : fallback[name]
          ? [[name, fallback[name]]]
          : [];
    }),
  );
  for (const name of ['material', 'cupertino', 'localizations']) {
    const archives = fs
      .readdirSync(directory)
      .filter((file) => file.startsWith('nelyx-' + name + '-') && file.endsWith('.tgz'));
    if (archives.length > 1) throw new Error('Ambiguous optional package archives: ' + name);
    if (archives.length === 1) references[name] = 'file:' + path.join(directory, archives[0]);
    else if (fallback[name]) references[name] = fallback[name];
  }
  return references;
}
export function packageReferences(directory) {
  return references(directory);
}
/** Copy explicitly supplied archives into the consuming app before installation. */
export function supplyRunner({ app, target = 'web', packages, reuseCurrent = false }) {
  app = fs.realpathSync(app);
  if (!['web', 'pwa'].includes(target))
    throw new Error(
      'Supply the shared PWA runner with nelyx supply --app . --packages <directory>',
    );
  target = 'web';
  const runner = path.join(app, target, 'runner'),
    file = path.join(runner, 'package.json');
  if (fs.realpathSync(runner) !== runner) throw new Error('Runner symlink rejected');
  const hiddenLock = installationLock(runner),
    installedLock = fs.existsSync(hiddenLock) ? fs.readFileSync(hiddenLock) : null;
  const originalManifest = fs.readFileSync(file),
    manifest = JSON.parse(originalManifest),
    fallback = {};
  if (reuseCurrent) {
    const supply = path.join(app, '.nelyx/supply', target);
    for (const name of [...Object.keys(names), 'material', 'cupertino', 'localizations']) {
      const packageName = '@nelyx/' + (name === 'web' ? 'skia-web' : name),
        reference = manifest.dependencies?.[packageName] ?? manifest.devDependencies?.[packageName];
      if (!reference?.startsWith('file:')) continue;
      const archive = path.resolve(runner, reference.slice(5));
      if (
        path.dirname(archive) !== supply ||
        fs.realpathSync(archive) !== archive ||
        fs.lstatSync(archive).isSymbolicLink() ||
        !path.basename(archive).endsWith('-' + sha256(archive) + '.tgz')
      )
        throw Error('Only the current owned supply archive may be reused: ' + packageName);
      fallback[name] = 'file:' + archive;
    }
  }
  const refs = references(packages, Object.keys(names), fallback);
  const lockFile = path.join(runner, 'package-lock.json'),
    originalLock = fs.existsSync(lockFile) ? fs.readFileSync(lockFile) : null;
  const inputs = {
    '@nelyx/core': refs.core,
    '@nelyx/sdk': refs.sdk,
    '@nelyx/skia-web': refs.web,
    '@nelyx/vite': refs.vite,
    '@nelyx/cli': refs.cli,
    '@nelyx/tooling-contracts': refs['tooling-contracts'],
  };
  // Optional design packages are supplied only when this app declares them.
  const appManifest = JSON.parse(fs.readFileSync(path.join(app, 'package.json'), 'utf8'));
  for (const name of ['material', 'cupertino', 'localizations'])
    if (appManifest.dependencies?.['@nelyx/' + name] || manifest.dependencies?.['@nelyx/' + name]) {
      if (!refs[name]) throw new Error('Selected design package requires one archive: ' + name);
      inputs['@nelyx/' + name] = refs[name];
    }
  const supply = path.join(app, '.nelyx/supply', target);
  fs.mkdirSync(supply, { recursive: true });
  if (fs.realpathSync(supply) !== supply) throw new Error('Supply symlink rejected');
  const removed = [];
  for (const section of ['dependencies', 'devDependencies', 'optionalDependencies']) {
    for (const name of Object.keys(manifest[section] ?? {})) {
      if (!retired.test(name)) continue;
      delete manifest[section][name];
      removed.push(name);
    }
  }
  manifest.dependencies = { ...manifest.dependencies, react: '19.2.0', 'react-dom': '19.2.0' };
  manifest.devDependencies = { ...manifest.devDependencies, vite: '8.3.8' };
  let committed = false;
  try {
    for (const [name, reference] of Object.entries(inputs)) {
      if (!reference.startsWith('file:'))
        throw new Error('Supply archives require explicit local files');
      const source = fs.realpathSync(reference.slice(5)),
        bytes = fs.readFileSync(source),
        hash = createHash('sha256').update(bytes).digest('hex');
      // Re-supplying an owned archive must retain its content-addressed name.
      // Appending its hash again eventually exceeds the filesystem name limit.
      const archiveName = path.basename(source),
        alreadyOwned = path.dirname(source) === supply && archiveName.endsWith(`-${hash}.tgz`);
      if (!archiveName.endsWith('.tgz')) throw new Error('Supply requires .tgz archives');
      const destination = alreadyOwned
        ? source
        : path.join(supply, archiveName.replace(/\.tgz$/, `-${hash}.tgz`));
      if (!fs.existsSync(destination)) fs.writeFileSync(destination, bytes, { flag: 'wx' });
      const stat = fs.lstatSync(destination);
      if (!stat.isFile() || stat.isSymbolicLink())
        throw new Error('Owned supply archive must be a plain file');
      if (createHash('sha256').update(fs.readFileSync(destination)).digest('hex') !== hash)
        throw new Error('Owned supply archive changed');
      const section = ['@nelyx/cli', '@nelyx/vite', '@nelyx/tooling-contracts'].includes(name)
        ? 'devDependencies'
        : 'dependencies';
      manifest[section] ??= {};
      for (const other of ['dependencies', 'devDependencies', 'optionalDependencies']) {
        if (other !== section && manifest[other]) delete manifest[other][name];
      }
      manifest[section][name] = 'file:' + path.relative(runner, destination).replaceAll('\\', '/');
    }
    fs.writeFileSync(file, JSON.stringify(manifest, null, 2) + '\n');
    if (fs.existsSync(lockFile)) {
      const lock = JSON.parse(fs.readFileSync(lockFile, 'utf8'));
      for (const name of Object.keys(inputs)) {
        const key = 'node_modules/' + name,
          entry = lock.packages[key],
          reference = manifest.dependencies?.[name] ?? manifest.devDependencies?.[name];
        // Equal-version replacements need fresh resolution, but reusing an
        // unchanged content-addressed archive must retain its dependency tree.
        if (
          !entry?.resolved?.startsWith('file:') ||
          !reference?.startsWith('file:') ||
          path.resolve(runner, entry.resolved.slice(5)) !== path.resolve(runner, reference.slice(5))
        )
          delete lock.packages[key];
      }
      for (const name of removed) delete lock.packages['node_modules/' + name];
      fs.writeFileSync(lockFile, JSON.stringify(lock, null, 2) + '\n');
    }
    const args = [
      'install',
      '--package-lock-only',
      '--workspaces=false',
      '--ignore-scripts',
      '--no-audit',
      '--no-fund',
    ];
    capture(
      process.platform === 'win32' ? 'cmd.exe' : 'npm',
      process.platform === 'win32' ? ['/d', '/c', 'npm.cmd', ...args] : args,
      { cwd: runner, timeout: 1_200_000 },
    );
    committed = true;
  } finally {
    try {
      if (!committed) {
        fs.writeFileSync(file, originalManifest);
        if (originalLock !== null) fs.writeFileSync(lockFile, originalLock);
        else if (fs.existsSync(lockFile)) fs.unlinkSync(lockFile);
      }
      // npm can rewrite its hidden installation lock during a lock-only update,
      // even though the installed package bytes still belong to the old archives.
      // Preserve installed identities for equal-version replacements.
      installationLock(runner);
      if (installedLock !== null) fs.writeFileSync(hiddenLock, installedLock);
      else if (fs.existsSync(hiddenLock)) fs.unlinkSync(hiddenLock);
    } finally {
      pruneSupplyArchives(supply, runner, committed ? manifest : JSON.parse(originalManifest));
    }
  }
  return { runner, packages: Object.keys(inputs) };
}
