// W11 Flutter design source 5574c7c7eeeb70496b0c45d828743d58c41b8b593d46881d35b8b05d9e1e1b96 SHA256 3634f5cb96b5643c0b7f99d969d1daca7e7ba675842b057bd1916e864aa5e37f
// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Generated from packages/flutter/lib/src/material/banner.dart; SHA256 5f7c348d7548d619911ea0f665b707224d1bf60da02b7fb31e470e7e791881e7
const _dartTemporary0 = Symbol();
export class MaterialBannerClosedReason {
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
    static readonly dismiss: MaterialBannerClosedReason = new MaterialBannerClosedReason(0, "dismiss", _dartTemporary0);
    static readonly swipe: MaterialBannerClosedReason = new MaterialBannerClosedReason(1, "swipe", _dartTemporary0);
    static readonly hide: MaterialBannerClosedReason = new MaterialBannerClosedReason(2, "hide", _dartTemporary0);
    static readonly remove: MaterialBannerClosedReason = new MaterialBannerClosedReason(3, "remove", _dartTemporary0);
    static readonly values: ReadonlyArray<MaterialBannerClosedReason> = Object.freeze([MaterialBannerClosedReason.dismiss, MaterialBannerClosedReason.swipe, MaterialBannerClosedReason.hide, MaterialBannerClosedReason.remove]);
    toString(): string {
        return "MaterialBannerClosedReason." + this.name;
    }
}
Object.freeze(MaterialBannerClosedReason.prototype);
Object.freeze(MaterialBannerClosedReason);
