// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Generated from packages/flutter/lib/src/material/date_picker.dart; SHA256 6d41d7d137cd63a73b0e9eeb2888d51e217c212b49152b4a32795bd630392285
import { protect } from '@nelyx/core/internal/ui/value-math';
import { checkedInteger } from '@nelyx/core/internal/ui/value-math';
import { invariant } from '@nelyx/core/foundation/errors';
import { FoundationBuildMode } from '@nelyx/core/foundation/constants';
import { dartMethodTearOff } from '@nelyx/core/internal/foundation/dart-method-tear-off';
import { dartLateInitialize } from '@nelyx/core/internal/foundation/dart-late';
import { Color } from '@nelyx/core/ui/color';
import { Offset } from '@nelyx/core/ui/offset';
import { Size } from '@nelyx/core/ui/size';
import { EdgeInsets } from '@nelyx/core/framework/painting/edge-insets';
import { EdgeInsetsDirectional } from '@nelyx/core/framework/painting/edge-insets';
import { GlobalKey } from '@nelyx/core/framework/widgets/global-key';
import { State } from '@nelyx/core/framework/widgets/framework';
import { StatefulWidget } from '@nelyx/core/framework/widgets/framework';
import { Widget } from '@nelyx/core/framework/widgets/framework';
import { Key } from '@nelyx/core/foundation/key';
import { Curves } from '@nelyx/core/framework/animation/curves';
import { DartMap } from '@nelyx/core/internal/foundation/dart-collections';
import { castSourceDartDouble } from '@nelyx/core/internal/foundation/dart-numeric';
import { ScrollbarStatefulHost } from '@nelyx/core/internal/framework/widgets/scrollbar-raw-source-adapter';
import { scrollbarGlobalKey } from '@nelyx/core/internal/framework/widgets/scrollbar-raw-source-adapter';
import { scrollbarRawObjectEquals } from '@nelyx/core/internal/framework/widgets/scrollbar-raw-source-adapter';
import { boxSourceDartInt } from '@nelyx/core/internal/foundation/dart-numeric';
import { boxSourceDartDouble } from '@nelyx/core/internal/foundation/dart-numeric';
import { castSourceDartInt } from '@nelyx/core/internal/foundation/dart-numeric';
import { dartRecord } from '@nelyx/core/internal/foundation/dart-record';
import { dartRecordRead } from '@nelyx/core/internal/foundation/dart-record';
import { ScrollbarStatelessHost } from '@nelyx/core/internal/framework/widgets/scrollbar-themed-source-adapter';
import { MaterialLocalizations } from '../../material-localizations.ts';
import { TextInputType } from '../../internal/date/source-input.ts';
import { dartValueString } from '@nelyx/core/internal/foundation/dart-value';
import { Icon } from '@nelyx/core/framework/widgets/icon';
import { constGregorianCalendarDelegate } from '../../internal/date/source-host.ts';
import { debugCheckHasMaterialLocalizations } from '../../internal/date/source-host.ts';
import { RestorableDateTimeN } from './restoration_properties.generated.ts';
import { RestorationMixin } from '../../internal/date/source-host.ts';
import { CalendarDelegate } from './date.generated.ts';
import { DateTime } from '../../internal/date/date-time.ts';
import { DatePickerEntryMode } from './date.generated.ts';
import { DatePickerMode } from './date.generated.ts';
import { CalendarDatePicker } from './calendar_date_picker.generated.ts';
import { MediaQuery } from '@nelyx/core/framework/widgets/app-data';
import { SizedBox } from '@nelyx/core/framework/widgets/basic';
import { Semantics } from '@nelyx/core/framework/widgets/semantics';
import { DatePickerThemeData } from '../../date-picker-theme-data.ts';
import { DatePickerTheme } from '../../date-picker-theme.ts';
import { TextStyle } from '@nelyx/core/framework/painting/text-style';
import { TextOverflow } from '@nelyx/core/framework/painting/text-painter';
import { Text } from '@nelyx/core/framework/widgets/basic';
import { Flexible } from '@nelyx/core/framework/widgets/basic';
import { Icons } from '../icons/icons.ts';
import { Intent } from '@nelyx/core/framework/widgets/actions';
import { LogicalKeyboardKey } from '@nelyx/core/services/keyboard-key';
import { SingleActivator } from '@nelyx/core/framework/widgets/shortcuts';
import { NextFocusIntent } from '@nelyx/core/framework/widgets/focus-traversal';
import { IconButton } from '../../icon-button.ts';
import { Material } from '../../material.ts';
import { Divider } from '../../divider.ts';
import { InputDatePickerFormField } from './input_date_picker_form_field.generated.ts';
import { Locale } from '@nelyx/core/ui/locale';
import { RouteSettings } from '@nelyx/core/framework/widgets/pages';
import { FormState } from '@nelyx/core/framework/widgets/form';
import { RestorationBucket } from '@nelyx/core/services/restoration';
import { TextTheme } from '../../text-theme.ts';
import { BoxConstraints } from '@nelyx/core/framework/rendering/constraints';
import { AlignmentDirectional } from '@nelyx/core/framework/painting/alignment';
import { TextButton } from '../../text-button.ts';
import { OverflowBar } from '@nelyx/core/framework/widgets/overflow-bar';
import { Form } from '@nelyx/core/framework/widgets/form';
import { DialogThemeData } from '../../dialog-theme-data.ts';
import { Flex } from '@nelyx/core/framework/widgets/basic';
import { VerticalDivider } from '../../divider.ts';
import { AnimatedContainer } from '@nelyx/core/framework/widgets/implicit-animations';
import { Dialog } from './dialog.generated.ts';
import { constdateShortcutActivatorIntentMap } from '../../internal/date/source-host.ts';
import { datePadding } from '../../internal/date/source-host.ts';
import { dateAlign } from '../../internal/date/source-host.ts';
import { dateConstrainedBox } from '../../internal/date/source-host.ts';
import { dateSizedBox } from '../../internal/date/source-host.ts';
import { dateColumn } from '../../internal/date/source-host.ts';
import { dateRow } from '../../internal/date/source-host.ts';
import { dateExpanded } from '../../internal/date/source-host.ts';
import { dateFlexible } from '../../internal/date/source-host.ts';
import { dateEnumString } from '../../internal/date/source-values.ts';
import { dateClampedTextScaling } from '../../internal/date/source-host.ts';
import { dateFormKey } from '../../internal/date/source-host.ts';
import { SourceRestorableValue } from '../../internal/date/source-host.ts';
import { minSourceDartNum } from '@nelyx/core/internal/foundation/dart-numeric-math';
import { sourceDartNumGreaterEqual } from '@nelyx/core/foundation/dart-numeric';
import { dateListAt } from '../../internal/date/source-values.ts';
import { dateLayoutBuilder } from '../../internal/date/source-host.ts';
import { dateDirectionality } from '../../internal/date/source-host.ts';
import { dateLocalizationsOverride } from '../../internal/date/source-host.ts';
import { dateShowDialog } from '../../internal/date/source-host.ts';
import { debugIsSerializableForRestoration } from '../../internal/date/source-host.ts';
import { constDateEdgeInsetsDirectionalOnly } from '../../internal/date/source-host.ts';
import { constDateEdgeInsetsSymmetric } from '../../internal/date/source-host.ts';
import { constDateSizedBox } from '../../internal/date/source-host.ts';
import { constDateSingleActivator } from '../../internal/date/source-host.ts';
import { constDateSize } from '../../internal/date/source-host.ts';
import { constDateNextFocusIntent } from '../../internal/date/source-host.ts';
import { constDateBoxConstraints } from '../../internal/date/source-host.ts';
import { constDateIcon } from '../../internal/date/source-host.ts';
import { constDateFlexible } from '../../internal/date/source-host.ts';
import { SourceDateThemeData } from '../../internal/date/source-theme.ts';
import { SourceDateTheme } from '../../internal/date/source-theme.ts';
import { dateForm } from '../../internal/date/source-host.ts';
import { dateShortcuts } from '../../internal/date/source-host.ts';
import { dateOrientationOf } from '../../internal/date/source-host.ts';
import { dateTextStyleCopyWith } from '../../internal/date/source-paint.ts';
import { dateText } from '../../internal/date/source-paint.ts';
import { dateNavigatorPop } from '../../internal/date/source-host.ts';
import { AutovalidateMode } from './form.generated.ts';
import type { ScrollbarTextDirection } from '@nelyx/core/internal/framework/widgets/scrollbar-painter-source-adapter';
import type { BuildContext } from '@nelyx/core/framework/widgets/framework';
import type { ScrollbarFuture } from '@nelyx/core/internal/framework/widgets/scrollbar-raw-source-adapter';
import type { DartRecord } from '@nelyx/core/internal/foundation/dart-record';
import type { Orientation } from '@nelyx/core/framework/widgets/orientation-builder';
import type { ShortcutActivator } from '@nelyx/core/framework/widgets/shortcuts';
export const _calendarPortraitDialogSizeM2: Size = constDateSize(Size, 330, 518);
export const _calendarPortraitDialogSizeM3: Size = constDateSize(Size, 360, 568);
export const _calendarLandscapeDialogSize: Size = constDateSize(Size, 496, 346);
export const _inputPortraitDialogSizeM2: Size = constDateSize(Size, 330, 270);
export const _inputPortraitDialogSizeM3: Size = constDateSize(Size, 328, 270);
export const _inputLandscapeDialogSize: Size = constDateSize(Size, 496, 160);
export const _inputRangeLandscapeDialogSize: Size = constDateSize(Size, 496, 164);
export const _dialogSizeAnimationDuration: number = 0 + 200 * 1;
/**
 * @dartType double
 * @dartTypeOrigin explicit
 */
