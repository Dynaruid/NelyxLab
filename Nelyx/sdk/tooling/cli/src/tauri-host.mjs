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
import { foregroundCrate } from './native-skia-supply.mjs';
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
const windowsViewCommands = ['windows_platform_view', 'windows_platform_view_frame'];
const androidViewCommands = ['android_platform_view', 'android_platform_view_frame'];
const linuxViewCommands = ['linux_platform_view', 'linux_platform_view_frame'];
const appleViewCommands = ['apple_platform_view', 'apple_platform_view_frame'];
const applePlatforms = ['ios', 'macos'];
const androidPlatformViewsSource =
  'app/src/main/java/dev/nelyx/platformviews/PlatformViewsPlugin.kt';
const tauriDependencies = {
  build: '2.7.6',
  runtime: '2.12.7',
  clipboard: '2.5.0',
  haptics: '2.4.2',
  webview2: '0.39.1',
  windows: '0.62.2',
  gtk: '0.18.2',
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
        sha256(path.join(import.meta.dirname, 'native-skia-supply.mjs')),
      ],
      inputs,
      dependencies: tauriDependencies,
    }),
    watch: [...project.watch, folder, path.join(value.app, 'package.json')],
  };
}

function windowFeatures(value, base, platform) {
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
      windowsAcrylic = false,
      windowsRetainedViewport = false,
      windowsPlatformViews = [],
      androidPlatformViews = false,
      linuxPlatformViews = false,
      applePlatformViews = false,
      commands,
      ...window
    }) => {
      const acrylic = platform === 'windows' && windowsAcrylic;
      return {
        window: {
          ...base.app.windows[0],
          title: title + ' · Tauri',
          ...window,
          ...(acrylic ? { transparent: true } : {}),
          ...(platform === 'windows' && windowsRetainedViewport ? { create: false } : {}),
        },
        clipboard,
        haptics,
        androidBack,
        systemChrome,
        scrollEdgeEffects,
        deviceServices,
        safeArea: safeArea || (platform === 'android' && androidPlatformViews),
        windowTitle,
        windowsAcrylic: acrylic,
        windowsRetainedViewport,
        windowsPlatformViews,
        androidPlatformViews,
        linuxPlatformViews,
        applePlatformViews,
        commands,
      };
    },
  );
}

