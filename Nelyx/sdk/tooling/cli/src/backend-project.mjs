// SPDX-License-Identifier: BSD-3-Clause
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { parse } from 'smol-toml';
import {
  backendCrates,
  backendFiles,
  backendHash,
  backendPackages,
  backendProtocol,
  bindgenVersion,
  rustInputFiles,
  wasmTarget,
} from '@nelyx/tooling-contracts/backend-supply';
import { localFile, sha256 } from '@nelyx/tooling-contracts/node-files';
import { capture, execute } from './commands.mjs';
import { ensureDirectory, removeDirectory } from './publication.mjs';
import { inspectRustSupply, rustSupplyPath } from './rust-supply.mjs';
import { inspectRust } from './tauri-platforms.mjs';

const timeout = 1_200_000;
const declaration = (file) => parse(fs.readFileSync(file, 'utf8'));
const unix = (file) => file.replaceAll('\\', '/');

export function sourceFile(directory, file, contents) {
  const target = path.join(directory, file);
  ensureDirectory(path.dirname(target));
  const previous = fs.lstatSync(target, { throwIfNoEntry: false });
  if (previous && (!previous.isFile() || previous.isSymbolicLink()))
    throw new Error('Expected generated ordinary file: ' + target);
  const bytes = Buffer.from(contents);
  if (!previous || !fs.readFileSync(target).equals(bytes)) fs.writeFileSync(target, bytes);
  return target;
}

export function cratePath(app, name) {
  return path.join(rustSupplyPath(app), 'crates', backendCrates[name]);
}

export function cargoDependency(host, directory, packageName) {
  const relative = path.relative(host, directory);
  const pkg = packageName ? 'package = ' + JSON.stringify(packageName) + ', ' : '';
  return '{ ' + pkg + 'path = ' + JSON.stringify(unix(relative || '.')) + ' }';
}

function readAppCrate(value) {
  const { app, config } = value;
  const manifest = config.backend?.manifest ?? './backend/Cargo.toml';
  if (!config.backend && !fs.existsSync(path.join(app, 'backend'))) return;
  const file = localFile(app, manifest.slice(2));
  const content = declaration(file);
  const pkg = content.package;
  if (
    typeof pkg?.name !== 'string' ||
    !/^[A-Za-z][\w-]*$/.test(pkg.name) ||
    typeof pkg.version !== 'string'
  )
    throw new Error('App backend Cargo.toml requires a package name and version');
  const directory = path.dirname(file);
  const folders = new Set();
  const files = new Set();
  function visit(folder) {
    if (folders.has(folder) || !path.relative(rustSupplyPath(app), folder).startsWith('..')) return;
    folders.add(folder);
    for (const file of rustInputFiles(folder)) files.add(file);
    const cargo = path.join(folder, 'Cargo.toml');
    const current = folder === directory ? content : declaration(cargo);
    function dependencies(workspace, table) {
      for (const kind of ['dependencies', 'build-dependencies', 'dev-dependencies']) {
        for (const [name, dependency] of Object.entries(table[kind] ?? {})) {
          const reference = dependency?.workspace ? workspace?.dependencies?.[name] : dependency;
          if (typeof reference?.path === 'string') {
            const base = dependency?.workspace ? workspace.directory : folder;
            visit(fs.realpathSync(path.resolve(base, reference.path)));
          }
        }
      }
    }
    let workspace = current.workspace ? { ...current.workspace, directory: folder } : undefined;
    if (current.package?.workspace) {
      const directory = path.resolve(folder, current.package.workspace);
      const manifest = path.join(directory, 'Cargo.toml');
      files.add(manifest);
      workspace = { ...declaration(manifest).workspace, directory };
    } else if (!workspace) {
      let parent = path.dirname(folder);
      while (parent !== path.dirname(parent)) {
        const manifest = path.join(parent, 'Cargo.toml');
        if (fs.existsSync(manifest)) {
          const found = declaration(manifest).workspace;
          if (found) {
            files.add(manifest);
            workspace = { ...found, directory: parent };
            break;
          }
        }
        if (parent === app) break;
        parent = path.dirname(parent);
      }
    }
    dependencies(workspace, current);
    for (const table of Object.values(current.target ?? {})) dependencies(workspace, table);
    if (current.lib?.path) files.add(path.resolve(folder, current.lib.path));
    if (typeof current.package?.build === 'string')
      files.add(path.resolve(folder, current.package.build));
  }
  visit(directory);
  const inputs = [...files]
    .map((file) => [unix(path.relative(app, file)), sha256(file)])
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return {
    directory,
    name: pkg.name,
    version: pkg.version,
    manifest: unix(path.relative(app, file)),
    inputs,
    watch: [
      ...folders,
      ...[...files].filter(
        (file) =>
          ![...folders].some((folder) => {
            const relative = path.relative(folder, file);
            return !relative.startsWith('..') && !path.isAbsolute(relative);
          }),
      ),
    ],
  };
}

