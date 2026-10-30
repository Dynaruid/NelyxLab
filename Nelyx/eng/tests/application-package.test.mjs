// SPDX-License-Identifier: BSD-3-Clause
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import { createHash } from 'node:crypto';
import test from 'node:test';
import ts from 'typescript';
import { defineConfig, defineAssetManifest } from '../../sdk/dist/runtime/config.js';
import {
  verifyAppAssets,
  prepareAppAssetConfiguration,
  copyAndroidFontAssets,
  materializeAppAssets,
  copyAppNotices,
} from '../../sdk/tooling/metro/src/assets.cjs';
import { createApp } from '../../sdk/tooling/cli/src/create-app.mjs';
import {
  readApplication,
  configureWindowsApplication,
} from '../../sdk/tooling/cli/src/application.mjs';

const timeout = 1_200_000,
  root = path.resolve(import.meta.dirname, '../../..');
const template = path.join(root, 'Nelyx/sdk/tooling/cli/templates/nelyx-app');
const read = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));
const json = (file, value) => fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\n');
const baseline = read(path.join(template, 'package.json.template'));
const hash = (value) => createHash('sha256').update(value).digest('hex');
const retired = [
  'app.json',
  'application.json',
  'nelyx.config.ts',
  ...['android', 'windows', 'ios', 'macos', 'linux'].map((id) => 'nelyx.' + id + '.bootstrap.ts'),
];
async function temporary(run) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'nelyx-app-package-'));
  try {
    return await run(directory);
  } finally {
    assert.equal(path.dirname(directory), path.resolve(os.tmpdir()));
    assert(
      path.basename(directory).startsWith('nelyx-app-package-') &&
        !fs.lstatSync(directory).isSymbolicLink(),
    );
    fs.rmSync(directory, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
  }
}

test(
  'package JSON configuration rejects malformed metadata and retains asset/target validation',
  { timeout },
  () => {
    assert.equal(defineConfig(baseline.nelyx).displayName, 'Nelyx Testbed');
    assert(
      baseline.nelyx.assets.every(
        (asset) => asset.sha256 === undefined && asset.notice?.sha256 === undefined,
      ),
    );
    assert.throws(() => defineAssetManifest(baseline.nelyx.assets), /Prepare runner assets/);
    for (const value of [
      undefined,
      null,
      [],
      {},
      { ...baseline.nelyx, name: 12 },
      { ...baseline.nelyx, displayName: '' },
      { ...baseline.nelyx, assets: {} },
      { ...baseline.nelyx, assets: [null] },
      { ...baseline.nelyx, targets: [] },
      { ...baseline.nelyx, targets: { web: { component: '../outside.ts' } } },
    ])
      assert.throws(() => defineConfig(value));
    assert.throws(
      () =>
        defineConfig({
          ...baseline.nelyx,
          assets: [baseline.nelyx.assets[0], baseline.nelyx.assets[0]],
        }),
      /duplicate/,
    );
    assert.throws(
      () =>
        defineConfig({
          ...baseline.nelyx,
          targets: { web: { profile: 'graphite-webgpu', component: './web/runner/App.tsx' } },
        }),
      /Unsupported Web profile/,
    );
  },
);

