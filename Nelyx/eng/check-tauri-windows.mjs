// SPDX-License-Identifier: BSD-3-Clause
import assert from 'node:assert/strict';
import fs from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { once } from 'node:events';
import { setTimeout as delay } from 'node:timers/promises';
import { chromium } from 'playwright';
import { capture, execute, startOwnedCommand } from '../sdk/tooling/cli/src/commands.mjs';
import { publishDirectory, removeDirectory } from '../sdk/tooling/cli/src/publication.mjs';

async function removeProfile(directory) {
  for (let attempt = 0; ; attempt++) {
    try {
      removeDirectory(directory, path.dirname(directory));
      return;
    } catch (error) {
      if (attempt >= 10 || !['EBUSY', 'EPERM', 'ENOTEMPTY'].includes(error.code)) throw error;
      await delay(500);
    }
  }
}

assert.equal(process.platform, 'win32');
const args = process.argv.slice(2).filter((argument) => argument !== '--child');
if (!process.argv.includes('--child')) {
  await execute(process.execPath, [import.meta.filename, ...args, '--child'], {
    timeout: 1_200_000,
  });
  process.exit(0);
}
const [appDirectory, backendExample = '21'] = args.filter((argument) => argument !== '--native-picker');
assert(appDirectory, 'Pass the app directory');
const app = path.resolve(appDirectory);
const release = JSON.parse(
  fs.readFileSync(path.join(app, '.nelyx/tauri/frontend/build.json'), 'utf8'),
);
const config = JSON.parse(fs.readFileSync(path.join(app, 'package.json'), 'utf8'));
const windows = config.nelyx.targets.tauri.windows ?? [{ label: 'main' }];
const pkg = path.join(app, '.nelyx/tauri/windows-x64');
const packaged = JSON.parse(fs.readFileSync(path.join(pkg, 'package.json'), 'utf8'));
assert.equal(packaged.frontendBuildId, release.buildId);
assert.equal(release.target, 'tauri');
assert.deepEqual(packaged.backend, release.backend);
const representative = release.files.find(
  ({ path }) => path.startsWith('assets/') && path.endsWith('.ttf'),
)?.path;
const files = [release.entry, 'runtime/canvaskit.js', 'runtime/canvaskit.wasm'];
if (representative) files.push(representative);
const expected = files.map((file) => release.files.find(({ path }) => path === file)?.sha256);
assert(expected.every(Boolean), 'Missing expected Tauri frontend file');

