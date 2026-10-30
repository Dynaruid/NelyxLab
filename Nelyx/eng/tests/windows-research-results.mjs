// SPDX-License-Identifier: BSD-3-Clause
import assert from 'node:assert/strict';
import path from 'node:path';

export function fullRuntimeResult(output, { editing = true, aot = true } = {}) {
  assert.doesNotMatch(output, /ANIMATION_JS ERROR|watchdog/);
  for (const marker of [
    'font-collection PASS registration/rollover/dispose/live-builder',
    'text-reuse-budget PASS idle-owner/released-query-rejection/retained-full/reuse/new-rejection/retirement',
    'gallery-mounted material 29',
    'gallery-mounted cupertino 20',
    'gallery-native-editing PASS',
    'gallery-lifecycle PASS resizes=6',
    'gallery-regression PASS',
    ...(editing ? ['editing-resize PASS'] : []),
  ])
    assert(
      output.includes('ANIMATION_JS ' + marker),
      'Missing ' + marker + '\n' + output.slice(-12000),
    );
  assert.match(output, /closed views=0 consumers=0 gpuDrained=1 inputRetired=1/);
  if (aot) {
    const line = output.split('\n').find((value) => value.startsWith('ANIMATION_JS AOT_AUDIT '));
    assert(line, 'Missing full-runtime VM audit');
    const audit = JSON.parse(line.slice('ANIMATION_JS AOT_AUDIT '.length));
    assert(
      audit.rnwPalNative &&
        audit.internalJavaScriptNative &&
        audit.nativeStarted &&
        !audit.sourcePreparations &&
        !audit.sourceExecutions &&
        !audit.bytecodeExecutions &&
        !audit.blockedFallbacks &&
        !audit.jitEnabled &&
        !audit.evalEnabled,
    );
  }
}

