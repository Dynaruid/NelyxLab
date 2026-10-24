// SPDX-License-Identifier: BSD-3-Clause
// Restricted reviewed numeric draft emitter, never an application/runtime dependency.
import 'dart:convert';
import 'dart:io';
import 'package:analyzer/dart/analysis/analysis_context_collection.dart';
import 'package:analyzer/dart/analysis/results.dart';
import 'package:analyzer/dart/ast/ast.dart';
import 'package:analyzer/dart/element/element.dart';
import 'package:crypto/crypto.dart';
import 'package:path/path.dart' as p;

const classes={'Vector2','Vector3','Vector4','Matrix2','Matrix3','Matrix4','Quaternion'};
const operators={'[]':'at','[]=':'setAt','==':'equals','+':'plus','-':'minus','*':'times','/':'divided'};
const stores={'_v2storage','_v3storage','_v4storage','_m2storage','_m3storage','_m4storage','_qStorage'};
const storeOwners={'_v2storage':'Vector2','_v3storage':'Vector3','_v4storage':'Vector4','_m2storage':'Matrix2','_m3storage':'Matrix3','_m4storage':'Matrix4','_qStorage':'Quaternion'};
String sha(String value)=>sha256.convert(utf8.encode(value)).toString();

class Draft {
  final String owner;
  final Set<String> instanceMembers,staticMembers;
  String? cascade;
  int serial=0;
  Draft(this.owner,this.instanceMembers,this.staticMembers);
  Never unsupported(AstNode n)=>throw UnsupportedError('${n.runtimeType}: ${n.toSource()}');
  String type(TypeAnnotation? t)=>typeText(t?.toSource()??'dynamic');
  String typeText(String raw){
    if(raw.endsWith('?'))return '${typeText(raw.substring(0,raw.length-1))}|null';
    return switch(raw){'double'||'num'||'int'=>'number','bool'=>'boolean','dynamic'||'Object'=>'unknown','String'=>'string','void'=>'void','Float64List'=>'Float64Array','ByteBuffer'=>'ArrayBufferLike','List<double>'||'List<num>'=>'number[]|Float64Array','math.Random'=>'NumericRandom',_=>raw};
  }
  String identifier(SimpleIdentifier n){
    final name=n.name,e=n.element;
    if(stores.contains(name))return 'this.values';
    if(e is LocalElement||e is FormalParameterElement)return name;
    if(name=='storage'&&instanceMembers.contains(name)){final dimension=owner=='Quaternion'?4:owner.startsWith('Matrix')?int.parse(owner[6])*int.parse(owner[6]):int.parse(owner[6]);return 'checkedNumericStorage(this.storage,$dimension)';}
    if(staticMembers.contains(name))return '$owner.$name';
    if(instanceMembers.contains(name))return 'this.$name';
    if(e?.enclosingElement is ClassElement){
      final parent=e!.enclosingElement!.displayName;
      if(e is ExecutableElement&&e.isStatic||e is FieldElement&&e.isStatic)return '$parent.$name';
      if(e is ExecutableElement||e is FieldElement)return 'this.$name';
    }
    return name;
  }
  String property(String target,String name){
    if(stores.contains(name))return 'numericObjectStorage($target,"${storeOwners[name]}")';
    if(target=='double')return switch(name){'infinity'=>'Infinity','negativeInfinity'=>'-Infinity','nan'=>'NaN',_=>throw UnsupportedError('double.$name')};
    if(target=='math')return switch(name){'pi'=>'Math.PI','sqrt1_2'=>'Math.SQRT1_2',_=>'Math.$name'};
    return '$target.$name';
  }
  bool numeric(Expression n)=>['double','int','num'].contains(n.staticType?.getDisplayString());
  bool vector(Expression n)=>classes.contains(n.staticType?.getDisplayString().replaceAll('?',''));
  String storage(Expression n){final name=n.staticType!.getDisplayString().replaceAll('?',''),dimension=name=='Quaternion'?4:name.startsWith('Matrix')?int.parse(name[6])*int.parse(name[6]):int.parse(name[6]);return 'checkedNumericStorage(${expr(n)}.storage,$dimension)';}
  String argument(Argument n){if(n is NamedArgument)return unsupported(n);return expr(n.argumentExpression);}
  String index(IndexExpression n){final t=n.target;final target=t==null?cascade!:expr(t);return t!=null&&vector(t)?'$target.at(${expr(n.index)})':'$target[${expr(n.index)}]!';}
  String expr(Expression n){
    if(n is SimpleIdentifier)return identifier(n);
    if(n is IntegerLiteral||n is DoubleLiteral||n is BooleanLiteral||n is NullLiteral)return n.toSource();
    if(n is ThisExpression)return 'this';
    if(n is ParenthesizedExpression)return '(${expr(n.expression)})';
    if(n is PrefixedIdentifier){if(numeric(n.prefix)&&['isNaN','isFinite','isInfinite'].contains(n.identifier.name))return numberProperty(expr(n.prefix),n.identifier.name);if(n.identifier.name=='storage'&&vector(n.prefix))return storage(n.prefix);return property(expr(n.prefix),n.identifier.name);}
    if(n is PropertyAccess){final target=n.target==null?cascade!:expr(n.target!);if(n.target!=null&&numeric(n.target!)&&['isNaN','isFinite','isInfinite'].contains(n.propertyName.name))return numberProperty(target,n.propertyName.name);if(n.target!=null&&n.propertyName.name=='storage'&&vector(n.target!))return storage(n.target!);return property(target,n.propertyName.name);}
    if(n is IndexExpression)return index(n);
    if(n is BinaryExpression){final op=n.operator.lexeme,a=expr(n.leftOperand),b=expr(n.rightOperand);if(vector(n.leftOperand)&&operators.containsKey(op)&&n.rightOperand is! NullLiteral&&n.leftOperand is! NullLiteral)return '$a.${operators[op]}($b)';return '$a ${op=='=='?'===':op=='!='?'!==':op} $b';}
    if(n is PrefixExpression){if(n.operator.lexeme=='-'&&vector(n.operand))return '${expr(n.operand)}.unaryMinus()';return '${n.operator.lexeme}${expr(n.operand)}';}
    if(n is PostfixExpression)return '${expr(n.operand)}${n.operator.lexeme}';
    if(n is ConditionalExpression)return '${expr(n.condition)} ? ${expr(n.thenExpression)} : ${expr(n.elseExpression)}';
    if(n is AssignmentExpression){final left=n.leftHandSide,op=n.operator.lexeme;if(left is IndexExpression&&left.target!=null&&vector(left.target!)){final target=expr(left.target!),i=expr(left.index),rhs=expr(n.rightHandSide);return '$target.setAt($i,${op=='='?rhs:'$target.at($i) ${op.substring(0,op.length-1)} ($rhs)'})';}return '${expr(left)} $op ${expr(n.rightHandSide)}';}
    if(n is IsExpression){final a=expr(n.expression),t=n.type.toSource(),check=['double','int','num'].contains(t)?'typeof $a === "number"':'$a instanceof $t';return n.notOperator==null?'($check)':'!($check)';}
    if(n is AsExpression)return '(${expr(n.expression)} as ${type(n.type)})';
    if(n is ThrowExpression)return 'throw ${expr(n.expression)}';
    if(n is StringInterpolation){final parts=n.elements.map((e){if(e is InterpolationString)return e.value.replaceAll('`',r'\`').replaceAll(r'${',r'\${');final v=(e as InterpolationExpression).expression;return r'${'+(numeric(v)?'numericString(${expr(v)})':expr(v))+'}';}).join();return '`$parts`';}
    if(n is SimpleStringLiteral)return jsonEncode(n.value);
    if(n is AdjacentStrings)return '(${n.strings.map(expr).join('+')})';
    if(n is CascadeExpression){final id='cascade${serial++}',previous=cascade;cascade=id;final sections=n.cascadeSections.map(expr).map((s)=>'$s;').join();cascade=previous;return '(()=>{const $id=${expr(n.target)};$sections return $id;})()';}
    if(n is InstanceCreationExpression){final name=n.constructorName.type.toSource(),suffix=n.constructorName.name?.name,args=n.argumentList.arguments.map(argument).join(',');if(name=='Float64List')return 'new Float64Array($args)';if(name=='math.Random')return 'defaultNumericRandom()';if(name=='ArgumentError'||name=='UnimplementedError')return 'new Error("Invalid numeric argument")';if(suffix==null)return 'new $name($args)';if(suffix=='_')return '$name.zero()';return '$name.$suffix($args)';}
    if(n is MethodInvocation){final name=n.methodName.name,t=n.target,args=n.argumentList.arguments.map(argument).toList(),a=args.join(',');
      if(t!=null&&numeric(t))return switch(name){'abs'=>'Math.abs(${expr(t)})','sqrt'=>'Math.sqrt(${expr(t)})','clamp'=>'clampNumeric(${expr(t)},$a)','floorToDouble'=>'Math.floor(${expr(t)})','ceilToDouble'=>'Math.ceil(${expr(t)})','truncateToDouble'=>'Math.trunc(${expr(t)})','roundToDouble'=>'roundNumeric(${expr(t)})','toDouble'=>expr(t),_=>unsupported(n)};
      if(t is SimpleIdentifier&&t.name=='Object'&&name=='hashAll')return 'hashDoubles($a)';
      if(t is SimpleIdentifier&&t.name=='ArgumentError')return 'new Error("Invalid numeric argument")';
      if(t is SimpleIdentifier&&t.name=='Float64List'&&name=='view')return 'new Float64Array($a)';
      final target=t==null?(n.isCascaded?cascade: null):expr(t);
      if(target!=null)return '${property(target,name)}($a)';
      final method=n.methodName.element;if(method?.enclosingElement is ClassElement)return '${(method as ExecutableElement).isStatic?method.enclosingElement!.displayName:'this'}.$name($a)';
      return '$name($a)';
    }
    return unsupported(n);
  }
  String variables(VariableDeclarationList n,{bool terminator=true}){
    final declarations=n.variables.map((v){final t=n.type==null?'':':${type(n.type)}',value=v.initializer==null?'':'=${expr(v.initializer!)}';return '${v.name.lexeme}$t$value';}).join(',');
    return '${n.isFinal&&n.variables.every((v)=>v.initializer!=null)?'const':'let'} $declarations${terminator?';':''}';
  }
  String statement(Statement n){
    if(n is Block)return '{${n.statements.map(statement).join('\n')}}';
    if(n is ExpressionStatement)return '${expr(n.expression)};';
    if(n is ReturnStatement)return 'return${n.expression==null?'':' ${expr(n.expression!)}'};';
    if(n is VariableDeclarationStatement)return variables(n.variables);
    if(n is IfStatement)return 'if(${expr(n.expression)})${statement(n.thenStatement)}${n.elseStatement==null?'':'else ${statement(n.elseStatement!)}'}';
    if(n is AssertStatement)return 'invariant(${expr(n.condition)},"invalid-numeric-argument","Numeric precondition failed");';
    if(n is ForStatement){final parts=n.forLoopParts;if(parts is ForPartsWithDeclarations)return 'for(${variables(parts.variables,terminator:false)};${parts.condition==null?'':expr(parts.condition!)};${parts.updaters.map(expr).join(',')})${statement(n.body)}';return unsupported(n);}
    if(n is EmptyStatement)return ';';
    return unsupported(n);
  }
  String parameters(FormalParameterList? list,{bool readOnlyArrays=false})=>list?.parameters.map((p){final name=p.name!.lexeme,t=readOnlyArrays?type(p.type).replaceAll('number[]','readonly number[]'):type(p.type),d=p.defaultClause?.value;return '$name:${t}${d!=null?'=${expr(d)}':p.isOptional?'=null':''}';}).join(',')??'';
  String body(FunctionBody b,{bool discard=false}){if(b is BlockFunctionBody)return statement(b.block);if(b is ExpressionFunctionBody)return '{${discard?'':'return '}${expr(b.expression)};}';return unsupported(b);}
  String method(MethodDeclaration n){
    final sourceName=n.name.lexeme,params=parameters(n.parameters,readOnlyArrays:n.name.lexeme=='copyFromArray'),name=n.isOperator?(sourceName=='-'&&n.parameters!.parameters.isEmpty?'unaryMinus':(operators[sourceName]??(throw UnsupportedError('operator $sourceName')))):sourceName;
    if(name=='storage')return 'get storage():Float64Array{return numericStorage(this.values);}';
    if(name=='hashCode'){final dimension=owner=='Quaternion'?4:owner.startsWith('Matrix')?int.parse(owner[6])*int.parse(owner[6]):int.parse(owner[6]);return 'get hashCode():number{return hashDoubles(Array.from(this.values).slice(0,$dimension));}';}
    final prefix='${name.startsWith('_')?'private ':''}${n.isStatic?'static ':''}';
    if(n.isGetter)return '${prefix}get $name():${type(n.returnType)}${body(n.body)}';
    if(n.isSetter)return '${prefix}set $name($params)${body(n.body,discard:true)}';
    return '$prefix$name($params):${type(n.returnType)}${body(n.body,discard:type(n.returnType)=='void')}';
  }
  String numberProperty(String value,String name)=>switch(name){'isNaN'=>'Number.isNaN($value)','isFinite'=>'Number.isFinite($value)','isInfinite'=>'($value === Infinity || $value === -Infinity)',_=>throw UnsupportedError(name)};
}

