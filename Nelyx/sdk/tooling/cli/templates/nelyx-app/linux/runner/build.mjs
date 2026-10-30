// SPDX-License-Identifier: BSD-3-Clause
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { configureLinuxApplication, locateLinuxInputs } from '@nelyx/cli/linux-runner';
import { verifyLinuxPackage, writeLinuxBundleMap } from '@nelyx/cli/linux-runner';
if (process.platform !== 'linux' || process.arch !== 'x64')
  throw new Error('Linux native build requires a Linux x86_64 host');
const runner = import.meta.dirname,
  app = path.resolve(runner, '../..'),
  load = createRequire(import.meta.url),
  value = await configureLinuxApplication({ app }),
  argument = (name, fallback) => {
    const index = process.argv.indexOf(name);
    return index < 0 ? fallback : process.argv[index + 1];
  };
const configuration = argument('--configuration', 'Release');
if (!['Debug', 'Release'].includes(configuration)) throw new Error('Choose Debug or Release');
const input = locateLinuxInputs({ app, runner, input: argument('--native-inputs') }),
  build = path.resolve(
    argument('--build-directory', path.join(app, '.nelyx/linux/build', configuration)),
  ),
  hermes = argument('--hermes-source');
function run(command, args, cwd = runner) {
  const result = spawnSync(command, args, { cwd, stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(command + ' failed: ' + result.status);
}
run(process.execPath, [path.join(runner, 'bundle.mjs')]);
if (hermes) {
  const result = spawnSync('git', ['-C', hermes, 'rev-parse', 'HEAD'], { encoding: 'utf8' }),
    state = spawnSync('git', ['-C', hermes, 'status', '--porcelain', '--untracked-files=normal'], {
      encoding: 'utf8',
    });
  if (
    result.status !== 0 ||
    result.stdout.trim() !== input.manifest.hermesRevision ||
    state.status !== 0 ||
    state.stdout.trim()
  )
    throw new Error('Hermes source override must be the clean pinned checkout');
}
run('cmake', [
  '-S',
  path.join(app, 'linux'),
  '-B',
  build,
  '-G',
  'Ninja',
  '-DCMAKE_BUILD_TYPE=' + configuration,
  '-UCMAKE_PROJECT_nelyx_linux_app_INCLUDE',
  '-DNELYX_SKIA_SDK=' + path.join(input.root, input.manifest.sdk),
  '-DNELYX_SKIA_RN_MODULES_CMAKE=' + path.join(input.root, input.manifest.modules),
  ...(hermes ? ['-DFETCHCONTENT_SOURCE_DIR_HERMES=' + path.resolve(hermes)] : []),
]);
run('cmake', ['--build', build, '--target', 'rn-linux-app', '--parallel', '2']);
const executable = path.join(build, 'rn-linux-app');
if (!fs.statSync(executable).isFile()) throw new Error('Linux native build produced no executable');
const sha = (file) => createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const state = path.join(app, '.nelyx/linux');
fs.mkdirSync(state, { recursive: true });
const destination = path.resolve(
  argument(
    '--output',
    path.join(state, 'packages', value.config.name + '-' + configuration + '-' + Date.now()),
  ),
);
if (fs.existsSync(destination)) throw new Error('Linux package output must be a new directory');
const inside = (parent, child) => {
  const relative = path.relative(parent, child);
  return !relative.startsWith('..') && !path.isAbsolute(relative);
};
if (inside(build, destination) || inside(destination, build))
  throw new Error('Linux package must be outside native build output');
fs.mkdirSync(path.dirname(destination), { recursive: true });
const stage = fs.mkdtempSync(path.join(path.dirname(destination), '.package-'));
const copy = (source, name) => {
  const target = path.join(stage, name);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.copyFileSync(source, target);
};
copy(executable, 'rn-linux-app');
fs.chmodSync(path.join(stage, 'rn-linux-app'), 0o755);
function files(root) {
  return fs.readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const file = path.join(root, entry.name);
    if (entry.isSymbolicLink()) throw new Error('Native package source symlink');
    return entry.isDirectory() ? files(file) : entry.isFile() ? [file] : [];
  });
}
const runtimeNames = {
  'libreact_native_linux.so': 'libreact_native_linux.so.0',
  'libhermes.so': 'libhermes.so',
  'libjsi.so': 'libjsi.so',
  'libfolly.so': 'libfolly.so.0.58.0-dev',
  [configuration === 'Debug' ? 'libfmtd.so' : 'libfmt.so']:
    configuration === 'Debug' ? 'libfmtd.so.10' : 'libfmt.so.10',
};
function findRuntime(directory, name) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) return findRuntime(file, name);
    if (entry.name !== name) return [];
    const actual = fs.realpathSync(file);
    if (!inside(build, actual) || !fs.statSync(actual).isFile())
      throw new Error('Native runtime library escaped its build: ' + name);
    return [actual];
  });
}
for (const [base, name] of Object.entries(runtimeNames)) {
  const candidates = findRuntime(build, base);
  if (candidates.length !== 1)
    throw new Error('Native runtime library is missing/ambiguous: ' + base);
  const dynamic = spawnSync('readelf', ['-d', candidates[0]], { encoding: 'utf8' });
  if (dynamic.status !== 0 || /\(SONAME\).*\[([^\]]+)\]/.exec(dynamic.stdout)?.[1] !== name)
    throw new Error('Pinned runtime SONAME differs: ' + base);
  copy(candidates[0], name);
}
for (const name of ['rn-linux-app', ...Object.values(runtimeNames)]) {
  const result = spawnSync('readelf', ['-d', path.join(stage, name)], { encoding: 'utf8' });
  if (result.status !== 0) throw new Error('ELF dynamic metadata unavailable');
  const paths = [...result.stdout.matchAll(/\((?:RUNPATH|RPATH)\).*\[([^\]]+)\]/g)];
  if (paths.some((match) => match[1] !== '$ORIGIN'))
    throw new Error('Native runtime contains a producer RPATH: ' + name);
}
const bundle = path.join(runner, '.bundle');
for (const file of files(bundle))
  copy(file, 'bundle/' + path.relative(bundle, file).replaceAll('\\', '/'));
