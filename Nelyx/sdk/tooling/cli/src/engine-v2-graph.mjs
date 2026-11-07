// SPDX-License-Identifier: BSD-3-Clause
import fs from 'node:fs';
import path from 'node:path';
import {
  isEngineV2DataImplementation,
  isEngineV2OriginalAppImplementation,
} from './engine-v2-data-api.mjs';

/** Inspect actual bundle inputs, including direct paths and a second package copy. */
export function inspectEngineV2Graph(inputs, coreDirectory, metadata = {}) {
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
  // SDK-owned image lifetime code needs these implementations in a Data App.
  // That does not admit direct user imports of the private owners or an old
  // host service. Inspect actual edges, including absolute/relative imports.
  for (const [source, entry] of Object.entries(metadata)) {
    if (!fs.existsSync(source)) continue;
    const sourceOwner = ownerOf(fs.realpathSync(source));
    if (['@nelyx/core', '@nelyx/sdk'].includes(sourceOwner?.name)) continue;
    for (const dependency of entry.imports ?? []) {
      if (dependency.external || !fs.existsSync(dependency.path)) continue;
      const absolute = fs.realpathSync(dependency.path),
        owner = ownerOf(absolute);
      if (!owner) continue;
      const implementation = path
        .relative(owner.directory, absolute)
        .replaceAll('\\', '/')
        .replace(/^(dist|src)\//, '')
        .replace(/\.ts$/, '.js');
      if (
        (owner.name === '@nelyx/core' &&
          (/^ui\/(?:immutable-buffer-binding|image-descriptor-binding|frame-resource-list-binding)\.js$/.test(
            implementation,
          ) ||
            implementation === 'hosting/images.js' ||
            (!originalApp && implementation === 'hosting/resources.js'))) ||
        (owner.name === '@nelyx/sdk' && implementation === 'runtime/engine-v2-images.js')
      )
        throw Error(
          'Engine v2 cannot import an App owner implementation from user code: ' +
            owner.name +
            '/' +
            implementation,
        );
    }
  }
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
        /^runtime\/engine-v2(?:-app|-assets|-buffers|-network|-images|-browser|-interaction|-original)?\.js$/.test(
          implementation,
        );
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
