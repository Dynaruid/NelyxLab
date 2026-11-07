// SPDX-License-Identifier: BSD-3-Clause
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { stop } from 'esbuild';
import { engineRoot, timeout, sourceIdentity, run } from '../tools/build.mjs';
import { androidSdk } from '../tools/build-android.mjs';
import {
  buildEngineV2Application,
  verifyEngineV2Application,
} from '../../sdk/tooling/cli/src/engine-v2-runner.mjs';
import { stopEngineV2Android } from '../../sdk/tooling/cli/src/engine-v2-android.mjs';
import { imageAppSource } from './image-app-fixture.mjs';
import { imageFixture } from './app-images-probe.mjs';
import { networkAssetFixture, networkAssetProbe } from './network-assets-fixture.mjs';

test(
  'Installed Android original public APIs use real assets/fonts/paragraph queries/image codecs/network and cancel IO before drain',
  { timeout },
  async (t) => {
    const supply = path.join(engineRoot, 'dist-android');
    assert.equal(
      JSON.parse(fs.readFileSync(path.join(supply, 'engine-manifest.json'))).sourceSha256,
      sourceIdentity(),
    );
    const adb = path.join(
        androidSdk(),
        'platform-tools',
        process.platform === 'win32' ? 'adb.exe' : 'adb',
      ),
      devices = run(adb, ['devices'])
        .split(/\r?\n/)
        .flatMap((line) => /^(emulator-\d+)\s+device$/.exec(line)?.[1] ?? []),
      device = process.env.NELYX_ANDROID_TEST_SERIAL ?? devices[0];
    assert.ok(devices.includes(device));
    const call = (args) => run(adb, ['-s', device, ...args]),
      parent = path.resolve(engineRoot, '../../.nelyx/android-v2'),
      app = fs.mkdtempSync(path.join(parent, 'services-')),
      applicationId = 'dev.nelyx.services';
    const network = networkAssetFixture(),
      server = createServer((request, response) => {
        if (!network.handle(request, response)) {
          response.writeHead(404);
          response.end();
        }
      });
    let bundle, running;
    try {
      server.listen(0, '127.0.0.1');
      await once(server, 'listening');
      const origin = 'http://10.0.2.2:' + server.address().port;
      fs.mkdirSync(path.join(app, 'assets'));
      fs.writeFileSync(path.join(app, 'package.json'), '{"private":true,"type":"module"}');
      fs.writeFileSync(path.join(app, 'assets/text.txt'), 'hello 한글');
      fs.writeFileSync(path.join(app, 'assets/data.bin'), Buffer.from([1, 2, 3]));
      fs.writeFileSync(path.join(app, 'assets/empty.bin'), '');
      fs.writeFileSync(path.join(app, 'assets/image.png'), Buffer.from(imageFixture.png, 'base64'));
      fs.copyFileSync(
        path.resolve(engineRoot, '../../sample/nelyx-testbed-app-2/assets/NotoSansKR.ttf'),
        path.join(app, 'assets/font.ttf'),
      );
      const font = 'assets/font.ttf';
      fs.writeFileSync(
        path.join(app, 'nelyx.v2.json'),
        JSON.stringify({
          schema: 'nelyx.app.v2/1',
          engine: 'v2',
          entry: 'app.ts',
          supply,
          assets: {
            'text.txt': 'assets/text.txt',
            '한글 data.bin': 'assets/data.bin',
            'empty.bin': 'assets/empty.bin',
            'image.png': 'assets/image.png',
            'font.ttf': font,
          },
          android: { applicationId },
        }),
      );
      const probe = networkAssetProbe
        .toString()
        .replace(
          'NetworkBundle, origin, successful',
          'NetworkBundle: typeof NetworkAssetBundle, origin: string, successful?: (value: unknown) => unknown',
        )
        .replace('(value, message)', '(value: unknown, message: string)');
      const checks = `
import {rootBundle,NetworkAssetBundle} from '@nelyx/core/services/asset-bundle';
import {AssetManifest} from '@nelyx/core/services/asset-manifest';
import {FontLoader} from '@nelyx/core/services/font-loader';
import {StatelessWidget} from '@nelyx/core/framework/widgets/framework';
import type {BuildContext} from '@nelyx/core/framework/widgets/framework';
import {TextPainter} from '@nelyx/core/framework/painting/text-painter';
import {TextSpan} from '@nelyx/core/framework/painting/text-span';
import {TextStyle} from '@nelyx/core/framework/painting/text-style';
import {Offset} from '@nelyx/core/ui/offset';
${probe}
const network=new NetworkAssetBundle(${JSON.stringify(origin + '/network/')});
let pending:Promise<unknown>[]=[];
async function serviceChecks(context:any){
 if(await rootBundle.loadString('text.txt')!=='hello 한글')throw Error('Android UTF-8 asset');
 const a=await rootBundle.load('한글 data.bin'),b=await rootBundle.load('한글 data.bin');a[0]=9;if(b[0]!==1||a.buffer===b.buffer||(await rootBundle.load('empty.bin')).length!==0)throw Error('Android asset copy/empty');
 const manifest=await AssetManifest.loadFromAssetBundle(rootBundle);if(!manifest.listAssets().includes('font.ttf'))throw Error('Android generated asset manifest');
 for(const key of ['../text.txt','missing.bin']){let refused=false;try{await rootBundle.load(key);}catch{refused=true;}if(!refused)throw Error('Android asset failure accepted');}
 const font=new FontLoader('AndroidProbe');font.addFont(rootBundle.load('font.ttf'));await font.load();
 context.notify({kind:'android-services',network:await networkAssetProbe(NetworkAssetBundle,${JSON.stringify(origin)}),assets:true,font:true});
}
class Query extends StatelessWidget{build(context:BuildContext){
 const painter=new TextPainter({text:new TextSpan({text:'한글 A😀 é אבג مرحبا',style:new TextStyle({fontFamily:'AndroidProbe',fontSize:20,color:0xff172033})}),textDirection:'ltr'},{text:context.services.text,resources:context.services.resources,font:context.services.defaultFont!,scale:1});
 try{painter.layout({minWidth:280,maxWidth:280});if(!(painter.height>0)||!painter.getBoxesForSelection({anchor:0,focus:2}).length||painter.getPositionForOffset(new Offset(10,5)).offset<0||!painter.computeLineMetrics().length)throw Error('Android synchronous paragraph geometry');app.notify({kind:'android-paragraph',height:painter.height});}finally{painter.dispose();}
 return new Text('Android public API 한글');
}}
`;
      let source = imageAppSource('original-elements');
      source =
        checks +
        source
          .replace(
            'app=context;const result=',
            'app=context;await serviceChecks(context);const result=',
          )
          .replace("return new Text('Image codecs');", 'return new Query();')
          .replace(
            "ready(){app.notify({kind:'image-ready'});}",
            "ready(){pending=['stall','stall-headers'].map(key=>network.load(key).then(()=>{throw Error('Cancelled Android network bytes escaped');},error=>app.notify({kind:'android-network-cancelled',message:String(error)})));app.notify({kind:'image-ready'});},async dispose(){await Promise.all(pending);}",
          );
      fs.writeFileSync(path.join(app, 'app.ts'), source);
      const built = await buildEngineV2Application({
        app,
        target: 'android',
        architecture: 'x86_64',
        development: true,
      });
      bundle = verifyEngineV2Application(built.directory, 'android');
      // Run the synchronous adb startup adapter outside this server's event loop.
      const entry = new URL('../../sdk/tooling/cli/src/engine-v2-android.mjs', import.meta.url)
          .href,
        verify = new URL('../../sdk/tooling/cli/src/engine-v2-runner.mjs', import.meta.url).href;
      const child = spawn(
        process.execPath,
        [
          '--input-type=module',
          '-e',
          `import {runEngineV2Android} from ${JSON.stringify(entry)};import {verifyEngineV2Application} from ${JSON.stringify(verify)};console.log(JSON.stringify(runEngineV2Android(verifyEngineV2Application(${JSON.stringify(built.directory)},'android'),{device:${JSON.stringify(device)}})));`,
        ],
        { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] },
      );
      let output = '',
        errors = '';
      child.stdout.on('data', (bytes) => (output += bytes));
      child.stderr.on('data', (bytes) => (errors += bytes));
      const deadline = setTimeout(() => child.kill(), 120000);
      try {
        const [code] = await once(child, 'close');
        assert.equal(code, 0, errors);
        running = JSON.parse(output.trim());
      } finally {
        clearTimeout(deadline);
      }
      assert.ok(
        running.firstFrame && running.nativeCommands > 0 && running.rejectedFallbacks === 0,
      );
      const logs = call(['logcat', '-d', '--pid=' + running.pid, '-v', 'raw', '-s', 'NelyxV2']);
      assert.match(logs, /"kind":"android-services"/);
      assert.match(logs, /"kind":"android-paragraph"/);
      assert.match(logs, /"kind":"image-result","result":\{"functional":true,"animatedFrames":4/);
      const closed = stopEngineV2Android(bundle, { device }, running);
      running = undefined;
      assert.ok(
        closed.closed.appDisposed &&
          closed.closed.memoryTotal === 0 &&
          closed.closed.reservedBytes === 0 &&
          closed.closed.workersJoined,
      );
      const final = call(['logcat', '-d', '--pid=' + closed.pid, '-v', 'raw', '-s', 'NelyxV2']);
      assert.equal(
        final
          .split(/\r?\n/)
          .filter((line) => line.startsWith('V2_APP {"kind":"android-network-cancelled"')).length,
        2,
      );
      const receipt = JSON.parse(
        final
          .split(/\r?\n/)
          .findLast((line) => line.startsWith('V2_APP {"kind":"app-ready"'))
          .slice(7),
      );
      assert.ok(
        receipt.assets.networkReads >= 14 &&
          receipt.buffers.nativeCopies > 0 &&
          receipt.images.frameDecodes > 0,
      );
      t.diagnostic(
        JSON.stringify({
          commands: running?.nativeCommands ?? receipt.commands,
          assets: receipt.assets.reads,
          network: receipt.assets.networkReads,
          decodedFrames: receipt.images.frameDecodes,
          closed: closed.closed,
        }),
      );
    } finally {
      if (running)
        try {
          stopEngineV2Android(bundle, { device }, running);
        } catch {}
      network.close();
      server.closeAllConnections();
      if (server.listening) await new Promise((resolve) => server.close(resolve));
      stop();
      if (
        call(['shell', 'pm', 'list', 'packages', applicationId])
          .split(/\r?\n/)
          .includes('package:' + applicationId)
      ) {
        call(['shell', 'am', 'force-stop', applicationId]);
        call(['uninstall', applicationId]);
      }
      assert.equal(path.dirname(app), parent);
      assert.ok(path.basename(app).startsWith('services-'));
      fs.rmSync(app, { recursive: true, force: true, maxRetries: 3 });
    }
  },
);
