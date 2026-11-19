// W11 Flutter design source fa6dc6be1fbbd796203878e49e8c4bea799cfc3fc4a2e65358bd6b4ba380abde SHA256 65c55e15154c8f1af6d47f181e896d2256d799e2eef7324bbed6fe6b61106c74
// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Generated from packages/flutter/lib/src/material/text_selection_toolbar_text_button.dart; SHA256 859456bb503c9830822352a5df32e28b81ecb9b32f64776302177d4d7af0b651
const _dartTemporary0 = Symbol();
export class _TextSelectionToolbarItemPosition {
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
    static readonly first: _TextSelectionToolbarItemPosition = new _TextSelectionToolbarItemPosition(0, "first", _dartTemporary0);
    static readonly middle: _TextSelectionToolbarItemPosition = new _TextSelectionToolbarItemPosition(1, "middle", _dartTemporary0);
    static readonly last: _TextSelectionToolbarItemPosition = new _TextSelectionToolbarItemPosition(2, "last", _dartTemporary0);
    static readonly only: _TextSelectionToolbarItemPosition = new _TextSelectionToolbarItemPosition(3, "only", _dartTemporary0);
    static readonly values: ReadonlyArray<_TextSelectionToolbarItemPosition> = Object.freeze([_TextSelectionToolbarItemPosition.first, _TextSelectionToolbarItemPosition.middle, _TextSelectionToolbarItemPosition.last, _TextSelectionToolbarItemPosition.only]);
    toString(): string {
        return "_TextSelectionToolbarItemPosition." + this.name;
    }
}
Object.freeze(_TextSelectionToolbarItemPosition.prototype);
Object.freeze(_TextSelectionToolbarItemPosition);
