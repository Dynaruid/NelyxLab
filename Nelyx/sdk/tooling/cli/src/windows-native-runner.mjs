// SPDX-License-Identifier: BSD-3-Clause
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import {
  buildNativeHost,
  nativePackageRoots,
  nativePackageEnvironment,
  verifyNativeSkiaInputs,
} from './windows-native-host.mjs';
import { verifyNativeHermes, prepareNativeHermes } from './windows-native-hermes-toolchain.mjs';
import { sha256 as hash, fileTree, verifyInventory, localFile } from './files.mjs';
import { defineConfig } from '@nelyx/sdk/runtime/config';
import { startWindowsProcess } from './windows-process.mjs';
import { buildNativeAot, verifyNativeAot } from './windows-native-aot.mjs';
import { windowsAppBuildInputs, windowsBuildInputs } from './windows-build-inputs.mjs';
import {
  nativeWindowsBuildIdentity,
  nativeApplicationEntry,
  prepareNativeWindowsRun,
} from './windows-native-run-preparation.mjs';
const timeout = 1_200_000;
function commonRoot(paths) {
  let root = fs.realpathSync(paths[0]);
  while (
    paths.some((file) => {
      const relative = path.relative(root, fs.realpathSync(file));
      return relative.startsWith('..') || path.isAbsolute(relative);
    })
  ) {
    const parent = path.dirname(root);
    if (parent === root) throw Error('Native packages must share a filesystem root');
    root = parent;
  }
  return root;
}
import { execute } from './commands.mjs';
import { windowsCompilerEnvironment } from './windows-static-hermes.mjs';
import { windowsHermesPolicy } from './windows-hermes-policy.mjs';
import { windowsNativeAotPolicy } from './windows-native-aot-policy.mjs';
import { windowsNativeHermesCohort } from '@nelyx/sdk/runtime/cohorts';
import { windowsNativeHermesPin } from './windows-native-hermes-pin.mjs';
import { windowsNativeIcuRuntimeFiles } from './windows-native-icu.mjs';
import { openNativeBuildCache } from './native-build-cache.mjs';
import {
  nativeEnginePolicy,
  nativeManifestPolicy,
  nativeWindowsEngineIdentity,
} from './windows-native-engine.mjs';
import {
  prepareNativeJsc,
  verifyNativeJsc,
  nativeJscRuntimeHashes,
} from './windows-native-jsc.mjs';
import { windowsJscPin } from './windows-jsc.mjs';
const load = createRequire(import.meta.url);
const { getDefaultConfig, mergeConfig } = load('metro-config');
const inside = (parent, file) => {
  const relative = path.relative(parent, file);
  return relative !== '' && !relative.startsWith('..') && !path.isAbsolute(relative);
};
export async function buildNativeApplication({
  app,
  engine = 'hermes',
  jscMode,
  jscInputs,
  mode,
  hermesMode,
  signal,
  engineInputs,
  nativeInputs,
  hostBuild,
  output,
  entry: selectedEntry,
  diagnosticEntry,
  cacheDirectory,
} = {}) {
  const runtime = nativeEnginePolicy({ engine, mode, hermesMode, jscMode });
  mode = runtime.mode;
  if (diagnosticEntry && !output)
    throw Error('A diagnostic entry requires an explicit temporary output');
  if (diagnosticEntry && selectedEntry !== undefined)
    throw Error('Choose either a product --entry or a diagnostic entry');
  app = fs.realpathSync(app);
  const config = defineConfig(
    JSON.parse(fs.readFileSync(path.join(app, 'package.json'), 'utf8')).nelyx,
  );
  const diagnostic = diagnosticEntry ? fs.realpathSync(diagnosticEntry) : null;
  const appEntry = diagnostic ? undefined : nativeApplicationEntry(app, selectedEntry);
  if (diagnostic && (!inside(app, diagnostic) || !fs.statSync(diagnostic).isFile()))
    throw Error('A diagnostic entry must be an owned file inside the application');
  if (diagnostic) {
    const parent = path.join(app, '.nelyx/native-windows'),
      destination = path.resolve(output);
    if (
      !inside(parent, destination) ||
      (path.dirname(destination) === parent && path.basename(destination).startsWith('current-'))
    )
      throw Error('A diagnostic output must be a separate temporary package inside native-windows');
  }
  const { roots, runner } = nativePackageEnvironment(app),
    root = commonRoot([app, ...Object.values(roots)]),
    installedSdkInputsSha256 = windowsBuildInputs(runner),
    appInputsSha256 = windowsAppBuildInputs(app);
  const host =
    hostBuild ??
    (await buildNativeHost({ app, engine, engineInputs, jscInputs, nativeInputs, signal }));
  if ((host.manifest.engine ?? 'hermes') !== engine)
    throw Error('Native host belongs to another engine');
  const checked = verifyNativeHermes(host.toolchain),
    env = windowsCompilerEnvironment(),
    sdkInputsSha256 = nativeWindowsBuildIdentity(
      installedSdkInputsSha256,
      host.manifest.nativeInputsSha256,
      host.manifest.toolchainSha256,
    );
  const parent = path.join(app, '.nelyx/native-windows');
  fs.mkdirSync(parent, { recursive: true });
  if (fs.realpathSync(parent) !== parent)
    throw Error('Native package parent must be a real directory');
  const packageOwner = openNativeBuildCache(path.join(parent, 'build-' + mode));
  let stage;
  const directory = path.resolve(output ?? path.join(parent, 'current-' + runtime.key));
  try {
    const currentStage = path.join(parent, '.build-' + mode);
    if (fs.existsSync(currentStage))
      throw Error('Unfinished native build stage requires recovery: ' + currentStage);
    fs.mkdirSync(currentStage);
    stage = currentStage;
    if (fs.existsSync(directory)) assertReplaceable(directory);
    for (const name of [
      runtime.executable,
      ...(engine === 'jsc' ? Object.keys(nativeJscRuntimeHashes) : ['hermesvm.dll']),
      ...windowsNativeIcuRuntimeFiles,
      'native-host.json',
    ])
      fs.copyFileSync(path.join(host.directory, name), path.join(stage, name));
    fs.mkdirSync(path.join(stage, 'licenses'));
    if (host.jsc) {
      fs.copyFileSync(
        path.join(host.jsc.directory, 'jsc-engine.json'),
        path.join(stage, 'jsc-engine.json'),
      );
      for (const name of fileTree(path.join(host.jsc.directory, 'licenses')))
        fs.copyFileSync(
          path.join(host.jsc.directory, 'licenses', name),
          path.join(stage, 'licenses', name),
        );
      fs.writeFileSync(path.join(stage, 'jsc-mode.txt'), runtime.executionMode + '\n');
    }
    fs.copyFileSync(
      path.join(checked.directory, 'icu/LICENSE'),
      path.join(stage, 'licenses/Unicode-ICU-LICENSE.txt'),
    );
    fs.mkdirSync(path.join(stage, 'Assets'));
    const assets = config.assets.map((asset) => {
      const source = path.resolve(app, asset.path);
      if (!inside(app, source) || !fs.statSync(source).isFile())
        throw Error('Asset outside app: ' + asset.id);
      const relative = asset.path.replace(/^\.\//, '');
      const destination = path.join(stage, 'Assets', relative);
      fs.mkdirSync(path.dirname(destination), { recursive: true });
      fs.copyFileSync(source, destination);
      if (asset.notice) {
        const file = path.resolve(app, asset.notice.path);
        if (!inside(app, file)) throw Error('Asset notice outside app');
        const notice = path.join(stage, 'Assets', asset.notice.path.slice(2));
        fs.mkdirSync(path.dirname(notice), { recursive: true });
        fs.copyFileSync(file, notice);
      }
      return {
        ...asset,
        sha256: hash(source),
        ...(asset.notice
          ? { notice: { ...asset.notice, sha256: hash(path.resolve(app, asset.notice.path)) } }
          : {}),
      };
    });
    fs.copyFileSync(host.inputs.icu, path.join(stage, 'Assets/icudtl.dat'));
    const assetConfiguration = {
      manifest: assets,
      sources: Object.fromEntries(
        assets.map((asset) => [asset.id, { uri: 'nelyx-asset:/' + asset.path.slice(2) }]),
      ),
    };
    const entry = path.join(stage, 'entry.ts'),
      source = path.join(stage, 'app.js');
    const globals = '@nelyx/sdk/backends/native-hermes/globals',
      start = '@nelyx/sdk/backends/native-hermes/application',
      main = path.resolve(diagnostic ?? path.join(app, appEntry)).replaceAll('\\', '/');
    fs.writeFileSync(
      entry,
      `import {failNativeHermesStartup} from ${JSON.stringify(globals)};\nimport {startNativeHermesApplication} from ${JSON.stringify(start)};\nimport {main} from ${JSON.stringify(main)};\nstartNativeHermesApplication(main().definition,${JSON.stringify(assetConfiguration)}).catch(failNativeHermesStartup);\n`,
    );
    const packageRoots = roots;
    const metro = mergeConfig(await getDefaultConfig(root), {
      projectRoot: root,
      watchFolders: [root],
      maxWorkers: 2,
      transformer: {
        babelTransformerPath: createRequire(path.join(runner, 'package.json')).resolve(
          '@nelyx/metro/native-hermes-transformer',
        ),
        enableBabelRCLookup: false,
        enableBabelRuntime: false,
      },
      serializer: { getPolyfills: () => [], getModulesRunBeforeMainModule: () => [] },
      resolver: {
        resolverMainFields: ['main'],
        unstable_enablePackageExports: true,
        unstable_conditionNames: ['require'],
        disableHierarchicalLookup: true,
        nodeModulesPaths: [
          ...new Set([path.join(runner, 'node_modules'), path.join(root, 'node_modules')]),
        ],
        extraNodeModules: packageRoots,
        resolveRequest(context, name, platform) {
          if (
            /^(?:react(?:$|-|\/)|@react-native(?:-windows)?\/|yoga(?:-layout)?(?:\/|$)|@microsoft\/node-api-jsi(?:\/|$))/.test(
              name,
            )
          )
            throw Error('RN runtime is forbidden in native Hermes graph: ' + name);
          return context.resolveRequest(context, name, platform);
        },
      },
    });
    const policy =
      engine === 'jsc'
        ? { id: 'windows-jsc-26.4-source-direct-jsi-v1' }
        : mode === 'static-aot'
          ? windowsNativeAotPolicy(windowsNativeHermesCohort())
          : windowsHermesPolicy('optimized', windowsNativeHermesCohort());
    let bundle = 'app.hbc',
      nativeFunctions = null,
      aot;
    if (mode !== 'static-aot') {
      const { inspectRuntimeInventory } = await import('@nelyx/metro/runtime-inventory');
      const inventory = await inspectRuntimeInventory({
        runner,
        appRoot: root,
        entry,
        config: metro,
        nativeHost: true,
        signal,
        sourceMapUrl: 'app.js.map',
        onCapture(value) {
          fs.writeFileSync(source, value.code);
          fs.writeFileSync(source + '.map', value.map);
        },
      });
      assertNativeRuntimeGraph(inventory);
      copyRuntimeLicenses(inventory.modules, root, stage, roots);
      fs.writeFileSync(path.join(stage, 'native-graph.json'), JSON.stringify(inventory));
      // installVmEnvironment supplies console before application modules run.
      // Declare it to Hermes without emitting a binding or suppressing warnings.
      if (mode === 'bytecode') {
        const compilerGlobals = path.join(stage, 'globals.js');
        fs.writeFileSync(compilerGlobals, 'var console;\n');
        await execute(
          path.join(checked.directory, 'build/bin/hermesc.exe'),
          [
            ...policy.flags,
            '-include-globals',
            compilerGlobals,
            '-emit-binary',
            '-out',
            bundle,
            path.basename(source),
          ],
          { cwd: stage, env, signal, timeout },
        );
        fs.unlinkSync(compilerGlobals);
      } else bundle = 'app.js';
    } else {
      bundle = 'NelyxApp.aot.dll';
      aot = await buildNativeAot({
        app,
        runner,
        root,
        entry,
        source,
        map: source + '.map',
        config: metro,
        roots,
        checked,
        env,
        stage,
        signal,
        cacheDirectory: cacheDirectory ?? (diagnostic ? null : undefined),
      });
      nativeFunctions = aot.nativeFunctions;
      assertNativeRuntimeGraph(aot.execution);
      copyRuntimeLicenses(aot.execution.modules, root, stage, roots);
    }
    for (const [name, base] of Object.entries(roots)) {
      for (const relative of [
        'LICENSE.md',
        'THIRD_PARTY_NOTICES.md',
        ...(fs.existsSync(path.join(base, 'licenses'))
          ? fileTree(path.join(base, 'licenses')).map((name) => 'licenses/' + name)
          : []),
      ]) {
        const file = path.join(base, relative);
        if (!fs.existsSync(file)) continue;
        const destination = path.join(stage, 'licenses', name.slice(7), relative);
        fs.mkdirSync(path.dirname(destination), { recursive: true });
        fs.copyFileSync(file, destination);
      }
    }
    fs.copyFileSync(
      path.join(checked.directory, 'source/LICENSE'),
      path.join(stage, 'licenses/Hermes-MIT.txt'),
    );
    fs.unlinkSync(entry);
    const inventory = [];
    const visit = (folder) => {
      for (const item of fs.readdirSync(folder, { withFileTypes: true })) {
        const file = path.join(folder, item.name);
        if (item.isSymbolicLink()) throw Error('Native package symlink');
        if (item.isDirectory()) visit(file);
        else
          inventory.push({
            path: path.relative(stage, file).replaceAll('\\', '/'),
            sha256: hash(file),
            bytes: fs.statSync(file).size,
          });
      }
    };
    visit(stage);
    if (windowsBuildInputs(runner) !== installedSdkInputsSha256)
      throw Error('Native SDK inputs changed during the build');
    if (windowsAppBuildInputs(app) !== appInputsSha256)
      throw Error('Native application inputs changed during the build');
    fs.writeFileSync(
      path.join(stage, 'native-package.json'),
      JSON.stringify(
        {
          schema: runtime.packageSchema,
          engine,
          ...(engine === 'jsc'
            ? {
                executionMode: runtime.executionMode,
                jsiToolchainSha256: checked.sha256,
                jscSupplierSha256: host.jsc.sha256,
              }
            : {}),
          app: config.name,
          mode,
          revision: engine === 'jsc' ? windowsJscPin.revision : checked.manifest.revision,
          toolchainSha256: host.manifest.toolchainSha256,
          sourceSha256: host.manifest.sourceSha256,
          sdkInputsSha256,
          appInputsSha256,
          ...(appEntry ? { appEntry } : {}),
          compilerPolicy: policy.id,
          bundle,
          nativeFunctions,
          ...(aot ? { nativePlan: aot.nativePlan, acceptance: aot.acceptance } : {}),
          qualification: diagnostic ? 'diagnostic-only' : 'experimental',
          ...(diagnostic ? { diagnosticEntrySha256: hash(diagnostic) } : {}),
          performanceAccepted: false,
          physicalInputAccepted: 'notVerified',
          files: inventory,
        },
        null,
        2,
      ) + '\n',
    );
    verifyNativePackage(stage);
    const previous = path.join(parent, '.replace-' + mode);
    if (fs.existsSync(previous))
      throw Error('Unfinished native package replacement requires recovery');
    let moved = false,
      published = false;
    try {
      if (fs.existsSync(directory)) {
        assertReplaceable(directory);
        if (!inside(parent, directory) || fs.lstatSync(directory).isSymbolicLink())
          throw Error('Native output cleanup outside owned package');
        fs.renameSync(directory, previous);
        moved = true;
      }
      fs.renameSync(stage, directory);
      published = true;
    } finally {
      if (moved) {
        if (published) fs.rmSync(previous, { recursive: true, force: true });
        else fs.renameSync(previous, directory);
      }
    }
    return {
      directory,
      mode,
      bundle: path.join(directory, bundle),
      executable: path.join(directory, runtime.executable),
      assetRoot: path.join(directory, 'Assets'),
    };
    /* oxlint-disable no-unsafe-finally -- Reject cleanup when directory ownership or rollback safety cannot be established. */
  } finally {
    try {
      if (stage && fs.existsSync(stage)) {
        if (
          path.dirname(stage) !== parent ||
          path.basename(stage) !== '.build-' + mode ||
          fs.lstatSync(stage).isSymbolicLink()
        )
          throw Error('Unexpected native build stage');
        fs.rmSync(stage, { recursive: true, force: true });
      }
    } finally {
      packageOwner.close();
    }
  }
  /* oxlint-enable no-unsafe-finally */
}
export function assertNativeRuntimeGraph(graph) {
  if (
    !graph ||
    !Array.isArray(graph.modules) ||
    !graph.modules.length ||
    graph.modules.some(
      (module) =>
        !module?.owner?.name ||
        /^(?:react(?:$|-)|@react-native(?:-windows)?\/|@nelyx\/skia-rn$|yoga(?:-layout)?$|@microsoft\/node-api-jsi$)/.test(
          module.owner.name,
        ),
    ) ||
    graph.evaluationConflicts?.length ||
    graph.summary?.unresolvedDependencies ||
    graph.unresolved?.length ||
    graph.dynamicCodeCandidates?.length
  )
    throw Error(
      'Direct host runtime graph contains an RN owner, unresolved edge or dynamic-code fallback',
    );
}
function copyRuntimeLicenses(modules, root, stage, roots) {
  const owners = new Map(modules.map((module) => [module.owner.name, module.owner]));
  for (const [name, owner] of owners) {
    if (Object.hasOwn(roots, name)) continue;
    const folder = path.resolve(root, owner.root);
    if (
      (folder !== root && !inside(root, folder)) ||
      hash(path.join(folder, 'package.json')) !== owner.manifestSha256
    )
      throw Error('Runtime license owner changed');
    for (const file of fs
      .readdirSync(folder)
      .filter((name) => /^(?:licen[cs]e|notice)(?:[.-]|$)/i.test(name))) {
      const source = path.join(folder, file);
      if (!fs.statSync(source).isFile() || fs.lstatSync(source).isSymbolicLink())
        throw Error('Runtime license is not a regular file');
      const target = path.join(stage, 'licenses/runtime', name.replaceAll('/', '_'), file);
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.copyFileSync(source, target);
    }
  }
}
function assertReplaceable(directory) {
  const checked = verifyNativePackage(directory),
    runtime = nativeManifestPolicy(checked.manifest);
  for (const name of [runtime.executable, runtime.vm]) {
    let handle;
    try {
      handle = fs.openSync(path.join(directory, name), 'r+');
    } catch {
      throw Error('Close the running native package before replacing it: ' + directory);
    } finally {
      if (handle !== undefined) fs.closeSync(handle);
    }
  }
}
export function verifyNativePackage(directory) {
  directory = fs.realpathSync(directory);
  const manifest = JSON.parse(fs.readFileSync(localFile(directory, 'native-package.json'), 'utf8'));
  const runtime = nativeManifestPolicy(manifest);
  if (
    manifest.appEntry !== undefined &&
    (typeof manifest.appEntry !== 'string' ||
      manifest.appEntry.includes('\\') ||
      manifest.appEntry.split('/').some((part) => !part || part === '.' || part === '..') ||
      path.win32.isAbsolute(manifest.appEntry))
  )
    throw Error('Invalid native application entry');
  for (const key of ['sdkInputsSha256', 'appInputsSha256', 'toolchainSha256', 'sourceSha256'])
    if (manifest[key] !== undefined && !/^[a-f0-9]{64}$/.test(manifest[key]))
      throw Error('Invalid native build input identity: ' + key);
  const expectedBundle =
    runtime.engine === 'jsc'
      ? 'app.js'
      : runtime.mode === 'bytecode'
        ? 'app.hbc'
        : 'NelyxApp.aot.dll';
  if (
    manifest.revision !==
      (runtime.engine === 'jsc' ? windowsJscPin.revision : windowsNativeHermesPin.revision) ||
    manifest.bundle !== expectedBundle ||
    (runtime.mode === 'static-aot' &&
      (!Number.isSafeInteger(manifest.nativeFunctions) || manifest.nativeFunctions < 1))
  )
    throw Error('Invalid native package identity');
  if (
    !['experimental', 'diagnostic-only'].includes(manifest.qualification) ||
    (manifest.qualification === 'diagnostic-only' &&
      !/^[a-f0-9]{64}$/.test(manifest.diagnosticEntrySha256)) ||
    manifest.performanceAccepted !== false ||
    manifest.physicalInputAccepted !== 'notVerified'
  )
    throw Error('Invalid native qualification boundary');
  const verified = verifyInventory(directory, manifest.files, ['native-package.json']);
  const host = JSON.parse(fs.readFileSync(localFile(directory, 'native-host.json'), 'utf8'));
  if (
    host.schema !== runtime.hostSchema ||
    (host.engine ?? 'hermes') !== runtime.engine ||
    host.host !== runtime.host ||
    host.jsi !== windowsNativeHermesPin.jsi ||
    host.jsiHeaderSha256 !== windowsNativeHermesPin.jsiHeaderSha256 ||
    host.toolchainSha256 !== manifest.toolchainSha256 ||
    host.sourceSha256 !== manifest.sourceSha256
  )
    throw Error('Native package host/source identity differs');
  const expectedImages = [
    runtime.executable,
    ...(runtime.engine === 'jsc' ? Object.keys(nativeJscRuntimeHashes) : ['hermesvm.dll']),
    ...windowsNativeIcuRuntimeFiles,
  ].sort();
  if (
    !Array.isArray(host.files) ||
    JSON.stringify(host.files.map((file) => file.path).sort()) !== JSON.stringify(expectedImages)
  )
    throw Error('Native host image inventory differs');
  for (const file of host.files)
    if (hash(localFile(directory, file.path)) !== file.sha256)
      throw Error('Native host loaded image differs');
  if (runtime.engine === 'jsc') {
    const jsc = verifyNativeJsc(directory, { embedded: true });
    if (
      manifest.jscSupplierSha256 !== jsc.sha256 ||
      host.jscSupplierSha256 !== jsc.sha256 ||
      !/^[a-f0-9]{64}$/.test(manifest.jsiToolchainSha256) ||
      host.jsiToolchainSha256 !== manifest.jsiToolchainSha256 ||
      manifest.toolchainSha256 !==
        nativeWindowsEngineIdentity(manifest.jsiToolchainSha256, jsc.sha256) ||
      fs.readFileSync(localFile(directory, 'jsc-mode.txt'), 'utf8') !== runtime.executionMode + '\n'
    )
      throw Error('Native JSC supplier or execution mode differs');
    for (const name of ['hermesvm.dll', 'hermes.dll', 'Microsoft.ReactNative.dll'])
      if (fs.existsSync(path.join(directory, name)))
        throw Error('Foreign engine/RNW image in direct JSC package');
  }
  const bytes = fs.readFileSync(localFile(directory, manifest.bundle));
  if (
    runtime.mode === 'bytecode' &&
    (bytes.length < 16 ||
      bytes.subarray(0, 8).toString('hex') !== 'c61fbc03c103191f' ||
      bytes.readUInt32LE(8) !== 99)
  )
    throw Error('Native package requires Hermes99 HBC');
  if (runtime.mode === 'static-aot') verifyNativeAot(directory, manifest);
  else
    assertNativeRuntimeGraph(
      JSON.parse(fs.readFileSync(localFile(directory, 'native-graph.json'), 'utf8')),
    );
  return { directory, manifest, ...verified };
}
function selectedNativePackage({ app, directory, engine, hermesMode, jscMode }) {
  const requested = directory ? undefined : nativeEnginePolicy({ engine, hermesMode, jscMode });
  const checked = verifyNativePackage(
    directory ?? path.join(app, '.nelyx/native-windows', 'current-' + requested.key),
  );
  const actual = nativeManifestPolicy(checked.manifest);
  if (
    (engine !== undefined && actual.engine !== engine) ||
    (hermesMode !== undefined && (actual.engine !== 'hermes' || actual.mode !== hermesMode)) ||
    (jscMode !== undefined && (actual.engine !== 'jsc' || actual.executionMode !== jscMode))
  )
    throw Error('Explicit native package has a different requested engine/execution mode');
  return checked;
}
export async function packNativeApplication({
  app,
  directory,
  engine,
  hermesMode,
  jscMode,
  output,
} = {}) {
  const checked = selectedNativePackage({ app, directory, engine, hermesMode, jscMode });
  const runtime = nativeManifestPolicy(checked.manifest);
  output = path.resolve(
    output ??
      path.join(
        app,
        '.nelyx/native-windows',
        checked.manifest.app + '-' + checked.manifest.mode + '.zip',
      ),
  );
  if (
    !output.toLowerCase().endsWith('.zip') ||
    fs.existsSync(output) ||
    inside(checked.directory, output)
  )
    throw Error('Pack requires a new zip outside the package');
  fs.mkdirSync(path.dirname(output), { recursive: true });
  const parent = fs.realpathSync(path.dirname(output)),
    temporary = fs.mkdtempSync(path.join(parent, '.native-pack-'));
  try {
    const archive = path.join(temporary, 'app.zip');
    await execute(
      'powershell.exe',
      [
        '-NoProfile',
        '-Command',
        "$ErrorActionPreference='Stop'; Add-Type -AssemblyName System.IO.Compression.FileSystem; [System.IO.Compression.ZipFile]::CreateFromDirectory($env:NELYX_NATIVE_PACKAGE,$env:NELYX_NATIVE_ZIP)",
      ],
      {
        env: { ...process.env, NELYX_NATIVE_PACKAGE: checked.directory, NELYX_NATIVE_ZIP: archive },
        timeout,
      },
    );
    verifyNativePackage(checked.directory);
    fs.copyFileSync(archive, output, fs.constants.COPYFILE_EXCL);
    return {
      schema: 'nelyx.pack/v2',
      target: 'windows',
      host: runtime.host,
      file: output,
      sha256: hash(output),
      files: checked.files,
      qualification: 'experimental',
    };
    /* oxlint-disable no-unsafe-finally -- Reject cleanup when directory ownership or rollback safety cannot be established. */
  } finally {
    if (
      path.dirname(temporary) !== parent ||
      !path.basename(temporary).startsWith('.native-pack-') ||
      fs.lstatSync(temporary).isSymbolicLink()
    )
      throw Error('Native pack temporary owner differs');
    fs.rmSync(temporary, { recursive: true, force: true });
  }
  /* oxlint-enable no-unsafe-finally */
}
export async function runNativeApplication({
  app,
  directory,
  engine,
  hermesMode,
  jscMode,
  arguments: args = [],
} = {}) {
  const checked = selectedNativePackage({ app, directory, engine, hermesMode, jscMode });
  const runtime = nativeManifestPolicy(checked.manifest);
  const child = startWindowsProcess(
    localFile(checked.directory, runtime.executable),
    [
      localFile(checked.directory, checked.manifest.bundle),
      path.join(checked.directory, 'Assets'),
      checked.manifest.mode,
      ...args,
    ],
    { cwd: checked.directory, verify: verifyNativePackage },
  );
  const stop = () => {
    void child.stop();
  };
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
  try {
    return {
      schema: 'nelyx.run/v2',
      target: 'windows',
      host: runtime.host,
      ...(await child.completed),
    };
  } finally {
    process.off('SIGINT', stop);
    process.off('SIGTERM', stop);
  }
}
export async function prepareNativeApplication({
  app,
  engine = 'hermes',
  engineInputs,
  jscInputs,
  nativeInputs,
  signal,
} = {}) {
  nativeEnginePolicy({ engine });
  const parent = path.join(app, '.nelyx/native-windows');
  fs.mkdirSync(parent, { recursive: true });
  const { roots, runner } = nativePackageEnvironment(app),
    inputs = verifyNativeSkiaInputs(nativeInputs, roots['@nelyx/skia-native']);
  createRequire(path.join(runner, 'package.json'))(
    '@nelyx/metro/assets',
  ).prepareAppAssetConfiguration(app, runner);
  const toolchain = await prepareNativeHermes({
    directory: engineInputs ?? path.join(parent, 'toolchain'),
    signal,
  });
  const jsc =
    engine === 'jsc'
      ? await prepareNativeJsc({
          directory: jscInputs ?? path.join(parent, 'jsc-toolchain'),
          signal,
        })
      : undefined;
  const locator = {
    schema: engine === 'jsc' ? 'nelyx.native-jsc-inputs/v1' : 'nelyx.native-hermes-inputs/v1',
    nativeInputs: inputs.input,
    nativeInputsSha256: inputs.sha256,
    engineInputs: toolchain.directory,
    engineInputsSha256: toolchain.sha256,
    ...(jsc ? { jscInputs: jsc.directory, jscInputsSha256: jsc.sha256 } : {}),
  };
  fs.writeFileSync(
    path.join(parent, engine === 'jsc' ? 'inputs-jsc.json' : 'inputs.json'),
    JSON.stringify(locator, null, 2) + '\n',
  );
  return locator;
}
export async function nativeWindowsOperation(operation, options) {
  if (options.directory && options.entry !== undefined)
    throw Error('--entry cannot be combined with --package; the package fixes its entry');
  if (options.configuration && options.configuration !== 'Release')
    throw Error('The native Windows host requires Release');
  if (options.directory && ['run', 'pack'].includes(operation)) {
    const selected = selectedNativePackage(options);
    if (
      options.host === 'native-hermes' &&
      nativeManifestPolicy(selected.manifest).engine !== 'hermes'
    )
      throw Error('Use --host native for a direct JSC package');
    return operation === 'run' ? runNativeApplication(options) : packNativeApplication(options);
  }
  const runtime = nativeEnginePolicy(options);
  if (
    (options.host === 'native-hermes' && runtime.engine !== 'hermes') ||
    (options.hermesProfile &&
      (runtime.engine !== 'hermes' || options.hermesProfile !== 'optimized'))
  )
    throw Error('Choose --host native for JSC; Hermes requires its optimized profile');
  const app = fs.realpathSync(options.app),
    parent = path.join(app, '.nelyx/native-windows');
  const locator = path.join(parent, runtime.engine === 'jsc' ? 'inputs-jsc.json' : 'inputs.json');
  const readInputs = (refresh = false) => {
    if (!fs.existsSync(locator)) return {};
    const value = JSON.parse(fs.readFileSync(locator, 'utf8'));
    if (
      value.schema !==
        (runtime.engine === 'jsc'
          ? 'nelyx.native-jsc-inputs/v1'
          : 'nelyx.native-hermes-inputs/v1') ||
      typeof value.nativeInputs !== 'string' ||
      !value.nativeInputs ||
      typeof value.engineInputs !== 'string' ||
      !value.engineInputs ||
      (runtime.engine === 'jsc' && (typeof value.jscInputs !== 'string' || !value.jscInputs))
    )
      throw Error('Native host input locator schema/paths differ');
    if (refresh)
      return {
        nativeInputs: value.nativeInputs,
        engineInputs: value.engineInputs,
        ...(runtime.engine === 'jsc' ? { jscInputs: value.jscInputs } : {}),
      };
    if (
      hash(value.nativeInputs) !== value.nativeInputsSha256 ||
      verifyNativeHermes(value.engineInputs).sha256 !== value.engineInputsSha256 ||
      (runtime.engine === 'jsc' &&
        verifyNativeJsc(value.jscInputs).sha256 !== value.jscInputsSha256)
    )
      throw Error('Native host prepared inputs changed; run prepare for the selected engine');
    verifyNativeSkiaInputs(value.nativeInputs, nativePackageRoots(app)['@nelyx/skia-native']);
    return value;
  };
  let inputs = {};
  if (operation === 'doctor') {
    let reason;
    try {
      inputs = readInputs();
    } catch (error) {
      reason = error.message;
    }
    return {
      schema: 'nelyx.doctor/v2',
      target: 'windows',
      host: runtime.host,
      engine: runtime.engine,
      qualification: 'experimental',
      nativeInputs: inputs.schema ? 'prepared' : 'notVerified',
      ...(reason ? { reason } : {}),
    };
  }
  if (operation === 'prepare') inputs = readInputs(true);
  else if (operation === 'build' || (operation === 'run' && !options.directory))
    inputs = readInputs();
  const selected = {
    ...inputs,
    ...options,
    app,
    engine: runtime.engine,
    ...(runtime.engine === 'jsc' ? { jscMode: runtime.executionMode } : {}),
    engineInputs: options.engineInputs ?? inputs.engineInputs,
    nativeInputs: options.nativeInputs ?? inputs.nativeInputs,
    jscInputs: options.jscInputs ?? inputs.jscInputs,
    ...(['build', 'run'].includes(operation)
      ? { entry: nativeApplicationEntry(app, options.entry) }
      : {}),
  };
  if (operation === 'prepare') return prepareNativeApplication(selected);
  if (operation === 'build') return buildNativeApplication({ ...selected, mode: runtime.mode });
  if (operation === 'run') {
    const prepared = await prepareNativeWindowsRun(selected, {
      packageFor: (app, directory, key) => {
        const folder = directory ?? path.join(app, '.nelyx/native-windows', 'current-' + key);
        if (!directory && !fs.existsSync(folder)) return undefined;
        return verifyNativePackage(folder);
      },
      readInputs: (app) =>
        nativeWindowsBuildIdentity(
          windowsBuildInputs(nativePackageEnvironment(app).runner),
          inputs.nativeInputsSha256,
          runtime.engine === 'jsc'
            ? nativeWindowsEngineIdentity(inputs.engineInputsSha256, inputs.jscInputsSha256)
            : inputs.engineInputsSha256,
        ),
      readAppInputs: windowsAppBuildInputs,
      build: (options) => buildNativeApplication({ ...selected, ...options }),
      onRebuild: () =>
        console.error(
          'Nelyx native application or build inputs changed; rebuilding current package',
        ),
    });
    return runNativeApplication({ ...selected, directory: prepared.directory });
  }
  if (operation === 'pack') return packNativeApplication(selected);
  throw Error('Native Windows host supports doctor, prepare, build, run and pack');
}
