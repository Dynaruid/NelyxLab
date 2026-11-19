// W11 Flutter design source 4a3cdb4065cb17492519a773aec70c7fe337f1431bc4680b3af9685a618163f4 SHA256 1828dc4b70aeb280125cece960da13e4e147ad4f406f0e3722de1f68178a950f
// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Generated from packages/flutter/lib/src/material/ink_well.dart; SHA256 a7c7d6b41b783b7af72653d38e34da87557b8021faf92379252af40d0908374e
const _dartTemporary0 = Symbol();
export class _HighlightType {
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
    static readonly pressed: _HighlightType = new _HighlightType(0, "pressed", _dartTemporary0);
    static readonly hover: _HighlightType = new _HighlightType(1, "hover", _dartTemporary0);
    static readonly focus: _HighlightType = new _HighlightType(2, "focus", _dartTemporary0);
    static readonly values: ReadonlyArray<_HighlightType> = Object.freeze([_HighlightType.pressed, _HighlightType.hover, _HighlightType.focus]);
    toString(): string {
        return "_HighlightType." + this.name;
    }
}
Object.freeze(_HighlightType.prototype);
Object.freeze(_HighlightType);
