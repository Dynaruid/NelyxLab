// SPDX-License-Identifier: BSD-3-Clause
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import ts from 'typescript';
// W12 adopted this inventory and added current Doroti/module/feature ownership.
// Re-running the historical extractor must not erase those manually reviewed decisions.
const activeMapping = 'tools/Nelyx.FrameworkToTypeScript/data/work8/w11-design-package-plan.json';
if (fs.existsSync(activeMapping) && JSON.parse(fs.readFileSync(activeMapping, 'utf8')).w12Structure)
  throw new Error(
    'W12 adopted design mapping cannot be overwritten by the historical inventory extractor; reconcile the current ownership mapping explicitly.',
  );
const root = process.cwd(),
  sourceRoot = '.tmp/work6/flutter-source',
  base = 'packages/flutter/lib/';
const sha = (file) => createHash('sha256').update(fs.readFileSync(file)).digest('hex');
function run(command, args) {
  const r = spawnSync(command, args, {
    encoding: 'utf8',
    windowsHide: true,
    timeout: 1200000,
    maxBuffer: 64 * 1024 * 1024,
  });
  assert.equal(r.status, 0, String(r.error ?? '') + r.stderr);
  return r.stdout;
}
const pin = run('git', ['-C', sourceRoot, 'rev-parse', 'HEAD']).trim();
assert.equal(pin, '71e4717a61786faab4c7aa39825989305ed29e8a');
assert.equal(run('git', ['-C', sourceRoot, 'status', '--porcelain']).trim(), '');
const sources = ['cupertino', 'material']
  .flatMap((pkg) =>
    fs
      .readdirSync(path.join(sourceRoot, base, 'src', pkg), { recursive: true })
      .filter((file) => file.endsWith('.dart'))
      .map((file) => base + 'src/' + pkg + '/' + file.replaceAll('\\', '/')),
  )
  .sort();
const parser = 'tools/Nelyx.FrameworkToTypeScript/dart/bin/design_catalog.dart';
const catalog = JSON.parse(
  run(path.join(root, '.tmp/work6/dart-dev/dart-sdk/bin/dart.exe'), [
    parser,
    sourceRoot,
    ...sources,
    base + 'cupertino.dart',
    base + 'material.dart',
  ]),
);
assert(
  catalog.units.every((unit) => unit.parseDiagnostics.length === 0),
  'Dart syntax diagnostics',
);
const units = new Map(catalog.units.map((unit) => [unit.source, unit]));
const existing = new Map();
for (const pkg of ['cupertino', 'material']) {
  const manifest = JSON.parse(fs.readFileSync('packages/' + pkg + '/package.json', 'utf8'));
  for (const [specifier, entry] of Object.entries(manifest.exports)) {
    const file =
      'packages/' + pkg + '/' + entry.default.replace('./dist/', 'src/').replace(/\.js$/, '.ts');
    const source = ts.createSourceFile(
      file,
      fs.readFileSync(file, 'utf8'),
      ts.ScriptTarget.Latest,
      true,
    );
    for (const node of source.statements) {
      const names = [];
      if (
        ts.canHaveModifiers(node) &&
        ts.getModifiers(node)?.some((mod) => mod.kind === ts.SyntaxKind.ExportKeyword)
      ) {
        if (node.name) names.push(node.name.text);
        if (ts.isVariableStatement(node))
          for (const value of node.declarationList.declarations)
            if (ts.isIdentifier(value.name)) names.push(value.name.text);
      }
      if (ts.isExportDeclaration(node) && node.exportClause && ts.isNamedExports(node.exportClause))
        names.push(...node.exportClause.elements.map((element) => element.name.text));
      for (const name of names) {
        const key = pkg + ':' + name;
        existing.set(key, [
          ...(existing.get(key) ?? []),
          {
            file,
            module: '@nelyx/' + pkg + specifier.slice(1),
            ownership: file.endsWith('.generated.ts') ? 'generated' : 'adopted',
          },
        ]);
      }
    }
  }
}
function family(source) {
  const file = path.basename(source, '.dart');
  if (
    /^(colors|constants|theme|theme_data|color_scheme|text_theme|typography|interface_level|icons|icon_theme_data|material_localizations|localizations|debug|desktop_text_selection|text_selection|selection_area|adaptive_text_selection|scrollbar|scroll_behavior)/.test(
      file,
    )
  )
    return 'DESIGN-1';
  if (
    /button|chip|checkbox|radio|switch|slider|progress_indicator|activity_indicator|ink_|material_state|widget_state|focus|feedback/.test(
      file,
    )
  )
    return 'DESIGN-2';
  if (
    /text_field|text_form|form_|list_|menu|tooltip|dialog|sheet|picker|date|time|search|autocomplete|select|dropdown|expansion|reorder|refresh/.test(
      file,
    )
  )
    return 'DESIGN-3';
  return 'DESIGN-4';
}
const publicUnits = new Set();
for (const pkg of ['cupertino', 'material'])
  for (const directive of units.get(base + pkg + '.dart').directives) {
    if (directive.kind.startsWith('Export'))
      publicUnits.add(path.posix.normalize(base + directive.uri));
  }
