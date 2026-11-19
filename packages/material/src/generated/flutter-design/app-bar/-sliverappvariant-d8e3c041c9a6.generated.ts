// W11 Flutter design source d8e3c041c9a625de8e573ecf27788c3eee8295dfaec080507c6732c0fc93ce7c SHA256 4684378fcaf75b4233a18c0048a062bfd6c6759dbccad5a5dcbaa23369259a5e
// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Generated from packages/flutter/lib/src/material/app_bar.dart; SHA256 b89dd431bbfde931206bf9203da644f0bb5edbb903be83d9f4ff4226bb632070
const _dartTemporary0 = Symbol();
export class _SliverAppVariant {
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
    static readonly small: _SliverAppVariant = new _SliverAppVariant(0, "small", _dartTemporary0);
    static readonly medium: _SliverAppVariant = new _SliverAppVariant(1, "medium", _dartTemporary0);
    static readonly large: _SliverAppVariant = new _SliverAppVariant(2, "large", _dartTemporary0);
    static readonly values: ReadonlyArray<_SliverAppVariant> = Object.freeze([_SliverAppVariant.small, _SliverAppVariant.medium, _SliverAppVariant.large]);
    toString(): string {
        return "_SliverAppVariant." + this.name;
    }
}
Object.freeze(_SliverAppVariant.prototype);
Object.freeze(_SliverAppVariant);
