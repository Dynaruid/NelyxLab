// W11 Flutter design source a04d652b52959d074b44d35fde7dd5372b88513e4fa2a0bf5c9816ff77c679c6 SHA256 bd5a4aec2cbb3b3e55dd7593c9aef2d5487a65483f24c0b90f4b67098f955b2f
// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Generated from packages/flutter/lib/src/cupertino/sliding_segmented_control.dart; SHA256 377ea8fd022755e38e1a9f591f0f21874fdf46875ba08ade103131f853145dc3
const _dartTemporary0 = Symbol();
export class _SegmentLocation {
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
    static readonly leftmost: _SegmentLocation = new _SegmentLocation(0, "leftmost", _dartTemporary0);
    static readonly rightmost: _SegmentLocation = new _SegmentLocation(1, "rightmost", _dartTemporary0);
    static readonly inbetween: _SegmentLocation = new _SegmentLocation(2, "inbetween", _dartTemporary0);
    static readonly values: ReadonlyArray<_SegmentLocation> = Object.freeze([_SegmentLocation.leftmost, _SegmentLocation.rightmost, _SegmentLocation.inbetween]);
    toString(): string {
        return "_SegmentLocation." + this.name;
    }
}
Object.freeze(_SegmentLocation.prototype);
Object.freeze(_SegmentLocation);
