// SPDX-License-Identifier: BSD-3-Clause
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import { t as readTar } from 'tar';
import { assertInstalledSupply } from '../sdk/tooling/contracts/src/installed-supply.cjs';
import { localFile, relativeFile, sha256 } from '../sdk/tooling/contracts/src/node-files.mjs';
import {
  buildStage,
  readBuildState,
  writeBuildState,
} from '../sdk/tooling/cli/src/build-cache.mjs';
import {
  ensureDirectory,
  ownedDirectory,
  removeDirectory,
} from '../sdk/tooling/cli/src/publication.mjs';

function currentInstall(app) {
  const read = (name) => JSON.parse(fs.readFileSync(localFile(app, name), 'utf8'));
  try {
    const expected = read('package-lock.json');
    const installed = read('node_modules/.package-lock.json');
    if (expected.lockfileVersion !== installed.lockfileVersion || !expected.packages[''])
      return false;
    for (const [name, record] of Object.entries(expected.packages))
      if (name && !record.optional && !installed.packages[name]) return false;
    for (const [name, record] of Object.entries(installed.packages)) {
      if (
        !name.startsWith('node_modules/') ||
        record.link ||
        (record.os && !record.os.includes(process.platform)) ||
        (record.cpu && !record.cpu.includes(process.arch)) ||
        !isDeepStrictEqual(record, expected.packages[name]) ||
        read(name + '/package.json').version !== record.version
      )
        return false;
    }
    assertInstalledSupply(app);
    return true;
  } catch {
    return false;
  }
}

function archiveInventory(archive) {
  const files = [];
  const seen = new Set();
  readTar({
    file: archive,
    sync: true,
    strict: true,
    onReadEntry(entry) {
      if (!entry.path.startsWith('package/') || entry.type !== 'File')
        throw Error('Unexpected SDK archive entry: ' + entry.path);
      const name = relativeFile(entry.path.slice('package/'.length));
      if (seen.has(name.toLowerCase())) throw Error('Duplicate SDK archive entry: ' + name);
      seen.add(name.toLowerCase());
      const hash = createHash('sha256');
      entry.on('data', (chunk) => hash.update(chunk));
      entry.on('end', () => files.push([name, entry.size, hash.digest('hex')]));
      entry.resume();
    },
  });
  if (!files.some(([name]) => name === 'package.json'))
    throw Error('SDK archive has no package.json');
  return files;
}

function suppliedFiles(app, previous) {
  const manifest = JSON.parse(fs.readFileSync(path.join(app, 'package.json'), 'utf8'));
  return Object.fromEntries(
    Object.entries({ ...manifest.dependencies, ...manifest.devDependencies })
      .filter(
        ([name, spec]) =>
          /^@nelyx\/[a-z0-9-]+$/.test(name) &&
          typeof spec === 'string' &&
          spec.startsWith('file:.nelyx/supply/') &&
          spec.endsWith('.tgz'),
      )
      .map(([name, spec]) => [
        name,
        previous?.[name]?.spec === spec
          ? previous[name]
          : {
              spec,
              files: archiveInventory(localFile(app, spec.slice(5))),
            },
      ]),
  );
}

function damagedPackages(app, supply) {
  return Object.entries(supply)
    .filter(([name, { files }]) => {
      try {
        const root = localFile(app, 'node_modules/' + name);
        return !files.every(([relative, bytes, hash]) => {
          const file = path.join(root, relative);
          const info = fs.lstatSync(file, { throwIfNoEntry: false });
          return info?.isFile() && info.size === bytes && sha256(file) === hash;
        });
      } catch {
        return true;
      }
    })
    .map(([name]) => name);
}

/** Call with the app's supply and installation lock held. */
export async function installSample(app, npm) {
  const start = performance.now();
  const state = path.join(app, '.nelyx', 'sdk-installation.json');
  const supply = suppliedFiles(app, readBuildState(state));
  const current = currentInstall(app);
  // npm reinstalls changed archives from the public lock. Check unchanged
  // packages for damage even when an unrelated dependency also changed.
  const hidden = readBuildState(path.join(app, 'node_modules', '.package-lock.json'));
  const unchanged = Object.fromEntries(
    Object.entries(supply).filter(([name, { spec }]) => {
      const record = hidden?.packages?.['node_modules/' + name];
      return (
        record?.resolved?.startsWith('file:') &&
        path.resolve(app, spec.slice(5)) === path.resolve(app, record.resolved.slice(5))
      );
    }),
  );
  const repairs = damagedPackages(app, unchanged);
  let calls = 0;
  let stage;
  const moved = [];
  try {
    if (repairs.length) {
      const parent = ensureDirectory(path.join(app, '.nelyx'));
      stage = fs.mkdtempSync(path.join(parent, '.npm-repair-'));
      for (const name of repairs) {
        const packageDir = path.join(app, 'node_modules', name);
        if (!fs.lstatSync(packageDir, { throwIfNoEntry: false })) continue;
        ownedDirectory(packageDir);
        const backup = path.join(stage, name.slice('@nelyx/'.length));
        fs.renameSync(packageDir, backup);
        moved.push({ packageDir, backup });
      }
    }
    if (!current || repairs.length) {
      calls++;
      await npm(['install', '--workspaces=false', '--include=dev', '--no-audit', '--no-fund'], app);
    }
    assertInstalledSupply(app);
    const damaged = current && !repairs.length ? [] : damagedPackages(app, supply);
    if (damaged.length)
      throw Error(
        'SDK installation files differ from the supplied archives: ' + damaged.join(', '),
      );
    writeBuildState(state, supply);
  } catch (error) {
    for (const { packageDir, backup } of moved) {
      if (fs.existsSync(packageDir)) removeDirectory(packageDir, path.dirname(packageDir));
      fs.renameSync(backup, packageDir);
    }
    throw error;
  } finally {
    if (stage) removeDirectory(stage, path.join(app, '.nelyx'));
  }
  buildStage('npm-install', start, {
    calls,
    repaired: repairs,
    reason: repairs.length
      ? 'installed SDK files differed from archives'
      : current
        ? 'verified npm installation reused'
        : 'npm dependencies or supply changed',
  });
}
