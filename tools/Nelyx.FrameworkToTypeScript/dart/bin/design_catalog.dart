// SPDX-License-Identifier: BSD-3-Clause
// Syntax inventory only. Resolved lowering and behavior qualification are separate.
import 'dart:convert';
import 'dart:io';
import 'package:analyzer/dart/analysis/utilities.dart';
import 'package:analyzer/dart/ast/ast.dart';
import 'package:crypto/crypto.dart';
import 'package:path/path.dart' as p;

String hash(String value) => sha256.convert(utf8.encode(value)).toString();
late String sourceText;
Map<String, Object?> span(AstNode node) => {
  'kind': node.runtimeType.toString(), 'offset': node.offset,
  'length': node.length, 'sha256': hash(sourceText.substring(node.offset,node.end)),
};
List<Map<String, Object?>> members(Iterable<ClassMember> nodes) => [
  for (final node in nodes)
    if (node is FieldDeclaration)
      for (final field in node.fields.variables)
        {...span(field), 'name': field.name.lexeme, 'private': field.name.lexeme.startsWith('_'),
          'type': node.fields.type?.toSource(), 'static': node.isStatic}
    else if (node is MethodDeclaration)
      {...span(node), 'name': node.name.lexeme, 'private': node.name.lexeme.startsWith('_'),
        'static': node.isStatic, 'getter': node.isGetter, 'setter': node.isSetter,
        'signature': '${node.returnType?.toSource() ?? ''} ${node.name.lexeme}${node.parameters?.toSource() ?? ''}'}
    else if (node is ConstructorDeclaration)
      {...span(node), 'name': node.name?.lexeme ?? 'new', 'private': node.name?.lexeme.startsWith('_') ?? false,
        'signature': node.parameters.toSource()}
    else
      {...span(node), 'name': null, 'diagnostic': 'Unclassified class member'},
];
void main(List<String> args) {
  final root=p.canonicalize(args[0]);
  final units=<Object?>[];
  for (final source in args.skip(1)) {
    final file=p.canonicalize(p.join(root,source));
    if (!p.isWithin(root,file)) throw StateError('Source outside pin');
    final content=File(file).readAsStringSync();
    sourceText=content;
    final parsed=parseString(content:content,path:file,throwIfDiagnostics:false);
    final declarations=<Object?>[];
    for (final node in parsed.unit.declarations) {
      void add(String name, [List<Map<String,Object?>>? children]) => declarations.add({
        ...span(node), 'name': name, 'private': name.startsWith('_'),
        if (children!=null) 'members': children,
      });
      if (node is ClassDeclaration) { add(node.namePart.typeName.lexeme,members(node.body.members)); }
      else if (node is MixinDeclaration) { add(node.name.lexeme,members(node.body.members)); }
      else if (node is EnumDeclaration) { add(node.namePart.typeName.lexeme,[
        for (final value in node.body.constants) {...span(value),'name':value.name.lexeme,'private':false},
        ...members(node.body.members),
      ]); }
      else if (node is TypeAlias) { add(node.name.lexeme); }
      else if (node is FunctionDeclaration) { add(node.name.lexeme); }
      else if (node is TopLevelVariableDeclaration) {
        for (final value in node.variables.variables) { add(value.name.lexeme); }
      } else { declarations.add({...span(node),'name':null,'diagnostic':'Unclassified top-level declaration'}); }
    }
    units.add({'source':source,'sha256':hash(content),'normalizedSha256':hash(content.replaceAll('\r\n','\n')),
      'directives': [for (final node in parsed.unit.directives)
        if (node is UriBasedDirective) {...span(node),'uri':node.uri.stringValue,'text':node.toSource()}],
      'declarations':declarations,'parseDiagnostics':parsed.errors.map((e)=>e.toString()).toList()});
  }
  stdout.writeln(jsonEncode({'schema':'nelyx.design-catalog/v1','units':units}));
}
