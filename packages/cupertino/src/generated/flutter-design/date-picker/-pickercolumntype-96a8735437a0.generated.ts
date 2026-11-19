// W11 Flutter design source 96a8735437a06dbfb190da1db94cc6d8fe22aff4097be5a09176091265807eb0 SHA256 d5dca70c0a6ab9561c0718845422cd4a3d1b79524cbd30f3364012de85fbefee
// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Generated from packages/flutter/lib/src/cupertino/date_picker.dart; SHA256 6b143692dcbece382c161f08630e0774c7d4a8abba3ef71cc4a7fdfe4e17f1eb
const _dartTemporary0 = Symbol();
export class _PickerColumnType {
    /**
     * @dartType int
     * @dartTypeOrigin explicit
     */
    readonly index: number;
    private readonly _dartTemporary1!: void;
    /**
     * @dartParam index int
     * @dartParamOrigin index explicit
     */
    private constructor(index: number, readonly name: string, token: typeof _dartTemporary0) {
        if (token !== _dartTemporary0)
            throw new TypeError("Enum values cannot be constructed");
        this.index = index;
        Object.freeze(this);
    }
    static readonly dayOfMonth: _PickerColumnType = new _PickerColumnType(0, "dayOfMonth", _dartTemporary0);
    static readonly month: _PickerColumnType = new _PickerColumnType(1, "month", _dartTemporary0);
    static readonly year: _PickerColumnType = new _PickerColumnType(2, "year", _dartTemporary0);
    static readonly date: _PickerColumnType = new _PickerColumnType(3, "date", _dartTemporary0);
    static readonly hour: _PickerColumnType = new _PickerColumnType(4, "hour", _dartTemporary0);
    static readonly minute: _PickerColumnType = new _PickerColumnType(5, "minute", _dartTemporary0);
    static readonly dayPeriod: _PickerColumnType = new _PickerColumnType(6, "dayPeriod", _dartTemporary0);
    static readonly timeSeparator: _PickerColumnType = new _PickerColumnType(7, "timeSeparator", _dartTemporary0);
    static readonly values: ReadonlyArray<_PickerColumnType> = Object.freeze([_PickerColumnType.dayOfMonth, _PickerColumnType.month, _PickerColumnType.year, _PickerColumnType.date, _PickerColumnType.hour, _PickerColumnType.minute, _PickerColumnType.dayPeriod, _PickerColumnType.timeSeparator]);
    toString(): string {
        return "_PickerColumnType." + this.name;
    }
}
Object.freeze(_PickerColumnType.prototype);
Object.freeze(_PickerColumnType);
