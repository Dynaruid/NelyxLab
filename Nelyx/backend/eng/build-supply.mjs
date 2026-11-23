// SPDX-License-Identifier: BSD-3-Clause
import fs from 'node:fs';
import path from 'node:path';
import {
  backendCrates,
  backendFiles,
  backendHash,
  backendInventory,
  backendProtocol,
  bindgenVersion,
  rustInputFiles,
  rustSupplySchema,
  wasmTarget,
} from '@nelyx/tooling-contracts/backend-supply';
import { sha256 } from '@nelyx/tooling-contracts/node-files';
import { capture, execute } from '../../sdk/tooling/cli/src/commands.mjs';
import {
  ensureDirectory,
  publishDirectory,
  removeDirectory,
  withSignals,
} from '../../sdk/tooling/cli/src/publication.mjs';

const root = path.resolve(import.meta.dirname, '..');
const packages = path.join(root, 'packages');
const manifest = path.join(root, 'Cargo.toml');
const lock = path.join(root, 'Cargo.lock');
const options = ['build', '--locked', '--release', '--lib', '--target', wasmTarget];

function version(command) {
  return capture(command, ['--version'], { cwd: root }).trim();
}

function rustInputs(files) {
  return Object.fromEntries(
    files.sort().map((file) => [path.relative(root, file).replaceAll('\\', '/'), sha256(file)]),
  );
}

function inputsForDefault() {
  return rustInputs([
    manifest,
    lock,
    ...['default', 'crates/nelyx-backend-core', 'crates/nelyx-backend-wasm'].flatMap((folder) =>
      rustInputFiles(path.join(root, folder)),
    ),
  ]);
}

export function checkRustPackages() {
  const expected = backendHash(inputsForDefault());
  for (const [name, crate] of Object.entries(backendCrates)) {
    const directory = path.join(packages, name.slice('backend-'.length), 'dist');
    const { inputs, files, defaultBuild } = JSON.parse(
      fs.readFileSync(path.join(directory, 'supply.json'), 'utf8'),
    );
    const current = backendInventory(directory).filter(({ path }) => path !== 'supply.json');
    if (
      JSON.stringify(current) !== JSON.stringify(files) ||
      JSON.stringify(inputs) !==
        JSON.stringify(rustInputs(rustInputFiles(path.join(root, 'crates', crate)))) ||
      (name === 'backend-wasm' && defaultBuild?.inputs !== expected)
    )
      throw new Error('Rebuild @nelyx/' + name + ' before packing SDK');
  }
}

async function build(signal) {
  const tool = version('wasm-bindgen');
  if (tool !== 'wasm-bindgen ' + bindgenVersion)
    throw new Error('build:sdk requires wasm-bindgen-cli ' + bindgenVersion + ', found ' + tool);
  const sourceId = backendHash(inputsForDefault());
  const target = ensureDirectory(path.join(root, '.cache/cargo'));
  const environment = {
    ...process.env,
    CARGO_TARGET_DIR: target,
    NELYX_BACKEND_SOURCE_ID: sourceId,
  };
  const defaultBuild = {
    inputs: sourceId,
    coreInputs: backendHash(
      rustInputs(rustInputFiles(path.join(root, 'crates/nelyx-backend-core'))),
    ),
    cargoLock: sha256(lock),
    cargo: version('cargo'),
    rustc: version('rustc'),
    bindgen: tool,
    target: wasmTarget,
    options,
    rustFlags: backendHash([process.env.RUSTFLAGS, process.env.CARGO_ENCODED_RUSTFLAGS]),
  };
  await execute(
    'cargo',
    [...options, '--package', 'nelyx-default-backend', '--manifest-path', manifest],
    { cwd: root, env: environment, timeout: 1_200_000, signal },
  );
  for (const [name, crate] of Object.entries(backendCrates)) {
    const directory = path.join(packages, name.slice('backend-'.length));
    const stage = fs.mkdtempSync(path.join(directory, '.dist-'));
    const { version } = JSON.parse(fs.readFileSync(path.join(directory, 'package.json'), 'utf8'));
    try {
      const source = path.join(root, 'crates', crate);
      const files = rustInputFiles(source);
      for (const file of files) {
        const destination = path.join(stage, 'crates', crate, path.relative(source, file));
        fs.mkdirSync(path.dirname(destination), { recursive: true });
        fs.copyFileSync(file, destination);
      }
      fs.copyFileSync(path.resolve(root, '../sdk/LICENSE.md'), path.join(stage, 'LICENSE.md'));
      const supply = {
        schema: rustSupplySchema,
        package: '@nelyx/' + name,
        version,
        protocolVersion: backendProtocol,
        inputs: rustInputs(files),
      };
      if (name === 'backend-wasm') {
        const binding = ['--target', 'web', '--out-name', 'backend'];
        const output = ensureDirectory(path.join(stage, 'default'));
        await execute(
          'wasm-bindgen',
          [
            ...binding,
            '--out-dir',
            output,
            path.join(target, wasmTarget, 'release/nelyx_default_backend.wasm'),
          ],
          { cwd: root, timeout: 1_200_000, signal },
        );
        for (const file of backendFiles) fs.statSync(path.join(output, file));
        Object.assign(supply, {
          bindgenVersion,
          defaultBuild: { ...defaultBuild, binding },
          defaultBackend: {
            kind: 'wasm',
            sourceId,
            backendVersion: version,
            protocolVersion: backendProtocol,
          },
        });
      }
      if (
        sourceId !== backendHash(inputsForDefault()) ||
        JSON.stringify(supply.inputs) !== JSON.stringify(rustInputs(rustInputFiles(source)))
      )
        throw new Error('Rust SDK inputs changed during build');
      fs.writeFileSync(
        path.join(stage, 'supply.json'),
        JSON.stringify(
          {
            ...supply,
            files: backendInventory(stage),
          },
          null,
          2,
        ) + '\n',
      );
      signal.throwIfAborted();
      publishDirectory(stage, path.join(directory, 'dist'));
    } finally {
      removeDirectory(stage, directory);
    }
  }
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === path.join(import.meta.dirname, 'build-supply.mjs')
)
  await withSignals(build);
