// SPDX-License-Identifier: BSD-3-Clause
import {createHash} from 'node:crypto';
import type {Declaration,ResolvedType,Reference,ClassFormal,Argument,Expression} from './body-ir.ts';
import {BlockedSemantic} from './class-model.ts';
type Owner=Declaration&{kind:'class'};type Mixin=Declaration&{kind:'mixin'};
const fail=(message:string):never=>{throw new BlockedSemantic('Source mixin application: '+message);};
const object='dart:core::Object:CLASS';
/** Semantic identity excludes display names, spans and source alias spelling. */
function key(type:ResolvedType):string {
 if(type.kind==='interface')return type.reference.id+'<'+type.arguments.map(key).join(',')+'>'+(type.nullable?'?':'');
 if(type.kind==='parameter')return type.reference.id+(type.nullable?'?':'');
 if(type.kind==='function')return JSON.stringify(type);
 return JSON.stringify(type);
}
function substitute<T>(value:T,parameters:Map<string,ResolvedType>):T{
 if(Array.isArray(value))return value.map(item=>substitute(item,parameters)) as T;
 if(!value||typeof value!=='object')return value;
 const node=value as Record<string,unknown>,reference=node.reference as Reference|undefined;
 if(node.kind==='parameter'&&reference&&parameters.has(reference.id)){const result=parameters.get(reference.id)!;return {...result,nullable:result.nullable||node.nullable===true} as T;}
 return Object.fromEntries(Object.entries(node).map(([name,item])=>[name,name==='reference'?item:substitute(item,parameters)])) as T;
}
const application=(owner:Owner):ResolvedType=>({kind:'interface',reference:owner.reference,nullable:false,arguments:owner.typeParameters.map(p=>({kind:'parameter',reference:p.reference,nullable:false}))});

/** Original bodies are copied into one lexical class per ordered application.
 * The original mixin becomes an unconstructible nominal/static owner, retaining
 * its complete body IR for contracts, member lookup and provenance. */
