// SPDX-License-Identifier: BSD-3-Clause
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { createServer } from 'node:net';
import { once } from 'node:events';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { setTimeout as wait } from 'node:timers/promises';
import { promisify } from 'node:util';
import { chromium } from 'playwright';
import { execute, startOwnedCommand } from '../../../Nelyx/sdk/tooling/cli/src/commands.mjs';

const args = process.argv.slice(2);
if (!args.includes('--child')) {
  await execute(process.execPath, [import.meta.filename, ...args, '--child'], {
    timeout: 1_200_000,
  });
  process.exit(0);
}

const adbPath = join(
  process.env.ANDROID_HOME ?? '',
  'platform-tools',
  process.platform === 'win32' ? 'adb.exe' : 'adb',
);
const device = process.env.ANDROID_SERIAL ?? 'emulator-5554';
const app = resolve(import.meta.dirname, '..');
const appId = 'dev.nelyx.demo.tauri';
const android = args.includes('--android');
const androidDevices = args.includes('--android-devices');
const androidStartupLink = 'nelyx-demo://startup-check';
const mobileWeb = args.includes('--mobile-web');
const windows = args.includes('--windows');
const multilineHandlesOnly = args.includes('--multiline-handles');
const manifest = JSON.parse(await readFile(join(app, '.nelyx',
  android || windows ? 'tauri/frontend' : 'web', 'build.json'), 'utf8'));
const headed = args.includes('--headed');
const observePhysical = args.includes('--observe-physical');
assert.ok(!android || !windows, 'Select one packaged host at a time');
assert.ok(!androidDevices || android, '--android-devices requires --android');
assert.ok(!mobileWeb || (!android && !windows), '--mobile-web requires the Web release');
if (observePhysical)
  assert.ok(
    android && !device.startsWith('emulator-'),
    'Select the physical Android device with ANDROID_SERIAL',
  );
const button = (page, name) => page.getByRole('button', { name, exact: true });
const field = (page, label) => page.getByRole('textbox', { name: label, exact: true });
const menu = (page, name) => button(page, name);
const readEditor = (page) =>
  page.evaluate(() => {
    const editor = document.activeElement;
    if (editor?.editContext)
      return {
        text: editor.editContext.text,
        start: editor.editContext.selectionStart,
        end: editor.editContext.selectionEnd,
        carrier: 'EditContext',
      };
    if (editor instanceof HTMLInputElement || editor instanceof HTMLTextAreaElement)
      return {
        text: editor.value,
        start: editor.selectionStart,
        end: editor.selectionEnd,
        carrier: editor.tagName,
      };
    return null;
  });
const adb = (...params) =>
  promisify(execFile)(adbPath, ['-s', device, ...params], {
    windowsHide: true,
    timeout: 20_000,
    maxBuffer: 10 * 1024 * 1024,
    encoding: 'buffer',
  }).then(({ stdout }) => stdout);

async function androidClipboardReads() {
  const pid = (await adb('shell', 'pidof', appId)).toString().trim();
  assert.match(pid, /^\d+$/);
  const entries = (await adb('logcat', '-d', '--pid', pid, '-s', 'Tauri/Plugin:V')).toString();
  return [...entries.matchAll(/pluginId: clipboard-manager, command: readText\b/g)].length;
}

async function until(check, message) {
  for (let i = 0; i < 24; i++) {
    if (await check()) return;
    await wait(150);
  }
  assert.fail(message);
}

async function point(locator, dx) {
  await locator.waitFor();
  const box = await locator.boundingBox();
  assert.ok(box?.width > 0 && box.height > 0, 'Selected control must be laid out');
  return {
    x: Math.round(box.x + (dx ?? box.width / 2)),
    y: Math.round(box.y + box.height / 2),
  };
}

async function openSelection(page, tap) {
  const drawer = page.locator('[data-semantics-identifier="open-drawer"]');
  try {
    await tap(await point(drawer));
    await tap(await point(button(page, 'Text selection')));
    await field(page, 'Material single line').waitFor({ timeout: 6000 });
  } catch (error) {
    console.error(await page.locator('body').ariaSnapshot({ timeout: 4000 }));
    throw error;
  }
}

async function verifyBundle(page) {
  const served = await page.evaluate(() =>
    fetch(new URL('build.json', document.baseURI), { cache: 'no-store' }).then((response) =>
      response.json(),
    ),
  );
  assert.equal(
    served.buildId,
    manifest.buildId,
    'The observed page must run the current product bundle',
  );
}

function installSelectionProbes() {
  window.readOnlySelections = {};
  window.nelyxDemoSelectionProbe = (id, text) => (window.readOnlySelections[id] = text);
  window.nelyxDemoEditorGeometryProbe = (read) => (window.readSelectionEditorGeometry = read);
  const lenses = new Map();
  window.nelyxDemoMagnifierProbe = (id, read) => {
    lenses.set(id, { read, requests: (lenses.get(id)?.requests ?? 0) + 1 });
  };
  const rect = ({ left, top, right, bottom }) => ({ left, top, right, bottom });
  window.readSelectionMagnifiers = () =>
    Object.fromEntries(
      [...lenses].map(([id, { read, requests }]) => {
        const { info, exists, shown } = read();
        const { dx, dy } = info.globalGesturePosition;
        return [
          id,
          {
            exists,
            shown,
            requests,
            info: {
              globalGesturePosition: { dx, dy },
              caretRect: rect(info.caretRect),
              fieldBounds: rect(info.fieldBounds),
              currentLineBoundaries: rect(info.currentLineBoundaries),
            },
          },
        ];
      }),
    );
}

async function web(page, url, chromePid) {
  await page.addInitScript(installSelectionProbes);
  await page.addInitScript(() => {
    window.selectionMenus = [];
    window.selectionMenuKeys = [];
    document.addEventListener('keydown', (event) => {
      if (['F10', 'Escape', 'Tab', 'Enter'].includes(event.key))
        window.selectionMenuKeys.push([
          event.key,
          event.defaultPrevented,
          event.target.getAttribute('aria-label'),
        ]);
    });
    document.addEventListener(
      'contextmenu',
      (event) => {
        const { target } = event;
        window.selectionMenus.push({ tag: target.tagName, prevented: event.defaultPrevented });
      },
      true,
    );
  });
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await verifyBundle(page);
  const tap = ({ x, y }) => page.mouse.click(x, y);
  const secondary = ({ x, y }) => page.mouse.click(x, y, { button: 'right' });
  const nativeMenu = async (expected) => {
    if (!chromePid) return;
    const showsInspect = async () => (await windowsInput(chromePid, 'uia', 'Inspect')).length > 0;
    if (expected) {
      await until(showsInspect, 'Chrome Inspect identifies the native browser menu');
      await windowsInput(chromePid, 'scan', '01');
    } else assert.equal(await showsInspect(), false, 'Chrome must leave the Nelyx menu open');
  };
  await openSelection(page, tap);
  const first = await point(field(page, 'Material single line'), 44);
  await secondary(first);
  assert.equal(await menu(page, 'Select all').count(), 0);
  assert.equal(await page.evaluate(() => window.selectionMenus.at(-1)?.prevented), false);
  await nativeMenu(true);
  await tap(await point(button(page, 'Use Nelyx menus')));
  // Capture the final event state after the SDK's enclosing surface listener.
  await page.evaluate(() => {
    document.addEventListener('contextmenu', (event) => {
      window.selectionMenus.push({ tag: event.target.tagName, prevented: event.defaultPrevented });
    });
  });
  await secondary(first);
  await menu(page, 'Select all').waitFor();
  assert.equal(await page.evaluate(() => window.selectionMenus.at(-1)?.prevented), true);
  await nativeMenu(false);
  const firstCaret = await readEditor(page);
  assert.equal(firstCaret.start, firstCaret.end);

  await page.keyboard.press('Control+a');
  await secondary(first);
  await menu(page, 'Copy').waitFor();
  assert.deepEqual(
    [await menu(page, 'Copy').count(), (await readEditor(page)).end],
    [1, firstCaret.text.length],
  );
  await page.keyboard.press('Escape');
  await menu(page, 'Copy').waitFor({ state: 'hidden' });
  assert.equal((await readEditor(page)).text, firstCaret.text);

  await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
  const clipboard = await page.evaluate(() => navigator.clipboard.readText());
  try {
    await page.evaluate(() => navigator.clipboard.writeText(''));
    await secondary(await point(field(page, 'Empty field'), 20));
    await menu(page, 'Paste').waitFor();
    await until(() => menu(page, 'Paste').isDisabled(), 'Empty clipboard should disable Paste');
    await page.keyboard.press('Escape');
    await checkBrowserClipboardPermission(page, tap);
    const missingCode = (events) =>
      page.evaluate((keys) => {
        for (const [type, key, keyCode, shiftKey, location] of keys) {
          const event = new KeyboardEvent(type, {
            key,
            code: '',
            shiftKey,
            location,
            bubbles: true,
            cancelable: true,
          });
          Object.defineProperty(event, 'keyCode', { value: keyCode });
          document.activeElement.dispatchEvent(event);
        }
      }, events);
    await missingCode([
      ['keydown', 'Shift', 16, true, 1],
      ['keydown', 'F10', 121, true, 0],
      ['keyup', 'F10', 121, true, 0],
      // WebKitGTK reports the pre-release modifier bit on keyup.
      ['keyup', 'Shift', 16, true, 1],
    ]);
    await menu(page, 'Paste').waitFor();
    assert.equal(await menu(page, 'Paste').count(), 1);
    await page.keyboard.press('Escape');
    await menu(page, 'Paste').waitFor({ state: 'hidden' });
    await page.evaluate(() => navigator.clipboard.writeText('한글 👋 붙여넣기'));
    await page.keyboard.press('Shift+F10');
    await menu(page, 'Paste').waitFor();
    await until(() => menu(page, 'Paste').isEnabled(), 'Text should enable keyboard Paste');
    await page.keyboard.press('Tab');
    await page.keyboard.press('Enter');
    await until(
      async () => (await readEditor(page))?.text === '한글 👋 붙여넣기',
      'Keyboard paste did not edit the field',
    ).catch(async (error) => {
      console.error({
        editor: await readEditor(page),
        pasteVisible: await menu(page, 'Paste').isVisible(),
        ...(await page.evaluate(async () => ({
          keys: window.selectionMenuKeys,
          clipboardMatches: (await navigator.clipboard.readText()) === '한글 👋 붙여넣기',
        }))),
      });
      throw error;
    });
    await page.keyboard.press('Control+z');
    await until(
      async () => (await readEditor(page))?.text === '',
      'Undo should restore the empty editor',
    );
    await checkClipboardRaces(page, tap, secondary, first);
  } finally {
    await page.evaluate((text) => navigator.clipboard.writeText(text), clipboard);
  }

  await page.evaluate(() => {
    const outside = document.createElement('button');
    outside.id = 'outside-selection-surface';
    outside.textContent = 'Outside DOM';
    outside.style.cssText = 'position:fixed;z-index:9999;top:0;left:0';
    document.body.append(outside);
  });
  await page.locator('#outside-selection-surface').click({ button: 'right' });
  assert.deepEqual(await page.evaluate(() => window.selectionMenus.at(-1)), {
    tag: 'BUTTON',
    prevented: false,
  });
  await nativeMenu(true);
  await tap(first);
  await secondary(first);
  await menu(page, 'Select all').waitFor();
  await page.locator('#outside-selection-surface').click();
  await menu(page, 'Select all').waitFor({ state: 'hidden' });
  assert.equal(await page.evaluate(() => document.activeElement.id), 'outside-selection-surface');
  try {
    await checkPublicWidgets(page, tap, secondary);
  } finally {
    await page.evaluate((text) => navigator.clipboard.writeText(text), clipboard);
  }
  console.log(
    JSON.stringify({
      host: 'PWA',
      buildId: manifest.buildId,
      carrier: firstCaret.carrier,
      policy: 'PASS',
      keyboard: 'PASS',
      clipboard: 'PASS',
      undo: 'PASS',
      ...(chromePid ? { chromeNativeMenu: 'PASS' } : {}),
    }),
  );
}

