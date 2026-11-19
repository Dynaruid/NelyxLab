// W11 Flutter design source e38df5e1fb967c3d8129925a7b1d4fffbebfba6e90a5defa87737e7f91bdee1c SHA256 e7860c3e81cebd624d76b7ba1dca59af99e7c7ec74d6f2cc2021e158b4b8f238
// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Generated from packages/flutter/lib/src/material/time_picker.dart; SHA256 bf9998e0b8280e6448774c41a95910c9233b910f396aa010f02928431f65d9d8
const _dartTemporary0 = Symbol();
export class _TimePickerAspect {
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
    static readonly use24HourFormat: _TimePickerAspect = new _TimePickerAspect(0, "use24HourFormat", _dartTemporary0);
    static readonly useMaterial3: _TimePickerAspect = new _TimePickerAspect(1, "useMaterial3", _dartTemporary0);
    static readonly entryMode: _TimePickerAspect = new _TimePickerAspect(2, "entryMode", _dartTemporary0);
    static readonly hourMinuteMode: _TimePickerAspect = new _TimePickerAspect(3, "hourMinuteMode", _dartTemporary0);
    static readonly onHourMinuteModeChanged: _TimePickerAspect = new _TimePickerAspect(4, "onHourMinuteModeChanged", _dartTemporary0);
    static readonly onHourDoubleTapped: _TimePickerAspect = new _TimePickerAspect(5, "onHourDoubleTapped", _dartTemporary0);
    static readonly onMinuteDoubleTapped: _TimePickerAspect = new _TimePickerAspect(6, "onMinuteDoubleTapped", _dartTemporary0);
    static readonly hourDialType: _TimePickerAspect = new _TimePickerAspect(7, "hourDialType", _dartTemporary0);
    static readonly selectedTime: _TimePickerAspect = new _TimePickerAspect(8, "selectedTime", _dartTemporary0);
    static readonly onSelectedTimeChanged: _TimePickerAspect = new _TimePickerAspect(9, "onSelectedTimeChanged", _dartTemporary0);
    static readonly orientation: _TimePickerAspect = new _TimePickerAspect(10, "orientation", _dartTemporary0);
    static readonly theme: _TimePickerAspect = new _TimePickerAspect(11, "theme", _dartTemporary0);
    static readonly defaultTheme: _TimePickerAspect = new _TimePickerAspect(12, "defaultTheme", _dartTemporary0);
    static readonly values: ReadonlyArray<_TimePickerAspect> = Object.freeze([_TimePickerAspect.use24HourFormat, _TimePickerAspect.useMaterial3, _TimePickerAspect.entryMode, _TimePickerAspect.hourMinuteMode, _TimePickerAspect.onHourMinuteModeChanged, _TimePickerAspect.onHourDoubleTapped, _TimePickerAspect.onMinuteDoubleTapped, _TimePickerAspect.hourDialType, _TimePickerAspect.selectedTime, _TimePickerAspect.onSelectedTimeChanged, _TimePickerAspect.orientation, _TimePickerAspect.theme, _TimePickerAspect.defaultTheme]);
    toString(): string {
        return "_TimePickerAspect." + this.name;
    }
}
Object.freeze(_TimePickerAspect.prototype);
Object.freeze(_TimePickerAspect);
