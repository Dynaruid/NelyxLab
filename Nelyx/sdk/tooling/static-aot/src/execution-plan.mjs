// SPDX-License-Identifier: BSD-3-Clause
import { createHash } from 'node:crypto';
import { TraceMap, originalPositionFor } from '@jridgewell/trace-mapping';
import { parse } from '@babel/parser';
import { inventoryBody } from './runtime-inventory.mjs';
const hash = (value) => createHash('sha256').update(value).digest('hex');
const seal = (value) => ({ ...value, sha256: hash(JSON.stringify(value)) });
const lineStarts = (text) => {
  const result = [0];
  for (let i = 0; i < text.length; i++) if (text[i] === '\n') result.push(i + 1);
  return result;
};
const tree = (values) => {
  const sorted = [...values].sort((a, b) => a.offset - b.offset || b.end - a.end);
  const build = (a, b) => {
    if (a >= b) return null;
    const m = (a + b) >> 1,
      left = build(a, m),
      right = build(m + 1, b);
    return {
      value: sorted[m],
      left,
      right,
      max: Math.max(sorted[m].end, left?.max ?? 0, right?.max ?? 0),
    };
  };
  return build(0, sorted.length);
};
function containing(root, point, result = []) {
  if (!root || root.max <= point) return result;
  if (root.left?.max > point) containing(root.left, point, result);
  if (root.value.offset <= point) {
    if (point < root.value.end) result.push(root.value);
    containing(root.right, point, result);
  }
  return result;
}
function optionalFailure(raw, edge, loader) {
  if (!edge.optional || edge.target !== null || !loader) return null;
  const slots = raw.dependencies.flatMap((item, index) =>
    item.specifier === edge.specifier ? [index] : [],
  );
  if (slots.length !== 1) return null;
  const slot = slots[0];
  const ast = parse(raw.emitted),
    call = ast.program.body.find(
      (node) =>
        node.type === 'ExpressionStatement' &&
        node.expression.type === 'CallExpression' &&
        node.expression.callee.name === '__d',
    )?.expression;
  const factory = call?.arguments[0],
    table = call?.arguments[2];
  if (
    factory?.type !== 'FunctionExpression' ||
    table?.type !== 'ArrayExpression' ||
    table.elements[slot]?.type !== 'NullLiteral'
  )
    return null;
  const requireName = factory.params[1]?.name,
    mapName = factory.params.at(-1)?.name;
  if (!requireName || !mapName) return null;
  let found = false,
    shadow = false;
  const visit = (node) => {
    if (!node || typeof node !== 'object') return;
    if (
      node !== factory &&
      ((/Function/.test(node.type) &&
        node.params?.some((param) => [requireName, mapName].includes(param.name))) ||
        (node.type === 'VariableDeclarator' && [requireName, mapName].includes(node.id?.name)))
    )
      shadow = true;
    if (
      node.type === 'CallExpression' &&
      node.callee.type === 'Identifier' &&
      node.callee.name === requireName &&
      node.arguments.length === 1
    ) {
      const arg = node.arguments[0];
      if (
        arg.type === 'MemberExpression' &&
        arg.computed &&
        arg.object.name === mapName &&
        arg.property.type === 'NumericLiteral' &&
        arg.property.value === slot
      )
        found = true;
    }
    for (const [key, value] of Object.entries(node))
      if (!['loc', 'comments', 'extra'].includes(key)) {
        if (Array.isArray(value)) value.forEach(visit);
        else if (value && typeof value === 'object') visit(value);
      }
  };
  visit(factory);
  return found && !shadow
    ? {
        kind: 'native-module-resolution-throw',
        slot,
        loader: loader.id,
        loaderSha256: hash(loader.emitted),
        emittedSha256: hash(raw.emitted),
      }
    : null;
}
function missingModuleLoader(records) {
  const loader = records.find((record) =>
    record.id.endsWith('/metro-runtime/src/polyfills/require.js'),
  );
  if (!loader) return null;
  let qualified = false;
  const visit = (node) => {
    if (!node || typeof node !== 'object') return;
    if (node.type === 'FunctionDeclaration' && node.id.name === 'metroRequire') {
      const first = node.body.body.find(
          (statement) =>
            !(
              statement.type === 'VariableDeclaration' &&
              statement.kind === 'var' &&
              statement.declarations.every(
                (declaration) =>
                  !declaration.init ||
                  (declaration.init.type === 'Identifier' &&
                    /^_temporalUndefined\d*$/.test(declaration.init.name)),
              )
            ),
        ),
        test = first?.test,
        parameter = node.params[0]?.name;
      if (
        first?.type === 'IfStatement' &&
        test.type === 'BinaryExpression' &&
        test.operator === '===' &&
        test.left.name === parameter &&
        test.right.type === 'NullLiteral' &&
        first.consequent.type === 'BlockStatement' &&
        first.consequent.body.length === 1 &&
        first.consequent.body[0].type === 'ThrowStatement'
      )
        qualified = true;
    }
    for (const [key, value] of Object.entries(node))
      if (!['loc', 'comments', 'extra'].includes(key)) {
        if (Array.isArray(value)) value.forEach(visit);
        else if (value && typeof value === 'object') visit(value);
      }
  };
  visit(parse(loader.emitted));
  return qualified ? loader : null;
}

