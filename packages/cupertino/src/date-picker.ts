// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
import { DateTime } from '@nelyx/core/foundation/date-time';
import { invariant } from '@nelyx/core/foundation/errors';
import { ValueKey } from '@nelyx/core/foundation/key';
import { Curves } from '@nelyx/core/framework/animation/curves';
import { Alignment } from '@nelyx/core/framework/painting/alignment';
import { EdgeInsets } from '@nelyx/core/framework/painting/edge-insets';
import { Directionality, MediaQuery } from '@nelyx/core/framework/widgets/app-data';
import { Align, Expanded, Padding, Row, SizedBox, Text } from '@nelyx/core/framework/widgets/basic';
import { State, StatefulWidget } from '@nelyx/core/framework/widgets/framework';
import type {
  BuildContext,
  Element,
  Widget,
  WidgetOptions,
} from '@nelyx/core/framework/widgets/framework';
import { LayoutBuilder } from '@nelyx/core/framework/widgets/layout-builder';
import { NotificationListener } from '@nelyx/core/framework/widgets/notification-listener';
import {
  ScrollEndNotification,
  ScrollNotification,
  ScrollStartNotification,
} from '@nelyx/core/framework/widgets/scroll-notification';
import { ExcludeSemantics, Semantics } from '@nelyx/core/framework/widgets/semantics';
import { CupertinoColors } from './colors.ts';
import {
  CupertinoLocalizations,
  DatePickerDateOrder,
  DatePickerDateTimeOrder,
} from './cupertino-localizations.ts';
import { resolveCupertinoColor } from './internal/colors/color-values.ts';
import type { CupertinoColor } from './internal/colors/color-values.ts';
import {
  ChangeReportingBehavior,
  CupertinoPicker,
  CupertinoPickerDefaultSelectionOverlay,
  FixedExtentScrollController,
} from './picker.ts';
import { CupertinoTheme } from './theme.ts';

export { DateTime, DatePickerDateOrder, DatePickerDateTimeOrder };

export enum CupertinoDatePickerMode {
  time = 'time',
  date = 'date',
  dateAndTime = 'dateAndTime',
  monthYear = 'monthYear',
}

export type SelectableDayPredicate = (date: DateTime) => boolean;
export type SelectionOverlayBuilder = (
  context: BuildContext,
  column: { readonly selectedIndex: number; readonly columnCount: number },
) => Widget | null;

export interface CupertinoDatePickerOptions extends WidgetOptions {
  readonly onDateTimeChanged: (date: DateTime) => void;
  readonly mode?: CupertinoDatePickerMode;
  readonly initialDateTime?: DateTime | null;
  readonly minimumDate?: DateTime | null;
  readonly maximumDate?: DateTime | null;
  readonly minimumYear?: number;
  readonly maximumYear?: number | null;
  readonly minuteInterval?: number;
  readonly use24hFormat?: boolean;
  readonly dateOrder?: DatePickerDateOrder | null;
  readonly backgroundColor?: CupertinoColor | null;
  readonly showDayOfWeek?: boolean;
  readonly showTimeSeparator?: boolean;
  readonly itemExtent?: number;
  readonly selectionOverlayBuilder?: SelectionOverlayBuilder | null;
  readonly selectableDayPredicate?: SelectableDayPredicate | null;
  readonly changeReportingBehavior?: ChangeReportingBehavior;
}

const Mode = CupertinoDatePickerMode;

export class CupertinoDatePicker extends StatefulWidget {
  readonly onDateTimeChanged: CupertinoDatePickerOptions['onDateTimeChanged'];
  readonly mode: CupertinoDatePickerMode;
  readonly initialDateTime: DateTime;
  readonly minimumDate: DateTime | null;
  readonly maximumDate: DateTime | null;
  readonly minimumYear: number;
  readonly maximumYear: number | null;
  readonly minuteInterval: number;
  readonly use24hFormat: boolean;
  readonly dateOrder: DatePickerDateOrder | null;
  readonly backgroundColor: CupertinoColor | null;
  readonly showDayOfWeek: boolean;
  readonly showTimeSeparator: boolean;
  readonly itemExtent: number;
  readonly selectionOverlayBuilder: SelectionOverlayBuilder | null;
  readonly selectableDayPredicate: SelectableDayPredicate | null;
  readonly changeReportingBehavior: ChangeReportingBehavior;

