// SPDX-License-Identifier: BSD-3-Clause
// Reviewed port: Doroti d8d1e179 Physics/spring_simulation.cs; analytic critical/over/underdamped solutions.
import {invariant} from '../../foundation/errors.ts';
import {Tolerance} from './tolerance.ts';
export interface Simulation {x(seconds:number):number;dx(seconds:number):number;isDone(seconds:number):boolean}
export class SpringDescription {
  constructor(readonly mass:number,readonly stiffness:number,readonly damping:number){invariant([mass,stiffness,damping].every(Number.isFinite)&&mass>0&&stiffness>0&&damping>=0,'invalid-spring','Spring requires positive mass/stiffness and nonnegative damping');}
  static withDampingRatio(mass:number,stiffness:number,ratio=1):SpringDescription{return new SpringDescription(mass,stiffness,ratio*2*Math.sqrt(mass*stiffness));}
}
export class SpringSimulation implements Simulation {
  readonly type:'critical'|'overdamped'|'underdamped';
  private readonly position:(t:number)=>number;
  private readonly velocity:(t:number)=>number;
  constructor(spring:SpringDescription,start:number,readonly end:number,velocity:number,readonly tolerance=Tolerance.defaultTolerance) {
    invariant([start,end,velocity].every(Number.isFinite),'invalid-simulation','Spring initial state must be finite');
    const {mass,stiffness,damping}=spring,distance=start-end,discriminant=damping*damping-4*mass*stiffness;
    if(discriminant===0){this.type='critical';const r=-damping/(2*mass),c1=distance,c2=velocity-r*distance;this.position=t=>(c1+c2*t)*Math.exp(r*t);this.velocity=t=>(r*(c1+c2*t)+c2)*Math.exp(r*t);}
    else if(discriminant>0){this.type='overdamped';const r1=(-damping-Math.sqrt(discriminant))/(2*mass),r2=(-damping+Math.sqrt(discriminant))/(2*mass),c2=(velocity-r1*distance)/(r2-r1),c1=distance-c2;this.position=t=>c1*Math.exp(r1*t)+c2*Math.exp(r2*t);this.velocity=t=>c1*r1*Math.exp(r1*t)+c2*r2*Math.exp(r2*t);}
    else {this.type='underdamped';const w=Math.sqrt(-discriminant)/(2*mass),r=-damping/(2*mass),c1=distance,c2=(velocity-r*distance)/w;this.position=t=>Math.exp(r*t)*(c1*Math.cos(w*t)+c2*Math.sin(w*t));this.velocity=t=>Math.exp(r*t)*((c2*w*Math.cos(w*t)-c1*w*Math.sin(w*t))+r*(c1*Math.cos(w*t)+c2*Math.sin(w*t)));}
  }
  x(seconds:number):number{return this.end+this.position(seconds);}
  dx(seconds:number):number{return this.velocity(seconds);}
  isDone(seconds:number):boolean{return Math.abs(this.position(seconds))<this.tolerance.distance&&Math.abs(this.velocity(seconds))<this.tolerance.velocity;}
}
export class FrictionSimulation implements Simulation {
  constructor(readonly drag:number,readonly start:number,readonly velocity:number,readonly tolerance=Tolerance.defaultTolerance){invariant(drag>0&&drag<1&&[drag,start,velocity].every(Number.isFinite),'invalid-friction','Friction drag must be between zero and one');}
  x(seconds:number):number{return this.start+this.velocity*(Math.pow(this.drag,seconds)-1)/Math.log(this.drag);}
  dx(seconds:number):number{return this.velocity*Math.pow(this.drag,seconds);}
  isDone(seconds:number):boolean{return Math.abs(this.dx(seconds))<this.tolerance.velocity;}
}
