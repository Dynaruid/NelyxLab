// SPDX-License-Identifier: BSD-3-Clause
import assert from 'node:assert/strict';
import { execute } from '../sdk/tooling/cli/src/commands.mjs';
import { GestureBinding, SamplingClock } from '../dist/framework/gestures/binding.js';
import { PointerDownEvent } from '../dist/framework/gestures/events.js';
import { HitTestEntry } from '../dist/framework/gestures/hit-test.js';
import { VerticalDragGestureRecognizer } from '../dist/framework/gestures/monodrag.js';
import { pointerEventFromTransport } from '../dist/framework/gestures/pointer-event-adapter.js';

if (!process.argv.includes('--child')) {
  await execute(process.execPath, [import.meta.filename, '--child'], { timeout: 1_200_000 });
  process.exit(0);
}

function drag(samples, releaseDelay) {
  let now = 0;
  const binding = new GestureBinding({
    devicePixelRatioForView: () => 1,
    clock: new SamplingClock(
      () => now,
      () => now,
    ),
    hitTestInView: (result) => result.add(new HitTestEntry(target)),
  });
  const recognizer = new VerticalDragGestureRecognizer({ binding });
  const target = {
    handleEvent(event) {
      if (event instanceof PointerDownEvent) recognizer.addPointer(event);
    },
  };
  const updates = [];
  let velocity;
  recognizer.onUpdate = (details) => updates.push(details.primaryDelta);
  recognizer.onEnd = (details) => (velocity = details.primaryVelocity);
  const send = (kind, timestamp, delivered, y, deltaY, coalescedSamples) => {
    now = delivered;
    binding.enqueuePointerEvent(
      pointerEventFromTransport({
        kind,
        timestamp,
        pointer: 1,
        device: 'touch',
        buttons: kind === 'up' ? 0 : 1,
        x: 0,
        y,
        deltaY,
        coalescedSamples,
        viewportGeneration: 1,
      }),
    );
  };
  try {
    send('down', 0, 0, 0, 0);
    send('move', 16, 20, 32, 32);
    send('move', 80, 125, 160, 128, samples);
    send('up', 85 + releaseDelay, 128 + releaseDelay, 160, 0);
    return { updates, velocity };
  } finally {
    recognizer.dispose();
    binding.dispose();
  }
}

const samples = [32, 48, 64, 80].map((timestamp) => ({ x: 0, y: timestamp * 2, timestamp }));
const ordinary = drag(undefined, 0);
const continuous = drag(samples, 0);
assert.equal(ordinary.velocity, 0);
assert.ok(Math.abs(continuous.velocity - 2000) < 1);
assert.ok(ordinary.updates.length > 0);
assert.deepEqual(continuous.updates, ordinary.updates);
assert.equal(drag(samples, 50).velocity, 0);
console.log('Coalesced touch points preserved fling velocity and one update per delivered move.');
