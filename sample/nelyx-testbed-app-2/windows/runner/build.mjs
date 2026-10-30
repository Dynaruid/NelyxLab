// SPDX-License-Identifier: BSD-3-Clause
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import { verifyWindowsJsc, windowsJscMode } from '@nelyx/cli/windows-jsc';
import { verifyWindowsV8 } from '@nelyx/cli/windows-v8';
import { windowsHermesPolicy } from '@nelyx/cli/windows-hermes-policy';
import { verifyWindowsStaticHermes } from '@nelyx/cli/windows-static-hermes';
import {
  buildStaticAotMetroBundle,
  writeStaticAotApplication,
} from '@nelyx/cli/windows-static-aot';
import { windowsHermesExecutionMode } from '@nelyx/cli/windows-aot-mode';
import { resetWindowsBuildAssets } from '@nelyx/cli/windows-package-lifecycle';
import { createProviderRegistry } from '@nelyx/sdk/runtime/providers';
const runner = import.meta.dirname,
  app = path.resolve(runner, '../..'),
  load = createRequire(import.meta.url);
load('@nelyx/metro/runner-config').inspectRunnerCohort({ target: 'windows', runnerRoot: runner });
const args = process.argv.slice(2),
  options = {};
while (args.length) {
  const key = args.shift(),
    value = args.shift();
  if (
    ![
      '--native-inputs',
      '--configuration',
      '--engine',
      '--engine-inputs',
      '--hermes-profile',
      '--hermes-mode',
      '--jsc-mode',
    ].includes(key) ||
    !value ||
    value.startsWith('--') ||
    Object.hasOwn(options, key)
  )
    throw Error(
      'Usage: node build.mjs [--native-inputs <manifest>] [--configuration Debug|Release] [--engine hermes|v8|jsc] [--engine-inputs <directory>] [--hermes-profile debug|optimized] [--hermes-mode bytecode|static-aot] [--jsc-mode jit|interpreter]',
    );
  options[key] = value;
}
const configuration = options['--configuration'] ?? 'Release';
if (!['Debug', 'Release'].includes(configuration)) throw Error('Choose Debug or Release');
const engine = options['--engine'] ?? 'hermes';
if (!['hermes', 'v8', 'jsc'].includes(engine)) throw Error('Choose hermes, v8 or jsc');
if (options['--jsc-mode'] !== undefined) windowsJscMode(options['--jsc-mode'], engine);
if (engine === 'jsc' && options['--hermes-profile'] !== undefined)
  throw Error('--hermes-profile requires Hermes');
const hermesMode = windowsHermesExecutionMode(options['--hermes-mode']);
if (engine === 'hermes')
  options['--hermes-profile'] ??= configuration === 'Release' ? 'optimized' : 'debug';
if (
  hermesMode !== 'bytecode' &&
  (engine !== 'hermes' ||
    configuration !== 'Release' ||
    options['--hermes-profile'] !== 'optimized')
)
  throw Error('Static Hermes requires Hermes Release and the optimized compiler profile');
const aot =
  hermesMode !== 'bytecode'
    ? verifyWindowsStaticHermes(path.resolve(options['--engine-inputs'] ?? ''))
    : undefined;
let typedPartition;
const v8 =
  engine === 'v8' ? verifyWindowsV8(path.resolve(options['--engine-inputs'] ?? '')) : undefined;
const jsc =
    engine === 'jsc' ? verifyWindowsJsc(path.resolve(options['--engine-inputs'] ?? '')) : undefined,
  jscExecutionMode = jsc ? windowsJscMode(options['--jsc-mode']) : null;
const hermes =
  v8 || jsc
    ? null
    : windowsHermesPolicy(options['--hermes-profile'], createProviderRegistry().cohort('windows'));
const hermesCompilerFlags = hermes?.flags.join(' ') ?? null;
const v8CompilerPolicy = v8 ? load('@nelyx/metro/native-v8-transformer').compilerPolicy : null;
const jscCompilerPolicy = jsc ? load('@nelyx/metro/native-jsc-transformer').compilerPolicy : null;
const input = path.resolve(
  options['--native-inputs'] ??
    process.env.NELYX_WINDOWS_NATIVE_INPUTS ??
    path.join(app, '.nelyx/windows-native/inputs.json'),
);
const supply = fs.realpathSync(path.dirname(input)),
  manifest = JSON.parse(fs.readFileSync(input, 'utf8'));
