// SPDX-License-Identifier: BSD-3-Clause
// Closed nominal boundary for the selected source constraint declarations.
import {invariant} from '../../foundation/errors.ts';
import {DartSet} from '../../foundation/dart-collections.ts';
import type {DartKeyPolicy} from '../../foundation/dart-collections.ts';
import {checkedInteger,hashDoubles} from '../../ui/value-math.ts';

type Token=Function&{readonly prototype:object};
interface ConstraintTokens {readonly base:Token;readonly state:Token&{readonly values:readonly object[]};readonly and:Token;readonly or:Token;readonly not:Token;readonly any:Token;}
const boundaries=new WeakMap<object,Readonly<ConstraintTokens>>();
const identities=new WeakMap<object,number>();let sequence=0;
const constants=new WeakMap<Function,object>();
/** The recipe proves the exact selected zero-argument const class immutable. */
export function widgetStateConstEmpty<T extends object>(owner:new()=>T):T{let value=constants.get(owner);if(!value){value=Object.freeze(new owner());constants.set(owner,value);}return value as T;}
/** Explicit generated constructor tokens; names and structural shapes never admit values. */
export function registerWidgetStateConstraints(tokens:ConstraintTokens):void{
  const previous=boundaries.get(tokens.base.prototype);
  if(previous){invariant(Object.keys(tokens).every(key=>previous[key as keyof ConstraintTokens]===tokens[key as keyof ConstraintTokens]),'conflicting-widget-state-boundary','Constraint tokens are immutable after registration');return;}
  invariant(new Set([tokens.base,tokens.state,tokens.and,tokens.or,tokens.not,tokens.any]).size===6,'invalid-widget-state-tokens','Constraint constructors must have distinct identities');
  for(const token of[tokens.state,tokens.and,tokens.or,tokens.not,tokens.any])invariant(Object.prototype.isPrototypeOf.call(tokens.base.prototype,token.prototype),'invalid-widget-state-base','Every admitted value must inherit the generated constraint body');
  invariant(Object.isFrozen(tokens.state.values)&&tokens.state.values.length>0&&tokens.state.values.every(value=>Object.getPrototypeOf(value)===tokens.state.prototype&&Object.isFrozen(value)),'invalid-widget-state-enum','Expected generated immutable enum values');
  boundaries.set(tokens.base.prototype,Object.freeze({...tokens}));
}
function boundary(value:unknown):Readonly<ConstraintTokens>|null{
  if(value===null||typeof value!=='object')return null;
  for(let prototype=Object.getPrototypeOf(value);prototype!==null;prototype=Object.getPrototypeOf(prototype)){const tokens=boundaries.get(prototype);if(!tokens)continue;const own=Object.getPrototypeOf(value);if(own===tokens.state.prototype)return tokens.state.values.includes(value)?tokens:null;return[tokens.and,tokens.or,tokens.not,tokens.any].some(token=>own===token.prototype)?tokens:null;}
  return null;
}
export function isRegisteredWidgetStateConstraint(value:unknown):value is object{return boundary(value)!==null;}
export function isRegisteredWidgetState(value:unknown):value is object{const tokens=boundary(value);return tokens!==null&&Object.getPrototypeOf(value)===tokens.state.prototype;}
export function widgetStateConstraintEquals(value:unknown,other:unknown):boolean{
  const tokens=boundary(value);invariant(tokens,'unadmitted-widget-state-constraint','Equality requires an explicitly registered source constraint');
  if(value===other)return true;
  const prototype=Object.getPrototypeOf(value);if([tokens.and,tokens.or,tokens.not].some(token=>prototype===token.prototype))return(value as {equals(other:unknown):boolean}).equals(other);
  return false;
}
/** Local hash ABI: source virtual overrides and equal-hash relation, not Dart VM integers. */
export function widgetStateConstraintHash(value:object):number{
  const tokens=boundary(value);invariant(tokens,'unadmitted-widget-state-constraint','Hash requires an explicitly registered source constraint');
  const prototype=Object.getPrototypeOf(value);if([tokens.and,tokens.or,tokens.not].some(token=>prototype===token.prototype))return checkedInteger((value as {readonly hashCode:number}).hashCode);
  let identity=identities.get(value);if(identity===undefined){identity=checkedInteger(++sequence);identities.set(value,identity);}return identity;
}
export function widgetStateConstraintHashPair(first:object,second:object):number{return hashDoubles([widgetStateConstraintHash(first),widgetStateConstraintHash(second)]);}
export function widgetStateConstraintString(value:object):string{invariant(boundary(value),'unadmitted-widget-state-constraint','String conversion requires an explicitly registered source constraint');return value.toString();}
export function widgetStateConstraintKeyPolicy<T extends object>(base:Token&{readonly prototype:T}):DartKeyPolicy<T>{
  invariant(boundaries.has(base.prototype),'unregistered-widget-state-base','Expected a registered constraint base');const accepts=(value:unknown):value is T=>boundary(value)?.base===base;
  return Object.freeze({accepts,validQuery:accepts,hash:(value:unknown)=>widgetStateConstraintHash(value as T),equals:widgetStateConstraintEquals});
}
export function widgetStateKeyPolicy<T extends object>(state:Token&{readonly values:readonly T[]}):DartKeyPolicy<T>{
  invariant(state.values.length>0&&boundary(state.values[0])?.state===state,'unregistered-widget-state-enum','Expected the registered enum owner');const accepts=(value:unknown):value is T=>boundary(value)?.state===state&&Object.getPrototypeOf(value)===state.prototype;
  return Object.freeze({accepts,validQuery:accepts,hash:(value:unknown)=>widgetStateConstraintHash(value as T),equals:(stored:T,query:unknown)=>stored===query});
}
export function widgetStateSet<T extends object>(state:Token&{readonly values:readonly T[]},values:Iterable<T>=[]):DartSet<T>{const set=new DartSet(widgetStateKeyPolicy(state));set.addAll(values);return set;}
