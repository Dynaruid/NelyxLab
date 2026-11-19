// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Behavior reference: Flutter 71e4717a61786faab4c7aa39825989305ed29e8a, cupertino/date_picker.dart.
import { invariant } from '@nelyx/core/foundation/errors';
import { Alignment, AlignmentDirectional } from '@nelyx/core/framework/painting/alignment';
import type { AlignmentGeometry } from '@nelyx/core/framework/painting/alignment';
import { EdgeInsetsDirectional } from '@nelyx/core/framework/painting/edge-insets';
import { TextStyle } from '@nelyx/core/framework/painting/text-style';
import { Directionality, MediaQuery } from '@nelyx/core/framework/widgets/app-data';
import {
  Align,
  Baseline,
  ColoredBox,
  Expanded,
  Padding,
  Positioned,
  Row,
  SizedBox,
  Stack,
  Text,
} from '@nelyx/core/framework/widgets/basic';
import { DefaultTextStyle } from '@nelyx/core/framework/widgets/default-text-style';
import { State, StatefulWidget } from '@nelyx/core/framework/widgets/framework';
import type { BuildContext, Widget, WidgetOptions } from '@nelyx/core/framework/widgets/framework';
import { LayoutBuilder } from '@nelyx/core/framework/widgets/layout-builder';
import { NotificationListener } from '@nelyx/core/framework/widgets/notification-listener';
import { IgnorePointer } from '@nelyx/core/framework/widgets/pointer-blocking';
import { ScrollEndNotification } from '@nelyx/core/framework/widgets/scroll-notification';
import { Semantics } from '@nelyx/core/framework/widgets/semantics';
import { FontWeight } from '@nelyx/core/ui/typography';
import { resolveCupertinoColor } from './internal/colors/color-values.ts';
import type { CupertinoColor } from './internal/colors/color-values.ts';
import { CupertinoLocalizations } from './cupertino-localizations.ts';
import type { SelectionOverlayBuilder } from './date-picker.ts';
import {
  ChangeReportingBehavior,
  CupertinoPicker,
  CupertinoPickerDefaultSelectionOverlay,
  FixedExtentScrollController,
} from './picker.ts';
import { CupertinoTheme } from './theme.ts';
import { measurePickerText, observePickerFonts } from './internal/picker-text-metrics.ts';
import type { PickerTextMetrics } from './internal/picker-text-metrics.ts';

export enum CupertinoTimerPickerMode {
  hm = 'hm',
  ms = 'ms',
  hms = 'hms',
}

export type CupertinoTimerPickerSelectionOverlayBuilder = SelectionOverlayBuilder;

export interface CupertinoTimerPickerOptions extends WidgetOptions {
  readonly mode?: CupertinoTimerPickerMode;
  /** Initial countdown duration in milliseconds. Used only when the picker mounts. */
  readonly initialTimerDuration?: number;
  readonly minuteInterval?: number;
  readonly secondInterval?: number;
  readonly alignment?: AlignmentGeometry;
  readonly backgroundColor?: CupertinoColor | null;
  readonly itemExtent?: number;
  /** Receives the selected duration in milliseconds, with whole-second precision. */
  readonly onTimerDurationChanged: (duration: number) => void;
  readonly changeReportingBehavior?: ChangeReportingBehavior;
  readonly selectionOverlayBuilder?: CupertinoTimerPickerSelectionOverlayBuilder | null;
}

export class CupertinoTimerPicker extends StatefulWidget {
  readonly mode: CupertinoTimerPickerMode;
  readonly initialTimerDuration: number;
  readonly minuteInterval: number;
  readonly secondInterval: number;
  readonly alignment: AlignmentGeometry;
  readonly backgroundColor: CupertinoColor | null;
  readonly itemExtent: number;
  readonly onTimerDurationChanged: CupertinoTimerPickerOptions['onTimerDurationChanged'];
  readonly changeReportingBehavior: ChangeReportingBehavior;
  readonly selectionOverlayBuilder: CupertinoTimerPickerSelectionOverlayBuilder | null;

