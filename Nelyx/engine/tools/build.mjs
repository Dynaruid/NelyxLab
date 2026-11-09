// SPDX-License-Identifier: BSD-3-Clause
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { build, buildSync } from 'esbuild';
import { runTypeScriptCompiler } from '../../sdk/tooling/contracts/src/typescript-compiler.cjs';
import { windowsCompilerEnvironment } from '../../sdk/tooling/cli/src/windows-static-hermes.mjs';
import { buildAppSdkHost } from './app-sdk.mjs';
import { checkWebRuntime } from '../../skia/eng/prepare-web-runtime.mjs';

export const engineRoot = path.resolve(import.meta.dirname, '..');
export const timeout = 1_200_000;
/** Windows indexers can briefly retain a just-produced directory handle. */
export async function renameEngineDirectory(
  from,
  to,
  rename = fs.renameSync,
  delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
) {
  for (let attempt = 0; ; ++attempt) {
    try {
      rename(from, to);
      return;
    } catch (error) {
      if (!['EPERM', 'EACCES', 'EBUSY'].includes(error.code) || attempt >= 3) throw error;
      await delay((attempt + 1) * 200);
    }
  }
}
const pin = '4.0.22';
const fallbackFonts = [
  {
    file: 'NotoNaskhArabic-Regular.ttf',
    license: 'NotoNaskhArabic-Regular.ttf.LICENSE.txt',
    family: 'NelyxArabic',
  },
  { file: 'NotoSansHebrew.ttf', license: 'NotoSansHebrew-OFL.txt', family: 'NelyxHebrew' },
  { file: 'NotoColorEmoji.ttf', license: 'NotoColorEmoji.ttf.LICENSE.txt', family: 'NelyxEmoji' },
];
const webEntries = [
  ['coordinator', 'platform/web/coordinator.ts'],
  ['owner', 'platform/web/owner.ts', 'NelyxV2Owner'],
  ['app-text', 'platform/web/app-text.ts', 'NelyxV2AppText'],
];
export function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    encoding: 'utf8',
    timeout,
    windowsHide: true,
    ...options,
  });
  if (result.error || result.status !== 0)
    throw new Error(
      `${command} failed: ${result.error ?? result.status}\n${result.stdout ?? ''}${result.stderr ?? ''}`,
    );
  return result.stdout.trim();
}
function checkBrowserTypes() {
  const checked = runTypeScriptCompiler(
    path.resolve(engineRoot, '../..'),
    ['-p', path.join(engineRoot, 'platform/web/tsconfig.json'), '--pretty', 'false'],
    '@typescript/native',
  );
  if (checked.status !== 0) throw Error(checked.stdout + checked.stderr);
}
export function buildProfiles(
  directory,
  profiles = ['native', 'single-worker', 'threaded'],
  { hosts = false } = {},
) {
  run(process.execPath, [path.join(engineRoot, 'tools/generate-schema.mjs'), '--check']);
  const toolchains = {};
  for (const profile of profiles) {
    const output = path.join(directory, profile);
    fs.mkdirSync(output, { recursive: true });
    let env = process.env;
    const args = ['-S', engineRoot, '-B', output, '-G', 'Ninja', '-DCMAKE_BUILD_TYPE=Release'];
    if (profile === 'native') {
      if (process.platform === 'win32') env = windowsCompilerEnvironment();
      run('cmake', args, { env });
      toolchains[profile] = process.platform === 'win32' ? 'MSVC-x64' : 'system-cxx';
    } else {
      if (!['single-worker', 'threaded'].includes(profile))
        throw new Error('Unknown engine profile');
      const sdk = process.env.EMSDK ?? path.join(os.homedir(), '.cache/tooling/emsdk');
      const emscripten = path.join(sdk, 'upstream/emscripten');
      if (!fs.existsSync(path.join(emscripten, 'emcmake.py')))
        throw new Error(
          'Engine Wasm checks require Emscripten ' + pin + '; set EMSDK to its SDK directory.',
        );
      const version = fs
        .readFileSync(path.join(emscripten, 'emscripten-version.txt'), 'utf8')
        .trim()
        .replaceAll('"', '');
      if (version !== pin) throw new Error(`Expected Emscripten ${pin}, found ${version}`);
      env = { ...process.env, EM_CONFIG: path.join(sdk, '.emscripten') };
      run(
        'python',
        [
          path.join(emscripten, 'emcmake.py'),
          'cmake',
          ...args,
          '-DNELYX_ENGINE_THREADED=' + (profile === 'threaded' ? 'ON' : 'OFF'),
          '-DNELYX_ENGINE_BROWSER_HOST=' + (hosts ? 'ON' : 'OFF'),
        ],
        { env },
      );
      toolchains[profile] = `emscripten-${version}`;
    }
    run('cmake', ['--build', output, '--parallel', '2'], { env });
    console.log(`Engine v2 ${profile} compiled (${toolchains[profile]}).`);
  }
  return toolchains;
}
function sha256(file) {
  return createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}
