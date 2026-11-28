// SPDX-License-Identifier: BSD-3-Clause
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { chromium } from 'playwright';
import { capture, execute } from '../sdk/tooling/cli/src/commands.mjs';
import { androidDeviceArchitecture } from '../sdk/tooling/cli/src/tauri-platforms.mjs';
import { clickCanvasControl } from './fixtures/testbed-platform-views.mjs';

if (!process.argv.includes('--child')) {
  await execute(process.execPath, [import.meta.filename, ...process.argv.slice(2), '--child']);
  process.exit(0);
}
const [device = 'emulator-5554'] = process.argv.slice(2).filter((arg) => !arg.startsWith('--'));
const lifecycle = process.argv.includes('--lifecycle');
const architecture = androidDeviceArchitecture('adb', device);
const abi = architecture === 'arm64' ? 'arm64-v8a' : 'x86_64';
const rustTarget = architecture === 'arm64' ? 'aarch64-linux-android' : 'x86_64-linux-android';
const built = path.resolve(`sample/nelyx-testbed-app-3/.nelyx/tauri/android-${architecture}-debug`);
const release = JSON.parse(readFileSync(path.join(built, 'package.json'), 'utf8'));
const supply = JSON.parse(
  readFileSync(
    new URL('../sdk/tooling/cli/templates/tauri/skia-foreground/supply.json', import.meta.url),
    'utf8',
  ),
);
const artifact = release.artifacts.find(({ format }) => format === 'apk');
assert(artifact && release.architecture === architecture && artifact.abi === abi);
assert.equal(release.rustTarget, rustTarget);
assert(supply.targets[rustTarget], `Missing Skia supply for ${rustTarget}`);
const app = artifact.packageName;
const adb = (args, timeout = 12_000) => capture('adb', ['-s', device, ...args], { timeout }).trim();
await execute('adb', ['-s', device, 'install', '-r', path.join(built, artifact.file)]);
const activity = adb(['shell', 'cmd', 'package', 'resolve-activity', '--brief', app])
  .split(/\r?\n/)
  .at(-1);
assert(activity?.startsWith(app + '/'));
adb(['shell', 'am', 'force-stop', app]);
assert.match(adb(['shell', 'am', 'start', '-W', '-n', activity]), /Status: ok/);
const pid = adb(['shell', 'pidof', app]);
assert(/^\d+$/.test(pid));
for (let attempt = 0; attempt < 30; attempt++) {
  if (adb(['shell', 'cat', '/proc/net/unix']).includes('@webview_devtools_remote_' + pid)) break;
  await delay(100);
}
const port = adb(['forward', 'tcp:0', 'localabstract:webview_devtools_remote_' + pid]);
assert(/^\d+$/.test(port));
const dumpPath = '/sdcard/.nelyx-w9-' + randomUUID() + '.xml';
let browser;
let keyboardOpen = false;

function editor() {
  adb(['shell', 'uiautomator', 'dump', dumpPath]);
  const xml = adb(['shell', 'cat', dumpPath]);
  return [...xml.matchAll(/<node\s[^>]*>/g)]
    .map(([tag]) =>
      Object.fromEntries(
        [...tag.matchAll(/([\w-]+)="([^"]*)"/g)].map(([, key, value]) => [key, value]),
      ),
    )
    .find((node) => node.package === app && node.class === 'android.widget.EditText');
}

async function expectResumed(expected) {
  for (let attempt = 0; attempt < 8; attempt++) {
    const resumed = adb(['shell', 'dumpsys', 'activity', 'activities'])
      .split(/\r?\n/)
      .find((line) => line.includes('topResumedActivity='));
    if (Boolean(resumed?.includes(app + '/')) === expected) return;
    await delay(200);
  }
  assert.fail('Android Testbed did not reach the expected Activity state');
}

async function expectKeyboard(expected) {
  for (let attempt = 0; attempt < 12; attempt++) {
    const shown = /\bmInputShown=true\b/.test(adb(['shell', 'dumpsys', 'input_method']));
    if (shown === expected) return;
    await delay(200);
  }
  assert.fail(`Android input method did not become ${expected ? 'visible' : 'hidden'}`);
}

