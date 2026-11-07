// SPDX-License-Identifier: BSD-3-Clause
import fs from 'node:fs';
import path from 'node:path';
import { engineRoot, sourceIdentity, run } from './build.mjs';
import { androidSdk, buildAndroidSupply } from './build-android.mjs';
const development = process.argv.includes('--dev');
const options = Object.fromEntries(
  process.argv
    .slice(2)
    .filter((value) => value !== '--dev')
    .map((value) => {
      const match = /^--(device|architecture|android-sdk)=(.+)$/.exec(value);
      if (!match)
        throw Error('Expected --device=<serial>, --architecture=<abi> or --android-sdk=<path>');
      return [match[1], match[2]];
    }),
);
const sdk = androidSdk(options['android-sdk']),
  adb = path.join(sdk, 'platform-tools', process.platform === 'win32' ? 'adb.exe' : 'adb');
const ready = run(adb, ['devices'])
  .split(/\r?\n/)
  .flatMap((line) => /^([^\s]+)\s+device$/.exec(line)?.[1] ?? []);
const device = options.device ?? (ready.length === 1 ? ready[0] : undefined);
if (!device || !ready.includes(device))
  throw Error('Start an Android emulator or select a ready device with --device=<serial>');
const abi =
  options.architecture ??
  (run(adb, ['-s', device, 'shell', 'getprop', 'ro.product.cpu.abilist'])
    .split(',')
    .includes('x86_64')
    ? 'x86_64'
    : 'arm64-v8a');
const supply = path.join(engineRoot, 'dist-android');
let current = false;
if (fs.existsSync(path.join(supply, 'engine-manifest.json'))) {
  const manifest = JSON.parse(fs.readFileSync(path.join(supply, 'engine-manifest.json')));
  current =
    manifest.sourceSha256 === sourceIdentity() && manifest.profiles?.android?.abis.includes(abi);
}
if (!current) await buildAndroidSupply({ sdk });
// The build may also replace Core's protocol declarations. Load the CLI only
// after promotion so a normal source run cannot retain the previous schema.
const { engineV2Operation, verifyEngineV2Supply } =
  await import('../../sdk/tooling/cli/src/engine-v2-runner.mjs');
verifyEngineV2Supply(supply, 'android');
const app = path.resolve(engineRoot, '../../sample/nelyx-engine-v2-android');
if (development) {
  const result = await engineV2Operation('dev', {
    app,
    target: 'android',
    architecture: abi,
    device,
    androidSdk: sdk,
  });
  console.log(JSON.stringify(result, null, 2));
  process.exitCode = result.exitCode;
} else {
  console.log(
    JSON.stringify(
      await engineV2Operation('build', {
        app,
        target: 'android',
        architecture: abi,
        androidSdk: sdk,
      }),
      null,
      2,
    ),
  );
  console.log(
    JSON.stringify(
      await engineV2Operation('run', { app, target: 'android', device, androidSdk: sdk }),
      null,
      2,
    ),
  );
}
