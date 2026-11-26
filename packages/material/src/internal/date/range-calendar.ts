// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Flutter: packages/flutter/lib/src/material/date_picker.dart
// Revision: 71e4717a61786faab4c7aa39825989305ed29e8a
import { UniqueKey } from '@nelyx/core/foundation/key';
import { Curves } from '@nelyx/core/framework/animation/curves';
import { AlignmentDirectional } from '@nelyx/core/framework/painting/alignment';
import { CircleBorder } from '@nelyx/core/framework/painting/circle-border';
import { ColorShapeDecoration } from '@nelyx/core/framework/painting/color-shape-decoration';
import { EdgeInsets } from '@nelyx/core/framework/painting/edge-insets';
import { TextStyle } from '@nelyx/core/framework/painting/text-style';
import { BoxConstraints } from '@nelyx/core/framework/rendering/constraints';
import { CustomPainter } from '@nelyx/core/framework/rendering/custom-paint';
import { Directionality, MediaQuery } from '@nelyx/core/framework/widgets/app-data';
import {
  Align,
  Center,
  ColoredBox,
  Column,
  ConstrainedBox,
  DecoratedBox,
  Expanded,
  Padding,
  Row,
  SizedBox,
  Text,
} from '@nelyx/core/framework/widgets/basic';
import { CustomPaint } from '@nelyx/core/framework/widgets/custom-paint';
import { FocusNode } from '@nelyx/core/framework/widgets/focus';
import type { KeyEventResult } from '@nelyx/core/framework/widgets/focus';
import { Focus } from '@nelyx/core/framework/widgets/focus-scope';
import { Element, State, StatefulWidget } from '@nelyx/core/framework/widgets/framework';
import type { BuildContext, Widget } from '@nelyx/core/framework/widgets/framework';
import { ScrollController } from '@nelyx/core/framework/widgets/scroll-controller';
import { CustomScrollView } from '@nelyx/core/framework/widgets/scroll-view';
import { ExcludeSemantics, Semantics } from '@nelyx/core/framework/widgets/semantics';
import { SliverList } from '@nelyx/core/framework/widgets/sliver';
import { WidgetState, emptyWidgetStateSet } from '@nelyx/core/framework/widgets/widget-state';
import { KeyDownEvent, KeyRepeatEvent } from '@nelyx/core/services/hardware-keyboard';
import type { KeyEvent } from '@nelyx/core/services/hardware-keyboard';
import { LogicalKeyboardKey } from '@nelyx/core/services/keyboard-key';
import type { Canvas } from '@nelyx/core/ui/canvas';
import { Color } from '@nelyx/core/ui/color';
import type { Size } from '@nelyx/core/ui/geometry';
import { Paint } from '@nelyx/core/ui/paint';
import { Rect } from '@nelyx/core/ui/rect';
import { DatePickerTheme } from '../../date-picker-theme.ts';
import { Divider } from '../../divider.ts';
import type { CalendarDelegate } from '../../generated/date/date.generated.ts';
import { InkResponse } from '../../ink-well.ts';
import { colorProperty } from '../button/style-properties.ts';
import type { MaterialLocalizations } from '../../material-localizations.ts';
import { Theme } from '../../theme.ts';
import { DateTime } from './date-time.ts';

const monthScrollDuration = 200;
const monthHeaderHeight = 58;
const monthFooterHeight = 12;
const weekHeight = 42;
const weekSpacing = 8;
const horizontalEdge = 8;
const maxCalendarWidthLandscape = 384;
const maxCalendarWidthPortrait = 480;
const dayCircle = new CircleBorder();

interface RangeCalendarOptions {
  readonly calendar: CalendarDelegate<DateTime>;
  readonly first: DateTime;
  readonly last: DateTime;
  readonly today: DateTime;
  readonly start: DateTime | null;
  readonly end: DateTime | null;
  readonly isSelectable: (date: DateTime) => boolean;
  readonly onSelect: (date: DateTime) => void;
  readonly localization: MaterialLocalizations;
}

