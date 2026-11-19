// W11 Flutter design source 27ab95374419cacdbc978716e4e433789d35d937fceb6690614ccfabb162fd0b SHA256 5505b2e63b3573439d866e7e3548425748cd7d2370a21cc56fab685affe93c5b
// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Generated from packages/flutter/lib/src/cupertino/menu_anchor.dart; SHA256 344e74d347a155a7d62a8340e7180f071b7bbc4cd2f1fec33b253989b1cba229
import { Animatable } from "@nelyx/core/framework/animation/tween";
import { protect } from "@nelyx/core/internal/ui/value-math";
export class _ClampTween extends Animatable<number> {
    /**
     * @dartType double
     * @dartTypeOrigin explicit
     */
    readonly begin: number;
    /**
     * @dartType double
     * @dartTypeOrigin explicit
     */
    readonly end: number;
    /**
     * @dartParam begin double
     * @dartParamOrigin begin inferred
     * @dartParam end double
     * @dartParamOrigin end inferred
     */
    constructor({ begin, end }: {
        readonly begin: number;
        readonly end: number;
    }) {
        /**
         * @dartType double
         * @dartTypeOrigin inferred
         */
        const _initialField0 = begin;
        /**
         * @dartType double
         * @dartTypeOrigin inferred
         */
        const _initialField1 = end;
        super();
        this.begin = _initialField0;
        this.end = _initialField1;
        protect(this, ["begin", "end"]);
    }
    /**
     * @dartParam t double
     * @dartParamOrigin t explicit
     * @dartReturn double
     * @dartReturnOrigin explicit
     */
    override transform(t: number): number {
        if (t < this.begin) {
            return this.begin;
        }
        if (t > this.end) {
            return this.end;
        }
        return t;
    }
}
