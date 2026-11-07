// SPDX-License-Identifier: BSD-3-Clause
import path from 'node:path';
import { execute } from '../../../Nelyx/sdk/tooling/cli/src/commands.mjs';
import { configureRunner } from '../../../Nelyx/sdk/tooling/cli/src/runner-configuration.mjs';
import {
  readApplication,
  configureWindowsApplication,
} from '../../../Nelyx/sdk/tooling/cli/src/application.mjs';
import { prepareDemoWindowsInputs } from './windows-inputs.mjs';

const app = path.resolve(import.meta.dirname, '..');
const root = path.resolve(app, '../..');
const target = process.argv[2];
if (!['web', 'windows', 'android'].includes(target)) throw Error('Choose web, windows or android');
if (!process.env.npm_execpath) throw Error('Run with npm run prepare:<platform>');

await execute(
  process.execPath,
  [process.env.npm_execpath, 'run', 'prepare:sample', '--', target, app],
  { cwd: root, timeout: 1_200_000 },
);

await execute(
  process.execPath,
  [
    process.env.npm_execpath,
    '--prefix',
    path.join(app, target, 'runner'),
    'install',
    '--ignore-scripts',
    '--workspaces=false',
  ],
  { cwd: root, timeout: 1_200_000 },
);

if (target === 'windows') {
  configureWindowsApplication(await readApplication(app, target));
  prepareDemoWindowsInputs(process.argv[3]);
} else await configureRunner({ app, target });
