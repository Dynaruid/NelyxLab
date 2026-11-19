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
  assert.equal(
    await cupertino.locator('[aria-selected=true]').getAttribute('aria-label'),
    'Weekly',
  );
  await page.keyboard.press('ArrowLeft');
  await selected(cupertino, 'Daily');
  await page.mouse.move(...(await center(button('Daily'))));
  await page.mouse.down();
  const [weeklyX, weeklyY] = await center(button('Weekly'));
  await page.mouse.move(weeklyX, weeklyY, { steps: 8 });
  await page.mouse.up();
  await selected(cupertino, 'Weekly');

  await button('Selection').evaluate((element) => element.click());
  await page.locator('[aria-label="5개 섹션 · 스크롤하여 탐색"]').waitFor();
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
  assert.deepEqual(
    failures.filter((message) => !message.includes('favicon.ico')),
    [],
  );
  console.log(
    'W11 Testbed Web: segmented controls, Cupertino wheel input and semantics, and date picker cancellation passed',
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
