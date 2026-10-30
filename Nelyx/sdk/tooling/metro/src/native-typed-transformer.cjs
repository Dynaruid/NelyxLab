// SPDX-License-Identifier: BSD-3-Clause
'use strict';
const fs = require('node:fs'),
  path = require('node:path'),
  { createHash } = require('node:crypto');
const upstream = require('./native-hermes-transformer.cjs');
const { AsyncLocalStorage } = require('node:async_hooks'),
  evidenceScope = new AsyncLocalStorage();
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
module.exports.compilerPolicy = 'nelyx.hermes-typed-adapter/v2';
function plan(options) {
  const bytes = options.customTransformOptions?.nelyxTypedPlan;
  if (typeof bytes !== 'string')
    throw Error('Typed Metro transform requires an explicit owned plan');
  if (hash(bytes) !== options.customTransformOptions.nelyxTypedPlanSha256)
    throw Error('Typed Metro plan hash changed');
  const value = JSON.parse(bytes);
  if (
    value.schema !== 'nelyx.typed-metro-plan/v1' ||
    !Array.isArray(value.files) ||
    value.files.length > 4096
  )
    throw Error('Invalid typed Metro plan');
  return value;
}
// The owning worker stores this evidence in the same Metro cache entry as code.
// Async scope also keeps concurrent transformations from exchanging evidence.
module.exports.withEvidence = async (action) => {
  let evidence;
  const result = await evidenceScope.run((value) => {
    if (evidence) throw Error('Duplicate typed transform evidence');
    evidence = value;
  }, action);
  return { result, evidence };
};
module.exports.getCacheKey = () =>
  hash(
    Buffer.concat([
      fs.readFileSync(__filename),
      fs.readFileSync(require.resolve('./frontend-elimination.cjs')),
      Buffer.from(upstream.getCacheKey()),
    ]),
  );
module.exports.transform = ({ src, filename, options, plugins = [] }) => {
  if (options.platform !== 'windows' || options.dev)
    throw Error('Static Hermes AOT adapters require Windows Release');
  const value = plan(options),
    actual = path.resolve(options.projectRoot, filename),
    selected = value.files.find(
      (item) => path.resolve(item.file).toLowerCase() === actual.toLowerCase(),
    );
  if (selected && hash(src) !== selected.sha256)
    throw Error('Typed Metro source changed after partition: ' + filename);
  const adapter = ({ template, types }) => {
    const found = new Set();
    const topLevel = (node) =>
      node?.parentPath?.isProgram() ||
      ((node?.parentPath?.isExportNamedDeclaration() ||
        node?.parentPath?.isExportDefaultDeclaration()) &&
        node.parentPath.parentPath.isProgram());
    const replace = (node, item) => {
      if (found.has(item.id)) throw Error('Duplicate typed callable identity');
      found.add(item.id);
      const original = node.node.body,
        body = template.statement.ast('{' + item.adapter + '}');
      body.loc = original.loc;
      if (item.guard) {
        const guard = template.expression.ast(item.guard);
        original.body.unshift(types.ifStatement(guard, body));
      } else node.get('body').replaceWith(body);
    };
    const visitors = {
      FunctionDeclaration(node) {
        if (!topLevel(node)) return;
        const item = selected?.bindings.find(
          (item) => !item.className && node.node.id?.name === item.name,
        );
        if (item) replace(node, item);
      },
      ClassMethod(node) {
        const owner = node.findParent((parent) => parent.isClassDeclaration());
        if (!topLevel(owner)) return;
        const className = owner.node.id?.name,
          item = selected?.bindings.find(
            (item) =>
              item.className === className &&
              node.node.kind === 'method' &&
              !node.node.computed &&
              node.node.key.name === item.name,
          );
        if (item) replace(node, item);
      },
    };
    // RN lowers a Class before visiting its methods. Adapt the original tree
    // in Program.enter, then let the normal RN/consumer Babel passes proceed.
    return {
      visitor: {
        Program: {
          enter(root) {
            root.traverse(visitors);
            if (found.size !== (selected?.bindings.length ?? 0))
              throw Error('Typed Metro adapters did not consume every selected body: ' + filename);
          },
        },
      },
    };
  };
  const result = upstream.transform({ src, filename, options, plugins: [adapter, ...plugins] });
  const evidence = {
    schema: 'nelyx.metro-native-evidence/v1',
    elimination: require('./frontend-elimination.cjs')(result.ast, src, filename, options),
    consumed: selected
      ? { sha256: selected.sha256, bindings: selected.bindings.map((binding) => binding.id) }
      : null,
  };
  if (!selected) {
    evidenceScope.getStore()?.(evidence);
    return result;
  }
  const calls = new Set(),
    visit = (node) => {
      if (!node || typeof node !== 'object') return;
      if (
        node.type === 'CallExpression' &&
        node.callee.type === 'MemberExpression' &&
        node.callee.object.type === 'Identifier' &&
        node.callee.object.name === 'globalThis'
      )
        calls.add(node.callee.computed ? node.callee.property.value : node.callee.property.name);
      for (const [key, value] of Object.entries(node))
        if (!['loc', 'start', 'end', 'extra'].includes(key)) {
          if (Array.isArray(value)) value.forEach(visit);
          else if (value && typeof value === 'object') visit(value);
        }
    };
  visit(result?.ast);
  if (selected.bindings.some((binding) => !calls.has(binding.globalName)))
    throw Error('Typed adapter was removed by the Babel pipeline: ' + filename);
  evidenceScope.getStore()?.(evidence);
  return result;
};
