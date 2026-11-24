// SPDX-License-Identifier: BSD-3-Clause
import assert from 'node:assert/strict';
import { setImmediate } from 'node:timers/promises';
import {
  DeviceOrientation,
  SystemChrome,
  SystemUiMode,
  SystemUiOverlay,
  SystemUiOverlayStyle,
} from '@nelyx/core/services/system-chrome';
import { openTauriBackend } from '@nelyx/sdk/backends/tauri';
import {
  bindFrontendBackend,
  webViewScrollEdgeEffectsFor,
} from '@nelyx/sdk/frontend/dom/environment';
import { defineConfig } from '@nelyx/sdk/runtime/config';
import { PlatformMessageConnection } from '@nelyx/sdk/runtime/platform-messages';
import { hapticRequest } from '../sdk/dist/backends/browser/haptics.js';
import { installOsServices } from '../sdk/dist/runtime/os-services.js';
import { PluginPlatformMessagePort } from '../sdk/dist/runtime/plugin-port.js';
import { execute } from '../sdk/tooling/cli/src/commands.mjs';

if (!process.argv.includes('--child')) {
  await execute(process.execPath, [import.meta.filename, '--child'], { timeout: 1_200_000 });
  process.exit(0);
}

const identity = {
  kind: 'native',
  backendVersion: '0.1.0',
  protocolVersion: 3,
  sourceId: 'device-test',
};
const ipc = [];
const callbacks = new Map();
let callbackId = 0;
let backListener;
let historyBacks = 0;
let defaultBacks = 0;
let webReads = 0;
let webRead;
let clipText = '';
let readError;
let nativeClipboard = null;
let nativeOs = 'windows';
let nativeHaptics = null;
let nativeBack = null;
let nativeChrome = false;
let chromeReply;
const hiddenEdges = { top: 'hidden', right: 'hidden', bottom: 'hidden', left: 'hidden' };
let nativeEdges = hiddenEdges;
const window = (globalThis.window = {
  closed: false,
  isSecureContext: true,
  history: { back: () => historyBacks++ },
  navigator: {
    platform: 'Win32',
    userAgent: 'Windows',
    clipboard: {
      async readText() {
        webReads++;
        return webRead ?? clipText;
      },
      async writeText(text) {
        clipText = text;
      },
    },
    permissions: {
      async query() {
        return Object.assign(new EventTarget(), { state: 'granted' });
      },
    },
  },
  __TAURI_INTERNALS__: {
    transformCallback(callback) {
      callbacks.set(++callbackId, callback);
      return callbackId;
    },
    unregisterCallback(id) {
      callbacks.delete(id);
    },
    async invoke(command, options) {
      ipc.push({ command, options });
      switch (command) {
        case 'plugin:nelyx-backend|describe':
          return {
            ...identity,
            os: nativeOs,
            clipboard: nativeClipboard,
            haptics: nativeHaptics,
            androidBack: nativeBack,
            systemChrome: nativeChrome,
            deviceServices: [],
            safeArea: false,
            windowTitle: false,
            title: null,
            frontendBuildId: null,
          };
        case 'plugin:nelyx-backend|clipboard_policy': {
          const { host, readApi, writeApi, readPermission } = options.input;
          return {
            read: readApi,
            write: writeApi,
            preflight: !readApi
              ? 'unsupported'
              : ['browser', 'native-desktop'].includes(host) && readPermission === 'granted'
                ? 'read'
                : 'permission-required',
          };
        }
        case 'plugin:clipboard-manager|read_text':
          if (readError) throw readError;
          return clipText;
        case 'plugin:clipboard-manager|write_text':
          clipText = options.text;
          return;
        case 'plugin:app|register_listener':
          assert.equal(backListener, undefined);
          assert.equal(options.event, 'back-button');
          backListener = { id: options.handler.id, index: 0 };
          return;
        case 'plugin:app|remove_listener':
          assert.equal(backListener?.id, options.channelId);
          backListener = undefined;
          return;
        case 'plugin:nelyx-backend|dispatch_default_back':
          assert.equal(backListener, undefined);
          defaultBacks++;
          return;
        case 'plugin:nelyx-backend|system_chrome':
          return chromeReply;
        case 'plugin:nelyx-backend|scroll_edge_effects':
          if (options.effects) nativeEdges = { ...hiddenEdges, ...options.effects };
          return nativeEdges;
      }
    },
  },
});

