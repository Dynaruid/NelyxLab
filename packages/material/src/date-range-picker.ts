// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Flutter: packages/flutter/lib/src/material/date_picker.dart
// Revision: 71e4717a61786faab4c7aa39825989305ed29e8a
import { invariant } from '@nelyx/core/foundation/errors';
import { Curves } from '@nelyx/core/framework/animation/curves';
import { AlignmentDirectional } from '@nelyx/core/framework/painting/alignment';
import { EdgeInsets } from '@nelyx/core/framework/painting/edge-insets';
import { TextStyle } from '@nelyx/core/framework/painting/text-style';
import { BoxConstraints } from '@nelyx/core/framework/rendering/constraints';
import { Directionality, Localizations, MediaQuery } from '@nelyx/core/framework/widgets/app-data';
import {
  Align,
  Column,
  ConstrainedBox,
  Expanded,
  Flexible,
  Padding,
  Row,
  SizedBox,
  Text,
} from '@nelyx/core/framework/widgets/basic';
import { TextEditingController } from '@nelyx/core/framework/widgets/editable-text';
import { StatefulWidget } from '@nelyx/core/framework/widgets/framework';
import type {
  BuildContext,
  State,
  Widget,
  WidgetOptions,
} from '@nelyx/core/framework/widgets/framework';
import { Icon } from '@nelyx/core/framework/widgets/icon';
import { IconTheme } from '@nelyx/core/framework/widgets/icon-theme';
import { IconThemeData } from '@nelyx/core/framework/widgets/icon-theme-data';
import { AnimatedContainer } from '@nelyx/core/framework/widgets/implicit-animations';
import { LayoutBuilder } from '@nelyx/core/framework/widgets/layout-builder';
import { Navigator } from '@nelyx/core/framework/widgets/navigation';
import type { RouteSettings } from '@nelyx/core/framework/widgets/pages';
import type { Orientation } from '@nelyx/core/framework/widgets/orientation-builder';
import { OverflowBar } from '@nelyx/core/framework/widgets/overflow-bar';
import { PreferredSize } from '@nelyx/core/framework/widgets/preferred-size';
import { RestorableBool } from '@nelyx/core/framework/widgets/restoration';
import { SafeArea } from '@nelyx/core/framework/widgets/safe-area';
import { SingleBoxScrollView } from '@nelyx/core/framework/widgets/scroll-view';
import { Semantics } from '@nelyx/core/framework/widgets/semantics';
import { HapticFeedback } from '@nelyx/core/services/haptic-feedback';
import type { Color } from '@nelyx/core/ui/color';
import type { Locale } from '@nelyx/core/ui/locale';
import type { Offset } from '@nelyx/core/ui/offset';
import type { TextDirection } from '@nelyx/core/ui/typography';
import { CloseButton } from './action-buttons.ts';
import { AppBar } from './app-bar.ts';
import { DatePickerTheme } from './date-picker-theme.ts';
import { debugCheckHasMaterialLocalizations } from './debug.ts';
import { Dialog, showDialog } from './dialog.ts';
import { DialogTheme } from './dialog-theme.ts';
import { DatePickerEntryMode, GregorianCalendarDelegate } from './generated/date/date.generated.ts';
import type { CalendarDelegate } from './generated/date/date.generated.ts';
import {
  _DatePickerHeader,
  _RestorableDatePickerEntryMode,
  _dialogSizeAnimationDuration,
  _inputPortraitDialogSizeM2,
  _inputPortraitDialogSizeM3,
  _inputRangeLandscapeDialogSize,
  _kMaxRangeTextScaleFactor,
} from './generated/date/date_picker.generated.ts';
import { RestorableDateTimeN } from './generated/date/restoration_properties.generated.ts';
import { IconButton } from './icon-button.ts';
import { Icons } from './icons.ts';
import { OutlineInputBorder, UnderlineInputBorder } from './input-border.ts';
import { InputDecoration } from './input-decoration.ts';
import { InputDecorationTheme } from './input-decoration-theme.ts';
import type { DateTime } from './internal/date/date-time.ts';
import { RangeCalendar } from './internal/date/range-calendar.ts';
import { dateRangeLocalizations } from './internal/date/range-localizations.ts';
import { DateTimeRange } from './internal/date/range-value.ts';
import type { SelectableDayForRangePredicate } from './internal/date/range-value.ts';
import { RestorationMixin, dateOrientationOf } from './internal/date/source-host.ts';
import { SourceDateTheme } from './internal/date/source-theme.ts';
import { MaterialLocalizations, MaterialLocalizationsScope } from './material-localizations.ts';
import { Scaffold } from './scaffold.ts';
import { TextButton } from './text-button.ts';
import { TextField } from './text-field.ts';
import type { TextFieldOptions } from './text-field.ts';
import { Theme } from './theme.ts';

