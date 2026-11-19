// W11 Flutter design source d599a983021ebd4ccccf5ab5043b23ac2f774e82a62dc9fa64a89b3d6389d381 SHA256 0652d27e7293489f52265cbbd45710d9831181cbf1b50544a14c27908b1d35de
// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Generated from packages/flutter/lib/src/material/dropdown_menu.dart; SHA256 e4f7b12ab55a91151385eee4a006ddbe4056494eaed3c968fcc80d67076dc3e0
const _dartTemporary0 = Symbol();
export class DropdownMenuCloseBehavior {
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
    static readonly all: DropdownMenuCloseBehavior = new DropdownMenuCloseBehavior(0, "all", _dartTemporary0);
    static readonly self: DropdownMenuCloseBehavior = new DropdownMenuCloseBehavior(1, "self", _dartTemporary0);
    static readonly none: DropdownMenuCloseBehavior = new DropdownMenuCloseBehavior(2, "none", _dartTemporary0);
    static readonly values: ReadonlyArray<DropdownMenuCloseBehavior> = Object.freeze([DropdownMenuCloseBehavior.all, DropdownMenuCloseBehavior.self, DropdownMenuCloseBehavior.none]);
    toString(): string {
        return "DropdownMenuCloseBehavior." + this.name;
    }
}
Object.freeze(DropdownMenuCloseBehavior.prototype);
Object.freeze(DropdownMenuCloseBehavior);
