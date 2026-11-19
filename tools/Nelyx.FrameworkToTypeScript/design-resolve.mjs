// SPDX-License-Identifier: BSD-3-Clause
import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { execute } from '../../Nelyx/sdk/tooling/cli/src/commands.mjs';
import { designInventoryMain } from './design-inventory.mjs';
import { openFlutterSource } from './flutter-source.mjs';

const { values } = parseArgs({
  options: {
    source: { type: 'string' },
    dart: { type: 'string' },
    family: { type: 'string', default: 'all' },
    output: { type: 'string' },
    write: { type: 'boolean' },
  },
});
if (!values.source || !values.dart || !/^(?:all|W11-0[1-7])$/.test(values.family))
  throw Error(
    'design-resolve --source <Flutter Git repository> --dart <pinned dart> [--family all|W11-0[1-7]] [--output <new design JSON>] [--write]',
  );

const root = fs.realpathSync(path.resolve(import.meta.dirname, '../..'));
const repository = fs.realpathSync(values.source);
const dart = fs.realpathSync(values.dart);
const source = openFlutterSource(repository);
const requiredSdk = /^\s*'dart_revision':\s*'([a-f0-9]{40})',/m.exec(source.text('DEPS'))?.[1];
const sdk = fs.readFileSync(path.resolve(dart, '../../revision'), 'utf8').trim();
if (!requiredSdk || sdk !== requiredSdk)
  throw Error(
    `Dart SDK revision differs from the Flutter pin: expected ${requiredSdk}, found ${sdk}`,
  );

const baseline = path.join(root, 'Nelyx/upstream/flutter-coverage.json');
const before = fs.existsSync(baseline) ? fs.readFileSync(baseline) : null;
const scratch = path.join(root, '.tmp/work8');
fs.mkdirSync(scratch, { recursive: true });
if (fs.realpathSync(scratch) !== scratch) throw Error('Design analysis scratch path is linked');
const owned = fs.mkdtempSync(path.join(scratch, 'design-resolve-'));
const checkout = path.join(owned, 'flutter');
const resolved = path.join(owned, 'resolved');
const cover = path.join(owned, 'coverage');
const output = path.join(cover, 'flutter-coverage.json');
const deadline = Date.now() + 1_200_000;
const abort = new AbortController();
const stop = () => abort.abort();
const run = (command, args, options = {}) => {
  const timeout = deadline - Date.now();
  if (timeout <= 0) throw Error('Design analysis exceeded 20 minutes');
  return execute(command, args, { ...options, timeout, signal: abort.signal });
};
const git = (from, args) => run('git', ['-C', from, ...args]);
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
let linked = false;
try {
  const dartTools = path.join(import.meta.dirname, 'dart');
  await run(dart, ['pub', 'get', '--enforce-lockfile'], { cwd: dartTools });
  await git(repository, [
    'worktree',
    'add',
    '--detach',
    '--no-checkout',
    checkout,
    source.revision,
  ]);
  linked = true;
  await git(checkout, [
    'sparse-checkout',
    'set',
    'packages/flutter/lib',
    'packages/flutter_localizations/lib',
    'engine/src/flutter/lib/ui',
    'engine/src/flutter/lib/web_ui/lib',
  ]);
  await git(checkout, ['checkout', '--detach', source.revision]);
  await run(dart, ['run', path.join(dartTools, 'bin/inventory.dart'), checkout, resolved]);
  await run('bun', [
    path.join(import.meta.dirname, 'src/coverage.ts'),
    path.join(resolved, 'dart-inventory.json'),
    root,
    checkout,
    cover,
  ]);
  const after = fs.readFileSync(output);
  const args = ['--source', repository, '--coverage', output, '--family', values.family];
  if (values.output) args.push('--output', values.output);
  designInventoryMain(args);

  console.log(JSON.stringify(compareCoverage(before, after)));
  if (values.write) {
    const current = fs.existsSync(baseline) ? fs.readFileSync(baseline) : null;
    if (before === null ? current !== null : !current?.equals(before))
      throw Error('Coverage baseline changed during analysis');
    fs.mkdirSync(path.dirname(baseline), { recursive: true });
    fs.renameSync(output, baseline);
  }
} finally {
  process.off('SIGINT', stop);
  process.off('SIGTERM', stop);
  if (path.dirname(owned) !== scratch || fs.realpathSync(owned) !== owned)
    throw Error('Unexpected design analysis scratch owner');
  if (linked)
    await execute('git', ['-C', repository, 'worktree', 'remove', '--force', checkout], {
      timeout: 1_200_000,
    });
  fs.rmSync(owned, { recursive: true, force: true });
}

function compareCoverage(before, after) {
  const fresh = JSON.parse(after.toString('utf8'));
  if (!before) return { previousDeclarations: 0, currentDeclarations: fresh.items.length };
  const previous = JSON.parse(before.toString('utf8'));
  if (previous.source.revision !== fresh.source.revision)
    throw Error('Coverage comparison requires the same pinned Flutter revision');
  const old = new Map(previous.items.map((item) => [item.id, item]));
  const fields = [
    'signature',
    'public',
    'members',
    'dependencies',
    'dependencyPhases',
    'supertypes',
  ];
  const changed = Object.fromEntries(fields.map((field) => [field, 0]));
  let added = 0;
  for (const item of fresh.items) {
    const prior = old.get(item.id);
    if (prior) {
      if (prior.upstreamId !== item.upstreamId) throw Error('Coverage identity collision');
      for (const field of fields)
        if (JSON.stringify(item[field]) !== JSON.stringify(prior[field])) changed[field]++;
      old.delete(item.id);
    } else added++;
  }
  return {
    previousDeclarations: previous.items.length,
    currentDeclarations: fresh.items.length,
    added,
    removed: old.size,
    changed,
  };
}
