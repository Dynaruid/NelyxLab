// SPDX-License-Identifier: BSD-3-Clause
import { createHash } from 'node:crypto';
import ts from 'typescript';

const framework = '@nelyx/core/framework/widgets/';
const bases = new Map([
  [framework + 'framework', new Set(['State', 'StatelessWidget'])],
  [
    framework + 'ticker-provider',
    new Set(['SingleTickerProviderStateMixin', 'TickerProviderStateMixin']),
  ],
]);
const printer = ts.createPrinter({ newLine: ts.NewLineKind.LineFeed });
const digest = (text) => createHash('sha256').update(text).digest('hex');
const ambient = (node) => node.modifiers?.some(({ kind }) => kind === ts.SyntaxKind.DeclareKeyword);

function each(node, visit) {
  visit(node);
  ts.forEachChild(node, (child) => {
    each(child, visit);
  });
}

function importedBase(declaration, name) {
  return (
    ts.isStringLiteral(declaration.moduleSpecifier) &&
    bases.get(declaration.moduleSpecifier.text)?.has(name)
  );
}

function reference(checker, node) {
  if (!ts.isIdentifier(node)) return;
  const parent = node.parent;
  if (parent.name === node && !ts.isShorthandPropertyAssignment(parent)) return;
  if (
    ts.isShorthandPropertyAssignment(parent) ||
    (ts.isInExpressionContext(node) && !ts.isPartOfTypeNode(node))
  )
    return checker.resolveName(node.text, node, ts.SymbolFlags.Value | ts.SymbolFlags.Alias, false);
}

function compileMethod(source, method, checker, bindings) {
  let reason;
  const names = new Set();
  each(method, (node) => {
    if (ts.isIdentifier(node)) names.add(node.text);
    if (
      node.kind === ts.SyntaxKind.SuperKeyword ||
      node.kind === ts.SyntaxKind.ImportKeyword ||
      ts.isPrivateIdentifier(node) ||
      ts.isMetaProperty(node) ||
      (ts.isIdentifier(node) && node.text === 'eval')
    )
      reason = 'build uses syntax that depends on its original class or module';
  });
  if (reason) return { reason };
  let parameter = '__nelyxRead';
  while (names.has(parameter)) parameter += '_';
  const reads = new Set();
  const transformed = ts.transform(method, [
    (context) => {
      const { factory } = context;
      const read = (symbol, node) => {
        const binding = bindings.get(symbol);
        if (!binding) return;
        if (!binding.runtime || ts.isWriteAccess(node)) {
          reason = 'build requires an unavailable or writable module binding: ' + binding.name;
          return;
        }
        reads.add(binding.name);
        return factory.createCallExpression(factory.createIdentifier(parameter), undefined, [
          factory.createStringLiteral(binding.name),
        ]);
      };
      const visit = (node) => {
        if (ts.isShorthandPropertyAssignment(node)) {
          const value = read(reference(checker, node.name), node.name);
          if (value && !node.objectAssignmentInitializer)
            return factory.createPropertyAssignment(node.name, value);
          if (value) reason = 'build assigns to a module binding';
          return node;
        }
        if (ts.isIdentifier(node)) return read(reference(checker, node), node) ?? node;
        return ts.visitEachChild(node, visit, context);
      };
      return (node) => {
        const candidate = ts.visitNode(node, visit);
        return factory.updateMethodDeclaration(
          candidate,
          undefined,
          candidate.asteriskToken,
          candidate.name,
          candidate.questionToken,
          candidate.typeParameters,
          candidate.parameters,
          candidate.type,
          candidate.body,
        );
      };
    },
  ]);
  try {
    if (reason) return { reason };
    const implementation = printer.printNode(
      ts.EmitHint.Unspecified,
      transformed.transformed[0],
      source,
    );
    return {
      reads,
      factory: `(${parameter}: (name: string) => any) => ({${implementation}}).build`,
    };
  } finally {
    transformed.dispose();
  }
}

