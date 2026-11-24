#!/usr/bin/env node
// SPDX-License-Identifier: BSD-3-Clause
import path from 'node:path';
import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
import { parseArgs } from 'node:util';
import { execute, startOwnedCommand } from '../../Nelyx/sdk/tooling/cli/src/commands.mjs';
import { withPublicationLock, withSignals } from '../../Nelyx/sdk/tooling/cli/src/publication.mjs';
import {
  androidAdb,
  androidDeviceArchitecture,
  inspectPlatform,
  mobile,
  platformTarget,
} from '../../Nelyx/sdk/tooling/cli/src/tauri-platforms.mjs';
import { androidTargets, iosTargets, iosSimulatorArchitecture } from './devices.mjs';

const root = path.resolve(import.meta.dirname, '../..');
const platforms = ['web', 'windows', 'android', 'ios'];
const apps = { Demo: 'sample/nelyx-demo-app', Testbed: 'sample/nelyx-testbed-app-2' };
const targetKinds = { android: ['device', 'emulator'], ios: ['device', 'simulator'] };
const cliOptions = {
  platform: { type: 'string' },
  app: { type: 'string' },
  target: { type: 'string', default: 'auto' },
  device: { type: 'string' },
  architecture: { type: 'string' },
  port: { type: 'string' },
  base: { type: 'string' },
  'no-launch': { type: 'boolean' },
  list: { type: 'boolean' },
  'dry-run': { type: 'boolean' },
  help: { type: 'boolean', short: 'h' },
};

const usage = `Usage: npm run deploy -- [--platform ${platforms.join('|')}] [--app Demo|Testbed]
       node helpers/deploy-helper/deploy.mjs [options]

  --target auto|device|emulator|simulator  Filter Android or iOS destinations
  --device <id>                          ADB serial, iOS device ID, or simulator UDID
  --architecture <arch>                  Tauri architecture (Android matches the device ABI)
  --port <0..65535>                       Web preview port (0 selects a free port)
  --base </path/>                         Web preview path (default /)
  --no-launch                            Serve Web and print its URL, package Windows,
                                         or build and install the app on mobile
  --list                                 List apps and destinations for the selected platform
  --dry-run                              Print the build and run commands
  --help                                 Show usage`;

function optionName(requested, values, flag) {
  if (requested === undefined) return;
  const value = values.find((name) => name.toLowerCase() === requested.toLowerCase());
  if (!value) throw new Error(`Choose ${flag} ${values.join('|')}`);
  return value;
}

async function select(items, title, flag, signal, label = String) {
  if (!items.length) throw new Error(`No available ${title.toLowerCase()}. Check --list.`);
  if (items.length === 1) return items[0];
  console.log(title);
  items.forEach((item, index) => console.log(`  ${index + 1}. ${label(item)}`));
  if (!process.stdin.isTTY) throw new Error(`Specify ${flag} in a non-interactive terminal`);
  signal.throwIfAborted();
  const input = createInterface({ input: process.stdin, output: process.stdout });
  const close = () => input.close();
  signal.addEventListener('abort', close, { once: true });
  try {
    input.setPrompt(`Select 1-${items.length} (q to cancel) `);
    input.prompt();
    for await (const answer of input) {
      const value = answer.trim();
      if (value.toLowerCase() === 'q') break;
      const index = Number(value) - 1;
      if (/^\d+$/.test(value) && index >= 0 && index < items.length) return items[index];
      input.prompt();
    }
    throw Object.assign(new Error('Selection cancelled'), { exitCode: 130 });
  } finally {
    signal.removeEventListener('abort', close);
    input.close();
  }
}

function validateOptions(platform, options) {
  const kinds = targetKinds[platform] ?? [];
  if (!['auto', ...kinds].includes(options.target))
    throw new Error(
      `Choose --target ${['auto', ...kinds].join('|')} for ${platform ?? 'the platform'}`,
    );
  if (options.device !== undefined && (!mobile(platform) || !options.device.trim()))
    throw new Error('--device requires a mobile platform and a device ID');
  if (
    options.architecture !== undefined &&
    (!platform || platform === 'web' || !options.architecture)
  )
    throw new Error('--architecture requires a Tauri platform and an architecture');
  if (platform !== 'web' && (options.port !== undefined || options.base !== undefined))
    throw new Error('--port and --base require --platform web');
  if (options.port !== undefined && (!/^\d+$/.test(options.port) || Number(options.port) > 65535))
    throw new Error('--port requires an integer from 0 to 65535');
  if (options.base !== undefined && !/^\/(?:[\w-]+\/)*$/.test(options.base))
    throw new Error('--base requires / or a path such as /demo/');
}

function deviceLabel({ name, kind, state, id }) {
  return `${name} [${kind}, ${state}] (${id})`;
}

function openPreview(url) {
  const [command, ...args] = {
    win32: ['rundll32.exe', 'url.dll,FileProtocolHandler', url],
    darwin: ['open', url],
  }[process.platform] ?? ['xdg-open', url];
  const opener = spawn(command, args, { stdio: 'ignore', windowsHide: true });
  const warn = () => console.warn(`Could not open the default browser. Open ${url} manually.`);
  opener.once('error', warn);
  opener.once('exit', (code) => {
    if (code !== 0) warn();
  });
  opener.unref();
}

