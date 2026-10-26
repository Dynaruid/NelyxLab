// SPDX-License-Identifier: BSD-3-Clause
import {invariant} from '../../foundation/errors.ts';
import type {ResourceRegistry} from '../../hosting/resources.ts';
import {textLimits} from '../../ui/text.ts';
import type {Element} from './framework.ts';
import type {FrameTiming} from '../../foundation/clock.ts';

/** Opt-in State retention. Dormant rows deactivate; user timers remain the
 * State's responsibility and framework tickers resume with elapsed wall time. */
export type SliverChildPolicy='legacy'|{readonly mode:'bounded';readonly preparation?:'disabled'|'observed-budget'}|{readonly mode:'dormant';readonly capacity:number};
export function normalizeSliverChildPolicy(value:SliverChildPolicy|undefined):SliverChildPolicy{
 if(value===undefined||value==='legacy')return 'legacy';
 if(value!==null&&typeof value==='object'&&value.mode==='dormant'){
  invariant(Number.isSafeInteger(value.capacity)&&value.capacity>0&&value.capacity<=32,'invalid-dormant-capacity','Dormant capacity must be in 1..32');return Object.freeze({mode:'dormant',capacity:value.capacity});
 }
 invariant(value!==null&&typeof value==='object'&&value.mode==='bounded'&&(value.preparation===undefined||value.preparation==='disabled'||value.preparation==='observed-budget'),'invalid-sliver-child-policy','Choose legacy or bounded with disabled/observed-budget preparation');
 return Object.freeze({mode:'bounded',preparation:value.preparation??'disabled'});
}
export const viewChildBudgetLimits=Object.freeze({perSliver:8,children:16,elements:2048});
interface ChildRecord {
 readonly owner:Element;readonly requestLayout:()=>void;root:Element|undefined;
 elements:number;charged:boolean;retiring:boolean;evictionRequested:boolean;preparedRoot:Element|undefined;
}
/** @internal A request only dirties its real sliver. Root owns both layout passes. */
export interface OptionalChildCandidate {readonly owner:Element;readonly estimatedMs:number;readonly elements:number;readonly valid:()=>boolean;readonly request:()=>void;readonly finish:()=>void}
/** Non-owning bookkeeping over the canonical Element/adaptor owners.
 * Counts follow actual mount/unmount/activation; no subtree census or leases. */
