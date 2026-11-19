// W11 Flutter design source cb0f5ce029bbcf036c6da3c1a9988c832b8f7ea29d25bf33231c1fcce2abdb73 SHA256 eae331d945f063cbe48aee8cb00d5798e31d78c8de55074f4b197d4ab4a02086
// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Generated from packages/flutter/lib/src/cupertino/expansion_tile.dart; SHA256 dd9ca035e67839f620d5d1edaadb5b2177e2e7fbcb4cbd5b009b5ec929c4a39f
const _dartTemporary0 = Symbol();
export class ExpansionTileTransitionMode {
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
    static readonly fade: ExpansionTileTransitionMode = new ExpansionTileTransitionMode(0, "fade", _dartTemporary0);
    static readonly scroll: ExpansionTileTransitionMode = new ExpansionTileTransitionMode(1, "scroll", _dartTemporary0);
    static readonly values: ReadonlyArray<ExpansionTileTransitionMode> = Object.freeze([ExpansionTileTransitionMode.fade, ExpansionTileTransitionMode.scroll]);
    toString(): string {
        return "ExpansionTileTransitionMode." + this.name;
    }
}
Object.freeze(ExpansionTileTransitionMode.prototype);
Object.freeze(ExpansionTileTransitionMode);