if (
  manifest.schema !== 'nelyx.rnw-native-inputs/v1' ||
  manifest.rnw !== '0.83.2' ||
  manifest.architecture !== 'x64' ||
  manifest.crt !== 'MD' ||
  manifest.configuration !== 'Release'
)
  throw new Error('Exact RNW0.83.2 x64 Release/MD native supply required');
const sha = (file) => createHash('sha256').update(fs.readFileSync(file)).digest('hex');
function checked(base, relative) {
  if (
    typeof relative !== 'string' ||
    !relative ||
    relative.includes('\\') ||
    relative.split('/').some((part) => !part || part === '.' || part === '..') ||
    path.isAbsolute(relative)
  )
    throw new Error('Invalid native input path');
  const file = path.join(base, relative),
    actual = fs.realpathSync(file),
    rel = path.relative(base, actual);
  if (
    rel.startsWith('..') ||
    path.isAbsolute(rel) ||
    actual !== file ||
    fs.lstatSync(file).isSymbolicLink()
  )
    throw new Error('Native input outside real supply directory');
  return file;
}
if (
  !Array.isArray(manifest.files) ||
  !manifest.files.length ||
  !Array.isArray(manifest.libraries) ||
  manifest.libraries.length !== 18
)
  throw new Error('Incomplete native supply inventory');
const files = new Map();
for (const entry of manifest.files) {
  const file = checked(supply, entry.file);
  if (files.has(entry.file) || sha(file) !== entry.sha256)
    throw new Error('Native supply file changed: ' + entry.file);
  files.set(entry.file, file);
}
const binding = path.join(runner, 'node_modules/@nelyx/skia-rn');
for (const [relative, digest] of Object.entries(manifest.sources)) {
  if (sha(checked(binding, relative)) !== digest)
    throw new Error('Native compiled source changed; rebuild binding: ' + relative);
}
function list(directory, relative = '') {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    if (entry.isSymbolicLink()) throw new Error('Source symlink');
    const name = path.posix.join(relative, entry.name);
    return entry.isDirectory() ? list(path.join(directory, entry.name), name) : [name];
  });
}
const required = [
  'generated/jsi',
  'generated/native-vulkan',
  'generated/core',
  'generated/gpu',
  'generated/vulkan',
  'generated/host',
  'native/vulkan',
].flatMap((folder) => list(path.join(binding, folder), folder));
if (
  required.length !== Object.keys(manifest.sources).length ||
  required.some((name) => !Object.hasOwn(manifest.sources, name))
)
  throw new Error('Native compiled source inventory incomplete');
const libraries = manifest.libraries.map((name) => {
  if (!files.has(name)) throw new Error('Unlisted native library');
  return files.get(name);
});
if (!files.has(manifest.icu)) throw new Error('Pinned ICU input absent');
const headerRoot = checked(supply, manifest.headers);
if (list(headerRoot, manifest.headers).some((name) => !files.has(name)))
  throw new Error('Unlisted native header');
const config = JSON.parse(fs.readFileSync(path.join(runner, 'app-config.json'), 'utf8'));
if (!/^[A-Z][A-Za-z0-9]*$/.test(config.name) || !Array.isArray(config.assets))
  throw new Error('Generate runner app-config.json from package.json nelyx configuration first');
const verifiedAssets = load('@nelyx/metro/assets').verifyAppAssets(app, config.assets);
const assets = new Map();
for (const entry of verifiedAssets) assets.set(entry.path.slice(2), entry.file);
const state = path.join(app, '.nelyx/windows');
fs.mkdirSync(state, { recursive: true });
function writeChanged(file, value) {
  if (!fs.existsSync(file) || fs.readFileSync(file, 'utf8') !== value)
    fs.writeFileSync(file, value);
}
const sdkInputsSha256 = process.env.NELYX_WINDOWS_SDK_INPUTS_SHA256 ?? null;
if (sdkInputsSha256 !== null && !/^[a-f0-9]{64}$/.test(sdkInputsSha256))
  throw Error('Invalid Windows SDK build input identity');
