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
import { fontResourceFixture } from './font-resource-fixture.mjs';
import { fontCatalogBytes } from '../../runtime/engine-client/font-catalog.ts';
import {
  createEngineV2Project,
  buildEngineV2Application,
  verifyEngineV2Application,
  createEngineV2Server,
} from '../../sdk/tooling/cli/src/engine-v2-runner.mjs';

const fixture = `import {defineOriginalEngineV2App} from '@nelyx/sdk/engine-v2-original';
import type {OriginalEngineV2AppContext} from '@nelyx/sdk/engine-v2-original';
import {protocol as p,EngineError} from '@nelyx/core/v2';
import {LeafRenderObjectWidget} from '@nelyx/core/framework/widgets/framework';
import {SizedBox,ColoredBox,Column} from '@nelyx/core/framework/widgets/basic';
import {RenderBox,RelayoutWhenSystemFontsChangeMixin,registerNativeRenderMetadata} from '@nelyx/core/framework/rendering/object';
import {TextPainter} from '@nelyx/core/framework/painting/text-painter';
import {TextSpan} from '@nelyx/core/framework/painting/text-span';
import {TextStyle} from '@nelyx/core/framework/painting/text-style';
import {FontLoader} from '@nelyx/core/services/font-loader';
import {loadFontFromList} from '@nelyx/core/ui/fonts';
import {Canvas} from '@nelyx/core/ui/canvas';
import {Offset} from '@nelyx/core/ui/offset';
const input=(bytes:Uint8Array)=>({fonts:Array.from({length:10},()=>({family:'NelyxDefault',bytes}))});
type RecordText={dynamic:boolean;canvas?:Canvas;painter?:TextPainter;};
class RecordedText extends LeafRenderObjectWidget{constructor(readonly record:RecordText){super();}createRenderObject(context:any){return new RecordedTextBox(context,this.record);}}
let fontEvents=0,textContext:any,startupLoaded=false;const measured:Record<string,number>={};
function measureFamily(family:string){const painter=new TextPainter({text:new TextSpan({text:'אבגד 123',style:new TextStyle({fontSize:32,fontFamily:family})}),textDirection:'ltr'}, {text:textContext.services.text,resources:textContext.services.resources,font:textContext.services.defaultFont,scale:1});try{painter.layout({minWidth:0,maxWidth:180});return painter.maxIntrinsicWidth;}finally{painter.dispose();}}
class RecordedTextBox extends RelayoutWhenSystemFontsChangeMixin(RenderBox){
 override systemFontsDidChange(){super.systemFontsDidChange();++fontEvents;this.record.painter?.markNeedsLayout();}
 constructor(readonly context:any,readonly record:RecordText){super();if(record.dynamic)textContext=context;}
 static {registerNativeRenderMetadata(RecordedTextBox.prototype,source=>source.metadata());}
 metadata(){const record=this.record;
  if(!record.canvas||record.dynamic){record.painter??=new TextPainter({text:new TextSpan({text:'אבגד 123',style:new TextStyle({fontSize:32,color:0xff172033})}),textDirection:'ltr'},
    {text:this.context.services.text,resources:this.context.services.resources,font:this.context.services.defaultFont,scale:1});
   record.painter.layout({minWidth:180,maxWidth:180});const next=new Canvas();record.painter.paint(next,new Offset(0,0));record.canvas?.dispose();record.canvas=next;
   if(!record.dynamic){record.painter.dispose();delete record.painter;}}
  return {kind:'paint' as const,entries:record.canvas!.commands.map(command=>{if(command.op!=='paragraph')throw Error('Unexpected font recording');return {kind:'paragraph' as const,paragraph:command.resource,color:0,shape:{kind:'rrect' as const,radii:Array(8).fill(0) as [number,number,number,number,number,number,number,number],strokeWidth:0,strokeColor:0,strokeAlign:0},x:command.x,y:command.y};})};
 }
 override dispose(){try{this.record.painter?.dispose();this.record.canvas?.dispose();}finally{super.dispose();}}
}
let app:OriginalEngineV2AppContext,chain=Promise.resolve();
async function published(revision:bigint){for(let i=0;i<30;++i){const frame=await app.view.request(p.opcodes.semanticsSnapshot),fresh=frame.nodes.find(node=>node.paintPlacement&&Math.abs(node.bounds.y-64)<.01);if(frame.status===p.statuses.ok&&frame.document===frame.publishedDocument&&frame.fontRevision===revision&&fresh?.fontBinding?.fontRevision===revision)return frame;await new Promise(resolve=>setTimeout(resolve,25));}throw Error('Original font frame did not settle');}
async function report(phase:number,revision:bigint,rejected=false){const expected=phase>=5?(phase-2)*2:phase>=3?4:phase>=1?2:0;for(let i=0;i<30&&fontEvents!==expected;++i)await new Promise(resolve=>setTimeout(resolve,25));if(fontEvents!==expected)throw Error('Source font notifications did not settle: '+fontEvents);const frame=await published(revision),nodes=frame.nodes.filter(node=>node.paintPlacement).sort((a,b)=>a.bounds.y-b.bounds.y);app.notify({kind:'original-font-state',phase,rejected,fontEvents,startupLoaded,measured,fontRevision:String(frame.fontRevision),cppCommands:String(frame.transactionWork),cppLayout:String(frame.layoutWork),nodes:nodes.map(node=>({bounds:node.bounds,binding:{...node.fontBinding,fontRevision:String(node.fontBinding!.fontRevision)}}))});}
async function phase(value:number){if(value===1){const bytes=await app.asset('b.ttf'),work=app.fonts.replace(input(bytes));bytes.fill(0);if(await work!==5)throw Error('Unexpected font revision');await report(value,5n);
 }else if(value===2){let refused=false;try{await app.fonts.replace(input(new Uint8Array(16)));}catch(error){refused=/font decode/i.test(String(error));}if(!refused)throw Error('Malformed font was not rejected');await report(value,5n,true);
 }else if(value===3){if(await app.fonts.replace(null)!==6)throw Error('Bundled reset failed');await report(value,6n);
 }else if(value===4){const work=app.fonts.replace(input(await app.asset('b.ttf')));app.fonts.cancel();let refused=false;try{await work;}catch(error){refused=error instanceof EngineError&&error.status===p.statuses.canceled;}if(!refused)throw Error('Cancelled font update succeeded');await app.fonts.recover();await report(value,6n,true);
 }else if(value===5||value===6){const family=value===5?'SourceA':'SourceB',bytes=await app.asset(value===5?'a.ttf':'b.ttf'),padded=new Uint8Array(bytes.length+16),loader=new FontLoader(family);padded.set(bytes,8);loader.addFont(Promise.resolve(padded.subarray(8,8+bytes.length)));await loader.load();measured[family]=measureFamily(family);if(value===6&&measureFamily('SourceA')!==measured.SourceA)throw Error('Additive loading lost the previous family');let duplicate=false;try{await loader.load();}catch(error){duplicate=(error as Error).name==='StateError';}if(!duplicate)throw Error('Source FontLoader accepted a second load');await report(value,BigInt(value+2));
 }else if(value===7){const bytes=await app.asset('b.ttf'),padded=new Uint8Array(bytes.length+16);padded.set(bytes,8);const work=loadFontFromList(padded.subarray(8,8+bytes.length),{fontFamily:'UiAlias'});padded.fill(0);await work;measured.UiAlias=measureFamily('UiAlias');await report(value,9n);
 }else if(value===8){let refused=false;try{await loadFontFromList(new Uint8Array(16));}catch(error){refused=/font decode/i.test(String(error));}if(!refused)throw Error('Malformed ui font was not rejected');const bytes=await app.asset('a.ttf'),work=loadFontFromList(bytes);bytes.fill(0);await work;measured.intrinsic=measureFamily('Noto Sans Hebrew');if(measureFamily('SourceB')!==measured.SourceB)throw Error('ui font loading lost a Source family');await report(value,10n,true);
 }else throw Error('Unknown font phase');}
const receive=(event:MessageEvent)=>{if(event.data?.kind==='original-font-phase')chain=chain.then(()=>phase(event.data.phase)).catch(error=>app.notify({kind:'app-error',message:String(error)}));};
export default defineOriginalEngineV2App({async fontCatalog(context){return input(await context.asset('a.ttf'));},
 async build(context){const loader=new FontLoader('SourceStartup');loader.addFont(context.asset('a.ttf'));loader.addFont(context.asset('a.ttf'));await loader.load();startupLoaded=true;return new SizedBox(240,160,new ColoredBox({color:0xfff4f6fa,child:new Column([false,true].map(dynamic=>new SizedBox(180,64,new RecordedText({dynamic}))),{crossAxisAlignment:'start',mainAxisSize:'min'})}));},
 async ready(context){app=context;globalThis.addEventListener('message',receive);await report(0,4n);},
 async dispose(){globalThis.removeEventListener('message',receive);await chain;}});`;