const reservation = net.createServer().listen(0, '127.0.0.1');
await once(reservation, 'listening');
const { port } = reservation.address();
await new Promise((resolve) => reservation.close(resolve));
const endpoint = `http://127.0.0.1:${port}`;
const scheme = config.nelyx.targets.tauri.deepLinks?.schemes[0];
const initialLink = scheme ? scheme + '://startup-verification' : null;
const activeLink = scheme ? scheme + '://running-verification' : null;
const signal = AbortSignal.timeout(1_200_000);
const stage = fs.mkdtempSync(path.join(os.tmpdir(), 'nelyx-tauri-webview-'));
let child, browser;
try {
  const name = packaged.artifacts.find(({ format }) => format === 'exe')?.file;
  assert(name, 'Windows EXE is missing');
  const current = path.join(stage, 'current');
  const candidate = path.join(stage, 'candidate');
  fs.mkdirSync(current);
  fs.mkdirSync(candidate);
  const file = path.join(current, name);
  fs.copyFileSync(path.join(pkg, name), file);
  const environment = {
    ...process.env,
    WEBVIEW2_USER_DATA_FOLDER: path.join(stage, 'profile'),
    WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS: `--remote-debugging-port=${port} --proxy-server=http://127.0.0.1:9 --proxy-bypass-list=<-loopback>`,
  };
  child = startOwnedCommand(file, initialLink ? [initialLink] : [], {
    cwd: stage,
    signal,
    isolateWindows: true,
    windowsHide: false,
    env: environment,
  });
  for (let attempt = 0; attempt < 30; attempt++) {
    const list = await fetch(endpoint + '/json/list', {
      signal: AbortSignal.any([signal, AbortSignal.timeout(1000)]),
    }).catch(() => null);
    if (
      list?.ok &&
      (await list.json()).some(({ url }) => url.startsWith('https://tauri.localhost/'))
    ) {
      browser = await chromium.connectOverCDP(endpoint, { timeout: 25_000 });
      break;
    }
    await delay(600, undefined, { signal });
  }
  assert(browser, 'The isolated WebView2 page did not open');
  const pages = new Map();
  for (let attempt = 0; attempt < 30 && pages.size < windows.length; attempt++) {
    for (const candidate of browser.contexts()[0].pages()) {
      if (!candidate.url().startsWith('https://tauri.localhost/')) continue;
      const label = await candidate
        .evaluate(() => window.__TAURI_INTERNALS__?.metadata?.currentWebview?.label)
        .catch(() => undefined);
      if (label) pages.set(label, candidate);
    }
    if (pages.size < windows.length) await delay(300, undefined, { signal });
  }
  const page = pages.get(windows[0].label);
  assert(page, 'The built-in protocol page is missing');
  await page.waitForFunction(
    () =>
      document.body.dataset.error ||
      (document.documentElement.dataset.tauriOs === 'windows' &&
        Boolean(document.querySelector('canvas')?.getContext('webgl2'))),
    undefined,
    { timeout: 45_000 },
  );
  assert.equal(await page.locator('body').getAttribute('data-error'), null);
  await verifyDevicePermissions(page, windows[0].deviceServices ?? [], stage, initialLink);
  if (activeLink) await verifyRunningLink(page, file, activeLink, { cwd: stage, env: environment, signal });
  if (args.includes('--native-picker')) {
    assert.ok(windows[0].deviceServices?.includes('files'));
    await verifyNativePicker(page, stage, child.pid);
  }
  const actual = await page.evaluate(
    async ({ files, clipEnabled }) => {
      async function read(file) {
        const response = await fetch(new URL(file, document.baseURI), { cache: 'no-store' });
        if (!response.ok) throw new Error(file + ' HTTP ' + response.status);
        return response;
      }
      const { buildId } = await (await read('build.json')).json();
      const core = window.__TAURI__.core;
      const backend = await core.invoke('plugin:nelyx-backend|describe');
      const example = await core
        .invoke('plugin:nelyx-backend|invoke', {
          command: 'app.example',
          input: 10,
        })
        .catch(({ code }) => ({ code }));
      const policy = await core.invoke('plugin:nelyx-backend|clipboard_policy', {
        input: {
          host: 'native-mobile',
          readApi: true,
          writeApi: true,
          readPermission: 'granted',
          writePermission: 'granted',
        },
      });
      const clipboard = async () => {
        try {
          return await core.invoke('plugin:clipboard-manager|read_text');
        } catch (error) {
          if (/clipboard is empty|clipboard contents were not available/i.test(String(error)))
            return '';
          throw error;
        }
      };
      let clipboardCheck;
      if (clipEnabled) {
        const saved = await clipboard();
        const text = 'Nelyx 클립보드 확인';
        try {
          await core.invoke('plugin:clipboard-manager|write_text', { text });
          clipboardCheck = (await clipboard()) === text;
        } finally {
          await core.invoke('plugin:clipboard-manager|write_text', { text: saved });
        }
      } else {
        clipboardCheck = await clipboard().then(
          () => false,
          (error) => /permission|not allowed|not found|forbidden/i.test(String(error)),
        );
      }
      const sha256 = await Promise.all(
        files.map(async (file) => {
          const data = await (await read(file)).arrayBuffer();
          const digest = await crypto.subtle.digest('SHA-256', data);
          return Array.from(new Uint8Array(digest), (byte) =>
            byte.toString(16).padStart(2, '0'),
          ).join('');
        }),
      );
      return {
        buildId,
        backend,
        example,
        preflight: policy.preflight,
        clipboardCheck,
        sha256,
        workers: (await navigator.serviceWorker?.getRegistrations())?.length ?? 0,
        wasmRequests: performance
          .getEntriesByType('resource')
          .filter(({ name }) => name.includes('/runtime/backend/')).length,
      };
    },
    { files, clipEnabled: !!windows[0].clipboard?.write && !!windows[0].clipboard?.read },
  );
  assert.equal(actual.buildId, release.buildId);
  assert.deepEqual(actual.sha256, expected);
  assert.equal(actual.workers, 0);
  assert.equal(actual.wasmRequests, 0);
  for (const key of ['kind', 'backendVersion', 'protocolVersion', 'sourceId'])
    assert.equal(actual.backend[key], release.backend[key]);
  assert.equal(actual.backend.frontendBuildId, release.buildId);
  if (release.backend.appManifest) assert.equal(actual.example, Number(backendExample));
  else assert.deepEqual(actual.example, { code: 'unknown-command' });
  assert.deepEqual(actual.backend.clipboard, windows[0].clipboard ?? null);
  assert.equal(actual.backend.haptics, windows[0].haptics === undefined ? null : false);
  assert.equal(actual.backend.androidBack, windows[0].androidBack === undefined ? null : false);
  assert.equal(actual.preflight, 'permission-required');
  assert.equal(actual.clipboardCheck, true);
  if (actual.backend.windowTitle) {
    const title = capture('powershell.exe', [
      '-NoProfile',
      '-NonInteractive',
      '-Command',
      '(Get-Process -Id ' + child.pid + ').MainWindowTitle',
    ]);
    assert.equal(title.trim(), actual.backend.title + ' ' + config.version + ' (windows)');
  }
  if (config.name === '@nelyx/testbed-2') {
    const button = (name) => page.getByRole('button', { name, exact: true });
    const activate = async (name) => {
      const control = button(name);
      await control.waitFor();
      await control.evaluate((element) => element.click());
    };
    const selected = (group, name) =>
      group
        .getByRole('button', { name, exact: true })
        .and(page.locator('[aria-selected=true]'))
        .waitFor();
    const material = page.getByRole('group', { name: 'Segmented buttons 기본 API' });
    await selected(material, 'List');
    await activate('Grid');
    await selected(material, 'Grid');
    await verifyWebViewClipboard(page, activate);
    await activate('Cupertino');
    const cupertino = page.getByRole('list', { name: /Sliding segmented control/ });
    await selected(cupertino, 'Daily');
    await activate('Weekly');
    await selected(cupertino, 'Weekly');
    console.log('Windows Testbed verified Material and Cupertino segmented controls');
  }
  if (windows.length > 1) await verifyWindowClipboard(pages, windows);
  assert.throws(() => publishDirectory(candidate, current), /Close any running copy/);
  assert.equal(fs.statSync(file).size, fs.statSync(path.join(pkg, name)).size);
  assert(
    fs.existsSync(candidate) &&
      !fs.readdirSync(stage).some((name) => name.startsWith('.previous-')),
  );
  console.log(
    'Offline WebView2 verified Rust IPC, clipboard permissions, title and embedded assets',
    actual.buildId,
  );
} finally {
  try {
    if (child?.pid) {
      capture(
        'powershell.exe',
        [
          '-NoProfile',
          '-NonInteractive',
          '-Command',
          `$app = Get-Process -Id ${child.pid} -ErrorAction SilentlyContinue; if ($app.Path -eq $env:NELYX_TEST_EXECUTABLE) { [void]$app.CloseMainWindow() }`,
        ],
        {
          timeout: 5000,
          env: {
            ...process.env,
            NELYX_TEST_EXECUTABLE: path.join(stage, 'current', 'nelyx-tauri.exe'),
          },
        },
      );
      await Promise.race([child.completed, delay(5000, undefined, { ref: false })]);
    }
  } catch {
    // The owned process is stopped below if graceful shutdown fails.
  } finally {
    await child?.stop();
    await browser?.close().catch(() => {});
    await removeProfile(stage);
  }
}

