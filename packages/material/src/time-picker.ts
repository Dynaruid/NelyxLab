// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Adapted from packages/flutter/lib/src/material/time_picker.dart at
// 71e4717a61786faab4c7aa39825989305ed29e8a.
import type { Disposable } from '@nelyx/core/foundation/disposable';
import { invariant } from '@nelyx/core/foundation/errors';
import { FoundationPlatform } from '@nelyx/core/foundation/platform';
import { AnimationController } from '@nelyx/core/framework/animation/animation-controller';
import { Curves } from '@nelyx/core/framework/animation/curves';
import { AlignmentDirectional } from '@nelyx/core/framework/painting/alignment';
import { Axis } from '@nelyx/core/framework/painting/basic-types';
import { BorderRadius } from '@nelyx/core/framework/painting/border-radius';
import { BorderSide } from '@nelyx/core/framework/painting/borders';
import { BoxDecoration } from '@nelyx/core/framework/painting/box-decoration';
import { EdgeInsets } from '@nelyx/core/framework/painting/edge-insets';
import { RoundedRectangleBorder } from '@nelyx/core/framework/painting/rounded-rectangle-border';
import { TextScaler } from '@nelyx/core/framework/painting/text-scaler';
import { TextStyle } from '@nelyx/core/framework/painting/text-style';
import { CustomClipper } from '@nelyx/core/framework/rendering/clip';
import { CustomPainter } from '@nelyx/core/framework/rendering/custom-paint';
import { BoxConstraints } from '@nelyx/core/framework/rendering/constraints';
import { HitTestBehavior } from '@nelyx/core/framework/rendering/pointer-listener';
import { AnimatedSize } from '@nelyx/core/framework/widgets/animated-size';
import { MediaQuery } from '@nelyx/core/framework/widgets/app-data';
import {
  Align,
  Builder,
  Center,
  Column,
  ConstrainedBox,
  DecoratedBox,
  Expanded,
  Flexible,
  Padding,
  Positioned,
  Row,
  SizedBox,
  Stack,
  Text,
} from '@nelyx/core/framework/widgets/basic';
import { ClipPath } from '@nelyx/core/framework/widgets/clip';
import { CustomPaint } from '@nelyx/core/framework/widgets/custom-paint';
import { TextEditingController } from '@nelyx/core/framework/widgets/editable-text';
import { FocusNode } from '@nelyx/core/framework/widgets/focus';
import {
  SingleChildRenderObjectWidget,
  StatefulWidget,
} from '@nelyx/core/framework/widgets/framework';
import type {
  BuildContext,
  State,
  Widget,
  WidgetOptions,
} from '@nelyx/core/framework/widgets/framework';
import { GestureDetector } from '@nelyx/core/framework/widgets/gesture-detector';
import { Icon } from '@nelyx/core/framework/widgets/icon';
import { InheritedModel } from '@nelyx/core/framework/widgets/inherited-model';
import { LayoutBuilder } from '@nelyx/core/framework/widgets/layout-builder';
import { Navigator } from '@nelyx/core/framework/widgets/navigation';
import type { Orientation } from '@nelyx/core/framework/widgets/orientation-builder';
import { OverflowBar, OverflowBarAlignment } from '@nelyx/core/framework/widgets/overflow-bar';
import { RouteSettings } from '@nelyx/core/framework/widgets/pages';
import { IgnorePointer } from '@nelyx/core/framework/widgets/pointer-blocking';
import {
  RestorableBool,
  RestorableValue,
  RestorationMixin,
} from '@nelyx/core/framework/widgets/restoration';
import { SingleBoxScrollView } from '@nelyx/core/framework/widgets/scroll-view';
import { ExcludeSemantics, Semantics } from '@nelyx/core/framework/widgets/semantics';
import { SingleTickerProviderStateMixin } from '@nelyx/core/framework/widgets/ticker-provider';
import { AnimatedBuilder } from '@nelyx/core/framework/widgets/transitions';
import {
  emptyWidgetStateSet,
  WidgetState,
  WidgetStateColor,
  WidgetStateTextStyle,
} from '@nelyx/core/framework/widgets/widget-state';
import { scrollChromeTimer } from '@nelyx/core/internal/framework/widgets/scroll-chrome-timers';
import { HapticFeedback } from '@nelyx/core/services/haptic-feedback';
import type { Canvas } from '@nelyx/core/ui/canvas';
import { Color } from '@nelyx/core/ui/color';
import type { Offset, Size } from '@nelyx/core/ui/geometry';
import type { Offset as AnchorOffset } from '@nelyx/core/ui/offset';
import { Paint } from '@nelyx/core/ui/paint';
import { Path } from '@nelyx/core/ui/path';
import { Rect } from '@nelyx/core/ui/rect';
import { SemanticsRole } from '@nelyx/core/ui/semantics';
import { showDialog } from './dialog.ts';
import { IconButton } from './icon-button.ts';
import { Icons } from './icons.ts';
import { InkWell } from './ink-well.ts';
import { OutlineInputBorder } from './input-border.ts';
import { InputDecoration } from './input-decoration.ts';
import { RenderButtonInputPadding } from './internal/button/input-padding.ts';
import { Material } from './material.ts';
import { MaterialLocalizations } from './material-localizations.ts';
import { Easing } from './motion.ts';
import { TextButton } from './text-button.ts';
import { TextField } from './text-field.ts';
import { Theme } from './theme.ts';
import { MaterialTapTargetSize } from './theme-data.ts';
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
  readonly switchToInputEntryModeIcon?: Widget | null;
  readonly switchToTimerEntryModeIcon?: Widget | null;
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
  readonly anchorPoint?: AnchorOffset | null;
}

