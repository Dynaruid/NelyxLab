// SPDX-License-Identifier: BSD-3-Clause
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
const sha = (file) => createHash('sha256').update(fs.readFileSync(file)).digest('hex');
/** Compare the process's loaded images with the already verified package. */
export function verifyNativeLoadedIdentity(output, manifest) {
  const lines = output.split(/\r?\n/).filter((line) => line.startsWith('NELYX_NATIVE_IDENTITY '));
  if (lines.length !== 1) throw Error('Exactly one native loaded identity is required');
  let value;
  try {
    value = JSON.parse(lines[0].slice('NELYX_NATIVE_IDENTITY '.length));
  } catch {
    throw Error('Malformed native loaded identity');
  }
  if (
    !value ||
    value.nodeApiJsi !== false ||
    value.rnRuntime !== false ||
    !Number.isSafeInteger(value.modules) ||
    value.modules < 1
  )
    throw Error('Native loaded module independence is unverified');
  for (const [field, file] of [
    ['hostSha256', 'NelyxHermesHost.exe'],
    ['vmSha256', 'hermesvm.dll'],
    ['bundleSha256', manifest.bundle],
  ]) {
    const expected = manifest.files.filter((entry) => entry.path === file);
    if (
      expected.length !== 1 ||
      !/^[a-f0-9]{64}$/.test(expected[0].sha256) ||
      typeof value[field] !== 'string' ||
      !/^[a-f0-9]{64}$/.test(value[field]) ||
      value[field] !== expected[0].sha256
    )
      throw Error('Native loaded image differs from its package: ' + field);
  }
  return Object.freeze({
    hostSha256: value.hostSha256,
    vmSha256: value.vmSha256,
    bundleSha256: value.bundleSha256,
    modules: value.modules,
    nodeApiJsi: false,
    rnRuntime: false,
  });
}
/** A workspace probe also checks current code. Portable package verification
 * must run first; this extra check deliberately requires the actual app sources.
 * Generated entry/polyfills and asset contents are outside this code-only check. */
export function verifyNativeProductSources({ app, directory, mode }) {
  if (!['bytecode', 'static-aot'].includes(mode)) throw Error('Unknown native product mode');
  app = fs.realpathSync(app);
  const file = mode === 'bytecode' ? 'native-graph.json' : 'native-aot-execution.json',
    graph = JSON.parse(fs.readFileSync(path.join(directory, file), 'utf8'));
  if (
    graph.schema !==
      (mode === 'bytecode'
        ? 'nelyx.static-aot-runtime-inventory/v2'
        : 'nelyx.static-aot-execution-plan/v2') ||
    !Array.isArray(graph.modules) ||
    !graph.modules.length ||
    graph.modules.length > 32768
  )
    throw Error('Native source graph differs');
  const own = (relative) => {
    if (
      typeof relative !== 'string' ||
      !relative.length ||
      relative.includes('\\') ||
      relative.includes(':') ||
      relative.split('/').some((part) => !part || part === '.' || part === '..')
    )
      throw Error('Native source path escapes its app');
    const absolute = fs.realpathSync(path.resolve(app, relative)),
      rest = path.relative(app, absolute);
    if (!rest || rest === '..' || rest.startsWith('..' + path.sep) || path.isAbsolute(rest))
      throw Error('Native source path escapes its app');
    return absolute;
  };
  const entry = '.nelyx/native-windows/.build-' + mode + '/entry.ts',
    owners = new Map(),
    seen = new Set();
  let checked = 0,
    generated = 0,
    entries = 0,
    core = false;
  for (const module of graph.modules) {
    if (
      typeof module.id !== 'string' ||
      seen.has(module.id) ||
      !module.owner ||
      typeof module.owner.root !== 'string' ||
      !/^[a-f0-9]{64}$/.test(module.owner.manifestSha256) ||
      !/^[a-f0-9]{64}$/.test(module.sourceSha256)
    )
      throw Error('Native source identity is incomplete');
    seen.add(module.id);
    const manifest = module.owner.root ? module.owner.root + '/package.json' : 'package.json',
      previous = owners.get(manifest);
    if (previous && previous !== module.owner.manifestSha256)
      throw Error('Native package owner identities conflict');
    if (!previous) {
      if (sha(own(manifest)) !== module.owner.manifestSha256)
        throw Error('Rebuild the current native product: package manifest changed at ' + manifest);
      owners.set(manifest, module.owner.manifestSha256);
    }
    if (module.role === 'append' || module.role === 'prepend') {
      if (module.id.startsWith('generated/') && module.sourceFile?.startsWith('generated/')) {
        generated++;
        continue;
      }
    }
    // Binding native coverage retains original source hashes, but its execution
    // plan omits the inventory's sourceKind field.
    if (
      !['module', 'append', 'prepend'].includes(module.role) ||
      (module.sourceKind !== 'code' && !(mode === 'static-aot' && module.sourceKind === undefined))
    )
      throw Error('Unexpected native source role');
    if (module.id === entry && module.sourceFile === entry) {
      entries++;
      generated++;
      continue;
    }
    if (sha(own(module.sourceFile)) !== module.sourceSha256)
      throw Error('Rebuild the current native product: source changed at ' + module.sourceFile);
    if (module.owner.name === '@nelyx/core') core = true;
    checked++;
  }
  if (entries !== 1 || !checked || !core)
    throw Error('Native product source inventory is incomplete');
  return {
    scope: 'current-runtime-code-and-owner-manifests',
    modules: checked,
    owners: owners.size,
    generatedExcluded: generated,
  };
}
