// SPDX-License-Identifier: BSD-3-Clause
import assert from 'node:assert/strict';
import { execute } from '../sdk/tooling/cli/src/commands.mjs';
import { FoundationPlatform } from '../dist/foundation/platform.js';
import { AppSession } from '../dist/hosting/runtime.js';
import { SectionExtentIndex } from '../dist/framework/rendering/section-extent-index.js';
import { Directionality } from '../dist/framework/widgets/app-data.js';
import { SizedBox } from '../dist/framework/widgets/basic.js';
import { State, StatefulWidget } from '../dist/framework/widgets/framework.js';
import { FrameworkRoot } from '../dist/framework/widgets/root.js';
import { ScrollController } from '../dist/framework/widgets/scroll-controller.js';
import { ListView } from '../dist/framework/widgets/scroll-view.js';

if (!process.argv.includes('--child')) {
  await execute(process.execPath, [import.meta.filename, '--child'], { timeout: 1_200_000 });
  process.exit(0);
}

FoundationPlatform.configure({ kind: 'native', operatingSystem: 'android' });
const frames = new Set();
const idle = new Set();
const register = (queue, callback) => {
  queue.add(callback);
  return { dispose: () => queue.delete(callback) };
};
const dispatch = (queue, value) => {
  for (const callback of [...queue]) if (queue.delete(callback)) callback(value);
};
let now = 0;
const frame = () => {
  now += 16;
  dispatch(frames, { tick: now, dispatch: now, queueDelay: 0, clockUncertainty: 0 });
};
const controller = new ScrollController();
const extentIndex = new SectionExtentIndex(20, { estimatedExtent: 100 });
const builds = new Map();
const mounts = new Map();
const retirements = new Map();
const count = (counts, index) => counts.set(index, (counts.get(index) ?? 0) + 1);
class Row extends StatefulWidget {
  constructor(index) {
    super();
    this.index = index;
  }
  createState() {
    return new RowState();
  }
}
class RowState extends State {
  initState() {
    count(mounts, this.widget.index);
  }
  build() {
    return new SizedBox(undefined, this.widget.index === 2 ? 143 : 100);
  }
  dispose() {
    count(retirements, this.widget.index);
    super.dispose();
  }
}
let root;
const session = new AppSession(
  {
    id: 'section-idle',
    createView(context) {
      root = new FrameworkRoot(context, {
        id: 'section-idle',
        createRoot: () =>
          new Directionality(
            'ltr',
            ListView.builder({
              controller,
              primary: false,
              cacheExtent: 200,
              extentIndex,
              childPolicy: {
                mode: 'dormant',
                capacity: 4,
                prepare: (index) => index === 2 || index === 5,
              },
              itemCount: extentIndex.count,
              itemBuilder: (_, index) => {
                count(builds, index);
                return new Row(index);
              },
            }),
          ),
      });
      return root;
    },
  },
  {
    request: (callback) => register(frames, callback),
    requestIdle: (callback) => register(idle, callback),
  },
);
let font;
try {
  font = session.resources.allocateId('font');
  session.resources.register({ ...font, kind: 'font' }, () => {});
  const view = session.attach({
    id: 'section-idle',
    generation: 1,
    ownership: 'borrowed',
    renderer: {
      capabilities: { admission: 'bounded', notifications: 'unavailable' },
      canBuildFrame: () => true,
      updateMetrics() {},
      submit(frame, lease) {
        lease.transfer();
        lease.returnBy('renderer');
        return { status: 'accepted', submission: frame.token.sequence };
      },
      dispose() {},
    },
    metrics: {
      logicalWidth: 300,
      logicalHeight: 150,
      physicalWidth: 300,
      physicalHeight: 150,
      scale: 1,
      viewportGeneration: 1,
      rendererGeneration: 1,
      nativeContextGeneration: null,
      nativeSurfaceGeneration: null,
    },
    services: {
      clock: { now: () => now },
      assets: new Map(),
      defaultFont: font,
      text: {},
      semantics: { capability: 'unavailable' },
    },
    onError(error) {
      throw error;
    },
  });
  view.requestFrame();
  frame();
  frame();
  assert.equal(builds.has(2), false, 'An animation callback does not consume the idle work');
  assert.equal(idle.size, 1);
  dispatch(idle, () => 0);
  assert.equal(builds.has(2), false, 'An exhausted idle budget does not create a row');

  frame();
  view.requestFrame();
  dispatch(idle, () => 10);
  assert.equal(builds.has(2), false, 'Required work takes precedence over optional preparation');
  frame();
  assert.equal(idle.size, 1);
  dispatch(idle, () => 10);
  assert.equal(mounts.get(2), 1);
  assert.equal(extentIndex.measurement(2), 'unmeasured');
  assert.equal(root.buildOwner.preparationStats.published, 0);

  controller.jumpTo(200);
  frame();
  assert.equal(builds.get(2), 1, 'Adoption uses the original produced widget');
  assert.equal(extentIndex.measurement(2), 'measured');
  assert.equal(root.buildOwner.preparationStats.preparedColdChildren, 1);
  assert.equal(root.buildOwner.preparationStats.published, 1);

  controller.jumpTo(0);
  frame();
  frame();
  assert.equal(idle.size, 0, 'A retained slot is reused without speculative mounting');
  controller.jumpTo(200);
  frame();
  assert.equal(mounts.get(2), 1, 'Reverse scroll preserves the adopted state');

  controller.jumpTo(343);
  frame();
  frame();
  assert.equal(idle.size, 1);
  view.setVisible(false);
  assert.equal(idle.size, 0, 'A hidden view cancels its pending idle callback');
  view.setVisible(true);
  controller.jumpTo(344);
  frame();
  frame();
  assert.equal(idle.size, 1);
} finally {
  await session.dispose();
  controller.dispose();
}
assert.equal(retirements.get(2), 1);
assert.equal(frames.size + idle.size, 0);
console.log('Indexed sections prepare in idle time and adopt once through normal viewport layout.');
