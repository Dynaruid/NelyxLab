// SPDX-License-Identifier: BSD-3-Clause
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { chromium } from 'playwright';
import { stop } from 'esbuild';
import { engineRoot, sourceIdentity, timeout } from '../tools/build.mjs';
import {
  createEngineV2Project,
  buildEngineV2Application,
  verifyEngineV2Application,
  createEngineV2Server,
} from '../../sdk/tooling/cli/src/engine-v2-runner.mjs';
import { runTypeScriptCompiler } from '../../sdk/tooling/metro/src/typescript-compiler.cjs';
import { networkAssetFixture, networkAssetProbe } from './network-assets-fixture.mjs';

function appSource(model, origin, startup) {
  const probe = networkAssetProbe
    .toString()
    .replace(
      'NetworkBundle, origin, successful',
      'NetworkBundle: typeof NetworkAssetBundle, origin: string, successful?: (value: unknown) => unknown',
    )
    .replace('(value, message)', '(value: unknown, message: string)');
  return `import {NetworkAssetBundle} from '@nelyx/core/services/asset-bundle';
import {${model === 'original-elements' ? 'defineOriginalEngineV2App' : 'defineEngineV2App'} as define} from '@nelyx/sdk/${model === 'original-elements' ? 'engine-v2-original' : 'engine-v2'}';
import {Text} from '@nelyx/core/${model === 'original-elements' ? 'framework/widgets/basic' : 'v2'}';
${probe}
const origin=${JSON.stringify(origin)},bundle=new NetworkAssetBundle(origin+'/network/');
let app:any,pending:Promise<unknown>|undefined;
const scope=globalThis as unknown as {addEventListener?(kind:string,callback:(event:any)=>void):void;removeEventListener?(kind:string,callback:(event:any)=>void):void};
const receive=(event:any)=>{if(event.data?.kind!=='network-phase')return;
 if(event.data.phase==='pending')pending=bundle.load('stall').then(()=>{throw Error('Cancelled network bytes escaped');},error=>app.notify({kind:'network-cancelled',message:String(error)}));
 app.notify({kind:'network-state',phase:event.data.phase});};
export default define({async build(context){app=context;${startup ? "await bundle.load('stall-headers');throw Error('Cancelled startup network read escaped');" : "const result=await networkAssetProbe(NetworkAssetBundle,origin);app.notify({kind:'network-contracts',result});return new Text('Network assets');"}},ready(){scope.addEventListener?.('message',receive);app.notify({kind:'network-state',phase:'initial'});},async dispose(){scope.removeEventListener?.('message',receive);await pending;}});`;
}
test(
  'Both normal SDK App models stream NetworkAssetBundle responses, preserve immutable ownership and cancel startup/runtime IO in both Web profiles',
  { timeout },
  async () => {
    const parent = fs.realpathSync(os.tmpdir()),
      app = fs.mkdtempSync(path.join(parent, 'engine-original-network-')),
      repo = path.resolve(engineRoot, '../..'),
      supply = path.join(engineRoot, 'dist');
    const fixture = networkAssetFixture();
    let server, browser, bundleServer;
    try {
      const manifest = JSON.parse(fs.readFileSync(path.join(supply, 'engine-manifest.json')));
      assert.equal(manifest.sourceSha256, sourceIdentity());
      assert.equal(manifest.appText.version, 12);
      createEngineV2Project(app);
      fs.mkdirSync(path.join(app, 'node_modules/@nelyx'), { recursive: true });
      for (const [name, relative] of [
        ['core', 'Nelyx'],
        ['sdk', 'Nelyx/sdk'],
      ])
        fs.symlinkSync(
          path.join(repo, relative),
          path.join(app, 'node_modules/@nelyx', name),
          'junction',
        );
      server = createServer((request, response) => {
        if (fixture.handle(request, response)) return;
        if (bundleServer) bundleServer.emit('request', request, response);
        else {
          response.writeHead(503);
          response.end();
        }
      });
      server.listen(0, '127.0.0.1');
      await once(server, 'listening');
      const origin = 'http://127.0.0.1:' + server.address().port;
      browser = await chromium.launch({ headless: true });
      for (const model of ['v2-widgets', 'original-elements'])
        for (const startup of [false, true]) {
          fs.writeFileSync(path.join(app, 'src/app.ts'), appSource(model, origin, startup));
          for (const target of ['windows', 'web']) {
            const config = path.join(app, 'tsconfig.network.json');
            fs.writeFileSync(
              config,
              JSON.stringify({
                compilerOptions: {
                  strict: true,
                  noEmit: true,
                  skipLibCheck: false,
                  types: [],
                  lib: target === 'web' ? ['ES2022', 'DOM'] : ['ES2022'],
                  target: 'ES2022',
                  module: 'NodeNext',
                  moduleResolution: 'NodeNext',
                  customConditions: target === 'web' ? ['browser'] : [],
                },
                files: ['src/app.ts'],
              }),
            );
            const checked = runTypeScriptCompiler(
              repo,
              ['-p', config, '--pretty', 'false'],
              '@typescript/native',
            );
            assert.equal(checked.version, '7.0.2');
            assert.equal(checked.status, 0, checked.stdout + checked.stderr);
            const built = await buildEngineV2Application({ app, target, engineInputs: supply });
            if (target === 'web')
              bundleServer = createEngineV2Server(
                verifyEngineV2Application(built.directory, 'web'),
              );
          }
          for (const profile of ['plain', 'isolated']) {
            const context = await browser.newContext({ viewport: { width: 400, height: 240 } }),
              page = await context.newPage(),
              errors = [];
            const before = fixture.calls.length;
            try {
              page.on('pageerror', (error) => errors.push(String(error)));
              await page.addInitScript(() => {
                const post = Worker.prototype.postMessage;
                Worker.prototype.postMessage = function (message, ...rest) {
                  if (message?.kind === 'start') {
                    globalThis.__networkWorker = this;
                    this.addEventListener('message', (event) => {
                      if (event.data.kind === 'network-state')
                        globalThis.__networkState = event.data;
                      if (event.data.kind === 'network-contracts')
                        globalThis.__networkContracts = event.data;
                      if (event.data.kind === 'app-disposed')
                        globalThis.__networkDisposed = event.data;
                    });
                  }
                  return post.call(this, message, ...rest);
                };
              });
              await page.goto(origin + '/' + profile + '/');
              if (startup) {
                const deadline = Date.now() + 30000;
                while (
                  !fixture.calls
                    .slice(before)
                    .some((call) => call.name === '/network/stall-headers')
                ) {
                  assert.ok(Date.now() < deadline, 'Startup HTTP request was not reached');
                  await new Promise((resolve) => setTimeout(resolve, 5));
                }
                const closed = await page.evaluate(() => __nelyxV2.close());
                assert.equal(closed.workersStopped, true);
                assert.equal(closed.reservedBytes, 0);
                const disposed = await page.evaluate(() => __networkDisposed);
                assert.equal(disposed.assets.pending, 0);
                assert.equal(disposed.assets.networkCreditBytes, 0);
                assert.equal(disposed.assets.creditBytes, 0);
                assert.equal(disposed.buffers.creditBytes, 0);
                console.log(
                  JSON.stringify({
                    control: 'normal-SDK-network-startup-cancel',
                    model,
                    profile,
                    assets: disposed.assets,
                    workersStopped: true,
                    reservedBytes: 0,
                  }),
                );
              } else {
                await page.waitForFunction(
                  () => globalThis.__nelyxV2?.ready || globalThis.__nelyxV2?.errors.length,
                  null,
                  { timeout: 30000 },
                );
                assert.deepEqual(await page.evaluate(() => __nelyxV2.errors), []);
                const receipt = await page.evaluate(() => __nelyxV2.receipt),
                  assets = receipt.assets,
                  buffers = receipt.buffers;
                assert.equal(assets.networkReads, 14);
                assert.equal(assets.networkBytes, 86);
                assert.equal(assets.networkBufferReads, 1);
                assert.equal(assets.networkBufferBytes, 3);
                assert.equal(assets.networkCreditBytes, 0);
                assert.equal(assets.buffers, 14);
                assert.equal(assets.creditBytes, 917762);
                assert.equal(assets.failedCredits, 0);
                assert.equal(assets.failedClosures, 0);
                assert.equal(buffers.copies, 1);
                assert.equal(buffers.bytes, 3);
                assert.equal(buffers.nativeCopies, 1);
                assert.equal(buffers.nativeCopyBytes, 3);
                assert.equal(buffers.creditBytes, 0);
                assert.equal(buffers.handles, 0);
                assert.ok(Number(receipt.engineWork) > 0);
                assert.equal(Number(receipt.engineWork), receipt.execution.acknowledgedCommands);
                if (model === 'original-elements') {
                  assert.equal(receipt.execution.tsLayoutFallbacks, 0);
                  assert.equal(receipt.execution.appText.layouts, 0);
                } else assert.equal(receipt.execution.rejectedFallbacks, 0);
                assert.equal(
                  fixture.calls.slice(before).filter((call) => call.name !== '/network/stall')
                    .length,
                  22,
                );
                await page.evaluate(() =>
                  __networkWorker.postMessage({ kind: 'network-phase', phase: 'pending' }),
                );
                await page.waitForFunction(() => __networkState?.phase === 'pending');
                const deadline = Date.now() + 30000;
                while (true) {
                  await page.evaluate(() =>
                    __networkWorker.postMessage({ kind: 'network-phase', phase: 'status' }),
                  );
                  await page.waitForFunction(() => __networkState?.phase === 'status');
                  const state = await page.evaluate(() => __networkState.assets);
                  if (state.pending === 1 && state.creditBytes > 917762 + 65536) break;
                  assert.ok(Date.now() < deadline, 'Pending HTTP body was not consumed');
                  await new Promise((resolve) => setTimeout(resolve, 5));
                }
                const closed = await page.evaluate(() => __nelyxV2.close()),
                  disposed = await page.evaluate(() => __networkDisposed);
                assert.equal(closed.workersStopped, true);
                assert.equal(closed.reservedBytes, 0);
                assert.equal(disposed.assets.pending, 0);
                assert.equal(disposed.assets.networkCreditBytes, 0);
                assert.equal(disposed.assets.creditBytes, 917762);
                assert.equal(disposed.buffers.creditBytes, 0);
                console.log(
                  JSON.stringify({
                    control: 'normal-SDK-NetworkAssetBundle',
                    model,
                    profile,
                    cppCommands: receipt.engineWork,
                    sdkCommands: receipt.execution.acknowledgedCommands,
                    assets,
                    buffers,
                    appParagraphDemand: 0,
                    workersStopped: true,
                    reservedBytes: 0,
                  }),
                );
              }
              assert.deepEqual(await page.evaluate(() => __nelyxV2.errors), []);
              assert.deepEqual(errors, []);
            } finally {
              await page.evaluate(() => globalThis.__nelyxV2?.close?.()).catch(() => {});
              await context.close();
            }
          }
          bundleServer = undefined;
        }
    } finally {
      await browser?.close();
      fixture.close();
      if (server) {
        server.closeAllConnections();
        await new Promise((resolve) => server.close(resolve));
      }
      stop();
      assert.equal(path.dirname(path.resolve(app)), parent);
      assert.ok(path.basename(app).startsWith('engine-original-network-'));
      fs.rmSync(app, { recursive: true, force: true, maxRetries: 3 });
    }
  },
);
