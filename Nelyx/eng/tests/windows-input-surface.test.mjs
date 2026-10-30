// SPDX-License-Identifier: BSD-3-Clause
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { verifyWindowsInputs } from '../../sdk/tooling/cli/src/native-inputs.mjs';
import { windowsHermesProfileFlags } from './windows-hermes-profile.mjs';
import { verifyWindowsV8 } from '../../sdk/tooling/cli/src/windows-v8.mjs';
import {
  verifyWindowsStaticHermes,
  windowsStaticHermesPin,
} from '../../sdk/tooling/cli/src/windows-static-hermes.mjs';
import { nativeCohort } from '../../sdk/dist/runtime/cohorts.js';
import { bindNativeCoverage } from '../../sdk/tooling/static-aot/src/execution-plan.mjs';
import {
  buildStaticAotMetroBundle,
  compileWindowsStaticAot,
  staticAotBootstrap,
} from '../../sdk/tooling/cli/src/windows-static-aot.mjs';
const timeout = 1_200_000,
  root = path.resolve(import.meta.dirname, '../../..'),
  imeProbe = process.env.NELYX_WINDOWS_INPUT_IME === '1',
  closeOnly = process.env.NELYX_WINDOWS_INPUT_CLOSE_ONLY === '1';
const xml = (value) =>
  String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('"', '&quot;');
