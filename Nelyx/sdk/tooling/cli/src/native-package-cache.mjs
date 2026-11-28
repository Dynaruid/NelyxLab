// SPDX-License-Identifier: BSD-3-Clause
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { localFile, sha256 } from '@nelyx/tooling-contracts/node-files';
import { fingerprint, hashTree } from './build-cache.mjs';
import { cargoBuildEnvironment } from './backend-project.mjs';
import { androidBuildTool, inspectApk, validateExecutable } from './tauri-artifacts.mjs';

const packageEnvironment =
  /^(?:GRADLE_OPTS|JAVA_TOOL_OPTIONS|_JAVA_OPTIONS|JDK_JAVA_OPTIONS|ANDROID_USER_HOME|ANDROID_SDK_HOME|TAURI_.*SIGN|RUSTC(?:_WORKSPACE_WRAPPER|_WRAPPER)?$)/i;
const transient = new Set([
  '.gradle',
  '.kotlin',
  '.idea',
  'build',
  'jniLibs',
  'tauri.settings.gradle',
  'tauri.properties',
]);

/** Reuse the stock unsigned NSIS package when the local bundler is identifiable. */
export function windowsPackageKey(app, tools, target, release, backend, cli, compiler, options) {
  if (
    fs.existsSync(path.join(app, 'platform', 'windows', 'tauri.conf.json')) ||
    Object.keys(process.env).some((name) =>
      /^(?:TAURI_(?:.*SIGN|CONFIG|BUNDLER|USE_LOCAL_TOOLS)|RUSTC(?:.*WRAPPER)?$|RUSTFLAGS$|CARGO_ENCODED_RUSTFLAGS$|CARGO_(?:BUILD|PROFILE|TARGET)_|CC$|CXX$|CL$|LINK$|LIB$|LIBPATH$)/i.test(
        name,
      ),
    )
  )
    return;
  const nsis = path.join(process.env.LOCALAPPDATA ?? '', 'tauri', 'NSIS');
  if (!path.isAbsolute(nsis) || !fs.existsSync(path.join(nsis, 'makensis.exe'))) return;
  const { msvc } = tools;
  try {
    const inputs = [
      cli.entry,
      msvc.compiler,
      path.join(path.dirname(msvc.compiler), 'link.exe'),
      path.join(msvc.sdk, 'Lib', msvc.sdkVersion, 'um/x64/kernel32.lib'),
      path.join(msvc.sdk, 'Lib', msvc.sdkVersion, 'ucrt/x64/ucrt.lib'),
      path.join(app, 'package-lock.json'),
    ];
    return fingerprint([
      target,
      release.buildId,
      backend,
      cli.version,
      compiler,
      tools,
      options,
      process.version,
      inputs.map(sha256),
      hashTree(nsis),
    ]);
  } catch {
    return;
  }
}

/** Custom Gradle scripts can have undeclared inputs. Cache stock debug builds only. */
export function debugPackageKey(
  app,
  project,
  tools,
  target,
  release,
  backend,
  cli,
  compiler,
  options,
) {
  if (Object.keys(process.env).some((name) => packageEnvironment.test(name))) return;
  if (fs.existsSync(path.join(app, 'platform', 'android', 'project'))) return;
  const gradleHome = process.env.GRADLE_USER_HOME ?? path.join(os.homedir(), '.gradle');
  const keystore = path.join(os.homedir(), '.android', 'debug.keystore');
  if (
    !fs.existsSync(keystore) ||
    ['init.gradle', 'init.gradle.kts', 'init.d'].some((name) =>
      fs.existsSync(path.join(gradleHome, name)),
    )
  )
    return;
  const files = [];
  function visit(directory) {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      if (transient.has(entry.name)) continue;
      const file = path.join(directory, entry.name);
      if (entry.isDirectory()) visit(file);
      else if (entry.isFile()) files.push([path.relative(project, file), sha256(file)]);
      else throw Error('Untracked Gradle project input');
    }
  }
  try {
    visit(project);
    const androidVersions = ['build-tools', 'platforms'].flatMap((folder) => {
      const root = path.join(tools.sdk, folder);
      return fs
        .readdirSync(root)
        .sort()
        .map((name) => {
          const file = path.join(root, name, 'source.properties');
          return [folder, name, fs.existsSync(file) ? sha256(file) : null];
        });
    });
    const settings = [
      keystore,
      path.join(tools.ndk, 'source.properties'),
      path.join(tools.java, 'release'),
      path.join(gradleHome, 'gradle.properties'),
      path.join(app, 'package-lock.json'),
      ...['aapt', 'apksigner'].map((name) => androidBuildTool(tools, name).at(-1)),
      ...[app, path.dirname(app), path.join(os.homedir(), '.cargo')].flatMap((folder) =>
        ['.cargo/config.toml', '.cargo/config', 'config.toml', 'config'].map((name) =>
          path.join(folder, name),
        ),
      ),
    ].filter((file) => fs.existsSync(file) && fs.statSync(file).isFile());
    return fingerprint([
      'fresh-debug-apk-output',
      target,
      release.buildId,
      backend,
      cli.version,
      compiler,
      tools,
      gradleHome,
      options,
      process.version,
      cargoBuildEnvironment(),
      files.sort(([a], [b]) => a.localeCompare(b)),
      settings.map((file) => [file, sha256(file)]),
      androidVersions,
    ]);
  } catch {
    return;
  }
}

export function verifyNativePackage(directory, key, release, target, identifier, tools) {
  if (!key) return;
  try {
    const metadata = JSON.parse(fs.readFileSync(localFile(directory, 'package.json'), 'utf8'));
    const android = target.platform === 'android';
    const formats = android ? ['apk'] : ['exe', 'nsis'];
    if (
      metadata.schema !== 'nelyx.tauri-package/v2' ||
      metadata.compilation?.reuseKey !== key ||
      metadata.frontendBuildId !== release.buildId ||
      metadata.os !== target.platform ||
      metadata.architecture !== target.architecture ||
      metadata.identifier !== identifier ||
      JSON.stringify(metadata.artifacts.map(({ format }) => format)) !== JSON.stringify(formats)
    )
      return;
    for (const artifact of metadata.artifacts) {
      if (artifact.signature !== (android ? 'signed' : 'unsigned')) return;
      const file = localFile(directory, artifact.file);
      if (fs.statSync(file).size !== artifact.bytes || sha256(file) !== artifact.sha256) return;
      if (android) inspectApk(file, tools, target.architecture, identifier);
      else if (artifact.format === 'exe') validateExecutable(file, target.platform);
    }
    return metadata;
  } catch {
    return;
  }
}
