// SPDX-License-Identifier: BSD-3-Clause
// Development verification only; product builds/runtimes do not load converter data.
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
const root = path.resolve(import.meta.dirname, '../..');
const read = (file) => JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'));
const hash = (file) =>
  createHash('sha256')
    .update(fs.readFileSync(path.join(root, file)))
    .digest('hex');
const registryFile =
  'tools/Nelyx.FrameworkToTypeScript/data/work8/w12-module-layout-ownership.json';
const registry = read(registryFile),
  errors = [];
const verify = (row) => {
  if (!fs.existsSync(path.join(root, row.file))) errors.push('Missing owner input: ' + row.file);
  else if (hash(row.file) !== row.sha256) errors.push('Owner input changed: ' + row.file);
};
verify(registry.layout);
for (const move of registry.moved) verify(move.current);
for (const split of registry.adoptedSplits ?? []) for (const row of split.outputs) verify(row);
for (const file of registry.retiredPaths)
  if (fs.existsSync(path.join(root, file)))
    errors.push('Retired implementation path recreated: ' + file);
for (const row of registry.generatorSources ?? []) verify(row);
for (const row of registry.generatorInfrastructure ?? []) verify(row);
for (const row of registry.sourceNotices) verify(row);
const state = read('tools/Nelyx.FrameworkToTypeScript/data/work8/state.json');
for (const row of registry.adoptions) {
  const current = state.batches[row.batchId]?.files?.find(
    (file) => file.destination === row.adopted.destination,
  );
  if (
    !current ||
    current.mode !== 'adopted' ||
    current.baseHash !== row.previous.baseHash ||
    current.fingerprint !== row.previous.fingerprint ||
    current.productHash !== hash(current.destination)
  )
    errors.push(
      'Adopted generated body lost its base/fingerprint/product protection: ' +
        row.adopted.destination,
    );
}
for (const entry of registry.activeOwnershipRecords) {
  const owner = read(entry.file);
  for (const row of [...(owner.outputs ?? []), owner.output].filter(Boolean)) verify(row);
}
console.log(
  JSON.stringify({
    status: errors.length ? 'FAIL' : 'PASS-scoped',
    movedFiles: registry.moved.length,
    adoptedBatchFiles: registry.adoptions.length,
    managedOwners: registry.activeOwnershipRecords.length,
    errors,
    scope:
      'Current layout, generated/adopted bytes, retired destinations, generator/notices and preserved historical batch base/fingerprint. Standalone generator output/behavior/native qualification remain separate.',
  }),
);
if (errors.length) process.exitCode = 1;
