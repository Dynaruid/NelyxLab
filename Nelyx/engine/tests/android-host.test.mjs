// SPDX-License-Identifier: BSD-3-Clause
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { engineRoot, timeout, run, sourceIdentity } from '../tools/build.mjs';
import { androidSdk } from '../tools/build-android.mjs';
import {
  buildEngineV2Application,
  verifyEngineV2Supply,
  verifyEngineV2Application,
  engineV2Operation,
  createEngineV2Project,
} from '../../sdk/tooling/cli/src/engine-v2-runner.mjs';

test(
  'Android rejects missing native capabilities and damaged supply before installation',
  { timeout },
  () => {
    const parent = path.join(engineRoot, '.cache');
    fs.mkdirSync(parent, { recursive: true });
    const directory = fs.mkdtempSync(path.join(parent, 'android-gates-'));
    try {
      const supplied = JSON.parse(
        fs.readFileSync(path.join(engineRoot, 'dist-android/engine-manifest.json')),
      );
      const value = {
        ...supplied,
        profiles: { android: { ...supplied.profiles.android, abis: ['x86_64'] } },
        files: [],
      };
      const write = () =>
        fs.writeFileSync(path.join(directory, 'engine-manifest.json'), JSON.stringify(value));
      write();
      assert.throws(
        () => verifyEngineV2Supply(directory, 'android'),
        /Android native capability is missing/,
      );
      value.profiles.android.reactNative = true;
      write();
      assert.throws(() => verifyEngineV2Supply(directory, 'android'), /host capability is missing/);
      value.profiles.android.reactNative = false;
      value.profiles.android.abis = ['x86_64', 'x86_64'];
      write();
      assert.throws(
        () => verifyEngineV2Supply(directory, 'android'),
        /Invalid Android supply ABI set/,
      );
      value.profiles.android.abis = ['x86_64'];
      value.files = [{ path: 'damaged.so', sha256: '0'.repeat(64) }];
      fs.writeFileSync(path.join(directory, 'damaged.so'), 'damaged');
      write();
      assert.throws(() => verifyEngineV2Supply(directory, 'android'), /supply identity mismatch/);
      const app = path.join(directory, 'app');
      createEngineV2Project(app, { designs: ['material', 'cupertino'] });
      const project = JSON.parse(fs.readFileSync(path.join(app, 'package.json')));
      assert.ok(project.scripts['build:android'].includes('--engine v2 --target android'));
      assert.ok(
        project.dependencies['@nelyx/material'] && project.dependencies['@nelyx/cupertino'],
      );
      assert.ok(
        !Object.keys({ ...project.dependencies, ...project.devDependencies }).some(
          (name) => name === 'react' || name.startsWith('react-native'),
        ),
      );
    } finally {
      assert.equal(path.dirname(directory), parent);
      assert.ok(path.basename(directory).startsWith('android-gates-'));
      fs.rmSync(directory, { recursive: true, force: true, maxRetries: 3 });
    }
  },
);
test(
  'Android standalone installed host preserves input, semantics and owner lifetimes',
  { timeout },
  async (t) => {
    const sdk = androidSdk(),
      adb = path.join(sdk, 'platform-tools', process.platform === 'win32' ? 'adb.exe' : 'adb');
    const devices = run(adb, ['devices'])
      .split(/\r?\n/)
      .flatMap((line) => /^(emulator-\d+)\s+device$/.exec(line)?.[1] ?? []);
    const serial =
      process.env.NELYX_ANDROID_TEST_SERIAL ?? (devices.length === 1 ? devices[0] : undefined);
    assert.ok(
      serial && devices.includes(serial),
      'Select one ready Android emulator with NELYX_ANDROID_TEST_SERIAL',
    );
    const supply = verifyEngineV2Supply(path.join(engineRoot, 'dist-android'), 'android');
    assert.equal(
      supply.manifest.sourceSha256,
      sourceIdentity(),
      'Rebuild the Android supply from current source before runtime tests',
    );
    const app = path.resolve(engineRoot, '../../sample/nelyx-engine-v2-android');
    const call = (args) => run(adb, ['-s', serial, ...args]);
    const uninstall = (name) => {
      if (
        call(['shell', 'pm', 'list', 'packages', name])
          .split(/\r?\n/)
          .includes('package:' + name)
      ) {
        call(['shell', 'am', 'force-stop', name]);
        call(['uninstall', name]);
      }
    };
    if (!process.env.NELYX_ANDROID_ORIGINAL_ONLY) {
      const doctor = await engineV2Operation('doctor', { app, target: 'android' });
      assert.equal(doctor.sourceSha256, supply.manifest.sourceSha256);
      const built = await buildEngineV2Application({
        app,
        target: 'android',
        architecture: 'x86_64',
        androidTests: true,
      });
      const packaged = path.join(app, 'dist/v2-android-test-package');
      const removeTestApk = () => {
        fs.rmSync(path.join(built.directory, 'android/instrumentation.apk'), { force: true });
        const manifest = path.join(built.directory, 'app-manifest.json'),
          value = JSON.parse(fs.readFileSync(manifest));
        value.files = value.files.filter((file) => file.path !== 'android/instrumentation.apk');
        fs.writeFileSync(manifest, JSON.stringify(value, null, 2) + '\n');
      };
      try {
        assert.match(
          call(['install', '-r', path.join(built.directory, 'android/application.apk')]),
          /Success/,
        );
        assert.match(
          call(['install', '-r', path.join(built.directory, 'android/instrumentation.apk')]),
          /Success/,
        );
        const output = call([
          'shell',
          'am',
          'instrument',
          '-w',
          'dev.nelyx.engine.test/dev.nelyx.engine.AndroidHostTests',
        ]);
        assert.match(output, /INSTRUMENTATION_RESULT: status=PASS\b/, output);
        assert.doesNotMatch(output, /INSTRUMENTATION_RESULT: error=/, output);
        t.diagnostic(output.trim());
        removeTestApk();
        const bytecode = path.join(built.directory, 'application/app.hbc'),
          saved = fs.readFileSync(bytecode);
        try {
          fs.appendFileSync(bytecode, 'damaged');
          assert.throws(
            () => verifyEngineV2Application(built.directory, 'android'),
            /Application bundle identity mismatch/,
          );
        } finally {
          fs.writeFileSync(bytecode, saved);
        }
        const packed = await engineV2Operation('pack', {
          app,
          target: 'android',
          output: 'dist/v2-android-test-package',
        });
        assert.equal(packed.directory, packaged);
        assert.equal(verifyEngineV2Application(packaged, 'android').manifest.supply, 'engine');
        const installed = await engineV2Operation('run', {
          app,
          target: 'android',
          directory: 'dist/v2-android-test-package',
          device: serial,
        });
        assert.ok(
          installed.installed &&
            installed.firstFrame &&
            installed.nativeCommands > 0 &&
            installed.rejectedFallbacks === 0,
        );
        t.diagnostic('Portable Android package installed and published its matching C++ frame');
      } finally {
        try {
          call(['shell', 'am', 'force-stop', 'dev.nelyx.engine']);
          uninstall('dev.nelyx.engine.test');
        } finally {
          removeTestApk();
          assert.equal(path.dirname(packaged), path.join(app, 'dist'));
          assert.equal(path.basename(packaged), 'v2-android-test-package');
          fs.rmSync(packaged, { recursive: true, force: true, maxRetries: 3 });
        }
      }
    }
    const parent = path.join(app, '.nelyx');
    fs.mkdirSync(parent, { recursive: true });
    const original = fs.mkdtempSync(path.join(parent, 'original-'));
    try {
      fs.writeFileSync(path.join(original, 'package.json'), '{"private":true,"type":"module"}\n');
      fs.copyFileSync(path.join(app, 'src/original.ts'), path.join(original, 'app.ts'));
      fs.writeFileSync(
        path.join(original, 'nelyx.v2.json'),
        JSON.stringify({
          schema: 'nelyx.app.v2/1',
          engine: 'v2',
          entry: 'app.ts',
          supply: supply.root,
          android: { applicationId: 'dev.nelyx.original' },
        }),
      );
      const built = await buildEngineV2Application({
        app: original,
        target: 'android',
        architecture: 'x86_64',
        androidTests: true,
      });
      assert.equal(built.routing.appModel, 'original-elements');
      assert.ok(
        built.routing.packageInputs['@nelyx/material'] > 1 &&
          built.routing.packageInputs['@nelyx/cupertino'] > 1,
      );
      assert.match(
        call(['install', '-r', path.join(built.directory, 'android/application.apk')]),
        /Success/,
      );
      assert.match(
        call(['install', '-r', path.join(built.directory, 'android/instrumentation.apk')]),
        /Success/,
      );
      const output = call([
        'shell',
        'am',
        'instrument',
        '-w',
        '-e',
        'mode',
        'original',
        'dev.nelyx.original.test/dev.nelyx.engine.AndroidHostTests',
      ]);
      assert.match(output, /INSTRUMENTATION_RESULT: status=PASS\b/, output);
      assert.doesNotMatch(output, /INSTRUMENTATION_RESULT: error=/, output);
      t.diagnostic(output.trim());
    } finally {
      try {
        for (const name of ['dev.nelyx.original.test', 'dev.nelyx.original']) uninstall(name);
      } finally {
        assert.equal(path.dirname(original), parent);
        assert.ok(path.basename(original).startsWith('original-'));
        fs.rmSync(original, { recursive: true, force: true, maxRetries: 3 });
      }
    }
  },
);