export class RangeCalendar extends StatefulWidget {
  constructor(readonly options: RangeCalendarOptions) {
    super();
  }
  override createState(): State<RangeCalendar> {
    return new RangeCalendarState();
  }
}

function maxCalendarWidth(context: BuildContext): number {
  const media = MediaQuery.of(context);
  return media.width > media.height ? maxCalendarWidthLandscape : maxCalendarWidthPortrait;
}

function weekRow(
  children: readonly Widget[],
  leading: Widget | null = null,
  trailing: Widget | null = null,
): Widget {
  return new SizedBox(
    undefined,
    weekHeight,
    new Row(
      [
        new SizedBox(horizontalEdge, undefined, leading ?? undefined),
        ...children.map((child) => new Expanded(child)),
        new SizedBox(horizontalEdge, undefined, trailing ?? undefined),
      ],
      { crossAxisAlignment: 'stretch' },
    ),
  );
}

class RangeCalendarState extends State<RangeCalendar> {
  private readonly scroll = new ScrollController();
  private readonly focus = new FocusNode({ debugLabel: 'Date range grid' });
  private readonly center = new UniqueKey();
  private readonly monthOffsets = new Map<number, number>();
  private initialMonth = 0;
  private focusedDay: DateTime | null = null;
  private gridFocused = false;
  private divider = false;

  override initState(): void {
    super.initState();
    this.resetCalendar();
    this.scroll.addListener(this.onScroll);
  }

  override didUpdateWidget(old: RangeCalendar): void {
    super.didUpdateWidget(old);
    const current = this.widget.options;
    if (
      current.calendar !== old.options.calendar ||
      !current.first.equals(old.options.first) ||
      !current.last.equals(old.options.last)
    ) {
      this.resetCalendar();
      const context = this.context;
      if (context instanceof Element)
        context.owner.postFrame(() => {
          if (this.mounted && this.scroll.hasClients) this.scroll.jumpTo(0);
        });
    } else if (
      current.localization.firstDayOfWeekIndex !== old.options.localization.firstDayOfWeekIndex
    ) {
      this.updateMonthOffsets(old.options);
    }
  }

  private updateMonthOffsets(old: RangeCalendarOptions): void {
    const position = this.scroll.hasClients ? this.scroll.position : null;
    let anchor: { month: number; within: number } | undefined;
    if (position?.hasContentDimensions) {
      let first = 0;
      let last = old.calendar.monthDelta(old.first, old.last);
      while (first < last) {
        const midpoint = Math.ceil((first + last) / 2);
        if (this.offsetForMonth(midpoint, old) <= position.pixels) first = midpoint;
        else last = midpoint - 1;
      }
      anchor = { month: first, within: position.pixels - this.offsetForMonth(first, old) };
    }
    this.monthOffsets.clear();
    this.monthOffsets.set(this.initialMonth, 0);
    const context = this.context;
    if (!anchor || !(context instanceof Element)) return;
    const start = this.offsetForMonth(anchor.month);
    const end = this.offsetForMonth(anchor.month + 1);
    const offset = start + Math.max(0, Math.min(anchor.within, end - start - 1));
    context.owner.postFrame(() => {
      if (!this.mounted || !this.scroll.hasClients || this.scroll.position !== position) return;
      this.scroll.jumpTo(
        Math.max(position.minScrollExtent, Math.min(position.maxScrollExtent, offset)),
      );
    });
  }

  private resetCalendar(): void {
    const { calendar, start, today, first } = this.widget.options;
    const initial = start ?? today;
    const visible = this.inBounds(initial);
    this.focusedDay = visible ? initial : first;
    this.initialMonth = visible ? calendar.monthDelta(first, initial) : 0;
    this.divider = this.initialMonth > 0;
    this.monthOffsets.clear();
    this.monthOffsets.set(this.initialMonth, 0);
  }

