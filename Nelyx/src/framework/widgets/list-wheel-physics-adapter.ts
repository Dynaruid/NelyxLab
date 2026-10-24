// SPDX-License-Identifier: BSD-3-Clause
// Explicit Nelyx position identity and constructor API bindings; no snap algorithm.
import {ScrollPositionWithSingleContext} from './scroll-position-with-single-context.ts';
import {invariant} from '../../foundation/errors.ts';
import {SpringSimulation,SpringDescription} from '../physics/spring-simulation.ts';
import type {Tolerance} from '../physics/tolerance.ts';
export abstract class WheelPosition extends ScrollPositionWithSingleContext {
  abstract readonly itemExtent:number;
  abstract get itemIndex():number;
}
export function isWheelPosition(value:unknown):value is WheelPosition{return value instanceof WheelPosition;}
export function castWheelPosition(value:unknown):WheelPosition{invariant(isWheelPosition(value),'invalid-wheel-metrics','Fixed-extent physics requires its wheel position');return value;}
export function createWheelSpring(spring:SpringDescription,start:number,end:number,velocity:number,options:{tolerance:Tolerance}):SpringSimulation{return new SpringSimulation(spring,start,end,velocity,options);}
