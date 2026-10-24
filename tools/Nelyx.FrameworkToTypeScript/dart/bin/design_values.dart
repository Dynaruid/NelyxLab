// SPDX-License-Identifier: BSD-3-Clause
// Closed syntax for immutable design data. Unsupported expressions fail closed.
import 'dart:convert';
import 'dart:io';
import 'package:analyzer/dart/analysis/utilities.dart';
import 'package:analyzer/dart/ast/ast.dart';
import 'package:crypto/crypto.dart';

Object? value(Expression node) {
  if (node is IntegerLiteral) return {'kind':'int','value':node.value};
  if (node is DoubleLiteral) return {'kind':'double','value':node.value};
  if (node is BooleanLiteral) return {'kind':'bool','value':node.value};
  if (node is SimpleStringLiteral) return {'kind':'string','value':node.value};
  if (node is NullLiteral) return {'kind':'null'};
  if (node is SimpleIdentifier) return {'kind':'ref','name':node.name};
  if (node is PrefixedIdentifier) return {'kind':'ref','name':node.toSource()};
  if (node is PrefixExpression && node.operator.lexeme=='-') return {'kind':'negate','value':value(node.operand)};
  if (node is MethodInvocation && node.target==null &&
      ['Color','MaterialColor','MaterialAccentColor','TextTheme','TextStyle','ColorScheme'].contains(node.methodName.name)) return {
    'kind':'new','type':node.methodName.name,'constructor':null,
    'args':[for(final arg in node.argumentList.arguments)
      {'name':arg is NamedArgument?arg.name.lexeme:null,'value':value(arg.argumentExpression)}],
  };
  if (node is InstanceCreationExpression) return {
    'kind':'new','type':node.constructorName.type.toSource(),'constructor':node.constructorName.name?.name,
    'args':[for(final arg in node.argumentList.arguments)
      {'name':arg is NamedArgument?arg.name.lexeme:null,'value':value(arg.argumentExpression)}],
  };
  if(node is ListLiteral) return {'kind':'list','values':[
    for(final entry in node.elements) if(entry is Expression) value(entry) else throw StateError('Unsupported list entry: ${entry.toSource()}'),
  ]};
  if(node is SetOrMapLiteral) return {'kind':'map','values':[
    for(final entry in node.elements) if(entry is MapLiteralEntry) {'key':value(entry.key),'value':value(entry.value)} else throw StateError('Unsupported map entry: ${entry.toSource()}'),
  ]};
  throw StateError('Unsupported design expression ${node.runtimeType} @${node.offset}: ${node.toSource()}');
}
void main(List<String> args) {
  final source=File(args[0]).readAsStringSync(),parsed=parseString(content:source,throwIfDiagnostics:false);
  if(parsed.errors.isNotEmpty)throw StateError(parsed.errors.toString());
  final selected=args[1],fields=<Object?>[];
  for(final node in parsed.unit.declarations){
    if(node is ClassDeclaration&&node.namePart.typeName.lexeme==selected){
      for(final member in node.body.members.whereType<FieldDeclaration>()){
        if(!member.isStatic)continue;
        for(final field in member.fields.variables){
          if(args.length>2&&!args.skip(2).contains(field.name.lexeme))continue;
          fields.add({'name':field.name.lexeme,'type':member.fields.type?.toSource(),'value':value(field.initializer!)});
        }
      }
    }
    if(selected=='topLevel'&&node is TopLevelVariableDeclaration){
      for(final field in node.variables.variables.where((field)=>args.skip(2).contains(field.name.lexeme))){
        fields.add({'name':field.name.lexeme,'type':node.variables.type?.toSource(),'value':value(field.initializer!)});
      }
    }
  }
  if(fields.isEmpty)throw StateError('No selected design data');
  stdout.writeln(jsonEncode({'sourceSha256':sha256.convert(utf8.encode(source)).toString(),'fields':fields}));
}