export async function showTimePicker({
  context,
  builder,
  barrierDismissible = true,
  barrierColor,
  barrierLabel,
  useRootNavigator = true,
  routeSettings,
  anchorPoint = null,
  ...options
}: ShowTimePickerOptions): Promise<TimeOfDay | null> {
  const dialog = new TimePickerDialog(options);
  const result = await showDialog<TimeOfDay>(context, {
    routeSettings: routeSettings ?? new RouteSettings({ name: 'time-picker' }),
    barrierDismissible,
    barrierColor: barrierColor ?? null,
    barrierLabel: barrierLabel ?? MaterialLocalizations.of(context).modalBarrierDismissLabel,
    useRootNavigator,
    anchorPoint,
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
const dialogSizeDuration = 200;
const dialAnimationDuration = 200;
const vibrateCommitDelay = 100;
const landscapeHeaderWidth = 216;
const dialInnerOffset = 28;
const dialMinRadius = 50;
const dialPadding = 28;
const dialDiameter = 256;
const selectorRadius = 24;
const selectorBorderRadius = BorderRadius.circular(8);
const dialogShape = new RoundedRectangleBorder({ borderRadius: BorderRadius.circular(28) });
const controlShape = new RoundedRectangleBorder({ borderRadius: selectorBorderRadius });

const minPickerHeight = 216;
const periodWidth = 52;
const periodHeight = 80;

interface TimePickerValues {
  readonly selectedTime: TimeOfDay;
  readonly hourMinuteMode: TimePart;
  readonly entryMode: TimePickerEntryMode;
  readonly use24HourFormat: boolean;
  readonly hourDialType: HourDialType;
  readonly orientation: Orientation;
  readonly theme: TimePickerThemeData;
  readonly colors: ColorScheme;
  readonly localization: MaterialLocalizations;
  readonly dialStyle: TextStyle;
}
type TimePickerAspect = keyof TimePickerValues;

class TimePickerModel extends InheritedModel<TimePickerAspect> {
  constructor(
    readonly values: TimePickerValues,
    child: Widget,
  ) {
    super(child);
  }

  static read<K extends TimePickerAspect>(context: BuildContext, aspect: K): TimePickerValues[K] {
    return context.dependOn(TimePickerModel, aspect).values[aspect];
  }

  updateShouldNotify(old: this): boolean {
    return (Object.keys(this.values) as TimePickerAspect[]).some((aspect) =>
      this.changed(old, aspect),
    );
  }

  updateShouldNotifyDependent(old: this, aspects: ReadonlySet<TimePickerAspect>): boolean {
    for (const aspect of aspects) if (this.changed(old, aspect)) return true;
    return false;
  }

  private changed(old: this, aspect: TimePickerAspect): boolean {
    switch (aspect) {
      case 'selectedTime':
        return !this.values.selectedTime.equals(old.values.selectedTime);
      case 'theme':
        return !this.values.theme.equals(old.values.theme);
      case 'colors':
        return !this.values.colors.equals(old.values.colors);
      case 'dialStyle':
        return !this.values.dialStyle.equals(old.values.dialStyle);
      default:
        return this.values[aspect] !== old.values[aspect];
    }
  }
}

function inputMode(mode: TimePickerEntryMode): boolean {
  return mode === TimePickerEntryMode.input || mode === TimePickerEntryMode.inputOnly;
}

function pickerStates(selected: boolean, focused = false) {
  const states = emptyWidgetStateSet();
  if (selected) states.add(WidgetState.selected);
  if (focused) states.add(WidgetState.focused);
  return states;
}

function hourMinuteColor(colors: ColorScheme, states: ReturnType<typeof pickerStates>): Color {
  const selected = states.contains(WidgetState.selected);
  const base = new Color(selected ? colors.primaryContainer : colors.surfaceContainerHighest);
  const onBase = new Color(selected ? colors.onPrimaryContainer : colors.onSurface);
  if (states.contains(WidgetState.pressed)) return onBase;
  if (states.contains(WidgetState.hovered)) return Color.alphaBlend(onBase.withOpacity(0.08), base);
  if (states.contains(WidgetState.focused)) return Color.alphaBlend(onBase.withOpacity(0.1), base);
  return base;
}

function resolveColor(
  color: Color | null,
  states: ReturnType<typeof pickerStates>,
  fallback: Color,
) {
  return (color instanceof WidgetStateColor ? color.resolve(states) : color) ?? fallback;
}

function resolveTextStyle(style: TextStyle, states: ReturnType<typeof pickerStates>): TextStyle {
  return style instanceof WidgetStateTextStyle ? style.resolve(states) : style;
}

class DayPeriodInputPadding extends SingleChildRenderObjectWidget {
  constructor(
    child: Widget,
    readonly minimum: Size,
    readonly stacked: boolean,
  ) {
    super(child);
  }

  override createRenderObject(): RenderDayPeriodInputPadding {
    return new RenderDayPeriodInputPadding(this.minimum, this.stacked);
  }

  override updateRenderObject(_context: BuildContext, render: RenderDayPeriodInputPadding): void {
    render.minSize = this.minimum;
    render.stacked = this.stacked;
  }
}

class RenderDayPeriodInputPadding extends RenderButtonInputPadding {
  constructor(
    minimum: Size,
    public stacked: boolean,
  ) {
    super(minimum);
  }

  protected override fallbackHitPoint(position: Offset, size: Size): Offset {
    const center = super.fallbackHitPoint(position, size);
    return this.stacked
      ? { x: center.x, y: center.y + (position.y > center.y ? 1 : -1) }
      : { x: center.x + (position.x > center.x ? 1 : -1), y: center.y };
  }
}

class TimePickerDialogState extends RestorationMixin<TimePickerDialog> {
  private selected!: RestorableTimeOfDay;
  private mode!: RestorableValue<TimePickerEntryMode>;
  private orientation!: RestorableValue<Orientation | null>;
  private vibrationTimer: Disposable | null = null;
  private readonly autofocusPart = new RestorableValue<TimePart | null>(null, (value) => {
    invariant(
      value === null || value === 'hour' || value === 'minute',
      'invalid-time-picker-focus',
      'Unknown time picker focus field',
    );
    return value;
  });
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
  private readonly focusListeners = {
    hour: () => this.inputFocusChanged('hour'),
    minute: () => this.inputFocusChanged('minute'),
  };
  private readonly dialFields = {
    hour: new Builder((context) => this.dialField(context, 'hour')),
    minute: new Builder((context) => this.dialField(context, 'minute')),
  };
  private readonly dial = new Builder(
    (context) =>
      new TimeDial({
        time: TimePickerModel.read(context, 'selectedTime'),
        part: TimePickerModel.read(context, 'hourMinuteMode'),
        hourDialType: TimePickerModel.read(context, 'hourDialType'),
        colors: TimePickerModel.read(context, 'colors'),
        theme: TimePickerModel.read(context, 'theme'),
        defaultTextStyle: TimePickerModel.read(context, 'dialStyle'),
        localization: TimePickerModel.read(context, 'localization'),
        onSelected: this.onDialSelected,
      }),
  );
  private readonly onDialSelected = (time: TimeOfDay, choose: boolean) =>
    this.selectDial(time, choose);
  private readonly periodControl = new Builder((context) => {
    TimePickerModel.read(context, 'selectedTime');
    const input = inputMode(TimePickerModel.read(context, 'entryMode'));
    const stacked = input || TimePickerModel.read(context, 'orientation') === 'portrait';
    return this.dayPeriods(
      context,
      TimePickerModel.read(context, 'localization'),
      TimePickerModel.read(context, 'theme'),
      TimePickerModel.read(context, 'colors'),
      stacked,
      input,
    );
  });

  private dialField(context: BuildContext, part: TimePart): Widget {
    TimePickerModel.read(context, 'selectedTime');
    TimePickerModel.read(context, 'hourMinuteMode');
    TimePickerModel.read(context, 'entryMode');
    return this.headerField(
      part,
      context,
      TimePickerModel.read(context, 'localization'),
      TimePickerModel.read(context, 'theme'),
      TimePickerModel.read(context, 'colors'),
      TimePickerModel.read(context, 'use24HourFormat'),
    );
  }

  private inputFocusChanged(part: TimePart): void {
    if (!this.mounted) return;
    if (FoundationPlatform.isWeb && this.focus[part].hasFocus) {
      const controller = this.fields[part];
      controller.selection = { anchor: 0, focus: controller.text.length };
    }
    this.setState(() => {});
  }

  private createDraft(): RestorableValue<string | null> {
    return new RestorableValue<string | null>(null, (value) => {
      invariant(
        value === null || typeof value === 'string',
        'invalid-time-draft',
        'Time picker draft must be text',
      );
      return value;
    });
  }

  override initState(): void {
    super.initState();
    this.selected = new RestorableTimeOfDay(this.widget.options.initialTime);
    this.orientation = new RestorableValue<Orientation | null>(
      this.widget.options.orientation ?? null,
      (value) => {
        invariant(
          value === null || value === 'portrait' || value === 'landscape',
          'invalid-time-picker-orientation',
          'Unknown time picker orientation',
        );
        return value;
      },
    );
    this.mode = new RestorableValue(this.widget.initialEntryMode, (value) => {
      invariant(
        Object.values(TimePickerEntryMode).some((mode) => mode === value),
        'invalid-time-picker-mode',
        'Unknown time picker entry mode',
      );
      return value as TimePickerEntryMode;
    });
    for (const part of timeParts) this.focus[part].addListener(this.focusListeners[part]);
  }

  override get restorationId(): string | null {
    return this.widget.options.restorationId ?? null;
  }

  override restoreState(): void {
    this.registerForRestoration(this.selected, 'selected_time');
    this.registerForRestoration(this.mode, 'entry_mode');
    this.registerForRestoration(this.orientation, 'orientation');
    this.registerForRestoration(this.part, 'hour_minute_mode');
    this.registerForRestoration(this.attemptedSubmit, 'attempted_submit');
    this.registerForRestoration(this.autofocusPart, 'autofocus_part');
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
    this.vibrationTimer?.dispose();
    super.dispose();
    for (const property of [
      this.selected,
      this.mode,
      this.orientation,
      this.part,
      this.attemptedSubmit,
      this.autofocusPart,
      this.hourDraft,
      this.minuteDraft,
    ])
      property.dispose();
    for (const field of timeParts) {
      this.focus[field].removeListener(this.focusListeners[field]);
      this.fields[field].dispose();
      this.focus[field].dispose();
    }
  }

  private vibrate(): void {
    const context = this.context;
    const platform = Theme.of(context).platform;
    if (platform === 'iOS' || platform === 'macOS') return;
    const messenger =
      context.services.binaryMessenger ?? context.services.platformServices?.defaultBinaryMessenger;
    if (!messenger) return;
    this.vibrationTimer?.dispose();
    this.vibrationTimer = scrollChromeTimer(vibrateCommitDelay, () => {
      this.vibrationTimer = null;
      void HapticFeedback.vibrate(messenger).catch((error) =>
        context.services.reportError?.(error),
      );
    });
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
    autofocus: TimePart | null = null,
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
      this.autofocusPart.value = autofocus;
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

  private selectDial(next: TimeOfDay, choose: boolean): void {
    const change = !next.equals(this.selected.value);
    const chooseHour = choose && this.part.value === 'hour';
    if (!change && !chooseHour) return;
    this.vibrate();
    this.setState(() => {
      if (change) this.selected.value = next;
      if (chooseHour) this.part.value = 'minute';
    });
  }

  private dayPeriods(
    context: BuildContext,
    localization: MaterialLocalizations,
    theme: TimePickerThemeData,
    colors: ColorScheme,
    stacked: boolean,
    input: boolean,
  ): Widget {
    const time = this.selected.value;
    const borderSide = theme.dayPeriodBorderSide ?? new BorderSide({ color: colors.outline });
    const shape = (theme.dayPeriodShape ?? controlShape).copyWith({ side: borderSide });
    const radius = shape instanceof RoundedRectangleBorder ? shape.borderRadius : null;
    const { textTheme } = Theme.of(context);
    const baseStyle = theme.dayPeriodTextStyle ?? textTheme.titleMedium ?? new TextStyle();
    const segmentHeight = stacked ? (input ? periodHeight - 8 : periodHeight) / 2 : 38;
    const touchHeight = Math.max(48, segmentHeight);
    const outerPadding = touchHeight - segmentHeight;
    const textScaler = MediaQuery.textScalerOf(context).clamp({ maxScaleFactor: 2 });
    const isIOS = FoundationPlatform.defaultTargetPlatform === 'iOS';
    const buttons = [DayPeriod.am, DayPeriod.pm].map((period) => {
      const selected = time.period === period;
      const first = period === DayPeriod.am;
      const states = pickerStates(selected);
      const label = first
        ? localization.anteMeridiemAbbreviation
        : localization.postMeridiemAbbreviation;
      let segment = shape;
      if (shape instanceof RoundedRectangleBorder && radius instanceof BorderRadius) {
        const { topLeft, topRight, bottomLeft, bottomRight } = radius;
        segment = shape.copyWith({
          borderRadius: BorderRadius.only(
            stacked
              ? first
                ? { topLeft, topRight }
                : { bottomLeft, bottomRight }
              : first
                ? { topLeft, bottomLeft }
                : { topRight, bottomRight },
          ),
        });
      }
      const activate = () =>
        this.selectDial(
          this.selected.value.replacing({
            hour: (this.selected.value.hour % 12) + (first ? 0 : 12),
          }),
          false,
        );
      return new Semantics({
        selected: isIOS ? selected : null,
        checked: isIOS ? null : selected,
        inMutuallyExclusiveGroup: true,
        button: true,
        child: new Padding(
          stacked
            ? EdgeInsets.only(first ? { top: outerPadding } : { bottom: outerPadding })
            : EdgeInsets.symmetric({ vertical: outerPadding / 2 }),
          new Material({
            shape: segment,
            clipBehavior: 'antiAlias',
            color: resolveColor(
              theme.dayPeriodColor,
              states,
              new Color(selected ? colors.tertiaryContainer : 0),
            ),
            child: new InkWell({
              onTap: activate,
              enableFeedback: false,
              child: new Center(
                new Text(label, {
                  textScaler,
                  maxLines: 1,
                  overflow: 'ellipsis',
                  style: resolveTextStyle(baseStyle, states).copyWith({
                    color: resolveColor(
                      theme.dayPeriodTextColor,
                      states,
                      new Color(selected ? colors.onTertiaryContainer : colors.onSurfaceVariant),
                    ).toARGB32(),
                  }),
                }),
              ),
            }),
          }),
        ),
      });
    });
    const minSize = {
      width: stacked ? periodWidth : landscapeHeaderWidth,
      height: stacked ? touchHeight * 2 : touchHeight,
    };
    const controls = stacked
      ? new Column(
          buttons.map((button) => new Expanded(button)),
          { crossAlign: 'stretch' },
        )
      : new Row(
          buttons.map((button) => new Expanded(button)),
          { textDirection: 'ltr', crossAlign: 'stretch' },
        );
    return new DayPeriodInputPadding(
      new SizedBox(minSize.width, minSize.height, controls),
      minSize,
      stacked,
    );
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
    const formatted = (value: TimeOfDay) =>
      hour
        ? localization.formatHour(value, this.formatOptions(context))
        : localization.formatMinute(value);
    const value = formatted(time);
    const typography = Theme.of(context).textTheme;
    if (inputMode(this.mode.value)) {
      const invalid =
        this.attemptedSubmit.value && this.parseDrafts(localization, use24Hours)[part] === null;
      const focused = this.focus[part].hasFocus;
      const states = pickerStates(focused, focused);
      const border = (color: number, width: number) =>
        new OutlineInputBorder({
          borderRadius: selectorBorderRadius,
          borderSide: new BorderSide({ color, width }),
        });
      const decorationTheme = theme.inputDecorationTheme;
      const style = resolveTextStyle(
        theme.hourMinuteTextStyle ?? typography.displayMedium ?? new TextStyle({ fontSize: 45 }),
        states,
      ).copyWith({
        color: resolveColor(
          theme.hourMinuteTextColor,
          states,
          new Color(focused ? colors.onPrimaryContainer : colors.onSurface),
        ).toARGB32(),
      });
      const decoration = new InputDecoration({
        errorText: invalid ? '' : null,
        errorStyle: new TextStyle({ fontSize: 0 }),
        counterText: '',
        hintText: focused || options.emptyInitialInput === true ? null : value,
        fillColor: resolveColor(
          decorationTheme?.fillColor ?? theme.hourMinuteColor,
          states,
          hourMinuteColor(colors, states),
        ),
      });
      return new Column(
        [
          new SizedBox(
            undefined,
            72,
            new Semantics({
              label,
              child: new TextField({
                id: 'material-time-picker-' + part,
                controller: this.fields[part],
                focusNode: this.focus[part],
                autofocus: this.autofocusPart.value === part,
                decoration: decorationTheme
                  ? decoration.applyDefaults(decorationTheme)
                  : decoration.copyWith({
                      contentPadding: EdgeInsets.zero,
                      filled: true,
                      enabledBorder: border(0, 1),
                      errorBorder: border(colors.error, 2),
                      focusedErrorBorder: border(colors.error, 2),
                      focusedBorder: border(colors.primary, 2),
                      hintStyle: style.copyWith({
                        color: new Color(colors.onSurface).withOpacity(0.36).toARGB32(),
                      }),
                    }),
                keyboardType: 'number',
                textInputAction: hour ? 'next' : 'done',
                textAlign: 'center',
                textDirection: 'ltr',
                textScaler: TextScaler.noScaling,
                minLines: null,
                maxLines: null,
                expands: true,
                maxLength: 2,
                autocorrect: false,
                enableSuggestions: false,
                style,
                onChanged: (text) => {
                  this.setState(() => {
                    (hour ? this.hourDraft : this.minuteDraft).value = text;
                  });
                  if (
                    hour &&
                    text.length === 2 &&
                    this.parseDrafts(localization, use24Hours).hour !== null
                  )
                    this.focus.minute.requestFocus();
                },
                onSubmitted: () => {
                  const next = this.parseDrafts(localization, use24Hours)[part];
                  if (next === null) return;
                  this.selectDial(this.selected.value.replacing({ [part]: next }), false);
                  if (hour) this.focus.minute.requestFocus();
                  else this.focus.minute.unfocus();
                },
              }),
            }),
          ),
          new ExcludeSemantics(
            new Text(label, {
              style:
                typography.bodySmall ??
                new TextStyle({ fontSize: 12, color: colors.onSurfaceVariant }),
            }),
          ),
        ],
        { mainSize: 'min', crossAlign: 'stretch', spacing: 4 },
      );
    }
    const selected = this.part.value === part;
    const states = pickerStates(selected);
    const stepped = (delta: number) =>
      hour
        ? time.replacing({
            hour: use24Hours
              ? (time.hour + delta + 24) % 24
              : time.periodOffset + ((time.hour + delta + 12) % 12),
          })
        : time.replacing({ minute: (time.minute + delta + 60) % 60 });
    const increase = stepped(1);
    const decrease = stepped(-1);
    const entryMode = this.mode.value;
    const shape = theme.hourMinuteShape ?? controlShape;
    const textColor = resolveColor(
      theme.hourMinuteTextColor,
      states,
      new Color(selected ? colors.onPrimaryContainer : colors.onSurface),
    );
    const activate = () => {
      if (this.part.value === part) return;
      this.vibrate();
      this.setState(() => {
        this.part.value = part;
      });
    };
    return new Semantics({
      selected,
      excludeSemantics: true,
      button: true,
      value:
        (hour
          ? localization.timePickerHourModeAnnouncement
          : localization.timePickerMinuteModeAnnouncement) +
        ' ' +
        value,
      onTap: activate,
      increasedValue: formatted(increase),
      onIncrease: () => this.selectDial(increase, false),
      decreasedValue: formatted(decrease),
      onDecrease: () => this.selectDial(decrease, false),
      child: new SizedBox(
        undefined,
        80,
        new Material({
          color: resolveColor(theme.hourMinuteColor, states, hourMinuteColor(colors, states)),
          shape,
          clipBehavior: 'antiAlias',
          child: new InkWell({
            onTap: activate,
            onDoubleTap:
              selected && entryMode === TimePickerEntryMode.dial
                ? () => this.switchMode(context, localization, use24Hours, part)
                : null,
            enableFeedback: false,
            child: new Center(
              new Text(value, {
                direction: 'ltr',
                textScaler: TextScaler.noScaling,
                style: resolveTextStyle(
                  theme.hourMinuteTextStyle ??
                    typography.displayLarge ??
                    new TextStyle({ fontSize: 57 }),
                  states,
                ).copyWith({ color: textColor.toARGB32() }),
              }),
            ),
          }),
        }),
      ),
    });
  }

  override build(context: BuildContext): Widget {
    const options = this.widget.options;
    const theme = TimePickerTheme.of(context);
    const { colorScheme: colors, textTheme, useMaterial3 } = Theme.of(context);
    const localization = MaterialLocalizations.of(context);
    const formatOptions = this.formatOptions(context);
    const format = localization.timeOfDayFormat(formatOptions);
    const use24Hours = hourFormat({ of: format }) !== HourFormat.h;
    const mode = this.mode.value;
    const input = inputMode(mode);
    const helpText =
      options.helpText ??
      (input ? localization.timePickerInputHelpText : localization.timePickerDialHelpText);
    const canSwitch = mode === TimePickerEntryMode.dial || mode === TimePickerEntryMode.input;
    const periodFirst = format === TimeOfDayFormat.a_space_h_colon_mm;
    const margin = MediaQuery.viewInsetsOf(context);
    const media = MediaQuery.of(context);
    const orientation =
      this.orientation.value ?? (media.width > media.height ? 'landscape' : 'portrait');
    const landscape = orientation === 'landscape';
    const insets = EdgeInsets.fromLTRB(
      16 + margin.left,
      (input ? 0 : 24) + margin.top,
      16 + margin.right,
      (input ? 0 : 24) + margin.bottom,
    );
    const body = new TimePickerModel(
      {
        selectedTime: this.selected.value,
        hourMinuteMode: this.part.value,
        entryMode: mode,
        use24HourFormat: use24Hours,
        hourDialType: !use24Hours
          ? 'twelveHour'
          : useMaterial3
            ? 'twentyFourHourDoubleRing'
            : 'twentyFourHour',
        orientation,
        theme,
        colors,
        localization,
        dialStyle: textTheme.bodyLarge ?? new TextStyle({ fontSize: 16 }),
      },
      new LayoutBuilder((_context, constraints) => {
        const wideDial = landscape && !input;
        const periods = use24Hours ? null : this.periodControl;
        const separator =
          format === TimeOfDayFormat.HH_dot_mm
            ? '.'
            : format === TimeOfDayFormat.frenchCanadian
              ? 'h'
              : ':';
        const states = pickerStates(false);
        const separatorColor = resolveColor(
          theme.timeSelectorSeparatorColor?.resolve(states) ?? null,
          states,
          new Color(colors.onSurface),
        );
        const separatorStyle = resolveTextStyle(
          theme.timeSelectorSeparatorTextStyle?.resolve(states) ??
            textTheme.displayLarge ??
            new TextStyle({ fontSize: 57 }),
          states,
        ).copyWith({ color: separatorColor.toARGB32(), height: 1 });
        const timeFields = new Row(
          [
            new Expanded(
              input
                ? this.headerField('hour', context, localization, theme, colors, use24Hours)
                : this.dialFields.hour,
            ),
            new ExcludeSemantics(
              new SizedBox(
                format === TimeOfDayFormat.frenchCanadian ? 36 : 24,
                input ? 72 : 80,
                new Center(
                  new Text(separator, { style: separatorStyle, textScaler: TextScaler.noScaling }),
                ),
              ),
            ),
            new Expanded(
              input
                ? this.headerField('minute', context, localization, theme, colors, use24Hours)
                : this.dialFields.minute,
            ),
          ],
          { textDirection: 'ltr', crossAlign: input ? 'start' : 'center' },
        );
        const help = new Text(helpText, {
          style: resolveTextStyle(
            theme.helpTextStyle ??
              (textTheme.labelMedium ?? new TextStyle({ fontSize: 12 })).copyWith({
                color: colors.onSurfaceVariant,
              }),
            states,
          ),
        });
        const timeRow =
          periods === null || wideDial
            ? timeFields
            : new Row([new Expanded(timeFields), periods], {
                textDirection: periodFirst ? 'rtl' : 'ltr',
                crossAlign: input ? 'start' : 'center',
                spacing: 12,
              });
        let header: Widget = wideDial
          ? new Stack(
              [
                new Align(help, { alignment: AlignmentDirectional.topStart }),
                new Column(
                  periods === null
                    ? [timeFields]
                    : periodFirst
                      ? [periods, timeFields]
                      : [timeFields, periods],
                  {
                    mainAxisAlignment: 'center',
                    crossAlign: 'stretch',
                    spacing: 11,
                  },
                ),
              ],
              { fit: 'expand' },
            )
          : new Column([help, timeRow], {
              mainSize: 'min',
              crossAlign: 'stretch',
              spacing: input ? 16 : 12,
            });
        let picker = header;
        if (!input) {
          header = new Semantics({
            label: localization.formatTimeOfDay(this.selected.value, formatOptions),
            explicitChildNodes: true,
            child: header,
          });
          const dial = new ExcludeSemantics(this.dial);
          picker = wideDial
            ? new Row([new SizedBox(landscapeHeaderWidth, undefined, header), new Expanded(dial)], {
                spacing: 64,
                crossAlign: 'stretch',
              })
            : new Column(
                [header, new Expanded(new Padding(EdgeInsets.symmetric({ horizontal: 12 }), dial))],
                {
                  spacing: 28,
                  crossAlign: 'stretch',
                },
              );
        }
        const children: Widget[] = input ? [picker] : [new Flexible(picker)];
        const parsed = input ? this.parseDrafts(localization, use24Hours) : null;
        if (
          parsed &&
          this.attemptedSubmit.value &&
          (parsed.hour === null || parsed.minute === null)
        )
          children.push(
            new Semantics({
              liveRegion: true,
              child: new Text(options.errorInvalidText ?? localization.invalidTimeLabel, {
                color: colors.error,
              }),
            }),
          );
        const actions = new OverflowBar({
          alignment: 'end',
          spacing: 8,
          overflowAlignment: OverflowBarAlignment.end,
          children: [
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
        });
        children.push(
          canSwitch
            ? new Row([
                new IconButton({
                  tooltip: input
                    ? localization.dialModeButtonLabel
                    : localization.inputTimeModeButtonLabel,
                  style: IconButton.styleFrom({
                    foregroundColor: theme.entryModeIconColor ?? new Color(colors.onSurface),
                  }),
                  icon: input
                    ? (options.switchToTimerEntryModeIcon ?? new Icon(Icons.access_time))
                    : (options.switchToInputEntryModeIcon ?? new Icon(Icons.keyboard_outlined)),
                  onPressed: () => this.switchMode(context, localization, use24Hours),
                }),
                new Expanded(actions),
              ])
            : actions,
        );
        const landscapeScale =
          MediaQuery.textScalerOf(context).clamp({ maxScaleFactor: 1.1 }).scale(14) / 14;
        const desiredWidth = wideDial
          ? 524 * landscapeScale
          : input
            ? use24Hours
              ? 248
              : 280
            : 310;
        const minimumWidth = wideDial ? 416 : input ? desiredWidth : 238;
        const heightAdjustment =
          Theme.of(context).materialTapTargetSize === MaterialTapTargetSize.shrinkWrap ? 12 : 0;
        const desiredHeight =
          (input ? 252 : wideDial ? 342 : 468) * landscapeScale - heightAdjustment;
        const minimumHeight = (input ? 196 : wideDial ? 248 : 326) - heightAdjustment;
        const padding = theme.padding ?? EdgeInsets.all(24);
        const availableWidth = Math.max(0, constraints.maxWidth - padding.horizontal);
        const availableHeight = Math.max(0, constraints.maxHeight - padding.vertical);
        const allowedWidth = Math.max(minimumWidth, Math.min(availableWidth, desiredWidth));
        const allowedHeight = Math.max(
          minPickerHeight,
          minimumHeight,
          Math.min(availableHeight, desiredHeight),
        );
        const column = new ConstrainedBox(
          new Column(children, {
            mainSize: 'min',
            mainAxisAlignment: 'spaceBetween',
            crossAlign: 'stretch',
            spacing: 8,
          }),
          new BoxConstraints(allowedWidth, allowedWidth, minPickerHeight, allowedHeight),
        );
        const viewport = new SingleBoxScrollView({
          primary: false,
          scrollDirection: Axis.horizontal,
          restorationId:
            options.restorationId == null ? null : 'time_picker_scroll_view_horizontal',
          child: new SingleBoxScrollView({
            primary: false,
            restorationId:
              options.restorationId == null ? null : 'time_picker_scroll_view_vertical',
            child: column,
          }),
        });
        return new AnimatedSize({
          duration: dialogSizeDuration,
          curve: Curves.easeIn,
          child: new SizedBox(
            Math.min(constraints.maxWidth, allowedWidth + padding.horizontal),
            undefined,
            new Semantics({
              container: true,
              explicitChildNodes: true,
              role: SemanticsRole.dialog,
              label: helpText,
              child: new Material({
                color: theme.backgroundColor ?? new Color(colors.surfaceContainerHigh),
                elevation: theme.elevation ?? 6,
                shape: theme.shape ?? dialogShape,
                clipBehavior: 'antiAlias',
                child: new Padding(padding, viewport),
              }),
            }),
          ),
        });
      }),
    );
    return new Center(
      new Padding(
        insets,
        MediaQuery.removeViewInsets({
          context,
          removeLeft: true,
          removeTop: true,
          removeRight: true,
          removeBottom: true,
          child: body,
        }),
      ),
    );
  }
}

type HourDialType = 'twelveHour' | 'twentyFourHour' | 'twentyFourHourDoubleRing';

interface TimeDialOptions {
  readonly time: TimeOfDay;
  readonly part: TimePart;
  readonly hourDialType: HourDialType;
  readonly colors: ColorScheme;
  readonly theme: TimePickerThemeData;
  readonly defaultTextStyle: TextStyle;
  readonly localization: MaterialLocalizations;
  readonly onSelected: (value: TimeOfDay, choose: boolean) => void;
}

interface DialPosition {
  readonly angle: number;
  readonly ring: number;
}

function pointOnDial(size: number, angle: number, radius: number): Offset {
  const center = size / 2;
  return { x: center + radius * Math.sin(angle), y: center - radius * Math.cos(angle) };
}

function dialPosition({ part, hourDialType }: TimeDialOptions, time: TimeOfDay): DialPosition {
  const hours = hourDialType === 'twentyFourHour' ? 24 : 12;
  return part === 'hour'
    ? {
        angle: (twoPi * (time.hour % hours)) / hours,
        ring: hourDialType === 'twentyFourHourDoubleRing' && time.hour >= 12 ? 0 : 1,
      }
    : { angle: (twoPi * time.minute) / 60, ring: 1 };
}

class TimeDial extends StatefulWidget {
  constructor(readonly options: TimeDialOptions) {
    super();
  }

  override createState(): State<TimeDial> {
    return new TimeDialState();
  }
}

class TimeDialState extends SingleTickerProviderStateMixin<TimeDial> {
  private motion!: AnimationController;
  private from!: DialPosition;
  private to!: DialPosition;
  private panValue: TimeOfDay | null = null;

  override initState(): void {
    super.initState();
    this.from = this.to = dialPosition(this.widget.options, this.widget.options.time);
    this.motion = new AnimationController({
      vsync: this,
      duration: dialAnimationDuration,
      value: 1,
    });
  }

  override didUpdateWidget(oldWidget: TimeDial): void {
    super.didUpdateWidget(oldWidget);
    const options = this.widget.options;
    const before = oldWidget.options;
    if (options.part !== before.part || options.hourDialType !== before.hourDialType) {
      this.panValue = null;
    }
    if (this.panValue === null) this.animateTo(dialPosition(options, options.time));
  }

  override dispose(): void {
    this.motion.dispose();
    super.dispose();
  }

  private get position(): DialPosition {
    const t = Easing.legacy.transform(this.motion.value);
    return {
      angle: this.from.angle + (this.to.angle - this.from.angle) * t,
      ring: this.from.ring + (this.to.ring - this.from.ring) * t,
    };
  }

  private animateTo(position: DialPosition): void {
    if (this.to.angle === position.angle && this.to.ring === position.ring) return;
    const current = this.position;
    const turns = Math.round((position.angle - current.angle) / twoPi);
    this.from = { angle: current.angle + turns * twoPi, ring: current.ring };
    this.to = position;
    this.motion.forward({ from: 0 });
  }

  private updateAt(
    position: Offset,
    size: number,
    outer: number,
    inner: number,
    tapped: boolean,
  ): void {
    const options = this.widget.options;
    const { time, part, hourDialType, onSelected } = options;
    const doubleRing = hourDialType === 'twentyFourHourDoubleRing';
    const dx = position.x - size / 2;
    const dy = size / 2 - position.y;
    const angle = (Math.atan2(dx, dy) + twoPi) % twoPi;
    const fraction = angle / twoPi;
    const ring =
      part === 'hour' && doubleRing && outer > inner
        ? Math.max(0, Math.min(1, (Math.hypot(dx, dy) - inner) / (outer - inner)))
        : 1;
    let next: TimeOfDay;
    if (part === 'hour') {
      const count = hourDialType === 'twentyFourHour' ? 24 : 12;
      const offset =
        hourDialType === 'twelveHour' ? time.periodOffset : doubleRing && ring < 0.5 ? 12 : 0;
      next = time.replacing({ hour: (Math.round(fraction * count) % count) + offset });
    } else {
      const minute = Math.round(fraction * 60) % 60;
      next = time.replacing({
        minute: tapped ? (Math.floor((minute + 2) / 5) * 5) % 60 : minute,
      });
    }
    const target = dialPosition(options, next);
    this.setState(() => {
      this.motion.stop();
      this.from = this.to = { angle: tapped ? target.angle : angle, ring };
      this.panValue = tapped ? null : next;
      if (tapped) this.animateTo(target);
    });
    onSelected(next, tapped);
  }

  private finishPan(advance: boolean): void {
    const next = this.panValue;
    if (next === null || !this.mounted) return;
    const options = this.widget.options;
    this.panValue = null;
    this.animateTo(dialPosition(options, next));
    if (advance) options.onSelected(next, true);
  }

  override build(context: BuildContext): Widget {
    const textScaler = MediaQuery.textScalerOf(context).clamp({ maxScaleFactor: 2 });
    return new LayoutBuilder((_context, constraints) => {
      const diameter = Math.min(dialDiameter, constraints.maxWidth, constraints.maxHeight);
      if (diameter <= 0) return new SizedBox();
      const { time, part, hourDialType, colors, theme, localization, defaultTextStyle } =
        this.widget.options;
      const { useMaterial3 } = Theme.of(context);
      const single24HourRing = hourDialType === 'twentyFourHour';
      const doubleRing = hourDialType === 'twentyFourHourDoubleRing';
      const use24Hours = single24HourRing || doubleRing;
      const dotRadius = Math.min(useMaterial3 ? selectorRadius : 22, diameter / 4);
      const minRadius = Math.min(dialMinRadius, diameter / 2 - dotRadius);
      const outer = Math.max(minRadius, diameter / 2 - dialPadding);
      const inner = Math.max(0, outer - dialInnerOffset);
      const hours = part === 'hour';
      const selected = hours ? (use24Hours ? time.hour : time.hour % 12) : time.minute;
      const labelCount = hours && doubleRing ? 24 : 12;
      const primaryLabels: Widget[] = [];
      const selectedLabels: Widget[] = [];
      const normal = pickerStates(false);
      const active = pickerStates(true);
      const primaryStyle = resolveTextStyle(
        theme.dialTextStyle ?? defaultTextStyle,
        normal,
      ).copyWith({
        color: resolveColor(theme.dialTextColor, normal, new Color(colors.onSurface)).toARGB32(),
      });
      const highlightColor = resolveColor(
        theme.dialTextColor,
        active,
        new Color(useMaterial3 ? colors.onPrimary : colors.surface),
      );
      const highlightStyle = resolveTextStyle(
        theme.dialTextStyle ?? defaultTextStyle,
        active,
      ).copyWith({ color: highlightColor.toARGB32() });
      const labelBoxSize = Math.min(32, diameter / 4);
      for (let index = 0; index < labelCount; ++index) {
        const value = hours ? (single24HourRing ? index * 2 : index) : index * 5;
        const indexAngle = (twoPi * (index % 12)) / 12;
        const location = pointOnDial(
          diameter,
          indexAngle,
          hours && doubleRing && value >= 12 ? inner : outer,
        );
        const target = hours
          ? time.replacing({ hour: use24Hours ? value : value + time.periodOffset })
          : time.replacing({ minute: value });
        const label = hours
          ? doubleRing && value !== 0
            ? localization.timePickerNumber(value, 1)
            : localization.formatHour(target, { alwaysUse24HourFormat: use24Hours })
          : localization.formatMinute(target);
        const rect = {
          left: location.x - labelBoxSize / 2,
          top: location.y - labelBoxSize / 2,
          width: labelBoxSize,
          height: labelBoxSize,
        };
        const labelText = (style: TextStyle) =>
          new Center(
            new Text(label, {
              style,
              direction: 'ltr',
              textScaler,
              maxLines: 1,
              softWrap: false,
            }),
          );
        primaryLabels.push(
          new Positioned(
            new Semantics({
              button: true,
              label,
              container: true,
              excludeSemantics: true,
              selected: value === selected,
              onTap: () => this.widget.options.onSelected(target, false),
              child: labelText(primaryStyle),
            }),
            rect,
          ),
        );
        selectedLabels.push(new Positioned(labelText(highlightStyle), rect));
      }
      const background = Positioned.fill(
        new DecoratedBox(undefined, {
          decoration: new BoxDecoration({
            color:
              theme.dialBackgroundColor?.toARGB32() ??
              (useMaterial3
                ? colors.surfaceContainerHighest
                : new Color(colors.onSurface)
                    .withOpacity(colors.brightness === 'dark' ? 0.12 : 0.08)
                    .toARGB32()),
            shape: 'circle',
          }),
        }),
      );
      const highlight = new IgnorePointer(new ExcludeSemantics(new Stack(selectedLabels)));
      const hand = theme.dialHandColor?.toARGB32() ?? colors.primary;
      return new Center(
        new SizedBox(
          diameter,
          diameter,
          new GestureDetector(
            new AnimatedBuilder({
              animation: this.motion,
              child: highlight,
              builder: (_context, selectedLabels) => {
                const { angle, ring } = this.position;
                const radius = Math.max(
                  minRadius,
                  hours && doubleRing && ring < 0.5 ? inner : outer,
                );
                const handle = pointOnDial(diameter, angle, radius);
                const markerAngle = (((Math.PI / 2 - angle) % twoPi) + twoPi) % twoPi;
                const remainder = markerAngle % (twoPi / labelCount);
                const painter = new DialFace(
                  hand,
                  handle,
                  dotRadius,
                  remainder > 0.1 && remainder < 0.45 ? highlightColor.toARGB32() : null,
                );
                return new Stack([
                  background,
                  ...primaryLabels,
                  Positioned.fill(new IgnorePointer(new CustomPaint(undefined, { painter }))),
                  Positioned.fill(
                    new ClipPath(selectedLabels ?? undefined, {
                      clipper: new DialSelectionClip(handle, dotRadius),
                    }),
                  ),
                ]);
              },
            }),
            {
              behavior: HitTestBehavior.opaque,
              excludeFromSemantics: true,
              onTapUp: (event) => this.updateAt(event.localPosition, diameter, outer, inner, true),
              onPanStart: (event) =>
                this.updateAt(event.localPosition, diameter, outer, inner, false),
              onPanUpdate: (event) =>
                this.updateAt(event.localPosition, diameter, outer, inner, false),
              onPanEnd: () => this.finishPan(true),
              onPanCancel: () => this.finishPan(false),
            },
          ),
        ),
      );
    });
  }
}

class DialFace extends CustomPainter {
  constructor(
    readonly foreground: number,
    readonly end: Offset,
    readonly radius: number,
    readonly marker: number | null,
  ) {
    super();
  }
  override paint(canvas: Canvas, { width, height }: Size): void {
    const center = { x: width / 2, y: height / 2 };
    const hand = new Paint({ color: this.foreground });
    canvas.drawLine(center, this.end, new Paint({ color: this.foreground, strokeWidth: 2 }));
    canvas.drawCircle(center, 4, hand);
    canvas.drawCircle(this.end, this.radius, hand);
    if (this.marker !== null) canvas.drawCircle(this.end, 2, new Paint({ color: this.marker }));
  }
  override shouldRepaint(old: CustomPainter): boolean {
    return (
      !(old instanceof DialFace) ||
      old.foreground !== this.foreground ||
      old.radius !== this.radius ||
      old.marker !== this.marker ||
      old.end.x !== this.end.x ||
      old.end.y !== this.end.y
    );
  }
}

class DialSelectionClip extends CustomClipper<Path> {
  constructor(
    readonly center: Offset,
    readonly radius: number,
  ) {
    super();
  }

  override getClip(): Path {
    const path = new Path();
    path.addOval(Rect.fromCircle({ center: this.center, radius: this.radius }));
    return path;
  }

  override shouldReclip(old: CustomClipper<Path>): boolean {
    return (
      !(old instanceof DialSelectionClip) ||
      old.radius !== this.radius ||
      old.center.x !== this.center.x ||
      old.center.y !== this.center.y
    );
  }
}
