// SPDX-License-Identifier: BSD-3-Clause
import fs from 'node:fs';
import path from 'node:path';
import { capture } from '../sdk/tooling/cli/src/commands.mjs';
import { supplyRunner } from '../sdk/tooling/cli/src/supply-runner.mjs';
import { withPublicationLock, removeDirectory } from '../sdk/tooling/cli/src/publication.mjs';
import { readWebRuntime } from '../sdk/tooling/contracts/src/web-runtime.mjs';
import { verifyPackageSourceInputs } from './package-source-inputs.mjs';
import { checkRustPackages } from '../backend/eng/build-supply.mjs';

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
  'backend-rust',
  'backend-wasm',
  'backend-tauri',
];
const args = process.argv.slice(2);

function pack(directory) {
  readWebRuntime(root);
  checkRustPackages();
  for (const name of supply.filter((name) => !name.startsWith('backend-')))
    verifyPackageSourceInputs(packages.get('@nelyx/' + name));
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

export function prepareSample(app, install) {
  app = fs.realpathSync(app);
  return withPublicationLock(app, async () => {
    const cache = path.join(root, 'Nelyx/.cache');
    fs.mkdirSync(cache, { recursive: true });
    const temporary = fs.realpathSync(fs.mkdtempSync(path.join(cache, 'packages-')));
    try {
      pack(temporary);
      console.log(supplyRunner({ app, packages: temporary }));
    } finally {
      removeDirectory(temporary, path.dirname(temporary));
    }
    await install?.();
  });
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === path.join(import.meta.dirname, 'prepare-sample.mjs')
) {
  if (args[0] === '--packages' && args.length === 2) {
    const directory = path.resolve(args[1]);
    pack(directory);
    console.log(directory);
  } else if (!args.length || (args[0] === '--app' && args.length === 2)) {
    await prepareSample(args[1] ?? path.join(root, 'sample/nelyx-testbed-app-2'));
  } else {
    throw new Error(
      'Use npm run prepare:sample -- --app <app> or npm run pack:sdk -- <archive-directory>',
    );
  }
}
