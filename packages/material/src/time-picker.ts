// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
import { invariant } from '@nelyx/core/foundation/errors';
import { BorderRadius } from '@nelyx/core/framework/painting/border-radius';
import { OutlinedBorder } from '@nelyx/core/framework/painting/borders';
import { EdgeInsets } from '@nelyx/core/framework/painting/edge-insets';
import { RoundedRectangleBorder } from '@nelyx/core/framework/painting/rounded-rectangle-border';
import { TextStyle } from '@nelyx/core/framework/painting/text-style';
import { BoxConstraints } from '@nelyx/core/framework/rendering/constraints';
import { CustomPainter } from '@nelyx/core/framework/rendering/custom-paint';
import { HitTestBehavior } from '@nelyx/core/framework/rendering/pointer-listener';
import { MediaQuery } from '@nelyx/core/framework/widgets/app-data';
import {
  Center,
  Column,
  ConstrainedBox,
  Expanded,
  Flexible,
  Padding,
  Positioned,
  Row,
  SizedBox,
  Stack,
  Text,
} from '@nelyx/core/framework/widgets/basic';
import { CustomPaint } from '@nelyx/core/framework/widgets/custom-paint';
import { showDialog } from '@nelyx/core/framework/widgets/dialog';
import { TextEditingController } from '@nelyx/core/framework/widgets/editable-text';
import { FocusNode } from '@nelyx/core/framework/widgets/focus';
import { StatelessWidget, StatefulWidget } from '@nelyx/core/framework/widgets/framework';
import type {
  BuildContext,
  State,
  Widget,
  WidgetOptions,
} from '@nelyx/core/framework/widgets/framework';
import { GestureDetector } from '@nelyx/core/framework/widgets/gesture-detector';
import { Icon } from '@nelyx/core/framework/widgets/icon';
import { LayoutBuilder } from '@nelyx/core/framework/widgets/layout-builder';
import { Navigator } from '@nelyx/core/framework/widgets/navigation';
import type { Orientation } from '@nelyx/core/framework/widgets/orientation-builder';
import type { RouteSettings } from '@nelyx/core/framework/widgets/pages';
import {
  RestorableBool,
  RestorableValue,
  RestorationMixin,
} from '@nelyx/core/framework/widgets/restoration';
import { ListView } from '@nelyx/core/framework/widgets/scroll-view';
import { ExcludeSemantics, Semantics } from '@nelyx/core/framework/widgets/semantics';
import {
  emptyWidgetStateSet,
  WidgetState,
  WidgetStateColor,
} from '@nelyx/core/framework/widgets/widget-state';
import type { Canvas } from '@nelyx/core/ui/canvas';
import { Color } from '@nelyx/core/ui/color';
import type { Offset, Size } from '@nelyx/core/ui/geometry';
import { Paint } from '@nelyx/core/ui/paint';
import { SemanticsRole } from '@nelyx/core/ui/semantics';
import { Size as SourceSize } from '@nelyx/core/ui/size';
import { IconButton } from './icon-button.ts';
import { Icons } from './icons.ts';
import { InputDecoration } from './input-decoration.ts';
import { InputDecorationTheme } from './input-decoration-theme.ts';
import { Material } from './material.ts';
import { MaterialLocalizations } from './material-localizations.ts';
import { TextButton } from './text-button.ts';
import { TextField } from './text-field.ts';
import { Theme } from './theme.ts';
import type { ColorScheme } from './color-scheme.ts';
import {
  DayPeriod,
  HourFormat,
  RestorableTimeOfDay,
  TimeOfDay,
  TimeOfDayFormat,
  hourFormat,
} from './time.ts';
import { TimePickerTheme } from './time-picker-theme.ts';
import type { TimePickerThemeData } from './time-picker-theme-data.ts';

export {
  DayPeriod,
  TimeOfDay,
  RestorableTimeOfDay,
  TimeOfDayFormat,
  HourFormat,
  hourFormat,
} from './time.ts';
export type { TimeOfDayOptions } from './time.ts';

export enum TimePickerEntryMode {
  dial = 'dial',
  input = 'input',
  dialOnly = 'dialOnly',
  inputOnly = 'inputOnly',
}

