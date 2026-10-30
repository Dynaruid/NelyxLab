// SPDX-License-Identifier: BSD-3-Clause
import ts from 'typescript';
import { createHash } from 'node:crypto';
import { buildSourceGraph } from './source-graph.mjs';
const hash = (value) => createHash('sha256').update(value).digest('hex');
const arithmetic = new Map([
  [ts.SyntaxKind.PlusToken, '+'],
  [ts.SyntaxKind.MinusToken, '-'],
  [ts.SyntaxKind.AsteriskToken, '*'],
  [ts.SyntaxKind.SlashToken, '/'],
  [ts.SyntaxKind.PercentToken, '%'],
  [ts.SyntaxKind.AsteriskAsteriskToken, '**'],
]);
/** Initial scalar subset. Unsupported bodies fail with original TS positions. */
export function lowerNumericPartition(options, selections) {
  if (!Array.isArray(selections) || !selections.length || selections.length > 32)
    throw Error('Select 1 to 32 explicit scalar bodies');
  const { graph, program, checker, owners } = buildSourceGraph(options),
    functions = [],
    selected = new Set();
  const fail = (source, node, reason) => {
    const at = source.getLineAndCharacterOfPosition(node.getStart(source));
    const error = new Error(
      `${source.fileName}:${at.line + 1}:${at.character + 1}: static-aot: ${reason}`,
    );
    error.code = 'NELYX_TYPED_UNSUPPORTED';
    throw error;
  };
  const inputFiles = new Map(
    program
      .getSourceFiles()
      .filter((source) => !source.isDeclarationFile)
      .map((source) => [source.fileName.replaceAll('\\', '/').toLowerCase(), source]),
  );
  for (const selection of selections) {
    const module = graph.modules.find((module) => module.id === selection.module);
    if (!module)
      throw Error('Selected body is not in the installed source graph: ' + selection.module);
    const owner = owners.find((owner) => owner.name === module.owner),
      relative = module.id.slice(module.owner.length + 1),
      source = inputFiles.get((owner.root + '/' + relative).replaceAll('\\', '/').toLowerCase());
    if (!source) throw Error('Selected implementation source unavailable');
    let declaration;
    for (const node of source.statements) {
      if (
        !selection.className &&
        ts.isFunctionDeclaration(node) &&
        node.name?.text === selection.name
      )
        declaration = node;
      if (
        selection.className &&
        ts.isClassDeclaration(node) &&
        node.name?.text === selection.className
      )
        declaration = node.members.find(
          (member) =>
            ts.isMethodDeclaration(member) &&
            ts.isIdentifier(member.name) &&
            member.name.text === selection.name,
        );
    }
    if (!declaration?.body) throw Error('Selected source body unavailable: ' + selection.name);
    const key =
      module.id + '#' + (selection.className ? selection.className + '.' : '') + selection.name;
    if (selected.has(key)) fail(source, declaration, 'Duplicate partition symbol');
    selected.add(key);
    if (
      declaration.typeParameters?.length ||
      declaration.asteriskToken ||
      declaration.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.AsyncKeyword)
    )
      fail(
        source,
        declaration,
        'Generic, generator and async bodies require an explicit supported lowering',
      );
    const position = (node) => {
      const offset = node.getStart(source),
        at = source.getLineAndCharacterOfPosition(offset);
      return { offset, line: at.line + 1, column: at.character + 1 };
    };
    const parameters = [],
      symbols = new Map();
    for (const parameter of declaration.parameters) {
      if (
        !ts.isIdentifier(parameter.name) ||
        parameter.questionToken ||
        parameter.dotDotDotToken ||
        parameter.initializer
      )
        fail(source, parameter, 'Scalar parameters must be required identifiers without defaults');
      if (checker.getTypeAtLocation(parameter).flags !== ts.TypeFlags.Number)
        fail(source, parameter, 'Only number parameter contracts are supported');
      const symbol = checker.getSymbolAtLocation(parameter.name);
      symbols.set(symbol, parameters.length);
      parameters.push({ name: parameter.name.text, type: 'number', ...position(parameter) });
    }
    const signature = checker.getSignatureFromDeclaration(declaration);
    if (!signature || checker.getReturnTypeOfSignature(signature).flags !== ts.TypeFlags.Number)
      fail(source, declaration, 'Only number return contracts are supported');
    if (
      declaration.body.statements.length !== 1 ||
      !ts.isReturnStatement(declaration.body.statements[0]) ||
      !declaration.body.statements[0].expression
    )
      fail(
        source,
        declaration.body,
        'Only a scalar return expression is supported; statements and dependency closures remain excluded',
      );
    const expression = (node) => {
      if (ts.isParenthesizedExpression(node)) return expression(node.expression);
      const location = position(node);
      if (ts.isNumericLiteral(node))
        return { kind: 'literal', type: 'number', text: node.getText(source), ...location };
      if (ts.isIdentifier(node)) {
        const index = symbols.get(checker.getSymbolAtLocation(node));
        if (index === undefined)
          fail(
            source,
            node,
            'Captured symbols and mutable globals require dependency and observation analysis',
          );
        return { kind: 'parameter', type: 'number', index, ...location };
      }
      if (
        ts.isPrefixUnaryExpression(node) &&
        [ts.SyntaxKind.PlusToken, ts.SyntaxKind.MinusToken].includes(node.operator)
      )
        return {
          kind: 'unary',
          type: 'number',
          operator: node.operator === ts.SyntaxKind.PlusToken ? '+' : '-',
          operand: expression(node.operand),
          ...location,
        };
      if (ts.isBinaryExpression(node) && arithmetic.has(node.operatorToken.kind))
        return {
          kind: 'binary',
          type: 'number',
          operator: arithmetic.get(node.operatorToken.kind),
          left: expression(node.left),
          right: expression(node.right),
          ...location,
        };
      fail(
        source,
        node,
        `Unsupported scalar expression ${ts.SyntaxKind[node.kind]}; receivers, calls and field observations remain untyped`,
      );
    };
    const body = expression(declaration.body.statements[0].expression);
    functions.push({
      id: key,
      sourceSha256: module.sourceSha256,
      receiver: selection.className ? 'excluded-from-kernel' : 'none',
      parameters,
      returnType: 'number',
      body,
      ...position(declaration),
    });
  }
  const ir = {
      schema: 'nelyx.typed-numeric-ir/v1',
      graphSha256: graph.sha256,
      checkerSha256: graph.checkerSha256,
      functions,
    },
    segments = [];
  let generated = '';
  const append = (text, fn, node) => {
    if (fn && node)
      segments.push({
        generatedOffset: generated.length,
        module: fn.id.split('#')[0],
        sourceOffset: node.offset,
        line: node.line,
        column: node.column,
      });
    generated += text;
  };
  const emit = (node, fn) => {
    if (node.kind === 'literal') append(node.text, fn, node);
    else if (node.kind === 'parameter') append('p' + node.index, fn, node);
    else if (node.kind === 'unary') {
      append('(' + node.operator, fn, node);
      emit(node.operand, fn);
      append(')');
    } else {
      append('(', fn, node);
      emit(node.left, fn);
      append(node.operator);
      emit(node.right, fn);
      append(')');
    }
  };
  functions.forEach((fn, index) => {
    append(
      'function kernel' +
        index +
        '(' +
        fn.parameters.map((_, i) => 'p' + i + ':number').join(',') +
        '):number{return ',
      fn,
      fn,
    );
    emit(fn.body, fn);
    append('; }\n');
    // Untyped VM callers must cross checked casts. The trusted numeric ABI is
    // never exported directly. Product source types are not widened to any.
    append(
      'function boundary' +
        index +
        '(' +
        fn.parameters.map((_, i) => 'p' + i).join(',') +
        '):number{return kernel' +
        index +
        '(' +
        fn.parameters.map((_, i) => 'p' + i).join(',') +
        ');}\n',
    );
  });
  // A typed array is not an ordinary JS array in this supplier. Export only
  // checked callable values; never expose a typed registry object or array.
  const bindings = functions.map((fn, index) => {
    const globalName = '__nelyxTypedNumeric_' + hash(fn.id).slice(0, 16);
    append('globalThis[' + JSON.stringify(globalName) + ']=boundary' + index + ';\n');
    return { id: fn.id, globalName };
  });
  const prefix = '(function(){\n';
  generated = prefix + generated + '})();\n';
  for (const segment of segments) segment.generatedOffset += prefix.length;
  return {
    ir,
    irSha256: hash(JSON.stringify(ir)),
    source: generated,
    sourceSha256: hash(generated),
    segments,
    bindings,
    graphDiagnostics: graph.diagnostics,
    qualification: 'prototype',
  };
}
