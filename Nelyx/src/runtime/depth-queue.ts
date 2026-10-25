// SPDX-License-Identifier: BSD-3-Clause
import {invariant} from '../foundation/errors.ts';

/** Internal queue metadata lives on the existing owner record. No entry object,
 * duplicate membership Map or stale heap node is allocated for each rebuild. */
export interface DepthQueueRecord {
  readonly depth:number;
  _buildQueueIndex:number;
  _buildQueueDepth:number;
  _buildQueueOrder:number;
}
export class DepthQueue<T extends DepthQueueRecord> {
  private readonly heap:T[]=[];
  private order=0;
  get size():number{return this.heap.length;}
  private before(a:T,b:T):boolean{return a._buildQueueDepth<b._buildQueueDepth||a._buildQueueDepth===b._buildQueueDepth&&a._buildQueueOrder<b._buildQueueOrder;}
  private up(index:number,record:T):void{
    while(index){const parent=(index-1)>>1,value=this.heap[parent]!;if(!this.before(record,value))break;this.heap[index]=value;value._buildQueueIndex=index;index=parent;}
    this.heap[index]=record;record._buildQueueIndex=index;
  }
  private down(index:number,record:T):void{
    while(index*2+1<this.heap.length){let child=index*2+1;if(child+1<this.heap.length&&this.before(this.heap[child+1]!,this.heap[child]!))child++;const value=this.heap[child]!;if(!this.before(value,record))break;this.heap[index]=value;value._buildQueueIndex=index;index=child;}
    this.heap[index]=record;record._buildQueueIndex=index;
  }
  schedule(record:T):void{
    const index=record._buildQueueIndex;
    if(index>=0){if(!(this.heap[index]===record))invariant(false,'foreign-depth-record','Dirty record belongs to another queue');if(record._buildQueueDepth===record.depth)return;}
    if(this.order===Number.MAX_SAFE_INTEGER){if(this.heap.length)invariant(false,'depth-order-overflow','Dirty queue order exhausted');this.order=0;}
    record._buildQueueDepth=record.depth;record._buildQueueOrder=++this.order;
    if(index<0){this.heap.push(record);this.up(this.heap.length-1,record);}
    else if(index>0&&this.before(record,this.heap[(index-1)>>1]!))this.up(index,record);else this.down(index,record);
  }
  remove(record:T):void{
    const index=record._buildQueueIndex;if(!(index>=0&&this.heap[index]===record))invariant(false,'foreign-depth-record','Dirty record is not queued here');
    const last=this.heap.pop()!;record._buildQueueIndex=-1;
    if(index<this.heap.length){if(index>0&&this.before(last,this.heap[(index-1)>>1]!))this.up(index,last);else this.down(index,last);}
  }
  pop():T|undefined{const record=this.heap[0];if(record)this.remove(record);return record;}
}