function colorAt(page, x, y) {
  const capture = spawnSync('adb', ['-s', device, 'exec-out', 'screencap', '-p'], {
    timeout: 10_000,
    maxBuffer: 16 * 1024 * 1024,
  });
  assert.equal(capture.status, 0);
  return page.evaluate(
    async ({ encoded, x, y }) => {
      const png = Uint8Array.from(atob(encoded), (char) => char.charCodeAt(0));
      const bitmap = await createImageBitmap(new Blob([png], { type: 'image/png' }));
      try {
        const canvas = new OffscreenCanvas(1, 1);
        const ctx = canvas.getContext('2d');
        ctx.drawImage(bitmap, -x, -y);
        return [...ctx.getImageData(0, 0, 1, 1).data].slice(0, 3);
      } finally {
        bitmap.close();
      }
    },
    { encoded: capture.stdout.toString('base64'), x, y },
  );
}

try {
  const endpoint = 'http://127.0.0.1:' + port;
  let hasPage = false;
  for (let attempt = 0; attempt < 24; attempt++) {
    const response = await fetch(endpoint + '/json/list', {
      signal: AbortSignal.timeout(1000),
    }).catch(() => null);
    if (response?.ok && (await response.json()).some(({ type }) => type === 'page')) {
      hasPage = true;
      break;
    }
    await delay(200);
  }
  assert(hasPage, 'Android WebView CDP did not publish an app page');
  browser = await chromium.connectOverCDP(endpoint, { noDefaults: true });
  const context = browser.contexts()[0];
  assert(context, 'Android WebView CDP did not create a browser context');
  const page = context.pages()[0] ?? (await context.waitForEvent('page', { timeout: 20_000 }));
  page.setDefaultTimeout(20_000);
  await page.locator('canvas[data-nelyx-frame-ready]').first().waitFor();
  await page.addInitScript(() => {
    window.nelyxTestbedMetricsProbe = (read) => {
      window.readNelyxTestbedMetrics = read;
    };
  });
  const url = new URL(page.url());
  url.searchParams.set('androidPlatformView', '1');
  url.searchParams.set('renderMode', 'direct');
  await page.goto(url.href);
  await page.locator('[aria-label*="Composited Android editor"]').first().waitFor();
  const {
    installed,
    probe,
    scale,
    path: renderPath,
  } = await page.evaluate(async () => ({
    installed: await window.__TAURI__.core.invoke('plugin:nelyx-backend|describe'),
    probe: await window.__TAURI__.core.invoke('android_platform_view', {
      request: { action: 'probe' },
    }),
    scale: devicePixelRatio,
    path: document.querySelector('canvas[data-nelyx-frame-ready]')?.dataset.nelyxRenderPath,
  }));
  assert.equal(installed.frontendBuildId, release.frontendBuildId);
  assert.equal(probe.skia.skiaRevision, supply.skiaRevision);
  assert.deepEqual(probe.skia.targets[rustTarget], supply.targets[rustTarget]);
  assert.equal(renderPath, 'direct');
  await page.waitForFunction(() => {
    const environment = window.readNelyxTestbedMetrics?.().environment;
    return environment?.keyboardSource === 'native-ime' && environment.keyboardInset === 0;
  });
  const nativeViewMarker = page.locator('div[role="group"][aria-label=""][aria-hidden="true"]');
  await nativeViewMarker.waitFor({ state: 'attached' });
  assert.equal(await nativeViewMarker.getAttribute('tabindex'), null);
  assert.equal(await nativeViewMarker.getAttribute('aria-owns'), null);
  let control;
  for (let attempt = 0; attempt < 4 && !control; attempt++) control = editor();
  if (!control) {
    const labels = await page
      .locator('[aria-label]')
      .evaluateAll((nodes) => nodes.map((node) => node.getAttribute('aria-label')));
    assert.fail('Android EditText not visible: ' + JSON.stringify(labels));
  }
  const [left, top, right, bottom] = control.bounds.match(/\d+/g).map(Number);
  assert(right > left && bottom > top);
  const x = right - Math.round(105 * scale);
  const y = top + Math.round(81 * scale);
  const tint = await colorAt(page, x, y);
  const tap = (x, y) => adb(['shell', 'input', 'tap', String(x), String(y)]);
  tap(right - Math.round(46 * scale), top + Math.round(46 * scale));
  await page.locator('[aria-label*="Nelyx clicks: 1"]').first().waitFor();
  tap(x, y);
  keyboardOpen = true;
  await expectKeyboard(true);
  await page.waitForFunction(() => window.readNelyxTestbedMetrics().environment.keyboardInset > 24);
  const keyboardInset = await page.evaluate(
    () => window.readNelyxTestbedMetrics().environment.keyboardInset,
  );
  adb(['shell', 'input', 'text', '987654']);
  const focused = editor();
  assert.equal(focused?.focused, 'true');
  assert.match(focused.text, /987654/);
  adb(['shell', 'input', 'keyevent', 'KEYCODE_BACK']);
  await expectKeyboard(false);
  keyboardOpen = false;
  await page.waitForFunction(
    () => window.readNelyxTestbedMetrics().environment.keyboardInset === 0,
  );
  await clickCanvasControl(page, page.getByRole('button', { name: 'Hide overlay' }));
  await page.getByRole('button', { name: 'Show overlay' }).waitFor();
  await page.waitForFunction(() => document.querySelectorAll('canvas').length === 1);
  let untinted;
  for (let attempt = 0; attempt < 5; attempt++) {
    untinted = await colorAt(page, x, y);
    if (untinted.some((value, index) => value !== tint[index])) break;
    await delay(160);
  }
  assert.notDeepEqual(untinted, tint, 'Android Skia card did not affect displayed pixels');
  tap(x, y);
  keyboardOpen = true;
  await expectKeyboard(true);
  await page
    .getByRole('button', { name: 'Open composited views modal' })
    .evaluate((button) => button.click());
  await expectKeyboard(false);
  keyboardOpen = false;
  assert.equal(editor(), undefined);
  await page.waitForFunction(
    () => window.readNelyxTestbedMetrics().environment.keyboardInset === 0,
  );
  const closeModal = page
    .getByRole('alertdialog', { name: 'Composited views modal' })
    .getByRole('button', { name: 'Close modal' });
  await clickCanvasControl(page, closeModal);
  assert.match(editor()?.text ?? '', /987654/);
  if (lifecycle) {
    const automatic = adb(['shell', 'settings', 'get', 'system', 'accelerometer_rotation']);
    const originalRotation = adb(['shell', 'settings', 'get', 'system', 'user_rotation']);
    try {
      adb(['shell', 'cmd', 'window', 'user-rotation', 'lock', '1']);
      await page.waitForFunction(() => innerWidth > innerHeight);
      assert.match(editor()?.text ?? '', /987654/);
      adb(['shell', 'input', 'keyevent', 'KEYCODE_HOME']);
      await expectResumed(false);
      adb(['shell', 'am', 'start', '-W', '-n', activity]);
      await expectResumed(true);
      assert.match(editor()?.text ?? '', /987654/);
    } finally {
      adb(['shell', 'am', 'start', '-W', '-n', activity]);
      adb(['shell', 'cmd', 'window', 'user-rotation', 'lock', originalRotation]);
      if (automatic === '1') adb(['shell', 'cmd', 'window', 'user-rotation', 'free']);
    }
  }
  url.searchParams.delete('androidPlatformView');
  await page.goto(url.href);
  await page.locator('canvas[data-nelyx-frame-ready]').first().waitFor();
  assert.equal(editor(), undefined);
  await page.evaluate(async () => {
    const owner = { id: 'testbed-retiring-owner', generation: 1 };
    const command = (request) =>
      window.__TAURI__.core.invoke('android_platform_view', { request: { owner, ...request } });
    await command({ action: 'open' });
    const create = {
      action: 'create',
      instanceId: 1,
      viewType: 'nelyx.android.edit',
      text: 'retired',
    };
    const [creating, closing] = await Promise.allSettled([
      command(create),
      command({ action: 'close' }),
    ]);
    if (closing.status === 'rejected') throw closing.reason;
    if (creating.status === 'rejected' && !/Stale native view owner/.test(String(creating.reason)))
      throw creating.reason;
    await command(create).then(
      () => {
        throw new Error('The retired owner accepted another control');
      },
      (error) => {
        if (!/Stale native view owner/.test(String(error))) throw error;
      },
    );
  });
  assert.equal(editor(), undefined);
  console.log(
    JSON.stringify({
      architecture,
      abi,
      frontendBuildId: release.frontendBuildId,
      skiaRevision: probe.skia.skiaRevision,
      renderPath,
      platformView: control.class,
      androidTouch: true,
      overlayPixel: tint,
      basePixel: untinted,
      keyboardInset,
      modalDismissedKeyboard: true,
      lifecycle,
      restoredText: true,
      retiredOwner: true,
    }),
  );
} finally {
  await browser?.close().catch(() => {});
  if (keyboardOpen && /\bmInputShown=true\b/.test(adb(['shell', 'dumpsys', 'input_method'])))
    adb(['shell', 'input', 'keyevent', 'KEYCODE_BACK']);
  adb(['shell', 'rm', '-f', dumpPath]);
  adb(['forward', '--remove', 'tcp:' + port]);
}
