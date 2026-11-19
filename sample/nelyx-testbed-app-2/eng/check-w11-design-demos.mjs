// SPDX-License-Identifier: BSD-3-Clause
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { once } from 'node:events';
import { chromium } from 'playwright';
import { execute } from '../../../Nelyx/sdk/tooling/cli/src/commands.mjs';

if (!process.argv.includes('--child')) {
  await execute(process.execPath, [import.meta.filename, '--child'], { timeout: 1_200_000 });
  process.exit(0);
}

const build = path.resolve(import.meta.dirname, '../.nelyx/web');
const types = new Map([
  ['.html', 'text/html; charset=utf-8'],
  ['.js', 'text/javascript'],
  ['.json', 'application/json'],
  ['.wasm', 'application/wasm'],
  ['.png', 'image/png'],
  ['.ttf', 'font/ttf'],
  ['.otf', 'font/otf'],
]);
assert(
  fs.existsSync(path.join(build, 'index.html')),
  'Build the Testbed Web Release before running the demo checks',
);
const server = http.createServer((request, response) => {
  const url = new URL(request.url, 'http://localhost');
  const pathname = decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname);
  const file = path.resolve(build, '.' + pathname);
  if (
    !file.startsWith(build + path.sep) ||
    !fs.statSync(file, { throwIfNoEntry: false })?.isFile()
  ) {
    response.writeHead(404).end();
    return;
  }
  response.setHeader('Content-Type', types.get(path.extname(file)) ?? 'application/octet-stream');
  fs.createReadStream(file)
    .on('error', () => response.destroy())
    .pipe(response);
});

