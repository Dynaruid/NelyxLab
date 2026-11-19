// W11 Flutter design source c6fcb2a7e9eba48c293f35841f5569ac4ee8d3f1852314b4b3cef33be4e5be96 SHA256 0ff4c47414e801b604cf6e0965351a8488c5b571c8436917ad398f3e5a92b840
// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Generated from packages/flutter/lib/src/material/time_picker.dart; SHA256 bf9998e0b8280e6448774c41a95910c9233b910f396aa010f02928431f65d9d8
const _dartTemporary0 = Symbol();
export class _HourMinuteMode {
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
    static readonly hour: _HourMinuteMode = new _HourMinuteMode(0, "hour", _dartTemporary0);
    static readonly minute: _HourMinuteMode = new _HourMinuteMode(1, "minute", _dartTemporary0);
    static readonly values: ReadonlyArray<_HourMinuteMode> = Object.freeze([_HourMinuteMode.hour, _HourMinuteMode.minute]);
    toString(): string {
        return "_HourMinuteMode." + this.name;
    }
}
Object.freeze(_HourMinuteMode.prototype);
Object.freeze(_HourMinuteMode);