export type EntryModeChangeCallback = (mode: TimePickerEntryMode) => void;

export interface TimePickerDialogOptions extends WidgetOptions {
  readonly initialTime: TimeOfDay;
  readonly initialEntryMode?: TimePickerEntryMode;
  readonly cancelText?: string | null;
  readonly confirmText?: string | null;
  readonly helpText?: string | null;
  readonly errorInvalidText?: string | null;
  readonly hourLabelText?: string | null;
  readonly minuteLabelText?: string | null;
  readonly restorationId?: string | null;
  readonly orientation?: Orientation | null;
  readonly onEntryModeChanged?: EntryModeChangeCallback | null;
  readonly switchToInputEntryModeIcon?: Icon | null;
  readonly switchToTimerEntryModeIcon?: Icon | null;
  readonly emptyInitialInput?: boolean;
}

export interface ShowTimePickerOptions extends Omit<
  TimePickerDialogOptions,
  'key' | 'restorationId'
> {
  readonly context: BuildContext;
  readonly builder?: (context: BuildContext, child: Widget) => Widget;
  readonly barrierDismissible?: boolean;
  readonly barrierColor?: Color | null;
  readonly barrierLabel?: string | null;
  readonly useRootNavigator?: boolean;
  readonly routeSettings?: RouteSettings;
}

export async function showTimePicker({
  context,
  builder,
  barrierDismissible = true,
  barrierColor,
  barrierLabel,
  useRootNavigator = true,
  routeSettings,
  ...options
}: ShowTimePickerOptions): Promise<TimeOfDay | null> {
  const dialog = new TimePickerDialog(options);
  const result = await showDialog<TimeOfDay>(context, {
    name: 'time-picker',
    ...(routeSettings === undefined ? {} : { routeSettings }),
    barrierDismissible,
    ...(barrierColor == null ? {} : { barrierColor: barrierColor.toARGB32() }),
    barrierLabel: barrierLabel ?? MaterialLocalizations.of(context).modalBarrierDismissLabel,
    useRootNavigator,
    builder: (routeContext) => builder?.(routeContext, dialog) ?? dialog,
  });
  return result ?? null;
}

export class TimePickerDialog extends StatefulWidget {
  readonly options: Readonly<TimePickerDialogOptions>;
  readonly initialEntryMode: TimePickerEntryMode;

  constructor(options: TimePickerDialogOptions) {
    super(options.key ?? null);
    const mode = options.initialEntryMode ?? TimePickerEntryMode.dial;
    invariant(
      options.initialTime instanceof TimeOfDay,
      'invalid-time-picker',
      'TimePickerDialog requires a TimeOfDay',
    );
    invariant(
      Object.values(TimePickerEntryMode).includes(mode),
      'invalid-time-picker-mode',
      'Unknown time picker entry mode',
    );
    this.initialEntryMode = mode;
    this.options = Object.freeze({ ...options });
  }

  override createState(): State<TimePickerDialog> {
    return new TimePickerDialogState();
  }
}

type TimePart = 'hour' | 'minute';
const timeParts = ['hour', 'minute'] as const;
const twoPi = 2 * Math.PI;
const dialogShape = new RoundedRectangleBorder({ borderRadius: BorderRadius.circular(28) });
const controlShape = new RoundedRectangleBorder({ borderRadius: BorderRadius.circular(8) });
const textSize = new TextStyle({ fontSize: 45 });

function inputMode(mode: TimePickerEntryMode): boolean {
  return mode === TimePickerEntryMode.input || mode === TimePickerEntryMode.inputOnly;
}

function selectedColor(color: Color | null, selected: boolean, fallback: number): Color {
  const states = emptyWidgetStateSet();
  if (selected) states.add(WidgetState.selected);
  return (color instanceof WidgetStateColor ? color.resolve(states) : color) ?? new Color(fallback);
}

