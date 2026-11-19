// W11 Flutter design source ec2fd4419485482a9ce25f647565bd5ee847d7f426d17d54274978b0d1d3a3a5 SHA256 2b54cef5ce5c935d58c4ed2f5f4f53db0d1e8e3218e4321de0c698861cd07aab
// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Generated from packages/flutter/lib/src/material/scaffold.dart; SHA256 c8b4f9850f411dcaa33d0535e39f3fba176e8aa3f215d10c5f4f446ec3b52d0d
const _dartTemporary0 = Symbol();
export class _ScaffoldSlot {
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
    static readonly body: _ScaffoldSlot = new _ScaffoldSlot(0, "body", _dartTemporary0);
    static readonly appBar: _ScaffoldSlot = new _ScaffoldSlot(1, "appBar", _dartTemporary0);
    static readonly bodyScrim: _ScaffoldSlot = new _ScaffoldSlot(2, "bodyScrim", _dartTemporary0);
    static readonly bottomSheet: _ScaffoldSlot = new _ScaffoldSlot(3, "bottomSheet", _dartTemporary0);
    static readonly snackBar: _ScaffoldSlot = new _ScaffoldSlot(4, "snackBar", _dartTemporary0);
    static readonly materialBanner: _ScaffoldSlot = new _ScaffoldSlot(5, "materialBanner", _dartTemporary0);
    static readonly persistentFooter: _ScaffoldSlot = new _ScaffoldSlot(6, "persistentFooter", _dartTemporary0);
    static readonly bottomNavigationBar: _ScaffoldSlot = new _ScaffoldSlot(7, "bottomNavigationBar", _dartTemporary0);
    static readonly floatingActionButton: _ScaffoldSlot = new _ScaffoldSlot(8, "floatingActionButton", _dartTemporary0);
    static readonly drawer: _ScaffoldSlot = new _ScaffoldSlot(9, "drawer", _dartTemporary0);
    static readonly endDrawer: _ScaffoldSlot = new _ScaffoldSlot(10, "endDrawer", _dartTemporary0);
    static readonly statusBar: _ScaffoldSlot = new _ScaffoldSlot(11, "statusBar", _dartTemporary0);
    static readonly values: ReadonlyArray<_ScaffoldSlot> = Object.freeze([_ScaffoldSlot.body, _ScaffoldSlot.appBar, _ScaffoldSlot.bodyScrim, _ScaffoldSlot.bottomSheet, _ScaffoldSlot.snackBar, _ScaffoldSlot.materialBanner, _ScaffoldSlot.persistentFooter, _ScaffoldSlot.bottomNavigationBar, _ScaffoldSlot.floatingActionButton, _ScaffoldSlot.drawer, _ScaffoldSlot.endDrawer, _ScaffoldSlot.statusBar]);
    toString(): string {
        return "_ScaffoldSlot." + this.name;
    }
}
Object.freeze(_ScaffoldSlot.prototype);
Object.freeze(_ScaffoldSlot);
