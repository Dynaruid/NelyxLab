// SPDX-License-Identifier: BSD-3-Clause
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';

if (!process.argv[2]) throw new Error('Usage: pack-rnl.mjs <staging-directory>');
const staging = path.resolve(process.argv[2]);
const manifest = JSON.parse(fs.readFileSync(path.join(staging, 'source-manifest.json')));
const destination = path.join(staging, 'tarballs');
if (fs.existsSync(destination)) throw new Error('Refusing to overwrite supply tarballs');
fs.mkdirSync(destination);
const npm = process.platform === 'win32' ? ['cmd.exe', ['/d', '/c', 'npm.cmd']] : ['npm', []];
const packages = [];
for (const folder of manifest.upstream.packages) {
  const directory = path.join(staging, 'packages/@lucid-softworks', folder);
  const pkg = JSON.parse(fs.readFileSync(path.join(directory, 'package.json')));
  if (pkg.main.startsWith('lib/') && !fs.existsSync(path.join(directory, pkg.main)))
    throw new Error(`Build ${pkg.name} before packing`);
  const output = execFileSync(
    npm[0],
    [...npm[1], 'pack', '--json', '--ignore-scripts', '--pack-destination', destination],
    { cwd: directory, encoding: 'utf8' },
  );
  const item = JSON.parse(output)[0];
  const files = item.files.map((file) => file.path);
  for (const required of ['LICENSE', 'UPSTREAM.json', pkg.main]) {
    if (!files.includes(required)) throw new Error(`Missing ${required} in ${pkg.name}`);
  }
  if (folder === 'react-native-linux' && !files.includes('vnext/CMakeLists.txt'))
    throw new Error('Missing native runtime source');
  if (folder === 'react-native-linux') {
    for (const required of [
      'metro.js',
      'Libraries/Core/InitializeCore.js',
      'LICENSE_NELYX.md',
      'vnext/src/jsi/CoreRuntime.h',
      'Libraries/NativeComponent/BaseViewConfig.linux.js',
      'Libraries/Components/TextInput/TextInput.linux.tsx',
      'Libraries/Image/Image.linux.tsx',
      'vnext/src/views/TextInputEditing.inc',
    ])
      if (!files.includes(required))
        throw new Error(`Missing Linux bootstrap/license input: ${required}`);
  }
  if (folder === 'cli' && !files.includes('templates/linux/CMakeLists.txt'))
    throw new Error('Missing external consumer native template');
  packages.push({
    ...item,
    sha256: createHash('sha256')
      .update(fs.readFileSync(path.join(destination, item.filename)))
      .digest('hex'),
  });
}
fs.writeFileSync(
  path.join(destination, 'supply.json'),
  JSON.stringify(
    {
      schema: 'nelyx.rnl-tarballs/v1',
      upstreamCommit: manifest.upstream.commit,
      sourceTreeSha256: manifest.sourceTreeSha256,
      packages,
      nativeBuild: 'notVerified',
      nativeRuntime: 'notVerified',
    },
    null,
    2,
  ) + '\n',
);
console.log(
  JSON.stringify({
    destination,
    packages: packages.map(({ name, filename, sha256 }) => ({ name, filename, sha256 })),
  }),
);