function run(file, args, options = {}) {
  const { nativeDiagnostics = false, ...execution } = options;
  const result = spawnSync(file, args, {
    encoding: 'utf8',
    windowsHide: true,
    timeout,
    maxBuffer: 4 * 1024 * 1024,
    ...execution,
  });
  if (nativeDiagnostics) process.stdout.write((result.stdout ?? '') + (result.stderr ?? ''));
  if (result.error) throw result.error;
  assert.equal(result.status, 0, (result.stdout ?? '') + (result.stderr ?? ''));
  return result.stdout;
}
test(
  'Public default Windows surface shares Core/Skia caret pixels, TSF, UIA and close owners with 50ms accessibility coalescing' +
    (imeProbe ? ' and configured Korean TSF IME' : ''),
  { timeout, skip: process.platform !== 'win32' },
  async (t) => {
    const engine = process.env.NELYX_WINDOWS_INPUT_ENGINE ?? 'hermes';
    assert(['hermes', 'v8'].includes(engine));
    const hermesMode = process.env.NELYX_WINDOWS_INPUT_HERMES_MODE ?? 'bytecode';
    assert(['bytecode', 'static-aot'].includes(hermesMode));
    const aot = hermesMode !== 'bytecode',
      typed = hermesMode === 'static-aot';
    if (aot) assert.equal(engine, 'hermes');
    const requestedRuntimes = (
      process.env.NELYX_WINDOWS_INPUT_HERMES_RUNTIMES ??
      process.env.NELYX_WINDOWS_INPUT_HERMES_RUNTIME ??
      (aot ? 'static-hermes' : 'supplier')
    ).split(',');
    assert(
      requestedRuntimes.length > 0 &&
        requestedRuntimes.length <= 2 &&
        new Set(requestedRuntimes).size === requestedRuntimes.length &&
        requestedRuntimes.every((value) => ['supplier', 'static-hermes'].includes(value)),
    );
    if (requestedRuntimes.includes('static-hermes')) assert.equal(engine, 'hermes');
    if (aot) assert.deepEqual(requestedRuntimes, ['static-hermes']);
    const staticToolchain = requestedRuntimes.includes('static-hermes')
      ? verifyWindowsStaticHermes(process.env.NELYX_STATIC_HERMES_INPUTS)
      : undefined;
    // The default fixture must exercise the public Release bytecode/minification.
    // Raw JS remains an explicit diagnostic so a green test cannot silently prove
    // a different compiler path from the Windows package.
    const requestedProfiles = (
      process.env.NELYX_WINDOWS_INPUT_HERMES_PROFILES ??
      process.env.NELYX_WINDOWS_INPUT_HERMES_OPT ??
      'optimized'
    ).split(',');
    assert(
      requestedProfiles.length > 0 &&
        requestedProfiles.length <= 6 &&
        new Set(requestedProfiles).size === requestedProfiles.length,
    );
    assert(
      !requestedProfiles.includes('raw-js') || requestedProfiles.length === 1,
      'Raw JS requires its own unminified bundle',
    );
    assert(engine === 'hermes' || requestedProfiles.length === 1);
    const hermesProfile = requestedProfiles[0] === 'raw-js' ? null : requestedProfiles[0],
      compilerFlags =
        engine === 'v8' || hermesProfile === null ? null : windowsHermesProfileFlags(hermesProfile);
    if (aot)
      assert.deepEqual(
        requestedProfiles,
        ['optimized'],
        'AOT uses one qualified optimizing profile',
      );
    const v8 =
      engine === 'v8'
        ? verifyWindowsV8(
            process.env.NELYX_WINDOWS_V8_INPUTS ??
              JSON.parse(
                fs.readFileSync(
                  path.join(root, 'sample/nelyx-testbed-app-2/.nelyx/windows/v8-inputs.json'),
                  'utf8',
                ),
              ).directory,
          )
        : undefined;
    const runner = fs.realpathSync(
        process.env.NELYX_WINDOWS_TEST_RUNNER ??
          path.join(root, 'sample/nelyx-testbed-app-2/windows/runner'),
      ),
      rnw = path.join(runner, 'node_modules/react-native-windows');
    assert(
      fs.statfsSync(root).bavail * fs.statfsSync(root).bsize >= 20 * 1024 ** 3,
      'Need 20 GiB for native build',
    );
    const inputs = verifyWindowsInputs({
      runner,
      input:
        process.env.NELYX_WINDOWS_NATIVE_INPUTS ??
        JSON.parse(
          fs.readFileSync(
            path.join(root, 'sample/nelyx-testbed-app-2/.nelyx/windows/native-inputs.json'),
            'utf8',
          ),
        ).input,
    });
    const vs = run(
      path.join(process.env['ProgramFiles(x86)'], 'Microsoft Visual Studio/Installer/vswhere.exe'),
      [
        '-latest',
        '-products',
        '*',
        '-requires',
        'Microsoft.VisualStudio.Component.VC.Tools.x86.x64',
        '-property',
        'installationPath',
      ],
    ).trim();
    assert(vs);
    const binding = path.join(runner, 'node_modules/@nelyx/skia-rn'),
      sdk = path.join(runner, 'node_modules/@nelyx/sdk/native/windows');
    const include = [
      binding,
      path.join(inputs.root, inputs.manifest.headers),
      ...[
        'native/windows',
        'generated/core',
        'generated/gpu',
        'generated/vulkan',
        'generated/host',
        'generated/jsi',
        'generated/native-vulkan',
        'generated/jsi/rnskia',
        'generated/jsi/api',
        'generated/jsi/jsi',
        'generated/jsi/utils',
        'generated/sdk/skia',
      ].map((name) => path.join(binding, name)),
    ];
    for (const name of fs
      .readdirSync(path.join(root, 'Nelyx/sdk/native/windows'))
      .filter((name) => name.endsWith('.h')))
      assert.deepEqual(
        fs.readFileSync(path.join(sdk, name)),
        fs.readFileSync(path.join(root, 'Nelyx/sdk/native/windows', name)),
        name,
      );
    for (const name of ['RNSkWindowsHost.h', 'SkiaView.h', 'WindowsKeyboardState.h'])
      assert.deepEqual(
        fs.readFileSync(path.join(binding, 'native/windows', name)),
        fs.readFileSync(path.join(root, 'Nelyx/skia/packages/rn/native/windows', name)),
        name,
      );
    for (const name of [
      'CompositorFrameClock.h',
      'WindowsKeyboardInput.h',
      'ObservedKeyboardState.h',
      'WindowsCharacterObservation.h',
      'WindowsInputTrace.h',
    ])
      assert.deepEqual(
        fs.readFileSync(path.join(binding, 'generated/host/windows', name)),
        fs.readFileSync(path.join(root, 'Nelyx/skia/native/host/windows', name)),
        name,
      );
    const libraries = inputs.manifest.libraries.map((name) => path.join(inputs.root, name));
    libraries.push('uiautomationcore.lib');
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'nelyx-windows-input-surface-')),
      entry = path.join(runner, 'nelyx-input-surface-' + process.pid + '.tsx');
    let entryOwned = false;
    try {
      fs.writeFileSync(
        path.join(directory, 'pch.h'),
        '#pragma once\n#include <windows.h>\n#undef GetCurrentTime\n#include <CppWinRTIncludes.h>\n#include <NativeModules.h>\n',
      );
      fs.writeFileSync(path.join(directory, 'pch.cpp'), '#include "pch.h"\n');
      fs.writeFileSync(
        path.join(directory, 'InputSurface.vcxproj'),
        `<Project DefaultTargets="Build" xmlns="http://schemas.microsoft.com/developer/msbuild/2003">
<PropertyGroup><ProjectGuid>{89581F39-BDB2-442A-BF44-6C4F3D31F187}</ProjectGuid><ProjectName>InputSurface</ProjectName><ReactNativeWindowsDir>${xml(rnw)}\\</ReactNativeWindowsDir><RnwNewArch>true</RnwNewArch><UseExperimentalNuget>true</UseExperimentalNuget><WindowsTargetPlatformVersion>10.0.26100.0</WindowsTargetPlatformVersion><AppxPackage>false</AppxPackage><UseBundle>false</UseBundle><WindowsAppSDKSelfContained>true</WindowsAppSDKSelfContained><RunAutolinkCheck>false</RunAutolinkCheck><RunCodegenWindows>false</RunCodegenWindows></PropertyGroup>
<Import Project="$(ReactNativeWindowsDir)PropertySheets/External/Microsoft.ReactNative.WindowsSdk.Default.props"/><Import Project="$(VCTargetsPath)Microsoft.Cpp.Default.props"/>
<ItemGroup Label="ProjectConfigurations"><ProjectConfiguration Include="Release|x64"><Configuration>Release</Configuration><Platform>x64</Platform></ProjectConfiguration></ItemGroup>
<PropertyGroup Label="Configuration"><ConfigurationType>Application</ConfigurationType><PlatformToolset>v145</PlatformToolset><CharacterSet>Unicode</CharacterSet><UseDebugLibraries>false</UseDebugLibraries></PropertyGroup>
<Import Project="$(VCTargetsPath)Microsoft.Cpp.props"/><Import Project="$(ReactNativeWindowsDir)PropertySheets/External/Microsoft.ReactNative.Composition.CppApp.props"/>
<PropertyGroup><OutDir>$(ProjectDir)out\\</OutDir><IntDir>$(ProjectDir)obj\\</IntDir><AutolinkCommandWorkingDir>${xml(runner)}</AutolinkCommandWorkingDir><CodegenCommandWorkingDir>${xml(runner)}</CodegenCommandWorkingDir></PropertyGroup>
<ItemDefinitionGroup><ClCompile><LanguageStandard>stdcpp20</LanguageStandard><PrecompiledHeader>Use</PrecompiledHeader><PrecompiledHeaderFile>pch.h</PrecompiledHeaderFile><PrecompiledHeaderOutputFile>$(IntDir)pch.pch</PrecompiledHeaderOutputFile><ForcedIncludeFiles>pch.h;%(ForcedIncludeFiles)</ForcedIncludeFiles><RuntimeLibrary>MultiThreadedDLL</RuntimeLibrary><Optimization>Disabled</Optimization><DebugInformationFormat>ProgramDatabase</DebugInformationFormat><AdditionalIncludeDirectories>$(ProjectDir);${xml(sdk)};${xml(include.join(';'))};%(AdditionalIncludeDirectories)</AdditionalIncludeDirectories><PreprocessorDefinitions>NDEBUG;_ITERATOR_DEBUG_LEVEL=0;SK_GRAPHITE;SK_VULKAN;SK_USE_INTERNAL_VULKAN_HEADERS;VK_NO_PROTOTYPES;VK_USE_PLATFORM_WIN32_KHR;SK_SHAPER_PRIMITIVE_AVAILABLE;SK_SHAPER_HARFBUZZ_AVAILABLE;SK_SHAPER_UNICODE_AVAILABLE;SK_UNICODE_ICU_IMPLEMENTATION;NELYX_SKOTTIE_PROPERTY_IMPLEMENTED=1;NOMINMAX;WIN32_LEAN_AND_MEAN;%(PreprocessorDefinitions)</PreprocessorDefinitions><AdditionalOptions>/bigobj %(AdditionalOptions)</AdditionalOptions></ClCompile><Link><SubSystem>Console</SubSystem><GenerateDebugInformation>true</GenerateDebugInformation><AdditionalDependencies>${xml(libraries.join(';'))};windowsapp.lib;user32.lib;gdi32.lib;d3d11.lib;dxgi.lib;dwrite.lib;usp10.lib;shlwapi.lib;ole32.lib;oleaut32.lib;uuid.lib;shell32.lib;dbghelp.lib;dwmapi.lib;%(AdditionalDependencies)</AdditionalDependencies></Link></ItemDefinitionGroup>
<ItemGroup><ClCompile Include="${xml(path.join(directory, 'pch.cpp'))}"><PrecompiledHeader>Create</PrecompiledHeader></ClCompile><ClCompile Include="${xml(path.join(import.meta.dirname, 'windows-input-surface.cpp'))}"/></ItemGroup>
<Import Project="$(VCTargetsPath)Microsoft.Cpp.targets"/><Import Project="$(ReactNativeWindowsDir)PropertySheets/External/Microsoft.ReactNative.Composition.CppApp.targets"/>
</Project>`,
      );
      fs.writeFileSync(
        path.join(directory, 'InputSurface.sln'),
        `Microsoft Visual Studio Solution File, Format Version 12.00
Project("{BC8A1FFA-BEE3-4634-8014-F334798102B3}") = "InputSurface", "InputSurface.vcxproj", "{89581F39-BDB2-442A-BF44-6C4F3D31F187}"
EndProject
Global
 GlobalSection(SolutionConfigurationPlatforms) = preSolution
  Release|x64 = Release|x64
 EndGlobalSection
 GlobalSection(ProjectConfigurationPlatforms) = postSolution
  {89581F39-BDB2-442A-BF44-6C4F3D31F187}.Release|x64.ActiveCfg = Release|x64
  {89581F39-BDB2-442A-BF44-6C4F3D31F187}.Release|x64.Build.0 = Release|x64
 EndGlobalSection
EndGlobal
`,
      );
      const assets = path.join(directory, 'out/Assets');
      fs.mkdirSync(assets, { recursive: true });
      fs.copyFileSync(path.join(inputs.root, inputs.manifest.icu), path.join(assets, 'icudtl.dat'));
      const font = fs.readFileSync(
        path.join(
          root,
          'Nelyx/sdk/tooling/cli/templates/nelyx-app/assets/RobotoSlab-VariableFont_wght.ttf',
        ),
      );
      fs.writeFileSync(path.join(assets, 'fixture.ttf'), font);
      fs.writeFileSync(
        entry,
        fs
          .readFileSync(path.join(import.meta.dirname, 'windows-input-surface.tsx'), 'utf8')
          .replace('__FONT_SHA__', createHash('sha256').update(font).digest('hex'))
          .replace('__IME_PROBE__', imeProbe ? '1' : '0')
          .replace('__CLOSE_ONLY__', closeOnly ? '1' : '0')
          .replace('__TYPED_PROBE__', typed ? '1' : '0')
          .replace(
            "profile:'rn-graphite-vulkan',cohort:'rn-0.83.10'",
            v8
              ? "profile:'rn-v8-graphite-vulkan',cohort:'rn-0.83.10-v8'"
              : "profile:'rn-graphite-vulkan',cohort:'rn-0.83.10'",
          ),
        { flag: 'wx' },
      );
      entryOwned = true;
      run(process.execPath, [
        path.join(root, 'node_modules/@typescript/native/bin/tsc'),
        '--noEmit',
        '--allowImportingTsExtensions',
        '--strict',
        '--skipLibCheck',
        '--jsx',
        'react',
        '--target',
        'ES2022',
        '--module',
        'ESNext',
        '--moduleResolution',
        'Bundler',
        '--esModuleInterop',
        '--types',
        'react',
        entry,
      ]);
      const load = createRequire(path.join(runner, 'package.json')),
        { runBuild, loadConfig } = load('metro'),
        bundle = path.join(directory, 'out/Bundle');
      fs.mkdirSync(bundle, { recursive: true });
      const config = await loadConfig({
        cwd: runner,
        config: path.join(runner, 'metro.config.cjs'),
        maxWorkers: 2,
      });
      if (v8)
        config.transformer = {
          ...config.transformer,
          babelTransformerPath: load.resolve('@nelyx/metro/native-v8-transformer'),
        };
      const partition = typed
        ? await buildStaticAotMetroBundle({
            runner,
            entry,
            source: path.join(bundle, 'input-surface.bundle'),
            map: path.join(bundle, 'input-surface.map'),
            config,
            signal: t.signal,
          })
        : undefined;
      if (!typed)
        await runBuild(config, {
          entry: path.basename(entry),
          platform: 'windows',
          dev: false,
          minify: engine === 'v8' || aot ? false : hermesProfile !== null,
          maxWorkers: 2,
          out: path.join(bundle, 'input-surface.bundle'),
          sourceMap: false,
        });
      if (!fs.existsSync(path.join(bundle, 'input-surface.bundle')))
        fs.renameSync(
          path.join(bundle, 'input-surface.bundle.js'),
          path.join(bundle, 'input-surface.bundle'),
        );
      const source = path.join(bundle, 'input-surface.source.js'),
        bytecode = path.join(bundle, 'input-surface.bundle'),
        compiler = path.join(
          process.env.USERPROFILE,
          '.nuget/packages/microsoft.javascript.hermes/0.0.0-2604.21001-94aa5e1d/tools/native/release/x64/hermes.exe',
        );
      if (compilerFlags) fs.renameSync(bytecode, source);
      run(
        path.join(vs, 'MSBuild/Current/Bin/MSBuild.exe'),
        [
          path.join(directory, 'InputSurface.sln'),
          '/restore',
          '/m:2',
          '/nodeReuse:false',
          '/verbosity:minimal',
          '/p:Configuration=Release',
          '/p:Platform=x64',
          `/p:AutolinkCommandWorkingDir=${runner}`,
          `/p:CodegenCommandWorkingDir=${runner}`,
        ],
        { cwd: runner },
      );
      if (v8)
        for (const record of v8.manifest.files) {
          const destination = path.join(directory, 'out', record.path);
          fs.mkdirSync(path.dirname(destination), { recursive: true });
          fs.copyFileSync(path.join(v8.directory, record.path), destination);
        }
      if (aot) {
        const hermesDirectory = path.join(
          process.env.USERPROFILE,
          '.nuget/packages/microsoft.javascript.hermes/0.0.0-2604.21001-94aa5e1d',
        );
        const compilation = {
          toolchain: staticToolchain.directory,
          source,
          output: path.join(directory, 'out', windowsStaticHermesPin.library),
          hermesDirectory,
          cohort: nativeCohort('windows'),
          signal: t.signal,
        };
        const metadata = await compileWindowsStaticAot({
          ...compilation,
          typedSource: path.join(bundle, 'index.windows.typed.ts'),
          partitionSha256: partition.irSha256,
          diagnosticMap: partition,
        });
        const coverage = bindNativeCoverage(partition.executionPlan, metadata.build, metadata);
        assert.equal(
          coverage.summary.wholeAppNativeAot,
          true,
          'Input flow requires full-runtime native coverage',
        );
        console.log('INPUT_AOT_COVERAGE ' + JSON.stringify(coverage.summary));
        fs.writeFileSync(bytecode, staticAotBootstrap);
      }
      const failures = [];
      for (const runtime of requestedRuntimes)
        for (const profile of requestedProfiles) {
          if (engine === 'hermes')
            fs.copyFileSync(
              runtime === 'static-hermes'
                ? path.join(staticToolchain.directory, 'build/API/hermes_shared/hermes.dll')
                : path.join(
                    process.env.USERPROFILE,
                    '.nuget/packages/microsoft.javascript.hermes/0.0.0-2604.21001-94aa5e1d/build/native/win32/x64/hermes.dll',
                  ),
              path.join(directory, 'out/hermes.dll'),
            );
          const flags = compilerFlags ? windowsHermesProfileFlags(profile) : null;
          console.log(
            'INPUT_SURFACE_CONFIG ' +
              JSON.stringify({
                scope: closeOnly ? 'close-producer-only' : 'full-input-and-close',
                engine,
                hermesMode,
                runtime:
                  runtime === 'static-hermes' ? staticToolchain.manifest.runtimeSha256 : 'supplier',
                hermesProfile: v8 ? null : profile,
                compilerFlags: flags,
                bytecode: !aot && flags !== null,
                minified: engine === 'v8' || aot ? false : hermesProfile !== null,
              }),
          );
          try {
            if (flags && !aot) {
              run(compiler, [...flags, '-emit-binary', '-out', bytecode, source]);
              assert.equal(fs.readFileSync(bytecode).readUInt32LE(8), 99);
            }
            const output = run(
              path.join(directory, 'out/InputSurface.exe'),
              [...(process.env.NELYX_WINDOWS_INPUT_DEBUG === '1' ? ['--debug'] : []), bundle],
              {
                cwd: path.join(directory, 'out'),
                nativeDiagnostics: true,
                env: { ...process.env, NELYX_WINDOWS_INPUT_ENGINE: engine },
              },
            );
            assert.doesNotMatch(
              output,
              /REACT_ERROR|Windows UI requires its active JS platform/,
              'Close must fence late platform work before releasing its UI owner',
            );
            assert.match(output, /PASS-input-surface/);
            assert.match(output, /INPUT_CLOSE_PRODUCER admitted=1 before=active/);
            assert.match(output, /INPUT_CLOSE_PRODUCER after=closing/);
            assert.match(output, /closed views=0 consumers=0 gpuDrained=1 inputRetired=1/);
            if (!closeOnly) {
              const queued = output
                .split(/\r?\n/)
                .find((line) => line.startsWith('INPUT_QUEUED_FOCUS '));
              assert(queued, 'Actual queued UIA focus evidence is missing');
              const value = JSON.parse(queued.slice('INPUT_QUEUED_FOCUS '.length));
              assert(
                value.publishedCommit > value.capturedCommit &&
                  value.strictRejected === true &&
                  value.accepted === true &&
                  value.nativeFocusRetained === true,
                'The native focus receipt did not survive a newer React commit',
              );
              const passive = output
                .split(/\r?\n/)
                .find((line) => line.startsWith('INPUT_PASSIVE_FOCUS '));
              assert(passive, 'Actual passive native focus evidence is missing');
              assert.deepEqual(JSON.parse(passive.slice('INPUT_PASSIVE_FOCUS '.length)), {
                queuedNativeRetained: true,
                canvasPreserved: true,
                explicitUiaRestored: true,
              });
            }
            if (aot) assert.match(output, /INPUT_AOT_NATIVE module=loaded/);
            if (typed) assert.match(output, /INPUT_TYPED_EXECUTION/);
          } catch (error) {
            console.log('INPUT_SURFACE_PROFILE_FAILED ' + profile);
            failures.push(error);
          }
        }
      if (failures.length) throw new AggregateError(failures, 'Native input profiles failed');
    } finally {
      if (entryOwned) {
        assert.equal(path.dirname(entry), runner);
        assert(!fs.lstatSync(entry).isSymbolicLink());
        fs.unlinkSync(entry);
      }
      assert.equal(path.dirname(directory), fs.realpathSync(os.tmpdir()));
      assert(path.basename(directory).startsWith('nelyx-windows-input-surface-'));
      assert(!fs.lstatSync(directory).isSymbolicLink());
      fs.rmSync(directory, { recursive: true, force: true, maxRetries: 20, retryDelay: 250 });
    }
  },
);