const root = new URL('https://tauri.localhost/');
const lifetime = new AbortController();
const open = () => openTauriBackend(root, identity, false, lifetime.signal);
const code = (expected) => (error) => error.code === expected;

for (const grants of [
  null,
  { read: true, write: false },
  { read: false, write: true },
  { read: false, write: false },
]) {
  nativeClipboard = grants;
  const binding = (await open()).clipboard(window);
  try {
    if (!grants || grants.write) await binding.writeText('한글 👋');
    else await assert.rejects(binding.writeText('disabled'), code('unsupported'));
    if (!grants || grants.read) assert.equal(await binding.readText(), '한글 👋');
    else await assert.rejects(binding.readText(), code('unsupported'));
  } finally {
    binding.dispose();
  }
}
assert.equal(webReads, 1);

nativeClipboard = { read: true, write: true };
let backend = await open();
const clipboard = backend.clipboard(window);
try {
  readError = 'Clipboard is empty';
  assert.equal(await clipboard.readText(), '');
  assert.equal(await clipboard.hasStrings(), false);
  readError = 'clipboard-manager.read_text not allowed. Permissions associated with this command';
  await assert.rejects(clipboard.readText(), code('permission-denied'));
  assert.equal(webReads, 1);
} finally {
  clipboard.dispose();
}

nativeClipboard = null;
const retiring = (await open()).clipboard(window);
let completeRead;
webRead = new Promise((resolve) => {
  completeRead = resolve;
});
const pendingRead = retiring.readText();
retiring.dispose();
await assert.rejects(pendingRead, code('disposed'));
completeRead('outdated');

nativeClipboard = { read: true, write: true };
nativeOs = 'android';
nativeHaptics = true;
nativeBack = true;
backend = await open();
const mobileClipboard = backend.clipboard(window);
try {
  const before = ipc.filter(
    ({ command }) => command === 'plugin:clipboard-manager|read_text',
  ).length;
  await assert.rejects(mobileClipboard.hasStrings(), code('permission-required'));
  assert.equal(
    ipc.filter(({ command }) => command === 'plugin:clipboard-manager|read_text').length,
    before,
  );
} finally {
  mobileClipboard.dispose();
}
const actions = [
  null,
  'lightImpact',
  'mediumImpact',
  'heavyImpact',
  'selectionClick',
  'successNotification',
  'warningNotification',
  'errorNotification',
];
for (const action of actions)
  await backend.haptics(window)(hapticRequest(action && 'HapticFeedbackType.' + action));
assert.deepEqual(
  ipc.filter(({ command }) => command.startsWith('plugin:haptics|')),
  [
    { command: 'plugin:haptics|vibrate', options: { duration: 50 } },
    ...['light', 'medium', 'heavy'].map((style) => ({
      command: 'plugin:haptics|impact_feedback',
      options: { style },
    })),
    { command: 'plugin:haptics|selection_feedback', options: {} },
    ...['success', 'warning', 'error'].map((type) => ({
      command: 'plugin:haptics|notification_feedback',
      options: { type },
    })),
  ],
);

const back = backend.androidBack(window);
const count = (command) => ipc.filter((entry) => entry.command === 'plugin:' + command).length;
const sendBack = (canGoBack) =>
  callbacks.get(backListener.id)({ index: backListener.index++, message: { canGoBack } });
let handled = 0;
const handle = async () => {
  handled++;
  return true;
};
const bubble = async () => false;
await back.setHandler(handle, true);
await back.setHandler(bubble, true);
assert.equal(count('app|register_listener'), 1);
sendBack(true);
await setImmediate();
assert.equal(historyBacks, 1);
assert.equal(defaultBacks, 0);
sendBack(false);
await setImmediate();
assert.equal(defaultBacks, 1);
assert.equal(count('app|register_listener'), 2);
assert.equal(callbacks.size, 1);
await back.setHandler(bubble, false);
sendBack(false);
await setImmediate();
assert.equal(handled, 1);
assert.equal(defaultBacks, 1);
let finish;
const pending = () =>
  new Promise((resolve) => {
    finish = resolve;
  });
await back.setHandler(pending, true);
sendBack(false);
await setImmediate();
await back.setHandler(pending, false);
finish(false);
await back.setHandler(handle, false);
await setImmediate();
assert.equal(defaultBacks, 1);
assert.equal(backListener, undefined);
assert.equal(callbacks.size, 0);