export { DateTimeRange };
export type { SelectableDayForRangePredicate };

export interface DateRangePickerDialogOptions extends WidgetOptions {
  readonly firstDate: DateTime;
  readonly lastDate: DateTime;
  readonly initialDateRange?: DateTimeRange | null;
  readonly currentDate?: DateTime | null;
  readonly initialEntryMode?: DatePickerEntryMode;
  readonly helpText?: string | null;
  readonly cancelText?: string | null;
  readonly confirmText?: string | null;
  readonly saveText?: string | null;
  readonly errorFormatText?: string | null;
  readonly errorInvalidText?: string | null;
  readonly errorInvalidRangeText?: string | null;
  readonly fieldStartHintText?: string | null;
  readonly fieldEndHintText?: string | null;
  readonly fieldStartLabelText?: string | null;
  readonly fieldEndLabelText?: string | null;
  readonly keyboardType?: TextFieldOptions['keyboardType'];
  readonly restorationId?: string | null;
  readonly switchToInputEntryModeIcon?: Icon | null;
  readonly switchToCalendarEntryModeIcon?: Icon | null;
  readonly selectableDayPredicate?: SelectableDayForRangePredicate | null;
  readonly calendarDelegate?: CalendarDelegate<DateTime>;
}

export interface ShowDateRangePickerOptions extends Omit<
  DateRangePickerDialogOptions,
  'key' | 'restorationId'
> {
  readonly context: BuildContext;
  readonly locale?: Locale | string | null;
  readonly textDirection?: TextDirection | null;
  readonly barrierDismissible?: boolean;
  readonly barrierColor?: Color | null;
  readonly barrierLabel?: string | null;
  readonly useRootNavigator?: boolean;
  readonly routeSettings?: RouteSettings | null;
  readonly anchorPoint?: Offset | null;
  readonly builder?: ((context: BuildContext, child: Widget) => Widget) | null;
}

export async function showDateRangePicker({
  context,
  locale = null,
  textDirection = null,
  barrierDismissible = true,
  barrierColor = null,
  barrierLabel = null,
  useRootNavigator = true,
  routeSettings = null,
  anchorPoint = null,
  builder = null,
  ...options
}: ShowDateRangePickerOptions): Promise<DateTimeRange | null> {
  debugCheckHasMaterialLocalizations(context);
  let content: Widget = new DateRangePickerDialog(options);
  if (textDirection) content = new Directionality(textDirection, content);
  if (locale) {
    const tag = typeof locale === 'string' ? locale : locale.toLanguageTag();
    const inherited = context.maybeDependOn(Localizations);
    content = new Localizations(
      tag,
      inherited?.messages ?? {},
      inherited?.fallback ?? 'en',
      new MaterialLocalizationsScope(new MaterialLocalizations(tag), content),
    );
  }
  return (
    (await showDialog<DateTimeRange>(context, {
      barrierDismissible,
      barrierColor,
      barrierLabel,
      useRootNavigator,
      routeSettings,
      anchorPoint,
      useSafeArea: false,
      builder: (routeContext) => builder?.(routeContext, content) ?? content,
    })) ?? null
  );
}

const defaultCalendar = new GregorianCalendarDelegate();
const calendarOnly = DatePickerEntryMode.calendarOnly,
  inputOnly = DatePickerEntryMode.inputOnly;
const calendarMode = DatePickerEntryMode.calendar,
  inputMode = DatePickerEntryMode.input;
const isInput = (mode: DatePickerEntryMode) => mode === inputMode || mode === inputOnly;

