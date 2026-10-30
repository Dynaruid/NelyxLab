// SPDX-License-Identifier: BSD-3-Clause
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawnSync } from 'node:child_process';
import { windowsCompilerEnvironment } from '../../sdk/tooling/cli/src/windows-static-hermes.mjs';
const timeout = 1_200_000;
test(
  'Windows fixture pacing uses owned high-resolution waits for each workload interval without injecting input',
  { timeout, skip: process.platform !== 'win32' },
  () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'nelyx-wheel-pacer-'));
    try {
      const source = path.join(directory, 'pacer.cpp'),
        executable = path.join(directory, 'pacer.exe'),
        env = windowsCompilerEnvironment();
      fs.writeFileSync(
        source,
        `#include "windows-wheel-pacer.h"
#include <cmath>
void check(bool value){if(!value)throw std::runtime_error("Wheel pacing contract failed");}
int main()try{
 using Nelyx::Fixture::WheelPacer;
 for(const int interval:{1,4,8,16}){
  WheelPacer pacer(interval);const auto start=WheelPacer::Clock::now();
  for(int index=0;index<4;++index){const auto begin=WheelPacer::Clock::now();pacer.sample();pacer.wait(begin);}
  check(pacer.count==4&&pacer.samples.size()==3);check(std::chrono::duration<double,std::milli>(WheelPacer::Clock::now()-start).count()>=interval*3.0);
  for(const auto sample:pacer.samples)check(std::isfinite(sample)&&sample>0);pacer.wait(WheelPacer::Clock::now()-std::chrono::seconds(2));pacer.report("unit-no-input");
 }
 for(const int invalid:{0,1001}){bool rejected=false;try{WheelPacer pacer(invalid);}catch(std::exception const&){rejected=true;}check(rejected);}
 std::cout<<"PASS-scoped wheel timer bounds, completion samples and expired waits; no OS input\\n";return 0;
}catch(std::exception const& error){std::cerr<<error.what();return 1;}
`,
      );
      const run = (file, args) => {
        const result = spawnSync(file, args, {
          cwd: directory,
          env,
          encoding: 'utf8',
          windowsHide: true,
          timeout,
          maxBuffer: 2 * 1024 * 1024,
        });
        if (result.error) throw result.error;
        assert.equal(result.status, 0, result.stdout + result.stderr);
        return result.stdout;
      };
      run('cl.exe', [
        '/nologo',
        '/std:c++20',
        '/EHsc',
        '/O2',
        '/MD',
        '/W4',
        '/WX',
        '/utf-8',
        '/DNOMINMAX',
        '/DWIN32_LEAN_AND_MEAN',
        '/I' + import.meta.dirname,
        source,
        '/Fo' + path.join(directory, 'pacer.obj'),
        '/Fe' + executable,
        '/link',
        'user32.lib',
      ]);
      const output = run(executable, []),
        reports = output
          .split(/\r?\n/)
          .filter((line) => line.startsWith('ANIMATION_WHEEL_SEND '))
          .map((line) => JSON.parse(line.slice('ANIMATION_WHEEL_SEND '.length)));
      assert.deepEqual(
        reports.map((report) => report.requestedMs),
        [1, 4, 8, 16],
      );
      for (const report of reports) {
        assert.equal(report.count, 4);
        assert.equal(report.policy, 'high-resolution-relative-start-completion-v1');
        assert(report.p50Ms > 0 && report.maxMs >= report.p95Ms);
      }
      assert.match(output, /PASS-scoped/);
      console.log(output.trim());
    } finally {
      assert.equal(path.dirname(directory), fs.realpathSync(os.tmpdir()));
      assert(!fs.lstatSync(directory).isSymbolicLink());
      fs.rmSync(directory, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
    }
  },
);