async function checkBrowserClipboardPermission(page, tap) {
  const cdp = await page.context().newCDPSession(page);
  const { targetInfo } = await cdp.send('Target.getTargetInfo');
  const origin = new URL(page.url()).origin;
  const permission = (setting) =>
    cdp.send('Browser.setPermission', {
      permission: { name: 'clipboard-read' },
      setting,
      origin,
      browserContextId: targetInfo.browserContextId,
    });
  try {
    await page.evaluate(() => navigator.clipboard.writeText('한글 실제 권한 👋'));
    await permission('denied');
    await page.keyboard.press('Shift+F10');
    await until(
      () => menu(page, 'Paste').isDisabled(),
      'Chrome-denied clipboard should disable Paste',
    );
    assert.equal(
      await page.evaluate(() =>
        navigator.clipboard.readText().then(
          () => null,
          ({ name }) => name,
        ),
      ),
      'NotAllowedError',
    );
    await page.keyboard.press('Escape');
    await permission('granted');
    await page.keyboard.press('Shift+F10');
    await until(
      () => menu(page, 'Paste').isEnabled(),
      'Chrome clipboard permission should enable Paste',
    );
    await tap(await point(menu(page, 'Paste')));
    await until(
      async () => (await readEditor(page))?.text === '한글 실제 권한 👋',
      'Chrome clipboard must paste permitted text',
    );
    await page.keyboard.press('Control+z');
    await until(
      async () => (await readEditor(page))?.text === '',
      'Undo must restore the test field',
    );
  } finally {
    await cdp.detach();
    await page.context().grantPermissions(['clipboard-read', 'clipboard-write'], { origin });
  }
}

async function checkMobileWebClipboard(page, url) {
  await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.addInitScript(() => {
    const clipboard = navigator.clipboard;
    const read = clipboard.readText.bind(clipboard);
    window.mobileClipboardReads = [];
    clipboard.readText = () => {
      window.mobileClipboardReads.push(navigator.userActivation.isActive);
      return read();
    };
  });
  await page.goto(url);
  await verifyBundle(page);
  await page.waitForFunction(() => document.documentElement.dataset.nelyxBackendProtocol === '3');
  assert.equal(await page.locator('html').getAttribute('data-nelyx-os'), 'android');
  const cdp = await page.context().newCDPSession(page);
  const touch = (type, at) => cdp.send('Input.dispatchTouchEvent', {
    type, touchPoints: at ? [{ ...at, id: 1 }] : [],
  });
  const tap = (at) => page.touchscreen.tap(at.x, at.y);
  const saved = await page.evaluate(() => navigator.clipboard.readText());
  try {
    const text = '웹 모바일 붙여넣기';
    await page.evaluate(async (value) => {
      await navigator.clipboard.writeText(value);
      window.mobileClipboardReads.length = 0;
    }, text);
    await openSelection(page, tap);
    await touch('touchStart', await point(field(page, 'Material single line'), 35));
    await wait(650);
    await touch('touchEnd');
    const paste = menu(page, 'Paste');
    await paste.waitFor();
    await until(() => paste.isEnabled(), 'Mobile browser menu must offer explicit Paste');
    assert.deepEqual(await page.evaluate(() => window.mobileClipboardReads), []);
    await tap(await point(paste));
    await until(async () => (await readEditor(page))?.text.includes(text), 'Mobile Web Paste must edit the field');
    assert.deepEqual(await page.evaluate(() => window.mobileClipboardReads), [true]);
    console.log(JSON.stringify({ host: 'PWA Android viewport', mobileMenuReads: 0, pasteReads: 1 }));
  } finally {
    await page.evaluate((text) => navigator.clipboard.writeText(text), saved);
    await cdp.detach();
  }
}

async function windowsInput(pid, action, value) {
  const params = [
    '-NoProfile',
    '-NonInteractive',
    '-ExecutionPolicy',
    'Bypass',
    '-File',
    join(import.meta.dirname, 'windows-selection-input.ps1'),
    '-WindowProcessId',
    String(pid),
    '-Action',
    action,
  ];
  if (value) params.push('-Value', value);
  const { stdout } = await promisify(execFile)('powershell.exe', params, {
    windowsHide: true,
    timeout: 25_000,
  });
  return action === 'uia' ? JSON.parse(stdout) : undefined;
}

async function windowsSelection(page, pid) {
  const native = (action, value) => windowsInput(pid, action, value);
  const scan = (value) => native('scan', value);
  const tap = ({ x, y }) => page.mouse.click(x, y);
  await native('focus');
  await openSelection(page, tap);
  await page.evaluate(() => {
    window.selectionKeys = [];
    for (const type of ['keydown', 'keyup']) {
      document.addEventListener(type, (event) => {
        const {
          key,
          code,
          keyCode,
          location,
          shiftKey,
          ctrlKey,
          altKey,
          metaKey,
          defaultPrevented,
        } = event;
        if (
          !['Shift', 'F10', 'ContextMenu', 'Menu', 'Escape', 'Tab', 'ArrowDown', 'Enter'].includes(key) &&
          !(ctrlKey && ['a', 'c', 'v'].includes(key.toLowerCase()))
        )
          return;
        window.selectionKeys.push({
          type,
          key,
          code,
          keyCode,
          location,
          shiftKey,
          ctrlKey,
          altKey,
          metaKey,
          defaultPrevented,
        });
      });
    }
  });
  const clipboard = (value) =>
    page.evaluate(async (text) => {
      const { invoke } = window.__TAURI__.core;
      if (text !== undefined) return invoke('plugin:clipboard-manager|write_text', { text });
      try {
        return await invoke('plugin:clipboard-manager|read_text');
      } catch (error) {
        if (/clipboard contents were not available|clipboard is empty/i.test(String(error)))
          return '';
        throw error;
      }
    }, value);
  const saved = await clipboard();
  try {
    const main = field(page, 'Material single line');
    await tap(await point(main, 36));
    const caret = await readEditor(page);
    assert.ok(caret?.start === caret?.end && caret.text.includes('안녕하세요'));
    await scan('2a,44'); // Shift+F10
    await menu(page, 'Select all').waitFor();
    assert.equal(await menu(page, 'Select all').count(), 1);
    await scan('01'); // Escape
    await menu(page, 'Select all').waitFor({ state: 'hidden' });
    assert.deepEqual(await readEditor(page), caret);
    await scan('1d,1e'); // Ctrl+A
    await until(
      async () => (await readEditor(page))?.end === caret.text.length,
      'Ctrl+A must select the field',
    );
    await scan('e05d'); // Context Menu
    await menu(page, 'Copy').waitFor();
    assert.equal(await menu(page, 'Copy').count(), 1);
    const copyNodes = await native('uia', 'Copy');
    assert.ok(copyNodes.some((item) => item.name === 'Copy' && item.enabled));
    await scan('01');
    await menu(page, 'Copy').waitFor({ state: 'hidden' });
    assert.equal((await readEditor(page))?.end, caret.text.length);
    await clipboard('');
    await scan('1d,2e'); // Ctrl+C
    await until(
      async () => (await clipboard()) === caret.text,
      'Ctrl+C must write the OS clipboard',
    );
    await scan('e05d');
    await menu(page, 'Copy').waitFor();
    await clipboard('');
    await tap(await point(menu(page, 'Copy')));
    await until(
      async () => (await clipboard()) === caret.text,
      'Menu Copy must write the OS clipboard',
    );

    const empty = field(page, 'Empty field');
    await tap(await point(empty, 24));
    await scan('1d,2f'); // Ctrl+V
    await until(
      async () => (await readEditor(page))?.text === caret.text,
      'Ctrl+V must read the OS clipboard',
    );
    await scan('1d,1e');
    await scan('0e'); // Backspace
    await clipboard('');
    await scan('2a,44');
    await menu(page, 'Paste').waitFor();
    await until(() => menu(page, 'Paste').isDisabled(), 'The empty clipboard must disable Paste');
    const pasteNodes = await native('uia', 'Paste');
    assert.ok(pasteNodes.some((item) => item.name === 'Paste' && !item.enabled));
    await scan('01');
    await menu(page, 'Paste').waitFor({ state: 'hidden' });
    const text = '한글 👋 Windows';
    await clipboard(text);
    await scan('2a,44');
    await until(() => menu(page, 'Paste').isEnabled(), 'The OS clipboard must enable menu Paste');
    await scan('0f'); // Tab
    await scan('e050'); // Arrow Down
    await scan('1c'); // Enter
    await until(
      async () => (await readEditor(page))?.text === text,
      'Keyboard menu Paste must read the OS clipboard',
    );
    const events = await page.evaluate(() => window.selectionKeys);
    assert.ok(
      events.some((event) => event.key === 'F10' && event.shiftKey && event.defaultPrevented),
    );
    assert.ok(
      events.some((event) => ['ContextMenu', 'Menu'].includes(event.key) && event.defaultPrevented),
    );
    console.log(
      JSON.stringify({
        host: 'Windows Tauri',
        buildId: manifest.buildId,
        carrier: caret.carrier,
        scanCodes: 'PASS',
        osClipboard: 'PASS',
        uiAutomation: { copyNodes, pasteNodes },
        events,
      }),
    );
  } catch (error) {
    console.error(
      await page.evaluate(() => ({
        activeElement: document.activeElement?.tagName,
        activeLabel: document.activeElement?.getAttribute('aria-label'),
        documentFocused: document.hasFocus(),
        keys: window.selectionKeys,
      })),
    );
    throw error;
  } finally {
    await clipboard(saved ?? '');
  }
}

async function revealWithWheel(page, target) {
  const { width, height } = page.viewportSize();
  await page.mouse.move(width * 0.8, height * 0.75);
  await until(async () => {
    if (await target.isVisible()) {
      const box = await target.boundingBox();
      if (box && box.y >= 85 && box.y + box.height < height - 12) return true;
    }
    await page.mouse.wheel(0, 165);
    return false;
  }, 'The target was not reached in the selection demo');
  return point(target, 24);
}

