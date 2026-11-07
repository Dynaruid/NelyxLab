// SPDX-License-Identifier: BSD-3-Clause
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { once } from 'node:events';
import { chromium } from 'playwright';
import { stop } from 'esbuild';
import ts from 'typescript';
import { engineRoot, sourceIdentity, timeout } from '../tools/build.mjs';
import { fontCatalogBytes } from '../../runtime/engine-client/font-catalog.ts';
import { fontResourceFixture } from './font-resource-fixture.mjs';
import {
  createEngineV2Project,
  buildEngineV2Application,
  verifyEngineV2Application,
  createEngineV2Server,
} from '../../sdk/tooling/cli/src/engine-v2-runner.mjs';

const fixture = `import {defineEngineV2App} from '@nelyx/sdk/engine-v2';
import type {EngineV2AppContext} from '@nelyx/sdk/engine-v2';
import {Box,commands as c,protocol as p} from '@nelyx/core/v2';
const h=(slot:number,generation=1)=>({slot,generation}),a=h(50),b=h(50,2),bad=h(51),root=h(1000),normal=h(1001),old=h(1002);
let context:EngineV2AppContext,commands=0,rootLive=false,oldLive=false,chain=Promise.resolve();
const producers=new Map<string,{slot:number;generation:number}>();
async function commit(changes:Uint8Array[]){const result=await context.view.commit(changes);commands+=changes.length;return result;}
async function upload(resource:{slot:number;generation:number},name:string,token:bigint){const bytes=await context.asset(name);await context.view.beginFontUpload(resource,bytes.length,token);for(let at=0;at<bytes.length;at+=p.limits.fontChunkBytes)await context.view.appendFontUpload(token,at,bytes.subarray(at,at+p.limits.fontChunkBytes));await context.view.finishFontUpload(token,true);producers.set(resource.generation+':'+resource.slot,resource);}
let preparedOwners=0,failedOwner=0;
async function select(revision:bigint,resource:{slot:number;generation:number}|null){
 const token=((await context.view.request(p.opcodes.inspect)).fontTransition?.token??0n)+1n;
 await context.view.beginFontTransition(resource,token);
 // This data-API control represents the App ACK explicitly. The separate
 // three-heap C++ control performs actual App decoding before this ACK too.
 await context.view.fontTransitionReady(token,'app');
 for(let attempt=0;attempt<30;++attempt){const state=await context.view.request(p.opcodes.inspect),stage=state.fontTransition;
  if(stage?.phase==='failed')throw Error('Font owner refused preparation '+stage.failedOwner);
  if(stage?.ready===7){preparedOwners=stage.ready;await context.view.commitFontTransition(token,revision,state.lastInput);return;}
  await new Promise(resolve=>setTimeout(resolve,50));
 }throw Error('Font owners did not acknowledge preparation');
}
async function published(revision:bigint){for(let attempt=0;attempt<30;++attempt){const frame=await context.view.request(p.opcodes.semanticsSnapshot),node=frame.nodes.find(node=>node.node.slot===normal.slot);if(frame.status===p.statuses.ok&&frame.publication&&frame.document===frame.publishedDocument&&node?.fontBinding?.fontRevision===revision)return frame;await new Promise(resolve=>setTimeout(resolve,50));}throw Error('Font publication did not settle');}
const snapshot=(node:any)=>node?{resource:node.fontBinding?.resource,revision:String(node.fontBinding?.fontRevision),content:node.content,matrix:node.matrix,width:node.width,height:node.height}:null;
async function phase(value:number){let frame;
 if(value===0){await upload(a,'a.fnt',1n);await select(2n,a);await commit([c.create(root,'stack'),c.layout(root),c.properties(root,{width:240,height:260}),c.create(normal,'paragraph'),c.attach(normal,root),c.layout(normal,{paragraphSizing:true}),c.constraints(normal,{kind:'finite',min:180,max:180},{kind:'unbounded'}),c.properties(normal,{width:180}),c.text(normal,'אבגד שלום 123',32)]);rootLive=true;frame=await published(2n);const node=frame.nodes.find(node=>node.node.slot===normal.slot)!;await commit([c.create(old,'paragraph'),c.attach(old,root,1),c.text(old,'אבגד שלום 123',32),c.layout(old,{paintChild:true}),c.eventPolicy(old,p.eventPolicies.canonicalHitTest|p.eventPolicies.deferToChild),c.constraints(old,{kind:'finite',min:180,max:180},{kind:'unbounded'}),c.paintPlacement(old,{fontRevision:2n,width:node.width,height:node.height,baseline:node.baseline,rect:[0,96,node.width,node.height]}),c.paragraphFont(old,{resource:a,fontRevision:2n}),c.releaseResource(a)]);oldLive=true;producers.delete('1:50');frame=await published(2n);
 }else if(value===1){await upload(b,'b.fnt',2n);await select(3n,b);frame=await published(3n);
 }else if(value===2){await upload(bad,'bad.fnt',3n);const state=await context.view.request(p.opcodes.inspect);await context.view.setFontCatalog(4n,bad,state.lastInput);frame=await context.view.request(p.opcodes.semanticsSnapshot);
 }else if(value===3){await select(5n,b);await commit([c.releaseResource(bad)]);producers.delete('1:51');frame=await published(5n);
 }else if(value===4){await select(6n,null);await commit([c.detach(old),c.destroy(old),c.releaseResource(b)]);oldLive=false;producers.delete('2:50');frame=await published(6n);
 }else if(value===5){const rejected=h(51,2);await upload(rejected,'bad.fnt',4n);await context.view.beginFontTransition(rejected,7n);for(let attempt=0;attempt<30;++attempt){const state=await context.view.request(p.opcodes.inspect);if(state.fontTransition?.phase==='failed'){failedOwner=state.fontTransition.failedOwner;if(state.fontRevision!==6n)throw Error('A failed candidate changed Core revision');break;}await new Promise(resolve=>setTimeout(resolve,50));}if(!failedOwner)throw Error('Bad font was not rejected during preflight');await context.view.abortFontTransition(7n);await context.view.releaseFontResource(rejected);producers.delete('2:51');frame=await published(6n);
 }else throw Error('Unknown font phase');
 context.notify({kind:'font-resource-state',phase:value,preparedOwners,failedOwner,commands,transactionWork:String(frame.transactionWork),layoutWork:String(frame.layoutWork),normal:snapshot(frame.nodes.find(node=>node.node.slot===normal.slot)),old:snapshot(frame.nodes.find(node=>node.node.slot===old.slot))});
}
function receive(event:MessageEvent){if(event.data?.kind==='font-resource-phase')chain=chain.then(()=>phase(event.data.phase)).catch(error=>context.notify({kind:'app-error',message:String(error)}));}
export default defineEngineV2App({requiredCapabilities:p.capabilities.fontResources,build(){return new Box([],{color:0xfff4f6fa,properties:{width:624,height:340}});},ready(ctx){context=ctx;globalThis.addEventListener('message',receive);ctx.notify({kind:'font-resource-ready'});},async dispose(){globalThis.removeEventListener('message',receive);await chain;if(!rootLive)return;const state=await context.view.request(p.opcodes.inspect);await select(state.fontRevision+1n,null);const changes=[];if(oldLive)changes.push(c.detach(old),c.destroy(old));changes.push(c.detach(normal),c.destroy(normal),c.destroy(root));for(const resource of producers.values())changes.push(c.releaseResource(resource));await commit(changes);}});`;

