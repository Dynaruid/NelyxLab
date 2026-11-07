// SPDX-License-Identifier: BSD-3-Clause
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
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
function fixture(model) {
  return `import {ImmutableBuffer,rootBundle,CachingAssetBundle} from '@nelyx/core/services/asset-bundle';
import {${model === 'original-elements' ? 'defineOriginalEngineV2App' : 'defineEngineV2App'} as define} from '@nelyx/sdk/${model === 'original-elements' ? 'engine-v2-original' : 'engine-v2'}';
import {Text} from '@nelyx/core/${model === 'original-elements' ? 'framework/widgets/basic' : 'v2'}';
class Custom extends CachingAssetBundle{async load(){return new Uint8Array([99,1,2,3,99]).subarray(1,4);}}
let app:any,kept:ImmutableBuffer|null=null,pending:Promise<unknown>|undefined,chain=Promise.resolve();
const scope=globalThis as unknown as {addEventListener(kind:string,callback:(event:any)=>void):void;removeEventListener(kind:string,callback:(event:any)=>void):void};
const receive=(event:any)=>{if(event.data?.kind!=='buffer-phase')return;chain=chain.then(async()=>{
 const phase=event.data.phase;if(phase==='release'){kept?.dispose();kept=null;}
 if(phase==='pending')pending=rootBundle.loadBuffer('cancel.bin').then(value=>{value.dispose();throw Error('Cancelled buffer escaped');},error=>app.notify({kind:'buffer-cancelled',message:String(error)}));
 app.notify({kind:'buffer-state',phase});
}).catch(error=>app.notify({kind:'app-error',message:String(error)}));};
export default define({async build(context){
 app=context;const bytes=new Uint8Array([99,1,2,3,99]),copy=ImmutableBuffer.fromUint8List(bytes.subarray(1,4));bytes.fill(9);kept=await copy;const raw=await context.asset('한글 data.bin');if(raw[0]!==1)throw Error('Raw bytes changed');
 if(kept.length!==3||kept.debugDisposed)throw Error('Initial buffer failed');
 for(const value of [await rootBundle.loadBuffer('한글 data.bin'),await rootBundle.loadBuffer('empty.bin'),await ImmutableBuffer.fromAsset('한글 data.bin'),await new Custom().loadBuffer('custom')]){if(value.length!==0&&value.length!==3)throw Error('Asset buffer length failed');value.dispose();if(!value.debugDisposed)throw Error('Dispose failed');}
 let refused=false;try{await ImmutableBuffer.fromFilePath('not-available');}catch{refused=true;}if(!refused)throw Error('File capability failure was hidden');
 return new Text('Immutable buffers');
},ready(){scope.addEventListener('message',receive);app.notify({kind:'buffer-state',phase:'initial'});},async dispose(){scope.removeEventListener('message',receive);kept?.dispose();kept=null;await chain;await pending;}});`;
}
test(
  'Both normal SDK App models use actual immutable CanvasKit allocations, return buffer credit at the last handle and cancel pending buffer IO in both Web profiles',
  { timeout },
  async () => {
    const parent = fs.realpathSync(os.tmpdir()),
      app = fs.mkdtempSync(path.join(parent, 'engine-original-buffers-')),
      repo = path.resolve(engineRoot, '../..'),
      supply = path.join(engineRoot, 'dist');
    let browser, server;
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
      fs.mkdirSync(path.join(app, 'assets'), { recursive: true });
      fs.writeFileSync(path.join(app, 'assets/data.bin'), Buffer.from([1, 2, 3]));
      fs.writeFileSync(path.join(app, 'assets/empty.bin'), '');
      fs.writeFileSync(path.join(app, 'assets/cancel.bin'), Buffer.alloc(65536));
      fs.writeFileSync(
        path.join(app, 'nelyx.v2.json'),
        JSON.stringify({
          schema: 'nelyx.app.v2/1',
          engine: 'v2',
          entry: 'src/app.ts',
          assets: {
            '한글 data.bin': 'assets/data.bin',
            'empty.bin': 'assets/empty.bin',
            'cancel.bin': 'assets/cancel.bin',
          },
        }),
      );
      browser = await chromium.launch({ headless: true });
      for (const model of ['v2-widgets', 'original-elements']) {
        fs.writeFileSync(path.join(app, 'src/app.ts'), fixture(model));
        await buildEngineV2Application({ app, target: 'windows', engineInputs: supply });
        const built = await buildEngineV2Application({ app, target: 'web', engineInputs: supply });
        server = createEngineV2Server(verifyEngineV2Application(built.directory, 'web'));
        server.listen(0, '127.0.0.1');
        await once(server, 'listening');
        for (const profile of ['plain', 'isolated']) {
          const context = await browser.newContext({ viewport: { width: 400, height: 240 } }),
            page = await context.newPage(),
            errors = [];
          let held, entered, timer;
          const pending = new Promise((resolve) => {
            entered = resolve;
          });
          try {
            page.on('pageerror', (error) => errors.push(String(error)));
            if (model === 'v2-widgets' && profile === 'plain')
              await context.route('**/web/app-text.js', async (route) => {
                await new Promise((resolve) => setTimeout(resolve, 100));
                await route.continue();
              });
            await page.addInitScript(() => {
              const post = Worker.prototype.postMessage;
              Worker.prototype.postMessage = function (message, ...rest) {
                if (message?.kind === 'start') {
                  globalThis.__bufferWorker = this;
                  this.addEventListener('message', (event) => {
                    if (event.data.kind === 'buffer-state') globalThis.__bufferState = event.data;
                    if (event.data.kind === 'app-disposed')
                      globalThis.__bufferDisposed = event.data;
                  });
                }
                return post.call(this, message, ...rest);
              };
            });
            await context.route('**/application/assets/cancel.bin', async (route) => {
              if (route.request().method() === 'HEAD') return route.continue();
              held = route;
              entered();
            });
            await page.goto(`http://127.0.0.1:${server.address().port}/${profile}/`);
            await page.waitForFunction(() => __nelyxV2?.ready || __nelyxV2?.errors.length, null, {
              timeout: 30000,
            });
            assert.deepEqual(await page.evaluate(() => __nelyxV2.errors), []);
            const receipt = await page.evaluate(() => __nelyxV2.receipt),
              before = receipt.buffers;
            if (model === 'v2-widgets' && profile === 'plain') {
              assert.ok(receipt.timing.servicesPreparationElapsedMs >= 100);
              assert.ok(
                receipt.timing.buildElapsedMs >= receipt.timing.servicesPreparationElapsedMs,
              );
            }
            assert.ok(Number(receipt.engineWork) > 0);
            assert.equal(Number(receipt.engineWork), receipt.execution.acknowledgedCommands);
            assert.equal(before.copies, 5);
            assert.equal(before.nativeCopies, 5);
            assert.equal(before.bytes, 12);
            assert.equal(before.nativeCopyBytes, 12);
            assert.equal(before.handles, 1);
            assert.equal(before.nativeHandles, 1);
            assert.equal(before.dataBytes, 3);
            assert.equal(before.creditBytes, 65542);
            assert.equal(receipt.assets.reads, 1);
            assert.equal(receipt.assets.bufferReads, 3);
            assert.equal(receipt.assets.bufferBytes, 6);
            if (model === 'original-elements') assert.equal(receipt.execution.tsLayoutFallbacks, 0);
            else assert.equal(receipt.execution.rejectedFallbacks, 0);
            await page.evaluate(() =>
              __bufferWorker.postMessage({ kind: 'buffer-phase', phase: 'release' }),
            );
            await page.waitForFunction(() => __bufferState?.phase === 'release');
            const released = await page.evaluate(() => __bufferState);
            assert.equal(released.buffers.handles, 0);
            assert.equal(released.buffers.nativeHandles, 0);
            assert.equal(released.buffers.creditBytes, 0);
            assert.equal(released.assets.buffers, 1);
            assert.equal(released.assets.creditBytes, 65545);
            await page.evaluate(() =>
              __bufferWorker.postMessage({ kind: 'buffer-phase', phase: 'pending' }),
            );
            await Promise.race([
              pending,
              new Promise((_, reject) => {
                timer = setTimeout(
                  () => reject(Error('Pending buffer GET was not reached')),
                  30000,
                );
              }),
            ]);
            clearTimeout(timer);
            await page.evaluate(() =>
              __bufferWorker.postMessage({ kind: 'buffer-phase', phase: 'status' }),
            );
            await page.waitForFunction(() => __bufferState?.phase === 'status');
            assert.equal(await page.evaluate(() => __bufferState.buffers.pending), 1);
            const closed = await page.evaluate(() => __nelyxV2.close()),
              disposed = await page.evaluate(() => __bufferDisposed);
            assert.equal(closed.reservedBytes, 0);
            assert.equal(closed.workersStopped, true);
            assert.equal(disposed.buffers.pending, 0);
            assert.equal(disposed.buffers.handles, 0);
            assert.equal(disposed.buffers.nativeHandles, 0);
            assert.equal(disposed.buffers.creditBytes, 0);
            assert.equal(disposed.assets.buffers, 1);
            assert.deepEqual(await page.evaluate(() => __nelyxV2.errors), []);
            assert.deepEqual(errors, []);
            console.log(
              JSON.stringify({
                control: 'normal-SDK-immutable-buffers',
                model,
                profile,
                cppCommands: receipt.engineWork,
                sdkCommands: receipt.execution.acknowledgedCommands,
                buffers: before,
                readOnlyAssetReads: receipt.assets.bufferReads,
                afterLastHandleCredit: 0,
                callerByteDataCredit: disposed.assets.creditBytes,
                closedReservation: 0,
                workersStopped: true,
                appParagraphDemand:
                  model === 'original-elements' ? receipt.execution.appText.layouts : 0,
              }),
            );
          } finally {
            clearTimeout(timer);
            await page.evaluate(() => globalThis.__nelyxV2?.close?.()).catch(() => {});
            await held?.abort().catch(() => {});
            await context.close();
          }
        }
        await new Promise((resolve) => server.close(resolve));
        server = undefined;
      }
    } finally {
      await browser?.close();
      if (server) await new Promise((resolve) => server.close(resolve));
      stop();
      assert.equal(path.dirname(path.resolve(app)), parent);
      assert.match(path.basename(app), /^engine-original-buffers-/);
      fs.rmSync(app, { recursive: true, force: true, maxRetries: 3 });
    }
  },
);