async function glyphPoint(page, target, dx = 0) {
  const box = await target.boundingBox();
  const x = Math.ceil(box.x) + dx,
    y = Math.ceil(box.y),
    width = Math.min(80, Math.floor(box.x + box.width) - x),
    height = Math.floor(box.y + box.height) - y;
  assert.ok(width > 0 && height > 0, 'Text probe must stay within the rendered control');
  const png = await page.screenshot({ clip: { x, y, width, height }, scale: 'css' });
  const ink = await page.evaluate(async (png) => {
    const bytes = Uint8Array.from(atob(png), (character) => character.charCodeAt(0));
    const bitmap = await createImageBitmap(new Blob([bytes], { type: 'image/png' }));
    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
    const context = canvas.getContext('2d');
    context.drawImage(bitmap, 0, 0);
    bitmap.close();
    const { data } = context.getImageData(0, 0, canvas.width, canvas.height);
    // Choose an interior ink pixel with a similarly dark neighbor so edges and carets are avoided.
    for (let row = 2; row < canvas.height - 2; row++) {
      for (let col = 2; col < canvas.width - 2; col++) {
        const i = (row * canvas.width + col) * 4;
        if (
          data[i] + data[i + 1] + data[i + 2] < 330 &&
          data[i + 4] + data[i + 5] + data[i + 6] < 430
        )
          return { x: col, y: row };
      }
    }
    return null;
  }, png.toString('base64'));
  assert.ok(ink, `No drawn text found inside ${JSON.stringify({ x, y, width, height })}`);
  return { x: x + ink.x, y: y + ink.y };
}

async function checkPublicWidgets(page, tap, secondary) {
  const readonly = await revealWithWheel(page, field(page, 'Read-only field'));
  await tap(readonly);
  await page.keyboard.press('Control+a');
  await secondary(readonly);
  await menu(page, 'Copy').waitFor();
  assert.equal(await menu(page, 'Paste').count(), 0);
  assert.equal(await menu(page, 'Cut').count(), 0);
  await page.keyboard.press('Escape');

  const password = await revealWithWheel(page, field(page, 'Password field'));
  await tap(password);
  await page.keyboard.press('Control+a');
  await page.keyboard.press('Shift+F10');
  await menu(page, 'Paste').waitFor();
  assert.equal(await menu(page, 'Copy').count(), 0);
  assert.equal(await menu(page, 'Cut').count(), 0);
  await page.keyboard.press('Escape');
  const selectionDisabled = field(page, 'Selection disabled');
  await tap(await revealWithWheel(page, selectionDisabled));
  await until(
    async () => (await readEditor(page))?.text === '안녕하세요 Nelyx 👋 שלום',
    'The selection-disabled field must receive keyboard focus',
  );
  await secondary(await point(selectionDisabled, 24));
  await page.keyboard.press('Shift+F10');
  assert.equal(await menu(page, 'Paste').count(), 0);
  const disabled = field(page, 'Disabled field');
  await secondary(await revealWithWheel(page, disabled));
  assert.ok(await disabled.isDisabled());
  assert.equal(await menu(page, 'Select all').count(), 0);

  const surface = (id) => page.locator(`[data-semantics-identifier="w6-${id}"]`);
  const selected = (id) => page.evaluate((name) => window.readOnlySelections[name], id);
  const checkCopy = async (text) => {
    assert.equal(await menu(page, 'Copy').count(), 1);
    assert.equal(await menu(page, 'Cut').count(), 0);
    assert.equal(await menu(page, 'Paste').count(), 0);
    await page.evaluate(() => navigator.clipboard.writeText(''));
    await tap(await point(menu(page, 'Copy')));
    let copied = '';
    await until(
      async () => {
        copied = (await page.evaluate(() => navigator.clipboard.readText())).replaceAll(
          '\r\n',
          '\n',
        );
        return copied.length > 0;
      },
      'The menu must copy ' + JSON.stringify(text),
    );
    assert.equal(copied, text);
    await menu(page, 'Copy').waitFor({ state: 'hidden' });
  };
  for (const [id, text] of [
    ['material-readonly', '읽기 전용 Material 👋 · 강조 😊'],
    ['core-readonly', 'Core selection · 한글 · 강조 😊'],
    ['paragraph-selection', null],
  ]) {
    const target = surface(id);
    await revealWithWheel(page, target);
    await secondary(await glyphPoint(page, target));
    await menu(page, 'Select all').waitFor();
    await tap(await point(menu(page, 'Select all')));
    await menu(page, 'Select all').waitFor({ state: 'hidden' });
    await until(() => selected(id), `${id} did not report a nonempty selection after Select all`);
    const full = await selected(id);
    if (text) assert.equal(full, text);
    else {
      assert.match(full, /^첫 문단 Select across lines 👋/u);
      assert.match(full, /Second paragraph — שלום · 강조 😊/u);
      assert.match(full, /세 번째 문단\nA second line about selection 🚀/u);
    }
    const expanded = await glyphPoint(page, target);
    if (id === 'material-readonly') {
      const fixed = await point(target, 24);
      const boxes = await page.evaluate(
        (value) => window.readSelectionEditorGeometry(value)?.selectionBoxes,
        text,
      );
      const onRange = ({ x, y }) =>
        boxes.some(([a, b]) => x >= a.x && x <= b.x && y >= a.y && y <= b.y);
      assert.ok(onRange(expanded), 'The re-click must be on the editable paragraph selection');
      console.log(
        JSON.stringify({
          readOnlyGlyph: { fixed, fixedInsideSelection: onRange(fixed), point: expanded },
        }),
      );
    }
    await secondary(expanded);
    await until(
      () => menu(page, 'Copy').isVisible(),
      `${id} lost Copy after clicking selected glyph at ${expanded.x},${expanded.y}`,
    );
    assert.equal(await selected(id), full, `${id} changed the selection on an inside click`);
    await checkCopy(full);
  }

  const paragraph = surface('paragraph-selection');
  const nextParagraph = surface('paragraph-second');
  const begin = await glyphPoint(page, paragraph, 14);
  const end = await glyphPoint(page, nextParagraph, 55);
  await page.mouse.move(begin.x, begin.y);
  await page.mouse.down();
  await page.mouse.move(begin.x + 32, begin.y, { steps: 4 });
  await page.mouse.move(end.x, end.y, { steps: 8 });
  await page.mouse.up();
  const partial = await selected('paragraph-selection');
  assert.match(
    partial ?? '',
    /Select across lines 👋Second/u,
    'Dragging must select content from both paragraphs',
  );
  await secondary(await glyphPoint(page, paragraph, 55));
  await menu(page, 'Copy').waitFor();
  assert.equal(await selected('paragraph-selection'), partial);
  await page.keyboard.press('Escape');
  const outside = await paragraph.boundingBox();
  await secondary({ x: outside.x + outside.width - 12, y: begin.y });
  await menu(page, 'Select all').waitFor();
  assert.equal(
    await menu(page, 'Copy').count(),
    0,
    'Clicking outside the selected text should clear Copy',
  );
  await page.keyboard.press('Escape');

  await secondary(await revealWithWheel(page, surface('no-region-menu')));
  assert.equal(await menu(page, 'Copy').count(), 0);
  assert.equal(await menu(page, 'Select all').count(), 0);

  const form = await revealWithWheel(page, field(page, 'Text form field'));
  await secondary(form);
  await menu(page, 'Select all').waitFor();
  await page.keyboard.press('Escape');
  const search = await revealWithWheel(page, field(page, 'Cupertino search'));
  await secondary(search);
  await page.getByRole('button', { name: /^Select all$/i }).waitFor();
  await page.keyboard.press('Escape');

  const rtl = await revealWithWheel(page, field(page, 'Local theme and RTL'));
  await secondary(rtl);
  await menu(page, '문장 선택').waitFor();
  await menu(page, '전체 선택').waitFor();
  const custom = await menu(page, '문장 선택').boundingBox();
  assert.ok(
    custom.x >= 0 && Math.abs(custom.x - rtl.x) <= 80,
    'Nested overlay anchor must stay near the pointer',
  );
  await page.keyboard.press('Escape');
  const legacy = await revealWithWheel(page, field(page, 'Legacy selection menu'));
  await secondary(legacy);
  await menu(page, 'Select all').waitFor();
  await page.keyboard.press('Escape');
  const spell = field(page, 'Spell check suggestions');
  await revealWithWheel(page, spell);
  await tap(await glyphPoint(page, spell, 27));
  await menu(page, 'the').waitFor();
  await tap(await point(menu(page, 'the')));
  await until(
    async () => (await readEditor(page))?.text === 'Fix the word',
    'Spell check must replace the marked word',
  );
  console.log(
    JSON.stringify({
      readOnly: 'PASS',
      password: 'PASS',
      disabledSelection: 'PASS',
      readOnlySelections: 'PASS',
      formSearch: 'PASS',
      koreanRtlNestedOverlay: 'PASS',
      legacy: 'PASS',
      spellCheck: 'PASS',
    }),
  );
}

async function checkClipboardRaces(page, tap, secondary, first) {
  await page.evaluate(() => {
    const clipboard = navigator.clipboard;
    const permissions = navigator.permissions;
    const read = clipboard.readText.bind(clipboard);
    const write = clipboard.writeText.bind(clipboard);
    const query = permissions.query.bind(permissions);
    const probe = (window.selectionClipboard = {
      reads: 0,
      permission: 'denied',
      delay: false,
      deniedWrites: 0,
      rejectWrite: false,
      restore() {
        clipboard.readText = read;
        clipboard.writeText = write;
        permissions.query = query;
      },
    });
    permissions.query = (request) =>
      request.name === 'clipboard-read'
        ? Promise.resolve({ state: probe.permission })
        : query(request);
    clipboard.readText = () => {
      ++probe.reads;
      if (probe.delay)
        return new Promise((resolve) => {
          probe.finishRead = resolve;
        });
      return read();
    };
    clipboard.writeText = (text) => {
      if (!probe.rejectWrite) return write(text);
      ++probe.deniedWrites;
      return Promise.reject(new DOMException('Test clipboard write denied', 'NotAllowedError'));
    };
  });
  try {
    await page.keyboard.press('Shift+F10');
    await menu(page, 'Paste').waitFor();
    await until(() => menu(page, 'Paste').isDisabled(), 'Denied clipboard must disable Paste');
    assert.equal(await page.evaluate(() => window.selectionClipboard.reads), 0);
    await page.keyboard.press('Escape');
    await page.evaluate(() => {
      window.selectionClipboard.permission = 'prompt';
    });
    await page.keyboard.press('ContextMenu');
    await menu(page, 'Paste').waitFor();
    assert.equal(await menu(page, 'Paste').isEnabled(), true);
    assert.equal(await page.evaluate(() => window.selectionClipboard.reads), 0);
    await page.evaluate(() => {
      window.selectionClipboard.delay = true;
    });
    await tap(await point(menu(page, 'Paste')));
    await until(
      () => page.evaluate(() => !!window.selectionClipboard.finishRead),
      'Paste click must initiate reading',
    );
    await page.keyboard.press('Escape');
    await page.evaluate(() => {
      window.selectionClipboard.finishRead('늦게 도착한 데이터');
      window.selectionClipboard.delay = false;
    });
    await wait(250);
    assert.equal((await readEditor(page)).text, '');

    await tap(first);
    await page.keyboard.press('Control+a');
    await secondary(first);
    await menu(page, 'Cut').waitFor();
    const original = await readEditor(page);
    await page.evaluate(() => {
      window.selectionClipboard.rejectWrite = true;
    });
    await tap(await point(menu(page, 'Cut')));
    await until(
      () => page.evaluate(() => window.selectionClipboard.deniedWrites === 1),
      'Cut should attempt one clipboard write',
    );
    assert.deepEqual(
      await readEditor(page),
      original,
      'Denied Cut must preserve the text and range',
    );
    await page.keyboard.press('Escape');
  } finally {
    await page.evaluate(() => window.selectionClipboard.restore());
  }
  console.log(
    JSON.stringify({ clipboardPreflight: 'PASS', stalePaste: 'PASS', deniedCut: 'PASS' }),
  );
}

