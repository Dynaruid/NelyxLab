#!/usr/bin/env node
// SPDX-License-Identifier: BSD-3-Clause
import path from 'node:path';
import { createApp } from './create-app.mjs';
import { supplyRunner } from './supply-runner.mjs';
import { withPublicationLock, withSignals } from './publication.mjs';
import { buildWebApplication, devWeb, doctorWeb, prepareWeb, runWeb } from './web-runner.mjs';
import { platforms } from './tauri-platforms.mjs';

const usage = [
  'Usage: nelyx create <directory> [--name AppName] [--target web|tauri|both]',
  '              [--designs none|material|cupertino|material,cupertino] [--packages <directory>]',
  '              [--static] [--no-backend]',
  '       nelyx supply --app <app> --packages <directory>',
  '       nelyx doctor|prepare|dev|build|run --app <app> --target web',
  '       nelyx doctor|prepare|dev|build|pack|run --app <app> --target tauri --platform ' +
    platforms.join('|'),
  '       nelyx build --app <app> --target tauri --frontend-only',
  '       nelyx pack --app <app> --target tauri --platform <os> --frontend <directory>',
  '       nelyx prepare --app <app> --target <target> [--platform <os>] [--update-lock]',
  '       nelyx run --app <app> --target web --base /demo/ --port 0',
  '       nelyx run --app <app> --target tauri --platform android|ios [--no-launch]',
].join('\n');
const web = {
  doctor: doctorWeb,
  prepare: prepareWeb,
  dev: devWeb,
  build: buildWebApplication,
  run: runWeb,
};
const switches = new Set(['frontend-only', 'update-lock', 'static', 'no-backend', 'no-launch']);

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
    const value = switches.has(name) ? true : args.shift();
    if (
      Object.hasOwn(values, name) ||
      !value ||
      (typeof value === 'string' && value.startsWith('--'))
    )
      throw new Error(usage);
    values[name] = value;
  }
  return { command, destination, values, passthrough };
}

function checkFlags(values, allowed) {
  for (const name of Object.keys(values))
    if (!allowed.includes(name)) throw new Error('Unknown option --' + name);
}

async function main() {
  const args = process.argv.slice(2);
  if (!args.length || args.includes('--help')) {
    console.log(usage);
    return;
  }
  const { command, destination, values, passthrough } = parse(args);
  const app = path.resolve(values.app ?? '.');
  const { target, platform } = values;
  if (command === 'create') {
    checkFlags(values, ['name', 'designs', 'target', 'packages', 'static', 'no-backend']);
    if (!destination || destination.startsWith('--') || passthrough.length) throw new Error(usage);
    const designs = values.designs === 'none' ? [] : values.designs?.split(',');
    console.log(
      createApp(destination, {
        name: values.name,
        designs,
        target,
        staticWeb: values.static,
        noBackend: values['no-backend'],
        packages: values.packages ? path.resolve(values.packages) : undefined,
      }),
    );
    return;
  }
  if (command === 'supply') {
    checkFlags(values, ['app', 'packages']);
    if (!values.packages || passthrough.length) throw new Error(usage);
    console.log(
      await withPublicationLock(app, () =>
        supplyRunner({ app, packages: path.resolve(values.packages) }),
      ),
    );
    return;
  }
  if (!Object.hasOwn(web, command) && command !== 'pack') throw new Error(usage);
  if (target !== 'web' && target !== 'tauri')
    throw new Error('Select --target web or --target tauri');
  const frontendOnly = values['frontend-only'] === true;
  if (frontendOnly && (command !== 'build' || target !== 'tauri' || platform))
    throw new Error('--frontend-only requires build --target tauri without --platform');
  if (target === 'tauri' && !frontendOnly && !platforms.includes(platform))
    throw new Error('Select a Tauri --platform: ' + platforms.join(', '));
  if (command === 'pack' && target !== 'tauri') throw new Error('Pack requires --target tauri');
  const allowed = ['app', 'target'];
  if (target === 'tauri' && !frontendOnly) allowed.push('platform', 'architecture');
  if (command === 'build' && target === 'tauri') allowed.push('frontend-only');
  if (command === 'prepare') allowed.push('update-lock');
  if (command === 'dev' || (command === 'run' && target === 'web')) allowed.push('port', 'host');
  if (command === 'pack' || (command === 'run' && target === 'web')) allowed.push('frontend');
  if (command === 'run' && target === 'web') allowed.push('base');
  if (['dev', 'run'].includes(command) && ['android', 'ios'].includes(platform))
    allowed.push('device');
  if (command === 'run' && ['android', 'ios'].includes(platform)) allowed.push('no-launch');
  if (['build', 'pack'].includes(command) && platform === 'ios') allowed.push('export-method');
  checkFlags(values, allowed);
  if (
    passthrough.length &&
    (command !== 'run' || !['windows', 'linux', 'macos'].includes(platform))
  )
    throw new Error('Executable arguments require a desktop Tauri run command');
  const minimumPort = command === 'run' && target === 'web' ? 0 : 1;
  if (
    values.port !== undefined &&
    (!/^\d+$/.test(values.port) || Number(values.port) < minimumPort || Number(values.port) > 65535)
  ) {
    throw new Error(`--port requires an integer from ${minimumPort} to 65535`);
  }
  if (
    values['export-method'] &&
    !['debugging', 'app-store-connect', 'release-testing'].includes(values['export-method'])
  )
    throw new Error('Choose an iOS export method: debugging, app-store-connect or release-testing');
  const options = {
    app,
    platform,
    frontendOnly,
    updateLock: values['update-lock'] === true,
    architecture: values.architecture,
    device: values.device,
    noLaunch: values['no-launch'] === true,
    base: values.base,
    port: values.port === undefined ? undefined : Number(values.port),
    host: values.host,
    directory: values.frontend ? path.resolve(values.frontend) : undefined,
    arguments: passthrough,
    exportMethod: values['export-method'],
  };
  const result = await withSignals(async (signal) => {
    if (target === 'tauri') {
      const { tauriOperation } = await import('./tauri-runner.mjs');
      return tauriOperation(command, options, signal);
    }
    return web[command](options, signal);
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
