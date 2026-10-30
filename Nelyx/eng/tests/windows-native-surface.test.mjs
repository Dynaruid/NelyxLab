// SPDX-License-Identifier: BSD-3-Clause
import test from 'node:test';
import assert from 'node:assert/strict';
import { createWindowsNativeSurfaceProps } from '../../sdk/dist/platforms/windows/native-surface.js';
const timeout = 1_200_000;

test(
  'full-window surfaces explicitly require native viewport ownership while embedded surfaces keep Fabric layout',
  { timeout },
  () => {
    const ready = [],
      errors = [];
    const binding = {
      ready: (value) => ready.push(value),
      visibility() {},
      failed: (error) => errors.push(error),
    };
    assert.equal(createWindowsNativeSurfaceProps(binding, () => {}).windowViewport, false);
    const props = createWindowsNativeSurfaceProps(
      binding,
      () => {},
      () => false,
      true,
    );
    assert.equal(props.windowViewport, true);
    props.onWindowsSurfaceStatus({ nativeEvent: status({ windowViewport: true }) });
    assert.equal(ready.length, 1);
    assert.equal(errors.length, 0);
    props.onWindowsSurfaceStatus({
      nativeEvent: status({ windowViewport: false, surfaceGeneration: 6 }),
    });
    assert.equal(ready.length, 1);
    assert.match(errors[0].message, /viewport ownership/);
  },
);

test(
  'native closing suspends late surface receipts before active admission without hiding native failures',
  { timeout },
  () => {
    let closing = false,
      verified = 0;
    const ready = [],
      visibility = [],
      errors = [];
    const props = createWindowsNativeSurfaceProps(
      {
        ready: (value) => ready.push(value),
        visibility: (value) => visibility.push(value),
        failed: (error) => errors.push(error),
      },
      () => {
        verified++;
        if (closing) throw Error('Active admission is closed');
      },
      () => closing,
    );
    const send = (changes) => props.onWindowsSurfaceStatus({ nativeEvent: status(changes) });
    send({});
    assert.equal(verified, 1);
    assert.equal(ready.length, 1);
    closing = true;
    send({ phase: 'visibility', visible: false });
    send({ phase: 'unbound', bound: false });
    send({ phase: 'closed', bound: false });
    assert.equal(verified, 1);
    assert.equal(ready.length, 1);
    assert.deepEqual(visibility.slice(-3), [false, false, false]);
    assert.equal(errors.length, 0);
    send({ phase: 'failed', reason: 'actual native failure' });
    assert.equal(errors.length, 1);
    assert.match(errors[0].message, /actual native failure/);
  },
);
test(
  'hidden startup admits preparation and only an exact current frame opens first content readiness',
  { timeout },
  () => {
    const visibility = [],
      metrics = [];
    let content = 0;
    const props = createWindowsNativeSurfaceProps(
      {
        ready: (value) => metrics.push(value),
        visibility: (value, preparing) => visibility.push([value, preparing]),
        firstContentReady: () => content++,
        failed: (error) => {
          throw error;
        },
      },
      () => {},
    );
    const send = (changes) => props.onWindowsSurfaceStatus({ nativeEvent: status(changes) });
    send({ visible: false, preparing: true });
    assert.deepEqual(visibility, [[false, true]]);
    assert.equal(metrics.length, 1);
    send({ phase: 'layout', surfaceGeneration: 6 });
    send({ phase: 'layout', surfaceGeneration: 7 });
    send({ phase: 'frame', surfaceGeneration: 5, frames: 1 });
    send({ phase: 'frame', surfaceGeneration: 6, frames: 2 });
    assert.equal(content, 0, 'A-B-A dimensions cannot authorize an older epoch');
    send({ phase: 'frame', surfaceGeneration: 7, frames: 3 });
    assert.equal(content, 1);
    assert.equal(metrics.length, 3);
  },
);
const status = (changes = {}) => ({
  phase: 'bound',
  reason: '',
  nativeId: 29,
  reactTag: 301,
  viewGeneration: 2,
  surfaceGeneration: 5,
  logicalWidth: 240,
  logicalHeight: 120,
  width: 300,
  height: 150,
  scale: 1.25,
  bound: true,
  visible: true,
  preparing: false,
  framePipelineVersion: 2,
  pointerVersion: 1,
  keyboardVersion: 2,
  visibilityVersion: 1,
  ...changes,
});
function fixture() {
  const frames = [],
    visibility = [],
    errors = [];
  let verified = 0;
  const props = createWindowsNativeSurfaceProps(
    {
      ready: (frame) => frames.push(frame),
      visibility: (value) => visibility.push(value),
      failed: (error) => errors.push(error),
    },
    () => {
      verified++;
    },
  );
  return {
    frames,
    visibility,
    errors,
    get verified() {
      return verified;
    },
    send: (value) => props.onWindowsSurfaceStatus({ nativeEvent: status(value) }),
  };
}
test(
  'Windows admission passes the actual Fabric tag independently of the Skia id and backing generation',
  { timeout },
  () => {
    const f = fixture();
    f.send();
    assert.equal(f.errors.length, 0);
    assert.equal(f.frames[0].nativeReactTag, 301);
    assert.notEqual(f.frames[0].nativeReactTag, 29);
    assert.equal(f.frames[0].nativeViewGeneration, 2);
    assert.equal(f.frames[0].nativeSurfaceGeneration, 5);
    assert(Object.isFrozen(f.frames[0]));
    f.send({ phase: 'layout', surfaceGeneration: 6, logicalWidth: 200, width: 250 });
    assert.equal(f.frames.at(-1).nativeReactTag, 301);
    assert.equal(f.frames.at(-1).nativeSurfaceGeneration, 6);
    assert.equal(f.errors.length, 0);
    const before = f.frames.length,
      verified = f.verified;
    f.send({ phase: 'frame' });
    assert.equal(f.frames.length, before);
    assert.equal(
      f.verified,
      verified,
      'Presentation receipts cannot reopen native service admission',
    );
  },
);
test(
  'a replacement Fabric tag cannot reuse the old Core owner even when a new native object restarts its local generation counter',
  { timeout },
  () => {
    const f = fixture();
    f.send();
    f.send({ reactTag: 303, surfaceGeneration: 6 });
    assert.equal(f.errors.length, 1);
    assert.match(f.errors[0].message, /owner changed/);
    assert.equal(f.frames.length, 1);
    f.send({ reactTag: 301, surfaceGeneration: 7 });
    assert.equal(f.frames.length, 1);
    assert.equal(f.errors.length, 1);
  },
);