async function raster(page, before, during, at, fieldBox, dpr, statusBar) {
  return page.evaluate(
    async ({ before, during, at, fieldBox, dpr, statusBar }) => {
      const decode = async (source) => {
        const bytes = Uint8Array.from(atob(source), (character) => character.charCodeAt(0));
        const bitmap = await createImageBitmap(new Blob([bytes], { type: 'image/png' }));
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(bitmap.width / dpr);
        canvas.height = Math.round(bitmap.height / dpr);
        const context = canvas.getContext('2d');
        context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
        bitmap.close();
        return {
          width: canvas.width,
          height: canvas.height,
          rgba: context.getImageData(0, 0, canvas.width, canvas.height).data,
        };
      };
      const a = await decode(before),
        b = await decode(during);
      const dark = (image, x, y) => {
        if (x < 0 || x >= image.width || y < 0 || y >= image.height) return false;
        const offset = (Math.round(y) * image.width + Math.round(x)) * 4;
        return image.rgba[offset] + image.rgba[offset + 1] + image.rgba[offset + 2] < 340;
      };
      let best = { score: 0, changes: 0, zoomedInk: 0 };
      // Android WebView may shift its visual viewport by the status-bar inset as the IME opens.
      for (const screenTop of new Set([0, statusBar])) {
        for (let y = Math.round(at.y) - 9; y <= at.y + 9; y++) {
          if (y + screenTop < fieldBox.y || y + screenTop > fieldBox.y + fieldBox.height) continue;
          for (let shiftX = -2; shiftX <= 2; shiftX++)
            for (let shiftY = -5; shiftY <= 5; shiftY++) {
              const cx = at.x + shiftX,
                cy = y + screenTop - 41 + shiftY;
              let agreement = 0,
                sourceInk = 0,
                zoomedInk = 0,
                changes = 0;
              for (let dy = -12; dy <= 12; dy++)
                for (let dx = -30; dx <= 30; dx++) {
                  if ((dx / 31) ** 2 + (dy / 13) ** 2 > 1) continue;
                  const source = dark(b, at.x + dx / 1.25, y + screenTop + dy / 1.25);
                  const lens = dark(b, cx + dx, cy + dy);
                  sourceInk += Number(source);
                  zoomedInk += Number(lens);
                  changes += Number(lens !== dark(a, cx + dx, cy + dy));
                  agreement += Number(source && lens);
                }
              const score = (2 * agreement) / Math.max(1, sourceInk + zoomedInk);
              if (score > best.score)
                best = { score, changes, zoomedInk, center: [cx, cy], screenTop };
            }
        }
      }
      return best;
    },
    {
      before: before.toString('base64'),
      during: during.toString('base64'),
      at,
      fieldBox,
      dpr,
      statusBar,
    },
  );
}

async function checkInsertionHandle(page, id) {
  const { endpoints, caret } = await page.evaluate(
    (name) => window.readSelectionEditorGeometry(name),
    id,
  );
  assert.equal(endpoints.length, 1, 'A collapsed selection must have one endpoint');
  const [topLeft, bottomRight] = caret;
  const dx = endpoints[0].x - (topLeft.x + bottomRight.x) / 2;
  const dy = endpoints[0].y - bottomRight.y;
  assert.ok(Math.abs(dx) < 1e-5, `${id} insertion handle must center over the caret (dx=${dx})`);
  assert.ok(Math.abs(dy) < 1e-5, `${id} insertion handle must stay at the caret bottom (dy=${dy})`);
  return { dx, dy, direction: endpoints[0].direction };
}

async function checkRangeHandlePixels(page, dpr, id, visible = [true, true]) {
  const cupertino = id.startsWith('w6-cupertino');
  const grips = await page.evaluate(({ id, cupertino }) => {
    const { endpoints } = window.readSelectionEditorGeometry(id);
    const canvas = document.querySelector('canvas').getBoundingClientRect();
    return endpoints.map(({ x, y, direction, lineHeight }, index) => {
      const left = (index === 0) === (direction === 'ltr');
      const point = { x: canvas.x + x, y: canvas.y + y };
      if (cupertino) return { x: point.x, y: point.y + (left ? -lineHeight - 4.5 : 4.5) };
      return { x: point.x + (left ? -11 : 11), y: point.y + 11 };
    });
  }, { id, cupertino });
  assert.equal(grips.length, 2, `${id} must have two handle anchors`);
  const frame = (await adb('exec-out', 'screencap', '-p')).toString('base64');
  const pixels = await page.evaluate(
    async ({ frame, grips, dpr, cupertino }) => {
      const bytes = Uint8Array.from(atob(frame), (character) => character.charCodeAt(0));
      const bitmap = await createImageBitmap(new Blob([bytes], { type: 'image/png' }));
      const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
      const context = canvas.getContext('2d');
      context.drawImage(bitmap, 0, 0);
      bitmap.close();
      const size = Math.round(8 * dpr);
      return grips.map(({ x, y }) => {
        const { data } = context.getImageData(
          Math.round(x * dpr - size / 2),
          Math.round(y * dpr - size / 2),
          size,
          size,
        );
        let ink = 0;
        for (let i = 0; i < data.length; i += 4) {
          const r = data[i],
            g = data[i + 1],
            b = data[i + 2];
          // Cupertino uses system blue and Material uses the Demo's purple primary color.
          const handle = cupertino
            ? b > 185 && b > g + 28 && b > r + 70 && r < 180
            : b > r + 18 && r > g + 8 && r < 170;
          if (handle) ink++;
        }
        return ink;
      });
    },
    { frame, grips, dpr, cupertino },
  );
  const minimumInk = (cupertino ? 32 : 12) * dpr * dpr;
  assert.deepEqual(
    pixels.map((count) => count > minimumInk),
    visible,
    `${id} handle pixels (${pixels.join(', ')}) must match viewport visibility`,
  );
  return pixels;
}

