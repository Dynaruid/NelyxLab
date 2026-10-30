// SPDX-License-Identifier: BSD-3-Clause
'use strict';
// The loop head's lexical environment is uninitialized throughout RHS
// evaluation, including closures created there. Babel's block-scoping pass
// misses this environment. Preserve reads and assignment evaluation order
// before lowering the ordinary per-iteration bindings/captures.
module.exports = ({ types: t }) => ({
  visitor: {
    'ClassProperty|ClassPrivateProperty'(field) {
      if (field.node.static || !field.node.value) return;
      // Instance initializers run on construction, after the class definition.
      // Give Babel's TDZ analysis that deferred environment without lowering the
      // native class/field itself. The block-scoping owner removes this marker.
      const value = field.node.value,
        deferred = t.arrowFunctionExpression([], value);
      deferred.extra = { nelyxDeferredField: true };
      deferred.loc = value.loc;
      field.get('value').replaceWith(deferred);
    },
    ForStatement(loop) {
      const init = loop.get('init');
      if (!init.isVariableDeclaration() || !['let', 'const'].includes(init.node.kind)) return;
      const bindings = new Map(
        Object.keys(t.getBindingIdentifiers(init.node)).map((name) => [
          name,
          loop.scope.getBinding(name),
        ]),
      );
      const references = [];
      let captured = false;
      init.traverse({
        Identifier(reference) {
          const binding = bindings.get(reference.node.name);
          if (
            !binding ||
            reference.scope.getBinding(reference.node.name) !== binding ||
            (!reference.isReferencedIdentifier() && !reference.isBindingIdentifier())
          )
            return;
          references.push(reference);
          for (
            let parent = reference.parentPath;
            parent && parent !== init;
            parent = parent.parentPath
          )
            if (parent.isFunction() || parent.isClass()) {
              captured = true;
              break;
            }
        },
      });
      if (!captured) return;
      // Initializer closures retain the initial environment; they must not follow
      // the separate per-iteration cells. Babel only detects body captures.
      const aliases = new Map(
        [...bindings].map(([name]) => [name, loop.scope.generateUidIdentifier(name + 'Initial')]),
      );
      const declaration = init.node,
        kind = declaration.kind;
      for (const reference of references) {
        const replacement = t.cloneNode(aliases.get(reference.node.name));
        replacement.loc = reference.node.loc;
        reference.replaceWith(replacement);
      }
      loop.node.init = t.variableDeclaration(
        kind,
        [...aliases].map(([name, alias]) =>
          t.variableDeclarator(t.identifier(name), t.cloneNode(alias)),
        ),
      );
      let target = loop;
      while (target.parentPath.isLabeledStatement()) target = target.parentPath;
      target.replaceWith(t.blockStatement([declaration, target.node]));
    },
    'ForInStatement|ForOfStatement'(loop, state) {
      const left = loop.node.left;
      if (left.type !== 'VariableDeclaration' || !['let', 'const'].includes(left.kind)) return;
      const bindings = new Map(
        Object.keys(t.getBindingIdentifiers(left)).map((name) => [
          name,
          loop.scope.getBinding(name),
        ]),
      );
      loop.get('right').traverse({
        Identifier(reference) {
          const name = reference.node.name;
          if (!bindings.has(name) || reference.scope.getBinding(name) !== bindings.get(name))
            return;
          if (!reference.isReferencedIdentifier() && !reference.isBindingIdentifier()) return;
          const fail = () =>
            t.callExpression(t.cloneNode(state.file.addHelper('tdz')), [t.stringLiteral(name)]);
          const value = t.memberExpression(
            t.objectExpression([
              t.objectMethod(
                'get',
                t.identifier('value'),
                [],
                t.blockStatement([t.returnStatement(fail())]),
              ),
              t.objectMethod(
                'set',
                t.identifier('value'),
                [reference.scope.generateUidIdentifier('value')],
                t.blockStatement([t.expressionStatement(fail())]),
              ),
            ]),
            t.identifier('value'),
          );
          value.loc = reference.node.loc;
          reference.replaceWith(value);
          reference.skip();
        },
      });
      const right = loop.get('right');
      if (
        right.isIdentifier() &&
        bindings.has(right.node.name) &&
        right.scope.getBinding(right.node.name) === bindings.get(right.node.name)
      )
        right.replaceWith(
          t.callExpression(t.cloneNode(state.file.addHelper('tdz')), [
            t.stringLiteral(right.node.name),
          ]),
        );
      // Babel's TDZ pass resets a lexical for-in/of head inside the loop body,
      // after the engine has assigned its next value. Carry that value through a
      // generated var and initialize the original lexical binding at body entry.
      // The following block-scoping pass still owns per-iteration captures.
      const value = loop.scope.generateUidIdentifier('loopValue'),
        declaration = left.declarations[0];
      loop.node.left = t.variableDeclaration('var', [t.variableDeclarator(t.cloneNode(value))]);
      if (!t.isBlockStatement(loop.node.body)) loop.node.body = t.blockStatement([loop.node.body]);
      loop.node.body.body.unshift(
        t.variableDeclaration(left.kind, [
          t.variableDeclarator(declaration.id, t.cloneNode(value)),
        ]),
      );
    },
  },
});