export function inspectBackend(value, target, { requireLock = true } = {}) {
  if (!value.config.targets[target])
    throw new Error('Declare targets.' + target + ' in package.json');
  const supply = inspectRustSupply(value.app, target);
  const adapter = supply[backendPackages[target]];
  const core = supply['backend-rust'];
  const appCrate = readAppCrate(value);
  const kind = target === 'web' ? 'wasm' : 'native';
  const packages = { core: core.id, adapter: adapter.id };
  if (target === 'web' && !appCrate) {
    return {
      supply,
      packages,
      identity: adapter.data.defaultBackend,
      toolchain: adapter.data.defaultBuild,
      watch: [],
    };
  }
  const lock = path.join(value.app, 'backend', 'locks', target, 'Cargo.lock');
  const hasLock = fs.existsSync(lock);
  if (requireLock && !hasLock)
    throw new Error(
      'Missing backend/locks/' +
        target +
        '/Cargo.lock. Run nelyx prepare --target ' +
        target +
        ' first',
    );
  return {
    supply,
    packages,
    appCrate,
    lock,
    cargoLock: hasLock ? sha256(localFile(value.app, unix(path.relative(value.app, lock)))) : null,
    identity: {
      kind,
      protocolVersion: backendProtocol,
      backendVersion: appCrate?.version ?? core.data.version,
      sourceId: backendHash([appCrate?.manifest, appCrate?.inputs, core.id, backendProtocol]),
    },
    watch: [...(appCrate?.watch ?? []), path.join(value.app, 'backend'), rustSupplyPath(value.app)],
  };
}

export function cargoBuildEnvironment(variables = process.env) {
  return backendHash(
    Object.entries(variables)
      .filter(
        ([key]) =>
          /^(?:RUSTFLAGS$|RUSTC(?:_WORKSPACE)?_WRAPPER$|CARGO_ENCODED_RUSTFLAGS$|CARGO_(?:TARGET|BUILD|PROFILE)_)/i.test(
            key,
          ) && key.toUpperCase() !== 'CARGO_TARGET_DIR',
      )
      .sort(),
  );
}

export function cargoCache(app, kind) {
  const base =
    process.platform === 'win32'
      ? process.env.LOCALAPPDATA
      : process.platform === 'darwin'
        ? path.join(os.homedir(), 'Library/Caches')
        : (process.env.XDG_CACHE_HOME ?? path.join(os.homedir(), '.cache'));
  if (!base || !path.isAbsolute(base)) throw new Error('Configure an absolute local Cargo cache');
  const id = createHash('sha256')
    .update(process.platform === 'win32' ? app.toLowerCase() : app)
    .digest('hex')
    .slice(0, 32);
  return ensureDirectory(path.join(base, 'Nelyx', kind, id, 'target'));
}

export async function useCargoLock(
  project,
  host,
  app,
  signal,
  { prepare = false, update = false } = {},
) {
  if (!project.lock) return;
  const generated = path.join(host, 'Cargo.lock');
  if (update || (prepare && !project.cargoLock)) {
    if (project.cargoLock) sourceFile(host, 'Cargo.lock', fs.readFileSync(project.lock));
    else if (fs.existsSync(generated)) fs.unlinkSync(localFile(host, 'Cargo.lock'));
    await execute(
      'cargo',
      ['generate-lockfile', '--manifest-path', path.join(host, 'Cargo.toml')],
      { cwd: app, timeout, signal },
    );
    signal.throwIfAborted();
    sourceFile(path.dirname(project.lock), 'Cargo.lock', fs.readFileSync(generated));
  } else {
    if (!project.cargoLock) throw new Error('Prepare the backend Cargo.lock before building');
    sourceFile(host, 'Cargo.lock', fs.readFileSync(project.lock));
  }
  const lock = sha256(generated);
  if (lock !== sha256(project.lock)) throw new Error('App Cargo.lock changed while restoring it');
  return lock;
}