async function emulator(page) {
  const cdp = await page.context().newCDPSession(page);
  const touch = (type, at) =>
    cdp.send('Input.dispatchTouchEvent', {
      type,
      touchPoints: at ? [{ ...at, id: 1 }] : [],
    });
  try {
    await page.addInitScript(installSelectionProbes);
    await page.addInitScript(() => {
      window.nelyxDemoFrameProbe = (read) => (window.readSelectionFrames = () => read().frames);
    });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await verifyBundle(page);
    const tap = async (at) => {
      await touch('touchStart', at);
      await touch('touchEnd');
    };
    await openSelection(page, tap);
    const dpr = await page.evaluate(() => devicePixelRatio);
    if (multilineHandlesOnly) {
      await androidSelectionDetails(page, touch, tap, dpr);
      return;
    }
    const display = (await adb('shell', 'dumpsys', 'window', 'displays')).toString();
    const statusBar = Math.round(
      Number(/ITYPE_STATUS_BAR frame=\[0,0\]\[\d+,(\d+)\]/u.exec(display)?.[1] ?? 0) / dpr,
    );
    const editor = field(page, 'Material single line');
    const firstPoint = await point(editor, 35);
    const firstPixels = [firstPoint.x, firstPoint.y].map((value) =>
      String(Math.round(value * dpr)),
    );
    const viewport = () =>
      page.evaluate(() => {
        const canvas = document.querySelector('canvas').getBoundingClientRect();
        return { height: innerHeight, canvasTop: canvas.y, canvasHeight: canvas.height };
      });
    const viewportBeforeHold = await viewport();
    const firstHold = adb('shell', 'input', 'swipe', ...firstPixels, ...firstPixels, '1600');
    try {
      await until(
        () => page.evaluate(() => window.readSelectionMagnifiers().material?.shown),
        'The first hold must show a lens before opening the keyboard',
      );
      await wait(250);
      assert.deepEqual(await viewport(), viewportBeforeHold);
      assert.equal(await menu(page, 'Copy').count(), 0);
    } finally {
      await firstHold;
    }
    await menu(page, 'Copy').waitFor();
    await wait(350);
    const firstHoldHandlePixels = await checkRangeHandlePixels(page, dpr, 'w6-material');
    const doubleTapPoint = await point(editor, 48);
    await tap(doubleTapPoint);
    await wait(95);
    await tap(doubleTapPoint);
    await menu(page, 'Copy').waitFor();
    const doubleTap = await readEditor(page);
    assert.ok(doubleTap?.end > doubleTap?.start, 'Two Android taps must select a word');
    await wait(350);
    const rangeHandlePixels = await checkRangeHandlePixels(page, dpr, 'w6-material');
    await tap(await point(editor, 28));
    await until(
      async () => (await readEditor(page))?.carrier,
      'The field must be focused before the pixel sample',
    );
    await wait(550);
    const insertionHandle = await checkInsertionHandle(page, 'w6-material');
    const grip = await page.evaluate(() => {
      const point = window.readSelectionEditorGeometry('w6-material').endpoints[0];
      const rect = document.querySelector('canvas').getBoundingClientRect();
      return { x: point.x + rect.x, y: point.y + rect.y + 15 };
    });
    await tap(grip);
    await menu(page, 'Select all').waitFor();
    await tap(grip);
    await menu(page, 'Select all').waitFor({ state: 'hidden' });
    const bounds = await editor.boundingBox();
    // Hold the text beyond the insertion handle's 48 px touch area.
    const at = await point(editor, grip.x - bounds.x + 36);
    const trace = await page.evaluateHandle(() => {
      const events = [];
      const abort = new AbortController();
      for (const type of ['pointerdown', 'pointerup', 'pointercancel']) {
        document.addEventListener(
          type,
          (event) => events.push([type, event.clientX, event.clientY, event.target.tagName]),
          { capture: true, signal: abort.signal },
        );
      }
      return { events, abort };
    });
    const before = await adb('exec-out', 'screencap', '-p');
    const pixels = [at.x, at.y].map((value) => String(Math.round(value * dpr)));
    const hold = adb('shell', 'input', 'swipe', ...pixels, ...pixels, '2600');
    const during = await (async () => {
      await until(async () => {
        const value = await readEditor(page);
        return value?.end > value?.start;
      }, 'Android stationary hold never selected a word');
      assert.equal(await menu(page, 'Copy').count(), 0, 'Toolbar must wait for release');
      await until(
        () => page.evaluate(() => window.readSelectionMagnifiers().material?.shown),
        'Stationary hold must open the lens',
      );
      await wait(170);
      const info = await page.evaluate(() => window.readSelectionMagnifiers().material.info);
      const canvas = await page.locator('canvas').boundingBox();
      return {
        info,
        canvas,
        box: await editor.boundingBox(),
        png: await adb('exec-out', 'screencap', '-p'),
      };
    })()
      .finally(() => hold)
      .catch(async (error) => {
        console.error({
          at,
          dpr,
          active: await readEditor(page),
          bounds,
          lens: await page.evaluate(() => window.readSelectionMagnifiers().material),
          pointerEvents: await trace.evaluate(({ events }) => events),
        });
        throw error;
      })
      .finally(async () => {
        await trace.evaluate(({ abort }) => abort.abort());
        await trace.dispose();
      });
    const lensPoint = {
      x: during.info.globalGesturePosition.dx + during.canvas.x,
      y: (during.info.caretRect.top + during.info.caretRect.bottom) / 2 + during.canvas.y,
    };
    const ink = await raster(page, before, during.png, lensPoint, during.box, dpr, statusBar);
    console.log(JSON.stringify({ lens: ink, at, lensPoint, bounds: during.box, dpr, statusBar }));
    assert.ok(
      ink.score >= 0.35 && ink.zoomedInk >= 30 && ink.changes >= 30,
      'Stationary hold must show glyph pixels in the enlarged lens',
    );
    await menu(page, 'Copy').waitFor();
    const selected = await readEditor(page);
    assert.ok(selected.end > selected.start);
    await tap(await point(menu(page, 'Copy')));
    await menu(page, 'Copy').waitFor({ state: 'hidden' });
    await until(
      async () =>
        (await page.evaluate(() => window.__TAURI__.core.invoke('plugin:clipboard-manager|read_text'))) ===
        selected.text.slice(selected.start, selected.end),
      'Copy must write the Android OS clipboard',
    );
    await touch('touchStart', at);
    await wait(650);
    const dragged = { x: at.x + 94, y: at.y };
    await touch('touchMove', dragged);
    await until(
      async () => (await readEditor(page))?.end > selected.end,
      'Hold drag must extend the selection',
    );
    await touch('touchCancel');
    await wait(300);
    assert.equal(await menu(page, 'Copy').count(), 0);
    const readsBeforeMenu = await androidClipboardReads();
    await touch('touchStart', at);
    await wait(650);
    await touch('touchEnd');
    await menu(page, 'Copy').waitFor();
    assert.equal(await androidClipboardReads(), readsBeforeMenu, 'Mobile menu must not pre-read the clipboard');
    const beforePaste = await readEditor(page);
    await page.evaluate(() => window.__TAURI__.core.invoke('plugin:clipboard-manager|write_text', { text: '한글 👋' }));
    const expected =
      beforePaste.text.slice(0, beforePaste.start) +
      '한글 👋' +
      beforePaste.text.slice(beforePaste.end);
    await menu(page, 'Paste').waitFor();
    await tap(await point(menu(page, 'Paste')));
    await until(
      async () => (await readEditor(page))?.text === expected,
      'Android menu paste must read the OS clipboard',
    );
    assert.equal(await androidClipboardReads(), readsBeforeMenu + 1, 'Explicit Paste reads once');
    await menu(page, 'Paste').waitFor({ state: 'hidden' });
    await adb('shell', 'input', 'keyevent', 'KEYCODE_BACK');
    await wait(300);
    const cupertino = field(page, 'Cupertino single line');
    await touch('touchStart', await point(cupertino, 20));
    await until(
      () =>
        page.evaluate(
          () => window.readSelectionEditorGeometry('w6-cupertino')?.endpoints.length === 2,
        ),
      'Cupertino hold must select text before the editor receives native focus',
    );
    assert.equal(await menu(page, 'Copy').count(), 0);
    await wait(220);
    const cupertinoHoldingPixels = await checkRangeHandlePixels(page, dpr, 'w6-cupertino');
    await touch('touchEnd');
    await menu(page, 'Copy').waitFor();
    await until(
      () =>
        page.evaluate(
          () => document.activeElement?.getAttribute('aria-label') === 'Cupertino single line',
        ),
      'Cupertino release must focus the editor',
    );
    await wait(350);
    const cupertinoReleasedPixels = await checkRangeHandlePixels(page, dpr, 'w6-cupertino');
    await recoverRenderer(page);
    await touch('touchStart', await point(cupertino, 20));
    await wait(650);
    await until(
      () =>
        menu(page, 'Copy')
          .count()
          .then((count) => count === 0),
      'Recovered view must admit a fresh selection gesture',
    );
    await touch('touchEnd');
    await menu(page, 'Copy').waitFor();
    await wait(220);
    const cupertinoRecoveredPixels = await checkRangeHandlePixels(page, dpr, 'w6-cupertino');
    await touch('touchStart', await point(cupertino, 170));
    await until(
      () => page.evaluate(() => {
        const endpoints = window.readSelectionEditorGeometry('w6-cupertino')?.endpoints;
        return endpoints?.length === 2 && endpoints.every(({ direction }) => direction === 'rtl');
      }),
      'Cupertino hold must select the RTL word',
    );
    await touch('touchEnd');
    await menu(page, 'Copy').waitFor();
    await wait(220);
    const cupertinoRtlPixels = await checkRangeHandlePixels(page, dpr, 'w6-cupertino');
    const rtlWord = await readEditor(page);
    assert.equal(rtlWord?.text.slice(rtlWord.start, rtlWord.end), 'שלום');
    const rtlBounds = await page.evaluate(() => {
      const { selectionBoxes } = window.readSelectionEditorGeometry('w6-cupertino');
      const [topLeft, bottomRight] = selectionBoxes.at(-1);
      const canvas = document.querySelector('canvas').getBoundingClientRect();
      return {
        left: canvas.x + topLeft.x,
        width: bottomRight.x - topLeft.x,
        y: canvas.y + (topLeft.y + bottomRight.y) / 2,
      };
    });
    await touch('touchStart', await point(cupertino, 20));
    await until(async () => {
      const editor = await readEditor(page);
      return editor?.start === 0 && editor.end > 0 && editor.end < rtlWord.start;
    }, 'Cupertino hold must first select an LTR word');
    for (const fraction of [0.25, 0.75]) {
      await touch('touchMove', { x: rtlBounds.left + rtlBounds.width * fraction, y: rtlBounds.y });
      await page.evaluate(
        () => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done))),
      );
      const editor = await readEditor(page);
      assert.deepEqual(
        [editor?.start, editor?.end],
        [0, rtlWord.end],
        'Hold drag must include the entire RTL word',
      );
    }
    await touch('touchEnd');
    await menu(page, 'Copy').waitFor();
    assert.equal((await readEditor(page))?.end, rtlWord.end);
    console.log(
      JSON.stringify({
        host: 'Android Tauri',
        device,
        buildId: manifest.buildId,
        carrier: selected.carrier,
        stationaryHold: 'PASS',
        firstHoldMenu: 'PASS',
        firstHoldHandlePixels,
        doubleTapMenu: 'PASS',
        insertionHandleMenu: 'PASS',
        rangeHandlePixels,
        insertionHandle,
        cancelRetry: 'PASS',
        cupertinoHandlePixels: {
          holding: cupertinoHoldingPixels,
          released: cupertinoReleasedPixels,
          recovered: cupertinoRecoveredPixels,
          rtl: cupertinoRtlPixels,
        },
        cupertinoBidirectionalHold: 'PASS',
        osClipboard: 'PASS',
        gpuRecovery: 'PASS',
      }),
    );
    await androidSelectionDetails(page, touch, tap, dpr);
  } finally {
    await touch('touchCancel').catch(() => {});
    await cdp.detach();
  }
}

async function checkAndroidDevices(page) {
  const cdp = await page.context().newCDPSession(page);
  try {
    await verifyBundle(page);
    const permissions = (await adb('shell', 'dumpsys', 'package', appId)).toString();
    assert.match(permissions, /android\.permission\.VIBRATE: granted=true/);
    const features = await page.evaluate(() =>
      window.__TAURI__.core.invoke('plugin:nelyx-backend|describe'),
    );
    assert.deepEqual(
      [features.os, features.frontendBuildId, features.haptics, features.androidBack, features.safeArea],
      ['android', manifest.buildId, true, true, true],
    );
    const expanded = await androidDevicePlugins(page, permissions, features);
    const tap = async (at) => {
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [at] });
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    };
    const root = page.locator('[data-semantics-identifier="open-drawer"]');
    const route = field(page, 'Material single line');
    const drawer = button(page, 'Text selection');
    await root.waitFor({ timeout: 45_000 });
    const display = (await adb('shell', 'wm', 'size')).toString();
    const [, width, height] = [...display.matchAll(/size: (\d+)x(\d+)/g)].at(-1) ?? [];
    assert(width && height, 'Android display size is required for a system gesture');
    assert.equal((await adb('shell', 'settings', 'get', 'secure', 'navigation_mode')).toString().trim(), '2');
    const y = String(Math.round(Number(height) * 0.5));
    const foreground = async () => {
      const state = (await adb('shell', 'dumpsys', 'activity', 'activities')).toString();
      return /(?:topResumedActivity|mResumedActivity)[^\n]*dev\.nelyx\.demo\.tauri/.test(state);
    };
    const backInputs = [
      () => adb('shell', 'input', 'keyevent', 'KEYCODE_BACK'),
      () => adb('shell', 'input', 'swipe', '1', y, String(Math.round(Number(width) * 0.26)), y, '260'),
    ];
    for (const back of backInputs) {
      await tap(await point(root));
      await drawer.waitFor();
      await back();
      await drawer.waitFor({ state: 'hidden' });
      await root.waitFor();
      assert.equal(await foreground(), true);

      await openSelection(page, tap);
      await back();
      await route.waitFor({ state: 'hidden' });
      await root.waitFor();
      assert.equal(await foreground(), true);

      await page.evaluate(() => history.pushState(null, '', '#device-back-check'));
      await back();
      await page.waitForFunction(() => location.hash === '');
      assert.equal(await foreground(), true);

      await back();
      await until(async () => !(await foreground()), 'Root Back must return control to Android');
      await adb('shell', 'am', 'start', '-n', appId + '/.MainActivity');
      await root.waitFor();
      await until(foreground, 'Demo must resume after Android Back');
    }
    await page.evaluate(async () => {
      const { invoke } = window.__TAURI__.core;
      await invoke('plugin:haptics|vibrate', { duration: 50 });
      for (const style of ['light', 'medium', 'heavy'])
        await invoke('plugin:haptics|impact_feedback', { style });
      await invoke('plugin:haptics|selection_feedback');
      for (const type of ['success', 'warning', 'error'])
        await invoke('plugin:haptics|notification_feedback', { type });
    });
    await page.evaluate(() => window.__TAURI__.core.invoke('plugin:nelyx-backend|dispatch_default_back'));
    await until(async () => !(await foreground()), 'Native dispatch must perform Android Back');
    await adb('shell', 'am', 'start', '-n', appId + '/.MainActivity');
    await until(foreground, 'Demo must resume after native dispatch');
    const insets = await page.evaluate(async () => {
      const { invoke, Channel } = window.__TAURI__.core;
      const channel = new Channel();
      const subscription = 'device-check-' + crypto.randomUUID();
      let timer;
      const first = new Promise((resolve, reject) => {
        channel.onmessage = resolve;
        timer = setTimeout(() => reject(new Error('No native safe area snapshot')), 5_000);
      });
      try {
        const [, value] = await Promise.all([
          invoke('plugin:nelyx-backend|watch_safe_area', { subscription, onChange: channel }),
          first,
        ]);
        return value;
      } finally {
        clearTimeout(timer);
        await invoke('plugin:nelyx-backend|unwatch_safe_area', { subscription });
        window.__TAURI_INTERNALS__.unregisterCallback(channel.id);
      }
    });
    for (const edge of ['top', 'right', 'bottom', 'left'])
      assert.ok(Number.isInteger(insets[edge]) && insets[edge] >= 0);
    assert.ok(insets.top > 0, 'The Android status bar must contribute an inset');
    await page.reload({ waitUntil: 'domcontentloaded' });
    await root.waitFor({ timeout: 45_000 });
    console.log(JSON.stringify({
      buildId: manifest.buildId,
      androidBack: ['button', 'edge-gesture'],
      routes: ['drawer', 'text-selection', 'history', 'activity-root', 'native-dispatch'],
      nativeSafeArea: insets,
      hapticIpc: 8,
      expanded,
    }));
  } finally {
    await cdp.detach();
  }
}

