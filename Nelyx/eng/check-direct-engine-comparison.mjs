// SPDX-License-Identifier: BSD-3-Clause
// Alternate fresh processes using identical installed app JS and renderer.
// Results stay on stdout/in memory; each native runner owns its finally cleanup.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const runOption = process.argv.indexOf('--runs');
const runs = Number(runOption < 0 ? 3 : process.argv[runOption + 1]);
assert(Number.isInteger(runs) && runs >= 1 && runs <= 10, 'Choose --runs 1..10');
const choices = [
  { engine: 'hermes' },
  { engine: 'jsc', jscMode: 'interpreter' },
  ...(process.argv.includes('--jit') ? [{ engine: 'jsc', jscMode: 'jit' }] : []),
];
const deadline = Date.now() + 1_200_000,
  records = [];
for (let run = 1; run <= runs; run++) {
  for (const choice of choices) {
    assert(Date.now() < deadline, 'Direct engine comparison exceeded 20 minutes');
    console.log('DIRECT_ENGINE_RUN ' + JSON.stringify({ ...choice, run, runs }));
    const args = [
      fileURLToPath(new URL('./check-windows-jank.mjs', import.meta.url)),
      '--engine',
      choice.engine,
      '--runs',
      '1',
      ...(choice.jscMode ? ['--jsc-mode', choice.jscMode] : []),
    ];
    let summary,
      tail = '';
    const child = spawn(process.execPath, args, {
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    const kill = () => child.kill();
    process.once('SIGINT', kill);
    process.once('SIGTERM', kill);
    const timer = setTimeout(kill, Math.max(1, deadline - Date.now()));
    for (const stream of [child.stdout, child.stderr]) {
      let pending = '';
      stream.setEncoding('utf8');
      stream.on('data', (chunk) => {
        tail = (tail + chunk).slice(-16000);
        pending += chunk;
        let at;
        while ((at = pending.indexOf('\n')) >= 0) {
          const line = pending.slice(0, at);
          pending = pending.slice(at + 1);
          if (line.startsWith('JANK_COMPARISON_SUMMARY ')) summary = JSON.parse(line.slice(24));
        }
      });
    }
    let code;
    try {
      code = await new Promise((resolve, reject) => {
        child.once('error', reject);
        child.once('close', resolve);
      });
    } finally {
      clearTimeout(timer);
      process.removeListener('SIGINT', kill);
      process.removeListener('SIGTERM', kill);
    }
    if (code !== 0 || !summary) throw Error('Direct engine run failed: ' + tail);
    const result = summary.runs[0],
      baseline = records[0];
    assert.equal(result.performanceSample, true);
    assert.equal(result.displayed.length, 3, 'Require displayed observation');
    if (baseline) {
      for (const key of [
        'applicationSourceSha256',
        'rendererSha256',
        'baseHostSourceSha256',
        'diagnosticEntrySha256',
        'installedSdkInputsSha256',
      ])
        assert.equal(
          result.identity[key],
          baseline.identity[key],
          'Engine comparison changed ' + key,
        );
      for (const key of ['physicalWidth', 'physicalHeight', 'dpi', 'refreshHz'])
        assert.equal(
          result.measurementView[key],
          baseline.measurementView[key],
          'Engine comparison changed ' + key,
        );
    }
    records.push({ run, ...result });
    console.log('DIRECT_ENGINE_RECORD ' + JSON.stringify(records.at(-1)));
  }
}
console.log(
  'DIRECT_ENGINE_COMPARISON_PASS ' +
    JSON.stringify({
      runs,
      choices,
      sameApplicationJs: true,
      records: records.length,
      performanceAccepted: false,
    }),
);
