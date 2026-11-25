// SPDX-License-Identifier: BSD-3-Clause
import fs from 'node:fs';
import path from 'node:path';
import {
  backendHash,
  backendInventory,
  rustInputFiles,
} from '@nelyx/tooling-contracts/backend-supply';
import { localFile, relativeFile, sha256 } from '@nelyx/tooling-contracts/node-files';
import { readJson } from '@nelyx/vite/runner';
import { crossOriginIsolationHeaders } from '@nelyx/vite/frontend-session';
import { cargoDependency, cratePath, inspectBackend, sourceFile } from './backend-project.mjs';
import { ensureDirectory, ownedDirectory } from './publication.mjs';
import { writeBuildState } from './build-cache.mjs';
import { platforms } from './tauri-platforms.mjs';
import {
  androidManifest,
  cargoPlugins,
  configuredDevicePlugins,
  deepLinkPluginConfig,
  deviceCapabilities,
  registerDevicePlugins,
  writeDeviceAndroidLinks,
  writeDeviceIosInfo,
  writeDeviceIosEntitlements,
} from './tauri-device-host.mjs';

const template = path.resolve(import.meta.dirname, '../templates/tauri');
export const hostPath = (app) => path.join(app, '.nelyx', 'tauri', 'host');
export const tauriFrontend = (app) => path.join(app, '.nelyx', 'tauri', 'frontend');
export const mobileDirectory = (host, platform) =>
  path.join(host.directory, 'gen', platform === 'ios' ? 'apple' : platform);
const plugin = 'nelyx-backend:allow-';
const basePermissions = [plugin + 'describe', plugin + 'clipboard-policy'];
const tauriDependencies = {
  build: '2.7.6',
  runtime: '2.12.7',
  clipboard: '2.5.0',
  haptics: '2.4.2',
};
const hapticsPermissions = [
  'haptics:allow-vibrate',
  'haptics:allow-impact-feedback',
  'haptics:allow-selection-feedback',
  'haptics:allow-notification-feedback',
];
const backPermissions = [
  'core:app:allow-register-listener',
  'core:app:allow-remove-listener',
  plugin + 'dispatch-default-back',
];
const allowedPlatformKeys = new Set(['bundle', 'app']);

export function inspectTauriBackend(value, options) {
  const project = inspectBackend(value, 'tauri', options);
  const folder = path.join(value.app, 'platform');
  const inputs = fs.existsSync(folder)
    ? rustInputFiles(folder).map((file) => [
        path.relative(folder, file).replaceAll('\\', '/'),
        sha256(file),
      ])
    : [];
  return {
    ...project,
    hostInputs: backendHash({
      tauri: value.config.targets.tauri,
      crossOriginIsolated: value.config.crossOriginIsolated,
      template: backendInventory(template),
      generator: [
        sha256(import.meta.filename),
        sha256(path.join(import.meta.dirname, 'tauri-device-host.mjs')),
      ],
      inputs,
      dependencies: tauriDependencies,
    }),
    watch: [...project.watch, folder, path.join(value.app, 'package.json')],
  };
}

function windowFeatures(value, base) {
  const title = value.config.displayName ?? value.config.name;
  return (value.config.targets.tauri.windows ?? [{ label: 'main', safeArea: true }]).map(
    ({
      clipboard,
      haptics,
      androidBack,
      systemChrome = false,
      scrollEdgeEffects = {},
      deviceServices = [],
      safeArea = false,
      windowTitle = true,
      commands,
      ...window
    }) => ({
      window: { ...base.app.windows[0], title: title + ' · Tauri', ...window },
      clipboard,
      haptics,
      androidBack,
      systemChrome,
      scrollEdgeEffects,
      deviceServices,
      safeArea,
      windowTitle,
      commands,
    }),
  );
}

