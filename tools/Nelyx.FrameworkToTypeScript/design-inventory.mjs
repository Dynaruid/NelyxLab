// SPDX-License-Identifier: BSD-3-Clause
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { pathToFileURL } from 'node:url';
import { frameworkInventory } from '../../Nelyx/eng/framework-inventory.mjs';
import { openFlutterSource } from './flutter-source.mjs';

const root = path.resolve(import.meta.dirname, '../..');
const packages = ['material', 'cupertino'];
const tooling = 'tools/Nelyx.FrameworkToTypeScript/';
const animatedIconFramesFile =
  'packages/material/src/generated/animated-icons/animated-icon-frames.generated.ts';
const local = (file) => fs.readFileSync(path.join(root, file));
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const decode = (bytes) => JSON.parse(bytes.toString('utf8'));
const referencePhases = [
  'type',
  'runtimeTypeUse',
  'heritage',
  'constant',
  'lazyInitializer',
  'instanceInitializer',
  'parameterDefault',
  'execution',
  'metadata',
  'documentation',
];
const executionPhases = referencePhases.filter(
  (phase) => !['type', 'metadata', 'documentation'].includes(phase),
);

function checkedPhases(item) {
  if (item.dependencyPhases === undefined) return null;
  const combined = new Set(item.dependencies);
  const classified = new Set();
  for (const [phase, refs] of Object.entries(item.dependencyPhases)) {
    if (!referencePhases.includes(phase) || !Array.isArray(refs))
      throw Error(`Invalid reference phase ${phase} in ${item.upstreamId}`);
    if (refs.length !== new Set(refs).size || refs.some((ref) => !combined.has(ref)))
      throw Error(`Invalid reference identities in ${item.upstreamId}: ${phase}`);
    refs.forEach((ref) => classified.add(ref));
  }
  if (classified.size !== combined.size)
    throw Error(`Unclassified references in ${item.upstreamId}`);
  return item.dependencyPhases;
}

const families = [
  [
    'W11-02',
    /^(?:colors|constants|theme|theme_data|color_scheme|text_theme|typography|interface_level|icons|material_localizations|localizations)$|_theme(?:_data)?$/,
  ],
  [
    'W11-06',
    /^(?:data_table|paginated_data_table|stepper|expansion_panel|carousel|refresh|sliver_app_bar)/,
  ],
  [
    'W11-05',
    /(?:text_field|text_form|form_|autocomplete|date|time_picker|(?:^|_)picker|search_field)/,
  ],
  [
    'W11-04',
    /(?:app_bar|navigation|tab_|scaffold|drawer|dialog|sheet|snack_bar|menu|dropdown|search|route|^app$|nav_bar)/,
  ],
  [
    'W11-03',
    /(?:button|chip|checkbox|radio|switch|slider|progress|activity|list_tile|form_row|thumb_painter|^segmented_control$)/,
  ],
];
function family(library) {
  const file = path.posix.basename(library, '.dart');
  if (['segmented_button', 'sliding_segmented_control'].includes(file)) return 'W11-01';
  return families.find(([, pattern]) => pattern.test(file))?.[0] ?? 'W11-07';
}

function namespace(library) {
  return /^package:flutter\/src\/(material|cupertino)\//.exec(library)?.[1];
}

function owner(library) {
  const design = namespace(library);
  if (design) return `@nelyx/${design}`;
  if (library === 'dart:ui' || library === 'dart:ui_web') return '@nelyx/core';
  if (library.startsWith('package:flutter/')) return '@nelyx/core';
  if (library.startsWith('package:flutter_localizations/')) return 'design-localizations';
  return 'runtime-binding';
}

