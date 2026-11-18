// SPDX-License-Identifier: BSD-3-Clause
import assert from 'node:assert/strict';
import { FrameworkRoot } from '@nelyx/core/framework/widgets/root';
import { flattenSemantics } from '@nelyx/core/framework/semantics/semantics';
import { PageView } from '@nelyx/core/framework/widgets/page-view';
import { RenderObjectElement } from '@nelyx/core/framework/widgets/framework';
import { FoundationPlatform } from '@nelyx/core/foundation/platform';
import { FlutterError } from '@nelyx/core/foundation/flutter-error';
import { ResourceRegistry } from '@nelyx/core/hosting/resources';
import { releaseSceneFrameSource } from '@nelyx/core/ui/frame';
import { freezeTextInput } from '@nelyx/core/ui/text';
import { MaterialApp } from '@nelyx/material/app';
import { Material } from '@nelyx/material/material';
import { ThemeData } from '@nelyx/material/theme-data';
import { CalendarDatePicker, DateTime } from '@nelyx/material/date-picker';

const metrics = {
  logicalWidth: 360,
  logicalHeight: 400,
  physicalWidth: 360,
  physicalHeight: 400,
  scale: 1,
  viewportGeneration: 1,
  rendererGeneration: 1,
  nativeSurfaceGeneration: null,
  nativeContextGeneration: null,
};
function tree(root) {
  const all = [],
    stack = [root];
  while (stack.length) {
    const e = stack.pop();
    all.push(e);
    stack.push(...e.children);
  }
  return all;
}
function fixture(initialMonth) {
  const owner = { id: 'calendar-source', generation: 1 },
    resources = new ResourceRegistry(),
    months = [];
  const font = resources.allocateId('font');
  resources.register({ ...font, kind: 'font' }, () => {});
  let sequence = 0,
    time = 0,
    closed = false,
    semantics = [];
  const view = new FrameworkRoot(
    {
      owner,
      resources,
      assets: new Map(),
      defaultFont: font,
      images: { isClosed: false, addCloseListener() {} },
      platformView: {
        viewId: 1,
        platformDispatcher: {
          isViewActive: () => true,
          binaryMessenger: { send: async () => null },
        },
      },
      clock: { now: () => time },
      requestFrame() {},
      readMetrics: () => metrics,
      readStatus: () => (closed ? 'closed' : 'open'),
      reportError(e) {
        throw e;
      },
      text: {
        layout(raw) {
          const input = freezeTextInput(raw),
            resource = resources.allocateId('paragraph'),
            width = Math.min(input.text.length * 7, input.maxWidth ?? Infinity);
          resources.register({ ...resource, kind: 'paragraph' }, () => {});
          return {
            input,
            resource,
            indexUnit: 'utf16',
            width,
            height: 20,
            alphabeticBaseline: 15,
            ideographicBaseline: 15,
            minIntrinsicWidth: width,
            maxIntrinsicWidth: width,
            longestLine: width,
            overflow: false,
            unresolvedGlyphs: 0,
            lines: [
              {
                start: 0,
                end: input.text.length,
                baseline: 15,
                bounds: { x: 0, y: 0, width, height: 20 },
              },
            ],
          };
        },
        hit: () => ({ position: 0, affinity: 'downstream' }),
        range: () => [],
        boxes: () => [],
        glyphAt: () => null,
      },
      semantics: {
        capability: 'native-controls',
        bind(nodes) {
          semantics = nodes;
          return {
            update(nodes) {
              semantics = nodes;
            },
            dispose() {},
          };
        },
        dispose() {},
      },
    },
    {
      id: owner.id,
      createRoot: () =>
        new MaterialApp({
          locale: 'en-US',
          theme: ThemeData.light(),
          home: new Material({
            child: new CalendarDatePicker({
              initialDate: new DateTime(2025, initialMonth, 15),
              currentDate: new DateTime(2025, 1, 15),
              firstDate: new DateTime(2025, 1, 1),
              lastDate: new DateTime(2025, 3, 31),
              onDisplayedMonthChanged: (d) => months.push(d.month),
              onDateChanged: () => assert.fail('selection changed'),
            }),
          }),
        }),
    },
  );
  function frame() {
    time += 16;
    const scene = view.build({ token: { owner, sequence: ++sequence, metrics }, resources });
    try {
      assert(scene);
    } finally {
      releaseSceneFrameSource(scene);
    }
  }
  const pages = () =>
    new Map(
      tree(view.root)
        .filter((e) => e.widget.constructor.name === '_DayPicker')
        .map((e) => [e.widget.displayedMonth.month, e]),
    );
  return {
    view,
    frame,
    months,
    pages,
    semantics: () => flattenSemantics(semantics),
    position: () =>
      tree(view.root).find((e) => e.widget instanceof PageView).widget.options.controller.position,
    close() {
      closed = true;
      try {
        view.dispose();
      } finally {
        resources.dispose();
      }
    },
  };
}
export function exercise(direction, observe, publish) {
  FoundationPlatform.configure({ kind: 'native', operatingSystem: 'windows' });
  FlutterError.onError = (d) => {
    throw d.exception;
  };
  const cold = direction === 'cold',
    f = fixture(cold ? 2 : 1);
  try {
    f.frame();
    f.frame();
    const pos = f.position(),
      extent = pos.viewportDimension;
    assert.equal(extent, 360);
    const jump = (page) => pos.jumpToWithoutSettling(extent * page);
    const step = (page) => {
      jump(page);
      f.frame();
    };
    if (!cold) step(direction === 'forward' ? 0.35 : 0.65);
    const steps = cold
      ? [[1.1, 'cold']]
      : direction === 'forward'
        ? [
            [0.45, 'forward-control'],
            [0.55, 'forward-cross'],
          ]
        : [
            [0.55, 'reverse-control'],
            [0.45, 'reverse-cross'],
          ];
    for (const [at, label] of steps) {
      const before = f.pages(),
        calls = f.months.length;
      assert.deepEqual(
        [...before.keys()].sort(),
        cold ? [2] : [1, 2],
        `${label} pre-materialization`,
      );
      const capture = observe(f.view),
        began = performance.now();
      let elapsed;
      try {
        jump(at);
        f.frame();
        elapsed = performance.now() - began;
      } finally {
        capture.stop();
      }
      const after = f.pages();
      for (const [m, e] of before)
        assert.equal(after.get(m), e, `${label}: month ${m} was replaced`);
      assert.deepEqual([...after.keys()].sort(), cold ? [2, 3] : [1, 2]);
      const callbacks = f.months.slice(calls);
      assert.deepEqual(
        callbacks,
        label === 'forward-cross' ? [2] : label === 'reverse-cross' ? [1] : [],
      );
      assert.equal(pos.pixels, at * extent);
      const days = tree(after.get(cold ? 3 : 2)).filter(
        (e) => e.widget.constructor.name === '_Day',
      );
      assert.equal(days.length, cold ? 31 : 28);
      if (cold) {
        const renderDays = days.flatMap(tree).filter((e) => e instanceof RenderObjectElement);
        assert.equal(new Set(renderDays.map((e) => e.renderObject)).size, 279);
      }
      const size = days[0].renderObjects[0].size;
      assert(size.width > 0 && size.height > 0);
      const marchLabels = cold
        ? f
            .semantics()
            .filter((n) => /March/i.test(n.name))
            .map((n) => [n.name, n.role, n.enabled, n.selected])
        : undefined;
      if (cold)
        assert(
          marchLabels.length > 0,
          'first cold Scene omitted all newly exposed March semantics',
        );
      publish(label, {
        firstSceneMs: elapsed,
        ...capture.result(),
        callbacks,
        daySize: [size.width, size.height],
        marchLabels,
      });
    }
  } finally {
    f.close();
  }
}