async function androidDevicePlugins(page, permissions, features) {
  const settings = JSON.parse(await readFile(join(app, 'package.json'), 'utf8'));
  const { deviceServices, label } = settings.nelyx.targets.tauri.windows[0];
  assert.equal(label, 'main');
  assert.deepEqual(features.deviceServices, deviceServices);
  const startupLinks = await page.evaluate(() => window.__TAURI__.core.invoke('plugin:deep-link|get_current'));
  assert.ok(startupLinks.some((link) => new URL(link).hostname === new URL(androidStartupLink).hostname));
  for (const name of ['CAMERA', 'NFC', 'ACCESS_FINE_LOCATION', 'ACCESS_COARSE_LOCATION', 'POST_NOTIFICATIONS'])
    assert.match(permissions, new RegExp('android\\.permission\\.' + name + '\\b'));
  const checks = await page.evaluate(async () => {
    const { invoke } = window.__TAURI__.core;
    const state = await invoke('plugin:notification|is_permission_granted');
    const location = await invoke('plugin:geolocation|check_permissions')
      .catch((error) => ({ error: String(error) }));
    const { camera } = await invoke('plugin:barcode-scanner|check_permissions');
    const { available: nfc } = await invoke('plugin:nfc|is_available');
    const { isAvailable: biometrics } = await invoke('plugin:biometric|status');
    const key = 'nelyx-check-' + crypto.randomUUID();
    const store = (operation, value) => invoke('plugin:nelyx-backend|device_store', {
      input: { operation, key, ...(operation === 'set' ? { value } : {}) },
    });
    let record;
    try {
      await store('set', { device: 'android' });
      record = await store('get');
    } finally {
      await store('remove');
    }
    window.nelyxDeviceLinks = [];
    window.stopNelyxDeviceLinks = await window.__TAURI__.event.listen('deep-link://new-url', (event) => {
      window.nelyxDeviceLinks.push(...event.payload);
    });
    return { state, location, camera, nfc, biometrics, record };
  });
  try {
    const url = 'nelyx-demo://device-check';
    const launch = await adb('shell', 'am', 'start', '-W', '-a', 'android.intent.action.VIEW', '-d', url, '-p', appId);
    assert.doesNotMatch(launch.toString(), /Error:/);
    await page.waitForFunction((url) => window.nelyxDeviceLinks.some((value) => value.replace(/\/$/, '') === url), url);
    const current = await page.evaluate(() => window.__TAURI__.core.invoke('plugin:deep-link|get_current'));
    assert.ok(current.some((value) => value.replace(/\/$/, '') === url));
  } finally {
    await page.evaluate(() => window.stopNelyxDeviceLinks()).catch(() => {});
  }
  assert.ok(checks.state === null || typeof checks.state === 'boolean');
  assert.ok(checks.location.location || /location.*(?:disabled|unavailable)/i.test(checks.location.error));
  assert.match(checks.camera, /^(?:prompt(?:-with-rationale)?|granted|denied)$/);
  assert.equal(typeof checks.nfc, 'boolean');
  assert.equal(typeof checks.biometrics, 'boolean');
  assert.deepEqual(checks.record, { found: true, value: { device: 'android' } });
  return { notificationPermission: checks.state, cameraPermission: checks.camera, nfc: checks.nfc,
    biometrics: checks.biometrics, store: 'PASS', deepLink: 'PASS' };
}

