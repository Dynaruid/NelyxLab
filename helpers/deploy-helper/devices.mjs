// SPDX-License-Identifier: BSD-3-Clause
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { capture } from '../../Nelyx/sdk/tooling/cli/src/commands.mjs';
import { removeDirectory } from '../../Nelyx/sdk/tooling/cli/src/publication.mjs';
import {
  androidAdb,
  listAndroidDevices,
} from '../../Nelyx/sdk/tooling/cli/src/tauri-platforms.mjs';

export function androidTargets(target) {
  const adb = androidAdb();
  return listAndroidDevices(adb)
    .map(({ serial, name, state }) => {
      const available = state === 'device';
      let emulator = serial.startsWith('emulator-');
      if (!emulator && available && serial.includes(':')) {
        emulator =
          capture(adb, ['-s', serial, 'shell', 'getprop', 'ro.kernel.qemu'], {
            timeout: 5000,
          }).trim() === '1';
      }
      const kind = emulator ? 'emulator' : 'device';
      return { id: serial, name, state: available ? 'online' : state, available, kind };
    })
    .filter(({ kind }) => target === 'auto' || target === kind);
}

function physicalIosTargets() {
  const parent = fs.realpathSync(os.tmpdir());
  const directory = fs.mkdtempSync(path.join(parent, 'nelyx-ios-'));
  const file = path.join(directory, 'devices.json');
  try {
    capture('xcrun', ['devicectl', 'list', 'devices', '--timeout', '30', '--json-output', file]);
    const { info, result } = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (info?.outcome !== 'success' || !Array.isArray(result?.devices))
      throw new Error('devicectl did not return an iOS device list');
    return result.devices.flatMap((device) => {
      const hardware = device.properties?.hardware ?? device.hardwareProperties;
      if (hardware?.platform !== 'iOS' || hardware.reality !== 'physical' || !hardware.udid)
        return [];
      const connection = device.properties?.connection ?? device.connectionProperties;
      const properties = device.properties?.state ?? device.deviceProperties;
      const state = connection?.state ?? connection?.tunnelState ?? 'unknown';
      return [
        {
          id: device.identifier ?? hardware.udid,
          udid: hardware.udid,
          name: properties?.name ?? hardware.marketingName ?? 'iPhone/iPad',
          kind: 'device',
          state,
          available: !['disconnected', 'unavailable'].includes(state),
        },
      ];
    });
  } finally {
    removeDirectory(directory, parent);
  }
}

function iosSimulators() {
  const { devices } = JSON.parse(
    capture('xcrun', ['simctl', 'list', 'devices', 'available', '-j']),
  );
  const prefix = 'com.apple.CoreSimulator.SimRuntime.iOS-';
  return Object.entries(devices)
    .filter(([runtime]) => runtime.startsWith(prefix))
    .flatMap(([runtime, sims]) => {
      const version = runtime.slice(prefix.length).replaceAll('-', '.');
      return sims
        .filter(({ isAvailable }) => isAvailable)
        .map(({ udid, name, state }) => ({
          id: udid,
          udid,
          name: `${name} (iOS ${version})`,
          kind: 'simulator',
          state,
          available: true,
        }));
    });
}

export function iosTargets(target) {
  if (process.platform !== 'darwin') throw new Error('iOS deployment requires macOS with Xcode');
  if (target === 'simulator') return iosSimulators();
  if (target === 'device') return physicalIosTargets();
  const devices = [];
  for (const discover of [physicalIosTargets, iosSimulators]) {
    try {
      devices.push(...discover());
    } catch (error) {
      console.warn(error.message);
    }
  }
  return devices;
}

export function iosSimulatorArchitecture() {
  try {
    return capture('sysctl', ['-n', 'hw.optional.arm64']).trim() === '1' ? 'arm64-sim' : 'x64-sim';
  } catch {
    return process.arch + '-sim';
  }
}
