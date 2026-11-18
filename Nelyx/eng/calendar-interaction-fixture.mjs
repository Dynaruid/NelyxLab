// SPDX-License-Identifier: BSD-3-Clause
import assert from 'node:assert/strict';
import { FrameworkRoot } from '@nelyx/core/framework/widgets/root';
import { PageView } from '@nelyx/core/framework/widgets/page-view';
import { ScrollController } from '@nelyx/core/framework/widgets/scroll-controller';
import { ListView } from '@nelyx/core/framework/widgets/scroll-view';
import { Axis } from '@nelyx/core/framework/painting/basic-types';
import { Builder, SizedBox } from '@nelyx/core/framework/widgets/basic';
import { Directionality, Localizations } from '@nelyx/core/framework/widgets/app-data';
import { FoundationPlatform } from '@nelyx/core/foundation/platform';
import { FoundationBuildMode } from '@nelyx/core/foundation/constants';
import { FlutterError } from '@nelyx/core/foundation/flutter-error';
import { ResourceRegistry } from '@nelyx/core/hosting/resources';
import { releaseSceneFrameSource } from '@nelyx/core/ui/frame';
import { freezeTextInput } from '@nelyx/core/ui/text';
import { Locale } from '@nelyx/core/ui/locale';
import { RRect } from '@nelyx/core/ui/rrect';
import { PlatformChannelBinding } from '../src/services/channel-binding.ts';
import { MaterialApp } from '@nelyx/material/app';
import { Material } from '@nelyx/material/material';
import { Ink } from '@nelyx/material/ink-decoration';
import { InkResponse } from '@nelyx/material/ink-well';
import { ThemeData } from '@nelyx/material/theme-data';
import { MaterialLocalizations } from '@nelyx/material/material-localizations';
import {
  CalendarDatePicker,
  DateTime,
  GregorianCalendarDelegate,
  showDatePicker,
} from '@nelyx/material/date-picker';

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
  let liveResources = 0;
  function resourceFor(kind) {
    const id = resources.allocateId(kind);
    resources.register({ ...id, kind }, () => liveResources--);
    liveResources++;
    return id;
  }
  const font = resourceFor('font');
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
            resource = resourceFor('paragraph'),
            width = Math.min(input.text.length * 7, input.maxWidth ?? Infinity);
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
    press(n) {
      const { x, y, width, height } = n.bounds;
      assert(width > 0 && height > 0);
      const pointer = ++pointerId;
      const send = (kind) =>
        view.pointer({
          kind,
          pointer,
          x: x + width / 2,
          y: y + height / 2,
          device: 'touch',
          buttons: kind === 'up' ? 0 : 1,
          timestamp: ++time,
          viewportGeneration: metrics.viewportGeneration,
        });
      send('down');
      return () => send('up');
    },
    tap(n) {
      this.press(n)();
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
      assert.equal(resources.accountedTotals.resident, 0);
      assert.equal(resources.accountedTotals.producers, 0);
      assert.equal(liveResources, 0, 'Font or paragraph survived fixture disposal');
    },
  };
}
async function nestedLists() {
  const controller = new ScrollController();
  const cells = [];
  const fixture = harness(
    ListView.builder({
      controller,
      itemCount: 80,
      itemExtent: 60,
      itemBuilder: (_context, row) =>
        ListView.builder({
          scrollDirection: Axis.horizontal,
          primary: false,
          itemCount: 40,
          itemExtent: 50,
          itemBuilder: (_inner, column) => {
            cells.push([row, column]);
            return new SizedBox(50, 60);
          },
        }),
    }),
  );
  try {
    await fixture.pump();
    assert(cells.some(([r, c]) => r === 0 && c === 0));
    for (const row of [40, 0]) {
      cells.length = 0;
      controller.position.jumpToWithoutSettling(row * 60);
      await fixture.pump();
      assert(
        cells.some(([r, c]) => r === row && c === 0),
        'nested lazy row was not recreated',
      );
    }
  } finally {
    fixture.close();
    controller.dispose();
  }
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
  const generated = [],
    tested = [];
  class Delegate extends GregorianCalendarDelegate {
    getDay(year, month, day) {
      const result = super.getDay(year, month, day);
      generated.push(result);
      return result;
    }
  }
  const calendar = new CalendarDatePicker({
    ...options,
    calendarDelegate: new Delegate(),
    selectableDayPredicate: (d) => {
      tested.push(d);
      return options.selectableDayPredicate(d);
    },
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
      tested.length = generated.length = 0;
      await step(page);
      for (const [m, d, old] of retained) same(f.day(m, d), old);
      for (const month of [1, 2]) {
        const days = generated.filter((date) => date.month === month && tested.includes(date));
        assert.deepEqual(
          days.map((date) => date.day),
          Array.from({ length: month === 1 ? 31 : 28 }, (_, i) => i + 1),
        );
      }
    }
    await step(0);
    const oldAction = f.node(/^15, .*January/);
    const oldFocus = jan.focus;
    oldFocus.requestFocus();
    await f.pump();
    assert(oldFocus.hasPrimaryFocus);
    const release = f.press(oldAction);
    await step(2);
    release();
    f.activate(oldAction);
    await f.pump();
    assert(!oldFocus.hasPrimaryFocus);
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
async function firstMarchHit() {
  const months = [],
    picked = [];
  const fixture = harness(
    new CalendarDatePicker({
      ...options,
      initialDate: date(2, 15),
      onDisplayedMonthChanged: (d) => months.push(d.month),
      onDateChanged: (d) => picked.push([d.month, d.day]),
    }),
  );
  const materialOf = Material.of;
  let inkReads = 0;
  Material.of = function (context) {
    if (context.widget instanceof Ink || context.widget instanceof InkResponse) inkReads++;
    return materialOf.call(this, context);
  };
  try {
    fixture.resize(360, 400);
    await fixture.pump();
    const pos = fixture.page();
    pos.jumpToWithoutSettling(1.1 * pos.viewportDimension);
    await fixture.pump(1);
    assert.equal(inkReads, 0, 'An idle release ink build searched for the Material renderer');
    const response = flatten([fixture.day(3, 2)]).find((e) => e.widget instanceof InkResponse);
    assert(response, 'March 2 has no ink response');
    const mode = FoundationBuildMode.mode;
    try {
      FoundationBuildMode.mode = 'debug';
      assert(response.widget.debugCheckContext(response));
      assert.equal(inkReads, 1, 'Debug ink lost its Material validation');
    } finally {
      FoundationBuildMode.mode = mode;
    }
    assert.deepEqual(months, []);
    const second = fixture.node(/^2, Sunday, March/);
    const { x, y, width, height } = second.bounds;
    assert(x < 360 && x + width > 324 && y >= 0 && y + height <= 400);
    fixture.tap({
      ...second,
      bounds: {
        x: Math.max(324, x),
        y,
        width: Math.min(360, x + width) - Math.max(324, x),
        height,
      },
    });
    await fixture.pump();
    assert.deepEqual(picked, [[3, 2]]);
    assert(inkReads > 1, 'A live ink interaction did not resolve its Material renderer');
  } finally {
    Material.of = materialOf;
    fixture.close();
  }
}
const lease = PlatformChannelBinding.bind(messenger);
try {
  await pageLifecycle();
  await dialog();
  await nestedLists();
  await firstMarchHit();
  console.log(
    'CALENDAR_INTERACTION PASS: 59 retained dates, delegate and predicate, evicted pointer and semantics actions, partial March hit, nested lists, keyboard LTR/RTL, resize, locale, dialog confirm/cancel and disposal.',
  );
} finally {
  lease.dispose();
}
