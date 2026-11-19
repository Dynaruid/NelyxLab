// W11 Flutter design source a349ae72d318f0a81b385dcad35ddc85c81db09587acc99126311aad6af1e137 SHA256 2d4515da76928a84b4d6135e625bbc6dfbedaa6e64c0e73153b97fbb1e4477d9
// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Generated from packages/flutter/lib/src/cupertino/text_field.dart; SHA256 3f44c7ae31857e1f32013d16fd22c094dd8d0dd2a86f997ca62cf03395b38298
const _dartTemporary0 = Symbol();
export class _BaselineAlignedStackSlot {
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
    static readonly placeholder: _BaselineAlignedStackSlot = new _BaselineAlignedStackSlot(0, "placeholder", _dartTemporary0);
    static readonly editableText: _BaselineAlignedStackSlot = new _BaselineAlignedStackSlot(1, "editableText", _dartTemporary0);
    static readonly values: ReadonlyArray<_BaselineAlignedStackSlot> = Object.freeze([_BaselineAlignedStackSlot.placeholder, _BaselineAlignedStackSlot.editableText]);
    toString(): string {
        return "_BaselineAlignedStackSlot." + this.name;
    }
}
Object.freeze(_BaselineAlignedStackSlot.prototype);
Object.freeze(_BaselineAlignedStackSlot);