function wasmHost(value, project) {
  const { app } = value;
  const host = ensureDirectory(path.join(app, '.nelyx', 'wasm', 'host'));
  const { appCrate, identity } = project;
  sourceFile(
    host,
    'Cargo.toml',
    `[package]
name = "nelyx-app-wasm"
version = "0.1.0"
edition = "2021"
publish = false

[workspace]

[lib]
crate-type = ["cdylib"]

[dependencies]
app_backend = ${cargoDependency(host, appCrate.directory, appCrate.name)}
nelyx-backend-core = ${cargoDependency(host, cratePath(app, 'backend-rust'))}
nelyx-backend-wasm = ${cargoDependency(host, cratePath(app, 'backend-wasm'))}
wasm-bindgen = "=${bindgenVersion}"

[profile.release]
opt-level = "s"
lto = true
strip = true
`,
  );
  sourceFile(
    host,
    'src/lib.rs',
    `use nelyx_backend_core::{BackendKind, Identity};

nelyx_backend_wasm::export_backend!(
    Identity {
        backend_version: ${JSON.stringify(identity.backendVersion)},
        source_id: ${JSON.stringify(identity.sourceId)},
        kind: BackendKind::Wasm,
    },
    app_backend::register
);
`,
  );
  return host;
}

export function inspectWasmTools(app) {
  const result = inspectRust(app, wasmTarget);
  const tool = capture('wasm-bindgen', ['--version'], { cwd: app }).trim();
  if (tool !== 'wasm-bindgen ' + bindgenVersion)
    throw Error('Expected wasm-bindgen-cli ' + bindgenVersion + ', found ' + tool);
  return { ...result, bindgen: tool };
}

export async function prepareWasm(value, project, update, signal) {
  if (!project.appCrate) return;
  inspectWasmTools(value.app);
  await useCargoLock(project, wasmHost(value, project), value.app, signal, {
    prepare: true,
    update,
  });
}

export async function compileWasm(value, project, signal) {
  const { app } = value;
  const adapter = project.supply['backend-wasm'];
  const read = (directory) =>
    new Map(
      backendFiles.map((name) => [
        'runtime/backend/' + name,
        fs.readFileSync(localFile(directory, name)),
      ]),
    );
  let files;
  let toolchain = project.toolchain;
  if (project.appCrate) {
    const host = wasmHost(value, project);
    const tools = inspectWasmTools(app);
    const parent = path.dirname(host);
    const out = fs.mkdtempSync(path.join(parent, '.bindgen-'));
    const cache = cargoCache(app, 'wasm');
    const options = ['build', '--locked', '--release', '--lib', '--target', wasmTarget];
    const binding = ['--target', 'web', '--out-name', 'backend'];
    const env = { ...process.env, CARGO_TARGET_DIR: cache };
    try {
      const cargoLock = await useCargoLock(project, host, app, signal);
      await execute('cargo', [...options, '--manifest-path', path.join(host, 'Cargo.toml')], {
        cwd: app,
        env,
        signal,
        timeout,
      });
      await execute(
        'wasm-bindgen',
        [...binding, '--out-dir', out, path.join(cache, wasmTarget, 'release/nelyx_app_wasm.wasm')],
        { cwd: app, signal, timeout },
      );
      files = read(out);
      const current = inspectBackend(value, 'web');
      if (backendHash(backendContract(current)) !== backendHash(backendContract(project)))
        throw new Error('App backend inputs changed during Wasm compilation');
      toolchain = {
        ...tools,
        cargoLock,
        options,
        binding,
        environment: cargoBuildEnvironment(env),
      };
    } finally {
      removeDirectory(out, parent);
    }
  } else {
    files = read(localFile(adapter.directory, 'default'));
  }
  files.set(
    'licenses/nelyx-backend-rust.txt',
    fs.readFileSync(localFile(adapter.directory, 'LICENSE.md')),
  );
  return { ...project, files, toolchain };
}

export function backendContract(project) {
  return {
    ...project.identity,
    packages: project.packages,
    cargoLock: project.cargoLock ?? null,
    appManifest: project.appCrate?.manifest ?? null,
    ...(project.hostInputs ? { hostInputs: project.hostInputs } : {}),
  };
}
