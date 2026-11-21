// SPDX-License-Identifier: BSD-3-Clause
import assert from 'node:assert/strict';
import { execute } from '../sdk/tooling/cli/src/commands.mjs';
import { ValueKey } from '../dist/foundation/key.js';
import { FoundationPlatform } from '../dist/foundation/platform.js';
import { AppSession } from '../dist/hosting/runtime.js';
import { FrameDiagnostics } from '../dist/ui/frame-diagnostics.js';
import { SectionExtentIndex } from '../dist/framework/rendering/section-extent-index.js';
import { Directionality, MediaQuery } from '../dist/framework/widgets/app-data.js';
import { AspectRatio, SizedBox } from '../dist/framework/widgets/basic.js';
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
  // New requests belong to the next host callback, even if the queue is live.
  const batch = [...queue];
  for (const callback of batch) if (queue.delete(callback)) callback(value);
};
let now = 0;
const frame = () => {
  now += 16;
  dispatch(frames, { tick: now, dispatch: now, queueDelay: 0, clockUncertainty: 0 });
};
const controller = new ScrollController();
let extentIndex = new SectionExtentIndex(20, { estimatedExtent: 100 });
const builds = new Map();
const mounts = new Map();
const retirements = new Map();
const rows = new Map();
const count = (counts, index) => counts.set(index, (counts.get(index) ?? 0) + 1);
class Row extends StatefulWidget {
  constructor(index) {
    super(new ValueKey(index));
    this.index = index;
  }
  createState() {
    return new RowState();
  }
}
class RowState extends State {
  height;
  initState() {
    const index = this.widget.index;
    this.height = index === 2 ? 143 : 100;
    rows.set(index, this);
    count(mounts, this.widget.index);
  }
  build(context) {
    return this.widget.index === 10
      ? new AspectRatio(undefined, 300 / 160)
      : new SizedBox(undefined, MediaQuery.textScalerOf(context).scale(this.height));
  }
  resize(height) {
    this.setState(() => {
      this.height = height;
    });
  }
  dispose() {
    rows.delete(this.widget.index);
    count(retirements, this.widget.index);
    super.dispose();
  }
}
let catalog;
class Catalog extends StatefulWidget {
  createState() {
    return new CatalogState();
  }
}
class CatalogState extends State {
  ids = Array.from({ length: 20 }, (_, index) => index);
  textScale = 1;
  initState() {
    catalog = this;
  }
  build() {
    const ids = this.ids;
    return new MediaQuery(
      {
        width: 300,
        height: 150,
        scale: 1,
        textScale: this.textScale,
        safeArea: { left: 0, top: 0, right: 0, bottom: 0 },
        keyboardInset: 0,
      },
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
            prepare: (index) => ids[index] === 2 || ids[index] === 5,
          },
          itemCount: ids.length,
          findChildIndexCallback: (key) => {
            const index = ids.indexOf(key.value);
            return index < 0 ? null : index;
          },
          itemBuilder: (_, index) => {
            const id = ids[index];
            count(builds, id);
            return new Row(id);
          },
        }),
      ),
    );
  }
}
let root;
const session = new AppSession(
  {
    id: 'section-idle',
    createView(context) {
      root = new FrameworkRoot(context, {
        id: 'section-idle',
        createRoot: () => new Catalog(),
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
  const diagnostics = new FrameDiagnostics({ now: () => now });
  view.frameDiagnostics = diagnostics;
  frame();
  const first = diagnostics.drain().samples.filter((sample) => sample.section === 0);
  assert.deepEqual(
    first.map((sample) => sample.stage),
    ['section-create', 'section-layout'],
  );
  assert.equal(idle.size, 1, 'A fresh offer can use the browser idle period after submission');
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
  diagnostics.drain();
  frame();
  const adopted = diagnostics.drain().samples.filter((sample) => sample.section === 2);
  assert.deepEqual(
    adopted.map((sample) => sample.stage),
    ['section-adopt', 'section-layout'],
  );
  assert.equal(adopted[0].frame, adopted[1].frame);
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

  controller.jumpTo(900);
  frame();
  extentIndex.requestItem(10);
  frame();
  assert.equal(extentIndex.anchor.index, 10);
  assert.equal(mounts.has(11), false);
  rows.get(9).resize(40);
  frame();
  assert.equal(extentIndex.anchor.index, 10, 'Leading measurement preserves the visible anchor');
  assert.equal(extentIndex.anchor.offset, 0);
  assert.equal(
    mounts.has(11),
    false,
    'Measuring a shrunken leading row must avoid creation at the uncorrected viewport end',
  );
  const metrics = view.capture().metrics;
  view.updateMetrics({
    ...metrics,
    viewportGeneration: metrics.viewportGeneration + 1,
    logicalWidth: 150,
    physicalWidth: 150,
  });
  frame();
  assert.equal(extentIndex.anchor.index, 10);
  assert.equal(extentIndex.prefix(11) - extentIndex.prefix(10), 80);
  assert.equal(mounts.get(11), 1, 'Narrower layout must fill the resulting exposed viewport');

  catalog.setState(() => {
    catalog.textScale = 1.25;
  });
  frame();
  assert.equal(extentIndex.anchor.index, 10);
  assert.equal(extentIndex.prefix(10) - extentIndex.prefix(9), 50);

  const visible = rows.get(10);
  catalog.setState(() => {
    const ids = catalog.ids.filter((id) => id !== 9);
    const anchor = ids.indexOf(10) - 1;
    [ids[anchor], ids[anchor + 1]] = [ids[anchor + 1], ids[anchor]];
    catalog.ids = ids;
    extentIndex = new SectionExtentIndex(ids.length, { estimatedExtent: 100 });
    extentIndex.requestItem(anchor);
  });
  frame();
  assert.equal(rows.get(10), visible, 'The moved key preserves its mounted State');
  assert.equal(extentIndex.anchor.index, catalog.ids.indexOf(10));
  assert.equal(extentIndex.anchor.offset, 0);
} finally {
  await session.dispose();
  controller.dispose();
}
assert.equal(retirements.get(2), 1);
assert.equal(frames.size + idle.size, 0);
console.log('Indexed sections prepare in idle time and adopt once through normal viewport layout.');
