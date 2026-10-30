// SPDX-License-Identifier: BSD-3-Clause
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
const load = createRequire(import.meta.url),
  header = path.join(
    path.dirname(load.resolve('@nelyx/sdk/package.json')),
    'native/windows/RnwJsiPal.h',
  );
const owned = fs.readFileSync(header, 'utf8');
export const rnwJsiPalSource = /rnwJsiPalSource=R"JS\(([\s\S]*?)\)JS";/.exec(owned)?.[1];
export const rnwJsiPalSha256 = /rnwJsiPalSha256="([a-f0-9]{64})"/.exec(owned)?.[1];
if (
  !rnwJsiPalSource ||
  createHash('sha256').update(rnwJsiPalSource).digest('hex') !== rnwJsiPalSha256
)
  throw Error('Owned RNW native JSI manager source differs');
export function inspectRnwJsiPal(runner) {
  const resolve = createRequire(path.join(runner, 'package.json')),
    root = path.dirname(resolve.resolve('react-native-windows/package.json'));
  if (JSON.parse(fs.readFileSync(path.join(root, 'package.json'))).version !== '0.83.2')
    throw Error('Native JSI manager requires RNW0.83.2');
  const file = path.join(root, 'Microsoft.ReactNative/JsiApi.cpp'),
    bytes = fs.readFileSync(file),
    text = bytes.toString('utf8').replaceAll('\r\n', '\n'),
    match = /auto jsiPalBuffer = [\s\S]*?R"JS\(([\s\S]*?)\)JS"\);/.exec(text);
  if (match?.[1] !== rnwJsiPalSource)
    throw Error('Installed RNW JSI manager differs from the native source');
  return {
    unit: 'nelyx_rnw_pal',
    input: 'Bundle/index.windows.rnw-pal.js',
    source: rnwJsiPalSource,
    sourceSha256: rnwJsiPalSha256,
    sourceFile: path.relative(path.resolve(runner, '../..'), file).replaceAll('\\', '/'),
    owner: {
      name: 'react-native-windows',
      version: '0.83.2',
      license: 'MIT',
      manifestSha256: createHash('sha256')
        .update(fs.readFileSync(path.join(root, 'package.json')))
        .digest('hex'),
      root: path.relative(path.resolve(runner, '../..'), root).replaceAll('\\', '/'),
    },
    originalSha256: createHash('sha256').update(bytes).digest('hex'),
    line: text.slice(0, match.index + match[0].indexOf(match[1])).split('\n').length,
  };
}