  constructor({
    key = null,
    mode = Mode.dateAndTime,
    initialDateTime = null,
    minimumDate = null,
    maximumDate = null,
    minimumYear = 1,
    maximumYear = null,
    minuteInterval = 1,
    use24hFormat = false,
    dateOrder = null,
    backgroundColor = null,
    showDayOfWeek = false,
    showTimeSeparator = false,
    itemExtent = 32,
    selectionOverlayBuilder = null,
    selectableDayPredicate = null,
    changeReportingBehavior = ChangeReportingBehavior.onScrollUpdate,
    onDateTimeChanged,
  }: CupertinoDatePickerOptions) {
    super(key);
    const initial = initialDateTime ?? DateTime.now();
    const calendar = mode === Mode.date || mode === Mode.monthYear;
    invariant(
      Object.values(Mode).includes(mode) &&
        (dateOrder === null || Object.values(DatePickerDateOrder).includes(dateOrder)),
      'invalid-cupertino-date-mode',
      'CupertinoDatePicker requires a supported mode and date order',
    );
    invariant(
      Number.isFinite(itemExtent) &&
        itemExtent > 0 &&
        Number.isInteger(minuteInterval) &&
        minuteInterval > 0 &&
        60 % minuteInterval === 0 &&
        initial.minute % minuteInterval === 0,
      'invalid-cupertino-date-extent-or-interval',
      'The date picker requires a positive extent and a minute interval that fits the initial minute and divides 60',
    );
    invariant(
      !calendar ||
        (Number.isSafeInteger(minimumYear) &&
          minimumYear >= 1 &&
          initial.year >= minimumYear &&
          (maximumYear === null ||
            (Number.isSafeInteger(maximumYear) && initial.year <= maximumYear))),
      'invalid-cupertino-date-year',
      'The initial year must be inside the year bounds',
    );
    invariant(
      mode === Mode.time ||
        ((!minimumDate || !initial.isBefore(minimumDate)) &&
          (!maximumDate || !initial.isAfter(maximumDate))),
      'invalid-cupertino-date-range',
      'The initial date must be inside the date bounds',
    );
    invariant(
      (!showDayOfWeek || mode === Mode.date) &&
        (!showTimeSeparator || !calendar) &&
        (!initialDateTime || !selectableDayPredicate || selectableDayPredicate(initial)),
      'invalid-cupertino-date-options',
      'The displayed columns and initial date must satisfy the picker options',
    );
    this.mode = mode;
    this.initialDateTime = initial;
    this.minimumDate = minimumDate;
    this.maximumDate = maximumDate;
    this.minimumYear = minimumYear;
    this.maximumYear = maximumYear;
    this.minuteInterval = minuteInterval;
    this.use24hFormat = use24hFormat;
    this.dateOrder = dateOrder;
    this.backgroundColor = backgroundColor;
    this.showDayOfWeek = showDayOfWeek;
    this.showTimeSeparator = showTimeSeparator;
    this.itemExtent = itemExtent;
    this.selectionOverlayBuilder = selectionOverlayBuilder;
    this.selectableDayPredicate = selectableDayPredicate;
    this.changeReportingBehavior = changeReportingBehavior;
    this.onDateTimeChanged = onDateTimeChanged;
  }

  override createState(): State<CupertinoDatePicker> {
    return new DatePickerState();
  }
}

type WheelColumn = 'year' | 'month' | 'day' | 'date' | 'hour' | 'minute' | 'meridiem';
type Column = WheelColumn | 'separator';
type Indices = Record<WheelColumn, number>;
const calendarOrders = {
  dmy: ['day', 'month', 'year'],
  mdy: ['month', 'day', 'year'],
  ymd: ['year', 'month', 'day'],
  ydm: ['year', 'day', 'month'],
} as const;
const widths: Record<Column, number> = {
  year: 74,
  month: 104,
  day: 52,
  date: 150,
  hour: 56,
  minute: 56,
  meridiem: 64,
  separator: 20,
};
const dayMilliseconds = 86_400_000;
const wrap = (index: number, length: number): number => ((index % length) + length) % length;
const civilDay = ({ year, month, day }: DateTime) => {
  const utc = new Date(0);
  utc.setUTCFullYear(year, month - 1, day);
  return utc.getTime() / dayMilliseconds;
};

