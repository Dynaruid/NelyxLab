// SPDX-License-Identifier: BSD-3-Clause
import assert from 'node:assert/strict';
import { BrowserFrameClock } from '../sdk/dist/backends/browser/frame-clock.js';

let now = 0;
Object.defineProperty(globalThis, 'performance', { value: { now: () => now } });
const pulses = new Map();
let serial = 0;
const browser = {
  requestAnimationFrame(callback) {
    pulses.set(++serial, callback);
    return serial;
  },
  cancelAnimationFrame(id) {
    pulses.delete(id);
  },
};
function refresh() {
  assert.equal(pulses.size, 1);
  const [[id, callback]] = pulses;
  pulses.delete(id);
  now += 1000 / 60;
  callback(now);
}
const clock = new BrowserFrameClock(browser, (callback) => callback(), 0);
const calls = [];
function request(label, inputDriven = true) {
  return clock.request((timing) => {
    assert.ok(timing.tick <= timing.dispatch);
    calls.push(label);
  }, inputDriven);
}

const touch = request('scroll');
touch.afterInput();
touch.afterInput();
assert.deepEqual(calls, []);
await Promise.resolve();
assert.deepEqual(calls, ['scroll']);

request('image', false);
request('animation');
refresh();
assert.deepEqual(calls, ['scroll', 'image']);
refresh();
assert.deepEqual(calls, ['scroll', 'image', 'animation']);

request('move-1').afterInput();
await Promise.resolve();
request('move-2').afterInput();
await Promise.resolve();
assert.equal(calls.at(-1), 'move-1');
refresh();
assert.equal(calls.at(-1), 'move-2');

request('resize');
clock.offerResize();
clock.offerResize();
await Promise.resolve();
assert.equal(calls.at(-1), 'resize');
request('resize-then-touch').afterInput();
await Promise.resolve();
assert.equal(calls.at(-1), 'resize');
refresh();
assert.equal(calls.at(-1), 'resize-then-touch');

const cancelled = request('cancelled');
cancelled.afterInput();
cancelled.dispose();
await Promise.resolve();
assert.equal(pulses.size, 0);
assert.ok(!calls.includes('cancelled'));

request('closed').afterInput();
clock.dispose();
await Promise.resolve();
assert.equal(pulses.size, 0);
assert.ok(!calls.includes('closed'));
console.log(
  'PASS touch and resize frame coalescing, independent animation, cancellation and close',
);
