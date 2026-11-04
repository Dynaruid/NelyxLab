// SPDX-License-Identifier: BSD-3-Clause
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawnSync } from 'node:child_process';
import { windowsCompilerEnvironment } from '../../sdk/tooling/cli/src/windows-static-hermes.mjs';
import { execute } from '../../sdk/tooling/cli/src/commands.mjs';
import { createSectionLifetimeService } from '@nelyx/skia-native/section-lifetime';
import { sectionLifetimeProtocol as protocol } from '@nelyx/core/hosting/section-lifetime';
import { ListView } from '@nelyx/core/framework/widgets/scroll-view';
import { ScrollController } from '@nelyx/core/framework/widgets/scroll-controller';
import { SizedBox } from '@nelyx/core/framework/widgets/basic';
import { Directionality } from '@nelyx/core/framework/widgets/app-data';
import { EdgeInsets } from '@nelyx/core/framework/painting/edge-insets';
import { fixture } from '../../../packages/material/tests/root-fixture.mjs';
import { FoundationPlatform } from '@nelyx/core/foundation/platform';
const timeout = 1_200_000;
FoundationPlatform.configure({ kind: 'native', operatingSystem: 'windows' });
test('explicit section selection requires native support', { timeout }, () => {
  assert.throws(() => createSectionLifetimeService({}, () => {}), /capability missing/);
});
test(
  'actual C++ coordinator and live section decisions preserve limits and real Element retirement',
  { timeout, skip: process.platform !== 'win32' },
  async () => {
    const parent = fs.realpathSync(os.tmpdir()),
      directory = fs.mkdtempSync(path.join(parent, 'nelyx-scroll-coordinator-'));
    try {
      const executable = path.join(directory, 'coordinator.exe'),
        env = windowsCompilerEnvironment();
      await execute(
        'cl.exe',
        [
          '/nologo',
          '/std:c++20',
          '/O2',
          '/fp:strict',
          '/EHsc',
          '/MD',
          '/DNOMINMAX',
          '/I' + path.resolve(import.meta.dirname, '../../skia/native/host'),
          '/I' + path.resolve(import.meta.dirname, '../../skia/native/core'),
          path.join(import.meta.dirname, 'scroll-coordinator-native.cpp'),
          '/Fe' + executable,
        ],
        { cwd: directory, env, timeout },
      );
      const self = spawnSync(executable, [], {
        cwd: directory,
        env,
        timeout,
        encoding: 'utf8',
        windowsHide: true,
      });
      assert.equal(self.status, 0, self.stderr);
      assert.match(self.stdout, /PASS coordinator/);
      const run = (packet, reject = false) => {
        const count = Buffer.alloc(4);
        count.writeUInt32LE(packet.length);
        const result = spawnSync(executable, ['packet'], {
          cwd: directory,
          env,
          timeout,
          windowsHide: true,
          input: Buffer.concat([
            count,
            Buffer.from(packet.buffer, packet.byteOffset, packet.byteLength),
          ]),
        });
        if (reject) {
          assert.equal(result.status, 2);
          return;
        }
        assert.equal(result.status, 0, result.stderr.toString());
        return Array.from({ length: result.stdout.length / 8 }, (_, i) =>
          result.stdout.readDoubleLE(i * 8),
        );
      };
      const packet = (header, rows) =>
        new Float64Array([protocol.magic, 1, ...header, ...rows.flat()]);
      const retain = packet(
        [0, 7, 1, 3, 2, 2, 20, 0, 100, 1, 0, 0, 0, 0],
        [
          [1, 1, 80, 10, 0, 0, 0, 1],
          [2, 1, 10, 10, 0, 1, 1, 1],
          [3, 1, 110, 10, 0, 1, 1, 1],
        ],
      );
      assert.deepEqual(run(retain), [1, 1, 2, 0, 3]);
      const pressure = retain.slice();
      pressure[9] = 1;
      assert.deepEqual(run(pressure), [1, 0, 0, 0, 3]);
      const invalid = retain.slice();
      invalid[5] = 3.5;
      run(invalid, true);
      const duplicate = retain.slice();
      duplicate[24] = 1;
      run(duplicate, true);
      const prep = packet(
        [1, 7, 2, 2, 2, 0, 0, 0, 0, 1, 10, 20, 1, 0.1],
        [
          [1, 1, 0, 10, 2.1, 0, 0, 1],
          [2, 1, 0, 10, 1, 0, 0, 1],
        ],
      );
      assert.deepEqual(run(prep), [2, 0, 0, 2, 2]);
      prep[13] = 15;
      assert.equal(run(prep)[3], 0);
      const service = createSectionLifetimeService(
        {
          nelyxSectionLifetimeVersion: () => 1,
          nelyxSectionLifetime: (bytes) => run(new Float64Array(bytes)),
        },
        () => {},
      );
      const f = fixture(),
        controller = new ScrollController();
      let budget;
      try {
        f.set(
          new Directionality(
            'ltr',
            ListView.builder({
              primary: false,
              controller,
              itemExtent: 80,
              itemCount: 20,
              padding: EdgeInsets.zero,
              childPolicy: { mode: 'bounded', capacity: 2 },
              itemBuilder: () => new SizedBox(100, 80),
            }),
          ),
        );
        budget = f.root.buildOwner.viewWorkBudget;
        budget.sectionLifetime = service;
        for (const offset of [80, 160, 240, 160, 80, 240, 320, 240, 160, 80, 0]) {
          controller.jumpTo(offset);
          f.frame();
          assert(budget.debugStats.optionalChildren <= 2);
          assert(budget.debugStats.optionalElements <= 2048);
        }
        assert(service.execution().decisions > 0);
        assert(service.execution().appliedRetain > 0);
        assert(
          service.execution().appliedEvict > 0,
          'Native-requested eviction is acknowledged only when canonical Elements actually release their old record',
        );
        assert(service.execution().visited > 0);
      } finally {
        f.close();
        controller.dispose();
        service.dispose();
      }
      assert.equal(budget.debugStats.trackedElements, 0);
    } finally {
      assert.equal(path.dirname(fs.realpathSync(directory)), parent);
      assert(!fs.lstatSync(directory).isSymbolicLink());
      fs.rmSync(directory, { recursive: true, force: true });
    }
  },
);
