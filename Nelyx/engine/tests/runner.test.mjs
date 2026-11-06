// SPDX-License-Identifier: BSD-3-Clause
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { once } from 'node:events';
import { spawn, execFileSync } from 'node:child_process';
import { chromium } from 'playwright';
import { stop as stopCompiler } from 'esbuild';
import { engineRoot, timeout, sourceIdentity } from '../tools/build.mjs';
import {
  createEngineV2Project,
  buildEngineV2Application,
  verifyEngineV2Application,
  createEngineV2Server,
  engineV2Operation,
} from '../../sdk/tooling/cli/src/engine-v2-runner.mjs';
const repo = path.resolve(engineRoot, '../..'),
  supply = path.join(engineRoot, 'dist');
const fixture = `import {defineEngineV2App} from '@nelyx/sdk/engine-v2';
import {Stack,Box,Text,Image,ImageResource,Transform,ClipRRect,PathShape,VectorPath,ImageFiltered,ValueListenableBuilder,engineFailures,protocol as p} from '@nelyx/core/v2';
import {FilledButton} from '@nelyx/material/v2';import {CupertinoSwitch} from '@nelyx/cupertino/v2';
import {Color} from '@nelyx/core/ui/color';import {Colors} from '@nelyx/material/colors';import {EdgeInsets} from '@nelyx/core/framework/painting/edge-insets';
import {ValueKey} from '@nelyx/core/foundation/key';import {ValueNotifier} from '@nelyx/core/foundation/notifier';
import {Curves} from '@nelyx/core/framework/animation/curves';import {FrictionSimulation} from '@nelyx/core/framework/physics/friction-simulation';
const notifier=new ValueNotifier(0xff123456);
export default defineEngineV2App({requiredCapabilities:p.capabilities.graphics|p.capabilities.controls,async build({asset}){
 const failures=[Error('first'),Error('second')],compound=engineFailures('cleanup probe',failures) as AggregateError;
 if(compound.cause!==failures[0]||compound.errors[1]!==failures[1])throw Error('Structured cleanup causes were lost');
 if(Curves.linear.transform(0.25)!==0.25||new FrictionSimulation(0.135,2,3).x(0)!==2)throw Error('Canonical curve/physics value contract changed');
 const image=new ImageResource(await asset('sample.webp'));const background=new Color(Colors.blue.value).value;const insets=EdgeInsets.only({left:4,right:4});return new Stack([
  new Text('Consumer app',{properties:{x:20,y:10,width:250,height:40},fontSize:24}),
  new ClipRRect(new Transform(new PathShape(new VectorPath([['move',0,0],['line',80,0],['quad',80,80,0,80],['close']]),{properties:{width:80,height:80},color:0xffff0000}),[0,1,-1,0,100,0],{properties:{width:100,height:100}}),16,{properties:{x:20,y:70,width:100,height:100}}),
  new ImageFiltered(new Box([],{properties:{width:30,height:30},color:background,layout:{padding:insets}}),2,{properties:{x:170,y:80,width:30,height:30}}),
  new Image(image,{properties:{x:220,y:70,width:64,height:64}}),
  new ValueListenableBuilder(notifier,(_context,color)=>new Box([],{key:new ValueKey('canonical'),properties:{x:280,y:10,width:20,height:20},color})),
  new FilledButton('Apply',()=>{}, {properties:{x:20,y:200,width:120,height:48},graphics:{shadow:{x:4,y:6,sigma:3,color:0x55000000}}}),
  new CupertinoSwitch(false,()=>{}, {properties:{x:200,y:200,width:56,height:32}})
 ],{properties:{width:340,height:300}});},dispose(){notifier.dispose();}});`;
