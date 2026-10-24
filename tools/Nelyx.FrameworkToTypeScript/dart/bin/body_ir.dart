// SPDX-License-Identifier: BSD-3-Clause
// Resolved execution IR. Unsupported nodes block the entire selected declaration.
import 'dart:convert';
import 'dart:io';
import 'package:analyzer/dart/analysis/analysis_context_collection.dart';
import 'package:analyzer/dart/analysis/results.dart';
import 'package:analyzer/dart/ast/ast.dart';
import 'package:analyzer/dart/ast/visitor.dart';
import 'package:analyzer/dart/analysis/session.dart';
import 'package:analyzer/dart/element/element.dart';
import 'package:analyzer/dart/element/type.dart';
import 'package:analyzer/dart/element/nullability_suffix.dart';
import 'package:analyzer/dart/element/type_system.dart';
import 'package:crypto/crypto.dart';
import 'package:path/path.dart' as p;
import 'package:yaml/yaml.dart';

String digest(String text)=>sha256.convert(utf8.encode(text)).toString();
class InheritedDefault {
  final Expression expression;
  final Map<String,Object?> origin;
  InheritedDefault(this.expression,this.origin);
}
class SuperDefaultParameters extends RecursiveAstVisitor<void> {
  final parameters=<FormalParameterElement>{};
  @override void visitConstructorDeclaration(ConstructorDeclaration node){
    if(node.factoryKeyword!=null&&node.redirectedConstructor!=null)for(final formal in node.parameters.parameters){if(!formal.isRequired&&formal.defaultClause==null)parameters.add(formal.declaredFragment!.element.baseElement);}
    super.visitConstructorDeclaration(node);
  }
  @override void visitSuperFormalParameter(SuperFormalParameter node){
    final element=node.declaredFragment!.element;
    if(node.defaultClause==null&&element is SuperFormalParameterElement){final parent=element.superConstructorParameter;if(!node.isRequired&&parent!=null&&parent.hasDefaultValue)parameters.add(parent.baseElement);}
    super.visitSuperFormalParameter(node);
  }
}
class InheritedDefaultResolver {
  final AnalysisSession session;
  final libraries=<String,ResolvedLibraryResult>{};
  final defaults=<FormalParameterElement,InheritedDefault>{};
  InheritedDefaultResolver(this.session);
  FormalParameterElement? nextDefault(FormalParameterElement current){
    if(current is SuperFormalParameterElement)return current.superConstructorParameter?.baseElement;
    final constructor=current.enclosingElement;if(constructor is! ConstructorElement)return null;
    final target=constructor.redirectedConstructor;if(target==null)return null;
    if(current.isNamed){final matches=target.formalParameters.where((value)=>value.isNamed&&value.name==current.name).toList();return matches.length==1?matches.single.baseElement:null;}
    final source=constructor.formalParameters.where((value)=>!value.isNamed).toList(),destination=target.formalParameters.where((value)=>!value.isNamed).toList(),index=source.indexWhere((value)=>value.baseElement==current.baseElement);return index>=0&&index<destination.length?destination[index].baseElement:null;
  }
  Future<Map<FormalParameterElement,InheritedDefault>> collect(AstNode node)async{
    final visitor=SuperDefaultParameters();node.accept(visitor);
    for(final parent in visitor.parameters){
      if(defaults.containsKey(parent))continue;
      final owner=parent.enclosingElement,factoryDefault=owner is ConstructorElement&&owner.redirectedConstructor!=null;
      final value=parent.computeConstantValue();if(!factoryDefault&&(value==null||value.isNull||value.toFunctionValue()!=null||value.toBoolValue()!=null||value.toDoubleValue()!=null||value.toIntValue()!=null||value.toStringValue()!=null))continue;
      final variable=value?.variable;if(!factoryDefault&&(variable is FieldElement&&variable.isEnumConstant||variable is TopLevelVariableElement&&variable.isConst))continue;
      var current=parent;final seen=<FormalParameterElement>{};
      while(seen.add(current)){
        final owner=current.library;if(owner==null)break;
        final uri=owner.uri.toString();var library=libraries[uri];
        if(library==null){final result=await session.getResolvedLibraryByElement(owner);if(result is! ResolvedLibraryResult)break;library=result;libraries[uri]=result;}
        final declaration=library.getFragmentDeclaration(current.firstFragment),formal=declaration?.node,unit=declaration?.resolvedUnit;
        if(formal is FormalParameter&&formal.defaultClause!=null&&unit!=null){
          if(unit.diagnostics.any((value)=>value.diagnosticCode.severity.name=='ERROR'))break;
          final expression=formal.defaultClause!.value,content=unit.content;
          if(File(unit.path).readAsStringSync()!=content)throw StateError('Inherited default source changed: ${unit.path}');
          defaults[parent]=InheritedDefault(expression,{'library':uri,'source':unit.path,'sourceSha256':digest(content.replaceAll('\r\n','\n')),'offset':expression.offset,'length':expression.length,'spanSha256':digest(content.substring(expression.offset,expression.end))});break;
        }
        final next=nextDefault(current);if(next==null)break;current=next;
      }
    }
    return defaults;
  }
}
String qualified(Element e){final parent=e.enclosingElement;final own=e is TypeParameterElement&&parent!=null&&parent.name==null?'@${e.firstFragment.nameOffset}.${e.displayName}':e.displayName;return parent==null||parent is LibraryElement?own:'${qualified(parent)}.$own';}
Map<String,Object?>? reference(Element? e){if(e==null)return null;return {'id':'${e.library?.uri}::${qualified(e)}:${e.kind.name}','name':e.displayName,'owner':e.enclosingElement is InterfaceElement?e.enclosingElement!.displayName:null,'local':e is LocalElement||e is FormalParameterElement,if(e is VariableElement&&e.isConst||e is GetterElement&&e.variable.isConst)'constant':true,if(e is LocalVariableElement)'declarationOffset':e.firstFragment.nameOffset,'static':e is ExecutableElement?e.isStatic:e is FieldElement?e.isStatic:false};}
class ExecutionIr {
  final bool preserveTypeAliases;
  final TypeSystem typeSystem;
  final Map<FormalParameterElement,InheritedDefault> inheritedDefaults;
  ExecutionIr({required this.typeSystem,this.preserveTypeAliases=false,this.inheritedDefaults=const {}});
  final guardedAccesses=<Expression,Map<String,Object?>>{};
  Never unsupported(AstNode n)=>throw UnsupportedError('${n.runtimeType}@${n.offset}:${n.length} ${n.toSource().substring(0,n.toSource().length.clamp(0,160))}');
  Map<String,Object?> node(String kind,AstNode n,Map<String,Object?> value)=>{'kind':kind,'offset':n.offset,'length':n.length,...value};
  Map<String,Object?> resolvedType(DartType type){
    final value=resolvedUnderlyingType(type),alias=type.alias;
    if(preserveTypeAliases&&alias!=null)value['alias']={'reference':reference(alias.element),'arguments':alias.typeArguments.map(resolvedType).toList()};
    return value;
  }
  Map<String,Object?> resolvedUnderlyingType(DartType type){
    final nullable=type.nullabilitySuffix==NullabilitySuffix.question;
    if(type is FunctionType)return {'kind':'function','nullable':nullable,if(type.typeParameters.isNotEmpty)'typeParameters':type.typeParameters.map((p)=>{'name':p.displayName,'reference':reference(p),'bound':p.bound==null?null:resolvedType(p.bound!)}).toList(),'returnType':resolvedType(type.returnType),'parameters':type.formalParameters.map((p)=>{'name':p.name,'named':p.isNamed,'required':p.isRequired,'type':resolvedType(p.type)}).toList()};
    if(type is TypeParameterType)return {'kind':'parameter','nullable':nullable,'reference':reference(type.element),if(type.bound!=type.element.bound&&type.bound is! DynamicType)'promotedBound':resolvedType(type.bound)};
    if(type is InterfaceType)return {'kind':'interface','nullable':nullable,'reference':reference(type.element),'arguments':type.typeArguments.map(resolvedType).toList()};
    if(type is VoidType)return {'kind':'void','nullable':nullable};
    if(type is NeverType)return {'kind':'never','nullable':nullable};
    if(type is DynamicType)return {'kind':'dynamic','nullable':nullable};
    if(type is RecordType&&type.namedFields.isEmpty)return {'kind':'record','nullable':nullable,'fields':type.positionalFields.map((field)=>resolvedType(field.type)).toList()};
    if(type is RecordType)return {'kind':'namedRecord','nullable':nullable,'positional':type.positionalFields.map((field)=>resolvedType(field.type)).toList(),'named':type.namedFields.map((field)=>{'name':field.name,'type':resolvedType(field.type)}).toList()};
    throw UnsupportedError('Resolved class type ${type.runtimeType}: ${type.getDisplayString()} needs a type adapter');
  }
  Map<String,Object?>? numericSource(DartType type, {required bool inferred}) {
    final bounds=<Map<String,String>>[],seen=<TypeParameterElement>{};
    bool numeric(DartType value) {
      if(value is InterfaceType) {
        final own=value.element.library.uri.toString()=='dart:core'&&['int','double','num','BigInt'].contains(value.element.name);
        final nested=value.typeArguments.map(numeric).toList();
        return own||nested.any((value)=>value);
      }
      if(value is FunctionType){final parts=[numeric(value.returnType),...value.formalParameters.map((p)=>numeric(p.type))];return parts.any((v)=>v);}
      if(value is RecordType){final parts=[...value.positionalFields.map((f)=>numeric(f.type)),...value.namedFields.map((f)=>numeric(f.type))];return parts.any((v)=>v);}
      if(value is TypeParameterType&&seen.add(value.element)) {
        final bound=value.element.bound;
        if(bound!=null&&numeric(bound)) {bounds.add({'name':value.element.displayName,'type':bound.getDisplayString()});return true;}
      }
      return false;
    }
    if(!numeric(type))return null;
    return {'type':type.getDisplayString(),'inferred':inferred,'bounds':bounds,'resolvedType':resolvedType(type)};
  }
  bool inferredParameter(FormalParameter p)=>p.type==null;
  Map<String,Object?> typeAliasDeclaration(TypeAlias n){
    final element=n.declaredFragment?.element;if(element is! TypeAliasElement)return unsupported(n);
    final type=element.aliasedType,aliased=resolvedType(type),members=<Map<String,Object?>>[];
    if((aliased['alias'] as Map?)?['reference'] case final Map own when own['id']==reference(element)!['id'])aliased.remove('alias');
    void collect(DartType value,List<Object> path){
      final numeric=numericSource(value,inferred:false);
      if(numeric!=null)members.add({'path':path,'numeric':numeric});
      if(value is FunctionType){collect(value.returnType,[...path,'return']);for(var i=0;i<value.formalParameters.length;i++){collect(value.formalParameters[i].type,[...path,'parameter',i]);}}
      if(value is RecordType){for(var i=0;i<value.positionalFields.length;i++){collect(value.positionalFields[i].type,[...path,'positional',i]);}for(final field in value.namedFields){collect(field.type,[...path,'named',field.name]);}}
      if(value is InterfaceType){for(var i=0;i<value.typeArguments.length;i++){collect(value.typeArguments[i],[...path,'argument',i]);}}
    }
    collect(type,[]);
    return node('typeAlias',n,{'name':n.name.lexeme,'reference':reference(element),'typeParameters':element.typeParameters.map((parameter)=>{'name':parameter.displayName,'reference':reference(parameter),'bound':parameter.bound==null?null:resolvedType(parameter.bound!)}).toList(),'aliasedType':aliased,'numeric':numericSource(type,inferred:false),'numericMembers':members});
  }
  // A?.b.c skips the entire selector chain in Dart. Do not accidentally
  // turn it into (A == null ? null : A.b).c while lowering one selector.
  bool nullShorting(Expression n)=>!guardedAccesses.containsKey(n)&&(n is PropertyAccess&&(n.isNullAware||n.target!=null&&nullShorting(n.target!))||n is MethodInvocation&&(n.isNullAware||n.target!=null&&nullShorting(n.target!))||n is IndexExpression&&(n.isNullAware||n.target!=null&&nullShorting(n.target!)));
  Expression? selectorTarget(Expression n)=>n is PropertyAccess?n.target:n is MethodInvocation?n.target:n is IndexExpression?n.target:null;
  int recordIndex(String name,RecordType type,AstNode node){final match=RegExp(r'^\$([1-9][0-9]*)$').firstMatch(name),index=match==null?-1:int.parse(match.group(1)!)-1;if(type.namedFields.isNotEmpty||index<0||index>=type.positionalFields.length)return unsupported(node);return index;}
  Map<String,Object?> recordAccess(AstNode n,Expression target,String name,{bool nullAware=false,Map<String,Object?>? guarded}){
    final type=target.staticType as RecordType;
    if(type.namedFields.isEmpty)return node('recordAccess',n,{'target':guarded??expression(target),'index':recordIndex(name,type,n),'arity':type.positionalFields.length,'nullAware':nullAware});
    final Object key;if(type.namedFields.any((field)=>field.name==name)){key=name;}else{final match=RegExp(r'^\$([1-9][0-9]*)$').firstMatch(name),index=match==null?-1:int.parse(match.group(1)!)-1;if(index<0||index>=type.positionalFields.length)return unsupported(n);key=index;}
    return node('namedRecordAccess',n,{'target':guarded??expression(target),'key':key,'arity':type.positionalFields.length,'names':type.namedFields.map((field)=>field.name).toList(),'nullAware':nullAware});
  }
  bool scalarPattern(Expression n){final type=n.staticType;return type is InterfaceType&&(type.element is EnumElement||type.element.library.uri.toString()=='dart:core'&&['int','double','num','String','bool','Null'].contains(type.element.name));}
  bool legacyScalarMatch(DartPattern p){
    if(p is ParenthesizedPattern)return legacyScalarMatch(p.pattern);
    if(p is LogicalOrPattern)return legacyScalarMatch(p.leftOperand)&&legacyScalarMatch(p.rightOperand);
    return p is WildcardPattern&&p.type==null||p is ConstantPattern&&scalarPattern(p.expression);
  }
  bool legacyRecordMatch(DartPattern pattern,DartType type){
    if(pattern is WildcardPattern&&pattern.type==null)return true;
    if(pattern is ConstantPattern&&scalarPattern(pattern.expression))return true;
    if(pattern is! RecordPattern||type is! RecordType||type.nullabilitySuffix==NullabilitySuffix.question||type.namedFields.isNotEmpty||pattern.fields.length!=type.positionalFields.length)return false;
    for(var i=0;i<pattern.fields.length;i++){final field=pattern.fields[i];if(field.name!=null||!legacyRecordMatch(field.pattern,type.positionalFields[i].type))return false;}
    return true;
  }
  bool legacyRecordSelector(DartPattern pattern,DartType type)=>type is RecordType&&type.nullabilitySuffix!=NullabilitySuffix.question&&type.namedFields.isEmpty&&legacyRecordMatch(pattern,type);
  List<Expression> scalarAlternatives(DartPattern pattern){
    if(pattern is ConstantPattern&&scalarPattern(pattern.expression))return [pattern.expression];
    if(pattern is LogicalOrPattern)return [...scalarAlternatives(pattern.leftOperand),...scalarAlternatives(pattern.rightOperand)];
    return unsupported(pattern);
  }
  List<Map<String,Object?>> stringParts(StringLiteral n){
    final parts=<Map<String,Object?>>[{'kind':'text','value':''}];
    void text(String value){parts.last['value']='${parts.last['value']}$value';}
    void visit(StringLiteral literal){
      if(literal is SimpleStringLiteral){text(literal.value);return;}
      if(literal is AdjacentStrings){for(final string in literal.strings){visit(string);}return;}
      if(literal is StringInterpolation){for(final part in literal.elements){if(part is InterpolationString){text(part.value);}else{final value=(part as InterpolationExpression).expression;parts.add({'kind':'expression','value':expression(value),'resolvedType':resolvedType(value.staticType!)});parts.add({'kind':'text','value':''});}}return;}
      unsupported(literal);
    }
    visit(n);return parts;
  }
  ExecutableElement? sourceOperatorElement(Expression n){
    final element=n is BinaryExpression?n.element:n is PrefixExpression?n.element:n is PostfixExpression?n.element:null;
    return element!=null&&element.library.uri.scheme!='dart'?element:null;
  }
  Map<String,Object?> operatorArgument(BinaryExpression n){
    final element=sourceOperatorElement(n);if(element==null)return {};
    if(element.formalParameters.length!=1)return unsupported(n);
    final parameter=element.formalParameters.single;
    return {'operatorParameterType':resolvedType(parameter.baseElement.type),'appliedOperatorParameterType':resolvedType(parameter.type)};
  }
  DartType? storageType(Expression n){
    final operator=sourceOperatorElement(n);if(operator!=null)return operator.baseElement.returnType;
    if(n is FunctionExpression)return n.staticType;
    if(n is ParenthesizedExpression)return storageType(n.expression);
    if(n is FunctionExpressionInvocation){final function=storageType(n.function);return function is FunctionType?function.returnType:null;}
    if(n is MethodInvocation&&n.methodName.name=='call'&&n.target?.staticType is FunctionType){final function=storageType(n.target!);return function is FunctionType?function.returnType:null;}
    // Record fields have no ordinary variable/getter element. A stored callback
    // retains its declaration signature rather than losing return provenance.
    final recordTarget=n is PropertyAccess?n.target:n is PrefixedIdentifier?n.prefix:null;
    if(recordTarget!=null){final record=storageType(recordTarget)??recordTarget.staticType;if(record is RecordType){final name=n is PropertyAccess?n.propertyName.name:(n as PrefixedIdentifier).identifier.name;DartType? field;for(final named in record.namedFields){if(named.name==name)field=named.type;}if(field==null){final match=RegExp(r'^\$([1-9][0-9]*)$').firstMatch(name),index=match==null?-1:int.parse(match.group(1)!)-1;if(index>=0&&index<record.positionalFields.length)field=record.positionalFields[index].type;}if(field is FunctionType)return field;}}
    final origin=(n is SimpleIdentifier?n.element:n is PrefixedIdentifier?n.element:n is PropertyAccess?n.propertyName.element:n is DotShorthandPropertyAccess?n.propertyName.element:n is MethodInvocation?n.methodName.element:n is IndexExpression?n.element:null)?.baseElement;
    if((n is SimpleIdentifier||n is PrefixedIdentifier||n is PropertyAccess)&&origin is ExecutableElement&&origin is! GetterElement&&origin is! SetterElement)return origin.type;
    return origin is VariableElement?origin.type:origin is ExecutableElement?origin.returnType:null;
  }
  Map<String,Object?> expression(Expression n){
    if(n is PostfixExpression&&nullShorting(n.operand)||n is FunctionExpressionInvocation&&nullShorting(n.function))return unsupported(n);
    Map<String,Object?> out;
    final target=selectorTarget(n);
    if(target!=null&&nullShorting(target)&&!(n is PropertyAccess&&n.isNullAware||n is MethodInvocation&&n.isNullAware||n is IndexExpression&&n.isNullAware)){
      Expression? access=target;
      while(access!=null&&!(access is PropertyAccess&&access.isNullAware||access is MethodInvocation&&access.isNullAware||access is IndexExpression&&access.isNullAware)){access=selectorTarget(access);}
      if(access==null||selectorTarget(access)==null)return unsupported(n);
      final receiver=selectorTarget(access)!,receiverIr=expression(receiver),old=guardedAccesses[access];
      guardedAccesses[access]=node('nullChainTarget',receiver,{'type':receiver.staticType?.getDisplayString().replaceFirst(RegExp(r'\?$'),'')});
      try{out=node('nullChain',n,{'target':receiverIr,'body':expression(n)});}finally{if(old==null){guardedAccesses.remove(access);}else{guardedAccesses[access]=old;}}
    }
    else if(n is IntegerLiteral||n is DoubleLiteral||n is BooleanLiteral||n is NullLiteral)out=node('literal',n,{'value':n is IntegerLiteral?n.value:n is DoubleLiteral?n.value:n is BooleanLiteral?n.value:null});
    else if(n is SimpleStringLiteral)out=node('literal',n,{'value':n.value});
    else if(n is AdjacentStrings&&n.stringValue!=null)out=node('literal',n,{'value':n.stringValue});
    else if(n is AdjacentStrings)out=node('interpolation',n,{'parts':stringParts(n)});
    else if(n is SwitchExpression){
      if(n.cases.any((arm)=>arm.guardedPattern.whenClause!=null||(n.expression.staticType is RecordType?!legacyRecordSelector(arm.guardedPattern.pattern,n.expression.staticType!):!legacyScalarMatch(arm.guardedPattern.pattern)))){
        out=node('patternSwitchExpression',n,{'value':expression(n.expression),'resultType':resolvedType(n.staticType!),'cases':n.cases.map((arm)=>{'pattern':matchPattern(arm.guardedPattern.pattern),'guard':arm.guardedPattern.whenClause==null?null:expression(arm.guardedPattern.whenClause!.expression),'result':expression(arm.expression)}).toList()});
      }else if(n.expression.staticType is RecordType){
        final type=n.expression.staticType as RecordType;
        if(type.nullabilitySuffix==NullabilitySuffix.question||type.namedFields.isNotEmpty)return unsupported(n);
        final cases=<Object?>[];var fallback=false;
        for(final arm in n.cases){
          if(fallback||arm.guardedPattern.whenClause!=null)return unsupported(arm);
          final tests=recordTests(arm.guardedPattern.pattern,type,[]);
          fallback=tests.isEmpty;
          cases.add({'tests':tests,'result':expression(arm.expression)});
        }
        // The expression may itself return a different record shape. Keep the
        // matched input separate from result metadata added below.
        out=node('recordSwitchExpression',n,{'value':expression(n.expression),'matchedType':resolvedType(type),'cases':cases});
      }else{
      final cases=<Object?>[];var fallback=false;
      for(final arm in n.cases){
        if(fallback||arm.guardedPattern.whenClause!=null)return unsupported(arm);
        final pattern=arm.guardedPattern.pattern;
        if(pattern is WildcardPattern&&pattern.type==null){fallback=true;cases.add({'test':null,'result':expression(arm.expression)});}
        else{for(final test in scalarAlternatives(pattern)){cases.add({'test':expression(test),'result':expression(arm.expression)});}}
      }
      out=node('switchExpression',n,{'value':expression(n.expression),'cases':cases});
      }
    }
    else if(n is IsExpression)out=node('typeTest',n,{'value':expression(n.expression),'checkedType':resolvedType(n.type.type!),'negated':n.notOperator!=null});
    else if(n is AsExpression)out=node('typeCast',n,{'value':expression(n.expression),'checkedType':resolvedType(n.type.type!)});
    else if(n is ThisExpression)out=node('this',n,{});
    else if(n is SuperExpression)out=node('super',n,{});
    else if(n is ThrowExpression)out=node('throw',n,{'value':expression(n.expression)});
    else if(n is RethrowExpression)out=node('rethrow',n,{});
    else if(n is TypeLiteral)out=node('typeLiteral',n,{'valueType':resolvedType(n.type.type!)});
    else if(n is AwaitExpression)out=node('await',n,{'value':expression(n.expression)});
    else if(n is CascadeExpression)out=node('cascade',n,{'target':expression(n.target),'nullAware':n.isNullAware,'sections':n.cascadeSections.map(expression).toList()});
    else if(n is FunctionExpression){final type=n.staticType as FunctionType;out=node('closure',n,{if(n.typeParameters!=null)'typeParameters':n.typeParameters!.typeParameters.map((p){final element=p.declaredFragment!.element;return {'name':p.name.lexeme,'reference':reference(element),'bound':p.bound==null?null:resolvedType(element.bound!)};}).toList(),'parameters':classParameters(n.parameters),'returnType':resolvedType(type.returnType),'body':body(n.body,discardResult:type.returnType is VoidType)});}
    else if(n is FunctionExpressionInvocation)out=node('invoke',n,{'target':expression(n.function),'signature':resolvedType(n.function.staticType!),'args':arguments(n.argumentList),if(n.function.staticType is FunctionType&&(n.function.staticType as FunctionType).typeParameters.isNotEmpty)'resolvedTypeArguments':n.typeArgumentTypes?.map(resolvedType).toList(),'typeArguments':n.typeArguments?.arguments.map((t)=>resolvedType(t.type!)).toList()??[]});
    else if(n is StringInterpolation)out=node('interpolation',n,{'parts':n.elements.map((part)=>part is InterpolationString?{'kind':'text','value':part.value}:{'kind':'expression','value':expression((part as InterpolationExpression).expression),'resolvedType':resolvedType(part.expression.staticType!)}).toList()});
    else if(n is ParenthesizedExpression)out=node('parenthesized',n,{'value':expression(n.expression)});
    else if(n is SimpleIdentifier)out=node('identifier',n,{'name':n.element is FormalParameterElement?n.element!.displayName:n.name,'reference':reference(n.element)});
    else if(n is DotShorthandPropertyAccess){final element=n.propertyName.element,owner=element?.enclosingElement;if(element is! GetterElement||!element.isStatic||owner is! InterfaceElement)return unsupported(n);out=node('property',n,{'target':node('identifier',n,{'name':owner.displayName,'reference':reference(owner),'type':'Type'}),'name':element.displayName,'reference':reference(element),'targetType':owner.displayName});}
    else if(n is PrefixedIdentifier&&n.prefix.staticType is RecordType)out=recordAccess(n,n.prefix,n.identifier.name);
    else if(n is PropertyAccess&&n.target?.staticType is RecordType)out=recordAccess(n,n.target!,n.propertyName.name,nullAware:n.isNullAware&&!guardedAccesses.containsKey(n),guarded:guardedAccesses[n]);
    else if(n is PrefixedIdentifier)out=node('property',n,{'target':expression(n.prefix),'name':n.identifier.name,'reference':reference(n.identifier.element),'targetType':n.prefix.staticType?.getDisplayString()});
    else if(n is PropertyAccess&&(n.target!=null||n.isCascaded))out=node('property',n,{'target':guardedAccesses[n]??(n.isCascaded?node('cascadeTarget',n,{'type':n.realTarget.staticType?.getDisplayString()}):expression(n.target!)),'name':n.propertyName.name,'reference':reference(n.propertyName.element),'targetType':n.realTarget.staticType?.getDisplayString(),'nullAware':n.isNullAware&&!n.isCascaded&&!guardedAccesses.containsKey(n)});
    else if(n is IndexExpression&&n.target!=null)out=node('index',n,{'target':guardedAccesses[n]??expression(n.target!),'index':expression(n.index),'targetType':guardedAccesses.containsKey(n)?n.target!.staticType?.getDisplayString().replaceFirst(RegExp(r'\?$'),''):n.target!.staticType?.getDisplayString(),'reference':reference(n.element),if(n.isNullAware&&!guardedAccesses.containsKey(n))'nullAware':true});
    else if(n is BinaryExpression)out=node('binary',n,{'operator':n.operator.lexeme,'reference':reference(n.element),'left':expression(n.leftOperand),'right':expression(n.rightOperand),...operatorArgument(n)});
    else if(n is PatternAssignment){var pattern=n.pattern;while(pattern is ParenthesizedPattern){pattern=pattern.pattern;}if(pattern is! RecordPattern)return unsupported(n);out=node('recordAssignment',n,{'value':expression(n.expression),'pattern':recordAssignmentPattern(pattern)});}
    else if(n is AssignmentExpression)out=node('assignment',n,{'operator':n.operator.lexeme,'left':writeTarget(n.leftHandSide,n.writeElement,n.writeType),'right':expression(n.rightHandSide),if(n.operator.lexeme=='??='&&n.leftHandSide is IndexExpression&&n.readType!=null)'indexedRead':{'reference':reference(n.readElement),'type':resolvedType(n.readType!)}});
    else if(n is PrefixExpression||n is PostfixExpression){final operand=n is PrefixExpression?n.operand:(n as PostfixExpression).operand,operator=n is PrefixExpression?n.operator.lexeme:(n as PostfixExpression).operator.lexeme;out=node(n is PrefixExpression?'prefix':'postfix',n,{'operator':operator,'reference':reference(n is PrefixExpression?n.element:(n as PostfixExpression).element),'value':['++','--'].contains(operator)&&n is CompoundAssignmentExpression?writeTarget(operand,n.writeElement,n.writeType):expression(operand)});}
    else if(n is ConditionalExpression)out=node('conditional',n,{'test':expression(n.condition),'then':expression(n.thenExpression),'else':expression(n.elseExpression)});
    else if(n is MethodInvocation&&n.methodName.name=='call'&&n.target?.staticType is FunctionType&&!n.isCascaded)out=node('invoke',n,{'target':guardedAccesses[n]??expression(n.target!),'signature':{...resolvedType(n.target!.staticType!),if(guardedAccesses.containsKey(n))'nullable':false},'nullAware':n.isNullAware&&!guardedAccesses.containsKey(n),'args':arguments(n.argumentList),if((n.target!.staticType as FunctionType).typeParameters.isNotEmpty)'resolvedTypeArguments':n.typeArgumentTypes?.map(resolvedType).toList(),'typeArguments':n.typeArguments?.arguments.map((t)=>resolvedType(t.type!)).toList()??[]});
    else if(n is MethodInvocation)out=node('call',n,{'target':guardedAccesses[n]??(n.isCascaded?node('cascadeTarget',n,{'type':n.realTarget?.staticType?.getDisplayString()}):n.target==null?null:expression(n.target!)),'nullAware':n.isNullAware&&!n.isCascaded&&!guardedAccesses.containsKey(n),'name':n.methodName.name,'reference':reference(n.methodName.element),'args':arguments(n.argumentList),'typeArguments':n.typeArguments?.arguments.map((t)=>resolvedType(t.type!)).toList()??[],if(n.methodName.element case ExecutableElement(:final type) when type.typeParameters.isNotEmpty)'resolvedTypeArguments':n.typeArgumentTypes?.map(resolvedType).toList()});
    else if(n is InstanceCreationExpression)out=node('construct',n,{'name':n.constructorName.type.toSource(),'constructor':n.constructorName.name?.name,'reference':reference(n.constructorName.element),'args':arguments(n.argumentList),'const':n.isConst,'constructedType':resolvedType(n.staticType!)});
    else if(n is ListLiteral&&!n.elements.any((x)=>x is! Expression))out=node('list',n,{'elementType':resolvedType((n.staticType as InterfaceType).typeArguments.single),'constant':n.isConst,'values':n.elements.cast<Expression>().map(expression).toList()});
    else if(n is ListLiteral&&!n.isConst)out=node('collectionList',n,{'elementType':resolvedType((n.staticType as InterfaceType).typeArguments.single),'elements':n.elements.map(collectionElement).toList()});
    else if(n is SetOrMapLiteral&&(!n.isConst||n.elements.isEmpty||n.isMap||n.isSet&&n.elements.every((element)=>element is Expression))&&(n.isMap||n.isSet))out=node('collectionLiteral',n,{'collectionKind':n.isMap?'map':'set','collectionType':resolvedType(n.staticType!),'constant':n.isConst,'elements':n.elements.map(collectionElement).toList()});
    else if(n is RecordLiteral&&!n.isConst&&(n.staticType as RecordType).namedFields.isEmpty)out=node('recordLiteral',n,{'fields':n.fields.map((field)=>expression(field.fieldExpression)).toList()});
    else if(n is RecordLiteral&&!n.isConst){var index=0;out=node('namedRecordLiteral',n,{'shape':resolvedType(n.staticType!),'fields':n.fields.map((field)=>{'key':field is RecordLiteralNamedField?field.name.lexeme:index++,'value':expression(field.fieldExpression)}).toList()});}
    else return unsupported(n);
    final variable=n is SimpleIdentifier?n.element:null;
    // Preserve the declaration before member substitution and flow promotion.
    // A value read from T/Object/num storage can have a numeric static type yet
    // still require the erased-value ABI at the generated boundary.
    final storage=storageType(n),indexParameter=n is IndexExpression?n.element?.formalParameters.firstOrNull:null;
    return {...out,'type':n.staticType?.getDisplayString(),'numeric':n.staticType==null?null:numericSource(n.staticType!,inferred:true),if(storage!=null)'storageType':resolvedType(storage),if(indexParameter!=null)'indexParameterType':resolvedType(indexParameter.baseElement.type),if(indexParameter!=null)'appliedIndexParameterType':resolvedType(indexParameter.type),if(n.staticType is FunctionType) 'functionType':resolvedType(n.staticType!),if(n.staticType is RecordType)'recordType':resolvedType(n.staticType!),if(variable is VariableElement&&(variable is LocalVariableElement||variable is FormalParameterElement)&&n.staticType!=null&&n.staticType!=variable.type)'promotedType':resolvedType(n.staticType!)};
  }
  Map<String,Object?> writeTarget(Expression target,Element? element,DartType? type){
    if(target is IndexExpression&&target.isNullAware)return unsupported(target);
    final result=expression(target);
    if(result['kind']=='nullChain')return unsupported(target);
    if(target is SimpleIdentifier||target is PrefixedIdentifier||target is PropertyAccess||target is IndexExpression){
      if(element!=null)result['reference']=reference(element);
      if(type!=null){final base=element?.baseElement;final declared=base is VariableElement?base.type:base is ExecutableElement&&base.formalParameters.isNotEmpty?base.formalParameters.last.type:type;result['type']=type.getDisplayString();result['numeric']=numericSource(type,inferred:true);result['storageType']=resolvedType(declared);if(target is IndexExpression&&base is ExecutableElement&&base.formalParameters.isNotEmpty){result['indexParameterType']=resolvedType(base.formalParameters.first.type);}}
    }
    return result;
  }
  List<Map<String,Object?>> arguments(ArgumentList list)=>list.arguments.map((a){final parameter=a.correspondingParameter;return {'name':a is NamedArgument?a.name.lexeme:null,'value':expression(a.argumentExpression),if(parameter!=null)'parameterType':resolvedType(parameter.baseElement.type),if(parameter!=null)'appliedParameterType':resolvedType(parameter.type)};}).toList();
  Map<String,Object?> loopVariable(DeclaredIdentifier v)=>{'name':v.name.lexeme,'type':v.declaredFragment!.element.type.getDisplayString(),'resolvedType':resolvedType(v.declaredFragment!.element.type),'numeric':numericSource(v.declaredFragment!.element.type,inferred:v.type==null),'value':null};
  Map<String,Object?> collectionElement(CollectionElement n){
    if(n is Expression)return {'kind':'value','value':expression(n)};
    if(n is NullAwareElement)return {'kind':'nullAwareValue','value':expression(n.value)};
    if(n is MapLiteralEntry)return {'kind':n.keyQuestion!=null||n.valueQuestion!=null?'nullAwareEntry':'entry','key':expression(n.key),'value':expression(n.value),if(n.keyQuestion!=null||n.valueQuestion!=null)'keyNullAware':n.keyQuestion!=null,if(n.keyQuestion!=null||n.valueQuestion!=null)'valueNullAware':n.valueQuestion!=null};
    if(n is SpreadElement)return {'kind':'spread','value':expression(n.expression),'nullAware':n.isNullAware};
    if(n is IfElement&&n.caseClause==null)return {'kind':'if','test':expression(n.expression),'then':collectionElement(n.thenElement),'else':n.elseElement==null?null:collectionElement(n.elseElement!)};
    if(n is IfElement&&n.caseClause!=null){final guarded=n.caseClause!.guardedPattern;return {'kind':'ifCase','value':expression(n.expression),'pattern':matchPattern(guarded.pattern),'guard':guarded.whenClause==null?null:expression(guarded.whenClause!.expression),'then':collectionElement(n.thenElement),'else':n.elseElement==null?null:collectionElement(n.elseElement!)};}
    if(n is ForElement&&n.awaitKeyword==null&&n.forLoopParts is ForEachPartsWithDeclaration){final parts=n.forLoopParts as ForEachPartsWithDeclaration;return {'kind':'forEach','variable':loopVariable(parts.loopVariable),'final':parts.loopVariable.isFinal,'iterable':expression(parts.iterable),'body':collectionElement(n.body)};}
    if(n is ForElement&&n.awaitKeyword==null&&n.forLoopParts is ForPartsWithDeclarations){final parts=n.forLoopParts as ForPartsWithDeclarations;return {'kind':'for','variables':variables(parts.variables),'test':parts.condition==null?null:expression(parts.condition!),'updates':parts.updaters.map(expression).toList(),'body':collectionElement(n.body)};}
    return unsupported(n);
  }
  Map<String,Object?> variables(VariableDeclarationList n){return node('variables',n,{'final':n.isFinal||n.isConst,if(n.lateKeyword!=null)'late':true,'variables':n.variables.map((v)=>{'name':v.name.lexeme,'reference':reference(v.declaredFragment?.element),'type':v.declaredFragment?.element.type.getDisplayString(),'resolvedType':resolvedType(v.declaredFragment!.element.type),'numeric':numericSource(v.declaredFragment!.element.type,inferred:n.type==null),'value':v.initializer==null?null:expression(v.initializer!)}).toList()});}
  List<Map<String,Object?>> recordBindings(DartPattern pattern,DartType type,List<Object> path){
    if(pattern is DeclaredVariablePattern){final element=pattern.declaredFragment!.element,t=element.type;return [{'path':path,if(!element.library!.typeSystem.isSubtypeOf(type,t))'checkedType':resolvedType(t),'variable':{'name':pattern.name.lexeme,'type':t.getDisplayString(),'resolvedType':resolvedType(t),'numeric':numericSource(t,inferred:pattern.type==null),'value':null}}];}
    if(pattern is WildcardPattern){final checked=pattern.type?.type;return checked==null||typeSystem.isSubtypeOf(type,checked)?[]:[{'path':path,'discard':true,'checkedType':resolvedType(checked)}];}
    if(pattern is! RecordPattern||type is! RecordType||type.nullabilitySuffix==NullabilitySuffix.question||pattern.fields.length!=type.positionalFields.length+type.namedFields.length)return unsupported(pattern);
    final bindings=<Map<String,Object?>>[],seen=<String>{};var position=0;
    for(final field in pattern.fields){final Object key;final DartType fieldType;if(field.name==null){if(position>=type.positionalFields.length)return unsupported(field);key=position;fieldType=type.positionalFields[position++].type;}else{final name=field.effectiveName,found=type.namedFields.where((value)=>value.name==name).toList();if(name==null||found.length!=1||!seen.add(name))return unsupported(field);key=name;fieldType=found.single.type;}bindings.addAll(recordBindings(field.pattern,fieldType,[...path,key]));}return bindings;
  }
  Map<String,Object?> recordAssignmentPattern(DartPattern pattern){
    if(pattern is ParenthesizedPattern)return recordAssignmentPattern(pattern.pattern);
    if(pattern is AssignedVariablePattern){
      final element=pattern.element,matched=pattern.matchedValueType;
      if(element is! LocalVariableElement&&element is! FormalParameterElement||matched==null)return unsupported(pattern);
      final variable=element as VariableElement,type=variable.type;
      return {'kind':'target','target':{...node('identifier',pattern,{'name':variable.displayName,'reference':reference(variable),'type':type.getDisplayString(),'numeric':numericSource(type,inferred:false),'storageType':resolvedType(type)})},'matchedType':resolvedType(matched),'requiresCast':!variable.library!.typeSystem.isSubtypeOf(matched,type)};
    }
    if(pattern is WildcardPattern)return {'kind':'wildcard','checkedType':pattern.type==null?null:resolvedType(pattern.type!.type!)};
    if(pattern is CastPattern)return {'kind':'cast','checkedType':resolvedType(pattern.type.type!),'pattern':recordAssignmentPattern(pattern.pattern)};
    if(pattern is NullAssertPattern)return {'kind':'nullAssert','pattern':recordAssignmentPattern(pattern.pattern)};
    if(pattern is! RecordPattern)return unsupported(pattern);
    return recordPatternFields(pattern,recordAssignmentPattern);
  }
  Map<String,Object?> recordPatternFields(RecordPattern pattern,Map<String,Object?> Function(DartPattern) lower){
    if(pattern.fields.isEmpty)return unsupported(pattern);
    var arity=0;final names=<String>[],fields=<Object?>[];
    for(final field in pattern.fields){final Object key;if(field.name==null){key=arity++;}else{final name=field.effectiveName;if(name==null||names.contains(name))return unsupported(field);names.add(name);key=name;}fields.add({'key':key,'pattern':lower(field.pattern)});}
    return {'kind':'record','arity':arity,'names':names..sort(),'fields':fields};
  }
  Map<String,Object?> mapPatternKey(Expression key){
    final evaluation=key.computeConstantValue(),value=evaluation?.value;
    if(evaluation==null||evaluation.diagnostics.isNotEmpty||value==null||value.type==null)return unsupported(key);
    final type=value.type!,base={'type':type.getDisplayString(),'numeric':numericSource(type,inferred:true),'storageType':resolvedType(type)};
    Object? scalar;String tag;
    if(value.isNull){scalar=null;tag='Null';}
    else if(value.toStringValue() case final String text){scalar=text;tag='String';}
    else if(value.toBoolValue() case final bool boolean){scalar=boolean;tag='bool';}
    else if(value.toIntValue() case final int integer){if(integer < -9007199254740991||integer>9007199254740991)return unsupported(key);scalar=integer;tag='int';}
    else if(value.toDoubleValue() case final double number){if(!number.isFinite)return unsupported(key);scalar=number;tag='double';}
    else if(type is InterfaceType&&type.element is EnumElement){
      final ordinal=value.getField('index')?.toIntValue();
      final fields=(type.element as EnumElement).constants.where((field)=>field.computeConstantValue()?.getField('index')?.toIntValue()==ordinal).toList();
      if(ordinal==null||fields.length!=1)return unsupported(key);
      final field=fields.single;
      return {'key':{...node('identifier',key,{'name':field.displayName,'reference':reference(field)}),...base},'cacheKey':jsonEncode(['enum',reference(field)!['id']])};
    }
    else return unsupported(key);
    return {'key':{...node('literal',key,{'value':scalar,if(tag=='double'&&(scalar as double)==0&&scalar.isNegative)'negativeZero':true}),...base},'cacheKey':jsonEncode([tag,tag=='double'?(scalar as double).toString():scalar])};
  }
  Map<String,Object?> matchPattern(DartPattern pattern){
    if(pattern is ParenthesizedPattern)return matchPattern(pattern.pattern);
    if(pattern is RecordPattern)return recordPatternFields(pattern,matchPattern);
    if(pattern is LogicalAndPattern)return {'kind':'logicalAnd','left':matchPattern(pattern.leftOperand),'right':matchPattern(pattern.rightOperand)};
    if(pattern is RelationalPattern){
      final element=pattern.element,type=pattern.matchedValueType;
      if(element==null||type==null||type is DynamicType||element.formalParameters.length!=1||!['<','<=','>','>=','==','!='].contains(pattern.operator.lexeme))return unsupported(pattern);
      final returnType=element.returnType;
      if(returnType is! InterfaceType||returnType.nullabilitySuffix!=NullabilitySuffix.none||returnType.element.library.uri.toString()!='dart:core'||returnType.element.name!='bool')return unsupported(pattern);
      final parameter=element.formalParameters.single;
      return {'kind':'relational','operator':pattern.operator.lexeme,'reference':reference(element),'matchedType':resolvedType(type),'matchedTypeName':type.getDisplayString(),'operand':expression(pattern.operand),'cacheKey':mapPatternKey(pattern.operand)['cacheKey'],'parameterType':resolvedType(parameter.baseElement.type),'appliedParameterType':resolvedType(parameter.type),'returnType':resolvedType(returnType)};
    }
    if(pattern is ConstantPattern&&scalarPattern(pattern.expression))return {'kind':'constant','value':expression(pattern.expression)};
    if(pattern is ConstantPattern){
      final evaluation=pattern.expression.computeConstantValue(),constant=evaluation?.value,type=constant?.type;
      // The analyzer proves a known source object constant. Runtime equality
      // caches use its canonical identity, never a source name or display text.
      // SDK collections, records, functions and unknown environment values need
      // separately qualified constant representations.
      if(evaluation==null||evaluation.diagnostics.isNotEmpty||constant==null||!constant.hasKnownValue||type is! InterfaceType||type.nullabilitySuffix!=NullabilitySuffix.none||type.element.library.uri.scheme=='dart')return unsupported(pattern);
      return {'kind':'objectConstant','value':expression(pattern.expression),'constantType':resolvedType(type)};
    }
    if(pattern is NullCheckPattern)return {'kind':'nullCheck','pattern':matchPattern(pattern.pattern)};
    if(pattern is LogicalOrPattern)return {'kind':'logicalOr','left':matchPattern(pattern.leftOperand),'right':matchPattern(pattern.rightOperand)};
    if(pattern is DeclaredVariablePattern){final element=pattern.declaredFragment!.element,t=element.type;return {'kind':'variable','final':element.isFinal,'checkedType':pattern.type==null?null:resolvedType(pattern.type!.type!),'variable':{'name':pattern.name.lexeme,'reference':reference(element),'type':t.getDisplayString(),'resolvedType':resolvedType(t),'numeric':numericSource(t,inferred:pattern.type==null),'value':null}};}
    if(pattern is WildcardPattern)return {'kind':'wildcard','checkedType':pattern.type==null?null:resolvedType(pattern.type!.type!)};
    if(pattern is MapPattern){
      final type=pattern.requiredType;
      if(pattern.elements.isEmpty||type is! InterfaceType||type.element.library.uri.toString()!='dart:core'||type.element.name!='Map'||type.typeArguments.length!=2)return unsupported(pattern);
      final entries=<Object?>[];
      for(final element in pattern.elements){
        if(element is! MapPatternEntry)return unsupported(element);
        entries.add({...mapPatternKey(element.key),'pattern':matchPattern(element.value)});
      }
      return {'kind':'map','type':resolvedType(type),'explicitTypes':pattern.typeArguments!=null,'entries':entries};
    }
    if(pattern is ObjectPattern){
      final type=pattern.type.type;if((type is! InterfaceType&&!(type is TypeParameterType&&pattern.fields.isEmpty))||type!.nullabilitySuffix==NullabilitySuffix.question)return unsupported(pattern);
      final fields=<Object?>[],names=<String>{};for(final field in pattern.fields){
        final element=field.element,t=field.pattern.matchedValueType,name=field.effectiveName;
        if(element is! GetterElement||element.isStatic||t==null||name==null||!names.add(name))return unsupported(field);
        fields.add({'name':name,'reference':reference(element),'type':t.getDisplayString(),'numeric':numericSource(t,inferred:true),'resolvedType':resolvedType(t),'storageType':resolvedType(element.baseElement.returnType),'pattern':matchPattern(field.pattern)});
      }
      return {'kind':'object','type':resolvedType(type),'fields':fields};
    }
    return unsupported(pattern);
  }
  Map<String,Object?> sourceLabel(LabelElement? element,AstNode node){
    if(element==null||element.firstFragment.nameOffset==null)return unsupported(node);
    return {'id':'${element.library.uri}::label@${element.firstFragment.nameOffset}','name':element.displayName};
  }
  bool scalarCaseCoverage(InterfaceType type,List<Expression?> tests){
    if(tests.any((test)=>test==null))return true;
    final expected=<String>{},seen=<String>{},element=type.element;
    final ordinals=<int,String>{};
    if(element is EnumElement){
      for(final field in element.constants){
        final ordinal=field.computeConstantValue()?.getField('index')?.toIntValue();
        if(ordinal==null||ordinals.containsKey(ordinal))return false;
        final id=reference(field.getter)!['id'] as String;ordinals[ordinal]=id;expected.add(id);
      }
    }else if(element.library.uri.toString()=='dart:core'&&element.name=='bool'){
      expected.addAll(['bool:true','bool:false']);
    }else{return false;}
    if(expected.isEmpty)return false;
    if(type.nullabilitySuffix==NullabilitySuffix.question)expected.add('null');
    for(final test in tests){
      final evaluation=test!.computeConstantValue(),value=evaluation?.value;
      if(evaluation==null||evaluation.diagnostics.isNotEmpty||value==null||!value.hasKnownValue)continue;
      if(value.isNull){seen.add('null');continue;}
      final actual=value.type;
      if(actual is! InterfaceType||actual.element!=element)continue;
      if(element is EnumElement){final id=ordinals[value.getField('index')?.toIntValue()];if(id!=null)seen.add(id);}
      else if(value.toBoolValue() case final bool boolean){seen.add('bool:$boolean');}
    }
    return seen.containsAll(expected);
  }
  Map<String,Object?> statement(Statement n){
    if(n is EmptyStatement)return node('empty',n,{});
    if(n is Block)return node('block',n,{'statements':n.statements.map(statement).toList()});
    if(n is ReturnStatement)return node('return',n,{'value':n.expression==null?null:expression(n.expression!)});
    if(n is ExpressionStatement)return node('expression',n,{'value':expression(n.expression)});
    if(n is VariableDeclarationStatement)return variables(n.variables);
    if(n is PatternVariableDeclarationStatement){final declaration=n.declaration,type=declaration.expression.staticType!;if(declaration.pattern is! RecordPattern)return unsupported(n);return node('recordVariables',n,{'final':declaration.keyword.lexeme=='final','value':expression(declaration.expression),'recordType':resolvedType(type),'bindings':recordBindings(declaration.pattern,type,[])});}
    if(n is FunctionDeclarationStatement&&n.functionDeclaration.functionExpression.typeParameters==null){
      final declaration=n.functionDeclaration,type=declaration.functionExpression.staticType!;
      return node('variables',n,{'final':true,'variables':[{'name':declaration.name.lexeme,'type':type.getDisplayString(),'resolvedType':resolvedType(type),'numeric':numericSource(type,inferred:declaration.returnType==null),'value':expression(declaration.functionExpression)}]});
    }
    if(n is IfStatement&&n.caseClause==null)return node('if',n,{'test':expression(n.expression),'then':statement(n.thenStatement),'else':n.elseStatement==null?null:statement(n.elseStatement!)});
    if(n is IfStatement&&n.caseClause!=null){final pattern=n.caseClause!.guardedPattern;return node('ifCase',n,{'value':expression(n.expression),'pattern':matchPattern(pattern.pattern),'guard':pattern.whenClause==null?null:expression(pattern.whenClause!.expression),'then':statement(n.thenStatement),'else':n.elseStatement==null?null:statement(n.elseStatement!)});}
    if(n is WhileStatement)return node('while',n,{'test':expression(n.condition),'body':statement(n.body)});
    if(n is DoStatement)return node('do',n,{'test':expression(n.condition),'body':statement(n.body)});
    if(n is LabeledStatement)return node('labeled',n,{'labels':n.labels.map((label)=>sourceLabel(label.declaredFragment?.element,label)).toList(),'body':statement(n.statement)});
    if(n is ForStatement&&n.awaitKeyword==null&&n.forLoopParts is ForEachPartsWithDeclaration){final parts=n.forLoopParts as ForEachPartsWithDeclaration;return node('forEach',n,{'variable':loopVariable(parts.loopVariable),'final':parts.loopVariable.isFinal,'iterable':expression(parts.iterable),'body':statement(n.body)});}
    if(n is BreakStatement)return node('break',n,{if(n.label!=null)'label':sourceLabel(n.label!.element,n.label!)});
    if(n is ContinueStatement)return node('continue',n,{if(n.label!=null)'label':sourceLabel(n.label!.element,n.label!)});
    if(n is TryStatement)return node('try',n,{'body':statement(n.body),'catches':n.catchClauses.map((clause)=>{'type':clause.exceptionType==null?null:resolvedType(clause.exceptionType!.type!),'exception':clause.exceptionParameter?.name.lexeme,'stack':clause.stackTraceParameter?.name.lexeme,'body':statement(clause.body)}).toList(),'finally':n.finallyBlock==null?null:statement(n.finallyBlock!)});
    if(n is SwitchStatement){
      if(n.members.any((member)=>member.labels.isNotEmpty)){
        final type=n.expression.staticType;
        if(type is! InterfaceType||!(type.element is EnumElement||type.element.library.uri.toString()=='dart:core'&&['String','bool','int','double'].contains(type.element.name)))return unsupported(n);
        final cases=<Object?>[],coverageTests=<Expression?>[];
        for(final member in n.members){
          List<Expression?> tests;
          if(member is SwitchCase&&scalarPattern(member.expression)){tests=[member.expression];}
          else if(member is SwitchPatternCase&&member.guardedPattern.whenClause==null&&legacyScalarMatch(member.guardedPattern.pattern)){final pattern=member.guardedPattern.pattern;tests=pattern is WildcardPattern&&pattern.type==null?[null]:scalarAlternatives(pattern);}
          else if(member is SwitchDefault){tests=[null];}
          else return unsupported(member);
          coverageTests.addAll(tests);
          cases.add({'tests':tests.map((value)=>value==null?null:expression(value)).toList(),'labels':member.labels.map((label)=>sourceLabel(label.declaredFragment?.element,label)).toList(),'statements':member.statements.map(statement).toList()});
        }
        return node('caseSwitch',n,{'value':expression(n.expression),'exhaustive':scalarCaseCoverage(type,coverageTests),'cases':cases});
      }
      if(n.members.any((member)=>member is SwitchPatternCase&&(member.guardedPattern.whenClause!=null||(n.expression.staticType is RecordType?!legacyRecordSelector(member.guardedPattern.pattern,n.expression.staticType!):!legacyScalarMatch(member.guardedPattern.pattern))))){
        final cases=<Object?>[];for(final member in n.members){
          if(member.labels.isNotEmpty)return unsupported(member);
          if(member is SwitchPatternCase){final guarded=member.guardedPattern;cases.add({'pattern':matchPattern(guarded.pattern),'guard':guarded.whenClause==null?null:expression(guarded.whenClause!.expression),'statements':member.statements.map(statement).toList()});}
          else if(member is SwitchDefault)cases.add({'pattern':null,'guard':null,'statements':member.statements.map(statement).toList()});
          else if(member is SwitchCase&&scalarPattern(member.expression))cases.add({'pattern':{'kind':'constant','value':expression(member.expression)},'guard':null,'statements':member.statements.map(statement).toList()});
          else return unsupported(member);
        }
        return node('patternSwitch',n,{'value':expression(n.expression),'cases':cases});
      }
      if(n.expression.staticType is RecordType){
        final type=n.expression.staticType as RecordType;
        if(type.nullabilitySuffix==NullabilitySuffix.question||type.namedFields.isNotEmpty)return unsupported(n);
        final cases=<Object?>[];
        for(final member in n.members){
          if(member.labels.isNotEmpty)return unsupported(member);
          List<Map<String,Object?>>? tests;
          if(member is SwitchPatternCase&&member.guardedPattern.whenClause==null){if(member.guardedPattern.pattern is WildcardPattern&&(member.guardedPattern.pattern as WildcardPattern).type==null&&member!=n.members.last)return unsupported(member);tests=recordTests(member.guardedPattern.pattern,type,[]);}
          else if(member is! SwitchDefault)return unsupported(member);
          cases.add({'tests':tests,'statements':member.statements.map(statement).toList()});
        }
        return node('recordSwitch',n,{'value':expression(n.expression),'recordType':resolvedType(type),'cases':cases});
      }
      final cases=<Object?>[];
      for(final member in n.members){
        if(member.labels.isNotEmpty)return unsupported(member);
        List<Expression?> tests;
        if(member is SwitchCase){if(!scalarPattern(member.expression))return unsupported(member);tests=[member.expression];}
        else if(member is SwitchPatternCase&&member.guardedPattern.whenClause==null){final pattern=member.guardedPattern.pattern;if(pattern is WildcardPattern&&pattern.type==null){if(member!=n.members.last)return unsupported(member);tests=[null];}else{tests=scalarAlternatives(pattern);}}
        else if(member is SwitchDefault){tests=[null];}
        else{return unsupported(member);}
        for(final test in tests){cases.add({'test':test==null?null:expression(test),'statements':member.statements.map(statement).toList()});}
      }
      final type=n.expression.staticType,seen=<String>{};
      for(final value in cases){final test=(value as Map)['test'];if(test==null){seen.add('default');}else if(test is Map){if(test['kind']=='literal')seen.add('literal:${test['value']}');else if(test['reference'] is Map)seen.add((test['reference'] as Map)['id'] as String);}}
      var exhaustive=seen.contains('default');
      if(type is InterfaceType){final element=type.element;final expected=element is EnumElement?element.constants.map((field)=>reference(field.getter)!['id'] as String).toSet():element.library.uri.toString()=='dart:core'&&element.name=='bool'?<String>{'literal:true','literal:false'}:<String>{};if(expected.isNotEmpty){if(type.nullabilitySuffix==NullabilitySuffix.question)expected.add('literal:null');exhaustive=exhaustive||seen.containsAll(expected);}}
      return node('switch',n,{'value':expression(n.expression),'cases':cases,'exhaustive':exhaustive});
    }
    if(n is AssertStatement)return node('assert',n,{'test':expression(n.condition),'message':n.message==null?null:expression(n.message!)});
    if(n is ForStatement&&n.forLoopParts is ForPartsWithDeclarations){final parts=n.forLoopParts as ForPartsWithDeclarations;return node('for',n,{'variables':variables(parts.variables),'test':parts.condition==null?null:expression(parts.condition!),'updates':parts.updaters.map(expression).toList(),'body':statement(n.body)});}
    return unsupported(n);
  }
  List<Map<String,Object?>> recordTests(DartPattern pattern,DartType type,List<int> path){
    if(pattern is WildcardPattern&&pattern.type==null)return [];
    if(pattern is ConstantPattern){
      final constant=pattern.expression,constantType=constant.staticType;
      if(type is RecordType||constantType is! InterfaceType||!(constantType.element is EnumElement||constantType.element.library.uri.toString()=='dart:core'&&['int','double','num','String','bool','Null'].contains(constantType.element.name)))return unsupported(pattern);
      return [{'path':path,'test':expression(constant)}];
    }
    if(pattern is! RecordPattern||type is! RecordType||type.nullabilitySuffix==NullabilitySuffix.question||type.namedFields.isNotEmpty||pattern.fields.length!=type.positionalFields.length)return unsupported(pattern);
    final tests=<Map<String,Object?>>[];
    for(var i=0;i<pattern.fields.length;i++){final field=pattern.fields[i];if(field.name!=null)return unsupported(field);tests.addAll(recordTests(field.pattern,type.positionalFields[i].type,[...path,i]));}
    return tests;
  }
  Map<String,Object?> body(FunctionBody n,{bool discardResult=false}){
    if(n.isGenerator)return unsupported(n);
    if(n is BlockFunctionBody)return {...statement(n.block),'async':n.isAsynchronous};
    if(n is ExpressionFunctionBody)return node('block',n,{'async':n.isAsynchronous,'statements':[node(discardResult?'expression':'return',n,{'value':expression(n.expression)})]});
    return unsupported(n);
  }
  Map<String,Object?>? parameterDefault(FormalParameter parameter){
    if(parameter.defaultClause!=null)return expression(parameter.defaultClause!.value);
    final element=parameter.declaredFragment!.element;
    final factoryDefault=inheritedDefaults[element.baseElement];
    if(factoryDefault!=null)return {...expression(factoryDefault.expression),'origin':factoryDefault.origin};
    if(element is! SuperFormalParameterElement)return null;
    final parent=element.superConstructorParameter;
    if(parent==null)return unsupported(parameter);
    if(parameter.isRequired||!parent.hasDefaultValue)return null;
    final constant=parent.computeConstantValue();
    if(constant==null)return unsupported(parameter);
    final function=constant.toFunctionValue();
    if(function!=null){
      final type=constant.type;
      if(!function.isStatic||function is ConstructorElement||function.typeParameters.isNotEmpty||type is! FunctionType||type.typeParameters.isNotEmpty)return unsupported(parameter);
      return {...node('identifier',parameter,{'name':function.displayName,'reference':reference(function)}),'type':type.getDisplayString(),'numeric':numericSource(type,inferred:true),'storageType':resolvedType(function.type),'functionType':resolvedType(type)};
    }
    final variable=constant.variable;
    if(variable is FieldElement&&variable.isEnumConstant)return {...node('identifier',parameter,{'name':variable.displayName,'reference':reference(variable)}),'type':element.type.getDisplayString(),'numeric':null};
    final value=constant.isNull?null:constant.toBoolValue()??constant.toDoubleValue()??constant.toIntValue()??constant.toStringValue();
    // Inherited object defaults must retain the analyzer's exact constant
    // variable identity. A new object or a guessed null changes source identity.
    if(value==null&&!constant.isNull&&variable is TopLevelVariableElement&&variable.isConst){
      return {...node('identifier',parameter,{'name':variable.displayName,'reference':reference(variable.getter)}),'type':element.type.getDisplayString(),'numeric':numericSource(element.type,inferred:true)};
    }
    if(value==null&&!constant.isNull){final original=inheritedDefaults[parent.baseElement];if(original==null)return unsupported(parameter);return {...expression(original.expression),'origin':original.origin};}
    if(value is double&&!value.isFinite)return unsupported(parameter);
    return {...node('literal',parameter,{'value':value}),'type':element.type.getDisplayString(),'numeric':numericSource(element.type,inferred:true)};
  }
  List<Map<String,Object?>> parameters(FormalParameterList? list)=>list?.parameters.map((v)=>{'name':v.declaredFragment!.element.displayName,'type':v.declaredFragment!.element.type.getDisplayString(),'resolvedType':resolvedType(v.declaredFragment!.element.type),'numeric':numericSource(v.declaredFragment!.element.type,inferred:inferredParameter(v)),'named':v.isNamed,'required':v.isRequired,'default':parameterDefault(v),'covariant':v.declaredFragment!.element.isCovariant}).toList()??[];
  Map<String,Object?> classDeclaration(ClassDeclaration n){
    // Class structure is independent of immutable value representations. Keep
    // unresolved mixin/interface and late-field semantics explicit.
    if(n.namePart is PrimaryConstructorDeclaration||n.augmentKeyword!=null||n.nativeClause!=null)return unsupported(n);
    final classElement=n.declaredFragment!.element;
    final inherited=<InterfaceType>[...classElement.mixins];
    for(var parent=classElement.supertype;parent!=null;parent=parent.element.supertype){inherited.add(parent);}
    final fields=<Object?>[],constructors=<ConstructorDeclaration>[],methods=<Object?>[];
    for(final member in n.body.members){
      if(member is ConstructorDeclaration){constructors.add(member);continue;}
      if(member is MethodDeclaration){
        if(member.isOperator&&!['==','[]','+','-','*','/','~/','%','<','>','<=','>=','&','|','^','<<','>>','>>>','~'].contains(member.name.lexeme)||member.externalKeyword!=null)return unsupported(member);
        final element=member.declaredFragment!.element;
        bool visible(ExecutableElement m)=>m.displayName==member.name.lexeme&&(!m.isPrivate||m.library==element.library);
        final overrideOrigins=member.isStatic?<ExecutableElement>[]:inherited.expand<ExecutableElement>((type)=>member.isGetter?type.element.getters:member.isSetter?type.element.setters:type.element.methods).where(visible).toList();
        final overrides=overrideOrigins.isNotEmpty;
        final isAbstract=member.body is EmptyFunctionBody;
        methods.add(node('classMethod',member,{'name':member.name.lexeme,'reference':reference(element),if(member.isOperator)'operator':true,if(member.typeParameters!=null)'typeParameters':member.typeParameters!.typeParameters.map((parameter){final element=parameter.declaredFragment!.element;return {'name':parameter.name.lexeme,'reference':reference(element),'bound':parameter.bound==null?null:resolvedType(element.bound!)};}).toList(),'static':member.isStatic,'getter':member.isGetter,'setter':member.isSetter,'abstract':isAbstract,'overrides':overrides,if(overrides)'overrideOrigins':overrideOrigins.map(reference).toList(),'returnType':resolvedType(element.returnType),'numericReturn':numericSource(element.returnType,inferred:member.returnType==null),'parameters':classParameters(member.parameters),'body':isAbstract?null:body(member.body,discardResult:element.returnType is VoidType)}));continue;
      }
      if(member is! FieldDeclaration||member.externalKeyword!=null||member.isStatic&&member.fields.lateKeyword!=null)return unsupported(member);
      for(final variable in member.fields.variables){
        final inheritedFields=member.isStatic?<FieldElement>[]:inherited.expand((type)=>type.element.fields).where((field)=>!field.isStatic&&field.name==variable.name.lexeme&&(!field.isPrivate||field.library==classElement.library)).toList();
        // Preserve exact accessor origins. Concrete accessor replacement uses a
        // separate qualified backing-storage policy in the emitter; genuine
        // inherited source fields still require a distinct storage lowering.
        if(inheritedFields.any((field)=>!field.isOriginGetterSetter))return unsupported(variable);
        final accessorOverrides=inheritedFields.expand<ExecutableElement>((field)=>[if(field.getter!=null)field.getter!,if(field.setter!=null)field.setter!]).map(reference).toList();
        final element=variable.declaredFragment!.element;
        fields.add({'name':variable.name.lexeme,'reference':reference(element),'type':resolvedType(element.type),'numeric':numericSource(element.type,inferred:member.fields.type==null),'final':member.fields.isFinal||member.fields.isConst,if(member.fields.lateKeyword!=null)'late':true,'static':member.isStatic,if(member.isStatic&&!member.fields.isConst)'lazyStatic':true,if(accessorOverrides.isNotEmpty)'accessorOverrides':accessorOverrides,'initializer':variable.initializer==null?null:expression(variable.initializer!),'offset':variable.offset,'length':variable.length});
      }
    }
    final unnamed=constructors.where((constructor)=>constructor.name==null).toList();
    if(unnamed.length>1)return unsupported(n);
    final unnamedFactory=unnamed.isNotEmpty&&unnamed.single.factoryKeyword!=null?unnamed.single:null,generative=constructors.where((ctor)=>ctor.factoryKeyword==null).toList();
    final factoryOwner=unnamedFactory!=null||constructors.isNotEmpty&&generative.isEmpty;
    final namedOnly=factoryOwner||unnamed.isEmpty&&constructors.isNotEmpty;
    final ctor=factoryOwner?generative.firstOrNull:namedOnly?generative.firstOrNull:unnamed.isEmpty?null:unnamed.single;
    if(ctor!=null&&(ctor.factoryKeyword!=null||ctor.externalKeyword!=null||ctor.redirectedConstructor!=null))return unsupported(ctor);
    final hasGenerativeRedirect=constructors.any((entry)=>entry.initializers.any((value)=>value is RedirectingConstructorInvocation));
    Map<String,Object?> generativeRedirect(RedirectingConstructorInvocation value){
      final target=value.element;
      if(target==null||target.isFactory||target.enclosingElement!=classElement)return unsupported(value);
      return {'reference':reference(target),'args':arguments(value.argumentList)};
    }
    final formals=classParameters(ctor?.parameters,includeReferences:hasGenerativeRedirect),initializers=<Map<String,Object?>>[];
    SuperConstructorInvocation? superInvocation;
    Map<String,Object?>? redirectInvocation;
    for(final initializer in ctor?.initializers??<ConstructorInitializer>[]){
      if(initializer is AssertInitializer)initializers.add(node('assert',initializer,{'test':expression(initializer.condition),'message':initializer.message==null?null:expression(initializer.message!)}));
      else if(initializer is ConstructorFieldInitializer)initializers.add({'kind':'field','field':reference(initializer.fieldName.element),'value':expression(initializer.expression)});
      else if(initializer is SuperConstructorInvocation)superInvocation=initializer;
      else if(initializer is RedirectingConstructorInvocation)redirectInvocation=generativeRedirect(initializer);
      else return unsupported(initializer);
    }
    Map<String,Object?>? constructorSuperclass(ConstructorDeclaration? entry, SuperConstructorInvocation? invocation){
      // A mixin application without `extends` still has a resolved Object base.
      // Preserve that constructor boundary; lowering requires the same exact
      // ordered host binding as an explicitly written superclass application.
      if(n.extendsClause==null&&n.withClause==null)return null;
      final type=classElement.supertype!,constructor=invocation?.element??entry?.declaredFragment?.element.superConstructor??classElement.unnamedConstructor?.superConstructor??type.element.unnamedConstructor;
      if(constructor==null||constructor.isFactory)return unsupported(n);
      final explicit=invocation==null?<Map<String,Object?>>[]:arguments(invocation.argumentList),forwarded=<Map<String,Object?>>[];
      for(final parameter in entry?.parameters.parameters??<FormalParameter>[]){
        final element=parameter.declaredFragment!.element;
        if(element is! SuperFormalParameterElement)continue;
        final parent=element.superConstructorParameter;if(parent==null)return unsupported(parameter);
        if(!parent.isNamed&&explicit.any((argument)=>argument['name']==null))return unsupported(parameter);
        final numeric=numericSource(element.type,inferred:true);
        forwarded.add({'name':parent.isNamed?parent.name:null,if(numeric!=null)'parameterType':resolvedType(parent.baseElement.type),if(numeric!=null)'appliedParameterType':resolvedType(parent.type),'value':{...node('identifier',parameter,{'name':element.displayName,'reference':reference(element)}),'type':element.type.getDisplayString(),'numeric':numeric,if(numeric!=null)'storageType':resolvedType(element.type)}});
      }
      return {'type':resolvedType(type),'constructor':reference(constructor),'implicit':invocation==null,'args':[...forwarded.where((argument)=>argument['name']==null),...explicit,...forwarded.where((argument)=>argument['name']!=null)]};
    }
    final superclass=factoryOwner&&ctor==null?null:constructorSuperclass(ctor,superInvocation);
    final assertions=initializers.where((initializer)=>initializer['kind']=='assert').toList();
    final typeParameters=n.namePart.typeParameters?.typeParameters.map((parameter){final element=parameter.declaredFragment!.element;return {'name':parameter.name.lexeme,'reference':reference(element),'bound':parameter.bound==null?null:resolvedType(element.bound!)};}).toList()??[];
    final named=<Object?>[];Map<String,Object?>? factoryEntry;
    for(final constructor in constructors.where((constructor)=>constructor.name!=null||constructor==unnamedFactory)){
      final entryName=constructor.name?.lexeme??'new';
      if(constructor.externalKeyword!=null)return unsupported(constructor);
      final redirect=constructor.redirectedConstructor;
      if(redirect!=null){
        if(constructor.factoryKeyword==null||constructor.initializers.isNotEmpty||redirect.element==null)return unsupported(constructor);
        final target=redirect.element!,positional=target.formalParameters.where((value)=>!value.isNamed).toList();var position=0;
        final args=constructor.parameters.parameters.map((p){final element=p.declaredFragment!.element;final matches=p.isNamed?target.formalParameters.where((value)=>value.isNamed&&value.name==element.displayName).toList():position<positional.length?<FormalParameterElement>[positional[position++]]:<FormalParameterElement>[];if(matches.length!=1)return unsupported(p);final parameter=matches.single;return {'name':p.isNamed?element.displayName:null,'parameterType':resolvedType(parameter.baseElement.type),'appliedParameterType':resolvedType(parameter.type),'value':{...node('identifier',p,{'name':element.displayName,'reference':reference(element)}),'type':element.type.getDisplayString(),'numeric':numericSource(element.type,inferred:inferredParameter(p)),'storageType':resolvedType(element.type)}};}).toList();
        final entry=node('namedConstructor',constructor,{'name':entryName,'reference':reference(constructor.declaredFragment!.element),'factory':true,'superclass':null,'parameters':classParameters(constructor.parameters),'initializers':[],'body':null,'const':constructor.constKeyword!=null,'redirect':{'reference':reference(target),'type':resolvedType(redirect.type.type!),'name':redirect.name?.name,'args':args}});if(constructor==unnamedFactory){factoryEntry=entry;}else{named.add(entry);}continue;
      }
      final initializers=<Object?>[];
      SuperConstructorInvocation? namedSuper;
      Map<String,Object?>? namedRedirect;
      for(final initializer in constructor.initializers){
        if(initializer is AssertInitializer)initializers.add(node('assert',initializer,{'test':expression(initializer.condition),'message':initializer.message==null?null:expression(initializer.message!)}));
        else if(initializer is ConstructorFieldInitializer)initializers.add({'kind':'field','field':reference(initializer.fieldName.element),'value':expression(initializer.expression)});
        else if(initializer is SuperConstructorInvocation)namedSuper=initializer;
        else if(initializer is RedirectingConstructorInvocation)namedRedirect=generativeRedirect(initializer);
        else return unsupported(initializer);
      }
      final factory=constructor.factoryKeyword!=null;
      final entry=node('namedConstructor',constructor,{'name':entryName,'reference':reference(constructor.declaredFragment!.element),'factory':factory,if(factoryOwner&&constructor==ctor)'physicalAnchor':true,'superclass':factory?null:constructorSuperclass(constructor,namedSuper),'parameters':classParameters(constructor.parameters,includeReferences:hasGenerativeRedirect),'initializers':initializers,'body':constructor.body is EmptyFunctionBody?null:body(constructor.body),'const':constructor.constKeyword!=null,if(namedRedirect!=null)'generativeRedirect':namedRedirect});if(constructor==unnamedFactory){factoryEntry=entry;}else{named.add(entry);}
    }
    return node('class',n,{'name':n.namePart.typeName.lexeme,'reference':reference(classElement),if(n.mixinKeyword!=null)'mixinClass':true,if(factoryOwner)'sourceFactories':{'unnamed':factoryEntry,'generativeAnchor':ctor!=null,'nominalSuperclass':classElement.supertype==null?null:resolvedType(classElement.supertype!)},'abstract':classElement.isAbstract,if(namedOnly)'namedOnly':true,'interfaces':classElement.interfaces.map(resolvedType).toList(),'mixins':classElement.mixins.map(resolvedType).toList(),'superclass':superclass,'typeParameters':typeParameters,'fields':fields,'constructor':{'parameters':formals,'assertions':assertions,'initializers':initializers,'reference':reference(ctor?.declaredFragment!.element??(factoryOwner?null:classElement.unnamedConstructor)),'body':ctor==null||ctor.body is EmptyFunctionBody?null:body(ctor.body),'const':ctor?.constKeyword!=null,'offset':ctor?.offset??n.offset,'length':ctor?.length??0,if(redirectInvocation!=null)'generativeRedirect':redirectInvocation},'methods':methods,'namedConstructors':named});
  }
  List<Map<String,Object?>> classParameters(FormalParameterList? list,{bool includeReferences=false}){
    if(list==null)return [];
    return list.parameters.indexed.map((entry){final element=entry.$2.declaredFragment!.element;return {...parameters(list)[entry.$1],'field':element is FieldFormalParameterElement?reference(element.field):null,'resolvedType':resolvedType(element.type),if(includeReferences)'reference':reference(element)};}).toList();
  }
  Map<String,Object?> mixinInterface(MixinDeclaration n){
    if(n.augmentKeyword!=null||n.baseKeyword!=null)return unsupported(n);
    if(n.onClause!=null||n.implementsClause!=null||n.body.members.any((member)=>member is! MethodDeclaration||member.isStatic||member.body is! EmptyFunctionBody)){
      final element=n.declaredFragment!.element,fields=<Object?>[],methods=<Object?>[];
      for(final member in n.body.members){
        if(member is MethodDeclaration){methods.add(bodyMember(member,element.allSupertypes));continue;}
        if(member is! FieldDeclaration||member.externalKeyword!=null||member.isStatic&&member.fields.lateKeyword!=null)return unsupported(member);
        for(final variable in member.fields.variables){final field=variable.declaredFragment!.element;fields.add({'name':variable.name.lexeme,'reference':reference(field),'type':resolvedType(field.type),'numeric':numericSource(field.type,inferred:member.fields.type==null),'final':member.fields.isFinal||member.fields.isConst,if(member.fields.lateKeyword!=null)'late':true,'static':member.isStatic,if(member.isStatic&&!member.fields.isConst)'lazyStatic':true,'initializer':variable.initializer==null?null:expression(variable.initializer!),'offset':variable.offset,'length':variable.length});}
      }
      return node('mixin',n,{'name':n.name.lexeme,'reference':reference(element),if(n.typeParameters!=null)'typeParameters':n.typeParameters!.typeParameters.map((p){final element=p.declaredFragment!.element;return {'name':p.name.lexeme,'reference':reference(element),'bound':p.bound==null?null:resolvedType(element.bound!)};}).toList(),if(n.onClause!=null)'onConstraints':element.superclassConstraints.map(resolvedType).toList(),if(n.implementsClause!=null)'interfaces':element.interfaces.map(resolvedType).toList(),if(fields.isNotEmpty)'fields':fields,'methods':methods});
    }
    final methods=<Object?>[];
    for(final member in n.body.members){
      if(member is! MethodDeclaration||member.body is! EmptyFunctionBody||member.isStatic||member.isGetter||member.isSetter||member.isOperator||member.typeParameters!=null||member.externalKeyword!=null)return unsupported(member);
      final element=member.declaredFragment!.element;
      methods.add(node('classMethod',member,{'name':member.name.lexeme,'reference':reference(element),'static':false,'getter':false,'setter':false,'abstract':true,'overrides':false,'returnType':resolvedType(element.returnType),'numericReturn':numericSource(element.returnType,inferred:member.returnType==null),'parameters':classParameters(member.parameters),'body':null}));
    }
    final typeParameters=n.typeParameters?.typeParameters.map((parameter){final element=parameter.declaredFragment!.element;return {'name':parameter.name.lexeme,'reference':reference(element),'bound':parameter.bound==null?null:resolvedType(element.bound!)};}).toList()??[];
    return node('mixinInterface',n,{'name':n.name.lexeme,'reference':reference(n.declaredFragment!.element),'typeParameters':typeParameters,'methods':methods});
  }
  Map<String,Object?> bodyMember(MethodDeclaration member,List<InterfaceType> inherited){
    if(member.isOperator&&!['==','[]','+','-','*','/','~/','%','<','>','<=','>=','&','|','^','<<','>>','>>>','~'].contains(member.name.lexeme)||member.externalKeyword!=null)return unsupported(member);
    final element=member.declaredFragment!.element;
    bool visible(ExecutableElement m)=>m.displayName==member.name.lexeme&&(!m.isPrivate||m.library==element.library);
    final origins=member.isStatic?<ExecutableElement>[]:inherited.expand<ExecutableElement>((type)=>member.isGetter?type.element.getters:member.isSetter?type.element.setters:type.element.methods).where(visible).toList();
    final isAbstract=member.body is EmptyFunctionBody;
    return node('classMethod',member,{'name':member.name.lexeme,'reference':reference(element),if(member.isOperator)'operator':true,if(member.typeParameters!=null)'typeParameters':member.typeParameters!.typeParameters.map((parameter){final element=parameter.declaredFragment!.element;return {'name':parameter.name.lexeme,'reference':reference(element),'bound':parameter.bound==null?null:resolvedType(element.bound!)};}).toList(),'static':member.isStatic,'getter':member.isGetter,'setter':member.isSetter,'abstract':isAbstract,'overrides':origins.isNotEmpty,if(origins.isNotEmpty)'overrideOrigins':origins.map(reference).toList(),'returnType':resolvedType(element.returnType),'numericReturn':numericSource(element.returnType,inferred:member.returnType==null),'parameters':classParameters(member.parameters),'body':isAbstract?null:body(member.body,discardResult:element.returnType is VoidType)});
  }
  Map<String,Object?> declaration(AstNode n,String symbol){
    if(n is EnumDeclaration){
      final element=n.declaredFragment!.element;
      if(n.augmentKeyword!=null||n.implementsClause!=null||element.typeParameters.isNotEmpty||n.body.constants.any((c)=>c.arguments!=null||c.augmentKeyword!=null))return unsupported(n);
      final methods=<Object?>[],fields=<Object?>[];
      for(final member in n.body.members){
        if(member is MethodDeclaration){if(member.body is EmptyFunctionBody||['index','name','values','toString'].contains(member.name.lexeme))return unsupported(member);methods.add(bodyMember(member,element.allSupertypes));continue;}
        if(member is! FieldDeclaration||!member.isStatic||!member.fields.isConst||member.externalKeyword!=null)return unsupported(member);
        for(final variable in member.fields.variables){final field=variable.declaredFragment!.element;fields.add({'name':variable.name.lexeme,'reference':reference(field),'type':resolvedType(field.type),'numeric':numericSource(field.type,inferred:member.fields.type==null),'final':true,'static':true,'initializer':variable.initializer==null?null:expression(variable.initializer!),'offset':variable.offset,'length':variable.length});}
      }
      final index=element.allSupertypes.where((t)=>t.element.library.uri.toString()=='dart:core'&&t.element.name=='Enum').single.element.getters.singleWhere((g)=>g.name=='index');
      return node('enum',n,{'name':n.namePart.typeName.lexeme,'reference':reference(element),'indexType':resolvedType(index.returnType),'numericIndex':numericSource(index.returnType,inferred:false),if(element.mixins.isNotEmpty)'mixins':element.mixins.map(resolvedType).toList(),if(methods.isNotEmpty)'methods':methods,if(fields.isNotEmpty)'fields':fields,'values':n.body.constants.map((c){final field=c.declaredFragment!.element;final ordinal=field.computeConstantValue()?.getField('index')?.toIntValue();if(ordinal==null)return unsupported(c);return node('enumValue',c,{'name':c.name.lexeme,'reference':reference(field),'index':ordinal});}).toList()});
    }
    if(n is TypeAlias)return typeAliasDeclaration(n);
    if(n is ClassDeclaration)return classDeclaration(n);
    if(n is MixinDeclaration)return mixinInterface(n);
    if(n is FunctionDeclaration&&n.isGetter){
      if(n.externalKeyword!=null||n.functionExpression.typeParameters!=null||n.functionExpression.parameters!=null)return unsupported(n);
      final element=n.declaredFragment!.element;
      return node('topGetter',n,{'name':symbol,'reference':reference(element),'returnType':element.returnType.getDisplayString(),'resolvedReturnType':resolvedType(element.returnType),'numericReturn':numericSource(element.returnType,inferred:n.returnType==null),'body':body(n.functionExpression.body)});
    }
    if(n is FunctionDeclaration&&!n.isGetter&&!n.isSetter)return node('function',n,{'name':symbol,'reference':reference(n.declaredFragment?.element),if(n.functionExpression.typeParameters!=null)'typeParameters':n.functionExpression.typeParameters!.typeParameters.map((parameter){final element=parameter.declaredFragment!.element;return {'name':parameter.name.lexeme,'reference':reference(element),'bound':parameter.bound==null?null:resolvedType(element.bound!)};}).toList(),'returnType':n.declaredFragment!.element.returnType.getDisplayString(),'resolvedReturnType':resolvedType(n.declaredFragment!.element.returnType),'numericReturn':numericSource(n.declaredFragment!.element.returnType,inferred:n.returnType==null),'parameters':parameters(n.functionExpression.parameters),'body':body(n.functionExpression.body,discardResult:n.declaredFragment!.element.returnType is VoidType)});
    if(n is MethodDeclaration&&!n.isOperator&&!n.isGetter&&!n.isSetter&&n.isStatic)return node('method',n,{'name':n.name.lexeme,'owner':symbol.split('.').first,'reference':reference(n.declaredFragment?.element),if(n.typeParameters!=null)'typeParameters':n.typeParameters!.typeParameters.map((parameter){final element=parameter.declaredFragment!.element;return {'name':parameter.name.lexeme,'reference':reference(element),'bound':parameter.bound==null?null:resolvedType(element.bound!)};}).toList(),'returnType':n.declaredFragment!.element.returnType.getDisplayString(),'resolvedReturnType':resolvedType(n.declaredFragment!.element.returnType),'numericReturn':numericSource(n.declaredFragment!.element.returnType,inferred:n.returnType==null),'parameters':parameters(n.parameters),'body':body(n.body,discardResult:n.declaredFragment!.element.returnType is VoidType)});
    if(n is VariableDeclaration&&n.initializer!=null){final type=n.declaredFragment!.element.type;return node('constant',n,{'name':n.name.lexeme,'owner':symbol.contains('.')?symbol.split('.').first:null,'reference':reference(n.declaredFragment?.element),'type':type.getDisplayString(),if(type is InterfaceType&&type.typeArguments.isNotEmpty)'resolvedType':resolvedType(type),'numeric':numericSource(type,inferred:(n.parent as VariableDeclarationList).type==null),'value':expression(n.initializer!)});}
    return unsupported(n);
  }
}
Future<void> main(List<String> args) async {
  if(args.length!=3)throw ArgumentError('body_ir <source-root> <request.json> <output.json>');
  final root=p.canonicalize(args[0]),requests=(jsonDecode(File(args[1]).readAsStringSync()) as List).cast<Map<String,dynamic>>();
  final sdk=p.dirname(p.dirname(Platform.resolvedExecutable));
  final toolConfig=File(p.join(p.dirname(p.dirname(Platform.script.toFilePath())),'.dart_tool','package_config.json'));
  final config=jsonDecode(toolConfig.readAsStringSync()) as Map<String,dynamic>;
  final lock=loadYaml(File(p.join(p.dirname(toolConfig.parent.path),'pubspec.lock')).readAsStringSync()) as Map;
  final packages=(config['packages'] as List).cast<Map<String,dynamic>>().map((item)=>{...item,'rootUri':toolConfig.uri.resolve(item['rootUri'] as String).toString()}).toList();
  final sky=p.join(p.dirname(p.absolute(args[2])),'sky_engine');Directory(p.join(sky,'lib')).createSync(recursive:true);
  final metadata=jsonDecode(File(p.join(sdk,'lib','libraries.json')).readAsStringSync()) as Map<String,dynamic>,embedded=<String,String>{};
  for(final platform in metadata.values.whereType<Map<String,dynamic>>()){
    final libraries=platform['libraries'];if(libraries is! Map)continue;
    for(final entry in libraries.entries){final value=entry.value;if(value is Map&&value['uri'] is String)embedded.putIfAbsent('dart:${entry.key}',()=>p.join(sdk,'lib',value['uri'] as String));}
  }
  embedded['dart:ui']=p.join(root,'engine/src/flutter/lib/ui/ui.dart');
  embedded['dart:ui_web']=p.join(root,'engine/src/flutter/lib/web_ui/lib/ui_web/src/ui_web.dart');
  File(p.join(sky,'lib/_embedder.yaml')).writeAsStringSync('embedded_libs:\n${embedded.entries.map((e)=>'  ${jsonEncode(e.key)}: ${jsonEncode(e.value.replaceAll('\\', '/'))}').join('\n')}\n');
  for(final name in ['flutter','flutter_localizations'])packages.add({'name':name,'rootUri':Directory(p.join(root,'packages',name)).uri.toString(),'packageUri':'lib/','languageVersion':'3.13'});
  packages.add({'name':'sky_engine','rootUri':Directory(sky).uri.toString(),'packageUri':'lib/','languageVersion':'3.13'});
  final rootConfig=File(p.join(root,'.dart_tool/package_config.json'));
  if(rootConfig.existsSync())throw StateError('Source analysis configuration already owned by another analyzer');
  rootConfig.parent.createSync(recursive:true);rootConfig.writeAsStringSync(jsonEncode({...config,'packages':packages}));
  final rootConfigHash=digest(rootConfig.readAsStringSync());
  try{
  final context=AnalysisContextCollection(includedPaths:[root],sdkPath:sdk),records=<Object?>[];
  for(final request in requests){
    final source=request['source'] as String;late String file;late ResolvedUnitResult result;
    if(source.startsWith('package:')){
      final pin=request['packagePin'];if(pin is! Map||pin['name'] is! String||pin['version'] is! String||pin['archiveSha256'] is! String)throw StateError('External source requires an exact locked package pin');
      final name=pin['name'] as String,locked=(lock['packages'] as Map)[name];
      if(locked is! Map||locked['source']!='hosted'||locked['version']!=pin['version']||locked['description'] is! Map||(locked['description'] as Map)['name']!=name||(locked['description'] as Map)['sha256']!=pin['archiveSha256'])throw StateError('External package pin differs from tool lock');
      final package=packages.where((item)=>item['name']==name).single,packageRoot=Directory.fromUri(Uri.parse(package['rootUri'] as String)).resolveSymbolicLinksSync(),libraryRoot=p.canonicalize(p.join(packageRoot,package['packageUri'] as String));
      String packageFile(String uri){
        final value=Uri.tryParse(uri);if(value==null||value.scheme!='package'||value.hasAuthority||value.hasQuery||value.hasFragment||!value.path.startsWith('$name/')||value.pathSegments.any((segment)=>segment=='.'||segment=='..'||segment.contains('\\')||segment.contains('/')))throw StateError('External source URI escapes package');
        final target=p.canonicalize(p.join(libraryRoot,value.path.substring(name.length+1)));if(!p.isWithin(libraryRoot,target))throw StateError('External source escapes package library');
        final actual=File(target).resolveSymbolicLinksSync();if(!p.isWithin(packageRoot,actual)||!p.isWithin(libraryRoot,actual))throw StateError('External linked source escapes package library');return target;
      }
      file=packageFile(source);final library=request['library'];if(library is! String||request['librarySha256'] is! String)throw StateError('External source requires a pinned owning library');
      final libraryFile=packageFile(library);if(digest(File(libraryFile).readAsStringSync().replaceAll('\r\n','\n'))!=request['librarySha256'])throw StateError('External owning library hash mismatch');
      final session=context.contextFor(root).currentSession,element=await session.getLibraryByUri(library);if(element is! LibraryElementResult||element.element.uri.toString()!=library)throw StateError('External library URI did not resolve exactly');
      final resolved=await session.getResolvedLibraryByElement(element.element);if(resolved is! ResolvedLibraryResult)throw StateError('Unresolved external library');
      final units=resolved.units.where((unit)=>p.equals(p.canonicalize(unit.path),file)).toList();if(units.length!=1||units.single.libraryElement.uri.toString()!=library)throw StateError('External source is not in its pinned owning library: $file; resolved ${resolved.units.map((unit)=>unit.path).join(', ')}');result=units.single;
    }else{
      if(request['packagePin']!=null||request['library']!=null||request['librarySha256']!=null)throw StateError('Package metadata requires a package source URI');
      file=p.canonicalize(p.join(root,source));if(!p.isWithin(root,file))throw StateError('Source escapes pin root');
      if(p.isWithin(p.canonicalize(p.join(root,'engine/src/flutter/lib/ui')),file)){
        // The pinned engine tree is excluded from normal analysis contexts.
        // Resolve its actual embedded dart:ui library, then select the exact
        // requested unit; never copy a part into a substitute local library.
        final session=context.contextFor(root).currentSession,element=await session.getLibraryByUri('dart:ui');
        if(element is! LibraryElementResult||element.element.uri.toString()!='dart:ui')throw StateError('Pinned dart:ui library did not resolve exactly');
        final library=await session.getResolvedLibraryByElement(element.element);if(library is! ResolvedLibraryResult)throw StateError('Unresolved pinned dart:ui library');
        final units=library.units.where((unit)=>p.equals(p.canonicalize(unit.path),file)).toList();
        if(units.length!=1||units.single.libraryElement.uri.toString()!='dart:ui')throw StateError('Source is not a unit of pinned dart:ui: $file');result=units.single;
      }else{
        final unit=await context.contextFor(file).currentSession.getResolvedUnit(file);if(unit is! ResolvedUnitResult)throw StateError('Unresolved source $file');result=unit;
      }
    }
    final content=result.content.replaceAll('\r\n','\n');
    if(digest(content)!=request['sha256'])throw StateError('Source hash mismatch: $file');
    final errors=result.diagnostics.where((d)=>d.diagnosticCode.severity.name=='ERROR').map((d)=>d.toString()).toList();
    final selected=(request['symbols'] as List).cast<String>(),preserveTypeAliases=result.unit.declarations.whereType<TypeAlias>().any((alias)=>selected.contains(alias.name.lexeme));
    final defaultResolver=InheritedDefaultResolver(result.session);
    for(final symbol in (request['symbols'] as List).cast<String>()){
      final candidates=<AstNode>[];
      for(final decl in result.unit.declarations){
        if(decl is ClassDeclaration&&decl.namePart.typeName.lexeme==symbol)candidates.add(decl);
        if(decl is EnumDeclaration&&decl.namePart.typeName.lexeme==symbol)candidates.add(decl);
        if(decl is FunctionDeclaration&&decl.name.lexeme==symbol)candidates.add(decl);
        if(decl is MixinDeclaration&&decl.name.lexeme==symbol)candidates.add(decl);
        if(decl is TypeAlias&&decl.name.lexeme==symbol)candidates.add(decl);
        if(decl is TopLevelVariableDeclaration)for(final v in decl.variables.variables)if(v.name.lexeme==symbol)candidates.add(v);
        if(decl is ClassDeclaration&&symbol.startsWith('${decl.namePart.typeName.lexeme}.'))for(final member in decl.body.members){
          final name=symbol.substring(symbol.indexOf('.')+1);
          if(member is MethodDeclaration&&member.name.lexeme==name)candidates.add(member);
          if(member is FieldDeclaration&&member.isStatic)for(final v in member.fields.variables)if(v.name.lexeme==name)candidates.add(v);
        }
      }
      try{
        if(errors.isNotEmpty)throw UnsupportedError('Source diagnostics: ${errors.take(5).join('; ')}');
        if(candidates.length!=1)throw UnsupportedError('Missing or ambiguous symbol $symbol');
        final n=candidates.single;
        final span=result.content.substring(n.offset,n.end);
        records.add({'source':request['source'],if(request['packagePin']!=null)'packagePin':request['packagePin'],if(request['library']!=null)'library':request['library'],'symbol':symbol,'sourceSha256':digest(content),'spanSha256':digest(span),'upstreamSpanSha256':digest(span.replaceAll('\r\n','\n')),'ir':ExecutionIr(typeSystem:result.typeSystem,preserveTypeAliases:preserveTypeAliases,inheritedDefaults:await defaultResolver.collect(n)).declaration(n,symbol)});
      }on UnsupportedError catch(e){records.add({'source':request['source'],'symbol':symbol,'sourceSha256':digest(content),'diagnostic':e.message});}
    }
  }
  File(args[2]).writeAsStringSync('${jsonEncode({'schema':'nelyx.resolved-body-ir/v1','records':records})}\n');
  stdout.writeln(jsonEncode({'records':records.length,'unsupported':records.whereType<Map>().where((r)=>r['diagnostic']!=null).length}));
  }finally{if(rootConfig.existsSync()&&digest(rootConfig.readAsStringSync())==rootConfigHash)rootConfig.deleteSync();}
}