  private inBounds(date: DateTime): boolean {
    const { first, last } = this.widget.options;
    return !date.isBefore(first) && !date.isAfter(last);
  }

  private readonly onScroll = () => {
    if (!this.mounted || !this.scroll.hasClients || !this.scroll.position.hasContentDimensions)
      return;
    const divider = this.scroll.offset > this.scroll.position.minScrollExtent;
    if (divider !== this.divider)
      this.setState(() => {
        this.divider = divider;
      });
  };

  private offsetForMonth(index: number, options = this.widget.options): number {
    const { calendar, first, localization } = options;
    let nearest = this.initialMonth;
    for (const known of this.monthOffsets.keys()) {
      if (Math.abs(known - index) < Math.abs(nearest - index)) nearest = known;
    }
    let offset = this.monthOffsets.get(nearest)!;
    const direction = Math.sign(index - nearest);
    while (nearest !== index) {
      const month = calendar.addMonthsToMonthDate(first, direction > 0 ? nearest : nearest - 1);
      const days = calendar.getDaysInMonth(month.year, month.month);
      const pad = calendar.firstDayOffset(month.year, month.month, localization);
      const weeks = Math.ceil((days + pad) / DateTime.daysPerWeek);
      offset +=
        direction *
        (monthHeaderHeight + weeks * weekHeight + (weeks - 1) * weekSpacing + monthFooterHeight);
      nearest += direction;
      this.monthOffsets.set(nearest, offset);
    }
    return offset;
  }

  private revealDay(day: DateTime, edge?: 'start' | 'end'): void {
    if (!this.scroll.hasClients) return;
    const position = this.scroll.position;
    if (!position.hasContentDimensions || !position.hasViewportDimension) return;
    const { calendar, first, localization } = this.widget.options;
    const month = calendar.monthDelta(first, day);
    const pad = calendar.firstDayOffset(day.year, day.month, localization);
    const row = Math.floor((pad + day.day - 1) / DateTime.daysPerWeek);
    const start = this.offsetForMonth(month) + monthHeaderHeight + row * (weekHeight + weekSpacing);
    const end = start + weekHeight;
    const visibleEnd = position.pixels + position.viewportDimension;
    const target =
      edge !== 'end' && start < position.pixels
        ? start
        : edge !== 'start' && end > visibleEnd
          ? end - position.viewportDimension
          : null;
    if (target !== null) {
      const offset = Math.max(position.minScrollExtent, Math.min(position.maxScrollExtent, target));
      if (offset !== position.pixels)
        void this.scroll.animateTo(offset, { duration: monthScrollDuration, curve: Curves.linear });
    }
  }

  private readonly onKey = (_node: FocusNode, event: KeyEvent): KeyEventResult => {
    if (!(event instanceof KeyDownEvent || event instanceof KeyRepeatEvent)) return 'ignored';
    const key = event.logicalKey,
      date = this.focusedDay;
    if (event.alt || event.control || event.meta) return 'ignored';
    if (key.equals(LogicalKeyboardKey.tab) && event instanceof KeyDownEvent) {
      this.focus.requestFocus();
      if (event.shift ? this.focus.previousFocus() : this.focus.nextFocus()) return 'handled';
      return 'ignored';
    }
    if (!date || event.shift) return 'ignored';
    const { calendar, isSelectable, onSelect } = this.widget.options;
    if (key.equals(LogicalKeyboardKey.enter) || key.equals(LogicalKeyboardKey.space)) {
      if (event instanceof KeyDownEvent && isSelectable(date)) onSelect(date);
      return 'handled';
    }
    const dayStep = Directionality.of(this.context) === 'rtl' ? -1 : 1;
    const offset = key.equals(LogicalKeyboardKey.arrowLeft)
      ? -dayStep
      : key.equals(LogicalKeyboardKey.arrowRight)
        ? dayStep
        : key.equals(LogicalKeyboardKey.arrowUp)
          ? -DateTime.daysPerWeek
          : key.equals(LogicalKeyboardKey.arrowDown)
            ? DateTime.daysPerWeek
            : 0;
    if (!offset) return 'ignored';
    const next = calendar.addDaysToDate(date, offset);
    if (this.inBounds(next)) {
      this.setState(() => {
        this.focusedDay = next;
      });
      if (!isSelectable(next)) this.focus.requestFocus();
      const towardStart =
        key.equals(LogicalKeyboardKey.arrowLeft) || key.equals(LogicalKeyboardKey.arrowUp);
      this.revealDay(next, towardStart ? 'start' : 'end');
    }
    return 'handled';
  };