class TimePickerDialogState extends RestorationMixin<TimePickerDialog> {
  private selected!: RestorableTimeOfDay;
  private mode!: RestorableValue<TimePickerEntryMode>;
  private readonly part = new RestorableValue<TimePart>('hour', (value) => {
    invariant(
      value === 'hour' || value === 'minute',
      'invalid-time-picker-part',
      'Unknown time picker field',
    );
    return value;
  });
  private readonly attemptedSubmit = new RestorableBool(false);
  private readonly hourDraft = this.createDraft();
  private readonly minuteDraft = this.createDraft();
  private readonly fields = {
    hour: new TextEditingController(),
    minute: new TextEditingController(),
  };
  private readonly focus = {
    hour: new FocusNode({ debugLabel: 'Time picker hour' }),
    minute: new FocusNode({ debugLabel: 'Time picker minute' }),
  };

  private createDraft(): RestorableValue<string | null> {
    return new RestorableValue<string | null>(null, (value) => {
      invariant(
        value === null || (typeof value === 'string' && value.length <= 2),
        'invalid-time-draft',
        'Time picker draft requires at most two characters',
      );
      return value;
    });
  }

  override initState(): void {
    super.initState();
    this.selected = new RestorableTimeOfDay(this.widget.options.initialTime);
    this.mode = new RestorableValue(this.widget.initialEntryMode, (value) => {
      invariant(
        Object.values(TimePickerEntryMode).some((mode) => mode === value),
        'invalid-time-picker-mode',
        'Unknown time picker entry mode',
      );
      return value as TimePickerEntryMode;
    });
  }

  override get restorationId(): string | null {
    return this.widget.options.restorationId ?? null;
  }

  override restoreState(): void {
    this.registerForRestoration(this.selected, 'selected_time');
    this.registerForRestoration(this.mode, 'entry_mode');
    this.registerForRestoration(this.part, 'hour_minute_mode');
    this.registerForRestoration(this.attemptedSubmit, 'attempted_submit');
    this.registerForRestoration(this.hourDraft, 'hour_draft');
    this.registerForRestoration(this.minuteDraft, 'minute_draft');
    this.syncDrafts();
  }

  private syncDrafts(): void {
    const hour = this.hourDraft.value ?? '';
    const minute = this.minuteDraft.value ?? '';
    if (this.fields.hour.text !== hour) this.fields.hour.text = hour;
    if (this.fields.minute.text !== minute) this.fields.minute.text = minute;
  }

  private formatOptions(context: BuildContext) {
    return { alwaysUse24HourFormat: MediaQuery.alwaysUse24HourFormatOf(context) };
  }

  private setupInput(context: BuildContext, localization: MaterialLocalizations): void {
    const empty = this.widget.options.emptyInitialInput === true;
    this.hourDraft.value = empty
      ? ''
      : localization.formatHour(this.selected.value, this.formatOptions(context));
    this.minuteDraft.value = empty ? '' : localization.formatMinute(this.selected.value);
    this.syncDrafts();
  }

  override didChangeDependencies(): void {
    super.didChangeDependencies();
    if (inputMode(this.mode.value) && this.hourDraft.value === null)
      this.setupInput(this.context, MaterialLocalizations.of(this.context));
  }

  override dispose(): void {
    super.dispose();
    for (const property of [
      this.selected,
      this.mode,
      this.part,
      this.attemptedSubmit,
      this.hourDraft,
      this.minuteDraft,
    ])
      property.dispose();
    for (const field of timeParts) {
      this.fields[field].dispose();
      this.focus[field].dispose();
    }
  }

  private parseDrafts(localization: MaterialLocalizations, use24Hours: boolean) {
    const hour = localization.parseTimePickerNumber(this.fields.hour.text);
    const minute = localization.parseTimePickerNumber(this.fields.minute.text);
    const validHour =
      hour !== null && (use24Hours ? hour >= 0 && hour < 24 : hour >= 1 && hour <= 12);
    return {
      hour: validHour ? (use24Hours ? hour : (hour % 12) + this.selected.value.periodOffset) : null,
      minute: minute !== null && minute < 60 ? minute : null,
    };
  }

