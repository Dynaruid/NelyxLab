// SPDX-License-Identifier: BSD-3-Clause
import fs from 'node:fs';
import path from 'node:path';
import {
  isEngineV2DataImplementation,
  isEngineV2OriginalAppImplementation,
} from './engine-v2-data-api.mjs';

/** Inspect actual bundle inputs, including direct paths and a second package copy. */
export function inspectEngineV2Graph(inputs, coreDirectory) {
  const cache = new Map(),
    counts = {};
  const ownerOf = (file) => {
    let directory = path.dirname(file);
    const visited = [];
    let owner;
    for (;;) {
      if (cache.has(directory)) {
        owner = cache.get(directory);
        break;
      }
      visited.push(directory);
      const manifest = path.join(directory, 'package.json');
      if (fs.existsSync(manifest)) {
        owner = { directory, name: JSON.parse(fs.readFileSync(manifest, 'utf8')).name };
        break;
      }
      const parent = path.dirname(directory);
      if (parent === directory) break;
      directory = parent;
    }
    for (const directory of visited) cache.set(directory, owner);
    return owner;
  };
  const originalApp = inputs.some((source) => {
    if (!fs.existsSync(source)) return false;
    const absolute = fs.realpathSync(source),
      owner = ownerOf(absolute);
    return (
      owner?.name === '@nelyx/sdk' &&
      /^((dist|src)\/runtime\/engine-v2-original\.(js|ts))$/.test(
        path.relative(owner.directory, absolute).replaceAll('\\', '/'),
      )
    );
  });
  let canonicalAppInputs = 0;
  for (const source of inputs) {
    if (!fs.existsSync(source)) continue; // esbuild's synthetic stdin has no file.
    const absolute = fs.realpathSync(source),
      owner = ownerOf(absolute);
    if (!['@nelyx/core', '@nelyx/material', '@nelyx/cupertino', '@nelyx/sdk'].includes(owner?.name))
      continue;
    const relative = path.relative(owner.directory, absolute).replaceAll('\\', '/'),
      implementation = relative.replace(/^(dist|src)\//, '').replace(/\.ts$/, '.js');
    let allowed;
    if (owner.name === '@nelyx/core') {
      if (owner.directory !== fs.realpathSync(coreDirectory))
        throw Error('Foreign Core package identity in engine v2 bundle');
      allowed =
        relative.startsWith('dist/v2/') ||
        relative.startsWith('runtime/engine-client/') ||
        isEngineV2DataImplementation(implementation) ||
        (originalApp && isEngineV2OriginalAppImplementation(implementation));
      if (
        allowed &&
        originalApp &&
        isEngineV2OriginalAppImplementation(implementation) &&
        !isEngineV2DataImplementation(implementation)
      )
        ++canonicalAppInputs;
    } else if (owner.name === '@nelyx/sdk') {
      allowed =
        implementation === 'backends/browser/platform.js' ||
        /^runtime\/engine-v2(?:-app|-browser|-interaction|-original)?\.js$/.test(implementation);
    } else {
      allowed =
        implementation === 'v2.js' ||
        originalApp ||
        (owner.name === '@nelyx/material' &&
          /^(colors|material-color|generated\/colors\/colors.generated)\.js$/.test(implementation));
    }
    if (!allowed)
      throw Error(
        `Engine v2 cannot import an unported implementation: ${owner.name}/${implementation}`,
      );
    counts[owner.name] = (counts[owner.name] ?? 0) + 1;
  }
  return Object.freeze({
    fallbackPolicy: 'reject-unported',
    appModel: originalApp ? 'original-elements' : 'v2-widgets',
    canonicalAppInputs,
    packageInputs: Object.freeze(counts),
  });
}
