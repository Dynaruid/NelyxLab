// SPDX-License-Identifier: BSD-3-Clause
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import {readShaderAsset} from './shader-assets.mjs';

const internalFacades = new Map([
  ['packages/material/src/generated/scrollbar/scrollbar-theme.generated.ts', 'Adopted inherited scrollbar theme with one separate value owner'],
  ["packages/material/src/generated/colors/colors.generated.ts", "Canonical Material swatch data exports"],
  ['Nelyx/src/framework/widgets/tree-generic-witnesses.ts', 'Generated tree witnesses'],
  ['Nelyx/src/services/text-editing.ts', 'Canonical editing value bridge'],
  ['Nelyx/src/services/text-layout-metrics.ts', 'Canonical layout metric bridge'],
  ['packages/material/src/internal/chip/chip-background.ts', 'Chip background state implementation'],
  ['packages/material/src/internal/slider/slider-shapes-source-adapter.ts', 'Generated slider shape adapter'],
]);
const slash = value => value.replaceAll('\\', '/');
function walk(directory) {
  return fs.readdirSync(directory, {withFileTypes: true}).flatMap(item => {
    const file = path.join(directory, item.name);
    if (item.isSymbolicLink()) throw new Error('Source link rejected: ' + file);
    return item.isDirectory() ? walk(file) : file.endsWith('.ts') ? [file] : [];
  });
}
function sourceTarget(owner, condition) {
  const target = typeof condition === 'string' ? condition : condition?.types ?? condition?.default;
  if (!target?.startsWith('./dist/') || !/\.(?:d\.ts|js)$/.test(target)) return null;
  return path.resolve(owner.source, target.slice('./dist/'.length).replace(/\.(?:d\.ts|js)$/, '.ts'));
}
function stronglyConnected(graph) {
  let index = 0;
  const indexes = new Map(), lows = new Map(), stack = [], active = new Set(), cycles = [];
  function visit(node) {
    indexes.set(node, index); lows.set(node, index++); stack.push(node); active.add(node);
    for (const next of graph.get(node) ?? []) {
      if (!graph.has(next)) continue;
      if (!indexes.has(next)) {visit(next); lows.set(node, Math.min(lows.get(node), lows.get(next)));}
      else if (active.has(next)) lows.set(node, Math.min(lows.get(node), indexes.get(next)));
    }
    if (lows.get(node) === indexes.get(node)) {
      const component = [];
      let member;
      do {member = stack.pop(); active.delete(member); component.push(member);} while (member !== node);
      if (component.length > 1 || graph.get(node)?.has(node)) cycles.push(component.sort());
    }
  }
  for (const node of graph.keys()) if (!indexes.has(node)) visit(node);
  return cycles;
}
export function auditPackageBoundaries(root) {
  root = path.resolve(root);
  const workspace = JSON.parse(fs.readFileSync(path.join(root, 'package.json')));
  const owners = workspace.workspaces.map(directory => ({directory, source: path.resolve(root, directory, 'src'), manifest: JSON.parse(fs.readFileSync(path.join(root, directory, 'package.json')))}));
  const checked = owners.filter(owner => ['@nelyx/core', '@nelyx/material', '@nelyx/cupertino', '@nelyx/tooling-contracts'].includes(owner.manifest.name));
  const errors = [], graph = new Map();
  let files = 0, runtimeEdges = 0, publicFacades = 0;
  for (const owner of checked) {
    const published = new Set(Object.values(owner.manifest.exports ?? {}).map(value => sourceTarget(owner, value)).filter(Boolean));
    for (const target of published) {
      const relative = path.relative(owner.source, target);
      if (relative === '..' || relative.startsWith('..' + path.sep) || path.isAbsolute(relative)) errors.push('Published target escapes its owner: ' + owner.manifest.name);
      else if (!fs.existsSync(target)) errors.push('Published source is missing: ' + slash(path.relative(root, target)));
    }
    for (const [subpath, entry] of Object.entries(owner.manifest.exports ?? {})) {
      if (entry?.types && entry.default && sourceTarget(owner, entry.types) !== sourceTarget(owner, entry.default)) errors.push('Declaration/runtime owner mismatch: ' + owner.manifest.name + '/' + subpath);
    }
    for (const file of walk(owner.source)) {
      files++;
      const relativeFile = slash(path.relative(root, file));
      const syntax = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true);
      const aggregate = relativeFile === owner.directory + '/src/widgets.ts';
      if (aggregate && syntax.statements.some(s => !ts.isExportDeclaration(s) || !s.moduleSpecifier || !s.exportClause || !ts.isNamedExports(s.exportClause))) errors.push('Design aggregate must contain only explicit value/type reexports: ' + relativeFile);
      graph.set(relativeFile, new Set());
      const processSpecifier = (specifier, runtime, shaderDefault = false) => {
        if (specifier.endsWith('.sksl')) {
          if (!shaderDefault) errors.push('Shader asset requires a static default import: ' + relativeFile);
          else try {readShaderAsset(path.resolve(root, owner.directory), file, specifier);}
          catch (error) {errors.push('Invalid shader asset import: ' + relativeFile + ' -> ' + String(error));}
          // The build embeds the asset as a value; it is not a runtime module edge.
          return;
        }
        let target;
        if (specifier.startsWith('.')) {
          target = path.resolve(path.dirname(file), specifier);
          const relative = path.relative(owner.source, target);
          if (relative === '..' || relative.startsWith('..' + path.sep) || path.isAbsolute(relative) || !specifier.endsWith('.ts')) errors.push('Relative import escapes owner or lacks .ts: ' + relativeFile + ' -> ' + specifier);
          else if (!fs.existsSync(target)) errors.push('Relative module is missing: ' + relativeFile + ' -> ' + specifier);
        } else {
          if (specifier === '@material/material-color-utilities' && owner.manifest.name === '@nelyx/material' && ['packages/material/src/internal/color-scheme/dynamic-scheme.ts', 'packages/material/src/internal/color-scheme/image-colors.ts'].includes(relativeFile)) {
            const utilityFile = path.join(root, 'node_modules/@material/material-color-utilities/package.json');
            const utility = fs.existsSync(utilityFile) ? JSON.parse(fs.readFileSync(utilityFile, 'utf8')) : null;
            if (owner.manifest.dependencies?.[specifier] !== '0.3.0' || utility?.name !== specifier || utility.version !== '0.3.0' || utility.exports?.['.']?.types !== './index.d.ts' || utility.exports?.['.']?.import !== './index.js' || !fs.existsSync(path.join(path.dirname(utilityFile), 'index.js')) || !fs.existsSync(path.join(path.dirname(utilityFile), 'index.d.ts')) || Object.keys(utility.dependencies ?? {}).length || Object.keys(utility.peerDependencies ?? {}).length || Object.keys(utility.optionalDependencies ?? {}).length) errors.push('Unqualified pure color utility pin/export/dependencies: ' + relativeFile);
            // This pinned dependency has no runtime dependencies or Core identity.
            // Its approved calculations are constrained at the import declaration.
            return;
          }
          const match = /^(@nelyx\/[^/]+)\/(.+)$/.exec(specifier);
          const other = owners.find(candidate => candidate.manifest.name === match?.[1]);
          const entry = other?.manifest.exports?.['./' + match?.[2]];
          if (!entry) errors.push('Not an exported direct module: ' + relativeFile + ' -> ' + specifier);
          else target = sourceTarget(other, entry);
          if (['@nelyx/core', '@nelyx/tooling-contracts'].includes(owner.manifest.name)) errors.push('Common package has an external dependency: ' + relativeFile + ' -> ' + specifier);
          if (owner.manifest.name === '@nelyx/cupertino' && match?.[1] !== '@nelyx/core') errors.push('Cupertino reverse/platform dependency: ' + relativeFile + ' -> ' + specifier);
          if (owner.manifest.name === '@nelyx/material' && !['@nelyx/core', '@nelyx/cupertino'].includes(match?.[1])) errors.push('Material runtime dependency: ' + relativeFile + ' -> ' + specifier);
          if (other === owner) errors.push('Internal self-package import must use its relative owner: ' + relativeFile + ' -> ' + specifier);
        }
        if (target && path.resolve(target) === path.resolve(owner.source, 'widgets.ts') && !aggregate) errors.push('Internal aggregate dependency: ' + relativeFile + ' -> ' + specifier);
        if (runtime && target) {graph.get(relativeFile).add(slash(path.relative(root, target))); runtimeEdges++;}
      };
      for (const statement of syntax.statements) {
        if (ts.isExportDeclaration(statement)) {
          if (!published.has(file) && !internalFacades.has(relativeFile)) errors.push('Undeclared internal reexport facade: ' + relativeFile);
          else publicFacades++;
          if (!statement.exportClause || !ts.isNamedExports(statement.exportClause)) errors.push('Reexport must name its public symbols: ' + relativeFile);
          if (statement.moduleSpecifier && ts.isStringLiteral(statement.moduleSpecifier)) processSpecifier(statement.moduleSpecifier.text, !statement.isTypeOnly && (!statement.exportClause || statement.exportClause.elements.some(e => !e.isTypeOnly)));
        } else if (ts.isImportDeclaration(statement)) {
          const clause = statement.importClause;
          if (statement.moduleSpecifier.text === '@material/material-color-utilities') {
            const approved = new Set(['Hct', 'MaterialDynamicColors', 'DynamicScheme', 'SchemeTonalSpot', 'SchemeFidelity', 'SchemeMonochrome', 'SchemeNeutral', 'SchemeVibrant', 'SchemeExpressive', 'SchemeContent', 'SchemeRainbow', 'SchemeFruitSalad', 'QuantizerWu', 'labFromArgb', 'argbFromLab', 'Score']);
            if (clause?.name || !clause?.namedBindings || !ts.isNamedImports(clause.namedBindings) || clause.namedBindings.elements.some(e => !approved.has((e.propertyName ?? e.name).text))) errors.push('Color utility import must name approved pure calculations: ' + relativeFile);
          }
          const runtime = !clause || !clause.isTypeOnly && (!clause.namedBindings || !ts.isNamedImports(clause.namedBindings) || clause.namedBindings.elements.some(e => !e.isTypeOnly));
          processSpecifier(statement.moduleSpecifier.text, runtime, Boolean(clause?.name && !clause.isTypeOnly && !clause.namedBindings && !statement.attributes));
        }
      }
      const visit = node => {
        if (ts.isImportTypeNode(node) && ts.isLiteralTypeNode(node.argument) && ts.isStringLiteral(node.argument.literal)) processSpecifier(node.argument.literal.text, false);
        if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword) {
          if (node.arguments.length === 1 && ts.isStringLiteral(node.arguments[0])) processSpecifier(node.arguments[0].text, true);
          else errors.push('Unresolved dynamic import: ' + relativeFile);
        }
        ts.forEachChild(node, visit);
      };
      ts.forEachChild(syntax, visit);
    }
  }
  const core = owners.find(owner => owner.manifest.name === '@nelyx/core');
  for (const owner of checked.filter(p => ['@nelyx/material', '@nelyx/cupertino'].includes(p.manifest.name))) {
    if (owner.manifest.peerDependencies?.['@nelyx/core'] !== core?.manifest.version || owner.manifest.dependencies?.['@nelyx/core']) errors.push('Design must share its consumer Core peer identity: ' + owner.manifest.name);
  }
  const cycles = stronglyConnected(graph);
  const designCycles = cycles.filter(component => component.some(file => file.startsWith('packages/')));
  for (const cycle of designCycles) errors.push('Design runtime import cycle: ' + cycle.join(' -> '));
  return {status: errors.length ? 'FAIL' : 'PASS-scoped', packages: checked.map(p => p.manifest.name), files, publicFacades, runtimeEdges, errors,
    dependencyGraph: {algorithm: 'Tarjan SCC; unlimited depth; explicit type-only edges excluded; runtime imports/reexports/dynamic literals included; design cycles fail the gate', cycles, designCycles, status: designCycles.length ? 'FAIL' : 'PASS-scoped'},
    scope: 'Manifest/canonical reexports, explicit internal facades, direct imports, design/Core peer ownership and complete owned runtime graph. Exact dependency-free MCU0.3 root/pure named calculations allowed only in two Material color adapters; external algorithm/bytes qualification remains separate. Static cycles reported separately; no behavior/native qualification.'};
}
