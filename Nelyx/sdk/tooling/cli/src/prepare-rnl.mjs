// SPDX-License-Identifier: BSD-3-Clause
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';

const root = path.resolve(import.meta.dirname, '..');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'upstream/react-native-linux.json')));
const source = path.resolve(
  process.argv[2] ?? path.join(root, '../../../.cache/native/linux/react-native-linux'),
);
if (!process.argv[3])
  throw new Error('Usage: node prepare-rnl.mjs <pinned-checkout> <new-staging-directory>');
const staging = path.resolve(process.argv[3]);
const git = (...args) => execFileSync('git', ['-C', source, ...args], { encoding: 'utf8' }).trim();
if (git('rev-parse', 'HEAD') !== manifest.commit || git('status', '--porcelain')) {
  throw new Error('RNL supply requires the exact clean pinned checkout');
}
const sources = git('ls-files', '--stage')
  .split('\n')
  .sort()
  .map((entry) => {
    const [, mode, object, file] = /^(\d+) ([a-f0-9]+) \d+\t(.+)$/.exec(entry);
    return mode === '160000'
      ? { file, mode, gitlink: object, includedInSupply: false }
      : {
          file,
          mode,
          sha256: createHash('sha256')
            .update(fs.readFileSync(path.join(source, file)))
            .digest('hex'),
        };
  });
if (fs.existsSync(staging))
  throw new Error('Refusing to overwrite RNL staging; select a new directory');
fs.mkdirSync(staging, { recursive: true });
const copy = (from, to) =>
  fs.cpSync(path.join(source, from), path.join(staging, to), {
    recursive: true,
    filter: (name) =>
      !/(^|[\\/])(node_modules|lib|build|\.git|__tests__|__mocks__|tests|fixtures)([\\/]|$)/.test(
        name,
      ),
  });