function cargoManifest({ app, version, name }, directory, project, features, plugins, platform) {
  const appCrate = project.appCrate;
  const clipboard = features.some(({ clipboard }) => clipboard?.read || clipboard?.write);
  const storeEnabled = plugins.some(({ name }) => name === 'store');
  const scopedJson = plugins.some(({ name }) => name === 'opener' || name === 'deep-link');
  const nativeViews = features.some(({ windowsPlatformViews }) => windowsPlatformViews.length);
  const androidViews = features.some(({ androidPlatformViews }) => androidPlatformViews);
  const linuxViews = features.some(({ linuxPlatformViews }) => linuxPlatformViews);
  const appleViews = features.some(({ applePlatformViews }) => applePlatformViews);
  const packageName = 'nelyx-' + name.replace(/^@/, '').replace(/[^a-zA-Z0-9_-]+/g, '-') + '-host';
  // IPA distribution compresses the bundle. Serve its installed assets directly to WKWebView.
  const runtimeVersion = JSON.stringify('=' + tauriDependencies.runtime);
  const runtime =
    platform === 'ios'
      ? `{ version = ${runtimeVersion}, default-features = false, features = ["wry", "dynamic-acl"] }`
      : runtimeVersion;
  // All platforms share the app's Tauri lockfile, including Windows-only dependencies.
  const retainedViewportDependencies = features.some(
    ({ windowsRetainedViewport }) => windowsRetainedViewport,
  )
    ? `[target.'cfg(windows)'.dependencies]
tauri = { version = ${runtimeVersion}, features = ["unstable"] }
webview2-com = "=${tauriDependencies.webview2}"
windows = { version = "=${tauriDependencies.windows}", features = ["Win32_Graphics_Dwm", "Win32_UI_Shell", "Win32_UI_WindowsAndMessaging"] }

`
    : '';
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
}${retainedViewportDependencies}${
    nativeViews
      ? `[target.'cfg(all(windows, target_arch = "x86_64"))'.dependencies]
nelyx-skia-foreground = ${cargoDependency(directory, foregroundCrate)}
serde = { version = "1", features = ["derive"] }
serde_json = "1"
windows = { version = "=${tauriDependencies.windows}", features = ["Win32_Graphics_Gdi", "Win32_UI_WindowsAndMessaging"] }

`
      : ''
  }${
    androidViews
      ? `[target.'cfg(target_os = "android")'.dependencies]
nelyx-skia-foreground = ${cargoDependency(directory, foregroundCrate)}
jni = "=0.21.1"
serde_json = "1"

`
      : ''
  }${
    linuxViews
      ? `[target.'cfg(target_os = "linux")'.dependencies]
gtk = "=${tauriDependencies.gtk}"
nelyx-skia-foreground = ${cargoDependency(directory, foregroundCrate)}
serde = { version = "1", features = ["derive"] }
serde_json = "1"

`
      : ''
  }${
    appleViews
      ? `[target.'cfg(any(target_os = "macos", target_os = "ios"))'.dependencies]
nelyx-skia-foreground = ${cargoDependency(directory, foregroundCrate)}
objc2 = "=0.6.5"
objc2-core-foundation = { version = "=0.3.2", default-features = false, features = ["std", "CFCGTypes"] }
objc2-foundation = { version = "=0.3.2", default-features = false, features = [
  "std", "NSArray", "NSDictionary", "NSNotification", "NSObject", "NSOperation", "NSRange",
  "NSSet", "NSString", "NSValue",
] }
objc2-quartz-core = { version = "=0.3.2", default-features = false, features = [
  "std", "CALayer", "CAMetalLayer",
] }
serde = { version = "1", features = ["derive"] }
serde_json = "1"

[target.'cfg(target_os = "macos")'.dependencies]
objc2-app-kit = { version = "=0.3.2", default-features = false, features = [
  "std", "NSEvent", "NSGraphics", "NSResponder", "NSScrollView", "NSText", "NSTextContainer",
  "NSTextInputClient", "NSTextView", "NSTrackingArea", "NSView", "NSWindow",
  "objc2-core-foundation", "objc2-quartz-core",
] }

[target.'cfg(target_os = "ios")'.dependencies]
block2 = "=0.6.2"
objc2-foundation = { version = "=0.3.2", default-features = false, features = ["block2"] }
objc2-ui-kit = { version = "=0.3.2", default-features = false, features = [
  "std", "UIAccessibility", "UIColor", "UICommand", "UIEvent", "UIFont", "UIGeometry",
  "UIInterface", "UIKeyCommand", "UIResponder", "UIScreen", "UIScrollView", "UITextInput", "UITextInputTraits",
  "UITextView", "UITouch", "UIView", "UIWindow", "objc2-core-foundation", "objc2-quartz-core",
] }

`
      : ''
  }[features]