async function consumer(run) {
  assert.equal(
    JSON.parse(fs.readFileSync(path.join(supply, 'engine-manifest.json'))).sourceSha256,
    sourceIdentity(),
    'Build current engine before runner acceptance',
  );
  const parent = fs.realpathSync(os.tmpdir()),
    app = fs.mkdtempSync(path.join(parent, 'engine-consumer-'));
  try {
    createEngineV2Project(app, { designs: ['material', 'cupertino'] });
    fs.mkdirSync(path.join(app, 'node_modules/@nelyx'), { recursive: true });
    for (const [name, directory] of [
      ['core', 'Nelyx'],
      ['sdk', 'Nelyx/sdk'],
      ['material', 'packages/material'],
      ['cupertino', 'packages/cupertino'],
      ['cli', 'Nelyx/sdk/tooling/cli'],
    ])
      fs.symlinkSync(
        path.join(repo, directory),
        path.join(app, 'node_modules/@nelyx', name),
        'junction',
      );
    fs.mkdirSync(path.join(app, 'assets'));
    fs.copyFileSync(
      path.join(repo, 'sample/nelyx-testbed-app-2/assets/component-image.webp'),
      path.join(app, 'assets/source.webp'),
    );
    fs.writeFileSync(
      path.join(app, 'nelyx.v2.json'),
      JSON.stringify({
        schema: 'nelyx.app.v2/1',
        engine: 'v2',
        entry: 'src/app.ts',
        assets: { 'sample.webp': 'assets/source.webp' },
      }),
    );
    fs.writeFileSync(path.join(app, 'src/app.ts'), fixture);
    await run(app);
  } finally {
    stopCompiler();
    assert.equal(path.dirname(path.resolve(app)), parent);
    fs.rmSync(app, { recursive: true, force: true, maxRetries: 3 });
  }
}
test(
  'External consumer entry, assets, native App lifecycle and portable package share supplier identity',
  { timeout },
  () =>
    consumer(async (app) => {
      const built = await buildEngineV2Application({
        app,
        target: 'windows',
        engineInputs: supply,
      });
      assert.ok(built.modules > 10);
      assert.equal(built.routing.fallbackPolicy, 'reject-unported');
      assert.ok(built.routing.packageInputs['@nelyx/core'] > 0);
      assert.ok(built.routing.packageInputs['@nelyx/material'] > 0);
      assert.ok(built.routing.packageInputs['@nelyx/cupertino'] > 0);
      const priorBundle = fs.readFileSync(path.join(built.directory, 'application/app.js'), 'utf8');
      const child = spawn(
        path.join(supply, 'native/NelyxEngineV2Host.exe'),
        [supply, '--app', built.directory, '--probe'],
        { stdio: ['pipe', 'pipe', 'pipe'], windowsHide: false },
      );
      let output = '',
        errors = '';
      child.stdout.on('data', (b) => (output = (output + b).slice(-32000)));
      child.stderr.on('data', (b) => (errors = (errors + b).slice(-8000)));
      try {
        await waitFor(
          () => output.includes('app-ready'),
          () => (errors || child.exitCode !== null ? errors + '\n' + output : null),
        );
        const ready = JSON.parse(
          output
            .split('\n')
            .find((line) => line.startsWith('V2_APP ') && line.includes('app-ready'))
            .slice(7),
        );
        assert.equal(ready.engineWork, String(ready.commands));
        assert.equal(ready.execution.observed, true);
        assert.equal(ready.execution.acknowledgedCommands, ready.commands);
        assert.equal(ready.execution.fallbackPolicy, 'reject-unported');
        assert.equal(ready.execution.rejectedFallbacks, 0);
        assert.ok(BigInt(ready.memory.total) > 0n);
        child.stdin.write('close\n');
        await waitFor(
          () => child.exitCode !== null,
          () => errors || null,
        );
        assert.equal(child.exitCode, 0, output + '\n' + errors);
        assert.match(output, /app-disposed/);
        assert.match(output, /"memoryTotal":0/);
      } finally {
        if (child.exitCode === null) {
          child.kill();
          await once(child, 'exit');
        }
      }
      const packed = await engineV2Operation('pack', {
        app,
        target: 'windows',
        directory: built.directory,
      });
      assert.equal(packed.standalone, true);
      assert.equal(
        verifyEngineV2Application(packed.directory, 'windows').manifest.supply,
        'engine',
      );
      const command = execFileSync(
        process.execPath,
        [
          path.join(app, 'node_modules/@nelyx/cli/src/main.mjs'),
          'doctor',
          '--engine',
          'v2',
          '--target',
          'windows',
          '--app',
          app,
          '--engine-inputs',
          supply,
        ],
        { encoding: 'utf8', timeout, windowsHide: true },
      );
      assert.equal(JSON.parse(command).engine, 'v2');
      fs.appendFileSync(path.join(packed.directory, 'application/app.js'), '\n// corruption');
      assert.throws(
        () => verifyEngineV2Application(packed.directory, 'windows'),
        /identity mismatch/,
      );
      fs.writeFileSync(
        path.join(app, 'src/app.ts'),
        "import {Text} from '@nelyx/core/framework/widgets/basic';export default new Text('legacy');",
      );
      await assert.rejects(
        buildEngineV2Application({ app, target: 'windows', engineInputs: supply }),
        /cannot import/,
      );
      fs.writeFileSync(
        path.join(app, 'src/app.ts'),
        `import {Text} from ${JSON.stringify(path.join(repo, 'Nelyx/src/framework/widgets/basic.ts'))};export default new Text('legacy source');`,
      );
      await assert.rejects(
        buildEngineV2Application({ app, target: 'windows', engineInputs: supply }),
        /cannot import|unported implementation/,
      );
      fs.writeFileSync(
        path.join(app, 'src/app.ts'),
        `import * as values from ${JSON.stringify(path.join(repo, 'packages/material/src/icon-assets.ts'))};globalThis.unported=values;export default {};`,
      );
      await assert.rejects(
        buildEngineV2Application({ app, target: 'windows', engineInputs: supply }),
        /unported implementation/,
      );
      const foreign = path.join(app, 'foreign-core');
      fs.mkdirSync(path.join(foreign, 'foundation'), { recursive: true });
      fs.writeFileSync(
        path.join(foreign, 'package.json'),
        '{"name":"@nelyx/core","type":"module"}',
      );
      fs.writeFileSync(path.join(foreign, 'foundation/numbers.js'), 'export const foreign = true;');
      fs.writeFileSync(
        path.join(app, 'src/app.ts'),
        `import {foreign} from ${JSON.stringify(path.join(foreign, 'foundation/numbers.js'))};globalThis.unported=foreign;export default {};`,
      );
      await assert.rejects(
        buildEngineV2Application({ app, target: 'windows', engineInputs: supply }),
        /Foreign Core package identity/,
      );
      assert.equal(
        fs.readFileSync(path.join(built.directory, 'application/app.js'), 'utf8'),
        priorBundle,
      );
      assert.ok(
        fs.existsSync(path.join(built.directory, 'app-manifest.json')),
        'A failed build preserves the prior bundle',
      );
    }),
);
for (const [route, profile] of [
  ['plain', 'single-worker'],
  ['isolated', 'threaded'],
])
  test(
    `External consumer ${route} executes graphics, C++ work, unified accounts and disposal`,
    { timeout },
    () =>
      consumer(async (app) => {
        const built = await buildEngineV2Application({ app, target: 'web', engineInputs: supply }),
          server = createEngineV2Server(verifyEngineV2Application(built.directory, 'web'));
        let browser;
        server.listen(0, '127.0.0.1');
        await once(server, 'listening');
        try {
          browser = await chromium.launch({ headless: true });
          const page = await browser.newPage({ viewport: { width: 400, height: 330 } }),
            errors = [];
          page.on('pageerror', (error) => errors.push(String(error)));
          await page.goto(`http://127.0.0.1:${server.address().port}/${route}/`);
          await page.waitForFunction(
            () => globalThis.__nelyxV2?.ready || globalThis.__nelyxV2?.errors.length,
            {},
            { timeout: 30000 },
          );
          const current = await page.evaluate(() => ({
            ready: globalThis.__nelyxV2.ready,
            errors: globalThis.__nelyxV2.errors,
            profile: globalThis.__nelyxV2.surface?.selectedProfile,
            receipt: globalThis.__nelyxV2.receipt,
            preparationError: globalThis.__nelyxV2.surface?.diagnostics['preparation-error'],
          }));
          assert.deepEqual(current.errors, [], JSON.stringify(current));
          assert.equal(current.ready, true);
          assert.equal(current.profile, profile);
          assert.equal(current.receipt.engineWork, String(current.receipt.commands));
          await page.waitForFunction(
            () => globalThis.__nelyxV2.surface.diagnostics['render-stats']?.state?.publication > 0n,
          );
          const memory = await page.evaluate(() => {
            const state = globalThis.__nelyxV2.surface.diagnostics['render-stats'].state;
            return Object.fromEntries(
              Object.entries(state.memory).map(([key, value]) => [key, String(value)]),
            );
          });
          assert.ok(
            BigInt(memory.providerHeap) > 0n &&
              BigInt(memory.gpu) > 0n &&
              BigInt(memory.total) <= BigInt(memory.limit),
          );
          assert.ok(BigInt(memory.peak) <= BigInt(memory.limit));
          const bounds = await page.locator('[aria-label="Apply"]').boundingBox();
          assert.ok(bounds && bounds.width > 0 && bounds.height > 0);
          const closed = await page.evaluate(() => globalThis.__nelyxV2.close());
          assert.equal(closed.reservedBytes, 0);
          assert.deepEqual(errors, []);
        } finally {
          await browser?.close();
          await new Promise((resolve) => server.close(resolve));
        }
      }),
  );