function nativeClipboard(page, method, args) {
  return page.evaluate(
    ({ method, args }) => window.__TAURI__.core.invoke('plugin:clipboard-manager|' + method, args),
    { method, args },
  );
}

async function verifyWindowClipboard(pages, windows) {
  assert.equal(pages.size, windows.length);
  const reference = windows.find(({ clipboard }) => clipboard?.read && clipboard.write);
  assert(reference, 'The scope check needs one WebView that can save and restore the clipboard');
  const owner = pages.get(reference.label);
  const saved = await nativeClipboard(owner, 'read_text').catch((error) => {
    if (/clipboard is empty|clipboard contents were not available/i.test(String(error))) return '';
    throw error;
  });
  const denial = (error) => /not allowed|permission|forbidden/i.test(String(error));
  try {
    for (const { label, clipboard } of windows) {
      const page = pages.get(label);
      const backend = await page.evaluate(() =>
        window.__TAURI__.core.invoke('plugin:nelyx-backend|describe'),
      );
      assert.deepEqual(backend.clipboard, clipboard ?? null);
      const text = 'Nelyx ' + label;
      await nativeClipboard(owner, 'write_text', { text });
      if (clipboard?.read) assert.equal(await nativeClipboard(page, 'read_text'), text);
      else await assert.rejects(nativeClipboard(page, 'read_text'), denial);
      if (clipboard?.write) {
        await nativeClipboard(page, 'write_text', { text: text + ' write' });
        assert.equal(await nativeClipboard(owner, 'read_text'), text + ' write');
      } else await assert.rejects(nativeClipboard(page, 'write_text', { text }), denial);
    }
  } finally {
    await nativeClipboard(owner, 'write_text', { text: saved });
  }
  console.log(
    'Windows WebView clipboard ACL verified',
    windows.map(({ label }) => label),
  );
}

