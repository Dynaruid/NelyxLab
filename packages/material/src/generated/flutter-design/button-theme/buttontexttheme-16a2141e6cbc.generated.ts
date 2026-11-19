// W11 Flutter design source 16a2141e6cbcd965a0e03d9e5b7721c74a845ff827a1ea92a711e7e0788d5408 SHA256 bcd1ef950ee15aef66b22fa0e109419a0797b3c5c7d636c9dd2acd90c7cafbee
// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Generated from packages/flutter/lib/src/material/button_theme.dart; SHA256 45369ff898200c1d9c9b7442c3579975c74772eaeb1b87a897adb9fda534fecd
const _dartTemporary0 = Symbol();
export class ButtonTextTheme {
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
    static readonly normal: ButtonTextTheme = new ButtonTextTheme(0, "normal", _dartTemporary0);
    static readonly accent: ButtonTextTheme = new ButtonTextTheme(1, "accent", _dartTemporary0);
    static readonly primary: ButtonTextTheme = new ButtonTextTheme(2, "primary", _dartTemporary0);
    static readonly values: ReadonlyArray<ButtonTextTheme> = Object.freeze([ButtonTextTheme.normal, ButtonTextTheme.accent, ButtonTextTheme.primary]);
    toString(): string {
        return "ButtonTextTheme." + this.name;
    }
}
Object.freeze(ButtonTextTheme.prototype);
Object.freeze(ButtonTextTheme);