const failedDisposal = (app) =>
  fs.writeFileSync(
    path.join(app, 'src/app.ts'),
    fixture
      .replace('Stack,Box,Text,', 'Stack,Box,StatefulWidget,State,Text,')
      .replace(
        'const notifier=',
        `class FailingChild extends StatefulWidget {createState(){return new FailingState();}}
class FailingState extends State {build(){return new Box([]);}dispose(){throw Error('widget disposal failure');}}
const notifier=`,
      )
      .replace('return new Stack([', 'return new Stack([new FailingChild(),')
      .replace(
        'dispose(){notifier.dispose();}',
        "dispose(){notifier.dispose();throw Error('consumer disposal failure');}",
      ),
  );
test(
  'Native stalled App JavaScript is interrupted before owner join and all owned accounts drain',
  { timeout },
  () =>
    consumer(async (app) => {
      fs.writeFileSync(
        path.join(app, 'src/app.ts'),
        fixture.replace('dispose(){notifier.dispose();}', 'dispose(){for(;;){}}'),
      );
      const built = await buildEngineV2Application({
          app,
          target: 'windows',
          engineInputs: supply,
        }),
        child = spawn(
          path.join(supply, 'native/NelyxEngineV2Host.exe'),
          [supply, '--app', built.directory, '--probe'],
          { stdio: ['pipe', 'pipe', 'pipe'], windowsHide: false },
        );
      let output = '',
        errors = '';
      child.stdout.on('data', (b) => (output = (output + b).slice(-32000)));
      child.stderr.on('data', (b) => (errors = (errors + b).slice(-8000)));
      try {
        await waitFor(
          () => output.includes('app-ready'),
          () => errors || null,
        );
        const started = performance.now();
        child.stdin.write('close\n');
        await waitFor(() => child.exitCode !== null);
        assert.equal(child.exitCode, 1, output + errors);
        assert.match(errors, /Interrupting stalled App JavaScript/);
        assert.match(output, /"memoryTotal":0/);
        assert.ok(
          performance.now() - started < 10000,
          'A non-returning JS loop does not hold native owner join indefinitely',
        );
      } finally {
        if (child.exitCode === null) {
          child.kill();
          await once(child, 'exit');
        }
      }
    }),
);
test(
  'Native App disposal failure reports the original error and still drains its engine',
  { timeout },
  () =>
    consumer(async (app) => {
      failedDisposal(app);
      const built = await buildEngineV2Application({
          app,
          target: 'windows',
          engineInputs: supply,
        }),
        child = spawn(
          path.join(supply, 'native/NelyxEngineV2Host.exe'),
          [supply, '--app', built.directory, '--probe'],
          { stdio: ['pipe', 'pipe', 'pipe'], windowsHide: false },
        );
      let output = '',
        errors = '';
      child.stdout.on('data', (b) => (output = (output + b).slice(-32000)));
      child.stderr.on('data', (b) => (errors = (errors + b).slice(-8000)));
      try {
        await waitFor(
          () => output.includes('app-ready'),
          () => errors || null,
        );
        child.stdin.write('close\n');
        await waitFor(() => child.exitCode !== null);
        assert.equal(child.exitCode, 1, output + errors);
        assert.match(errors, /consumer disposal failure/);
        assert.match(errors, /widget disposal failure/);
        assert.equal(
          output
            .split('\n')
            .filter((line) => line.startsWith('V2_APP ') && line.includes('app-error')).length,
          1,
        );
        assert.doesNotMatch(errors, /App disposal timeout/);
        assert.match(output, /"memoryTotal":0/);
      } finally {
        if (child.exitCode === null) {
          child.kill();
          await once(child, 'exit');
        }
      }
    }),
);
for (const route of ['plain', 'isolated'])
  test(
    `${route} App disposal failure preserves one close terminal and drains providers`,
    { timeout },
    () =>
      consumer(async (app) => {
        failedDisposal(app);
        const built = await buildEngineV2Application({ app, target: 'web', engineInputs: supply }),
          server = createEngineV2Server(verifyEngineV2Application(built.directory, 'web'));
        let browser;
        server.listen(0, '127.0.0.1');
        await once(server, 'listening');
        try {
          browser = await chromium.launch({ headless: true });
          const page = await browser.newPage(),
            errors = [];
          page.on('pageerror', (error) => errors.push(String(error)));
          await page.goto(`http://127.0.0.1:${server.address().port}/${route}/`);
          await page.waitForFunction(
            () => globalThis.__nelyxV2?.ready || globalThis.__nelyxV2?.errors.length,
          );
          const result = await page.evaluate(async () => {
            const current = globalThis.__nelyxV2,
              surfaceClose = current.surface.close.bind(current.surface);
            current.surface.close = async () => {
              await surfaceClose();
              throw Error('surface cleanup failure');
            };
            const first = current.close(),
              same = first === current.close();
            let message;
            try {
              await first;
            } catch (error) {
              message = String(error);
            }
            return {
              same,
              message,
              closed: current.surface.diagnostics.closed,
              ready: current.ready,
              appErrors: current.errors,
            };
          });
          assert.equal(result.same, true);
          assert.match(result.message, /consumer disposal failure/);
          assert.match(result.message, /widget disposal failure/);
          assert.match(result.message, /surface cleanup failure/);
          assert.equal(result.appErrors.length, 1);
          assert.equal(result.closed.reservedBytes, 0);
          assert.equal(result.closed.workersStopped, true);
          assert.equal(result.ready, false);
          assert.deepEqual(errors, []);
        } finally {
          await browser?.close();
          await new Promise((resolve) => server.close(resolve));
        }
      }),
  );
