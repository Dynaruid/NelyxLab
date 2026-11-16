// SPDX-License-Identifier: BSD-3-Clause
import ts from 'typescript';
import { createHash } from 'node:crypto';

const hash = (value) => createHash('sha256').update(value).digest('hex');
const primitive = (node) =>
  node?.kind === ts.SyntaxKind.NumberKeyword
    ? 'number'
    : node?.kind === ts.SyntaxKind.BooleanKeyword
      ? 'boolean'
      : 'dynamic';
const callable = (node) => ts.isFunctionDeclaration(node) && node.body;
export function isOwnedFactory(node) {
  return (
    callable(node) &&
    ts
      .getJSDocTags(node)
      .some(
        (tag) =>
          tag.tagName.text === 'nelyxTypedFactory' &&
          typeof tag.comment === 'string' &&
          /^owned-state-v1(?:\s|$)/.test(tag.comment),
      )
  );
}

/** A closure of private scalar bindings and boxed JS observations. No class,
 * exact-object or typed-array layout is inferred from TypeScript annotations.
 * A numeric annotation is retained only with an operation-by-operation proof;
 * everything else, including parameters, property reads and callbacks, is any.
 * The source algorithm and its dynamic observation order are not rewritten. */
export function inspectOwnedFactory(source, declaration, checker) {
  const reject = (node, message) => {
    const at = source.getLineAndCharacterOfPosition(node.getStart(source));
    throw Object.assign(
      Error(`${source.fileName}:${at.line + 1}:${at.character + 1}: static-aot: ${message}`),
      { code: 'NELYX_TYPED_UNSUPPORTED' },
    );
  };
  if (!isOwnedFactory(declaration) || declaration.parent !== source || !declaration.name)
    reject(declaration, 'Owned factory must be a marked top-level function');
  const functions = [],
    bindings = new Set(),
    scalars = new Map(),
    arrays = new Set();
  const reserved = (node) => {
    if (/^(?:(?:kernel|calls|boundary|count)\d+|receiver|environment)$/.test(node.text))
      reject(node, 'Owned binding collides with the native adapter namespace');
  };
  const symbol = (node) =>
    ts.isIdentifier(node) && ts.isShorthandPropertyAssignment(node.parent)
      ? checker.getShorthandAssignmentValueSymbol(node.parent)
      : checker.getSymbolAtLocation(node);
  const collect = (node) => {
    if (callable(node)) {
      if (!node.name || node.typeParameters?.length || node.asteriskToken || node.modifiers?.length)
        reject(node, 'Owned closures require plain named synchronous functions');
      functions.push(node);
      if (functions.length > 128) reject(node, 'Owned factory callable bound exceeded');
      bindings.add(symbol(node.name));
      for (const parameter of node.parameters) {
        if (
          !ts.isIdentifier(parameter.name) ||
          parameter.initializer ||
          parameter.dotDotDotToken ||
          parameter.questionToken
        )
          reject(parameter, 'Owned closure ABI requires ordinary boxed parameters');
        reserved(parameter.name);
        bindings.add(symbol(parameter.name));
      }
    } else if (ts.isFunctionLike(node) && node.body)
      reject(node, 'Owned closures require named function declarations');
    if (
      ts.isClassLike(node) ||
      ts.isTypeAssertionExpression(node) ||
      ts.isAsExpression(node) ||
      ts.isNonNullExpression(node)
    )
      reject(node, 'Owned scalar closures do not admit nominal or asserted layouts');
    if (
      [
        ts.SyntaxKind.ThisKeyword,
        ts.SyntaxKind.SuperKeyword,
        ts.SyntaxKind.AwaitExpression,
        ts.SyntaxKind.YieldExpression,
        ts.SyntaxKind.ImportKeyword,
      ].includes(node.kind)
    )
      reject(node, 'Owned closure cannot move receiver or asynchronous observations');
    if (ts.isVariableDeclaration(node)) {
      if (!ts.isIdentifier(node.name)) reject(node, 'Owned closure requires identifier locals');
      reserved(node.name);
      const key = symbol(node.name);
      bindings.add(key);
      const type = primitive(node.type);
      if (type !== 'dynamic') scalars.set(key, { type, declaration: node });
      if (
        node.initializer &&
        ts.isArrayLiteralExpression(node.initializer) &&
        node.parent.flags & ts.NodeFlags.Const
      )
        arrays.add(key);
    }
    if (!ts.isTypeNode(node)) ts.forEachChild(node, collect);
  };
  collect(declaration);
  // Determine emitted primitive types from proofs, not from the TS checker.
  const expressionType = (node) => {
    if (ts.isParenthesizedExpression(node)) return expressionType(node.expression);
    if (ts.isNumericLiteral(node)) return 'number';
    if (node.kind === ts.SyntaxKind.TrueKeyword || node.kind === ts.SyntaxKind.FalseKeyword)
      return 'boolean';
    if (ts.isIdentifier(node)) return scalars.get(symbol(node))?.type ?? 'dynamic';
    if (
      ts.isPropertyAccessExpression(node) &&
      node.name.text === 'length' &&
      ts.isIdentifier(node.expression) &&
      arrays.has(symbol(node.expression))
    )
      return 'number';
    if (ts.isPrefixUnaryExpression(node)) {
      if (node.operator === ts.SyntaxKind.ExclamationToken) return 'boolean';
      if (node.operator === ts.SyntaxKind.PlusToken) return 'number';
      if (expressionType(node.operand) === 'number') return 'number';
    }
    if (ts.isPostfixUnaryExpression(node) && expressionType(node.operand) === 'number')
      return 'number';
    if (ts.isBinaryExpression(node)) {
      const operator = node.operatorToken.kind,
        a = expressionType(node.left),
        b = expressionType(node.right);
      if (
        [
          ts.SyntaxKind.LessThanToken,
          ts.SyntaxKind.LessThanEqualsToken,
          ts.SyntaxKind.GreaterThanToken,
          ts.SyntaxKind.GreaterThanEqualsToken,
          ts.SyntaxKind.EqualsEqualsEqualsToken,
          ts.SyntaxKind.ExclamationEqualsEqualsToken,
          ts.SyntaxKind.EqualsEqualsToken,
          ts.SyntaxKind.ExclamationEqualsToken,
          ts.SyntaxKind.InKeyword,
          ts.SyntaxKind.InstanceOfKeyword,
        ].includes(operator)
      )
        return 'boolean';
      if ([ts.SyntaxKind.AmpersandAmpersandToken, ts.SyntaxKind.BarBarToken].includes(operator))
        return a === b ? a : 'dynamic';
      if (operator === ts.SyntaxKind.PlusToken)
        return a === 'number' && b === 'number' ? 'number' : 'dynamic';
      // A number operand makes BigInt arithmetic throw; a successful result
      // of these JS operations is therefore a number, even with coercion.
      if (
        [
          ts.SyntaxKind.MinusToken,
          ts.SyntaxKind.AsteriskToken,
          ts.SyntaxKind.SlashToken,
          ts.SyntaxKind.PercentToken,
          ts.SyntaxKind.AsteriskAsteriskToken,
          ts.SyntaxKind.LessThanLessThanToken,
          ts.SyntaxKind.GreaterThanGreaterThanToken,
          ts.SyntaxKind.GreaterThanGreaterThanGreaterThanToken,
          ts.SyntaxKind.AmpersandToken,
          ts.SyntaxKind.BarToken,
          ts.SyntaxKind.CaretToken,
        ].includes(operator) &&
        (a === 'number' || b === 'number')
      )
        return 'number';
    }
    return 'dynamic';
  };
  const unparenthesized = (node) => {
    while (ts.isParenthesizedExpression(node)) node = node.expression;
    return node;
  };
  const validate = (node, current) => {
    if (ts.isTypeNode(node)) return;
    if (callable(node)) current = node;
    if (ts.isIdentifier(node)) {
      const isProperty =
        (ts.isPropertyAccessExpression(node.parent) && node.parent.name === node) ||
        (ts.isPropertyAssignment(node.parent) &&
          node.parent.name === node &&
          !ts.isComputedPropertyName(node.parent.name));
      if (!isProperty) {
        const key = symbol(node);
        const builtin =
          ['Number', 'undefined'].includes(node.text) &&
          (!key?.declarations?.length ||
            key.declarations.every((item) => item.getSourceFile().isDeclarationFile));
        if (!bindings.has(key) && !builtin)
          reject(node, 'Owned closure has an unbound lexical observation: ' + node.text);
        if (key === symbol(declaration.name) && node !== declaration.name)
          reject(node, 'Owned factory cannot expose or recursively call its native boundary');
        if (['arguments', 'eval'].includes(node.text))
          reject(node, 'Owned closure cannot move special lexical bindings');
      }
    }
    if (ts.isVariableDeclaration(node)) {
      const scalar = scalars.get(symbol(node.name));
      if (scalar && (!node.initializer || expressionType(node.initializer) !== scalar.type))
        reject(node, 'Owned scalar initializer lacks a runtime representation proof');
    }
    if (
      ts.isBinaryExpression(node) &&
      node.operatorToken.kind >= ts.SyntaxKind.FirstAssignment &&
      node.operatorToken.kind <= ts.SyntaxKind.LastAssignment
    ) {
      const target = unparenthesized(node.left);
      if (ts.isArrayLiteralExpression(target) || ts.isObjectLiteralExpression(target))
        reject(node, 'Owned closure cannot hide scalar writes in destructuring');
      if (ts.isIdentifier(target) && functions.some((fn) => symbol(fn.name) === symbol(target)))
        reject(node, 'Owned closure cannot replace a private function binding');
      if (ts.isIdentifier(target)) {
        const scalar = scalars.get(symbol(target));
        if (
          scalar &&
          (expressionType(node.right) !== scalar.type ||
            (scalar.type !== 'number' && node.operatorToken.kind !== ts.SyntaxKind.EqualsToken) ||
            ![
              ts.SyntaxKind.EqualsToken,
              ts.SyntaxKind.PlusEqualsToken,
              ts.SyntaxKind.MinusEqualsToken,
              ts.SyntaxKind.AsteriskEqualsToken,
              ts.SyntaxKind.SlashEqualsToken,
            ].includes(node.operatorToken.kind))
        )
          reject(node, 'Owned scalar assignment lacks a runtime representation proof');
      }
    }
    if (
      (ts.isPrefixUnaryExpression(node) || ts.isPostfixUnaryExpression(node)) &&
      [ts.SyntaxKind.PlusPlusToken, ts.SyntaxKind.MinusMinusToken].includes(node.operator) &&
      ts.isIdentifier(unparenthesized(node.operand)) &&
      scalars.get(symbol(unparenthesized(node.operand)))?.type === 'boolean'
    )
      reject(node, 'Owned boolean cannot receive a numeric update');
    if (
      ts.isForInStatement(node) ||
      (ts.isForOfStatement(node) && !ts.isVariableDeclarationList(node.initializer))
    )
      reject(node, 'Owned iteration requires an independent boxed binding');
    if (ts.isReturnStatement(node)) {
      if (current.type?.kind === ts.SyntaxKind.VoidKeyword && node.expression)
        reject(node, 'Owned void return must not discard or cast a dynamic result');
      const type = primitive(current.type);
      if (type !== 'dynamic' && (!node.expression || expressionType(node.expression) !== type))
        reject(node, 'Owned scalar return lacks a runtime representation proof');
    }
    ts.forEachChild(node, (child) => validate(child, current));
  };
  validate(declaration, declaration);
  return { source, declaration, functions, symbol, scalars, qualification: 'owned-state-v1' };
}

