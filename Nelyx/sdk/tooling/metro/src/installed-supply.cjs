// SPDX-License-Identifier: BSD-3-Clause
'use strict';
const fs = require('node:fs'),
  path = require('node:path'),
  { createHash } = require('node:crypto'),
  { fileURLToPath } = require('node:url');
/** npm supply changes require a real install, even when package versions stay equal. */
function assertInstalledSupply(runnerRoot, sourcePackages = {}) {
  const manifest = JSON.parse(fs.readFileSync(path.join(runnerRoot, 'package.json'), 'utf8'));
  const selected = Object.entries({
    ...manifest.dependencies,
    ...manifest.devDependencies,
    ...manifest.optionalDependencies,
  }).filter(
    ([name, spec]) =>
      name.startsWith('@nelyx/') &&
      typeof spec === 'string' &&
      spec.startsWith('file:') &&
      spec.endsWith('.tgz') &&
      !Object.hasOwn(sourcePackages, name),
  );
  if (!selected.length) return;
  const lockFile = path.join(runnerRoot, 'node_modules/.package-lock.json'),
    install = fs.existsSync(path.join(runnerRoot, 'package-lock.json')) ? 'npm ci' : 'npm install',
    fail = (name, reason) => {
      throw new Error(
        `Installed runner supply differs for ${name}: ${reason}. Run ${install} --workspaces=false in ${runnerRoot} after supplying archives.`,
      );
    };
  if (!fs.existsSync(lockFile)) fail(selected[0][0], 'npm installation receipt is missing');
  const installed = JSON.parse(fs.readFileSync(lockFile, 'utf8')).packages ?? {};
  const resolve = (spec) =>
    spec.startsWith('file://') ? fileURLToPath(spec) : path.resolve(runnerRoot, spec.slice(5));
  for (const [name, spec] of selected) {
    const archive = resolve(spec),
      record = installed['node_modules/' + name];
    if (
      !record ||
      typeof record.resolved !== 'string' ||
      !record.resolved.startsWith('file:') ||
      resolve(record.resolved) !== archive
    )
      fail(name, 'archive location does not match the supplied manifest');
    if (!fs.existsSync(archive)) fail(name, 'supplied archive is missing');
    const bytes = fs.readFileSync(archive),
      integrity = 'sha512-' + createHash('sha512').update(bytes).digest('base64');
    if (typeof record.integrity !== 'string' || !record.integrity.split(/\s+/).includes(integrity))
      fail(name, 'archive integrity does not match the npm installation receipt');
    const installedManifest = path.join(runnerRoot, 'node_modules', name, 'package.json');
    if (
      !fs.existsSync(installedManifest) ||
      JSON.parse(fs.readFileSync(installedManifest, 'utf8')).name !== name
    )
      fail(name, 'installed package is missing or has a different owner');
  }
}
module.exports = { assertInstalledSupply };
