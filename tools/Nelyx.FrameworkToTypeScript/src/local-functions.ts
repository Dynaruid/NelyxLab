// SPDX-License-Identifier: BSD-3-Clause
import ts from 'typescript';

type Callable = { arrow: ts.ArrowFunction; values: Values; types: Types };
type Binding = { value: ts.Expression } | { callable: Callable };
type Values = ReadonlyMap<ts.Symbol, Binding>;
type Types = ReadonlyMap<ts.Symbol, ts.TypeNode>;
export interface LocalFunctionOwner {
  readonly owner: string;
  readonly method: string;
}

/** A generation-time beta reduction, after the normal Dart ABI was validated.
 * Only final local arrows with a single return and exclusively direct calls
 * qualify. Runtime getters/calls are evaluated in their original order. */
export function inlineLocalFunctions(text: string, owners: readonly LocalFunctionOwner[]): string {
  const filename = 'local-functions.ts';
  const source = ts.createSourceFile(
    filename,
    text,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  const options: ts.CompilerOptions = {
    noLib: true,
    noResolve: true,
    target: ts.ScriptTarget.ESNext,
  };
  const host = ts.createCompilerHost(options);
  host.getSourceFile = (file) => (file === filename ? source : undefined);
  host.fileExists = (file) => file === filename;
  host.readFile = (file) => (file === filename ? text : undefined);
  const checker = ts.createProgram([filename], options, host).getTypeChecker();
  const f = ts.factory;
  const names = new Set<string>();
  const references = new Map<ts.Symbol, ts.Identifier[]>();
  const symbol = (node: ts.Identifier): ts.Symbol | undefined =>
    !node.parent
      ? undefined
      : ts.isShorthandPropertyAssignment(node.parent) && node.parent.name === node
        ? checker.getShorthandAssignmentValueSymbol(node.parent)
        : checker.getSymbolAtLocation(node);
  const collect = (node: ts.Node): void => {
    if (ts.isIdentifier(node)) {
      names.add(node.text);
      const key = symbol(node);
      if (key) {
        let rows = references.get(key);
        if (!rows) references.set(key, (rows = []));
        rows.push(node);
      }
    }
    ts.forEachChild(node, collect);
  };
  collect(source);
  let sequence = 0;
  const temporary = (): ts.Identifier => {
    let name: string;
    do name = '_nelyxLocal' + ++sequence;
    while (names.has(name));
    names.add(name);
    return f.createIdentifier(name);
  };
  const directCallsOnly = (key: ts.Symbol, declaration: ts.Identifier): boolean =>
    (references.get(key) ?? []).every(
      (read) =>
        read === declaration ||
        (ts.isCallExpression(read.parent) && read.parent.expression === read),
    );
  const arrowResult = (arrow: ts.ArrowFunction): ts.Expression | undefined => {
    if (
      arrow.modifiers?.length ||
      arrow.parameters.some(
        (p) => !ts.isIdentifier(p.name) || p.dotDotDotToken || p.questionToken || p.initializer,
      )
    )
      return;
    const parameters = new Set(
      arrow.parameters.map((parameter) => symbol(parameter.name as ts.Identifier)),
    );
    let unsafe = false;
    const inspect = (node: ts.Node): void => {
      if (
        ts.isTypeQueryNode(node) ||
        (ts.isIdentifier(node) && parameters.has(symbol(node)) && written(node))
      )
        unsafe = true;
      ts.forEachChild(node, inspect);
    };
    inspect(arrow.body);
    if (unsafe) return;
    if (!ts.isBlock(arrow.body)) return arrow.body;
    const statement = arrow.body.statements[0];
    return arrow.body.statements.length === 1 && statement && ts.isReturnStatement(statement)
      ? statement.expression
      : undefined;
  };
  const thisScope = (node: ts.Node): ts.Node | undefined => {
    for (let at: ts.Node | undefined = node.parent; at; at = at.parent)
      if ((ts.isFunctionLike(at) && !ts.isArrowFunction(at)) || ts.isClassLike(at)) return at;
    return;
  };
  const written = (read: ts.Identifier): boolean => {
    let at: ts.Node = read;
    while (ts.isParenthesizedExpression(at.parent)) at = at.parent;
    const parent = at.parent;
    return (
      (ts.isBinaryExpression(parent) &&
        parent.left === at &&
        parent.operatorToken.kind >= ts.SyntaxKind.FirstAssignment &&
        parent.operatorToken.kind <= ts.SyntaxKind.LastAssignment) ||
      ts.isPrefixUnaryExpression(parent) ||
      ts.isPostfixUnaryExpression(parent) ||
      ts.isSpreadElement(parent) ||
      ts.isArrayLiteralExpression(parent) ||
      ts.isShorthandPropertyAssignment(parent) ||
      ts.isPropertyAssignment(parent) ||
      ((ts.isForInStatement(parent) || ts.isForOfStatement(parent)) && parent.initializer === at)
    );
  };
  const suspends = (root: ts.Node): boolean => {
    if (ts.isFunctionLike(root)) return false;
    if (ts.isAwaitExpression(root) || ts.isYieldExpression(root)) return true;
    return !!ts.forEachChild(root, (node) => suspends(node) || undefined);
  };
  const replacements = new Map<ts.MethodDeclaration, ts.MethodDeclaration>();
  const transformed = ts.transform(source, [
    (context) => {
      return (file) => {
        for (const owner of source.statements) {
          if (!ts.isClassDeclaration(owner) || !owner.name) continue;
          for (const method of owner.members) {
            if (
              !ts.isMethodDeclaration(method) ||
              !ts.isIdentifier(method.name) ||
              !method.body ||
              !owners.some(
                (entry) =>
                  entry.owner === owner.name!.text && entry.method === method.name.getText(source),
              )
            )
              continue;
            let dynamicScope = false;
            const inspectScope = (node: ts.Node): void => {
              if (
                ts.isCallExpression(node) &&
                ts.isIdentifier(node.expression) &&
                node.expression.text === 'eval'
              )
                dynamicScope = true;
              ts.forEachChild(node, inspectScope);
            };
            inspectScope(method.body);
            if (dynamicScope) continue;
            const candidates = new Map<ts.Symbol, ts.ArrowFunction>();
            for (const statement of method.body.statements) {
              if (
                !ts.isVariableStatement(statement) ||
                !(statement.declarationList.flags & ts.NodeFlags.Const)
              )
                continue;
              for (const declaration of statement.declarationList.declarations) {
                if (
                  !ts.isIdentifier(declaration.name) ||
                  !declaration.initializer ||
                  !ts.isArrowFunction(declaration.initializer)
                )
                  continue;
                const key = symbol(declaration.name);
                if (
                  key &&
                  arrowResult(declaration.initializer) &&
                  directCallsOnly(key, declaration.name)
                )
                  candidates.set(key, declaration.initializer);
              }
            }
            if (!candidates.size) continue;
            const pure = (node: ts.Expression, values: Values, site: ts.Node): boolean => {
              if (ts.isParenthesizedExpression(node) || ts.isNonNullExpression(node))
                return pure(node.expression, values, site);
              if (
                ts.isLiteralExpression(node) ||
                node.kind === ts.SyntaxKind.NullKeyword ||
                node.kind === ts.SyntaxKind.TrueKeyword ||
                node.kind === ts.SyntaxKind.FalseKeyword
              )
                return true;
              if (!ts.isIdentifier(node)) return false;
              const key = symbol(node);
              if (!key) return false;
              if (values.has(key)) return true;
              const declaration = key.valueDeclaration;
              return (
                !!declaration &&
                ((ts.isVariableDeclaration(declaration) &&
                  declaration.end < site.pos &&
                  ts.isVariableDeclarationList(declaration.parent) &&
                  !!(declaration.parent.flags & ts.NodeFlags.Const)) ||
                  (ts.isParameter(declaration) &&
                    (references.get(key) ?? []).every(
                      (read) => read === declaration.name || !written(read),
                    )))
              );
            };
            const available = (callable: Callable, site: ts.Node): boolean => {
              let valid = thisScope(callable.arrow) === thisScope(site);
              const inspect = (node: ts.Node): void => {
                if (!valid) return;
                if (ts.isTypeNode(node)) return;
                if (
                  node.kind === ts.SyntaxKind.SuperKeyword ||
                  ts.isMetaProperty(node) ||
                  (ts.isIdentifier(node) && (node.text === 'arguments' || node.text === 'eval'))
                ) {
                  valid = false;
                  return;
                }
                if (ts.isIdentifier(node)) {
                  if (
                    (ts.isPropertyAccessExpression(node.parent) && node.parent.name === node) ||
                    (ts.isPropertyAssignment(node.parent) && node.parent.name === node)
                  )
                    return;
                  const key = symbol(node),
                    declaration = key?.valueDeclaration;
                  if (
                    (!key || !callable.values.has(key)) &&
                    !(
                      declaration &&
                      declaration.pos >= callable.arrow.pos &&
                      declaration.end <= callable.arrow.end
                    ) &&
                    checker.resolveName(node.text, site, ts.SymbolFlags.Value, false) !== key
                  )
                    valid = false;
                }
                ts.forEachChild(node, inspect);
              };
              inspect(callable.arrow.body);
              return valid;
            };
            const lower = (
              root: ts.Node,
              values: Values,
              types: Types,
              active: ReadonlySet<ts.ArrowFunction>,
              site: ts.Node,
            ): ts.Node => {
              const visit = (node: ts.Node): ts.VisitResult<ts.Node> => {
                if (ts.isShorthandPropertyAssignment(node) && values.has(symbol(node.name)!))
                  return f.createPropertyAssignment(
                    node.name,
                    lower(node.name, values, types, active, site) as ts.Expression,
                  );
                if (
                  ts.isTypeReferenceNode(node) &&
                  ts.isIdentifier(node.typeName) &&
                  !node.typeArguments?.length
                ) {
                  const key = symbol(node.typeName),
                    replacement = key && types.get(key);
                  if (replacement) return replacement;
                }
                if (ts.isCallExpression(node) && ts.isIdentifier(node.expression)) {
                  const key = symbol(node.expression),
                    binding = key && values.get(key);
                  const arrow = key && candidates.get(key);
                  const callable =
                    binding && 'callable' in binding
                      ? binding.callable
                      : arrow && node.pos > arrow.end
                        ? { arrow, values: new Map(), types: new Map() }
                        : undefined;
                  const actualSite = active.size ? site : node;
                  if (
                    callable &&
                    !active.has(callable.arrow) &&
                    active.size < 16 &&
                    !node.arguments.some(ts.isSpreadElement) &&
                    !node.arguments.some(suspends) &&
                    node.arguments.length === callable.arrow.parameters.length &&
                    (node.typeArguments?.length ?? 0) ===
                      (callable.arrow.typeParameters?.length ?? 0) &&
                    available(callable, actualSite)
                  ) {
                    const result = arrowResult(callable.arrow);
                    if (result) {
                      const innerValues = new Map(callable.values),
                        innerTypes = new Map(callable.types);
                      callable.arrow.typeParameters?.forEach((p, index) => {
                        const parameter = symbol(p.name);
                        if (parameter)
                          innerTypes.set(
                            parameter,
                            lower(
                              node.typeArguments![index]!,
                              values,
                              types,
                              active,
                              actualSite,
                            ) as ts.TypeNode,
                          );
                      });
                      const inputs: {
                        value: ts.Expression;
                        token: ts.Identifier;
                        type: ts.TypeNode | undefined;
                      }[] = [];
                      callable.arrow.parameters.forEach((parameter, index) => {
                        const key = symbol(parameter.name as ts.Identifier)!,
                          arg = node.arguments[index]!;
                        const argumentBinding = ts.isIdentifier(arg)
                          ? values.get(symbol(arg)!)
                          : undefined;
                        const literal = ts.isArrowFunction(arg)
                          ? { arrow: arg, values, types }
                          : undefined;
                        if (
                          directCallsOnly(key, parameter.name as ts.Identifier) &&
                          ((argumentBinding && 'callable' in argumentBinding) ||
                            (literal && arrowResult(literal.arrow)))
                        ) {
                          innerValues.set(
                            key,
                            argumentBinding && 'callable' in argumentBinding
                              ? argumentBinding
                              : { callable: literal! },
                          );
                        } else {
                          const value = lower(
                            arg,
                            values,
                            types,
                            active,
                            actualSite,
                          ) as ts.Expression;
                          if (pure(arg, values, actualSite)) innerValues.set(key, { value });
                          else {
                            const token = temporary();
                            innerValues.set(key, { value: token });
                            inputs.push({
                              value,
                              token,
                              type: parameter.type
                                ? (lower(
                                    parameter.type,
                                    values,
                                    innerTypes,
                                    active,
                                    actualSite,
                                  ) as ts.TypeNode)
                                : undefined,
                            });
                          }
                        }
                      });
                      const nested = new Set(active);
                      nested.add(callable.arrow);
                      const body = lower(
                        result,
                        innerValues,
                        innerTypes,
                        nested,
                        actualSite,
                      ) as ts.Expression;
                      const used = new Set<ts.Node>();
                      const collect = (value: ts.Node): void => {
                        used.add(value);
                        ts.forEachChild(value, collect);
                      };
                      collect(body);
                      if (!inputs.some((input) => used.has(input.token))) {
                        return inputs.length
                          ? f.createParenthesizedExpression(
                              f.createCommaListExpression([
                                ...inputs.map((input) => f.createVoidExpression(input.value)),
                                body,
                              ]),
                            )
                          : f.createParenthesizedExpression(body);
                      }
                      return f.createCallExpression(
                        f.createParenthesizedExpression(
                          f.createArrowFunction(
                            undefined,
                            undefined,
                            [],
                            undefined,
                            undefined,
                            f.createBlock(
                              [
                                ...inputs.map((input) =>
                                  used.has(input.token)
                                    ? f.createVariableStatement(
                                        undefined,
                                        f.createVariableDeclarationList(
                                          [
                                            f.createVariableDeclaration(
                                              input.token,
                                              undefined,
                                              input.type,
                                              input.value,
                                            ),
                                          ],
                                          ts.NodeFlags.Const,
                                        ),
                                      )
                                    : f.createExpressionStatement(input.value),
                                ),
                                f.createReturnStatement(body),
                              ],
                              true,
                            ),
                          ),
                        ),
                        undefined,
                        [],
                      );
                    }
                  }
                }
                if (ts.isIdentifier(node)) {
                  const key = symbol(node),
                    binding = key && values.get(key);
                  if (binding) {
                    if ('value' in binding) return binding.value;
                    return lower(
                      binding.callable.arrow,
                      binding.callable.values,
                      binding.callable.types,
                      active,
                      site,
                    );
                  }
                }
                const result = ts.visitEachChild(node, visit, context);
                if (
                  ts.isBinaryExpression(result) &&
                  result.operatorToken.kind === ts.SyntaxKind.QuestionQuestionToken
                ) {
                  const parts: ts.Expression[] = [];
                  const unwrap = (value: ts.Expression): ts.Expression =>
                    ts.isParenthesizedExpression(value) ? unwrap(value.expression) : value;
                  const collect = (value: ts.Expression): void => {
                    const inner = unwrap(value);
                    if (
                      ts.isBinaryExpression(inner) &&
                      inner.operatorToken.kind === ts.SyntaxKind.QuestionQuestionToken
                    ) {
                      collect(inner.left);
                      collect(inner.right);
                    } else parts.push(value);
                  };
                  collect(result);
                  // ?? is associative. Only intermediate literal nulls are
                  // dead; preserve the final null and all executable reads.
                  const retained = parts.filter(
                    (value, index) =>
                      index === parts.length - 1 ||
                      unwrap(value).kind !== ts.SyntaxKind.NullKeyword,
                  );
                  return retained
                    .slice(1)
                    .reduce<ts.Expression>(
                      (left, right) =>
                        f.createBinaryExpression(left, ts.SyntaxKind.QuestionQuestionToken, right),
                      retained[0]!,
                    );
                }
                return result;
              };
              return ts.visitNode(root, visit)!;
            };
            const statements = method.body.statements.map(
              (statement) =>
                lower(statement, new Map(), new Map(), new Set(), statement) as ts.Statement,
            );
            // Reachability starts at the method's real statements. An unused
            // helper referring to another helper must not keep either closure.
            const definitions = new Map<ts.Symbol, ts.Statement>();
            for (const statement of statements)
              if (
                ts.isVariableStatement(statement) &&
                statement.declarationList.declarations.length === 1
              ) {
                const declaration = statement.declarationList.declarations[0]!;
                if (ts.isIdentifier(declaration.name)) {
                  const key = symbol(declaration.name);
                  if (key && candidates.has(key)) definitions.set(key, statement);
                }
              }
            const live = new Set<ts.Symbol>();
            const mark = (node: ts.Node): void => {
              if (ts.isIdentifier(node)) {
                const key = symbol(node);
                if (key && definitions.has(key) && !live.has(key)) {
                  live.add(key);
                  ts.forEachChild(definitions.get(key)!, mark);
                }
              }
              ts.forEachChild(node, mark);
            };
            for (const statement of statements)
              if (![...definitions.values()].includes(statement)) mark(statement);
            const dead = new Set(
              [...definitions].filter(([key]) => !live.has(key)).map(([, statement]) => statement),
            );
            replacements.set(
              method,
              f.updateMethodDeclaration(
                method,
                method.modifiers,
                method.asteriskToken,
                method.name,
                method.questionToken,
                method.typeParameters,
                method.parameters,
                method.type,
                f.updateBlock(
                  method.body,
                  statements.filter((statement) => !dead.has(statement)),
                ),
              ),
            );
          }
        }
        const visit: ts.Visitor = (node) =>
          replacements.get(node as ts.MethodDeclaration) ?? ts.visitEachChild(node, visit, context);
        return ts.visitNode(file, visit) as ts.SourceFile;
      };
    },
  ]);
  try {
    const output = transformed.transformed[0]!;
    const used = new Set<ts.Symbol>();
    const inspect = (node: ts.Node): void => {
      if (ts.isImportDeclaration(node)) return;
      if (ts.isIdentifier(node)) {
        const key = symbol(node);
        if (key) used.add(key);
      }
      ts.forEachChild(node, inspect);
    };
    inspect(output);
    const statements = output.statements.flatMap((statement) => {
      if (
        !ts.isImportDeclaration(statement) ||
        !statement.importClause?.isTypeOnly ||
        !statement.importClause.namedBindings ||
        !ts.isNamedImports(statement.importClause.namedBindings)
      )
        return [statement];
      const clause = statement.importClause,
        bindings = clause.namedBindings as ts.NamedImports;
      const elements = bindings.elements.filter((element) => used.has(symbol(element.name)!));
      if (!elements.length) return [];
      return [
        f.updateImportDeclaration(
          statement,
          statement.modifiers,
          f.updateImportClause(clause, true, clause.name, f.updateNamedImports(bindings, elements)),
          statement.moduleSpecifier,
          statement.attributes,
        ),
      ];
    });
    return ts
      .createPrinter({ newLine: ts.NewLineKind.LineFeed })
      .printFile(f.updateSourceFile(output, statements));
  } finally {
    transformed.dispose();
  }
}
