// SPDX-License-Identifier: BSD-3-Clause
import {createHash} from 'node:crypto';
import type {BodyRecord,Reference} from './body-ir.ts';

export interface SourceDependencyUse {source:string;symbol:string;path:string;role:string}
export interface SourceDependencyFrontier {library:string;symbol:string;references:Reference[];uses:SourceDependencyUse[]}
const digest=(value:unknown)=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const library=(id:string)=>id.slice(0,id.indexOf('::'));
/** Exact analyzer owner/name selects an available top-level declaration. No
 * TypeScript names, sample values or fallback bodies participate in resolution. */
export function sourceDependencyClosure(records:BodyRecord[],roots:{source:string;symbol:string}[]){
 const keyed=new Map<string,BodyRecord[]>(),owners=new Map<string,BodyRecord[]>();
 for(const row of records){const key=row.source+'::'+row.symbol;keyed.set(key,[...keyed.get(key)??[],row]);if(row.ir?.reference){const id=library(row.ir.reference.id)+'::'+row.ir.name;owners.set(id,[...owners.get(id)??[],row]);}}
 const selected=new Map<string,BodyRecord>(),frontier=new Map<string,SourceDependencyFrontier>(),blocked:{source:string;symbol:string;diagnostics:string[]}[]=[],dynamicSites:SourceDependencyUse[]=[],namespaceUses:(SourceDependencyUse&{reference:Reference})[]=[],visited=new Set<string>();
 function visit(row:BodyRecord):void{
  const key=row.source+'::'+row.symbol;if(visited.has(key))return;visited.add(key);const probes=keyed.get(key)??[row];
  if(probes.some(probe=>!probe.ir)||new Set(probes.map(probe=>digest(probe.ir))).size!==1){blocked.push({source:row.source,symbol:row.symbol,diagnostics:probes.map(probe=>probe.diagnostic??'Conflicting resolved declaration bodies')});return;}
  selected.set(key,row);
  function walk(value:unknown,path:string[],role='metadata'):void{
   if(Array.isArray(value)){value.forEach((item,index)=>walk(item,[...path,String(index)],role));return;}if(!value||typeof value!=='object')return;
   const node=value as Record<string,unknown>,kind=typeof node.kind==='string'?node.kind:role;
   if(kind==='dynamic')dynamicSites.push({source:row.source,symbol:row.symbol,path:path.join('.'),role});
   if(typeof node.id==='string'&&typeof node.name==='string'&&typeof node.local==='boolean'&&typeof node.static==='boolean'){
    const ref=node as unknown as Reference;if(ref.local||ref.id.endsWith(':TYPE_PARAMETER'))return;
    // Prefixes belong to the importing unit, not to a source declaration.
    // The member/type below the prefix retains its own resolved library ID.
    if(ref.id.endsWith(':PREFIX')){namespaceUses.push({source:row.source,symbol:row.symbol,path:path.join('.'),role,reference:ref});return;}
    const unit=library(ref.id),symbol=ref.owner??ref.name,candidates=owners.get(unit+'::'+symbol);
    const use={source:row.source,symbol:row.symbol,path:path.join('.'),role};
    if(candidates?.length){const identities=new Set(candidates.map(candidate=>candidate.source+'::'+candidate.symbol));if(identities.size===1){visit(candidates[0]!);return;}}
    const key=unit+'::'+symbol,entry=frontier.get(key)??{library:unit,symbol,references:[],uses:[]};if(!entry.references.some(value=>value.id===ref.id))entry.references.push(ref);entry.uses.push(use);frontier.set(key,entry);return;
   }
   for(const [name,child]of Object.entries(node))if(!['numeric','numericReturn'].includes(name))walk(child,[...path,name],name==='reference'?kind:role==='metadata'?kind:role);
  }
  walk(row.ir,[]);
 }
 for(const root of roots){const rows=keyed.get(root.source+'::'+root.symbol);if(!rows?.length)throw new Error('Missing exact source root '+root.source+'::'+root.symbol);visit(rows[0]!);}
 return {roots,selected:[...selected.values()],blocked,frontier:[...frontier.values()].sort((a,b)=>(a.library+'::'+a.symbol).localeCompare(b.library+'::'+b.symbol)),dynamicSites,namespaceUses};
}