// These private defaults are selected only on the false branch of useMaterial3
// at the recorded Flutter pin. NavigationRail also reads an M2 width in shared
// layout, so its default class remains in scope.
const material2Defaults = new Set([
  'app_bar.dart::_AppBarDefaultsM2',
  'banner.dart::_BannerDefaultsM2',
  'bottom_app_bar.dart::_BottomAppBarDefaultsM2',
  'card.dart::_CardDefaultsM2',
  'checkbox.dart::_CheckboxDefaultsM2',
  'date_picker_theme.dart::_DatePickerDefaultsM2',
  'dialog.dart::_DialogDefaultsM2',
  'divider.dart::_DividerDefaultsM2',
  'drawer.dart::_DrawerDefaultsM2',
  'expansion_tile.dart::_ExpansionTileDefaultsM2',
  'floating_action_button.dart::_FABDefaultsM2',
  'input_decorator.dart::_InputDecoratorDefaultsM2',
  'list_tile.dart::_LisTileDefaultsM2',
  'navigation_bar.dart::_NavigationBarDefaultsM2',
  'popup_menu.dart::_PopupMenuDefaultsM2',
  'progress_indicator.dart::_CircularProgressIndicatorDefaultsM2',
  'progress_indicator.dart::_LinearProgressIndicatorDefaultsM2',
  'radio.dart::_RadioDefaultsM2',
  'range_slider.dart::_RangeSliderDefaultsM2',
  'slider.dart::_SliderDefaultsM2',
  'snack_bar.dart::_SnackbarDefaultsM2',
  'switch.dart::_SwitchDefaultsM2',
  'tabs.dart::_TabsDefaultsM2',
  'time_picker.dart::_TimePickerDefaultsM2',
]);

function designScope(library, symbol) {
  if (namespace(library) === 'cupertino') return 'cupertino';
  if (namespace(library) !== 'material') return 'shared';
  const declaration = symbol.split('.')[0];
  if (material2Defaults.has(`${library.slice(library.lastIndexOf('/') + 1)}::${declaration}`))
    return 'material-2-only';
  if (/^_.*(?:Defaults|Theme)M2$/.test(declaration)) return 'material-2-defaults-review';
  if (library.endsWith('/toggle_buttons.dart') && declaration === 'ToggleButtons')
    return 'material-2-api-review';
  return 'material-3-scope-review';
}

// Tarjan emits dependencies before consumers, with mutually dependent design
// declarations in the same unit. Core and runtime bindings keep their own owner.
function components(records, edges = (record) => record.edges) {
  const design = new Map(
    records.filter((record) => namespace(record.library)).map((r) => [r.id, r]),
  );
  const stack = [],
    active = new Set(),
    index = new Map(),
    groups = [];
  function visit(record) {
    const start = index.size;
    index.set(record.id, start);
    let low = start;
    stack.push(record.id);
    active.add(record.id);
    for (const id of edges(record)) {
      const child = design.get(id);
      if (!child) continue;
      if (!index.has(id)) low = Math.min(low, visit(child));
      else if (active.has(id)) low = Math.min(low, index.get(id));
    }
    if (low === start) {
      const ids = [];
      let id;
      do {
        id = stack.pop();
        active.delete(id);
        ids.push(id);
      } while (id !== record.id);
      groups.push(ids.sort());
    }
    return low;
  }
  for (const record of design.values()) if (!index.has(record.id)) visit(record);
  return groups;
}