  constructor({
    key = null,
    mode = CupertinoTimerPickerMode.hms,
    initialTimerDuration = 0,
    minuteInterval = 1,
    secondInterval = 1,
    alignment = Alignment.center,
    backgroundColor = null,
    itemExtent = 32,
    onTimerDurationChanged,
    changeReportingBehavior = ChangeReportingBehavior.onScrollUpdate,
    selectionOverlayBuilder = null,
  }: CupertinoTimerPickerOptions) {
    super(key);
    invariant(
      Object.values(CupertinoTimerPickerMode).includes(mode),
      'invalid-cupertino-timer-mode',
      'CupertinoTimerPicker requires hm, ms or hms mode',
    );
    invariant(
      Number.isFinite(initialTimerDuration) &&
        initialTimerDuration >= 0 &&
        initialTimerDuration < 86_400_000,
      'invalid-cupertino-timer-duration',
      'CupertinoTimerPicker requires an initial duration in [0, 86400000) milliseconds',
    );
    for (const [interval, duration] of [
      [minuteInterval, Math.floor(initialTimerDuration / 60_000)],
      [secondInterval, Math.floor(initialTimerDuration / 1000)],
    ] as const) {
      invariant(
        Number.isInteger(interval) &&
          interval > 0 &&
          60 % interval === 0 &&
          duration % interval === 0,
        'invalid-cupertino-timer-interval',
        'CupertinoTimerPicker intervals must divide 60 and align with the initial duration',
      );
    }
    invariant(
      Number.isFinite(itemExtent) && itemExtent > 0,
      'invalid-cupertino-timer-item-extent',
      'CupertinoTimerPicker requires a finite positive item extent',
    );
    this.mode = mode;
    this.initialTimerDuration = initialTimerDuration;
    this.minuteInterval = minuteInterval;
    this.secondInterval = secondInterval;
    this.alignment = alignment;
    this.backgroundColor = backgroundColor;
    this.itemExtent = itemExtent;
    this.onTimerDurationChanged = onTimerDurationChanged;
    this.changeReportingBehavior = changeReportingBehavior;
    this.selectionOverlayBuilder = selectionOverlayBuilder;
  }

  override createState(): State<CupertinoTimerPicker> {
    return new TimerPickerState();
  }
}

type Unit = 'hour' | 'minute' | 'second';

const unitFormat = {
  hour: { value: 'timerPickerHour', label: 'timerPickerHourLabel' },
  minute: { value: 'timerPickerMinute', label: 'timerPickerMinuteLabel' },
  second: { value: 'timerPickerSecond', label: 'timerPickerSecondLabel' },
} as const;
const unitLabelSpacing = 6;
const minHorizontalPadding = 30;
const halfColumnPadding = 4;
const columnIntrinsicWidth = 106;

interface TimerTextMetrics {
  readonly number: PickerTextMetrics;
  readonly labels: Readonly<Record<Unit, number>>;
  readonly style: TextStyle;
}

class TimerPickerState extends State<CupertinoTimerPicker> {
  private columns: readonly Unit[] = [];
  private readonly selected: Record<Unit, number> = { hour: 0, minute: 0, second: 0 };
  private readonly settled: Record<Unit, number> = { hour: 0, minute: 0, second: 0 };
  private textMetrics: TimerTextMetrics | null = null;
  private removeFontListener: (() => void) | undefined;
  private readonly controllers = new Map<Unit, FixedExtentScrollController>();

