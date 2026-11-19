// W11 Flutter design source 478988a0382f5be4ef679275a3f679e6ee317f92af7f43729dcf991b69e15691 SHA256 68fdab032bba5824ce5a5c749f4e82a72c9d4df80ad241ddd07a8f6dd2525ed4
// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Generated from packages/flutter/lib/src/material/button_theme.dart; SHA256 45369ff898200c1d9c9b7442c3579975c74772eaeb1b87a897adb9fda534fecd
const _dartTemporary0 = Symbol();
export class ButtonBarLayoutBehavior {
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
    static readonly constrained: ButtonBarLayoutBehavior = new ButtonBarLayoutBehavior(0, "constrained", _dartTemporary0);
    static readonly padded: ButtonBarLayoutBehavior = new ButtonBarLayoutBehavior(1, "padded", _dartTemporary0);
    static readonly values: ReadonlyArray<ButtonBarLayoutBehavior> = Object.freeze([ButtonBarLayoutBehavior.constrained, ButtonBarLayoutBehavior.padded]);
    toString(): string {
        return "ButtonBarLayoutBehavior." + this.name;
    }
}
Object.freeze(ButtonBarLayoutBehavior.prototype);
Object.freeze(ButtonBarLayoutBehavior);