// Content changes must invalidate native compilation even when npm archives
// preserve older header timestamps. This header is included by the host TU.
writeChanged(
  path.join(state, 'NelyxAppConfig.h'),
  '// Generated from app-config.json\n#define NELYX_APP_NAME L"' +
    config.name +
    '"\n#define NELYX_WINDOWS_DEVELOPMENT ' +
    (configuration === 'Debug' ? 1 : 0) +
    '\n#define NELYX_WINDOWS_V8 ' +
    (v8 ? 1 : 0) +
    '\n#define NELYX_WINDOWS_SDK_INPUTS_SHA256 "' +
    (sdkInputsSha256 ?? 'untracked') +
    '"\n',
);
const sdk = path.dirname(load.resolve('@nelyx/sdk/package.json'));
const include = [
  state,
  path.join(sdk, 'native/windows'),
  path.join(binding, 'native/windows'),
  binding,
  ...[
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
  ].map((name) => path.join(binding, name)),
  headerRoot,
];
const xml = (value) =>
  String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('"', '&quot;');
const definitions =
  'SK_GRAPHITE;SK_VULKAN;SK_USE_INTERNAL_VULKAN_HEADERS;VK_NO_PROTOTYPES;VK_USE_PLATFORM_WIN32_KHR;NOMINMAX;WIN32_LEAN_AND_MEAN;SK_SHAPER_PRIMITIVE_AVAILABLE;SK_SHAPER_HARFBUZZ_AVAILABLE;SK_SHAPER_UNICODE_AVAILABLE;SK_UNICODE_ICU_IMPLEMENTATION;NELYX_SKOTTIE_PROPERTY_IMPLEMENTED=1';
// The prebuilt Skia/JSI closure is Release/MD. Debug optimizes the app host off,
// emits PDBs and enables explicit RN dev settings while keeping that exact ABI.
// XML preserves the custom pass list's commas without MSBuild /p list parsing.
writeChanged(
  path.join(app, 'windows/Directory.Build.targets'),
  `<Project xmlns="http://schemas.microsoft.com/developer/msbuild/2003"><PropertyGroup><HermesCompilerFlags>${xml(hermesCompilerFlags ?? '')}</HermesCompilerFlags></PropertyGroup><ItemDefinitionGroup><ClCompile><RuntimeLibrary>MultiThreadedDLL</RuntimeLibrary><Optimization>${configuration === 'Debug' ? 'Disabled' : 'MaxSpeed'}</Optimization><LanguageStandard>stdcpp20</LanguageStandard><UndefinePreprocessorDefinitions>_DEBUG;DEBUG;SK_DEBUG;%(UndefinePreprocessorDefinitions)</UndefinePreprocessorDefinitions><PreprocessorDefinitions>NDEBUG;_ITERATOR_DEBUG_LEVEL=0;${definitions};%(PreprocessorDefinitions)</PreprocessorDefinitions><AdditionalIncludeDirectories>${xml(include.join(';'))};%(AdditionalIncludeDirectories)</AdditionalIncludeDirectories></ClCompile><Link><IgnoreSpecificDefaultLibraries>libucrt.lib;libucrtd.lib</IgnoreSpecificDefaultLibraries><AdditionalOptions>/defaultlib:ucrt.lib</AdditionalOptions><AdditionalDependencies>${xml(libraries.join(';'))};d3d11.lib;dxgi.lib;shlwapi.lib;dwrite.lib;usp10.lib;gdi32.lib;ole32.lib;uuid.lib;%(AdditionalDependencies)</AdditionalDependencies></Link></ItemDefinitionGroup></Project>\n`,
);
const vswhere = path.join(
  process.env['ProgramFiles(x86)'],
  'Microsoft Visual Studio/Installer/vswhere.exe',
);
function run(command, args, cwd = runner) {
  const result = spawnSync(command, args, { cwd, stdio: 'inherit', windowsHide: true });
  if (result.error || result.status)
    throw new Error(String(result.error ?? `Command failed (${result.status}): ${command}`));
}
const vs = spawnSync(
  vswhere,
  [
    '-latest',
    '-products',
    '*',
    '-requires',
    'Microsoft.VisualStudio.Component.VC.Tools.x86.x64',
    '-property',
    'installationPath',
  ],
  { encoding: 'utf8', windowsHide: true },
);
if (vs.status || !vs.stdout.trim()) throw new Error('Visual Studio C++ workload required');
const cli = load.resolve('@react-native-community/cli/build/bin.js');
run(process.execPath, [cli, 'autolink-windows', '--no-telemetry']);
run(process.execPath, [cli, 'codegen-windows', '--no-telemetry']);
const windows = path.join(app, 'windows'),
  rnw = path.join(runner, 'node_modules/react-native-windows');
