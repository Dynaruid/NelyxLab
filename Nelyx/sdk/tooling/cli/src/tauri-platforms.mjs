// SPDX-License-Identifier: BSD-3-Clause
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { capture, execute } from './commands.mjs';
import { inspectMsvc, inspectWebView2 } from './windows-tauri-prerequisites.mjs';

export const platforms = ['windows', 'android', 'linux', 'macos', 'ios'];
const targets = {
  windows: { x64: ['x86_64-pc-windows-msvc'] },
  linux: { x64: ['x86_64-unknown-linux-gnu'], arm64: ['aarch64-unknown-linux-gnu'] },
  macos: { arm64: ['aarch64-apple-darwin'], x64: ['x86_64-apple-darwin'] },
  android: { arm64: ['aarch64-linux-android', 'aarch64'], x64: ['x86_64-linux-android', 'x86_64'] },
  ios: {
    arm64: ['aarch64-apple-ios', 'aarch64'],
    'arm64-sim': ['aarch64-apple-ios-sim', 'aarch64-sim'],
    'x64-sim': ['x86_64-apple-ios', 'x86_64'],
  },
};
export const mobile = (platform) => platform === 'android' || platform === 'ios';

export function platformTarget(platform, architecture) {
  const host = { windows: 'win32', macos: 'darwin', ios: 'darwin', linux: 'linux' }[platform];
  if (host && host !== process.platform)
    throw new Error(
      `Tauri ${platform} requires a ${host === 'darwin' ? 'macOS' : platform} build host`,
    );
  architecture ??= {
    windows: 'x64',
    android: 'arm64',
    linux: process.arch,
    macos: 'arm64',
    ios: process.arch + '-sim',
  }[platform];
  const [rust, cli = rust] = targets[platform]?.[architecture] ?? [];
  if (!rust)
    throw new Error(
      `Choose a ${platform} architecture: ${Object.keys(targets[platform]).join(', ')}`,
    );
  return { platform, architecture, rust, cli };
}

export function inspectTauriCli(app) {
  const packageFile = path.join(app, 'package.json');
  const config = JSON.parse(fs.readFileSync(packageFile, 'utf8'));
  const load = createRequire(packageFile);
  const name = '@tauri-apps/cli';
  const version = '2.12.6';
  try {
    const declared = config.devDependencies?.[name] ?? config.dependencies?.[name];
    const installed = JSON.parse(fs.readFileSync(load.resolve(name + '/package.json'), 'utf8'));
    if (declared !== version || installed.version !== version)
      throw new Error(`declared ${declared ?? 'none'}, installed ${installed.version}`);
    const entry = load.resolve(name + '/tauri.js');
    const reported = capture(process.execPath, [entry, '--version'], { cwd: app }).trim();
    if (reported !== 'tauri-cli ' + version) throw new Error(reported);
    return { entry, version };
  } catch (error) {
    const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
    throw new Error(
      `${error.message}. In the app root run ${npm} install --save-dev --save-exact ${name}@${version}`,
      { cause: error },
    );
  }
}

export function inspectRust(app, target) {
  const options = { cwd: app };
  const rustc = capture('rustc', ['--version'], options).trim();
  const cargo = capture('cargo', ['--version'], options).trim();
  const libraries = capture(
    'rustc',
    ['--print', 'target-libdir', '--target', target],
    options,
  ).trim();
  if (
    !fs.existsSync(libraries) ||
    !fs.readdirSync(libraries).some((entry) => /^libstd-.*\.rlib$/.test(entry))
  )
    throw new Error('Install the Rust target with rustup target add ' + target);
  return { rustc, cargo, target };
}