export class ViewWorkBudget {
 private readonly membership=new WeakMap<Element,ChildRecord>();
 private readonly records=new Set<ChildRecord>();
 private readonly optional=new Set<ChildRecord>();
 private readonly candidates=new Map<Element,OptionalChildCandidate>();
 private preparationAvailable=false;private preparedPasses=0;private preparationMs=0;private preparationOverruns=0;private lastPreparationTick:number|undefined;
 private retainedHits=0;private preparedChildren=0;private preparationHits=0;private preparationMisses=0;private cancelledCandidates=0;
 private scope:{parent:Element;record:ChildRecord}|undefined;
 private tracked=0;private chargedElements=0;private peakChargedElements=0;private atomicOverruns=0;
 constructor(private readonly resources:ResourceRegistry){}
 get debugStats(){return Object.freeze({trackedElements:this.tracked,optionalChildren:this.optional.size,optionalElements:this.chargedElements,peakOptionalElements:this.peakChargedElements,atomicElementOverruns:this.atomicOverruns,retainedHits:this.retainedHits,automaticPreparation:this.preparationAvailable?'available':'unavailable',preparedPasses:this.preparedPasses,preparedChildren:this.preparedChildren,preparationHits:this.preparationHits,preparationMisses:this.preparationMisses,cancelledCandidates:this.cancelledCandidates,preparationMs:this.preparationMs,preparationOverruns:this.preparationOverruns,resources:this.resources.accountedTotals});}
 private change(element:Element,next:ChildRecord|undefined):void{
  const previous=this.membership.get(element);if(previous===next)return;
  if(previous){this.membership.delete(element);previous.elements--;this.tracked--;if(previous.charged)this.chargedElements--;if(previous.preparedRoot===element){this.preparationMisses++;previous.preparedRoot=undefined;}if(previous.elements===0){this.optional.delete(previous);this.records.delete(previous);previous.charged=false;}}
  if(next){this.records.add(next);this.membership.set(element,next);next.elements++;this.tracked++;if(next.charged){this.chargedElements++;this.peakChargedElements=Math.max(this.peakChargedElements,this.chargedElements);if(this.chargedElements===viewChildBudgetLimits.elements+1)this.atomicOverruns++;if(this.chargedElements>viewChildBudgetLimits.elements)this.requestEviction(next);}if(element.parent===next.owner)next.root=element;}
 }
 private parentRecord(element:Element):ChildRecord|undefined{
  if(this.scope&&this.scope.parent===element.parent)return this.scope.record;
  const previous=this.membership.get(element);
  // Moving a whole sliver within its View preserves its own row boundaries.
  // A GlobalKey moved out of a row follows its new parent's actual membership.
  if(previous?.root===element&&previous.owner===element.parent){invariant(!this.membership.has(previous.owner),'nested-bounded-sliver','Nested bounded slivers are not supported');return previous;}
  return element.parent?this.membership.get(element.parent):undefined;
 }
 register(element:Element):void{this.change(element,this.parentRecord(element));}
 activate(element:Element):void{this.change(element,this.parentRecord(element));}
 unregister(element:Element):void{this.change(element,undefined);}
 /** Scope covers the real synchronous reconcile/build, including failed mounts. */
 withChild<T>(parent:Element,previous:Element|undefined,requestLayout:()=>void,perform:()=>T):T{
  invariant(!this.membership.has(parent),'nested-bounded-sliver','Nested bounded slivers are not supported; keep the inner policy legacy');
  let record=previous?this.membership.get(previous):undefined;
  if(!record||record.owner!==parent||record.root!==previous)record=undefined;
  if(!record){record={owner:parent,requestLayout,root:undefined,elements:0,charged:false,retiring:false,evictionRequested:false,preparedRoot:undefined};this.records.add(record);}
  // Enabling the policy on an existing row needs one initial census. Ordinary
  // scrolling and later updates use only the lifecycle deltas above.
  const old=this.scope;try{if(previous?.parent===parent&&!this.membership.has(previous)){
   const pending=[previous],elements:Element[]=[];while(pending.length){const element=pending.pop()!;invariant(!this.membership.has(element),'nested-bounded-sliver','Cannot enable bounded retention around another bounded owner');elements.push(element);pending.push(...element.children);}
   for(const element of elements)this.change(element,record);
  }
  this.scope={parent,record};return perform();}finally{this.scope=old;if(record.elements===0)this.records.delete(record);}
 }
 private record(root:Element):ChildRecord|undefined{const record=this.membership.get(root);return record?.root===root?record:undefined;}
 required(root:Element,consumed=true):void{const record=this.record(root);if(!record)return;if(consumed){if(record.charged)this.retainedHits++;if(record.preparedRoot===root){this.preparationHits++;record.preparedRoot=undefined;}}if(record.charged){this.chargedElements-=record.elements;this.optional.delete(record);record.charged=false;}record.retiring=false;record.evictionRequested=false;}
 didPrepare(root:Element):void{const record=this.record(root);if(record&&record.preparedRoot===undefined){record.preparedRoot=root;this.preparedChildren++;}}
 forget(root:Element):void{const record=this.record(root);if(record)record.retiring=true;}
 private get pressure():boolean{const value=this.resources.accountedTotals;return value.resident>=textLimits.retainedResources||value.residentUnits>=textLimits.retainedUnits||value.residentBytes>=textLimits.retainedInputBytes||value.producerUnits>=textLimits.producerUnits||value.producerBytes>=textLimits.producerInputBytes;}
 private requestEviction(record:ChildRecord):boolean{if(record.evictionRequested||record.retiring)return false;record.evictionRequested=true;record.requestLayout();return true;}
 retain(root:Element):boolean{
  const record=this.record(root);if(!record||record.retiring||record.evictionRequested||record.elements===0||record.elements>viewChildBudgetLimits.elements)return false;
  if(record.charged)return true;
  const owned=[...this.optional].filter(value=>value.owner===record.owner).length;
  if(this.pressure||owned>=viewChildBudgetLimits.perSliver||this.optional.size>=viewChildBudgetLimits.children||this.chargedElements+record.elements>viewChildBudgetLimits.elements){
   const victim=[...this.optional].find(value=>!value.retiring&&!value.evictionRequested&&(owned<viewChildBudgetLimits.perSliver||value.owner===record.owner));if(victim)this.requestEviction(victim);return false;
  }
  record.charged=true;this.optional.add(record);this.chargedElements+=record.elements;this.peakChargedElements=Math.max(this.peakChargedElements,this.chargedElements);return true;
 }
 retained(root:Element):boolean{const record=this.record(root);return !!record?.charged&&!record.retiring&&!record.evictionRequested;}
 evictOwner(owner:Element):void{for(const record of this.optional)if(record.owner===owner)this.requestEviction(record);}
 /** Called at the canonical frame boundary, never from native retirement. */
 enforcePressure():boolean{let requested=false;if(this.pressure)for(const record of this.optional)requested=this.requestEviction(record)||requested;return requested;}
 scheduleEvictions():boolean{let pending=false;for(const record of this.optional)if(record.evictionRequested&&!record.retiring){record.requestLayout();pending=true;}return pending;}
 estimateElements(owner:Element):number{let maximum=0;for(const record of this.records)if(record.owner===owner)maximum=Math.max(maximum,record.elements);return maximum;}
 setCandidate(candidate:OptionalChildCandidate):void{if(this.candidates.has(candidate.owner))this.cancelledCandidates++;this.candidates.set(candidate.owner,candidate);}
 cancelOwner(owner:Element):void{if(this.candidates.delete(owner))this.cancelledCandidates++;}
 cancelPreparation():void{this.cancelledCandidates+=this.candidates.size;this.candidates.clear();}
 private capacity(candidate:OptionalChildCandidate):boolean{return candidate.elements>0&&candidate.elements<=viewChildBudgetLimits.elements&&!this.pressure&&this.optional.size<viewChildBudgetLimits.children&&this.chargedElements+candidate.elements<=viewChildBudgetLimits.elements&&[...this.optional].filter(record=>record.owner===candidate.owner).length<viewChildBudgetLimits.perSliver;}
 /** At most one non-preemptible item per existing host tick. All required
  * PipelineOwners have converged before Root calls this method. */
 runOptional(timing:FrameTiming|undefined,now:()=>number,allowed:()=>boolean,layout:()=>void,requestFrame:()=>void):void{
  const deadline=timing?.observedDeadline;
  this.preparationAvailable=Number.isFinite(deadline)&&Number.isFinite(timing?.tick)&&Number.isFinite(timing?.queueDelay)&&timing!.queueDelay>=0&&Number.isFinite(timing?.clockUncertainty)&&timing!.clockUncertainty>=0;
  if(!this.preparationAvailable)return;
  if(!allowed()){this.cancelPreparation();return;}
  const fits=(candidate:OptionalChildCandidate)=>candidate.valid()&&Number.isFinite(candidate.estimatedMs)&&candidate.estimatedMs>=0&&candidate.estimatedMs<=2&&this.capacity(candidate)&&now()+candidate.estimatedMs+4+timing!.queueDelay+timing!.clockUncertainty<=deadline!;
  let selected:OptionalChildCandidate|undefined;
  for(const [owner,candidate]of this.candidates){if(!candidate.valid()){this.cancelOwner(owner);continue;}if(fits(candidate)){selected=candidate;break;}}
  if(!selected||this.lastPreparationTick===timing!.tick)return;this.lastPreparationTick=timing!.tick;this.candidates.delete(selected.owner);const started=now(),errors:unknown[]=[];
  try{selected.request();layout();}catch(error){errors.push(error);}
  finally{try{selected.finish();layout();}catch(error){errors.push(error);}const elapsed=now()-started;this.preparedPasses++;this.preparationMs+=elapsed;if(elapsed>2)this.preparationOverruns++;}
  if(errors.length===1)throw errors[0];if(errors.length)throw new AggregateError(errors,'Optional layout and mandatory restoration failed');
  if(!allowed()){this.cancelPreparation();return;}
  if([...this.candidates.values()].some(fits))requestFrame();
 }
 assertDrained():void{invariant(this.tracked===0&&this.chargedElements===0&&this.records.size===0&&this.optional.size===0&&this.candidates.size===0,'sliver-budget-not-drained','View child accounting survived actual tree teardown');}
}
