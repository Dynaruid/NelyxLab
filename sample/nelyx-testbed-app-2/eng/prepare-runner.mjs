// SPDX-License-Identifier: BSD-3-Clause
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {supplyRunner} from '../../../Nelyx/sdk/tooling/cli/src/supply-runner.mjs';

const app = path.resolve(import.meta.dirname, '..');
const root = path.resolve(app, '../..');
const target = process.argv[2] ?? 'web';
if (!['web', 'windows', 'android'].includes(target)) throw new Error('Choose web, windows or android');
if (!process.env.npm_execpath) throw new Error('Run with npm run prepare:runner -- <target>');
const temporaryRoot = path.join(app, '.nelyx');
fs.mkdirSync(temporaryRoot, {recursive: true});
const temporary = fs.mkdtempSync(path.join(temporaryRoot, 'prepare-'));
try {
  for (const name of ['core', 'sdk', 'skia-rn', 'skia-web', 'metro', 'cli', 'material', 'cupertino']) {
    const result = spawnSync(process.execPath, [process.env.npm_execpath, 'pack', '--workspace', '@nelyx/' + name, '--pack-destination', temporary, '--ignore-scripts', '--json'], {cwd: root, encoding: 'utf8', timeout: 1_200_000, windowsHide: true});
    if (result.error || result.status !== 0) throw result.error ?? new Error(result.stderr || result.stdout);
  }
  supplyRunner({app, target, packages: temporary});
  console.log('Prepared current ' + target + ' package inputs. Install that runner next.');
} finally {
  const owned = path.resolve(temporary);
  if (path.dirname(owned) !== temporaryRoot || !path.basename(owned).startsWith('prepare-') || fs.lstatSync(owned).isSymbolicLink()) throw new Error('Unexpected temporary package owner');
  fs.rmSync(owned, {recursive: true, force: true});
}
