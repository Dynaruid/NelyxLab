// SPDX-License-Identifier: BSD-3-Clause
'use strict';

/** Eliminate only redundant checks on a function's locally written bindings.
 * A successful temporalRef proves a value is not Babel's TDZ sentinel. Literal
 * primitives and fresh expressions prove the same fact. Unknown writes revoke
 * the proof; branches intersect it; loops and exception edges start afresh.
 * Never infer initialization from a TypeScript annotation or a variable name. */
module.exports = (program, t, helper) => {
  if (!helper) return { checked: 0, removed: 0 };
  program.scope.crawl();
  const helperBinding = program.scope.getBinding(helper.name);
  if (!helperBinding || !helperBinding.constant) return { checked: 0, removed: 0 };
  let dynamic = false;
  program.traverse({
    ReferencedIdentifier(path) {
      // A nested direct eval can write an enclosing binding without a recorded
      // reference. Leave the entire module on the existing checked path.
      if (path.node.name === 'eval') dynamic = true;
    },
    WithStatement() {
      dynamic = true;
    },
  });
  const counts = { checked: 0, removed: 0 };
  if (dynamic) return counts;
  const intersect = (a, b) => {
    if (!a) return b;
    if (!b) return a;
    return new Set([...a].filter((binding) => b.has(binding)));
  };
  program.traverse({
    Function: {
      exit(fn) {
        if (!fn.get('body').isBlockStatement()) return;
        const locals = new Set();
        for (const binding of Object.values(fn.scope.bindings)) {
          // Sloppy arguments can write parameters. A captured write, including a
          // deferred class field/static block, can run during an arbitrary call.
          // Read-only captures cannot change the sentinel identity being proved.
          if (binding.kind === 'param') continue;
          if (
            binding.constantViolations.every((reference) => {
              if (reference.getFunctionParent() !== fn) return false;
              for (
                let parent = reference.parentPath;
                parent && parent !== fn;
                parent = parent.parentPath
              )
                if (parent.isClass()) return false;
              return true;
            })
          )
            locals.add(binding);
        }
        const local = (path) => {
          if (!path.isIdentifier()) return undefined;
          const binding = path.scope.getBinding(path.node.name);
          return locals.has(binding) ? binding : undefined;
        };
        const fresh = (path, known) => {
          if (!path.node) return false;
          if (path.isIdentifier()) return known.has(local(path));
          return (
            path.isLiteral() ||
            path.isArrayExpression() ||
            path.isObjectExpression() ||
            path.isFunctionExpression() ||
            path.isArrowFunctionExpression() ||
            path.isUnaryExpression() ||
            path.isBinaryExpression() ||
            path.isUpdateExpression() ||
            path.isTemplateLiteral()
          );
        };
        const write = (target, value, known) => {
          const binding = local(target);
          if (!binding) {
            // Destructuring can initialize several locals and execute defaults.
            if (!target.isIdentifier() && !target.isMemberExpression()) known.clear();
            return;
          }
          if (fresh(value, known)) known.add(binding);
          else known.delete(binding);
        };
        const expression = (path, known) => {
          if (!path?.node) return;
          if (path.isIdentifier() || path.isLiteral() || path.isThisExpression() || path.isSuper())
            return;
          if (path.isFunctionExpression() || path.isArrowFunctionExpression()) return;
          if (path.isCallExpression() || path.isNewExpression()) {
            if (path.node.arguments.some((argument) => t.isSpreadElement(argument))) {
              known.clear();
              return;
            }
            expression(path.get('callee'), known);
            for (const argument of path.get('arguments')) expression(argument, known);
            const args = path.get('arguments');
            if (
              path.isCallExpression() &&
              path.get('callee').isIdentifier() &&
              path.scope.getBinding(path.node.callee.name) === helperBinding &&
              args.length === 2 &&
              args[1].isStringLiteral()
            ) {
              const binding = local(args[0]);
              if (binding) {
                counts.checked++;
                if (known.has(binding)) {
                  const value = t.cloneNode(args[0].node);
                  value.loc = path.node.loc;
                  path.replaceWith(value);
                  counts.removed++;
                } else known.add(binding);
              }
            }
            return;
          }
          if (path.isSequenceExpression()) {
            for (const item of path.get('expressions')) expression(item, known);
            return;
          }
          if (path.isLogicalExpression() || path.isConditionalExpression()) {
            const conditional = path.isConditionalExpression();
            expression(path.get(conditional ? 'test' : 'left'), known);
            const a = new Set(known),
              b = new Set(known);
            expression(path.get(conditional ? 'consequent' : 'right'), a);
            if (conditional) expression(path.get('alternate'), b);
            const merged = intersect(a, b);
            known.clear();
            for (const binding of merged) known.add(binding);
            return;
          }
          if (path.isAssignmentExpression()) {
            if (['&&=', '||=', '??='].includes(path.node.operator)) {
              known.clear();
              return;
            }
            const left = path.get('left');
            if (!left.isIdentifier() && !left.isMemberExpression()) {
              known.clear();
              return;
            }
            expression(left, known);
            expression(path.get('right'), known);
            if (path.node.operator === '=') write(left, path.get('right'), known);
            else if (local(left)) known.add(local(left)); // Compound arithmetic returns a primitive.
            return;
          }
          if (path.isUpdateExpression()) {
            expression(path.get('argument'), known);
            if (local(path.get('argument'))) known.add(local(path.get('argument')));
            return;
          }
          if (path.isMemberExpression() || path.isBinaryExpression()) {
            expression(path.get(path.isMemberExpression() ? 'object' : 'left'), known);
            if (path.isBinaryExpression() || path.node.computed)
              expression(path.get(path.isMemberExpression() ? 'property' : 'right'), known);
            return;
          }
          if (path.isUnaryExpression() && path.node.operator !== 'delete') {
            expression(path.get('argument'), known);
            return;
          }
          if (
            path.isArrayExpression() &&
            !path.node.elements.some((item) => t.isSpreadElement(item))
          ) {
            for (const item of path.get('elements')) expression(item, known);
            return;
          }
          if (
            path.isObjectExpression() &&
            path.node.properties.every((item) => t.isObjectProperty(item) || t.isObjectMethod(item))
          ) {
            for (const property of path.get('properties')) {
              if (property.node.computed) expression(property.get('key'), known);
              if (property.isObjectProperty()) expression(property.get('value'), known);
            }
            return;
          }
          // Optional chains, class evaluation, suspension, spreads, delete and
          // future syntax keep their original checks and invalidate all proofs.
          known.clear();
        };
        const statement = (path, known) => {
          if (!path?.node || !known) return known;
          if (path.isBlockStatement()) {
            for (const item of path.get('body')) {
              known = statement(item, known);
              if (!known) break;
            }
          } else if (path.isExpressionStatement()) expression(path.get('expression'), known);
          else if (path.isVariableDeclaration()) {
            for (const declaration of path.get('declarations')) {
              if (!declaration.node.init) continue; // A bare var declaration does not reset a value.
              expression(declaration.get('init'), known);
              write(declaration.get('id'), declaration.get('init'), known);
            }
          } else if (path.isIfStatement()) {
            expression(path.get('test'), known);
            known = intersect(
              statement(path.get('consequent'), new Set(known)),
              statement(path.get('alternate'), new Set(known)),
            );
          } else if (path.isReturnStatement() || path.isThrowStatement()) {
            expression(path.get('argument'), known);
            return null;
          } else if (path.isBreakStatement() || path.isContinueStatement()) return null;
          else if (path.isForStatement()) {
            const init = path.get('init');
            if (init.isVariableDeclaration()) statement(init, known);
            else expression(init, known);
            const iteration = new Set();
            expression(path.get('test'), iteration);
            statement(path.get('body'), iteration);
            expression(path.get('update'), new Set());
            known.clear();
          } else if (path.isForInStatement() || path.isForOfStatement()) {
            expression(path.get('right'), known);
            statement(path.get('body'), new Set());
            known.clear();
          } else if (path.isWhileStatement() || path.isDoWhileStatement()) {
            // Neither a previous iteration nor a break/continue supplies proof.
            expression(path.get('test'), new Set());
            statement(path.get('body'), new Set());
            known.clear();
          } else if (path.isTryStatement()) {
            statement(path.get('block'), new Set());
            if (path.node.handler) statement(path.get('handler').get('body'), new Set());
            statement(path.get('finalizer'), new Set());
            known.clear();
          } else if (path.isSwitchStatement()) {
            expression(path.get('discriminant'), known);
            for (const branch of path.get('cases')) {
              // A case may be reached through its test or through fallthrough.
              let branchKnown = new Set();
              for (const item of branch.get('consequent')) {
                branchKnown = statement(item, branchKnown);
                if (!branchKnown) break;
              }
            }
            known.clear();
          } else if (path.isLabeledStatement()) {
            statement(path.get('body'), new Set());
            known.clear();
          } else if (!path.isFunctionDeclaration() && !path.isEmptyStatement()) known.clear();
          return known;
        };
        statement(fn.get('body'), new Set());
      },
    },
  });
  return counts;
};
