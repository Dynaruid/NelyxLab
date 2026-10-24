// SPDX-License-Identifier: BSD-3-Clause
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import test from 'node:test';
import {supplyRunner} from '../../sdk/tooling/cli/src/supply-runner.mjs';

const timeout = 1_200_000;
function npm(args, cwd) {
  const result = process.platform === 'win32'
    ? spawnSync('cmd.exe', ['/d', '/c', 'npm.cmd', ...args], {cwd, timeout, encoding: 'utf8', windowsHide: true})
    : spawnSync('npm', args, {cwd, timeout, encoding: 'utf8'});
  assert.ifError(result.error); assert.equal(result.status, 0, result.stdout + result.stderr);
  return result.stdout;
}

test('re-supply retains one candidate, replaces equal-version installed bytes and rolls back failed npm resolution', {timeout}, () => {
  const disk = fs.statfsSync(os.tmpdir(), {bigint: true});
  assert(disk.bavail * disk.bsize >= 20n * 1024n ** 3n, 'Supply verification requires 20 GiB free');
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'nelyx-runner-supply-'));
  const app = path.join(directory, 'app'), runner = path.join(app, 'web/runner'), packages = path.join(directory, 'packages');
  const json = (file, value) => {fs.mkdirSync(path.dirname(file), {recursive: true}); fs.writeFileSync(file, JSON.stringify(value));};
  const pack = (name, revision) => {
    const source = path.join(directory, name);
    json(path.join(source, 'package.json'), {name: '@nelyx/' + name, version: '0.1.0', type: 'module', exports: {'./value': './value.js'}});
    fs.writeFileSync(path.join(source, 'value.js'), 'export const revision = ' + revision + ';\n');
    npm(['pack', source, '--ignore-scripts', '--pack-destination', packages, '--json'], directory);
  };
  const install = () => npm(['install', '--offline', '--ignore-scripts', '--no-audit', '--no-fund', '--workspaces=false'], runner);
  try {
    fs.mkdirSync(packages, {recursive: true});
    json(path.join(app, 'package.json'), {private: true});
    json(path.join(runner, 'package.json'), {name: 'isolated-runner', version: '0.1.0', private: true});
    for (const name of ['core', 'sdk', 'skia-rn', 'skia-web', 'metro', 'cli']) pack(name, 1);
    assert.throws(()=>supplyRunner({app,target:'web',packages}),/one nelyx-static-aot-/,'A local CLI supply must include its typed tooling dependency');
    pack('static-aot',1);
    supplyRunner({app, target: 'web', packages}); install();
    const installedCore = path.join(runner, 'node_modules/@nelyx/core/value.js');
    assert.equal(fs.readFileSync(installedCore, 'utf8'), 'export const revision = 1;\n');
    const supply = path.join(app, '.nelyx/supply/web');
    const first = fs.readdirSync(supply);
    assert.equal(first.length, 6);
    fs.writeFileSync(path.join(supply, 'unrelated.txt'), 'Preserve caller data');
    const hidden = path.join(runner, 'node_modules/.package-lock.json'), previousInstall = fs.readFileSync(hidden);
    pack('core', 2);
    const delta=path.join(directory,'delta');fs.mkdirSync(delta);fs.copyFileSync(path.join(packages,'nelyx-core-0.1.0.tgz'),path.join(delta,'nelyx-core-0.1.0.tgz'));
    const previousSdk=JSON.parse(fs.readFileSync(path.join(runner,'package.json'))).dependencies['@nelyx/sdk'];
    supplyRunner({app, target: 'web', packages:delta,reuseCurrent:true});
    assert.equal(JSON.parse(fs.readFileSync(path.join(runner,'package.json'))).dependencies['@nelyx/sdk'],previousSdk,'A delta must keep the current unchanged SDK archive in place');
    assert.deepEqual(fs.readFileSync(hidden), previousInstall, 'Lock-only supply must preserve installed identities');
    const second = fs.readdirSync(supply).filter(name => name.endsWith('.tgz'));
    assert.equal(second.length, 6); assert.equal(second.filter(name => name.startsWith('nelyx-core-')).length, 1);
    assert(!second.includes(first.find(name => name.startsWith('nelyx-core-'))));
    install();
    assert.equal(fs.readFileSync(installedCore, 'utf8'), 'export const revision = 2;\n');
    const manifest = fs.readFileSync(path.join(runner, 'package.json')), lock = fs.readFileSync(path.join(runner, 'package-lock.json')), installed = fs.readFileSync(hidden), current = fs.readdirSync(supply);
    pack('core', 3);
    const corrupt = path.join(directory, 'corrupt.tgz'); fs.writeFileSync(corrupt, 'invalid archive');
    assert.throws(() => supplyRunner({app, target: 'web', packages, extra: {'broken-package': 'file:' + corrupt}}));
    assert.deepEqual(fs.readFileSync(path.join(runner, 'package.json')), manifest);
    assert.deepEqual(fs.readFileSync(path.join(runner, 'package-lock.json')), lock);
    assert.deepEqual(fs.readFileSync(hidden), installed);
    assert.deepEqual(fs.readdirSync(supply), current, 'Failed candidates must not accumulate archives');
    assert.equal(fs.readFileSync(path.join(supply, 'unrelated.txt'), 'utf8'), 'Preserve caller data');
    assert.equal(fs.readFileSync(installedCore, 'utf8'), 'export const revision = 2;\n');
  } finally {
    assert.equal(path.dirname(directory), path.resolve(os.tmpdir()));
    assert(path.basename(directory).startsWith('nelyx-runner-supply-') && !fs.lstatSync(directory).isSymbolicLink());
    fs.rmSync(directory, {recursive: true, force: true, maxRetries: 3, retryDelay: 100});
  }
});
