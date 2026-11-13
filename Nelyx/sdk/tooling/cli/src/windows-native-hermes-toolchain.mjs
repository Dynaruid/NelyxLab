// SPDX-License-Identifier: BSD-3-Clause
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execute } from './commands.mjs';
import { sha256, localFile } from './files.mjs';
import { nativeHermesSourceTree as sourceTree } from './windows-native-hermes-source.mjs';
import { openNativeBuildCache } from './native-build-cache.mjs';
import { windowsCompilerEnvironment, refreshWindowsCmakeTools } from './windows-static-hermes.mjs';
import { windowsNativeHermesPin } from './windows-native-hermes-pin.mjs';
import { patchStaticHermesCompiler } from './static-hermes-compiler-patch.mjs';
import { windowsHermesPolicy } from './windows-hermes-policy.mjs';
import { windowsNativeHermesCohort } from '@nelyx/sdk/runtime/cohorts';
import {
  prepareWindowsNativeIcu,
  verifyWindowsNativeIcu,
  windowsNativeIcuRuntimeFiles,
} from './windows-native-icu.mjs';
const timeout = 1_200_000;
const producer = () =>
  createHash('sha256')
    .update(
      JSON.stringify(
        [
          'windows-native-hermes-toolchain.mjs',
          'windows-native-hermes-pin.mjs',
          'windows-native-icu.mjs',
          'static-hermes-compiler-patch.mjs',
          'windows-hermes-policy.mjs',
          'windows-static-hermes.mjs',
          'windows-native-hermes-source.mjs',
        ].map((name) => [name, sha256(path.join(import.meta.dirname, name))]),
      ),
    )
    .digest('hex');
