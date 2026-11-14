// SPDX-License-Identifier: BSD-3-Clause
// One owned execution: exact current App/engine, pinned V8 consumer, no SDK
// copy or installed App, and no mutation of any current dist/manifest. All
// downloaded bytes, generated hosts and build intermediates die in finally.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { spawn, spawnSync } from 'node:child_process';
import { createInterface } from 'node:readline';
import { windowsV8Pin, patchV8Microtasks } from '../sdk/tooling/cli/src/windows-v8.mjs';
import { windowsCompilerEnvironment } from '../sdk/tooling/cli/src/windows-static-hermes.mjs';
import {
  verifyEngineV2Supply,
  verifyEngineV2Application,
} from '../sdk/tooling/cli/src/engine-v2-runner.mjs';
import { engineRoot, sourceIdentity } from '../engine/tools/build.mjs';
import { verifyPackageSourceInputs } from './package-source-inputs.mjs';

const root = path.resolve(import.meta.dirname, '../..');
const parent = fs.realpathSync(path.join(root, '.nelyx'));
const temporary = fs.mkdtempSync(path.join(parent, 'runtime-comparison-'));
const deadline = Date.now() + 1_170_000;
const controller = new AbortController();
const deadlineTimer = setTimeout(
  () => controller.abort(Error('Runtime comparison exceeded 20 minutes')),
  1_170_000,
);
const interrupted = () => controller.abort(Error('Owned runtime comparison interrupted'));
process.once('SIGINT', interrupted);
process.once('SIGTERM', interrupted);
const hash = (value) => createHash('sha256').update(value).digest('hex');
const hashFile = (file) => hash(fs.readFileSync(file));
const xml = (value) =>
  String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('"', '&quot;');
