// SPDX-License-Identifier: BSD-3-Clause
import fs from 'node:fs';
import path from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import { execute } from '../sdk/tooling/cli/src/commands.mjs';
import { withSignals } from '../sdk/tooling/cli/src/publication.mjs';
import { assertInstalledSupply } from '../sdk/tooling/contracts/src/installed-supply.cjs';
import { localFile } from '../sdk/tooling/contracts/src/node-files.mjs';

const root = path.resolve(import.meta.dirname, '../..');
const [target, ...args] = process.argv.slice(2);
const option = args.indexOf('--app');
if (option !== -1 && (!args[option + 1] || args[option + 1].startsWith('--')))
  throw new Error('--app requires a sample path');
const app = fs.realpathSync(
  option < 0 ? path.join(root, 'sample/nelyx-testbed-app-2') : args[option + 1],
);
if (option !== -1) args.splice(option, 2);

function hasCurrentInstall() {
  const read = (name) => JSON.parse(fs.readFileSync(localFile(app, name), 'utf8'));
  try {
    const expected = read('package-lock.json');
    const installed = read('node_modules/.package-lock.json');
    if (expected.lockfileVersion !== installed.lockfileVersion || !expected.packages[''])
      return false;
    // The installed lock omits optional packages that npm did not install on this host.
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
    return fs.statSync(localFile(app, 'node_modules/@nelyx/cli/src/main.mjs')).isFile();
  } catch {
    return false;
  }
}

await withSignals(async (signal) => {
  const npm = (args, cwd) => {
    const cli = process.env.npm_execpath;
    if (cli) return execute(process.execPath, [cli, ...args], { cwd, signal });
    return process.platform === 'win32'
      ? execute('cmd.exe', ['/d', '/c', 'npm.cmd', ...args], { cwd, signal })
      : execute('npm', args, { cwd, signal });
  };
  await npm(['run', 'build:sdk'], root);
  const { prepareSample } = await import('./prepare-sample.mjs');
  await prepareSample(app, async () => {
    if (hasCurrentInstall()) {
      console.log('Reusing installed sample dependencies.');
      return;
    }
    await npm(['install', '--workspaces=false', '--include=dev', '--no-audit', '--no-fund'], app);
    assertInstalledSupply(app);
  });
  await execute(
    process.execPath,
    [
      path.join(app, 'node_modules', '@nelyx', 'cli', 'src', 'main.mjs'),
      'build',
      '--app',
      '.',
      '--target',
      target,
      ...args,
    ],
    { cwd: app, signal },
  );
});
