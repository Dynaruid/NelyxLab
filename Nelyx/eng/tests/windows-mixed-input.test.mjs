// SPDX-License-Identifier: BSD-3-Clause
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { verifyWindowsPackage } from '../../sdk/tooling/cli/src/windows-runner.mjs';
import { startWindowsProcess } from '../../sdk/tooling/cli/src/windows-process.mjs';
import {
  verifyGeometryActivation,
  geometryActivationCollector,
} from './native-service-activation.js';
import {
  verifyNativeServiceExperiment,
  verifyNativeModuleMode,
} from './native-service-experiment.js';
import { engineModes, verifyNativeEngineExperiment } from './native-engine-experiment.js';
import { withoutBackingEvidence, verifyBackingExperiment } from './backing-experiment.js';
import { scrollModes, verifyNativeScrollActivation } from './native-scroll-activation.js';

const timeout = 1_200_000,
  inputGeometry = process.env.NELYX_WINDOWS_MIXED_INPUT_GEOMETRY ?? 'ts',
  experiment = process.env.NELYX_WINDOWS_MIXED_EXPERIMENT,
  nativeModules = process.env.NELYX_WINDOWS_MIXED_NATIVE_MODULES,
  root = path.resolve(import.meta.dirname, '../../..'),
  trials = process.env.NELYX_WINDOWS_MIXED_TRIALS
    ? process.env.NELYX_WINDOWS_MIXED_TRIALS.split(',').map(Number)
    : [1, 2, 3, 4];
if (
  !trials.length ||
  new Set(trials).size !== trials.length ||
  trials.some((n) => ![1, 2, 3, 4].includes(n))
)
  throw Error('NELYX_WINDOWS_MIXED_TRIALS must select distinct owners 1..4');
