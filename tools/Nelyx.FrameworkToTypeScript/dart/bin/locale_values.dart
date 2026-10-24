// SPDX-License-Identifier: BSD-3-Clause
// Only the two literal Locale alias maps; no resolved analyzer configuration.
import 'dart:convert';import 'dart:io';
import 'package:analyzer/dart/analysis/utilities.dart';import 'package:analyzer/dart/ast/ast.dart';import 'package:crypto/crypto.dart';
import 'design_values.dart' show value;
void main(List<String> args){
 final text=File(args.single).readAsStringSync(),parsed=parseString(content:text,throwIfDiagnostics:false);if(parsed.errors.isNotEmpty)throw StateError(parsed.errors.toString());
 const names={'_deprecatedLanguageSubtagMap','_deprecatedRegionSubtagMap'};final fields=<Object?>[];
 for(final declaration in parsed.unit.declarations.whereType<ClassDeclaration>())if(declaration.namePart.typeName.lexeme=='Locale')for(final member in declaration.body.members.whereType<FieldDeclaration>())if(member.isStatic)for(final field in member.fields.variables)if(names.contains(field.name.lexeme))fields.add({'name':field.name.lexeme,'value':value(field.initializer!)});
 if(fields.length!=2)throw StateError('Expected both original Locale alias maps');stdout.writeln(jsonEncode({'sourceSha256':sha256.convert(utf8.encode(text)).toString(),'fields':fields}));
}
