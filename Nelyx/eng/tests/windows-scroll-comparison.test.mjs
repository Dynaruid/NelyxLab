// SPDX-License-Identifier: BSD-3-Clause
import test from 'node:test';
import assert from 'node:assert/strict';
import { qualifiedScrollRuns, compareScrollEngine } from './windows-scroll-comparison.mjs';
const timeout = 1_200_000,
  sources = Object.fromEntries(
    ['gallery', 'cupertino', 'section', 'materialCatalog', 'cupertinoCatalog', 'list'].map(
      (key) => [key, 'same-' + key],
    ),
  );
function experiment(scale = 1) {
  return {
    runs: ['hermes', 'static-aot'].flatMap((variant) =>
      ['default', 'maximized'].flatMap((viewport) =>
        [1, 2, 3].map((run) => ({
          variant,
          viewport,
          run,
          status: 0,
          diagnostic: false,
          input: 'os',
          catalog: 'full',
          identity: {
            engine: 'hermes',
            mode: variant === 'hermes' ? 'bytecode' : 'static-aot',
            profile: 'optimized',
            configuration: 'Release',
            vmSha256: 'vm',
            compilerSha256: 'compiler',
          },
          aotCompiler: {
            toolchainSha256: 'toolchain',
            revision: 'pinned',
            compilerPolicy: 'guarded',
            compilerFlags: ['-O'],
          },
          phases: ['list-retained', 'list-cold', 'material-0-cold', 'cupertino-0-cold'].map(
            (name) => ({
              name,
              viewport: viewport === 'default' ? 300 : 500,
              requestedDelta: -10,
              requestedIntervalMs: 16,
              cpu: { p95: (run === 1 ? 100 : run === 2 ? 10 : 20) * scale },
              entryCpu: { n: 1, p95: 20 * scale },
              retainedCpu: { n: 1, p95: 20 * scale },
              itemCreateBuildFirstLayout: { n: 2, p95: 10 * scale },
              createdRows: 2,
              createdElements: 4,
              mounts: 4,
            }),
          ),
        })),
      ),
    ),
    failures: [],
  };
}
test(
  'G6 keeps each mode/window independent, uses per-run p95 medians and enforces pure item work',
  { timeout },
  () => {
    const before = experiment(),
      after = experiment(0.8),
      result = compareScrollEngine(before, after, {
        sourcesBefore: sources,
        sourcesAfter: sources,
      });
    assert(result.g6Accepted);
    assert.equal(result.conditions[0].checks[0].baseline, 20);
    assert.equal(result.engineAccepted, 'notVerified');
    after.runs.find(
      (run) => run.variant === 'static-aot' && run.viewport === 'maximized' && run.run === 2,
    ).phases[1].itemCreateBuildFirstLayout.p95 = 10;
    after.runs.find(
      (run) => run.variant === 'static-aot' && run.viewport === 'maximized' && run.run === 3,
    ).phases[1].itemCreateBuildFirstLayout.p95 = 10;
    assert.equal(
      compareScrollEngine(before, after, { sourcesBefore: sources, sourcesAfter: sources })
        .g6Accepted,
      false,
    );
  },
);
test(
  'G6 rejects mixed supply, changed sample sources and incomplete or intrusive repetitions',
  { timeout },
  () => {
    for (const change of [
      (value) => value.runs.pop(),
      (value) => (value.runs[0].diagnostic = true),
      (value) => (value.runs[0].childPolicy = 'observed-budget'),
      (value) => (value.runs[0].identity.vmSha256 = 'other'),
      (value) => value.runs[0].phases[1].createdElements--,
      (value) => value.runs[0].phases[1].viewport++,
      (value) => value.runs[0].phases[1].requestedDelta--,
      (value) => (value.runs[0].phases[1].requestedIntervalMs = 4),
    ]) {
      const after = experiment(0.7);
      change(after);
      assert.throws(() =>
        compareScrollEngine(experiment(), after, { sourcesBefore: sources, sourcesAfter: sources }),
      );
    }
    assert.throws(() =>
      compareScrollEngine(experiment(), experiment(0.7), {
        sourcesBefore: sources,
        sourcesAfter: { ...sources, list: 'converted' },
      }),
    );
    const after = experiment(0.7);
    for (const run of after.runs) run.phases[2].entryCpu.p95 = 22.1;
    assert(
      !compareScrollEngine(experiment(), after, { sourcesBefore: sources, sourcesAfter: sources })
        .g6Accepted,
    );
  },
);
test(
  'only actual successful qualification records enter comparison and failures stay visible',
  { timeout },
  () => {
    const run = experiment().runs[0],
      qualification = {
        variant: run.variant,
        run: run.run,
        viewport: run.viewport,
        diagnostic: false,
      };
    const line = (name, value) => name + ' ' + JSON.stringify(value),
      text =
        line('SCROLL_RUN', run) +
        '\n' +
        line('SCROLL_QUALIFIED', qualification) +
        '\n' +
        line('SCROLL_ABORT', { error: 'earlier AV' });
    const value = qualifiedScrollRuns([text]);
    assert.equal(value.runs.length, 1);
    assert.equal(value.failures.length, 1);
    assert.equal(qualifiedScrollRuns([line('SCROLL_RUN', run)]).runs.length, 0);
    assert.throws(() =>
      qualifiedScrollRuns([text + '\n' + line('SCROLL_QUALIFIED', qualification)]),
    );
    assert.equal(
      qualifiedScrollRuns([
        text +
          '\n' +
          line('SCROLL_FAILURE', { variant: 'hermes', viewport: 'default', fatal: ['AV'] }),
      ]).failures.length,
      1,
      'Abort summary does not count the same native failure twice',
    );
  },
);