  private switchMode(
    context: BuildContext,
    localization: MaterialLocalizations,
    use24Hours: boolean,
  ): void {
    const before = this.mode.value;
    if (before !== TimePickerEntryMode.dial && before !== TimePickerEntryMode.input) return;
    const mode =
      before === TimePickerEntryMode.dial ? TimePickerEntryMode.input : TimePickerEntryMode.dial;
    this.setState(() => {
      if (mode === TimePickerEntryMode.input) {
        this.setupInput(context, localization);
        this.attemptedSubmit.value = false;
      } else {
        this.selected.value = this.selected.value.replacing(
          this.parseDrafts(localization, use24Hours),
        );
      }
      this.mode.value = mode;
    });
    this.widget.options.onEntryModeChanged?.(mode);
  }

  private confirm(
    context: BuildContext,
    localization: MaterialLocalizations,
    use24Hours: boolean,
  ): void {
    if (inputMode(this.mode.value)) {
      const time = this.parseDrafts(localization, use24Hours);
      if (time.hour === null || time.minute === null) {
        this.setState(() => {
          this.attemptedSubmit.value = true;
        });
        return;
      }
      this.selected.value = new TimeOfDay({ hour: time.hour, minute: time.minute });
    }
    void Navigator.of(context).pop(this.selected.value);
  }

  private selectDial(next: TimeOfDay | null, choose: boolean): void {
    this.setState(() => {
      if (next) this.selected.value = next;
      if (choose && this.part.value === 'hour') this.part.value = 'minute';
    });
  }

  private dayPeriods(
    localization: MaterialLocalizations,
    theme: TimePickerThemeData,
    colors: ColorScheme,
    vertical: boolean,
  ): Widget {
    const time = this.selected.value;
    const buttons = [DayPeriod.am, DayPeriod.pm].map((period) => {
      const selected = time.period === period;
      const label =
        period === DayPeriod.am
          ? localization.anteMeridiemAbbreviation
          : localization.postMeridiemAbbreviation;
      return new Semantics({
        selected,
        child: new TextButton({
          child: new Text(label),
          style: TextButton.styleFrom({
            shape: theme.dayPeriodShape ?? controlShape,
            side: theme.dayPeriodBorderSide,
            foregroundColor: selectedColor(
              theme.dayPeriodTextColor,
              selected,
              selected ? colors.onTertiaryContainer : colors.onSurfaceVariant,
            ),
            backgroundColor: selectedColor(
              theme.dayPeriodColor,
              selected,
              selected ? colors.tertiaryContainer : colors.surfaceContainerHigh,
            ),
            textStyle: theme.dayPeriodTextStyle,
          }),
          onPressed: () =>
            this.setState(() => {
              this.selected.value = time.replacing({
                hour: (time.hour % 12) + (period === DayPeriod.am ? 0 : 12),
              });
            }),
        }),
      });
    });
    return vertical
      ? new Column(buttons, { mainSize: 'min' })
      : new Row(buttons, { mainSize: 'min' });
  }

