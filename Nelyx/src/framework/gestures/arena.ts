// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Flutter gestures/arena.dart with explicit View retirement and stale-entry guards.
import {invariant} from '../../foundation/errors.ts';
import {FoundationBuildMode} from '../../foundation/constants.ts';
import {debugPrint} from '../../foundation/print.ts';
import {GestureDebug} from './debug.ts';
export class GestureDisposition {
  static readonly accepted=new GestureDisposition(0,'accepted');static readonly rejected=new GestureDisposition(1,'rejected');
  static readonly values=Object.freeze([GestureDisposition.accepted,GestureDisposition.rejected]);
  private constructor(readonly index:number,readonly name:string){Object.freeze(this);}
  toString():string{return 'GestureDisposition.'+this.name;}
}
export interface GestureArenaMember {acceptGesture(pointer:number):void;rejectGesture(pointer:number):void}
export function normalizeGestureDisposition(disposition:GestureDisposition|boolean):GestureDisposition {if(typeof disposition==='boolean')return disposition?GestureDisposition.accepted:GestureDisposition.rejected;invariant(disposition instanceof GestureDisposition,'invalid-gesture-disposition','Expected GestureDisposition');return disposition;}
/** A concrete entry uses its actual captured owner/pointer/member resolver.
 * A team entry subclasses it with the actual combiner resolver. */