class DatePickerState extends State<CupertinoDatePicker> {
  private initial!: DateTime;
  private selection!: Indices;
  private lastReported!: DateTime;
  private readonly controllers = new Map<WheelColumn, FixedExtentScrollController>();
  private readonly scrolling = new Set<WheelColumn>();
  private correction = false;

  private get calendar(): boolean {
    return this.widget.mode === Mode.date || this.widget.mode === Mode.monthYear;
  }

  private indices(date: DateTime): Indices {
    return {
      year: date.year,
      month: date.month - 1,
      day: date.day - 1,
      date: civilDay(date) - civilDay(this.initial),
      hour: date.hour,
      minute: date.minute / this.widget.minuteInterval,
      meridiem: Math.floor(date.hour / 12),
    };
  }

  override initState(): void {
    super.initState();
    this.initial = this.widget.initialDateTime;
    this.selection = this.indices(this.initial);
    this.lastReported = this.value();
    for (const [name, initialItem] of Object.entries(this.selection))
      this.controllers.set(name as WheelColumn, new FixedExtentScrollController({ initialItem }));
  }

  override didUpdateWidget(old: CupertinoDatePicker): void {
    super.didUpdateWidget(old);
    const picker = this.widget;
    invariant(
      old.mode === picker.mode,
      'changed-cupertino-date-mode',
      'Give the date picker a new key to change its mode',
    );
    if (old.use24hFormat !== picker.use24hFormat) {
      this.scrolling.delete('meridiem');
      if (!picker.use24hFormat) {
        this.controllers.get('meridiem')!.dispose();
        this.controllers.set(
          'meridiem',
          new FixedExtentScrollController({ initialItem: this.selection.meridiem }),
        );
      }
    }
    if (old.minuteInterval !== picker.minuteInterval) {
      this.selection.minute = Math.floor(
        (this.selection.minute * old.minuteInterval) / picker.minuteInterval,
      );
      (this.context as Element).owner.postFrame(() => {
        if (this.mounted) this.controllers.get('minute')!.jumpToItem(this.selection.minute);
      });
    }
    if (
      old.minimumDate !== picker.minimumDate ||
      old.maximumDate !== picker.maximumDate ||
      old.minimumYear !== picker.minimumYear ||
      old.maximumYear !== picker.maximumYear ||
      old.selectableDayPredicate !== picker.selectableDayPredicate
    )
      this.scheduleCorrection();
  }

  private dayAt(index: number): DateTime {
    return new DateTime(this.initial.year, this.initial.month, this.initial.day + index);
  }

  private value(selection = this.selection): DateTime {
    const { year, month, day, date, hour, minute, meridiem } = selection;
    if (this.calendar)
      return new DateTime(year, month + 1, this.widget.mode === Mode.date ? day + 1 : 1);
    const hourOfDay = this.widget.use24hFormat ? hour : (hour % 12) + meridiem * 12;
    return new DateTime(
      this.initial.year,
      this.initial.month,
      this.initial.day + date,
      hourOfDay,
      minute * this.widget.minuteInterval,
    );
  }

  private inRange(first: DateTime, end?: DateTime): boolean {
    const { minimumDate, maximumDate } = this.widget;
    return (
      (!minimumDate || (end ? minimumDate.isBefore(end) : !first.isBefore(minimumDate))) &&
      (!maximumDate || !first.isAfter(maximumDate))
    );
  }

  private valid(value: DateTime): boolean {
    const picker = this.widget;
    if (!this.calendar)
      return this.inRange(value) && (picker.selectableDayPredicate?.(value) ?? true);
    const { year, month, day } = this.selection;
    const endDay = picker.mode === Mode.date ? day + 2 : this.initial.day + 1;
    return (
      year >= picker.minimumYear &&
      year <= (picker.maximumYear ?? Infinity) &&
      (picker.mode !== Mode.date || value.day === day + 1) &&
      this.inRange(value, new DateTime(year, month + 1, endDay))
    );
  }

