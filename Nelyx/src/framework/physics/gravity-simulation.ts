// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Generated from packages/flutter/lib/src/physics/gravity_simulation.dart; SHA256 0b7cdf3cd0ccdfa993fcd5f3662ddbe31a883240458e29a36921b51d530fccb5
import { Simulation } from "./simulation.ts";
import { FoundationBuildMode } from "../../foundation/constants.ts";
import { invariant } from "../../foundation/errors.ts";
import { objectRuntimeType } from "../../foundation/object.ts";
import { fixedOne } from "../../ui/value-math.ts";
import { protect } from "../../ui/value-math.ts";
export class GravitySimulation extends Simulation {
    /**
     * @dartType double
     * @dartTypeOrigin explicit
     */
    private readonly _x: number;
    /**
     * @dartType double
     * @dartTypeOrigin explicit
     */
    private readonly _v: number;
    /**
     * @dartType double
     * @dartTypeOrigin explicit
     */
    private readonly _a: number;
    /**
     * @dartType double
     * @dartTypeOrigin explicit
     */
    private readonly _end: number;
    /**
     * @dartParam acceleration double
     * @dartParamOrigin acceleration explicit
     * @dartParam distance double
     * @dartParamOrigin distance explicit
     * @dartParam endDistance double
     * @dartParamOrigin endDistance explicit
     * @dartParam velocity double
     * @dartParamOrigin velocity explicit
     */
    constructor(acceleration: number, distance: number, endDistance: number, velocity: number) {
        if (FoundationBuildMode.debug)
            invariant(endDistance >= 0, "invalid-gravity-simulation", "Simulation constructor constraints must hold");
        /**
         * @dartType double
         * @dartTypeOrigin inferred
         */
        const _initialField0 = acceleration;
        /**
         * @dartType double
         * @dartTypeOrigin inferred
         */
        const _initialField1 = distance;
        /**
         * @dartType double
         * @dartTypeOrigin inferred
         */
        const _initialField2 = velocity;
        /**
         * @dartType double
         * @dartTypeOrigin inferred
         */
        const _initialField3 = endDistance;
        super();
        this._x = _initialField1;
        this._v = _initialField2;
        this._a = _initialField0;
        this._end = _initialField3;
        protect(this, ["_x", "_v", "_a", "_end"]);
    }
    /**
     * @dartParam time double
     * @dartParamOrigin time explicit
     * @dartReturn double
     * @dartReturnOrigin explicit
     */
    override x(time: number): number {
        return this._x + this._v * time + 0.5 * this._a * time * time;
    }
    /**
     * @dartParam time double
     * @dartParamOrigin time explicit
     * @dartReturn double
     * @dartReturnOrigin explicit
     */
    override dx(time: number): number {
        return this._v + time * this._a;
    }
    /**
     * @dartParam time double
     * @dartParamOrigin time explicit
     */
    override isDone(time: number): boolean {
        return Math.abs(this.x(time)) >= this._end;
    }
    override toString(): string {
        return `${objectRuntimeType(this, "GravitySimulation")}(g: ${fixedOne(this._a, 1)}, x\u2080: ${fixedOne(this._x, 1)}, dx\u2080: ${fixedOne(this._v, 1)}, x\u2098\u2090\u2093: \u00B1${fixedOne(this._end, 1)})`;
    }
}
