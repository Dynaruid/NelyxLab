// SPDX-License-Identifier: BSD-3-Clause
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import { once } from 'node:events';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { promisify } from 'node:util';
import { chromium } from 'playwright';
import { mediaType } from '@nelyx/vite/content';
import { execute, startOwnedCommand } from '../../../Nelyx/sdk/tooling/cli/src/commands.mjs';
import { removeDirectory } from '../../../Nelyx/sdk/tooling/cli/src/publication.mjs';

const args = process.argv.slice(2);
if (!args.includes('--child')) {
  await execute(process.execPath, [import.meta.filename, ...args, '--child'], {
    timeout: 1_200_000,
  });
  process.exit(0);
}

const app = path.resolve(import.meta.dirname, '..');
const workspace = path.resolve(app, '../..');
const windows = args.includes('--windows');
const android = args.includes('--android');
const testbed = args.includes('--testbed');
const release = path.join(
  testbed ? path.resolve(app, '../nelyx-testbed-app-2') : app,
  '.nelyx',
  windows || android ? 'tauri/frontend' : 'web',
);
const readJson = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));
const build = readJson(path.join(release, 'build.json'));
const appId = 'dev.nelyx.demo.tauri';
const signal = AbortSignal.timeout(1_190_000);
const button = (page, name) => page.getByRole('button', { name, exact: true });
const textbox = (page, name) => page.getByRole('textbox', { name, exact: true });
const input = (page, endpoint) => page.locator('[data-semantics-identifier="' + endpoint + '"]');
const root = (page, locale, direction = 'ltr') =>
  page
    .locator('html[lang="' + locale + '"][dir="' + direction + '"]')
    .waitFor({ state: 'attached' });