Future<void> main(List<String> arguments) async {
  if(arguments.length!=2)throw ArgumentError('numeric_draft <vector_math package directory> <fresh scratch directory>');
  final root=p.canonicalize(arguments[0]),out=Directory(p.canonicalize(arguments[1]));
  if(out.existsSync())throw StateError('Output must be fresh');
  final package=jsonDecode(File(p.join(root,'pubspec.yaml')).readAsStringSync().contains('version: 2.4.3')?'"vector_math-2.4.3"':'null');if(package==null)throw StateError('Expected pinned vector_math 2.4.3');
  final collection=AnalysisContextCollection(includedPaths:[p.join(root,'lib')]);
  final records=<Map<String,Object?>>[],errors=<Map<String,Object?>>[];
  out.createSync(recursive:true);
  for(final name in classes){
    final file=p.normalize(p.join(root,'lib','src','vector_math_64','${name.toLowerCase()}.dart')),session=collection.contextFor(file).currentSession,result=await session.getResolvedUnit(file);
    if(result is! ResolvedUnitResult)throw StateError('Unresolved numeric source');
    final diagnostics=result.diagnostics.where((e)=>e.diagnosticCode.severity.name=='ERROR').toList();if(diagnostics.isNotEmpty)throw StateError('Numeric source diagnostics: $diagnostics');
    final decl=result.unit.declarations.whereType<ClassDeclaration>().single,instanceMembers=<String>{},staticMembers=<String>{};
    for(final node in decl.body.members){if(node is MethodDeclaration)(node.isStatic?staticMembers:instanceMembers).add(node.name.lexeme);if(node is FieldDeclaration)(node.isStatic?staticMembers:instanceMembers).addAll(node.fields.variables.map((v)=>v.name.lexeme));}
    final draft=Draft(name,instanceMembers,staticMembers);final members=<String>[];
    for(final node in decl.body.members){
      try{
        if(node is MethodDeclaration)members.add(draft.method(node));
        else if(node is ConstructorDeclaration&&node.factoryKeyword!=null&&node.name!=null){final factory=node.name!.lexeme;members.add('static $factory(${draft.parameters(node.parameters,readOnlyArrays:factory=='array'||factory=='fromList')}):$name${draft.body(node.body)}');}
        else if(node is FieldDeclaration&&node.isStatic){for(final v in node.fields.variables)members.add('private static ${v.name.lexeme}:${draft.type(node.fields.type)}=${v.initializer==null?'null':draft.expr(v.initializer!)};');}
        else if(node is! FieldDeclaration&&node is! ConstructorDeclaration)draft.unsupported(node);
      }on UnsupportedError catch(e){errors.add({'class':name,'offset':node.offset,'length':node.length,'sha256':sha(result.content.substring(node.offset,node.end)),'reason':e.message});}
    }
    final output=members.join('\n');File(p.join(out.path,'${name.toLowerCase()}.members.ts')).writeAsStringSync(output);
    records.add({'class':name,'source':file,'sourceSha256':sha(result.content),'membersEmitted':members.length,'outputSha256':sha(output)});
  }
  final receipt={'scope':'Seven pinned numeric classes only; drafts require manual review, constructors/storage adapters, compilation and behavioral oracle. Never writes product source.','records':records,'unsupported':errors};
  File(p.join(out.path,'receipt.json')).writeAsStringSync('${jsonEncode(receipt)}\n');
  stdout.writeln(jsonEncode({'classes':records.length,'members':records.fold(0,(n,r)=>n+(r['membersEmitted'] as int)),'unsupported':errors.length}));
}
