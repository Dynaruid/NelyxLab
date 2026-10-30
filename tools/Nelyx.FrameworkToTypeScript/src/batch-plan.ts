// SPDX-License-Identifier: BSD-3-Clause
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import type { BatchRecipe } from './batch.ts';
import { resolvePackageSource } from './package-source.ts';
interface InventoryItem {
  id: string;
  upstreamId: string;
  required: boolean;
  implementation: string;
  dependencies: string[];
  task: string;
}
/** Link registered executable selections to the existing inventory, not a second scan. */
export function linkRecipes(
  root: string,
  pin: string,
  items: InventoryItem[],
  components: string[][],
) {
  const directory = path.join(root, 'tools/Nelyx.FrameworkToTypeScript/data/work8/recipes'),
    claimed = new Set<string>(),
    ids = new Set<string>();
  const componentByLibrary = new Map(
    components.flatMap((libraries, id) => libraries.map((library) => [library, id] as const)),
  );
  return fs
    .readdirSync(directory)
    .filter((file) => file.endsWith('.json'))
    .sort()
    .map((file) => {
      const bytes = fs.readFileSync(path.join(directory, file)),
        recipe = JSON.parse(bytes.toString()) as BatchRecipe;
      if (recipe.schema !== 'nelyx.batch/v1' || recipe.revision !== pin || ids.has(recipe.id))
        throw new Error('Invalid/duplicate inventory recipe: ' + file);
      ids.add(recipe.id);
      const selections = recipe.modules.flatMap((module) => {
        const match = /^packages\/(flutter|flutter_localizations)\/lib\/(.+)$/.exec(module.source);
        const ui = /^engine\/src\/flutter\/lib\/ui\/[A-Za-z0-9_]+\.dart$/.test(module.source);
        if (!match && !ui && !module.source.startsWith('package:'))
          throw new Error(
            'Recipe source needs an explicit inventory library mapping: ' + module.source,
          );
        // The frontend separately verifies exact membership in embedded dart:ui.
        const library = match
            ? `package:${match[1]}/${match[2]}`
            : ui
              ? 'dart:ui'
              : resolvePackageSource(root, module).identity.library,
          component = componentByLibrary.get(library);
        if (component === undefined)
          throw new Error('Recipe library missing from inventory: ' + library);
        return module.symbols.map((symbol) => {
          const candidates = items.filter((item) =>
            item.upstreamId.startsWith(library + '::' + symbol + ':'),
          );
          if (candidates.length !== 1)
            throw new Error('Missing/ambiguous inventory selection: ' + library + '::' + symbol);
          const item = candidates[0]!;
          if (claimed.has(item.id))
            throw new Error('Duplicate generated selection owner: ' + item.upstreamId);
          claimed.add(item.id);
          return {
            id: item.id,
            qualifiedId: item.upstreamId,
            component,
            library,
            destination: module.destination,
            dependencies: item.dependencies,
            ...(module.packagePin
              ? {
                  source: module.source,
                  packagePin: module.packagePin,
                  sourceSha256: module.sha256,
                  librarySha256: module.librarySha256,
                }
              : {}),
          };
        });
      });
      return {
        id: recipe.id,
        recipe: 'tools/Nelyx.FrameworkToTypeScript/data/work8/recipes/' + file,
        sha256: createHash('sha256').update(bytes).digest('hex'),
        package: recipe.package,
        validation: recipe.validation,
        selections,
      };
    });
}
/** Reuse the resolved inventory; SCCs include private/member dependencies. */
export async function scanInventory(root: string): Promise<void> {
  const file = path.join(root, 'Nelyx/upstream/flutter-coverage.json'),
    bytes = fs.readFileSync(file),
    coverage = JSON.parse(bytes.toString()) as {
      source: { revision: string; localSnapshotMatchesPin: boolean };
      items: InventoryItem[];
      externalDependencies: { id: string; upstreamId: string }[];
    };
  const library = (id: string) => id.slice(0, id.lastIndexOf('::'));
  const byId = new Map(
      [...coverage.items, ...coverage.externalDependencies].map((item) => [
        item.id,
        library(item.upstreamId),
      ]),
    ),
    groups = new Map<
      string,
      {
        ids: string[];
        required: number;
        states: Record<string, number>;
        dependencies: Set<string>;
        tasks: Set<string>;
      }
    >();
  for (const external of coverage.externalDependencies) {
    const key = library(external.upstreamId),
      g = groups.get(key) ?? {
        ids: [],
        required: 0,
        states: {},
        dependencies: new Set<string>(),
        tasks: new Set<string>(),
      };
    g.ids.push(external.id);
    g.states.external = (g.states.external ?? 0) + 1;
    g.tasks.add('W8-03 external dependency/adapter');
    groups.set(key, g);
  }
  for (const item of coverage.items) {
    const key = library(item.upstreamId),
      group = groups.get(key) ?? {
        ids: [],
        required: 0,
        states: {},
        dependencies: new Set(),
        tasks: new Set(),
      };
    group.ids.push(item.id);
    if (item.required) group.required++;
    group.states[item.implementation] = (group.states[item.implementation] ?? 0) + 1;
    group.tasks.add(item.task);
    for (const id of item.dependencies) {
      const next = byId.get(id);
      if (!next) throw new Error('Inventory dependency missing: ' + id);
      if (next !== key) group.dependencies.add(next);
    }
    groups.set(key, group);
  }
  let serial = 0;
  const index = new Map<string, number>(),
    low = new Map<string, number>(),
    stack: string[] = [],
    onStack = new Set<string>(),
    components: string[][] = [];
  function visit(key: string) {
    index.set(key, serial);
    low.set(key, serial++);
    stack.push(key);
    onStack.add(key);
    for (const next of groups.get(key)!.dependencies) {
      if (!index.has(next)) {
        visit(next);
        low.set(key, Math.min(low.get(key)!, low.get(next)!));
      } else if (onStack.has(next)) low.set(key, Math.min(low.get(key)!, index.get(next)!));
    }
    if (low.get(key) === index.get(key)) {
      const component: string[] = [];
      let next: string;
      do {
        next = stack.pop()!;
        onStack.delete(next);
        component.push(next);
      } while (next !== key);
      components.push(component.sort());
    }
  }
  for (const key of [...groups.keys()].sort()) if (!index.has(key)) visit(key);
  const registeredRecipes = linkRecipes(root, coverage.source.revision, coverage.items, components);
  const selectedIds = new Set(
    registeredRecipes.flatMap((recipe) => recipe.selections.map((selection) => selection.id)),
  );
  const owner = (library: string) =>
    /\/material\//.test(library)
      ? '@nelyx/material'
      : /\/cupertino\//.test(library)
        ? '@nelyx/cupertino'
        : library.includes('flutter_localizations')
          ? '@nelyx/localizations'
          : '@nelyx/core';
  const stage = (library: string) =>
    /\/(?:material|cupertino)\/|flutter_localizations/.test(library)
      ? 'W8-08'
      : /\/(?:animation|physics|painting\/matrix_utils|rendering\/(?:sliver|viewport)|widgets\/(?:scroll|sliver))/.test(
            library,
          )
        ? 'W8-04'
        : /\/widgets\/(?:editable|form|undo)/.test(library)
          ? 'W8-06'
          : /\/widgets\/(?:app|route|navigator|overlay|restoration)|semantics/.test(library)
            ? 'W8-07'
            : library === 'dart:ui'
              ? 'W8-09'
              : 'W8-05';
  const plan = {
    schema: 'nelyx.inventory-batch-plan/v1',
    revision: coverage.source.revision,
    coverageSha256: createHash('sha256').update(bytes).digest('hex'),
    localSnapshotMatchesPin: coverage.source.localSnapshotMatchesPin,
    records: coverage.items.length,
    externalDependencies: coverage.externalDependencies.length,
    required: coverage.items.filter((i) => i.required).length,
    registeredRecipes,
    executionBoundary:
      'Registered selections are executable closures, not whole-SCC or full-language acceptance. Unselected records retain their feature/manual-port owner and unresolved external/conditional semantics; resume all runs only registered recipes.',
    components: components.map((libraries, id) => ({
      id,
      libraries,
      recipes: registeredRecipes
        .filter((recipe) => recipe.selections.some((selection) => selection.component === id))
        .map((recipe) => recipe.id),
      unselectedRecords: libraries.reduce(
        (count, library) =>
          count + groups.get(library)!.ids.filter((item) => !selectedIds.has(item)).length,
        0,
      ),
    })),
    batches: [...groups.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([library, g]) => ({
        library,
        package: owner(library),
        task: stage(library),
        mode: 'generate-or-explicit-manual-port',
        required: g.required,
        ids: g.ids,
        states: g.states,
        w6Tasks: [...g.tasks].sort(),
        dependencies: [...g.dependencies].sort(),
        recipes: registeredRecipes
          .filter((recipe) => recipe.selections.some((selection) => selection.library === library))
          .map((recipe) => recipe.id),
      })),
  };
  const output = path.join(
    root,
    'tools/Nelyx.FrameworkToTypeScript/data/work8/inventory-plan.json',
  );
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, JSON.stringify(plan) + '\n');
  console.log(
    JSON.stringify({
      records: plan.records,
      required: plan.required,
      libraries: groups.size,
      scc: components.length,
      output,
    }),
  );
}