async function tap(page, locator) {
  await locator.waitFor();
  const bounds = await locator.boundingBox();
  assert(bounds && bounds.width > 0 && bounds.height > 0, 'Expected an on-screen control');
  await page.mouse.click(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
}

function readEditor(page) {
  return page.evaluate(() => {
    const element = document.activeElement;
    const edit = element?.editContext;
    if (!edit && !['INPUT', 'TEXTAREA'].includes(element?.tagName)) return null;
    return {
      value: edit?.text ?? element.value,
      start: edit?.selectionStart ?? element.selectionStart,
      end: edit?.selectionEnd ?? element.selectionEnd,
      lang: element.lang,
      direction: element.dir,
      carrier: edit ? 'EditContext' : element.tagName,
      retained: element === window.localeTestEditor,
    };
  });
}

async function waitForValue(page, value) {
  await page.waitForFunction((expected) => {
    const editor = document.activeElement;
    return (editor?.editContext?.text ?? editor?.value) === expected;
  }, value);
}

async function platformLanguages(page, locales) {
  await page.evaluate((preferred) => {
    Object.defineProperty(navigator, 'languages', { configurable: true, value: preferred });
    window.dispatchEvent(new Event('languagechange'));
  }, locales);
}

async function openScreen(page) {
  await root(page, 'en');
  await tap(page, input(page, 'open-drawer'));
  await tap(page, button(page, 'Language and dates'));
  await button(page, 'Choose a date').waitFor();
}

async function verifyComposition(page) {
  const cdp = await page.context().newCDPSession(page);
  const base = 'Nelyx 한글 العربية';
  try {
    await page.keyboard.press('End');
    await page.evaluate(() => {
      const editor = document.activeElement;
      const target = editor.editContext ?? editor;
      window.localeTestComposition = { active: false, starts: 0, ends: 0 };
      target.addEventListener('compositionstart', () => {
        window.localeTestComposition.active = true;
        window.localeTestComposition.starts++;
      });
      target.addEventListener('compositionend', () => {
        window.localeTestComposition.active = false;
        window.localeTestComposition.ends++;
      });
    });
    await cdp.send('Input.imeSetComposition', { text: '한', selectionStart: 1, selectionEnd: 1 });
    await waitForValue(page, base + '한');
    const before = await readEditor(page);
    await platformLanguages(page, ['en-US']);
    await root(page, 'en-US');
    await page.waitForFunction(() => document.activeElement.lang === 'en-US');
    assert.deepEqual(await readEditor(page), { ...before, lang: 'en-US' });
    assert.deepEqual(await page.evaluate(() => window.localeTestComposition), {
      active: true,
      starts: 1,
      ends: 0,
    });
    await cdp.send('Input.insertText', { text: '한글' });
    await waitForValue(page, base + '한글');
    assert.deepEqual(await page.evaluate(() => window.localeTestComposition), {
      active: false,
      starts: 1,
      ends: 1,
    });
    await platformLanguages(page, ['ko-KR']);
    await root(page, 'ko-KR');
  } finally {
    await cdp.detach();
  }
}

async function verifyPage(page, mobile) {
  page.setDefaultTimeout(12_000);
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await openScreen(page);
  await tap(page, button(page, '한국어'));
  await root(page, 'ko-KR');
  await button(page, '날짜 범위 선택').waitFor();
  assert.equal(await textbox(page, 'Sample text').getAttribute('lang'), 'ko-KR');
  assert.equal(await textbox(page, '날짜 입력').getAttribute('dir'), 'ltr');

  await tap(page, button(page, '영어 날짜 대화상자'));
  await button(page, 'Cancel').and(page.locator('[lang="en-US"]')).waitFor();
  await root(page, 'ko-KR');
  await tap(page, button(page, 'Cancel'));
  await button(page, 'Cancel').waitFor({ state: 'detached' });

  await platformLanguages(page, ['en-US']);
  await root(page, 'ko-KR');
  await tap(page, button(page, 'System'));
  await root(page, 'en-US');
  await tap(page, textbox(page, 'Sample text'));
  await waitForValue(page, 'Nelyx 한글 العربية');
  await page.keyboard.press('Control+a');
  await page.evaluate(() => {
    window.localeTestEditor = document.activeElement;
  });
  const before = await readEditor(page);
  assert.equal(before.lang, 'en-US');
  await platformLanguages(page, ['ko-KR', 'en-US']);
  await root(page, 'ko-KR');
  await textbox(page, 'Sample text').and(page.locator('[lang="ko-KR"]')).waitFor();
  assert.deepEqual(await readEditor(page), { ...before, lang: 'ko-KR' });

  if (mobile) {
    assert.deepEqual(errors, []);
    return {
      carrier: before.carrier,
      platformEvents: 'injected',
      scope: 'mobile editor and explicit date dialog',
    };
  }

  await verifyComposition(page);
  await tap(page, textbox(page, '날짜 입력'));
  await page.keyboard.press('Control+a');
  await page.keyboard.insertText('2024. 2.');
  await waitForValue(page, '2024. 2.');
  await page.evaluate(() => {
    window.localeTestEditor = document.activeElement;
  });
  const editing = await readEditor(page);
  await platformLanguages(page, ['en-US']);
  await root(page, 'en-US');
  await textbox(page, 'Enter Date').and(page.locator('[lang="en-US"]')).waitFor();
  assert.deepEqual(await readEditor(page), { ...editing, lang: 'en-US' });
  await page.keyboard.insertText(' 29.');
  await waitForValue(page, '2024. 2. 29.');
  await page.keyboard.press('Enter');
  await page.waitForFunction(() =>
    [...document.querySelectorAll('[aria-label="Enter Date"]')].some(
      (node) =>
        (node.editContext?.text ?? node.value ?? node.getAttribute('aria-valuetext')) ===
        '02/29/2024',
    ),
  );
  await page.locator('[lang="en-US"][aria-label*="Thursday, February 29, 2024"]').first().waitFor();

  await tap(page, button(page, 'Choose a date'));
  const nextMonth = button(page, 'Next month').or(
    page.locator('button[aria-description="Next month"]'),
  );
  await tap(page, nextMonth);
  await page.locator('[aria-label*="March 2024"]').first().waitFor();
  await platformLanguages(page, ['ko-KR']);
  await root(page, 'ko-KR');
  await page.locator('[lang="ko-KR"][aria-label*="2024년 3월"]').first().waitFor();
  await tap(page, button(page, '취소'));
  await button(page, '취소').waitFor({ state: 'detached' });

  await tap(page, button(page, '포르투갈어 날짜 대화상자'));
  await page.locator('[lang="pt-PT"][aria-label*="Selecionar data"]').first().waitFor();
  await tap(page, button(page, 'Cancelar'));
  await button(page, 'Cancelar').waitFor({ state: 'detached' });

  await tap(page, button(page, '날짜 범위 선택'));
  await tap(
    page,
    button(page, '입력 모드로 전환').or(
      page.locator('button[aria-description="입력 모드로 전환"]'),
    ),
  );
  await textbox(page, '시작일').focus();
  await waitForValue(page, '2024. 2. 29.');
  await page.keyboard.press('Control+a');
  await page.keyboard.insertText('2024. 2.');
  await waitForValue(page, '2024. 2.');
  await page.evaluate(() => {
    window.localeTestEditor = document.activeElement;
  });
  const rangeEdit = await readEditor(page);
  await platformLanguages(page, ['en-US']);
  await root(page, 'en-US');
  await textbox(page, 'Start Date').and(page.locator('[lang="en-US"]')).waitFor();
  assert.deepEqual(await readEditor(page), { ...rangeEdit, lang: 'en-US' });
  await page.keyboard.insertText(' 29.');
  await waitForValue(page, '2024. 2. 29.');
  await tap(page, button(page, 'OK'));
  await textbox(page, 'Start Date').waitFor({ state: 'detached' });

  await tap(page, button(page, 'Arabic range dialog'));
  await button(page, 'الحفظ').and(page.locator('[lang="ar-EG"][dir="rtl"]')).waitFor();
  await root(page, 'en-US');
  await page.keyboard.press('Escape');
  await button(page, 'الحفظ').waitFor({ state: 'detached' });
  await textbox(page, 'Sample text').and(page.locator('[lang="en-US"][dir="ltr"]')).waitFor();
  assert.deepEqual(errors, []);
  return {
    carrier: before.carrier,
    platformEvents: 'injected',
    composition: 'CDP',
    scope: 'date dialogs, independent date input, edit session and semantics',
  };
}

async function verifyTestbed(page) {
  page.setDefaultTimeout(12_000);
  await root(page, 'ko-KR');
  const activate = async (locator) => {
    await locator.waitFor();
    await locator.evaluate((element) => element.click());
  };
  const seek = async (locator, step = 180) => {
    await page.mouse.move(1244, 700);
    for (let i = 0; i < 16 && !(await locator.isVisible()); i++) {
      await page.mouse.wheel(0, step);
      await locator.waitFor({ timeout: 500 }).catch(() => {});
    }
    await locator.waitFor();
  };
  await activate(button(page, 'Cupertino'));
  await button(page, 'Material 3').waitFor();
  await activate(button(page, 'Selection'));
  await page.locator('[aria-label="7개 섹션 · 스크롤하여 탐색"]').waitFor();
  const wheel = (value) =>
    page.getByRole('slider').and(page.locator('[aria-valuetext="' + value + '"]'));
  const timer = wheel('15 초');
  await seek(timer);
  assert.equal(await timer.getAttribute('lang'), 'ko-KR');
  await timer.focus();
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(resolve)));
  await page.keyboard.press('ArrowUp');
  await wheel('30 초').waitFor();
  const minute = wheel('30분');
  await seek(minute);
  await minute.focus();
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(resolve)));
  await page.keyboard.press('ArrowUp');
  await page.locator('[aria-label="Date: 2024-02-29 09:35"]').waitFor();

  await activate(button(page, 'Material 3'));
  await button(page, 'Cupertino').waitFor();
  await activate(button(page, 'Selection'));
  const chooseDate = page.getByRole('button', { name: /^Choose date/ });
  await seek(chooseDate);
  const original = await chooseDate.getAttribute('aria-label');
  await tap(page, chooseDate);
  await button(page, '취소').and(page.locator('[lang="ko-KR"]')).waitFor();
  await tap(page, button(page, '취소'));
  await button(page, '취소').waitFor({ state: 'detached' });
  assert.equal(await chooseDate.getAttribute('aria-label'), original);

  const chooseTime = page.getByRole('button', { name: /^Choose time/ });
  await seek(chooseTime);
  await tap(page, chooseTime);
  const dial = page.getByRole('dialog', { name: '시간 선택' });
  await dial.waitFor();
  await tap(
    page,
    dial
      .getByRole('button', { name: '텍스트 입력 모드로 전환' })
      .or(dial.locator('button[aria-description="텍스트 입력 모드로 전환"]'))
      .first(),
  );
  const fields = page.getByRole('dialog', { name: '시간 입력' });
  for (const [name, value] of [
    ['시간', '11'],
    ['분', '45'],
  ]) {
    await tap(page, fields.getByRole('textbox', { name, exact: true }));
    await page.keyboard.press('Control+a');
    await page.keyboard.insertText(value);
  }
  await tap(page, fields.getByRole('radio', { name: '오후', exact: true }));
  await tap(page, fields.getByRole('button', { name: '확인', exact: true }));
  await page.getByRole('note', { name: /Time: 23:45$/ }).waitFor();
}