assert.equal(backend.systemChrome?.(window), undefined);
assert.equal(backend.scrollEdgeEffects, undefined);
nativeOs = 'ios';
nativeBack = null;
nativeChrome = true;
const ios = await open();
const chrome = ios.systemChrome(window);
assert.equal(ios.systemChrome({}), undefined);
const port = new PluginPlatformMessagePort();
installOsServices(port, { systemChrome: chrome });
const connection = new PlatformMessageConnection(port);
connection.attach();
const { binaryMessenger } = connection;
await assert.rejects(
  SystemChrome.setEnabledSystemUIMode(SystemUiMode.manual, undefined, binaryMessenger),
  /requires overlays/,
);
const nextChromeReply = Promise.withResolvers();
chromeReply = nextChromeReply.promise;
const start = ipc.length;
const style = SystemChrome.setSystemUIOverlayStyle(SystemUiOverlayStyle.light, binaryMessenger);
const failed = assert.rejects(style, code('platform-error'));
const remaining = Promise.all([
  SystemChrome.setPreferredOrientations([DeviceOrientation.landscapeLeft], binaryMessenger),
  SystemChrome.setEnabledSystemUIMode(
    SystemUiMode.manual,
    { overlays: [SystemUiOverlay.bottom] },
    binaryMessenger,
  ),
  SystemChrome.restoreSystemUIOverlays(binaryMessenger),
  SystemChrome.setEnabledSystemUIMode(SystemUiMode.edgeToEdge, undefined, binaryMessenger),
]);
await setImmediate();
const updates = () =>
  ipc.slice(start).map(({ command, options }) => {
    assert.equal(command, 'plugin:nelyx-backend|system_chrome');
    return options.request;
  });
assert.equal(updates().length, 1);
assert.equal(updates()[0].arguments.statusBarBrightness, 'Brightness.dark');
chromeReply = undefined;
nextChromeReply.reject(new Error('Simulated native failure'));
await Promise.all([failed, remaining]);
assert.deepEqual(updates().slice(1), [
  {
    method: 'SystemChrome.setPreferredOrientations',
    arguments: ['DeviceOrientation.landscapeLeft'],
  },
  { method: 'SystemChrome.setEnabledSystemUIOverlays', arguments: ['SystemUiOverlay.bottom'] },
  { method: 'SystemChrome.restoreSystemUIOverlays', arguments: null },
  { method: 'SystemChrome.setEnabledSystemUIMode', arguments: 'SystemUiMode.edgeToEdge' },
]);
await connection.dispose();

const unbind = bindFrontendBackend(window, ios);
const edges = webViewScrollEdgeEffectsFor(window);
assert.equal(webViewScrollEdgeEffectsFor({ opener: window }), undefined);
assert.deepEqual(await edges.get(), hiddenEdges);
const top = edges.set({ top: 'soft' });
const bottom = edges.set({ bottom: 'hard' });
assert.deepEqual(await top, { ...hiddenEdges, top: 'soft' });
assert.deepEqual(await bottom, { ...hiddenEdges, bottom: 'hard' });
assert.deepEqual(await edges.get(), { ...hiddenEdges, bottom: 'hard' });
assert.deepEqual(await edges.set({}), hiddenEdges);
unbind();
assert.equal(webViewScrollEdgeEffectsFor(window), undefined);

const configWithEffects = (scrollEdgeEffects) =>
  defineConfig({
    schema: 'nelyx.app/v4',
    name: 'EdgeEffects',
    appEntry: './src/index.ts',
    targets: {
      tauri: {
        identifier: 'dev.nelyx.edges',
        windows: [{ label: 'main', scrollEdgeEffects }],
      },
    },
  }).targets.tauri.windows[0].scrollEdgeEffects;
const settings = { top: 'automatic', right: 'hard', bottom: 'soft', left: 'hidden' };
assert.equal(configWithEffects(undefined), undefined);
assert.deepEqual(configWithEffects(settings), settings);
assert.ok(Object.isFrozen(configWithEffects(settings)));
for (const invalid of [true, null, [], { center: 'soft' }, { top: 'blur' }])
  assert.throws(() => configWithEffects(invalid), /Invalid or duplicate Tauri window declaration/);

lifetime.abort();
await assert.rejects(
  openTauriBackend(root, { ...identity, protocolVersion: 2 }, false, new AbortController().signal),
  /protocolVersion: expected 3/,
);
console.log('Window device grants, haptics, Android back, SystemChrome and WebView edges verified');
