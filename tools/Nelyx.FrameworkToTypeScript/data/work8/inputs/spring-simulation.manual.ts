// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Explicit existing simulation ports; only SpringDescription is generated.
export interface SpringDescriptionOptions {readonly mass:number;readonly stiffness:number;readonly damping:number}
export interface SpringDampingRatioOptions {readonly mass:number;readonly stiffness:number;readonly ratio?:number}
/** The TypeScript duration boundary uses integer milliseconds, as the app clock does. */
export interface SpringDurationOptions {readonly duration?:number;readonly bounce?:number}
export class SpringType {
  static readonly criticallyDamped=new SpringType(0,'criticallyDamped');
  static readonly underDamped=new SpringType(1,'underDamped');
  static readonly overDamped=new SpringType(2,'overDamped');
  static readonly values=Object.freeze([SpringType.criticallyDamped,SpringType.underDamped,SpringType.overDamped]);
  private constructor(readonly index:number,readonly name:string){Object.freeze(this);}
  toString():string{return 'SpringType.'+this.name;}
}
export interface SpringSimulationOptions extends SimulationOptions {readonly snapToEnd?:boolean}
export class SpringSimulation extends Simulation {
  protected readonly _endPosition:number;private readonly _solution:SpringSolution;private readonly _snapToEnd:boolean;
  constructor(spring:SpringDescription,start:number,end:number,velocity:number,{snapToEnd=false,...options}:SpringSimulationOptions={}){super(options);this._endPosition=end;this._solution=createSpringSolution(spring,start-end,velocity);this._snapToEnd=snapToEnd;}
  get type():SpringType{return this._solution.type;}
  x(time:number):number{return this._snapToEnd&&this.isDone(time)?this._endPosition:this._endPosition+this._solution.x(time);}
  dx(time:number):number{return this._snapToEnd&&this.isDone(time)?0:this._solution.dx(time);}
  isDone(time:number):boolean{return nearZero(this._solution.x(time),this.tolerance.distance)&&nearZero(this._solution.dx(time),this.tolerance.velocity);}
  override toString():string{return `${objectRuntimeType(this,'SpringSimulation')}(end: ${fixed(this._endPosition)}, ${this.type})`;}
}
export class ScrollSpringSimulation extends SpringSimulation {
  override x(time:number):number{return this.isDone(time)?this._endPosition:super.x(time);}
}
abstract class SpringSolution {abstract x(time:number):number;abstract dx(time:number):number;abstract get type():SpringType;}
function createSpringSolution(spring:SpringDescription,position:number,velocity:number):SpringSolution{const discriminant=spring.damping*spring.damping-4*spring.mass*spring.stiffness;return discriminant>0?OverdampedSolution.fromSpring(spring,position,velocity):discriminant<0?UnderdampedSolution.fromSpring(spring,position,velocity):CriticalSolution.fromSpring(spring,position,velocity);}
class CriticalSolution extends SpringSolution {
  static fromSpring(spring:SpringDescription,distance:number,velocity:number):CriticalSolution{const r=-spring.damping/(2*spring.mass),c1=distance,c2=velocity-r*distance;return new CriticalSolution(r,c1,c2);}
  constructor(private readonly _r:number,private readonly _c1:number,private readonly _c2:number){super();}
  x(time:number):number{return (this._c1+this._c2*time)*Math.pow(Math.E,this._r*time);}
  dx(time:number):number{const power=Math.pow(Math.E,this._r*time);return this._r*(this._c1+this._c2*time)*power+this._c2*power;}
  get type():SpringType{return SpringType.criticallyDamped;}
}
class OverdampedSolution extends SpringSolution {
  static fromSpring(spring:SpringDescription,distance:number,velocity:number):OverdampedSolution{const cmk=spring.damping*spring.damping-4*spring.mass*spring.stiffness,r1=(-spring.damping-Math.sqrt(cmk))/(2*spring.mass),r2=(-spring.damping+Math.sqrt(cmk))/(2*spring.mass),c2=(velocity-r1*distance)/(r2-r1),c1=distance-c2;return new OverdampedSolution(r1,r2,c1,c2);}
  constructor(private readonly _r1:number,private readonly _r2:number,private readonly _c1:number,private readonly _c2:number){super();}
  x(time:number):number{return this._c1*Math.pow(Math.E,this._r1*time)+this._c2*Math.pow(Math.E,this._r2*time);}
  dx(time:number):number{return this._c1*this._r1*Math.pow(Math.E,this._r1*time)+this._c2*this._r2*Math.pow(Math.E,this._r2*time);}
  get type():SpringType{return SpringType.overDamped;}
}
class UnderdampedSolution extends SpringSolution {
  static fromSpring(spring:SpringDescription,distance:number,velocity:number):UnderdampedSolution{const w=Math.sqrt(4*spring.mass*spring.stiffness-spring.damping*spring.damping)/(2*spring.mass),r=-spring.damping/2/spring.mass,c1=distance,c2=(velocity-r*distance)/w;return new UnderdampedSolution(w,r,c1,c2);}
  constructor(private readonly _w:number,private readonly _r:number,private readonly _c1:number,private readonly _c2:number){super();}
  x(time:number):number{return Math.pow(Math.E,this._r*time)*(this._c1*Math.cos(this._w*time)+this._c2*Math.sin(this._w*time));}
  dx(time:number):number{const power=Math.pow(Math.E,this._r*time),cosine=Math.cos(this._w*time),sine=Math.sin(this._w*time);return power*(this._c2*this._w*cosine-this._c1*this._w*sine)+this._r*power*(this._c2*sine+this._c1*cosine);}
  get type():SpringType{return SpringType.underDamped;}
}
