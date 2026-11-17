// SPDX-License-Identifier: BSD-3-Clause
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runSampleWindows } from '../../../Nelyx/eng/run-sample-windows.mjs';

export function demoWindowsArguments(args) {
  const forwarded = [];
  let preparation;
  for (let index = 0; index < args.length; index++) {
    if (args[index] === '--') {
      forwarded.push(...args.slice(index));
      break;
    }
    if (args[index] !== '--preparation') {
      forwarded.push(args[index]);
      continue;
    }
    if (preparation !== undefined || !['legacy', 'split'].includes(args[index + 1]))
      throw Error('--preparation requires legacy or split, once');
    preparation = args[++index];
  }
  if (preparation !== undefined) {
    const boundary = forwarded.indexOf('--'),
      options = boundary < 0 ? forwarded : forwarded.slice(0, boundary);
    if (options.includes('--entry') || options.includes('--package'))
      throw Error('--preparation cannot be combined with --entry or --package');
    forwarded.unshift(
      '--entry',
      preparation === 'split' ? 'src/calendar-preparation.ts' : 'src/index.ts',
    );
  }
  return ['--host', 'native', ...forwarded];
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const app = path.resolve(import.meta.dirname, '..');
  try {
    await runSampleWindows({
      root: path.resolve(app, '../..'),
      app,
      arguments: demoWindowsArguments(process.argv.slice(2)),
    });
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