  private month(context: BuildContext, index: number): Widget {
    const options = this.widget.options;
    const month = options.calendar.addMonthsToMonthDate(options.first, index);
    const { year, month: monthNumber } = month;
    const pad = options.calendar.firstDayOffset(year, monthNumber, options.localization);
    const days = options.calendar.getDaysInMonth(year, monthNumber);
    const count = days + pad;
    const maxWidth = maxCalendarWidth(context);
    const theme = Theme.of(context);
    const pickerTheme = DatePickerTheme.of(context),
      defaults = DatePickerTheme.defaults(context);
    const highlight =
      pickerTheme.rangeSelectionBackgroundColor ?? defaults.rangeSelectionBackgroundColor;
    const rows: Widget[] = [
      new SizedBox(
        undefined,
        monthHeaderHeight,
        new Padding(
          EdgeInsets.symmetric({ horizontal: 16 }),
          new Align(
            new ExcludeSemantics(
              new Text(options.calendar.formatMonthYear(month, options.localization), {
                style: (theme.textTheme.bodyMedium ?? new TextStyle()).copyWith({
                  color: theme.colorScheme.onSurface,
                }),
              }),
            ),
            { alignment: AlignmentDirectional.centerStart },
          ),
        ),
      ),
    ];
    for (let start = 0; start < count; start += DateTime.daysPerWeek) {
      if (start > 0) rows.push(new SizedBox(undefined, weekSpacing));
      const children = Array.from({ length: DateTime.daysPerWeek }, (_, weekday) => {
        const day = start + weekday + 1 - pad;
        if (day < 1 || day > days) return new SizedBox();
        const date = options.calendar.getDay(year, monthNumber, day);
        return new RangeDay({
          date,
          options,
          focused: this.gridFocused && options.calendar.isSameDay(date, this.focusedDay),
          onFocus: () => {
            if (!options.calendar.isSameDay(date, this.focusedDay))
              this.setState(() => {
                this.focusedDay = date;
              });
          },
        });
      });
      const startDate = options.start,
        endDate = options.end;
      let leading: Widget | null = null,
        trailing: Widget | null = null;
      if (startDate && endDate && highlight) {
        const firstDay = start + 1 - pad;
        const lastDay = start + DateTime.daysPerWeek - pad;
        if (firstDay >= 1) {
          const first = options.calendar.getDay(year, monthNumber, firstDay);
          if (first.isAfter(startDate) && !first.isAfter(endDate))
            leading = new ColoredBox({ color: highlight.value });
        }
        if (lastDay <= days) {
          const last = options.calendar.getDay(year, monthNumber, lastDay);
          if (!last.isBefore(startDate) && last.isBefore(endDate))
            trailing = new ColoredBox({ color: highlight.value });
        }
      }
      rows.push(weekRow(children, leading, trailing));
    }
    rows.push(new SizedBox(undefined, monthFooterHeight));
    return new Center(
      new ConstrainedBox(
        new Column(rows, { mainAxisSize: 'min' }),
        new BoxConstraints(0, maxWidth),
      ),
    );
  }

