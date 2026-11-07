// SPDX-License-Identifier: BSD-3-Clause
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { createRequire } = require('node:module');
const { spawnSync } = require('node:child_process');
const timeout = 1_200_000;

/** Resolve the consumer's native compiler through its public package metadata.
 * TS 7 intentionally does not export the old typescript/bin/tsc subpath. */
function resolveTypeScriptCompiler(root, packageName = 'typescript') {
  if (!['typescript', '@typescript/native'].includes(packageName))
    throw Error('Unknown TypeScript compiler package');
  const load = createRequire(path.join(path.resolve(root), 'package.json')),
    manifestFile = load.resolve(packageName + '/package.json'),
    manifest = JSON.parse(fs.readFileSync(manifestFile, 'utf8')),
    version = manifest.version;
  if (
    manifest.name !== 'typescript' ||
    !/^\d+\.\d+\.\d+(?:[-+].*)?$/.test(version) ||
    Number(version.split('.')[0]) < 7
  )
    throw Error('TypeScript >=7.0.0 is required; found ' + version);
  const bin = typeof manifest.bin === 'string' ? manifest.bin : manifest.bin?.tsc;
  if (typeof bin !== 'string') throw Error('TypeScript compiler entry is missing');
  const directory = fs.realpathSync(path.dirname(manifestFile)),
    entry = fs.realpathSync(path.resolve(directory, bin)),
    relative = path.relative(directory, entry);
  if (relative.startsWith('..') || path.isAbsolute(relative))
    throw Error('TypeScript compiler entry escapes its package');
  const actual = spawnSync(process.execPath, [entry, '--version'], {
    cwd: root,
    encoding: 'utf8',
    windowsHide: true,
    timeout,
  });
  if (actual.error) throw actual.error;
  if (actual.status !== 0 || actual.stdout.trim() !== 'Version ' + version)
    throw Error('TypeScript compiler/package version differs: ' + actual.stdout + actual.stderr);
  return Object.freeze({ version, entry });
}

function runTypeScriptCompiler(root, args, packageName = 'typescript') {
  const compiler = resolveTypeScriptCompiler(root, packageName),
    result = spawnSync(process.execPath, [compiler.entry, ...args], {
      cwd: root,
      encoding: 'utf8',
      windowsHide: true,
      timeout,
      maxBuffer: 64 * 1024 * 1024,
    });
  if (result.error) throw result.error;
  return Object.freeze({
    ...compiler,
    status: result.status ?? 1,
    stdout: result.stdout,
    stderr: result.stderr,
  });
}
module.exports = { resolveTypeScriptCompiler, runTypeScriptCompiler };