test(
  'hash-free assets and notices produce portable runtime metadata, refresh after edits and keep Android font ownership',
  { timeout },
  async () =>
    temporary(async (app) => {
      const runner = path.join(app, 'android/runner');
      fs.mkdirSync(runner, { recursive: true });
      fs.mkdirSync(path.join(app, 'assets'));
      const font = {
        id: 'body',
        kind: 'font',
        path: './assets/font.ttf',
        fontFamily: 'Body',
        notice: { path: './assets/OFL.txt' },
      };
      const file = path.join(app, 'package.json'),
        input = { nelyx: { ...baseline.nelyx, assets: [font] } };
      json(file, input);
      json(path.join(runner, 'package.json'), { private: true });
      json(path.join(runner, 'app-config.json'), {
        target: 'android',
        cohort: { id: 'rn-0.83.10' },
      });
      fs.writeFileSync(path.join(app, font.path), 'font one');
      fs.writeFileSync(path.join(app, font.notice.path), 'license');
      const before = fs.readFileSync(file);
      const first = prepareAppAssetConfiguration(app, runner),
        resolved = defineAssetManifest(first.assets);
      assert.equal(first.target, 'android');
      assert.equal(first.cohort.id, 'rn-0.83.10');
      assert.equal(resolved[0].sha256, hash('font one'));
      assert.equal(resolved[0].notice.sha256, hash('license'));
      assert(!JSON.stringify(first).includes(app));
      assert(!Object.hasOwn(resolved[0], 'file'));
      assert(!Object.hasOwn(resolved[0].notice, 'bytes'));
      assert.deepEqual(
        fs.readFileSync(file),
        before,
        'Preparation must not insert hashes into user input',
      );
      const output = path.join(app, 'generated'),
        old = copyAndroidFontAssets(app, [font], output);
      assert.equal(old.fonts[0].sha256, resolved[0].sha256);
      assert(fs.existsSync(path.join(output, 'nelyx/fonts', resolved[0].sha256 + '.ttf')));
      fs.writeFileSync(path.join(app, font.path), 'font two');
      fs.writeFileSync(path.join(app, font.notice.path), 'new license');
      const second = prepareAppAssetConfiguration(app, runner);
      assert.equal(second.assets[0].sha256, hash('font two'));
      assert.equal(second.assets[0].notice.sha256, hash('new license'));
      const latest = copyAndroidFontAssets(app, [font], output);
      assert.equal(latest.fonts[0].sha256, hash('font two'));
      assert(!fs.existsSync(path.join(output, old.fonts[0].file)));
      assert.equal(fs.readFileSync(path.join(output, latest.fonts[0].file), 'utf8'), 'font two');
      const notices = copyAppNotices(app, [font], path.join(app, 'notices'));
      assert.equal(notices[0].sha256, hash('new license'));
      assert.deepEqual(fs.readFileSync(file), before);
    }),
);

test(
  'package assets need no declared hashes and still reject changed destinations and unsafe paths',
  { timeout },
  async () =>
    temporary(async (app) => {
      const source = path.join(app, 'package');
      fs.mkdirSync(source);
      fs.writeFileSync(path.join(source, 'font.ttf'), 'package font');
      fs.writeFileSync(path.join(source, 'OFL.txt'), 'package notice');
      const asset = {
        id: 'packaged',
        kind: 'font',
        path: './assets/font.ttf',
        fontFamily: 'PackageFont',
        notice: { path: './assets/OFL.txt' },
        packageSource: { package: '@fixture/font', path: './font.ttf', noticePath: './OFL.txt' },
      };
      const resolve = (specifier) =>
        path.join(source, specifier.endsWith('OFL.txt') ? 'OFL.txt' : 'font.ttf');
      const resolved = materializeAppAssets(app, [asset], resolve);
      assert.equal(resolved[0].sha256, hash('package font'));
      assert.equal(resolved[0].notice.sha256, hash('package notice'));
      assert.deepEqual(materializeAppAssets(app, [asset], resolve), resolved);
      fs.writeFileSync(path.join(app, 'assets/font.ttf'), 'edited');
      assert.throws(
        () => materializeAppAssets(app, [asset], resolve),
        /Refusing to replace an edited app asset/,
      );
      assert.equal(fs.readFileSync(path.join(app, 'assets/font.ttf'), 'utf8'), 'edited');
      assert.throws(
        () => verifyAppAssets(app, [{ ...asset, path: '../outside.ttf' }]),
        /app-relative/,
      );
      fs.symlinkSync(
        source,
        path.join(app, 'link'),
        process.platform === 'win32' ? 'junction' : 'dir',
      );
      assert.throws(() => verifyAppAssets(app, [{ ...asset, path: './link/font.ttf' }]), /symlink/);
    }),
);

