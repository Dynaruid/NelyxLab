// SPDX-License-Identifier: BSD-3-Clause
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { once } from 'node:events';
import { chromium } from 'playwright';
import { stop } from 'esbuild';
import { packet, response, protocol as p } from '../../runtime/engine-client/index.ts';
import { sourceIdentity, timeout, engineRoot } from '../tools/build.mjs';
import {
  createEngineV2Project,
  buildEngineV2Application,
  verifyEngineV2Application,
  createEngineV2Server,
} from '../../sdk/tooling/cli/src/engine-v2-runner.mjs';
const fixture = `import {defineOriginalEngineV2App} from '@nelyx/sdk/engine-v2-original';
import {Directionality} from '@nelyx/core/framework/widgets/app-data';
import {Overlay,OverlayEntry} from '@nelyx/core/framework/widgets/overlay';
import {SizedBox,Padding,Transform,Align} from '@nelyx/core/framework/widgets/basic';
import {ListView} from '@nelyx/core/framework/widgets/scroll-view';
import {Slider} from '@nelyx/material/slider';
import {Theme} from '@nelyx/material/theme';
import {ThemeData} from '@nelyx/material/theme-data';
import {SliderTheme,SliderThemeData,ShowValueIndicator} from '@nelyx/material/slider-theme';
import {TextStyle} from '@nelyx/core/framework/painting/text-style';
import {Color} from '@nelyx/core/ui/color';
export default defineOriginalEngineV2App({build(context){globalThis.addEventListener('message',event=>{if(event.data?.kind==='live-delay'){
 context.notify({kind:'live-delay-start',time:performance.timeOrigin+performance.now()});const end=performance.now()+300;while(performance.now()<end){}
 context.notify({kind:'live-delay-end',time:performance.timeOrigin+performance.now()});}});
 return new Directionality('ltr',new Theme(new ThemeData(),new SliderTheme(new SliderThemeData({
  valueIndicatorColor:new Color(0xff284870),valueIndicatorTextStyle:new TextStyle({fontSize:14,fontFamily:'NelyxDefault',color:0xffeeee22})}),
  new Overlay({initialEntries:[new OverlayEntry({builder:()=>new Align(new Transform(new SizedBox(400,300,new ListView({itemExtent:300,childPolicy:{mode:'bounded'},children:[
   new Padding({left:24,top:200,right:0,bottom:0},new Align(new SizedBox(240,48,new Slider({value:0,divisions:4,label:'원래 Slider label ABC 1234567890',showValueIndicator:ShowValueIndicator.alwaysVisible,onChanged:()=>{}})),{alignment:{x:-1,y:-1}})),
   ...Array.from({length:7},()=>new SizedBox(400,300))]})),[1,0,1,1,-200,0]),{alignment:{x:-1,y:-1}})})]}))));}});`;
const owner = { session: 1, app: 1, view: 1, generation: 1 },
  label = (s) => s.nodes.find((n) => n.paintPlacement),
  bubble = (s) => s.nodes.flatMap((n) => n.nativePaint ?? []).find((e) => e.kind === 'path');
