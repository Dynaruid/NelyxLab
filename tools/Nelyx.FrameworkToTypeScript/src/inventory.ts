// SPDX-License-Identifier: BSD-3-Clause
import path from 'node:path';
import { freshScratch } from './paths.ts';

const [dart, source, output] = process.argv.slice(2);
if (!dart || !source || !output)
  throw new Error(
    'bun src/inventory.ts <dart-executable> <pinned-flutter-checkout> <fresh-scratch-directory>',
  );
const target = await freshScratch(output);
const frontend = path.resolve(import.meta.dir, '../dart/bin/inventory.dart');
const child = Bun.spawn([path.resolve(dart), 'run', frontend, path.resolve(source), target], {
  stdout: 'inherit',
  stderr: 'inherit',
  timeout: 1200000,
});
const code = await child.exited;
if (code !== 0) throw new Error(`Dart inventory failed (${code}); partial results are not adopted`);
console.log(`Resolved inventory in ${target}; review before adopting into product coverage`);