custom-protocol = ["tauri/custom-protocol"]
`;
}

function nativeSource(project, features, frontendBuildId, plugins, platform) {
  const { identity, appCrate } = project;
  const clipboard = features.some(({ clipboard }) => clipboard?.read || clipboard?.write);
  const nativeViews =
    platform === 'windows'
      ? features.filter(({ windowsPlatformViews }) => windowsPlatformViews.length)
      : [];
  const nativeViewGrants = nativeViews
    .map(
      ({ window, windowsPlatformViews }) =>
        `    (${JSON.stringify(window.label)}, &${JSON.stringify(windowsPlatformViews)}),`,
    )
    .join('\n');
  const androidViews =
    platform === 'android'
      ? features
          .filter(({ androidPlatformViews }) => androidPlatformViews)
          .map(({ window }) => window.label)
      : [];
  const linuxViews =
    platform === 'linux'
      ? features
          .filter(({ linuxPlatformViews }) => linuxPlatformViews)
          .map(({ window }) => window.label)
      : [];
  const appleViews = applePlatforms.includes(platform)
    ? features
        .filter(({ applePlatformViews }) => applePlatformViews)
        .map(({ window }) => window.label)
    : [];
  const retainedWindows =
    platform === 'windows'
      ? features
          .filter(({ windowsRetainedViewport }) => windowsRetainedViewport)
          .map(({ window }) => window.label)
      : [];
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
        windowsAcrylic,
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
        windows_acrylic: ${windowsAcrylic},
        commands: ${commands ? 'Some(&' + JSON.stringify(commands) + ')' : 'None'},
    },`,
    )
    .join('');
  return `// Generated by Nelyx.
use nelyx_backend_core::{BackendKind, Identity};
use tauri_plugin_nelyx_backend::{ScrollEdgeEffect, ScrollEdgeEffects, WindowFeatures};
${retainedWindows.length ? '\n#[cfg(windows)]\nmod windows_viewport;\n' : ''}
${
  nativeViews.length
    ? '#[cfg(all(windows, target_arch = "x86_64"))]\nmod desktop_platform_view_wire;'
    : linuxViews.length
      ? '#[cfg(target_os = "linux")]\nmod desktop_platform_view_wire;'
      : appleViews.length
        ? '#[cfg(any(target_os = "macos", target_os = "ios"))]\nmod desktop_platform_view_wire;'
        : ''
}
${
  nativeViews.length
    ? `#[cfg(all(windows, target_arch = "x86_64"))]
mod windows_platform_views;
#[cfg(all(windows, target_arch = "x86_64"))]
const WINDOWS_PLATFORM_VIEWS: &[(&str, &[&str])] = &[
${nativeViewGrants}
];`
    : ''
}
${
  androidViews.length
    ? `#[cfg(target_os = "android")]
mod android_platform_views;
#[cfg(target_os = "android")]
const ANDROID_PLATFORM_VIEWS: &[&str] = &${JSON.stringify(androidViews)};`
    : ''
}
${
  linuxViews.length
    ? `#[cfg(target_os = "linux")]
mod linux_platform_views;
#[cfg(target_os = "linux")]
const LINUX_PLATFORM_VIEWS: &[&str] = &${JSON.stringify(linuxViews)};`
    : ''
}
${
  appleViews.length
    ? `#[cfg(any(target_os = "macos", target_os = "ios"))]
mod apple_platform_views;
#[cfg(any(target_os = "macos", target_os = "ios"))]
const APPLE_PLATFORM_VIEWS: &[&str] = &${JSON.stringify(appleViews)};`
    : ''
}
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
${registerDevicePlugins(plugins, false)}${
    retainedWindows.length
      ? `    #[cfg(windows)]
    let builder = builder.setup(|app| {
${
  nativeViews.length
    ? `        #[cfg(target_arch = "x86_64")]
        let native_layout = Some(windows_viewport::NativeViewResize {
            layout: windows_platform_views::layout_retained_views,
            can_align: windows_platform_views::can_align_retained_views,
        });
        #[cfg(not(target_arch = "x86_64"))]
        let native_layout = None;
`
    : '        let native_layout = None;\n'
}
        windows_viewport::create(app, &${JSON.stringify(retainedWindows)}, native_layout)
    });
`
      : ''
  }${
    nativeViews.length
      ? `    #[cfg(all(windows, target_arch = "x86_64"))]
    let builder = windows_platform_views::register(builder);
`
      : ''
  }${
    androidViews.length
      ? `    #[cfg(target_os = "android")]
    let builder = android_platform_views::register(builder);
`
      : ''
  }${
    linuxViews.length
      ? `    #[cfg(target_os = "linux")]
    let builder = linux_platform_views::register(builder);
`
      : ''
  }${
    appleViews.length
      ? `    #[cfg(any(target_os = "macos", target_os = "ios"))]
    let builder = apple_platform_views::register(builder);