async function verifyRunningLink(page, file, url, options) {
  await page.evaluate(async () => {
    window.nelyxVerifiedLinks = [];
    window.stopNelyxVerifiedLinks = await window.__TAURI__.event.listen('deep-link://new-url', (event) => {
      window.nelyxVerifiedLinks.push(...event.payload);
    });
  });
  const ingress = startOwnedCommand(file, [url], { ...options, isolateWindows: true });
  try {
    await page.waitForFunction((url) => window.nelyxVerifiedLinks.includes(url), url);
    const links = await page.evaluate(() => window.__TAURI__.core.invoke('plugin:deep-link|get_current'));
    assert.deepEqual(links, [url]);
  } finally {
    await ingress.stop();
    await page.evaluate(() => window.stopNelyxVerifiedLinks());
  }
}

async function verifyNativePicker(page, stage, pid) {
  const filename = 'nelyx-selected-file';
  const selected = path.join(stage, filename);
  const bytes = [0, 19, 128, 255];
  fs.writeFileSync(selected, Buffer.from(bytes));
  const title = 'Nelyx device file picker verification';
  await page.evaluate(({ title, stage }) => {
    const { invoke } = window.__TAURI__.core;
    window.nelyxFileVerification = invoke('plugin:dialog|open', {
      options: { title, defaultPath: stage, multiple: false, directory: false },
    }).then(async (path) => ({
      path,
      bytes: path ? Array.from(new Uint8Array(await invoke('plugin:fs|read_file', { path }))) : [],
    })).catch((error) => ({ error: String(error) }));
  }, { title, stage });
  try {
    capture('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', `
    $ErrorActionPreference = 'Stop'
    Add-Type -AssemblyName UIAutomationClient, UIAutomationTypes, System.Windows.Forms
    Add-Type @'
    using System;
    using System.Runtime.InteropServices;
    public static class NelyxPickerFocus {
      [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr window);
      [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
    }
'@
    $name = [Windows.Automation.PropertyCondition]::new([Windows.Automation.AutomationElement]::NameProperty, $env:NELYX_DEVICE_PICKER_TITLE)
    $owner = [Windows.Automation.PropertyCondition]::new([Windows.Automation.AutomationElement]::ProcessIdProperty, [int]$env:NELYX_DEVICE_PICKER_PID)
    $windowKind = [Windows.Automation.PropertyCondition]::new([Windows.Automation.AutomationElement]::ControlTypeProperty, [Windows.Automation.ControlType]::Window)
    $dialogCondition = [Windows.Automation.AndCondition]::new($name, $owner, $windowKind)
    $fileName = [Windows.Automation.PropertyCondition]::new([Windows.Automation.AutomationElement]::NameProperty, $env:NELYX_DEVICE_PICKER_FILE)
    $fileKind = [Windows.Automation.PropertyCondition]::new([Windows.Automation.AutomationElement]::ControlTypeProperty, [Windows.Automation.ControlType]::ListItem)
    $fileCondition = [Windows.Automation.AndCondition]::new($fileName, $fileKind)
    $descendants = [Windows.Automation.TreeScope]::Descendants
    for ($attempt = 0; $attempt -lt 24; $attempt++) {
      $dialog = [Windows.Automation.AutomationElement]::RootElement.FindFirst($descendants, $dialogCondition)
      if ($dialog) {
        $file = $dialog.FindFirst($descendants, $fileCondition)
        if ($file) { break }
      }
      Start-Sleep -Milliseconds 400
    }
    if (!$dialog) { throw 'The process-owned native picker did not appear' }
    if (!$file) { throw 'The native picker did not show the test file' }
    $window = [IntPtr]$dialog.Current.NativeWindowHandle
    [void][NelyxPickerFocus]::SetForegroundWindow($window)
    $file.GetCurrentPattern([Windows.Automation.SelectionItemPattern]::Pattern).Select()
    $file.SetFocus()
    if ([NelyxPickerFocus]::GetForegroundWindow() -ne $window) { throw 'The native picker does not own keyboard focus' }
    [Windows.Forms.SendKeys]::SendWait('{ENTER}')
    `], {
      env: { ...process.env, NELYX_DEVICE_PICKER_TITLE: title, NELYX_DEVICE_PICKER_PID: String(pid), NELYX_DEVICE_PICKER_FILE: filename },
      timeout: 20_000,
    });
  } catch (error) {
    const result = await page.evaluate(() => Promise.race([
      window.nelyxFileVerification,
      new Promise((resolve) => setTimeout(() => resolve(null), 300)),
    ]));
    if (result?.error) throw new Error(result.error, { cause: error });
    throw error;
  }
  const result = await page.evaluate(() => Promise.race([
    window.nelyxFileVerification,
    new Promise((resolve) => setTimeout(() => resolve({ error: 'Native file picker did not complete' }), 10_000)),
  ]));
  assert.equal(result.error, undefined);
  assert.equal(typeof result.path, 'string', 'Native picker must return the selected path');
  assert.equal(path.resolve(result.path).toLowerCase(), selected.toLowerCase());
  assert.deepEqual(result.bytes, bytes);
  console.log('Windows native picker authorized the selected binary file');
}