/** Preserve the complete closure. Helpers get private audit names, never a raw
 * global ABI. Only the factory is callable from its original Metro module. */
export function appendOwnedFactories(partition, factories) {
  if (!factories.length) return partition;
  const ending = '})();\n';
  if (!partition.source.endsWith(ending)) throw Error('Owned factory partition wrapper differs');
  let generated = partition.source.slice(0, -ending.length);
  const bindings = [...partition.bindings],
    functions = [...partition.ir.functions],
    segments = [...partition.segments],
    callables = partition.bindings.map((binding, index) => ({
      id: binding.id,
      module: binding.module,
      offset: partition.ir.functions[index].position.sourceOffset,
      kernel: 'kernel' + index,
    }));
  let cursor = callables.length;
  for (const { inspected, module, file } of factories) {
    const { source, declaration, symbol } = inspected,
      factoryIndex = cursor,
      id = module.id + '#' + declaration.name.text,
      globalName = '__nelyxTyped_' + hash(id).slice(0, 16),
      names = new Map(inspected.functions.map((fn) => [symbol(fn.name), 'kernel' + cursor++]));
    if (cursor > 4096) throw Error('Typed native callable bound exceeded');
    const result = ts.transform(declaration, [
      (context) => {
        const f = context.factory;
        const visit = (node) => {
          if (ts.isShorthandPropertyAssignment(node)) {
            const renamed = names.get(symbol(node.name));
            if (renamed)
              return f.createPropertyAssignment(node.name.text, f.createIdentifier(renamed));
          }
          if (ts.isIdentifier(node)) {
            const renamed = names.get(symbol(node));
            if (renamed) return f.createIdentifier(renamed);
          }
          if (ts.isFunctionDeclaration(node)) {
            const parameters = node.parameters.map((parameter) =>
              f.updateParameterDeclaration(
                parameter,
                undefined,
                undefined,
                parameter.name,
                undefined,
                f.createKeywordTypeNode(ts.SyntaxKind.AnyKeyword),
                undefined,
              ),
            );
            if (node === declaration)
              parameters.unshift(
                ...['receiver', 'environment'].map((name) =>
                  f.createParameterDeclaration(
                    undefined,
                    undefined,
                    name,
                    undefined,
                    f.createKeywordTypeNode(ts.SyntaxKind.AnyKeyword),
                  ),
                ),
              );
            const type =
              node === declaration ||
              !node.type ||
              ![
                ts.SyntaxKind.NumberKeyword,
                ts.SyntaxKind.BooleanKeyword,
                ts.SyntaxKind.VoidKeyword,
              ].includes(node.type.kind)
                ? f.createKeywordTypeNode(ts.SyntaxKind.AnyKeyword)
                : node.type;
            const body = ts.visitEachChild(node.body, visit, context);
            return f.updateFunctionDeclaration(
              node,
              undefined,
              undefined,
              f.createIdentifier(names.get(symbol(node.name))),
              undefined,
              parameters,
              type,
              f.updateBlock(body, [
                f.createExpressionStatement(f.createStringLiteral('noinline')),
                ...body.statements,
              ]),
            );
          }
          if (ts.isVariableDeclaration(node))
            return f.updateVariableDeclaration(
              node,
              node.name,
              undefined,
              ts.isForOfStatement(node.parent.parent)
                ? undefined
                : ['number', 'boolean'].includes(primitive(node.type))
                  ? node.type
                  : f.createKeywordTypeNode(ts.SyntaxKind.AnyKeyword),
              node.initializer ? ts.visitNode(node.initializer, visit) : undefined,
            );
          return ts.visitEachChild(node, visit, context);
        };
        return (node) => ts.visitNode(node, visit);
      },
    ]);
    let emitted;
    try {
      emitted =
        ts
          .createPrinter({ newLine: ts.NewLineKind.LineFeed })
          .printNode(ts.EmitHint.Unspecified, result.transformed[0], source) + '\n';
    } finally {
      result.dispose();
    }
    const parsed = ts.createSourceFile('owned.ts', emitted, ts.ScriptTarget.Latest, true),
      offset = generated.length,
      generatedFunctions = new Map();
    const collect = (node) => {
      if (callable(node)) generatedFunctions.set(node.name.text, node);
      ts.forEachChild(node, collect);
    };
    collect(parsed);
    for (const fn of inspected.functions) {
      const kernel = names.get(symbol(fn.name)),
        output = generatedFunctions.get(kernel),
        at = source.getLineAndCharacterOfPosition(fn.getStart(source)),
        bodyId =
          module.id + '#' + (fn === declaration ? '' : declaration.name.text + '.') + fn.name.text;
      callables.push({
        id: bodyId,
        module: module.id,
        offset: fn.getStart(source),
        kernel,
        inputRange: { offset: offset + output.getStart(parsed), end: offset + output.end },
      });
      segments.push({
        generatedOffset: offset + output.getStart(parsed),
        generatedLength: output.end - output.getStart(parsed),
        module: module.id,
        sourceOffset: fn.getStart(source),
        line: at.line + 1,
        column: at.character + 1,
      });
      functions.push({
        id: bodyId,
        module: module.id,
        kind: 'owned-state-closure',
        sourceSha256: module.sourceSha256,
        sourceOffset: fn.getStart(source),
        end: fn.end,
        kernel,
        typedParameters: 'boxed-js',
        typedState: [...inspected.scalars.values()].map(({ type, declaration }) => ({
          name: declaration.name.text,
          type,
          offset: declaration.getStart(source),
        })),
        sourceBodySha256: hash(fn.getText(source)),
      });
    }
    generated += emitted;
    const parameters = declaration.parameters.map((parameter) => parameter.name.text),
      args = ['receiver', 'environment', ...parameters].join(','),
      counter = 'calls' + factoryIndex;
    generated += `let ${counter}:number=0;\nfunction boundary${factoryIndex}(${args}):any{${counter}++;return kernel${factoryIndex}(${args});}\n`;
    generated += `globalThis[${JSON.stringify(globalName)}]=boundary${factoryIndex};\nfunction count${factoryIndex}():number{return ${counter};}\nglobalThis[${JSON.stringify(globalName + '_calls')}]=count${factoryIndex};\n`;
    bindings.push({
      id,
      globalName,
      module: module.id,
      file,
      sourceSha256: module.sourceSha256,
      runtime: module.runtime ?? null,
      runtimeSha256: module.runtimeSha256 ?? null,
      name: declaration.name.text,
      className: null,
      adapter: `return globalThis[${JSON.stringify(globalName)}](this,null${parameters.map((name) => ',' + name).join('')});`,
    });
  }
  generated += ending;
  segments.sort((a, b) => a.generatedOffset - b.generatedOffset);
  const ir = { ...partition.ir, functions };
  return {
    ...partition,
    ir,
    irSha256: hash(JSON.stringify(ir)),
    source: generated,
    sourceSha256: hash(generated),
    bindings,
    callables,
    segments,
  };
}