  override initState(): void {
    super.initState();
    this.removeFontListener = observePickerFonts(this.context, () => {
      if (this.mounted)
        this.setState(() => {
          this.textMetrics = null;
        });
    });
    const { mode, initialTimerDuration } = this.widget;
    this.columns =
      mode === CupertinoTimerPickerMode.hm
        ? ['hour', 'minute']
        : mode === CupertinoTimerPickerMode.ms
          ? ['minute', 'second']
          : ['hour', 'minute', 'second'];
    if (mode !== CupertinoTimerPickerMode.ms)
      this.selected.hour = Math.floor(initialTimerDuration / 3_600_000);
    this.selected.minute = Math.floor(initialTimerDuration / 60_000) % 60;
    if (mode !== CupertinoTimerPickerMode.hm)
      this.selected.second = Math.floor(initialTimerDuration / 1000) % 60;
    Object.assign(this.settled, this.selected);
    for (const unit of this.columns) {
      this.controllers.set(
        unit,
        new FixedExtentScrollController({
          initialItem: this.selected[unit] / this.interval(unit),
        }),
      );
    }
  }

  override didChangeDependencies(): void {
    super.didChangeDependencies();
    this.textMetrics = null;
  }

  private measureText(
    context: BuildContext,
    strings: CupertinoLocalizations,
    rtl: boolean,
    base: TextStyle,
  ): TimerTextMetrics {
    const style = base.copyWith({ fontSize: ((base.fontSize ?? 21) * 34) / 32 });
    return measurePickerText(context, style, rtl ? 'rtl' : 'ltr', (measure) => {
      let digit = strings.timerPickerHour(0);
      for (let value = 1; value <= 9; value++) {
        const next = strings.timerPickerHour(value);
        if (measure(next).width > measure(digit).width) digit = next;
      }
      const labels: Record<Unit, number> = { hour: 0, minute: 0, second: 0 };
      for (const unit of this.columns)
        for (let value = 0; value < (unit === 'hour' ? 24 : 60); value++)
          labels[unit] = Math.max(
            labels[unit],
            measure(strings[unitFormat[unit].label](value)).width,
          );
      return { number: measure(digit + digit), labels, style };
    });
  }

  override didUpdateWidget(oldWidget: CupertinoTimerPicker): void {
    super.didUpdateWidget(oldWidget);
    invariant(
      oldWidget.mode === this.widget.mode,
      'changed-cupertino-timer-mode',
      'Give CupertinoTimerPicker a new key to change its mode',
    );
  }

  private interval(unit: Unit): number {
    if (unit === 'hour') return 1;
    return unit === 'minute' ? this.widget.minuteInterval : this.widget.secondInterval;
  }

  private report(unit: Unit, value: number): void {
    this.selected[unit] = value;
    const { hour, minute, second } = this.selected;
    this.widget.onTimerDurationChanged(((hour * 60 + minute) * 60 + second) * 1000);
  }