test(
  'creation carries the local Static Hermes AOT tooling reference into each selected runner without root startup files',
  { timeout },
  async () => {
    const disk = fs.statfsSync(os.tmpdir(), { bigint: true });
    assert(
      disk.bavail * disk.bsize >= 20n * 1024n ** 3n,
      'Creation verification requires 20 GiB free',
    );
    for (const target of Object.keys(baseline.nelyx.targets))
      await temporary(async (directory) => {
        const staticAotArchive = path.join(directory, 'static-aot.tgz');
        const app = await createApp(
          path.join(directory, 'app'),
          undefined,
          'PackageApp',
          undefined,
          {
            targets: [target],
            designs: [],
            'static-aot': 'file:' + staticAotArchive,
            ...(target === 'android' ? { profiles: { android: 'emulator-vulkan' } } : {}),
          },
        );
        const manifest = read(path.join(app, 'package.json')),
          config = defineConfig(manifest.nelyx);
        assert.equal(manifest.name, 'packageapp');
        assert.equal(config.name, 'PackageApp');
        assert.equal(config.displayName, 'PackageApp');
        assert.deepEqual(Object.keys(config.targets), [target]);
        const selectedRunner = path.join(app, target, 'runner'),
          reference = read(path.join(selectedRunner, 'package.json')).devDependencies[
            '@nelyx/static-aot'
          ];
        assert.equal(path.resolve(selectedRunner, reference.slice(5)), staticAotArchive);
        assert.equal(
          config.targets[target].profile,
          target === 'android' ? 'emulator-vulkan' : baseline.nelyx.targets[target].profile,
        );
        for (const file of [...retired, 'package.json.template'])
          assert(!fs.existsSync(path.join(app, file)), file);
        assert(
          !fs
            .readFileSync(
              path.join(app, target, 'runner', target === 'windows' ? 'main.tsx' : 'main.ts'),
              'utf8',
            )
            .includes('NelyxTestbed'),
        );
        if (target === 'ios' || target === 'macos') {
          assert(fs.existsSync(path.join(app, target, 'PackageApp.xcodeproj')));
          assert.match(
            fs.readFileSync(path.join(app, target, 'runner/native.mjs'), 'utf8'),
            /\.nelyx\.name/,
          );
        }
      });
  },
);

test(
  'CLI rereads package changes and verifies assets without recreating startup sources',
  { timeout },
  async () =>
    temporary(async (directory) => {
      const app = await createApp(path.join(directory, 'app'), undefined, 'PackageApp', undefined, {
        targets: ['windows'],
        designs: [],
      });
      const modules = path.join(app, 'windows/runner/node_modules/@nelyx');
      fs.mkdirSync(modules, { recursive: true });
      fs.symlinkSync(
        path.join(root, 'Nelyx/sdk/tooling/metro'),
        path.join(modules, 'metro'),
        process.platform === 'win32' ? 'junction' : 'dir',
      );
      const first = await readApplication(app, 'windows');
      assert.equal(first.config.name, 'PackageApp');
      assert(first.config.assets.every((asset) => /^[a-f0-9]{64}$/.test(asset.sha256)));
      assert(
        read(path.join(app, 'package.json')).nelyx.assets.every(
          (asset) => asset.sha256 === undefined,
        ),
      );
      configureWindowsApplication(first);
      assert.equal(read(path.join(first.runner, 'app-config.json')).name, 'PackageApp');
      const file = path.join(app, 'package.json'),
        manifest = read(file);
      manifest.nelyx.name = 'UpdatedApp';
      json(file, manifest);
      const second = await readApplication(app, 'windows');
      assert.equal(second.config.name, 'UpdatedApp');
      configureWindowsApplication(second);
      assert.equal(read(path.join(first.runner, 'app-config.json')).name, 'UpdatedApp');
      await assert.rejects(readApplication(app, 'web'), /does not configure target/);
      manifest.nelyx.assets[0].sha256 = '0'.repeat(64);
      json(file, manifest);
      await assert.rejects(readApplication(app, 'windows'), /hash mismatch/);
      delete manifest.nelyx;
      json(file, manifest);
      await assert.rejects(
        readApplication(app, 'windows'),
        /requires an nelyx configuration object/,
      );
      for (const file of retired) assert(!fs.existsSync(path.join(app, file)), file);
    }),
);

