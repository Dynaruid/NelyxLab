// W11 Flutter design source a517d24183ff65a40397d54ac2bbcfe11b1539d58baf2095b9f2b9ca6988cbe8 SHA256 91cdd24b636656f0a43a5d58882fbb2b317b358de7aed2d96bb4bd603817e9c2
// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Generated from packages/flutter/lib/src/material/predictive_back_page_transitions_builder.dart; SHA256 0da2b88aa31be10ab47f6ecb8e89eb91ba6377a94999725c09b8f5f2e42fd2bf
const _dartTemporary0 = Symbol();
export class _PredictiveBackPhase {
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
    static readonly idle: _PredictiveBackPhase = new _PredictiveBackPhase(0, "idle", _dartTemporary0);
    static readonly start: _PredictiveBackPhase = new _PredictiveBackPhase(1, "start", _dartTemporary0);
    static readonly update: _PredictiveBackPhase = new _PredictiveBackPhase(2, "update", _dartTemporary0);
    static readonly commit: _PredictiveBackPhase = new _PredictiveBackPhase(3, "commit", _dartTemporary0);
    static readonly cancel: _PredictiveBackPhase = new _PredictiveBackPhase(4, "cancel", _dartTemporary0);
    static readonly values: ReadonlyArray<_PredictiveBackPhase> = Object.freeze([_PredictiveBackPhase.idle, _PredictiveBackPhase.start, _PredictiveBackPhase.update, _PredictiveBackPhase.commit, _PredictiveBackPhase.cancel]);
    toString(): string {
        return "_PredictiveBackPhase." + this.name;
    }
}
Object.freeze(_PredictiveBackPhase.prototype);
Object.freeze(_PredictiveBackPhase);