test(
  'All design archives install with a local compiler and CLI, then publish and drain Windows and both Web profiles',
  { timeout },
  async () => {
    const parent = fs.realpathSync(os.tmpdir()),
      directory = fs.mkdtempSync(path.join(parent, 'engine-install-')),
      archives = path.join(directory, 'archives'),
      app = path.join(directory, 'App'),
      npm =
        process.env.npm_execpath ??
        path.join(path.dirname(process.execPath), 'node_modules/npm/bin/npm-cli.js');
    const environment = { ...process.env };
    // An external consumer must not inherit the parent npm project's lifecycle,
    // workspace selection or the test runner's child-process channel settings.
    for (const key of Object.keys(environment)) {
      const name = key.toLowerCase();
      if (
        (name.startsWith('npm_') && !name.startsWith('npm_config_')) ||
        [
          'npm_config_local_prefix',
          'npm_config_workspace',
          'npm_config_workspaces',
          'npm_config_node_gyp',
          'init_cwd',
          'node_test_context',
          'node_channel_fd',
          'node_channel_serialization_mode',
        ].includes(name)
      )
        delete environment[key];
    }
    let browser, server, child;
    const command = (script, args, cwd = repo) => {
      try {
        return execFileSync(process.execPath, [script, ...args], {
          cwd,
          encoding: 'utf8',
          timeout,
          windowsHide: true,
          env: environment,
          maxBuffer: 2 * 1024 * 1024,
        });
      } catch (error) {
        const diagnostic = {
          node: fs.realpathSync(process.execPath),
          nodeVersion: process.version,
          npm: fs.realpathSync(npm),
          npmVersion: JSON.parse(
            fs.readFileSync(path.resolve(path.dirname(npm), '../package.json'), 'utf8'),
          ).version,
          script: fs.realpathSync(script),
          cwd,
          status: error.status,
          signal: error.signal,
          stdoutBytes: Buffer.byteLength(error.stdout ?? ''),
          stderrBytes: Buffer.byteLength(error.stderr ?? ''),
          availableMemory: os.freemem(),
          totalMemory: os.totalmem(),
          inheritedLifecycle: Object.keys(environment).some((key) =>
            /^(npm_lifecycle_|node_test_context|node_channel_)/i.test(key),
          ),
        };
        throw new Error('External consumer process failed: ' + JSON.stringify(diagnostic), {
          cause: error,
        });
      }
    };
    try {
      fs.mkdirSync(archives);
      for (const packageRoot of [
        'Nelyx',
        'Nelyx/sdk',
        'packages/material',
        'packages/cupertino',
        'Nelyx/sdk/tooling/metro',
        'Nelyx/sdk/tooling/static-aot',
        'Nelyx/sdk/tooling/cli',
      ])
        command(
          npm,
          [
            'pack',
            '--ignore-scripts',
            '--workspaces=false',
            '--json',
            '--pack-destination',
            archives,
          ],
          path.join(repo, packageRoot),
        );
      const sourceCli = path.join(repo, 'Nelyx/sdk/tooling/cli/src/main.mjs');
      command(sourceCli, [
        'create',
        app,
        '--name',
        'ArchiveApp',
        '--engine',
        'v2',
        '--target',
        'web',
        '--packages',
        archives,
        '--designs',
        'material,cupertino',
      ]);
      command(
        npm,
        [
          'install',
          '--ignore-scripts',
          '--no-audit',
          '--no-fund',
          '--prefer-offline',
          '--workspaces=false',
        ],
        app,
      );
      for (const name of ['core', 'sdk', 'material', 'cupertino', 'cli'])
        assert.equal(
          fs.lstatSync(path.join(app, 'node_modules/@nelyx', name)).isSymbolicLink(),
          false,
          name,
        );
      for (const [name, source] of [
        ['core', 'Nelyx/dist/v2/engine-client/index.js'],
        ['sdk', 'Nelyx/sdk/dist/runtime/engine-v2-app.js'],
        ['material', 'packages/material/dist/v2.js'],
        ['cupertino', 'packages/cupertino/dist/v2.js'],
      ])
        assert.equal(
          fs.readFileSync(
            path.join(app, 'node_modules/@nelyx', name, source.slice(source.indexOf('dist/'))),
            'utf8',
          ),
          fs.readFileSync(path.join(repo, source), 'utf8'),
        );
      fs.mkdirSync(path.join(app, 'assets'));
      fs.copyFileSync(
        path.join(repo, 'sample/nelyx-testbed-app-2/assets/component-image.webp'),
        path.join(app, 'assets/source.webp'),
      );
      fs.writeFileSync(
        path.join(app, 'nelyx.v2.json'),
        JSON.stringify({
          schema: 'nelyx.app.v2/1',
          engine: 'v2',
          entry: 'src/app.ts',
          assets: { 'sample.webp': 'assets/source.webp' },
        }),
      );
      fs.writeFileSync(path.join(app, 'src/app.ts'), fixture);
      const compiler = fs.realpathSync(path.join(app, 'node_modules/typescript/lib/tsc.js'));
      assert.ok(
        compiler.startsWith(fs.realpathSync(app) + path.sep),
        'The compiler belongs to the installed consumer',
      );
      command(
        compiler,
        [
          '--noEmit',
          '--strict',
          '--skipLibCheck',
          '--module',
          'NodeNext',
          '--target',
          'ES2022',
          'src/app.ts',
        ],
        app,
      );
      const cli = path.join(app, 'node_modules/@nelyx/cli/src/main.mjs'),
        cliArgs = ['--app', app, '--engine', 'v2', '--target', 'web', '--engine-inputs', supply];
      const built = JSON.parse(command(cli, ['build', ...cliArgs], app));
      const packed = JSON.parse(
        command(cli, ['pack', ...cliArgs, '--package', built.directory], app),
      );
      const bundle = verifyEngineV2Application(packed.directory, 'web');
      assert.equal(bundle.manifest.supply, 'engine');
      server = createEngineV2Server(bundle);
      server.listen(0, '127.0.0.1');
      await once(server, 'listening');
      browser = await chromium.launch({ headless: true });
      for (const route of ['plain', 'isolated']) {
        const page = await browser.newPage(),
          errors = [];
        page.on('pageerror', (error) => errors.push(String(error)));
        await page.goto(`http://127.0.0.1:${server.address().port}/${route}/`);
        await page.waitForFunction(
          () => globalThis.__nelyxV2?.ready || globalThis.__nelyxV2?.errors.length,
        );
        const ready = await page.evaluate(() => ({
          ready: globalThis.__nelyxV2.ready,
          errors: globalThis.__nelyxV2.errors,
          receipt: globalThis.__nelyxV2.receipt,
        }));
        assert.equal(ready.ready, true, JSON.stringify(ready));
        assert.deepEqual(ready.errors, []);
        assert.equal(ready.receipt.engineWork, String(ready.receipt.commands));
        assert.equal(ready.receipt.execution.observed, true);
        assert.equal(ready.receipt.execution.acknowledgedCommands, ready.receipt.commands);
        assert.equal(ready.receipt.execution.fallbackPolicy, 'reject-unported');
        assert.equal(ready.receipt.execution.rejectedFallbacks, 0);
        await page.waitForFunction(
          () => globalThis.__nelyxV2.surface.diagnostics['render-stats']?.state?.publication > 0n,
        );
        assert.equal((await page.evaluate(() => globalThis.__nelyxV2.close())).reservedBytes, 0);
        assert.deepEqual(errors, []);
        await page.close();
      }
      const nativeArgs = [
          '--app',
          app,
          '--engine',
          'v2',
          '--target',
          'windows',
          '--engine-inputs',
          supply,
        ],
        nativeBuilt = JSON.parse(command(cli, ['build', ...nativeArgs], app)),
        nativePacked = JSON.parse(
          command(cli, ['pack', ...nativeArgs, '--package', nativeBuilt.directory], app),
        ),
        nativeBundle = verifyEngineV2Application(nativePacked.directory, 'windows');
      assert.equal(nativeBundle.manifest.supply, 'engine');
      child = spawn(
        path.join(nativePacked.directory, 'engine/native/NelyxEngineV2Host.exe'),
        [path.join(nativePacked.directory, 'engine'), '--app', nativePacked.directory, '--probe'],
        // This is the visible application under test. STARTUPINFO SW_HIDE would
        // override its first ShowWindow and prevent a renderable scene activation.
        { stdio: ['pipe', 'pipe', 'pipe'], windowsHide: false, env: environment },
      );
      let output = '',
        nativeErrors = '';
      child.stdout.on('data', (data) => (output = (output + data).slice(-32000)));
      child.stderr.on('data', (data) => (nativeErrors = (nativeErrors + data).slice(-8000)));
      child.on('error', (error) => (nativeErrors += String(error)));
      await waitFor(
        () => output.includes('app-ready'),
        () => nativeErrors || (child.exitCode !== null ? output : null),
      );
      const nativeReady = JSON.parse(
        output
          .split('\n')
          .find((line) => line.startsWith('V2_APP ') && line.includes('app-ready'))
          .slice(7),
      );
      assert.equal(nativeReady.engineWork, String(nativeReady.commands));
      assert.equal(nativeReady.execution.observed, true);
      child.stdin.write('close\n');
      await waitFor(
        () => child.exitCode !== null,
        () => nativeErrors || null,
      );
      assert.equal(child.exitCode, 0, nativeErrors + output);
      assert.match(output, /app-disposed/);
      assert.match(output, /"memoryTotal":0/);
      fs.writeFileSync(path.join(app, 'src/app.ts'), originalFixture);
      command(
        compiler,
        [
          '--noEmit',
          '--strict',
          '--skipLibCheck',
          'false',
          '--module',
          'NodeNext',
          '--target',
          'ES2022',
          'src/app.ts',
        ],
        app,
      );
      const originalBuilt = JSON.parse(command(cli, ['build', ...cliArgs], app));
      assert.equal(originalBuilt.routing.appModel, 'original-elements');
      await new Promise((resolve) => server.close(resolve));
      server = createEngineV2Server(verifyEngineV2Application(originalBuilt.directory, 'web'));
      server.listen(0, '127.0.0.1');
      await once(server, 'listening');
      const originalPage = await browser.newPage();
      await originalPage.goto(`http://127.0.0.1:${server.address().port}/isolated/`);
      await originalPage.waitForFunction(
        () => globalThis.__nelyxV2?.ready || globalThis.__nelyxV2?.errors.length,
      );
      const originalReady = await originalPage.evaluate(() => ({
        ready: globalThis.__nelyxV2.ready,
        errors: globalThis.__nelyxV2.errors,
        receipt: globalThis.__nelyxV2.receipt,
      }));
      assert.deepEqual(originalReady.errors, [], JSON.stringify(originalReady));
      assert.equal(originalReady.ready, true);
      assert.equal(originalReady.receipt.execution.appModel, 'original-elements');
      assert.equal(originalReady.receipt.execution.tsLayoutFallbacks, 0);
      assert.equal(originalReady.receipt.engineWork, String(originalReady.receipt.commands));
      await originalPage.waitForFunction(
        () => globalThis.__nelyxV2.surface.diagnostics['render-stats']?.state?.publication > 0n,
      );
      await assertOriginalPixels(originalPage);
      await assertOriginalResize(originalPage);
      assert.equal(
        (await originalPage.evaluate(() => globalThis.__nelyxV2.close())).reservedBytes,
        0,
      );
      await originalPage.close();
    } finally {
      try {
        if (child && child.exitCode === null) {
          child.kill();
          await once(child, 'exit');
        }
        await browser?.close();
        if (server) await new Promise((resolve) => server.close(resolve));
      } finally {
        stopCompiler();
        assert.equal(path.dirname(path.resolve(directory)), parent);
        fs.rmSync(directory, { recursive: true, force: true, maxRetries: 3 });
      }
    }
  },
);
test(
  'An explicitly selected App SDK app packs its local runtime and CRT, runs with a clean PATH, and refuses damaged supply',
  { timeout },
  () =>
    consumer(async (app) => {
      const settings = JSON.parse(fs.readFileSync(path.join(app, 'nelyx.v2.json'), 'utf8'));
      fs.writeFileSync(
        path.join(app, 'nelyx.v2.json'),
        JSON.stringify({ ...settings, windowsHost: 'windows-app-sdk' }),
      );
      const built = await buildEngineV2Application({
        app,
        target: 'windows',
        engineInputs: supply,
      });
      const packed = await engineV2Operation('pack', {
        app,
        target: 'windows',
        directory: built.directory,
      });
      const bundle = verifyEngineV2Application(packed.directory, 'windows');
      assert.equal(bundle.manifest.windowsHost, 'windows-app-sdk');
      assert.equal(bundle.supply.manifest.profiles['windows-app-sdk'].version, '1.8.260508005');
      const runtimeRoot = path.join(packed.directory, 'engine/windows-app-sdk');
      const child = spawn(
        path.join(runtimeRoot, 'NelyxEngineAppSdkHost.exe'),
        [bundle.supply.root, '--app', packed.directory, '--probe'],
        {
          stdio: ['pipe', 'pipe', 'pipe'],
          windowsHide: false,
          env: {
            ...process.env,
            PATH: path.join(process.env.SystemRoot, 'System32') + ';' + process.env.SystemRoot,
          },
        },
      );
      let output = '',
        errors = '';
      child.stdout.on('data', (bytes) => (output = (output + bytes).slice(-32000)));
      child.stderr.on('data', (bytes) => (errors = (errors + bytes).slice(-8000)));
      child.on('error', (error) => (errors += String(error)));
      try {
        await waitFor(
          () => output.includes('app-ready') && output.includes('V2_SCENE_PUBLISHED 1'),
          () => errors || (child.exitCode !== null ? output : null),
        );
        const ready = JSON.parse(
          output
            .split('\n')
            .find((line) => line.startsWith('V2_APP ') && line.includes('app-ready'))
            .slice(7),
        );
        assert.equal(ready.execution.observed, true);
        assert.equal(ready.execution.acknowledgedCommands, ready.commands);
        assert.equal(ready.engineWork, String(ready.commands));
        assert.match(output, /"host":"windows-app-sdk"/);
        const modules = JSON.parse(
          execFileSync(
            'powershell.exe',
            [
              '-NoProfile',
              '-NonInteractive',
              '-File',
              path.join(engineRoot, 'tests/windows-app-sdk-modules.ps1'),
              '-ProcessId',
              String(child.pid),
              '-AppSdkRoot',
              runtimeRoot,
            ],
            { timeout, windowsHide: true, encoding: 'utf8' },
          ),
        );
        assert.equal(modules.appLocal, true);
        console.log('V2_APP_LOCAL_RUNTIME ' + JSON.stringify(modules));
        child.stdin.write('close\n');
        await waitFor(
          () => child.exitCode !== null,
          () => errors || null,
        );
        assert.equal(child.exitCode, 0, output + errors);
        assert.match(output, /V2_WINDOWS_DISPATCHER_CLOSED/);
        assert.match(output, /"memoryTotal":0/);
      } finally {
        if (child.exitCode === null) {
          child.kill();
          await once(child, 'exit');
        }
      }
      fs.unlinkSync(path.join(runtimeRoot, 'Microsoft.UI.Windowing.dll'));
      assert.throws(
        () => verifyEngineV2Application(packed.directory, 'windows'),
        /ENOENT|identity mismatch/,
      );
    }),
);

