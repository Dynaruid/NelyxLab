// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
import {Tolerance} from './tolerance.ts';
import {objectRuntimeType} from '../../foundation/object.ts';
export interface SimulationOptions {readonly tolerance?:Tolerance}
/** Simulation time is in seconds; the owning ticker supplies its clock. */
export abstract class Simulation {
  tolerance:Tolerance;
  constructor({tolerance=Tolerance.defaultTolerance}:SimulationOptions={}){this.tolerance=tolerance;}
  abstract x(time:number):number;
  abstract dx(time:number):number;
  abstract isDone(time:number):boolean;
  toString():string{return objectRuntimeType(this,'Simulation');}
}
