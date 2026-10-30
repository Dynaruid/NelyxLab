// SPDX-License-Identifier: BSD-3-Clause
'use strict';
const path = require('node:path');
const { createRequire } = require('node:module');

// Keep the pinned Babel pass responsible for TDZ, readonly bindings and
// per-iteration captures. Its scope.push inserts a dynamic TDZ sentinel for a
// classic for-head into the body, after initialization, resetting live values.
// Such sentinels belong before the head's original initializers, once per loop
// entry. Body-local lexical bindings must still reset on every iteration.
module.exports = (api, { projectRoot }) => {
  const load = createRequire(path.join(projectRoot, 'package.json'));
  const factory = load('@babel/plugin-transform-block-scoping').default;
  const original = factory(api, { tdz: true }, projectRoot),
    t = api.types,
    renamed = new Map();
  return {
    ...original,
    visitor: api.traverse.visitors.merge([
      {
        VariableDeclaration(declaration) {
          if (!['let', 'const'].includes(declaration.node.kind)) return;
          const scope = declaration.scope,
            target = scope.getFunctionParent() || scope.getProgramParent();
          if (scope === target) return;
          // Babel records dynamicTDZNames before renaming shadowed bindings, then
          // injects a sentinel under the old name, resetting the outer binding.
          // Perform that same required rename before validation and sentinel setup.
          for (const name of Object.keys(declaration.getBindingIdentifiers()))
            if (scope.parent.hasBinding(name, { noUids: true }) || scope.parent.hasGlobal(name)) {
              const next = scope.generateUid(name);
              renamed.set(next, name);
              scope.rename(name, next);
            }
        },
      },
      original.visitor,
      {
        Program: {
          exit(program, state) {
            const helpers = new Map(
              ['tdz', 'readOnlyError', 'temporalRef'].flatMap((name) =>
                state.file.declarations[name]
                  ? [[state.file.declarations[name].name, name === 'temporalRef' ? 1 : 0]]
                  : [],
              ),
            );
            if (renamed.size)
              program.traverse({
                CallExpression(call) {
                  if (!t.isIdentifier(call.node.callee) || !helpers.has(call.node.callee.name))
                    return;
                  const argument = call.node.arguments[helpers.get(call.node.callee.name)];
                  if (t.isStringLiteral(argument) && renamed.has(argument.value))
                    argument.value = renamed.get(argument.value);
                },
              });
            const sentinel = state.file.declarations.temporalUndefined;
            if (sentinel)
              program.traverse({
                ForStatement(loop) {
                  const { init, body } = loop.node;
                  if (!t.isVariableDeclaration(init) || !t.isBlockStatement(body)) return;
                  const names = new Set(Object.keys(t.getBindingIdentifiers(init))),
                    moved = [];
                  body.body = body.body.filter((statement) => {
                    if (!t.isVariableDeclaration(statement, { kind: 'var' })) return true;
                    statement.declarations = statement.declarations.filter((declaration) => {
                      if (
                        t.isIdentifier(declaration.id) &&
                        names.has(declaration.id.name) &&
                        t.isIdentifier(declaration.init, { name: sentinel.name })
                      ) {
                        moved.push(declaration);
                        return false;
                      }
                      return true;
                    });
                    return statement.declarations.length > 0;
                  });
                  init.declarations.unshift(...moved);
                },
              });
            program.traverse({
              ArrowFunctionExpression: {
                exit(deferred) {
                  if (!deferred.node.extra?.nelyxDeferredField) return;
                  delete deferred.node.extra.nelyxDeferredField;
                  // An expression needs no runtime wrapper. If another qualified pass
                  // introduced statement-local temporaries, retain its lexical IIFE.
                  deferred.replaceWith(
                    t.isBlockStatement(deferred.node.body)
                      ? t.callExpression(deferred.node, [])
                      : deferred.node.body,
                  );
                },
              },
            });
          },
        },
      },
    ]),
  };
};
