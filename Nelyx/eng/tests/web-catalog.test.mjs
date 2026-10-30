// SPDX-License-Identifier: BSD-3-Clause
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import ts from 'typescript';
const timeout = 1_200_000;
function catalog(file, name) {
  const source = ts.createSourceFile(
    file,
    fs.readFileSync(file, 'utf8'),
    ts.ScriptTarget.Latest,
    true,
  );
  const declaration = source.statements
    .filter(ts.isVariableStatement)
    .flatMap((statement) => [...statement.declarationList.declarations])
    .find((value) => ts.isIdentifier(value.name) && value.name.text === name);
  let values = declaration?.initializer;
  if (ts.isAsExpression(values)) values = values.expression;
  assert(ts.isArrayLiteralExpression(values), file);
  return values.elements.map((value) => {
    assert(ts.isObjectLiteralExpression(value));
    return Object.fromEntries(
      value.properties.map((property) => {
        assert(ts.isPropertyAssignment(property) && ts.isStringLiteral(property.initializer));
        return [property.name.getText(source), property.initializer.text];
      }),
    );
  });
}
test(
  'current Web Testbed visits every Material and Cupertino catalog declaration and preserves real controls',
  { timeout },
  async () => {
    const root = process.cwd(),
      output = path.join(root, 'sample/nelyx-testbed-app-2/.nelyx/web');
    const material = catalog('sample/nelyx-testbed-app-2/src/catalog.ts', 'demos'),
      cupertino = catalog('sample/nelyx-testbed-app-2/src/cupertino-catalog.ts', 'cupertinoDemos'),
      groups = catalog('sample/nelyx-testbed-app-2/src/catalog.ts', 'categories');
    assert.equal(material.length, 29);
    assert.equal(cupertino.length, 20);
    assert(
      fs.existsSync(path.join(output, 'application.js')),
      'Build the current Web Testbed first',
    );
    const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'nelyx-web-catalog-'));
    let browser, context, server, page;
    const errors = [],
      consoleErrors = [],
      visited = [];
    try {
      const install = spawnSync(
        'cmd.exe',
        [
          '/d',
          '/c',
          'npm.cmd',
          'install',
          '--prefix',
          temporary,
          'playwright@1.64.0',
          '--offline',
          '--ignore-scripts',
          '--no-package-lock',
          '--no-audit',
          '--no-fund',
        ],
        { encoding: 'utf8', timeout, windowsHide: true },
      );
      assert.equal(install.status, 0, install.stdout + install.stderr);
      const { chromium } = createRequire(path.join(temporary, 'package.json'))('playwright');
      server = http.createServer((request, response) => {
        if (request.url === '/favicon.ico') {
          response.writeHead(204);
          response.end();
          return;
        }
        let file = path.resolve(
          output,
          '.' + decodeURIComponent(new URL(request.url, 'http://localhost').pathname),
        );
        if (file === output) file = path.join(output, 'index.html');
        if (
          !file.startsWith(output + path.sep) ||
          !fs.existsSync(file) ||
          !fs.statSync(file).isFile()
        ) {
          response.writeHead(404);
          response.end();
          return;
        }
        response.setHeader(
          'Content-Type',
          {
            '.html': 'text/html',
            '.js': 'text/javascript',
            '.wasm': 'application/wasm',
            '.json': 'application/json',
            '.ttf': 'font/ttf',
            '.otf': 'font/otf',
            '.webp': 'image/webp',
          }[path.extname(file)] ?? 'application/octet-stream',
        );
        fs.createReadStream(file).pipe(response);
      });
      await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
      browser = await chromium.launch({
        executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
        headless: true,
      });
      context = await browser.newContext({ viewport: { width: 1200, height: 1000 } });
      page = await context.newPage();
      page.setDefaultTimeout(10000);
      page.on('pageerror', (error) => errors.push(String(error)));
      page.on('console', (message) => {
        if (message.type() === 'error') consoleErrors.push(message.text());
      });
      await page.goto('http://127.0.0.1:' + server.address().port);
      await page
        .getByRole('button', { name: 'Cupertino', exact: true })
        .waitFor({ state: 'visible', timeout: 30000 });
      const button = (name) =>
        page
          .getByRole('button', { name, exact: true })
          .or(page.locator('button[aria-description=' + JSON.stringify(name) + ']'))
          .first();
      const click = async (name) => {
        const control = button(name);
        await control.waitFor({ state: 'visible' });
        const box = await control.boundingBox();
        assert(box, name);
        await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
        await page.waitForTimeout(180);
      };
      // Semantics intentionally merges adjacent static text into its parent. Match
      // complete label lines, including those of a group, rather than text nodes.
      const observe = async (expected) => {
        const names = await page
          .locator('[aria-label]:not(button):not([role=textbox])')
          .evaluateAll((elements) =>
            elements.flatMap((element) => element.getAttribute('aria-label').split('\n')),
          );
        return expected.filter((row) => names.includes(row.title));
      };
      const scan = async (design, rows) => {
        await click('준비 중 포함');
        for (const group of groups.filter((group) =>
          rows.some((row) => row.category === group.id),
        )) {
          await click(group.title);
          const expected = rows.filter((row) => row.category === group.id),
            seen = new Set();
          let wheels = 0;
          for (;;) {
            for (const row of await observe(expected)) seen.add(row.id);
            if (seen.size === expected.length) break;
            assert(
              wheels < 15,
              JSON.stringify({
                design,
                category: group.id,
                missing: expected.filter((row) => !seen.has(row.id)).map((row) => row.title),
              }),
            );
            await page.mouse.move(850, 780);
            await page.mouse.wheel(0, 400);
            await page.waitForTimeout(180);
            wheels++;
          }
          visited.push({
            design,
            category: group.id,
            declared: expected.length,
            implemented: expected.filter((row) => row.status !== 'planned').length,
            seen: seen.size,
            wheels,
          });
          assert.deepEqual(errors, [], JSON.stringify(visited));
        }
      };
      await scan('material', material);
      await click('Actions');
      await click('Elevated');
      assert((await page.locator('[aria-label*="Elevated pressed"]').count()) > 0);
      const favorite = button('Favorite');
      const before = await favorite.getAttribute('aria-selected');
      assert(['true', 'false'].includes(before));
      await click('Favorite');
      assert.equal(
        await favorite.getAttribute('aria-selected'),
        before === 'true' ? 'false' : 'true',
      );
      await click('Communication');
      const messages = await page.locator('[aria-label]').evaluateAll(
        (elements) =>
          elements
            .map((element) => element.getAttribute('aria-label'))
            .map((label) => label.match(/\b(\d+) messages\b/))
            .find(Boolean)?.[1],
      );
      assert(messages !== undefined);
      await click('Add message');
      assert(
        (await page
          .locator('[aria-label*=' + JSON.stringify(Number(messages) + 1 + ' messages') + ']')
          .count()) > 0,
      );
      await click('Cupertino');
      await scan('cupertino', cupertino);
      await click('Actions');
      await click('Favorite');
      assert((await page.locator('[aria-label*="Cupertino favorite pressed"]').count()) > 0);
      await click('Containment');
      const tile = await page.getByRole('group', { name: '알림', exact: true }).boundingBox();
      assert(tile);
      await page.mouse.click(tile.x + tile.width / 2, tile.y + tile.height / 2);
      await page.waitForTimeout(180);
      assert((await page.locator('[aria-label*="Notifications selected"]').count()) > 0);
      await click('Navigation');
      await click('Open named route');
      await page
        .getByRole('button', { name: 'Return result', exact: true })
        .waitFor({ state: 'visible' });
      await click('Return result');
      await click('Material 3');
      await click('Actions');
      assert.equal(
        await button('Favorite').getAttribute('aria-selected'),
        before === 'true' ? 'false' : 'true',
      );
      assert.deepEqual(errors, []);
      assert.deepEqual(consoleErrors, []);
      console.log(
        JSON.stringify({
          scope: 'current-Web-Testbed-catalog',
          visited,
          physicalInput: 'notVerified',
          displayed: 'unobserved',
        }),
      );
    } catch (error) {
      const labels = page
        ? await page
            .locator('[aria-label]')
            .evaluateAll((elements) =>
              elements.map((element) => ({
                role: element.getAttribute('role') ?? element.tagName,
                name: element.getAttribute('aria-label'),
              })),
            )
            .catch(() => null)
        : null;
      throw new AggregateError(
        [error, new Error(JSON.stringify({ visited, errors, consoleErrors, labels }))],
        'Web catalog validation failed',
      );
    } finally {
      /* oxlint-disable no-unsafe-finally -- Retirement and finalization failures must propagate, including while unwinding a frame or test. */
      const failures = [];
      for (const cleanup of [
        () => context?.close(),
        () => browser?.close(),
        () => (server?.listening ? new Promise((resolve) => server.close(resolve)) : undefined),
        () => {
          assert.equal(path.dirname(temporary), path.resolve(os.tmpdir()));
          assert(
            path.basename(temporary).startsWith('nelyx-web-catalog-') &&
              !fs.lstatSync(temporary).isSymbolicLink(),
          );
          fs.rmSync(temporary, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
        },
      ])
        try {
          await cleanup();
        } catch (error) {
          failures.push(error);
        }
      if (failures.length) throw new AggregateError(failures, 'Web catalog cleanup failed');
      /* oxlint-enable no-unsafe-finally */
    }
  },
);