async function rows(page, state) {
  const png = await page.screenshot();
  return page.evaluate(
    async ({ png, state }) => {
      const bitmap = await createImageBitmap(
        new Blob([Uint8Array.from(atob(png), (c) => c.charCodeAt(0))], { type: 'image/png' }),
      );
      try {
        const canvas = new OffscreenCanvas(bitmap.width, bitmap.height),
          context = canvas.getContext('2d');
        context.drawImage(bitmap, 0, 0);
        const crop = (node) =>
          node &&
          Array.from(
            context.getImageData(
              Math.round(node.matrix[4] + node.content.x),
              Math.round(node.matrix[5] + node.content.y),
              180,
              80,
            ).data,
          );
        return { normal: crop(state.normal), old: crop(state.old) };
      } finally {
        bitmap.close();
      }
    },
    { png: png.toString('base64'), state },
  );
}

test(
  'Web Core font resources cross real Content/Render owners, retain older recordings and recover from decode refusal in both profiles',
  { timeout },
  async () => {
    const repo = path.resolve(engineRoot, '../..'),
      supply = path.join(engineRoot, 'dist'),
      parent = fs.realpathSync(os.tmpdir()),
      app = fs.mkdtempSync(path.join(parent, 'engine-font-resources-'));
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
      const inputs = fontResourceFixture(supply);
      const catalog = (bytes) =>
        fontCatalogBytes({
          fonts: Array.from({ length: 10 }, () => ({ family: 'NelyxDefault', bytes })),
        });
      assert.ok(catalog(inputs.font).length > 1024 * 1024);
      fs.writeFileSync(path.join(app, 'assets/a.fnt'), catalog(inputs.font));
      fs.writeFileSync(path.join(app, 'assets/b.fnt'), catalog(inputs.changed));
      fs.writeFileSync(
        path.join(app, 'assets/bad.fnt'),
        fontCatalogBytes({ fonts: [{ family: 'NelyxDefault', bytes: new Uint8Array(16) }] }),
      );
      fs.writeFileSync(path.join(app, 'src/app.ts'), fixture);
      fs.writeFileSync(
        path.join(app, 'nelyx.v2.json'),
        JSON.stringify({
          schema: 'nelyx.app.v2/1',
          engine: 'v2',
          entry: 'src/app.ts',
          assets: { 'a.fnt': 'assets/a.fnt', 'b.fnt': 'assets/b.fnt', 'bad.fnt': 'assets/bad.fnt' },
        }),
      );
      const diagnostics = ts.getPreEmitDiagnostics(
        ts.createProgram([path.join(app, 'src/app.ts')], {
          strict: true,
          noEmit: true,
          skipLibCheck: false,
          types: [],
          lib: ['lib.es2022.d.ts', 'lib.dom.d.ts'],
          target: ts.ScriptTarget.ES2022,
          module: ts.ModuleKind.NodeNext,
          moduleResolution: ts.ModuleResolutionKind.NodeNext,
        }),
      );
      assert.deepEqual(
        diagnostics
          .filter((diagnostic) => diagnostic.category === ts.DiagnosticCategory.Error)
          .map((diagnostic) => ts.flattenDiagnosticMessageText(diagnostic.messageText, ' ')),
        [],
      );
      const built = await buildEngineV2Application({ app, target: 'web', engineInputs: supply });
      server = createEngineV2Server(verifyEngineV2Application(built.directory, 'web'));
      server.listen(0, '127.0.0.1');
      await once(server, 'listening');
      browser = await chromium.launch({ headless: true });
      for (const [route, profile] of [
        ['plain', 'single-worker'],
        ['isolated', 'threaded'],
      ]) {
        const context = await browser.newContext({ viewport: { width: 624, height: 340 } }),
          page = await context.newPage(),
          errors = [];
        page.on('pageerror', (error) => errors.push(String(error)));
        try {
          await page.addInitScript(() => {
            const post = Worker.prototype.postMessage;
            Worker.prototype.postMessage = function (message, ...args) {
              if (message?.kind === 'start') {
                globalThis.__fontWorker = this;
                this.addEventListener('message', (event) => {
                  if (event.data?.kind === 'font-resource-ready') globalThis.__fontReady = true;
                  if (event.data?.kind === 'font-resource-state')
                    globalThis.__fontState = event.data;
                  if (event.data?.kind === 'app-execution')
                    globalThis.__fontExecution = event.data.execution;
                });
              }
              return Reflect.apply(post, this, [message, ...args]);
            };
          });
          await page.goto('http://127.0.0.1:' + server.address().port + '/' + route + '/');
          await page.waitForFunction(
            () => __nelyxV2?.errors.length || (__nelyxV2?.ready && globalThis.__fontReady),
            null,
            { timeout: 30000 },
          );
          assert.deepEqual(await page.evaluate(() => __nelyxV2.errors), []);
          let oldPixels, bPixels, bundledPixels, state;
          for (let phase = 0; phase < 6; ++phase) {
            await page.evaluate(
              (phase) => __fontWorker.postMessage({ kind: 'font-resource-phase', phase }),
              phase,
            );
            await page.waitForFunction(
              (phase) => __nelyxV2.errors.length || globalThis.__fontState?.phase === phase,
              phase,
              { timeout: 30000 },
            );
            assert.deepEqual(await page.evaluate(() => __nelyxV2.errors), []);
            if (phase === 2)
              await page.waitForFunction(
                () =>
                  __nelyxV2.surface.diagnostics['preparation-error']?.message?.includes(
                    'font decode',
                  ),
                null,
                { timeout: 30000 },
              );
            await page.evaluate(
              () =>
                new Promise((resolve) =>
                  requestAnimationFrame(() => requestAnimationFrame(resolve)),
                ),
            );
            state = await page.evaluate(() => __fontState);
            assert.equal(state.preparedOwners, 7);
            const current = await rows(page, state);
            if (phase === 0) {
              assert.deepEqual(
                current.normal,
                current.old,
                'Inherited and pinned C++ paragraphs initially match',
              );
              oldPixels = current.old;
              assert.ok(
                oldPixels.some((value, index) => value !== [244, 246, 250, 255][index % 4]),
              );
            } else if (phase === 1) {
              assert.equal(state.normal.resource.generation, 2);
              assert.equal(state.old.resource.generation, 1);
              assert.deepEqual(current.old, oldPixels);
              assert.notDeepEqual(current.normal, oldPixels);
              bPixels = current.normal;
            } else if (phase === 2 || phase === 3) {
              assert.deepEqual(
                current.normal,
                bPixels,
                'Decode refusal and recovery preserve the accepted font pixels',
              );
              assert.deepEqual(current.old, oldPixels);
            } else {
              assert.equal(state.normal.resource, null);
              assert.equal(state.old, null);
              if (phase === 4) bundledPixels = current.normal;
              else {
                assert.ok(state.failedOwner === 2 || state.failedOwner === 4);
                assert.deepEqual(
                  current.normal,
                  bundledPixels,
                  'Preflight NACK preserves the previously accepted frame',
                );
              }
            }
          }
          // A repeated false control is coalesced. Exercise pressure/restore and
          // inspect both fresh owner ACKs, rather than an earlier recording snapshot.
          for (const low of [true, false]) {
            const previous = await page.evaluate(
              () => __nelyxV2.surface.diagnostics['memory-pressure']?.revision ?? 0,
            );
            await page.evaluate((low) => __nelyxV2.surface.setMemoryPressure(low), low);
            await page.waitForFunction(
              ({ low, previous }) => {
                const ack = __nelyxV2.surface.diagnostics['memory-pressure'];
                return ack?.low === low && ack.revision > previous;
              },
              { low, previous },
              { timeout: 30000 },
            );
          }
          const execution = await page.evaluate(() => __fontExecution),
            diagnostics = await page.evaluate(() => __nelyxV2.surface.diagnostics),
            acknowledged = diagnostics['memory-pressure'].owners,
            content = acknowledged.find(
              (owner) => owner.role === 1 || owner.role === 'combined',
            ).counters,
            render = acknowledged.find(
              (owner) => owner.role === 2 || owner.role === 'combined',
            ).counters;
          assert.equal(
            BigInt(state.transactionWork),
            BigInt(execution.acknowledgedCommands + state.commands),
          );
          assert.ok(
            BigInt(state.layoutWork) > 0n &&
              content.paragraphLayouts > 0 &&
              content.dynamicFontLoads >= 20,
            JSON.stringify({ profile, state, content, render }),
          );
          assert.equal(content.resourceFontCatalogs, 0);
          assert.equal(render.resourceFontCatalogs, 0);
          if (profile === 'threaded')
            assert.ok(render.fontReferenceImports > 0 && render.dynamicFontLoads >= 20);
          assert.equal(execution.rejectedFallbacks, 0);
          const closed = await page.evaluate(() => __nelyxV2.close());
          assert.equal(closed.reservedBytes, 0);
          assert.equal(closed.workersStopped, true);
          assert.deepEqual(errors, []);
          console.log(
            JSON.stringify({
              profile,
              cppCommands: state.transactionWork,
              sdkCommands: execution.acknowledgedCommands + state.commands,
              cppLayout: state.layoutWork,
              contentLayouts: content.paragraphLayouts,
              contentDecodes: content.dynamicFontLoads,
              renderDecodes: render.dynamicFontLoads,
              fontReferenceImports: render.fontReferenceImports,
              preparedOwners: state.preparedOwners,
              failedOwner: state.failedOwner,
              oldGenerationPixels: true,
              recovered: true,
              resourceCatalogs: 0,
              workersStopped: true,
            }),
          );
        } finally {
          await page.evaluate(() => globalThis.__nelyxV2?.close?.()).catch(() => {});
          await context.close();
        }
      }
    } finally {
      await browser?.close();
      if (server) await new Promise((resolve) => server.close(resolve));
      stop();
      assert.equal(path.dirname(path.resolve(app)), parent);
      assert.match(path.basename(app), /^engine-font-resources-/);
      fs.rmSync(app, { recursive: true, force: true, maxRetries: 3 });
    }
  },
);
