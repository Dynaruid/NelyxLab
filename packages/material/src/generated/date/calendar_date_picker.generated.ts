// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Generated from packages/flutter/lib/src/material/calendar_date_picker.dart; SHA256 f318c0cab6f4f61d45e79dea0edbe6f149f31ee659fe4dbd5a2010103d42ad79
import { protect } from '@nelyx/core/internal/ui/value-math';
import { checkedInteger } from '@nelyx/core/internal/ui/value-math';
import { invariant } from '@nelyx/core/foundation/errors';
import { FoundationBuildMode } from '@nelyx/core/foundation/constants';
import { dartMethodTearOff } from '@nelyx/core/internal/foundation/dart-method-tear-off';
import { dartLateRead } from '@nelyx/core/internal/foundation/dart-late';
import { dartLateWrite } from '@nelyx/core/internal/foundation/dart-late';
import { Color } from '@nelyx/core/ui/color';
import { EdgeInsets } from '@nelyx/core/framework/painting/edge-insets';
import { EdgeInsetsDirectional } from '@nelyx/core/framework/painting/edge-insets';
import { OutlinedBorder } from '@nelyx/core/framework/painting/borders';
import { GlobalKey } from '@nelyx/core/framework/widgets/global-key';
import { State } from '@nelyx/core/framework/widgets/framework';
import { StatefulWidget } from '@nelyx/core/framework/widgets/framework';
import { Widget } from '@nelyx/core/framework/widgets/framework';
import { Key } from '@nelyx/core/foundation/key';
import { AnimationController } from '@nelyx/core/framework/animation/animation-controller';
import { Curves } from '@nelyx/core/framework/animation/curves';
import { DartSet } from '@nelyx/core/internal/foundation/dart-collections';
import { DartMap } from '@nelyx/core/internal/foundation/dart-collections';
import { FlutterError } from '@nelyx/core/foundation/flutter-error';
import { ErrorDescription } from '@nelyx/core/foundation/diagnostics';
import { castSourceDartDouble } from '@nelyx/core/internal/foundation/dart-numeric';
import { ScrollController } from '@nelyx/core/framework/widgets/scroll-controller';
import { DragStartBehavior } from '@nelyx/core/framework/gestures/recognizer';
import { ScrollbarStatefulHost } from '@nelyx/core/internal/framework/widgets/scrollbar-raw-source-adapter';
import { Directionality } from '@nelyx/core/framework/widgets/app-data';
import { axisDirectionIsReversed } from '@nelyx/core/framework/painting/basic-types';
import { scrollbarGlobalKey } from '@nelyx/core/internal/framework/widgets/scrollbar-raw-source-adapter';
import { emptyWidgetStateSet } from '@nelyx/core/framework/widgets/widget-state';
import { isDartType } from '@nelyx/core/internal/foundation/dart-type-witness';
import { nullableDartType } from '@nelyx/core/internal/foundation/dart-type-witness';
import { scrollbarRawObjectEquals } from '@nelyx/core/internal/framework/widgets/scrollbar-raw-source-adapter';
import { boxSourceDartInt } from '@nelyx/core/internal/foundation/dart-numeric';
import { boxSourceDartDouble } from '@nelyx/core/internal/foundation/dart-numeric';
import { castSourceDartInt } from '@nelyx/core/internal/foundation/dart-numeric';
import { sourceColorType } from '@nelyx/core/internal/ui/color-source-adapter';
import { MaterialLocalizations } from '../../material-localizations.ts';
import { FocusNode } from '@nelyx/core/framework/widgets/focus';
import { modulo } from '@nelyx/core/internal/ui/value-math';
import { truncateDivide } from '@nelyx/core/internal/ui/value-math';
import { dartValueString } from '@nelyx/core/internal/foundation/dart-value';
import { Icon } from '@nelyx/core/framework/widgets/icon';
import { constGregorianCalendarDelegate } from '../../internal/date/source-host.ts';
import { debugCheckHasMaterial } from '../../internal/date/source-host.ts';
import { debugCheckHasMaterialLocalizations } from '../../internal/date/source-host.ts';
import { debugCheckHasDirectionality } from '../../internal/date/source-host.ts';
import { SingleTickerProviderStateMixin } from '@nelyx/core/framework/widgets/ticker-provider';
import { CalendarDelegate } from './date.generated.ts';
import { DateTime } from '../../internal/date/date-time.ts';
import { DatePickerMode } from './date.generated.ts';
import { MediaQuery } from '@nelyx/core/framework/widgets/app-data';
import { SemanticsService } from '@nelyx/core/framework/semantics/semantics-service';
import { View } from '../../internal/date/source-host.ts';
import { HapticFeedback } from '@nelyx/core/services/haptic-feedback';
import { SizedBox } from '@nelyx/core/framework/widgets/basic';
import { AccessibilityFocusBlockType } from '@nelyx/core/framework/semantics/semantics';
import { Semantics } from '@nelyx/core/framework/widgets/semantics';
import { DatePickerThemeData } from '../../date-picker-theme-data.ts';
import { DatePickerTheme } from '../../date-picker-theme.ts';
import { TextStyle } from '@nelyx/core/framework/painting/text-style';
import { TextOverflow } from '@nelyx/core/framework/painting/text-painter';
import { Icons } from '../icons/icons.ts';
import { RotationTransition } from '@nelyx/core/framework/widgets/transitions';
import { InkWell } from '../../ink-well.ts';
import { PageController } from '@nelyx/core/framework/widgets/page-view';
import { Intent } from '@nelyx/core/framework/widgets/actions';
import { Action } from '@nelyx/core/framework/widgets/actions';
import { LogicalKeyboardKey } from '@nelyx/core/services/keyboard-key';
import { SingleActivator } from '@nelyx/core/framework/widgets/shortcuts';
import { DirectionalFocusIntent } from '@nelyx/core/framework/widgets/focus-traversal';
import { NextFocusIntent } from '@nelyx/core/framework/widgets/focus-traversal';
import { PreviousFocusIntent } from '@nelyx/core/framework/widgets/focus-traversal';
import { Spacer } from './spacer.generated.ts';
import { IconButton } from '../../icon-button.ts';
import { MaterialType } from '../material/material-values.generated.ts';
import { Material } from '../../material.ts';
import { ExcludeSemantics } from '@nelyx/core/framework/widgets/semantics';
import { ClampingScrollPhysics } from '@nelyx/core/framework/widgets/scroll-physics';
import { SliverGridDelegate } from '@nelyx/core/framework/rendering/sliver-grid';
import { SliverChildListDelegate } from '@nelyx/core/framework/widgets/scroll-delegate';
import { GridView } from '@nelyx/core/framework/widgets/scroll-view';
import { BorderSide } from '@nelyx/core/framework/painting/borders';
import { Ink } from '../../ink-decoration.ts';
import { InkResponse } from '../../ink-well.ts';
import { SliverGridLayout } from '@nelyx/core/framework/rendering/sliver-grid';
import { SliverConstraints } from '@nelyx/core/framework/rendering/sliver';
import { SliverGridRegularTileLayout } from '@nelyx/core/framework/rendering/sliver-grid';
import { Alignment } from '@nelyx/core/framework/painting/alignment';
import { Container } from '@nelyx/core/framework/widgets/container';
import { Divider } from '../../divider.ts';
import { FlutterErrorDetails } from '@nelyx/core/foundation/assertions';
import { dateListAdd } from '../../internal/date/source-values.ts';
import { dateCatchError } from '../../internal/date/source-values.ts';
import { dateTimeType } from '../../internal/date/date-time.ts';
import { sourceOutlinedBorderType } from '@nelyx/core/internal/framework/painting/source-value-types';
import { constdateTraversalDirectionintMap } from '../../internal/date/source-host.ts';
import { constdateShortcutActivatorIntentMap } from '../../internal/date/source-host.ts';
import { dateTypeActionMap } from '../../internal/date/source-host.ts';
import { datePadding } from '../../internal/date/source-host.ts';
import { dateCenter } from '../../internal/date/source-host.ts';
import { dateSizedBox } from '../../internal/date/source-host.ts';
import { dateColumn } from '../../internal/date/source-host.ts';
import { dateRow } from '../../internal/date/source-host.ts';
import { dateExpanded } from '../../internal/date/source-host.ts';
import { dateFlexible } from '../../internal/date/source-host.ts';
import { dateStack } from '../../internal/date/source-host.ts';
import { ColorShapeDecoration } from '@nelyx/core/framework/painting/color-shape-decoration';
import { dateShapeDecoration } from '../../internal/date/source-host.ts';
import { dateClampedTextScaling } from '../../internal/date/source-host.ts';
import { dateValueKey } from '../../internal/date/source-host.ts';
import { dateYearKey } from '../../internal/date/source-host.ts';
import { TraversalDirection } from '@nelyx/core/framework/widgets/focus-traversal-policy';
import { WidgetStatesController } from '@nelyx/core/framework/widgets/widget-state';
import { WidgetState } from '@nelyx/core/framework/widgets/widget-state';
import { WidgetStateProperty } from '@nelyx/core/framework/widgets/widget-state';
import { minSourceDartNum } from '@nelyx/core/internal/foundation/dart-numeric-math';
import { maxSourceDartNum } from '@nelyx/core/internal/foundation/dart-numeric-math';
import { SourceInheritedHost } from '../../internal/date/source-host.ts';
import { dateMapGet } from '../../internal/date/source-host.ts';
import { dateIntString } from '../../internal/date/source-values.ts';
import { dateListAt } from '../../internal/date/source-values.ts';
import { dateFocusableActionDetector } from '../../internal/date/source-host.ts';
import { datePageViewBuilder } from '../../internal/date/source-host.ts';
import { dateDependOnFocusedDate } from '../../internal/date/source-host.ts';
import { dateNextFocusIntentAction } from '../../internal/date/source-host.ts';
import { datePreviousFocusIntentAction } from '../../internal/date/source-host.ts';
import { dateDirectionalFocusIntentAction } from '../../internal/date/source-host.ts';
import { dateGenerateFocusNodes } from '../../internal/date/source-host.ts';
import { constDateEdgeInsetsOnly } from '../../internal/date/source-host.ts';
import { constDateEdgeInsetsDirectionalOnly } from '../../internal/date/source-host.ts';
import { constDateEdgeInsetsSymmetric } from '../../internal/date/source-host.ts';
import { constDateSizedBox } from '../../internal/date/source-host.ts';
import { constDateSingleActivator } from '../../internal/date/source-host.ts';
import { constDateDirectionalFocusIntent } from '../../internal/date/source-host.ts';
import { constDateSpacer } from '../../internal/date/source-host.ts';
import { constDateSizedBoxShrink } from '../../internal/date/source-host.ts';
import { constDateClampingScrollPhysics } from '../../internal/date/source-host.ts';
import { constDateEdgeInsetsAll } from '../../internal/date/source-host.ts';
import { constDateDivider } from '../../internal/date/source-host.ts';
import { SourceDateTheme } from '../../internal/date/source-theme.ts';
import { dateOrientationOf } from '../../internal/date/source-host.ts';
import { dateMaybeSupportsAnnounceOf } from '../../internal/date/source-host.ts';
import { dateTextStyleColor } from '../../internal/date/source-paint.ts';
import { dateBorderSideColor } from '../../internal/date/source-paint.ts';
import { dateTextStyleApply } from '../../internal/date/source-paint.ts';
import { dateBorderSideCopyWith } from '../../internal/date/source-paint.ts';
import { dateOutlinedBorderCopyWith } from '../../internal/date/source-paint.ts';
import { dateText } from '../../internal/date/source-paint.ts';
import { dateNextPage } from '../../internal/date/source-host.ts';
import { datePreviousPage } from '../../internal/date/source-host.ts';
import type { ScrollbarTextDirection } from '@nelyx/core/internal/framework/widgets/scrollbar-painter-source-adapter';
import type { ScrollbarSourceList } from '@nelyx/core/internal/framework/widgets/scrollbar-painter-source-adapter';
import type { BuildContext } from '@nelyx/core/framework/widgets/framework';
import type { DartTypeWitness } from '@nelyx/core/internal/foundation/dart-type-witness';
import type { DartInt } from '@nelyx/core/internal/foundation/dart-numeric';
import type { Orientation } from '@nelyx/core/framework/widgets/orientation-builder';
import type { ShortcutActivator } from '@nelyx/core/framework/widgets/shortcuts';
import type { SourceStackTrace } from '../../internal/date/source-values.ts';
import type { IntentType } from '@nelyx/core/framework/widgets/actions';
export const _monthScrollDuration: number = 0 + 200 * 1;
/**
 * @dartType double
 * @dartTypeOrigin explicit
 */
export const _dayPickerRowHeightM2: number = 42;
/**
 * @dartType double
 * @dartTypeOrigin explicit
 */
export const _dayPickerRowHeightM3: number = 48;
/**
 * @dartType int
 * @dartTypeOrigin explicit
 */
export const _maxDayPickerRowCount: number = 6;
/**
 * @dartType double
 * @dartTypeOrigin explicit
 */
export const _maxDayPickerHeightM2: number =
  _dayPickerRowHeightM2 * checkedInteger(checkedInteger(checkedInteger(_maxDayPickerRowCount) + 1));
/**
 * @dartType double
 * @dartTypeOrigin explicit
 */
export const _maxDayPickerHeightM3: number =
  _dayPickerRowHeightM3 * checkedInteger(checkedInteger(checkedInteger(_maxDayPickerRowCount) + 1));
/**
 * @dartType double
 * @dartTypeOrigin explicit
 */
export const _monthPickerHorizontalPaddingPortraitM3: number = 12;
/**
 * @dartType double
 * @dartTypeOrigin explicit
 */
export const _monthPickerHorizontalPaddingOther: number = 8;
/**
 * @dartType int
 * @dartTypeOrigin explicit
 */
export const _yearPickerColumnCount: number = 3;
/**
 * @dartType double
 * @dartTypeOrigin explicit
 */
export const _yearPickerPadding: number = 16;
/**
 * @dartType double
 * @dartTypeOrigin explicit
 */
export const _yearPickerRowHeight: number = 52;
/**
 * @dartType double
 * @dartTypeOrigin explicit
 */
