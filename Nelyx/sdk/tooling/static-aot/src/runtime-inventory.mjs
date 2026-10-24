// SPDX-License-Identifier: BSD-3-Clause
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {parse} from '@babel/parser';
import hermesParser from 'hermes-parser';

const hash = value => createHash('sha256').update(value).digest('hex');
const compare = (a, b) => a < b ? -1 : a > b ? 1 : 0;
const callables = new Set(['FunctionDeclaration', 'FunctionExpression', 'ArrowFunctionExpression', 'ObjectMethod', 'ClassMethod', 'ClassPrivateMethod', 'ComponentDeclaration', 'HookDeclaration']);
const typeKeys = new Set(['typeAnnotation', 'returnType', 'typeParameters', 'typeArguments', 'superTypeParameters', 'superTypeArguments', 'implements', 'predicate']);
const load = createRequire(import.meta.url);
const parserVersions = {typescriptJavascript: load('@babel/parser/package.json').version, flow: load('hermes-parser/package.json').version};
if (parserVersions.typescriptJavascript !== '7.29.9' || parserVersions.flow !== '0.32.0') throw Error('Runtime inventory parser supply differs');
const typeOnly = node => /^(?:TS|Declare)/.test(node.type) && !['TSAsExpression', 'TSSatisfiesExpression', 'TSNonNullExpression', 'TSTypeAssertion', 'TSEnumDeclaration', 'TSEnumMember', 'TSModuleDeclaration', 'TSModuleBlock', 'TSImportEqualsDeclaration', 'TSParameterProperty', 'TSExportAssignment', 'TSInstantiationExpression'].includes(node.type)
  || ['TypeAlias', 'OpaqueType', 'InterfaceDeclaration', 'TypeParameterDeclaration', 'TypeParameterInstantiation'].includes(node.type)
  || (node.type === 'ImportDeclaration' && ['type', 'typeof'].includes(node.importKind))
  || (node.type === 'ExportNamedDeclaration' && node.exportKind === 'type');

function runtimeComponents(modules) {
  // Iterative Kosaraju traversal keeps the admitted whole graph independent of
  // the JavaScript call-stack depth. Unresolved edges remain reported elsewhere.
  const forward = new Map(modules.map(module => [module.id, module.dependencies.flatMap(edge => edge.target === null ? [] : [edge.target]).sort(compare)]));
  const reverse = new Map(modules.map(module => [module.id, []]));
  for (const [from, targets] of forward) for (const to of targets) reverse.get(to).push(from);
  const visited = new Set(), order = [];
  for (const root of [...forward.keys()].sort(compare)) {
    if (visited.has(root)) continue;
    visited.add(root); const stack = [[root, 0]];
    while (stack.length) {
      const frame = stack.at(-1), targets = forward.get(frame[0]);
      if (frame[1] === targets.length) {order.push(frame[0]); stack.pop(); continue;}
      const target = targets[frame[1]++];
      if (!visited.has(target)) {visited.add(target); stack.push([target, 0]);}
    }
  }
  visited.clear(); const result = [];
  for (const root of order.reverse()) {
    if (visited.has(root)) continue;
    const component = [], stack = [root]; visited.add(root);
    while (stack.length) {
      const id = stack.pop(); component.push(id);
      for (const next of reverse.get(id)) if (!visited.has(next)) {visited.add(next); stack.push(next);}
    }
    result.push(component.sort(compare));
  }
  return result.sort((a, b) => compare(a[0], b[0]));
}

