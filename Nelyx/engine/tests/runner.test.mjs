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
import {Stack,Box,Text,Image,ImageResource,Transform,ClipRRect,PathShape,VectorPath,ImageFiltered,ValueListenableBuilder,protocol as p} from '@nelyx/core/v2';
import {FilledButton} from '@nelyx/material/v2';import {CupertinoSwitch} from '@nelyx/cupertino/v2';
import {Color} from '@nelyx/core/ui/color';import {Colors} from '@nelyx/material/colors';import {EdgeInsets} from '@nelyx/core/framework/painting/edge-insets';
import {ValueKey} from '@nelyx/core/foundation/key';import {ValueNotifier} from '@nelyx/core/foundation/notifier';
import {Curves} from '@nelyx/core/framework/animation/curves';import {FrictionSimulation} from '@nelyx/core/framework/physics/friction-simulation';
const notifier=new ValueNotifier(0xff123456);
export default defineEngineV2App({requiredCapabilities:p.capabilities.graphics|p.capabilities.controls,async build({asset}){
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
        assert.equal(ready.fallbacks, 0);
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
    fixture.replace(
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
              first = current.close(),
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
            };
          });
          assert.equal(result.same, true);
          assert.match(result.message, /consumer disposal failure/);
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
  'Current package archives create and install a typed consumer with its own CLI and portable Web host',
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
    let browser, server;
    const command = (script, args, cwd = repo) =>
      execFileSync(process.execPath, [script, ...args], {
        cwd,
        encoding: 'utf8',
        timeout,
        windowsHide: true,
        env: environment,
        maxBuffer: 2 * 1024 * 1024,
      });
    try {
      fs.mkdirSync(archives);
      for (const packageRoot of [
        'Nelyx',
        'Nelyx/sdk',
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
      assert.equal(
        fs.lstatSync(path.join(app, 'node_modules/@nelyx/core')).isSymbolicLink(),
        false,
      );
      for (const [name, source] of [
        ['core', 'Nelyx/dist/v2/engine-client/index.js'],
        ['sdk', 'Nelyx/sdk/dist/runtime/engine-v2-app.js'],
      ])
        assert.equal(
          fs.readFileSync(
            path.join(app, 'node_modules/@nelyx', name, source.slice(source.indexOf('dist/'))),
            'utf8',
          ),
          fs.readFileSync(path.join(repo, source), 'utf8'),
        );
      command(
        path.join(repo, 'node_modules/typescript/lib/tsc.js'),
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
      const page = await browser.newPage(),
        errors = [];
      page.on('pageerror', (error) => errors.push(String(error)));
      await page.goto(`http://127.0.0.1:${server.address().port}/plain/`);
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
      assert.equal(ready.receipt.fallbacks, 0);
      await page.waitForFunction(
        () => globalThis.__nelyxV2.surface.diagnostics['render-stats']?.state?.publication > 0n,
      );
      assert.equal((await page.evaluate(() => globalThis.__nelyxV2.close())).reservedBytes, 0);
      assert.deepEqual(errors, []);
    } finally {
      await browser?.close();
      if (server) await new Promise((resolve) => server.close(resolve));
      assert.equal(path.dirname(path.resolve(directory)), parent);
      fs.rmSync(directory, { recursive: true, force: true, maxRetries: 3 });
    }
  },
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
