// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Generated from packages/flutter/lib/src/material/input_date_picker_form_field.dart; SHA256 821a15e00045eea9dfc929a02f7e0428914d02434e9e154b355185b03a711f74
import { protect } from '@nelyx/core/internal/ui/value-math';
import { checkedInteger } from '@nelyx/core/internal/ui/value-math';
import { invariant } from '@nelyx/core/foundation/errors';
import { FoundationBuildMode } from '@nelyx/core/foundation/constants';
import { dartMethodTearOff } from '@nelyx/core/internal/foundation/dart-method-tear-off';
import { State } from '@nelyx/core/framework/widgets/framework';
import { Widget } from '@nelyx/core/framework/widgets/framework';
import { Key } from '@nelyx/core/foundation/key';
import { ScrollbarStatefulHost } from '@nelyx/core/internal/framework/widgets/scrollbar-raw-source-adapter';
import { scrollbarPostFrame } from '@nelyx/core/internal/framework/widgets/scrollbar-raw-source-adapter';
import { MaterialLocalizations } from '../../material-localizations.ts';
import { TextInputType } from '../../internal/date/source-input.ts';
import { FocusNode } from '@nelyx/core/framework/widgets/focus';
import { dartValueString } from '@nelyx/core/internal/foundation/dart-value';
import { constGregorianCalendarDelegate } from '../../internal/date/source-host.ts';
import { CalendarDelegate } from './date.generated.ts';
import { DateTime } from '../../internal/date/date-time.ts';
import { Semantics } from '@nelyx/core/framework/widgets/semantics';
import { DatePickerThemeData } from '../../date-picker-theme-data.ts';
import { TextEditingValue } from '@nelyx/core/services/text-input';
import { TextSelection } from '@nelyx/core/services/text-editing';
import { InputDecorationThemeData } from '../../input-decoration-theme-data.ts';
import { InputDecorationTheme } from '../../input-decoration-theme.ts';
import { InputBorder } from '../../input-border.ts';
import { OutlineInputBorder } from '../../input-border.ts';
import { UnderlineInputBorder } from '../../input-border.ts';
import { constDateOutlineInputBorder } from '../../internal/date/source-host.ts';
import { constDateUnderlineInputBorder } from '../../internal/date/source-host.ts';
import { SourceDateThemeData } from '../../internal/date/source-theme.ts';
import { SourceDateTheme } from '../../internal/date/source-theme.ts';
import { InputDecoration } from '../../input-decoration.ts';
import { SourceDateEditingController } from '../../internal/date/source-input.ts';
import { dateTextFormField } from '../../internal/date/source-input.ts';
import { dateStringIsEmpty } from '../../internal/date/source-values.ts';
import type { BuildContext } from '@nelyx/core/framework/widgets/framework';
export class InputDatePickerFormField extends ScrollbarStatefulHost {
  readonly initialDate: DateTime | null;
  readonly firstDate: DateTime;
  readonly lastDate: DateTime;
  readonly onDateSubmitted: ((_argument0: DateTime) => void) | null;
  readonly onDateSaved: ((_argument0: DateTime) => void) | null;
  readonly selectableDayPredicate: ((_argument0: DateTime) => boolean) | null;
  readonly errorFormatText: string | null;
  readonly errorInvalidText: string | null;
  readonly fieldHintText: string | null;
  readonly fieldLabelText: string | null;
  readonly keyboardType: TextInputType | null;
  readonly autofocus: boolean;
  readonly acceptEmptyDate: boolean;
  readonly focusNode: FocusNode | null;
  readonly calendarDelegate: CalendarDelegate<DateTime>;
  constructor({
    key = null,
    initialDate = null,
    firstDate,
    lastDate,
    onDateSubmitted = null,
    onDateSaved = null,
    selectableDayPredicate = null,
    errorFormatText = null,
    errorInvalidText = null,
    fieldHintText = null,
    fieldLabelText = null,
    keyboardType = null,
    autofocus = false,
    acceptEmptyDate = false,
    focusNode = null,
    calendarDelegate = constGregorianCalendarDelegate(),
  }: {
    readonly key?: Key | null;
    readonly initialDate?: DateTime | null;
    readonly firstDate: DateTime;
    readonly lastDate: DateTime;
    readonly onDateSubmitted?: ((_argument0: DateTime) => void) | null;
    readonly onDateSaved?: ((_argument0: DateTime) => void) | null;
    readonly selectableDayPredicate?: ((_argument0: DateTime) => boolean) | null;
    readonly errorFormatText?: string | null;
    readonly errorInvalidText?: string | null;
    readonly fieldHintText?: string | null;
    readonly fieldLabelText?: string | null;
    readonly keyboardType?: TextInputType | null;
    readonly autofocus?: boolean;
    readonly acceptEmptyDate?: boolean;
    readonly focusNode?: FocusNode | null;
    readonly calendarDelegate?: CalendarDelegate<DateTime>;
  }) {
    const _initialField0 = onDateSubmitted;
    const _initialField1 = onDateSaved;
    const _initialField2 = selectableDayPredicate;
    const _initialField3 = errorFormatText;
    const _initialField4 = errorInvalidText;
    const _initialField5 = fieldHintText;
    const _initialField6 = fieldLabelText;
    const _initialField7 = keyboardType;
    const _initialField8 = autofocus;
    const _initialField9 = acceptEmptyDate;
    const _initialField10 = focusNode;
    const _initialField11 = calendarDelegate;
    const _initialField12 =
      initialDate !== null ? calendarDelegate.dateOnly(initialDate as DateTime) : null;
    const _initialField13 = calendarDelegate.dateOnly(firstDate);
    const _initialField14 = calendarDelegate.dateOnly(lastDate);
    super({ key: key });
    this.initialDate = _initialField12;
    this.firstDate = _initialField13;
    this.lastDate = _initialField14;
    this.onDateSubmitted = _initialField0;
    this.onDateSaved = _initialField1;
    this.selectableDayPredicate = _initialField2;
    this.errorFormatText = _initialField3;
    this.errorInvalidText = _initialField4;
    this.fieldHintText = _initialField5;
    this.fieldLabelText = _initialField6;
    this.keyboardType = _initialField7;
    this.autofocus = _initialField8;
    this.acceptEmptyDate = _initialField9;
    this.focusNode = _initialField10;
    this.calendarDelegate = _initialField11;
    protect(this, [
      'initialDate',
      'firstDate',
      'lastDate',
      'onDateSubmitted',
      'onDateSaved',
      'selectableDayPredicate',
      'errorFormatText',
      'errorInvalidText',
      'fieldHintText',
      'fieldLabelText',
      'keyboardType',
      'autofocus',
      'acceptEmptyDate',
      'focusNode',
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
        })()} must satisfy provided selectableDayPredicate.`,
      );
  }
  override createState(): State<InputDatePickerFormField> {
    return new _InputDatePickerFormFieldState();
  }
}
export class _InputDatePickerFormFieldState extends State<InputDatePickerFormField> {
  readonly _dart_08de5281b9ede809_controller: SourceDateEditingController;
  _dart_08de5281b9ede809_selectedDate: DateTime | null;
  _dart_08de5281b9ede809_inputText: string | null;
  _dart_08de5281b9ede809_autoSelected: boolean;
  constructor() {
    const _initialField0 = new SourceDateEditingController({});
    const _initialField1 = false;
    super();
    this._dart_08de5281b9ede809_controller = _initialField0;
    this._dart_08de5281b9ede809_selectedDate = null;
    this._dart_08de5281b9ede809_inputText = null;
    this._dart_08de5281b9ede809_autoSelected = _initialField1;
    protect(this, ['_dart_08de5281b9ede809_controller']);
  }
  override initState(): void {
    void super.initState();
    void (this._dart_08de5281b9ede809_selectedDate = this.widget.initialDate);
  }
  override dispose(): void {
    void this._dart_08de5281b9ede809_controller.dispose();
    void super.dispose();
  }
  override didChangeDependencies(): void {
    void super.didChangeDependencies();
    void this._dart_08de5281b9ede809_updateValueForSelectedDate();
  }
  override didUpdateWidget(oldWidget: InputDatePickerFormField): void {
    if (!(oldWidget instanceof InputDatePickerFormField))
      throw new TypeError('Invalid covariant argument: oldWidget');
    void super.didUpdateWidget(oldWidget);
    if (
      !(() => {
        const _dartTemporary7 = this.widget.initialDate;
        const _dartTemporary8 = oldWidget.initialDate;
        return _dartTemporary7 === null || _dartTemporary8 === null
          ? _dartTemporary7 === _dartTemporary8
          : _dartTemporary7.equals(_dartTemporary8);
      })()
    ) {
      void scrollbarPostFrame(
        this,
        (_timeStamp: number): void => {
          void this.setState((): void => {
            void (this._dart_08de5281b9ede809_selectedDate = this.widget.initialDate);
            void this._dart_08de5281b9ede809_updateValueForSelectedDate();
          });
        },
        { debugLabel: 'InputDatePickerFormField.update' },
      );
    }
  }
  _dart_08de5281b9ede809_updateValueForSelectedDate(): void {
    if (this._dart_08de5281b9ede809_selectedDate !== null) {
      const localizations: MaterialLocalizations = MaterialLocalizations.of(this.context);
      void (this._dart_08de5281b9ede809_inputText = this.widget.calendarDelegate.formatCompactDate(
        (() => {
          const _dartTemporary9 = this._dart_08de5281b9ede809_selectedDate;
          if (_dartTemporary9 === null)
            throw new TypeError('Null check operator used on a null value');
          return _dartTemporary9!;
        })(),
        localizations,
      ));
      let textEditingValue: TextEditingValue = new TextEditingValue({
        text: (() => {
          const _dartTemporary10 = this._dart_08de5281b9ede809_inputText;
          if (_dartTemporary10 === null)
            throw new TypeError('Null check operator used on a null value');
          return _dartTemporary10!;
        })(),
      });
      if (this.widget.autofocus && !this._dart_08de5281b9ede809_autoSelected) {
        void (textEditingValue = textEditingValue.copyWith({
          selection: new TextSelection({
            baseOffset: 0,
            extentOffset: checkedInteger(
              (() => {
                const _dartTemporary11 = this._dart_08de5281b9ede809_inputText;
                if (_dartTemporary11 === null)
                  throw new TypeError('Null check operator used on a null value');
                return _dartTemporary11!;
              })().length,
            ),
          }),
        }));
        void (this._dart_08de5281b9ede809_autoSelected = true);
      }
      void (this._dart_08de5281b9ede809_controller.value = textEditingValue);
    } else {
      void (this._dart_08de5281b9ede809_inputText = '');
      void (this._dart_08de5281b9ede809_controller.value = new TextEditingValue({
        text: (() => {
          const _dartTemporary12 = this._dart_08de5281b9ede809_inputText;
          if (_dartTemporary12 === null)
            throw new TypeError('Null check operator used on a null value');
          return _dartTemporary12!;
        })(),
      }));
    }
  }
  _dart_08de5281b9ede809_parseDate(text: string | null): DateTime | null {
    const localizations: MaterialLocalizations = MaterialLocalizations.of(this.context);
    return this.widget.calendarDelegate.parseCompactDate(text, localizations);
  }
  _dart_08de5281b9ede809_isValidAcceptableDate(date: DateTime | null): boolean {
    return (
      date !== null &&
      !(date as DateTime).isBefore(this.widget.firstDate) &&
      !(date as DateTime).isAfter(this.widget.lastDate) &&
      (this.widget.selectableDayPredicate === null ||
        (() => {
          const _dartTemporary13 = this.widget.selectableDayPredicate;
          if (_dartTemporary13 === null)
            throw new TypeError('Null check operator used on a null value');
          return _dartTemporary13!;
        })()(date as DateTime))
    );
  }
  _dart_08de5281b9ede809_validateDate(text: string | null): string | null {
    if ((text === null || dateStringIsEmpty(text as string)) && this.widget.acceptEmptyDate) {
      return null;
    }
    const date: DateTime | null = this._dart_08de5281b9ede809_parseDate(text);
    if (date === null) {
      return (
        this.widget.errorFormatText ?? MaterialLocalizations.of(this.context).invalidDateFormatLabel
      );
    } else if (!this._dart_08de5281b9ede809_isValidAcceptableDate(date as DateTime)) {
      return (
        this.widget.errorInvalidText ?? MaterialLocalizations.of(this.context).dateOutOfRangeLabel
      );
    }
    return null;
  }
  _dart_08de5281b9ede809_updateDate(
    text: string | null,
    callback: ((_argument0: DateTime) => void) | null,
  ): void {
    const date: DateTime | null = this._dart_08de5281b9ede809_parseDate(text);
    if (this._dart_08de5281b9ede809_isValidAcceptableDate(date)) {
      void (this._dart_08de5281b9ede809_selectedDate = date);
      void (this._dart_08de5281b9ede809_inputText = text);
      void (() => {
        const _dartTemporary14 = callback;
        if (_dartTemporary14 === null) return null;
        return _dartTemporary14!(
          (() => {
            const _dartTemporary15 = this._dart_08de5281b9ede809_selectedDate;
            if (_dartTemporary15 === null)
              throw new TypeError('Null check operator used on a null value');
            return _dartTemporary15!;
          })(),
        );
      })();
    }
  }
  _dart_08de5281b9ede809_handleSaved(text: string | null): void {
    void this._dart_08de5281b9ede809_updateDate(text, this.widget.onDateSaved);
  }
  _dart_08de5281b9ede809_handleSubmitted(text: string): void {
    void this._dart_08de5281b9ede809_updateDate(text, this.widget.onDateSubmitted);
  }
  override build(context: BuildContext): Widget {
    const theme: SourceDateThemeData = SourceDateTheme.of(context);
    const useMaterial3: boolean = theme.useMaterial3;
    const localizations: MaterialLocalizations = MaterialLocalizations.of(context);
    const datePickerTheme: DatePickerThemeData = theme.datePickerTheme;
    const inputTheme: InputDecorationThemeData = InputDecorationTheme.of(context);
    const effectiveInputBorder: InputBorder =
      (() => {
        const _dartTemporary16 = datePickerTheme.inputDecorationTheme;
        return _dartTemporary16 === null ? null : _dartTemporary16.border;
      })() ??
      inputTheme.border ??
      (useMaterial3
        ? constDateOutlineInputBorder(OutlineInputBorder)
        : constDateUnderlineInputBorder(UnderlineInputBorder));
    return new Semantics({
      container: true,
      child: dateTextFormField({
        decoration: new InputDecoration({
          hintText:
            this.widget.fieldHintText ?? this.widget.calendarDelegate.dateHelpText(localizations),
          labelText: this.widget.fieldLabelText ?? localizations.dateInputLabel,
        }).applyDefaults(
          inputTheme
            .merge(datePickerTheme.inputDecorationTheme)
            .copyWith({ border: effectiveInputBorder }),
        ),
        validator: dartMethodTearOff(this, this._dart_08de5281b9ede809_validateDate),
        keyboardType: this.widget.keyboardType ?? TextInputType.datetime,
        onSaved: dartMethodTearOff(this, this._dart_08de5281b9ede809_handleSaved),
        onFieldSubmitted: dartMethodTearOff(this, this._dart_08de5281b9ede809_handleSubmitted),
        autofocus: this.widget.autofocus,
        controller: this._dart_08de5281b9ede809_controller,
        focusNode: this.widget.focusNode,
      }),
    });
  }
}
