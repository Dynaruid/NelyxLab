// SPDX-License-Identifier: BSD-3-Clause
import type {ResourceId} from '../ui/types.ts';import {resourceKey} from '../ui/frame.ts';
import type {ResourceRegistry,ResourceLease} from './resources.ts';import {invariant} from '../foundation/errors.ts';
export interface ParagraphFont {readonly resource:ResourceId;readonly family:string;readonly sourceBytes?:number}
export interface FontProviderLease<T,P> {readonly provider:P;readonly fonts:readonly T[];readonly families:readonly string[];release():void}
interface Entry<T,P>{provider:P;fonts:readonly T[];families:readonly string[];lease:ResourceLease;retire():void;references:number;sourceBytes:number}
/** One app registry, shared providers for live paragraphs; no idle producer/cache. */
export class ParagraphFontProviders<T extends ParagraphFont,P> {
  private readonly entries=new Map<string,Entry<T,P>>();private failed=false;private bytes=0;
  constructor(private readonly resources:ResourceRegistry,private readonly fonts:()=>Iterable<T>,private readonly create:(fonts:readonly T[])=>{provider:P;retire():void}){}
  acquire(primary:ResourceId):FontProviderLease<T,P>{
    invariant(!this.failed,'font-provider-failed','Paragraph font provider retirement failed');
    const fonts=Object.freeze([...this.fonts()].filter(font=>this.resources.has(font.resource))),key=JSON.stringify(fonts.map(font=>[font.resource.id,font.resource.generation,font.family,font.sourceBytes??0]));
    invariant(fonts.length>0&&fonts.length<=64&&fonts.some(font=>resourceKey(font.resource)===resourceKey(primary)),'stale-font','Primary paragraph font is not declared in this app registry');
    invariant(fonts.every(font=>Number.isSafeInteger(font.sourceBytes??0)&&(font.sourceBytes??0)>=0),'font-provider-budget','Invalid font backing-source byte count');
    let entry=this.entries.get(key);if(!entry){const sourceBytes=fonts.reduce((n,font)=>n+(font.sourceBytes??0),0);invariant(Number.isSafeInteger(sourceBytes)&&sourceBytes>=0&&this.bytes+sourceBytes<=128*1024*1024,'font-provider-budget','Live paragraph font providers exceed128MiB backing-source budget');const lease=this.resources.acquire(fonts.map(f=>f.resource));let created:{provider:P;retire():void};try{created=this.create(fonts);}catch(error){lease.returnBy('caller');throw error;}entry={...created,fonts,families:Object.freeze([...new Set(fonts.map(f=>f.family))]),lease,references:0,sourceBytes};this.entries.set(key,entry);this.bytes+=sourceBytes;}
    entry.references++;const current=entry;let released=false;
    return {provider:entry.provider,fonts:entry.fonts,families:entry.families,release:()=>{if(released)return;released=true;if(--current.references!==0)return;try{current.retire();}catch(error){this.failed=true;throw error;}this.entries.delete(key);this.bytes-=current.sourceBytes;current.lease.returnBy('caller');}};
  }
  get debugProviderCount():number{return this.entries.size;}
  get debugSourceBytes():number{return this.bytes;}
}
