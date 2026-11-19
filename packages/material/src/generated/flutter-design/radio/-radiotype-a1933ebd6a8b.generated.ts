// W11 Flutter design source a1933ebd6a8ba96319a211c8da42548ed15fa048c04e35de599a3e509527e5a3 SHA256 ad7f2c1a612db6a149da396cc2e52384a1745783a94bc6e5a4e7b5a234a86686
// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Generated from packages/flutter/lib/src/material/radio.dart; SHA256 020f9b3a02871483e3ad8c7fa32f9758bf0fa64b40d2bad846b42a969b5dd07c
const _dartTemporary0 = Symbol();
export class _RadioType {
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
    static readonly material: _RadioType = new _RadioType(0, "material", _dartTemporary0);
    static readonly adaptive: _RadioType = new _RadioType(1, "adaptive", _dartTemporary0);
    static readonly values: ReadonlyArray<_RadioType> = Object.freeze([_RadioType.material, _RadioType.adaptive]);
    toString(): string {
        return "_RadioType." + this.name;
    }
}
Object.freeze(_RadioType.prototype);
Object.freeze(_RadioType);