async function verifyDevicePermissions(page, enabled, stage, initialLink) {
  const unread = path.join(stage, 'unselected.bin');
  fs.writeFileSync(unread, Buffer.from([0, 1, 255]));
  const result = await page.evaluate(async ({ enabled, unread }) => {
    const { invoke } = window.__TAURI__.core;
    const denied = async (command, arguments_) => {
      try { await invoke(command, arguments_); return false; }
      catch (error) { return /not allowed|forbidden|permission.denied/i.test(JSON.stringify(error)); }
    };
    const descriptions = await invoke('plugin:nelyx-backend|describe');
    const withStore = enabled.includes('store');
    const key = 'nelyx-check-' + crypto.randomUUID();
    const store = (operation, value) => invoke('plugin:nelyx-backend|device_store', {
      input: { operation, key, ...(operation === 'set' ? { value } : {}) },
    });
    let stored = null;
    if (withStore) {
      try {
        await store('set', { number: 0, text: '한글' });
        stored = await store('get');
      } finally {
        await store('remove');
      }
    }
    return {
      enabled: descriptions.deviceServices,
      stored,
      omittedStoreDenied: withStore || await denied('plugin:nelyx-backend|device_store', { input: { operation: 'get', key } }),
      rawStoreDenied: await denied('plugin:store|load', { path: 'unscoped.json', options: {} }),
      fileDenied: await denied('plugin:fs|read_file', { path: unread }),
      urlDenied: await denied('plugin:opener|open_url', { url: 'file:///not-opened.txt' }),
      initialLinks: enabled.includes('deepLinks') ? await invoke('plugin:deep-link|get_current') : null,
      permission: enabled.includes('notifications') ? await invoke('plugin:notification|is_permission_granted') : null,
    };
  }, { enabled, unread });
  assert.deepEqual(result.enabled, enabled);
  assert.deepEqual(result.stored, enabled.includes('store') ? { found: true, value: { number: 0, text: '한글' } } : null);
  for (const key of ['omittedStoreDenied', 'rawStoreDenied', 'fileDenied', 'urlDenied'])
    assert.equal(result[key], true, key);
  assert.deepEqual(result.initialLinks, initialLink ? [initialLink] : null);
  assert.ok(result.permission === null || typeof result.permission === 'boolean');
}