test(
  'Normal Original SDK startup and font controls drive actual App/Content/Render workers, preserve old recordings and drain both Web profiles',
  { timeout },
  async () => {
    const parent = fs.realpathSync(os.tmpdir()),
      app = fs.mkdtempSync(path.join(parent, 'engine-original-fonts-')),
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
      const inputs = fontResourceFixture(supply);
      assert.ok(
        fontCatalogBytes({
          fonts: Array.from({ length: 10 }, () => ({ family: 'NelyxDefault', bytes: inputs.font })),
        }).length >
          1024 * 1024,
      );
      fs.mkdirSync(path.join(app, 'assets'), { recursive: true });
      fs.writeFileSync(path.join(app, 'assets/a.ttf'), inputs.font);
      fs.writeFileSync(path.join(app, 'assets/b.ttf'), inputs.changed);
      fs.writeFileSync(path.join(app, 'src/app.ts'), fixture);
      fs.writeFileSync(
        path.join(app, 'nelyx.v2.json'),
        JSON.stringify({
          schema: 'nelyx.app.v2/1',
          engine: 'v2',
          entry: 'src/app.ts',
          assets: { 'a.ttf': 'assets/a.ttf', 'b.ttf': 'assets/b.ttf' },
        }),
      );
      const options = {
        strict: true,
        noEmit: true,
        skipLibCheck: false,
        types: [],
        lib: ['lib.es2022.d.ts', 'lib.dom.d.ts'],
        target: ts.ScriptTarget.ES2022,
        module: ts.ModuleKind.NodeNext,
        moduleResolution: ts.ModuleResolutionKind.NodeNext,
      };
      const errors = ts
        .getPreEmitDiagnostics(ts.createProgram([path.join(app, 'src/app.ts')], options))
        .filter((error) => error.category === ts.DiagnosticCategory.Error);
      assert.deepEqual(
        errors.map((error) => ts.flattenDiagnosticMessageText(error.messageText, ' ')),
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
        const context = await browser.newContext({ viewport: { width: 400, height: 240 } }),
          page = await context.newPage(),
          pageErrors = [];
        page.on('pageerror', (error) => pageErrors.push(String(error)));
        try {
          await page.addInitScript(() => {
            const post = Worker.prototype.postMessage;
            Worker.prototype.postMessage = function (message, ...args) {
              if (message?.kind === 'start') {
                globalThis.__originalFontsWorker = this;
                this.addEventListener('message', (event) => {
                  if (event.data?.kind === 'original-font-state')
                    globalThis.__originalFontState = event.data;
                  if (event.data?.kind === 'app-execution')
                    globalThis.__originalFontExecution = event.data.execution;
                });
              }
              return Reflect.apply(post, this, [message, ...args]);
            };
          });
          await page.goto('http://127.0.0.1:' + server.address().port + '/' + route + '/');
          let retained, changed, state;
          for (let phase = 0; phase < 9; ++phase) {
            if (phase)
              await page.evaluate(
                (phase) =>
                  __originalFontsWorker.postMessage({ kind: 'original-font-phase', phase }),
                phase,
              );
            await page.waitForFunction(
              (phase) =>
                __nelyxV2?.errors.length ||
                (__nelyxV2?.ready && globalThis.__originalFontState?.phase === phase),
              phase,
              { timeout: 30000 },
            );
            assert.deepEqual(await page.evaluate(() => __nelyxV2.errors), []);
            state = await page.evaluate(() => __originalFontState);
            await page.evaluate(
              () =>
                new Promise((resolve) =>
                  requestAnimationFrame(() => requestAnimationFrame(resolve)),
                ),
            );
            const screenshot = await page.screenshot(),
              rows = await page.evaluate(
                async ({ png, state }) => {
                  const bitmap = await createImageBitmap(
                    new Blob([Uint8Array.from(atob(png), (c) => c.charCodeAt(0))], {
                      type: 'image/png',
                    }),
                  );
                  try {
                    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height),
                      ctx = canvas.getContext('2d');
                    ctx.drawImage(bitmap, 0, 0);
                    return state.nodes.map((node) =>
                      Array.from(
                        ctx.getImageData(
                          Math.round(node.bounds.x),
                          Math.round(node.bounds.y),
                          180,
                          64,
                        ).data,
                      ),
                    );
                  } finally {
                    bitmap.close();
                  }
                },
                { png: screenshot.toString('base64'), state },
              );
            assert.equal(state.nodes.length, 2);
            assert.equal(
              state.fontEvents,
              phase >= 5 ? (phase - 2) * 2 : phase >= 3 ? 4 : phase >= 1 ? 2 : 0,
            );
            assert.equal(state.startupLoaded, true);
            if (phase === 6) {
              assert.ok(state.measured.SourceA > 0 && state.measured.SourceB > 0);
              assert.notEqual(state.measured.SourceA, state.measured.SourceB);
            }
            if (phase === 8) {
              assert.equal(state.measured.UiAlias, state.measured.SourceB);
              assert.equal(state.measured.intrinsic, state.measured.SourceA);
            }
            assert.equal(state.nodes[0].binding.fontRevision, '4');
            assert.equal(state.nodes[0].binding.pinned, true);
            if (!phase) {
              retained = rows[0];
              assert.deepEqual(rows[1], retained);
            } else {
              assert.deepEqual(rows[0], retained);
              if (phase === 1) {
                changed = rows[1];
                assert.notDeepEqual(changed, retained);
              } else if (phase === 2) assert.deepEqual(rows[1], changed);
            }
            assert.equal(
              state.nodes[1].binding.fontRevision,
              String([4, 5, 5, 6, 6, 7, 8, 9, 10][phase]),
            );
            if (phase === 2 || phase === 4) assert.equal(state.rejected, true);
          }
          const execution = await page.evaluate(
              () => __originalFontExecution ?? __nelyxV2.receipt.execution,
            ),
            diagnostics = await page.evaluate(() => __nelyxV2.surface.diagnostics),
            content = diagnostics['content-stats'].counters;
          assert.equal(state.cppCommands, String(execution.acknowledgedCommands));
          assert.ok(
            BigInt(state.cppLayout) > 0n &&
              content.paragraphLayouts > 0 &&
              content.dynamicFontLoads >= 20,
          );
          assert.equal(execution.appText.version, 12);
          assert.ok(
            execution.appText.fontFamilies.includes('SourceA') &&
              execution.appText.fontFamilies.includes('SourceB') &&
              execution.appText.fontFamilies.includes('UiAlias') &&
              execution.appText.fontFamilies.includes('Noto Sans Hebrew'),
          );
          assert.equal(execution.appText.fontBuffers, 0);
          assert.equal(execution.appText.fontBufferBytes, 0);
          assert.equal(execution.fonts.fontLoadsPending, 0);
          assert.equal(execution.fonts.fontLoadBytes, 0);
          assert.equal(execution.appText.layouts, execution.appText.sdkLayouts);
          assert.ok(execution.appText.layouts > 0 && execution.appText.fontLoads >= 30);
          assert.equal(execution.rejectedFallbacks, 0);
          assert.equal(execution.appText.tsFallbacks, 0);
          assert.equal(execution.tsLayoutFallbacks, 0);
          const closed = await page.evaluate(() => __nelyxV2.close());
          assert.equal(closed.reservedBytes, 0);
          assert.equal(closed.workersStopped, true);
          assert.deepEqual(pageErrors, []);
          console.log(
            JSON.stringify({
              profile,
              control: 'normal-Original-SDK-fonts',
              cppCommands: state.cppCommands,
              sdkCommands: execution.acknowledgedCommands,
              cppLayout: state.cppLayout,
              contentLayouts: content.paragraphLayouts,
              contentDecodes: content.dynamicFontLoads,
              app: execution.appText,
              fonts: execution.fonts,
              fontEvents: state.fontEvents,
              measured: state.measured,
              retainedCustom: true,
              workersStopped: true,
              reservedBytes: 0,
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
      assert.match(path.basename(app), /^engine-original-fonts-/);
      fs.rmSync(app, { recursive: true, force: true, maxRetries: 3 });
    }
  },
);