function tree(directory, prefix = '', ignore = () => false) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const relative = path.posix.join(prefix, entry.name);
    if (ignore(relative)) return [];
    if (entry.isSymbolicLink()) throw new Error('Engine build tree contains a symbolic link');
    return entry.isDirectory()
      ? tree(path.join(directory, entry.name), relative, ignore)
      : [relative];
  });
}
const androidProjectCache = (name) => /(?:^|\/)(?:\.gradle|build)(?:\/|$)/.test(name);
/** IDE/Gradle discovery can populate the project without changing its inputs. */
export function androidProjectSourceFiles(directory) {
  return tree(directory, '', androidProjectCache);
}
function cleanup(staged, parent) {
  const resolved = path.resolve(staged);
  if (
    path.dirname(resolved) !== path.resolve(parent) ||
    !path.basename(resolved).startsWith('engine-')
  )
    throw new Error('Unexpected engine cleanup target');
  tree(resolved);
  fs.rmSync(resolved, { recursive: true, force: true, maxRetries: 3 });
}
function suppliers() {
  const skia = path.resolve(engineRoot, '../skia/vendor/inputs/windows-x64');
  const lock = JSON.parse(
    fs.readFileSync(path.resolve(engineRoot, '../skia/vendor/windows-rn-supplier.lock.json')),
  );
  for (const file of lock.files) {
    const name = file.file.replace('nelyx_rn_', 'ozeli_rn_');
    if (sha256(path.join(skia, name)) !== file.sha256)
      throw new Error('Skia identity mismatch: ' + name);
  }
  const hermes = path.resolve(engineRoot, '../../.nelyx/windows-hermes');
  const cohort = JSON.parse(fs.readFileSync(path.join(hermes, 'native-hermes.json')));
  if (
    cohort.revision !== '94aa5e1d40a4ce99df79d951cbe45310ec40680c' ||
    cohort.jsi !== 21 ||
    cohort.crt !== 'MD'
  )
    throw new Error('Hermes cohort mismatch');
  for (const file of cohort.files.filter((f) =>
    ['build/lib/hermesvm.dll', 'build/lib/hermesvm.lib', 'build/jsi/jsi.lib'].includes(f.path),
  )) {
    if (sha256(path.join(hermes, file.path)) !== file.sha256)
      throw new Error('Hermes identity mismatch: ' + file.path);
  }
  return { skia, hermes, revision: cohort.revision };
}
export function sourceIdentity() {
  // Follow the provider's actual module graph. App framework/design/SDK source
  // belongs to the independently hashed application bundle, not this supply.
  const graph = buildSync({
    absWorkingDir: engineRoot,
    entryPoints: webEntries.map(([, entry]) => entry),
    outdir: 'unused-engine-identity',
    bundle: true,
    write: false,
    metafile: true,
    format: 'iife',
    platform: 'browser',
    target: 'es2022',
    logLevel: 'silent',
  });
  const runtimeInputs = Object.keys(graph.metafile.inputs).filter((file) => {
    const absolute = path.resolve(engineRoot, file);
    if (absolute.startsWith(engineRoot + path.sep)) return false;
    if (!absolute.startsWith(path.resolve(engineRoot, '../runtime/engine-client') + path.sep))
      throw Error('Engine provider imports an App/package dependency: ' + file);
    return true;
  });
  const sources = [
    'CMakeLists.txt',
    '../../package.json',
    '../../package-lock.json',
    '../tsconfig.build.json',
    '../eng/prepare-engine-helpers.mjs',
    '../sdk/tooling/contracts/src/typescript-compiler.cjs',
    '../sdk/tooling/contracts/package.json',
    '../sdk/tooling/cli/src/windows-static-hermes.mjs',
    ...['core', 'bindings', 'include', 'schema', 'tools', 'platform', 'render'].flatMap((dir) =>
      tree(
        path.join(engineRoot, dir),
        '',
        (file) =>
          dir === 'platform' &&
          file.startsWith('android/project/') &&
          androidProjectCache(file.slice('android/project/'.length)),
      )
        .filter(
          (file) =>
            (dir !== 'tools' ||
              !['run-windows.mjs', 'run-android.mjs', 'serve.mjs'].includes(file)) &&
            // Source/consumer planning is not compiled or shipped. Port sources,
            // provenance and legal notices remain hashed supply inputs.
            !(dir === 'platform' && file === 'native-api-ports.md'),
        )
        .map((file) => `${dir}/${file}`),
    ),
    ...runtimeInputs,
    '../sdk/tooling/cli/templates/nelyx-app/android/gradle/wrapper/gradle-wrapper.jar',
    '../skia/packages/web/native-manifest.json',
    '../skia/eng/prepare-web-runtime.mjs',
    '../skia/eng/source-build/canvaskit.lock.json',
    '../skia/vendor/artifacts.lock.json',
    '../skia/eng/source-build/canvaskit-paragraph.patch',
    '../skia/eng/source-build/canvaskit-picture.cpp',
    'vendor/helper-sources.json',
    '../sdk/tooling/cli/templates/nelyx-app/assets/NotoSansKR.ttf',
    '../sdk/tooling/cli/templates/nelyx-app/assets/NotoSansKR-OFL.txt',
    ...fallbackFonts.flatMap((font) =>
      [font.file, font.license].map(
        (file) => '../sdk/tooling/cli/templates/nelyx-app/assets/' + file,
      ),
    ),
  ];
  return createHash('sha256')
    .update(
      [...new Set(sources)]
        .sort()
        .map((file) => file + ':' + sha256(path.join(engineRoot, file)))
        .join('\n'),
    )
    .digest('hex');
}
async function browserAssets(supply, supplier, runtime) {
  const copy = (from, to) => {
    const target = path.join(supply, to);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.copyFileSync(from, target);
  };
  for (const file of ['canvaskit.js', 'canvaskit.wasm'])
    copy(path.join(runtime.directory, file), 'canvaskit/' + file);
  copy(path.join(runtime.directory, 'LICENSE_SKIA'), 'canvaskit/LICENSE');
  copy(path.join(runtime.directory, 'package.json'), 'canvaskit/package.json');
  copy(path.join(runtime.directory, 'native-manifest.json'), 'canvaskit/native-manifest.json');
  copy(
    path.resolve(engineRoot, '../sdk/tooling/cli/templates/nelyx-app/assets/NotoSansKR.ttf'),
    'assets/font.ttf',
  );
  copy(
    path.resolve(engineRoot, '../sdk/tooling/cli/templates/nelyx-app/assets/NotoSansKR-OFL.txt'),
    'assets/OFL.txt',
  );
  for (const font of fallbackFonts) {
    copy(
      path.resolve(engineRoot, '../sdk/tooling/cli/templates/nelyx-app/assets', font.file),
      'assets/' + font.file,
    );
    copy(
      path.resolve(engineRoot, '../sdk/tooling/cli/templates/nelyx-app/assets', font.license),
      'assets/' + font.license,
    );
  }
  copy(path.join(supplier.skia, 'data/icudtl.dat'), 'assets/icudtl.dat');
  for (const [name, entry, globalName] of webEntries) {
    await build({
      entryPoints: [path.join(engineRoot, entry)],
      outfile: path.join(supply, 'web', name + '.js'),
      bundle: true,
      format: 'iife',
      target: 'es2022',
      platform: 'browser',
      ...(globalName ? { globalName } : {}),
      logLevel: 'warning',
      logOverride: { 'package.json': 'silent' },
    });
  }
}
async function main() {
  const sourceSha256 = sourceIdentity();
  const hosts = !process.argv.includes('--headless');
  const webRuntime = hosts ? checkWebRuntime() : undefined;
  const supplier = hosts ? suppliers() : undefined;
  if (hosts) checkBrowserTypes();
  const parent = path.join(engineRoot, '.cache');
  fs.mkdirSync(parent, { recursive: true });
  const staged = fs.mkdtempSync(path.join(parent, 'engine-'));
  const final = path.join(engineRoot, 'dist');
  const backup = path.join(staged, 'previous');
  try {
    const builds = path.join(staged, 'build');
    const toolchains = buildProfiles(builds, undefined, { hosts });
    const supply = path.join(staged, 'supply');
    fs.mkdirSync(supply);
    for (const profile of Object.keys(toolchains)) {
      fs.mkdirSync(path.join(supply, profile));
      for (const file of tree(path.join(builds, profile)).filter((name) =>
        /^(?:engine(?:-browser)?\.(?:js|mjs|wasm|worker\.js)|(?:lib)?nelyx_engine_v2\.(?:lib|a))$/.test(
          name,
        ),
      ))
        fs.copyFileSync(path.join(builds, profile, file), path.join(supply, profile, file));
    }
    if (hosts) await browserAssets(supply, supplier, webRuntime);
    const windowsAppSdk =
      hosts && process.platform === 'win32'
        ? buildAppSdkHost({
            engineRoot,
            library: path.join(builds, 'native/nelyx_engine_v2.lib'),
            intermediate: path.join(staged, 'app-sdk-intermediate'),
            output: path.join(supply, 'windows-app-sdk'),
          })
        : undefined;
    const canonical = JSON.parse(
      fs.readFileSync(path.join(engineRoot, 'schema/protocol.json'), 'utf8'),
    );
    const schema = createHash('sha256').update(JSON.stringify(canonical)).digest().readUInt32LE();
    if (sourceIdentity() !== sourceSha256)
      throw new Error('Engine sources changed during the build; rebuild the current source');
    fs.writeFileSync(
      path.join(supply, 'engine-manifest.json'),
      JSON.stringify(
        {
          schema: 'nelyx.engine.v2.supply/1',
          qualification: hosts ? 'host-integration-candidate' : 'headless-contracts-only',
          sourceSha256,
          abi: { major: 2, schema },
          toolchains,
          profiles: hosts
            ? {
                ...(windowsAppSdk
                  ? {
                      'windows-app-sdk': {
                        ...windowsAppSdk,
                        contentIndependent: true,
                        renderer: 'Skia-Graphite-Vulkan',
                      },
                    }
                  : {}),
                threaded: { contentIndependent: true, renderer: 'CanvasKit-WebGL2' },
                'single-worker': { contentIndependent: false, renderer: 'CanvasKit-WebGL2' },
              }
            : undefined,
          canvasKit: hosts
            ? {
                version: webRuntime.version,
                variant: 'owned-full',
                paragraphApiVersion: 1,
                pictureApiVersion: 3,
                fontApiVersion: 1,
                initialMemoryBytes: 128 * 1024 * 1024,
                maximumMemoryBytes: 256 * 1024 * 1024,
                sourceManifest: 'canvaskit/native-manifest.json',
                js: 'canvaskit/canvaskit.js',
                wasm: 'canvaskit/canvaskit.wasm',
              }
            : undefined,
          hermes: hosts ? supplier.revision : undefined,
          appServices: hosts
            ? {
                version: 4,
                methods: [
                  'clipboard-read',
                  'clipboard-write',
                  'clipboard-has-strings',
                  'clipboard-read-event',
                  'clipboard-release-event',
                  'semantics-tap',
                  'semantics-longPress',
                  'semantics-focus',
                  'accessibility-tooltip',
                  'system-sound',
                  'haptic-feedback',
                ],
                maximumTextUnits: 65536,
                maximumPending: 32,
              }
            : undefined,
          appText: hosts
            ? {
                version: 12,
                bootstrapVersion: 1,
                fontRevision: 1,
                quotaBytes: 320 * 1024 * 1024,
                script: 'web/app-text.js',
              }
            : undefined,
          fonts: hosts
            ? [
                { path: 'assets/font.ttf', family: 'NelyxDefault' },
                ...fallbackFonts.map((font) => ({
                  path: 'assets/' + font.file,
                  family: font.family,
                })),
              ]
            : undefined,
          files: tree(supply)
            .sort()
            .map((file) => ({ path: file, sha256: sha256(path.join(supply, file)) })),
        },
        null,
        2,
      ) + '\n',
    );
    if (fs.existsSync(final)) await renameEngineDirectory(final, backup);
    try {
      await renameEngineDirectory(supply, final);
    } catch (error) {
      if (fs.existsSync(backup)) await renameEngineDirectory(backup, final);
      throw error;
    }
    console.log('Current engine v2 supply: ' + final);
  } finally {
    // Only this invocation's staging/previous output is removed.
    cleanup(staged, parent);
  }
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url))
  await main();
