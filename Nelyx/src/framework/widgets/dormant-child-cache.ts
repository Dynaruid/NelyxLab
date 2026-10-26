// SPDX-License-Identifier: BSD-3-Clause
import type {Element} from './framework.ts';
import {GlobalKey,isFrameworkAnchorKey} from './global-key.ts';
import type {ResourceRegistry} from '../../hosting/resources.ts';
import {invariant} from '../../foundation/errors.ts';

export const dormantChildLimits=Object.freeze({children:32,elements:4096});
interface DormantRecord {readonly owner:Element;readonly index:number;readonly root:Element;readonly elements:number}
/** The cache records policy over the BuildOwner's canonical inactive roots.
 * It never owns a second Element or render tree and never recycles identities. */
export interface DormantChildHost {
  readonly resources:ResourceRegistry;
  canRetain(root:Element):boolean;
  retire(root:Element):void;
  activate(root:Element,parent:Element,slot:unknown):void;
}
export class DormantChildCache {
  private readonly owners=new Map<Element,Map<number,DormantRecord>>();
  private readonly records=new Map<Element,DormantRecord>();
  private elements=0;private peakElements=0;private hits=0;private evictions=0;private closed=false;
  private readonly pressureLease:{dispose():void};
  constructor(private readonly host:DormantChildHost){this.pressureLease=host.resources.addOptionalResourceReclaimer(()=>this.trim());}
  get debugStats(){return Object.freeze({children:this.records.size,elements:this.elements,peakElements:this.peakElements,hits:this.hits,evictions:this.evictions});}
  has(root:Element):boolean{return this.records.has(root);}
  peek(owner:Element,index:number):Element|undefined{return this.owners.get(owner)?.get(index)?.root;}
  retainedRoot(element:Element):Element|undefined{if(!this.records.size)return;let root=element;while(root.parent)root=root.parent;return this.records.has(root)?root:undefined;}
  /** A GlobalKey retake extracts its actual Element first. Retire the obsolete
   * remainder, or transfer the whole root without disposing its moved State. */
  releaseRetaken(root:Element,moved:Element):void{const record=this.records.get(root);if(!record)return;if(root===moved)this.unlink(record);else this.evict(record);}
  private eligibleElements(root:Element):number{
    const pending=[root];let count=0;
    while(pending.length){const element=pending.pop()!,key=element.widget.key;if(key instanceof GlobalKey&&!isFrameworkAnchorKey(key)||++count>dormantChildLimits.elements)return 0;
      if(count+pending.length+element.children.length>dormantChildLimits.elements)return 0;for(const child of element.children)pending.push(child);
    }
    return count;
  }
  private unlink(record:DormantRecord):void{
    this.records.delete(record.root);const owned=this.owners.get(record.owner)!;owned.delete(record.index);if(!owned.size)this.owners.delete(record.owner);this.elements-=record.elements;
  }
  private evict(record:DormantRecord):void{this.unlink(record);this.evictions++;this.host.retire(record.root);}
  /** Admission follows detach/deactivate. Application GlobalKey descendants
   * keep their ordinary frame-end retake window. Private framework anchors
   * retain their registry ownership and invalidate the row if extracted. */
  retain(owner:Element,index:number,root:Element,capacity:number):boolean{
    invariant(!this.closed&&Number.isSafeInteger(capacity)&&capacity>0&&capacity<=dormantChildLimits.children&&Number.isSafeInteger(index)&&index>=0&&owner.active&&!this.records.has(root),'invalid-dormant-capacity','Dormant capacity/slot and root ownership must be valid');
    if(!this.host.canRetain(root))return false;const elements=this.eligibleElements(root);if(!elements)return false;
    const previous=this.owners.get(owner)?.get(index);if(previous)this.evict(previous);
    while((this.owners.get(owner)?.size??0)>=capacity||this.records.size>=dormantChildLimits.children||this.elements+elements>dormantChildLimits.elements){
      const victim=(this.owners.get(owner)?.size??0)>=capacity?this.owners.get(owner)!.values().next().value:this.records.values().next().value;
      invariant(victim,'missing-dormant-victim','Dormant accounting has no eviction owner');this.evict(victim);
    }
    if(this.closed||!this.host.canRetain(root)||!owner.active)return false;
    const record={owner,index,root,elements},owned=this.owners.get(owner)??new Map<number,DormantRecord>();
    owned.set(index,record);this.owners.set(owner,owned);this.records.set(root,record);this.elements+=elements;this.peakElements=Math.max(this.peakElements,this.elements);return true;
  }
  /** The sliver validates the freshly built Widget before transferring a root.
   * Unlink before activate: a lifecycle callback may synchronously trim caches. */
  take(owner:Element,index:number,parent:Element,slot:unknown):Element|undefined{
    invariant(!this.closed,'closed-dormant-cache','Dormant cache is closed');const record=this.owners.get(owner)?.get(index);if(!record)return;
    this.unlink(record);this.host.activate(record.root,parent,slot);this.hits++;return record.root;
  }
  evictAt(owner:Element,index:number):void{const record=this.owners.get(owner)?.get(index);if(record)this.evict(record);}
  trimOwner(owner:Element,capacity=0):void{const errors:unknown[]=[];while((this.owners.get(owner)?.size??0)>capacity){const record=this.owners.get(owner)!.values().next().value!;try{this.evict(record);}catch(error){errors.push(error);}}if(errors.length)throw new AggregateError(errors,'Dormant owner retirement failed');}
  trim():void{const errors:unknown[]=[];for(const record of [...this.records.values()])if(this.records.has(record.root))try{this.evict(record);}catch(error){errors.push(error);}if(errors.length)throw new AggregateError(errors,'Dormant cache retirement failed');}
  dispose():void{if(this.closed)return;this.closed=true;this.pressureLease.dispose();this.trim();}
}