async function state(page, accepts = () => true) {
  for (let i = 0; i < 30; i++) {
    const bytes = await page.evaluate(
        async (bytes) => Array.from(await __nelyxV2.surface.host.exchange(new Uint8Array(bytes))),
        Array.from(packet(p.opcodes.semanticsSnapshot, owner)),
      ),
      s = response(new Uint8Array(bytes));
    if (s.status === p.statuses.ok && label(s) && s.publication && accepts(s)) return s;
    assert.deepEqual(await page.evaluate(() => __nelyxV2.errors), []);
    await page.evaluate(() => new Promise(requestAnimationFrame));
  }
  throw Error('Live Source Slider did not publish the required frame');
}
async function pixels(page) {
  const png = await page.screenshot();
  return page.evaluate(async (base64) => {
    const image = await createImageBitmap(
      new Blob([Uint8Array.from(atob(base64), (c) => c.charCodeAt(0))], { type: 'image/png' }),
    );
    try {
      const canvas = new OffscreenCanvas(image.width, image.height),
        ctx = canvas.getContext('2d');
      ctx.drawImage(image, 0, 0);
      const data = ctx.getImageData(0, 0, image.width, image.height).data;
      let ink = 0,
        bubble = 0,
        left = image.width,
        right = -1,
        top = image.height;
      for (let y = 0; y < image.height; y++)
        for (let x = 0; x < image.width; x++) {
          const i = (y * image.width + x) * 4;
          if (data[i] === 238 && data[i + 1] === 238 && data[i + 2] === 34) {
            ink++;
            left = Math.min(left, x);
            right = Math.max(right, x);
            top = Math.min(top, y);
          }
          if (data[i] === 40 && data[i + 1] === 72 && data[i + 2] === 112) bubble++;
        }
      return { ink, bubble, left, right, top };
    } finally {
      image.close();
    }
  }, png.toString('base64'));
}
test(
  'Original default Drop tracks Core scroll during App/Content delays with live C++ paint and retained paragraph resources in both Web profiles',
  { timeout },
  async () => {
    const repo = path.resolve(engineRoot, '../..'),
      supply = path.join(engineRoot, 'dist'),
      parent = fs.realpathSync(os.tmpdir()),
      app = fs.mkdtempSync(path.join(parent, 'engine-live-paint-'));
    let server, browser;
    try {
      assert.equal(
        JSON.parse(fs.readFileSync(path.join(supply, 'engine-manifest.json'))).sourceSha256,
        sourceIdentity(),
      );
      createEngineV2Project(app, { designs: ['material', 'cupertino'] });
      fs.mkdirSync(path.join(app, 'node_modules/@nelyx'), { recursive: true });
      for (const [name, dir] of [
        ['core', 'Nelyx'],
        ['sdk', 'Nelyx/sdk'],
        ['material', 'packages/material'],
        ['cupertino', 'packages/cupertino'],
      ])
        fs.symlinkSync(
          path.join(repo, dir),
          path.join(app, 'node_modules/@nelyx', name),
          'junction',
        );
      fs.writeFileSync(path.join(app, 'src/app.ts'), fixture);
      const built = await buildEngineV2Application({ app, target: 'web', engineInputs: supply });
      server = createEngineV2Server(verifyEngineV2Application(built.directory, 'web'));
      server.listen(0, '127.0.0.1');
      await once(server, 'listening');
      browser = await chromium.launch({ headless: true });
      for (const [route, profile] of [
        ['plain', 'single-worker'],
        ['isolated', 'threaded'],
      ]) {
        const context = await browser.newContext({ viewport: { width: 640, height: 360 } }),
          page = await context.newPage(),
          errors = [];
        page.on('pageerror', (error) => errors.push(String(error)));
        try {
          await page.addInitScript(() => {
            const post = Worker.prototype.postMessage;
            Worker.prototype.postMessage = function (message, ...args) {
              if (message?.kind === 'start')
                this.addEventListener('message', (event) => {
                  if (event.data?.kind === 'app-execution')
                    globalThis.__liveExecution = event.data.execution;
                  if (event.data?.kind === 'live-delay-start')
                    globalThis.__liveDelayStart = event.data.time;
                  if (event.data?.kind === 'live-delay-end')
                    globalThis.__liveDelayEnd = event.data.time;
                });
              return Reflect.apply(post, this, [message, ...args]);
            };
          });
          await page.goto('http://127.0.0.1:' + server.address().port + '/' + route + '/');
          await page.waitForFunction(() => __nelyxV2?.ready || __nelyxV2?.errors.length, null, {
            timeout: 30000,
          });
          assert.deepEqual(await page.evaluate(() => __nelyxV2.errors), []);
          let before = await state(page),
            beforePixels = await pixels(page);
          assert.ok(
            beforePixels.ink > 10 && beforePixels.bubble > 100,
            JSON.stringify(beforePixels),
          );
          for (const delayOwner of ['app', 'content']) {
            const during = await page.evaluate(async (delayOwner) => {
              const surface = __nelyxV2.surface,
                before = surface.diagnostics['render-stats'],
                oldStart =
                  delayOwner === 'app'
                    ? globalThis.__liveDelayStart
                    : surface.diagnostics['delay-started']?.start;
              if (delayOwner === 'app') __nelyxV2.app.postMessage({ kind: 'live-delay' });
              else surface.delayContent(300);
              const deadline = performance.now() + 5000;
              while (
                (delayOwner === 'app'
                  ? globalThis.__liveDelayStart
                  : surface.diagnostics['delay-started']?.start) === oldStart &&
                performance.now() < deadline
              )
                await new Promise((r) => setTimeout(r, 1));
              const start =
                delayOwner === 'app'
                  ? globalThis.__liveDelayStart
                  : surface.diagnostics['delay-started']?.start;
              const input = surface.input({
                phase: 'update',
                source: 'wheelUnknown',
                x: 100,
                y: 240,
                dy: 40,
              });
              let moved = false,
                inDelay = false;
              while (performance.now() < deadline) {
                const render = surface.diagnostics['render-stats'];
                moved =
                  render.scrollOffsets[0] > before.scrollOffsets[0] &&
                  render.counters.draws > before.counters.draws;
                if (moved) {
                  inDelay = !(delayOwner === 'app'
                    ? globalThis.__liveDelayEnd >= start
                    : surface.diagnostics['delay-ended']?.end >= start);
                  break;
                }
                await new Promise((r) => setTimeout(r, 1));
              }
              await input;
              const render = surface.diagnostics['render-stats'];
              return {
                moved,
                inDelay,
                render,
                paintCalls: render.counters.livePaints - before.counters.livePaints,
                draws: render.counters.draws - before.counters.draws,
                content: surface.diagnostics['content-stats']?.counters,
              };
            }, delayOwner);
            assert.equal(during.moved, true);
            assert.equal(during.inDelay, delayOwner === 'app' || route === 'isolated');
            const after = await state(page, (s) => s.publication > before.publication),
              a = label(after),
              b = label(before),
              pa = bubble(after),
              pb = bubble(before);
            assert.equal(
              after.transactionWork,
              before.transactionWork,
              'Core movement does not wait for App transactions',
            );
            assert.equal(
              after.activePreparation,
              before.activePreparation,
              'The same Content paragraph/Picture resources are reused',
            );
            assert.ok(
              after.framePaintWork > 0n &&
                after.framePaintNodes > 0n &&
                after.framePlacementNodes > 0n,
            );
            assert.ok(
              during.render.counters.livePaints > 0 && during.render.counters.livePaintEntries > 0,
            );
            assert.equal(
              BigInt(during.paintCalls),
              BigInt(during.draws) * after.framePaintNodes,
              'Actual Render calls agree with the C++ frame node count',
            );
            assert.ok(
              Math.abs(a.matrix[4] - b.matrix[4]) < 1e-5,
              'Text remains inside the screen while its anchor moves',
            );
            assert.ok(a.matrix[5] < b.matrix[5]);
            assert.equal(
              pa.path.commands.find((c) => c[0] === 'rrect')[1] -
                pb.path.commands.find((c) => c[0] === 'rrect')[1],
              40,
              'Bubble correction follows the current world coordinate',
            );
            const painted = await pixels(page);
            assert.ok(painted.ink > 10 && painted.bubble > 100, JSON.stringify(painted));
            assert.ok(
              Math.abs(painted.left - beforePixels.left) <= 1 &&
                Math.abs(painted.right - beforePixels.right) <= 1,
              'Rasterized Source glyphs stay inside the screen with the recomputed bubble',
            );
            assert.equal(painted.top, beforePixels.top - 40);
            console.log(
              JSON.stringify({
                profile,
                delayOwner,
                inDelay: during.inDelay,
                cppPaintWork: String(after.framePaintWork),
                cppPaintNodes: String(after.framePaintNodes),
                cppPlacements: String(after.framePlacementNodes),
                renderLivePaints: during.render.counters.livePaints,
                transactionWork: String(after.transactionWork),
                preparation: String(after.activePreparation),
              }),
            );
            before = after;
            beforePixels = painted;
          }
          const execution = await page.evaluate(() => __liveExecution);
          assert.equal(execution.rejectedFallbacks, 0);
          assert.equal(execution.tsLayoutFallbacks, 0);
          assert.equal(execution.appText.tsFallbacks, 0);
          const closed = await page.evaluate(() => __nelyxV2.close());
          assert.equal(closed.reservedBytes, 0);
          assert.equal(closed.workersStopped, true);
          assert.equal(closed.appText.reservations, 0);
          assert.deepEqual(errors, []);
        } finally {
          await page.evaluate(() => globalThis.__nelyxV2?.close?.()).catch(() => {});
          await context.close();
        }
      }
    } finally {
      await browser?.close();
      if (server) await new Promise((resolve) => server.close(resolve));
      stop();
      assert.equal(path.dirname(app), parent);
      assert.match(path.basename(app), /^engine-live-paint-/);
      fs.rmSync(app, { recursive: true, force: true, maxRetries: 3 });
    }
  },
);
