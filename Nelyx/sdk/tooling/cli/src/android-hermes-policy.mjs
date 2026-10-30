// SPDX-License-Identifier: BSD-3-Clause
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
// Current Android supplier only. Windows-host compiler5cba2482 / Android x86_64 direct Cubic
// hangs under -O and returns under -Og. This is no all-Hermes or performance qualification.
const revision = '5a1485fd688eafdf40637f4f2f44ec830f099b80',
  id = 'android-5a1485-Og';
const sha = (file) => createHash('sha256').update(fs.readFileSync(file)).digest('hex');
export function androidHermesPolicy(cohort) {
  if (
    cohort?.engine !== 'hermes' ||
    cohort.engineVersion !== '0.14.1' ||
    cohort.engineRevision !== revision ||
    cohort.bytecodeVersion !== 96
  )
    throw Error('Android Hermes supplier needs separate compiler-policy qualification');
  return Object.freeze({ id, flags: Object.freeze(['-Og', '-output-source-map']) });
}
export function prepareAndroidHermesBuild(app, cohort) {
  const policy = androidHermesPolicy(cohort),
    gradle = path.join(app, 'android/app/build.gradle'),
    source = fs.readFileSync(gradle, 'utf8');
  if (
    !/^\s*hermesFlags\s*=\s*\[\s*["']-Og["']\s*,\s*["']-output-source-map["']\s*\]\s*$/m.test(
      source,
    )
  )
    throw Error(
      'Android app must set qualified hermesFlags = ["-Og", "-output-source-map"]; update from the current template',
    );
  const report = path.join(app, 'android/app/build/outputs/nelyx/hermes-policy.json');
  fs.rmSync(report, { force: true });
  const compilerRoot = path.join(app, 'android/runner/node_modules/hermes-compiler'),
    compilerPackage = JSON.parse(fs.readFileSync(path.join(compilerRoot, 'package.json'), 'utf8'));
  if (compilerPackage.version !== cohort.engineVersion)
    throw Error('Android compiler package differs from the selected supplier');
  const platform =
    process.platform === 'win32'
      ? 'win64-bin'
      : process.platform === 'darwin'
        ? 'osx-bin'
        : process.platform === 'linux'
          ? 'linux64-bin'
          : null;
  if (platform === null) throw Error('Android compiler host is not supported');
  const compiler = path.join(
    compilerRoot,
    'hermesc',
    platform,
    'hermesc' + (process.platform === 'win32' ? '.exe' : ''),
  );
  return Object.freeze({
    policy,
    gradle,
    gradleSha256: sha(gradle),
    compiler,
    compilerSha256: sha(compiler),
    report,
  });
}
export function finishAndroidHermesBuild(input) {
  if (sha(input.gradle) !== input.gradleSha256 || sha(input.compiler) !== input.compilerSha256)
    throw Error('Android producer inputs changed during build');
  if (!fs.existsSync(input.report))
    throw Error(
      'Android Gradle must emit a fresh Hermes policy acknowledgement; update the app from the current template',
    );
  const report = JSON.parse(fs.readFileSync(input.report, 'utf8'));
  if (
    report.schema !== 'nelyx.android-hermes-policy/v1' ||
    report.hermesEnabled !== true ||
    report.hermesCommand !== '' ||
    JSON.stringify(report.flags) !== JSON.stringify(input.policy.flags)
  )
    throw Error(
      'Android Gradle Hermes configuration differs from qualified flags/default supplier',
    );
  return Object.freeze({
    hermesCompilerFlags: '-Og',
    hermesCompilerPolicy: input.policy.id,
    hermesCompilerSha256: input.compilerSha256,
    hermesGradleSha256: input.gradleSha256,
  });
}
export function verifyAndroidHermesDetails(cohort, details, report) {
  const policy = androidHermesPolicy(cohort);
  if (
    details?.hermesCompilerFlags !== '-Og' ||
    details.hermesCompilerPolicy !== policy.id ||
    !/^[a-f0-9]{64}$/.test(details.hermesCompilerSha256 ?? '') ||
    !/^[a-f0-9]{64}$/.test(details.hermesGradleSha256 ?? '')
  )
    throw Error('Android package lacks the qualified Hermes compiler policy; rebuild it');
  if (
    report?.schema !== 'nelyx.android-hermes-policy/v1' ||
    report.hermesEnabled !== true ||
    report.hermesCommand !== '' ||
    JSON.stringify(report.flags) !== JSON.stringify(policy.flags)
  )
    throw Error('Android package Hermes acknowledgement differs from qualified policy');
}
