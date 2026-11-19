// SPDX-License-Identifier: BSD-3-Clause
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ValueKey } from '@nelyx/core/foundation/key';
import { FoundationPlatform } from '@nelyx/core/foundation/platform';
import { Curves } from '@nelyx/core/framework/animation/curves';
import { PipelineOwner } from '@nelyx/core/framework/rendering/object';
import { FrameScheduler } from '@nelyx/core/framework/scheduler/scheduler';
import { Directionality, MediaQuery } from '@nelyx/core/framework/widgets/app-data';
import { Center, SizedBox, Text } from '@nelyx/core/framework/widgets/basic';
import { BuildOwner } from '@nelyx/core/framework/widgets/framework';
import {
  registerTickerScheduler,
  unregisterTickerScheduler,
} from '@nelyx/core/internal/framework/widgets/ticker-scheduler';
import { ResourceRegistry } from '@nelyx/core/hosting/resources';
import { GestureBinding } from '@nelyx/core/framework/gestures/binding';
import { ChangeReportingBehavior, CupertinoPicker } from '@nelyx/cupertino/picker';
import {
  CupertinoTimerPicker,
  CupertinoTimerPickerMode as Mode,
} from '@nelyx/cupertino/timer-picker';
import { CupertinoTimerPicker as AggregatePicker } from '@nelyx/cupertino/widgets';
import {
  CupertinoDatePicker,
  CupertinoDatePickerMode as DateMode,
  DatePickerDateOrder,
  DateTime,
} from '@nelyx/cupertino/date-picker';
import { CupertinoDatePicker as AggregateDatePicker } from '@nelyx/cupertino/widgets';
import { DateTime as MaterialDateTime } from '@nelyx/material/date-picker';
import { CupertinoLocalizations } from '@nelyx/cupertino/localizations';

const timeout = 1_200_000;
const picker = (options = {}) =>
  new CupertinoTimerPicker({ onTimerDurationChanged() {}, ...options });

function* descendants(element) {
  yield element;
  for (const child of element.children) yield* descendants(child);
}

async function mount(widget, verify, { rtl = false, width = 400, height = 300 } = {}) {
  const media = {
    width: 400,
    height: 300,
    scale: 1,
    textScale: 2,
    safeArea: { left: 0, top: 0, right: 0, bottom: 0 },
    keyboardInset: 0,
  };
  let now = 0;
  const clock = { now: () => now };
  const scheduler = new FrameScheduler(clock, () => {});
  const errors = [];
  const resources = new ResourceRegistry();
  const defaultFont = resources.allocateId('font');
  resources.register({ ...defaultFont, kind: 'font' }, () => {});
  const owner = new BuildOwner(
    {
      owner: { id: 'timer-test', generation: 1 },
      clock,
      scheduler,
      defaultFont,
      resources,
      text: {
        layout(input) {
          const resource = resources.allocateId('paragraph');
          resources.register({ ...resource, kind: 'paragraph' }, () => {});
          const width = Math.min(input.width, input.text.length * 8);
          return {
            resource,
            input,
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
            lines: [],
          };
        },
      },
      readMetrics: () => media,
      readStatus: () => 'open',
      reportError: ({ exception }) => errors.push(exception),
    },
    async () => {},
    (callback) => scheduler.addPostFrame(callback),
  );
  const pipeline = new PipelineOwner({ accessibilityEnabled: false });
  const tree = (child) =>
    new MediaQuery(
      media,
      new Directionality(rtl ? 'rtl' : 'ltr', new Center(new SizedBox(width, height, child))),
    );
  const root = tree(widget).createElement();
  const flush = (time = now) => {
    now = time;
    scheduler.handleBeginFrame(now);
    owner.flushBuild();
    pipeline.flushLayout({ width: media.width, height: media.height });
    scheduler.handleDrawFrame();
    assert.deepEqual(errors, []);
  };
  const elements = (type) => [...descendants(root)].filter((e) => e.widget instanceof type);
  const gestureLease = owner.bindGestureBinding(
    new GestureBinding({
      devicePixelRatioForView: () => 1,
      gestureArena: owner.gestures,
      scheduler,
    }),
  );
  registerTickerScheduler(owner, scheduler);
  const platform = FoundationPlatform.hostEnvironment;
  try {
    FoundationPlatform.configure({ kind: 'web', operatingSystem: 'windows' });
    root.mount(undefined, owner);
    owner.flushBuild();
    pipeline.rootNode = root.renderObjects[0];
    flush();
    await verify({
      elements,
      wheels: () => elements(CupertinoPicker).map((e) => e.widget),
      flush,
      update: (child) => {
        root.update(tree(child));
        flush();
      },
    });
  } finally {
    pipeline.rootNode = null;
    root.unmount();
    unregisterTickerScheduler(owner);
    gestureLease.dispose();
    FoundationPlatform.configure(platform);
  }
}

