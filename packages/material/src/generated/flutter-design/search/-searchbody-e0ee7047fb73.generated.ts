// W11 Flutter design source e0ee7047fb73a1cb3bb75bd241b5fe22773a5d8a360b8badaddda0bb323e2c6a SHA256 da3110f94830b311d4c97ba1e3d09c703cb0343c388c5a32985886fe7e77e29e
// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Generated from packages/flutter/lib/src/material/search.dart; SHA256 aa477e323ac21737ac4a62ad2207b07593a51e1431acde812b4d9218fb62da60
const _dartTemporary0 = Symbol();
export class _SearchBody {
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
    static readonly suggestions: _SearchBody = new _SearchBody(0, "suggestions", _dartTemporary0);
    static readonly results: _SearchBody = new _SearchBody(1, "results", _dartTemporary0);
    static readonly values: ReadonlyArray<_SearchBody> = Object.freeze([_SearchBody.suggestions, _SearchBody.results]);
    toString(): string {
        return "_SearchBody." + this.name;
    }
}
Object.freeze(_SearchBody.prototype);
Object.freeze(_SearchBody);