function helper(pid, buttonRange) {
  return runHelper(
    [
      '-File',
      path.join(import.meta.dirname, 'windows-mixed-input.ps1'),
      '-AppPid',
      String(pid),
      '-KoreanIme',
      ...(buttonRange ? ['-ButtonRange'] : []),
    ],
    'MIXED_INPUT ',
  );
}
function galleryReturn(pid, executable, windowTransitions = false) {
  return runHelper(
    [
      '-File',
      path.join(import.meta.dirname, 'windows-continuous-scroll.ps1'),
      '-Executable',
      executable,
      '-TargetProcessId',
      String(pid),
      '-Page',
      'material',
      '-Maximized',
      '-BothColumns',
      '-MouseMotion',
      ...(windowTransitions ? ['-WindowTransitions'] : []),
      '-InputDurationMs',
      '5000',
    ],
    'CONTINUOUS_SCROLL ',
  );
}
function runHelper(args, prefix) {
  return new Promise((resolve, reject) => {
    const child = spawn(
      'powershell.exe',
      ['-Mta', '-NoProfile', '-ExecutionPolicy', 'Bypass', ...args],
      {
        cwd: root,
        windowsHide: true,
        stdio: ['ignore', 'pipe', 'pipe'],
      },
    );
    let output = '';
    const consume = (data) => {
      output = (output + data.toString()).slice(-256 * 1024);
    };
    child.stdout.on('data', consume);
    child.stderr.on('data', consume);
    const timer = setTimeout(() => child.kill(), timeout);
    child.once('error', (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.once('close', (code) => {
      clearTimeout(timer);
      process.stdout.write(output);
      if (code !== 0) reject(Error('Actual Windows input helper exited ' + code));
      else {
        const line = output.split(/\r?\n/).find((line) => line.startsWith(prefix));
        if (!line) reject(Error('Actual Windows input report missing: ' + prefix));
        else {
          try {
            resolve(JSON.parse(line.slice(prefix.length)));
          } catch (error) {
            reject(error);
          }
        }
      }
    });
  });
}
test(
  `Windows mixed input, Korean IME and native close for fresh owners ${trials.join(',')}; owner 4 checks button keys`,
  { timeout, skip: process.platform !== 'win32' },
  async () => {
    const locator = JSON.parse(
      fs.readFileSync(
        path.join(root, 'sample/nelyx-testbed-app-2/.nelyx/windows/last-package.json'),
        'utf8',
      ),
    );
    assert.equal(
      createHash('sha256')
        .update(fs.readFileSync(path.join(locator.directory, 'nelyx-package.json')))
        .digest('hex'),
      locator.manifestSha256,
    );
    const checked = verifyWindowsPackage(locator.directory);
    for (const trial of trials) {
      const buttonRange = trial === 4;
      const geometryActivation = geometryActivationCollector();
      let native = '',
        errorTail = '',
        allocationFailure;
      const child = startWindowsProcess(
        path.join(checked.directory, checked.manifest.executable),
        [],
        {
          cwd: checked.directory,
          env: {
            ...process.env,
            NELYX_WINDOWS_INPUT_TRACE: '1',
            NELYX_TRACKPAD_DIAGNOSTICS: '1',
            NELYX_WINDOWS_FRAME_DIAGNOSTICS: '1',
          },
          onOutput: (data, stream) => {
            geometryActivation.observe(data, stream);
            const errors = errorTail + data;
            allocationFailure ??= /Could not create UploadInstance|allocator stage=/.exec(
              errors,
            )?.[0];
            errorTail = errors.slice(-128);
            native = (native + data).slice(-64 * 1024);
          },
        },
      );
      try {
        if (trial === 1) {
          // Keep both Gallery columns' lazy resources in this same owner before
          // exercising the eager mixed page. A fresh mixed-only owner misses
          // the allocation pressure seen in ordinary Gallery -> mixed use.
          const gallery = await galleryReturn(
            child.pid,
            path.join(checked.directory, checked.manifest.executable),
            true,
          );
          assert.equal(gallery.checks.length, 4);
          console.log(
            'MIXED_GALLERY_CADENCE',
            JSON.stringify({
              stage: 'before',
              mode: nativeModules || experiment || 'ts',
              gaps: gallery.checks.map((row) => row.maximumGapMs),
            }),
          );
          assert(
            gallery.checks.every((row) => row.changesDuringInput >= 10 && row.maximumGapMs <= 350),
          );
        }
        const report = await helper(child.pid, buttonRange);
        assert.equal(report.fields, 12);
        assert.equal(report.buttons, 36);
        assert.equal(report.ime.status, 'PASS-scoped');
        assert.equal(report.ime.undoAfterCommit, true);
        assert.equal(
          report.checks.filter((row) =>
            buttonRange ? row.buttonKeysWithoutEditor : row.osKeyWithoutRefocus,
          ).length,
          3,
        );
        if (trial === 1) {
          // Do not resize or restart the owner here: that would purge the
          // warmed scratch and hide a mixed -> Gallery resource regression.
          const gallery = await galleryReturn(
            child.pid,
            path.join(checked.directory, checked.manifest.executable),
          );
          assert.equal(gallery.checks.length, 4);
          console.log(
            'MIXED_GALLERY_CADENCE',
            JSON.stringify({
              stage: 'return',
              mode: nativeModules || experiment || 'ts',
              gaps: gallery.checks.map((row) => row.maximumGapMs),
            }),
          );
          assert(
            gallery.checks.every((row) => row.changesDuringInput >= 10 && row.maximumGapMs <= 350),
          );
          assert(
            !native.includes('rnw-frame-probe'),
            'Mixed/Gallery regression excludes the source frame probe',
          );
          console.log(
            'MIXED_GALLERY_RETURN',
            JSON.stringify({
              pid: child.pid,
              maximumGapsMs: gallery.checks.map((row) => row.maximumGapMs),
              scope: `${nativeModules ? 'interactive native-module package' : experiment ? 'explicit native-service experiment package' : 'ordinary package'}, both Gallery columns after actual mixed input/IME in the same owner; native diagnostics and desktop capture enabled; not ordinary FPS`,
            }),
          );
        }
        const close = await child.stop();
        assert.equal(close.exitCode, 0);
        assert.equal(close.forced, false);
        assert.match(native, /closed views=0 consumers=0 gpuDrained=1 inputRetired=1/);
        assert.doesNotMatch(native, /REACT_ERROR|close-failed|text-input-failed/);
        const evidence = geometryActivation.finish(),
          inputGeometryActivation = nativeModules
            ? verifyNativeModuleMode(evidence, {
                mode: nativeModules,
                fullRange:
                  engineModes.includes(nativeModules) ||
                  ['backing', 'scroll', 'section-lifetime'].includes(nativeModules),
              })
            : scrollModes.includes(experiment)
              ? verifyNativeScrollActivation(evidence, { mode: experiment })
              : experiment
                ? verifyNativeServiceExperiment(withoutBackingEvidence(evidence), {
                    mode: experiment,
                    requireNativeWork:
                      !engineModes.includes(experiment) && experiment !== 'backing',
                  })
                : verifyGeometryActivation(
                    evidence,
                    // Cold edits deliberately use TS. The warm cadence comparison has
                    // the separate 95% native coverage requirement.
                    {
                      mode: inputGeometry,
                      requireEditors: inputGeometry === 'retained',
                      minimumCoverage: 0,
                    },
                  );
        const candidate = nativeModules || experiment;
        let engine;
        if (engineModes.includes(candidate)) {
          engine = verifyNativeEngineExperiment(evidence, {
            mode: candidate,
            manual: !!nativeModules,
          });
          assert.equal(engine.observed, true, 'The functional owner must execute the candidate');
          assert.equal(engine.closed, true);
        }
        if (candidate === 'backing' || candidate === 'all') {
          engine = verifyBackingExperiment(evidence, {
            mode: 'backing',
            manual: !!nativeModules,
          });
        }
        if (['all', 'scroll'].includes(nativeModules))
          assert(
            Object.entries(inputGeometryActivation.modules).every(
              ([name, value]) => name === 'scroll-input' || value === 'observed',
            ),
            'Gallery/Mixed OS-wheel control must exercise the demanded modules; DirectManipulation requires physical contact separately',
          );
        assert.equal(
          allocationFailure,
          undefined,
          'Native allocations/uploads must succeed throughout the owner',
        );
        console.log(
          'MIXED_OWNER_PASS',
          JSON.stringify({
            trial,
            buttonRange,
            pid: child.pid,
            close,
            inputGeometryActivation,
            engine,
          }),
        );
      } finally {
        await child.stop();
        if (scrollModes.includes(nativeModules || experiment)) {
          try {
            const result = verifyNativeScrollActivation(geometryActivation.finish(), {
              mode: nativeModules || experiment,
            });
            console.log(
              'MIXED_SCROLL_EXECUTION',
              JSON.stringify({ modules: result.modules, native: result.native, sdk: result.sdk }),
            );
          } catch (error) {
            console.error('MIXED_SCROLL_EVIDENCE_FAILURE', String(error));
          }
        }
        process.stdout.write(
          native
            .split(/\r?\n/)
            .filter((line) => /closed |close-failed|REACT_ERROR|text-input-failed/.test(line))
            .slice(-8)
            .join('\n') + '\n',
        );
      }
    }
  },
);