run(path.join(vs.stdout.trim(), 'MSBuild/Current/Bin/MSBuild.exe'), [
  path.join(windows, 'NelyxRNHost.sln'),
  '/target:NelyxRNHost',
  '/restore',
  '/m:2',
  '/nodeReuse:false',
  '/verbosity:minimal',
  `/p:Configuration=${configuration}`,
  '/p:Platform=x64',
  '/p:UseDebugLibraries=false',
  '/p:WindowsTargetPlatformVersion=10.0.26100.0',
  '/p:WindowsAppSDKSelfContained=true',
  `/p:UseBundle=${v8 || jsc || aot ? 'false' : 'true'}`,
  '/p:UseDevBundle=false',
  '/p:BundleEntryFile=main.tsx',
  `/p:BundleCommandWorkingDir=${runner}`,
  `/p:AutolinkCommandWorkingDir=${runner}`,
  `/p:CodegenCommandWorkingDir=${runner}`,
  `/p:ReactNativeWindowsDir=${rnw}\\`,
  `/p:SolutionDir=${windows}\\`,
  '/p:BundlerExtraArgs=--max-workers=2',
]);
const output = path.join(windows, 'x64', configuration),
  assetRoot = resetWindowsBuildAssets({ app, configuration });
if (v8 || jsc || aot) {
  const { runBuild, loadConfig } = load('metro'),
    bundle = path.join(output, aot ? 'Bundle/index.windows.aot.js' : 'Bundle/index.windows.bundle'),
    map = path.join(output, 'sourcemaps/react/index.windows.bundle.map');
  fs.mkdirSync(path.dirname(bundle), { recursive: true });
  fs.mkdirSync(path.dirname(map), { recursive: true });
  const metroConfig = await loadConfig({
      cwd: runner,
      config: path.join(runner, 'metro.config.cjs'),
    }),
    nativeV8Transformer = load.resolve(
      jsc ? '@nelyx/metro/native-jsc-transformer' : '@nelyx/metro/native-v8-transformer',
    );
  if (
    ![load.resolve('@react-native/metro-babel-transformer'), nativeV8Transformer].includes(
      metroConfig.transformer.babelTransformerPath,
    )
  )
    throw Error(
      'Windows V8 owns the RN Babel transformer; configure custom Babel plugins in babel.config.cjs',
    );
  if (hermesMode === 'static-aot')
    typedPartition = await buildStaticAotMetroBundle({
      runner,
      entry: path.join(runner, 'main.tsx'),
      source: bundle,
      map,
      config: metroConfig,
    });
  else
    await runBuild(
      v8 || jsc
        ? {
            ...metroConfig,
            transformer: { ...metroConfig.transformer, babelTransformerPath: nativeV8Transformer },
          }
        : metroConfig,
      {
        entry: 'main.tsx',
        platform: 'windows',
        dev: false,
        minify: false,
        maxWorkers: 2,
        bundleOut: bundle,
        sourceMapOut: map,
        sourceMap: true,
        sourceMapUrl: path.relative(path.dirname(bundle), map).replaceAll('\\', '/'),
      },
    );
  if (v8) {
    for (const record of v8.manifest.files) {
      const destination = path.join(output, record.path);
      fs.mkdirSync(path.dirname(destination), { recursive: true });
      fs.copyFileSync(path.join(v8.directory, record.path), destination);
    }
    fs.copyFileSync(path.join(v8.directory, 'v8-engine.json'), path.join(output, 'v8-engine.json'));
  }
}
if (jsc) {
  for (const record of jsc.manifest.files) {
    const destination = path.join(output, record.path);
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.copyFileSync(path.join(jsc.directory, record.path), destination);
  }
  fs.copyFileSync(
    path.join(jsc.directory, 'jsc-engine.json'),
    path.join(output, 'jsc-engine.json'),
  );
  writeChanged(path.join(output, 'jsc-mode.txt'), jscExecutionMode + '\n');
}
if (!v8 && !jsc) {
  // An incremental copy must not retain the previous source engine supplier's RNW DLL.
  const restored = JSON.parse(
      fs.readFileSync(path.join(windows, 'NelyxRNHost/obj/project.assets.json'), 'utf8'),
    ),
    stock = restored.libraries['Microsoft.ReactNative/0.83.2'];
  if (stock?.type !== 'package' || stock.path !== 'microsoft.reactnative/0.83.2')
    throw Error('Pinned stock RNW restore missing');
  const candidates = Object.keys(restored.packageFolders)
    .map((base) =>
      path.join(base, stock.path, 'runtimes/win10-x64/native/Microsoft.ReactNative.dll'),
    )
    .filter((file) => fs.existsSync(file));
  if (candidates.length !== 1) throw Error('Ambiguous stock RNW supplier');
  fs.copyFileSync(candidates[0], path.join(output, 'Microsoft.ReactNative.dll'));
}
if (!v8)
  for (const name of [
    'v8-engine.json',
    'v8jsi.dll',
    'licenses/V8-LICENSE',
    'licenses/V8-NOTICE.txt',
  ])
    fs.rmSync(path.join(output, name), { force: true });