async function androidSelectionDetails(page, touch, tap, dpr) {
  const geometry = (id) =>
    page.evaluate((name) => {
      const render = window.readSelectionEditorGeometry(name);
      if (!render) return null;
      const { x, y } = document.querySelector('canvas').getBoundingClientRect();
      const client = (point) => ({ ...point, x: point.x + x, y: point.y + y });
      return {
        ...render,
        corners: render.corners.map(client),
        endpoints: render.endpoints.map(client),
        visible: {
          left: render.visible.left + x,
          top: render.visible.top + y,
          right: render.visible.right + x,
          bottom: render.visible.bottom + y,
        },
      };
    }, id);
  const lenses = () => page.evaluate(() => window.readSelectionMagnifiers());
  const lens = async (id) => (await lenses())[id];
  const expectLens = async (id) => {
    let sample;
    await until(async () => {
      sample = await lenses();
      return sample[id]?.shown;
    }, id + ' must show a magnifier');
    const active = Object.values(sample).filter(({ exists }) => exists);
    assert.equal(active.length, 1, 'The selection gesture must own one lens entry');
    return sample[id].info;
  };
  const expectClosed = () =>
    until(
      async () => Object.values(await lenses()).every(({ exists }) => !exists),
      'The lens entry must be retired',
    );
  const selected = (id) => page.evaluate((name) => window.readOnlySelections[name], id);
  const surface = (id) => page.locator('[data-semantics-identifier="w6-' + id + '"]');
  const hideKeyboard = async () => {
    if (/\bmInputShown=true\b/.test((await adb('shell', 'dumpsys', 'input_method')).toString())) {
      await adb('shell', 'input', 'keyevent', 'KEYCODE_BACK');
      await wait(300);
    }
  };
  const reveal = async (target) => {
    await hideKeyboard();
    let visibleY;
    await until(async () => {
      const { width, top, bottom } = await page.evaluate(() => {
        const { y, bottom } = document.querySelector('canvas').getBoundingClientRect();
        const viewportTop = visualViewport?.offsetTop ?? 0;
        return {
          width: innerWidth,
          top: Math.max(y, viewportTop),
          bottom: Math.min(bottom, viewportTop + (visualViewport?.height ?? innerHeight)),
        };
      });
      const box = (await target.count()) > 0 ? await target.boundingBox({ timeout: 1_500 }) : null;
      if (box && box.y >= top + 66 && box.y + box.height < bottom - 12) {
        // The scrollable consumes the first touch while it is still flinging.
        if (visibleY === box.y) return true;
        visibleY = box.y;
        return false;
      }
      visibleY = undefined;
      const down = !box || box.y >= top + 66;
      const x = Math.round((width - 12) * dpr);
      const ys = [0.72, 0.43].map((ratio) => Math.round((top + (bottom - top) * ratio) * dpr));
      await adb(
        'shell',
        'input',
        'swipe',
        String(x),
        String(ys[down ? 0 : 1]),
        String(x),
        String(ys[down ? 1 : 0]),
        '360',
      );
      return false;
    }, 'Android selection target must come into view');
  };
  const hold = async (at, id) => {
    await touch('touchStart', at);
    return expectLens(id);
  };
  if (multilineHandlesOnly) {
    const fadeWait = 250;
    const results = {};
    for (const [id, label] of [
      ['multiline', 'Material multiline'],
      ['cupertino-multiline', 'Cupertino multiline'],
    ]) {
      const name = 'w6-' + id;
      const target = field(page, label);
      await reveal(target);
      await tap(await point(target, 42));
      await wait(400);
      const scroll = async (amount) => {
        const { corners: [top, bottom] } = await geometry(name);
        const x = bottom.x - 24;
        const y = amount > 0 ? bottom.y - 8 : top.y + 8;
        const dragStart = y - Math.sign(amount) * 26;
        await touch('touchStart', { x, y });
        await touch('touchMove', { x, y: dragStart });
        await wait(45);
        await touch('touchMove', { x, y: dragStart - amount });
        await wait(180);
        await touch('touchEnd');
      };
      const viewportVisibility = ({ corners: [top, bottom], endpoints }) =>
        endpoints.map(({ y }) => y >= top.y && y <= bottom.y);
      results[id] = {};
      for (const edge of ['start', 'end']) {
        const clipStart = edge === 'start';
        if (!clipStart) {
          const { corners: [top, bottom] } = await geometry(name);
          await scroll((bottom.y - top.y) * 0.46);
        }
        const { corners: [top, bottom] } = await geometry(name);
        const start = { x: top.x + 42, y: top.y + 12 };
        await hold(start, id);
        await touch('touchMove', {
          x: start.x + 66,
          y: clipStart ? start.y + 24 : bottom.y - 12,
        });
        await touch('touchEnd');
        await expectClosed();
        await menu(page, 'Copy').waitFor();
        await page.keyboard.press('Escape');
        await menu(page, 'Copy').waitFor({ state: 'hidden' });
        let initial = await geometry(name);
        if (!clipStart && initial.endpoints[1].y > initial.corners[1].y) {
          await scroll(initial.endpoints[1].y - initial.corners[1].y + 8);
          initial = await geometry(name);
        }
        const [first, last] = initial.endpoints;
        assert.ok(last.y > first.y + 8, `${label} must select across two lines`);
        assert.deepEqual(viewportVisibility(initial), [true, true], `${label} before clipping ${edge}`);
        const selection = await readEditor(page);
        assert.ok(selection?.end > selection?.start, `${label} must retain a text selection`);
        await wait(fadeWait);
        const before = await checkRangeHandlePixels(page, dpr, name);

        await scroll(
          clipStart ? first.y - initial.corners[0].y + 8 : last.y - initial.corners[1].y - 8,
        );
        const clipped = await geometry(name);
        const visible = [!clipStart, clipStart];
        assert.notEqual(clipped.scroll.y, initial.scroll.y, `${label} must scroll internally`);
        assert.deepEqual(
          viewportVisibility(clipped),
          visible,
          `${label} must clip the ${edge} handle`,
        );
        await wait(fadeWait);
        const hidden = await checkRangeHandlePixels(page, dpr, name, visible);

        await scroll(initial.scroll.y - clipped.scroll.y + (clipStart ? -5 : 5));
        const restored = await geometry(name);
        assert.deepEqual(
          viewportVisibility(restored),
          [true, true],
          `${label} must restore the ${edge} handle (offsets ${initial.scroll.y}, ${clipped.scroll.y}, ${restored.scroll.y})`,
        );
        await wait(fadeWait);
        const after = await checkRangeHandlePixels(page, dpr, name);
        assert.deepEqual(await readEditor(page), selection);
        results[id][edge] = { before, hidden, after };
      }
    }
    console.log(
      JSON.stringify({ device, buildId: manifest.buildId, multilineHandlePixels: results }),
    );
    return;
  }
  const handleGrip = ({ x, y, direction }, start) => ({
    x: x + ((direction === 'ltr') === start ? -9 : 9),
    y: y + 10,
  });

  const multiline = field(page, 'Material multiline');
  await reveal(multiline);
  const start = await point(multiline, 47);
  await hold(start, 'multiline');
  await touch('touchEnd');
  await menu(page, 'Copy').waitFor();
  const firstSelection = await readEditor(page);
  assert.ok(firstSelection?.end > firstSelection?.start);
  const initial = await geometry('w6-multiline');
  assert.equal(initial.endpoints.length, 2);
  await page.keyboard.press('Escape');
  await menu(page, 'Copy').waitFor({ state: 'hidden' });
  for (const [index, reverse] of [
    [0, 1],
    [1, -1],
  ]) {
    const current = await geometry('w6-multiline');
    const grip = handleGrip(current.endpoints[index], index === 0);
    const opposite = current.endpoints[1 - index];
    await touch('touchStart', grip);
    await touch('touchMove', { x: grip.x + 25, y: grip.y });
    await expectLens('multiline');
    await touch('touchMove', { x: Math.max(8, opposite.x + reverse * 45), y: grip.y });
    assert.ok((await expectLens('multiline')).caretRect);
    const retained = await readEditor(page);
    assert.ok(
      retained.end > retained.start,
      'The Android handle must retain an ordered range at the opposite end',
    );
    await touch('touchEnd');
    await expectClosed();
    await menu(page, 'Copy').waitFor();
  }

  const beforeScroll = await geometry('w6-multiline');
  const end = handleGrip(beforeScroll.endpoints[1], false);
  const edge = {
    x: Math.min(beforeScroll.corners[1].x - 8, end.x + 50),
    y: beforeScroll.corners[1].y + 12,
  };
  await touch('touchStart', end);
  await touch('touchMove', { x: end.x + 25, y: end.y });
  await expectLens('multiline');
  await touch('touchMove', edge);
  const canvasTop = (await page.locator('canvas').boundingBox()).y;
  await until(async () => {
    const position = (await lens('multiline'))?.info.globalGesturePosition;
    return position && Math.abs(position.dy + canvasTop - edge.y) < 1;
  }, 'The lens must follow the last pointer position before measuring stationary scrolling');
  const beforeLine = await expectLens('multiline');
  await until(
    async () => (await geometry('w6-multiline'))?.scroll.y > beforeScroll.scroll.y + 10,
    'Holding the end handle at the editor edge must scroll its content',
  ).catch(async (error) => {
    console.error({
      beforeScroll,
      edge,
      current: await geometry('w6-multiline'),
      lens: await lens('multiline'),
    });
    throw error;
  });
  const scrolled = await lens('multiline');
  assert.ok(scrolled?.exists);
  assert.equal(scrolled.info.globalGesturePosition.dy, beforeLine.globalGesturePosition.dy);
  const afterScroll = await readEditor(page);
  assert.ok(
    afterScroll.end > firstSelection.end,
    'The stationary gesture must extend into the scrolled text',
  );
  await touch('touchCancel');
  await expectClosed();
  assert.equal(await menu(page, 'Copy').count(), 0);
  const settledOffset = (await geometry('w6-multiline')).scroll.y;
  await wait(220);
  assert.equal((await geometry('w6-multiline')).scroll.y, settledOffset);

  await hideKeyboard();
  const canvas = await page.locator('canvas').boundingBox();
  const back = await button(page, 'Back').boundingBox();
  const viewportTop = 2 * back.y + back.height - canvas.y;
  const adjustList = (deltaY) =>
    page.evaluate(
      ({ x, y, deltaY }) => {
        document.querySelector('canvas').dispatchEvent(
          new WheelEvent('wheel', { clientX: x, clientY: y, deltaY, cancelable: true }),
        );
      },
      { x: canvas.x + canvas.width - 12, y: viewportTop + 100, deltaY },
    );
  await until(async () => {
    const current = await geometry('w6-multiline');
    if (!current) {
      await adjustList(-32);
      return false;
    }
    const cropped = current.visible.top - current.corners[0].y;
    if (cropped > 8 && current.visible.bottom - current.visible.top > 20) return true;
    const delta = cropped > 0 ? 24 - cropped : Math.max(12, current.corners[0].y - viewportTop + 24);
    await adjustList(Math.max(-40, Math.min(40, delta)));
    return false;
  }, 'The gallery viewport must partially clip the multiline field');
  const clipped = await geometry('w6-multiline');
  const parentDrag = {
    x: clipped.visible.left + 42,
    y: (clipped.visible.top + clipped.visible.bottom) / 2,
  };
  await hold(parentDrag, 'multiline').catch(async (error) => {
    console.error({
      clipped,
      parentDrag,
      current: await geometry('w6-multiline'),
      active: await readEditor(page),
    });
    throw error;
  });
  const parentEdge = { x: parentDrag.x, y: clipped.visible.top - 6 };
  await touch('touchMove', parentEdge);
  await until(
    async () => (await geometry('w6-multiline'))?.corners[0].y > clipped.corners[0].y + 8,
    'The list must scroll while the touch is stationary outside its viewport',
  );
  const parentLens = await expectLens('multiline');
  assert.ok(Math.abs(parentLens.globalGesturePosition.dy + canvas.y - parentEdge.y) < 1);
  assert.ok(parentLens.currentLineBoundaries.top >= parentLens.fieldBounds.top);
  await touch('touchCancel');
  await expectClosed();
  const parentStopped = (await geometry('w6-multiline')).corners[0].y;
  await wait(220);
  assert.equal((await geometry('w6-multiline')).corners[0].y, parentStopped);

  const cupertino = field(page, 'Cupertino multiline');
  await reveal(cupertino);
  await tap(await point(cupertino, 40));
  await wait(450);
  const cupertinoStart = (await geometry('w6-cupertino-multiline')).corners[0];
  const cupertinoAt = { x: cupertinoStart.x + 42, y: cupertinoStart.y + 11 };
  const cupertinoLine = await hold(cupertinoAt, 'cupertino-multiline');
  await touch('touchMove', { x: cupertinoAt.x + 65, y: cupertinoAt.y + 24 });
  await until(
    async () =>
      (await lens('cupertino-multiline')).info.caretRect.top !== cupertinoLine.caretRect.top,
    'The Cupertino lens must move onto the next line',
  );
  await touch('touchEnd');
  await expectClosed();
  await menu(page, 'Copy').waitFor();
  const cupertinoMultilinePixels = await checkRangeHandlePixels(page, dpr, 'w6-cupertino-multiline');
  const cupertinoRange = await geometry('w6-cupertino-multiline');
  assert.ok(
    cupertinoRange.endpoints[1].y > cupertinoRange.endpoints[0].y,
    'The Cupertino range must span two lines',
  );

  const checkNoLens = async (id, label) => {
    const target = field(page, label);
    await reveal(target);
    await touch('touchStart', await point(target, 25));
    await wait(820);
    await expectClosed();
    const probe = await lens(id);
    if (id === 'null-lens')
      assert.equal(probe?.requests, 1, 'A null builder runs once per gesture');
    else assert.equal(probe, undefined, id + ' should bypass the lens builder');
    await touch('touchCancel');
  };
  await checkNoLens('password', 'Password field');

  for (const id of ['material-readonly', 'core-readonly', 'paragraph-selection']) {
    const target = surface(id);
    await reveal(target);
    const at = await point(target, 29);
    const initialLine = await hold(at, id);
    await until(() => selected(id), id + ' must select text during the hold');
    if (id === 'paragraph-selection') {
      const next = await point(surface('paragraph-second'), 65);
      await touch('touchMove', next);
      await until(
        async () => (await selected(id))?.includes('Second'),
        'The region must select across paragraphs',
      );
      const line = (await expectLens(id)).currentLineBoundaries;
      assert.ok(
        line.top > initialLine.currentLineBoundaries.top,
        'The region lens must follow the active paragraph',
      );
    } else {
      const word = await selected(id);
      await touch('touchMove', { x: at.x + 85, y: at.y });
      await until(
        async () => (await selected(id))?.length > word.length,
        id + ' must extend the selection',
      );
    }
    await touch('touchEnd');
    await expectClosed();
    await menu(page, 'Copy').waitFor();
  }

  const rtl = field(page, 'Local theme and RTL');
  await reveal(rtl);
  const rtlBounds = await rtl.boundingBox();
  await tap(await point(rtl, rtlBounds.width - 30));
  await until(
    () =>
      page.evaluate(
        () => document.activeElement?.getAttribute('aria-label') === 'Local theme and RTL',
      ),
    'The RTL field must be focused before checking its insertion handle',
  );
  const rtlInsertionHandle = await checkInsertionHandle(page, 'w6-rtl');
  assert.equal(rtlInsertionHandle.direction, 'rtl');

  for (const [id, label] of [
    ['no-lens', 'Magnifier disabled'],
    ['null-lens', 'Custom magnifier returns null'],
  ]) {
    await checkNoLens(id, label);
  }
  await hideKeyboard();
  await tap(await point(button(page, 'Back')));
  await field(page, 'Custom magnifier returns null').waitFor({ state: 'hidden' });
  await expectClosed();
  await wait(500);
  await page.evaluate(() => window.readSelectionFrames());
  await wait(230);
  const settled = await page.evaluate(() => window.readSelectionFrames().samples.length);
  assert.equal(settled, 0, 'The selection route must stop requesting frames after teardown');
  console.log(
    JSON.stringify({
      handleDrags: 'PASS',
      innerScroll: { before: beforeScroll.scroll.y, stopped: settledOffset },
      parentScroll: { before: clipped.corners[0].y, stopped: parentStopped },
      materialCupertinoLines: 'PASS',
      cupertinoMultilinePixels,
      rtlInsertionHandle,
      readOnlyLenses: 'PASS',
      regionLine: 'PASS',
      disabledAndNullLenses: 'PASS',
      framesAfterRoute: settled,
    }),
  );
}

