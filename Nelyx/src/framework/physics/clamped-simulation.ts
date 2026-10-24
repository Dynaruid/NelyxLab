// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Generated from packages/flutter/lib/src/physics/clamped_simulation.dart; SHA256 846903d51bbaa3204f8651b735f0ae03f789eb8b882995009e446ffc7af03804
import { Simulation } from "./simulation.ts";
import { FoundationBuildMode } from "../../foundation/constants.ts";
import { invariant } from "../../foundation/errors.ts";
import { objectRuntimeType } from "../../foundation/object.ts";
import { fixedOne } from "../../ui/value-math.ts";
import { protect } from "../../ui/value-math.ts";
import { clampDouble } from "../../ui/math.ts";
import { diagnosticValueString } from "../../foundation/debug.ts";
export class ClampedSimulation extends Simulation {
    readonly simulation: Simulation;
    /**
     * @dartType double
     * @dartTypeOrigin explicit
     */
    readonly xMin: number;
    /**
     * @dartType double
     * @dartTypeOrigin explicit
     */
    readonly xMax: number;
    /**
     * @dartType double
     * @dartTypeOrigin explicit
     */
    readonly dxMin: number;
    /**
     * @dartType double
     * @dartTypeOrigin explicit
     */
    readonly dxMax: number;
    /**
     * @dartParam xMin double
     * @dartParamOrigin xMin inferred
     * @dartParam xMax double
     * @dartParamOrigin xMax inferred
     * @dartParam dxMin double
     * @dartParamOrigin dxMin inferred
     * @dartParam dxMax double
     * @dartParamOrigin dxMax inferred
     */
    constructor(simulation: Simulation, { xMin = -Infinity, xMax = Infinity, dxMin = -Infinity, dxMax = Infinity }: {
        readonly xMin?: number;
        readonly xMax?: number;
        readonly dxMin?: number;
        readonly dxMax?: number;
    } = {}) {
        if (FoundationBuildMode.debug)
            invariant(xMax >= xMin, "invalid-clamped-simulation", "Simulation constructor constraints must hold");
        if (FoundationBuildMode.debug)
            invariant(dxMax >= dxMin, "invalid-clamped-simulation", "Simulation constructor constraints must hold");
        super();
        this.simulation = simulation;
        this.xMin = xMin;
        this.xMax = xMax;
        this.dxMin = dxMin;
        this.dxMax = dxMax;
        protect(this, ["simulation", "xMin", "xMax", "dxMin", "dxMax"]);
    }
    /**
     * @dartParam time double
     * @dartParamOrigin time explicit
     * @dartReturn double
     * @dartReturnOrigin explicit
     */
    override x(time: number): number {
        return clampDouble(this.simulation.x(time), this.xMin, this.xMax);
    }
    /**
     * @dartParam time double
     * @dartParamOrigin time explicit
     * @dartReturn double
     * @dartReturnOrigin explicit
     */
    override dx(time: number): number {
        return clampDouble(this.simulation.dx(time), this.dxMin, this.dxMax);
    }
    /**
     * @dartParam time double
     * @dartParamOrigin time explicit
     */
    override isDone(time: number): boolean {
        return this.simulation.isDone(time);
    }
    override toString(): string {
        return `${objectRuntimeType(this, "ClampedSimulation")}(simulation: ${diagnosticValueString(this.simulation)}, x: ${fixedOne(this.xMin, 1)}..${fixedOne(this.xMax, 1)}, dx: ${fixedOne(this.dxMin, 1)}..${fixedOne(this.dxMax, 1)})`;
    }
}

// Composed manual declarations: tools/Nelyx.FrameworkToTypeScript/data/work8/inputs/clamped-simulation.manual.ts
// Retained public options name; the generated constructor has the same shape.
export interface ClampedSimulationOptions {
  readonly xMin?:number;
  readonly xMax?:number;
  readonly dxMin?:number;
  readonly dxMax?:number;
}