  override build(context: BuildContext): Widget {
    const { calendar, first, last, localization } = this.widget.options;
    const monthCount = calendar.monthDelta(first, last) + 1;
    const theme = Theme.of(context);
    const dayHeaderStyle = (theme.textTheme.titleSmall ?? new TextStyle()).copyWith({
      color: theme.colorScheme.onSurface,
    });
    const weekdayLabels = Array.from(
      { length: DateTime.daysPerWeek },
      (_, index) =>
        new ExcludeSemantics(
          new Center(
            new Text(
              localization.narrowWeekdays[
                (localization.firstDayOfWeekIndex + index) % DateTime.daysPerWeek
              ] ?? '',
              { style: dayHeaderStyle },
            ),
          ),
        ),
    );
    const header = new Center(
      new ConstrainedBox(weekRow(weekdayLabels), new BoxConstraints(0, maxCalendarWidth(context))),
    );
    return new Column(
      [
        header,
        ...(this.divider
          ? [new Divider({ height: 0, color: DatePickerTheme.of(context).dividerColor })]
          : []),
        new Expanded(
          new Focus(
            new CustomScrollView({
              controller: this.scroll,
              center: this.center,
              // Each month owns a paragraph per day. Keep the surrounding route's
              // live paragraphs available while the dialog is on screen.
              cacheExtent: 0,
              slivers: [
                SliverList.builder({
                  itemCount: this.initialMonth,
                  itemBuilder: (context, index) =>
                    this.month(context, this.initialMonth - index - 1),
                }),
                SliverList.builder({
                  key: this.center,
                  itemCount: monthCount - this.initialMonth,
                  itemBuilder: (context, index) => this.month(context, this.initialMonth + index),
                }),
              ],
            }),
            {
              focusNode: this.focus,
              includeSemantics: false,
              onKeyEvent: this.onKey,
              onFocusChange: (focused) => {
                this.setState(() => {
                  this.gridFocused = focused;
                });
                if (focused && this.focusedDay) this.revealDay(this.focusedDay);
              },
            },
          ),
        ),
      ],
      { crossAxisAlignment: 'stretch' },
    );
  }

  override dispose(): void {
    this.focus.dispose();
    this.scroll.removeListener(this.onScroll);
    this.scroll.dispose();
    super.dispose();
  }
}

type RangeHighlight = 'leading' | 'trailing' | 'full';

class HighlightPainter extends CustomPainter {
  constructor(
    readonly color: Color,
    readonly highlight: RangeHighlight,
    readonly rtl: boolean,
  ) {
    super();
  }
  override paint(canvas: Canvas, size: Size): void {
    const full = this.highlight === 'full';
    const right = (this.highlight === 'leading') === this.rtl;
    canvas.drawRect(
      Rect.fromLTWH(
        !full && right ? size.width / 2 : 0,
        0,
        full ? size.width : size.width / 2,
        size.height,
      ),
      new Paint({ color: this.color.value }),
    );
  }
  override shouldRepaint(old: CustomPainter): boolean {
    return (
      !(old instanceof HighlightPainter) ||
      !this.color.equals(old.color) ||
      this.highlight !== old.highlight ||
      this.rtl !== old.rtl
    );
  }
}

interface RangeDayOptions {
  readonly date: DateTime;
  readonly options: RangeCalendarOptions;
  readonly focused: boolean;
  readonly onFocus: () => void;
}

class RangeDay extends StatefulWidget {
  constructor(readonly day: RangeDayOptions) {
    super();
  }
  override createState(): State<RangeDay> {
    return new RangeDayState();
  }
}

class RangeDayState extends State<RangeDay> {
  private readonly focus = new FocusNode({ skipTraversal: true, debugLabel: 'Date range day' });
  private requestFocus(): void {
    const { date, options, focused } = this.widget.day;
    if (focused && options.isSelectable(date) && !this.focus.hasPrimaryFocus)
      this.focus.requestFocus();
  }
  override initState(): void {
    super.initState();
    this.requestFocus();
  }
  override didUpdateWidget(old: RangeDay): void {
    super.didUpdateWidget(old);
    if (!old.day.focused && this.widget.day.focused) this.requestFocus();
  }