export function lowerSourceMixinApplications(declarations:Declaration[],reservedInputs:unknown=[]):Declaration[]{
 const reserved=JSON.stringify([declarations,reservedInputs]);
 const mixins=new Map(declarations.filter((n):n is Mixin=>n.kind==='mixin').map(n=>[n.reference.id,n]));if(!mixins.size)return declarations;
 const classes=new Map(declarations.filter((n):n is Owner=>n.kind==='class').map(n=>[n.reference.id,n])),helpers:Owner[]=[],active=new Set<string>(),done=new Set<string>();
 for(const m of mixins.values()){
  if(m.methods.some(method=>!method.static&&method.typeParameters?.length))fail('Generic instance mixin methods require their own qualified callable witness ABI: '+m.reference.id);
  if(m.fields?.some(field=>field.late))fail('Late source mixin initialization requires a qualified application contract: '+m.reference.id);
  classes.set(m.reference.id,{kind:'class',name:m.name,reference:m.reference,sourceMixinOwner:true,abstract:true,offset:m.offset,length:m.length,typeParameters:m.typeParameters??[],interfaces:[...m.onConstraints??[],...m.interfaces??[]],fields:m.fields??[],methods:m.methods,constructor:{parameters:[],assertions:[],body:null,const:false,offset:m.offset,length:0}});
 }
 function projections(type:ResolvedType,trail=new Set<string>()):ResolvedType[]{
  if(type.kind!=='interface'||type.nullable)return fail('Constraint projection requires a non-null resolved interface');
  if(trail.has(type.reference.id))return fail('Cyclic source constraint projection: '+type.reference.id);const owner=classes.get(type.reference.id);if(!owner)return [type];
  if(owner.typeParameters.length!==type.arguments.length)return fail('Constraint arity differs from the owning declaration: '+type.reference.id);
  const parameters=new Map(owner.typeParameters.map((p,index)=>[p.reference.id,type.arguments[index]!])),next=new Set([...trail,type.reference.id]);
  return [type,...[owner.superclass?.type,...owner.interfaces??[]].filter((value):value is ResolvedType=>Boolean(value)).flatMap(value=>projections(substitute(value,parameters),next))];
 }
 function lower(owner:Owner):Owner{
  if(done.has(owner.reference.id)||owner.sourceMixinOwner||owner.sourceMixinApplication)return owner;if(active.has(owner.reference.id))return fail('Cyclic original class hierarchy');active.add(owner.reference.id);
  const base=owner.superclass;if(base?.type.kind==='interface'){const parent=classes.get(base.type.reference.id);if(parent)classes.set(parent.reference.id,lower(parent));}
  if(owner.interfaces?.some(type=>type.kind==='interface'&&mixins.has(type.reference.id)))return fail('Interface-only source mixin implementation requires qualified projected witness capture: '+owner.reference.id);
  const applications=owner.mixins??[];
  if(!applications.some(type=>type.kind==='interface'&&mixins.has(type.reference.id))){active.delete(owner.reference.id);done.add(owner.reference.id);return owner;}
  if(!base||base.type.kind!=='interface'||base.type.nullable||applications.some(type=>type.kind!=='interface'||type.nullable||!mixins.has(type.reference.id)))return fail('Every ordered application must select its original source mixin and resolved superclass: '+owner.reference.id);
  let current=base.type,currentConstructor=base.constructor,currentArguments=base.args??[];const originalNames=new Map<string,string>();
  const initialParent=classes.get(current.reference.id);for(const p of initialParent?.constructor.parameters??[])if(p.named)originalNames.set(p.name,p.name);
  for(const [index,type]of applications.entries()){
   if(type.kind!=='interface')return fail('Application type is not an interface');const m=mixins.get(type.reference.id)!;
   if(type.arguments.length!==(m.typeParameters?.length??0))return fail('Mixin application requires exact resolved generic arity: '+m.reference.id);
   const actualParameters=new Map((m.typeParameters??[]).map((p,i)=>[p.reference.id,type.arguments[i]!]));
   const parent=classes.get(current.reference.id),root=current.reference.id===object;
   if(!parent&&!root)return fail('Mixin application requires the complete owned superclass body: '+current.reference.id);
   if(parent?.namedOnly||parent&&currentConstructor.id!==parent.constructor.reference?.id||root&&(currentConstructor.id!=='dart:core::Object.Object.new:CONSTRUCTOR'||base.args?.length))return fail('Mixin forwarding requires the same owned generative constructor entry');
   const template=parent?application(parent):current,available=projections(template),actual=projections(current),variables=new Set(parent?.typeParameters.map(p=>p.reference.id)??[]),bindings=new Map<string,ResolvedType>();
   function unify(pattern:ResolvedType,target:ResolvedType):boolean{
    if(pattern.kind==='parameter'&&variables.has(pattern.reference.id)&&!pattern.nullable){const previous=bindings.get(pattern.reference.id);if(previous)return key(previous)===key(target);bindings.set(pattern.reference.id,target);return true;}
    if(pattern.kind==='interface'&&target.kind==='interface'&&pattern.reference.id===target.reference.id&&pattern.nullable===target.nullable&&pattern.arguments.length===target.arguments.length)return pattern.arguments.every((argument,i)=>unify(argument,target.arguments[i]!));
    return key(pattern)===key(target);
   }
   for(const constraint of m.onConstraints??[]){
    if(constraint.kind!=='interface'||constraint.nullable)return fail('Mixin on constraints require exact interfaces');const expected=substitute(constraint,actualParameters);
    if(!actual.some(candidate=>key(candidate)===key(expected)))return fail('Owned superclass does not satisfy the exact original on constraint: '+key(expected));
    const candidate=available.find(value=>value.kind==='interface'&&value.reference.id===constraint.reference.id);if(!candidate||!unify(candidate,constraint))return fail('Constraint relation needs a qualified dependent generic representation: '+key(constraint));
   }
   const symbolic:ResolvedType={...current,arguments:parent?parent.typeParameters.map((p,i)=>bindings.get(p.reference.id)??current.arguments[i]!):[]};
   if(key(substitute(symbolic,actualParameters))!==key(current))return fail('Symbolic constraint plan changes the original superclass application');
   const suffix=createHash('sha256').update(owner.reference.id+'\0'+index+'\0'+m.reference.id).digest('hex').slice(0,16);let name='_MixinApplication_'+suffix;while(reserved.includes(name)||[...classes.values()].some(c=>c.name===name))name+='_';
   const library=owner.reference.id.split('::')[0]!,reference:Reference={id:library+'::'+name+':CLASS',name,owner:null,local:false,static:false},constructor:Reference={id:library+'::'+name+'.'+name+'.new:CONSTRUCTOR',name:'new',owner:name,local:false,static:false};
   const parentParameters=parent?substitute(parent.constructor.parameters,new Map(parent.typeParameters.map((p,i)=>[p.reference.id,symbolic.kind==='interface'?symbolic.arguments[i]!:fail('Missing symbolic base')]))):[];
   const names=new Map(parentParameters.map((p,i)=>[p.name,name+'_argument'+i]));
   const parameters:ClassFormal[]=parentParameters.map((p,i)=>({...p,name:names.get(p.name)!,field:null,reference:{id:constructor.id+'.'+i+':PARAMETER',name:names.get(p.name)!,owner:null,local:true,static:false}}));
   const arguments_:Argument[]=parameters.map((p,i)=>({name:p.named?parentParameters[i]!.name:null,parameterType:p.resolvedType,appliedParameterType:p.resolvedType,value:{kind:'identifier',name:p.name,reference:p.reference!,type:p.type,storageType:p.resolvedType,...p.numeric?{numeric:p.numeric}:{},offset:m.offset,length:0} as Expression}));
   currentArguments=currentArguments.map(argument=>argument.name===null?argument:{...argument,name:names.get(argument.name)??fail('Named original superclass parameter is missing')});for(const [original,currentName]of originalNames)originalNames.set(original,names.get(currentName)??fail('Missing named application forwarding parameter'));
   const usedNames=new Set((m.typeParameters??[]).map(p=>p.name)),ownerParameters=owner.typeParameters.map(p=>{let target='_owner_'+p.name;while(usedNames.has(target))target+='_';usedNames.add(target);return {...p,name:target};});
   const originalParameters=[...ownerParameters,...m.typeParameters??[]];if(new Set(originalParameters.map(p=>p.reference.id)).size!==originalParameters.length)return fail('Application parameters require distinct lexical identities');
   const sourceType:ResolvedType={kind:'interface',reference:m.reference,nullable:false,arguments:(m.typeParameters??[]).map(p=>({kind:'parameter',reference:p.reference,nullable:false}))};
   const helper:Owner={kind:'class',name,reference,abstract:true,sourceMixinApplication:{owner:m.reference,type:sourceType},offset:m.offset,length:m.length,typeParameters:originalParameters,fields:m.fields?.filter(field=>!field.static)??[],methods:m.methods.filter(method=>!method.static),interfaces:[sourceType],constructor:{parameters,assertions:[],body:null,const:false,reference:constructor,offset:m.offset,length:0},...root?{}:{superclass:{type:symbolic,constructor:currentConstructor,implicit:true,args:arguments_}}};
   classes.set(reference.id,helper);helpers.push(helper);current={kind:'interface',reference,nullable:false,arguments:[...owner.typeParameters.map(p=>({kind:'parameter',reference:p.reference,nullable:false} as ResolvedType)),...type.arguments]};currentConstructor=constructor;
  }
  const normalized:Owner={...owner,mixins:[],superclass:{...base,type:current,constructor:currentConstructor,args:currentArguments}};
  if(owner.namedConstructors?.some(entry=>!entry.factory&&entry.superclass&&entry.superclass.constructor.id!==base.constructor.id))return fail('Named source entry changes the superclass constructor');
  if(owner.namedConstructors)normalized.namedConstructors=owner.namedConstructors.map(entry=>entry.factory?entry:{...entry,...entry.superclass?{superclass:{...entry.superclass,type:current,constructor:currentConstructor,args:(entry.superclass.args??[]).map(argument=>argument.name===null?argument:{...argument,name:originalNames.get(argument.name)??fail('Missing named source entry parameter')})}}:{}});
  classes.set(owner.reference.id,normalized);active.delete(owner.reference.id);done.add(owner.reference.id);return normalized;
 }
 for(const declaration of declarations)if(declaration.kind==='class')lower(declaration);
 return [...declarations.map(declaration=>declaration.kind==='class'||declaration.kind==='mixin'?classes.get(declaration.reference.id)!:declaration),...helpers];
}
