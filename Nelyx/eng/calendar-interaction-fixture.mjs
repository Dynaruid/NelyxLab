// SPDX-License-Identifier: BSD-3-Clause
import assert from 'node:assert/strict';
import { FrameworkRoot } from '@nelyx/core/framework/widgets/root';
import { PageView } from '@nelyx/core/framework/widgets/page-view';
import { Builder, SizedBox } from '@nelyx/core/framework/widgets/basic';
import { Directionality, Localizations } from '@nelyx/core/framework/widgets/app-data';
import { FoundationPlatform } from '@nelyx/core/foundation/platform';
import { FlutterError } from '@nelyx/core/foundation/flutter-error';
import { ResourceRegistry } from '@nelyx/core/hosting/resources';
import { releaseSceneFrameSource } from '@nelyx/core/ui/frame';
import { freezeTextInput } from '@nelyx/core/ui/text';
import { Locale } from '@nelyx/core/ui/locale';
import { RRect } from '@nelyx/core/ui/rrect';
import { PlatformChannelBinding } from '../src/services/channel-binding.ts';
import { MaterialApp } from '@nelyx/material/app';
import { Material } from '@nelyx/material/material';
import { ThemeData } from '@nelyx/material/theme-data';
import { MaterialLocalizations } from '@nelyx/material/material-localizations';
import { CalendarDatePicker, DateTime, showDatePicker } from '@nelyx/material/date-picker';