function designBodyUnits(records, files) {
  // Body IR processes a class with its members in one input. Project member
  // references onto that declaration before grouping executable dependencies.
  const design = records.filter((record) => namespace(record.library));
  const topLevel = new Map();
  const declarationOf = new Map();
  const key = (record, symbol) => `${record.library}::${record.origin.file}::${symbol}`;
  for (const record of design) {
    if (record.symbol.includes('.') || !record.origin.gitBlob) continue;
    const name = key(record, record.symbol);
    if (!topLevel.has(name)) topLevel.set(name, record);
  }
  for (const record of design) {
    const owner = topLevel.get(key(record, record.symbol.split('.')[0]));
    if (owner) declarationOf.set(record.id, owner.id);
  }
  const edges = new Map([...topLevel.values()].map((record) => [record.id, new Set()]));
  for (const record of design) {
    const owner = declarationOf.get(record.id);
    if (owner === undefined) continue;
    for (const phase of executionPhases) {
      for (const id of record.dependencyPhases[phase] ?? []) {
        const dependency = declarationOf.get(id);
        if (dependency !== undefined && dependency !== owner) edges.get(owner).add(dependency);
      }
    }
  }
  const tops = new Map([...topLevel.values()].map((record) => [record.id, record]));
  const groups = components([...tops.values()], (record) => edges.get(record.id));
  const unitsByDeclaration = new Map(groups.flatMap((ids, unit) => ids.map((id) => [id, unit])));
  const typeDependencies = new Map();
  const sharedDependencies = new Map();
  const add = (map, unit, dependency) => {
    if (!map.has(unit)) map.set(unit, new Set());
    map.get(unit).add(dependency);
  };
  for (const record of design) {
    const unit = unitsByDeclaration.get(declarationOf.get(record.id));
    if (unit === undefined) continue;
    for (const phase of ['type', ...executionPhases]) {
      for (const id of record.dependencyPhases[phase] ?? []) {
        const target = unitsByDeclaration.get(declarationOf.get(id));
        if (target === undefined) add(sharedDependencies, unit, id);
        else if (target !== unit && phase === 'type') add(typeDependencies, unit, target);
      }
    }
  }
  return groups.map((ids, id) => {
    const declarations = ids.map((id) => tops.get(id));
    const dependencies = [
      ...new Set(
        ids.flatMap((key) =>
          [...edges.get(key)]
            .map((target) => unitsByDeclaration.get(target))
            .filter((target) => target !== id),
        ),
      ),
    ].sort((a, b) => a - b);
    const inputs = new Map();
    for (const declaration of declarations) {
      const source = declaration.origin.file;
      const entry = inputs.get(source) ?? {
        source,
        sha256: files.get(source).upstreamSha256,
        symbols: [],
        identities: [],
      };
      entry.symbols.push(declaration.symbol);
      entry.identities.push(declaration.upstreamId);
      inputs.set(source, entry);
    }
    return {
      id,
      families: [...new Set(declarations.map((record) => record.family))].sort(),
      declarations: ids,
      dependencies,
      typeDependencies: [...(typeDependencies.get(id) ?? [])].sort((a, b) => a - b),
      sharedDependencies: [...(sharedDependencies.get(id) ?? [])].sort(),
      recipeInputs: [...inputs.values()],
    };
  });
}

export function selectDesignBodyUnits(units, family, includeDependencies = false) {
  const selected = new Set(
    units
      .filter((unit) => family === 'all' || unit.families.includes(family))
      .map((unit) => unit.id),
  );
  if (includeDependencies) {
    const byId = new Map(units.map((unit) => [unit.id, unit]));
    for (const id of selected) {
      const unit = byId.get(id);
      for (const dependency of [...unit.dependencies, ...unit.typeDependencies]) {
        if (!byId.has(dependency))
          throw Error(`Missing design Body IR dependency ${dependency} of ${id}`);
        selected.add(dependency);
      }
    }
  }
  return units.filter((unit) => selected.has(unit.id));
}

function currentExports(coverage) {
  const matches = new Map();
  for (const entry of frameworkInventory({ coverage }).modules) {
    if (!['@nelyx/core', ...packages.map((name) => `@nelyx/${name}`)].includes(entry.package))
      continue;
    if (entry.module.includes('/internal/')) continue;
    for (const decl of entry.declarations) {
      const key = `${entry.package}/${decl.name}`;
      const values = matches.get(key) ?? [];
      values.push({
        module: entry.module,
        file: decl.owner,
        origins: [
          ...decl.source.map((source) => source.upstreamId),
          ...decl.manual.map((source) => source.qualifiedId),
        ],
        members: new Set(decl.members.map((member) => member.name)),
      });
      matches.set(key, values);
    }
  }
  return matches;
}

