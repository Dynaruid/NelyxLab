// SPDX-License-Identifier: BSD-3-Clause
import fs from 'node:fs';
import path from 'node:path';
import { fingerprint } from './build-cache.mjs';
import { sha256 } from '@nelyx/tooling-contracts/node-files';

const generated = new Set(['.git', '.nelyx', 'node_modules', 'dist', 'backend', 'platform']);
const defaultConfig =
  /^(?:\/\/[^\n]*\s*)*import\s*\{\s*defineAppConfig\s*\}\s*from\s*['"]@nelyx\/vite\/config['"];?\s*export\s+default\s+defineAppConfig\(import\.meta\.dirname\);?\s*$/;
const unix = (file) => file.replaceAll('\\', '/');

/** Only the standard config and a fully owned Vite graph can reuse a release. */
export function frontendInputs(value, target, project, contract, environment) {
  const { app } = value;
  if (!defaultConfig.test(fs.readFileSync(path.join(app, 'vite.config.ts'), 'utf8'))) return;
  const files = [];
  function visit(directory) {
    for (const item of fs.readdirSync(directory, { withFileTypes: true })) {
      if (generated.has(item.name)) continue;
      const file = path.join(directory, item.name);
      if (item.isSymbolicLink()) throw Error('External frontend input');
      if (item.isDirectory()) visit(file);
      else if (item.isFile()) files.push([unix(path.relative(app, file)), sha256(file)]);
    }
  }
  try {
    visit(app);
  } catch {
    return;
  }
  files.sort(([a], [b]) => a.localeCompare(b));
  environment ??= Object.entries(process.env)
    .filter(([name]) => /^(?:VITE_|NODE_ENV$|BROWSERSLIST|SOURCE_DATE_EPOCH$)/i.test(name))
    .sort();
  const primary = fingerprint([
    value,
    target,
    contract,
    project.toolchain,
    [...(project.files ?? [])].map(([name, bytes]) => [
      name,
      fingerprint(bytes.toString('base64')),
    ]),
    process.platform,
    process.arch,
    process.version,
    environment,
    files,
  ]);
  function ownedDependencies(entries) {
    const result = new Set();
    for (const id of entries) {
      if (!id || id.startsWith('\0')) continue;
      const file = id.split('?')[0];
      if (!path.isAbsolute(file)) return;
      const relative = unix(path.relative(app, file));
      if (!relative || relative.startsWith('../') || path.isAbsolute(relative)) return;
      try {
        if (
          path.relative(path.resolve(file), fs.realpathSync(file)) !== '' ||
          !fs.statSync(file).isFile()
        )
          return;
      } catch {
        return;
      }
      result.add(relative);
    }
    return [...result].sort();
  }
  function key(dependencies) {
    if (!Array.isArray(dependencies)) return;
    try {
      return fingerprint([
        primary,
        dependencies.map((relative) => {
          const file = path.resolve(app, relative);
          if (!ownedDependencies([file])) throw Error('Vite dependency is no longer local');
          return [relative, sha256(file)];
        }),
      ]);
    } catch {
      return;
    }
  }
  return { primary, environment, ownedDependencies, key };
}
