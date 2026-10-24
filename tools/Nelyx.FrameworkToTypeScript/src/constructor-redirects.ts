// SPDX-License-Identifier: BSD-3-Clause
import type{Declaration,Reference,Expression,Statement,ClassFormal,ClassInitializer,ConstructorPrelude,GenerativeRedirect,Variable}from'./body-ir.ts';
import{BlockedSemantic}from'./class-model.ts';
type Owner=Declaration&{kind:'class'};
type Entry={reference?:Reference;parameters:ClassFormal[];initializers?:ClassInitializer[];body?:Statement|null;const:boolean;factory?:boolean;generativeRedirect?:GenerativeRedirect;superclass?:Owner['superclass']};
/** Resolve same-owner generative redirects into one allocation/initialization plan.
 * All explicit arguments are captured in source order before destination defaults.
 * Source parameter identities keep closures and shadowed locals independent. */
export function lowerGenerativeRedirects(declarations:Declaration[],reservedInputs:unknown=[]):Declaration[]{
 const reserved=JSON.stringify([declarations,reservedInputs]);let serial=0;
 const temporary=()=>{let result:string;do{result='_redirectParameter'+serial++;}while(reserved.includes(result));return result;};
 function fail(message:string):never{throw new BlockedSemantic('Generative redirect: '+message);}
 function rename<T>(value:T,names:Map<string,string>):T{
  if(Array.isArray(value))return value.map(item=>rename(item,names))as T;
  if(!value||typeof value!=='object')return value;
  const n=value as any,result=Object.fromEntries(Object.entries(n).map(([key,item])=>[key,key==='reference'?item:rename(item,names)]));
  if(n.kind==='identifier'&&n.reference&&names.has(n.reference.id))result.name=names.get(n.reference.id);
  return result as T;
 }
 function identifier(parameter:ClassFormal,name=parameter.name):Expression{
  if(!parameter.reference?.local)fail('destination parameters require analyzer identities');
  return{kind:'identifier',name,reference:parameter.reference,type:parameter.type,storageType:parameter.resolvedType,...parameter.numeric?{numeric:parameter.numeric}:{},offset:0,length:0};
 }
 return declarations.map(declaration=>{
  if(declaration.kind!=='class'||!declaration.constructor.generativeRedirect&&!declaration.namedConstructors?.some(c=>c.generativeRedirect))return declaration;
  if(declaration.typeParameters.length)fail('generic generative chains need a separate witness initialization plan');
  const owner=structuredClone(declaration),primary:Entry={...owner.constructor,superclass:owner.superclass},entries=new Map<string,Entry>();
  if(!primary.reference)fail('primary constructor identity is missing');entries.set(primary.reference.id,primary);
  for(const entry of owner.namedConstructors??[])entries.set(entry.reference.id,entry);
  function plan(start:Entry){
   let current=start,names=new Map<string,string>();const visited=new Set<string>(),prelude:ConstructorPrelude[]=[];
   while(current.generativeRedirect){
    const id=current.reference?.id;if(!id||visited.has(id))fail('cyclic or missing constructor identity');visited.add(id);
    if(current.factory||current.body||current.initializers?.length||current.parameters.some(p=>p.field))fail('redirecting entry cannot initialize fields or execute a body');
    const redirect=current.generativeRedirect,target=entries.get(redirect.reference.id);if(!target||target.factory)fail('target must be a same-owner generative constructor');
    if(current.const&&!target.const)fail('const redirect target must be const');
    if(target.parameters.some(p=>!p.reference?.local)||new Set(target.parameters.map(p=>p.reference!.id)).size!==target.parameters.length)fail('destination parameters require unique analyzer identities');
    const positional=target.parameters.filter(p=>!p.named),named=target.parameters.filter(p=>p.named),provided=new Map<string,Expression>(),variables:Variable[]=[];let position=0,sawNamed=false;
    for(const argument of redirect.args){
     let parameter:ClassFormal|undefined;
     if(argument.name===null){if(sawNamed)fail('positional argument after named argument');parameter=positional[position++];}else{sawNamed=true;parameter=named.find(p=>p.name===argument.name);}
     if(!parameter||provided.has(parameter.reference!.id))fail('unknown, duplicate or excess argument');
     const name=temporary(),reference:Reference={id:id+'::redirect-argument:'+variables.length,name,owner:null,local:true,static:false},value=rename(argument.value,names);
     variables.push({name,reference,type:parameter.type,resolvedType:parameter.resolvedType,...parameter.numeric?{numeric:parameter.numeric}:{},value});
     provided.set(parameter.reference!.id,{kind:'identifier',name,reference,type:parameter.type,storageType:parameter.resolvedType,...parameter.numeric?{numeric:parameter.numeric}:{},offset:value.offset,length:value.length});
    }
    const next=new Map<string,string>(),checks:ClassFormal[]=[];
    for(const parameter of target.parameters){
     let value=provided.get(parameter.reference!.id);
     if(!value){if(parameter.required)fail('missing required argument');if(parameter.default)value=structuredClone(parameter.default);else if(parameter.resolvedType.nullable)value={kind:'literal',value:null,type:'Null',offset:0,length:0};else fail('missing non-null default');}
     const name=temporary();next.set(parameter.reference!.id,name);variables.push({name,reference:parameter.reference!,type:parameter.type,resolvedType:parameter.resolvedType,...parameter.numeric?{numeric:parameter.numeric}:{},value});checks.push({...parameter,name});
    }
    prelude.push({variables,checks});names=next;current=target;
   }
   if(!prelude.length)return null;
   const initializers:ClassInitializer[]=[...current.parameters.filter(p=>p.field).map(p=>({kind:'field' as const,field:p.field!,value:identifier(p,names.get(p.reference!.id)!)})),...rename(current.initializers??[],names)];
   const body=current.body?rename(current.body,names):null;
   return{prelude,initializers,body:body?{kind:'block' as const,offset:body.offset,length:body.length,statements:[body]}:null,superclass:rename(current.superclass,names)??null};
  }
  const root=plan(primary);
  if(root){delete owner.constructor.generativeRedirect;owner.constructor={...owner.constructor,prelude:root.prelude,redirected:true,initializers:root.initializers,assertions:root.initializers.filter((i):i is Statement&{kind:'assert'}=>i.kind==='assert'),body:root.body};owner.superclass=root.superclass??null;}
  if(owner.namedConstructors)owner.namedConstructors=owner.namedConstructors.map(entry=>{const result=plan(entry);if(!result)return entry;const lowered={...entry,...result,redirected:true as const};delete lowered.generativeRedirect;return lowered;});
  return owner;
 });
}
