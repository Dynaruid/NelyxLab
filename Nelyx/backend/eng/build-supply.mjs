// SPDX-License-Identifier: BSD-3-Clause
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  backendCrates,
  backendFiles,
  backendHash,
  backendInventory,
  backendProtocol,
  bindgenVersion,
  publicWasmDeclaration,
  rustInputFiles,
  rustSupplySchema,
  wasmTarget,
  verifyBackendSupply,
} from '@nelyx/tooling-contracts/backend-supply';
import { sha256 } from '@nelyx/tooling-contracts/node-files';
import { capture, execute } from '../../sdk/tooling/cli/src/commands.mjs';
import {
  cargoBuildEnvironment,
  runCargoBuild,
} from '../../sdk/tooling/cli/src/backend-project.mjs';
import { buildStage } from '../../sdk/tooling/cli/src/build-cache.mjs';
import { withSdkLock } from '../../eng/sdk-lock.mjs';
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
const binding = ['--target', 'web', '--out-name', 'backend'];
const wasmDeclaration = path.resolve(root, '../sdk/src/backends/generated/wasm/backend.d.ts');
const license = path.resolve(root, '../sdk/LICENSE.md');

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
    const {
      data: { inputs, defaultBuild, files },
    } = installedSupply(name);
    if (
      files.find(({ path }) => path === 'LICENSE.md')?.sha256 !== sha256(license) ||
      JSON.stringify(inputs) !==
        JSON.stringify(rustInputs(rustInputFiles(path.join(root, 'crates', crate)))) ||
      (name === 'backend-wasm' && defaultBuild?.inputs !== expected)
    )
      throw new Error('Rebuild @nelyx/' + name + ' before packing SDK');
  }
}

function installedSupply(name) {
  const directory = path.join(packages, name.slice('backend-'.length));
  const { version } = JSON.parse(fs.readFileSync(path.join(directory, 'package.json'), 'utf8'));
  return verifyBackendSupply(directory, name, version);
}

function checkDeclaration(directory, writeBindings) {
  const declaration = publicWasmDeclaration(
    fs.readFileSync(path.join(directory, 'backend.d.ts'), 'utf8'),
  );
  const previous = fs.existsSync(wasmDeclaration)
    ? fs.readFileSync(wasmDeclaration, 'utf8').replaceAll('\r\n', '\n')
    : undefined;
  if (previous === declaration) return;
  if (!writeBindings)
    throw new Error('SDK Wasm bindings are stale. Run npm run generate:backend-bindings.');
  ensureDirectory(path.dirname(wasmDeclaration));
  fs.writeFileSync(wasmDeclaration, declaration);
}

export async function buildRustSupply(signal, writeBindings = false) {
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
  const cargoConfig = [
    ...['.cargo/config', '.cargo/config.toml'].flatMap((file) => [
      path.join(root, file),
      path.resolve(root, '..', file),
      path.resolve(root, '../..', file),
    ]),
    ...['config', 'config.toml'].map((file) =>
      path.join(process.env.CARGO_HOME ?? path.join(os.homedir(), '.cargo'), file),
    ),
  ]
    .filter((file) => fs.existsSync(file))
    .map((file) => [file, sha256(file)]);
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
    rustFlags: cargoBuildEnvironment(),
    cargoConfig,
    binding,
  };
  for (const [name, crate] of Object.entries(backendCrates)) {
    const start = performance.now();
    const directory = path.join(packages, name.slice('backend-'.length));
    const { version } = JSON.parse(fs.readFileSync(path.join(directory, 'package.json'), 'utf8'));
    const source = path.join(root, 'crates', crate);
    const files = rustInputFiles(source);
    const isWasm = name === 'backend-wasm';
    let previous;
    try {
      previous = installedSupply(name);
    } catch {
      // Missing or damaged publications are rebuilt into staging.
    }
    const supply = {
      schema: rustSupplySchema,
      package: '@nelyx/' + name,
      version,
      protocolVersion: backendProtocol,
      inputs: rustInputs(files),
      ...(isWasm
        ? {
            bindgenVersion,
            defaultBuild,
            defaultBackend: {
              kind: 'wasm',
              sourceId,
              backendVersion: version,
              protocolVersion: backendProtocol,
            },
          }
        : {}),
    };
    const compatibleWasm =
      isWasm &&
      previous &&
      backendHash(previous.data.defaultBuild) === backendHash(defaultBuild) &&
      previous.data.defaultBackend?.sourceId === sourceId;
    if (previous) {
      const { files, ...metadata } = previous.data;
      if (
        backendHash(metadata) === backendHash(supply) &&
        files.find(({ path }) => path === 'LICENSE.md')?.sha256 === sha256(license)
      ) {
        if (isWasm) checkDeclaration(path.join(previous.directory, 'default'), writeBindings);
        buildStage('rust-supply', start, {
          package: name,
          published: 0,
          bindgen: 0,
          reason: 'verified supply reused',
        });
        continue;
      }
    }
    const stage = fs.mkdtempSync(path.join(directory, '.dist-'));
    try {
      for (const file of files) {
        const destination = path.join(stage, 'crates', crate, path.relative(source, file));
        fs.mkdirSync(path.dirname(destination), { recursive: true });
        fs.copyFileSync(file, destination);
      }
      fs.copyFileSync(license, path.join(stage, 'LICENSE.md'));
      if (isWasm) {
        const output = ensureDirectory(path.join(stage, 'default'));
        if (compatibleWasm) {
          for (const file of backendFiles)
            fs.copyFileSync(
              path.join(previous.directory, 'default', file),
              path.join(output, file),
            );
        } else {
          await runCargoBuild(
            [...options, '--package', 'nelyx-default-backend', '--manifest-path', manifest],
            { cwd: root, env: environment, timeout: 1_200_000, signal },
            'sdk-wasm-cargo',
          );
          const bindgenStart = performance.now();
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
          buildStage('sdk-wasm-bindgen', bindgenStart, {
            calls: 1,
            reason: 'SDK Wasm or toolchain changed',
          });
        }
        for (const file of backendFiles) fs.statSync(path.join(output, file));
        checkDeclaration(output, writeBindings);
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
      buildStage('rust-supply', start, {
        package: name,
        published: 1,
        bindgen: isWasm && !compatibleWasm ? 1 : 0,
        reason: 'supply inputs or output changed',
      });
    } finally {
      removeDirectory(stage, directory);
    }
  }
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === path.join(import.meta.dirname, 'build-supply.mjs')
)
  await withSignals((signal) =>
    withSdkLock(() => buildRustSupply(signal, process.argv.includes('--write-wasm-bindings'))),
  );