/** A conservative syntactic inventory, never a type IR or native coverage receipt. */
export function inventoryBody(source, {filename, dialect = 'javascript', maxBodies = 200_000, releaseDefines = null} = {}) {
  if (typeof source !== 'string' || typeof filename !== 'string' || /\.d\.[cm]?ts$/.test(filename)) throw Error('An implementation body and filename are required');
  if (!['javascript', 'typescript', 'flow'].includes(dialect)) throw Error('Unknown runtime source dialect');
  const plugins = ['jsx', ...(dialect === 'typescript' ? ['typescript'] : dialect === 'flow' ? [['flow', {all: true}], 'flowComments'] : [])];
  let ast;
  try { ast = dialect === 'flow' ? hermesParser.parse(source, {sourceType: 'unambiguous', flow: 'all', babel: false}) : parse(source, {sourceType: 'unambiguous', plugins, errorRecovery: false, allowReturnOutsideFunction: true}); }
  catch (error) { throw Error(`NELYX_RUNTIME_PARSE ${filename}:${error.loc?.line ?? 1}:${(error.loc?.column ?? 0) + 1}: ${error.message}`, {cause: error}); }
  const bodies = [], features = [], dependencies = [];
  const position = node => ({offset: node.start ?? node.range[0], end: node.end ?? node.range[1], line: node.loc.start.line, column: node.loc.start.column + 1});
  const shadows=new Set();
  const bind=node=>{if(!node)return;if(node.type==='Identifier')shadows.add(node.name);else if(node.type==='TSParameterProperty')bind(node.parameter);else if(node.type==='RestElement')bind(node.argument);else if(node.type==='AssignmentPattern')bind(node.left);else if(node.type==='ObjectPattern')for(const property of node.properties)bind(property.value??property.argument);else if(node.type==='ArrayPattern')for(const element of node.elements)bind(element);};
  const bindings=node=>{if(!node||typeof node.type!=='string'||typeOnly(node))return;if(node.type==='VariableDeclarator')bind(node.id);if(callables.has(node.type)){for(const parameter of node.params??[])bind(parameter);bind(node.id);}if(node.type==='CatchClause')bind(node.param);if(['ImportSpecifier','ImportDefaultSpecifier','ImportNamespaceSpecifier'].includes(node.type))bind(node.local);if(['ClassDeclaration','ClassExpression'].includes(node.type))bind(node.id);if(node.type==='WithStatement'||node.type==='CallExpression'&&node.callee.type==='Identifier'&&node.callee.name==='eval'){shadows.add('__DEV__');shadows.add('process');}for(const [key,value]of Object.entries(node)){if(typeKeys.has(key)||['loc','comments','tokens'].includes(key))continue;if(Array.isArray(value))value.forEach(bindings);else if(value&&typeof value.type==='string')bindings(value);}};bindings(ast.program??ast);
  const unknown=Symbol('unknown');
  const constant=node=>{
    if(!node)return unknown;
    if(node.type==='NullLiteral')return null;
    if(['BooleanLiteral','NumericLiteral','StringLiteral','NullLiteral','Literal'].includes(node.type)&&!node.regex&&typeof node.value!=='bigint')return node.value;
    if(node.type==='Identifier'&&node.name==='__DEV__'&&releaseDefines&&Object.hasOwn(releaseDefines,'__DEV__')&&!shadows.has('__DEV__'))return releaseDefines.__DEV__;
    if(node.type==='MemberExpression'&&!node.computed&&node.property.name==='NODE_ENV'&&node.object.type==='MemberExpression'&&!node.object.computed&&node.object.property.name==='env'&&node.object.object.type==='Identifier'&&node.object.object.name==='process'&&releaseDefines&&!shadows.has('process'))return releaseDefines.NODE_ENV??unknown;
    if(['TSAsExpression','TSNonNullExpression','TypeCastExpression','ParenthesizedExpression'].includes(node.type))return constant(node.expression);
    if(node.type==='UnaryExpression'){const value=constant(node.argument);if(value===unknown)return unknown;if(node.operator==='!')return !value;if(node.operator==='typeof')return typeof value;}
    if(node.type==='LogicalExpression'){const left=constant(node.left);if(left===unknown)return unknown;if(node.operator==='&&')return left?constant(node.right):left;if(node.operator==='||')return left?left:constant(node.right);}
    if(node.type==='BinaryExpression'){const left=constant(node.left),right=constant(node.right);if(left===unknown||right===unknown)return unknown;if(node.operator==='===')return left===right;if(node.operator==='!==')return left!==right;if(node.operator==='==')return left==right;if(node.operator==='!=')return left!=right;}
    return unknown;
  };
  const deadBranch=node=>({kind:'proven-dead',phase:'qualified-release-constant',condition:{...position(node),sourceSha256:hash(source.slice(position(node).offset,position(node).end))},defines:releaseDefines});
  const body = (node, kind, name, parent, dead = null, classScope = null) => {
    if (bodies.length >= maxBodies) throw Error('Runtime callable inventory bound exceeded: ' + filename);
    const at = position(node);
    const value = {id: `${kind}@${at.offset}`, kind, name, parent, ...at, sourceSha256: hash(source.slice(at.offset, at.end)),
      annotation: node.returnType || node.params?.some(param => param.typeAnnotation) ? 'present-unqualified' : 'absent', classification: 'unclassified', ...(dead?{frontendDisposition:dead}:{}),...(classScope?{classScope}:{})};
    bodies.push(value); return value.id;
  };
  const feature = (node, kind) => features.push({kind, ...position(node)});
  const visit = (node, parent = 'module-initializer@0', methodContext, dead = null, classScope = null) => {
    if (!node || typeof node.type !== 'string' || node.declare === true || typeOnly(node)) return;
    if (callables.has(node.type) && node.body) {
      const kind = methodContext?.kind ?? node.kind;
      parent = body(node, kind === 'constructor' ? 'constructor' : ['get', 'set'].includes(kind) ? kind + '-accessor' : 'callable', String(node.id?.name ?? methodContext?.name ?? node.key?.name ?? node.key?.value ?? '<closure>'), parent, dead, classScope);
      if (node.async) feature(node, 'async');
      if (node.generator) feature(node, 'generator');
      if (node.typeParameters) feature(node, 'generic');
      if (node.type === 'ArrowFunctionExpression' || node.type === 'FunctionExpression') feature(node, 'closure');
    }
    if (['ClassDeclaration', 'ClassExpression'].includes(node.type)) {
      classScope=position(node);feature(node, 'class');
      if (!node.body.body.some(item => item.kind === 'constructor')) body(node, 'implicit-constructor', node.id?.name ?? '<class>', parent, dead, classScope);
      if (node.typeParameters) feature(node, 'generic');
      if (node.superClass?.type === 'CallExpression') feature(node, 'mixin');
    }
    if (['ClassProperty', 'ClassPrivateProperty', 'ClassAccessorProperty', 'PropertyDefinition'].includes(node.type) && node.value) {
      parent = body(node, node.static ? 'static-field-initializer' : 'field-initializer', node.key?.name ?? '<computed-field>', parent, dead, classScope);
    }
    if (node.type === 'StaticBlock') parent = body(node, 'static-block', '<static>', parent, dead, classScope);
    if (node.type === 'ArrayExpression') feature(node, 'ordinary-array');
    if (node.type === 'ObjectExpression') feature(node, 'structural-object');
    if (node.type === 'PrivateName' || node.type === 'PrivateIdentifier') feature(node, 'private-brand');
    if (node.type === 'TryStatement') feature(node, node.finalizer ? 'try-finally' : 'try-catch');
    if (node.type === 'AwaitExpression') feature(node, 'await');
    if (node.type === 'JSXElement' || node.type === 'JSXFragment') feature(node, 'jsx');
    if (node.computed === true) feature(node, 'computed-property');
    if (['ImportDeclaration', 'ExportNamedDeclaration', 'ExportAllDeclaration'].includes(node.type) && node.source) dependencies.push({kind: node.type === 'ImportDeclaration' ? 'import' : 'export', specifier: node.source.value, ...position(node.source)});
    if (node.type === 'ImportExpression') {
      feature(node, ['StringLiteral', 'Literal'].includes(node.source.type) ? 'literal-import' : 'computed-import');
      dependencies.push({kind: 'dynamic-import', specifier: typeof node.source.value === 'string' ? node.source.value : null, ...position(node)});
    }
    if (node.type === 'CallExpression') {
      const name = node.callee.type === 'Identifier' ? node.callee.name : node.callee.type === 'Import' ? 'import' : null;
      if (name === 'require' || name === 'import') {
        const literal = node.arguments.length === 1 && ['StringLiteral', 'Literal'].includes(node.arguments[0].type) && typeof node.arguments[0].value === 'string';
        feature(node, literal ? 'literal-' + name : 'computed-' + name);
        dependencies.push({kind: name === 'require' ? 'require' : 'dynamic-import', specifier: literal ? node.arguments[0].value : null, ...position(node)});
      }
      if (name === 'eval') feature(node, 'runtime-source-candidate');
    }
    if (node.type === 'NewExpression' && node.callee.type === 'Identifier') {
      if (node.callee.name === 'Function') feature(node, 'runtime-source-candidate');
      if (['Proxy', 'Map', 'Set', 'WeakMap', 'WeakSet', 'Promise', 'ArrayBuffer', 'DataView'].includes(node.callee.name)) feature(node, node.callee.name);
    }
    if(node.type==='IfStatement'||node.type==='ConditionalExpression'){
      const value=constant(node.test),proof=value===unknown?null:deadBranch(node.test);visit(node.test,parent,undefined,dead,classScope);
      visit(node.consequent,parent,undefined,dead??(proof&&!value?proof:null),classScope);visit(node.alternate,parent,undefined,dead??(proof&&value?proof:null),classScope);return;
    }
    if(node.type==='LogicalExpression'){
      const value=constant(node.left),notTaken=value!==unknown&&(node.operator==='&&'&&!value||node.operator==='||'&&value);
      visit(node.left,parent,undefined,dead,classScope);visit(node.right,parent,undefined,dead??(notTaken?deadBranch(node.left):null),classScope);return;
    }
    for (const [key, value] of Object.entries(node)) {
      if (typeKeys.has(key) || ['loc', 'tokens', 'comments', 'leadingComments', 'trailingComments', 'innerComments', 'extra'].includes(key)) continue;
      if (Array.isArray(value)) { for (const child of value) if (child && typeof child.type === 'string') visit(child, parent, undefined, dead, classScope); }
      else if (value && typeof value.type === 'string') visit(value, parent, key === 'value' && ['MethodDefinition', 'Property'].includes(node.type) ? {kind: node.kind, name: node.key?.name ?? node.key?.value} : undefined, dead, classScope);
    }
  };
  body({...(ast.program ?? ast), start: 0, end: source.length, loc: {start: {line: 1, column: 0}}}, 'module-initializer', '<module>', null);
  visit(ast.program ?? ast);
  return {bodies, features, dependencies};
}