  private report(): void {
    const value = this.value();
    if (this.valid(value) && !value.equals(this.lastReported)) {
      this.lastReported = value;
      this.widget.onDateTimeChanged(value);
    }
  }

  private changed(column: WheelColumn, index: number): void {
    if (this.correction) return;
    const old = this.selection[column];
    if (old === index) return;
    this.selection[column] = index;
    if (column === 'hour' && Math.floor(index / 12) !== Math.floor(old / 12)) {
      this.selection.meridiem = 1 - this.selection.meridiem;
      if (!this.widget.use24hFormat) {
        this.controllers.get('meridiem')!.jumpToItem(this.selection.meridiem);
      }
    }
    this.report();
  }

  private correctionTarget(): DateTime {
    const picker = this.widget;
    const { minimumDate, maximumDate, minimumYear, maximumYear, minuteInterval } = picker;
    const selected = this.value();
    if (this.calendar) {
      const { year, month, day } = this.selection;
      const limitedYear = Math.max(minimumYear, Math.min(maximumYear ?? year, year));
      const lastDay = new DateTime(limitedYear, month + 2, 0).day;
      const value = new DateTime(
        limitedYear,
        month + 1,
        picker.mode === Mode.date ? Math.min(day + 1, lastDay) : 1,
      );
      if (minimumDate && value.isBefore(minimumDate))
        return new DateTime(
          minimumDate.year,
          minimumDate.month,
          picker.mode === Mode.date ? minimumDate.day : 1,
        );
      if (maximumDate && value.isAfter(maximumDate))
        return new DateTime(
          maximumDate.year,
          maximumDate.month,
          picker.mode === Mode.date ? maximumDate.day : 1,
        );
      return value;
    }
    if (minimumDate && selected.isBefore(minimumDate)) {
      const minute =
        minimumDate.minute + Number(minimumDate.second > 0 || minimumDate.millisecond > 0);
      return new DateTime(
        minimumDate.year,
        minimumDate.month,
        minimumDate.day,
        minimumDate.hour,
        Math.ceil(minute / minuteInterval) * minuteInterval,
      );
    }
    if (maximumDate && selected.isAfter(maximumDate))
      return new DateTime(
        maximumDate.year,
        maximumDate.month,
        maximumDate.day,
        maximumDate.hour,
        Math.floor(maximumDate.minute / minuteInterval) * minuteInterval,
      );
    if (picker.mode === Mode.dateAndTime && picker.selectableDayPredicate?.(selected) === false) {
      const next = new DateTime(
        selected.year,
        selected.month,
        selected.day + 1,
        selected.hour,
        selected.minute,
      );
      if (this.inRange(next) && picker.selectableDayPredicate(next)) return next;
    }
    return this.lastReported;
  }

  private period(column: WheelColumn): number | undefined {
    const periods: Partial<Record<WheelColumn, number>> = {
      hour: 24,
      month: 12,
      day: 31,
      minute: 60 / this.widget.minuteInterval,
    };
    return periods[column];
  }

  private scheduleCorrection(): void {
    (this.context as Element).owner.postFrame(() => {
      if (!this.mounted || this.correction || this.scrolling.size || this.valid(this.value()))
        return;
      const target = this.correctionTarget();
      if (
        !this.calendar &&
        (!this.inRange(target) ||
          (this.widget.mode === Mode.time && civilDay(target) !== civilDay(this.initial)))
      )
        return;
      const indices = this.indices(target);
      const moves: { controller: FixedExtentScrollController; item: number }[] = [];
      for (const [column, controller] of this.controllers) {
        if (!controller.hasClients) continue;
        const period = this.period(column);
        const current = controller.selectedItem;
        let item = indices[column];
        if (period !== undefined) {
          const offset = wrap(item - current, period);
          item = current + (offset > period / 2 ? offset - period : offset);
        }
        if (current !== item) moves.push({ controller, item });
      }
      if (!moves.length) return;
      this.correction = true;
      const animations = moves.map(({ controller, item }) =>
        controller.animateToItem(item, { duration: 200, curve: Curves.easeOut }),
      );
      void Promise.allSettled(animations).then((results) => {
        if (!this.mounted) return;
        this.correction = false;
        this.setState(() => {
          for (const [column, controller] of this.controllers) {
            if (!controller.hasClients) continue;
            const period = this.period(column);
            const item = controller.selectedItem;
            indices[column] = period === undefined ? item : wrap(item, period);
          }
          if (this.widget.use24hFormat) indices.meridiem = Math.floor(indices.hour / 12);
          this.selection = indices;
        });
        for (const result of results)
          if (result.status === 'rejected') this.context.services.reportError?.(result.reason);
        this.report();
      });
    });
  }