export function androidTools() {
  const sdk = process.env.ANDROID_HOME ?? process.env.ANDROID_SDK_ROOT;
  const ndk = process.env.NDK_HOME ?? process.env.ANDROID_NDK_HOME;
  if (!sdk || !ndk || !fs.existsSync(path.join(ndk, 'source.properties')))
    throw new Error('Set ANDROID_HOME and NDK_HOME to installed Android SDK/NDK directories');
  const java = process.env.JAVA_HOME;
  if (!java) throw new Error('Set JAVA_HOME to a JDK supported by the generated project');
  const exe = process.platform === 'win32' ? '.exe' : '';
  const adb = path.join(sdk, 'platform-tools', 'adb' + exe);
  const javaVersion = capture(path.join(java, 'bin', 'java' + exe), ['--version'], {
    timeout: 5000,
  });
  if (!fs.existsSync(adb)) throw new Error('Install Android platform-tools in ' + sdk);
  return { sdk, ndk, java, adb, javaVersion: javaVersion.trim() };
}

export function inspectPlatform(target) {
  if (target.platform === 'windows') return { msvc: inspectMsvc(), webview2: inspectWebView2() };
  if (target.platform === 'android') return androidTools();
  if (target.platform === 'linux') {
    const webkit = capture('pkg-config', ['--modversion', 'webkit2gtk-4.1']).trim();
    const gtk = capture('pkg-config', ['--modversion', 'gtk+-3.0']).trim();
    return { webkit, gtk };
  }
  return { xcode: capture('xcodebuild', ['-version']).trim() };
}

function androidDevices(adb) {
  return capture(adb, ['devices', '-l'])
    .split(/\r?\n/)
    .map((line) => /^(\S+)\s+device(?:\s|$)/.exec(line)?.[1])
    .filter(Boolean);
}

export function selectAndroidDevice(adb, requested) {
  const devices = androidDevices(adb);
  if (requested && devices.includes(requested)) return requested;
  if (!requested && devices.length === 1) return devices[0];
  throw new Error(
    `Choose an online adb device with --device <serial>. Found: ${devices.join(', ') || 'none'}`,
  );
}

export function androidDevDevice(adb, serial) {
  // Tauri's dev selector matches the AVD or phone name. adb reverse uses the serial.
  const read = (device, args) => capture(adb, ['-s', device, ...args], { timeout: 5000 });
  const nameOf = (device) => {
    let name;
    try {
      name = device.startsWith('emulator-')
        ? read(device, ['emu', 'avd', 'name']).split(/\r?\n/)[0].trim()
        : /\bname: ([^\r\n]+)/.exec(read(device, ['shell', 'dumpsys', 'bluetooth_manager']))?.[1];
    } catch {
      // The model is also Tauri's fallback when the device name cannot be queried.
    }
    return name || read(device, ['shell', 'getprop', 'ro.product.model']).trim();
  };
  const name = nameOf(serial);
  if (!name || androidDevices(adb).some((device) => device !== serial && nameOf(device) === name))
    throw new Error('Tauri dev requires a unique device name for adb serial ' + serial);
  return name;
}

export function iosDevSimulator(requested) {
  const { devices } = JSON.parse(
    capture('xcrun', ['simctl', 'list', 'devices', 'available', '--json']),
  );
  const simulators = Object.entries(devices)
    .filter(([runtime]) => runtime.startsWith('com.apple.CoreSimulator.SimRuntime.iOS-'))
    .flatMap(([, values]) => values);
  const booted = simulators.filter(({ state }) => state === 'Booted');
  const selection = requested
    ? simulators.filter(({ udid, name }) => udid === requested || name === requested)
    : booted.length
      ? booted
      : simulators;
  if (
    selection.length === 1 &&
    simulators.filter(({ name }) => name === selection[0].name).length === 1
  )
    return selection[0].name;
  throw new Error('Choose a uniquely named iOS simulator with --device, or boot one in Xcode');
}

export async function reversePort(adb, device, port, signal) {
  const address = 'tcp:' + port;
  const existing = capture(adb, ['-s', device, 'reverse', '--list'])
    .split(/\r?\n/)
    .map((line) => line.trim().split(/\s+/).slice(-2))
    .find(([remote]) => remote === address);
  if (existing && existing[1] !== address)
    throw new Error('adb reverse port is already in use: ' + address);
  if (existing) return () => {};
  await execute(adb, ['-s', device, 'reverse', '--no-rebind', address, address], {
    signal,
    timeout: 20_000,
  });
  return () => capture(adb, ['-s', device, 'reverse', '--remove', address], { timeout: 20_000 });
}