export function inspectWidgetModule(file, text) {
  file = file.replaceAll('\\', '/');
  const options = { target: ts.ScriptTarget.ES2022, noLib: true, noResolve: true, types: [] };
  const source = ts.createSourceFile(file, text, options.target, true, ts.ScriptKind.TS);
  if (source.parseDiagnostics.length) {
    const error = source.parseDiagnostics[0];
    const { line, character } = source.getLineAndCharacterOfPosition(error.start);
    throw new SyntaxError(
      `${file}:${line + 1}:${character + 1} ${ts.flattenDiagnosticMessageText(error.messageText, '\n')}`,
    );
  }
  const program = ts.createProgram([file], options, {
    ...ts.createCompilerHost(options),
    getSourceFile: (name) => (name.replaceAll('\\', '/') === file ? source : undefined),
  });
  const checker = program.getTypeChecker();
  const bindings = new Map();
  const supported = new Set();
  const namespaces = new Map();
  const add = (node, runtime, imported = false) => {
    bindings.set(checker.getSymbolAtLocation(node), { name: node.text, runtime, imported });
  };
  function bindingNames(node) {
    if (ts.isIdentifier(node)) add(node, true);
    else
      for (const element of node.elements)
        if (ts.isBindingElement(element)) bindingNames(element.name);
  }
  for (const node of source.statements) {
    if (ts.isImportDeclaration(node) && node.importClause) {
      const { name, namedBindings, isTypeOnly } = node.importClause;
      if (name) add(name, !isTypeOnly, true);
      if (namedBindings && ts.isNamespaceImport(namedBindings)) {
        add(namedBindings.name, !isTypeOnly, true);
        if (!isTypeOnly) namespaces.set(checker.getSymbolAtLocation(namedBindings.name), node);
      }
      for (const item of namedBindings?.elements ?? []) {
        const runtime = !isTypeOnly && !item.isTypeOnly;
        add(item.name, runtime, true);
        if (runtime && importedBase(node, (item.propertyName ?? item.name).text))
          supported.add(checker.getSymbolAtLocation(item.name));
      }
    } else if (ts.isVariableStatement(node) && !ambient(node)) {
      for (const declaration of node.declarationList.declarations) bindingNames(declaration.name);
    } else if (node.name && ts.isIdentifier(node.name)) {
      const runtime =
        !ambient(node) &&
        (ts.isClassDeclaration(node) ||
          (ts.isFunctionDeclaration(node) && !!node.body) ||
          (ts.isEnumDeclaration(node) &&
            !node.modifiers?.some(({ kind }) => kind === ts.SyntaxKind.ConstKeyword)));
      add(node.name, runtime);
    }
  }
  const runtimeImports = new Set();
  each(source, (node) => {
    const symbol = reference(checker, node);
    if (bindings.get(symbol)?.imported) runtimeImports.add(symbol);
  });
  for (const [symbol, binding] of bindings)
    if (binding.imported && !runtimeImports.has(symbol)) binding.runtime = false;

  const classes = source.statements.filter((node) => ts.isClassDeclaration(node) && node.name);
  const methods = new Map();
  for (const node of classes) {
    const base = node.heritageClauses?.find(({ token }) => token === ts.SyntaxKind.ExtendsKeyword)
      ?.types[0]?.expression;
    if (!base || ambient(node) || node.modifiers?.some(ts.isDecorator)) continue;
    const qualified =
      ts.isPropertyAccessExpression(base) &&
      namespaces.get(checker.getSymbolAtLocation(base.expression));
    if (
      !(ts.isIdentifier(base) && supported.has(checker.getSymbolAtLocation(base))) &&
      !(qualified && importedBase(qualified, base.name.text))
    )
      continue;
    supported.add(checker.getSymbolAtLocation(node.name));
    const builds = node.members.filter(
      (member) =>
        ts.isMethodDeclaration(member) &&
        ts.isIdentifier(member.name) &&
        member.name.text === 'build',
    );
    if (builds.length !== 1) continue;
    const [method] = builds;
    if (
      !method.body ||
      method.asteriskToken ||
      method.modifiers?.some(
        (modifier) =>
          ts.isDecorator(modifier) ||
          [ts.SyntaxKind.StaticKeyword, ts.SyntaxKind.AsyncKeyword].includes(modifier.kind),
      ) ||
      method.parameters.some(
        (parameter) =>
          !ts.isIdentifier(parameter.name) ||
          parameter.initializer ||
          parameter.dotDotDotToken ||
          parameter.modifiers?.length,
      )
    )
      continue;
    const methodId = node.name.text + '.build';
    const candidate = compileMethod(source, method, checker, bindings);
    if (!candidate.reason) {
      methods.set(methodId, {
        node: method,
        ...candidate,
        body: method.body.getText(source),
      });
    }
  }
  const methodNodes = new Set([...methods.values()].map(({ node }) => node));
  const excludedBodies = ts.transform(source, [
    (context) => {
      const visit = (node) => {
        if (!methodNodes.has(node)) return ts.visitEachChild(node, visit, context);
        return context.factory.updateMethodDeclaration(
          node,
          node.modifiers,
          node.asteriskToken,
          node.name,
          node.questionToken,
          node.typeParameters,
          node.parameters,
          node.type,
          context.factory.createBlock([]),
        );
      };
      return (node) => ts.visitNode(node, visit);
    },
  ]);
  let shape;
  try {
    shape = digest(printer.printFile(excludedBodies.transformed[0]));
  } finally {
    excludedBodies.dispose();
  }
  return {
    shape,
    methods,
    bindings: new Set(
      [...bindings.values()].filter(({ runtime }) => runtime).map(({ name }) => name),
    ),
  };
}

export const widgetRuntimeId = 'virtual:nelyx-widget-runtime';
export const widgetUpdateId = 'virtual:nelyx-widget-update/';

export function instrumentWidgetModule(text, id, { shape, methods }, bindings) {
  if (!methods.size) return;
  let register = '__nelyxRegisterWidget';
  let dispatch = '__nelyxDispatchBuild';
  while (text.includes(register)) register += '_';
  while (text.includes(dispatch)) dispatch += '_';
  let code = text;
  // Insert from the end so original locations are valid throughout this pass.
  for (const [name, { node }] of [...methods].reverse()) {
    const offset = node.body.getStart() + 1;
    const result = dispatch + 'Result';
    code =
      code.slice(0, offset) +
      ` const ${result} = ${dispatch}(${JSON.stringify(name)}, this, arguments); if (${result}) return ${result}.value;\n` +
      code.slice(offset);
  }
  const accessors = [...bindings].map(
    (name) => `get [${JSON.stringify(name)}]() { return ${name}; }`,
  );
  return (
    `import { registerWidgetModule as ${register} } from ${JSON.stringify(widgetRuntimeId)};\n` +
    `const ${dispatch} = ${register}(${JSON.stringify(id)}, ${JSON.stringify(shape)}, {${accessors.join(',\n')}});\n` +
    code
  );
}

export function widgetUpdateModule(updates) {
  return (
    'export default [' +
    [...updates]
      .map(
        ([id, { shape, methods }]) =>
          `[${JSON.stringify(id)}, ${JSON.stringify(shape)}, [` +
          [...methods]
            .map(([name, { factory }]) => `[${JSON.stringify(name)}, ${factory}]`)
            .join(',\n') +
          ']]',
      )
      .join(',\n') +
    '];'
  );
}
