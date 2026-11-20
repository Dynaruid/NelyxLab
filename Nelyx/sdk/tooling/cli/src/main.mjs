#!/usr/bin/env node
// SPDX-License-Identifier: BSD-3-Clause
import path from 'node:path';
import { createApp } from './create-app.mjs';
import { supplyRunner } from './supply-runner.mjs';
import { withPublicationLock, withSignals } from './publication.mjs';
import { buildWebApplication, devWeb, doctorWeb, prepareWeb, runWeb } from './web-runner.mjs';
import { platforms } from './tauri-platforms.mjs';

const usage = `Usage: nelyx create <directory> [--name AppName] [--designs none|material|cupertino|material,cupertino] [--packages <directory>]
       nelyx supply --app <app> --packages <directory>
       nelyx doctor|prepare|dev|build|run --app <app> [--target pwa]
       nelyx doctor|prepare|dev|pack|run --app <app> --platform ${platforms.join('|')}
       nelyx pack --app <app> --platform <os> [--package <pwa-directory>] [--architecture <arch>]
       nelyx run --app <app> --base /demo/ --port 4173`;
const browser = {
  doctor: doctorWeb,
  prepare: prepareWeb,
  dev: devWeb,
  build: buildWebApplication,
  run: runWeb,
};
const nativeFlags = [
  'engine',
  'engine-inputs',
  'native-inputs',
  'hermes-mode',
  'hermes-profile',
  'jsc-mode',
  'jsc-inputs',
  'hermes-source',
  'entry',
  'rnl-supply',
];

function parse(args) {
  const command = args.shift();
  const destination = command === 'create' ? args.shift() : undefined;
  const values = Object.create(null);
  const passthrough = [];
  while (args.length) {
    const flag = args.shift();
    if (flag === '--') {
      passthrough.push(...args);
      break;
    }
    if (!/^--[a-z-]+$/.test(flag)) throw new Error(usage);
    const name = flag.slice(2);
    const value = args.shift();
    if (Object.hasOwn(values, name) || !value || value.startsWith('--')) throw new Error(usage);
    values[name] = value;
  }
  return { command, destination, values, passthrough };
}

function checkFlags(values, allowed) {
  for (const name of Object.keys(values)) {
    if (!allowed.includes(name)) throw new Error('Unknown option --' + name);
  }
}

function appDirectory(explicit) {
  if (explicit) return path.resolve(explicit);
  const cwd = process.cwd();
  return path.basename(cwd) === 'runner' && path.basename(path.dirname(cwd)) === 'web'
    ? path.resolve(cwd, '../..')
    : cwd;
}

async function main() {
  const args = process.argv.slice(2);
  if (!args.length || args.includes('--help')) {
    console.log(usage);
    return;
  }
  const { command, destination, values, passthrough } = parse(args);
  const platform = values.platform;
  const formerPlatform = platforms.includes(values.target) ? values.target : undefined;
  const formerHost = ['tauri', 'rnw', 'native', 'native-hermes', 'raw', 'deno', 'direct'].includes(
    values.host,
  );
  if (formerPlatform || formerHost || nativeFlags.some((name) => Object.hasOwn(values, name))) {
    const target = formerPlatform ?? platform ?? 'windows';
    throw new Error(
      command === 'build'
        ? `Build once with nelyx build --target pwa, then use nelyx pack --platform ${target}`
        : `Use nelyx ${['prepare', 'doctor', 'dev', 'run', 'pack'].includes(command) ? command : 'prepare'} --platform ${target}`,
    );
  }
  if (values.target !== undefined && !['web', 'pwa'].includes(values.target))
    throw new Error('Choose --target pwa or use --platform for Tauri');
  const app = appDirectory(values.app);
  if (command === 'create') {
    checkFlags(values, ['name', 'designs', 'target', 'packages']);
    if (!destination || destination.startsWith('--') || passthrough.length) throw new Error(usage);
    const designs =
      values.designs === undefined
        ? undefined
        : values.designs === 'none'
          ? []
          : values.designs.split(',');
    console.log(
      createApp(destination, {
        name: values.name,
        designs,
        packages: values.packages ? path.resolve(values.packages) : undefined,
      }),
    );
    return;
  }
  if (command === 'supply') {
    checkFlags(values, ['app', 'target', 'packages']);
    if (!values.packages || passthrough.length) throw new Error(usage);
    console.log(
      await withPublicationLock(app, () =>
        supplyRunner({ app, packages: path.resolve(values.packages) }),
      ),
    );
    return;
  }
  if (platform && !platforms.includes(platform))
    throw new Error('Choose a Tauri platform: ' + platforms.join(', '));
  if (command === 'build' && platform)
    throw new Error(`Run nelyx build, then nelyx pack --platform ${platform}`);
  if (command === 'pack' && !platform)
    throw new Error('Use nelyx pack --platform <os> to package the published PWA');
  if (!Object.hasOwn(browser, command) && command !== 'pack') throw new Error(usage);
  const allowed = ['app', 'target', 'platform'];
  if (platform) allowed.push('architecture');
  if (command === 'dev' || (command === 'run' && !platform)) allowed.push('port', 'host');
  if (command === 'pack' || (command === 'run' && !platform)) allowed.push('package');
  if (command === 'run' && !platform) allowed.push('base');
  if (['dev', 'run'].includes(command) && ['android', 'ios'].includes(platform))
    allowed.push('device');
  if (command === 'pack' && platform === 'ios') allowed.push('export-method');
  checkFlags(values, allowed);
  if (
    passthrough.length &&
    (command !== 'run' || !['windows', 'linux', 'macos'].includes(platform))
  )
    throw new Error('Executable arguments require a desktop Tauri run command');
  if (
    values.port !== undefined &&
    (!/^\d+$/.test(values.port) || Number(values.port) < 1 || Number(values.port) > 65535)
  )
    throw new Error('--port requires an integer from 1 to 65535');
  if (
    values['export-method'] &&
    !['debugging', 'app-store-connect', 'release-testing'].includes(values['export-method'])
  )
    throw new Error('Choose an iOS export method: debugging, app-store-connect or release-testing');
  const options = {
    app,
    platform,
    architecture: values.architecture,
    device: values.device,
    base: values.base,
    port: values.port === undefined ? undefined : Number(values.port),
    host: values.host,
    directory: values.package ? path.resolve(values.package) : undefined,
    arguments: passthrough,
    exportMethod: values['export-method'],
  };
  const result = await withSignals(async (signal) => {
    if (platform) {
      const { tauriOperation } = await import('./tauri-runner.mjs');
      return tauriOperation(command, options, signal);
    }
    return browser[command](options, signal);
  });
  console.log(JSON.stringify(result, null, 2));
  process.exitCode = result.exitCode ?? 0;
}

try {
  await main();
} catch (error) {
  console.error(error.message);
  process.exitCode = error.exitCode ?? 1;
}