async function verifyWebViewClipboard(page, activate) {
  const cdp = await page.context().newCDPSession(page);
  try {
    const { targetInfo } = await cdp.send('Target.getTargetInfo');
    for (const name of ['clipboard-read', 'clipboard-write'])
      await cdp.send('Browser.setPermission', {
        permission: { name },
        setting: 'granted',
        origin: new URL(page.url()).origin,
        browserContextId: targetInfo.browserContextId,
      });
    await activate('Text inputs');
    const field = page.getByRole('textbox', { name: 'Write something', exact: true });
    await field.waitFor();
    const at = await field.boundingBox();
    assert(at);
    const x = at.x + Math.min(40, at.width / 2),
      y = at.y + at.height / 2;
    const saved = await page.evaluate(() => navigator.clipboard.readText());
    const editor = (expected, requireSelection = false) =>
      page.waitForFunction(
        ({ expected, requireSelection }) => {
          const element = document.activeElement;
          const input = element?.editContext;
          const text = input?.text ?? element?.value;
          const start = input?.selectionStart ?? element?.selectionStart;
          const end = input?.selectionEnd ?? element?.selectionEnd;
          return text === expected && (!requireSelection || (start === 0 && end === text.length));
        },
        { expected, requireSelection },
        { timeout: 8_000 },
      );
    try {
      await page.evaluate(() => navigator.clipboard.writeText(''));
      await page.mouse.click(x, y);
      await page.keyboard.press('Control+a');
      await page.keyboard.insertText('Testbed fallback');
      await editor('Testbed fallback');
      await page.keyboard.press('Control+a');
      await editor('Testbed fallback', true);
      await page.keyboard.press('Control+c');
      await page.waitForFunction(
        async () => (await navigator.clipboard.readText()) === 'Testbed fallback',
        undefined,
        { timeout: 8_000 },
      );
      await page.evaluate(() => navigator.clipboard.writeText('WebView 읽기'));
      await page.keyboard.press('Control+v');
      await editor('WebView 읽기');
    } finally {
      await page.evaluate((text) => navigator.clipboard.writeText(text), saved);
    }
    console.log('Windows Testbed widget copied and pasted through the WebView clipboard');
  } finally {
    await cdp.detach();
  }
}