function productBindings(matches, item, symbol, productOwner) {
  const [name, ...nested] = symbol.split('.');
  return (matches.get(`${productOwner}/${name}`) ?? [])
    .filter(
      (entry) =>
        nested.length === 0 ||
        entry.members.has(nested[0]) ||
        entry.origins.includes(item.upstreamId),
    )
    .map(({ module, file, origins }) => ({
      module,
      file,
      match: origins.includes(item.upstreamId) ? 'mapped-origin' : 'candidate',
      ownership:
        file.endsWith('.generated.ts') || file.includes('/generated/') ? 'generated' : 'adopted',
    }));
}

function iconMembers(record, text, matches, catalog) {
  const generated = new Map(catalog.icons.map((icon) => [icon.name, icon]));
  const fields = [];
  let line = 1;
  let boundary = text.indexOf('\n');
  for (const decl of text.matchAll(
    /^[ \t]*(static const (IconData|String) (\w+) = (?:IconData\(\s*(0x[\da-fA-F]+|\d+)|'[^']*'))/gm,
  )) {
    const [, prefix, type, name, codePoint] = decl;
    const offset = decl.index + decl[0].length - prefix.length;
    const end = text.indexOf(';', offset);
    if (end < 0) throw Error(`Missing pinned icon field terminator: ${name}`);
    while (boundary !== -1 && boundary < offset) {
      line++;
      boundary = text.indexOf('\n', boundary + 1);
    }
    const value = generated.get(name);
    if (type === 'IconData' && (value?.codePoint !== Number(codePoint) || !generated.delete(name)))
      throw Error(`Icon data origin differs: ${record.library}::${name}`);
    const symbol = `${record.symbol}.${name}`;
    const upstreamId = `${record.library}::${symbol}:FIELD`;
    const content = text.slice(offset, end + 1);
    fields.push({
      id: sha256(upstreamId).slice(0, 20),
      upstreamId,
      owner: record.owner,
      publicIn: record.publicIn,
      signature: `static const ${type} ${name}`,
      origin: {
        file: record.origin.file,
        gitBlob: record.origin.gitBlob,
        offset,
        length: content.length,
        line,
        sha256: sha256(content),
        encoding: 'UTF-16 indices in Git blob',
      },
      bindings: productBindings(matches, { upstreamId }, symbol, record.owner),
    });
  }
  if (generated.size || fields.length !== record.constantFamily.count)
    throw Error(`Pinned icon catalog denominator differs: ${record.library}`);
  return fields;
}

/** Adapt the existing resolved analyzer baseline. Every in-scope Flutter source
 * location is checked against the immutable Git source before it is reported. */
export function designInventory(repository, { coverageFile } = {}) {
  const source = openFlutterSource(repository);
  const baseline = coverageFile
    ? fs.readFileSync(path.resolve(coverageFile))
    : local('Nelyx/upstream/flutter-coverage.json');
  const coverage = decode(baseline);
  if (
    coverage.schemaVersion !== 1 ||
    coverage.source.revision !== source.revision ||
    coverage.source.toolFrontendSha256 !== sha256(local(`${tooling}dart/bin/inventory.dart`)) ||
    coverage.analysis.sourceDiagnostics.length
  )
    throw Error(
      'Expected the resolved, diagnostic-free baseline for the configured Flutter revision',
    );
  const prior = decode(local(`${tooling}data/work8/w11-design-package-plan.json`));
  if (prior.revision !== source.revision) throw Error('Historical design mapping pin differs');
  const priorByPath = new Map(prior.units.map((unit) => [unit.source, unit]));
  const iconCatalog = decode(local(`${tooling}data/work8/w11-icon-data-ownership.json`));
  const animatedIconParts = new Map(
    fs.existsSync(path.join(root, animatedIconFramesFile))
      ? [...local(animatedIconFramesFile).toString().matchAll(
          /^  \/\/ animated_icons\/data\/([a-z_]+)\.g\.dart \(Git blob ([a-f0-9]{40})\)$/gm,
        )].map(([, name, blob]) => [name, blob])
      : [],
  );
  const matches = currentExports(coverage);
  const byId = new Map(coverage.items.map((item) => [item.id, item]));
  const files = new Map(coverage.source.files.map((file) => [file.id, file]));
  const external = new Map(coverage.externalDependencies.map((item) => [item.id, item]));
  const publicById = new Map();
  const roots = {};
  for (const name of packages) {
    const uri = `package:flutter/${name}.dart`;
    const entry = coverage.scope.entrypoints.find((candidate) => candidate.uri === uri);
    if (!entry) throw Error(`Missing resolved namespace: ${uri}`);
    roots[name] = entry.exports;
    const publicQueue = [
      ...entry.exports,
      ...coverage.scope.conditionalExports
        .filter((branch) => branch.via === uri)
        .flatMap((branch) => branch.exports),
    ];
    const seen = new Set();
    for (const id of publicQueue) {
      if (seen.has(id)) continue;
      seen.add(id);
      const item = byId.get(id);
      if (!item) {
        if (!external.has(id)) throw Error(`Unresolved namespace identity: ${id}`);
        publicById.set(id, [...(publicById.get(id) ?? []), name]);
        continue;
      }
      if (!item.public) continue;
      publicById.set(id, [...(publicById.get(id) ?? []), name]);
      publicQueue.push(...item.members);
    }
  }
  const closure = new Set(publicById.keys());
  const queue = [...closure];
  for (const id of queue) {
    const item = byId.get(id);
    if (!item && !external.has(id)) throw Error(`Unresolved dependency identity: ${id}`);
    if (!item) continue;
    for (const dependency of [
      ...item.members,
      ...item.dependencies,
      ...(item.supertypes ?? []).map((type) => type.id),
    ]) {
      if (closure.has(dependency)) continue;
      closure.add(dependency);
      queue.push(dependency);
    }
  }
  const usedFiles = new Map();
  for (const id of closure) {
    const item = byId.get(id);
    if (!item) continue;
    const file = files.get(item.source.file);
    if (!file) throw Error(`Missing source file for ${item.upstreamId}`);
    usedFiles.set(file.path, file);
  }
  source.preload([...usedFiles.values()].filter((file) => file.gitBlob).map((file) => file.path));
  const analysisText = new Map();
  for (const file of usedFiles.values()) {
    if (!file.gitBlob) continue; // External pub sources retain the baseline package identity.
    const bytes = source.read(file.path);
    if (source.blob(file.path) !== file.gitBlob || sha256(bytes) !== file.upstreamSha256)
      throw Error(`Baseline differs from pinned Git blob: ${file.path}`);
    const text = bytes.toString('utf8');
    // The older Analyzer result can carry UTF-16 spans in Windows checkout coordinates.
    const analyzed =
      file.sha256 === file.upstreamSha256 ? text : text.replace(/(?<!\r)\n/g, '\r\n');
    if (sha256(analyzed) !== file.sha256)
      throw Error(`Unknown analysis source encoding: ${file.path}`);
    analysisText.set(file.path, analyzed);
  }
  const records = [];
  for (const id of [...closure].sort()) {
    const item = byId.get(id);
    if (!item) continue;
    const separator = item.upstreamId.lastIndexOf('::');
    const library = item.upstreamId.slice(0, separator);
    const symbol = item.upstreamId.slice(separator + 2, item.upstreamId.lastIndexOf(':'));
    const productOwner = owner(library);
    const file = files.get(item.source.file);
    const text = analysisText.get(file.path);
    const { offset, length, line, sha256: spanHash } = item.source;
    if (
      text !== undefined &&
      (offset + length > text.length || sha256(text.slice(offset, offset + length)) !== spanHash)
    )
      throw Error(
        `Baseline span differs from pinned source: ${item.upstreamId} (${file.path}:${line})`,
      );
    const publicIn = publicById.get(id) ?? [];
    const dependencyPhases = checkedPhases(item);
    const bindings = productBindings(matches, item, symbol, productOwner);
    if (
      library === 'package:flutter/src/material/animated_icons.dart' &&
      item.kind === 'TOP_LEVEL_VARIABLE' &&
      symbol.startsWith('_$')
    ) {
      const name = symbol.slice(2);
      const blob = animatedIconParts.get(name);
      if (blob) {
        if (
          file.path !== `packages/flutter/lib/src/material/animated_icons/data/${name}.g.dart` ||
          source.blob(file.path) !== blob
        )
          throw Error(`Generated animated icon source differs: ${item.upstreamId}`);
        bindings.push({
          module: '@nelyx/material/animated-icons',
          file: animatedIconFramesFile,
          match: 'mapped-origin',
          ownership: 'generated',
        });
      }
    }
    records.push({
      id,
      upstreamId: item.upstreamId,
      library,
      symbol,
      kind: item.kind,
      owner: productOwner,
      family: namespace(library) ? family(library) : 'shared-dependency',
      scope: designScope(library, symbol),
      publicIn,
      origin: { file: file.path, gitBlob: file.gitBlob, offset, length, line, sha256: spanHash },
      signature: item.signature,
      deprecated: item.deprecated,
      internal: item.internal,
      parameters: item.parameters,
      supertypes: item.supertypes,
      members: item.members,
      constantFamily: item.constantFamily,
      dependencyPhases,
      edges: [
        ...new Set([
          ...item.members,
          ...item.dependencies,
          ...(item.supertypes ?? []).map((type) => type.id),
        ]),
      ].sort(),
      historicalDestination: priorByPath.get(file.path)?.destination,
      bindings,
      qualification: 'pending',
    });
  }
  const recordById = new Map(records.map((record) => [record.id, record]));
  for (const record of records) {
    if (!record.constantFamily) continue;
    const catalog = iconCatalog.catalogs.find((candidate) => candidate.symbol === record.symbol);
    if (!catalog || catalog.source.sha256 !== files.get(byId.get(record.id).source.file).sha256)
      throw Error(`Missing matching generated icon ownership: ${record.upstreamId}`);
    record.constantMembers = iconMembers(record, source.text(record.origin.file), matches, catalog);
  }
  const groups = components(records);
  const moduleInitialization = (record) => [
    ...(record.dependencyPhases?.heritage ?? []),
    ...(record.dependencyPhases?.constant ?? []),
  ];
  const classified = records.every((record) => record.dependencyPhases !== null);
  const executionUnits = classified
    ? components(records, (record) => [
        ...record.members,
        ...executionPhases.flatMap((phase) => record.dependencyPhases[phase] ?? []),
      ])
    : null;
  const initializationCycles = classified
    ? components(records, moduleInitialization).filter(
        (group) =>
          group.length > 1 || moduleInitialization(recordById.get(group[0])).includes(group[0]),
      )
    : null;
  const unitById = new Map(groups.flatMap((group, i) => group.map((id) => [id, i])));
  const units = groups.map((ids, index) => {
    const declarations = ids.map((id) => recordById.get(id));
    const dependencies = new Set();
    const shared = new Set();
    const modules = new Map();
    for (const record of declarations)
      for (const id of record.edges) {
        const unit = unitById.get(id);
        if (unit === undefined) shared.add(id);
        else if (unit !== index) dependencies.add(unit);
      }
    for (const record of declarations) {
      if (record.symbol.includes('.') || !record.origin.gitBlob) continue;
      const file = record.origin.file;
      const module = modules.get(file) ?? {
        source: file,
        sha256: usedFiles.get(file).upstreamSha256,
        symbols: [],
      };
      module.symbols.push(record.symbol);
      modules.set(file, module);
    }
    return {
      id: index,
      families: [...new Set(declarations.map((record) => record.family))].sort(),
      declarations: ids,
      dependencies: [...dependencies].sort((a, b) => a - b),
      sharedDependencies: [...shared].sort(),
      ...(modules.size ? { recipeInputs: [...modules.values()] } : {}),
    };
  });
  return {
    schema: 'nelyx.design-inventory/v1',
    revision: source.revision,
    analysis: {
      baselineSha256: sha256(baseline),
      frontendSha256: coverage.source.toolFrontendSha256,
      analyzedLockSha256: coverage.source.toolDependencyLockSha256,
      currentLockSha256: sha256(local(`${tooling}dart/pubspec.lock`)),
      dartSdk: coverage.source.dartSdk,
      dartRevision: coverage.source.dartRevision ?? null,
      analyzer: coverage.source.analyzer,
      designPolicy: 'Candidate scope. Material declarations require explicit Material 3 review.',
      dependencyPolicy: classified
        ? 'Resolved Dart use sites distinguish type, runtime type uses, heritage, constants, lazy and instance initialization, defaults, execution, metadata and documentation. Heritage and constant cycles require emitter initialization review.'
        : 'Combined Analyzer reference edges. Regenerate coverage to classify type and initialization.',
    },
    roots,
    conditionalExports: coverage.scope.conditionalExports.filter((branch) =>
      packages.some((name) => branch.via === `package:flutter/${name}.dart`),
    ),
    files: [...usedFiles.values()].sort((a, b) => a.path.localeCompare(b.path, 'en')),
    records,
    external: [...closure]
      .sort()
      .flatMap((id) =>
        external.has(id) ? [{ ...external.get(id), publicIn: publicById.get(id) ?? [] }] : [],
      ),
    units,
    executionUnits,
    initializationCycles,
    bodyUnits: classified ? designBodyUnits(records, usedFiles) : null,
  };
}

export function designInventoryMain(args) {
  const { values } = parseArgs({
    args,
    options: {
      source: { type: 'string' },
      coverage: { type: 'string' },
      output: { type: 'string' },
      family: { type: 'string', default: 'all' },
    },
  });
  if (!values.source || !/^(?:all|W11-0[1-7])$/.test(values.family))
    throw Error(
      'design-inventory --source <Flutter Git repository> [--coverage <resolved coverage JSON>] [--family all|W11-0[1-7]] [--output <new JSON file>]',
    );
  const inventory = designInventory(values.source, { coverageFile: values.coverage });
  const required = new Set();
  const visit = (unit) => {
    if (required.has(unit.id)) return;
    required.add(unit.id);
    for (const dependency of unit.dependencies) visit(inventory.units[dependency]);
  };
  for (const unit of inventory.units)
    if (values.family === 'all' || unit.families.includes(values.family)) visit(unit);
  const selected = inventory.units.filter((unit) => required.has(unit.id));
  inventory.selection = { family: values.family, units: selected.map((unit) => unit.id) };
  if (values.output)
    fs.writeFileSync(values.output, `${JSON.stringify(inventory)}\n`, { flag: 'wx' });
  console.log(
    JSON.stringify({
      revision: inventory.revision,
      analyzer: inventory.analysis.analyzer,
      dartRevision: inventory.analysis.dartRevision,
      analysisLockMatchesCurrent:
        inventory.analysis.analyzedLockSha256 === inventory.analysis.currentLockSha256,
      files: inventory.files.length,
      records: inventory.records.length,
      external: inventory.external.length,
      units: inventory.units.length,
      selectedUnits: selected.length,
      classifiedDeclarations: inventory.records.filter((item) => item.dependencyPhases !== null)
        .length,
      initializationCycles: inventory.initializationCycles?.length ?? null,
      executionUnits: inventory.executionUnits?.length ?? null,
      bodyUnits: inventory.bodyUnits?.length ?? null,
      namespaces: Object.fromEntries(
        packages.map((name) => {
          const declarations = inventory.records.filter(
            (record) => record.owner === `@nelyx/${name}` && record.publicIn.includes(name),
          );
          return [
            name,
            {
              exportedNames: inventory.roots[name].length,
              ownedDeclarationsAndMembers: declarations.length,
              additionalIconMembers: declarations.reduce(
                (count, record) => count + (record.constantFamily?.count ?? 0),
                0,
              ),
              withoutProductCandidate: declarations.filter((record) => !record.bindings.length)
                .length,
            },
          ];
        }),
      ),
    }),
  );
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url)
  designInventoryMain(process.argv.slice(2));
