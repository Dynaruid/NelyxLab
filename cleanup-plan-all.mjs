// SPDX-License-Identifier: BSD-3-Clause
import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { parseArgs } from 'node:util';

const workspaceRoot = import.meta.dirname;
const windows = process.platform === 'win32';
const macOS = process.platform === 'darwin';
const gibibyte = 1024 ** 3;
const scopes = ['Project', 'DeveloperCaches', 'AppCaches', 'All'];
const buildDirectories = new Set([
  '.cache',
  '.cmake',
  '.cxx',
  '.dart_tool',
  '.gradle',
  '.kotlin',
  '.metro-cache',
  '.nelyx-metro',
  '.next',
  'apppackages',
  'artifacts',
  'benchmarkdotnet.artifacts',
  'cmakefiles',
  'coverage',
  'deriveddata',
  'dist',
  'packagestore',
  'publish',
  'testresults',
]);
const buildFiles = new Set(['cmakecache.txt', 'cmake_install.cmake', 'compile_commands.json']);
const usage = `Usage: node cleanup-plan-all.mjs [options]
       npm run cleanup -- [options]

  --scope ${scopes.join('|')} (default Project)
  --exclude-dependencies       Keep project node_modules directories
  --user-cache-root <path>     Use an absolute path as the user profile directory
  --execute                   Remove the listed targets
  --dry-run, --what-if         Preview targets even with --execute
  --help, -h                   Show usage

Project includes build caches and outputs, temporary directories, and node_modules.
It also includes Tauri and Wasm Cargo caches for apps in this workspace.
DeveloperCaches includes package manager and VS Code caches. AppCaches includes
selected macOS app caches.`;

function contains(directory, file) {
  const relative = path.relative(directory, file);
  return relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative);
}

function safeStat(file, root) {
  if (!contains(root, file) || path.relative(root, file) === '') {
    throw new Error('Target must be inside its allowed root.');
  }
  // Check from the filesystem root down so linked ancestors are never traversed.
  let current = path.parse(file).root;
  let stat;
  for (const name of file.slice(current.length).split(path.sep)) {
    if (stat && !stat.isDirectory()) return;
    current = path.join(current, name);
    stat = fs.lstatSync(current, { throwIfNoEntry: false });
    if (!stat) return;
    if (stat.isSymbolicLink()) throw new Error(`Linked target or ancestor: ${current}`);
  }
  return stat;
}

function readTargetStat(target) {
  const { file, root, kind, stat: original } = target;
  const stat = safeStat(file, root);
  if (!stat) return;
  if (!(kind === 'file' ? stat.isFile() : stat.isDirectory())) {
    throw new Error(`Expected a ${kind}.`);
  }
  if (original && (stat.dev !== original.dev || stat.ino !== original.ino)) {
    throw new Error('Target changed after discovery.');
  }
  return stat;
}

function pathKey(file) {
  return windows || macOS ? file.normalize('NFC').toLowerCase() : file;
}