  private columns(strings: CupertinoLocalizations, rtl: boolean): readonly Column[] {
    if (this.calendar) {
      const order = calendarOrders[this.widget.dateOrder ?? strings.datePickerDateOrder];
      return this.widget.mode === Mode.date ? order : order.filter((column) => column !== 'day');
    }
    const order = strings.datePickerDateTimeOrder;
    const columns: Column[] = rtl ? ['minute', 'hour'] : ['hour', 'minute'];
    if (this.widget.showTimeSeparator) columns.splice(1, 0, 'separator');
    if (!this.widget.use24hFormat) {
      if (
        order === DatePickerDateTimeOrder.date_dayPeriod_time ||
        order === DatePickerDateTimeOrder.dayPeriod_time_date
      )
        columns.unshift('meridiem');
      else columns.push('meridiem');
    }
    if (this.widget.mode === Mode.dateAndTime) {
      if (
        order === DatePickerDateTimeOrder.date_time_dayPeriod ||
        order === DatePickerDateTimeOrder.date_dayPeriod_time
      )
        columns.unshift('date');
      else columns.push('date');
    }
    return columns;
  }

  private item(
    context: BuildContext,
    column: Column,
    index: number,
    strings: CupertinoLocalizations,
    today: number,
  ): Widget | null {
    const { month, day, year, meridiem } = this.selection;
    const picker = this.widget;
    let label: string;
    let description: string | null = null;
    let enabled = true;
    switch (column) {
      case 'year':
        if (index < picker.minimumYear || index > (picker.maximumYear ?? 275759)) return null;
        label = strings.datePickerYear(index);
        enabled =
          index >= (picker.minimumDate?.year ?? index) &&
          index <= (picker.maximumDate?.year ?? index);
        break;
      case 'month':
        label = strings.datePickerMonth(index + 1);
        enabled = this.inRange(new DateTime(year, index + 1), new DateTime(year, index + 2));
        break;
      case 'day': {
        const date = new DateTime(year, month + 1, index + 1);
        label = strings.datePickerDayOfMonth(
          index + 1,
          picker.showDayOfWeek ? date.weekday : undefined,
        );
        enabled =
          date.day === index + 1 && this.inRange(date, new DateTime(year, month + 1, index + 2));
        break;
      }
      case 'date': {
        const date = this.dayAt(index);
        if (!this.inRange(date, this.dayAt(index + 1))) return null;
        label = civilDay(date) === today ? strings.todayLabel : strings.datePickerMediumDate(date);
        enabled = picker.selectableDayPredicate?.(date) ?? true;
        break;
      }
      case 'hour': {
        const hour = picker.use24hFormat ? index : index % 12 || 12;
        label = strings.datePickerHour(hour);
        description = strings.datePickerHourSemanticsLabel(hour);
        const projectedMeridiem =
          Math.floor(index / 12) === Math.floor(this.selection.hour / 12) ? meridiem : 1 - meridiem;
        const first = this.value({
          ...this.selection,
          hour: index,
          minute: 0,
          meridiem: projectedMeridiem,
        });
        enabled = this.inRange(
          first,
          DateTime.fromMillisecondsSinceEpoch(first.millisecondsSinceEpoch + 3_600_000),
        );
        break;
      }
      case 'minute': {
        const minute = index * picker.minuteInterval;
        label = strings.datePickerMinute(minute);
        description = strings.datePickerMinuteSemanticsLabel(minute);
        enabled = this.inRange(this.value({ ...this.selection, minute: index }));
        break;
      }
      case 'meridiem': {
        label = index === 0 ? strings.anteMeridiemAbbreviation : strings.postMeridiemAbbreviation;
        const first = this.value({ ...this.selection, minute: 0, meridiem: index });
        enabled = this.inRange(
          first,
          DateTime.fromMillisecondsSinceEpoch(first.millisecondsSinceEpoch + 3_600_000),
        );
        break;
      }
      case 'separator':
        label = ':';
        break;
    }
    const style = CupertinoTheme.of(context).textTheme.dateTimePickerTextStyle;
    const text = new Align(
      new Padding(
        EdgeInsets.symmetric({ horizontal: column === 'separator' ? 0 : 4 }),
        new Text(label, {
          maxLines: 1,
          softWrap: false,
          style: enabled
            ? style
            : style.copyWith({
                color: resolveCupertinoColor(CupertinoColors.inactiveGray, context).toARGB32(),
              }),
        }),
      ),
      { alignment: Alignment.center },
    );
    if (!enabled || column === 'separator') return new ExcludeSemantics({ child: text });
    return description === null
      ? text
      : new Semantics({ label: description, excludeSemantics: true, child: text });
  }