const originalFixture = `import {defineOriginalEngineV2App} from '@nelyx/sdk/engine-v2-original';
import type {EngineV2AppContext} from '@nelyx/sdk/engine-v2-original';
import {State,StatefulWidget,InheritedWidget} from '@nelyx/core/framework/widgets/framework';
import type {BuildContext,Widget} from '@nelyx/core/framework/widgets/framework';
import {GlobalKey} from '@nelyx/core/framework/widgets/global-key';
import {SizedBox,Padding,Row,Expanded,ColoredBox,Align,Stack,Text,Transform} from '@nelyx/core/framework/widgets/basic';
import {ClipRRect as OriginalClipRRect} from '@nelyx/core/framework/widgets/clip';
import {TextStyle} from '@nelyx/core/framework/painting/text-style';
import {TextHeightBehavior,FontWeight} from '@nelyx/core/ui/typography';
import {protocol as p} from '@nelyx/core/v2';
import type {EngineResponse} from '@nelyx/core/v2';
let context:EngineV2AppContext,disposes=0;const key=new GlobalKey<CounterState>('native-original');
function matches(cpp:EngineResponse,width:number){const blue=cpp.nodes.find(n=>n.color===0xff2468ac),root=cpp.nodes.find(n=>n.kind===p.kinds.stack&&n.parent.slot===0);if(!blue||!root)return false;const parent=(node:EngineResponse['nodes'][number]|undefined)=>cpp.nodes.find(n=>n.node.slot===node?.parent.slot&&n.node.generation===node?.parent.generation),transform=parent(blue),clip=parent(transform),blueBox=parent(clip);return transform?.kind===p.kinds.transform&&transform.graphics?.transform?.[0]===-1&&transform.graphics.alignment?.x===0&&clip?.kind===p.kinds.clip&&clip.clipStyle?.shape==='rrect'&&clip.clipStyle.behavior==='antiAliasWithSaveLayer'&&clip.clipStyle.radii.every(r=>r===8)&&cpp.nodes.some(n=>n.color===0xff62ba81&&n.width===width-50&&n.height===50&&n.x===0)&&blueBox?.x===width-50&&cpp.nodes.some(n=>n.kind===p.kinds.box&&n.parent.slot===root.node.slot&&n.width===width&&n.height===60)&&cpp.nodes.some(n=>n.kind===p.kinds.paragraph&&n.fontSize===10&&n.width===45&&n.height===12&&n.baseline>0&&n.semantics?.label==='한 A😀'&&n.textDirection===1&&n.paragraph?.textAlign==='center'&&n.paragraph.maxLines===1&&n.paragraph.ellipsis==='…'&&n.paragraph.locale==='ko'&&n.paragraph.height===1.5&&n.paragraph.letterSpacing===0.5&&n.paragraph.wordSpacing===1&&n.paragraph.halfLeading&&n.paragraph.applyHeightToFirstAscent===false&&n.paragraph.applyHeightToLastDescent===false);}
class Theme extends InheritedWidget{readonly value=7;constructor(child:Widget){super(child);}updateShouldNotify(){return false;}}
class Counter extends StatefulWidget{createState(){return new CounterState();}}
class CounterState extends State{count=0;width=120;generation=0;ready=false;cold=true;initState(){this.setState(()=>++this.count);if(this.count!==1)throw Error('Original state did not update immediately');}
build(ctx:BuildContext){if(ctx.dependOn(Theme).value!==7||ctx!==this.context)throw Error('Original context identity changed');const metrics=ctx.services.readMetrics();this.width=Math.max(120,metrics.logicalWidth/4+20);this.generation=metrics.viewportGeneration;if(this.ready)void this.verifyViewport(this.generation,this.width,metrics.logicalWidth,metrics.logicalHeight);if(this.cold)return new SizedBox(12,60,new Text('😀\u00ad😀\u00ad😀',{fontSize:14,color:0xffabcdef}));return new Align(new SizedBox(this.width,60,new Stack([new Padding({left:10,top:5,right:10,bottom:5},new Row([new SizedBox(30,20,new OriginalClipRRect(Transform.flip(new ColoredBox({color:0xff2468ac}),{flipX:true}),{borderRadius:8,clipBehavior:'antiAliasWithSaveLayer'})),new Expanded(new ColoredBox({color:0xff62ba81,child:new Align(new SizedBox(45,12,new Text('한 A😀',{direction:'rtl',textAlign:'center',maxLines:1,overflow:'ellipsis',locale:'ko',textHeightBehavior:new TextHeightBehavior({applyHeightToFirstAscent:false,applyHeightToLastDescent:false,leadingDistribution:'proportional'}),style:new TextStyle({fontSize:10,color:0xffabcdef,fontWeight:FontWeight.normal,height:1.5,letterSpacing:0.5,wordSpacing:1,leadingDistribution:'even'})})),{alignment:{x:-1,y:1}})}))],{mainAxisSize:'max',crossAxisAlignment:'stretch',textDirection:'rtl',verticalDirection:'up'})),new SizedBox(10,10,new ColoredBox({color:0xffff9900}))],{alignment:{x:2,y:0},clipBehavior:'hardEdge'})),{widthFactor:1,heightFactor:1});}
private async verifyViewport(generation:number,width:number,logicalWidth:number,logicalHeight:number){try{for(let attempt=0;attempt<30&&this.mounted&&this.generation===generation;++attempt){const cpp=await context.view.request(p.opcodes.layoutSnapshot);if(cpp.status===p.statuses.ok&&cpp.layoutMetrics===BigInt(generation)&&matches(cpp,width)){context.notify({kind:'original-resize-native',generation,width,logicalWidth,logicalHeight,commands:String(cpp.transactionWork),layout:String(cpp.layoutWork)});return;}await new Promise(resolve=>setTimeout(resolve,100));}if(this.mounted&&this.generation===generation)throw Error('Original resize did not activate matching C++ geometry');}catch(error){if(this.mounted)context.notify({kind:'app-error',message:String(error)});}}
dispose(){if(++disposes!==1)throw Error('Original State disposed twice');context.notify({kind:'original-state-disposed',disposes});}}
export default defineOriginalEngineV2App({build(ctx){context=ctx;return new Theme(new Counter(key));},async ready(ctx){const state=key.currentState;if(!state?.mounted||state.count!==1||key.currentContext!==state.context)throw Error('Original lifecycle identity changed');let cpp=await ctx.view.layoutSnapshot();const cold=cpp.nodes.find(n=>n.kind===p.kinds.paragraph);if(cold?.width!==12||cold.paragraph?.hyphens!=='manual'||cpp.layoutWork===0n)throw Error('Initial native soft-hyphen preparation was not observed');ctx.notify({kind:'original-cold-ready',commands:String(cpp.transactionWork),layout:String(cpp.layoutWork)});state.setState(()=>{state.cold=false;});for(let attempt=0;attempt<30;++attempt){cpp=await ctx.view.request(p.opcodes.layoutSnapshot);if(cpp.status===p.statuses.ok&&matches(cpp,state.width))break;await new Promise(resolve=>setTimeout(resolve,100));}if(!matches(cpp,state.width)||cpp.layoutWork===0n)throw Error('Native original layout was not observed');state.ready=true;ctx.notify({kind:'original-api-ready',commands:String(cpp.transactionWork),layout:String(cpp.layoutWork),tsLayoutFallbacks:0});}});`;
async function assertOriginalPixels(page, width) {
  const rect = await page.locator('canvas').boundingBox();
  assert.ok(rect);
  width ??= Math.max(120, rect.width / 4 + 20);
  const png = await page.screenshot();
  const pixels = await page.evaluate(
    async ({ base64, x, y, offsets }) => {
      const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
      const bitmap = await createImageBitmap(new Blob([bytes], { type: 'image/png' }));
      try {
        const canvas = document.createElement('canvas');
        canvas.width = bitmap.width;
        canvas.height = bitmap.height;
        const context = canvas.getContext('2d');
        context.drawImage(bitmap, 0, 0);
        const samples = offsets.map(([dx, dy]) => [
          ...context.getImageData(Math.round(x + dx), Math.round(y + dy), 1, 1).data,
        ]);
        const glyphs = context.getImageData(Math.round(x + 10), Math.round(y + 43), 45, 12).data;
        let glyphPixels = 0;
        for (let i = 0; i < glyphs.length; i += 4)
          if (glyphs[i] !== 98 || glyphs[i + 1] !== 186 || glyphs[i + 2] !== 129) ++glyphPixels;
        return { samples, glyphPixels };
      } finally {
        bitmap.close();
      }
    },
    {
      base64: png.toString('base64'),
      x: rect.x,
      y: rect.y,
      offsets: [
        [width - 20, 15],
        [15, 15],
        [width - 15, 15],
        [width + 5, 15],
        [rect.width - 1, 15],
        [(width - 10) * 1.5 + 5, 30],
      ],
    },
  );
  assert.deepEqual(
    pixels.samples.slice(0, 3),
    [
      [36, 104, 172, 255],
      [98, 186, 129, 255],
      [36, 104, 172, 255],
    ],
    'Canonical ColoredBox becomes actual C++/CanvasKit pixels',
  );
  assert.deepEqual(
    pixels.samples[3],
    pixels.samples[4],
    'Pixels beyond the resized box match the clear canvas',
  );
  assert.deepEqual(
    pixels.samples[5],
    pixels.samples[4],
    'The overflowing second Stack child is clipped on the actual WebGL2 surface',
  );
  assert.notDeepEqual(pixels.samples[3], [98, 186, 129, 255]);
  assert.ok(
    pixels.glyphPixels > 0,
    'Original Korean, Latin and emoji text paints actual font pixels',
  );
}
async function assertOriginalResize(page) {
  await page.evaluate(() => {
    globalThis.__originalResize = undefined;
    globalThis.__nelyxV2.app.addEventListener('message', (event) => {
      if (event.data.kind === 'original-resize-native') globalThis.__originalResize = event.data;
    });
  });
  await page.setViewportSize({ width: 520, height: 370 });
  await page.waitForFunction(
    () =>
      globalThis.__nelyxV2.errors.length ||
      (globalThis.__originalResize?.logicalWidth === 520 &&
        globalThis.__originalResize.logicalHeight === 370 &&
        globalThis.__nelyxV2.surface.diagnostics['render-stats']?.state?.layoutMetrics ===
          BigInt(globalThis.__originalResize.generation)),
    {},
    { timeout: 30000 },
  );
  const resized = await page.evaluate(() => ({
    value: globalThis.__originalResize,
    errors: globalThis.__nelyxV2.errors,
  }));
  assert.deepEqual(resized.errors, []);
  assert.equal(resized.value.width, 150);
  assert.ok(BigInt(resized.value.commands) > 0n && BigInt(resized.value.layout) > 0n);
  await assertOriginalPixels(page, resized.value.width);
}
for (const windowsHost of ['windows-hwnd', 'windows-app-sdk'])
  test(
    `Original App consumer uses canonical State and actual C++ layout on ${windowsHost}`,
    { timeout },
    () =>
      consumer(async (app) => {
        fs.writeFileSync(path.join(app, 'src/app.ts'), originalFixture);
        const settings = JSON.parse(fs.readFileSync(path.join(app, 'nelyx.v2.json'), 'utf8'));
        fs.writeFileSync(
          path.join(app, 'nelyx.v2.json'),
          JSON.stringify({ ...settings, windowsHost }),
        );
        const built = await buildEngineV2Application({
          app,
          target: 'windows',
          engineInputs: supply,
        });
        assert.equal(built.routing.appModel, 'original-elements');
        assert.ok(built.routing.canonicalAppInputs > 0);
        const child = spawn(
          path.join(
            supply,
            windowsHost === 'windows-app-sdk'
              ? 'windows-app-sdk/NelyxEngineAppSdkHost.exe'
              : 'native/NelyxEngineV2Host.exe',
          ),
          [supply, '--app', built.directory, '--probe'],
          { stdio: ['pipe', 'pipe', 'pipe'], windowsHide: false },
        );
        let output = '',
          errors = '';
        child.stdout.on('data', (bytes) => {
          output = (output + bytes).slice(-32000);
        });
        child.stderr.on('data', (bytes) => {
          errors = (errors + bytes).slice(-8000);
        });
        child.on('error', (error) => {
          errors += String(error);
        });
        try {
          await waitFor(
            () => output.includes('app-ready') && output.includes('original-api-ready'),
            () => (errors ? errors + '\n' + output : child.exitCode !== null ? output : null),
          );
          const ready = JSON.parse(
            output
              .split('\n')
              .find((line) => line.startsWith('V2_APP ') && line.includes('app-ready'))
              .slice(7),
          );
          assert.equal(ready.execution.appModel, 'original-elements');
          assert.equal(ready.execution.compatibility, 'partial');
          assert.equal(ready.execution.tsLayoutFallbacks, 0);
          assert.equal(ready.execution.appGeometryNodes, 0);
          assert.equal(ready.execution.rejectedFallbacks, 0);
          assert.equal(ready.engineWork, String(ready.commands));
          assert.ok(ready.commands > 0);
          child.stdin.write('resize 800\n');
          await waitFor(
            () =>
              output
                .split('\n')
                .some(
                  (line) =>
                    line.startsWith('V2_APP ') &&
                    line.includes('original-resize-native') &&
                    JSON.parse(line.slice(7)).logicalWidth === 800,
                ),
            () => errors || (child.exitCode !== null ? output : null),
          );
          child.stdin.write('close\n');
          await waitFor(
            () => child.exitCode !== null,
            () => errors || null,
          );
          assert.equal(child.exitCode, 0, output + errors);
          assert.match(output, /original-state-disposed/);
          assert.match(output, /"memoryTotal":0/);
        } finally {
          if (child.exitCode === null) {
            child.kill();
            await once(child, 'exit');
          }
        }
      }),
  );