function cargoManifest({ app, version, name }, directory, project, features, plugins, platform) {
  const appCrate = project.appCrate;
  const clipboard = features.some(({ clipboard }) => clipboard?.read || clipboard?.write);
  const storeEnabled = plugins.some(({ name }) => name === 'store');
  const scopedJson = plugins.some(({ name }) => name === 'opener' || name === 'deep-link');
  const packageName = 'nelyx-' + name.replace(/^@/, '').replace(/[^a-zA-Z0-9_-]+/g, '-') + '-host';
  // IPA distribution compresses the bundle. Serve its installed assets directly to WKWebView.
  const runtimeVersion = JSON.stringify('=' + tauriDependencies.runtime);
  const runtime =
    platform === 'ios'
      ? `{ version = ${runtimeVersion}, default-features = false, features = ["wry", "dynamic-acl"] }`
      : runtimeVersion;
  return `[package]
name = ${JSON.stringify(packageName)}
version = ${JSON.stringify(version)}
edition = "2021"
publish = false

[workspace]

[lib]
name = "nelyx_tauri_runtime"
crate-type = ["staticlib", "cdylib", "rlib"]

[build-dependencies]
tauri-build = { version = "=${tauriDependencies.build}", features = ["codegen"] }

[dependencies]
tauri = ${runtime}
${scopedJson ? 'serde_json = "1"\n' : ''}nelyx-backend-core = ${cargoDependency(directory, cratePath(app, 'backend-rust'))}
tauri-plugin-nelyx-backend = ${cargoDependency(directory, cratePath(app, 'backend-tauri'), undefined, storeEnabled ? ['device-store'] : [])}
${appCrate ? 'app_backend = ' + cargoDependency(directory, appCrate.directory, appCrate.name) + '\n' : ''}${clipboard ? 'tauri-plugin-clipboard-manager = "=' + tauriDependencies.clipboard + '"\n' : ''}${cargoPlugins(plugins)}
${
  platform === 'ios'
    ? `[target.'cfg(not(target_os = "ios"))'.dependencies]
tauri = ${runtimeVersion}

`
    : ''
}[features]
custom-protocol = ["tauri/custom-protocol"]
`;
}

function nativeSource(project, features, frontendBuildId, plugins) {
  const { identity, appCrate } = project;
  const clipboard = features.some(({ clipboard }) => clipboard?.read || clipboard?.write);
  const optional = (value) => (value === undefined ? 'None' : 'Some(' + value + ')');
  const edgeEffect = {
    hidden: 'Hidden',
    automatic: 'Automatic',
    soft: 'Soft',
    hard: 'Hard',
  };
  const windows = features
    .map(
      ({
        window,
        clipboard,
        haptics,
        androidBack,
        systemChrome,
        scrollEdgeEffects,
        deviceServices,
        safeArea,
        windowTitle,
        commands,
      }) => `
    WindowFeatures {
        label: ${JSON.stringify(window.label)},
        clipboard: ${clipboard ? `Some(nelyx_backend_core::ClipboardGrants { read: ${clipboard.read}, write: ${clipboard.write} })` : 'None'},
        haptics: ${optional(haptics)},
        android_back: ${optional(androidBack)},
        system_chrome: ${systemChrome},
        scroll_edge_effects: ScrollEdgeEffects {
            ${['top', 'right', 'bottom', 'left']
              .map(
                (edge) =>
                  edge + ': ScrollEdgeEffect::' + edgeEffect[scrollEdgeEffects[edge] ?? 'hidden'],
              )
              .join(',\n            ')},
        },
        device_services: &${JSON.stringify(deviceServices)},
        safe_area: ${safeArea},
        window_title: ${windowTitle},
        commands: ${commands ? 'Some(&' + JSON.stringify(commands) + ')' : 'None'},
    },`,
    )
    .join('');
  return `// Generated by Nelyx.
use nelyx_backend_core::{BackendKind, Identity};
use tauri_plugin_nelyx_backend::{ScrollEdgeEffect, ScrollEdgeEffects, WindowFeatures};

const WINDOWS: &[WindowFeatures] = &[${windows}
];

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let builder = tauri::Builder::default();
${registerDevicePlugins(plugins, true)}    let builder = builder.plugin(tauri_plugin_nelyx_backend::init(
            Identity {
                backend_version: ${JSON.stringify(identity.backendVersion)},
                source_id: ${JSON.stringify(identity.sourceId)},
                kind: BackendKind::Native,
            },
            ${appCrate ? 'app_backend::register' : '|_| {}'},
            WINDOWS,
            ${frontendBuildId ? 'Some(' + JSON.stringify(frontendBuildId) + ')' : 'None'},
        ))
${clipboard ? '        .plugin(tauri_plugin_clipboard_manager::init())' : ''};
${registerDevicePlugins(plugins, false)}    builder.run(tauri::tauri_build_context!())
        .expect("could not run Nelyx Tauri");
}
`;
}

function writeJson(directory, file, value) {
  return sourceFile(directory, file, JSON.stringify(value, null, 2) + '\n');
}

function iconFiles(app, directory, native) {
  const folder = path.join(app, 'platform', 'icons');
  for (const file of native.bundle.icon) {
    const custom = path.join(app, 'platform', file);
    const original = localFile(template, file);
    const bytes = fs.existsSync(custom)
      ? fs.readFileSync(localFile(folder, path.basename(file)))
      : fs.readFileSync(original);
    sourceFile(directory, file, bytes);
  }
}