  override build(): Widget {
    const picker = this.widget;
    return MediaQuery.withNoTextScaling({
      child: new LayoutBuilder((context, constraints) => {
        const strings = CupertinoLocalizations.of(context);
        const rtl = Directionality.of(context) === 'rtl';
        const columns = this.columns(strings, rtl);
        const today = civilDay(DateTime.now());
        const base = columns.map((column) =>
          column === 'day' && picker.showDayOfWeek ? 94 : widths[column],
        );
        const width = Math.min(
          constraints.maxWidth,
          Math.max(
            320,
            base.reduce((sum, item) => sum + item, 0),
          ),
        );
        const wheels = columns.map((column, i) => {
          const key = new ValueKey(column);
          const overlay = picker.selectionOverlayBuilder
            ? picker.selectionOverlayBuilder(context, {
                selectedIndex: i,
                columnCount: columns.length,
              })
            : new CupertinoPickerDefaultSelectionOverlay({
                capStartEdge: i === 0,
                capEndEdge: i === columns.length - 1,
              });
          const common = {
            itemExtent: picker.itemExtent,
            useMagnifier: true,
            magnification: 2.35 / 2.1,
            squeeze: 1.25,
            offAxisFraction: (rtl ? 1 : -1) * (i / Math.max(1, columns.length - 1) - 0.5) * 0.9,
            backgroundColor: picker.backgroundColor,
            changeReportingBehavior: picker.changeReportingBehavior,
            selectionOverlay: overlay,
          };
          if (column === 'separator')
            return new Expanded(
              new ExcludeSemantics({
                child: new CupertinoPicker({
                  ...common,
                  onSelectedItemChanged: null,
                  children: [this.item(context, column, 0, strings, today)!],
                }),
              }),
              base[i],
              key,
            );
          const options = {
            ...common,
            scrollController: this.controllers.get(column)!,
            onSelectedItemChanged: (index: number) => this.changed(column, index),
          };
          const count = {
            year: null,
            date: null,
            month: 12,
            day: 31,
            hour: 24,
            minute: 60 / picker.minuteInterval,
            meridiem: 2,
          }[column];
          const wheel =
            count === null
              ? CupertinoPicker.builder({
                  ...options,
                  itemBuilder: (ctx, index) => this.item(ctx, column, index, strings, today),
                })
              : new CupertinoPicker({
                  ...options,
                  looping: column !== 'meridiem',
                  children: Array.from({ length: count }, (_, index) =>
                    this.item(context, column, index, strings, today)!,
                  ),
                });
          return new Expanded(
            new NotificationListener({
              notificationType: ScrollNotification,
              child: wheel,
              onNotification: (notification) => {
                if (notification.depth !== 0) return false;
                if (notification instanceof ScrollStartNotification) this.scrolling.add(column);
                if (notification instanceof ScrollEndNotification) {
                  this.scrolling.delete(column);
                  if (this.mounted) {
                    this.setState(() => {});
                    this.scheduleCorrection();
                  }
                }
                return false;
              },
            }),
            base[i],
            key,
          );
        });
        return new Align(new SizedBox(width, 216, new Row(wheels, { crossAlign: 'stretch' })));
      }),
    });
  }

  override dispose(): void {
    for (const controller of this.controllers.values()) controller.dispose();
    super.dispose();
  }
}