for (const [route, profile] of [
  ['plain', 'single-worker'],
  ['isolated', 'threaded'],
])
  test(
    `Original App consumer publishes canonical State and native colored boxes in ${route}`,
    { timeout },
    () =>
      consumer(async (app) => {
        fs.writeFileSync(path.join(app, 'src/app.ts'), originalFixture);
        const built = await buildEngineV2Application({ app, target: 'web', engineInputs: supply }),
          server = createEngineV2Server(verifyEngineV2Application(built.directory, 'web'));
        assert.equal(built.routing.appModel, 'original-elements');
        let browser;
        server.listen(0, '127.0.0.1');
        await once(server, 'listening');
        try {
          browser = await chromium.launch({ headless: true });
          const page = await browser.newPage({ viewport: { width: 400, height: 330 } }),
            errors = [];
          page.on('pageerror', (error) => errors.push(String(error)));
          await page.goto(`http://127.0.0.1:${server.address().port}/${route}/`);
          await page.waitForFunction(
            () => globalThis.__nelyxV2?.ready || globalThis.__nelyxV2?.errors.length,
            {},
            { timeout: 30000 },
          );
          const current = await page.evaluate(() => ({
            ready: globalThis.__nelyxV2.ready,
            errors: globalThis.__nelyxV2.errors,
            profile: globalThis.__nelyxV2.surface?.selectedProfile,
            receipt: globalThis.__nelyxV2.receipt,
          }));
          assert.deepEqual(current.errors, [], JSON.stringify(current));
          assert.equal(current.ready, true);
          assert.equal(current.profile, profile);
          assert.equal(current.receipt.execution.appModel, 'original-elements');
          assert.equal(current.receipt.execution.tsLayoutFallbacks, 0);
          assert.equal(current.receipt.execution.appGeometryNodes, 0);
          assert.equal(current.receipt.engineWork, String(current.receipt.commands));
          assert.ok(current.receipt.commands > 0);
          await page.waitForFunction(
            () => globalThis.__nelyxV2.surface.diagnostics['render-stats']?.state?.publication > 0n,
          );
          await assertOriginalPixels(page);
          await assertOriginalResize(page);
          const closed = await page.evaluate(() => globalThis.__nelyxV2.close());
          assert.equal(closed.reservedBytes, 0);
          assert.deepEqual(errors, []);
        } finally {
          await browser?.close();
          await new Promise((resolve) => server.close(resolve));
        }
      }),
  );