async function deploy(platform, app, device, options, signal) {
  let architecture = options.architecture?.toLowerCase();
  if (platform === 'android')
    architecture = androidDeviceArchitecture(androidAdb(), device.id, architecture);
  const simulator = device?.kind === 'simulator';
  if (platform === 'ios') {
    architecture ??= simulator ? iosSimulatorArchitecture() : 'arm64';
    if (architecture.endsWith('-sim') !== simulator)
      throw new Error('Choose arm64 for an iOS device or arm64-sim/x64-sim for a simulator');
  }
  const web = platform === 'web';
  const nativeTarget = web ? undefined : platformTarget(platform, architecture);
  const target = web ? 'web' : 'tauri';
  const nativeArgs = nativeTarget
    ? ['--platform', platform, '--architecture', nativeTarget.architecture]
    : [];
  const buildArgs = ['Nelyx/eng/build-sample.mjs', target, '--app', app, ...nativeArgs];
  const output = web
    ? `${app}/.nelyx/web`
    : `${app}/.nelyx/tauri/${platform}-${nativeTarget.architecture}`;
  const noLaunch = options['no-launch'];
  const runArgs = [
    `${app}/node_modules/@nelyx/cli/src/main.mjs`,
    'run',
    '--app',
    app,
    '--target',
    target,
    ...nativeArgs,
  ];
  if (web)
    runArgs.push(
      '--host',
      '127.0.0.1',
      '--port',
      options.port ?? '0',
      '--base',
      options.base ?? '/',
    );
  if (device) runArgs.push('--device', device.id, ...(noLaunch ? ['--no-launch'] : []));
  const boot = simulator && ['simctl', 'bootstatus', device.id, '-b'];
  const show = simulator &&
    !noLaunch && ['-a', 'Simulator', '--args', '-CurrentDeviceUDID', device.id];
  const buildOnly = platform === 'windows' && noLaunch;

  if (device) console.log(`Destination ${deviceLabel(device)}`);
  if (options['dry-run']) console.log(`Working directory ${root}`);
  console.log(`Output ${output}`);
  console.log(`> node ${buildArgs.join(' ')}`);
  if (options['dry-run']) {
    if (boot) console.log(`> xcrun ${boot.join(' ')}`);
    if (show) console.log(`> open ${show.join(' ')}`);
    if (!buildOnly) console.log(`> node ${runArgs.join(' ')}`);
    if (web && !noLaunch) console.log('Open the default browser after the preview starts');
    return 0;
  }

  const cwd = root;
  if (nativeTarget) inspectPlatform(nativeTarget);
  await withPublicationLock(root, () => execute(process.execPath, buildArgs, { cwd, signal }));
  if (buildOnly) return 0;
  if (boot) await execute('xcrun', boot, { cwd, signal, timeout: 180_000 });
  if (show) await execute('open', show, { cwd, signal });
  const runner = startOwnedCommand(process.execPath, runArgs, {
    cwd,
    signal,
    onStderrLine: web
      ? (line) => {
          if (!line.startsWith('{"event":"nelyx.preview.ready"')) return;
          const { url } = JSON.parse(line);
          console.log(`Preview ${url} (Ctrl+C to stop)`);
          if (!noLaunch && !signal.aborted) openPreview(url);
        }
      : undefined,
  });
  const result = await runner.completed;
  signal.throwIfAborted();
  if (result.error) throw new Error(result.error);
  return result.exitCode ?? 1;
}

async function main(signal) {
  const { values: options } = parseArgs({ args: process.argv.slice(2), options: cliOptions });
  if (options.help) {
    console.log(usage);
    return 0;
  }
  if (options.list && options['dry-run']) throw new Error('Choose either --list or --dry-run');
  const names = Object.keys(apps);
  const platform =
    optionName(options.platform, platforms, '--platform') ??
    (options.list ? undefined : await select(platforms, 'Platforms', '--platform', signal));
  const app =
    optionName(options.app, names, '--app') ??
    (options.list ? undefined : await select(names, 'Apps', '--app', signal));
  options.target = options.target.toLowerCase();
  validateOptions(platform, options);
  const devices =
    platform === 'android'
      ? androidTargets(options.target)
      : platform === 'ios'
        ? iosTargets(options.target)
        : [];
  const candidates =
    options.device === undefined
      ? devices
      : devices.filter(
          ({ id, udid }) =>
            id === options.device ||
            (platform === 'ios' &&
              [id, udid].some((value) => value?.toLowerCase() === options.device.toLowerCase())),
        );
  if (options.list) {
    console.log(`Platforms  ${platform ?? platforms.join(', ')}`);
    console.log(`Apps       ${app ?? names.join(', ')}`);
    if (mobile(platform)) {
      console.log('Destinations');
      if (!candidates.length) console.log('  (none)');
      for (const device of candidates) console.log(`  ${deviceLabel(device)}`);
    }
    return 0;
  }
  let device;
  if (mobile(platform)) {
    const available = candidates.filter(({ available }) => available);
    if (options.device && available.length !== 1)
      throw new Error(
        `Device ${options.device} is unavailable for ${options.target}. Check --list.`,
      );
    device = await select(available, 'Destinations', '--device', signal, deviceLabel);
  }
  return deploy(platform, apps[app], device, options, signal);
}

try {
  process.exitCode = await withSignals(main);
} catch (error) {
  console.error(error.message);
  process.exitCode = error.exitCode ?? 1;
}
