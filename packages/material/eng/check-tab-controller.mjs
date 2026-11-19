// SPDX-License-Identifier: BSD-3-Clause
import assert from 'node:assert/strict';
import { execute } from '../../../Nelyx/sdk/tooling/cli/src/commands.mjs';
import { Curves } from '@nelyx/core/framework/animation/curves';
import { Ticker } from '@nelyx/core/framework/animation/ticker';
import { FrameScheduler } from '@nelyx/core/framework/scheduler/scheduler';
import { TabController } from '@nelyx/material/tab-controller';
import { TabController as WidgetsTabController } from '@nelyx/material/widgets';

if (!process.argv.includes('--child')) {
  await execute(process.execPath, [import.meta.filename, '--child'], { timeout: 1_200_000 });
  process.exit(0);
}

let now = 0;
const scheduler = new FrameScheduler({ now: () => now }, () => {});
const vsync = { createTicker: (tick) => new Ticker(scheduler, tick) };
const pump = async (time) => {
  now = time;
  scheduler.handleBeginFrame(time);
  scheduler.handleDrawFrame();
  await Promise.resolve();
};

assert.equal(TabController, WidgetsTabController);
const controller = new TabController({ length: 3, vsync });
try {
  const notifications = [];
  controller.addListener(() => {
    notifications.push([controller.index, controller.previousIndex, controller.indexIsChanging]);
  });
  const animation = controller.animation;
  controller.offset = 0.25;
  assert.equal(animation.value, 0.25);
  assert.deepEqual(notifications, []);

  controller.animateTo(2, { duration: 100, curve: Curves.linear });
  assert.deepEqual(notifications, [[2, 0, true]]);
  assert.throws(() => {
    controller.offset = 0;
  }, /selection animation/);
  await pump(0);
  await pump(40);
  assert.ok(animation.value > 0.25 && animation.value < 2);

  controller.animateTo(1, { duration: 100, curve: Curves.linear });
  await pump(41);
  await pump(150);
  assert.equal(animation.value, 1);
  assert.equal(controller.offset, 0);
  assert.equal(controller.indexIsChanging, false);
  assert.deepEqual(notifications.at(-1), [1, 2, false]);

  controller.index = 0;
  assert.deepEqual(notifications.at(-1), [0, 1, false]);
  assert.equal(animation.value, 0);
  assert.throws(() => {
    controller.index = -1;
  }, /outside the controller length/);
} finally {
  controller.dispose();
  scheduler.dispose();
}
assert.equal(controller.animation, null);
assert.equal(scheduler.transientCallbackCount, 0);
console.log('Material tab controller passed: selection, offset, interruption and ticker disposal');