/** Both original implementations and emitted helpers stay visible. Their
 * correspondence is deliberately unqualified until semantic lowering exists. */
export function createRuntimeInventory({identity, entry, modules, sourceMapModules, maxModules = 8192, maxBytes = 128 * 1024 ** 2, maxBodies = 200_000}) {
  for (const [value, limit] of [[maxModules, 8192], [maxBytes, 128 * 1024 ** 2], [maxBodies, 200_000]]) if (!Number.isSafeInteger(value) || value < 1 || value > limit) throw Error('Invalid runtime inventory admission bound');
  if (!identity || typeof entry !== 'string' || !Array.isArray(modules) || !modules.length || modules.length > maxModules) throw Error('A bounded actual Metro runtime graph is required');
  const names = new Set(), cases = new Set(); let bytes = 0, count = 0;
  for (const module of modules) {
    if (typeof module.id !== 'string' || !module.id || names.has(module.id) || cases.has(module.id.toLowerCase())) throw Error('Duplicate runtime module identity');
    if (typeof module.source !== 'string' || typeof module.emitted !== 'string' || !Array.isArray(module.dependencies)) throw Error('Incomplete runtime module');
    if (!['module', 'prepend', 'append'].includes(module.role) || !module.owner || typeof module.owner.name !== 'string' || typeof module.owner.version !== 'string' || !/^[a-f0-9]{64}$/.test(module.owner.manifestSha256)) throw Error('Runtime module owner/role is incomplete');
    names.add(module.id); cases.add(module.id.toLowerCase()); bytes += Buffer.byteLength(module.source) + Buffer.byteLength(module.emitted);
  }
  if (bytes > maxBytes) throw Error('Runtime source inventory byte bound exceeded');
  if (!names.has(entry)) throw Error('Runtime entry is absent');
  // The source map is a separate observation of the serialized graph. Require
  // exact correspondence, rather than subtracting unrelated module counts.
  if (!Array.isArray(sourceMapModules) || new Set(sourceMapModules).size !== sourceMapModules.length) throw Error('Complete unique Metro source-map module identities required');
  const mapped = new Set(sourceMapModules), expected = modules.filter(module => module.role !== 'append').map(module => module.id);
  if (expected.some(id => !mapped.has(id)) || mapped.size !== expected.length) throw Error('Metro graph/source-map module set differs');
  const records = modules.map(module => {
    for (const edge of module.dependencies) if (!edge || typeof edge.specifier !== 'string' || edge.target !== null && !names.has(edge.target)) throw Error('Unresolved Metro dependency: ' + module.id);
    if (module.sourceKind === 'json') JSON.parse(module.source);
    else if (module.sourceKind !== undefined && module.sourceKind !== 'code') throw Error('Unclassified runtime source kind: ' + module.id);
    const original = module.sourceKind === 'json' ? {bodies: [], features: [], dependencies: []} : inventoryBody(module.source, {filename: module.sourceFile ?? module.id, dialect: module.dialect, maxBodies, releaseDefines:identity.dev===false&&identity.configuration==='Release'?{__DEV__:false,NODE_ENV:'production'}:null});
    const emitted = inventoryBody(module.emitted, {filename: module.id + '.generated.js', maxBodies, releaseDefines:identity.dev===false&&identity.configuration==='Release'?{__DEV__:false,NODE_ENV:'production'}:null});
    count += original.bodies.length + emitted.bodies.length;
    if (count > maxBodies) throw Error('Runtime body inventory bound exceeded');
    return {id: module.id, metroId: module.metroId, role: module.role, owner: module.owner, dialect: module.dialect, sourceKind: module.sourceKind ?? 'code',
      sourceFile: module.sourceFile ?? module.id, sourceSha256: hash(module.source), emittedSha256: hash(module.emitted),
      ...(module.sourceMapSha256 ? {sourceMapSha256: module.sourceMapSha256} : {}),
      dependencies: module.dependencies.map(edge => ({...edge, sourceSites: original.dependencies.filter(site => site.specifier === edge.specifier)})).sort((a, b) => compare(a.specifier, b.specifier) || compare(a.target ?? '', b.target ?? '')),
      original, emitted, correspondence: 'notVerified'};
  }).sort((a, b) => compare(a.id, b.id));
  const features = {};
  for (const record of records) for (const feature of record.original.features) features[feature.kind] = (features[feature.kind] ?? 0) + 1;
  const sourceRoutes = new Map();
  for (const record of records) if (record.sourceFile.endsWith('.ts') || record.sourceFile.endsWith('.tsx')) {
    const key = record.owner.root + '\0' + record.sourceFile, routes = sourceRoutes.get(key) ?? [];
    routes.push(record.id); sourceRoutes.set(key, routes);
  }
  const evaluationConflicts = [...sourceRoutes.values()].filter(routes => routes.length > 1);
  const graph = {schema: 'nelyx.static-aot-runtime-inventory/v2', parsers: {typescriptJavascript: '@babel/parser@7.29.9', flow: 'hermes-parser@0.32.0'}, identity, entry, modules: records, runtimeComponents: runtimeComponents(records), evaluationConflicts,
    summary: {modules: records.length, mappedModules: mapped.size, unresolvedDependencies: records.reduce((n, m) => n + m.dependencies.filter(edge => edge.target === null).length, 0), originalBodies: records.reduce((n, m) => n + m.original.bodies.length, 0),
      emittedBodies: records.reduce((n, m) => n + m.emitted.bodies.length, 0), features: Object.fromEntries(Object.entries(features).sort(([a], [b]) => compare(a, b))),
      nativeCoverage: 'notVerified', typeSpecializationCoverage: 'notVerified', wholeAppNativeAot: false, typePolicyAccepted: 'notVerified', semanticClosure: 'notVerified', nativeLinking: 'notImplemented'}};
  return {...graph, sha256: hash(JSON.stringify(graph))};
}
