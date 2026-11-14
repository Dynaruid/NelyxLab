// SPDX-License-Identifier: BSD-3-Clause
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { nativeHermesSourceTree } from '../sdk/tooling/cli/src/windows-native-hermes-source.mjs';
const parent = path.resolve(import.meta.dirname, '../../.nelyx');
const temporary = fs.mkdtempSync(path.join(parent, 'hermes-source-check-'));
const timer = setTimeout(() => {
  throw Error('Hermes source identity check exceeded 20 minutes');
}, 1_200_000);
try {
  fs.writeFileSync(path.join(temporary, 'CMakeLists.txt'), 'pinned source');
  const initial = nativeHermesSourceTree(temporary);
  const reports = path.join(
    temporary,
    'build/intermediates/prefab_package_header_only/prefab_publication.json',
  );
  fs.mkdirSync(reports, { recursive: true });
  for (const variant of ['debug', 'debugOptimized', 'release'])
    fs.writeFileSync(path.join(reports, variant), '{}');
  assert.equal(nativeHermesSourceTree(temporary), initial, 'Gradle reports became native inputs');
  fs.writeFileSync(path.join(reports, 'unexpected.cpp'), 'unreviewed input');
  assert.notEqual(
    nativeHermesSourceTree(temporary),
    initial,
    'An unexpected added file was ignored',
  );
  fs.rmSync(path.join(reports, 'unexpected.cpp'));
  fs.writeFileSync(path.join(temporary, 'CMakeLists.txt'), 'changed source');
  assert.notEqual(nativeHermesSourceTree(temporary), initial, 'A source edit was ignored');
  // The exact report name cannot hide a directory of arbitrary source files.
  fs.rmSync(path.join(reports, 'debug'));
  fs.mkdirSync(path.join(reports, 'debug'));
  fs.writeFileSync(path.join(reports, 'debug', 'unexpected.cpp'), 'unreviewed input');
  fs.writeFileSync(path.join(temporary, 'CMakeLists.txt'), 'pinned source');
  assert.notEqual(nativeHermesSourceTree(temporary), initial, 'A report directory was ignored');
  const linkTarget = path.join(temporary, 'link-target');
  fs.mkdirSync(linkTarget);
  fs.rmSync(path.join(reports, 'release'));
  fs.symlinkSync(
    linkTarget,
    path.join(reports, 'release'),
    process.platform === 'win32' ? 'junction' : 'dir',
  );
  assert.throws(
    () => nativeHermesSourceTree(temporary),
    /input is a link/,
    'A report name hid a symbolic link',
  );
  console.log(
    'Hermes source identity: exact generated reports, unexpected additions, source edits, report directories and links PASS.',
  );
  /* oxlint-disable no-unsafe-finally -- A changed cleanup owner must preserve the directory. */
} finally {
  clearTimeout(timer);
  if (
    path.dirname(temporary) !== parent ||
    !path.basename(temporary).startsWith('hermes-source-check-') ||
    fs.lstatSync(temporary).isSymbolicLink()
  )
    throw Error('Unexpected Hermes source check cleanup owner');
  fs.rmSync(temporary, { recursive: true, force: true });
}
/* oxlint-enable no-unsafe-finally */