const forward = (value) => value.replaceAll('\\', '/');
const quotePS = (value) => "'" + value.replaceAll("'", "''") + "'";
const replaceOne = (source, before, after) => {
  assert.equal(source.split(before).length, 2, 'Comparison seam moved: ' + before.slice(0, 100));
  return source.replace(before, after);
};
const environment = windowsCompilerEnvironment();
const pathKey = Object.keys(environment).find((key) => key.toLowerCase() === 'path') ?? 'PATH';
const supplyDirectory = path.join(engineRoot, 'dist');
const sdk = path.join(supplyDirectory, 'windows-app-sdk');
const appDirectory = path.join(root, 'sample/nelyx-demo-app/engine-v2');
const bundleDirectory = path.join(appDirectory, 'dist/v2-windows');
const appJs = path.join(bundleDirectory, 'application/app.js');
const hermes = path.join(root, '.nelyx/windows-hermes');
const ownedChildren = new Set();
function killOwned(pid) {
  if (pid)
    spawnSync('taskkill.exe', ['/pid', String(pid), '/t', '/f'], {
      windowsHide: true,
      timeout: 10000,
      stdio: 'ignore',
    });
}
async function run(command, args, { env = environment, observe, cwd = temporary } = {}) {
  controller.signal.throwIfAborted();
  const remaining = deadline - Date.now();
  if (remaining <= 0) throw Error('Runtime comparison deadline expired');
  return await new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      env,
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    ownedChildren.add(child);
    const lines = [];
    const expired = () => killOwned(child.pid);
    controller.signal.addEventListener('abort', expired, { once: true });
    const timer = setTimeout(expired, remaining);
    for (const stream of [child.stdout, child.stderr])
      createInterface({ input: stream }).on('line', (line) => {
        lines.push(line);
        if (lines.length > 80) lines.shift();
        observe?.(line);
      });
    child.on('error', (error) => {
      clearTimeout(timer);
      controller.signal.removeEventListener('abort', expired);
      ownedChildren.delete(child);
      reject(error);
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      controller.signal.removeEventListener('abort', expired);
      ownedChildren.delete(child);
      if (code === 0 && !controller.signal.aborted) resolve(lines);
      else reject(Error(path.basename(command) + ' exit ' + code + '\n' + lines.join('\n')));
    });
  });
}
function identity() {
  const supply = verifyEngineV2Supply(supplyDirectory, 'windows', 'windows-app-sdk');
  assert.equal(sourceIdentity(), supply.manifest.sourceSha256, 'Current engine source differs');
  const application = verifyEngineV2Application(bundleDirectory, 'windows');
  assert(application.manifest.nativeUnit, 'The baseline Demo must use its qualified native unit');
  for (const packageDirectory of ['Nelyx', 'Nelyx/sdk', 'packages/material'])
    verifyPackageSourceInputs(path.join(root, packageDirectory));
  return {
    engine: supply.manifest.sourceSha256,
    js: hashFile(appJs),
    application: hashFile(path.join(bundleDirectory, 'app-manifest.json')),
    engineManifest: hashFile(path.join(supplyDirectory, 'engine-manifest.json')),
  };
}
async function interactive(executable, base) {
  controller.signal.throwIfAborted();
  await new Promise((resolve, reject) => {
    const child = spawn(executable, [supplyDirectory, '--app', bundleDirectory], {
      cwd: root,
      env: {
        ...environment,
        NELYX_COMPARE_V8_JITLESS: '0',
        NELYX_V2_CPU_PROFILE: '0',
        NELYX_WINDOWS_INPUT_TRACE: '0',
      },
      windowsHide: true,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    ownedChildren.add(child);
    let ready = false;
    const lines = [];
    const expired = () => killOwned(child.pid);
    controller.signal.addEventListener('abort', expired, { once: true });
    const startupTimer = setTimeout(expired, 60_000);
    for (const stream of [child.stdout, child.stderr])
      createInterface({ input: stream }).on('line', (line) => {
        lines.push(line);
        if (lines.length > 16) lines.shift();
        if (line.startsWith('V2_RUNTIME_COMPARISON') || line.includes('V2_HOST_ERROR'))
          console.log(line);
        if (!ready && line.includes('"kind":"app-ready"')) {
          ready = true;
          clearTimeout(startupTimer);
          // Automated admission/build has a 20-minute deadline. The requested
          // interactive App stays alive until the user closes its actual window.
          clearTimeout(deadlineTimer);
          console.log(
            'RUNTIME_COMPARISON_MANUAL_READY ' +
              JSON.stringify({ pid: child.pid, executable, runtime: 'v8-jit', base }),
          );
        }
      });
    child.on('error', reject);
    child.on('close', (code) => {
      clearTimeout(startupTimer);
      controller.signal.removeEventListener('abort', expired);
      ownedChildren.delete(child);
      if (code === 0 && ready) resolve();
      else reject(Error('Interactive V8 host exit ' + code + '\n' + lines.join('\n')));
    });
    // Keep stdin open for the host's console owner. UI input is native.
    child.stdin.write('\n');
  });
}
function hostSource(source) {
  source = source.replaceAll('\r\n', '\n');
  source = replaceOne(
    source,
    '#include "app_heap_clock.hpp"',
    '#include "app_heap_clock.hpp"\n#include "' +
      forward(path.join(import.meta.dirname, 'windows-v8-comparison.hpp')) +
      '"',
  );
  // The vendor C ABI uses the global jsi::abi namespace; keep the host's
  // ordinary alias local to this generated translation unit under another name.
  source = replaceOne(source, 'namespace jsi=facebook::jsi;', 'namespace appjsi=facebook::jsi;');
  source = source.replace(/(?<!:)\bjsi::/g, 'appjsi::');
  source = source
    .replaceAll('facebook::hermes::HermesRuntime*&', 'appjsi::Runtime*&')
    .replaceAll('facebook::hermes::HermesRuntime*', 'appjsi::Runtime*');
  const factory = source
    .split('\n')
    .find((line) => line.includes('auto runtime=facebook::hermes::makeHermesRuntime('));
  assert(factory, 'Hermes factory absent');
  source = replaceOne(
    source,
    factory,
    '      nelyx::diagnostics::ComparisonV8 comparison([this]{wakeApp();});\n      auto& runtime=comparison.runtime;',
  );
  source = replaceOne(
    source,
    'const auto heapClock=profiling?',
    'if(profiling)throw std::runtime_error("Hermes CPU profiling is unavailable in the V8 comparison");\n      const auto heapClock=profiling?',
  );
  source = replaceOne(
    source,
    'const auto info=runtime.instrumentation().getHeapInfo(false);',
    'const auto info=nelyx::diagnostics::comparisonV8Heap(runtime);',
  );
  source = replaceOne(
    source,
    'info.find("hermes_heapSize"),external=info.find("hermes_externalBytes")',
    'info.find("totalHeapSize"),external=info.find("externalMemory")',
  );
  source = replaceOne(
    source,
    'const auto bytes=uint64_t(heap->second)+outside-duplicate;',
    'const auto bytes=uint64_t(heap->second)+outside-duplicate+uint64_t(info.at("mallocedMemory"))+uint64_t(info.at("totalGlobalHandlesSize"));',
  );
  source = source.replaceAll('Hermes App heap', 'V8 comparison App heap');
  const begin = source.indexOf('      if(nativeUnit){\n');
  const end = source.indexOf('      rt.drainMicrotasks();', begin);
  assert(begin > 0 && end > begin, 'App loader seam absent');
  source =
    source.slice(0, begin) +
    `      if(nativeUnit)throw std::runtime_error("V8 comparison cannot load a Hermes native unit");
      std::osyncstream(std::cout)<<"V2_APP_EXECUTION {\\"kind\\":\\"v8-source\\",\\"entry\\":\\"application/app.js\\"}"<<std::endl;
      const auto source=readFile(appDirectory+"/application/app.js");
      rt.evaluateJavaScript(std::make_shared<appjsi::StringBuffer>(std::string(source.begin(),source.end())),"application/app.js");
` +
    source.slice(end);
  source = replaceOne(
    source,
    '        const auto turnStarted=now();',
    '        const auto turnStarted=now();\n        comparison.foreground->pump();',
  );
  source = replaceOne(
    source,
    '          buffer.setExternalMemoryPressure(rt,holder->size());holder->creditGc();',
    `          // V8 already accounts its ArrayBuffer backing store. Its pinned
          // pressure hint only adds a never-released amount; do not double it.
          // Deduplicate a host lease only when V8 actually aliases its storage.
          const bool aliases=buffer.data(rt)==holder->data();
          comparison.response(aliases,holder->size());if(aliases)holder->creditGc();`,
  );
  source = replaceOne(
    source,
    'appRuntime->asyncTriggerTimeout();',
    'nelyx::diagnostics::comparisonV8Timeout(appRuntime);',
  );
  source = replaceOne(
    source,
    '    nw::AppSdkLoop appSdk;',
    '    nelyx::diagnostics::ComparisonSdkActivation comparisonActivation(argv[1]);\n    nw::AppSdkLoop appSdk;',
  );
  return source;
}
try {
  const base = identity();
  console.log('RUNTIME_COMPARISON_BASE ' + JSON.stringify(base));
  const archive = path.join(temporary, 'v8.nupkg');
  const response = await fetch(windowsV8Pin.url, { signal: controller.signal });
  if (!response.ok) throw Error('Pinned V8 download failed: ' + response.status);
  const bytes = Buffer.from(await response.arrayBuffer());
  assert.equal(hash(bytes), windowsV8Pin.sha256, 'Pinned V8 archive differs');
  fs.writeFileSync(archive, bytes);
  const vendor = path.join(temporary, 'v8');
  await run('python', [
    '-c',
    `import zipfile,pathlib
root=pathlib.Path(${JSON.stringify(vendor)}).resolve()
with zipfile.ZipFile(${JSON.stringify(archive)}) as package:
 for name in package.namelist():
  if not name.startswith(('build/native/include/','build/native/jsi/','build/native/win-x64/','runtimes/win-x64/native/')) or name.endswith(('.pdb','.xml','/')): continue
  if name.startswith('build/native/jsi/jsi/'): continue
  target=(root/name).resolve()
  if root not in target.parents: raise RuntimeError('Vendor extraction escaped its owner')
  target.parent.mkdir(parents=True,exist_ok=True)
  target.write_bytes(package.read(name))
`,
  ]);
  fs.unlinkSync(archive);
  const include = path.join(vendor, 'build/native/include');
  const adapter = path.join(vendor, 'build/native/jsi');
  const binary = path.join(vendor, 'runtimes/win-x64/native');
  assert.equal(
    hashFile(path.join(binary, 'v8jsi.dll')),
    '106b7a596430f3de3d51c02534b31ad2c85c7df205fbdd803459ec7f26e9f250',
  );
  environment[pathKey] = [binary, sdk, environment[pathKey]].join(path.delimiter);
  const patchedAdapter = path.join(temporary, 'JsiAbiRuntime.cpp');
  fs.writeFileSync(
    patchedAdapter,
    '#define JSI_CONST_10 const\n#define JSI_NO_CONST_3\n#define JSI_NOEXCEPT_15 noexcept\n' +
      patchV8Microtasks(
        fs
          .readFileSync(path.join(adapter, 'jsi_abi/JsiAbiRuntime.cpp'), 'utf8')
          .replace(/\r+\n/g, '\n'),
      ),
  );
  const common = [
    '/nologo',
    '/std:c++20',
    '/EHsc',
    '/MD',
    '/O2',
    '/DNDEBUG',
    '/DNOMINMAX',
    '/DJSI_VERSION=19',
    '/I' + path.join(hermes, 'source/API/jsi'),
    '/I' + include,
    '/I' + adapter,
    '/I' + import.meta.dirname,
  ];
  const cpp = path.join(temporary, 'probe.cpp');
  fs.writeFileSync(
    cpp,
    `#include "windows-v8-comparison.hpp"
#include <filesystem>
#include <fstream>
#include <sstream>
namespace fj=facebook::jsi;
struct Buffer final:fj::MutableBuffer{
  std::vector<uint8_t> bytes=std::vector<uint8_t>(32768,37);int& finalized;
  explicit Buffer(int& count):finalized(count){}~Buffer(){++finalized;}
  size_t size()const override{return bytes.size();}uint8_t* data()override{return bytes.data();}
};
int main(int argc,char**argv){try{int finalized=0;
if(argc==3){nelyx::diagnostics::ComparisonSdkActivation activation(argv[2]);activation.admit();std::cout<<"RUNTIME_COMPARISON_SDK_ADMISSION_PASS"<<std::endl;}
{
  nelyx::diagnostics::ComparisonV8 owner([]{});auto& rt=*owner.runtime;
  {auto holder=std::make_shared<Buffer>(finalized);auto data=fj::ArrayBuffer(rt,holder);
    const bool alias=data.data(rt)==holder->data();owner.response(alias,holder->size());
    if(data.size(rt)!=32768||data.data(rt)[32767]!=37)throw std::runtime_error("V8 buffer contents differ");
    rt.global().setProperty(rt,"comparisonBuffer",std::move(data));holder.reset();}
  auto result=rt.evaluateJavaScript(std::make_shared<fj::StringBuffer>("(()=>{const a=new Uint8Array(comparisonBuffer);if(a.length!==32768||a[17]!==37)throw Error('buffer');a[17]=53;return a[17];})()"),"nelyx:v8-buffer-admission");
  if(result.asNumber()!=53)throw std::runtime_error("V8 writable buffer differs");
  if(argc>=2){std::ifstream file(std::filesystem::path(argv[1]),std::ios::binary);std::stringstream text;text<<file.rdbuf();
    rt.evaluateJavaScript(std::make_shared<fj::StringBuffer>(text.str()),"nelyx:current-App-module-initialization");rt.drainMicrotasks();}
  owner.heap(rt);
}if(finalized!=1)throw std::runtime_error("V8 buffer lifetime was not released exactly once");
std::cout<<"RUNTIME_COMPARISON_ADMISSION_PASS"<<std::endl;return 0;
}catch(const fj::JSError& error){std::cerr<<error.getStack()<<std::endl;return 1;}
catch(const std::exception& error){std::cerr<<error.what()<<std::endl;return 1;}}
`,
  );
  const library = path.join(vendor, 'build/native/win-x64/v8jsi.dll.lib');
  await run('cl.exe', [
    ...common,
    cpp,
    patchedAdapter,
    path.join(adapter, 'public/V8JsiRuntime.cpp'),
    path.join(hermes, 'build/jsi/jsi.lib'),
    'ole32.lib',
    'runtimeobject.lib',
    library,
    '/Fe:' + path.join(temporary, 'probe.exe'),
  ]);
  const init = path.join(temporary, 'app-init.js');
  fs.writeFileSync(
    init,
    replaceOne(fs.readFileSync(appJs, 'utf8'), 'launchApp(app_default);', 'void app_default;'),
  );
  for (const mode of process.argv.includes('--interactive') ? ['jit'] : ['jit', 'jitless']) {
    const lines = await run(path.join(temporary, 'probe.exe'), [init, supplyDirectory], {
      env: { ...environment, NELYX_COMPARE_V8_JITLESS: mode === 'jitless' ? '1' : '0' },
    });
    assert(lines.includes('RUNTIME_COMPARISON_ADMISSION_PASS'));
    assert(lines.includes('RUNTIME_COMPARISON_SDK_ADMISSION_PASS'));
    for (const line of lines) if (line.startsWith('V2_RUNTIME_COMPARISON')) console.log(line);
    console.log('RUNTIME_COMPARISON_ADMISSION ' + mode + ' PASS');
  }
  if (!process.argv.includes('--probe-only')) {
    const originalHost = fs.readFileSync(
      path.join(engineRoot, 'platform/windows/host.cpp'),
      'utf8',
    );
    const host = path.join(temporary, 'host.cpp');
    fs.writeFileSync(host, hostSource(originalHost));
    const projectSource = fs.readFileSync(
      path.join(engineRoot, 'platform/windows/app-sdk/NelyxEngineAppSdkHost.vcxproj'),
      'utf8',
    );
    let project = replaceOne(
      projectSource,
      '$(MSBuildThisFileDirectory)..\\..\\..\\',
      xml(engineRoot + path.sep),
    );
    project = replaceOne(project, '$(EngineRoot)platform\\windows\\host.cpp', xml(host));
    project = replaceOne(
      project,
      'JSI_USE_HERMES;NDEBUG;',
      'JSI_USE_HERMES;JSI_VERSION=19;NDEBUG;',
    );
    project = replaceOne(
      project,
      '$(EngineRoot)include;',
      xml(path.join(hermes, 'source/API/jsi')) +
        ';' +
        xml(path.join(engineRoot, 'platform/windows')) +
        ';' +
        xml(include) +
        ';' +
        xml(adapter) +
        ';$(EngineRoot)include;',
    );
    project = replaceOne(
      project,
      '$(NelyxEngineLibrary);',
      xml(library) + ';$(NelyxEngineLibrary);',
    );
    project = replaceOne(
      project,
      '    <ClCompile Include="$(EngineRoot)platform\\windows\\rnw\\ClipboardModule.cpp" />',
      '<ClCompile Include="' +
        xml(patchedAdapter) +
        '" /><ClCompile Include="' +
        xml(path.join(adapter, 'public/V8JsiRuntime.cpp')) +
        '" />\n    <ClCompile Include="$(EngineRoot)platform\\windows\\rnw\\ClipboardModule.cpp" />',
    );
    // Reuse current runtime DLLs through PATH and the current engine directory.
    // Do not create an independent self-contained SDK consumer installation.
    project = replaceOne(
      project,
      '<WindowsAppSDKSelfContained>true</WindowsAppSDKSelfContained>',
      '<WindowsAppSDKSelfContained>false</WindowsAppSDKSelfContained><WindowsAppSdkBootstrapInitialize>false</WindowsAppSdkBootstrapInitialize>',
    );
    const projectFile = path.join(temporary, 'comparison.vcxproj');
    fs.writeFileSync(projectFile, project);
    const output = path.join(temporary, 'output'),
      intermediate = path.join(temporary, 'obj');
    fs.mkdirSync(output);
    fs.mkdirSync(intermediate);
    await run(path.join(environment.VSINSTALLDIR, 'MSBuild/Current/Bin/MSBuild.exe'), [
      projectFile,
      '/restore',
      '/m:2',
      '/nologo',
      '/verbosity:minimal',
      '/p:Configuration=Release',
      '/p:Platform=x64',
      '/p:BaseIntermediateOutputPath=' + intermediate + path.sep,
      '/p:MSBuildProjectExtensionsPath=' + intermediate + path.sep,
      '/p:NelyxAppSdkIntermediate=' + intermediate,
      '/p:NelyxAppSdkOutput=' + output,
      '/p:NelyxEngineLibrary=' + path.join(supplyDirectory, 'native/nelyx_engine_v2.lib'),
      '/p:NelyxSkiaSupplier=' + path.join(root, 'Nelyx/skia/vendor/inputs/windows-x64'),
      '/p:NelyxHermesRoot=' + hermes,
    ]);
    const executable = path.join(output, 'NelyxEngineAppSdkHost.exe');
    assert(fs.existsSync(executable));
    const launcher = path.join(temporary, 'launch.mjs');
    fs.writeFileSync(
      launcher,
      `import {spawn} from 'node:child_process';
const child=spawn(${JSON.stringify(executable)},${JSON.stringify([supplyDirectory, '--app', bundleDirectory])},{stdio:'inherit',windowsHide:true});
child.on('error',error=>{console.error(error.message);process.exitCode=1;});child.on('close',code=>{process.exitCode=code??1;});
`,
    );
    const scripts = quotePS(forward(import.meta.dirname));
    let check = fs
      .readFileSync(path.join(import.meta.dirname, 'check-windows-scroll.ps1'), 'utf8')
      .replaceAll('$PSScriptRoot', scripts);
    check = replaceOne(
      check,
      '$identity = ($identityText -join "`n") | ConvertFrom-Json',
      '$identity = ($identityText -join "`n") | ConvertFrom-Json\n$identity.executable=' +
        quotePS(executable) +
        "\n$identity.appExecution='v8-source'",
    );
    check = replaceOne(
      check,
      "([string[]]@($cli,'run','--engine','v2','--app',$App,'--target','windows'))",
      '([string[]]@(' + quotePS(launcher) + '))',
    );
    const checkFile = path.join(temporary, 'check-v8-scroll.ps1');
    fs.writeFileSync(checkFile, check);
    console.log(
      'RUNTIME_COMPARISON_HOST ' +
        JSON.stringify({
          baseHost: hash(originalHost),
          comparisonHost: hashFile(host),
          comparisonExecutable: hashFile(executable),
          baseCheck: hashFile(path.join(import.meta.dirname, 'check-windows-scroll.ps1')),
          comparisonCheck: hashFile(checkFile),
          adapter: hashFile(patchedAdapter),
          heap: 'same-isolate Node-API; no synthetic zero counters',
          timeoutInterrupt: 'unsupported; any stall fails the run',
        }),
    );
    if (process.argv.includes('--interactive')) await interactive(executable, base);
    for (const mode of process.argv.includes('--interactive')
      ? []
      : ['hermes-native', 'v8-jit', 'v8-jitless']) {
      const script =
        mode === 'hermes-native'
          ? path.join(import.meta.dirname, 'check-windows-scroll.ps1')
          : checkFile;
      const result = { mode, base };
      console.log('RUNTIME_COMPARISON_BEGIN ' + mode);
      await run(
        'powershell.exe',
        [
          '-NoProfile',
          '-ExecutionPolicy',
          'Bypass',
          '-File',
          script,
          '-Scenario',
          'Calendar',
          '-RapidMonths',
          '12',
          '-PrecisionHz',
          '60',
          '-GestureSpeed',
          '3',
          '-YearMode',
        ],
        {
          cwd: root,
          env: { ...environment, NELYX_COMPARE_V8_JITLESS: mode === 'v8-jitless' ? '1' : '0' },
          observe(line) {
            const match =
              /^WINDOWS_SCROLL_(MOVEMENT|RESULT|APP|SOURCE|CLEANUP|IDENTITY|SOURCE_CHAIN) (\{.*\})$/.exec(
                line,
              );
            if (match) {
              const value = JSON.parse(match[2]);
              (result[match[1]] ??= []).push(value);
              console.log(line);
            } else if (line.startsWith('V2_RUNTIME_COMPARISON')) console.log(line);
          },
        },
      );
      assert.equal(result.RESULT?.at(-1)?.functional, 'PASS', 'Calendar functionality failed');
      assert.deepEqual(
        identity(),
        base,
        'The comparison changed a current source/supply/App input',
      );
      console.log('RUNTIME_COMPARISON_RESULT ' + JSON.stringify(result));
    }
  }
  assert.deepEqual(identity(), base, 'The comparison changed its baseline');
} catch (error) {
  console.error('Runtime comparison: ' + String(error.message ?? error).slice(0, 14000));
  process.exitCode = 1;
} finally {
  process.removeListener('SIGINT', interrupted);
  process.removeListener('SIGTERM', interrupted);
  clearTimeout(deadlineTimer);
  controller.abort();
  for (const child of ownedChildren) killOwned(child.pid);
  assert(
    path.dirname(fs.realpathSync(temporary)) === parent,
    'Refusing cleanup outside the owned comparison directory',
  );
  fs.rmSync(temporary, { recursive: true, force: true });
  console.log('RUNTIME_COMPARISON_TEMPORARY_REMOVED');
}
