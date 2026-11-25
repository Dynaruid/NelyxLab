// SPDX-License-Identifier: BSD-3-Clause
import fs from 'node:fs';
import path from 'node:path';
import { execute } from '../sdk/tooling/cli/src/commands.mjs';
import { withSignals } from '../sdk/tooling/cli/src/publication.mjs';
import { installSample } from './install-sample.mjs';
import { buildStage } from '../sdk/tooling/cli/src/build-cache.mjs';

const root = path.resolve(import.meta.dirname, '../..');
const [target, ...args] = process.argv.slice(2);
const option = args.indexOf('--app');
if (option !== -1 && (!args[option + 1] || args[option + 1].startsWith('--')))
  throw new Error('--app requires a sample path');
const app = fs.realpathSync(
  option < 0 ? path.join(root, 'sample/nelyx-testbed-app-2') : args[option + 1],
);
if (option !== -1) args.splice(option, 2);

await withSignals(async (signal) => {
  const started = performance.now();
  const npm = (args, cwd) => {
    const cli = process.env.npm_execpath;
    if (cli) return execute(process.execPath, [cli, ...args], { cwd, signal });
    return process.platform === 'win32'
      ? execute('cmd.exe', ['/d', '/c', 'npm.cmd', ...args], { cwd, signal })
      : execute('npm', args, { cwd, signal });
  };
  const { prepareSample } = await import('./prepare-sample.mjs');
  await prepareSample(app, () => installSample(app, npm), signal);
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
  buildStage('sample-build', started, { target });
});
