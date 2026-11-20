// SPDX-License-Identifier: BSD-3-Clause
import fs from 'node:fs';
import path from 'node:path';
import { capture } from '../sdk/tooling/cli/src/commands.mjs';
import { supplyRunner } from '../sdk/tooling/cli/src/supply-runner.mjs';
import { withPublicationLock, removeDirectory } from '../sdk/tooling/cli/src/publication.mjs';
import { checkWebRuntime } from '../skia/eng/prepare-web-runtime.mjs';
import { verifyPackageSourceInputs } from './package-source-inputs.mjs';

const root = path.resolve(import.meta.dirname, '../..');
const workspace = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const packages = new Map(
  workspace.workspaces.map((relative) => {
    const directory = path.join(root, relative);
    const { name } = JSON.parse(fs.readFileSync(path.join(directory, 'package.json'), 'utf8'));
    return [name, directory];
  }),
);
const supply = [
  'core',
  'sdk',
  'skia-web',
  'vite',
  'cli',
  'tooling-contracts',
  'material',
  'cupertino',
];
const targets = process.argv.slice(2);
const exportOnly = targets[0] === '--packages';
if (
  targets.length > 2 ||
  (exportOnly && !targets[1]) ||
  (!exportOnly && !['web', 'pwa'].includes(targets[0] ?? 'web'))
)
  throw new Error(
    'Use npm run prepare:sample -- web <app> or npm run pack:sdk -- <archive-directory>',
  );

function pack(directory) {
  checkWebRuntime();
  for (const name of supply) verifyPackageSourceInputs(packages.get('@nelyx/' + name));
  fs.mkdirSync(directory, { recursive: true });
  const args = [
    'pack',
    ...supply.flatMap((name) => ['--workspace', '@nelyx/' + name]),
    '--pack-destination',
    directory,
    '--ignore-scripts',
    '--json',
  ];
  if (process.env.npm_execpath)
    capture(process.execPath, [process.env.npm_execpath, ...args], {
      cwd: root,
      timeout: 1_200_000,
    });
  else
    capture(
      process.platform === 'win32' ? 'cmd.exe' : 'npm',
      process.platform === 'win32' ? ['/d', '/c', 'npm.cmd', ...args] : args,
      { cwd: root, timeout: 1_200_000 },
    );
}

if (exportOnly) {
  const directory = path.resolve(targets[1]);
  pack(directory);
  console.log(directory);
} else {
  const app = fs.realpathSync(targets[1] ?? path.join(root, 'sample/nelyx-testbed-app-2'));
  await withPublicationLock(app, () => {
    const cache = path.join(root, 'Nelyx/.cache');
    fs.mkdirSync(cache, { recursive: true });
    const temporary = fs.realpathSync(fs.mkdtempSync(path.join(cache, 'packages-')));
    try {
      pack(temporary);
      console.log(supplyRunner({ app, packages: temporary }));
    } finally {
      removeDirectory(temporary, path.dirname(temporary));
    }
  });
}