test(
  'a foreign Skia id cannot reuse an admitted Fabric/View cohort and DPI changes keep its stable identity',
  { timeout },
  () => {
    const foreign = fixture();
    foreign.send();
    foreign.send({ nativeId: 30, surfaceGeneration: 6 });
    assert.equal(foreign.frames.length, 1);
    assert.match(foreign.errors[0].message, /owner changed/);
    const dpi = fixture();
    dpi.send();
    dpi.send({ phase: 'layout', surfaceGeneration: 6, scale: 2, width: 480, height: 240 });
    dpi.send({ phase: 'layout', surfaceGeneration: 7, scale: 1.25, width: 300, height: 150 });
    assert.equal(dpi.errors.length, 0);
    assert.deepEqual(
      dpi.frames.map((frame) => [frame.scale, frame.nativeSurfaceGeneration, frame.nativeReactTag]),
      [
        [1.25, 5, 301],
        [2, 6, 301],
        [1.25, 7, 301],
      ],
    );
  },
);

test(
  'actual window visibility suspends the current owner without reopening its backing or retiring its native lifetime',
  { timeout },
  () => {
    const f = fixture();
    f.send();
    f.send({ phase: 'visibility', visible: false });
    f.send({ phase: 'visibility', visible: true });
    assert.deepEqual(f.visibility, [true, false, true]);
    assert.equal(
      f.frames.length,
      1,
      'Visibility preserves the admitted backing and only wakes its existing View',
    );
    assert.equal(f.errors.length, 0);
    for (const version of [undefined, 0, 2]) {
      const old = fixture();
      old.send({ visibilityVersion: version });
      assert.equal(old.frames.length, 0);
      assert.match(old.errors[0].message, /visibility port1/);
    }
    f.send({ phase: 'visibility', reactTag: 999 });
    assert.equal(
      f.errors.length,
      1,
      'A visibility receipt cannot acquire a different Fabric owner',
    );
  },
);
test(
  'malformed and regressing Windows backing receipts cannot create a native service identity',
  { timeout },
  () => {
    for (const value of [0, -1, 1.5, NaN, Infinity]) {
      const f = fixture();
      f.send({ reactTag: value });
      assert.equal(f.errors.length, 1);
      assert.equal(f.frames.length, 0);
    }
    const f = fixture();
    f.send();
    f.send({ surfaceGeneration: 4 });
    assert.equal(f.errors.length, 1);
    assert.match(f.errors[0].message, /regressed/);
    assert.equal(f.frames.length, 1);
  },
);