export const _inputFormPortraitHeight: number = 98;
/**
 * @dartType double
 * @dartTypeOrigin explicit
 */
export const _inputFormLandscapeHeight: number = 108;
/**
 * @dartType double
 * @dartTypeOrigin explicit
 */
export const _kMaxTextScaleFactor: number = 3;
/**
 * @dartType double
 * @dartTypeOrigin explicit
 */
export const _kMaxRangeTextScaleFactor: number = 1.3;
/**
 * @dartType double
 * @dartTypeOrigin explicit
 */
export const _kMaxHeaderTextScaleFactor: number = 1.6;
/**
 * @dartType double
 * @dartTypeOrigin explicit
 */
export const _kMaxHeaderWithEntryTextScaleFactor: number = 1.4;
/**
 * @dartType double
 * @dartTypeOrigin explicit
 */
export const _kMaxHelpPortraitTextScaleFactor: number = 1.6;
/**
 * @dartType double
 * @dartTypeOrigin explicit
 */
export const _kMaxHelpLandscapeTextScaleFactor: number = 1.4;
/**
 * @dartType double
 * @dartTypeOrigin explicit
 */
export const _fontSizeToScale: number = 14;
export class DatePickerDialog extends ScrollbarStatefulHost {
  readonly initialDate: DateTime | null;
  readonly firstDate: DateTime;
  readonly lastDate: DateTime;
  readonly currentDate: DateTime;
  readonly initialEntryMode: DatePickerEntryMode;
  readonly selectableDayPredicate: ((argument0: DateTime) => boolean) | null;
  readonly cancelText: string | null;
  readonly confirmText: string | null;
  readonly helpText: string | null;
  readonly initialCalendarMode: DatePickerMode;
  readonly errorFormatText: string | null;
  readonly errorInvalidText: string | null;
  readonly fieldHintText: string | null;
  readonly fieldLabelText: string | null;
  readonly keyboardType: TextInputType | null;
  readonly restorationId: string | null;
  readonly onDatePickerModeChange: ((argument0: DatePickerEntryMode) => void) | null;
  readonly switchToInputEntryModeIcon: Icon | null;
  readonly switchToCalendarEntryModeIcon: Icon | null;
  readonly insetPadding: EdgeInsets;
  readonly calendarDelegate: CalendarDelegate<DateTime>;
  constructor({
    key = null,
    initialDate = null,
    firstDate,
    lastDate,
    currentDate = null,
    initialEntryMode = DatePickerEntryMode.calendar,
    selectableDayPredicate = null,
    cancelText = null,
    confirmText = null,
    helpText = null,
    initialCalendarMode = DatePickerMode.day,
    errorFormatText = null,
    errorInvalidText = null,
    fieldHintText = null,
    fieldLabelText = null,
    keyboardType = null,
    restorationId = null,
    onDatePickerModeChange = null,
    switchToInputEntryModeIcon = null,
    switchToCalendarEntryModeIcon = null,
    insetPadding = constDateEdgeInsetsSymmetric(EdgeInsets, { horizontal: 16, vertical: 24 }),
    calendarDelegate = constGregorianCalendarDelegate(),
  }: {
    readonly key?: Key | null;
    readonly initialDate?: DateTime | null;
    readonly firstDate: DateTime;
    readonly lastDate: DateTime;
    readonly currentDate?: DateTime | null;
    readonly initialEntryMode?: DatePickerEntryMode;
    readonly selectableDayPredicate?: ((argument0: DateTime) => boolean) | null;
    readonly cancelText?: string | null;
    readonly confirmText?: string | null;
    readonly helpText?: string | null;
    readonly initialCalendarMode?: DatePickerMode;
    readonly errorFormatText?: string | null;
    readonly errorInvalidText?: string | null;
    readonly fieldHintText?: string | null;
    readonly fieldLabelText?: string | null;
    readonly keyboardType?: TextInputType | null;
    readonly restorationId?: string | null;
    readonly onDatePickerModeChange?: ((argument0: DatePickerEntryMode) => void) | null;
    readonly switchToInputEntryModeIcon?: Icon | null;
    readonly switchToCalendarEntryModeIcon?: Icon | null;
    readonly insetPadding?: EdgeInsets;
    readonly calendarDelegate?: CalendarDelegate<DateTime>;
  }) {
    const _initialField0 = initialEntryMode;
    const _initialField1 = selectableDayPredicate;
    const _initialField2 = cancelText;
    const _initialField3 = confirmText;
    const _initialField4 = helpText;
    const _initialField5 = initialCalendarMode;
    const _initialField6 = errorFormatText;
    const _initialField7 = errorInvalidText;
    const _initialField8 = fieldHintText;
    const _initialField9 = fieldLabelText;
    const _initialField10 = keyboardType;
    const _initialField11 = restorationId;
    const _initialField12 = onDatePickerModeChange;
    const _initialField13 = switchToInputEntryModeIcon;
    const _initialField14 = switchToCalendarEntryModeIcon;
    const _initialField15 = insetPadding;
    const _initialField16 = calendarDelegate;
    const _initialField17 =
      initialDate === null ? null : calendarDelegate.dateOnly(initialDate as DateTime);
    const _initialField18 = calendarDelegate.dateOnly(firstDate);
    const _initialField19 = calendarDelegate.dateOnly(lastDate);
    const _initialField20 = calendarDelegate.dateOnly(currentDate ?? calendarDelegate.now());
    super({ key: key });
    this.initialDate = _initialField17;
    this.firstDate = _initialField18;
    this.lastDate = _initialField19;
    this.currentDate = _initialField20;
    this.initialEntryMode = _initialField0;
    this.selectableDayPredicate = _initialField1;
    this.cancelText = _initialField2;
    this.confirmText = _initialField3;
    this.helpText = _initialField4;
    this.initialCalendarMode = _initialField5;
    this.errorFormatText = _initialField6;
    this.errorInvalidText = _initialField7;
    this.fieldHintText = _initialField8;
    this.fieldLabelText = _initialField9;
    this.keyboardType = _initialField10;
    this.restorationId = _initialField11;
    this.onDatePickerModeChange = _initialField12;
    this.switchToInputEntryModeIcon = _initialField13;
    this.switchToCalendarEntryModeIcon = _initialField14;
    this.insetPadding = _initialField15;
    this.calendarDelegate = _initialField16;
    protect(this, [
      'initialDate',
      'firstDate',
      'lastDate',
      'currentDate',
      'initialEntryMode',
      'selectableDayPredicate',
      'cancelText',
      'confirmText',
      'helpText',
      'initialCalendarMode',
      'errorFormatText',
      'errorInvalidText',
      'fieldHintText',
      'fieldLabelText',
      'keyboardType',
      'restorationId',
      'onDatePickerModeChange',
      'switchToInputEntryModeIcon',
      'switchToCalendarEntryModeIcon',
      'insetPadding',
      'calendarDelegate',
    ]);
    if (FoundationBuildMode.debug)
      invariant(
        !this.lastDate.isBefore(this.firstDate),
        'generated-source-assert',
        `lastDate ${dartValueString(this.lastDate)} must be on or after firstDate ${dartValueString(this.firstDate)}.`,
      );
    if (FoundationBuildMode.debug)
      invariant(
        initialDate === null ||
          !(() => {
            const _dartTemporary0 = this.initialDate;
            if (_dartTemporary0 === null)
              throw new TypeError('Null check operator used on a null value');
            return _dartTemporary0!;
          })().isBefore(this.firstDate),
        'generated-source-assert',
        `initialDate ${(() => {
          const _dartTemporary1 = this.initialDate;
          return _dartTemporary1 === null ? 'null' : dartValueString(_dartTemporary1);
        })()} must be on or after firstDate ${dartValueString(this.firstDate)}.`,
      );
    if (FoundationBuildMode.debug)
      invariant(
        initialDate === null ||
          !(() => {
            const _dartTemporary2 = this.initialDate;
            if (_dartTemporary2 === null)
              throw new TypeError('Null check operator used on a null value');
            return _dartTemporary2!;
          })().isAfter(this.lastDate),
        'generated-source-assert',
        `initialDate ${(() => {
          const _dartTemporary3 = this.initialDate;
          return _dartTemporary3 === null ? 'null' : dartValueString(_dartTemporary3);
        })()} must be on or before lastDate ${dartValueString(this.lastDate)}.`,
      );
    if (FoundationBuildMode.debug)
      invariant(
        this.selectableDayPredicate === null ||
          initialDate === null ||
          (() => {
            const _dartTemporary4 = this.selectableDayPredicate;
            if (_dartTemporary4 === null)
              throw new TypeError('Null check operator used on a null value');
            return _dartTemporary4!;
          })()(
            (() => {
              const _dartTemporary5 = this.initialDate;
              if (_dartTemporary5 === null)
                throw new TypeError('Null check operator used on a null value');
              return _dartTemporary5!;
            })(),
          ),
        'generated-source-assert',
        `Provided initialDate ${(() => {
          const _dartTemporary6 = this.initialDate;
          return _dartTemporary6 === null ? 'null' : dartValueString(_dartTemporary6);
        })()} must satisfy provided selectableDayPredicate`,
      );
  }
  override createState(): State<DatePickerDialog> {
    return new _DatePickerDialogState();
  }
}
export class _DatePickerDialogState extends RestorationMixin<DatePickerDialog> {
  get _dart_b85857c463f8c355_selectedDate(): RestorableDateTimeN {
    return dartLateInitialize<RestorableDateTimeN>(
      this,
      'package:flutter/src/material/date_picker.dart::_DatePickerDialogState._selectedDate:FIELD',
      '_selectedDate',
      () => new RestorableDateTimeN(this.widget.initialDate),
      true,
    );
  }
  get _dart_b85857c463f8c355_entryMode(): _RestorableDatePickerEntryMode {
    return dartLateInitialize<_RestorableDatePickerEntryMode>(
      this,
      'package:flutter/src/material/date_picker.dart::_DatePickerDialogState._entryMode:FIELD',
      '_entryMode',
      () => new _RestorableDatePickerEntryMode(this.widget.initialEntryMode),
      true,
    );
  }
  readonly _dart_b85857c463f8c355_autovalidateMode: _RestorableAutovalidateMode;
  readonly _dart_b85857c463f8c355_calendarPickerKey: GlobalKey<State<StatefulWidget>>;
  readonly _dart_b85857c463f8c355_formKey: GlobalKey<FormState>;
  static readonly _dart_b85857c463f8c355_formShortcutMap: DartMap<ShortcutActivator, Intent> =
    constdateShortcutActivatorIntentMap([
      [
        constDateSingleActivator(SingleActivator, LogicalKeyboardKey.enter),
        constDateNextFocusIntent(NextFocusIntent),
      ],
    ]);
  constructor() {
    const _initialField0 = new _RestorableAutovalidateMode(AutovalidateMode.disabled);
    const _initialField1 = scrollbarGlobalKey();
    const _initialField2 = dateFormKey();
    super();
    this._dart_b85857c463f8c355_autovalidateMode = _initialField0;
    this._dart_b85857c463f8c355_calendarPickerKey = _initialField1;
    this._dart_b85857c463f8c355_formKey = _initialField2;
    protect(this, [
      '_dart_b85857c463f8c355_autovalidateMode',
      '_dart_b85857c463f8c355_calendarPickerKey',
      '_dart_b85857c463f8c355_formKey',
    ]);
  }
  override dispose(): void {
    void this._dart_b85857c463f8c355_selectedDate.dispose();
    void this._dart_b85857c463f8c355_entryMode.dispose();
    void this._dart_b85857c463f8c355_autovalidateMode.dispose();
    void super.dispose();
  }
  override get restorationId(): string | null {
    return this.widget.restorationId;
  }
  override restoreState(oldBucket: RestorationBucket | null, initialRestore: boolean): void {
    void this.registerForRestoration(this._dart_b85857c463f8c355_selectedDate, 'selected_date');
    void this.registerForRestoration(
      this._dart_b85857c463f8c355_autovalidateMode,
      'autovalidateMode',
    );
    void this.registerForRestoration(this._dart_b85857c463f8c355_entryMode, 'calendar_entry_mode');
  }
  _dart_b85857c463f8c355_handleOk(): void {
    if (
      scrollbarRawObjectEquals(
        this._dart_b85857c463f8c355_entryMode.value,
        DatePickerEntryMode.input,
      ) ||
      scrollbarRawObjectEquals(
        this._dart_b85857c463f8c355_entryMode.value,
        DatePickerEntryMode.inputOnly,
      )
    ) {
      const form: FormState = (() => {
        const _dartTemporary7 = this._dart_b85857c463f8c355_formKey.currentState;
        if (_dartTemporary7 === null)
          throw new TypeError('Null check operator used on a null value');
        return _dartTemporary7!;
      })();
      if (!form.validate()) {
        void this.setState((): void => {
          void (this._dart_b85857c463f8c355_autovalidateMode.value = AutovalidateMode.always);
        });
        return;
      }
      void form.save();
    }
    void dateNavigatorPop(this.context, this._dart_b85857c463f8c355_selectedDate.value);
  }
  _dart_b85857c463f8c355_handleCancel(): void {
    void dateNavigatorPop(this.context);
  }
  _dart_b85857c463f8c355_handleOnDatePickerModeChange(): void {
    void (() => {
      const _dartTemporary8 = this.widget.onDatePickerModeChange;
      if (_dartTemporary8 === null) return null;
      return _dartTemporary8!(this._dart_b85857c463f8c355_entryMode.value);
    })();
  }
  _dart_b85857c463f8c355_handleEntryModeToggle(): void {
    void this.setState((): void => {
      switch (this._dart_b85857c463f8c355_entryMode.value) {
        case DatePickerEntryMode.calendar: {
          void (this._dart_b85857c463f8c355_autovalidateMode.value = AutovalidateMode.disabled);
          void (this._dart_b85857c463f8c355_entryMode.value = DatePickerEntryMode.input);
          void this._dart_b85857c463f8c355_handleOnDatePickerModeChange();
          break;
        }
        case DatePickerEntryMode.input: {
          void (() => {
            const _dartTemporary9 = this._dart_b85857c463f8c355_formKey.currentState;
            if (_dartTemporary9 === null)
              throw new TypeError('Null check operator used on a null value');
            return _dartTemporary9!;
          })().save();
          void (this._dart_b85857c463f8c355_entryMode.value = DatePickerEntryMode.calendar);
          void this._dart_b85857c463f8c355_handleOnDatePickerModeChange();
          break;
        }
        case DatePickerEntryMode.calendarOnly:
        case DatePickerEntryMode.inputOnly: {
          if (FoundationBuildMode.debug)
            invariant(
              false,
              'generated-source-assert',
              `Can not change entry mode from ${dateEnumString(this._dart_b85857c463f8c355_entryMode.value)}`,
            );
          break;
        }
        default:
          throw new TypeError('Invalid value outside exhaustive Dart switch');
      }
    });
  }
  _dart_b85857c463f8c355_handleDateChanged(date: DateTime): void {
    void this.setState((): void => {
      void (this._dart_b85857c463f8c355_selectedDate.value = date);
    });
  }
  _dart_b85857c463f8c355_dialogSize(context: BuildContext): Size {
    const useMaterial3: boolean = SourceDateTheme.of(context).useMaterial3;
    const isCalendar: boolean = (() => {
      const _dartTemporary10 = this._dart_b85857c463f8c355_entryMode.value;
      switch (_dartTemporary10) {
        case DatePickerEntryMode.calendar:
          return true;
        case DatePickerEntryMode.calendarOnly:
          return true;
        case DatePickerEntryMode.input:
          return false;
        case DatePickerEntryMode.inputOnly:
          return false;
        default:
          throw new TypeError('Non-exhaustive Dart switch expression');
      }
    })();
    const orientation: Orientation = dateOrientationOf(context);
    return ((): Size => {
      const _dartTemporary11 = dartRecord([isCalendar, orientation] as const);
      let _dartTemporary13: unknown;
      let _dartTemporary14 = false;
      let _dartTemporary15: unknown;
      let _dartTemporary16 = false;
      let _dartTemporary17: unknown;
      let _dartTemporary18 = false;
      const _dartTemporary12 = (() => {
        if (!_dartTemporary14) {
          try {
            _dartTemporary15 = dartRecordRead(
              _dartTemporary11 as DartRecord<readonly unknown[]>,
              0,
              2,
            );
            _dartTemporary16 = true;
            _dartTemporary13 = true;
          } catch {
            _dartTemporary13 = false;
          }
          _dartTemporary14 = true;
        }
        if (!_dartTemporary13) return null;
        if (!_dartTemporary16) {
          _dartTemporary15 = dartRecordRead(
            _dartTemporary11 as DartRecord<readonly unknown[]>,
            0,
            2,
          );
          _dartTemporary16 = true;
        }
        if (!(true === _dartTemporary15)) return null;
        if (!_dartTemporary18) {
          _dartTemporary17 = dartRecordRead(
            _dartTemporary11 as DartRecord<readonly unknown[]>,
            1,
            2,
          );
          _dartTemporary18 = true;
        }
        if (!('portrait' === _dartTemporary17)) return null;
        if (!useMaterial3) return null;
        return {};
      })();
      if (_dartTemporary12 !== null) {
        return _calendarPortraitDialogSizeM3;
      }
      const _dartTemporary19 = (() => {
        if (!_dartTemporary14) {
          try {
            _dartTemporary15 = dartRecordRead(
              _dartTemporary11 as DartRecord<readonly unknown[]>,
              0,
              2,
            );
            _dartTemporary16 = true;
            _dartTemporary13 = true;
          } catch {
            _dartTemporary13 = false;
          }
          _dartTemporary14 = true;
        }
        if (!_dartTemporary13) return null;
        if (!_dartTemporary16) {
          _dartTemporary15 = dartRecordRead(
            _dartTemporary11 as DartRecord<readonly unknown[]>,
            0,
            2,
          );
          _dartTemporary16 = true;
        }
        if (!(false === _dartTemporary15)) return null;
        if (!_dartTemporary18) {
          _dartTemporary17 = dartRecordRead(
            _dartTemporary11 as DartRecord<readonly unknown[]>,
            1,
            2,
          );
          _dartTemporary18 = true;
        }
        if (!('portrait' === _dartTemporary17)) return null;
        if (!useMaterial3) return null;
        return {};
      })();
      if (_dartTemporary19 !== null) {
        return _inputPortraitDialogSizeM3;
      }
      const _dartTemporary20 = (() => {
        if (!_dartTemporary14) {
          try {
            _dartTemporary15 = dartRecordRead(
              _dartTemporary11 as DartRecord<readonly unknown[]>,
              0,
              2,
            );
            _dartTemporary16 = true;
            _dartTemporary13 = true;
          } catch {
            _dartTemporary13 = false;
          }
          _dartTemporary14 = true;
        }
        if (!_dartTemporary13) return null;
        if (!_dartTemporary16) {
          _dartTemporary15 = dartRecordRead(
            _dartTemporary11 as DartRecord<readonly unknown[]>,
            0,
            2,
          );
          _dartTemporary16 = true;
        }
        if (!(true === _dartTemporary15)) return null;
        if (!_dartTemporary18) {
          _dartTemporary17 = dartRecordRead(
            _dartTemporary11 as DartRecord<readonly unknown[]>,
            1,
            2,
          );
          _dartTemporary18 = true;
        }
        if (!('portrait' === _dartTemporary17)) return null;
        return {};
      })();
      if (_dartTemporary20 !== null) {
        return _calendarPortraitDialogSizeM2;
      }
      const _dartTemporary21 = (() => {
        if (!_dartTemporary14) {
          try {
            _dartTemporary15 = dartRecordRead(
              _dartTemporary11 as DartRecord<readonly unknown[]>,
              0,
              2,
            );
            _dartTemporary16 = true;
            _dartTemporary13 = true;
          } catch {
            _dartTemporary13 = false;
          }
          _dartTemporary14 = true;
        }
        if (!_dartTemporary13) return null;
        if (!_dartTemporary16) {
          _dartTemporary15 = dartRecordRead(
            _dartTemporary11 as DartRecord<readonly unknown[]>,
            0,
            2,
          );
          _dartTemporary16 = true;
        }
        if (!(false === _dartTemporary15)) return null;
        if (!_dartTemporary18) {
          _dartTemporary17 = dartRecordRead(
            _dartTemporary11 as DartRecord<readonly unknown[]>,
            1,
            2,
          );
          _dartTemporary18 = true;
        }
        if (!('portrait' === _dartTemporary17)) return null;
        return {};
      })();
      if (_dartTemporary21 !== null) {
        return _inputPortraitDialogSizeM2;
      }
      const _dartTemporary22 = (() => {
        if (!_dartTemporary14) {
          try {
            _dartTemporary15 = dartRecordRead(
              _dartTemporary11 as DartRecord<readonly unknown[]>,
              0,
              2,
            );
            _dartTemporary16 = true;
            _dartTemporary13 = true;
          } catch {
            _dartTemporary13 = false;
          }
          _dartTemporary14 = true;
        }
        if (!_dartTemporary13) return null;
        if (!_dartTemporary16) {
          _dartTemporary15 = dartRecordRead(
            _dartTemporary11 as DartRecord<readonly unknown[]>,
            0,
            2,
          );
          _dartTemporary16 = true;
        }
        if (!(true === _dartTemporary15)) return null;
        if (!_dartTemporary18) {
          _dartTemporary17 = dartRecordRead(
            _dartTemporary11 as DartRecord<readonly unknown[]>,
            1,
            2,
          );
          _dartTemporary18 = true;
        }
        if (!('landscape' === _dartTemporary17)) return null;
        return {};
      })();
      if (_dartTemporary22 !== null) {
        return _calendarLandscapeDialogSize;
      }
      const _dartTemporary23 = (() => {
        if (!_dartTemporary14) {
          try {
            _dartTemporary15 = dartRecordRead(
              _dartTemporary11 as DartRecord<readonly unknown[]>,
              0,
              2,
            );
            _dartTemporary16 = true;
            _dartTemporary13 = true;
          } catch {
            _dartTemporary13 = false;
          }
          _dartTemporary14 = true;
        }
        if (!_dartTemporary13) return null;
        if (!_dartTemporary16) {
          _dartTemporary15 = dartRecordRead(
            _dartTemporary11 as DartRecord<readonly unknown[]>,
            0,
            2,
          );
          _dartTemporary16 = true;
        }
        if (!(false === _dartTemporary15)) return null;
        if (!_dartTemporary18) {
          _dartTemporary17 = dartRecordRead(
            _dartTemporary11 as DartRecord<readonly unknown[]>,
            1,
            2,
          );
          _dartTemporary18 = true;
        }
        if (!('landscape' === _dartTemporary17)) return null;
        return {};
      })();
      if (_dartTemporary23 !== null) {
        return _inputLandscapeDialogSize;
      }
      throw new TypeError('Non-exhaustive Dart pattern switch');
    })();
  }
  override build(context: BuildContext): Widget {
    const theme: SourceDateThemeData = SourceDateTheme.of(context);
    const useMaterial3: boolean = theme.useMaterial3;
    const localizations: MaterialLocalizations = MaterialLocalizations.of(context);
    const orientation: Orientation = dateOrientationOf(context);
    const isLandscapeOrientation: boolean = scrollbarRawObjectEquals(orientation, 'landscape');
    const datePickerTheme: DatePickerThemeData = DatePickerTheme.of(context);
    const defaults: DatePickerThemeData = DatePickerTheme.defaults(context);
    const textTheme: TextTheme = theme.textTheme;
    let headlineStyle: TextStyle | null = null;
    if (useMaterial3) {
      void (headlineStyle = datePickerTheme.headerHeadlineStyle ?? defaults.headerHeadlineStyle);
      switch (this._dart_b85857c463f8c355_entryMode.value) {
        case DatePickerEntryMode.input:
        case DatePickerEntryMode.inputOnly: {
          if (scrollbarRawObjectEquals(orientation, 'landscape')) {
            void (headlineStyle = textTheme.headlineSmall);
          }
          break;
        }
        case DatePickerEntryMode.calendar:
        case DatePickerEntryMode.calendarOnly:
          break;
        default:
          throw new TypeError('Invalid value outside exhaustive Dart switch');
      }
    } else {
      void (headlineStyle = isLandscapeOrientation
        ? textTheme.headlineSmall
        : textTheme.headlineMedium);
    }
    const headerForegroundColor: Color | null =
      datePickerTheme.headerForegroundColor ?? defaults.headerForegroundColor;
    void (headlineStyle = (() => {
      const _dartTemporary24 = headlineStyle;
      return _dartTemporary24 === null
        ? null
        : dateTextStyleCopyWith(_dartTemporary24, { color: headerForegroundColor });
    })());
    const actions: Widget = dateConstrainedBox({
      constraints: constDateBoxConstraints(BoxConstraints, { minHeight: 52 }),
      child: dateClampedTextScaling({
        maxScaleFactor: isLandscapeOrientation ? 1.6 : _kMaxTextScaleFactor,
        child: datePadding({
          padding: constDateEdgeInsetsSymmetric(EdgeInsets, { horizontal: 8 }),
          child: dateAlign({
            alignment: AlignmentDirectional.centerEnd,
            child: new OverflowBar({
              spacing: 8,
              children: [
                new TextButton({
                  style: datePickerTheme.cancelButtonStyle ?? defaults.cancelButtonStyle,
                  onPressed: dartMethodTearOff(this, this._dart_b85857c463f8c355_handleCancel),
                  child: dateText(
                    this.widget.cancelText ??
                      (useMaterial3
                        ? localizations.cancelButtonLabel
                        : localizations.cancelButtonLabel.toUpperCase()),
                  ),
                }),
                new TextButton({
                  style: datePickerTheme.confirmButtonStyle ?? defaults.confirmButtonStyle,
                  onPressed: dartMethodTearOff(this, this._dart_b85857c463f8c355_handleOk),
                  child: dateText(this.widget.confirmText ?? localizations.okButtonLabel),
                }),
              ],
            }),
          }),
        }),
      }),
    });
    const calendarDatePicker: () => CalendarDatePicker = (): CalendarDatePicker => {
      return new CalendarDatePicker({
        calendarDelegate: this.widget.calendarDelegate,
        key: this._dart_b85857c463f8c355_calendarPickerKey,
        initialDate: this._dart_b85857c463f8c355_selectedDate.value,
        firstDate: this.widget.firstDate,
        lastDate: this.widget.lastDate,
        currentDate: this.widget.currentDate,
        onDateChanged: dartMethodTearOff(this, this._dart_b85857c463f8c355_handleDateChanged),
        selectableDayPredicate: this.widget.selectableDayPredicate,
        initialCalendarMode: this.widget.initialCalendarMode,
      });
    };
    const inputDatePicker: () => Form = (): Form => {
      return dateForm({
        key: this._dart_b85857c463f8c355_formKey,
        autovalidateMode: this._dart_b85857c463f8c355_autovalidateMode.value,
        child: dateSizedBox({
          height: scrollbarRawObjectEquals(orientation, 'portrait')
            ? _inputFormPortraitHeight
            : _inputFormLandscapeHeight,
          child: datePadding({
            padding: constDateEdgeInsetsSymmetric(EdgeInsets, { horizontal: 24 }),
            child: dateShortcuts({
              shortcuts: _DatePickerDialogState._dart_b85857c463f8c355_formShortcutMap,
              child: dateColumn({
                mainAxisAlignment: 'center',
                children: [
                  dateFlexible({
                    child: dateClampedTextScaling({
                      maxScaleFactor: 2,
                      child: new InputDatePickerFormField({
                        calendarDelegate: this.widget.calendarDelegate,
                        initialDate: this._dart_b85857c463f8c355_selectedDate.value,
                        firstDate: this.widget.firstDate,
                        lastDate: this.widget.lastDate,
                        onDateSubmitted: dartMethodTearOff(
                          this,
                          this._dart_b85857c463f8c355_handleDateChanged,
                        ),
                        onDateSaved: dartMethodTearOff(
                          this,
                          this._dart_b85857c463f8c355_handleDateChanged,
                        ),
                        selectableDayPredicate: this.widget.selectableDayPredicate,
                        errorFormatText: this.widget.errorFormatText,
                        errorInvalidText: this.widget.errorInvalidText,
                        fieldHintText: this.widget.fieldHintText,
                        fieldLabelText: this.widget.fieldLabelText,
                        keyboardType: this.widget.keyboardType,
                        autofocus: true,
                      }),
                    }),
                  }),
                ],
              }),
            }),
          }),
        }),
      });
    };
    let picker: Widget;
    let entryModeButton: Widget | null = null;
    switch (this._dart_b85857c463f8c355_entryMode.value) {
      case DatePickerEntryMode.calendar: {
        void (picker = calendarDatePicker());
        void (entryModeButton = new IconButton({
          icon:
            this.widget.switchToInputEntryModeIcon ??
            new Icon(useMaterial3 ? Icons.edit_outlined : Icons.edit),
          color: headerForegroundColor,
          tooltip: localizations.inputDateModeButtonLabel,
          onPressed: dartMethodTearOff(this, this._dart_b85857c463f8c355_handleEntryModeToggle),
        }));
        break;
      }
      case DatePickerEntryMode.calendarOnly: {
        void (picker = calendarDatePicker());
        void (entryModeButton = null);
        break;
      }
      case DatePickerEntryMode.input: {
        void (picker = inputDatePicker());
        void (entryModeButton = new IconButton({
          icon:
            this.widget.switchToCalendarEntryModeIcon ?? constDateIcon(Icon, Icons.calendar_today),
          color: headerForegroundColor,
          tooltip: localizations.calendarModeButtonLabel,
          onPressed: dartMethodTearOff(this, this._dart_b85857c463f8c355_handleEntryModeToggle),
        }));
        break;
      }
      case DatePickerEntryMode.inputOnly: {
        void (picker = inputDatePicker());
        void (entryModeButton = null);
        break;
      }
      default:
        throw new TypeError('Invalid value outside exhaustive Dart switch');
    }
    const header: Widget = new _DatePickerHeader({
      helpText:
        this.widget.helpText ??
        (useMaterial3
          ? localizations.datePickerHelpText
          : localizations.datePickerHelpText.toUpperCase()),
      titleText:
        this._dart_b85857c463f8c355_selectedDate.value === null
          ? ''
          : this.widget.calendarDelegate.formatMediumDate(
              (() => {
                const _dartTemporary25 = this._dart_b85857c463f8c355_selectedDate.value;
                if (_dartTemporary25 === null)
                  throw new TypeError('Null check operator used on a null value');
                return _dartTemporary25!;
              })(),
              localizations,
            ),
      titleStyle: headlineStyle,
      orientation: orientation,
      isShort: scrollbarRawObjectEquals(orientation, 'landscape'),
      entryModeButton: entryModeButton,
    });
    /**
     * @dartType double
     * @dartTypeOrigin explicit
     */
    const textScaleFactor: number =
      MediaQuery.textScalerOf(context)
        .clamp({ maxScaleFactor: _kMaxTextScaleFactor })
        .scale(_fontSizeToScale) / _fontSizeToScale;
    const dialogSize: Size =
      this._dart_b85857c463f8c355_dialogSize(context).multiply(textScaleFactor);
    const dialogTheme: DialogThemeData = theme.dialogTheme;
    return new Dialog({
      backgroundColor: datePickerTheme.backgroundColor ?? defaults.backgroundColor,
      elevation: useMaterial3
        ? (datePickerTheme.elevation ??
          (() => {
            const _dartTemporary26 = defaults.elevation;
            if (_dartTemporary26 === null)
              throw new TypeError('Null check operator used on a null value');
            return _dartTemporary26!;
          })())
        : (datePickerTheme.elevation ?? dialogTheme.elevation ?? 24),
      shadowColor: datePickerTheme.shadowColor ?? defaults.shadowColor,
      surfaceTintColor: datePickerTheme.surfaceTintColor ?? defaults.surfaceTintColor,
      shape: useMaterial3
        ? (datePickerTheme.shape ?? defaults.shape)
        : (datePickerTheme.shape ?? dialogTheme.shape ?? defaults.shape),
      insetPadding: this.widget.insetPadding,
      clipBehavior: 'antiAlias',
      child: new AnimatedContainer({
        width: dialogSize.width,
        height: dialogSize.height,
        duration: _dialogSizeAnimationDuration,
        curve: Curves.easeIn,
        child: dateClampedTextScaling({
          maxScaleFactor: _kMaxTextScaleFactor,
          child: dateLayoutBuilder({
            builder: (context: BuildContext, constraints: BoxConstraints): Flex => {
              const portraitDialogSize: Size = useMaterial3
                ? _inputPortraitDialogSizeM3
                : _inputPortraitDialogSizeM2;
              const isFullyPortrait: boolean = sourceDartNumGreaterEqual(
                boxSourceDartDouble(constraints.maxHeight),
                minSourceDartNum(
                  boxSourceDartDouble(dialogSize.height),
                  boxSourceDartDouble(portraitDialogSize.height),
                ),
              );
              switch (orientation) {
                case 'portrait': {
                  const isInputMode: boolean =
                    scrollbarRawObjectEquals(
                      this._dart_b85857c463f8c355_entryMode.value,
                      DatePickerEntryMode.inputOnly,
                    ) ||
                    scrollbarRawObjectEquals(
                      this._dart_b85857c463f8c355_entryMode.value,
                      DatePickerEntryMode.input,
                    );
                  const showHeader: boolean = isFullyPortrait || !isInputMode;
                  const showPicker: boolean = isFullyPortrait || isInputMode;
                  return dateColumn({
                    mainAxisSize: 'min',
                    crossAxisAlignment: 'stretch',
                    children: (() => {
                      const _dartTemporary27: Widget[] = [];
                      if (showHeader) _dartTemporary27.push(header);
                      if (useMaterial3)
                        _dartTemporary27.push(
                          new Divider({ height: 0, color: datePickerTheme.dividerColor }),
                        );
                      if (showPicker) {
                        const _dartTemporary28 = [dateExpanded({ child: picker }), actions];
                        for (const _dartTemporary29 of _dartTemporary28)
                          _dartTemporary27.push(_dartTemporary29);
                      }
                      return _dartTemporary27;
                    })(),
                  });
                }
                case 'landscape': {
                  return dateRow({
                    mainAxisSize: 'min',
                    crossAxisAlignment: 'stretch',
                    children: (() => {
                      const _dartTemporary30: Widget[] = [];
                      _dartTemporary30.push(header);
                      if (useMaterial3)
                        _dartTemporary30.push(
                          new VerticalDivider({ width: 0, color: datePickerTheme.dividerColor }),
                        );
                      _dartTemporary30.push(
                        dateFlexible({
                          child: dateColumn({
                            mainAxisSize: 'min',
                            crossAxisAlignment: 'stretch',
                            children: [dateExpanded({ child: picker }), actions],
                          }),
                        }),
                      );
                      return _dartTemporary30;
                    })(),
                  });
                }
                default:
                  throw new TypeError('Invalid value outside exhaustive Dart switch');
              }
            },
          }),
        }),
      }),
    });
  }
}
protect(_DatePickerDialogState, ['_dart_b85857c463f8c355_formShortcutMap']);
export class _RestorableDatePickerEntryMode extends SourceRestorableValue<DatePickerEntryMode> {
  readonly _dart_b85857c463f8c355_defaultValue: DatePickerEntryMode;
  constructor(defaultValue: DatePickerEntryMode) {
    const _initialField0 = defaultValue;
    super();
    this._dart_b85857c463f8c355_defaultValue = _initialField0;
    protect(this, ['_dart_b85857c463f8c355_defaultValue']);
  }
  override createDefaultValue(): DatePickerEntryMode {
    return this._dart_b85857c463f8c355_defaultValue;
  }
  override didUpdateValue(oldValue: DatePickerEntryMode | null): void {
    if (FoundationBuildMode.debug)
      invariant(
        debugIsSerializableForRestoration(boxSourceDartInt(checkedInteger(this.value.index))),
        'generated-source-assert',
        'Pinned Dart assertion failed',
      );
    void this.notifyListeners();
  }
  override fromPrimitives(data: {} | null): DatePickerEntryMode {
    return dateListAt(
      DatePickerEntryMode.values,
      checkedInteger(
        castSourceDartInt(
          (() => {
            const _dartTemporary31 = data;
            if (_dartTemporary31 === null)
              throw new TypeError('Null check operator used on a null value');
            return _dartTemporary31!;
          })(),
        ),
      ),
    );
  }
  override toPrimitives(): {} | null {
    return boxSourceDartInt(checkedInteger(this.value.index));
  }
}
export class _RestorableAutovalidateMode extends SourceRestorableValue<AutovalidateMode> {
  readonly _dart_b85857c463f8c355_defaultValue: AutovalidateMode;
  constructor(defaultValue: AutovalidateMode) {
    const _initialField0 = defaultValue;
    super();
    this._dart_b85857c463f8c355_defaultValue = _initialField0;
    protect(this, ['_dart_b85857c463f8c355_defaultValue']);
  }
  override createDefaultValue(): AutovalidateMode {
    return this._dart_b85857c463f8c355_defaultValue;
  }
  override didUpdateValue(oldValue: AutovalidateMode | null): void {
    if (FoundationBuildMode.debug)
      invariant(
        debugIsSerializableForRestoration(boxSourceDartInt(checkedInteger(this.value.index))),
        'generated-source-assert',
        'Pinned Dart assertion failed',
      );
    void this.notifyListeners();
  }
  override fromPrimitives(data: {} | null): AutovalidateMode {
    return dateListAt(
      AutovalidateMode.values,
      checkedInteger(
        castSourceDartInt(
          (() => {
            const _dartTemporary32 = data;
            if (_dartTemporary32 === null)
              throw new TypeError('Null check operator used on a null value');
            return _dartTemporary32!;
          })(),
        ),
      ),
    );
  }
  override toPrimitives(): {} | null {
    return boxSourceDartInt(checkedInteger(this.value.index));
  }
}
export class _DatePickerHeader extends ScrollbarStatelessHost {
  readonly helpText: string;
  readonly titleText: string;
  readonly titleSemanticsLabel: string | null;
  readonly titleStyle: TextStyle | null;
  readonly orientation: Orientation;
  readonly isShort: boolean;
  readonly entryModeButton: Widget | null;
  /**
   * @dartType double
   * @dartTypeOrigin explicit
   */
  static readonly _dart_b85857c463f8c355_datePickerHeaderLandscapeWidth: number = 152;
  /**
   * @dartType double
   * @dartTypeOrigin explicit
   */
  static readonly _dart_b85857c463f8c355_datePickerHeaderPortraitHeight: number = 120;
  /**
   * @dartType double
   * @dartTypeOrigin explicit
   */
  static readonly _dart_b85857c463f8c355_headerPaddingLandscape: number = 16;
  constructor({
    helpText,
    titleText,
    titleSemanticsLabel = null,
    titleStyle,
    orientation,
    isShort = false,
    entryModeButton = null,
  }: {
    readonly helpText: string;
    readonly titleText: string;
    readonly titleSemanticsLabel?: string | null;
    readonly titleStyle: TextStyle | null;
    readonly orientation: Orientation;
    readonly isShort?: boolean;
    readonly entryModeButton?: Widget | null;
  }) {
    const _initialField0 = helpText;
    const _initialField1 = titleText;
    const _initialField2 = titleSemanticsLabel;
    const _initialField3 = titleStyle;
    const _initialField4 = orientation;
    const _initialField5 = isShort;
    const _initialField6 = entryModeButton;
    super();
    this.helpText = _initialField0;
    this.titleText = _initialField1;
    this.titleSemanticsLabel = _initialField2;
    this.titleStyle = _initialField3;
    this.orientation = _initialField4;
    this.isShort = _initialField5;
    this.entryModeButton = _initialField6;
    protect(this, [
      'helpText',
      'titleText',
      'titleSemanticsLabel',
      'titleStyle',
      'orientation',
      'isShort',
      'entryModeButton',
    ]);
  }
  override build(context: BuildContext): Widget {
    const theme: SourceDateThemeData = SourceDateTheme.of(context);
    const datePickerTheme: DatePickerThemeData = DatePickerTheme.of(context);
    const defaults: DatePickerThemeData = DatePickerTheme.defaults(context);
    const backgroundColor: Color | null =
      datePickerTheme.headerBackgroundColor ?? defaults.headerBackgroundColor;
    const foregroundColor: Color | null =
      datePickerTheme.headerForegroundColor ?? defaults.headerForegroundColor;
    const helpStyle: TextStyle | null = (() => {
      const _dartTemporary33 = datePickerTheme.headerHelpStyle ?? defaults.headerHelpStyle;
      return _dartTemporary33 === null
        ? null
        : dateTextStyleCopyWith(_dartTemporary33, { color: foregroundColor });
    })();
    /**
     * @dartType double
     * @dartTypeOrigin explicit
     */
    const currentScale: number =
      MediaQuery.textScalerOf(context).scale(_fontSizeToScale) / _fontSizeToScale;
    /**
     * @dartType double
     * @dartTypeOrigin explicit
     */
    const maxHeaderTextScaleFactor: number = castSourceDartDouble(
      minSourceDartNum(
        boxSourceDartDouble(currentScale),
        this.entryModeButton !== null
          ? boxSourceDartDouble(_kMaxHeaderWithEntryTextScaleFactor)
          : boxSourceDartDouble(_kMaxHeaderTextScaleFactor),
      ),
    );
    /**
     * @dartType double
     * @dartTypeOrigin explicit
     */
    const textScaleFactor: number =
      MediaQuery.textScalerOf(context)
        .clamp({ maxScaleFactor: maxHeaderTextScaleFactor })
        .scale(_fontSizeToScale) / _fontSizeToScale;
    /**
     * @dartType double
     * @dartTypeOrigin explicit
     */
    const scaledFontSize: number = MediaQuery.textScalerOf(context).scale(
      (() => {
        const _dartTemporary34 = this.titleStyle;
        return _dartTemporary34 === null ? null : _dartTemporary34.fontSize;
      })() ?? 32,
    );
    /**
     * @dartType double
     * @dartTypeOrigin inferred
     */
    const headerScaleFactor: number = textScaleFactor > 1 ? textScaleFactor : 1;
    const help: Text = dateText(this.helpText, {
      style: helpStyle,
      maxLines: 1,
      overflow: TextOverflow.ellipsis,
      textScaler: MediaQuery.textScalerOf(context).clamp({
        maxScaleFactor: castSourceDartDouble(
          minSourceDartNum(
            boxSourceDartDouble(textScaleFactor),
            scrollbarRawObjectEquals(this.orientation, 'portrait')
              ? boxSourceDartDouble(_kMaxHelpPortraitTextScaleFactor)
              : boxSourceDartDouble(_kMaxHelpLandscapeTextScaleFactor),
          ),
        ),
      }),
    });
    const title: Text = dateText(this.titleText, {
      semanticsLabel: this.titleSemanticsLabel ?? this.titleText,
      style: this.titleStyle,
      maxLines: checkedInteger(
        scrollbarRawObjectEquals(this.orientation, 'portrait')
          ? checkedInteger(checkedInteger(scaledFontSize > 70 ? 2 : 1))
          : checkedInteger(scaledFontSize > 40 ? 3 : 2),
      ),
      overflow: TextOverflow.ellipsis,
      textScaler: MediaQuery.textScalerOf(context).clamp({ maxScaleFactor: textScaleFactor }),
    });
    /**
     * @dartType double
     * @dartTypeOrigin explicit
     */
    const fontScaleAdjustedHeaderHeight: number =
      headerScaleFactor > 1.3 ? headerScaleFactor - 0.2 : 1;
    switch (this.orientation) {
      case 'portrait': {
        return new Semantics({
          container: true,
          child: dateSizedBox({
            height:
              _DatePickerHeader._dart_b85857c463f8c355_datePickerHeaderPortraitHeight *
              fontScaleAdjustedHeaderHeight,
            child: new Material({
              color: backgroundColor,
              child: datePadding({
                padding: constDateEdgeInsetsDirectionalOnly(EdgeInsetsDirectional, {
                  start: 24,
                  end: 12,
                  bottom: 12,
                }),
                child: dateColumn({
                  crossAxisAlignment: 'start',
                  children: [
                    constDateSizedBox(SizedBox, { height: 16 }),
                    help,
                    constDateFlexible(Flexible, {
                      child: constDateSizedBox(SizedBox, { height: 38 }),
                    }),
                    dateRow({
                      children: (() => {
                        const _dartTemporary35: Widget[] = [];
                        _dartTemporary35.push(dateExpanded({ child: title }));
                        if (this.entryModeButton !== null)
                          _dartTemporary35.push(
                            new Semantics({ container: true, child: this.entryModeButton }),
                          );
                        return _dartTemporary35;
                      })(),
                    }),
                  ],
                }),
              }),
            }),
          }),
        });
      }
      case 'landscape': {
        return new Semantics({
          container: true,
          child: dateSizedBox({
            width: _DatePickerHeader._dart_b85857c463f8c355_datePickerHeaderLandscapeWidth,
            child: new Material({
              color: backgroundColor,
              child: dateColumn({
                crossAxisAlignment: 'start',
                children: (() => {
                  const _dartTemporary36: Widget[] = [];
                  _dartTemporary36.push(constDateSizedBox(SizedBox, { height: 16 }));
                  _dartTemporary36.push(
                    datePadding({
                      padding: constDateEdgeInsetsSymmetric(EdgeInsets, {
                        horizontal: _DatePickerHeader._dart_b85857c463f8c355_headerPaddingLandscape,
                      }),
                      child: help,
                    }),
                  );
                  _dartTemporary36.push(dateSizedBox({ height: this.isShort ? 16 : 56 }));
                  _dartTemporary36.push(
                    dateExpanded({
                      child: datePadding({
                        padding: constDateEdgeInsetsSymmetric(EdgeInsets, {
                          horizontal:
                            _DatePickerHeader._dart_b85857c463f8c355_headerPaddingLandscape,
                        }),
                        child: title,
                      }),
                    }),
                  );
                  if (this.entryModeButton !== null)
                    _dartTemporary36.push(
                      datePadding({
                        padding: theme.useMaterial3
                          ? constDateEdgeInsetsDirectionalOnly(EdgeInsetsDirectional, {
                              start: 8,
                              end: 4,
                              bottom: 6,
                            })
                          : constDateEdgeInsetsSymmetric(EdgeInsets, { horizontal: 4 }),
                        child: new Semantics({ container: true, child: this.entryModeButton }),
                      }),
                    );
                  return _dartTemporary36;
                })(),
              }),
            }),
          }),
        });
      }
      default:
        throw new TypeError('Invalid value outside exhaustive Dart switch');
    }
  }
}
protect(_DatePickerHeader, [
  '_dart_b85857c463f8c355_datePickerHeaderLandscapeWidth',
  '_dart_b85857c463f8c355_datePickerHeaderPortraitHeight',
  '_dart_b85857c463f8c355_headerPaddingLandscape',
]);
export async function showDatePicker({
  context,
  initialDate = null,
  firstDate,
  lastDate,
  currentDate = null,
  initialEntryMode = DatePickerEntryMode.calendar,
  selectableDayPredicate = null,
  helpText = null,
  cancelText = null,
  confirmText = null,
  locale = null,
  barrierDismissible = true,
  barrierColor = null,
  barrierLabel = null,
  useRootNavigator = true,
  routeSettings = null,
  textDirection = null,
  builder = null,
  initialDatePickerMode = DatePickerMode.day,
  errorFormatText = null,
  errorInvalidText = null,
  fieldHintText = null,
  fieldLabelText = null,
  keyboardType = null,
  anchorPoint = null,
  onDatePickerModeChange = null,
  switchToInputEntryModeIcon = null,
  switchToCalendarEntryModeIcon = null,
  calendarDelegate = constGregorianCalendarDelegate(),
}: {
  readonly context: BuildContext;
  readonly initialDate?: DateTime | null;
  readonly firstDate: DateTime;
  readonly lastDate: DateTime;
  readonly currentDate?: DateTime | null;
  readonly initialEntryMode?: DatePickerEntryMode;
  readonly selectableDayPredicate?: ((argument0: DateTime) => boolean) | null;
  readonly helpText?: string | null;
  readonly cancelText?: string | null;
  readonly confirmText?: string | null;
  readonly locale?: Locale | null;
  readonly barrierDismissible?: boolean;
  readonly barrierColor?: Color | null;
  readonly barrierLabel?: string | null;
  readonly useRootNavigator?: boolean;
  readonly routeSettings?: RouteSettings | null;
  readonly textDirection?: ScrollbarTextDirection | null;
  readonly builder?: ((argument0: BuildContext, argument1: Widget | null) => Widget) | null;
  readonly initialDatePickerMode?: DatePickerMode;
  readonly errorFormatText?: string | null;
  readonly errorInvalidText?: string | null;
  readonly fieldHintText?: string | null;
  readonly fieldLabelText?: string | null;
  readonly keyboardType?: TextInputType | null;
  readonly anchorPoint?: Offset | null;
  readonly onDatePickerModeChange?: ((argument0: DatePickerEntryMode) => void) | null;
  readonly switchToInputEntryModeIcon?: Icon | null;
  readonly switchToCalendarEntryModeIcon?: Icon | null;
  readonly calendarDelegate?: CalendarDelegate<DateTime>;
}): ScrollbarFuture<DateTime | null> {
  void (initialDate =
    initialDate === null ? null : calendarDelegate.dateOnly(initialDate as DateTime));
  void (firstDate = calendarDelegate.dateOnly(firstDate));
  void (lastDate = calendarDelegate.dateOnly(lastDate));
  if (FoundationBuildMode.debug)
    invariant(
      !lastDate.isBefore(firstDate),
      'generated-source-assert',
      `lastDate ${dartValueString(lastDate)} must be on or after firstDate ${dartValueString(firstDate)}.`,
    );
  if (FoundationBuildMode.debug)
    invariant(
      initialDate === null || !(initialDate as DateTime).isBefore(firstDate),
      'generated-source-assert',
      `initialDate ${dartValueString(initialDate as DateTime)} must be on or after firstDate ${dartValueString(firstDate)}.`,
    );
  if (FoundationBuildMode.debug)
    invariant(
      initialDate === null || !(initialDate as DateTime).isAfter(lastDate),
      'generated-source-assert',
      `initialDate ${dartValueString(initialDate as DateTime)} must be on or before lastDate ${dartValueString(lastDate)}.`,
    );
  if (FoundationBuildMode.debug)
    invariant(
      selectableDayPredicate === null ||
        initialDate === null ||
        (selectableDayPredicate as (argument0: DateTime) => boolean)(initialDate as DateTime),
      'generated-source-assert',
      `Provided initialDate ${dartValueString(initialDate as DateTime)} must satisfy provided selectableDayPredicate.`,
    );
  if (FoundationBuildMode.debug)
    invariant(
      debugCheckHasMaterialLocalizations(context),
      'generated-source-assert',
      'Pinned Dart assertion failed',
    );
  let dialog: Widget = new DatePickerDialog({
    initialDate: initialDate,
    firstDate: firstDate,
    lastDate: lastDate,
    currentDate: currentDate,
    initialEntryMode: initialEntryMode,
    selectableDayPredicate: selectableDayPredicate,
    helpText: helpText,
    cancelText: cancelText,
    confirmText: confirmText,
    initialCalendarMode: initialDatePickerMode,
    errorFormatText: errorFormatText,
    errorInvalidText: errorInvalidText,
    fieldHintText: fieldHintText,
    fieldLabelText: fieldLabelText,
    keyboardType: keyboardType,
    onDatePickerModeChange: onDatePickerModeChange,
    switchToInputEntryModeIcon: switchToInputEntryModeIcon,
    switchToCalendarEntryModeIcon: switchToCalendarEntryModeIcon,
    calendarDelegate: calendarDelegate,
  });
  if (textDirection !== null) {
    void (dialog = dateDirectionality({
      textDirection: textDirection as ScrollbarTextDirection,
      child: dialog,
    }));
  }
  if (locale !== null) {
    void (dialog = dateLocalizationsOverride({
      context: context,
      locale: locale as Locale,
      child: dialog,
    }));
  } else {
    const datePickerTheme: DatePickerThemeData = DatePickerTheme.of(context);
    if (datePickerTheme.locale !== null) {
      void (dialog = dateLocalizationsOverride({
        context: context,
        locale: datePickerTheme.locale,
        child: dialog,
      }));
    }
  }
  return dateShowDialog({
    context: context,
    barrierDismissible: barrierDismissible,
    barrierColor: barrierColor,
    barrierLabel: barrierLabel,
    useRootNavigator: useRootNavigator,
    routeSettings: routeSettings,
    builder: (context: BuildContext): Widget => {
      return builder === null
        ? dialog
        : (builder as (argument0: BuildContext, argument1: Widget | null) => Widget)(
            context,
            dialog,
          );
    },
    anchorPoint: anchorPoint,
  });
}
