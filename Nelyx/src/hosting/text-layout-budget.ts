// SPDX-License-Identifier: BSD-3-Clause
import {ResourceAccounting} from './resources.ts';
import type {ResourceRegistry,ResourceAccountingRegistration} from './resources.ts';
import {admitAccountedTextLayoutResources,textLimits} from '../ui/text.ts';
import type {TextInputCost} from '../ui/text.ts';
import {invariant} from '../foundation/errors.ts';
import type {TextLayout,TextLayoutInput,TextLayoutRequest} from '../ui/types.ts';

/** One service's costs follow actual logical producers and native retirement.
 * Identity tokens distinguish exact layouts even if a resource ID is reused;
 * the sidecar holds no paragraph, callback, resource body or additional lease. */
export class TextLayoutBudget {
  private readonly accounting:ResourceAccounting;
  private readonly identities=new WeakMap<TextLayout,object>();
  private readonly admittedCosts=new WeakMap<TextLayoutInput,TextInputCost>();
  constructor(registry:ResourceRegistry){this.accounting=new ResourceAccounting(registry);}
  registration(layout:TextLayout,admitted:TextLayoutInput=layout.input):ResourceAccountingRegistration{
    const identity=this.identities.get(layout)??{},cost=this.admittedCosts.get(admitted);
    invariant(cost,'unadmitted-text-layout','Paragraph registration requires its admitted input');
    this.identities.set(layout,identity);
    return {owner:this.accounting,identity,cost};
  }
  private snapshot(request:TextLayoutRequest,retained?:TextLayout){
    const replacing=request.replacing,identity=replacing&&this.identities.get(replacing);
    const previous=identity?this.accounting.record(replacing!.resource,identity):undefined;
    const retainedIdentity=retained&&this.identities.get(retained);
    const reuse=retainedIdentity?this.accounting.record(retained!.resource,retainedIdentity):undefined;
    return {...this.accounting.totals,replacement:previous&&previous.producers>0?previous:undefined,reusing:reuse!==undefined};
  }
  admit(input:TextLayoutInput,request:TextLayoutRequest={},retained?:TextLayout,cache?:{trimIdle(except?:TextLayout):void}):void{
    // Never read fields of a foreign/Proxy layout just to reject its identity.
    // Cost serialization may run caller toJSON code. Read live counts afterward,
    // just as the iterable admission path does, before checking any limit.
    const cost=admitAccountedTextLayoutResources(candidate=>{
      let state=this.snapshot(request,retained);const added=state.reusing?0:1;
      if(cache&&(state.resident+added>textLimits.retainedResources||state.residentUnits+candidate.units*added>textLimits.retainedUnits||state.residentBytes+candidate.bytes*added>textLimits.retainedInputBytes)){
        cache.trimIdle(retained);state=this.snapshot(request,retained);
      }
      return state;
    },input,request,retained);
    this.admittedCosts.set(input,cost);
  }
}