export class GestureArenaEntry {
  protected constructor(private readonly resolveDisposition:(disposition:GestureDisposition)=>void){}
  /** @internal Captures actual arena identity; not a singleton/native provider. */
  static _create(resolve:(disposition:GestureDisposition)=>void):GestureArenaEntry{return new GestureArenaEntry(resolve);}
  resolve(disposition:GestureDisposition):void;
  /** @deprecated Logical recognizer compatibility; prefer GestureDisposition. */
  resolve(accepted:boolean):void;
  resolve(disposition:GestureDisposition|boolean):void{this.resolveDisposition(normalizeGestureDisposition(disposition));}
}
class GestureArena {
  readonly members:GestureArenaMember[]=[];isOpen=true;isHeld=false;hasPendingSweep=false;eagerWinner:GestureArenaMember|null=null;
  add(member:GestureArenaMember):void{invariant(this.isOpen,'closed-gesture-arena','Gesture registered after pointer down dispatch');this.members.push(member);}
  toString():string{return (this.members.length?this.members.map(member=>String(member)+(member===this.eagerWinner?' (eager winner)':'')).join(', '):'<empty>')+(this.isOpen?' [open]':'')+(this.isHeld?' [held]':'')+(this.hasPendingSweep?' [hasPendingSweep]':'');}
}
export class GestureArenaManager {
  private readonly arenas=new Map<number,GestureArena>();private live=true;
  add(pointer:number,member:GestureArenaMember):GestureArenaEntry {
    invariant(this.live,'closed-gesture-arena-manager','Gesture arena owner is closed');invariant(Number.isSafeInteger(pointer),'invalid-gesture-pointer','Pointer must be a safe integer');let state=this.arenas.get(pointer);if(!state){this.debugLogDiagnostic(pointer,'★ Opening new gesture arena.');state=new GestureArena();this.arenas.set(pointer,state);}state.add(member);this.debugLogDiagnostic(pointer,()=>'Adding: '+member);const captured=state;return GestureArenaEntry._create(disposition=>this.resolve(pointer,member,disposition,captured));
  }
  close(pointer:number):void {const state=this.arenas.get(pointer);if(!state)return;state.isOpen=false;this.debugLogDiagnostic(pointer,'Closing',state);this.tryToResolveArena(pointer,state);}
  sweep(pointer:number):void {
    const state=this.arenas.get(pointer);if(!state)return;invariant(!state.isOpen,'open-gesture-arena-sweep','Close the arena before sweep');if(state.isHeld){state.hasPendingSweep=true;this.debugLogDiagnostic(pointer,'Delaying sweep',state);return;}this.debugLogDiagnostic(pointer,'Sweeping',state);this.arenas.delete(pointer);
    if(state.members.length){const winner=state.members[0]!;this.debugLogDiagnostic(pointer,()=>'Winner: '+winner);winner.acceptGesture(pointer);for(let index=1;index<state.members.length;index++)state.members[index]!.rejectGesture(pointer);}
  }
  hold(pointer:number):void {const state=this.arenas.get(pointer);if(!state)return;state.isHeld=true;this.debugLogDiagnostic(pointer,'Holding',state);}
  release(pointer:number):void {const state=this.arenas.get(pointer);if(!state)return;state.isHeld=false;this.debugLogDiagnostic(pointer,'Releasing',state);if(state.hasPendingSweep)this.sweep(pointer);}
  private resolve(pointer:number,member:GestureArenaMember,disposition:GestureDisposition,expected:GestureArena):void {
    const state=this.arenas.get(pointer);if(!this.live||state!==expected)return;invariant(state.members.includes(member),'resolved-gesture-member','This member has already left the arena');
    if(disposition===GestureDisposition.accepted){this.debugLogDiagnostic(pointer,()=>'Accepting: '+member);if(state.isOpen)state.eagerWinner??=member;else{this.debugLogDiagnostic(pointer,()=>'Self-declared winner: '+member);this.resolveInFavorOf(pointer,state,member);}}
    else{this.debugLogDiagnostic(pointer,()=>'Rejecting: '+member);if(state.eagerWinner===member)state.eagerWinner=null;state.members.splice(state.members.indexOf(member),1);member.rejectGesture(pointer);if(!state.isOpen&&this.arenas.get(pointer)===state)this.tryToResolveArena(pointer,state);}
  }
  private tryToResolveArena(pointer:number,state:GestureArena):void {
    invariant(this.arenas.get(pointer)===state&&!state.isOpen,'invalid-gesture-arena-resolution','Arena identity changed or is still open');
    if(state.members.length===1)void Promise.resolve().then(()=>this.resolveByDefault(pointer,state));else if(state.members.length===0){this.arenas.delete(pointer);this.debugLogDiagnostic(pointer,'Arena empty.');}else if(state.eagerWinner!==null){this.debugLogDiagnostic(pointer,()=>'Eager winner: '+state.eagerWinner);this.resolveInFavorOf(pointer,state,state.eagerWinner);}
  }
  private resolveByDefault(pointer:number,state:GestureArena):void {if(!this.live||this.arenas.get(pointer)!==state)return;invariant(!state.isOpen&&state.members.length===1,'invalid-default-gesture-resolution','Default resolution requires one closed member');this.arenas.delete(pointer);this.debugLogDiagnostic(pointer,()=>'Default winner: '+state.members[0]);state.members[0]!.acceptGesture(pointer);}
  private resolveInFavorOf(pointer:number,state:GestureArena,member:GestureArenaMember):void {invariant(this.arenas.get(pointer)===state&&!state.isOpen&&(state.eagerWinner===null||state.eagerWinner===member),'invalid-gesture-winner','Arena winner or ownership is invalid');this.arenas.delete(pointer);for(const rejected of state.members)if(rejected!==member)rejected.rejectGesture(pointer);member.acceptGesture(pointer);}
  private debugLogDiagnostic(pointer:number,message:string|(()=>string),state?:GestureArena):boolean {if(!FoundationBuildMode.debug)return true;const value=typeof message==='function'?message():message;if(GestureDebug.debugPrintGestureArenaDiagnostics){const count=state?.members.length;debugPrint('Gesture arena '+String(pointer).padEnd(4)+' ❙ '+value+(count===undefined?'':` with ${count} member${count===1?'':'s'}.`));}return true;}
  /** View-owned extension. Ownership is removed before callbacks; every live
   * member receives retirement even if another member throws. */
  cancel(pointer:number):void {const state=this.arenas.get(pointer);if(!state)return;this.arenas.delete(pointer);const errors:unknown[]=[];for(const member of [...state.members])try{member.rejectGesture(pointer);}catch(error){errors.push(error);}if(errors.length)throw new AggregateError(errors,'Gesture arena cancellation failed');}
  dispose():void {if(!this.live)return;this.live=false;const current=[...this.arenas];this.arenas.clear();const errors:unknown[]=[];for(const [pointer,state]of current)for(const member of [...state.members])try{member.rejectGesture(pointer);}catch(error){errors.push(error);}if(errors.length)throw new AggregateError(errors,'Gesture arena retirement failed');}
}
