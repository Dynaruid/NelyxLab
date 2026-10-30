// SPDX-License-Identifier: BSD-3-Clause
import fs from 'node:fs';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { readApplication } from './application.mjs';
import { createProviderRegistry } from '@nelyx/sdk/runtime/providers';
import { verifyLinuxInputs, prepareLinuxInputs } from './linux-inputs.mjs';
import { sha256, localFile, verifyInventory } from './files.mjs';
import { execute } from './commands.mjs';
import { writePortableMetroMap, verifyPortableMetroMap } from './portable-metro-map.mjs';
export async function configureLinuxApplication({ app }) {
  const value = await readApplication(app, 'linux');
  if (
    value.profile.status !== 'implemented' ||
    !['rn-graphite-vulkan-x11', 'rn-graphite-vulkan-wayland'].includes(value.profile.id)
  )
    throw new Error('Implemented Linux RN Vulkan profile required');
  value
    .load('@nelyx/metro/runner-config')
    .inspectRunnerCohort({ target: 'linux', runnerRoot: value.runner, appRoot: value.app });
  value.load('@nelyx/metro/assets').verifyAppAssets(value.app, value.config.assets);
  const config = {
    name: value.config.name,
    assets: value.config.assets,
    profile: value.profile.id,
    windowSystem: value.profile.id.endsWith('-wayland') ? 'wayland' : 'x11',
  };
  fs.writeFileSync(
    path.join(value.runner, 'app-config.json'),
    JSON.stringify(config, null, 2) + '\n',
  );
  return {
    app: value.app,
    runner: value.runner,
    config,
    cohort: value.cohort,
    qualification: value.profile.qualification,
  };
}
export async function prepareLinux({ app, nativeInputs }) {
  const value = await configureLinuxApplication({ app });
  return prepareLinuxInputs({ ...value, input: nativeInputs });
}
export async function doctorLinux({ app, nativeInputs }) {
  const value = await readApplication(app, 'linux');
  value
    .load('@nelyx/metro/runner-config')
    .inspectRunnerCohort({ target: 'linux', runnerRoot: value.runner, appRoot: value.app });
  let inputs;
  try {
    const input =
      nativeInputs ??
      JSON.parse(fs.readFileSync(path.join(value.app, '.nelyx/linux/native-inputs.json'), 'utf8'))
        .input;
    const verified = verifyLinuxInputs({ runner: value.runner, input });
    inputs = {
      result: 'PASS-scoped',
      sha256: verified.sha256,
      files: verified.files,
      bytes: verified.bytes,
    };
  } catch (error) {
    inputs = { result: 'notVerified', reason: String(error) };
  }
  const nativeHost = process.platform === 'linux' && process.arch === 'x64';
  return {
    schema: 'nelyx.doctor/v2',
    target: 'linux',
    runner: value.runner,
    profile: value.profile.id,
    cohort: value.cohort,
    implementation: value.profile.status,
    qualification: value.profile.qualification,
    nativeInputs: inputs,
    nativeHost,
    adapters: { prepare: true, build: nativeHost, run: nativeHost, pack: nativeHost, dev: true },
  };
}
export function locateLinuxInputs({ app, runner, input }) {
  if (input) return verifyLinuxInputs({ runner, input });
  const locator = JSON.parse(
    fs.readFileSync(path.join(app, '.nelyx/linux/native-inputs.json'), 'utf8'),
  );
  if (locator.schema !== 'nelyx.linux-prepared/v1' || sha256(locator.input) !== locator.sha256)
    throw new Error('Linux native input locator changed');
  return verifyLinuxInputs({ runner, input: locator.input });
}
function nativeHost() {
  if (process.platform !== 'linux' || process.arch !== 'x64')
    throw new Error('Linux native operation requires Linux x86_64');
}
/** App-owned native builder calls this only on its fresh package staging copy. */
export function writeLinuxBundleMap({ app, directory }) {
  return writePortableMetroMap({
    app,
    runner: path.join(path.resolve(app), 'linux/runner'),
    directory,
    bundle: 'bundle/index.linux.bundle',
  });
}
export function verifyLinuxPackage(directory) {
  directory = fs.realpathSync(directory);
  const manifest = JSON.parse(fs.readFileSync(localFile(directory, 'nelyx-package.json'), 'utf8'));
  if (
    manifest.schema !== 'nelyx.linux-package/v1' ||
    manifest.target !== 'linux' ||
    manifest.architecture !== 'x86_64' ||
    !['Debug', 'Release'].includes(manifest.configuration) ||
    !['rn-graphite-vulkan-x11', 'rn-graphite-vulkan-wayland'].includes(manifest.profile) ||
    !/^[A-Z][A-Za-z0-9]*$/.test(manifest.app) ||
    manifest.executable !== 'rn-linux-app' ||
    manifest.bundle !== 'bundle/index.linux.bundle' ||
    manifest.qualification !== 'notVerified' ||
    !/^[a-f0-9]{64}$/.test(manifest.nativeInputsSha256)
  )
    throw new Error('Linux package identity mismatch');
  const cohort = createProviderRegistry().cohort(
    'linux',
    { cohort: 'rn-0.81.6' },
    manifest.profile,
  );
  if (
    !manifest.cohort ||
    Object.keys(manifest.cohort).length !== Object.keys(cohort).length ||
    Object.entries(cohort).some(([name, value]) => manifest.cohort[name] !== value)
  )
    throw new Error('Linux package cohort mismatch');
  const inventory = verifyInventory(directory, manifest.files, ['nelyx-package.json']),
    names = new Set(manifest.files.map((record) => record.path));
  const revisions = {
    hermes: 'e0fc67142ec0763c6b6153ca2bf96df815539782',
    folly: '0660ead5b610047a279cc291129e98e3f2a1fc37',
    fmt: 'e69e5f977d458f2650bb346dadf2ad30c5320281',
  };
  if (
    !manifest.nativeSources ||
    Object.keys(manifest.nativeSources).length !== 3 ||
    Object.entries(revisions).some(([name, revision]) => manifest.nativeSources[name] !== revision)
  )
    throw new Error('Linux native runtime source revisions differ');
  for (const name of [
    'rn-linux-app',
    'libreact_native_linux.so.0',
    'libhermes.so',
    'libjsi.so',
    'libfolly.so.0.58.0-dev',
    manifest.configuration === 'Debug' ? 'libfmtd.so.10' : 'libfmt.so.10',
  ]) {
    if (!names.has(name)) throw new Error('Missing Linux runtime file: ' + name);
    const bytes = fs.readFileSync(localFile(directory, name));
    if (
      bytes.length < 64 ||
      bytes.subarray(0, 4).toString('hex') !== '7f454c46' ||
      bytes[4] !== 2 ||
      bytes[5] !== 1 ||
      bytes.readUInt16LE(18) !== 62
    )
      throw new Error('Linux runtime must be x86_64 ELF: ' + name);
  }
  if (!names.has(manifest.bundle)) throw new Error('Linux bundle missing');
  const sourceMap = verifyPortableMetroMap({
    directory,
    records: manifest.files,
    bundle: manifest.bundle,
  });
  return { directory, manifest, ...inventory, sourceMap };
}
function packageFor(app, directory) {
  if (directory) return verifyLinuxPackage(path.resolve(directory));
  const locator = JSON.parse(
    fs.readFileSync(path.join(path.resolve(app), '.nelyx/linux/last-package.json'), 'utf8'),
  );
  if (
    locator.schema !== 'nelyx.linux-package-locator/v1' ||
    sha256(path.join(locator.directory, 'nelyx-package.json')) !== locator.manifestSha256
  )
    throw new Error('Linux package locator changed');
  return verifyLinuxPackage(locator.directory);
}
export async function buildLinux({
  app,
  nativeInputs,
  output,
  configuration = 'Release',
  hermesSource,
  buildDirectory,
  signal,
}) {
  signal?.throwIfAborted();
  nativeHost();
  const value = await configureLinuxApplication({ app }),
    input = locateLinuxInputs({ app: value.app, runner: value.runner, input: nativeInputs });
  if (!['Debug', 'Release'].includes(configuration)) throw new Error('Choose Debug or Release');
  const directory = path.resolve(
    output ??
      path.join(
        value.app,
        '.nelyx/linux/packages',
        value.config.name + '-' + configuration + '-' + Date.now(),
      ),
  );
  if (fs.existsSync(directory)) throw new Error('Linux package output must be a new directory');
  await execute(
    process.execPath,
    [
      localFile(value.runner, 'build.mjs'),
      '--native-inputs',
      input.input,
      '--configuration',
      configuration,
      '--output',
      directory,
      ...(hermesSource ? ['--hermes-source', hermesSource] : []),
      ...(buildDirectory ? ['--build-directory', buildDirectory] : []),
    ],
    { cwd: value.runner, timeout: 1200000, signal },
  );
  signal?.throwIfAborted();
  const built = JSON.parse(
    fs.readFileSync(path.join(value.app, '.nelyx/linux/last-build.json'), 'utf8'),
  );
  if (
    built.schema !== 'nelyx.linux-build/v1' ||
    built.package !== directory ||
    built.nativeInputsSha256 !== input.sha256
  )
    throw new Error('Linux build acknowledgement mismatch');
  const verified = verifyLinuxPackage(directory);
  return {
    schema: 'nelyx.build/v2',
    target: 'linux',
    directory,
    configuration,
    files: verified.files,
    bytes: verified.bytes,
    exeSha256: sha256(path.join(directory, verified.manifest.executable)),
    qualification: 'notVerified',
  };
}
export async function runLinux({ app, directory, arguments: args = [] }) {
  nativeHost();
  const verified = packageFor(app, directory),
    executable = localFile(verified.directory, verified.manifest.executable);
  return new Promise((resolve, reject) => {
    const child = spawn(executable, args, { cwd: verified.directory, stdio: 'inherit' });
    process.stderr.write(
      JSON.stringify({ event: 'nelyx.native-started', pid: child.pid, executable }) + '\n',
    );
    let closing = false,
      force;
    const close = () => {
      if (closing) return;
      closing = true;
      child.kill('SIGINT');
      force = setTimeout(() => child.kill('SIGKILL'), 15000);
    };
    const cleanup = () => {
      clearTimeout(force);
      process.off('SIGINT', close);
      process.off('SIGTERM', close);
    };
    process.on('SIGINT', close);
    process.on('SIGTERM', close);
    child.on('error', (error) => {
      cleanup();
      reject(error);
    });
    child.on('exit', (code) => {
      cleanup();
      resolve({ schema: 'nelyx.run/v2', target: 'linux', exitCode: code ?? 1 });
    });
  });
}
export async function packLinux({ app, directory, output }) {
  nativeHost();
  const verified = packageFor(app, directory);
  output = path.resolve(
    output ??
      path.join(
        path.resolve(app),
        '.nelyx/linux/packages',
        verified.manifest.app + '-' + Date.now() + '.tar.gz',
      ),
  );
  const relative = path.relative(verified.directory, output);
  if (
    !output.endsWith('.tar.gz') ||
    fs.existsSync(output) ||
    (!relative.startsWith('..') && !path.isAbsolute(relative))
  )
    throw new Error('Linux pack requires a new tar.gz outside the package');
  fs.mkdirSync(path.dirname(output), { recursive: true });
  const base = path.join(path.resolve(app), '.nelyx/linux/pack-staging');
  fs.mkdirSync(base, { recursive: true });
  const stage = fs.mkdtempSync(path.join(base, 'pack-'));
  for (const record of verified.manifest.files) {
    const target = path.join(stage, record.path);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.copyFileSync(localFile(verified.directory, record.path), target);
  }
  fs.copyFileSync(
    localFile(verified.directory, 'nelyx-package.json'),
    path.join(stage, 'nelyx-package.json'),
  );
  verifyLinuxPackage(stage);
  const result = spawnSync('tar', ['-czf', output, '-C', stage, '.'], {
    encoding: 'utf8',
    timeout: 180000,
  });
  if (result.error || result.status !== 0) throw new Error(String(result.error ?? result.stderr));
  return {
    schema: 'nelyx.pack/v2',
    target: 'linux',
    file: output,
    sha256: sha256(output),
    files: verified.files,
    qualification: 'notVerified',
  };
}
