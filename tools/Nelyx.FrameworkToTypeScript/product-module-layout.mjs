// SPDX-License-Identifier: BSD-3-Clause
// Development-only module layout; product build/runtime consumes the relocated tracked TS.
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import ts from 'typescript';

const layoutFile = new URL('./data/work8/w12-product-module-layout.json', import.meta.url);
const layout = JSON.parse(fs.readFileSync(layoutFile, 'utf8'));
const destinations = new Map(layout.moves.map((move) => [move.from, move.to]));
const facades = new Map(
  (layout.facades ?? []).flatMap((facade) => [
    [facade.source, facade],
    [productModulePath(facade.source), facade],
  ]),
);
export function productModulePath(file) {
  return destinations.get(file) ?? file;
}
export function moduleLayoutIdentity() {
  return {
    file: 'tools/Nelyx.FrameworkToTypeScript/data/work8/w12-product-module-layout.json',
    sha256: createHash('sha256').update(fs.readFileSync(layoutFile)).digest('hex'),
  };
}
export function relocateProductModule(originalFile, text, options = {}) {
  const file = options.destination ?? productModulePath(originalFile);
  const syntax = ts.createSourceFile(originalFile, text, ts.ScriptTarget.Latest, true);
  if (syntax.parseDiagnostics.length)
    throw new Error('Cannot relocate invalid TypeScript: ' + originalFile);
  const replacements = [];
  function rewrite(literal) {
    if (!ts.isStringLiteral(literal) || !literal.text.startsWith('.')) return;
    const oldTarget = path.posix.normalize(
      path.posix.join(path.posix.dirname(originalFile), literal.text),
    );
    const facade = facades.get(oldTarget);
    const target =
      facade &&
      ![facade.source, facade.publicModule, productModulePath(facade.source)].includes(originalFile)
        ? facade.publicModule
        : productModulePath(oldTarget);
    let specifier = path.posix.relative(path.posix.dirname(file), target);
    if (!specifier.startsWith('.')) specifier = './' + specifier;
    if (specifier !== literal.text)
      replacements.push({
        start: literal.getStart(syntax),
        end: literal.end,
        text: JSON.stringify(specifier),
      });
  }
  function visit(node) {
    if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier)
      rewrite(node.moduleSpecifier);
    if (ts.isImportTypeNode(node) && ts.isLiteralTypeNode(node.argument))
      rewrite(node.argument.literal);
    if (
      ts.isCallExpression(node) &&
      node.expression.kind === ts.SyntaxKind.ImportKeyword &&
      node.arguments.length === 1
    )
      rewrite(node.arguments[0]);
    ts.forEachChild(node, visit);
  }
  visit(syntax);
  for (const replacement of replacements.sort((a, b) => b.start - a.start))
    text = text.slice(0, replacement.start) + replacement.text + text.slice(replacement.end);
  return { file, text };
}
