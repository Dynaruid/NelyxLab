// SPDX-License-Identifier: BSD-3-Clause
import fs from 'node:fs';
import path from 'node:path';
import { build } from 'esbuild';
import { transformFromAstSync } from '@babel/core';
import transformer from '../sdk/tooling/metro/src/native-hermes-transformer.cjs';
import { execute } from '../sdk/tooling/cli/src/commands.mjs';
import { windowsCompilerEnvironment } from '../sdk/tooling/cli/src/windows-static-hermes.mjs';

const root = path.resolve(import.meta.dirname, '../..');
const timeout = 1_200_000;
const fixture = `
import {Builder, SizedBox} from './Nelyx/src/framework/widgets/basic.ts';
import {BuildOwner} from './Nelyx/src/framework/widgets/framework.ts';
const errors = [];
const owner = new BuildOwner({reportError: err => errors.push(String(err.exception))}, () => {});
let visits = 0, peak = 0, queued = 0;
function deep() {
  let child = SizedBox.shrink();
  for (let i = 0; i < 128; i++) {
    const next = child;
    child = new Builder(context => {
      visits++; peak = Math.max(peak, context.owner.inlineDepth);
      if (context.owner.inlineDepth === 0) queued++;
      return next;
    });
  }
  return child;
}
let tree = deep();
const element = new Builder(() => tree).createElement();
function flush(phase) {
  visits = peak = queued = 0;
  owner.flushBuild();
  let leaf = element;
  for (let i = 0; i < 129 && leaf.children.length === 1; i++) leaf = leaf.children[0];
  if (errors.length || visits !== 128 || peak !== 32 || queued < 3 || owner.hasDirty || !(leaf.widget instanceof SizedBox))
    throw Error(phase + ': visits=' + visits + ' peak=' + peak + ' errors=' + errors.join(';'));
  return leaf;
}
element.mount(undefined, owner);
const mounted = flush('mount');
tree = deep(); element.markNeedsBuild();
if (flush('update') !== mounted) throw Error('update replaced leaf Element');
element.unmount(); owner.dispose();
globalThis.deepTreeResult = 'mount=128 update=128 peakInline=32 leafReused=true';
`;

const host = `
#include <hermes/hermes.h>
#include <windows.h>
#include <filesystem>
#include <fstream>
#include <iostream>
namespace jsi = facebook::jsi;
int wmain(int argc, wchar_t** argv) {
  std::unique_ptr<facebook::hermes::HermesRuntime> runtime;
  try {
    wchar_t loaded[32768];
    auto vm = GetModuleHandleW(L"hermesvm.dll");
    if (argc != 3 || !vm || !GetModuleFileNameW(vm,loaded,32768) || !std::filesystem::equivalent(loaded,argv[2]))
      throw std::runtime_error("unexpected Hermes DLL");
    std::ifstream file(argv[1], std::ios::binary);
    std::string hbc{std::istreambuf_iterator<char>(file), {}};
    runtime = facebook::hermes::makeHermesRuntime(::hermes::vm::RuntimeConfig::Builder().withMicrotaskQueue(true).withEnableEval(false).build());
    runtime->evaluateJavaScript(std::make_shared<jsi::StringBuffer>(std::move(hbc)), "deep-tree.hbc");
    std::cout << runtime->global().getProperty(*runtime,"deepTreeResult").getString(*runtime).utf8(*runtime) << std::endl;
  } catch (const std::exception& error) { std::cerr << error.what() << std::endl; return 1; }
  return 0;
}`;

async function run(folder) {
  const hermes = path.join(root, '.nelyx/windows-hermes');
  const lib = path.join(hermes, 'build/lib');
  const env = { ...windowsCompilerEnvironment(), TMP: folder, TEMP: folder };
  const options = { cwd: folder, env, timeout };
  const bundled = await build({
    stdin: { contents: fixture, resolveDir: root },
    bundle: true,
    write: false,
    logLevel: 'silent',
    format: 'iife',
    target: 'es2022',
    tsconfigRaw: { compilerOptions: { useDefineForClassFields: true } },
  });
  const src = bundled.outputFiles[0].text;
  const { ast } = transformer.transform({
    src,
    filename: path.join(folder, 'fixture.js'),
    options: {
      projectRoot: root,
      platform: 'windows',
      dev: false,
      experimentalImportSupport: true,
      enableBabelRuntime: false,
    },
  });
  fs.writeFileSync(
    path.join(folder, 'fixture.js'),
    transformFromAstSync(ast, src, { configFile: false, babelrc: false, compact: false }).code,
  );
  fs.writeFileSync(path.join(folder, 'globals.js'), 'var Promise;\n');
  await execute(
    path.join(hermes, 'build/bin/hermesc.exe'),
    ['-O', '-include-globals', 'globals.js', '-emit-binary', '-out', 'fixture.hbc', 'fixture.js'],
    options,
  );
  const hbc = fs.readFileSync(path.join(folder, 'fixture.hbc'));
  if (hbc.subarray(0, 8).toString('hex') !== 'c61fbc03c103191f')
    throw Error('Missing Hermes bytecode');
  fs.writeFileSync(path.join(folder, 'host.cpp'), host);
  await execute(
    path.join(process.env.ProgramFiles, 'LLVM/bin/clang++.exe'),
    [
      'host.cpp',
      '-o',
      'host.exe',
      '-std=c++20',
      '-O2',
      '-fms-runtime-lib=dll',
      ...[
        'source/API',
        'source/API/jsi',
        'source/public',
        'source/include',
        'build/lib/config',
      ].map((dir) => '-I' + path.join(hermes, dir)),
      path.join(lib, 'hermesvm.lib'),
      path.join(hermes, 'build/jsi/jsi.lib'),
    ],
    options,
  );
  await execute(path.join(folder, 'host.exe'), ['fixture.hbc', path.join(lib, 'hermesvm.dll')], {
    ...options,
    env: { ...env, PATH: lib + path.delimiter + env.PATH },
  });
}

const parent = path.join(root, '.tmp');
if (process.argv[2] === '--child') {
  const folder = path.resolve(process.argv[3]);
  if (path.dirname(folder) !== parent || !path.basename(folder).startsWith('hermes-deep-tree-'))
    throw Error('Invalid fixture directory');
  await run(folder);
} else {
  fs.mkdirSync(parent, { recursive: true });
  const folder = fs.mkdtempSync(path.join(parent, 'hermes-deep-tree-'));
  try {
    await execute(process.execPath, [import.meta.filename, '--child', folder], {
      cwd: root,
      timeout,
    });
  } finally {
    if (!fs.lstatSync(folder).isSymbolicLink()) fs.rmSync(folder, { recursive: true, force: true });
  }
}