let browser;
let page;
const failures = [];
try {
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  browser = await chromium.launch({
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
  });
  page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  page.setDefaultTimeout(12_000);
  page.on('pageerror', (error) => failures.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') failures.push(message.text());
  });
  await page.goto(`http://127.0.0.1:${server.address().port}/`);
  const button = (name) => page.getByRole('button', { name, exact: true });
  const selected = async (control, name) => {
    await control.locator('[aria-selected=true]').and(button(name)).waitFor();
  };
  const center = async (locator) => {
    await locator.waitFor();
    const bounds = await locator.boundingBox();
    assert(bounds && bounds.width > 0 && bounds.height > 0);
    return [bounds.x + bounds.width / 2, bounds.y + bounds.height / 2];
  };
  const clickPointer = async (locator) => page.mouse.click(...(await center(locator)));
  const wheelIntoView = async (locator, step = 240) => {
    await page.mouse.move(1244, 700);
    for (let i = 0; i < 8 && !(await locator.isVisible()); i++) {
      await page.mouse.wheel(0, step);
      await locator.waitFor({ timeout: 750 }).catch(() => {});
    }
    await locator.waitFor();
  };

  const material = page.getByRole('group', { name: 'Segmented buttons 기본 API' });
  await selected(material, 'List');
  await clickPointer(button('Grid'));
  await selected(material, 'Grid');
  await clickPointer(button('Map'));
  assert.equal(await material.locator('[aria-selected=true]').getAttribute('aria-label'), 'Grid');
  await button('List').focus();
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(resolve)));
  await page.keyboard.press('Enter');
  await selected(material, 'List');

  await clickPointer(button('Cupertino'));
  const cupertino = page.getByRole('list', { name: /Sliding segmented control/ });
  await selected(cupertino, 'Daily');
  await clickPointer(button('Weekly'));
  await selected(cupertino, 'Weekly');
  await clickPointer(button('Yearly'));
  await selected(cupertino, 'Weekly');
  assert.notEqual(await button('Yearly').getAttribute('aria-selected'), 'true');
  await page.keyboard.press('ArrowLeft');
  await selected(cupertino, 'Daily');
  await page.mouse.move(...(await center(button('Daily'))));
  await page.mouse.down();
  const [weeklyX, weeklyY] = await center(button('Weekly'));
  await page.mouse.move(weeklyX, weeklyY, { steps: 8 });
  await page.mouse.up();
  await selected(cupertino, 'Weekly');

  const borderedDay = button('Day');
  const borderedWeek = button('Week');
  await borderedDay.and(page.locator('[aria-selected=true]')).waitFor();
  await clickPointer(borderedWeek);
  await borderedWeek.and(page.locator('[aria-selected=true]')).waitFor();
  assert.equal(await button('Month').isDisabled(), true);

  await button('Selection').evaluate((element) => element.click());
  await page.locator('[aria-label="6개 섹션 · 스크롤하여 탐색"]').waitFor();
  await page.mouse.move(1244, 700);
  await page.mouse.wheel(0, 600);
  const wheel = (value) =>
    page.getByRole('slider').and(page.locator(`[aria-valuetext="${value}"]`));
  const fruit = wheel('Apple');
  await fruit.focus();
  assert.equal(await fruit.evaluate((element) => document.activeElement === element), true);
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(resolve)));
  await page.keyboard.press('ArrowDown');
  await wheel('Peach').waitFor();
  await page.locator('[aria-label="Fruit: Peach"]').waitFor();
  await page.keyboard.press('ArrowUp');
  await wheel('Apple').waitFor();

  const portion = wheel('Small');
  await portion.focus();
  await page.keyboard.press('ArrowDown');
  await portion.waitFor();
  const [portionX, portionY] = await center(portion);
  await page.mouse.click(portionX, portionY + 30);
  await wheel('Medium').waitFor();
  await page.locator('[aria-label="Portion: Medium"]').waitFor();
  await page.mouse.move(portionX, portionY);
  await page.mouse.wheel(0, 40);
  await wheel('Large').waitFor();
  await page.locator('[aria-label="Portion: Large"]').waitFor();

  await page.mouse.move(1244, 700);
  await page.mouse.wheel(0, 400);
  await wheel('1 hour').waitFor();
  await wheel('5 min.').waitFor();
  const timerSeconds = wheel('15 sec.');
  await timerSeconds.focus();
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(resolve)));
  await page.keyboard.press('ArrowUp');
  await wheel('30 sec.').waitFor();
  await page.locator('[aria-label="Timer: 3930 seconds"]').waitFor();

  await button('Text inputs').evaluate((element) => element.click());
  await page.locator('[aria-label="2개 섹션 · 스크롤하여 탐색"]').waitFor();
  await page.mouse.move(1244, 700);
  await page.mouse.wheel(0, 600);
  const search = page.getByRole('textbox', { name: '검색', exact: true });
  await search.waitFor();
  assert.equal(await page.getByRole('textbox', { name: 'Disabled search' }).isDisabled(), true);
  await clickPointer(search);
  await page.keyboard.type('wheel');
  await page.locator('[aria-label="Search changed: wheel"]').waitFor();
  await page.keyboard.press('Enter');
  await page.locator('[aria-label="Search submitted: wheel"]').waitFor();
  await clickPointer(button('삭제'));
  await page.locator('[aria-label="Search changed: (empty)"]').waitFor();
  await button('삭제').waitFor({ state: 'detached' });

  await button('Containment').evaluate((element) => element.click());
  const openSheet = button('Open action sheet');
  await wheelIntoView(openSheet);
  const showCupertinoSheet = () => openSheet.evaluate((element) => element.click());
  await showCupertinoSheet();
  const sheet = page.getByRole('dialog', { name: 'Alert', exact: true });
  await sheet.waitFor();
  const save = sheet.getByRole('button', { name: 'Save item', exact: true });
  const cancel = sheet.getByRole('button', { name: 'Cancel', exact: true });
  const [, saveY] = await center(save);
  const [, cancelY] = await center(cancel);
  assert.ok(cancelY > saveY && cancelY > page.viewportSize().height / 2);
  await clickPointer(sheet.getByRole('button', { name: 'Delete item', exact: true }));
  await page.locator('[aria-label="Action sheet: Deleted"]').waitFor();
  await sheet.waitFor({ state: 'detached' });
  await showCupertinoSheet();
  await clickPointer(cancel);
  await page.locator('[aria-label="Action sheet: Cancelled"]').waitFor();
  await sheet.waitFor({ state: 'detached' });
  await showCupertinoSheet();
  await sheet.waitFor();
  await page.mouse.click(30, 100);
  await page.locator('[aria-label="Action sheet: Dismissed"]').waitFor();
  await sheet.waitFor({ state: 'detached' });

  const refreshButton = button('Open refresh list');
  await wheelIntoView(refreshButton);
  await refreshButton.evaluate((element) => element.click());
  const refreshItems = page.getByRole('group', { name: 'Refresh items', exact: true });
  await refreshItems.waitFor();
  await page.waitForFunction(() => {
    const bounds = document.querySelector('[aria-label="Refresh items"]')?.getBoundingClientRect();
    return bounds && bounds.width > 1000 && window.innerHeight - bounds.top >= 420;
  });
  const refreshBox = await refreshItems.getByRole('list').boundingBox();
  assert.ok(refreshBox);
  const refreshX = refreshBox.x + refreshBox.width / 2;
  const refreshY = refreshBox.y + 12;
  const touch = await page.context().newCDPSession(page);
  try {
    const point = (y) => [{ x: refreshX, y }];
    await touch.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: point(refreshY),
    });
    for (let i = 1; i <= 14; i++) {
      await touch.send('Input.dispatchTouchEvent', {
        type: 'touchMove',
        touchPoints: point(refreshY + 28 * i),
      });
      await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(resolve)));
    }
    await touch.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  } finally {
    await touch.detach();
  }
  await page.locator('[aria-label="Cupertino refresh completed: 1"]').waitFor();
  await refreshItems.getByRole('list', { name: /Item 25/ }).waitFor();
  await button('Back').evaluate((element) => element.click());
  await refreshItems.waitFor({ state: 'detached' });

  await clickPointer(button('Material 3'));
  await button('Cupertino').waitFor();
  await clickPointer(button('Selection'));
  const dateButton = page.getByRole('button', { name: /^Choose date/ });
  const original = await dateButton.getAttribute('aria-label');
  await clickPointer(dateButton);
  await page.getByRole('button', { name: /^cancel$/i }).waitFor();
  await clickPointer(page.getByRole('button', { name: /^cancel$/i }));
  await dateButton.waitFor();
  assert.equal(await dateButton.getAttribute('aria-label'), original);

  await clickPointer(button('Containment'));
  const openBottomSheet = button('Open bottom sheet');
  await clickPointer(openBottomSheet);
  const saveSheet = button('Save from sheet');
  assert.ok((await center(saveSheet))[1] > page.viewportSize().height / 2);
  await clickPointer(saveSheet);
  await page.getByRole('note', { name: /Bottom sheet saved$/ }).waitFor();
  await saveSheet.waitFor({ state: 'detached' });
  await clickPointer(openBottomSheet);
  await saveSheet.waitFor();
  await page.mouse.click(30, 100);
  await page.getByRole('note', { name: /Bottom sheet dismissed$/ }).waitFor();
  await saveSheet.waitFor({ state: 'detached' });

  const controlledBody = page.locator('[aria-label*="Controlled panel body"]').first();
  await clickPointer(button('Controlled details'));
  await controlledBody.waitFor();
  await clickPointer(button('Controlled details'));
  await controlledBody.waitFor({ state: 'detached' });
  const firstRadio = page.locator('[aria-label*="Radio first body"]').first();
  const secondRadio = page.locator('[aria-label*="Radio second body"]').first();
  await firstRadio.waitFor();
  await clickPointer(button('Radio second'));
  await secondRadio.waitFor();
  await firstRadio.waitFor({ state: 'detached' });
  await page.getByRole('note', { name: /Panel 0: closed → Panel 1: open$/ }).waitFor();

  const dataTable = page
    .getByRole('group', { name: 'Data table 기본 API', exact: true })
    .getByRole('table');
  const quantity = dataTable.getByRole('columnheader').getByRole('button', { name: 'Qty' });
  await wheelIntoView(quantity);
  const selectAll = dataTable.getByRole('checkbox', { name: '전체 선택', exact: true });
  await selectAll.waitFor();
  assert.equal(await selectAll.getAttribute('aria-checked'), 'mixed');
  await clickPointer(quantity);
  await page.getByRole('note', { name: /Data table: Qty ascending$/ }).waitFor();
  await page.mouse.move(1244, 700);
  await page.mouse.wheel(0, 260);
  const pearRow = dataTable.getByRole('row', { name: 'Pear 3' });
  await clickPointer(pearRow.getByRole('cell').getByRole('button', { name: 'Pear', exact: true }));
  await page.getByRole('note', { name: /Data table: Pear selected$/ }).waitFor();
  await pearRow.and(page.locator('[aria-selected="true"]')).waitFor();

  const nextPage = button('Next page').or(page.locator('button[aria-description="Next page"]'));
  await wheelIntoView(nextPage);
  await clickPointer(nextPage);
  await page.getByRole('note', { name: /Paginated table: first row index 3$/ }).waitFor();
  await clickPointer(button('Rows per page: 3'));
  const fiveRows = button('5 rows per page');
  await wheelIntoView(fiveRows, 140);
  await clickPointer(fiveRows);
  await page.getByRole('note', { name: /Paginated table: 5 rows per page$/ }).waitFor();

  const continueStep = button('Continue step');
  await wheelIntoView(continueStep);
  await clickPointer(continueStep);
  await page.getByRole('note', { name: /Stepper: Review step$/ }).waitFor();
  const unavailableStep = page.getByRole('button', { name: /Unavailable step$/ });
  assert.equal(await unavailableStep.isDisabled(), true);
  const reviewStep = page.getByRole('button', { name: /Review step$/ });
  await wheelIntoView(reviewStep.and(page.locator('[aria-selected="true"]')), 180);

  await clickPointer(button('Actions'));
  const extendedFab = button('New item');
  await clickPointer(extendedFab);
  await page.getByRole('note', { name: /Extended FAB pressed$/ }).waitFor();
  const fabs = page.getByRole('group', { name: /Floating action buttons/ });
  assert.equal(await fabs.getByRole('button', { disabled: true }).count(), 1);

  assert.deepEqual(
    failures.filter((message) => !message.includes('favicon.ico')),
    [],
  );
  console.log(
    'W11 Testbed Web passed: segmented controls, FAB, picker, timer, search, sheets, panels, refresh, data tables, Stepper and date picker',
  );
} catch (error) {
  if (failures.length) console.error(failures.join('\n'));
  if (page && !page.isClosed()) {
    console.error(
      await page.getByRole('slider').evaluateAll((elements) =>
        elements.map((element) => ({
          value: element.getAttribute('aria-valuetext'),
          focused: document.activeElement === element,
          bounds: element.getBoundingClientRect().toJSON(),
        })),
      ),
    );
    console.error(
      await page
        .locator('body')
        .ariaSnapshot({ timeout: 1000 })
        .catch(() => '(snapshot unavailable)'),
    );
  }
  throw error;
} finally {
  await browser?.close();
  server.closeAllConnections();
  server.close();
}
