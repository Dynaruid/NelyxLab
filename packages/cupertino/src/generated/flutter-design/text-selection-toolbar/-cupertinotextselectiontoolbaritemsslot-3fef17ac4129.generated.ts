// W11 Flutter design source 3fef17ac41294c231fde4600ac10f245ab58af15a7f6d2df586f816a59634589 SHA256 a99b8aa3c488899031cff8dc689baf9fd181f13d1c449d6151ce851891af1a51
// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Generated from packages/flutter/lib/src/cupertino/text_selection_toolbar.dart; SHA256 9daff19d87baf2c3e788be007c1426f9e3f6005df4c0957d3864889fc3e90c1e
const _dartTemporary0 = Symbol();
export class _CupertinoTextSelectionToolbarItemsSlot {
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
    static readonly backButton: _CupertinoTextSelectionToolbarItemsSlot = new _CupertinoTextSelectionToolbarItemsSlot(0, "backButton", _dartTemporary0);
    static readonly nextButton: _CupertinoTextSelectionToolbarItemsSlot = new _CupertinoTextSelectionToolbarItemsSlot(1, "nextButton", _dartTemporary0);
    static readonly values: ReadonlyArray<_CupertinoTextSelectionToolbarItemsSlot> = Object.freeze([_CupertinoTextSelectionToolbarItemsSlot.backButton, _CupertinoTextSelectionToolbarItemsSlot.nextButton]);
    toString(): string {
        return "_CupertinoTextSelectionToolbarItemsSlot." + this.name;
    }
}
Object.freeze(_CupertinoTextSelectionToolbarItemsSlot.prototype);
Object.freeze(_CupertinoTextSelectionToolbarItemsSlot);