const graph = new Map();
const rows = sources.map((source) => {
  const unit = units.get(source),
    pkg = source.split('/')[4];
  const dependencies = unit.directives
    .filter((d) => d.uri)
    .map((d) => {
      const destination = d.uri.startsWith('package:flutter/')
        ? base + d.uri.slice('package:flutter/'.length)
        : d.uri.includes(':')
          ? d.uri
          : path.posix.normalize(path.posix.join(path.posix.dirname(source), d.uri));
      return {
        uri: d.uri,
        source: destination,
        owner: units.has(destination)
          ? 'design'
          : destination.startsWith(base)
            ? 'core'
            : destination.startsWith('dart:ui')
              ? 'core-ui'
              : 'external',
        directive: d.kind,
      };
    });
  graph.set(
    source,
    dependencies.map((d) => d.source).filter((file) => sources.includes(file)),
  );
  return {
    ...unit,
    package: pkg,
    batch: family(source),
    exportedByPackage: publicUnits.has(source),
    dependencies,
    destination:
      'packages/' + pkg + '/src/' + path.basename(source, '.dart').replaceAll('_', '-') + '.ts',
    sourceRoute:
      'pinned-Flutter-Dart-first; evaluate Doroti only on actual family lowering constraints; finite TypeScript port if both routes cost more',
    declarations: unit.declarations.map((declaration) => ({
      ...declaration,
      selected: publicUnits.has(source) && declaration.private === false,
      existing: existing.get(pkg + ':' + declaration.name) ?? [],
      qualification: 'notVerified',
    })),
    ownership:
      'preserve existing generated/adopted ownership; new generated output uses 3-way merge or explicit adoption',
    acceptance: [
      'strict-public-types',
      'Core-identity',
      'theme-locale-RTL',
      'state-layout-paint-hit-clip',
      'input-focus-selection',
      'error-cancel-restore-close',
      'source-numeric-license-assets',
      'independent-consumer',
      'affected-platform-delivery',
    ],
  };
});
// Tarjan components expose cross-family import cycles before assigning execution batches.
let sequence = 0;
const ids = new Map(),
  low = new Map(),
  stack = [],
  active = new Set(),
  components = [];
function visit(file) {
  ids.set(file, sequence);
  low.set(file, sequence++);
  stack.push(file);
  active.add(file);
  for (const target of graph.get(file)) {
    if (!ids.has(target)) {
      visit(target);
      low.set(file, Math.min(low.get(file), low.get(target)));
    } else if (active.has(target)) low.set(file, Math.min(low.get(file), ids.get(target)));
  }
  if (low.get(file) === ids.get(file)) {
    const members = [];
    let member;
    do {
      member = stack.pop();
      active.delete(member);
      members.push(member);
    } while (member !== file);
    components.push(members.sort());
  }
}
for (const source of sources) if (!ids.has(source)) visit(source);
const result = {
  schema: 'nelyx.w11-design-package-plan/v1',
  recordedAt: new Date().toISOString(),
  status: 'PLANNED',
  sourceRoot,
  revision: pin,
  parser: { file: parser, sha256: sha(parser) },
  generator: {
    file: path.relative(root, import.meta.filename).replaceAll('\\', '/'),
    sha256: sha(import.meta.filename),
  },
  scope:
    'Both pinned package source units, exact syntax declaration/member spans, package exports, private helper scope, common dependency ownership, SCCs and destinations. Mapping is not behavior or conversion qualification.',
  sourceChoicePolicy:
    'Family candidates use the existing resolved Dart frontend/emitter. Blocked families compare current pinned Doroti bytes/API and required semantic/runtime corrections before finite TypeScript adoption. No generic compiler prerequisite.',
  coreIdentity:
    'All Widget/Element/State/RenderObject, Color, input/focus and resource owners bind to @nelyx/core. No second Doroti runtime.',
  packages: ['cupertino', 'material'].map((pkg) => ({
    package: pkg,
    files: rows.filter((row) => row.package === pkg).length,
    publicDeclarations: rows
      .filter((row) => row.package === pkg)
      .flatMap((row) => row.declarations)
      .filter((row) => row.selected).length,
  })),
  components: components.map((files, index) => ({
    id: 'design-scc-' + index,
    files,
    batches: [...new Set(rows.filter((row) => files.includes(row.source)).map((row) => row.batch))],
  })),
  units: rows,
};
const output = 'tools/Nelyx.FrameworkToTypeScript/data/work8/w11-design-package-plan.json';
fs.writeFileSync(output, JSON.stringify(result, null, 2) + '\n');
const raw = '.tmp/work8/w11-design-catalog.json';
fs.writeFileSync(raw, JSON.stringify(catalog, null, 2) + '\n');
console.log(
  JSON.stringify({
    status: result.status,
    packages: result.packages,
    components: components.length,
    mappedDeclarations: rows.flatMap((row) => row.declarations).filter((row) => row.existing.length)
      .length,
    output,
  }),
);
