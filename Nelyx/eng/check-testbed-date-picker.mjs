// SPDX-License-Identifier: BSD-3-Clause
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { readFile } from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import { devices, webkit } from 'playwright';
import { localFile } from '../sdk/tooling/contracts/src/node-files.mjs';
import { mediaType } from '../sdk/tooling/vite/src/content.mjs';

const directory = path.resolve(
  process.argv[2] ?? path.join(import.meta.dirname, '../../sample/nelyx-testbed-app-3/.nelyx/web'),
);
await readFile(path.join(directory, 'index.html'));
const server = http.createServer(async (request, response) => {
  const name = new URL(request.url, 'http://localhost').pathname.slice(1) || 'index.html';
  try {
    const body = await readFile(localFile(directory, name));
    response.writeHead(200, { 'Content-Type': mediaType(name) }).end(body);
  } catch {
    response.writeHead(404).end();
  }
});

let browser;
try {
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  browser = await webkit.launch();
  const page = await browser.newPage({ ...devices['iPhone 15'], serviceWorkers: 'block' });
  page.setDefaultTimeout(8_000);
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const alert = page.getByRole('alert');
  const canvas = page.locator('canvas[data-nelyx-frame-ready="true"]').first();
  const open = page.getByRole('button', { name: 'Show date picker', exact: true });
  const cancel = page.getByRole('button', { name: 'Cancel', exact: true });
  const confirm = page.getByRole('button', { name: 'OK', exact: true });

  async function waitForControl(control) {
    await control.or(alert).first().waitFor({ state: 'visible' });
    assert.equal(await alert.count(), 0, (await alert.allTextContents()).join('\n'));
  }
  async function scrollTo(control, deltaY) {
    for (let attempt = 0; attempt < 24 && !(await control.isVisible()); attempt++) {
      await canvas.dispatchEvent('wheel', { clientX: 180, clientY: 550, deltaY });
      // The app can publish the accessibility geometry after the scroll frame.
      await page.waitForTimeout(180);
    }
    await waitForControl(control);
  }
  async function tap(control) {
    await waitForControl(control);
    const box = await control.boundingBox();
    assert(box, 'Expected a visible control with bounds');
    await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
  }

  await page.goto(`http://127.0.0.1:${server.address().port}/?renderMode=direct`);
  await canvas.waitFor();
  // Visiting every section before returning to the picker used to exhaust the live text budget.
  await scrollTo(page.getByLabel(/^Image demo/).first(), 445);
  await scrollTo(open, -245);
  for (let cycle = 0; cycle < 12; cycle++) {
    await tap(open);
    await tap(cycle === 11 ? confirm : cancel);
    await waitForControl(open);
  }
  assert.deepEqual(errors, []);
  console.log('Testbed 3 date picker opened and closed 12 times after visiting the gallery.');
} finally {
  await browser?.close();
  server.close();
}
