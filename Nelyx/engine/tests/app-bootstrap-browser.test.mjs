// SPDX-License-Identifier: BSD-3-Clause
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { once } from 'node:events';
import { chromium } from 'playwright';
import { stop } from 'esbuild';
import { engineRoot, timeout, sourceIdentity } from '../tools/build.mjs';
import {
  createEngineV2Project,
  buildEngineV2Application,
  verifyEngineV2Application,
  createEngineV2Server,
} from '../../sdk/tooling/cli/src/engine-v2-runner.mjs';

// Fault controls wrap the actual App worker; the verified CanvasKit/service
// scripts, Wasm binary and fonts still come from the normal packaged supply.
function harness(mode) {
  return `(()=>{
 const mode=${JSON.stringify(mode)},report=value=>postMessage({kind:'bootstrap-control',...value});
 const fetchOriginal=fetch;globalThis.fetch=async(input,options)=>{
  const aborted=()=>report({phase:'aborted',url:String(input)});
  options?.signal?.addEventListener('abort',aborted,{once:true});
  try{return await fetchOriginal(input,options);}finally{options?.signal?.removeEventListener('abort',aborted);}
 };
 const postOriginal=MessagePort.prototype.postMessage;
 MessagePort.prototype.postMessage=function(message,...rest){
  if(mode==='reservation'&&message?.kind==='app-text-reserve'){report({phase:'reservation'});return;}
  return postOriginal.call(this,message,...rest);
 };
 let release;const gate=new Promise(resolve=>release=resolve);
 addEventListener('message',event=>{
  if(event.data?.kind==='bootstrap-release')release();
  if(event.data?.kind==='close')report({phase:'close-observed'});
  if(event.data?.kind==='bootstrap-barrier')report({phase:'barrier'});
 });
 if(mode==='factory'){
  const importOriginal=importScripts;let wrapped=false;
  globalThis.importScripts=(...urls)=>{
   importOriginal(...urls);
   if(!wrapped&&typeof globalThis.CanvasKitInit==='function'){
    wrapped=true;const factory=globalThis.CanvasKitInit;
    globalThis.CanvasKitInit=async options=>{
     const runtime=await factory(options);report({phase:'factory',heapBytes:runtime.HEAPU8.byteLength});
     await gate;return runtime;
    };
   }
  };
 }
 if(mode==='old-network'){
  const importOriginal=importScripts;let wrapped=false;
  globalThis.importScripts=(...urls)=>{
   importOriginal(...urls);
   const factory=globalThis.NelyxV2AppText;
   if(!wrapped&&factory){wrapped=true;globalThis.NelyxV2AppText={...factory,loadAppText:async(...args)=>{
    const backend=await factory.loadAppText(...args);backend.networkVersion=1;return backend;
   }};}
  };
 }
})();\n`;
}