copy('tsconfig.base.json', 'tsconfig.base.json');
const patches = [];
for (const folder of manifest.packages) {
  const relative = `packages/@lucid-softworks/${folder}`;
  copy(relative, relative);
  const packageFile = path.join(staging, relative, 'package.json');
  const pkg = JSON.parse(fs.readFileSync(packageFile));
  pkg.scripts = Object.fromEntries(
    Object.entries(pkg.scripts ?? {}).filter(([name]) => !name.startsWith('test')),
  );
  for (const section of [
    'dependencies',
    'devDependencies',
    'peerDependencies',
    'optionalDependencies',
  ]) {
    for (const [name, value] of Object.entries(pkg[section] ?? {})) {
      if (value.startsWith('workspace:')) {
        if (value !== 'workspace:*') throw new Error(`Unreviewed workspace range: ${value}`);
        pkg[section][name] = '0.0.1';
        patches.push({
          package: pkg.name,
          field: `${section}.${name}`,
          before: value,
          after: '0.0.1',
        });
      }
    }
  }
  // The runtime must be buildable from its installed package, without a sibling checkout.
  if (folder === 'react-native-linux') {
    copy('vnext', `${relative}/vnext`);
    copy('scripts/codegen', `${relative}/scripts/codegen`);
    pkg.files.push('vnext/', 'scripts/codegen/');
    pkg.dependencies = {
      ...pkg.dependencies,
      '@lucid-softworks/react-native-linux-codegen': '0.0.1',
    };
    const core = path.join(staging, relative, 'Libraries/Core');
    fs.mkdirSync(core, { recursive: true });
    fs.copyFileSync(
      path.join(import.meta.dirname, '../upstream/overlays/react-native-linux/InitializeCore.js'),
      path.join(core, 'InitializeCore.js'),
    );
    fs.copyFileSync(
      path.join(import.meta.dirname, '../upstream/overlays/react-native-linux/metro.js'),
      path.join(staging, relative, 'metro.js'),
    );
    fs.copyFileSync(
      path.join(
        import.meta.dirname,
        '../upstream/overlays/react-native-linux/metro-babel-transformer.js',
      ),
      path.join(staging, relative, 'metro-babel-transformer.js'),
    );
    fs.copyFileSync(
      path.join(import.meta.dirname, '../upstream/overlays/react-native-linux/CoreRuntime.h'),
      path.join(staging, relative, 'vnext/src/jsi/CoreRuntime.h'),
    );
    for (const file of ['CoreWebSockets.h', 'CoreDevelopment.h', 'HttpBundleLoader.inc'])
      fs.copyFileSync(
        path.join(import.meta.dirname, '../upstream/overlays/react-native-linux', file),
        path.join(staging, relative, 'vnext/src/jsi', file),
      );
    fs.copyFileSync(
      path.join(import.meta.dirname, '../upstream/overlays/react-native-linux/MetroDevelopment.js'),
      path.join(core, 'MetroDevelopment.js'),
    );
    fs.copyFileSync(
      path.join(
        import.meta.dirname,
        '../upstream/overlays/react-native-linux/TextInputEditing.inc',
      ),
      path.join(staging, relative, 'vnext/src/views/TextInputEditing.inc'),
    );
    fs.copyFileSync(
      path.join(
        import.meta.dirname,
        '../upstream/overlays/react-native-linux/NativeFeatureFlags.inc',
      ),
      path.join(staging, relative, 'vnext/src/jsi/NativeFeatureFlags.inc'),
    );
    for (const [name, directory] of [
      ['BaseViewConfig.linux.js', 'Libraries/NativeComponent'],
      ['TextInput.linux.tsx', 'Libraries/Components/TextInput'],
      ['Image.linux.tsx', 'Libraries/Image'],
      ['ReactDevToolsSettingsManager.linux.js', 'src/private/devsupport/rndevtools'],
    ]) {
      const output = path.join(staging, relative, directory);
      fs.mkdirSync(output, { recursive: true });
      fs.copyFileSync(
        path.join(import.meta.dirname, '../upstream/overlays/react-native-linux', name),
        path.join(output, name),
      );
    }
    pkg.files.push(
      'metro.js',
      'metro-babel-transformer.js',
      'src/private/devsupport/rndevtools/ReactDevToolsSettingsManager.linux.js',
    );
    fs.copyFileSync(
      path.join(root, 'LICENSE.md'),
      path.join(staging, relative, 'LICENSE_NELYX.md'),
    );
    pkg.files.push('LICENSE_NELYX.md');
    patches.push({
      package: pkg.name,
      purpose: 'Real RN bootstrap and selective installed Linux overlay resolver',
      files: [
        'upstream/overlays/react-native-linux/InitializeCore.js',
        'upstream/overlays/react-native-linux/metro.js',
        'upstream/overlays/react-native-linux/metro-babel-transformer.js',
        'upstream/overlays/react-native-linux/CoreRuntime.h',
        'upstream/overlays/react-native-linux/BaseViewConfig.linux.js',
        'upstream/overlays/react-native-linux/TextInput.linux.tsx',
        'upstream/overlays/react-native-linux/Image.linux.tsx',
        'upstream/overlays/react-native-linux/NativeFeatureFlags.inc',
        'upstream/overlays/react-native-linux/TextInputEditing.inc',
        'upstream/overlays/react-native-linux/CoreWebSockets.h',
        'upstream/overlays/react-native-linux/CoreDevelopment.h',
        'upstream/overlays/react-native-linux/HttpBundleLoader.inc',
        'upstream/overlays/react-native-linux/MetroDevelopment.js',
        'upstream/overlays/react-native-linux/ReactDevToolsSettingsManager.linux.js',
      ].map((file) => ({
        file,
        sha256: createHash('sha256')
          .update(fs.readFileSync(path.join(root, file)))
          .digest('hex'),
      })),
    });
  }
  if (folder === 'cli') copy('template/linux', `${relative}/templates/linux`);
  copy('LICENSE', `${relative}/LICENSE`);
  pkg.files.push('LICENSE', 'UPSTREAM.json');
  fs.writeFileSync(packageFile, JSON.stringify(pkg, null, 2) + '\n');
  fs.writeFileSync(
    path.join(staging, relative, 'UPSTREAM.json'),
    JSON.stringify(
      {
        repository: manifest.repository,
        commit: manifest.commit,
        originalLicense: 'MIT',
        hermesCommit: manifest.hermesCommit,
        packagingPatches: manifest.patches,
        additionalLicense:
          folder === 'react-native-linux'
            ? 'BSD-3-Clause: Nelyx authored bootstrap, Metro resolver, core runtime and Linux view/input adapters; see LICENSE_NELYX.md'
            : null,
        nativeRuntime: 'source input; not a compiled or qualified binary',
      },
      null,
      2,
    ) + '\n',
  );
}
const patchFile = path.join(root, 'upstream/patches/react-native-linux-package-layout.patch');
execFileSync('git', ['apply', '--check', patchFile], { cwd: staging, stdio: 'pipe' });
execFileSync('git', ['apply', patchFile], { cwd: staging, stdio: 'pipe' });
patches.push({
  file: 'upstream/patches/react-native-linux-package-layout.patch',
  sha256: createHash('sha256').update(fs.readFileSync(patchFile)).digest('hex'),
  purpose: 'Resolve native codegen inputs from installed packages, without a source monorepo',
});
const runtimePatch = path.join(root, 'upstream/patches/react-native-linux-core-runtime.patch');
execFileSync('git', ['apply', '--check', runtimePatch], { cwd: staging, stdio: 'pipe' });
execFileSync('git', ['apply', runtimePatch], { cwd: staging, stdio: 'pipe' });
patches.push({
  file: 'upstream/patches/react-native-linux-core-runtime.patch',
  sha256: createHash('sha256').update(fs.readFileSync(runtimePatch)).digest('hex'),
  purpose: 'Install actual RN bridgeless core bindings and use a distinct AppRegistry key',
});
fs.writeFileSync(
  path.join(staging, 'package.json'),
  JSON.stringify(
    {
      name: 'nelyx-rnl-supply-build',
      version: '0.0.1',
      private: true,
      workspaces: manifest.packages.map((folder) => `packages/@lucid-softworks/${folder}`),
      devDependencies: { typescript: '5.9.3', '@react-native-community/cli-types': '20.0.0' },
    },
    null,
    2,
  ) + '\n',
);
fs.writeFileSync(
  path.join(staging, 'source-manifest.json'),
  JSON.stringify(
    {
      schema: 'nelyx.rnl-supply/v1',
      upstream: manifest,
      sources,
      patches,
      sourceTreeSha256: createHash('sha256').update(JSON.stringify(sources)).digest('hex'),
    },
    null,
    2,
  ) + '\n',
);
console.log(
  JSON.stringify({
    staging,
    upstreamCommit: manifest.commit,
    sourceFiles: sources.length,
    patches,
  }),
);
