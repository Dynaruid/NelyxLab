// SPDX-License-Identifier: BSD-3-Clause
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repository = path.resolve(import.meta.dirname, '../../..');
const sdkInputs = [
  'vendor/artifacts.lock.json',
  'vendor/windows-rn-supplier.lock.json',
  'vendor/linux-graphite-probe.lock.json',
  'eng/prepare-artifacts.py',
  'eng/source-build/prepare-rn-modules.py',
  'eng/source-build/rn-modules.cmake',
  'eng/source-build/libwebp.lock.json',
];
/** Compare only the canonical sources derived by prepare-native. Installed
 * vendor binaries and platform qualification have their own admission guards. */
export function verifyNativeSourceInputs(directory, workspace = repository) {
  const owner = fs.realpathSync(directory),
    manifest = JSON.parse(fs.readFileSync(path.join(owner, 'package.json'), 'utf8'));
  if (!['@nelyx/skia-native', '@nelyx/skia-rn'].includes(manifest.name)) return null;
  const rn = manifest.name === '@nelyx/skia-rn',
    skia = path.join(fs.realpathSync(workspace), 'Nelyx/skia'),
    canonical = path.join(skia, 'native');
  const fail = (message) => {
    throw Error('Prepare ' + manifest.name + ' native sources before supply: ' + message);
  };
  const files = (folder, skip = new Set(), prefix = '') => {
    if (
      !fs.existsSync(folder) ||
      !fs.lstatSync(folder).isDirectory() ||
      fs.lstatSync(folder).isSymbolicLink()
    )
      fail('source directory absent or linked: ' + folder);
    const values = [];
    for (const entry of fs.readdirSync(folder, { withFileTypes: true })) {
      const relative = prefix + entry.name;
      if (skip.has(relative)) continue;
      if (entry.isSymbolicLink()) fail('native source is linked: ' + path.join(folder, entry.name));
      if (entry.isDirectory())
        values.push(...files(path.join(folder, entry.name), skip, relative + '/'));
      else values.push(relative);
    }
    return values;
  };
  let checked = 0;
  const compare = (source, target) => {
    if (
      !fs.existsSync(target) ||
      !fs.lstatSync(target).isFile() ||
      fs.lstatSync(target).isSymbolicLink() ||
      !fs.readFileSync(source).equals(fs.readFileSync(target))
    )
      fail('canonical source differs or is absent: ' + path.relative(owner, target));
    checked++;
  };
  for (const [source, target, extra] of [
    ['core', 'generated/core'],
    ['host', 'generated/host'],
    ['rendering/nelyx_skia', 'generated/gpu/nelyx_skia'],
    ['platforms/vulkan', 'generated/vulkan'],
    ['adapters/jsi/cpp', rn ? 'generated/jsi' : 'cpp', rn ? ['engine.cmake'] : []],
    ['adapters/jsi/vulkan', rn ? 'generated/native-vulkan' : 'native/vulkan', rn ? [] : ['sdk']],
  ]) {
    const from = path.join(canonical, source),
      to = path.join(owner, target),
      inputs = files(from).sort(),
      outputs = files(to, new Set(extra)).sort();
    if (inputs.length !== outputs.length || inputs.some((value, index) => value !== outputs[index]))
      fail('native source inventory differs: ' + target);
    for (const relative of inputs) compare(path.join(from, relative), path.join(to, relative));
  }
  compare(
    path.join(canonical, 'adapters/jsi/engine.cmake'),
    path.join(owner, rn ? 'generated/jsi/engine.cmake' : 'native/jsi/engine.cmake'),
  );
  for (const relative of sdkInputs)
    compare(path.join(skia, relative), path.join(owner, 'native/vulkan/sdk', relative));
  return { package: manifest.name, files: checked, scope: 'current-canonical-native-inputs' };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    if (process.argv.length !== 3) throw Error('Choose the native or RN package directory');
    console.log(JSON.stringify(verifyNativeSourceInputs(process.argv[2])));
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