test(
  'validates Flutter bounds and both initial intervals even with a hidden column',
  { timeout },
  () => {
    assert.equal(AggregatePicker, CupertinoTimerPicker);
    for (const initialTimerDuration of [-1, 86_400_000, NaN, Infinity]) {
      assert.throws(() => picker({ initialTimerDuration }), /initial duration/);
    }
    for (const minuteInterval of [0, 7, 2.5, 120]) {
      assert.throws(() => picker({ minuteInterval }), /intervals/);
    }
    assert.throws(() => picker({ initialTimerDuration: 60_000, minuteInterval: 5 }), /intervals/);
    assert.throws(
      () => picker({ mode: Mode.hm, initialTimerDuration: 1000, secondInterval: 5 }),
      /intervals/,
    );
    assert.throws(() => picker({ itemExtent: 0 }), /item extent/);
    assert.doesNotThrow(() => picker({ initialTimerDuration: 86_399_999.999 }));
  },
);

test(
  'each mode seeds its visible columns and reports whole-second durations without carrying',
  { timeout },
  async () => {
    for (const [mode, indices, expected] of [
      [Mode.hm, [2, 11], [7_200_000, 7_500_000]],
      [Mode.ms, [11, 3], [45_000, 0]],
      [Mode.hms, [2, 11, 3], [7_245_000, 7_200_000, 82_800_000]],
    ]) {
      const values = [];
      await mount(
        picker({
          mode,
          initialTimerDuration: 10_545_999.5,
          minuteInterval: 5,
          secondInterval: 15,
          onTimerDurationChanged: (value) => values.push(value),
        }),
        ({ wheels, flush }) => {
          const controllers = wheels().map((wheel) => wheel.scrollController);
          assert.deepEqual(
            controllers.map((controller) => controller.selectedItem),
            indices,
          );
          assert.deepEqual(values, []);
          const minute = controllers[mode === Mode.ms ? 0 : 1];
          minute.jumpToItem(12);
          if (mode === Mode.hm) minute.jumpToItem(13);
          else controllers.at(-1).jumpToItem(4);
          if (mode === Mode.hms) {
            const hour = controllers[0];
            assert.equal(hour.position.minScrollExtent, 0);
            assert.equal(hour.position.maxScrollExtent, 23 * 32);
            hour.jumpToItem(23);
          }
          flush();
          assert.deepEqual(values, expected);
        },
      );
    }
  },
);

test(
  'reports live or on settle and keeps the hour suffix stable until settling',
  { timeout },
  async () => {
    for (const changeReportingBehavior of [
      ChangeReportingBehavior.onScrollUpdate,
      ChangeReportingBehavior.onScrollEnd,
    ]) {
      const values = [];
      await mount(
        picker({ changeReportingBehavior, onTimerDurationChanged: (value) => values.push(value) }),
        async ({ wheels, elements, flush }) => {
          const hourLabel = () =>
            elements(Text)
              .map((e) => e.widget.text)
              .find((text) => /^hours?$/.test(text));
          assert.equal(hourLabel(), 'hours');
          let settled = false;
          void wheels()[0]
            .scrollController.animateToItem(1, {
              duration: 100,
              curve: Curves.linear,
            })
            .then(() => {
              settled = true;
            });
          flush(0);
          flush(60);
          assert.deepEqual(
            values,
            changeReportingBehavior === ChangeReportingBehavior.onScrollEnd ? [] : [3_600_000],
          );
          assert.equal(hourLabel(), 'hours');
          flush(120);
          await new Promise((resolve) => setImmediate(resolve));
          flush(121);
          assert.equal(settled, true);
          assert.deepEqual(values, [3_600_000]);
          assert.equal(hourLabel(), 'hour');
        },
      );
    }
  },
);

