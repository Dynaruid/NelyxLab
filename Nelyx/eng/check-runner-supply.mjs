// SPDX-License-Identifier: BSD-3-Clause
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { capture, execute } from '../sdk/tooling/cli/src/commands.mjs';
import { supplyRunner } from '../sdk/tooling/cli/src/supply-runner.mjs';

const root = path.resolve(import.meta.dirname, '../..');
if (!process.argv.includes('--child')) {
  const parent = path.join(root, '.tmp');
  fs.mkdirSync(parent, { recursive: true });
  const temporary = fs.mkdtempSync(path.join(parent, 'runner-supply-'));
  try {
    await execute(process.execPath, [import.meta.filename, '--child', temporary], {
      cwd: root,
      timeout: 1_200_000,
    });
  } catch (error) {
    console.error(error.message);
    if (error.output) console.error(error.output.slice(-4000));
    process.exitCode = 1;
  } finally {
    assert.equal(path.dirname(fs.realpathSync(temporary)), fs.realpathSync(parent));
    assert(!fs.lstatSync(temporary).isSymbolicLink());
    fs.rmSync(temporary, { recursive: true, force: true });
  }
} else {
  const temporary = fs.realpathSync(process.argv.at(-1));
  assert.equal(path.dirname(temporary), path.join(root, '.tmp'));
  assert(path.basename(temporary).startsWith('runner-supply-'));
  // Only tiny local packages and a single owned npm cache; no SDK copies,
  // registry downloads, persistent install tree, or saved receipt/log files.
  process.env.npm_config_cache = path.join(temporary, 'cache');
  process.env.npm_config_offline = 'true';
  const deadline = Date.now() + 1_200_000,
    remaining = () => {
      assert(Date.now() < deadline, 'Runner supply check exceeded 20 minutes');
      return deadline - Date.now();
    },
    npm = (args, cwd) =>
      capture(
        process.platform === 'win32' ? 'cmd.exe' : 'npm',
        process.platform === 'win32' ? ['/d', '/c', 'npm.cmd', ...args] : args,
        { cwd, timeout: remaining() },
      ),
    sources = path.join(temporary, 'sources'),
    packages = path.join(temporary, 'packages'),
    updates = path.join(temporary, 'updates');
  for (const directory of [sources, packages, updates]) fs.mkdirSync(directory);
  function pack(name, version, dependencies = {}, value = 'first', directory = packages) {
    const source = fs.mkdtempSync(path.join(sources, 'package-'));
    fs.writeFileSync(
      path.join(source, 'package.json'),
      JSON.stringify({ name, version, private: true, main: 'index.cjs', dependencies }),
    );
    fs.writeFileSync(path.join(source, 'index.cjs'), 'module.exports=' + JSON.stringify(value));
    const result = JSON.parse(
      npm(['pack', '--json', '--ignore-scripts', '--pack-destination', directory], source),
    );
    assert.equal(result.length, 1);
    return path.join(directory, result[0].filename);
  }
  const foreign = path.join(temporary, 'transitives');
  fs.mkdirSync(foreign);
  const oldEstree = pack('hermes-estree', '0.32.0', {}, 'old', foreign),
    currentEstree = pack('hermes-estree', '0.35.0', {}, 'current', foreign),
    parser = pack(
      'hermes-parser',
      '0.32.0',
      { 'hermes-estree': 'file:' + oldEstree },
      'parser',
      foreign,
    );
  for (const name of ['core', 'sdk', 'skia-web', 'metro', 'cli', 'tooling-contracts'])
    pack('@nelyx/' + name, '0.1.0');
  pack('@nelyx/static-aot', '0.1.0', {
    'hermes-parser': 'file:' + parser,
    'hermes-estree': 'file:' + oldEstree,
  });
  const app = path.join(temporary, 'app'),
    runner = path.join(app, 'web/runner');
  fs.mkdirSync(runner, { recursive: true });
  fs.writeFileSync(
    path.join(app, 'package.json'),
    JSON.stringify({ name: 'supply-app', private: true }),
  );
  fs.writeFileSync(
    path.join(runner, 'package.json'),
    JSON.stringify({
      name: 'supply-runner',
      version: '0.1.0',
      private: true,
      dependencies: { 'hermes-estree': 'file:' + currentEstree },
    }),
  );
  const lockFile = path.join(runner, 'package-lock.json'),
    hiddenFile = path.join(runner, 'node_modules/.package-lock.json'),
    readLock = () => JSON.parse(fs.readFileSync(lockFile, 'utf8')),
    digest = (file) => createHash('sha256').update(fs.readFileSync(file)).digest('hex'),
    install = (command = 'ci') =>
      npm([command, '--workspaces=false', '--ignore-scripts', '--no-audit', '--no-fund'], runner);
  supplyRunner({ app, target: 'web', packages });
  install();
  const original = readLock(),
    nested = 'node_modules/@nelyx/static-aot/node_modules/hermes-estree';
  assert.equal(original.packages[nested]?.version, '0.32.0');
  assert.equal(original.packages['node_modules/hermes-estree'].version, '0.35.0');
  const previousReceipt = digest(hiddenFile);
  pack('@nelyx/core', '0.1.0', {}, 'second', updates);
  supplyRunner({ app, target: 'web', packages: updates, reuseCurrent: true });
  const replaced = readLock();
  assert.notEqual(
    replaced.packages['node_modules/@nelyx/core'].integrity,
    original.packages['node_modules/@nelyx/core'].integrity,
  );
  assert.deepEqual(
    replaced.packages[nested],
    original.packages[nested],
    'Unchanged nested dependency was removed',
  );
  assert.deepEqual(
    replaced.packages['node_modules/@nelyx/static-aot'],
    original.packages['node_modules/@nelyx/static-aot'],
  );
  assert.equal(
    digest(hiddenFile),
    previousReceipt,
    'Lock-only supply rewrote the installed receipt',
  );
  assert.equal(
    fs.readFileSync(path.join(runner, 'node_modules/@nelyx/core/index.cjs'), 'utf8'),
    'module.exports="first"',
  );
  install('install');
  assert.equal(
    fs.readFileSync(path.join(runner, 'node_modules/@nelyx/core/index.cjs'), 'utf8'),
    'module.exports="second"',
  );
  assert.equal(
    JSON.parse(fs.readFileSync(path.join(runner, nested, 'package.json'), 'utf8')).version,
    '0.32.0',
  );
  assert.equal(
    JSON.parse(
      fs.readFileSync(path.join(runner, 'node_modules/hermes-estree/package.json'), 'utf8'),
    ).version,
    '0.35.0',
  );
  const empty = path.join(temporary, 'empty');
  fs.mkdirSync(empty);
  const receipt = digest(hiddenFile);
  supplyRunner({ app, target: 'web', packages: empty, reuseCurrent: true });
  assert.deepEqual(
    readLock().packages[nested],
    original.packages[nested],
    'An unchanged resupply pruned the nested dependency',
  );
  assert.equal(digest(hiddenFile), receipt);
  console.log(
    'Runner supply: offline real npm lock/install, equal-version archive replacement, unchanged nested versions and installed receipt isolation PASS.',
  );
}
