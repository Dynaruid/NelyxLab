// W11 Flutter design source f69eaa62ee7c6b126797fe7bf02cc7d07e103ec2e2d47a8d550509cc27bc5697 SHA256 892414fe880c91da16f95c92843df0c240b40438d05c3a4f2fd44e895177090c
// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Generated from packages/flutter/lib/src/cupertino/context_menu.dart; SHA256 ab38b8f4b8b7f4bb22cda83fd98b35f7767cef320bd6b71b2178ca802f4cd4ec
const _dartTemporary0 = Symbol();
export class _ContextMenuChild {
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
    static readonly child: _ContextMenuChild = new _ContextMenuChild(0, "child", _dartTemporary0);
    static readonly menuSheet: _ContextMenuChild = new _ContextMenuChild(1, "menuSheet", _dartTemporary0);
    static readonly values: ReadonlyArray<_ContextMenuChild> = Object.freeze([_ContextMenuChild.child, _ContextMenuChild.menuSheet]);
    toString(): string {
        return "_ContextMenuChild." + this.name;
    }
}
Object.freeze(_ContextMenuChild.prototype);
Object.freeze(_ContextMenuChild);