  private headerField(
    part: TimePart,
    context: BuildContext,
    localization: MaterialLocalizations,
    theme: TimePickerThemeData,
    colors: ColorScheme,
    use24Hours: boolean,
  ): Widget {
    const options = this.widget.options;
    const time = this.selected.value;
    const hour = part === 'hour';
    const label = hour
      ? (options.hourLabelText ?? localization.timePickerHourLabel)
      : (options.minuteLabelText ?? localization.timePickerMinuteLabel);
    if (inputMode(this.mode.value)) {
      const invalid =
        this.attemptedSubmit.value && this.parseDrafts(localization, use24Hours)[part] === null;
      return new TextField({
        id: 'material-time-picker-' + part,
        controller: this.fields[part],
        focusNode: this.focus[part],
        decoration: new InputDecoration({
          labelText: label,
          errorText: invalid ? '' : null,
          counterText: '',
        }),
        keyboardType: 'number',
        textInputAction: hour ? 'next' : 'done',
        textAlign: 'center',
        textDirection: 'ltr',
        maxLength: 2,
        autocorrect: false,
        enableSuggestions: false,
        style: theme.hourMinuteTextStyle ?? textSize,
        onChanged: (value) => {
          this.setState(() => {
            (hour ? this.hourDraft : this.minuteDraft).value = value.slice(0, 2);
          });
        },
        onSubmitted: () =>
          hour ? this.focus.minute.requestFocus() : this.confirm(context, localization, use24Hours),
      });
    }
    const selected = this.part.value === part;
    const value = hour
      ? localization.formatHour(time, this.formatOptions(context))
      : localization.formatMinute(time);
    return new Semantics({
      selected,
      child: new TextButton({
        child: new Text(value),
        style: TextButton.styleFrom({
          foregroundColor: selectedColor(
            theme.hourMinuteTextColor,
            selected,
            selected ? colors.onPrimaryContainer : colors.onSurface,
          ),
          backgroundColor: selectedColor(
            theme.hourMinuteColor,
            selected,
            selected ? colors.primaryContainer : colors.surfaceContainerHighest,
          ),
          textStyle: theme.hourMinuteTextStyle ?? textSize,
          minimumSize: new SourceSize(0, 72),
          padding: EdgeInsets.symmetric({ horizontal: 4 }),
          shape:
            theme.hourMinuteShape instanceof OutlinedBorder ? theme.hourMinuteShape : controlShape,
        }),
        onPressed: () =>
          this.setState(() => {
            this.part.value = part;
          }),
      }),
    });
  }

  override build(context: BuildContext): Widget {
    const options = this.widget.options;
    const theme = TimePickerTheme.of(context);
    const colors = Theme.of(context).colorScheme;
    const localization = MaterialLocalizations.of(context);
    const format = localization.timeOfDayFormat(this.formatOptions(context));
    const use24Hours = hourFormat({ of: format }) !== HourFormat.h;
    const mode = this.mode.value;
    const input = inputMode(mode);
    const help =
      options.helpText ??
      (input ? localization.timePickerInputHelpText : localization.timePickerDialHelpText);
    const canSwitch = mode === TimePickerEntryMode.dial || mode === TimePickerEntryMode.input;
    const periodFirst = format === TimeOfDayFormat.a_space_h_colon_mm;
    const margin = MediaQuery.viewInsetsOf(context);
    const media = MediaQuery.of(context);
    return new LayoutBuilder((_context, constraints) => {
      const landscape =
        (options.orientation ?? (media.width > media.height ? 'landscape' : 'portrait')) ===
        'landscape';
      const wideDial = landscape && !input && constraints.maxWidth >= 528;
      const periods = use24Hours ? null : this.dayPeriods(localization, theme, colors, wideDial);
      const separator =
        format === TimeOfDayFormat.HH_dot_mm
          ? '.'
          : format === TimeOfDayFormat.frenchCanadian
            ? 'h'
            : ':';
      const states = emptyWidgetStateSet();
      const separatorColor =
        theme.timeSelectorSeparatorColor?.resolve(states)?.toARGB32() ?? colors.onSurface;
      const separatorStyle = (
        theme.timeSelectorSeparatorTextStyle?.resolve(states) ?? textSize
      ).copyWith({ color: separatorColor });
      let header: Widget = new Row(
        [
          new Expanded(this.headerField('hour', context, localization, theme, colors, use24Hours)),
          new Text(separator, { style: separatorStyle }),
          new Expanded(
            this.headerField('minute', context, localization, theme, colors, use24Hours),
          ),
        ],
        { spacing: 4 },
      );
      if (periods) {
        header = wideDial
          ? new Column(periodFirst ? [periods, header] : [header, periods], {
              mainSize: 'min',
              crossAlign: 'stretch',
            })
          : new Column([header, periods], { mainSize: 'min', crossAlign: 'stretch' });
      }
      if (input && theme.inputDecorationTheme)
        header = new InputDecorationTheme(theme.inputDecorationTheme, header);
      let body = header;
      if (!input) {
        const dial = new TimeDial({
          time: this.selected.value,
          part: this.part.value,
          use24Hours,
          colors,
          theme,
          localization,
          onSelected: (time, choose) => this.selectDial(time, choose),
        });
        body = wideDial
          ? new Row([new Expanded(header), new Flexible(dial)], { spacing: 16 })
          : new Column([header, dial], { mainSize: 'min', spacing: 16, crossAlign: 'stretch' });
      }
      const children = [
        new Text(help, {
          style:
            theme.helpTextStyle ?? new TextStyle({ fontSize: 14, color: colors.onSurfaceVariant }),
        }),
        body,
      ];
      const parsed = input ? this.parseDrafts(localization, use24Hours) : null;
      if (parsed && this.attemptedSubmit.value && (parsed.hour === null || parsed.minute === null))
        children.push(
          new Semantics({
            liveRegion: true,
            child: new Text(options.errorInvalidText ?? localization.invalidTimeLabel, {
              color: colors.error,
            }),
          }),
        );
      children.push(
        new Row(
          [
            ...(canSwitch
              ? [
                  new IconButton({
                    tooltip: input
                      ? localization.dialModeButtonLabel
                      : localization.inputTimeModeButtonLabel,
                    color: theme.entryModeIconColor,
                    icon: input
                      ? (options.switchToTimerEntryModeIcon ?? new Icon(Icons.access_time))
                      : (options.switchToInputEntryModeIcon ?? new Icon(Icons.keyboard_outlined)),
                    onPressed: () => this.switchMode(context, localization, use24Hours),
                  }),
                  new Expanded(new SizedBox()),
                ]
              : []),
            new TextButton({
              child: new Text(options.cancelText ?? localization.cancelButtonLabel),
              style: theme.cancelButtonStyle,
              onPressed: () => {
                void Navigator.of(context).pop();
              },
            }),
            new TextButton({
              child: new Text(options.confirmText ?? localization.okButtonLabel),
              style: theme.confirmButtonStyle,
              onPressed: () => this.confirm(context, localization, use24Hours),
            }),
          ],
          { mainAxisAlignment: 'end' },
        ),
      );
      return new Padding(
        EdgeInsets.fromLTRB(
          24 + margin.left,
          24 + margin.top,
          24 + margin.right,
          24 + margin.bottom,
        ),
        new ConstrainedBox(
          new Semantics({
            container: true,
            explicitChildNodes: true,
            role: SemanticsRole.dialog,
            label: help,
            child: new Material({
              color: theme.backgroundColor ?? new Color(colors.surfaceContainerHigh),
              elevation: theme.elevation ?? 6,
              shape: theme.shape ?? dialogShape,
              clipBehavior: 'antiAlias',
              child: new ListView({
                shrinkWrap: true,
                primary: false,
                children: [
                  new Padding(
                    theme.padding ?? EdgeInsets.all(24),
                    new Column(children, { mainSize: 'min', spacing: 12, crossAlign: 'stretch' }),
                  ),
                ],
              }),
            }),
          }),
          new BoxConstraints(0, wideDial ? 576 : 352),
        ),
      );
    });
  }
}

