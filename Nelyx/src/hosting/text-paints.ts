// SPDX-License-Identifier: BSD-3-Clause
import {invariant} from '../foundation/errors.ts';
import {resourceKey} from '../ui/frame.ts';
import {textPaintResources} from '../ui/text-builder.ts';
import type {TextLayoutInput} from '../ui/types.ts';
import type {ResourceHold} from '../ui/resource-retention.ts';
import type {ResourceRegistry} from './resources.ts';
/** Paragraph paints may keep an image alive after its UI producer is released. */
export class TextPaintResources {
  private readonly holds:ResourceHold[]=[];
  constructor(registry:ResourceRegistry,input:TextLayoutInput){
    try{const resources=textPaintResources(input);for(const resource of resources)invariant(registry.has(resource),'stale-resource','Text paint image is foreign or retired');for(const resource of new Map(resources.map(value=>[resourceKey(value),value])).values())this.holds.push(registry.retainProducer(resource));}
    catch(error){try{this.dispose();}catch(failure){throw new AggregateError([error,failure],'Text paint resource admission/rollback failed');}throw error;}
  }
  dispose():void{const errors:unknown[]=[];for(const hold of this.holds.splice(0))try{hold.dispose();}catch(error){errors.push(error);}if(errors.length===1)throw errors[0];if(errors.length)throw new AggregateError(errors,'Text paint resource retirement failed');}
}