function platformConfig(app, directory, platform) {
  const name = 'tauri.' + platform + '.conf.json';
  const override = path.join('platform', platform, 'tauri.conf.json').replaceAll('\\', '/');
  if (!fs.existsSync(path.join(app, override))) {
    const file = path.join(directory, name);
    if (fs.existsSync(file)) fs.unlinkSync(localFile(directory, name));
    return {};
  }
  const custom = readJson(localFile(app, override));
  if (
    Object.keys(custom).some((key) => !allowedPlatformKeys.has(key)) ||
    Object.keys(custom.app ?? {}).some((key) => key !== 'security') ||
    Object.keys(custom.app?.security ?? {}).some((key) => key !== 'csp' && key !== 'devCsp')
  )
    throw new Error(override + ' accepts bundle settings and app.security.csp/devCsp');
  writeJson(directory, name, custom);
  return custom;
}

export function generateTauriHost(value, project, platform, frontendBuildId) {
  const { app, config, version } = value;
  const directory = ensureDirectory(hostPath(app));
  const base = readJson(localFile(template, 'tauri.conf.json'));
  const tauri = config.targets.tauri;
  const display = config.displayName ?? config.name;
  const features = windowFeatures(value, base);
  const plugins = configuredDevicePlugins(features, tauriDependencies.haptics);
  const deviceServices = new Set(features.flatMap((window) => window.deviceServices));
  const capabilities = [];
  for (const {
    window,
    clipboard,
    haptics,
    androidBack,
    systemChrome,
    deviceServices: windowDevices,
    safeArea,
    windowTitle,
    commands,
  } of features) {
    function capability(feature, permissions, platforms) {
      const identifier = 'nelyx-' + feature + '-' + window.label;
      writeJson(directory, 'capabilities/' + identifier + '.json', {
        identifier,
        webviews: [window.label],
        ...(platforms ? { platforms } : {}),
        permissions,
      });
      capabilities.push(identifier);
    }
    capability('window', [
      ...basePermissions,
      ...(commands?.length === 0 ? [] : [plugin + 'invoke']),
      ...(windowTitle ? ['core:window:allow-set-title'] : []),
      ...(clipboard?.read ? ['clipboard-manager:allow-read-text'] : []),
      ...(clipboard?.write ? ['clipboard-manager:allow-write-text'] : []),
    ]);
    if (safeArea)
      capability(
        'safe-area',
        [plugin + 'watch-safe-area', plugin + 'unwatch-safe-area'],
        ['android'],
      );
    if (haptics) capability('haptics', hapticsPermissions, ['android', 'iOS']);
    if (androidBack) capability('android-back', backPermissions, ['android']);
    if (systemChrome) capability('system-chrome', [plugin + 'system-chrome'], ['android', 'iOS']);
    capability('scroll-edge-effects', [plugin + 'scroll-edge-effects'], ['iOS']);
    for (const device of windowDevices) {
      const label = device.replace(/[A-Z]/g, (character) => '-' + character.toLowerCase());
      for (const { suffix = '', permissions, platforms } of deviceCapabilities[device] ?? [])
        capability('device-' + label + suffix, permissions, platforms);
    }
  }
  for (const entry of fs.readdirSync(path.join(directory, 'capabilities'))) {
    if (!capabilities.includes(entry.replace(/\.json$/, '')))
      fs.unlinkSync(localFile(directory, 'capabilities/' + entry));
  }
  const deviceLinks = deviceServices.has('deepLinks')
    ? deepLinkPluginConfig(tauri.deepLinks)
    : undefined;
  const native = {
    ...base,
    productName: tauri.productName ?? (display.replace(/[<>:"/\\|?*]/g, ' ').trim() || config.name),
    identifier: tauri.identifier,
    version,
    ...(deviceLinks ? { plugins: { ...base.plugins, 'deep-link': deviceLinks } } : {}),
    app: {
      ...base.app,
      windows: features.map(({ window }) => window),
      security: {
        ...base.app.security,
        capabilities,
        ...(config.crossOriginIsolated
          ? { headers: { ...base.app.security.headers, ...crossOriginIsolationHeaders } }
          : {}),
      },
    },
  };
  writeJson(directory, 'tauri.conf.json', native);
  let custom;
  for (const os of platforms) {
    const result = platformConfig(app, directory, os);
    if (os === platform) custom = result;
  }
  iconFiles(app, directory, native);
  for (const file of ['build.rs', 'src/main.rs', 'run-tauri.mjs'])
    sourceFile(directory, file, fs.readFileSync(localFile(template, file)));
  sourceFile(
    directory,
    'Cargo.toml',
    cargoManifest(value, directory, project, features, plugins, platform),
  );
  sourceFile(directory, 'src/lib.rs', nativeSource(project, features, frontendBuildId, plugins));
  writeDeviceIosInfo(directory, deviceServices, tauri.deviceUsage, platform);
  return {
    directory,
    deviceServices,
    androidLinks: deviceLinks?.mobile,
    identifier: native.identifier,
    productName: native.productName,
    build: native.build,
    security: { ...native.app.security, ...custom?.app?.security },
  };
}

/** Apply app-owned inputs after Tauri initializes the project. */
export function applyMobileInputs(app, host, platform, marker, desired, previous = {}) {
  const project = mobileDirectory(host, platform);
  const source = path.join(app, 'platform', platform, 'project');
  const overlays = new Map();
  let androidOverlay;
  if (fs.existsSync(source)) {
    ownedDirectory(source);
    for (const file of rustInputFiles(source)) {
      const name = relativeFile(path.relative(source, file).replaceAll('\\', '/'));
      overlays.set(name, fs.readFileSync(file));
    }
  }
  const originals = new Map(Object.entries(previous.originals ?? {}));
  for (const name of overlays.keys()) {
    if (originals.has(name)) continue;
    const generated = path.join(project, name);
    originals.set(
      name,
      fs.existsSync(generated)
        ? fs.readFileSync(localFile(project, name)).toString('base64')
        : null,
    );
  }
  // Record the original contents before touching the generated files. A later
  // invocation can finish any application or deletion that was interrupted.
  writeBuildState(marker, { ...desired, originals: Object.fromEntries(originals) });
  for (const [name, original] of originals) {
    relativeFile(name);
    const bytes = overlays.get(name);
    if (platform === 'android' && name === androidManifest && bytes)
      androidOverlay = bytes.toString('utf8');
    else if (bytes) sourceFile(project, name, bytes);
    else if (original !== null) sourceFile(project, name, Buffer.from(original, 'base64'));
    else if (fs.existsSync(path.join(project, name))) fs.unlinkSync(localFile(project, name));
    if (!bytes) originals.delete(name);
  }
  if (platform === 'android') writeDeviceAndroidLinks(project, host.androidLinks, androidOverlay);
  if (platform === 'ios') writeDeviceIosEntitlements(project, host.deviceServices.has('nfc'));
  writeBuildState(marker, { ...desired, originals: Object.fromEntries(originals) });
}

export function mobileInputsId(app, platform) {
  const source = path.join(app, 'platform', platform);
  return backendHash(
    fs.existsSync(source)
      ? rustInputFiles(source).map((file) => [
          path.relative(source, file).replaceAll('\\', '/'),
          sha256(file),
        ])
      : [],
  );
}

export function configureMobileCallback(host, platform) {
  const project = mobileDirectory(host, platform);
  if (platform === 'android') {
    const task = rustInputFiles(path.join(project, 'buildSrc')).find(
      (file) => path.basename(file) === 'BuildTask.kt',
    );
    if (!task) throw new Error('Tauri Android Gradle callback is missing');
    const previous = fs.readFileSync(task, 'utf8');
    const updated = previous
      .replace('"""npx"""', '"""node"""')
      .replace(
        'listOf("tauri", "android", "android-studio-script")',
        'listOf("run-tauri.mjs", "android", "android-studio-script")',
      );
    if (!updated.includes('"""node"""') || !updated.includes('"run-tauri.mjs"'))
      throw new Error('Tauri Android Gradle callback differs from the pinned template');
    sourceFile(path.dirname(task), path.basename(task), updated);
    return;
  }
  const xcode = fs.readdirSync(project).find((name) => name.endsWith('.xcodeproj'));
  const callbacks = [
    ['project.yml', 'node "$SRCROOT/../../run-tauri.mjs" ios xcode-script'],
    [xcode + '/project.pbxproj', 'node \\"$SRCROOT/../../run-tauri.mjs\\" ios xcode-script'],
  ];
  for (const [file, script] of callbacks) {
    const updated = fs
      .readFileSync(localFile(project, file), 'utf8')
      .replaceAll('npx tauri ios xcode-script', script);
    if (!updated.includes(script))
      throw new Error('Tauri Xcode callback differs from the pinned template: ' + file);
    sourceFile(project, file, updated);
  }
}