function staticResponse(base, relative, response) {
  let file = path.resolve(base, relative);
  if (
    !file.startsWith(base + path.sep) ||
    !fs.statSync(file, { throwIfNoEntry: false })?.isFile()
  ) {
    response.writeHead(404).end();
    return;
  }
  response.setHeader('Content-Type', mediaType(file));
  fs.createReadStream(file)
    .on('error', () => response.destroy())
    .pipe(response);
}

async function webServer() {
  const packages = {
    core: 'Nelyx',
    sdk: 'Nelyx/sdk',
    material: 'packages/material',
    cupertino: 'packages/cupertino',
  };
  const imports = {};
  for (const [name, folder] of Object.entries(packages)) {
    const exports = readJson(path.join(workspace, folder, 'package.json')).exports;
    for (const [key, target] of Object.entries(exports))
      if (target?.default?.startsWith('./dist/') && target.default.endsWith('.js'))
        imports['@nelyx/' + name + key.slice(1)] = '/__w6/' + name + target.default.slice(1);
  }
  imports['@material/material-color-utilities'] = '/__w6/colors/index.js';
  const server = http.createServer((request, response) => {
    const route = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    response.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
    response.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
    if (route === '/__w6/contracts') {
      response.setHeader('Content-Type', 'text/html; charset=utf-8');
      response.end(
        '<!doctype html><html lang="en"><body><script type="importmap">' +
          JSON.stringify({ imports }) +
          '</script></body></html>',
      );
      return;
    }
    if (route === '/__w6/fixture.mjs') {
      staticResponse(path.join(workspace, 'Nelyx/eng/fixtures'), 'w6-localizations.mjs', response);
      return;
    }
    if (route === '/__w6/arb-schema.mjs') {
      staticResponse(
        path.join(workspace, 'tools/Nelyx.FrameworkToTypeScript'),
        'flutter-localization-arb.mjs',
        response,
      );
      return;
    }
    if (route.startsWith('/__w6/colors/')) {
      staticResponse(
        path.join(workspace, 'node_modules/@material/material-color-utilities'),
        route.slice('/__w6/colors/'.length),
        response,
      );
      return;
    }
    const match = /^\/__w6\/(\w+)\/(dist\/.+)$/.exec(route);
    if (match && Object.hasOwn(packages, match[1])) {
      staticResponse(path.join(workspace, packages[match[1]]), match[2], response);
      return;
    }
    if (route === '/favicon.ico') {
      response.writeHead(204).end();
      return;
    }
    staticResponse(release, route === '/' ? 'index.html' : '.' + route, response);
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  return { server, url: 'http://127.0.0.1:' + server.address().port };
}

async function connectPreview(port, expected) {
  const url = 'http://127.0.0.1:' + port;
  for (let attempt = 0; attempt < 30; attempt++) {
    const response = await fetch(url + '/json/list', {
      signal: AbortSignal.any([signal, AbortSignal.timeout(1000)]),
    }).catch(() => null);
    if (response?.ok && (await response.json()).some(({ url }) => expected.test(url)))
      return chromium.connectOverCDP(url, { timeout: 25_000, noDefaults: true });
    await delay(500, undefined, { signal });
  }
  throw new Error('The packaged WebView did not expose its Playwright endpoint');
}

let browser, server, native, stage, androidPort, adb, windowsPackageFormat;
let androidInstalled = false;
const previousApks = [];
try {
  let page;
  if (windows) {
    const pkg = path.join(app, '.nelyx/tauri/windows-x64');
    const packaged = readJson(path.join(pkg, 'package.json'));
    assert.equal(packaged.frontendBuildId, build.buildId);
    stage = fs.mkdtempSync(path.join(os.tmpdir(), 'nelyx-w6-webview-'));
    const sevenZip = path.join(process.env.ProgramFiles ?? '', '7-Zip/7z.exe');
    const installer = packaged.artifacts.find(({ format }) => format === 'nsis');
    const binary = packaged.artifacts.find(({ format }) => format === 'exe');
    const useInstaller = installer && fs.existsSync(sevenZip);
    const artifact = useInstaller ? installer : binary;
    assert(artifact, 'Windows package is missing');
    const artifactFile = path.join(pkg, path.basename(artifact.file));
    assert.equal(
      createHash('sha256').update(fs.readFileSync(artifactFile)).digest('hex'),
      artifact.sha256,
    );
    windowsPackageFormat = artifact.format;
    let file;
    if (useInstaller) {
      await execute(sevenZip, ['e', artifactFile, '*.exe', '-o' + stage, '-y'], { signal });
      const executables = fs
        .readdirSync(stage)
        .filter((name) => name.endsWith('.exe'));
      assert.equal(executables.length, 1, 'Expected one application executable from the installer');
      file = path.join(stage, executables[0]);
    } else {
      file = path.join(stage, path.basename(artifactFile));
      fs.copyFileSync(artifactFile, file);
    }
    const reservation = net.createServer().listen(0, '127.0.0.1');
    await once(reservation, 'listening');
    const port = reservation.address().port;
    await new Promise((resolve) => reservation.close(resolve));
    native = startOwnedCommand(file, [], {
      cwd: stage,
      signal,
      isolateWindows: true,
      env: {
        ...process.env,
        WEBVIEW2_USER_DATA_FOLDER: path.join(stage, 'profile'),
        WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS: '--remote-debugging-port=' + port,
      },
    });
    browser = await connectPreview(port, /^https:\/\/tauri\.localhost\//);
    page = browser
      .contexts()[0]
      .pages()
      .find((page) => page.url().startsWith('https://tauri.localhost/'));
  } else if (android) {
    const device = process.env.ANDROID_SERIAL ?? 'emulator-5554';
    const pkg = path.join(app, '.nelyx/tauri/android-x64-debug');
    const packaged = readJson(path.join(pkg, 'package.json'));
    assert.equal(packaged.frontendBuildId, build.buildId);
    const artifact = packaged.artifacts.find(({ format }) => format === 'apk');
    assert.equal(artifact.abi, 'x86_64');
    const executable = path.join(
      process.env.ANDROID_HOME,
      'platform-tools',
      process.platform === 'win32' ? 'adb.exe' : 'adb',
    );
    adb = async (...parameters) =>
      (
        await promisify(execFile)(executable, ['-s', device, ...parameters], {
          timeout: 60_000,
          windowsHide: true,
        })
      ).stdout.trim();
    const installed = await adb('shell', 'pm', 'path', appId).catch(() => '');
    stage = fs.mkdtempSync(path.join(os.tmpdir(), 'nelyx-w6-android-'));
    for (const [index, line] of installed
      .split(/\r?\n/)
      .filter((line) => line.startsWith('package:'))
      .entries()) {
      const backup = path.join(stage, 'previous-' + index + '.apk');
      await adb('pull', line.slice('package:'.length), backup);
      previousApks.push(backup);
    }
    await adb('install', '-r', path.join(pkg, path.basename(artifact.file)));
    androidInstalled = true;
    const started = await adb('shell', 'am', 'start', '-W', '-n', appId + '/.MainActivity');
    assert.match(started, /Status: ok/);
    let pid = '';
    for (let attempt = 0; attempt < 20; attempt++) {
      pid = await adb('shell', 'pidof', appId).catch(() => '');
      if (/^\d+$/.test(pid)) break;
      await delay(250, undefined, { signal });
    }
    assert.match(pid, /^\d+$/);
    androidPort = await adb('forward', 'tcp:0', 'localabstract:webview_devtools_remote_' + pid);
    browser = await connectPreview(androidPort, /^https?:\/\/(tauri\.localhost|localhost)\//);
    page = browser
      .contexts()[0]
      .pages()
      .find((page) => /tauri\.localhost|localhost/.test(page.url()));
  } else {
    const web = await webServer();
    server = web.server;
    browser = await chromium.launch({
      channel: 'chrome',
      args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
    });
    for (const timezoneId of testbed ? [] : ['Pacific/Kiritimati', 'America/Los_Angeles']) {
      const context = await browser.newContext({ timezoneId });
      try {
        const probe = await context.newPage();
        await probe.goto(web.url + '/__w6/contracts');
        await probe.evaluate(async (full) => {
          const fixture = await import('/__w6/fixture.mjs');
          fixture.verifyFormats();
          if (full) {
            fixture.verifyArbValidation();
            await fixture.verifyTransactions();
            fixture.verifyViewBoundaries();
          }
        }, timezoneId === 'Pacific/Kiritimati');
      } finally {
        await context.close();
      }
    }
    page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    await page.goto(web.url);
    const servedBuild = await page.evaluate(() =>
      fetch('./build.json').then((response) => response.json()),
    );
    assert.equal(servedBuild.buildId, build.buildId);
  }

  if (windows || android) {
    assert(page);
    await page
      .locator(
        'html[data-nelyx-frontend-build-id="' +
          build.buildId +
          '"], html[data-tauri-frontend-build-id="' +
          build.buildId +
          '"]',
      )
      .waitFor({ state: 'attached', timeout: 25_000 });
  }
  let result;
  const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') pageErrors.push(message.text());
  });
  try {
    if (testbed) {
      await verifyTestbed(page);
      result = { scope: 'Testbed Material date and time dialogs, Cupertino date and timer wheels' };
    } else result = await verifyPage(page, android);
  } catch (error) {
    console.log('Page errors', pageErrors);
    console.log('Active editor', await readEditor(page).catch(() => null));
    console.log(
      (
        await page
          .locator('body')
          .ariaSnapshot({ timeout: 1500 })
          .catch(() => '')
      ).slice(-5000),
    );
    throw error;
  }
  console.log(
    JSON.stringify({
      host: windows ? 'windows-webview2' : android ? 'android-webview' : 'web',
      buildId: build.buildId,
      ...result,
      ...(windows ? { packageFormat: windowsPackageFormat } : {}),
      ...(android
        ? { abi: 'x86_64', userAgent: await page.evaluate(() => navigator.userAgent) }
        : {}),
    }),
  );

  if (server && !testbed) {
    const popupErrors = [];
    page.on('pageerror', (error) => popupErrors.push(error.stack ?? error.message));
    page.on('console', (message) => {
      if (message.type() === 'error') popupErrors.push(message.text());
    });
    await page.addInitScript(() => {
      window.localeDialogErrors = [];
      window.addEventListener('unhandledrejection', (event) => {
        window.localeDialogErrors.push(event.reason?.stack ?? String(event.reason));
      });
    });
    const url = new URL(page.url());
    url.searchParams.set('dialogWindows', '1');
    await page.goto(url.href);
    await openScreen(page);
    const opening = page.waitForEvent('popup');
    await tap(page, button(page, 'Arabic range dialog'));
    const popup = await opening;
    popup.on('pageerror', (error) => popupErrors.push(error.stack ?? error.message));
    await root(popup, 'ar-EG', 'rtl');
    try {
      await button(popup, 'الحفظ').and(popup.locator('[lang="ar-EG"][dir="rtl"]')).waitFor();
    } catch (error) {
      await page
        .waitForFunction(() => window.localeDialogErrors.length, undefined, { timeout: 1_000 })
        .catch(() => {});
      console.log(
        'Dialog errors',
        popupErrors,
        await page.evaluate(() => window.localeDialogErrors),
      );
      throw error;
    }
    await popup.close();
    await root(page, 'en');
    await textbox(page, 'Sample text').and(page.locator('[lang="en"]')).waitFor();
    console.log('Separate dialog language and parent language restored');
  }
} finally {
  try {
    await browser?.close();
  } finally {
    try {
      await native?.stop();
    } finally {
      try {
        if (androidPort) await adb('forward', '--remove', 'tcp:' + androidPort);
      } finally {
        if (androidInstalled) {
          if (previousApks.length === 0) await adb('uninstall', appId);
          else if (previousApks.length === 1) await adb('install', '-r', '-d', previousApks[0]);
          else await adb('install-multiple', '-r', '-d', ...previousApks);
        }
        if (stage) removeDirectory(stage, path.dirname(stage));
        if (server) await new Promise((resolve) => server.close(resolve));
      }
    }
  }
}
