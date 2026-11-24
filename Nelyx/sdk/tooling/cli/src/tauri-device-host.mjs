// SPDX-License-Identifier: BSD-3-Clause
import fs from 'node:fs';
import path from 'node:path';
import { localFile } from '@nelyx/tooling-contracts/node-files';
import { sourceFile } from './backend-project.mjs';

const mobile = ['android', 'iOS'];
const biometrics = ['android', 'iOS', 'macOS'];
const desktopLinkReceiver = ['windows', 'linux'];
const osNames = { android: 'android', iOS: 'ios', macOS: 'macos', windows: 'windows', linux: 'linux' };
const selectPlatform = (platforms) => 'any(' + platforms.map((name) => 'target_os = "' + osNames[name] + '"').join(', ') + ')';

export const devicePlugins = [
  { name: 'single-instance', version: '2.5.5', for: ['deepLinks'], platforms: desktopLinkReceiver,
    features: ['deep-link'], init: 'init(|_, _, _| {})', first: true },
  { name: 'geolocation', version: '2.5.0', for: ['location'], platforms: mobile },
  { name: 'notification', version: '2.8.1', for: ['notifications'] },
  { name: 'fs', version: '2.7.1', for: ['files'] },
  { name: 'dialog', version: '2.8.4', for: ['files'] },
  { name: 'opener', version: '2.7.3', for: ['openUrl'] },
  { name: 'deep-link', version: '2.6.3', for: ['deepLinks'] },
  { name: 'store', version: '2.5.1', for: ['store'], init: 'Builder::default().build()' },
  { name: 'barcode-scanner', version: '2.5.3', for: ['camera', 'barcode'], platforms: mobile },
  { name: 'nfc', version: '2.4.2', for: ['nfc'], platforms: mobile },
  { name: 'biometric', version: '2.5.0', for: ['biometrics'], platforms: biometrics },
];

const grant = (plugin, names) => names.map((name) => plugin + ':allow-' + name);
const barcodePermissions = grant('barcode-scanner', ['check-permissions', 'request-permissions']);

export const deviceCapabilities = {
  location: [{
    platforms: mobile,
    permissions: grant('geolocation', ['check-permissions', 'request-permissions', 'get-current-position', 'watch-position', 'clear-watch']),
  }],
  notifications: [{ permissions: grant('notification', ['is-permission-granted', 'request-permission', 'notify']) }],
  files: [
    { permissions: ['dialog:allow-open', 'fs:allow-read-file'] },
    { suffix: '-metadata', platforms: ['android'], permissions: ['nelyx-backend:allow-device-file-name'] },
  ],
  openUrl: [{ permissions: [{
    identifier: 'opener:allow-open-url',
    allow: [{ url: 'https://*' }, { url: 'http://*' }],
  }] }],
  deepLinks: [{ permissions: ['deep-link:allow-get-current', 'core:event:allow-listen', 'core:event:allow-unlisten'] }],
  store: [{ permissions: ['nelyx-backend:allow-device-store'] }],
  camera: [{ platforms: mobile, permissions: barcodePermissions }],
  barcode: [{ platforms: mobile, permissions: [...barcodePermissions, ...grant('barcode-scanner', ['scan', 'cancel'])] }],
  nfc: [{ platforms: mobile, permissions: grant('nfc', ['is-available', 'scan', 'write']) }],
  biometrics: [{ platforms: biometrics, permissions: grant('biometric', ['status', 'authenticate']) }],
};

export function configuredDevicePlugins(features, hapticsVersion) {
  const enabled = new Set(features.flatMap((window) => window.deviceServices ?? []));
  const plugins = devicePlugins.filter((plugin) => plugin.for.some((name) => enabled.has(name)));
  if (features.some((window) => window.haptics))
    plugins.push({ name: 'haptics', version: hapticsVersion, platforms: mobile });
  return plugins;
}

export function cargoPlugins(plugins) {
  const sections = new Map([['', []]]);
  for (const { name, version, features, platforms } of plugins) {
    const rustTarget = platforms ? selectPlatform(platforms) : '';
    const dependencies = sections.get(rustTarget) ?? [];
    const value = features
      ? '{ version = "=' + version + '", features = ' + JSON.stringify(features) + ' }'
      : '"=' + version + '"';
    dependencies.push('tauri-plugin-' + name + ' = ' + value);
    sections.set(rustTarget, dependencies);
  }
  return [...sections].map(([target, dependencies]) =>
    (target ? "\n[target.'cfg(" + target + ")'.dependencies]\n" : '') +
    (dependencies.length ? dependencies.join('\n') + '\n' : ''),
  ).join('');
}

export function registerDevicePlugins(plugins, first) {
  return plugins.filter((plugin) => !!plugin.first === first)
    .map(({ name, init = 'init()', platforms }) => {
      const attribute = platforms ? '    #[cfg(' + selectPlatform(platforms) + ')]\n' : '';
      return attribute + '    let builder = builder.plugin(tauri_plugin_' + name.replaceAll('-', '_') + '::' + init + ');\n';
    }).join('');
}

export function deepLinkPluginConfig(settings) {
  return {
    desktop: { schemes: settings.schemes },
    mobile: [
      ...settings.schemes.map((scheme) => ({ scheme: [scheme] })),
      ...(settings.domains ?? []).map(({ host, pathPrefix }) => ({
        scheme: ['https'],
        host,
        ...(pathPrefix ? { pathPrefix: [pathPrefix] } : {}),
      })),
    ],
  };
}

export const androidManifest = 'app/src/main/AndroidManifest.xml';

