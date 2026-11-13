// SPDX-License-Identifier: BSD-3-Clause
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execute } from './commands.mjs';
import { sha256, localFile } from './files.mjs';
import { nativeHermesSourceTree } from './windows-native-hermes-source.mjs';
import { windowsNativeHermesPin } from './windows-native-hermes-pin.mjs';

const pin = windowsNativeHermesPin.icu;
const libraries = pin.files.filter((file) => file.path.startsWith('bin64/'));
export const windowsNativeIcuRuntimeFiles = Object.freeze(
  libraries.map((file) => path.posix.basename(file.path)),
);
export function verifyWindowsNativeIcu(directory) {
  directory = path.resolve(directory);
  if (sha256(localFile(directory, pin.archive)) !== pin.archiveSha256)
    throw Error('Native Hermes ICU archive differs from the official release');
  const icu = path.join(directory, 'icu');
  if (fs.realpathSync(icu) !== icu) throw Error('Native Hermes ICU directory is a link');
  for (const file of pin.files)
    if (sha256(localFile(icu, file.path)) !== file.sha256)
      throw Error('Native Hermes ICU input differs: ' + file.path);
  if (nativeHermesSourceTree(path.join(icu, 'include')) !== pin.includeSha256)
    throw Error('Native Hermes ICU headers differ');
  return icu;
}
export function copyWindowsNativeIcuRuntime(directory, output) {
  fs.mkdirSync(output, { recursive: true });
  for (const file of libraries) {
    const source = localFile(path.join(directory, 'icu'), file.path);
    if (sha256(source) !== file.sha256) throw Error('Native Hermes ICU runtime differs');
    fs.copyFileSync(source, path.join(output, path.posix.basename(file.path)));
  }
}
export async function prepareWindowsNativeIcu(directory, { env, signal } = {}) {
  const archive = path.join(directory, pin.archive);
  if (!fs.existsSync(archive)) {
    const response = await fetch(pin.url, {
      signal: signal
        ? AbortSignal.any([signal, AbortSignal.timeout(120000)])
        : AbortSignal.timeout(120000),
    });
    if (!response.ok) throw Error('Native Hermes ICU HTTP ' + response.status);
    const bytes = Buffer.from(await response.arrayBuffer());
    if (createHash('sha256').update(bytes).digest('hex') !== pin.archiveSha256)
      throw Error('Native Hermes ICU download differs from the official asset digest');
    fs.writeFileSync(archive, bytes);
  }
  if (sha256(localFile(directory, pin.archive)) !== pin.archiveSha256)
    throw Error('Native Hermes ICU archive differs');
  const icu = path.join(directory, 'icu');
  if (!fs.existsSync(path.join(icu, 'include/unicode/dtptngen.h'))) {
    fs.mkdirSync(icu, { recursive: true });
    if (fs.realpathSync(icu) !== icu) throw Error('Native Hermes ICU directory is a link');
    await execute('tar.exe', ['-xf', archive, '-C', icu], { env, signal, timeout: 1200000 });
  }
  verifyWindowsNativeIcu(directory);
  // The compiler is invoked during the VM build; both executables need ICU.
  for (const folder of ['build/bin', 'build/lib'])
    copyWindowsNativeIcuRuntime(directory, path.join(directory, folder));
  return icu;
}
