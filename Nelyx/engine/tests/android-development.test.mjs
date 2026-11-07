// SPDX-License-Identifier: BSD-3-Clause
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { stop } from 'esbuild';
import { engineRoot, timeout, sourceIdentity, run } from '../tools/build.mjs';
import { androidSdk } from '../tools/build-android.mjs';
import { createEngineV2Development } from '../../sdk/tooling/cli/src/engine-v2-development.mjs';

test(
  'Android development keeps the running APK after build failure, drains before reload and drains on close',
  { timeout },
  async () => {
    const supply = path.join(engineRoot, 'dist-android');
    assert.equal(
      JSON.parse(fs.readFileSync(path.join(supply, 'engine-manifest.json'))).sourceSha256,
      sourceIdentity(),
    );
    const adb = path.join(
      androidSdk(),
      'platform-tools',
      process.platform === 'win32' ? 'adb.exe' : 'adb',
    );
    const devices = run(adb, ['devices'])
        .split(/\r?\n/)
        .flatMap((line) => /^(emulator-\d+)\s+device$/.exec(line)?.[1] ?? []),
      device = process.env.NELYX_ANDROID_TEST_SERIAL ?? devices[0];
    assert.ok(devices.includes(device));
    const call = (args) => run(adb, ['-s', device, ...args]),
      parent = path.resolve(engineRoot, '../../.nelyx/android-v2'),
      app = fs.mkdtempSync(path.join(parent, 'development-'));
    const applicationId = 'dev.nelyx.development';
    let session;
    const fixture = (value, failDisposal = false) =>
      `import {defineEngineV2App} from '@nelyx/sdk/engine-v2';import {Button} from '@nelyx/core/v2';export default defineEngineV2App({build({notify}){notify({kind:'development-version',value:${JSON.stringify(value)}});return new Button(${JSON.stringify(value)},()=>{}, {properties:{x:20,y:30,width:200,height:60}});},dispose(){${failDisposal ? "throw Error('controlled disposal refusal');" : ''}}});`;
    const events = [];
    const until = async (condition) => {
      const end = Date.now() + 120000;
      while (Date.now() < end) {
        if (condition()) return;
        await new Promise((resolve) => setTimeout(resolve, 30));
      }
      assert.fail(JSON.stringify({ status: session?.status, events }));
    };
    try {
      fs.writeFileSync(path.join(app, 'package.json'), '{"private":true,"type":"module"}');
      fs.writeFileSync(
        path.join(app, 'nelyx.v2.json'),
        JSON.stringify({
          schema: 'nelyx.app.v2/1',
          engine: 'v2',
          entry: 'app.ts',
          supply,
          android: { applicationId },
        }),
      );
      fs.writeFileSync(path.join(app, 'app.ts'), fixture('one'));
      session = await createEngineV2Development({
        app,
        target: 'android',
        architecture: 'x86_64',
        device,
        quiet: true,
        onEvent: (event) => events.push(event),
      });
      assert.equal(session.status.generation, 1);
      const first = events.find((event) => event.kind === 'native-ready');
      assert.ok(first.firstFrame && first.nativeCommands > 0 && first.rejectedFallbacks === 0);
      fs.writeFileSync(path.join(app, 'app.ts'), 'invalid TypeScript !');
      await until(() => events.some((event) => event.kind === 'build-failed'));
      assert.equal(session.status.generation, 1);
      assert.equal(events.filter((event) => event.kind === 'native-drained').length, 0);
      assert.equal(call(['shell', 'pidof', applicationId]), first.pid);
      fs.writeFileSync(path.join(app, 'app.ts'), fixture('two'));
      await until(() => session.status.phase === 'open' && session.status.generation === 2);
      const drained = events.findIndex((event) => event.kind === 'native-drained'),
        second = events.findLastIndex((event) => event.kind === 'native-ready');
      assert.ok(drained > 0 && second > drained);
      assert.notEqual(events[second].pid, first.pid);
      const output = call([
        'logcat',
        '-d',
        '--pid=' + events[second].pid,
        '-v',
        'raw',
        '-s',
        'NelyxV2',
      ]);
      assert.ok(output.includes('"kind":"development-version","value":"two"'));
      // Build output and persistent Gradle cache changes must not create a reload loop.
      await new Promise((resolve) => setTimeout(resolve, 250));
      assert.equal(session.status.generation, 2);
      assert.equal(session.status.requested, session.status.completed);
      const result = await session.close();
      assert.equal(result.exitCode, 0, JSON.stringify(result));
      assert.equal(events.filter((event) => event.kind === 'native-drained').length, 2);
      for (const event of events.filter((event) => event.kind === 'native-drained'))
        assert.ok(
          event.closed.closed &&
            event.closed.memoryTotal === 0 &&
            event.closed.reservedBytes === 0 &&
            event.closed.workersJoined &&
            event.closed.appDisposed,
        );
      assert.deepEqual(
        fs.readdirSync(path.join(app, 'dist')).filter((name) => name.startsWith('.engine-v2-')),
        [],
      );
      const failedEvents = [];
      fs.writeFileSync(path.join(app, 'app.ts'), fixture('refuses-dispose', true));
      session = await createEngineV2Development({
        app,
        target: 'android',
        architecture: 'x86_64',
        device,
        quiet: true,
        onEvent: (event) => failedEvents.push(event),
      });
      fs.writeFileSync(path.join(app, 'app.ts'), fixture('must-not-install'));
      const failed = await session.closed;
      assert.equal(failed.exitCode, 1);
      assert.equal(failed.generation, 1);
      assert.ok(failed.errors.some((error) => error.includes('drain timeout')));
      assert.equal(failedEvents.filter((event) => event.kind === 'native-ready').length, 1);
      assert.equal(failedEvents.filter((event) => event.kind === 'native-drained').length, 0);
      assert.ok(failedEvents.some((event) => event.kind === 'replacement-failed'));
      assert.deepEqual(
        fs.readdirSync(path.join(app, 'dist')).filter((name) => name.startsWith('.engine-v2-')),
        [],
      );
    } finally {
      await session?.close();
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
      assert.ok(path.basename(app).startsWith('development-'));
      fs.rmSync(app, { recursive: true, force: true, maxRetries: 3 });
    }
  },
);
