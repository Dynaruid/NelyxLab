// SPDX-License-Identifier: BSD-3-Clause
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { spawn } from 'node:child_process';
import { build } from 'esbuild';
import { execute } from './commands.mjs';
import { windowsHermesPolicy, windowsHermesSyntax } from './windows-hermes-policy.mjs';
import { windowsNativeHermesCohort } from '@nelyx/sdk/runtime/cohorts';
import { windowsNativeHermesPin } from './windows-native-hermes-pin.mjs';
import { protocol as p } from '@nelyx/core/v2';
import { engineV2ImportRoute, engineV2OriginalAppRoute } from './engine-v2-data-api.mjs';
import {
  inspectEngineV2Graph,
  engineV2AppSelection,
  createEngineV2DesignImportPolicy,
} from './engine-v2-graph.mjs';
import { applicationAssetKey, writeAssetManifests } from './engine-v2-assets.mjs';
import {
  buildEngineV2AndroidApk,
  doctorEngineV2Android,
  runEngineV2Android,
} from './engine-v2-android.mjs';
const hash = (file) => createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const read = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));
const inside = (root, file) => {
  const relative = path.relative(root, file);
  return (
    relative !== '' &&
    !relative.startsWith('..' + path.sep) &&
    relative !== '..' &&
    !path.isAbsolute(relative)
  );
};
function input(root, relative) {
  if (typeof relative !== 'string' || path.isAbsolute(relative))
    throw Error('Expected a relative file path');
  const file = fs.realpathSync(path.resolve(root, relative));
  if (!inside(root, file) || !fs.statSync(file).isFile())
    throw Error('File outside declared root: ' + relative);
  return file;
}
function removeTemporary(directory, parent, prefix) {
  const file = path.resolve(directory);
  if (
    path.dirname(file) !== parent ||
    !path.basename(file).startsWith(prefix) ||
    fs.lstatSync(file).isSymbolicLink()
  )
    throw Error('Unexpected v2 cleanup path');
  fs.rmSync(file, { recursive: true, force: true, maxRetries: 3 });
}
function outputPath(app, value) {
  const result = path.resolve(app, value);
  if (!inside(app, result)) throw Error('Output leaves the app');
  let ancestor = result;
  while (!fs.existsSync(ancestor)) ancestor = path.dirname(ancestor);
  const resolved = fs.realpathSync(ancestor);
  if (resolved !== app && !inside(app, resolved))
    throw Error('Output follows a link outside the app');
  if (fs.existsSync(result) && fs.lstatSync(result).isSymbolicLink())
    throw Error('Output must not be a symbolic link');
  return result;
}
export function engineV2WindowsHost(value = 'windows-app-sdk') {
  if (value !== 'windows-app-sdk')
    throw Error('Engine v2 Windows requires windows-app-sdk; unsupported host: ' + value);
  return { host: value, profile: value, executable: 'windows-app-sdk/NelyxEngineAppSdkHost.exe' };
}
export function verifyEngineV2Supply(directory, target, windowsHost) {
  const root = fs.realpathSync(directory),
    manifest = read(path.join(root, 'engine-manifest.json'));
  if (
    manifest.schema !== 'nelyx.engine.v2.supply/1' ||
    manifest.abi?.major !== p.abiMajor ||
    manifest.abi?.schema !== p.schema
  )
    throw Error('Engine v2 supply ABI/schema differs from installed Core');
  if (
    !(target === 'windows'
      ? manifest.profiles?.[engineV2WindowsHost(windowsHost).profile]
      : target === 'android'
        ? manifest.profiles?.android?.host === 'android-standalone' &&
          manifest.profiles.android.reactNative === false
        : manifest.profiles?.threaded && manifest.profiles?.['single-worker'])
  )
    throw Error('Requested engine v2 host capability is missing');
  if (!/^[a-f0-9]{64}$/.test(manifest.sourceSha256) || !Array.isArray(manifest.files))
    throw Error('Invalid engine v2 supply identity');
  const seen = new Set();
  for (const file of manifest.files) {
    if (seen.has(file.path) || hash(input(root, file.path)) !== file.sha256)
      throw Error('Engine v2 supply identity mismatch: ' + file.path);
    seen.add(file.path);
  }
  if (target === 'windows') {
    const selected = engineV2WindowsHost(windowsHost);
    if (
      manifest.profiles.native ||
      [...seen].some((name) => /(?:^|\/)NelyxEngineV2Host\.exe$/i.test(name))
    )
      throw Error('Obsolete standalone Windows host supply; rebuild for Windows App SDK');
    if (
      !seen.has(selected.executable) ||
      manifest.profiles[selected.profile].host !== selected.host ||
      manifest.profiles[selected.profile].deployment !== 'unpackaged-self-contained' ||
      !seen.has('windows-app-sdk/Microsoft.UI.Windowing.dll') ||
      !seen.has('windows-app-sdk/Microsoft.WindowsAppRuntime.dll')
    )
      throw Error('Requested engine v2 host runtime/identity is missing: ' + selected.host);
    const bytecode = manifest.profiles[selected.profile].appBytecode;
    if (
      manifest.hermes !== windowsNativeHermesCohort().engineRevision ||
      bytecode?.compiler !== 'windows-app-sdk/hermesc.exe' ||
      bytecode.version !== 99 ||
      bytecode.entry !== 'application/app.hbc' ||
      bytecode.policy !== windowsHermesPolicy('optimized', windowsNativeHermesCohort()).id ||
      bytecode.release !== windowsNativeHermesPin.version ||
      !seen.has(bytecode.compiler)
    )
      throw Error('Windows App SDK supply lacks the matching optimized Hermes compiler');
    const port = 'windows-app-sdk/sources/rnw/';
    if (
      !manifest.profiles[selected.profile].platformSources?.some(
        (source) =>
          source.package === 'react-native-windows' &&
          source.version === '0.83.2' &&
          source.provenance === port + 'provenance.json',
      ) ||
      [
        'ClipboardModule.cpp',
        'ClipboardModule.h',
        'upstream/ClipboardModule.cpp',
        'upstream/ClipboardModule.h',
        'KeyboardUtils.cpp',
        'KeyboardUtils.h',
        'upstream/KeyboardUtils.cpp',
        'upstream/KeyboardUtils.h',
        'AccessibilityInfoModule.cpp',
        'AccessibilityInfoModule.h',
        'upstream/AccessibilityInfoModule.cpp',
        'upstream/AccessibilityInfoModule.h',
        'LICENSE',
        'provenance.json',
      ].some((file) => !seen.has(port + file))
    )
      throw Error('Windows App SDK supply lacks the RNW clipboard/keyboard source/provenance');
  }
  if (target === 'android') {
    const abis = manifest.profiles.android.abis;
    if (
      !Array.isArray(abis) ||
      !abis.length ||
      new Set(abis).size !== abis.length ||
      abis.some((abi) => !['arm64-v8a', 'x86_64'].includes(abi))
    )
      throw Error('Invalid Android supply ABI set');
    for (const abi of abis)
      for (const name of [
        'libnelyx_engine_android.so',
        'libhermesvm.so',
        'libjsi.so',
        'libfbjni.so',
        'libwebgpu_dawn.so',
        'libc++_shared.so',
      ])
        if (!seen.has(`jni/${abi}/${name}`))
          throw Error('Android native capability is missing: ' + abi + '/' + name);
    for (const name of [
      'project/app/src/main/java/dev/nelyx/engine/NativeHost.java',
      'project/gradle/wrapper/gradle-wrapper.jar',
      'project/app/src/main/AndroidManifest.xml',
    ])
      if (!seen.has(name)) throw Error('Android host project identity is missing: ' + name);
  }
  return { root, manifest };
}
/** A versioned App config never selects a renderer or silently combines configurations. */
export function readAppConfiguration(app) {
  const canonical = path.join(app, 'nelyx.json'),
    previous = path.join(app, 'nelyx.v2.json'),
    packageFile = path.join(app, 'package.json');
  const packageConfig = fs.existsSync(packageFile) ? read(packageFile).nelyx : undefined;
  if (
    [fs.existsSync(canonical), fs.existsSync(previous), packageConfig !== undefined].filter(Boolean)
      .length > 1
  )
    throw Error(
      'Conflicting App configurations: use only nelyx.json, nelyx.v2.json or package.json.nelyx',
    );
  if (fs.existsSync(canonical)) {
    const value = read(canonical);
    if (!value || typeof value !== 'object' || Array.isArray(value))
      throw Error('App configuration must be an object');
    const allowed = new Set([
      'schema',
      'entry',
      'assets',
      'supply',
      'windowsHost',
      'android',
      'engine',
      'vm',
    ]);
    for (const key of Object.keys(value))
      if (!allowed.has(key)) throw Error('Unknown App configuration option: ' + key);
    if (value.vm !== undefined && !['hermes', 'browser'].includes(value.vm))
      throw Error('The requested JavaScript VM is not supplied: ' + value.vm);
    if (value.schema !== 'nelyx.app/1' || (value.engine !== undefined && value.engine !== 'v2'))
      throw Error('Expected nelyx.json with nelyx.app/1; the App renderer is engine v2');
    return { ...value, engine: 'v2' };
  }
  if (fs.existsSync(previous)) {
    const value = read(previous);
    if (value.schema !== 'nelyx.app.v2/1' || value.engine !== 'v2')
      throw Error('Expected nelyx.v2.json with nelyx.app.v2/1 and engine v2');
    return value;
  }
  if (packageConfig !== undefined)
    throw Error(
      'The previous package.json.nelyx host settings require explicit migration to nelyx.app/1',
    );
  throw Error('App configuration is missing: create nelyx.json with nelyx.app/1');
}
const config = readAppConfiguration;
export async function buildEngineV2Application(options) {
  const app = fs.realpathSync(options.app),
    settings = config(app),
    target = options.target;
  if (!['windows', 'web', 'android'].includes(target))
    throw Error('Engine v2 has no supplied ' + target + ' host');
  if (settings.vm !== undefined && settings.vm !== (target === 'web' ? 'browser' : 'hermes'))
    throw Error('The requested JavaScript VM is not supplied for ' + target);
  const supply = verifyEngineV2Supply(
    path.resolve(app, options.engineInputs ?? settings.supply ?? '__missing_engine_supply__'),
    target,
    options.windowsHost ?? settings.windowsHost,
  );
  const require = createRequire(path.join(app, 'package.json')),
    designImport = createEngineV2DesignImportPolicy(require.resolve),
    core = require.resolve('@nelyx/core/v2');
  const installed = await import(pathToFileURL(core));
  if (installed.protocol.schema !== p.schema)
    throw Error('Application Core ABI/schema differs from the CLI');
  const entry = input(app, settings.entry),
    output = outputPath(app, options.output ?? `dist/v2-${target}`),
    parent = path.dirname(output);
  if (
    !inside(app, output) ||
    inside(output, entry) ||
    inside(output, supply.root) ||
    output === supply.root
  )
    throw Error('Output overlaps an input or leaves the app');
  if (
    fs.existsSync(output) &&
    (!fs.statSync(output).isDirectory() ||
      !fs.existsSync(path.join(output, 'app-manifest.json')) ||
      read(path.join(output, 'app-manifest.json')).schema !== 'nelyx.app.v2.bundle/1')
  )
    throw Error('Output is not an existing engine v2 application bundle');
  fs.mkdirSync(parent, { recursive: true });
  const staged = fs.mkdtempSync(path.join(parent, '.engine-v2-')),
    backup = staged + '-previous';
  let moved = false;
  try {
    const importRoutes = new Map();
    const createBundle = (canonical) =>
      build({
        stdin: {
          contents: canonical
            ? `import app from ${JSON.stringify(entry)};import {launchApp} from '@nelyx/sdk/app';launchApp(app);`
            : `import app from ${JSON.stringify(entry)};import {launchEngineV2App} from '@nelyx/sdk/engine-v2';launchEngineV2App(app);`,
          resolveDir: app,
          sourcefile: 'engine-v2-entry.ts',
          loader: 'ts',
        },
        outfile: path.join(staged, 'application/app.js'),
        bundle: true,
        format: 'iife',
        platform: target === 'web' ? 'browser' : 'neutral',
        mainFields: target === 'web' ? ['browser', 'module', 'main'] : ['module', 'main'],
        target: target === 'web' ? 'es2022' : 'es2015',
        ...(target === 'windows'
          ? { supported: windowsHermesSyntax }
          : target !== 'web'
            ? { supported: { bigint: true } }
            : {}),
        metafile: true,
        logLevel: 'silent',
        plugins: [
          {
            name: 'v2-entrypoint-contract',
            setup(builder) {
              builder.onResolve(
                { filter: /^@nelyx\/(core|material|cupertino|sdk)(\/|$)/ },
                (args) => {
                  if (
                    !engineV2ImportRoute(args.path) &&
                    !engineV2OriginalAppRoute(args.path) &&
                    !(
                      args.path === '@nelyx/core/internal/framework/rendering/native-grid' &&
                      fs.existsSync(args.importer) &&
                      fs.realpathSync(args.importer) ===
                        fs.realpathSync(path.join(path.dirname(core), '../app/grid.js'))
                    ) &&
                    !designImport(args.path, args.importer) &&
                    !(
                      args.path === '@nelyx/core/internal/framework/widgets/ticker-scheduler' &&
                      /[/\\]v2[/\\]app[/\\]scroll\.js$/.test(args.importer)
                    ) &&
                    !(
                      [
                        '@nelyx/core/internal/services/asset-loader-binding',
                        '@nelyx/core/internal/ui/immutable-buffer-binding',
                      ].includes(args.path) &&
                      fs.existsSync(args.importer) &&
                      fs.realpathSync(args.importer) ===
                        fs.realpathSync(
                          path.join(
                            path.dirname(require.resolve('@nelyx/sdk/engine-v2')),
                            'app-session.js',
                          ),
                        )
                    ) &&
                    !(
                      [
                        '@nelyx/core/internal/ui/image-descriptor-binding',
                        '@nelyx/core/internal/ui/immutable-buffer-binding',
                        '@nelyx/core/hosting/images',
                        '@nelyx/core/hosting/resources',
                      ].includes(args.path) &&
                      fs.existsSync(args.importer) &&
                      [
                        'engine-v2-images.js',
                        ...(args.path === '@nelyx/core/internal/ui/image-descriptor-binding'
                          ? ['app-session.js']
                          : []),
                      ].some(
                        (file) =>
                          fs.realpathSync(args.importer) ===
                          fs.realpathSync(
                            path.join(path.dirname(require.resolve('@nelyx/sdk/engine-v2')), file),
                          ),
                      )
                    ) &&
                    !(
                      args.path ===
                        '@nelyx/core/internal/framework/widgets/native-radio-semantics' &&
                      fs.existsSync(args.importer) &&
                      fs.realpathSync(args.importer) ===
                        fs.realpathSync(path.join(path.dirname(core), '../app/controls.js'))
                    ) &&
                    !(
                      args.path === '@nelyx/core/internal/framework/widgets/text-input' &&
                      fs.existsSync(args.importer) &&
                      fs.realpathSync(args.importer) ===
                        fs.realpathSync(path.join(path.dirname(core), '../app/editing.js'))
                    ) &&
                    !(
                      [
                        '@nelyx/core/hosting/text-layout-budget',
                        '@nelyx/core/hosting/text-fonts',
                      ].includes(args.path) &&
                      fs.existsSync(args.importer) &&
                      fs.realpathSync(args.importer) ===
                        fs.realpathSync(path.join(path.dirname(core), '../app/text.js'))
                    )
                  )
                    return {
                      errors: [
                        {
                          text: `Engine v2 cannot import ${args.path}; select its implemented /v2 API. Legacy widgets are not an engine fallback.`,
                        },
                      ],
                    };
                  try {
                    const route =
                      engineV2ImportRoute(args.path) ??
                      engineV2OriginalAppRoute(args.path) ??
                      args.path;
                    const resolved = require.resolve(route);
                    importRoutes.set(args.path, route);
                    return { path: resolved };
                  } catch (error) {
                    return { errors: [{ text: String(error) }] };
                  }
                },
              );
            },
          },
        ],
      });
    let bundle = await createBundle(settings.schema === 'nelyx.app/1');
    if (
      settings.schema !== 'nelyx.app/1' &&
      engineV2AppSelection(bundle.metafile.inputs).originalApp
    ) {
      // Previous original-App configs retain their constructors while linking
      // directly to the canonical launcher, without a runtime host registry.
      importRoutes.clear();
      bundle = await createBundle(true);
    }
    const coreDirectory = fs.realpathSync(path.resolve(path.dirname(core), '../../..'));
    let bytecode;
    if (target === 'windows') {
      const policy = windowsHermesPolicy('optimized', windowsNativeHermesCohort());
      const producer = supply.manifest.profiles['windows-app-sdk'].appBytecode;
      // The stable upstream compiler fixes class spill ordering. Preserve its
      // native inheritance/new.target in the matching compiler and VM supply.
      const javascript = path.join(staged, 'application/app.js');
      await execute(
        input(supply.root, producer.compiler),
        [
          ...policy.flags,
          '-Xes6-block-scoping',
          '-emit-binary',
          '-emit-async-break-check',
          '-g1',
          '-out=' + path.join(staged, producer.entry),
          path.join(staged, 'application/app.js'),
        ],
        { cwd: app, timeout: 1200000 },
      );
      bytecode = {
        entry: producer.entry,
        version: producer.version,
        policy: policy.id,
        sourceSha256: hash(javascript),
        release: windowsNativeHermesPin.version,
        classes: windowsNativeHermesPin.classes,
        syntax: windowsHermesSyntax,
      };
    }
    const graph = inspectEngineV2Graph(
      Object.keys(bundle.metafile.inputs).map((file) => path.resolve(file)),
      coreDirectory,
      bundle.metafile.inputs,
    );
    const assets = settings.assets ?? {};
    if (
      !assets ||
      typeof assets !== 'object' ||
      Array.isArray(assets) ||
      Object.keys(assets).length > 256
    )
      throw Error('Invalid application asset catalog/count');
    let assetBytes = 0;
    const assetNames = new Map();
    for (const [name, relative] of Object.entries(assets)) {
      applicationAssetKey(name);
      const canonicalName = name.toLowerCase();
      if (['assetmanifest.bin', 'assetmanifest.bin.json'].includes(canonicalName.split('/')[0]))
        throw Error('Application asset manifest keys are generated');
      const parts = name.split('/');
      for (let count = 1; count <= parts.length; ++count) {
        const prefix = parts.slice(0, count).join('/'),
          folded = prefix.toLowerCase(),
          known = assetNames.get(folded);
        if (known !== undefined && known !== prefix)
          throw Error('Application asset paths collide: ' + name);
        assetNames.set(folded, prefix);
      }
      const source = input(app, relative);
      if (assetBytes + fs.statSync(source).size > p.limits.resourceBytes)
        throw Error('Application assets exceed session resource budget');
      const destination = path.join(staged, 'application/assets', name);
      if (fs.existsSync(destination)) throw Error('Application asset paths collide: ' + name);
      fs.mkdirSync(path.dirname(destination), { recursive: true });
      fs.copyFileSync(source, destination);
      assetBytes += fs.statSync(destination).size;
      if (assetBytes > p.limits.resourceBytes)
        throw Error('Application assets changed beyond session resource budget');
    }
    const { StandardMessageCodec } = await import(
      pathToFileURL(require.resolve('@nelyx/core/services/message-codecs'))
    );
    writeAssetManifests(
      path.join(staged, 'application/assets'),
      Object.keys(assets),
      StandardMessageCodec,
    );
    const main = await build({
      stdin: {
        contents: browserMain,
        resolveDir: app,
        sourcefile: 'engine-v2-main.ts',
        loader: 'ts',
      },
      bundle: true,
      format: 'iife',
      platform: 'browser',
      target: 'es2022',
      write: false,
      logLevel: 'silent',
    });
    fs.writeFileSync(path.join(staged, 'application/main.js'), main.outputFiles[0].contents);
    fs.writeFileSync(
      path.join(staged, 'index.html'),
      '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Nelyx v2</title><style>html,body{margin:0;width:100%;height:100%;overflow:hidden}canvas{width:100%;height:100%;display:block}#error{position:fixed;bottom:0;color:#b00020;background:white}</style></head><body><canvas></canvas><output id="error"></output><script src="application/main.js"></script></body></html>',
    );
    const android =
      target === 'android'
        ? buildEngineV2AndroidApk({
            app,
            supply,
            staged,
            settings,
            architecture: options.architecture,
            androidSdk: options.androidSdk,
            instrumentation: options.androidTests === true,
            development: options.development === true,
          })
        : undefined;
    const files = [];
    const visit = (directory) => {
      for (const item of fs.readdirSync(directory, { withFileTypes: true })) {
        const file = path.join(directory, item.name);
        if (item.isDirectory()) visit(file);
        else
          files.push({
            path: path.relative(staged, file).replaceAll('\\', '/'),
            sha256: hash(file),
          });
      }
    };
    visit(staged);
    const manifest = {
      schema: 'nelyx.app.v2.bundle/1',
      engine: 'v2',
      target,
      ...(bytecode ? { bytecode } : {}),
      ...(android ? { android } : {}),
      ...(target === 'windows'
        ? { windowsHost: engineV2WindowsHost(options.windowsHost ?? settings.windowsHost).host }
        : {}),
      abi: supply.manifest.abi,
      supplySourceSha256: supply.manifest.sourceSha256,
      supply: supply.root,
      routing: {
        ...graph,
        imports: [...importRoutes].map(([original, route]) => ({ original, route })),
      },
      modules: Object.keys(bundle.metafile.inputs).length,
      files,
    };
    fs.writeFileSync(
      path.join(staged, 'app-manifest.json'),
      JSON.stringify(manifest, null, 2) + '\n',
    );
    if (options.canPublish && !options.canPublish())
      return { engine: 'v2', target, obsolete: true };
    if (fs.existsSync(output)) {
      fs.renameSync(output, backup);
      moved = true;
    }
    fs.renameSync(staged, output);
    return {
      engine: 'v2',
      target,
      directory: output,
      sourceSha256: manifest.supplySourceSha256,
      modules: manifest.modules,
      routing: manifest.routing,
    };
  } finally {
    if (fs.existsSync(staged)) removeTemporary(staged, parent, '.engine-v2-');
    if (moved && fs.existsSync(backup)) {
      if (!fs.existsSync(output)) fs.renameSync(backup, output);
      else removeTemporary(backup, parent, '.engine-v2-');
    }
  }
}
export function verifyEngineV2Application(directory, target, engineInputs) {
  const root = fs.realpathSync(directory),
    manifest = read(path.join(root, 'app-manifest.json'));
  if (
    manifest.schema !== 'nelyx.app.v2.bundle/1' ||
    manifest.target !== target ||
    manifest.engine !== 'v2'
  )
    throw Error('Application engine/target identity differs');
  const supply = verifyEngineV2Supply(
    engineInputs ?? path.resolve(root, manifest.supply),
    target,
    manifest.windowsHost,
  );
  if (
    manifest.abi.major !== p.abiMajor ||
    manifest.abi.schema !== p.schema ||
    manifest.supplySourceSha256 !== supply.manifest.sourceSha256
  )
    throw Error('Application and host v2 supply identities differ; rebuild the application');
  for (const file of manifest.files)
    if (hash(input(root, file.path)) !== file.sha256)
      throw Error('Application bundle identity mismatch: ' + file.path);
  if (target === 'windows') {
    const expected = supply.manifest.profiles['windows-app-sdk'].appBytecode;
    if (
      manifest.bytecode?.entry !== expected.entry ||
      manifest.bytecode?.policy !== expected.policy ||
      manifest.bytecode?.version !== expected.version ||
      !manifest.files.some((file) => file.path === expected.entry) ||
      manifest.bytecode?.release !== expected.release ||
      manifest.bytecode?.classes !== windowsNativeHermesPin.classes ||
      JSON.stringify(manifest.bytecode?.syntax) !== JSON.stringify(windowsHermesSyntax) ||
      manifest.bytecode?.sourceSha256 !== hash(input(root, 'application/app.js')) ||
      fs.readFileSync(input(root, expected.entry)).readUInt32LE(8) !== expected.version
    )
      throw Error('Windows optimized App bytecode identity differs; rebuild the application');
  }
  if (target === 'android') {
    const selected = manifest.android,
      names = new Set(manifest.files.map((file) => file.path));
    if (
      !selected ||
      !supply.manifest.profiles.android.abis.includes(selected.architecture) ||
      !/^[a-z][a-z0-9_]*(?:\.[a-z][a-z0-9_]*){2,}$/.test(selected.applicationId) ||
      selected.activity !== 'dev.nelyx.engine.MainActivity' ||
      selected.profile !==
        (selected.architecture === 'x86_64' ? 'emulator-vulkan' : 'hardware-vulkan') ||
      !names.has('application/app.hbc') ||
      !names.has('android/application.apk')
    )
      throw Error('Android application identity/ABI/runtime is missing or differs');
  }
  return { root, manifest, supply };
}
export function createEngineV2Server(bundleOrReader, { development } = {}) {
  return http.createServer((request, response) => {
    try {
      let bundle = typeof bundleOrReader === 'function' ? bundleOrReader() : bundleOrReader;
      const url = new URL(request.url, 'http://localhost'),
        isolated = url.pathname.startsWith('/isolated/');
      if (!isolated && !url.pathname.startsWith('/plain/')) {
        response.writeHead(302, { location: '/isolated/' + url.search });
        response.end();
        return;
      }
      let name = decodeURIComponent(url.pathname.slice(isolated ? 10 : 7)) || 'index.html';
      if (development && name === '__nelyx_dev') {
        development.connect(request, response);
        return;
      }
      if (development && name === '__nelyx_dev/closed') {
        development.acknowledge(request, response);
        return;
      }
      let generation = development?.generation;
      if (development && name.startsWith('__nelyx_gen/')) {
        const match = /^__nelyx_gen\/([1-9][0-9]*)\/(.+)$/.exec(name);
        bundle = match && development.bundleFor(Number(match[1]));
        if (!bundle) {
          response.writeHead(410);
          response.end('Application generation expired');
          return;
        }
        generation = Number(match[1]);
        name = match[2];
      }
      const root =
          name === 'index.html' || name.startsWith('application/')
            ? bundle.root
            : bundle.supply.root,
        file = input(root, name);
      const allowed = root === bundle.root ? bundle.manifest.files : bundle.supply.manifest.files;
      if (
        !allowed.some((entry) => entry.path === name) &&
        !(root === bundle.supply.root && name === 'engine-manifest.json')
      )
        throw Error('Undeclared asset');
      response.writeHead(200, {
        'Content-Type':
          {
            '.js': 'application/javascript',
            '.html': 'text/html; charset=utf-8',
            '.wasm': 'application/wasm',
            '.json': 'application/json',
            '.ttf': 'font/ttf',
          }[path.extname(file)] ?? 'application/octet-stream',
        'Cache-Control': 'no-store',
        'Cross-Origin-Resource-Policy': 'same-origin',
        ...(name.startsWith('application/assets/')
          ? {
              'Content-Length': fs.statSync(file).size,
              'X-Nelyx-Asset-Sha256': allowed.find((entry) => entry.path === name).sha256,
            }
          : {}),
        ...(isolated
          ? {
              'Cross-Origin-Opener-Policy': 'same-origin',
              'Cross-Origin-Embedder-Policy': 'require-corp',
            }
          : {}),
      });
      if (request.method === 'HEAD') {
        response.end();
        return;
      }
      if (development && name === 'index.html') {
        const configuration =
          '<script>globalThis.__nelyxDevelopment=' + JSON.stringify({ generation }) + ';</script>';
        response.end(
          fs
            .readFileSync(file, 'utf8')
            .replace('</head>', configuration + '</head>')
            .replace(
              'src="application/main.js"',
              'src="' +
                (isolated ? '/isolated/' : '/plain/') +
                '__nelyx_gen/' +
                generation +
                '/application/main.js"',
            ),
        );
      } else fs.createReadStream(file).pipe(response);
    } catch {
      response.writeHead(404);
      response.end('Asset unavailable');
    }
  });
}
export async function engineV2Operation(operation, options) {
  if (!['web', 'windows', 'android'].includes(options.target))
    throw Error('Engine v2 has no ' + options.target + ' host');
  if (operation === 'build' || operation === 'prepare') return buildEngineV2Application(options);
  const app = path.resolve(options.app);
  let directory = path.resolve(app, options.directory ?? `dist/v2-${options.target}`);
  if (operation === 'doctor') {
    const settings = config(app),
      supply = verifyEngineV2Supply(
        path.resolve(app, options.engineInputs ?? settings.supply ?? '__missing_engine_supply__'),
        options.target,
        settings.windowsHost,
      );
    return {
      engine: 'v2',
      target: options.target,
      ...(options.target === 'android'
        ? { android: doctorEngineV2Android(supply, options).pins }
        : {}),
      ...(options.target === 'windows'
        ? { windowsHost: engineV2WindowsHost(settings.windowsHost).host }
        : {}),
      sourceSha256: supply.manifest.sourceSha256,
    };
  }
  if (operation === 'dev') {
    const { runEngineV2Development } = await import('./engine-v2-development.mjs');
    return runEngineV2Development(options);
  }
  const bundle = verifyEngineV2Application(
    directory,
    options.target,
    options.engineInputs && path.resolve(app, options.engineInputs),
  );
  if (operation === 'run') {
    if (options.target === 'android') return runEngineV2Android(bundle, options);
    if (options.target === 'windows')
      return await new Promise((resolve, reject) => {
        const child = spawn(
          path.join(
            bundle.supply.root,
            engineV2WindowsHost(bundle.manifest.windowsHost).executable,
          ),
          [bundle.supply.root, '--app', bundle.root, ...(options.arguments ?? [])],
          { stdio: 'inherit', windowsHide: false },
        );
        child.once('error', reject);
        child.once('exit', (code) => resolve({ engine: 'v2', exitCode: code ?? 1 }));
      });
    const server = createEngineV2Server(bundle);
    await new Promise((resolve, reject) => {
      server.once('error', reject);
      server.listen(options.port ?? 8192, options.host ?? '127.0.0.1', resolve);
    });
    const url = `http://${options.host ?? '127.0.0.1'}:${server.address().port}/isolated/`;
    console.log('Engine v2: ' + url + ' · /plain/ selects the non-isolated functional profile');
    await new Promise((resolve) => {
      const close = () => server.close(resolve);
      process.once('SIGINT', close);
      process.once('SIGTERM', close);
    });
    return { engine: 'v2', exitCode: 0 };
  }
  if (operation === 'pack') {
    const output = outputPath(app, options.output ?? `dist/v2-${options.target}-package`),
      parent = path.dirname(output);
    if (
      !inside(app, output) ||
      inside(output, bundle.root) ||
      inside(bundle.root, output) ||
      inside(output, bundle.supply.root) ||
      output === bundle.supply.root
    )
      throw Error('Package output overlaps an input or leaves the app');
    if (
      fs.existsSync(output) &&
      (!fs.existsSync(path.join(output, 'app-manifest.json')) ||
        read(path.join(output, 'app-manifest.json')).schema !== 'nelyx.app.v2.bundle/1')
    )
      throw Error('Package output is not an existing v2 package');
    fs.mkdirSync(parent, { recursive: true });
    const staged = fs.mkdtempSync(path.join(parent, '.engine-v2-')),
      backup = staged + '-previous';
    let moved = false;
    try {
      for (const file of bundle.manifest.files) {
        const destination = path.join(staged, file.path);
        fs.mkdirSync(path.dirname(destination), { recursive: true });
        fs.copyFileSync(input(bundle.root, file.path), destination);
      }
      for (const file of [...bundle.supply.manifest.files, { path: 'engine-manifest.json' }]) {
        const destination = path.join(staged, 'engine', file.path);
        fs.mkdirSync(path.dirname(destination), { recursive: true });
        fs.copyFileSync(input(bundle.supply.root, file.path), destination);
      }
      fs.writeFileSync(
        path.join(staged, 'app-manifest.json'),
        JSON.stringify({ ...bundle.manifest, supply: 'engine' }, null, 2) + '\n',
      );
      if (fs.existsSync(output)) {
        fs.renameSync(output, backup);
        moved = true;
      }
      fs.renameSync(staged, output);
      verifyEngineV2Application(output, options.target);
      return {
        engine: 'v2',
        target: options.target,
        directory: output,
        standalone: true,
        sourceSha256: bundle.manifest.supplySourceSha256,
      };
    } finally {
      if (fs.existsSync(staged)) removeTemporary(staged, parent, '.engine-v2-');
      if (moved && fs.existsSync(backup)) {
        if (!fs.existsSync(output)) fs.renameSync(backup, output);
        else removeTemporary(backup, parent, '.engine-v2-');
      }
    }
  }
  throw Error('Unsupported engine v2 operation: ' + operation);
}
export function createEngineV2Project(
  destination,
  {
    name = 'NelyxApp',
    core = '0.16.0',
    sdk = '0.20.0',
    cli = '0.10.0',
    metro,
    'static-aot': staticAot,
    'tooling-contracts': toolingContracts,
    designs = [],
    material = '0.1.0',
    cupertino = '0.1.0',
  } = {},
) {
  if (!/^[A-Z][A-Za-z0-9]*$/.test(name))
    throw Error('App name must start with an uppercase letter and contain letters/digits');
  if (
    !Array.isArray(designs) ||
    new Set(designs).size !== designs.length ||
    designs.some((name) => !['material', 'cupertino'].includes(name))
  )
    throw Error('Designs must select material, cupertino, both, or none');
  const root = path.resolve(destination);
  if (fs.existsSync(root) && fs.readdirSync(root).length) throw Error('Destination must be empty');
  fs.mkdirSync(path.join(root, 'src'), { recursive: true });
  fs.writeFileSync(
    path.join(root, 'package.json'),
    JSON.stringify(
      {
        name: name.toLowerCase(),
        private: true,
        type: 'module',
        dependencies: {
          '@nelyx/core': core,
          '@nelyx/sdk': sdk,
          ...Object.fromEntries(
            designs.map((name) => ['@nelyx/' + name, name === 'material' ? material : cupertino]),
          ),
        },
        devDependencies: {
          '@nelyx/cli': cli,
          typescript: '7.0.2',
          ...(metro ? { '@nelyx/metro': metro } : {}),
          ...(toolingContracts ? { '@nelyx/tooling-contracts': toolingContracts } : {}),
          ...(staticAot ? { '@nelyx/static-aot': staticAot } : {}),
        },
        scripts: {
          'check': 'tsc -p tsconfig.json --noEmit',
          'build:web': 'nelyx build --engine v2 --target web',
          'run:web': 'nelyx run --engine v2 --target web',
          'build:windows': 'nelyx build --engine v2 --target windows',
          'run:windows': 'nelyx run --engine v2 --target windows',
          'build:android': 'nelyx build --engine v2 --target android',
          'run:android': 'nelyx run --engine v2 --target android',
          'dev:android': 'nelyx dev --engine v2 --target android',
        },
      },
      null,
      2,
    ) + '\n',
  );
  fs.writeFileSync(
    path.join(root, 'tsconfig.json'),
    JSON.stringify(
      {
        compilerOptions: {
          target: 'ES2022',
          module: 'NodeNext',
          moduleResolution: 'NodeNext',
          lib: ['ES2022'],
          types: [],
          strict: true,
          skipLibCheck: false,
          noEmit: true,
          rewriteRelativeImportExtensions: true,
        },
        include: ['src/**/*.ts'],
      },
      null,
      2,
    ) + '\n',
  );
  fs.writeFileSync(
    path.join(root, 'nelyx.json'),
    JSON.stringify(
      { schema: 'nelyx.app/1', entry: 'src/app.ts', windowsHost: 'windows-app-sdk', assets: {} },
      null,
      2,
    ) + '\n',
  );
  fs.writeFileSync(
    path.join(root, 'src/app.ts'),
    "import {defineApp} from '@nelyx/sdk/app';\nimport {Column,Text,ColoredBox,SizedBox,Padding} from '@nelyx/core/framework/widgets/basic';\nimport {Directionality} from '@nelyx/core/framework/widgets/app-data';\nexport default defineApp({build:()=>new Directionality('ltr',new Padding({left:24,top:24,right:0,bottom:0},new Column([new Text('Nelyx',{fontSize:28}),new SizedBox(undefined,20),new SizedBox(160,64,new ColoredBox({color:0xff6750a4}))],{mainAxisSize:'min'})))});\n",
  );
  return {
    engine: 'v2',
    directory: root,
    next: 'Install dependencies, then build with --engine-inputs <verified engine dist>.',
  };
}
const browserMain = `import {createBrowserEngineV2Surface,bindBrowserAppServices,protocol as p} from '@nelyx/sdk/engine';
import {drainEngineOwners} from '@nelyx/core/engine';
const baseRoot=new URL('.',location.href),development=globalThis.__nelyxDevelopment;
const root=development?new URL('__nelyx_gen/'+development.generation+'/',baseRoot):baseRoot,error=document.querySelector('#error');
const current=globalThis.__nelyxV2={ready:false,errors:[]};
const fail=message=>{error.textContent=message;current.errors.push(message);};
(async()=>{
 const surface=await createBrowserEngineV2Surface(document.querySelector('canvas'),{root,profile:new URL(location.href).searchParams.get('profile')??'auto',onError:fail});
 current.surface=surface;const app=new Worker(new URL('application/app.js',root));current.app=app;const services=bindBrowserAppServices(app);let appDisposed=false;
 app.addEventListener('message',event=>{if(event.data.kind==='app-ready'){current.ready=true;current.receipt=event.data;}else if(event.data.kind==='app-error')fail(event.data.message);else if(event.data.kind==='app-disposed')appDisposed=true;});
 app.addEventListener('error',event=>fail(event.message));const port=surface.createAppPort(app);
 app.postMessage({kind:'start',root:root.href,port,identity:{engine:'v2',abiMajor:p.abiMajor,schema:p.schema}},[port]);
 let closing;
 current.close=()=>closing??=(async()=>{
  let failure;try{
   if(!appDisposed)await new Promise((resolve,reject)=>{
    let appError;
    const cleanup=()=>{clearTimeout(timer);app.removeEventListener('message',receive);};
    const receive=event=>{if(event.data.kind==='app-disposed'){cleanup();resolve();}else if(event.data.kind==='app-error')appError??=Error(event.data.message);};
    const timer=setTimeout(()=>{cleanup();reject(appError??Error('App disposal timeout'));},3000);
    app.addEventListener('message',receive);app.postMessage({kind:'close'});
   });
  }catch(error){failure=error;}
  let result;
  await drainEngineOwners('App and surface close failed',[
   ()=>{if(failure)throw failure;},
   ()=>services.close(),
   async()=>{result=await surface.close();},
   ()=>{current.ready=false;}
  ]);
  return result;
 })();
 if(development){
  const events=new EventSource(new URL('__nelyx_dev',baseRoot));let reloading=false,client,drained;
  current.development={generation:development.generation,lastError:null};
  const drain=()=>drained??=(async()=>{current.reloading=true;const closed=await current.close();console.log('NELYX_V2_RELOAD_CLOSED '+JSON.stringify({generation:development.generation,closed:{reservedBytes:closed.reservedBytes,workersStopped:closed.workersStopped,providers:closed.provider?.contentClosed?[closed.provider.contentClosed,closed.provider.renderClosed]:[closed.provider]}}));return closed;})();
  const reload=async()=>{if(reloading)return;reloading=true;await drain();events.close();location.reload();};
  events.onmessage=event=>{void(async()=>{
   const value=JSON.parse(event.data);
   if(value.kind==='connected'){client=value.client;if(value.generation>development.generation)await reload();return;}
   if(value.kind==='build-failed'){current.development.lastError=value.message;console.error('NELYX_V2_BUILD_FAILED '+value.message);return;}
   if(value.kind==='replacement-failed'){events.close();fail(value.message);return;}
   if(value.kind==='replacing'||value.kind==='stopping'){
    let error;try{await drain();}catch(failure){error=String(failure);fail('Generation drain failed: '+error);}
    const result=await fetch(new URL('__nelyx_dev/closed',baseRoot),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({client,ticket:value.ticket,...(error?{error:error.slice(0,256)}:{})})});
    if(!result.ok)throw Error('Generation drain acknowledgement rejected');return;
   }
   if(value.kind==='published'&&value.generation>development.generation)await reload();
  })().catch(error=>fail(String(error)));};
  addEventListener('pagehide',()=>events.close(),{once:true});
 }
})().catch(error=>fail(String(error)));`;
