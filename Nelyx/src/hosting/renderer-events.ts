import type {Disposable} from '../foundation/disposable.ts';
import type {FrameBuildToken, RendererNotification, ViewOwner} from '../ui/types.ts';
import {captureMetrics, sameOwner} from '../ui/frame.ts';
import {invariant} from '../foundation/errors.ts';

/** Bounded observation only. Native adapters still own leases and drain. */
export class RendererEvents {
  private listeners=new Set<(event:RendererNotification)=>void>();
  private pending=new Map<number,FrameBuildToken>();
  private stopped=false;
  constructor(private owner:ViewOwner,readonly capacity=2){this.owner=Object.freeze({...owner});invariant(Number.isSafeInteger(capacity)&&capacity>0,'invalid-capacity','renderer event capacity');}
  subscribe(listener:(event:RendererNotification)=>void):Disposable {
    invariant(!this.stopped && this.listeners.size<32,'closed','renderer observation closed or subscriber budget exhausted');
    this.listeners.add(listener);return {dispose:()=>{this.listeners.delete(listener);}};
  }
  accepted(submission:number,token:FrameBuildToken):void {
    invariant(Number.isSafeInteger(submission)&&submission>0&&!this.pending.has(submission)&&this.pending.size<this.capacity,'invalid-submission','duplicate/invalid submission or notification capacity');
    invariant(sameOwner(this.owner,token.owner),'stale-owner','renderer event owner mismatch');
    invariant(Number.isSafeInteger(token.sequence)&&token.sequence>0,'invalid-submission','renderer frame sequence');
    const snapshot=Object.freeze({owner:Object.freeze({...token.owner}),metrics:captureMetrics(token.metrics),sequence:token.sequence});
    this.pending.set(submission,snapshot);this.publish(Object.freeze({kind:'submitted',submission,token:snapshot}));
  }
  retired(submission:number,result:Extract<RendererNotification,{kind:'retired'}>['result']):void {
    const token=this.pending.get(submission);invariant(token,'invalid-submission','unknown/duplicate retirement');
    this.pending.delete(submission);this.publish(Object.freeze({kind:'retired',submission,token,result}));
  }
  failed(submission:number,reason:string):void {
    const token=this.pending.get(submission);invariant(token,'invalid-submission','unknown failed submission');
    this.publish(Object.freeze({kind:'failed',submission,token,reason:reason.slice(0,512)}));
  }
  /** Stop callbacks synchronously; retain pending identities until the adapter drains. */
  stop():void {this.stopped=true;this.listeners.clear();}
  drain():void {this.stop();this.pending.clear();}
  private publish(event:RendererNotification):void {
    if(this.stopped)return;
    for(const listener of [...this.listeners]){
      if(!this.listeners.has(listener))continue;
      try{listener(event);}catch{this.listeners.delete(listener);}
    }
  }
}