interface TimeDialOptions {
  readonly time: TimeOfDay;
  readonly part: TimePart;
  readonly use24Hours: boolean;
  readonly colors: ColorScheme;
  readonly theme: TimePickerThemeData;
  readonly localization: MaterialLocalizations;
  readonly onSelected: (value: TimeOfDay | null, choose: boolean) => void;
}

function pointOnDial(size: number, value: number, steps: number, radius: number): Offset {
  const angle = (twoPi * value) / steps;
  const center = size / 2;
  return { x: center + radius * Math.sin(angle), y: center - radius * Math.cos(angle) };
}

class TimeDial extends StatelessWidget {
  constructor(readonly options: TimeDialOptions) {
    super();
  }

  private updateAt(position: Offset, size: number, tapped: boolean): void {
    const { time, part, use24Hours, onSelected } = this.options;
    const horizontal = position.x - size / 2;
    const vertical = size / 2 - position.y;
    const fraction = ((Math.atan2(horizontal, vertical) + twoPi) % twoPi) / twoPi;
    if (part === 'hour') {
      const inner = Math.hypot(horizontal, vertical) < size / 2 - size * 0.184;
      const hour =
        (Math.round(fraction * 12) % 12) + (use24Hours ? (inner ? 12 : 0) : time.periodOffset);
      onSelected(time.replacing({ hour }), tapped);
    } else {
      const minute = Math.round(fraction * 60) % 60;
      onSelected(
        time.replacing({ minute: tapped ? (Math.floor((minute + 2) / 5) * 5) % 60 : minute }),
        tapped,
      );
    }
  }