async function registerMain(app, target, application) {
  const portable = ({ file, bytes, ...value }) => value;
  const manifest = defineAssetManifest(
    verifyAppAssets(app, application.nelyx.assets).map((asset) => ({
      ...portable(asset),
      ...(asset.notice ? { notice: portable(asset.notice) } : {}),
    })),
  );
  const file = path.join(app, target, 'runner', target === 'windows' ? 'main.tsx' : 'main.ts');
  const source = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
    },
  }).outputText;
  const calls = [],
    imports = [],
    configured = [],
    errors = [],
    App = () => {},
    element = {};
  const backend = { react: { StrictMode: () => {}, createElement: () => element } };
  const context = {
    exports: {},
    URL,
    location: { href: 'http://localhost:8081/' },
    document: { getElementById: () => element, body: { dataset: {} } },
    fetch: async () => ({ json: async () => ({ runtime: true }) }),
    console: { error: (error) => errors.push(error) },
    require(specifier) {
      if (specifier === '../../package.json') return application;
      if (specifier === './app-config.json') return { assets: manifest };
      if (specifier === '@nelyx/sdk/runtime/config') return { defineConfig, defineAssetManifest };
      if (specifier === `@nelyx/sdk/platforms/${target}/application`)
        return {
          registerApplication: (...args) => calls.push(args),
          webBackend: () => backend,
          closeAllWebApplications: () => {},
        };
      if (specifier === './App.tsx') return { __esModule: true, default: App, App };
      if (specifier === './configuration.ts')
        return { configure: (value) => configured.push(value) };
      if (specifier === '@nelyx/metro/web-refresh') return { setWebReloadHandler: () => {} };
      if (specifier.includes('InitializeCore')) return {};
      if (specifier.startsWith('../../assets/')) {
        assert(fs.existsSync(path.resolve(path.dirname(file), specifier)));
        imports.push(specifier);
        return { uri: specifier };
      }
      throw new Error('Unexpected runner import: ' + specifier);
    },
  };
  vm.runInNewContext(source, context, { filename: file });
  await new Promise(setImmediate);
  assert.deepEqual(errors, []);
  assert.equal(calls.length, 1);
  assert.equal(calls[0][0], application.nelyx.name);
  if (target === 'web') {
    assert.deepEqual(configured[0].manifest, manifest);
    assert.equal(calls[0][2], element);
    return;
  }
  assert.equal(calls[0][1], App);
  const options = calls[0][2],
    settings = application.nelyx.targets[target];
  assert.equal(options.profile, settings.profile);
  assert.equal(options.cohort, settings.cohort);
  assert.deepEqual(options.assets.manifest, manifest);
  assert.deepEqual(
    Object.keys(options.assets.sources).sort(),
    application.nelyx.assets.map((asset) => asset.id).sort(),
  );
  for (const asset of manifest) {
    const uri = options.assets.sources[asset.id].uri;
    if (target === 'windows') assert.equal(uri, 'nelyx-asset:/' + asset.path.slice(2));
    else if (target === 'android' && asset.kind === 'font')
      assert.equal(uri, 'asset:/nelyx/fonts/' + asset.sha256 + '.ttf');
    else assert(imports.includes('../../' + asset.path.slice(2)));
  }
  if (target === 'android')
    assert(
      !imports.some((file) => file.endsWith('.ttf')),
      'Android fonts must use the single native copy',
    );
}

test(
  'all template runners and current sample runners register directly with package metadata and target asset sources',
  { timeout },
  async () => {
    for (const target of Object.keys(baseline.nelyx.targets))
      await registerMain(template, target, baseline);
    const sample = path.join(root, 'sample/nelyx-testbed-app-2'),
      application = read(path.join(sample, 'package.json'));
    for (const target of Object.keys(application.nelyx.targets))
      await registerMain(sample, target, application);
  },
);