export const _yearPickerRowSpacing: number = 8;
/**
 * @dartType double
 * @dartTypeOrigin explicit
 */
export const _subHeaderHeight: number = 52;
/**
 * @dartType double
 * @dartTypeOrigin explicit
 */
export const _monthNavButtonsWidth: number = 108;
/**
 * @dartType double
 * @dartTypeOrigin explicit
 */
export const _kMaxTextScaleFactor: number = 3;
/**
 * @dartType double
 * @dartTypeOrigin explicit
 */
export const _kModeToggleButtonMaxScaleFactor: number = 2;
/**
 * @dartType double
 * @dartTypeOrigin explicit
 */
export const _kDayPickerGridPortraitMaxScaleFactor: number = 2;
/**
 * @dartType double
 * @dartTypeOrigin explicit
 */
export const _kDayPickerGridLandscapeMaxScaleFactor: number = 1.5;
/**
 * @dartType double
 * @dartTypeOrigin explicit
 */
export const _fontSizeToScale: number = 14;
export class CalendarDatePicker extends ScrollbarStatefulHost {
  readonly initialDate: DateTime | null;
  readonly firstDate: DateTime;
  readonly lastDate: DateTime;
  readonly currentDate: DateTime;
  readonly onDateChanged: (argument0: DateTime) => void;
  readonly onDisplayedMonthChanged: ((argument0: DateTime) => void) | null;
  readonly initialCalendarMode: DatePickerMode;
  readonly selectableDayPredicate: ((argument0: DateTime) => boolean) | null;
  readonly calendarDelegate: CalendarDelegate<DateTime>;
  constructor({
    key = null,
    initialDate,
    firstDate,
    lastDate,
    currentDate = null,
    onDateChanged,
    onDisplayedMonthChanged = null,
    initialCalendarMode = DatePickerMode.day,
    selectableDayPredicate = null,
    calendarDelegate = constGregorianCalendarDelegate(),
  }: {
    readonly key?: Key | null;
    readonly initialDate: DateTime | null;
    readonly firstDate: DateTime;
    readonly lastDate: DateTime;
    readonly currentDate?: DateTime | null;
    readonly onDateChanged: (argument0: DateTime) => void;
    readonly onDisplayedMonthChanged?: ((argument0: DateTime) => void) | null;
    readonly initialCalendarMode?: DatePickerMode;
    readonly selectableDayPredicate?: ((argument0: DateTime) => boolean) | null;
    readonly calendarDelegate?: CalendarDelegate<DateTime>;
  }) {
    const _initialField0 = onDateChanged;
    const _initialField1 = onDisplayedMonthChanged;
    const _initialField2 = initialCalendarMode;
    const _initialField3 = selectableDayPredicate;
    const _initialField4 = calendarDelegate;
    const _initialField5 =
      initialDate === null ? null : calendarDelegate.dateOnly(initialDate as DateTime);
    const _initialField6 = calendarDelegate.dateOnly(firstDate);
    const _initialField7 = calendarDelegate.dateOnly(lastDate);
    const _initialField8 = calendarDelegate.dateOnly(currentDate ?? calendarDelegate.now());
    super({ key: key });
    this.initialDate = _initialField5;
    this.firstDate = _initialField6;
    this.lastDate = _initialField7;
    this.currentDate = _initialField8;
    this.onDateChanged = _initialField0;
    this.onDisplayedMonthChanged = _initialField1;
    this.initialCalendarMode = _initialField2;
    this.selectableDayPredicate = _initialField3;
    this.calendarDelegate = _initialField4;
    protect(this, [
      'initialDate',
      'firstDate',
      'lastDate',
      'currentDate',
      'onDateChanged',
      'onDisplayedMonthChanged',
      'initialCalendarMode',
      'selectableDayPredicate',
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
        this.initialDate === null ||
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
        this.initialDate === null ||
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
          this.initialDate === null ||
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
        })()} must satisfy provided selectableDayPredicate.`,
      );
  }
  override createState(): State<CalendarDatePicker> {
    return new _CalendarDatePickerState();
  }
}
export class _CalendarDatePickerState extends State<CalendarDatePicker> {
  _dart_e3418b5381fd4ff8_announcedInitialDate: boolean;
  _dart_e3418b5381fd4ff8_announcementText: string;
  get _dart_e3418b5381fd4ff8_mode(): DatePickerMode {
    return dartLateRead<DatePickerMode>(
      this,
      'package:flutter/src/material/calendar_date_picker.dart::_CalendarDatePickerState._mode:FIELD',
      '_mode',
    );
  }
  set _dart_e3418b5381fd4ff8_mode(value: DatePickerMode) {
    dartLateWrite<DatePickerMode>(
      this,
      'package:flutter/src/material/calendar_date_picker.dart::_CalendarDatePickerState._mode:FIELD',
      '_mode',
      value,
      false,
    );
  }
  get _dart_e3418b5381fd4ff8_currentDisplayedMonthDate(): DateTime {
    return dartLateRead<DateTime>(
      this,
      'package:flutter/src/material/calendar_date_picker.dart::_CalendarDatePickerState._currentDisplayedMonthDate:FIELD',
      '_currentDisplayedMonthDate',
    );
  }
  set _dart_e3418b5381fd4ff8_currentDisplayedMonthDate(value: DateTime) {
    dartLateWrite<DateTime>(
      this,
      'package:flutter/src/material/calendar_date_picker.dart::_CalendarDatePickerState._currentDisplayedMonthDate:FIELD',
      '_currentDisplayedMonthDate',
      value,
      false,
    );
  }
  _dart_e3418b5381fd4ff8_selectedDate: DateTime | null;
  readonly _dart_e3418b5381fd4ff8_monthPickerKey: GlobalKey<State<StatefulWidget>>;
  readonly _dart_e3418b5381fd4ff8_yearPickerKey: GlobalKey<State<StatefulWidget>>;
  get _dart_e3418b5381fd4ff8_localizations(): MaterialLocalizations {
    return dartLateRead<MaterialLocalizations>(
      this,
      'package:flutter/src/material/calendar_date_picker.dart::_CalendarDatePickerState._localizations:FIELD',
      '_localizations',
    );
  }
  set _dart_e3418b5381fd4ff8_localizations(value: MaterialLocalizations) {
    dartLateWrite<MaterialLocalizations>(
      this,
      'package:flutter/src/material/calendar_date_picker.dart::_CalendarDatePickerState._localizations:FIELD',
      '_localizations',
      value,
      false,
    );
  }
  get _dart_e3418b5381fd4ff8_textDirection(): ScrollbarTextDirection {
    return dartLateRead<ScrollbarTextDirection>(
      this,
      'package:flutter/src/material/calendar_date_picker.dart::_CalendarDatePickerState._textDirection:FIELD',
      '_textDirection',
    );
  }
  set _dart_e3418b5381fd4ff8_textDirection(value: ScrollbarTextDirection) {
    dartLateWrite<ScrollbarTextDirection>(
      this,
      'package:flutter/src/material/calendar_date_picker.dart::_CalendarDatePickerState._textDirection:FIELD',
      '_textDirection',
      value,
      false,
    );
  }
  constructor() {
    const _initialField0 = false;
    const _initialField1 = '';
    const _initialField2 = scrollbarGlobalKey();
    const _initialField3 = scrollbarGlobalKey();
    super();
    this._dart_e3418b5381fd4ff8_announcedInitialDate = _initialField0;
    this._dart_e3418b5381fd4ff8_announcementText = _initialField1;
    this._dart_e3418b5381fd4ff8_selectedDate = null;
    this._dart_e3418b5381fd4ff8_monthPickerKey = _initialField2;
    this._dart_e3418b5381fd4ff8_yearPickerKey = _initialField3;
    protect(this, [
      '_dart_e3418b5381fd4ff8_monthPickerKey',
      '_dart_e3418b5381fd4ff8_yearPickerKey',
    ]);
  }
  override initState(): void {
    void super.initState();
    void (this._dart_e3418b5381fd4ff8_mode = this.widget.initialCalendarMode);
    const currentDisplayedDate: DateTime = this.widget.initialDate ?? this.widget.currentDate;
    void (this._dart_e3418b5381fd4ff8_currentDisplayedMonthDate =
      this.widget.calendarDelegate.getMonth(
        checkedInteger(currentDisplayedDate.year),
        checkedInteger(currentDisplayedDate.month),
      ));
    if (this.widget.initialDate !== null) {
      void (this._dart_e3418b5381fd4ff8_selectedDate = this.widget.initialDate);
    }
  }
  override didChangeDependencies(): void {
    void super.didChangeDependencies();
    if (FoundationBuildMode.debug)
      invariant(
        debugCheckHasMaterial(this.context),
        'generated-source-assert',
        'Pinned Dart assertion failed',
      );
    if (FoundationBuildMode.debug)
      invariant(
        debugCheckHasMaterialLocalizations(this.context),
        'generated-source-assert',
        'Pinned Dart assertion failed',
      );
    if (FoundationBuildMode.debug)
      invariant(
        debugCheckHasDirectionality(this.context),
        'generated-source-assert',
        'Pinned Dart assertion failed',
      );
    void (this._dart_e3418b5381fd4ff8_localizations = MaterialLocalizations.of(this.context));
    void (this._dart_e3418b5381fd4ff8_textDirection = Directionality.of(this.context));
    if (!this._dart_e3418b5381fd4ff8_announcedInitialDate && this.widget.initialDate !== null) {
      if (FoundationBuildMode.debug)
        invariant(
          this._dart_e3418b5381fd4ff8_selectedDate !== null,
          'generated-source-assert',
          'Pinned Dart assertion failed',
        );
      void (this._dart_e3418b5381fd4ff8_announcedInitialDate = true);
      const isToday: boolean = this.widget.calendarDelegate.isSameDay(
        this.widget.currentDate,
        this._dart_e3418b5381fd4ff8_selectedDate,
      );
      const semanticLabelSuffix: string = isToday
        ? `, ${this._dart_e3418b5381fd4ff8_localizations.currentDateLabel}`
        : '';
      void this._dart_e3418b5381fd4ff8_announce(
        `${this._dart_e3418b5381fd4ff8_localizations.formatFullDate(
          (() => {
            const _dartTemporary7 = this._dart_e3418b5381fd4ff8_selectedDate;
            if (_dartTemporary7 === null)
              throw new TypeError('Null check operator used on a null value');
            return _dartTemporary7!;
          })(),
        )}${semanticLabelSuffix}`,
      );
    }
  }
  _dart_e3418b5381fd4ff8_announce(message: string): void {
    if (dateMaybeSupportsAnnounceOf(this.context) ?? false) {
      void dateCatchError(
        SemanticsService.sendAnnouncement(
          View.of(this.context),
          message,
          Directionality.of(this.context),
        ),
        _reportAnnouncementError,
      );
    } else {
      void (this._dart_e3418b5381fd4ff8_announcementText = message);
    }
  }
  _dart_e3418b5381fd4ff8_vibrate(): void {
    switch (SourceDateTheme.of(this.context).platform) {
      case 'android':
      case 'fuchsia':
      case 'linux':
      case 'windows': {
        void HapticFeedback.vibrate();
        break;
      }
      case 'iOS':
      case 'macOS': {
        break;
      }
      default:
        throw new TypeError('Invalid value outside exhaustive Dart switch');
    }
  }
  _dart_e3418b5381fd4ff8_handleModeChanged(mode: DatePickerMode): void {
    void this._dart_e3418b5381fd4ff8_vibrate();
    void this.setState((): void => {
      void (this._dart_e3418b5381fd4ff8_mode = mode);
      {
        const _dartTemporary9 = this._dart_e3418b5381fd4ff8_selectedDate;
        const _dartTemporary10 = (() => {
          if (!isDartType<DateTime>(_dartTemporary9, dateTimeType)) return null;
          const selected: DateTime = _dartTemporary9 as DateTime;
          return { ['selected']: selected };
        })();
        if (_dartTemporary10 !== null) {
          const selected: DateTime = _dartTemporary10['selected'];
          {
            const message: string = (() => {
              const _dartTemporary8 = mode;
              switch (_dartTemporary8) {
                case DatePickerMode.day:
                  return this.widget.calendarDelegate.formatMonthYear(
                    selected,
                    this._dart_e3418b5381fd4ff8_localizations,
                  );
                case DatePickerMode.year:
                  return this.widget.calendarDelegate.formatYear(
                    checkedInteger(selected.year),
                    this._dart_e3418b5381fd4ff8_localizations,
                  );
                default:
                  throw new TypeError('Non-exhaustive Dart switch expression');
              }
            })();
            void this._dart_e3418b5381fd4ff8_announce(message);
          }
        }
      }
    });
  }
  _dart_e3418b5381fd4ff8_handleMonthChanged(date: DateTime): void {
    void this.setState((): void => {
      if (
        checkedInteger(this._dart_e3418b5381fd4ff8_currentDisplayedMonthDate.year) !==
          checkedInteger(date.year) ||
        checkedInteger(this._dart_e3418b5381fd4ff8_currentDisplayedMonthDate.month) !==
          checkedInteger(date.month)
      ) {
        void (this._dart_e3418b5381fd4ff8_currentDisplayedMonthDate =
          this.widget.calendarDelegate.getMonth(
            checkedInteger(date.year),
            checkedInteger(date.month),
          ));
        void (() => {
          const _dartTemporary11 = this.widget.onDisplayedMonthChanged;
          if (_dartTemporary11 === null) return null;
          return _dartTemporary11!(this._dart_e3418b5381fd4ff8_currentDisplayedMonthDate);
        })();
      }
    });
  }
  _dart_e3418b5381fd4ff8_handleYearChanged(value: DateTime): void {
    void this._dart_e3418b5381fd4ff8_vibrate();
    /**
     * @dartType int
     * @dartTypeOrigin explicit
     */
    const daysInMonth: number = checkedInteger(
      this.widget.calendarDelegate.getDaysInMonth(
        checkedInteger(value.year),
        checkedInteger(value.month),
      ),
    );
    /**
     * @dartType int
     * @dartTypeOrigin explicit
     */
    const preferredDay: number = checkedInteger(
      castSourceDartInt(
        minSourceDartNum(
          boxSourceDartInt(
            checkedInteger(
              (() => {
                const _dartTemporary12 = this._dart_e3418b5381fd4ff8_selectedDate;
                return _dartTemporary12 === null ? null : _dartTemporary12.day;
              })() ?? 1,
            ),
          ),
          boxSourceDartInt(checkedInteger(daysInMonth)),
        ),
      ),
    );
    void (value = this.widget.calendarDelegate.getDay(
      checkedInteger(value.year),
      checkedInteger(value.month),
      checkedInteger(preferredDay),
    ));
    if (value.isBefore(this.widget.firstDate)) {
      void (value = this.widget.firstDate);
    } else if (value.isAfter(this.widget.lastDate)) {
      void (value = this.widget.lastDate);
    }
    void this.setState((): void => {
      void (this._dart_e3418b5381fd4ff8_mode = DatePickerMode.day);
      void this._dart_e3418b5381fd4ff8_handleMonthChanged(value);
      if (this._dart_e3418b5381fd4ff8_isSelectable(value)) {
        void (this._dart_e3418b5381fd4ff8_selectedDate = value);
        void this.widget.onDateChanged(
          (() => {
            const _dartTemporary13 = this._dart_e3418b5381fd4ff8_selectedDate;
            if (_dartTemporary13 === null)
              throw new TypeError('Null check operator used on a null value');
            return _dartTemporary13!;
          })(),
        );
      }
    });
  }
  _dart_e3418b5381fd4ff8_handleDayChanged(value: DateTime): void {
    void this._dart_e3418b5381fd4ff8_vibrate();
    void this.setState((): void => {
      void (this._dart_e3418b5381fd4ff8_selectedDate = value);
      void this.widget.onDateChanged(
        (() => {
          const _dartTemporary14 = this._dart_e3418b5381fd4ff8_selectedDate;
          if (_dartTemporary14 === null)
            throw new TypeError('Null check operator used on a null value');
          return _dartTemporary14!;
        })(),
      );
      switch (SourceDateTheme.of(this.context).platform) {
        case 'linux':
        case 'macOS':
        case 'windows': {
          const isToday: boolean = this.widget.calendarDelegate.isSameDay(
            this.widget.currentDate,
            this._dart_e3418b5381fd4ff8_selectedDate,
          );
          const semanticLabelSuffix: string = isToday
            ? `, ${this._dart_e3418b5381fd4ff8_localizations.currentDateLabel}`
            : '';
          void dateCatchError(
            SemanticsService.sendAnnouncement(
              View.of(this.context),
              `${this._dart_e3418b5381fd4ff8_localizations.selectedDateLabel} ${this.widget.calendarDelegate.formatFullDate(
                (() => {
                  const _dartTemporary15 = this._dart_e3418b5381fd4ff8_selectedDate;
                  if (_dartTemporary15 === null)
                    throw new TypeError('Null check operator used on a null value');
                  return _dartTemporary15!;
                })(),
                this._dart_e3418b5381fd4ff8_localizations,
              )}${semanticLabelSuffix}`,
              this._dart_e3418b5381fd4ff8_textDirection,
            ),
            _reportAnnouncementError,
          );
          break;
        }
        case 'android':
        case 'iOS':
        case 'fuchsia': {
          break;
        }
        default:
          throw new TypeError('Invalid value outside exhaustive Dart switch');
      }
    });
  }
  _dart_e3418b5381fd4ff8_isSelectable(date: DateTime): boolean {
    return (
      (() => {
        const _dartTemporary16 = this.widget.selectableDayPredicate;
        if (_dartTemporary16 === null) return null;
        return _dartTemporary16!(date);
      })() ?? true
    );
  }
  _dart_e3418b5381fd4ff8_buildPicker(): Widget {
    switch (this._dart_e3418b5381fd4ff8_mode) {
      case DatePickerMode.day: {
        return new _MonthPicker({
          key: this._dart_e3418b5381fd4ff8_monthPickerKey,
          calendarDelegate: this.widget.calendarDelegate,
          initialMonth: this._dart_e3418b5381fd4ff8_currentDisplayedMonthDate,
          currentDate: this.widget.currentDate,
          firstDate: this.widget.firstDate,
          lastDate: this.widget.lastDate,
          selectedDate: this._dart_e3418b5381fd4ff8_selectedDate,
          onChanged: dartMethodTearOff(this, this._dart_e3418b5381fd4ff8_handleDayChanged),
          onDisplayedMonthChanged: dartMethodTearOff(
            this,
            this._dart_e3418b5381fd4ff8_handleMonthChanged,
          ),
          selectableDayPredicate: this.widget.selectableDayPredicate,
        });
      }
      case DatePickerMode.year: {
        return datePadding({
          padding: constDateEdgeInsetsOnly(EdgeInsets, { top: _subHeaderHeight }),
          child: new YearPicker({
            key: this._dart_e3418b5381fd4ff8_yearPickerKey,
            calendarDelegate: this.widget.calendarDelegate,
            currentDate: this.widget.currentDate,
            firstDate: this.widget.firstDate,
            lastDate: this.widget.lastDate,
            selectedDate: this._dart_e3418b5381fd4ff8_currentDisplayedMonthDate,
            onChanged: dartMethodTearOff(this, this._dart_e3418b5381fd4ff8_handleYearChanged),
          }),
        });
      }
      default:
        throw new TypeError('Invalid value outside exhaustive Dart switch');
    }
  }
  override build(context: BuildContext): Widget {
    if (FoundationBuildMode.debug)
      invariant(
        debugCheckHasMaterial(context),
        'generated-source-assert',
        'Pinned Dart assertion failed',
      );
    if (FoundationBuildMode.debug)
      invariant(
        debugCheckHasMaterialLocalizations(context),
        'generated-source-assert',
        'Pinned Dart assertion failed',
      );
    if (FoundationBuildMode.debug)
      invariant(
        debugCheckHasDirectionality(context),
        'generated-source-assert',
        'Pinned Dart assertion failed',
      );
    /**
     * @dartType double
     * @dartTypeOrigin explicit
     */
    const textScaleFactor: number =
      MediaQuery.textScalerOf(context)
        .clamp({ maxScaleFactor: _kMaxTextScaleFactor })
        .scale(_fontSizeToScale) / _fontSizeToScale;
    const orientation: Orientation = dateOrientationOf(context);
    /**
     * @dartType double
     * @dartTypeOrigin explicit
     */
    const maxDayPickerHeight: number =
      SourceDateTheme.of(context).useMaterial3 && scrollbarRawObjectEquals(orientation, 'portrait')
        ? _maxDayPickerHeightM3
        : _maxDayPickerHeightM2;
    /**
     * @dartType double
     * @dartTypeOrigin explicit
     */
    const scaledMaxDayPickerHeight: number =
      textScaleFactor > 1.3
        ? maxDayPickerHeight +
          checkedInteger(checkedInteger(checkedInteger(_maxDayPickerRowCount) + 1)) *
            ((textScaleFactor - 1) * 8)
        : maxDayPickerHeight;
    const picker: SizedBox = dateSizedBox({
      height: _subHeaderHeight + scaledMaxDayPickerHeight,
      child: this._dart_e3418b5381fd4ff8_buildPicker(),
    });
    return dateStack({
      children: (() => {
        const _dartTemporary17: Widget[] = [];
        if (dateMaybeSupportsAnnounceOf(context) ?? false) _dartTemporary17.push(picker);
        else
          _dartTemporary17.push(
            new Semantics({
              container: true,
              liveRegion: true,
              accessibilityFocusBlockType: AccessibilityFocusBlockType.blockNode,
              label: this._dart_e3418b5381fd4ff8_announcementText,
              child: picker,
            }),
          );
        _dartTemporary17.push(
          dateClampedTextScaling({
            maxScaleFactor: _kModeToggleButtonMaxScaleFactor,
            child: new _DatePickerModeToggleButton({
              mode: this._dart_e3418b5381fd4ff8_mode,
              title: this.widget.calendarDelegate.formatMonthYear(
                this._dart_e3418b5381fd4ff8_currentDisplayedMonthDate,
                this._dart_e3418b5381fd4ff8_localizations,
              ),
              onTitlePressed: (): void => {
                void this._dart_e3418b5381fd4ff8_handleModeChanged(
                  (() => {
                    const _dartTemporary18 = this._dart_e3418b5381fd4ff8_mode;
                    switch (_dartTemporary18) {
                      case DatePickerMode.day:
                        return DatePickerMode.year;
                      case DatePickerMode.year:
                        return DatePickerMode.day;
                      default:
                        throw new TypeError('Non-exhaustive Dart switch expression');
                    }
                  })(),
                );
              },
            }),
          }),
        );
        return _dartTemporary17;
      })(),
    });
  }
}
export class _DatePickerModeToggleButton extends ScrollbarStatefulHost {
  readonly mode: DatePickerMode;
  readonly title: string;
  readonly onTitlePressed: () => void;
  constructor({
    mode,
    title,
    onTitlePressed,
  }: {
    readonly mode: DatePickerMode;
    readonly title: string;
    readonly onTitlePressed: () => void;
  }) {
    const _initialField0 = mode;
    const _initialField1 = title;
    const _initialField2 = onTitlePressed;
    super();
    this.mode = _initialField0;
    this.title = _initialField1;
    this.onTitlePressed = _initialField2;
    protect(this, ['mode', 'title', 'onTitlePressed']);
  }
  override createState(): _DatePickerModeToggleButtonState {
    return new _DatePickerModeToggleButtonState();
  }
}
export class _DatePickerModeToggleButtonState extends SingleTickerProviderStateMixin<_DatePickerModeToggleButton> {
  get _dart_e3418b5381fd4ff8_controller(): AnimationController {
    return dartLateRead<AnimationController>(
      this,
      'package:flutter/src/material/calendar_date_picker.dart::_DatePickerModeToggleButtonState._controller:FIELD',
      '_controller',
    );
  }
  set _dart_e3418b5381fd4ff8_controller(value: AnimationController) {
    dartLateWrite<AnimationController>(
      this,
      'package:flutter/src/material/calendar_date_picker.dart::_DatePickerModeToggleButtonState._controller:FIELD',
      '_controller',
      value,
      false,
    );
  }
  constructor() {
    super();
  }
  override initState(): void {
    void super.initState();
    void (this._dart_e3418b5381fd4ff8_controller = new AnimationController({
      value: scrollbarRawObjectEquals(this.widget.mode, DatePickerMode.year) ? 0.5 : 0,
      upperBound: 0.5,
      duration: 0 + 200 * 1,
      vsync: this,
    }));
  }
  override didUpdateWidget(oldWidget: _DatePickerModeToggleButton): void {
    if (!(oldWidget instanceof _DatePickerModeToggleButton))
      throw new TypeError('Invalid covariant argument: oldWidget');
    void super.didUpdateWidget(oldWidget);
    if (scrollbarRawObjectEquals(oldWidget.mode, this.widget.mode)) {
      return;
    }
    if (scrollbarRawObjectEquals(this.widget.mode, DatePickerMode.year)) {
      void this._dart_e3418b5381fd4ff8_controller.forward();
    } else {
      void this._dart_e3418b5381fd4ff8_controller.reverse();
    }
  }
  override build(context: BuildContext): Widget {
    const datePickerTheme: DatePickerThemeData = DatePickerTheme.of(context);
    const defaults: DatePickerThemeData = DatePickerTheme.defaults(context);
    const buttonTextStyle: TextStyle | null =
      datePickerTheme.toggleButtonTextStyle ?? defaults.toggleButtonTextStyle;
    const subHeaderForegroundColor: Color | null =
      datePickerTheme.subHeaderForegroundColor ?? defaults.subHeaderForegroundColor;
    const buttonTextColor: Color | null =
      (() => {
        const _dartTemporary19 = datePickerTheme.toggleButtonTextStyle;
        return _dartTemporary19 === null ? null : dateTextStyleColor(_dartTemporary19);
      })() ??
      datePickerTheme.subHeaderForegroundColor ??
      (() => {
        const _dartTemporary20 = defaults.toggleButtonTextStyle;
        return _dartTemporary20 === null ? null : dateTextStyleColor(_dartTemporary20);
      })();
    return dateSizedBox({
      height: _subHeaderHeight,
      child: datePadding({
        padding: constDateEdgeInsetsDirectionalOnly(EdgeInsetsDirectional, { start: 16, end: 4 }),
        child: dateRow({
          children: (() => {
            const _dartTemporary21: Widget[] = [];
            _dartTemporary21.push(
              dateFlexible({
                child: new Semantics({
                  label: MaterialLocalizations.of(context).selectYearSemanticsLabel,
                  button: true,
                  container: true,
                  child: dateSizedBox({
                    height: _subHeaderHeight,
                    child: new InkWell({
                      onTap: this.widget.onTitlePressed,
                      child: datePadding({
                        padding: constDateEdgeInsetsSymmetric(EdgeInsets, { horizontal: 8 }),
                        child: dateRow({
                          children: [
                            dateFlexible({
                              child: dateText(this.widget.title, {
                                overflow: TextOverflow.ellipsis,
                                style: (() => {
                                  const _dartTemporary22 = buttonTextStyle;
                                  return _dartTemporary22 === null
                                    ? null
                                    : dateTextStyleApply(_dartTemporary22, {
                                        color: buttonTextColor,
                                      });
                                })(),
                              }),
                            }),
                            new RotationTransition({
                              turns: this._dart_e3418b5381fd4ff8_controller,
                              child: new Icon(Icons.arrow_drop_down, {
                                color: subHeaderForegroundColor,
                              }),
                            }),
                          ],
                        }),
                      }),
                    }),
                  }),
                }),
              }),
            );
            if (scrollbarRawObjectEquals(this.widget.mode, DatePickerMode.day))
              _dartTemporary21.push(constDateSizedBox(SizedBox, { width: _monthNavButtonsWidth }));
            return _dartTemporary21;
          })(),
        }),
      }),
    });
  }
  override dispose(): void {
    void this._dart_e3418b5381fd4ff8_controller.dispose();
    void super.dispose();
  }
}
export class _MonthPicker extends ScrollbarStatefulHost {
  readonly initialMonth: DateTime;
  readonly currentDate: DateTime;
  readonly firstDate: DateTime;
  readonly lastDate: DateTime;
  readonly selectedDate: DateTime | null;
  readonly onChanged: (argument0: DateTime) => void;
  readonly onDisplayedMonthChanged: (argument0: DateTime) => void;
  readonly selectableDayPredicate: ((argument0: DateTime) => boolean) | null;
  readonly calendarDelegate: CalendarDelegate<DateTime>;
  constructor({
    key = null,
    initialMonth,
    currentDate,
    firstDate,
    lastDate,
    selectedDate,
    onChanged,
    onDisplayedMonthChanged,
    calendarDelegate,
    selectableDayPredicate = null,
  }: {
    readonly key?: Key | null;
    readonly initialMonth: DateTime;
    readonly currentDate: DateTime;
    readonly firstDate: DateTime;
    readonly lastDate: DateTime;
    readonly selectedDate: DateTime | null;
    readonly onChanged: (argument0: DateTime) => void;
    readonly onDisplayedMonthChanged: (argument0: DateTime) => void;
    readonly calendarDelegate: CalendarDelegate<DateTime>;
    readonly selectableDayPredicate?: ((argument0: DateTime) => boolean) | null;
  }) {
    const _initialField0 = initialMonth;
    const _initialField1 = currentDate;
    const _initialField2 = firstDate;
    const _initialField3 = lastDate;
    const _initialField4 = selectedDate;
    const _initialField5 = onChanged;
    const _initialField6 = onDisplayedMonthChanged;
    const _initialField7 = calendarDelegate;
    const _initialField8 = selectableDayPredicate;
    if (FoundationBuildMode.debug)
      invariant(
        !firstDate.isAfter(lastDate),
        'generated-source-assert',
        'Pinned Dart assertion failed',
      );
    if (FoundationBuildMode.debug)
      invariant(
        selectedDate === null || !(selectedDate as DateTime).isBefore(firstDate),
        'generated-source-assert',
        'Pinned Dart assertion failed',
      );
    if (FoundationBuildMode.debug)
      invariant(
        selectedDate === null || !(selectedDate as DateTime).isAfter(lastDate),
        'generated-source-assert',
        'Pinned Dart assertion failed',
      );
    super({ key: key });
    this.initialMonth = _initialField0;
    this.currentDate = _initialField1;
    this.firstDate = _initialField2;
    this.lastDate = _initialField3;
    this.selectedDate = _initialField4;
    this.onChanged = _initialField5;
    this.onDisplayedMonthChanged = _initialField6;
    this.selectableDayPredicate = _initialField8;
    this.calendarDelegate = _initialField7;
    protect(this, [
      'initialMonth',
      'currentDate',
      'firstDate',
      'lastDate',
      'selectedDate',
      'onChanged',
      'onDisplayedMonthChanged',
      'selectableDayPredicate',
      'calendarDelegate',
    ]);
  }
  override createState(): _MonthPickerState {
    return new _MonthPickerState();
  }
}
export class _MonthPickerState extends State<_MonthPicker> {
  readonly _dart_e3418b5381fd4ff8_pageViewKey: GlobalKey<State<StatefulWidget>>;
  _dart_e3418b5381fd4ff8_announcementText: string;
  get _dart_e3418b5381fd4ff8_currentMonth(): DateTime {
    return dartLateRead<DateTime>(
      this,
      'package:flutter/src/material/calendar_date_picker.dart::_MonthPickerState._currentMonth:FIELD',
      '_currentMonth',
    );
  }
  set _dart_e3418b5381fd4ff8_currentMonth(value: DateTime) {
    dartLateWrite<DateTime>(
      this,
      'package:flutter/src/material/calendar_date_picker.dart::_MonthPickerState._currentMonth:FIELD',
      '_currentMonth',
      value,
      false,
    );
  }
  get _dart_e3418b5381fd4ff8_pageController(): PageController {
    return dartLateRead<PageController>(
      this,
      'package:flutter/src/material/calendar_date_picker.dart::_MonthPickerState._pageController:FIELD',
      '_pageController',
    );
  }
  set _dart_e3418b5381fd4ff8_pageController(value: PageController) {
    dartLateWrite<PageController>(
      this,
      'package:flutter/src/material/calendar_date_picker.dart::_MonthPickerState._pageController:FIELD',
      '_pageController',
      value,
      false,
    );
  }
  get _dart_e3418b5381fd4ff8_localizations(): MaterialLocalizations {
    return dartLateRead<MaterialLocalizations>(
      this,
      'package:flutter/src/material/calendar_date_picker.dart::_MonthPickerState._localizations:FIELD',
      '_localizations',
    );
  }
  set _dart_e3418b5381fd4ff8_localizations(value: MaterialLocalizations) {
    dartLateWrite<MaterialLocalizations>(
      this,
      'package:flutter/src/material/calendar_date_picker.dart::_MonthPickerState._localizations:FIELD',
      '_localizations',
      value,
      false,
    );
  }
  _dart_e3418b5381fd4ff8_shortcutMap: DartMap<ShortcutActivator, Intent> | null;
  _dart_e3418b5381fd4ff8_actionMap: DartMap<IntentType, Action<Intent>> | null;
  get _dart_e3418b5381fd4ff8_dayGridFocus(): FocusNode {
    return dartLateRead<FocusNode>(
      this,
      'package:flutter/src/material/calendar_date_picker.dart::_MonthPickerState._dayGridFocus:FIELD',
      '_dayGridFocus',
    );
  }
  set _dart_e3418b5381fd4ff8_dayGridFocus(value: FocusNode) {
    dartLateWrite<FocusNode>(
      this,
      'package:flutter/src/material/calendar_date_picker.dart::_MonthPickerState._dayGridFocus:FIELD',
      '_dayGridFocus',
      value,
      false,
    );
  }
  _dart_e3418b5381fd4ff8_focusedDay: DateTime | null;
  /**
   * @dartType Map<TraversalDirection, int>
   * @dartTypeOrigin explicit
   */
  static readonly _dart_e3418b5381fd4ff8_directionOffset: DartMap<TraversalDirection, DartInt> =
    constdateTraversalDirectionintMap([
      [
        TraversalDirection.up,
        boxSourceDartInt(checkedInteger(-checkedInteger(DateTime.daysPerWeek))),
      ],
      [TraversalDirection.right, boxSourceDartInt(1)],
      [TraversalDirection.down, boxSourceDartInt(checkedInteger(DateTime.daysPerWeek))],
      [TraversalDirection.left, boxSourceDartInt(checkedInteger(-1))],
    ]);
  constructor() {
    const _initialField0 = scrollbarGlobalKey();
    const _initialField1 = '';
    super();
    this._dart_e3418b5381fd4ff8_pageViewKey = _initialField0;
    this._dart_e3418b5381fd4ff8_announcementText = _initialField1;
    this._dart_e3418b5381fd4ff8_shortcutMap = null;
    this._dart_e3418b5381fd4ff8_actionMap = null;
    this._dart_e3418b5381fd4ff8_focusedDay = null;
    protect(this, ['_dart_e3418b5381fd4ff8_pageViewKey']);
  }
  override initState(): void {
    void super.initState();
    void (this._dart_e3418b5381fd4ff8_currentMonth = this.widget.initialMonth);
    void (this._dart_e3418b5381fd4ff8_pageController = new PageController({
      initialPage: checkedInteger(
        this.widget.calendarDelegate.monthDelta(
          this.widget.firstDate,
          this._dart_e3418b5381fd4ff8_currentMonth,
        ),
      ),
    }));
    void (this._dart_e3418b5381fd4ff8_shortcutMap = constdateShortcutActivatorIntentMap([
      [
        constDateSingleActivator(SingleActivator, LogicalKeyboardKey.arrowLeft),
        constDateDirectionalFocusIntent(DirectionalFocusIntent, TraversalDirection.left),
      ],
      [
        constDateSingleActivator(SingleActivator, LogicalKeyboardKey.arrowRight),
        constDateDirectionalFocusIntent(DirectionalFocusIntent, TraversalDirection.right),
      ],
      [
        constDateSingleActivator(SingleActivator, LogicalKeyboardKey.arrowDown),
        constDateDirectionalFocusIntent(DirectionalFocusIntent, TraversalDirection.down),
      ],
      [
        constDateSingleActivator(SingleActivator, LogicalKeyboardKey.arrowUp),
        constDateDirectionalFocusIntent(DirectionalFocusIntent, TraversalDirection.up),
      ],
    ]));
    void (this._dart_e3418b5381fd4ff8_actionMap = (() => {
      const _dartTemporary24 = NextFocusIntent;
      const _dartTemporary25 = dateNextFocusIntentAction({
        onInvoke: dartMethodTearOff(this, this._dart_e3418b5381fd4ff8_handleGridNextFocus),
      });
      const _dartTemporary26 = PreviousFocusIntent;
      const _dartTemporary27 = datePreviousFocusIntentAction({
        onInvoke: dartMethodTearOff(this, this._dart_e3418b5381fd4ff8_handleGridPreviousFocus),
      });
      const _dartTemporary28 = DirectionalFocusIntent;
      const _dartTemporary29 = dateDirectionalFocusIntentAction({
        onInvoke: dartMethodTearOff(this, this._dart_e3418b5381fd4ff8_handleDirectionFocus),
      });
      const _dartTemporary23 = dateTypeActionMap();
      _dartTemporary23.set(_dartTemporary24, _dartTemporary25);
      _dartTemporary23.set(_dartTemporary26, _dartTemporary27);
      _dartTemporary23.set(_dartTemporary28, _dartTemporary29);
      return _dartTemporary23;
    })());
    void (this._dart_e3418b5381fd4ff8_dayGridFocus = new FocusNode({ debugLabel: 'Day Grid' }));
  }
  override didChangeDependencies(): void {
    void super.didChangeDependencies();
    void (this._dart_e3418b5381fd4ff8_localizations = MaterialLocalizations.of(this.context));
  }
  override dispose(): void {
    void this._dart_e3418b5381fd4ff8_pageController.dispose();
    void this._dart_e3418b5381fd4ff8_dayGridFocus.dispose();
    void super.dispose();
  }
  _dart_e3418b5381fd4ff8_handleDateSelected(selectedDate: DateTime): void {
    void (this._dart_e3418b5381fd4ff8_focusedDay = selectedDate);
    void this.widget.onChanged(selectedDate);
  }
  _dart_e3418b5381fd4ff8_announce(message: string): void {
    if (dateMaybeSupportsAnnounceOf(this.context) ?? false) {
      void dateCatchError(
        SemanticsService.sendAnnouncement(
          View.of(this.context),
          message,
          Directionality.of(this.context),
        ),
        _reportAnnouncementError,
      );
    } else {
      void (this._dart_e3418b5381fd4ff8_announcementText = message);
    }
  }
  /**
   * @dartParam monthPage int
   * @dartParamOrigin monthPage explicit
   */
  _dart_e3418b5381fd4ff8_handleMonthPageChanged(monthPage: number): void {
    checkedInteger(monthPage);
    void this.setState((): void => {
      const monthDate: DateTime = this.widget.calendarDelegate.addMonthsToMonthDate(
        this.widget.firstDate,
        checkedInteger(monthPage),
      );
      if (
        !this.widget.calendarDelegate.isSameMonth(
          this._dart_e3418b5381fd4ff8_currentMonth,
          monthDate,
        )
      ) {
        void (this._dart_e3418b5381fd4ff8_currentMonth = this.widget.calendarDelegate.getMonth(
          checkedInteger(monthDate.year),
          checkedInteger(monthDate.month),
        ));
        void this.widget.onDisplayedMonthChanged(this._dart_e3418b5381fd4ff8_currentMonth);
        if (
          this._dart_e3418b5381fd4ff8_focusedDay !== null &&
          !this.widget.calendarDelegate.isSameMonth(
            this._dart_e3418b5381fd4ff8_focusedDay,
            this._dart_e3418b5381fd4ff8_currentMonth,
          )
        ) {
          void (this._dart_e3418b5381fd4ff8_focusedDay =
            this._dart_e3418b5381fd4ff8_focusableDayForMonth(
              this._dart_e3418b5381fd4ff8_currentMonth,
              checkedInteger(
                (() => {
                  const _dartTemporary30 = this._dart_e3418b5381fd4ff8_focusedDay;
                  if (_dartTemporary30 === null)
                    throw new TypeError('Null check operator used on a null value');
                  return _dartTemporary30!;
                })().day,
              ),
            ));
        }
        void this._dart_e3418b5381fd4ff8_announce(
          this.widget.calendarDelegate.formatMonthYear(
            this._dart_e3418b5381fd4ff8_currentMonth,
            this._dart_e3418b5381fd4ff8_localizations,
          ),
        );
      }
    });
  }
  /**
   * @dartParam preferredDay int
   * @dartParamOrigin preferredDay explicit
   */
  _dart_e3418b5381fd4ff8_focusableDayForMonth(
    month: DateTime,
    preferredDay: number,
  ): DateTime | null {
    checkedInteger(preferredDay);
    /**
     * @dartType int
     * @dartTypeOrigin explicit
     */
    const daysInMonth: number = checkedInteger(
      this.widget.calendarDelegate.getDaysInMonth(
        checkedInteger(month.year),
        checkedInteger(month.month),
      ),
    );
    if (checkedInteger(preferredDay) <= checkedInteger(daysInMonth)) {
      const newFocus: DateTime = this.widget.calendarDelegate.getDay(
        checkedInteger(month.year),
        checkedInteger(month.month),
        checkedInteger(preferredDay),
      );
      if (this._dart_e3418b5381fd4ff8_isSelectable(newFocus)) {
        return newFocus;
      }
    }
    for (
      let /**
         * @dartType int
         * @dartTypeOrigin inferred
         */
        day: number = 1;
      checkedInteger(day) <= checkedInteger(daysInMonth);
      checkedInteger(
        (() => {
          const _dartTemporary31 = checkedInteger(day);
          const _dartTemporary32 = checkedInteger(_dartTemporary31 + 1);
          day = _dartTemporary32;
          return _dartTemporary31;
        })(),
      )
    ) {
      const newFocus: DateTime = this.widget.calendarDelegate.getDay(
        checkedInteger(month.year),
        checkedInteger(month.month),
        checkedInteger(day),
      );
      if (this._dart_e3418b5381fd4ff8_isSelectable(newFocus)) {
        return newFocus;
      }
    }
    return null;
  }
  _dart_e3418b5381fd4ff8_handleNextMonth(): void {
    if (!this._dart_e3418b5381fd4ff8_isDisplayingLastMonth) {
      void dateNextPage(this._dart_e3418b5381fd4ff8_pageController, {
        duration: _monthScrollDuration,
        curve: Curves.ease,
      });
    }
  }
  _dart_e3418b5381fd4ff8_handlePreviousMonth(): void {
    if (!this._dart_e3418b5381fd4ff8_isDisplayingFirstMonth) {
      void datePreviousPage(this._dart_e3418b5381fd4ff8_pageController, {
        duration: _monthScrollDuration,
        curve: Curves.ease,
      });
    }
  }
  _dart_e3418b5381fd4ff8_showMonth(
    month: DateTime,
    {
      jump = false,
    }: {
      readonly jump?: boolean;
    } = {},
  ): void {
    /**
     * @dartType int
     * @dartTypeOrigin explicit
     */
    const monthPage: number = checkedInteger(
      this.widget.calendarDelegate.monthDelta(this.widget.firstDate, month),
    );
    if (jump) {
      void this._dart_e3418b5381fd4ff8_pageController.jumpToPage(checkedInteger(monthPage));
    } else {
      void this._dart_e3418b5381fd4ff8_pageController.animateToPage(checkedInteger(monthPage), {
        duration: _monthScrollDuration,
        curve: Curves.ease,
      });
    }
  }
  get _dart_e3418b5381fd4ff8_isDisplayingFirstMonth(): boolean {
    return !this._dart_e3418b5381fd4ff8_currentMonth.isAfter(
      this.widget.calendarDelegate.getMonth(
        checkedInteger(this.widget.firstDate.year),
        checkedInteger(this.widget.firstDate.month),
      ),
    );
  }
  get _dart_e3418b5381fd4ff8_isDisplayingLastMonth(): boolean {
    return !this._dart_e3418b5381fd4ff8_currentMonth.isBefore(
      this.widget.calendarDelegate.getMonth(
        checkedInteger(this.widget.lastDate.year),
        checkedInteger(this.widget.lastDate.month),
      ),
    );
  }
  _dart_e3418b5381fd4ff8_handleGridFocusChange(focused: boolean): void {
    void this.setState((): void => {
      if (focused && this._dart_e3418b5381fd4ff8_focusedDay === null) {
        if (
          this.widget.calendarDelegate.isSameMonth(
            this.widget.selectedDate,
            this._dart_e3418b5381fd4ff8_currentMonth,
          )
        ) {
          void (this._dart_e3418b5381fd4ff8_focusedDay = this.widget.selectedDate);
        } else if (
          this.widget.calendarDelegate.isSameMonth(
            this.widget.currentDate,
            this._dart_e3418b5381fd4ff8_currentMonth,
          )
        ) {
          void (this._dart_e3418b5381fd4ff8_focusedDay =
            this._dart_e3418b5381fd4ff8_focusableDayForMonth(
              this._dart_e3418b5381fd4ff8_currentMonth,
              checkedInteger(this.widget.currentDate.day),
            ));
        } else {
          void (this._dart_e3418b5381fd4ff8_focusedDay =
            this._dart_e3418b5381fd4ff8_focusableDayForMonth(
              this._dart_e3418b5381fd4ff8_currentMonth,
              1,
            ));
        }
      }
    });
  }
  _dart_e3418b5381fd4ff8_handleGridNextFocus(intent: NextFocusIntent): void {
    void this._dart_e3418b5381fd4ff8_dayGridFocus.requestFocus();
    void this._dart_e3418b5381fd4ff8_dayGridFocus.nextFocus();
  }
  _dart_e3418b5381fd4ff8_handleGridPreviousFocus(intent: PreviousFocusIntent): void {
    void this._dart_e3418b5381fd4ff8_dayGridFocus.requestFocus();
    void this._dart_e3418b5381fd4ff8_dayGridFocus.previousFocus();
  }
  _dart_e3418b5381fd4ff8_handleDirectionFocus(intent: DirectionalFocusIntent): void {
    if (FoundationBuildMode.debug)
      invariant(
        this._dart_e3418b5381fd4ff8_focusedDay !== null,
        'generated-source-assert',
        'Pinned Dart assertion failed',
      );
    void this.setState((): void => {
      const nextDate: DateTime | null = this._dart_e3418b5381fd4ff8_nextDateInDirection(
        (() => {
          const _dartTemporary33 = this._dart_e3418b5381fd4ff8_focusedDay;
          if (_dartTemporary33 === null)
            throw new TypeError('Null check operator used on a null value');
          return _dartTemporary33!;
        })(),
        intent.direction,
      );
      if (nextDate !== null) {
        void (this._dart_e3418b5381fd4ff8_focusedDay = nextDate as DateTime);
        if (
          !this.widget.calendarDelegate.isSameMonth(
            this._dart_e3418b5381fd4ff8_focusedDay,
            this._dart_e3418b5381fd4ff8_currentMonth,
          )
        ) {
          void this._dart_e3418b5381fd4ff8_showMonth(
            (() => {
              const _dartTemporary34 = this._dart_e3418b5381fd4ff8_focusedDay;
              if (_dartTemporary34 === null)
                throw new TypeError('Null check operator used on a null value');
              return _dartTemporary34!;
            })(),
          );
        }
      }
    });
  }
  /**
   * @dartReturn int
   * @dartReturnOrigin explicit
   */
  _dart_e3418b5381fd4ff8_dayDirectionOffset(
    traversalDirection: TraversalDirection,
    textDirection: ScrollbarTextDirection,
  ): number {
    if (scrollbarRawObjectEquals(textDirection, 'rtl')) {
      if (scrollbarRawObjectEquals(traversalDirection, TraversalDirection.left)) {
        void (traversalDirection = TraversalDirection.right);
      } else if (scrollbarRawObjectEquals(traversalDirection, TraversalDirection.right)) {
        void (traversalDirection = TraversalDirection.left);
      }
    }
    return checkedInteger(
      (() => {
        const _dartTemporary36 = (() => {
          const _dartTemporary35 = dateMapGet(
            _MonthPickerState._dart_e3418b5381fd4ff8_directionOffset,
            traversalDirection,
          );
          return _dartTemporary35 === null ? null : castSourceDartInt(_dartTemporary35);
        })();
        if (_dartTemporary36 === null)
          throw new TypeError('Null check operator used on a null value');
        return _dartTemporary36!;
      })(),
    );
  }
  _dart_e3418b5381fd4ff8_nextDateInDirection(
    date: DateTime,
    direction: TraversalDirection,
  ): DateTime | null {
    const textDirection: ScrollbarTextDirection = Directionality.of(this.context);
    let nextDate: DateTime = this.widget.calendarDelegate.addDaysToDate(
      date,
      checkedInteger(this._dart_e3418b5381fd4ff8_dayDirectionOffset(direction, textDirection)),
    );
    while (!nextDate.isBefore(this.widget.firstDate) && !nextDate.isAfter(this.widget.lastDate)) {
      if (this._dart_e3418b5381fd4ff8_isSelectable(nextDate)) {
        return nextDate;
      }
      void (nextDate = this.widget.calendarDelegate.addDaysToDate(
        nextDate,
        checkedInteger(this._dart_e3418b5381fd4ff8_dayDirectionOffset(direction, textDirection)),
      ));
    }
    return null;
  }
  _dart_e3418b5381fd4ff8_isSelectable(date: DateTime): boolean {
    return (
      (() => {
        const _dartTemporary37 = this.widget.selectableDayPredicate;
        if (_dartTemporary37 === null) return null;
        return _dartTemporary37!(date);
      })() ?? true
    );
  }
  /**
   * @dartParam index int
   * @dartParamOrigin index explicit
   */
  _dart_e3418b5381fd4ff8_buildItems(context: BuildContext, index: number): Widget {
    checkedInteger(index);
    const month: DateTime = this.widget.calendarDelegate.addMonthsToMonthDate(
      this.widget.firstDate,
      checkedInteger(index),
    );
    return new _DayPicker({
      key: dateValueKey(month),
      calendarDelegate: this.widget.calendarDelegate,
      selectedDate: this.widget.selectedDate,
      currentDate: this.widget.currentDate,
      onChanged: dartMethodTearOff(this, this._dart_e3418b5381fd4ff8_handleDateSelected),
      firstDate: this.widget.firstDate,
      lastDate: this.widget.lastDate,
      displayedMonth: month,
      selectableDayPredicate: this.widget.selectableDayPredicate,
    });
  }
  override build(context: BuildContext): Widget {
    const subHeaderForegroundColor: Color | null =
      DatePickerTheme.of(context).subHeaderForegroundColor ??
      DatePickerTheme.defaults(context).subHeaderForegroundColor;
    const supportsAnnounce: boolean = dateMaybeSupportsAnnounceOf(context) ?? false;
    return new Semantics({
      container: true,
      explicitChildNodes: true,
      liveRegion: !supportsAnnounce,
      accessibilityFocusBlockType: !supportsAnnounce
        ? AccessibilityFocusBlockType.blockNode
        : AccessibilityFocusBlockType.none,
      label: !supportsAnnounce ? this._dart_e3418b5381fd4ff8_announcementText : null,
      child: dateColumn({
        children: [
          dateSizedBox({
            height: _subHeaderHeight,
            child: datePadding({
              padding: constDateEdgeInsetsDirectionalOnly(EdgeInsetsDirectional, {
                start: 16,
                end: 4,
              }),
              child: dateRow({
                children: [
                  constDateSpacer(Spacer),
                  new IconButton({
                    icon: new Icon(Icons.chevron_left, {
                      semanticLabel: this._dart_e3418b5381fd4ff8_isDisplayingFirstMonth
                        ? this._dart_e3418b5381fd4ff8_localizations.previousMonthTooltip
                        : null,
                    }),
                    color: subHeaderForegroundColor,
                    tooltip: this._dart_e3418b5381fd4ff8_isDisplayingFirstMonth
                      ? null
                      : this._dart_e3418b5381fd4ff8_localizations.previousMonthTooltip,
                    onPressed: this._dart_e3418b5381fd4ff8_isDisplayingFirstMonth
                      ? null
                      : dartMethodTearOff(this, this._dart_e3418b5381fd4ff8_handlePreviousMonth),
                  }),
                  new IconButton({
                    icon: new Icon(Icons.chevron_right, {
                      semanticLabel: this._dart_e3418b5381fd4ff8_isDisplayingLastMonth
                        ? this._dart_e3418b5381fd4ff8_localizations.nextMonthTooltip
                        : null,
                    }),
                    color: subHeaderForegroundColor,
                    tooltip: this._dart_e3418b5381fd4ff8_isDisplayingLastMonth
                      ? null
                      : this._dart_e3418b5381fd4ff8_localizations.nextMonthTooltip,
                    onPressed: this._dart_e3418b5381fd4ff8_isDisplayingLastMonth
                      ? null
                      : dartMethodTearOff(this, this._dart_e3418b5381fd4ff8_handleNextMonth),
                  }),
                ],
              }),
            }),
          }),
          dateExpanded({
            child: dateFocusableActionDetector({
              shortcuts: this._dart_e3418b5381fd4ff8_shortcutMap,
              actions: this._dart_e3418b5381fd4ff8_actionMap,
              focusNode: this._dart_e3418b5381fd4ff8_dayGridFocus,
              onFocusChange: dartMethodTearOff(
                this,
                this._dart_e3418b5381fd4ff8_handleGridFocusChange,
              ),
              child: new _FocusedDate({
                calendarDelegate: this.widget.calendarDelegate,
                date: this._dart_e3418b5381fd4ff8_dayGridFocus.hasFocus
                  ? this._dart_e3418b5381fd4ff8_focusedDay
                  : null,
                child: new Material({
                  type: MaterialType.transparency,
                  child: datePageViewBuilder({
                    key: this._dart_e3418b5381fd4ff8_pageViewKey,
                    controller: this._dart_e3418b5381fd4ff8_pageController,
                    itemBuilder: dartMethodTearOff(this, this._dart_e3418b5381fd4ff8_buildItems),
                    itemCount: checkedInteger(
                      checkedInteger(
                        this.widget.calendarDelegate.monthDelta(
                          this.widget.firstDate,
                          this.widget.lastDate,
                        ),
                      ) + 1,
                    ),
                    onPageChanged: dartMethodTearOff(
                      this,
                      this._dart_e3418b5381fd4ff8_handleMonthPageChanged,
                    ),
                  }),
                }),
              }),
            }),
          }),
        ],
      }),
    });
  }
}
protect(_MonthPickerState, ['_dart_e3418b5381fd4ff8_directionOffset']);
export class _FocusedDate extends SourceInheritedHost {
  readonly calendarDelegate: CalendarDelegate<DateTime>;
  readonly date: DateTime | null;
  constructor({
    child,
    calendarDelegate,
    date = null,
  }: {
    readonly child: Widget;
    readonly calendarDelegate: CalendarDelegate<DateTime>;
    readonly date?: DateTime | null;
  }) {
    const _initialField0 = calendarDelegate;
    const _initialField1 = date;
    super({ child: child });
    this.calendarDelegate = _initialField0;
    this.date = _initialField1;
    protect(this, ['calendarDelegate', 'date']);
  }
  override updateShouldNotify(oldWidget: _FocusedDate): boolean {
    if (!(oldWidget instanceof _FocusedDate))
      throw new TypeError('Invalid covariant argument: oldWidget');
    return !this.calendarDelegate.isSameDay(this.date, oldWidget.date);
  }
  static maybeOf(context: BuildContext): DateTime | null {
    const focusedDate: _FocusedDate | null = dateDependOnFocusedDate(context);
    return (() => {
      const _dartTemporary38 = focusedDate;
      return _dartTemporary38 === null ? null : _dartTemporary38.date;
    })();
  }
}
export class _DayPicker extends ScrollbarStatefulHost {
  readonly selectedDate: DateTime | null;
  readonly currentDate: DateTime;
  readonly onChanged: (argument0: DateTime) => void;
  readonly firstDate: DateTime;
  readonly lastDate: DateTime;
  readonly displayedMonth: DateTime;
  readonly selectableDayPredicate: ((argument0: DateTime) => boolean) | null;
  readonly calendarDelegate: CalendarDelegate<DateTime>;
  constructor({
    key = null,
    currentDate,
    displayedMonth,
    firstDate,
    lastDate,
    selectedDate,
    onChanged,
    calendarDelegate,
    selectableDayPredicate = null,
  }: {
    readonly key?: Key | null;
    readonly currentDate: DateTime;
    readonly displayedMonth: DateTime;
    readonly firstDate: DateTime;
    readonly lastDate: DateTime;
    readonly selectedDate: DateTime | null;
    readonly onChanged: (argument0: DateTime) => void;
    readonly calendarDelegate: CalendarDelegate<DateTime>;
    readonly selectableDayPredicate?: ((argument0: DateTime) => boolean) | null;
  }) {
    const _initialField0 = currentDate;
    const _initialField1 = displayedMonth;
    const _initialField2 = firstDate;
    const _initialField3 = lastDate;
    const _initialField4 = selectedDate;
    const _initialField5 = onChanged;
    const _initialField6 = calendarDelegate;
    const _initialField7 = selectableDayPredicate;
    if (FoundationBuildMode.debug)
      invariant(
        !firstDate.isAfter(lastDate),
        'generated-source-assert',
        'Pinned Dart assertion failed',
      );
    if (FoundationBuildMode.debug)
      invariant(
        selectedDate === null || !(selectedDate as DateTime).isBefore(firstDate),
        'generated-source-assert',
        'Pinned Dart assertion failed',
      );
    if (FoundationBuildMode.debug)
      invariant(
        selectedDate === null || !(selectedDate as DateTime).isAfter(lastDate),
        'generated-source-assert',
        'Pinned Dart assertion failed',
      );
    super({ key: key });
    this.selectedDate = _initialField4;
    this.currentDate = _initialField0;
    this.onChanged = _initialField5;
    this.firstDate = _initialField2;
    this.lastDate = _initialField3;
    this.displayedMonth = _initialField1;
    this.selectableDayPredicate = _initialField7;
    this.calendarDelegate = _initialField6;
    protect(this, [
      'selectedDate',
      'currentDate',
      'onChanged',
      'firstDate',
      'lastDate',
      'displayedMonth',
      'selectableDayPredicate',
      'calendarDelegate',
    ]);
  }
  override createState(): _DayPickerState {
    return new _DayPickerState();
  }
}
export class _DayPickerState extends State<_DayPicker> {
  get _dart_e3418b5381fd4ff8_dayFocusNodes(): ScrollbarSourceList<FocusNode> {
    return dartLateRead<ScrollbarSourceList<FocusNode>>(
      this,
      'package:flutter/src/material/calendar_date_picker.dart::_DayPickerState._dayFocusNodes:FIELD',
      '_dayFocusNodes',
    );
  }
  set _dart_e3418b5381fd4ff8_dayFocusNodes(value: ScrollbarSourceList<FocusNode>) {
    dartLateWrite<ScrollbarSourceList<FocusNode>>(
      this,
      'package:flutter/src/material/calendar_date_picker.dart::_DayPickerState._dayFocusNodes:FIELD',
      '_dayFocusNodes',
      value,
      false,
    );
  }
  constructor() {
    super();
  }
  override initState(): void {
    void super.initState();
    /**
     * @dartType int
     * @dartTypeOrigin explicit
     */
    const daysInMonth: number = checkedInteger(
      this.widget.calendarDelegate.getDaysInMonth(
        checkedInteger(this.widget.displayedMonth.year),
        checkedInteger(this.widget.displayedMonth.month),
      ),
    );
    void (this._dart_e3418b5381fd4ff8_dayFocusNodes = dateGenerateFocusNodes(
      checkedInteger(daysInMonth),
      (index: number): FocusNode => {
        checkedInteger(index);
        return new FocusNode({
          skipTraversal: true,
          debugLabel: `Day ${dateIntString(checkedInteger(checkedInteger(index) + 1))}`,
        });
      },
    ));
  }
  override didChangeDependencies(): void {
    void super.didChangeDependencies();
    const focusedDate: DateTime | null = _FocusedDate.maybeOf(this.context);
    if (
      focusedDate !== null &&
      this.widget.calendarDelegate.isSameMonth(this.widget.displayedMonth, focusedDate as DateTime)
    ) {
      void dateListAt(
        this._dart_e3418b5381fd4ff8_dayFocusNodes,
        checkedInteger(checkedInteger((focusedDate as DateTime).day) - 1),
      ).requestFocus();
    }
  }
  override dispose(): void {
    for (const _dartTemporary39 of this._dart_e3418b5381fd4ff8_dayFocusNodes) {
      const node: FocusNode = _dartTemporary39;
      {
        void node.dispose();
      }
    }
    void super.dispose();
  }
  _dart_e3418b5381fd4ff8_dayHeaders(
    headerStyle: TextStyle | null,
    localizations: MaterialLocalizations,
  ): ScrollbarSourceList<Widget> {
    const result: ScrollbarSourceList<Widget> = [];
    for (
      let /**
         * @dartType int
         * @dartTypeOrigin explicit
         */
        i: number = checkedInteger(localizations.firstDayOfWeekIndex);
      checkedInteger(result.length) < checkedInteger(DateTime.daysPerWeek);
      checkedInteger(
        (i = checkedInteger(
          modulo(
            checkedInteger(checkedInteger(checkedInteger(i) + 1)),
            checkedInteger(DateTime.daysPerWeek),
          ),
        )),
      )
    ) {
      const weekday: string = dateListAt(localizations.narrowWeekdays, checkedInteger(i));
      void dateListAdd(
        result,
        new ExcludeSemantics({
          child: dateCenter({ child: dateText(weekday, { style: headerStyle }) }),
        }),
      );
    }
    return result;
  }
  override build(context: BuildContext): Widget {
    const localizations: MaterialLocalizations = MaterialLocalizations.of(context);
    const datePickerTheme: DatePickerThemeData = DatePickerTheme.of(context);
    const defaults: DatePickerThemeData = DatePickerTheme.defaults(context);
    const weekdayStyle: TextStyle | null = datePickerTheme.weekdayStyle ?? defaults.weekdayStyle;
    const orientation: Orientation = dateOrientationOf(context);
    const isLandscapeOrientation: boolean = scrollbarRawObjectEquals(orientation, 'landscape');
    /**
     * @dartType int
     * @dartTypeOrigin explicit
     */
    const year: number = checkedInteger(this.widget.displayedMonth.year);
    /**
     * @dartType int
     * @dartTypeOrigin explicit
     */
    const month: number = checkedInteger(this.widget.displayedMonth.month);
    /**
     * @dartType int
     * @dartTypeOrigin explicit
     */
    const daysInMonth: number = checkedInteger(
      this.widget.calendarDelegate.getDaysInMonth(checkedInteger(year), checkedInteger(month)),
    );
    /**
     * @dartType int
     * @dartTypeOrigin explicit
     */
    const dayOffset: number = checkedInteger(
      this.widget.calendarDelegate.firstDayOffset(
        checkedInteger(year),
        checkedInteger(month),
        localizations,
      ),
    );
    const dayItems: ScrollbarSourceList<Widget> = this._dart_e3418b5381fd4ff8_dayHeaders(
      weekdayStyle,
      localizations,
    );
    /**
     * @dartType int
     * @dartTypeOrigin explicit
     */
    let day: number = checkedInteger(-checkedInteger(dayOffset));
    while (checkedInteger(day) < checkedInteger(daysInMonth)) {
      void checkedInteger(
        (() => {
          const _dartTemporary40 = checkedInteger(day);
          const _dartTemporary41 = checkedInteger(_dartTemporary40 + 1);
          day = _dartTemporary41;
          return _dartTemporary40;
        })(),
      );
      if (checkedInteger(day) < 1) {
        void dateListAdd(dayItems, constDateSizedBoxShrink(SizedBox));
      } else {
        const dayToBuild: DateTime = this.widget.calendarDelegate.getDay(
          checkedInteger(year),
          checkedInteger(month),
          checkedInteger(day),
        );
        const isDisabled: boolean =
          dayToBuild.isAfter(this.widget.lastDate) ||
          dayToBuild.isBefore(this.widget.firstDate) ||
          (this.widget.selectableDayPredicate !== null &&
            !(() => {
              const _dartTemporary42 = this.widget.selectableDayPredicate;
              if (_dartTemporary42 === null)
                throw new TypeError('Null check operator used on a null value');
              return _dartTemporary42!;
            })()(dayToBuild));
        const isSelectedDay: boolean = this.widget.calendarDelegate.isSameDay(
          this.widget.selectedDate,
          dayToBuild,
        );
        const isToday: boolean = this.widget.calendarDelegate.isSameDay(
          this.widget.currentDate,
          dayToBuild,
        );
        void dateListAdd(
          dayItems,
          new _Day(dayToBuild, {
            key: dateValueKey(dayToBuild),
            isDisabled: isDisabled,
            isSelectedDay: isSelectedDay,
            isToday: isToday,
            onChanged: this.widget.onChanged,
            focusNode: dateListAt(
              this._dart_e3418b5381fd4ff8_dayFocusNodes,
              checkedInteger(checkedInteger(day) - 1),
            ),
            calendarDelegate: this.widget.calendarDelegate,
          }),
        );
      }
    }
    /**
     * @dartType double
     * @dartTypeOrigin explicit
     */
    const monthPickerHorizontalPadding: number =
      SourceDateTheme.of(context).useMaterial3 && !isLandscapeOrientation
        ? _monthPickerHorizontalPaddingPortraitM3
        : _monthPickerHorizontalPaddingOther;
    return datePadding({
      padding: EdgeInsets.symmetric({ horizontal: monthPickerHorizontalPadding }),
      child: dateClampedTextScaling({
        maxScaleFactor: isLandscapeOrientation
          ? _kDayPickerGridLandscapeMaxScaleFactor
          : _kDayPickerGridPortraitMaxScaleFactor,
        child: GridView.custom({
          physics: constDateClampingScrollPhysics(ClampingScrollPhysics),
          gridDelegate: new _DayPickerGridDelegate(context),
          childrenDelegate: new SliverChildListDelegate(dayItems, { addRepaintBoundaries: false }),
        }),
      }),
    });
  }
}
export class _Day extends ScrollbarStatefulHost {
  readonly day: DateTime;
  readonly isDisabled: boolean;
  readonly isSelectedDay: boolean;
  readonly isToday: boolean;
  readonly onChanged: (argument0: DateTime) => void;
  readonly focusNode: FocusNode;
  readonly calendarDelegate: CalendarDelegate<DateTime>;
  constructor(
    day: DateTime,
    {
      key = null,
      isDisabled,
      isSelectedDay,
      isToday,
      onChanged,
      focusNode,
      calendarDelegate,
    }: {
      readonly key?: Key | null;
      readonly isDisabled: boolean;
      readonly isSelectedDay: boolean;
      readonly isToday: boolean;
      readonly onChanged: (argument0: DateTime) => void;
      readonly focusNode: FocusNode;
      readonly calendarDelegate: CalendarDelegate<DateTime>;
    },
  ) {
    const _initialField0 = day;
    const _initialField1 = isDisabled;
    const _initialField2 = isSelectedDay;
    const _initialField3 = isToday;
    const _initialField4 = onChanged;
    const _initialField5 = focusNode;
    const _initialField6 = calendarDelegate;
    super({ key: key });
    this.day = _initialField0;
    this.isDisabled = _initialField1;
    this.isSelectedDay = _initialField2;
    this.isToday = _initialField3;
    this.onChanged = _initialField4;
    this.focusNode = _initialField5;
    this.calendarDelegate = _initialField6;
    protect(this, [
      'day',
      'isDisabled',
      'isSelectedDay',
      'isToday',
      'onChanged',
      'focusNode',
      'calendarDelegate',
    ]);
  }
  override createState(): State<_Day> {
    return new _DayState();
  }
}
export class _DayState extends State<_Day> {
  readonly _dart_e3418b5381fd4ff8_statesController: WidgetStatesController;
  constructor() {
    const _initialField0 = new WidgetStatesController();
    super();
    this._dart_e3418b5381fd4ff8_statesController = _initialField0;
    protect(this, ['_dart_e3418b5381fd4ff8_statesController']);
  }
  override build(context: BuildContext): Widget {
    const defaults: DatePickerThemeData = DatePickerTheme.defaults(context);
    const datePickerTheme: DatePickerThemeData = DatePickerTheme.of(context);
    const dayStyle: TextStyle | null = datePickerTheme.dayStyle ?? defaults.dayStyle;
    const effectiveValue: <T extends {} | null>(
      _dartTemporary43: DartTypeWitness<T>,
      argument0: (argument0: DatePickerThemeData | null) => T | null,
    ) => T | null = <T extends {} | null>(
      _dartTemporary44: DartTypeWitness<T>,
      getProperty: (argument0: DatePickerThemeData | null) => T | null,
    ): T | null => {
      return getProperty(datePickerTheme) ?? getProperty(defaults);
    };
    const resolve: <T extends {} | null>(
      _dartTemporary45: DartTypeWitness<T>,
      argument0: (argument0: DatePickerThemeData | null) => WidgetStateProperty<T> | null,
      argument1: DartSet<WidgetState>,
    ) => T | null = <T extends {} | null>(
      _dartTemporary46: DartTypeWitness<T>,
      getProperty: (argument0: DatePickerThemeData | null) => WidgetStateProperty<T> | null,
      states: DartSet<WidgetState>,
    ): T | null => {
      return effectiveValue<T>(_dartTemporary46, (theme: DatePickerThemeData | null): T | null => {
        return getProperty(theme)?.resolve(states) ?? null;
      });
    };
    const localizations: MaterialLocalizations = MaterialLocalizations.of(context);
    const semanticLabelSuffix: string = this.widget.isToday
      ? `, ${localizations.currentDateLabel}`
      : '';
    const states: DartSet<WidgetState> = (() => {
      const _dartTemporary47 = emptyWidgetStateSet();
      if (this.widget.isDisabled) _dartTemporary47.add(WidgetState.disabled);
      if (this.widget.isSelectedDay) _dartTemporary47.add(WidgetState.selected);
      return _dartTemporary47;
    })();
    void (this._dart_e3418b5381fd4ff8_statesController.value = states);
    const dayForegroundColor: Color | null = resolve<Color | null>(
      nullableDartType<Color>(sourceColorType),
      (theme: DatePickerThemeData | null): WidgetStateProperty<Color | null> | null => {
        return this.widget.isToday
          ? (() => {
              const _dartTemporary48 = theme;
              return _dartTemporary48 === null ? null : _dartTemporary48.todayForegroundColor;
            })()
          : (() => {
              const _dartTemporary49 = theme;
              return _dartTemporary49 === null ? null : _dartTemporary49.dayForegroundColor;
            })();
      },
      states,
    );
    const dayBackgroundColor: Color | null = resolve<Color | null>(
      nullableDartType<Color>(sourceColorType),
      (theme: DatePickerThemeData | null): WidgetStateProperty<Color | null> | null => {
        return this.widget.isToday
          ? (() => {
              const _dartTemporary50 = theme;
              return _dartTemporary50 === null ? null : _dartTemporary50.todayBackgroundColor;
            })()
          : (() => {
              const _dartTemporary51 = theme;
              return _dartTemporary51 === null ? null : _dartTemporary51.dayBackgroundColor;
            })();
      },
      states,
    );
    const dayOverlayColor: WidgetStateProperty<Color | null> =
      WidgetStateProperty.resolveWith<Color | null>(
        nullableDartType<Color>(sourceColorType),
        (states: DartSet<WidgetState>): Color | null => {
          return effectiveValue<Color>(
            sourceColorType,
            (theme: DatePickerThemeData | null): Color | null => {
              return (
                (() => {
                  const _dartTemporary52 = theme;
                  return _dartTemporary52 === null ? null : _dartTemporary52.dayOverlayColor;
                })()?.resolve(states) ?? null
              );
            },
          );
        },
      );
    const dayShape: OutlinedBorder = (() => {
      const _dartTemporary54 = resolve<OutlinedBorder | null>(
        nullableDartType<OutlinedBorder>(sourceOutlinedBorderType),
        (theme: DatePickerThemeData | null): WidgetStateProperty<OutlinedBorder | null> | null => {
          return (() => {
            const _dartTemporary53 = theme;
            return _dartTemporary53 === null ? null : _dartTemporary53.dayShape;
          })();
        },
        states,
      );
      if (_dartTemporary54 === null)
        throw new TypeError('Null check operator used on a null value');
      return _dartTemporary54!;
    })();
    const hasCustomBorderColor: boolean =
      datePickerTheme.todayBorder !== null &&
      dateBorderSideColor(
        (() => {
          const _dartTemporary55 = datePickerTheme.todayBorder;
          if (_dartTemporary55 === null)
            throw new TypeError('Null check operator used on a null value');
          return _dartTemporary55!;
        })(),
      ).opacity !== 0;
    const todayBorderSide: BorderSide = hasCustomBorderColor
      ? (() => {
          const _dartTemporary56 = datePickerTheme.todayBorder;
          if (_dartTemporary56 === null)
            throw new TypeError('Null check operator used on a null value');
          return _dartTemporary56!;
        })()
      : dateBorderSideCopyWith(
          datePickerTheme.todayBorder ??
            (() => {
              const _dartTemporary57 = defaults.todayBorder;
              if (_dartTemporary57 === null)
                throw new TypeError('Null check operator used on a null value');
              return _dartTemporary57!;
            })(),
          { color: dayForegroundColor },
        );
    const decoration: ColorShapeDecoration = this.widget.isToday
      ? dateShapeDecoration({
          color: dayBackgroundColor,
          shape: dateOutlinedBorderCopyWith(dayShape, { side: todayBorderSide }),
        })
      : dateShapeDecoration({ color: dayBackgroundColor, shape: dayShape });
    let dayWidget: Widget = new Ink({
      decoration: decoration,
      child: dateCenter({
        child: dateText(localizations.formatDecimal(checkedInteger(this.widget.day.day)), {
          style: (() => {
            const _dartTemporary58 = dayStyle;
            return _dartTemporary58 === null
              ? null
              : dateTextStyleApply(_dartTemporary58, { color: dayForegroundColor });
          })(),
        }),
      }),
    });
    const orientation: Orientation = dateOrientationOf(context);
    if (
      SourceDateTheme.of(context).useMaterial3 &&
      scrollbarRawObjectEquals(orientation, 'portrait')
    ) {
      void (dayWidget = datePadding({
        padding: constDateEdgeInsetsAll(EdgeInsets, 4),
        child: dayWidget,
      }));
    }
    void (dayWidget = new Semantics({
      label: `${localizations.formatDecimal(checkedInteger(this.widget.day.day))}, ${this.widget.calendarDelegate.formatFullDate(this.widget.day, localizations)}${semanticLabelSuffix}`,
      button: true,
      selected: this.widget.isSelectedDay,
      enabled: !this.widget.isDisabled,
      excludeSemantics: true,
      child: dayWidget,
    }));
    if (!this.widget.isDisabled) {
      void (dayWidget = new InkResponse({
        focusNode: this.widget.focusNode,
        onTap: (): void => {
          void this.widget.onChanged(this.widget.day);
        },
        statesController: this._dart_e3418b5381fd4ff8_statesController,
        overlayColor: dayOverlayColor,
        customBorder: dayShape,
        containedInkWell: true,
        child: dayWidget,
      }));
    }
    return dayWidget;
  }
  override dispose(): void {
    void this._dart_e3418b5381fd4ff8_statesController.dispose();
    void super.dispose();
  }
}
export class _DayPickerGridDelegate extends SliverGridDelegate {
  readonly context: BuildContext;
  constructor(context: BuildContext) {
    const _initialField0 = context;
    super();
    this.context = _initialField0;
    protect(this, ['context']);
  }
  override getLayout(constraints: SliverConstraints): SliverGridLayout {
    /**
     * @dartType double
     * @dartTypeOrigin explicit
     */
    const textScaleFactor: number =
      MediaQuery.textScalerOf(this.context).clamp({ maxScaleFactor: 3 }).scale(_fontSizeToScale) /
      _fontSizeToScale;
    const orientation: Orientation = dateOrientationOf(this.context);
    /**
     * @dartType double
     * @dartTypeOrigin explicit
     */
    const dayPickerRowHeight: number =
      SourceDateTheme.of(this.context).useMaterial3 &&
      scrollbarRawObjectEquals(orientation, 'portrait')
        ? _dayPickerRowHeightM3
        : _dayPickerRowHeightM2;
    /**
     * @dartType double
     * @dartTypeOrigin explicit
     */
    const scaledRowHeight: number =
      textScaleFactor > 1.3 ? (textScaleFactor - 1) * 30 + dayPickerRowHeight : dayPickerRowHeight;
    /**
     * @dartType int
     * @dartTypeOrigin explicit
     */
    const columnCount: number = checkedInteger(DateTime.daysPerWeek);
    /**
     * @dartType double
     * @dartTypeOrigin explicit
     */
    const tileWidth: number = constraints.crossAxisExtent / checkedInteger(columnCount);
    /**
     * @dartType double
     * @dartTypeOrigin explicit
     */
    const tileHeight: number = castSourceDartDouble(
      minSourceDartNum(
        boxSourceDartDouble(scaledRowHeight),
        boxSourceDartDouble(
          constraints.viewportMainAxisExtent /
            checkedInteger(checkedInteger(checkedInteger(_maxDayPickerRowCount) + 1)),
        ),
      ),
    );
    return new SliverGridRegularTileLayout({
      childCrossAxisExtent: tileWidth,
      childMainAxisExtent: tileHeight,
      crossAxisCount: checkedInteger(columnCount),
      crossAxisStride: tileWidth,
      mainAxisStride: tileHeight,
      reverseCrossAxis: axisDirectionIsReversed(constraints.crossAxisDirection),
    });
  }
  override shouldRelayout(oldDelegate: _DayPickerGridDelegate): boolean {
    if (!(oldDelegate instanceof _DayPickerGridDelegate))
      throw new TypeError('Invalid covariant argument: oldDelegate');
    return false;
  }
}
export class YearPicker extends ScrollbarStatefulHost {
  readonly currentDate: DateTime;
  readonly firstDate: DateTime;
  readonly lastDate: DateTime;
  readonly selectedDate: DateTime | null;
  readonly onChanged: (argument0: DateTime) => void;
  readonly dragStartBehavior: DragStartBehavior;
  readonly calendarDelegate: CalendarDelegate<DateTime>;
  constructor({
    key = null,
    currentDate = null,
    firstDate,
    lastDate,
    initialDate = null,
    selectedDate,
    onChanged,
    dragStartBehavior = DragStartBehavior.start,
    calendarDelegate = constGregorianCalendarDelegate(),
  }: {
    readonly key?: Key | null;
    readonly currentDate?: DateTime | null;
    readonly firstDate: DateTime;
    readonly lastDate: DateTime;
    readonly initialDate?: DateTime | null;
    readonly selectedDate: DateTime | null;
    readonly onChanged: (argument0: DateTime) => void;
    readonly dragStartBehavior?: DragStartBehavior;
    readonly calendarDelegate?: CalendarDelegate<DateTime>;
  }) {
    const _initialField0 = firstDate;
    const _initialField1 = lastDate;
    const _initialField2 = selectedDate;
    const _initialField3 = onChanged;
    const _initialField4 = dragStartBehavior;
    const _initialField5 = calendarDelegate;
    if (FoundationBuildMode.debug)
      invariant(
        !firstDate.isAfter(lastDate),
        'generated-source-assert',
        'Pinned Dart assertion failed',
      );
    const _initialField6 = calendarDelegate.dateOnly(currentDate ?? DateTime.now());
    super({ key: key });
    this.currentDate = _initialField6;
    this.firstDate = _initialField0;
    this.lastDate = _initialField1;
    this.selectedDate = _initialField2;
    this.onChanged = _initialField3;
    this.dragStartBehavior = _initialField4;
    this.calendarDelegate = _initialField5;
    protect(this, [
      'currentDate',
      'firstDate',
      'lastDate',
      'selectedDate',
      'onChanged',
      'dragStartBehavior',
      'calendarDelegate',
    ]);
  }
  override createState(): State<YearPicker> {
    return new _YearPickerState();
  }
}
export class _YearPickerState extends State<YearPicker> {
  _dart_e3418b5381fd4ff8_scrollController: ScrollController | null;
  readonly _dart_e3418b5381fd4ff8_statesController: WidgetStatesController;
  /**
   * @dartType int
   * @dartTypeOrigin explicit
   */
  static readonly minYears: number = 18;
  constructor() {
    const _initialField0 = new WidgetStatesController();
    super();
    this._dart_e3418b5381fd4ff8_scrollController = null;
    this._dart_e3418b5381fd4ff8_statesController = _initialField0;
    protect(this, ['_dart_e3418b5381fd4ff8_statesController']);
  }
  override initState(): void {
    void super.initState();
    void (this._dart_e3418b5381fd4ff8_scrollController = new ScrollController({
      initialScrollOffset: this._dart_e3418b5381fd4ff8_scrollOffsetForYear(
        this.widget.selectedDate ?? this.widget.firstDate,
      ),
    }));
  }
  override dispose(): void {
    void (this._dart_e3418b5381fd4ff8_scrollController?.dispose() ?? null);
    void this._dart_e3418b5381fd4ff8_statesController.dispose();
    void super.dispose();
  }
  override didUpdateWidget(oldWidget: YearPicker): void {
    if (!(oldWidget instanceof YearPicker))
      throw new TypeError('Invalid covariant argument: oldWidget');
    void super.didUpdateWidget(oldWidget);
    if (
      !(() => {
        const _dartTemporary59 = this.widget.selectedDate;
        const _dartTemporary60 = oldWidget.selectedDate;
        return _dartTemporary59 === null || _dartTemporary60 === null
          ? _dartTemporary59 === _dartTemporary60
          : _dartTemporary59.equals(_dartTemporary60);
      })() &&
      this.widget.selectedDate !== null
    ) {
      void (() => {
        const _dartTemporary62 = this._dart_e3418b5381fd4ff8_scrollController;
        if (_dartTemporary62 === null)
          throw new TypeError('Null check operator used on a null value');
        return _dartTemporary62!;
      })().jumpTo(
        this._dart_e3418b5381fd4ff8_scrollOffsetForYear(
          (() => {
            const _dartTemporary61 = this.widget.selectedDate;
            if (_dartTemporary61 === null)
              throw new TypeError('Null check operator used on a null value');
            return _dartTemporary61!;
          })(),
        ),
      );
    }
  }
  /**
   * @dartReturn double
   * @dartReturnOrigin explicit
   */
  _dart_e3418b5381fd4ff8_scrollOffsetForYear(date: DateTime): number {
    /**
     * @dartType int
     * @dartTypeOrigin explicit
     */
    const initialYearIndex: number = checkedInteger(
      checkedInteger(date.year) - checkedInteger(this.widget.firstDate.year),
    );
    /**
     * @dartType int
     * @dartTypeOrigin explicit
     */
    const initialYearRow: number = checkedInteger(
      truncateDivide(checkedInteger(initialYearIndex), checkedInteger(_yearPickerColumnCount)),
    );
    /**
     * @dartType int
     * @dartTypeOrigin explicit
     */
    const centeredYearRow: number = checkedInteger(checkedInteger(initialYearRow) - 2);
    return checkedInteger(this._dart_e3418b5381fd4ff8_itemCount) <
      checkedInteger(_YearPickerState.minYears)
      ? 0
      : checkedInteger(centeredYearRow) * _yearPickerRowHeight;
  }
  /**
   * @dartParam index int
   * @dartParamOrigin index explicit
   */
  _dart_e3418b5381fd4ff8_buildYearItem(context: BuildContext, index: number): Widget {
    checkedInteger(index);
    const datePickerTheme: DatePickerThemeData = DatePickerTheme.of(context);
    const defaults: DatePickerThemeData = DatePickerTheme.defaults(context);
    const effectiveValue: <T extends {} | null>(
      _dartTemporary63: DartTypeWitness<T>,
      argument0: (argument0: DatePickerThemeData | null) => T | null,
    ) => T | null = <T extends {} | null>(
      _dartTemporary64: DartTypeWitness<T>,
      getProperty: (argument0: DatePickerThemeData | null) => T | null,
    ): T | null => {
      return getProperty(datePickerTheme) ?? getProperty(defaults);
    };
    const resolve: <T extends {} | null>(
      _dartTemporary65: DartTypeWitness<T>,
      argument0: (argument0: DatePickerThemeData | null) => WidgetStateProperty<T> | null,
      argument1: DartSet<WidgetState>,
    ) => T | null = <T extends {} | null>(
      _dartTemporary66: DartTypeWitness<T>,
      getProperty: (argument0: DatePickerThemeData | null) => WidgetStateProperty<T> | null,
      states: DartSet<WidgetState>,
    ): T | null => {
      return effectiveValue<T>(_dartTemporary66, (theme: DatePickerThemeData | null): T | null => {
        return getProperty(theme)?.resolve(states) ?? null;
      });
    };
    /**
     * @dartType double
     * @dartTypeOrigin explicit
     */
    const textScaleFactor: number =
      MediaQuery.textScalerOf(context).clamp({ maxScaleFactor: 3 }).scale(_fontSizeToScale) /
      _fontSizeToScale;
    /**
     * @dartType int
     * @dartTypeOrigin explicit
     */
    const offset: number = checkedInteger(
      checkedInteger(this._dart_e3418b5381fd4ff8_itemCount) <
        checkedInteger(_YearPickerState.minYears)
        ? checkedInteger(
            truncateDivide(
              checkedInteger(
                checkedInteger(
                  checkedInteger(_YearPickerState.minYears) -
                    checkedInteger(this._dart_e3418b5381fd4ff8_itemCount),
                ),
              ),
              2,
            ),
          )
        : 0,
    );
    /**
     * @dartType int
     * @dartTypeOrigin explicit
     */
    const year: number = checkedInteger(
      checkedInteger(checkedInteger(this.widget.firstDate.year) + checkedInteger(index)) -
        checkedInteger(offset),
    );
    const isSelected: boolean =
      checkedInteger(year) ===
      (() => {
        const _dartTemporary67 = this.widget.selectedDate;
        return _dartTemporary67 === null ? null : _dartTemporary67.year;
      })();
    const isCurrentYear: boolean =
      checkedInteger(year) === checkedInteger(this.widget.currentDate.year);
    const isDisabled: boolean =
      checkedInteger(year) < checkedInteger(this.widget.firstDate.year) ||
      checkedInteger(year) > checkedInteger(this.widget.lastDate.year);
    /**
     * @dartType double
     * @dartTypeOrigin explicit
     */
    const decorationHeight: number = 36 * textScaleFactor;
    /**
     * @dartType double
     * @dartTypeOrigin explicit
     */
    const decorationWidth: number = 72 * textScaleFactor;
    const states: DartSet<WidgetState> = (() => {
      const _dartTemporary68 = emptyWidgetStateSet();
      if (isDisabled) _dartTemporary68.add(WidgetState.disabled);
      if (isSelected) _dartTemporary68.add(WidgetState.selected);
      return _dartTemporary68;
    })();
    const textColor: Color | null = resolve<Color | null>(
      nullableDartType<Color>(sourceColorType),
      (theme: DatePickerThemeData | null): WidgetStateProperty<Color | null> | null => {
        return isCurrentYear
          ? (() => {
              const _dartTemporary69 = theme;
              return _dartTemporary69 === null ? null : _dartTemporary69.todayForegroundColor;
            })()
          : (() => {
              const _dartTemporary70 = theme;
              return _dartTemporary70 === null ? null : _dartTemporary70.yearForegroundColor;
            })();
      },
      states,
    );
    const background: Color | null = resolve<Color | null>(
      nullableDartType<Color>(sourceColorType),
      (theme: DatePickerThemeData | null): WidgetStateProperty<Color | null> | null => {
        return isCurrentYear
          ? (() => {
              const _dartTemporary71 = theme;
              return _dartTemporary71 === null ? null : _dartTemporary71.todayBackgroundColor;
            })()
          : (() => {
              const _dartTemporary72 = theme;
              return _dartTemporary72 === null ? null : _dartTemporary72.yearBackgroundColor;
            })();
      },
      states,
    );
    const overlayColor: WidgetStateProperty<Color | null> =
      WidgetStateProperty.resolveWith<Color | null>(
        nullableDartType<Color>(sourceColorType),
        (states: DartSet<WidgetState>): Color | null => {
          return effectiveValue<Color>(
            sourceColorType,
            (theme: DatePickerThemeData | null): Color | null => {
              return (
                (() => {
                  const _dartTemporary73 = theme;
                  return _dartTemporary73 === null ? null : _dartTemporary73.yearOverlayColor;
                })()?.resolve(states) ?? null
              );
            },
          );
        },
      );
    const yearShape: OutlinedBorder = (() => {
      const _dartTemporary75 = resolve<OutlinedBorder | null>(
        nullableDartType<OutlinedBorder>(sourceOutlinedBorderType),
        (theme: DatePickerThemeData | null): WidgetStateProperty<OutlinedBorder | null> | null => {
          return (() => {
            const _dartTemporary74 = theme;
            return _dartTemporary74 === null ? null : _dartTemporary74.yearShape;
          })();
        },
        states,
      );
      if (_dartTemporary75 === null)
        throw new TypeError('Null check operator used on a null value');
      return _dartTemporary75!;
    })();
    let borderSide: BorderSide | null = null;
    if (isCurrentYear) {
      void (borderSide = datePickerTheme.todayBorder ?? defaults.todayBorder);
      if (borderSide !== null) {
        void (borderSide = dateBorderSideCopyWith(borderSide as BorderSide, { color: textColor }));
      }
    }
    const decoration: ColorShapeDecoration = dateShapeDecoration({
      color: background,
      shape: dateOutlinedBorderCopyWith(yearShape, { side: borderSide }),
    });
    const itemStyle: TextStyle | null = (() => {
      const _dartTemporary76 = datePickerTheme.yearStyle ?? defaults.yearStyle;
      return _dartTemporary76 === null
        ? null
        : dateTextStyleApply(_dartTemporary76, { color: textColor });
    })();
    const localizations: MaterialLocalizations = MaterialLocalizations.of(context);
    let yearItem: Widget = dateCenter({
      child: new Container({
        decoration: decoration,
        height: decorationHeight,
        width: decorationWidth,
        alignment: Alignment.center,
        child: new Semantics({
          selected: isSelected,
          enabled: !isDisabled,
          button: true,
          child: dateText(
            this.widget.calendarDelegate.formatYear(checkedInteger(year), localizations),
            { style: itemStyle },
          ),
        }),
      }),
    });
    if (!isDisabled) {
      let date: DateTime = this.widget.calendarDelegate.getMonth(
        checkedInteger(year),
        checkedInteger(
          (() => {
            const _dartTemporary77 = this.widget.selectedDate;
            return _dartTemporary77 === null ? null : _dartTemporary77.month;
          })() ?? checkedInteger(DateTime.january),
        ),
      );
      if (
        date.isBefore(
          this.widget.calendarDelegate.getMonth(
            checkedInteger(this.widget.firstDate.year),
            checkedInteger(this.widget.firstDate.month),
          ),
        )
      ) {
        if (FoundationBuildMode.debug)
          invariant(
            checkedInteger(date.year) === checkedInteger(this.widget.firstDate.year),
            'generated-source-assert',
            'Pinned Dart assertion failed',
          );
        void (date = this.widget.calendarDelegate.getMonth(
          checkedInteger(year),
          checkedInteger(this.widget.firstDate.month),
        ));
      } else if (date.isAfter(this.widget.lastDate)) {
        if (FoundationBuildMode.debug)
          invariant(
            checkedInteger(date.year) === checkedInteger(this.widget.lastDate.year),
            'generated-source-assert',
            'Pinned Dart assertion failed',
          );
        void (date = this.widget.calendarDelegate.getMonth(
          checkedInteger(year),
          checkedInteger(this.widget.lastDate.month),
        ));
      }
      void (this._dart_e3418b5381fd4ff8_statesController.value = states);
      void (yearItem = new InkWell({
        key: dateYearKey(boxSourceDartInt(checkedInteger(year))),
        onTap: (): void => {
          void this.widget.onChanged(date);
        },
        statesController: this._dart_e3418b5381fd4ff8_statesController,
        overlayColor: overlayColor,
        child: yearItem,
      }));
    }
    return yearItem;
  }
  /**
   * @dartReturn int
   * @dartReturnOrigin explicit
   */
  get _dart_e3418b5381fd4ff8_itemCount(): number {
    return checkedInteger(
      checkedInteger(
        checkedInteger(this.widget.lastDate.year) - checkedInteger(this.widget.firstDate.year),
      ) + 1,
    );
  }
  override build(context: BuildContext): Widget {
    return dateColumn({
      children: [
        constDateDivider(Divider),
        dateExpanded({
          child: new Material({
            type: MaterialType.transparency,
            child: GridView.builder({
              controller: this._dart_e3418b5381fd4ff8_scrollController,
              dragStartBehavior: this.widget.dragStartBehavior,
              gridDelegate: new _YearPickerGridDelegate(context),
              itemBuilder: dartMethodTearOff(this, this._dart_e3418b5381fd4ff8_buildYearItem),
              itemCount: checkedInteger(
                castSourceDartInt(
                  maxSourceDartNum(
                    boxSourceDartInt(checkedInteger(this._dart_e3418b5381fd4ff8_itemCount)),
                    boxSourceDartInt(checkedInteger(_YearPickerState.minYears)),
                  ),
                ),
              ),
              padding: constDateEdgeInsetsSymmetric(EdgeInsets, { horizontal: _yearPickerPadding }),
            }),
          }),
        }),
        constDateDivider(Divider),
      ],
    });
  }
}
protect(_YearPickerState, ['minYears']);
export class _YearPickerGridDelegate extends SliverGridDelegate {
  readonly context: BuildContext;
  constructor(context: BuildContext) {
    const _initialField0 = context;
    super();
    this.context = _initialField0;
    protect(this, ['context']);
  }
  override getLayout(constraints: SliverConstraints): SliverGridLayout {
    /**
     * @dartType double
     * @dartTypeOrigin explicit
     */
    const textScaleFactor: number =
      MediaQuery.textScalerOf(this.context).clamp({ maxScaleFactor: 3 }).scale(_fontSizeToScale) /
      _fontSizeToScale;
    /**
     * @dartType int
     * @dartTypeOrigin explicit
     */
    const scaledYearPickerColumnCount: number = checkedInteger(
      textScaleFactor > 1.65
        ? checkedInteger(checkedInteger(_yearPickerColumnCount) - 1)
        : checkedInteger(_yearPickerColumnCount),
    );
    /**
     * @dartType double
     * @dartTypeOrigin explicit
     */
    const tileWidth: number = castSourceDartDouble(
      maxSourceDartNum(
        boxSourceDartDouble(
          (constraints.crossAxisExtent -
            checkedInteger(checkedInteger(checkedInteger(scaledYearPickerColumnCount) - 1)) *
              _yearPickerRowSpacing) /
            checkedInteger(scaledYearPickerColumnCount),
        ),
        boxSourceDartDouble(0),
      ),
    );
    /**
     * @dartType double
     * @dartTypeOrigin explicit
     */
    const scaledYearPickerRowHeight: number =
      textScaleFactor > 1 ? _yearPickerRowHeight + (textScaleFactor - 1) * 9 : _yearPickerRowHeight;
    return new SliverGridRegularTileLayout({
      childCrossAxisExtent: tileWidth,
      childMainAxisExtent: scaledYearPickerRowHeight,
      crossAxisCount: checkedInteger(scaledYearPickerColumnCount),
      crossAxisStride: tileWidth + _yearPickerRowSpacing,
      mainAxisStride: scaledYearPickerRowHeight,
      reverseCrossAxis: axisDirectionIsReversed(constraints.crossAxisDirection),
    });
  }
  override shouldRelayout(oldDelegate: _YearPickerGridDelegate): boolean {
    if (!(oldDelegate instanceof _YearPickerGridDelegate))
      throw new TypeError('Invalid covariant argument: oldDelegate');
    return false;
  }
}
export function _reportAnnouncementError(exception: {}, stack: SourceStackTrace): void {
  void FlutterError.reportError(
    new FlutterErrorDetails({
      exception: exception,
      stack: stack,
      library: 'material library',
      context: new ErrorDescription('while sending semantics announcement'),
    }),
  );
}

// Exact generated owners for inherited lookup and native regular-grid parameters.
import { registerDateFocusedType } from '../../internal/date/source-host.ts';
import { registerNativeRegularGridDelegate } from '@nelyx/core/internal/framework/rendering/native-grid';
registerDateFocusedType(_FocusedDate);
// Exact lowering of _DayPickerGridDelegate.getLayout above. Context controls
// numeric policy; actual viewport dimensions and tile placement stay in Core.
registerNativeRegularGridDelegate(_DayPickerGridDelegate.prototype, (delegate) => {
  const textScaleFactor =
    MediaQuery.textScalerOf(delegate.context).clamp({ maxScaleFactor: 3 }).scale(_fontSizeToScale) /
    _fontSizeToScale;
  const rowHeight =
    SourceDateTheme.of(delegate.context).useMaterial3 &&
    scrollbarRawObjectEquals(dateOrientationOf(delegate.context), 'portrait')
      ? _dayPickerRowHeightM3
      : _dayPickerRowHeightM2;
  return {
    columns: DateTime.daysPerWeek,
    rows: _maxDayPickerRowCount + 1,
    maximumRowExtent: textScaleFactor > 1.3 ? (textScaleFactor - 1) * 30 + rowHeight : rowHeight,
  };
});
registerNativeRegularGridDelegate(_YearPickerGridDelegate.prototype);
