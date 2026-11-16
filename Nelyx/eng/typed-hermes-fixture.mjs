// SPDX-License-Identifier: BSD-3-Clause
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { execute } from '../sdk/tooling/cli/src/commands.mjs';
import { compileHermesImage } from '../sdk/tooling/cli/src/windows-hermes-image.mjs';
import { windowsCompilerEnvironment } from '../sdk/tooling/cli/src/windows-static-hermes.mjs';
import { verifyNativeHermes } from '../sdk/tooling/cli/src/windows-native-hermes-toolchain.mjs';

// A console-only owner for two SHUnits of the canonical VM. No SDK/package or
// DLL is copied. Destroy every JSI value/runtime before unloading the image.
const host = `
#include <hermes/hermes.h>
#include <jsi/instrumentation.h>
#include <windows.h>
#include <filesystem>
#include <iostream>
namespace jsi=facebook::jsi;
int wmain(int argc,wchar_t** argv){
  HMODULE image=nullptr;
  std::unique_ptr<facebook::hermes::HermesRuntime> runtime;
  int result=1;
  try{
    if(argc!=3)throw std::runtime_error("fixture arguments");
    wchar_t loaded[32768];
    const auto vm=GetModuleHandleW(L"hermesvm.dll");
    if(!vm||!GetModuleFileNameW(vm,loaded,32768)||!std::filesystem::equivalent(loaded,argv[2]))throw std::runtime_error("fixture VM identity");
    image=LoadLibraryExW(argv[1],nullptr,LOAD_LIBRARY_SEARCH_DLL_LOAD_DIR|LOAD_LIBRARY_SEARCH_DEFAULT_DIRS);
    if(!image)throw std::runtime_error("fixture SHUnit load");
    {
      runtime=facebook::hermes::makeHermesRuntime(::hermes::vm::RuntimeConfig::Builder().withEnableEval(false).build());
      auto& rt=*runtime;
      rt.global().setProperty(rt,"__nelyxFixtureGc",jsi::Function::createFromHostFunction(rt,jsi::PropNameID::forAscii(rt,"__nelyxFixtureGc"),0,[](auto& current,auto const&,auto const*,size_t){current.instrumentation().collectGarbage("typed Source qualification");return jsi::Value::undefined();}));
      for(const auto* name:{"sh_export_nelyx_typed","sh_export_nelyx_app"}){
        const auto creator=reinterpret_cast<SHUnitCreator>(GetProcAddress(image,name));
        if(!creator)throw std::runtime_error("fixture unit export");
        runtime->evaluateSHUnit(creator);
      }
      std::cout<<"TYPED_FIXTURE_RESULT "<<rt.global().getProperty(rt,"__nelyxFixtureResult").getString(rt).utf8(rt)<<std::endl;
    }
    result=0;
  }catch(std::exception const& error){std::cerr<<error.what()<<std::endl;}
  // Exception values retire at the catch boundary while their VM is alive.
  runtime.reset();
  if(image)FreeLibrary(image);
  return result;
}
`;

export async function withTypedHermesFixture(action) {
  const root = path.resolve(import.meta.dirname, '../..'),
    checked = verifyNativeHermes(path.join(root, '.nelyx/windows-hermes')),
    env = windowsCompilerEnvironment(),
    parent = path.join(root, '.tmp'),
    folder = fs.mkdtempSync(path.join(parent, 'typed-source-'));
  try {
    const cpp = path.join(folder, 'host.cpp'),
      exe = path.join(folder, 'host.exe');
    fs.writeFileSync(cpp, host);
    const clang = path.join(process.env.ProgramFiles, 'LLVM/bin/clang++.exe');
    await execute(
      clang,
      [
        cpp,
        '-o',
        exe,
        '-std=c++20',
        '-O2',
        '-fms-runtime-lib=dll',
        ...[
          'source/API',
          'source/API/jsi',
          'source/public',
          'source/include',
          'build/lib/config',
        ].map((relative) => '-I' + path.join(checked.directory, relative)),
        path.join(checked.directory, 'build/lib/hermesvm.lib'),
        path.join(checked.directory, 'build/jsi/jsi.lib'),
      ],
      { cwd: folder, env, timeout: 1_200_000 },
    );
    const runtimeEnv = {
      ...env,
      PATH: path.join(checked.directory, 'build/lib') + path.delimiter + env.PATH,
    };
    await action({
      checked,
      async run({ name, source, driver, flags, typed = false, evidence = false, inspect }) {
        if (!/^[a-z-]+$/.test(name)) throw Error('Invalid typed fixture name');
        const input = path.join(folder, name + '.ts'),
          script = path.join(folder, name + '-driver.js'),
          output = path.join(folder, name + '.dll');
        fs.writeFileSync(input, source);
        fs.writeFileSync(script, driver);
        const build = await compileHermesImage({
          checked,
          env,
          output,
          runtimeLibrary: path.join(checked.directory, 'build/lib/hermesvm.lib'),
          units: [
            { name: 'nelyx_typed', source: input, flags, typed, evidence },
            { name: 'nelyx_app', source: script, flags: ['-O'] },
          ],
        });
        if (inspect) {
          const dumped = spawnSync(
            path.join(checked.directory, 'build/bin/shermes.exe'),
            [...flags, '-dump-ir', input],
            {
              cwd: folder,
              env,
              timeout: 1_200_000,
              windowsHide: true,
              encoding: 'utf8',
              maxBuffer: 8 * 1024 * 1024,
            },
          );
          if (dumped.error || dumped.status !== 0)
            throw new Error('Typed Source IR compilation failed', {
              cause: dumped.error ?? dumped.stderr,
            });
          inspect({ ir: dumped.stdout + dumped.stderr, build });
        }
        await execute(exe, [output, path.join(checked.directory, 'build/lib/hermesvm.dll')], {
          cwd: folder,
          env: runtimeEnv,
          timeout: 1_200_000,
        });
        console.log(
          'TYPED_FIXTURE_MODE ' + JSON.stringify({ name, toolchainSha256: checked.sha256 }),
        );
      },
    });
  } finally {
    /* oxlint-disable no-unsafe-finally -- Preserve a changed fixture owner instead of deleting it. */
    if (path.dirname(folder) !== parent || fs.lstatSync(folder).isSymbolicLink())
      throw Error('Typed Source fixture cleanup owner differs');
    /* oxlint-enable no-unsafe-finally */
    fs.rmSync(folder, { recursive: true, force: true });
  }
}