function readTrackedPaths() {
  const git = (...args) =>
    execFileSync('git', ['-C', workspaceRoot, ...args], {
      encoding: 'utf8',
      maxBuffer: 16 * 1024 * 1024,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  const root = git('rev-parse', '--show-toplevel').replace(/\r?\n$/, '');
  if (path.relative(workspaceRoot, root) !== '') {
    throw new Error('Keep this script in the Git repository root.');
  }
  const tracked = new Set();
  for (let relative of git('ls-files', '-z').split('\0')) {
    while (relative) {
      tracked.add(pathKey(relative));
      const separator = relative.lastIndexOf('/');
      if (separator === -1) break;
      relative = relative.slice(0, separator);
    }
  }
  return tracked;
}

function hasDotNetOutput(directory, entries) {
  if (entries.some((entry) => entry.isFile() && /\.(cs|fs|vb)proj$/i.test(entry.name))) return true;

  // A standalone build directory can outlive the project that created it.
  const pending = [[directory, 0]];
  while (pending.length) {
    const [current, depth] = pending.pop();
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      if (
        entry.isFile() &&
        /^project\.assets\.json$|\.(deps\.json|runtimeconfig\.json|nuget\.g\.props)$/i.test(
          entry.name,
        )
      ) {
        return true;
      }
      if (depth < 3 && entry.isDirectory())
        pending.push([path.join(current, entry.name), depth + 1]);
    }
  }
  return false;
}

function isNelyxApp(directory) {
  try {
    const manifest = JSON.parse(fs.readFileSync(path.join(directory, 'package.json'), 'utf8'));
    return typeof manifest?.nelyx?.appEntry === 'string';
  } catch (error) {
    if (error instanceof SyntaxError || error.code === 'ENOENT') return false;
    throw error;
  }
}

function collectProjectTargets(workspaces, includeDependencies, add, covered) {
  for (const relative of [
    'Doroti/artifacts',
    'Nelyx/artifacts',
    'temp/testing',
    '.tmp',
    'Nelyx/backend/.cache',
    'Nelyx/backend/target',
    'Nelyx/backend/crates/tauri-plugin-nelyx-backend/android/.tauri',
    'Nelyx/backend/crates/tauri-plugin-nelyx-backend/permissions/autogenerated',
    'Nelyx/backend/crates/tauri-plugin-nelyx-backend/permissions/schemas',
  ]) {
    add(relative);
  }
  for (const directory of workspaces) {
    add(path.join(directory, 'dist'));
    add(path.join(directory, '.cache'));
  }

  const excluded = new Set(
    ['reference', 'Nelyx/upstream', 'Nelyx/skia/vendor/inputs'].map(pathKey),
  );
  const apps = [];
  const pending = [''];
  while (pending.length) {
    const directory = pending.pop();
    const absolute = path.join(workspaceRoot, directory);
    const entries = fs.readdirSync(absolute, { withFileTypes: true });
    if (directory && entries.some((entry) => entry.name === '.git')) continue;
    const files = new Set(entries.filter((entry) => entry.isFile()).map((entry) => entry.name));
    if (files.has('nelyx-source.json') && files.has('nelyx-prepared.json')) {
      add(path.join(directory, 'out', 'nelyx-canvaskit'));
      continue;
    }
    if (
      directory &&
      files.has('info.plist') &&
      entries.some((entry) => entry.isDirectory() && entry.name === 'Build') &&
      entries.some((entry) => entry.isDirectory() && entry.name === 'SDKStatCaches.noindex')
    ) {
      add(directory);
      continue;
    }
    const app = files.has('package.json') && isNelyxApp(absolute);
    if (app) apps.push(fs.realpathSync(absolute));
    const sample = path.dirname(directory) === 'sample';
    for (const entry of entries) {
      const name = entry.name.toLowerCase();
      const relative = path.join(directory, entry.name);
      if (entry.isFile() && (buildFiles.has(name) || name.endsWith('.tsbuildinfo'))) {
        add(relative, 'file');
        continue;
      }
      if (!entry.isDirectory() || name === '.git' || name === '.svn' || name === '.hg') continue;
      if (excluded.has(pathKey(relative.split(path.sep).join('/'))) || covered(relative)) continue;

      if (name === '.doroti' || name === '.nelyx') {
        for (const output of ['cache', 'tmp']) add(path.join(relative, output));
        if (name === '.nelyx' && (app || sample)) {
          for (const output of ['web', 'tauri', 'wasm', 'vite', 'sdk', 'supply'])
            add(path.join(relative, output));
          for (const output of ['frontend.d.ts', 'tsconfig.json'])
            add(path.join(relative, output), 'file');
        } else if (name === '.nelyx' && !directory) {
          pending.push(relative);
        }
      } else if (name === 'node_modules') {
        if (includeDependencies) add(relative);
      } else if (name === 'bin' || name === 'obj') {
        if (hasDotNetOutput(path.join(workspaceRoot, relative), entries)) add(relative);
      } else if (
        buildDirectories.has(name) ||
        (name === 'target' && files.has('Cargo.toml')) ||
        (name === 'generated' && path.basename(directory).toLowerCase() === 'build') ||
        (name === 'build' &&
          (/(?:^|[/\\])(?:android|native)(?:[/\\]|$)/i.test(directory) ||
            files.has('CMakeLists.txt') ||
            entries.some(
              (item) => item.isFile() && /^(?:build|settings)\.gradle(?:\.kts)?$/.test(item.name),
            )))
      ) {
        add(relative);
      } else {
        pending.push(relative);
      }
    }
  }
  return apps;
}

function collectProjectCargoCaches(apps, profileRoot, alternateProfile, add) {
  let root = path.join(profileRoot, '.cache');
  if (macOS) root = path.join(profileRoot, 'Library/Caches');
  else if (windows)
    root = alternateProfile ? path.join(profileRoot, 'AppData/Local') : process.env.LOCALAPPDATA;
  else if (!alternateProfile) root = process.env.XDG_CACHE_HOME ?? root;
  if (!root || !path.isAbsolute(root)) return;

  // Match the CLI's cargoCache path without loading its installed dependencies.
  for (const app of apps) {
    const id = createHash('sha256')
      .update(windows ? app.toLowerCase() : app)
      .digest('hex')
      .slice(0, 32);
    for (const kind of ['tauri', 'wasm']) add(root, path.join('Nelyx', kind, id, 'target'));
  }
}

function collectDeveloperCaches(profileRoot, add) {
  const caches = [
    '.nuget/packages',
    '.local/share/NuGet/http-cache',
    '.local/share/NuGet/plugins-cache',
    '.npm/_cacache',
    '.cache/pip',
    '.cache/uv',
    '.dartServer/.analysis-driver',
  ];
  if (macOS) {
    caches.push('Library/Caches/pip', 'Library/Caches/uv', 'Library/Caches/Homebrew');
    for (const name of [
      'CachedExtensionVSIXs',
      'CachedData',
      'Cache',
      'Code Cache',
      'GPUCache',
      'Crashpad/completed',
      'logs',
    ])
      caches.push(`Library/Application Support/Code/${name}`);
  }
  for (const cache of caches) add(cache);

  for (const extensions of ['.vscode/extensions', '.vscode-server/extensions']) {
    const obsoleteFile = path.join(profileRoot, extensions, '.obsolete');
    if (!safeStat(obsoleteFile, profileRoot)?.isFile()) continue;
    const obsolete = JSON.parse(fs.readFileSync(obsoleteFile, 'utf8').replace(/^\uFEFF/, ''));
    if (!obsolete || typeof obsolete !== 'object' || Array.isArray(obsolete)) {
      throw new Error(`Expected an object in ${obsoleteFile}`);
    }
    for (const [name, marked] of Object.entries(obsolete)) {
      if (marked !== true) continue;
      if (
        !name.trim() ||
        name === '.' ||
        name === '..' ||
        name.includes('\0') ||
        /[/\\]/.test(name) ||
        (windows && /:|[. ]$/.test(name))
      )
        throw new Error(`Invalid obsolete extension directory name: ${name}`);
      add(path.join(extensions, name));
    }
  }
}

function collectAppCaches(profileRoot, add) {
  if (!macOS) {
    console.warn('AppCaches is available on macOS.');
    return;
  }
  for (const cache of [
    'Library/Caches/Google/Chrome',
    'Library/Application Support/Google/GoogleUpdater/crx_cache',
    'Library/Containers/com.apple.CoreDevice.CoreDeviceService/Data/Library/Caches/AppInstallationBinaryDeltas',
  ])
    add(cache);

  const figmaProfile = 'Library/Application Support/Figma/DesktopProfile';
  const directory = path.join(profileRoot, figmaProfile);
  if (!safeStat(directory, profileRoot)?.isDirectory()) return;
  for (const version of fs.readdirSync(directory, { withFileTypes: true })) {
    if (!version.isDirectory() || !/^v\d+$/i.test(version.name)) continue;
    for (const name of ['Cache', 'Code Cache', 'GPUCache'])
      add(path.join(figmaProfile, version.name, name));
  }
}

function logicalSize(file) {
  const pending = [file];
  let bytes = 0;
  while (pending.length) {
    const current = pending.pop();
    const stat = fs.lstatSync(current);
    if (stat.isDirectory()) {
      for (const name of fs.readdirSync(current)) pending.push(path.join(current, name));
    } else if (stat.isFile()) {
      bytes += stat.size;
    }
  }
  return bytes;
}

function measureTargets(targets) {
  let allocated = !windows;
  for (const target of targets) {
    try {
      if (!readTargetStat(target)) throw new Error('Target unavailable.');
      if (allocated) {
        const result = spawnSync('du', ['-skP', target.file], { encoding: 'utf8' });
        if (result.error?.code !== 'ENOENT') {
          if (result.error) throw result.error;
          const blocks = result.stdout.match(/^\s*(\d+)\s/);
          if (result.status !== 0 || !blocks)
            throw new Error('du could not measure this directory.');
          target.bytes = Number(blocks[1]) * 1024;
          continue;
        }
        allocated = false;
      }
      target.bytes = logicalSize(target.file);
    } catch (error) {
      console.warn(`Size unavailable for ${target.file}: ${error.message}`);
    }
  }
  return allocated ? 'allocated' : 'logical';
}

function printPlan(targets, skipped, scope, includeDependencies) {
  const sizeKind = measureTargets(targets);
  console.log(`Workspace ${workspaceRoot}`);
  console.log(`Scope ${scope} (${includeDependencies ? 'including' : 'excluding'} node_modules)`);
  if (targets.length) console.log('Category'.padEnd(18) + 'GiB'.padStart(8) + '  Path');
  const sorted = [...targets].sort((a, b) => (b.bytes ?? -1) - (a.bytes ?? -1));
  for (const target of sorted) {
    const relative = path.relative(target.root, target.file);
    const displayPath =
      target.category === 'Project'
        ? target.root === workspaceRoot
          ? relative
          : target.file
        : `~/${relative.split(path.sep).join('/')}`;
    const gib = target.bytes === undefined ? '?' : (target.bytes / gibibyte).toFixed(3);
    console.log(`${target.category.padEnd(18)}${gib.padStart(8)}  ${displayPath}`);
  }
  const bytes = targets.reduce((total, target) => total + (target.bytes ?? 0), 0);
  console.log(
    `Selected ${targets.length} targets (estimated ${sizeKind} size ${(bytes / gibibyte).toFixed(2)} GiB).`,
  );
  for (const { file, reason } of skipped) console.log(`Skipped ${file}: ${reason}`);
}

function main() {
  const { values } = parseArgs({
    options: {
      scope: { type: 'string', default: 'Project' },
      'include-dependencies': { type: 'boolean', default: true },
      'exclude-dependencies': { type: 'boolean' },
      'user-cache-root': { type: 'string' },
      execute: { type: 'boolean' },
      'dry-run': { type: 'boolean' },
      'what-if': { type: 'boolean' },
      help: { type: 'boolean', short: 'h' },
    },
  });
  if (values.help) {
    console.log(usage);
    return;
  }
  const scope = scopes.find((name) => name.toLowerCase() === values.scope.toLowerCase());
  if (!scope) throw new Error(`Choose --scope ${scopes.join('|')}.`);
  const alternateProfile = values['user-cache-root'];
  if (alternateProfile !== undefined && !path.isAbsolute(alternateProfile)) {
    throw new Error('--user-cache-root requires an absolute profile directory.');
  }
  const includeProject = scope === 'Project' || scope === 'All';
  const includeDeveloper = scope === 'DeveloperCaches' || scope === 'All';
  const includeApps = scope === 'AppCaches' || scope === 'All';
  const profileRoot =
    alternateProfile === undefined ? os.homedir() : path.resolve(alternateProfile);
  if ((includeDeveloper || includeApps) && !path.isAbsolute(profileRoot)) {
    throw new Error('Could not determine an absolute user profile directory.');
  }
  if (!fs.existsSync(path.join(workspaceRoot, '.git'))) {
    throw new Error('Keep this script in the NelyxLab repository root.');
  }
  const manifest = JSON.parse(fs.readFileSync(path.join(workspaceRoot, 'package.json'), 'utf8'));
  if (manifest.name !== 'nelyx-lab')
    throw new Error('Keep this script in the NelyxLab repository root.');

  const targets = [];
  const skipped = [];
  const workspaceKey = pathKey(workspaceRoot);
  let tracked = includeProject ? readTrackedPaths() : undefined;
  function validateTarget(target) {
    const { file, kind } = target;
    const stat = readTargetStat(target);
    if (!stat) return;
    const fileKey = pathKey(file);
    if (contains(fileKey, workspaceKey)) throw new Error('Contains the Git workspace.');
    if (kind === 'directory' && fs.lstatSync(path.join(file, '.git'), { throwIfNoEntry: false })) {
      throw new Error('Contains a Git checkout.');
    }
    if (contains(workspaceKey, fileKey)) {
      tracked ??= readTrackedPaths();
      const relative = path.relative(workspaceKey, fileKey).split(path.sep).join('/');
      if (tracked.has(relative)) throw new Error('Contains Git-tracked files.');
    }
    return stat;
  }

  function addTarget(category, root, relative, kind = 'directory') {
    const file = path.resolve(root, relative);
    if (targets.some((target) => contains(target.file, file))) return;
    const target = { category, root, file, kind };
    try {
      target.stat = validateTarget(target);
      if (!target.stat) return;
    } catch (error) {
      skipped.push({ file, reason: error.message });
      return;
    }
    for (let index = targets.length - 1; index >= 0; index--) {
      if (contains(file, targets[index].file)) targets.splice(index, 1);
    }
    targets.push(target);
  }

  const includeDependencies =
    includeProject && values['include-dependencies'] && !values['exclude-dependencies'];
  if (includeProject) {
    const apps = collectProjectTargets(
      manifest.workspaces,
      includeDependencies,
      (relative, kind) => addTarget('Project', workspaceRoot, relative, kind),
      (relative) =>
        targets.some((target) => contains(target.file, path.join(workspaceRoot, relative))),
    );
    collectProjectCargoCaches(apps, profileRoot, alternateProfile !== undefined, (root, relative) =>
      addTarget('Project', root, relative),
    );
  }
  if (includeDeveloper)
    collectDeveloperCaches(profileRoot, (relative) =>
      addTarget('DeveloperCaches', profileRoot, relative),
    );
  if (includeApps)
    collectAppCaches(profileRoot, (relative) => addTarget('AppCaches', profileRoot, relative));
  printPlan(targets, skipped, scope, includeDependencies);
  if (!values.execute || values['dry-run'] || values['what-if']) {
    console.log('Preview only. For deletion, use --execute and omit --dry-run and --what-if.');
    return;
  }

  // Refresh the Git index and check every target before the first deletion.
  if (tracked) tracked = readTrackedPaths();
  for (const target of targets) validateTarget(target);
  let removed = 0;
  let failed = 0;
  for (const target of targets) {
    try {
      if (!validateTarget(target)) continue;
      fs.rmSync(target.file, {
        recursive: target.kind === 'directory',
        force: true,
        maxRetries: 3,
      });
      if (safeStat(target.file, target.root))
        throw new Error('Target still exists after deletion.');
      removed++;
      console.log(`Removed ${target.file}`);
    } catch (error) {
      failed++;
      console.warn(`Could not remove ${target.file}: ${error.message}`);
    }
  }
  console.log(`Removed ${removed} targets.`);
  if (failed)
    throw new Error(`Could not remove ${failed} targets. Close processes using them and retry.`);
}

try {
  main();
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
