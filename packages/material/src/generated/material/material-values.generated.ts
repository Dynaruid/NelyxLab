// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Generated from packages/flutter/lib/src/material/material.dart; SHA256 fc58cf3b2ee621a1ea9e204a997ba0cf0ea2288d82e69c378d133c841f1a677f
import { checkedInteger } from "@nelyx/core/internal/ui/value-math";
const _dartTemporary0 = Symbol();
export class MaterialType {
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
    static readonly canvas: MaterialType = new MaterialType(0, "canvas", _dartTemporary0);
    static readonly card: MaterialType = new MaterialType(1, "card", _dartTemporary0);
    static readonly circle: MaterialType = new MaterialType(2, "circle", _dartTemporary0);
    static readonly button: MaterialType = new MaterialType(3, "button", _dartTemporary0);
    static readonly transparency: MaterialType = new MaterialType(4, "transparency", _dartTemporary0);
    static readonly values: ReadonlyArray<MaterialType> = Object.freeze([MaterialType.canvas, MaterialType.card, MaterialType.circle, MaterialType.button, MaterialType.transparency]);
    toString(): string {
        return "MaterialType." + this.name;
    }
}
Object.freeze(MaterialType.prototype);
Object.freeze(MaterialType);
