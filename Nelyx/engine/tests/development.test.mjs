// SPDX-License-Identifier: BSD-3-Clause
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { chromium } from 'playwright';
import { stop as stopCompiler } from 'esbuild';
import { engineRoot, timeout, sourceIdentity } from '../tools/build.mjs';
import {
  createEngineV2Project,
  buildEngineV2Application,
} from '../../sdk/tooling/cli/src/engine-v2-runner.mjs';
import { createEngineV2Development } from '../../sdk/tooling/cli/src/engine-v2-development.mjs';

const repo = path.resolve(engineRoot, '../..'),
  supply = path.join(engineRoot, 'dist');
const fixture = (value, { delayed = false, failedDisposal = false } = {}) => `
import {defineEngineV2App} from '@nelyx/sdk/engine-v2';
import {Button,protocol as p} from '@nelyx/core/v2';
export default defineEngineV2App({
 async build({asset,notify}){
  ${delayed ? 'await new Promise(resolve=>setTimeout(resolve,500));' : ''}
  const assetValue=String.fromCharCode(...await asset('version.txt'));
  notify({kind:'fixture',value:${JSON.stringify(value)},assetValue});
  return new Button(${JSON.stringify(value)}+':'+assetValue,()=>notify({kind:'fixture-action',value:${JSON.stringify(value)}}),{properties:{x:10,y:10,width:180,height:50}});
 },
 dispose(){${failedDisposal ? "throw Error('fixture disposal failed');" : ''}}
});`;
const write = (app, value, options) => {
  fs.writeFileSync(path.join(app, 'assets/version.txt'), value);
  fs.writeFileSync(path.join(app, 'src/app.ts'), fixture(value, options));
};
async function consumer(run, windowsHost) {
  assert.equal(
    JSON.parse(fs.readFileSync(path.join(supply, 'engine-manifest.json'))).sourceSha256,
    sourceIdentity(),
    'Build the current engine before development acceptance',
  );
  const parent = fs.realpathSync(os.tmpdir()),
    app = fs.mkdtempSync(path.join(parent, 'engine-development-'));
  try {
    createEngineV2Project(app);
    fs.mkdirSync(path.join(app, 'node_modules/@nelyx'), { recursive: true });
    for (const [name, directory] of [
      ['core', 'Nelyx'],
      ['sdk', 'Nelyx/sdk'],
    ])
      fs.symlinkSync(
        path.join(repo, directory),
        path.join(app, 'node_modules/@nelyx', name),
        'junction',
      );
    fs.mkdirSync(path.join(app, 'assets'));
    fs.writeFileSync(
      path.join(app, 'nelyx.v2.json'),
      JSON.stringify({
        schema: 'nelyx.app.v2/1',
        engine: 'v2',
        entry: 'src/app.ts',
        assets: { 'version.txt': 'assets/version.txt' },
        ...(windowsHost ? { windowsHost } : {}),
      }),
    );
    write(app, 'one');
    await run(app);
    assert.deepEqual(
      fs.readdirSync(path.join(app, 'dist')).filter((name) => name.startsWith('.engine-v2-')),
      [],
      'Development candidates and retired bundles are not retained',
    );
  } finally {
    stopCompiler();
    assert.equal(path.dirname(path.resolve(app)), parent);
    fs.rmSync(app, { recursive: true, force: true, maxRetries: 3 });
  }
}
async function until(predicate, diagnostics = () => '', limit = 30000) {
  const end = Date.now() + limit;
  while (Date.now() < end) {
    if (await predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  assert.fail('Development timeout: ' + JSON.stringify(diagnostics()));
}
async function pageReady(page, generation, label) {
  await page.waitForFunction(
    (generation) =>
      globalThis.__nelyxV2?.development?.generation === generation &&
      (globalThis.__nelyxV2.ready || globalThis.__nelyxV2.errors.length),
    generation,
    { timeout: 30000 },
  );
  const current = await page.evaluate(() => ({
    ready: globalThis.__nelyxV2.ready,
    errors: globalThis.__nelyxV2.errors,
    profile: globalThis.__nelyxV2.surface.selectedProfile,
    receipt: globalThis.__nelyxV2.receipt,
  }));
  assert.deepEqual(current.errors, []);
  assert.equal(current.ready, true);
  assert.equal(current.receipt.execution.observed, true);
  assert.equal(current.receipt.execution.acknowledgedCommands, current.receipt.commands);
  assert.ok(current.receipt.commands > 0);
  assert.equal(current.receipt.timing.scope, 'initial-app-build');
  assert.equal(current.receipt.timing.domain, 'owner-performance');
  assert.ok(
    current.receipt.timing.buildElapsedMs >= 0 && current.receipt.timing.mountAndAckElapsedMs >= 0,
  );
  await page.locator('[aria-label="' + label + '"]').waitFor();
  return current;
}
test(
  'Native source changes during host startup are retained by the development watcher',
  { timeout },
  () =>
    consumer(async (app) => {
      const lines = [];
      let changed = false,
        session;
      try {
        session = await createEngineV2Development({
          app,
          target: 'windows',
          engineInputs: supply,
          quiet: true,
          onHostLine(line) {
            lines.push(line);
            if (!changed && line.startsWith('V2_WINDOWS_HOST ')) {
              changed = true;
              write(app, 'startup-change');
            }
          },
        });
        await until(
          () => session.status.phase === 'open' && session.status.generation === 2,
          () => ({ status: session.status, lines }),
        );
        assert.ok(
          lines.some(
            (line) => line.startsWith('V2_APP ') && line.includes('"value":"startup-change"'),
          ),
        );
        assert.equal((await session.close()).exitCode, 0);
        assert.equal(lines.filter((line) => line.startsWith('V2_CLOSED ')).length, 2);
      } finally {
        await session?.close();
      }
    }, 'windows-app-sdk'),
);
test(
  'Web development drains both profiles before replacement, preserves failed preparation, and bounds generation assets',
  { timeout },
  () =>
    consumer(async (app) => {
      const events = [],
        traces = [],
        pageErrors = [];
      let session, browser;
      try {
        session = await createEngineV2Development({
          app,
          target: 'web',
          engineInputs: supply,
          port: 0,
          quiet: true,
          onEvent: (value) => events.push(value),
        });
        browser = await chromium.launch({ headless: true });
        const base = 'http://127.0.0.1:' + session.address.port,
          pages = [];
        for (const [route, profile] of [
          ['plain', 'single-worker'],
          ['isolated', 'threaded'],
        ]) {
          const page = await browser.newPage({ viewport: { width: 300, height: 160 } });
          pages.push(page);
          page.on('pageerror', (error) => pageErrors.push(String(error)));
          page.on('console', (message) => {
            if (message.text().startsWith('NELYX_V2_RELOAD_CLOSED '))
              traces.push(JSON.parse(message.text().slice(23)));
          });
          await page.goto(base + '/' + route + '/');
          assert.equal((await pageReady(page, 1, 'one:one')).profile, profile);
        }
        fs.writeFileSync(path.join(app, 'src/app.ts'), 'export default {build( syntax failure');
        await until(
          () => events.some((value) => value.kind === 'build-failed'),
          () => session.status,
        );
        assert.equal(session.status.generation, 1);
        for (const page of pages) {
          assert.equal(await page.evaluate(() => globalThis.__nelyxV2.ready), true);
          const action = page.evaluate(
            () =>
              new Promise((resolve) => {
                const app = globalThis.__nelyxV2.app;
                const receive = (event) => {
                  if (event.data.kind === 'fixture-action') {
                    app.removeEventListener('message', receive);
                    resolve(event.data.value);
                  }
                };
                app.addEventListener('message', receive);
              }),
          );
          await page.locator('[aria-label="one:one"]').click();
          assert.equal(
            await action,
            'one',
            'A preparation failure leaves the previous C++ app interactive',
          );
        }
        write(app, 'two');
        try {
          for (const page of pages) await pageReady(page, 2, 'two:two');
        } catch (error) {
          assert.fail(
            JSON.stringify(
              {
                status: session.status,
                events,
                traces,
                pages: await Promise.all(
                  pages.map((page) =>
                    page.evaluate(() => ({
                      url: location.href,
                      ready: globalThis.__nelyxV2?.ready,
                      errors: globalThis.__nelyxV2?.errors,
                      development: globalThis.__nelyxV2?.development,
                      closed: globalThis.__nelyxV2?.surface?.diagnostics.closed,
                    })),
                  ),
                ),
              },
              (_key, value) => (typeof value === 'bigint' ? String(value) : value),
            ) +
              '\n' +
              String(error),
          );
        }
        assert.equal(traces.length, 2);
        for (const trace of traces) {
          assert.equal(trace.generation, 1);
          assert.equal(trace.closed.reservedBytes, 0);
          assert.equal(trace.closed.workersStopped, true);
          for (const provider of trace.closed.providers) {
            assert.equal(provider.livePictures, 0);
            assert.equal(provider.liveSurfaces, 0);
            assert.equal(provider.liveContexts, 0);
            assert.equal(provider.gpuReservedBytes, 0);
          }
        }
        assert.equal(
          await (await fetch(base + '/plain/__nelyx_gen/1/application/assets/version.txt')).text(),
          'one',
        );
        assert.equal(
          await (await fetch(base + '/plain/__nelyx_gen/2/application/assets/version.txt')).text(),
          'two',
        );
        write(app, 'superseded');
        write(app, 'three');
        for (const page of pages) await pageReady(page, 3, 'three:three');
        assert.equal(
          (await fetch(base + '/plain/__nelyx_gen/1/application/assets/version.txt')).status,
          410,
        );
        assert.equal(
          await (
            await fetch(base + '/isolated/__nelyx_gen/3/application/assets/version.txt')
          ).text(),
          'three',
        );
        const closed = await session.close();
        assert.equal(closed.exitCode, 0, JSON.stringify(closed));
        assert.equal(
          traces.length,
          6,
          'Two retired generations and the final pair each drain exactly once',
        );
        assert.deepEqual(pageErrors, []);
      } finally {
        await session?.close();
        await browser?.close();
      }
    }),
);

test(
  'Web close during App startup prevents a late build result from mounting or becoming ready',
  { timeout },
  () =>
    consumer(async (app) => {
      write(app, 'pending', { delayed: true });
      let session, browser;
      try {
        session = await createEngineV2Development({
          app,
          target: 'web',
          engineInputs: supply,
          port: 0,
          quiet: true,
        });
        browser = await chromium.launch({ headless: true });
        const page = await browser.newPage();
        await page.goto('http://127.0.0.1:' + session.address.port + '/plain/');
        await page.waitForFunction(
          () => globalThis.__nelyxV2?.close && globalThis.__nelyxV2.development,
        );
        const result = await page.evaluate(async () => {
          const current = globalThis.__nelyxV2,
            closed = await current.close();
          return { closed, ready: current.ready, errors: current.errors, receipt: current.receipt };
        });
        assert.equal(result.closed.reservedBytes, 0);
        assert.equal(result.closed.workersStopped, true);
        assert.equal(result.ready, false);
        assert.equal(result.receipt, undefined);
        assert.deepEqual(result.errors, []);
        assert.equal((await session.close()).exitCode, 0);
      } finally {
        await session?.close();
        await browser?.close();
      }
    }),
);

test(
  'A failed Web disposal drains owners, rejects generation replacement and terminates development',
  { timeout },
  () =>
    consumer(async (app) => {
      write(app, 'one', { failedDisposal: true });
      let session, browser;
      try {
        session = await createEngineV2Development({
          app,
          target: 'web',
          engineInputs: supply,
          port: 0,
          quiet: true,
        });
        browser = await chromium.launch({ headless: true });
        const page = await browser.newPage();
        await page.goto('http://127.0.0.1:' + session.address.port + '/isolated/');
        await pageReady(page, 1, 'one:one');
        write(app, 'two');
        const result = await session.closed;
        assert.equal(result.exitCode, 1);
        assert.equal(result.generation, 1);
        assert.match(result.errors.join('\n'), /fixture disposal failed/);
        assert.equal(
          await page.evaluate(() => globalThis.__nelyxV2.surface.diagnostics.closed.reservedBytes),
          0,
        );
        assert.equal(await page.locator('[aria-label="two:two"]').count(), 0);
      } finally {
        await session?.close();
        await browser?.close();
      }
    }),
);

test(
  'Close wins over a pending rebuild and the builder never publishes a superseded candidate',
  { timeout },
  () =>
    consumer(async (app) => {
      const options = { app, target: 'web', engineInputs: supply },
        initial = await buildEngineV2Application(options);
      const old = fs.readFileSync(path.join(initial.directory, 'application/app.js'));
      write(app, 'never-published');
      assert.equal(
        (await buildEngineV2Application({ ...options, canPublish: () => false })).obsolete,
        true,
      );
      assert.deepEqual(fs.readFileSync(path.join(initial.directory, 'application/app.js')), old);
      let session;
      try {
        session = await createEngineV2Development({
          ...options,
          port: 0,
          quiet: true,
          onEvent(value) {
            if (value.kind === 'build-started') void session.close();
          },
        });
        write(app, 'closed-before-replacement');
        const closed = await session.closed;
        assert.equal(closed.exitCode, 0, JSON.stringify(closed));
        assert.equal(closed.generation, 1);
      } finally {
        await session?.close();
      }
    }),
);

for (const windowsHost of ['windows-hwnd', 'windows-app-sdk'])
  test(
    'Windows ' +
      windowsHost +
      ' development replaces the drained VM/host and preserves invalid preparations',
    { timeout },
    () =>
      consumer(async (app) => {
        const events = [],
          lines = [];
        let session;
        try {
          session = await createEngineV2Development({
            app,
            target: 'windows',
            engineInputs: supply,
            quiet: true,
            onEvent: (value) => events.push(value),
            onHostLine: (line) => lines.push(line),
          });
          assert.equal(events.filter((value) => value.kind === 'native-ready').length, 1);
          const timing = events.find((value) => value.kind === 'native-ready').receipt.timing;
          assert.equal(timing.domain, 'qpc-milliseconds');
          assert.equal(timing.scope, 'initial-app-build');
          assert.ok(timing.buildElapsedMs >= 0 && timing.mountAndAckElapsedMs >= 0);
          fs.writeFileSync(path.join(app, 'src/app.ts'), 'invalid source !');
          await until(
            () => events.some((value) => value.kind === 'build-failed'),
            () => session.status,
          );
          assert.equal(session.status.generation, 1);
          assert.equal(events.filter((value) => value.kind === 'native-drained').length, 0);
          write(app, 'two');
          await until(
            () => session.status.generation === 2 && session.status.phase === 'open',
            () => ({ status: session.status, lines }),
          );
          assert.equal(events.filter((value) => value.kind === 'native-ready').length, 2);
          const drained = events.findIndex((value) => value.kind === 'native-drained'),
            ready = events.findLastIndex((value) => value.kind === 'native-ready');
          assert.ok(drained > 0 && ready > drained);
          assert.notEqual(
            events[ready].pid,
            events.find((value) => value.kind === 'native-ready').pid,
          );
          assert.ok(
            lines.some(
              (line) =>
                line.startsWith('V2_APP ') &&
                line.includes('"value":"two"') &&
                line.includes('"assetValue":"two"'),
            ),
          );
          const result = await session.close();
          assert.equal(result.exitCode, 0, JSON.stringify(result));
          for (const value of events.filter((value) => value.kind === 'native-drained')) {
            assert.equal(value.closed.memoryTotal, 0);
            assert.equal(value.closed.workersJoined, true);
          }
          if (windowsHost === 'windows-app-sdk')
            assert.equal(lines.filter((line) => line === 'V2_WINDOWS_DISPATCHER_CLOSED').length, 2);
        } finally {
          await session?.close();
        }
      }, windowsHost),
  );