`
      : ''
  }    builder.run(tauri::tauri_build_context!())
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
  const features = windowFeatures(value, base, platform);
  const windowsViews =
    platform === 'windows' &&
    features.some(({ windowsPlatformViews }) => windowsPlatformViews.length);
  const androidViews =
    platform === 'android' && features.some(({ androidPlatformViews }) => androidPlatformViews);
  const linuxViews =
    platform === 'linux' && features.some(({ linuxPlatformViews }) => linuxPlatformViews);
  const appleViews =
    applePlatforms.includes(platform) &&
    features.some(({ applePlatformViews }) => applePlatformViews);
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
    windowsAcrylic,
    windowsPlatformViews,
    androidPlatformViews,
    linuxPlatformViews,
    applePlatformViews,
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
    if (windowsAcrylic) capability('window-acrylic', [plugin + 'set-window-acrylic'], ['windows']);
    if (platform === 'windows' && windowsPlatformViews.length)
      capability(
        'native-platform-views',
        windowsViewCommands.map((command) => 'allow-' + command.replaceAll('_', '-')),
        ['windows'],
      );
    if (platform === 'android' && androidPlatformViews)
      capability(
        'native-platform-views',
        [
          ...androidViewCommands.map((command) => 'allow-' + command.replaceAll('_', '-')),
          'core:event:allow-listen',
          'core:event:allow-unlisten',
        ],
        ['android'],
      );
    if (platform === 'linux' && linuxPlatformViews)
      capability(
        'native-platform-views',
        linuxViewCommands.map((command) => 'allow-' + command.replaceAll('_', '-')),
        ['linux'],
      );
    if (applePlatforms.includes(platform) && applePlatformViews)
      capability(
        'native-platform-views',
        appleViewCommands.map((command) => 'allow-' + command.replaceAll('_', '-')),
        [platform === 'ios' ? 'iOS' : 'macOS'],
      );
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
  for (const file of [
    'src/main.rs',
    'src/windows_viewport.rs',
    'src/windows_viewport.js',
    'run-tauri.mjs',
    ...(windowsViews || linuxViews || appleViews ? ['src/desktop_platform_view_wire.rs'] : []),
    ...(windowsViews ? ['src/windows_platform_views.rs', 'windows-platform-views.manifest'] : []),
    ...(androidViews ? ['src/android_platform_views.rs'] : []),
    ...(linuxViews ? ['src/linux_platform_views.rs'] : []),
    ...(appleViews
      ? ['src/apple_platform_views.rs', `src/apple_platform_views_${platform}.rs`]
      : []),
  ])
    sourceFile(directory, file, fs.readFileSync(localFile(template, file)));
  const build = fs.readFileSync(localFile(template, 'build.rs'), 'utf8');
  const viewCommands =
    {
      windows: windowsViews && windowsViewCommands,
      android: androidViews && androidViewCommands,
      linux: linuxViews && linuxViewCommands,
      ios: appleViews && appleViewCommands,
      macos: appleViews && appleViewCommands,
    }[platform] || [];
  const windowManifest = windowsViews
    ? '.windows_attributes(tauri_build::WindowsAttributes::new().app_manifest(include_str!("windows-platform-views.manifest")))'
    : '';
  const commandManifest = viewCommands.length
    ? `.app_manifest(tauri_build::AppManifest::new().commands(&${JSON.stringify(viewCommands)}))`
    : '';
  sourceFile(
    directory,
    'build.rs',
    build.replace('Attributes::new()', 'Attributes::new()' + windowManifest + commandManifest),
  );
  sourceFile(
    directory,
    'Cargo.toml',
    cargoManifest(value, directory, project, features, plugins, platform),
  );
  sourceFile(
    directory,
    'src/lib.rs',
    nativeSource(project, features, frontendBuildId, plugins, platform),
  );
  writeDeviceIosInfo(directory, deviceServices, tauri.deviceUsage, platform);
  return {
    directory,
    windowsPlatformViews: windowsViews,
    androidPlatformViews: androidViews,
    linuxPlatformViews: linuxViews,
    applePlatformViews: appleViews,
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
  if (platform === 'android' && host.androidPlatformViews)
    overlays.set(
      androidPlatformViewsSource,
      fs.readFileSync(localFile(template, 'android/PlatformViewsPlugin.kt')),
    );
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