for (const route of ['plain', 'isolated'])
  for (const phase of ['services', 'build', 'widget'])
    test(
      `Original App ${phase} startup failure drains ${route} without waiting for an already completed disposal`,
      { timeout },
      () =>
        consumer(async (app) => {
          const message = 'original-' + phase + '-startup-failure';
          fs.writeFileSync(
            path.join(app, 'src/app.ts'),
            `import {defineOriginalEngineV2App} from '@nelyx/sdk/engine-v2-original';import {SizedBox,Text} from '@nelyx/core/framework/widgets/basic';export default defineOriginalEngineV2App({${phase === 'services' ? `services:{get platformServices(){throw Error('${message}');}} as any,` : ''}build(){${phase === 'build' ? `throw Error('${message}');` : phase === 'widget' ? `return new Text('${message}',{overflow:'fade'});` : 'return new SizedBox(20,10);'}}});`,
          );
          const built = await buildEngineV2Application({
              app,
              target: 'web',
              engineInputs: supply,
            }),
            server = createEngineV2Server(verifyEngineV2Application(built.directory, 'web'));
          let browser;
          server.listen(0, '127.0.0.1');
          await once(server, 'listening');
          try {
            browser = await chromium.launch({ headless: true });
            const page = await browser.newPage();
            await page.goto(`http://127.0.0.1:${server.address().port}/${route}/`);
            await page.waitForFunction(
              () => globalThis.__nelyxV2?.errors.length,
              {},
              { timeout: 30000 },
            );
            const result = await page.evaluate(async () => {
              const current = globalThis.__nelyxV2,
                first = current.close(),
                same = first === current.close();
              const closed = await first;
              return { same, closed, errors: current.errors, ready: current.ready };
            });
            assert.equal(result.same, true);
            assert.equal(result.ready, false);
            assert.equal(result.closed.reservedBytes, 0);
            assert.equal(result.closed.workersStopped, true);
            assert.ok(
              result.errors.some((error) =>
                error.includes(
                  phase === 'widget' ? 'Original native bridge rejects paragraph-style' : message,
                ),
              ),
              JSON.stringify(result.errors),
            );
            assert.ok(result.errors.every((error) => !error.includes('disposal timeout')));
          } finally {
            await browser?.close();
            await new Promise((resolve) => server.close(resolve));
          }
        }),
    );

async function waitFor(predicate, error) {
  const end = Date.now() + 20000;
  while (Date.now() < end) {
    if (predicate()) return;
    const failure = error?.();
    if (failure) assert.fail(failure);
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  assert.fail('Consumer host timeout');
}
