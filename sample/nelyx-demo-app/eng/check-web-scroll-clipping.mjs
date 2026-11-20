// SPDX-License-Identifier: BSD-3-Clause
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { execute } from '../../../Nelyx/sdk/tooling/cli/src/commands.mjs';

if (!process.argv.includes('--child')) {
  await execute(process.execPath, [import.meta.filename, '--child'], { timeout: 1_200_000 });
  process.exit(0);
}

const url = 'http://127.0.0.1:8081/';
const status = await fetch(url + '__nelyx/status', { signal: AbortSignal.timeout(5_000) });
assert.equal(status.status, 200, 'Start the Demo Web runner before this check');
assert.match((await status.json()).app, /[/\\]nelyx-demo-app$/);

async function colorRows(page, bounds, color) {
  const x = Math.ceil(bounds.x);
  const y = Math.ceil(bounds.y);
  const width = Math.floor(bounds.x + bounds.width) - x;
  const height = Math.floor(bounds.y + bounds.height) - y;
  const screenshot = await page.screenshot({ clip: { x, y, width, height }, scale: 'css' });
  return page.evaluate(
    async ({ source, color }) => {
      const bitmap = await createImageBitmap(await (await fetch(source)).blob());
      const canvas = document.createElement('canvas');
      canvas.width = bitmap.width;
      canvas.height = bitmap.height;
      const context = canvas.getContext('2d');
      context.drawImage(bitmap, 0, 0);
      bitmap.close();
      const bytes = context.getImageData(0, 0, canvas.width, canvas.height).data;
      const rgb = (offset) => (bytes[offset] << 16) | (bytes[offset + 1] << 8) | bytes[offset + 2];
      if (color === undefined) {
        const frequency = new Map();
        let highest = 0;
        for (let offset = 0; offset < bytes.length; offset += 4) {
          const value = rgb(offset);
          const count = (frequency.get(value) ?? 0) + 1;
          frequency.set(value, count);
          if (count > highest) {
            color = value;
            highest = count;
          }
        }
      }
      const rows = Array(canvas.height).fill(0);
      for (let y = 0; y < canvas.height; y++) {
        for (let x = 0; x < canvas.width; x++) {
          if (rgb((y * canvas.width + x) * 4) === color) rows[y]++;
        }
      }
      return { color, rows };
    },
    { source: 'data:image/png;base64,' + screenshot.toString('base64'), color },
  );
}

const sum = (rows) => rows.reduce((total, row) => total + row, 0);
const browser = await chromium.launch({ channel: 'chrome' });
try {
  for (const deviceScaleFactor of [1, 2]) {
    const viewport = { width: 1280, height: 760 };
    const page = await browser.newPage({ viewport, deviceScaleFactor });
    page.setDefaultTimeout(15_000);
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('console', (message) => {
      if (message.type() === 'error' && !message.location().url.endsWith('/favicon.ico'))
        errors.push(message.text());
    });

    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    const button = page.getByRole('button', { name: 'Filled', exact: true });
    await button.waitFor();
    const full = await button.boundingBox();
    const list = await button.evaluate((element) =>
      element.closest('[role="list"]')?.getBoundingClientRect().toJSON(),
    );
    assert.ok(full && list && full.height >= 24);
    const reference = await colorRows(page, full);
    assert.ok(sum(reference.rows) > full.width * full.height * 0.5);

    // Express deltas in CSS pixels at both device scale factors.
    const canvas = page.locator('canvas');
    const scrollBy = (deltaY) =>
      canvas.dispatchEvent('wheel', {
        clientX: list.x + 12,
        clientY: list.y + 80,
        deltaY,
        bubbles: true,
        cancelable: true,
      });

    const check = async (edge, height) => {
      await page.waitForFunction((height) => {
        const element = document.querySelector('button[aria-label="Filled"]');
        return element && Math.abs(element.getBoundingClientRect().height - height) < 1.5;
      }, height);
      const bounds = await button.boundingBox();
      assert.ok(bounds && bounds.height < full.height - 2);
      const { rows } = await colorRows(page, bounds, reference.color);
      const visible =
        edge === 'top' ? reference.rows.slice(-rows.length) : reference.rows.slice(0, rows.length);
      const expected = sum(visible);
      const actual = sum(rows);
      assert.ok(expected > 100);
      assert.ok(
        actual >= expected * 0.8,
        `DPR ${deviceScaleFactor}, ${edge} with ${height}px visible: ${actual}/${expected} fill pixels`,
      );
    };

    const atTopEdge = full.y + full.height - list.y - 15;
    await scrollBy(atTopEdge);
    await check('top', 15);
    await scrollBy(5.5);
    await check('top', 9.5);
    await scrollBy(-5.5);
    await check('top', 15);
    await scrollBy(-1000);
    await page.waitForFunction((y) => {
      const element = document.querySelector('button[aria-label="Filled"]');
      return element && Math.abs(element.getBoundingClientRect().y - y) < 1;
    }, full.y);

    const footer = viewport.height - list.bottom;
    await page.setViewportSize({ ...viewport, height: Math.round(full.y + 6 + footer) });
    await check('bottom', 6);
    await scrollBy(6.5);
    await check('bottom', 12.5);
    await scrollBy(7);
    await check('bottom', 19.5);
    await scrollBy(-7);
    await check('bottom', 12.5);

    assert.deepEqual(errors, []);
    console.log(`PASS DPR ${deviceScaleFactor}: clipped button pixels remain on both scroll edges`);
    await page.close();
  }
} finally {
  await browser.close();
}
