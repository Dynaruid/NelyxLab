// SPDX-License-Identifier: BSD-3-Clause
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
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
const common = String.raw`
import {rootBundle} from '@nelyx/core/services/asset-bundle';
import {AssetManifest} from '@nelyx/core/services/asset-manifest';
let app:any,chain=Promise.resolve(),pending:Promise<unknown>|undefined;
async function checks(){
 if(await rootBundle.loadString('text.txt')!=='hello 한글')throw Error('UTF-8 text failed');
 await rootBundle.loadString('text.txt');await rootBundle.loadString('text.txt',{cache:false});
 let refused=false;try{await rootBundle.loadStructuredData('data.json',()=>{throw Error('parser refused');});}catch{refused=true;}if(!refused)throw Error('Parser failure was accepted');
 const parsed=await rootBundle.loadStructuredData('data.json',JSON.parse);if(parsed.value!==2)throw Error('Structured retry failed');
 if(await rootBundle.loadStructuredData('data.json',()=>{throw Error('cached parser ran');})!==parsed)throw Error('Structured identity changed');
 rootBundle.evict('data.json');await rootBundle.loadStructuredData('data.json',JSON.parse);
 const bytes=await rootBundle.load('한글 data.bin');if(bytes.length!==3||bytes[0]!==1||(await rootBundle.load('empty.bin')).length!==0)throw Error('Binary/empty asset failed');
 const manifest=await AssetManifest.loadFromAssetBundle(rootBundle);if(AssetManifest.tryGetFromAssetBundle(rootBundle)!==manifest||await AssetManifest.loadFromAssetBundle(rootBundle)!==manifest)throw Error('Manifest cache failed');
 if(!manifest.listAssets().includes('한글 data.bin')||manifest.getAssetVariants('icon.bin')?.length!==2)throw Error('Generated asset variants failed');
 for(const key of ['../text.txt','a//b','/text.txt','bad?key']){refused=false;try{await rootBundle.load(key);}catch{refused=true;}if(!refused)throw Error('Invalid key accepted');}
}
async function phase(value:string){if(value==='pending'){
 pending=rootBundle.load('cancel.bin').then(()=>{throw Error('Cancelled bytes escaped');},error=>app.notify({kind:'asset-cancelled',message:String(error)}));app.notify({kind:'asset-state',phase:'pending-start'});return;
 }if(value==='status'){app.notify({kind:'asset-state',phase:'status'});return;}
 let error='';try{await rootBundle.load(value==='hash'?'hash.bin':'oversize.bin');}catch(fault){error=String(fault);}if(!error)throw Error('Invalid asset response succeeded');app.notify({kind:'asset-state',phase:value,error});}
const scope=globalThis as unknown as {addEventListener?:(kind:string,callback:(event:{data:{kind:string;phase:string}})=>void)=>void;removeEventListener?:(kind:string,callback:(event:{data:{kind:string;phase:string}})=>void)=>void};
const receive=(event:{data:{kind:string;phase:string}})=>{if(event.data?.kind==='asset-phase')chain=chain.then(()=>phase(event.data.phase)).catch(error=>app.notify({kind:'app-error',message:String(error)}));};
async function ready(context:any){app=context;scope.addEventListener?.('message',receive);app.notify({kind:'asset-state',phase:'initial'});}
async function dispose(){scope.removeEventListener?.('message',receive);await chain;await pending;}
`;
const original =
  common +
  String.raw`
import {defineOriginalEngineV2App} from '@nelyx/sdk/engine-v2-original';
import {StatelessWidget} from '@nelyx/core/framework/widgets/framework';
import type {BuildContext} from '@nelyx/core/framework/widgets/framework';
import {DefaultAssetBundle} from '@nelyx/core/framework/widgets/default-asset-bundle';
import {CachingAssetBundle} from '@nelyx/core/services/asset-bundle';
import {Column,Text} from '@nelyx/core/framework/widgets/basic';
import {TextStyle} from '@nelyx/core/framework/painting/text-style';
import {FontLoader} from '@nelyx/core/services/font-loader';
class Custom extends CachingAssetBundle{load(key:string){return rootBundle.load(key);}}
const custom=new Custom();
class Root extends StatelessWidget{constructor(readonly expected:unknown){super();}override build(context:BuildContext){if(DefaultAssetBundle.of(context)!==this.expected)throw Error('Default/inherited bundle identity failed');return new Text('אבגד assets',{direction:'ltr',style:new TextStyle({fontFamily:'AssetFont'})});}}
export default defineOriginalEngineV2App({async build(){const loader=new FontLoader('AssetFont');loader.addFont(rootBundle.load('font.ttf'));await loader.load();await checks();return new Column([new Root(rootBundle),new DefaultAssetBundle(custom,new Root(custom))]);},ready,dispose});`;
const data =
  common +
  String.raw`
import {defineEngineV2App} from '@nelyx/sdk/engine-v2';
import {Text} from '@nelyx/core/v2';
export default defineEngineV2App({async build(){await checks();return new Text('Assets');},ready,dispose});`;
test(
  'Packaged root assets serve Source and data SDK apps with real ownership, manifest/cache semantics, HTTP integrity and pending-read close in both Web profiles',
  { timeout },
  async () => {
    const parent = fs.realpathSync(os.tmpdir()),
      app = fs.mkdtempSync(path.join(parent, 'engine-original-assets-')),
      repo = path.resolve(engineRoot, '../..'),
      supply = path.join(engineRoot, 'dist');
    let browser, server;
    try {
      assert.equal(
        JSON.parse(fs.readFileSync(path.join(supply, 'engine-manifest.json'))).sourceSha256,
        sourceIdentity(),
      );
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
      for (const [name, bytes] of [
        ['text.txt', 'hello 한글'],
        ['data.json', '{"value":2}'],
        ['한글 data.bin', Buffer.from([1, 2, 3])],
        ['empty.bin', ''],
        ['icon.bin', 'base'],
        ['2.0x/icon.bin', 'variant'],
        ['hash.bin', 'abcd'],
        ['oversize.bin', 'x'],
        ['cancel.bin', Buffer.alloc(256 * 1024)],
      ]) {
        const target = path.join(app, 'assets', name);
        fs.mkdirSync(path.dirname(target), { recursive: true });
        fs.writeFileSync(target, bytes);
      }
      fs.copyFileSync(
        path.join(supply, 'assets/NotoSansHebrew.ttf'),
        path.join(app, 'assets/font.ttf'),
      );
      const names = [
        'text.txt',
        'data.json',
        '한글 data.bin',
        'empty.bin',
        'icon.bin',
        '2.0x/icon.bin',
        'hash.bin',
        'oversize.bin',
        'cancel.bin',
        'font.ttf',
      ];
      fs.writeFileSync(
        path.join(app, 'nelyx.v2.json'),
        JSON.stringify({
          schema: 'nelyx.app.v2/1',
          engine: 'v2',
          entry: 'src/app.ts',
          assets: Object.fromEntries(names.map((name) => [name, 'assets/' + name])),
        }),
      );
      browser = await chromium.launch({ headless: true });
      for (const [model, fixture] of [
        ['original-elements', original],
        ['v2-widgets', data],
        [
          'original-startup-cancel',
          original.replace(
            'await checks();',
            "await rootBundle.load('cancel.bin');await checks();",
          ),
        ],
      ]) {
        fs.writeFileSync(path.join(app, 'src/app.ts'), fixture);
        if (model === 'original-elements') {
          const configuration = path.join(app, 'nelyx.v2.json'),
            valid = fs.readFileSync(configuration, 'utf8'),
            parsed = JSON.parse(valid);
          for (const extra of [
            { 'ASSETMANIFEST.BIN': 'assets/empty.bin' },
            { 'Case.bin': 'assets/empty.bin', 'case.bin': 'assets/empty.bin' },
            { 'Folder/a.bin': 'assets/empty.bin', 'folder/b.bin': 'assets/empty.bin' },
          ]) {
            fs.writeFileSync(
              configuration,
              JSON.stringify({ ...parsed, assets: { ...parsed.assets, ...extra } }),
            );
            await assert.rejects(
              buildEngineV2Application({ app, target: 'web', engineInputs: supply }),
              /manifest keys are generated|paths collide/,
            );
          }
          fs.writeFileSync(configuration, valid);
        }
        await buildEngineV2Application({ app, target: 'windows', engineInputs: supply });
        const built = await buildEngineV2Application({ app, target: 'web', engineInputs: supply });
        server = createEngineV2Server(verifyEngineV2Application(built.directory, 'web'));
        server.listen(0, '127.0.0.1');
        await once(server, 'listening');
        for (const route of ['plain', 'isolated']) {
          const context = await browser.newContext({ viewport: { width: 400, height: 240 } }),
            page = await context.newPage(),
            pageErrors = [];
          const catalogHosting = model === 'v2-widgets' && route === 'plain';
          let held;
          page.on('pageerror', (error) => pageErrors.push(String(error)));
          let getOversize = 0,
            entered;
          const pendingEntered = new Promise((resolve) => {
            entered = resolve;
          });
          try {
            if (catalogHosting)
              await context.route('**/application/assets/**', async (request) => {
                if (request.request().method() === 'HEAD') return request.fulfill({ status: 405 });
                const response = await request.fetch(),
                  headers = response.headers();
                delete headers['x-nelyx-asset-sha256'];
                await request.fulfill({ response, headers });
              });
            await context.route('**/application/assets/hash.bin', async (request) => {
              if (request.request().method() === 'HEAD') return request.continue();
              await request.fulfill({
                status: 200,
                headers: {
                  'content-length': '4',
                  'x-nelyx-asset-sha256': createHash('sha256').update('abcd').digest('hex'),
                },
                body: 'xxxx',
              });
            });
            await context.route('**/application/assets/oversize.bin', async (request) => {
              if (request.request().method() !== 'HEAD') {
                ++getOversize;
                return request.abort();
              }
              await request.fulfill({
                status: 200,
                headers: {
                  'content-length': String(32 * 1024 * 1024 + 1),
                  'x-nelyx-asset-sha256': '0'.repeat(64),
                },
              });
            });
            await context.route('**/application/assets/cancel.bin', async (request) => {
              if (request.request().method() === 'HEAD') return request.continue();
              held = request;
              entered();
            });
            await page.addInitScript(() => {
              const post = Worker.prototype.postMessage;
              Worker.prototype.postMessage = function (message, ...args) {
                if (message?.kind === 'start') {
                  globalThis.__assetWorker = this;
                  this.addEventListener('message', (event) => {
                    if (event.data?.kind === 'asset-state') globalThis.__assetState = event.data;
                    if (event.data?.kind === 'app-disposed')
                      globalThis.__assetDisposed = event.data;
                  });
                }
                return Reflect.apply(post, this, [message, ...args]);
              };
            });
            await page.goto('http://127.0.0.1:' + server.address().port + '/' + route + '/');
            if (model === 'original-startup-cancel') {
              await pendingEntered;
              const closed = await page.evaluate(() => __nelyxV2.close());
              assert.equal(closed.reservedBytes, 0);
              assert.equal(closed.workersStopped, true);
              assert.deepEqual(await page.evaluate(() => __nelyxV2.errors), []);
              const disposed = await page.evaluate(() => __assetDisposed);
              assert.ok(disposed);
              assert.equal(disposed.assets.pending, 0);
              assert.equal(disposed.assets.closed, true);
              assert.equal(disposed.assets.reads, 1);
              assert.equal(disposed.assets.buffers, 1);
              assert.deepEqual(pageErrors, []);
              console.log(
                JSON.stringify({
                  control: 'startup-owned-asset-cancel',
                  model,
                  route,
                  assets: disposed.assets,
                  closedReservation: 0,
                  workersStopped: true,
                }),
              );
              continue;
            }
            await page.waitForFunction(() => __nelyxV2?.ready || __nelyxV2?.errors.length, null, {
              timeout: 30000,
            });
            assert.deepEqual(await page.evaluate(() => __nelyxV2.errors), []);
            const initial = await page.evaluate(() => ({
                receipt: __nelyxV2.receipt,
                state: __assetState,
              })),
              budget = initial.state.assets;
            assert.equal(initial.receipt.execution.selected, 'engine-v2-cpp');
            assert.ok(BigInt(initial.receipt.engineWork) > 0n);
            assert.equal(
              initial.receipt.engineWork,
              String(initial.receipt.execution.acknowledgedCommands),
            );
            assert.equal(initial.receipt.execution.rejectedFallbacks, 0);
            assert.ok(
              budget.reads >= 8 &&
                budget.bytes > 0 &&
                budget.buffers === budget.reads + budget.metadataBuffers &&
                budget.creditBytes > budget.bytes,
            );
            assert.equal(budget.nativeReads, 0);
            assert.equal(budget.metadataBuffers, catalogHosting ? 1 : 0);
            assert.equal(budget.pending, 0);
            if (model === 'original-elements') {
              assert.equal(initial.receipt.execution.tsLayoutFallbacks, 0);
              const text = initial.receipt.execution.appText;
              assert.equal(text.version, 12);
              assert.equal(text.layouts, text.sdkLayouts);
              assert.ok(text.fontLoads > 0, JSON.stringify(text));
              assert.ok(text.fontFamilies.includes('AssetFont'));
            }
            for (const phase of ['hash', 'oversize']) {
              await page.evaluate(
                (phase) => __assetWorker.postMessage({ kind: 'asset-phase', phase }),
                phase,
              );
              await page.waitForFunction((phase) => __assetState?.phase === phase, phase);
              const state = await page.evaluate(() => __assetState);
              assert.match(state.error, phase === 'hash' ? /identity differs/ : /resource budget/);
              assert.equal(state.assets.buffers, budget.buffers);
              assert.equal(state.assets.creditBytes, budget.creditBytes);
              assert.equal(state.assets.failedCredits, 0);
            }
            assert.equal(getOversize, 0);
            await page.evaluate(() =>
              __assetWorker.postMessage({ kind: 'asset-phase', phase: 'pending' }),
            );
            await pendingEntered;
            await page.evaluate(() =>
              __assetWorker.postMessage({ kind: 'asset-phase', phase: 'status' }),
            );
            await page.waitForFunction(() => __assetState?.phase === 'status');
            const active = await page.evaluate(() => __assetState.assets);
            assert.equal(active.pending, 1);
            assert.equal(active.buffers, budget.buffers + 1);
            const closed = await page.evaluate(() => __nelyxV2.close());
            assert.equal(closed.reservedBytes, 0);
            assert.equal(closed.workersStopped, true);
            const disposed = await page.evaluate(() => __assetDisposed);
            assert.ok(disposed);
            assert.equal(disposed.assets.closed, true);
            assert.equal(disposed.assets.pending, 0);
            assert.equal(disposed.assets.buffers, budget.reads);
            assert.equal(
              disposed.assets.creditBytes,
              budget.creditBytes - budget.metadataCreditBytes,
            );
            assert.equal(disposed.assets.metadataBuffers, 0);
            assert.deepEqual(pageErrors, []);
            console.log(
              JSON.stringify({
                control: 'normal-SDK-root-assets',
                model,
                route,
                cppCommands: initial.receipt.engineWork,
                sdkCommands: initial.receipt.execution.acknowledgedCommands,
                assets: budget,
                catalogHosting,
                cancelledPending: true,
                closedReservation: 0,
                workersStopped: true,
              }),
            );
          } finally {
            await held?.abort().catch(() => {});
            await page.evaluate(() => globalThis.__nelyxV2?.close?.()).catch(() => {});
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
      assert.match(path.basename(app), /^engine-original-assets-/);
      fs.rmSync(app, { recursive: true, force: true, maxRetries: 3 });
    }
  },
);
