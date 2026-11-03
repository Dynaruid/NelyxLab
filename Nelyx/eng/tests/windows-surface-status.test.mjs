// SPDX-License-Identifier: BSD-3-Clause
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { windowsCompilerEnvironment } from '../../sdk/tooling/cli/src/windows-static-hermes.mjs';
import { execute } from '../../sdk/tooling/cli/src/commands.mjs';
const timeout = 1_200_000;
test(
  'native lifecycle delivery follows backing epochs and new consumers without throttling continuous views',
  { timeout, skip: process.platform !== 'win32' },
  async () => {
    const parent = fs.realpathSync(os.tmpdir()),
      directory = fs.mkdtempSync(path.join(parent, 'nelyx-surface-status-'));
    try {
      const source = path.join(directory, 'status.cpp'),
        executable = path.join(directory, 'status.exe'),
        env = windowsCompilerEnvironment();
      fs.writeFileSync(
        source,
        `#include "WindowsSurfaceStatusPolicy.h"
#include <cassert>
int main(){
  RNSkia::WindowsSurfaceStatusPolicy status;
  assert(!status.lifecycle());
  for(int i=0;i<30;++i)assert(status.frame(1,1,true));
  assert(status.mode(true));
  assert(!status.frame(1,2,false)); // A stale completion cannot consume readiness.
  assert(status.frame(1,2,true));
  for(int i=0;i<30;++i)assert(!status.frame(1,2,true));
  assert(!status.mode(true));assert(!status.frame(1,2,true));
  assert(status.frame(1,3,true)); // A -> B -> A dimensions still have a new epoch.
  assert(status.frame(1,4,true));
  assert(status.frame(2,4,true)); // New owner, same backing number.
  status.resetConsumer(); // Emitter replacement or binding retirement.
  assert(!status.frame(2,4,false));assert(status.frame(2,4,true));
  assert(!status.frame(2,4,true));
  assert(status.mode(false));
  for(int i=0;i<30;++i)assert(status.frame(2,4,true));
  assert(status.mode(true));assert(status.frame(2,4,true));
  return 0;
}`,
      );
      await execute(
        'cl.exe',
        [
          '/nologo',
          '/std:c++20',
          '/EHsc',
          '/MD',
          '/O2',
          '/I' + path.resolve(import.meta.dirname, '../../skia/packages/rn/native/windows'),
          source,
          '/Fe:' + executable,
          '/Fo:' + path.join(directory, 'status.obj'),
        ],
        { cwd: directory, env, timeout },
      );
      await execute(executable, [], { cwd: directory, env, timeout });
    } finally {
      assert.equal(path.dirname(fs.realpathSync(directory)), parent);
      assert(!fs.lstatSync(directory).isSymbolicLink());
      fs.rmSync(directory, { recursive: true, force: true });
    }
  },
);
