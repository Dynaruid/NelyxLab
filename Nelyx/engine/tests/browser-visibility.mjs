// SPDX-License-Identifier: BSD-3-Clause
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { chromium } from 'playwright';
import { createHostServer } from '../tools/serve.mjs';
import { timeout } from '../tools/build.mjs';
const sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));
function removeProfile(directory, parent) {
  const target = fs.realpathSync(directory),
    relative = path.relative(parent, target);
  if (
    !relative ||
    relative.startsWith('..') ||
    path.isAbsolute(relative) ||
    !path.basename(target).startsWith('nelyx-v2-visible-')
  )
    throw new Error('Unsafe visibility profile cleanup');
  fs.rmSync(target, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
}

async function withVisibleBrowser(channel, run) {
  const executable = [process.env.ProgramFiles, process.env['ProgramFiles(x86)']]
    .filter(Boolean)
    .map((root) =>
      path.join(
        root,
        ...(channel === 'chrome'
          ? ['Google', 'Chrome', 'Application', 'chrome.exe']
          : ['Microsoft', 'Edge', 'Application', 'msedge.exe']),
      ),
    )
    .find((file) => fs.existsSync(file));
  if (!executable) throw new Error('Visibility browser missing: ' + channel);
  const parent = fs.realpathSync(os.tmpdir()),
    directory = fs.mkdtempSync(path.join(parent, 'nelyx-v2-visible-'));
  let browser, child, result;
  const errors = [];
  try {
    child = spawn(
      executable,
      [
        '--remote-debugging-address=127.0.0.1',
        '--remote-debugging-port=0',
        '--user-data-dir=' + directory,
        '--no-first-run',
        '--no-default-browser-check',
        '--disable-background-networking',
        '--disable-component-update',
        '--disable-extensions',
        '--no-startup-window',
      ],
      { stdio: ['ignore', 'ignore', 'ignore'], windowsHide: false },
    );
    let spawnError;
    child.on('error', (error) => {
      spawnError = error;
    });
    const portFile = path.join(directory, 'DevToolsActivePort'),
      deadline = Date.now() + 15000;
    while (!fs.existsSync(portFile)) {
      if (spawnError || child.exitCode !== null || Date.now() >= deadline)
        throw spawnError ?? new Error('Visibility browser startup failed: ' + child.exitCode);
      await sleep(25);
    }
    const port = Number(fs.readFileSync(portFile, 'utf8').split('\n')[0]);
    assert.ok(Number.isInteger(port) && port > 0 && port <= 65535);
    // Use the default context without Playwright's forced focus/visibility.
    // A fresh, owned browser/profile keeps this isolated from user sessions.
    browser = await chromium.connectOverCDP('http://127.0.0.1:' + port, { noDefaults: true });
    result = await run(browser);
  } catch (error) {
    errors.push(error);
  } finally {
    try {
      await browser?.close();
    } catch (error) {
      errors.push(error);
    }
    if (child?.pid && child.exitCode === null) {
      const exit = once(child, 'exit');
      let timer;
      try {
        await Promise.race([
          exit,
          new Promise((resolve) => {
            timer = setTimeout(resolve, 3000);
          }),
        ]);
      } finally {
        clearTimeout(timer);
      }
      if (child.exitCode === null) {
        child.kill();
        await exit;
      }
    }
    try {
      removeProfile(directory, parent);
    } catch (error) {
      errors.push(error);
    }
  }
  if (errors.length) throw new AggregateError(errors, 'Visibility run or cleanup failed');
  return result;
}

export function browserVisibilityContracts() {
  for (const channel of ['chrome', 'msedge'])
    for (const route of ['plain', 'isolated'])
      test(
        `Real ${channel} ${route} tab visibility cancels frame credit and trims caches without focus emulation`,
        { timeout },
        async () => {
          const server = createHostServer();
          server.listen(0, '127.0.0.1');
          await once(server, 'listening');
          try {
            await withVisibleBrowser(channel, async (browser) => {
              const context = browser.contexts()[0],
                page = await context.newPage(),
                errors = [];
              page.on('pageerror', (error) => errors.push(String(error)));
              await page.goto(`http://127.0.0.1:${server.address().port}/${route}/`);
              await page.waitForFunction(() => window.__v2?.ready || window.__v2?.errors.length);
              const startup = await page.evaluate(() => {
                const v = window.__v2,
                  d = v.surface.diagnostics,
                  r = d['render-stats'];
                return {
                  errors: v.errors,
                  viewport: [innerWidth, innerHeight, devicePixelRatio],
                  profile: d.selectedProfile,
                  gl: d.gl,
                  preparation: d['preparation-error'],
                  content: d['content-stats']?.counters,
                  render: r?.state,
                };
              });
              assert.deepEqual(
                startup.errors,
                [],
                JSON.stringify(startup, (_key, value) =>
                  typeof value === 'bigint' ? String(value) : value,
                ),
              );
              await page.waitForFunction(
                () =>
                  window.__v2.surface.diagnostics['render-stats']?.state.publication > 0n &&
                  window.__v2.surface.diagnostics['memory-pressure']?.low === false,
              );
              const before = await page.evaluate(
                  () => window.__v2.surface.diagnostics['render-stats'].state.publication,
                ),
                cover = await context.newPage();
              try {
                await cover.bringToFront();
                await page.waitForFunction(
                  () =>
                    document.visibilityState === 'hidden' &&
                    window.__v2.surface.diagnostics['memory-pressure']?.low === true &&
                    !window.__v2.surface.diagnostics['render-stats'].state.renderWake,
                  null,
                  { polling: 50 },
                );
                const hidden = await page.evaluate(() => ({
                  pressure: window.__v2.surface.diagnostics['memory-pressure'],
                  draws: window.__v2.surface.diagnostics['render-stats'].counters.draws,
                  clock: window.__v2.surface.diagnostics.frameClockMain,
                }));
                assert.equal(hidden.pressure.source, 'hidden');
                assert.ok(
                  hidden.pressure.owners.every((owner) => owner.counters.cachedContentBytes === 0),
                );
                assert.equal(hidden.clock.outstanding, 0);
                await sleep(100);
                assert.equal(
                  await page.evaluate(
                    () => window.__v2.surface.diagnostics['render-stats'].counters.draws,
                  ),
                  hidden.draws,
                );
              } finally {
                await cover.close();
                await page.bringToFront();
              }
              await page.waitForFunction(
                (old) =>
                  document.visibilityState === 'visible' &&
                  window.__v2.surface.diagnostics['memory-pressure']?.low === false &&
                  window.__v2.surface.diagnostics['render-stats'].state.publication > old,
                before,
                { polling: 50 },
              );
              const closed = await page.evaluate(() => window.__v2.close());
              assert.equal(closed.reservedBytes, 0);
              assert.equal(closed.workersStopped, true);
              assert.equal(closed.frameClock.outstanding, 0);
              assert.deepEqual(errors, []);
              console.log(
                'V2_REAL_VISIBILITY ' +
                  JSON.stringify({
                    browser: channel,
                    profile: route,
                    version: browser.version(),
                    devicePixelRatio: startup.viewport[2],
                    focusEmulation: false,
                    hiddenObserved: true,
                    frameCreditCanceled: true,
                    admissionRecovered: true,
                    closed: true,
                  }),
              );
            });
          } finally {
            server.closeAllConnections();
            await new Promise((resolve, reject) =>
              server.close((error) => (error ? reject(error) : resolve())),
            );
          }
        },
      );
}
