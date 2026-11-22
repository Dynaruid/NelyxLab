// SPDX-License-Identifier: BSD-3-Clause
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { readFile } from 'node:fs/promises';
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
const manifest = JSON.parse(await readFile(join(app, '.nelyx', 'pwa', 'build.json'), 'utf8'));
const android = args.includes('--android');
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
  await tap(await point(drawer));
  await tap(await point(button(page, 'Text selection')));
  try {
    await field(page, 'Material single line').waitFor({ timeout: 6000 });
  } catch (error) {
    console.error(await page.locator('body').ariaSnapshot({ timeout: 4000 }));
    throw error;
  }
}

async function web(page, url) {
  await page.addInitScript(() => {
    window.selectionMenus = [];
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
  const tap = ({ x, y }) => page.mouse.click(x, y);
  const secondary = ({ x, y }) => page.mouse.click(x, y, { button: 'right' });
  await openSelection(page, tap);
  const first = await point(field(page, 'Material single line'), 44);
  await secondary(first);
  assert.equal(await menu(page, 'Select all').count(), 0);
  assert.equal(await page.evaluate(() => window.selectionMenus.at(-1)?.prevented), false);
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
    await page.evaluate(() => navigator.clipboard.writeText('한글 👋 붙여넣기'));
    await page.keyboard.press('Shift+F10');
    await menu(page, 'Paste').waitFor();
    await until(() => menu(page, 'Paste').isEnabled(), 'Text should enable keyboard Paste');
    await page.keyboard.press('Tab');
    await page.keyboard.press('Enter');
    await until(
      async () => (await readEditor(page))?.text === '한글 👋 붙여넣기',
      'Keyboard paste did not edit the field',
    );
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
  await checkPublicWidgets(page, tap, secondary);
  console.log(
    JSON.stringify({
      host: 'PWA',
      buildId: manifest.buildId,
      carrier: firstCaret.carrier,
      policy: 'PASS',
      keyboard: 'PASS',
      clipboard: 'PASS',
      undo: 'PASS',
    }),
  );
}

async function revealWithWheel(page, target) {
  const { width, height } = page.viewportSize();
  await page.mouse.move(width * 0.8, height * 0.75);
  await until(async () => {
    if (await target.isVisible()) {
      const box = await target.boundingBox();
      if (box.y >= 85 && box.y + box.height < height - 12) return true;
    }
    await page.mouse.wheel(0, 165);
    return false;
  }, 'The target was not reached in the selection demo');
  return point(target, 24);
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
  await secondary(await revealWithWheel(page, field(page, 'Selection disabled')));
  await page.keyboard.press('Shift+F10');
  assert.equal(await menu(page, 'Paste').count(), 0);

  const surface = (id) => page.locator(`[data-semantics-identifier="w6-${id}"]`);
  for (const id of ['material-readonly', 'core-readonly', 'paragraph-selection']) {
    const target = surface(id);
    const selectable = await revealWithWheel(page, target);
    await secondary(selectable);
    await menu(page, 'Select all').waitFor();
    await tap(await point(menu(page, 'Select all')));
    await menu(page, 'Select all').waitFor({ state: 'hidden' });
    await secondary(await point(target, 24));
    await until(() => menu(page, 'Copy').isVisible(), `${id} lost its selected text`);
    assert.equal(await menu(page, 'Cut').count(), 0);
    await page.keyboard.press('Escape');
  }
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
  console.log(
    JSON.stringify({
      readOnly: 'PASS',
      password: 'PASS',
      disabledSelection: 'PASS',
      readOnlySelections: 'PASS',
      formSearch: 'PASS',
      koreanRtlNestedOverlay: 'PASS',
      legacy: 'PASS',
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

async function raster(page, before, during, at, fieldBox, dpr) {
  return page.evaluate(
    async ({ before, during, at, fieldBox, dpr }) => {
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
      for (let y = Math.round(at.y) - 9; y <= at.y + 9; y++) {
        if (y < fieldBox.y || y > fieldBox.y + fieldBox.height) continue;
        for (let shiftX = -2; shiftX <= 2; shiftX++) {
          for (let shiftY = -5; shiftY <= 5; shiftY++) {
            const cx = at.x + shiftX,
              cy = y - 41 + shiftY;
            let agreement = 0,
              sourceInk = 0,
              zoomedInk = 0,
              changes = 0;
            for (let dy = -12; dy <= 12; dy++)
              for (let dx = -30; dx <= 30; dx++) {
                if ((dx / 31) ** 2 + (dy / 13) ** 2 > 1) continue;
                const source = dark(b, at.x + dx / 1.25, y + dy / 1.25);
                const lens = dark(b, cx + dx, cy + dy);
                sourceInk += Number(source);
                zoomedInk += Number(lens);
                changes += Number(lens !== dark(a, cx + dx, cy + dy));
                agreement += Number(source && lens);
              }
            const score = (2 * agreement) / Math.max(1, sourceInk + zoomedInk);
            if (score > best.score) best = { score, changes, zoomedInk, center: [cx, cy] };
          }
        }
      }
      return best;
    },
    { before: before.toString('base64'), during: during.toString('base64'), at, fieldBox, dpr },
  );
}

async function emulator(page) {
  const cdp = await page.context().newCDPSession(page);
  const dpr = await page.evaluate(() => devicePixelRatio);
  const tap = ({ x, y }) =>
    adb('shell', 'input', 'tap', String(Math.round(x * dpr)), String(Math.round(y * dpr)));
  const touch = (type, at) =>
    cdp.send('Input.dispatchTouchEvent', {
      type,
      touchPoints: at ? [{ ...at, id: 1 }] : [],
    });
  try {
    await openSelection(page, tap);
    await wait(350);
    const editor = field(page, 'Material single line');
    const at = await point(editor, 28);
    const bounds = await editor.boundingBox();
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
    const hold = adb('shell', 'input', 'swipe', ...pixels, ...pixels, '2100');
    const during = await (async () => {
      await until(async () => {
        const value = await readEditor(page);
        return value?.end > value?.start;
      }, 'Android stationary hold never selected a word');
      assert.equal(await menu(page, 'Copy').count(), 0, 'Toolbar must wait for release');
      await wait(170);
      return adb('exec-out', 'screencap', '-p');
    })()
      .finally(() => hold)
      .catch(async (error) => {
        console.error({
          at,
          dpr,
          active: await readEditor(page),
          bounds,
          pointerEvents: await trace.evaluate(({ events }) => events),
        });
        throw error;
      })
      .finally(async () => {
        await trace.evaluate(({ abort }) => abort.abort());
        await trace.dispose();
      });
    const ink = await raster(page, before, during, at, bounds, dpr);
    console.log(JSON.stringify({ lens: ink, at, bounds }));
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
        (await page.evaluate(() => window.__TAURI__?.clipboardManager?.readText())) ===
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
    await touch('touchStart', at);
    await wait(650);
    await touch('touchEnd');
    await menu(page, 'Copy').waitFor();
    const beforePaste = await readEditor(page);
    await page.evaluate(() => window.__TAURI__.clipboardManager.writeText('한글 👋'));
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
    await menu(page, 'Paste').waitFor({ state: 'hidden' });
    await adb('shell', 'input', 'keyevent', 'KEYCODE_BACK');
    await wait(300);
    const cupertino = await point(field(page, 'Cupertino single line'), 20);
    await touch('touchStart', cupertino);
    await until(async () => {
      const value = await readEditor(page);
      return (
        value?.end > value?.start &&
        (await page.evaluate(
          () => document.activeElement?.getAttribute('aria-label') === 'Cupertino single line',
        ))
      );
    }, 'Cupertino hold must select text');
    assert.equal(await menu(page, 'Copy').count(), 0);
    await touch('touchEnd');
    await menu(page, 'Copy').waitFor();
    await recoverRenderer(page);
    await touch('touchStart', cupertino);
    await until(
      () =>
        menu(page, 'Copy')
          .count()
          .then((count) => count === 0),
      'Recovered view must admit a fresh selection gesture',
    );
    await touch('touchEnd');
    await menu(page, 'Copy').waitFor();
    console.log(
      JSON.stringify({
        host: 'Android Tauri',
        device,
        buildId: manifest.buildId,
        carrier: selected.carrier,
        stationaryHold: 'PASS',
        cancelRetry: 'PASS',
        cupertinoHold: 'PASS',
        osClipboard: 'PASS',
        gpuRecovery: 'PASS',
      }),
    );
  } finally {
    await cdp.detach();
  }
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
  });
  await field(page, 'Cupertino single line').waitFor();
}

let browser, runner, forward;
try {
  let page;
  if (android) {
    assert.ok(process.env.ANDROID_HOME, 'Set ANDROID_HOME and install the verified Demo APK first');
    await adb('shell', 'am', 'force-stop', appId);
    await adb('shell', 'am', 'start', '-n', appId + '/.MainActivity');
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
  } else {
    const url = 'http://127.0.0.1:4189/demo/';
    runner = startOwnedCommand(process.execPath, [
      join(app, 'web', 'runner', 'node_modules', '@nelyx', 'cli', 'src', 'main.mjs'),
      'run',
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
    browser = await chromium.launch({ channel: 'chrome' });
    page = await browser.newPage({ viewport: { width: 1100, height: 900 } });
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
  if (android) await emulator(page);
  else await web(page, page.selectionTestUrl);
  const served = await page.evaluate(() =>
    fetch(new URL('build.json', document.baseURI)).then((response) => response.json()),
  );
  assert.equal(
    served.buildId,
    manifest.buildId,
    'The observed page must run the current product bundle',
  );
  assert.deepEqual(errors, []);
} finally {
  await browser?.close();
  if (forward) await adb('forward', '--remove', 'tcp:' + forward);
  await runner?.stop();
}