export class DateRangePickerDialog extends StatefulWidget {
  readonly firstDate: DateTime;
  readonly lastDate: DateTime;
  readonly initialDateRange: DateTimeRange | null;
  readonly calendarDelegate: CalendarDelegate<DateTime>;
  readonly initialEntryMode: DatePickerEntryMode;
  readonly options: Readonly<DateRangePickerDialogOptions>;

  constructor(options: DateRangePickerDialogOptions) {
    super(options.key ?? null);
    this.calendarDelegate = options.calendarDelegate ?? defaultCalendar;
    this.firstDate = this.calendarDelegate.dateOnly(options.firstDate);
    this.lastDate = this.calendarDelegate.dateOnly(options.lastDate);
    const initial = options.initialDateRange;
    this.initialDateRange = initial
      ? new DateTimeRange(this.calendarDelegate.datesOnly(initial))
      : null;
    this.initialEntryMode = options.initialEntryMode ?? calendarMode;
    this.options = Object.freeze({ ...options });
    invariant(
      !this.lastDate.isBefore(this.firstDate),
      'invalid-date-range-bounds',
      'lastDate must be on or after firstDate',
    );
    const range = this.initialDateRange;
    if (range) {
      invariant(
        this.contains(range.start) && this.contains(range.end),
        'initial-date-range-bounds',
        'The initial range must be inside firstDate and lastDate',
      );
      const predicate = options.selectableDayPredicate;
      invariant(
        !predicate ||
          (predicate(range.start, range.start, range.end) &&
            predicate(range.end, range.start, range.end)),
        'unselectable-initial-range',
        'The initial start and end dates must both be selectable',
      );
    }
  }

  get currentDate(): DateTime {
    return this.calendarDelegate.dateOnly(this.options.currentDate ?? this.calendarDelegate.now());
  }

  contains(date: DateTime): boolean {
    return !date.isBefore(this.firstDate) && !date.isAfter(this.lastDate);
  }

  override createState(): State<DateRangePickerDialog> {
    return new DateRangePickerState();
  }
}

function formatRangeStart(
  localization: MaterialLocalizations,
  calendar: CalendarDelegate<DateTime>,
  start: DateTime | null,
  end: DateTime | null,
): string {
  if (!start) return localization.dateRangeLabel('dateRangeStartLabel');
  return !end || end.year === start.year
    ? calendar.formatShortMonthDay(start, localization)
    : calendar.formatShortDate(start, localization);
}

function formatRangeEnd(
  localization: MaterialLocalizations,
  calendar: CalendarDelegate<DateTime>,
  start: DateTime | null,
  end: DateTime | null,
  now: DateTime,
): string {
  if (!end) return localization.dateRangeLabel('dateRangeEndLabel');
  return start && start.year === end.year && start.year === now.year
    ? calendar.formatShortMonthDay(end, localization)
    : calendar.formatShortDate(end, localization);
}

let nextRangeFieldId = 0;

class DateRangePickerState extends RestorationMixin<DateRangePickerDialog> {
  private entryMode!: _RestorableDatePickerEntryMode;
  private selectedStart!: RestorableDateTimeN;
  private selectedEnd!: RestorableDateTimeN;
  private readonly autoValidate = new RestorableBool(false);
  private readonly startController = new TextEditingController();
  private readonly endController = new TextEditingController();
  private readonly inputId = ++nextRangeFieldId;
  private fieldsNeedSync = true;
  private fieldLocale = '';
  private localization!: MaterialLocalizations;

  override initState(): void {
    super.initState();
    this.entryMode = new _RestorableDatePickerEntryMode(this.widget.initialEntryMode);
    this.selectedStart = new RestorableDateTimeN(this.widget.initialDateRange?.start ?? null);
    this.selectedEnd = new RestorableDateTimeN(this.widget.initialDateRange?.end ?? null);
  }
  override get restorationId(): string | null {
    return this.widget.options.restorationId ?? null;
  }
  override restoreState(): void {
    this.registerForRestoration(this.entryMode, 'entry_mode');
    this.registerForRestoration(this.selectedStart, 'selected_start');
    this.registerForRestoration(this.selectedEnd, 'selected_end');
    this.registerForRestoration(this.autoValidate, 'autovalidate');
    this.fieldsNeedSync = true;
  }

