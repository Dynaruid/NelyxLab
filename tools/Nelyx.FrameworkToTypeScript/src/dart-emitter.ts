// SPDX-License-Identifier: BSD-3-Clause
import ts from 'typescript';
import type {Expression,Statement,Declaration,ModuleRecipe,Argument,Parameter,Reference,ResolvedType,FieldFormal,ClassFormal,NamedConstructor,NumericSource,Variable,CollectionElement,ClassTypeParameter,MatchPattern,SourceLabel,RecordAssignmentPattern} from './body-ir.ts';
import {ClassModel,BlockedSemantic,privateName} from './class-model.ts';
import {lowerGenerativeRedirects} from './constructor-redirects.ts';
import {lowerSourceMixinApplications} from './mixin-applications.ts';
import {createNullishCoalescing} from './nullish-coalescing.ts';
export {BlockedSemantic} from './class-model.ts';
const f=ts.factory,exported=[f.createModifier(ts.SyntaxKind.ExportKeyword)];
/** Structured AST emitter; unsupported semantics never turn into a product stub. */
export function emitDart(declarations:Declaration[],recipe:ModuleRecipe,manualDeclarations:{file:string;source:string}[]=[]):string {
  declarations=lowerGenerativeRedirects(declarations,[recipe,manualDeclarations]);
  if(recipe.sourceMixinApplications){if(recipe.sourceMixinApplications.policy!=='owned-source-mixin-application')throw new BlockedSemantic('Unknown source mixin application policy');declarations=lowerSourceMixinApplications(declarations,[recipe,manualDeclarations]);}
  if(Object.keys(recipe.imports??{}).some(symbol=>Object.hasOwn(recipe.typeImports??{},symbol)))throw new BlockedSemantic('Type and value imports cannot bind the same name');
  if(JSON.stringify(recipe.manualDeclarations??[])!==JSON.stringify(manualDeclarations.map(input=>input.file)))throw new BlockedSemantic('Tracked manual declaration inputs must match the recipe in order');
  for(const input of manualDeclarations){
    const parsed=ts.createSourceFile(input.file,input.source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TS),diagnostics=(parsed as ts.SourceFile&{parseDiagnostics:ts.Diagnostic[]}).parseDiagnostics;
    if(diagnostics.length||parsed.statements.some(statement=>![ts.SyntaxKind.ClassDeclaration,ts.SyntaxKind.InterfaceDeclaration,ts.SyntaxKind.TypeAliasDeclaration,ts.SyntaxKind.FunctionDeclaration,ts.SyntaxKind.EnumDeclaration,ts.SyntaxKind.VariableStatement].includes(statement.kind)))throw new BlockedSemantic('Manual input must contain only valid TS declarations: '+input.file);
  }
  const imported=new Set(Object.keys(recipe.imports??{})),importedTypes=new Set([...imported,...Object.keys(recipe.typeImports??{})]),locals=new Set(declarations.filter(d=>d.kind!=='method'&&!(d.kind==='constant'&&d.owner)).map(d=>d.name));
  const classNames=Object.assign(Object.create(null) as Record<string,string>,recipe.classNames??{}),renames=Object.assign(Object.create(null) as Record<string,string>,recipe.renames??{});
  const name=(value:string)=>renames[value]??classNames[value]??value;
  function blocked(reason:string,node?:{offset:number}):never{throw new BlockedSemantic(reason+(node?` @${node.offset}`:''));}
  function dotted(value:string):ts.Expression {const parts=value.split('.');return parts.slice(1).reduce<ts.Expression>((target,part)=>f.createPropertyAccessExpression(target,part),f.createIdentifier(parts[0]!));}
  const model=new ClassModel(declarations);
  // Names must not capture a Dart local in an expression moved into an IIFE.
  const reservedNames=JSON.stringify([declarations,recipe,manualDeclarations]);let temporarySequence=0;
  function temporary():ts.Identifier {let value:string;do{value='_dartTemporary'+temporarySequence++;}while(reservedNames.includes(value));return f.createIdentifier(value);}
  let cascadeTarget:ts.Identifier|undefined;
  let nullChainTarget:ts.Identifier|undefined;
  let asyncContext=false;
  const methodTypeParameters=new Set<string>();
  const numericValues=recipe.numericValues;
  const numericOperators=recipe.numericOperators;
  if(numericOperators&&(numericOperators.policy!=='retained-core-numeric-operations'||!numericValues||Object.values(numericOperators.operators).some(target=>!imported.has(target))))blocked('Retained core numeric operators require exact imported carrier operations');
  if(numericValues&&(numericValues.policy!=='source-numeric-erasure'||![numericValues.int,numericValues.double,numericValues.castInt,numericValues.castDouble].every(symbol=>imported.has(symbol))||!importedTypes.has(numericValues.numType)))blocked('Numeric value erasure requires explicit imported scalar/boxed boundaries');
  const numericGenerics=numericValues?.genericTypes;
  if(numericGenerics&&![numericGenerics.int,numericGenerics.double].every(symbol=>importedTypes.has(symbol)))blocked('Numeric generic arguments require imported carrier types');
  const numericFunctions=recipe.numericFunctions;
  if(numericFunctions){
    const identity=recipe.adapters?.['dart:core::identical:FUNCTION'];
    if(numericFunctions.policy!=='source-function-representation'||!numericGenerics||![numericFunctions.bridge,numericFunctions.identity,numericFunctions.unwrapNum].every(symbol=>imported.has(symbol))||identity?.kind!=='call'||identity.target!==numericFunctions.identity||identity.receiver)blocked('Numeric function representations require imported bridges and source identity dispatch');
  }
  let returnStorage:ResolvedType|undefined;
  let constExportParameters:ReadonlySet<string>|null=null;
  let constExportTypes:ReadonlySet<string>|null=null;
  const constExportNames=new Set<string>();
  function numericKind(value:ResolvedType|undefined):'int'|'double'|'num'|undefined{
    if(value?.kind!=='interface'||value.arguments.length)return;
    if(value.reference.id==='dart:core::int:CLASS')return 'int';
    if(value.reference.id==='dart:core::double:CLASS')return 'double';
    if(value.reference.id==='dart:core::num:CLASS')return 'num';
  }
  function erasedNumericStorage(type:ResolvedType|undefined):boolean{return type?.kind==='parameter'||type?.kind==='dynamic'&&recipe.dynamicValues?.policy==='checked-erased-values'||type?.kind==='interface'&&['dart:core::Object:CLASS','dart:core::num:CLASS'].includes(type.reference.id);}
  function argumentType(value:ResolvedType):ts.TypeNode{
    const kind=numericKind(value);
    if(!numericGenerics||!kind)return resolvedType(value);
    const type=f.createTypeReferenceNode(kind==='num'?numericValues!.numType:numericGenerics[kind]);
    return value.nullable?f.createUnionTypeNode([type,f.createLiteralTypeNode(f.createNull())]):type;
  }
  function scalarFromStored(value:ts.Expression,type:ResolvedType):ts.Expression{
    const kind=numericKind(type);
    if(!numericValues||kind!=='int'&&kind!=='double')return value;
    const cast=(value:ts.Expression)=>f.createCallExpression(f.createIdentifier(kind==='int'?numericValues.castInt:numericValues.castDouble),undefined,[value]);
    return type.nullable?evaluateOnce(value,value=>[f.createReturnStatement(f.createConditionalExpression(f.createBinaryExpression(value,ts.SyntaxKind.EqualsEqualsEqualsToken,f.createNull()),undefined,f.createNull(),undefined,cast(value)))]):cast(value);
  }
  function genericTransferred(n:Expression,type:ResolvedType|undefined):ts.Expression{
    return numericGenerics&&numericKind(type)?transferred(n,{kind:'interface',nullable:true,reference:{id:'dart:core::Object:CLASS',name:'Object',owner:null,local:false,static:false},arguments:[]}):transferred(n,type);
  }
  function contextualClosure(n:Expression&{kind:'closure'},declared:ResolvedType&{kind:'function'},applied:ResolvedType&{kind:'function'}):ts.Expression{
    if(declared.parameters.length!==applied.parameters.length||applied.parameters.length!==n.parameters.length)blocked('Numeric callback requires exact resolved parameter shapes',n);
    const locals:ts.Statement[]=[],bridge=n.parameters.map((parameter,index)=>erasedNumericStorage(declared.parameters[index]!.type)&&['int','double'].includes(numericKind(parameter.resolvedType)??''));
    let parameters=fieldFormals(n.parameters);
    if(bridge.some(Boolean)){
      if(!numericGenerics||n.parameters.some(p=>p.named||!p.required||p.default))blocked('Numeric callback parameter bridge requires required positional parameters',n);
      parameters=n.parameters.map((parameter,index)=>{
        if(!bridge[index])return f.createParameterDeclaration(undefined,undefined,parameter.name,undefined,resolvedType(parameter.resolvedType));
        if(numericKind(applied.parameters[index]!.type)!==numericKind(parameter.resolvedType))blocked('Numeric callback parameter representation differs from its resolved source kind',n);
        const hidden=temporary();locals.push(valueDoc(f.createVariableStatement(undefined,f.createVariableDeclarationList([f.createVariableDeclaration(parameter.name,undefined,resolvedType(parameter.resolvedType),scalarFromStored(hidden,parameter.resolvedType))],ts.NodeFlags.Let)),parameter.numeric));
        return f.createParameterDeclaration(undefined,undefined,hidden,undefined,argumentType(applied.parameters[index]!.type));
      });
    }
    const body=callableBody(n.body,n.parameters,declared.returnType),result=erasedNumericStorage(declared.returnType)?argumentType(applied.returnType):resolvedType(applied.returnType);
    return f.createArrowFunction(asyncModifiers(n.body,n.returnType),undefined,parameters,result,undefined,f.createBlock([...locals,...body.statements],true));
  }
  function transferred(n:Expression,target:ResolvedType|undefined,applied:ResolvedType|undefined=target):ts.Expression{
    if(!numericValues)return expr(n);
    if(n.kind==='parenthesized')return f.createParenthesizedExpression(transferred(n.value,target,applied));
    if(target?.kind==='function'){
      if(numericFunctions&&n.kind==='literal'&&n.value===null&&target.nullable)return f.createNull();
      if(numericFunctions&&n.kind==='conditional')return f.createConditionalExpression(expr(n.test),undefined,transferred(n.then,target,applied),undefined,transferred(n.else,target,applied));
      if(numericFunctions&&n.kind==='binary'&&n.operator==='??'){
        if(applied?.kind!=='function')blocked('Callable coalescing requires an applied function signature',n);
        return evaluateOnce(transferred(n.left,{...target,nullable:true},{...applied,nullable:true}),value=>[f.createReturnStatement(f.createConditionalExpression(f.createBinaryExpression(value,ts.SyntaxKind.EqualsEqualsEqualsToken,f.createNull()),undefined,transferred(n.right,target,applied),undefined,value))]);
      }
      if(numericFunctions&&n.kind!=='closure'){
        if(applied?.kind!=='function'||n.functionType?.kind!=='function'||n.storageType?.kind!=='function')blocked('Numeric function values require resolved declaration and applied function signatures',n);
        return functionTransferred(n,target,applied,n.storageType,n.functionType);
      }
      const sourceReturn=n.kind==='closure'?n.returnType:n.functionType?.kind==='function'?n.functionType.returnType:undefined;
      const returnBridge=erasedNumericStorage(target.returnType)&&numericKind(sourceReturn)&&!(n.storageType?.kind==='function'&&erasedNumericStorage(n.storageType.returnType));
      const parameterBridge=n.kind==='closure'&&n.parameters.some((p,index)=>erasedNumericStorage(target.parameters[index]?.type)&&['int','double'].includes(numericKind(p.resolvedType)??''));
      if(returnBridge||parameterBridge){
        if(n.kind!=='closure')blocked('Numeric function widening requires an explicit function-value ABI',n);
        if(applied?.kind!=='function')blocked('Numeric callback requires the applied source function type',n);
        return contextualClosure(n,target,applied);
      }
    }
    if(!erasedNumericStorage(target))return expr(n);
    if(['int','double','num'].includes(n.type.replace(/\?$/,''))&&!numericKind(n.numeric?.resolvedType))blocked('Numeric transfer requires resolved source numeric provenance',n);
    if(n.kind==='conditional')return f.createConditionalExpression(expr(n.test),undefined,transferred(n.then,target,applied),undefined,transferred(n.else,target,applied));
    const kind=numericKind(n.numeric?.resolvedType);
    if(kind==='num'){
      if(!erasedNumericStorage(n.storageType)&&!(numericGenerics&&(n.kind==='recordAccess'||n.kind==='namedRecordAccess'||n.kind==='typeCast'&&numericKind(n.checkedType)==='num'||n.kind==='assignment'&&erasedNumericStorage(n.left.storageType)||n.kind==='patternSwitchExpression'&&numericKind(n.resultType)==='num'||n.kind==='binary'&&n.reference&&numericOperators?.operators[n.reference.id])))blocked('Numeric union transfer needs retained source value provenance',n);
      return expr(n);
    }
    if(!kind)return expr(n);
    const value=expr(n),convert=(value:ts.Expression)=>f.createCallExpression(f.createIdentifier(numericValues[kind]),undefined,[value]);
    return n.numeric!.resolvedType!.nullable?evaluateOnce(value,value=>[f.createReturnStatement(f.createConditionalExpression(f.createBinaryExpression(value,ts.SyntaxKind.EqualsEqualsEqualsToken,f.createNull()),undefined,f.createNull(),undefined,convert(value)))]):convert(value);
  }
  function pureConst(value:Expression,allowed:ReadonlySet<string>=new Set()):void {
    if(value.kind==='literal')return;
    if((value.kind==='identifier'||value.kind==='property')&&value.reference&&(value.reference.constant||allowed.has(value.reference.id)))return;
    if(value.kind==='parenthesized'){pureConst(value.value,allowed);return;}
    if(value.kind==='prefix'&&['-','!','~'].includes(value.operator??'')&&(!value.reference||/^dart:core::(int|double|num|bool)\./.test(value.reference.id))){pureConst(value.value,allowed);return;}
    if(value.kind==='binary'&&(!value.reference&&['&&','||','??'].includes(value.operator)||value.reference&&/^dart:core::(int|double|num|bool|String)\./.test(value.reference.id))){pureConst(value.left,allowed);pureConst(value.right,allowed);return;}
    if(value.kind==='conditional'){pureConst(value.test,allowed);pureConst(value.then,allowed);pureConst(value.else,allowed);return;}
    if(value.kind==='construct'&&value.const&&value.reference&&['canonical-immutable-generic-fields','canonical-immutable-constructor-fields','canonical-generated-redirect','canonical-generated-external','canonical-generated-external-fields','canonical-immutable-host-fields'].includes(recipe.constantConstructors?.[value.reference.id]?.policy??'')){value.args.forEach(arg=>pureConst(arg.value,allowed));return;}
    if(value.kind==='collectionLiteral'&&value.constant&&value.collectionKind==='map'&&value.elements.every(element=>element.kind==='entry')){for(const element of value.elements){if(element.kind!=='entry')blocked('Expected a constant Map pair',value);pureConst(element.key,allowed);pureConst(element.value,allowed);}return;}
    if(value.kind==='collectionLiteral'&&value.constant&&value.collectionKind==='set'&&value.elements.every(element=>element.kind==='value')){for(const element of value.elements){if(element.kind!=='value')blocked('Expected a constant Set value',value);pureConst(element.value,allowed);}return;}
    blocked('Generic const requires analyzer-proven constant references and pure supported expressions',value);
  }
  type FunctionType=ResolvedType&{kind:'function'};
  function scalarHost(n:Expression):boolean {
    if(n.kind!=='identifier'&&n.kind!=='property')return false;
    const adapter=n.reference&&recipe.adapters?.[n.reference.id];
    if(!adapter?.numericAbi)return false;
    if(adapter.numericAbi!=='scalar-numeric'||!numericFunctions||adapter.kind!=='call'||adapter.receiver||adapter.namedArguments||adapter.typeArguments?.length||!imported.has(adapter.target)||!n.reference||!(n.reference.id.endsWith(':FUNCTION')||n.reference.static&&n.reference.id.endsWith(':METHOD')))blocked('Scalar numeric host requires an exact imported top-level/static callable',n);
    if(n.functionType?.kind==='function'&&numericKind(n.functionType.returnType)==='num')blocked('Scalar numeric host cannot return num without value provenance',n);
    return true;
  }
  function physicalKind(declared:ResolvedType,applied:ResolvedType,host=false):string {
    if(declared.kind==='void')return 'void';
    const kind=numericKind(declared);
    if(host&&kind)return 'scalar-'+kind;
    if(kind==='int'||kind==='double')return 'scalar-'+kind;
    if(kind==='num')return 'boxed-num';
    const actual=numericKind(applied);
    return erasedNumericStorage(declared)&&actual?'boxed-'+actual:'value';
  }
  function physicalType(declared:ResolvedType,applied:ResolvedType,host=false):ts.TypeNode {
    const kind=physicalKind(declared,applied,host);
    if(kind.startsWith('boxed-'))return argumentType(applied);
    if(host&&numericKind(declared)==='num')return applied.nullable?f.createUnionTypeNode([f.createKeywordTypeNode(ts.SyntaxKind.NumberKeyword),f.createLiteralTypeNode(f.createNull())]):f.createKeywordTypeNode(ts.SyntaxKind.NumberKeyword);
    return resolvedType(applied);
  }
  function needsFunctionConversion(from:ResolvedType,fromActual:ResolvedType,to:ResolvedType,toActual:ResolvedType,fromHost=false,toHost=false):boolean {
    const a=physicalKind(from,fromActual,fromHost),b=physicalKind(to,toActual,toHost);
    return a.startsWith('scalar-')&&!b.startsWith('scalar-')&&erasedNumericStorage(to)||!a.startsWith('scalar-')&&b.startsWith('scalar-');
  }
  function functionConversion(value:ts.Expression,from:ResolvedType,fromActual:ResolvedType,to:ResolvedType,toActual:ResolvedType,fromHost=false,toHost=false):ts.Expression {
    if(!needsFunctionConversion(from,fromActual,to,toActual,fromHost,toHost))return value;
    const a=physicalKind(from,fromActual,fromHost),b=physicalKind(to,toActual,toHost);
    let helper:string;
    if(a.startsWith('scalar-')){
      if(a==='scalar-num')blocked('A scalar-host num result has no source int/double provenance');
      helper=a==='scalar-int'?numericValues!.int:numericValues!.double;
    }else helper=b==='scalar-int'?numericValues!.castInt:b==='scalar-double'?numericValues!.castDouble:numericFunctions!.unwrapNum;
    const convert=(input:ts.Expression)=>f.createCallExpression(f.createIdentifier(helper),undefined,[input]);
    return fromActual.nullable?evaluateOnce(value,input=>[f.createReturnStatement(f.createConditionalExpression(f.createBinaryExpression(input,ts.SyntaxKind.EqualsEqualsEqualsToken,f.createNull()),undefined,f.createNull(),undefined,convert(input)))]):convert(value);
  }
  function functionTransferred(n:Expression,target:FunctionType,targetActual:FunctionType,source:FunctionType,sourceActual:FunctionType):ts.Expression {
    const host=scalarHost(n);
    if([source,sourceActual,target,targetActual].some(type=>type.returnType.kind==='function'||type.parameters.some(parameter=>parameter.type.kind==='function')))blocked('Nested callable transfer requires a recursive function representation ABI',n);
    if(host&&numericKind(source.returnType)==='num')blocked('Scalar numeric host cannot return num without value provenance',n);
    const arity=target.parameters.length;
    if(source.parameters.length!==arity||sourceActual.parameters.length!==arity||targetActual.parameters.length!==arity)blocked('Numeric function bridge requires matching resolved parameter shapes',n);
    const inputs=source.parameters.map((p,index)=>needsFunctionConversion(target.parameters[index]!.type,targetActual.parameters[index]!.type,p.type,sourceActual.parameters[index]!.type,false,host)),output=needsFunctionConversion(source.returnType,sourceActual.returnType,target.returnType,targetActual.returnType,host);
    if(!inputs.some(Boolean)&&!output)return expr(n);
    if([source,sourceActual,target,targetActual].some(type=>type.parameters.some(p=>p.named||!p.required)))blocked('Numeric function bridge requires required positional parameters',n);
    const signatureType=(declared:FunctionType,actual:FunctionType,host=false)=>f.createFunctionTypeNode(undefined,declared.parameters.map((p,index)=>f.createParameterDeclaration(undefined,undefined,'argument'+index,undefined,physicalType(p.type,actual.parameters[index]!.type,host))),physicalType(declared.returnType,actual.returnType,host));
    const sourceType=signatureType(source,sourceActual,host),targetType=signatureType(target,targetActual),callee=temporary(),parameters=target.parameters.map(()=>temporary());
    const invoke=f.createCallExpression(callee,undefined,parameters.map((parameter,index)=>functionConversion(parameter,target.parameters[index]!.type,targetActual.parameters[index]!.type,source.parameters[index]!.type,sourceActual.parameters[index]!.type,false,host)));
    const result=target.returnType.kind==='void'?f.createBlock([f.createExpressionStatement(invoke)],true):functionConversion(invoke,source.returnType,sourceActual.returnType,target.returnType,targetActual.returnType,host);
    const wrapper=f.createArrowFunction(undefined,undefined,parameters.map((parameter,index)=>f.createParameterDeclaration(undefined,undefined,parameter,undefined,physicalType(target.parameters[index]!.type,targetActual.parameters[index]!.type))),physicalType(target.returnType,targetActual.returnType),undefined,result);
    const key=(declared:FunctionType,actual:FunctionType,host=false)=>[...declared.parameters.map((p,index)=>[physicalKind(p.type,actual.parameters[index]!.type,host),actual.parameters[index]!.type.nullable]),[physicalKind(declared.returnType,actual.returnType,host),actual.returnType.nullable]];
    const create=(value:ts.Expression)=>f.createCallExpression(f.createIdentifier(numericFunctions!.bridge),[sourceType,targetType],[value,f.createStringLiteral(JSON.stringify([key(source,sourceActual,host),key(target,targetActual)])),f.createArrowFunction(undefined,undefined,[f.createParameterDeclaration(undefined,undefined,callee)],undefined,undefined,wrapper)]);
    return sourceActual.nullable?evaluateOnce(expr(n),value=>[f.createReturnStatement(f.createConditionalExpression(f.createBinaryExpression(value,ts.SyntaxKind.EqualsEqualsEqualsToken,f.createNull()),undefined,f.createNull(),undefined,create(value)))]):create(expr(n));
  }
  let caughtException:ts.Expression|undefined;
  function rejectSuspension(node:ts.Node):void {
    if(ts.isFunctionLike(node))return;
    if(ts.isAwaitExpression(node))blocked('Suspension in a synchronous lowering expression requires an async adapter');
    ts.forEachChild(node,rejectSuspension);
  }
  function evaluateOnce(value:ts.Expression,body:(target:ts.Identifier)=>ts.Statement[]):ts.Expression {
    const target=temporary(),previous=asyncContext;asyncContext=false;
    rejectSuspension(value);
    try{return f.createCallExpression(f.createParenthesizedExpression(f.createArrowFunction(undefined,undefined,[],undefined,undefined,f.createBlock([f.createVariableStatement(undefined,f.createVariableDeclarationList([f.createVariableDeclaration(target,undefined,undefined,value)],ts.NodeFlags.Const)),...body(target)],true))),undefined,[]);}finally{asyncContext=previous;}
  }
  const topGetters=declarations.filter((value):value is Declaration&{kind:'topGetter'}=>value.kind==='topGetter'),ownedTopGetters=new Map(topGetters.map(value=>[value.reference.id,value]));
  let getterNamespace:ts.Identifier|undefined;
  if(topGetters.length){
    const policy=recipe.topLevelGetters;
    if(policy?.policy!=='live-source-accessors'||!/^[$A-Z_a-z][$\w]*$/.test(policy.namespace)||['default','constructor','prototype','__proto__'].includes(policy.namespace)||importedTypes.has(policy.namespace)||[...locals].some(local=>name(local)===policy.namespace))blocked('Source top-level getters require a unique explicit live-accessor namespace');
    if(new Set(topGetters.map(value=>privateName(name(value.name),value.reference))).size!==topGetters.length||new Set(topGetters.map(value=>value.reference.id)).size!==topGetters.length)blocked('Source top-level getters require unique exact library/member identities');
    for(const value of topGetters)if(value.reference.owner!==null||!value.reference.id.endsWith(':GETTER')||recipe.adapters?.[value.reference.id]||recipe.values&&Object.hasOwn(recipe.values,value.reference.id)||recipe.memberBindings?.[value.reference.id])blocked('Owned top-level getter cannot also use an external/value/member mapping',value);
    if(declarations.some(value=>value.kind==='constant'&&!value.owner&&!value.reference?.constant))blocked('Live source getters require a separate lazy top-level variable initialization plan');
    getterNamespace=temporary();
  }else if(recipe.topLevelGetters)blocked('Live source-accessor namespace requires owned getter declarations');
  const sourceOperatorTargets=new Map<string,string>();
  if(recipe.sourceOperators){
    if(recipe.sourceOperators.policy!=='resolved-source-arithmetic')blocked('Unknown source arithmetic policy');
    const names:Record<string,string>={'+':'Add','-':'Subtract','unary-':'Negate','*':'Multiply','/':'Divide','~/':'TruncateDivide','%':'Modulo','<':'LessThan','>':'GreaterThan','<=':'LessThanOrEqual','>=':'GreaterThanOrEqual','&':'BitAnd','|':'BitOr','^':'BitXor','<<':'ShiftLeft','>>':'ShiftRight','>>>':'UnsignedShiftRight','~':'BitNot'};
    for(const owner of model.ordered)for(const method of owner.methods??[])if(method.operator&&method.name!=='=='&&method.name!=='[]'){
      const key=method.name==='-'&&method.parameters.length===0?'unary-':method.name;
      if(!Object.hasOwn(names,key)||method.reference.name!==key||method.static||method.getter||method.setter||method.parameters.length!==(['unary-','~'].includes(key)?0:1)||method.parameters.some(parameter=>parameter.named||!parameter.required)||method.typeParameters?.length||method.body?.async)blocked('Source arithmetic requires its exact synchronous source signature',method);
      if(recipe.adapters?.[method.reference.id]||Object.hasOwn(renames,method.name))blocked('Source arithmetic ownership conflicts with an explicit operator mapping',method);
      sourceOperatorTargets.set(method.reference.id,'dartOperator'+names[key]);
    }
    for(const owner of model.ordered)for(const method of owner.methods??[])if(sourceOperatorTargets.has(method.reference.id))for(const origin of method.overrideOrigins??[]){const slot=sourceOperatorTargets.get(origin.id),adapter=recipe.adapters?.[origin.id];if(slot!==sourceOperatorTargets.get(method.reference.id)&&!(adapter?.kind==='call'&&adapter.receiver==='target'&&adapter.target===sourceOperatorTargets.get(method.reference.id)))blocked('Source arithmetic override requires the exact owned or bound source slot',method);}
  }
  const memberName=(value:string,reference:Reference)=>sourceOperatorTargets.get(reference.id)??privateName(name(value==='=='?value:value.replace(/=$/,'')),reference);
  function propertyName(value:string,reference:Reference):string {
    const binding=recipe.memberBindings?.[reference.id];
    if(binding===undefined)return memberName(value,reference);
    if(reference.local||reference.static||!/:((GETTER)|(SETTER)|(FIELD))$/.test(reference.id)||!/^[$A-Z_a-z][$\w]*$/.test(binding))blocked('Invalid exact host property binding');
    return binding;
  }
  const interfaces=declarations.filter((n):n is Declaration&{kind:'mixinInterface'}=>n.kind==='mixinInterface');
  const enums=declarations.filter((n):n is Declaration&{kind:'enum'}=>n.kind==='enum');
  const aliases=declarations.filter((n):n is Declaration&{kind:'typeAlias'}=>n.kind==='typeAlias');
  const ownedAliases=new Map(aliases.map(n=>[n.reference.id,n]));
  if(ownedAliases.size!==aliases.length||new Set(aliases.map(n=>name(n.name))).size!==aliases.length)blocked('Source aliases require unique exact identities and emitted names');
  for(const alias of aliases)if(importedTypes.has(name(alias.name))||declarations.some(n=>n!==alias&&n.kind!=='method'&&n.name===alias.name))blocked('Source alias conflicts with an owning declaration/import: '+alias.name,alias);
  const aliasDone=new Set<string>(),aliasActive=new Set<string>();
  function aliasDependencies(value:ResolvedType):string[]{return [...value.alias&&ownedAliases.has(value.alias.reference.id)?[value.alias.reference.id]:[],...value.kind==='interface'?value.arguments.flatMap(aliasDependencies):value.kind==='function'?[...aliasDependencies(value.returnType),...value.parameters.flatMap(p=>aliasDependencies(p.type))]:value.kind==='record'?value.fields.flatMap(aliasDependencies):value.kind==='namedRecord'?[...value.positional.flatMap(aliasDependencies),...value.named.flatMap(field=>aliasDependencies(field.type))]:[]];}
  function visitAlias(id:string):void{if(aliasDone.has(id))return;if(aliasActive.has(id))blocked('Recursive source alias requires unsupported recursive type semantics: '+id);aliasActive.add(id);for(const next of aliasDependencies(ownedAliases.get(id)!.aliasedType))visitAlias(next);aliasActive.delete(id);aliasDone.add(id);}
  for(const alias of aliases)visitAlias(alias.reference.id);
  const interfaceIds=new Set(interfaces.map(n=>n.reference.id));
  const typeParameters=new Map<string,string>(),ownedTypes=new Map([...model.ordered,...interfaces,...enums].map(n=>[n.reference.id,name(n.name)]));
  const ownedMember=(reference:Reference)=>model.member(reference)??interfaces.flatMap(owner=>owner.methods).find(method=>method.reference.id===reference.id);
  let currentClass:(Declaration&{kind:'class'})|null=null,staticContext=false,initializing=false;
  const witnessBinding=recipe.methodTypeWitnesses,witnessMethods=new Set(witnessBinding?.methods??[]),typeWitnesses=new Map<string,ts.Expression>();
  const genericFunctionValues=recipe.genericFunctionValues;
  if(genericFunctionValues&&(genericFunctionValues.policy!=='checked-generic-function-type-witness'||!witnessBinding||numericFunctions))blocked('Generic function values require the common checked witness ABI without an unqualified numeric function bridge');
  const classWitnessBinding=recipe.classTypeWitnesses,witnessClasses=new Set([...(classWitnessBinding?.classes??[]),...recipe.sourceMixinApplications?model.ordered.filter(owner=>owner.sourceMixinOwner||owner.sourceMixinApplication).map(owner=>owner.reference.id):[]]);
  const mixinRegistries=new Map(model.ordered.filter(owner=>owner.sourceMixinOwner).map(owner=>[owner.reference.id,temporary()]));
  if(recipe.sourceMixinApplications&&(!classWitnessBinding||!witnessBinding||!imported.has(recipe.sourceMixinApplications.hasCaptured)||locals.has('globalThis')||imported.has('globalThis')))blocked('Source mixin applications require captured class witnesses, an imported capture predicate and the global Symbol boundary');
  const constructorOwnerTokens=new Map<string,ts.Expression>();
  const fieldBackingNames=new Map<string,string>();
  const ownerValue=(owner:Declaration&{kind:'class'})=>constructorOwnerTokens.get(owner.reference.id)??f.createIdentifier(name(owner.name));
  let constructorWitnesses:Map<string,ts.Expression>|null=null;
  if(classWitnessBinding){
    if(!witnessBinding||classWitnessBinding.policy!=='captured-class-type-witness'||![classWitnessBinding.apply,classWitnessBinding.capture,classWitnessBinding.read].every(symbol=>imported.has(symbol)))blocked('Class type witnesses require the imported common witness and capture boundary');
    if(!witnessClasses.size||new Set(classWitnessBinding.classes).size!==classWitnessBinding.classes.length)blocked('Class type witnesses require unique exact class identities');
    for(const id of witnessClasses){const owner=model.classes.get(id);if(!owner||model.sourceMixins.has(id)&&!owner.mixinClass||model.sourceEnums.has(id)||recipe.adapters?.[owner.constructor.reference?.id??'']||owner.namedConstructors?.some(ctor=>recipe.adapters?.[ctor.reference.id])||owner.sourceFactories?.unnamed&&recipe.adapters?.[owner.sourceFactories.unnamed.reference.id])blocked('Class type witness ABI requires an owned class with supported generative/factory entries: '+id);if(Object.hasOwn(witnessBinding!.types,id)||Object.hasOwn(witnessBinding!.applications,id))blocked('Owned class witness cannot also use an external type binding: '+id);}
    for(const owner of model.ordered)if(!witnessClasses.has(owner.reference.id)&&[owner.superclass?.type,...owner.interfaces??[],...owner.mixins??[]].some(type=>type?.kind==='interface'&&witnessClasses.has(type.reference.id)))blocked('Class witness requires every generated implementation/descendant: '+owner.reference.id);
  }
  if(witnessBinding){
    const methods=model.ordered.flatMap(owner=>owner.methods??[]);
    if(witnessBinding.policy!=='checked-method-type-witness'||!importedTypes.has(witnessBinding.type)||![witnessBinding.is,witnessBinding.cast,witnessBinding.nullable,...Object.values(witnessBinding.types),...Object.values(witnessBinding.applications).map(v=>v.factory)].every(symbol=>imported.has(symbol)))blocked('Method type witnesses require explicitly imported host boundaries');
    if(!witnessMethods.size&&!witnessClasses.size&&!genericFunctionValues&&!Object.keys(recipe.externalStaticMethods??{}).length&&!Object.values(recipe.constantConstructors??{}).some(binding=>binding.policy==='canonical-generated-external')||witnessMethods.size!==witnessBinding.methods.length)blocked('Method type witnesses require unique exact method identities');
    for(const id of witnessMethods){
      const method=methods.find(value=>value.reference.id===id);
      const standalone=declarations.filter((value):value is Declaration&{kind:'function'|'method'}=>(value.kind==='function'||value.kind==='method')&&value.reference?.id===id);
      if(standalone.length){if(standalone.length!==1||method||!standalone[0]!.typeParameters?.length||recipe.adapters?.[id]||methods.some(other=>other.overrideOrigins?.some(origin=>origin.id===id)))blocked('Standalone type witness ABI requires one exact generated generic declaration: '+id);continue;}
      if(!method?.typeParameters?.length||method.abstract||method.overrides||method.getter||method.setter||method.operator||recipe.adapters?.[id]||methods.some(other=>other.overrideOrigins?.some(origin=>origin.id===id)))blocked('Method type witness ABI requires a concrete non-overridden generated generic method: '+id);
    }
    for(const[id,application]of Object.entries(witnessBinding.applications))if(Object.hasOwn(witnessBinding.types,id)||!Number.isSafeInteger(application.arity)||application.arity<1)blocked('Invalid exact generic type witness application: '+id);
  }
  function substituteWitnessType(value:ResolvedType,parameters:Map<string,ResolvedType>):ResolvedType{
    if(value.kind==='parameter'){const argument=parameters.get(value.reference.id);return argument?{...argument,nullable:argument.nullable||value.nullable}:value;}
    if(value.kind==='interface')return {...value,arguments:value.arguments.map(type=>substituteWitnessType(type,parameters))};
    return value;
  }
  function withGenericFunction<R>(selected:ClassTypeParameter[],emit:(generics:ts.TypeParameterDeclaration[],witnesses:ts.ParameterDeclaration[])=>R):R{
    if(!genericFunctionValues||!witnessBinding||!selected.length)blocked('Generic function type requires an explicitly qualified checked function-value ABI');
    if(new Set(selected.map(p=>p.reference.id)).size!==selected.length||new Set(selected.map(p=>p.name)).size!==selected.length||selected.some(p=>typeParameters.has(p.reference.id)))blocked('Generic function parameters require unique analyzer identities and lexical scope');
    if(selected.some(p=>!p.bound)&&recipe.implicitTypeParameterBound!=='dart-object-nullable')blocked('Generic function implicit bounds require the reviewed Dart Object? policy');
    const priorTypes=new Map(typeParameters),priorMethods=new Set(methodTypeParameters),priorWitnesses=new Map(typeWitnesses);
    try{
      for(const parameter of selected){typeParameters.set(parameter.reference.id,[...typeParameters.values()].includes(parameter.name)?temporary().text:parameter.name);methodTypeParameters.add(parameter.reference.id);}
      const generics=selected.map(p=>f.createTypeParameterDeclaration(undefined,typeParameters.get(p.reference.id)!,p.bound?argumentType(p.bound):f.createUnionTypeNode([f.createTypeLiteralNode([]),f.createLiteralTypeNode(f.createNull())])));
      const witnesses=selected.map(p=>{const token=temporary();typeWitnesses.set(p.reference.id,token);return f.createParameterDeclaration(undefined,undefined,token,undefined,f.createTypeReferenceNode(witnessBinding!.type,[f.createTypeReferenceNode(typeParameters.get(p.reference.id)!)]));});
      return emit(generics,witnesses);
    }finally{typeParameters.clear();for(const[id,value]of priorTypes)typeParameters.set(id,value);methodTypeParameters.clear();for(const id of priorMethods)methodTypeParameters.add(id);typeWitnesses.clear();for(const[id,value]of priorWitnesses)typeWitnesses.set(id,value);}
  }
  function typeWitness(value:ResolvedType,trail:string[]=[]):ts.Expression{
    if(numericValues&&!numericGenerics&&numericKind(value))blocked('Numeric generic witness requires boxed type-argument lowering');
    if(!witnessBinding)blocked('Runtime generic type requires an explicit method witness boundary');
    let token:ts.Expression;
    if(value.kind==='parameter'){
      if(value.promotedBound)blocked('Promoted generic runtime witness requires an explicit intersection representation');
      if(!typeParameters.has(value.reference.id))blocked('Runtime type parameter escaped its selected method scope: '+value.reference.id);
      if(methodTypeParameters.has(value.reference.id)){
        const local=typeWitnesses.get(value.reference.id);if(!local)blocked('Runtime type parameter has no selected method witness: '+value.reference.id);token=local;
      }else{
        const index=currentClass?.typeParameters.findIndex(p=>p.reference.id===value.reference.id)??-1;
        if(!currentClass||!witnessClasses.has(currentClass.reference.id)||index<0||staticContext)blocked('Runtime type parameter escaped its selected method scope: '+value.reference.id);
        token=constructorWitnesses?.get(value.reference.id)??f.createCallExpression(f.createIdentifier(classWitnessBinding!.read),[f.createTypeReferenceNode(typeParameters.get(value.reference.id)!)],[f.createThis(),ownerValue(currentClass!),f.createNumericLiteral(index)]);
        if(initializing&&!constructorWitnesses)blocked('Class witness cannot observe this before capture');
      }
    }else if(value.kind==='interface'){
      const key=collectionTypeKey(value);if(trail.includes(key))blocked('Recursive nominal type witness projection requires an explicit rule: '+key);const nested=[...trail,key];
      if(witnessClasses.has(value.reference.id)){
        const owner=model.classes.get(value.reference.id)!;
        if(value.arguments.length!==owner.typeParameters.length)blocked('Owned runtime type requires exact resolved class arguments: '+value.reference.id);
        const parameters=new Map(owner.typeParameters.map((p,index)=>[p.reference.id,value.arguments[index]!]));
        const parents=[owner.superclass?.type,...owner.interfaces??[],...owner.mixins??[]].filter((type):type is ResolvedType=>Boolean(type)&&!(type?.kind==='interface'&&type.reference.id==='dart:core::Object:CLASS'));
        token=f.createCallExpression(f.createIdentifier(classWitnessBinding!.apply),[resolvedType({...value,nullable:false})],[ownerValue(owner),f.createStringLiteral(owner.name),f.createArrayLiteralExpression(value.arguments.map(type=>typeWitness(type,nested))),f.createArrayLiteralExpression(parents.map(type=>typeWitness(substituteWitnessType(type,parameters),nested)))]);
      }else if(value.arguments.length){
        const application=witnessBinding!.applications[value.reference.id];
        if(!application||application.arity!==value.arguments.length)blocked('Generic runtime type requires an exact witness application: '+value.reference.id);
        token=f.createCallExpression(f.createIdentifier(application.factory),value.arguments.map(argumentType),value.arguments.map(type=>typeWitness(type,nested)));
      }else{
        const binding=witnessBinding!.types[value.reference.id];if(!binding)blocked('Resolved type has no explicit runtime witness: '+value.reference.id);token=f.createIdentifier(binding);
      }
    }else return blocked('Runtime witness type shape is unsupported: '+value.kind);
    return value.nullable?f.createCallExpression(f.createIdentifier(witnessBinding!.nullable),[argumentType({...value,nullable:false})],[token]):token;
  }
  const witnessedFields=new Map<string,{owner:Declaration&{kind:'class'};type:ResolvedType}>();
  if(recipe.fieldTypeWitnesses){
    const binding=recipe.fieldTypeWitnesses;
    if(binding.policy!=='checked-field-type-application'||!witnessBinding||!classWitnessBinding||!binding.fields.length||new Set(binding.fields).size!==binding.fields.length)blocked('Field type applications require unique exact fields and captured owner witnesses');
    for(const id of binding.fields){
      const candidates=model.ordered.filter(owner=>owner.fields.some(field=>field.reference.id===id)),owner=candidates.find(owner=>owner.sourceMixinOwner)??candidates[0],field=owner?.fields.find(field=>field.reference.id===id);
      if(!owner||!field||!witnessClasses.has(owner.reference.id)||field.static||field.final||field.type.kind!=='interface'||!field.type.arguments.length)blocked('Field type application requires an owned mutable nested interface field: '+id);
      const parameters=new Set<string>();const collect=(type:ResolvedType):void=>{if(type.kind==='parameter')parameters.add(type.reference.id);else if(type.kind==='interface')type.arguments.forEach(collect);};collect(field.type);
      if(!parameters.size||[...parameters].some(id=>!owner.typeParameters.some(parameter=>parameter.reference.id===id)))blocked('Field type application requires exact lexical owner arguments: '+id);
      const entry={owner,type:field.type};witnessedFields.set(id,entry);witnessedFields.set(id.replace(/:FIELD$/,':SETTER'),entry);
    }
  }
  function receiverFieldWitness(owner:Declaration&{kind:'class'},type:ResolvedType,target:ts.Identifier):ts.Expression{
    const priorTypes=new Map(typeParameters),priorMethods=new Set(methodTypeParameters),priorClass=currentClass,priorStatic=staticContext,priorConstructor=constructorWitnesses;
    try{
      typeParameters.clear();methodTypeParameters.clear();currentClass=owner;staticContext=false;
      constructorWitnesses=new Map(owner.typeParameters.map((parameter,index)=>{typeParameters.set(parameter.reference.id,parameter.name);return[parameter.reference.id,f.createCallExpression(f.createIdentifier(classWitnessBinding!.read),undefined,[target,ownerValue(owner),f.createNumericLiteral(index)])];}));
      const token=typeWitness(type);
      // Runtime metadata belongs to the receiver, whose lexical type parameter
      // names need not exist in the writer. Preserve all runtime applications
      // while omitting only the factory call's TypeScript type arguments.
      const transformed=ts.transform(token,[(context:ts.TransformationContext)=>(root:ts.Expression)=>{
        const visit:ts.Visitor=node=>{const next=ts.visitEachChild(node,visit,context);return ts.isCallExpression(next)?f.updateCallExpression(next,next.expression,undefined,next.arguments):next;};
        return ts.visitNode(root,visit,ts.isExpression)!;
      }]);try{return transformed.transformed[0]!;}finally{transformed.dispose();}
    }finally{typeParameters.clear();for(const[id,value]of priorTypes)typeParameters.set(id,value);methodTypeParameters.clear();for(const id of priorMethods)methodTypeParameters.add(id);currentClass=priorClass;staticContext=priorStatic;constructorWitnesses=priorConstructor;}
  }
  const constructorHelpers:ts.Statement[]=[];
  function numericTags(tag:string,info:NumericSource|null|undefined):string[] {
    if(!info)return [];
    // Escape JSDoc termination even for a future frontend display format.
    const clean=(value:string)=>value.replaceAll('*/','* /').replace(/[\r\n]/g,' ');
    return [tag+' '+clean(info.type),(tag.startsWith('@dartParam ')?'@dartParamOrigin '+tag.slice(11):tag==='@dartReturn'?'@dartReturnOrigin':'@dartTypeOrigin')+' '+(info.inferred?'inferred':'explicit'),...info.bounds.map(bound=>'@dartBound '+clean(bound.name)+' '+clean(bound.type))];
  }
  function documented<T extends ts.Node>(node:T,tags:string[]):T {
    return tags.length?ts.addSyntheticLeadingComment(node,ts.SyntaxKind.MultiLineCommentTrivia,'*\n'+tags.map(tag=>' * '+tag).join('\n')+'\n ',true):node;
  }
  function valueDoc<T extends ts.Node>(node:T,info:NumericSource|null|undefined):T {return documented(node,numericTags('@dartType',info));}
  function callableDoc<T extends ts.Node>(node:T,params:Parameter[],result?:NumericSource|null):T {
    return documented(node,[...params.flatMap(param=>numericTags('@dartParam '+param.name,param.numeric)),...numericTags('@dartReturn',result)]);
  }
  function sourceType(value:string,info?:NumericSource|null,resolved?:ResolvedType):ts.TypeNode {
    if(resolved?.kind==='dynamic')return resolvedType(resolved);
    if(resolved?.alias&&ownedAliases.has(resolved.alias.reference.id))return resolvedType(resolved);
    if(resolved?.kind==='interface'&&resolved.reference.id==='dart:core::Null:CLASS')return resolvedType(resolved);
    if(resolved&&(resolved.kind==='parameter'||resolved.kind==='record'||resolved.kind==='namedRecord'||resolved.kind==='function'||resolved.kind==='interface'&&(resolved.arguments.length>0||resolved.reference.id==='dart:async::Future:CLASS'||recipe.typeBindings?.[resolved.reference.id])))return resolvedType(resolved);
    // Structured numeric collections and bounded parameters use resolved identities.
    return info?.resolvedType&&(info.resolvedType.kind==='parameter'||info.resolvedType.kind==='interface'&&info.resolvedType.arguments.length>0)?resolvedType(info.resolvedType):type(value);
  }
  function integerCheck():ts.Expression{const adapter=recipe.numericTypes?.int;if(!adapter||adapter.representation!=='safe-number'||!imported.has(adapter.check.split('.')[0]!))return blocked('Safe integer representation requires an explicitly imported checking adapter');return dotted(adapter.check);}
  function numericType(value:'int'|'num'):ts.TypeNode{if(value==='int'){integerCheck();return f.createKeywordTypeNode(ts.SyntaxKind.NumberKeyword);}if(numericValues)return f.createTypeReferenceNode(numericValues.numType);if(recipe.numericTypes?.num?.representation==='double')return f.createKeywordTypeNode(ts.SyntaxKind.NumberKeyword);return blocked('Unbounded Dart num needs an explicit numeric representation adapter');}
  function recordBoundary(){const binding=recipe.records;if(binding?.policy!=='immutable-positional-record'||!importedTypes.has(binding.type)||!imported.has(binding.create)||!imported.has(binding.read))return blocked('Records require an imported immutable positional boundary');return binding;}
  function namedRecordBoundary(){const binding=recipe.namedRecords;if(binding?.policy!=='immutable-named-record'||!importedTypes.has(binding.type)||!imported.has(binding.create)||!imported.has(binding.read))return blocked('Named records require an imported exact immutable shape boundary');return binding;}
  function validateRecordShape(shape:{arity:number;names:readonly string[];fields:readonly{key:string|number}[]}):void {
    if(!Number.isSafeInteger(shape.arity)||shape.arity<0||shape.fields.length!==shape.arity+shape.names.length)blocked('Record shape has an invalid source field count');
    const expected=[...Array.from({length:shape.arity},(_,index)=>index),...shape.names];
    if(!expected.length||new Set(shape.names).size!==shape.names.length||shape.names.some(name=>typeof name!=='string'||!name)||new Set(shape.fields.map(field=>field.key)).size!==expected.length||expected.some(key=>!shape.fields.some(field=>field.key===key)))blocked('Record matching requires an exact nonempty positional/named source shape');
  }
  function readRecordField(value:ts.Expression,key:string|number,arity:number,names:readonly string[]):ts.Expression {
    const named=names.length>0,binding=named?namedRecordBoundary():recordBoundary(),unknowns=f.createTypeOperatorNode(ts.SyntaxKind.ReadonlyKeyword,f.createArrayTypeNode(f.createKeywordTypeNode(ts.SyntaxKind.UnknownKeyword))),stored=f.createAsExpression(value,f.createTypeReferenceNode(binding.type,named?[unknowns,f.createTypeReferenceNode('Record',[f.createKeywordTypeNode(ts.SyntaxKind.StringKeyword),f.createKeywordTypeNode(ts.SyntaxKind.UnknownKeyword)])]:[unknowns])),args:ts.Expression[]=[stored,typeof key==='number'?f.createNumericLiteral(key):f.createStringLiteral(key),f.createNumericLiteral(arity)];
    if(named)args.push(f.createArrayLiteralExpression(names.map(name=>f.createStringLiteral(name))));return f.createCallExpression(f.createIdentifier(binding.read),undefined,args);
  }
  function namedRecordTypes(value:ResolvedType&{kind:'namedRecord'}):ts.TypeNode[]{
    if(!value.named.length||new Set(value.named.map(field=>field.name)).size!==value.named.length)blocked('Invalid named record type shape');
    return [f.createTupleTypeNode(value.positional.map(argumentType)),f.createTypeLiteralNode(value.named.map(field=>f.createPropertySignature([f.createModifier(ts.SyntaxKind.ReadonlyKeyword)],f.createStringLiteral(field.name),undefined,argumentType(field.type))))];
  }
  function resolvedType(value:ResolvedType):ts.TypeNode {
    if(value.alias){
      const alias=ownedAliases.get(value.alias.reference.id);
      if(alias){
        if(value.alias.arguments.length!==alias.typeParameters.length)blocked('Source alias application requires exact resolved arity');
        if(alias.aliasedType.kind==='function'&&value.alias.arguments.some(argument=>numericKind(argument)))blocked('Concrete numeric function alias requires a separately qualified source function representation');
        const result=f.createTypeReferenceNode(name(alias.name),value.alias.arguments.map(argumentType));
        return value.nullable?f.createUnionTypeNode([result,f.createLiteralTypeNode(f.createNull())]):result;
      }
    }
    if(numericValues&&!numericGenerics&&value.kind==='interface'&&value.arguments.some(type=>numericKind(type)!==undefined))blocked('Numeric generic arguments require boxed type-argument lowering');
    let result:ts.TypeNode;
    if(value.kind==='dynamic'){if(recipe.dynamicValues?.policy!=='checked-erased-values'||!numericGenerics)blocked('Dart dynamic storage requires reviewed unknown values and numeric provenance');return f.createKeywordTypeNode(ts.SyntaxKind.UnknownKeyword);}
    if(value.kind==='parameter'){
      if(staticContext&&!methodTypeParameters.has(value.reference.id))blocked('Class type parameter cannot enter a static context');
      const local=typeParameters.get(value.reference.id);if(!local)return blocked('Type parameter escaped its resolved class scope: '+value.reference.id);
      result=f.createTypeReferenceNode(local);
      if(value.promotedBound)result=f.createIntersectionTypeNode([result,resolvedType(value.promotedBound)]);
    }else if(value.kind==='function'){
      if(value.typeParameters?.length)return withGenericFunction(value.typeParameters,(generics,witnesses)=>{
        const {typeParameters:_,...monomorphic}=value;
        const plain=resolvedType({...monomorphic,nullable:false});if(!ts.isFunctionTypeNode(plain))blocked('Generic function requires a resolved callable shape');
        const result=f.createFunctionTypeNode(generics,[...witnesses,...plain.parameters],plain.type);
        return value.nullable?f.createUnionTypeNode([result,f.createLiteralTypeNode(f.createNull())]):result;
      });
      const positional=value.parameters.filter(p=>!p.named),named=value.parameters.filter(p=>p.named);
      const params=positional.map((p,index)=>f.createParameterDeclaration(undefined,undefined,'argument'+index,p.required?undefined:f.createToken(ts.SyntaxKind.QuestionToken),resolvedType(p.type)));
      if(named.length)params.push(f.createParameterDeclaration(undefined,undefined,'options',named.some(p=>p.required)?undefined:f.createToken(ts.SyntaxKind.QuestionToken),f.createTypeLiteralNode(named.map(p=>f.createPropertySignature(undefined,p.name,p.required?undefined:f.createToken(ts.SyntaxKind.QuestionToken),resolvedType(p.type))))));
      result=f.createFunctionTypeNode(undefined,params,resolvedType(value.returnType));
    }else if(value.kind==='record')result=f.createTypeReferenceNode(recordBoundary().type,[f.createTupleTypeNode(value.fields.map(argumentType))]);
    else if(value.kind==='namedRecord')result=f.createTypeReferenceNode(namedRecordBoundary().type,namedRecordTypes(value));
    else if(value.kind==='void'||value.kind==='never')result=f.createKeywordTypeNode(value.kind==='void'?ts.SyntaxKind.VoidKeyword:ts.SyntaxKind.NeverKeyword);
    else{
      const id=value.reference.id,primitives:Record<string,ts.KeywordTypeSyntaxKind>={'dart:core::double:CLASS':ts.SyntaxKind.NumberKeyword,'dart:core::bool:CLASS':ts.SyntaxKind.BooleanKeyword,'dart:core::String:CLASS':ts.SyntaxKind.StringKeyword};
      if(Object.hasOwn(primitives,id)){if(value.arguments.length)blocked('Primitive type arguments are invalid');result=f.createKeywordTypeNode(primitives[id]!);}
      else if(id==='dart:core::Object:CLASS')result=f.createTypeLiteralNode([]);
      else if(id==='dart:core::Null:CLASS')result=f.createLiteralTypeNode(f.createNull());
      else if(id==='dart:core::int:CLASS'||id==='dart:core::num:CLASS')result=numericType(id==='dart:core::int:CLASS'?'int':'num');
      else if(id==='dart:core::Duration:CLASS'&&recipe.durationUnit==='milliseconds')result=f.createKeywordTypeNode(ts.SyntaxKind.NumberKeyword);
      else if(id==='dart:async::Future:CLASS'){
        const runtime=recipe.asyncRuntime;if(!runtime||runtime.policy!=='host-promise'||!importedTypes.has(runtime.futureType)||value.arguments.length!==1)blocked('Future requires an explicitly imported host-promise type boundary');
        result=f.createTypeReferenceNode(runtime!.futureType,value.arguments.map(resolvedType));
      }
      else{
        const mapped=ownedTypes.get(id)??recipe.typeBindings?.[id];if(!mapped||!ownedTypes.has(id)&&!importedTypes.has(mapped))return blocked('Qualified resolved type has no imported binding: '+id);
        result=f.createTypeReferenceNode(mapped,value.arguments.map(argumentType));
      }
    }
    return value.nullable?f.createUnionTypeNode([result,f.createLiteralTypeNode(f.createNull())]):result;
  }
  function type(value:string):ts.TypeNode {
    if(value.endsWith('?'))return f.createUnionTypeNode([type(value.slice(0,-1)),f.createLiteralTypeNode(f.createNull())]);
    if(value==='Object')return f.createTypeLiteralNode([]);
    if(value==='int'||value==='num')return numericType(value);
    const keyword:Record<string,ts.KeywordTypeSyntaxKind>={double:ts.SyntaxKind.NumberKeyword,num:ts.SyntaxKind.NumberKeyword,int:ts.SyntaxKind.NumberKeyword,bool:ts.SyntaxKind.BooleanKeyword,String:ts.SyntaxKind.StringKeyword,void:ts.SyntaxKind.VoidKeyword,Never:ts.SyntaxKind.NeverKeyword};
    if(Object.hasOwn(keyword,value))return f.createKeywordTypeNode(keyword[value]!);
    if(value==='Float64List')return f.createTypeReferenceNode('Float64Array');
    if(value==='Duration'&&recipe.durationUnit==='milliseconds')return f.createKeywordTypeNode(ts.SyntaxKind.NumberKeyword);
    if(importedTypes.has(value)||classNames[value]||model.ordered.some(n=>n.name===value)||enums.some(n=>n.name===value))return f.createTypeReferenceNode(name(value));
    return blocked('Unmapped resolved type '+value);
  }
  const lateLocals=new Map<string,string>();
  const localKey=(reference:Reference)=>reference.id+'@'+reference.declarationOffset;
  function collectLateLocals(value:unknown):void{
    if(Array.isArray(value)){value.forEach(collectLateLocals);return;}if(!value||typeof value!=='object')return;
    const node=value as Record<string,unknown>;
    if(node.kind==='variables'&&node.late){for(const variable of (node.variables as Variable[])){const ref=variable.reference;if(!ref?.local||!Number.isSafeInteger(ref.declarationOffset)||ref.declarationOffset!<0)blocked('Late local requires an exact analyzer declaration identity');const key=localKey(ref!);if(lateLocals.has(key)&&lateLocals.get(key)!==variable.name)blocked('Conflicting late local identity');lateLocals.set(key,variable.name);}}
    Object.values(node).forEach(collectLateLocals);
  }
  declarations.forEach(collectLateLocals);
  function identifier(value:string,reference:Reference|null):ts.Expression {
    if(reference?.local)return lateLocals.has(localKey(reference))?f.createPropertyAccessExpression(f.createIdentifier(value),'value'):f.createIdentifier(value);
    const hostMember=reference&&recipe.memberBindings?.[reference.id];
    if(hostMember){if(!currentClass||staticContext||initializing||!/^[$A-Z_a-z][$\w]*$/.test(hostMember))blocked('Invalid inherited host member binding');return f.createPropertyAccessExpression(f.createThis(),hostMember);}
    if(reference&&currentClass&&!reference.static&&model.member(reference,model.classes.get(currentClass.reference.id)??currentClass)){if(staticContext||initializing)blocked('Instance member in a static/initializer context: '+reference.id);return f.createPropertyAccessExpression(f.createThis(),memberName(value,reference));}
    if(reference?.owner&&reference.static){if(!classNames[reference.owner]&&!imported.has(reference.owner)&&!model.member(reference)&&!enums.some(n=>n.values.some(v=>v.reference.id===reference.id||v.reference.id.replace(/:FIELD$/,':GETTER')===reference.id)||reference.id===n.reference.id.replace(/:ENUM$/,'.values:GETTER')))blocked('Unmapped static owner '+reference.id);return f.createPropertyAccessExpression(dotted(name(reference.owner)),memberName(value,reference));}
    if(locals.has(value)||imported.has(value)||classNames[value])return dotted(name(value));
    return blocked('Unmapped resolved reference '+(reference?.id??value));
  }
  function scalar(value:string):boolean{return ['double','num','int','bool','String','Null'].includes(value.replace(/\?$/,''));}
  function argumentValue(value:Argument,fallback?:ResolvedType):ts.Expression{return transferred(value.value,value.parameterType??fallback,value.appliedParameterType??fallback);}
  function args(values:Argument[]):ts.Expression[]{if(values.some(v=>v.name!==null))blocked('Named calls require an explicit adapter');return values.map(v=>argumentValue(v));}
  function classArgs(values:Argument[],parameters:Parameter[]):ts.Expression[]{
    const positional=values.filter(value=>value.name===null),named=values.filter(value=>value.name!==null),positionalParameters=parameters.filter(value=>!value.named),namedParameters=parameters.filter(value=>value.named);
    if(values.some((value,index)=>value.name===null&&values.slice(0,index).some(previous=>previous.name!==null))||positional.length>positionalParameters.length||positional.length<positionalParameters.filter(value=>value.required).length||new Set(named.map(value=>value.name)).size!==named.length||named.some(value=>!namedParameters.some(parameter=>parameter.name===value.name))||namedParameters.some(parameter=>parameter.required&&!named.some(value=>value.name===parameter.name)))blocked('Resolved call shape differs from its parameters');
    // Keep written named-argument order: evaluating in parameter order changes side effects.
    const result=positional.map((value,index)=>argumentValue(value,positionalParameters[index]!.resolvedType));
    if(named.length){while(result.length<positionalParameters.length)result.push(f.createIdentifier('undefined'));result.push(f.createObjectLiteralExpression(named.map(value=>f.createPropertyAssignment(value.name!,argumentValue(value,namedParameters.find(p=>p.name===value.name)!.resolvedType)))));}
    return result;
  }
  function adapted(reference:Reference|null,values:Argument[],receiver?:Expression|null,override?:NonNullable<ModuleRecipe['adapters']>[string]):ts.Expression|undefined {
    const adapter=override??(reference&&recipe.adapters?.[reference.id]);if(!adapter)return;
    let values_:ts.Expression[];
    if(adapter.numericAbi){
      if(!numericFunctions||adapter.numericAbi!=='scalar-numeric'||adapter.kind!=='call'||adapter.receiver||adapter.namedArguments||adapter.typeArguments?.length||!imported.has(adapter.target)||!reference||!(reference.id.endsWith(':FUNCTION')||reference.static&&reference.id.endsWith(':METHOD')))blocked('Scalar numeric host requires an exact imported top-level/static callable');
      values_=values.map(argument=>{
        if(argument.name||!argument.parameterType||!argument.appliedParameterType)blocked('Scalar numeric host requires resolved positional parameter provenance',argument.value);
        if(!numericKind(argument.parameterType))return argumentValue(argument);
        const actual=argument.value.numeric?.resolvedType;
        if(argument.value.kind==='literal'&&argument.value.value===null&&argument.parameterType.nullable)return f.createNull();
        if(!actual)blocked('Scalar numeric host argument requires source numeric provenance',argument.value);
        return functionConversion(expr(argument.value),actual,actual,argument.parameterType,argument.appliedParameterType,false,true);
      });
    }
    else if(adapter.namedArguments==='options'){if(values.some(value=>value.name===null))blocked('Options adapter requires exclusively named arguments');values_=[f.createObjectLiteralExpression(values.map(value=>f.createPropertyAssignment(value.name!,argumentValue(value))))];}
    else if(adapter.namedArguments==='trailing-options'){const first=values.findIndex(value=>value.name!==null);if(first<0)values_=args(values);else{if(values.slice(first).some(value=>value.name===null))blocked('Adapter positional arguments must precede named arguments');values_=[...args(values.slice(0,first)),f.createObjectLiteralExpression(values.slice(first).map(value=>f.createPropertyAssignment(value.name!,argumentValue(value))))];}}
    else values_=args(values);
    if(adapter.receiver==='first'){if(!receiver)blocked('Instance adapter has no receiver: '+reference!.id);values_.unshift(expr(receiver!));}
    if(adapter.receiver==='owner'){if(!currentClass||staticContext||initializing)blocked('Owner adapter requires a live instance body');values_.unshift(f.createThis());}
    if(adapter.receiver==='target'){if(!receiver||adapter.kind!=='call'||!/^[$A-Z_a-z][$\w]*$/.test(adapter.target))blocked('Method adapter requires a receiver, call and simple member name');return f.createCallExpression(f.createPropertyAccessExpression(expr(receiver!),adapter.target),undefined,values_);}
    if(adapter.kind==='identity'){if(values_.length!==2)blocked('identity requires two operands');return f.createBinaryExpression(values_[0]!,ts.SyntaxKind.EqualsEqualsEqualsToken,values_[1]!);}
    return adapter.kind==='new'?f.createNewExpression(dotted(adapter.target),undefined,values_):f.createCallExpression(dotted(adapter.target),undefined,values_);
  }
  const binary:Record<string,ts.BinaryOperator>={'+':ts.SyntaxKind.PlusToken,'-':ts.SyntaxKind.MinusToken,'*':ts.SyntaxKind.AsteriskToken,'/':ts.SyntaxKind.SlashToken,'==':ts.SyntaxKind.EqualsEqualsEqualsToken,'!=':ts.SyntaxKind.ExclamationEqualsEqualsToken,'<':ts.SyntaxKind.LessThanToken,'>':ts.SyntaxKind.GreaterThanToken,'<=':ts.SyntaxKind.LessThanEqualsToken,'>=':ts.SyntaxKind.GreaterThanEqualsToken,'??':ts.SyntaxKind.QuestionQuestionToken,'&&':ts.SyntaxKind.AmpersandAmpersandToken,'||':ts.SyntaxKind.BarBarToken,'=':ts.SyntaxKind.EqualsToken,'+=':ts.SyntaxKind.PlusEqualsToken,'-=':ts.SyntaxKind.MinusEqualsToken,'*=':ts.SyntaxKind.AsteriskEqualsToken,'/=':ts.SyntaxKind.SlashEqualsToken};
  function methodTearOff(n:Expression&{kind:'identifier'|'property'}):ts.Expression {
    const binding=recipe.methodTearOff,reference=n.reference!;
    if(!binding||binding.policy!=='receiver-method-identity'||!imported.has(binding.bind))blocked('Instance method tear-off requires an imported receiver/identity adapter',n);
    if(n.functionType?.kind!=='function'||n.functionType.typeParameters?.length)blocked('Method tear-off requires a resolved non-generic signature',n);
    const method=ownedMember(reference),adapter=recipe.adapters?.[reference.id];
    if(adapter&&(!adapter.receiver||adapter.receiver!=='target'||adapter.kind!=='call'||adapter.typeArguments?.length))blocked('Method tear-off requires an exact target-method adapter',n);
    if(adapter&&n.functionType?.kind==='function'&&n.functionType.parameters.some(p=>p.named)&&adapter.namedArguments!=='trailing-options'&&!(adapter.namedArguments==='options'&&n.functionType.parameters.every(p=>p.named)))blocked('Named method tear-off requires the matching options calling convention',n);
    if(!method&&!adapter)blocked('External method tear-off requires an exact target-method adapter: '+reference.id,n);
    const property=adapter?.target??memberName(n.name,reference);
    if(!/^[$A-Z_a-z][$\w]*$/.test(property))blocked('Method tear-off requires a simple method name',n);
    if(n.kind==='identifier'){
      if(!currentClass||staticContext||initializing||!model.member(reference,currentClass)&&!adapter)blocked('Implicit method tear-off requires a live owner',n);
      return f.createCallExpression(f.createIdentifier(binding!.bind),undefined,[f.createThis(),f.createPropertyAccessExpression(f.createThis(),property)]);
    }
    if(n.target.kind==='super'){
      expr(n.target); // Validate lexical super ownership before binding its implementation to this.
      return f.createCallExpression(f.createIdentifier(binding!.bind),undefined,[f.createThis(),f.createPropertyAccessExpression(f.createSuper(),property)]);
    }
    return evaluateOnce(expr(n.target),target=>[f.createReturnStatement(f.createCallExpression(f.createIdentifier(binding!.bind),undefined,[target,f.createPropertyAccessExpression(target,property)]))]);
  }
  function expr(n:Expression,lvalue=false):ts.Expression {
    let value=rawExpr(n,lvalue);
    if(numericValues&&!lvalue){
      const kind=numericKind(n.numeric?.resolvedType);
      if(kind&&['identifier','property','call','index','invoke'].includes(n.kind)&&!n.storageType)blocked('Numeric reference requires analyzer declaration storage provenance',n);
      if((kind==='int'||kind==='double')&&n.kind!=='parenthesized'&&n.kind!=='recordAccess'&&n.kind!=='namedRecordAccess'&&erasedNumericStorage(n.kind==='assignment'?n.left.storageType:n.storageType)){
        const cast=(v:ts.Expression)=>f.createCallExpression(f.createIdentifier(kind==='int'?numericValues.castInt:numericValues.castDouble),undefined,[v]);
        value=n.numeric!.resolvedType!.nullable?evaluateOnce(value,v=>[f.createReturnStatement(f.createConditionalExpression(f.createBinaryExpression(v,ts.SyntaxKind.EqualsEqualsEqualsToken,f.createNull()),undefined,f.createNull(),undefined,cast(v)))]):cast(value);
      }
    }
    if(!lvalue&&n.promotedType&&recipe.sourceFlow?.policy==='resolved-source-flow')value=f.createAsExpression(value,resolvedType(n.promotedType));return !lvalue&&n.type==='int'&&recipe.numericTypes?.int&&n.kind!=='literal'?f.createCallExpression(integerCheck(),undefined,[value]):value;
  }
  function withStorage(n:Expression,body:(storage:ts.Expression)=>ts.Statement[]):ts.Expression {
    if(n.kind==='index'&&n.nullAware)blocked('Null-aware indexed mutation requires a separately qualified write boundary',n);
    if(n.kind==='parenthesized')return withStorage(n.value,body);
    const invoke=(statements:ts.Statement[])=>{statements.forEach(rejectSuspension);return f.createCallExpression(f.createParenthesizedExpression(f.createArrowFunction(undefined,undefined,[],undefined,undefined,f.createBlock(statements,true))),undefined,[]);};
    if(n.kind==='identifier')return invoke(body(expr(n,true)));
    if(n.kind==='property'){
      if(!n.reference)blocked('Unresolved integer property storage',n);
      if(recipe.adapters?.[n.reference!.id])blocked('Adapted property mutation requires a setter lowering',n);
      if(n.nullAware)blocked('Null-aware integer storage requires conditional assignment lowering',n);
      if(n.target.kind==='super')return invoke(body(expr(n,true)));
      return evaluateOnce(expr(n.target),target=>body(f.createPropertyAccessExpression(target,propertyName(n.name,n.reference!))));
    }
    if(n.kind==='index'){
      if(n.reference&&recipe.adapters?.[n.reference.id])blocked('Adapted indexed mutation requires a setter lowering',n);
      if(!['Float64List','List<int>','List<double>'].includes(n.targetType))blocked('Integer indexed storage requires an exact collection adapter',n);
      return evaluateOnce(expr(n.target),target=>[f.createReturnStatement(evaluateOnce(expr(n.index),index=>body(f.createElementAccessExpression(target,index))))]);
    }
    return blocked('Unsupported integer storage location',n);
  }
  function integerMutation(storage:Expression,operator:string,right:Expression|null,postfix=false):ts.Expression {
    if(numericValues&&erasedNumericStorage(storage.storageType))blocked('Numeric mutation of erased storage requires a read/write transfer',storage);
    const op=({'+=':ts.SyntaxKind.PlusToken,'-=':ts.SyntaxKind.MinusToken,'*=':ts.SyntaxKind.AsteriskToken,'++':ts.SyntaxKind.PlusToken,'--':ts.SyntaxKind.MinusToken} as Record<string,ts.BinaryOperator>)[operator];
    if(op===undefined)blocked('Integer mutation operator needs a checked rule: '+operator,storage);
    return withStorage(storage,target=>{
      const previous=temporary(),next=temporary();
      const declare=(id:ts.Identifier,value:ts.Expression)=>f.createVariableStatement(undefined,f.createVariableDeclarationList([f.createVariableDeclaration(id,undefined,undefined,value)],ts.NodeFlags.Const));
      return [declare(previous,f.createCallExpression(integerCheck(),undefined,[target])),declare(next,f.createCallExpression(integerCheck(),undefined,[f.createBinaryExpression(previous,op!,right?expr(right):f.createNumericLiteral(1))])),f.createExpressionStatement(f.createAssignment(target,next)),f.createReturnStatement(postfix?previous:next)];
    });
  }
  function rawExpr(n:Expression,lvalue=false):ts.Expression {
    if(numericValues&&(n.kind==='recordLiteral'||n.kind==='namedRecordLiteral')){
      const shape=n.kind==='recordLiteral'?n.recordType:n.shape;
      if(!numericGenerics||!shape||shape.nullable||n.kind==='recordLiteral'&&(shape.kind!=='record'||shape.fields.length!==n.fields.length))blocked('Record numeric storage requires boxed numeric arguments and an exact resolved shape',n);
    }
    switch(n.kind){
      case 'recordAssignment':return recordAssignment(n);
      case 'typeLiteral':{
        if(witnessBinding&&(n.valueType.kind==='parameter'||n.valueType.kind==='interface'&&(n.valueType.arguments.length||witnessClasses.has(n.valueType.reference.id)||numericGenerics&&numericKind(n.valueType))))return typeWitness(n.valueType);
        const type=n.valueType;if(type.kind!=='interface'||type.nullable||type.arguments.length)blocked('Type literal requires a monomorphic nonnullable class token',n);
        if(interfaceIds.has(type.reference.id))blocked('Abstract mixin interface has no generated runtime token',n);
        const target=ownedTypes.get(type.reference.id)??recipe.typeBindings?.[type.reference.id];
        if(!target||(!ownedTypes.has(type.reference.id)&&!imported.has(target)))blocked('Type literal requires an exact imported value or generated class identity',n);
        return f.createIdentifier(target);
      }
      case 'recordLiteral':return f.createCallExpression(f.createIdentifier(recordBoundary().create),undefined,[f.createAsExpression(f.createArrayLiteralExpression(n.fields.map((value,index)=>genericTransferred(value,n.recordType?.kind==='record'?n.recordType.fields[index]:undefined))),f.createTypeReferenceNode('const'))]);
      case 'namedRecordLiteral':{
        const keys=n.fields.map(field=>field.key),expected=[...n.shape.positional.map((_,index)=>index),...n.shape.named.map(field=>field.name)];
        if(n.shape.nullable||keys.length!==expected.length||new Set(keys).size!==keys.length||expected.some(key=>!keys.includes(key)))blocked('Invalid named record literal shape',n);
        return f.createCallExpression(f.createIdentifier(namedRecordBoundary().create),namedRecordTypes(n.shape),[
          f.createNumericLiteral(n.shape.positional.length),f.createArrayLiteralExpression(n.shape.named.map(field=>f.createStringLiteral(field.name))),
          f.createArrayLiteralExpression(n.fields.map(field=>f.createAsExpression(f.createArrayLiteralExpression([typeof field.key==='number'?f.createNumericLiteral(field.key):f.createStringLiteral(field.key),genericTransferred(field.value,typeof field.key==='number'?n.shape.positional[field.key]:n.shape.named.find(item=>item.name===field.key)?.type)]),f.createTypeReferenceNode('const'))))
        ]);
      }
      case 'namedRecordAccess':{
        if(lvalue)blocked('Record fields are immutable',n);
        const read=(target:ts.Expression)=>{const value=f.createCallExpression(f.createIdentifier(namedRecordBoundary().read),undefined,[target,typeof n.key==='number'?f.createNumericLiteral(n.key):f.createStringLiteral(n.key),f.createNumericLiteral(n.arity),f.createArrayLiteralExpression(n.names.map(name=>f.createStringLiteral(name)))]);return numericGenerics&&n.numeric?.resolvedType?scalarFromStored(value,n.numeric.resolvedType):value;};
        return n.nullAware?evaluateOnce(expr(n.target),target=>[f.createIfStatement(f.createBinaryExpression(target,ts.SyntaxKind.EqualsEqualsEqualsToken,f.createNull()),f.createReturnStatement(f.createNull())),f.createReturnStatement(read(target))]):read(expr(n.target));
      }
      case 'recordAccess':{
        if(lvalue)blocked('Record fields are immutable',n);const read=(target:ts.Expression)=>{const value=f.createCallExpression(f.createIdentifier(recordBoundary().read),undefined,[target,f.createNumericLiteral(n.index),f.createNumericLiteral(n.arity)]);return numericGenerics&&n.numeric?.resolvedType?scalarFromStored(value,n.numeric.resolvedType):value;};
        return n.nullAware?evaluateOnce(expr(n.target),target=>[f.createIfStatement(f.createBinaryExpression(target,ts.SyntaxKind.EqualsEqualsEqualsToken,f.createNull()),f.createReturnStatement(f.createNull())),f.createReturnStatement(read(target))]):read(expr(n.target));
      }
      case 'nullChainTarget':if(!nullChainTarget)return blocked('Null chain receiver escaped its scope',n);return nullChainTarget;
      case 'nullChain':return evaluateOnce(expr(n.target),target=>{const previous=nullChainTarget;nullChainTarget=target;try{return [f.createIfStatement(f.createBinaryExpression(target,ts.SyntaxKind.EqualsEqualsEqualsToken,f.createNull()),f.createReturnStatement(f.createNull())),f.createReturnStatement(expr(n.body))];}finally{nullChainTarget=previous;}});
      case 'collectionLiteral':{
        const expected=n.collectionKind==='map'?'dart:core::Map:CLASS':'dart:core::Set:CLASS';
        if(n.collectionType.kind!=='interface'||n.collectionType.nullable||n.collectionType.reference.id!==expected)blocked('Collection literal requires its exact resolved Map/Set type',n);
        const key=collectionTypeKey(n.collectionType),matches=(recipe.collectionLiterals??[]).filter(binding=>collectionTypeKey(binding.type)===key);
        if(matches.length!==1||matches[0]!.policy!=='ordered-dart-collection'||!imported.has(matches[0]!.factory))blocked('Collection literal requires one imported exact ordered factory',n);
        const parameters=new Set<string>();
        const collect=(value:ResolvedType):void=>{if(value.kind==='parameter')parameters.add(value.reference.id);else if(value.kind==='interface')value.arguments.forEach(collect);else if(value.kind==='record')value.fields.forEach(collect);else if(value.kind==='namedRecord'){value.positional.forEach(collect);value.named.forEach(field=>collect(field.type));}else if(value.kind==='function'){collect(value.returnType);value.parameters.forEach(parameter=>collect(parameter.type));}};collect(n.collectionType);
        const binding=matches[0]!,selected=binding.typeParameters??[];
        if(new Set(selected).size!==selected.length||selected.length!==parameters.size||selected.some(id=>!parameters.has(id)||!typeParameters.has(id)))blocked('Collection generic factory requires every exact in-scope type parameter',n);
        const factoryTypes=selected.length?selected.map(id=>f.createTypeReferenceNode(typeParameters.get(id)!)):undefined;
        const witnessPaths=binding.witnessArgumentPaths;
        if(witnessPaths&&(!witnessPaths.length||new Set(witnessPaths.map(path=>JSON.stringify(path))).size!==witnessPaths.length))blocked('Collection factory witnesses require nonempty unique argument paths',n);
        if(n.constant&&witnessPaths)blocked('Const collection factory witnesses require a separate canonical ABI',n);
        const factoryWitnesses=witnessPaths?.map(path=>{
          if(!path.length)blocked('Collection witness projection requires a non-empty argument path',n);
          let type:ResolvedType=n.collectionType;
          for(const index of path){if(type.kind!=='interface'||!Number.isSafeInteger(index)||index<0||index>=type.arguments.length)blocked('Collection witness projection escaped the resolved application',n);type=type.arguments[index]!;}
          return typeWitness(type);
        })??[];
        if(n.constant){
          const binding=matches[0]!,factory=binding.constantFactory;
          if(binding.constantPolicy==='canonical-set-values'){
            if(n.collectionKind!=='set'||selected.length||!factory||!imported.has(factory)||!numericGenerics||n.collectionType.kind!=='interface'||n.collectionType.arguments.length!==1||n.elements.some(element=>element.kind!=='value'))blocked('Const Set requires an exact closed canonical values factory and numeric provenance',n);
            pureConst(n);const type=n.collectionType;
            return f.createCallExpression(f.createIdentifier(factory),undefined,[f.createArrayLiteralExpression(n.elements.map(element=>{if(element.kind!=='value')return blocked('Const Set supports plain constant values',n);return genericTransferred(element.value,type.arguments[0]);}))]);
          }
          if(binding.constantPolicy==='canonical-map-entries'){
            if(n.collectionKind!=='map'||selected.length||!factory||!imported.has(factory)||!numericGenerics||n.collectionType.kind!=='interface'||n.collectionType.arguments.length!==2||n.elements.some(element=>element.kind!=='entry'))blocked('Const Map requires an exact closed canonical entries factory and numeric provenance',n);
            pureConst(n);
            const type=n.collectionType;
            return f.createCallExpression(f.createIdentifier(factory),undefined,[f.createArrayLiteralExpression(n.elements.map(element=>{if(element.kind!=='entry')return blocked('Const Map supports plain constant pairs',n);return f.createArrayLiteralExpression([genericTransferred(element.key,type.arguments[0]),genericTransferred(element.value,type.arguments[1])]);}))]);
          }
          if(n.elements.length||selected.length||!factory||!imported.has(factory))blocked('Const empty collection requires an imported canonical immutable factory',n);return f.createCallExpression(f.createIdentifier(factory),undefined,[]);
        }
        const result=temporary(),previous=asyncContext;asyncContext=false;
        try{
          const before:ts.Statement[]=[],after:ts.Statement[]=[];
          if(n.collectionKind==='map'&&n.elements.every(element=>element.kind==='entry')){
            // The pinned Dart literal path captures all plain pairs before hashing.
            for(const element of n.elements){if(element.kind!=='entry')blocked('Expected a plain map pair');const key=temporary(),value=temporary();before.push(f.createVariableStatement(undefined,f.createVariableDeclarationList([f.createVariableDeclaration(key,undefined,undefined,genericTransferred(element.key,n.collectionType.kind==='interface'?n.collectionType.arguments[0]:undefined))],ts.NodeFlags.Const)),f.createVariableStatement(undefined,f.createVariableDeclarationList([f.createVariableDeclaration(value,undefined,undefined,genericTransferred(element.value,n.collectionType.kind==='interface'?n.collectionType.arguments[1]:undefined))],ts.NodeFlags.Const)));after.push(f.createExpressionStatement(f.createCallExpression(f.createPropertyAccessExpression(result,'set'),undefined,[key,value])));}
          }else after.push(...n.elements.map(element=>collectionElement(element,result,n.collectionKind,n.collectionType.kind==='interface'?n.collectionType.arguments:[])));
          return f.createCallExpression(f.createParenthesizedExpression(f.createArrowFunction(undefined,undefined,[],undefined,undefined,f.createBlock([...before,f.createVariableStatement(undefined,f.createVariableDeclarationList([f.createVariableDeclaration(result,undefined,undefined,f.createCallExpression(f.createIdentifier(matches[0]!.factory),factoryTypes,factoryWitnesses))],ts.NodeFlags.Const)),...after,f.createReturnStatement(result)],true))),undefined,[]);
        }finally{asyncContext=previous;}
      }
      case 'switchExpression':return evaluateOnce(expr(n.value),value=>{
        if(n.cases.length===0||n.cases.some((arm,index)=>arm.test===null&&index!==n.cases.length-1))blocked('Switch expression needs ordered scalar cases and at most one final fallback',n);
        const clauses:ts.CaseOrDefaultClause[]=n.cases.map(arm=>arm.test===null?f.createDefaultClause([f.createReturnStatement(expr(arm.result))]):f.createCaseClause(expr(arm.test),[f.createReturnStatement(expr(arm.result))]));
        if(n.cases.at(-1)!.test!==null)clauses.push(f.createDefaultClause([f.createThrowStatement(f.createNewExpression(f.createIdentifier('TypeError'),undefined,[f.createStringLiteral('Non-exhaustive Dart switch expression')]))]));
        return [f.createSwitchStatement(value,f.createCaseBlock(clauses))];
      });
      case 'patternSwitchExpression':return patternSwitchExpression(n);
      case 'recordSwitchExpression':return evaluateOnce(expr(n.value),value=>{
        if(n.matchedType.kind!=='record'||n.matchedType.nullable||n.cases.length===0||n.cases.some((arm,index)=>arm.tests.length===0&&index!==n.cases.length-1))blocked('Record switch expression requires a nonnullable positional shape and ordered cases',n);
        recordBoundary();
        const clauses:ts.CaseOrDefaultClause[]=n.cases.map(arm=>arm.tests.length===0?f.createDefaultClause([f.createReturnStatement(expr(arm.result))]):f.createCaseClause(recordPatternCondition(value,n.matchedType,arm.tests,n),[f.createReturnStatement(expr(arm.result))]));
        if(n.cases.at(-1)!.tests.length!==0)clauses.push(f.createDefaultClause([f.createThrowStatement(f.createNewExpression(f.createIdentifier('TypeError'),undefined,[f.createStringLiteral('Non-exhaustive Dart record switch expression')]))]));
        return [f.createSwitchStatement(f.createTrue(),f.createCaseBlock(clauses))];
      });
      case 'await':if(!asyncContext||recipe.asyncRuntime?.policy!=='host-promise')blocked('await requires an explicit host-promise async body',n);return f.createAwaitExpression(expr(n.value));
      case 'throw':return evaluateOnce(expr(n.value),value=>[f.createThrowStatement(value)]);
      case 'rethrow':if(!caughtException)return blocked('rethrow requires its lexical catch scope',n);return f.createCallExpression(f.createParenthesizedExpression(f.createArrowFunction(undefined,undefined,[],undefined,undefined,f.createBlock([f.createThrowStatement(caughtException)],true))),undefined,[]);
      case 'collectionList':{
        if(recipe.iteration?.policy!=='host-iterable')blocked('Collection iteration requires a reviewed host-iterable boundary',n);
        const result=temporary(),previous=asyncContext;asyncContext=false;
        try{const initializer=mutableListLiteral(n.elementType,f.createArrayLiteralExpression(),false,n),values=f.createCallExpression(f.createParenthesizedExpression(f.createArrowFunction(undefined,undefined,[],undefined,undefined,f.createBlock([f.createVariableStatement(undefined,f.createVariableDeclarationList([f.createVariableDeclaration(result,undefined,f.createArrayTypeNode(recipe.listLiterals?.some(binding=>collectionTypeKey(binding.elementType)===collectionTypeKey(n.elementType))?argumentType(n.elementType):resolvedType(n.elementType)),initializer)],ts.NodeFlags.Const)),...n.elements.map(element=>collectionElement(element,result,'list',[n.elementType])),f.createReturnStatement(result)],true))),undefined,[]);return values;}finally{asyncContext=previous;}
      }
      case 'cascadeTarget':if(!cascadeTarget)return blocked('Cascade section escaped its receiver',n);return cascadeTarget;
      case 'cascade':return evaluateOnce(expr(n.target),target=>{
        const previous=cascadeTarget;cascadeTarget=target;
        try{return [...n.nullAware?[f.createIfStatement(f.createBinaryExpression(target,ts.SyntaxKind.EqualsEqualsEqualsToken,f.createNull()),f.createReturnStatement(f.createNull()))]:[],...n.sections.map(section=>f.createExpressionStatement(expr(section))),f.createReturnStatement(target)];}
        finally{cascadeTarget=previous;}
      });
      case 'closure':{
        if(n.typeParameters?.length){
          const signature=n.functionType;
          if(signature?.kind!=='function'||signature.typeParameters?.length!==n.typeParameters.length||signature.typeParameters.some((p,index)=>p.reference.id!==n.typeParameters![index]!.reference.id))blocked('Generic closure requires matching analyzer declaration and callable parameters',n);
          return withGenericFunction(n.typeParameters,(generics,witnesses)=>f.createArrowFunction(asyncModifiers(n.body,n.returnType),generics,[...witnesses,...fieldFormals(n.parameters)],resolvedType(n.returnType),undefined,callableBody(n.body,n.parameters,n.returnType)));
        }
        return f.createArrowFunction(asyncModifiers(n.body,n.returnType),undefined,fieldFormals(n.parameters),resolvedType(n.returnType),undefined,callableBody(n.body,n.parameters,n.returnType));
      }
      case 'invoke':{
        if(n.signature.kind!=='function'||n.signature.nullable&&!n.nullAware)blocked('Invocation requires a non-null resolved function type or explicit null-aware guard',n);
        const signature=n.signature as ResolvedType&{kind:'function'};
        const selected=signature.typeParameters??[],arguments_=n.resolvedTypeArguments;
        if(selected.length&&(!genericFunctionValues||!arguments_||arguments_.length!==selected.length)||!selected.length&&(n.typeArguments?.length||arguments_?.length))blocked('Generic invocation requires its qualified ABI and exact analyzer-resolved type arguments',n);
        if(n.typeArguments?.length&&JSON.stringify(n.typeArguments)!==JSON.stringify(arguments_))blocked('Explicit generic invocation differs from its resolved analyzer arguments',n);
        const params:Parameter[]=signature.parameters.map(p=>({name:p.name,named:p.named,required:p.required,type:'',resolvedType:p.type,default:null}));
        const invoke=(target:ts.Expression)=>f.createCallExpression(target,selected.length?arguments_!.map(argumentType):undefined,[...selected.length?arguments_!.map(type=>typeWitness(type)):[],...classArgs(n.args,params)]);
        if(n.nullAware)return evaluateOnce(expr(n.target),target=>[f.createIfStatement(f.createBinaryExpression(target,ts.SyntaxKind.EqualsEqualsEqualsToken,f.createNull()),f.createReturnStatement(f.createNull())),f.createReturnStatement(invoke(f.createNonNullExpression(target)))]);
        return invoke(expr(n.target));
      }
      case 'literal':if(n.negativeZero){if(n.value!==0||n.type!=='double')blocked('Negative zero requires analyzer-resolved double zero',n);return f.createPrefixUnaryExpression(ts.SyntaxKind.MinusToken,f.createNumericLiteral(0));}if(n.type==='int'&&typeof n.value==='number'&&!Number.isSafeInteger(n.value))blocked('Dart integer literal exceeds the exact JS scalar range',n);return n.value===null?f.createNull():typeof n.value==='string'?f.createStringLiteral(n.value):typeof n.value==='boolean'?n.value?f.createTrue():f.createFalse():n.value<0?f.createPrefixUnaryExpression(ts.SyntaxKind.MinusToken,f.createNumericLiteral(-n.value)):f.createNumericLiteral(n.value);
      case 'typeTest':case 'typeCast':{
        const checked=n.checkedType;
        if(numericValues&&numericKind(checked)){
          const kind=numericKind(checked)!;
          if(kind==='num'&&!numericGenerics)blocked('Numeric num runtime tests require a retained-union predicate',n);
          const binding=recipe.runtimeTypes?.[(checked as ResolvedType&{kind:'interface'}).reference.id],target=binding?.[n.kind==='typeTest'?'is':'cast'];
          if(!target||!imported.has(target))blocked('Numeric runtime check requires an exact imported boundary',n);
          const boxed=transferred(n.value,{kind:'interface',nullable:true,reference:{id:'dart:core::Object:CLASS',name:'Object',owner:null,local:false,static:false},arguments:[]});
          const convert=(v:ts.Expression)=>f.createCallExpression(f.createIdentifier(target!),undefined,[v]);
          const call=checked.nullable?evaluateOnce(boxed,v=>[f.createReturnStatement(f.createConditionalExpression(f.createBinaryExpression(v,ts.SyntaxKind.EqualsEqualsEqualsToken,f.createNull()),undefined,n.kind==='typeTest'?f.createTrue():f.createNull(),undefined,convert(v)))]):convert(boxed);
          return n.kind==='typeTest'&&n.negated?f.createPrefixUnaryExpression(ts.SyntaxKind.ExclamationToken,call):call;
        }
        if(witnessBinding&&(checked.kind==='parameter'||checked.kind==='interface'&&(checked.arguments.length||witnessClasses.has(checked.reference.id)))){
          const token=typeWitness(checked),input=numericValues?transferred(n.value,{kind:'interface',nullable:true,reference:{id:'dart:core::Object:CLASS',name:'Object',owner:null,local:false,static:false},arguments:[]}):expr(n.value),call=f.createCallExpression(f.createIdentifier(n.kind==='typeTest'?witnessBinding.is:witnessBinding.cast),[resolvedType(checked)],[input,token]);
          return n.kind==='typeTest'&&n.negated?f.createPrefixUnaryExpression(ts.SyntaxKind.ExclamationToken,call):call;
        }
        if(checked.kind!=='interface'||checked.arguments.length)blocked('Runtime type check requires a monomorphic binding',n);
        const identity=(checked as ResolvedType&{kind:'interface'}).reference.id,own=ownedTypes.get(identity);
        if(own&&!interfaceIds.has(identity)&&recipe.generatedRuntimeTypes?.includes(identity)&&!recipe.runtimeTypes?.[identity]){
          if(model.ordered.some(owner=>owner.interfaces?.some(type=>type.kind==='interface'&&type.reference.id===identity)))blocked('Source interface implementations require an explicit runtime predicate',n);
          if(n.kind==='typeTest'&&(!checked.nullable||n.value.kind==='identifier'&&n.value.reference?.local||n.value.kind==='this')){
            const value=expr(n.value),test=f.createBinaryExpression(value,ts.SyntaxKind.InstanceOfKeyword,f.createIdentifier(own)),valid=checked.nullable?f.createBinaryExpression(f.createBinaryExpression(value,ts.SyntaxKind.EqualsEqualsEqualsToken,f.createNull()),ts.SyntaxKind.BarBarToken,test):test;
            return n.negated?f.createPrefixUnaryExpression(ts.SyntaxKind.ExclamationToken,f.createParenthesizedExpression(valid)):valid;
          }
          const call=evaluateOnce(expr(n.value),value=>{
            const test=f.createBinaryExpression(value,ts.SyntaxKind.InstanceOfKeyword,f.createIdentifier(own));
            const valid=checked.nullable?f.createBinaryExpression(f.createBinaryExpression(value,ts.SyntaxKind.EqualsEqualsEqualsToken,f.createNull()),ts.SyntaxKind.BarBarToken,test):test;
            if(n.kind==='typeTest')return[f.createReturnStatement(valid)];
            return[f.createIfStatement(f.createPrefixUnaryExpression(ts.SyntaxKind.ExclamationToken,f.createParenthesizedExpression(valid)),f.createThrowStatement(f.createNewExpression(f.createIdentifier('TypeError'),undefined,[f.createStringLiteral('Invalid source cast: '+identity)]))),f.createReturnStatement(f.createAsExpression(value,resolvedType(checked)))];
          });
          return n.kind==='typeTest'&&n.negated?f.createPrefixUnaryExpression(ts.SyntaxKind.ExclamationToken,call):call;
        }
        const binding=recipe.runtimeTypes?.[(checked as ResolvedType&{kind:'interface'}).reference.id],target=binding?.[n.kind==='typeTest'?'is':'cast'];
        if(!target||!imported.has(target))blocked('Runtime type check requires an imported predicate/checked cast',n);
        const call=checked.nullable?evaluateOnce(expr(n.value),value=>[f.createReturnStatement(f.createConditionalExpression(f.createBinaryExpression(value,ts.SyntaxKind.EqualsEqualsEqualsToken,f.createNull()),undefined,n.kind==='typeTest'?f.createTrue():f.createNull(),undefined,f.createCallExpression(f.createIdentifier(target!),undefined,[value])))]):f.createCallExpression(f.createIdentifier(target!),undefined,[expr(n.value)]);
        return n.kind==='typeTest'&&n.negated?f.createPrefixUnaryExpression(ts.SyntaxKind.ExclamationToken,call):call;
      }
      case 'identifier':{
        if(n.reference&&ownedTopGetters.has(n.reference.id)){if(lvalue)blocked('Source top-level getter is readonly',n);return f.createPropertyAccessExpression(getterNamespace!,privateName(name(ownedTopGetters.get(n.reference.id)!.name),n.reference));}
        if(n.reference&&witnessMethods.has(n.reference.id))blocked('Generic method witness tear-off requires an explicit function-value ABI',n);
        if(n.reference&&!n.reference.local&&n.reference.owner===null&&n.reference.id.endsWith(':GETTER')&&recipe.adapters?.[n.reference.id]){
          const adapter=recipe.adapters[n.reference.id]!;
          if(lvalue||adapter.kind!=='call'||adapter.receiver||adapter.namedArguments||adapter.typeArguments?.length||!imported.has(adapter.target))blocked('Top-level getter requires an imported exact no-argument read adapter',n);
          return adapted(n.reference,[])!;
        }
        if(n.reference&&!n.reference.local&&!n.reference.static&&n.reference.id.endsWith(':GETTER')&&!recipe.memberBindings?.[n.reference.id]&&recipe.adapters?.[n.reference.id]){
          const adapter=recipe.adapters[n.reference.id]!;
          if(lvalue||!currentClass||staticContext||initializing||adapter.kind!=='call'||adapter.receiver!=='first'||adapter.namedArguments||adapter.typeArguments?.length||!imported.has(adapter.target))blocked('Implicit getter requires an imported exact receiver-first adapter in a live instance body',n);
          return adapted(n.reference,[],{kind:'this',type:currentClass!.name,offset:n.offset,length:0})!;
        }
        if(n.reference&&recipe.values&&Object.hasOwn(recipe.values,n.reference.id)){
          if(lvalue)blocked('Mapped constants are not assignable',n);const value=recipe.values[n.reference.id]!;
          return value===null?f.createNull():typeof value==='number'?value<0?f.createPrefixUnaryExpression(ts.SyntaxKind.MinusToken,f.createNumericLiteral(-value)):f.createNumericLiteral(value):typeof value==='boolean'?value?f.createTrue():f.createFalse():f.createStringLiteral(value);
        }
        if(n.functionType?.kind==='function'&&scalarHost(n))return f.createIdentifier(recipe.adapters![n.reference!.id]!.target);
        if(n.reference?.id.endsWith(':METHOD')&&!n.reference.static)return methodTearOff(n);return identifier(n.name,n.reference);
      }
      case 'this':if(!currentClass||staticContext||initializing)blocked('this is outside an instance class body',n);return f.createThis();
      case 'super':if(!currentClass?.superclass||staticContext||initializing)blocked('super is outside a derived instance body',n);return f.createSuper();
      case 'interpolation':{
        if(n.parts.length<3||n.parts.length%2!==1||n.parts.some((part,index)=>part.kind!==(index%2?'expression':'text')))blocked('Malformed string interpolation',n);
        const first=n.parts[0]!;if(first.kind!=='text')return blocked('Interpolation needs leading text',n);
        const spans:ts.TemplateSpan[]=[];for(let index=1;index<n.parts.length;index+=2){const part=n.parts[index]!,tail=n.parts[index+1]!;if(part.kind!=='expression'||tail.kind!=='text')return blocked('Malformed interpolation parts',n);let value=expr(part.value);if(!['String','bool','Null'].includes(part.value.type.replace(/\?$/,''))){const resolved=part.resolvedType,adapter=resolved?.kind==='interface'||resolved?.kind==='parameter'&&typeParameters.has(resolved.reference.id)?recipe.stringConversions?.[resolved.reference.id]:undefined;if(!adapter||!imported.has(adapter))blocked('Interpolation value requires an explicit Dart string conversion adapter',part.value);const convert=(v:ts.Expression)=>f.createCallExpression(f.createIdentifier(adapter!),undefined,[v]);value=resolved!.nullable?evaluateOnce(value,v=>[f.createReturnStatement(f.createConditionalExpression(f.createBinaryExpression(v,ts.SyntaxKind.EqualsEqualsEqualsToken,f.createNull()),undefined,f.createStringLiteral('null'),undefined,convert(v)))]):convert(value);}spans.push(f.createTemplateSpan(value,index+2===n.parts.length?f.createTemplateTail(tail.value):f.createTemplateMiddle(tail.value)));}return f.createTemplateExpression(f.createTemplateHead(first.value),spans);
      }
      case 'parenthesized':return f.createParenthesizedExpression(expr(n.value));
      case 'property':{
        if(n.reference&&ownedTopGetters.has(n.reference.id)){if(lvalue||n.nullAware||n.target.kind!=='identifier'||!n.target.reference?.id.endsWith(':PREFIX'))blocked('Owned prefixed top-level getter requires its exact source import namespace',n);return f.createPropertyAccessExpression(getterNamespace!,privateName(name(ownedTopGetters.get(n.reference.id)!.name),n.reference));}
        // An analyzer-resolved import prefix is a namespace, never a runtime
        // receiver. Admit only the exact mapped class/enum value identity.
        if(n.reference&&!n.reference.local&&n.reference.owner===null&&/:(CLASS|ENUM)$/.test(n.reference.id)&&n.target.kind==='identifier'&&n.target.reference?.id.endsWith(':PREFIX')){
          const target=recipe.typeBindings?.[n.reference.id];
          if(lvalue||n.nullAware||!target||!imported.has(target))blocked('Prefixed type value requires an exact imported runtime binding',n);
          return f.createIdentifier(target!);
        }
        if(n.reference&&!n.reference.local&&n.reference.owner===null&&n.reference.id.endsWith(':GETTER')&&n.target.kind==='identifier'&&n.target.reference?.id.endsWith(':PREFIX')&&recipe.adapters?.[n.reference.id]){
          const adapter=recipe.adapters[n.reference.id]!;
          if(lvalue||n.nullAware||adapter.kind!=='call'||adapter.receiver||adapter.namedArguments||adapter.typeArguments?.length||!imported.has(adapter.target))blocked('Prefixed top-level getter requires an imported exact no-argument read adapter',n);
          return adapted(n.reference,[])!;
        }
        if(n.reference&&witnessMethods.has(n.reference.id))blocked('Generic method witness tear-off requires an explicit function-value ABI',n);
        if(n.nullAware)return evaluateOnce(expr(n.target),target=>[f.createReturnStatement(f.createConditionalExpression(f.createBinaryExpression(target,ts.SyntaxKind.EqualsEqualsEqualsToken,f.createNull()),undefined,f.createNull(),undefined,rawExpr({...n,nullAware:false,target:{kind:'identifier',name:target.text,reference:{id:target.text,name:target.text,owner:null,local:true,static:false},type:n.targetType.replace(/\?$/,''),offset:n.offset,length:0},targetType:n.targetType.replace(/\?$/,'')})))]);
        if(n.reference?.id.endsWith(':METHOD')&&!n.reference.static)return methodTearOff(n);
        if(n.functionType?.kind==='function'&&scalarHost(n))return f.createIdentifier(recipe.adapters![n.reference!.id]!.target);
        if(n.reference&&recipe.adapters?.[n.reference.id]){
          const adapter=recipe.adapters[n.reference.id]!;
          if(lvalue||!n.reference.id.endsWith(':GETTER')||adapter.kind!=='call'||adapter.receiver!=='first'||adapter.namedArguments||adapter.typeArguments?.length||!imported.has(adapter.target))blocked('Property read requires an imported exact receiver-first getter adapter',n);
          return adapted(n.reference,[],n.target)!;
        }
        // Exact Dart double identities share JavaScript's IEEE-754 values.
        if(n.reference?.id==='dart:core::double.infinity:GETTER')return f.createIdentifier('Infinity');
        if(n.reference?.id==='dart:core::double.negativeInfinity:GETTER')return f.createPrefixUnaryExpression(ts.SyntaxKind.MinusToken,f.createIdentifier('Infinity'));
        if(n.reference?.id==='dart:core::double.nan:GETTER')return dotted('Number.NaN');
        if(n.reference&&recipe.values&&Object.hasOwn(recipe.values,n.reference.id)){const value=recipe.values[n.reference.id]!;return value===null?f.createNull():typeof value==='number'?value<0?f.createPrefixUnaryExpression(ts.SyntaxKind.MinusToken,f.createNumericLiteral(-value)):f.createNumericLiteral(value):typeof value==='boolean'?value?f.createTrue():f.createFalse():f.createStringLiteral(value);}
        if(n.targetType==='Duration'&&recipe.durationUnit==='milliseconds'&&n.name==='inMilliseconds')return f.createCallExpression(dotted('Math.trunc'),undefined,[expr(n.target)]);
        if(['double','int','num'].includes(n.targetType)&&['isFinite','isNaN'].includes(n.name))return f.createCallExpression(dotted('Number.'+n.name),undefined,[expr(n.target)]);
        if(['dart:core::num.sign:GETTER','dart:core::double.sign:GETTER'].includes(n.reference?.id??''))return f.createCallExpression(dotted('Math.sign'),undefined,[expr(n.target)]);
        // Only resolved fields/getters on explicitly mapped types are admitted.
        if(!n.reference)blocked('Unresolved property',n);
        if(n.target.kind==='identifier'&&['double','int','num'].includes(n.target.name))return blocked('Numeric static property needs a rule',n);
        return f.createPropertyAccessExpression(expr(n.target),propertyName(n.name,n.reference!));
      }
      case 'index':{
        if(n.nullAware){
          if(lvalue)blocked('Null-aware indexed mutation requires a separately qualified write boundary',n);
          return evaluateOnce(expr(n.target),target=>[f.createIfStatement(f.createBinaryExpression(target,ts.SyntaxKind.EqualsEqualsEqualsToken,f.createNull()),f.createReturnStatement(f.createNull())),f.createReturnStatement(rawExpr({...n,nullAware:false,target:{kind:'identifier',name:target.text,reference:{id:target.text,name:target.text,owner:null,local:true,static:false},type:n.target.type.replace(/\?$/,''),offset:n.target.offset,length:0},targetType:n.targetType.replace(/\?$/,'')}))]);
        }
        if(n.reference&&recipe.adapters?.[n.reference.id]){
          if(lvalue)blocked('Adapted indexed writes require a setter lowering',n);
          if(numericGenerics&&!n.indexParameterType)blocked('Generic indexed read requires analyzer parameter provenance',n);
          const adapter=recipe.adapters[n.reference.id]!;
          const owned=model.member(n.reference);const source=owned&&'operator' in owned&&owned.operator&&owned.name==='[]'&&adapter.receiver==='target'&&adapter.target===memberName(owned.name,owned.reference);
          if(n.reference.name!=='[]'||adapter.kind!=='call'||adapter.namedArguments||adapter.typeArguments?.length||!(source||adapter.receiver==='first'&&imported.has(adapter.target)))blocked('Indexed read requires an exact owned source member or imported receiver-first adapter',n);
          return adapted(n.reference,[{name:null,value:n.index,...n.indexParameterType?{parameterType:n.indexParameterType}:{},...n.appliedIndexParameterType?{appliedParameterType:n.appliedIndexParameterType}:{}}],n.target)!;
        }
        if(!['Float64List','List<double>','List<int>'].includes(n.targetType))blocked('Index semantics need an adapter for '+n.targetType,n);
        const value=f.createElementAccessExpression(expr(n.target),expr(n.index));return lvalue?value:f.createNonNullExpression(value);
      }
      case 'binary':case 'assignment':{
        if(n.kind==='binary'&&n.reference&&sourceOperatorTargets.has(n.reference.id)){
          if(n.reference.name!==n.operator||!n.operatorParameterType||!n.appliedOperatorParameterType)blocked('Source arithmetic call requires exact operator and operand provenance',n);
          return adapted(n.reference,[{name:null,value:n.right,parameterType:n.operatorParameterType,appliedParameterType:n.appliedOperatorParameterType}],n.left,{kind:'call',receiver:'target',target:sourceOperatorTargets.get(n.reference.id)!})!;
        }
        if(n.kind==='binary'&&n.operator==='~/'){
          const adapter=n.reference&&recipe.adapters?.[n.reference.id];
          if(!adapter||n.reference?.name!=='~/'||adapter.kind!=='call'||adapter.receiver!=='first'||adapter.namedArguments||adapter.typeArguments?.length||!imported.has(adapter.target))blocked('Dart truncating division requires an imported exact receiver-first adapter',n);
          return adapted(n.reference!,[{name:null,value:n.right}],n.left)!;
        }
        if(n.kind==='binary'&&['==','!='].includes(n.operator)&&(n.left.recordType||n.right.recordType)&&n.left.type!=='Null'&&n.right.type!=='Null')blocked('Record equality requires a structural value adapter',n);
        if(n.kind==='assignment'&&(n.left.kind==='identifier'||n.left.kind==='property')){
          const left=n.left,reference=left.reference,field=reference&&witnessedFields.get(reference.id);
          if(field){
            if(n.operator!=='='||left.kind==='property'&&left.nullAware)blocked('Witnessed field mutation requires a direct non-null-aware assignment',n);
            const receiver=left.kind==='property'?expr(left.target):expr({kind:'this',type:field.owner.name,offset:n.offset,length:0}),property=propertyName(left.name,reference!);
            return evaluateOnce(receiver,target=>{
              const fieldType=f.createTypeQueryNode(f.createQualifiedName(target,property)),value=temporary(),checked=temporary(),token=f.createAsExpression(receiverFieldWitness(field.owner,field.type,target),f.createTypeReferenceNode(witnessBinding!.type,[fieldType]));
              return[f.createVariableStatement(undefined,f.createVariableDeclarationList([f.createVariableDeclaration(value,undefined,undefined,transferred(n.right,field.type))],ts.NodeFlags.Const)),f.createVariableStatement(undefined,f.createVariableDeclarationList([f.createVariableDeclaration(checked,undefined,undefined,f.createCallExpression(f.createIdentifier(witnessBinding!.cast),[fieldType],[value,token]))],ts.NodeFlags.Const)),f.createExpressionStatement(f.createAssignment(f.createPropertyAccessExpression(target,property),checked)),f.createReturnStatement(value)];
            });
          }
        }
        if(numericGenerics&&n.kind==='assignment'&&n.operator==='='&&['identifier','property'].includes(n.left.kind)&&n.left.storageType?.kind==='parameter'){
          const left=n.left as Expression&{kind:'identifier'|'property'},reference=left.reference,storage=n.left.storageType;
          const candidates=reference?model.ordered.filter(owner=>witnessClasses.has(owner.reference.id)&&owner.fields.some(field=>field.reference.id.replace(/:FIELD$/,':SETTER')===reference.id||field.reference.id===reference.id)):[],owner=candidates.find(owner=>owner.sourceMixinOwner)??candidates[0];
          const index=owner?.typeParameters.findIndex(p=>p.reference.id===storage.reference.id)??-1;
          if(owner&&index>=0){
            const receiver=left.kind==='property'?expr(left.target):expr({kind:'this',type:owner.name,offset:n.offset,length:0}),field=propertyName(left.name,reference!);
            return evaluateOnce(receiver,target=>{
              const fieldType=f.createTypeQueryNode(f.createQualifiedName(target,field)),value=temporary();let token:ts.Expression=f.createCallExpression(f.createIdentifier(classWitnessBinding!.read),[fieldType],[target,f.createIdentifier(name(owner.name)),f.createNumericLiteral(index)]);
              if(storage.nullable)token=f.createCallExpression(f.createIdentifier(witnessBinding!.nullable),[fieldType],[token]);
              return [f.createVariableStatement(undefined,f.createVariableDeclarationList([f.createVariableDeclaration(value,undefined,undefined,transferred(n.right,storage))],ts.NodeFlags.Const)),f.createReturnStatement(f.createAssignment(f.createPropertyAccessExpression(target,field),f.createCallExpression(f.createIdentifier(witnessBinding!.cast),[fieldType],[value,token])))];
            });
          }
        }
        if(n.kind==='assignment'&&n.operator==='='){
          let storage=n.left;while(storage.kind==='parenthesized')storage=storage.value;
          if(storage.kind==='index'&&storage.reference&&recipe.adapters?.[storage.reference.id]){
            if(numericGenerics&&!storage.indexParameterType)blocked('Generic indexed write requires analyzer parameter provenance',n);
            const adapter=recipe.adapters[storage.reference.id]!;
            if(storage.reference.name!=='[]='||adapter.kind!=='call'||adapter.receiver!=='first'||adapter.namedArguments||adapter.typeArguments?.length||!imported.has(adapter.target))blocked('Indexed write requires an imported exact receiver-first setter adapter',n);
            const indexed=storage,index=temporary(),value=temporary();
            return evaluateOnce(expr(indexed.target),receiver=>[
              f.createVariableStatement(undefined,f.createVariableDeclarationList([f.createVariableDeclaration(index,undefined,undefined,transferred(indexed.index,indexed.indexParameterType,indexed.appliedIndexParameterType))],ts.NodeFlags.Const)),
              f.createVariableStatement(undefined,f.createVariableDeclarationList([f.createVariableDeclaration(value,undefined,undefined,transferred(n.right,storage.storageType))],ts.NodeFlags.Const)),
              f.createExpressionStatement(f.createCallExpression(f.createIdentifier(adapter.target),undefined,[receiver,index,value])),f.createReturnStatement(value)
            ]);
          }
        }
        if(n.kind==='assignment'&&n.operator==='??='){
          if(n.left.kind==='index'){
            const storage=n.left,read=n.indexedRead,getter=read?.reference&&recipe.adapters?.[read.reference.id],setter=storage.reference&&recipe.adapters?.[storage.reference.id];
            if(!read?.type.nullable||read.reference?.name!=='[]'||storage.reference?.name!=='[]='||!getter||!setter||[getter,setter].some(adapter=>adapter.kind!=='call'||adapter.receiver!=='first'||adapter.namedArguments||adapter.typeArguments?.length||!imported.has(adapter.target)))blocked('Indexed null assignment requires exact resolved nullable getter and setter adapters',n);
            const index=temporary(),current=temporary(),value=temporary();
            return evaluateOnce(expr(storage.target),receiver=>[
              f.createVariableStatement(undefined,f.createVariableDeclarationList([f.createVariableDeclaration(index,undefined,undefined,transferred(storage.index,storage.indexParameterType,storage.appliedIndexParameterType))],ts.NodeFlags.Const)),
              f.createVariableStatement(undefined,f.createVariableDeclarationList([f.createVariableDeclaration(current,undefined,undefined,f.createCallExpression(f.createIdentifier(getter!.target),undefined,[receiver,index]))],ts.NodeFlags.Const)),
              f.createIfStatement(f.createBinaryExpression(current,ts.SyntaxKind.ExclamationEqualsEqualsToken,f.createNull()),f.createReturnStatement(current)),
              f.createVariableStatement(undefined,f.createVariableDeclarationList([f.createVariableDeclaration(value,undefined,undefined,transferred(n.right,storage.storageType))],ts.NodeFlags.Const)),
              f.createExpressionStatement(f.createCallExpression(f.createIdentifier(setter!.target),undefined,[receiver,index,value])),f.createReturnStatement(value)
            ]);
          }
          if(!n.left.type.endsWith('?')||n.left.kind==='property'&&n.left.nullAware)blocked('Null assignment requires non-null-aware nullable storage',n);
          return f.createBinaryExpression(expr(n.left,true),ts.SyntaxKind.QuestionQuestionEqualsToken,transferred(n.right,n.left.storageType));
        }
        if(n.kind==='binary'&&['+','-','*','/','<','>','<=','>=','&','|','^','<<','>>','>>>'].includes(n.operator)&&(!scalar(n.left.type)||n.left.type==='String'&&n.operator==='+')){
          const adapter=n.reference&&recipe.adapters?.[n.reference.id];
          if(!adapter||n.reference?.name!==n.operator||adapter.kind!=='call'||!['first','target'].includes(adapter.receiver??'')||adapter.namedArguments||adapter.typeArguments?.length||adapter.receiver==='first'&&!imported.has(adapter.target))blocked('Value operator requires an exact receiver adapter',n);
          return adapted(n.reference!,[{name:null,value:n.right}],n.left)!;
        }
        if(n.kind==='binary'&&n.operator==='%'){
          const adapter=n.reference&&recipe.adapters?.[n.reference.id];
          if(!adapter||n.reference?.name!=='%'||adapter.kind!=='call'||adapter.receiver!=='first'||adapter.namedArguments||adapter.typeArguments?.length||!imported.has(adapter.target))blocked('Dart modulo requires an imported exact receiver-first adapter',n);
          return adapted(n.reference!,[{name:null,value:n.right}],n.left)!;
        }
        if(n.kind==='binary'&&['==','!='].includes(n.operator)&&n.left.functionType?.kind==='function'&&n.right.functionType?.kind==='function'){
          if(numericFunctions){const equality=f.createCallExpression(f.createIdentifier(numericFunctions.identity),undefined,[expr(n.left),expr(n.right)]);return n.operator==='!='?f.createPrefixUnaryExpression(ts.SyntaxKind.ExclamationToken,equality):equality;}
          if(recipe.methodTearOff?.policy!=='receiver-method-identity')blocked('Function equality requires the receiver/method identity boundary',n);
          return f.createBinaryExpression(expr(n.left),binary[n.operator]!,expr(n.right));
        }
        if(!binary[n.operator])blocked('Numeric/operator semantics not supported: '+n.operator,n);
        if(n.kind==='assignment'&&n.operator==='='&&n.type==='int'&&recipe.numericTypes?.int){let target=n.left;while(target.kind==='parenthesized')target=target.value;if(target.kind==='index')blocked('Indexed integer assignment requires a range-checked setter adapter',n);}
        if(n.kind==='assignment'&&n.operator!=='='&&!['double','num','int'].includes(n.left.type))blocked('Compound mutation requires numeric storage or an explicit operator adapter',n);
        if(n.kind==='assignment'&&n.type==='int'&&recipe.numericTypes?.int&&n.operator!=='=')return integerMutation(n.left,n.operator,n.right);
        if(n.type==='int'&&['+','-','*','+=','-=','*='].includes(n.operator)&&!recipe.numericTypes?.int)blocked('Dart integer arithmetic needs a bounded or bigint rule',n);
        if(n.kind==='binary'&&['==','!='].includes(n.operator)&&!scalar(n.left.type)&&n.right.type!=='Null'){
          if(n.reference?.name!=='==')blocked('Value equality requires a resolved equality operator',n);
          const adapter=recipe.adapters?.[n.reference!.id];
          let mapped:ts.Expression|undefined;
          if((n.left.type.endsWith('?')||n.right.type.endsWith('?'))&&adapter?.kind!=='identity'){
            if(adapter?.kind!=='call'||!['first','target'].includes(adapter.receiver??'')||adapter.namedArguments||adapter.typeArguments?.length)blocked('Nullable value equality requires an exact receiver call adapter',n);
            const local=(id:ts.Identifier,source:Expression):Expression=>({kind:'identifier',name:id.text,reference:{id:id.text,name:id.text,owner:null,local:true,static:false},type:source.type.replace(/\?$/,''),offset:n.offset,length:0});
            mapped=evaluateOnce(expr(n.left),left=>{const right=temporary();return [f.createVariableStatement(undefined,f.createVariableDeclarationList([f.createVariableDeclaration(right,undefined,undefined,expr(n.right))],ts.NodeFlags.Const)),f.createReturnStatement(f.createConditionalExpression(f.createBinaryExpression(f.createBinaryExpression(left,ts.SyntaxKind.EqualsEqualsEqualsToken,f.createNull()),ts.SyntaxKind.BarBarToken,f.createBinaryExpression(right,ts.SyntaxKind.EqualsEqualsEqualsToken,f.createNull())),undefined,f.createBinaryExpression(n.left.type.replace(/\?$/,'')!==n.right.type.replace(/\?$/,'')?f.createAsExpression(left,f.createKeywordTypeNode(ts.SyntaxKind.UnknownKeyword)):left,ts.SyntaxKind.EqualsEqualsEqualsToken,right),undefined,adapted(n.reference!,[{name:null,value:local(right,n.right)}],local(left,n.left))!))];});
          }else mapped=adapted(n.reference??null,[{name:null,value:n.right,...n.operatorParameterType?{parameterType:n.operatorParameterType}:{},...n.appliedOperatorParameterType?{appliedParameterType:n.appliedOperatorParameterType}:{}}],n.left);
          if(!mapped)blocked('Value equality requires an adapter',n);
          return n.operator==='!='?f.createPrefixUnaryExpression(ts.SyntaxKind.ExclamationToken,mapped!):mapped!;
        }
        if(['+','-','*','/','<','>','<=','>='].includes(n.operator)&&!['double','num','int'].includes(n.left.type))blocked('Non-numeric operator requires an adapter',n);
        if(numericValues&&[n.left,n.right].some(value=>numericKind(value.numeric?.resolvedType)==='num')&&n.operator!=='='){
          const kinds=[numericKind(n.left.numeric?.resolvedType),numericKind(n.right.numeric?.resolvedType)],result=numericKind(n.numeric?.resolvedType),comparison=['<','>','<=','>='].includes(n.operator),arithmetic=['+','-','*','/'].includes(n.operator),binding=n.reference&&numericOperators?.operators[n.reference.id];
          if(n.kind==='binary'&&n.reference&&binding&&kinds.every(kind=>kind==='int'||kind==='double'||kind==='num')&&(comparison&&n.type==='bool'||arithmetic&&(result==='double'||result==='num'))&&n.reference.id===`dart:core::${n.reference.owner}.${n.operator}:METHOD`&&['num','double','int'].includes(n.reference.owner??'')&&[n.left,n.right].every(value=>value.numeric?.resolvedType?.nullable===false)){
            const carrier={kind:'interface' as const,nullable:false,reference:{id:'dart:core::num:CLASS',name:'num',owner:null,local:false,static:false},arguments:[]};
            const value=f.createCallExpression(f.createIdentifier(binding),undefined,[transferred(n.left,carrier),transferred(n.right,carrier)]);
            return result==='double'?f.createCallExpression(f.createIdentifier(numericValues.castDouble),undefined,[value]):value;
          }
          blocked('Numeric union operator requires an explicit retained-kind operation',n);
        }
        if(n.kind==='binary'&&n.operator==='??')return createNullishCoalescing(expr(n.left),expr(n.right));
        return f.createBinaryExpression(expr(n.left,n.kind==='assignment'),binary[n.operator]!,n.kind==='assignment'?transferred(n.right,n.left.storageType):expr(n.right));
      }
      case 'prefix':{
        if(n.reference&&sourceOperatorTargets.has(n.reference.id)){
          const expected=n.operator==='-'?'unary-':n.operator;
          if(!['-','~'].includes(n.operator??'')||n.reference.name!==expected)blocked('Source value increment requires a separate read/operator/write plan',n);
          return adapted(n.reference,[],n.value,{kind:'call',receiver:'target',target:sourceOperatorTargets.get(n.reference.id)!})!;
        }
        if(numericValues&&numericKind(n.value.numeric?.resolvedType)==='num')blocked('Numeric union operator requires an explicit retained-kind operation',n);
        if(['-','~'].includes(n.operator??'')&&!['double','num','int'].includes(n.value.type)){const mapped=adapted(n.reference??null,[],n.value);if(!mapped)blocked('Unary value operator requires an exact adapter',n);return mapped;}
        const op=({'!':ts.SyntaxKind.ExclamationToken,'-':ts.SyntaxKind.MinusToken,'+':ts.SyntaxKind.PlusToken,'++':ts.SyntaxKind.PlusPlusToken,'--':ts.SyntaxKind.MinusMinusToken} as const)[n.operator as '!'];
        if(op===undefined)blocked('Unsupported prefix',n);if(n.type==='int'&&recipe.numericTypes?.int&&['++','--'].includes(n.operator??''))return integerMutation(n.value,n.operator!,null);return f.createPrefixUnaryExpression(op,expr(n.value,['++','--'].includes(n.operator??'')));
      }
      case 'postfix':if(n.reference&&sourceOperatorTargets.has(n.reference.id))return blocked('Source value increment requires a separate read/operator/write plan',n);else if(n.operator==='!')return evaluateOnce(expr(n.value),target=>[f.createIfStatement(f.createBinaryExpression(target,ts.SyntaxKind.EqualsEqualsEqualsToken,f.createNull()),f.createThrowStatement(f.createNewExpression(f.createIdentifier('TypeError'),undefined,[f.createStringLiteral('Null check operator used on a null value')]))),f.createReturnStatement(f.createNonNullExpression(target))]);else if(n.operator==='++'||n.operator==='--'){if(n.type==='int'&&recipe.numericTypes?.int)return integerMutation(n.value,n.operator,null,true);return f.createPostfixUnaryExpression(expr(n.value,true),n.operator==='++'?ts.SyntaxKind.PlusPlusToken:ts.SyntaxKind.MinusMinusToken);}else return blocked('Unsupported postfix',n);
      case 'conditional':return f.createConditionalExpression(expr(n.test),undefined,expr(n.then),undefined,expr(n.else));
      case 'list':if(numericValues&&!n.elementType)blocked('List numeric transfer requires resolved element type',n);return mutableListLiteral(n.elementType,f.createArrayLiteralExpression(n.values.map(v=>genericTransferred(v,n.elementType))),n.constant,n);
      case 'call':{
        if(n.reference&&recipe.adapters?.[n.reference.id]?.numericAbi&&numericKind(n.storageType)==='num')blocked('Scalar numeric host cannot return num without value provenance',n);
        const standalone=n.reference?declarations.find((value):value is Declaration&{kind:'function'|'method'}=>(value.kind==='function'||value.kind==='method')&&value.reference?.id===n.reference!.id):undefined;
        const method=(n.reference?ownedMember(n.reference):undefined)??(standalone?.kind==='function'||standalone?.typeParameters?.length?standalone:undefined);
        const external=n.reference&&recipe.externalStaticMethods?.[n.reference.id];
        if(external){
          const target=n.target,typeArguments=n.resolvedTypeArguments;
          if(method||external.policy!=='reified-generated-static'||!numericGenerics||!n.reference!.static||!n.reference!.id.endsWith('.'+n.name+':METHOD')||n.reference!.name!==n.name||!target||target.kind!=='identifier'||target.reference?.id!==external.ownerType||n.reference!.owner!==target.reference.name||recipe.typeBindings?.[external.ownerType]!==external.target||!imported.has(external.target)||recipe.adapters?.[n.reference!.id]||n.nullAware||!Number.isSafeInteger(external.arity)||external.arity<1||typeArguments?.length!==external.arity||n.args.some(arg=>!arg.parameterType||!arg.appliedParameterType))blocked('External static method requires exact owner/member, resolved generic arguments, numeric ABI and parameter provenance',n);
          const call=adapted(n.reference,n.args,null,{kind:'call',target:external.target+'.'+n.name,...external.namedArguments?{namedArguments:external.namedArguments}:{}})!;
          if(!ts.isCallExpression(call))blocked('External static method must lower to a call',n);
          return f.updateCallExpression(call,call.expression,typeArguments!.map(argumentType),[...typeArguments!.map(type=>typeWitness(type)),...call.arguments]);
        }
        const genericMethod=method&&'parameters' in method&&method.typeParameters?.length&&!recipe.adapters?.[n.reference!.id]?method:undefined;
        let genericArguments:ts.TypeNode[]|undefined;
        if(genericMethod){
          if(!n.resolvedTypeArguments||n.resolvedTypeArguments.length!==genericMethod.typeParameters!.length)blocked('Generated generic method needs analyzer-resolved type arguments',n);
          genericArguments=n.resolvedTypeArguments!.map(argumentType);
        }
        const expected=n.reference&&recipe.adapters?.[n.reference.id]?.typeArguments;
        const specializationKey=(t:ResolvedType):string=>t.kind==='void'?'void':t.kind==='interface'?t.reference.id+(t.arguments.length?'<'+t.arguments.map(specializationKey).join(',')+'>':'')+(t.nullable?'?':''):blocked('Generic call needs an exact monomorphic specialization',n);
        const actual=genericMethod?[]:(n.typeArguments??[]).map(specializationKey);
        if(actual.length&&JSON.stringify(actual)!==JSON.stringify(expected))blocked('Generic call requires an exact type-argument adapter',n);
        if(expected?.length&&!actual.length)blocked('Specialized adapter requires explicit source type arguments',n);
        const receiver=n.target??(currentClass&&n.reference?.owner&&!n.reference.static?{kind:'this' as const,type:currentClass.name,offset:n.offset,length:0}:null);
        if(n.nullAware){
          if(method&&'parameters' in method&&n.target&&n.reference&&!n.reference.static&&!recipe.adapters?.[n.reference.id]){
            const values=classArgs(n.args,method.parameters);
            if(witnessMethods.has(n.reference.id))values.unshift(...n.resolvedTypeArguments!.map(type=>typeWitness(type)));
            const call=f.createCallChain(f.createPropertyAccessChain(expr(n.target),f.createToken(ts.SyntaxKind.QuestionDotToken),memberName(n.name,n.reference)),undefined,genericArguments,values);
            return f.createParenthesizedExpression(f.createBinaryExpression(call,ts.SyntaxKind.QuestionQuestionToken,f.createNull()));
          }
          const adapter=n.reference&&recipe.adapters?.[n.reference.id];
          if(n.target&&adapter?.kind==='call'&&adapter.receiver==='first'&&!adapter.typeArguments?.length&&imported.has(adapter.target)){
            return evaluateOnce(expr(n.target),target=>[f.createReturnStatement(f.createConditionalExpression(f.createBinaryExpression(target,ts.SyntaxKind.EqualsEqualsEqualsToken,f.createNull()),undefined,f.createNull(),undefined,adapted(n.reference,n.args,{kind:'identifier',name:target.text,reference:{id:target.text,name:target.text,owner:null,local:true,static:false},type:n.target!.type.replace(/\?$/,''),offset:n.offset,length:0})!))]);
          }
          if(!n.target||!adapter||adapter.receiver!=='target'||adapter.kind!=='call'||adapter.namedArguments||!/^[$A-Z_a-z][$\w]*$/.test(adapter.target))blocked('Null-aware call needs an exact target-method adapter',n);
          const call=f.createCallChain(f.createPropertyAccessChain(expr(n.target!),f.createToken(ts.SyntaxKind.QuestionDotToken),adapter!.target),undefined,undefined,args(n.args));
          return f.createParenthesizedExpression(f.createBinaryExpression(call,ts.SyntaxKind.QuestionQuestionToken,f.createNull()));
        }
        const mapped=adapted(n.reference,n.args,receiver);if(mapped)return mapped;
        const arguments_=method&&'parameters' in method?classArgs(n.args,method.parameters):args(n.args);
        if(n.reference&&witnessMethods.has(n.reference.id))arguments_.unshift(...n.resolvedTypeArguments!.map(type=>typeWitness(type)));
        if(standalone?.kind==='function')return f.createCallExpression(identifier(n.name,n.reference),genericArguments,arguments_);
        if(n.target===null)return f.createCallExpression(identifier(n.name,n.reference),genericArguments,arguments_);
        if(!n.reference)blocked('Unresolved call',n);
        // An external instance method must be individually mapped. Static
        // public methods on a configured host type share its explicit adapter.
        if(!n.reference.static&&!method)blocked('Instance call requires an exact adapter: '+n.reference.id,n);
        return f.createCallExpression(f.createPropertyAccessExpression(expr(n.target),memberName(n.name,n.reference)),genericArguments,arguments_);
      }
      case 'construct':{
        const sourceFactory=n.reference&&model.ordered.find(value=>value.sourceFactories?.unnamed?.reference.id===n.reference!.id);
        if(n.const&&sourceFactory)blocked('Const unnamed source factory requires a separately qualified canonical contract',n);
        if(n.const&&n.name!=='Duration'){
          const owner=n.reference&&model.ordered.find(value=>value.constructor.reference?.id===n.reference!.id||value.namedConstructors?.some(entry=>entry.reference.id===n.reference!.id)),binding=n.reference&&recipe.constantConstructors?.[n.reference.id];
          if(owner&&(owner.constructor.redirected||owner.namedConstructors?.some(entry=>entry.redirected))&&binding?.policy!=='canonical-immutable-constructor-fields')blocked('Generative redirect const identity requires a canonical field-plan adapter',n);
          if(binding?.policy==='canonical-generated-external-fields'){
            const type=n.constructedType,target=recipe.typeBindings?.[binding.ownerType];
            if(owner||!numericGenerics||type?.kind!=='interface'||type.nullable||type.arguments.length||type.reference.id!==binding.ownerType||n.reference!.owner!==type.reference.name||n.reference!.name!==type.reference.name+'.'+(n.constructor??'new')||!target||!imported.has(target)||!imported.has(binding.factory)||n.args.some(argument=>!argument.parameterType||!argument.appliedParameterType))blocked('External const field plan requires an exact monomorphic owner/factory, numeric representation and parameter provenance',n);
            n.args.forEach(argument=>pureConst(argument.value,constExportParameters??new Set()));
            return adapted(n.reference,n.args,null,{kind:'call',target:binding.factory,...binding.namedArguments?{namedArguments:binding.namedArguments}:{}})!;
          }
          if(binding?.policy==='canonical-immutable-constructor-fields'){
            const type=n.constructedType,entry=n.constructor?owner?.namedConstructors?.find(entry=>entry.reference.id===n.reference!.id):owner?.constructor;
            if(!owner||owner.abstract||owner.namedOnly||owner.typeParameters.length||!entry?.const||entry.reference?.id!==n.reference!.id||n.constructor&&(!('name'in entry)||entry.name!==n.constructor)||entry.body||'factory'in entry&&entry.factory||!witnessClasses.has(owner.reference.id)||!numericGenerics||!imported.has(binding.factory)||type?.kind!=='interface'||type.nullable||type.arguments.length||type.reference.id!==owner.reference.id)blocked('Const field plan requires a concrete monomorphic captured owner and pure const entry',n);
            const base=owner.superclass,host=base&&recipe.superConstructors?.[base.constructor.id];
            if(base&&(!binding.hostBase||binding.hostBase.policy!=='stateless-const-base'||!host||host.target!==binding.hostBase.target||host.policy!=='no-derived-state-observation'||host.namedArguments||base.args?.length||base.type.kind!=='interface'||base.type.reference.id!=='dart:core::Object:CLASS'||base.type.arguments.length||!owner.mixins?.length||JSON.stringify(owner.mixins.map(mixin=>mixin.kind==='interface'?mixin.reference.id:null))!==JSON.stringify(host.mixins)||!imported.has(host.target)))blocked('Const field plan host base requires an exact stateless constructor/mixin contract',n);
            if(!base&&binding.hostBase)blocked('Const field plan has no source host base',n);
            const fields=owner.fields.filter(field=>!field.static);
            if(fields.some(field=>!field.final||field.late))blocked('Const field plan requires non-late final fields with reviewed representations',n);
            const allowed=new Set(entry.parameters.map(parameter=>parameter.reference?.id??entry.reference!.id.replace(/:CONSTRUCTOR$/,'.'+parameter.name+':PARAMETER')));
            n.args.forEach(argument=>pureConst(argument.value,constExportParameters??new Set()));
            entry.parameters.forEach(parameter=>{if(parameter.default)pureConst(parameter.default);});
            fields.forEach(field=>{if(field.initializer)pureConst(field.initializer);});
            for(const step of entry.prelude??[])for(const variable of step.variables){if(!variable.reference?.local||!variable.value)blocked('Const field plan requires initialized source-identity locals',n);pureConst(variable.value,allowed);allowed.add(variable.reference.id);}
            for(const initializer of entry.initializers??[]){if(initializer.kind==='field')pureConst(initializer.value,allowed);else{pureConst(initializer.test,allowed);if(initializer.message)pureConst(initializer.message,allowed);}}
            const arguments_=classArgs(n.args,entry.parameters),token=ownerValue(owner),instance=n.constructor?f.createCallExpression(f.createPropertyAccessExpression(token,memberName(n.constructor,entry.reference!)),undefined,arguments_):f.createNewExpression(token,undefined,arguments_);
            const schema=f.createArrayLiteralExpression(fields.map(field=>f.createArrayLiteralExpression([f.createStringLiteral(memberName(field.name,field.reference)),f.createStringLiteral(['int','double'].includes(numericKind(field.type)??'')?numericKind(field.type)!+(field.type.nullable?'?':''):'value')]))),identityKey=!base&&!(owner.methods??[]).some(method=>!method.static&&['==','hashCode'].includes(method.name));
            return f.createCallExpression(f.createIdentifier(binding.factory),[resolvedType(type)],[token,typeWitness(type),schema,f.createArrowFunction(undefined,undefined,[],undefined,f.createToken(ts.SyntaxKind.EqualsGreaterThanToken),instance),identityKey?f.createTrue():f.createFalse()]);
          }
          if(binding?.policy==='canonical-generated-external'){
            const type=n.constructedType,target=recipe.typeBindings?.[binding.ownerType],closed=(type:ResolvedType):boolean=>type.kind==='interface'&&type.arguments.every(closed);
            if(owner||!numericGenerics||!witnessBinding||type?.kind!=='interface'||type.nullable||type.reference.id!==binding.ownerType||!type.arguments.length||!type.arguments.every(closed)||!target||!imported.has(target)||!imported.has(binding.factory)||n.args.some(argument=>argument.name!==null||!argument.parameterType||!argument.appliedParameterType))blocked('External const requires an imported generated factory, closed owner arguments and resolved positional provenance',n);
            n.args.forEach(argument=>pureConst(argument.value));
            return f.createCallExpression(f.createIdentifier(binding.factory),type.arguments.map(argumentType),[...type.arguments.map(type=>typeWitness(type)),...args(n.args)]);
          }
          if(binding?.policy==='canonical-generated-redirect'){
            const entry=owner?.namedConstructors?.find(entry=>entry.reference.id===n.reference!.id),type=n.constructedType,redirect=entry?.redirect;
            if(!owner||!entry?.const||!entry.factory||!redirect||redirect.name||type?.kind!=='interface'||type.reference.id!==owner.reference.id||type.arguments.length!==owner.typeParameters.length||entry.parameters.some(parameter=>parameter.named||!parameter.required)||n.args.some(argument=>argument.name!==null)||n.args.length!==entry.parameters.length||redirect.args.length!==entry.parameters.length||redirect.args.some((argument,index)=>argument.name!==null||argument.value.kind!=='identifier'||argument.value.reference?.id!==entry.reference.id.replace(/:CONSTRUCTOR$/,'.'+entry.parameters[index]!.name+':PARAMETER')))blocked('Const redirect requires an exact required-positional source forwarding factory',n);
            const targetBinding=recipe.constantConstructors?.[redirect.reference.id];
            if(targetBinding?.policy!=='canonical-immutable-generic-fields'||targetBinding.factory!==binding.factory)blocked('Const redirect requires the target canonical generated constructor',n);
            const targetType=substituteWitnessType(redirect.type,new Map(owner.typeParameters.map((parameter,index)=>[parameter.reference.id,type.arguments[index]!])));
            return rawExpr({...n,name:redirect.type.kind==='interface'?redirect.type.reference.name:n.name,constructor:null,reference:redirect.reference,constructedType:targetType});
          }
          if(binding?.policy==='canonical-immutable-generic-fields'){
            const type=n.constructedType;
            const base=owner?.superclass,host=base&&recipe.superConstructors?.[base.constructor.id];
            if(base&&(!binding.hostBase||binding.hostBase.policy!=='stateless-const-base'||!host||host.target!==binding.hostBase.target||host.policy!=='no-derived-state-observation'||host.namedArguments||base.args?.length||base.type.kind!=='interface'||base.type.reference.id!=='dart:core::Object:CLASS'||base.type.arguments.length||!owner?.mixins?.length||JSON.stringify(owner.mixins.map(mixin=>mixin.kind==='interface'?mixin.reference.id:null))!==JSON.stringify(host.mixins)||!imported.has(host.target)))blocked('Generic const host base requires an exact reviewed stateless constructor/mixin contract',n);
            if(!base&&binding.hostBase)blocked('Const host base contract has no source superclass',n);
            if(!owner||owner.abstract||owner.namedOnly||n.constructor||!owner.typeParameters.length||!owner.constructor.const||owner.constructor.body||!witnessClasses.has(owner.reference.id)||!numericGenerics||!imported.has(binding.factory)||type?.kind!=='interface'||type.nullable||type.reference.id!==owner.reference.id||type.arguments.length!==owner.typeParameters.length)blocked('Generic const requires an immutable direct generated owner, numeric carriers and captured exact type arguments',n);
            const closed=(type:ResolvedType):boolean=>type.kind==='interface'&&type.arguments.every(closed)||type.kind==='parameter'&&constExportTypes?.has(type.reference.id)===true;
            if(!type.arguments.every(closed))blocked('Generic const requires closed interface type arguments',n);
            const fields=owner.fields.filter(field=>!field.static);
            if(fields.some(field=>!field.final||field.late))blocked('Generic const requires non-late final fields with reviewed representations',n);
            const parameters=new Set(owner.constructor.parameters.map(p=>owner.constructor.reference!.id.replace(/:CONSTRUCTOR$/,'.'+p.name+':PARAMETER')));
            const pure=pureConst;
            n.args.forEach(arg=>pure(arg.value,constExportParameters??new Set()));
            owner.constructor.parameters.forEach(p=>{if(p.default)pure(p.default,new Set());});
            fields.forEach(field=>{if(field.initializer)pure(field.initializer,new Set());});
            for(const initializer of owner.constructor.initializers??[]){if(initializer.kind==='field')pure(initializer.value,parameters);else{pure(initializer.test,parameters);if(initializer.message)pure(initializer.message,parameters);}}
            const values=[...type.arguments.map(type=>typeWitness(type)),...classArgs(n.args,owner.constructor.parameters)],instance=f.createNewExpression(dotted(name(owner.name)),type.arguments.map(argumentType),values);
            const schema=f.createArrayLiteralExpression(fields.map(field=>f.createArrayLiteralExpression([f.createStringLiteral(memberName(field.name,field.reference)),f.createStringLiteral(['int','double'].includes(numericKind(field.type)??'')?numericKind(field.type)!+(field.type.nullable?'?':''):'value')])));
            const identityKey=!base&&!(owner.methods??[]).some(method=>!method.static&&['==','hashCode'].includes(method.name));
            return f.createCallExpression(f.createIdentifier(binding.factory),[argumentType(type)],[dotted(name(owner.name)),typeWitness(type),schema,f.createArrowFunction(undefined,undefined,[],undefined,f.createToken(ts.SyntaxKind.EqualsGreaterThanToken),instance),identityKey?f.createTrue():f.createFalse()]);
          }
          if(binding?.policy==='canonical-immutable-host'||binding?.policy==='canonical-immutable-host-fields'){
            const type=n.constructedType,target=recipe.typeBindings?.[binding.ownerType];
            if(owner||type?.kind!=='interface'||type.nullable||type.arguments.length||type.reference.id!==binding.ownerType||!target||!imported.has(target)||!imported.has(binding.factory))blocked('Const host factory requires its exact monomorphic imported owner identity',n);
            if(binding.policy==='canonical-immutable-host-fields'){
              if(!numericGenerics||n.reference!.owner!==type.reference.name||n.reference!.name!==type.reference.name+'.'+(n.constructor??'new')||n.args.some(argument=>!argument.parameterType||!argument.appliedParameterType))blocked('Const host field plan requires exact constructor identity, numeric representation and parameter provenance',n);
              n.args.forEach(argument=>pureConst(argument.value,constExportParameters??new Set()));
            }
            const token:Expression={kind:'identifier',name:target,reference:{id:target,name:target,owner:null,local:true,static:false},type:n.name,offset:n.offset,length:0};
            return adapted(n.reference,n.args,token,{target:binding.factory,kind:'call',receiver:'first',...(binding.namedArguments?{namedArguments:binding.namedArguments}:{})})!;
          }
          if(binding?.policy==='canonical-immutable-generated-named'){
            const entry=owner?.namedConstructors?.find(entry=>entry.reference.id===n.reference!.id);
            if(!owner?.namedOnly||owner.abstract||owner.superclass||owner.typeParameters.length||!entry?.const||entry.factory||!n.constructor||entry.name!==n.constructor||owner.fields.some(field=>!field.static&&(!field.final||field.late))||!imported.has(binding.factory))blocked('Named const canonicalization requires an immutable named-only generated owner',n);
            return f.createCallExpression(f.createIdentifier(binding.factory),undefined,[f.createIdentifier(name(owner.name)),f.createPropertyAccessExpression(f.createIdentifier(name(owner.name)),memberName(entry.name,entry.reference)),...classArgs(n.args,entry.parameters)]);
          }
          if(!owner||owner.superclass&&!model.mixinParent(owner)||owner.typeParameters.length||n.constructor||!owner.constructor.const||owner.fields.some(field=>!field.static&&!field.final)||!binding||binding.policy!=='canonical-immutable-generated'||!imported.has(binding.factory))blocked('Dart const object construction requires a canonicalization adapter for an immutable generated class',n);
          return f.createCallExpression(f.createIdentifier(binding.factory),undefined,[f.createIdentifier(name(owner.name)),...classArgs(n.args,owner.constructor.parameters)]);
        }
        if(n.name==='Duration'&&recipe.durationUnit==='milliseconds'){
          const factors:Record<string,number>={days:86400000,hours:3600000,minutes:60000,seconds:1000,milliseconds:1,microseconds:.001};
          let value:ts.Expression=f.createNumericLiteral(0);for(const argument of n.args){if(!argument.name||!factors[argument.name])blocked('Unmapped Duration input',n);value=f.createBinaryExpression(value,ts.SyntaxKind.PlusToken,f.createBinaryExpression(expr(argument.value),ts.SyntaxKind.AsteriskToken,f.createNumericLiteral(factors[argument.name]!)));}return value;
        }
        if(n.name==='Float64List'&&!n.constructor)return f.createNewExpression(f.createIdentifier('Float64Array'),undefined,args(n.args));
        const owner=sourceFactory??(n.reference?model.ordered.find(value=>value.constructor.reference?.id===n.reference!.id||value.namedConstructors?.some(ctor=>ctor.reference.id===n.reference!.id)):undefined);
        const constructed=n.constructedType;
        if(n.name.includes('<')&&constructed?.kind!=='interface')blocked('Generic construction requires structured resolved type arguments',n);
        const typeArguments=constructed?.kind==='interface'?constructed.arguments:[];
        if(typeArguments.length&&!owner){
          const applications=n.reference&&recipe.constructorApplications?.[n.reference.id];
          if(applications){
            if(constructed?.kind!=='interface'||constructed.nullable||recipe.adapters?.[n.reference!.id]||recipe.constructorSpecializations?.[n.reference!.id]?.length)blocked('Generic constructor application requires one exclusive exact boundary',n);
            const matches=applications.filter(binding=>collectionTypeKey(binding.type)===collectionTypeKey(constructed!));
            if(matches.length!==1||matches[0]!.policy!=='checked-generic-constructor-application'||!['call','new'].includes(matches[0]!.kind)||!imported.has(matches[0]!.target))blocked('Generic constructor application requires one imported exact binding',n);
            const binding=matches[0]!,parameters=new Map<string,ResolvedType>();
            const collect=(type:ResolvedType):void=>{
              if(type.kind==='parameter'){if(type.promotedBound)blocked('Generic constructor application requires unpromoted source parameters',n);parameters.set(type.reference.id,{...type,nullable:false});}
              else if(type.kind==='interface')type.arguments.forEach(collect);
              else if(type.kind==='function'){collect(type.returnType);type.parameters.forEach(p=>collect(p.type));}
              else if(type.kind==='record')type.fields.forEach(collect);
              else if(type.kind==='namedRecord'){type.positional.forEach(collect);type.named.forEach(p=>collect(p.type));}
            };collect(constructed!);collect(binding.type);
            if(new Set(binding.typeParameters).size!==binding.typeParameters.length||binding.typeParameters.length!==parameters.size||binding.typeParameters.some(id=>!parameters.has(id)||!typeParameters.has(id)))blocked('Generic constructor application requires every exact in-scope parameter',n);
            const selected=binding.typeParameters.map(id=>parameters.get(id)!);
            const project=(paths:number[][]|undefined):ResolvedType[]|undefined=>paths?.map(path=>{
              if(!path.length)blocked('Constructor type projection requires a non-empty argument path',n);
              let type:ResolvedType=constructed!;
              for(const index of path){if(type.kind!=='interface'||!Number.isSafeInteger(index)||index<0||index>=type.arguments.length)blocked('Constructor type projection escaped the resolved application',n);type=type.arguments[index]!;}
              return type;
            });
            const projected=project(binding.typeArgumentPaths),witnessTypes=project(binding.witnessArgumentPaths);
            if(projected&&!projected.length||witnessTypes&&!witnessTypes.length)blocked('Constructor type projection requires at least one selected argument',n);
            if(witnessTypes&&binding.passWitnesses)blocked('Constructor witness paths and parameter witnesses require one exclusive boundary',n);
            const types=(projected??selected).map(argumentType),witnesses=witnessTypes?witnessTypes.map(type=>typeWitness(type)):binding.passWitnesses?selected.map(type=>typeWitness(type)):[],mapped=adapted(n.reference,n.args,null,binding)!;
            if(ts.isCallExpression(mapped))return f.updateCallExpression(mapped,mapped.expression,types.length?types:undefined,[...witnesses,...mapped.arguments]);
            if(ts.isNewExpression(mapped))return f.updateNewExpression(mapped,mapped.expression,types.length?types:undefined,[...witnesses,...mapped.arguments??[]]);
            return blocked('Generic constructor application requires a constructor or factory call',n);
          }
          const constructorKey=(t:ResolvedType):string=>t.kind==='interface'?t.reference.id+(t.arguments.length?'<'+t.arguments.map(constructorKey).join(',')+'>':'')+(t.nullable?'?':''):blocked('External constructor requires exact monomorphic type arguments',n);
          const keys=typeArguments.map(constructorKey);
          const matches=(n.reference&&recipe.constructorSpecializations?.[n.reference.id]||[]).filter(s=>JSON.stringify(s.typeArguments)===JSON.stringify(keys));
          if(matches.length!==1||!imported.has(matches[0]!.target))blocked('Generic construction requires one imported exact constructor specialization',n);
          return adapted(n.reference,n.args,null,matches[0]!)!;
        }
        const mapped=adapted(n.reference,n.args);if(mapped)return mapped;
        if(owner){
          const entry=n.constructor?owner.namedConstructors?.find(ctor=>ctor.name===n.constructor):owner.sourceFactories?.unnamed;
          if(owner.namedOnly&&!n.constructor&&!entry)blocked('Named-only source class has no unnamed constructor',n);
          if(owner.abstract&&!entry?.factory)blocked('Cannot construct an abstract generated class',n);
          const parameters_=entry?.parameters??(!n.constructor?owner.constructor.parameters:undefined);if(!parameters_)blocked('Unmapped own named constructor: '+n.constructor,n);
          const values_=classArgs(n.args,parameters_!);
          if(witnessClasses.has(owner.reference.id)){
            if(constructed?.kind!=='interface'||constructed.reference.id!==owner.reference.id||constructed.nullable||typeArguments.length!==owner.typeParameters.length)blocked('Witness constructor requires exact analyzer-resolved owner arguments',n);
            values_.unshift(...typeArguments.map(type=>typeWitness(type)));
          }
          return entry?f.createCallExpression(f.createPropertyAccessExpression(ownerValue(owner),memberName(entry.name,entry.reference)),typeArguments.length?typeArguments.map(argumentType):undefined,values_):f.createNewExpression(ownerValue(owner),typeArguments.length?typeArguments.map(argumentType):undefined,values_);
        }
        if(!imported.has(n.name))blocked('Constructor has no host mapping: '+n.name,n);
        return n.constructor?f.createCallExpression(dotted(name(n.name)+'.'+n.constructor),undefined,args(n.args)):f.createNewExpression(dotted(name(n.name)),undefined,args(n.args));
      }
    }
  }
  function forEach(variable:Variable,isFinal:boolean,iterable:Expression,body:ts.Statement):ts.Statement {
    if(numericValues&&!numericGenerics&&erasedNumericStorage(variable.resolvedType)&&iterable.numeric)blocked('Numeric iteration widening requires element provenance transfer',iterable);
    if(recipe.iteration?.policy!=='host-iterable')blocked('for-in requires a reviewed host-iterable boundary',iterable);
    const item=temporary();let value:ts.Expression=item;
    if(numericGenerics&&['int','double'].includes(numericKind(variable.resolvedType)??'')){
      const source=iterable.numeric?.resolvedType??iterable.storageType,element=iterable.kind==='list'||iterable.kind==='collectionList'?iterable.elementType:source?.kind==='interface'&&source.arguments.length===1?source.arguments[0]:undefined;
      if(numericKind(element)!==numericKind(variable.resolvedType))blocked('Numeric iteration requires exact boxed element provenance',iterable);
      value=scalarFromStored(item,variable.resolvedType!);
    }
    return f.createForOfStatement(undefined,f.createVariableDeclarationList([f.createVariableDeclaration(item)],ts.NodeFlags.Const),expr(iterable),f.createBlock([valueDoc(f.createVariableStatement(undefined,f.createVariableDeclarationList([f.createVariableDeclaration(variable.name,undefined,variable.resolvedType?resolvedType(variable.resolvedType):sourceType(variable.type,variable.numeric),value)],isFinal?ts.NodeFlags.Const:ts.NodeFlags.Let)),variable.numeric),body],true));
  }
  function collectionTypeKey(value:ResolvedType):string{
    if(value.kind==='interface')return JSON.stringify(['interface',value.reference.id,value.nullable,value.arguments.map(collectionTypeKey)]);
    if(value.kind==='function')return JSON.stringify(['function',value.nullable,...value.typeParameters?.length?[value.typeParameters.map(p=>[p.reference.id,p.bound?collectionTypeKey(p.bound):null])]:[],collectionTypeKey(value.returnType),value.parameters.map(p=>[p.named?p.name:null,p.named,p.required,collectionTypeKey(p.type)])]);
    if(value.kind==='record')return JSON.stringify(['record',value.nullable,value.fields.map(collectionTypeKey)]);
    if(value.kind==='namedRecord')return JSON.stringify(['namedRecord',value.nullable,value.positional.map(collectionTypeKey),value.named.map(field=>[field.name,collectionTypeKey(field.type)])]);
    if(value.kind==='parameter')return JSON.stringify(['parameter',value.reference.id,value.nullable]);
    if(value.kind==='void'||value.kind==='never')return value.kind;
    return blocked('Collection factory requires closed or explicitly scoped resolved type arguments');
  }
  function mutableListLiteral(element:ResolvedType|undefined,values:ts.Expression,constant:boolean|undefined,node:Expression):ts.Expression{
    if(!recipe.listLiterals?.length)return values;
    if(!element)blocked('Witnessed List literal requires analyzer-resolved element metadata',node);
    const matches=recipe.listLiterals.filter(binding=>collectionTypeKey(binding.elementType)===collectionTypeKey(element!));
    if(!matches.length)return values;
    if(matches.length!==1||matches[0]!.policy!=='witnessed-mutable-list'||!imported.has(matches[0]!.factory))blocked('List literal requires one exact imported witnessed factory',node);
    if(constant!==false)blocked('Witnessed mutable List requires explicit non-const analyzer provenance; const List needs a separate canonical boundary',node);
    if(numericKind(element)&&!numericGenerics)blocked('Witnessed numeric List requires boxed generic numeric storage',node);
    if(!ts.isArrayLiteralExpression(values))blocked('Mutable List literal requires explicit ordered value producers',node);
    const producers=f.createArrayLiteralExpression(values.elements.map(value=>f.createArrowFunction(undefined,undefined,[],undefined,undefined,value)));
    return f.createCallExpression(f.createIdentifier(matches[0]!.factory),[argumentType(element!)],[typeWitness(element!),producers]);
  }
  function collectionElement(element:CollectionElement,result:ts.Identifier,kind:'list'|'set'|'map'='list',types:ResolvedType[]=[]):ts.Statement {
    const insert=(values:ts.Expression[])=>f.createExpressionStatement(f.createCallExpression(f.createPropertyAccessExpression(result,kind==='map'?'set':kind==='set'?'add':'push'),undefined,values));
    const checked=(value:Expression,type:ResolvedType)=>{
      if(!witnessBinding||!imported.has(witnessBinding.cast))blocked('Null-aware collection elements require the checked source type-witness boundary',value);
      return f.createCallExpression(f.createIdentifier(witnessBinding.cast),[argumentType(type)],[genericTransferred(value,type),typeWitness(type)]);
    };
    if(element.kind==='value'){if(kind==='map')blocked('Map literal requires key/value entries');return insert([genericTransferred(element.value,types[0])]);}
    if(element.kind==='entry'){if(kind!=='map')blocked('Only Map literals admit key/value entries');return insert([genericTransferred(element.key,types[0]),genericTransferred(element.value,types[1])]);}
    if(element.kind==='nullAwareValue'){
      if(kind==='map'||types.length!==1)blocked('Null-aware value requires an exact List/Set element type',element.value);
      const value=temporary();
      return f.createBlock([f.createVariableStatement(undefined,f.createVariableDeclarationList([f.createVariableDeclaration(value,undefined,undefined,checked(element.value,{...types[0]!,nullable:true}))],ts.NodeFlags.Const)),f.createIfStatement(f.createBinaryExpression(value,ts.SyntaxKind.ExclamationEqualsEqualsToken,f.createNull()),insert([value]))],true);
    }
    if(element.kind==='nullAwareEntry'){
      if(kind!=='map'||types.length!==2||!element.keyNullAware&&!element.valueNullAware)blocked('Null-aware Map entry requires exact key/value types and explicit question flags',element.key);
      const key=temporary(),value=temporary(),keyType=types[0]!,valueType=types[1]!,captureValue=f.createVariableStatement(undefined,f.createVariableDeclarationList([f.createVariableDeclaration(value,undefined,undefined,checked(element.value,element.valueNullAware?{...valueType,nullable:true}:valueType))],ts.NodeFlags.Const)),commit=insert([key,value]);
      const body=f.createBlock([captureValue,element.valueNullAware?f.createIfStatement(f.createBinaryExpression(value,ts.SyntaxKind.ExclamationEqualsEqualsToken,f.createNull()),commit):commit],true);
      return f.createBlock([f.createVariableStatement(undefined,f.createVariableDeclarationList([f.createVariableDeclaration(key,undefined,undefined,checked(element.key,element.keyNullAware?{...keyType,nullable:true}:keyType))],ts.NodeFlags.Const)),element.keyNullAware?f.createIfStatement(f.createBinaryExpression(key,ts.SyntaxKind.ExclamationEqualsEqualsToken,f.createNull()),body):body],true);
    }
    if(element.kind==='if')return f.createIfStatement(expr(element.test),collectionElement(element.then,result,kind,types),element.else?collectionElement(element.else,result,kind,types):undefined);
    if(element.kind==='ifCase')return cachedPatternIf(element,collectionElement(element.then,result,kind,types),element.else?collectionElement(element.else,result,kind,types):undefined);
    if(element.kind==='for')return f.createForStatement(variables(element.variables),element.test?expr(element.test):undefined,element.updates.reduce<ts.Expression|undefined>((prior,value)=>prior?f.createBinaryExpression(prior,ts.SyntaxKind.CommaToken,expr(value)):expr(value),undefined),collectionElement(element.body,result,kind,types));
    if(element.kind==='spread'){
      if(numericValues&&!numericGenerics&&types.some(erasedNumericStorage)&&element.value.numeric)blocked('Numeric collection widening spread requires element provenance transfer',element.value);
      if(numericGenerics){const source=element.value.numeric?.resolvedType??element.value.storageType;if(!['list','collectionList','collectionLiteral'].includes(element.value.kind)&&!(source?.kind==='interface'&&source.arguments.length))blocked('Collection spread requires a resolved boxed generic storage contract',element.value);}
      if(recipe.iteration?.policy!=='host-iterable')blocked('Collection spread requires a reviewed host-iterable boundary',element.value);
      const source=temporary(),item=temporary(),loop=f.createForOfStatement(undefined,f.createVariableDeclarationList([f.createVariableDeclaration(item)],ts.NodeFlags.Const),kind==='map'?f.createPropertyAccessExpression(source,'entries'):source,insert(kind==='map'?[f.createPropertyAccessExpression(item,'key'),f.createPropertyAccessExpression(item,'value')]:[item]));
      return f.createBlock([f.createVariableStatement(undefined,f.createVariableDeclarationList([f.createVariableDeclaration(source,undefined,undefined,expr(element.value))],ts.NodeFlags.Const)),element.nullAware?f.createIfStatement(f.createBinaryExpression(source,ts.SyntaxKind.ExclamationEqualsEqualsToken,f.createNull()),loop):loop],true);
    }
    return forEach(element.variable,element.final,element.iterable,collectionElement(element.body,result,kind,types));
  }
  /** Match in an arrow, then run source control flow in the surrounding scope. */
  function ifCaseStatement(n:Statement&{kind:'ifCase'}):ts.Statement {
    if(recipe.patternMatching)return cachedPatternIf(n,statement(n.then),n.else?statement(n.else):undefined);
    const root=temporary(),matched=temporary(),steps:ts.Statement[]=[],bindings:{variable:Variable;final:boolean}[]=[],names=new Set<string>();
    const local=(target:ts.Identifier,value:Expression):Expression=>({...value,kind:'identifier',name:target.text,reference:{id:target.text,name:target.text,owner:null,local:true,static:false},...value.numeric?.resolvedType?{storageType:value.numeric.resolvedType}:{}});
    const capture=(value:Expression):Expression=>{const target=temporary();steps.push(f.createVariableStatement(undefined,f.createVariableDeclarationList([f.createVariableDeclaration(target,undefined,undefined,expr(value))],ts.NodeFlags.Const)));return local(target,value);};
    const check=(value:Expression,type:ResolvedType):void=>{const test=expr({kind:'typeTest',value,checkedType:type,negated:false,type:'bool',offset:n.offset,length:0});steps.push(f.createIfStatement(f.createPrefixUnaryExpression(ts.SyntaxKind.ExclamationToken,f.createParenthesizedExpression(test)),f.createReturnStatement(f.createNull())));};
    const match=(pattern:MatchPattern,input:Expression):void=>{
      if(pattern.kind==='wildcard'){if(pattern.checkedType)check(input,pattern.checkedType);return;}
      if(pattern.kind==='variable'){
        const variable=pattern.variable;if(!variable.resolvedType||names.has(variable.name))blocked('Pattern bindings require unique resolved source variables',n);names.add(variable.name);
        if(pattern.checkedType)check(input,pattern.checkedType);
        const value=pattern.checkedType?expr({kind:'typeCast',value:input,checkedType:pattern.checkedType,type:variable.type,offset:n.offset,length:0}):expr(input);
        steps.push(valueDoc(f.createVariableStatement(undefined,f.createVariableDeclarationList([f.createVariableDeclaration(variable.name,undefined,sourceType(variable.type,variable.numeric,variable.resolvedType),value)],pattern.final?ts.NodeFlags.Const:ts.NodeFlags.Let)),variable.numeric));bindings.push({variable,final:pattern.final});return;
      }
      if(pattern.kind!=='object')blocked('Extended source patterns require the ordered cached access-path policy',n);
      if(pattern.type.kind!=='interface'||pattern.type.nullable)blocked('Object patterns require a non-null resolved interface',n);check(input,pattern.type);
      const target=temporary();steps.push(f.createVariableStatement(undefined,f.createVariableDeclarationList([f.createVariableDeclaration(target,undefined,undefined,f.createAsExpression(expr(input),resolvedType(pattern.type)))],ts.NodeFlags.Const)));
      const receiver:Expression={kind:'identifier',name:target.text,reference:{id:target.text,name:target.text,owner:null,local:true,static:false},type:pattern.type.kind==='interface'?pattern.type.reference.name:'',storageType:pattern.type,offset:n.offset,length:0};
      const fields=new Set<string>();for(const field of pattern.fields){if(!field.reference.id.endsWith(':GETTER')||field.reference.static||fields.has(field.name))blocked('Object pattern requires unique resolved instance getters',n);fields.add(field.name);match(field.pattern,capture({kind:'property',target:receiver,targetType:receiver.type,name:field.name,reference:field.reference,type:field.type,numeric:field.numeric,storageType:field.storageType,offset:n.offset,length:0}));}
    };
    match(n.pattern,local(root,n.value));
    if(n.guard){const guard=expr(n.guard);rejectSuspension(f.createExpressionStatement(guard));steps.push(f.createIfStatement(f.createPrefixUnaryExpression(ts.SyntaxKind.ExclamationToken,f.createParenthesizedExpression(guard)),f.createReturnStatement(f.createNull())));}
    steps.push(f.createReturnStatement(f.createObjectLiteralExpression(bindings.map(({variable})=>f.createPropertyAssignment(f.createComputedPropertyName(f.createStringLiteral(variable.name)),f.createIdentifier(variable.name))))));
    const matcher=f.createCallExpression(f.createParenthesizedExpression(f.createArrowFunction(undefined,undefined,[],undefined,undefined,f.createBlock(steps,true))),undefined,[]);
    const declarations=bindings.map(({variable,final})=>valueDoc(f.createVariableStatement(undefined,f.createVariableDeclarationList([f.createVariableDeclaration(variable.name,undefined,sourceType(variable.type,variable.numeric,variable.resolvedType),f.createElementAccessExpression(matched,f.createStringLiteral(variable.name)))],final?ts.NodeFlags.Const:ts.NodeFlags.Let)),variable.numeric));
    return f.createBlock([f.createVariableStatement(undefined,f.createVariableDeclarationList([f.createVariableDeclaration(root,undefined,undefined,expr(n.value)),f.createVariableDeclaration(matched,undefined,undefined,matcher)],ts.NodeFlags.Const)),f.createIfStatement(f.createBinaryExpression(matched,ts.SyntaxKind.ExclamationEqualsEqualsToken,f.createNull()),f.createBlock([...declarations,statement(n.then)],true),n.else?statement(n.else):undefined)],true);
  }
  const patternObjectType:ResolvedType={kind:'interface',nullable:true,reference:{id:'dart:core::Object:CLASS',name:'Object',owner:null,local:false,static:false},arguments:[]};
  type PatternCache=Map<string,{value:ts.Identifier;ready:ts.Identifier;present?:ts.Identifier;presenceReady?:ts.Identifier;constantEquality?:true}>;
  function patternPolicy():void {
    if(recipe.patternMatching?.policy!=='ordered-cached-access-paths'||!imported.has(recipe.patternMatching.equals)||!numericGenerics||!witnessBinding)blocked('Extended source patterns require imported value equality, numeric carriers and checked witnesses');
  }
  function patternLocal(value:ts.Identifier):Expression {
    return {kind:'identifier',name:value.text,reference:{id:value.text,name:value.text,owner:null,local:true,static:false},type:'Object?',storageType:patternObjectType,offset:0,length:0};
  }
  function patternCacheDeclarations(cache:PatternCache):ts.Statement[] {
    return [...cache.values()].flatMap(entry=>entry.constantEquality?[f.createVariableStatement(undefined,f.createVariableDeclarationList([f.createVariableDeclaration(entry.value,undefined,undefined,f.createNewExpression(f.createIdentifier('Map'),[f.createKeywordTypeNode(ts.SyntaxKind.UnknownKeyword),f.createKeywordTypeNode(ts.SyntaxKind.BooleanKeyword)],[]))],ts.NodeFlags.Const))]:[
      f.createVariableStatement(undefined,f.createVariableDeclarationList([f.createVariableDeclaration(entry.value,undefined,f.createKeywordTypeNode(ts.SyntaxKind.UnknownKeyword))],ts.NodeFlags.Let)),
      f.createVariableStatement(undefined,f.createVariableDeclarationList([f.createVariableDeclaration(entry.ready,undefined,undefined,f.createFalse())],ts.NodeFlags.Let)),...entry.present&&entry.presenceReady?[f.createVariableStatement(undefined,f.createVariableDeclarationList([f.createVariableDeclaration(entry.present,undefined,undefined,f.createFalse()),f.createVariableDeclaration(entry.presenceReady,undefined,undefined,f.createFalse())],ts.NodeFlags.Let))]:[]]);
  }
  function patternAttempt(pattern:MatchPattern|null,input:Expression,guard:Expression|null,cache:PatternCache,path:string[]=[]){
    const steps:ts.Statement[]=[],bindings:{variable:Variable;final:boolean}[]=[],names=new Set<string>();
    const fail=(test:ts.Expression)=>steps.push(f.createIfStatement(f.createPrefixUnaryExpression(ts.SyntaxKind.ExclamationToken,f.createParenthesizedExpression(test)),f.createReturnStatement(f.createNull())));
    const check=(value:Expression,type:ResolvedType)=>fail(f.createCallExpression(f.createIdentifier(witnessBinding!.is),[argumentType(type)],[expr(value),typeWitness(type)]));
    const match=(pattern:MatchPattern,value:Expression,accessPath:string[]):void=>{
      if(pattern.kind==='record'){
        if(recipe.recordPatterns?.policy!=='core-shape-probe')blocked('Record patterns require reviewed Core shape admission');validateRecordShape(pattern);
        const shape=JSON.stringify([pattern.arity,[...pattern.names].sort()]),shapeKey=JSON.stringify([...accessPath,'@recordShape:'+shape]),admission=cache.get(shapeKey)??{value:temporary(),ready:temporary()};
        if(admission.present||admission.presenceReady)blocked('Record admission conflicts with a lookup cache');cache.set(shapeKey,admission);
        const fieldEntry=(key:string|number)=>{const path=[...accessPath,'@record:'+shape+':'+JSON.stringify(key)],cacheKey=JSON.stringify(path),entry=cache.get(cacheKey)??{value:temporary(),ready:temporary()};if(entry.present||entry.presenceReady)blocked('Record field conflicts with a lookup cache');cache.set(cacheKey,entry);return{entry,path};};
        const first=pattern.fields[0]!,firstEntry=fieldEntry(first.key).entry;
        // The canonical Core read is pure and validates its private record brand,
        // complete shape and static field key. No source getter/guard/cast is caught.
        steps.push(f.createIfStatement(f.createPrefixUnaryExpression(ts.SyntaxKind.ExclamationToken,admission.ready),f.createBlock([f.createTryStatement(f.createBlock([f.createExpressionStatement(f.createAssignment(firstEntry.value,readRecordField(expr(value),first.key,pattern.arity,pattern.names))),f.createExpressionStatement(f.createAssignment(firstEntry.ready,f.createTrue())),f.createExpressionStatement(f.createAssignment(admission.value,f.createTrue()))],true),f.createCatchClause(undefined,f.createBlock([f.createExpressionStatement(f.createAssignment(admission.value,f.createFalse()))],true)),undefined),f.createExpressionStatement(f.createAssignment(admission.ready,f.createTrue()))],true)));
        fail(admission.value);
        for(const field of pattern.fields){const{entry,path}=fieldEntry(field.key);steps.push(f.createIfStatement(f.createPrefixUnaryExpression(ts.SyntaxKind.ExclamationToken,entry.ready),f.createBlock([f.createExpressionStatement(f.createAssignment(entry.value,readRecordField(expr(value),field.key,pattern.arity,pattern.names))),f.createExpressionStatement(f.createAssignment(entry.ready,f.createTrue()))],true)));match(field.pattern,patternLocal(entry.value),path);}return;
      }
      if(pattern.kind==='logicalAnd'){match(pattern.left,value,accessPath);match(pattern.right,value,accessPath);return;}
      if(pattern.kind==='relational'){
        const policy=recipe.relationalPatterns,selector=pattern.operator==='!='?'==':pattern.operator;
        if(policy?.policy!=='resolved-cached-relations'||!imported.has(policy.unwrapNum)||!pattern.cacheKey||!['<','<=','>','>=','=='].includes(selector)||pattern.reference.name!==selector||pattern.reference.static||!pattern.reference.id.endsWith(':METHOD')||pattern.returnType.kind!=='interface'||pattern.returnType.nullable||pattern.returnType.reference.id!=='dart:core::bool:CLASS'||!pattern.parameterType||!pattern.appliedParameterType)blocked('Relational pattern requires exact resolved synchronous bool operator and canonical constant identity');
        // Dart caches the virtual selector result across type refinements and
        // guards. != shares ==, but different source constant kinds do not.
        const key=JSON.stringify([...accessPath,'@rel:'+selector+':'+pattern.cacheKey]),entry=cache.get(key)??{value:temporary(),ready:temporary()};
        if(entry.present||entry.presenceReady)blocked('Relational cache conflicts with a lookup path');cache.set(key,entry);
        const equality=selector==='==',core=pattern.reference.id.startsWith('dart:core::');
        let comparison:ts.Expression;
        if(equality&&core){
          if(!/^dart:core::(Object|num|int|double|String|bool|Null)\.==:METHOD$/.test(pattern.reference.id))blocked('Unreviewed core equality selector');
          const checked=f.createCallExpression(f.createIdentifier(witnessBinding!.cast),[argumentType(pattern.matchedType)],[expr(value),typeWitness(pattern.matchedType)]);
          comparison=f.createCallExpression(f.createIdentifier(recipe.patternMatching!.equals),undefined,[checked,transferred(pattern.operand,patternObjectType)]);
        }else if(core){
          if(!/^dart:core::(num|int|double)\.(<|<=|>|>=):METHOD$/.test(pattern.reference.id)||pattern.matchedType.nullable||pattern.matchedType.kind!=='parameter'&&!numericKind(pattern.matchedType)||!numericKind(pattern.operand.numeric?.resolvedType)||numericKind(pattern.parameterType)!=='num'||numericKind(pattern.appliedParameterType)!=='num')blocked('Primitive relation requires analyzer numeric receiver/operand/num parameter provenance');
          const checked=f.createCallExpression(f.createIdentifier(witnessBinding!.cast),[argumentType(pattern.matchedType)],[expr(value),typeWitness(pattern.matchedType)]);
          comparison=f.createBinaryExpression(f.createCallExpression(f.createIdentifier(policy.unwrapNum),undefined,[checked]),binary[selector]!,f.createCallExpression(f.createIdentifier(policy.unwrapNum),undefined,[transferred(pattern.operand,patternObjectType)]));
        }else{
          const checked=temporary(),receiver:Expression={...patternLocal(checked),type:pattern.matchedTypeName,storageType:pattern.matchedType};
          const operator:Expression={kind:'binary',operator:selector,reference:pattern.reference,left:receiver,right:pattern.operand,operatorParameterType:pattern.parameterType,appliedOperatorParameterType:pattern.appliedParameterType,type:'bool',storageType:pattern.returnType,offset:value.offset,length:0};
          comparison=f.createCallExpression(f.createParenthesizedExpression(f.createArrowFunction(undefined,undefined,[],undefined,undefined,f.createBlock([f.createVariableStatement(undefined,f.createVariableDeclarationList([f.createVariableDeclaration(checked,undefined,undefined,f.createCallExpression(f.createIdentifier(witnessBinding!.cast),[argumentType(pattern.matchedType)],[expr(value),typeWitness(pattern.matchedType)]))],ts.NodeFlags.Const)),f.createReturnStatement(expr(operator))],true))),undefined,[]);
        }
        steps.push(f.createIfStatement(f.createPrefixUnaryExpression(ts.SyntaxKind.ExclamationToken,entry.ready),f.createBlock([f.createExpressionStatement(f.createAssignment(entry.value,comparison)),f.createExpressionStatement(f.createAssignment(entry.ready,f.createTrue()))],true)));
        fail(pattern.operator==='!='?f.createPrefixUnaryExpression(ts.SyntaxKind.ExclamationToken,entry.value):entry.value);return;
      }
      if(pattern.kind==='wildcard'){if(pattern.checkedType)check(value,pattern.checkedType);return;}
      if(pattern.kind==='nullCheck'){
        fail(f.createBinaryExpression(expr(value),ts.SyntaxKind.ExclamationEqualsEqualsToken,f.createNull()));match(pattern.pattern,value,accessPath);return;
      }
      if(pattern.kind==='constant'){
        // Only analyzer-qualified scalar/enum constants enter this IR. The
        // constant is the equality receiver, including retained int/double tags.
        fail(numericKind(pattern.value.numeric?.resolvedType)?f.createCallExpression(f.createIdentifier(recipe.patternMatching!.equals),undefined,[transferred(pattern.value,patternObjectType),expr(value)]):f.createBinaryExpression(expr(pattern.value),ts.SyntaxKind.EqualsEqualsEqualsToken,expr(value)));return;
      }
      if(pattern.kind==='objectConstant'){
        if(recipe.objectConstantPatterns?.policy!=='canonical-receiver-equality'||pattern.constantType?.kind!=='interface'||pattern.constantType.nullable||pattern.constantType.reference.id.startsWith('dart:'))blocked('Object constant patterns require analyzer-proven source constants and canonical receiver equality');
        pureConst(pattern.value);
        const key=JSON.stringify([...accessPath,'@objectConstantEquality']),entry=cache.get(key)??{value:temporary(),ready:temporary(),constantEquality:true as const};
        if(!entry.constantEquality||entry.present||entry.presenceReady)blocked('Object constant equality conflicts with a lookup cache');cache.set(key,entry);
        const constant=temporary();steps.push(f.createVariableStatement(undefined,f.createVariableDeclarationList([f.createVariableDeclaration(constant,undefined,undefined,expr(pattern.value))],ts.NodeFlags.Const)));
        steps.push(f.createIfStatement(f.createPrefixUnaryExpression(ts.SyntaxKind.ExclamationToken,f.createCallExpression(f.createPropertyAccessExpression(entry.value,'has'),undefined,[constant])),f.createExpressionStatement(f.createCallExpression(f.createPropertyAccessExpression(entry.value,'set'),undefined,[constant,f.createCallExpression(f.createIdentifier(recipe.patternMatching!.equals),undefined,[constant,expr(value)])]))));
        fail(f.createCallExpression(f.createPropertyAccessExpression(entry.value,'get'),undefined,[constant]));return;
      }
      if(pattern.kind==='logicalOr'){
        const left=patternAttempt(pattern.left,value,null,cache,accessPath),right=patternAttempt(pattern.right,value,null,cache,accessPath);
        if(left.bindings.length||right.bindings.length)blocked('Logical-or variable joins require a further source binding contract');
        fail(f.createBinaryExpression(f.createBinaryExpression(left.call,ts.SyntaxKind.ExclamationEqualsEqualsToken,f.createNull()),ts.SyntaxKind.BarBarToken,f.createBinaryExpression(right.call,ts.SyntaxKind.ExclamationEqualsEqualsToken,f.createNull())));return;
      }
      if(pattern.kind==='variable'){
        const variable=pattern.variable;if(!variable.resolvedType||names.has(variable.name))blocked('Pattern bindings require unique resolved source variables');names.add(variable.name);
        if(pattern.checkedType)check(value,pattern.checkedType);
        const stored=f.createAsExpression(expr(value),argumentType(variable.resolvedType));
        steps.push(valueDoc(f.createVariableStatement(undefined,f.createVariableDeclarationList([f.createVariableDeclaration(variable.name,undefined,sourceType(variable.type,variable.numeric,variable.resolvedType),scalarFromStored(stored,variable.resolvedType))],pattern.final?ts.NodeFlags.Const:ts.NodeFlags.Let)),variable.numeric));bindings.push({variable,final:pattern.final});return;
      }
      if(pattern.kind==='map'){
        const binding=recipe.mapPatterns;
        if(binding?.policy!=='dart-map-get-then-presence'||!imported.has(binding.type)||pattern.type.kind!=='interface'||pattern.type.nullable||pattern.type.reference.id!=='dart:core::Map:CLASS'||pattern.type.arguments.length!==2)blocked('Map pattern requires exact Core nominal admission and get/presence contract');
        fail(f.createCallExpression(f.createPropertyAccessExpression(f.createIdentifier(binding.type),'is'),undefined,[expr(value)]));
        if(pattern.explicitTypes)check(value,pattern.type);
        const target=temporary();steps.push(f.createVariableStatement(undefined,f.createVariableDeclarationList([f.createVariableDeclaration(target,undefined,undefined,f.createAsExpression(expr(value),f.createTypeReferenceNode(binding.type,[f.createKeywordTypeNode(ts.SyntaxKind.UnknownKeyword),f.createKeywordTypeNode(ts.SyntaxKind.UnknownKeyword)])))],ts.NodeFlags.Const)));
        for(const item of pattern.entries){
          if(!item.cacheKey||!['literal','identifier'].includes(item.key.kind))blocked('Map key requires analyzer-evaluated scalar/enum identity');
          const childPath=[...accessPath,'@map:'+item.cacheKey],key=JSON.stringify(childPath),entry=cache.get(key)??{value:temporary(),ready:temporary(),present:temporary(),presenceReady:temporary()};
          if(!entry.present||!entry.presenceReady)blocked('Map cache access path conflicts with another source lookup');cache.set(key,entry);
          const keyValue=()=>transferred(item.key,patternObjectType);
          steps.push(f.createIfStatement(f.createPrefixUnaryExpression(ts.SyntaxKind.ExclamationToken,entry.ready),f.createBlock([f.createExpressionStatement(f.createAssignment(entry.value,f.createCallExpression(f.createPropertyAccessExpression(target,'get'),undefined,[keyValue()]))),f.createExpressionStatement(f.createAssignment(entry.ready,f.createTrue()))],true)));
          steps.push(f.createIfStatement(f.createBinaryExpression(f.createBinaryExpression(entry.value,ts.SyntaxKind.EqualsEqualsEqualsToken,f.createNull()),ts.SyntaxKind.AmpersandAmpersandToken,f.createPrefixUnaryExpression(ts.SyntaxKind.ExclamationToken,entry.presenceReady)),f.createBlock([f.createExpressionStatement(f.createAssignment(entry.present,f.createCallExpression(f.createPropertyAccessExpression(target,'containsKey'),undefined,[keyValue()]))),f.createExpressionStatement(f.createAssignment(entry.presenceReady,f.createTrue()))],true)));
          fail(f.createBinaryExpression(f.createBinaryExpression(entry.value,ts.SyntaxKind.ExclamationEqualsEqualsToken,f.createNull()),ts.SyntaxKind.BarBarToken,entry.present));match(item.pattern,patternLocal(entry.value),childPath);
        }
        return;
      }
      if(pattern.type.nullable||pattern.type.kind!=='interface'&&!(pattern.type.kind==='parameter'&&pattern.fields.length===0))blocked('Object pattern requires an exact interface or field-free type parameter');
      check(value,pattern.type);
        const target=temporary();steps.push(f.createVariableStatement(undefined,f.createVariableDeclarationList([f.createVariableDeclaration(target,undefined,undefined,f.createAsExpression(expr(value),argumentType(pattern.type)))],ts.NodeFlags.Const)));
      const receiver:Expression={kind:'identifier',name:target.text,reference:{id:target.text,name:target.text,owner:null,local:true,static:false},type:pattern.type.reference.name,storageType:pattern.type,offset:value.offset,length:0};
      const fields=new Set<string>();for(const field of pattern.fields){
        if(!field.reference.id.endsWith(':GETTER')||field.reference.static||fields.has(field.name)||!field.resolvedType)blocked('Object pattern requires unique resolved instance getters and applied field types');fields.add(field.name);
        const childPath=[...accessPath,propertyName(field.name,field.reference)],key=JSON.stringify(childPath);
        const entry=cache.get(key)??{value:temporary(),ready:temporary()};cache.set(key,entry);
        const read:Expression={kind:'property',target:receiver,targetType:receiver.type,name:field.name,reference:field.reference,type:field.type,numeric:field.numeric,storageType:field.storageType,offset:value.offset,length:0};
        steps.push(f.createIfStatement(f.createPrefixUnaryExpression(ts.SyntaxKind.ExclamationToken,entry.ready),f.createBlock([
          f.createExpressionStatement(f.createAssignment(entry.value,transferred(read,patternObjectType))),
          f.createExpressionStatement(f.createAssignment(entry.ready,f.createTrue()))],true)));
        match(field.pattern,patternLocal(entry.value),childPath);
      }
    };
    if(pattern)match(pattern,input,path);
    if(guard){const test=expr(guard);rejectSuspension(f.createExpressionStatement(test));fail(test);}
    steps.push(f.createReturnStatement(f.createObjectLiteralExpression(bindings.map(({variable})=>f.createPropertyAssignment(f.createComputedPropertyName(f.createStringLiteral(variable.name)),f.createIdentifier(variable.name))))));
    steps.forEach(rejectSuspension);
    const call=f.createCallExpression(f.createParenthesizedExpression(f.createArrowFunction(undefined,undefined,[],undefined,undefined,f.createBlock(steps,true))),undefined,[]);
    return {call,bindings};
  }
  function patternBindings(matched:ts.Identifier,bindings:{variable:Variable;final:boolean}[]):ts.Statement[] {
    return bindings.map(({variable,final})=>valueDoc(f.createVariableStatement(undefined,f.createVariableDeclarationList([f.createVariableDeclaration(variable.name,undefined,sourceType(variable.type,variable.numeric,variable.resolvedType),f.createElementAccessExpression(matched,f.createStringLiteral(variable.name)))],final?ts.NodeFlags.Const:ts.NodeFlags.Let)),variable.numeric));
  }
  function cachedPatternIf(n:{value:Expression;pattern:MatchPattern;guard:Expression|null},then:ts.Statement,otherwise?:ts.Statement):ts.Statement {
    patternPolicy();const root=temporary(),matched=temporary(),cache:PatternCache=new Map(),attempt=patternAttempt(n.pattern,patternLocal(root),n.guard,cache);
    return f.createBlock([
      f.createVariableStatement(undefined,f.createVariableDeclarationList([f.createVariableDeclaration(root,undefined,undefined,transferred(n.value,patternObjectType))],ts.NodeFlags.Const)),
      ...patternCacheDeclarations(cache),
      f.createVariableStatement(undefined,f.createVariableDeclarationList([f.createVariableDeclaration(matched,undefined,undefined,attempt.call)],ts.NodeFlags.Const)),
      f.createIfStatement(f.createBinaryExpression(matched,ts.SyntaxKind.ExclamationEqualsEqualsToken,f.createNull()),f.createBlock([...patternBindings(matched,attempt.bindings),then],true),otherwise)],true);
  }
  function patternSwitchExpression(n:Expression&{kind:'patternSwitchExpression'}):ts.Expression {
    patternPolicy();const root=temporary(),cache:PatternCache=new Map(),arms:ts.Statement[]=[];
    for(const arm of n.cases){const matched=temporary(),attempt=patternAttempt(arm.pattern,patternLocal(root),arm.guard,cache);
      arms.push(f.createVariableStatement(undefined,f.createVariableDeclarationList([f.createVariableDeclaration(matched,undefined,undefined,attempt.call)],ts.NodeFlags.Const)),f.createIfStatement(f.createBinaryExpression(matched,ts.SyntaxKind.ExclamationEqualsEqualsToken,f.createNull()),f.createBlock([...patternBindings(matched,attempt.bindings),f.createReturnStatement(transferred(arm.result,n.resultType))],true)));}
    const body=[f.createVariableStatement(undefined,f.createVariableDeclarationList([f.createVariableDeclaration(root,undefined,undefined,transferred(n.value,patternObjectType))],ts.NodeFlags.Const)),...patternCacheDeclarations(cache),...arms,f.createThrowStatement(f.createNewExpression(f.createIdentifier('TypeError'),undefined,[f.createStringLiteral('Non-exhaustive Dart pattern switch')]))];body.forEach(rejectSuspension);
    return f.createCallExpression(f.createParenthesizedExpression(f.createArrowFunction(undefined,undefined,[],resolvedType(n.resultType),undefined,f.createBlock(body,true))),undefined,[]);
  }
  function patternSwitchStatement(n:Statement&{kind:'patternSwitch'}):ts.Statement {
    patternPolicy();const root=temporary(),cache:PatternCache=new Map(),arms:ts.Statement[]=[];
    for(let index=0;index<n.cases.length;index++){
      const arm=n.cases[index]!;
      // Empty source labels share the following nonempty body. No synthetic
      // loop is introduced: break exits this switch, continue keeps its loop.
      const body=n.cases.slice(index).find(value=>value.statements.length)?.statements??[];
      const statements=()=>body.flatMap(value=>value.kind==='variables'?variableStatements(value):value.kind==='recordVariables'?recordVariableStatements(value):[statement(value)]);
      if(!arm.guard&&(arm.pattern===null||arm.pattern.kind==='wildcard'&&!arm.pattern.checkedType)){
        if(index!==n.cases.length-1)blocked('Pattern switch unconditional fallback must be last',n);
        arms.push(...statements(),f.createBreakStatement());continue;
      }
      const matched=temporary(),attempt=patternAttempt(arm.pattern,patternLocal(root),arm.guard,cache);
      arms.push(f.createVariableStatement(undefined,f.createVariableDeclarationList([f.createVariableDeclaration(matched,undefined,undefined,attempt.call)],ts.NodeFlags.Const)),f.createIfStatement(f.createBinaryExpression(matched,ts.SyntaxKind.ExclamationEqualsEqualsToken,f.createNull()),f.createBlock([...patternBindings(matched,attempt.bindings),...statements(),f.createBreakStatement()],true)));
    }
    return f.createSwitchStatement(f.createTrue(),f.createCaseBlock([f.createDefaultClause([f.createBlock([f.createVariableStatement(undefined,f.createVariableDeclarationList([f.createVariableDeclaration(root,undefined,undefined,transferred(n.value,patternObjectType))],ts.NodeFlags.Const)),...patternCacheDeclarations(cache),...arms],true)])]));
  }
  function variables(n:Statement&{kind:'variables'}):ts.VariableDeclarationList{if(n.late)blocked('Late declarations require a lexical block; late loop headers are not supported',n);return f.createVariableDeclarationList(n.variables.map(v=>valueDoc(f.createVariableDeclaration(v.name,undefined,v.resolvedType?.kind==='function'?resolvedType(v.resolvedType):sourceType(v.type,v.numeric,v.resolvedType),v.value?transferred(v.value,v.resolvedType):v.resolvedType?.nullable?f.createNull():undefined),v.numeric)),n.final&&n.variables.every(v=>v.value!==null)?ts.NodeFlags.Const:ts.NodeFlags.Let);}
  function variableStatements(n:Statement&{kind:'variables'}):ts.Statement[]{
    if(n.late){const binding=recipe.lateLocals;if(binding?.policy!=='checked-late-local'||!imported.has(binding.create))blocked('Late locals require an imported lexical cell boundary',n);return n.variables.map(v=>valueDoc(f.createVariableStatement(undefined,f.createVariableDeclarationList([f.createVariableDeclaration(v.name,undefined,undefined,f.createCallExpression(f.createIdentifier(binding!.create),[v.resolvedType?resolvedType(v.resolvedType):sourceType(v.type,v.numeric)],[f.createStringLiteral(v.name),n.final?f.createTrue():f.createFalse(),...v.value?[f.createArrowFunction(undefined,undefined,[],undefined,undefined,transferred(v.value,v.resolvedType))]:[]]))],ts.NodeFlags.Const)),v.numeric));}
    return n.variables.map(v=>valueDoc(f.createVariableStatement(undefined,f.createVariableDeclarationList([f.createVariableDeclaration(v.name,undefined,v.resolvedType?.kind==='function'?resolvedType(v.resolvedType):sourceType(v.type,v.numeric,v.resolvedType),v.value?transferred(v.value,v.resolvedType):v.resolvedType?.nullable?f.createNull():undefined)],n.final&&v.value!==null?ts.NodeFlags.Const:ts.NodeFlags.Let)),v.numeric));}
  function recordVariableStatements(n:Statement&{kind:'recordVariables'}):ts.Statement[]{
    if(!['record','namedRecord'].includes(n.recordType.kind)||n.recordType.nullable)blocked('Record declaration needs a non-null resolved shape',n);
    const target=temporary(),statements:ts.Statement[]=[f.createVariableStatement(undefined,f.createVariableDeclarationList([f.createVariableDeclaration(target,undefined,undefined,expr(n.value))],ts.NodeFlags.Const))];
    for(const binding of n.bindings){let value:ts.Expression=target;let type:ResolvedType=n.recordType;
      for(const index of binding.path){
        if(type.kind==='record'&&!type.nullable&&typeof index==='number'&&Number.isSafeInteger(index)&&index>=0&&index<type.fields.length){value=f.createCallExpression(f.createIdentifier(recordBoundary().read),undefined,[value,f.createNumericLiteral(index),f.createNumericLiteral(type.fields.length)]);type=type.fields[index]!;}
        else if(type.kind==='namedRecord'&&!type.nullable){const field=typeof index==='number'?Number.isSafeInteger(index)&&index>=0?type.positional[index]:undefined:type.named.find(field=>field.name===index)?.type;if(!field)blocked('Invalid named record declaration field path',n);value=f.createCallExpression(f.createIdentifier(namedRecordBoundary().read),undefined,[value,typeof index==='number'?f.createNumericLiteral(index):f.createStringLiteral(index),f.createNumericLiteral(type.positional.length),f.createArrayLiteralExpression(type.named.map(field=>f.createStringLiteral(field.name)))]);type=field;}
        else blocked('Invalid record declaration field path',n);
      }
      if('discard'in binding){
        if(recipe.recordDiscards?.policy!=='checked-typed-wildcards'||binding.discard!==true||!binding.checkedType||!numericGenerics||!witnessBinding||!binding.path.length)blocked('Typed record wildcard requires analyzer cast provenance and checked witnesses',n);
        statements.push(f.createExpressionStatement(f.createCallExpression(f.createIdentifier(witnessBinding!.cast),[argumentType(binding.checkedType)],[value,typeWitness(binding.checkedType)])));continue;
      }
      const variable=binding.variable;if(type.kind==='dynamic'&&variable.resolvedType?.kind!=='dynamic'&&!binding.checkedType)blocked('Dynamic record declaration requires analyzer cast provenance',n);if(binding.checkedType){if(!numericGenerics||!witnessBinding||JSON.stringify(binding.checkedType)!==JSON.stringify(variable.resolvedType))blocked('Record declaration cast requires the exact declared source type and witnesses',n);value=f.createCallExpression(f.createIdentifier(witnessBinding!.cast),[argumentType(binding.checkedType)],[value,typeWitness(binding.checkedType)]);}if(numericGenerics&&variable.resolvedType)value=scalarFromStored(value,variable.resolvedType);if(variable.type==='int'&&recipe.numericTypes?.int)value=f.createCallExpression(integerCheck(),undefined,[value]);statements.push(valueDoc(f.createVariableStatement(undefined,f.createVariableDeclarationList([f.createVariableDeclaration(variable.name,undefined,sourceType(variable.type,variable.numeric,variable.resolvedType),value)],n.final?ts.NodeFlags.Const:ts.NodeFlags.Let)),variable.numeric));
    }return statements;
  }
  function recordAssignment(n:Expression&{kind:'recordAssignment'}):ts.Expression {
    if(recipe.recordAssignments?.policy!=='checked-record-assignment'||n.pattern.kind!=='record'||!numericGenerics)blocked('Record assignment requires its reviewed staged matching policy and numeric carriers',n);
    const root=temporary(),prepare:ts.Statement[]=[],commit:ts.Statement[]=[],targets=new Set<string>();
    const save=(value:ts.Expression)=>{const id=temporary();prepare.push(f.createVariableStatement(undefined,f.createVariableDeclarationList([f.createVariableDeclaration(id,undefined,undefined,value)],ts.NodeFlags.Const)));return id;};
    const checked=(value:ts.Expression,type:ResolvedType)=>{if(!witnessBinding)blocked('Record assignment cast requires exact source type witnesses',n);return f.createCallExpression(f.createIdentifier(witnessBinding!.cast),[argumentType(type)],[value,typeWitness(type)]);};
    const match=(pattern:RecordAssignmentPattern,value:ts.Expression):void=>{
      if(pattern.kind==='nullAssert'){
        prepare.push(f.createIfStatement(f.createBinaryExpression(value,ts.SyntaxKind.EqualsEqualsEqualsToken,f.createNull()),f.createThrowStatement(f.createNewExpression(f.createIdentifier('TypeError'),undefined,[f.createStringLiteral('Null check operator used on a null value')]))));match(pattern.pattern,f.createNonNullExpression(value));return;
      }
      if(pattern.kind==='cast'){match(pattern.pattern,save(checked(value,pattern.checkedType)));return;}
      if(pattern.kind==='wildcard'){if(pattern.checkedType)save(checked(value,pattern.checkedType));return;}
      if(pattern.kind==='target'){
        const target=pattern.target,reference=target.kind==='identifier'?target.reference:null,type=target.storageType;
        if(!reference?.local||!/(LOCAL_VARIABLE|PARAMETER)$/.test(reference.id)||!type||!pattern.matchedType||typeof pattern.requiresCast!=='boolean')blocked('Record assignment target requires exact local declaration and analyzer cast provenance',n);
        const key=localKey(reference!);if(targets.has(key))blocked('A variable cannot be assigned twice in one source pattern',n);targets.add(key);
        if(type.kind==='function'&&JSON.stringify(type)!==JSON.stringify(pattern.matchedType))blocked('Record callable storage changes require a separately qualified function transfer',n);
        let result:ts.Expression=pattern.requiresCast?checked(value,type):f.createAsExpression(value,argumentType(type));result=scalarFromStored(result,type);
        if(numericKind(type)==='int'&&!type.nullable&&recipe.numericTypes?.int)result=f.createCallExpression(integerCheck(),undefined,[result]);
        const prepared=save(result);commit.push(f.createExpressionStatement(f.createAssignment(expr(target,true),prepared)));return;
      }
      validateRecordShape(pattern);for(const field of pattern.fields)match(field.pattern,save(readRecordField(value,field.key,pattern.arity,pattern.names)));
    };
    match(n.pattern,root);
    return evaluateOnce(expr(n.value),value=>{const statements=[f.createVariableStatement(undefined,f.createVariableDeclarationList([f.createVariableDeclaration(root,undefined,undefined,value)],ts.NodeFlags.Const)),...prepare,...commit,f.createReturnStatement(root)];return statements;});
  }
  function recordPatternCondition(value:ts.Expression,shape:ResolvedType,tests:{path:number[];test:Expression}[],node:Expression|Statement):ts.Expression{
    const read=recordBoundary().read;
    return tests.map(item=>{
      if(!item.path.length)blocked('Record pattern requires a positional field path',node);
      let field:ts.Expression=value,type:ResolvedType=shape;
      for(const index of item.path){if(type.kind!=='record'||type.nullable||!Number.isSafeInteger(index)||index<0||index>=type.fields.length)blocked('Invalid record pattern field path',node);field=f.createCallExpression(f.createIdentifier(read),undefined,[field,f.createNumericLiteral(index),f.createNumericLiteral(type.fields.length)]);type=type.fields[index]!;}
      if(numericGenerics&&(numericKind(type)||numericKind(item.test.numeric?.resolvedType))){const equals=recordBoundary().equals;if(!equals||!imported.has(equals))blocked('Record numeric patterns require an explicit value equality boundary',node);return f.createCallExpression(f.createIdentifier(equals!),undefined,[field,genericTransferred(item.test,item.test.numeric?.resolvedType)]);}
      return f.createBinaryExpression(field,ts.SyntaxKind.EqualsEqualsEqualsToken,expr(item.test));
    }).reduce<ts.Expression>((a,b)=>f.createBinaryExpression(a,ts.SyntaxKind.AmpersandAmpersandToken,b),f.createTrue());
  }
  interface ControlTarget {kind:'loop'|'switch'|'block'|'dispatcher';labels:SourceLabel[];depth:number;label?:ts.Identifier;state?:ts.Identifier;cases?:Map<string,{name:string;index:number}>}
  let controlTargets:ControlTarget[]=[],dispatcherDepth=0;
  function sourceJump(n:Statement&{kind:'break'|'continue'}):ts.Statement {
    if(n.label){
      if(!n.label.id||!n.label.name)blocked('Source jump requires a resolved label identity',n);
      for(let index=controlTargets.length-1;index>=0;index--){
        const target=controlTargets[index]!,case_=target.cases?.get(n.label.id);
        if(case_){
          if(n.kind!=='continue'||case_.name!==n.label.name||!target.state||!target.label)blocked('Case label only admits an exact source continue',n);
          return f.createBlock([f.createExpressionStatement(f.createAssignment(target.state!,f.createNumericLiteral(case_.index))),f.createContinueStatement(target.label)],true);
        }
        const label=target.labels.find(label=>label.id===n.label!.id);
        if(label){
          if(label.name!==n.label.name||n.kind==='continue'&&target.kind!=='loop')blocked('Source continue label must identify its lexical loop',n);
          target.label??=temporary();return n.kind==='continue'?f.createContinueStatement(target.label):f.createBreakStatement(target.label);
        }
      }
      return blocked('Source jump label is outside the current callable/control scope',n);
    }
    const target=[...controlTargets].reverse().find(target=>n.kind==='continue'?target.kind==='loop':target.kind!=='block');
    if(!target)blocked('Source jump has no lexical control target',n);
    // A dispatcher introduces a compiler-owned loop. Jumps to surrounding
    // source loops must cross it without acquiring that synthetic target.
    if(target.kind==='dispatcher'||target.depth<dispatcherDepth)target.label??=temporary();
    return n.kind==='continue'?f.createContinueStatement(target.label):f.createBreakStatement(target.label);
  }
  function controlledStatement(n:Statement,labels:SourceLabel[]=[]):ts.Statement {
    const kind=['while','do','for','forEach'].includes(n.kind)?'loop':n.kind==='caseSwitch'?'dispatcher':['switch','recordSwitch','patternSwitch'].includes(n.kind)?'switch':'block';
    if(labels.some(label=>!label.id||!label.name)||new Set(labels.map(label=>label.id)).size!==labels.length||controlTargets.some(target=>target.labels.some(label=>labels.some(other=>label.id===other.id))))blocked('Source labels require unique resolved lexical identities',n);
    const target:ControlTarget={kind,labels,depth:dispatcherDepth};
    if(labels.length)target.label=temporary();
    if(n.kind==='caseSwitch'){
      if(typeof n.exhaustive!=='boolean')blocked('Case dispatcher requires analyzer-proven source coverage',n);
      if(n.exhaustive&&recipe.sourceFlow?.policy!=='resolved-source-flow')blocked('Exhaustive case dispatcher requires the explicit source-flow contract',n);
      target.label??=temporary();target.state=temporary();target.cases=new Map();
      if(!n.cases.length||n.cases.some(arm=>!arm.tests.length)||n.cases.flatMap(arm=>arm.tests).filter(test=>test===null).length>1)blocked('Case dispatcher requires exact nonempty scalar case groups',n);
      n.cases.forEach((arm,index)=>arm.labels.forEach(label=>{if(!label.id||!label.name||target.cases!.has(label.id))blocked('Case labels require unique resolved identities',n);target.cases!.set(label.id,{name:label.name,index});}));
    }
    controlTargets.push(target);if(kind==='dispatcher')dispatcherDepth++;
    let result:ts.Statement;try{result=statementCore(n);}finally{controlTargets.pop();if(kind==='dispatcher')dispatcherDepth--;}
    return target.label&&kind!=='dispatcher'?f.createLabeledStatement(target.label,result):result;
  }
  function statement(n:Statement):ts.Statement {
    if(n.kind==='labeled'){
      const labels=[...n.labels];let body=n.body;while(body.kind==='labeled'){labels.push(...body.labels);body=body.body;}
      if(!labels.length)blocked('Labeled source statement requires label declarations',n);return controlledStatement(body,labels);
    }
    return ['while','do','for','forEach','switch','recordSwitch','patternSwitch','caseSwitch'].includes(n.kind)?controlledStatement(n):statementCore(n);
  }
  function statementCore(n:Statement):ts.Statement {
    switch(n.kind){
      case 'empty':return f.createEmptyStatement();
      case 'try':{
        const body=statement(n.body),finallyBlock=n.finally?statement(n.finally):undefined;if(!ts.isBlock(body)||finallyBlock&&!ts.isBlock(finallyBlock))blocked('Try/finally bodies require blocks',n);
        let clause:ts.CatchClause|undefined;
        if(n.catches.length){
          const capture=recipe.exceptions;if(capture?.policy!=='host-exception-stack'||!imported.has(capture.capture))blocked('Catch requires an imported host exception/stack boundary',n);
          const raw=temporary(),caught=temporary(),value=f.createPropertyAccessExpression(caught,'exception');
          let dispatch:ts.Statement=f.createThrowStatement(value);
          for(let index=n.catches.length-1;index>=0;index--){const arm=n.catches[index]!,previous=caughtException;caughtException=value;let block:ts.Statement;
            try{block=statement(arm.body);}finally{caughtException=previous;}
            if(!ts.isBlock(block))blocked('Catch body requires a block',n);
            const aliases:ts.Statement[]=[];for(const [alias,field]of [[arm.exception,'exception'],[arm.stack,'stackTrace']] as const)if(alias)aliases.push(f.createVariableStatement(undefined,f.createVariableDeclarationList([f.createVariableDeclaration(alias,undefined,undefined,f.createPropertyAccessExpression(caught,field))],ts.NodeFlags.Const)));
            const handled=f.createBlock([...aliases,...(block as ts.Block).statements],true);
            if(arm.type===null){if(index!==n.catches.length-1)blocked('Unconditional catch must be last',n);dispatch=handled;}
            else{if(arm.type.kind!=='interface'||arm.type.arguments.length)blocked('Typed catch requires a monomorphic runtime predicate',n);const predicate=recipe.runtimeTypes?.[arm.type.reference.id]?.is;if(!predicate||!imported.has(predicate))blocked('Typed catch requires an imported runtime predicate',n);dispatch=f.createIfStatement(f.createCallExpression(f.createIdentifier(predicate),undefined,[value]),handled,dispatch);}
          }
          clause=f.createCatchClause(f.createVariableDeclaration(raw),f.createBlock([f.createVariableStatement(undefined,f.createVariableDeclarationList([f.createVariableDeclaration(caught,undefined,undefined,f.createCallExpression(f.createIdentifier(capture.capture),undefined,[raw]))],ts.NodeFlags.Const)),dispatch],true));
        }
        if(!clause&&!finallyBlock)blocked('Try requires a catch or finally block',n);return f.createTryStatement(body as ts.Block,clause,finallyBlock as ts.Block|undefined);
      }
      case 'block':return f.createBlock(n.statements.flatMap(value=>value.kind==='variables'?variableStatements(value):value.kind==='recordVariables'?recordVariableStatements(value):[statement(value)]),true);
      case 'recordVariables':return f.createBlock(recordVariableStatements(n),true);
      case 'return':return f.createReturnStatement(n.value?transferred(n.value,returnStorage):returnStorage?.kind==='interface'&&returnStorage.reference.id==='dart:core::Null:CLASS'?f.createNull():undefined);
      case 'expression':return f.createExpressionStatement(expr(n.value));
      case 'variables':return f.createVariableStatement(undefined,variables(n));
      case 'if':return f.createIfStatement(expr(n.test),statement(n.then),n.else?statement(n.else):undefined);
      case 'ifCase':return ifCaseStatement(n);
      case 'patternSwitch':return patternSwitchStatement(n);
      case 'while':return f.createWhileStatement(expr(n.test),statement(n.body));
      case 'do':return f.createDoStatement(statement(n.body),expr(n.test));
      case 'labeled':return statement(n);
      case 'forEach':return forEach(n.variable,n.final,n.iterable,statement(n.body));
      case 'break':case 'continue':return sourceJump(n);
      case 'caseSwitch':{
        const target=controlTargets.at(-1)!;if(target.kind!=='dispatcher'||!target.label||!target.state)blocked('Case dispatcher lost its lexical control scope',n);
        const state=target.state!,label=target.label!;
        const entry=n.cases.flatMap((arm,index)=>arm.tests.map(test=>test?f.createCaseClause(expr(test),[f.createExpressionStatement(f.createAssignment(state,f.createNumericLiteral(index))),f.createBreakStatement()]):f.createDefaultClause([f.createExpressionStatement(f.createAssignment(state,f.createNumericLiteral(index))),f.createBreakStatement()])));
        const clauses:ts.CaseOrDefaultClause[]=n.cases.map((arm,index)=>f.createCaseClause(f.createNumericLiteral(index),arm.statements.length?[f.createBlock([...arm.statements.flatMap(value=>value.kind==='variables'?variableStatements(value):value.kind==='recordVariables'?recordVariableStatements(value):[statement(value)]),f.createBreakStatement(label)],true)]:index===n.cases.length-1?[f.createBreakStatement(label)]:[]));
        clauses.push(f.createDefaultClause([n.exhaustive?f.createThrowStatement(f.createNewExpression(f.createIdentifier('TypeError'),undefined,[f.createStringLiteral('Invalid value outside exhaustive Dart case dispatcher')])):f.createBreakStatement(label)]));
        return f.createBlock([f.createVariableStatement(undefined,f.createVariableDeclarationList([f.createVariableDeclaration(state,undefined,undefined,f.createPrefixUnaryExpression(ts.SyntaxKind.MinusToken,f.createNumericLiteral(1)))],ts.NodeFlags.Let)),f.createSwitchStatement(f.createAsExpression(expr(n.value),sourceType(n.value.type,n.value.numeric,n.value.storageType??n.value.numeric?.resolvedType)),f.createCaseBlock(entry)),f.createLabeledStatement(label,f.createWhileStatement(f.createTrue(),f.createBlock([f.createSwitchStatement(state,f.createCaseBlock(clauses))],true)))],true);
      }
      case 'recordSwitch':{
        if(n.recordType.kind!=='record'||n.recordType.nullable)blocked('Record switch requires a nonnullable positional record',n);
        const value=temporary();recordBoundary();
        const clauses=n.cases.map(c=>{
          const body=c.statements.length?[f.createBlock([...c.statements.flatMap(v=>v.kind==='recordVariables'?recordVariableStatements(v):[statement(v)]),f.createBreakStatement()],true)]:[];
          if(c.tests===null)return f.createDefaultClause(body);
          return f.createCaseClause(recordPatternCondition(value,n.recordType,c.tests,n),body);
        });
        return f.createBlock([f.createVariableStatement(undefined,f.createVariableDeclarationList([f.createVariableDeclaration(value,undefined,undefined,expr(n.value))],ts.NodeFlags.Const)),f.createSwitchStatement(f.createTrue(),f.createCaseBlock(clauses))],true);
      }
      case 'switch':{if(n.cases.some((c,index)=>c.test===null&&index!==n.cases.length-1))blocked('Switch statement requires a final unconditional fallback',n);const clauses:ts.CaseOrDefaultClause[]=n.cases.map((c,index)=>{
        // Empty labels share the following body. Dart 3 nonempty cases end
        // implicitly, whereas a JS case falls through without an explicit break.
        // The last empty source label exits the switch; it must not fall into
        // our synthetic exhaustive-value rejection clause.
        const body=c.statements.length?[f.createBlock([...c.statements.flatMap(value=>value.kind==='recordVariables'?recordVariableStatements(value):[statement(value)]),f.createBreakStatement()],true)]:index===n.cases.length-1?[f.createBreakStatement()]:[];
        return c.test?f.createCaseClause(expr(c.test),body):f.createDefaultClause(body);
      });if(n.exhaustive&&recipe.sourceFlow?.policy==='resolved-source-flow'&&!n.cases.some(c=>c.test===null))clauses.push(f.createDefaultClause([f.createThrowStatement(f.createNewExpression(f.createIdentifier('TypeError'),undefined,[f.createStringLiteral('Invalid value outside exhaustive Dart switch')]))]));return f.createSwitchStatement(expr(n.value),f.createCaseBlock(clauses));}
      case 'for':return f.createForStatement(variables(n.variables),n.test?expr(n.test):undefined,n.updates.reduce<ts.Expression|undefined>((a,v)=>a?f.createBinaryExpression(a,ts.SyntaxKind.CommaToken,expr(v)):expr(v),undefined),statement(n.body));
      case 'assert':if(!imported.has('FoundationBuildMode')||!imported.has('invariant'))blocked('Assert needs the debug host contract');return f.createIfStatement(dotted('FoundationBuildMode.debug'),f.createExpressionStatement(f.createCallExpression(f.createIdentifier('invariant'),undefined,[expr(n.test),f.createStringLiteral(recipe.assertion?.code??'generated-source-assert'),n.message?expr(n.message):f.createStringLiteral(recipe.assertion?.message??'Pinned Dart assertion failed')])));
    }
  }
  function parameters(values:Parameter[]):ts.ParameterDeclaration[]{
    const first=values.findIndex(v=>v.named);
    if(first>0)return [...parameters(values.slice(0,first)),...parameters(values.slice(first))];
    if(first===0){if(values.some(v=>!v.named))blocked('Named parameters must follow positional parameters');return [f.createParameterDeclaration(undefined,undefined,f.createObjectBindingPattern(values.map(v=>f.createBindingElement(undefined,undefined,v.name,v.default?transferred(v.default,v.resolvedType):!v.required?f.createNull():undefined))),undefined,f.createTypeLiteralNode(values.map(v=>f.createPropertySignature([f.createModifier(ts.SyntaxKind.ReadonlyKeyword)],v.name,v.required?undefined:f.createToken(ts.SyntaxKind.QuestionToken),v.resolvedType?.kind==='function'?resolvedType(v.resolvedType):sourceType(v.type,v.numeric,v.resolvedType)))),values.some(v=>v.required)?undefined:f.createObjectLiteralExpression())];}
    return values.map(v=>f.createParameterDeclaration(undefined,undefined,v.name,undefined,v.resolvedType?.kind==='function'?resolvedType(v.resolvedType):sourceType(v.type,v.numeric,v.resolvedType),v.default?transferred(v.default,v.resolvedType):!v.required?f.createNull():undefined));
  }
  function fieldFormals(values:(FieldFormal|ClassFormal)[]):ts.ParameterDeclaration[]{
    const firstNamed=values.findIndex(v=>v.named);
    if(firstNamed>=0&&values.slice(firstNamed).some(v=>!v.named))blocked('Named parameters must follow positional parameters');
    if(firstNamed>0)return [...fieldFormals(values.slice(0,firstNamed)),...fieldFormals(values.slice(firstNamed))];
    const initializer=(v:FieldFormal|ClassFormal)=>v.default?transferred(v.default,v.resolvedType):!v.required?f.createNull():undefined;
    if(values.length&&values.every(v=>v.named))return [f.createParameterDeclaration(undefined,undefined,f.createObjectBindingPattern(values.map(v=>f.createBindingElement(undefined,undefined,v.name,initializer(v)))),undefined,f.createTypeLiteralNode(values.map(v=>f.createPropertySignature([f.createModifier(ts.SyntaxKind.ReadonlyKeyword)],v.name,v.required?undefined:f.createToken(ts.SyntaxKind.QuestionToken),resolvedType(v.resolvedType)))),values.some(v=>v.required)?undefined:f.createObjectLiteralExpression())];
    return values.map(v=>f.createParameterDeclaration(undefined,undefined,v.name,undefined,resolvedType(v.resolvedType),initializer(v)));
  }
  function parameterChecks(values:Parameter[]):ts.Statement[]{
    const checkedWitness=(p:Parameter)=>Boolean(witnessBinding&&(numericGenerics||p.covariant)&&p.resolvedType?.kind==='parameter');
    const checks:ts.Statement[]=values.filter(checkedWitness).map(p=>f.createExpressionStatement(f.createCallExpression(f.createIdentifier(witnessBinding!.cast),[resolvedType(p.resolvedType!)],[f.createIdentifier(p.name),typeWitness(p.resolvedType!)])));
    const selectedApplications=new Set<Parameter>();
    if(recipe.parameterTypeWitnesses?.length)for(const parameter of values){if(!parameter.resolvedType)continue;const key=collectionTypeKey(parameter.resolvedType),matches=(recipe.parameterTypeWitnesses??[]).filter(binding=>collectionTypeKey(binding.type)===key);if(!matches.length)continue;
      if(matches.length!==1||matches[0]!.policy!=='checked-parameter-application'||!witnessBinding||!imported.has(witnessBinding.cast))blocked('Parameter application requires one exact imported runtime witness boundary');
      if(checkedWitness(parameter))blocked('Nested parameter application must not duplicate a direct type-parameter check');selectedApplications.add(parameter);checks.push(f.createExpressionStatement(f.createCallExpression(f.createIdentifier(witnessBinding.cast),[resolvedType(parameter.resolvedType)],[f.createIdentifier(parameter.name),typeWitness(parameter.resolvedType)])));
    }
    checks.push(...values.filter(p=>p.covariant&&!checkedWitness(p)&&!selectedApplications.has(p)).map(p=>{
      if(numericValues&&numericKind(p.resolvedType))blocked('Covariant numeric admission requires a scalar/erased argument bridge');
      const resolved=p.resolvedType,value=f.createIdentifier(p.name);
      if(resolved?.kind!=='interface')blocked('Covariant parameter requires an exact runtime interface: '+p.name);
      const t=resolved as ResolvedType&{kind:'interface'},own=ownedTypes.get(t.reference.id),predicate=recipe.runtimeTypes?.[t.reference.id]?.is;
      let valid:ts.Expression;
      if(t.arguments.length){
        const key=collectionTypeKey(t),matches=(recipe.runtimeTypeApplications??[]).filter(binding=>collectionTypeKey(binding.type)===key);
        if(matches.length!==1||matches[0]!.policy!=='checked-host-type-application'||!imported.has(matches[0]!.is))blocked('Covariant generic parameter requires an exact checked host application: '+p.name);
        const parameters=new Set<string>();
        const collect=(type:ResolvedType):void=>{if(type.kind==='parameter')parameters.add(type.reference.id);else if(type.kind==='interface')type.arguments.forEach(collect);else if(type.kind==='record')type.fields.forEach(collect);else if(type.kind==='namedRecord'){type.positional.forEach(collect);type.named.forEach(field=>collect(field.type));}else if(type.kind==='function'){collect(type.returnType);type.parameters.forEach(parameter=>collect(parameter.type));}};collect(t);
        const selected=matches[0]!.typeParameters??[];
        if(new Set(selected).size!==selected.length||selected.length!==parameters.size||selected.some(id=>!parameters.has(id)||!typeParameters.has(id)))blocked('Covariant host application requires every exact in-scope type parameter: '+p.name);
        valid=f.createCallExpression(f.createIdentifier(matches[0]!.is),undefined,[value]);
      }
      else if(own&&!interfaceIds.has(t.reference.id))valid=f.createBinaryExpression(value,ts.SyntaxKind.InstanceOfKeyword,f.createIdentifier(own));
      else if(predicate&&imported.has(predicate))valid=f.createCallExpression(f.createIdentifier(predicate),undefined,[value]);
      else return blocked('Covariant parameter requires an imported runtime predicate: '+p.name);
      if(t.nullable)valid=f.createBinaryExpression(f.createBinaryExpression(value,ts.SyntaxKind.EqualsEqualsEqualsToken,f.createNull()),ts.SyntaxKind.BarBarToken,valid);
      return f.createIfStatement(f.createPrefixUnaryExpression(ts.SyntaxKind.ExclamationToken,f.createParenthesizedExpression(valid)),f.createThrowStatement(f.createNewExpression(f.createIdentifier('TypeError'),undefined,[f.createStringLiteral('Invalid covariant argument: '+p.name)])));
    }));
    if(!recipe.numericTypes?.int)return checks;
    return [...checks,...values.filter(p=>p.type==='int'||p.type==='int?').map(p=>{
      const value=f.createIdentifier(p.name),check=f.createExpressionStatement(f.createCallExpression(integerCheck(),undefined,[value]));
      return p.type==='int?'?f.createIfStatement(f.createBinaryExpression(value,ts.SyntaxKind.ExclamationEqualsEqualsToken,f.createNull()),check):check;
    })];
  }
  function callableBody(body:Statement,params:Parameter[],storage?:ResolvedType):ts.Block {
    if(numericValues&&body.async)blocked('Numeric erased values across async bodies require Future representation transfer',body);
    const previous=asyncContext,previousCatch=caughtException,previousStorage=returnStorage,previousTargets=controlTargets,previousDepth=dispatcherDepth;asyncContext=body.async===true;caughtException=undefined;returnStorage=storage;controlTargets=[];dispatcherDepth=0;
    try{if(asyncContext&&recipe.asyncRuntime?.policy!=='host-promise')blocked('Async body requires an explicit host-promise boundary',body);const block=statement(body);if(!ts.isBlock(block))return blocked('Callable body must be a block',body);
      // Dart's body scope can shadow a formal. Preserve that inner scope instead
      // of flattening it into the JavaScript parameter scope. Checks stay outside.
      const names=body.kind==='block'?body.statements.flatMap(item=>item.kind==='variables'?item.variables.map(v=>v.name):item.kind==='recordVariables'?item.bindings.flatMap(v=>'variable'in v?[v.variable.name]:[]):[]):[];
      const shadowed=params.some(parameter=>names.includes(parameter.name));
      const terminal=(value:ts.Statement|undefined):boolean=>!!value&&(ts.isReturnStatement(value)||ts.isThrowStatement(value)||ts.isBlock(value)&&terminal(value.statements.at(-1))||ts.isIfStatement(value)&&!!value.elseStatement&&terminal(value.thenStatement)&&terminal(value.elseStatement));
      const implicitNull=storage?.kind==='interface'&&storage.reference.id==='dart:core::Null:CLASS'&&!storage.nullable&&!terminal(block.statements.at(-1));
      return f.createBlock([...parameterChecks(params),...shadowed?[block]:block.statements,...implicitNull?[f.createReturnStatement(f.createNull())]:[]],true);
    }finally{asyncContext=previous;caughtException=previousCatch;returnStorage=previousStorage;controlTargets=previousTargets;dispatcherDepth=previousDepth;}
  }
  function asyncModifiers(body:Statement|null|undefined,returnType:ResolvedType|undefined):ts.Modifier[]{
    if(!body?.async)return [];
    if(recipe.asyncRuntime?.policy!=='host-promise'||returnType?.kind!=='interface'||returnType.nullable||returnType.reference.id!=='dart:async::Future:CLASS')blocked('Async callable requires an explicit host Future return type',body);
    return [f.createModifier(ts.SyntaxKind.AsyncKeyword)];
  }
  function mixinOwnerDeclaration(n:Declaration&{kind:'class'}):ts.Statement[] {
    const registry=mixinRegistries.get(n.reference.id);if(!registry||!recipe.sourceMixinApplications)blocked('Mixin nominal owner requires an application plan',n);
    const shape=structuredClone(n);delete shape.sourceMixinOwner;shape.fields=n.fields.filter(field=>field.static);shape.interfaces=[];shape.methods=(n.methods??[]).map(method=>method.static?method:{...method,abstract:true,overrides:false,body:null});
    const emitted=classDeclaration(shape,true),declaration=emitted.find(ts.isClassDeclaration);if(!declaration)blocked('Mixin static owner did not produce a class',n);
    const oldTypes=new Map(typeParameters);typeParameters.clear();for(const parameter of n.typeParameters)typeParameters.set(parameter.reference.id,parameter.name);
    try{
      const fields=n.fields.filter(field=>!field.static).map(field=>valueDoc(f.createPropertyDeclaration([f.createModifier(ts.SyntaxKind.AbstractKeyword),...field.final?[f.createModifier(ts.SyntaxKind.ReadonlyKeyword)]:[]],memberName(field.name,field.reference),undefined,resolvedType(field.type),undefined),field.numeric));
      const value=temporary(),implementation=temporary(),predicate=f.createMethodDeclaration([f.createModifier(ts.SyntaxKind.StaticKeyword)],undefined,f.createComputedPropertyName(dotted('globalThis.Symbol.hasInstance')),undefined,undefined,[f.createParameterDeclaration(undefined,undefined,value,undefined,f.createKeywordTypeNode(ts.SyntaxKind.UnknownKeyword))],f.createKeywordTypeNode(ts.SyntaxKind.BooleanKeyword),f.createBlock([f.createReturnStatement(f.createCallExpression(f.createPropertyAccessExpression(registry!,'some'),undefined,[f.createArrowFunction(undefined,undefined,[f.createParameterDeclaration(undefined,undefined,implementation)],undefined,undefined,f.createCallExpression(f.createIdentifier(recipe.sourceMixinApplications.hasCaptured),undefined,[value,implementation]))]))],true));
      const ctor=f.createConstructorDeclaration([f.createModifier(ts.SyntaxKind.PrivateKeyword)],[],f.createBlock([f.createThrowStatement(f.createNewExpression(f.createIdentifier('TypeError'),undefined,[f.createStringLiteral('A source mixin cannot be instantiated')]))],true));
      const updated=f.updateClassDeclaration(declaration!,declaration!.modifiers,declaration!.name,declaration!.typeParameters,declaration!.heritageClauses,[...fields,...declaration!.members.filter(member=>!ts.isConstructorDeclaration(member)),predicate,ctor]);
      const contracts=n.interfaces?.length?[f.createInterfaceDeclaration(exported,name(n.name),declaration!.typeParameters,[f.createHeritageClause(ts.SyntaxKind.ExtendsKeyword,n.interfaces.map(type=>{const node=resolvedType(type);if(!ts.isTypeReferenceNode(node)||!ts.isIdentifier(node.typeName))return blocked('Mixin contract requires an exact generated/bound type reference',n);return f.createExpressionWithTypeArguments(node.typeName,node.typeArguments);}))],[])]:[];
      return [f.createVariableStatement(undefined,f.createVariableDeclarationList([f.createVariableDeclaration(registry,undefined,f.createArrayTypeNode(f.createTypeReferenceNode('Function')),f.createArrayLiteralExpression())],ts.NodeFlags.Const)),...emitted.map(statement=>statement===declaration?updated:statement),...contracts];
    }finally{typeParameters.clear();for(const [id,value]of oldTypes)typeParameters.set(id,value);}
  }
  function classDeclaration(n:Declaration&{kind:'class'},constructorEntry=false):ts.Statement[] {
    if(n.sourceMixinOwner)return mixinOwnerDeclaration(n);
    const instanceFields=n.fields.filter(field=>!field.static),staticFields=n.fields.filter(field=>field.static);
    const factoryOnly=Boolean(n.sourceFactories&&!n.sourceFactories.generativeAnchor&&!constructorEntry);
    if(factoryOnly&&(n.mixins?.length||n.sourceFactories!.nominalSuperclass?.kind==='interface'&&n.sourceFactories!.nominalSuperclass.reference.id!=='dart:core::Object:CLASS'))blocked('Factory-only nominal non-Object ancestry requires a separate unallocated heritage contract',n);
    const accessorFields=instanceFields.filter(field=>field.accessorOverrides?.length);
    if(accessorFields.length&&(!['abstract-accessor-source-field','inherited-accessor-source-field'].includes(recipe.fieldImplementations?.policy??'')||accessorFields.some(field=>field.late)))blocked('Inherited accessor field implementations require a qualified non-late backing-storage policy',n);
    if(recipe.fieldImplementations?.policy==='abstract-accessor-source-field'){
      const inherited=model.ancestors(n).slice(1).flatMap(owner=>owner.methods??[]);
      if(accessorFields.some(field=>field.accessorOverrides!.some(origin=>inherited.some(method=>method.reference.id===origin.id&&!method.abstract))))blocked('Concrete inherited accessors require the inherited-accessor-source-field policy',n);
    }
    if(accessorFields.some(field=>!field.final&&numericKind(field.type)))blocked('Mutable scalar numeric accessor fields require a qualified scalar/erased setter bridge',n);
    const backing=new Map(accessorFields.map(field=>{let target=fieldBackingNames.get(field.reference.id);if(!target){target=temporary().text;fieldBackingNames.set(field.reference.id,target);}return [field.reference.id,target];}));
    const storageName=(field:typeof instanceFields[number])=>backing.get(field.reference.id)??memberName(field.name,field.reference);
    if(n.fields.some(field=>field.final&&!field.lazyStatic)&&!imported.has('protect'))blocked('Final data class fields require the explicit immutable-field host adapter');
    if(n.fields.some(field=>['constructor','__proto__','prototype'].includes(name(field.name))))blocked('Reserved class fields need a representation adapter');
    const fields=new Map(instanceFields.map(field=>[field.reference.id,field]));
    const initializers=n.constructor.initializers??n.constructor.assertions;
    if(n.constructor.initializers&&JSON.stringify(initializers.filter(i=>i.kind==='assert'))!==JSON.stringify(n.constructor.assertions))blocked('Constructor assertion/initialization ordering is inconsistent');
    const declared=instanceFields.filter(field=>field.initializer).map(field=>field.reference.id),explicit=[...n.constructor.parameters.flatMap(p=>p.field?[p.field.id]:[]),...initializers.flatMap(i=>i.kind==='field'?[i.field.id]:[])],initialized=[...declared,...explicit];
    // Dart evaluates mutable declaration defaults even when a formal/initializer
    // subsequently replaces them. Keep both evaluations, committing the last value.
    if(!factoryOnly&&(fields.size!==instanceFields.length||new Set(explicit).size!==explicit.length||initialized.some(id=>!fields.has(id))||instanceFields.some(field=>field.final&&declared.includes(field.reference.id)&&explicit.includes(field.reference.id)||!field.late&&!initialized.includes(field.reference.id)&&(field.final||!field.type.nullable))))blocked('Every non-null field needs initialization; final fields and explicit initializers must be unique');
    const oldTypes=new Map(typeParameters),oldClass=currentClass,oldStatic=staticContext,oldConstructorWitnesses=constructorWitnesses;currentClass=n;staticContext=false;typeParameters.clear();constructorWitnesses=null;
    for(const parameter of n.typeParameters){if(typeParameters.has(parameter.reference.id)||[...typeParameters.values()].includes(parameter.name))blocked('Duplicate resolved class type parameter');typeParameters.set(parameter.reference.id,parameter.name);}
    const classWitnessParameters=witnessClasses.has(n.reference.id)?n.typeParameters.map(parameter=>({parameter,target:temporary()})):[],classWitnessValues=new Map(classWitnessParameters.map(({parameter,target})=>[parameter.reference.id,target]));
    const witnessFormals=classWitnessParameters.map(({parameter,target})=>f.createParameterDeclaration(undefined,undefined,target,undefined,f.createTypeReferenceNode(witnessBinding!.type,[f.createTypeReferenceNode(parameter.name)])));
    try{
      constructorWitnesses=classWitnessValues;
      const generics=n.typeParameters.map(p=>f.createTypeParameterDeclaration(undefined,p.name,p.bound?argumentType(p.bound):recipe.implicitTypeParameterBound==='dart-object-nullable'?f.createUnionTypeNode([f.createTypeLiteralNode([]),f.createLiteralTypeNode(f.createNull())]):undefined));
      let heritage:ts.HeritageClause[]|undefined,superCall:ts.Statement[]=[];
      if(n.superclass){
        const base=n.superclass,adapter=recipe.superConstructors?.[base.constructor.id],parent=model.parent(n),generatedMixin=model.mixinParent(n);
        const typeKey=(type:ResolvedType):string=>type.kind==='interface'?type.reference.id+(type.arguments.length?'<'+type.arguments.map(typeKey).join(',')+'>':'')+(type.nullable?'?':''):type.kind==='parameter'&&typeParameters.has(type.reference.id)?type.reference.id+(type.nullable?'?':''):blocked('Mixin application requires exact interfaces or in-scope type parameters',n);
        const mixins=(n.mixins??[]).map(type=>type.kind==='interface'&&!type.nullable?typeKey(type):blocked('Mixin application requires non-null interface owners',n));
        if(generatedMixin?Boolean(adapter)&&JSON.stringify(mixins)===JSON.stringify(adapter?.mixins??[]):mixins.length&&(parent||!adapter)||JSON.stringify(mixins)!==JSON.stringify(adapter?.mixins??[]))blocked('Mixin application requires an exact ordered host superclass binding',n);
        if(base.type.kind!=='interface'||base.type.nullable)blocked('Superclass requires a non-null resolved interface',n);
        const baseType=base.type as ResolvedType&{kind:'interface'};
        let target:string,arguments_:ts.Expression[];
        initializing=true;
        try{
          if(parent){
            if(adapter?.typeWitnessArguments)blocked('Owned superclass witness arguments are determined by its declaration',n);
            if(parent.namedOnly&&!parent.sourceFactories?.generativeAnchor)blocked('Named-only generated superclass needs an exact construction adapter',n);
            if(!generatedMixin&&base.constructor.id!==parent.constructor.reference?.id)blocked('Generated named super constructor needs a construction adapter',n);
            model.assertSafeBase(parent,recipe.values);target=name(parent.name);arguments_=classArgs(base.args??[],parent.constructor.parameters);
            if(witnessClasses.has(parent.reference.id)){if(baseType.arguments.length!==parent.typeParameters.length)blocked('Witness superclass requires exact resolved arguments');arguments_.unshift(...baseType.arguments.map(type=>typeWitness(type)));}
          }else{
            if(!adapter||adapter.policy!=='no-derived-state-observation'||!imported.has(adapter.target)||recipe.typeBindings?.[baseType.reference.id]!== (adapter.baseType??adapter.target)||adapter.baseType&&!importedTypes.has(adapter.baseType))blocked('Superclass requires an exact imported constructor adapter',n);
            target=adapter!.target;
            const values=base.args??[];
            if(adapter!.namedArguments==='options'){
              const positional=values.filter(value=>value.name===null),named=values.filter(value=>value.name!==null);
              arguments_=[...args(positional),...(named.length?[f.createObjectLiteralExpression(named.map(value=>f.createPropertyAssignment(value.name!,argumentValue(value))))]:[])];
            }else arguments_=args(values);
            if(adapter.typeWitnessArguments){
              const contract=adapter.typeWitnessArguments;
              if(contract.policy!=='resolved-super-type-arguments'||!Number.isSafeInteger(contract.arity)||contract.arity<1||contract.arity!==baseType.arguments.length)blocked('External superclass witness ABI requires exact resolved arity',n);
              arguments_.unshift(...baseType.arguments.map(type=>typeWitness(type)));
            }
          }
        }finally{initializing=false;}
        heritage=[f.createHeritageClause(ts.SyntaxKind.ExtendsKeyword,[f.createExpressionWithTypeArguments(f.createIdentifier(target!),baseType.arguments.map(argumentType))])];
        superCall=[f.createExpressionStatement(f.createCallExpression(f.createSuper(),undefined,arguments_!))];
      }
      const implemented=[...n.interfaces??[],...(n.mixins??[]).filter(value=>value.kind==='interface'&&interfaceIds.has(value.reference.id))];
      if(implemented.length){
        const interfaces=implemented.map(value=>{const mapped=value.kind==='interface'&&recipe.interfaceBindings?.[value.reference.id];if(mapped){if(value.nullable||!importedTypes.has(mapped))blocked('Implements interface mapping requires an explicitly imported non-null contract',n);return f.createExpressionWithTypeArguments(f.createIdentifier(mapped),value.arguments.map(argumentType));}const type=resolvedType(value);if(!ts.isTypeReferenceNode(type)||!ts.isIdentifier(type.typeName))return blocked('Implements requires a resolved generated or explicitly bound interface',n);return f.createExpressionWithTypeArguments(type.typeName,type.typeArguments);});
        heritage=[...heritage??[],f.createHeritageClause(ts.SyntaxKind.ImplementsKeyword,interfaces)];
      }
      if(n.mixins?.length&&!n.superclass)blocked('Mixin application requires an explicit superclass boundary',n);
      constructorWitnesses=null;
      const declarations:ts.ClassElement[]=instanceFields.flatMap<ts.ClassElement>(field=>{
        const storage=backing.get(field.reference.id);
        if(storage){
          const target=memberName(field.name,field.reference),type=resolvedType(field.type),value=f.createIdentifier('value');
          if(!field.final&&!witnessBinding)blocked('Mutable accessor fields require the checked receiver type witness boundary',field);
          const checks=field.final?[]:[f.createExpressionStatement(f.createCallExpression(f.createIdentifier(witnessBinding!.cast),[type],[value,typeWitness(field.type)]))];
          return [valueDoc(f.createPropertyDeclaration([f.createModifier(ts.SyntaxKind.PrivateKeyword),...field.final?[f.createModifier(ts.SyntaxKind.ReadonlyKeyword)]:[]],storage,n.namedOnly?f.createToken(ts.SyntaxKind.ExclamationToken):undefined,type,undefined),field.numeric),valueDoc(f.createGetAccessorDeclaration([f.createModifier(ts.SyntaxKind.OverrideKeyword)],target,[],type,f.createBlock([f.createReturnStatement(f.createPropertyAccessExpression(f.createThis(),storage))],true)),field.numeric),...field.final?[]:[valueDoc(f.createSetAccessorDeclaration([f.createModifier(ts.SyntaxKind.OverrideKeyword)],target,[f.createParameterDeclaration(undefined,undefined,value,undefined,type)],f.createBlock([...checks,f.createExpressionStatement(f.createAssignment(f.createPropertyAccessExpression(f.createThis(),storage),value))],true)),field.numeric)]];
        }
        if(!field.late)return [valueDoc(f.createPropertyDeclaration(field.final?[f.createModifier(ts.SyntaxKind.ReadonlyKeyword)]:undefined,memberName(field.name,field.reference),n.namedOnly?f.createToken(ts.SyntaxKind.ExclamationToken):undefined,resolvedType(field.type),undefined),field.numeric)];
        const binding=recipe.lateFields;if(binding?.policy!=='checked-late-instance'||!imported.has(binding.read)||!imported.has(binding.write))blocked('Uninitialized late fields require imported checked instance storage',field);
        const target=memberName(field.name,field.reference),value=f.createIdentifier('value'),keys=[f.createThis(),f.createStringLiteral(field.reference.id),f.createStringLiteral(field.name)];
        if(field.initializer&&(!binding.initialize||!imported.has(binding.initialize)))blocked('Initialized late fields require an imported lazy initializer boundary',field);
        const read=f.createCallExpression(f.createIdentifier(field.initializer?binding.initialize!:binding.read),[resolvedType(field.type)],[...keys,...field.initializer?[f.createArrowFunction(undefined,undefined,[],undefined,undefined,transferred(field.initializer,field.type)),field.final?f.createTrue():f.createFalse()]:[]]);
        return [valueDoc(f.createGetAccessorDeclaration(undefined,target,[],resolvedType(field.type),f.createBlock([f.createReturnStatement(read)],true)),field.numeric),...field.final&&field.initializer?[]:[valueDoc(f.createSetAccessorDeclaration(undefined,target,[f.createParameterDeclaration(undefined,undefined,value,undefined,resolvedType(field.type))],f.createBlock([f.createExpressionStatement(f.createCallExpression(f.createIdentifier(binding.write),[resolvedType(field.type)],[...keys,value,field.final?f.createTrue():f.createFalse()]))],true)),field.numeric)]];
      });
      const orderedStatic:typeof staticFields=[],visitingStatic=new Set<string>(),seenStatic=new Set<string>();
      const orderStatic=(field:(typeof staticFields)[number])=>{
        if(seenStatic.has(field.reference.id))return;if(visitingStatic.has(field.reference.id))blocked('Static constant cycle requires a lazy adapter',field);
        if(!field.final||!field.initializer)blocked('Only initialized static constants are supported',field);
        visitingStatic.add(field.reference.id);
        for(const ref of references(field.initializer)){const dependency=staticFields.find(item=>item.name===ref.name&&item.reference.owner===ref.owner);if(dependency)orderStatic(dependency);else if(ref.static&&ref.owner&&ref.owner!==n.name&&model.ordered.some(owner=>owner.name===ref.owner))blocked('Cross-class static constant initialization requires an explicit binding',field);}
        visitingStatic.delete(field.reference.id);seenStatic.add(field.reference.id);orderedStatic.push(field);
      };staticFields.filter(field=>!field.lazyStatic).forEach(orderStatic);
      staticContext=true;for(const field of orderedStatic)declarations.push(valueDoc(f.createPropertyDeclaration([f.createModifier(ts.SyntaxKind.StaticKeyword),f.createModifier(ts.SyntaxKind.ReadonlyKeyword)],memberName(field.name,field.reference),undefined,resolvedType(field.type),transferred(field.initializer!,field.type)),field.numeric));staticContext=false;
      const lazyFields=staticFields.filter(field=>field.lazyStatic),staticBinding=recipe.staticFields;
      if(lazyFields.length&&(staticBinding?.policy!=='lazy-class-fields'||![staticBinding.read,staticBinding.write,staticBinding.seal].every(symbol=>imported.has(symbol))))blocked('Static fields require an imported lazy class-field boundary',n);
      staticContext=true;
      for(const field of lazyFields){
        if(field.late||!field.initializer&&!field.type.nullable)blocked('Non-late static field needs an initializer or nullable default',field);
        const key=memberName(field.name,field.reference),owner=f.createIdentifier(name(n.name)),id=f.createStringLiteral(field.reference.id),fieldType=resolvedType(field.type),value=f.createIdentifier('value');
        const initializer=f.createArrowFunction(undefined,undefined,[],fieldType,undefined,field.initializer?transferred(field.initializer,field.type):f.createNull());
        declarations.push(valueDoc(f.createGetAccessorDeclaration([f.createModifier(ts.SyntaxKind.StaticKeyword)],key,[],fieldType,f.createBlock([f.createReturnStatement(f.createCallExpression(f.createIdentifier(staticBinding!.read),[fieldType],[owner,id,initializer]))],true)),field.numeric));
        if(!field.final)declarations.push(valueDoc(f.createSetAccessorDeclaration([f.createModifier(ts.SyntaxKind.StaticKeyword)],key,[f.createParameterDeclaration(undefined,undefined,value,undefined,fieldType)],f.createBlock([f.createExpressionStatement(f.createCallExpression(f.createIdentifier(staticBinding!.write),[fieldType],[owner,id,value]))],true)),field.numeric));
      }
      staticContext=false;
      constructorWitnesses=classWitnessValues;
      const values=new Map<string,ts.Expression>();
      // Dart evaluates field initializers/assertions before the base constructor.
      // Store values before super(), then commit to this only under the reviewed
      // no-derived-state-observation host contract.
      const beforeSuper:ts.Statement[]=[...parameterChecks(n.constructor.parameters)];
      const reserved=JSON.stringify([n,recipe]);let temporaryIndex=0;
      const temporaryName=()=>{let candidate:string;do{candidate="_initialField"+temporaryIndex++;}while(reserved.includes(candidate));return f.createIdentifier(candidate);};
      initializing=true;
      const store=(id:string,value:Expression)=>{const temporary=temporaryName();beforeSuper.push(valueDoc(f.createVariableStatement(undefined,f.createVariableDeclarationList([f.createVariableDeclaration(temporary,undefined,value.kind==='list'&&value.values.length===0?resolvedType(fields.get(id)!.type):undefined,transferred(value,fields.get(id)!.type))],ts.NodeFlags.Const)),value.numeric));values.set(id,temporary);};
      try{
      for(const step of n.constructor.prelude??[]){beforeSuper.push(...variableStatements({kind:'variables',final:false,variables:step.variables,offset:n.offset,length:0}),...parameterChecks(step.checks));}
        for(const field of instanceFields)if(!factoryOnly&&field.initializer&&!field.late){
          if(references(field.initializer).some(reference=>!reference.local&&n.constructor.parameters.some(parameter=>parameter.name===reference.name)))blocked('Field initializer references a name shadowed by a constructor parameter; requires lexical renaming',field);
          store(field.reference.id,field.initializer);
        }
        // Field formals capture their value before initializer-list expressions
        // can mutate the corresponding parameter.
        for(const parameter of n.constructor.parameters)if(parameter.field){const temporary=temporaryName();beforeSuper.push(valueDoc(f.createVariableStatement(undefined,f.createVariableDeclarationList([f.createVariableDeclaration(temporary,undefined,undefined,f.createIdentifier(parameter.name))],ts.NodeFlags.Const)),parameter.numeric));values.set(parameter.field.id,temporary);}
        for(const initializer of initializers){if(initializer.kind==='assert')beforeSuper.push(statement(initializer));else store(initializer.field.id,initializer.value);}
      }finally{initializing=false;}
      const assignments=factoryOnly?[]:instanceFields.filter(field=>!field.late||values.has(field.reference.id)).map(field=>f.createExpressionStatement(f.createAssignment(f.createPropertyAccessExpression(f.createThis(),storageName(field)),values.get(field.reference.id)??f.createNull())));
      const finals=instanceFields.filter(field=>field.final&&!field.late);
      const immutable=!factoryOnly&&finals.length?[f.createExpressionStatement(f.createCallExpression(f.createIdentifier('protect'),undefined,[f.createThis(),f.createArrayLiteralExpression(finals.map(field=>f.createStringLiteral(storageName(field))))]))]:[];
      const capture:ts.Statement[]=witnessClasses.has(n.reference.id)?[f.createExpressionStatement(f.createCallExpression(f.createIdentifier(classWitnessBinding!.capture),undefined,[f.createThis(),typeWitness({kind:'interface',reference:n.reference,arguments:n.typeParameters.map(parameter=>({kind:'parameter',reference:parameter.reference,nullable:false})),nullable:false})]))]:[];
      if(n.sourceMixinApplication){
        const mixin=n.sourceMixinApplication,token=typeWitness(mixin.type),owner=model.classes.get(mixin.owner.id)!;
        if(mixin.type.kind!=='interface')blocked('Source mixin capture requires an exact interface',n);
        const prior=(mixin.type.kind==='interface'?mixin.type.arguments:[]).map((argument,index)=>f.createIfStatement(f.createBinaryExpression(f.createCallExpression(f.createIdentifier(classWitnessBinding!.read),undefined,[f.createThis(),ownerValue(owner),f.createNumericLiteral(index)]),ts.SyntaxKind.ExclamationEqualsEqualsToken,typeWitness(argument)),f.createThrowStatement(f.createNewExpression(f.createIdentifier('TypeError'),undefined,[f.createStringLiteral('Conflicting repeated source mixin arguments')]))));
        capture.push(f.createIfStatement(f.createCallExpression(f.createIdentifier(recipe.sourceMixinApplications!.hasCaptured),undefined,[f.createThis(),ownerValue(owner)]),f.createBlock(prior,true),f.createBlock([f.createExpressionStatement(f.createCallExpression(f.createIdentifier(classWitnessBinding!.capture),undefined,[f.createThis(),token]))],true)));
      }
      constructorWitnesses=null;
      const constructorBody=n.constructor.body?statement(n.constructor.body):null;
      if(constructorBody&&!ts.isBlock(constructorBody))blocked('Constructor body must be a block',n);
      const physicalAnchor=Boolean(n.sourceFactories?.generativeAnchor&&!constructorEntry);
      const ctor=n.namedOnly&&!physicalAnchor?f.createConstructorDeclaration([f.createModifier(ts.SyntaxKind.PrivateKeyword)],[],f.createBlock([f.createThrowStatement(f.createNewExpression(f.createIdentifier('TypeError'),undefined,[f.createStringLiteral(n.sourceFactories?'Source owner has no directly allocatable unnamed generative constructor':'Named-only source class has no unnamed constructor')]))],true)):callableDoc(f.createConstructorDeclaration(physicalAnchor?[f.createModifier(ts.SyntaxKind.ProtectedKeyword)]:undefined,[...witnessFormals,...fieldFormals(n.constructor.parameters)],f.createBlock([...beforeSuper,...superCall,...capture,...assignments,...immutable,...constructorBody?(constructorBody as ts.Block).statements:[]],true)),n.constructor.parameters);
      const members:ts.ClassElement[]=[...declarations,ctor];
      const implementedOrigins=new Set<string>(),visitedContracts=new Set<string>();
      const collectContract=(type:ResolvedType):void=>{
        if(type.kind!=='interface'||visitedContracts.has(type.reference.id))return;visitedContracts.add(type.reference.id);
        const contract=model.classes.get(type.reference.id)??interfaces.find(owner=>owner.reference.id===type.reference.id);
        for(const member of contract?.methods??[])if(!member.static)implementedOrigins.add(member.reference.id);
        if(contract?.kind==='class'){for(const parent of[contract.superclass?.type,...contract.interfaces??[],...contract.mixins??[]])if(parent)collectContract(parent);}
      };implemented.forEach(collectContract);
      for(const method of n.methods??[]){
        if(method.operator){
          const automatic=sourceOperatorTargets.get(method.reference.id),adapter=automatic?{kind:'call' as const,receiver:'target' as const,target:automatic}:recipe.adapters?.[method.reference.id],target=automatic??renames[method.name];
          if(!automatic&&!['==','&','|','~','[]'].includes(method.name)||method.static||method.getter||method.setter||method.parameters.length!==(method.name==='~'||automatic&&method.reference.name==='unary-'?0:1)||method.parameters.some(p=>p.named)||method.body?.async||method.name==='=='&&(method.returnType.kind!=='interface'||method.returnType.reference.id!=='dart:core::bool:CLASS'||method.returnType.nullable))blocked('Only admitted synchronous instance value operators are supported',method);
          if(!target||!/^[$A-Z_a-z][$\w]*$/.test(target)||['constructor','__proto__','prototype'].includes(target)||adapter?.kind!=='call'||adapter.receiver!=='target'||adapter.target!==target||adapter.namedArguments||adapter.typeArguments?.length)blocked('Source operator needs an explicit matching member rename and receiver call adapter',method);
          if(model.ancestors(n).flatMap(owner=>[...owner.fields,...owner.methods??[]]).some(other=>other!==method&&!('operator' in other&&other.operator)&&memberName(other.name,other.reference)===target))blocked('Source operator target collides with another class member',method);
        }
        if(['constructor','__proto__','prototype'].includes(method.name))blocked('Reserved class member needs an adapter: '+method.name,method);
        if(method.abstract&&(!n.abstract||method.static||method.body))blocked('Invalid abstract method declaration',method);
        if(!method.abstract&&!method.body)blocked('Concrete method requires a body',method);
        const outerTypes=new Map(typeParameters),outerMethodTypes=new Set(methodTypeParameters),outerWitnesses=new Map(typeWitnesses);
        try{
        if(new Set((method.typeParameters??[]).map(p=>p.name)).size!==(method.typeParameters??[]).length)blocked('Duplicate method type parameter name',method);
        for(const parameter of method.typeParameters??[]){if(typeParameters.has(parameter.reference.id)||methodTypeParameters.has(parameter.reference.id))blocked('Duplicate resolved method type parameter',method);const target=[...typeParameters.values()].includes(parameter.name)?temporary().text:parameter.name;typeParameters.set(parameter.reference.id,target);methodTypeParameters.add(parameter.reference.id);}
        const witnessParameters=witnessMethods.has(method.reference.id)?method.typeParameters!.map(parameter=>{const target=temporary();typeWitnesses.set(parameter.reference.id,target);return f.createParameterDeclaration(undefined,undefined,target,undefined,f.createTypeReferenceNode(witnessBinding!.type,[f.createTypeReferenceNode(typeParameters.get(parameter.reference.id)!)]));}):[];
        staticContext=method.static;
        const methodGenerics=method.typeParameters?.map(p=>f.createTypeParameterDeclaration(undefined,typeParameters.get(p.reference.id)!,p.bound?argumentType(p.bound):recipe.implicitTypeParameterBound==='dart-object-nullable'?f.createUnionTypeNode([f.createTypeLiteralNode([]),f.createLiteralTypeNode(f.createNull())]):undefined));
        if(methodGenerics?.length&&(method.getter||method.setter||method.operator))blocked('Generic accessors/operators require an explicit rule',method);
        const ancestors=model.ancestors(n).slice(1),objectOnlyMixinOverride=ancestors.some(owner=>model.sourceMixins.has(owner.reference.id))&&method.name!=='toString'&&Boolean(method.overrideOrigins?.length)&&method.overrideOrigins!.every(origin=>origin.id.startsWith('dart:core::Object.'))&&!ancestors.some(owner=>(owner.methods??[]).some(base=>memberName(base.name,base.reference)===memberName(method.name,method.reference)));
        const interfaceOnlyOverride=Boolean(method.overrideOrigins?.length)&&method.overrideOrigins!.every(origin=>implementedOrigins.has(origin.id)||interfaces.some(contract=>contract.methods.some(member=>member.reference.id===origin.id)))&&!ancestors.some(owner=>(owner.methods??[]).some(base=>!base.static&&memberName(base.name,base.reference)===memberName(method.name,method.reference)));
        const body=method.body?callableBody(method.body,method.parameters,method.returnType):undefined,rawParams=fieldFormals(method.parameters),params=method.abstract?rawParams.map(parameter=>f.updateParameterDeclaration(parameter,parameter.modifiers,parameter.dotDotDotToken,ts.isIdentifier(parameter.name)?parameter.name:f.createIdentifier(method.parameters.some(item=>item.name==='options')?temporary().text:'options'),parameter.questionToken??(parameter.initializer?f.createToken(ts.SyntaxKind.QuestionToken):undefined),parameter.type,undefined)):rawParams,modifiers=[...asyncModifiers(method.body,method.returnType),...(method.static?[f.createModifier(ts.SyntaxKind.StaticKeyword)]:[]),...(method.abstract?[f.createModifier(ts.SyntaxKind.AbstractKeyword)]:[]),...(n.superclass&&method.overrides&&!objectOnlyMixinOverride&&!interfaceOnlyOverride?[f.createModifier(ts.SyntaxKind.OverrideKeyword)]:[])];
        const methodName=memberName(method.name,method.reference);
        if(method.getter){if(method.parameters.length)blocked('Getter cannot have parameters',method);members.push(callableDoc(f.createGetAccessorDeclaration(modifiers,methodName,[],resolvedType(method.returnType),body),method.parameters,method.numericReturn));}
        else if(method.setter){if(params.length!==1||method.parameters[0]?.named)blocked('Setter requires one positional parameter',method);members.push(callableDoc(f.createSetAccessorDeclaration(modifiers,methodName,params,body),method.parameters));}
        else members.push(callableDoc(f.createMethodDeclaration(modifiers,undefined,methodName,undefined,methodGenerics,[...witnessParameters,...params],resolvedType(method.returnType),body),method.parameters,method.numericReturn));
        }finally{typeParameters.clear();for(const[id,value]of outerTypes)typeParameters.set(id,value);methodTypeParameters.clear();for(const id of outerMethodTypes)methodTypeParameters.add(id);typeWitnesses.clear();for(const[id,value]of outerWitnesses)typeWitnesses.set(id,value);}
      }
      for(const constructor of n.namedConstructors??[]){if(constructor.physicalAnchor&&n.abstract)continue;staticContext=true;members.push(namedConstructor(n,constructor));}
      if(n.sourceFactories?.unnamed&&!constructorEntry){staticContext=true;members.push(namedConstructor(n,n.sourceFactories.unnamed));}
      // Seal admitted static constants immediately after
      // class initialization, before the next declaration can observe the class.
      // This preserves protection without requiring native Babel static blocks.
      const declaration=f.createClassDeclaration([...n.sourceMixinApplication?[]:exported,...n.abstract?[f.createModifier(ts.SyntaxKind.AbstractKeyword)]:[]],name(n.name),generics,heritage,members);
      const constants=staticFields.filter(field=>!field.lazyStatic);
      const protectStatic=constants.length?[f.createExpressionStatement(f.createCallExpression(f.createIdentifier('protect'),undefined,[f.createIdentifier(name(n.name)),f.createArrayLiteralExpression(constants.map(field=>f.createStringLiteral(memberName(field.name,field.reference))))]))]:[];
      const sealStatic=lazyFields.length?[f.createExpressionStatement(f.createCallExpression(f.createIdentifier(staticBinding!.seal),undefined,[f.createIdentifier(name(n.name)),f.createArrayLiteralExpression(lazyFields.map(field=>f.createStringLiteral(memberName(field.name,field.reference))))]))]:[];
      const exports:ts.Statement[]=[];
      const constructors=constructorEntry?[]:[...n.constructor.reference&&!n.namedOnly?[{reference:n.constructor.reference,name:null,parameters:n.constructor.parameters}]:[],...(n.namedConstructors??[]).map(entry=>({reference:entry.reference,name:entry.name,parameters:entry.parameters}))];
      for(const constructor of constructors){
        const binding=recipe.constantConstructors?.[constructor.reference.id];
        if(!binding||!('exportFactory'in binding)||!binding.exportFactory)continue;
        const symbol=binding.exportFactory;
        const fieldPlan=binding.policy==='canonical-immutable-constructor-fields';
        if(!['canonical-immutable-generic-fields','canonical-immutable-constructor-fields','canonical-generated-redirect'].includes(binding.policy)||!/^[$A-Z_a-z][$\w]*$/.test(symbol)||constExportNames.has(symbol)||importedTypes.has(symbol)||[...locals].some(local=>name(local)===symbol)||!witnessClasses.has(n.reference.id)||!fieldPlan&&constructor.parameters.some(parameter=>parameter.named||!parameter.required||parameter.default))blocked('Generated const export requires a unique name, reified owner and supported parameter ABI',n);
        constExportNames.add(symbol);
        const previousParams=constExportParameters,previousTypes=constExportTypes,previousStatic=staticContext;
        const previousWitnesses:Map<string,ts.Expression>|null=constructorWitnesses;
        try{
          staticContext=false;constructorWitnesses=classWitnessValues;
          constExportTypes=new Set(n.typeParameters.map(parameter=>parameter.reference.id));
          const arguments_:Argument[]=constructor.parameters.map((parameter,index)=>({name:fieldPlan&&parameter.named?parameter.name:null,parameterType:parameter.resolvedType,appliedParameterType:parameter.resolvedType,value:{kind:'identifier',name:parameter.name,reference:{id:constructor.reference.id+'::const-export:'+index,name:parameter.name,owner:null,local:true,static:false},type:parameter.type,storageType:parameter.resolvedType,...parameter.numeric?{numeric:parameter.numeric}:{},offset:n.offset,length:0}}));
          constExportParameters=new Set(arguments_.map(argument=>(argument.value as Expression&{kind:'identifier'}).reference!.id));
          const type:ResolvedType={kind:'interface',reference:n.reference,arguments:n.typeParameters.map(parameter=>({kind:'parameter',reference:parameter.reference,nullable:false})),nullable:false};
          const value=rawExpr({kind:'construct',name:n.name,constructor:constructor.name,reference:constructor.reference,args:arguments_,const:true,constructedType:type,type:n.name,offset:n.offset,length:0});
          exports.push(callableDoc(f.createFunctionDeclaration(exported,undefined,symbol,generics,[...witnessFormals,...fieldFormals(constructor.parameters)],resolvedType(type),f.createBlock([f.createReturnStatement(value)],true)),constructor.parameters));
        }finally{constExportParameters=previousParams;constExportTypes=previousTypes;constructorWitnesses=previousWitnesses;staticContext=previousStatic;}
      }
      return [declaration,...protectStatic,...sealStatic,...exports];
    }finally{typeParameters.clear();for(const[id,value]of oldTypes)typeParameters.set(id,value);currentClass=oldClass;staticContext=oldStatic;constructorWitnesses=oldConstructorWitnesses;}
  }
  function mixinInterface(n:Declaration&{kind:'mixinInterface'}):ts.InterfaceDeclaration{
    typeParameters.clear();
    for(const parameter of n.typeParameters){if(typeParameters.has(parameter.reference.id)||[...typeParameters.values()].includes(parameter.name))blocked('Duplicate resolved mixin type parameter');typeParameters.set(parameter.reference.id,parameter.name);}
    try{
      const generics=n.typeParameters.map(p=>f.createTypeParameterDeclaration(undefined,p.name,p.bound?argumentType(p.bound):recipe.implicitTypeParameterBound==='dart-object-nullable'?f.createUnionTypeNode([f.createTypeLiteralNode([]),f.createLiteralTypeNode(f.createNull())]):undefined));
      const members=n.methods.map(method=>{
        if(!method.abstract||method.body||method.static||method.getter||method.setter||method.operator)blocked('Only abstract instance method contracts can form a mixin interface',method);
        const parameters=fieldFormals(method.parameters).map(parameter=>f.updateParameterDeclaration(parameter,parameter.modifiers,parameter.dotDotDotToken,ts.isIdentifier(parameter.name)?parameter.name:f.createIdentifier('options'),parameter.questionToken??(parameter.initializer?f.createToken(ts.SyntaxKind.QuestionToken):undefined),parameter.type,undefined));
        return callableDoc(f.createMethodSignature(undefined,memberName(method.name,method.reference),undefined,undefined,parameters,resolvedType(method.returnType)),method.parameters,method.numericReturn);
      });
      return f.createInterfaceDeclaration(exported,name(n.name),generics,undefined,members);
    }finally{typeParameters.clear();}
  }
  function mutatesStorage(value:unknown):boolean{if(Array.isArray(value))return value.some(mutatesStorage);if(!value||typeof value!=='object')return false;const node=value as {kind?:string;operator?:string};return node.kind==='assignment'||node.kind==='recordAssignment'||['prefix','postfix'].includes(node.kind??'')&&['++','--'].includes(node.operator??'')||Object.values(value).some(mutatesStorage);}
  function namedConstructor(owner:Declaration&{kind:'class'},constructor:NamedConstructor):ts.MethodDeclaration {
    if(['constructor','prototype','__proto__'].includes(constructor.name))blocked('Named constructor requires a generic/reserved-name adapter',constructor);
    if((owner.typeParameters.length||owner.superclass?.type.kind==='interface'&&owner.superclass.type.arguments.length)&&!constructor.factory&&!constructor.physicalAnchor&&!witnessClasses.has(owner.reference.id))blocked('Generic named generative entry requires captured owner witnesses',constructor);
    const previousMethodTypes=new Set(methodTypeParameters),previousWitnesses=new Map(typeWitnesses);
    try{
    for(const parameter of owner.typeParameters)methodTypeParameters.add(parameter.reference.id);
    const witnessParameters=witnessClasses.has(owner.reference.id)?owner.typeParameters.map(parameter=>{const target=temporary();typeWitnesses.set(parameter.reference.id,target);return f.createParameterDeclaration(undefined,undefined,target,undefined,f.createTypeReferenceNode(witnessBinding!.type,[f.createTypeReferenceNode(typeParameters.get(parameter.reference.id)!)]));}):[];
    const generics=owner.typeParameters.length?owner.typeParameters.map(p=>f.createTypeParameterDeclaration(undefined,typeParameters.get(p.reference.id)!,p.bound?argumentType(p.bound):recipe.implicitTypeParameterBound==='dart-object-nullable'?f.createUnionTypeNode([f.createTypeLiteralNode([]),f.createLiteralTypeNode(f.createNull())]):undefined)):undefined;
    let body:ts.Block;
    if(constructor.physicalAnchor){
      if(!owner.sourceFactories?.generativeAnchor||owner.constructor.reference?.id!==constructor.reference.id||owner.abstract)blocked('Physical generative anchor requires its exact concrete source owner',constructor);
      const positional=constructor.parameters.filter(parameter=>!parameter.named),named=constructor.parameters.filter(parameter=>parameter.named);
      const values=[...witnessParameters.map(parameter=>parameter.name as ts.Identifier),...positional.map(parameter=>f.createIdentifier(parameter.name)),...named.length?[f.createObjectLiteralExpression(named.map(parameter=>f.createShorthandPropertyAssignment(parameter.name)))]:[]];
      body=f.createBlock([f.createReturnStatement(f.createNewExpression(f.createIdentifier(name(owner.name)),owner.typeParameters.map(parameter=>f.createTypeReferenceNode(typeParameters.get(parameter.reference.id)!)),values))],true);
    }
    else if(constructor.redirect){
      const redirect=constructor.redirect;
      if(!constructor.factory||constructor.body||constructor.initializers.length||redirect.type.kind!=='interface'||redirect.type.nullable||redirect.args.some(argument=>!argument.parameterType||!argument.appliedParameterType||!argument.value.storageType))blocked('Redirecting factory requires exact parameter/default/storage forwarding',constructor);
      body=f.createBlock([...parameterChecks(constructor.parameters),f.createReturnStatement(expr({kind:'construct',name:redirect.type.reference.name,constructor:redirect.name,reference:redirect.reference,args:redirect.args,const:false,constructedType:redirect.type,type:redirect.type.reference.name,offset:constructor.offset,length:constructor.length}))],true);
    }
    else if(constructor.factory){if(!constructor.body||constructor.initializers.length)blocked('Factory has unsupported initializers/body',constructor);body=callableBody(constructor.body!,constructor.parameters,{kind:'interface',reference:owner.reference,nullable:false,arguments:owner.typeParameters.map(parameter=>({kind:'parameter',reference:parameter.reference,nullable:false}))});}
    else if(!owner.typeParameters.length&&!constructor.body&&!constructor.prelude&&!owner.constructor.prelude&&!owner.namedOnly&&!owner.superclass&&!owner.constructor.body&&!owner.constructor.assertions.length&&owner.fields.every(field=>field.final&&!field.initializer&&!field.late)&&owner.constructor.parameters.every(parameter=>parameter.field)&&!owner.constructor.initializers?.some(i=>i.kind==='field')&&!mutatesStorage(constructor.initializers)){
      // Preserve the existing compact route only when delegating cannot execute
      // another initializer/body/assertion or change captured formal values.
      const values=new Map<string,ts.Expression>(),statements:ts.Statement[]=[...parameterChecks(constructor.parameters)];
      for(const parameter of constructor.parameters)if(parameter.field){if(values.has(parameter.field.id))blocked('Duplicate field initialization',constructor);values.set(parameter.field.id,f.createIdentifier(parameter.name));}
      let index=0;for(const initializer of constructor.initializers){if(initializer.kind==='assert'){statements.push(statement(initializer));continue;}const field=owner.fields.find(field=>field.reference.id===initializer.field.id);if(!field||values.has(field.reference.id))blocked('Unresolved/duplicate named constructor field',constructor);const temporary='_initialField'+index++;statements.push(valueDoc(f.createVariableStatement(undefined,f.createVariableDeclarationList([f.createVariableDeclaration(temporary,undefined,undefined,expr(initializer.value))],ts.NodeFlags.Const)),initializer.value.numeric));values.set(field!.reference.id,f.createIdentifier(temporary));}
      if(values.size!==owner.fields.length||owner.fields.some(field=>!values.has(field.reference.id)))blocked('Every named constructor field must be initialized exactly once',constructor);
      const positional=owner.constructor.parameters.filter(parameter=>!parameter.named),named=owner.constructor.parameters.filter(parameter=>parameter.named);
      const args=[...positional.map(parameter=>values.get(parameter.field!.id)!),...(named.length?[f.createObjectLiteralExpression(named.map(parameter=>f.createPropertyAssignment(parameter.name,values.get(parameter.field!.id)!)))]:[])];
      statements.push(f.createReturnStatement(f.createNewExpression(f.createIdentifier(name(owner.name)),undefined,args)));body=f.createBlock(statements,true);
    }
    else{
      if(owner.superclass&&(!constructor.superclass||constructor.superclass.constructor.id!==owner.superclass.constructor.id))blocked('Named constructor requires the same resolved superclass constructor entry',constructor);
      const helper=temporary(),entry:Declaration&{kind:'class'}={...owner,name:helper.text,abstract:true,namedOnly:false,fields:owner.fields.filter(field=>!field.static),methods:[],namedConstructors:[],superclass:constructor.superclass??null,constructor:{parameters:constructor.parameters,assertions:constructor.initializers.filter((i):i is Statement&{kind:'assert'}=>i.kind==='assert'),initializers:constructor.initializers,reference:constructor.reference,body:constructor.body,const:constructor.const,offset:constructor.offset,length:constructor.length,...constructor.prelude?{prelude:constructor.prelude}:{}}};
      // Reuse the admitted initialization sequence, but allocate through the
      // actual base constructor with the source owner as newTarget. A synthetic
      // subclass would trigger Babel's classCallCheck against another prototype.
      if(owner.abstract)blocked('Named construction requires a concrete source owner',constructor);
      const reifiedEntry=Boolean(owner.typeParameters.length||owner.superclass?.type.kind==='interface'&&owner.superclass.type.arguments.length);
      const witnessOwner=witnessClasses.has(owner.reference.id)?temporary():undefined,previousOwner=constructorOwnerTokens.get(owner.reference.id);
      let lowered:ts.ClassDeclaration;
      try{if(witnessOwner)constructorOwnerTokens.set(owner.reference.id,witnessOwner);for(const parameter of owner.typeParameters)methodTypeParameters.delete(parameter.reference.id);lowered=classDeclaration(entry,true).find(ts.isClassDeclaration)!;}
      finally{for(const parameter of owner.typeParameters)methodTypeParameters.add(parameter.reference.id);if(previousOwner)constructorOwnerTokens.set(owner.reference.id,previousOwner);else constructorOwnerTokens.delete(owner.reference.id);}
      const ctor=lowered.members.find(ts.isConstructorDeclaration)!,instance=temporary();
      const ownFields=f.createTypeLiteralNode(entry.fields.map(field=>f.createPropertySignature(undefined,fieldBackingNames.get(field.reference.id)??memberName(field.name,field.reference),undefined,resolvedType(field.type))));
      const baseTarget=lowered.heritageClauses?.find(c=>c.token===ts.SyntaxKind.ExtendsKeyword)?.types[0]?.expression??f.createIdentifier('Object');
      if(!ts.isIdentifier(baseTarget))blocked('Named construction requires an exact base identifier',constructor);
      // Keep the mutable construction view separate from private class storage,
      // while retaining public source methods used by constructor bodies.
      const ownerArguments=owner.typeParameters.map(parameter=>f.createTypeReferenceNode(typeParameters.get(parameter.reference.id)!)),ownerInstance=f.createTypeReferenceNode(name(owner.name),ownerArguments);
      const mutableFields=f.createIntersectionTypeNode([reifiedEntry?f.createTypeReferenceNode('Omit',[ownerInstance,f.createTypeOperatorNode(ts.SyntaxKind.KeyOfKeyword,ownFields)]):f.createTypeReferenceNode('InstanceType',[f.createTypeQueryNode(baseTarget as ts.Identifier)]),ownFields]);
      let allocationParameters:ts.TypeNode=f.createTypeReferenceNode('ConstructorParameters',[f.createTypeQueryNode(baseTarget as ts.Identifier)]);
      if(reifiedEntry){
        const parent=model.parent(entry),base=entry.superclass?.type;
        if(parent){
          if(base?.kind!=='interface'||base.arguments.length!==parent.typeParameters.length)blocked('Named generic base requires its exact resolved application',constructor);
          // Instantiate declared storage types after printing them: substituting
          // T with int in the IR would incorrectly turn its boxed carrier into a scalar.
          const replacements=new Map<string,ts.TypeNode>(),savedTypes=new Map(typeParameters),savedMethods=new Set(methodTypeParameters);
          try{
            parent.typeParameters.forEach((parameter,index)=>{const placeholder=temporary().text;typeParameters.set(parameter.reference.id,placeholder);methodTypeParameters.add(parameter.reference.id);replacements.set(placeholder,argumentType(base!.kind==='interface'?base.arguments[index]!:blocked('Missing base application',constructor)));});
            const applied=(type:ResolvedType):ts.TypeNode=>{const printed=resolvedType(type),result=ts.transform(printed,[context=>node=>{const visit:ts.Visitor=value=>ts.isTypeReferenceNode(value)&&ts.isIdentifier(value.typeName)&&replacements.has(value.typeName.text)?replacements.get(value.typeName.text)!:ts.visitEachChild(value,visit,context);return ts.visitNode(node,visit)as ts.TypeNode;}]);const value=result.transformed[0]!;result.dispose();return value;};
            const formals=parent.constructor.parameters,positional=formals.filter(parameter=>!parameter.named),named=formals.filter(parameter=>parameter.named),optional=()=>f.createToken(ts.SyntaxKind.QuestionToken);
            allocationParameters=f.createTupleTypeNode([...witnessClasses.has(parent.reference.id)?base.arguments.map((type,index)=>f.createNamedTupleMember(undefined,f.createIdentifier('witness'+index),undefined,f.createTypeReferenceNode(witnessBinding!.type,[argumentType(type)]))):[],...positional.map(parameter=>f.createNamedTupleMember(undefined,f.createIdentifier(parameter.name),parameter.required?undefined:optional(),applied(parameter.resolvedType))),...named.length?[f.createNamedTupleMember(undefined,f.createIdentifier('options'),named.some(parameter=>parameter.required)?undefined:optional(),f.createTypeLiteralNode(named.map(parameter=>f.createPropertySignature([f.createModifier(ts.SyntaxKind.ReadonlyKeyword)],parameter.name,parameter.required?undefined:optional(),applied(parameter.resolvedType)))))]:[]]);
          }finally{typeParameters.clear();for(const[id,value]of savedTypes)typeParameters.set(id,value);methodTypeParameters.clear();for(const id of savedMethods)methodTypeParameters.add(id);}
        }else if(base?.kind==='interface')allocationParameters=f.createTypeReferenceNode('ConstructorParameters',[f.createTypeQueryNode(baseTarget as ts.Identifier,base.arguments.map(argumentType))]);
        else allocationParameters=f.createTupleTypeNode([]);
      }
      const ownerToken=witnessOwner??(owner.namedOnly?temporary():f.createIdentifier(name(owner.name))),passOwner=owner.namedOnly||Boolean(witnessOwner);
      const allocate=(values:readonly ts.Expression[])=>f.createVariableStatement(undefined,f.createVariableDeclarationList([f.createVariableDeclaration(instance,undefined,mutableFields,f.createAsExpression(f.createCallExpression(f.createPropertyAccessExpression(f.createIdentifier('Reflect'),'construct'),undefined,[baseTarget,f.createSatisfiesExpression(f.createArrayLiteralExpression(values),allocationParameters),ownerToken]),mutableFields))],ts.NodeFlags.Const));
      let allocated=false;
      const initialized=ctor.body!.statements.map(node=>{if(ts.isExpressionStatement(node)&&ts.isCallExpression(node.expression)&&node.expression.expression.kind===ts.SyntaxKind.SuperKeyword){allocated=true;return allocate(node.expression.arguments);}return node;});
      if(!allocated)initialized.unshift(allocate([]));
      const sourceCapture=ctor.body!.statements.find((node):node is ts.ExpressionStatement=>ts.isExpressionStatement(node)&&ts.isCallExpression(node.expression)&&ts.isIdentifier(node.expression.expression)&&node.expression.expression.text===classWitnessBinding?.capture);
      const capturedType=sourceCapture&&ts.isCallExpression(sourceCapture.expression)?sourceCapture.expression.arguments[1]:undefined;
      if(reifiedEntry&&!capturedType)blocked('Generic named entry requires the exact captured source owner',constructor);
      // The captured witness proves the exact Reflect newTarget owner, including
      // private backing fields, without an unchecked double cast.
      const finishedInstance=()=>reifiedEntry?f.createCallExpression(f.createIdentifier(witnessBinding!.cast),[ownerInstance],[instance,capturedType!]):f.createAsExpression(instance,ownerInstance);
      const rewritten=ts.transform(f.createBlock([...initialized,f.createReturnStatement(finishedInstance())],true),[context=>node=>{let functionDepth=0;const visit:ts.Visitor=value=>{
        if(value.kind===ts.SyntaxKind.SuperKeyword)blocked('Named constructor lexical super member access requires a further body dispatch contract',constructor);
        if(value.kind===ts.SyntaxKind.ThisKeyword)return instance;
        // A source constructor's early return still returns its initialized
        // object. Returns inside nested closures keep their own callable scope.
        if(ts.isReturnStatement(value)&&!value.expression&&functionDepth===0)return f.createReturnStatement(finishedInstance());
        const callable=ts.isFunctionLike(value);if(callable)functionDepth++;
        try{return ts.visitEachChild(value,visit,context);}finally{if(callable)functionDepth--;}
      };return ts.visitNode(node,visit) as ts.Block;}]);
      const parameters=passOwner?[f.createParameterDeclaration(undefined,undefined,ownerToken,undefined,f.createTypeQueryNode(f.createIdentifier(name(owner.name)))),...ctor.parameters]:ctor.parameters;
      constructorHelpers.push(f.createFunctionDeclaration(undefined,undefined,helper,generics,parameters,ownerInstance,rewritten.transformed[0]!));rewritten.dispose();
      const positional=constructor.parameters.filter(parameter=>!parameter.named),named=constructor.parameters.filter(parameter=>parameter.named),arguments_=[...positional.map(parameter=>f.createIdentifier(parameter.name)),...(named.length?[f.createObjectLiteralExpression(named.map(parameter=>f.createShorthandPropertyAssignment(parameter.name)))]:[])];
      body=f.createBlock([f.createReturnStatement(f.createCallExpression(helper,ownerArguments.length?ownerArguments:undefined,passOwner?[f.createIdentifier(name(owner.name)),...witnessParameters.map(parameter=>parameter.name as ts.Identifier),...arguments_]:arguments_))],true);
    }
    return callableDoc(f.createMethodDeclaration([f.createModifier(ts.SyntaxKind.StaticKeyword)],undefined,memberName(constructor.name,constructor.reference),undefined,generics,[...witnessParameters,...fieldFormals(constructor.parameters)],f.createTypeReferenceNode(name(owner.name),owner.typeParameters.map(p=>f.createTypeReferenceNode(typeParameters.get(p.reference.id)!))),body),constructor.parameters);
    }finally{methodTypeParameters.clear();for(const id of previousMethodTypes)methodTypeParameters.add(id);typeWitnesses.clear();for(const[id,value]of previousWitnesses)typeWitnesses.set(id,value);}
  }
  function enumDeclaration(n:Declaration&{kind:'enum'}):ts.Statement[]{
    if(n.fields?.some(field=>!field.static||!field.final||!field.initializer||field.lazyStatic||field.late))blocked('Enhanced enum fields require explicit static const initializers',n);
    if(!n.values.length||n.values.some((v,index)=>v.index!==index||!v.reference.static||v.reference.owner!==n.name||['constructor','prototype','values'].includes(memberName(v.name,v.reference))))blocked('Unsupported enum value identity or JavaScript static member collision',n);
    if(n.indexType.kind!=='interface'||n.indexType.reference.id!=='dart:core::int:CLASS'||n.indexType.nullable||n.indexType.arguments.length||!n.numericIndex)blocked('Enum index requires resolved Dart int provenance',n);
    let base:string|undefined;
    if(n.mixins?.length){const mixin=n.mixins[0];if(n.mixins.length!==1||mixin?.kind!=='interface'||mixin.nullable||mixin.arguments.length||!model.sourceMixins.has(mixin.reference.id))blocked('Enum mixin requires one generated stateless monomorphic body',n);const owner=model.classes.get((mixin as ResolvedType&{kind:'interface'}).reference.id)!;model.assertSafeBase(owner,recipe.values);base=name(owner.name);}
    const extra=model.sourceEnums.has(n.reference.id)?classDeclaration(model.classes.get(n.reference.id)!):[],extraClass=extra.find(ts.isClassDeclaration),extraMembers=extraClass?.members.filter(member=>!ts.isConstructorDeclaration(member))??[];
    const reserved=new Set(['index','name','values','toString',...n.values.map(v=>memberName(v.name,v.reference))]);
    if(extraMembers.some(member=>member.name&&ts.isIdentifier(member.name)&&reserved.has(member.name.text)))blocked('Enhanced enum member collides with its immutable value API',n);
    const className=name(n.name),token=temporary(),brand=temporary(),type=f.createTypeReferenceNode(className),readonly=[f.createModifier(ts.SyntaxKind.ReadonlyKeyword)],staticReadonly=[f.createModifier(ts.SyntaxKind.StaticKeyword),...readonly];
    const freeze=(value:ts.Expression)=>f.createCallExpression(dotted('Object.freeze'),undefined,[value]);
    const ctor=f.createConstructorDeclaration([f.createModifier(ts.SyntaxKind.PrivateKeyword)],[f.createParameterDeclaration(readonly,undefined,'index',undefined,resolvedType(n.indexType)),f.createParameterDeclaration(readonly,undefined,'name',undefined,f.createKeywordTypeNode(ts.SyntaxKind.StringKeyword)),f.createParameterDeclaration(undefined,undefined,'token',undefined,f.createTypeQueryNode(token))],f.createBlock([
      f.createIfStatement(f.createBinaryExpression(f.createIdentifier('token'),ts.SyntaxKind.ExclamationEqualsEqualsToken,token),f.createThrowStatement(f.createNewExpression(f.createIdentifier('TypeError'),undefined,[f.createStringLiteral('Enum values cannot be constructed')]))),f.createExpressionStatement(freeze(f.createThis())),
    ],true));
    const members:ts.ClassElement[]=[f.createPropertyDeclaration([f.createModifier(ts.SyntaxKind.PrivateKeyword),...readonly],brand,f.createToken(ts.SyntaxKind.ExclamationToken),f.createKeywordTypeNode(ts.SyntaxKind.VoidKeyword),undefined),documented(ctor,numericTags('@dartParam index',n.numericIndex)),...n.values.map(v=>f.createPropertyDeclaration(staticReadonly,memberName(v.name,v.reference),undefined,type,f.createNewExpression(f.createIdentifier(className),undefined,[f.createNumericLiteral(v.index),f.createStringLiteral(v.name),token]))),f.createPropertyDeclaration(staticReadonly,'values',undefined,f.createTypeReferenceNode('ReadonlyArray',[type]),freeze(f.createArrayLiteralExpression(n.values.map(v=>f.createPropertyAccessExpression(f.createIdentifier(className),memberName(v.name,v.reference)))))),f.createMethodDeclaration(undefined,undefined,'toString',undefined,undefined,[],f.createKeywordTypeNode(ts.SyntaxKind.StringKeyword),f.createBlock([f.createReturnStatement(f.createBinaryExpression(f.createStringLiteral(n.name+'.'),ts.SyntaxKind.PlusToken,f.createPropertyAccessExpression(f.createThis(),'name')))],true))];
    // Property provenance survives declaration emit independently of ctor params.
    members.splice(0,0,valueDoc(f.createPropertyDeclaration(readonly,'index',undefined,resolvedType(n.indexType),undefined),n.numericIndex));
    // A declared property above owns the annotation; the ctor parameter only assigns it.
    const parameters=ctor.parameters.map((p,index)=>index===0?f.updateParameterDeclaration(p,undefined,p.dotDotDotToken,p.name,p.questionToken,p.type,p.initializer):p);
    const body=f.updateBlock(ctor.body!,[...ctor.body!.statements.slice(0,1),...base?[f.createExpressionStatement(f.createCallExpression(f.createSuper(),undefined,[]))]:[],f.createExpressionStatement(f.createAssignment(f.createPropertyAccessExpression(f.createThis(),'index'),f.createIdentifier('index'))),...ctor.body!.statements.slice(1)]);
    members[members.indexOf(ctor)]=f.updateConstructorDeclaration(ctor,ctor.modifiers,parameters,body);
    return[f.createVariableStatement(undefined,f.createVariableDeclarationList([f.createVariableDeclaration(token,undefined,undefined,f.createCallExpression(f.createIdentifier('Symbol'),undefined,[]))],ts.NodeFlags.Const)),f.createClassDeclaration(exported,className,undefined,base?[f.createHeritageClause(ts.SyntaxKind.ExtendsKeyword,[f.createExpressionWithTypeArguments(f.createIdentifier(base),undefined)])]:undefined,[...members,...extraMembers]),...extra.filter(statement=>!ts.isClassDeclaration(statement)),f.createExpressionStatement(freeze(f.createPropertyAccessExpression(f.createIdentifier(className),'prototype'))),f.createExpressionStatement(freeze(f.createIdentifier(className)))];
  }
  const statements:ts.Statement[]=[...Object.entries(recipe.imports??{}).map(([symbol,module])=>f.createImportDeclaration(undefined,f.createImportClause(false,undefined,f.createNamedImports([f.createImportSpecifier(false,undefined,f.createIdentifier(symbol))])),f.createStringLiteral(module))),...Object.entries(recipe.typeImports??{}).map(([symbol,module])=>f.createImportDeclaration(undefined,f.createImportClause(true,undefined,f.createNamedImports([f.createImportSpecifier(false,undefined,f.createIdentifier(symbol))])),f.createStringLiteral(module)))];
  function genericStandalone<R>(n:Declaration&{kind:'function'|'method'},emit:(generics:ts.TypeParameterDeclaration[],params:ts.ParameterDeclaration[])=>R):R{
    const selected=n.typeParameters??[];
    if(!selected.length||!n.reference||!witnessBinding||!witnessMethods.has(n.reference.id))blocked('Generic standalone callable requires an exact selected runtime witness ABI',n);
    const priorTypes=new Map(typeParameters),priorMethods=new Set(methodTypeParameters),priorWitnesses=new Map(typeWitnesses),priorClass=currentClass,priorStatic=staticContext;
    try{
      currentClass=null;staticContext=n.kind==='method';
      if(new Set(selected.map(parameter=>parameter.reference.id)).size!==selected.length)blocked('Generic standalone callable has duplicate parameter identities',n);
      for(const parameter of selected){typeParameters.set(parameter.reference.id,parameter.name);methodTypeParameters.add(parameter.reference.id);}
      const generics=selected.map(parameter=>f.createTypeParameterDeclaration(undefined,parameter.name,parameter.bound?argumentType(parameter.bound):recipe.implicitTypeParameterBound==='dart-object-nullable'?f.createUnionTypeNode([f.createTypeLiteralNode([]),f.createLiteralTypeNode(f.createNull())]):undefined));
      const witnesses=selected.map(parameter=>{const token=temporary();typeWitnesses.set(parameter.reference.id,token);return f.createParameterDeclaration(undefined,undefined,token,undefined,f.createTypeReferenceNode(witnessBinding!.type,[f.createTypeReferenceNode(parameter.name)]));});
      return emit(generics,[...witnesses,...parameters(n.parameters)]);
    }finally{typeParameters.clear();for(const[id,value]of priorTypes)typeParameters.set(id,value);methodTypeParameters.clear();for(const id of priorMethods)methodTypeParameters.add(id);typeWitnesses.clear();for(const[id,value]of priorWitnesses)typeWitnesses.set(id,value);currentClass=priorClass;staticContext=priorStatic;}
  }
  const classes=new Map<string,ts.ClassElement[]>();
  function aliasDeclaration(n:Declaration&{kind:'typeAlias'}):ts.TypeAliasDeclaration{
    const priorTypes=new Map(typeParameters),priorClass=currentClass,priorStatic=staticContext;
    try{
      currentClass=null;staticContext=false;
      if(new Set(n.typeParameters.map(p=>p.reference.id)).size!==n.typeParameters.length||new Set(n.typeParameters.map(p=>p.name)).size!==n.typeParameters.length)blocked('Source alias has duplicate type parameter identities/names',n);
      if(n.typeParameters.some(p=>!p.bound)&&recipe.implicitTypeParameterBound!=='dart-object-nullable')blocked('Source alias implicit bounds require the reviewed Dart Object? policy',n);
      for(const parameter of n.typeParameters)typeParameters.set(parameter.reference.id,parameter.name);
      const generics=n.typeParameters.map(parameter=>f.createTypeParameterDeclaration(undefined,parameter.name,parameter.bound?argumentType(parameter.bound):recipe.implicitTypeParameterBound==='dart-object-nullable'?f.createUnionTypeNode([f.createTypeLiteralNode([]),f.createLiteralTypeNode(f.createNull())]):undefined));
      const metadata=new Map<string,NumericSource>();
      const paths=new Map<string,ResolvedType>();
      function shape(value:ResolvedType,path:(string|number)[]):void{paths.set(JSON.stringify(path),value);if(value.kind==='function'){shape(value.returnType,[...path,'return']);value.parameters.forEach((p,index)=>shape(p.type,[...path,'parameter',index]));}else if(value.kind==='record')value.fields.forEach((field,index)=>shape(field,[...path,'positional',index]));else if(value.kind==='namedRecord'){value.positional.forEach((field,index)=>shape(field,[...path,'positional',index]));value.named.forEach(field=>shape(field.type,[...path,'named',field.name]));}else if(value.kind==='interface')value.arguments.forEach((argument,index)=>shape(argument,[...path,'argument',index]));}
      shape(n.aliasedType,[]);
      const normalized=(value:ResolvedType)=>JSON.stringify(value,(key,value)=>key==='alias'?undefined:value);
      for(const member of n.numericMembers){const key=JSON.stringify(member.path),value=paths.get(key);if(metadata.has(key)||!member.numeric.resolvedType||!value||normalized(member.numeric.resolvedType)!==normalized(value))blocked('Source alias numeric members require unique exact resolved paths',n);metadata.set(key,member.numeric);}
      function numericShape(value:ResolvedType,seen=new Set<string>()):boolean{if(value.kind==='parameter'){if(seen.has(value.reference.id))return false;seen.add(value.reference.id);const bound=n.typeParameters.find(p=>p.reference.id===value.reference.id)?.bound;return Boolean(bound&&numericShape(bound,seen));}if(value.kind==='interface')return ['dart:core::int:CLASS','dart:core::double:CLASS','dart:core::num:CLASS','dart:core::BigInt:CLASS'].includes(value.reference.id)||value.arguments.some(argument=>numericShape(argument,new Set(seen)));if(value.kind==='function')return [value.returnType,...value.parameters.map(p=>p.type)].some(type=>numericShape(type,new Set(seen)));if(value.kind==='record')return value.fields.some(type=>numericShape(type,new Set(seen)));if(value.kind==='namedRecord')return [...value.positional,...value.named.map(field=>field.type)].some(type=>numericShape(type,new Set(seen)));return false;}
      for(const [path,value] of paths)if(numericShape(value)!==metadata.has(path))blocked('Source alias numeric metadata must cover exactly its analyzer-resolved numeric members: '+path,n);
      if(n.numeric&&!metadata.has('[]'))blocked('Source alias numeric provenance is missing its resolved root',n);
      const numeric=(path:(string|number)[])=>metadata.get(JSON.stringify(path));
      function printed(value:ResolvedType,path:(string|number)[]):ts.TypeNode{
        if(value.alias&&ownedAliases.has(value.alias.reference.id))return resolvedType(value);
        let result:ts.TypeNode;
        if(value.kind==='function'){
          if(value.typeParameters?.length)blocked('Generic function aliases require separate numeric-member metadata qualification',n);
          const positional=value.parameters.map((p,index)=>({p,index})).filter(({p})=>!p.named),named=value.parameters.map((p,index)=>({p,index})).filter(({p})=>p.named),names=new Set(positional.map(({p,index})=>p.name||'argument'+index));let options='options';while(names.has(options))options+='Named';
          const params=positional.map(({p,index})=>f.createParameterDeclaration(undefined,undefined,p.name||'argument'+index,p.required?undefined:f.createToken(ts.SyntaxKind.QuestionToken),printed(p.type,[...path,'parameter',index])));
          if(named.length)params.push(f.createParameterDeclaration(undefined,undefined,options,named.some(({p})=>p.required)?undefined:f.createToken(ts.SyntaxKind.QuestionToken),f.createTypeLiteralNode(named.map(({p,index})=>valueDoc(f.createPropertySignature(undefined,p.name,p.required?undefined:f.createToken(ts.SyntaxKind.QuestionToken),printed(p.type,[...path,'parameter',index])),numeric([...path,'parameter',index]))))));
          result=f.createFunctionTypeNode(undefined,params,printed(value.returnType,[...path,'return']));
        }else if(value.kind==='record')result=f.createTypeReferenceNode(recordBoundary().type,[f.createTupleTypeNode(value.fields.map((field,index)=>printedArgument(field,[...path,'positional',index])))]);
        else if(value.kind==='namedRecord'){
          if(!value.named.length||new Set(value.named.map(field=>field.name)).size!==value.named.length)blocked('Invalid source alias named record shape',n);
          result=f.createTypeReferenceNode(namedRecordBoundary().type,[f.createTupleTypeNode(value.positional.map((field,index)=>printedArgument(field,[...path,'positional',index]))),f.createTypeLiteralNode(value.named.map(field=>valueDoc(f.createPropertySignature([f.createModifier(ts.SyntaxKind.ReadonlyKeyword)],f.createStringLiteral(field.name),undefined,printedArgument(field.type,[...path,'named',field.name])),numeric([...path,'named',field.name]))))]);
        }else if(value.kind==='interface'&&value.arguments.length){
          const mapped=ownedTypes.get(value.reference.id)??recipe.typeBindings?.[value.reference.id];if(!mapped||!ownedTypes.has(value.reference.id)&&!importedTypes.has(mapped))blocked('Source alias interface requires an exact owning/imported binding: '+value.reference.id,n);
          result=f.createTypeReferenceNode(mapped,value.arguments.map((argument,index)=>printedArgument(argument,[...path,'argument',index])));
        }else return resolvedType(value);
        return value.nullable?f.createUnionTypeNode([result,f.createLiteralTypeNode(f.createNull())]):result;
      }
      function printedArgument(value:ResolvedType,path:(string|number)[]):ts.TypeNode{numeric(path);return numericKind(value)&&numericGenerics?argumentType(value):printed(value,path);}
      const type=printed(n.aliasedType,[]),tags=numericTags('@dartType',n.numeric);numeric([]);
      if(n.aliasedType.kind==='function'){tags.push(...n.aliasedType.parameters.flatMap((p,index)=>numericTags('@dartParam '+(p.name||'argument'+index),numeric(['parameter',index]))),...numericTags('@dartReturn',numeric(['return'])));}
      return documented(f.createTypeAliasDeclaration(exported,name(n.name),generics.length?generics:undefined,type),tags);
    }finally{typeParameters.clear();for(const[id,value]of priorTypes)typeParameters.set(id,value);currentClass=priorClass;staticContext=priorStatic;}
  }
  // Dart const references are lazy/resolved across source order. JavaScript
  // eager initialization needs a dependency order; cycles remain blocked.
  const constants=declarations.filter((d):d is Declaration&{kind:'constant'}=>d.kind==='constant'),ordered:Declaration[]=[],seen=new Set<Declaration>(),visiting=new Set<Declaration>();
  function references(value:unknown):Reference[]{if(Array.isArray(value))return value.flatMap(references);if(value&&typeof value==='object'){const n=value as Record<string,unknown>;return [...(n.reference?[n.reference as Reference]:[]),...Object.entries(n).filter(([k])=>k!=='reference').flatMap(([,v])=>references(v))];}return [];}
  function order(n:Declaration&{kind:'constant'}){if(seen.has(n))return;if(visiting.has(n))blocked('Const initialization cycle requires a lazy adapter: '+n.name);visiting.add(n);for(const ref of references(n.value))for(const next of constants)if(next.name===ref.name&&(next.owner??null)===ref.owner)order(next);visiting.delete(n);seen.add(n);ordered.push(n);}
  ordered.push(...enums);constants.forEach(order);ordered.push(...model.ordered.filter(n=>!model.sourceEnums.has(n.reference.id)),...declarations.filter(n=>n.kind!=='constant'&&n.kind!=='class'&&n.kind!=='enum'&&n.kind!=='mixin'));
  const ownedConstructorReference=(reference:Reference)=>model.ordered.some(owner=>owner.constructor.reference?.id===reference.id||owner.namedConstructors?.some(entry=>entry.reference.id===reference.id));
  const ownedConstantConstruction=constants.some(value=>references(value.value).some(ownedConstructorReference))||model.ordered.some(owner=>references(owner.fields.filter(field=>field.static&&!field.lazyStatic).map(field=>field.initializer)).some(ownedConstructorReference));
  if(model.sourceMixins.size||model.sourceEnums.size||mixinRegistries.size||ownedConstantConstruction){
    const scheduled:Declaration[]=[],done=new Set<Declaration>(),active=new Set<Declaration>();
    const schedule=(n:Declaration):void=>{if(done.has(n))return;if(active.has(n))blocked('Generated owner/constant initialization cycle requires a lazy boundary',n);active.add(n);
      const dependencies:Reference[]=n.kind==='constant'?references(n.value):n.kind==='class'||n.kind==='enum'?references((n.fields??[]).filter(field=>field.static&&!field.lazyStatic).map(field=>field.initializer)):[];
      if(n.kind==='class'){const parent=model.parent(n);if(parent)dependencies.push(parent.reference);if(n.sourceMixinApplication)dependencies.push(n.sourceMixinApplication.owner);}else if(n.kind==='enum')for(const mixin of n.mixins??[])if(mixin.kind==='interface')dependencies.push(mixin.reference);
      for(const reference of dependencies)for(const other of ordered){
        if(other===n||!other.reference||other.reference.id.split('::')[0]!==reference.id.split('::')[0])continue;
        const exact=other.reference.id===reference.id,owner=(other.kind==='class'||other.kind==='enum')&&other.name===reference.owner,constant=other.kind==='constant'&&other.name===reference.name&&(other.owner??null)===reference.owner;
        if(exact||owner||constant)schedule(other);
      }
      active.delete(n);done.add(n);scheduled.push(n);
    };ordered.forEach(schedule);ordered.splice(0,ordered.length,...scheduled);
  }
  for(const n of ordered){
    if(n.kind==='class'){statements.push(...classDeclaration(n),...constructorHelpers.splice(0));if(n.sourceMixinApplication)statements.push(f.createExpressionStatement(f.createCallExpression(f.createPropertyAccessExpression(mixinRegistries.get(n.sourceMixinApplication.owner.id)!,'push'),undefined,[ownerValue(n)])));}
    else if(n.kind==='enum')statements.push(...enumDeclaration(n));
    else if(n.kind==='mixinInterface')statements.push(mixinInterface(n));
    else if(n.kind==='typeAlias')statements.push(aliasDeclaration(n));
    else if(n.kind==='function'){const create=(generics:ts.TypeParameterDeclaration[]|undefined,params:ts.ParameterDeclaration[])=>callableDoc(f.createFunctionDeclaration([...exported,...asyncModifiers(n.body,n.resolvedReturnType)],undefined,name(n.name),generics,params,n.resolvedReturnType?.kind==='function'?resolvedType(n.resolvedReturnType):sourceType(n.returnType,n.numericReturn,n.resolvedReturnType),callableBody(n.body,n.parameters,n.resolvedReturnType)),n.parameters,n.numericReturn);statements.push(n.typeParameters?.length?genericStandalone(n,create):create(undefined,parameters(n.parameters)));}
    else if(n.kind==='method'){const owner=classNames[n.owner!];if(!owner)blocked('Class ownership must be mapped');const members=classes.get(owner!)??[],create=(generics:ts.TypeParameterDeclaration[]|undefined,params:ts.ParameterDeclaration[])=>callableDoc(f.createMethodDeclaration([f.createModifier(ts.SyntaxKind.StaticKeyword)],undefined,n.reference?memberName(n.name,n.reference):name(n.name),undefined,generics,params,n.resolvedReturnType?.kind==='function'?resolvedType(n.resolvedReturnType):sourceType(n.returnType,n.numericReturn,n.resolvedReturnType),callableBody(n.body,n.parameters,n.resolvedReturnType)),n.parameters,n.numericReturn);members.push(n.typeParameters?.length?genericStandalone(n,create):create(undefined,parameters(n.parameters)));classes.set(owner!,members);}
    else if(n.kind==='constant'&&n.owner){const owner=classNames[n.owner];if(!owner)blocked('Static field owner must be mapped');const members=classes.get(owner!)??[];members.push(valueDoc(f.createPropertyDeclaration([f.createModifier(ts.SyntaxKind.StaticKeyword),f.createModifier(ts.SyntaxKind.ReadonlyKeyword)],n.reference?memberName(n.name,n.reference):name(n.name),undefined,sourceType(n.type,n.numeric,n.resolvedType),expr(n.value)),n.numeric));classes.set(owner!,members);}
    else if(n.kind==='constant')statements.push(valueDoc(f.createVariableStatement(exported,f.createVariableDeclarationList([f.createVariableDeclaration(name(n.name),undefined,sourceType(n.type,n.numeric,n.resolvedType),expr(n.value))],ts.NodeFlags.Const)),n.numeric));
  }
  for(const [className,members]of classes)statements.push(f.createClassDeclaration(exported,className,undefined,undefined,[f.createConstructorDeclaration([f.createModifier(ts.SyntaxKind.ProtectedKeyword)],[],f.createBlock([])),...members]));
  if(topGetters.length){
    const accessors=topGetters.map(value=>{if(value.body.async)blocked('Async source getter requires a separate callable representation',value);return callableDoc(f.createGetAccessorDeclaration(undefined,memberName(value.name,value.reference),[],resolvedType(value.resolvedReturnType),callableBody(value.body,[],value.resolvedReturnType)),[],value.numericReturn);});
    statements.push(f.createVariableStatement(undefined,f.createVariableDeclarationList([f.createVariableDeclaration(getterNamespace!,undefined,undefined,f.createCallExpression(dotted('Object.freeze'),undefined,[f.createObjectLiteralExpression(accessors,true)]))],ts.NodeFlags.Const)),f.createExportDeclaration(undefined,false,f.createNamedExports([f.createExportSpecifier(false,getterNamespace!,f.createIdentifier(recipe.topLevelGetters!.namespace))])));
  }
  if(recipe.importEmission){
    const policy=recipe.importEmission;
    if(policy.policy!=='used-identifiers')blocked('Unreviewed import emission policy');
    const sideEffects=policy.sideEffects??[];
    if(sideEffects.some(module=>typeof module!=='string'||module.length===0)||new Set(sideEffects).size!==sideEffects.length)blocked('Invalid explicit initialization imports');
    const used=new Set<string>();
    const collect=(node:ts.Node):void=>{if(ts.isImportDeclaration(node))return;if(ts.isIdentifier(node))used.add(node.text);ts.forEachChild(node,collect);};
    statements.forEach(collect);
    for(const input of manualDeclarations)collect(ts.createSourceFile(input.file,input.source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TS));
    const runtimeModules=new Set<string>();
    const retained=statements.filter(statement=>{
      if(!ts.isImportDeclaration(statement))return true;
      const clause=statement.importClause,binding=clause?.namedBindings;
      if(!binding||!ts.isNamedImports(binding)||binding.elements.length!==1)blocked('Unexpected generated import shape');
      if(!used.has(binding.elements[0]!.name.text))return false;
      if(!clause!.isTypeOnly)runtimeModules.add((statement.moduleSpecifier as ts.StringLiteral).text);
      return true;
    });
    const initialization=sideEffects.filter(module=>!runtimeModules.has(module)).map(module=>f.createImportDeclaration(undefined,undefined,f.createStringLiteral(module)));
    const firstBody=retained.findIndex(statement=>!ts.isImportDeclaration(statement));
    retained.splice(firstBody<0?retained.length:firstBody,0,...initialization);
    statements.splice(0,statements.length,...retained);
  }
  const source=f.createSourceFile(statements,f.createToken(ts.SyntaxKind.EndOfFileToken),ts.NodeFlags.None);
  return '// SPDX-License-Identifier: BSD-3-Clause\n// Copyright 2014 The Flutter Authors. All rights reserved.\n// Generated from '+recipe.source+'; SHA256 '+recipe.sha256+'\n'+ts.createPrinter({newLine:ts.NewLineKind.LineFeed}).printFile(source)+manualDeclarations.map(input=>'\n// Composed manual declarations: '+input.file+'\n'+input.source.replaceAll('\r\n','\n').trimEnd()+'\n').join('');
}