  override build(): Widget {
    return new LayoutBuilder((_context, constraints) => {
      const diameter = Math.min(256, constraints.maxWidth);
      if (diameter <= 0) return new SizedBox();
      const { time, part, use24Hours, colors, theme, localization, onSelected } = this.options;
      const hours = part === 'hour';
      const selected = hours ? (use24Hours ? time.hour : time.hour % 12) : time.minute;
      const handle = pointOnDial(
        diameter,
        selected,
        hours ? 12 : 60,
        diameter * (hours && use24Hours && selected >= 12 ? 0.25 : 0.3828),
      );
      const labelCount = hours && use24Hours ? 24 : 12;
      const labels = Array.from({ length: labelCount }, (_, index) => {
        const value = hours ? index : index * 5;
        const inner = hours && use24Hours && value >= 12;
        const location = pointOnDial(diameter, index, 12, diameter * (inner ? 0.25 : 0.3828));
        const label = hours
          ? localization.timePickerNumber(
              use24Hours ? value : value || 12,
              use24Hours && value === 0 ? 2 : 1,
            )
          : localization.timePickerNumber(value, 2);
        const target = hours
          ? time.replacing({ hour: use24Hours ? value : value + time.periodOffset })
          : time.replacing({ minute: value });
        const active = value === selected;
        const font = theme.dialTextStyle ?? new TextStyle({ fontSize: 14 });
        return new Positioned(
          new Semantics({
            button: true,
            label,
            container: true,
            excludeSemantics: true,
            selected: active,
            onTap: () => onSelected(target, true),
            child: new Center(
              new Text(label, {
                style: font.copyWith({
                  color: selectedColor(
                    theme.dialTextColor,
                    active,
                    active ? colors.onPrimary : colors.onSurface,
                  ).toARGB32(),
                }),
              }),
            ),
          }),
          { left: location.x - 16, top: location.y - 16, width: 32, height: 32 },
        );
      });
      const painter = new DialFace(
        theme.dialBackgroundColor?.toARGB32() ?? colors.surfaceContainerHighest,
        theme.dialHandColor?.toARGB32() ?? colors.primary,
        handle,
      );
      return new Center(
        new SizedBox(
          diameter,
          diameter,
          new GestureDetector(
            new Stack([
              Positioned.fill(
                new ExcludeSemantics({ child: new CustomPaint(undefined, { painter }) }),
              ),
              ...labels,
            ]),
            {
              behavior: HitTestBehavior.opaque,
              excludeFromSemantics: true,
              onTapUp: (event) => this.updateAt(event.localPosition, diameter, true),
              onPanStart: (event) => this.updateAt(event.localPosition, diameter, false),
              onPanUpdate: (event) => this.updateAt(event.localPosition, diameter, false),
              onPanEnd: () => onSelected(null, true),
            },
          ),
        ),
      );
    });
  }
}

class DialFace extends CustomPainter {
  constructor(
    readonly background: number,
    readonly foreground: number,
    readonly end: Offset,
  ) {
    super();
  }
  override paint(canvas: Canvas, { width, height }: Size): void {
    const center = { x: width / 2, y: height / 2 };
    const hand = new Paint({ color: this.foreground });
    canvas.drawCircle(center, Math.min(width, height) / 2, new Paint({ color: this.background }));
    canvas.drawLine(center, this.end, new Paint({ color: this.foreground, strokeWidth: 2 }));
    canvas.drawCircle(center, 4, hand);
    canvas.drawCircle(this.end, Math.min(width, height) / 16, hand);
  }
  override shouldRepaint(old: CustomPainter): boolean {
    return (
      !(old instanceof DialFace) ||
      old.background !== this.background ||
      old.foreground !== this.foreground ||
      old.end.x !== this.end.x ||
      old.end.y !== this.end.y
    );
  }
}