FoundationPlatform.configure({ kind: 'native', operatingSystem: 'windows' });
FlutterError.onError = (d) => {
  throw d.exception;
};
const date = (month, day) => new DateTime(2025, month, day);
const options = {
  initialDate: date(1, 15),
  currentDate: date(1, 1),
  firstDate: date(1, 1),
  lastDate: date(4, 30),
  selectableDayPredicate: (d) => d.day !== 16,
};
const messenger = { send: async () => null };
function flatten(roots) {
  const result = [],
    stack = [...roots];
  while (stack.length) {
    const node = stack.pop();
    result.push(node);
    if (node.children) stack.push(...node.children);
  }
  return result;
}
function harness(home) {
  const owner = { id: 'calendar-interaction', generation: 1 },
    resources = new ResourceRegistry();
  const font = resources.allocateId('font');
  resources.register({ ...font, kind: 'font' }, () => {});
  let metrics = {
    logicalWidth: 440,
    logicalHeight: 600,
    physicalWidth: 440,
    physicalHeight: 600,
    scale: 1,
    viewportGeneration: 1,
    rendererGeneration: 1,
    nativeSurfaceGeneration: null,
    nativeContextGeneration: null,
  };
  let sequence = 0,
    time = 0,
    closed = false,
    nodes = [],
    pointerId = 0,
    transport;
  const publish = (snapshot) => {
    nodes = flatten(snapshot);
  };
  const view = new FrameworkRoot(
    {
      owner,
      resources,
      assets: new Map(),
      defaultFont: font,
      paths: {
        contains(path, point) {
          assert.equal(path.operations.length, 1);
          const { verb, values } = path.operations[0];
          assert.equal(verb, 'addRRect');
          const [l, t, r, b, x, y] = values;
          assert.deepEqual(values.slice(4), [x, y, x, y, x, y, x, y]);
          return RRect.fromLTRBXY(l, t, r, b, x, y).contains(point);
        },
      },
      images: { isClosed: false, addCloseListener() {} },
      platformView: {
        viewId: 1,
        platformDispatcher: { isViewActive: () => true, binaryMessenger: messenger },
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
        bind(snapshot, actions) {
          publish(snapshot);
          transport = actions;
          return {
            update: publish,
            dispose() {
              nodes = [];
            },
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
          supportedLocales: ['en-US', 'ar-EG'],
          theme: ThemeData.light(),
          home: new Material({ child: home }),
        }),
    },
  );
  async function pump(count = 2) {
    for (let i = 0; i < count; i++) {
      await Promise.resolve();
      time += 100;
      const frame = view.build({ token: { owner, sequence: ++sequence, metrics }, resources });
      releaseSceneFrameSource(frame);
    }
    await Promise.resolve();
  }
  const elements = () => flatten([view.root]);
  return {
    view,
    pump,
    day: (m, d) =>
      elements().find(
        (e) =>
          e.widget.constructor.name === '_Day' &&
          e.widget.day.month === m &&
          e.widget.day.day === d,
      ),
    page: () =>
      elements().find((e) => e.widget instanceof PageView).widget.options.controller.position,
    node(name) {
      const n = nodes.find((n) => (typeof name === 'string' ? n.name === name : name.test(n.name)));
      assert(
        n,
        'Missing semantics ' +
          name +
          ': ' +
          nodes
            .map((n) => n.name)
            .filter(Boolean)
            .join('|'),
      );
      return n;
    },
    tap(n) {
      const { x, y, width, height } = n.bounds;
      assert(width > 0 && height > 0);
      pointerId++;
      for (const kind of ['down', 'up'])
        view.pointer({
          kind,
          pointer: pointerId,
          x: x + width / 2,
          y: y + height / 2,
          device: 'touch',
          buttons: kind === 'up' ? 0 : 1,
          timestamp: ++time,
          viewportGeneration: metrics.viewportGeneration,
        });
    },
    activate(n) {
      assert.equal(typeof n.activate, 'function');
      transport.dispatchAction(n.id, 'activate', () => n.activate());
    },
    key(key) {
      for (const kind of ['down', 'up']) {
        const handled = view.key({
          kind,
          key,
          code: key,
          shift: false,
          control: false,
          alt: false,
          meta: false,
          repeat: false,
          timestamp: ++time,
        });
        if (kind === 'down') assert(handled, key + ' was not handled');
      }
    },
    resize(w, h) {
      metrics = {
        ...metrics,
        logicalWidth: w,
        physicalWidth: w,
        logicalHeight: h,
        physicalHeight: h,
        viewportGeneration: metrics.viewportGeneration + 1,
      };
    },
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
function identity(e) {
  assert(e?.stateObject?.mounted);
  return { element: e, state: e.stateObject, focus: e.widget.focusNode };
}
function same(actual, prior) {
  assert(
    actual === prior.element &&
      actual.stateObject === prior.state &&
      actual.widget.focusNode === prior.focus,
    'Live day lost Element, State or FocusNode',
  );
}
async function pageLifecycle() {
  const months = [],
    picked = [];
  let host,
    rtl = false;
  const calendar = new CalendarDatePicker({
    ...options,
    onDisplayedMonthChanged: (d) => months.push(d.month),
    onDateChanged: (d) => picked.push(d),
  });
  const f = harness(
    new Builder((context) => {
      host = context;
      return new Localizations(
        rtl ? 'ar-EG' : 'en-US',
        {},
        'en',
        new Directionality(rtl ? 'rtl' : 'ltr', calendar),
      );
    }),
  );
  try {
    await f.pump();
    const pos = f.page(),
      step = async (n) => {
        pos.jumpToWithoutSettling(n * pos.viewportDimension);
        await f.pump();
      };
    const jan = identity(f.day(1, 15));
    await step(0.35);
    const retained = [1, 2].flatMap((m) =>
      Array.from({ length: m === 1 ? 31 : 28 }, (_, i) => [m, i + 1, identity(f.day(m, i + 1))]),
    );
    for (const page of [0.55, 0.45]) {
      await step(page);
      for (const [m, d, old] of retained) same(f.day(m, d), old);
    }
    await step(2);
    assert(!f.day(1, 15) && !jan.state.mounted && !jan.element.mounted);
    await step(0);
    for (const [m, d, old] of retained.filter(([m]) => m === 1)) {
      const fresh = identity(f.day(m, d));
      assert(!old.state.mounted && !old.element.mounted);
      assert(
        fresh.element !== old.element && fresh.state !== old.state && fresh.focus !== old.focus,
      );
    }
    const live = identity(f.day(1, 15)),
      before = MaterialLocalizations.of(live.element);
    assert.equal(before.locale, 'en-US');
    rtl = true;
    host.markNeedsBuild();
    await f.pump();
    same(f.day(1, 15), live);
    const after = MaterialLocalizations.of(live.element);
    assert.equal(after.locale, 'ar-EG');
    assert.notEqual(after.cutButtonLabel, before.cutButtonLabel);
    assert.equal(Directionality.of(live.element), 'rtl');
    assert(f.node(/^15, Wednesday/).selected);
    assert(f.node(/^15, Wednesday/).bounds.x < f.node(/^14, Tuesday/).bounds.x);
    assert.deepEqual(months, [2, 1, 3, 1]);
    assert.deepEqual(picked, []);
  } finally {
    f.close();
  }
}
async function dialog() {
  let context;
  const f = harness(
    new Builder((c) => {
      context = c;
      return new SizedBox(100, 40);
    }),
  );
  const open = (rtl, initialDate = options.initialDate) => {
    const result = showDatePicker({
      context,
      ...options,
      initialDate,
      locale: new Locale(rtl ? 'ar' : 'en', rtl ? 'EG' : 'US'),
      textDirection: rtl ? 'rtl' : 'ltr',
    });
    // Failure teardown disposes an outstanding route; preserve the original assertion.
    void result.catch(() => {});
    return result;
  };
  try {
    await f.pump();
    const result = open(false);
    await f.pump(6);
    const start = identity(f.day(1, 15));
    const selected = f.node('15, Wednesday, January 15, 2025'),
      disabled = f.node('16, Thursday, January 16, 2025');
    assert.equal(selected.role, 'button');
    assert.equal(disabled.role, 'button');
    assert(selected.selected && selected.enabled && typeof selected.activate === 'function');
    assert(!disabled.selected && !disabled.enabled && !disabled.activate);
    f.tap(disabled);
    await f.pump();
    assert(f.node(/^15, Wednesday/).selected);
    start.focus.requestFocus();
    await f.pump();
    assert(start.focus.hasPrimaryFocus);
    f.key('ArrowRight');
    await f.pump();
    assert(f.day(1, 17).widget.focusNode.hasPrimaryFocus, 'Right should skip disabled 16th');
    assert(f.node(/^15, Wednesday/).selected);
    f.tap(f.node(/^17, Friday/));
    await f.pump();
    assert(f.node(/^17, Friday/).selected && !f.node(/^15, Wednesday/).selected);
    f.resize(680, 480);
    await f.pump(4);
    assert(f.node(/^17, Friday/).selected);
    f.tap(f.node('OK'));
    await f.pump(6);
    const confirmed = await result;
    assert.deepEqual([confirmed.year, confirmed.month, confirmed.day], [2025, 1, 17]);
    assert(!f.day(1, 17));
    const cancelled = open(true, confirmed);
    await f.pump(6);
    const day = f.day(1, 17);
    assert.equal(Directionality.of(day), 'rtl');
    assert.equal(Localizations.of(day).locale, 'ar-EG');
    assert(f.node(/^17, Friday/).selected);
    assert(f.node(/^18, Saturday/).bounds.x < f.node(/^17, Friday/).bounds.x);
    day.widget.focusNode.requestFocus();
    await f.pump();
    f.key('ArrowRight');
    await f.pump();
    assert(
      f.day(1, 15).widget.focusNode.hasPrimaryFocus,
      'RTL right should skip disabled 16th toward 15th',
    );
    f.activate(f.node(/^18, Saturday/));
    await f.pump();
    assert(f.node(/^18, Saturday/).selected);
    f.tap(f.node('Cancel'));
    await f.pump(6);
    assert.equal(await cancelled, null);
    assert(!f.day(1, 18));
  } finally {
    f.close();
  }
}
const lease = PlatformChannelBinding.bind(messenger);
try {
  await pageLifecycle();
  await dialog();
  console.log(
    'CALENDAR_INTERACTION PASS: working-tree Source; live and evicted day identity; callbacks [2,1,3,1]; disabled hit, keyboard LTR/RTL, day hit/confirm, semantics action, resize, locale and dialog reopen/cancel.',
  );
} finally {
  lease.dispose();
}