const linkMarker = '<!-- DEEP LINK PLUGIN. AUTO-GENERATED. DO NOT REMOVE. -->';
const androidLinkBlock = /^[ \t]*<!-- DEEP LINK PLUGIN\. AUTO-GENERATED\. DO NOT REMOVE\. -->\r?\n[\s\S]*?^[ \t]*<!-- DEEP LINK PLUGIN\. AUTO-GENERATED\. DO NOT REMOVE\. -->\r?\n/gm;

function androidLinkFilter({ scheme, host, pathPrefix }) {
  return [
    host ? '<intent-filter android:autoVerify="true">' : '<intent-filter>',
    '    <action android:name="android.intent.action.VIEW" />',
    '    <action android:name="org.chromium.arc.intent.action.VIEW" />',
    '    <category android:name="android.intent.category.DEFAULT" />',
    '    <category android:name="android.intent.category.BROWSABLE" />',
    ...scheme.map((value) => '    <data android:scheme="' + value + '" />'),
    ...(host ? ['    <data android:host="' + host + '" />'] : []),
    ...(pathPrefix ?? []).map((value) => '    <data android:pathPrefix="' + value + '" />'),
    '</intent-filter>',
  ];
}

export function writeDeviceAndroidLinks(project, links, overlay) {
  const current = overlay ?? fs.readFileSync(localFile(project, androidManifest), 'utf8');
  let manifest = current.replace(androidLinkBlock, '');
  if (links?.length) {
    const activityEnd = /^([ \t]*)<\/activity>/gm;
    if (!activityEnd.test(manifest))
      throw new Error('Could not add deep links to the Android manifest activity');
    // Tauri updates this block when its build script runs. It can also be reused from Cargo's cache.
    const filters = [linkMarker, ...links.flatMap(androidLinkFilter), linkMarker];
    const newline = manifest.includes('\r\n') ? '\r\n' : '\n';
    manifest = manifest.replace(activityEnd, (closing, indent) =>
      filters.map((line) => indent + '    ' + line + newline).join('') + closing,
    );
  }
  if (overlay !== undefined || manifest !== current) sourceFile(project, androidManifest, manifest);
}

const plistEscape = (value) => value.replace(/[&<>]/g, (character) =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[character],
);

export function writeDeviceIosInfo(directory, enabled, usage, platform) {
  const purposes = [
    ['location', enabled.has('location'), 'NSLocationWhenInUseUsageDescription'],
    ['camera', enabled.has('camera') || enabled.has('barcode'), 'NSCameraUsageDescription'],
    ['nfc', enabled.has('nfc'), 'NFCReaderUsageDescription'],
    ['biometrics', enabled.has('biometrics'), 'NSFaceIDUsageDescription'],
  ];
  const rows = [];
  for (const [feature, active, key] of purposes) {
    if (!active) continue;
    const purpose = usage?.[feature];
    if (!purpose && platform === 'ios')
      throw new Error('targets.tauri.deviceUsage.' + feature + ' is required for this iOS build');
    if (purpose) rows.push('  <key>' + key + '</key>\n  <string>' + plistEscape(purpose) + '</string>');
  }
  const name = 'Info.ios.plist';
  if (rows.length) {
    sourceFile(directory, name, [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "https://www.apple.com/DTDs/PropertyList-1.0.dtd">',
      '<plist version="1.0">', '<dict>', ...rows, '</dict>', '</plist>', '',
    ].join('\n'));
  } else if (fs.existsSync(path.join(directory, name))) {
    fs.unlinkSync(localFile(directory, name));
  }
}

export function writeDeviceIosEntitlements(directory, enabled) {
  const folder = fs.readdirSync(directory, { withFileTypes: true }).find((entry) =>
    entry.isDirectory() && entry.name.endsWith('_iOS') &&
    fs.existsSync(path.join(directory, entry.name, entry.name + '.entitlements')),
  );
  if (!folder) {
    if (enabled) throw new Error('Could not locate the iOS entitlements file for NFC');
    return;
  }
  const name = folder.name + '/' + folder.name + '.entitlements';
  const text = fs.readFileSync(localFile(directory, name), 'utf8');
  const owned = /[ \t]*<!-- Nelyx NFC begin -->[\s\S]*?<!-- Nelyx NFC end -->\r?\n?/g;
  let contents = text.replace(owned, '');
  if (enabled) {
    const key = '<key>com.apple.developer.nfc.readersession.formats</key>';
    const range = /(<key>com\.apple\.developer\.nfc\.readersession\.formats<\/key>\s*<array>)([\s\S]*?)(<\/array>)/;
    const entry = contents.match(range);
    const add = (lines) => '  <!-- Nelyx NFC begin -->\n' + lines + '  <!-- Nelyx NFC end -->\n';
    if (entry) {
      if (!entry[2].includes('<string>TAG</string>'))
        contents = contents.replace(range, (_, open, children, close) =>
          open + children.trimEnd() + '\n' + add('    <string>TAG</string>\n') + '  ' + close,
        );
    } else {
      if (contents.includes(key)) throw new Error('The iOS NFC entitlement must be an array');
      if (!contents.includes('</dict>')) contents = contents.replace(/<dict\s*\/>/, '<dict>\n</dict>');
      const end = contents.lastIndexOf('</dict>');
      if (end < 0) throw new Error('The iOS entitlements file needs an XML dictionary');
      contents = contents.slice(0, end) +
        add('  ' + key + '\n  <array>\n    <string>TAG</string>\n  </array>\n') + contents.slice(end);
    }
  }
  if (text !== contents) sourceFile(directory, name, contents);
}
