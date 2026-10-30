// SPDX-License-Identifier: BSD-3-Clause
import test from 'node:test';
import assert from 'node:assert/strict';
import { FrameDiagnostics } from '@nelyx/core/ui/frame';
import { fixture } from '../../../packages/material/tests/root-fixture.mjs';
import { RepaintBoundary } from '@nelyx/core/framework/widgets/repaint-boundary';
import { SizedBox } from '@nelyx/core/framework/widgets/basic';
const timeout = 1_200_000;
const token = {
  owner: { id: 'diagnostic-view', generation: 2 },
  sequence: 3,
  inputSequence: 4,
  metrics: {
    viewportGeneration: 5,
    rendererGeneration: 6,
    nativeContextGeneration: 7,
    nativeSurfaceGeneration: 8,
  },
};

test(
  'bounded CPU trace reports overwritten samples and keeps only scalar identity',
  { timeout },
  () => {
    let time = 10;
    const trace = new FrameDiagnostics({ now: () => ++time }, 2);
    trace.record(token, 'paint', 10, 9);
    trace.record(token, 'capture', 11, 10, 1024);
    trace.record({ ...token, sequence: 4 }, 'submit', 12);
    const result = trace.drain();
    assert.equal(result.overwritten, 1);
    assert.equal(result.invalid, 0);
    assert.deepEqual(
      result.samples.map((sample) => [sample.frame, sample.stage]),
      [
        [3, 'capture'],
        [4, 'submit'],
      ],
    );
    assert.deepEqual(result.samples[0], {
      view: 'diagnostic-view',
      owner: 2,
      viewport: 5,
      renderer: 6,
      context: 7,
      surface: 8,
      frame: 3,
      input: 4,
      stage: 'capture',
      begin: 11,
      end: 12,
      duration: 1,
      count: 10,
      bytes: 1024,
    });
    assert(
      result.samples.every((sample) =>
        Object.values(sample).every(
          (value) => typeof value === 'number' || typeof value === 'string',
        ),
      ),
    );
    assert.deepEqual(trace.drain(), { samples: [], overwritten: 0, invalid: 0 });
  },
);

test('bad diagnostic clocks are reported without interrupting drawing', { timeout }, () => {
  let time = NaN;
  const trace = new FrameDiagnostics({ now: () => time });
  trace.record(token, 'paint', 1);
  time = 0;
  trace.record(token, 'paint', 1);
  const broken = new FrameDiagnostics({
    now() {
      throw Error('clock failed');
    },
  });
  assert.doesNotThrow(() => broken.record(token, 'paint', 1));
  assert.equal(broken.drain().invalid, 1);
  assert.equal(trace.drain().invalid, 2);
  assert.throws(() => new FrameDiagnostics({ now: () => 0 }, 0), /capacity/);
  assert.throws(() => new FrameDiagnostics({ now: () => 0 }, 16385), /capacity/);
});

test(
  'source stage sampling preserves repeated frame commands and observes retained boundary reuse',
  { timeout },
  () => {
    const f = fixture();
    let time = 0;
    const trace = new FrameDiagnostics({ now: () => ++time });
    try {
      f.set(new RepaintBoundary(new SizedBox(10, 10)));
      const first = f.frame({ frameDiagnostics: trace });
      const samples = trace.drain().samples;
      for (const stage of [
        'animation',
        'build',
        'layout',
        'paint',
        'compose',
        'input-geometry',
        'post-frame',
        'capture',
        'geometry-publish',
      ])
        assert(
          samples.some((sample) => sample.stage === stage),
          'Missing ' + stage,
        );
      assert(samples.some((sample) => sample.stage === 'boundary-reuses' && sample.count > 0));
      assert.equal(samples.find((sample) => sample.stage === 'boundary-recordings').count, 0);
      assert(
        samples.every(
          (sample) => sample.frame === samples[0].frame && sample.view === 'w12-structure-root',
        ),
      );
      const second = f.frame({ frameDiagnostics: trace });
      assert.deepEqual(second, first, 'A diagnostic cannot consume or suppress a requested frame');
      assert(
        trace
          .drain()
          .samples.some((sample) => sample.stage === 'capture' && sample.count === second.length),
      );
      f.frame();
      assert.deepEqual(trace.drain().samples, [], 'Ordinary frames never use the diagnostic clock');
      assert.deepEqual(
        f.frame({
          frameDiagnostics: new FrameDiagnostics({
            now() {
              throw Error('clock');
            },
          }),
        }),
        second,
      );
    } finally {
      f.close();
    }
  },
);
