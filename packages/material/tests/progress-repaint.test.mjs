// SPDX-License-Identifier: BSD-3-Clause
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  LinearProgressIndicator,
  CircularProgressIndicator,
} from '@nelyx/material/progress-indicator';
import { Theme } from '@nelyx/material/theme';
import { ThemeData } from '@nelyx/material/theme-data';
import { Directionality } from '@nelyx/core/framework/widgets/app-data';
import { SizedBox } from '@nelyx/core/framework/widgets/basic';
import { Animation } from '@nelyx/core/framework/animation/animation';
import { AnimationController } from '@nelyx/core/framework/animation/animation-controller';
import { Ticker } from '@nelyx/core/framework/animation/ticker';
import { ValueNotifier } from '@nelyx/core/foundation/notifier';
import { Color } from '@nelyx/core/ui/color';
import { FoundationPlatform } from '@nelyx/core/foundation/platform';
import { engineFixture } from './engine-fixture.mjs';
const timeout = 1_200_000;
FoundationPlatform.configure({ kind: 'native', operatingSystem: 'windows' });
const tree = (child) =>
  new Theme(new ThemeData({ platform: 'windows' }), new Directionality('ltr', child));
function countWork(f) {
  let syncs = 0,
    layouts = 0;
  const original = f.root.root.syncRenderTree.bind(f.root.root);
  f.root.root.syncRenderTree = () => {
    syncs++;
    original();
  };
  const visit = (render) => {
    const perform = render.performLayout.bind(render);
    render.performLayout = (...args) => {
      layouts++;
      return perform(...args);
    };
    render.visitChildren(visit);
  };
  visit(f.root.pipeline.rootNode);
  return () => ({ syncs, layouts });
}

for (const Type of [LinearProgressIndicator, CircularProgressIndicator])
  test(
    Type.name + ' advances pixels without widget synchronization or layout and retires its ticker',
    { timeout },
    async () => {
      const f = await engineFixture();
      try {
        const initial = f.set(tree(new Type({ id: 'progress', semanticsLabel: 'Loading' }))),
          work = countWork(f);
        f.advance(100);
        const advanced = f.advance(400);
        assert.notDeepEqual(advanced, initial);
        assert.deepEqual(work(), { syncs: 0, layouts: 0 });
        assert.equal(f.root.nodes.find((node) => node.id === 'progress').name, 'Loading');
        assert(f.root.scheduler.transientCallbackCount > 0);
        f.set(new SizedBox());
        assert.equal(f.root.scheduler.transientCallbackCount, 0);
      } finally {
        await f.close();
      }
    },
  );

test(
  'Animated progress colors repaint, fall back on null and release old listeners after replacement',
  { timeout },
  async () => {
    const f = await engineFixture(),
      first = new ValueNotifier(new Color(0xff123456)),
      second = new ValueNotifier(new Color(0xffabcdef)),
      fallback = new Color(0xff654321),
      animation = Animation.fromValueListenable(first),
      replacement = Animation.fromValueListenable(second);
    const show = (valueColor) =>
      f.set(
        tree(
          new LinearProgressIndicator({ value: 0.5, valueColor, color: fallback, id: 'progress' }),
        ),
      );
    const hasColor = (commands, color) =>
      commands.some((command) => command.color === color || command.paint?.color === color);
    try {
      assert(hasColor(show(animation), 0xff123456));
      const work = countWork(f);
      first.value = null;
      assert(hasColor(f.frame(), 0xff654321));
      assert.deepEqual(work(), { syncs: 0, layouts: 0 });
      assert.equal(f.root.nodes.find((node) => node.id === 'progress').value, '50');
      assert(first.hasListeners);
      assert(hasColor(show(replacement), 0xffabcdef));
      assert.equal(first.hasListeners, false);
      assert(second.hasListeners);
      second.value = new Color(0xff112233);
      assert(hasColor(f.frame(), 0xff112233));
      f.set(new SizedBox());
      assert.equal(second.hasListeners, false);
    } finally {
      await f.close();
      first.dispose();
      second.dispose();
    }
  },
);

test(
  'External progress controllers remain app owned and replacement updates the active painter only',
  { timeout },
  async () => {
    const f = await engineFixture(),
      vsync = { createTicker: (callback) => new Ticker(f.root.scheduler, callback) },
      first = new AnimationController({ vsync, duration: 1800 }),
      second = new AnimationController({ vsync, duration: 1800, value: 0.6 });
    const observe = (controller) => {
        const active = new Set(),
          add = controller.addListener.bind(controller),
          remove = controller.removeListener.bind(controller);
        controller.addListener = (listener) => {
          active.add(listener);
          add(listener);
        };
        controller.removeListener = (listener) => {
          active.delete(listener);
          remove(listener);
        };
        return active;
      },
      firstListeners = observe(first),
      secondListeners = observe(second);
    const show = (controller) => f.set(tree(new LinearProgressIndicator({ controller })));
    try {
      show(first);
      const work = countWork(f);
      first.value = 0.3;
      const before = f.frame();
      assert.deepEqual(work(), { syncs: 0, layouts: 0 });
      const after = show(second);
      assert.notDeepEqual(after, before);
      assert.equal(firstListeners.size, 0);
      assert(secondListeners.size > 0);
      first.value = 0.8;
      second.value = 0.9;
      assert.notDeepEqual(f.frame(), after);
      f.set(new SizedBox());
      assert.equal(secondListeners.size, 0);
      first.value = 0.2;
      second.value = 0.2;
      assert.equal(f.root.scheduler.transientCallbackCount, 0);
    } finally {
      await f.close();
      first.dispose();
      second.dispose();
    }
  },
);
