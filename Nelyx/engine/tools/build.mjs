// SPDX-License-Identifier: BSD-3-Clause
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { windowsCompilerEnvironment } from '../../sdk/tooling/cli/src/windows-static-hermes.mjs';

export const engineRoot = path.resolve(import.meta.dirname, '..');
export const timeout = 1_200_000;
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
      if (hosts)
        args.push(
          '-DNELYX_ENGINE_WINDOWS_HOST=ON',
          '-DNELYX_SKIA_SUPPLIER=' + path.resolve(engineRoot, '../skia/vendor/inputs/windows-x64'),
          '-DNELYX_HERMES_ROOT=' + path.resolve(engineRoot, '../../.nelyx/windows-hermes'),
        );
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
function tree(directory, prefix = '') {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const relative = path.posix.join(prefix, entry.name);
    if (entry.isSymbolicLink()) throw new Error('Engine build tree contains a symbolic link');
    return entry.isDirectory() ? tree(path.join(directory, entry.name), relative) : [relative];
  });
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
  const sources = [
    'CMakeLists.txt',
    'tests/native-driver.cpp',
    '../package.json',
    '../tsconfig.build.json',
    '../runtime/tsconfig.json',
    '../sdk/package.json',
    '../sdk/tsconfig.build.json',
    '../eng/build-packages.mjs',
    '../sdk/tooling/cli/src/windows-static-hermes.mjs',
    ...['core', 'bindings', 'include', 'schema', 'tools', 'platform', 'render'].flatMap((dir) =>
      tree(path.join(engineRoot, dir)).map((file) => `${dir}/${file}`),
    ),
    ...tree(path.resolve(engineRoot, '../runtime/engine-client')).map(
      (file) => '../runtime/engine-client/' + file,
    ),
    '../sdk/src/runtime/engine-v2.ts',
    '../sdk/src/runtime/engine-v2-app.ts',
    '../sdk/tooling/cli/src/engine-v2-runner.mjs',
    '../sdk/tooling/cli/src/main.mjs',
    '../sdk/tooling/cli/package.json',
    '../sdk/src/runtime/engine-v2-browser.ts',
    '../sdk/src/runtime/engine-v2-interaction.ts',
    ...['windows', 'windows-hermes'].flatMap((dir) =>
      tree(path.resolve(engineRoot, '../sdk/native', dir)).map(
        (file) => '../sdk/native/' + dir + '/' + file,
      ),
    ),
    ...tree(path.resolve(engineRoot, '../skia/native/platforms/vulkan')).map(
      (file) => '../skia/native/platforms/vulkan/' + file,
    ),
    '../skia/native/platforms/windows/font_services.cpp',
    '../skia/native/rendering/font_services.h',
    '../skia/native/core/paragraph_queries.cpp',
    '../skia/native/core/nelyx_skia/paragraph_queries.h',
    '../../sample/nelyx-testbed-app-2/src/v2-app.ts',
    '../../sample/nelyx-testbed-app-2/src/v2-scene.ts',
    ...['material', 'cupertino'].flatMap((name) => [
      `../../packages/${name}/src/v2.ts`,
      `../../packages/${name}/package.json`,
      `../../packages/${name}/tsconfig.build.json`,
    ]),
    '../../sample/nelyx-testbed-app-2/assets/NotoSansKR.ttf',
    '../../sample/nelyx-testbed-app-2/assets/NotoSansKR-OFL.txt',
    '../../sample/nelyx-testbed-app-2/assets/component-image.webp',
    ...fallbackFonts.flatMap((font) =>
      [font.file, font.license].map(
        (file) => '../sdk/tooling/cli/templates/nelyx-app/assets/' + file,
      ),
    ),
  ];
  return createHash('sha256')
    .update(
      sources
        .sort()
        .map((file) => file + ':' + sha256(path.join(engineRoot, file)))
        .join('\n'),
    )
    .digest('hex');
}
async function browserAssets(supply, supplier) {
  const copy = (from, to) => {
    const target = path.join(supply, to);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.copyFileSync(from, target);
  };
  const repo = path.resolve(engineRoot, '../..');
  const ck = path.join(repo, 'node_modules/canvaskit-wasm');
  if (JSON.parse(fs.readFileSync(path.join(ck, 'package.json'))).version !== '0.41.0')
    throw new Error('Expected official CanvasKit 0.41.0');
  for (const file of ['canvaskit.js', 'canvaskit.wasm'])
    copy(path.join(ck, 'bin/full', file), 'canvaskit/' + file);
  copy(path.join(ck, 'LICENSE'), 'canvaskit/LICENSE');
  copy(path.join(repo, 'sample/nelyx-testbed-app-2/assets/NotoSansKR.ttf'), 'assets/font.ttf');
  copy(path.join(repo, 'sample/nelyx-testbed-app-2/assets/NotoSansKR-OFL.txt'), 'assets/OFL.txt');
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
  copy(
    path.join(repo, 'sample/nelyx-testbed-app-2/assets/component-image.webp'),
    'assets/image.webp',
  );
  copy(path.join(supplier.skia, 'data/icudtl.dat'), 'assets/icudtl.dat');
  copy(path.join(supplier.hermes, 'build/lib/hermesvm.dll'), 'native/hermesvm.dll');
  copy(path.join(engineRoot, 'platform/web/index.html'), 'index.html');
  for (const [name, entry, globalName] of [
    ['coordinator', 'platform/web/coordinator.ts'],
    ['owner', 'platform/web/owner.ts', 'NelyxV2Owner'],
    ['main', 'platform/web/main.ts'],
    ['app-worker', '../../sample/nelyx-testbed-app-2/src/v2-app.ts'],
    ['app-native', '../../sample/nelyx-testbed-app-2/src/v2-app.ts'],
  ]) {
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
  const supplier = hosts ? suppliers() : undefined;
  if (hosts) {
    for (const target of ['core', 'cupertino', 'material', 'sdk']) {
      console.log(
        run(process.execPath, [path.resolve(engineRoot, '../eng/build-packages.mjs'), target]),
      );
    }
  }
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
        /^(?:engine(?:-browser)?\.(?:js|mjs|wasm|worker\.js)|NelyxEngineV2Host\.exe|nelyx_engine_driver(?:\.exe)?|(?:lib)?nelyx_engine_v2\.(?:lib|a))$/.test(
          name,
        ),
      ))
        fs.copyFileSync(path.join(builds, profile, file), path.join(supply, profile, file));
    }
    if (hosts) await browserAssets(supply, supplier);
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
                native: { contentIndependent: true, renderer: 'Skia-Graphite-Vulkan' },
                threaded: { contentIndependent: true, renderer: 'CanvasKit-WebGL2' },
                'single-worker': { contentIndependent: false, renderer: 'CanvasKit-WebGL2' },
              }
            : undefined,
          canvasKit: hosts
            ? {
                version: '0.41.0',
                variant: 'full',
                js: 'canvaskit/canvaskit.js',
                wasm: 'canvaskit/canvaskit.wasm',
              }
            : undefined,
          hermes: hosts ? supplier.revision : undefined,
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
    if (fs.existsSync(final)) fs.renameSync(final, backup);
    try {
      fs.renameSync(supply, final);
    } catch (error) {
      if (fs.existsSync(backup)) fs.renameSync(backup, final);
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