/** One acceptance contract for direct fixtures and the interleaved comparison. */
export function researchResult(
  output,
  { engine, hermesMode, viewport, run, sourceSha256, bindings = [] },
) {
  const failure = output.search(/ANIMATION_JS ERROR|watchdog/);
  if (failure >= 0)
    throw Error(
      'Native research failure:\n' +
        output.slice(Math.max(0, failure - 100), failure + 6500) +
        '\nNative termination:\n' +
        output.slice(-1200),
    );
  assert.match(output, /closed views=0 consumers=0 gpuDrained=1 inputRetired=1/);
  assert.match(
    output,
    /ANIMATION_JS font-collection PASS registration\/rollover\/dispose\/live-builder/,
  );
  assert.match(
    output,
    /ANIMATION_JS text-reuse-budget PASS idle-owner\/released-query-rejection\/retained-full\/reuse\/new-rejection\/retirement/,
  );
  assert.match(output, /ANIMATION_JS research-engine PASS/);
  assert.match(output, /ANIMATION_JS list-clip-pixels PASS/);
  assert.match(output, /first-content-ready displayed=unobserved visibleBefore=0/);
  assert.match(output, /ANIMATION_DRAG entered=1 exited=1 sizing=[1-9]\d*/);
  if (hermesMode !== 'bytecode') assert.match(output, /ANIMATION_JS AOT_NATIVE initialized=true/);
  const field = (prefix) => {
    const line = output.split('\n').find((line) => line.startsWith(prefix));
    assert(line, 'Missing ' + prefix);
    return JSON.parse(line.slice(prefix.length));
  };
  const typedCalls = hermesMode === 'static-aot' ? field('ANIMATION_JS TYPED_EXECUTION ') : null;
  if (hermesMode === 'static-aot') {
    const audit = field('ANIMATION_JS AOT_AUDIT ');
    assert(
      audit.rnwPalNative &&
        audit.internalJavaScriptNative &&
        audit.nativeStarted &&
        !audit.sourcePreparations &&
        !audit.sourceExecutions &&
        !audit.bytecodeExecutions &&
        !audit.blockedFallbacks &&
        !audit.jitEnabled &&
        !audit.evalEnabled,
    );
  }
  for (const binding of bindings)
    assert(
      Number.isSafeInteger(typedCalls?.[binding.globalName]) && typedCalls[binding.globalName] >= 0,
      'Missing selected body counter: ' + binding.id,
    );
  if (bindings.length)
    assert(
      bindings.some((binding) => typedCalls[binding.globalName] > 0),
      'No specialized product body executed',
    );
  const samples = output
    .split('\n')
    .filter((line) => line.startsWith('ANIMATION_JS {"phase"'))
    .map((line) => JSON.parse(line.slice('ANIMATION_JS '.length)));
  assert.deepEqual(
    samples.map((sample) => sample.phase),
    [
      'list-cold',
      'list-warm',
      'list-entry-cold',
      'list-entry-revisit',
      'list-resize',
      'route-typed',
    ],
  );
  for (const sample of samples) {
    const cpu = sample['Frame.cpu'];
    assert.equal(sample.engine, engine);
    assert(
      cpu?.n > 0 &&
        ['p50', 'p95', 'max'].every((key) => Number.isFinite(cpu[key]) && cpu[key] >= 0),
      'Missing research CPU distribution: ' + sample.phase,
    );
    assert(cpu.max >= cpu.p95 && cpu.p95 >= cpu.p50);
  }
  const input = field('ANIMATION_JS latest-input-to-surface '),
    resize = field('ANIMATION_JS resize-request-to-surface ');
  for (const value of [input, resize]) {
    assert(
      value.n > 0 &&
        Number.isFinite(value.p95) &&
        value.p95 >= 0 &&
        Number.isFinite(value.p99) &&
        value.p99 >= value.p95 &&
        value.max >= value.p99,
    );
    assert.equal(value.displayed, 'unobserved');
  }
  const initial = field('ANIMATION_JS view-metrics '),
    selected = field('ANIMATION_JS window-selected '),
    actual = field('ANIMATION_JS list-wheel-target ').metrics;
  for (const key of ['logicalWidth', 'logicalHeight', 'physicalWidth', 'physicalHeight', 'scale'])
    assert.equal(actual[key], initial[key], 'The measured list keeps the selected viewport');
  assert.equal(selected.maximized, viewport === 'maximized');
  assert.equal(selected.clientWidth, actual.physicalWidth);
  assert.equal(selected.clientHeight, actual.physicalHeight);
  if (viewport === 'fixed') {
    assert(Math.abs(actual.logicalWidth - 800) * actual.scale <= 0.5);
    assert(Math.abs(actual.logicalHeight - 600) * actual.scale <= 0.5);
  }
  const memory = field('ANIMATION_MEMORY ');
  assert(memory.peakWorkingSetBytes > 0);
  const milestones = output
    .split('\n')
    .filter((line) => line.startsWith('ANIMATION_STARTUP '))
    .map((line) => JSON.parse(line.slice('ANIMATION_STARTUP '.length)));
  const milestone = (name) => {
    const selected = milestones.filter((value) => value.stage === name);
    assert.equal(selected.length, 1, 'Missing startup stage ' + name);
    return selected[0];
  };
  const surface = milestone('first-surface-updated'),
    shown = milestone('first-shown'),
    startup = {
      processToSurfaceMs: surface.processElapsedMs,
      processToShownMs: shown.processElapsedMs,
      entryToSurfaceMs: surface.elapsedMs,
      firstShownSurfaceFrames: shown.surfaceFrames,
      origin: 'OS process creation; native elapsed uses monotonic clock',
      displayed: 'unobserved',
    };
  assert(
    startup.processToSurfaceMs > 0 &&
      startup.processToSurfaceMs >= startup.entryToSurfaceMs &&
      startup.processToShownMs >= startup.processToSurfaceMs &&
      startup.firstShownSurfaceFrames >= 1,
  );
  return {
    engine,
    hermesMode,
    viewport,
    run,
    sourceSha256,
    phases: samples.map((sample) => ({
      phase: sample.phase,
      cpu: sample['Frame.cpu'],
      lifecycle: sample.lifecycle,
      textCache: sample.textCache,
      hermesDelta: sample.hermesDelta,
      hermesMemoryBefore: sample.hermesMemoryBefore,
      hermesMemoryAfter: sample.hermesMemoryAfter,
    })),
    input,
    resize,
    memory,
    startup,
    typedCalls,
    metrics: actual,
  };
}
export function researchFailures({ directory, bundle, run }) {
  const executable = path.join(directory, 'out/InputSurface.exe'),
    cwd = path.join(directory, 'out');
  const failure = run(executable, [bundle, 'failed-close'], {
    cwd,
    nativeDiagnostics: true,
    expectedStatus: 2,
  });
  assert.match(failure, /resize presentation failure probe/);
  assert.match(failure, /terminating exitCode=2 gpuDrained=0 ownersRetainedUntilProcessExit=1/);
  assert.doesNotMatch(failure, /closed views=0|watchdog/);
  const bad = run(executable, [path.join(directory, 'missing-bundle')], {
    cwd,
    nativeDiagnostics: true,
    expectedStatus: 2,
  });
  assert.match(
    bad,
    /Local startup bundle unavailable|instance-load-failed|First content startup deadline exceeded/,
  );
  assert.match(bad, /terminating exitCode=2/);
  assert.doesNotMatch(bad, /first-content-ready|closed views=0|watchdog/);
  const cancelled = run(executable, [bundle, 'startup-close'], { cwd, nativeDiagnostics: true });
  assert.match(cancelled, /startup-cancelled nativeOwnersRetainedUntilProcessExit=1/);
  assert.doesNotMatch(cancelled, /first-content-ready|closed views=0|watchdog/);
}
