// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
import {GestureArenaEntry,GestureDisposition} from './arena.ts';
import type {GestureArenaManager,GestureArenaMember} from './arena.ts';
import {invariant} from '../../foundation/errors.ts';
class CombiningGestureArenaEntry extends GestureArenaEntry {
  constructor(combiner:CombiningGestureArenaMember,member:GestureArenaMember){super(disposition=>combiner.resolve(member,disposition));}
}
class CombiningGestureArenaMember implements GestureArenaMember {
  private readonly members:GestureArenaMember[]=[];private resolved=false;private winner:GestureArenaMember|null=null;private entry:GestureArenaEntry|null=null;
  constructor(private readonly owner:GestureArenaTeam,private readonly pointer:number){}
  acceptGesture(pointer:number):void {invariant(pointer===this.pointer&&(this.winner!==null||this.members.length>0),'invalid-team-winner','Team pointer/winner is invalid');this.close();this.winner??=this.owner.captain??this.members[0]!;for(const member of this.members)if(member!==this.winner)member.rejectGesture(pointer);this.winner.acceptGesture(pointer);}
  rejectGesture(pointer:number):void {invariant(pointer===this.pointer,'invalid-team-pointer','Team pointer changed');this.close();const errors:unknown[]=[];for(const member of this.members)try{member.rejectGesture(pointer);}catch(error){errors.push(error);}if(errors.length)throw new AggregateError(errors,'Gesture team rejection failed');}
  private close():void {invariant(!this.resolved,'resolved-gesture-team','Team has already resolved');this.resolved=true;this.owner.removeCombiner(this.pointer,this);}
  add(pointer:number,member:GestureArenaMember):GestureArenaEntry {invariant(!this.resolved&&pointer===this.pointer,'invalid-gesture-team-entry','Team resolved or pointer changed');this.members.push(member);try{this.entry??=this.owner.arena.add(pointer,this);}catch(error){this.members.pop();if(!this.members.length)this.close();throw error;}return new CombiningGestureArenaEntry(this,member);}
  resolve(member:GestureArenaMember,disposition:GestureDisposition):void {if(this.resolved)return;invariant(this.members.includes(member),'resolved-team-member','This member has left the team');if(disposition===GestureDisposition.accepted){this.winner??=this.owner.captain??member;this.entry!.resolve(disposition);}else{this.members.splice(this.members.indexOf(member),1);member.rejectGesture(this.pointer);if(!this.members.length)this.entry!.resolve(disposition);}}
  retire():void {if(this.resolved)return;try{this.entry!.resolve(GestureDisposition.rejected);}finally{if(!this.resolved)this.rejectGesture(this.pointer);}}
}
/** A team competes through the actual supplied owner arena. No process
 * GestureBinding singleton or separate competition manager is invented. */
export class GestureArenaTeam {
  captain:GestureArenaMember|null=null;private readonly combiners=new Map<number,CombiningGestureArenaMember>();private live=true;
  constructor(readonly arena:GestureArenaManager){}
  add(pointer:number,member:GestureArenaMember):GestureArenaEntry {invariant(this.live,'closed-gesture-team','Gesture team owner is closed');let combiner=this.combiners.get(pointer);if(!combiner){combiner=new CombiningGestureArenaMember(this,pointer);this.combiners.set(pointer,combiner);}return combiner.add(pointer,member);}
  /** @internal Exact combiner identity protects a reused pointer owner. */
  removeCombiner(pointer:number,combiner:CombiningGestureArenaMember):void {invariant(this.combiners.get(pointer)===combiner,'invalid-team-owner','Team combiner ownership changed');this.combiners.delete(pointer);}
  dispose():void {if(!this.live)return;this.live=false;const errors:unknown[]=[];for(const combiner of [...this.combiners.values()])try{combiner.retire();}catch(error){errors.push(error);}if(errors.length)throw new AggregateError(errors,'Gesture team retirement failed');}
}
