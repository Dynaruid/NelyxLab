// W11 Flutter design source a5f4e676e3360e3457859d0a1999d56fbc53cd65c237d81e5d75a5c17867ccf2 SHA256 62198a0443802dab1c5c2737ee1e96aba2d3b3395ade6c9761f1f51909a29096
// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Generated from packages/flutter/lib/src/material/date_picker.dart; SHA256 6d41d7d137cd63a73b0e9eeb2888d51e217c212b49152b4a32795bd630392285
const _dartTemporary0 = Symbol();
export class _HighlightPainterStyle {
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
    static readonly none: _HighlightPainterStyle = new _HighlightPainterStyle(0, "none", _dartTemporary0);
    static readonly highlightLeading: _HighlightPainterStyle = new _HighlightPainterStyle(1, "highlightLeading", _dartTemporary0);
    static readonly highlightTrailing: _HighlightPainterStyle = new _HighlightPainterStyle(2, "highlightTrailing", _dartTemporary0);
    static readonly highlightAll: _HighlightPainterStyle = new _HighlightPainterStyle(3, "highlightAll", _dartTemporary0);
    static readonly values: ReadonlyArray<_HighlightPainterStyle> = Object.freeze([_HighlightPainterStyle.none, _HighlightPainterStyle.highlightLeading, _HighlightPainterStyle.highlightTrailing, _HighlightPainterStyle.highlightAll]);
    toString(): string {
        return "_HighlightPainterStyle." + this.name;
    }
}
Object.freeze(_HighlightPainterStyle.prototype);
Object.freeze(_HighlightPainterStyle);
