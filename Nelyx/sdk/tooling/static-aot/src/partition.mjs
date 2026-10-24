// SPDX-License-Identifier: BSD-3-Clause
import ts from 'typescript';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {buildSourceGraph} from './source-graph.mjs';
const hash=value=>createHash('sha256').update(value).digest('hex');
const arithmetic=new Set(['+','-','*','/','%','**']);
const comparisons=new Set(['<','<=','>','>=','===','!==']);
const assignments=new Set(['=','+=','-=','*=','/=']);

/** Checked numeric control flow. Objects, receivers and lexical bindings remain
 * dynamic in the original module; this frontend never manufactures a class. */
export function lowerPartition(options,selections){
  return lowerSourcePartition(buildSourceGraph(options),selections);
}

/** Reuse one checker graph for automatic eligibility and final emission. */
export function lowerSourcePartition({graph,program,checker,owners},selections){
  if(!Array.isArray(selections)||selections.length>4096)throw Error('Select at most 4096 typed bodies');
  if(graph.diagnostics.some(item=>item.category==='Error'))throw Error('Typed source graph has errors: '+JSON.stringify(graph.diagnostics));
  const functions=[],bindings=[],segments=[],seen=new Set();let generated='';
  const append=(text,fn,node)=>{if(node)segments.push({generatedOffset:generated.length,generatedLength:text.length,module:fn.module,...node.position});generated+=text;};
  for(const selection of selections){
    const module=graph.modules.find(module=>module.id===selection.module);
    if(!module)throw Error('Selected body is outside the source graph: '+selection.module);
    if(module.evaluationRoutes.length>1)throw Error('Selected body has multiple evaluation identities: '+selection.module);
    const owner=owners.find(owner=>owner.name===module.owner),relative=module.id.slice(module.owner.length+1);
    const file=path.join(owner.root,relative),source=program.getSourceFile(file);
    if(!source)throw Error('Selected implementation unavailable: '+file);
    const position=node=>{const offset=node.getStart(source),at=source.getLineAndCharacterOfPosition(offset);return {sourceOffset:offset,line:at.line+1,column:at.character+1};};
    const fail=(node,reason)=>{const at=position(node),error=Error(`${file}:${at.line}:${at.column}: static-aot: ${reason}`);error.code='NELYX_TYPED_UNSUPPORTED';throw error;};
    let declaration;
    for(const node of source.statements){
      if(!selection.className&&ts.isFunctionDeclaration(node)&&node.name?.text===selection.name)declaration=node;
      if(selection.className&&ts.isClassDeclaration(node)&&node.name?.text===selection.className)declaration=node.members.find(member=>ts.isMethodDeclaration(member)&&ts.isIdentifier(member.name)&&member.name.text===selection.name);
    }
    if(!declaration?.body)throw Error('Selected body unavailable: '+selection.name);
    const id=module.id+'#'+(selection.className?selection.className+'.':'')+selection.name;
    if(seen.has(id))fail(declaration,'Duplicate partition symbol');seen.add(id);
    if(declaration.typeParameters?.length||declaration.asteriskToken||declaration.modifiers?.some(node=>[ts.SyntaxKind.AsyncKeyword,ts.SyntaxKind.StaticKeyword].includes(node.kind)))fail(declaration,'Generic, generator, async and static methods require another lowering');
    const locals=new Map(),parameters=[],externals=[],externalSymbols=new Map();let receiver=false;
    const valueType=node=>{const type=checker.getTypeAtLocation(node);return type.flags&(ts.TypeFlags.Number|ts.TypeFlags.NumberLiteral)?'number':type.flags&ts.TypeFlags.BooleanLike?'boolean':'dynamic';};
    const declare=node=>{
      if(!ts.isIdentifier(node.name)||node.questionToken||node.dotDotDotToken)fail(node,'Required identifier bindings only');
      const type=valueType(node);if(!['number','boolean'].includes(type))fail(node,'Local bindings must have scalar contracts');
      const symbol=checker.getSymbolAtLocation(node.name),name='v'+locals.size;locals.set(symbol,{name,type});return {name,type,originalName:node.name.text,position:position(node)};
    };
    for(const parameter of declaration.parameters){if(parameter.initializer)fail(parameter,'Default parameters remain in the original module');parameters.push(declare(parameter));}
    const signature=checker.getSignatureFromDeclaration(declaration);
    if(!signature||!(checker.getReturnTypeOfSignature(signature).flags&ts.TypeFlags.Number))fail(declaration,'Only number-returning bodies are selected');
    // Register locals before references, retaining lexical identity through the checker.
    const collect=node=>{if(ts.isVariableDeclaration(node))declare(node);if(node!==declaration.body&&(ts.isFunctionLike(node)||ts.isClassLike(node)))fail(node,'Nested functions/classes need a separate identity closure');ts.forEachChild(node,collect);};collect(declaration.body);
    const ir=(kind,node,fields={})=>({kind,type:valueType(node),position:position(node),...fields});
    const expression=node=>{
      if(ts.isParenthesizedExpression(node)||ts.isNonNullExpression(node))return expression(node.expression);
      if(ts.isNumericLiteral(node))return ir('literal',node,{text:node.getText(source)});
      if(ts.isStringLiteral(node))return ir('literal',node,{text:JSON.stringify(node.text)});
      if(node.kind===ts.SyntaxKind.TrueKeyword||node.kind===ts.SyntaxKind.FalseKeyword)return ir('literal',node,{text:node.getText(source)});
      if(node.kind===ts.SyntaxKind.ThisKeyword){if(!selection.className)fail(node,'Free function this is not admitted');receiver=true;return ir('receiver',node);}
      if(ts.isIdentifier(node)){
        const symbol=checker.getSymbolAtLocation(node),local=locals.get(symbol);
        if(local)return ir('local',node,local);
        if(!symbol)fail(node,'Unresolved captured symbol');
        if(['arguments','eval','require'].includes(node.text))fail(node,'Special lexical arguments/eval/require cannot be moved into an environment function');
        let index=externalSymbols.get(symbol);if(index===undefined){index=externals.length;externalSymbols.set(symbol,index);externals.push({name:node.text,type:checker.typeToString(checker.getTypeAtLocation(node)),position:position(node)});}
        return ir('external',node,{index});
      }
      if(ts.isPropertyAccessExpression(node)&&!node.questionDotToken&&!ts.isPrivateIdentifier(node.name))return ir('property',node,{object:expression(node.expression),name:node.name.text});
      if(ts.isCallExpression(node)&&!node.questionDotToken&&!node.typeArguments?.length&&!node.arguments.some(ts.isSpreadElement))return ir('call',node,{callee:expression(node.expression),arguments:node.arguments.map(expression)});
      if(ts.isNewExpression(node)&&!node.typeArguments?.length)return ir('new',node,{callee:expression(node.expression),arguments:(node.arguments??[]).map(expression)});
      if(ts.isBinaryExpression(node)){
        const operator=node.operatorToken.getText(source);
        if(!arithmetic.has(operator)&&!comparisons.has(operator)&&!assignments.has(operator)&&!['&&','||'].includes(operator))fail(node,'Unsupported binary operation '+operator);
        if(assignments.has(operator)&&(!ts.isIdentifier(node.left)||!locals.has(checker.getSymbolAtLocation(node.left))))fail(node,'Only local scalar assignments are admitted');
        if(assignments.has(operator)&&valueType(node.left)!==valueType(node.right))fail(node,'Assignments require matching scalar contracts; dynamic any values remain excluded');
        if(arithmetic.has(operator)&&(valueType(node.left)!=='number'||valueType(node.right)!=='number'))fail(node,'Arithmetic requires number contracts on both operands');
        return ir('binary',node,{operator,left:expression(node.left),right:expression(node.right)});
      }
      if(ts.isPrefixUnaryExpression(node)&&[ts.SyntaxKind.PlusToken,ts.SyntaxKind.MinusToken,ts.SyntaxKind.ExclamationToken].includes(node.operator))return ir('unary',node,{operator:ts.tokenToString(node.operator),operand:expression(node.operand)});
      if(ts.isPostfixUnaryExpression(node)&&ts.isIdentifier(node.operand)&&locals.has(checker.getSymbolAtLocation(node.operand)))return ir('postfix',node,{operator:ts.tokenToString(node.operator),operand:expression(node.operand)});
      fail(node,'Unsupported expression '+ts.SyntaxKind[node.kind]);
    };
    const variables=list=>({kind:'variables',constant:!!(list.flags&ts.NodeFlags.Const),declarations:list.declarations.map(node=>{if(!node.initializer)fail(node,'Scalar locals require initializers');return {...locals.get(checker.getSymbolAtLocation(node.name)),position:position(node),value:expression(node.initializer)};})});
    const statement=node=>{
      if(ts.isBlock(node))return {kind:'block',position:position(node),statements:node.statements.map(statement)};
      if(ts.isVariableStatement(node))return variables(node.declarationList);
      if(ts.isReturnStatement(node)&&node.expression){if(valueType(node.expression)!=='number')fail(node.expression,'Numeric returns require a number contract, without any widening');return {kind:'return',position:position(node),value:expression(node.expression)};}
      if(ts.isThrowStatement(node))return {kind:'throw',position:position(node),value:expression(node.expression)};
      if(ts.isIfStatement(node))return {kind:'if',position:position(node),test:expression(node.expression),then:statement(node.thenStatement),otherwise:node.elseStatement?statement(node.elseStatement):null};
      if(ts.isForStatement(node)&&node.initializer&&ts.isVariableDeclarationList(node.initializer)&&node.condition&&node.incrementor)return {kind:'for',position:position(node),initial:variables(node.initializer),test:expression(node.condition),increment:expression(node.incrementor),body:statement(node.statement)};
      if(ts.isBreakStatement(node)&&!node.label)return {kind:'break',position:position(node)};
      if(ts.isExpressionStatement(node))return {kind:'expression',position:position(node),value:expression(node.expression)};
      fail(node,'Unsupported statement '+ts.SyntaxKind[node.kind]);
    };
    const body=statement(declaration.body),index=functions.length,globalName='__nelyxTyped_'+hash(id).slice(0,16);
    const fn={id,module:module.id,name:selection.name,className:selection.className??null,sourceSha256:module.sourceSha256,receiver:receiver?'dynamic':'unused',parameters,externals,body,position:position(declaration)};functions.push(fn);
    const out=(text,node)=>append(text,fn,node);
    const emitExpression=(node,raw=false)=>{
      const checked=!raw&&['property','call','external'].includes(node.kind)&&node.type==='number';
      if(checked)out('checkedNumber(',node);
      if(node.kind==='literal')out(node.text,node);
      else if(node.kind==='local')out(node.name,node);
      else if(node.kind==='receiver')out('receiver',node);
      else if(node.kind==='external')out('environment('+node.index+')',node);
      else if(node.kind==='property'){out('(');emitExpression(node.object,true);out(').'+node.name,node);}
      else if(node.kind==='call'||node.kind==='new'){if(node.kind==='new')out('new ');out('(');emitExpression(node.callee,true);out(')(');node.arguments.forEach((arg,i)=>{if(i)out(',');emitExpression(arg);});out(')');}
      else if(node.kind==='binary'){out('(',node);emitExpression(node.left);out(node.operator);emitExpression(node.right);out(')');}
      else if(node.kind==='unary'){out('('+node.operator,node);emitExpression(node.operand);out(')');}
      else if(node.kind==='postfix'){out('(',node);emitExpression(node.operand);out(node.operator+')');}
      if(checked)out(')');
    };
    const emitVariables=node=>{out(node.constant?'const ':'let ');node.declarations.forEach((item,i)=>{if(i)out(',');out(item.name+':'+item.type+'=',item);emitExpression(item.value);});};
    const emitStatement=node=>{
      if(node.kind==='block'){out('{',node);node.statements.forEach(emitStatement);out('}');}
      else if(node.kind==='variables'){emitVariables(node);out(';');}
      else if(node.kind==='return'||node.kind==='throw'){out(node.kind+' ',node);emitExpression(node.value);out(';');}
      else if(node.kind==='expression'){emitExpression(node.value);out(';');}
      else if(node.kind==='break')out('break;',node);
      else if(node.kind==='if'){out('if(',node);emitExpression(node.test);out(')');emitStatement(node.then);if(node.otherwise){out('else ');emitStatement(node.otherwise);}}
      else if(node.kind==='for'){out('for(',node);emitVariables(node.initial);out(';');emitExpression(node.test);out(';');emitExpression(node.increment);out(')');emitStatement(node.body);}
    };
    const args=['receiver','environment',...parameters.map(p=>p.name)];
    out('function kernel'+index+'(receiver,environment'+parameters.map(p=>','+p.name+':'+p.type).join('')+'):number');emitStatement(body);out('\n');
    out('let calls'+index+':number=0;\nfunction boundary'+index+'('+args.join(',')+'):number{calls'+index+'++;return kernel'+index+'('+args.join(',')+');}\n');
    out('globalThis['+JSON.stringify(globalName)+']=boundary'+index+';\n');
    out('function count'+index+'():number{return calls'+index+';}\nglobalThis['+JSON.stringify(globalName+'_calls')+']=count'+index+';\n');
    // Each lexical read occurs at its original point, including reads after
    // user callbacks. Capturing Math or constructor values once would be wrong.
    const environment=externals.length?'function(i){'+externals.map((item,i)=>'if(i==='+i+')return '+item.name+';').join('')+'throw new Error("Unknown typed lexical binding");}':'null';
    bindings.push({id,globalName,module:module.id,file,sourceSha256:module.sourceSha256,runtime:module.runtime??null,runtimeSha256:module.runtimeSha256??null,name:selection.name,className:selection.className??null,adapter:'return globalThis['+JSON.stringify(globalName)+'](this,'+environment+parameters.map(p=>','+p.originalName).join('')+');'});
  }
  const prefix='(function(){\nfunction checkedNumber(value):number{return value;}\n';
  generated=prefix+generated+'})();\n';
  for(const segment of segments)segment.generatedOffset+=prefix.length;
  const ir={schema:'nelyx.typed-partition-ir/v1',graphSha256:graph.sha256,checkerSha256:graph.checkerSha256,functions};
  return {ir,irSha256:hash(JSON.stringify(ir)),source:generated,sourceSha256:hash(generated),segments,bindings,graph,qualification:'experimental'};
}
