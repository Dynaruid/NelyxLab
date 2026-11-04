// SPDX-License-Identifier: BSD-3-Clause
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { windowsCompilerEnvironment } from '../../sdk/tooling/cli/src/windows-static-hermes.mjs';

export const engineRoot = path.resolve(import.meta.dirname, '..');
export const timeout = 1_200_000;
const pin = '4.0.22';
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
export function buildProfiles(directory, profiles = ['native', 'single-worker', 'threaded']) {
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
function main() {
  const parent = path.join(engineRoot, '.cache');
  fs.mkdirSync(parent, { recursive: true });
  const staged = fs.mkdtempSync(path.join(parent, 'engine-'));
  const final = path.join(engineRoot, 'dist');
  const backup = path.join(staged, 'previous');
  try {
    const builds = path.join(staged, 'build');
    const toolchains = buildProfiles(builds);
    const supply = path.join(staged, 'supply');
    fs.mkdirSync(supply);
    for (const profile of Object.keys(toolchains)) {
      fs.mkdirSync(path.join(supply, profile));
      for (const file of tree(path.join(builds, profile)).filter((name) =>
        /^(?:engine\.(?:mjs|wasm|worker\.js)|nelyx_engine_driver(?:\.exe)?|(?:lib)?nelyx_engine_v2\.(?:lib|a))$/.test(
          name,
        ),
      ))
        fs.copyFileSync(path.join(builds, profile, file), path.join(supply, profile, file));
    }
    const sources = [
      'CMakeLists.txt',
      ...['core', 'bindings', 'include', 'schema', 'tools'].flatMap((dir) =>
        tree(path.join(engineRoot, dir)).map((file) => `${dir}/${file}`),
      ),
    ];
    const sourceSha256 = createHash('sha256')
      .update(
        sources
          .sort()
          .map((file) => file + ':' + sha256(path.join(engineRoot, file)))
          .join('\n'),
      )
      .digest('hex');
    fs.writeFileSync(
      path.join(supply, 'engine-manifest.json'),
      JSON.stringify(
        {
          schema: 'nelyx.engine.v2.supply/1',
          qualification: 'headless-contracts-only',
          sourceSha256,
          toolchains,
          contentIndependent: false,
          renderer: 'unconnected',
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
    console.log('Current headless engine supply: ' + final);
  } finally {
    // Only this invocation's staging/previous output is removed.
    cleanup(staged, parent);
  }
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