  private buildColumn(
    context: BuildContext,
    unit: Unit,
    index: number,
    width: number,
    rtl: boolean,
    metrics: TimerTextMetrics,
    strings: CupertinoLocalizations,
  ): Widget {
    const picker = this.widget;
    const count = this.columns.length;
    const step = this.interval(unit);
    const numberWidth = Math.min(width, metrics.number.width);
    const unused = Math.max(0, width - numberWidth - unitLabelSpacing - metrics.labels[unit]);
    let leading: number;
    if (count === 3)
      leading =
        index === 0
          ? Math.min(unused, minHorizontalPadding)
          : index === 1
            ? unused / 2
            : Math.max(0, unused - minHorizontalPadding);
    else {
      const outside = Math.min(unused, Math.max(minHorizontalPadding, unused - halfColumnPadding));
      leading = index === 0 ? outside : unused - outside;
    }
    const labelStart = leading + numberWidth + unitLabelSpacing;
    const axis =
      width === 0 ? 0 : (index - ((count - 1) * (leading + numberWidth / 2)) / width) / count;
    const overlay =
      picker.selectionOverlayBuilder === null
        ? new CupertinoPickerDefaultSelectionOverlay({
            capStartEdge: index === 0,
            capEndEdge: index === count - 1,
          })
        : picker.selectionOverlayBuilder(context, { selectedIndex: index, columnCount: count });
    const format = unitFormat[unit];
    const wheel = new CupertinoPicker({
      scrollController: this.controllers.get(unit)!,
      itemExtent: picker.itemExtent,
      offAxisFraction: rtl ? -axis : axis,
      squeeze: 1.25,
      magnification: 2.35 / 2.1,
      looping: unit !== 'hour',
      changeReportingBehavior: picker.changeReportingBehavior,
      selectionOverlay: overlay,
      onSelectedItemChanged: (item) => this.report(unit, item * step),
      children: Array.from({ length: unit === 'hour' ? 24 : 60 / step }, (_, item) => {
        const value = item * step;
        const number = strings[format.value](value);
        const label = strings[format.label](value);
        return new Semantics({
          label: rtl ? `${label} ${number}` : `${number} ${label}`,
          excludeSemantics: true,
          child: new Padding(
            EdgeInsetsDirectional.only({ start: leading }),
            new Align(
              new SizedBox(
                numberWidth,
                undefined,
                new Align(
                  new Text(number, {
                    maxLines: 1,
                    softWrap: false,
                    style: metrics.style,
                    overflow: 'visible',
                  }),
                  { alignment: AlignmentDirectional.centerEnd },
                ),
              ),
              { alignment: AlignmentDirectional.centerStart },
            ),
          ),
        });
      }),
    });
    const scrollable = new NotificationListener({
      notificationType: ScrollEndNotification,
      onNotification: (notification) => {
        if (notification.depth === 0 && this.settled[unit] !== this.selected[unit]) {
          this.setState(() => {
            this.settled[unit] = this.selected[unit];
          });
        }
        return false;
      },
      child: wheel,
    });
    return new Expanded(
      new Stack([
        Positioned.fill(scrollable),
        Positioned.fill(
          new IgnorePointer(
            new Semantics({
              excludeSemantics: true,
              child: new Padding(
                EdgeInsetsDirectional.only({ start: labelStart }),
                new Align(
                  new SizedBox(
                    undefined,
                    metrics.number.height,
                    new Baseline(
                      new Text(strings[format.label](this.settled[unit]), {
                        maxLines: 1,
                        softWrap: false,
                        style: new TextStyle({ fontSize: 17, fontWeight: FontWeight.w600 }),
                      }),
                      { baseline: metrics.number.baseline, baselineType: 'alphabetic' },
                    ),
                  ),
                  { alignment: AlignmentDirectional.centerStart },
                ),
              ),
            }),
          ),
        ),
      ]),
    );
  }

  override build(context: BuildContext): Widget {
    const rtl = Directionality.of(context) === 'rtl';
    const strings = CupertinoLocalizations.of(context);
    const style = CupertinoTheme.of(context).textTheme.pickerTextStyle;
    const metrics = (this.textMetrics ??= this.measureText(context, strings, rtl, style));
    return new LayoutBuilder((context, constraints) => {
      const idealWidth =
        this.columns.length === 3 ? (columnIntrinsicWidth + 2 * halfColumnPadding) * 3 : 320;
      const width = Math.min(idealWidth, constraints.maxWidth);
      const row = new SizedBox(
        width,
        216,
        new DefaultTextStyle(
          style,
          new Row(
            this.columns.map((unit, index) =>
              this.buildColumn(
                context,
                unit,
                index,
                width / this.columns.length,
                rtl,
                metrics,
                strings,
              ),
            ),
            { crossAlign: 'stretch' },
          ),
        ),
      );
      const { backgroundColor, alignment } = this.widget;
      const content =
        backgroundColor === null
          ? row
          : new ColoredBox({
              color: resolveCupertinoColor(backgroundColor, context).toARGB32(),
              child: row,
            });
      return MediaQuery.withNoTextScaling({ child: new Align(content, { alignment }) });
    });
  }

  override dispose(): void {
    this.removeFontListener?.();
    for (const controller of this.controllers.values()) controller.dispose();
    super.dispose();
  }
}
