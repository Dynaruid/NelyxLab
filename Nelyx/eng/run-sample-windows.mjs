// SPDX-License-Identifier: BSD-3-Clause
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { execute } from '../sdk/tooling/cli/src/commands.mjs';
import {
  packageBuildInputs,
  windowsSdkPackages,
} from '../sdk/tooling/cli/src/windows-build-inputs.mjs';
import { verifyPackageSourceInputs } from './package-source-inputs.mjs';

async function verifyEmitInventory(directory) {
  const { default: ts } = await import('typescript'),
    config = path.join(directory, 'tsconfig.build.json'),
    read = ts.readConfigFile(config, ts.sys.readFile);
  if (read.error) throw Error('Cannot read package build configuration: ' + config);
  const parsed = ts.parseJsonConfigFileContent(read.config, ts.sys, directory);
  if (parsed.errors.length) throw Error('Invalid package build configuration: ' + config);
  const emitted = new Set(),
    visit = (folder) => {
      for (const entry of fs.readdirSync(folder, { withFileTypes: true })) {
        const file = path.join(folder, entry.name);
        if (entry.isDirectory()) visit(file);
        else if (entry.name.endsWith('.js.map')) {
          const map = JSON.parse(fs.readFileSync(file, 'utf8'));
          for (const source of map.sources) emitted.add(path.resolve(folder, source));
        }
      }
    };
  visit(path.join(directory, 'dist'));
  const expected = parsed.fileNames.filter(
    (file) => /\.(?:ts|tsx)$/.test(file) && !file.endsWith('.d.ts'),
  );
  if (expected.length !== emitted.size || expected.some((file) => !emitted.has(path.resolve(file))))
    throw Error('Package TypeScript source inventory changed: ' + directory);
}

/** Repository sample convenience; installed CLI run also checks the SDK bytes
 * against its package. External apps do not depend on this workspace layout. */
export async function refreshSampleWindowsSdk(
  { root, app },
  { run = execute, report = (message) => process.stderr.write(message + '\n') } = {},
) {
  const runner = path.join(app, 'windows/runner'),
    workspace = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  const packages = new Map(
    workspace.workspaces.map((relative) => {
      const directory = path.join(root, relative),
        manifest = JSON.parse(fs.readFileSync(path.join(directory, 'package.json'), 'utf8'));
      return [manifest.name, { directory, manifest }];
    }),
  );
  const changed = windowsSdkPackages(runner).filter((name) => {
    const source = packages.get(name);
    if (!source) throw Error('Sample SDK workspace package is absent: ' + name);
    const installed = path.join(runner, 'node_modules', ...name.split('/'));
    return (
      !fs.existsSync(path.join(installed, 'package.json')) ||
      packageBuildInputs(source.directory) !== packageBuildInputs(installed)
    );
  });
  if (!changed.length) return { changed };
  report('Nelyx workspace SDK changed: ' + changed.join(', '));
  const npm = process.platform === 'win32' ? ['cmd.exe', ['/d', '/c', 'npm.cmd']] : ['npm', []];
  const npmRun = (args, options = {}) =>
    run(npm[0], [...npm[1], ...args], { cwd: root, ...options });
  // Compile only stale emitted inputs. Supply verifies native/generated inputs
  // and fails if they need their own renderer build; never copy stale dist.
  for (const name of [...packages.keys()].filter((name) => changed.includes(name))) {
    const source = packages.get(name);
    try {
      verifyPackageSourceInputs(source.directory);
      if (source.manifest.scripts?.build) await verifyEmitInventory(source.directory);
    } catch (error) {
      if (!source.manifest.scripts?.build) throw error;
      await npmRun(['run', 'build', '--workspace', name]);
      verifyPackageSourceInputs(source.directory);
      await verifyEmitInventory(source.directory);
    }
  }
  await npmRun(['run', 'prepare:sample', '--', 'windows', app], {
    env: {
      ...process.env,
      NELYX_PREPARE_PACKAGES: changed.map((name) => name.slice('@nelyx/'.length)).join(','),
    },
  });
  await npmRun(['--prefix', runner, 'install', '--ignore-scripts', '--workspaces=false']);
  for (const name of changed)
    if (
      packageBuildInputs(packages.get(name).directory) !==
      packageBuildInputs(path.join(runner, 'node_modules', ...name.split('/')))
    )
      throw Error('Installed sample SDK differs after refresh: ' + name);
  return { changed };
}

async function launchInstalledCli(cli, args) {
  const previous = process.argv;
  try {
    process.argv = [process.execPath, cli, ...args];
    await import(pathToFileURL(cli).href);
  } finally {
    process.argv = previous;
  }
}

export async function runSampleWindows(
  { root, app, arguments: args = [] },
  { run = execute, refresh = refreshSampleWindowsSdk, launch = launchInstalledCli } = {},
) {
  // Explicit package execution retains the caller's chosen portable snapshot.
  const boundary = args.indexOf('--'),
    options = boundary < 0 ? args : args.slice(0, boundary);
  if (!options.includes('--package')) await refresh({ root, app }, { run });
  // Import only after resupply. No installed CLI/SDK module has been loaded
  // above; its normal process signals and native close/drain remain in charge.
  const cli = path.join(app, 'windows/runner/node_modules/@nelyx/cli/src/main.mjs');
  return launch(cli, ['run', '--app', app, '--target', 'windows', ...args]);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = path.resolve(import.meta.dirname, '../..'),
    app = path.join(root, 'sample/nelyx-testbed-app-2');
  try {
    await runSampleWindows({ root, app, arguments: process.argv.slice(2) });
  } catch (error) {
    console.error(String(error));
    process.exitCode = 1;
  }
}