writeLinuxBundleMap({ app, directory: stage });
const assets = load('@nelyx/metro/assets').verifyAppAssets(app, value.config.assets);
for (const asset of assets) {
  const copied = path.join(stage, 'bundle', asset.path.slice(2));
  if (sha(copied) !== asset.sha256)
    throw new Error('Linux copied bundle asset changed after verification: ' + asset.id);
}
for (const [source, name] of [
  ['node_modules/@lucid-softworks/react-native-linux/LICENSE', 'RNL-MIT'],
  ['node_modules/@lucid-softworks/react-native-linux/LICENSE_NELYX.md', 'Nelyx-BSD-3-Clause'],
  ['node_modules/@nelyx/skia-rn/LICENSE.md', 'SkiaRN-LICENSE'],
  ['node_modules/@nelyx/skia-rn/THIRD_PARTY_NOTICES.md', 'SkiaRN-NOTICES'],
])
  copy(path.join(runner, source), 'notices/' + name + '.txt');
for (const name of ['react', 'react-native'])
  copy(path.join(runner, 'node_modules', name, 'LICENSE'), 'notices/' + name + '-LICENSE.txt');
copy(path.join(build, 'nelyx-hermes-LICENSE'), 'notices/hermes-LICENSE.txt');
for (const name of ['folly', 'fmt'])
  copy(path.join(build, 'nelyx-' + name + '-LICENSE'), 'notices/' + name + '-LICENSE.txt');
const skiaNotices = path.join(runner, 'node_modules/@nelyx/skia-rn/licenses');
for (const file of files(skiaNotices))
  copy(file, 'notices/SkiaRN/' + path.relative(skiaNotices, file).replaceAll('\\', '/'));
for (const record of input.manifest.files)
  if (
    /^(?:LICENSE(?:\.[^/]*)?|COPYING(?:\.[^/]*)?|NOTICE(?:\.[^/]*)?|PATENTS|AUTHORS)$/.test(
      path.basename(record.file),
    )
  )
    copy(path.join(input.root, record.file), 'notices/native-inputs/' + record.file);
load('@nelyx/metro/assets').copyAppNotices(
  app,
  value.config.assets,
  path.join(stage, 'notices/app-assets'),
);
const records = files(stage).map((file) => ({
  path: path.relative(stage, file).replaceAll('\\', '/'),
  bytes: fs.statSync(file).size,
  sha256: sha(file),
}));
const nativeSources = JSON.parse(
  fs.readFileSync(path.join(build, 'nelyx-native-source.json'), 'utf8'),
);
fs.writeFileSync(
  path.join(stage, 'nelyx-package.json'),
  JSON.stringify(
    {
      schema: 'nelyx.linux-package/v1',
      target: 'linux',
      app: value.config.name,
      architecture: 'x86_64',
      configuration,
      profile: value.config.profile,
      cohort: value.cohort,
      executable: 'rn-linux-app',
      bundle: 'bundle/index.linux.bundle',
      nativeInputsSha256: input.sha256,
      nativeSources,
      qualification: 'notVerified',
      files: records,
    },
    null,
    2,
  ) + '\n',
);
verifyLinuxPackage(stage);
fs.renameSync(stage, destination);
const verified = verifyLinuxPackage(destination);
fs.writeFileSync(
  path.join(state, 'last-build.json'),
  JSON.stringify(
    {
      schema: 'nelyx.linux-build/v1',
      app: value.config.name,
      configuration,
      build,
      executable,
      exeSha256: sha(executable),
      nativeInputsSha256: input.sha256,
      runner,
      package: destination,
      qualification: 'notVerified',
    },
    null,
    2,
  ) + '\n',
);
fs.writeFileSync(
  path.join(state, 'last-package.json'),
  JSON.stringify(
    {
      schema: 'nelyx.linux-package-locator/v1',
      directory: destination,
      manifestSha256: sha(path.join(destination, 'nelyx-package.json')),
    },
    null,
    2,
  ) + '\n',
);
console.log(
  JSON.stringify({
    result: 'PASS-scoped',
    scope: 'Linux RN/GTK/Hermes/native Vulkan host build and package',
    directory: destination,
    configuration,
    files: verified.files,
    qualification: 'notVerified',
    gpuExecution: 'notVerified',
  }),
);