/** Every original body and emitted helper keeps its owner and source relation.
 * Candidate unit assignments become native coverage only after C generation. */
export function createExecutionPlan(capture, partition, prefix = '', nativeScripts = []) {
  const { inventory, records, spans, code } = capture;
  if (inventory.evaluationConflicts.length)
    throw Error('Execution plan has duplicate source evaluation routes');
  const policy = partition.typePolicy;
  if (!policy) throw Error('Automatic type policy required');
  const policyByModule = new Map();
  for (const decision of policy.decisions) {
    const list = policyByModule.get(decision.module) ?? [];
    list.push(decision);
    policyByModule.set(decision.module, list);
  }
  const modules = [],
    loader = missingModuleLoader(records);
  for (const module of inventory.modules) {
    const raw = records.find((record) => record.id === module.id),
      span = spans.find((span) => span.id === module.id);
    if (
      !raw ||
      !span ||
      hash(raw.emitted) !== module.emittedSha256 ||
      code.slice(span.offset, span.end) !== raw.emitted
    )
      throw Error('Execution module source/span identity differs');
    const emitted = module.emitted.bodies.map((body) => ({
      ...body,
      inputOffset: span.offset + prefix.length + body.offset,
      inputEnd: span.offset + prefix.length + body.end,
      ...(body.classScope
        ? {
            inputClassScope: {
              offset: span.offset + prefix.length + body.classScope.offset,
              end: span.offset + prefix.length + body.classScope.end,
            },
          }
        : {}),
      originals: [],
    }));
    const sourceTree = tree(module.original.bodies),
      emittedTree = tree(emitted.filter((body) => body.kind !== 'module-initializer'));
    const relations = new Map(module.original.bodies.map((body) => [body.id, new Set()]));
    const sourceLines = lineStarts(raw.source),
      generatedLines = lineStarts(raw.emitted);
    const originalMap = raw.originalMap ? new TraceMap(raw.originalMap) : null;
    const link = (generatedOffset, originalOffset) => {
      const targets = containing(emittedTree, generatedOffset).sort(
        (a, b) => a.end - a.offset - (b.end - b.offset),
      );
      if (!targets.length) return;
      for (const original of containing(sourceTree, originalOffset)) {
        relations.get(original.id).add(targets[0].id);
      }
    };
    if (raw.source === raw.emitted) {
      for (const body of emitted)
        if (body.kind !== 'module-initializer') link(body.offset, body.offset);
    } else
      for (const tuple of raw.mappings ?? []) {
        if (tuple.length < 4) continue;
        const position = originalMap
          ? originalPositionFor(originalMap, { line: tuple[2], column: tuple[3] })
          : { line: tuple[2], column: tuple[3] };
        if (position.line === null || position.column === null) continue;
        const generatedOffset = generatedLines[tuple[0] - 1] + tuple[1],
          originalOffset = sourceLines[position.line - 1] + position.column;
        if (
          !Number.isSafeInteger(generatedOffset) ||
          !Number.isSafeInteger(originalOffset) ||
          generatedOffset < 0 ||
          originalOffset < 0 ||
          generatedOffset > raw.emitted.length ||
          originalOffset > raw.source.length
        )
          throw Error('Execution source map range differs: ' + module.id);
        link(generatedOffset, originalOffset);
      }
    const relative = module.sourceFile.slice(module.owner.root.length + 1);
    const policyModule = policyByModule.has(module.owner.name + '/' + relative)
      ? module.owner.name + '/' + relative
      : 'application/' + module.sourceFile;
    const decisions = policyByModule.get(policyModule) ?? [];
    const elimination = raw.frontendElimination;
    if (
      elimination &&
      (elimination.schema !== 'nelyx.metro-elimination/v1' ||
        elimination.sourceSha256 !== raw.transformSourceSha256 ||
        elimination.policy !== 'metro-0.83.8-release-replay')
    )
      throw Error('Metro elimination source identity differs');
    const removed = (elimination?.removed ?? []).map((range) => {
      const point = (location) => {
        const at = originalMap
          ? originalPositionFor(originalMap, { line: location.line, column: location.column })
          : location;
        return at.line === null || at.column === null ? null : sourceLines[at.line - 1] + at.column;
      };
      return { start: point(range.start), end: point(range.end), kind: range.kind };
    });
    const originals = module.original.bodies.map((body) => {
      const matches = ['callable', 'constructor', 'get-accessor', 'set-accessor'].includes(
        body.kind,
      )
        ? decisions.filter(
            (decision) =>
              decision.end === body.end && Math.abs(decision.offset - body.offset) <= 16,
          )
        : [];
      matches.sort((a, b) => Math.abs(a.offset - body.offset) - Math.abs(b.offset - body.offset));
      if (
        matches.length > 1 &&
        Math.abs(matches[0].offset - body.offset) === Math.abs(matches[1].offset - body.offset)
      )
        throw Error('Ambiguous original type decision: ' + module.id + '#' + body.id);
      const decision = matches[0];
      const selected =
        decision?.decision === 'specialize'
          ? partition.bindings.find(
              (binding) =>
                binding.module === decision.module &&
                binding.name === decision.selection.name &&
                (binding.className ?? null) === (decision.selection.className ?? null),
            )
          : null;
      if (decision?.decision === 'specialize' && !selected)
        throw Error('Selected original body lacks a typed binding');
      const targets = [...relations.get(body.id)].sort();
      for (const id of targets) emitted.find((body) => body.id === id).originals.push(body.id);
      const dead =
        !targets.length &&
        removed.find((range) => range.start === body.offset && range.end === body.end);
      return {
        ...body,
        decision: decision?.decision ?? 'dynamic-js-with-reason',
        reason:
          decision?.reason ??
          (body.kind === 'module-initializer'
            ? 'single-module-initialization-owner'
            : body.annotation === 'absent'
              ? 'no-qualified-scalar-annotation'
              : 'dynamic-representation-required'),
        ...(dead
          ? {
              frontendDisposition: {
                kind: 'proven-dead',
                phase: elimination.policy,
                sourceSha256: elimination.sourceSha256,
                range: dead,
              },
            }
          : {}),
        typeEvidence: decision?.evidence ?? null,
        emitted: targets,
        typedBinding: selected?.id ?? null,
        typedKernel: selected ? 'kernel' + partition.bindings.indexOf(selected) : null,
      };
    });
    modules.push({
      id: module.id,
      role: module.role,
      owner: module.owner,
      sourceFile: module.sourceFile,
      sourceSha256: module.sourceSha256,
      emittedSha256: module.emittedSha256,
      sourceMapSha256: module.sourceMapSha256 ?? null,
      span: { offset: span.offset + prefix.length, end: span.end + prefix.length },
      dependencies: module.dependencies.map((edge) => ({
        ...edge,
        ...(optionalFailure(raw, edge, loader)
          ? { resolution: optionalFailure(raw, edge, loader) }
          : {}),
      })),
      originals,
      emitted,
    });
  }
  for (const script of nativeScripts) {
    if (
      hash(script.source) !== script.sourceSha256 ||
      !/^nelyx_[a-z_]+$/.test(script.unit) ||
      modules.some((module) => module.id === script.sourceFile)
    )
      throw Error('Supplemental native script identity differs');
    const bodies = inventoryBody(script.source, { filename: 'rnw-jsi-pal.js' }).bodies;
    modules.push({
      id: script.sourceFile,
      role: 'native-host-script',
      nativeUnit: script.unit,
      nativeInput: script.input,
      owner: script.owner,
      sourceFile: script.sourceFile,
      sourceSha256: script.originalSha256,
      emittedSha256: script.sourceSha256,
      sourceMapSha256: null,
      span: { offset: 0, end: script.source.length },
      sourceExtraction: {
        policy: 'rnw-0.83.2-cxx-raw-string-lf',
        line: script.line,
        sha256: script.sourceSha256,
      },
      dependencies: [],
      originals: bodies.map((body) => ({
        ...body,
        line: body.line + script.line - 1,
        decision: 'dynamic-js-with-reason',
        reason: 'pinned-native-host-script',
        typeEvidence: null,
        emitted: [body.id],
        typedBinding: null,
        typedKernel: null,
      })),
      emitted: bodies.map((body) => ({
        ...body,
        inputOffset: body.offset,
        inputEnd: body.end,
        originals: [body.id],
      })),
    });
  }
  return seal({
    schema: 'nelyx.static-aot-execution-plan/v2',
    inventorySha256: inventory.sha256,
    typePolicySha256: policy.sha256,
    sourceGraphSha256: partition.graph.sha256,
    partitionSha256: partition.irSha256,
    nativeSourceSha256: hash(prefix + code),
    typedSourceSha256: partition.sourceSha256,
    prefix: { bytes: Buffer.byteLength(prefix), sha256: hash(prefix) },
    modules,
    runtimeComponents: inventory.runtimeComponents,
    unresolved: modules.flatMap((module) =>
      module.dependencies
        .filter((edge) => edge.target === null && !edge.resolution)
        .map((edge) => ({ module: module.id, ...edge })),
    ),
    dependencyFailures: modules.flatMap((module) =>
      module.dependencies
        .filter((edge) => edge.resolution)
        .map((edge) => ({ module: module.id, ...edge })),
    ),
    dynamicCodeCandidates: inventory.modules.flatMap((module) =>
      module.emitted.features
        .filter((feature) =>
          ['runtime-source-candidate', 'computed-require', 'computed-import'].includes(
            feature.kind,
          ),
        )
        .map((feature) => ({ module: module.id, ...feature })),
    ),
    summary: {
      nativeCoverage: 'notVerified',
      wholeAppNativeAot: false,
      typePolicyAccepted: 'notVerified',
    },
  });
}