  override didChangeDependencies(): void {
    super.didChangeDependencies();
    this.localization = dateRangeLocalizations(MaterialLocalizations.of(this.context));
    if (
      isInput(this.entryMode.value) &&
      (this.fieldsNeedSync || this.fieldLocale !== this.localization.locale)
    )
      this.syncFields();
  }

  private syncFields(): void {
    const calendar = this.widget.calendarDelegate;
    const start = this.selectedStart.value,
      end = this.selectedEnd.value;
    const startText = start ? calendar.formatCompactDate(start, this.localization) : '';
    this.startController.text = startText;
    this.endController.text = end ? calendar.formatCompactDate(end, this.localization) : '';
    this.startController.selection = { anchor: 0, focus: startText.length };
    this.fieldLocale = this.localization.locale;
    this.fieldsNeedSync = false;
  }

  private readonly isSelectable = (date: DateTime): boolean =>
    this.widget.contains(date) &&
    (this.widget.options.selectableDayPredicate?.(
      date,
      this.selectedStart.value,
      this.selectedEnd.value,
    ) ??
      true);

  private readonly select = (date: DateTime): void => {
    if (!this.isSelectable(date)) return;
    const context = this.context;
    const platform = Theme.of(context).platform;
    const messenger =
      context.services.binaryMessenger ?? context.services.platformServices?.defaultBinaryMessenger;
    if (messenger && (platform === 'android' || platform === 'fuchsia')) {
      void HapticFeedback.vibrate(messenger).catch((error) =>
        context.services.reportError?.(error),
      );
    }
    this.setState(() => {
      const start = this.selectedStart.value;
      if (start && !this.selectedEnd.value && !date.isBefore(start)) this.selectedEnd.value = date;
      else {
        this.selectedStart.value = date;
        this.selectedEnd.value = null;
      }
    });
  };

  private readonly switchMode = (): void => {
    this.setState(() => {
      if (this.entryMode.value === calendarMode) {
        this.autoValidate.value = false;
        this.entryMode.value = inputMode;
        this.syncFields();
      } else if (this.entryMode.value === inputMode) {
        const start = this.selectedStart.value,
          end = this.selectedEnd.value;
        if (start && end?.isBefore(start)) this.selectedEnd.value = null;
        if (!start || !this.isSelectable(start)) {
          this.selectedStart.value = null;
          this.selectedEnd.value = null;
        } else if (this.selectedEnd.value && !this.isSelectable(this.selectedEnd.value)) {
          this.selectedEnd.value = null;
        }
        this.entryMode.value = calendarMode;
      }
    });
  };

  private dateError(date: DateTime | null): string | null {
    const labels = this.localization,
      options = this.widget.options;
    if (!date) return options.errorFormatText ?? labels.dateRangeLabel('invalidDateFormatLabel');
    if (!this.isSelectable(date))
      return options.errorInvalidText ?? labels.dateRangeLabel('dateOutOfRangeLabel');
    return null;
  }

  private inputErrors(): { start: string | null; end: string | null } {
    const start = this.selectedStart.value,
      end = this.selectedEnd.value;
    let startError = this.dateError(start);
    const endError = this.dateError(end);
    if (startError === null && endError === null && start && end?.isBefore(start))
      startError =
        this.widget.options.errorInvalidRangeText ??
        this.localization.dateRangeLabel('invalidDateRangeLabel');
    return { start: startError, end: endError };
  }

  private readonly confirm = (): void => {
    if (isInput(this.entryMode.value)) {
      const errors = this.inputErrors();
      if (errors.start !== null || errors.end !== null) {
        this.setState(() => {
          this.autoValidate.value = true;
        });
        return;
      }
    }
    const start = this.selectedStart.value,
      end = this.selectedEnd.value;
    if (start && end && !start.isAfter(end))
      Navigator.of(this.context).pop(new DateTimeRange({ start, end }));
  };

  private readonly cancel = (): void => {
    Navigator.of(this.context).pop();
  };

  private edit(which: 'start' | 'end', text: string): void {
    const calendar = this.widget.calendarDelegate;
    const parsed = calendar.parseCompactDate(text, this.localization);
    this.setState(() => {
      const property = which === 'start' ? this.selectedStart : this.selectedEnd;
      property.value = parsed && calendar.dateOnly(parsed);
    });
  }

