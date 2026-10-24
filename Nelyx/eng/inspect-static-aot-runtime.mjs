// SPDX-License-Identifier: BSD-3-Clause
import path from 'node:path';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';

const appRoot = path.resolve(import.meta.dirname, '../../sample/nelyx-testbed-app-2');
const runner = path.join(appRoot, 'windows/runner'), load = createRequire(path.join(runner, 'package.json'));
const {inspectRuntimeInventory} = await import(pathToFileURL(load.resolve('@nelyx/metro/runtime-inventory')));
const graph = await inspectRuntimeInventory({appRoot, runner, signal: AbortSignal.timeout(1_200_000)});
const owners = new Map();
for (const module of graph.modules) {
  const key = module.owner.name + '@' + module.owner.version;
  const count = owners.get(key) ?? {modules: 0, originalBodies: 0, emittedBodies: 0};
  count.modules++; count.originalBodies += module.original.bodies.length; count.emittedBodies += module.emitted.bodies.length; owners.set(key, count);
}
const candidates = graph.modules.flatMap(module => module.emitted.features.filter(feature => ['runtime-source-candidate', 'computed-require', 'computed-import'].includes(feature.kind)).map(feature => ({module: module.id, ...feature})));
const unresolved = graph.modules.flatMap(module => module.dependencies.filter(edge => edge.target === null).map(edge => ({module: module.id, owner: module.owner.name, ...edge})));
console.log(JSON.stringify({schema: graph.schema, sha256: graph.sha256, entry: graph.entry, stage: graph.identity.stage, summary: graph.summary, runtimeComponents: graph.runtimeComponents.length, evaluationConflicts: graph.evaluationConflicts, owners: Object.fromEntries([...owners].sort()), unresolved, emittedDynamicCandidates: candidates}, null, 2));