  override build(context: BuildContext): Widget {
    const { date, options, focused, onFocus } = this.widget.day;
    const { start, end, today, calendar, localization } = options;
    const enabled = options.isSelectable(date);
    const selectedStart = calendar.isSameDay(date, start),
      selectedEnd = calendar.isSameDay(date, end);
    const selected = selectedStart || selectedEnd;
    const isToday = calendar.isSameDay(date, today);
    const inside = !!(start && end && date.isAfter(start) && date.isBefore(end));
    let highlight: RangeHighlight | null = inside ? 'full' : null;
    if (start && end && !calendar.isSameDay(start, end)) {
      if (selectedStart) highlight = 'trailing';
      if (selectedEnd) highlight = 'leading';
    }
    const theme = Theme.of(context);
    const pickerTheme = DatePickerTheme.of(context),
      defaults = DatePickerTheme.defaults(context);
    const colors = theme.colorScheme;
    const states = emptyWidgetStateSet();
    if (!enabled) states.add(WidgetState.disabled);
    if (selected) states.add(WidgetState.selected);
    if (focused && enabled) states.add(WidgetState.focused);
    const shape =
      pickerTheme.dayShape?.resolve(states) ?? defaults.dayShape?.resolve(states) ?? dayCircle;
    const foreground = selected
      ? (pickerTheme.dayForegroundColor?.resolve(states) ??
        defaults.dayForegroundColor?.resolve(states))
      : !enabled
        ? new Color(colors.onSurface).withOpacity(0.38)
        : isToday
          ? new Color(colors.primary)
          : new Color(colors.onSurface);
    const background = selected
      ? (pickerTheme.dayBackgroundColor?.resolve(states) ??
        defaults.dayBackgroundColor?.resolve(states))
      : null;
    const todayBorder = pickerTheme.todayBorder ?? defaults.todayBorder;
    const side =
      enabled && !selected && isToday ? todayBorder?.copyWith({ color: colors.primary }) : null;
    const highlightColor =
      pickerTheme.rangeSelectionBackgroundColor ?? defaults.rangeSelectionBackgroundColor;
    const number = localization.formatDecimal(date.day);
    const todayText = isToday ? ', ' + localization.dateRangeLabel('currentDateLabel') : '';
    let label = number + ', ' + calendar.formatFullDate(date, localization) + todayText;
    if (selectedStart)
      label = localization.dateRangeLabel('dateRangeStartDateSemanticLabel', label);
    else if (selectedEnd)
      label = localization.dateRangeLabel('dateRangeEndDateSemanticLabel', label);
    const style = (theme.textTheme.bodyMedium ?? new TextStyle()).copyWith({
      color: foreground?.toARGB32() ?? colors.onSurface,
    });
    let child: Widget = new Center(new ExcludeSemantics(new Text(number, { style })));
    if (selected || side)
      child = new DecoratedBox(child, {
        decoration: new ColorShapeDecoration(
          side ? shape.copyWith({ side }) : shape,
          background ?? null,
        ),
      });
    if (highlightColor && highlight)
      child = new CustomPaint(child, {
        painter: new HighlightPainter(
          highlightColor,
          highlight,
          Directionality.of(context) === 'rtl',
        ),
      });
    child = new Semantics({ label, selected, enabled, child });
    if (!enabled) return child;
    return new InkResponse({
      child,
      focusNode: this.focus,
      onTap: () => options.onSelect(date),
      customBorder: shape,
      containedInkWell: true,
      overlayColor: colorProperty((states) =>
        inside
          ? (pickerTheme.rangeSelectionOverlayColor?.resolve(states) ??
            defaults.rangeSelectionOverlayColor?.resolve(states) ??
            null)
          : (pickerTheme.dayOverlayColor?.resolve(states) ??
            defaults.dayOverlayColor?.resolve(states) ??
            null),
      ),
      onFocusChange: (hasFocus) => {
        if (hasFocus) onFocus();
      },
    });
  }

  override dispose(): void {
    this.focus.dispose();
    super.dispose();
  }
}