  private buildCalendar(
    context: BuildContext,
    landscape: boolean,
    helpText: string,
    toggle: Widget | null,
  ): Widget {
    const { options, calendarDelegate, firstDate, lastDate, currentDate } = this.widget;
    const start = this.selectedStart.value,
      end = this.selectedEnd.value;
    const override = DatePickerTheme.of(context),
      defaults = DatePickerTheme.defaults(context);
    const useMaterial3 = SourceDateTheme.of(context).useMaterial3;
    const localization = this.localization;
    const foreground =
      override.rangePickerHeaderForegroundColor ?? defaults.rangePickerHeaderForegroundColor;
    const disabled = foreground?.withOpacity(0.38) ?? null;
    const background =
      override.rangePickerHeaderBackgroundColor ?? defaults.rangePickerHeaderBackgroundColor;
    const headline =
      override.rangePickerHeaderHeadlineStyle ??
      defaults.rangePickerHeaderHeadlineStyle ??
      new TextStyle();
    const helpStyle =
      override.rangePickerHeaderHelpStyle ?? defaults.rangePickerHeaderHelpStyle ?? new TextStyle();
    const startText = formatRangeStart(localization, calendarDelegate, start, end);
    const endText = formatRangeEnd(
      localization,
      calendarDelegate,
      start,
      end,
      calendarDelegate.now(),
    );
    const iconTheme = new IconThemeData({ color: foreground });
    const actionStyle = TextButton.styleFrom({
      foregroundColor: foreground,
      disabledForegroundColor: disabled,
    });
    const label = localization.dateRangeLabel('saveButtonLabel');
    const save = options.saveText ?? (useMaterial3 ? label : label.toUpperCase());
    const summary = new Semantics({
      label: helpText + ' ' + startText + ' – ' + endText,
      excludeSemantics: true,
      child: new Column(
        [
          new Text(helpText, {
            style: helpStyle.copyWith({ color: foreground?.toARGB32() ?? null }),
            maxLines: 1,
            overflow: 'ellipsis',
          }),
          new SizedBox(undefined, 8),
          new Row([
            new Flexible(
              new Text(startText, {
                style: headline.copyWith({
                  color: (start ? foreground : disabled)?.toARGB32() ?? null,
                }),
                maxLines: 1,
                overflow: 'ellipsis',
              }),
            ),
            new Text(' – ', {
              style: headline.copyWith({ color: foreground?.toARGB32() ?? null }),
            }),
            new Flexible(
              new Text(endText, {
                style: headline.copyWith({
                  color: (end ? foreground : disabled)?.toARGB32() ?? null,
                }),
                maxLines: 1,
                overflow: 'ellipsis',
              }),
            ),
          ]),
          new SizedBox(undefined, 16),
        ],
        { crossAxisAlignment: 'start', mainAxisSize: 'min' },
      ),
    });
    const display = MediaQuery.of(context);
    const header = new AppBar({
      leading: new CloseButton({ onPressed: this.cancel }),
      iconTheme,
      actionsIconTheme: iconTheme,
      elevation: useMaterial3 ? 0 : null,
      scrolledUnderElevation: useMaterial3 ? 0 : null,
      backgroundColor: background,
      actions: [
        ...(landscape && toggle ? [toggle] : []),
        new TextButton({
          style: actionStyle,
          onPressed: start && end ? this.confirm : null,
          child: new Text(save),
        }),
        new SizedBox(8),
      ],
      bottom: new PreferredSize({
        preferredSize: { width: Infinity, height: 64 },
        child: new Row([
          new SizedBox(display.width < 360 ? 42 : 72),
          new Expanded(summary),
          ...(!landscape && toggle
            ? [
                new Padding(
                  EdgeInsets.symmetric({ horizontal: 8 }),
                  new IconTheme(iconTheme, toggle),
                ),
              ]
            : []),
        ]),
      }),
    });
    return new SafeArea({
      top: false,
      left: false,
      right: false,
      child: new Scaffold({
        appBar: header,
        backgroundColor: override.rangePickerBackgroundColor ?? defaults.rangePickerBackgroundColor,
        body: new RangeCalendar({
          calendar: calendarDelegate,
          localization,
          first: firstDate,
          last: lastDate,
          today: currentDate,
          start,
          end,
          isSelectable: this.isSelectable,
          onSelect: this.select,
        }),
      }),
    });
  }