test(
  'Normal SDK startup cancels reservation, module and provider IO, drains failed siblings and waits for late actual Wasm initialization in both Web profiles',
  { timeout },
  async () => {
    const parent = fs.realpathSync(os.tmpdir()),
      app = fs.mkdtempSync(path.join(parent, 'engine-app-bootstrap-')),
      repo = path.resolve(engineRoot, '../..'),
      supply = path.join(engineRoot, 'dist');
    let browser, server;
    let controls = 0;
    try {
      const manifest = JSON.parse(fs.readFileSync(path.join(supply, 'engine-manifest.json')));
      assert.equal(manifest.sourceSha256, sourceIdentity());
      assert.equal(manifest.appText.bootstrapVersion, 1);
      createEngineV2Project(app);
      fs.mkdirSync(path.join(app, 'node_modules/@nelyx'), { recursive: true });
      for (const [name, source] of [
        ['core', 'Nelyx'],
        ['sdk', 'Nelyx/sdk'],
      ])
        fs.symlinkSync(
          path.join(repo, source),
          path.join(app, 'node_modules/@nelyx', name),
          'junction',
        );
      fs.mkdirSync(path.join(app, 'assets'), { recursive: true });
      fs.writeFileSync(path.join(app, 'assets/control.txt'), 'ready');
      fs.writeFileSync(
        path.join(app, 'nelyx.v2.json'),
        JSON.stringify({
          schema: 'nelyx.app.v2/1',
          engine: 'v2',
          entry: 'src/app.ts',
          assets: { 'control.txt': 'assets/control.txt' },
        }),
      );
      browser = await chromium.launch({ headless: true });
      for (const model of ['v2-widgets', 'original-elements']) {
        fs.writeFileSync(
          path.join(app, 'src/app.ts'),
          `
import {rootBundle} from '@nelyx/core/services/asset-bundle';
import {${model === 'v2-widgets' ? 'defineEngineV2App' : 'defineOriginalEngineV2App'} as define} from '@nelyx/sdk/${model === 'v2-widgets' ? 'engine-v2' : 'engine-v2-original'}';
import {Text} from '@nelyx/core/${model === 'v2-widgets' ? 'v2' : 'framework/widgets/basic'}';
export default define({async build(context){
 if(await rootBundle.loadString('control.txt')!=='ready')throw Error('Unexpected bytes');
 context.notify({kind:'bootstrap-built'});return new Text('Ready');
}});`,
        );
        const built = await buildEngineV2Application({ app, target: 'web', engineInputs: supply });
        server = createEngineV2Server(verifyEngineV2Application(built.directory, 'web'));
        server.listen(0, '127.0.0.1');
        await once(server, 'listening');
        const modes = ['manifest', 'module', 'provider-manifest', 'wasm', 'font'];
        if (model === 'original-elements')
          modes.push('reservation', 'factory', 'failure', 'old-supply', 'old-network');
        for (const profile of ['plain', 'isolated'])
          for (const mode of modes) {
            const context = await browser.newContext({ viewport: { width: 400, height: 240 } }),
              page = await context.newPage(),
              pageErrors = [],
              held = [];
            let armed = false,
              manifestReads = 0,
              moduleReads = 0,
              entered,
              timer;
            const pending = new Promise((resolve) => {
              entered = resolve;
            });
            try {
              page.on('pageerror', (error) => pageErrors.push(String(error)));
              await page.addInitScript(() => {
                globalThis.__bootstrapEvents = [];
                const post = Worker.prototype.postMessage;
                Worker.prototype.postMessage = function (message, ...rest) {
                  if (message?.kind === 'start')
                    this.addEventListener('message', (event) => {
                      globalThis.__bootstrapEvents.push(event.data);
                    });
                  return post.call(this, message, ...rest);
                };
              });
              await context.route('**/*', async (route) => {
                const pathname = new URL(route.request().url()).pathname;
                if (pathname.endsWith('/application/app.js')) {
                  armed = true;
                  const response = await route.fetch();
                  return route.fulfill({ response, body: harness(mode) + (await response.text()) });
                }
                if (!armed) return route.continue();
                if (pathname.endsWith('/engine-manifest.json')) {
                  ++manifestReads;
                  if (mode === 'old-supply' && manifestReads === 1) {
                    const response = await route.fetch(),
                      value = await response.json();
                    delete value.appText.bootstrapVersion;
                    return route.fulfill({ response, json: value });
                  }
                }
                if (pathname.endsWith('/web/app-text.js')) ++moduleReads;
                const hold =
                  (mode === 'manifest' &&
                    manifestReads === 1 &&
                    pathname.endsWith('/engine-manifest.json')) ||
                  (mode === 'provider-manifest' &&
                    manifestReads === 2 &&
                    pathname.endsWith('/engine-manifest.json')) ||
                  (mode === 'module' && pathname.endsWith('/web/app-text.js')) ||
                  ((mode === 'wasm' || mode === 'failure') &&
                    pathname.endsWith('/canvaskit/canvaskit.wasm')) ||
                  (mode === 'font' && pathname.endsWith('/assets/font.ttf'));
                if (hold) {
                  held.push(route);
                  entered();
                  return;
                }
                if (mode === 'failure' && pathname.endsWith('/assets/font.ttf')) {
                  await pending;
                  return route.fulfill({ status: 503, body: 'controlled unavailable font' });
                }
                return route.continue();
              });
              await page.goto(`http://127.0.0.1:${server.address().port}/${profile}/`);
              if (mode === 'reservation' || mode === 'factory') {
                await page.waitForFunction(
                  (phase) =>
                    __bootstrapEvents.some(
                      (value) => value.kind === 'bootstrap-control' && value.phase === phase,
                    ),
                  mode,
                  { timeout: 30000 },
                );
              } else if (mode !== 'old-supply' && mode !== 'old-network') {
                await Promise.race([
                  pending,
                  new Promise((_, reject) => {
                    timer = setTimeout(
                      () =>
                        reject(Error(`Bootstrap control not reached: ${model}/${profile}/${mode}`)),
                      30000,
                    );
                  }),
                ]);
                clearTimeout(timer);
              }
              if (mode !== 'reservation')
                await page.waitForFunction(
                  () => __nelyxV2.surface?.diagnostics.appText?.reservedBytes === 320 * 1024 * 1024,
                );
              if (mode === 'factory') {
                await page.evaluate(() => __nelyxV2.app.postMessage({ kind: 'close' }));
                await page.waitForFunction(() =>
                  __bootstrapEvents.some((value) => value.phase === 'close-observed'),
                );
                await page.evaluate(() => __nelyxV2.app.postMessage({ kind: 'bootstrap-barrier' }));
                await page.waitForFunction(() =>
                  __bootstrapEvents.some((value) => value.phase === 'barrier'),
                );
                assert.equal(
                  await page.evaluate(() =>
                    __bootstrapEvents.some((value) => value.kind === 'app-disposed'),
                  ),
                  false,
                );
                assert.equal(
                  await page.evaluate(
                    () => __bootstrapEvents.find((value) => value.phase === 'factory').heapBytes,
                  ),
                  128 * 1024 * 1024,
                );
                await page.evaluate(() => __nelyxV2.app.postMessage({ kind: 'bootstrap-release' }));
              }
              if (
                mode === 'failure' ||
                mode === 'old-supply' ||
                mode === 'old-network' ||
                mode === 'factory'
              )
                await page.waitForFunction(() =>
                  __bootstrapEvents.some((value) => value.kind === 'app-disposed'),
                );
              if (mode === 'failure' || mode === 'old-supply' || mode === 'old-network') {
                await page.waitForFunction(() => __nelyxV2.errors.length === 1);
                const errors = await page.evaluate(() => __nelyxV2.errors);
                assert.match(
                  errors[0],
                  mode === 'failure'
                    ? /Asset HTTP 503/
                    : mode === 'old-network'
                      ? /Required App HTTP header service version 2/
                      : /Required App paragraph supply/,
                );
                if (mode === 'old-supply') assert.equal(moduleReads, 0);
                if (mode === 'failure')
                  assert.ok(
                    await page.evaluate(() =>
                      __bootstrapEvents.some(
                        (value) =>
                          value.phase === 'aborted' &&
                          value.url.endsWith('/canvaskit/canvaskit.wasm'),
                      ),
                    ),
                  );
              }
              const closed = await page.evaluate(() => __nelyxV2.close());
              assert.equal(closed.reservedBytes, 0);
              assert.equal(closed.workersStopped, true);
              const events = await page.evaluate(() => __bootstrapEvents),
                disposed = events.find((value) => value.kind === 'app-disposed');
              assert.ok(disposed);
              assert.equal(disposed.assets.closed, true);
              assert.equal(disposed.assets.pending, 0);
              assert.equal(disposed.assets.reads, 0);
              assert.equal(disposed.assets.creditBytes, 0);
              assert.equal(
                events.some(
                  (value) => value.kind === 'app-ready' || value.kind === 'bootstrap-built',
                ),
                false,
              );
              assert.deepEqual(pageErrors, []);
              if (mode !== 'failure' && mode !== 'old-supply' && mode !== 'old-network')
                assert.deepEqual(await page.evaluate(() => __nelyxV2.errors), []);
              ++controls;
              console.log(
                JSON.stringify({
                  control: 'normal-SDK-bootstrap',
                  model,
                  profile,
                  mode,
                  hostCreditUntilWorkerExit: mode === 'reservation' ? 0 : 320 * 1024 * 1024,
                  actualWasmHeapBytes: mode === 'factory' ? 128 * 1024 * 1024 : null,
                  pendingAssets: disposed.assets.pending,
                  closedReservation: closed.reservedBytes,
                  workersStopped: closed.workersStopped,
                  renderDemand: 'startup-control',
                }),
              );
            } finally {
              clearTimeout(timer);
              await page
                .evaluate(() => {
                  __nelyxV2?.app?.postMessage({ kind: 'bootstrap-release' });
                  return __nelyxV2?.close?.();
                })
                .catch(() => {});
              for (const route of held) await route.abort().catch(() => {});
              await context.close();
            }
          }
        await new Promise((resolve) => server.close(resolve));
        server = undefined;
      }
      assert.equal(controls, 30);
    } finally {
      await browser?.close();
      if (server) await new Promise((resolve) => server.close(resolve));
      stop();
      assert.equal(path.dirname(path.resolve(app)), parent);
      assert.match(path.basename(app), /^engine-app-bootstrap-/);
      fs.rmSync(app, { recursive: true, force: true, maxRetries: 3 });
    }
  },
);
