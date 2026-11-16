// Common Source regression against the current Demo static build.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { createHash } from 'node:crypto';
import { chromium } from 'playwright';
import { execute } from '../sdk/tooling/cli/src/commands.mjs';

const root = path.resolve(import.meta.dirname, '../..');
function removeTemporary(temporary, parent) {
  if (path.dirname(temporary) !== parent || fs.lstatSync(temporary).isSymbolicLink())
    throw Error('Web temporary owner differs');
  fs.rmSync(temporary, { recursive: true, force: true });
}
if (!process.argv.includes('--child')) {
  try {
    await execute(
      'pwsh.exe',
      ['-NoProfile', '-Command', 'node Nelyx/eng/check-source-web.mjs --child'],
      { cwd: root, timeout: 1_200_000 },
    );
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
} else {
  const directory = fs.realpathSync(path.join(root, 'sample/nelyx-demo-app/.nelyx/web'));
  const parent = path.join(root, '.tmp'),
    temporary = fs.mkdtempSync(path.join(parent, 'source-web-'));
  const sockets = new Set(),
    errors = [],
    cases = [];
  const types = {
    '.html': 'text/html',
    '.js': 'text/javascript',
    '.wasm': 'application/wasm',
    '.json': 'application/json',
    '.ttf': 'font/ttf',
    '.otf': 'font/otf',
    '.webp': 'image/webp',
  };
  const server = http.createServer((request, response) => {
    try {
      const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
      const file = path.resolve(directory, '.' + (pathname === '/' ? '/index.html' : pathname));
      if (!file.startsWith(directory + path.sep) || !fs.statSync(file).isFile())
        throw Error('Absent file');
      response.writeHead(200, {
        'Content-Type': types[path.extname(file)] ?? 'application/octet-stream',
        'Cache-Control': 'no-store',
      });
      fs.createReadStream(file).pipe(response);
    } catch {
      response.writeHead(404);
      response.end();
    }
  });
  server.on('connection', (socket) => {
    sockets.add(socket);
    socket.once('close', () => sockets.delete(socket));
  });
  let browser,
    page,
    expired = false;
  const watchdog = setTimeout(() => {
    expired = true;
    void browser?.close();
    for (const socket of sockets) socket.destroy();
    server.close();
  }, 1_190_000);
  try {
    await new Promise((resolve, reject) => {
      server.once('error', reject);
      server.listen(0, '127.0.0.1', resolve);
    });
    browser = await chromium.launch({
      headless: true,
      args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
    });
    page = await browser.newPage({
      viewport: { width: 1280, height: 800 },
      deviceScaleFactor: 1,
    });
    page.setDefaultTimeout(15000);
    const button = (name) =>
      page
        .getByRole('button', { name, exact: true })
        .or(page.locator('button[aria-description=' + JSON.stringify(name) + ']'));
    // Semantic controls are transparent pointer-disabled carriers. Send the
    // mouse through the actual canvas at their published geometry.
    const tap = async (locator) => {
      await locator.waitFor();
      const rect = await locator.boundingBox();
      assert(rect && rect.width > 0 && rect.height > 0);
      await page.mouse.click(rect.x + rect.width / 2, rect.y + rect.height / 2);
    };
    const readEditor = (locator) =>
      locator.evaluate((node) => node.editContext?.text ?? node.value);
    page.on('pageerror', (error) => errors.push(String(error.stack ?? error)));
    await page.goto('http://127.0.0.1:' + server.address().port, { waitUntil: 'networkidle' });
    await button('Explore components').waitFor();
    assert((await page.locator('canvas').count()) > 0);
    cases.push('current-source-first-frame');
    await page.mouse.move(200, 550);
    await page.mouse.wheel(0, 600);
    await page.waitForTimeout(300);
    await page.mouse.wheel(0, -600);
    await page.waitForTimeout(300);
    cases.push('gallery-wheel-return');
    await tap(button('Explore components'));
    await tap(button('Text inputs'));
    const editor = page.getByRole('textbox').first();
    await tap(editor);
    await page.keyboard.press('Control+A');
    await page.keyboard.insertText('Jank 한글 😀');
    await page.waitForTimeout(300);
    assert.equal(await readEditor(editor), 'Jank 한글 😀');
    await tap(button('Switch to dark mode'));
    await button('Switch to light mode').waitFor();
    await page.setViewportSize({ width: 540, height: 700 });
    await page.waitForTimeout(300);
    assert.equal(await readEditor(page.getByRole('textbox').first()), 'Jank 한글 😀');
    await page.setViewportSize({ width: 1280, height: 800 });
    cases.push('unicode-editor-theme-and-breakpoint-retention');
    await tap(button('Explore components'));
    await tap(button('Selection'));
    await tap(button('Choose date'));
    const month = page
      .getByRole('button', { name: /Select year/ })
      .or(page.locator('button[aria-description*="Select year"]'));
    const label = () =>
      month.evaluate((element) => element.getAttribute('aria-label') ?? element.textContent);
    const originalMonth = await label();
    await tap(button('Next month'));
    for (let attempt = 0; attempt < 30 && (await label()) === originalMonth; attempt++)
      await page.waitForTimeout(100);
    assert.notEqual(await label(), originalMonth);
    await tap(button('Previous month'));
    for (let attempt = 0; attempt < 30 && (await label()) !== originalMonth; attempt++)
      await page.waitForTimeout(100);
    assert.equal(await label(), originalMonth);
    await tap(button('Cancel'));
    await button('Cancel').waitFor({ state: 'hidden' });
    await page.waitForTimeout(500);
    cases.push('calendar-forward-reverse-and-close');
    assert.deepEqual(errors, []);
    assert(!expired);
    const capture = path.join(temporary, 'web.png');
    await page.screenshot({ path: capture });
    console.log('SOURCE_WEB_SCREENSHOT ' + capture);
    console.log(
      'SOURCE_WEB ' +
        JSON.stringify({
          result: 'PASS-scoped',
          cases,
          renderer: 'WebGL2-SwiftShader-functional-only',
          bundleSha256: createHash('sha256')
            .update(fs.readFileSync(path.join(directory, 'application.js')))
            .digest('hex'),
        }),
    );
    await page.waitForTimeout(15000);
    await page.close();
  } catch (error) {
    console.error(String(error.stack ?? error));
    if (errors.length) console.error(JSON.stringify(errors));
    if (page && !page.isClosed()) {
      console.error(
        'SOURCE_WEB_STATE ' +
          JSON.stringify({
            title: await page.title(),
            body: (await page.locator('body').innerText()).slice(0, 2500),
            buttons: await page.getByRole('button', { includeHidden: true }).evaluateAll((nodes) =>
              nodes.map((node) => ({
                name: node.getAttribute('aria-label') ?? node.textContent,
                display: getComputedStyle(node).display,
                rect: node.getBoundingClientRect().toJSON(),
              })),
            ),
          }),
      );
      const capture = path.join(temporary, 'failure.png');
      await page.screenshot({ path: capture });
      console.error('SOURCE_WEB_SCREENSHOT ' + capture);
      await page.waitForTimeout(15000);
    }
    process.exitCode = 1;
  } finally {
    clearTimeout(watchdog);
    await browser?.close();
    for (const socket of sockets) socket.destroy();
    if (server.listening) await new Promise((resolve) => server.close(resolve));
    removeTemporary(temporary, parent);
    console.log('SOURCE_WEB_CLEANUP_DONE');
  }
}