  private buildInput(
    context: BuildContext,
    orientation: Orientation,
    helpText: string,
    toggle: Widget | null,
  ): Widget {
    const { options, calendarDelegate, currentDate } = this.widget;
    const theme = Theme.of(context),
      pickerTheme = DatePickerTheme.of(context),
      defaults = DatePickerTheme.defaults(context);
    const useMaterial3 = SourceDateTheme.of(context).useMaterial3;
    const localization = this.localization;
    const start = this.selectedStart.value,
      end = this.selectedEnd.value;
    const startText = formatRangeStart(localization, calendarDelegate, start, end);
    const endText = formatRangeEnd(localization, calendarDelegate, start, end, currentDate);
    const landscape = orientation === 'landscape';
    const title =
      start && end
        ? Directionality.of(context) === 'rtl'
          ? endText + ' – ' + startText
          : startText + ' – ' + endText
        : localization.dateRangeLabel('unspecifiedDateRange');
    const semanticTitle =
      start && end
        ? calendarDelegate.formatMediumDate(start, localization) +
          ' – ' +
          calendarDelegate.formatMediumDate(end, localization)
        : '';
    const headline = landscape
      ? theme.textTheme.headlineSmall
      : (pickerTheme.headerHeadlineStyle ?? defaults.headerHeadlineStyle);
    const header = new _DatePickerHeader({
      helpText,
      titleText: title,
      titleSemanticsLabel: semanticTitle,
      orientation,
      titleStyle:
        headline?.copyWith({
          color:
            (pickerTheme.headerForegroundColor ?? defaults.headerForegroundColor)?.toARGB32() ??
            null,
        }) ?? null,
      isShort: landscape,
      entryModeButton: toggle,
    });
    const errors = this.autoValidate.value ? this.inputErrors() : { start: null, end: null };
    const inputTheme = InputDecorationTheme.of(context);
    const border =
      inputTheme.border ?? (useMaterial3 ? new OutlineInputBorder() : new UnderlineInputBorder());
    const field = (which: 'start' | 'end'): Widget => {
      const isStart = which === 'start';
      return new TextField({
        id: 'date-range-' + this.inputId + '-' + which,
        controller: isStart ? this.startController : this.endController,
        autofocus: isStart,
        keyboardType: options.keyboardType ?? 'datetime',
        decoration: new InputDecoration({
          border,
          filled: inputTheme.filled,
          hintText:
            (isStart ? options.fieldStartHintText : options.fieldEndHintText) ??
            calendarDelegate.dateHelpText(localization),
          labelText:
            (isStart ? options.fieldStartLabelText : options.fieldEndLabelText) ??
            localization.dateRangeLabel(isStart ? 'dateRangeStartLabel' : 'dateRangeEndLabel'),
          errorText: errors[which],
        }),
        onChanged: (text) => this.edit(which, text),
      });
    };
    const form = new SingleBoxScrollView({
      primary: false,
      padding: EdgeInsets.symmetric({ horizontal: landscape ? 16 : 24, vertical: 16 }),
      child: new Row([new Expanded(field('start')), new SizedBox(8), new Expanded(field('end'))], {
        crossAxisAlignment: 'start',
      }),
    });
    const cancelText = localization.dateRangeLabel('cancelButtonLabel');
    const actions = new ConstrainedBox(
      new Padding(
        EdgeInsets.symmetric({ horizontal: 8 }),
        new Align(
          new OverflowBar({
            spacing: 8,
            children: [
              new TextButton({
                onPressed: this.cancel,
                child: new Text(
                  options.cancelText ?? (useMaterial3 ? cancelText : cancelText.toUpperCase()),
                ),
              }),
              new TextButton({
                onPressed: this.confirm,
                child: new Text(
                  options.confirmText ?? localization.dateRangeLabel('okButtonLabel'),
                ),
              }),
            ],
          }),
          { alignment: AlignmentDirectional.centerEnd },
        ),
      ),
      new BoxConstraints(0, Infinity, 52),
    );
    const formColumn = [new Expanded(form), actions];
    if (landscape)
      return new Row(
        [header, new Expanded(new Column(formColumn, { crossAxisAlignment: 'stretch' }))],
        { crossAxisAlignment: 'stretch' },
      );
    const target = useMaterial3 ? _inputPortraitDialogSizeM3 : _inputPortraitDialogSizeM2;
    return new LayoutBuilder(
      (_context, constraints) =>
        new Column([...(constraints.maxHeight >= target.height ? [header] : []), ...formColumn], {
          crossAxisAlignment: 'stretch',
        }),
    );
  }