if (!jsc)
  for (const name of [
    'jsc-engine.json',
    'jsc-mode.txt',
    'JavaScriptCore.dll',
    'icuin77.dll',
    'icuuc77.dll',
    'icudt77.dll',
    'licenses/JSC-COPYING.LIB',
    'licenses/JSC-API-LICENSE',
    'licenses/JSC-SOURCE.txt',
    'licenses/ICU-LICENSE',
    'licenses/RN-JSC-LICENSE',
  ])
    fs.rmSync(path.join(output, name), { force: true });
const hermesDirectory = path.join(
  process.env.USERPROFILE,
  '.nuget/packages/microsoft.javascript.hermes/0.0.0-2604.21001-94aa5e1d',
);
// Incremental MSBuild may retain a newer AOT VM when switching engines/modes.
if (!aot)
  fs.copyFileSync(
    path.join(hermesDirectory, 'build/native/win32/x64/hermes.dll'),
    path.join(output, 'hermes.dll'),
  );
if (aot) {
  const compilation = {
    toolchain: aot.directory,
    source: path.join(output, 'Bundle/index.windows.aot.js'),
    directory: output,
    bundle: path.join(output, 'Bundle/index.windows.bundle'),
    hermesDirectory,
    cohort: createProviderRegistry().cohort('windows'),
  };
  await writeStaticAotApplication({
    ...compilation,
    typedSource: path.join(output, 'Bundle/index.windows.typed.ts'),
    partition: typedPartition,
    cacheDirectory: path.join(state, 'static-aot-cache'),
  });
} else
  for (const name of [
    'static-aot-app.json',
    'static-aot-execution.json',
    'static-aot-type-policy.json',
    'static-aot-native-pc.json',
    'NelyxApp.aot.dll',
    'Bundle/index.windows.aot.js',
    'Bundle/index.windows.aot.map',
    'Bundle/index.windows.typed.ts',
    'Bundle/index.windows.typed.map.json',
    'Bundle/index.windows.rnw-pal.js',
  ])
    fs.rmSync(path.join(output, name), { force: true });
for (const [name, file] of assets) {
  const destination = path.join(assetRoot, name);
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.copyFileSync(file, destination);
}
for (const entry of verifiedAssets) {
  const destination = path.join(assetRoot, entry.path.slice(2));
  if (fs.statSync(destination).size !== entry.bytes || sha(destination) !== entry.sha256)
    throw new Error('Copied app asset changed during build: ' + entry.id);
}
load('@nelyx/metro/assets').copyAppNotices(app, config.assets, path.join(assetRoot, 'licenses'));
fs.copyFileSync(files.get(manifest.icu), path.join(assetRoot, 'icudtl.dat'));
const executable = path.join(output, 'NelyxRNHost.exe');
if (!fs.existsSync(executable)) throw new Error('Native exe output absent');
fs.writeFileSync(
  path.join(state, 'last-build.json'),
  JSON.stringify(
    {
      schema: 'nelyx.rnw-build/v1',
      runner,
      output,
      executable,
      exeSha256: sha(executable),
      nativeInputsSha256: sha(input),
      sdkInputsSha256,
      configuration,
      engine,
      engineInputsSha256: jsc?.sha256 ?? v8?.sha256 ?? aot?.sha256 ?? null,
      jscExecutionMode,
      jscCompilerPolicy,
      hermesExecutionMode: hermesMode,
      v8CompilerPolicy,
      hermesCompilerFlags,
      hermesCompilerProfile: hermes?.profile ?? null,
      hermesCompilerPolicy: hermes?.id ?? null,
      nativeBindingConfiguration: 'Release',
      crt: 'MD',
      iteratorDebugLevel: 0,
      architecture: 'x64',
      app: config.name,
    },
    null,
    2,
  ) + '\n',
);
console.log(
  JSON.stringify({ result: 'PASS-scoped', output, exeSha256: sha(executable), app: config.name }),
);
