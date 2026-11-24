// SPDX-License-Identifier: BSD-3-Clause
import fs from 'node:fs';
import path from 'node:path';
import { x as extract } from 'tar';
import {
  backendCrates,
  backendHash,
  backendPackages,
  rustInputFiles,
  verifyBackendSupply,
} from '@nelyx/tooling-contracts/backend-supply';
import { localFile, relativeFile, sha256 } from '@nelyx/tooling-contracts/node-files';
import {
  ensureDirectory,
  ownedDirectory,
  publishDirectory,
  removeDirectory,
} from './publication.mjs';

const sdkVersion = '0.1.0';
const projectionVersion = 2;
export const rustPackages = (targets) => [
  'backend-rust',
  ...Object.entries(backendPackages)
    .filter(([target]) => targets[target])
    .map(([, name]) => name),
];

export function rustSupplyPath(app) {
  return path.join(app, '.nelyx', 'sdk', 'rust');
}

function selectedSupply(names, locate) {
  const result = Object.fromEntries(
    names.map((name) => {
      const entry = verifyBackendSupply(locate(name), name, sdkVersion);
      return [name, entry];
    }),
  );
  if (
    result['backend-wasm'] &&
    result['backend-wasm'].data.defaultBuild.coreInputs !==
      backendHash(result['backend-rust'].data.inputs)
  )
    throw new Error('Default backend Wasm was built from a different Rust core supply');
  return result;
}

export function inspectRustSupply(app, target) {
  const packages = selectedSupply(rustPackages({ [target]: true }), (name) =>
    localFile(app, 'node_modules/@nelyx/' + name),
  );
  if (!matchesProjection(rustSupplyPath(app), packages))
    throw new Error(
      'Rust SDK projection differs from installed packages. Run nelyx supply and npm ci --workspaces=false in ' +
        app,
    );
  return packages;
}

function matchesProjection(directory, packages) {
  if (!fs.existsSync(directory)) return false;
  ownedDirectory(directory);
  try {
    const receipt = JSON.parse(fs.readFileSync(localFile(directory, 'supply.json'), 'utf8'));
    if (receipt.projectionVersion !== projectionVersion) return false;
    for (const [name, { id, data }] of Object.entries(packages)) {
      if (receipt[name] !== id) return false;
      for (const entry of data.files) {
        if (!entry.path.startsWith('crates/')) continue;
        const file = localFile(directory, entry.path);
        if (!fs.statSync(file).isFile() || sha256(file) !== entry.sha256) return false;
      }
      const files = rustInputFiles(localFile(directory, 'crates/' + backendCrates[name]));
      if (files.length !== data.files.filter(({ path }) => path.startsWith('crates/')).length)
        return false;
    }
    return true;
  } catch {
    return false;
  }
}

/** Project only verified SDK source files. Compilation never edits npm packages. */
export function supplyRust(app, names, archives) {
  const directory = rustSupplyPath(app);
  const parent = ensureDirectory(path.dirname(directory));
  const unpack = fs.mkdtempSync(path.join(parent, '.rust-unpack-'));
  const stage = fs.mkdtempSync(path.join(parent, '.rust-'));
  try {
    const packages = selectedSupply(names, (name) => {
      const output = ensureDirectory(path.join(unpack, name));
      let total = 0;
      const seen = new Set();
      extract({
        cwd: output,
        file: archives[name],
        sync: true,
        strict: true,
        strip: 1,
        filter(file, entry) {
          const relative = relativeFile(file);
          if (
            !relative.startsWith('package/') ||
            entry.type !== 'File' ||
            seen.has(relative.toLowerCase())
          )
            throw new Error('Invalid Rust SDK archive entry: ' + file);
          seen.add(relative.toLowerCase());
          total += entry.size;
          if (total > 64 * 1024 * 1024 || seen.size > 4096)
            throw new Error('Rust SDK archive exceeds its supply budget');
          return true;
        },
      });
      return output;
    });
    if (
      matchesProjection(directory, packages) &&
      Object.values(backendCrates).every(
        (crate) =>
          names.some((name) => backendCrates[name] === crate) ||
          !fs.existsSync(path.join(directory, 'crates', crate)),
      )
    )
      return;
    const receipt = { projectionVersion };
    const publishedAt = new Date();
    for (const [name, { directory: source, data, id }] of Object.entries(packages)) {
      receipt[name] = id;
      for (const entry of data.files) {
        if (!entry.path.startsWith('crates/')) continue;
        const file = path.join(stage, entry.path);
        ensureDirectory(path.dirname(file));
        fs.copyFileSync(localFile(source, entry.path), file, fs.constants.COPYFILE_EXCL);
        // npm archives use a fixed timestamp. Cargo must notice revised source at the same path.
        fs.utimesSync(file, publishedAt, publishedAt);
      }
    }
    fs.writeFileSync(path.join(stage, 'supply.json'), JSON.stringify(receipt, null, 2) + '\n');
    publishDirectory(stage, directory);
  } finally {
    removeDirectory(stage, parent);
    removeDirectory(unpack, parent);
  }
}