  override build(context: BuildContext): Widget {
    const mode = this.entryMode.value,
      editing = isInput(mode);
    const { options } = this.widget;
    const pickerTheme = DatePickerTheme.of(context);
    const useMaterial3 = SourceDateTheme.of(context).useMaterial3;
    const defaults = DatePickerTheme.defaults(context),
      dialogTheme = DialogTheme.of(context);
    const localization = this.localization;
    const help = localization.dateRangeLabel('dateRangePickerHelpText');
    const helpText = options.helpText ?? (useMaterial3 ? help : help.toUpperCase());
    const orientation = dateOrientationOf(context);
    const toggle =
      mode === calendarOnly || mode === inputOnly
        ? null
        : new IconButton({
            icon: editing
              ? (options.switchToCalendarEntryModeIcon ?? new Icon(Icons.calendar_today))
              : (options.switchToInputEntryModeIcon ??
                new Icon(useMaterial3 ? Icons.edit_outlined : Icons.edit)),
            padding: EdgeInsets.zero,
            tooltip: localization.dateRangeLabel(
              editing ? 'calendarModeButtonLabel' : 'inputDateModeButtonLabel',
            ),
            onPressed: this.switchMode,
          });
    const size = editing
      ? orientation === 'landscape'
        ? _inputRangeLandscapeDialogSize
        : useMaterial3
          ? _inputPortraitDialogSizeM3
          : _inputPortraitDialogSizeM2
      : MediaQuery.of(context);
    const contents = editing
      ? this.buildInput(context, orientation, helpText, toggle)
      : this.buildCalendar(context, orientation === 'landscape', helpText, toggle);
    return new Dialog({
      insetPadding: editing
        ? EdgeInsets.symmetric({ horizontal: 16, vertical: 24 })
        : EdgeInsets.zero,
      backgroundColor: pickerTheme.backgroundColor ?? defaults.backgroundColor,
      elevation: editing
        ? (pickerTheme.elevation ??
          (useMaterial3 ? defaults.elevation : (dialogTheme.elevation ?? 24)))
        : (pickerTheme.rangePickerElevation ?? defaults.rangePickerElevation),
      shadowColor: editing
        ? (pickerTheme.shadowColor ?? defaults.shadowColor)
        : (pickerTheme.rangePickerShadowColor ?? defaults.rangePickerShadowColor),
      surfaceTintColor: editing
        ? (pickerTheme.surfaceTintColor ?? defaults.surfaceTintColor)
        : (pickerTheme.rangePickerSurfaceTintColor ?? defaults.rangePickerSurfaceTintColor),
      shape: editing
        ? (pickerTheme.shape ??
          (useMaterial3 ? defaults.shape : (dialogTheme.shape ?? defaults.shape)))
        : (pickerTheme.rangePickerShape ?? defaults.rangePickerShape),
      clipBehavior: 'antiAlias',
      child: new AnimatedContainer({
        width: size.width,
        height: size.height,
        duration: _dialogSizeAnimationDuration,
        curve: Curves.easeIn,
        child: MediaQuery.withClampedTextScaling({
          maxScaleFactor: _kMaxRangeTextScaleFactor,
          child: contents,
        }),
      }),
    });
  }

  override dispose(): void {
    super.dispose();
    this.entryMode.dispose();
    this.selectedStart.dispose();
    this.selectedEnd.dispose();
    this.autoValidate.dispose();
    this.startController.dispose();
    this.endController.dispose();
  }
}