async function recoverRenderer(page) {
  await page.evaluate(async () => {
    const canvas = document.querySelector('canvas');
    const gl = canvas.getContext('webgl2');
    const extension = gl.getExtension('WEBGL_lose_context');
    if (!extension) throw new Error('No WebGL context-loss extension');
    const contextEvent = (type) =>
      new Promise((resolve, reject) => {
        const abort = AbortSignal.timeout(5000);
        abort.addEventListener('abort', () => reject(new Error('Timed out waiting for ' + type)), {
          once: true,
        });
        canvas.addEventListener(type, resolve, { signal: abort, once: true });
      });
    const lost = contextEvent('webglcontextlost');
    extension.loseContext();
    await lost;
    // WebView commits preventDefault after the event dispatch returns.
    await new Promise((resolve) => setTimeout(resolve, 0));
    const restored = contextEvent('webglcontextrestored');
    extension.restoreContext();
    await restored;
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  });
  await field(page, 'Cupertino single line').waitFor();
}

async function observeAndroidGestures(page) {
  const cdp = await page.context().newCDPSession(page);
  const tap = async (at) => {
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [{ ...at, id: 1 }],
    });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  };
  try {
    await page.addInitScript(installSelectionProbes);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await verifyBundle(page);
    await openSelection(page, tap);
    await page.evaluate(() => {
      const connected = new WeakSet();
      const abort = new AbortController();
      const { signal } = abort;
      window.stopSelectionPhysicalProbe = () => abort.abort();
      const state = (window.selectionPhysical = {
        touch: { pointerdown: 0, pointermove: 0, pointerup: 0, pointercancel: 0 },
        compositionStarted: 0,
        compositionEnded: 0,
        menuOpenedDuringComposition: false,
        carriers: [],
        active: false,
        koreanPasteInEmptyField: false,
      });
      for (const type of Object.keys(state.touch)) {
        document.addEventListener(
          type,
          (event) => {
            if (event.isTrusted && event.pointerType === 'touch') state.touch[type]++;
          },
          { capture: true, signal },
        );
      }
      const start = () => {
        state.compositionStarted++;
        state.active = true;
      };
      const end = () => {
        state.compositionEnded++;
        state.active = false;
      };
      document.addEventListener('compositionstart', start, { capture: true, signal });
      document.addEventListener('compositionend', end, { capture: true, signal });
      document.addEventListener(
        'focusin',
        (event) => {
          const input = event.target;
          if (!input.editContext && !input.dataset.nelyxInputCarrier) return;
          const carrier = input.editContext ? 'EditContext' : input.tagName;
          if (!state.carriers.includes(carrier)) state.carriers.push(carrier);
          const context = input.editContext;
          if (!context || connected.has(context)) return;
          connected.add(context);
          context.addEventListener('compositionstart', start, { signal });
          context.addEventListener('compositionend', end, { signal });
        },
        { signal },
      );
    });
    console.log(
      JSON.stringify({
        host: 'Physical Android Tauri',
        device,
        buildId: manifest.buildId,
        readyForPhysicalTouch: true,
      }),
    );
    const lines = new Set();
    let last,
      maxScroll = 0;
    const requests = new Map();
    // This route ends when the person testing it uses the app's Back button.
    const deadline = Date.now() + 480_000;
    while (Date.now() < deadline) {
      const sample = await page.evaluate(() => {
        const lenses = window.readSelectionMagnifiers();
        const editor = window.readSelectionEditorGeometry('w6-multiline');
        const state = window.selectionPhysical;
        const toolbar = [...document.querySelectorAll('button[aria-label]')].some(
          (button) =>
            ['Copy', 'Cut', 'Paste'].includes(button.getAttribute('aria-label')) &&
            button.getBoundingClientRect().width > 0,
        );
        if (state.active && toolbar) state.menuOpenedDuringComposition = true;
        const empty = document.querySelector('[aria-label="Empty field"]');
        if ((empty?.editContext?.text ?? empty?.value ?? '') === '안녕하세요')
          state.koreanPasteInEmptyField = true;
        return { state, lenses, scroll: editor?.scroll.y ?? 0 };
      });
      last = sample.state;
      for (const [id, lens] of Object.entries(sample.lenses)) {
        if (!lens.exists) continue;
        requests.set(id, lens.requests);
        if (id === 'multiline') {
          lines.add(Math.round(lens.info.caretRect.top));
          maxScroll = Math.max(maxScroll, sample.scroll);
        }
      }
      if (last.touch.pointerdown > 0 && !(await field(page, 'Material multiline').count())) break;
      await wait(160);
    }
    const copiedKorean = await page.evaluate(() =>
      window.__TAURI__.core.invoke('plugin:clipboard-manager|read_text').then(
        (text) => text === '안녕하세요',
        () => false,
      ),
    );
    console.log(
      JSON.stringify({
        host: 'Physical Android Tauri',
        device,
        buildId: manifest.buildId,
        touches: last?.touch,
        carriers: last?.carriers,
        lensRequests: Object.fromEntries(requests),
        observedLineYs: [...lines],
        maxInnerScroll: maxScroll,
        compositionStarted: last?.compositionStarted,
        compositionEnded: last?.compositionEnded,
        menuOpenedDuringComposition: last?.menuOpenedDuringComposition,
        copiedKorean,
        koreanPasteInEmptyField: last?.koreanPasteInEmptyField,
      }),
    );
    assert.ok(last?.touch.pointerdown > 0, 'No physical touch reached this installed Galaxy build');
  } finally {
    await page.evaluate(() => window.stopSelectionPhysicalProbe?.()).catch(() => {});
    await cdp.detach();
  }
}

let browser, runner, forward, windowsProfile, chromePid;
try {
  let page;
  if (android) {
    assert.ok(process.env.ANDROID_HOME, 'Set ANDROID_HOME and install the verified Demo APK first');
    await adb('shell', 'am', 'force-stop', appId);
    if (androidDevices) {
      const launch = await adb('shell', 'am', 'start', '-W', '-a', 'android.intent.action.VIEW', '-d', androidStartupLink, '-p', appId);
      assert.doesNotMatch(launch.toString(), /Error:/);
    } else {
      await adb('shell', 'am', 'start', '-n', appId + '/.MainActivity');
    }
    let pid;
    await until(async () => {
      pid = (await adb('shell', 'pidof', appId).catch(() => Buffer.alloc(0))).toString().trim();
      return /^\d+$/.test(pid);
    }, 'Waiting for the emulator Demo process');
    assert.match(pid, /^\d+$/);
    forward = (await adb('forward', 'tcp:0', 'localabstract:webview_devtools_remote_' + pid))
      .toString()
      .trim();
    const endpoint = 'http://127.0.0.1:' + forward;
    await until(async () => {
      try {
        return (
          await fetch(endpoint + '/json/list', { signal: AbortSignal.timeout(1000) }).then(
            (response) => response.json(),
          )
        ).some((target) => target.type === 'page');
      } catch {
        return false;
      }
    }, 'Waiting for the emulator WebView DevTools endpoint');
    browser = await chromium.connectOverCDP(endpoint, { timeout: 20_000, noDefaults: true });
    page = browser.contexts()[0]?.pages()[0];
    assert.ok(page, 'No Demo WebView page');
  } else if (windows) {
    assert.equal(process.platform, 'win32');
    const packaged = join(app, '.nelyx', 'tauri', 'windows-x64');
    assert.equal(
      JSON.parse(await readFile(join(packaged, 'package.json'), 'utf8')).frontendBuildId,
      manifest.buildId,
    );
    const reservation = createServer().listen(0, '127.0.0.1');
    await once(reservation, 'listening');
    const { port } = reservation.address();
    await new Promise((resolve) => reservation.close(resolve));
    const endpoint = 'http://127.0.0.1:' + port;
    windowsProfile = await mkdtemp(join(tmpdir(), 'nelyx-windows-selection-'));
    runner = startOwnedCommand(join(packaged, 'nelyx-tauri.exe'), [], {
      cwd: packaged,
      isolateWindows: true,
      windowsHide: false,
      env: {
        ...process.env,
        WEBVIEW2_USER_DATA_FOLDER: windowsProfile,
        WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS: `--remote-debugging-port=${port} --force-renderer-accessibility`,
      },
    });
    await until(async () => {
      const response = await fetch(endpoint + '/json/list', {
        signal: AbortSignal.timeout(1000),
      }).catch(() => null);
      return (
        response?.ok &&
        (await response.json()).some(({ url }) => url.startsWith('https://tauri.localhost/'))
      );
    }, 'Waiting for the Windows WebView2 endpoint');
    browser = await chromium.connectOverCDP(endpoint, { timeout: 20_000, noDefaults: true });
    await until(() => {
      page = browser.contexts().flatMap((context) => context.pages())
        .find((target) => target.url().startsWith('https://tauri.localhost/'));
      return page;
    }, 'No Demo WebView2 page');
  } else {
    const url = 'http://127.0.0.1:4189/demo/';
    runner = startOwnedCommand(process.execPath, [
      join(app, 'node_modules', '@nelyx', 'cli', 'src', 'main.mjs'),
      'run',
      '--target',
      'web',
      '--app',
      app,
      '--base',
      '/demo/',
      '--port',
      '4189',
    ]);
    await until(
      async () =>
        fetch(url + 'build.json').then(
          (response) => response.ok,
          () => false,
        ),
      'PWA preview failed to start',
    );
    browser = await chromium.launch({
      channel: 'chrome',
      headless: !headed,
      args: headed ? ['--force-renderer-accessibility', '--lang=en-US'] : [],
    });
    page = await browser.newPage(mobileWeb ? {
      viewport: { width: 393, height: 850 },
      isMobile: true,
      hasTouch: true,
      userAgent: 'Mozilla/5.0 (Linux; Android 13; Pixel 5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36',
    } : { viewport: { width: 1100, height: 900 } });
    if (headed && process.platform === 'win32') {
      const cdp = await browser.newBrowserCDPSession();
      const { processInfo } = await cdp.send('SystemInfo.getProcessInfo');
      chromePid = processInfo.find(({ type }) => type === 'browser')?.id;
      assert.ok(chromePid, 'The headed Chrome process must own a window');
      await windowsInput(chromePid, 'focus');
      await cdp.detach();
    }
    page.selectionTestUrl = url;
  }
  page.setDefaultTimeout(12_000);
  const errors = [];
  page.on('pageerror', (error) => {
    errors.push(error.message);
    console.error(error);
  });
  page.on('console', (message) => {
    if (message.type() === 'error' && !message.location().url.endsWith('/favicon.ico')) {
      errors.push(message.text());
      console.error(message.text());
    }
  });
  if (observePhysical) await observeAndroidGestures(page);
  else if (androidDevices) await checkAndroidDevices(page);
  else if (android) await emulator(page);
  else if (windows) {
    await verifyBundle(page);
    await windowsSelection(page, runner.pid);
  } else if (mobileWeb) await checkMobileWebClipboard(page, page.selectionTestUrl);
  else await web(page, page.selectionTestUrl, chromePid);
  assert.deepEqual(errors, []);
} finally {
  try {
    await browser?.close();
    if (forward) await adb('forward', '--remove', 'tcp:' + forward);
  } finally {
    await runner?.stop();
    if (windowsProfile)
      await rm(windowsProfile, { recursive: true, force: true, maxRetries: 10, retryDelay: 350 });
  }
}