const names = [
  windowsNativeHermesPin.icu.archive,
  ...windowsNativeHermesPin.icu.files.map((file) => 'icu/' + file.path),
  ...windowsNativeIcuRuntimeFiles.flatMap((file) => ['build/bin/' + file, 'build/lib/' + file]),
  'hermes-source.tar.gz',
  'build/lib/hermesvm.dll',
  'build/lib/hermesvm.lib',
  'build/jsi/jsi.lib',
  'build/bin/shermes.exe',
  'build/bin/hermesc.exe',
  'build/lib/config/libhermesvm-config.h',
  'build/lib/InternalJavaScript/internal_unit.c',
  'build/lib/InternalJavaScript/InternalBytecode.js',
  'source/API/hermes/hermes.h',
  'source/API/jsi/jsi/jsi.h',
  'source/include/hermes/VM/static_h.h',
  'source/lib/IRGen/ESTreeIRGen-legacy-class.cpp',
  'source/lib/IRGen/ESTreeIRGen-func.cpp',
  'source/lib/BCGen/SH/SH.cpp',
  'source/lib/BCGen/HBC/Passes.cpp',
  'source/lib/CMakeLists.txt',
  'source/cmake/modules/Hermes.cmake',
  'source/API/jsi/jsi/CMakeLists.txt',
  'source/lib/InternalJavaScript/CMakeLists.txt',
  'build/CMakeCache.txt',
];
function verifyFiles(directory, manifest) {
  if (!Array.isArray(manifest.files) || !manifest.files.length)
    throw Error('Native Hermes toolchain inventory missing');
  for (const record of manifest.files)
    if (sha256(localFile(directory, record.path)) !== record.sha256)
      throw Error('Native Hermes toolchain differs: ' + record.path);
}
export function verifyNativeHermes(directory) {
  directory = fs.realpathSync(directory);
  const manifest = JSON.parse(fs.readFileSync(path.join(directory, 'native-hermes.json'), 'utf8'));
  if (
    manifest.schema !== 'nelyx.native-hermes-toolchain/v3' ||
    manifest.producerSha256 !== producer() ||
    manifest.release !== windowsNativeHermesPin.version ||
    manifest.revision !== windowsNativeHermesPin.revision ||
    manifest.sourceSha256 !== windowsNativeHermesPin.sourceSha256 ||
    manifest.jsi !== windowsNativeHermesPin.jsi ||
    manifest.jsiHeaderSha256 !== windowsNativeHermesPin.jsiHeaderSha256 ||
    manifest.bytecodeVersion !== 99 ||
    manifest.heap !== 'HEAP_HV_64' ||
    manifest.crt !== 'MD' ||
    manifest.compilerClassSpill !== windowsNativeHermesPin.compilerClassSpill ||
    manifest.icu?.version !== windowsNativeHermesPin.icu.version ||
    manifest.icu.archiveSha256 !== windowsNativeHermesPin.icu.archiveSha256 ||
    manifest.internalJavaScript?.mode !== 'native' ||
    manifest.internalJavaScript.compilerPolicy !==
      windowsHermesPolicy('optimized', windowsNativeHermesCohort()).id ||
    manifest.debugger !== false ||
    manifest.jit !== false
  )
    throw Error('Native Hermes pin/configuration/producer differs; prepare the current supplier');
  if (
    manifest.files.length !== names.length ||
    new Set(manifest.files.map((file) => file.path)).size !== names.length ||
    names.some((name) => !manifest.files.some((file) => file.path === name))
  )
    throw Error('Native Hermes toolchain inventory differs');
  verifyFiles(directory, manifest);
  verifyWindowsNativeIcu(directory);
  if (
    !fs
      .readFileSync(path.join(directory, 'build/CMakeCache.txt'), 'utf8')
      .includes('HERMES_ENABLE_INTL:BOOL=ON')
  )
    throw Error('Native Hermes must preserve the Windows Intl implementation');
  if (sourceTree(path.join(directory, 'source')) !== manifest.sourceTreeSha256)
    throw Error('Native Hermes source tree changed');
  return { directory, manifest, sha256: sha256(path.join(directory, 'native-hermes.json')) };
}
export async function prepareNativeHermes({ directory, signal } = {}) {
  if (!directory) throw Error('Choose the native Hermes toolchain directory');
  directory = path.resolve(directory);
  fs.mkdirSync(directory, { recursive: true });
  if (fs.realpathSync(directory) !== directory)
    throw Error('Native Hermes toolchain symlink rejected');
  const manifestFile = path.join(directory, 'native-hermes.json'),
    recorded = fs.existsSync(manifestFile)
      ? JSON.parse(fs.readFileSync(manifestFile, 'utf8'))
      : null;
  if (recorded) {
    verifyFiles(directory, recorded);
    if (
      recorded.sourceTreeSha256 &&
      sourceTree(path.join(directory, 'source')) !== recorded.sourceTreeSha256
    )
      throw Error('Native Hermes source tree changed; supplied inputs were preserved');
    if (recorded.producerSha256 === producer()) return verifyNativeHermes(directory);
  }
  const owner = openNativeBuildCache(path.join(directory, 'owner'));
  try {
    const archive = path.join(directory, 'hermes-source.tar.gz'),
      source = path.join(directory, 'source'),
      build = path.join(directory, 'build'),
      env = windowsCompilerEnvironment();
    const icu = await prepareWindowsNativeIcu(directory, { env, signal });
    if (!fs.existsSync(archive)) {
      const response = await fetch(windowsNativeHermesPin.sourceUrl, {
        signal: signal
          ? AbortSignal.any([signal, AbortSignal.timeout(120000)])
          : AbortSignal.timeout(120000),
      });
      if (!response.ok) throw Error('Native Hermes source HTTP ' + response.status);
      const bytes = Buffer.from(await response.arrayBuffer());
      if (createHash('sha256').update(bytes).digest('hex') !== windowsNativeHermesPin.sourceSha256)
        throw Error('Native Hermes archive differs');
      fs.writeFileSync(archive, bytes);
    }
    if (sha256(archive) !== windowsNativeHermesPin.sourceSha256)
      throw Error('Native Hermes archive differs');
    if (!fs.existsSync(path.join(source, 'CMakeLists.txt'))) {
      fs.mkdirSync(source, { recursive: true });
      await execute('tar.exe', ['-xzf', archive, '-C', source, '--strip-components=1'], {
        env,
        signal,
        timeout,
      });
    }
    patchSource(source);
    const check = fs.mkdtempSync(path.join(directory, '.source-check-'));
    let sourceTreeSha256;
    try {
      await execute('tar.exe', ['-xzf', archive, '-C', check, '--strip-components=1'], {
        env,
        signal,
        timeout,
      });
      patchSource(check);
      sourceTreeSha256 = sourceTree(check);
      if (sourceTree(source) !== sourceTreeSha256)
        throw Error('Native Hermes source differs from the pinned archive and current patches');
    }
    /* oxlint-disable no-unsafe-finally -- Reject cleanup when directory ownership or rollback safety cannot be established. */
    finally {
      if (
        path.dirname(check) !== directory ||
        !path.basename(check).startsWith('.source-check-') ||
        fs.lstatSync(check).isSymbolicLink()
      )
        throw Error('Unexpected Hermes source-check owner');
      fs.rmSync(check, { recursive: true, force: true });
    }
    /* oxlint-enable no-unsafe-finally */
    const clang = path.join(process.env.ProgramFiles, 'LLVM/bin/clang-cl.exe');
    const assembler = path.join(env.VCTOOLSINSTALLDIR, 'bin/Hostx64/x64/ml64.exe');
    if (!fs.existsSync(assembler)) throw Error('Current MSVC x64 assembler is unavailable');
    refreshWindowsCmakeTools(build, env);
    await execute(
      'cmake',
      [
        '-S',
        source,
        '-B',
        build,
        '-G',
        'Ninja',
        '-DCMAKE_BUILD_TYPE=Release',
        `-DCMAKE_C_COMPILER=${clang}`,
        `-DCMAKE_CXX_COMPILER=${clang}`,
        `-DCMAKE_ASM_MASM_COMPILER=${assembler}`,
        '-DCMAKE_MSVC_RUNTIME_LIBRARY=MultiThreadedDLL',
        '-DHERMES_ENABLE_DEBUGGER=OFF',
        '-DHERMES_ENABLE_TEST_SUITE=OFF',
        '-DHERMES_ENABLE_CORE_EXTENSIONS=ON',
        '-DHERMES_ENABLE_INTL=ON',
        '-DHERMES_ENABLE_WIN10_ICU_FALLBACK=OFF',
        '-DHERMES_USE_STATIC_ICU=OFF',
        '-DICU_ROOT=' + icu,
        '-DICU_INCLUDE_DIR=' + path.join(icu, 'include'),
        '-DICU_UC_LIBRARY_RELEASE=' + path.join(icu, 'lib64/icuuc.lib'),
        '-DICU_I18N_LIBRARY_RELEASE=' + path.join(icu, 'lib64/icuin.lib'),
        '-DICU_DATA_LIBRARY_RELEASE=' + path.join(icu, 'lib64/icudt.lib'),
        '-DHERMESVM_HEAP_HV_MODE=HEAP_HV_64',
        '-DHERMESVM_ALLOW_JIT=0',
        '-DHERMESVM_INTERNAL_JAVASCRIPT_NATIVE=ON',
        '-DSHERMES_CC=clang',
      ],
      { env, signal, timeout },
    );
    await execute(
      'cmake',
      ['--build', build, '--target', 'hermesvm', 'hermesc', 'shermes', 'jsi', '--parallel', '2'],
      { env, signal, timeout },
    );
    if (sourceTree(source) !== sourceTreeSha256)
      throw Error('Native Hermes source changed during compilation');
    const policy = windowsHermesPolicy('optimized', windowsNativeHermesCohort());
    const manifest = {
      schema: 'nelyx.native-hermes-toolchain/v3',
      producerSha256: producer(),
      release: windowsNativeHermesPin.version,
      revision: windowsNativeHermesPin.revision,
      sourceSha256: windowsNativeHermesPin.sourceSha256,
      sourceTreeSha256,
      bytecodeVersion: 99,
      jsi: windowsNativeHermesPin.jsi,
      jsiHeaderSha256: windowsNativeHermesPin.jsiHeaderSha256,
      heap: 'HEAP_HV_64',
      crt: 'MD',
      compilerClassSpill: windowsNativeHermesPin.compilerClassSpill,
      icu: {
        version: windowsNativeHermesPin.icu.version,
        archiveSha256: windowsNativeHermesPin.icu.archiveSha256,
      },
      internalJavaScript: {
        mode: 'native',
        compilerPolicy: policy.id,
        sourceSha256: sha256(path.join(build, 'lib/InternalJavaScript/InternalBytecode.js')),
      },
      debugger: false,
      jit: false,
      files: names.map((name) => ({ path: name, sha256: sha256(path.join(directory, name)) })),
    };
    fs.writeFileSync(manifestFile, JSON.stringify(manifest, null, 2) + '\n');
    return verifyNativeHermes(directory);
  } finally {
    owner.close();
  }
}
function write(file, text) {
  if (fs.readFileSync(file, 'utf8') !== text) fs.writeFileSync(file, text);
}
function patchSource(source) {
  if (sha256(path.join(source, 'API/jsi/jsi/jsi.h')) !== windowsNativeHermesPin.jsiHeaderSha256)
    throw Error('Pinned upstream Hermes JSI header differs');
  patchStaticHermesCompiler(source, { upstreamClassSpill: true });
  // Upstream's MSVC whole-archive option uses a target name as a filename.
  // Resolve the actual archive path, as the Windows fork does for DLL links.
  const libraries = path.join(source, 'lib/CMakeLists.txt');
  let libraryText = fs.readFileSync(libraries, 'utf8');
  for (const target of ['hermesvm', 'hermesvmlean']) {
    const original = `target_link_options(${target} PRIVATE /WHOLEARCHIVE:${target}_a)`;
    const replacement = `target_link_options(${target} PRIVATE "LINKER:/WHOLEARCHIVE:$<TARGET_FILE:${target}_a>")`;
    if (libraryText.split(original).length === 2)
      libraryText = libraryText.replace(original, replacement);
    else if (!libraryText.includes(replacement))
      throw Error('Pinned Hermes Windows whole-archive link changed');
  }
  write(libraries, libraryText);
  const flags = path.join(source, 'cmake/modules/Hermes.cmake');
  let text = fs.readFileSync(flags, 'utf8');
  const begin = text.indexOf('function(hermes_update_cxx_flags name)'),
    end = text.indexOf('endfunction()', begin);
  if (begin < 0 || end < 0) throw Error('Pinned Hermes C++ configuration changed');
  text =
    text.slice(0, begin) +
    text
      .slice(begin, end)
      .replaceAll(
        'if (GCC_COMPATIBLE)',
        'if (GCC_COMPATIBLE AND NOT CMAKE_CXX_COMPILER_FRONTEND_VARIANT STREQUAL "MSVC")',
      ) +
    text.slice(end);
  // clang-cl has MSVC predefined macros. Match the Windows supplier's guard:
  // upstream LLVM headers intentionally test undefined GNU macros on Windows.
  text = text.replace(
    'macro(hermes_enable_werror_undef)\n  if (GCC_COMPATIBLE)',
    'macro(hermes_enable_werror_undef)\n  if (GCC_COMPATIBLE AND NOT CLANG_CL)',
  );
  write(flags, text);
  // The pinned Windows module otherwise overrides the requested /MD cohort
  // with hybrid /MT. Respect the explicit runtime selected by this supplier.
  const windows = path.join(source, 'cmake/modules/HermesWindows.cmake');
  if (fs.existsSync(windows))
    write(
      windows,
      fs
        .readFileSync(windows, 'utf8')
        .replace(
          'if(NOT CMAKE_SYSTEM_NAME STREQUAL "WindowsStore")',
          'if(NOT DEFINED CMAKE_MSVC_RUNTIME_LIBRARY AND NOT CMAKE_SYSTEM_NAME STREQUAL "WindowsStore")',
        ),
    );
  // Direct C++ host entry points must be present in hermesvm.dll's import
  // library, including the public RuntimeConfig/CrashManager destructors.
  for (const [relative, target] of [
    ['API/hermes/CMakeLists.txt', 'hermesapi_obj'],
    ['public/hermes/Public/CMakeLists.txt', 'hermesPublic_obj'],
  ]) {
    const file = path.join(source, relative),
      marker = '# Nelyx direct Hermes DLL exports';
    write(
      file,
      fs.readFileSync(file, 'utf8').split(marker)[0].trimEnd() +
        `\n\n${marker}\nif(WIN32)\n  target_compile_definitions(${target} PRIVATE CREATE_SHARED_LIBRARY)\nendif()\n`,
    );
  }
  const jsi = path.join(source, 'API/jsi/jsi/CMakeLists.txt'),
    marker = '# Nelyx direct Hermes exception ownership';
  const jsiText = fs.readFileSync(jsi, 'utf8').split(marker)[0].trimEnd();
  write(
    jsi,
    jsiText +
      '\n\n' +
      marker +
      '\nif(MSVC)\n  target_compile_options(jsi PRIVATE /EHsc)\nendif()\n',
  );
  const internal = path.join(source, 'lib/InternalJavaScript/CMakeLists.txt'),
    policy = windowsHermesPolicy('optimized', windowsNativeHermesCohort());
  let internalText = fs.readFileSync(internal, 'utf8');
  const command = /COMMAND \$\{shermes_EXE\} .* -g0 -w -emit-c -exported-unit=internal_unit/;
  if (!command.test(internalText)) throw Error('Pinned Hermes native builtins command differs');
  internalText = internalText.replace(
    command,
    'COMMAND ${shermes_EXE} ' +
      policy.flags.join(' ') +
      ' -g0 -w -emit-c -exported-unit=internal_unit',
  );
  if (!internalText.includes('# Nelyx direct builtin floating point'))
    internalText = internalText.replace(
      '  target_compile_options(hermesInternalUnit_obj PRIVATE -w)',
      '  target_compile_options(hermesInternalUnit_obj PRIVATE -w)\n  # Nelyx direct builtin floating point\n  target_compile_options(hermesInternalUnit_obj PRIVATE /clang:-ffp-contract=off /clang:-fno-fast-math)',
    );
  write(internal, internalText);
}
