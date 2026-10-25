// SPDX-License-Identifier: BSD-3-Clause
import {invariant} from '../foundation/errors.ts';

/** A View owns the pending work; records remain their existing public owners.
 * Admission never walks ancestors or creates a second mutable tree. A failed
 * commit remains pending, while successful siblings are retired exactly once.
 * Work admitted by a commit belongs to the next boundary, avoiding reentrant
 * callbacks and an unbounded drain inside a user extension. */
export class OwnerTransaction<T extends {readonly depth:number}> {
  private readonly pending=new Set<T>();
  private committing=false;
  private closed=false;
  constructor(private readonly commitOwner:(owner:T)=>void){}
  get hasPending():boolean{return this.pending.size!==0;}
  schedule(owner:T):void{invariant(!this.closed,'closed-owner-transaction','Cannot schedule a retired owner transaction');this.pending.add(owner);}
  forget(owner:T):void{this.pending.delete(owner);}
  dispose():void{this.closed=true;this.pending.clear();}
  commit():void{
    if(!this.pending.size)return;
    invariant(!this.committing,'reentrant-owner-commit','Owner transactions cannot recursively commit');
    // Children commit before parents, preserving the extension hook order.
    const batch=[...this.pending];if(batch.length>1)batch.sort((a,b)=>b.depth-a.depth);
    this.committing=true;let errors:unknown[]|undefined;
    try{
      for(const owner of batch){
        if(!this.pending.delete(owner))continue;
        try{this.commitOwner(owner);}catch(error){if(!this.closed)this.pending.add(owner);(errors??=[]).push(error);}
      }
    }finally{this.committing=false;}
    if(errors?.length===1)throw errors[0];
    if(errors)throw new AggregateError(errors,'Owner transaction commit failed');
  }
}
