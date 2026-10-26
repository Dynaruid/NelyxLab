// SPDX-License-Identifier: BSD-3-Clause
import type {TextLayout,TextLayoutInput} from '../ui/types.ts';
import type {ResourceRegistry,ResourceCost} from './resources.ts';
import {invariant} from '../foundation/errors.ts';
import {isCacheableTextInput} from '../ui/text-input-data.ts';
import {ownedTextInputSerialization} from '../ui/text.ts';
import type {ParagraphFont,ParagraphFontSnapshot} from './text-fonts.ts';
import {ParagraphFontCatalog} from './text-fonts.ts';

export const textLayoutCacheLimits=Object.freeze({indexed:128,resident:64,units:65536,bytes:1048576});
interface CachedLayout {readonly layout:TextLayout;readonly units:number;readonly bytes:number;readonly lease:{dispose():void}}
/** Per service, with a separate bounded owner lease for plain immutable text.
 * Logical producers and recorded frames retain their independent lifetimes.
 * Registry close releases every cache owner, including while frames drain. */
export class TextLayoutCache<T extends ParagraphFont=ParagraphFont> {
  private readonly layouts=new Map<string,TextLayout>();
  private readonly cached=new Map<string,CachedLayout>();
  private units=0;private bytes=0;private revision=0;private failed=false;
  private hits=0;private misses=0;private cacheOnlyHits=0;private uncachedSequence=0;
  constructor(private readonly registry:ResourceRegistry,private readonly catalog:ParagraphFontCatalog<T>){catalog.checkRegistry(registry);}
  get debugStats(){return Object.freeze({indexed:this.layouts.size,resident:this.cached.size,units:this.units,bytes:this.bytes,hits:this.hits,misses:this.misses,cacheOnlyHits:this.cacheOnlyHits,failed:this.failed});}
  key(input:TextLayoutInput,fonts:ParagraphFontSnapshot<T>):string{
    invariant(!this.failed,'text-cache-failed','Paragraph cache retirement failed');
    this.catalog.assertCurrent(fonts);const revision=fonts.revision;
    if(this.revision!==revision){this.revision=revision;this.clear();this.catalog.assertCurrent(fonts);}
    // Caller extensions and serialization hooks remain observable by JSON, but
    // do not enter either the live index or the separately owned idle cache.
    let prefix=`${revision}:`;
    const serialized=ownedTextInputSerialization(input);
    if(serialized===undefined&&!isCacheableTextInput(input)){invariant(this.uncachedSequence<Number.MAX_SAFE_INTEGER,'text-cache-key-exhausted','Uncached paragraph key sequence exhausted');prefix+=`~${++this.uncachedSequence}:`;}
    const key=prefix+(serialized===undefined?JSON.stringify([input,this.catalog.keyValues(fonts)]):'['+serialized+','+this.catalog.serialization(fonts)+']');
    this.catalog.assertCurrent(fonts);return key;
  }
  private current(key:string):boolean{const revision=this.revision;return key.startsWith(`${revision}:`)&&this.catalog.captureRevision===revision;}
  /** Admission, including pressure eviction, completes before a producer borrow. */
  reuse(key:string,admit:(retained:TextLayout|undefined)=>void):TextLayout|undefined{
    invariant(!this.failed,'text-cache-failed','Paragraph cache retirement failed');
    invariant(this.current(key),'text-cache-catalog-changed','Paragraph font catalog changed during cache key construction');
    let layout=this.layouts.get(key);
    if(layout&&!this.registry.isRetained(layout.resource)){this.forget(key,layout);layout=undefined;}
    admit(layout);
    invariant(!this.failed,'text-cache-failed','Paragraph cache retirement failed');
    invariant(this.current(key),'text-cache-catalog-changed','Paragraph font catalog changed during admission');
    if(!layout){if(this.misses<Number.MAX_SAFE_INTEGER)this.misses++;return;}
    const cacheOnly=this.cached.has(key)&&this.registry.retainedReferenceCount(layout.resource)===1;
    this.registry.retainInitialProducer(layout.resource);if(this.hits<Number.MAX_SAFE_INTEGER)this.hits++;if(cacheOnly&&this.cacheOnlyHits<Number.MAX_SAFE_INTEGER)this.cacheOnlyHits++;return layout;
  }
  remember(key:string,layout:TextLayout,cost:ResourceCost,keep=true):void{
    invariant(!this.failed,'text-cache-failed','Paragraph cache retirement failed');
    invariant(Number.isSafeInteger(cost.units)&&cost.units>=0&&Number.isSafeInteger(cost.bytes)&&cost.bytes>=0,'invalid-text-cache-cost','Paragraph cache costs must be nonnegative safe integers');
    if(!this.current(key)||key.startsWith(`${this.revision}:~`))return;
    const previous=this.layouts.get(key);if(previous===layout)return;if(previous)this.forget(key,previous);
    if(this.layouts.size>=textLayoutCacheLimits.indexed){const oldest=this.layouts.entries().next().value!;this.forget(oldest[0],oldest[1]);}
    const bytes=cost.bytes+key.length*2,input=layout.input;
    const plain=keep&&!input.style?.foreground&&!input.style?.background&&!input.runs?.some(run=>run.style.foreground!==undefined||run.style.background!==undefined);
    const cacheable=keep&&plain&&cost.units<=textLayoutCacheLimits.units&&bytes<=textLayoutCacheLimits.bytes;
    if(cacheable)while(this.cached.size>=textLayoutCacheLimits.resident||this.units+cost.units>textLayoutCacheLimits.units||this.bytes+bytes>textLayoutCacheLimits.bytes)this.releaseCached(this.cached.keys().next().value!);
    // Retirement may reenter and change the catalog. The caller's constructed
    // paragraph stays valid, but must not enter a newer catalog's index.
    if(!this.current(key))return;
    this.layouts.set(key,layout);
    if(cacheable){const lease=this.registry.retainProducer(layout.resource);this.cached.set(key,{layout,units:cost.units,bytes,lease});this.units+=cost.units;this.bytes+=bytes;}
  }
  /** Idle owners can leave; recorded frames continue charging residency. */
  trimIdle(except?:TextLayout):void{
    const errors:unknown[]=[];
    for(const [key,value]of [...this.cached])if(value.layout!==except&&this.registry.initialProducerCount(value.layout.resource)===0&&this.cached.get(key)===value)try{this.releaseCached(key);}catch(error){errors.push(error);}
    this.throwFailures(errors);
  }
  forget(key:string,layout:TextLayout):void{if(this.layouts.get(key)===layout)this.layouts.delete(key);if(this.cached.get(key)?.layout===layout)this.releaseCached(key);}
  private releaseCached(key:string):void{
    const value=this.cached.get(key);if(!value)return;this.cached.delete(key);this.units-=value.units;this.bytes-=value.bytes;
    try{value.lease.dispose();}catch(error){this.failed=true;throw error;}
  }
  private clear():void{
    const values=[...this.cached.values()];this.layouts.clear();this.cached.clear();this.units=0;this.bytes=0;const errors:unknown[]=[];
    for(const value of values)try{value.lease.dispose();}catch(error){errors.push(error);}
    this.throwFailures(errors);
  }
  private throwFailures(errors:unknown[]):void{if(!errors.length)return;this.failed=true;if(errors.length===1)throw errors[0];throw new AggregateError(errors,'Paragraph cache retirement failed');}
}