test(
  'retains the live selection on rebuild, uses the newest callback, and supports overlay removal and rekeying',
  { timeout },
  async () => {
    const overlayCalls = [];
    const values = [];
    const oldValues = [];
    await mount(
      picker({ mode: Mode.ms, onTimerDurationChanged: (v) => oldValues.push(v) }),
      ({ wheels, update }) => {
        const [minute] = wheels().map((wheel) => wheel.scrollController);
        minute.jumpToItem(2);
        update(
          picker({
            mode: Mode.ms,
            initialTimerDuration: 300_000,
            onTimerDurationChanged: (v) => values.push(v),
            selectionOverlayBuilder: (_context, column) => {
              overlayCalls.push(column);
              return null;
            },
          }),
        );
        assert.equal(wheels()[0].scrollController, minute);
        assert.equal(minute.selectedItem, 2);
        assert.deepEqual(overlayCalls.slice(-2), [
          { selectedIndex: 0, columnCount: 2 },
          { selectedIndex: 1, columnCount: 2 },
        ]);
        assert.ok(wheels().every((wheel) => wheel.selectionOverlay === null));
        minute.jumpToItem(3);
        assert.deepEqual(oldValues, [120_000]);
        assert.deepEqual(values, [180_000]);
        update(
          picker({
            key: new ValueKey('reset'),
            mode: Mode.hm,
            initialTimerDuration: 7_200_000,
            onTimerDurationChanged: (v) => values.push(v),
          }),
        );
        assert.deepEqual(
          wheels().map((wheel) => wheel.scrollController.selectedItem),
          [2, 0],
        );
        assert.deepEqual(values, [180_000]);
      },
      { rtl: true },
    );
    await mount(picker(), ({ wheels }) => assert.equal(wheels().length, 3), {
      width: 0,
      height: 0,
    });
  },
);

test(
  'date and month wheels keep one DateTime identity and repair a leap-year overflow',
  { timeout },
  async () => {
    assert.equal(AggregateDatePicker, CupertinoDatePicker);
    assert.equal(DateTime, MaterialDateTime);
    const values = [];
    await mount(
      new CupertinoDatePicker({
        mode: DateMode.date,
        dateOrder: DatePickerDateOrder.mdy,
        initialDateTime: new DateTime(2024, 1, 31),
        minimumYear: 2023,
        maximumYear: 2025,
        onDateTimeChanged: (date) => values.push(date),
      }),
      async ({ wheels, flush }) => {
        const [month, day, year] = wheels().map((wheel) => wheel.scrollController);
        assert.deepEqual([month.selectedItem, day.selectedItem, year.selectedItem], [0, 30, 2024]);
        month.jumpToItem(1);
        assert.deepEqual(values, []);
        flush(0);
        flush(100);
        flush(450);
        await new Promise((resolve) => setImmediate(resolve));
        flush(451);
        assert.equal(day.selectedItem, 28);
        assert.deepEqual(values, [new DateTime(2024, 2, 29)]);
      },
    );
  },
);

test(
  'time selection wraps the hour and respects the interval and lower bound',
  { timeout },
  async () => {
    const values = [];
    await mount(
      new CupertinoDatePicker({
        mode: DateMode.time,
        initialDateTime: new DateTime(2024, 2, 29, 11, 45),
        minimumDate: new DateTime(2024, 2, 29, 11, 35),
        minuteInterval: 15,
        onDateTimeChanged: (date) => values.push(date),
      }),
      ({ wheels }) => {
        const [hour, minute, meridiem] = wheels().map((wheel) => wheel.scrollController);
        assert.deepEqual(
          [hour.selectedItem, minute.selectedItem, meridiem.selectedItem],
          [11, 3, 0],
        );
        minute.jumpToItem(2);
        assert.deepEqual(values, []);
        minute.jumpToItem(3);
        hour.jumpToItem(12);
        assert.equal(meridiem.selectedItem, 1);
        assert.deepEqual(values, [new DateTime(2024, 2, 29, 12, 45)]);
      },
    );
  },
);

test('combined and month-year modes preserve their civil date precision', { timeout }, async () => {
  const values = [];
  await mount(
    new CupertinoDatePicker({
      initialDateTime: new DateTime(2024, 3, 1, 8, 10),
      minimumDate: new DateTime(2024, 2, 28),
      use24hFormat: true,
      onDateTimeChanged: (date) => values.push(date),
    }),
    ({ wheels }) => wheels()[0].scrollController.jumpToItem(-1),
  );
  await mount(
    new CupertinoDatePicker({
      mode: DateMode.monthYear,
      initialDateTime: new DateTime(2024, 2, 29, 8, 10),
      onDateTimeChanged: (date) => values.push(date),
    }),
    ({ wheels }) => wheels()[0].scrollController.jumpToItem(2),
  );
  assert.deepEqual(values, [new DateTime(2024, 2, 29, 8, 10), new DateTime(2024, 3)]);
  const korean = new CupertinoLocalizations('ko-KR');
  assert.equal(korean.datePickerDateOrder, DatePickerDateOrder.ymd);
  assert.equal(korean.anteMeridiemAbbreviation, '오전');
  assert.equal(korean.datePickerMonth(2), '2월');
  assert.equal(korean.datePickerDayOfMonth(29), '29일');
  assert.equal(korean.datePickerHour(9), '09');
  assert.equal(korean.datePickerMinuteSemanticsLabel(15), '15분');
});