/** Bind actual SH C definitions and optimizer-eliminated function identities.
 * A missing frontend/backend correspondence remains unclassified and blocks strict mode. */
export function bindNativeCoverage(plan, build, identity) {
  if (
    plan.nativeSourceSha256 !== identity.sourceSha256 ||
    plan.typedSourceSha256 !== identity.typedSourceSha256 ||
    plan.partitionSha256 !== identity.partitionSha256
  )
    throw Error('Native execution source identity differs');
  const root = build.units.find((unit) => unit.unit === 'nelyx_app')?.nativeFunctions,
    typed = build.units.find((unit) => unit.unit === 'nelyx_typed')?.nativeFunctions;
  if (
    !root ||
    !typed ||
    root.sourceSha256 !== plan.nativeSourceSha256 ||
    typed.sourceSha256 !== plan.typedSourceSha256
  )
    throw Error('Native compiler function evidence missing');
  const roots = new Map(
    build.units
      .filter((unit) => unit.unit !== 'nelyx_typed' && unit.nativeFunctions)
      .map((unit) => [unit.unit, unit.nativeFunctions]),
  );
  for (const module of plan.modules)
    if (module.nativeUnit && roots.get(module.nativeUnit)?.sourceSha256 !== module.emittedSha256)
      throw Error('Supplemental native compiler source differs');
  const all = plan.modules.flatMap((module) =>
      module.emitted
        .filter((body) => body.kind !== 'module-initializer')
        .map((body) => ({
          unit: module.nativeUnit ?? 'nelyx_app',
          module: module.id,
          id: body.id,
          offset: body.inputOffset,
          end: body.inputEnd,
        })),
    ),
    indexes = new Map(
      [...roots.keys()].map((unit) => [unit, tree(all.filter((body) => body.unit === unit))]),
    );
  const associate = (functions, unit) => {
    const buckets = new Map();
    for (const fn of functions) {
      if (
        !fn.position ||
        /^_0_global$/.test(fn.symbol) ||
        (fn.sourceRange &&
          /^_\d+__(?:instance_members_initializer|static_elements_initializer)_/.test(fn.symbol))
      )
        continue;
      const body = containing(indexes.get(unit), fn.position.offset).sort(
        (a, b) => a.end - a.offset - (b.end - b.offset),
      )[0];
      if (body) {
        const key = unit + '#' + body.module + '#' + body.id,
          values = buckets.get(key) ?? [];
        values.push(fn.symbol);
        buckets.set(key, values);
      }
    }
    return buckets;
  };
  const before = new Map(),
    after = new Map(),
    missing = [];
  for (const [unit, value] of roots) {
    for (const [key, symbols] of associate(value.baseline.functions, unit))
      before.set(key, symbols);
    for (const [key, symbols] of associate(value.functions, unit)) after.set(key, symbols);
  }
  const helperIndex = (functions, unit) => {
    const result = new Map();
    for (const fn of functions) {
      const match = /__(instance_members_initializer|static_elements_initializer)_/.exec(fn.symbol),
        range = fn.sourceRange;
      if (!match || !range) continue;
      const key = unit + '#' + match[1] + ':' + range.start.offset + ':' + range.end.offset,
        list = result.get(key) ?? [];
      list.push(fn.symbol);
      result.set(key, list);
    }
    return result;
  };
  const nativeHelpers = new Map(),
    baselineHelpers = new Map();
  for (const [unit, value] of roots) {
    for (const [key, symbols] of helperIndex(value.functions, unit))
      nativeHelpers.set(key, symbols);
    for (const [key, symbols] of helperIndex(value.baseline.functions, unit))
      baselineHelpers.set(key, symbols);
  }
  const hasRoot = root.functions.some((fn) => fn.symbol === '_0_global');
  if (!hasRoot) throw Error('Native root initializer missing');
  const typedKernels = typed.functions.filter((fn) => /^_\d+_kernel\d+$/.test(fn.symbol));
  const modules = plan.modules.map((module) => {
    const unit = module.nativeUnit ?? 'nelyx_app';
    if (!roots.get(unit)?.functions.some((fn) => fn.symbol === '_0_global'))
      throw Error('Native script initializer missing: ' + unit);
    const emitted = module.emitted.map((body) => {
      const key = unit + '#' + module.id + '#' + body.id;
      const field = ['field-initializer', 'static-field-initializer'].includes(body.kind),
        role =
          body.kind === 'field-initializer'
            ? 'instance_members_initializer'
            : 'static_elements_initializer';
      const helperKey =
        field && body.inputClassScope
          ? unit + '#' + role + ':' + body.inputClassScope.offset + ':' + body.inputClassScope.end
          : null;
      const owners = field ? (nativeHelpers.get(helperKey) ?? []) : (after.get(key) ?? []),
        eliminated = field ? baselineHelpers.has(helperKey) : before.has(key);
      const classification =
        body.kind === 'module-initializer' || owners.length
          ? 'dynamic-native'
          : eliminated || body.frontendDisposition?.kind === 'proven-dead'
            ? 'proven-dead'
            : 'unclassified';
      if (classification === 'unclassified') missing.push(key);
      return {
        ...body,
        classification,
        nativeSymbols: body.kind === 'module-initializer' ? ['_0_global'] : owners,
        elimination:
          classification === 'proven-dead' ? 'qualified-no-inline-compiler-elimination' : null,
      };
    });
    const originals = module.originals.map((body) => {
      const owners = body.emitted.map((id) => emitted.find((item) => item.id === id));
      let classification =
        body.frontendDisposition?.kind === 'proven-dead'
          ? 'proven-dead'
          : body.kind === 'module-initializer'
            ? 'dynamic-native'
            : owners.length && owners.every((item) => item.classification === 'proven-dead')
              ? 'proven-dead'
              : owners.length &&
                  owners.every((item) =>
                    ['dynamic-native', 'proven-dead'].includes(item.classification),
                  )
                ? 'dynamic-native'
                : 'unclassified';
      const kernel = body.typedKernel
        ? typedKernels.find((fn) => fn.symbol.endsWith('_' + body.typedKernel))
        : null;
      if (body.typedBinding) classification = kernel ? 'typed-native' : 'unclassified';
      const initializer =
        body.kind === 'module-initializer' && module.role === 'module'
          ? emitted.find(
              (item) => item.kind === 'callable' && item.parent === 'module-initializer@0',
            )
          : null;
      if (body.kind === 'module-initializer' && module.role === 'module')
        classification =
          initializer?.classification === 'dynamic-native' ? 'dynamic-native' : 'unclassified';
      if (classification === 'unclassified') missing.push(module.id + '#original/' + body.id);
      return {
        ...body,
        classification,
        nativeSymbols: kernel
          ? [kernel.symbol]
          : (initializer?.nativeSymbols ?? owners.flatMap((owner) => owner.nativeSymbols)),
      };
    });
    return { ...module, emitted, originals };
  });
  const count = (bodies) => {
    const result = { native: 0, typed: 0, dynamic: 0, dead: 0, unclassified: 0 };
    for (const body of bodies) {
      if (body.classification === 'typed-native') {
        result.typed++;
        result.native++;
      } else if (body.classification === 'dynamic-native') {
        result.dynamic++;
        result.native++;
      } else if (body.classification === 'proven-dead') result.dead++;
      else result.unclassified++;
    }
    return {
      ...result,
      coverage: result.unclassified ? result.native / (result.native + result.unclassified) : 1,
    };
  };
  const originals = modules.flatMap((module) => module.originals),
    emitted = modules.flatMap((module) => module.emitted),
    policyAccepted =
      originals.every((body) => body.decision && body.reason) &&
      typedKernels.length === originals.filter((body) => body.typedBinding).length;
  const summary = {
    initializers: count(originals.filter((body) => body.kind === 'module-initializer')),
    originalCallables: count(originals.filter((body) => body.kind !== 'module-initializer')),
    emitted: count(emitted),
    typePolicyAccepted: policyAccepted,
    wholeAppNativeAot:
      missing.length === 0 &&
      plan.unresolved.length === 0 &&
      !plan.dynamicCodeCandidates?.length &&
      policyAccepted,
    unclassified: missing.length,
    unresolved: plan.unresolved.length,
    dynamicCodeCandidates: plan.dynamicCodeCandidates?.length ?? 0,
  };
  const { sha256, ...input } = plan;
  return seal({
    ...input,
    frontendPlanSha256: plan.frontendPlanSha256 ?? sha256,
    modules,
    compiler: { toolchainSha256: identity.toolchainSha256, units: [...roots.values(), typed] },
    nativeImageSha256: identity.librarySha256,
    summary,
    missing,
  });
}
/** Reconstruct the pre-link plan whose digest is embedded in the native image.
 * Re-hashing a shortened coverage report cannot discard source bodies. */
export function verifyFrontendPlan(plan) {
  const original = structuredClone(plan),
    expected = original.frontendPlanSha256;
  for (const key of ['sha256', 'frontendPlanSha256', 'compiler', 'nativeImageSha256', 'missing'])
    delete original[key];
  for (const module of original.modules) {
    for (const body of module.originals) {
      body.classification = 'unclassified';
      delete body.nativeSymbols;
    }
    for (const body of module.emitted) {
      body.classification = 'unclassified';
      delete body.nativeSymbols;
      delete body.elimination;
    }
  }
  original.summary = {
    nativeCoverage: 'notVerified',
    wholeAppNativeAot: false,
    typePolicyAccepted: 'notVerified',
  };
  if (hash(JSON.stringify(original)) !== expected)
    throw Error('Static AOT frontend body/graph plan differs');
  return plan;
}
