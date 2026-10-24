// SPDX-License-Identifier: BSD-3-Clause
// Exact top-level catalog for whole-unit body IR requests; no body substitution.
import 'dart:convert';
import 'dart:io';
import 'package:analyzer/dart/analysis/utilities.dart';
import 'package:analyzer/dart/ast/ast.dart';
import 'package:crypto/crypto.dart';
import 'package:path/path.dart' as p;

String digest(String value)=>sha256.convert(utf8.encode(value)).toString();
void main(List<String> args){
  if(args.length<2)throw ArgumentError('source_units <source-root> <relative-unit>...');
  final root=p.canonicalize(args.first),units=<Object?>[];
  for(final source in args.skip(1)){
    final file=p.canonicalize(p.join(root,source));if(!p.isWithin(root,file)||!p.equals(File(file).resolveSymbolicLinksSync(),file))throw StateError('Unit escapes source root');
    final content=File(file).readAsStringSync(),parsed=parseString(content:content,path:file,throwIfDiagnostics:false),symbols=<Object?>[],unselectable=<Object?>[];
    void selected(String name,AstNode node){symbols.add({'name':name,'kind':node.runtimeType.toString(),'offset':node.offset,'length':node.length,'spanSha256':digest(content.substring(node.offset,node.end))});}
    for(final declaration in parsed.unit.declarations){
      if(declaration is ClassDeclaration){selected(declaration.namePart.typeName.lexeme,declaration);continue;}
      if(declaration is MixinDeclaration){selected(declaration.name.lexeme,declaration);continue;}
      if(declaration is EnumDeclaration){selected(declaration.namePart.typeName.lexeme,declaration);continue;}
      if(declaration is TypeAlias){selected(declaration.name.lexeme,declaration);continue;}
      if(declaration is FunctionDeclaration){selected(declaration.name.lexeme,declaration);continue;}
      if(declaration is TopLevelVariableDeclaration){for(final variable in declaration.variables.variables){selected(variable.name.lexeme,variable);}continue;}
      unselectable.add({'kind':declaration.runtimeType.toString(),'offset':declaration.offset,'length':declaration.length,'spanSha256':digest(content.substring(declaration.offset,declaration.end)),'diagnostic':'No exact body IR selection representation for this top-level declaration'});
    }
    units.add({'source':source,'rawSha256':digest(content),'sha256':digest(content.replaceAll('\r\n','\n')),'symbols':symbols,'unselectable':unselectable,'parseDiagnostics':parsed.errors.map((error)=>error.toString()).toList()});
  }
  stdout.writeln(jsonEncode({'schema':'nelyx.source-units/v1','units':units}));
}
