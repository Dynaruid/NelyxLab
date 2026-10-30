// SPDX-License-Identifier: BSD-3-Clause
// Run the public consumers against the installed runner's single Core identity.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
const root = path.resolve(import.meta.dirname, '../../..'),
  runner = path.join(root, 'sample/nelyx-testbed-app-2/windows/runner');
const tag = 'nelyx-scroll-supply-' + process.pid,
  files = [];
function write(name, body) {
  const file = path.join(runner, name);
  assert(!fs.existsSync(file));
  fs.writeFileSync(file, body, { flag: 'wx' });
  files.push(file);
  return file;
}
try {
  const fixtureName = tag + '-fixture.mjs';
  write(
    fixtureName,
    fs.readFileSync(path.join(root, 'packages/material/tests/root-fixture.mjs'), 'utf8'),
  );
  const tests = [
    'grouped-delegate',
    'scroll-entry',
    'bounded-sliver',
    'semantics-actions',
    'focus-invalidation',
  ].map((name) =>
    write(
      tag + '-' + name + '.test.mjs',
      fs
        .readFileSync(path.join(import.meta.dirname, name + '.test.mjs'), 'utf8')
        .replace(
          "'../../../packages/material/tests/root-fixture.mjs'",
          JSON.stringify('./' + fixtureName),
        ),
    ),
  );
  const result = spawnSync(process.execPath, ['--test', '--test-timeout=1200000', ...tests], {
    cwd: runner,
    windowsHide: true,
    encoding: 'utf8',
    timeout: 1_200_000,
  });
  process.stdout.write(result.stdout ?? '');
  process.stderr.write(result.stderr ?? '');
  if (result.error) throw result.error;
  assert.equal(result.status, 0, 'Installed Core consumer regression failed');
} finally {
  for (const file of files) {
    assert.equal(path.dirname(file), runner);
    assert(!fs.lstatSync(file).isSymbolicLink());
    fs.unlinkSync(file);
  }
}
